import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { start, BjError, handValue } from "../services/blackjack.js";
import { resolveBet, BetError } from "../services/gamble.js";
import { hand, CHIP, FLIP } from "../lib/cards.js";
import { say, fmt, sleep } from "../lib/owo.js";

export const data = { name: "bj" };

const COLOR = { win: 0x57f287, lose: 0xed4245, push: 0xfaa61a, playing: 0x5865f2 };

function embed(g, { hideDealer = true, result = null, outcome = null, dealerCards = null } = {}) {
  const dealerVal = hideDealer ? "?" : handValue(g.dealer);
  const color = outcome
    ? (["win", "blackjack", "dealer_bust"].includes(outcome) ? COLOR.win
      : outcome === "push" ? COLOR.push : COLOR.lose)
    : COLOR.playing;
  const e = new EmbedBuilder()
    .setColor(color)
    .setTitle("🃏 Blackjack")
    .setDescription(`${CHIP} Bet: **${fmt(g.bet)} OwiCoins**`)
    .addFields(
      { name: `🤖 Dealer (${dealerVal})`, value: dealerCards ?? hand(g.dealer, { hideSecond: hideDealer }) },
      { name: `🧑 You (${handValue(g.player)})`, value: hand(g.player) },
    )
    .setFooter({ text: "Gacha Bot" });
  if (result) e.addFields({ name: "\u200b", value: result });
  return e;
}

export function render(discordId, g, opts = {}) {
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bj:${discordId}:hit`).setLabel("Hit").setStyle(ButtonStyle.Success).setDisabled(g.over),
    new ButtonBuilder().setCustomId(`bj:${discordId}:stand`).setLabel("Stand").setStyle(ButtonStyle.Danger).setDisabled(g.over)
  );
  return { embeds: [embed(g, opts)], components: g.over ? [] : [buttons], allowedMentions: { parse: [] } };
}

// flip the face-down dealer card: cardback → flip GIF → revealed hand
export async function flipReveal(msg, discordId, g, result, outcome) {
  if (!msg?.edit) return;
  const shown = hand(g.dealer, { hideSecond: true }).split(" ")[0];
  await msg.edit({ embeds: [embed(g, { dealerCards: `${shown} ${FLIP}` })], components: [], allowedMentions: { parse: [] } }).catch(() => {});
  await sleep(900);
  await msg.edit(render(discordId, g, { hideDealer: false, result, outcome })).catch(() => {});
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
    if (res.done) await flipReveal(msg, u.id, res.g, resultText(res), res.outcome); // natural blackjack
  } catch (e) {
    if (e instanceof BjError || e instanceof BetError) return void (await say(interaction, `❌ <@${u.id}> ${e.message}`));
    throw e;
  }
}
