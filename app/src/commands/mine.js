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
      if (reveal && isMine) btn.setLabel("💣").setStyle(g.boomIdx === idx ? ButtonStyle.Danger : ButtonStyle.Secondary).setDisabled(true);
      else if (reveal && isStar) btn.setLabel("🌟").setStyle(opened ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(true);
      else if (reveal) btn.setLabel("💎").setStyle(opened ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(true);
      else if (opened && isStar) btn.setLabel("🌟").setStyle(ButtonStyle.Success).setDisabled(true);
      else if (opened) btn.setLabel("💎").setStyle(ButtonStyle.Success).setDisabled(true);
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
    .setTitle("💣 Mines")
    .addFields(
      { name: "Bet", value: `${fmt(g.bet)} OwiCoins`, inline: true },
      { name: "Mines", value: `${g.mineCount}`, inline: true },
      { name: "💎 Revealed", value: `${g.revealed.size}`, inline: true },
      { name: "Multiplier", value: `×${mult}`, inline: true },
      { name: "Cash Out", value: `${fmt(potential)} OwiCoins`, inline: true }
    )
    .setFooter({ text: "one mine and you lose it all!" });
  if (note) e.setDescription(note);
  return e;
}

// legacy text (unused now but kept for safety)
export function statusText(g) {
  return `💣 Mines · bet ${fmt(g.bet)} · ×${multiplierOf(g).toFixed(2)}`;
}

export async function execute(interaction) {
  const u = interaction.user;
  let bet;
  try {
    bet = await resolveBet(u.id, u.username, interaction.options.getString("bet"));
    const g = await start(u.id, u.username, bet);
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mine:${u.id}:cash`).setLabel("💰 Cash Out").setStyle(ButtonStyle.Primary).setDisabled(true)
    );
    await interaction.reply({ embeds: [mineEmbed(g)], components: [...boardComponents(u.id, g), row] });
  } catch (e) {
    if (e instanceof MineError || e instanceof BetError) return void (await say(interaction, `❌ <@${u.id}> ${e.message}`));
    throw e;
  }
}
