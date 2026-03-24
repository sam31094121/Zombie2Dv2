// ── ShopPanel.tsx ─────────────────────────────────────────────────────────────
// 競技場模式商店 — Phase 1（素質選擇）+ Phase 2（武器 & 配件）
// 手機版全面最佳化
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { Player, WeaponSlot, OwnedItem } from '../../game/Player';
import { audioManager } from '../../game/AudioManager';
import { STAT_REGISTRY } from '../../game/items/StatDefinitions';
import { ITEM_REGISTRY } from '../../game/items/ItemDefinitions';

// ── 商店卡牌型別 ──────────────────────────────────────────────────────────────

interface WeaponCard {
  id: string;
  cardType: 'weapon';
  type: 'sword' | 'gun';
  level: number;
  branch: 'A' | 'B' | null;
  cost: number;
}

interface ItemCard {
  id: string;
  cardType: 'item';
  defId: string;
}

type ShopCard = WeaponCard | ItemCard;

// ── 工具函式 ──────────────────────────────────────────────────────────────────

function getWeaponLevel(wave: number): number {
  const r = Math.random();
  if (wave <= 3) {
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

function weaponCost(level: number): number {
  return Math.floor(15 * Math.pow(2, level - 1));
}

function drawCards(wave: number): ShopCard[] {
  const weaponCount = Math.random() < 0.4 ? 1 : (Math.random() < 0.6 ? 2 : 3);
  const itemCount = 4 - weaponCount;
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

// 武器等級顏色
const RARITY_COLOR = ['#9ca3af', '#4ade80', '#60a5fa', '#c084fc', '#f59e0b'];
const weaponColor = (level: number) => RARITY_COLOR[Math.min(level - 1, 4)];

// 流派顯示名稱
const BRANCH_DISPLAY: Record<string, Record<'A' | 'B', string>> = {
  sword: { A: '旋風流', B: '閃光流' },
  gun:   { A: '燃燒流', B: '狙擊流' },
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface ShopPanelProps {
  player: Player;
  wave: number;
  onNextWave: () => void;
}

// ── 主元件 ────────────────────────────────────────────────────────────────────

export const ShopPanel: React.FC<ShopPanelProps> = ({ player, wave, onNextWave }) => {
  const [phase, setPhase] = useState<1 | 2>(player.arenaStatPoints > 0 ? 1 : 2);
  const [shopCards, setShopCards] = useState<ShopCard[]>(() => drawCards(wave));
  const [rerollCost, setRerollCost] = useState(10);
  const [mergePending, setMergePending] = useState<{ keepId: string; removeId: string } | null>(null);
  const [branchPending, setBranchPending] = useState<{ weaponId: string } | null>(null);
  const [, forceUpdate] = useState(0);
  const rerender = () => forceUpdate(n => n + 1);

  // ── Phase 1：選擇素質 ──────────────────────────────────────────────────────

  const handlePickStat = (id: string) => {
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
    setShopCards(prev => prev.filter(c => c.id !== card.id));

    const match = player.weapons.find(w =>
      w.id !== newSlot.id && w.type === newSlot.type &&
      w.level === newSlot.level && w.branch === newSlot.branch
    );
    if (match) setMergePending({ keepId: match.id, removeId: newSlot.id });
    else rerender();
  };

  // ── Phase 2：購買配件 ──────────────────────────────────────────────────────

  const handleBuyItem = (card: ItemCard) => {
    const def = ITEM_REGISTRY[card.defId];
    if (!def || player.materials < def.cost) return;
    player.materials -= def.cost;
    if (def.type === 'permanent') def.apply(player);
    player.ownedItems.push({ id: Math.random().toString(36).substr(2, 9), defId: card.defId });
    audioManager.playPickup();
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
    setShopCards(drawCards(wave));
    rerender();
  };

  // ── 武器欄點擊 ────────────────────────────────────────────────────────────

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
    <div
      className="absolute inset-0 z-50 bg-[#050508] flex flex-col items-center overflow-hidden text-neutral-200"
      style={{
        backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      {/* ── Sticky Header ── */}
      <div className="flex-shrink-0 w-full max-w-2xl px-3 pt-3 pb-2 sm:px-6 sm:pt-4">
        {/* 資源列 */}
        <div className="flex items-center gap-3 mb-2 bg-neutral-900/80 px-4 py-2 rounded-2xl border border-neutral-700/50 w-full">
          <div className="text-base font-black sm:text-xl">💰 <span className="text-yellow-400">{Math.floor(player.materials)}</span></div>
          <div className="text-xs text-neutral-400 font-bold">HP <span className="text-green-400">{Math.floor(player.hp)}/{player.maxHp}</span></div>
          <div className="text-xs text-neutral-400 font-bold">LV <span className="text-blue-400">{player.level}</span></div>
          <div className="ml-auto text-yellow-500 font-black text-xs sm:text-base tracking-widest">WAVE {wave} ✓</div>
        </div>

        {/* Phase 切換 Tab */}
        <div className="flex gap-2 w-full">
          <button
            onClick={() => setPhase(1)}
            className={`flex-1 py-2.5 rounded-xl font-black tracking-wide text-xs sm:text-sm transition-all touch-manipulation ${phase === 1 ? 'bg-blue-600 text-white' : 'bg-neutral-800 text-neutral-500 active:bg-neutral-700'}`}
          >
            PHASE 1 素質
            {player.arenaStatPoints > 0 && (
              <span className="ml-1.5 bg-yellow-500 text-black text-xs px-1.5 py-0.5 rounded-full">{player.arenaStatPoints}</span>
            )}
          </button>
          <button
            onClick={() => setPhase(2)}
            className={`flex-1 py-2.5 rounded-xl font-black tracking-wide text-xs sm:text-sm transition-all touch-manipulation ${phase === 2 ? 'bg-purple-600 text-white' : 'bg-neutral-800 text-neutral-500 active:bg-neutral-700'}`}
          >
            PHASE 2 武器
          </button>
        </div>
      </div>

      {/* ── 捲動主體 ── */}
      <div className="flex-1 w-full max-w-2xl overflow-y-auto overscroll-contain px-3 pb-4 sm:px-6" style={{ WebkitOverflowScrolling: 'touch' }}>

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* PHASE 1 — 素質選擇                                                  */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {phase === 1 && (
          <div className="w-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-black text-blue-400 tracking-widest">
                可用點數：<span className="text-yellow-400">{player.arenaStatPoints}</span>
              </h3>
              {player.arenaStatPoints === 0 && (
                <span className="text-neutral-500 text-xs">點數已用完</span>
              )}
            </div>

            {/* 手機 2 列 / 桌面 3 列 */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {Object.values(STAT_REGISTRY).map(stat => {
                const curLv = player.statLevels[stat.id] ?? 0;
                const isMaxed = stat.maxLevel !== -1 && curLv >= stat.maxLevel;
                const disabled = isMaxed || player.arenaStatPoints <= 0;
                const barCount = stat.maxLevel > 0 ? Math.min(stat.maxLevel, 10) : 10;
                const filledBars = Math.min(curLv, barCount);
                return (
                  <button
                    key={stat.id}
                    onClick={() => handlePickStat(stat.id)}
                    disabled={disabled}
                    className={`p-3 sm:p-4 rounded-xl border-2 text-left transition-all touch-manipulation min-h-[80px] ${
                      isMaxed
                        ? 'border-yellow-600/50 bg-yellow-900/20 opacity-60 cursor-not-allowed'
                        : disabled
                          ? 'border-neutral-700 bg-neutral-900/50 opacity-40 cursor-not-allowed'
                          : 'border-blue-500/50 bg-blue-900/20 active:bg-blue-900/50 cursor-pointer'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-lg">{stat.icon}</span>
                      <span className="font-black text-xs sm:text-sm">{stat.name}</span>
                      {isMaxed && <span className="ml-auto text-yellow-400 text-[10px] font-bold">MAX</span>}
                    </div>
                    <p className="text-[10px] sm:text-xs text-neutral-400 mb-2 leading-snug">{stat.description}</p>
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
              className="mt-4 w-full py-3 rounded-xl bg-purple-700/60 hover:bg-purple-700/80 active:bg-purple-800 border border-purple-500/50 font-black text-sm tracking-widest transition-all touch-manipulation"
            >
              前往武器商店 →
            </button>
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════════ */}
        {/* PHASE 2 — 武器 & 配件商店                                            */}
        {/* ════════════════════════════════════════════════════════════════════ */}
        {phase === 2 && (
          <>
            {/* ── 武器欄（6格 → 手機 3+3, 桌面 6） ── */}
            <div className="w-full mb-3">
              <h3 className="text-xs font-bold text-neutral-500 tracking-widest uppercase mb-2">
                武器欄 ({player.weapons.length}/6)
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {Array.from({ length: 6 }).map((_, i) => {
                  const w = player.weapons[i];
                  if (!w) return (
                    <div key={`empty-${i}`} className="h-16 sm:h-20 rounded-xl border-2 border-dashed border-neutral-800 flex items-center justify-center text-neutral-700 text-[10px] font-bold">
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
                      className="h-16 sm:h-20 rounded-xl border-2 flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-all relative overflow-hidden touch-manipulation"
                      style={{ borderColor: col, boxShadow: `0 0 8px ${col}33` }}
                    >
                      <span className="text-xl sm:text-2xl">{w.type === 'sword' ? '🗡️' : '🔫'}</span>
                      <span className="text-[10px] sm:text-xs font-black" style={{ color: col }}>
                        Lv.{w.level}{w.branch ?? ''}
                      </span>
                      {hasMatch
                        ? <div className="absolute bottom-0 inset-x-0 bg-yellow-500 text-black text-[9px] text-center font-black py-0.5 animate-pulse">⬆ 合成</div>
                        : <div className="absolute bottom-0 inset-x-0 bg-red-800/90 text-white text-[9px] text-center font-bold py-0.5 opacity-0 group-hover:opacity-100 transition-opacity">賣出</div>
                      }
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── 配件背包 ── */}
            {player.ownedItems.length > 0 && (
              <div className="w-full mb-3">
                <h3 className="text-xs font-bold text-neutral-500 tracking-widest uppercase mb-2">配件背包</h3>
                <div className="flex flex-wrap gap-2">
                  {player.ownedItems.map(item => {
                    const def = ITEM_REGISTRY[item.defId];
                    if (!def) return null;
                    return (
                      <div key={item.id} className="bg-neutral-800 border border-neutral-600 rounded-xl px-2.5 py-1.5 flex items-center gap-1.5 text-xs">
                        <span>{def.icon}</span>
                        <span className="font-bold">{def.name}</span>
                        {item.defId === 'guest_pass' && (
                          <span className="text-[10px] text-green-400">→ 重擲免費</span>
                        )}
                        <button
                          onClick={() => handleSellItem(item)}
                          className="ml-1 text-[10px] bg-red-900/60 active:bg-red-800 border border-red-700 px-1.5 py-0.5 rounded-lg font-bold transition-colors touch-manipulation"
                        >
                          賣 💰{Math.floor(def.cost * 0.5)}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── 商店卡牌（手機 2 列 / 桌面 4 列） ── */}
            <div className="w-full mb-4">
              <h3 className="text-xs font-bold text-neutral-500 tracking-widest uppercase mb-2">補給站</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                {shopCards.map(card => {
                  if (card.cardType === 'weapon') {
                    const col = weaponColor(card.level);
                    const canBuy = player.materials >= card.cost && player.weapons.length < 6;
                    const branchName = card.branch ? ` — ${BRANCH_DISPLAY[card.type]?.[card.branch] ?? card.branch}` : '';
                    return (
                      <div key={card.id} className="bg-neutral-800 border-2 rounded-2xl p-3 sm:p-4 flex flex-col items-center text-center" style={{ borderColor: col }}>
                        <div className="text-[10px] font-bold text-neutral-400 uppercase mb-1">WEAPON</div>
                        <span className="text-3xl sm:text-4xl mb-1">{card.type === 'sword' ? '🗡️' : '🔫'}</span>
                        <div className="font-black text-xs sm:text-sm mb-0.5" style={{ color: col }}>
                          Lv.{card.level}{card.branch ?? ''}
                        </div>
                        {branchName && <div className="text-[10px] text-neutral-400 mb-1">{branchName}</div>}
                        <button
                          onClick={() => handleBuyWeapon(card)}
                          disabled={!canBuy}
                          className={`mt-auto w-full py-2 rounded-xl font-black text-xs sm:text-sm transition-all touch-manipulation ${canBuy ? 'bg-yellow-500 active:bg-yellow-400 text-black' : 'bg-neutral-700 text-neutral-500 cursor-not-allowed'}`}
                        >
                          {player.weapons.length >= 6 ? '欄位滿' : `💰 ${card.cost}`}
                        </button>
                      </div>
                    );
                  } else {
                    const def = ITEM_REGISTRY[card.defId];
                    if (!def) return null;
                    const canBuy = player.materials >= def.cost;
                    return (
                      <div key={card.id} className={`bg-neutral-800 border-2 rounded-2xl p-3 sm:p-4 flex flex-col items-center text-center ${def.type === 'consumable' ? 'border-green-700/60' : 'border-purple-700/60'}`}>
                        <div className={`text-[10px] font-bold uppercase mb-1 ${def.type === 'consumable' ? 'text-green-500' : 'text-purple-400'}`}>
                          {def.type === 'consumable' ? '一次性' : '永久'}
                        </div>
                        <span className="text-3xl sm:text-4xl mb-1">{def.icon}</span>
                        <div className="font-black text-xs sm:text-sm mb-1">{def.name}</div>
                        <p className="text-[10px] sm:text-xs text-neutral-400 mb-2 flex-1 leading-snug">{def.description}</p>
                        <button
                          onClick={() => handleBuyItem(card)}
                          disabled={!canBuy}
                          className={`mt-auto w-full py-2 rounded-xl font-black text-xs sm:text-sm transition-all touch-manipulation ${canBuy ? 'bg-yellow-500 active:bg-yellow-400 text-black' : 'bg-neutral-700 text-neutral-500 cursor-not-allowed'}`}
                        >
                          💰 {def.cost}
                        </button>
                      </div>
                    );
                  }
                })}
                {shopCards.length === 0 && (
                  <div className="col-span-2 sm:col-span-4 py-10 text-center text-neutral-500 border-2 border-dashed border-neutral-700 rounded-2xl font-bold tracking-widest">
                    SOLD OUT
                  </div>
                )}
              </div>
            </div>

            {/* ── 底部操作列（手機固定在底部前方捲動區） ── */}
            <div className="flex gap-3 w-full pt-1 pb-safe">
              <button
                onClick={handleReroll}
                disabled={!canReroll}
                className={`flex-1 py-3.5 rounded-xl font-black border-2 transition-all text-xs sm:text-sm touch-manipulation ${
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
              <button
                onClick={onNextWave}
                className="flex-1 py-3.5 rounded-xl font-black bg-white text-black active:bg-neutral-200 transition-all tracking-widest shadow-[0_0_20px_rgba(255,255,255,0.15)] touch-manipulation text-xs sm:text-sm"
              >
                下一波 ⚔️
              </button>
            </div>
          </>
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
            <div className="bg-neutral-900 border-2 border-yellow-500 rounded-t-3xl sm:rounded-2xl p-6 text-center w-full sm:max-w-sm sm:mx-4 shadow-[0_0_40px_rgba(234,179,8,0.3)]">
              <div className="text-4xl mb-3">⬆️</div>
              <h3 className="text-xl font-black mb-2 tracking-wide">合成確認</h3>
              <p className="text-neutral-400 mb-6 leading-relaxed text-sm">
                兩把 Lv.{w.level} {w.type === 'sword' ? '劍' : '槍'}{w.branch ?? ''} 合成<br />
                升級至 <span className="text-yellow-400 font-black">Lv.{nextLv}</span>
                {nextLv === 5 && w.branch === null && (
                  <span className="text-purple-400"> → 將選擇流派</span>
                )}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setMergePending(null)} className="flex-1 py-3.5 rounded-xl border-2 border-neutral-600 text-neutral-400 active:bg-neutral-800 font-bold transition-colors touch-manipulation">
                  取消
                </button>
                <button onClick={handleConfirmMerge} className="flex-1 py-3.5 rounded-xl bg-yellow-500 text-black active:bg-yellow-400 font-black transition-colors touch-manipulation">
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
    </div>
  );
};
