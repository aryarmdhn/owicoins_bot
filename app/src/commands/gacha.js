import { pull, InsufficientFunds } from "../services/gacha.js";
import { say, fmt, sleep, RARITY_EMOJI as EMOJI } from "../lib/owo.js";

export const data = { name: "pull" };

const HIGH = new Set(["Legendary", "Mythic", "Immortal"]);
const SPIN = ["🎰", "🎲", "✨", "🎁"];
const edit = (msg, content) => msg?.edit?.({ content, allowedMentions: { parse: [] } }).catch(() => {});

export async function execute(interaction) {
  const u = interaction.user;
  const count = interaction.options.getInteger("pulls") ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    await say(interaction, `❌ <@${u.id}> pull count must be **1-10**!`);
    return;
  }
  const msg = await interaction.reply({ content: `${SPIN[0]} rolling the gacha…` });
  try {
    for (let i = 1; i < SPIN.length; i++) {
      await sleep(420);
      await edit(msg, `${SPIN[i]} ${"◆".repeat(i)}${"◇".repeat(SPIN.length - i)} rolling…`);
    }
    await sleep(450);

    const r = await pull(u.id, u.username, count);
    const hasHigh = r.results.some((c) => HIGH.has(c.rarity));
    const react = hasHigh ? ["🎉", "✨"] : ["🎴"];

    let content;
    if (count === 1) {
      const c = r.results[0];
      const hype = HIGH.has(c.rarity) ? " 🎉 **RARE PULL!**" : "";
      content = `🎴 <@${u.id}> got ${EMOJI[c.rarity]} **${c.name}** (${c.rarity})!${hype}\n💰 balance: **${fmt(r.balance)} OwiCoins**`;
    } else {
      const lines = r.results.map((c) => `${EMOJI[c.rarity]} ${c.name}`).join(" · ");
      content = `🎴 <@${u.id}> pulled **${count}×**:\n${lines}\n💰 balance: **${fmt(r.balance)} OwiCoins**`;
    }

    await (msg?.edit?.({ content, allowedMentions: { parse: [] } }).catch(() => {}));
    for (const emoji of react) await msg?.react?.(emoji).catch(() => {});
  } catch (e) {
    if (e instanceof InsufficientFunds) {
      await (msg?.edit?.({ content: `😔 <@${u.id}> not enough OwiCoins! need **${fmt(e.needed)}**, you have **${fmt(e.balance)}**`, allowedMentions: { parse: [] } }).catch(() => {}));
      return;
    }
    await (msg?.edit?.({ content: "❌ something went wrong~" }).catch(() => {}));
    throw e;
  }
}
