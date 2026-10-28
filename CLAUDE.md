# 燈下無明 · 專案約定

標題《燈下無明》，第一關〈紙宅 · 試夜〉。**本作是「寫意」遊戲系列第四部**（第一部《山海有形》生存沙盒、第二部《人間塵世》模擬經營、第三部《力透紙背》筆順戰鬥）；「寫意」是系列名。內部識別名以系列名起頭，改了舊資料讀不到，不要動：`xieyi.deng.best`（最快出宅秒數）、`xieyi.deng.mute`（音效開關），單檔 `dist/xieyi-deng.html`，除錯把手 `window.DENG`。

一句話：紙糊的宅子裡取回名印與息印、推開門閂出大門；點燈看得清身邊、魄卻從遠處看見你，掩燈後眼睛慢慢習慣黑暗。五件裝備照 2026-10-26 的攻防自查 md：桃木劍、銅鈴、火符、《燼琅嬛》（借火、封戶）、護心衣；手燈是第六樣。

## 需求來源與擁有者的決定

- 起點：擁有者 2026-10-26 的〈《燈下無明》攻防自查與修正〉md。md 提到的源碼包沒有上傳，這一版是照 md 從頭重做（2026-10-28），md 的數值照用。
- 2026-10-28 審視 md 列了八個漏洞與預設做法；擁有者回覆「你有什麼好的建議？可以跟著你的建議先走，看看做出來的demo」。所以 `docs/DESIGN.md` 第 1、2、4 節標「要擁有者確認」的都還沒定案：標題的玩法、材質表、劍定位成「打了就跑」、寒意只在火邊退、鈴聲引魄、第二隻魄、兩印後推門閂一秒半且魄守玄關、借火引魄、劍落空分原因。擁有者改了哪一條，就照改並記在這裡。
- Repo：`SteJ20996/Qidofun_Xieyi_DengXiaWuMing`（擁有者 2026-10-28 建好）。`main` 只有建立時的 Initial commit；開發在工作分支 `claude/xieyi-deng`（照《力透紙背》的 `claude/xieyi-zhan`）。要不要開 PR、合進 `main`，照擁有者的意思。
- 私人試玩頁（claude.ai Artifact，只有擁有者看得到）：https://claude.ai/artifact/97AkBkGAZwMwZcMcgU3qw6 。每次更新都發佈到同一個網址（用 `dist/xieyi-deng.html`），不要另開新的。

## 語言

- 遊戲文案、程式註解、README、設計書、回覆一律繁體中文（台灣用語），文字自然易懂。簡體、英文、日文還沒做（系列其他作有，見《力透紙背》的 `src/en.js`）。
- 畫面上加了新字，跑 `python3 scripts/font-check.py`：霞鶩文楷 TC 沒有的字會退回系統字型。
- 不要宣稱做過真人試玩、手機或手柄測試；只有程式控制器與無頭瀏覽器的結果時就如實說。

## 每次更新後必做

1. `node tests/rules.cjs`，全部 PASS。
2. 動到數值或魄的行為時跑 `node tests/review.cjs`（攻防對照、完整逃脫、壓力檢查），壓力檢查 0 違規、魄卡住 0 次；把新的表格更新進 `docs/DESIGN.md` 第 6 節，並如實寫它能證明什麼、不能證明什麼。
3. `node scripts/smoke.mjs`（無頭 Chromium、`file://`；字體走 Google Fonts，腳本自動用 `HTTPS_PROXY`），全部 PASS、零報錯；截圖要真的看過。
4. `python3 scripts/build-single.py`，再 `python3 scripts/build-single.py --page && node scripts/smoke.mjs "file://$PWD/dist/index.html"` 驗單檔；把 `dist/xieyi-deng.html` 發佈到上面那個 Artifact。
5. 回覆裡用這個格式附上入口，網址獨立成行：

   **遊戲入口（點開即玩）：** https://claude.ai/artifact/97AkBkGAZwMwZcMcgU3qw6

