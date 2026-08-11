import { Client, GatewayIntentBits, Events } from "discord.js";
import config from "./lib/config.js";
import { loadCommands } from "./lib/commands.js";
import { handleButton } from "./lib/buttons.js";
import { commandNames, tokenize, parseArgs } from "./lib/textparse.js";
import { makeInteraction } from "./lib/textadapter.js";

if (!config.discord.token || !config.discord.clientId) {
  console.error("Missing env: DISCORD_TOKEN / DISCORD_CLIENT_ID");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
const PREFIX = "g";
const commands = await loadCommands();
const textCommands = new Set(commandNames());

client.once(Events.ClientReady, (c) => {
  console.log(`Logged in as ${c.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isButton() || interaction.isStringSelectMenu() || interaction.isModalSubmit()) await handleButton(interaction);
  } catch (err) {
    console.error("interaction failed:", err);
    if (interaction.isRepliable() && !interaction.replied) {
      await interaction.reply({ content: "Something went wrong.", ephemeral: true }).catch(() => {});
    }
  }
});

const GLOBAL_COOLDOWN_MS = 5000;
const lastCommandAt = new Map();

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot || !message.content) return;
  const tokens = tokenize(message.content.trim());
  const first = tokens[0]?.toLowerCase();
  if (!first || !first.startsWith(PREFIX)) return;
  const name = first.slice(PREFIX.length);
  if (!textCommands.has(name)) return;

  const command = commands.get(name);
  if (!command) return;

  const last = lastCommandAt.get(message.author.id) ?? 0;
  const remaining = GLOBAL_COOLDOWN_MS - (Date.now() - last);
  if (remaining > 0) {
    const secs = Math.ceil(remaining / 1000);
    const warn = await message.reply(`⏳ whoop, slow down! try again in **${secs}** second${secs === 1 ? "" : "s"}!`).catch(() => null);
    setTimeout(() => warn?.delete?.().catch(() => {}), remaining);
    return;
  }
  lastCommandAt.set(message.author.id, Date.now());

  try {
    const args = parseArgs(name, tokens.slice(1), message);
    const interaction = makeInteraction(message, args);
    await command.execute(interaction);
  } catch (err) {
    console.error(`command ${name} failed:`, err);
    await message.reply("Something went wrong. Please try again.").catch(() => {});
  }
});

client.login(config.discord.token);
