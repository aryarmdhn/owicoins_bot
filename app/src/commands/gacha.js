import { EmbedBuilder } from "discord.js";
import { pull, InsufficientFunds } from "../services/gacha.js";
import { say, fmt, sleep, RARITY_EMOJI as EMOJI, RARITY_COLOR as COLOR } from "../lib/owo.js";

export const data = { name: "pull" };

const ORDER = ["Immortal", "Mythic", "Legendary", "Epic", "Rare", "Uncommon", "Common"];
const HIGH = new Set(["Legendary", "Mythic", "Immortal"]);
const SPIN_GIF = "https://cdn.discordapp.com/emojis/1537027077914624110.gif";
const COIN = "<:owicoin:1537023515927117874>";

function bestRarity(results) {
  return ORDER.find((rar) => results.some((c) => c.rarity === rar)) ?? "Common";
}

export async function execute(interaction) {
  const u = interaction.user;
  const count = interaction.options.getInteger("pulls") ?? 1;
  if (!Number.isInteger(count) || count < 1 || count > 10) {
    await say(interaction, `❌ <@${u.id}> pull count must be **1-10**!`);
    return;
  }
  const rolling = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("🎴 Rolling the gacha…")
    .setImage(SPIN_GIF)
    .setFooter({ text: "Gacha Bot" });
  const msg = await interaction.reply({ embeds: [rolling] });
  try {
    await sleep(1600);

    const r = await pull(u.id, u.username, count);
    const hasHigh = r.results.some((c) => HIGH.has(c.rarity));
    const react = hasHigh ? ["🎉", "✨"] : ["🎴"];

    const embed = new EmbedBuilder()
      .setColor(COLOR[bestRarity(r.results)])
      .setTitle(`🎴 Gacha Pull ${count > 1 ? `×${count}` : ""}`.trim())
      .setFooter({ text: "Gacha Bot" });

    if (count === 1) {
      const c = r.results[0];
      embed.setDescription(
        `${EMOJI[c.rarity]} **${c.name}**\n_${c.rarity}_${HIGH.has(c.rarity) ? " · 🎉 **RARE PULL!**" : ""}`
      );
    } else {
      const lines = r.results
        .slice()
        .sort((a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity))
        .map((c) => `${EMOJI[c.rarity]} **${c.name}** · _${c.rarity}_`)
        .join("\n");
      embed.setDescription(lines);
      if (hasHigh) embed.addFields({ name: "\u200b", value: "🎉 **RARE PULL!**" });
    }
    embed.addFields({ name: "\u200b", value: `${COIN} balance: **${fmt(r.balance)} OwiCoins**` });

    await (msg?.edit?.({ content: "", embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {}));
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
