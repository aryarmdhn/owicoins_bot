import { spin } from "../services/spin.js";
import { OnCooldown } from "../services/daily.js";
import { say, sayTemp, iconFor } from "../lib/owo.js";

export const data = { name: "spin" };

export async function execute(interaction) {
  const u = interaction.user;
  try {
    const r = await spin(u.id, u.username);
    const prize = r.item
      ? `${iconFor(r.item.name, r.item.rarity)} **${r.item.name}** (${r.item.rarity})!`
      : `**${r.prize.label}**`;
    await say(interaction, `🎡 <@${u.id}> spun the daily wheel and won ${prize}`, ["🎡"]);
  } catch (e) {
    if (e instanceof OnCooldown) {
      await sayTemp(interaction, `⏳ <@${u.id}> already spun today! come back <t:${Math.floor(e.nextAt.getTime() / 1000)}:R>`, e.nextAt.getTime() - Date.now());
      return;
    }
    throw e;
  }
}
