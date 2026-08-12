import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { catalog } from "../repositories/collection.js";
import { getOrCreate } from "../repositories/users.js";
import { fmt, PET_EMOJI, iconFor, RARITY_COLOR as COLOR } from "../lib/owo.js";

export const data = { name: "collection" };

export async function render(ownerDiscordId, username, { page, rarity, category, sort, q }) {
  const user = await getOrCreate(ownerDiscordId, username);
  const { rows, page: cur, pages, total, owned } = await catalog(user.id, { page, rarity, category, sort, q });

  if (!rows.length) return { content: "📖 no collectibles match that filter~", embeds: [], components: [] };

  const body = rows
    .map((c) => `${c.owned ? "✅" : "🔒"} ${iconFor(c.name, c.rarity)} **${c.name}** · _${c.rarity}_ · ⚔️ ${fmt(c.power)} · <:owicoin:1537023515927117874> ${fmt(c.base_value)}`)
    .join("\n");

  const bits = [`sort: ${sort ?? "value"}`];
  if (rarity) bits.push(`rarity: ${rarity}`);
  if (q) bits.push(`search: "${q}"`);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("📖 Collection")
    .setDescription(body)
    .setFooter({ text: `owned ${fmt(owned)}/${fmt(total)} · page ${cur}/${pages} · ${bits.join(" · ")}` });

  const id = (p) => `col:${ownerDiscordId}:${p}:${rarity ?? ""}:${category ?? ""}:${sort ?? ""}:${q ?? ""}`;
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(id(cur - 1)).setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(cur <= 1),
    new ButtonBuilder().setCustomId(id(cur + 1)).setLabel("▶").setStyle(ButtonStyle.Secondary).setDisabled(cur >= pages)
  );
  return { embeds: [embed], components: pages > 1 ? [row] : [] };
}

export async function execute(interaction) {
  const f = interaction.options.get("filters") ?? {};
  const view = await render(interaction.user.id, interaction.user.username, {
    page: f.page ?? 1,
    rarity: f.rarity ?? null,
    category: f.category ?? null,
    sort: f.sort ?? null,
    q: f.q ?? null,
  });
  await interaction.reply(view);
}
