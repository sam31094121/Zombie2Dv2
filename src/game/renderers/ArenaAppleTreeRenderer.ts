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
  const sway = Math.sin(now / 700 + tree.seed) * 2.1;
  const canopyBob = Math.sin(now / 900 + tree.seed * 0.7) * 1.1;

  ctx.save();
  ctx.translate(tree.x, tree.y);

  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(0, 22, 36, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#5f3415';
  ctx.fillRect(-8 + sway * 0.1, -10, 16, 34);

  ctx.fillStyle = '#7c4a24';
  ctx.fillRect(-3 + sway * 0.15, -8, 6, 28);

  const canopy = [
    { x: -22, y: -16, r: 19 },
    { x: 0, y: -24, r: 24 },
    { x: 21, y: -15, r: 18 },
    { x: -6, y: -4, r: 22 },
    { x: 10, y: -2, r: 18 },
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
    { x: -18, y: -6, r: 4.8 },
    { x: 14, y: 4, r: 4.2 },
    { x: 6, y: -14, r: 4.3 },
    { x: -2, y: 6, r: 4.1 },
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
    ctx.arc(0, -10 + canopyBob, 34 + pulse * 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
