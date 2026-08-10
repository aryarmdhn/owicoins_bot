import { getOrCreate } from "../repositories/users.js";
import { say, fmt } from "../lib/owo.js";

export const data = { name: "coins" };

export async function execute(interaction) {
  const u = interaction.user;
  const user = await getOrCreate(u.id, u.username);
  await say(interaction, `💰 <@${u.id}> you have **${fmt(user.coins)}** OwiCoins!`);
}
