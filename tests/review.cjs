// 攻防對照、完整取印逃脫、混合操作壓力檢查。結果寫進 tests/review-results.json。
// 用法：node tests/review.cjs [duel|escape|stress]（不給就全跑）
// 這些是程式控制器在已知地圖上的結果，不代表真人的通關時間或勝率。
const fs = require('fs'), path = require('path');
const { R, MAP, ENGINE, mk, mkArena, put, dist } = require('./lib.cjs');
const T = MAP.T, STEP = R.STEP, hyp = Math.hypot;
const which = process.argv[2] || 'all';
const out = {};
let REACT = 0.25;   // 控制器的反應時間（看到或聽到蓄撲後多久才動）

// ---------- 控制器 ----------
// 共同的觀察：最近一隻醒著的魄
function nearest(g) {
  let best = null, bd = 1e9;
  for (const e of g.pos) { if (e.state === 'gone' || e.state === 'dormant') continue; const d = dist(g.p, e); if (d < bd) { bd = d; best = e; } }
  return { e: best, d: bd };
}
const away = (g, e) => { const dx = g.p.x - e.x, dy = g.p.y - e.y, d = hyp(dx, dy) || 1; return [dx / d, dy / d]; };
const aim = (g, e) => Math.atan2(e.y - g.p.y, e.x - g.p.x);
const open = (e) => e && (e.state === 'recover' || e.state === 'stagger' || e.state === 'recoil');

// 每一種打法：回傳這一步的輸入。ctx 記蓄撲開始的時間。
const STRAT = {
  // md 原本的三種（站著不動）
  'sword-stand': (g, e, d) => ({ aim: aim(g, e), press: { sword: d <= R.SWORD.reach && g.p.swordCD <= 0 } }),
  'fire-stand': (g, e, d) => ({ aim: aim(g, e), press: { fire: d <= 4.4 && !g.p.act && g.p.talismans > 0 && e.state !== 'stagger' } }),
  'mixed-stand': (g, e, d) => {
    const p = g.p, pr = {};
    if (d <= R.BELL.r && p.bellCD <= 0 && e.state !== 'stagger') pr.bell = true;
    else if (d <= 3.5 && p.talismans > 0 && !p.act && e.state !== 'stagger') pr.fire = true;
    else if (d <= R.SWORD.reach && p.swordCD <= 0) pr.sword = true;
    return { aim: aim(g, e), press: pr };
  },
  // md 沒有的對照：只用鈴
  'bell-only': (g, e, d) => ({ aim: aim(g, e), press: { bell: d <= R.BELL.r && g.p.bellCD <= 0 && e.state !== 'stagger' } }),
  // 打了就跑：蓄撲時退開，撲空或停頓時上前揮劍
  'sword-hitrun': (g, e, d, ctx) => hitrun(g, e, d, ctx, false),
  'mixed-hitrun': (g, e, d, ctx) => hitrun(g, e, d, ctx, true),
  // 什麼都不用，只躲
  'dodge-only': (g, e, d, ctx) => {   // 只躲不打：蓄撲時退開，其餘時候跟它保持距離（場地小，總會被逼到牆邊）
    const r = hitrun(g, e, d, ctx, false); r.press = {};
    if (e.state !== 'windup' && d < 2.5) { const a = away(g, e); r.mx = a[0]; r.my = a[1]; }
    return r;
  }
};
function hitrun(g, e, d, ctx, mixed) {
  const p = g.p, pr = {};
  let mx = 0, my = 0;
  if (e.state === 'windup') {
    if (ctx.w0 == null) ctx.w0 = g.t;
    if (g.t - ctx.w0 >= REACT) { [mx, my] = away(g, e); }
    if (mixed && p.bellCD <= 0 && d <= R.BELL.r && (p.armor <= 0 || p.chill >= 40)) pr.bell = true;
  } else {
    ctx.w0 = null;
    if (open(e)) {
      if (d > 1.05) { const a = away(g, e); mx = -a[0]; my = -a[1]; }
      if (d <= R.SWORD.reach && p.swordCD <= 0) pr.sword = true;
      if (mixed && p.talismans > 0 && !p.act && d <= 3 && e.state === 'recover') pr.fire = true;
    } else if (d < 0.9 && e.state === 'chase') { const a = away(g, e); mx = a[0] * 0.5; my = a[1] * 0.5; }
  }
  return { aim: aim(g, e), mx, my, press: pr };
}

