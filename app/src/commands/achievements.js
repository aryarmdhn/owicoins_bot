import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { view } from "../services/achievements.js";
import { fmt } from "../lib/owo.js";

export const data = { name: "achievements" };

export async function render(discordId, username, note = "") {
  const { list, claimable } = await view(discordId, username);

  const lines = list.map((a) => {
    const mark = a.claimed ? "✅" : a.complete ? "🎁" : "⬜";
    const prog = a.complete ? "" : ` (${fmt(a.prog)}/${fmt(a.goal)})`;
    return `${mark} **${a.name}** — ${a.desc}${prog} · +${fmt(a.reward)}`;
  });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ach:${discordId}:claim`)
      .setLabel(claimable ? "Claim Rewards" : "Nothing to Claim")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!claimable)
  );

  const content = `🏅 **${username}'s achievements**${note ? `\n${note}` : ""}\n${lines.join("\n")}`;
  return { content, components: [row] };
}

export async function execute(interaction) {
  const payload = await render(interaction.user.id, interaction.user.username);
  await interaction.reply(payload);
}
