import { send, SendError, SendLimit, InsufficientFunds } from "../services/send.js";
import { say, fmt } from "../lib/owo.js";

export const data = { name: "send" };

export async function execute(interaction) {
  const u = interaction.user;
  const target = interaction.options.getUser("user");
  const amount = interaction.options.getInteger("amount");

  if (!target) {
    await say(interaction, `❌ <@${u.id}> tag someone to send OwiCoins to!`);
    return;
  }
  try {
    const r = await send(u, target, amount);
    await say(interaction, `💸 <@${u.id}> sent **${fmt(amount)}** OwiCoins to <@${target.id}>!\n💰 your balance: **${fmt(r.balance)}**\n_📤 sends left today: ${r.sendsLeft}/3 · ${fmt(r.totalLeft)} OwiCoins left_`, ["💰"]);
  } catch (e) {
    if (e instanceof InsufficientFunds) {
      await say(interaction, `😔 <@${u.id}> not enough OwiCoins! you have **${fmt(e.balance)}**`);
      return;
    }
    if (e instanceof SendLimit) {
      await say(interaction, `⏳ <@${u.id}> ${e.message}`);
      return;
    }
    if (e instanceof SendError) {
      await say(interaction, `❌ <@${u.id}> ${e.message}`);
      return;
    }
    throw e;
  }
}
