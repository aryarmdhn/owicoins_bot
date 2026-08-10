import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc;

// frames: array of ImageData-like {data,width,height}; delays: ms per frame; plays once
export function encodeGif(frames, delays) {
  const enc = GIFEncoder();
  frames.forEach((img, i) => {
    const palette = quantize(img.data, 128);
    const index = applyPalette(img.data, palette);
    enc.writeFrame(index, img.width, img.height, {
      palette,
      delay: delays[i],
      repeat: i === 0 ? -1 : undefined,
    });
  });
  enc.finish();
  return Buffer.from(enc.bytes());
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
