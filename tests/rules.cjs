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
  ok('取兩印：可以推門，但門還關著', g.exitReady && !g.exitOpen);
  g.tp(20, 26.4); run(g, 0.5, { mx: 0, my: 1 });
  ok('沒推門閂，走不出去', g.state === 'play' && g.p.y < 27, +g.p.y.toFixed(2));
  for (const e of g.pos) put(g, e, 2.5 + e.id, 2.5, 'recover');
  run(g, 0.8, { hold: { take: true } }); run(g, STEP, {});
  ok('推門閂中途放開：要重來', !g.exitOpen && !g.p.taking);
  run(g, R.TAKE.gate + 0.05, { hold: { take: true } });
  ok('按住 E 一秒半推開門閂', g.exitOpen);
  run(g, 1.0, { mx: 0, my: 1 });
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

// ---------- 存檔 ----------
{ // 任何時刻存檔、讀回來接著跑，和沒存過的那一局一步一步完全一樣（包含魄的計時、尋路、亂數）
  const rnd = ENGINE.rng(4242);
  const floors = []; { const g0 = mk(); for (let y = 0; y < g0.m.H; y++) for (let x = 0; x < g0.m.W; x++) if (!g0.blocksMove(x, y, g0.p)) floors.push([x + 0.5, y + 0.5]); }
  const script = (k) => { const r = ENGINE.rng(1000 + k); const a = r() * 6.283; return (i) => { const q = ENGINE.rng(i * 7919 + k)(); const pr = {}; for (const [key, th] of [['sword', 0.02], ['bell', 0.004], ['fire', 0.004], ['lamp', 0.004], ['read1', 0.004], ['read2', 0.004]]) if (q < th) pr[key] = true; return { mx: Math.cos(a + i / 90), my: Math.sin(a + i / 90), aim: a + i / 50, target: { x: 20, y: 12 }, press: pr, hold: { take: (i % 300) < 120 } }; }; };
  let same = 0, total = 0; const kinds = new Set(); const bad = [];
  for (let k = 0; k < 24; k++) {
    const g = mk({ seed: 300 + k });
    // 先玩一陣：把人放到魄附近、偶爾取印，製造各種狀態
    const f0 = floors[Math.floor(rnd() * floors.length)]; g.tp(f0[0], f0[1]);
    if (k % 3 === 0) { const e = g.pos[0]; g.place(e, g.p.x + 1.1, g.p.y, 'chase'); e.lastKnown = { x: g.p.x, y: g.p.y }; }
    if (k % 4 === 1) { const a = g.altars[k % 2]; g.tp(a.x + 0.7, a.y); }
    const s0 = script(k);
    run(g, 1 + (k % 5) * 0.7, (gg, i) => s0(i));
    for (const e of g.pos) kinds.add(e.state);
    if (g.p.reading) kinds.add('reading'); if (g.p.taking) kinds.add('taking'); if (g.shots.length) kinds.add('shot'); if (g.sealed.size) kinds.add('sealed'); if (g.lures.length) kinds.add('lure');
    if (g.state !== 'play') continue;
    const snap = JSON.parse(JSON.stringify(g.serialize()));
    const h = ENGINE.restore(snap);
    if (!h) { bad.push(k); continue; }
    total++;
    const s1 = script(k + 50);
    for (let i = 0; i < 720; i++) { const v = s1(i); g.step(R.STEP, v); h.step(R.STEP, v); if (g.state !== 'play') break; }
    const a = JSON.stringify(g.serialize()), b = JSON.stringify(h.serialize());
    if (a === b && g.state === h.state) same++; else bad.push(k);
  }
  ok('隨機時刻存檔讀回來接著跑，六秒後兩局完全一樣', same === total && total >= 20 && bad.length === 0, { same, total, bad, states: [...kinds] });
}
{ // 指定的難存時刻：每一種都存一次、讀回來，接著跑六秒和原本完全一樣
  const ahead = (i) => ({ mx: Math.cos(i / 70), my: Math.sin(i / 70), aim: i / 40, press: i % 97 === 0 ? { sword: true } : {}, hold: { take: true } });
  const moments = {
    '魄正在蓄撲': (g) => { const e = g.pos[0]; g.tp(19.5, 3.5); g.place(e, 20.2, 3.5, 'chase'); e.lastKnown = { x: 19.5, y: 3.5 }; run(g, 0.2, {}, () => e.state === 'windup'); run(g, 0.1, {}); return e.state === 'windup'; },
    '讀借火讀到一半': (g) => { g.tp(14.5, 13.5); run(g, R.STEP, { aim: 0, press: { read1: true } }); run(g, 0.5, {}); return !!g.p.reading; },
    '讀封戶讀到一半': (g) => { g.tp(18.5, 17.4); run(g, R.STEP, { press: { read2: true } }); run(g, 0.4, {}); return !!g.p.reading && g.p.reading.spell === 'seal'; },
    '取印取到一半': (g) => { const a = g.altars[0]; g.tp(a.x + 0.7, a.y); run(g, 0.5, { hold: { take: true } }); return !!g.p.taking; },
    '推門閂推到一半': (g) => { for (const a of g.altars) { g.tp(a.x + 0.7, a.y); run(g, 1.1, { hold: { take: true } }); } for (const e of g.pos) g.place(e, 2.5 + e.id, 2.5, 'recover'), (e.stateT = 99); g.tp(20, 26.4); run(g, 0.7, { hold: { take: true } }); return !!(g.p.taking && g.p.taking.gate); },
    '火符飛在半空': (g) => { g.tp(14.5, 13.5); run(g, 0.2, { aim: 0, press: { fire: true } }); return g.shots.length > 0; },
    '魄被擊退、還在燒': (g) => { const e = g.pos[0]; g.tp(19.5, 3.5); g.place(e, 20.5, 3.5, 'recover'); e.stateT = 99; e.burnT = 2; run(g, R.SWORD.windup + R.STEP * 3, { aim: 0, press: { sword: true } }); return e.kt > 0 && e.burnT > 0; },
    '廊口封著、魄在封印格裡': (g) => { const e = g.pos[0]; g.place(e, 19.5, 18.5, 'investigate'); e.lastKnown = { x: 19.5, y: 21.5 }; g.sealed.set(18 * g.m.W + 19, { id: 77, x: 19, y: 18, t: 6, exempt: new Set([e.id]) }); return g.sealed.size === 1; },
    '借火燒著、魄被引過去': (g) => { const e = g.pos[0]; g.tp(14.5, 13.5); g.p.lampOn = false; g.lures.push({ id: 88, x: 22.5, y: 13.5, t: 10 }); g.place(e, 23.5, 9.5, 'patrol'); run(g, 0.5, {}); return e.state === 'lure'; },
    '魄正在凝形': (g) => { const e = g.pos[0]; g.tp(19.5, 3.5); g.place(e, 20.5, 3.5, 'recover'); e.stateT = 99; e.hp = 1; run(g, 0.3, { aim: 0, press: { sword: true } }); e.goneT = 1.0; run(g, 0.1, {}); return e.state === 'gone' && !!e.formSpot; }
  };
  const res = {};
  for (const [name, setup] of Object.entries(moments)) {
    const g = mk({ seed: 77 }); g.drain();
    const okSet = setup(g);
    const h = ENGINE.restore(JSON.parse(JSON.stringify(g.serialize())));
    if (!okSet || !h) { res[name] = okSet ? '讀不回來' : '沒擺成'; continue; }
    for (let i = 0; i < 720; i++) { const v = ahead(i); g.step(R.STEP, v); h.step(R.STEP, v); if (g.state !== 'play') break; }
    res[name] = JSON.stringify(g.serialize()) === JSON.stringify(h.serialize()) && g.state === h.state ? '一樣' : '不一樣';
  }
  ok('十種難存時刻：存了讀回來接著跑都一樣', Object.values(res).every((v) => v === '一樣'), res);
}
{ // 壞的存檔整份不讀
  const g = mk(); run(g, 1, { mx: 0, my: -1 });
  const good = JSON.parse(JSON.stringify(g.serialize()));
  const mut = (f) => { const d = JSON.parse(JSON.stringify(good)); f(d); return d; };
  const cases = {
    '空的': null, '字串': 'garbage', '空物件': {}, '版本不對': mut((d) => { d.v = 99; }), '別的遊戲': mut((d) => { d.game = 'xieyi.zhan'; }),
    '地圖大小不對': mut((d) => { d.map = [10, 10]; }), '座標不是數字': mut((d) => { d.p.x = 'NaN'; }), '座標在圖外': mut((d) => { d.p.y = 999; }),
    '魄的數量不對': mut((d) => { d.pos.pop(); }), '魄的狀態不認得': mut((d) => { d.pos[0].state = 'fly'; }), '地圖記憶長度不對': mut((d) => { d.explored = '01'; }),
    '封戶不在廊口': mut((d) => { d.sealed = [{ i: 0, id: 1, x: 0, y: 0, t: 3, ex: [] }]; }), '少了印': mut((d) => { d.altars = [true]; })
  };
  const loaded = Object.entries(cases).filter(([, d]) => ENGINE.restore(d) !== null).map(([k]) => k);
  ok('壞的存檔整份不讀（13 種）', loaded.length === 0, loaded);
  const h = ENGINE.restore(good);
  ok('好的存檔讀得回來', h && h.state === 'play' && Math.abs(h.p.y - g.p.y) < 1e-9);
  const over = ENGINE.restore(mut((d) => { d.p.chill = 500; d.p.ink = 9; d.p.talismans = -3; }));
  ok('超出範圍的數值收回範圍內', over && over.p.chill === 100 && over.p.ink === R.P.inkMax && over.p.talismans === 0, over && [over.p.chill, over.p.ink, over.p.talismans]);
}

const s = summary();
process.exit(s.fail ? 1 : 0);
