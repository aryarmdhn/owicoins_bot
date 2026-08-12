import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { catalog } from "../repositories/collection.js";
import { getOrCreate } from "../repositories/users.js";
import { fmt, PET_EMOJI, iconFor, RARITY_COLOR as COLOR } from "../lib/owo.js";

export const data = { name: "collection" };

export async function render(ownerDiscordId, username, { page, rarity, category }) {
  const user = await getOrCreate(ownerDiscordId, username);
  const { item, page: cur, pages, total, owned } = await catalog(user.id, { page, rarity, category });

  if (!item) return { content: "📖 no collectibles match that filter~", embeds: [], components: [] };

  const petEmoji = PET_EMOJI[item.name] ?? null;
  const icon = iconFor(item.name, item.rarity);
  const rarityLabel = petEmoji ? `${petEmoji} ${item.rarity}` : item.rarity;
  const embed = new EmbedBuilder()
    .setColor(COLOR[item.rarity] ?? 0x5865f2)
    .setAuthor({ name: `📖 Collection · ${cur}/${total} · owned ${fmt(owned)}/${fmt(total)}` })
    .setTitle(`${item.owned ? "✅" : "❌"} ${icon} ${item.name}`)
    .setDescription(item.description || "_no description_")
    .addFields(
      { name: "Rarity", value: rarityLabel, inline: true },
      { name: "⚔️ Power", value: fmt(item.power), inline: true },
      { name: "Value", value: `<:owicoin:1537023515927117874> ${fmt(item.base_value)}`, inline: true }
    )
    .setFooter({ text: item.owned ? "You own this!" : "Not owned yet" });

  const id = (p) => `col:${ownerDiscordId}:${p}:${rarity ?? ""}:${category ?? ""}`;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(id(cur - 1)).setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(cur <= 1),
    new ButtonBuilder().setCustomId(id(cur + 1)).setLabel("▶").setStyle(ButtonStyle.Secondary).setDisabled(cur >= pages)
  );
  return { embeds: [embed], components: pages > 1 ? [row] : [] };
}

export async function execute(interaction) {
  const view = await render(interaction.user.id, interaction.user.username, {
    page: interaction.options.getInteger("page") ?? 1,
    rarity: interaction.options.getString("rarity") || null,
    category: interaction.options.getString("category") || null,
  });
  await interaction.reply(view);
}
