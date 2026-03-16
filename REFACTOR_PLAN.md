# Zombie2Dv2 重構計劃書

> 目標：將現有「大神類」架構重構為符合 SOLID 原則的模組化設計
> 原則：低耦合、高內聚、透過擴充而非修改來新增功能

---

## 一、現況問題分析

### 違反 SRP 的嚴重程度

| 檔案 | 行數 | 嚴重度 | 主要問題 |
|------|------|--------|---------|
| `Game.ts` | 1,825 | 🔴 嚴重 | 同時負責：物理、碰撞、渲染、網路同步、輸入、音效、UI回調、特效 |
| `GameUI.tsx` | 603 | 🔴 嚴重 | 混合：React UI、遊戲生命週期、網路初始化、HUD、Canvas迴圈 |
| `server.ts` | 308 | 🟡 中等 | 混合：HTTP、WebSocket協議、房間管理、遊戲邏輯、復活/重賽 |
| `Player.ts` | 481 | 🟡 中等 | 遊戲邏輯 + 渲染（320行 draw() 含5級武器圖形）混在一起 |
| `NetworkManager.ts` | 107 | 🟢 輕微 | 傳輸層與事件派發輕度混合 |

---

## 二、目標架構

### 客戶端模組圖

```
src/
├── game/
│   ├── core/
│   │   ├── Game.ts                  ← 只做協調，委派給子系統
│   │   ├── EntityManager.ts         ← [新] 實體生命週期（新增/移除玩家、殭屍、子彈、道具）
│   │   ├── CollisionSystem.ts       ← [新] 所有碰撞檢測邏輯
│   │   └── AimController.ts         ← [新] 自動瞄準計算
│   │
│   ├── network/
│   │   ├── NetworkManager.ts        ← [精簡] 只負責 WebSocket 傳輸
│   │   ├── NetworkSyncManager.ts    ← [新] applyNetworkState、Lerp插值、預測
│   │   └── InputBuffer.ts           ← [新] 環形緩衝區、TickID、每幀送出邏輯
│   │
│   ├── rendering/
│   │   ├── GameRenderer.ts          ← [新] 統籌所有繪製
│   │   ├── PlayerRenderer.ts        ← [新] 玩家與武器圖形（從 Player.ts 抽出）
│   │   └── EffectRenderer.ts        ← [新] HitEffect、HealVFX、波次濾鏡
│   │
│   ├── controllers/
│   │   └── CameraController.ts      ← [新] 攝影機跟隨邏輯（本地/死亡/遠端）
│   │
│   ├── Player.ts                    ← [精簡] 只保留遊戲邏輯（移動、升級、狀態）
│   ├── Zombie.ts                    ← 維持現狀
│   ├── Projectile.ts                ← 維持現狀
│   ├── Item.ts                      ← 維持現狀
│   ├── WaveManager.ts               ← 維持現狀
│   ├── AudioManager.ts              ← 維持現狀
│   └── Constants.ts                 ← 維持現狀
│
└── components/
    ├── GameUI.tsx                   ← [精簡] 只負責狀態路由與組合子元件
    ├── GameCanvas.tsx               ← [新] Canvas + rAF 遊戲迴圈
    ├── GameLobby.tsx                ← [新] 線上大廳（建立/加入房間）
    ├── GameHUD.tsx                  ← [新] 血條、波次、分數 HUD
    ├── GameOverScreen.tsx           ← [新] 結束畫面 + 重賽按鈕
    ├── RespawnOverlay.tsx           ← [新] 復活倒計時遮罩
    └── hooks/
        ├── useGameLoop.ts           ← [新] rAF + dt 計算 hook
        ├── useOnlineGame.ts         ← [新] 線上遊戲初始化 + 回調設置 hook
        ├── useLocalGame.ts          ← [新] 本地遊戲初始化 hook
        └── useResponsiveCanvas.ts   ← [新] 視窗縮放處理 hook
```

### 伺服器端模組圖

```
server/
├── server.ts                        ← [精簡] 只做 HTTP + WebSocket 進入點
├── transport/
│   ├── WebSocketHandler.ts          ← [新] WS 連線生命週期、訊息路由
│   └── InputDecoder.ts              ← [新] Binary 封包解碼（6-byte 格式）
├── rooms/
│   ├── RoomManager.ts               ← [新] 房間建立/加入/刪除
│   └── GameOrchestrator.ts          ← [新] startRoom、stopRoom、60Hz 主迴圈
├── game/
│   ├── RespawnManager.ts            ← [新] 死亡偵測、10秒計時、重生位置計算
│   └── RematchManager.ts            ← [新] readyStates、兩人都準備則重開
└── protocol/
    └── StateSerializer.ts           ← [新] serializeState（壓縮鍵名）
```

---

## 三、執行階段計劃（由低風險到高風險）

### Phase 1 — 伺服器重構（風險：低）
> 不影響客戶端，純後端拆分

