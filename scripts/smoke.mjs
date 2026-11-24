// 瀏覽器煙霧測試：無頭 Chromium 開本機頁面（file://），把每一種看得見的規則狀態走一遍、截圖、查報錯。
// 用法：node scripts/smoke.mjs [網址] [截圖資料夾]
// 不給網址就開 index.html；給 dist/index.html 的 file:// 網址就是驗單檔。字體從 Google Fonts 來，有代理就走代理。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.argv[2] || 'file://' + path.join(root, 'index.html');
const out = process.argv[3] || path.join(root, 'shots');
fs.mkdirSync(out, { recursive: true });
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY } : undefined;
const browser = await chromium.launch(proxy ? { proxy } : {});
const results = [];
const ok = (name, cond, info) => { results.push((cond ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : '')); };
const errors = [];
const watch = (pg) => { pg.on('pageerror', (e) => errors.push('pageerror: ' + e.message)); pg.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errors.push('console: ' + m.text()); }); };

const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage(); watch(page);
const shot = (name) => page.screenshot({ path: path.join(out, name + '.png') });
const ev = (f) => page.evaluate(f);
const wait = (ms) => page.waitForTimeout(ms);

try {
  await page.goto(base + (base.includes('?') ? '&' : '?') + 'seed=7&flat=1');
  await page.waitForFunction(() => window.DENG && DENG.ready, null, { timeout: 30000 });
  ok('字體載入（霞鶩文楷）', await ev(() => document.fonts.check('32px "LXGW WenKai TC"', '燈下無明魄噬')));
  await shot('01-start');
  ok('開始畫面', await ev(() => !document.getElementById('start').classList.contains('hidden')));
  ok('電腦上不出現觸控介面', await ev(() => !document.body.classList.contains('touch') && getComputedStyle(document.querySelector('.touchkeys')).display === 'none'));
  // 開始畫面的展示：一盞燈在宅子裡飄，魄照常巡行但不理它
  const a0 = await ev(() => ({ x: DENG.g.p.x, y: DENG.g.p.y, attract: DENG.g.attract }));
  await wait(1200);
  const a1 = await ev(() => ({ x: DENG.g.p.x, y: DENG.g.p.y, bites: DENG.g.stats.bites, chill: DENG.g.p.chill }));
  ok('開始畫面：燈在宅子裡飄、魄不理它', a0.attract && Math.hypot(a1.x - a0.x, a1.y - a0.y) > 0.5 && a1.bites === 0 && a1.chill === 0, { a0, a1 });
  // 一個長鏡頭，不像短片接起來：四秒內每一幀記燈與鏡頭的位置，看有沒有停頓、跳動
  const samp = await ev(() => new Promise((res) => { const out = []; let t0 = null; const f = (ts) => { if (t0 == null) t0 = ts; out.push([ts, DENG.g.p.x, DENG.g.p.y, DENG.RENDER.cam.x, DENG.RENDER.cam.y]); if (ts - t0 < 4000) requestAnimationFrame(f); else res(out); }; requestAnimationFrame(f); }));
  const win = (i0, i1) => { let L = 0, C = 0; for (let i = i0 + 1; i <= i1; i++) { L += Math.hypot(samp[i][1] - samp[i - 1][1], samp[i][2] - samp[i - 1][2]); C += Math.hypot(samp[i][3] - samp[i - 1][3], samp[i][4] - samp[i - 1][4]); } const T = (samp[i1][0] - samp[i0][0]) / 1000; return [L / T, C / T]; };
  const speeds = [];
  for (let i = 0, j = 0; i < samp.length; i++) { while (j < samp.length - 1 && samp[j][0] - samp[i][0] < 500) j++; if (samp[j][0] - samp[i][0] >= 500) speeds.push(win(i, j)); }
  const lv = speeds.map((q) => q[0]), cv2 = speeds.map((q) => q[1]), mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
  // 每一幀的速度（位移 ÷ 那一幀的秒數）：最快的一幀不能比平均快太多（快很多就是跳了一下）
  let jump = 0, camJump = 0;
  for (let i = 1; i < samp.length; i++) { const dt = Math.max(0.001, (samp[i][0] - samp[i - 1][0]) / 1000); jump = Math.max(jump, Math.hypot(samp[i][1] - samp[i - 1][1], samp[i][2] - samp[i - 1][2]) / dt); camJump = Math.max(camJump, Math.hypot(samp[i][3] - samp[i - 1][3], samp[i][4] - samp[i - 1][4]) / dt); }
  const flow = { frames: samp.length, lampMean: +mean(lv).toFixed(2), lampMinOverMean: +(Math.min(...lv) / mean(lv)).toFixed(2), camMinOverMean: +(Math.min(...cv2) / mean(cv2)).toFixed(2), lampPeakOverMean: +(jump / mean(lv)).toFixed(2), camPeakOverMean: +(camJump / mean(cv2)).toFixed(2) };
  ok('開始畫面是一個長鏡頭：燈等速不停、鏡頭不跳', flow.frames > 100 && flow.lampMinOverMean > 0.7 && flow.camMinOverMean > 0.4 && flow.lampPeakOverMean < 1.6 && flow.camPeakOverMean < 2.5, flow);
  await page.keyboard.press('Enter'); await wait(400);
  ok('Enter 入宅、HUD 出現', await ev(() => DENG.running && !document.getElementById('hud').classList.contains('hidden')));
  // 測試裡先把魄放遠，免得亂入
  const calm = () => ev(() => { const g = DENG.g; g.pos.forEach((e, i) => g.place(e, 2.5 + i, 25.5, 'recover')); g.pos.forEach((e) => { e.stateT = 999; }); });
  await calm();
  await shot('02-enter');

  // 走動
  const p0 = await ev(() => [DENG.g.p.x, DENG.g.p.y]);
  await page.keyboard.down('KeyW'); await wait(500); await page.keyboard.up('KeyW');
  const p1 = await ev(() => [DENG.g.p.x, DENG.g.p.y]);
  ok('鍵盤走動', p1[1] < p0[1] - 0.8, [p0, p1]);
  // 沒用滑鼠：自動對準背後看得見的魄
  await ev(() => { const g = DENG.g; g.tp(19.5, 4.5); DENG.snap(); const e = g.pos[0]; g.place(e, 18.4, 4.5, 'recover'); e.stateT = 999; e.hp = 60; g.p.aim = 0; });
  await wait(200);
  const chip = await ev(() => document.getElementById('aimmode').textContent);
  await page.keyboard.press('KeyJ'); await wait(250);
  const aimHit = await ev(() => DENG.g.stats.swordHits);
  await shot('02b-autoaim');
  ok('沒用滑鼠：自動對準，劍打中背後的魄', chip.includes('自動') && aimHit === 1, { chip, aimHit });
  await calm();
  await page.mouse.move(700, 300); await wait(100);
  ok('動一下滑鼠：改成跟著滑鼠', (await ev(() => document.getElementById('aimmode').textContent)).includes('滑鼠'));
  await page.mouse.move(640, 400); await ev(() => { DENG.g.p.swordCD = 0; });
  // 腳印：掩燈走一段，留下淡腳印；巡行的魄碰到就循著追（看得見時頭上有「嗅」）
  await ev(() => { const g = DENG.g; g.tp(12.5, 13.5); DENG.snap(); g.p.lampOn = false; g.p.adapt = 1; g.prints = []; g.lastPrint = null; });
  await page.keyboard.down('KeyD'); await wait(1250); await page.keyboard.up('KeyD');
  const np = await ev(() => ({ n: DENG.g.prints.length, dark: DENG.g.prints.every((q) => q.s < 1) }));
  await ev(() => { const g = DENG.g, e = g.pos[0], q = g.prints[0]; g.p.adapt = 1; g.place(e, q.x, q.y - 0.3, 'patrol'); e.trail = 0; e.lastKnown = null; e.hp = 60; });
  await page.waitForFunction(() => DENG.g.pos[0].state === 'track', null, { timeout: 3000 }).catch(() => {});
  await wait(250);
  const tr = await ev(() => ({ state: DENG.g.pos[0].state, vis: DENG.g.pos[0].vis && DENG.g.pos[0].vis.mode, log: document.getElementById('log').textContent }));
  await shot('02c-track');
  ok('腳印：掩燈留下淡腳印，魄循著追，看得見時有「嗅」', np.n >= 6 && np.dark && tr.state === 'track' && tr.vis === 'dark' && tr.log.includes('聞'), { np, tr });
  await calm(); await ev(() => { DENG.g.p.lampOn = true; DENG.g.prints = []; });

  // 掩燈與眼睛
  await page.keyboard.press('Semicolon'); await wait(2800);
  const dark = await ev(() => ({ lamp: DENG.g.p.lampOn, adapt: DENG.g.p.adapt, eye: document.getElementById('eye-num').textContent, ex: document.getElementById('expose').textContent }));
  ok('掩燈、眼睛慢慢習慣、顯示「隱」', !dark.lamp && dark.adapt > 0.95 && dark.ex.includes('隱'), dark);
  await shot('03-dark-adapted');
  await page.keyboard.press('Semicolon'); await wait(200);

  // 照見的蓄撲：「噬」字與紅圈
  await ev(() => { const g = DENG.g; g.tp(19.5, 3.5); const e = g.pos[0]; g.place(e, 21.0, 3.5, 'chase'); e.lastKnown = { x: 19.5, y: 3.5 }; e.stateT = 0; });
  await page.waitForFunction(() => DENG.g.pos[0].state === 'windup', null, { timeout: 5000 });
  await wait(200);
  const w1 = await ev(() => ({ vis: DENG.g.pos[0].windVisible, log: document.getElementById('log').textContent }));
  await shot('04-windup-lit');
  ok('照見的蓄撲：有提示，旁側文字提醒', w1.vis && w1.log.includes('蓄撲'), w1);
  await wait(800); await calm(); await ev(() => { DENG.g.p.armor = 54; DENG.g.p.chill = 0; });
  // 撲空：一看到蓄撲就往後退（不截圖，免得拖慢反應）
  await ev(() => { const g = DENG.g; g.tp(19.5, 3.5); const e = g.pos[0]; g.place(e, 21.0, 3.5, 'chase'); e.lastKnown = { x: 19.5, y: 3.5 }; e.stateT = 0; });
  const b0 = await ev(() => DENG.g.stats.bites);
  await page.waitForFunction(() => DENG.g.pos[0].state === 'windup', null, { timeout: 5000, polling: 'raf' });
  await page.keyboard.down('KeyA'); await wait(450); await page.keyboard.up('KeyA');
  await wait(100);
  const st = await ev(() => DENG.g.stats);
  ok('退出紅圈就撲空', st.whiffs >= 1 && st.bites === b0, { whiffs: st.whiffs, bites: st.bites - b0 });
  await shot('05-whiff');

  // 黑暗中的蓄撲：沒有字、沒有圈
  await ev(() => { const g = DENG.g; g.p.lampOn = false; g.p.adapt = 0; g.tp(12.5, 14.5); const e = g.pos[0]; g.place(e, 13.2, 14.5, 'patrol'); e.lastKnown = null; });
  await page.waitForFunction(() => DENG.g.pos[0].state === 'windup', null, { timeout: 5000 });
  await wait(150);
  const w2 = await ev(() => ({ vis: DENG.g.pos[0].windVisible, mode: DENG.g.pos[0].vis && DENG.g.pos[0].vis.mode }));
  await shot('06-windup-dark');
  ok('黑暗中的蓄撲：看不見提示', w2.vis === false, w2);
  await wait(600);
  await calm(); await ev(() => { DENG.g.p.lampOn = true; DENG.g.p.armor = 54; DENG.g.p.chill = 0; });

  // 剪影：人在天井，魄在正廳火邊，中間隔著紙屏（火先擺好）
  await ev(() => { const g = DENG.g; g.tp(16.5, 11.2); DENG.snap(); g.lures.push({ id: 900, x: 16.5, y: 6.4, t: 6 }); const e = g.pos[0]; g.place(e, 15.9, 6.0, 'recover'); e.stateT = 999; });
  await wait(300);
  const sil = await ev(() => DENG.g.pos[0].vis && DENG.g.pos[0].vis.mode);
  ok('隔紙屏：火光裡的魄是剪影', sil === 'silhouette', sil);
  await shot('07-silhouette');
  await calm(); await ev(() => { DENG.g.lures = []; });

  // 借火：讀咒、火停在對準的地方
  await ev(() => { const g = DENG.g; g.tp(14.5, 13.5); DENG.snap(); g.p.ink = 3; });
  await page.mouse.move(640 + 160, 400); await wait(100);
  await page.keyboard.press('Comma'); await wait(1400);
  const lure = await ev(() => ({ n: DENG.g.lures.length, ink: DENG.g.p.ink }));
  ok('借火：火停在前方、扣一點墨', lure.n === 1 && lure.ink === 2, lure);
  await shot('08-borrow-fire');

  // 讀咒中搖鈴：合書不耗墨
  await page.keyboard.press('Comma'); await wait(500); await page.keyboard.press('KeyK'); await wait(200);
  const bl = await ev(() => ({ ink: DENG.g.p.ink, reading: !!DENG.g.p.reading, log: document.getElementById('log').textContent }));
  ok('讀咒中搖鈴：讀咒中斷，書墨未耗', bl.ink === 2 && !bl.reading && bl.log.includes('書墨未耗'), bl);

  // 封戶：站在廊口旁
  await ev(() => { const g = DENG.g; g.tp(18.5, 17.4); });
  await page.keyboard.press('Period'); await wait(1100);
  const sealN = await ev(() => DENG.g.sealed.size);
  ok('封戶：廊口封住', sealN === 1, sealN);
  await shot('09-seal-door');

  // 劍落空的原因
  await ev(() => { const g = DENG.g; g.tp(15.5, 14.5); DENG.snap(); const e = g.pos[0]; g.place(e, 15.5, 15.5, 'recover'); e.stateT = 999; });
  await page.mouse.move(640 + 200, 400); await wait(80);
  await page.mouse.down(); await page.mouse.up(); await wait(250);
  await shot('10-sword-miss');
  ok('劍落空（方向偏了）', await ev(() => DENG.g.stats.swordMiss >= 1));
  await calm();

  // 凝形：打散後，站在看得見的地方等它凝回
  await ev(() => { const g = DENG.g; const e = g.pos[0]; g.tp(19.5, 6.5); DENG.snap(); g.place(e, 20.5, 6.5, 'recover'); e.stateT = 999; e.hp = 1; g.p.swordCD = 0; });
  await page.mouse.move(640 + 200, 400); await wait(80); await page.keyboard.press('KeyJ'); await wait(300);
  const gone = await ev(() => DENG.g.pos[0].state);
  ok('打散', gone === 'gone', gone);
  await ev(() => { const g = DENG.g, e = g.pos[0]; e.goneT = 1.6; });
  await wait(400);
  await ev(() => { const g = DENG.g, e = g.pos[0]; if (e.formSpot) { g.tp(e.formSpot.x + 3, e.formSpot.y); DENG.snap(); } });
  await wait(500);
  await shot('11-forming');
  ok('凝形看得見（凝字）', await ev(() => { const e = DENG.g.pos[0]; return !!e.formSpot && DENG.g.spotVisible(e.formSpot); }));
  await wait(1500); await calm();

  // 暫停：Esc；冷卻與時間都停
  await page.keyboard.press('Escape'); await wait(150);
  const t0 = await ev(() => DENG.g.t); await wait(500); const t1 = await ev(() => DENG.g.t);
  ok('Esc 暫停：時間停住', await ev(() => DENG.paused && !document.getElementById('pause').classList.contains('hidden')) && t0 === t1, [t0, t1]);
  await shot('12-pause');
  await page.keyboard.press('Escape'); await wait(150);
  ok('Esc 繼續', await ev(() => !DENG.paused));
  await page.keyboard.press('KeyP'); await wait(100);
  const pp = await ev(() => DENG.paused);
  await page.keyboard.press('KeyP'); await wait(100);
  ok('P 也能暫停與繼續', pp && await ev(() => !DENG.paused));
  // 舊的鍵（F、空白、E、1、2）已拿掉：按了不該有作用
  // 站在名印旁邊按舊鍵：E 按住一秒多也取不到印，F、空白不會掩燈，1、2 不會讀咒
  await ev(() => { const g = DENG.g; const a = g.altars.find((q) => q.key === 'name'); g.tp(a.x + 0.8, a.y); DENG.snap(); g.p.ink = 3; });
  const before = await ev(() => ({ lamp: DENG.g.p.lampOn, ink: DENG.g.p.ink }));
  for (const k of ['KeyF', 'Space', 'Digit1', 'Digit2']) { await page.keyboard.press(k); await wait(60); }
  await page.keyboard.down('KeyE'); await wait(1300); await page.keyboard.up('KeyE');
  const after = await ev(() => ({ lamp: DENG.g.p.lampOn, ink: DENG.g.p.ink, reads: DENG.g.stats.reads + DENG.g.stats.readCancel, taken: DENG.g.altars.find((q) => q.key === 'name').taken }));
  ok('舊的 F、空白、E、1、2 不再有作用', after.lamp === before.lamp && after.ink === before.ink && !after.taken, { before, after });

  // 失去焦點：自動暫停、放開按鍵
  await page.keyboard.down('KeyD'); await wait(100);
  await ev(() => window.dispatchEvent(new Event('blur')));
  await wait(150);
  const bl2 = await ev(() => ({ paused: DENG.paused, keys: DENG.keys.size }));
  ok('失去焦點：自動暫停、按鍵放開', bl2.paused && bl2.keys === 0, bl2);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('Escape'); await wait(100);

  // 取兩印、推門閂、出宅
  await ev(() => { const g = DENG.g; const a = g.altars.find((q) => q.key === 'name'); g.tp(a.x + 0.8, a.y); });
  await page.keyboard.down('KeyU'); await wait(1150); await page.keyboard.up('KeyU');
  ok('取印：大印蓋在畫面正中', await ev(() => !document.getElementById('bigstamp').classList.contains('hidden') && document.querySelector('#bigstamp span').textContent === '名'));
  await wait(100);
  await ev(() => { const g = DENG.g; const a = g.altars.find((q) => q.key === 'breath'); g.tp(a.x - 0.8, a.y); });
  await page.keyboard.down('KeyU'); await wait(1250); await page.keyboard.up('KeyU');
  await calm();
  const seals = await ev(() => ({ s: DENG.g.seals, ready: DENG.g.exitReady, goal: document.getElementById('goal').textContent }));
  ok('取兩印：可以推門', seals.s.name && seals.s.breath && seals.ready && seals.goal.includes('可以推開'), seals);
  await ev(() => { DENG.g.tp(20.0, 26.4); });
  await wait(200); await shot('13-gate');
  await page.keyboard.down('KeyU'); await wait(1750); await page.keyboard.up('KeyU');
  ok('推開門閂', await ev(() => DENG.g.exitOpen));
  await page.keyboard.down('KeyS'); await wait(600); await page.keyboard.up('KeyS'); await wait(300);
  const end = await ev(() => ({ st: DENG.g.state, title: document.getElementById('end-title').textContent }));
  ok('出宅', end.st === 'win' && end.title === '出宅', end);
  await shot('14-win');

  // 再一夜、失魂
  await page.keyboard.press('Enter'); await wait(300);
  ok('再一夜', await ev(() => DENG.running && DENG.g.state === 'play' && DENG.g.t < 1));
  await ev(() => { DENG.g.p.chill = 99.5; DENG.g.p.armor = 0; const e = DENG.g.pos[0]; DENG.g.place(e, DENG.g.p.x + 0.7, DENG.g.p.y, 'chase'); });
  await page.waitForFunction(() => DENG.g.state === 'lose', null, { timeout: 5000 });
  await wait(300);
  ok('失魂', await ev(() => document.getElementById('end-title').textContent === '失魂'));
  await shot('15-lose');
} catch (e) {
  ok('跑完整套', false, String(e && e.message || e));
  await shot('99-error').catch(() => {});
}