6. 提交、推到工作分支 `claude/xieyi-deng`。要不要開 PR、合進 `main`，照擁有者的意思。

## 位置

- 規則表 `src/rules.js`：`R.STEP`（固定步長 1/120）、`R.MAX_FRAME`（一幀最多補 0.1 秒）、`R.P`（人）、`R.LAMP`（燈與眼睛：`r`、`adaptT`、`adaptR`、`glare`）、`R.EXPOSE`（暴露：`light`、`see`、`seeScreen`、`dark`）、`R.PO`（魄：速度、蓄撲 `windStart`／`biteR`／`windT`、`whiffT`、`recoilT`、`bite`、寒意 `auraR`／`aura`、凝回 `reformT`／`formT`／`formClear`／`formRepick`／`reformFar`、`searchT`、`lureR`、`stuckT`）、`R.SWORD`、`R.BELL`（`hear` 是聲音範圍）、`R.FIRE`、`R.BOOK.borrow`／`R.BOOK.seal`、`R.LIGHT`、`R.WARM`、`R.TAKE`（含 `gate` 推門閂）、`R.WAY`（`po1`、`po2`、`hall` 巡行點）、`R.HALL`。
- 地圖 `src/map.js`：`MAP.ROWS`（記號見檔頭）、`MAP.T`、`MAP.ROOMS`、`parse(rows)`（測試可以給自己的場地）、`walk()`（線段走過的格，穿過格角時兩旁都走到）。
- 引擎 `src/engine.js`（不碰畫面）：判定 `blocksMove`／`blocksHit`／`sightLine`／`transmission`；光 `sources`／`lightAt`；碰撞 `moveEnt`／`pushOut`／`clearMove`；尋路 `findPath`（八方向、不切牆角，走不到就走到最近處）；看見 `exposed`／`poSees`／`poVis`（lit／dark／silhouette）／`spotVisible`；魄 `updatePo`／`think`（patrol、lure、investigate、search、chase）／`startWindup`／`resolveBite`／`hurtPo`／`disperse`／`pickReform`／`updateGone`／`wake`；人 `tryBell`／`trySword`／`swordRelease`／`tryFire`／`updateShots`／`boom`／`tryRead`／`completeRead`／`cancelRead`／`findDoor`／`borrowSpot`／`tryTake`／`completeTake`；`step()`（順序見檔頭）；`view()`（每格的光與看見程度、走過的地圖）。對外：`ENGINE.create({ seed, loadout, rows, way })` → `g.step`／`g.advance`（固定步長）／`g.view`／`g.drain`（事件）／`g.tp`／`g.place`。
- 畫面 `src/render.js`：`buildArt`（地板、牆、紙屏、井、廊口、房名）、墨的遮罩（每格一像素放大平滑）、`drawFloorThings`、`drawLights`、`drawPos`（剪影落在紙屏上）、`drawPlayer`、`drawFx`、`drawFloats`、`drawScreenFx`（結霜、被咬一閃）、`minimap`（只記牆、屏、門、印，不記魄）、`toWorld`。
- 聲音 `src/sfx.js`：WebAudio 合成；`hiss(距離, 左右)` 是黑暗中唯一的蓄撲提示，算規則的一部分。
- 介面 `src/ui.js`：`HINT`（教學提示）、`log`（旁側文字）、`handle`（事件 → 聲音、文字）、按鍵與滑鼠、`input`、`hud`、暫停（Esc、失去焦點自動暫停並放開按鍵）、結束畫面、`window.DENG`（`g`、`newGame`、`setPause`、`snap`、`paused`、`running`、`keys`、`ready`）。
- 測試：`tests/lib.cjs`（載入引擎、`arena` 空場地、`put`、`run`、`ok`）、`tests/rules.cjs`、`tests/review.cjs`（控制器 `STRAT`、`hitrun`、`escapeRun`、`stress`）、`scripts/smoke.mjs`、`scripts/font-check.py`、`scripts/build-single.py`。
