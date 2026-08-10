import pool from "../db/pool.js";

const PAGE_SIZE = 10;

export async function list(userId, { page = 1, rarity = null, category = null } = {}) {
  const where = ["i.user_id = ?"];
  const params = [userId];
  if (rarity) (where.push("c.rarity = ?"), params.push(rarity));
  if (category) (where.push("c.category = ?"), params.push(category));
  const clause = where.join(" AND ");

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM inventories i JOIN collectibles c ON c.id = i.collectible_id WHERE ${clause}`,
    params
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  page = Math.min(Math.max(1, page), pages);

  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.rarity, c.base_value, c.power, c.image_url, i.quantity
     FROM inventories i JOIN collectibles c ON c.id = i.collectible_id
     WHERE ${clause} ORDER BY c.base_value DESC, c.name ASC LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE]
  );
  return { rows, page, pages, total };
}

export async function lockedQty(userId, collectibleId, conn = pool) {
  const [[{ qty }]] = await conn.query(
    `SELECT COALESCE(SUM(ti.quantity), 0) AS qty
     FROM trade_items ti JOIN trades t ON t.id = ti.trade_id
     WHERE ti.user_id = ? AND ti.collectible_id = ? AND t.status IN ('pending','confirmed')`,
    [userId, collectibleId]
  );
  return Number(qty);
}
