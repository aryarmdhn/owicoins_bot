import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { start, BjError, handValue } from "../services/blackjack.js";
import { resolveBet, BetError } from "../services/gamble.js";
import { say, fmt } from "../lib/owo.js";

export const data = { name: "bj" };

const NAME = { 1: "A", 11: "J", 12: "Q", 13: "K" };
const card = (c) => NAME[c] ?? String(c);
const hand = (cards) => cards.map(card).join(" ");

export function render(discordId, g, { hideDealer = true, result = null } = {}) {
  const dealerShow = hideDealer ? `${card(g.dealer[0])} ?` : `${hand(g.dealer)} (${handValue(g.dealer)})`;
  let content =
    `🃏 **BLACKJACK** · bet **${fmt(g.bet)} OwiCoins**\n` +
    `🧑 you: **${hand(g.player)}** (${handValue(g.player)})\n` +
    `🤖 dealer: **${dealerShow}**`;
  if (result) content += `\n${result}`;

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bj:${discordId}:hit`).setLabel("Hit").setStyle(ButtonStyle.Success).setDisabled(g.over),
    new ButtonBuilder().setCustomId(`bj:${discordId}:stand`).setLabel("Stand").setStyle(ButtonStyle.Danger).setDisabled(g.over)
  );
  return { content, components: g.over ? [] : [buttons] };
}

export function resultText(o) {
  const map = {
    blackjack: `🎉 **BLACKJACK!** you won **+${fmt(o.payout - o.g.bet)} OwiCoins**!`,
    win: `🎉 **WIN!** you won **+${fmt(o.payout - o.g.bet)} OwiCoins**!`,
    dealer_bust: `🎉 dealer busted! you won **+${fmt(o.payout - o.g.bet)} OwiCoins**!`,
    push: `🤝 **PUSH** — your bet is returned.`,
    lose: `💀 dealer wins — you lost **${fmt(o.g.bet)} OwiCoins**.`,
    bust: `💥 **BUST!** you lost **${fmt(o.g.bet)} OwiCoins**.`,
    dealer_bj: `💀 dealer has blackjack — you lost **${fmt(o.g.bet)} OwiCoins**.`,
  };
  return `${map[o.outcome]}\n💰 balance: **${fmt(o.balance)} OwiCoins**`;
}

export async function execute(interaction) {
  const u = interaction.user;
  try {
    const bet = await resolveBet(u.id, u.username, interaction.options.getString("bet"));
    const res = await start(u.id, u.username, bet);
    if (res.done) {
      await interaction.reply(render(u.id, res.g, { hideDealer: false, result: resultText(res) }));
    } else {
      await interaction.reply(render(u.id, res.g));
    }
  } catch (e) {
    if (e instanceof BjError || e instanceof BetError) return void (await say(interaction, `❌ <@${u.id}> ${e.message}`));
    throw e;
  }
}
