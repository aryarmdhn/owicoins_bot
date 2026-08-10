import { SlashCommandBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
  .setName("ping")
  .setDescription("Check bot & database health.");

export async function execute(interaction) {
  const { default: pool } = await import("../db/pool.js");
  await pool.query("SELECT 1");
  await interaction.reply({
    content: `Pong. Latency ${interaction.client.ws.ping}ms. DB ok.`,
    ephemeral: true,
  });
}
