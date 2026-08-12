import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { start, BjError, handValue } from "../services/blackjack.js";
import { resolveBet, BetError } from "../services/gamble.js";
import { hand, CHIP, FLIP } from "../lib/cards.js";
import { say, fmt, sleep } from "../lib/owo.js";

export const data = { name: "bj" };

export function render(discordId, g, { hideDealer = true, result = null } = {}) {
  const dealerVal = hideDealer ? "?" : handValue(g.dealer);
  const lines = [
    `🃏 **Blackjack** — ${CHIP} **${fmt(g.bet)} OwiCoins**`,
    `🤖 Dealer (${dealerVal}): ${hand(g.dealer, { hideSecond: hideDealer })}`,
    `🧑 You (${handValue(g.player)}): ${hand(g.player)}`,
  ];
  if (result) lines.push(result);

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bj:${discordId}:hit`).setLabel("Hit").setStyle(ButtonStyle.Success).setDisabled(g.over),
    new ButtonBuilder().setCustomId(`bj:${discordId}:stand`).setLabel("Stand").setStyle(ButtonStyle.Danger).setDisabled(g.over)
  );

  return { content: lines.join("\n"), components: g.over ? [] : [buttons], allowedMentions: { parse: [] } };
}

// flip the face-down dealer card: cardback → flip GIF → revealed hand
export async function flipReveal(msg, discordId, g, result) {
  if (!msg?.edit) return;
  const base = (dealer) => [
    `🃏 **Blackjack** — ${CHIP} **${fmt(g.bet)} OwiCoins**`,
    `🤖 Dealer: ${dealer}`,
    `🧑 You (${handValue(g.player)}): ${hand(g.player)}`,
  ].join("\n");
  const shown = hand(g.dealer, { hideSecond: true }).split(" ")[0];
  await msg.edit({ content: base(`${shown} ${FLIP}`), components: [], allowedMentions: { parse: [] } }).catch(() => {});
  await sleep(900);
  await msg.edit(render(discordId, g, { hideDealer: false, result })).catch(() => {});
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
    const msg = await interaction.reply(render(u.id, res.g, { hideDealer: true }));
    if (res.done) await flipReveal(msg, u.id, res.g, resultText(res)); // natural blackjack
  } catch (e) {
    if (e instanceof BjError || e instanceof BetError) return void (await say(interaction, `❌ <@${u.id}> ${e.message}`));
    throw e;
  }
}
