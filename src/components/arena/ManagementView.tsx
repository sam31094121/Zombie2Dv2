// ── ManagementView.tsx ────────────────────────────────────────────────────────
// 本地雙人競技場商店「管理視角」
// 直接使用 ShopPanel 模組，並在底部注入角色預覽 + 準備按鈕
// ─────────────────────────────────────────────────────────────────────────────
import React, { useState } from 'react';
import { Player, WeaponSlot } from '../../game/Player';
import { Game } from '../../game/Game';
import { audioManager } from '../../game/AudioManager';
import { STAT_REGISTRY } from '../../game/items/StatDefinitions';
import { weaponCost } from './ShopPanel';
import { ShopPanel } from './ShopPanel';
import { PlayerPreviewCanvas } from './PlayerPreviewCanvas';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  game: Game;
  wave: number;
  p1Ready: boolean;
  p2Ready: boolean;
  onP1Ready: () => void;
  onP2Ready: () => void;
}

// ── 主元件 ────────────────────────────────────────────────────────────────────

export const ManagementView: React.FC<Props> = ({ game, wave, p1Ready, p2Ready, onP1Ready, onP2Ready }) => {
  const p1 = game.players[0];
  const p2 = game.players[1];

  // 目前哪個玩家正在操作商店（P1=0, P2=1）
  const [selectedPlayer, setSelectedPlayer] = useState<0 | 1>(0);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(null);

  // 合成 / 流派選擇 pending state（由 CharacterPreview 雙擊觸發）
  const [mergeTarget, setMergeTarget] = useState<{ pi: 0 | 1; keepId: string; removeId: string } | null>(null);
  const [branchTarget, setBranchTarget] = useState<{ pi: 0 | 1; weaponId: string } | null>(null);
  const [renderTick, setRenderTick] = useState(0);
  const rerender = () => setRenderTick(n => n + 1);

  // ── Duo-specific handlers ─────────────────────────────────────────────────

  /**
   * 雙人模式「共享素質升級」
   * 一次升級同時作用於兩位玩家
   */
  const handleStatUpgradeOverride = (id: string) => {
    if (game.sharedStatPoints <= 0) return;
    const def = STAT_REGISTRY[id];
    if (!def) return;
    const curLv = p1.statLevels[id] ?? 0;
    if (def.maxLevel !== -1 && curLv >= def.maxLevel) return;
    for (const p of game.players) {
      def.apply(p);
      p.statLevels[id] = curLv + 1;
    }
    game.sharedStatPoints -= 1;
    audioManager.playPickup();
    rerender();
  };

  /**
   * 雙擊武器槽觸發 合成 / 出售
   */
  const handleSlotClick = (pi: 0 | 1, slotIdx: number) => {
    const target = game.players[pi];
    const slot = target.weapons[slotIdx];
    if (selectedPlayer === pi && selectedSlotIdx === slotIdx && slot) {
      const match = target.weapons.find(o =>
        o.id !== slot.id && o.type === slot.type && o.level === slot.level && o.branch === slot.branch
      );
      if (match) {
        setMergeTarget({ pi, keepId: slot.id, removeId: match.id });
      } else {
        const price = Math.floor(weaponCost(slot.level) * 0.5);
        if (window.confirm(`出售 Lv.${slot.level} ${slot.type === 'sword' ? '劍' : '槍'}${slot.branch ?? ''} 換 💰${price}？`)) {
          const idx = target.weapons.findIndex(x => x.id === slot.id);
          if (idx !== -1) { target.weapons.splice(idx, 1); target.materials += price; }
          audioManager.playPickup();
          setSelectedSlotIdx(null);
          rerender();
        }
      }
    } else {
      setSelectedPlayer(pi);
      setSelectedSlotIdx(slotIdx);
    }
  };

  const handleConfirmMerge = () => {
    if (!mergeTarget) return;
    const target = game.players[mergeTarget.pi];
    const keep = target.weapons.find(w => w.id === mergeTarget.keepId);
    const ri = target.weapons.findIndex(w => w.id === mergeTarget.removeId);
    if (!keep || ri === -1) { setMergeTarget(null); return; }
    target.weapons.splice(ri, 1);
    keep.level += 1;
    keep.lastAttackTime = 0;
    audioManager.playPickup();
    setMergeTarget(null);
    if (keep.level === 5 && keep.branch === null) {
      setBranchTarget({ pi: mergeTarget.pi, weaponId: keep.id });
    } else {
      rerender();
    }
  };

  const handleSelectBranch = (branch: 'A' | 'B') => {
    if (!branchTarget) return;
    const w = game.players[branchTarget.pi].weapons.find(x => x.id === branchTarget.weaponId);
    if (w) w.branch = branch;
    setBranchTarget(null);
    rerender();
  };

  // 當前操作玩家
  const activePlayer = game.players[selectedPlayer];

  // ── 角色預覽 + 準備按鈕（注入到 ShopPanel 底部）────────────────────────────
  const characterFooter = (
    <>
      {/* 合成確認 overlay */}
      {mergeTarget && (
        <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(0,0,0,.72)' }}>
          <div className="rounded-2xl p-6 text-center w-72 mx-4" style={{ background: '#0d1726', border: '1px solid #fbbf2455' }}>
            <p className="text-amber-400 font-bold text-base mb-1">⚗️ 武器合成</p>
            <p className="text-neutral-400 text-xs mb-5">兩把相同武器合成升一等</p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleConfirmMerge} className="flex-1 py-2 rounded-xl text-sm font-bold" style={{ background: '#92400e', color: '#fde68a' }}>合成</button>
              <button onClick={() => setMergeTarget(null)} className="flex-1 py-2 rounded-xl text-sm" style={{ background: '#1e293b', color: '#94a3b8' }}>取消</button>
            </div>
          </div>
        </div>
      )}

      {/* 流派選擇 overlay */}
      {branchTarget && (() => {
        const wType = game.players[branchTarget.pi].weapons.find(w => w.id === branchTarget.weaponId)?.type ?? 'sword';
        const BRANCH_NAME: Record<string, Record<'A' | 'B', string>> = {
          sword: { A: '旋風', B: '閃光' },
          gun:   { A: '燃燒', B: '狙擊' },
        };
        return (
          <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(0,0,0,.72)' }}>
            <div className="rounded-2xl p-6 text-center w-72 mx-4" style={{ background: '#0d1726', border: '1px solid #a855f755' }}>
              <p className="text-purple-300 font-bold text-base mb-4">✨ 選擇流派</p>
              {(['A', 'B'] as const).map(b => (
                <button key={b} onClick={() => handleSelectBranch(b)}
                  className="w-full mb-2.5 py-3 rounded-xl font-bold text-sm"
                  style={{ background: b==='A'?'#1e3a5f':'#3b1f1f', color: b==='A'?'#93c5fd':'#fca5a5', border: `1px solid ${b==='A'?'#3b82f6':'#ef4444'}44` }}>
                  {b==='A'?'🅰':'🅱'} {BRANCH_NAME[wType]?.[b]} 流
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* 角色預覽區 */}
      <div className="grid grid-cols-2 gap-1.5 p-1.5 pb-1">
        <PlayerPreviewCanvas
          player={p1}
          playerLabel="P1"
          selectedSlotIdx={selectedPlayer === 0 ? selectedSlotIdx : null}
          isActive={selectedPlayer === 0}
          onSlotClick={idx => handleSlotClick(0, idx)}
          onPlayerClick={() => { setSelectedPlayer(0); setSelectedSlotIdx(null); }}
        />
        <PlayerPreviewCanvas
          player={p2}
          playerLabel="P2"
          selectedSlotIdx={selectedPlayer === 1 ? selectedSlotIdx : null}
          isActive={selectedPlayer === 1}
          onSlotClick={idx => handleSlotClick(1, idx)}
          onPlayerClick={() => { setSelectedPlayer(1); setSelectedSlotIdx(null); }}
        />
      </div>

      {/* P1 / P2 準備按鈕 */}
      <div className="grid grid-cols-2 gap-1.5 px-1.5 pb-2">
        <button onClick={onP1Ready} disabled={p1Ready}
          className="py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all active:scale-95"
          style={{
            background: p1Ready ? '#14532d' : `${p1.color}22`,
            color: p1Ready ? '#86efac' : p1.color,
            border: `1px solid ${p1Ready ? '#166534' : p1.color + '44'}`,
          }}>
          {p1Ready ? '✓ P1 準備好' : 'P1 準備好了'}
        </button>
        <button onClick={onP2Ready} disabled={p2Ready}
          className="py-2.5 rounded-xl text-sm font-bold tracking-wide transition-all active:scale-95"
          style={{
            background: p2Ready ? '#14532d' : `${p2.color}22`,
            color: p2Ready ? '#86efac' : p2.color,
            border: `1px solid ${p2Ready ? '#166534' : p2.color + '44'}`,
          }}>
          {p2Ready ? '✓ P2 準備好' : 'P2 準備好了'}
        </button>
      </div>
    </>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  // 使用 ShopPanel 模組：
  // - 傳入當前操作玩家
  // - statPointsOverride: 使用雙人共享點數
  // - onStatUpgradeOverride: 雙人共享升級邏輯
  // - hideInventory: 武器欄由底部 CharacterPreview 呈現，不需要內建格子
  // - customFooter: 注入角色預覽 + 準備按鈕
  return (
    <div className="absolute inset-0 overflow-hidden relative">
      <ShopPanel
        key={`mgmt-p${selectedPlayer}`}
        player={activePlayer}
        wave={wave}
        onNextWave={() => {/* 由準備按鈕控制，不直接觸發 */}}
        statPointsOverride={game.sharedStatPoints}
        onStatUpgradeOverride={handleStatUpgradeOverride}
        hideInventory={true}
        cardCount={8}
        customFooter={characterFooter}
      />
    </div>
  );
};
