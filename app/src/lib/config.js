if (!process.env.DB_PASSWORD) {
  console.error("Missing env: DB_PASSWORD");
  process.exit(1);
}

export default {
  discord: {
    token: process.env.DISCORD_TOKEN,
    clientId: process.env.DISCORD_CLIENT_ID,
    guildId: process.env.GUILD_ID || null,
  },
  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_DATABASE || "gacha",
    user: process.env.DB_USERNAME || "gacha",
    password: process.env.DB_PASSWORD,
  },
};
