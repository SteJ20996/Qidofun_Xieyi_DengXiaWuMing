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
  await page.goto(base + (base.includes('?') ? '&' : '?') + 'seed=7');
  await page.waitForFunction(() => window.DENG && DENG.ready, null, { timeout: 30000 });
  ok('字體載入（霞鶩文楷）', await ev(() => document.fonts.check('32px "LXGW WenKai TC"', '燈下無明魄噬')));
  await shot('01-start');
  ok('開始畫面', await ev(() => !document.getElementById('start').classList.contains('hidden')));
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

  // 掩燈與眼睛
  await page.keyboard.press('KeyF'); await wait(2800);
  const dark = await ev(() => ({ lamp: DENG.g.p.lampOn, adapt: DENG.g.p.adapt, eye: document.getElementById('eye-num').textContent, ex: document.getElementById('expose').textContent }));
  ok('掩燈、眼睛慢慢習慣、顯示「隱」', !dark.lamp && dark.adapt > 0.95 && dark.ex.includes('隱'), dark);
  await shot('03-dark-adapted');
  await page.keyboard.press('KeyF'); await wait(200);

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
  await page.keyboard.press('Digit1'); await wait(1400);
  const lure = await ev(() => ({ n: DENG.g.lures.length, ink: DENG.g.p.ink }));
  ok('借火：火停在前方、扣一點墨', lure.n === 1 && lure.ink === 2, lure);
  await shot('08-borrow-fire');

  // 讀咒中搖鈴：合書不耗墨
  await page.keyboard.press('Digit1'); await wait(500); await page.keyboard.press('KeyK'); await wait(200);
  const bl = await ev(() => ({ ink: DENG.g.p.ink, reading: !!DENG.g.p.reading, log: document.getElementById('log').textContent }));
  ok('讀咒中搖鈴：讀咒中斷，書墨未耗', bl.ink === 2 && !bl.reading && bl.log.includes('書墨未耗'), bl);

  // 封戶：站在廊口旁
  await ev(() => { const g = DENG.g; g.tp(18.5, 17.4); });
  await page.keyboard.press('Digit2'); await wait(1100);
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
  await page.keyboard.down('KeyE'); await wait(1250); await page.keyboard.up('KeyE');
  await ev(() => { const g = DENG.g; const a = g.altars.find((q) => q.key === 'breath'); g.tp(a.x - 0.8, a.y); });
  await page.keyboard.down('KeyE'); await wait(1250); await page.keyboard.up('KeyE');
  await calm();
  const seals = await ev(() => ({ s: DENG.g.seals, ready: DENG.g.exitReady, goal: document.getElementById('goal').textContent }));
  ok('取兩印：可以推門', seals.s.name && seals.s.breath && seals.ready && seals.goal.includes('可以推開'), seals);
  await ev(() => { DENG.g.tp(20.0, 26.4); });
  await wait(200); await shot('13-gate');
  await page.keyboard.down('KeyE'); await wait(1750); await page.keyboard.up('KeyE');
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

// 手機寬度：開始畫面放得下
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
const mp = await mctx.newPage(); watch(mp);
await mp.goto(base + (base.includes('?') ? '&' : '?') + 'seed=7');
await mp.waitForFunction(() => window.DENG && DENG.ready, null, { timeout: 30000 });
await mp.screenshot({ path: path.join(out, '16-phone-start.png') });
const over = await mp.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
ok('手機寬度不會左右捲', !over);

ok('沒有報錯', errors.length === 0, errors.slice(0, 5));
await browser.close();
console.log(results.join('\n'));
const fails = results.filter((r) => r.startsWith('FAIL')).length;
console.log(`\n${results.length - fails} PASS, ${fails} FAIL；截圖在 ${out}`);
process.exit(fails ? 1 : 0);