// ---------- 攻防對照 ----------
function duel() {
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIST = [0.5, 1.2, 2.2, 3.8];
  const rows = [], table = [];
  for (const armor of [54, 0]) for (const name of Object.keys(STRAT)) {
    let won = 0, lost = 0, held = 0, bites = 0, armorLost = 0, chill = 0, time = 0;
    for (const [dx, dy] of DIRS) for (const d0 of DIST) {
      const g = mkArena(null, { seed: 11, loadout: { armor } }), p = g.p, e = put(g, g.pos[0], p.x + dx * d0, p.y + dy * d0, 'chase');
      const ctx = {};
      let res = 'held';
      for (let i = 0; i < 30 / STEP; i++) {
        const d = dist(p, e), inp = e.state === 'gone' ? {} : STRAT[name](g, e, d, ctx);
        g.step(STEP, inp);
        if (g.stats.disperse > 0) { res = 'won'; break; }
        if (g.state === 'lose') { res = 'lost'; break; }
      }
      g.drain();
      if (res === 'won') won++; else if (res === 'lost') lost++; else held++;
      bites += g.stats.bites; armorLost += g.stats.armorLost; chill += g.p.chill; time += g.t;
      rows.push({ armor, name, dir: [dx, dy], d0, res, t: +g.t.toFixed(2), bites: g.stats.bites, armorLost: g.stats.armorLost, chill: +g.p.chill.toFixed(1), whiffs: g.stats.whiffs });
    }
    table.push({ armor, name, won, lost, held, bites: +(bites / 16).toFixed(2), armorLost: +(armorLost / 16).toFixed(1), chill: +(chill / 16).toFixed(1), time: +(time / 16).toFixed(1) });
  }
  console.log('\n攻防對照（16 個情境：四方向 × 0.5／1.2／2.2／3.8 格；打散一次、失魂或 30 秒為止）');
  console.log('護持  打法            打散 失魂 撐住  平均被咬 平均護持損失 平均寒意 平均秒數');
  for (const r of table) console.log(`${String(r.armor).padStart(3)}  ${r.name.padEnd(14)}  ${String(r.won).padStart(3)}  ${String(r.lost).padStart(3)}  ${String(r.held).padStart(3)}  ${String(r.bites).padStart(7)}  ${String(r.armorLost).padStart(11)}  ${String(r.chill).padStart(7)}  ${String(r.time).padStart(7)}`);
  out.duel = { table, rows };
}

