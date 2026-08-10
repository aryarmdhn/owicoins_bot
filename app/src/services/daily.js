import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { mutate } from "./economy.js";
import { getSetting } from "./settings.js";
import { streakBonusPct, nextStreak } from "../lib/rules.js";

export { streakBonusPct, nextStreak };

export class OnCooldown extends Error {
  constructor(nextAt) {
    super("on cooldown");
    this.nextAt = nextAt;
  }
}

export async function claim(discordId, username) {
  const cooldownHours = await getSetting("cooldown.daily_hours", 24);
  const base = await getSetting("daily.base", 1000);
  const max = await getSetting("daily.max", 5000);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const user = await getOrCreate(discordId, username, conn);
    const [[locked]] = await conn.query(
      `SELECT daily_streak,
              TIMESTAMPDIFF(SECOND, last_daily_at, NOW()) / 3600 AS elapsed_hours,
              last_daily_at + INTERVAL ? HOUR AS next_at,
              CURDATE() AS today
       FROM users WHERE id = ? FOR UPDATE`,
      [cooldownHours, user.id]
    );

    const step = nextStreak(locked.elapsed_hours, cooldownHours);
    if (step === null) {
      throw new OnCooldown(new Date(locked.next_at));
    }

    const streak = step === "continue" ? locked.daily_streak + 1 : 1;
    const bonusPct = streakBonusPct(streak);
    const reward = Math.min(Math.floor(base * (1 + bonusPct / 100)), max);

    await conn.query("UPDATE users SET last_daily_at = NOW(), daily_streak = ? WHERE id = ?", [streak, user.id]);
    const ref = `daily:${user.id}:${String(locked.today).slice(0, 10)}`;
    const result = await mutate(user.id, { type: "daily", amount: reward, reference: ref, xp: 50 }, conn);

    await conn.commit();
    return { reward, streak, bonusPct, ...result };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
