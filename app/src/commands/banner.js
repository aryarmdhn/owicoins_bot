import { pull, InsufficientFunds } from "../services/gacha.js";
import { getSetting } from "../services/settings.js";
import { say, fmt, RARITY_EMOJI as EMOJI } from "../lib/owo.js";

export const data = { name: "banner" };

const HIGH = new Set(["Legendary", "Mythic", "Immortal"]);

export async function execute(interaction) {
  const u = interaction.user;
  const season = await getSetting("banner.active", "");
  if (!season) {
    await say(interaction, `📅 <@${u.id}> no limited banner is active right now~`);
    return;
  }
  const count = interaction.options.getInteger("pulls") ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    await say(interaction, `❌ <@${u.id}> pull count must be **1-10**!`);
    return;
  }

  const msg = await interaction.reply({ content: `🎡 **${season} Banner** — pulling…` });
  try {
    const r = await pull(u.id, u.username, count, season);
    const hasHigh = r.results.some((c) => HIGH.has(c.rarity));
    let content;
    if (count === 1) {
      const c = r.results[0];
      const hype = c.is_limited ? " 🌟 **LIMITED!**" : "";
      content = `🎡 <@${u.id}> got ${EMOJI[c.rarity] ?? ""} **${c.name}** (${c.rarity})!${hype}\n<:owicoin:1537023515927117874> balance: **${fmt(r.balance)} OwiCoins**`;
    } else {
      const lines = r.results.map((c) => `${EMOJI[c.rarity] ?? ""} ${c.name}${c.is_limited ? " 🌟" : ""}`).join(" · ");
      content = `🎡 <@${u.id}> pulled **${count}×** on ${season}:\n${lines}\n<:owicoin:1537023515927117874> balance: **${fmt(r.balance)} OwiCoins**`;
    }
    await msg?.edit?.({ content, allowedMentions: { parse: [] } }).catch(() => {});
    if (hasHigh) for (const e of ["🎉", "✨"]) await msg?.react?.(e).catch(() => {});
  } catch (e) {
    if (e instanceof InsufficientFunds) {
      await msg?.edit?.({ content: `😔 <@${u.id}> not enough OwiCoins! need **${fmt(e.needed)}**, you have **${fmt(e.balance)}**`, allowedMentions: { parse: [] } }).catch(() => {});
      return;
    }
    throw e;
  }
}
