const SUIT = [
  "<:bj_1_spade:1537017889779875860>",
  "<:bj_2_heart:1537017891881222184>",
  "<:bj_3_diamond:1537017893697491045>",
  "<:bj_4_club:1537017895421481031>",
];
const ACE = "<:bj_5_ace:1537017897451524176>";
const KING = "<:bj_6_king:1537017899930353725>";
export const CHIP = "<:bj_7_chip:1537017902438289418>";
export const CARDBACK = "<:bj_8_cardback:1537017904548028526>";
export const FLIP = "<a:card_flip:1537017910500003852>";

const RANK_LABEL = { 1: "A", 11: "J", 12: "Q", 13: "K" };

export function card({ rank, suit }) {
  if (rank === 1) return ACE;
  if (rank === 13) return KING;
  const label = RANK_LABEL[rank] ?? String(rank);
  return `${SUIT[suit]}${label}`;
}

export function hand(cards, { hideSecond = false } = {}) {
  return cards.map((c, i) => (hideSecond && i === 1 ? CARDBACK : card(c))).join(" ");
}
