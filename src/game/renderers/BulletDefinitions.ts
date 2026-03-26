// ── BulletDefinitions.ts ──────────────────────────────────────────────────────
// 子彈外觀模組登錄表（Registry Pattern）
//
// 新增子彈外觀：
//   1. 在 BULLET_REGISTRY 加一個 key + draw 函式
//   ✅ 槍的定義 / ProjectileRenderer 主邏輯零修改
//
// 使用方式：
//   任何武器 fire() 在 ProjectileSpec 指定 bulletType: 'blue_ellipse'
//   ProjectileRenderer 呼叫 BULLET_REGISTRY[proj.bulletType].draw(ctx, proj)
// ─────────────────────────────────────────────────────────────────────────────
import type { Projectile } from '../Projectile';
import type { Zombie } from '../Zombie';
import type { HitEffect } from './EffectRenderer';

// 打中殭屍時傳入的最小上下文（避免循環依賴，不直接傳 Game）
export type BulletHitCtx = {
  zombie: Zombie;
  pushEffect: (e: HitEffect) => void;
};

export interface IBulletDef {
  draw(ctx: CanvasRenderingContext2D, proj: Projectile): void;
  // 子彈打中殭屍時的效果；未定義 = 無特殊效果
  onHit?: (ctx: BulletHitCtx) => void;
}

export const BULLET_REGISTRY: Record<string, IBulletDef> = {

  // ── 藍色橢圓（目前所有槍預設使用）──────────────────────────────────────────
  blue_ellipse: {
    draw(ctx, proj) {
      const angle = Math.atan2(proj.vy, proj.vx);
      ctx.save();
      ctx.translate(proj.x, proj.y);
      ctx.rotate(angle);
      
      // 主體發光與放大
      ctx.shadowColor = '#00e5ff';
      ctx.shadowBlur = 10;
      
      ctx.beginPath();
      // 大小總長約 20px (半徑 10x5)
      ctx.ellipse(0, 0, 10, 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff'; // 核心白化強化高能熱點
      ctx.fill();
      
      ctx.shadowBlur = 0;
      ctx.beginPath();
      ctx.ellipse(0, 0, 11, 6, 0, 0, Math.PI * 2);
      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.restore();
    },
    onHit({ zombie, pushEffect }) {
      pushEffect({ x: zombie.x, y: zombie.y, type: 'grey_sparks', lifetime: 90, maxLifetime: 90 });
      // 高對比白閃：瞬時爆亮 (0.09秒)，強化每顆子彈的命中「重量感」
      pushEffect({ x: zombie.x, y: zombie.y, type: 'white_flash', lifetime: 90, maxLifetime: 90 });
    },
  },

};
