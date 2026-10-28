// 測試共用：在 Node 裡載入規則、地圖、引擎（不碰畫面），加上幾個小工具。
const vm = require('vm'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
for (const f of ['rules', 'map', 'engine']) vm.runInThisContext(fs.readFileSync(path.join(root, 'src', f + '.js'), 'utf8'), { filename: f + '.js' });
const R = globalThis.R, MAP = globalThis.MAP, ENGINE = globalThis.ENGINE;

// 空場地：16×16，中間起點，一隻魄
function arena(extra) {
  const rows = [];
  for (let y = 0; y < 16; y++) rows.push(y === 0 || y === 15 ? '#'.repeat(16) : '#' + '.'.repeat(14) + '#');
  const set = (x, y, ch) => { rows[y] = rows[y].slice(0, x) + ch + rows[y].slice(x + 1); };
  set(8, 8, 'S'); set(2, 2, 'p');
  if (extra) extra(set);
  return rows;
}
const ARENA_WAY = [[2, 2], [13, 2], [2, 13], [13, 13]];
function mk(o) { const g = ENGINE.create(Object.assign({ seed: 1 }, o || {})); g.drain(); return g; }
function mkArena(extra, o) { return mk(Object.assign({ rows: arena(extra), way: ARENA_WAY }, o || {})); }
// 把魄擺好；frozen 給一段很長的「撲空僵住」，讓它乖乖站著
function put(g, e, x, y, state, o) {
  g.place(e, x, y, state || 'patrol');
  e.hp = R.PO.hp; e.windT = 0; e.stag = 0; e.kt = 0; e.burnT = 0; e.lastKnown = null;
  if (state === 'recover') e.stateT = 999;
  if (state === 'chase') e.lastKnown = { x: g.p.x, y: g.p.y };
  Object.assign(e, o || {});
  return e;
}
function run(g, sec, inp, stopIf) {
  const n = Math.round(sec / R.STEP);
  for (let i = 0; i < n; i++) {
    const v = typeof inp === 'function' ? inp(g, i) : inp || {};
    g.step(R.STEP, v);
    if (g.state !== 'play' || (stopIf && stopIf(g))) return i + 1;
  }
  return n;
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const aimAt = (g, e) => Math.atan2(e.y - g.p.y, e.x - g.p.x);

let pass = 0, fail = 0;
const results = [];
function ok(name, cond, info) {
  results.push({ name, ok: !!cond, info });
  if (cond) pass++; else fail++;
  console.log((cond ? 'PASS ' : 'FAIL ') + name + (info !== undefined ? '  ' + JSON.stringify(info) : ''));
}
function summary() { console.log(`\n${pass} PASS, ${fail} FAIL`); return { pass, fail, results }; }

module.exports = { R, MAP, ENGINE, arena, mk, mkArena, put, run, dist, aimAt, ok, summary, root };
