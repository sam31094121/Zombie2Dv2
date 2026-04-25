// ── EffectRenderer.ts ────────────────────────────────────────────────────────
// 所有命中特效、爆炸、VFX 繪圖（從 Game.ts 分離）
// 新增特效：在 drawHitEffect() 加 case，其他邏輯零修改
// ─────────────────────────────────────────────────────────────────────────────
import type { ActiveEffect } from '../types';
import type { Player } from '../Player';

export interface HitEffect {
  x: number; y: number;
  type: string;
  lifetime: number;
  maxLifetime: number;
  angle?: number;
  seed?: number;
  followZombieId?: number;
  startTime?: number;
  _grayOut?: boolean;
  radius?: number; // 供 pixel_explosion 等有大小感的特效使用
  targetX?: number; // 供 arc_lightning 使用
  targetY?: number; // 供 arc_lightning 使用
  vx?: number; // 物理噴發速度 X（gib_blood 用）
  vy?: number; // 物理噴發速度 Y（gib_blood 用）
  rotation?: number; // 碎片旋轉角度
  size?: number; // 碎片大小
}

export interface HealVFX {
  x: number;
  y: number;
  alpha: number;
  startTime: number;
  ownerId?: number;
  variant?: 'regen' | 'burst' | 'aura';
  scale?: number;
}

function drawPixelPlus(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  unit: number,
  color: string,
): void {
  const px = Math.max(1, unit);
  ctx.fillStyle = color;
  ctx.fillRect(x - px, y - px * 3, px * 2, px * 6);
  ctx.fillRect(x - px * 3, y - px, px * 6, px * 2);
}

function drawDiamondSpark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fill();
}

