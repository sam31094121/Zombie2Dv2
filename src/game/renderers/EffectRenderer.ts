// ── EffectRenderer.ts ────────────────────────────────────────────────────────
// 所有命中特效、爆炸、VFX 繪圖（從 Game.ts 分離）
// 新增特效：在 drawHitEffect() 加 case，其他邏輯零修改
// ─────────────────────────────────────────────────────────────────────────────

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
