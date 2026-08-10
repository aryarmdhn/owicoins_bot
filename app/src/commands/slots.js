import { play, BetError, InsufficientFunds } from "../services/gamble.js";
import { slots, SLOT_SYMBOLS } from "../lib/rules.js";
import { say, fmt, sleep } from "../lib/owo.js";

export const data = { name: "slots" };

const edit = (msg, content) => msg?.edit?.({ content, allowedMentions: { parse: [] } }).catch(() => {});
const rnd = () => SLOT_SYMBOLS[Math.floor(Math.random() * SLOT_SYMBOLS.length)];

// each reel shows 3 rows; middle row = payline. `locked` = final middle symbol or null (still spinning)
function board(cols, note) {
  const top = cols.map((c) => c.top).join("   ");
  const mid = cols.map((c) => c.mid).join("   ");
  const bot = cols.map((c) => c.bot).join("   ");
  return [
    "🎰 **｡･:*:･ﾟ SLOTS ﾟ･:*:･｡**",
    "┏━━━━━━━━━━━━━┓",
    `┃   ${top}   ┃`,
    `▶  ${mid}  ◀`,
    `┃   ${bot}   ┃`,
    "┗━━━━━━━━━━━━━┛",
    note,
  ].join("\n");
}

function spinningCol() {
  return { top: rnd(), mid: rnd(), bot: rnd() };
}
function lockedCol(sym) {
  return { top: rnd(), mid: sym, bot: rnd() };
}

export async function execute(interaction) {
  const u = interaction.user;
  const bet = interaction.options.getInteger("bet");

  let r;
  try {
    r = await play(u.id, u.username, bet, "slots", (luck) => slots(bet, Math.random, luck));
  } catch (e) {
    if (e instanceof InsufficientFunds) return void (await say(interaction, `😔 <@${u.id}> not enough OwiCoins! you have **${fmt(e.balance)}**`));
    if (e instanceof BetError) return void (await say(interaction, `❌ <@${u.id}> ${e.message}`));
    throw e;
  }

  const spin = `<@${u.id}> bet 💰 **${fmt(bet)} OwiCoins** — rolling…`;
  const msg = await interaction.reply({ content: board([spinningCol(), spinningCol(), spinningCol()], spin) });

  // stop reels left → right
  const cols = [spinningCol(), spinningCol(), spinningCol()];
  for (let i = 0; i < 3; i++) {
    await sleep(600);
    cols[i] = lockedCol(r.reels[i]);
    for (let j = i + 1; j < 3; j++) cols[j] = spinningCol();
    const done = i === 2;
    await edit(msg, board(cols, done ? "🎲 …" : `reel ${i + 1} locked ✔`));
  }
  await sleep(300);

  const outcome = r.payout > 0
    ? (r.mult >= 10
        ? `🎉🎉 <@${u.id}> hit the **JACKPOT** and won 💰 **+${fmt(r.payout - r.bet)} OwiCoins**!`
        : `✨ <@${u.id}> won 💰 **+${fmt(r.payout - r.bet)} OwiCoins**!`)
    : `💀 <@${u.id}> won nothing... better luck next time!`;
  await edit(msg, board(cols, `${outcome}\n💰 balance: **${fmt(r.balance)} OwiCoins**`));
  if (r.payout > 0) for (const e of ["🎉", "✨"]) await msg?.react?.(e).catch(() => {});
}
