// ── UpgradePanel.tsx ──────────────────────────────────────────────────────────
// 升級選擇面板：玩家升級時暫停遊戲，出現 3 張升級卡讓玩家選擇
// ─────────────────────────────────────────────────────────────────────────────
import React, { useMemo } from 'react';
import { Player } from '../game/Player';
import { WEAPON_BRANCH_INFO } from '../game/entities/definitions/WeaponDefinitions';

// ── 升級卡類型 ────────────────────────────────────────────────────────────────
export type UpgradeCard =
  | { kind: 'weapon_level'; weapon: 'sword' | 'gun'; fromLv: number }
  | { kind: 'branch';       weapon: 'sword' | 'gun'; branch: 'A' | 'B' }
  | { kind: 'passive';      key: string; emoji: string; name: string; desc: string };

// ── 被動選項池 ────────────────────────────────────────────────────────────────
type PassiveCard = Extract<UpgradeCard, { kind: 'passive' }>;
const PASSIVE_POOL: PassiveCard[] = [
  { kind: 'passive', key: 'damage',      emoji: '⚔️',  name: '傷害強化',  desc: '所有傷害 +15%' },
  { kind: 'passive', key: 'haste',       emoji: '⚡',  name: '攻速強化',  desc: '攻擊速度 +15%' },
  { kind: 'passive', key: 'agility',     emoji: '👟',  name: '疾步',      desc: '移動速度 +10%' },
  { kind: 'passive', key: 'vitality',    emoji: '❤️',  name: '生命強化',  desc: '最大 HP +25'   },
  { kind: 'passive', key: 'magnet',      emoji: '🧲',  name: '磁力強化',  desc: 'XP 吸收範圍×1.5' },
  { kind: 'passive', key: 'recovery',    emoji: '💊',  name: '恢復',      desc: '立刻回復 30 HP' },
];

// ── 產生 3 個升級選項 ────────────────────────────────────────────────────────
export function generateUpgradeOptions(player: Player): UpgradeCard[] {
  const cards: UpgradeCard[] = [];
  const branch = player.weaponBranches[player.weapon];

  // 分支選擇（玩家等級 >= 5 且尚未選擇）
  if (player.level >= 5 && !branch) {
    cards.push({ kind: 'branch', weapon: player.weapon, branch: 'A' });
    cards.push({ kind: 'branch', weapon: player.weapon, branch: 'B' });
    // 第 3 張給被動
    const pool = [...PASSIVE_POOL];
    cards.push(pool[Math.floor(Math.random() * pool.length)]);
    return cards;
  }

  // 填滿到 3 張（隨機被動，避免重複）
  const shuffled = [...PASSIVE_POOL].sort(() => Math.random() - 0.5);
  for (const p of shuffled) {
    if (cards.length >= 3) break;
    cards.push(p);
  }

  // 洗牌順序
  return cards.sort(() => Math.random() - 0.5).slice(0, 3);
}

// ── 卡片顯示內容 ──────────────────────────────────────────────────────────────
function cardContent(card: UpgradeCard) {
  if (card.kind === 'weapon_level') {
    const names = { sword: '劍', gun: '槍' };
    const emoji = card.weapon === 'sword' ? '⚔️' : '🔫';
    return {
      emoji,
      title: `${names[card.weapon]}升級`,
      subtitle: `Lv ${card.fromLv} → ${card.fromLv + 1}`,
      desc: '武器威力提升，獲得新的攻擊行為',
      color: card.weapon === 'sword' ? '#4fc3f7' : '#ff8a65',
    };
  }
  if (card.kind === 'branch') {
    const info = WEAPON_BRANCH_INFO[card.weapon][card.branch];
    return {
      emoji: info.emoji,
      title: info.name,
      subtitle: `${card.weapon === 'sword' ? '劍' : '槍'} 分支 ${card.branch}`,
      desc: info.description,
      color: card.branch === 'A' ? '#4fc3f7' : '#ff8a65',
    };
  }
  // passive
  return {
    emoji: card.emoji,
    title: card.name,
    subtitle: '被動強化',
    desc: card.desc,
    color: '#aed581',
  };
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  player: Player;
  onSelect: (card: UpgradeCard) => void;
}

// ── 主元件 ──────────────────────────────────────────────────────────────────
export function UpgradePanel({ player, onSelect }: Props) {
  // [修正] 移除對 player.level 的過度依賴，改用玩家當前主武器的等級與分支狀態作為快取鍵值
  // 這樣即使等級沒變（如 debug 觸發或重複升級），只要武器狀態不同就會重新計算
  const weaponStateKey = `${player.level}-${player.weapon}-${player.weaponLevels[player.weapon]}-${player.weaponBranches[player.weapon]}`;
  const options = useMemo(() => generateUpgradeOptions(player), [weaponStateKey]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center"
         style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>

      {/* 標題 */}
      <div className="text-center mb-6">
        <div className="text-yellow-300 text-2xl font-black tracking-widest mb-1">
          LEVEL UP!
        </div>
        <div className="text-gray-400 text-sm">
          P{player.id} — 選擇一個升級
        </div>
      </div>

      {/* 3 張卡片 */}
      <div className="flex flex-col sm:flex-row justify-center items-stretch sm:items-center gap-3 sm:gap-6 w-full max-w-xs sm:max-w-4xl mx-auto px-4 sm:px-0">
        {options.map((card, i) => {
          const c = cardContent(card);
          return (
            <button
              key={i}
              onClick={() => onSelect(card)}
              className="w-full sm:w-56 p-4 sm:p-6 rounded-2xl border-2 cursor-pointer transition-all duration-150 hover:scale-105 hover:brightness-110 active:scale-95 flex flex-row sm:flex-col items-center gap-4 sm:gap-3 select-none touch-manipulation text-left sm:text-center"
              style={{
                background: 'rgba(20,20,30,0.95)',
                borderColor: c.color,
                boxShadow: `0 0 18px ${c.color}55`,
              }}
            >
              <div className="text-3xl sm:text-4xl shrink-0">{c.emoji}</div>
              <div className="flex flex-col items-start sm:items-center flex-1">
                <div className="flex sm:flex-col items-center sm:items-center gap-2 sm:gap-0 w-full mb-1 sm:mb-0">
                  <div className="text-white font-black text-sm leading-tight">{c.title}</div>
                  <div className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-full mt-0 sm:mt-1 ml-auto sm:ml-0"
                       style={{ background: c.color + '33', color: c.color }}>
                    {c.subtitle}
                  </div>
                </div>
                <div className="text-gray-400 text-[10px] sm:text-xs leading-snug">{c.desc}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="text-gray-600 text-xs mt-6">點擊卡片選擇</div>
    </div>
  );
}
