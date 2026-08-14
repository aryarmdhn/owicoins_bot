import pool from "../db/pool.js";

export async function getLuck(userId, conn = pool) {
  const [[row]] = await conn.query(
    "SELECT multiplier, rigged, expires_at FROM user_luck WHERE user_id = ?",
    [userId]
  );
  if (!row) return { multiplier: 1, rigged: false };
  const active = row.expires_at === null || new Date(row.expires_at) > new Date();
  return { multiplier: active ? Number(row.multiplier) : 1, rigged: !!row.rigged };
}
