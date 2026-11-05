# 燈下無明 · 專案約定

標題《燈下無明》，第一關〈紙宅 · 試夜〉；起始頁副標「紙宅 · 試夜」，標語「點燈見近 · 掩燈見遠」（Claude 擬、擁有者 2026-11-05 定）。**本作是「寫意」遊戲系列第四部**（第一部《山海有形》生存沙盒、第二部《人間塵世》模擬經營、第三部《力透紙背》筆順戰鬥）；「寫意」是系列名。內部識別名以系列名起頭，改了舊資料讀不到，不要動：`xieyi.deng.best`（最快出宅秒數）、`xieyi.deng.mute`（音效開關）、存檔三格 `xieyi.deng.save.1`–`.3`（一格一局：`{ id, at, ver, sum, run }`，出宅後換成 `{ done, id, t, at }`）、`xieyi.deng.slot`（上次玩的格），存檔格式版本 `ENGINE.SAVE_V`（改了格式要加一，舊檔就會顯示「讀不出來」），單檔 `dist/xieyi-deng.html`，除錯把手 `window.DENG`。

一句話：紙糊的宅子裡取回名印與息印、推開門閂出大門；點燈看得清身邊、魄卻從遠處看見你，掩燈後眼睛慢慢習慣黑暗。五件裝備照 2026-10-26 的攻防自查 md：桃木劍、銅鈴、火符、《燼琅嬛》（借火、封戶）、護心衣；手燈是第六樣。

## 需求來源與擁有者的決定

