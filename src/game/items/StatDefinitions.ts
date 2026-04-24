// ── StatDefinitions.ts ────────────────────────────────────────────────────────
// 競技場模式「素質」系統 — Registry Pattern（開放/封閉原則）
// 新增素質只需在 STAT_REGISTRY 加一筆，UI 與邏輯自動感知
// ─────────────────────────────────────────────────────────────────────────────
import type { Player } from '../Player';

export interface StatDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  maxLevel: number; // -1 = 無上限
  apply(player: Player): void;
}

export const STAT_REGISTRY: Record<string, StatDef> = {
  maxHp: {
    id: 'maxHp', name: '最大血量', icon: '❤️',
    description: '+25 HP 上限',
    maxLevel: 20,
    apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.hp + 10, p.maxHp); },
  },
  speed: {
    id: 'speed', name: '移動速度', icon: '🏃',
    description: '+8% 移動速度',
    maxLevel: 15,
    apply: (p) => { p.speed *= 1.08; },
  },
  damage: {
    id: 'damage', name: '傷害加成', icon: '⚔️',
    description: '+10% 全傷害',
    maxLevel: 15,
    apply: (p) => { p.damageMultiplier *= 1.10; },
  },
  attackSpeed: {
    id: 'attackSpeed', name: '攻擊速度', icon: '⚡',
    description: '+10% 攻擊速度',
    maxLevel: 15,
    apply: (p) => { p.attackSpeedMultiplier *= 1.10; },
  },
  pickupRadius: {
    id: 'pickupRadius', name: '吸取範圍', icon: '🧲',
    description: '+10% 拾取範圍',
    maxLevel: 10,
    apply: (p) => { p.pickupRadiusMultiplier *= 1.10; },
  },
  armor: {
    id: 'armor', name: '護甲', icon: '🛡️',
    description: '+1 傷害減免（每點減少 1 點傷害）',
    maxLevel: 20,
    apply: (p) => { p.armor += 1; },
  },
  knockback: {
    id: 'knockback', name: '擊退力', icon: '💥',
    description: '+1 擊退距離',
    maxLevel: 10,
    apply: (p) => { p.knockback += 1; },
  },
  regen: {
    id: 'regen', name: '再生', icon: '💚',
    description: '+0.5 HP / 秒',
    maxLevel: 10,
    apply: (p) => { p.regenPerSecond += 0.5; },
  },
};
