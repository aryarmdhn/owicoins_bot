import { play, resolveBet, BetError, InsufficientFunds } from "../services/gamble.js";
import { coinflip } from "../lib/rules.js";
import { say, fmt, sleep } from "../lib/owo.js";

export const data = { name: "cf" };

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

  const msg = await interaction.reply({ content: `<@${u.id}> spent 💰 **${fmt(bet)} OwiCoins** and chose **${guess}**\nThe coin spins... 🪙` });
  await sleep(700);
  await edit(msg, `<@${u.id}> spent 💰 **${fmt(bet)} OwiCoins** and chose **${guess}**\nThe coin spins... 🌀`);
  await sleep(700);

  const face = r.result === "heads" ? "HEADS" : "TAILS";
  const tail = r.win
    ? `landed on **${face}** and you won 💰 **+${fmt(r.payout - r.bet)} OwiCoins**!!`
    : `landed on **${face}**... you lost 💰 **${fmt(r.bet)} OwiCoins** :c`;
  await edit(msg, `<@${u.id}> spent 💰 **${fmt(bet)} OwiCoins** and chose **${guess}**\nThe coin spins... ${tail}\nbalance: 💰 ${fmt(r.balance)} OwiCoins`);
  await msg?.react?.(r.win ? "🎉" : "💀").catch(() => {});
}
