import { ArcProjectile } from '../entities/ArcProjectile';

export function drawArcProjectiles(arcs: ArcProjectile[], ctx: CanvasRenderingContext2D): void {
  for (const arc of arcs) {
    if (arc.isEmbedded) continue; // 嵌入後由 EffectRenderer 的 arc_spark 負責動畫
    
    ctx.save();
    ctx.translate(arc.x, arc.y);
    const angle = Math.atan2(arc.vy, arc.vx);
    ctx.rotate(angle);
    
    // 電漿彈視覺 (高亮藍色能量球帶拖尾)
    ctx.beginPath();
    ctx.ellipse(0, 0, arc.radius * 2, arc.radius, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 240, 255, 0.8)';
    ctx.shadowColor = '#00a8ff';
    ctx.shadowBlur = 15;
    ctx.fill();
    
    // 核心高溫白點
    ctx.beginPath();
    ctx.ellipse(0, 0, arc.radius * 1.2, arc.radius * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowBlur = 0;
    ctx.fill();
    
    ctx.restore();
  }
}