// ---------- 三格存檔（另開一個乾淨的瀏覽器設定檔） ----------
const Q = base.includes('?') ? '&' : '?';
try {
  const sctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const sp = await sctx.newPage(); watch(sp);
  const sev = (f) => sp.evaluate(f);
  const sw = (ms) => sp.waitForTimeout(ms);
  const open = async () => { await sp.goto(base + Q + 'seed=7&flat=1'); await sp.waitForFunction(() => window.DENG && DENG.ready, null, { timeout: 30000 }); await sw(150); };
  const slotTexts = () => sev(() => [...document.querySelectorAll('#slots .slot-b')].map((e) => e.textContent));
  const still = () => sev(() => { const g = DENG.g; g.pos.forEach((e, i) => { g.place(e, 2.5 + i, 25.5, 'recover'); e.stateT = 999; }); });
  await open();
  let tx = await slotTexts();
  ok('存檔：四格一開始都是空的（第四格標著無敵）', tx.length === 4 && tx.every((t) => t.includes('空')) && await sev(() => document.querySelectorAll('#slots .slot')[3].textContent.includes('無敵')), tx);
  await sp.screenshot({ path: path.join(out, '17-slots-empty.png') });
  // 第一格開一局，走一下，暫停（自動存）
  await sp.keyboard.press('KeyU'); await sp.keyboard.press('Enter'); await sw(300);
  ok('存檔：U 選第一格、Enter 入宅', await sev(() => DENG.running && DENG.slot === 1 && document.getElementById('goal').textContent.includes('第一格')));
  await sp.keyboard.down('KeyW'); await sw(400); await sp.keyboard.up('KeyW');
  await sp.keyboard.press('Escape'); await sw(100); await sp.keyboard.press('Escape'); await sw(100);
  ok('存檔：暫停時自動存到這一格', await sev(() => DENG.readSlot(1).kind === 'run'));
  // 重新整理，第二格開新局，取名印（自動存）
  await open();
  await sp.keyboard.press('KeyI'); await sp.keyboard.press('Enter'); await sw(300);
  ok('存檔：I 選第二格開新局', await sev(() => DENG.slot === 2));
  await still();
  await sev(() => { const g = DENG.g; const a = g.altars.find((q) => q.key === 'name'); g.tp(a.x + 0.8, a.y); DENG.snap(); });
  await sp.keyboard.down('KeyU'); await sw(1250); await sp.keyboard.up('KeyU'); await sw(100);
  const auto = await sev(() => ({ log: document.getElementById('log').textContent, sum: DENG.readSlot(2).d && DENG.readSlot(2).d.sum }));
  ok('存檔：取印時自動存（旁側文字說存到第二格）', auto.log.includes('已自動存到第二格') && auto.sum && auto.sum.name, auto);
  // 暫停：O 存到空的第三格；U 存到另一局的第一格要按兩次
  await sp.keyboard.press('Escape'); await sw(100);
  await sp.keyboard.press('KeyO'); await sw(100);
  const s3 = await sev(() => ({ kind: DENG.readSlot(3).kind, msg: document.getElementById('save-msg').textContent }));
  ok('存檔：暫停時 O 把這一刻抄到空的第三格', s3.kind === 'run' && s3.msg.includes('抄到第三格'), s3);
  const id1 = await sev(() => DENG.readSlot(1).d.id);
  await sp.keyboard.press('KeyU'); await sw(100);
  const first = await sev(() => ({ id: DENG.readSlot(1).d.id, msg: document.getElementById('save-msg').textContent }));
  await sp.screenshot({ path: path.join(out, '18-pause-save.png') });
  await sp.keyboard.press('KeyU'); await sw(100);
  const second = await sev(() => ({ id: DENG.readSlot(1).d.id, name: DENG.readSlot(1).d.sum.name }));
  ok('存檔：蓋掉另一局要按兩次', first.id === id1 && first.msg.includes('再按一次') && second.id !== id1 && second.name, { first, second });
  const where = await sev(() => ({ x: DENG.g.p.x, y: DENG.g.p.y, explored: DENG.g.explored.reduce((a, b) => a + b, 0) }));
  await sp.keyboard.press('Escape'); await sw(100);
  // 重新整理：第二格看得到名印；繼續之後名印、位置、地圖記憶都在
  await open();
  tx = await slotTexts();
  const got = await sev(() => document.querySelectorAll('#slots .slot')[1].querySelectorAll('.mini.got').length);
  await sp.screenshot({ path: path.join(out, '19-slots-saved.png') });
  ok('存檔：重新整理後，第二格顯示取到名印', got === 1 && tx[1].includes('存於'), tx);
  await sp.keyboard.press('KeyI'); await sp.keyboard.press('Enter'); await sw(300);
  const back = await sev(() => ({ slot: DENG.slot, name: DENG.g.seals.name, x: DENG.g.p.x, y: DENG.g.p.y, explored: DENG.g.explored.reduce((a, b) => a + b, 0), log: document.getElementById('log').textContent }));
  ok('存檔：繼續第二格，名印、位置、地圖記憶都在', back.slot === 2 && back.name && Math.hypot(back.x - where.x, back.y - where.y) < 0.05 && back.explored === where.explored && back.log.includes('接著玩'), { back, where });
  // 回主頁：暫停按 M，這一局先存好，回到開始畫面、那一格選好；Enter 接著玩，東西都在
  await still();
  await sp.keyboard.press('Escape'); await sw(100);
  const here = await sev(() => ({ x: DENG.g.p.x, y: DENG.g.p.y, t: DENG.g.t }));
  await sp.keyboard.press('KeyM'); await sw(400);
  const home = await sev(() => ({ start: !document.getElementById('start').classList.contains('hidden'), hud: document.getElementById('hud').classList.contains('hidden'), pause: document.getElementById('pause').classList.contains('hidden'), running: DENG.running, attract: DENG.g.attract, sel: document.querySelectorAll('#slots .slot')[1].classList.contains('sel'), kind: DENG.readSlot(2).kind, saved: DENG.readSlot(2).d.run && DENG.readSlot(2).d.run.t, goal: !!document.getElementById('goalbox'), mx: DENG.g.p.x, my: DENG.g.p.y }));
  await sw(600);
  const moving = await sev(() => ({ x: DENG.g.p.x, y: DENG.g.p.y }));
  await sp.screenshot({ path: path.join(out, '22-back-to-title.png') });
  ok('回主頁：暫停按 M，先存好、回開始畫面、選好這一格、展示接著走', home.start && home.hud && home.pause && !home.running && home.attract && home.sel && home.kind === 'run' && home.goal && Math.hypot(moving.x - home.mx, moving.y - home.my) > 0.05, home);
  await sp.keyboard.press('Enter'); await sw(300);
  const resumed = await sev(() => ({ running: DENG.running, slot: DENG.slot, name: DENG.g.seals.name, x: DENG.g.p.x, y: DENG.g.p.y, t: DENG.g.t, hud: !document.getElementById('hud').classList.contains('hidden') }));
  ok('回主頁之後 Enter 接著玩：位置、名印都在', resumed.running && resumed.slot === 2 && resumed.name && resumed.hud && Math.hypot(resumed.x - here.x, resumed.y - here.y) < 0.05, { resumed, here });
  // 失魂：從存檔接著
  await sev(() => { const g = DENG.g; g.p.chill = 99.5; g.p.armor = 0; const e = g.pos[0]; g.place(e, g.p.x + 0.7, g.p.y, 'chase'); e.lastKnown = { x: g.p.x, y: g.p.y }; });
  await sp.waitForFunction(() => DENG.g.state === 'lose', null, { timeout: 5000 }); await sw(200);
  const lose = await sev(() => ({ load: !document.getElementById('btn-load').classList.contains('hidden'), text: document.getElementById('end-text').textContent }));
  await sp.screenshot({ path: path.join(out, '20-lose-load.png') });
  await sp.keyboard.press('Enter'); await sw(300);
  const again = await sev(() => ({ st: DENG.g.state, name: DENG.g.seals.name, chill: DENG.g.p.chill, slot: DENG.slot }));
  ok('存檔：失魂後 Enter 從第二格的存檔接著', lose.load && lose.text.includes('第二格存著') && again.st === 'play' && again.name && again.chill < 99 && again.slot === 2, { lose, again });
  // 出宅：這一格記下出宅
  await still();
  await sev(() => { const g = DENG.g; const a = g.altars.find((q) => q.key === 'breath'); g.tp(a.x - 0.8, a.y); });
  await sp.keyboard.down('KeyU'); await sw(1250); await sp.keyboard.up('KeyU');
  await still();
  await sev(() => { DENG.g.tp(20.0, 26.4); });
  await sp.keyboard.down('KeyU'); await sw(1750); await sp.keyboard.up('KeyU');
  await sp.keyboard.down('KeyS'); await sw(600); await sp.keyboard.up('KeyS'); await sw(300);
  ok('存檔：出宅後這一格記下出宅', await sev(() => DENG.g.state === 'win' && DENG.readSlot(2).kind === 'done'));
  await sp.click('#btn-title2'); await sw(300);
  const home2 = await sev(() => ({ start: !document.getElementById('start').classList.contains('hidden'), end: document.getElementById('end').classList.contains('hidden'), running: DENG.running, slot2: document.querySelectorAll('#slots .slot-b')[1].textContent }));
  ok('出宅後按「回主頁」：回開始畫面，第二格寫著出宅過', home2.start && home2.end && !home2.running && home2.slot2.includes('出宅過'), home2);
  // 壞掉的存檔：顯示讀不出來，可以在那一格從頭
  await sev(() => localStorage.setItem('xieyi.deng.save.3', '{壞掉的'));
  await open();
  tx = await slotTexts();
  ok('存檔：出宅過的格顯示紀錄', tx[1].includes('出宅過'), tx[1]);
  await sp.keyboard.press('KeyO'); await sp.keyboard.press('Enter'); await sw(300);
  ok('存檔：壞掉的格顯示讀不出來，Enter 在那一格從頭', tx[2].includes('讀不出來') && await sev(() => DENG.slot === 3 && DENG.readSlot(3).kind === 'run'), tx[2]);
  await sctx.close();
} catch (e) { ok('三格存檔整套', false, String(e && e.message || e)); }

