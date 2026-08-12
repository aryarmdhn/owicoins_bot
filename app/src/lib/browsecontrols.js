import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from "discord.js";

export const SORTS = [
  { value: "value", label: "Value", emoji: "💰" },
  { value: "rarity", label: "Rarity", emoji: "✨" },
  { value: "power", label: "Power", emoji: "⚔️" },
  { value: "name", label: "Name", emoji: "🔤" },
];
export const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Immortal"];

export const encQ = (q) => (q ? Buffer.from(q).toString("base64url") : "");
export const decQ = (s) => (s ? Buffer.from(s, "base64url").toString() : null);

// build the sort/rarity/search + prev/next controls. kind = "inv" | "col".
export function controls(kind, ownerId, { page, pages, rarity, sort, q }) {
  const s = sort ?? "value";
  const bq = encQ(q);
  // nav customId: kind:owner:page:rarity:sort:bq
  const nav = (p) => `${kind}:${ownerId}:${p}:${rarity ?? ""}:${s}:${bq}`;

  const sortRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${kind}sort:${ownerId}:${rarity ?? ""}:${bq}`)
      .setPlaceholder(`Sort: ${s}`)
      .addOptions(SORTS.map((o) => ({ ...o, default: o.value === s })))
  );

  const rarRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${kind}rar:${ownerId}:${s}:${bq}`)
      .setPlaceholder(rarity ? `Rarity: ${rarity}` : "Rarity: all")
      .addOptions(
        { label: "All rarities", value: "all", default: !rarity },
        ...RARITIES.map((r) => ({ label: r, value: r, default: rarity?.toLowerCase() === r.toLowerCase() }))
      )
  );

  const btnRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(nav(Math.max(1, page - 1))).setLabel("◀").setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(nav(Math.min(pages, page + 1))).setLabel("▶").setStyle(ButtonStyle.Secondary).setDisabled(page >= pages)
  );

  return [sortRow, rarRow, btnRow];
}
