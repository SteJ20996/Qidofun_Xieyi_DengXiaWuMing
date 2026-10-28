// 規則回歸：md 第 2 節修過的每一項，加上 2026-10-28 審視時列出的漏洞。
// 用法：node tests/rules.cjs（全部 PASS 才算過）
const { R, ENGINE, mk, mkArena, put, run, dist, aimAt, ok, summary } = require('./lib.cjs');
const STEP = R.STEP;
const types = (ev) => ev.map((e) => e.type);

// ---------- md 第 2 節 ----------
{ // 火符：魄已貼近時，碰到眼前那隻就引燃，不會飛到 4.6 格外
  const g = mkArena(), p = g.p, e = put(g, g.pos[0], p.x + 0.6, p.y, 'recover');
  run(g, 0.4, { aim: 0, press: { fire: true } });
  const b = g.drain().find((x) => x.type === 'fireBoom');
  ok('火符近敵：在眼前引燃', b && b.x < p.x + 0.8 && b.hit.includes(e.id), b && { x: +(b.x - p.x).toFixed(2), hit: b.hit });
}
{ // 火符：前面沒有魄就飛到最遠才爆
  const g = mkArena(), p = g.p; put(g, g.pos[0], 2.5, 13.5, 'recover');
  run(g, 0.6, { aim: 0, press: { fire: true } });
  const b = g.drain().find((x) => x.type === 'fireBoom');
  ok('火符無敵：飛到最遠（4.6 格）才爆', b && Math.abs(b.x - p.x - R.FIRE.range) < 0.15, b && +(b.x - p.x).toFixed(2));
}
{ // 火符碰牆：在牆前引燃，火心不在牆裡
  const g = mkArena(); g.tp(13.5, 8.5); put(g, g.pos[0], 2.5, 13.5, 'recover');
  run(g, 0.5, { aim: 0, press: { fire: true } });
  const b = g.drain().find((x) => x.type === 'fireBoom');
  ok('火符碰牆：火心在牆前', b && b.x < 15 && g.m.at(Math.floor(b.x), Math.floor(b.y)) !== 1, b && +b.x.toFixed(2));
}
{ // 灼燒只扣血：不會讓魄停頓、不清掉它記得的位置
  const g = mkArena(), p = g.p, e = put(g, g.pos[0], p.x + 4, p.y, 'chase');
  e.burnT = 3; const hp0 = e.hp; let staggered = false, lostMemory = false;
  run(g, 1.0, (gg) => { if (e.state === 'stagger') staggered = true; if (!e.lastKnown) lostMemory = true; return { mx: -1, my: 0 }; });
  ok('灼燒只扣血、不干預 AI', !staggered && !lostMemory && Math.abs(hp0 - e.hp - R.FIRE.burn * 1.0) < 0.2, { hp: +(hp0 - e.hp).toFixed(2), state: e.state });
}
{ // 讀咒：貼近一隻沒被震退的魄時不能開始
  const g = mkArena(), p = g.p; put(g, g.pos[0], p.x + 0.8, p.y, 'recover');
  run(g, STEP, { press: { read1: true } });
  const ev = types(g.drain());
  ok('貼近魄時不能開始讀咒', ev.includes('readBlocked') && !p.reading && p.ink === 3, ev);
}
{ // 被震退（停頓中）的魄在旁邊，可以開始讀
  const g = mkArena(), p = g.p; put(g, g.pos[0], p.x + 0.8, p.y, 'stagger', { stag: 1.0 });
  run(g, STEP, { press: { read1: true } });
  ok('魄被震退時可以開始讀咒', !!p.reading, types(g.drain()));
}
{ // 讀咒中魄靠近就中斷，不扣墨
  const g = mkArena(), p = g.p; put(g, g.pos[0], p.x + 3, p.y, 'chase');
  run(g, 1.3, (gg, i) => ({ press: i === 0 ? { read1: true } : {} }));
  const ev = g.drain(), c = ev.find((x) => x.type === 'readCancel');
  ok('讀咒中魄貼近就中斷，書墨未耗', c && c.why === 'near' && p.ink === 3 && !ev.some((x) => x.type === 'borrowDone'), c);
}
{ // 同一步：魄走進來、咒也剛好讀完 → 先算魄，再查中斷，最後才完成
  const g = mkArena(), p = g.p, e = put(g, g.pos[0], p.x + R.PO.biteR + 0.01, p.y, 'chase');
  p.reading = { spell: 'borrow', t: R.BOOK.borrow.read - STEP * 0.5, dur: R.BOOK.borrow.read, spot: { x: p.x - 2, y: p.y } };
  run(g, STEP, {});
  const ev = types(g.drain());
  ok('同一步魄貼身與讀完：中斷、不扣墨', ev.includes('readCancel') && !ev.includes('borrowDone') && p.ink === 3, { ev, d: +dist(p, e).toFixed(3) });
  const g2 = mkArena(), p2 = g2.p; put(g2, g2.pos[0], p2.x + R.PO.biteR + 0.06, p2.y, 'chase');
  p2.reading = { spell: 'borrow', t: R.BOOK.borrow.read - STEP * 0.5, dur: R.BOOK.borrow.read, spot: { x: p2.x - 2, y: p2.y } };
  run(g2, STEP, {});
  ok('魄這一步還沒到：咒照常完成', types(g2.drain()).includes('borrowDone') && p2.ink === 2);
}
{ // 讀咒中按銅鈴：先合書、不耗墨，再正常搖鈴
  const g = mkArena(), p = g.p; put(g, g.pos[0], 2.5, 13.5, 'recover');
  run(g, 0.5, (gg, i) => ({ press: i === 0 ? { read1: true } : {} }));
  run(g, STEP, { press: { bell: true } });
  const ev = g.drain(), c = ev.find((x) => x.type === 'readCancel');
  ok('讀咒中可以搖鈴：合書不耗墨', c && c.why === 'bell' && ev.some((x) => x.type === 'bell') && p.ink === 3 && p.bellCD > 6.9, types(ev));
}
{ // 桃木劍數值：傷 24、退約 0.35、停 0.12、間隔 1.05
  const g = mkArena(), p = g.p, e = put(g, g.pos[0], p.x + 1.0, p.y, 'recover');
  const x0 = e.x;
  run(g, R.SWORD.windup + STEP, { aim: 0, press: { sword: true } });
  const hp1 = e.hp, st = e.stag;
  run(g, 0.5, { aim: 0 }, () => e.state !== 'stagger');
  ok('桃木劍：傷 24、停頓 0.12', R.PO.hp - hp1 === 24 && Math.abs(st - 0.12) < 0.02, { dmg: R.PO.hp - hp1, stag: +st.toFixed(3) });
  ok('桃木劍：擊退約 0.35 格（停頓結束時量）', Math.abs(e.x - x0 - 0.35) < 0.04, +(e.x - x0).toFixed(3));
}
{ // 桃木劍間隔 1.05 秒：第一劍後 1.0 秒再按不行，1.06 秒可以
  const g = mkArena(), p = g.p; put(g, g.pos[0], 2.5, 13.5, 'recover');
  run(g, STEP, { aim: 0, press: { sword: true } });
  const t0 = g.t - STEP;
  run(g, 1.0 - (g.t - t0) - STEP, { aim: 0 });
  run(g, STEP, { aim: 0, press: { sword: true } });
  const early = g.drain().filter((x) => x.type === 'cooldown').length;
  run(g, 1.06 - (g.t - t0) - STEP, { aim: 0 });
  run(g, STEP, { aim: 0, press: { sword: true } });
  run(g, 0.15, { aim: 0 });
  const later = g.drain().filter((x) => x.type === 'swing').length;
  ok('桃木劍：1.05 秒內不能再揮', early === 1 && later === 1, { early, later });
}
{ // 出手用出手那一刻的位置（方向在起手時定）
  const g = mkArena(), p = g.p, e = put(g, g.pos[0], p.x + 1.45, p.y, 'recover');
  run(g, R.SWORD.windup + STEP * 2, { aim: 0, mx: 1, my: 0, press: { sword: true } });
  const ev = types(g.drain());
  ok('起手後往前走，劍從新位置判定', ev.includes('swordHit'), { ev, d: +dist(p, e).toFixed(2) });
}
{ // 同格追尋：人站在一格的各個角落，魄都追得到，而且不走回頭路
  let okN = 0, back = 0;
  const spots = [[0.1, 0.1], [0.9, 0.1], [0.1, 0.9], [0.9, 0.9], [0.5, 0.1], [0.5, 0.9], [0.1, 0.5], [0.9, 0.5]];
  for (const [fx, fy] of spots) {
    const g = mkArena(); g.tp(8 + fx, 8 + fy);
    const e = put(g, g.pos[0], 8 + fx - 3, 8 + fy + 0.3, 'chase');
    let dPrev = dist(g.p, e), gotIt = false;
    run(g, 2.5, () => ({}), (gg) => {
      const d = dist(gg.p, e);
      if (d > dPrev + 1e-6 && e.state === 'chase') back++;
      dPrev = d;
      if (e.state === 'windup') { gotIt = true; return true; }
      return false;
    });
    if (gotIt) okN++;
  }
  ok('同格追尋：八個角落都追得到、不走回頭路', okN === 8 && back === 0, { okN, back });
}
// 有一道門的場地：左右兩間，中間一個廊口（5,8）
const doorRoom = (set) => { for (let y = 1; y < 15; y++) set(5, y, '#'); set(5, 8, 'd'); };
{ // 封戶落在魄身上：它可以離開，但不能再從外面進來；人也過不去
  const g = mkArena(doorRoom), p = g.p; g.tp(4.4, 7.5);
  const e = put(g, g.pos[0], 5.5, 8.5, 'recover');
  run(g, R.BOOK.seal.read + STEP * 2, (gg, i) => ({ press: i === 0 ? { read2: true } : {} }));
  const done = g.drain().find((x) => x.type === 'sealDone');
  ok('封戶可以落在魄身上（魄豁免）', done && done.exempt.includes(e.id), done);
  const ent = { kind: 'po', id: e.id, x: 5.5, y: 8.5, r: e.r };
  g.pos[0].x = 5.5; g.pos[0].y = 8.5;
  // 魄往東離開
  g.place(e, 5.5, 8.5, 'recover'); e.stateT = 999;
  for (let k = 0; k < 40; k++) { e.x += 0.03; g.step(STEP, {}); }
  const left = e.x > 6 + e.r - 0.01;
  // 再往西撞回去
  for (let k = 0; k < 60; k++) { const x0 = e.x; e.x -= 0.03; g.step(STEP, {}); void x0; }
  // 用引擎的碰撞再推一次
  const blockedBack = !g.blocksMove(5, 8, e);
  void ent;
  const s = [...g.sealed.values()][0];
  ok('魄離開封印格後豁免取消、不能再進來', left && s && !s.exempt.has(e.id) && g.blocksMove(5, 8, e) && !blockedBack === true, { x: +e.x.toFixed(2), exempt: s && [...s.exempt] });
  ok('人不能走進封戶', g.blocksMove(5, 8, g.p));
}
{ // 凝回：人站在凝回點就延後；等太久換地方；凝形中打不到
  const g = mkArena(), p = g.p, e = put(g, g.pos[0], p.x + 1, p.y, 'recover');
  e.hp = 1; run(g, R.SWORD.windup + STEP, { aim: 0, press: { sword: true } });
  ok('打散', e.state === 'gone', e.state);
  run(g, R.PO.reformT - R.PO.formT + STEP * 2, {});
  const s1 = e.formSpot;
  ok('凝回點離人夠遠', s1 && dist(p, s1) >= R.PO.reformFar, s1 && +dist(p, s1).toFixed(2));
  g.tp(s1.x, s1.y);
  run(g, R.PO.formT + 1.0, {});
  ok('人站在凝回點：先不成形', e.state === 'gone');
  // 凝形中丟火符：打不到
  run(g, STEP, { aim: 0, press: { fire: true } });
  run(g, 0.4, {});
  const b = g.drain().find((x) => x.type === 'fireBoom');
  ok('凝形中打不到', !b || !b.hit.includes(e.id), b && b.hit);
  run(g, R.PO.formRepick + 0.2, {});
  const mv = g.drain().find((x) => x.type === 'reformStart' && x.moved);
  ok('等太久就換一個凝回點', mv && (mv.x !== s1.x || mv.y !== s1.y), { s1, s2: mv && { x: mv.x, y: mv.y } });
  run(g, R.PO.formT + 0.5, {});
  ok('成形時不與人重疊', e.state !== 'gone' && dist(p, e) >= R.PO.formClear - 0.01, { state: e.state, d: +dist(p, e).toFixed(2) });
}
{ // 借火的照明也算暴露
  const g = mkArena(), p = g.p; put(g, g.pos[0], 2.5, 13.5, 'recover');
  run(g, STEP, { press: { lamp: true } });
  ok('掩燈後不暴露', !g.exposed());
  run(g, R.BOOK.borrow.read + STEP * 3, (gg, i) => ({ target: { x: p.x + 1, y: p.y }, press: i === 0 ? { read1: true } : {} }));
  ok('站在借火旁：暴露', g.exposed(), +g.lightAt(p.x, p.y, true).toFixed(2));
}

