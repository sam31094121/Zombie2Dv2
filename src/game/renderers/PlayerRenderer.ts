// ── PlayerRenderer.ts ────────────────────────────────────────────────────────
// 玩家繪圖邏輯（從 Player.ts 分離，武器繪圖由 WeaponDefinitions 處理）
// ─────────────────────────────────────────────────────────────────────────────
import { Player } from '../Player';
import { WEAPON_REGISTRY, getWeaponKey } from '../entities/definitions/WeaponDefinitions';
import { getChromaSprite, PLAYER_WALK_SHEET_URLS } from '../sprites/SpriteLoader';

const TAU = Math.PI * 2;
const HEAL_REGEN_AURA_COLORS = {
  glowCore: '#F6FFF4',
  glowMid: '#9BF4BE',
  glowOuter: '#1F8C57',
  moteA: '#DFFFE6',
  moteB: '#8DF0B4',
} as const;

function noise01(seed: number): number {
  const value = Math.sin(seed * 127.1) * 43758.5453123;
  return value - Math.floor(value);
}

function withHexAlpha(hex: string, alpha: number): string {
  const raw = hex.replace('#', '');
  const normalized = raw.length === 3
    ? raw.split('').map((ch) => ch + ch).join('')
    : raw;
  const channel = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  return `#${normalized}${channel.toString(16).padStart(2, '0')}`;
}

function getFacingVector(player: Player): { x: number; y: number } {
  const moveLen = Math.hypot(player.lastMoveDir.x, player.lastMoveDir.y);
  if (moveLen > 0.001) {
    return { x: player.lastMoveDir.x / moveLen, y: player.lastMoveDir.y / moveLen };
  }

  const angle = player.aimAngle ?? 0;
  return { x: Math.cos(angle), y: Math.sin(angle) };
}

