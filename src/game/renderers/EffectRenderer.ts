// ── EffectRenderer.ts ────────────────────────────────────────────────────────
// 所有命中特效、爆炸、VFX 繪圖（從 Game.ts 分離）
// 新增特效：在 drawHitEffect() 加 case，其他邏輯零修改
// ─────────────────────────────────────────────────────────────────────────────
import type { ActiveEffect } from '../types';

export interface HitEffect {
  x: number; y: number;
  type: string;
  lifetime: number;
  maxLifetime: number;
  startTime?: number;
  _grayOut?: boolean;
  radius?: number; // 供 pixel_explosion 等有大小感的特效使用
}

export interface HealVFX {
  x: number; y: number; alpha: number; startTime: number;
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

export function drawHealVFX(vfxList: HealVFX[], ctx: CanvasRenderingContext2D): void {
  ctx.save();
  for (const vfx of vfxList) {
    ctx.globalAlpha = vfx.alpha;
    ctx.fillStyle = '#00ff00'; ctx.font = 'bold 20px Arial'; ctx.textAlign = 'center';
    ctx.fillText('+', vfx.x, vfx.y);
    ctx.strokeStyle = `rgba(0,255,0,${vfx.alpha})`;
    ctx.beginPath(); ctx.arc(vfx.x, vfx.y+20, 15*(1.5-vfx.alpha), 0, Math.PI*2); ctx.stroke();
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

    }
    ctx.restore();
  }
}
