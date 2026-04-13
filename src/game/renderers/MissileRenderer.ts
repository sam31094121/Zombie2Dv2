import { MissileProjectile } from '../entities/MissileProjectile';

const C = {
  base:       '#1a1c23',
  steelMid:   '#666a7a',
  steelLight: '#9ba0b5',
  warhead:    '#cc0000',
  fireWhite:  '#ffffff',
  fireYellow: '#ffcc00',
  fireOrange: '#ff6600',
  fireRed:    '#cc0000',
  ember:      '#450a0a',
};

export function drawMissiles(missiles: MissileProjectile[], ctx: CanvasRenderingContext2D): void {
  for (const m of missiles) {
    if (!m.alive) continue;
    _drawOne(m, ctx);
  }
}

function _drawOne(m: MissileProjectile, ctx: CanvasRenderingContext2D): void {
  const angle = Math.atan2(m.vy, m.vx);
  const s = m.isSmall ? 0.65 : 1.0;
  const f = Math.floor(Date.now() / 110) % 3;

  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(angle);
  ctx.scale(s, s);
  ctx.imageSmoothingEnabled = false;

  const ox = -15;
  const r = (x: number, y: number, w: number, h: number) =>
    ctx.fillRect(x + ox, y, w, h);
  const BODY_HALF = 5; // 10px thick body (was 6px)

  const spark = (x: number, y: number, sz: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + ox, y, sz, sz);
  };

  if (f === 0) {
    ctx.fillStyle = C.fireRed;    r(-12, -4, 10, 8);
    ctx.fillStyle = C.fireOrange; r(-8,  -3,  7, 6);
    ctx.fillStyle = C.fireWhite;  r(-2,  -1,  3, 2);
  } else if (f === 1) {
    spark(-15, -5, 3, C.fireRed);
    spark(-12,  3, 2, C.fireOrange);
    spark(-8,  -2, 4, C.fireYellow);
    spark(-4,  -2, 4, C.fireWhite);
    spark(-5,  -7, 1, C.fireYellow);
    spark(-6,   6, 1, C.fireOrange);
  } else {
    ctx.fillStyle = C.fireRed;  r(-18, -3, 12, 6);
    ctx.fillStyle = C.ember;    r(-22, -1,  4, 2);
    spark(-25, 1, 1, C.fireRed);
  }

  ctx.fillStyle = C.base;
  r(0, -BODY_HALF, 2, BODY_HALF * 2);

  ctx.fillStyle = C.steelMid;
  r(2, -BODY_HALF, 18, BODY_HALF * 2);

  ctx.fillStyle = C.steelLight;
  r(2, -BODY_HALF, 18, 3);

  ctx.fillStyle = C.base;
  r(2, BODY_HALF - 1, 18, 1);

  ctx.fillStyle = C.warhead;
  r(20, -BODY_HALF, 5, BODY_HALF * 2);

  ctx.fillStyle = C.warhead;
  ctx.beginPath();
  ctx.moveTo(25 + ox, -BODY_HALF);
  ctx.lineTo(31 + ox, 0);
  ctx.lineTo(25 + ox, BODY_HALF);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = C.base;
  r(2, -8, 3, 4);
  r(2,  4, 3, 4);
  ctx.fillStyle = C.steelMid;
  r(3, -7, 1, 14);

  ctx.restore();
}
