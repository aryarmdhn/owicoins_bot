import pool from "../db/pool.js";
import { applyXp } from "../lib/rules.js";

export { applyXp };

export class InsufficientFunds extends Error {
  constructor(balance, needed) {
    super("insufficient funds");
    this.balance = balance;
    this.needed = needed;
  }
}
export class DuplicateTransaction extends Error {}

export async function mutate(userId, { type, amount, reference, xp = 0 }, conn = pool) {
  const own = conn === pool;
  const c = own ? await pool.getConnection() : conn;
  try {
    if (own) await c.beginTransaction();

    const [[user]] = await c.query("SELECT coins, xp, level FROM users WHERE id = ? FOR UPDATE", [userId]);
    const balanceAfter = BigInt(user.coins) + BigInt(amount);
    if (balanceAfter < 0n) throw new InsufficientFunds(Number(user.coins), -amount);

    const leveled = applyXp(user.level, Number(user.xp), xp);
    await c.query("UPDATE users SET coins = ?, xp = ?, level = ?, updated_at = NOW() WHERE id = ?", [
      balanceAfter.toString(),
      leveled.xp,
      leveled.level,
      userId,
    ]);

    try {
      await c.query(
        "INSERT INTO economy_transactions (user_id, type, amount, balance_after, reference_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
        [userId, type, amount, balanceAfter.toString(), reference]
      );
    } catch (e) {
      if (e.code === "ER_DUP_ENTRY") throw new DuplicateTransaction(reference);
      throw e;
    }

    if (own) await c.commit();
    return { balance: Number(balanceAfter), level: leveled.level, xp: leveled.xp };
  } catch (e) {
    if (own) await c.rollback();
    throw e;
  } finally {
    if (own) c.release();
  }
}
