import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { mutate } from "./economy.js";
import { getSetting } from "./settings.js";
import { OnCooldown } from "./daily.js";

const JOBS = ["Developer", "Designer", "Barista", "Gamer", "Driver", "Streamer", "Chef", "Detective"];

export async function work(discordId, username) {
  const cooldownHours = await getSetting("cooldown.work_hours", 1);
  const min = await getSetting("work.min", 300);
  const max = await getSetting("work.max", 1000);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const user = await getOrCreate(discordId, username, conn);
    const [[locked]] = await conn.query(
      `SELECT TIMESTAMPDIFF(SECOND, last_work_at, NOW()) AS elapsed,
              last_work_at + INTERVAL ? HOUR AS next_at
       FROM users WHERE id = ? FOR UPDATE`,
      [cooldownHours, user.id]
    );
    if (locked.elapsed !== null && locked.elapsed >= 0 && locked.elapsed < cooldownHours * 3600) {
      throw new OnCooldown(new Date(locked.next_at));
    }

    const reward = min + Math.floor(Math.random() * (max - min + 1));
    const job = JOBS[Math.floor(Math.random() * JOBS.length)];
    await conn.query("UPDATE users SET last_work_at = NOW() WHERE id = ?", [user.id]);
    const result = await mutate(
      user.id,
      { type: "work", amount: reward, reference: `work:${user.id}:${Date.now()}`, xp: 20 },
      conn
    );

    await conn.commit();
    return { job, reward, ...result };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
