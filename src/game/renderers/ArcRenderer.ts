import { ArcProjectile } from '../entities/ArcProjectile';

export function drawArcProjectiles(arcs: ArcProjectile[], ctx: CanvasRenderingContext2D): void {
  for (const arc of arcs) {
    if (arc.isEmbedded) continue;

    ctx.save();
    ctx.translate(arc.x, arc.y);

    const angle = Math.atan2(arc.vy, arc.vx);
    ctx.rotate(angle);

    const speed = Math.hypot(arc.vx, arc.vy);
    const t = Date.now() / 1000;
    const flicker = 0.85 + Math.sin(t * 26 + arc.x * 0.07) * 0.12;

    // Plasma length scales with projectile speed for stronger motion feeling.
    const bodyLen = arc.radius * (2.6 + Math.min(speed / 18, 0.8));
    const bodyHalfH = arc.radius * 0.85;

    // Outer ionized glow
    ctx.shadowColor = '#00d4ff';
    ctx.shadowBlur = 22;
    const outer = ctx.createLinearGradient(-bodyLen * 0.5, 0, bodyLen * 0.75, 0);
    outer.addColorStop(0, 'rgba(0, 90, 255, 0.05)');
    outer.addColorStop(0.35, `rgba(0, 200, 255, ${0.38 * flicker})`);
    outer.addColorStop(0.8, `rgba(130, 255, 255, ${0.55 * flicker})`);
    outer.addColorStop(1, 'rgba(255, 255, 255, 0.08)');

    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen, bodyHalfH * 1.25, 0, 0, Math.PI * 2);
    ctx.fillStyle = outer;
    ctx.fill();

    // Main plasma body
    ctx.shadowBlur = 12;
    const mid = ctx.createLinearGradient(-bodyLen * 0.55, 0, bodyLen * 0.7, 0);
    mid.addColorStop(0, `rgba(18, 70, 255, ${0.45 * flicker})`);
    mid.addColorStop(0.4, `rgba(0, 230, 255, ${0.75 * flicker})`);
    mid.addColorStop(0.9, `rgba(170, 255, 255, ${0.9 * flicker})`);
    mid.addColorStop(1, `rgba(255, 255, 255, ${0.95 * flicker})`);

    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen * 0.78, bodyHalfH, 0, 0, Math.PI * 2);
    ctx.fillStyle = mid;
    ctx.fill();

    // White-hot core
    ctx.shadowBlur = 0;
    const core = ctx.createLinearGradient(-bodyLen * 0.35, 0, bodyLen * 0.6, 0);
    core.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
    core.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
    core.addColorStop(1, 'rgba(255, 255, 255, 0.7)');

    ctx.beginPath();
    ctx.ellipse(0, 0, bodyLen * 0.46, bodyHalfH * 0.48, 0, 0, Math.PI * 2);
    ctx.fillStyle = core;
    ctx.fill();

    // Plasma filaments (small lightning veins)
    ctx.globalAlpha = 0.7 * flicker;
    ctx.strokeStyle = '#a5f3fc';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 2; i++) {
      const yOffset = (i === 0 ? -1 : 1) * bodyHalfH * 0.45;
      ctx.beginPath();
      ctx.moveTo(-bodyLen * 0.2, yOffset);
      ctx.quadraticCurveTo(0, yOffset * 0.25, bodyLen * 0.28, yOffset * 0.7);
      ctx.quadraticCurveTo(bodyLen * 0.45, yOffset * 0.4, bodyLen * 0.62, yOffset * 0.15);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    ctx.restore();
  }
}
