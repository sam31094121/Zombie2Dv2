// ── ZombieRenderer.ts ────────────────────────────────────────────────────────
// 殭屍繪圖邏輯（從 Zombie.ts 分離）
// 新增殭屍外觀：在 drawZombie() 加 case，Zombie.ts 零修改
// ─────────────────────────────────────────────────────────────────────────────
import { Zombie } from '../Zombie';
import { getSprite, BUTCHER_FRAME_URLS } from '../sprites/SpriteLoader';

// ── 屠夫動畫幀選擇 ────────────────────────────────────────────────────────────
// 依據 state machine 相位選擇幀索引 + 播速
function getButcherFrameIndex(zombie: Zombie): number {
  const phase = (zombie.extraState.get('phase') ?? 'walk') as string;
  // 5幀總數（0~4）
  if (phase === 'charging')     return Math.floor(zombie.time / 80)  % 5; // 快速循環
  if (phase === 'slam_windup')  return 4;                                  // 高舉菜刀幀
  if (phase === 'slamming')     return 4;                                  // 擊地幀
  if (phase === 'pre_charge')   return 0;                                  // 備戰靜止
  if (phase === 'recovery')     return 0;                                  // 恢復靜止
  return Math.floor(zombie.time / 150) % 5;                               // walk：慢速循環
}

export function drawZombie(zombie: Zombie, ctx: CanvasRenderingContext2D): void {
  // ── 屠夫：世界座標特效必須在 ctx.save 平移前繪製 ──────────────────────────
  if (zombie.type === 'butcher') drawButcherWorldFX(zombie, ctx);

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
  } else if (zombie.type === 'butcher') {
    swayX = Math.sin(zombie.time / 600) * 2;
    swayY = Math.abs(Math.cos(zombie.time / 600)) * 1.5;
    // 精靈圖保持正面朝上，不隨移動方向旋轉
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

  // ── 手臂 ──────────────────────────────────────────────────────────────────
  if (zombie.type === 'big') {
    const armSwing = Math.sin(zombie.time / 400) * 15;
    ctx.fillStyle = '#144d18'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-zombie.radius + 2, 5 + armSwing, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(zombie.radius - 2,  5 - armSwing, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // ── 主體 ──────────────────────────────────────────────────────────────────
  if (zombie.type === 'butcher') {
    // ── 精靈圖（5幀動畫）──────────────────────────────────────────────────
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
      const size = zombie.radius * 3.2;           // 精靈顯示尺寸
      ctx.drawImage(sprite, -size / 2, -size / 2, size, size);
    } else {
      // 精靈尚未載入時的 fallback（原本的圓形）
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

    // ── 臉部細節 ────────────────────────────────────────────────────────────
    if (zombie.type === 'normal') {
      const walkCycle = Math.sin(zombie.time / 150);
      // 頭顱
      ctx.fillStyle = zombie.flashWhiteTimer > 0 ? '#ffffff' : '#e0e0ce';
      ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(-zombie.radius * 0.7, -zombie.radius * 0.9, zombie.radius * 1.4, zombie.radius * 1.2, 4);
      ctx.fill(); ctx.stroke();
      // 眼窩
      ctx.fillStyle = '#1a1a1a';
      ctx.beginPath();
      ctx.arc(-zombie.radius * 0.3, -zombie.radius * 0.4, 2.5, 0, Math.PI * 2);
      ctx.arc(zombie.radius * 0.3,  -zombie.radius * 0.4, 2.5, 0, Math.PI * 2);
      ctx.fill();
      // 靈魂火焰紅眼
      ctx.fillStyle = '#ff0000';
      ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(-zombie.radius * 0.3, -zombie.radius * 0.4, 1, 0, Math.PI * 2);
      ctx.arc(zombie.radius * 0.3,  -zombie.radius * 0.4, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // 牙齒縫隙
      ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 1;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath(); ctx.moveTo(i * 2, 0); ctx.lineTo(i * 2, 4); ctx.stroke();
      }
      // 手臂骨
      const armSwing = walkCycle * 5;
      ctx.fillStyle = '#e0e0ce'; ctx.strokeStyle = '#2c2c2c'; ctx.lineWidth = 1.5;
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
    } else if (zombie.type === 'slime' || zombie.type === 'slime_small') {
      ctx.fillStyle = '#33691e';
      ctx.beginPath(); ctx.arc(-4,-4,2,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(4,-4,2,0,Math.PI*2); ctx.fill();
    }
  }

  ctx.restore();

  // ── HP Bar（世界座標）────────────────────────────────────────────────────
  const hpRatio = Math.max(0, zombie.hp / zombie.maxHp);
  const bw = zombie.type === 'butcher' ? zombie.radius * 2.5 : zombie.radius * 2;
  const bh = zombie.type === 'big' || zombie.type === 'butcher' ? 5 : 3;
  const isEnraged = zombie.type === 'butcher' && hpRatio < 0.3;
  ctx.fillStyle = 'red';
  ctx.fillRect(zombie.x - bw/2, zombie.y - zombie.radius - 10, bw, bh);
  ctx.fillStyle = isEnraged ? '#ff6600' : 'green';
  ctx.fillRect(zombie.x - bw/2, zombie.y - zombie.radius - 10, bw * hpRatio, bh);
}

// ── 屠夫世界座標特效（警告射線 + 衝擊波）────────────────────────────────────
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
    // 箭頭尖端
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
