import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { mutate } from "./economy.js";

export const QUESTS = [
  { id: "pull3", name: "Gacha Fan", desc: "Do 3 gacha pulls", goal: 3, reward: 1000,
    sql: "SELECT COUNT(*) n FROM gacha_transactions WHERE user_id=? AND DATE(created_at)=CURDATE()" },
  { id: "work2", name: "Hard Worker", desc: "Work 2 times", goal: 2, reward: 800,
    sql: "SELECT COUNT(*) n FROM economy_transactions WHERE user_id=? AND type='work' AND DATE(created_at)=CURDATE()" },
  { id: "winfight", name: "Duelist", desc: "Win a fight", goal: 1, reward: 1500,
    sql: "SELECT COUNT(*) n FROM economy_transactions WHERE user_id=? AND type='fight' AND amount>0 AND DATE(created_at)=CURDATE()" },
  { id: "sell5", name: "Merchant", desc: "Sell 5 times", goal: 5, reward: 700,
    sql: "SELECT COUNT(*) n FROM economy_transactions WHERE user_id=? AND type='sell' AND DATE(created_at)=CURDATE()" },
];

export async function view(discordId, username) {
  const user = await getOrCreate(discordId, username);
  const [claimed] = await pool.query(
    "SELECT quest_id FROM quest_claims WHERE user_id=? AND quest_date=CURDATE()",
    [user.id]
  );
  const done = new Set(claimed.map((r) => r.quest_id));

  const list = [];
  for (const q of QUESTS) {
    const [[r]] = await pool.query(q.sql, [user.id]);
    const prog = Number(r.n);
    list.push({ ...q, prog: Math.min(prog, q.goal), complete: prog >= q.goal, claimed: done.has(q.id) });
  }
  const allComplete = list.every((q) => q.complete);
  const allClaimed = list.every((q) => q.claimed);
  return { list, allComplete, allClaimed };
}

const today = () => new Date().toISOString().slice(0, 10);

export async function claimAll(discordId, username) {
  const { list, allComplete } = await view(discordId, username);
  if (!allComplete) return { claimed: [], total: 0 };

  const user = await getOrCreate(discordId, username);
  const claimed = [];
  for (const q of list) {
    if (q.claimed) continue;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(
        "INSERT INTO quest_claims (user_id, quest_date, quest_id, claimed_at) VALUES (?, CURDATE(), ?, NOW())",
        [user.id, q.id]
      );
      await mutate(user.id, { type: "quest", amount: q.reward, reference: `quest:${user.id}:${q.id}:${today()}` }, conn);
      await conn.commit();
      claimed.push(q);
    } catch (e) {
      await conn.rollback();
      if (e.code !== "ER_DUP_ENTRY") throw e;
    } finally {
      conn.release();
    }
  }
  return { claimed, total: claimed.reduce((s, q) => s + q.reward, 0) };
}
