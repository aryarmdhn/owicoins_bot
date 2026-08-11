import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { lockedQty } from "../repositories/inventory.js";
import { mutate } from "./economy.js";
import { getSetting } from "./settings.js";

export class NotEnoughItems extends Error {}
export class NoSuchItem extends Error {}
export class NoSuchTier extends Error {}
export class NothingToSell extends Error {}

import { tiersUpTo } from "../lib/rules.js";
export { tiersUpTo };

const DEFAULT_VALUE = { Common: 100, Uncommon: 250, Rare: 600, Epic: 1500, Legendary: 5000, Mythic: 20000, Immortal: 100000 };

export async function sell(discordId, username, itemName, qty) {
  if (!Number.isInteger(qty) || qty < 1) throw new NotEnoughItems();
  const values = await getSetting("sell.value", DEFAULT_VALUE);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const user = await getOrCreate(discordId, username, conn);

    const [[item]] = await conn.query("SELECT id, name, rarity FROM collectibles WHERE LOWER(name) = LOWER(?)", [itemName]);
    if (!item) throw new NoSuchItem();

    const [[owned]] = await conn.query(
      "SELECT quantity FROM inventories WHERE user_id = ? AND collectible_id = ? FOR UPDATE",
      [user.id, item.id]
    );
    const locked = await lockedQty(user.id, item.id, conn);
    const available = (owned ? owned.quantity : 0) - locked;
    if (available < qty) throw new NotEnoughItems();

    await conn.query("UPDATE inventories SET quantity = quantity - ?, updated_at = NOW() WHERE user_id = ? AND collectible_id = ?", [qty, user.id, item.id]);
    await conn.query("DELETE FROM inventories WHERE user_id = ? AND collectible_id = ? AND quantity = 0", [user.id, item.id]);

    const unit = values[item.rarity] ?? 0;
    const total = unit * qty;
    const result = await mutate(
      user.id,
      { type: "sell", amount: total, reference: `sell:${user.id}:${Date.now()}` },
      conn
    );

    await conn.commit();
    return { item, qty, total, balance: result.balance };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function sellAll(discordId, username, tier = null) {
  let rarities = null;
  if (tier) {
    rarities = tiersUpTo(tier);
    if (!rarities) throw new NoSuchTier();
  }
  const values = await getSetting("sell.value", DEFAULT_VALUE);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const user = await getOrCreate(discordId, username, conn);

    const filter = rarities ? `AND c.rarity IN (${rarities.map(() => "?").join(",")})` : "";
    const [rows] = await conn.query(
      `SELECT i.collectible_id, i.quantity, c.rarity FROM inventories i
       JOIN collectibles c ON c.id = i.collectible_id
       WHERE i.user_id = ? ${filter} FOR UPDATE`,
      [user.id, ...(rarities || [])]
    );

    let total = 0;
    let soldCount = 0;
    for (const r of rows) {
      const locked = await lockedQty(user.id, r.collectible_id, conn);
      const sellable = r.quantity - locked;
      if (sellable <= 0) continue;
      await conn.query(
        "UPDATE inventories SET quantity = quantity - ?, updated_at = NOW() WHERE user_id = ? AND collectible_id = ?",
        [sellable, user.id, r.collectible_id]
      );
      total += (values[r.rarity] ?? 0) * sellable;
      soldCount += sellable;
    }
    await conn.query("DELETE FROM inventories WHERE user_id = ? AND quantity = 0", [user.id]);

    if (soldCount === 0) throw new NothingToSell();

    const result = await mutate(
      user.id,
      { type: "sell", amount: total, reference: `sellall:${user.id}:${Date.now()}` },
      conn
    );

    await conn.commit();
    return { soldCount, total, balance: result.balance };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
