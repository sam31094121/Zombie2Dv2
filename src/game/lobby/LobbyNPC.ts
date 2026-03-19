// ── LobbyNPC.ts ───────────────────────────────────────────────────────────────
export type NPCType = 'portal' | 'blacksmith' | 'merchant' | 'gacha' | 'questboard';

export interface LobbyNPC {
  id: NPCType;
  x: number;
  y: number;
  label: string;
  emoji: string;
  color: string;
  interactRadius: number;   // 進入此半徑開始計時
  interactDuration: number; // ms，圓圈填滿需要的時間
  progress: number;         // 0~1，填滿後觸發
}

export const LOBBY_NPCS: LobbyNPC[] = [
  { id: 'portal',     x: 400, y: 520, label: '傳送門',  emoji: '🌀', color: '#00e5ff', interactRadius: 70, interactDuration: 3000, progress: 0 },
  { id: 'blacksmith', x: 160, y: 340, label: '鐵匠',    emoji: '⚒️', color: '#ff8a65', interactRadius: 65, interactDuration: 3000, progress: 0 },
  { id: 'merchant',   x: 640, y: 340, label: '商人',    emoji: '💰', color: '#aed581', interactRadius: 65, interactDuration: 3000, progress: 0 },
  { id: 'gacha',      x: 640, y: 160, label: '抽獎機',  emoji: '🎰', color: '#ce93d8', interactRadius: 65, interactDuration: 3000, progress: 0 },
  { id: 'questboard', x: 160, y: 160, label: '任務板',  emoji: '🗿', color: '#90a4ae', interactRadius: 65, interactDuration: 3000, progress: 0 },
];
