import fs from 'fs';

const file = 'src/game/entities/definitions/WeaponDefinitions.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Update interface
code = code.replace(
  /drawWeapon\(ctx: CanvasRenderingContext2D, player: Player\): void;/,
  'drawWeapon(ctx: CanvasRenderingContext2D, player: Player, slot?: import(\'../../Player\').WeaponSlot): void;'
);

// 2. Update inline drawWeapon to accept slot
code = code.replace(/drawWeapon\(ctx, player\)\s*{/g, 'drawWeapon(ctx, player, slot) {');

// 3. Pass slot to _drawMissileLauncher and _drawThreeClawArcGun 
code = code.replace(/_drawMissileLauncher\(ctx, player\);/g, '_drawMissileLauncher(ctx, player, slot);');
code = code.replace(/_drawThreeClawArcGun\(ctx, player, (\d+)\);/g, '_drawThreeClawArcGun(ctx, player, $1, slot);');

// 4. Update the helper definition signatures
code = code.replace(/function _drawThreeClawArcGun\(ctx: CanvasRenderingContext2D, player: Player, level: number\): void {/, 'function _drawThreeClawArcGun(ctx: CanvasRenderingContext2D, player: Player, level: number, slot?: import(\'../../Player\').WeaponSlot): void {');

// 5. Globally update drawMuzzleFlash calls within the file to use slot?.lastAttackTime
code = code.replace(/drawMuzzleFlash\(([^,]+),\s*([^,]+),\s*([^,]+),\s*player\.lastAttackTime\)/g, 'drawMuzzleFlash($1, $2, $3, slot?.lastAttackTime ?? player.lastAttackTime)');

fs.writeFileSync(file, code);
console.log('WeaponDefinitions patched successfully.');
