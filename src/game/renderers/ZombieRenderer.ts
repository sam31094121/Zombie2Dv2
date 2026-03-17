// ── ZombieRenderer.ts ────────────────────────────────────────────────────────
// 殭屍繪圖邏輯（從 Zombie.ts 分離）
// 新增殭屍外觀：在 drawZombie() 加 case，Zombie.ts 零修改
// ─────────────────────────────────────────────────────────────────────────────
import { Zombie } from '../Zombie';

export function drawZombie(zombie: Zombie, ctx: CanvasRenderingContext2D): void {
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
  } else {
    swayX = Math.sin(zombie.time / 100) * 1;
    swayY = Math.cos(zombie.time / 100) * 1;
  }

  ctx.translate(zombie.x + swayX, zombie.y + swayY);
  ctx.rotate(rotation);

  if (zombie.type === 'big') {
    const bounce = Math.abs(Math.sin(zombie.time / 400));
    ctx.scale(1 + bounce * 0.08, 1 - bounce * 0.05);
  } else if (zombie.type === 'slime' || zombie.type === 'slime_small') {
    ctx.scale(1 + Math.sin(zombie.jellyPhase) * 0.15, 1 + Math.cos(zombie.jellyPhase) * 0.15);
  }

  // Shadow
  ctx.beginPath(); ctx.arc(4, 6, zombie.radius, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fill(); ctx.closePath();

  // Big zombie arms
  if (zombie.type === 'big') {
    const armSwing = Math.sin(zombie.time / 400) * 15;
    ctx.fillStyle = '#144d18'; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(-zombie.radius + 2, 5 + armSwing, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(zombie.radius - 2, 5 - armSwing, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  // Body
  ctx.beginPath(); ctx.arc(0, 0, zombie.radius, 0, Math.PI * 2);
  if      (zombie.type === 'big')        ctx.fillStyle = '#1b5e20';
  else if (zombie.type === 'slime')      ctx.fillStyle = '#8bc34a';
  else if (zombie.type === 'slime_small')ctx.fillStyle = '#7cb342';
  else if (zombie.type === 'spitter')    ctx.fillStyle = '#9c27b0';
  else                                   ctx.fillStyle = '#4caf50';

  if (zombie.flashWhiteTimer > 0) ctx.fillStyle = '#ffffff';
  if (zombie.isInfiniteGlow) { ctx.shadowColor = ctx.fillStyle as string; ctx.shadowBlur = 15; }
  ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#000'; ctx.stroke(); ctx.closePath();

  // Type-specific face details
  if (zombie.type === 'normal') {
    ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 10; ctx.fillStyle = '#ff0000';
    ctx.beginPath(); ctx.arc(-4,-4,2.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(4,-4,2.5,0,Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    if (zombie.isCloseToPlayer) {
      ctx.beginPath(); ctx.moveTo(-6,2); ctx.lineTo(-3,6); ctx.lineTo(0,2); ctx.lineTo(3,6); ctx.lineTo(6,2); ctx.lineTo(6,8); ctx.lineTo(-6,8); ctx.closePath();
      ctx.fillStyle = '#3e0000'; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 1; ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-4,4); ctx.lineTo(4,4); ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.stroke();
    }
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

  ctx.restore();

  // HP Bar（在 world-space 繪製，不受 rotation 影響）
  const hpRatio = Math.max(0, zombie.hp / zombie.maxHp);
  const bw = zombie.radius * 2;
  const bh = zombie.type === 'big' ? 5 : 3;
  ctx.fillStyle = 'red';   ctx.fillRect(zombie.x - bw/2, zombie.y - zombie.radius - 10, bw, bh);
  ctx.fillStyle = 'green'; ctx.fillRect(zombie.x - bw/2, zombie.y - zombie.radius - 10, bw * hpRatio, bh);
}
