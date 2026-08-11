import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { mutate, InsufficientFunds } from "./economy.js";
import { mineMultiplier } from "../lib/rules.js";

export { InsufficientFunds };
export class MineError extends Error {}

export const games = new Map(); // key: discordId
export const TOTAL = 20;
export const MINES = 4;
export const COLS = 5;
const MAX_BET = 1_000_000;

export async function start(discordId, username, bet) {
  if (!Number.isInteger(bet) || bet <= 0) throw new MineError("Bet must be a positive number or `all`.");
  if (bet > MAX_BET) throw new MineError(`Max bet is ${MAX_BET.toLocaleString()}.`);
  if (games.has(discordId)) throw new MineError("You already have a mines game running! finish it first.");

  const user = await getOrCreate(discordId, username);
  if (user.coins < bet) throw new MineError(`You only have ${user.coins.toLocaleString()} OwiCoins.`);

  // pay the bet up front (atomic + audited)
  await mutate(user.id, { type: "mine", amount: -bet, reference: `mine:${user.id}:${Date.now()}` });

  const mines = new Set();
  while (mines.size < MINES) mines.add(Math.floor(Math.random() * TOTAL));

  const g = { userId: user.id, bet, mines, revealed: new Set(), over: false };
  games.set(discordId, g);
  return g;
}

export function multiplierOf(g) {
  return mineMultiplier(TOTAL, MINES, g.revealed.size);
}

export function reveal(discordId, idx) {
  const g = games.get(discordId);
  if (!g || g.over) throw new MineError("No active game.");
  if (g.revealed.has(idx)) return { g, already: true };

  if (g.mines.has(idx)) {
    g.over = true;
    games.delete(discordId);
    return { g, boom: true };
  }
  g.revealed.add(idx);
  const won = g.revealed.size === TOTAL - MINES;
  return { g, boom: false, cleared: won };
}

export async function cashout(discordId) {
  const g = games.get(discordId);
  if (!g || g.over) throw new MineError("No active game.");
  if (g.revealed.size === 0) throw new MineError("Reveal at least one tile before cashing out.");
  g.over = true;
  games.delete(discordId);

  const payout = Math.floor(g.bet * multiplierOf(g));
  const r = await mutate(g.userId, { type: "mine_win", amount: payout, reference: `mine:${g.userId}:cash:${Date.now()}` });
  return { payout, mult: multiplierOf(g), balance: r.balance, revealed: g.revealed.size };
}

export async function autoWin(g) {
  const payout = Math.floor(g.bet * multiplierOf(g));
  const r = await mutate(g.userId, { type: "mine_win", amount: payout, reference: `mine:${g.userId}:clear:${Date.now()}` });
  return { payout, balance: r.balance };
}
