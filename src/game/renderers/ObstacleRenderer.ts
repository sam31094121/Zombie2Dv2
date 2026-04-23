// ── ObstacleRenderer.ts ───────────────────────────────────────────────────────
// 障礙物繪圖邏輯（從 Obstacle.ts 分離）
// 新增障礙物外觀：在 drawObstacle() 加 case，Obstacle.ts 零修改
// ─────────────────────────────────────────────────────────────────────────────
import { Obstacle } from '../map/Obstacle';
import { Player } from '../Player';

export function drawObstacle(obs: Obstacle, ctx: CanvasRenderingContext2D, players?: Player[]): void {
  if (obs.type === 'vending_machine' && obs.isDestroyed && obs.getDestroyedVisualAlpha() <= 0) return;

  if (obs.isDestroyed) {
    if (obs.type === 'vending_machine') {
      // fall through — drawVendingMachine renders its own destroyed state
    } else if (obs.type === 'explosive_barrel') {
      // fall through — drawExplosiveBarrel renders the charred ruin state
    } else {
      if (obs.type !== 'tombstone') drawRubble(obs, ctx);
      return;
    }
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
  else if (obs.type === 'monolith')         drawMonolithCannon(obs, ctx, cx, cy, r, shadowOffsetX, shadowOffsetY);
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

function drawExplosiveBarrel(obs: Obstacle, ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, _sox: number, _soy: number) {
  const vr = r * 1.7; // visual radius larger than collision radius
  const t = Date.now();

  // ── 爆炸後等待復活的焦黑殘骸 ──────────────────────────────────────
  if (obs.isDestroyed) {
    // Respawn progress: 0 = just exploded, 1 = about to respawn
    const respawnProgress = obs.respawnTimer > 0 ? 1 - (obs.respawnTimer / 10000) : 1;
    ctx.save();
    ctx.globalAlpha = 0.7;
    // Charred crater shadow
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.ellipse(cx, cy + vr * 0.3, vr * 0.9, vr * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    // Scorch marks (irregular dark patches)
    ctx.fillStyle = '#1a1a1a';
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2 + 0.3;
      const dist = vr * 0.55;
      ctx.beginPath();
      ctx.ellipse(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist * 0.5, vr * 0.25, vr * 0.15, angle, 0, Math.PI * 2);
      ctx.fill();
    }
    // Flattened barrel rim (visible debris)
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(cx, cy, vr * 0.7, vr * 0.35, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Glowing embers that fade as respawn approaches
    const emberAlpha = Math.max(0, 1 - respawnProgress * 2) * (0.5 + Math.sin(t / 120) * 0.3);
    if (emberAlpha > 0) {
      ctx.globalAlpha = emberAlpha;
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, vr * 0.6);
      grd.addColorStop(0, 'rgba(255,120,0,0.9)');
      grd.addColorStop(1, 'rgba(255,0,0,0)');
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(cx, cy, vr * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Respawn indicator: subtle pulsing ring when > 70% done
    if (respawnProgress > 0.7) {
      const pulse = Math.sin(t / 200) * 0.3 + 0.7;
      ctx.globalAlpha = (respawnProgress - 0.7) / 0.3 * 0.5 * pulse;
      ctx.strokeStyle = '#ef5350';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, vr * 0.8, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
    return;
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + vr * 0.58, vr * 0.74, vr * 0.32, 0, 0, Math.PI * 2);
  ctx.fill();

  if (obs.isTriggered) {
    // Pulsing red-hot explosion warning
    const pulse = Math.sin(t / 40);
    const scale = 1 + pulse * 0.22;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(scale, scale);
    // Outer glow
    const grd = ctx.createRadialGradient(0, 0, vr * 0.3, 0, 0, vr * 1.4);
    grd.addColorStop(0, 'rgba(255,200,0,0.7)');
    grd.addColorStop(0.5, 'rgba(255,60,0,0.4)');
    grd.addColorStop(1, 'rgba(255,0,0,0)');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, vr * 1.4, 0, Math.PI * 2);
    ctx.fill();
    // Body
    ctx.fillStyle = pulse > 0 ? '#ff1a00' : '#cc0000';
    ctx.strokeStyle = '#ff6600';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, vr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  } else {
    // Main body — dark red steel barrel
    const bodyGrd = ctx.createRadialGradient(cx - vr * 0.3, cy - vr * 0.3, vr * 0.1, cx, cy, vr);
    bodyGrd.addColorStop(0, '#ef5350');
    bodyGrd.addColorStop(0.6, '#c62828');
    bodyGrd.addColorStop(1, '#7f0000');
    ctx.fillStyle = bodyGrd;
    ctx.strokeStyle = '#421010';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, vr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }

  // Steel bands — horizontal stripes across the top-down barrel
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (const dy of [-vr * 0.38, 0, vr * 0.38]) {
    const hw = Math.sqrt(Math.max(0, vr * vr - dy * dy)) * 0.92;
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy + dy);
    ctx.lineTo(cx + hw, cy + dy);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';

  // Hazard ☠ label
  if (!obs.isTriggered) {
    ctx.fillStyle = '#ffeb3b';
    ctx.font = `bold ${Math.round(vr * 0.9)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('☠', cx, cy + 1);
  }

  // Top cap highlight
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.beginPath();
  ctx.ellipse(cx - vr * 0.18, cy - vr * 0.3, vr * 0.35, vr * 0.18, -0.5, 0, Math.PI * 2);
  ctx.fill();
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

  const summonRatio = Math.max(0, Math.min(1, obs.tombstoneSummonTimer / 3000));
  ctx.strokeStyle = `rgba(168, 85, 247, ${0.25 + (1 - summonRatio) * 0.4})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy + 18, 22 + (1 - summonRatio) * 8, 0, Math.PI * 2);
  ctx.stroke();

  const hpRatio = Math.max(0, obs.hp / Math.max(1, obs.maxHp));
  const barW = 44;
  const barH = 5;
  ctx.fillStyle = 'rgba(20, 20, 20, 0.85)';
  ctx.fillRect(cx - barW / 2, cy - 38, barW, barH);
  ctx.fillStyle = '#a855f7';
  ctx.fillRect(cx - barW / 2, cy - 38, barW * hpRatio, barH);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - barW / 2, cy - 38, barW, barH);
}

function drawVendingMachine(obs: Obstacle, ctx: CanvasRenderingContext2D, cx: number, cy: number, _r: number, sox: number, soy: number) {
  const W = obs.width;
  const H = obs.height;
  const x = obs.x;
  const y = obs.y;

  if (obs.isDestroyed) {
    const alpha = obs.getDestroyedVisualAlpha();
    if (alpha <= 0) return;

    // Knocked-over wreckage
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(cx, cy + H * 0.3);
    ctx.rotate(0.42); // tipped over
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-W / 2 + 4, -H * 0.28 + 4, W, H * 0.55);
    ctx.fillStyle = '#7f1212';
    ctx.strokeStyle = '#2a0000';
    ctx.lineWidth = 3;
    ctx.fillRect(-W / 2, -H * 0.28, W, H * 0.55);
    ctx.strokeRect(-W / 2, -H * 0.28, W, H * 0.55);
    // Shattered glass panel
    ctx.fillStyle = 'rgba(150,210,255,0.18)';
    ctx.fillRect(-W / 2 + 4, -H * 0.25, W - 8, H * 0.32);
    ctx.strokeStyle = 'rgba(180,230,255,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 4; i++) {
      const bx = -W / 2 + 4 + (i % 2) * (W * 0.4) + Math.sin(obs.seed + i) * 8;
      const by = -H * 0.22 + Math.floor(i / 2) * (H * 0.15) + Math.cos(obs.seed + i) * 4;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx + 8 + Math.sin(obs.seed * i) * 5, by + 5);
      ctx.lineTo(bx - 3, by + 10);
      ctx.stroke();
    }
    // Scattered items on ground
    const itemColors = ['#ffeb3b', '#4caf50', '#f44336', '#2196f3'];
    for (let i = 0; i < 5; i++) {
      const ix = Math.sin(obs.seed + i * 2.3) * W * 0.8;
      const iy = Math.cos(obs.seed + i * 1.7) * H * 0.4 + H * 0.3;
      ctx.fillStyle = itemColors[i % itemColors.length];
      ctx.beginPath();
      ctx.arc(ix, iy, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return;
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(x + sox * 0.8, y + soy * 0.8, W, H);

  // Main body
  ctx.fillStyle = '#b71c1c';
  ctx.strokeStyle = '#1a0000';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(x, y, W, H, 6);
  ctx.fill();
  ctx.stroke();

  // Top brand strip
  ctx.fillStyle = '#e53935';
  ctx.beginPath();
  ctx.roundRect(x + 3, y + 3, W - 6, H * 0.14, [6, 6, 0, 0]);
  ctx.fill();

  // Brand text "VEND"
  ctx.fillStyle = '#ffeb3b';
  ctx.font = `bold ${Math.round(H * 0.1)}px Arial`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VEND', cx, y + H * 0.08);

  // Glass display window
  const winX = x + W * 0.1;
  const winY = y + H * 0.18;
  const winW = W * 0.8;
  const winH = H * 0.46;
  ctx.fillStyle = '#0d1b2a';
  ctx.strokeStyle = '#333';
  ctx.lineWidth = 2;
  ctx.fillRect(winX, winY, winW, winH);
  ctx.strokeRect(winX, winY, winW, winH);

  // Items in window — 2 rows × 3 cols
  const itemCols = 3;
  const itemRows = 2;
  const cellW = winW / itemCols;
  const cellH = winH / itemRows;
  const itemDefs = [
    { color: '#ffeb3b', label: '★' },
    { color: '#4caf50', label: '+' },
    { color: '#f44336', label: '♦' },
    { color: '#2196f3', label: '●' },
    { color: '#ff9800', label: '▲' },
    { color: '#e91e63', label: '♥' },
  ];
  for (let row = 0; row < itemRows; row++) {
    for (let col = 0; col < itemCols; col++) {
      const idx = row * itemCols + col;
      const item = itemDefs[idx];
      const ix = winX + cellW * col + cellW / 2;
      const iy = winY + cellH * row + cellH / 2;
      ctx.fillStyle = item.color;
      ctx.font = `bold ${Math.round(cellH * 0.45)}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(item.label, ix, iy);
    }
  }

  // Glass glare
  ctx.fillStyle = 'rgba(255,255,255,0.07)';
  ctx.fillRect(winX + 2, winY + 2, winW * 0.35, winH);

  // Bottom panel: slot + buttons
  const panelY = y + H * 0.68;
  const panelH = H * 0.28;
  ctx.fillStyle = '#7f1212';
  ctx.fillRect(x + 3, panelY, W - 6, panelH);

  // Coin slot
  ctx.fillStyle = '#111';
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(cx - 8, panelY + panelH * 0.12, 16, 5, 2);
  ctx.fill();
  ctx.stroke();

  // Dispense tray
  ctx.fillStyle = '#1a1a1a';
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(x + W * 0.15, panelY + panelH * 0.55, W * 0.7, panelH * 0.35, 2);
  ctx.fill();
  ctx.stroke();

  // HP bar
  const hpRatio = Math.max(0, obs.hp / Math.max(1, obs.maxHp));
  const barW = W - 8;
  const barX = x + 4;
  const barY = y - 9;
  ctx.fillStyle = 'rgba(10,10,10,0.8)';
  ctx.fillRect(barX, barY, barW, 5);
  const hpColor = hpRatio > 0.5 ? '#4caf50' : hpRatio > 0.25 ? '#ff9800' : '#f44336';
  ctx.fillStyle = hpColor;
  ctx.fillRect(barX, barY, barW * hpRatio, 5);
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, 5);
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

function drawAltar(obs: Obstacle, ctx: CanvasRenderingContext2D, cx: number, cy: number, _r: number, _sox: number, _soy: number) {
  if (obs.isDestroyed) return;
  const t = Date.now();
  const pulse = 0.5 + 0.5 * Math.sin(t / 320);
  const rotate = (t / 3000) % (Math.PI * 2);
  const RANGE = 120;

  // Floor range indicator — subtle glow ring
  const rangeGrd = ctx.createRadialGradient(cx, cy, RANGE * 0.7, cx, cy, RANGE);
  rangeGrd.addColorStop(0, `rgba(255,100,0,${0.06 + pulse * 0.04})`);
  rangeGrd.addColorStop(1, 'rgba(255,100,0,0)');
  ctx.fillStyle = rangeGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, RANGE, 0, Math.PI * 2);
  ctx.fill();

  // Outer ritual ring
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotate);
  ctx.strokeStyle = `rgba(230,80,20,${0.35 + pulse * 0.2})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.arc(0, 0, 36, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Rune triangles
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const x1 = Math.cos(a) * 36, y1 = Math.sin(a) * 36;
    const x2 = Math.cos(a + (Math.PI * 2 / 3)) * 36, y2 = Math.sin(a + (Math.PI * 2 / 3)) * 36;
    ctx.strokeStyle = `rgba(255,140,60,${0.4 + pulse * 0.3})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();

  // Inner stone base — top-down flat circle
  const stoneGrd = ctx.createRadialGradient(cx, cy - 4, 6, cx, cy, 22);
  stoneGrd.addColorStop(0, '#5c3d2e');
  stoneGrd.addColorStop(1, '#2e1a10');
  ctx.fillStyle = stoneGrd;
  ctx.strokeStyle = '#1a0a05';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // Central flame cluster (floor-level fire totem)
  ctx.save();
  ctx.translate(cx, cy);
  for (let i = 0; i < 5; i++) {
    const fa = (i / 5) * Math.PI * 2 + rotate * 0.4;
    const fr = 6 + Math.sin(t / 200 + i) * 3;
    const fx = Math.cos(fa) * fr;
    const fy = Math.sin(fa) * fr;
    const fh = 9 + Math.sin(t / 150 + i * 1.7) * 4;
    const fireGrd = ctx.createRadialGradient(fx, fy, 0, fx, fy - fh, fh);
    fireGrd.addColorStop(0, 'rgba(255,220,50,0.9)');
    fireGrd.addColorStop(0.4, 'rgba(255,80,10,0.7)');
    fireGrd.addColorStop(1, 'rgba(200,20,0,0)');
    ctx.fillStyle = fireGrd;
    ctx.beginPath();
    ctx.ellipse(fx, fy - fh * 0.3, 5, fh * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Core hot spot
  ctx.fillStyle = `rgba(255,255,180,${0.7 + pulse * 0.3})`;
  ctx.beginPath();
  ctx.arc(0, 0, 4 + pulse * 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMonolith(obs: Obstacle, ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sox: number, soy: number) {
  const t = Date.now();
  const CHARGE_MAX = 20;
  const chargeRatio = Math.min(1, (obs.monolithCharge ?? 0) / CHARGE_MAX);
  const pulse = 0.5 + 0.5 * Math.sin(t / 220);
  const nearFull = chargeRatio > 0.7;

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.moveTo(cx + sox - r, cy + soy);
  ctx.lineTo(cx + sox,     cy + soy - r);
  ctx.lineTo(cx + sox + r, cy + soy);
  ctx.lineTo(cx + sox,     cy + soy + r);
  ctx.closePath();
  ctx.fill();

  // Outer charge aura — grows brighter as charge fills
  if (chargeRatio > 0) {
    const auraAlpha = chargeRatio * (nearFull ? 0.45 + pulse * 0.25 : 0.25);
    const auraGrd = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.2);
    auraGrd.addColorStop(0, `rgba(80,160,255,${auraAlpha})`);
    auraGrd.addColorStop(1, 'rgba(40,80,200,0)');
    ctx.fillStyle = auraGrd;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Main crystal body — diamond / obelisk shape
  const bodyGrd = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
  bodyGrd.addColorStop(0, '#1a2a3f');
  bodyGrd.addColorStop(0.4, '#263f5a');
  bodyGrd.addColorStop(1, '#0d1a2a');
  ctx.fillStyle = bodyGrd;
  ctx.strokeStyle = '#061018';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r, cy);
  ctx.lineTo(cx,     cy - r);
  ctx.lineTo(cx + r, cy);
  ctx.lineTo(cx,     cy + r);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Inner crystal facets
  ctx.strokeStyle = `rgba(100,180,255,0.2)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.5, cy);
  ctx.lineTo(cx, cy - r * 0.8);
  ctx.lineTo(cx + r * 0.5, cy);
  ctx.moveTo(cx - r * 0.5, cy);
  ctx.lineTo(cx, cy + r * 0.8);
  ctx.lineTo(cx + r * 0.5, cy);
  ctx.stroke();

  // Energy core — glows blue, brightens when charged
  const coreRadius = 6 + chargeRatio * 6;
  const coreAlpha = 0.5 + chargeRatio * 0.5;
  ctx.shadowColor = '#60b0ff';
  ctx.shadowBlur = 8 + chargeRatio * 14;
  const coreGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
  coreGrd.addColorStop(0, `rgba(200,230,255,${coreAlpha})`);
  coreGrd.addColorStop(0.5, `rgba(80,160,255,${coreAlpha * 0.8})`);
  coreGrd.addColorStop(1, 'rgba(40,80,200,0)');
  ctx.fillStyle = coreGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Charge arc ring — partial circle showing charge level
  if (chargeRatio > 0) {
    const arcColor = nearFull
      ? `rgba(160,220,255,${0.7 + pulse * 0.3})`
      : `rgba(80,160,255,${0.5 + chargeRatio * 0.3})`;
    ctx.strokeStyle = arcColor;
    ctx.lineWidth = nearFull ? 3 : 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 5, -Math.PI / 2, -Math.PI / 2 + chargeRatio * Math.PI * 2);
    ctx.stroke();
  }

  // Orbiting energy sparks when nearly full
  if (nearFull) {
    const orbitCount = 3;
    for (let i = 0; i < orbitCount; i++) {
      const oa = (t / 400 + (i / orbitCount) * Math.PI * 2);
      const ox = cx + Math.cos(oa) * (r + 8);
      const oy = cy + Math.sin(oa) * (r + 8);
      ctx.fillStyle = `rgba(160,220,255,${0.6 + pulse * 0.4})`;
      ctx.shadowColor = '#60b0ff';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(ox, oy, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

function drawMonolithCannon(obs: Obstacle, ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, sox: number, soy: number) {
  const t = Date.now();
  const chargeMax = 10;
  const chargeRatio = Math.min(1, (obs.monolithCharge ?? 0) / chargeMax);
  const chargeVisualRatio = obs.monolithVolleyShotsRemaining > 0 ? 1 : chargeRatio;
  const pulse = 0.55 + 0.45 * Math.sin(t / 180);
  const launchRatio = Math.max(0, Math.min(1, obs.monolithLaunchPulse / 160));
  const facing = obs.monolithFacingAngle ?? -Math.PI / 2;
  const recoil = launchRatio * 5.5;
  const nearFull = chargeVisualRatio > 0.72 || obs.monolithVolleyShotsRemaining > 0;

  ctx.fillStyle = 'rgba(0,0,0,0.34)';
  ctx.beginPath();
  ctx.ellipse(cx + sox * 0.5, cy + soy * 0.45, r * 1.25, r * 0.72, 0, 0, Math.PI * 2);
  ctx.fill();

  const isOverheated = (obs.monolithOverheatTimer ?? 0) > 0;
  const baseGlow = ctx.createRadialGradient(cx, cy, r * 0.4, cx, cy, r * 1.9);
  if (isOverheated) {
    const flash = 0.5 + 0.5 * Math.sin(t / 60); // Fast red flash
    baseGlow.addColorStop(0, `rgba(255,50,50,${0.10 + flash * 0.2})`);
    baseGlow.addColorStop(1, 'rgba(68,10,10,0)');
  } else {
    baseGlow.addColorStop(0, `rgba(72,145,255,${0.10 + chargeVisualRatio * 0.15})`);
    baseGlow.addColorStop(1, 'rgba(10,28,68,0)');
  }
  ctx.fillStyle = baseGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.9, 0, Math.PI * 2);
  ctx.fill();

  const baseGrd = ctx.createLinearGradient(cx - r, cy - r, cx + r, cy + r);
  baseGrd.addColorStop(0, '#101a30');
  baseGrd.addColorStop(0.5, '#203352');
  baseGrd.addColorStop(1, '#08111f');
  ctx.fillStyle = baseGrd;
  ctx.strokeStyle = '#020811';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = isOverheated 
    ? `rgba(255,80,80,${0.4 + 0.4 * Math.sin(t / 60)})`
    : `rgba(99,179,255,${0.28 + chargeVisualRatio * 0.35})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.66, -Math.PI / 2, -Math.PI / 2 + (isOverheated ? 1 : chargeVisualRatio) * Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = '#0e182c';
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.45, 0, Math.PI * 2);
  ctx.fill();

  const coreRadius = 6 + chargeVisualRatio * 5 + launchRatio * 3;
  const coreGrd = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreRadius);
  if (isOverheated) {
    const flash = 0.5 + 0.5 * Math.sin(t / 60);
    coreGrd.addColorStop(0, `rgba(255,200,200,${0.85 + flash * 0.15})`);
    coreGrd.addColorStop(0.45, `rgba(255,50,50,${0.75 + flash * 0.2})`);
    coreGrd.addColorStop(1, 'rgba(196,20,20,0)');
    ctx.shadowColor = '#ff3333';
  } else {
    coreGrd.addColorStop(0, `rgba(248,252,255,${0.85 + chargeVisualRatio * 0.15})`);
    coreGrd.addColorStop(0.45, `rgba(96,190,255,${0.75 + chargeVisualRatio * 0.2})`);
    coreGrd.addColorStop(1, 'rgba(19,77,196,0)');
    ctx.shadowColor = '#67c3ff';
  }
  ctx.shadowBlur = 10 + chargeVisualRatio * 12 + launchRatio * 8;
  ctx.fillStyle = coreGrd;
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(facing);
  ctx.translate(-recoil, 0);

  ctx.fillStyle = '#0d1526';
  ctx.beginPath();
  ctx.roundRect(-12, -12, 26, 24, 8);
  ctx.fill();
  ctx.strokeStyle = '#06101d';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = '#173252';
  ctx.beginPath();
  ctx.roundRect(-6, -10, 26, 20, 8);
  ctx.fill();

  const barrelGrd = ctx.createLinearGradient(8, 0, 42, 0);
  if (isOverheated) {
    barrelGrd.addColorStop(0, '#4a1010');
    barrelGrd.addColorStop(0.55, '#9f2525');
    barrelGrd.addColorStop(1, '#ff7f7f');
  } else {
    barrelGrd.addColorStop(0, '#10274a');
    barrelGrd.addColorStop(0.55, '#25589f');
    barrelGrd.addColorStop(1, '#7fd5ff');
  }
  ctx.fillStyle = barrelGrd;
  ctx.beginPath();
  ctx.roundRect(8, -7, 34, 14, 7);
  ctx.fill();
  ctx.strokeStyle = '#041223';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = isOverheated
    ? `rgba(255,180,180,${0.4 + 0.4 * Math.sin(t / 60)})`
    : `rgba(225,248,255,${0.2 + chargeVisualRatio * 0.32 + launchRatio * 0.25})`;
  ctx.beginPath();
  ctx.roundRect(12, -4, 18, 4, 3);
  ctx.fill();

  ctx.fillStyle = '#244873';
  ctx.beginPath();
  ctx.moveTo(10, -11);
  ctx.lineTo(22, -18);
  ctx.lineTo(26, -12);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(10, 11);
  ctx.lineTo(22, 18);
  ctx.lineTo(26, 12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = isOverheated ? '#300c0c' : '#0c1a30';
  ctx.beginPath();
  ctx.arc(42, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = isOverheated ? '#ff7f7f' : '#7fd5ff';
  ctx.lineWidth = 2;
  ctx.stroke();

  const muzzleGrd = ctx.createRadialGradient(42, 0, 0, 42, 0, 10 + launchRatio * 6);
  if (isOverheated) {
    const flash = 0.5 + 0.5 * Math.sin(t / 60);
    muzzleGrd.addColorStop(0, `rgba(255,200,200,${0.8 + launchRatio * 0.2})`);
    muzzleGrd.addColorStop(0.45, `rgba(255,80,80,${0.65 + flash * 0.2})`);
    muzzleGrd.addColorStop(1, 'rgba(255,28,28,0)');
  } else {
    muzzleGrd.addColorStop(0, `rgba(248,252,255,${0.8 + launchRatio * 0.2})`);
    muzzleGrd.addColorStop(0.45, `rgba(120,220,255,${0.65 + chargeVisualRatio * 0.2})`);
    muzzleGrd.addColorStop(1, 'rgba(28,93,255,0)');
  }
  ctx.fillStyle = muzzleGrd;
  ctx.beginPath();
  ctx.arc(42, 0, 10 + launchRatio * 6, 0, Math.PI * 2);
  ctx.fill();

  if (launchRatio > 0) {
    ctx.fillStyle = isOverheated 
      ? `rgba(255,80,80,${0.24 + launchRatio * 0.32})`
      : `rgba(96,190,255,${0.24 + launchRatio * 0.32})`;
    ctx.beginPath();
    ctx.ellipse(58, 0, 22 + launchRatio * 10, 8 + launchRatio * 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  if (nearFull && !isOverheated) {
    for (let i = 0; i < 3; i++) {
      const orbitAngle = (t / 360) + (i / 3) * Math.PI * 2;
      const ox = cx + Math.cos(orbitAngle) * (r + 10);
      const oy = cy + Math.sin(orbitAngle) * (r + 10);
      ctx.fillStyle = `rgba(182,230,255,${0.45 + pulse * 0.3})`;
      ctx.beginPath();
      ctx.arc(ox, oy, 3 + pulse, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
