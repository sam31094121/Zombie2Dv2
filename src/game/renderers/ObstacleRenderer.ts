// ── ObstacleRenderer.ts ───────────────────────────────────────────────────────
// 障礙物繪圖邏輯（從 Obstacle.ts 分離）
// 新增障礙物外觀：在 drawObstacle() 加 case，Obstacle.ts 零修改
// ─────────────────────────────────────────────────────────────────────────────
import { Obstacle } from '../map/Obstacle';
import { Player } from '../Player';

export function drawObstacle(obs: Obstacle, ctx: CanvasRenderingContext2D, players?: Player[]): void {
  if (obs.isDestroyed) {
    if (obs.type !== 'explosive_barrel' && obs.type !== 'vending_machine' && obs.type !== 'tombstone') {
      drawRubble(obs, ctx);
    }
    return;
  }

  ctx.save();

  const shadowOffsetX = 8;
  const shadowOffsetY = 12;
  const cx = obs.x + obs.width / 2;
  const cy = obs.y + obs.height / 2;
  const r  = obs.width / 2;

  if      (obs.type === 'sandbag')          drawSandbags(obs, ctx, cx, cy, r, shadowOffsetX, shadowOffsetY);
  else if (obs.type === 'electric_fence')   drawElectricFence(obs, ctx, shadowOffsetX, shadowOffsetY);
  else if (obs.type === 'explosive_barrel') drawExplosiveBarrel(obs, ctx, cx, cy, r, shadowOffsetX, shadowOffsetY);
  else if (obs.type === 'streetlight')      drawStreetlight(obs, ctx, cx, cy, r, shadowOffsetX, shadowOffsetY);
  else if (obs.type === 'tombstone')        drawTombstone(obs, ctx, cx, cy, r, shadowOffsetX, shadowOffsetY);
  else if (obs.type === 'vending_machine')  drawVendingMachine(obs, ctx, cx, cy, r, shadowOffsetX, shadowOffsetY);
  else if (obs.type === 'container')        drawContainer(obs, ctx, shadowOffsetX, shadowOffsetY);
  else if (obs.type === 'altar')            drawAltar(obs, ctx, cx, cy, r, shadowOffsetX, shadowOffsetY);
  else if (obs.type === 'monolith')         drawMonolith(obs, ctx, cx, cy, r, shadowOffsetX, shadowOffsetY);
  else if (obs.type === 'tree') {
    const trunkRadius = r * 0.3;
    ctx.beginPath();
    ctx.arc(cx + shadowOffsetX * 0.5, cy + shadowOffsetY * 0.5, trunkRadius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, trunkRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#3a3b3c';
    ctx.fill();
    ctx.strokeStyle = '#1a1b1c';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#2a2b2c';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + obs.seed;
      const branchLen = r * 0.8 + Math.sin(obs.seed * i) * r * 0.4;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx + Math.cos(angle) * branchLen, cy - 10 + Math.sin(angle) * branchLen);
      ctx.stroke();
    }
  } else if (obs.type === 'rock' || obs.type === 'pillar') {
    ctx.beginPath();
    ctx.arc(cx + shadowOffsetX, cy + shadowOffsetY, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2c30';
    ctx.fill();
    ctx.strokeStyle = '#111214';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - 10, r, 0, Math.PI * 2);
    ctx.fillStyle = '#3a3d42';
    ctx.fill();
    ctx.strokeStyle = '#1a1c1f';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - 10 - r * 0.3, r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fill();
    if (obs.type === 'pillar') {
      ctx.strokeStyle = '#5a3030';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy - 10);
      ctx.lineTo(cx + 10, cy - 25);
      ctx.moveTo(cx - 5, cy - 10);
      ctx.lineTo(cx - 15, cy - 20);
      ctx.stroke();
    }
  } else if (obs.type === 'building') {
    ctx.beginPath();
    ctx.arc(cx + shadowOffsetX * 1.5, cy + shadowOffsetY * 1.5, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2c30';
    ctx.fill();
    ctx.strokeStyle = '#111214';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy - 15, r * 0.9, 0, Math.PI * 1.5);
    ctx.lineTo(cx, cy - 15);
    ctx.closePath();
    ctx.fillStyle = '#3a3d42';
    ctx.fill();
    ctx.strokeStyle = '#1a1c1f';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx - 10, cy - 20, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#111214';
    ctx.fill();
    ctx.strokeStyle = '#2a2c30';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#5a3030';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 10, cy - 10);
    ctx.lineTo(cx + 30, cy - 40);
    ctx.moveTo(cx + 20, cy - 5);
    ctx.lineTo(cx + 40, cy - 20);
    ctx.stroke();
  } else {
    // Concrete Barricade (Wall)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(obs.x + shadowOffsetX, obs.y + shadowOffsetY, obs.width, obs.height);
    ctx.fillStyle = '#2a2c30';
    ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
    ctx.strokeStyle = '#111214';
    ctx.lineWidth = 3;
    ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
    ctx.fillStyle = '#3a3d42';
    ctx.fillRect(obs.x, obs.y - 15, obs.width, obs.height);
    ctx.strokeStyle = '#1a1c1f';
    ctx.lineWidth = 2;
    ctx.strokeRect(obs.x, obs.y - 15, obs.width, obs.height);
    ctx.save();
    ctx.beginPath();
    ctx.rect(obs.x, obs.y - 15, obs.width, obs.height);
    ctx.clip();
    ctx.fillStyle = 'rgba(200, 160, 0, 0.6)';
    for (let i = -obs.height; i < obs.width + obs.height; i += 30) {
      ctx.beginPath();
      ctx.moveTo(obs.x + i, obs.y - 15);
      ctx.lineTo(obs.x + i + 15, obs.y - 15);
      ctx.lineTo(obs.x + i - obs.height + 15, obs.y - 15 + obs.height);
      ctx.lineTo(obs.x + i - obs.height, obs.y - 15 + obs.height);
      ctx.fill();
    }
    ctx.restore();
    ctx.fillStyle = '#1a1c1f';
    ctx.beginPath();
    ctx.moveTo(obs.x, obs.y);
    ctx.lineTo(obs.x, obs.y - 15);
    ctx.lineTo(obs.x + obs.width, obs.y - 15);
    ctx.lineTo(obs.x + obs.width, obs.y);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(obs.x + 2, obs.y - 15 + 2, obs.width - 4, 4);
  }

  ctx.restore();
}

