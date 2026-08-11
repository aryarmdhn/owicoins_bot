import { pray } from "../services/pray.js";
import { OnCooldown } from "../services/daily.js";
import { say, sayTemp, fmt } from "../lib/owo.js";

export const data = { name: "pray" };

export async function run(interaction) {
  const u = interaction.user;
  try {
    const r = await pray(u.id, u.username);
    const extra = r.coins > 0 ? ` **+${fmt(r.coins)} OwiCoins**` : "";
    const react = r.blessing.kind === "none" ? [] : ["🙏"];
    await say(interaction, `🙏 <@${u.id}> prays…\n${r.blessing.text}${extra}`, react);
  } catch (e) {
    if (e instanceof OnCooldown) {
      await sayTemp(interaction, `⏳ <@${u.id}> you already prayed! come back <t:${Math.floor(e.nextAt.getTime() / 1000)}:R>`, e.nextAt.getTime() - Date.now());
      return;
    }
    throw e;
  }
}

export const execute = run;