function traceRegularPolygonAt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  sides: number,
  rotation: number = -Math.PI / 2,
): void {
  ctx.beginPath();
  for (let i = 0; i < sides; i++) {
    const angle = rotation + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawOrientedBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.fillStyle = color;
  ctx.fillRect(-width * 0.5, -height * 0.5, width, height);
  ctx.restore();
}

function drawBracketCorners(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  armLength: number,
  thickness: number,
  rotation: number,
  color: string,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.lineCap = 'square';

  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const) {
    const cx = sx * radius;
    const cy = sy * radius;
    ctx.beginPath();
    ctx.moveTo(cx, cy + sy * armLength);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + sx * armLength, cy);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawHitEffect(effect: HitEffect, ctx: CanvasRenderingContext2D): void {
  ctx.save();
  if (effect._grayOut) {
    ctx.filter = 'grayscale(100%)';
    effect.lifetime = Math.min(effect.lifetime, 80);
  }
  const progress = effect.startTime
    ? (Date.now() - effect.startTime) / effect.maxLifetime
    : (effect.lifetime / effect.maxLifetime);

  switch (effect.type) {
    case 'orange_explosion':
      drawRealExplosion(ctx, effect.x, effect.y, Math.min(progress, 1));
      break;
    case 'grey_sparks': {
      const p = effect.lifetime / effect.maxLifetime;
      ctx.fillStyle = `rgba(158,158,158,${p})`;
      for(let i=0;i<5;i++){const a=Math.random()*Math.PI*2;const d=Math.random()*10;ctx.beginPath();ctx.arc(effect.x+Math.cos(a)*d,effect.y+Math.sin(a)*d,1.5,0,Math.PI*2);ctx.fill();}
      break;
    }
    case 'blue_circle':
      ctx.strokeStyle=`rgba(0,229,255,${progress})`;ctx.lineWidth=2;
      ctx.beginPath();ctx.arc(effect.x,effect.y,20*(1-progress),0,Math.PI*2);ctx.stroke();
      break;
    case 'green_electricity':
      ctx.strokeStyle=`rgba(178,255,89,${progress})`;ctx.lineWidth=2;
      ctx.beginPath();
      for(let i=0;i<4;i++){const a=Math.random()*Math.PI*2;const d=10+Math.random()*15;ctx.moveTo(effect.x,effect.y);ctx.lineTo(effect.x+Math.cos(a)*d,effect.y+Math.sin(a)*d);}
      ctx.stroke();
      break;
    case 'black_hole':
      if(progress>0.5){
        const sp=(progress-0.5)*2;
        ctx.fillStyle=`rgba(0,0,0,${sp})`;ctx.beginPath();ctx.arc(effect.x,effect.y,30*sp,0,Math.PI*2);ctx.fill();
        ctx.fillStyle=`rgba(255,255,255,${sp})`;
        for(let i=0;i<10;i++){const a=Math.random()*Math.PI*2;const d=40*sp;ctx.beginPath();ctx.arc(effect.x+Math.cos(a)*d,effect.y+Math.sin(a)*d,2,0,Math.PI*2);ctx.fill();}
      } else {
        const ep=progress*2;
        ctx.fillStyle=`rgba(255,255,255,${ep})`;ctx.beginPath();ctx.arc(effect.x,effect.y,50*(1-ep),0,Math.PI*2);ctx.fill();
      }
      break;
    case 'fire_trail': {
      const p = effect.lifetime / effect.maxLifetime;
      ctx.fillStyle = `rgba(255,100,0,${p * 0.6})`;
      ctx.beginPath(); ctx.arc(effect.x, effect.y, 10 + (1-p)*10, 0, Math.PI*2); ctx.fill();
      break;
    }
    case 'arc_lightning': {
      if (effect.targetX !== undefined && effect.targetY !== undefined) {
        const p = effect.lifetime / effect.maxLifetime;
        // 折線閃電繪製
        ctx.beginPath();
        ctx.moveTo(effect.x, effect.y);
        
        const dx = effect.targetX - effect.x;
        const dy = effect.targetY - effect.y;
        const dist = Math.hypot(dx, dy);
        const segments = Math.max(3, Math.floor(dist / 20));
        
        let cx = effect.x;
        let cy = effect.y;
        for (let i = 1; i < segments; i++) {
          const t = i / segments;
          // 加入截斷點的隨機偏移 (垂直於原本方向)
          const nx = effect.x + dx * t;
          const ny = effect.y + dy * t;
          const perpX = -dy / dist;
          const perpY = dx / dist;
          const offset = (Math.random() - 0.5) * 25;
          cx = nx + perpX * offset;
          cy = ny + perpY * offset;
          ctx.lineTo(cx, cy);
        }
        ctx.lineTo(effect.targetX, effect.targetY);
        
        ctx.strokeStyle = `rgba(0, 240, 255, ${p})`;
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00a8ff';
        ctx.shadowBlur = 10;
        ctx.lineJoin = 'miter';
        ctx.stroke();

        // 核心白線
        ctx.strokeStyle = `rgba(255, 255, 255, ${p})`;
        ctx.lineWidth = 1;
        ctx.shadowBlur = 0;
        ctx.stroke();
      }
      break;
    }
    case 'arc_spark': {
      const p = effect.lifetime / effect.maxLifetime;
      ctx.fillStyle = `rgba(0, 240, 255, ${p})`;
      ctx.shadowColor = '#00a8ff';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius || 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'purple_particles':
      ctx.fillStyle=`rgba(156,39,176,${progress})`;
      for(let i=0;i<5;i++){const a=Math.random()*Math.PI*2;const d=Math.random()*15;ctx.beginPath();ctx.arc(effect.x+Math.cos(a)*d,effect.y+Math.sin(a)*d,2,0,Math.PI*2);ctx.fill();}
      break;
    case 'white_cross': {
      const size=15*(1-progress);
      ctx.strokeStyle=`rgba(255,255,255,${progress})`;ctx.lineWidth=3;
      ctx.beginPath();ctx.moveTo(effect.x-size,effect.y-size);ctx.lineTo(effect.x+size,effect.y+size);ctx.moveTo(effect.x+size,effect.y-size);ctx.lineTo(effect.x-size,effect.y+size);ctx.stroke();
      break;
    }
    case 'white_sparks':
      ctx.fillStyle=`rgba(255,255,255,${progress})`;
      for(let i=0;i<6;i++){const a=Math.random()*Math.PI*2;const d=Math.random()*12;ctx.beginPath();ctx.arc(effect.x+Math.cos(a)*d,effect.y+Math.sin(a)*d,2,0,Math.PI*2);ctx.fill();}
      break;
    case 'ice_shatter':
      ctx.fillStyle=`rgba(128,216,255,${progress})`;
      for(let i=0;i<6;i++){const a=Math.random()*Math.PI*2;const d=Math.random()*20;ctx.fillRect(effect.x+Math.cos(a)*d,effect.y+Math.sin(a)*d,4,4);}
      break;
    case 'red_blood':
      ctx.fillStyle=`rgba(244,67,54,${progress})`;
      for(let i=0;i<8;i++){const a=Math.random()*Math.PI*2;const d=Math.random()*25;ctx.beginPath();ctx.arc(effect.x+Math.cos(a)*d,effect.y+Math.sin(a)*d,3+Math.random()*3,0,Math.PI*2);ctx.fill();}
      break;
    case 'wolf_claw_red': {
      const p = effect.lifetime / effect.maxLifetime;
      const fade = p * p;
      const fresh = Math.max(0, Math.min(1, (p - 0.62) / 0.38));
      const angle = effect.angle ?? -0.72;
      const scale = effect.size ?? 1;
      const seedBase = effect.seed ?? 71;
      const baseLen = 34 * scale;
      const gap = 8.2 * scale;
      const yOffsets = [-gap, 0, gap];
      const widths = [2.6 * scale, 3.3 * scale, 2.5 * scale];

      const hash = (n: number) => {
        const v = Math.sin(n * 12.9898) * 43758.5453;
        return v - Math.floor(v);
      };

      const drawJaggedScratch = (
        y: number,
        length: number,
        width: number,
        lineSeed: number,
        color: string,
        extraOffsetY: number,
      ) => {
        const segments = 11;
        ctx.beginPath();
        for (let s = 0; s <= segments; s++) {
          const t = s / segments;
          const x = -length * 0.5 + length * t;
          const curve = -Math.sin(t * Math.PI) * (2.2 * scale);
          const jag = (hash(lineSeed + s * 1.87) - 0.5) * (2.9 * scale);
          const py = y + curve + jag + extraOffsetY;
          if (s === 0) ctx.moveTo(x, py);
          else ctx.lineTo(x, py);
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = width;
        ctx.stroke();
      };

      ctx.translate(effect.x, effect.y);
      ctx.rotate(angle);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      ctx.beginPath();
      ctx.strokeStyle = `rgba(10,8,8,${0.26 * fade})`;
      ctx.lineWidth = 12 * scale;
      ctx.moveTo(-baseLen * 0.58, 6 * scale);
      ctx.lineTo(baseLen * 0.56, -6 * scale);
      ctx.stroke();

      for (let i = 0; i < 3; i++) {
        const length = baseLen * (i === 1 ? 1 : 0.88);
        const y = yOffsets[i];
        const w = widths[i];
        const localSeed = seedBase + i * 29.73;

        drawJaggedScratch(y, length, w + 1.6 * scale, localSeed, `rgba(80,6,6,${0.9 * fade})`, 0.8 * scale);
        drawJaggedScratch(y, length, w, localSeed + 9.1, `rgba(170,0,0,${0.98 * fade})`, 0);
        drawJaggedScratch(y, length * 0.92, Math.max(1, w - 1.2), localSeed + 17.7, `rgba(255,62,62,${(0.85 + fresh * 0.15) * fade})`, -0.4 * scale);
      }

      if (fresh > 0) {
        ctx.shadowColor = 'rgba(255,30,30,0.95)';
        ctx.shadowBlur = 9 * fresh * scale;
        drawJaggedScratch(-0.5 * scale, baseLen * 0.86, 1.4 * scale, seedBase + 99, `rgba(255,212,212,${0.22 * fresh})`, -1.2 * scale);
        ctx.shadowBlur = 0;
      }

      ctx.fillStyle = `rgba(120,0,0,${0.35 * fade})`;
      for (let i = 0; i < 5; i++) {
        const rx = (hash(seedBase + i * 4.1) - 0.5) * baseLen * 0.9;
        const ry = (hash(seedBase + i * 6.7) - 0.5) * gap * 3.1;
        const rr = (1 + hash(seedBase + i * 8.3) * 1.5) * scale;
        ctx.beginPath();
        ctx.arc(rx, ry, rr, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'golden_shatter':
      ctx.fillStyle=`rgba(255,214,0,${progress})`;
      for(let i=0;i<12;i++){const a=Math.random()*Math.PI*2;const d=Math.random()*30;ctx.beginPath();ctx.moveTo(effect.x+Math.cos(a)*d,effect.y+Math.sin(a)*d);ctx.lineTo(effect.x+Math.cos(a)*d+5,effect.y+Math.sin(a)*d+5);ctx.lineTo(effect.x+Math.cos(a)*d-2,effect.y+Math.sin(a)*d+8);ctx.fill();}
      break;
    case 'dismember':
      ctx.fillStyle=`rgba(76,175,80,${progress})`;
      for(let i=0;i<5;i++){const a=Math.random()*Math.PI*2;const d=10+Math.random()*30*(1-progress);ctx.beginPath();ctx.arc(effect.x+Math.cos(a)*d,effect.y+Math.sin(a)*d,4,0,Math.PI*2);ctx.fill();}
      break;
    case 'lightning':
      ctx.strokeStyle=`rgba(255,255,255,${progress})`;ctx.lineWidth=4;ctx.shadowColor='white';ctx.shadowBlur=20;
      ctx.beginPath();ctx.moveTo(effect.x,effect.y-1000);
      let cx=effect.x,cy=effect.y-1000;
      while(cy<effect.y){cx+=(Math.random()-0.5)*40;cy+=50;ctx.lineTo(cx,cy);}
      ctx.stroke();ctx.shadowBlur=0;
      break;
    case 'death_burst': {
      // progress: 1=剛死, 0=消失
      const expand = 1 - progress; // 0=剛死, 1=消失
      // 中心白光（前30%）
      if (progress > 0.7) {
        const f = (progress - 0.7) / 0.3;
        ctx.globalAlpha = f * 0.9;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 16 * (1 - expand * 0.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      }
      // 擴散血環
      const ringR = 6 + expand * 48;
      ctx.strokeStyle = `rgba(210,30,20,${progress * 0.85})`;
      ctx.lineWidth = 5 * progress;
      ctx.shadowColor = '#ff2200';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, ringR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // 8 顆血滴向外飛
      ctx.fillStyle = `rgba(180,20,20,${progress})`;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + 0.3;
        const d = expand * 58;
        const r = 4.5 * progress;
        if (r < 0.4) continue;
        ctx.beginPath();
        ctx.arc(effect.x + Math.cos(a) * d, effect.y + Math.sin(a) * d, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // 6 顆小血滴錯角飛出
      ctx.fillStyle = `rgba(230,60,10,${progress * 0.75})`;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 1.1;
        const d = expand * 36;
        const r = 2.5 * progress;
        if (r < 0.4) continue;
        ctx.beginPath();
        ctx.arc(effect.x + Math.cos(a) * d, effect.y + Math.sin(a) * d, r, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }
    case 'charred_body': {
      // 岩漿標記目標死後留下的焦屍：黑色燒焦圓＋橘紅餘燼閃爍
      const p = effect.lifetime / effect.maxLifetime;
      ctx.globalAlpha = Math.min(1, p * 4) * 0.85;
      ctx.fillStyle = '#1a0a00';
      ctx.beginPath(); ctx.arc(effect.x, effect.y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2d0a00';
      ctx.beginPath(); ctx.ellipse(effect.x, effect.y + 4, 16, 8, 0, 0, Math.PI * 2); ctx.fill();
      // 餘燼閃爍（隨機橘點）
      const seed = Math.floor(effect.lifetime / 80);
      const rng = (n: number) => ((Math.sin(seed * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1;
      ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 6;
      for (let i = 0; i < 4; i++) {
        const a = rng(i) * Math.PI * 2;
        const d = rng(i + 4) * 10;
        const r = 1.5 + rng(i + 8) * 2;
        ctx.fillStyle = `rgba(255,${80 + Math.floor(rng(i+12)*80)},0,${0.6 + rng(i+16)*0.4})`;
        ctx.beginPath(); ctx.arc(effect.x + Math.cos(a)*d, effect.y + Math.sin(a)*d, r, 0, Math.PI*2); ctx.fill();
      }
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      break;
    }
    case 'pixel_explosion': {
      // progress 0→1（需搭配 startTime 使用）
      const p = effect.startTime
        ? Math.min(1, (Date.now() - effect.startTime) / effect.maxLifetime)
        : 1 - effect.lifetime / effect.maxLifetime;
      drawPixelExplosion(ctx, effect.x, effect.y, effect.radius ?? 50, p);
      break;
    }
    case 'gib_blood': {
      // 物理驅動的擬真肉塊碎片：具備濕潤光澤與不規則形狀
      const p = effect.lifetime / effect.maxLifetime;
      const sz = (effect.size ?? 5) * 1.2;
      const rot = (effect.rotation ?? 0) + (1 - p) * 4;
      
      ctx.save();
      ctx.translate(effect.x, effect.y);
      ctx.rotate(rot);
      ctx.globalAlpha = Math.min(1, p * 3);

      // 1. 底層肉質陰影 (Irregular Base)
      ctx.fillStyle = '#4c0505';
      ctx.beginPath();
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const dist = sz * (0.8 + Math.sin(ang * 3 + effect.x) * 0.3);
        ctx.lineTo(Math.cos(ang) * dist, Math.sin(ang) * dist);
      }
      ctx.closePath();
      ctx.fill();

      // 2. 主體肉色 (Meaty Part with Gradient)
      const grad = ctx.createRadialGradient(-sz * 0.3, -sz * 0.3, 0, 0, 0, sz);
      grad.addColorStop(0, '#af1a1a'); // 核心鮮紅
      grad.addColorStop(0.7, '#7f0a0a'); // 邊緣深紅
      grad.addColorStop(1, '#4c0505'); // 接縫處暗紅
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (let a = 0; a < 8; a++) {
        const ang = (a / 8) * Math.PI * 2;
        const dist = sz * 0.85 * (0.9 + Math.cos(ang * 2 + effect.y) * 0.2);
        ctx.lineTo(Math.cos(ang) * dist, Math.sin(ang) * dist);
      }
      ctx.closePath();
      ctx.fill();

      // 3. 表面光澤 (Glossy Highlights)
      // 模擬濕潤、有反光的表面
      ctx.fillStyle = `rgba(255, 180, 180, ${p * 0.45})`;
      ctx.beginPath();
      ctx.ellipse(-sz * 0.35, -sz * 0.3, sz * 0.4, sz * 0.2, 0.5, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = `rgba(255, 255, 255, ${p * 0.3})`;
      ctx.beginPath();
      ctx.arc(-sz * 0.45, -sz * 0.35, sz * 0.15, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
      break;
    }
    case 'white_flash': {
      // 子彈命中瞬間的高對比白色爆亮
      const p = effect.lifetime / effect.maxLifetime;
      const flashR = 18 * p;
      ctx.save();
      ctx.globalAlpha = p * 0.95;
      // 外層光暈
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 20;
      ctx.fillStyle = `rgba(255,255,255,${p * 0.6})`;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, flashR, 0, Math.PI * 2);
      ctx.fill();
      // 核心純白
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, flashR * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
      break;
    }
  }
  ctx.restore();
}

export function drawRealExplosion(ctx: CanvasRenderingContext2D, x: number, y: number, progress: number): void {
  const maxR = 150;
  const alpha = 1 - progress;
  ctx.save();
  ctx.beginPath(); ctx.fillStyle=`rgba(255,255,255,${alpha})`; ctx.arc(x,y,maxR*progress*0.8,0,Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.strokeStyle=`rgba(255,100,0,${alpha})`; ctx.lineWidth=15*(1-progress); ctx.arc(x,y,maxR*Math.pow(progress,0.5),0,Math.PI*2); ctx.stroke();
  ctx.fillStyle=`rgba(255,200,50,${alpha})`;
  for(let i=0;i<12;i++){
    const a=(i/12)*Math.PI*2+(progress*2);
    const d=maxR*progress*1.2;
    ctx.beginPath();ctx.arc(x+Math.cos(a)*d,y+Math.sin(a)*d,4*(1-progress),0,Math.PI*2);ctx.fill();
  }
  ctx.restore();
}

// ── 能量爆炸模組 ─────────────────────────────────────────────────────────────
// SVG 原始設計 viewBox 100×100，爆炸主體半徑 45 → base = radius/45
// progress 0→1（0 = 剛爆炸，1 = 結束）
// 各元素獨立插值：主體 burst、能量環 ring-expand、碎片 shard-fly、放射線
// ─────────────────────────────────────────────────────────────────────────────
export function drawPixelExplosion(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  progress: number,
): void {
  if (progress >= 1) return;
  const base = radius / 45; // 從 SVG viewBox 到遊戲座標的縮放比

  // ── 主體爆炸 burst 包絡 ────────────────────────────────────────────────────
  // p 0→0.15: scale 0→1.2, alpha 0→1（閃光衝擊）
  // p 0.15→0.40: scale 1.2→1.1, alpha 1（持續）
  // p 0.40→1.0: scale 1.1→1.6, alpha 1→0（消散）
  let gScale: number, gAlpha: number;
  if (progress < 0.15) {
    const t = progress / 0.15;
    gScale = t * 1.2; gAlpha = t;
  } else if (progress < 0.40) {
    const t = (progress - 0.15) / 0.25;
    gScale = 1.2 - t * 0.1; gAlpha = 1;
  } else {
    const t = (progress - 0.40) / 0.60;
    gScale = 1.1 + t * 0.5; gAlpha = 1 - t;
  }
  if (gAlpha <= 0) return;

  ctx.save();
  ctx.translate(x, y);

  // ── 能量環（ring-expand：獨立擴散，不跟隨 burst 縮放）────────────────────
  const ringDefs = [
    { baseR: 38, dash: [15, 10], delay: 0   },
    { baseR: 32, dash: [2,  5 ], delay: 0.05 },
  ];
  for (const rd of ringDefs) {
    const rp = Math.max(0, Math.min(1, (progress - rd.delay) / (1 - rd.delay)));
    if (rp <= 0) continue;
    const rAlpha = rp < 0.2 ? rp / 0.2 * 0.8 : 0.8 * (1 - (rp - 0.2) / 0.8);
    if (rAlpha <= 0) continue;
    ctx.save();
    ctx.globalAlpha = rAlpha;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth   = Math.max(0.3, (2 - rp * 1.9) * base);
    ctx.setLineDash([rd.dash[0] * base, rd.dash[1] * base]);
    ctx.beginPath(); ctx.arc(0, 0, rd.baseR * base * rp * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  // ── 碎片（shard-fly：各自位移噴射）──────────────────────────────────────
  const shardAlpha = progress < 0.2 ? progress / 0.2 : Math.max(0, 1 - (progress - 0.2) / 0.8);
  if (shardAlpha > 0) {
    const shards = [
      { cx:  20, cy: -25, w: 4, h: 4, dx:  15, dy: -15, color: '#fbbf24' },
      { cx: -25, cy:  20, w: 4, h: 4, dx: -15, dy:  15, color: '#7f1d1d' },
      { cx:  30, cy:  10, w: 3, h: 3, dx:  20, dy:  10, color: '#fbbf24' },
      { cx: -30, cy: -30, w: 5, h: 5, dx: -20, dy: -20, color: '#f97316' },
    ];
    const sScale = progress * 1.5;
    ctx.save();
    ctx.globalAlpha = shardAlpha;
    for (const sh of shards) {
      const sx = (sh.cx + sh.dx * progress) * base;
      const sy = (sh.cy + sh.dy * progress) * base;
      const sw = sh.w * base * sScale;
      const sh_ = sh.h * base * sScale;
      ctx.fillStyle = sh.color;
      ctx.fillRect(sx - sw / 2, sy - sh_ / 2, sw, sh_);
    }
    ctx.restore();
  }

  // ── 主體群組（burst 縮放 + alpha）────────────────────────────────────────
  ctx.save();
  ctx.scale(base * gScale, base * gScale);
  ctx.globalAlpha = gAlpha;

  // 1. 背景衝擊波（輻射漸層圓）
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 45);
  grad.addColorStop(0,   'rgba(255,255,255,0.30)');
  grad.addColorStop(0.3, 'rgba(251,191,36,0.30)');
  grad.addColorStop(0.7, 'rgba(249,115,22,0.30)');
  grad.addColorStop(1,   'rgba(239,68,68,0)');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(0, 0, 45, 0, Math.PI * 2); ctx.fill();

  // 3. 主星芒（外 8 角 + 內 8 角，模擬 SVG path 的兩層星）
  ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 3;
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo( 0, -40); ctx.lineTo( 3,  -3);
  ctx.lineTo(40,   0); ctx.lineTo( 3,   3);
  ctx.lineTo( 0,  40); ctx.lineTo(-3,   3);
  ctx.lineTo(-40,  0); ctx.lineTo(-3,  -3);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo( 0, -25); ctx.lineTo( 2,  -2);
  ctx.lineTo(25,   0); ctx.lineTo( 2,   2);
  ctx.lineTo( 0,  25); ctx.lineTo(-2,   2);
  ctx.lineTo(-25,  0); ctx.lineTo(-2,  -2);
  ctx.closePath(); ctx.fill();
  ctx.shadowBlur = 0;

  // 5. 中心六角形細節
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth   = 0.3;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
    i === 0
      ? ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10)
      : ctx.lineTo(Math.cos(a) * 10, Math.sin(a) * 10);
  }
  ctx.closePath(); ctx.stroke();

  // 7. N/E/S/W 放射虛線
  const lineAlpha = progress < 0.2 ? progress / 0.2 : Math.max(0, 1 - (progress - 0.2) / 0.8);
  if (lineAlpha > 0) {
    ctx.save();
    ctx.globalAlpha = lineAlpha * gAlpha;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 0.4;
    ctx.setLineDash([2, 8]);
    ctx.lineDashOffset = -(progress * 20);
    for (const [dx, dy] of [[0,-1],[1,0],[0,1],[-1,0]] as [number,number][]) {
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(dx * 45, dy * 45);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  ctx.restore(); // 主體群組
  ctx.restore(); // translate
}

export function drawHealVFX(vfxList: HealVFX[], ctx: CanvasRenderingContext2D, players: Player[] = []): void {
  ctx.save();
  for (const vfx of vfxList) {
    const owner = vfx.ownerId != null ? players.find((player) => player.id === vfx.ownerId) : null;
    const drawX = owner ? owner.x + vfx.x : vfx.x;
    const drawY = owner ? owner.y + vfx.y : vfx.y;
    const age = Date.now() - vfx.startTime;
    const fade = Math.max(0, vfx.alpha);
    const scale = vfx.scale ?? 1;
    const variant = vfx.variant ?? 'burst';

    ctx.globalAlpha = fade;

    if (variant === 'regen') {
      const pulse = 0.82 + Math.sin(age / 120) * 0.14;
      const frameR = 9 * scale + Math.sin(age / 90) * 0.8;
      const rotation = Math.PI / 4 + age / 600;

      ctx.fillStyle = 'rgba(20,83,45,0.22)';
      traceRegularPolygonAt(ctx, drawX, drawY, frameR + 3, 4, rotation);
      ctx.fill();

      ctx.strokeStyle = 'rgba(220,252,231,0.92)';
      ctx.lineWidth = 2.2;
      traceRegularPolygonAt(ctx, drawX, drawY, frameR * pulse, 4, rotation);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(74,222,128,0.86)';
      ctx.lineWidth = 1.4;
      traceRegularPolygonAt(ctx, drawX, drawY, frameR * 0.66, 4, age / 800);
      ctx.stroke();

      drawPixelPlus(ctx, drawX, drawY, 1.45 * scale, '#ecfdf5');
      drawPixelPlus(ctx, drawX, drawY, 0.95 * scale, '#4ade80');

      for (let i = 0; i < 4; i++) {
        const angle = i * (Math.PI / 2) + age / 700;
        const dist = frameR + 2.2 + (i % 2) * 1.4;
        const px = drawX + Math.cos(angle) * dist;
        const py = drawY + Math.sin(angle) * dist;
        drawOrientedBar(
          ctx,
          px,
          py,
          3.4 * scale,
          7.4 * scale,
          angle,
          i % 2 === 0 ? 'rgba(187,247,208,0.96)' : 'rgba(74,222,128,0.88)'
        );
      }
      continue;
    }

    if (variant === 'aura') {
      const pulse = 0.74 + Math.sin(age / 95) * 0.12;
      const frameR = (9 + age * 0.016) * scale;

      ctx.fillStyle = 'rgba(17,63,38,0.18)';
      traceRegularPolygonAt(ctx, drawX, drawY, frameR + 2.5, 8, Math.PI / 8);
      ctx.fill();

      ctx.strokeStyle = 'rgba(187,247,208,0.9)';
      ctx.lineWidth = 2.1;
      traceRegularPolygonAt(ctx, drawX, drawY, frameR * pulse, 8, Math.PI / 8);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(74,222,128,0.82)';
      ctx.lineWidth = 1.5;
      traceRegularPolygonAt(ctx, drawX, drawY, frameR * 0.62, 4, Math.PI / 4);
      ctx.stroke();

      drawBracketCorners(
        ctx,
        drawX,
        drawY,
        frameR * 0.58,
        3.8 * scale,
        1.9 * scale,
        Math.PI / 4,
        'rgba(134,239,172,0.88)'
      );

      drawPixelPlus(ctx, drawX, drawY - 1, 1.25 * scale, '#f0fdf4');
      drawPixelPlus(ctx, drawX, drawY - 1, 0.85 * scale, '#4ade80');

      for (let i = 0; i < 3; i++) {
        const lift = ((age / 320) + i * 0.3) % 1;
        const px = drawX + (i - 1) * 5 * scale;
        const py = drawY + 7 * scale - lift * 15 * scale;
        drawOrientedBar(
          ctx,
          px,
          py,
          3.1 * scale,
          (6 - lift * 1.8) * scale,
          0,
          i === 1 ? 'rgba(240,253,244,0.96)' : 'rgba(134,239,172,0.9)'
        );
      }
      continue;
    }

    const frameR = (11 + age * 0.02) * scale;
    const rotation = Math.PI / 8 + age / 700;

    ctx.fillStyle = 'rgba(63,98,18,0.18)';
    traceRegularPolygonAt(ctx, drawX, drawY, frameR + 4, 8, rotation);
    ctx.fill();

    ctx.strokeStyle = 'rgba(250,204,21,0.92)';
    ctx.lineWidth = 2.5;
    traceRegularPolygonAt(ctx, drawX, drawY, frameR + 1.5, 8, rotation);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(134,239,172,0.88)';
    ctx.lineWidth = 1.7;
    traceRegularPolygonAt(ctx, drawX, drawY, frameR * 0.72, 4, Math.PI / 4 + age / 900);
    ctx.stroke();

    drawBracketCorners(
      ctx,
      drawX,
      drawY,
      frameR * 0.74,
      4.6 * scale,
      2 * scale,
      Math.PI / 4,
      'rgba(253,224,71,0.9)'
    );

    drawPixelPlus(ctx, drawX, drawY, 1.9 * scale, '#f7fee7');
    drawPixelPlus(ctx, drawX, drawY, 1.15 * scale, '#4ade80');

    for (let i = 0; i < 4; i++) {
      const angle = Math.PI / 4 + (i / 4) * Math.PI * 2;
      const px = drawX + Math.cos(angle) * (frameR + 4.6);
      const py = drawY + Math.sin(angle) * (frameR + 4.6);
      drawOrientedBar(
        ctx,
        px,
        py,
        3.6 * scale,
        9.4 * scale,
        angle,
        i % 2 === 0 ? 'rgba(253,224,71,0.92)' : 'rgba(187,247,208,0.9)'
      );
      drawDiamondSpark(
        ctx,
        drawX + Math.cos(angle) * (frameR + 8.5),
        drawY + Math.sin(angle) * (frameR + 8.5),
        (2.4 + (i % 2) * 0.8) * scale,
        i % 2 === 0 ? '#fde68a' : '#bbf7d0'
      );
    }
  }
  ctx.restore();
}

// ── Shuriken Typhoon 5 幀像素龍捲風模組 ──────────────────────────────────────
// 臂從 radius=5 開始，中心不畫任何東西 → 自然空心露出遊戲世界
// radius：龍捲風半徑；原始像素設計基準 = 27px，縮放比 = radius/27
// alpha ：整體透明度（0~1），由呼叫方控制淡入淡出
// ─────────────────────────────────────────────────────────────────────────────
export function drawCyclone(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  alpha: number = 1,
): void {
  const scale        = radius / 27;
  const frameIdx     = Math.floor(Date.now() / 200) % 5;
  const TOTAL_FRAMES = 5;

  // 颱風調色盤：冷色調雲系
  const DEEP      = '#1e293b'; // 底層厚雲
  const MID       = '#475569'; // 一般雲帶
  const LIGHT     = '#94a3b8'; // 高層雲系
  const HIGHLIGHT = '#f8fafc'; // 臂尖高光

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;

  // 4 臂手裡劍螺旋雲帶（臂從 r=5 開始，中心自然留空）
  const rotation = frameIdx * (Math.PI * 2 / TOTAL_FRAMES);
  for (let a = 0; a < 4; a++) {
    const armAngle = rotation + a * Math.PI / 2;
    for (let i = 0; i < 20; i++) {
      const progress    = i / 20;
      const r           = 5 + progress * 22;         // 半徑 5→27
      const spiralAngle = armAngle + progress * 3.5; // 螺旋彎曲
      const px          = Math.round(Math.cos(spiralAngle) * r);
      const py          = Math.round(Math.sin(spiralAngle) * r);

      // 像素大小：靠近中心寬、末端尖
      const width = (1 - progress) * 8 + 2;
      const ps    = Math.max(1, Math.round(width / 2));

      if      (progress < 0.1) ctx.fillStyle = HIGHLIGHT;
      else if (progress < 0.4) ctx.fillStyle = LIGHT;
      else if (progress < 0.7) ctx.fillStyle = MID;
      else                     ctx.fillStyle = DEEP;

      ctx.fillRect(px - Math.floor(ps / 2), py - Math.floor(ps / 2), ps, ps);

      // 次級雲系：每 3 步填補葉片間空隙
      if (i % 3 === 0) {
        ctx.fillStyle = DEEP;
        const fx = Math.round(Math.cos(spiralAngle - 0.4) * (r - 2));
        const fy = Math.round(Math.sin(spiralAngle - 0.4) * (r - 2));
        ctx.fillRect(fx, fy, 2, 2);
      }
    }
  }

  // 亂流像素（增加大氣感）
  for (let j = 0; j < 10; j++) {
    const ra = Math.random() * Math.PI * 2;
    const rr = 8 + Math.random() * 15;
    ctx.fillStyle = Math.random() > 0.5 ? LIGHT : DEEP;
    ctx.fillRect(Math.round(Math.cos(ra) * rr), Math.round(Math.sin(ra) * rr), 1, 1);
  }

  ctx.restore();
}

// ── 地面火焰模組 ──────────────────────────────────────────────────────────────
// 燃燒導彈命中後留下的 ground_fire ActiveEffect 視覺
// 用戶設計 64×64，pivot = canvas(32,48)，對齊 game(0,0)（ox=-32, oy=-48）
// x, y     : 火焰中心（世界座標）
// radius   : 火焰範圍半徑（設計尺寸 = 32px；scale = radius/32）
// progress : 0 = 剛產生, 1 = 即將消失
// ─────────────────────────────────────────────────────────────────────────────


export function drawGroundFire(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  progress: number,
): void {
  if (progress >= 1) return;

  // 淡入（前 8%）淡出（後 15%）
  const alpha =
    progress < 0.08 ? progress / 0.08 :
    progress > 0.85 ? (1 - progress) / 0.15 : 1;
  if (alpha <= 0) return;

  const f = Math.floor(Date.now() / 60); // 與用戶設計的 60ms interval 一致

  const GF = {
    lavaDeep:   '#7f1d1d',
    lavaMid:    '#dc2626',
    fireOrange: '#ff6600',
    fireYellow: '#ffcc00',
    fireWhite:  '#ffffff',
  };

  // 座標映射：canvas(32,48) → game(0,0)
  const ox = -32, oy = -48;
  const scale = radius / 32;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.imageSmoothingEnabled = false;

  // --- 1. 翻騰熔岩池（橢圓 + 呼吸動畫 + 核心熱點）---
  const drawLavaPool = (px: number, py: number, w: number, h: number, seed: number) => {
    const pulse = Math.sin(f * 0.1 + seed) * 2;

    ctx.fillStyle = GF.lavaDeep;
    ctx.beginPath();
    ctx.ellipse(px + ox, py + oy, w + pulse, h + pulse / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = GF.lavaMid;
    ctx.beginPath();
    ctx.ellipse(px + ox, py + oy, (w - 2) + pulse, (h - 2) + pulse / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = GF.fireOrange;
    const hox = Math.cos(f * 0.05 + seed) * 3;
    const hoy = Math.sin(f * 0.05 + seed) * 2;
    ctx.beginPath();
    ctx.ellipse(px + ox + hox, py + oy + hoy, w / 2, h / 3, 0, 0, Math.PI * 2);
    ctx.fill();
  };

  drawLavaPool(32, 48, 18, 8, 101);
  drawLavaPool(10, 55,  8, 4, 202);

  // --- 2. 巨大火焰（二次貝茲曲線）---
  const drawBigFlame = (px: number, py: number, seed: number, flameScale: number) => {
    const fh = (Math.sin(f * 0.3 + seed) * 8) + 15 * flameScale;
    const fw = 6 + Math.sin(f * 0.2 + seed) * 2;

    ctx.fillStyle = GF.fireOrange;
    ctx.beginPath();
    ctx.moveTo(px + ox - fw, py + oy);
    ctx.quadraticCurveTo(px + ox, py + oy - fh * 1.2, px + ox + fw, py + oy);
    ctx.fill();

    ctx.fillStyle = GF.fireYellow;
    ctx.beginPath();
    ctx.moveTo(px + ox - fw / 2, py + oy);
    ctx.quadraticCurveTo(px + ox, py + oy - fh * 0.7, px + ox + fw / 2, py + oy);
    ctx.fill();

    ctx.fillStyle = GF.fireWhite;
    ctx.fillRect(px + ox - 1, py + oy - 2, 2, 2);
  };

  drawBigFlame(25, 48,   1, 1.2);
  drawBigFlame(38, 50,  50, 0.9);
  drawBigFlame(12, 56, 100, 0.7);

  ctx.restore();
}

// ── 槍口火光模組 ──────────────────────────────────────────────────────────────
// 2-frame pixel-art muzzle flash（呼叫方的 canvas 空間中，槍管朝 +X 方向）
// x, y          : 槍口尖端位置（呼叫方 canvas 座標）
// lastAttackTime: player.lastAttackTime（Date.now() 時間戳）
// Frame 1 (0–60ms)   : 4 層 bloom + 側噴 + 火花
// Frame 2 (60–260ms) : 煙霧消散 + 餘燼（自動淡出）
// ─────────────────────────────────────────────────────────────────────────────
export function drawMuzzleFlash(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  lastAttackTime: number,
): void {
  if ((ctx as any).isOutlinePass) return;

  const elapsed = Date.now() - lastAttackTime;
  if (elapsed >= 260) return;

  ctx.save();
  ctx.translate(x, y);
  ctx.scale(1.5, 1.5); // 放大 1.5 倍強化震撼感

  const r = (dx: number, dy: number, w: number, h: number) =>
    ctx.fillRect(dx, dy, w, h);

  ctx.imageSmoothingEnabled = false;

  if (elapsed < 60) {
    // ── Frame 1: 大爆閃 ──────────────────────────────────────────────────
    ctx.fillStyle = '#cc0000'; r(-1, -4, 12,  9); // 外層紅焰
    ctx.fillStyle = '#ff6600'; r( 0, -3, 10,  7); // 橘色主體
    ctx.fillStyle = '#ffcc00'; r( 1, -2,  7,  5); // 黃色高溫核
    ctx.fillStyle = '#ffffff'; r( 2, -1,  5,  3); // 白熱中心
    ctx.fillStyle = '#ffffff'; r(-1,  0, 14,  1); // 中心貫穿亮線
    // 側噴（上下各一道）
    ctx.fillStyle = '#ff6600'; r(-1, -6,  4,  2);
    ctx.fillStyle = '#ff6600'; r(-1,  5,  4,  2);
    // 前端火花
    ctx.fillStyle = '#ffffff'; r(11, -1,  2,  1);
    ctx.fillStyle = '#ffcc00'; r(11,  1,  2,  1);
    ctx.fillStyle = '#ffffff'; r(12,  0,  1,  1);
  } else {
    // ── Frame 2: 煙霧消散 ────────────────────────────────────────────────
    const alpha = 1 - (elapsed - 60) / 200;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#4a4d5d'; r(-1, -3,  9,  7); // 深灰煙雲主體
    ctx.fillStyle = '#4a4d5d'; r( 2, -5,  5, 11); // 縱向擴散
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = '#cc0000'; r( 1, -2,  5,  5); // 殘焰餘燼
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ff6600'; r( 6,  0,  3,  1); // 小火花拖尾
  }

  ctx.restore();
}

// ── 場地殘留效果繪圖（龍捲風 / 岩漿標記）────────────────────────────────────
export function drawActiveEffects(effects: ActiveEffect[], ctx: CanvasRenderingContext2D): void {
  for (const effect of effects) {
    const p = Math.max(0, effect.lifetime / effect.maxLifetime); // 1→0
    ctx.save();
    switch (effect.type) {

      case 'tornado': {
        // 使用模組化 drawCyclone；淡入（前10%）+ 淡出（後20%）
        const alpha = Math.min(1, p * 5) * Math.min(1, (1 - p) * 5 + 0.3);
        drawCyclone(ctx, effect.x, effect.y, effect.radius, alpha);
        break;
      }

      case 'lava_mark': {
        // 岩漿標記：脈動橘紅光環
        const pulse = 0.75 + Math.sin(Date.now() * 0.008) * 0.25;
        const alpha = Math.min(1, p * 4) * 0.85;
        ctx.globalAlpha = alpha;
        ctx.translate(effect.x, effect.y);
        // 外光暈
        ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 20;
        ctx.strokeStyle = `rgba(255,${60 + Math.floor(pulse*80)},0,0.9)`;
        ctx.lineWidth = 3 * pulse;
        ctx.beginPath(); ctx.arc(0, 0, effect.radius * pulse, 0, Math.PI * 2); ctx.stroke();
        // 內圈
        ctx.strokeStyle = 'rgba(255,200,0,0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, effect.radius * 0.5 * pulse, 0, Math.PI * 2); ctx.stroke();
        // 倒計時弧（剩餘時間）
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(255,255,100,0.8)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, effect.radius + 4, -Math.PI/2, -Math.PI/2 + p * Math.PI * 2);
        ctx.stroke();
        // 中心熔岩核
        ctx.fillStyle = `rgba(255,${100+Math.floor(pulse*80)},0,0.95)`;
        ctx.beginPath(); ctx.arc(0, 0, 5 * pulse, 0, Math.PI * 2); ctx.fill();
        break;
      }

      case 'ground_fire': {
        drawGroundFire(ctx, effect.x, effect.y, effect.radius, 1 - p);
        break;
      }

      case 'spawn_warning': {
        const spin = (Date.now() / 300) % (Math.PI * 2);
        ctx.globalAlpha = Math.min(1, Math.max(0.2, p * 1.5));
        ctx.translate(effect.x, effect.y);
        ctx.rotate(spin);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2 + (1 - p) * 2.5; 
        
        ctx.beginPath();
        for (let i = 0; i <= 12; i++) {
          const a = (i / 12) * Math.PI * 2;
          const r = effect.radius + (Math.random() - 0.5) * 5;
          if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(-effect.radius + 5, 0); ctx.lineTo(effect.radius - 5, 0);
        ctx.moveTo(0, -effect.radius + 5); ctx.lineTo(0, effect.radius - 5);
        ctx.stroke();
        break;
      }

    }
    ctx.restore();
  }
}