function drawSpeedBoostAura(ctx: CanvasRenderingContext2D, player: Player, now: number): void {
  if (player.speedBoostTimer <= 0) return;

  const { x: dirX, y: dirY } = getFacingVector(player);
  const perpX = -dirY;
  const perpY = dirX;
  const fade = player.speedBoostTimer < 900
    ? 0.55 + 0.45 * (Math.sin(now / 55) * 0.5 + 0.5)
    : 1;
  const pulse = 0.78 + Math.sin(now / 110) * 0.18;
  const heading = Math.atan2(dirY, dirX);
  const wakeLength = player.radius + 32 + pulse * 12;

  ctx.save();
  ctx.globalAlpha = 0.92 * fade;

  const tailGradient = ctx.createLinearGradient(
    dirX * (player.radius * 0.3),
    dirY * (player.radius * 0.3),
    -dirX * wakeLength,
    -dirY * wakeLength
  );
  tailGradient.addColorStop(0, 'rgba(255,255,255,0.34)');
  tailGradient.addColorStop(0.28, 'rgba(185,247,255,0.32)');
  tailGradient.addColorStop(0.7, 'rgba(56,189,248,0.2)');
  tailGradient.addColorStop(1, 'rgba(14,116,144,0)');
  ctx.fillStyle = tailGradient;
  ctx.beginPath();
  ctx.ellipse(
    -dirX * (player.radius * 0.72),
    -dirY * (player.radius * 0.72) + 8,
    player.radius * (1.42 + pulse * 0.18),
    player.radius * 0.86,
    heading,
    0,
    TAU,
  );
  ctx.fill();

  const bowWave = ctx.createRadialGradient(
    dirX * (player.radius * 0.72),
    dirY * (player.radius * 0.72) - 1,
    player.radius * 0.18,
    dirX * (player.radius * 0.72),
    dirY * (player.radius * 0.72) - 1,
    player.radius * 1.18
  );
  bowWave.addColorStop(0, 'rgba(255,255,255,0.24)');
  bowWave.addColorStop(0.42, 'rgba(186,245,255,0.16)');
  bowWave.addColorStop(1, 'rgba(34,211,238,0)');
  ctx.fillStyle = bowWave;
  ctx.beginPath();
  ctx.arc(dirX * 5, dirY * 5 - 2, player.radius * (1.02 + pulse * 0.08), 0, TAU);
  ctx.fill();

  ctx.shadowColor = '#a5f3fc';
  ctx.shadowBlur = 12;
  
  // 緞帶狀殘影 (Ribbon effect)
  for (let i = 0; i < 2; i++) {
    const lateral = (i === 0 ? 1 : -1) * 7.5;
    const wobble1 = Math.sin(now / 150 + i * Math.PI) * 11;
    const wobble2 = Math.cos(now / 130 + i * Math.PI) * 14;
    
    // 緞帶起點 (角色身邊)
    const startX1 = dirX * (player.radius * 0.1) + perpX * (lateral + 3.5);
    const startY1 = dirY * (player.radius * 0.1) + perpY * (lateral + 3.5) - 1;
    const startX2 = dirX * (player.radius * 0.1) + perpX * (lateral - 3.5);
    const startY2 = dirY * (player.radius * 0.1) + perpY * (lateral - 3.5) - 1;
    
    // 緞帶中段控制點
    const midX1 = perpX * (lateral + wobble1 + 3.5) - dirX * (wakeLength * 0.4);
    const midY1 = perpY * (lateral + wobble1 + 3.5) - dirY * (wakeLength * 0.4);
    const midX2 = perpX * (lateral + wobble1 - 3.5) - dirX * (wakeLength * 0.4);
    const midY2 = perpY * (lateral + wobble1 - 3.5) - dirY * (wakeLength * 0.4);
    
    // 緞帶尾端收束點
    const endX = perpX * (lateral + wobble2) - dirX * wakeLength;
    const endY = perpY * (lateral + wobble2) - dirY * wakeLength;
    
    const gradient = ctx.createLinearGradient(
      (startX1 + startX2) / 2, (startY1 + startY2) / 2, 
      endX, endY
    );
    gradient.addColorStop(0, `rgba(186,245,255,${0.6 * fade})`);
    gradient.addColorStop(0.5, `rgba(56,189,248,${0.35 * fade})`);
    gradient.addColorStop(1, 'rgba(14,116,144,0)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(startX1, startY1);
    ctx.quadraticCurveTo(midX1, midY1, endX, endY);
    ctx.quadraticCurveTo(midX2, midY2, startX2, startY2);
    ctx.fill();
  }

  ctx.shadowBlur = 10;
  for (let i = 0; i < 4; i++) {
    const offset = i * 8 + 8;
    const px = -dirX * offset + perpX * (i % 2 === 0 ? 6 : -6);
    const py = -dirY * offset + perpY * (i % 2 === 0 ? 6 : -6) + 1;
    const width = 7 - i * 0.9;
    const height = 5 - i * 0.5;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(heading);
    ctx.fillStyle = i === 0 ? 'rgba(255,255,255,0.24)' : `rgba(125,211,252,${0.18 - i * 0.02})`;
    ctx.fillRect(-width * 0.5, -height * 0.5, width, height);
    ctx.restore();
  }

  ctx.shadowBlur = 8;
  for (let i = 0; i < 6; i++) {
    const orbit = now / 230 + i * 1.04;
    const radius = player.radius + 8 + Math.sin(now / 150 + i) * 2;
    const px = Math.cos(orbit) * radius + dirX * 5;
    const py = Math.sin(orbit) * (player.radius * 0.74) + dirY * 4;
    const size = i % 3 === 0 ? 3.2 : 2.4;
    ctx.fillStyle = i % 2 === 0 ? '#ecfeff' : '#67e8f9';
    ctx.fillRect(px - size * 0.5, py - size * 0.5, size, size);
  }
  ctx.restore();
}

function drawSlowDebuffAura(ctx: CanvasRenderingContext2D, player: Player, now: number): void {
  if (player.slowDebuffTimer <= 0) return;

  const fade = player.slowDebuffTimer < 700
    ? 0.65 + 0.35 * (Math.sin(now / 80) * 0.5 + 0.5)
    : 1;
  const oozePulse = 0.94 + Math.sin(now / 220) * 0.08;

  ctx.save();
  ctx.globalAlpha = 0.92 * fade;

  const puddle = ctx.createRadialGradient(0, 10, player.radius * 0.2, 0, 10, player.radius * 1.7);
  puddle.addColorStop(0, 'rgba(163,191,74,0.2)');
  puddle.addColorStop(0.34, 'rgba(92,112,31,0.32)');
  puddle.addColorStop(0.72, 'rgba(43,54,18,0.34)');
  puddle.addColorStop(1, 'rgba(19,24,8,0)');
  ctx.fillStyle = puddle;
  ctx.beginPath();
  ctx.ellipse(0, 10, player.radius * 1.95 * oozePulse, player.radius * 1.08, 0, 0, TAU);
  ctx.fill();

  ctx.fillStyle = 'rgba(32,39,13,0.24)';
  ctx.beginPath();
  ctx.ellipse(0, 11, player.radius * 1.18, player.radius * 0.64, 0, 0, TAU);
  ctx.fill();

  ctx.shadowColor = 'rgba(176,220,88,0.22)';
  ctx.shadowBlur = 9;
  ctx.strokeStyle = 'rgba(168,204,81,0.52)';
  ctx.lineWidth = 2.6;
  ctx.setLineDash([4, 9]);
  ctx.lineDashOffset = -(now / 140);
  ctx.beginPath();
  ctx.ellipse(0, 8, player.radius + 8, player.radius * 0.72, 0, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  for (let i = 0; i < 7; i++) {
    const seed = player.id * 19.7 + i * 7.1;
    const angle = noise01(seed) * TAU;
    const dist = player.radius * (0.6 + noise01(seed + 2) * 0.85);
    const px = Math.cos(angle) * dist;
    const py = 8 + Math.sin(angle) * player.radius * 0.42;
    const blobW = 3.4 + noise01(seed + 4) * 3.4;
    const blobH = 5.2 + noise01(seed + 6) * 5.6 + Math.max(0, Math.sin(now / 170 + i)) * 2.4;

    ctx.fillStyle = `rgba(128,158,44,${0.22 + noise01(seed + 8) * 0.18})`;
    ctx.beginPath();
    ctx.ellipse(px, py, blobW, blobH, noise01(seed + 10) * Math.PI, 0, TAU);
    ctx.fill();
  }

  ctx.strokeStyle = 'rgba(58,72,22,0.58)';
  ctx.lineWidth = 2.1;
  for (let i = 0; i < 4; i++) {
    const startX = (i - 1.5) * 5.5;
    const startY = 1 + Math.sin(now / 190 + i * 1.4) * 2.5;
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(startX + Math.sin(now / 220 + i) * 3.2, 13, startX - 1.8, player.radius + 12);
    ctx.stroke();
  }

  for (let i = 0; i < 5; i++) {
    const orbit = now / 520 + i * 1.14;
    const px = Math.cos(orbit) * (player.radius * 0.92);
    const py = -2 + Math.sin(orbit * 0.7) * (player.radius * 0.45);
    const size = 2 + (i % 2) * 0.8;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(180,210,92,0.3)' : 'rgba(86,106,30,0.42)';
    ctx.beginPath();
    ctx.ellipse(px, py, size, size * 0.82, orbit, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawAltarGroundAura(ctx: CanvasRenderingContext2D, player: Player, now: number): void {
  if (!player.isAtAltar) return;

  const pulse = 0.82 + Math.sin(now / 170) * 0.2;
  const ringR = player.radius + 14;

  ctx.save();
  ctx.globalAlpha = 0.96;

  const floorGlow = ctx.createRadialGradient(0, 10, ringR * 0.2, 0, 10, ringR * 1.9);
  floorGlow.addColorStop(0, 'rgba(255,243,190,0.22)');
  floorGlow.addColorStop(0.26, 'rgba(255,176,68,0.24)');
  floorGlow.addColorStop(0.6, 'rgba(255,87,24,0.24)');
  floorGlow.addColorStop(1, 'rgba(120,18,0,0)');
  ctx.fillStyle = floorGlow;
  ctx.beginPath();
  ctx.ellipse(0, 10, ringR * 1.58, ringR * 0.92, 0, 0, TAU);
  ctx.fill();

  ctx.translate(0, 2);
  ctx.rotate(now / 1200);
  ctx.strokeStyle = `rgba(255,165,74,${0.44 + pulse * 0.18})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 7]);
  ctx.lineDashOffset = -(now / 120);
  ctx.beginPath();
  ctx.arc(0, 0, ringR, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.rotate(-(now / 760));
  ctx.strokeStyle = 'rgba(255,220,138,0.9)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([2, 10]);
  ctx.beginPath();
  ctx.arc(0, 0, ringR * 0.62, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);

  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * TAU;
    ctx.save();
    ctx.rotate(angle);
    ctx.translate(ringR - 2, 0);
    ctx.strokeStyle = i % 2 === 0 ? 'rgba(255,232,160,0.84)' : 'rgba(255,144,64,0.76)';
    ctx.lineWidth = i % 2 === 0 ? 1.7 : 1.4;
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(4.5, 0);
    ctx.lineTo(0, 5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }

  for (let i = 0; i < 8; i++) {
    const orbit = now / 340 + i * 0.78;
    const emberR = ringR * (0.66 + (i % 3) * 0.12);
    const px = Math.cos(orbit) * emberR;
    const py = Math.sin(orbit) * emberR * 0.55;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,232,160,0.74)' : 'rgba(255,117,24,0.72)';
    ctx.fillRect(px - 1.5, py - 1.5, 3, 3);
  }
  ctx.restore();
}

function drawRegenAura(ctx: CanvasRenderingContext2D, player: Player, now: number): void {
  if (!player.isRegenerating) return;

  const pulse = 0.72 + Math.sin(now / 200) * 0.18;
  const glow = ctx.createRadialGradient(0, -2, 0, 0, -2, player.radius * 1.55);

  glow.addColorStop(0, withHexAlpha(HEAL_REGEN_AURA_COLORS.glowCore, 0.2));
  glow.addColorStop(0.45, withHexAlpha(HEAL_REGEN_AURA_COLORS.glowMid, 0.18));
  glow.addColorStop(1, withHexAlpha(HEAL_REGEN_AURA_COLORS.glowOuter, 0));

  ctx.save();
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, -2, player.radius * (1.18 + pulse * 0.08), 0, TAU);
  ctx.fill();

  for (let i = 0; i < 4; i++) {
    const orbit = now / 340 + i * 1.55;
    const px = Math.cos(orbit) * (player.radius * 0.78);
    const py = -4 + Math.sin(orbit * 1.25) * (player.radius * 0.42);
    ctx.fillStyle = i % 2 === 0 ? HEAL_REGEN_AURA_COLORS.moteA : HEAL_REGEN_AURA_COLORS.moteB;
    ctx.beginPath();
    ctx.ellipse(px, py, 2.4, 4.6, orbit * 0.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawAltarFrontAura(ctx: CanvasRenderingContext2D, player: Player, now: number): void {
  if (!player.isAtAltar) return;

  const { x: dirX, y: dirY } = getFacingVector(player);
  const aim = Math.atan2(dirY, dirX);
  const pulse = 0.84 + Math.sin(now / 110) * 0.18;

  ctx.save();
  ctx.globalAlpha = 0.94;

  const heatGlow = ctx.createRadialGradient(0, -4, 0, 0, -4, player.radius * 1.7);
  heatGlow.addColorStop(0, 'rgba(255,245,204,0.18)');
  heatGlow.addColorStop(0.34, 'rgba(255,176,72,0.18)');
  heatGlow.addColorStop(0.68, 'rgba(255,94,32,0.18)');
  heatGlow.addColorStop(1, 'rgba(255,80,0,0)');
  ctx.fillStyle = heatGlow;
  ctx.beginPath();
  ctx.arc(0, -4, player.radius * (1.2 + pulse * 0.1), 0, TAU);
  ctx.fill();

  ctx.shadowColor = '#ff8a1f';
  ctx.shadowBlur = 14;
  for (let i = 0; i < 11; i++) {
    const seed = player.id * 31.4 + i * 2.7;
    const local = (now / 650 + noise01(seed)) % 1;
    const px = (noise01(seed + 1) - 0.5) * (player.radius * 2);
    const py = 12 - local * (player.radius * 2.5 + 14);
    const size = 2.1 + noise01(seed + 2) * 2.9;
    ctx.fillStyle = local < 0.25 ? '#fff7d1' : local < 0.62 ? '#ffbe5c' : '#ff6b1a';
    ctx.beginPath();
    ctx.arc(px, py, size * (1 - local * 0.25), 0, TAU);
    ctx.fill();
  }

  ctx.rotate(aim);
  const frontGlow = ctx.createLinearGradient(player.radius * 0.3, 0, player.radius + 24, 0);
  frontGlow.addColorStop(0, 'rgba(255,214,128,0)');
  frontGlow.addColorStop(0.35, 'rgba(255,170,64,0.24)');
  frontGlow.addColorStop(1, 'rgba(255,96,24,0)');
  ctx.fillStyle = frontGlow;
  ctx.beginPath();
  ctx.ellipse(player.radius + 13, 0, 16 + pulse * 4, 8 + pulse * 2, 0, 0, TAU);
  ctx.fill();

  for (const side of [-1, 0, 1] as const) {
    const flameX = player.radius + 12 + (side === 0 ? 2 : 0);
    const flameY = side * 6;
    const flameH = (12 + Math.sin(now / 95 + side) * 4 + (side === 0 ? 4 : 0)) * pulse;
    const flameW = (4.8 + Math.sin(now / 120 + side * 0.4) * 1.3) * (side === 0 ? 1.2 : 1);

    ctx.fillStyle = side === 0 ? 'rgba(255,108,24,0.88)' : 'rgba(255,92,18,0.78)';
    ctx.beginPath();
    ctx.moveTo(flameX - flameW, flameY + 2);
    ctx.quadraticCurveTo(flameX, flameY - flameH, flameX + flameW, flameY + 2);
    ctx.quadraticCurveTo(flameX, flameY - flameH * 0.22, flameX - flameW, flameY + 2);
    ctx.fill();

    ctx.fillStyle = side === 0 ? 'rgba(255,241,194,0.86)' : 'rgba(255,226,142,0.78)';
    ctx.beginPath();
    ctx.moveTo(flameX - flameW * 0.45, flameY + 1);
    ctx.quadraticCurveTo(flameX, flameY - flameH * 0.62, flameX + flameW * 0.45, flameY + 1);
    ctx.quadraticCurveTo(flameX, flameY - flameH * 0.16, flameX - flameW * 0.45, flameY + 1);
    ctx.fill();
  }
  // 移除了角色面相方向的線條 (directional sparks)，保留周圍的火焰特效
  ctx.restore();
}

function drawShieldAura(ctx: CanvasRenderingContext2D, player: Player, now: number): void {
  if (!player.shield) return;

  const fade = player.shieldTimer < 700
    ? 0.55 + 0.45 * (Math.sin(now / 45) * 0.5 + 0.5)
    : 1;
  const flash = Math.min(1, player.shieldHitFlashTimer / 220);
  const shellR = player.radius + 8 + Math.sin(now / 170) * 1.5 + flash * 1.8;
  const spin = now / 520;

  ctx.save();
  ctx.globalAlpha = (0.95 + flash * 0.15) * fade;

  const shell = ctx.createRadialGradient(-shellR * 0.3, -shellR * 0.45, 2, 0, 0, shellR + 7);
  shell.addColorStop(0, `rgba(255,255,255,${0.2 + flash * 0.18})`);
  shell.addColorStop(0.35, `rgba(130,220,255,${0.18 + flash * 0.1})`);
  shell.addColorStop(0.75, `rgba(60,150,255,${0.12 + flash * 0.1})`);
  shell.addColorStop(1, 'rgba(30,90,210,0)');
  ctx.fillStyle = shell;
  ctx.beginPath();
  ctx.arc(0, 0, shellR + 4, 0, TAU);
  ctx.fill();

  ctx.strokeStyle = flash > 0.1 ? 'rgba(244,252,255,0.96)' : 'rgba(180,240,255,0.82)';
  ctx.lineWidth = 2.2 + flash * 0.9;
  ctx.beginPath();
  ctx.arc(0, 0, shellR, 0, TAU);
  ctx.stroke();

  ctx.lineCap = 'round';
  ctx.shadowColor = flash > 0.08 ? '#eff6ff' : '#7dd3fc';
  ctx.shadowBlur = 8 + flash * 10;
  for (let i = 0; i < 3; i++) {
    const start = spin + i * 2.12;
    ctx.strokeStyle = i === 1
      ? `rgba(255,255,255,${0.82 + flash * 0.12})`
      : `rgba(110,225,255,${0.72 + flash * 0.08})`;
    ctx.lineWidth = (i === 1 ? 2.6 : 2) + flash * 0.6;
    ctx.beginPath();
    ctx.arc(0, 0, shellR + i * 1.4, start, start + 0.78 + flash * 0.1);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  for (let i = 0; i < 6; i++) {
    const angle = spin * 1.4 + (i / 6) * TAU;
    const px = Math.cos(angle) * (shellR + 1.5);
    const py = Math.sin(angle) * (shellR + 1.5);
    const size = i % 2 === 0 ? 4.5 : 3.4;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle + Math.PI / 4);
    ctx.fillStyle = i % 2 === 0
      ? `rgba(180,240,255,${0.78 + flash * 0.1})`
      : `rgba(93,173,255,${0.72 + flash * 0.12})`;
    ctx.fillRect(-size * 0.5, -size * 0.5, size, size);
    ctx.restore();
  }
  ctx.restore();
}

function drawShieldHitReaction(ctx: CanvasRenderingContext2D, player: Player, now: number): void {
  if (!player.shield || player.shieldHitFlashTimer <= 0) return;

  const impact = Math.min(1, player.shieldHitFlashTimer / 220);
  const burst = 1 - impact;
  const shockR = player.radius + 9 + burst * 12;

  ctx.save();
  ctx.globalAlpha = impact;

  const flash = ctx.createRadialGradient(0, 0, player.radius * 0.3, 0, 0, shockR + 10);
  flash.addColorStop(0, 'rgba(255,255,255,0.18)');
  flash.addColorStop(0.4, 'rgba(191,233,255,0.18)');
  flash.addColorStop(1, 'rgba(125,211,252,0)');
  ctx.fillStyle = flash;
  ctx.beginPath();
  ctx.arc(0, 0, shockR + 4, 0, TAU);
  ctx.fill();

  ctx.shadowColor = '#ffffff';
  ctx.shadowBlur = 16;
  ctx.strokeStyle = `rgba(255,255,255,${0.74 * impact})`;
  ctx.lineWidth = 3.4 - burst * 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, shockR, 0, TAU);
  ctx.stroke();

  for (let i = 0; i < 7; i++) {
    const angle = now / 220 + (i / 7) * TAU;
    const innerR = player.radius + 5 + burst * 3;
    const outerR = shockR + 6 + (i % 2) * 4;
    const x1 = Math.cos(angle) * innerR;
    const y1 = Math.sin(angle) * innerR;
    const x2 = Math.cos(angle) * outerR;
    const y2 = Math.sin(angle) * outerR;

    ctx.strokeStyle = i % 2 === 0
      ? `rgba(255,255,255,${0.68 * impact})`
      : `rgba(125,211,252,${0.62 * impact})`;
    ctx.lineWidth = i % 2 === 0 ? 2.1 : 1.6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  for (let i = 0; i < 5; i++) {
    const angle = now / 180 + (i / 5) * TAU;
    const px = Math.cos(angle) * (shockR + 2);
    const py = Math.sin(angle) * (shockR + 2);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle + Math.PI / 4);
    ctx.fillStyle = i % 2 === 0
      ? `rgba(255,255,255,${0.58 * impact})`
      : `rgba(147,197,253,${0.5 * impact})`;
    ctx.fillRect(-2.2, -2.2, 4.4, 4.4);
    ctx.restore();
  }
  ctx.restore();
}

// ── 武器槽位座標矩陣（export 供 PlayerPreviewCanvas 點擊熱區使用）────────────
// 相對於玩家中心的偏移（px），右 3 把 rx>0，左 3 把 rx<0
export const WEAPON_SLOT_POSITIONS = [
  { rx: 44, ry: 0 }, // 0: 右中
  { rx: -44, ry: 0 }, // 1: 左中
  { rx: -44, ry: -26 }, // 2: 左上
  { rx: 44, ry: -26 }, // 3: 右上
  { rx: -44, ry: 26 }, // 4: 左下
  { rx: 44, ry: 26 }, // 5: 右下
];

/**
 * ── 全局高級武器渲染模組 ──
 * 封裝了平滑描邊、稀有度顏色與互動 Dim 效果。
 * 呼叫此函式即可獲得全遊戲統一的高質感武器呈現。
 */
export function drawWeaponWithPremiumStyle(
  ctx: CanvasRenderingContext2D,
  player: Player,
  slot: import('../Player').WeaponSlot,
  options?: {
    isOtherSelected?: boolean;
    dimUnselected?: boolean;
    forceSmooth?: boolean;
    scale?: number;
  }
): void {
  const wKey = getWeaponKey(slot.type, slot.level, slot.branch);
  const weaponDef = WEAPON_REGISTRY[slot.type]?.[wKey];
  if (!weaponDef) return;

  const isOtherSelected = options?.isOtherSelected ?? false;
  const dimUnselected = options?.dimUnselected ?? false;
  const scale = options?.scale ?? 1.0;

  // 保存原始狀態
  ctx.save();
  if (scale !== 1.0) ctx.scale(scale, scale);

  // 1. 決定稀有度顏色 (1:White/Black, 2:Green, 3:Blue, 4:Purple, 5+:Gold)
  const rarityColor = slot.level >= 5
    ? '#fbbf24'
    : ['#000000', '#4ade80', '#60a5fa', '#c084fc'][Math.min(slot.level - 1, 3)];

  // 2. 透明度處理：如果是副武器則變暗
  if (isOtherSelected && dimUnselected) {
    ctx.globalAlpha *= 0.25;
  }

  // 🔽 核心：徹底固定渲染模式
  // 全軍統一使用 1.6 像素的「8 向位移疊加」實體厚邊框
  const thickness = 1.6;

  // 3. 繪製 8 層厚描邊 (Solid Outline)
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.shadowColor = rarityColor;
  
  const dirs = [
    {x:thickness, y:0}, {x:-thickness, y:0}, {x:0, y:thickness}, {x:0, y:-thickness},
    {x:thickness, y:thickness}, {x:-thickness, y:thickness}, {x:thickness, y:-thickness}, {x:-thickness, y:-thickness}
  ];

  // 🔔 標記目前為描邊階段，讓火花等特效自動跳過，避免火花也帶有描邊
  (ctx as any).isOutlinePass = true;

  dirs.forEach(d => {
    ctx.shadowOffsetX = d.x;
    ctx.shadowOffsetY = d.y;
    weaponDef.drawWeapon(ctx, player, slot);
  });

  (ctx as any).isOutlinePass = false;

  // 4. 重置 Shadow 狀態，確保本體乾淨
  ctx.restore(); 

  // 5. 繪製最終本體 (第 9 層)
  weaponDef.drawWeapon(ctx, player, slot);
  
  // 還原最外層狀態
  ctx.restore();
}

const PLAYER_WALK_ROWS = 8;
const PLAYER_WALK_COLS = 3;
const PLAYER_WALK_FRAME_MS = 145;
const PLAYER_DRAW_HEIGHT_MULT = 5.0;
const PLAYER_CENTERED_DRAW_HEIGHT_MULT = 4.4;

const PLAYER_DIRECTION_VECTORS = [
  { x: 0, y: 1 },   // down
  { x: -1, y: 1 },  // down-left
  { x: -1, y: 0 },  // left
  { x: -1, y: -1 }, // up-left
  { x: 0, y: -1 },  // up
  { x: 1, y: -1 },  // up-right
  { x: 1, y: 0 },   // right
  { x: 1, y: 1 },   // down-right
].map((dir) => {
  const len = Math.hypot(dir.x, dir.y) || 1;
  return { x: dir.x / len, y: dir.y / len };
});

function getPlayerDirectionRow(player: Player): number {
  const facing = getFacingVector(player);
  let bestRow = 0;
  let bestDot = -Infinity;

  PLAYER_DIRECTION_VECTORS.forEach((dir, row) => {
    const dot = facing.x * dir.x + facing.y * dir.y;
    if (dot > bestDot) {
      bestDot = dot;
      bestRow = row;
    }
  });

  return bestRow;
}

function drawFallbackPlayerBody(player: Player, ctx: CanvasRenderingContext2D, angle: number): void {
  ctx.save();
  ctx.rotate(angle);
  ctx.fillStyle = '#ffccaa';
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(10, -10, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(15, 10, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = player.color;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#222';
  ctx.stroke();
  ctx.closePath();
}

function drawPlayerSpriteBody(player: Player, ctx: CanvasRenderingContext2D, now: number): boolean {
  const sheetUrl = PLAYER_WALK_SHEET_URLS[player.id] ?? PLAYER_WALK_SHEET_URLS[1];
  const sheet = getChromaSprite(sheetUrl);
  if (!sheet) return false;

  const row = getPlayerDirectionRow(player);
  const frame = player.isMoving ? Math.floor(now / PLAYER_WALK_FRAME_MS) % PLAYER_WALK_COLS : 1;
  const cellW = sheet.width / PLAYER_WALK_COLS;
  const cellH = sheet.height / PLAYER_WALK_ROWS;
  const sx = Math.round(frame * cellW);
  const sy = Math.round(row * cellH);
  const sw = Math.round((frame + 1) * cellW) - sx;
  const sh = Math.round((row + 1) * cellH) - sy;
  const heightMult = player.id === 1 ? PLAYER_CENTERED_DRAW_HEIGHT_MULT : PLAYER_DRAW_HEIGHT_MULT;
  const drawH = player.radius * heightMult;
  const drawW = drawH * (sw / sh);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sheet, sx, sy, sw, sh, -drawW / 2, -drawH / 2, drawW, drawH);
  ctx.restore();
  return true;
}

export function drawPlayer(player: Player, ctx: CanvasRenderingContext2D, options?: {
  hideUI?: boolean;
  selectedSlotIdx?: number | null;
  dimUnselected?: boolean;
  weaponScale?: number;
}): void {
  if (player.hp <= 0) return;

  const angle = player.aimAngle;
  const now = Date.now();

  ctx.save();
  if (player.isInsideContainer) ctx.globalAlpha = 0.4;
  ctx.translate(player.x, player.y);

  // Infinite mode glow
  if (player.level >= 5 || player.isInfiniteGlow) {
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 15;
  }

  // Weapon switch ring
  if (player.weaponSwitchTimer > 0) {
    const progress = 1 - (player.weaponSwitchTimer / 500);
    ctx.beginPath(); ctx.arc(0, 0, player.radius + progress * 40, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${1 - progress})`; ctx.lineWidth = 4 * (1 - progress); ctx.stroke();
  }

  // Shadow
  ctx.beginPath(); ctx.arc(4, 6, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill(); ctx.closePath();

  drawSlowDebuffAura(ctx, player, now);
  drawAltarGroundAura(ctx, player, now);
  drawSpeedBoostAura(ctx, player, now);

  // ── 武器渲染（統一使用浮空武器體系） ─────────────────────────────
  if (player.weapons && player.weapons.length > 0) {
    player.weapons.forEach((slot, i) => {
      // ── 正確帶入 branch，確保 Lv5+ 分支武器能找到對應的 drawWeapon ──
      const wKey = getWeaponKey(slot.type, slot.level, slot.branch);
      const weaponDef = WEAPON_REGISTRY[slot.type]?.[wKey];
      if (weaponDef) {
        ctx.save();
        const time = Date.now();

        const slotPos = WEAPON_SLOT_POSITIONS[i % WEAPON_SLOT_POSITIONS.length];

        // ── 互動邏輯：當有選中某把武器時，其餘武器不呼吸 (bob=0) 並變暗 ──
        const isSelected = options?.selectedSlotIdx === i;
        const isOtherSelected = options?.selectedSlotIdx !== undefined && options?.selectedSlotIdx !== null && !isSelected;
        const bob = isOtherSelected ? 0 : Math.sin(time / 300 + i) * 4;

        const facingAngle = slotPos.rx > 0 ? 0 : Math.PI;
        ctx.translate(slotPos.rx, slotPos.ry + bob);
        
        // 優先使用 slot 個別的 aimAngle（如有索敵），否則使用玩家朝向
        const finalAngle = slot.aimAngle !== undefined ? slot.aimAngle : facingAngle;
        ctx.rotate(finalAngle);

        // 預覽模式下，左側武器水平翻轉避免上下顛倒
        if ((player as any).isPreview && Math.abs(finalAngle) > Math.PI / 2) {
          ctx.scale(1, -1);
        }

        // ── 槍械後座力 ──
        if (slot.type === 'gun') {
          const timeSinceAttack = Date.now() - slot.lastAttackTime;
          if (timeSinceAttack < 150) {
            const recoil = Math.max(0, 8 - (timeSinceAttack / 150) * 8);
            ctx.translate(slotPos.rx > 0 ? -recoil : recoil, 0);
          }
        }

        // ── 使用封裝好的 Premium 渲染模組 ──
        drawWeaponWithPremiumStyle(ctx, player, slot, {
          isOtherSelected,
          dimUnselected: options?.dimUnselected,
          scale: options?.weaponScale ?? 1.0,
          forceSmooth: player.weaponSwitchTimer > 0 // 換槍時強制平滑
        });

        ctx.restore();
      }
    });
  } else {
    // ── 傳統單手武器模式：同樣套用統一的高級渲染模組 ──
    ctx.save();
    ctx.rotate(angle);

    const slot: import('../Player').WeaponSlot = {
      id: 'main',
      type: player.weapon,
      level: player.weaponLevels[player.weapon],
      branch: player.weaponBranches[player.weapon],
      lastAttackTime: player.lastAttackTime,
    };

    // ── 槍械後座力 ──
    if (slot.type === 'gun') {
      const timeSinceAttack = Date.now() - slot.lastAttackTime;
      if (timeSinceAttack < 150) {
        const recoil = Math.max(0, 8 - (timeSinceAttack / 150) * 8);
        ctx.translate(-recoil, 0);
      }
    }

    // ── 換彈/換槍發光特效與高級描邊整合 ──
    const forceSmooth = player.weaponSwitchTimer > 0;
    
    drawWeaponWithPremiumStyle(ctx, player, slot, {
      forceSmooth,
      // 如果正在換槍，可以考慮微調顏色或厚度，這裡維持一致以保證「紮實感」
    });

    ctx.restore();
  }

  if (!drawPlayerSpriteBody(player, ctx, now)) {
    drawFallbackPlayerBody(player, ctx, angle);
  }

  drawRegenAura(ctx, player, now);
  drawAltarFrontAura(ctx, player, now);
  drawShieldAura(ctx, player, now);
  drawShieldHitReaction(ctx, player, now);

  ctx.restore();

  if (!options?.hideUI) {
    // HP Bar（world-space）
    const hpRatio = player.hp / player.maxHp;
    ctx.fillStyle = 'red'; ctx.fillRect(player.x - 15, player.y - 25, 30, 4);
    ctx.fillStyle = 'green'; ctx.fillRect(player.x - 15, player.y - 25, 30 * hpRatio, 4);
  }

  if (!options?.hideUI) {
    // Level indicator
    ctx.fillStyle = 'white'; ctx.font = 'bold 12px Arial'; ctx.textAlign = 'center';
    if (player.isFloatingWeapons) {
      ctx.fillText(`Lv.${player.level}`, player.x, player.y - 30);
    } else {
      const wLv = player.weaponLevels[player.weapon];
      const branch = player.weaponBranches[player.weapon];
      const branchTag = branch ? `[${branch}]` : '';
      const levelText = `Lv.${player.level}  ⚔${wLv}${branchTag}`;
      ctx.fillStyle = branch === 'A' ? '#4fc3f7' : branch === 'B' ? '#ff8a65' : 'white';
      ctx.fillText(levelText, player.x, player.y - 30);
    }
  }
}
