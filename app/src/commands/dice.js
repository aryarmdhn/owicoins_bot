import { EmbedBuilder } from "discord.js";
import { play, resolveBet, BetError, InsufficientFunds } from "../services/gamble.js";
import { diceRoll } from "../lib/rules.js";
import { say, fmt, sleep } from "../lib/owo.js";

export const data = { name: "dice" };

const COIN = "<:owicoin:1537023515927117874>";
const SPIN = "<a:dice_spin:1537065382253428836>";
const FACE = [
  "<:dice_face_1:1537065369124995193>",
  "<:dice_face_2:1537065370995654736>",
  "<:dice_face_3:1537065372866449408>",
  "<:dice_face_4:1537065374699495465>",
  "<:dice_face_5:1537065376842522735>",
  "<:dice_face_6:1537065378608451667>",
];
const COLOR = { win: 0x57f287, lose: 0xed4245, playing: 0x5865f2 };

const board = (username, bet, houseEmoji, houseVal, playerEmoji, playerVal, color, note = null) => {
  const e = new EmbedBuilder()
    .setColor(color)
    .setTitle("🎲 Dice Roll")
    .setDescription(`${COIN} Bet: **${fmt(bet)} OwiCoins**`)
    .addFields(
      { name: `House [${houseVal}]`, value: houseEmoji, inline: true },
      { name: `${username} [${playerVal}]`, value: playerEmoji, inline: true },
    )
    .setFooter({ text: "Gacha Bot" });
  if (note) e.addFields({ name: "\u200b", value: note });
  return e;
};

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
    r = await play(u.id, u.username, bet, "dice", (luck) => diceRoll(bet, Math.random, luck));
  } catch (e) {
    if (e instanceof InsufficientFunds) return void (await say(interaction, `😔 <@${u.id}> not enough OwiCoins! you have **${fmt(e.balance)}**`));
    if (e instanceof BetError) return void (await say(interaction, `❌ <@${u.id}> ${e.message}`));
    throw e;
  }

  const msg = await interaction.reply({ embeds: [board(u.username, bet, SPIN, "?", SPIN, "?", COLOR.playing, "rolling…")] });
  await sleep(1500);

  const outcome = r.win
    ? `🎉 **WIN!** you won **+${fmt(r.payout - r.bet)} OwiCoins**!`
    : r.player === r.house
    ? `💀 tie goes to the house — lost **${fmt(r.bet)} OwiCoins**.`
    : `💀 house wins — lost **${fmt(r.bet)} OwiCoins**.`;
  const result = board(u.username, bet, FACE[r.house - 1], r.house, FACE[r.player - 1], r.player, r.win ? COLOR.win : COLOR.lose, `${outcome}\n${COIN} balance: **${fmt(r.balance)} OwiCoins**`);
  await msg?.edit?.({ embeds: [result], allowedMentions: { parse: [] } }).catch(() => {});
  await msg?.react?.(r.win ? "🎉" : "💀").catch(() => {});
}
