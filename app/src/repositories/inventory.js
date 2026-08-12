import pool from "../db/pool.js";

const PAGE_SIZE = 10;

const ORDER_BY = {
  value: "c.base_value DESC, c.name ASC",
  power: "c.power DESC, c.name ASC",
  rarity: "FIELD(c.rarity,'Immortal','Mythic','Legendary','Epic','Rare','Uncommon','Common'), c.name ASC",
  name: "c.name ASC",
};

export async function list(userId, { page = 1, rarity = null, category = null, sort = null, q = null } = {}) {
  const where = ["i.user_id = ?"];
  const params = [userId];
  if (rarity) (where.push("LOWER(c.rarity) = ?"), params.push(rarity.toLowerCase()));
  if (category) (where.push("LOWER(c.category) = ?"), params.push(category.toLowerCase()));
  if (q) (where.push("c.name LIKE ?"), params.push(`%${q}%`));
  const clause = where.join(" AND ");
  const order = ORDER_BY[sort] ?? ORDER_BY.value;

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM inventories i JOIN collectibles c ON c.id = i.collectible_id WHERE ${clause}`,
    params
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  page = Math.min(Math.max(1, page), pages);

  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.rarity, c.base_value, c.power, c.image_url, i.quantity
     FROM inventories i JOIN collectibles c ON c.id = i.collectible_id
     WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`,
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
