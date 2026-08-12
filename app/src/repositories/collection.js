import pool from "../db/pool.js";

const PAGE_SIZE = 10;
const ORDER_BY = {
  value: "c.base_value DESC, c.name ASC",
  power: "c.power DESC, c.name ASC",
  rarity: "FIELD(c.rarity,'Immortal','Mythic','Legendary','Epic','Rare','Uncommon','Common'), c.name ASC",
  name: "c.name ASC",
};

export async function catalog(userId, { page = 1, rarity = null, category = null, sort = null, q = null } = {}) {
  const where = [];
  const filterParams = [];
  if (rarity) (where.push("LOWER(c.rarity) = ?"), filterParams.push(rarity.toLowerCase()));
  if (category) (where.push("LOWER(c.category) = ?"), filterParams.push(category.toLowerCase()));
  if (q) (where.push("c.name LIKE ?"), filterParams.push(`%${q}%`));
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const order = ORDER_BY[sort] ?? ORDER_BY.value;

  const [[{ total }]] = await pool.query(`SELECT COUNT(*) AS total FROM collectibles c ${clause}`, filterParams);
  const [[{ owned }]] = await pool.query(
    `SELECT COUNT(DISTINCT i.collectible_id) AS owned
     FROM collectibles c JOIN inventories i ON i.collectible_id = c.id AND i.user_id = ? ${clause}`,
    [userId, ...filterParams]
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  page = Math.min(Math.max(1, page), pages);

  const [rows] = await pool.query(
    `SELECT c.name, c.rarity, c.base_value, c.power, (i.id IS NOT NULL) AS owned
     FROM collectibles c
     LEFT JOIN inventories i ON i.collectible_id = c.id AND i.user_id = ?
     ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`,
    [userId, ...filterParams, PAGE_SIZE, (page - 1) * PAGE_SIZE]
  );
  return { rows, page, pages, total, owned };
}
