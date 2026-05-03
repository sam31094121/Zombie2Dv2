import React, { useState, useLayoutEffect } from 'react';
import { Game } from '../../game/Game';
import { audioManager } from '../../game/AudioManager';
import { STAT_REGISTRY } from '../../game/items/StatDefinitions';
import { ShopPanel } from './ShopPanel';
import { PlayerPreviewCanvas } from './PlayerPreviewCanvas';
import {
  ARENA_BRANCH_MAX_LEVEL,
  canArenaWeaponMerge,
  formatArenaWeaponLevel,
  getArenaWeaponInvestedCost,
  getArenaWeaponSellPrice,
  willArenaWeaponBranchEvolve,
} from './arenaWeaponUtils';

interface Props {
  game: Game;
  wave: number;
  onNextWave: () => void;
}

export const ManagementView: React.FC<Props> = ({ game, wave, onNextWave }) => {
  const p1 = game.players[0];
  const p2 = game.players[1];

  const [selectedPlayer, setSelectedPlayer] = useState<0 | 1>(0);
  const [selectedSlotIdx, setSelectedSlotIdx] = useState<number | null>(null);
  const [mergeTarget, setMergeTarget] = useState<{ pi: 0 | 1; keepId: string; removeId: string } | null>(null);
  const [branchTarget, setBranchTarget] = useState<{ pi: 0 | 1; weaponId: string } | null>(null);
  const [, setRenderTick] = useState(0);
  const rerender = () => setRenderTick(n => n + 1);

  const [isLandscape, setIsLandscape] = useState(() => 
    typeof window !== 'undefined' && window.innerWidth > window.innerHeight && window.innerHeight < 600
  );

  useLayoutEffect(() => {
    const h = () => {
      setIsLandscape(window.innerWidth > window.innerHeight && window.innerHeight < 600);
    };
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const handleStatUpgradeOverride = (id: string) => {
    if (game.sharedStatPoints <= 0) return;
    const def = STAT_REGISTRY[id];
    if (!def) return;
    const curLv = p1.statLevels[id] ?? 0;
    if (def.maxLevel !== -1 && curLv >= def.maxLevel) return;

    for (const player of game.players) {
      def.apply(player);
      player.statLevels[id] = curLv + 1;
    }

    game.sharedStatPoints -= 1;
    audioManager.playPickup();
    rerender();
  };

  const handleSlotClick = (pi: 0 | 1, slotIdx: number) => {
    const target = game.players[pi];
    const slot = target.weapons[slotIdx];

    if (selectedPlayer === pi && selectedSlotIdx === slotIdx && slot) {
      const match = canArenaWeaponMerge(slot)
        ? target.weapons.find(other =>
            other.id !== slot.id &&
            other.type === slot.type &&
            other.level === slot.level &&
            other.branch === slot.branch,
          )
        : undefined;

      if (match) {
        setMergeTarget({ pi, keepId: slot.id, removeId: match.id });
      } else {
        const price = getArenaWeaponSellPrice(slot);
        const levelLabel = formatArenaWeaponLevel(slot.level, slot.branch);
        const typeLabel = slot.type === 'sword' ? '劍' : '槍';
        const branchLabel = slot.branch ? ` ${slot.branch}` : '';
        if (window.confirm(`售出 ${levelLabel} ${typeLabel}${branchLabel} → 💰${price}？`)) {
          const idx = target.weapons.findIndex(weapon => weapon.id === slot.id);
          if (idx !== -1) {
            target.weapons.splice(idx, 1);
            target.materials += price;
          }
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
    const keep = target.weapons.find(weapon => weapon.id === mergeTarget.keepId);
    const removeIndex = target.weapons.findIndex(weapon => weapon.id === mergeTarget.removeId);
    if (!keep || removeIndex === -1) {
      setMergeTarget(null);
      return;
    }

    const consumed = target.weapons[removeIndex];
    if (!consumed) {
      setMergeTarget(null);
      return;
    }

    target.weapons.splice(removeIndex, 1);
    keep.investedCost = getArenaWeaponInvestedCost(keep) + getArenaWeaponInvestedCost(consumed);
    keep.lastAttackTime = 0;
    audioManager.playPickup();
    setMergeTarget(null);

    if (willArenaWeaponBranchEvolve(keep)) {
      setBranchTarget({ pi: mergeTarget.pi, weaponId: keep.id });
    } else {
      keep.level = Math.min(ARENA_BRANCH_MAX_LEVEL, keep.level + 1);
      rerender();
    }
  };

  const handleSelectBranch = (branch: 'A' | 'B') => {
    if (!branchTarget) return;

    const weapon = game.players[branchTarget.pi].weapons.find(entry => entry.id === branchTarget.weaponId);
    if (weapon) {
      weapon.branch = branch;
      weapon.level = ARENA_BRANCH_MAX_LEVEL;
    }

    setBranchTarget(null);
    rerender();
  };

  const activePlayer = game.players[selectedPlayer];

  const characterFooter = (
    <>
      {mergeTarget && (
        <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(0,0,0,.72)' }}>
          <div className="rounded-2xl p-6 text-center w-72 mx-4" style={{ background: '#0d1726', border: '1px solid #fbbf2455' }}>
            <p className="text-amber-400 font-bold text-base mb-1">武器合成</p>
            <p className="text-neutral-400 text-xs mb-5">兩把 Lv.4 基礎武器合成後會直接進入流派選擇，完成後立刻升到 MAX。</p>
            <div className="flex gap-3 justify-center">
              <button onClick={handleConfirmMerge} className="flex-1 py-2 rounded-xl text-sm font-bold" style={{ background: '#92400e', color: '#fde68a' }}>合成</button>
              <button onClick={() => setMergeTarget(null)} className="flex-1 py-2 rounded-xl text-sm" style={{ background: '#1e293b', color: '#94a3b8' }}>取消</button>
            </div>
          </div>
        </div>
      )}

      {branchTarget && (() => {
        const weaponType = game.players[branchTarget.pi].weapons.find(weapon => weapon.id === branchTarget.weaponId)?.type ?? 'sword';
        const branchNames: Record<string, Record<'A' | 'B', string>> = {
          sword: { A: '旋風流', B: '閃光流' },
          gun: { A: '燃燒流', B: '狙擊流' },
        };

        return (
          <div className="absolute inset-0 z-40 flex items-center justify-center" style={{ background: 'rgba(0,0,0,.72)' }}>
            <div className="rounded-2xl p-6 text-center w-72 mx-4" style={{ background: '#0d1726', border: '1px solid #a855f755' }}>
              <p className="text-purple-300 font-bold text-base mb-2">選擇流派</p>
              <p className="text-neutral-400 text-xs mb-4">選好流派後，這把合成武器會立刻升到 MAX。</p>
              {(['A', 'B'] as const).map(branch => (
                <button
                  key={branch}
                  onClick={() => handleSelectBranch(branch)}
                  className="w-full mb-2.5 py-3 rounded-xl font-bold text-sm"
                  style={{
                    background: branch === 'A' ? '#1e3a5f' : '#3b1f1f',
                    color: branch === 'A' ? '#93c5fd' : '#fca5a5',
                    border: `1px solid ${branch === 'A' ? '#3b82f6' : '#ef4444'}44`,
                  }}
                >
                  {branch} {branchNames[weaponType]?.[branch]}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      <div className={`grid ${isLandscape ? 'grid-cols-1' : 'grid-cols-2'} gap-1.5 p-1.5 pb-1`}>
        <PlayerPreviewCanvas
          player={p1}
          playerLabel="P1"
          selectedSlotIdx={selectedPlayer === 0 ? selectedSlotIdx : null}
          isActive={selectedPlayer === 0}
          onSlotClick={idx => handleSlotClick(0, idx)}
          onPlayerClick={() => {
            setSelectedPlayer(0);
            setSelectedSlotIdx(null);
          }}
        />
        <PlayerPreviewCanvas
          player={p2}
          playerLabel="P2"
          selectedSlotIdx={selectedPlayer === 1 ? selectedSlotIdx : null}
          isActive={selectedPlayer === 1}
          onSlotClick={idx => handleSlotClick(1, idx)}
          onPlayerClick={() => {
            setSelectedPlayer(1);
            setSelectedSlotIdx(null);
          }}
        />
      </div>
    </>
  );

  return (
    <div className="w-full h-full">
      <ShopPanel
        key={`mgmt-p${selectedPlayer}`}
        player={activePlayer}
        wave={wave}
        onNextWave={onNextWave}
        statPointsOverride={game.sharedStatPoints}
        onStatUpgradeOverride={handleStatUpgradeOverride}
        hideInventory={true}
        cardCount={8}
        customFooter={characterFooter}
      />
    </div>
  );
};
