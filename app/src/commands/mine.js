import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { start, multiplierOf, games, TOTAL, COLS, MineError } from "../services/mine.js";
import { resolveBet, BetError } from "../services/gamble.js";
import { say, fmt } from "../lib/owo.js";

export const data = { name: "mine" };

export function boardComponents(discordId, g, { reveal = false } = {}) {
  const rows = [];
  const gridRows = TOTAL / COLS;
  for (let r = 0; r < gridRows; r++) {
    const row = new ActionRowBuilder();
    for (let c = 0; c < COLS; c++) {
      const idx = r * COLS + c;
      const opened = g.revealed.has(idx);
      const isMine = g.mines.has(idx);
      const isStar = g.star === idx;
      const btn = new ButtonBuilder().setCustomId(`mine:${discordId}:${idx}`);
      if (reveal && isMine) btn.setEmoji(g.boomIdx === idx ? "💥" : "💣").setStyle(g.boomIdx === idx ? ButtonStyle.Danger : ButtonStyle.Secondary).setDisabled(true);
      else if ((reveal || opened) && isStar) btn.setEmoji("🌟").setStyle(opened ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(true);
      else if (opened) btn.setEmoji("💎").setStyle(ButtonStyle.Success).setDisabled(true);
      else if (reveal) btn.setEmoji("💎").setStyle(ButtonStyle.Secondary).setDisabled(true);
      else btn.setLabel("\u200b").setStyle(ButtonStyle.Secondary).setDisabled(g.over);
      row.addComponents(btn);
    }
    rows.push(row);
  }
  return rows;
}

export function mineEmbed(g, { note = null, color = 0x5865f2 } = {}) {
  const mult = multiplierOf(g).toFixed(2);
  const potential = Math.floor(g.bet * multiplierOf(g));
  const e = new EmbedBuilder()
    .setColor(color)
    .setTitle("💣 MINES")
    .setDescription(
      `Bet **${fmt(g.bet)} OwiCoins** · ${g.mineCount} mines\n` +
      `💎 revealed **${g.revealed.size}** · **×${mult}** · cash out **${fmt(potential)} OwiCoins**`
    )
    .setFooter({ text: "Gacha Bot" });
  if (note) e.addFields({ name: "\u200b", value: note });
  return e;
}

export async function execute(interaction) {
  const u = interaction.user;
  let bet;
  try {
    bet = await resolveBet(u.id, u.username, interaction.options.getString("bet"));
    const g = await start(u.id, u.username, bet);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mine:${u.id}:cash`).setEmoji("1537023515927117874").setLabel("Cash Out").setStyle(ButtonStyle.Primary).setDisabled(true)
    );
    await interaction.reply({ embeds: [mineEmbed(g)], components: [...boardComponents(u.id, g), row] });
  } catch (e) {
    if (e instanceof MineError || e instanceof BetError) return void (await say(interaction, `❌ <@${u.id}> ${e.message}`));
    throw e;
  }
}