- 起點：擁有者 2026-10-26 的〈《燈下無明》攻防自查與修正〉md。md 提到的源碼包沒有上傳，這一版是照 md 從頭重做（2026-10-28），md 的數值照用。
- 2026-10-28 審視 md 列了八個漏洞與預設做法；擁有者回覆「你有什麼好的建議？可以跟著你的建議先走，看看做出來的demo」。2026-11-05 回覆「其他幾條都照你的建議定案吧」：標題的玩法、材質表、劍定位成「打了就跑」、寒意只在火邊退、鈴聲引魄、第二隻魄、兩印後推門閂一秒半且魄守玄關、借火引魄、劍落空分原因，全部照 `docs/DESIGN.md` 第 1、2、4 節**定案**。之後擁有者要改哪一條，就照改並記在這裡。
- **按鍵**（擁有者 2026-10-28：「除了WASD的另外幾個鍵，都請調到UIOPJKL：M《》這幾個鍵，這樣方便左手走位右手操作」）：J 劍、K 鈴、L 火符、；（畫面寫「：」）燈、，（「《」）借火、．（「》」）封戶、U 按住取印與推門閂、P 暫停（Esc 也可以）；I、O、M 先空著。舊的 F、空白、E、1、2 已拿掉。方向鍵仍可走動，滑鼠左右鍵仍是劍與火符。`src/ui.js` 用 `ev.code`（實體鍵位），中文輸入法與 Shift 不影響。
- **存檔三格**（擁有者 2026-10-28：「增加存檔功能，給予三個存檔」）：做法照系列（《人間塵世》標題頁選格、《山海有形》暫停面板「存到」、別局按兩次才蓋掉）。開始畫面 U、I、O 選格、Enter 開始或繼續、「從頭」按兩次；這一局自動存在自己那格（取印、推開門閂、暫停、失去焦點、關頁面）；暫停時 U、I、O 把這一刻抄進那一格（抄過去的是獨立的一局）；失魂後可「從存檔接著」；出宅後那一格留下出宅紀錄；壞掉或別版本的存檔整份不讀、顯示「讀不出來」；瀏覽器存不了時照樣能玩。存的是一局的完整狀態（魄的計時、尋路、亂數都在），讀回來接著跑和沒存過一樣。
- **自動對準與生動的介面**（擁有者 2026-11-05：「加上沒用滑鼠時的自動對準。然後我在想，能不能優化一下整個程序介面，更有趣生動一些」）：沒用滑鼠時劍與火符對準看得見、在射程內、沒隔牆的最近那隻魄（前後左右都算；看不見的不對準）。介面的改動只在畫面與聲音、不改規則，細目見 `docs/DESIGN.md` 第 6b 節；標語「點燈見近 · 掩燈見遠」是 Claude 擬的，擁有者 2026-11-05 回覆「標語就用「點燈見近 · 掩燈見遠」」，定案。
- **腳印做成玩法**（擁有者 2026-11-05：「腳印做成玩法吧，魄循著腳印追」）：每 0.42 格一個、八秒淡完，點燈濃度 1、掩燈 0.5；新鮮度 0.3 以上才聞得到（點燈約 5.6 秒、掩燈約 3.2 秒）；巡行一格內碰到、追丟後 1.6 格內找到就循著追（`track`，速度同探查 2.0）；封戶擋、借火引得開；看得見時頭上有「嗅」。細目與「它改了什麼」的數據見 `docs/DESIGN.md` 第 6c 節。
- **開始畫面的長鏡頭**（擁有者 2026-11-05：「主頁的實機片，有很明顯的拼接感，每三五秒的短視頻拼接起來的，我們嘗試修改」）：燈的路線改成 `src/tour.js` 一條平滑閉合、等速、不穿牆屏的曲線，鏡頭跟得慢、往前看；原因與量測見 `docs/DESIGN.md` 第 6b 節。以後改路線要跑規則回歸裡的三條路線檢查與瀏覽器的「長鏡頭」檢查。
- **3D**（擁有者 2026-11-05：「可以做一個3d版的實機demo嗎」，選「先做 3D 長鏡頭，再做可玩版」、可玩版的鏡頭「人的背後」）：第一步只把開始畫面換成 3D 長鏡頭（`src/render3d.js`），進一局仍是 2D；擁有者看過點頭才做可玩的 3D 版。細目見 `docs/DESIGN.md` 第 6d 節。
- Repo：`SteJ20996/Qidofun_Xieyi_DengXiaWuMing`（擁有者 2026-10-28 建好）。擁有者 2026-10-29 要「請存放在這個repo裡」：`main` 放最新的完整版本（repo 首頁看得到）。開發照舊在工作分支 `claude/xieyi-deng`（照《力透紙背》的 `claude/xieyi-zhan`），每次更新推到工作分支後，把 `main` 快轉到同一個提交；只快轉、不強推，`main` 若有別的提交就先停下來問擁有者。
- 私人試玩頁（claude.ai Artifact，只有擁有者看得到）：https://claude.ai/artifact/97AkBkGAZwMwZcMcgU3qw6 。每次更新都發佈到同一個網址（用 `dist/xieyi-deng.html`），不要另開新的。

## 語言

- 遊戲文案、程式註解、README、設計書、回覆一律繁體中文（台灣用語），文字自然易懂。簡體、英文、日文還沒做（系列其他作有，見《力透紙背》的 `src/en.js`）。
- 畫面上加了新字，跑 `python3 scripts/font-check.py`：霞鶩文楷 TC 沒有的字會退回系統字型。
- 不要宣稱做過真人試玩、手機或手柄測試；只有程式控制器與無頭瀏覽器的結果時就如實說。

## 每次更新後必做

1. `node tests/rules.cjs`，全部 PASS。
2. 動到數值或魄的行為時跑 `node tests/review.cjs`（攻防對照、完整逃脫、壓力檢查），壓力檢查 0 違規、魄卡住 0 次；把新的表格更新進 `docs/DESIGN.md` 第 6 節，並如實寫它能證明什麼、不能證明什麼。
3. `node scripts/smoke.mjs`（無頭 Chromium、`file://`；字體與 three.js 走網路，腳本自動用 `HTTPS_PROXY`），全部 PASS、零報錯；截圖要真的看過。大部分項目在 2D 開始畫面跑（`?flat=1`），3D 開始畫面另有三項。
4. `python3 scripts/build-single.py`，再 `python3 scripts/build-single.py --page && node scripts/smoke.mjs "file://$PWD/dist/index.html"` 驗單檔；把 `dist/xieyi-deng.html` 發佈到上面那個 Artifact。
5. 回覆裡用這個格式附上入口，網址獨立成行：

   **遊戲入口（點開即玩）：** https://claude.ai/artifact/97AkBkGAZwMwZcMcgU3qw6

