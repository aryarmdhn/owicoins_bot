import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { lockedQty } from "../repositories/inventory.js";
import { mutate, InsufficientFunds } from "./economy.js";
import { fightWinnerIsA } from "../lib/rules.js";

export { InsufficientFunds };
export class FightError extends Error {}

export async function assertCanBet(discordUser, bet) {
  if (!Number.isInteger(bet) || bet <= 0) throw new FightError("Bet must be a positive number.");
  const u = await getOrCreate(discordUser.id, discordUser.username);
  if (u.coins < bet) throw new FightError(`<@${discordUser.id}> doesn't have ${bet} coins.`);
  return u;
}

export async function ownedCollectibles(discordId) {
  const [[u]] = await pool.query("SELECT id FROM users WHERE discord_id = ?", [discordId]);
  if (!u) return [];
  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.rarity, c.power, i.quantity
     FROM inventories i JOIN collectibles c ON c.id = i.collectible_id
     WHERE i.user_id = ? ORDER BY c.power DESC LIMIT 25`,
    [u.id]
  );
  const out = [];
  for (const r of rows) {
    const locked = await lockedQty(u.id, r.id, pool);
    if (r.quantity - locked > 0) out.push(r);
  }
  return out;
}

export async function powerOf(collectibleId) {
  const [[c]] = await pool.query("SELECT name, power FROM collectibles WHERE id = ?", [collectibleId]);
  return c ? { name: c.name, power: Number(c.power) } : null;
}

export async function resolve(challenger, opponent, bet, powerA, powerB) {
  const aWins = fightWinnerIsA(powerA, powerB);
  const winner = aWins ? challenger : opponent;
  const loser = aWins ? opponent : challenger;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const w = await getOrCreate(winner.id, winner.username, conn);
    const l = await getOrCreate(loser.id, loser.username, conn);
    const ref = `fight:${Date.now()}:${winner.id}-${loser.id}`;
    await mutate(l.id, { type: "fight", amount: -bet, reference: `${ref}:lose` }, conn);
    await mutate(w.id, { type: "fight", amount: bet, reference: `${ref}:win`, xp: 15 }, conn);
    await conn.query(
      "UPDATE users SET fight_wins = fight_wins + 1, fight_streak = GREATEST(fight_streak, 0) + 1 WHERE id = ?",
      [w.id]
    );
    await conn.query(
      "UPDATE users SET fight_losses = fight_losses + 1, fight_streak = LEAST(fight_streak, 0) - 1 WHERE id = ?",
      [l.id]
    );
    await conn.commit();
    return { winner, loser, aWins };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
