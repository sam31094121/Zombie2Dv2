export interface ArenaAppleTreeRenderable {
  x: number;
  y: number;
  nextDropAt: number;
  seed: number;
}

const hash = (value: number) => {
  const s = Math.sin(value * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

export function drawArenaAppleTree(
  ctx: CanvasRenderingContext2D,
  tree: ArenaAppleTreeRenderable,
  now: number = Date.now(),
): void {
  const pulse = Math.max(0, 1 - (tree.nextDropAt - now) / 2500);
  const sway = Math.sin(now / 700 + tree.seed) * 1.6;
  const canopyBob = Math.sin(now / 900 + tree.seed * 0.7) * 0.8;

  ctx.save();
  ctx.translate(tree.x, tree.y);

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 16, 26, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5f3415';
  ctx.fillRect(-6 + sway * 0.1, -6, 12, 26);

  ctx.fillStyle = '#7c4a24';
  ctx.fillRect(-2 + sway * 0.15, -4, 4, 22);

  const canopy = [
    { x: -16, y: -10, r: 14 },
    { x: 0, y: -16, r: 18 },
    { x: 15, y: -9, r: 13 },
    { x: -3, y: -1, r: 16 },
  ];
  for (const blob of canopy) {
    ctx.fillStyle = '#14532d';
    ctx.beginPath();
    ctx.arc(blob.x + sway * 0.3, blob.y + canopyBob, blob.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(blob.x + sway * 0.2, blob.y - 2 + canopyBob, blob.r * 0.72, 0, Math.PI * 2);
    ctx.fill();
  }

  const appleAlpha = 0.45 + pulse * 0.55;
  const apples = [
    { x: -12, y: -2, r: 3.8 },
    { x: 8, y: 4, r: 3.2 },
    { x: 3, y: -8, r: 3.4 },
  ];
  for (let i = 0; i < apples.length; i++) {
    const apple = apples[i];
    const wobble = (hash(tree.seed + i * 7.1) - 0.5) * 2.5;
    ctx.globalAlpha = appleAlpha;
    ctx.fillStyle = '#7f1d1d';
    ctx.beginPath();
    ctx.arc(apple.x + wobble, apple.y + 1, apple.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(apple.x + wobble, apple.y, apple.r * 0.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (pulse > 0) {
    ctx.strokeStyle = `rgba(250, 204, 21, ${0.18 + pulse * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -8 + canopyBob, 24 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