// 無敵格（第四格，擁有者 2026-11-24）：P 選第四格；被咬不扣護持、不加寒意；出宅不算最快紀錄
try {
  const gctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const gp = await gctx.newPage(); watch(gp);
  const gev = (f) => gp.evaluate(f), gw = (ms) => gp.waitForTimeout(ms);
  await gp.goto(base + Q + 'seed=7&flat=1');
  await gp.waitForFunction(() => window.DENG && DENG.ready, null, { timeout: 30000 });
  await gp.keyboard.press('KeyP'); await gp.keyboard.press('Enter'); await gw(300);
  const g0 = await gev(() => ({ slot: DENG.slot, god: DENG.g.god, goal: document.getElementById('goal').textContent, hint: document.getElementById('hint').textContent }));
  ok('無敵格：P 選第四格、Enter 入宅；右上寫著無敵，開頭提示說明', g0.slot === 4 && g0.god && g0.goal.includes('無敵') && g0.hint.includes('無敵格'), g0);
  await gev(() => { const g = DENG.g; g.tp(19.5, 3.5); const e = g.pos[0]; g.place(e, 20.4, 3.5, 'chase'); e.lastKnown = { x: 19.5, y: 3.5 }; e.stateT = 0; });
  await gp.waitForFunction(() => DENG.g.stats.bites >= 2, null, { timeout: 15000 });
  const g1 = await gev(() => ({ bites: DENG.g.stats.bites, chill: Math.round(DENG.g.p.chill), armor: DENG.g.p.armor, st: DENG.g.state }));
  ok('無敵格：被咬兩次，寒意 0、護持不少、照樣在玩', g1.bites >= 2 && g1.chill === 0 && g1.armor === 54 && g1.st === 'play', g1);
  await gev(() => { const g = DENG.g; g.pos.forEach((e, i) => { g.place(e, 2.5 + i, 25.5, 'recover'); e.stateT = 999; }); g.seals.name = g.seals.breath = true; g.altars.forEach((a) => { a.taken = true; }); g.exitReady = true; g.tp(20.0, 26.4); });
  await gp.keyboard.down('KeyU'); await gw(1750); await gp.keyboard.up('KeyU');
  await gp.keyboard.down('KeyS'); await gw(600); await gp.keyboard.up('KeyS'); await gw(300);
  const g2 = await gev(() => ({ st: DENG.g.state, best: localStorage.getItem('xieyi.deng.best'), rows: document.getElementById('end-stats').textContent, done: DENG.readSlot(4).kind }));
  ok('無敵格：出宅不算最快紀錄，第四格記下出宅過', g2.st === 'win' && !g2.best && g2.rows.includes('無敵格') && g2.done === 'done', g2);
  await gctx.close();
} catch (e) { ok('無敵格整套', false, String(e && e.message || e)); }

