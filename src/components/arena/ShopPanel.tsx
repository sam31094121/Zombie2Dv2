// ── ShopPanel.tsx — Pixel RPG Edition ────────────────────────────────────────
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { Player, WeaponSlot, OwnedItem } from '../../game/Player';
import { audioManager } from '../../game/AudioManager';
import { STAT_REGISTRY } from '../../game/items/StatDefinitions';
import { ITEM_REGISTRY } from '../../game/items/ItemDefinitions';
import { WeaponPreviewCanvas } from './WeaponPreviewCanvas';
import { StarRating } from './StarRating';
import {
  ARENA_BRANCH_MAX_LEVEL,
  canArenaWeaponMerge,
  formatArenaWeaponLevel,
  getArenaWeaponInvestedCost,
  getArenaWeaponMergePreviewLevel,
  getArenaWeaponSellPrice,
  weaponCost,
  willArenaWeaponBranchEvolve,
} from './arenaWeaponUtils';

// ── Re-exports ────────────────────────────────────────────────────────────────

export interface WeaponCard {
  id: string; cardType: 'weapon';
  type: 'sword' | 'gun'; level: number; branch: 'A' | 'B' | null; cost: number;
}
export interface ItemCard { id: string; cardType: 'item'; defId: string; }
export type ShopCard = WeaponCard | ItemCard;

export function getWeaponLevel(wave: number): number {
  const r = Math.random();
  if (wave === 1) return 1;
  if (wave <= 3) { if (r < 0.60) return 1; if (r < 0.90) return 2; return 3; }
  if (wave <= 6) { if (r < 0.20) return 1; if (r < 0.60) return 2; if (r < 0.90) return 3; return 4; }
  if (wave <= 9) { if (r < 0.15) return 2; if (r < 0.50) return 3; if (r < 0.85) return 4; return 5; }
  if (r < 0.05) return 2; if (r < 0.25) return 3; if (r < 0.65) return 4;
  return 5 + Math.floor(Math.random() * 3);
}
function getOwnedItemCount(player: Pick<Player, 'ownedItems'> | undefined, defId: string): number {
  if (!player) return 0;
  return player.ownedItems.filter(item => item.defId === defId).length;
}

function canOfferItem(defId: string, player?: Pick<Player, 'ownedItems'>): boolean {
  const def = ITEM_REGISTRY[defId];
  if (!def) return false;
  if (!def.maxOwned) return true;
  return getOwnedItemCount(player, defId) < def.maxOwned;
}

export function drawCards(wave: number, count = 5, player?: Pick<Player, 'ownedItems'>): ShopCard[] {
  let desiredItemCount = Math.min(1, count);
  const itemRoll = Math.random();
  if (count > 1) {
    if (itemRoll > 0.82) desiredItemCount = Math.min(2, count - 1);
  }
  const cards: ShopCard[] = [];
  const uniquePool = Object.keys(ITEM_REGISTRY).filter(defId => canOfferItem(defId, player) && (ITEM_REGISTRY[defId]?.maxOwned ?? Infinity) <= 1);
  const repeatablePool = Object.keys(ITEM_REGISTRY).filter(defId => canOfferItem(defId, player) && (ITEM_REGISTRY[defId]?.maxOwned ?? Infinity) > 1);

  for (let i = 0; i < desiredItemCount; i++) {
    const pool = [...uniquePool, ...repeatablePool];
    if (pool.length === 0) break;
    const defId = pool[Math.floor(Math.random() * pool.length)];
    cards.push({ id: Math.random().toString(36).substr(2, 9), cardType: 'item', defId });
    const def = ITEM_REGISTRY[defId];
    if (def && (def.maxOwned ?? Infinity) <= 1) {
      const idx = uniquePool.indexOf(defId);
      if (idx !== -1) uniquePool.splice(idx, 1);
    }
  }

  while (cards.length < count) {
    const level = getWeaponLevel(wave);
    const type: 'sword' | 'gun' = Math.random() < 0.5 ? 'sword' : 'gun';
    const branch: 'A' | 'B' | null = level >= 5 ? (Math.random() < 0.5 ? 'A' : 'B') : null;
    cards.push({ id: Math.random().toString(36).substr(2, 9), cardType: 'weapon', type, level, branch, cost: weaponCost(level) });
  }
  return cards.sort(() => Math.random() - 0.5);
}
export const RARITY_COLOR = ['#707888', '#38c060', '#4090e8', '#9060d8', '#e89030'];
export const weaponColor = (level: number) => RARITY_COLOR[Math.min(level - 1, 4)];
export const BRANCH_DISPLAY: Record<string, Record<'A' | 'B', string>> = {
  sword: { A: '旋風流', B: '閃光流' },
  gun: { A: '燃燒流', B: '狙擊流' },
};

// ── Design Tokens ─────────────────────────────────────────────────────────────

const C = {
  bg:        '#07080d',
  panel:     '#0a0c17',
  panelAlt:  '#080a12',
  b0:        '#0e1420',
  b1:        '#182030',
  b2:        '#243048',
  bgold:     '#a86a18',
  bgoldBr:   '#e8a828',
  text:      '#c0b490',
  textSm:    '#7a6e58',
  textDim:   '#303848',
  gold:      '#e8a828',
  green:     '#30b858',
  red:       '#d84040',
  blue:      '#3090d8',
  purple:    '#7840c8',
  orange:    '#d07020',
  mint:      '#28b890',
  yellow:    '#c8b820',
  pink:      '#c03888',
  disabled:  '#0e1420',
  disabledT: '#283040',
} as const;

const STAT_COLOR: Record<string, string> = {
  maxHp: '#d84040',
  speed: '#28b890',
  damage: '#d07020',
  attackSpeed: '#c8b820',
  pickupRadius: '#7840c8',
  armor: '#3090d8',
  knockback: '#d06828',
  regen: '#30b858',
};

