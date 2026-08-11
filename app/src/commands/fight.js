import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { assertCanBet, FightError } from "../services/fight.js";
import { say, fmt } from "../lib/owo.js";

export const fights = new Map();
let seq = 0;

export const data = { name: "fight" };

export async function execute(interaction) {
  const u = interaction.user;
  const opponent = interaction.options.getUser("user");
  const bet = interaction.options.getInteger("bet");

  if (!opponent || opponent.bot || opponent.id === u.id) {
    await say(interaction, `❌ <@${u.id}> tag a real user (not yourself/a bot) to fight!`);
    return;
  }
  try {
    await assertCanBet(u, bet);
    await assertCanBet(opponent, bet);
  } catch (e) {
    if (e instanceof FightError) {
      await say(interaction, `❌ ${e.message}`);
      return;
    }
    throw e;
  }

  const id = ++seq;
  fights.set(id, { challenger: u, opponent, bet, status: "pending", picks: {} });
  setTimeout(() => expire(id, "no response"), 60000);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`fight:${id}:accept`).setLabel("Accept").setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`fight:${id}:reject`).setLabel("Reject").setStyle(ButtonStyle.Danger)
  );
  await interaction.reply({
    content:
      `⚔️ <@${opponent.id}>, **${u.username}** challenges you to a **pet duel** for **${fmt(bet)} OwiCoins**!\n` +
      `both will pick a fighter — higher power wins more often, but it's never a sure thing.\n` +
      `_only <@${opponent.id}> can respond · expires in 60s_`,
    components: [row],
  });
}

function expire(id, reason) {
  const f = fights.get(id);
  if (f && f.status !== "done") {
    fights.delete(id);
    f.message?.edit?.({ content: `⌛ duel cancelled (${reason})`, components: [] }).catch(() => {});
  }
}
