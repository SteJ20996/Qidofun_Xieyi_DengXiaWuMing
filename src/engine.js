// 燈下無明 —— 引擎：只有規則與狀態，不碰畫面（Node 測試直接跑這個檔）。
// 每一步的順序（照 md 第 2 節，並補上審視時發現的情況）：
//   人（走動、點掩燈、按鍵起手）→ 魄（感知、追、蓄撲結算、寒意）→ 人出手（劍、符）→ 飛符
//   → 讀咒：先查中斷（被咬、魄貼身）再完成 → 取印 → 取暖 → 勝負
(function (root) {
  const R = root.R, MAP = root.MAP, T = MAP.T;
  const hyp = Math.hypot, PI = Math.PI;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angDiff = (a, b) => { let d = (a - b) % (2 * PI); if (d > PI) d -= 2 * PI; if (d < -PI) d += 2 * PI; return Math.abs(d); };
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  // ---------- 格子判定 ----------
  // 擋走路：牆、紙屏、井欄、關著的大門、封戶（已在封印格裡的魄可以離開）
  function blocksMove(g, tx, ty, ent) {
    const k = g.m.at(tx, ty);
    if (k === T.WALL || k === T.SCREEN || k === T.LOW) return true;
    if (k === T.EXIT) return !(g.exitOpen && ent === g.p);
    if (k === T.DOOR) { const s = g.sealed.get(ty * g.m.W + tx); if (s) return !(ent && ent.kind === 'po' && s.exempt.has(ent.id)); }
    return false;
  }
  // 擋劍、鈴、符、咬、寒意：牆、紙屏、關著的大門、封戶（井欄矮，不擋）
  function blocksHit(g, tx, ty) {
    const k = g.m.at(tx, ty);
    if (k === T.WALL || k === T.SCREEN) return true;
    if (k === T.EXIT) return !g.exitOpen;
    if (k === T.DOOR) return g.sealed.has(ty * g.m.W + tx);
    return false;
  }
  const hitClear = (g, x0, y0, x1, y1) => !MAP.walk(x0, y0, x1, y1, (tx, ty) => blocksHit(g, tx, ty));

  // 視線：'clear' 看得清；'paper' 隔著紙屏（只看得到光與剪影）；'blocked' 隔著牆。終點那一格不算擋。
  function sightLine(g, x0, y0, x1, y1) {
    const ex = Math.floor(x1), ey = Math.floor(y1), sx = Math.floor(x0), sy = Math.floor(y0);
    let paper = false;
    const blocked = MAP.walk(x0, y0, x1, y1, (tx, ty) => {
      if ((tx === ex && ty === ey) || (tx === sx && ty === sy)) return false;
      const k = g.m.at(tx, ty);
      if (k === T.WALL || (k === T.EXIT && !g.exitOpen)) return true;
      if (k === T.SCREEN) paper = true;
      return false;
    });
    return blocked ? 'blocked' : paper ? 'paper' : 'clear';
  }
  // 透光率：牆 0，紙屏每道 ×0.45，其餘 1（光源那一格與終點那一格不算）
  function transmission(g, x0, y0, x1, y1) {
    const ex = Math.floor(x1), ey = Math.floor(y1), sx = Math.floor(x0), sy = Math.floor(y0);
    let tr = 1;
    MAP.walk(x0, y0, x1, y1, (tx, ty) => {
      if ((tx === ex && ty === ey) || (tx === sx && ty === sy)) return false;
      const k = g.m.at(tx, ty);
      if (k === T.WALL || (k === T.EXIT && !g.exitOpen)) { tr = 0; return true; }
      if (k === T.SCREEN) tr *= R.LIGHT.screen;
      return false;
    });
    return tr;
  }

  // ---------- 光 ----------
  function sources(g, exclLamp) {
    const out = [];
    const p = g.p;
    if (p.lampOn && !exclLamp) out.push({ kind: 'lamp', x: p.x, y: p.y, r: R.LIGHT.lamp.r, I: R.LIGHT.lamp.I });
    for (const c of g.m.candles) out.push({ kind: 'candle', x: c.x, y: c.y, r: R.LIGHT.candle.r, I: R.LIGHT.candle.I, fire: true });
    for (const l of g.lures) out.push({ kind: 'lure', x: l.x, y: l.y, r: R.BOOK.borrow.r, I: R.BOOK.borrow.I * Math.min(1, l.t / 2), fire: true });
    for (const f of g.flashes) out.push({ kind: 'flash', x: f.x, y: f.y, r: R.FIRE.flashR, I: f.t / R.FIRE.flashT });
    return out;
  }
  function lightFrom(g, s, x, y) {
    const d = hyp(x - s.x, y - s.y);
    if (d >= s.r) return 0;
    const f = Math.pow(1 - d / s.r, 0.9) * s.I;
    if (f <= 0.003) return 0;
    return f * transmission(g, s.x, s.y, x, y);
  }
  function lightAt(g, x, y, exclLamp) {
    let dark = 1;
    for (const s of sources(g, exclLamp)) dark *= 1 - Math.min(1, lightFrom(g, s, x, y));
    return 1 - dark;
  }

  // ---------- 移動與碰撞 ----------
  function circleBlocked(g, ent, x, y, r) {
    for (let ty = Math.floor(y - r); ty <= Math.floor(y + r); ty++)
      for (let tx = Math.floor(x - r); tx <= Math.floor(x + r); tx++) {
        if (!blocksMove(g, tx, ty, ent)) continue;
        const cx = clamp(x, tx, tx + 1), cy = clamp(y, ty, ty + 1);
        if (hyp(x - cx, y - cy) < r - 1e-6) return true;
      }
    return false;
  }
  function pushOut(g, ent) {
    const r = ent.r;
    for (let it = 0; it < 4; it++) {
      let moved = false;
      for (let ty = Math.floor(ent.y - r); ty <= Math.floor(ent.y + r); ty++)
        for (let tx = Math.floor(ent.x - r); tx <= Math.floor(ent.x + r); tx++) {
          if (!blocksMove(g, tx, ty, ent)) continue;
          const cx = clamp(ent.x, tx, tx + 1), cy = clamp(ent.y, ty, ty + 1);
          const dx = ent.x - cx, dy = ent.y - cy, d = hyp(dx, dy);
          if (d >= r) continue;
          if (d > 1e-6) { ent.x += (dx / d) * (r - d); ent.y += (dy / d) * (r - d); }
          else {
            const l = ent.x - tx, rr = tx + 1 - ent.x, u = ent.y - ty, b = ty + 1 - ent.y, mn = Math.min(l, rr, u, b);
            if (mn === l) ent.x = tx - r; else if (mn === rr) ent.x = tx + 1 + r; else if (mn === u) ent.y = ty - r; else ent.y = ty + 1 + r;
          }
          moved = true;
        }
      if (!moved) break;
    }
  }
  function moveEnt(g, ent, dx, dy) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.1));
    for (let k = 0; k < n; k++) { ent.x += dx / n; pushOut(g, ent); ent.y += dy / n; pushOut(g, ent); }
  }
  // 帶半徑的直線可走：每 0.12 格查一次
  function clearMove(g, ent, x0, y0, x1, y1) {
    const d = hyp(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 0.12));
    for (let k = 1; k <= n; k++) { const f = k / n; if (circleBlocked(g, ent, x0 + (x1 - x0) * f, y0 + (y1 - y0) * f, ent.r)) return false; }
    return true;
  }
  // 尋路：八方向、不切牆角的寬度優先；走不到就走到離目標最近、走得到的那一格（例如被封戶擋住時在門前等）
  function findPath(g, ent, gx, gy) {
    const W = g.m.W, H = g.m.H, N = W * H;
    const prev = g._prev || (g._prev = new Int32Array(N)), seen = g._seen || (g._seen = new Uint8Array(N));
    seen.fill(0);
    const sx = Math.floor(ent.x), sy = Math.floor(ent.y), s = sy * W + sx, goal = gy * W + gx;
    const q = [s]; seen[s] = 1; prev[s] = -1;
    let best = s, bestD = hyp(sx - gx, sy - gy);
    const ok = (x, y) => x >= 0 && y >= 0 && x < W && y < H && !blocksMove(g, x, y, ent);
    for (let qi = 0; qi < q.length; qi++) {
      const i = q[qi], x = i % W, y = (i / W) | 0;
      if (i === goal) { best = i; break; }
      const d = hyp(x - gx, y - gy);
      if (d < bestD) { bestD = d; best = i; }
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy, ni = ny * W + nx;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H || seen[ni] || !ok(nx, ny)) continue;
        if (dx && dy && (!ok(x + dx, y) || !ok(x, y + dy))) continue;
        seen[ni] = 1; prev[ni] = i; q.push(ni);
      }
    }
    const path = [];
    for (let i = best; i !== -1 && i !== s; i = prev[i]) path.push([(i % W) + 0.5, ((i / W) | 0) + 0.5]);
    path.reverse();
    return { path, reach: best === goal };
  }

  // ---------- 建立一局 ----------
  function create(opt) {
    opt = opt || {};
    const m = MAP.parse(opt.rows);
    const seed = opt.seed == null ? 1 : opt.seed;
    const lo = Object.assign({ armor: R.P.armorMax, talismans: R.P.talismans, ink: R.P.ink }, opt.loadout || {});
    const g = {
      R, m, seed, rand: rng(seed), t: 0, state: 'play', events: [], acc: 0, nid: 1,
      exitOpen: false, seals: { name: false, breath: false },
      sealed: new Map(), lures: [], flashes: [], shots: [],
      explored: new Uint8Array(m.W * m.H), hints: new Set(), press: {}, exposedNow: true,
      stats: { bites: 0, whiffs: 0, swordHits: 0, swordMiss: 0, bells: 0, fires: 0, booms: 0, reads: 0, readCancel: 0, sealsPlaced: 0, lures: 0, disperse: 0, interrupts: 0, maxChill: 0, stuck: 0, armorLost: 0, takes: 0 }
    };
    g.p = { kind: 'p', x: m.start.x, y: m.start.y, r: R.P.r, aim: -PI / 2, lampOn: true, adapt: 0, chill: 0, armor: lo.armor, talismans: lo.talismans, ink: lo.ink,
      swordCD: 0, bellCD: 0, act: null, reading: null, taking: null, bitten: false, moving: false };
    g.pos = m.po.map((s, i) => ({
      kind: 'po', id: i + 1, x: s.x, y: s.y, r: R.PO.r, hp: R.PO.hp, state: s.dormant ? 'dormant' : 'patrol',
      way: (opt.way || (i === 0 ? R.WAY.po1 : R.WAY.po2)).map(([x, y]) => [x + 0.5, y + 0.5]),
      goal: null, linger: 0, lastKnown: null, lostT: 0, path: null, pathGoal: -1, repathT: 0, waiting: 0,
      windT: 0, windVisible: false, stateT: 0, stag: 0, kvx: 0, kvy: 0, kt: 0, burnT: 0, goneT: 0, formSpot: null, formWait: 0,
      stuck: 0, sample: { x: s.x, y: s.y, t: 0 }, vis: null, sees: false, lureId: 0
    }));
    g.altars = m.altars.map((a) => Object.assign({ taken: false }, a));
    g.pickups = m.pickups.map((p) => Object.assign({ taken: false }, p));
    Object.assign(g, api(g));
    hint(g, 'start');
    return g;
  }

  function emit(g, type, o) { const e = Object.assign({ type, t: g.t }, o || {}); g.events.push(e); if (g.events.length > 400) g.events.splice(0, g.events.length - 400); return e; }
  function hint(g, key, o) { if (g.hints.has(key)) return; g.hints.add(key); emit(g, 'hint', Object.assign({ key }, o || {})); }
  function addChill(g, amt) { const p = g.p; p.chill = clamp(p.chill + amt, 0, R.P.chillMax); if (p.chill > g.stats.maxChill) g.stats.maxChill = p.chill; }
  const tangible = (e) => e.state !== 'gone';
  const awake = (e) => e.state !== 'gone' && e.state !== 'dormant';
  const dist = (a, b) => hyp(a.x - b.x, a.y - b.y);

  // ---------- 看見與被看見 ----------
  function exposed(g) { return g.p.lampOn || lightAt(g, g.p.x, g.p.y, true) > R.EXPOSE.light; }
  function poSees(g, e) {
    const p = g.p, d = dist(p, e);
    if (d > R.EXPOSE.see) return false;
    const line = sightLine(g, e.x, e.y, p.x, p.y);
    if (line === 'blocked') return false;
    if (g.exposedNow) return line === 'clear' ? true : d <= R.EXPOSE.seeScreen;   // 紙擋得住人，擋不住燈
    return line === 'clear' && d <= R.EXPOSE.dark;
  }
  // 人看不看得見這隻魄：lit 照見；dark 眼睛習慣黑暗後看見微光；silhouette 隔著紙屏看到剪影
  function poVis(g, e) {
    if (!tangible(e)) return null;
    const p = g.p, d = dist(p, e);
    if (d > 12) return null;
    const line = sightLine(g, p.x, p.y, e.x, e.y);
    if (line === 'blocked') return null;
    const L = lightAt(g, e.x, e.y, false);
    if (line === 'paper') return L >= 0.3 && d <= 9 ? { mode: 'silhouette', a: Math.min(1, L) } : null;
    if (L >= 0.15) return { mode: 'lit', a: Math.min(1, 0.35 + L) };
    if (!p.lampOn && p.adapt > 0.15 && d <= p.adapt * R.LAMP.adaptR) return { mode: 'dark', a: p.adapt * (1 - d / (R.LAMP.adaptR + 1)) };
    return null;
  }
  // 凝形的地方看不看得見（同一套規則，只是那裡還沒有魄）
  function spotVisible(g, s) {
    const p = g.p, d = dist(p, s);
    if (d > 12) return false;
    if (sightLine(g, p.x, p.y, s.x, s.y) !== 'clear') return false;
    if (lightAt(g, s.x, s.y, false) >= 0.15) return true;
    return !p.lampOn && p.adapt > 0.15 && d <= p.adapt * R.LAMP.adaptR;
  }

  // ---------- 魄 ----------
  function stepTo(g, e, x, y, speed, dt) {
    const dx = x - e.x, dy = y - e.y, d = hyp(dx, dy);
    if (d < 1e-6) return 0;
    const s = Math.min(speed * dt, d);
    moveEnt(g, e, (dx / d) * s, (dy / d) * s);
    return s;
  }
  // 能安全直達就直接走（md：同格追尋）；要繞牆才用尋路
  function moveToward(g, e, goal, speed, dt) {
    e.waiting = 0;
    if (clearMove(g, e, e.x, e.y, goal.x, goal.y)) { e.path = null; stepTo(g, e, goal.x, goal.y, speed, dt); return; }
    const W = g.m.W, gtx = Math.floor(goal.x), gty = Math.floor(goal.y), gi = gty * W + gtx;
    e.repathT -= dt;
    if (!e.path || e.repathT <= 0 || e.pathGoal !== gi) { const r = findPath(g, e, gtx, gty); e.path = r.path; e.reach = r.reach; e.repathT = R.PO.repath; e.pathGoal = gi; }
    while (e.path.length && hyp(e.path[0][0] - e.x, e.path[0][1] - e.y) < 0.25) e.path.shift();
    if (!e.path.length) { e.waiting = 1; return; }   // 走不到（封戶擋住）：在最近的地方等
    let k = 0;
    for (let i = Math.min(e.path.length - 1, 5); i > 0; i--) if (clearMove(g, e, e.x, e.y, e.path[i][0], e.path[i][1])) { k = i; break; }
    stepTo(g, e, e.path[k][0], e.path[k][1], speed, dt);
  }
  function nextWay(g, e) {
    const w = e.way;
    let i = Math.floor(g.rand() * w.length);
    if (e.goal && w.length > 1 && w[i][0] === e.goal.x && w[i][1] === e.goal.y) i = (i + 1) % w.length;
    e.goal = { x: w[i][0], y: w[i][1] };
    e.linger = R.PO.lingerMin + g.rand() * (R.PO.lingerMax - R.PO.lingerMin);
  }
  function searchGoal(g, e) {
    const c = e.lastKnown || e;
    for (let k = 0; k < 10; k++) {
      const a = g.rand() * 2 * PI, r = 0.5 + g.rand() * R.PO.searchR, x = c.x + Math.cos(a) * r, y = c.y + Math.sin(a) * r;
      if (!circleBlocked(g, e, x, y, e.r)) return { x, y };
    }
    return { x: c.x, y: c.y };
  }
  function lureFor(g, e) {
    let best = null, bd = R.PO.lureR;
    for (const l of g.lures) { if (l.t < 1) continue; const d = dist(e, l); if (d < bd) { bd = d; best = l; } }
    return best;
  }
  function resume(g, e) { e.state = e.sees ? 'chase' : e.lastKnown ? 'investigate' : 'patrol'; e.goal = null; }
  function wake(g, e, at, why) {
    if (e.state !== 'dormant') return;
    e.state = 'investigate'; e.lastKnown = { x: at.x, y: at.y }; e.goal = null;
    emit(g, 'wake', { id: e.id, why, x: e.x, y: e.y });
  }
  function startWindup(g, e) {
    e.state = 'windup'; e.windT = R.PO.windT;
    const v = poVis(g, e);
    e.windVisible = !!(v && (v.mode === 'lit' || v.mode === 'dark'));
    emit(g, 'windup', { id: e.id, visible: e.windVisible, x: e.x, y: e.y, dx: e.x - g.p.x, dist: dist(e, g.p) });
    if (e.windVisible) hint(g, 'windup');
  }
  function resolveBite(g, e) {
    const p = g.p, d = dist(p, e);
    if (d <= R.PO.biteR && hitClear(g, e.x, e.y, p.x, p.y)) {
      const a = Math.min(p.armor, R.PO.bite);
      p.armor -= a; g.stats.armorLost += a; addChill(g, R.PO.bite - a);
      p.bitten = true; g.stats.bites++;
      if (d > 1e-6) moveEnt(g, p, ((p.x - e.x) / d) * R.P.biteKnock, ((p.y - e.y) / d) * R.P.biteKnock);
      e.state = 'recoil'; e.stateT = R.PO.recoilT;
      emit(g, 'bite', { id: e.id, absorbed: a, chill: R.PO.bite - a, x: p.x, y: p.y });
      hint(g, a > 0 ? 'bite' : 'biteBare');
    } else {
      g.stats.whiffs++; e.state = 'recover'; e.stateT = R.PO.whiffT;
      emit(g, 'whiff', { id: e.id, x: e.x, y: e.y, visible: e.windVisible });
    }
  }
  function hurtPo(g, e, amt, o) {
    if (!tangible(e)) return false;
    if (e.state === 'dormant') wake(g, e, g.p, 'hit');
    e.hp -= amt;
    if (e.state === 'windup') { g.stats.interrupts++; emit(g, 'interrupt', { id: e.id, by: o.src }); }
    if (o.stagger) { e.stag = e.state === 'stagger' ? Math.max(e.stag, o.stagger) : o.stagger; e.state = 'stagger'; }
    if (o.knock) {
      const dx = e.x - o.fx, dy = e.y - o.fy, d = hyp(dx, dy) || 1, KT = 0.1;   // 擊退在 0.1 秒內走完（比最短的停頓 0.12 秒短）
      e.kvx = (dx / d) * o.knock / KT; e.kvy = (dy / d) * o.knock / KT; e.kt = KT;
    }
    if (e.hp <= 0) disperse(g, e, o.src);
    return true;
  }
  function disperse(g, e, why) {
    e.state = 'gone'; e.goneT = R.PO.reformT; e.formSpot = null; e.formWait = 0; e.burnT = 0; e.kt = 0; e.path = null; e.vis = null;
    g.stats.disperse++;
    emit(g, 'disperse', { id: e.id, why, x: e.x, y: e.y });
  }
  // 凝回：選離人遠的巡行點；最後 1.5 秒才顯形；人在旁邊就延後，等太久換地方
  function pickReform(g, e) {
    const p = g.p, all = e.way;
    const far = all.filter(([x, y]) => hyp(x - p.x, y - p.y) >= R.PO.reformFar && !circleBlocked(g, e, x, y, e.r));
    if (far.length) { const w = far[Math.floor(g.rand() * far.length)]; return { x: w[0], y: w[1] }; }
    let best = all[0], bd = -1;
    for (const w of all) { const d = hyp(w[0] - p.x, w[1] - p.y); if (d > bd) { bd = d; best = w; } }
    return { x: best[0], y: best[1] };
  }
  function updateGone(g, e, dt) {
    e.goneT -= dt;
    if (e.goneT <= R.PO.formT && !e.formSpot) { e.formSpot = pickReform(g, e); emit(g, 'reformStart', { id: e.id, x: e.formSpot.x, y: e.formSpot.y }); }
    if (e.goneT > 0) return;
    const s = e.formSpot;
    if (dist(g.p, s) < R.PO.formClear || circleBlocked(g, e, s.x, s.y, e.r)) {
      e.goneT = 0; e.formWait += dt;
      if (e.formWait >= R.PO.formRepick) { e.formSpot = pickReform(g, e); e.goneT = R.PO.formT; e.formWait = 0; emit(g, 'reformStart', { id: e.id, x: e.formSpot.x, y: e.formSpot.y, moved: true }); }
      return;
    }
    e.x = s.x; e.y = s.y; e.hp = R.PO.hp; e.state = 'patrol'; e.goal = null; e.lastKnown = null; e.formSpot = null; e.path = null;
    e.sample = { x: e.x, y: e.y, t: g.t };
    emit(g, 'reform', { id: e.id, x: e.x, y: e.y });
  }
  function updatePo(g, e, dt) {
    if (e.state === 'dormant') { e.vis = poVis(g, e); return; }
    if (e.state === 'gone') { updateGone(g, e, dt); return; }
    if (e.burnT > 0) { e.burnT -= dt; e.hp -= R.FIRE.burn * dt; if (e.hp <= 0) { disperse(g, e, 'burn'); return; } }   // 灼燒只扣血
    if (e.kt > 0) { const s = Math.min(dt, e.kt); moveEnt(g, e, e.kvx * s, e.kvy * s); e.kt -= s; }
    const p = g.p, d = dist(p, e);
    const sees = poSees(g, e);
    e.sees = sees;
    if (sees) { e.lastKnown = { x: p.x, y: p.y }; e.lostT = 0; } else e.lostT += dt;
    e.vis = poVis(g, e);
    if (e.vis) hint(g, 'seePo');
    switch (e.state) {
      case 'stagger': e.stag -= dt; if (e.stag <= 0) resume(g, e); break;
      case 'windup': e.windT -= dt; if (e.windT <= 0) resolveBite(g, e); break;   // 蓄撲時停步
      case 'recover': case 'recoil': e.stateT -= dt; if (e.stateT <= 0) resume(g, e); break;
      default: think(g, e, dt, sees, d);
    }
    // 久留身邊：寒意（不經護心衣；隔牆、隔紙屏、隔封戶都傳不過來）
    if (awake(e) && d <= R.PO.auraR && hitClear(g, e.x, e.y, p.x, p.y)) addChill(g, R.PO.aura * dt);
    // 卡住偵測：該走卻一直沒動，就重新尋路（測試也看這個數）
    if (g.t - e.sample.t >= 0.5) {
      const moved = hyp(e.x - e.sample.x, e.y - e.sample.y);
      const shouldMove = ['chase', 'investigate', 'search', 'lure', 'patrol'].includes(e.state) && !e.waiting && !(e.state === 'patrol' && e.lingering) && !(e.state === 'lure' && e.lingering);
      if (shouldMove && moved < 0.05) e.stuck += g.t - e.sample.t; else e.stuck = 0;
      if (e.stuck >= R.PO.stuckT) { g.stats.stuck++; emit(g, 'stuck', { id: e.id, state: e.state, x: e.x, y: e.y }); e.path = null; e.repathT = 0; e.goal = null; e.stuck = 0; }
      e.sample = { x: e.x, y: e.y, t: g.t };
    }
  }
  function think(g, e, dt, sees, d) {
    const P = R.PO;
    if (sees && e.state !== 'chase') { e.state = 'chase'; emit(g, 'spotted', { id: e.id }); }
    if (e.state !== 'chase' && e.state !== 'investigate' && e.state !== 'lure') { const l = lureFor(g, e); if (l) { e.state = 'lure'; e.lureId = l.id; e.goal = null; } }
    e.lingering = false;
    switch (e.state) {
      case 'chase': {
        if (!sees && e.lostT > P.loseT) { e.state = 'investigate'; break; }
        if (d <= P.windStart && hitClear(g, e.x, e.y, g.p.x, g.p.y)) { startWindup(g, e); break; }
        moveToward(g, e, e.lastKnown, P.chase, dt);
        break;
      }
      case 'investigate': {
        const k = e.lastKnown;
        if (!k) { e.state = 'patrol'; break; }
        if (hyp(k.x - e.x, k.y - e.y) < 0.45) { e.state = 'search'; e.stateT = P.searchT; e.goal = null; break; }
        moveToward(g, e, k, P.investigate, dt);
        if (e.waiting) { e.stateT += dt; if (e.stateT > 2) { e.state = 'search'; e.stateT = P.searchT; e.goal = null; } } else e.stateT = 0;
        break;
      }
      case 'search': {
        e.stateT -= dt;
        if (e.stateT <= 0) { e.state = 'patrol'; e.goal = null; e.lastKnown = null; break; }
        if (!e.goal || hyp(e.goal.x - e.x, e.goal.y - e.y) < 0.3 || e.waiting) e.goal = searchGoal(g, e);
        moveToward(g, e, e.goal, P.patrol, dt);
        break;
      }
      case 'lure': {
        const l = g.lures.find((q) => q.id === e.lureId);
        if (!l) { e.state = 'patrol'; e.goal = null; break; }
        if (hyp(l.x - e.x, l.y - e.y) < 1.4) {   // 到了火邊：繞著火打轉
          e.lingering = true;
          if (!e.goal || hyp(e.goal.x - e.x, e.goal.y - e.y) < 0.3) { const a = g.rand() * 2 * PI; e.goal = { x: l.x + Math.cos(a) * 1.0, y: l.y + Math.sin(a) * 1.0 }; if (circleBlocked(g, e, e.goal.x, e.goal.y, e.r)) e.goal = { x: l.x, y: l.y }; }
          moveToward(g, e, e.goal, P.patrol * 0.6, dt);
        } else moveToward(g, e, l, P.investigate, dt);
        break;
      }
      default: {   // patrol
        e.state = 'patrol';
        if (!e.goal) nextWay(g, e);
        if (hyp(e.goal.x - e.x, e.goal.y - e.y) < 0.35) { e.lingering = true; e.linger -= dt; if (e.linger <= 0) nextWay(g, e); break; }
        moveToward(g, e, e.goal, P.patrol, dt);
        if (e.waiting) nextWay(g, e);
      }
    }
  }

  // ---------- 人的動作 ----------
  function nearPo(g) {   // 貼近一隻沒被震退的魄（距離用撲擊範圍，不留空隙）
    const p = g.p;
    return g.pos.some((e) => awake(e) && e.state !== 'stagger' && dist(p, e) <= R.PO.biteR && hitClear(g, e.x, e.y, p.x, p.y));
  }
  function cancelRead(g, why) {
    const r = g.p.reading; if (!r) return;
    g.p.reading = null; g.stats.readCancel++;
    emit(g, 'readCancel', { why, spell: r.spell, ink: g.p.ink });
  }
  function cancelTake(g, why) { if (!g.p.taking) return; g.p.taking = null; emit(g, 'takeCancel', { why }); }
  function findDoor(g) {
    const p = g.p; let best = null, bd = 1e9;
    for (const dr of g.m.doors) {
      const d = hyp(dr.x + 0.5 - p.x, dr.y + 0.5 - p.y);
      if (d <= R.BOOK.seal.reach && d < bd) { bd = d; best = dr; }
    }
    if (!best) return { ok: false, why: 'far' };
    if (g.sealed.has(best.i)) return { ok: false, why: 'already', door: best };
    const cx = clamp(p.x, best.x, best.x + 1), cy = clamp(p.y, best.y, best.y + 1);
    if (hyp(p.x - cx, p.y - cy) < p.r) return { ok: false, why: 'standing', door: best };
    return { ok: true, door: best };
  }
  function borrowSpot(g, target) {
    const p = g.p;
    let a = p.aim, want = 3;
    if (target) { a = Math.atan2(target.y - p.y, target.x - p.x); want = Math.min(R.BOOK.borrow.range, hyp(target.x - p.x, target.y - p.y)); }
    want = Math.max(0.6, Math.min(R.BOOK.borrow.range, want));
    let x = p.x, y = p.y;
    for (let s = 0.1; s <= want + 1e-9; s += 0.1) {
      const nx = p.x + Math.cos(a) * s, ny = p.y + Math.sin(a) * s;
      if (blocksHit(g, Math.floor(nx), Math.floor(ny)) || g.m.at(Math.floor(nx), Math.floor(ny)) === T.LOW) break;
      x = nx; y = ny;
    }
    return { x, y };
  }
  function tryRead(g, spell, target) {
    const p = g.p, B = R.BOOK[spell];
    if (p.reading || p.act || p.taking) { emit(g, 'busy', { what: spell }); return; }
    if (p.ink < B.cost) { emit(g, 'noInk', { spell }); return; }
    if (nearPo(g)) { emit(g, 'readBlocked', { spell }); return; }
    let spot = null;
    if (spell === 'seal') { const f = findDoor(g); if (!f.ok) { emit(g, 'sealNoDoor', { why: f.why }); return; } spot = f.door; }
    else spot = borrowSpot(g, target);
    p.reading = { spell, t: 0, dur: B.read, spot };
    emit(g, 'readStart', { spell });
  }
  function completeRead(g) {
    const p = g.p, r = p.reading, B = R.BOOK[r.spell];
    p.reading = null;
    if (r.spell === 'seal') {
      const f = findDoor(g);
      if (!f.ok || f.door.i !== r.spot.i) { emit(g, 'sealNoDoor', { why: f.why || 'moved' }); return; }
      const dr = r.spot, ex = new Set();
      for (const e of g.pos) if (tangible(e)) { const cx = clamp(e.x, dr.x, dr.x + 1), cy = clamp(e.y, dr.y, dr.y + 1); if (hyp(e.x - cx, e.y - cy) < e.r) ex.add(e.id); }
      g.sealed.set(dr.i, { id: g.nid++, x: dr.x, y: dr.y, t: B.life, exempt: ex });
      for (const e of g.pos) { e.path = null; e.repathT = 0; }
      g.stats.sealsPlaced++;
      emit(g, 'sealDone', { x: dr.x, y: dr.y, exempt: [...ex] });
    } else {
      g.lures.push({ id: g.nid++, x: r.spot.x, y: r.spot.y, t: B.life });
      g.stats.lures++;
      emit(g, 'borrowDone', { x: r.spot.x, y: r.spot.y });
    }
    p.ink -= B.cost; g.stats.reads++;
  }
  function tryBell(g) {
    const p = g.p;
    if (p.bellCD > 1e-6) { emit(g, 'cooldown', { what: 'bell', left: p.bellCD }); return; }
    if (p.reading) cancelRead(g, 'bell');   // 先合書（不耗墨）再搖鈴
    if (p.taking) cancelTake(g, 'bell');
    p.bellCD = R.BELL.cd; g.stats.bells++;
    emit(g, 'bell', { x: p.x, y: p.y });
    for (const e of g.pos) {
      if (!tangible(e)) continue;
      const d = dist(p, e);
      if (awake(e) && d <= R.BELL.r + e.r && hitClear(g, p.x, p.y, e.x, e.y)) hurtPo(g, e, R.BELL.dmg, { stagger: R.BELL.stun, knock: R.BELL.knock, fx: p.x, fy: p.y, src: 'bell' });
      if (!tangible(e)) continue;
      if (d <= R.BELL.hear) {   // 紙宅擋不住聲音：鈴聲把魄引來
        if (e.state === 'dormant') wake(g, e, p, 'bell');
        else { e.lastKnown = { x: p.x, y: p.y }; if (['patrol', 'search', 'lure'].includes(e.state)) { e.state = 'investigate'; e.stateT = 0; } }
      }
    }
    hint(g, 'bell');
  }
  function trySword(g) {
    const p = g.p;
    if (p.reading || p.taking) { emit(g, 'busy', { what: 'sword' }); return; }
    if (p.act) return;
    if (p.swordCD > 1e-6) { emit(g, 'cooldown', { what: 'sword', left: p.swordCD }); return; }
    p.swordCD = R.SWORD.cd;
    p.act = { kind: 'sword', t: R.SWORD.windup, dir: p.aim };   // 方向在起手時定，位置用出手那一刻的
  }
  function tryFire(g) {
    const p = g.p;
    if (p.reading || p.taking) { emit(g, 'busy', { what: 'fire' }); return; }
    if (p.act) return;
    if (p.talismans <= 0) { emit(g, 'noTalisman'); return; }
    p.talismans--;
    p.act = { kind: 'fire', t: R.FIRE.windup, dir: p.aim };
  }
  function swordRelease(g, dir) {
    const p = g.p, arc = (R.SWORD.arc * PI) / 180;
    let best = null, bd = 1e9, why = 'none';
    for (const e of g.pos) {
      if (!tangible(e)) continue;
      const dx = e.x - p.x, dy = e.y - p.y, d = hyp(dx, dy);
      const close = d <= p.r + e.r + 0.05;   // 貼身時不管方向
      if (d > R.SWORD.reach) { if (d <= R.SWORD.reach + 0.8 && why === 'none') why = 'far'; continue; }
      if (!close && angDiff(Math.atan2(dy, dx), dir) > arc) { why = 'dir'; continue; }
      if (!hitClear(g, p.x, p.y, e.x, e.y)) { why = 'wall'; continue; }
      if (d < bd) { bd = d; best = e; }
    }
    emit(g, 'swing', { x: p.x, y: p.y, dir });
    if (best) {
      hurtPo(g, best, R.SWORD.dmg, { stagger: R.SWORD.stagger, knock: R.SWORD.knock, fx: p.x, fy: p.y, src: 'sword' });
      g.stats.swordHits++;
      emit(g, 'swordHit', { id: best.id, x: best.x, y: best.y });
    } else {
      g.stats.swordMiss++;
      emit(g, 'swordMiss', { why, x: p.x + Math.cos(dir) * 0.9, y: p.y + Math.sin(dir) * 0.9 });
      hint(g, 'whiff');
    }
  }
  function boom(g, x, y) {
    g.stats.booms++;
    g.flashes.push({ x, y, t: R.FIRE.flashT });
    const hit = [];
    for (const e of g.pos) {
      if (!tangible(e)) continue;
      if (hyp(e.x - x, e.y - y) <= R.FIRE.boom + e.r && hitClear(g, x, y, e.x, e.y)) {
        hurtPo(g, e, R.FIRE.dmg, { stagger: R.FIRE.stagger, knock: R.FIRE.knock, fx: x, fy: y, src: 'fire' });
        if (tangible(e)) e.burnT = R.FIRE.burnT;
        hit.push(e.id);
      }
    }
    emit(g, 'fireBoom', { x, y, hit });
  }
  function updateShots(g, dt) {
    const F = R.FIRE;
    for (const s of g.shots) {
      let left = F.speed * dt;
      while (left > 0 && !s.done) {
        const st = Math.min(0.1, left); left -= st;
        const nx = s.x + Math.cos(s.dir) * st, ny = s.y + Math.sin(s.dir) * st;
        const hitPo = g.pos.find((e) => tangible(e) && hyp(e.x - nx, e.y - ny) <= e.r + 0.08);   // 射線先碰到的那隻魄
        if (hitPo) { s.done = true; boom(g, nx, ny); break; }
        if (blocksHit(g, Math.floor(nx), Math.floor(ny))) {   // 碰牆：在牆前引燃，火心不會在牆裡
          s.done = true; boom(g, s.x - Math.cos(s.dir) * 0.05, s.y - Math.sin(s.dir) * 0.05); break;
        }
        s.x = nx; s.y = ny; s.dist += st;
        if (s.dist >= F.range) { s.done = true; boom(g, s.x, s.y); }
      }
    }
    g.shots = g.shots.filter((s) => !s.done);
  }
  function tryTake(g) {
    const p = g.p;
    if (p.reading || p.act || p.taking) return;
    const a = g.altars.find((q) => !q.taken && dist(p, q) <= R.TAKE.reach);
    if (!a) return;
    p.taking = { a, t: 0 };
    emit(g, 'takeStart', { key: a.key });
  }
  function completeTake(g) {
    const p = g.p, a = p.taking.a, K = R.TAKE;
    p.taking = null; a.taken = true; g.seals[a.key] = true; g.stats.takes++;
    p.armor = Math.min(R.P.armorMax, p.armor + K.armor);
    p.talismans = Math.min(R.P.talismanMax, p.talismans + K.talisman);
    p.ink = Math.min(R.P.inkMax, p.ink + K.ink);
    p.chill = Math.max(0, p.chill + K.chill);
    emit(g, 'seal', { key: a.key, glyph: a.glyph });
    const both = g.seals.name && g.seals.breath;
    if (!both) {
      for (const e of g.pos) wake(g, e, a, 'seal');
      hint(g, 'seal1');
    } else {
      g.exitOpen = true;
      const hall = R.WAY.hall.map(([x, y]) => [x + 0.5, y + 0.5]);
      for (const e of g.pos) {
        if (e.state === 'dormant') wake(g, e, { x: R.HALL[0], y: R.HALL[1] }, 'seal');
        e.way = e.way.concat(hall);
        if (awake(e) && ['patrol', 'search', 'lure'].includes(e.state)) { e.state = 'investigate'; e.stateT = 0; e.lastKnown = { x: R.HALL[0], y: R.HALL[1] }; }
      }
      emit(g, 'exitOpen');
      hint(g, 'seal2');
    }
  }

  // ---------- 一步 ----------
  function step(g, dt, inp) {
    if (g.state !== 'play') return;
    inp = inp || {};
    const press = g.press; g.press = {};
    const hold = inp.hold || {};
    const p = g.p;
    g.t += dt;
    p.bitten = false;
    // 封戶、借火、火光的時間
    for (const [i, s] of g.sealed) {
      s.t -= dt;
      for (const id of [...s.exempt]) { const e = g.pos.find((q) => q.id === id); const cx = clamp(e.x, s.x, s.x + 1), cy = clamp(e.y, s.y, s.y + 1); if (!tangible(e) || hyp(e.x - cx, e.y - cy) >= e.r) s.exempt.delete(id); }
      if (s.t <= 0) { g.sealed.delete(i); emit(g, 'sealEnd', { x: s.x, y: s.y }); }
    }
    for (const l of g.lures) l.t -= dt;
    g.lures = g.lures.filter((l) => l.t > 0);
    for (const f of g.flashes) f.t -= dt;
    g.flashes = g.flashes.filter((f) => f.t > 0);
    // 人
    p.swordCD = Math.max(0, p.swordCD - dt); p.bellCD = Math.max(0, p.bellCD - dt);
    if (inp.aim != null) p.aim = inp.aim;
    if (press.lamp) { p.lampOn = !p.lampOn; if (p.lampOn) p.adapt = 0; emit(g, 'lamp', { on: p.lampOn }); if (!p.lampOn) hint(g, 'dark'); }
    let mx = inp.mx || 0, my = inp.my || 0;
    const ml = hyp(mx, my), moving = ml > 0.05;
    if (ml > 1) { mx /= ml; my /= ml; }
    if (p.reading && moving) cancelRead(g, 'move');
    if (p.taking && (moving || !hold.take)) cancelTake(g, moving ? 'move' : 'release');
    p.moving = false;
    if (!p.reading && !p.taking && moving) { moveEnt(g, p, mx * R.P.speed * dt, my * R.P.speed * dt); p.moving = true; }
    if (press.bell) tryBell(g);
    if (press.sword) trySword(g);
    if (press.fire) tryFire(g);
    if (press.read1) tryRead(g, 'borrow', inp.target || null);
    if (press.read2) tryRead(g, 'seal');
    if (hold.take && !p.taking) tryTake(g);
    for (const k of g.pickups) if (!k.taken && dist(p, k) < 0.6) { k.taken = true; p.talismans = Math.min(R.P.talismanMax, p.talismans + 1); emit(g, 'pickup', { kind: k.kind }); }
    if (!g.hints.has('altar') && g.altars.some((a) => !a.taken && dist(p, a) < 2)) hint(g, 'altar');
    // 暴露與眼睛
    const ambient = lightAt(g, p.x, p.y, true);
    g.exposedNow = p.lampOn || ambient > R.EXPOSE.light;
    if (p.lampOn) p.adapt = 0;
    else if (ambient >= R.LAMP.glare) p.adapt = Math.max(0, p.adapt - dt / R.LAMP.adaptLoss);
    else { p.adapt = Math.min(1, p.adapt + dt / R.LAMP.adaptT); if (p.adapt >= 1) hint(g, 'adapted'); }
    // 魄
    for (const e of g.pos) updatePo(g, e, dt);
    // 人與魄不重疊：先推魄，推不動再推人
    for (const e of g.pos) {
      if (!tangible(e)) continue;
      const d = dist(p, e), min = p.r + e.r;
      if (d >= min) continue;
      if (e.state === 'dormant') wake(g, e, p, 'touch');   // 撞到睡著的魄，它就醒了
      const nx = d > 1e-6 ? (e.x - p.x) / d : 1, ny = d > 1e-6 ? (e.y - p.y) / d : 0;
      moveEnt(g, e, nx * (min - d), ny * (min - d));
      const d2 = dist(p, e);
      if (d2 < min - 1e-3) moveEnt(g, p, -nx * (min - d2), -ny * (min - d2));
    }
    // 人出手
    if (p.act) { p.act.t -= dt; if (p.act.t <= 0) { const a = p.act; p.act = null; if (a.kind === 'sword') swordRelease(g, a.dir); else { g.shots.push({ x: p.x, y: p.y, dir: a.dir, dist: 0 }); g.stats.fires++; emit(g, 'fireThrow', { x: p.x, y: p.y, dir: a.dir }); } } }
    updateShots(g, dt);
    // 讀咒：先查中斷，最後才完成
    if (p.reading) {
      p.reading.t += dt;
      if (p.bitten) cancelRead(g, 'bite');
      else if (nearPo(g)) cancelRead(g, 'near');
      else if (p.reading.t >= p.reading.dur) completeRead(g);
    }
    // 取印
    if (p.taking) {
      if (p.bitten) cancelTake(g, 'bite');
      else { p.taking.t += dt; if (p.taking.t >= R.TAKE.t) completeTake(g); }
    }
    // 取暖：燭與借火旁（站在火光裡，同時也是暴露）
    for (const s of sources(g, true)) if (s.fire && hyp(s.x - p.x, s.y - p.y) <= R.WARM.r && hitClear(g, s.x, s.y, p.x, p.y)) { p.chill = Math.max(0, p.chill - R.WARM.rate * dt); break; }
    if (p.chill >= 60) hint(g, 'chill');
    // 勝負
    if (p.chill >= R.P.chillMax) { g.state = 'lose'; emit(g, 'lose'); }
    else if (g.exitOpen && g.m.at(Math.floor(p.x), Math.floor(p.y)) === T.EXIT) { g.state = 'win'; emit(g, 'win', { t: g.t }); }
  }

  // ---------- 畫面要的：每格的光與看見程度、走過的地圖 ----------
  function view(g, rad) {
    const m = g.m, W = m.W, H = m.H, p = g.p;
    const light = g._light || (g._light = new Float32Array(W * H));
    const vis = g._vis || (g._vis = new Float32Array(W * H));
    const paper = g._paper || (g._paper = new Uint8Array(W * H));
    light.fill(0); vis.fill(0); paper.fill(0);
    for (const s of sources(g, false)) {
      for (let ty = Math.max(0, Math.floor(s.y - s.r)); ty <= Math.min(H - 1, Math.floor(s.y + s.r)); ty++)
        for (let tx = Math.max(0, Math.floor(s.x - s.r)); tx <= Math.min(W - 1, Math.floor(s.x + s.r)); tx++) {
          const l = lightFrom(g, s, tx + 0.5, ty + 0.5);
          if (l > 0) { const i = ty * W + tx; light[i] = 1 - (1 - light[i]) * (1 - Math.min(1, l)); }
        }
    }
    rad = rad || 13;
    const dark = !p.lampOn && p.adapt > 0 ? p.adapt : 0, dr = dark * R.LAMP.adaptR;
    const x0 = Math.max(0, Math.floor(p.x - rad)), x1 = Math.min(W - 1, Math.floor(p.x + rad));
    const y0 = Math.max(0, Math.floor(p.y - rad)), y1 = Math.min(H - 1, Math.floor(p.y + rad));
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const i = ty * W + tx, k = m.t[i];
      if (k === T.WALL) continue;
      const cx = tx + 0.5, cy = ty + 0.5, d = hyp(cx - p.x, cy - p.y);
      if (d > rad) continue;
      const line = sightLine(g, p.x, p.y, cx, cy);
      if (line === 'blocked') continue;
      if (line === 'paper') { vis[i] = light[i] * R.LIGHT.paperGlow; paper[i] = 1; continue; }
      let b = light[i];
      if (dark && d < dr + 0.5) b = Math.max(b, 0.26 * dark * Math.pow(clamp(1 - d / (dr + 0.5), 0, 1), 0.6));
      vis[i] = b;
    }
    // 牆：只在看得見、被照到的那一面亮
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
      const i = ty * W + tx;
      if (m.t[i] !== T.WALL && !(m.t[i] === T.EXIT && !g.exitOpen)) continue;
      let b = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (m.t[j] === T.WALL || paper[j]) continue;
        b = Math.max(b, vis[j] * (dx && dy ? 0.7 : 0.95));
      }
      vis[i] = b;
    }
    // 小地圖：只記看清楚過的格子，不記魄的位置
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const i = ty * W + tx; if (vis[i] > 0.06 && !paper[i]) g.explored[i] = 1; }
    return { light, vis, paper, W, H };
  }

  // ---------- 對外 ----------
  function api(g) {
    return {
      step: (dt, inp) => { if (inp && inp.press) for (const k in inp.press) if (inp.press[k]) g.press[k] = true; step(g, dt, inp); },
      // 畫面的一幀：補上固定步長；按鍵留到真的跑了一步才算用掉
      advance(frameDt, inp) {
        if (inp && inp.press) for (const k in inp.press) if (inp.press[k]) g.press[k] = true;
        g.acc += clamp(frameDt, 0, R.MAX_FRAME);
        let n = 0;
        while (g.acc >= R.STEP - 1e-9) { g.acc -= R.STEP; step(g, R.STEP, inp); n++; if (g.state !== 'play') { g.acc = 0; break; } }
        return n;
      },
      view: (rad) => view(g, rad),
      lightAt: (x, y, ex) => lightAt(g, x, y, ex),
      sightLine: (a, b, c, d) => sightLine(g, a, b, c, d),
      hitClear: (a, b, c, d) => hitClear(g, a, b, c, d),
      poVis: (e) => poVis(g, e),
      spotVisible: (s) => spotVisible(g, s),
      exposed: () => exposed(g),
      sources: (ex) => sources(g, ex),
      findDoor: () => findDoor(g),
      blocksMove: (x, y, e) => blocksMove(g, x, y, e),
      drain() { const ev = g.events; g.events = []; return ev; },
      // 測試與除錯用
      tp(x, y) { g.p.x = x; g.p.y = y; },
      place(e, x, y, state) { e.x = x; e.y = y; if (state) e.state = state; e.path = null; e.goal = null; e.sample = { x, y, t: g.t }; }
    };
  }

  root.ENGINE = { create, rng, angDiff };
})(typeof globalThis !== 'undefined' ? globalThis : this);
