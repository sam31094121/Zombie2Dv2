import type { WeaponSlot } from '../../game/Player';

export const ARENA_BASE_WEAPON_CAP = 4;
export const ARENA_BRANCH_MAX_LEVEL = 8;

type ArenaWeaponLike = Pick<WeaponSlot, 'level' | 'branch'> & {
  investedCost?: number;
};

export function weaponCost(level: number): number {
  return Math.floor(15 * Math.pow(2, level - 1));
}

export function getArenaWeaponInvestedCost(weapon: ArenaWeaponLike): number {
  return weapon.investedCost ?? weaponCost(weapon.level);
}

export function getArenaWeaponSellPrice(weapon: ArenaWeaponLike): number {
  return Math.floor(getArenaWeaponInvestedCost(weapon) * 0.5);
}

export function isArenaWeaponMaxed(weapon: Pick<ArenaWeaponLike, 'level' | 'branch'>): boolean {
  return weapon.branch !== null && weapon.level >= ARENA_BRANCH_MAX_LEVEL;
}

export function formatArenaWeaponLevel(level: number, branch: 'A' | 'B' | null): string {
  return branch !== null && level >= ARENA_BRANCH_MAX_LEVEL ? 'MAX' : `Lv.${level}`;
}

export function canArenaWeaponMerge(weapon: Pick<ArenaWeaponLike, 'level' | 'branch'>): boolean {
  if (weapon.branch !== null) return weapon.level < ARENA_BRANCH_MAX_LEVEL;
  return weapon.level < ARENA_BASE_WEAPON_CAP + 1;
}

export function willArenaWeaponBranchEvolve(weapon: Pick<ArenaWeaponLike, 'level' | 'branch'>): boolean {
  return weapon.branch === null && weapon.level === ARENA_BASE_WEAPON_CAP;
}

export function getArenaWeaponMergePreviewLevel(weapon: Pick<ArenaWeaponLike, 'level' | 'branch'>): number {
  if (willArenaWeaponBranchEvolve(weapon)) return ARENA_BRANCH_MAX_LEVEL;
  return Math.min(ARENA_BRANCH_MAX_LEVEL, weapon.level + 1);
}