// 存不了檔的瀏覽器（例如無痕視窗擋掉 localStorage）：照樣能玩
try {
  const nctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await nctx.addInitScript(() => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new Error('blocked'); } }); });
  const np = await nctx.newPage(); watch(np);
  await np.goto(base + Q + 'seed=7&flat=1');
  await np.waitForFunction(() => window.DENG && DENG.ready, null, { timeout: 30000 });
  const info = await np.evaluate(() => ({ can: DENG.canSave, msg: document.getElementById('slot-msg').textContent, slot: document.querySelector('#slots .slot-b').textContent }));
  await np.keyboard.press('Enter'); await np.waitForTimeout(300);
  await np.keyboard.down('KeyW'); await np.waitForTimeout(300); await np.keyboard.up('KeyW');
  await np.keyboard.press('Escape'); await np.waitForTimeout(100);
  const pz = await np.evaluate(() => ({ running: DENG.running, disabled: [...document.querySelectorAll('#saverow button')].every((b) => b.disabled) }));
  ok('存不了檔時照樣能玩，存檔鈕關掉並說明', !info.can && info.msg.includes('存不了') && info.slot.includes('存不了') && pz.running && pz.disabled, { info, pz });
  await nctx.close();
} catch (e) { ok('存不了檔的情況', false, String(e && e.message || e)); }

