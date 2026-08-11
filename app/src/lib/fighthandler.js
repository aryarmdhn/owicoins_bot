import { ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { fights } from "../commands/fight.js";
import * as svc from "../services/fight.js";
import { fmt } from "./owo.js";

export async function handleFight(interaction, [fightId, action]) {
  const id = Number(fightId);
  const f = fights.get(id);
  if (!f || f.status === "done") {
    await interaction.reply({ content: "This duel is no longer active.", ephemeral: true });
    return;
  }

  if (action === "accept" || action === "reject") {
    if (interaction.user.id !== f.opponent.id) {
      await interaction.reply({ content: "Only the challenged user can respond.", ephemeral: true });
      return;
    }
    if (action === "reject") {
      f.status = "done";
      fights.delete(id);
      await interaction.update({ content: `🛡️ <@${f.opponent.id}> declined the duel.`, components: [], allowedMentions: { parse: [] } });
      return;
    }
    f.status = "picking";
    f.message = interaction.message;
    const [itemsA, itemsB] = await Promise.all([
      svc.ownedCollectibles(f.challenger.id),
      svc.ownedCollectibles(f.opponent.id),
    ]);
    if (!itemsA.length || !itemsB.length) {
      const who = !itemsA.length ? f.challenger : f.opponent;
      f.status = "done";
      fights.delete(id);
      await interaction.update({ content: `❌ <@${who.id}> has no collectible to fight with! duel cancelled.`, components: [], allowedMentions: { parse: [] } });
      return;
    }
    await interaction.update({
      content:
        `⚔️ **DUEL** · <@${f.challenger.id}> vs <@${f.opponent.id}> · bet **${fmt(f.bet)} OwiCoins**\n` +
        `🐾 each of you, pick your fighter below!\n` +
        `_higher power = better odds, but **not** a sure win — the stronger fighter can still lose!_`,
      components: [pickMenu(id, "a", itemsA), pickMenu(id, "b", itemsB)],
      allowedMentions: { parse: [] },
    });
    return;
  }

  if (action === "pick") {
    const side = interaction.customId.split(":")[3];
    const who = side === "a" ? f.challenger : f.opponent;
    if (interaction.user.id !== who.id) {
      await interaction.reply({ content: "That's not your picker.", ephemeral: true });
      return;
    }
    const collectibleId = Number(interaction.values[0]);
    const info = await svc.powerOf(collectibleId);
    if (!info) {
      await interaction.reply({ content: "That fighter no longer exists.", ephemeral: true });
      return;
    }
    f.picks[side] = { name: info.name, power: info.power };
    await interaction.reply({ content: `✅ you sent out **${info.name}** (⚔️ ${fmt(info.power)} power)! waiting for your opponent…`, ephemeral: true });

    const aReady = !!f.picks.a;
    const bReady = !!f.picks.b;
    if (aReady && bReady) {
      await finish(id);
    } else {
      await f.message?.edit?.({
        content:
          `⚔️ **DUEL** · <@${f.challenger.id}> ${aReady ? "✅ ready" : "⏳ choosing…"} vs ${bReady ? "✅ ready" : "⏳ choosing…"} <@${f.opponent.id}>\n` +
          `bet **${fmt(f.bet)} OwiCoins** · waiting for both fighters…`,
        allowedMentions: { parse: [] },
      }).catch(() => {});
    }
  }
}

function pickMenu(id, side, items) {
  const options = items.slice(0, 25).map((c) => ({
    label: `${c.name} — ⚔️ ${c.power} power`,
    description: `${c.rarity} · higher power = better odds`,
    value: String(c.id),
  }));
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`fight:${id}:pick:${side}`)
      .setPlaceholder(`${side === "a" ? "Challenger" : "Opponent"} — choose your fighter`)
      .addOptions(options)
  );
}

async function finish(id) {
  const f = fights.get(id);
  if (!f || f.status === "done") return;
  f.status = "done";

  const pa = f.picks.a?.power ?? 0;
  const pb = f.picks.b?.power ?? 0;
  const na = f.picks.a?.name ?? "_no pick_";
  const nb = f.picks.b?.name ?? "_no pick_";

  if (pa === 0 && pb === 0) {
    fights.delete(id);
    await f.message?.edit?.({ content: "⌛ nobody picked a fighter — duel cancelled.", components: [] }).catch(() => {});
    return;
  }

  const total = pa + pb;
  const oddsA = total > 0 ? Math.round((pa / total) * 100) : 50;
  const oddsB = 100 - oddsA;

  const { winner, aWins } = await svc.resolve(f.challenger, f.opponent, f.bet, pa, pb);
  fights.delete(id);

  const upset = (aWins && pa < pb) || (!aWins && pb < pa);
  const text =
    `⚔️ **DUEL RESULT**\n` +
    `${aWins ? "👑" : "💀"} **${na}** ⚔️${fmt(pa)} · ${oddsA}% odds — <@${f.challenger.id}>\n` +
    `${aWins ? "💀" : "👑"} **${nb}** ⚔️${fmt(pb)} · ${oddsB}% odds — <@${f.opponent.id}>\n` +
    (upset ? `😱 **UPSET!** the underdog pulled it off!\n` : "") +
    `🏆 <@${winner.id}> wins **+${fmt(f.bet)} OwiCoins**! 🎉`;
  await f.message?.edit?.({ content: text, components: [], allowedMentions: { parse: [] } }).catch(() => {});
}
