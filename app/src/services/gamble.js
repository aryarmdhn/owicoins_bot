import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { mutate, InsufficientFunds } from "./economy.js";
import { getLuck } from "./luck.js";

export { InsufficientFunds };
export class BetError extends Error {}

const MAX_BET = 1_000_000;
export const XP_PLAY = 5;
export const XP_WIN = 10;

export async function resolveBet(discordId, username, raw) {
  const user = await getOrCreate(discordId, username);
  if (typeof raw === "string" && raw.toLowerCase() === "all") {
    const bet = Math.min(Number(user.coins), MAX_BET);
    if (bet <= 0) throw new BetError("You have no OwiCoins to bet.");
    return bet;
  }
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) throw new BetError("Bet must be a positive number or `all`.");
  return n;
}

export async function play(discordId, username, bet, type, resolver) {
  if (!Number.isInteger(bet) || bet <= 0) throw new BetError("Bet must be a positive number.");
  if (bet > MAX_BET) throw new BetError(`Max bet is ${MAX_BET.toLocaleString()}.`);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const user = await getOrCreate(discordId, username, conn);
    const ref = `${type}:${user.id}:${Date.now()}`;

    await mutate(user.id, { type, amount: -bet, reference: `${ref}:bet`, xp: XP_PLAY }, conn);
    const luck = await getLuck(user.id, conn);
    const outcome = resolver(luck);
    let balance;
    if (outcome.payout > 0) {
      const r = await mutate(user.id, { type: `${type}_win`, amount: outcome.payout, reference: `${ref}:win`, xp: XP_WIN }, conn);
      balance = r.balance;
    } else {
      const [[u]] = await conn.query("SELECT coins FROM users WHERE id = ?", [user.id]);
      balance = Number(u.coins);
    }

    await conn.commit();
    return { ...outcome, bet, balance };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}