// ── 私有繪圖函式 ──────────────────────────────────────────────────────────────

function drawRubble(obs: Obstacle, ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.translate(obs.x + obs.width / 2, obs.y + obs.height / 2);
  ctx.fillStyle = '#444';
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    const rx = (Math.sin(obs.seed + i) * obs.width) / 3;
    const ry = (Math.cos(obs.seed + i * 2) * obs.height) / 3;
    const size = 5 + Math.abs(Math.sin(obs.seed + i * 3)) * 10;
    ctx.beginPath();
    ctx.rect(rx, ry, size, size);
    ctx.fill();
    ctx.stroke();
  }
  ctx.restore();
}

function drawSandbags(obs: Obstacle, ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sox: number, soy: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(cx + sox, cy + soy, r, r * 0.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8d6e63';
  ctx.strokeStyle = '#3e2723';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const ox = (i - 1) * 15;
    const oy = (i % 2) * 5;
    ctx.beginPath();
    ctx.arc(cx + ox, cy + oy, 15, Math.PI, 0);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + ox - 10, cy + oy - 5);
    ctx.lineTo(cx + ox + 10, cy + oy - 5);
    ctx.stroke();
    ctx.strokeStyle = '#3e2723';
    ctx.lineWidth = 3;
  }
}

function drawElectricFence(obs: Obstacle, ctx: CanvasRenderingContext2D, sox: number, soy: number) {
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(obs.x + sox, obs.y + soy);
  ctx.lineTo(obs.x + obs.width + sox, obs.y + obs.height + soy);
  ctx.stroke();
  ctx.fillStyle = '#333';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.strokeRect(obs.x - 5, obs.y - 5, 10, 10);
  ctx.fillRect(obs.x - 5, obs.y - 5, 10, 10);
  ctx.strokeRect(obs.x + obs.width - 5, obs.y + obs.height - 5, 10, 10);
  ctx.fillRect(obs.x + obs.width - 5, obs.y + obs.height - 5, 10, 10);
  ctx.strokeStyle = '#00e5ff';
  ctx.lineWidth = 3;
  ctx.shadowColor = '#00e5ff';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(obs.x, obs.y);
  ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (Date.now() % 2000 < 200) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    const tx = obs.x + (obs.width * (Date.now() % 200)) / 200;
    const ty = obs.y + (obs.height * (Date.now() % 200)) / 200;
    ctx.beginPath();
    ctx.moveTo(tx - 5, ty - 5);
    ctx.lineTo(tx + 5, ty + 5);
    ctx.moveTo(tx + 5, ty - 5);
    ctx.lineTo(tx - 5, ty + 5);
    ctx.stroke();
  }
}

