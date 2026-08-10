import { AttachmentBuilder } from "discord.js";
import { play, BetError, InsufficientFunds } from "../services/gamble.js";
import { diceRoll } from "../lib/rules.js";
import { renderDiceGif } from "../lib/dicegif.js";
import { say, fmt, sleep } from "../lib/owo.js";

export const data = { name: "dice" };

export async function execute(interaction) {
  const u = interaction.user;
  const bet = interaction.options.getInteger("bet");

  let r;
  try {
    r = await play(u.id, u.username, bet, "dice", (luck) => diceRoll(bet, Math.random, luck));
  } catch (e) {
    if (e instanceof InsufficientFunds) return void (await say(interaction, `😔 <@${u.id}> not enough OwiCoins! you have **${fmt(e.balance)}**`));
    if (e instanceof BetError) return void (await say(interaction, `❌ <@${u.id}> ${e.message}`));
    throw e;
  }

  const gif = renderDiceGif(r.player, r.house);
  const file = new AttachmentBuilder(gif, { name: "dice.gif" });
  await interaction.reply({ content: `🎲 <@${u.id}> rolls for **${fmt(bet)}** — 🔵 you vs 🔴 house…`, files: [file] });

  await sleep(1500);

  const outcome = r.win
    ? `🎉 **${r.player} vs ${r.house}** — you win **+${fmt(r.payout - r.bet)}** OwiCoins!`
    : r.player === r.house
    ? `💀 **${r.player} vs ${r.house}** — tie goes to the house, lost **${fmt(r.bet)} OwiCoins**.`
    : `💀 **${r.player} vs ${r.house}** — house wins, lost **${fmt(r.bet)} OwiCoins**.`;
  const done = await interaction.channel?.send?.({ content: `<@${u.id}> ${outcome}\n💰 balance: **${fmt(r.balance)} OwiCoins**`, allowedMentions: { parse: [] } }).catch(() => null);
  await done?.react?.(r.win ? "🎉" : "💀").catch(() => {});
}