6. 提交、推到工作分支 `claude/xieyi-deng`，再 `git push origin claude/xieyi-deng:main` 把 `main` 快轉到同一個提交（被拒就表示 `main` 有別的提交：停下來問擁有者，不要強推）。

## 位置

- 規則表 `src/rules.js`：`R.STEP`（固定步長 1/120）、`R.MAX_FRAME`（一幀最多補 0.1 秒）、`R.P`（人）、`R.LAMP`（燈與眼睛：`r`、`adaptT`、`adaptR`、`glare`）、`R.EXPOSE`（暴露：`light`、`see`、`seeScreen`、`dark`）、`R.PO`（魄：速度、蓄撲 `windStart`／`biteR`／`windT`、`whiffT`、`recoilT`、`bite`、寒意 `auraR`／`aura`、凝回 `reformT`／`formT`／`formClear`／`formRepick`／`reformFar`、`searchT`、`lureR`、`stuckT`）、`R.SWORD`、`R.BELL`（`hear` 是聲音範圍）、`R.FIRE`、`R.BOOK.borrow`／`R.BOOK.seal`、`R.LIGHT`、`R.WARM`、`R.TAKE`（含 `gate` 推門閂）、`R.PRINT`（腳印：`gap`、`life`、`dark`、`smell`、`pick`、`near`、`skip`、`max`）、`R.WAY`（`po1`、`po2`、`hall` 巡行點）、`R.HALL`。
- 地圖 `src/map.js`：`MAP.ROWS`（記號見檔頭）、`MAP.T`、`MAP.ROOMS`、`parse(rows)`（測試可以給自己的場地）、`walk()`（線段走過的格，穿過格角時兩旁都走到）。
- 引擎 `src/engine.js`（不碰畫面）：判定 `blocksMove`／`blocksHit`／`sightLine`／`transmission`；光 `sources`／`lightAt`；碰撞 `moveEnt`／`pushOut`／`clearMove`；尋路 `findPath`（八方向、不切牆角，走不到就走到最近處）；看見 `exposed`／`poSees`／`poVis`（lit／dark／silhouette）／`spotVisible`；魄 `updatePo`／`think`（patrol、lure、investigate、search、chase、track）／腳印 `dropPrint`／`fresh`／`scent`／`nextPrint`／`startTrack`（`g.prints`、`g.lastPrint`、每隻魄的 `trail`）／`startWindup`／`resolveBite`／`hurtPo`／`disperse`／`pickReform`／`updateGone`／`wake`；人 `tryBell`／`trySword`（自動對準 `AUTO`、`autoTarget`、`aimFor`；輸入帶 `autoAim` 才用）／`swordRelease`／`tryFire`／`updateShots`／`boom`／`tryRead`／`completeRead`／`cancelRead`／`findDoor`／`borrowSpot`／`tryTake`／`completeTake`；`step()`（順序見檔頭）；`view()`（每格的光與看見程度、走過的地圖）；存檔 `serialize()`／`restore()`（`SAVE_V`、`PO_KEYS`、`PO_STATES`、`P_NUMS`；讀檔逐項檢查，不對就回傳 null；沒有 `prints`、`trail` 的舊存檔當作沒有腳印）。開始畫面的展示 `g.attract = true`（魄看不見那盞燈、不咬、不冷，也不推它、不被它撞醒）。對外：`ENGINE.create({ seed, loadout, rows, way })` → `g.step`／`g.advance`（固定步長）／`g.view`／`g.drain`（事件）／`g.serialize`／`g.autoTarget(kind)`／`g.tp`／`g.place`；`ENGINE.restore(存檔)` → 一局或 null。亂數 `rng()` 的狀態在 `f.s.a`。
- 畫面 `src/render.js`：`buildArt`（地板、牆、紙屏、井、廊口、房名）、墨的遮罩（每格一像素放大平滑）、`drawFloorThings`、`drawLights`、`drawPos`（剪影落在紙屏上）、`drawPlayer`、`drawFx`、`drawFloats`、`drawScreenFx`（結霜、被咬一閃與紅墨濺）、生動的小東西 `drawPrints`（畫引擎的 `g.prints`，濃淡照新鮮度）、追腳印的魄頭上「嗅」（在 `drawPos`）、`drawMotes`（光裡的灰塵）、`drawWisps`（魄的墨煙，看得見才畫）、`drawGate`（門縫天光、月光）、`drawAim`（自動對準的紅括號）、`drawLantern`（開始畫面那盞燈）、被咬一震 `shake`（減少動態 `RM` 時不震不晃）、`minimap`（只記牆、屏、門、印，不記魄）、`toWorld`；`frame(dt, { snap, attract, lead, autoAim })`（`attract` 時鏡頭跟得慢、往 `lead` 方向多看 1.4 格）。
- 3D 開始畫面 `src/render3d.js`（three.js r128，index.html 從 cdnjs 載，單檔打包時照樣留連結）：`RENDER3D.ok`／`init`／`setGame`（照地圖蓋：地板用 `RENDER.floorCanvas`、牆 InstancedMesh、紙屏照引擎的光發亮、井、燭、印臺、大門、魄的字貼圖、紙燈籠與會投影子的光、灰塵）／`frame(dt, { lead, snap })`（鏡頭 `CAM` 在後上方）／`resize`；畫質 `quality`（0 全開、1 關影子、2 太慢）與 `failed`（ui 看到就換回 2D）。網址 `?flat=1` 強制 2D、`?keep3d=1` 不自動降。
- 開始畫面的路線 `src/tour.js`：`TOUR.WAY`（路線點，穿過廊口時順著廊口）、`SPEED`、`STEP`、`PTS`（照弧長等距取樣）、`LEN`、`at(s)`（走了 s 格時的位置與方向）。
- 聲音 `src/sfx.js`：WebAudio 合成；`hiss(距離, 左右)` 是黑暗中唯一的蓄撲提示，算規則的一部分；`SFX.ambient(開關)` 宅子的底噪、`heart(v)` 心跳、`creak()` 嘎吱。
- 介面 `src/ui.js`：`HINT`（教學提示）、`log`（旁側文字）、`handle`（事件 → 聲音、文字；取印、推開門閂時 `autosave`）、存檔（`SLOTS`、`readSlot`、`saveTo`、`autosave`、`slotInfo`、`renderSlots`／`startSel`（開始畫面）、`renderSaveRow`／`saveAs`（暫停面板）、`arm`／`disarm`（按兩次才算）、`canSave`）、`newGame(格, 種子)`／`continueGame(格)`／`enter`、按鍵與滑鼠、`input`、`hud`、暫停（Esc、P、失去焦點自動暫停並放開按鍵，暫停時自動存）、結束畫面（`endGame`、`endPrimary`）、自動對準 `aimAuto`（`input()` 帶 `autoAim`）、HUD 只在內容變了才改（`setHTML`）與一次性動畫（`flash`）、大印 `bigStamp`、開始畫面的展示 `tour`／`tourStep`（照 `TOUR.at` 走，方向給鏡頭 `lead`；`window.DENG.tour` 可以跳到路線上任一處）、心跳與嘎吱 `mood`、`window.DENG`（`g`、`slot`、`newGame`、`continueGame`、`saveAs`、`readSlot`、`canSave`、`setPause`、`snap`、`paused`、`running`、`keys`、`ready`）。
- 測試：`tests/lib.cjs`（載入引擎、`arena` 空場地、`put`、`run`、`ok`）、`tests/rules.cjs`、`tests/review.cjs`（控制器 `STRAT`、`hitrun`、`escapeRun`（`hesitate` 猶豫的玩家）、`hesitate()` 有無腳印對照、`stress`；環境變數 `PRINT='{"dark":0.6}'` 可以臨時調腳印）、`scripts/smoke.mjs`、`scripts/font-check.py`、`scripts/build-single.py`。
