import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { mutate } from "./economy.js";
import { OnCooldown } from "./daily.js";

const COOLDOWN_H = 6;

// weighted blessings. luck = temporary user_luck multiplier for `hours`. coins = flat reward.
const BLESSINGS = [
  { weight: 55, kind: "none", text: "the spirits stay silent… no blessing this time 🙏" },
  { weight: 20, kind: "luck", mult: 1.5, hours: 2, text: "a warm glow surrounds you! 🍀 **Luck ×1.5** for 2h" },
  { weight: 12, kind: "coins", min: 500, max: 2000, text: "you found an offering! 💰" },
  { weight: 8, kind: "luck", mult: 2.0, hours: 1, text: "fortune smiles upon you! ✨ **Luck ×2.0** for 1h" },
  { weight: 4, kind: "luck", mult: 2.5, hours: 0.5, text: "the gods bless you! 🌟 **Luck ×2.5** for 30m" },
  { weight: 1, kind: "luck", mult: 3.0, hours: 1, text: "🎉 **DIVINE BLESSING!** ⚡ **Luck ×3.0** for 1h" },
];

function draw(rand = Math.random) {
  const total = BLESSINGS.reduce((s, b) => s + b.weight, 0);
  let r = rand() * total;
  for (const b of BLESSINGS) if ((r -= b.weight) < 0) return b;
  return BLESSINGS[0];
}

export async function pray(discordId, username) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const user = await getOrCreate(discordId, username, conn);
    const [[locked]] = await conn.query(
      `SELECT TIMESTAMPDIFF(SECOND, last_pray_at, NOW()) AS elapsed,
              last_pray_at + INTERVAL ? HOUR AS next_at
       FROM users WHERE id = ? FOR UPDATE`,
      [COOLDOWN_H, user.id]
    );
    if (locked.elapsed !== null && locked.elapsed >= 0 && locked.elapsed < COOLDOWN_H * 3600) {
      throw new OnCooldown(new Date(locked.next_at));
    }
    await conn.query("UPDATE users SET last_pray_at = NOW() WHERE id = ?", [user.id]);

    const b = draw();
    let coins = 0;
    if (b.kind === "coins") {
      coins = b.min + Math.floor(Math.random() * (b.max - b.min + 1));
      await mutate(user.id, { type: "pray", amount: coins, reference: `pray:${user.id}:${Date.now()}` }, conn);
    } else if (b.kind === "luck") {
      await conn.query(
        "INSERT INTO user_luck (user_id, multiplier, expires_at, updated_at) VALUES (?, ?, NOW() + INTERVAL ? MINUTE, NOW()) " +
          "ON DUPLICATE KEY UPDATE multiplier = VALUES(multiplier), expires_at = VALUES(expires_at), updated_at = NOW()",
        [user.id, b.mult, Math.round(b.hours * 60)]
      );
    }

    await conn.commit();
    return { blessing: b, coins };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
