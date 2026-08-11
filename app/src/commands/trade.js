import { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } from "discord.js";
import pool from "../db/pool.js";
import { getOrCreate } from "../repositories/users.js";
import * as svc from "../services/tradesession.js";
import { say, fmt, RARITY_EMOJI as EMOJI } from "../lib/owo.js";

// kept for compatibility with older imports
export const confirms = new Map();

export const data = { name: "trade" };

async function inventoryOptions(discordId, username) {
  const user = await getOrCreate(discordId, username);
  const [rows] = await pool.query(
    `SELECT c.id, c.name, c.rarity, i.quantity FROM inventories i JOIN collectibles c ON c.id = i.collectible_id
     WHERE i.user_id = ? ORDER BY c.base_value DESC LIMIT 25`,
    [user.id]
  );
  return rows.map((r) => ({ label: `${r.name} (${r.rarity})`, description: `×${r.quantity} owned`, value: String(r.id) }));
}

function sideText(side) {
  const items = [...side.items.values()].map((i) => `${EMOJI[i.rarity] ?? ""} ${i.name} ×${i.qty}`);
  const parts = [...items];
  if (side.coins > 0) parts.push(`💰 ${fmt(side.coins)} OwiCoins`);
  return parts.length ? parts.join("\n") : "_nothing yet_";
}

export function panel(s) {
  const content =
    `🤝 **TRADE** · <@${s.a.user.id}> ↔ <@${s.b.user.id}>\n\n` +
    `**${s.a.user.username}** ${s.a.confirmed ? "✅" : ""} offers:\n${sideText(s.a)}\n\n` +
    `**${s.b.user.username}** ${s.b.confirmed ? "✅" : ""} offers:\n${sideText(s.b)}\n\n` +
    `_pick items from your dropdown, set coins, then both Confirm. changing anything resets confirmations._`;

  const rows = [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId(`ts:${s.id}:pick:a`).setPlaceholder(`${s.a.user.username} — add an item`).addOptions(s.optsA.length ? s.optsA : [{ label: "no items", value: "0" }]).setDisabled(!s.optsA.length)
    ),
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId(`ts:${s.id}:pick:b`).setPlaceholder(`${s.b.user.username} — add an item`).addOptions(s.optsB.length ? s.optsB : [{ label: "no items", value: "0" }]).setDisabled(!s.optsB.length)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ts:${s.id}:coins`).setLabel("💰 Set My Coins").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ts:${s.id}:clear`).setLabel("🗑️ Clear Mine").setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ts:${s.id}:confirm`).setLabel("Confirm").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ts:${s.id}:cancel`).setLabel("Cancel").setStyle(ButtonStyle.Danger)
    ),
  ];
  return { content, components: rows, allowedMentions: { parse: [] } };
}

export async function execute(interaction) {
  const u = interaction.user;
  const partner = interaction.options.getUser("user");
  if (!partner || partner.bot || partner.id === u.id) {
    await say(interaction, `❌ <@${u.id}> tag a real user to trade with!`);
    return;
  }

  const s = svc.create(u, partner);
  s.optsA = await inventoryOptions(u.id, u.username);
  s.optsB = await inventoryOptions(partner.id, partner.username);
  const msg = await interaction.reply({ content: `${partner}`, ...panel(s) });
  s.message = msg;
}
