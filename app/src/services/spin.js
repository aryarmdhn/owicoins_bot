import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { mutate } from "./economy.js";
import { OnCooldown } from "./daily.js";

const PRIZES = [
  { label: "500 OwiCoins", weight: 30, coins: 500 },
  { label: "1,000 OwiCoins", weight: 25, coins: 1000 },
  { label: "2,500 OwiCoins", weight: 15, coins: 2500 },
  { label: "5,000 OwiCoins", weight: 8, coins: 5000 },
  { label: "10,000 OwiCoins", weight: 3, coins: 10000 },
  { label: "a random collectible", weight: 15, item: true },
  { label: "nothing… better luck tomorrow", weight: 4, coins: 0 },
];

function drawPrize(rand = Math.random) {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = rand() * total;
  for (const p of PRIZES) if ((r -= p.weight) < 0) return p;
  return PRIZES[0];
}

export async function spin(discordId, username) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const user = await getOrCreate(discordId, username, conn);
    const [[locked]] = await conn.query(
      `SELECT TIMESTAMPDIFF(SECOND, last_spin_at, NOW()) AS elapsed,
              last_spin_at + INTERVAL 24 HOUR AS next_at
       FROM users WHERE id = ? FOR UPDATE`,
      [user.id]
    );
    if (locked.elapsed !== null && locked.elapsed >= 0 && locked.elapsed < 24 * 3600) {
      throw new OnCooldown(new Date(locked.next_at));
    }
    await conn.query("UPDATE users SET last_spin_at = NOW() WHERE id = ?", [user.id]);

    const now = Date.now();
    const prize = drawPrize();
    let item = null;
    if (prize.item) {
      const [[c]] = await conn.query("SELECT id, name, rarity FROM collectibles ORDER BY RAND() LIMIT 1");
      if (c) {
        await conn.query(
          "INSERT INTO inventories (user_id, collectible_id, quantity, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW()) " +
            "ON DUPLICATE KEY UPDATE quantity = quantity + 1, updated_at = NOW()",
          [user.id, c.id]
        );
        item = c;
      }
    } else if (prize.coins > 0) {
      await mutate(user.id, { type: "spin", amount: prize.coins, reference: `spin:${user.id}:${now}` }, conn);
    }

    await conn.commit();
    return { prize, item };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
