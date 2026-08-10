import { createCanvas } from "@napi-rs/canvas";
import { encodeGif, roundRect } from "./gif.js";

const W = 210, H = 120, DIE = 64;

const PIPS = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.28, 0.28], [0.5, 0.5], [0.72, 0.72]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.5], [0.72, 0.5], [0.28, 0.72], [0.72, 0.72]],
};

function die(ctx, x, y, val, color, glow) {
  ctx.fillStyle = "#f4f4f5";
  roundRect(ctx, x, y, DIE, DIE, 16);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = glow ? "#ffd54a" : "#c7c9d1";
  roundRect(ctx, x, y, DIE, DIE, 16);
  ctx.stroke();
  ctx.fillStyle = color;
  for (const [px, py] of PIPS[val]) {
    ctx.beginPath();
    ctx.arc(x + px * DIE, y + py * DIE, DIE * 0.09, 0, Math.PI * 2);
    ctx.fill();
  }
}

function frame(ctx, pv, hv, glow) {
  ctx.fillStyle = "#1e1f22";
  ctx.fillRect(0, 0, W, H);
  const y = (H - DIE) / 2;
  die(ctx, 30, y, pv, "#3b82f6", glow);
  die(ctx, W - 30 - DIE, y, hv, "#ef4444", glow);
}

const rnd = () => 1 + Math.floor(Math.random() * 6);

export function renderDiceGif(player, house) {
  const frames = [];
  const delays = [];
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  const roll = 12;
  for (let f = 0; f < roll; f++) {
    frame(ctx, rnd(), rnd(), false);
    frames.push(ctx.getImageData(0, 0, W, H));
    delays.push(70);
  }
  frame(ctx, player, house, true);
  frames.push(ctx.getImageData(0, 0, W, H));
  delays.push(2500);

  return encodeGif(frames, delays);
}
