import pool from "../db/pool.js";

export async function randomByRarity(rarity, conn = pool, { season = null } = {}) {
  const [rows] = season
    ? await conn.query(
        "SELECT * FROM collectibles WHERE rarity = ? AND is_limited = 1 AND season = ? ORDER BY RAND() LIMIT 1",
        [rarity, season]
      )
    : await conn.query(
        "SELECT * FROM collectibles WHERE rarity = ? AND is_limited = 0 ORDER BY RAND() LIMIT 1",
        [rarity]
      );
  return rows[0] || null;
}

export async function addToInventory(userId, collectibleId, qty, conn) {
  await conn.query(
    "INSERT INTO inventories (user_id, collectible_id, quantity, created_at, updated_at) " +
      "VALUES (?, ?, ?, NOW(), NOW()) " +
      "ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity), updated_at = NOW()",
    [userId, collectibleId, qty]
  );
}
