import pool from "../db/pool.js";

export async function getOrCreate(discordId, username, conn = pool) {
  await conn.query(
    "INSERT INTO users (discord_id, username, created_at, updated_at) VALUES (?, ?, NOW(), NOW()) " +
      "ON DUPLICATE KEY UPDATE username = VALUES(username), updated_at = NOW()",
    [discordId, username]
  );
  return findByDiscordId(discordId, conn);
}

export async function findByDiscordId(discordId, conn = pool) {
  const [rows] = await conn.query("SELECT * FROM users WHERE discord_id = ?", [discordId]);
  return rows[0] || null;
}
