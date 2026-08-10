import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { lockedQty } from "../repositories/inventory.js";
import { randomByRarity, addToInventory } from "../repositories/collectibles.js";
import { nextTier } from "../lib/rules.js";

export const FUSE_COST = 3;

export class FusionError extends Error {}

export async function fuse(discordId, username, itemName) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const user = await getOrCreate(discordId, username, conn);

    const [[item]] = await conn.query("SELECT id, name, rarity FROM collectibles WHERE name = ?", [itemName]);
    if (!item) throw new FusionError(`No collectible named "${itemName}".`);

    const target = nextTier(item.rarity);
    if (!target) throw new FusionError(`${item.rarity} is already the highest tier — can't fuse.`);

    const [[owned]] = await conn.query(
      "SELECT quantity FROM inventories WHERE user_id = ? AND collectible_id = ? FOR UPDATE",
      [user.id, item.id]
    );
    const locked = await lockedQty(user.id, item.id, conn);
    const available = (owned ? owned.quantity : 0) - locked;
    if (available < FUSE_COST) {
      throw new FusionError(`Need ${FUSE_COST}× ${item.name} to fuse (you have ${available} available).`);
    }

    await conn.query(
      "UPDATE inventories SET quantity = quantity - ?, updated_at = NOW() WHERE user_id = ? AND collectible_id = ?",
      [FUSE_COST, user.id, item.id]
    );
    await conn.query("DELETE FROM inventories WHERE user_id = ? AND collectible_id = ? AND quantity = 0", [user.id, item.id]);

    const reward = await randomByRarity(target, conn);
    if (!reward) throw new FusionError(`No ${target} collectible exists to fuse into.`);
    await addToInventory(user.id, reward.id, 1, conn);

    await conn.commit();
    return { consumed: item, cost: FUSE_COST, reward, targetRarity: target };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
