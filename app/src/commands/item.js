import { EmbedBuilder } from "discord.js";
import pool from "../db/pool.js";
import { fmt, RARITY_EMOJI as EMOJI, RARITY_COLOR as COLOR } from "../lib/owo.js";

export const data = { name: "item" };

export async function execute(interaction) {
  const name = interaction.options.getString("collectible");
  if (!name) {
    await interaction.reply({ content: `❌ usage: \`gitem "<name>"\`` });
    return;
  }

  const [[c]] = await pool.query(
    "SELECT name, description, rarity, category, base_value, power, image_url FROM collectibles WHERE LOWER(name) = LOWER(?)",
    [name]
  );
  if (!c) {
    await interaction.reply({ content: `❌ no collectible named "**${name}**"` });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(COLOR[c.rarity] ?? 0x5865f2)
    .setTitle(`${EMOJI[c.rarity] ?? ""} ${c.name}`)
    .setDescription(c.description || "_no description_")
    .addFields(
      { name: "Rarity", value: c.rarity, inline: true },
      { name: "Category", value: c.category, inline: true },
      { name: "⚔️ Power", value: fmt(c.power), inline: true },
      { name: "💎 Value", value: fmt(c.base_value), inline: true }
    )
    .setFooter({ text: "Gacha Bot" });

  if (c.image_url) embed.setImage(c.image_url);
  await interaction.reply({ embeds: [embed] });
}
