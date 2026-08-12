import { claim, OnCooldown } from "../services/daily.js";
import { DuplicateTransaction } from "../services/economy.js";
import { say, sayTemp, fmt, pick } from "../lib/owo.js";

export const data = { name: "daily" };

const LINES = [
  "🎁 here's your daily gift,",
  "💝 daily reward claimed by",
  "✨ another day, another reward for",
];

export async function execute(interaction) {
  const u = interaction.user;
  try {
    const r = await claim(u.id, u.username);
    const bonus = r.bonusPct ? ` *(+${r.bonusPct}% streak)*` : "";
    const react = r.streak >= 7 ? ["🔥"] : ["🎁"];
    await say(
      interaction,
      `${pick(LINES)} <@${u.id}>! **+${fmt(r.reward)}** OwiCoins${bonus} <:owicoin:1537023515927117874>\n🔥 streak: **${r.streak}** day(s) — balance: **${fmt(r.balance)}**`,
      react
    );
  } catch (e) {
    if (e instanceof OnCooldown) {
      await sayTemp(interaction, `⏳ <@${u.id}> you already claimed! come back <t:${Math.floor(e.nextAt.getTime() / 1000)}:R>`, e.nextAt.getTime() - Date.now());
      return;
    }
    if (e instanceof DuplicateTransaction) {
      await say(interaction, `⏳ <@${u.id}> you already claimed today~`);
      return;
    }
    throw e;
  }
}
