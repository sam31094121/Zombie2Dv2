// ── ShopPanel.tsx ─────────────────────────────────────────────────────────────
// 競技場模式商店模組 — 支援單人模式與雙人模式（透過 Props 擴充）
// Phase 1: 素質選擇 / Phase 2: 武器 & 配件商店
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { Player, WeaponSlot, OwnedItem } from '../../game/Player';
import { audioManager } from '../../game/AudioManager';
import { STAT_REGISTRY } from '../../game/items/StatDefinitions';
import { ITEM_REGISTRY } from '../../game/items/ItemDefinitions';
import { WeaponPreviewCanvas } from './WeaponPreviewCanvas';
import { StarRating } from './StarRating';

// ── 商店卡牌型別（export 供外部使用）────────────────────────────────────────

export interface WeaponCard {
  id: string;
  cardType: 'weapon';
  type: 'sword' | 'gun';
  level: number;
  branch: 'A' | 'B' | null;
  cost: number;
}

export interface ItemCard {
  id: string;
  cardType: 'item';
  defId: string;
}

export type ShopCard = WeaponCard | ItemCard;

// ── 工具函式（export 供外部共用）────────────────────────────────────────────

export function getWeaponLevel(wave: number): number {
  const r = Math.random();
  if (wave === 1) {
    return 1;
  } else if (wave <= 3) {
    if (r < 0.60) return 1;
    if (r < 0.90) return 2;
    return 3;
  } else if (wave <= 6) {
    if (r < 0.20) return 1;
    if (r < 0.60) return 2;
    if (r < 0.90) return 3;
    return 4;
  } else if (wave <= 9) {
    if (r < 0.15) return 2;
    if (r < 0.50) return 3;
    if (r < 0.85) return 4;
    return 5;
  } else {
    if (r < 0.05) return 2;
    if (r < 0.25) return 3;
    if (r < 0.65) return 4;
    return 5 + Math.floor(Math.random() * 3); // 5-7
  }
}

export function weaponCost(level: number): number {
  return Math.floor(15 * Math.pow(2, level - 1));
}

export function drawCards(wave: number, count: number = 5): ShopCard[] {
  const weaponCount = Math.random() < 0.5 ? Math.floor(count / 2) : Math.ceil(count / 2);
  const itemCount = count - weaponCount;
  const cards: ShopCard[] = [];

  for (let i = 0; i < weaponCount; i++) {
    const level = getWeaponLevel(wave);
    const type: 'sword' | 'gun' = Math.random() < 0.5 ? 'sword' : 'gun';
    const branch: 'A' | 'B' | null = level >= 5 ? (Math.random() < 0.5 ? 'A' : 'B') : null;
    cards.push({
      id: Math.random().toString(36).substr(2, 9),
      cardType: 'weapon',
      type, level, branch,
      cost: weaponCost(level),
    });
  }

  const itemKeys = Object.keys(ITEM_REGISTRY);
  for (let i = 0; i < itemCount; i++) {
    const defId = itemKeys[Math.floor(Math.random() * itemKeys.length)];
    cards.push({
      id: Math.random().toString(36).substr(2, 9),
      cardType: 'item',
      defId,
    });
  }

  return cards.sort(() => Math.random() - 0.5);
}

// ── 常數（export 供外部共用）────────────────────────────────────────────────

export const RARITY_COLOR = ['#9ca3af', '#4ade80', '#60a5fa', '#c084fc', '#f59e0b'];
export const weaponColor = (level: number) => RARITY_COLOR[Math.min(level - 1, 4)];

