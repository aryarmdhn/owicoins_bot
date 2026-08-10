import { say } from "../lib/owo.js";

export const data = { name: "help" };

const HELP = [
  "🎴 **Gacha Bot — commands** (prefix `g`)",
  "`gdaily` — claim daily reward 🎁",
  "`gwork` — work for OwiCoins 💼",
  "`gcoins` — check your balance 💰",
  "`gpull <1-10>` — gacha pull 🎴",
  "`gbanner <1-10>` — pull limited banner 🎡",
  "`gboss` — attack the world boss ☠️",
  "`ginventory` — your collectibles 🎒",
  "`gcollection` — all collectibles 📖",
  '`gitem "<name>"` — item detail + image 🖼️',
  '`gfuse "<item>"` — fuse 3 duplicates → higher tier 🔮',
  "`gsell \"<item>\" <qty>` — sell for OwiCoins 💸",
  "`gsell all [tier]` — sell everything / tier & below 🧹",
  "`gleaderboard <richest|collection|value|level|fighter>` — top players 🏆",
  '`gtrade @user "<item>" <qty> <coins> "<item>" <qty> <coins>` — trade 🤝',
  "`gfight @user <bet>` — duel for OwiCoins ⚔️",
  "`gstats [@user]` — fight stats 📊",
  "`gachievements` — view & claim rewards 🏅",
  "`gquest` — daily quests & rewards 📋",
  "`gsend @user <amount>` — send OwiCoins 💸",
  "`gcf <bet> [h|t]` — 50/50 flip (side optional) 🪙",
  "`gdice <bet>` — roll vs house 🎲",
  "`gslots <bet>` — spin the slots 🎰",
  "`gspin` — daily lucky wheel 🎡",
  "`gprofile [@user]` — view profile 👤",
].join("\n");

export async function execute(interaction) {
  await say(interaction, HELP);
}
