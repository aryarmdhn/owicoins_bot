import { getOrCreate, findByDiscordId } from "../repositories/users.js";
import { say, fmt } from "../lib/owo.js";

export const data = { name: "stats" };

export async function execute(interaction) {
  const target = interaction.options.getUser("user") ?? interaction.user;
  const user =
    target.id === interaction.user.id
      ? await getOrCreate(target.id, target.username)
      : await findByDiscordId(target.id);

  if (!user) {
    await say(interaction, `😶 **${target.username}** hasn't played yet~`);
    return;
  }

  const w = user.fight_wins ?? 0;
  const l = user.fight_losses ?? 0;
  const total = w + l;
  const rate = total ? Math.round((w / total) * 100) : 0;
  const s = user.fight_streak ?? 0;
  const streak = s > 0 ? `🔥 ${s} win streak` : s < 0 ? `💀 ${-s} loss streak` : "—";

  await say(
    interaction,
    `⚔️ **${user.username}'s fight stats**\n` +
      `🏆 wins: **${fmt(w)}** · 💀 losses: **${fmt(l)}** · 📊 winrate: **${rate}%**\n` +
      `streak: ${streak}`
  );
}
