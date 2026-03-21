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

// ── 場地殘留效果繪圖（龍捲風 / 岩漿標記）────────────────────────────────────
export function drawActiveEffects(effects: ActiveEffect[], ctx: CanvasRenderingContext2D): void {
  for (const effect of effects) {
    const p = Math.max(0, effect.lifetime / effect.maxLifetime); // 1→0
    ctx.save();
    switch (effect.type) {

      case 'tornado': {
        // 旋轉漸層錐形龍捲風
        const rot = (1 - p) * Math.PI * 8; // 持續旋轉
        const alpha = Math.min(1, p * 3) * 0.8;
        ctx.globalAlpha = alpha;
        ctx.translate(effect.x, effect.y);
        ctx.rotate(rot);
        // 外環（青色）
        ctx.strokeStyle = '#00e5ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = '#00e5ff'; ctx.shadowBlur = 12;
        for (let ring = 0; ring < 3; ring++) {
          const r = effect.radius * (0.4 + ring * 0.3) * (0.85 + Math.sin(rot * 2 + ring) * 0.15);
          ctx.beginPath();
          ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        // 旋臂：4 道弧線
        ctx.shadowBlur = 0;
        ctx.strokeStyle = 'rgba(100,220,255,0.6)';
        ctx.lineWidth = 2;
        for (let arm = 0; arm < 4; arm++) {
          const a0 = (arm / 4) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(0, 0, effect.radius * 0.6, a0, a0 + Math.PI * 0.6);
          ctx.stroke();
        }
        // 中心核
        ctx.fillStyle = 'rgba(200,240,255,0.9)';
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
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