export const BRANCH_DISPLAY: Record<string, Record<'A' | 'B', string>> = {
  sword: { A: '旋風流', B: '閃光流' },
  gun:   { A: '燃燒流', B: '狙擊流' },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface ShopPanelProps {
  // ─ 必要 ─
  player: Player;
  wave: number;
  onNextWave: () => void;

  // ─ 單人模式下的準備按鈕控制 ─
  isReadyMode?: boolean;   // 改為 Ready 按鈕，不直接開始下一波
  isReady?: boolean;       // 是否已按下 Ready

  // ─ 雙人整合用 Props（不傳時完全等同單人行為）─
  /** 覆蓋素質點數來源（雙人共享點數池）。不傳時使用 player.arenaStatPoints */
  statPointsOverride?: number;
  /** 覆蓋素質升級行為（雙人: 兩人同步升）。不傳時使用單人標準流程 */
  onStatUpgradeOverride?: (statId: string) => void;
  /** 隱藏頂部的武器欄（雙人模式改在底部 CharacterPreview 顯示）*/
  hideInventory?: boolean;
  /** 商店呈現的卡片數量（預設 5） */
  cardCount?: number;
  /** 注入到底部的自訂區塊（雙人模式的角色預覽 + 準備按鈕）*/
  customFooter?: React.ReactNode;
}

// ── 主元件 ────────────────────────────────────────────────────────────────────

export const ShopPanel: React.FC<ShopPanelProps> = ({
  player,
  wave,
  onNextWave,
  isReadyMode = false,
  isReady = false,
  // 雙人整合 props
  statPointsOverride,
  onStatUpgradeOverride,
  hideInventory = false,
  cardCount = 5,
  customFooter,
}) => {
  // ── 決定當前有效的素質點數 ──
  // 優先使用 statPointsOverride（雙人共享點數），否則用玩家個人點數
  const effectiveStatPoints = statPointsOverride !== undefined
    ? statPointsOverride
    : player.arenaStatPoints;

  const [phase, setPhase] = useState<1 | 2>(effectiveStatPoints > 0 ? 1 : 2);
  const [shopCards, setShopCards] = useState<ShopCard[]>(() => drawCards(wave, cardCount));
  const [rerollCost, setRerollCost] = useState(10);
  const [mergePending, setMergePending] = useState<{ keepId: string; removeId: string } | null>(null);
  const [branchPending, setBranchPending] = useState<{ weaponId: string } | null>(null);
  const [, forceUpdate] = useState(0);
  const rerender = () => forceUpdate(n => n + 1);

  // ── 購買金幣噴射特效 ────────────────────────────────────────────────────────
  const [coinBursts, setCoinBursts] = useState<{ id: number; dx: number }[]>([]);
  const triggerCoinBurst = () => {
    const coins = Array.from({ length: 5 }, (_, i) => ({
      id: Date.now() + i,
      dx: (i - 2) * 14,
    }));
    setCoinBursts(prev => [...prev, ...coins]);
    setTimeout(() => {
      const ids = new Set(coins.map(c => c.id));
      setCoinBursts(prev => prev.filter(c => !ids.has(c.id)));
    }, 750);
  };

  // ── Phase 1：選擇素質 ──────────────────────────────────────────────────────
  const handlePickStat = (id: string) => {
    // 如果外部提供了 override callback（雙人模式），交由外部處理
    if (onStatUpgradeOverride) {
      onStatUpgradeOverride(id);
      return;
    }

    // 單人模式：直接操作玩家個人點數
    if (player.arenaStatPoints <= 0) return;
    const def = STAT_REGISTRY[id];
    if (!def) return;
    const curLv = player.statLevels[id] ?? 0;
    if (def.maxLevel !== -1 && curLv >= def.maxLevel) return;
    def.apply(player);
    player.statLevels[id] = curLv + 1;
    player.arenaStatPoints -= 1;
    audioManager.playPickup();
    rerender();
  };

  // ── Phase 2：購買武器 ──────────────────────────────────────────────────────
  const handleBuyWeapon = (card: WeaponCard) => {
    if (player.materials < card.cost || player.weapons.length >= 6) return;
    player.materials -= card.cost;
    const newSlot: WeaponSlot = {
      id: Math.random().toString(36).substr(2, 9),
      type: card.type,
      level: card.level,
      branch: card.branch,
      lastAttackTime: 0,
    };
    player.weapons.push(newSlot);
    audioManager.playPickup();
    triggerCoinBurst();
    setShopCards(prev => prev.filter(c => c.id !== card.id));
    rerender();
  };

  // ── Phase 2：購買配件 ──────────────────────────────────────────────────────
  const handleBuyItem = (card: ItemCard) => {
    const def = ITEM_REGISTRY[card.defId];
    if (!def || player.materials < def.cost) return;
    player.materials -= def.cost;
    if (def.type === 'permanent') def.apply(player);
    player.ownedItems.push({ id: Math.random().toString(36).substr(2, 9), defId: card.defId });
    audioManager.playPickup();
    triggerCoinBurst();
    setShopCards(prev => prev.filter(c => c.id !== card.id));
    rerender();
  };

  // ── Phase 2：重擲 ──────────────────────────────────────────────────────────
  const handleReroll = () => {
    const passIdx = player.ownedItems.findIndex(i => i.defId === 'guest_pass');
    const hasFreePass = passIdx !== -1;
    if (!hasFreePass && player.materials < rerollCost) return;
    if (hasFreePass) {
      player.ownedItems.splice(passIdx, 1);
    } else {
      player.materials -= rerollCost;
      setRerollCost(prev => prev + 5);
    }
    audioManager.playPickup();
    setShopCards(drawCards(wave, cardCount));
    rerender();
  };

  // ── 武器欄點擊（合成 or 賣出）──────────────────────────────────────────────
  const handleInventoryWeaponClick = (w: WeaponSlot) => {
    const match = player.weapons.find(o =>
      o.id !== w.id && o.type === w.type && o.level === w.level && o.branch === w.branch
    );
    if (match) {
      setMergePending({ keepId: w.id, removeId: match.id });
    } else {
      const price = Math.floor(weaponCost(w.level) * 0.5);
      if (window.confirm(`賣掉 Lv.${w.level} ${w.type === 'sword' ? '劍' : '槍'}${w.branch ?? ''} 換取 💰${price}？`)) {
        const idx = player.weapons.findIndex(x => x.id === w.id);
        if (idx !== -1) { player.weapons.splice(idx, 1); player.materials += price; }
        audioManager.playPickup();
        rerender();
      }
    }
  };

  // ── 出售配件 ──────────────────────────────────────────────────────────────
  const handleSellItem = (item: OwnedItem) => {
    const def = ITEM_REGISTRY[item.defId];
    if (!def) return;
    const price = Math.floor(def.cost * 0.5);
    if (!window.confirm(`賣掉「${def.name}」換取 💰${price}？`)) return;
    if (def.type === 'permanent' && def.unapply) def.unapply(player);
    player.ownedItems = player.ownedItems.filter(i => i.id !== item.id);
    player.materials += price;
    audioManager.playPickup();
    rerender();
  };

  // ── 合成確認 ──────────────────────────────────────────────────────────────
  const handleConfirmMerge = () => {
    if (!mergePending) return;
    const keep = player.weapons.find(w => w.id === mergePending.keepId);
    const removeIdx = player.weapons.findIndex(w => w.id === mergePending.removeId);
    if (!keep || removeIdx === -1) { setMergePending(null); return; }
    player.weapons.splice(removeIdx, 1);
    keep.level += 1;
    keep.lastAttackTime = 0;
    audioManager.playPickup();
    setMergePending(null);
    if (keep.level === 5 && keep.branch === null) {
      setBranchPending({ weaponId: keep.id });
    } else {
      rerender();
    }
  };

  // ── 流派選擇 ──────────────────────────────────────────────────────────────
  const handleSelectBranch = (branch: 'A' | 'B') => {
    if (!branchPending) return;
    const w = player.weapons.find(x => x.id === branchPending.weaponId);
    if (w) w.branch = branch;
    setBranchPending(null);
    rerender();
  };

  const hasGuestPass = player.ownedItems.some(i => i.defId === 'guest_pass');
  const canReroll = hasGuestPass || player.materials >= rerollCost;

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes coinFloat {
          0%   { transform: translate(var(--coin-dx, 0px), 0) scale(1); opacity: 1; }
          100% { transform: translate(var(--coin-dx, 0px), -44px) scale(0.5); opacity: 0; }
        }
        .coin-float { animation: coinFloat 0.7s ease-out forwards; }
      `}</style>

      {/* ── 最外層容器 ──
          雙人模式下不撐滿高度（由外部 ManagementView 控制佈局）
          單人模式下 h-full 填滿整個 overlay */}
      <div
        className="relative w-full h-screen bg-[#060a10] flex flex-col items-center overflow-hidden text-neutral-200"
        style={{
          backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          paddingTop: (isReadyMode || customFooter) ? '0' : 'env(safe-area-inset-top, 0px)',
          paddingBottom: (isReadyMode || customFooter) ? '0' : 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        {/* ── 雙人模式玩家身份橫幅（isReadyMode 情境下保留）── */}
        {isReadyMode && (
          <div
            className="flex-shrink-0 w-full text-center text-xs font-black py-1.5 tracking-widest"
            style={{ background: player.color + '33', borderBottom: `2px solid ${player.color}66`, color: player.color }}
          >
            P{player.id === 1 ? '1' : '2'} · {player.id === 1 ? '🔵 玩家一' : '🔴 玩家二'}
          </div>
        )}

        {/* ── Sticky Header ── */}
        <div className="flex-shrink-0 w-full max-w-2xl px-3 pt-2.5 pb-1.5 sm:px-6 sm:pt-4">
          {/* 資源列（含金幣噴射動畫容器） */}
          <div className="relative flex items-center gap-2 mb-1.5 bg-neutral-900/80 px-3 py-1.5 rounded-xl border border-neutral-700/30 w-full overflow-hidden">
            {/* 金幣噴射粒子 */}
            {coinBursts.map(c => (
              <span
                key={c.id}
                className="coin-float absolute text-base pointer-events-none z-10"
                style={{ '--coin-dx': `${c.dx}px`, left: '24px', top: '0px' } as React.CSSProperties}
              >
                🪙
              </span>
            ))}
            <div className="text-sm font-black flex items-center gap-1">💰 <span className="text-amber-500 font-bold">{player.materials >= 999999 ? '∞' : Math.floor(player.materials)}</span></div>
            <div className="text-[10px] text-neutral-500 font-bold ml-2">HP <span className="text-green-500">{Math.floor(player.hp)}</span></div>
            <div className="text-[10px] text-neutral-500 font-bold ml-1">LV <span className="text-blue-500">{player.level}</span></div>
            <div className="ml-auto text-amber-600 font-black text-[10px] tracking-widest">WAVE {wave} ✓</div>
          </div>

          {/* Phase 切換 Tab */}
          <div className="flex gap-1.5 w-full">
            <button
              onClick={() => setPhase(1)}
              className={`flex-1 py-1.5 rounded-lg font-black tracking-wide text-[10px] transition-all touch-manipulation ${phase === 1 ? 'bg-blue-600/90 text-white' : 'bg-neutral-800/80 text-neutral-500 active:bg-neutral-700'}`}
            >
              PHASE 1 素質
              {effectiveStatPoints > 0 && (
                <span className="ml-1 bg-yellow-500 text-black text-[9px] px-1 rounded-full">{effectiveStatPoints}</span>
              )}
            </button>
            <button
              onClick={() => setPhase(2)}
              className={`flex-1 py-1.5 rounded-lg font-black tracking-wide text-[10px] transition-all touch-manipulation ${phase === 2 ? 'bg-purple-600/90 text-white' : 'bg-neutral-800/80 text-neutral-500 active:bg-neutral-700'}`}
            >
              PHASE 2 武器
            </button>
          </div>
        </div>

        {/* ── 捲動主體 ── */}
        <div className="flex-1 w-full max-w-2xl overflow-y-auto overscroll-contain px-3 pb-4 sm:px-6" style={{ WebkitOverflowScrolling: 'touch' }}>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* PHASE 1 — 素質選擇                                                */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {phase === 1 && (
            <div className="w-full">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-black text-blue-400 tracking-widest">
                  可用點數：<span className="text-yellow-400">{effectiveStatPoints}</span>
                </h3>
                {effectiveStatPoints === 0 && (
                  <span className="text-neutral-500 text-[10px]">點數已用完</span>
                )}
              </div>

              {/* 手機 2 列 / 桌面 3 列 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.values(STAT_REGISTRY).map(stat => {
                  const curLv = player.statLevels[stat.id] ?? 0;
                  const isMaxed = stat.maxLevel !== -1 && curLv >= stat.maxLevel;
                  const disabled = isMaxed || effectiveStatPoints <= 0;
                  const barCount = stat.maxLevel > 0 ? Math.min(stat.maxLevel, 10) : 10;
                  const filledBars = Math.min(curLv, barCount);
                  return (
                    <button
                      key={stat.id}
                      onClick={() => handlePickStat(stat.id)}
                      disabled={disabled}
                      className={`p-2.5 rounded-xl border-2 text-left transition-all touch-manipulation min-h-[72px] ${
                        isMaxed
                          ? 'border-yellow-600/50 bg-yellow-900/20 opacity-60 cursor-not-allowed'
                          : disabled
                            ? 'border-neutral-700 bg-neutral-900/50 opacity-40 cursor-not-allowed'
                            : 'border-blue-500/50 bg-blue-900/20 active:bg-blue-900/50 cursor-pointer'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-base">{stat.icon}</span>
                        <span className="font-black text-[11px]">{stat.name}</span>
                        {isMaxed && <span className="ml-auto text-yellow-400 text-[9px] font-bold">MAX</span>}
                      </div>
                      <p className="text-[9px] text-neutral-400 mb-1.5 leading-snug">{stat.description}</p>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: barCount }).map((_, i) => (
                          <div key={i} className={`h-1 flex-1 rounded-full ${i < filledBars ? 'bg-blue-400' : 'bg-neutral-700'}`} />
                        ))}
                        <span className="text-[9px] text-neutral-500 ml-1 shrink-0">
                          {curLv}{stat.maxLevel !== -1 ? `/${stat.maxLevel}` : ''}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Phase 1 → Phase 2 捷徑 */}
              <button
                onClick={() => setPhase(2)}
                className="mt-3 w-full py-2.5 rounded-xl bg-purple-700/60 hover:bg-purple-700/80 active:bg-purple-800 border border-purple-500/50 font-black text-xs tracking-widest transition-all touch-manipulation"
              >
                前往武器商店 →
              </button>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* PHASE 2 — 武器 & 配件商店                                          */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {phase === 2 && (
            <>
              {/* ── 武器欄（hideInventory=true 時隱藏，雙人模式用 CharacterPreview 代替）── */}
              {!hideInventory && (
                <div className="w-full mb-2">
                  <h3 className="text-[10px] font-bold text-neutral-600 tracking-widest uppercase mb-1.5">
                    武器欄 ({player.weapons.length}/6)
                  </h3>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {Array.from({ length: 6 }).map((_, i) => {
                      const w = player.weapons[i];
                      if (!w) return (
                        <div key={`empty-${i}`} className="rounded-lg border-2 border-dashed border-neutral-900 flex items-center justify-center text-neutral-800 text-[9px] font-bold" style={{ minHeight: 90 }}>
                          EMPTY
                        </div>
                      );
                      const col = weaponColor(w.level);
                      const hasMatch = player.weapons.some(o =>
                        o.id !== w.id && o.type === w.type && o.level === w.level && o.branch === w.branch
                      );
                      return (
                        <div
                          key={w.id}
                          onClick={() => handleInventoryWeaponClick(w)}
                          className="rounded-lg border-2 flex flex-col items-center cursor-pointer active:scale-95 transition-all relative overflow-hidden touch-manipulation group"
                          style={{ borderColor: col + '44', boxShadow: `0 0 6px ${col}11`, minHeight: 90, background: '#0b1623' }}
                        >
                          <WeaponPreviewCanvas type={w.type} level={w.level} branch={w.branch} bufW={402} bufH={240} />
                          <div className="flex flex-col items-center gap-0.5 pb-1">
                            <span className="text-[9px] font-black" style={{ color: col }}>Lv.{w.level}{w.branch ?? ''}</span>
                            <StarRating level={w.level} branch={w.branch} size="xs" />
                          </div>
                          {hasMatch
                            ? <div className="absolute bottom-0 inset-x-0 bg-yellow-600 text-black text-[8px] text-center font-black py-0.5">⬆ 合成</div>
                            : <div className="absolute bottom-0 inset-x-0 bg-red-900/80 text-white text-[8px] text-center font-bold py-0.5 opacity-0 active:opacity-100 transition-opacity">賣出</div>
                          }
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── 配件背包 ── */}
              {player.ownedItems.length > 0 && (
                <div className="w-full mb-2">
                  <h3 className="text-[10px] font-bold text-neutral-500 tracking-widest uppercase mb-1.5">配件背包</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {player.ownedItems.map(item => {
                      const def = ITEM_REGISTRY[item.defId];
                      if (!def) return null;
                      return (
                        <div key={item.id} className="bg-neutral-900 border border-neutral-700/50 rounded-lg px-2 py-1 flex items-center gap-1.5 text-[11px]">
                          <span>{def.icon}</span>
                          <span className="font-bold text-[10px]">{def.name}</span>
                          {item.defId === 'guest_pass' && (
                            <span className="text-[9px] text-green-400">→ 重擲免費</span>
                          )}
                          <button
                            onClick={() => handleSellItem(item)}
                            className="ml-1 text-[9px] bg-red-900/60 active:bg-red-800 border border-red-700/50 px-1.5 py-0.5 rounded-md font-bold transition-colors touch-manipulation"
                          >
                            賣 💰{Math.floor(def.cost * 0.5)}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── 商店卡牌（手機 3 列 / 桌面 5 列，共 5 張）── */}
              <div className="w-full mb-3">
                <h3 className="text-[10px] font-bold text-neutral-500 tracking-widest uppercase mb-1.5">補給站</h3>
                <div className={`grid gap-2 ${cardCount > 5 ? 'grid-cols-4' : 'grid-cols-3 sm:grid-cols-5'}`}>
                  {shopCards.map(card => {
                    if (card.cardType === 'weapon') {
                      const col = weaponColor(card.level);
                      const canBuy = player.materials >= card.cost && player.weapons.length < 6;
                      return (
                        <div key={card.id} className="bg-[#0b1623] border-2 rounded-xl flex flex-col overflow-hidden" style={{ borderColor: col + '33' }}>
                          <WeaponPreviewCanvas type={card.type} level={card.level} branch={card.branch} bufW={402} bufH={240} />
                          <div className="flex flex-col items-center px-1 pb-1.5 pt-0.5 gap-0.5 flex-1">
                            <div className="font-bold text-[10px]" style={{ color: col }}>Lv.{card.level}{card.branch ?? ''}</div>
                            <StarRating level={card.level} branch={card.branch} size="xs" />
                            <button
                              onClick={() => handleBuyWeapon(card)}
                              disabled={!canBuy}
                              className={`mt-1.5 w-full py-1 rounded-lg font-black text-[9px] transition-all touch-manipulation ${canBuy ? 'bg-amber-600 active:bg-amber-500 text-white' : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'}`}
                            >
                              💰{card.cost}
                            </button>
                          </div>
                        </div>
                      );
                    } else {
                      const def = ITEM_REGISTRY[card.defId];
                      if (!def) return null;
                      const canBuy = player.materials >= def.cost;
                      return (
                        <div key={card.id} className={`bg-[#0b1623] border-2 rounded-xl p-1.5 flex flex-col items-center text-center ${def.type === 'consumable' ? 'border-green-900/40' : 'border-purple-900/40'}`}>
                          <span className="text-2xl mt-1">{def.icon}</span>
                          <div className="font-bold text-[10px] mt-1 leading-tight">{def.name}</div>
                          <p className="text-[8px] text-neutral-500 mb-1.5 flex-1 leading-tight">{def.description}</p>
                          <button
                            onClick={() => handleBuyItem(card)}
                            disabled={!canBuy}
                            className={`mt-auto w-full py-1 rounded-lg font-black text-[9px] transition-all touch-manipulation ${canBuy ? 'bg-amber-600 active:bg-amber-500 text-white' : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'}`}
                          >
                            💰{def.cost}
                          </button>
                        </div>
                      );
                    }
                  })}
                  {shopCards.length === 0 && (
                    <div className="col-span-3 sm:col-span-5 py-8 text-center text-neutral-600 border-2 border-dashed border-neutral-800 rounded-xl font-bold tracking-widest text-xs">
                      SOLD OUT
                    </div>
                  )}
                </div>
              </div>

              {/* ── 底部操作列 ── */}
              <div className="flex gap-3 w-full pt-1">
                <button
                  onClick={handleReroll}
                  disabled={!canReroll}
                  className={`flex-1 py-3 rounded-xl font-black border-2 transition-all text-xs touch-manipulation ${
                    hasGuestPass
                      ? 'border-green-500 text-green-400 active:bg-green-500/10'
                      : canReroll
                        ? 'border-blue-500 text-blue-400 active:bg-blue-500/10'
                        : 'border-neutral-700 text-neutral-600 cursor-not-allowed'
                  }`}
                >
                  🎲 重擲
                  {hasGuestPass
                    ? <span className="ml-1 text-green-400 text-[10px]">🎫 FREE</span>
                    : <span className="ml-1 text-[10px]">💰 {rerollCost}</span>
                  }
                </button>

                {/* Ready / 下一波按鈕 */}
                {isReadyMode ? (
                  isReady ? (
                    <button
                      disabled
                      className="flex-1 py-3 rounded-xl font-black bg-neutral-800 text-neutral-500 tracking-widest text-xs cursor-not-allowed"
                    >
                      等待隊友 ⏳
                    </button>
                  ) : (
                    <button
                      onClick={onNextWave}
                      className="flex-1 py-3 rounded-xl font-black bg-green-500 text-black active:bg-green-400 transition-all tracking-widest shadow-[0_0_20px_rgba(34,197,94,0.3)] touch-manipulation text-xs"
                    >
                      準備好了 ✓
                    </button>
                  )
                ) : (
                  <button
                    onClick={onNextWave}
                    className="flex-1 py-3 rounded-xl font-black bg-white text-black active:bg-neutral-200 transition-all tracking-widest shadow-[0_0_20px_rgba(255,255,255,0.15)] touch-manipulation text-xs"
                  >
                    下一波 ⚔️
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── CustomFooter 插槽（雙人模式注入角色預覽 + 準備按鈕）── */}
        {customFooter && (
          <div className="flex-shrink-0 w-full" style={{ borderTop: '1px solid #ffffff0d', background: '#060a10' }}>
            {customFooter}
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL — 合成確認                                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {mergePending && (() => {
        const w = player.weapons.find(x => x.id === mergePending.keepId);
        if (!w) return null;
        const nextLv = w.level + 1;
        return (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 touch-manipulation" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="bg-neutral-900 border-2 border-yellow-500 rounded-t-3xl sm:rounded-2xl p-5 text-center w-full sm:max-w-sm sm:mx-4 shadow-[0_0_40px_rgba(234,179,8,0.3)]">
              <h3 className="text-lg font-black mb-3 tracking-wide">⬆️ 合成確認</h3>
              <div className="flex items-center justify-center gap-3 mb-3">
                  <WeaponPreviewCanvas type={w.type} level={w.level} branch={w.branch} bufW={402} bufH={240} />
                <div className="text-2xl text-yellow-400 font-black">→</div>
                <div className="rounded-xl overflow-hidden border-2 w-24 relative" style={{ borderColor: weaponColor(nextLv) }}>
                  <WeaponPreviewCanvas type={w.type} level={nextLv} branch={w.branch} bufW={402} bufH={240} />
                  <div className="absolute bottom-0 inset-x-0 bg-yellow-500/80 text-black text-[9px] text-center font-black py-0.5">
                    Lv.{nextLv}{w.branch ?? ''}
                  </div>
                </div>
              </div>
              <div className="flex justify-center gap-2 mb-3">
                <StarRating level={w.level} branch={w.branch} />
                <span className="text-neutral-500 text-xs self-center">→</span>
                <StarRating level={nextLv} branch={w.branch} />
              </div>
              <p className="text-neutral-400 mb-4 leading-relaxed text-sm">
                兩把 Lv.{w.level} {w.type === 'sword' ? '劍' : '槍'}{w.branch ?? ''} 合成<br />
                升級至 <span className="text-yellow-400 font-black">Lv.{nextLv}</span>
                {nextLv === 5 && w.branch === null && (
                  <span className="text-purple-400"> → 將選擇流派</span>
                )}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setMergePending(null)} className="flex-1 py-3 rounded-xl border-2 border-neutral-600 text-neutral-400 active:bg-neutral-800 font-bold transition-colors touch-manipulation">
                  取消
                </button>
                <button onClick={handleConfirmMerge} className="flex-1 py-3 rounded-xl bg-yellow-500 text-black active:bg-yellow-400 font-black transition-colors touch-manipulation">
                  合成 ⬆
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* MODAL — 流派選擇                                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {branchPending && (() => {
        const w = player.weapons.find(x => x.id === branchPending.weaponId);
        if (!w) return null;
        const names = BRANCH_DISPLAY[w.type] ?? { A: 'A 流派', B: 'B 流派' };
        return (
          <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/80 touch-manipulation" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
            <div className="bg-neutral-900 border-2 border-purple-500 rounded-t-3xl sm:rounded-2xl p-6 text-center w-full sm:max-w-md sm:mx-4 shadow-[0_0_40px_rgba(168,85,247,0.3)]">
              <div className="text-4xl mb-3">🌿</div>
              <h3 className="text-2xl font-black mb-1 tracking-wide">選擇流派</h3>
              <p className="text-neutral-400 mb-5 text-sm">
                {w.type === 'sword' ? '劍' : '槍'} 進化至 Lv.5 — 選擇你的道路
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleSelectBranch('A')}
                  className="py-5 rounded-xl border-2 border-blue-500 bg-blue-900/20 active:bg-blue-900/50 font-black transition-all touch-manipulation"
                >
                  <div className="text-3xl mb-1">A</div>
                  <div className="text-blue-400 text-sm">{names.A}</div>
                </button>
                <button
                  onClick={() => handleSelectBranch('B')}
                  className="py-5 rounded-xl border-2 border-red-500 bg-red-900/20 active:bg-red-900/50 font-black transition-all touch-manipulation"
                >
                  <div className="text-3xl mb-1">B</div>
                  <div className="text-red-400 text-sm">{names.B}</div>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};
