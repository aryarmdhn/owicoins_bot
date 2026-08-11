import { pray, PrayLimit } from "../services/pray.js";
import { say, sayTemp, fmt } from "../lib/owo.js";

export const data = { name: "pray" };

export async function run(interaction) {
  const u = interaction.user;
  try {
    const r = await pray(u.id, u.username);
    const extra = r.coins > 0 ? ` **+${fmt(r.coins)} OwiCoins**` : "";
    const ext = r.extended ? " *(duration extended!)*" : "";
    const left = `\n_🙏 prays left today: ${r.left}/3_`;
    const react = r.blessing.kind === "none" ? [] : ["🙏"];
    await say(interaction, `🙏 <@${u.id}> prays…\n${r.blessing.text}${extra}${ext}${left}`, react);
  } catch (e) {
    if (e instanceof PrayLimit) {
      await sayTemp(interaction, `⏳ <@${u.id}> you've used all **3** prays today! come back <t:${Math.floor(e.nextAt.getTime() / 1000)}:R>`, e.nextAt.getTime() - Date.now());
      return;
    }
    throw e;
  }
}

export const execute = run;
