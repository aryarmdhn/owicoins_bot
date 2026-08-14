export function applyXp(level, xp, gained) {
  xp += gained;
  while (xp >= 100 * level) {
    xp -= 100 * level;
    level += 1;
  }
  return { level, xp };
}

export function streakBonusPct(streak) {
  if (streak >= 31) return 50;
  if (streak >= 15) return 30;
  if (streak >= 8) return 20;
  if (streak >= 4) return 10;
  return 0;
}

export function nextStreak(elapsedHours, cooldownHours) {
  if (elapsedHours === null || elapsedHours === undefined) return 1;
  if (elapsedHours < 0) return 1;
  if (elapsedHours < cooldownHours) return null;
  return elapsedHours < cooldownHours * 2 ? "continue" : 1;
}

export const TIER_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Immortal"];

export function tiersUpTo(tier) {
  const t = TIER_ORDER.find((x) => x.toLowerCase() === String(tier).toLowerCase());
  if (!t) return null;
  return TIER_ORDER.slice(0, TIER_ORDER.indexOf(t) + 1);
}

export function petHp(rarity) {
  return { Common: 3, Uncommon: 4, Rare: 6, Epic: 8, Legendary: 11, Mythic: 14, Immortal: 15 }[rarity] ?? 3;
}

export function nextTier(rarity) {
  const i = TIER_ORDER.indexOf(rarity);
  if (i < 0 || i >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[i + 1];
}

// map luck multiplier -> extra win probability, capped so the house still wins long-term
export function luckWinBonus(luck = 1) {
  return Math.min(0.02, Math.max(0, (luck - 1) * 0.005));
}

export function coinflip(guess, bet, rand = Math.random, luck = 1, rigged = false) {
  // with luck, a losing flip has a small chance to be nudged to a win
  let result = rand() < 0.5 ? "heads" : "tails";
  let win = guess === result;
  if (!win && (rigged || rand() < luckWinBonus(luck))) {
    win = true;
    result = guess;
  }
  return { result, win, payout: win ? bet * 2 : 0 };
}

export function diceRoll(bet, rand = Math.random, luck = 1, rigged = false) {
  let player = 1 + Math.floor(rand() * 6);
  const house = 1 + Math.floor(rand() * 6);
  let win = player > house;
  if (!win && (rigged || rand() < luckWinBonus(luck))) {
    win = true;
    player = Math.min(6, house + 1);
  }
  return { player, house, win, payout: win ? bet * 2 : 0 };
}

const SLOT_EMOJI = [
  { id: "1537007604985892966", name: "paw_coin", multiplier: 1, weight: 26 },
  { id: "1537007610463785011", name: "cherry", multiplier: 2.5, weight: 16 },
  { id: "1537007608727347300", name: "star", multiplier: 2, weight: 20 },
  { id: "1537007612778778764", name: "bell", multiplier: 1.5, weight: 22 },
  { id: "1537007606495715369", name: "heart", multiplier: 4, weight: 12 },
  { id: "1537007619007451176", name: "owi", multiplier: 8, weight: 4 },
];
export const SLOT_SYMBOLS = SLOT_EMOJI.map((e) => `<:${e.name}:${e.id}>`);
const SLOT_TRIPLE = Object.fromEntries(SLOT_EMOJI.map((e) => [`<:${e.name}:${e.id}>`, e.multiplier]));
const SLOT_TOTAL_WEIGHT = SLOT_EMOJI.reduce((s, e) => s + e.weight, 0);

function pickSymbol(rand) {
  let n = rand() * SLOT_TOTAL_WEIGHT;
  for (const e of SLOT_EMOJI) if ((n -= e.weight) < 0) return `<:${e.name}:${e.id}>`;
  return SLOT_SYMBOLS[SLOT_SYMBOLS.length - 1];
}

// ponytail: extra chance to force a triple on top of the natural ~3%. tune here if too generous.
const TRIPLE_BONUS = 0.48;

// owo-style: only a triple wins. 2-of-a-kind or all-different = loss.
export function slots(bet, rand = Math.random, luck = 1, rigged = false) {
  const reels = [0, 0, 0].map(() => pickSymbol(rand));
  let isTriple = reels[0] === reels[1] && reels[1] === reels[2];
  // bonus: nudge a non-triple spin into a triple (weighted symbol), boosted by luck
  if (!isTriple && (rigged || rand() < TRIPLE_BONUS + luckWinBonus(luck))) {
    const s = pickSymbol(rand);
    reels[0] = reels[1] = reels[2] = s;
    isTriple = true;
  }
  const mult = isTriple ? SLOT_TRIPLE[reels[0]] : 0;
  return { reels, payout: Math.floor(bet * mult), mult };
}

// --- crash gamble ---
// provably-fair crash point from a uniform e in [0,100), house edge H percent.
// crashPoint = (100 - H) / (100 - e), floored at 1.00x. Higher targets get rarer.
export function crashPoint(e, house = 4) {
  const denom = 100 - Math.min(Math.max(e, 0), 99.99);
  return Math.max(1, Math.floor(((100 - house) * 100) / denom) / 100);
}

// --- minesweeper gamble ---
// fair multiplier after revealing k safe tiles from `total` with `mines`, minus house edge
export function mineMultiplier(total, mines, revealed, edge = 0.02) {
  const safe = total - mines;
  if (revealed <= 0) return 1;
  let m = 1;
  for (let i = 0; i < revealed; i++) m *= (safe - i) / (total - i);
  return Math.max(1, ((1 - edge) / m));
}

// --- blackjack ---
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    const c = typeof card === "object" ? card.rank : card;
    if (c === 1) { aces++; total += 11; }
    else total += Math.min(c, 10);
  }
  while (total > 21 && aces > 0) { total -= 10; aces--; }
  return total;
}

export function isBlackjack(cards) {
  return cards.length === 2 && handValue(cards) === 21;
}

export function fightWinnerIsA(powerA, powerB, rand = Math.random) {
  const total = powerA + powerB;
  if (total <= 0) return rand() < 0.5;
  return rand() < powerA / total;
}

export function rollRarity(weights, luck = 1, rand = Math.random) {
  const boosted = Object.entries(weights).map(([rarity, w]) => [
    rarity,
    rarity === "Common" ? w : w * luck,
  ]);
  const total = boosted.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) throw new Error("invalid rarity weights");
  let r = rand() * total;
  for (const [rarity, w] of boosted) {
    if ((r -= w) < 0) return rarity;
  }
  return boosted[boosted.length - 1][0];
}
