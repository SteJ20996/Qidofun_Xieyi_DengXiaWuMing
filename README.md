# 燈下無明

「寫意」遊戲系列第四部的試玩版（v0.1）：一關〈紙宅 · 試夜〉。

紙糊的宅子，夜裡有魄。取回**名印**與**息印**，推開大門的門閂，從大門出來。
點著燈，看得清身邊，魄卻從遠處就看見你；掩了燈，眼睛會慢慢習慣黑暗，看得比點燈時更遠。

純瀏覽器單頁，零依賴；字體走 Google Fonts（霞鶩文楷 TC）。

## 怎麼玩

| 按鍵 | 做什麼 |
| --- | --- |
| W A S D／方向鍵 | 走動 |
| 滑鼠 | 對準（不用滑鼠就朝走的方向） |
| J／左鍵 | 桃木劍 |
| K | 銅鈴（讀咒時也能搖） |
| L／右鍵 | 火符 |
| ：（分號鍵） | 點燈、掩燈 |
| 《 》（逗號鍵、句號鍵） | 《燼琅嬛》：借火、封戶 |
| U（按住） | 取印、推門閂 |
| P／Esc | 暫停 |

左手 WASD 走位，其餘全在右手（U I O P J K L ：M《》，其中 I、O、M 先空著）；用的是實體鍵位，中文輸入法開著、不按 Shift 都可以。

這一版只做了鍵盤與滑鼠。

## 檔案

- `index.html`、`style.css`：頁面與 HUD
- `src/rules.js`：所有數值
- `src/map.js`：紙宅地圖、格子走訪
- `src/engine.js`：規則與狀態（不碰畫面，Node 直接跑）
- `src/render.js`：畫面；`src/sfx.js`：聲音（WebAudio 合成）；`src/ui.js`：按鍵、HUD、主迴圈
- `docs/DESIGN.md`：設計書，含每個決定的理由與測試結果
- `tests/`：規則回歸、攻防對照、完整逃脫、壓力檢查；`scripts/`：瀏覽器煙霧測試、字體檢查、單檔打包

## 測試與打包

```sh
node tests/rules.cjs                 # 規則回歸，全部 PASS 才算過
node tests/review.cjs                # 攻防對照、完整逃脫、壓力檢查（結果寫進 tests/review-results.json）
node scripts/smoke.mjs               # 無頭瀏覽器，截圖在 shots/
python3 scripts/font-check.py        # 畫面上的字霞鶩文楷都有
python3 scripts/build-single.py      # dist/xieyi-deng.html（Artifact 用）
python3 scripts/build-single.py --page && node scripts/smoke.mjs "file://$PWD/dist/index.html"   # 驗單檔
```
