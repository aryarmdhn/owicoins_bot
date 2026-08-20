import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { mutate, InsufficientFunds } from "./economy.js";

export { InsufficientFunds };
export class SendError extends Error {}
export class SendLimit extends Error {}

export const DAILY_COUNT = 3;
export const DAILY_TOTAL = 300_000;

export async function send(sender, receiver, amount) {
  if (!Number.isInteger(amount) || amount <= 0) throw new SendError("Amount must be a positive number.");
  if (sender.id === receiver.id) throw new SendError("You can't send OwiCoins to yourself.");
  if (receiver.bot) throw new SendError("You can't send OwiCoins to a bot.");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const s = await getOrCreate(sender.id, sender.username, conn);
    const r = await getOrCreate(receiver.id, receiver.username, conn);

    const [[used]] = await conn.query(
      `SELECT COUNT(*) AS cnt, COALESCE(SUM(-amount), 0) AS total
       FROM economy_transactions
       WHERE user_id = ? AND type = 'send' AND amount < 0 AND DATE(created_at) = CURDATE()`,
      [s.id]
    );
    if (Number(used.cnt) >= DAILY_COUNT) {
      throw new SendLimit(`You've hit the daily limit of ${DAILY_COUNT} sends. Try again tomorrow.`);
    }
    if (Number(used.total) + amount > DAILY_TOTAL) {
      const left = DAILY_TOTAL - Number(used.total);
      throw new SendLimit(`Daily send limit is ${DAILY_TOTAL.toLocaleString()} OwiCoins. You can still send ${left.toLocaleString()} today.`);
    }

    const ref = `send:${s.id}-${r.id}:${Date.now()}`;
    const out = await mutate(s.id, { type: "send", amount: -amount, reference: `${ref}:out` }, conn);
    await mutate(r.id, { type: "send", amount, reference: `${ref}:in` }, conn);
    await conn.commit();
    return { balance: out.balance, sendsLeft: DAILY_COUNT - Number(used.cnt) - 1, totalLeft: DAILY_TOTAL - Number(used.total) - amount };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
