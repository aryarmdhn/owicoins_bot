import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { mutate } from "./economy.js";

export class PrayLimit extends Error {
  constructor(nextAt) {
    super("daily pray limit reached");
    this.nextAt = nextAt;
  }
}

const DAILY_LIMIT = 3;

const BLESSINGS = [
  { weight: 55, kind: "none", text: "the spirits stay silent… no blessing this time 🙏" },
  { weight: 20, kind: "luck", mult: 1.5, mins: 120, text: "a warm glow surrounds you! 🍀 **Luck ×1.5**" },
  { weight: 12, kind: "coins", min: 500, max: 2000, text: "you found an offering! <:owicoin:1537023515927117874>" },
  { weight: 8, kind: "luck", mult: 2.0, mins: 60, text: "fortune smiles upon you! ✨ **Luck ×2.0**" },
  { weight: 4, kind: "luck", mult: 2.5, mins: 30, text: "the gods bless you! 🌟 **Luck ×2.5**" },
  { weight: 1, kind: "luck", mult: 3.0, mins: 60, text: "🎉 **DIVINE BLESSING!** ⚡ **Luck ×3.0**" },
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

    const [[q]] = await conn.query(
      "SELECT pray_count, pray_date, pray_date = CURDATE() AS today FROM users WHERE id = ? FOR UPDATE",
      [user.id]
    );
    const usedToday = q.today ? q.pray_count : 0;
    if (usedToday >= DAILY_LIMIT) {
      // next reset = tomorrow 00:00 (DB timezone = WIB)
      const [[{ next_at }]] = await conn.query("SELECT CURDATE() + INTERVAL 1 DAY AS next_at");
      throw new PrayLimit(new Date(next_at));
    }
    await conn.query("UPDATE users SET pray_count = ?, pray_date = CURDATE() WHERE id = ?", [usedToday + 1, user.id]);

    const b = draw();
    let coins = 0;
    let extended = false;
    if (b.kind === "coins") {
      coins = b.min + Math.floor(Math.random() * (b.max - b.min + 1));
      await mutate(user.id, { type: "pray", amount: coins, reference: `pray:${user.id}:${Date.now()}` }, conn);
    } else if (b.kind === "luck") {
      const [[cur]] = await conn.query(
        "SELECT multiplier, expires_at FROM user_luck WHERE user_id = ? AND (expires_at IS NULL OR expires_at > NOW())",
        [user.id]
      );
      if (cur && Number(cur.multiplier) >= b.mult && cur.expires_at !== null) {
        // same or lower blessing while a stronger/equal boost is active -> just extend duration
        await conn.query(
          "UPDATE user_luck SET expires_at = expires_at + INTERVAL ? MINUTE, updated_at = NOW() WHERE user_id = ?",
          [b.mins, user.id]
        );
        extended = true;
      } else {
        // no boost, or new one is stronger -> apply new multiplier from now
        await conn.query(
          "INSERT INTO user_luck (user_id, multiplier, expires_at, updated_at) VALUES (?, ?, NOW() + INTERVAL ? MINUTE, NOW()) " +
            "ON DUPLICATE KEY UPDATE multiplier = VALUES(multiplier), expires_at = VALUES(expires_at), updated_at = NOW()",
          [user.id, b.mult, b.mins]
        );
      }
    }

    await conn.commit();
    return { blessing: b, coins, extended, left: DAILY_LIMIT - (usedToday + 1) };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
