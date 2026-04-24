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
    description: '每波開始生成一棵蘋果樹，之後每 10 秒掉 1 顆蘋果回血。',
    apply: (_player) => {
      // Wave behavior is driven by Game arena logic.
    },
  },
  knife: {
    id: 'knife',
    name: '刀子',
    type: 'permanent',
    cost: 20,
    icon: '🔪',
    description: '劍類傷害 +1',
    apply: (player) => {
      player.swordDamageBonus += 1;
    },
    unapply: (player) => {
      player.swordDamageBonus -= 1;
    },
  },
};
