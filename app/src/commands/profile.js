import { EmbedBuilder } from "discord.js";
import pool from "../db/pool.js";
import { getOrCreate, findByDiscordId } from "../repositories/users.js";
import { fmt } from "../lib/owo.js";

export const data = { name: "profile" };

const RARITY_COLOR = 0xffb703;

function xpBar(xp, need) {
  const ratio = need > 0 ? Math.min(1, xp / need) : 0;
  const filled = Math.round(ratio * 12);
  return "▰".repeat(filled) + "▱".repeat(12 - filled) + ` ${Math.round(ratio * 100)}%`;
}

export async function execute(interaction) {
  const target = interaction.options.getUser("user") ?? interaction.user;
  const user =
    target.id === interaction.user.id
      ? await getOrCreate(target.id, target.username)
      : await findByDiscordId(target.id);

  if (!user) {
    await interaction.reply({ content: `😶 **${target.username}** hasn't played yet~` });
    return;
  }

  const [[inv]] = await pool.query(
    "SELECT COALESCE(SUM(i.quantity),0) AS count, COALESCE(SUM(i.quantity*c.base_value),0) AS value " +
      "FROM inventories i JOIN collectibles c ON c.id = i.collectible_id WHERE i.user_id = ?",
    [user.id]
  );

  const [[luck]] = await pool.query(
    "SELECT multiplier, UNIX_TIMESTAMP(expires_at) AS expires FROM user_luck WHERE user_id = ? AND (expires_at IS NULL OR expires_at > NOW())",
    [user.id]
  );

  const need = 100 * user.level;
  const embed = new EmbedBuilder()
    .setColor(RARITY_COLOR)
    .setAuthor({ name: `${user.username}'s profile`, iconURL: target.displayAvatarURL() })
    .setThumbnail(target.displayAvatarURL({ size: 256 }))
    .setDescription(`**Level ${user.level}**\n\`${xpBar(Number(user.xp), need)}\`\n${fmt(user.xp)} / ${fmt(need)} XP`)
    .addFields(
      { name: "<:owicoin:1537023515927117874> OwiCoins", value: fmt(user.coins), inline: true },
      { name: "🎴 Collectibles", value: fmt(inv.count), inline: true },
      { name: "Value", value: `<:owicoin:1537023515927117874> ${fmt(inv.value)}`, inline: true },
      { name: "🔥 Daily Streak", value: `${user.daily_streak} day(s)`, inline: true }
    );

  if (luck) {
    const until = luck.expires ? ` (until <t:${luck.expires}:R>)` : " (permanent)";
    embed.addFields({ name: "🍀 Active Luck", value: `×${Number(luck.multiplier)}${until}`, inline: true });
  }

  embed.setFooter({ text: "Gacha Bot" }).setTimestamp();

  await interaction.reply({ embeds: [embed] });
}
