import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import { mutate, InsufficientFunds } from "./economy.js";
import { XP_PLAY, XP_WIN } from "./gamble.js";
import { handValue, isBlackjack } from "../lib/rules.js";

export { InsufficientFunds, handValue };
export class BjError extends Error {}

export const games = new Map(); // key: discordId
const MAX_BET = 1_000_000;

const drawCard = () => ({ rank: 1 + Math.floor(Math.random() * 13), suit: Math.floor(Math.random() * 4) }); // 1=Ace..13=King, suit 0-3

export async function start(discordId, username, bet) {
  if (!Number.isInteger(bet) || bet <= 0) throw new BjError("Bet must be a positive number or `all`.");
  if (bet > MAX_BET) throw new BjError(`Max bet is ${MAX_BET.toLocaleString()}.`);
  if (games.has(discordId)) throw new BjError("You already have a blackjack game running!");

  const user = await getOrCreate(discordId, username);
  if (user.coins < bet) throw new BjError(`You only have ${user.coins.toLocaleString()} OwiCoins.`);
  await mutate(user.id, { type: "bj", amount: -bet, reference: `bj:${user.id}:${Date.now()}`, xp: XP_PLAY });

  const g = { userId: user.id, bet, player: [drawCard(), drawCard()], dealer: [drawCard(), drawCard()], over: false };
  games.set(discordId, g);

  if (isBlackjack(g.player)) return settle(discordId, g); // natural
  return { g, done: false };
}

export async function hit(discordId) {
  const g = games.get(discordId);
  if (!g || g.over) throw new BjError("No active game.");
  g.player.push(drawCard());
  if (handValue(g.player) > 21) return settle(discordId, g); // bust
  return { g, done: false };
}

export async function stand(discordId) {
  const g = games.get(discordId);
  if (!g || g.over) throw new BjError("No active game.");
  while (handValue(g.dealer) < 17) g.dealer.push(drawCard());
  return settle(discordId, g);
}

async function settle(discordId, g) {
  g.over = true;
  games.delete(discordId);
  const pv = handValue(g.player);
  const dv = handValue(g.dealer);
  const playerBj = isBlackjack(g.player);
  const dealerBj = isBlackjack(g.dealer);

  let payout = 0;
  let outcome;
  if (pv > 21) { outcome = "bust"; }
  else if (playerBj && !dealerBj) { payout = Math.floor(g.bet * 2.5); outcome = "blackjack"; }
  else if (dealerBj && !playerBj) { outcome = "dealer_bj"; }
  else if (dv > 21) { payout = g.bet * 2; outcome = "dealer_bust"; }
  else if (pv > dv) { payout = g.bet * 2; outcome = "win"; }
  else if (pv < dv) { outcome = "lose"; }
  else { payout = g.bet; outcome = "push"; }

  let balance;
  if (payout > 0) {
    const r = await mutate(g.userId, { type: "bj_win", amount: payout, reference: `bj:${g.userId}:win:${Date.now()}`, xp: XP_WIN });
    balance = r.balance;
  } else {
    const [[u]] = await pool.query("SELECT coins FROM users WHERE id = ?", [g.userId]);
    balance = Number(u.coins);
  }
  return { g, done: true, outcome, payout, pv, dv, balance };
}