// ── Pixel progress bar ────────────────────────────────────────────────────────

const PBar: React.FC<{ val: number; max: number; color: string }> = ({ val, max, color }) => {
  const filled = Math.round(Math.min(val / Math.max(max, 1), 1) * 8);
  return (
    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} style={{
          width: 7, height: 7, flexShrink: 0,
          background: i < filled ? color : C.b2,
          boxShadow: i < filled ? `0 0 4px ${color}60` : 'none',
        }} />
      ))}
    </div>
  );
};

// ── Pixel button — gradient fill, shadow outline, no hard border ──────────────

const PxBtn: React.FC<{
  onClick?: () => void;
  disabled?: boolean;
  color?: string;
  fill?: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ onClick, disabled, color = C.gold, fill = false, children, style }) => {
  const [pressed, setPressed] = useState(false);
  const fg = disabled ? C.disabledT : (fill ? C.bg : color);
  const bg = disabled
    ? C.disabled
    : fill
      ? `linear-gradient(180deg, ${color}f0 0%, ${color}c0 100%)`
      : 'transparent';
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onPointerDown={() => !disabled && setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
        fontFamily: "'Press Start 2P', monospace", fontSize: 8,
        border: 'none', background: bg, color: fg,
        padding: '10px 14px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transform: pressed && !disabled ? 'translateY(2px)' : 'none',
        transition: 'transform 60ms',
        letterSpacing: '0.04em',
        userSelect: 'none', WebkitTapHighlightColor: 'transparent',
        boxSizing: 'border-box', width: '100%',
        boxShadow: disabled
          ? 'none'
          : fill
            ? `0 3px 0 rgba(0,0,0,0.55), 0 0 16px ${color}35`
            : `inset 0 0 0 1px ${color}65, 0 0 8px ${color}18`,
        ...style,
      }}
    >{children}</button>
  );
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface ShopPanelProps {
  player: Player; wave: number; onNextWave: () => void;
  isReadyMode?: boolean; isReady?: boolean;
  statPointsOverride?: number;
  onStatUpgradeOverride?: (statId: string) => void;
  hideInventory?: boolean; cardCount?: number;
  customFooter?: React.ReactNode;
  // 線上模式專用
  isOnline?: boolean;
  myReady?: boolean;
  otherReady?: boolean;
  countdown?: number | null;
  onToggleReady?: () => void;
}

// ── Main Component ────────────────────────────────────────────────────────────