function drawExplosiveBarrel(obs: Obstacle, ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sox: number, soy: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.arc(cx + sox, cy + soy, r, 0, Math.PI * 2);
  ctx.fill();
  if (obs.isTriggered) {
    const flash = Math.sin(Date.now() / 30) > 0;
    ctx.fillStyle = flash ? '#ff0000' : '#d32f2f';
    const scale = 1 + Math.sin(Date.now() / 30) * 0.15;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else {
    ctx.fillStyle = '#d32f2f';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#ffeb3b';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('☠', cx, cy + 5);
}

function drawStreetlight(_obs: Obstacle, ctx: CanvasRenderingContext2D, cx: number, cy: number, _r: number, _sox: number, _soy: number) {
  const auraRadius = 150;
  const pulse = Math.sin(Date.now() / 600) * 0.15 + 0.85;
  const gradient = ctx.createRadialGradient(cx, cy, 10, cx, cy, auraRadius * pulse);
  gradient.addColorStop(0, 'rgba(100, 255, 100, 0.3)');
  gradient.addColorStop(1, 'rgba(100, 255, 100, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, auraRadius * pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#1a1a1a';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#00ff00';
  ctx.beginPath();
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawTombstone(obs: Obstacle, ctx: CanvasRenderingContext2D, cx: number, cy: number, _r: number, sox: number, soy: number) {
  if (obs.isTriggered) {
    const scale = 1 + Math.sin(Date.now() / 20) * 0.3;
    ctx.scale(scale, scale);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fillRect(obs.x + sox, obs.y + soy, obs.width, obs.height);
  ctx.fillStyle = '#455a64';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 3;
  ctx.fillRect(cx - 10, cy - 25, 20, 50);
  ctx.strokeRect(cx - 10, cy - 25, 20, 50);
  ctx.fillRect(cx - 20, cy - 15, 40, 15);
  ctx.strokeRect(cx - 20, cy - 15, 40, 15);
  ctx.fillStyle = 'rgba(156, 39, 176, 0.2)';
  for (let i = 0; i < 3; i++) {
    const ox = Math.sin(Date.now() / 500 + i) * 20;
    const oy = Math.cos(Date.now() / 700 + i) * 10;
    ctx.beginPath();
    ctx.arc(cx + ox, cy + 20 + oy, 15, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawVendingMachine(obs: Obstacle, ctx: CanvasRenderingContext2D, _cx: number, _cy: number, _r: number, sox: number, soy: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(obs.x + sox, obs.y + soy, obs.width, obs.height);
  ctx.fillStyle = '#c62828';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
  ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(obs.x + 5, obs.y + 5, obs.width - 10, obs.height / 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(obs.x + 10, obs.y + 10);
  ctx.lineTo(obs.x + 30, obs.y + 30);
  ctx.moveTo(obs.x + 25, obs.y + 10);
  ctx.lineTo(obs.x + 15, obs.y + 25);
  ctx.stroke();
  ctx.fillStyle = '#ffeb3b';
  ctx.fillRect(obs.x + 5, obs.y + obs.height - 15, 10, 10);
  ctx.fillStyle = '#4caf50';
  ctx.fillRect(obs.x + 20, obs.y + obs.height - 15, 10, 10);
}

function drawContainer(obs: Obstacle, ctx: CanvasRenderingContext2D, sox: number, soy: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(obs.x + sox, obs.y + soy, obs.width, obs.height);
  ctx.fillStyle = '#1a237e';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 5;
  ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
  ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 2;
  for (let i = 10; i < obs.width; i += 20) {
    ctx.beginPath();
    ctx.moveTo(obs.x + i, obs.y);
    ctx.lineTo(obs.x + i, obs.y + obs.height);
    ctx.stroke();
  }
}

function drawAltar(obs: Obstacle, ctx: CanvasRenderingContext2D, cx: number, cy: number, _r: number, sox: number, soy: number) {
  const w = obs.width;
  const h = obs.height;
  const baseW = w * 0.96;
  const baseH = h * 0.54;
  const topW = w * 0.64;
  const topH = h * 0.2;
  const baseY = cy + h * 0.08;
  const topY = cy - h * 0.06;
  const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 260);

  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  ctx.beginPath();
  ctx.ellipse(cx + sox, cy + soy + h * 0.2, baseW * 0.45, baseH * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3f312c';
  ctx.strokeStyle = '#120d0b';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(cx - baseW / 2, baseY - baseH / 2, baseW, baseH, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#5f463a';
  ctx.beginPath();
  ctx.roundRect(cx - topW / 2, topY - topH / 2, topW, topH, 8);
  ctx.fill();

  ctx.fillStyle = '#6c5244';
  ctx.beginPath();
  ctx.moveTo(cx - topW * 0.28, topY - topH * 0.55);
  ctx.lineTo(cx - topW * 0.18, topY - topH * 1.25);
  ctx.lineTo(cx + topW * 0.18, topY - topH * 1.25);
  ctx.lineTo(cx + topW * 0.28, topY - topH * 0.55);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = `rgba(210, 40, 40, ${0.2 + pulse * 0.18})`;
  ctx.beginPath();
  ctx.roundRect(cx - topW * 0.38, topY - topH * 0.28, topW * 0.76, topH * 0.56, 6);
  ctx.fill();

  ctx.strokeStyle = `rgba(255, 110, 110, ${0.28 + pulse * 0.22})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - topW * 0.16, topY);
  ctx.lineTo(cx + topW * 0.16, topY);
  ctx.moveTo(cx, topY - topH * 0.22);
  ctx.lineTo(cx, topY + topH * 0.22);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(255, 180, 140, 0.14)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - baseW * 0.32, baseY - baseH * 0.08);
  ctx.lineTo(cx + baseW * 0.32, baseY - baseH * 0.08);
  ctx.moveTo(cx - baseW * 0.22, baseY + baseH * 0.1);
  ctx.lineTo(cx + baseW * 0.22, baseY + baseH * 0.1);
  ctx.stroke();
}

function drawMonolith(_obs: Obstacle, ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sox: number, soy: number) {
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.moveTo(cx + sox - r, cy + soy);
  ctx.lineTo(cx + sox,     cy + soy - r);
  ctx.lineTo(cx + sox + r, cy + soy);
  ctx.lineTo(cx + sox,     cy + soy + r);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#263238';
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx,     cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx,     cy + r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#fff';
  ctx.shadowColor = '#fff';
  ctx.shadowBlur = 10;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 10);
  ctx.lineTo(cx + 10, cy + 10);
  ctx.moveTo(cx + 10, cy - 10);
  ctx.lineTo(cx - 10, cy + 10);
  ctx.stroke();
  ctx.shadowBlur = 0;
}
