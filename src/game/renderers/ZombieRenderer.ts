// ???? ZombieRenderer.ts ????????????????????????????????????????????????????????????????????????????????????????????????????????????????
// ?曉??????湔??? Zombie.ts ?????
// ????曉???叟▼??城謓?drawZombie() ??case??ombie.ts ??∟??
// ??????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
import { Zombie } from '../Zombie';
import { getSprite, BUTCHER_FRAME_URLS } from '../sprites/SpriteLoader';

// ???? ??鈭??∵??鞊? ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
// ??? state machine ?閮??鞊???撥? + ???
function getButcherFrameIndex(zombie: Zombie): number {
  const phase = (zombie.extraState.get('phase') ?? 'walk') as string;
  // 5??株都?脣??~4??
  if (phase === 'charging')     return Math.floor(zombie.time / 80)  % 5; // ?寞??賹???
  if (phase === 'slam_windup')  return 4;                                  // ?此??謚??
  if (phase === 'slamming')     return 4;                                  // ??謓菜??
  if (phase === 'pre_charge')   return 0;                                  // ?謕??謚怨翰
  if (phase === 'recovery')     return 0;                                  // ?嚗瑕??謚怨翰
  return Math.floor(zombie.time / 150) % 5;                               // walk?垮??賹???
}

