import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { randomByRarity, addToInventory } from "../repositories/collectibles.js";
import { mutate, InsufficientFunds } from "./economy.js";
import { getSetting } from "./settings.js";
import { rollRarity } from "../lib/rules.js";
import { getLuck } from "./luck.js";

export { InsufficientFunds };

export async function pull(discordId, username, count, season = null) {
  if (!Number.isInteger(count) || count < 1 || count > 10) throw new Error("count must be 1-10");

  const single = await getSetting("gacha.cost.single", 1000);
  const cost = count === 10 ? await getSetting("gacha.cost.multi", 9000) : single * count;
  const weights = await getSetting("gacha.rarity_weights", {
    Common: 55, Uncommon: 25, Rare: 12, Epic: 6, Legendary: 1.8, Mythic: 0.2,
  });

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const user = await getOrCreate(discordId, username, conn);

    const luck = await getLuck(user.id, conn);

    const payment = await mutate(
      user.id,
      { type: "gacha", amount: -cost, reference: `gacha:${user.id}:${Date.now()}`, xp: 30 },
      conn
    );

    const [tx] = await conn.query(
      "INSERT INTO gacha_transactions (user_id, pull_count, cost, created_at) VALUES (?, ?, ?, NOW())",
      [user.id, count, cost]
    );

    const results = [];
    for (let i = 0; i < count; i++) {
      const rarity = rollRarity(weights, luck);
      let item = season ? await randomByRarity(rarity, conn, { season }) : null;
      if (!item) item = await randomByRarity(rarity, conn);
      if (!item) throw new Error(`no collectible for rarity ${rarity}`);
      await addToInventory(user.id, item.id, 1, conn);
      await conn.query(
        "INSERT INTO gacha_results (gacha_transaction_id, collectible_id, rarity) VALUES (?, ?, ?)",
        [tx.insertId, item.id, rarity]
      );
      results.push(item);
    }

    await conn.commit();
    return { cost, results, balance: payment.balance, level: payment.level };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
