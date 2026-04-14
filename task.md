# Arena Overhaul & Smooth Transitions Task List

- [x] `WaveManager.ts`: Refactor `WAVES` array to include objectives, fixed timers, and spawn multipliers.
- [x] `WaveManager.ts`: Add `isTransitioning` and `transitionTimer` to handle smooth wave ends.
- [x] `Game.ts`: Update logic to spawn Tombstones in W5 (3x) and W6-W8 (1x) at random safe spots.
- [x] `Game.ts`: Update logic to spawn Butcher Boss in W10 with massively scaled HP.
- [x] `Game.ts`: Track objective completion (Tombstones destroyed, Boss defeated) to end W5 and W10.
- [x] `Game.ts`: Implement smooth transition: Slow-motion kill-all when a wave ends, waiting 2 seconds before the shop instantly appears.
- [x] `Game.ts`: Handle "Victory" on W10 boss kill (Call `onGameOver` after slow-mo victory sequence finishes).