export function drawZombie(zombie: Zombie, ctx: CanvasRenderingContext2D): void {
  // ???? ??鈭?謍???箸慫????????祗 ctx.save ??摰?????????????????????????????????????????????????????????
  if (zombie.type === 'butcher') drawButcherWorldFX(zombie, ctx);
  const isBagCarrier = zombie.extraState.get('bagCarrier') === true;

  // ── BAG CARRIER: completely separate draw path ──────────────────────────
  if (isBagCarrier) {
    drawGoblinCourier(zombie, ctx);
    return;
  }

  ctx.save();
  if (zombie.isInsideContainer) ctx.globalAlpha = 0.4;

  let swayX = 0, swayY = 0;
  let rotation = zombie.angle + Math.PI / 2;

  if (zombie.leanBackTimer > 0) rotation -= Math.PI / 4 * (zombie.leanBackTimer / 300);

  if (zombie.type === 'big') {
    swayX = Math.sin(zombie.time / 400) * 3;
    swayY = Math.abs(Math.cos(zombie.time / 400)) * 2;
    rotation += Math.sin(zombie.time / 400) * 0.15;
  } else if (zombie.type === 'slime' || zombie.type === 'slime_small') {
    swayX = Math.sin(zombie.time / 150) * 2;
    swayY = Math.cos(zombie.time / 150) * 2;
  } else if (zombie.type === 'ghost') {
    swayX = Math.sin(zombie.time / 180) * 2.2;
    swayY = Math.cos(zombie.time / 220) * 3.5;
  } else if (zombie.type === 'butcher') {
    swayX = Math.sin(zombie.time / 600) * 2;
    swayY = Math.abs(Math.cos(zombie.time / 600)) * 1.5;
    // ???謘??蹓潸縣?嚗??????謇唾?擗??摮????
  } else {
    swayX = Math.sin(zombie.time / 100) * 1;
    swayY = Math.cos(zombie.time / 100) * 1;
  }

  ctx.translate(zombie.x + swayX, zombie.y + swayY);
  if (zombie.type !== 'butcher') ctx.rotate(rotation);

  if (zombie.type === 'big') {
    const bounce = Math.abs(Math.sin(zombie.time / 400));
    ctx.scale(1 + bounce * 0.08, 1 - bounce * 0.05);
  } else if (zombie.type === 'slime' || zombie.type === 'slime_small') {
    ctx.scale(1 + Math.sin(zombie.jellyPhase) * 0.15, 1 + Math.cos(zombie.jellyPhase) * 0.15);
  } else if (zombie.type === 'butcher') {
    const bounce = Math.abs(Math.sin(zombie.time / 600));
    ctx.scale(1 + bounce * 0.05, 1 - bounce * 0.04);
  }

  // Shadow
  ctx.beginPath(); ctx.arc(4, 6, zombie.radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill(); ctx.closePath();

  // ???? ??? ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  if (zombie.type === 'big') {
    const armSwing = Math.sin(zombie.time / 400) * 15;
    ctx.fillStyle = '#144d18'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-zombie.radius + 2, 5 + armSwing, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(zombie.radius - 2,  5 - armSwing, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // ???? ??? ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
  if (zombie.type === 'butcher') {
    // ???? ???謖?5???∵?????????????????????????????????????????????????????????????????????????????????????????????????????
    const frameIdx = getButcherFrameIndex(zombie);
    const sprite   = getSprite(BUTCHER_FRAME_URLS[frameIdx]);
    const isEnraged = zombie.hp / zombie.maxHp < 0.3;

    if (isEnraged) {
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur  = 18 + Math.sin(zombie.time / 80) * 8;
    }
    if (zombie.flashWhiteTimer > 0) {
      ctx.filter = 'brightness(10)';
    }

    if (sprite) {
      const size = zombie.radius * 3.2;           // ???輯??扳?蝞?
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    } else {
      // ???垮謓舫????蹇? fallback????蟡???亥血??
      ctx.beginPath(); ctx.arc(0, 0, zombie.radius, 0, Math.PI * 2);
      ctx.fillStyle = zombie.flashWhiteTimer > 0 ? '#ffffff' : '#8b0000';
      ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.filter = 'none';
    ctx.shadowBlur = 0;
  } else {
    if (zombie.type !== 'normal') {
      ctx.beginPath(); ctx.arc(0, 0, zombie.radius, 0, Math.PI * 2);
      if      (zombie.type === 'big')         ctx.fillStyle = '#1b5e20';
      else if (zombie.type === 'slime')       ctx.fillStyle = '#8bc34a';
      else if (zombie.type === 'slime_small') ctx.fillStyle = '#7cb342';
      else if (zombie.type === 'spitter')     ctx.fillStyle = '#9c27b0';
      else                                    ctx.fillStyle = '#4caf50';
      if (zombie.flashWhiteTimer > 0) ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000'; ctx.stroke(); ctx.closePath();
      ctx.shadowBlur = 0;
    }

    // ???? ??改貉??? ????????????????????????????????????????????????????????????????????????????????????????????????????????????????????????
    if (zombie.type === 'normal') {
      const walkCycle = Math.sin(zombie.time / 150);
      // ???
      ctx.fillStyle = zombie.flashWhiteTimer > 0 ? '#ffffff' : (isBagCarrier ? '#f1e4c6' : '#e0e0ce');
      ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-zombie.radius * 0.7, -zombie.radius * 0.9, zombie.radius * 1.4, zombie.radius * 1.2, 4);
      ctx.fill(); ctx.stroke();
      // ?瞏?
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(-zombie.radius * 0.3, -zombie.radius * 0.4, 2.5, 0, Math.PI * 2);
      ctx.arc(zombie.radius * 0.3,  -zombie.radius * 0.4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // ???????謚?
      ctx.fillStyle = '#ff0000';
      ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(-zombie.radius * 0.3, -zombie.radius * 0.4, 1, 0, Math.PI * 2);
      ctx.arc(zombie.radius * 0.3,  -zombie.radius * 0.4, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // ?謕??格??
      ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(i * 2, 0); ctx.lineTo(i * 2, 4); ctx.stroke();
      }
      // ?????
      const armSwing = walkCycle * 5;
      ctx.fillStyle = isBagCarrier ? '#f1e4c6' : '#e0e0ce'; ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(-zombie.radius * 0.9,  armSwing, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc( zombie.radius * 0.9, -armSwing, 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (zombie.type === 'big') {
      ctx.fillStyle = '#8bc34a';
      ctx.beginPath(); ctx.arc(-12,-15,4,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(12,-15,4,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-22,-2); ctx.lineTo(18,12); ctx.stroke();
      for(let i=0;i<6;i++){const t=(i+1)/7;const sx=-22+40*t;const sy=-2+14*t;ctx.beginPath();ctx.moveTo(sx-5,sy+5);ctx.lineTo(sx+5,sy-5);ctx.stroke();}
      ctx.fillStyle = '#9e9e9e'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.rect(-zombie.radius-4,-5,8,10); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.rect(zombie.radius-4,-5,8,10); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-10,-22); ctx.lineTo(10,-22); ctx.lineTo(8,-26); ctx.lineTo(-8,-26); ctx.closePath();
      ctx.fillStyle = '#111'; ctx.fill(); ctx.stroke();
    } else if (zombie.type === 'spitter') {
      ctx.fillStyle = '#8bc34a';
      ctx.beginPath(); ctx.arc(-5,-5,3,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(6,2,4,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(-2,6,2,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#00ff00';
      ctx.beginPath(); ctx.arc(-6,-10,2.5,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(6,-10,2.5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0,-15,4,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#8bc34a'; ctx.beginPath(); ctx.arc(0,-15,2,0,Math.PI*2); ctx.fill();
    } else if (zombie.type === 'ghost') {
      const bob = Math.sin(zombie.time / 180) * 2.5;
      const blink = Math.sin(zombie.time / 520) * 0.5 + 0.5;
      const bodyColor = zombie.flashWhiteTimer > 0 ? '#ffffff' : '#f5f3ff';
      ctx.shadowColor = 'rgba(147, 51, 234, 0.24)';
      ctx.shadowBlur = 14;
      ctx.fillStyle = bodyColor;
      ctx.strokeStyle = '#312e81';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -18 + bob);
      ctx.bezierCurveTo(11, -18 + bob, 15, -10 + bob, 15, -1 + bob);
      ctx.bezierCurveTo(15, 9 + bob, 10, 15 + bob, 5, 18 + bob);
      ctx.quadraticCurveTo(2, 12 + bob, -1, 18 + bob);
      ctx.quadraticCurveTo(-5, 12 + bob, -8, 18 + bob);
      ctx.quadraticCurveTo(-12, 12 + bob, -15, 18 + bob);
      ctx.bezierCurveTo(-17, 10 + bob, -15, 1 + bob, -14, -4 + bob);
      ctx.bezierCurveTo(-13, -13 + bob, -9, -18 + bob, 0, -18 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath(); ctx.arc(-4, -10 + bob, 5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#111827';
      ctx.beginPath(); ctx.ellipse(-4, -10 + bob, 2.8, 4.6 - blink * 1.2, 0.15, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(5, -8 + bob, 2.2, 3.8 - blink, -0.18, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#7c3aed';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-1, -2 + bob); ctx.quadraticCurveTo(3, 1 + bob, 7, -1 + bob); ctx.stroke();
      ctx.fillStyle = '#f472b6';
      ctx.beginPath(); ctx.arc(8, 2 + bob, 1.8, 0, Math.PI * 2); ctx.fill();
      if (zombie.isSummoned && zombie.time < 900) {
        const alpha = 1 - zombie.time / 900;
        ctx.strokeStyle = 'rgba(168,85,247,' + (alpha * 0.75) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 6, 18 - zombie.time / 90, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = 'rgba(96,165,250,' + (alpha * 0.45) + ')';
        ctx.beginPath(); ctx.arc(0, 6, 24 - zombie.time / 70, 0, Math.PI * 2); ctx.stroke();
      }
    } else if (zombie.type === 'slime' || zombie.type === 'slime_small') {
      ctx.fillStyle = '#33691e';
      ctx.beginPath(); ctx.arc(-4,-4,2,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(4,-4,2,0,Math.PI*2); ctx.fill();
    }

  }

  ctx.restore();

  // ???? HP Bar?????箸慫???????????????????????????????????????????????????????????????????????????????????????????????????????????
  const hpRatio = Math.max(0, zombie.hp / zombie.maxHp);
  const bw = zombie.type === 'butcher' ? zombie.radius * 2.5 : zombie.radius * 2;
  const bh = zombie.type === 'big' || zombie.type === 'butcher' ? 5 : 3;
  const isEnraged = zombie.type === 'butcher' && hpRatio < 0.3;
  ctx.fillStyle = 'red';
  ctx.fillRect(zombie.x - bw/2, zombie.y - zombie.radius - 10, bw, bh);
  ctx.fillStyle = isEnraged ? '#ff6600' : 'green';
  ctx.fillRect(zombie.x - bw/2, zombie.y - zombie.radius - 10, bw * hpRatio, bh);
}

// ???? ??鈭?謘??冽??撖?????????+ ?蛔?????????????????????????????????????????????????????????????????????????????
// ── Goblin Courier (Bag Carrier) ──────────────────────────────────────────
function drawGoblinCourier(zombie: Zombie, ctx: CanvasRenderingContext2D): void {
  const bagValue  = Number(zombie.extraState.get('bagRewardValue') ?? 0);
  const tier      = bagValue <= 50 ? 1 : bagValue <= 150 ? 2 : 3;
  const t         = zombie.time;

  const SKIN  = ['#5eead4', '#fdba74', '#c084fc'][tier - 1];
  const DARK  = ['#0d9488', '#c2410c', '#7c3aed'][tier - 1];
  const EAR_I = ['#99f6e4', '#fde68a', '#f0abfc'][tier - 1];
  const PUPIL = ['#0c4a6e', '#7c2d12', '#3b0764'][tier - 1];

  // Spawn-pop scale animation (0 → 1.35 → 1.0 over 600 ms)
  const st = Number(zombie.extraState.get('spawnTimer') ?? 0);
  let spawnScale = 1;
  if (st > 0) {
    const p = 1 - st / 600;
    spawnScale = p < 0.5 ? p * 2 * 1.35 : 1.35 - (p - 0.5) * 2 * 0.35;
    spawnScale = Math.max(0.02, spawnScale);
  }

  const r    = zombie.radius;
  const walk = Math.sin(t / 110);

  // World-space shadow
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(zombie.x + 3, zombie.y + r * 0.65, r * 0.9 * spawnScale, 5 * spawnScale, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Local-space drawing
  ctx.save();
  if (zombie.isInsideContainer) ctx.globalAlpha = 0.4;
  ctx.translate(zombie.x, zombie.y);
  ctx.rotate(zombie.angle + Math.PI / 2);
  ctx.scale(spawnScale, spawnScale);

  const flash = zombie.flashWhiteTimer > 0;
  const bodyColor = flash ? '#ffffff' : SKIN;

  // Feet (trailing behind, +y = backward in local space)
  const fL = walk * 3.5, fR = -walk * 3.5;
  ctx.fillStyle = flash ? '#ffffff' : DARK;
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(-4 + fL, r * 0.82, 3.8, 5.5,  0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse( 4 + fR, r * 0.82, 3.8, 5.5, -0.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Body
  ctx.fillStyle = bodyColor; ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, r * 0.08, r * 0.82, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Body inner highlight
  if (!flash) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.ellipse(-r * 0.22, -r * 0.18, r * 0.38, r * 0.3, -0.4, 0, Math.PI * 2); ctx.fill();
  }

  // Pointy elf ears
  ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
  for (const side of [-1, 1] as const) {
    ctx.fillStyle = bodyColor;
    ctx.beginPath();
    ctx.moveTo(side * r * 0.74,  r * 0.08);
    ctx.lineTo(side * r * 1.18, -r * 0.34);
    ctx.lineTo(side * r * 0.56, -r * 0.46);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    if (!flash) {
      ctx.fillStyle = EAR_I;
      ctx.beginPath();
      ctx.moveTo(side * r * 0.74,  r * 0.05);
      ctx.lineTo(side * r * 1.07, -r * 0.30);
      ctx.lineTo(side * r * 0.60, -r * 0.40);
      ctx.closePath(); ctx.fill();
    }
  }

  // Arms
  const aSwing = walk * 4.5;
  ctx.fillStyle = flash ? '#ffffff' : DARK; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(-r * 0.9, r * 0.22 + aSwing, 4, 3.2,  0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse( r * 0.9, r * 0.22 - aSwing, 4, 3.2, -0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Eyes (with occasional blink)
  const blink = Math.sin(t / 590) > 0.91 ? 0.28 : 1;
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.ellipse(-r * 0.30, -r * 0.36, 3.4, 3.4 * blink, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( r * 0.30, -r * 0.36, 3.4, 3.4 * blink, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = flash ? '#ff0000' : PUPIL;
  ctx.beginPath(); ctx.ellipse(-r * 0.28, -r * 0.34, 1.8, 1.8 * blink, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse( r * 0.32, -r * 0.34, 1.8, 1.8 * blink, 0, 0, Math.PI * 2); ctx.fill();
  if (!flash) {
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(-r * 0.24, -r * 0.38, 0.85, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( r * 0.37, -r * 0.38, 0.85, 0, Math.PI * 2); ctx.fill();
  }

  // Tier-3 sweat drops (it's carrying the heaviest bag!)
  if (tier === 3 && !flash) {
    const s1 = Math.sin(t / 175) * 0.5 + 0.5;
    const s2 = Math.sin(t / 210 + 1.8) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(130,210,255,${(0.5 + s1 * 0.45).toFixed(2)})`;
    ctx.beginPath(); ctx.ellipse( r * 0.66, -r * 0.52 + s1 * 3, 2.2, 3.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(130,210,255,${(0.35 + s2 * 0.45).toFixed(2)})`;
    ctx.beginPath(); ctx.ellipse(-r * 0.58, -r * 0.28 + s2 * 4, 1.8, 3.2, 0, 0, Math.PI * 2); ctx.fill();
  }

  // Rope from right arm to bag
  const bagSwing = walk * 2.8;
  const bagX = r * 1.28, bagY = r * 0.68 + bagSwing;
  ctx.strokeStyle = DARK; ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(r * 0.9, r * 0.22 - aSwing);
  ctx.quadraticCurveTo(r * 1.15, r * 0.44 + bagSwing * 0.5, bagX, bagY);
  ctx.stroke();

  drawMoneyBag(ctx, bagX, bagY, tier, t);

  ctx.restore();

  // HP bar (world coords, coloured by tier)
  const hpRatio = Math.max(0, zombie.hp / zombie.maxHp);
  const bw = r * 2.4;
  const bx = zombie.x - bw / 2, by = zombie.y - r - 15;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(bx, by, bw, 3);
  ctx.fillStyle = ['' , '#2dd4bf', '#f97316', '#a855f7'][tier];
  ctx.fillRect(bx, by, bw * hpRatio, 3);
}

function drawMoneyBag(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number,
  tier: number, time: number,
): void {
  const R = [7, 10, 14][tier - 1];

  const BAG_FILL = ['#92400e', '#b45309', '#78350f'][tier - 1];
  const BAG_RIM  = ['#a16207', '#ca8a04', '#92400e'][tier - 1];
  const BOW_FILL = ['#94a3b8', '#fbbf24', '#fcd34d'][tier - 1];
  const COIN_TXT = ['#e2e8f0', '#fef9c3', '#fef08a'][tier - 1];

  if (tier === 3) { ctx.shadowColor = '#f59e0b'; ctx.shadowBlur = 7 + Math.sin(time / 90) * 3; }

  // Bag body
  ctx.fillStyle = BAG_FILL; ctx.strokeStyle = '#1a0800'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Neck (cover seam between bag and bow)
  const nH = R * 0.38;
  ctx.fillStyle = BAG_FILL;
  ctx.fillRect(cx - nH, cy - R - R * 0.32, nH * 2, R * 0.42);
  ctx.strokeStyle = '#1a0800'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(cx - nH, cy - R * 0.9); ctx.lineTo(cx - nH, cy - R * 0.38); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(cx + nH, cy - R * 0.9); ctx.lineTo(cx + nH, cy - R * 0.38); ctx.stroke();

  // Bow petals + centre knot
  ctx.fillStyle = BOW_FILL; ctx.strokeStyle = '#1a0800'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.ellipse(cx - R * 0.44, cy - R * 1.08, R * 0.34, R * 0.19, -0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx + R * 0.44, cy - R * 1.08, R * 0.34, R * 0.19,  0.35, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy - R * 1.08, R * 0.19, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Bag highlight
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.13)';
  ctx.beginPath(); ctx.arc(cx - R * 0.3, cy - R * 0.22, R * 0.38, 0, Math.PI * 2); ctx.fill();

  // Coin emblem circle + $ symbol
  ctx.fillStyle = BAG_RIM; ctx.strokeStyle = '#1a0800'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy + R * 0.06, R * 0.52, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.fillStyle = COIN_TXT;
  ctx.font = `bold ${Math.round(R * 0.78)}px Courier, monospace`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('$', cx, cy + R * 0.07);

  // Tier-3 orbiting sparkles
  if (tier === 3) {
    const st = time / 420;
    for (let i = 0; i < 5; i++) {
      const a    = (i / 5) * Math.PI * 2 + st;
      const dist = R + 5 + Math.sin(st * 2 + i) * 1.5;
      const al   = (Math.sin(st * 3 + i * 1.3) * 0.5 + 0.5) * 0.85;
      ctx.fillStyle = `rgba(255,215,0,${al.toFixed(2)})`;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * dist, cy + Math.sin(a) * dist, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
function drawButcherWorldFX(zombie: Zombie, ctx: CanvasRenderingContext2D): void {
  const phase      = (zombie.extraState.get('phase')      ?? 'walk') as string;
  const chargeDX   = (zombie.extraState.get('chargeDX')   ?? 0)      as number;
  const chargeDY   = (zombie.extraState.get('chargeDY')   ?? 0)      as number;
  const slamRadius = (zombie.extraState.get('slamRadius') ?? 0)      as number;

  if (phase === 'pre_charge' && (chargeDX !== 0 || chargeDY !== 0)) {
    const flash = (Math.sin(zombie.time / 80) * 0.5 + 0.5) * 0.85;
    ctx.save();
    ctx.globalAlpha = flash;
    ctx.strokeStyle = '#ff1a1a';
    ctx.lineWidth = 8;
    ctx.setLineDash([12, 6]);
    ctx.beginPath();
    ctx.moveTo(zombie.x, zombie.y);
    ctx.lineTo(zombie.x + chargeDX * 480, zombie.y + chargeDY * 480);
    ctx.stroke();
    ctx.setLineDash([]);
    // ??赯行?謘曉
    const tipX = zombie.x + chargeDX * 480;
    const tipY = zombie.y + chargeDY * 480;
    ctx.fillStyle = '#ff1a1a';
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - chargeDX * 20 + (-chargeDY) * 10, tipY - chargeDY * 20 + chargeDX * 10);
    ctx.lineTo(tipX - chargeDX * 20 - (-chargeDY) * 10, tipY - chargeDY * 20 - chargeDX * 10);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  if (phase === 'slamming' && slamRadius > 0) {
    const progress = slamRadius / 180;
    ctx.save();
    ctx.globalAlpha = (1 - progress) * 0.65;
    ctx.strokeStyle = '#ff0000';
    ctx.lineWidth = 6 * (1 - progress * 0.6);
    ctx.beginPath();
    ctx.arc(zombie.x, zombie.y, slamRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = (1 - progress) * 0.1;
    ctx.fillStyle = '#ff4444';
    ctx.fill();
    ctx.restore();
  }
}
