import { EmbedBuilder } from "discord.js";
import { react, ACTIONS } from "../services/react.js";

export function reactCommand(action) {
  const meta = ACTIONS[action];
  return {
    data: { name: action },
    async execute(interaction) {
      const u = interaction.user;
      const target = interaction.options.getUser("user");
      if (!target || target.id === u.id) {
        await interaction.reply({ content: `${meta.emoji} <@${u.id}> tag someone! contoh: \`g${action} @user\` → **${u.username} ${meta.verb} @user**` });
        return;
      }
      const { url, count } = await react(action, target);
      const line = `**${u.username}** ${meta.verb} **${target.username}** ${meta.emoji}`;
      const footer = meta.counted && count ? `${target.username} has been ${action}ed ${count} time${count === 1 ? "" : "s"}` : null;
      if (!url) {
        await interaction.reply({ content: footer ? `${line}\n_${footer}_` : line });
        return;
      }
      const embed = new EmbedBuilder().setColor(0xff9ecb).setDescription(line).setImage(url);
      if (footer) embed.setFooter({ text: footer });
      await interaction.reply({ embeds: [embed] });
    },
  };
}
