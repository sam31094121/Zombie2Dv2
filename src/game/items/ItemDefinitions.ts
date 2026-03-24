// ── ItemDefinitions.ts ────────────────────────────────────────────────────────
// 競技場模式「配件」系統 — Registry Pattern
// 新增配件只需在 ITEM_REGISTRY 加一筆
// ─────────────────────────────────────────────────────────────────────────────
import type { Player } from '../Player';

export type ItemType = 'consumable' | 'permanent';

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  cost: number;
  description: string;
  icon: string;
  /** 購買時立即執行（permanent）或使用時執行（consumable） */
  apply(player: Player): void;
  /** 出售時反轉效果（permanent 專用） */
  unapply?(player: Player): void;
}

export const ITEM_REGISTRY: Record<string, ItemDef> = {
  guest_pass: {
    id: 'guest_pass', name: '招待券', type: 'consumable', cost: 15, icon: '🎫',
    description: '持有中 → 下次商店重擲免費一次（自動生效）',
    apply: (_p) => { /* 效果由 ShopPanel reroll 邏輯處理 */ },
    // 出售：移除即可，無需反轉
  },
  big_bullet: {
    id: 'big_bullet', name: '大子彈', type: 'permanent', cost: 20, icon: '💣',
    description: '槍類傷害 +1',
    apply: (p) => { p.gunDamageBonus += 1; },
    unapply: (p) => { p.gunDamageBonus -= 1; },
  },
  boxing_gloves: {
    id: 'boxing_gloves', name: '拳擊手套', type: 'permanent', cost: 20, icon: '🥊',
    description: '擊退 +1',
    apply: (p) => { p.knockback += 1; },
    unapply: (p) => { p.knockback -= 1; },
  },
  knife: {
    id: 'knife', name: '刀子', type: 'permanent', cost: 20, icon: '🔪',
    description: '劍類傷害 +1',
    apply: (p) => { p.swordDamageBonus += 1; },
    unapply: (p) => { p.swordDamageBonus -= 1; },
  },
};
