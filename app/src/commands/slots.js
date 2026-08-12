import { play, resolveBet, BetError, InsufficientFunds } from "../services/gamble.js";
import { slots, SLOT_SYMBOLS } from "../lib/rules.js";
import { say, fmt, sleep } from "../lib/owo.js";

export const data = { name: "slots" };

const edit = (msg, content) => msg?.edit?.({ content, allowedMentions: { parse: [] } }).catch(() => {});
const rnd = () => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];

// single payline of 3 reels. `reels[i]` is null while spinning, or the locked symbol.
function board(reels, note) {
  const row = reels.map((s) => s ?? rnd()).join(" | ");
  return [
    "🎰 **｡･:*:･ﾟ SLOTS ﾟ･:*:･｡**",
    `▶ | ${row} | ◀`,
    note,
  ].join("\n");
}

export async function execute(interaction) {
  const u = interaction.user;
  let bet;
  try {
    bet = await resolveBet(u.id, u.username, interaction.options.getString("bet"));
  } catch (e) {
    if (e instanceof BetError) return void (await say(interaction, `❌ <@${u.id}> ${e.message}`));
    throw e;
  }

  let r;
  try {
    r = await play(u.id, u.username, bet, "slots", (luck) => slots(bet, Math.random, luck));
  } catch (e) {
    if (e instanceof InsufficientFunds) return void (await say(interaction, `😔 <@${u.id}> not enough OwiCoins! you have **${fmt(e.balance)}**`));
    if (e instanceof BetError) return void (await say(interaction, `❌ <@${u.id}> ${e.message}`));
    throw e;
  }

  const spin = `<@${u.id}> bet 💰 **${fmt(bet)} OwiCoins** — rolling…`;
  const msg = await interaction.reply({ content: board([null, null, null], spin) });

  // stop reels left → right; each reel spins a few frames before locking
  const reels = [null, null, null];
  for (let i = 0; i < 3; i++) {
    for (let f = 0; f < 3; f++) {
      await sleep(280);
      await edit(msg, board(reels, `reeling… ${"🎡".repeat(i + 1)}`));
    }
    reels[i] = r.reels[i];
    await edit(msg, board(reels, `reel ${i + 1} locked ✔`));
  }
  await sleep(300);

  const outcome = r.payout > 0
    ? (r.mult >= 10
        ? `🎉🎉 <@${u.id}> hit the **JACKPOT** and won 💰 **+${fmt(r.payout - r.bet)} OwiCoins**!`
        : `✨ <@${u.id}> won 💰 **+${fmt(r.payout - r.bet)} OwiCoins**!`)
    : `💀 <@${u.id}> won nothing... better luck next time!`;
  await edit(msg, board(reels, `${outcome}\n💰 balance: **${fmt(r.balance)} OwiCoins**`));
  if (r.payout > 0) for (const e of ["🎉", "✨"]) await msg?.react?.(e).catch(() => {});
}
