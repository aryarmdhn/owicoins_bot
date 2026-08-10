import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { view } from "../services/quests.js";
import { fmt } from "../lib/owo.js";

export const data = { name: "quest" };

export async function render(discordId, username, note = "") {
  const { list, allComplete, allClaimed } = await view(discordId, username);

  const lines = list.map((q) => {
    const mark = q.claimed ? "✅" : q.complete ? "🎁" : "⬜";
    return `${mark} **${q.name}** — ${q.desc} (${fmt(q.prog)}/${fmt(q.goal)}) · +${fmt(q.reward)}`;
  });

  const label = allClaimed ? "Claimed" : "Claim All";
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`quest:${discordId}:claim`)
      .setLabel(label)
      .setStyle(ButtonStyle.Success)
      .setDisabled(!allComplete || allClaimed)
  );

  const content = `📋 **${username}'s daily quests**${note ? `\n${note}` : ""}\n${lines.join("\n")}\n_resets daily_`;
  return { content, components: [row] };
}

export async function execute(interaction) {
  const payload = await render(interaction.user.id, interaction.user.username);
  await interaction.reply(payload);
}
