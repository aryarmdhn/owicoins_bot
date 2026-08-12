import { work } from "../services/work.js";
import { OnCooldown } from "../services/daily.js";
import { say, sayTemp, fmt, pick } from "../lib/owo.js";

export const data = { name: "work" };

const LINES = [
  "💼 you worked hard as a",
  "🛠️ nice shift as a",
  "⚡ hustle complete! you were a",
];

export async function execute(interaction) {
  const u = interaction.user;
  try {
    const r = await work(u.id, u.username);
    await say(
      interaction,
      `${pick(LINES)} **${r.job}** and earned **+${fmt(r.reward)}** OwiCoins <:owicoin:1537023515927117874>\n<@${u.id}> balance: **${fmt(r.balance)}**`,
      ["💪"]
    );
  } catch (e) {
    if (e instanceof OnCooldown) {
      await sayTemp(interaction, `😴 <@${u.id}> you're tired! work again <t:${Math.floor(e.nextAt.getTime() / 1000)}:R>`, e.nextAt.getTime() - Date.now());
      return;
    }
    throw e;
  }
}
