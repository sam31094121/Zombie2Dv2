const ARENA_VISITED_STORAGE_KEY = 'zombie2d.arenaVisited';

export function hasVisitedArena(): boolean {
  try {
    return window.localStorage.getItem(ARENA_VISITED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markArenaVisited(): void {
  try {
    window.localStorage.setItem(ARENA_VISITED_STORAGE_KEY, 'true');
  } catch {
    // The game remains playable when browser storage is unavailable.
  }
}
