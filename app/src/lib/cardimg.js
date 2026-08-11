import { createCanvas } from "@napi-rs/canvas";
import { roundRect } from "./gif.js";

const CW = 90, CH = 126, GAP = 12, PAD = 16;
const RANK = { 1: "A", 11: "J", 12: "Q", 13: "K" };
const rankStr = (r) => RANK[r] ?? String(r);

// suit: 0=♠ 1=♥ 2=♦ 3=♣ ; red for hearts/diamonds
const SUIT_RED = new Set([1, 2]);

function drawSuit(ctx, s, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  if (s === 0 || s === 3) {
    // spade / club approximation with circles + stem
    const r = size * 0.28;
    if (s === 0) {
      ctx.moveTo(0, -size * 0.5);
      ctx.bezierCurveTo(size * 0.5, size * 0.05, size * 0.28, size * 0.4, 0, size * 0.2);
      ctx.bezierCurveTo(-size * 0.28, size * 0.4, -size * 0.5, size * 0.05, 0, -size * 0.5);
      ctx.fill();
    } else {
      ctx.arc(0, -size * 0.15, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(-r * 0.9, size * 0.2, r, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 0.9, size * 0.2, r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillRect(-size * 0.06, size * 0.1, size * 0.12, size * 0.4);
  } else if (s === 1) {
    // heart
    ctx.moveTo(0, size * 0.4);
    ctx.bezierCurveTo(size * 0.6, -size * 0.1, size * 0.3, -size * 0.5, 0, -size * 0.15);
    ctx.bezierCurveTo(-size * 0.3, -size * 0.5, -size * 0.6, -size * 0.1, 0, size * 0.4);
    ctx.fill();
  } else {
    // diamond
    ctx.moveTo(0, -size * 0.5);
    ctx.lineTo(size * 0.42, 0);
    ctx.lineTo(0, size * 0.5);
    ctx.lineTo(-size * 0.42, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawCard(ctx, x, rank, suit) {
  const y = PAD;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, CW, CH, 10); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = "#d0d0d0";
  roundRect(ctx, x, y, CW, CH, 10); ctx.stroke();

  const color = SUIT_RED.has(suit) ? "#d32f2f" : "#1a1a1a";
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.font = "bold 22px sans-serif";
  ctx.fillText(rankStr(rank), x + 8, y + 6);
  drawSuit(ctx, suit, x + 16, y + 40, 16);
  // center big suit
  drawSuit(ctx, suit, x + CW / 2, y + CH / 2 + 6, 34);
}

function drawBack(ctx, x) {
  const y = PAD;
  ctx.fillStyle = "#2b3a67";
  roundRect(ctx, x, y, CW, CH, 10); ctx.fill();
  ctx.strokeStyle = "#8fa3d6"; ctx.lineWidth = 3;
  roundRect(ctx, x + 6, y + 6, CW - 12, CH - 12, 8); ctx.stroke();
  ctx.fillStyle = "#8fa3d6";
  ctx.font = "bold 40px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("?", x + CW / 2, y + CH / 2);
}

// cards: array of {rank, suit} ; hideFirstDealer for the ? card
export function renderHand(cards, { hideSecond = false } = {}) {
  const n = cards.length;
  const W = PAD * 2 + n * CW + (n - 1) * GAP;
  const H = PAD * 2 + CH;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#1e1f22";
  ctx.fillRect(0, 0, W, H);
  cards.forEach((c, i) => {
    const x = PAD + i * (CW + GAP);
    if (hideSecond && i === 1) drawBack(ctx, x);
    else drawCard(ctx, x, c.rank, c.suit);
  });
  return canvas.toBuffer("image/png");
}
