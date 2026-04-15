// ── ShopPanel.tsx ─────────────────────────────────────────────────────────────
// 競技場模式商店模組 — 支援單人模式與雙人模式（透過 Props 擴充）
// Phase 1: 素質選擇 / Phase 2: 武器 & 配件商店
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
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

const shellStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(18, 24, 38, 0.94) 0%, rgba(9, 13, 24, 0.98) 100%)',
  border: '1px solid rgba(148, 163, 184, 0.15)',
  boxShadow: '0 24px 70px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
  backdropFilter: 'blur(14px)',
};

const cardStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(24, 31, 48, 0.94) 0%, rgba(10, 14, 24, 0.98) 100%)',
  border: '1px solid rgba(148, 163, 184, 0.12)',
  boxShadow: '0 18px 40px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
};

const mutedPanelStyle: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(16, 23, 36, 0.84) 0%, rgba(8, 12, 20, 0.92) 100%)',
  border: '1px solid rgba(148, 163, 184, 0.11)',
  boxShadow: '0 14px 32px rgba(0, 0, 0, 0.2)',
};

const chipStyle: React.CSSProperties = {
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
};

const formatMaterials = (value: number) =>
  value >= 999999 ? 'MAX' : Math.floor(value).toLocaleString('en-US');

const getWeaponKindLabel = (type: 'sword' | 'gun') => (type === 'sword' ? '刃械' : '火器');
const getWeaponName = (type: 'sword' | 'gun') => (type === 'sword' ? '近戰框體' : '彈道框體');
const getItemTypeLabel = (type: string) => (type === 'consumable' ? '一次性' : '常駐');

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

  useEffect(() => {
    if (phase === 1 && effectiveStatPoints <= 0) {
      setPhase(2);
    }
  }, [effectiveStatPoints, phase]);

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
          0% { transform: translate(var(--coin-dx, 0px), 10px) scale(0.85); opacity: 0; }
          20% { opacity: 1; }
          100% { transform: translate(var(--coin-dx, 0px), -46px) scale(0.45); opacity: 0; }
        }
        @keyframes panelRise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes emberPulse {
          0%, 100% { box-shadow: 0 0 0 rgba(242, 184, 64, 0); }
          50% { box-shadow: 0 0 28px rgba(242, 184, 64, 0.16); }
        }
        .coin-float { animation: coinFloat 0.75s ease-out forwards; }
        .shop-rise { animation: panelRise 0.35s ease-out both; }
        .shop-card-hover {
          transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        .shop-card-hover:hover {
          transform: translateY(-2px);
          border-color: rgba(245, 181, 69, 0.28);
          box-shadow: 0 24px 44px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(245, 181, 69, 0.08);
        }
        .shop-ember {
          animation: emberPulse 2.8s ease-in-out infinite;
        }
      `}</style>

      {/* ── 最外層容器 ──
          雙人模式下不撐滿高度（由外部 ManagementView 控制佈局）
          單人模式下 h-full 填滿整個 overlay */}
      <div
        className="relative flex h-screen w-full flex-col overflow-hidden text-stone-100"
        style={{
          background: 'radial-gradient(circle at 14% 12%, rgba(198, 139, 45, 0.16), transparent 24%), radial-gradient(circle at 84% 10%, rgba(63, 114, 175, 0.2), transparent 28%), linear-gradient(180deg, #0a0d14 0%, #05070b 100%)',
          paddingTop: isReadyMode || customFooter ? '0' : 'env(safe-area-inset-top, 0px)',
          paddingBottom: isReadyMode || customFooter ? '0' : 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-35"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
            backgroundSize: '72px 72px',
            maskImage: 'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.25) 100%)',
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-48"
          style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.04) 0%, transparent 100%)' }}
        />
        {/* ── 雙人模式玩家身份橫幅（isReadyMode 情境下保留）── */}
        {isReadyMode && (
          <div
            className="relative z-10 flex-shrink-0 py-2 text-center text-[11px] font-black uppercase tracking-[0.42em]"
            style={{
              background: `linear-gradient(90deg, ${player.color}18 0%, rgba(255,255,255,0.02) 50%, ${player.color}18 100%)`,
              borderBottom: `1px solid ${player.color}40`,
              color: player.color,
            }}
          >
            Player {player.id} Loadout Desk
          </div>
        )}

        {/* ── Sticky Header ── */}
        <div className="relative z-10 flex-shrink-0 w-full px-3 pt-3 sm:px-6 sm:pt-5">
          {/* 資源列（含金幣噴射動畫容器） */}
          <div className="relative mx-auto mb-3 flex w-full max-w-[1120px] flex-wrap items-end gap-3 overflow-hidden rounded-[30px] px-4 py-5 sm:px-6" style={shellStyle}>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-black uppercase tracking-[0.42em] text-amber-300/80">
                Field Arsenal
              </div>
              <div
                className="mt-2 text-[30px] font-black leading-none text-white sm:text-[40px]"
                style={{ fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif" }}
              >
                波次後勤補給
              </div>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                先把核心數值調整到位，再把手上的素材換成下一波真正有感的火力。
              </p>
            </div>
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
            <div className="min-w-[124px] rounded-[22px] px-4 py-3 shop-ember" style={cardStyle}>
              <div className="text-[11px] font-black uppercase tracking-[0.32em] text-amber-200/65">素材</div>
              <div className="mt-2 text-[28px] font-black text-amber-300">{formatMaterials(player.materials)}</div>
              <div className="mt-1 text-xs text-slate-400">採購與重抽共用</div>
            </div>
            <div className="min-w-[110px] rounded-[22px] px-4 py-3" style={cardStyle}>
              <div className="text-[11px] font-black uppercase tracking-[0.32em] text-emerald-200/65">HP</div>
              <div className="mt-2 text-[28px] font-black text-emerald-300">{Math.floor(player.hp)}</div>
              <div className="mt-1 text-xs text-slate-400">目前狀態</div>
            </div>
            <div className="min-w-[110px] rounded-[22px] px-4 py-3" style={cardStyle}>
              <div className="text-[11px] font-black uppercase tracking-[0.32em] text-sky-200/65">角色等級</div>
              <div className="mt-2 text-[28px] font-black text-sky-300">{player.level}</div>
              <div className="mt-1 text-xs text-slate-400">本輪基礎成長</div>
            </div>
            <div className="min-w-[110px] rounded-[22px] px-4 py-3" style={cardStyle}>
              <div className="text-[11px] font-black uppercase tracking-[0.32em] text-stone-300/65">Wave</div>
              <div className="mt-2 text-[28px] font-black text-stone-100">{wave}</div>
              <div className="mt-1 text-xs text-slate-400">
                {effectiveStatPoints > 0 ? `${effectiveStatPoints} 點待分配` : '可直接進採購'}
              </div>
            </div>
          </div>

          {/* Phase 切換 Tab */}
          <div className="mx-auto grid w-full max-w-[1120px] grid-cols-1 gap-3 lg:grid-cols-2">
            <button
              onClick={() => setPhase(1)}
              className={`rounded-[24px] px-4 py-4 text-left font-black transition-all duration-200 touch-manipulation ${phase === 1 ? 'text-white shadow-[0_18px_42px_rgba(0,0,0,0.24)]' : 'text-slate-400'}`}
              style={phase === 1
                ? {
                    ...mutedPanelStyle,
                    border: '1px solid rgba(96, 165, 250, 0.44)',
                    background: 'linear-gradient(180deg, rgba(16, 35, 63, 0.96) 0%, rgba(10, 17, 29, 0.98) 100%)',
                  }
                : mutedPanelStyle}
            >
              PHASE 1 素質
              {effectiveStatPoints > 0 && (
                <span className="ml-2 rounded-full border border-yellow-400/30 bg-yellow-400/15 px-2 py-1 text-[10px] text-yellow-200">{effectiveStatPoints}</span>
              )}
            </button>
            <button
              onClick={() => setPhase(2)}
              className={`rounded-[24px] px-4 py-4 text-left font-black transition-all duration-200 touch-manipulation ${phase === 2 ? 'text-white shadow-[0_18px_42px_rgba(0,0,0,0.24)]' : 'text-slate-400'}`}
              style={phase === 2
                ? {
                    ...mutedPanelStyle,
                    border: '1px solid rgba(245, 181, 69, 0.42)',
                    background: 'linear-gradient(180deg, rgba(49, 31, 12, 0.96) 0%, rgba(14, 16, 24, 0.98) 100%)',
                  }
                : mutedPanelStyle}
            >
              PHASE 2 武器
            </button>
          </div>
        </div>

        {/* ── 捲動主體 ── */}
        <div className="relative z-10 mx-auto flex-1 w-full max-w-[1120px] overflow-y-auto overscroll-contain px-3 pb-4 pt-3 sm:px-6 sm:pb-6" style={{ WebkitOverflowScrolling: 'touch' }}>

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* PHASE 1 — 素質選擇                                                */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {phase === 1 && (
            <div className="shop-rise w-full rounded-[30px] p-4 sm:p-6" style={shellStyle}>
              <div className="mb-6">
                <div className="text-[11px] font-black uppercase tracking-[0.38em] text-sky-200/70">
                  Attribute Calibration
                </div>
                <h3
                  className="mt-2 text-[28px] font-black leading-tight text-white sm:text-[34px]"
                  style={{ fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif" }}
                >
                  點數升級
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                  這區現在改成比較像戰術卡片。每一張都要能一眼看懂用途、等級和升級價值。
                </p>
              </div>
              <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <h3 className="text-xs font-black text-blue-400 tracking-widest">
                  可用點數：<span className="text-yellow-400">{effectiveStatPoints}</span>
                </h3>
                {effectiveStatPoints === 0 && (
                  <span className="text-neutral-500 text-[10px]">點數已用完</span>
                )}
              </div>

              {/* 手機 2 列 / 桌面 3 列 */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
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
                      className={`shop-card-hover min-h-[220px] rounded-[26px] p-4 text-left transition-all touch-manipulation ${
                        isMaxed
                          ? 'border-yellow-600/50 bg-yellow-900/20 opacity-70 cursor-not-allowed'
                          : disabled
                            ? 'border-slate-700 bg-slate-950/70 opacity-60 cursor-not-allowed'
                            : 'border-blue-500/50 bg-blue-900/20 active:bg-blue-900/50 cursor-pointer'
                      }`}
                      style={cardStyle}
                    >
                      <div className="mb-3 flex items-center gap-3">
                        <span className="flex h-14 w-14 items-center justify-center rounded-[18px] border border-white/10 bg-white/5 text-3xl">{stat.icon}</span>
                        <span className="text-lg font-black text-white">{stat.name}</span>
                        {isMaxed && <span className="ml-auto rounded-full border border-yellow-400/25 bg-yellow-400/15 px-2.5 py-1 text-[10px] font-black text-yellow-200">MAX</span>}
                      </div>
                      <p className="mb-4 text-sm leading-6 text-slate-300">{stat.description}</p>
                      <div className="mt-auto flex items-center gap-1.5">
                        {Array.from({ length: barCount }).map((_, i) => (
                          <div key={i} className={`h-2 flex-1 rounded-full ${i < filledBars ? 'bg-sky-300' : 'bg-slate-700/80'}`} />
                        ))}
                        <span className="ml-2 shrink-0 text-[11px] text-slate-400">
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
                className="mt-6 w-full rounded-[22px] border border-amber-400/20 px-5 py-4 text-sm font-black tracking-[0.2em] text-black transition-all touch-manipulation"
                style={{
                  background: 'linear-gradient(135deg, #f5b545 0%, #ffdf84 100%)',
                  boxShadow: '0 12px 30px rgba(245, 181, 69, 0.2)',
                }}
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
              <div className="shop-rise w-full rounded-[30px] p-4 sm:p-6" style={shellStyle}>
                <div className="text-[11px] font-black uppercase tracking-[0.38em] text-amber-200/70">
                  Supply Table
                </div>
                <h3
                  className="mt-2 text-[28px] font-black leading-tight text-white sm:text-[34px]"
                  style={{ fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif" }}
                >
                  補給採購
                </h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300 sm:text-[15px]">
                  這一版把商店做成比較像補給牌桌。裝備、道具、行動按鈕現在有更清楚的節奏與層級。
                </p>
              </div>
              {/* ── 武器欄（hideInventory=true 時隱藏，雙人模式用 CharacterPreview 代替）── */}
              {!hideInventory && (
                <div className="shop-rise w-full rounded-[30px] p-4 sm:p-6" style={shellStyle}>
                  <h3 className="mb-4 text-[11px] font-black uppercase tracking-[0.38em] text-stone-300/70">
                    武器欄 ({player.weapons.length}/6)
                  </h3>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 6 }).map((_, i) => {
                      const w = player.weapons[i];
                      if (!w) return (
                        <div key={`empty-${i}`} className="flex min-h-[220px] items-center justify-center rounded-[24px] border border-dashed border-slate-700/70 text-sm font-black text-slate-500" style={mutedPanelStyle}>
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
                          className="shop-card-hover relative flex min-h-[220px] flex-col overflow-hidden rounded-[24px] touch-manipulation"
                          style={{ ...cardStyle, borderColor: col + '44', boxShadow: `0 18px 42px rgba(0,0,0,0.22), 0 0 0 1px ${col}10` }}
                        >
                          <WeaponPreviewCanvas type={w.type} level={w.level} branch={w.branch} bufW={402} bufH={240} />
                          <div className="flex flex-col items-center gap-1 px-3 pb-3 pt-2">
                            <span className="text-base font-black" style={{ color: col }}>Lv.{w.level}{w.branch ?? ''}</span>
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
                <div className="shop-rise w-full rounded-[30px] p-4 sm:p-6" style={shellStyle}>
                  <h3 className="text-[10px] font-bold text-neutral-500 tracking-widest uppercase mb-1.5">配件背包</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {player.ownedItems.map(item => {
                      const def = ITEM_REGISTRY[item.defId];
                      if (!def) return null;
                      return (
                        <div key={item.id} className="flex items-center gap-3 rounded-[24px] px-4 py-4" style={cardStyle}>
                          <span>{def.icon}</span>
                          <span className="text-base font-black text-white">{def.name}</span>
                          {item.defId === 'guest_pass' && (
                            <span className="text-[9px] text-green-400">→ 重擲免費</span>
                          )}
                          <button
                            onClick={() => handleSellItem(item)}
                            className="ml-auto rounded-[14px] border border-red-500/20 bg-red-900/30 px-3 py-2 text-xs font-black text-red-100 transition-colors touch-manipulation"
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
              <div className="shop-rise w-full rounded-[30px] p-4 sm:p-6" style={shellStyle}>
                <h3 className="text-[10px] font-bold text-neutral-500 tracking-widest uppercase mb-1.5">補給站</h3>
                <div className={`grid gap-4 ${cardCount > 5 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5'}`}>
                  {shopCards.map(card => {
                    if (card.cardType === 'weapon') {
                      const col = weaponColor(card.level);
                      const canBuy = player.materials >= card.cost && player.weapons.length < 6;
                      return (
                        <div key={card.id} className="shop-card-hover flex flex-col overflow-hidden rounded-[24px]" style={{ ...cardStyle, borderColor: col + '33' }}>
                          <WeaponPreviewCanvas type={card.type} level={card.level} branch={card.branch} bufW={402} bufH={240} />
                          <div className="flex flex-1 flex-col items-center gap-1 px-3 pb-4 pt-3">
                            <div className="text-lg font-black" style={{ color: col }}>Lv.{card.level}{card.branch ?? ''}</div>
                            <StarRating level={card.level} branch={card.branch} size="xs" />
                            <button
                              onClick={() => handleBuyWeapon(card)}
                              disabled={!canBuy}
                              className={`mt-3 w-full rounded-[16px] px-4 py-3 text-sm font-black transition-all touch-manipulation ${canBuy ? 'bg-amber-400 text-black shadow-[0_12px_30px_rgba(245,181,69,0.2)] active:bg-amber-300' : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'}`}
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
                        <div key={card.id} className={`shop-card-hover flex flex-col items-center rounded-[24px] p-4 text-center ${def.type === 'consumable' ? 'border-green-900/40' : 'border-purple-900/40'}`} style={cardStyle}>
                          <span className="mt-2 text-4xl">{def.icon}</span>
                          <div className="mt-3 text-base font-black text-white leading-tight">{def.name}</div>
                          <p className="mb-3 mt-3 flex-1 text-sm leading-6 text-slate-300">{def.description}</p>
                          <button
                            onClick={() => handleBuyItem(card)}
                            disabled={!canBuy}
                            className={`mt-auto w-full rounded-[16px] px-4 py-3 text-sm font-black transition-all touch-manipulation ${canBuy ? 'bg-amber-400 text-black shadow-[0_12px_30px_rgba(245,181,69,0.2)] active:bg-amber-300' : 'bg-neutral-900 text-neutral-600 cursor-not-allowed'}`}
                          >
                            💰{def.cost}
                          </button>
                        </div>
                      );
                    }
                  })}
                  {shopCards.length === 0 && (
                    <div className="col-span-full rounded-[24px] border border-dashed border-slate-700/70 py-12 text-center text-slate-500 font-bold tracking-[0.28em] text-xs" style={mutedPanelStyle}>
                      SOLD OUT
                    </div>
                  )}
                </div>
              </div>

              {/* ── 底部操作列 ── */}
              <div className="mt-6 flex w-full flex-col gap-3 rounded-[26px] p-4 sm:flex-row" style={mutedPanelStyle}>
                <button
                  onClick={handleReroll}
                  disabled={!canReroll}
                  className={`flex-1 rounded-[18px] border px-5 py-4 font-black transition-all text-sm touch-manipulation ${
                    hasGuestPass
                      ? 'border-green-500/30 text-green-300 active:bg-green-500/10'
                      : canReroll
                        ? 'border-blue-500/30 text-blue-300 active:bg-blue-500/10'
                        : 'border-neutral-700 text-neutral-500 cursor-not-allowed'
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
                      className="flex-1 rounded-[18px] bg-neutral-800 px-5 py-4 font-black text-neutral-500 tracking-[0.2em] text-sm cursor-not-allowed"
                    >
                      等待隊友 ⏳
                    </button>
                  ) : (
                    <button
                      onClick={onNextWave}
                      className="flex-1 rounded-[18px] bg-green-400 px-5 py-4 font-black text-black active:bg-green-300 transition-all tracking-[0.2em] shadow-[0_12px_30px_rgba(34,197,94,0.2)] touch-manipulation text-sm"
                    >
                      準備好了 ✓
                    </button>
                  )
                ) : (
                  <button
                    onClick={onNextWave}
                    className="flex-1 rounded-[18px] bg-white px-5 py-4 font-black text-black active:bg-neutral-200 transition-all tracking-[0.2em] shadow-[0_12px_30px_rgba(255,255,255,0.12)] touch-manipulation text-sm"
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
          <div className="flex-shrink-0 w-full" style={{ borderTop: '1px solid rgba(255,255,255,0.08)', background: 'linear-gradient(180deg, rgba(10,12,18,0.94) 0%, rgba(6,7,11,0.98) 100%)', boxShadow: '0 -20px 40px rgba(0,0,0,0.22)' }}>
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