**要做的事：**
1. 建立 `server/protocol/StateSerializer.ts` — 搬移 `serializeState()`
2. 建立 `server/game/RespawnManager.ts` — 搬移復活計時/重生邏輯
3. 建立 `server/game/RematchManager.ts` — 搬移 readyStates 邏輯
4. 建立 `server/rooms/RoomManager.ts` — 搬移房間建立/加入/刪除
5. 建立 `server/rooms/GameOrchestrator.ts` — 搬移 startRoom/stopRoom
6. 建立 `server/transport/InputDecoder.ts` — 搬移 binary 解碼
7. `server.ts` 精簡為只做 HTTP + WS 進入點並組合以上模組

**驗收標準：** `npx tsc --noEmit` 零錯誤，遊戲功能不變

---

### Phase 2 — 客戶端網路層重構（風險：低-中）
> 從 Game.ts 抽出網路相關邏輯

**要做的事：**
1. 建立 `src/game/network/InputBuffer.ts` — 環形緩衝區、localTick、每幀送出
2. 建立 `src/game/network/NetworkSyncManager.ts` — 搬移 `applyNetworkState()`、Lerp插值、HardSync
3. 建立 `src/game/controllers/CameraController.ts` — 攝影機跟隨（存活/死亡/遠端）
4. `Game.ts` 改為持有這些子模組的參考，並委派呼叫

**驗收標準：** 網路模式功能完整，包含復活鏡頭跟隨

---

### Phase 3 — 客戶端渲染層重構（風險：中）
> 渲染與邏輯分離

**要做的事：**
1. 建立 `src/game/rendering/EffectRenderer.ts` — 搬移所有 hitEffects 繪製、HealVFX、波次濾鏡
2. 建立 `src/game/rendering/PlayerRenderer.ts` — 搬移 `Player.draw()` 的全部內容
3. 建立 `src/game/rendering/GameRenderer.ts` — 統籌呼叫各渲染器
4. `Player.ts` 的 `draw()` 改為呼叫 `PlayerRenderer`
5. `Game.ts` 的 `draw()` 改為只呼叫 `GameRenderer.render()`

**驗收標準：** 畫面輸出與重構前完全一致

---

### Phase 4 — React 元件拆分（風險：中）
> GameUI.tsx 拆成有明確職責的子元件

**要做的事：**
1. 建立 `src/components/hooks/useResponsiveCanvas.ts`
2. 建立 `src/components/hooks/useGameLoop.ts`
3. 建立 `src/components/hooks/useLocalGame.ts`
4. 建立 `src/components/hooks/useOnlineGame.ts`
5. 建立 `src/components/GameCanvas.tsx`
6. 建立 `src/components/GameLobby.tsx`
7. 建立 `src/components/GameHUD.tsx`
8. 建立 `src/components/GameOverScreen.tsx`
9. 建立 `src/components/RespawnOverlay.tsx`
10. `GameUI.tsx` 精簡為只組合以上元件（目標 < 100 行）

**驗收標準：** UI 外觀與行為完全不變，GameUI.tsx < 100 行

---

### Phase 5 — Game.ts 核心邏輯拆分（風險：高，最後執行）
> 拆解「God Class」的最後堡壘

**要做的事：**
1. 建立 `src/game/core/CollisionSystem.ts` — 所有碰撞偵測（玩家/殭屍/子彈/道具/障礙物）
2. 建立 `src/game/core/AimController.ts` — 自動瞄準計算
3. 建立 `src/game/core/EntityManager.ts` — 實體新增/移除/查詢
4. `Game.ts` update() 精簡為協調呼叫（目標 < 100 行）

**驗收標準：** `Game.ts` 行數 < 200 行，功能完整

---

## 四、不動的部分

以下檔案職責清晰，**維持現狀，不納入本次重構：**
- `Zombie.ts` — 殭屍邏輯已獨立
- `Projectile.ts` — 子彈邏輯已獨立
- `Item.ts` — 道具邏輯已獨立
- `WaveManager.ts` — 波次管理已獨立
- `AudioManager.ts` — 音效管理已獨立
- `Constants.ts` — 常數定義
- `map/` 目錄 — 地圖系統已模組化
- `obstacles/` 目錄 — 障礙物系統已模組化

---

## 五、SOLID 原則對應表

| 原則 | 在本重構中的體現 |
|------|----------------|
| **S** 單一職責 | 每個新類只做一件事：`RespawnManager` 只管復活、`CameraController` 只管攝影機 |
| **O** 開放封閉 | 新增攻擊效果 → 只擴充 `EffectRenderer`，不動 `Game.ts` |
| **L** 里氏替換 | `PlayerRenderer` 可替換為 `RemotePlayerRenderer` 無需修改呼叫端 |
| **I** 介面隔離 | `NetworkSyncManager` 只依賴它需要的玩家屬性介面，不依賴整個 `Player` 類 |
| **D** 依賴倒置 | `Game.ts` 依賴 `ICollisionSystem` 介面，不直接依賴具體實作 |

---

## 六、執行順序與決策

**建議從 Phase 1（伺服器）開始**，原因：
- 風險最低（不影響用戶體驗）
- 馬上能改善 server.ts 的可讀性
- 為後續客戶端重構建立信心

**是否全部執行？** 建議分階段確認，每個 Phase 完成後先測試再繼續。

---

*計劃書建立日期：2026-03-16*
