import { play, resolveBet, BetError, InsufficientFunds } from "../services/gamble.js";
import { slots } from "../lib/rules.js";
import { say, fmt, sleep } from "../lib/owo.js";

export const data = { name: "slots" };

const SPIN = "<a:slot_spin_single:1537014713567809608>";

const edit = (msg, content) => msg?.edit?.({ content, allowedMentions: { parse: [] } }).catch(() => {});

// single payline of 3 reels. `reels[i]` is null while spinning (shows GIF), or the locked symbol.
function board(reels, username, bet, note) {
  const row = reels.map((s) => s ?? SPIN).join("");
  return [
    "**｡･:*:･ﾟ SLOTS ﾟ･:*:･｡**",
    `**${username}** bet <:owicoin:1537023515927117874> **${fmt(bet)} OwiCoins**`,
    `▶　${row}　◀`,
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
    r = await play(u.id, u.username, bet, "slots", (luck, rigged) => slots(bet, Math.random, luck, rigged));
  } catch (e) {
    if (e instanceof InsufficientFunds) return void (await say(interaction, `😔 <@${u.id}> not enough OwiCoins! you have **${fmt(e.balance)}**`));
    if (e instanceof BetError) return void (await say(interaction, `❌ <@${u.id}> ${e.message}`));
    throw e;
  }

  const msg = await interaction.reply({ content: board([null, null, null], u.username, bet, "rolling…") });

  // GIF spins in every slot; lock left → right (1 edit per reel, no frame spam)
  const reels = [null, null, null];
  for (let i = 0; i < 3; i++) {
    await sleep(800);
    reels[i] = r.reels[i];
    await edit(msg, board(reels, u.username, bet, i === 2 ? "🎲 …" : `reel ${i + 1} locked ✔`));
  }
  await sleep(300);

  const net = r.payout - r.bet;
  const outcome = r.payout <= 0
    ? `💀 <@${u.id}> won nothing... better luck next time!`
    : net === 0
    ? `😌 <@${u.id}> broke even — got your **${fmt(r.bet)} OwiCoins** back!`
    : r.mult >= 8
    ? `🎉🎉 <@${u.id}> hit the **JACKPOT** and won <:owicoin:1537023515927117874> **+${fmt(net)} OwiCoins**!`
    : `✨ <@${u.id}> won <:owicoin:1537023515927117874> **+${fmt(net)} OwiCoins**!`;
  await edit(msg, board(reels, u.username, bet, `${outcome}\n<:owicoin:1537023515927117874> balance: **${fmt(r.balance)} OwiCoins**`));
  if (r.payout > 0) for (const e of ["🎉", "✨"]) await msg?.react?.(e).catch(() => {});
}
