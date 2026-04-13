import React, { useEffect, useRef } from 'react';
import { WEAPON_REGISTRY, getWeaponKey } from '../../game/entities/definitions/WeaponDefinitions';

const makeMockPlayer = (
  type: 'sword' | 'gun',
  level: number,
  branch: 'A' | 'B' | null,
) => ({
  lastAttackTime: -9_999_999,
  disableWeaponGlow: true,
  isPreview: true, // keep sword at neutral pose so handle stays inward and tip points outward
  weapon: type,
  weaponLevels: {
    sword: type === 'sword' ? level : 1,
    gun: type === 'gun' ? level : 1,
  },
  weaponBranches: {
    sword: type === 'sword' ? branch : null,
    gun: type === 'gun' ? branch : null,
  },
}) as any;

const makeMockSlot = (
  type: 'sword' | 'gun',
  level: number,
  branch: 'A' | 'B' | null,
) => ({
  id: 'showcase',
  type,
  level,
  branch,
  lastAttackTime: -9_999_999,
  aimAngle: 0,
} as any);

const WEAPONS = [
  { type: 'sword' as const, level: 4, branch: null as null, orbitOff: 0, dist: 95, scale: 1.25 },
  { type: 'gun' as const, level: 1, branch: null as null, orbitOff: Math.PI / 2, dist: 95, scale: 1.25 },
  { type: 'gun' as const, level: 5, branch: 'A' as const, orbitOff: Math.PI, dist: 95, scale: 1.25 },
  { type: 'sword' as const, level: 6, branch: 'B' as const, orbitOff: (Math.PI * 3) / 2, dist: 95, scale: 1.25 },
];

interface Props {
  playerColor?: string;
}

export const CharacterShowcase: React.FC<Props> = ({ playerColor = '#4fc3f7' }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const W = canvas.width;
    const H = canvas.height;
    const cx = W * 0.5;
    const cy = H * 0.48;

    const particles = Array.from({ length: 26 }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.6 + 0.4,
      vx: (Math.random() - 0.5) * 0.15,
      vy: -(Math.random() * 0.42 + 0.14),
      alpha: Math.random() * 0.28 + 0.05,
      life: Math.random(),
    }));

    let lastNow = 0;

    const draw = (now: number) => {
      const dt = Math.min(now - (lastNow || now), 50);
      lastNow = now;
      const t = now * 0.001;

      ctx.clearRect(0, 0, W, H);

      ctx.fillStyle = '#141210';
      ctx.fillRect(0, 0, W, H);

      const atmo = ctx.createRadialGradient(cx * 0.85, cy, 0, cx * 0.85, cy, W * 0.85);
      atmo.addColorStop(0, 'rgba(160, 22, 22, 0.28)');
      atmo.addColorStop(0.35, 'rgba(110, 14, 14, 0.14)');
      atmo.addColorStop(0.7, 'rgba(60, 8, 8, 0.06)');
      atmo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = atmo;
      ctx.fillRect(0, 0, W, H);

      const btm = ctx.createLinearGradient(0, H * 0.62, 0, H);
      btm.addColorStop(0, 'rgba(0,0,0,0)');
      btm.addColorStop(1, '#141210');
      ctx.fillStyle = btm;
      ctx.fillRect(0, H * 0.62, W, H * 0.38);

      particles.forEach(p => {
        p.x += p.vx * (dt / 16);
        p.y += p.vy * (dt / 16);
        p.life += 0.002 * (dt / 16);
        if (p.y < -8 || p.life > 1) {
          p.y = H + 6;
          p.x = cx * 0.15 + Math.random() * cx * 1.7;
          p.life = 0;
          p.alpha = Math.random() * 0.28 + 0.05;
        }
        const fade = p.alpha * (1 - Math.abs(p.life - 0.5) * 2);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(240,100,60,${fade})`;
        ctx.fill();
      });

      for (let i = 0; i < 3; i++) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 1.05 + i * 1.2);
        ctx.beginPath();
        ctx.arc(cx, cy, 62 + i * 20 + pulse * 6, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(79,195,247,${(0.08 - i * 0.02) * pulse})`;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }

      WEAPONS.forEach(w => {
        const key = getWeaponKey(w.type, w.level, w.branch);
        const def = WEAPON_REGISTRY[w.type]?.[key as any];
        if (!def) return;

        const angle = t * 0.36 + w.orbitOff;
        const wx = cx + Math.cos(angle) * w.dist;
        const wy = cy + Math.sin(angle) * w.dist;
        const mockSlot = makeMockSlot(w.type, w.level, w.branch);
        const mockPlayer = makeMockPlayer(w.type, w.level, w.branch);

        ctx.save();
        ctx.translate(wx, wy);
        ctx.rotate(angle);
        ctx.scale(w.scale, w.scale);
        try {
          def.drawWeapon(ctx, mockPlayer, mockSlot);
        } catch {
          // ignore preview draw failures
        }
        ctx.restore();
      });

      const outerG = ctx.createRadialGradient(cx, cy, 30, cx, cy, 110);
      outerG.addColorStop(0, `${playerColor}22`);
      outerG.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = outerG;
      ctx.beginPath();
      ctx.arc(cx, cy, 110, 0, Math.PI * 2);
      ctx.fill();

      ctx.shadowColor = playerColor;
      ctx.shadowBlur = 36;
      const bodyG = ctx.createRadialGradient(cx - 10, cy - 12, 0, cx, cy, 50);
      bodyG.addColorStop(0, '#ffffff');
      bodyG.addColorStop(0.25, playerColor);
      bodyG.addColorStop(1, `${playerColor}55`);
      ctx.fillStyle = bodyG;
      ctx.beginPath();
      ctx.arc(cx, cy, 46, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      const pulse = 0.5 + 0.5 * Math.sin(t * 1.5);
      ctx.strokeStyle = `rgba(255,255,255,${0.12 + pulse * 0.16})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(cx, cy, 48 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [playerColor]);

  return (
    <canvas
      ref={canvasRef}
      width={560}
      height={700}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
};
