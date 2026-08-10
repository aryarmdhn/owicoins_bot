import pool from "../db/pool.js";

export async function getLuck(userId, conn = pool) {
  const [[row]] = await conn.query(
    "SELECT multiplier FROM user_luck WHERE user_id = ? AND (expires_at IS NULL OR expires_at > NOW())",
    [userId]
  );
  return row ? Number(row.multiplier) : 1;
}
