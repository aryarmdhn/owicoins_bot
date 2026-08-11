import { EmbedBuilder, AttachmentBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { start, BjError, handValue } from "../services/blackjack.js";
import { resolveBet, BetError } from "../services/gamble.js";
import { renderHand } from "../lib/cardimg.js";
import { say, fmt } from "../lib/owo.js";

export const data = { name: "bj" };

const COLOR = { win: 0x57f287, lose: 0xed4245, push: 0xfaa61a, playing: 0x5865f2 };

export function render(discordId, g, { hideDealer = true, result = null, outcome = null } = {}) {
  const playerImg = renderHand(g.player);
  const dealerImg = renderHand(g.dealer, { hideSecond: hideDealer });
  const files = [
    new AttachmentBuilder(playerImg, { name: "player.png" }),
    new AttachmentBuilder(dealerImg, { name: "dealer.png" }),
  ];

  const dealerVal = hideDealer ? "?" : handValue(g.dealer);
  const color = outcome
    ? (["win", "blackjack", "dealer_bust"].includes(outcome) ? COLOR.win
      : outcome === "push" ? COLOR.push : COLOR.lose)
    : COLOR.playing;

  const embed = new EmbedBuilder()
    .setColor(color)
    .setTitle("🃏 Blackjack")
    .setDescription(`Bet: **${fmt(g.bet)} OwiCoins**`)
    .addFields(
      { name: `🤖 Dealer (${dealerVal})`, value: "\u200b" },
    )
    .setImage("attachment://dealer.png")
    .setFooter({ text: "Gacha Bot" });

  // second embed for player hand (Discord shows both images stacked)
  const playerEmbed = new EmbedBuilder()
    .setColor(color)
    .setTitle(`🧑 You (${handValue(g.player)})`)
    .setImage("attachment://player.png");

  if (result) playerEmbed.setDescription(result);

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`bj:${discordId}:hit`).setLabel("Hit").setStyle(ButtonStyle.Success).setDisabled(g.over),
    new ButtonBuilder().setCustomId(`bj:${discordId}:stand`).setLabel("Stand").setStyle(ButtonStyle.Danger).setDisabled(g.over)
  );

  return { embeds: [embed, playerEmbed], files, components: g.over ? [] : [buttons], attachments: [] };
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
      await interaction.reply(render(u.id, res.g, { hideDealer: false, result: resultText(res), outcome: res.outcome }));
    } else {
      await interaction.reply(render(u.id, res.g));
    }
  } catch (e) {
    if (e instanceof BjError || e instanceof BetError) return void (await say(interaction, `❌ <@${u.id}> ${e.message}`));
    throw e;
  }
}
