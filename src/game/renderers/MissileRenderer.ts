import { MissileProjectile } from '../entities/MissileProjectile';

const FIRE_COLORS = {
  base: '#1a1c23',
  steelMid: '#666a7a',
  steelLight: '#9ba0b5',
  warhead: '#cc0000',
  fireWhite: '#ffffff',
  fireYellow: '#ffcc00',
  fireOrange: '#ff6600',
  fireRed: '#cc0000',
  ember: '#450a0a',
};

const ENERGY_COLORS = {
  shellDark: '#07142b',
  shellMid: '#123a7d',
  shellLight: '#2d7dff',
  shellGlow: '#7dd3fc',
  core: '#effbff',
  coreGlow: '#67e8f9',
  tailBlue: '#2563eb',
  tailCyan: '#38bdf8',
  tailWhite: '#f8fdff',
};

export function drawMissiles(missiles: MissileProjectile[], ctx: CanvasRenderingContext2D): void {
  for (const missile of missiles) {
    if (!missile.alive) continue;
    _drawOne(missile, ctx);
  }
}

function _drawOne(missile: MissileProjectile, ctx: CanvasRenderingContext2D): void {
  const angle = Math.atan2(missile.vy, missile.vx);
  const scale = missile.variant === 'energy'
    ? (missile.isSmall ? 0.92 : 1.14)
    : (missile.isSmall ? 0.65 : 1.0);
  const frame = Math.floor(Date.now() / 110) % 3;

  ctx.save();
  ctx.translate(missile.x, missile.y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;

  if (missile.variant === 'energy') {
    _drawEnergyMissile(ctx, frame);
    ctx.restore();
    return;
  }

  _drawFireMissile(ctx, frame);
  ctx.restore();
}

function _drawFireMissile(ctx: CanvasRenderingContext2D, frame: number): void {
  const ox = -15;
  const bodyHalf = 5;
  const rect = (x: number, y: number, w: number, h: number) => ctx.fillRect(x + ox, y, w, h);
  const spark = (x: number, y: number, size: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + ox, y, size, size);
  };

  if (frame === 0) {
    ctx.fillStyle = FIRE_COLORS.fireRed;    rect(-12, -4, 10, 8);
    ctx.fillStyle = FIRE_COLORS.fireOrange; rect(-8,  -3,  7, 6);
    ctx.fillStyle = FIRE_COLORS.fireWhite;  rect(-2,  -1,  3, 2);
  } else if (frame === 1) {
    spark(-15, -5, 3, FIRE_COLORS.fireRed);
    spark(-12,  3, 2, FIRE_COLORS.fireOrange);
    spark(-8,  -2, 4, FIRE_COLORS.fireYellow);
    spark(-4,  -2, 4, FIRE_COLORS.fireWhite);
    spark(-5,  -7, 1, FIRE_COLORS.fireYellow);
    spark(-6,   6, 1, FIRE_COLORS.fireOrange);
  } else {
    ctx.fillStyle = FIRE_COLORS.fireRed;  rect(-18, -3, 12, 6);
    ctx.fillStyle = FIRE_COLORS.ember;    rect(-22, -1,  4, 2);
    spark(-25, 1, 1, FIRE_COLORS.fireRed);
  }

  ctx.fillStyle = FIRE_COLORS.base;
  rect(0, -bodyHalf, 2, bodyHalf * 2);

  ctx.fillStyle = FIRE_COLORS.steelMid;
  rect(2, -bodyHalf, 18, bodyHalf * 2);

  ctx.fillStyle = FIRE_COLORS.steelLight;
  rect(2, -bodyHalf, 18, 3);

  ctx.fillStyle = FIRE_COLORS.base;
  rect(2, bodyHalf - 1, 18, 1);

  ctx.fillStyle = FIRE_COLORS.warhead;
  rect(20, -bodyHalf, 5, bodyHalf * 2);

  ctx.fillStyle = FIRE_COLORS.warhead;
  ctx.beginPath();
  ctx.moveTo(25 + ox, -bodyHalf);
  ctx.lineTo(31 + ox, 0);
  ctx.lineTo(25 + ox, bodyHalf);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = FIRE_COLORS.base;
  rect(2, -8, 3, 4);
  rect(2, 4, 3, 4);
  ctx.fillStyle = FIRE_COLORS.steelMid;
  rect(3, -7, 1, 14);
}

function _drawEnergyMissile(ctx: CanvasRenderingContext2D, frame: number): void {
  const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 90);
  const tailLength = 18 + frame * 4;

  ctx.save();
  ctx.fillStyle = `rgba(59, 130, 246, ${0.20 + pulse * 0.14})`;
  ctx.beginPath();
  ctx.ellipse(-6, 0, 34, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  const exhaust = ctx.createLinearGradient(-42, 0, -6, 0);
  exhaust.addColorStop(0, 'rgba(37,99,235,0)');
  exhaust.addColorStop(0.35, `rgba(37,99,235,${0.35 + pulse * 0.18})`);
  exhaust.addColorStop(0.7, `rgba(56,189,248,${0.55 + pulse * 0.18})`);
  exhaust.addColorStop(1, `rgba(248,253,255,${0.85 + pulse * 0.1})`);
  ctx.fillStyle = exhaust;
  ctx.beginPath();
  ctx.ellipse(-24, 0, tailLength, 6 + frame, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = ENERGY_COLORS.tailBlue;
  ctx.fillRect(-34, -3, 14, 6);
  ctx.fillStyle = ENERGY_COLORS.tailCyan;
  ctx.fillRect(-30, -2, 12, 4);
  ctx.fillStyle = ENERGY_COLORS.tailWhite;
  ctx.fillRect(-22, -1, 8, 2);

  ctx.fillStyle = ENERGY_COLORS.shellDark;
  ctx.fillRect(-4, -7, 24, 14);

  ctx.fillStyle = ENERGY_COLORS.shellMid;
  ctx.fillRect(-1, -6, 22, 12);

  ctx.fillStyle = ENERGY_COLORS.shellLight;
  ctx.fillRect(2, -5, 16, 10);

  ctx.fillStyle = ENERGY_COLORS.shellGlow;
  ctx.fillRect(4, -5, 14, 2);
  ctx.fillRect(14, -2, 4, 4);

  ctx.fillStyle = ENERGY_COLORS.core;
  ctx.fillRect(7, -2, 10, 4);

  ctx.fillStyle = ENERGY_COLORS.coreGlow;
  ctx.beginPath();
  ctx.moveTo(20, -7);
  ctx.lineTo(34, 0);
  ctx.lineTo(20, 7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = ENERGY_COLORS.core;
  ctx.beginPath();
  ctx.moveTo(22, -4);
  ctx.lineTo(31, 0);
  ctx.lineTo(22, 4);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = ENERGY_COLORS.shellMid;
  ctx.beginPath();
  ctx.moveTo(4, -8);
  ctx.lineTo(12, -14);
  ctx.lineTo(15, -7);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(4, 8);
  ctx.lineTo(12, 14);
  ctx.lineTo(15, 7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgba(239,251,255,${0.7 + pulse * 0.3})`;
  ctx.fillRect(-10, -1, 2, 2);
  ctx.fillRect(-16, -5, 2, 2);
  ctx.fillRect(-18, 4, 2, 2);
}
