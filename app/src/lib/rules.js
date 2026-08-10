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

const TIER_ORDER = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Immortal"];

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

export function coinflip(guess, bet, rand = Math.random, luck = 1) {
  // with luck, a losing flip has a small chance to be nudged to a win
  let result = rand() < 0.5 ? "heads" : "tails";
  let win = guess === result;
  if (!win && rand() < luckWinBonus(luck)) {
    win = true;
    result = guess;
  }
  return { result, win, payout: win ? bet * 2 : 0 };
}

export function diceRoll(bet, rand = Math.random, luck = 1) {
  let player = 1 + Math.floor(rand() * 6);
  const house = 1 + Math.floor(rand() * 6);
  let win = player > house;
  if (!win && rand() < luckWinBonus(luck)) {
    win = true;
    player = Math.min(6, house + 1);
  }
  return { player, house, win, payout: win ? bet * 2 : 0 };
}

export const SLOT_SYMBOLS = ["🍒", "🍋", "🔔", "⭐", "💎", "💰"];
const SLOT_TRIPLE = { "🍒": 3, "🍋": 4, "🔔": 6, "⭐": 10, "💎": 20, "💰": 50 };

export function slots(bet, rand = Math.random, luck = 1) {
  const reels = [0, 0, 0].map(() => SLOT_SYMBOLS[Math.floor(rand() * SLOT_SYMBOLS.length)]);
  let mult = 0;
  if (reels[0] === reels[1] && reels[1] === reels[2]) mult = SLOT_TRIPLE[reels[0]];
  else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) mult = 1.5;
  // luck: a total loss has a small chance to be nudged into a 2-match
  if (mult === 0 && rand() < luckWinBonus(luck)) {
    reels[1] = reels[0];
    mult = 1.5;
  }
  return { reels, payout: Math.floor(bet * mult), mult };
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