// ---------- 3D 的開始畫面 ----------
try {
  const tctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const tp = await tctx.newPage();
  const errs3 = [];
  tp.on('pageerror', (e) => errs3.push('pageerror: ' + e.message));
  tp.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g/.test(m.text())) errs3.push('console: ' + m.text()); });
  await tp.goto(base + Q + 'seed=7&keep3d=1');
  await tp.waitForFunction(() => window.DENG && DENG.ready, null, { timeout: 40000 });
  const info = await tp.evaluate(() => ({ use3d: DENG.use3d, shown: !document.getElementById('world3d').classList.contains('hidden'), flatHidden: document.getElementById('world').classList.contains('hidden'), btn: document.getElementById('vm-3d').classList.contains('on'), note: document.getElementById('vm-note').textContent }));
  // 燈照路線等速走：用「走過的距離 ÷ 經過的時間」量（無頭瀏覽器是軟體算圖，一秒只有幾幀）
  const s0 = await tp.evaluate(() => ({ t: performance.now(), x: DENG.g.p.x, y: DENG.g.p.y, s: DENG.tour.s }));
  await tp.waitForTimeout(3000);
  const s1 = await tp.evaluate(() => ({ t: performance.now(), x: DENG.g.p.x, y: DENG.g.p.y, s: DENG.tour.s, cam: window.RENDER3D.cam }));
  const speed = (s1.s - s0.s) / ((s1.t - s0.t) / 1000);
  await tp.screenshot({ path: path.join(out, '21-start-3d.png') });
  // 無頭瀏覽器一秒只有四幀，每幀超過 0.25 秒的上限，所以量到的比 1.15 慢；真機要 20 幀以上才留在 3D，不會碰到上限
  const onRoute = await tp.evaluate(() => { const q = TOUR.at(DENG.tour.s); return Math.hypot(q.x - DENG.g.p.x, q.y - DENG.g.p.y); });
  ok('3D 開始畫面：用 3D 畫、右上角亮「立體」、燈沿著路線走、沒有報錯', info.use3d && info.shown && info.flatHidden && info.btn && info.note === '' && speed > 0.5 && speed < 1.3 && onRoute < 0.01 && s1.cam && errs3.length === 0, { info, speed: +speed.toFixed(2), onRoute, errs: errs3.slice(0, 3) });
  // 立體版（2026-11-22）：入宅後鏡頭在人背後；W 往鏡頭前方走、I／O 轉鏡頭、左鍵揮劍；字那一層在上面
  await tp.keyboard.press('Enter'); await tp.waitForTimeout(1500);
  const in3 = await tp.evaluate(() => ({ running: DENG.running, mode: window.RENDER3D.mode, d3: !document.getElementById('world3d').classList.contains('hidden'), fx: !document.getElementById('world3dfx').classList.contains('hidden'), flatHidden: document.getElementById('world').classList.contains('hidden'), btn: document.getElementById('btn-view').textContent, hint: document.getElementById('hint').textContent, x: DENG.g.p.x, y: DENG.g.p.y, yaw: window.RENDER3D.yaw }));
  await tp.screenshot({ path: path.join(out, '26-play-3d.png') });
  ok('立體版：入宅後用 3D 畫、鏡頭在背後、右上角「換成平面」、有操作提示', in3.running && in3.mode === 'play' && in3.d3 && in3.fx && in3.flatHidden && in3.btn === '換成平面' && in3.hint.includes('I、O'), in3);
  await tp.keyboard.down('KeyW'); await tp.waitForTimeout(1200); await tp.keyboard.up('KeyW');
  const w3 = await tp.evaluate(() => ({ x: DENG.g.p.x, y: DENG.g.p.y }));
  await tp.keyboard.down('KeyO'); await tp.waitForTimeout(700); await tp.keyboard.up('KeyO');
  const yaw1 = await tp.evaluate(() => window.RENDER3D.yaw);
  // 轉了鏡頭之後，W 往新的前方走
  const fw = await tp.evaluate(() => ({ x: DENG.g.p.x, y: DENG.g.p.y, fx: Math.cos(window.RENDER3D.yaw), fy: Math.sin(window.RENDER3D.yaw) }));
  await tp.keyboard.down('KeyW'); await tp.waitForTimeout(900); await tp.keyboard.up('KeyW');
  const fw2 = await tp.evaluate(() => ({ x: DENG.g.p.x, y: DENG.g.p.y }));
  const along = ((fw2.x - fw.x) * fw.fx + (fw2.y - fw.y) * fw.fy) / (Math.hypot(fw2.x - fw.x, fw2.y - fw.y) || 1);
  ok('立體版：W 往鏡頭前方走；O 轉鏡頭後，W 跟著換方向', w3.y < in3.y - 0.3 && Math.abs(w3.x - in3.x) < 0.2 && yaw1 > in3.yaw + 0.5 && along > 0.8, { w3, yaw0: in3.yaw, yaw1, along: +along.toFixed(2) });
  const sw0 = await tp.evaluate(() => DENG.g.stats.swordHits + DENG.g.stats.swordMiss);
  await tp.mouse.move(900, 300); await tp.mouse.down(); await tp.mouse.up(); await tp.waitForTimeout(400);
  const sw1 = await tp.evaluate(() => ({ n: DENG.g.stats.swordHits + DENG.g.stats.swordMiss, aim: document.getElementById('aimmode').textContent }));
  ok('立體版：滑鼠左鍵揮劍、改成跟著滑鼠對準', sw1.n === sw0 + 1 && sw1.aim.includes('滑鼠'), { sw0, sw1 });
  // 蓄撲：引擎照舊判定，立體版看得到（字在上面那層、紅圈在地板）
  await tp.evaluate(() => { const g = DENG.g; g.tp(19.5, 3.5); const e = g.pos[0]; g.place(e, 21.0, 3.5, 'chase'); e.lastKnown = { x: 19.5, y: 3.5 }; e.stateT = 0; });
  await tp.waitForFunction(() => DENG.g.pos[0].state === 'windup', null, { timeout: 8000 });
  await tp.waitForTimeout(100);
  await tp.screenshot({ path: path.join(out, '27-windup-3d.png') });
  const wv = await tp.evaluate(() => ({ vis: DENG.g.pos[0].windVisible, inFront: (() => { const q = window.RENDER3D.proj(DENG.g.pos[0].x, 1.5, DENG.g.pos[0].y); return !!q; })() }));
  ok('立體版：照見的蓄撲看得到', wv.vis && wv.inFront, wv);
  // 暫停面板換成平面：照樣玩；右上角換回立體
  await tp.keyboard.press('Escape'); await tp.waitForTimeout(150);
  await tp.click('#pv-2d'); await tp.waitForTimeout(150);
  await tp.keyboard.press('Escape'); await tp.waitForTimeout(300);
  const flatNow = await tp.evaluate(() => ({ use3d: DENG.use3d, flat: !document.getElementById('world').classList.contains('hidden'), d3: document.getElementById('world3d').classList.contains('hidden'), running: DENG.running && !DENG.paused, btn: document.getElementById('btn-view').textContent }));
  await tp.click('#btn-view'); await tp.waitForTimeout(500);
  const back3d = await tp.evaluate(() => ({ use3d: DENG.use3d, mode: window.RENDER3D.mode, d3: !document.getElementById('world3d').classList.contains('hidden'), running: DENG.running }));
  ok('玩到一半換成平面、再換回立體，照樣在玩', !flatNow.use3d && flatNow.flat && flatNow.d3 && flatNow.running && flatNow.btn === '換成立體' && back3d.use3d && back3d.mode === 'play' && back3d.d3 && back3d.running, { flatNow, back3d });
  // 回主頁：開始畫面換回 3D 的長鏡頭，燈從剛才的地方接著走
  const in2d = { running: true, flat: true, d3: true };
  await tp.keyboard.press('Escape'); await tp.waitForTimeout(100); await tp.keyboard.press('KeyM'); await tp.waitForTimeout(300);
  const r0 = await tp.evaluate(() => DENG.tour.s);
  await tp.waitForTimeout(1500);
  const back3 = await tp.evaluate(() => ({ use3d: DENG.use3d, shown: !document.getElementById('world3d').classList.contains('hidden'), flatHidden: document.getElementById('world').classList.contains('hidden'), attract: DENG.g.attract, s: DENG.tour.s, failed: window.RENDER3D.failed }));
  await tp.screenshot({ path: path.join(out, '23-title-3d-again.png') });
  const fxGone = await tp.evaluate(() => document.getElementById('world3dfx').classList.contains('hidden') && window.RENDER3D.mode === 'attract');
  ok('3D：立體版回主頁，開始畫面換回 3D 長鏡頭、沒有報錯', in2d.running && fxGone && back3.use3d && back3.shown && back3.flatHidden && back3.attract && back3.s > r0 && !back3.failed && errs3.length === 0, { fxGone, back3, r0, errs: errs3.slice(0, 3) });
  await tctx.close();
  // 跑不動 3D 的機器（無頭瀏覽器就是）：幾秒後自己換回 2D 長鏡頭，照樣能入宅
  const sctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const sp2 = await sctx2.newPage(); watch(sp2);
  await sp2.goto(base + Q + 'seed=7');
  await sp2.waitForFunction(() => window.DENG && DENG.ready, null, { timeout: 40000 });
  const first = await sp2.evaluate(() => DENG.use3d);
  await sp2.waitForFunction(() => !DENG.use3d, null, { timeout: 40000 }).catch(() => {});
  const fb = await sp2.evaluate(() => ({ use3d: DENG.use3d, flatShown: !document.getElementById('world').classList.contains('hidden'), q: window.RENDER3D.quality, note: document.getElementById('vm-note').textContent, flatOn: document.getElementById('vm-2d').classList.contains('on') }));
  await sp2.screenshot({ path: path.join(out, '24-fallback-note.png') });
  ok('跑不動 3D 的機器：自己換回 2D，右上角說「太慢」', first && !fb.use3d && fb.flatShown && fb.flatOn && fb.note.includes('太慢'), { first, fb });
  // 按「立體」再試：換回 3D，不再自動換；記住這個選擇
  await sp2.click('#vm-3d'); await sp2.waitForTimeout(6000);
  const forced = await sp2.evaluate(() => ({ use3d: DENG.use3d, shown: !document.getElementById('world3d').classList.contains('hidden'), keep: window.RENDER3D.keep, failed: window.RENDER3D.failed, pref: localStorage.getItem('xieyi.deng.view'), note: document.getElementById('vm-note').textContent }));
  ok('按「立體」：換回 3D、六秒後還是 3D、記住選擇', forced.use3d && forced.shown && forced.keep && !forced.failed && forced.pref === '3d' && forced.note === '', forced);
  await sp2.reload(); await sp2.waitForFunction(() => window.DENG && DENG.ready, null, { timeout: 40000 });
  const again3 = await sp2.evaluate(() => ({ use3d: DENG.use3d, keep: window.RENDER3D.keep }));
  // 按「平面」：換成 2D，重新整理後還是 2D、不出原因
  await sp2.click('#vm-2d'); await sp2.waitForTimeout(300);
  await sp2.reload(); await sp2.waitForFunction(() => window.DENG && DENG.ready, null, { timeout: 40000 });
  const flat = await sp2.evaluate(() => ({ use3d: DENG.use3d, flatShown: !document.getElementById('world').classList.contains('hidden'), note: document.getElementById('vm-note').textContent, pref: localStorage.getItem('xieyi.deng.view') }));
  await sp2.keyboard.press('Enter'); await sp2.waitForTimeout(300);
  const started = await sp2.evaluate(() => DENG.running && DENG.g.state === 'play');
  ok('重新整理照記住的選：立體就立體、平面就平面；照樣能入宅', again3.use3d && again3.keep && !flat.use3d && flat.flatShown && flat.note === '' && flat.pref === '2d' && started, { again3, flat, started });
  await sctx2.close();
  // three.js 載不到：直接用 2D，不報錯
  const bctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await bctx.route('**/three.min.js', (r) => r.abort());
  const bp = await bctx.newPage();
  const errsB = []; bp.on('pageerror', (e) => errsB.push(e.message));
  await bp.goto(base + Q + 'seed=7');
  await bp.waitForFunction(() => window.DENG && DENG.ready, null, { timeout: 40000 });
  const nb = await bp.evaluate(() => ({ use3d: DENG.use3d, flatShown: !document.getElementById('world').classList.contains('hidden'), note: document.getElementById('vm-note').textContent, dis: document.getElementById('vm-3d').disabled }));
  ok('three.js 載不到：直接用 2D、右上角說原因、頁面不出錯', !nb.use3d && nb.flatShown && nb.dis && nb.note.includes('three.js') && errsB.length === 0, { nb, errsB });
  await bctx.close();
  // 窄螢幕（claude.ai 側欄、手機）：選單從四成高開始，上面看得到 3D 的宅子
  const nctx3 = await browser.newContext({ viewport: { width: 760, height: 820 } });
  const np3 = await nctx3.newPage();
  await np3.goto(base + Q + 'seed=7&keep3d=1');
  await np3.waitForFunction(() => window.DENG && DENG.ready, null, { timeout: 40000 }); await np3.waitForTimeout(2500);
  const nar = await np3.evaluate(() => ({ use3d: DENG.use3d, top: Math.round(document.querySelector('#start .startpanel').getBoundingClientRect().top), h: innerHeight, vm: !!document.getElementById('viewmode').getBoundingClientRect().width }));
  await np3.screenshot({ path: path.join(out, '25-narrow-3d.png') });
  ok('窄螢幕：選單在下面，上面看得到 3D 的宅子', nar.use3d && nar.top > nar.h * 0.35 && nar.vm, nar);
  await nctx3.close();
} catch (e) { ok('3D 開始畫面', false, String(e && e.message || e)); }

