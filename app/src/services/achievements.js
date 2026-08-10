import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { mutate } from "./economy.js";

export const ACHIEVEMENTS = [
  { id: "first_pull", name: "First Pull", desc: "Do your first gacha pull", reward: 500,
    progress: async (uid) => count(uid, "SELECT COUNT(*) n FROM gacha_transactions WHERE user_id=?"), goal: 1 },
  { id: "collector_10", name: "Collector", desc: "Own 10 different collectibles", reward: 1000,
    progress: async (uid) => count(uid, "SELECT COUNT(*) n FROM inventories WHERE user_id=?"), goal: 10 },
  { id: "collector_50", name: "Hoarder", desc: "Own 50 different collectibles", reward: 5000,
    progress: async (uid) => count(uid, "SELECT COUNT(*) n FROM inventories WHERE user_id=?"), goal: 50 },
  { id: "got_mythic", name: "Mythic Owner", desc: "Own a Mythic or higher", reward: 10000,
    progress: async (uid) => count(uid, "SELECT COUNT(*) n FROM inventories i JOIN collectibles c ON c.id=i.collectible_id WHERE i.user_id=? AND c.rarity IN ('Mythic','Immortal')"), goal: 1 },
  { id: "fighter_10", name: "Brawler", desc: "Win 10 fights", reward: 3000,
    progress: async (uid, u) => u.fight_wins ?? 0, goal: 10 },
  { id: "fighter_50", name: "Champion", desc: "Win 50 fights", reward: 15000,
    progress: async (uid, u) => u.fight_wins ?? 0, goal: 50 },
  { id: "rich_100k", name: "Wealthy", desc: "Hold 100,000 OwiCoins", reward: 5000,
    progress: async (uid, u) => Number(u.coins), goal: 100000 },
  { id: "streak_7", name: "Dedicated", desc: "Reach a 7-day daily streak", reward: 2000,
    progress: async (uid, u) => u.daily_streak ?? 0, goal: 7 },
];

async function count(uid, sql) {
  const [[r]] = await pool.query(sql, [uid]);
  return Number(r.n);
}

export async function view(discordId, username) {
  const user = await getOrCreate(discordId, username);
  const [claimed] = await pool.query("SELECT achievement_id FROM user_achievements WHERE user_id=?", [user.id]);
  const done = new Set(claimed.map((r) => r.achievement_id));

  const list = [];
  for (const a of ACHIEVEMENTS) {
    const prog = await a.progress(user.id, user);
    const complete = prog >= a.goal;
    list.push({ ...a, prog: Math.min(prog, a.goal), complete, claimed: done.has(a.id) });
  }
  const claimable = list.some((a) => a.complete && !a.claimed);
  return { list, claimable };
}

export async function claimReady(discordId, username) {
  const { list } = await view(discordId, username);
  const user = await getOrCreate(discordId, username);
  const claimed = [];
  for (const a of list) {
    if (!a.complete || a.claimed) continue;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("INSERT INTO user_achievements (user_id, achievement_id, claimed_at) VALUES (?, ?, NOW())", [user.id, a.id]);
      await mutate(user.id, { type: "achievement", amount: a.reward, reference: `ach:${user.id}:${a.id}` }, conn);
      await conn.commit();
      claimed.push(a);
    } catch (e) {
      await conn.rollback();
      if (e.code !== "ER_DUP_ENTRY") throw e;
    } finally {
      conn.release();
    }
  }
  return { claimed, total: claimed.reduce((s, a) => s + a.reward, 0) };
}
