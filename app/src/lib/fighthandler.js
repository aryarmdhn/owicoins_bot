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
      content: `⚔️ duel accepted! <@${f.challenger.id}> vs <@${f.opponent.id}> — bet **${fmt(f.bet)} OwiCoins**\n🐾 both pick your fighter to begin!`,
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
    await interaction.reply({ content: `✅ you chose **${info.name}** (power ${fmt(info.power)})`, ephemeral: true });
    if (f.picks.a && f.picks.b) {
      await finish(id);
    }
  }
}

function pickMenu(id, side, items) {
  const options = items.slice(0, 25).map((c) => ({
    label: `${c.name} · ⚔️${c.power}`,
    description: `${c.rarity} · ×${c.quantity} owned`,
    value: String(c.id),
  }));
  return new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`fight:${id}:pick:${side}`)
      .setPlaceholder(`fighter #${side.toUpperCase()}`)
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

  const { winner, aWins } = await svc.resolve(f.challenger, f.opponent, f.bet, pa, pb);
  fights.delete(id);
  const text =
    `⚔️ **DUEL RESULT**\n` +
    `${aWins ? "👑" : "💀"} ${na} (${fmt(pa)}) — <@${f.challenger.id}>\n` +
    `${aWins ? "💀" : "👑"} ${nb} (${fmt(pb)}) — <@${f.opponent.id}>\n` +
    `🏆 <@${winner.id}> wins **+${fmt(f.bet)} OwiCoins**! 🎉`;
  await f.message?.edit?.({ content: text, components: [], allowedMentions: { parse: [] } }).catch(() => {});
}
