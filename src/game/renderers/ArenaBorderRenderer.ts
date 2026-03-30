export interface ArenaPlayableBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

interface ArenaScrap {
  x: number;
  y: number;
  w: number;
  h: number;
  rotation: number;
  color: string;
  detail: string;
}

interface ArenaStain {
  x: number;
  y: number;
  rx: number;
  ry: number;
  rotation: number;
  alpha: number;
}

export interface ArenaBorderLayout {
  seed: number;
  playable: ArenaPlayableBounds;
  scraps: ArenaScrap[];
  stains: ArenaStain[];
}

function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function range(seed: number, min: number, max: number) {
  return min + pseudoRandom(seed) * (max - min);
}

export function createArenaBorderLayout(width: number, height: number, seed: number): ArenaBorderLayout {
  const leftInset = Math.round(range(seed + 1, 96, 156));
  const rightInset = Math.round(range(seed + 2, 96, 156));
  const topInset = Math.round(range(seed + 3, 88, 142));
  const bottomInset = Math.round(range(seed + 4, 92, 150));

  const playable: ArenaPlayableBounds = {
    left: leftInset,
    top: topInset,
    right: width - rightInset,
    bottom: height - bottomInset,
  };

  const scraps: ArenaScrap[] = [];
  const stains: ArenaStain[] = [];
  const sides: Array<'top' | 'right' | 'bottom' | 'left'> = ['top', 'right', 'bottom', 'left'];

  sides.forEach((side, sideIndex) => {
    const count = 11 + Math.floor(range(seed + 20 + sideIndex, 0, 6));
    for (let i = 0; i < count; i++) {
      const localSeed = seed + sideIndex * 100 + i * 7;
      const t = (i + pseudoRandom(localSeed + 0.4)) / count;
      let x = 0;
      let y = 0;
      const w = Math.round(range(localSeed + 1, 24, 62));
      const h = Math.round(range(localSeed + 2, 10, 24));
      const rotationBase = range(localSeed + 3, -0.35, 0.35);
      const color = pseudoRandom(localSeed + 4) > 0.5 ? '#534741' : '#675a52';
      const detail = pseudoRandom(localSeed + 5) > 0.5 ? '#2f2622' : '#87766e';

      if (side === 'top') {
        x = playable.left + t * (playable.right - playable.left);
        y = range(localSeed + 6, 16, playable.top - 14);
      } else if (side === 'bottom') {
        x = playable.left + t * (playable.right - playable.left);
        y = range(localSeed + 6, playable.bottom + 14, height - 16);
      } else if (side === 'left') {
        x = range(localSeed + 6, 16, playable.left - 14);
        y = playable.top + t * (playable.bottom - playable.top);
      } else {
        x = range(localSeed + 6, playable.right + 14, width - 16);
        y = playable.top + t * (playable.bottom - playable.top);
      }

      scraps.push({
        x,
        y,
        w,
        h,
        rotation: rotationBase + (side === 'left' || side === 'right' ? Math.PI / 2 : 0),
        color,
        detail,
      });
    }
  });

  for (let i = 0; i < 36; i++) {
    const stainSeed = seed + 600 + i * 11;
    const side = sides[i % sides.length];
    let x = 0;
    let y = 0;

    if (side === 'top' || side === 'bottom') {
      x = range(stainSeed + 1, playable.left - 36, playable.right + 36);
      y = side === 'top'
        ? range(stainSeed + 2, 12, playable.top - 10)
        : range(stainSeed + 2, playable.bottom + 10, height - 12);
    } else {
      x = side === 'left'
        ? range(stainSeed + 1, 12, playable.left - 10)
        : range(stainSeed + 1, playable.right + 10, width - 12);
      y = range(stainSeed + 2, playable.top - 30, playable.bottom + 30);
    }

    stains.push({
      x,
      y,
      rx: range(stainSeed + 3, 18, 54),
      ry: range(stainSeed + 4, 10, 26),
      rotation: range(stainSeed + 5, 0, Math.PI),
      alpha: range(stainSeed + 6, 0.08, 0.22),
    });
  }

  return { seed, playable, scraps, stains };
}

export function drawArenaBorder(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  layout: ArenaBorderLayout,
): void {
  const { playable, scraps, stains } = layout;

  ctx.save();

  // ── 移除黑幕效果 ──

  for (const stain of stains) {
    ctx.save();
    ctx.translate(stain.x, stain.y);
    ctx.rotate(stain.rotation);
    ctx.fillStyle = `rgba(0, 0, 0, ${stain.alpha})`;
    ctx.beginPath();
    ctx.ellipse(0, 0, stain.rx, stain.ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── 移除全螢幕徑向霧氣 (Fog Gradient) ──

  ctx.strokeStyle = 'rgba(255, 156, 108, 0.2)';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 14]);
  ctx.strokeRect(
    playable.left + 10,
    playable.top + 10,
    playable.right - playable.left - 20,
    playable.bottom - playable.top - 20,
  );
  ctx.setLineDash([]);

  ctx.strokeStyle = 'rgba(255, 120, 76, 0.38)';
  ctx.lineWidth = 3;
  ctx.strokeRect(playable.left, playable.top, playable.right - playable.left, playable.bottom - playable.top);

  for (const scrap of scraps) {
    ctx.save();
    ctx.translate(scrap.x, scrap.y);
    ctx.rotate(scrap.rotation);
    ctx.fillStyle = scrap.color;
    ctx.fillRect(-scrap.w / 2, -scrap.h / 2, scrap.w, scrap.h);
    ctx.strokeStyle = 'rgba(24, 18, 17, 0.55)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-scrap.w / 2, -scrap.h / 2, scrap.w, scrap.h);
    ctx.fillStyle = scrap.detail;
    ctx.fillRect(-scrap.w / 2 + 4, -2, scrap.w - 8, 4);
    ctx.restore();
  }

  for (let i = 0; i < 22; i++) {
    const sparkSeed = layout.seed + 900 + i * 13;
    const x = range(sparkSeed + 1, playable.left - 28, playable.right + 28);
    const y = i % 2 === 0
      ? range(sparkSeed + 2, playable.top - 18, playable.top + 8)
      : range(sparkSeed + 2, playable.bottom - 8, playable.bottom + 18);
    ctx.fillStyle = `rgba(255, 134, 78, ${range(sparkSeed + 3, 0.08, 0.18)})`;
    ctx.fillRect(x, y, 2, 2);
  }

  ctx.restore();
}
