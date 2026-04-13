import React from 'react';
import { Player } from '../../game/Player';
import { AnimatedHudBar, HudBarEffectStyles } from './AnimatedHudBar';
import { useHudLayout } from './hudLayout';

interface PlayerHudCardProps {
  player: Player;
  respawnCountdown: number;
  side: 'left' | 'right';
  label: string;
  accentColor: string;
  levelBadgeColor: string;
}

export const PlayerHudCard: React.FC<PlayerHudCardProps> = ({
  player,
  respawnCountdown,
  side,
  label,
  accentColor,
  levelBadgeColor,
}) => {
  const isRight = side === 'right';
  const layout = useHudLayout();

  return (
    <div
      className={`absolute select-none pointer-events-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] ${isRight ? 'text-right' : ''}`}
      style={{
        top: layout.topOffset,
        width: layout.cardWidth,
        [isRight ? 'right' : 'left']: layout.sideOffset,
      }}
    >
      <HudBarEffectStyles />

      <div
        className={`flex items-center ${isRight ? 'justify-end' : ''}`}
        style={{ marginBottom: layout.headerMarginBottom, gap: layout.headerGap }}
      >
        {!isRight && (
          <div
            className="font-black tracking-tighter italic"
            style={{ color: accentColor, fontSize: layout.labelFontSize, lineHeight: 1 }}
          >
            {label}
          </div>
        )}

        <div
          className="rounded font-bold border"
          style={{
            fontSize: layout.badgeFontSize,
            lineHeight: 1,
            padding: `${layout.badgePaddingY}px ${layout.badgePaddingX}px`,
            color: '#ffffff',
            background: levelBadgeColor,
            borderColor: `${accentColor}44`,
          }}
        >
          Lv.{player.level}
          {player.prestigeLevel > 0 ? ` (+${player.prestigeLevel})` : ''}
        </div>

        {isRight && (
          <div
            className="font-black tracking-tighter italic"
            style={{ color: accentColor, fontSize: layout.labelFontSize, lineHeight: 1 }}
          >
            {label}
          </div>
        )}
      </div>

      {respawnCountdown > 0 ? (
        <div
          className={`w-full rounded-sm flex items-center ${isRight ? 'justify-end' : 'justify-start'}`}
          style={{ height: layout.respawnHeight, marginBottom: layout.respawnMarginBottom }}
        >
          <span
            className="font-bold text-red-500"
            style={{ fontSize: layout.respawnFontSize, lineHeight: 1 }}
          >
            RESPAWNING: {respawnCountdown}s
          </span>
        </div>
      ) : (
        <AnimatedHudBar
          label="HP"
          value={player.hp}
          max={player.maxHp}
          valueText={`${Math.ceil(player.hp)} / ${player.maxHp}`}
          variant="hp"
          side={side}
          layout={layout}
        />
      )}

      <AnimatedHudBar
        label="XP"
        value={player.level === 5 ? player.maxXp : player.xp}
        max={player.level === 5 ? Math.max(1, player.maxXp) : Math.max(1, player.maxXp)}
        valueText={player.level === 5 ? 'MAX' : `${player.xp}/${player.maxXp}`}
        variant="xp"
        side={side}
        compact
        layout={layout}
      />
    </div>
  );
};
