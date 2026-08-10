import { sell, sellAll, NotEnoughItems, NoSuchItem, NoSuchTier, NothingToSell } from "../services/sell.js";
import { say, fmt } from "../lib/owo.js";

export const data = { name: "sell" };

export async function execute(interaction) {
  const u = interaction.user;
  const name = interaction.options.getString("collectible");
  const arg2 = interaction.options.getString("arg2");

  if (!name) {
    await say(interaction, `❌ <@${u.id}> usage: \`gsell "<item>" <qty>\` or \`gsell all [tier]\``);
    return;
  }

  try {
    if (name.toLowerCase() === "all") {
      const r = await sellAll(u.id, u.username, arg2 || null);
      const scope = arg2 ? ` (${arg2} and below)` : "";
      await say(interaction, `💸 <@${u.id}> sold **${fmt(r.soldCount)}** collectibles${scope} for **+${fmt(r.total)}** OwiCoins!\n💰 balance: **${fmt(r.balance)}**`, ["💰"]);
      return;
    }

    const qty = Number.isInteger(Number(arg2)) && Number(arg2) > 0 ? Number(arg2) : 1;
    const r = await sell(u.id, u.username, name, qty);
    await say(interaction, `💸 <@${u.id}> sold **${r.item.name} ×${r.qty}** for **+${fmt(r.total)}** OwiCoins!\n💰 balance: **${fmt(r.balance)}**`, ["💰"]);
  } catch (e) {
    if (e instanceof NoSuchItem) {
      await say(interaction, `❌ <@${u.id}> no collectible named "**${name}**"`);
      return;
    }
    if (e instanceof NoSuchTier) {
      await say(interaction, `❌ <@${u.id}> unknown tier "**${arg2}**" (common/uncommon/rare/epic/legendary/mythic/immortal)`);
      return;
    }
    if (e instanceof NothingToSell) {
      await say(interaction, `❌ <@${u.id}> nothing to sell there (empty or all locked in trades)`);
      return;
    }
    if (e instanceof NotEnoughItems) {
      await say(interaction, `❌ <@${u.id}> you don't have enough of that (some may be locked in a trade)`);
      return;
    }
    throw e;
  }
}