// 減少動態：照樣能玩、不報錯
try {
  const rctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  const rp = await rctx.newPage(); watch(rp);
  await rp.goto(base + Q + 'seed=7&flat=1');
  await rp.waitForFunction(() => window.DENG && DENG.ready, null, { timeout: 30000 });
  await rp.keyboard.press('Enter'); await rp.waitForTimeout(300);
  await rp.keyboard.down('KeyW'); await rp.waitForTimeout(400); await rp.keyboard.up('KeyW');
  ok('減少動態：照樣能玩', await rp.evaluate(() => DENG.running && DENG.g.state === 'play'));
  await rctx.close();
} catch (e) { ok('減少動態', false, String(e && e.message || e)); }

// 手機寬度：開始畫面放得下
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const mp = await mctx.newPage(); watch(mp);
await mp.goto(base + (base.includes('?') ? '&' : '?') + 'seed=7&flat=1');
await mp.waitForFunction(() => window.DENG && DENG.ready, null, { timeout: 30000 });
await mp.screenshot({ path: path.join(out, '16-phone-start.png') });
const over = await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
ok('手機寬度不會左右捲', !over);
// 手機（2026-11-22）：觸控介面。左半邊拖動走、右下角按鈕、按住「取」取印；說明換成手指的說法
try {
  const tinfo = await mp.evaluate(() => ({ touch: document.body.classList.contains('touch'), keys: getComputedStyle(document.querySelector('#start .keys')).display, tk: getComputedStyle(document.querySelector('.touchkeys')).display, goal: document.getElementById('goalbox').innerText }));
  ok('手機：開始畫面換成觸控說明（看不到鍵盤按鍵）', tinfo.touch && tinfo.keys === 'none' && tinfo.tk !== 'none' && tinfo.goal.includes('「取」') && !tinfo.goal.includes('U'), tinfo);
  await mp.tap('#slots .slot .go'); await mp.waitForTimeout(600);
  const hint = await mp.evaluate(() => ({ running: DENG.running, hint: document.getElementById('hint').textContent, tools: getComputedStyle(document.getElementById('tools')).display, take: getComputedStyle(document.getElementById('t-take')).display }));
  await mp.screenshot({ path: path.join(out, '28-phone-play.png') });
  ok('手機：入宅後右下角是一叢按鈕、有「取」，提示說手指怎麼用', hint.running && hint.tools === 'grid' && hint.take !== 'none' && hint.hint.includes('左半邊'), hint);
  const sz = await mp.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(); return { sword: Math.round(r('t-sword').width), takeH: Math.round(r('t-take').height), bell: Math.round(r('t-bell').width) }; });
  ok('手機：按鈕照 2026-11-22 的大小（直拿時劍約 106、其他約 50 像素）', Math.abs(sz.sword - 106) <= 2 && Math.abs(sz.takeH - 50) <= 2 && Math.abs(sz.bell - 50) <= 2, sz);
  const tz = (type, id, x, y) => mp.evaluate(([type, id, x, y]) => { document.getElementById('touchzone').dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); }, [type, id, x, y]);
  const y0 = await mp.evaluate(() => DENG.g.p.y);
  await tz('pointerdown', 3, 70, 500); await tz('pointermove', 3, 70, 440);
  const stick = await mp.evaluate(() => !document.getElementById('stick').classList.contains('hidden'));
  await mp.waitForTimeout(900); await tz('pointerup', 3, 70, 440);
  const y1 = await mp.evaluate(() => ({ y: DENG.g.p.y, stick: !document.getElementById('stick').classList.contains('hidden') }));
  ok('手機：左半邊往上拖就往上走，放開就停、圓圈收起', stick && y1.y < y0 - 0.3 && !y1.stick, { y0, y1, stick });
  const sw0 = await mp.evaluate(() => DENG.g.stats.swordHits + DENG.g.stats.swordMiss);
  await mp.tap('#t-sword'); await mp.waitForTimeout(400);
  const sw1 = await mp.evaluate(() => ({ n: DENG.g.stats.swordHits + DENG.g.stats.swordMiss, bites: DENG.g.stats.bites }));
  ok('手機：點一下劍就揮一劍（不會因為補發的滑鼠事件多揮一次）', sw1.n === sw0 + 1, { sw0, sw1 });
  await mp.evaluate(() => { const g = DENG.g; g.pos.forEach((e, i) => { g.place(e, 2.5 + i, 25.5, 'recover'); e.stateT = 999; }); const a = g.altars.find((q) => q.key === 'name'); g.tp(a.x + 0.8, a.y); DENG.snap(); });
  await mp.waitForTimeout(300);
  const ready = await mp.evaluate(() => ({ ready: document.getElementById('t-take').classList.contains('ready'), label: document.getElementById('take-s').textContent }));
  await mp.evaluate(() => document.getElementById('t-take').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 5, pointerType: 'touch', bubbles: true })));
  await mp.waitForTimeout(1400);
  await mp.evaluate(() => document.getElementById('t-take').dispatchEvent(new PointerEvent('pointerup', { pointerId: 5, pointerType: 'touch', bubbles: true })));
  const took = await mp.evaluate(() => ({ name: DENG.g.seals.name, hint: document.getElementById('hint').textContent }));
  ok('手機：站在印臺旁「取」會亮，按住就取到印', ready.ready && ready.label === '取印' && took.name, { ready, took });
  const over2 = await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
  ok('手機：玩的時候也不會左右捲', !over2);
} catch (e) { ok('手機的觸控介面', false, String(e && e.message || e)); }
// 橫拿的手機：立體版，右半邊左右滑動轉鏡頭
try {
  const lctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const lp = await lctx.newPage(); watch(lp);
  await lp.goto(base + (base.includes('?') ? '&' : '?') + 'seed=7&keep3d=1');
  await lp.waitForFunction(() => window.DENG && DENG.ready, null, { timeout: 40000 });
  await lp.evaluate(() => DENG.newGame(1)); await lp.waitForTimeout(1200);
  const yaw0 = await lp.evaluate(() => window.RENDER3D.yaw);
  const tz = (type, id, x, y) => lp.evaluate(([type, id, x, y]) => { document.getElementById('touchzone').dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: x, clientY: y, bubbles: true })); }, [type, id, x, y]);
  await tz('pointerdown', 4, 600, 120); await tz('pointermove', 4, 680, 120); await tz('pointerup', 4, 680, 120);
  const l = await lp.evaluate(() => ({ yaw: window.RENDER3D.yaw, mode: window.RENDER3D.mode, hint: document.getElementById('hint').textContent }));
  await lp.screenshot({ path: path.join(out, '29-phone-3d.png') });
  ok('橫拿的手機：立體版右半邊滑動轉鏡頭，提示說手指怎麼轉', l.mode === 'play' && l.yaw > yaw0 + 0.3 && l.hint.includes('右半邊'), { yaw0, l });
  await lctx.close();
} catch (e) { ok('橫拿的手機', false, String(e && e.message || e)); }

ok('沒有報錯', errors.length === 0, errors.slice(0, 5));
await browser.close();
console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fails} PASS, ${fails} FAIL；截圖在 ${out}`);
process.exit(fails ? 1 : 0);
