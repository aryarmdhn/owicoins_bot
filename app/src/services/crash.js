import crypto from "node:crypto";
import { getOrCreate } from "../repositories/users.js";
import { mutate, InsufficientFunds } from "./economy.js";
import { XP_PLAY, XP_WIN } from "./gamble.js";
import { crashPoint } from "../lib/rules.js";

export { InsufficientFunds };
export class CrashError extends Error {}

export const games = new Map(); // key: discordId
const MAX_BET = 1_000_000;
const HOUSE_EDGE = 4;

// provably fair: e in [0,100) from HMAC(serverSeed, nonce), revealed after the game
function rollCrash() {
  const serverSeed = crypto.randomBytes(16).toString("hex");
  const h = crypto.createHash("sha256").update(serverSeed).digest();
  const e = (h.readUInt32BE(0) / 0x100000000) * 100; // uniform [0,100)
  return { serverSeed, seedHash: crypto.createHash("sha256").update(serverSeed).digest("hex"), point: crashPoint(e, HOUSE_EDGE) };
}

export async function start(discordId, username, bet) {
  if (!Number.isInteger(bet) || bet <= 0) throw new CrashError("Bet must be a positive number or `all`.");
  if (bet > MAX_BET) throw new CrashError(`Max bet is ${MAX_BET.toLocaleString()}.`);
  if (games.has(discordId)) throw new CrashError("You already have a crash game running!");

  const user = await getOrCreate(discordId, username);
  if (user.coins < bet) throw new CrashError(`You only have ${user.coins.toLocaleString()} OwiCoins.`);
  await mutate(user.id, { type: "crash", amount: -bet, reference: `crash:${user.id}:${Date.now()}`, xp: XP_PLAY });

  const { serverSeed, seedHash, point } = rollCrash();
  const g = { userId: user.id, bet, point, serverSeed, seedHash, over: false };
  games.set(discordId, g);
  return g;
}

// cash out at the given multiplier (must be < crash point and game live)
export async function cashout(discordId, mult) {
  const g = games.get(discordId);
  if (!g || g.over) throw new CrashError("No active game.");
  if (mult >= g.point) throw new CrashError("Too late — it already crashed.");
  g.over = true;
  games.delete(discordId);
  const payout = Math.floor(g.bet * mult);
  const r = await mutate(g.userId, { type: "crash_win", amount: payout, reference: `crash:${g.userId}:cash:${Date.now()}`, xp: XP_WIN });
  return { payout, mult, balance: r.balance, point: g.point, serverSeed: g.serverSeed };
}

// bot marks the game as crashed (player never cashed out)
export function bust(discordId) {
  const g = games.get(discordId);
  if (!g) return null;
  g.over = true;
  games.delete(discordId);
  return g;
}