export const ShopPanel: React.FC<ShopPanelProps> = ({
  player, wave, onNextWave,
  isReadyMode = false, isReady = false,
  statPointsOverride, onStatUpgradeOverride,
  hideInventory = false, cardCount = 5, customFooter,
  isOnline = false, myReady = false, otherReady = false,
  countdown = null, onToggleReady,
}) => {
  const effectivePts = statPointsOverride !== undefined ? statPointsOverride : player.arenaStatPoints;

  const [mobileTab, setMobileTab] = useState<1 | 2>(effectivePts > 0 ? 1 : 2);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 768);
  const [shopCards, setShopCards] = useState<ShopCard[]>(() => drawCards(wave, cardCount, player));
  const [rerollCost, setRerollCost] = useState(10);
  const [mergePending, setMergePending] = useState<{ keepId: string; removeId: string } | null>(null);
  const [branchPending, setBranchPending] = useState<{ weaponId: string } | null>(null);
  const [, forceUpdate] = useState(0);
  const rerender = () => forceUpdate(n => n + 1);

  useLayoutEffect(() => {
    const h = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    if (effectivePts <= 0 && mobileTab === 1) setMobileTab(2);
  }, [effectivePts]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePickStat = (id: string) => {
    if (onStatUpgradeOverride) { onStatUpgradeOverride(id); return; }
    if (player.arenaStatPoints <= 0) return;
    const def = STAT_REGISTRY[id]; if (!def) return;
    const curLv = player.statLevels[id] ?? 0;
    if (def.maxLevel !== -1 && curLv >= def.maxLevel) return;
    def.apply(player); player.statLevels[id] = curLv + 1; player.arenaStatPoints -= 1;
    audioManager.playPickup(); rerender();
  };

  const handleBuyWeapon = (card: WeaponCard) => {
    if (player.materials < card.cost || player.weapons.length >= 6) return;
    player.materials -= card.cost;
    player.weapons.push({
      id: Math.random().toString(36).substr(2, 9),
      type: card.type,
      level: card.level,
      branch: card.branch,
      lastAttackTime: 0,
      investedCost: card.cost,
    });
    audioManager.playPickup(); setShopCards(prev => prev.filter(c => c.id !== card.id)); rerender();
  };

  const handleBuyItem = (card: ItemCard) => {
    const def = ITEM_REGISTRY[card.defId];
    if (!canOfferItem(card.defId, player)) return;
    if (!def || player.materials < def.cost) return;
    player.materials -= def.cost;
    if (def.type === 'permanent') def.apply(player);
    player.ownedItems.push({ id: Math.random().toString(36).substr(2, 9), defId: card.defId });
    audioManager.playPickup(); setShopCards(prev => prev.filter(c => c.id !== card.id)); rerender();
  };

  const handleReroll = () => {
    const passIdx = player.ownedItems.findIndex(i => i.defId === 'guest_pass');
    const free = passIdx !== -1;
    if (!free && player.materials < rerollCost) return;
    if (free) { player.ownedItems.splice(passIdx, 1); }
    else { player.materials -= rerollCost; setRerollCost(p => p + 5); }
    audioManager.playPickup(); setShopCards(drawCards(wave, cardCount, player)); rerender();
  };

  const handleInventoryClick = (w: WeaponSlot) => {
    const match = canArenaWeaponMerge(w)
      ? player.weapons.find(o => o.id !== w.id && o.type === w.type && o.level === w.level && o.branch === w.branch)
      : undefined;
    if (match) { setMergePending({ keepId: w.id, removeId: match.id }); return; }
    const price = getArenaWeaponSellPrice(w);
    const levelLabel = formatArenaWeaponLevel(w.level, w.branch);
    if (window.confirm(`售出 ${levelLabel} ${w.type === 'sword' ? '劍' : '槍'}${w.branch ?? ''} → 💰${price}?`)) {
      const idx = player.weapons.findIndex(x => x.id === w.id);
      if (idx !== -1) { player.weapons.splice(idx, 1); player.materials += price; }
      audioManager.playPickup(); rerender();
    }
  };

  const handleSellItem = (item: OwnedItem) => {
    const def = ITEM_REGISTRY[item.defId]; if (!def) return;
    const price = Math.floor(def.cost * 0.5);
    if (!window.confirm(`售出「${def.name}」→ 💰${price}?`)) return;
    if (def.type === 'permanent' && def.unapply) def.unapply(player);
    player.ownedItems = player.ownedItems.filter(i => i.id !== item.id);
    player.materials += price; audioManager.playPickup(); rerender();
  };

  const handleConfirmMerge = () => {
    if (!mergePending) return;
    const keep = player.weapons.find(w => w.id === mergePending.keepId);
    const ri = player.weapons.findIndex(w => w.id === mergePending.removeId);
    if (!keep || ri === -1) { setMergePending(null); return; }
    const consumed = player.weapons[ri];
    if (!consumed) { setMergePending(null); return; }
    player.weapons.splice(ri, 1);
    keep.investedCost = getArenaWeaponInvestedCost(keep) + getArenaWeaponInvestedCost(consumed);
    keep.lastAttackTime = 0;
    audioManager.playPickup(); setMergePending(null);
    if (willArenaWeaponBranchEvolve(keep)) setBranchPending({ weaponId: keep.id });
    else {
      keep.level = Math.min(ARENA_BRANCH_MAX_LEVEL, keep.level + 1);
      rerender();
    }
  };

  const handleSelectBranch = (branch: 'A' | 'B') => {
    if (!branchPending) return;
    const w = player.weapons.find(x => x.id === branchPending.weaponId);
    if (w) {
      w.branch = branch;
      w.level = ARENA_BRANCH_MAX_LEVEL;
    }
    setBranchPending(null); rerender();
  };

  const hasGuestPass = player.ownedItems.some(i => i.defId === 'guest_pass');
  const canReroll = hasGuestPass || player.materials >= rerollCost;
  const ownedItemStacks: Array<{ defId: string; items: OwnedItem[]; count: number }> = [];
  for (const item of player.ownedItems) {
    const existingStack = ownedItemStacks.find(stack => stack.defId === item.defId);
    if (existingStack) {
      existingStack.items.push(item);
      existingStack.count += 1;
    } else {
      ownedItemStacks.push({ defId: item.defId, items: [item], count: 1 });
    }
  }

  // ── Stats panel ────────────────────────────────────────────────────────────

  const statsPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        flexShrink: 0, padding: '10px 16px',
        background: `linear-gradient(180deg, #0c0f1e 0%, ${C.panelAlt} 100%)`,
        boxShadow: `0 1px 0 ${C.b1}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: C.blue, letterSpacing: '0.05em' }}>
          素質升級
        </span>
        {effectivePts > 0
          ? <span style={{
              fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: C.gold,
              boxShadow: `inset 0 0 0 1px ${C.bgold}, 0 0 8px ${C.bgold}40`,
              padding: '3px 8px',
              textShadow: `0 0 10px ${C.gold}80`,
            }}>★{effectivePts}</span>
          : <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.textDim }}>點數耗盡</span>
        }
      </div>

      {/* Rows */}
      <div className="px-scroll-y" style={{ flex: 1 }}>
        {Object.values(STAT_REGISTRY).map((stat, idx) => {
          const curLv = player.statLevels[stat.id] ?? 0;
          const isMaxed = stat.maxLevel !== -1 && curLv >= stat.maxLevel;
          const canUp = !isMaxed && effectivePts > 0;
          const col = STAT_COLOR[stat.id] ?? C.text;
          return (
            <div
              key={stat.id}
              onClick={() => canUp && handlePickStat(stat.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '0 14px', height: 46,
                background: canUp
                  ? `linear-gradient(90deg, ${col}08 0%, transparent 40%)`
                  : idx % 2 === 0 ? C.panel : C.bg,
                boxShadow: `inset 0 -1px 0 ${C.b0}`,
                cursor: canUp ? 'pointer' : 'default',
                opacity: isMaxed ? 0.4 : 1,
                transition: 'background 120ms, opacity 150ms',
                userSelect: 'none', WebkitTapHighlightColor: 'transparent',
              }}
            >
              <span style={{ fontSize: 15, width: 22, textAlign: 'center', flexShrink: 0 }}>{stat.icon}</span>
              <span style={{
                fontFamily: "'Press Start 2P', monospace", fontSize: 7,
                color: canUp ? C.text : C.textSm, flexShrink: 0,
                width: isDesktop ? 72 : 64, lineHeight: 1.5,
              }}>{stat.name}</span>
              <PBar val={curLv} max={stat.maxLevel > 0 ? stat.maxLevel : 10} color={col} />
              <span style={{
                fontFamily: "'Press Start 2P', monospace", fontSize: 7,
                color: isMaxed ? C.gold : C.textSm,
                flexShrink: 0, minWidth: 32, textAlign: 'right',
              }}>
                {isMaxed ? 'MAX' : `${curLv}/${stat.maxLevel}`}
              </span>
              {canUp && (
                <div style={{
                  flexShrink: 0, width: 26, height: 26,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: col, fontFamily: "'Press Start 2P', monospace", fontSize: 14,
                  marginLeft: 'auto',
                  boxShadow: `inset 0 0 0 1px ${col}80, 0 0 8px ${col}30`,
                }}>+</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── Shop panel ─────────────────────────────────────────────────────────────

  const shopPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>

      {/* Weapon inventory */}
      {!hideInventory && (
        <div style={{ flexShrink: 0, boxShadow: `0 2px 0 ${C.b1}, 0 4px 12px rgba(0,0,0,0.4)` }}>
          <div style={{
            padding: '8px 16px 6px',
            background: `linear-gradient(180deg, #0c0f1e 0%, ${C.panelAlt} 100%)`,
            boxShadow: `0 1px 0 ${C.b0}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.textSm }}>武器欄</span>
            <span style={{
              fontFamily: "'Press Start 2P', monospace", fontSize: 8,
              color: player.weapons.length >= 6 ? C.red : C.gold,
              textShadow: player.weapons.length >= 6 ? `0 0 8px ${C.red}80` : `0 0 8px ${C.gold}60`,
            }}>{player.weapons.length}/6</span>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: C.textDim, marginLeft: 'auto' }}>
              點擊合成 / 點擊售出
            </span>
          </div>
          <div className="px-scroll-x" style={{
            display: 'flex', gap: 6, padding: '8px 14px',
            background: C.bg,
          }}>
            {Array.from({ length: 6 }).map((_, i) => {
              const w = player.weapons[i];
              if (!w) return (
                <div key={`e${i}`} style={{
                  width: 64, height: 64, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: C.textDim, fontSize: 22,
                  boxShadow: `inset 0 0 0 1px ${C.b2}`,
                  background: `${C.b0}40`,
                }}>+</div>
              );
              const col = weaponColor(w.level);
              const hasMatch = canArenaWeaponMerge(w) && player.weapons.some(o => o.id !== w.id && o.type === w.type && o.level === w.level && o.branch === w.branch);
              return (
                <div key={w.id} onClick={() => handleInventoryClick(w)} style={{
                  width: 64, height: 64, flexShrink: 0, position: 'relative',
                  cursor: 'pointer', overflow: 'hidden',
                  boxShadow: hasMatch
                    ? `0 0 0 2px ${C.gold}, 0 0 12px ${C.gold}50`
                    : `0 0 0 1px ${col}50, 0 0 8px ${col}20`,
                }}>
                  <WeaponPreviewCanvas type={w.type} level={w.level} branch={w.branch} bufW={192} bufH={192} bg={C.panel} />
                  {hasMatch && (
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: `linear-gradient(90deg, ${C.gold}e0, ${C.bgoldBr}e0)`,
                      color: C.bg, fontSize: 6,
                      fontFamily: "'Press Start 2P', monospace",
                      textAlign: 'center', padding: '2px 0',
                    }}>↑合</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Accessories strip */}
      {false && player.ownedItems.length > 0 && (
        <div style={{
          flexShrink: 0, padding: '6px 14px',
          display: 'flex', gap: 6, flexWrap: 'wrap',
          boxShadow: `0 1px 0 ${C.b1}`, background: C.panel,
        }}>
          {player.ownedItems.map(item => {
            const def = ITEM_REGISTRY[item.defId]; if (!def) return null;
            return (
              <div key={item.id} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: `inset 0 0 0 1px ${C.b2}`,
                padding: '4px 8px', background: C.bg,
              }}>
                <span style={{ fontSize: 13 }}>{def.icon}</span>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.text }}>{def.name}</span>
                <button onClick={() => handleSellItem(item)} style={{
                  boxShadow: `inset 0 0 0 1px ${C.red}`,
                  background: 'transparent', color: C.red, border: 'none',
                  fontFamily: "'Press Start 2P', monospace", fontSize: 6,
                  cursor: 'pointer', padding: '2px 6px',
                }}>售</button>
              </div>
            );
          })}
        </div>
      )}

      {ownedItemStacks.length > 0 && (
        <div style={{
          flexShrink: 0, padding: '6px 14px',
          boxShadow: `0 1px 0 ${C.b1}`, background: C.panel,
        }}>
          <div className="px-scroll-x" style={{ display: 'flex', gap: 6, paddingBottom: 2 }}>
            {ownedItemStacks.map(stack => {
              const def = ITEM_REGISTRY[stack.defId]; if (!def) return null;
              const firstItem = stack.items[0];
              if (!firstItem) return null;
              return (
                <div key={stack.defId} style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  flexShrink: 0,
                  boxShadow: `inset 0 0 0 1px ${C.b2}`,
                  padding: '4px 8px', background: C.bg,
                }}>
                  <span style={{ fontSize: 13 }}>{def.icon}</span>
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.text }}>{def.name}</span>
                  {stack.count > 1 && (
                    <span style={{
                      fontFamily: "'Press Start 2P', monospace",
                      fontSize: 6,
                      color: C.gold,
                      boxShadow: `inset 0 0 0 1px ${C.bgold}70`,
                      padding: '2px 5px',
                      minWidth: 24,
                      textAlign: 'center',
                    }}>
                      x{stack.count}
                    </span>
                  )}
                  <button onClick={() => handleSellItem(firstItem)} style={{
                    boxShadow: `inset 0 0 0 1px ${C.red}`,
                    background: 'transparent', color: C.red, border: 'none',
                    fontFamily: "'Press Start 2P', monospace", fontSize: 6,
                    cursor: 'pointer', padding: '2px 6px',
                    touchAction: 'manipulation',
                  }}>SELL</button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Shop cards */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{
          flexShrink: 0, padding: '8px 16px 6px',
          background: `linear-gradient(180deg, #0c0f1e 0%, ${C.panelAlt} 100%)`,
          boxShadow: `0 1px 0 ${C.b0}`,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.textSm }}>補給站</span>
          <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 6, color: C.textDim }}>{shopCards.length} 項</span>
        </div>

        <div className="px-scroll-y" style={{
          flex: 1, minHeight: 0,
          display: 'grid',
          gridTemplateColumns: isDesktop
            ? `repeat(${Math.min(shopCards.length || 1, 5)}, 1fr)`
            : 'repeat(2, 1fr)',
          gridAutoRows: isDesktop ? '1fr' : 'max-content',
          gap: 8, padding: 10,
          boxSizing: 'border-box',
        }}>
          {shopCards.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1', gridRow: '1 / -1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `inset 0 0 0 1px ${C.b2}`,
              fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: C.textDim,
            }}>SOLD OUT</div>
          ) : shopCards.map(card => {
            if (card.cardType === 'weapon') {
              const col = weaponColor(card.level);
              const canBuy = player.materials >= card.cost && player.weapons.length < 6;
              return (
                <div key={card.id} style={{
                  display: 'flex', flexDirection: 'column',
                  background: `linear-gradient(180deg, ${C.panel} 0%, ${C.panelAlt} 100%)`,
                  overflow: 'hidden', minHeight: 0,
                  boxShadow: `0 0 0 1px ${col}35, 0 4px 20px rgba(0,0,0,0.6), 0 0 16px ${col}14`,
                }}>
                  <div style={{ width: '100%', aspectRatio: isDesktop ? undefined : '402/240', flex: isDesktop ? 1 : 'none', minHeight: 0, overflow: 'hidden', boxShadow: `0 1px 0 ${col}20` }}>
                    <WeaponPreviewCanvas
                      type={card.type} level={card.level} branch={card.branch}
                      bufW={402} bufH={240} bg={C.panelAlt}
                    />
                  </div>
                  <div style={{
                    flexShrink: 0, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 4, padding: '6px 8px 8px',
                  }}>
                    <span style={{
                      fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: col,
                      textShadow: `0 0 8px ${col}80`,
                    }}>{formatArenaWeaponLevel(card.level, card.branch)}{card.branch ? ` ${card.branch}` : ''}</span>
                    <StarRating level={card.level} branch={card.branch} size="sm" />
                    <button onClick={() => canBuy && handleBuyWeapon(card)} style={{
                      width: '100%', marginTop: 2, border: 'none',
                      background: canBuy
                        ? `linear-gradient(180deg, ${C.gold}f0 0%, ${C.bgold}e0 100%)`
                        : C.disabled,
                      color: canBuy ? C.bg : C.disabledT,
                      fontFamily: "'Press Start 2P', monospace", fontSize: 8,
                      padding: '7px 0', cursor: canBuy ? 'pointer' : 'not-allowed',
                      boxShadow: canBuy ? `0 3px 0 rgba(0,0,0,0.5), 0 0 10px ${C.gold}30` : 'none',
                    }}>💰{card.cost}</button>
                  </div>
                </div>
              );
            } else {
              const def = ITEM_REGISTRY[card.defId]; if (!def) return null;
              const canBuy = player.materials >= def.cost;
              const ac = def.type === 'consumable' ? C.green : C.purple;
              return (
                <div key={card.id} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  background: `linear-gradient(180deg, ${C.panel} 0%, ${C.panelAlt} 100%)`,
                  padding: '10px 8px 8px', overflow: 'hidden', minHeight: 0,
                  boxShadow: `0 0 0 1px ${ac}35, 0 4px 20px rgba(0,0,0,0.6), 0 0 14px ${ac}12`,
                }}>
                  <span style={{ fontSize: 26, flexShrink: 0 }}>{def.icon}</span>
                  <span style={{
                    fontFamily: "'Press Start 2P', monospace", fontSize: 7,
                    color: ac, textAlign: 'center', marginTop: 6, lineHeight: 1.6,
                    flexShrink: 0, textShadow: `0 0 8px ${ac}60`,
                  }}>{def.name}</span>
                  <span style={{
                    fontFamily: 'monospace', fontSize: 11, color: C.textSm,
                    textAlign: 'center', marginTop: 4, flex: 1, lineHeight: 1.5, overflow: 'hidden',
                  }}>{def.description}</span>
                  <button onClick={() => canBuy && handleBuyItem(card)} style={{
                    flexShrink: 0, width: '100%', marginTop: 6, border: 'none',
                    background: canBuy
                      ? `linear-gradient(180deg, ${C.gold}f0 0%, ${C.bgold}e0 100%)`
                      : C.disabled,
                    color: canBuy ? C.bg : C.disabledT,
                    fontFamily: "'Press Start 2P', monospace", fontSize: 8,
                    padding: '7px 0', cursor: canBuy ? 'pointer' : 'not-allowed',
                    boxShadow: canBuy ? `0 3px 0 rgba(0,0,0,0.5), 0 0 10px ${C.gold}30` : 'none',
                  }}>💰{def.cost}</button>
                </div>
              );
            }
          })}
        </div>
      </div>
    </div>
  );

  // ── RENDER ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .px-root * { box-sizing: border-box; }
        .px-root ::-webkit-scrollbar { width: 4px; height: 4px; }
        .px-root ::-webkit-scrollbar-track { background: ${C.bg}; }
        .px-root ::-webkit-scrollbar-thumb { background: ${C.b2}; border-radius: 2px; }
        .px-scroll-y {
          overflow-y: auto;
          overflow-x: hidden;
          -webkit-overflow-scrolling: touch;
          touch-action: manipulation;
        }
        .px-scroll-x {
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          touch-action: manipulation;
        }
        @keyframes px-blink { 0%,49%{opacity:1} 50%,100%{opacity:0} }
        .px-blink { animation: px-blink 1.2s step-start infinite; }
      `}</style>

      {/* ROOT */}
      <div className="px-root" style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        background: `radial-gradient(ellipse 80% 60% at 20% 0%, #101528 0%, ${C.bg} 65%)`,
        color: C.text, overflow: 'hidden', fontFamily: 'monospace',
      }}>

        {/* ── HEADER ────────────────────────────────────────────────────── */}
        <header style={{
          flexShrink: 0, position: 'relative', zIndex: 2,
          background: `linear-gradient(180deg, #0e1220 0%, ${C.panelAlt} 100%)`,
          boxShadow: `0 2px 0 ${C.b1}, 0 4px 24px rgba(0,0,0,0.7)`,
        }}>
          <div style={{ height: 2, background: `linear-gradient(90deg, transparent 0%, ${C.bgold} 25%, ${C.bgoldBr} 50%, ${C.bgold} 75%, transparent 100%)` }} />
          <div style={{ display: 'flex', alignItems: 'stretch', flexWrap: 'wrap' }}>
            <div style={{ padding: '10px 18px', boxShadow: `inset -1px 0 0 ${C.b1}`, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="px-blink" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.red }}>☠</span>
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: C.gold, letterSpacing: '0.12em', textShadow: `0 0 12px ${C.gold}60` }}>
                波次 {wave}
              </span>
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.textSm }}>後勤補給</span>
            </div>
            {[
              { icon: '💰', val: Math.floor(player.materials), color: C.gold },
              { icon: '❤', val: `${Math.floor(player.hp)}/${player.maxHp}`, color: C.green },
              { icon: 'LV', val: player.level, color: C.blue },
            ].map(chip => (
              <div key={chip.icon} style={{ padding: '10px 14px', boxShadow: `inset -1px 0 0 ${C.b1}`, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: chip.color }}>{chip.icon}</span>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: chip.color, textShadow: `0 0 8px ${chip.color}50` }}>{chip.val}</span>
              </div>
            ))}
            {effectivePts > 0 && (
              <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.textSm }}>點數</span>
                <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 12, color: C.gold, textShadow: `0 0 12px ${C.gold}80` }}>★{effectivePts}</span>
              </div>
            )}
            {isReadyMode && (
              <div style={{
                marginLeft: 'auto', padding: '10px 18px',
                boxShadow: `inset 1px 0 0 ${C.b1}`,
                display: 'flex', alignItems: 'center',
                fontFamily: "'Press Start 2P', monospace", fontSize: 7,
                color: player.color ?? C.blue,
              }}>P{player.id} LOADOUT</div>
            )}
          </div>
        </header>

        {/* ── MOBILE TABS ───────────────────────────────────────────────── */}
        {!isDesktop && (
          <div style={{
            flexShrink: 0, display: 'flex',
            background: C.panelAlt,
            boxShadow: `0 2px 0 ${C.b1}, 0 4px 12px rgba(0,0,0,0.4)`,
            position: 'relative', zIndex: 2,
          }}>
            {([
              { id: 1 as const, label: effectivePts > 0 ? `素質 ★${effectivePts}` : '素質' },
              { id: 2 as const, label: '武器商店' },
            ] as const).map(tab => (
              <button key={tab.id} onClick={() => setMobileTab(tab.id)} style={{
                flex: 1, padding: '11px 8px',
                fontFamily: "'Press Start 2P', monospace", fontSize: 8,
                color: mobileTab === tab.id ? C.gold : C.textDim,
                background: mobileTab === tab.id
                  ? `linear-gradient(180deg, ${C.bg} 0%, ${C.panel} 100%)`
                  : 'transparent',
                border: 'none',
                boxShadow: mobileTab === tab.id
                  ? `inset 0 -3px 0 ${C.bgoldBr}, inset -1px 0 0 ${C.b1}, 0 0 10px ${C.bgold}15`
                  : `inset -1px 0 0 ${C.b1}`,
                cursor: 'pointer', letterSpacing: '0.04em',
                transition: 'color 150ms',
              }}>
                {mobileTab === tab.id ? '▶ ' : '   '}{tab.label}
              </button>
            ))}
          </div>
        )}

        {/* ── CONTENT ───────────────────────────────────────────────────── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', overflow: 'hidden', position: 'relative', zIndex: 1 }}>

          {/* Left: stats */}
          <div style={{
            display: isDesktop || mobileTab === 1 ? 'flex' : 'none',
            flexDirection: 'column',
            flex: isDesktop ? '0 0 30%' : '1 1 100%',
            maxWidth: isDesktop ? '320px' : '100%',
            minWidth: 0, minHeight: 0, overflow: 'hidden',
            boxShadow: isDesktop ? `2px 0 0 ${C.b1}, 4px 0 16px rgba(0,0,0,0.4)` : 'none',
          }}>
            {statsPanel}
          </div>

          {/* Right: shop */}
          <div style={{
            display: isDesktop || mobileTab === 2 ? 'flex' : 'none',
            flexDirection: 'column',
            flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden',
          }}>
            {shopPanel}
          </div>
        </div>

        {/* ── FOOTER ────────────────────────────────────────────────────── */}
        {/* ── FOOTER ────────────────────────────────────────────────────── */}
        <footer style={{
          flexShrink: 0, display: 'flex', gap: 12,
          background: `linear-gradient(180deg, #13172c 0%, #060710 100%)`,
          boxShadow: `0 -6px 30px rgba(0,0,0,0.8), inset 0 2px 0 rgba(255,255,255,0.05)`,
          position: 'relative', zIndex: 10,
          padding: isDesktop ? '18px 24px' : '12px 12px calc(12px + env(safe-area-inset-bottom, 18px))',
        }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent 0%, ${C.gold} 50%, transparent 100%)`, opacity: 0.9, boxShadow: `0 0 15px ${C.gold}` }} />
          
          <button
            onClick={!canReroll ? undefined : handleReroll}
            disabled={!canReroll}
            style={{
              flex: 1, position: 'relative', border: 'none',
              background: !canReroll ? C.disabled : `linear-gradient(180deg, ${hasGuestPass ? C.green : C.blue}30 0%, ${C.bg} 100%)`,
              boxShadow: !canReroll ? 'none' : `inset 0 0 0 2px ${hasGuestPass ? C.green : C.blue}80, 0 6px 20px rgba(0,0,0,0.5)`,
              borderRadius: 6, cursor: !canReroll ? 'not-allowed' : 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
              padding: isDesktop ? '16px 0' : '14px 0',
              transition: 'all 0.15s',
              opacity: !canReroll ? 0.7 : 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: isDesktop ? 22 : 18 }}>🎲</span>
              <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isDesktop ? 12 : 10, color: !canReroll ? C.disabledT : (hasGuestPass ? C.green : C.blue), textShadow: !canReroll ? 'none' : `0 0 12px ${hasGuestPass ? C.green : C.blue}60` }}>
                重擲
              </span>
            </div>
            <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: !canReroll ? C.disabledT : C.text, marginTop: 2 }}>
              {hasGuestPass ? '🎫 FREE' : `💰${rerollCost}`}
            </span>
          </button>

          {/* ── 線上模式：Toggle 準備按鈕 + 雙燈號 ── */}
          {isOnline ? (
            <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                onClick={countdown !== null ? undefined : onToggleReady}
                disabled={countdown !== null}
                style={{
                  width: '100%', border: 'none', borderRadius: 6, cursor: countdown !== null ? 'default' : 'pointer',
                  background: countdown !== null
                    ? `linear-gradient(180deg, #22c55e 0%, #16a34a 100%)`
                    : myReady
                      ? `linear-gradient(180deg, #64748b 0%, #475569 100%)`
                      : `linear-gradient(180deg, #f5b936 0%, #d4800c 100%)`,
                  boxShadow: myReady && countdown === null
                    ? 'inset 0 2px 0 rgba(255,255,255,0.15), 0 3px 0 #2d3748'
                    : countdown !== null
                      ? 'inset 0 2px 0 rgba(255,255,255,0.3), 0 6px 0 #15803d, 0 10px 20px rgba(34,197,94,0.5)'
                      : 'inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 #8c5204, 0 10px 25px rgba(212,128,12,0.6)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: isDesktop ? '14px 0' : '12px 0',
                  transform: myReady && countdown === null ? 'none' : 'translateY(-2px)',
                  transition: 'all 0.15s',
                }}
              >
                {countdown !== null ? (
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isDesktop ? 20 : 16, color: '#fff', textShadow: '0 0 12px #86efac' }}>
                    {countdown}
                  </span>
                ) : myReady ? (
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isDesktop ? 11 : 9, color: '#cbd5e1' }}>✕ 取消準備</span>
                ) : (
                  <>
                    <span style={{ fontSize: isDesktop ? 20 : 16 }}>✓</span>
                    <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isDesktop ? 13 : 11, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>準備</span>
                  </>
                )}
              </button>
              {/* 雙燈號 */}
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: myReady ? '#22c55e' : '#374151', boxShadow: myReady ? '0 0 6px #22c55e' : 'none', transition: 'all 0.2s' }} />
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.textDim }}>我</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: otherReady ? '#22c55e' : '#374151', boxShadow: otherReady ? '0 0 6px #22c55e' : 'none', transition: 'all 0.2s' }} />
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.textDim }}>隊友</span>
                </div>
              </div>
            </div>
          ) : (
            /* 單機 / 本地雙人：原來的「下一波」按鈕 */
            <button
              onClick={isReadyMode && isReady ? undefined : onNextWave}
              disabled={isReadyMode && isReady}
              style={{
                flex: 1.2, position: 'relative', border: 'none',
                background: (isReadyMode && isReady) ? C.disabled : `linear-gradient(180deg, #f5b936 0%, #d4800c 100%)`,
                boxShadow: (isReadyMode && isReady) ? 'none' : `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 #8c5204, 0 10px 25px rgba(212, 128, 12, 0.6)`,
                borderRadius: 6, cursor: (isReadyMode && isReady) ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                padding: isDesktop ? '16px 0' : '14px 0',
                transform: (isReadyMode && isReady) ? 'none' : 'translateY(-2px)',
                transition: 'all 0.1s',
              }}
              onPointerDown={(e) => {
                if (!(isReadyMode && isReady)) {
                  e.currentTarget.style.transform = 'translateY(4px)';
                  e.currentTarget.style.boxShadow = `inset 0 2px 0 rgba(255,255,255,0.2), 0 0 0 #8c5204, 0 4px 10px rgba(212, 128, 12, 0.4)`;
                }
              }}
              onPointerUp={(e) => {
                if (!(isReadyMode && isReady)) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 #8c5204, 0 10px 25px rgba(212, 128, 12, 0.6)`;
                }
              }}
              onPointerLeave={(e) => {
                if (!(isReadyMode && isReady)) {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = `inset 0 2px 0 rgba(255,255,255,0.4), 0 6px 0 #8c5204, 0 10px 25px rgba(212, 128, 12, 0.6)`;
                }
              }}
            >
              {isReadyMode ? (
                isReady ? (
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isDesktop ? 12 : 10, color: C.textDim }}>⏳ 等待隊友</span>
                ) : (
                  <>
                    <span style={{ fontSize: isDesktop ? 22 : 18 }}>✓</span>
                    <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isDesktop ? 14 : 12, color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>準備好了</span>
                  </>
                )
              ) : (
                <>
                  <span style={{ fontSize: isDesktop ? 24 : 20, textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>⚔</span>
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: isDesktop ? 15 : 13, color: '#fff', textShadow: '0 2px 6px rgba(0,0,0,0.6)', letterSpacing: '0.05em' }}>下一波</span>
                </>
              )}
            </button>
          )}
        </footer>

        {customFooter && (
          <div style={{ flexShrink: 0, boxShadow: `inset 0 1px 0 ${C.b1}`, background: C.panelAlt, position: 'relative', zIndex: 2 }}>
            {customFooter}
          </div>
        )}
      </div>

      {/* ── MERGE MODAL ───────────────────────────────────────────────────── */}
      {mergePending && (() => {
        const w = player.weapons.find(x => x.id === mergePending.keepId);
        if (!w) return null;
        const evolvesToBranchMax = willArenaWeaponBranchEvolve(w);
        const nextLv = getArenaWeaponMergePreviewLevel(w);
        const col = evolvesToBranchMax ? C.purple : weaponColor(nextLv);
        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'rgba(0,0,0,0.85)',
          }}>
            <div style={{
              width: '100%', maxWidth: 420, margin: '0 auto',
              background: `linear-gradient(180deg, #0f1220 0%, ${C.panel} 100%)`,
              padding: 24, textAlign: 'center',
              boxShadow: `0 0 0 1px ${C.bgold}, 0 0 50px ${C.gold}30, 0 -20px 40px rgba(0,0,0,0.6)`,
            }}>
              <div style={{
                boxShadow: `inset 0 0 0 1px ${C.bgold}60`,
                padding: 16,
              }}>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: C.gold, letterSpacing: '0.1em', marginBottom: 16, textShadow: `0 0 12px ${C.gold}60` }}>
                  ⬆ 武器合成
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
                  <div style={{ width: 80, overflow: 'hidden', boxShadow: `0 0 0 1px ${weaponColor(w.level)}60` }}>
                    <WeaponPreviewCanvas type={w.type} level={w.level} branch={w.branch} bufW={240} bufH={144} bg={C.panelAlt} />
                  </div>
                  <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 14, color: C.gold }}>→</span>
                  {evolvesToBranchMax ? (
                    <div style={{
                      width: 80,
                      height: 48,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 4,
                      boxShadow: `0 0 0 2px ${col}, 0 0 12px ${col}50`,
                      background: `linear-gradient(180deg, ${C.panelAlt} 0%, ${C.panel} 100%)`,
                    }}>
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: col }}>A / B</span>
                      <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 9, color: C.gold }}>MAX</span>
                    </div>
                  ) : (
                    <div style={{ width: 80, overflow: 'hidden', boxShadow: `0 0 0 2px ${col}, 0 0 12px ${col}50` }}>
                      <WeaponPreviewCanvas type={w.type} level={nextLv} branch={w.branch} bufW={240} bufH={144} bg={C.panelAlt} />
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 8 }}>
                  <StarRating level={w.level} branch={w.branch} size="sm" />
                  <span style={{ color: C.textSm }}>→</span>
                  {evolvesToBranchMax ? (
                    <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: C.gold }}>MAX</span>
                  ) : (
                    <StarRating level={nextLv} branch={w.branch} size="sm" />
                  )}
                </div>
                <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.textSm, lineHeight: 2, marginBottom: 20 }}>
                  {formatArenaWeaponLevel(w.level, w.branch)} × 2 → <span style={{ color: col, textShadow: `0 0 8px ${col}80` }}>
                    {evolvesToBranchMax ? 'MAX' : formatArenaWeaponLevel(nextLv, w.branch)}
                  </span>
                  {evolvesToBranchMax && (
                    <span style={{ color: C.purple }}><br />→ 選擇流派，直接升到 MAX</span>
                  )}
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => setMergePending(null)} style={{
                    flex: 1, padding: '10px 0', border: 'none',
                    background: 'transparent',
                    boxShadow: `inset 0 0 0 1px ${C.b2}`,
                    color: C.textSm, fontFamily: "'Press Start 2P', monospace", fontSize: 8, cursor: 'pointer',
                  }}>取消</button>
                  <button onClick={handleConfirmMerge} style={{
                    flex: 1, padding: '10px 0', border: 'none',
                    background: `linear-gradient(180deg, ${C.gold}f0, ${C.bgold}e0)`,
                    color: C.bg, fontFamily: "'Press Start 2P', monospace", fontSize: 8, cursor: 'pointer',
                    boxShadow: `0 3px 0 rgba(0,0,0,0.5), 0 0 12px ${C.gold}40`,
                  }}>合成 ↑</button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── BRANCH MODAL ──────────────────────────────────────────────────── */}
      {branchPending && (() => {
        const w = player.weapons.find(x => x.id === branchPending.weaponId);
        if (!w) return null;
        const names = BRANCH_DISPLAY[w.type] ?? { A: 'A', B: 'B' };
        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'rgba(0,0,0,0.9)',
          }}>
            <div style={{
              width: '100%', maxWidth: 480, margin: '0 auto',
              background: `linear-gradient(180deg, #0f0a20 0%, ${C.panel} 100%)`,
              padding: 24, textAlign: 'center',
              boxShadow: `0 0 0 1px ${C.purple}80, 0 0 60px ${C.purple}25, 0 -20px 40px rgba(0,0,0,0.6)`,
            }}>
              <div style={{ boxShadow: `inset 0 0 0 1px ${C.purple}40`, padding: 16 }}>
                <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 10, color: C.purple, letterSpacing: '0.1em', marginBottom: 6, textShadow: `0 0 12px ${C.purple}60` }}>
                  ◆ 流派覺醒
                </div>
                <p style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 7, color: C.textSm, lineHeight: 2, marginBottom: 24 }}>
                  {w.type === 'sword' ? '劍' : '槍'} 在 Lv.4 合成後會直接覺醒<br />選擇流派後立刻升到 MAX
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {(['A', 'B'] as const).map(branch => {
                    const bc = branch === 'A' ? C.blue : C.red;
                    return (
                      <button key={branch} onClick={() => handleSelectBranch(branch)} style={{
                        padding: '20px 12px', border: 'none',
                        background: `${bc}10`,
                        boxShadow: `0 0 0 1px ${bc}80, 0 0 16px ${bc}20`,
                        cursor: 'pointer',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                        transition: 'box-shadow 120ms',
                      }}>
                        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 22, color: bc, textShadow: `0 0 12px ${bc}80` }}>{branch}</span>
                        <span style={{ fontFamily: "'Press Start 2P', monospace", fontSize: 8, color: bc }}>{names[branch]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
};
