import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { mutate } from "./economy.js";
import { petHp } from "../lib/rules.js";

export class BossError extends Error {}
export class OnCooldown extends Error {
  constructor(nextAt) { super("cooldown"); this.nextAt = nextAt; }
}

const ATTACK_COOLDOWN_S = 10;
const MISS_CHANCE = 0.25;

export async function activeBoss() {
  const [[b]] = await pool.query("SELECT * FROM bosses WHERE status = 'active' ORDER BY id DESC LIMIT 1");
  return b || null;
}

export async function attack(discordId, username) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const user = await getOrCreate(discordId, username, conn);

    const [[boss]] = await conn.query("SELECT * FROM bosses WHERE status = 'active' ORDER BY id DESC LIMIT 1 FOR UPDATE");
    if (!boss) throw new BossError("No boss is active right now.");

    const [[dmgRow]] = await conn.query(
      `SELECT last_hit_at,
              TIMESTAMPDIFF(SECOND, last_hit_at, NOW()) AS elapsed,
              last_hit_at + INTERVAL ? SECOND AS next_at
       FROM boss_damage WHERE boss_id = ? AND user_id = ?`,
      [ATTACK_COOLDOWN_S, boss.id, user.id]
    );
    if (dmgRow?.last_hit_at && dmgRow.elapsed >= 0 && dmgRow.elapsed < ATTACK_COOLDOWN_S) {
      throw new OnCooldown(new Date(dmgRow.next_at));
    }

    const [[best]] = await conn.query(
      `SELECT c.id, c.name, c.power, c.rarity, i.quantity, i.current_hp FROM inventories i JOIN collectibles c ON c.id = i.collectible_id
       WHERE i.user_id = ? ORDER BY c.power DESC LIMIT 1 FOR UPDATE`,
      [user.id]
    );
    if (!best) throw new BossError("You need at least one collectible to fight the boss!");

    const maxHp = petHp(best.rarity);
    let curHp = best.current_hp === null ? maxHp : best.current_hp;

    const miss = Math.random() < MISS_CHANCE;
    const dmg = miss ? 0 : Math.max(1, Math.floor(best.power * (0.8 + Math.random() * 0.4)));
    const newHp = Number(boss.hp) - dmg;

    if (dmg > 0) {
      await conn.query(
        "INSERT INTO boss_damage (boss_id, user_id, damage, last_hit_at) VALUES (?, ?, ?, NOW()) " +
          "ON DUPLICATE KEY UPDATE damage = damage + VALUES(damage), last_hit_at = NOW()",
        [boss.id, user.id, dmg]
      );
      await conn.query("UPDATE bosses SET hp = ? WHERE id = ?", [Math.max(0, newHp), boss.id]);
    } else {
      // still register participation + set cooldown even on a miss
      await conn.query(
        "INSERT INTO boss_damage (boss_id, user_id, damage, last_hit_at) VALUES (?, ?, 0, NOW()) " +
          "ON DUPLICATE KEY UPDATE last_hit_at = NOW()",
        [boss.id, user.id]
      );
    }

    // miss = pet takes 1 damage; reaches 0 -> pet gugur (qty -1, hp resets for the next one)
    let petDied = false;
    let petHpLeft = curHp;
    if (miss) {
      curHp -= 1;
      if (curHp <= 0) {
        petDied = true;
        await conn.query("UPDATE inventories SET quantity = quantity - 1, current_hp = ?, updated_at = NOW() WHERE user_id = ? AND collectible_id = ?", [maxHp, user.id, best.id]);
        await conn.query("DELETE FROM inventories WHERE user_id = ? AND collectible_id = ? AND quantity <= 0", [user.id, best.id]);
        petHpLeft = 0;
      } else {
        await conn.query("UPDATE inventories SET current_hp = ? WHERE user_id = ? AND collectible_id = ?", [curHp, user.id, best.id]);
        petHpLeft = curHp;
      }
    }

    let defeated = false;
    let rewards = [];
    let totalDmg = 0;
    if (newHp <= 0) {
      defeated = true;
      await conn.query("UPDATE bosses SET status = 'defeated', hp = 0 WHERE id = ?", [boss.id]);
      const dist = await distributeRewards(boss, conn);
      rewards = dist.list;
      totalDmg = dist.totalDmg;
    }

    await conn.commit();
    return { boss: { ...boss, name: boss.name, rewardPool: Number(boss.reward_pool) }, weapon: best.name, dmg, miss, petDied, petHpLeft, petMaxHp: maxHp, hpLeft: Math.max(0, newHp), maxHp: Number(boss.max_hp), defeated, rewards, totalDmg };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function distributeRewards(boss, conn) {
  const [rows] = await conn.query(
    `SELECT bd.user_id, bd.damage, u.discord_id, u.username
     FROM boss_damage bd JOIN users u ON u.id = bd.user_id
     WHERE bd.boss_id = ? ORDER BY bd.damage DESC`,
    [boss.id]
  );
  const totalDmg = rows.reduce((s, r) => s + Number(r.damage), 0);
  if (totalDmg <= 0) return [];
  const out = [];
  for (const r of rows) {
    const damage = Number(r.damage);
    const share = Math.floor((damage / totalDmg) * Number(boss.reward_pool));
    if (share > 0) await mutate(r.user_id, { type: "boss", amount: share, reference: `boss:${boss.id}:${r.user_id}` }, conn);
    out.push({ userId: r.user_id, discordId: r.discord_id, username: r.username, share, damage });
  }
  return { list: out, totalDmg };
}
