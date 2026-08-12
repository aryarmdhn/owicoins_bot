import { EmbedBuilder } from "discord.js";
import { list } from "../repositories/inventory.js";
import { getOrCreate } from "../repositories/users.js";
import { fmt, iconFor } from "../lib/owo.js";
import { controls } from "../lib/browsecontrols.js";

export const data = { name: "inventory" };

export async function render(userId, ownerDiscordId, username, { page, rarity, category, sort, q }) {
  const user = await getOrCreate(ownerDiscordId, username);
  const { rows, page: cur, pages, total } = await list(user.id, { page, rarity, category, sort, q });

  const body = rows.length
    ? rows.map((r) => `${iconFor(r.name, r.rarity)} **${r.name}** ×${r.quantity} · ⚔️ ${fmt(r.power)} · <:owicoin:1537023515927117874> ${fmt(r.base_value)}`).join("\n")
    : "empty~ try `gpull 1` 🎴";

  const bits = [`sort: ${sort ?? "value"}`];
  if (rarity) bits.push(`rarity: ${rarity}`);
  if (q) bits.push(`search: "${q}"`);

  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle(`🎒 ${username}'s collection`)
    .setDescription(body)
    .setFooter({ text: `${fmt(total)} item(s) · page ${cur}/${pages} · ${bits.join(" · ")}` });

  const comps = controls("inv", ownerDiscordId, { page: cur, pages, rarity, sort, q });
  return { content: "", embeds: [embed], attachments: [], files: [], components: comps };
}

export async function execute(interaction) {
  const f = interaction.options.get("filters") ?? {};
  const view = await render(interaction.user.id, interaction.user.id, interaction.user.username, {
    page: f.page ?? 1,
    rarity: f.rarity ?? null,
    category: f.category ?? null,
    sort: f.sort ?? null,
    q: f.q ?? null,
  });
  await interaction.reply(view);
}
