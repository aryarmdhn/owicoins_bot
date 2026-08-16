import { beg, OnCooldown } from "../services/beg.js";
import { say, sayTemp, fmt } from "../lib/owo.js";

export const data = { name: "beg" };

export async function execute(interaction) {
  const u = interaction.user;
  try {
    const r = await beg(u.id, u.username);
    const gain = r.coins > 0 ? `\n<:owicoin:1537023515927117874> **+${fmt(r.coins)} OwiCoins**` : "";
    await say(interaction, `🥺 <@${u.id}> ngemis di pinggir jalan…\n${r.text}${gain}`);
  } catch (e) {
    if (e instanceof OnCooldown) {
      await sayTemp(interaction, `⏳ <@${u.id}> capek ngemis mulu, istirahat dulu! coba lagi <t:${Math.floor(e.nextAt.getTime() / 1000)}:R>`, e.nextAt.getTime() - Date.now());
      return;
    }
    throw e;
  }
}
