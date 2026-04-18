# 冰雪魔法城堡 (Frozen Magic Castle)

**🎮 線上玩：https://albertliu16888.github.io/frozen-castle/**

為 3–5 歲小朋友設計的網頁遊戲。原創冰雪公主風格，不使用任何 Disney / Frozen 相關商標。

## 玩法
1. **首頁** → 按下「開始」自動進入全螢幕
2. **組裝城堡** → 把 5 塊積木拖到輪廓上，吸附有閃光與音效
3. **魔法棒著色** → 選顏色 → 點城堡區塊上色（至少 5 塊）
4. **結局** → 公主登場、煙火、可再玩一次

## 開發

```bash
npm install
npm run dev          # 本地開發 server
npm run build        # 輸出到 dist/
npm run preview      # 預覽 production 版本
```

## 生成遊戲美術（Grok）

```bash
cp .env.example .env
# 編輯 .env，填入 XAI_API_KEY
npm run generate-images
```

會依據 `prompts.json` 呼叫 xAI `grok-2-image-1212` 產出 9 張圖到 `public/assets/`，
並對角色/積木自動白底去背。

## 部署

更新遊戲內容後跑：

```bash
npm run deploy
```

會 build + push 到 `gh-pages` branch，幾分鐘後 Pages 自動更新。

## 技術棧
- Vite + TypeScript（純前端，無框架）
- 原生 SVG + Canvas + Web Audio API
- Fullscreen API + 橫向提示