// ---------- 完整取印逃脫 ----------
function bfs(g, sx, sy, gx, gy) {
  const W = g.m.W, H = g.m.H, prev = new Int32Array(W * H).fill(-2), q = [sy * W + sx];
  prev[q[0]] = -1;
  const okT = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !g.blocksMove(x, y, g.p);
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi], x = i % W, y = (i / W) | 0;
    if (x === gx && y === gy) break;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy, ni = ny * W + nx;
      if (!okT(nx, ny) || prev[ni] !== -2) continue;
      if (dx && dy && (!okT(x + dx, y) || !okT(x, y + dy))) continue;
      prev[ni] = i; q.push(ni);
    }
  }
  const goal = gy * W + gx; if (prev[goal] === -2) return null;
  const pathT = []; for (let i = goal; i !== -1; i = prev[i]) pathT.push([(i % W) + 0.5, ((i / W) | 0) + 0.5]);
  return pathT.reverse();
}
function escapeRun(o) {
  const g = mk({ seed: o.seed, loadout: o.empty ? { armor: 0, talismans: 0, ink: 0 } : undefined }), p = g.p;
  const alt = (k) => g.altars.find((a) => a.key === k);
  const goals = (o.order === 'name' ? ['name', 'breath'] : ['breath', 'name']).map((k) => ({ k, a: alt(k) })).concat([{ k: 'exit' }]);
  let gi = 0, pth = null, replan = 0, ctx = {}, dodgeT = 0, dodgeDir = null, lastPos = { x: p.x, y: p.y, t: 0 }, stalls = 0;
  const frame = o.dt;
  let time = 0, firstLampOff = false;
  const LIMIT = 300;
  while (g.state === 'play' && time < LIMIT) {
    const inp = { press: {}, hold: {} };
    if (time < o.wait) { g.advance(frame, inp); time += frame; continue; }
    if (o.lamp === 'dark' && !firstLampOff) { inp.press.lamp = true; firstLampOff = true; }
    const goal = goals[gi];
    const tgt = goal.k === 'exit' ? (g.exitOpen ? { x: 19.5, y: 27.3 } : { x: g.gate.x, y: g.gate.y - 0.5 }) : { x: goal.a.x, y: goal.a.y };
    const { e, d } = nearest(g);
    // 防禦
    let defending = false;
    if (e && d < 3.5) {
      const r = hitrun(g, e, d, ctx, true);
      if (e.state === 'windup' && (r.mx || r.my)) { dodgeDir = [r.mx, r.my]; dodgeT = 0.3; }
      Object.assign(inp.press, r.press); inp.aim = r.aim;
      if (p.bellCD <= 0 && d <= 1.6 && e.state === 'chase' && (p.armor <= 18 || p.chill >= 40)) inp.press.bell = true;
      if (p.talismans > 0 && !p.act && d <= 3 && e.state === 'chase' && p.armor <= 18) inp.press.fire = true;
      defending = e.state === 'windup' || open(e) || d < 1.2;
    }
    if (dodgeT > 0) { dodgeT -= frame; inp.mx = dodgeDir[0]; inp.my = dodgeDir[1]; }
    else if (goal.k !== 'exit' && dist(p, goal.a) <= 0.9) {
      if (!(e && d < 2.2 && e.state !== 'search')) inp.hold.take = true;
      if (goal.a.taken) { gi++; pth = null; }
    } else if (goal.k === 'exit' && g.exitReady && !g.exitOpen && dist(p, g.gate) <= 0.9) {
      if (!(e && d < 2.2 && e.state !== 'search')) inp.hold.take = true;   // 推門閂
    } else if (!(defending && e && open(e))) {
      replan -= frame;
      if (!pth || replan <= 0) { pth = bfs(g, Math.floor(p.x), Math.floor(p.y), Math.floor(tgt.x), Math.floor(tgt.y)); replan = 0.5; }
      if (pth) {
        while (pth.length > 1 && hyp(pth[0][0] - p.x, pth[0][1] - p.y) < 0.35) pth.shift();
        let k = 0; for (let i = Math.min(pth.length - 1, 4); i > 0; i--) { const n = pth[i]; if (g.hitClear(p.x, p.y, n[0], n[1]) && !MAP.walk(p.x, p.y, n[0], n[1], (tx, ty) => g.blocksMove(tx, ty, p))) { k = i; break; } }
        const n = pth[k] || [tgt.x, tgt.y], dx = n[0] - p.x, dy = n[1] - p.y, dl = hyp(dx, dy) || 1;
        inp.mx = dx / dl; inp.my = dy / dl;
        if (!inp.aim) inp.aim = Math.atan2(dy, dx);
      }
    }
    g.advance(frame, inp);
    time += frame;
    if (goal.k !== 'exit' && goal.a.taken && gi < goals.length && goals[gi] === goal) { gi++; pth = null; }
    if (g.t - lastPos.t > 5) { if (hyp(p.x - lastPos.x, p.y - lastPos.y) < 0.3 && g.state === 'play') stalls++; lastPos = { x: p.x, y: p.y, t: g.t }; }
    if (process.env.DEBUG) for (const ev of g.events) if (ev.type === 'stuck') { const po = g.pos.find((q) => q.id === ev.id); console.log('stuck', JSON.stringify(ev), po.state, JSON.stringify(po.goal), JSON.stringify(po.lastKnown), po.waiting, po.path && po.path.length, 'player', p.x.toFixed(2), p.y.toFixed(2)); }
    g.drain();
  }
  return { ok: g.state === 'win', state: g.state, t: +g.t.toFixed(2), maxChill: +g.stats.maxChill.toFixed(1), bites: g.stats.bites, disperse: g.stats.disperse, bells: g.stats.bells, fires: g.stats.fires, stuck: g.stats.stuck, stalls, seals: g.seals };
}
function escape() {
  const rows = [];
  for (const react of [0.25, 0.4]) {
    REACT = react;
    for (const order of ['name', 'breath']) for (const dt of [1 / 144, 1 / 60, 0.04, 0.05]) for (const wait of [0, 3, 6, 9]) for (const empty of [false, true]) for (const lamp of ['lit', 'dark']) {
      const r = escapeRun({ order, dt, wait, empty, lamp, seed: 100 + rows.length });
      rows.push(Object.assign({ react, order, dt: +dt.toFixed(4), wait, empty, lamp }, r));
    }
  }
  REACT = 0.25;
  const by = (f) => { const s = rows.filter(f); const okN = s.filter((r) => r.ok).length; const ts = s.filter((r) => r.ok).map((r) => r.t); return { n: s.length, ok: okN, lost: s.filter((r) => r.state === 'lose').length, timeout: s.filter((r) => r.state === 'play').length, tMin: ts.length ? Math.min(...ts) : null, tMax: ts.length ? Math.max(...ts) : null, maxChill: Math.max(...s.map((r) => r.maxChill)), bites: +(s.reduce((a, r) => a + r.bites, 0) / s.length).toFixed(2), stuck: s.reduce((a, r) => a + r.stuck, 0) }; };
  const groups = {};
  for (const rc of [0.25, 0.4]) {
    groups[`反應${rc}・全部`] = (r) => r.react === rc;
    groups[`反應${rc}・正常・點燈`] = (r) => r.react === rc && !r.empty && r.lamp === 'lit';
    groups[`反應${rc}・正常・掩燈`] = (r) => r.react === rc && !r.empty && r.lamp === 'dark';
    groups[`反應${rc}・沒補給・點燈`] = (r) => r.react === rc && r.empty && r.lamp === 'lit';
    groups[`反應${rc}・沒補給・掩燈`] = (r) => r.react === rc && r.empty && r.lamp === 'dark';
  }
  console.log('\n完整取印逃脫（兩種反應 × 兩種順序 × 四種步長 × 四種開局等待 × 有無補給 × 點燈／掩燈 = 256 次；控制器知道地圖）');
  console.log('組別              次數 出宅 失魂 逾時  最快    最慢    最高寒意 平均被咬 魄卡住');
  const sum = {};
  for (const [k, f] of Object.entries(groups)) { const b = by(f); sum[k] = b; console.log(`${k.padEnd(16)}  ${String(b.n).padStart(4)} ${String(b.ok).padStart(4)} ${String(b.lost).padStart(4)} ${String(b.timeout).padStart(4)}  ${String(b.tMin).padStart(6)}  ${String(b.tMax).padStart(6)}  ${String(b.maxChill).padStart(7)}  ${String(b.bites).padStart(7)}  ${b.stuck}`); }
  out.escape = { sum, rows };
}

