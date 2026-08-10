import { render as renderInventory } from "../commands/inventory.js";
import { render as renderCollection } from "../commands/collection.js";
import { confirms } from "../commands/trade.js";
import { render as renderQuest } from "../commands/quest.js";
import { claimAll } from "../services/quests.js";
import { render as renderAch } from "../commands/achievements.js";
import { claimReady } from "../services/achievements.js";
import * as tradeSvc from "../services/trade.js";
import { fmt } from "./owo.js";
import { handleFight } from "./fighthandler.js";
import pool from "../db/pool.js";

export async function handleButton(interaction) {
  const [kind, ...args] = interaction.customId.split(":");

  if (kind === "fight") {
    await handleFight(interaction, args);
    return;
  }

  if (kind === "trade") {
    await handleTrade(interaction, args);
    return;
  }

  if (kind === "quest") {
    await handleQuest(interaction, args);
    return;
  }

  if (kind === "ach") {
    await handleAchievement(interaction, args);
    return;
  }

  if (kind === "inv" || kind === "col") {
    const [ownerId, page, rarity, category] = args;
    if (interaction.user.id !== ownerId) {
      await interaction.reply({ content: "This isn't yours.", ephemeral: true });
      return;
    }
    const opts = { page: Number(page), rarity: rarity || null, category: category || null };
    const view =
      kind === "inv"
        ? await renderInventory(interaction.user.id, ownerId, interaction.user.username, opts)
        : await renderCollection(ownerId, interaction.user.username, opts);
    await interaction.update(view);
  }
}

async function handleTrade(interaction, [tradeId, action]) {
  const id = Number(tradeId);
  const [[t]] = await pool.query("SELECT sender_id, receiver_id, status FROM trades WHERE id = ?", [id]);
  const [[me]] = await pool.query("SELECT id FROM users WHERE discord_id = ?", [interaction.user.id]);
  if (!t || !me || (me.id !== t.sender_id && me.id !== t.receiver_id)) {
    await interaction.reply({ content: "This isn't your trade.", ephemeral: true });
    return;
  }
  if (t.status !== "pending" && t.status !== "confirmed") {
    await interaction.update({ components: [] }).catch(() => {});
    return;
  }

  if (action === "cancel") {
    await tradeSvc.setStatus(id, "cancelled");
    confirms.delete(id);
    await interaction.update({ content: `❌ trade cancelled by **${interaction.user.username}**`, components: [] });
    return;
  }

  const state = confirms.get(id) ?? { sender: false, receiver: false };
  if (me.id === t.sender_id) state.sender = true;
  else state.receiver = true;
  confirms.set(id, state);

  if (!(state.sender && state.receiver)) {
    await interaction.reply({ content: "Confirmed. Waiting for the other party…", ephemeral: true });
    return;
  }

  await tradeSvc.setStatus(id, "confirmed");
  try {
    await tradeSvc.execute(id);
    confirms.delete(id);
    await interaction.update({ content: "✅ **trade complete!** items & coins exchanged 🎉", components: [] });
  } catch (e) {
    confirms.delete(id);
    const msg = e instanceof tradeSvc.TradeError ? e.message : "trade failed.";
    await interaction.update({ content: `❌ ${msg}`, components: [] });
  }
}

async function handleQuest(interaction, [ownerId]) {
  if (interaction.user.id !== ownerId) {
    await interaction.reply({ content: "These aren't your quests.", ephemeral: true });
    return;
  }
  const { claimed, total } = await claimAll(interaction.user.id, interaction.user.username);
  const note = claimed.length ? `🎉 claimed **${claimed.length}** quests! +**${fmt(total)}** OwiCoins` : "";
  const view = await renderQuest(interaction.user.id, interaction.user.username, note);
  await interaction.update(view);
}

async function handleAchievement(interaction, [ownerId]) {
  if (interaction.user.id !== ownerId) {
    await interaction.reply({ content: "These aren't your achievements.", ephemeral: true });
    return;
  }
  const { claimed, total } = await claimReady(interaction.user.id, interaction.user.username);
  const note = claimed.length ? `🎉 claimed **${claimed.length}**! +**${fmt(total)}** OwiCoins` : "";
  const view = await renderAch(interaction.user.id, interaction.user.username, note);
  await interaction.update(view);
}
