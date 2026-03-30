import React from 'react';
import { useAnimatedBarState } from './useAnimatedBarState';
import { HudLayout } from './hudLayout';

const HUD_BAR_EFFECT_STYLES = `
  @keyframes hudWaveForward {
    0% { transform: translateX(-55%) skewX(-16deg); opacity: 0.0; }
    12% { opacity: 0.85; }
    100% { transform: translateX(65%) skewX(-16deg); opacity: 0.0; }
  }
  @keyframes hudXpForward {
    0% { transform: translateX(-70%) skewX(-20deg); opacity: 0.0; }
    14% { opacity: 0.92; }
    100% { transform: translateX(80%) skewX(-20deg); opacity: 0.0; }
  }
  @keyframes hudPixelFall {
    0% { transform: translateY(0) scale(1); opacity: 1; }
    100% { transform: translateY(14px) scale(0.9); opacity: 0; }
  }
`;

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

export const HudBarEffectStyles: React.FC = () => <style>{HUD_BAR_EFFECT_STYLES}</style>;

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
  const { mainRatio, lagRatio, mode, pulseKey, intensity } = useAnimatedBarState({
    value,
    max,
    variant,
  });

  const mainPercent = Math.max(0, Math.min(100, mainRatio * 100));
  const lagPercent = Math.max(mainPercent, Math.min(100, lagRatio * 100));
  const lostPercent = Math.max(0, lagPercent - mainPercent);
  const isDamage = mode === 'damage';
  const isHeal = mode === 'heal';
  const isXpGain = mode === 'xp_gain';
  const height = compact ? layout?.xpHeight ?? 10 : layout?.hpHeight ?? 18;
  const accent = variant === 'hp' ? '#ff525f' : '#65d9ff';
  const baseFill =
    variant === 'hp'
      ? 'linear-gradient(90deg, rgba(115,10,18,0.92) 0%, rgba(203,31,48,0.96) 52%, rgba(255,92,92,0.98) 100%)'
      : 'linear-gradient(90deg, rgba(34,55,146,0.96) 0%, rgba(26,145,245,0.98) 54%, rgba(134,247,255,0.98) 100%)';

  const trackTexture = 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(0,0,0,0.55))';

  const fillStyle: React.CSSProperties = mirror
    ? { right: 0, width: `${mainPercent}%` }
    : { left: 0, width: `${mainPercent}%` };

  const lagStyle: React.CSSProperties = mirror
    ? { right: `${mainPercent}%`, width: `${lostPercent}%` }
    : { left: `${mainPercent}%`, width: `${lostPercent}%` };

  const capStyle: React.CSSProperties = mirror
    ? { right: `calc(${mainPercent}% - 12px)` }
    : { left: `calc(${mainPercent}% - 12px)` };

  const sweepBaseStyle: React.CSSProperties = mirror
    ? { right: '-8%', transformOrigin: 'right center' }
    : { left: '-8%', transformOrigin: 'left center' };

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
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px rgba(0,0,0,0.24), 0 0 18px ${accent}18`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: trackTexture,
            opacity: 0.92,
          }}
        />

        {isDamage && lostPercent > 0.15 && (
          <div
            key={`damage-${pulseKey}`}
            className="absolute top-0 bottom-0 overflow-hidden"
            style={{
              ...lagStyle,
              background: 'rgba(120, 10, 18, 0.42)',
              boxShadow: 'inset 0 0 0 1px rgba(255,70,90,0.12)',
            }}
          />
        )}

        <div
          className="absolute top-0 bottom-0 overflow-hidden"
          style={{
            ...fillStyle,
            transition: `width ${variant === 'xp' ? 360 : isHeal ? 520 : 110}ms cubic-bezier(.22,.9,.26,1)`,
            background: baseFill,
            boxShadow:
              variant === 'hp'
                ? 'inset 0 1px 0 rgba(255,240,240,0.35), 0 0 18px rgba(255,72,88,0.28)'
                : 'inset 0 1px 0 rgba(255,255,255,0.28), 0 0 18px rgba(87,208,255,0.26)',
          }}
        >
          {(isHeal || isXpGain) && (
            <div
              className="absolute inset-0"
              style={{
                background:
                  variant === 'hp'
                    ? 'linear-gradient(180deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03) 45%, rgba(40,0,0,0.12) 100%)'
                    : 'linear-gradient(180deg, rgba(255,255,255,0.2), rgba(255,255,255,0.04) 42%, rgba(0,24,80,0.2) 100%)',
                mixBlendMode: 'screen',
                opacity: 0.38,
              }}
            />
          )}

          {isHeal && (
            <div
              key={`heal-${pulseKey}`}
              className="absolute inset-y-[-35%] w-[34%]"
              style={{
                ...sweepBaseStyle,
                background:
                  'linear-gradient(90deg, rgba(120,255,188,0) 0%, rgba(166,255,213,0.14) 24%, rgba(235,255,245,0.82) 50%, rgba(148,255,204,0.14) 76%, rgba(120,255,188,0) 100%)',
                animation: `hudWaveForward ${440 + intensity * 160}ms ease-out`,
                filter: 'blur(0.4px)',
              }}
            />
          )}

          {isXpGain && (
            <div
              key={`xp-${pulseKey}`}
              className="absolute inset-y-[-50%] w-[42%]"
              style={{
                ...sweepBaseStyle,
                background:
                  'linear-gradient(90deg, rgba(88,244,255,0) 0%, rgba(130,227,255,0.16) 18%, rgba(255,255,255,0.95) 50%, rgba(144,252,255,0.2) 80%, rgba(88,244,255,0) 100%)',
                animation: `hudXpForward ${620 + intensity * 260}ms cubic-bezier(.18,.8,.26,1)`,
                filter: 'blur(0.2px)',
              }}
            />
          )}
        </div>

        {isDamage && lostPercent > 0.15 && (
          <div
            key={`pixels-${pulseKey}`}
            className="absolute top-0 bottom-0 pointer-events-none"
            style={{
              ...lagStyle,
              overflow: 'visible',
            }}
          >
            {Array.from({ length: 16 }).map((_, i) => {
              const h = (n: number) => {
                const v = Math.sin((pulseKey + 1) * 133.7 + n * 91.3) * 43758.5453;
                return v - Math.floor(v);
              };
              const rx = h(i) * 100;
              const ry = h(i + 17) * 100;
              const delay = h(i + 29) * 160;
              const fall = 420 + h(i + 47) * 260;
              const pxSize = i % 3 === 0 ? 3 : 2;
              const shade = 180 + Math.floor(h(i + 71) * 70);
              const alpha = 0.92 - h(i + 83) * 0.35;
              const leftOrRight = mirror ? 'right' : 'left';
              return (
                <span
                  key={i}
                  style={{
                    position: 'absolute',
                    top: `${ry}%`,
                    [leftOrRight]: `${rx}%`,
                    width: pxSize,
                    height: pxSize,
                    background: `rgba(${shade}, ${40 + Math.floor(h(i + 3) * 30)}, ${40 + Math.floor(h(i + 5) * 30)}, ${alpha})`,
                    boxShadow: `0 0 0 1px rgba(0,0,0,0.12)`,
                    animation: `hudPixelFall ${fall}ms ease-in`,
                    animationDelay: `${delay}ms`,
                  } as React.CSSProperties}
                />
              );
            })}
          </div>
        )}

        {mainPercent > 0.5 && isXpGain && (
          <div
            key={`xp-cap-${pulseKey}`}
            className="absolute top-1/2 h-[155%] w-7 -translate-y-1/2"
            style={{
              ...capStyle,
              background:
                'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(198,252,255,0.76) 26%, rgba(255,255,255,0.98) 52%, rgba(81,218,255,0.78) 76%, rgba(255,255,255,0) 100%)',
              filter: 'blur(0.25px)',
              opacity: 0.92,
            }}
          />
        )}

      </div>
    </div>
  );
};
