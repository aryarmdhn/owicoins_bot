import assert from "node:assert/strict";
import { applyXp, streakBonusPct, nextStreak, rollRarity, fightWinnerIsA } from "./lib/rules.js";
import { tokenize, parseArgs } from "./lib/textparse.js";

assert.deepEqual(applyXp(1, 0, 50), { level: 1, xp: 50 });
assert.deepEqual(applyXp(1, 50, 50), { level: 2, xp: 0 });
assert.deepEqual(applyXp(1, 0, 350), { level: 3, xp: 50 });

assert.equal(streakBonusPct(1), 0);
assert.equal(streakBonusPct(4), 10);
assert.equal(streakBonusPct(8), 20);
assert.equal(streakBonusPct(15), 30);
assert.equal(streakBonusPct(31), 50);

assert.equal(nextStreak(null, 24), 1);
assert.equal(nextStreak(10, 24), null);
assert.equal(nextStreak(30, 24), "continue");
assert.equal(nextStreak(60, 24), 1);
assert.equal(nextStreak(-5, 24), 1);

const W = { Common: 55, Uncommon: 25, Rare: 12, Epic: 6, Legendary: 1.8, Mythic: 0.2 };
assert.equal(rollRarity(W, 1, () => 0), "Common");
assert.equal(rollRarity(W, 1, () => 0.999999), "Mythic");
assert.equal(rollRarity(W, 1, () => 0.9), "Rare");
assert.throws(() => rollRarity({ Common: 0 }, 1, () => 0.5), /invalid rarity weights/);

const counts = { Common: 0 };
const N = 100000;
for (let i = 0; i < N; i++) {
  const r = rollRarity(W, 1, Math.random);
  counts[r] = (counts[r] || 0) + 1;
}
const commonPct = (counts.Common / N) * 100;
assert.ok(Math.abs(commonPct - 55) < 2, `Common ~55% got ${commonPct.toFixed(1)}`);

let mythicLow = 0, mythicHigh = 0;
for (let i = 0; i < N; i++) {
  if (rollRarity(W, 1, Math.random) === "Mythic") mythicLow++;
  if (rollRarity(W, 5, Math.random) === "Mythic") mythicHigh++;
}
assert.ok(mythicHigh > mythicLow, "luck boost raises Mythic rate");

assert.deepEqual(tokenize('sell "Neon Cat" 2'), ["sell", "Neon Cat", "2"]);
assert.deepEqual(tokenize("gacha 10"), ["gacha", "10"]);

const noMentions = { mentions: { users: new Map() } };
assert.deepEqual(parseArgs("pull", ["10"], noMentions), { pulls: 10 });
assert.deepEqual(parseArgs("pull", ["5"], noMentions), { pulls: 5 });
assert.deepEqual(parseArgs("pull", [], noMentions), { pulls: null });
assert.deepEqual(parseArgs("pull", ["abc"], noMentions), { pulls: null });
assert.deepEqual(parseArgs("sell", ["Neon Cat", "2"], noMentions), { collectible: "Neon Cat", arg2: "2" });
assert.deepEqual(parseArgs("sell", ["all", "rare"], noMentions), { collectible: "all", arg2: "rare" });
assert.deepEqual(parseArgs("sell", ["all"], noMentions), { collectible: "all", arg2: null });

const user = { id: "42" };
const withMention = { mentions: { users: new Map([["42", user]]) } };
const t = parseArgs("trade", ["<@42>", "Neon Cat", "1", "0", "Fire Fox", "1", "500"], withMention);
assert.equal(t.user, user);
assert.equal(t.offer_item, "Neon Cat");
assert.equal(t.request_coins, 500);

assert.equal(fightWinnerIsA(100, 100, () => 0.4), true);
assert.equal(fightWinnerIsA(100, 100, () => 0.6), false);
assert.equal(fightWinnerIsA(300, 100, () => 0.7), true);
assert.equal(fightWinnerIsA(100, 300, () => 0.3), false);
assert.equal(fightWinnerIsA(0, 0, () => 0.4), true);

let aWins = 0;
for (let i = 0; i < 100000; i++) if (fightWinnerIsA(300, 100, Math.random)) aWins++;
const pct = (aWins / 100000) * 100;
assert.ok(Math.abs(pct - 75) < 2, `strong ~75% got ${pct.toFixed(1)}`);

const { tiersUpTo, nextTier, petHp } = await import("./lib/rules.js");
assert.equal(petHp("Common"), 3);
assert.equal(petHp("Immortal"), 15);
assert.equal(petHp("bogus"), 3);
assert.ok(petHp("Mythic") > petHp("Rare"));
assert.deepEqual(tiersUpTo("rare"), ["Common", "Uncommon", "Rare"]);
assert.deepEqual(tiersUpTo("Common"), ["Common"]);
assert.deepEqual(tiersUpTo("immortal").length, 7);
assert.equal(tiersUpTo("bogus"), null);
assert.equal(nextTier("Common"), "Uncommon");
assert.equal(nextTier("Mythic"), "Immortal");
assert.equal(nextTier("Immortal"), null);
assert.equal(nextTier("bogus"), null);

const { coinflip, diceRoll, slots } = await import("./lib/rules.js");
assert.deepEqual(coinflip("heads", 100, () => 0.1), { result: "heads", win: true, payout: 200 });
assert.deepEqual(coinflip("heads", 100, () => 0.9), { result: "tails", win: false, payout: 0 });

const d = diceRoll(100, (() => { let i = 0; const v = [0.9, 0.1]; return () => v[i++]; })());
assert.equal(d.player, 6);
assert.equal(d.house, 1);
assert.equal(d.win, true);

const jackpot = slots(100, () => 0.99);
assert.equal(jackpot.reels.every((r) => r === jackpot.reels[0]), true);
assert.ok(jackpot.payout > 0);

const bet = 100;
assert.equal(coinflip("heads", bet, () => 0.1).payout, 200); // win pays 2x
assert.equal(coinflip("heads", bet, () => 0.9).payout, 0);

const { luckWinBonus } = await import("./lib/rules.js");
assert.equal(luckWinBonus(1), 0);
assert.equal(luckWinBonus(6), 0.02);
assert.equal(luckWinBonus(100), 0.02);
assert.ok(luckWinBonus(3) > 0 && luckWinBonus(3) < 0.02);

// dice keeps a house edge (ties lose), even at max luck
let houseDice = 0;
for (let i = 0; i < 200000; i++) houseDice += bet - diceRoll(bet, Math.random, 5).payout;
assert.ok(houseDice > 0, "dice house edge holds even with max luck");

console.log("all checks passed");
