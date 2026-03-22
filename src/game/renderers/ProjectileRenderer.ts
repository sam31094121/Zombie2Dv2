// ── ProjectileRenderer.ts ─────────────────────────────────────────────────────
// 子彈繪圖邏輯（從 Projectile.ts 分離）
// 新增彈種外觀：在 BulletDefinitions.ts 加 entry，此檔零修改
// ─────────────────────────────────────────────────────────────────────────────
import { Projectile } from '../Projectile';
import { BULLET_REGISTRY } from './BulletDefinitions';

export function drawProjectile(proj: Projectile, ctx: CanvasRenderingContext2D): void {
  ctx.save();

  if (proj.type === 'bullet') {
    // 查登錄表，找不到就用預設 blue_ellipse
    const def = BULLET_REGISTRY[proj.bulletType] ?? BULLET_REGISTRY['blue_ellipse'];
    def.draw(ctx, proj);
  } else if (proj.type === 'slash') {
    const angle = Math.atan2(proj.vy, proj.vx);
    const progress = 1 - (proj.lifetime / proj.maxLifetime);

    let visualProgress = 0;
    let alpha = 1;
    let offset = 0;

    if (progress < 0.2) {
      const p = progress / 0.2;
      visualProgress = 0;
      alpha = p * 0.5;
      offset = -10 * p;
    } else if (progress < 0.6) {
      const p = (progress - 0.2) / 0.4;
      visualProgress = p;
      alpha = 1;
      offset = -10 * (1 - p);
    } else {
      const p = (progress - 0.6) / 0.4;
      visualProgress = 1;
      alpha = 1 - p;
      offset = 0;
    }

    if (alpha <= 0) { ctx.restore(); return; }

    ctx.translate(proj.x, proj.y);
    ctx.rotate(angle);
    ctx.translate(offset, 0);

    let startAngle = -Math.PI / 4;
    let endAngle   = Math.PI / 4;

    if      (proj.level === 2) { startAngle = -Math.PI / 4;               endAngle = Math.PI / 4; }
    else if (proj.level === 3) { startAngle = -(50 * Math.PI / 180);      endAngle = (50 * Math.PI / 180); }
    else if (proj.level === 4) { startAngle = -Math.PI / 3;               endAngle = Math.PI / 3; }
    else if (proj.level === 5) { startAngle = -(85 * Math.PI / 180);      endAngle = (85 * Math.PI / 180); }

    const currentEndAngle = startAngle + (endAngle - startAngle) * visualProgress;

    if (visualProgress > 0) {
      if (proj.level === 1) {
        // Lv.1: Rusty Dagger
        ctx.beginPath();
        ctx.arc(0, 0, proj.radius, startAngle, currentEndAngle);
        ctx.strokeStyle = `rgba(158, 158, 158, ${alpha})`;
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, proj.radius, startAngle, currentEndAngle);
        ctx.fillStyle = `rgba(158, 158, 158, ${alpha * 0.2})`;
        ctx.fill();
      } else if (proj.level === 2) {
        // Lv.2: Steel Longsword
        ctx.shadowColor = '#ffffff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, proj.radius, startAngle, currentEndAngle);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 8;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(0, 0, proj.radius - 2, startAngle, currentEndAngle);
        ctx.strokeStyle = `rgba(200, 220, 255, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, proj.radius, startAngle, currentEndAngle);
        ctx.fillStyle = `rgba(224, 230, 255, ${alpha * 0.25})`;
        ctx.fill();
        ctx.shadowBlur = 0;
      } else if (proj.level === 3) {
        // Lv.3: Ice Greatsword
        ctx.shadowColor = '#00b0ff';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(0, 0, proj.radius, startAngle, currentEndAngle);
        ctx.strokeStyle = `rgba(128, 216, 255, ${alpha})`;
        ctx.lineWidth = 15;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, proj.radius, startAngle, currentEndAngle);
        ctx.fillStyle = `rgba(0, 176, 255, ${alpha * 0.4})`;
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        for (let i = 0; i < 5; i++) {
          const shardAngle = startAngle + (endAngle - startAngle) * Math.random() * visualProgress;
          const dist = proj.radius * (0.5 + Math.random() * 0.5);
          ctx.fillRect(Math.cos(shardAngle) * dist, Math.sin(shardAngle) * dist, 4, 4);
        }
        ctx.shadowBlur = 0;
      } else if (proj.level === 4) {
        // Lv.4: Pulse Light Blade
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur = 20;
        const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, proj.radius);
        grad.addColorStop(0,   `rgba(255, 0, 0, 0)`);
        grad.addColorStop(0.8, `rgba(255, 0, 0, ${alpha})`);
        grad.addColorStop(1,   `rgba(255, 200, 0, ${alpha})`);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, proj.radius, startAngle, currentEndAngle);
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(0, 0, proj.radius, startAngle, currentEndAngle);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else if (proj.level === 5) {
        // Lv.5: Mythic Judgment
        ctx.shadowColor = '#ffd600';
        ctx.shadowBlur = 30;
        ctx.beginPath();
        ctx.arc(0, 0, proj.radius, startAngle, currentEndAngle);
        ctx.strokeStyle = `rgba(255, 214, 0, ${alpha})`;
        ctx.lineWidth = 20 * alpha;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, proj.radius, startAngle, currentEndAngle);
        ctx.fillStyle = `rgba(255, 234, 0, ${alpha * 0.3})`;
        ctx.fill();
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        for (let i = 0; i < 8; i++) {
          const pAngle = startAngle + (endAngle - startAngle) * Math.random() * visualProgress;
          const pDist = proj.radius * Math.random();
          ctx.beginPath();
          ctx.arc(Math.cos(pAngle) * pDist, Math.sin(pAngle) * pDist, 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }

      // Motion blur edge (white light stream)
      if (progress >= 0.2 && progress < 0.6) {
        ctx.beginPath();
        ctx.arc(0, 0, proj.radius, currentEndAngle - 0.2, currentEndAngle);
        ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.lineWidth = 10;
        ctx.stroke();
      }
    }
  } else if (proj.type === 'zombie_spit') {
    ctx.shadowColor = '#8bc34a';
    ctx.shadowBlur = 15;

    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#9c27b0';
    ctx.fill();
    ctx.closePath();

    const t = Date.now() / 100;
    ctx.fillStyle = '#8bc34a';
    ctx.beginPath(); ctx.arc(proj.x - 3, proj.y - 3 + Math.sin(t) * 2, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(proj.x + 3, proj.y + 2 + Math.cos(t) * 2, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(proj.x - 1, proj.y + 4 + Math.sin(t + 1) * 2, 2, 0, Math.PI * 2); ctx.fill();

    ctx.beginPath();
    ctx.arc(proj.x - proj.vx * 0.05, proj.y - proj.vy * 0.05, proj.radius * 0.8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(156, 39, 176, 0.5)';
    ctx.fill();
    ctx.closePath();

    ctx.shadowBlur = 0;
  }

  ctx.restore();
}