// ---------- 混合操作壓力檢查 ----------
function stress() {
  const SEEDS = 24, STEPS = 4000;
  let violations = [], segments = 0, steps = 0, stuck = 0;
  const circleBad = (g, ent) => {
    for (let ty = Math.floor(ent.y - ent.r); ty <= Math.floor(ent.y + ent.r); ty++) for (let tx = Math.floor(ent.x - ent.r); tx <= Math.floor(ent.x + ent.r); tx++) {
      if (!g.blocksMove(tx, ty, ent)) continue;
      const cx = Math.max(tx, Math.min(ent.x, tx + 1)), cy = Math.max(ty, Math.min(ent.y, ty + 1));
      if (hyp(ent.x - cx, ent.y - cy) < ent.r - 0.02) return [tx, ty];
    }
    return null;
  };
  const floors = [];
  { const g = mk(); for (let y = 0; y < g.m.H; y++) for (let x = 0; x < g.m.W; x++) if (!g.blocksMove(x, y, g.p)) floors.push([x + 0.5, y + 0.5]); }
  for (let s = 0; s < SEEDS; s++) {
    const rnd = ENGINE.rng(9000 + s);
    let g = mk({ seed: 500 + s }); segments++;
    let cur = { mx: 0, my: 0 }, hold = false, next = 0;
    for (let i = 0; i < STEPS; i++) {
      if (g.state !== 'play') { stuck += g.stats.stuck; g = mk({ seed: 600 + s * 31 + i }); segments++; }
      const pr = {};
      if (g.t >= next) { const a = rnd() * 6.283; cur = rnd() < 0.2 ? { mx: 0, my: 0 } : { mx: Math.cos(a), my: Math.sin(a) }; hold = rnd() < 0.15; next = g.t + 0.3 + rnd() * 0.7; }
      for (const k of ['sword', 'bell', 'fire', 'lamp', 'read1', 'read2']) if (rnd() < 0.012) pr[k] = true;
      if (rnd() < 0.002) { const f = floors[Math.floor(rnd() * floors.length)]; g.tp(f[0], f[1]); }
      if (rnd() < 0.0015) { const a = g.altars[Math.floor(rnd() * 2)]; if (!a.taken) { g.tp(a.x + 0.6, a.y); hold = true; cur = { mx: 0, my: 0 }; next = g.t + 1.3; } }
      const dt = [1 / 144, 1 / 60, 0.04, 0.05][i % 4];
      g.advance(dt, { mx: cur.mx, my: cur.my, aim: rnd() * 6.283, target: { x: g.p.x + rnd() * 6 - 3, y: g.p.y + rnd() * 6 - 3 }, press: pr, hold: { take: hold } });
      steps++;
      const p = g.p, v = (m) => { if (violations.length < 30) violations.push(Object.assign({ seed: s, i, t: +g.t.toFixed(2) }, m)); };
      if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) v({ what: '人座標不是有限數' });
      const pb = circleBad(g, p); if (pb) v({ what: '人卡進牆', tile: pb, at: [p.x, p.y] });
      for (const e of g.pos) {
        if (!Number.isFinite(e.x) || !Number.isFinite(e.y) || !Number.isFinite(e.hp)) v({ what: '魄數值不是有限數', id: e.id });
        if (e.state !== 'gone') { const eb = circleBad(g, e); if (eb) v({ what: '魄卡進牆', id: e.id, tile: eb, at: [e.x, e.y], state: e.state }); }
        if (e.hp > R.PO.hp + 1e-9) v({ what: '魄血超過上限', id: e.id });
      }
      if (!(p.chill >= 0 && p.chill <= 100)) v({ what: '寒意出界', chill: p.chill });
      if (!(p.armor >= 0 && p.armor <= R.P.armorMax)) v({ what: '護持出界', armor: p.armor });
      if (!(p.talismans >= 0 && p.talismans <= R.P.talismanMax) || !(p.ink >= 0 && p.ink <= R.P.inkMax)) v({ what: '資源出界', t: p.talismans, ink: p.ink });
      if (p.swordCD < 0 || p.bellCD < 0 || p.swordCD > R.SWORD.cd + 1e-9 || p.bellCD > R.BELL.cd + 1e-9) v({ what: '冷卻出界' });
      if (g.events.length > 400 || g.lures.length > 20 || g.flashes.length > 20 || g.shots.length > 10 || g.sealed.size > 8) v({ what: '訊號或物件堆積', ev: g.events.length, lures: g.lures.length });
      g.drain();
    }
    stuck += g.stats.stuck;
  }
  console.log(`\n混合操作壓力檢查：${SEEDS} 個種子 × ${STEPS} 次更新 = ${steps} 次，${segments} 段遊玩；違規 ${violations.length} 項；魄卡住重新尋路 ${stuck} 次`);
  for (const x of violations.slice(0, 10)) console.log('  ', JSON.stringify(x));
  out.stress = { seeds: SEEDS, steps, segments, violations, stuck };
}

const t0 = Date.now();
if (which === 'all' || which === 'duel') duel();
if (which === 'all' || which === 'escape') escape();
if (which === 'all' || which === 'stress') stress();
const file = path.join(__dirname, 'review-results.json');
let prev = {}; try { prev = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* 第一次 */ }
fs.writeFileSync(file, JSON.stringify(Object.assign(prev, out, { version: R.VERSION, at: new Date().toISOString().slice(0, 10) }), null, 1));
console.log(`\n（${((Date.now() - t0) / 1000).toFixed(1)} 秒；結果寫進 tests/review-results.json）`);
if (out.stress && out.stress.violations.length) process.exit(1);
