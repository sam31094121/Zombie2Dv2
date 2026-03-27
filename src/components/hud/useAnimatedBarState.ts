import { useEffect, useRef, useState } from 'react';

type BarMode = 'idle' | 'damage' | 'heal' | 'xp_gain';

interface UseAnimatedBarStateArgs {
  value: number;
  max: number;
  variant: 'hp' | 'xp';
}

interface AnimatedBarState {
  mainRatio: number;
  lagRatio: number;
  mode: BarMode;
  pulseKey: number;
  intensity: number;
  levelUpFlashKey: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function useAnimatedBarState({
  value,
  max,
  variant,
}: UseAnimatedBarStateArgs): AnimatedBarState {
  const targetRatio = clamp01(max > 0 ? value / max : 0);
  const [mainRatio, setMainRatio] = useState(targetRatio);
  const [lagRatio, setLagRatio] = useState(targetRatio);
  const [mode, setMode] = useState<BarMode>('idle');
  const [pulseKey, setPulseKey] = useState(0);
  const [levelUpFlashKey, setLevelUpFlashKey] = useState(0);
  const [intensity, setIntensity] = useState(0);

  const didMountRef = useRef(false);
  const previousRatioRef = useRef(targetRatio);
  const previousValueRef = useRef(value);
  const previousMaxRef = useRef(max);
  const timeoutIdsRef = useRef<number[]>([]);
  const frameIdRef = useRef<number | null>(null);

  const clearScheduledWork = () => {
    for (const timeoutId of timeoutIdsRef.current) {
      window.clearTimeout(timeoutId);
    }
    timeoutIdsRef.current = [];
    if (frameIdRef.current !== null) {
      window.cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = null;
    }
  };

  useEffect(() => () => clearScheduledWork(), []);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      previousRatioRef.current = targetRatio;
      previousValueRef.current = value;
      previousMaxRef.current = max;
      setMainRatio(targetRatio);
      setLagRatio(targetRatio);
      return;
    }

    clearScheduledWork();

    const previousRatio = previousRatioRef.current;
    const previousValue = previousValueRef.current;
    const previousMax = previousMaxRef.current;
    const ratioDelta = targetRatio - previousRatio;
    const xpLeveledUp =
      variant === 'xp' &&
      max !== previousMax &&
      value <= previousValue;

    if (Math.abs(ratioDelta) < 0.001 && !xpLeveledUp) {
      previousRatioRef.current = targetRatio;
      previousValueRef.current = value;
      previousMaxRef.current = max;
      setMainRatio(targetRatio);
      setLagRatio(targetRatio);
      return;
    }

    setPulseKey(prev => prev + 1);
    setIntensity(Math.min(1, Math.abs(ratioDelta) * 3.4 + 0.18));

    if (xpLeveledUp) {
      setMode('xp_gain');
      setLevelUpFlashKey(prev => prev + 1);
      setMainRatio(targetRatio);
      setLagRatio(targetRatio);
      timeoutIdsRef.current.push(window.setTimeout(() => setMode('idle'), 950));
    } else if (ratioDelta < 0) {
      setMode('damage');
      setMainRatio(targetRatio);
      setLagRatio(previousRatio);
      timeoutIdsRef.current.push(window.setTimeout(() => setLagRatio(targetRatio), 90));
      timeoutIdsRef.current.push(window.setTimeout(() => setMode('idle'), 820));
    } else {
      setMode(variant === 'xp' ? 'xp_gain' : 'heal');
      setLagRatio(targetRatio);
      setMainRatio(previousRatio);
      frameIdRef.current = window.requestAnimationFrame(() => {
        setMainRatio(targetRatio);
      });
      timeoutIdsRef.current.push(
        window.setTimeout(() => setMode('idle'), variant === 'xp' ? 1050 : targetRatio >= 0.999 ? 520 : 680),
      );
    }

    previousRatioRef.current = targetRatio;
    previousValueRef.current = value;
    previousMaxRef.current = max;
  }, [max, targetRatio, value, variant]);

  return {
    mainRatio,
    lagRatio,
    mode,
    pulseKey,
    intensity,
    levelUpFlashKey,
  };
}
