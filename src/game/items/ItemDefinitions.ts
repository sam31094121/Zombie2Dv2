import type { Player } from '../Player';

export type ItemType = 'consumable' | 'permanent';

export interface ItemDef {
  id: string;
  name: string;
  type: ItemType;
  cost: number;
  description: string;
  icon: string;
  maxOwned?: number;
  apply(player: Player): void;
  unapply?(player: Player): void;
}

export const ITEM_REGISTRY: Record<string, ItemDef> = {
  guest_pass: {
    id: 'guest_pass',
    name: '招待券',
    type: 'consumable',
    cost: 15,
    icon: '🎟️',
    description: '下一次重抽免費。',
    apply: (_player) => {
      // Consumed by ShopPanel when rerolling.
    },
  },
  apple_tree: {
    id: 'apple_tree',
    name: '蘋果樹',
    type: 'permanent',
    cost: 20,
    icon: '🌳',
    maxOwned: 1,
    description: '每波生成一棵蘋果樹，之後每 10 秒掉 1 顆蘋果。',
    apply: (_player) => {
      // Wave behavior is driven by Game arena logic.
    },
  },
};
