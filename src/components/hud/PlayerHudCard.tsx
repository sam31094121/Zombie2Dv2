import React from 'react';
import { Player } from '../../game/Player';
import { AnimatedHudBar, HudBarEffectStyles } from './AnimatedHudBar';

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

  return (
    <div
      className={`absolute top-4 w-[250px] sm:w-[350px] select-none pointer-events-none drop-shadow-[0_2px_6px_rgba(0,0,0,0.85)] ${isRight ? 'right-4 text-right' : 'left-4'}`}
    >
      <HudBarEffectStyles />

      <div className={`flex items-center mb-1 gap-2 ${isRight ? 'justify-end' : ''}`}>
        {!isRight && (
          <div
            className="font-black text-base sm:text-2xl tracking-tighter italic"
            style={{ color: accentColor }}
          >
            {label}
          </div>
        )}

        <div
          className="px-2 py-1 rounded text-xs sm:text-base font-bold border"
          style={{
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
            className="font-black text-base sm:text-2xl tracking-tighter italic"
            style={{ color: accentColor }}
          >
            {label}
          </div>
        )}
      </div>

      {respawnCountdown > 0 ? (
        <div className={`w-full h-4 rounded-sm mb-1 flex items-center ${isRight ? 'justify-end' : 'justify-start'}`}>
          <span className="text-xs font-bold text-red-500 animate-pulse">
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
      />
    </div>
  );
};
