import { render as renderInventory } from "../commands/inventory.js";
import { render as renderCollection } from "../commands/collection.js";
import { panel } from "../commands/trade.js";
import * as tsess from "../services/tradesession.js";
import { ModalBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import { render as renderQuest } from "../commands/quest.js";
import { claimAll } from "../services/quests.js";
import { render as renderAch } from "../commands/achievements.js";
import { claimReady } from "../services/achievements.js";
import * as mineSvc from "../services/mine.js";
import { boardComponents, mineEmbed } from "../commands/mine.js";
import * as bjSvc from "../services/blackjack.js";
import { render as renderBj, resultText as bjResult, flipReveal as bjFlipReveal } from "../commands/bj.js";
import * as crashSvc from "../services/crash.js";
import { EmbedBuilder } from "discord.js";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { fmt } from "./owo.js";
import { handleFight } from "./fighthandler.js";
import { decQ } from "./browsecontrols.js";
import pool from "../db/pool.js";

export async function handleButton(interaction) {
  const [kind, ...args] = interaction.customId.split(":");

  if (kind === "fight") {
    await handleFight(interaction, args);
    return;
  }

  if (kind === "ts") {
    await handleTradeSession(interaction, args);
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

  if (kind === "mine") {
    await handleMine(interaction, args);
    return;
  }

  if (kind === "bj") {
    await handleBlackjack(interaction, args);
    return;
  }

  if (kind === "crash") {
    await handleCrash(interaction, args);
    return;
  }

  const BROWSE = new Set(["inv", "col", "invsort", "colsort", "invrar", "colrar"]);
  if (BROWSE.has(kind)) {
    await handleBrowse(interaction, kind, args);
    return;
  }
}

async function renderBrowse(base, ownerId, username, opts) {
  return base === "inv"
    ? renderInventory(ownerId, ownerId, username, opts)
    : renderCollection(ownerId, username, opts);
}

async function handleBrowse(interaction, kind, args) {
  const base = kind.startsWith("inv") ? "inv" : "col";
  const ownerId = args[0];
  if (interaction.user.id !== ownerId) {
    await interaction.reply({ content: "This isn't yours.", ephemeral: true });
    return;
  }
  const sub = kind.slice(base.length); // "", "sort", "rar"

  let opts;
  if (sub === "sort") {
    const [, rarity, bq] = args;
    opts = { page: 1, rarity: rarity || null, sort: interaction.values[0], q: decQ(bq) };
  } else if (sub === "rar") {
    const [, sort, bq] = args;
    const chosen = interaction.values[0];
    opts = { page: 1, rarity: chosen === "all" ? null : chosen, sort: sort || null, q: decQ(bq) };
  } else {
    // nav button: base:owner:page:rarity:sort:bq
    const [, page, rarity, sort, bq] = args;
    opts = { page: Number(page), rarity: rarity || null, sort: sort || null, q: decQ(bq) };
  }

  const view = await renderBrowse(base, ownerId, interaction.user.username, opts);
  await interaction.update(view);
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

async function handleMine(interaction, [ownerId, action]) {
  if (interaction.user.id !== ownerId) {
    await interaction.reply({ content: "This isn't your game.", ephemeral: true });
    return;
  }
  const g = mineSvc.games.get(ownerId);

  if (action === "cash") {
    try {
      const r = await mineSvc.cashout(ownerId);
      const e = mineEmbed(g, { color: 0x57f287, note: `<:owicoin:1537023515927117874> <@${ownerId}> cashed out **${r.revealed}** gems at **×${r.mult.toFixed(2)}** → **+${fmt(r.payout)} OwiCoins**!\n<:owicoin:1537023515927117874> balance: **${fmt(r.balance)}**` });
      await interaction.update({ embeds: [e], components: boardComponents(ownerId, g, { reveal: true }), allowedMentions: { parse: [] } });
    } catch {
      await interaction.reply({ content: "No active game.", ephemeral: true });
    }
    return;
  }

  const idx = Number(action);
  if (!g) return void (await interaction.reply({ content: "No active game.", ephemeral: true }));
  const res = mineSvc.reveal(ownerId, idx);

  if (res.boom) {
    const e = mineEmbed(res.g, { color: 0xed4245, note: `💥 <@${ownerId}> hit a mine and lost **${fmt(res.g.bet)} OwiCoins**!` });
    await interaction.update({ embeds: [e], components: boardComponents(ownerId, res.g, { reveal: true }), allowedMentions: { parse: [] } });
    return;
  }

  if (res.cleared) {
    const win = await mineSvc.autoWin(res.g);
    const e = mineEmbed(res.g, { color: 0x57f287, note: `🏆 <@${ownerId}> cleared the whole board! **+${fmt(win.payout)} OwiCoins**!\n<:owicoin:1537023515927117874> balance: **${fmt(win.balance)}**` });
    await interaction.update({ embeds: [e], components: boardComponents(ownerId, res.g, { reveal: true }), allowedMentions: { parse: [] } });
    return;
  }

  const cashRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mine:${ownerId}:cash`).setEmoji("1537023515927117874").setLabel("Cash Out").setStyle(ButtonStyle.Primary).setDisabled(res.g.revealed.size === 0)
  );
  const note = res.star ? `🌟✨ **LUCKY STAR!** multiplier boosted **×${res.starMult}**! ✨🌟` : null;
  await interaction.update({ embeds: [mineEmbed(res.g, { note })], components: [...boardComponents(ownerId, res.g), cashRow] });
}

async function handleBlackjack(interaction, [ownerId, action]) {
  if (interaction.user.id !== ownerId) {
    await interaction.reply({ content: "This isn't your game.", ephemeral: true });
    return;
  }
  const name = interaction.user.username;
  try {
    const res = action === "hit" ? await bjSvc.hit(ownerId) : await bjSvc.stand(ownerId);
    if (res.done && action === "stand") {
      await interaction.update(renderBj(ownerId, name, res.g, { hideDealer: true }));
      await bjFlipReveal(interaction.message, ownerId, name, res.g, bjResult(res), res.outcome);
    } else if (res.done) {
      await interaction.update(renderBj(ownerId, name, res.g, { hideDealer: false, result: bjResult(res), outcome: res.outcome }));
    } else {
      await interaction.update(renderBj(ownerId, name, res.g));
    }
  } catch (e) {
    if (e instanceof bjSvc.BjError) {
      await interaction.reply({ content: "No active game.", ephemeral: true }).catch(() => {});
      return;
    }
    console.error("blackjack failed:", e);
    await interaction.reply({ content: "Something went wrong with the game.", ephemeral: true }).catch(() => {});
  }
}

async function handleCrash(interaction, [ownerId]) {
  if (interaction.user.id !== ownerId) {
    await interaction.reply({ content: "This isn't your game.", ephemeral: true });
    return;
  }
  const g = crashSvc.games.get(ownerId);
  if (!g || g.over) {
    await interaction.reply({ content: "No active game.", ephemeral: true }).catch(() => {});
    return;
  }
  try {
    const r = await crashSvc.cashout(ownerId, g.mult); // marks g.over, stops the loop
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle(`<:crash_3_cashout:1537094207460876288> Cashed out at ${r.mult.toFixed(2)}×`)
      .setDescription(`🎉 <@${ownerId}> won **+${fmt(r.payout - g.bet)} OwiCoins**!\n<:owicoin:1537023515927117874> balance: **${fmt(r.balance)}**\n_seed: \`${r.serverSeed}\`_`)
      .setFooter({ text: "Gacha Bot" });
    await interaction.update({ embeds: [embed], components: [], allowedMentions: { parse: [] } });
  } catch (e) {
    if (e instanceof crashSvc.CrashError) {
      await interaction.reply({ content: "Too late — it already crashed.", ephemeral: true }).catch(() => {});
      return;
    }
    console.error("crash failed:", e);
    await interaction.reply({ content: "Something went wrong with the game.", ephemeral: true }).catch(() => {});
  }
}

async function handleTradeSession(interaction, args) {
  const [id, action, sideKey] = args;
  const s = tsess.sessions.get(Number(id));
  if (!s || s.status !== "open") {
    if (interaction.isRepliable()) await interaction.reply({ content: "This trade is no longer active.", ephemeral: true }).catch(() => {});
    return;
  }
  const side = tsess.sideFor(s, interaction.user.id);
  if (!side) {
    await interaction.reply({ content: "You're not part of this trade.", ephemeral: true });
    return;
  }

  // coins modal submit
  if (interaction.isModalSubmit()) {
    const val = Number(interaction.fields.getTextInputValue("coins"));
    if (!Number.isInteger(val) || val < 0) {
      await interaction.reply({ content: "Enter a valid non-negative number.", ephemeral: true });
      return;
    }
    tsess.setCoins(s, interaction.user.id, val);
    await s.message?.edit?.(panel(s)).catch(() => {});
    await interaction.reply({ content: `✅ your coins set to ${val.toLocaleString()}`, ephemeral: true });
    return;
  }

  // item picker
  if (action === "pick") {
    if ((sideKey === "a" && s.a.user.id !== interaction.user.id) || (sideKey === "b" && s.b.user.id !== interaction.user.id)) {
      await interaction.reply({ content: "That's not your item picker.", ephemeral: true });
      return;
    }
    const cid = Number(interaction.values[0]);
    if (!cid) return void (await interaction.reply({ content: "No item.", ephemeral: true }));
    const [[item]] = await pool.query("SELECT id, name, rarity FROM collectibles WHERE id = ?", [cid]);
    const avail = await tsess.availableQty((await getUserId(interaction.user.id)), cid);
    const cur = side.items.get(cid)?.qty ?? 0;
    if (cur + 1 > avail) {
      await interaction.reply({ content: `You only have ${avail} of that available (rest locked).`, ephemeral: true });
      return;
    }
    tsess.addItem(s, interaction.user.id, item);
    await interaction.update(panel(s));
    return;
  }

  if (action === "coins") {
    const modal = new ModalBuilder().setCustomId(`ts:${id}:coinsModal`).setTitle("Set your OwiCoins offer");
    modal.addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId("coins").setLabel("Amount (0 to remove)").setStyle(TextInputStyle.Short).setRequired(true)
      )
    );
    await interaction.showModal(modal);
    return;
  }

  if (action === "clear") {
    side.items.clear();
    tsess.setCoins(s, interaction.user.id, 0);
    await interaction.update(panel(s));
    return;
  }

  if (action === "cancel") {
    s.status = "cancelled";
    tsess.sessions.delete(s.id);
    await interaction.update({ content: `❌ trade cancelled by **${interaction.user.username}**`, components: [] });
    return;
  }

  if (action === "confirm") {
    const both = tsess.confirm(s, interaction.user.id);
    if (!both) {
      await interaction.update(panel(s));
      return;
    }
    try {
      await tsess.execute(s);
      await interaction.update({ content: "✅ **trade complete!** items & coins exchanged 🎉", components: [] });
    } catch (e) {
      const msg = e instanceof tsess.TradeError ? e.message : "trade failed.";
      s.a.confirmed = false; s.b.confirmed = false;
      await interaction.update({ content: `❌ ${msg}`, ...panel(s) });
    }
    return;
  }
}

async function getUserId(discordId) {
  const [[u]] = await pool.query("SELECT id FROM users WHERE discord_id = ?", [discordId]);
  return u?.id;
}