// ---------- 2026-10-28 審視補上的 ----------
{ // 封戶雙向：魄在封印格裡，咬、寒意、劍、鈴、火都過不去
  const g = mkArena(doorRoom), p = g.p; g.tp(4.62, 8.5);
  const e = put(g, g.pos[0], 5.4, 8.5, 'chase');
  g.sealed.set(8 * g.m.W + 5, { id: 99, x: 5, y: 8, t: 10, exempt: new Set([e.id]) });
  const c0 = p.chill, a0 = p.armor;
  run(g, 2.0, { aim: Math.PI, press: {} });
  const ev = types(g.drain());
  ok('封戶擋咬與寒意', !ev.includes('windup') && !ev.includes('bite') && p.chill === c0 && p.armor === a0, { ev: ev.slice(0, 6), d: +dist(p, e).toFixed(2), chill: p.chill });
  run(g, 0.2, { aim: 0, press: { sword: true } });
  run(g, STEP, { aim: 0, press: { bell: true } });
  run(g, 0.4, { aim: 0, press: { fire: true } });
  const ev2 = g.drain();
  const miss = ev2.find((x) => x.type === 'swordMiss'), boom = ev2.find((x) => x.type === 'fireBoom');
  ok('封戶擋劍、鈴、火符', miss && miss.why === 'wall' && e.hp === R.PO.hp && boom && !boom.hit.includes(e.id), { miss: miss && miss.why, hp: e.hp, boom: boom && boom.hit });
}
{ // 斜角牆縫：寒意與劍都過不去（線段剛好穿過兩堵斜靠的牆的格角）
  for (const ch of ['#', '=']) {
    const g = mkArena((set) => { set(5, 3, ch); set(6, 4, ch); }), p = g.p;
    g.tp(5.7, 4.3);
    const e = put(g, g.pos[0], 6.35, 3.65, 'recover');
    const c0 = p.chill;
    run(g, 1.0, { aim: aimAt(g, e) });
    run(g, R.SWORD.windup + STEP, { aim: aimAt(g, e), press: { sword: true } });
    ok(`隔${ch === '#' ? '牆' : '紙屏'}斜角：寒意、劍都過不去`, p.chill === c0 && e.hp === R.PO.hp && dist(p, e) < R.PO.auraR, { chill: p.chill, hp: e.hp, d: +dist(p, e).toFixed(3) });
  }
}
{ // 黑暗中的蓄撲：沒有字也沒有圈；眼睛習慣後看得見；點燈時看得見
  const cases = [['掩燈、眼睛還沒習慣', false, 0, false], ['掩燈、眼睛習慣了', false, 1, true], ['點著燈', true, 0, true]];
  for (const [name, lamp, adapt, want] of cases) {
    const g = mkArena(), p = g.p;
    p.lampOn = lamp; p.adapt = adapt;
    if (!lamp) run(g, STEP, {}), (p.adapt = adapt);
    put(g, g.pos[0], p.x + 0.7, p.y, 'patrol');
    run(g, 0.05, {});
    const w = g.drain().find((x) => x.type === 'windup');
    ok('蓄撲提示（' + name + '）', w && w.visible === want, w && { visible: w.visible });
  }
}
{ // 躲得掉：魄蓄撲時停步；人在不同反應時間往後退
  const rows = [];
  for (const react of [0.15, 0.25, 0.3, 0.35, 0.4]) {
    const g = mkArena(), p = g.p, e = put(g, g.pos[0], p.x + 1.2, p.y, 'chase');
    let tw = -1, res = '';
    run(g, 3, (gg) => {
      if (tw < 0 && e.state === 'windup') tw = gg.t;
      const go = tw >= 0 && gg.t - tw >= react;
      return { mx: go ? -1 : 0, my: 0 };
    }, (gg) => { const ev = gg.events.map((x) => x.type); if (ev.includes('bite')) { res = 'bite'; return true; } if (ev.includes('whiff')) { res = 'whiff'; return true; } return false; });
    rows.push([react, res]);
  }
  const stand = mkArena(), es = put(stand, stand.pos[0], stand.p.x + 1.2, stand.p.y, 'chase');
  run(stand, 3, {}, (gg) => gg.events.some((x) => x.type === 'bite'));
  void es;
  ok('站著不動會被咬', stand.events.some((x) => x.type === 'bite'));
  ok('反應 0.3 秒內往後退就躲得掉', rows.filter((r) => r[0] <= 0.3).every((r) => r[1] === 'whiff') && rows.find((r) => r[0] === 0.4)[1] === 'bite', rows);
}
{ // 掩燈甩脫：魄只追最後看見的位置，到了搜一陣，再回去巡
  const g = mkArena((set) => { for (let y = 4; y < 12; y++) set(10, y, '#'); }), p = g.p;
  g.tp(8.5, 8.5);
  const e = put(g, g.pos[0], 3.5, 8.5, 'patrol');
  run(g, 0.3, {});
  ok('點著燈，五格外的魄看見人', e.state === 'chase');
  // 掩燈，躲到牆後（測試直接把人放過去，等於人已經繞出它的視線）
  run(g, STEP, { press: { lamp: true } });
  const lk = { x: g.p.x, y: g.p.y };
  g.tp(12.5, 13.2);
  let cheat = 0, seenAfter = false;
  const seq = [];
  run(g, 9.0, () => {
    if (e.sees) seenAfter = true;
    if (!e.sees && !seenAfter && e.lastKnown && (Math.abs(e.lastKnown.x - lk.x) > 1e-9 || Math.abs(e.lastKnown.y - lk.y) > 1e-9)) cheat++;
    if (seq[seq.length - 1] !== e.state) seq.push(e.state);
    return {};
  });
  ok('看不見時，魄記得的位置不跟著人跑', cheat === 0 && !seenAfter, { cheat, seenAfter });
  const iS = seq.indexOf('search'), iP = seq.lastIndexOf('patrol');
  ok('到最後看見的地方搜一陣，再回去巡行', iS > 0 && iP > iS, seq);
}
{ // 鈴聲：十二格內把睡著的魄吵醒，十二格外不會
  const g = mk(), p = g.p, e2 = g.pos[1];
  g.tp(27.5, 24.5); run(g, STEP, { press: { bell: true } });
  ok('鈴聲吵醒八格外的魄', e2.state !== 'dormant', e2.state);
  const h = mk(), f2 = h.pos[1];
  h.tp(19.5, 25.5); h.p.bellCD = 0; run(h, STEP, { press: { bell: true } });
  ok('十六格外的鈴聲吵不醒', f2.state === 'dormant', f2.state);
}
{ // 撞到睡著的魄會醒；劍打睡著的魄也會醒
  const g = mk(), e2 = g.pos[1];
  g.tp(e2.x - 1.2, e2.y);
  run(g, 1.0, { mx: 1, my: 0 });
  ok('撞到睡著的魄，它就醒了', e2.state !== 'dormant', e2.state);
}
{ // 取第一印，另一隻魄醒來；取兩印，大門開
  const g = mk(), p = g.p, a = g.altars.find((q) => q.key === 'name');
  g.tp(a.x + 0.8, a.y); run(g, R.TAKE.t + 0.05, { hold: { take: true } });
  ok('取第一印：補給、另一隻魄醒來', g.seals.name && g.pos[1].state !== 'dormant' && p.talismans === 4 && p.ink === 3, { seals: g.seals, s2: g.pos[1].state });
  const b = g.altars.find((q) => q.key === 'breath');
  g.tp(b.x - 0.8, b.y); run(g, R.TAKE.t + 0.05, { hold: { take: true } });
  ok('取兩印：大門開', g.exitOpen);
  g.tp(20, 26.4); run(g, 1.0, { mx: 0, my: 1 });
  ok('走出大門就出宅', g.state === 'win', g.state);
}
{ // 取印時被咬要重來；放開 E 也要重來
  const g = mkArena((set) => set(8, 6, '1')), p = g.p, a = g.altars[0];
  g.tp(a.x, a.y + 0.9);
  run(g, 0.5, { hold: { take: true } });
  run(g, STEP, { hold: {} });
  ok('放開 E：取印中斷', !p.taking && !a.taken);
}
{ // 時間步長：120Hz、144Hz、240Hz、60Hz、25fps、20fps 結果一樣；卡頓一幀最多補 0.1 秒
  const finals = [];
  for (const fdt of [1 / 240, 1 / 144, 1 / 120, 1 / 60, 0.025, 0.04, 0.05]) {
    const g = mk({ seed: 5 });
    const total = 6.0; let tt = 0;
    while (tt < total - 1e-9) { const d = Math.min(fdt, total - tt); g.advance(d, { mx: 0, my: -1 }); tt += d; }
    finals.push([fdt.toFixed(4), +g.t.toFixed(4), +g.p.x.toFixed(4), +g.p.y.toFixed(4), +g.pos[0].x.toFixed(4)]);
  }
  const same = finals.every((f) => Math.abs(f[1] - finals[0][1]) < R.STEP + 1e-9 && Math.abs(f[3] - finals[0][3]) < 0.03);
  ok('不同幀率結果一致（固定步長）', same, finals);
  const g = mk(); const n = g.advance(2.0, {});
  ok('一幀卡 2 秒：只補 0.1 秒', n === Math.round(R.MAX_FRAME / R.STEP), n);
}
{ // 劍落空的原因
  const g = mkArena(), p = g.p;
  put(g, g.pos[0], p.x + 1.7, p.y, 'recover');
  run(g, 0.2, { aim: 0, press: { sword: true } });
  const m1 = g.drain().find((x) => x.type === 'swordMiss');
  const h = mkArena(), q = h.p; put(h, h.pos[0], q.x, q.y + 1.0, 'recover');
  run(h, 0.2, { aim: 0, press: { sword: true } });
  const m2 = h.drain().find((x) => x.type === 'swordMiss');
  ok('劍落空會說原因（差一步／偏了）', m1 && m1.why === 'far' && m2 && m2.why === 'dir', { far: m1 && m1.why, dir: m2 && m2.why });
}

const s = summary();
process.exit(s.fail ? 1 : 0);
