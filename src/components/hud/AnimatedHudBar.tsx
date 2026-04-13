import React from 'react';
import { HudLayout } from './hudLayout';

type HudBarVariant = 'hp' | 'xp';
type HudBarSide = 'left' | 'right';

interface AnimatedHudBarProps {
  label: string;
  value: number;
  max: number;
  valueText: string;
  variant: HudBarVariant;
  side: HudBarSide;
  compact?: boolean;
  layout?: HudLayout;
}

export const HudBarEffectStyles: React.FC = () => null;

export const AnimatedHudBar: React.FC<AnimatedHudBarProps> = ({
  label,
  value,
  max,
  valueText,
  variant,
  side,
  compact = false,
  layout,
}) => {
  const mirror = side === 'right';
  const ratio = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const mainPercent = Math.max(0, Math.min(100, ratio * 100));
  const height = compact ? layout?.xpHeight ?? 10 : layout?.hpHeight ?? 18;
  const baseFill =
    variant === 'hp'
      ? 'linear-gradient(90deg, rgba(115,10,18,0.92) 0%, rgba(203,31,48,0.96) 52%, rgba(255,92,92,0.98) 100%)'
      : 'linear-gradient(90deg, rgba(34,55,146,0.96) 0%, rgba(26,145,245,0.98) 54%, rgba(134,247,255,0.98) 100%)';

  const trackTexture = 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.55))';

  const fillStyle: React.CSSProperties = mirror
    ? { right: 0, width: `${mainPercent}%` }
    : { left: 0, width: `${mainPercent}%` };

  return (
    <div className="w-full" style={{ marginBottom: layout?.barGap ?? 4 }}>
      <div
        className={`flex justify-between items-end ${mirror ? 'flex-row-reverse' : ''}`}
        style={{ marginBottom: Math.max(2, Math.round((layout?.barGap ?? 4) * 0.5)) }}
      >
        <span
          className="font-black"
          style={{
            fontSize: compact
              ? layout?.compactBarLabelFontSize ?? 9
              : layout?.barLabelFontSize ?? 12,
            lineHeight: 1,
            color: variant === 'hp' ? 'rgba(255,245,245,0.92)' : 'rgba(181,239,255,0.9)',
          }}
        >
          {label}
        </span>
        <span
          className="font-bold"
          style={{
            fontSize: compact
              ? layout?.compactBarValueFontSize ?? 9
              : layout?.barValueFontSize ?? 12,
            lineHeight: 1,
            color: variant === 'hp' ? 'rgba(255,245,245,0.9)' : 'rgba(202,242,255,0.86)',
          }}
        >
          {valueText}
        </span>
      </div>

      <div
        className="relative w-full overflow-hidden rounded-md border"
        style={{
          height,
          background: 'rgba(4, 7, 14, 0.74)',
          borderColor: variant === 'hp' ? 'rgba(255,115,115,0.18)' : 'rgba(103,197,255,0.18)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(0,0,0,0.24)',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: trackTexture,
            opacity: 0.92,
          }}
        />

        <div
          className="absolute top-0 bottom-0 overflow-hidden"
          style={{
            ...fillStyle,
            transition: 'width 180ms ease-out',
            background: baseFill,
            boxShadow:
              variant === 'hp'
                ? 'inset 0 1px 0 rgba(255,240,240,0.22)'
                : 'inset 0 1px 0 rgba(255,255,255,0.18)',
          }}
        />
      </div>
    </div>
  );
};
