import { play, resolveBet, BetError, InsufficientFunds } from "../services/gamble.js";
import { coinflip } from "../lib/rules.js";
import { say, fmt, sleep } from "../lib/owo.js";

export const data = { name: "cf" };

const SPIN = "<a:coin_spin_loop:1537020201676316692>";
const FACE = { heads: "<:coin_heads:1537020191035367444>", tails: "<:coin_tails:1537020203857354752>" };
const edit = (msg, content) => msg?.edit?.({ content, allowedMentions: { parse: [] } }).catch(() => {});

export async function execute(interaction) {
  const u = interaction.user;
  let bet;
  try {
    bet = await resolveBet(u.id, u.username, interaction.options.getString("bet"));
  } catch (e) {
    if (e instanceof BetError) return void (await say(interaction, `❌ <@${u.id}> ${e.message}`));
    throw e;
  }
  let guess = (interaction.options.getString("side") || "").toLowerCase();

  if (guess === "h") guess = "heads";
  else if (guess === "t") guess = "tails";
  else if (guess === "") guess = Math.random() < 0.5 ? "heads" : "tails";
  else {
    await say(interaction, `❌ <@${u.id}> usage: \`gcf <bet|all> [h|t]\` (side optional, random if blank)`);
    return;
  }

  let r;
  try {
    r = await play(u.id, u.username, bet, "coinflip", (luck) => coinflip(guess, bet, Math.random, luck));
  } catch (e) {
    if (e instanceof InsufficientFunds) return void (await say(interaction, `😔 <@${u.id}> not enough OwiCoins! you have **${fmt(e.balance)}**`));
    if (e instanceof BetError) return void (await say(interaction, `❌ <@${u.id}> ${e.message}`));
    throw e;
  }

  const head = `<@${u.id}> spent <:owicoin:1537023515927117874> **${fmt(bet)} OwiCoins** and chose **${guess}**`;
  const msg = await interaction.reply({ content: `${head}\nThe coin spins... ${SPIN}` });
  await sleep(1500);

  const face = r.result === "heads" ? "HEADS" : "TAILS";
  const tail = r.win
    ? `landed on ${FACE[r.result]} **${face}** and you won <:owicoin:1537023515927117874> **+${fmt(r.payout - r.bet)} OwiCoins**!!`
    : `landed on ${FACE[r.result]} **${face}**... you lost <:owicoin:1537023515927117874> **${fmt(r.bet)} OwiCoins** :c`;
  await edit(msg, `${head}\n${tail}\nbalance: <:owicoin:1537023515927117874> ${fmt(r.balance)} OwiCoins`);
  await msg?.react?.(r.win ? "🎉" : "💀").catch(() => {});
}
