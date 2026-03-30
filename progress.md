Original prompt: 沒有成功有音效

- 2026-03-30: 檢查刀 Lv1 音效接線失敗原因。目標是確認 slash_01.wav.mp3 是否實際被載入與播放。
- 2026-03-30: 發現刀 Lv1~4 主要走 WeaponDefinitions.ts 的 fireDirect()，不是後來補的 CombatSystem slash 分支。
- 2026-03-30: 將刀 Lv1 音效播放從 HTMLAudio 改為 AudioContext + decodeAudioData，並在 init() 時預載 /audio/weapons/sword/slash_01.wav.mp3。
