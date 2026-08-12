import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { list } from "../repositories/inventory.js";
import { getOrCreate } from "../repositories/users.js";
import { fmt, iconFor } from "../lib/owo.js";

export const data = { name: "inventory" };

export async function render(userId, ownerDiscordId, username, { page, rarity, category }) {
  const user = await getOrCreate(ownerDiscordId, username);
  const { rows, page: cur, pages, total } = await list(user.id, { page, rarity, category });

  const body = rows.length
    ? rows.map((r) => `${iconFor(r.name, r.rarity)} **${r.name}** ×${r.quantity} · ⚔️ ${fmt(r.power)} · <:owicoin:1537023515927117874> ${fmt(r.base_value)}`).join("\n")
    : "empty~ try `gpull 1` 🎴";

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🎒 ${username}'s collection`)
    .setDescription(body)
    .setFooter({ text: `${fmt(total)} item(s) · page ${cur}/${pages}` });

  const id = (p) => `inv:${ownerDiscordId}:${p}:${rarity ?? ""}:${category ?? ""}`;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(id(cur - 1)).setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(cur <= 1),
    new ButtonBuilder().setCustomId(id(cur + 1)).setLabel("▶").setStyle(ButtonStyle.Secondary).setDisabled(cur >= pages)
  );
  return { content: "", embeds: [embed], attachments: [], files: [], components: pages > 1 ? [row] : [] };
}

export async function execute(interaction) {
  const view = await render(interaction.user.id, interaction.user.id, interaction.user.username, {
    page: interaction.options.getInteger("page") ?? 1,
    rarity: interaction.options.getString("rarity") || null,
    category: interaction.options.getString("category") || null,
  });
  await interaction.reply(view);
}
