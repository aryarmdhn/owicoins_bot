import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { mutate, InsufficientFunds } from "./economy.js";

export { InsufficientFunds };
export class SendError extends Error {}

export async function send(sender, receiver, amount) {
  if (!Number.isInteger(amount) || amount <= 0) throw new SendError("Amount must be a positive number.");
  if (sender.id === receiver.id) throw new SendError("You can't send coins to yourself.");
  if (receiver.bot) throw new SendError("You can't send coins to a bot.");

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const s = await getOrCreate(sender.id, sender.username, conn);
    const r = await getOrCreate(receiver.id, receiver.username, conn);
    const ref = `send:${s.id}-${r.id}:${Date.now()}`;
    const out = await mutate(s.id, { type: "send", amount: -amount, reference: `${ref}:out` }, conn);
    await mutate(r.id, { type: "send", amount, reference: `${ref}:in` }, conn);
    await conn.commit();
    return { balance: out.balance };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
