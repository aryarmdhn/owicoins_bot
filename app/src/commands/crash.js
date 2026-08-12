import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { start, bust, games, CrashError, InsufficientFunds } from "../services/crash.js";
import { resolveBet, BetError } from "../services/gamble.js";
import { say, fmt, sleep } from "../lib/owo.js";

export const data = { name: "crash" };

const COIN = "<:owicoin:1537023515927117874>";
const ROCKET = "<:crash_1_rocket:1537094200128962671>";
const GRAPH = "<:crash_2_graph:1537094209679663174>";
const BOOM = "<:crash_4_explosion:1537094212087193610>";

const TICK_MS = 700;
const GROWTH = 1.08; // multiplier per tick

const cashRow = (discordId, disabled = false) =>
  new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`crash:${discordId}:cash`).setEmoji("1537094207460876288").setLabel("Cash Out").setStyle(ButtonStyle.Success).setDisabled(disabled)
  );

const flying = (bet, mult) =>
  new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`${ROCKET} Crash`)
    .setDescription(`${GRAPH} **${mult.toFixed(2)}×**\n${COIN} Bet: **${fmt(bet)} OwiCoins**`)
    .setFooter({ text: "Cash out before it crashes!" });

export async function execute(interaction) {
  const u = interaction.user;
  let bet;
  try {
    bet = await resolveBet(u.id, u.username, interaction.options.getString("bet"));
  } catch (e) {
    if (e instanceof BetError) return void (await say(interaction, `❌ <@${u.id}> ${e.message}`));
    throw e;
  }

  let g;
  try {
    g = await start(u.id, u.username, bet);
  } catch (e) {
    if (e instanceof InsufficientFunds) return void (await say(interaction, `😔 <@${u.id}> not enough OwiCoins! you have **${fmt(e.balance)}**`));
    if (e instanceof CrashError || e instanceof BetError) return void (await say(interaction, `❌ <@${u.id}> ${e.message}`));
    throw e;
  }

  const msg = await interaction.reply({ embeds: [flying(bet, 1)], components: [cashRow(u.id)] });
  g.mult = 1;

  while (true) {
    await sleep(TICK_MS);
    if (g.over) return; // player cashed out — button handler rendered the result

    g.mult = Math.round(g.mult * GROWTH * 100) / 100;
    if (g.mult >= g.point) {
      bust(u.id);
      const crashed = new EmbedBuilder()
        .setColor(0xed4245)
        .setTitle(`${BOOM} Crashed at ${g.point.toFixed(2)}×`)
        .setDescription(`💀 <@${u.id}> lost **${fmt(bet)} OwiCoins**.\n_seed: \`${g.serverSeed}\`_`)
        .setFooter({ text: "Gacha Bot" });
      await msg?.edit?.({ embeds: [crashed], components: [], allowedMentions: { parse: [] } }).catch(() => {});
      await msg?.react?.("💥").catch(() => {});
      return;
    }
    await msg?.edit?.({ embeds: [flying(bet, g.mult)], components: [cashRow(u.id)] }).catch(() => {});
  }
}
