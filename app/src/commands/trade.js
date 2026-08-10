import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { create, TradeError } from "../services/trade.js";
import { say, fmt } from "../lib/owo.js";

export const confirms = new Map();

export const data = { name: "trade" };

function side(itemName, qty, coins) {
  const parts = [];
  if (itemName) parts.push(`🎴 ${itemName} ×${qty}`);
  if (coins) parts.push(`💰 ${fmt(coins)} OwiCoins`);
  return parts.length ? parts.join(" + ") : "_nothing_";
}

export async function execute(interaction) {
  const u = interaction.user;
  const partner = interaction.options.getUser("user");
  const offer = {
    itemName: interaction.options.getString("offer_item") || null,
    qty: interaction.options.getInteger("offer_qty") ?? 1,
    coins: interaction.options.getInteger("offer_coins") ?? 0,
  };
  const request = {
    itemName: interaction.options.getString("request_item") || null,
    qty: interaction.options.getInteger("request_qty") ?? 1,
    coins: interaction.options.getInteger("request_coins") ?? 0,
  };
  if (!partner || partner.bot) {
    await say(interaction, `❌ <@${u.id}> tag a real user to trade with!`);
    return;
  }
  if (!offer.itemName && !offer.coins && !request.itemName && !request.coins) {
    await say(interaction, `❌ <@${u.id}> offer or request at least one thing~`);
    return;
  }

  try {
    const trade = await create(u, partner, offer, request);
    confirms.set(trade.id, { sender: false, receiver: false });

    const content =
      `🤝 **${trade.code}** — <@${u.id}> ↔ <@${partner.id}>\n` +
      `**${u.username}** gives: ${side(offer.itemName, offer.qty, offer.coins)}\n` +
      `**${partner.username}** gives: ${side(request.itemName, request.qty, request.coins)}\n` +
      `_both must confirm within 10 min_ ⏳`;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`trade:${trade.id}:confirm`).setLabel("Confirm").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`trade:${trade.id}:cancel`).setLabel("Cancel").setStyle(ButtonStyle.Danger)
    );
    await interaction.reply({ content, components: [row] });
  } catch (err) {
    if (err instanceof TradeError) {
      await say(interaction, `❌ <@${u.id}> ${err.message}`);
      return;
    }
    throw err;
  }
}
