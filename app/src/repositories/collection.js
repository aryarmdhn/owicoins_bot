import pool from "../db/pool.js";

export async function catalog(userId, { page = 1, rarity = null, category = null } = {}) {
  const where = [];
  const params = [userId];
  if (rarity) (where.push("c.rarity = ?"), params.push(rarity));
  if (category) (where.push("c.category = ?"), params.push(category));
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM collectibles c ${clause}`, params.slice(1));
  const [[{ owned }]] = await pool.query(
    `SELECT COUNT(DISTINCT i.collectible_id) AS owned
     FROM collectibles c JOIN inventories i ON i.collectible_id = c.id AND i.user_id = ? ${clause}`,
    params
  );
  const pages = Math.max(1, total);
  page = Math.min(Math.max(1, page), pages);

  const [rows] = await pool.query(
    `SELECT c.name, c.description, c.rarity, c.category, c.base_value, c.power, c.image_url, (i.id IS NOT NULL) AS owned
     FROM collectibles c
     LEFT JOIN inventories i ON i.collectible_id = c.id AND i.user_id = ?
     ${clause} ORDER BY c.base_value DESC, c.name ASC LIMIT 1 OFFSET ?`,
    [...params, page - 1]
  );
  return { item: rows[0] || null, page, pages, total, owned };
}
