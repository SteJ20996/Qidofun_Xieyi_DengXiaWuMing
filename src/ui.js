// 燈下無明 —— 介面：按鍵、滑鼠、HUD、提示、旁側文字、暫停與結束畫面、主迴圈。
// 失去焦點（切分頁、切視窗）就自動暫停，並放開所有按著的鍵，免得回來時人自己一直走。
(function () {
  const R = window.R, E = window.ENGINE, RD = window.RENDER, SFX = window.SFX;
  const $ = (id) => document.getElementById(id);
  const cv = $('world');
  RD.init(cv);

  let g = null, paused = false, running = false, last = 0, snap = false, frameN = 0;
  let press = {}, holdTake = false;
  const keys = new Set();
  const mouse = { x: 0, y: 0, t: -1e9, in: false };
  let moveDir = null;

  // 教學提示：每一局第一次遇到時出現
  const HINT = {
    start: '先往裡走。名印在西北的書房，息印在東北的祠堂。取到兩印，再從這道大門出去。',
    dark: '掩燈了。站著別動一會兒，眼睛會慢慢習慣黑暗，看得比點燈時更遠（左上的「目」）。',
    adapted: '眼睛習慣了。黑暗裡微微發亮的，就是魄。這時它要很近才察覺得到你。',
    seePo: '那是魄。你點著燈，它從遠處就看得見你；你掩了燈，它要靠得很近才察覺。',
    windup: '「噬」：魄要撲了。退出紅圈，讓它撲空；它撲空後會愣一下，那時再回身揮劍。',
    whiff: '劍揮空了。看飄出的字：「偏了」是方向不對，「差一步」是不夠近，「隔著」是中間有牆或屏。',
    bite: '被咬了。護心衣先擋下寒傷（「護」少一格）。護持用完，咬中就直接加寒意。',
    biteBare: '護持沒了，咬中就直接加寒意。寒意滿了就失魂。',
    bell: '鈴聲把身邊的魄震開。可是紙宅擋不住聲音：附近的魄都會往這裡來，睡著的也會醒。',
    altar: '按住 U 取印。取印時不能動，被咬就要重來。',
    seal1: '取到一印，寒意退了一些，也補了護持、火符與書墨。宅裡有東西醒了。',
    seal2: '兩印到手。回大門，按住 U 推開門閂（要一秒半）。魄也往玄關去了。',
    gate: '按住 U 推開門閂。推的時候不能動，被咬就要重來。魄在附近時，可以先借火把它引開，或封住它過來的廊口。',
    chill: '寒意很高。到燭火或借火旁邊可以取暖，但站在火光裡，魄看得見你。'
  };
  const SPELL = { borrow: '借火', seal: '封戶' };

  // ---------- 畫面大小 ----------
  function resize() {
    const d = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(innerWidth * d); cv.height = Math.round(innerHeight * d);
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  }
  addEventListener('resize', resize); resize();

  // ---------- 旁側文字與提示 ----------
  const recent = new Map();
  function log(text, cls) {
    const now = performance.now();
    if (recent.has(text) && now - recent.get(text) < 1500) return;
    recent.set(text, now);
    const box = $('log'), d = document.createElement('div');
    d.textContent = text; if (cls) d.className = cls;
    box.appendChild(d);
    while (box.children.length > 5) box.removeChild(box.firstChild);
    setTimeout(() => d.remove(), 5200);
  }
  let hintTimer = 0;
  function showHint(key) {
    const t = HINT[key]; if (!t) return;
    const h = $('hint'); h.textContent = t; h.classList.remove('hidden');
    clearTimeout(hintTimer); hintTimer = setTimeout(() => h.classList.add('hidden'), 9000);
  }
  $('hint').addEventListener('click', () => $('hint').classList.add('hidden'));

  // ---------- 存檔：三格 ----------
  // 每一格存一局。這一局自動存在自己那格（取印、推開門閂、暫停、關頁面時）；暫停面板「存到」可以把這一刻抄進別格。
  // 別局的存檔要按兩次才蓋掉（頁面裡不能跳確認框）。瀏覽器存不了（無痕視窗等）時照樣能玩，只是存不下來。
  const SLOTS = 3, CN = ['', '一', '二', '三'], SLOT_KEY = { KeyU: 1, KeyI: 2, KeyO: 3 }, KEY_OF = ['', 'U', 'I', 'O'];
  const skey = (n) => 'xieyi.deng.save.' + n;
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const canSave = (() => { const ok = lsSet('xieyi.deng.probe', '1'); try { localStorage.removeItem('xieyi.deng.probe'); } catch (e) { /* 沒有就算了 */ } return ok; })();
  let slot = Math.min(SLOTS, Math.max(1, +lsGet('xieyi.deng.slot') || 1)), sel = slot, runId = '';
  let armed = { start: 0, pause: 0, restart: false }, armTimer = 0;
  function readSlot(n) {
    const raw = lsGet(skey(n));
    if (!raw) return { kind: canSave ? 'empty' : 'off' };
    try { const d = JSON.parse(raw); if (d && d.done) return { kind: 'done', d }; if (d && d.run) return { kind: 'run', d }; } catch (e) { /* 壞了 */ }
    return { kind: 'bad' };
  }
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  function saveTo(n, id) {
    if (!g || !running || g.state !== 'play') return false;
    const sum = { name: g.seals.name, breath: g.seals.breath, gate: g.exitOpen, t: g.t, chill: Math.round(g.p.chill), armor: g.p.armor };
    return lsSet(skey(n), JSON.stringify({ id: id || runId, at: Date.now(), ver: R.VERSION, sum, run: g.serialize() }));
  }
  function autosave(say) {
    if (!saveTo(slot)) return false;
    lsSet('xieyi.deng.slot', String(slot));
    if (say) log(`已自動存到第${CN[slot]}格`, 'good');
    return true;
  }
  function when(at) { const d = new Date(at); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
  function slotInfo(r) {   // 一格的摘要
    if (r.kind === 'off') return '這個瀏覽器存不了檔';
    if (r.kind === 'empty') return '空的';
    if (r.kind === 'bad') return '存檔讀不出來，可以從頭開始';
    if (r.kind === 'done') return `出宅過，用時 ${fmt(r.d.t || 0)}<br><span class="dim">${when(r.d.at)}</span>`;
    const q = r.d.sum || {};
    return `<span class="mini${q.name ? ' got' : ''}">名</span><span class="mini${q.breath ? ' got' : ''}">息</span> ${fmt(q.t || 0)}・寒 ${q.chill == null ? '?' : q.chill}・護 ${q.armor == null ? '?' : q.armor}<br><span class="dim">存於 ${when(r.d.at)}</span>`;
  }
  function arm(kind, v) {
    armed[kind] = v; clearTimeout(armTimer);
    armTimer = setTimeout(() => { disarm(); if (!$('start').classList.contains('hidden')) renderSlots(); if (!$('pause').classList.contains('hidden')) renderSaveRow(); }, 4000);
  }
  function disarm() { armed = { start: 0, pause: 0, restart: false }; clearTimeout(armTimer); $('btn-restart').textContent = '重來'; }
  // 開始畫面：三格
  function renderSlots() {
    const box = $('slots'); box.innerHTML = '';
    for (let n = 1; n <= SLOTS; n++) {
      const r = readSlot(n), isRun = r.kind === 'run';
      const d = document.createElement('div');
      d.className = 'slot' + (n === sel ? ' sel' : ''); d.dataset.n = n;
      d.innerHTML = `<div class="slot-h"><kbd>${KEY_OF[n]}</kbd>第${CN[n]}格</div><div class="slot-b">${slotInfo(r)}</div>` +
        `<div class="slot-btns"><button class="go">${isRun ? '繼續' : '入宅'}</button>${isRun ? `<button class="fresh">${armed.start === n ? '再按一次，從頭' : '從頭'}</button>` : ''}</div>`;
      d.addEventListener('click', () => { if (sel !== n) { sel = n; disarm(); renderSlots(); } });
      d.querySelector('.go').addEventListener('click', (ev) => { ev.stopPropagation(); sel = n; startSel(); });
      const fr = d.querySelector('.fresh');
      if (fr) fr.addEventListener('click', (ev) => { ev.stopPropagation(); sel = n; if (armed.start === n) { SFX.unlock(); newGame(n); } else { arm('start', n); renderSlots(); } });
      box.appendChild(d);
    }
  }
  function startSel() { SFX.unlock(); if (readSlot(sel).kind === 'run') { if (!continueGame(sel)) renderSlots(); } else newGame(sel); }
  // 暫停面板：存到哪一格
  function renderSaveRow() {
    const box = $('saverow'); box.innerHTML = '';
    for (let n = 1; n <= SLOTS; n++) {
      const r = readSlot(n), mine = n === slot;
      const b = document.createElement('button');
      b.className = 'savebtn' + (mine ? ' mine' : ''); b.disabled = !canSave; b.dataset.slot = n;
      const sub = !canSave ? '存不了' : armed.pause === n ? '再按一次覆蓋' : mine ? '這一局' : r.kind === 'run' ? '另一局' : r.kind === 'done' ? '出宅過' : r.kind === 'bad' ? '壞了' : '空的';
      b.innerHTML = `<span><kbd>${KEY_OF[n]}</kbd>第${CN[n]}格</span><small>${sub}</small>`;
      b.addEventListener('click', (ev) => { ev.currentTarget.blur(); saveAs(n); });
      box.appendChild(b);
    }
  }
  function saveAs(n) {
    if (!canSave || !running) return;
    const msg = $('save-msg');
    if (n === slot) { msg.textContent = saveTo(slot) ? `已存到第${CN[n]}格。` : '存不進去。'; disarm(); renderSaveRow(); return; }
    const r = readSlot(n);
    if (r.kind === 'run' && armed.pause !== n) { arm('pause', n); msg.textContent = `第${CN[n]}格是另一局的存檔，再按一次就蓋掉它。`; renderSaveRow(); return; }
    msg.textContent = saveTo(n, newId()) ? `這一刻抄到第${CN[n]}格了。這一局之後還是自動存在第${CN[slot]}格。` : '存不進去。';
    disarm(); renderSaveRow();
  }

  // ---------- 開局、接著玩、暫停、結束 ----------
  function seedFromUrl() { const m = /[?&]seed=(\d+)/.exec(location.search); return m ? +m[1] : (Date.now() % 100000) | 0; }
  function enter(gg) {
    g = gg; window.DENG.g = g;
    RD.setGame(g);
    $('log').innerHTML = ''; $('hint').classList.add('hidden');
    ['start', 'pause', 'end'].forEach((id) => $(id).classList.add('hidden'));
    $('hud').classList.remove('hidden');
    paused = false; running = true; snap = true; keys.clear(); holdTake = false; press = {};
    disarm(); $('save-msg').textContent = '';
    lsSet('xieyi.deng.slot', String(slot));
  }
  function newGame(n, seed) {
    if (n) slot = n;
    runId = newId();
    enter(E.create({ seed: seed == null ? seedFromUrl() : seed }));
    handle(g.drain());
    autosave(false);   // 這一格從現在起是這一局
  }
  function continueGame(n) {
    const r = readSlot(n);
    if (r.kind !== 'run') return false;
    const gg = E.restore(r.d.run);
    if (!gg) { $('slot-msg').textContent = `第${CN[n]}格的存檔讀不出來（可能是別的版本存的）。可以按「從頭」在這一格重新開始。`; return false; }
    slot = n; runId = r.d.id || newId();
    enter(gg);
    log(`從第${CN[n]}格接著玩`, 'good');
    return true;
  }
  function setPause(on, why) {
    if (!running) return;
    paused = on;
    if (on) autosave(false);
    $('pause').classList.toggle('hidden', !on);
    $('pause-why').textContent = (why === 'blur' ? '視窗失去焦點，先停下來。' : '') + '冷卻、讀咒、取印都停在原處。' + (canSave ? `這一局已自動存到第${CN[slot]}格。` : '這個瀏覽器存不了檔。');
    keys.clear(); holdTake = false; press = {};
    disarm(); $('save-msg').textContent = '';
    if (on) renderSaveRow();
  }
  function fmt(s) { const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + String(r).padStart(2, '0'); }
  function best() { return +lsGet('xieyi.deng.best') || 0; }
  function showBest() { const b = best(); $('best').textContent = b ? ' · 最快出宅 ' + fmt(b) : ''; }
  function endGame(win) {
    running = false;
    const s = g.stats;
    let rec = '';
    if (win) { const b = best(); if (!b || g.t < b) { lsSet('xieyi.deng.best', String(g.t)); rec = '（新紀錄）'; } }
    if (win) lsSet(skey(slot), JSON.stringify({ done: true, id: runId, t: g.t, at: Date.now() }));   // 這一夜結束了，這一格留下出宅的紀錄
    const r = readSlot(slot), canLoad = !win && r.kind === 'run';
    $('end-seal').textContent = win ? '出' : '失';
    $('end-seal').className = 'endseal' + (win ? '' : ' lose');
    $('end-title').textContent = win ? '出宅' : '失魂';
    $('end-text').innerHTML = win ? '天還沒亮，你帶著名印與息印出了大門。' : '寒意滿了。紙宅的夜，還沒過完。' + (canLoad ? `<br>第${CN[slot]}格存著：${slotInfo(r)}` : '');
    const rows = [['用時', fmt(g.t) + rec], ['兩印', (g.seals.name ? '名' : '　') + ' ' + (g.seals.breath ? '息' : '　')], ['最高寒意', Math.round(s.maxChill)], ['被咬', s.bites + ' 次（護持擋下 ' + s.armorLost + '）'], ['魄撲空', s.whiffs + ' 次'], ['打散魄', s.disperse + ' 次'], ['用了', `劍 ${s.swordHits + s.swordMiss}・鈴 ${s.bells}・火符 ${s.fires}・咒 ${s.reads}`]];
    $('end-stats').innerHTML = rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
    $('btn-load').classList.toggle('hidden', !canLoad);
    $('btn-load').textContent = `從第${CN[slot]}格的存檔接著`;
    $('btn-again').textContent = win ? '再一夜' : '從頭再一夜';
    $('btn-again').className = canLoad ? 'plain' : 'big';
    $('end').classList.remove('hidden');
    SFX.play(win ? 'win' : 'lose');
  }
  function endPrimary() { SFX.unlock(); if (!$('btn-load').classList.contains('hidden') && continueGame(slot)) return; newGame(slot); }

  // ---------- 事件 → 聲音、旁側文字、提示 ----------
  function handle(evs) {
    for (const e of evs) {
      RD.event(e);
      switch (e.type) {
        case 'hint': showHint(e.key); break;
        case 'windup': SFX.play('hiss', e.dist, e.dx); if (e.visible) log('魄在蓄撲，退出紅圈', 'warn'); break;
        case 'bite': SFX.play('bite'); log(e.absorbed ? (e.chill ? `被咬：護持 −${e.absorbed}，寒意 +${e.chill}` : `被咬：護心衣擋下，護持 −${e.absorbed}`) : `被咬：寒意 +${e.chill}`, 'warn'); break;
        case 'whiff': SFX.play('whiff'); if (e.visible) log('魄撲空了', 'good'); break;
        case 'interrupt': log('打斷了魄的蓄撲', 'good'); break;
        case 'swing': SFX.play('swish'); break;
        case 'swordHit': SFX.play('hit'); break;
        case 'bell': SFX.play('bell'); break;
        case 'fireThrow': SFX.play('throwIt'); break;
        case 'fireBoom': SFX.play('boom'); break;
        case 'readStart': SFX.play('page'); log('讀咒：' + SPELL[e.spell]); break;
        case 'readCancel': log({ bell: '讀咒中斷，書墨未耗', move: '合上書，書墨未耗', bite: '被咬，讀咒中斷，書墨未耗', near: '魄貼近，讀咒中斷，書墨未耗' }[e.why] || '讀咒中斷，書墨未耗', e.why === 'move' ? '' : 'warn'); break;
        case 'readBlocked': SFX.play('fail'); log('魄太近，讀不了咒。先搖鈴把它震開', 'warn'); break;
        case 'sealNoDoor': SFX.play('fail'); log({ far: '要站在廊口旁邊才能封戶', standing: '站在廊口上封不了，先退開一步', already: '這個廊口已經封著', moved: '廊口不見了' }[e.why] || '這裡封不了'); break;
        case 'noInk': SFX.play('fail'); log('書墨用完了。取印時會補一點'); break;
        case 'noTalisman': SFX.play('fail'); log('火符用完了'); break;
        case 'cooldown': if (e.what === 'bell') log(`銅鈴還在響，${Math.ceil(e.left)} 秒後再搖`); break;
        case 'busy': log(e.what === 'sword' || e.what === 'fire' ? (g.p.reading ? '讀咒中只能搖鈴（K）' : '取印中，先放開 U') : '手上正忙'); break;
        case 'sealDone': log('封戶：這個廊口十秒內誰也過不去', 'good'); break;
        case 'sealEnd': log('封戶散了'); break;
        case 'borrowDone': log('借火：火會燒十五秒，魄會被火吸引過去', 'good'); break;
        case 'takeStart': log(e.key === 'gate' ? '推門閂……' : '取印中……'); break;
        case 'takeCancel': if (e.why === 'bite') log('被咬，要重來', 'warn'); break;
        case 'seal': SFX.play('seal'); log('取得' + e.glyph + '印', 'good'); autosave(true); break;
        case 'wake': SFX.play('wake'); log(e.why === 'bell' ? '鈴聲吵醒了什麼' : e.why === 'touch' ? '你撞醒了一隻魄' : '宅裡有東西醒了', 'warn'); break;
        case 'disperse': SFX.play('disperse'); log('魄散了，過一陣子會在別處凝回來', 'good'); break;
        case 'reformStart': if (g.spotVisible(e)) log('那裡有東西在凝形', 'warn'); break;
        case 'exitReady': log('兩印到手：回大門推開門閂', 'good'); break;
        case 'gateOpen': SFX.play('door'); log('門閂推開了，快出去', 'good'); autosave(true); break;
        case 'pickup': log('撿到一張火符', 'good'); break;
        case 'lamp': SFX.play('lamp', e.on); break;
        case 'win': endGame(true); break;
        case 'lose': endGame(false); break;
      }
    }
  }

  // ---------- 輸入 ----------
  const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  // 左手 WASD 走位，其餘全在右手（擁有者 2026-10-28）：J 劍、K 鈴、L 火符、；燈、《 借火、》封戶、U 取印與推門閂（按住）、P 暫停。
  // 用實體鍵位（ev.code），中文輸入法開著、有沒有按 Shift 都一樣。I、O、M 先空著。
  const ACT = { KeyJ: 'sword', KeyK: 'bell', KeyL: 'fire', Semicolon: 'lamp', Comma: 'read1', Period: 'read2' };
  const HOLD = 'KeyU';
  addEventListener('keydown', (ev) => {
    if (ev.code.startsWith('Arrow') || ev.code === 'Space') ev.preventDefault();
    if (!$('start').classList.contains('hidden')) {   // 開始畫面：U、I、O 選格，Enter 開始或繼續
      if (SLOT_KEY[ev.code]) { sel = SLOT_KEY[ev.code]; disarm(); renderSlots(); return; }
      if (ev.code === 'Enter' || ev.code === 'NumpadEnter') { ev.preventDefault(); startSel(); }
      return;
    }
    if (!$('end').classList.contains('hidden')) { if (ev.code === 'Enter' || ev.code === 'NumpadEnter') { ev.preventDefault(); endPrimary(); } return; }
    if (ev.code === 'Escape' || ev.code === 'KeyP') { setPause(!paused); return; }
    if (paused) { if (SLOT_KEY[ev.code] && !ev.repeat) saveAs(SLOT_KEY[ev.code]); return; }   // 暫停時 U、I、O：存到那一格
    if (!running) return;
    if (MOVE[ev.code]) keys.add(ev.code);
    if (ev.repeat) return;
    if (ACT[ev.code]) press[ACT[ev.code]] = true;
    if (ev.code === HOLD) holdTake = true;
  });
  addEventListener('keyup', (ev) => { keys.delete(ev.code); if (ev.code === HOLD) holdTake = false; });
  addEventListener('blur', () => { keys.clear(); holdTake = false; if (running && !paused) setPause(true, 'blur'); });
  addEventListener('pagehide', () => { if (running && g && g.state === 'play') autosave(false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); holdTake = false; if (running && !paused) setPause(true, 'blur'); } });
  addEventListener('mousemove', (ev) => { mouse.x = ev.clientX; mouse.y = ev.clientY; mouse.t = performance.now(); mouse.in = true; });
  document.addEventListener('mouseleave', () => { mouse.in = false; });
  cv.addEventListener('mousedown', (ev) => {
    if (!running || paused) return;
    mouse.x = ev.clientX; mouse.y = ev.clientY; mouse.t = performance.now(); mouse.in = true;
    if (ev.button === 0) press.sword = true;
    if (ev.button === 2) press.fire = true;
  });
  cv.addEventListener('contextmenu', (ev) => ev.preventDefault());
  document.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (ev) => { ev.preventDefault(); if (running && !paused) press[b.dataset.act] = true; b.blur(); }));

  function input() {
    let mx = 0, my = 0;
    for (const k of keys) { const v = MOVE[k]; if (v) { mx += v[0]; my += v[1]; } }
    if (mx || my) moveDir = Math.atan2(my, mx);
    const now = performance.now(), useMouse = mouse.in && now - mouse.t < 2500;
    let aim = null, target = null;
    if (useMouse) {
      const d = Math.min(2, window.devicePixelRatio || 1), w = RD.toWorld(mouse.x * d, mouse.y * d);
      aim = Math.atan2(w.y - g.p.y, w.x - g.p.x); target = w;
    } else if (mx || my) aim = moveDir;
    return { mx, my, aim, target, press, hold: { take: holdTake } };
  }

  // ---------- HUD ----------
  function hud() {
    const p = g.p;
    const set = (id, v) => $(id).style.setProperty('--p', v);
    set('chill-fill', p.chill / R.P.chillMax); $('chill-num').textContent = Math.round(p.chill) + '/100';
    $('chill-fill').parentNode.parentNode.classList.toggle('high', p.chill >= 60);
    set('armor-fill', p.armor / R.P.armorMax); $('armor-num').textContent = p.armor + '/' + R.P.armorMax;
    set('eye-fill', p.lampOn ? 0 : p.adapt); $('eye-num').textContent = p.lampOn ? '點著燈' : Math.round(p.adapt * 100) + '%';
    const ex = g.exposedNow, xe = $('expose');
    xe.className = ex ? 'on' : 'off';
    xe.innerHTML = ex ? '<b>顯</b>' + (p.lampOn ? '燈亮著，魄從遠處看得見你' : '你站在光裡，魄看得見你') : '<b>隱</b>魄要靠很近才察覺';
    $('goal').innerHTML = `<span class="slotlab">第${CN[slot]}格</span><span class="s${g.seals.name ? ' got' : ''}"><i>名</i>印</span><span class="s${g.seals.breath ? ' got' : ''}"><i>息</i>印</span><span class="door${g.exitOpen ? ' open' : ''}">大門${g.exitOpen ? '開了' : g.exitReady ? '可以推開' : '關著'}</span>`;
    $('t-sword').style.setProperty('--cd', p.swordCD / R.SWORD.cd);
    $('t-bell').style.setProperty('--cd', p.bellCD / R.BELL.cd);
    $('fire-n').textContent = '×' + p.talismans;
    $('t-fire').classList.toggle('off', p.talismans <= 0);
    $('ink-n').textContent = '墨 ' + '●'.repeat(p.ink) + '○'.repeat(Math.max(0, R.P.inkMax - p.ink));
    const door = g.findDoor();
    $('pg-seal').classList.toggle('off', !door.ok || p.ink <= 0);
    $('pg-borrow').classList.toggle('off', p.ink <= 0);
    $('pg-borrow').classList.toggle('reading', !!(p.reading && p.reading.spell === 'borrow'));
    $('pg-seal').classList.toggle('reading', !!(p.reading && p.reading.spell === 'seal'));
    const reading = !!p.reading;
    $('t-sword').classList.toggle('off', reading); $('t-fire').classList.toggle('off', reading || p.talismans <= 0);
    $('t-bell').classList.toggle('busy', reading);
    $('t-lamp').classList.toggle('covered', !p.lampOn); $('lamp-s').textContent = p.lampOn ? '點著' : '掩著';
    if (frameN % 6 === 0) RD.minimap($('minimap'));
  }

  // ---------- 主迴圈 ----------
  function loop(ts) {
    const dt = last ? Math.min(0.25, (ts - last) / 1000) : 0;
    last = ts; frameN++;
    if (g) {
      if (running && !paused) {
        const n = g.advance(dt, input());
        if (n > 0 || Object.keys(press).length) press = {};
        handle(g.drain());
      }
      RD.frame(running && !paused ? dt : 0, { snap });
      snap = false;
      hud();
    }
    requestAnimationFrame(loop);
  }

  $('btn-load').addEventListener('click', () => { SFX.unlock(); if (!continueGame(slot)) newGame(slot); });
  $('btn-again').addEventListener('click', () => { SFX.unlock(); newGame(slot); });
  $('btn-resume').addEventListener('click', () => setPause(false));
  $('btn-restart').addEventListener('click', (ev) => {   // 重來會蓋掉這一格的這一局：按兩次
    ev.currentTarget.blur();
    if (armed.restart) { newGame(slot); return; }
    arm('restart', true); ev.currentTarget.textContent = `再按一次：第${CN[slot]}格從頭開始`;
  });
  $('btn-pause').addEventListener('click', (ev) => { setPause(true); ev.currentTarget.blur(); });
  const muteBtns = () => ['btn-mute', 'btn-mute2'].forEach((id) => { $(id).classList.toggle('off', SFX.muted); $(id).textContent = SFX.muted ? '音效關' : '音效'; });
  ['btn-mute', 'btn-mute2'].forEach((id) => $(id).addEventListener('click', (ev) => { SFX.unlock(); SFX.toggle(); muteBtns(); ev.currentTarget.blur(); }));
  muteBtns(); showBest();
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) $('touchnote').textContent = '這一版是試做，只做了鍵盤與滑鼠；手機上還不能玩。';

  // 先在背景擺好宅子（開始畫面後面看得到一點點）
  window.DENG = { R, ENGINE: E, RENDER: RD, newGame, continueGame, setPause, saveAs, readSlot, canSave, snap() { snap = true; }, get slot() { return slot; }, get paused() { return paused; }, get running() { return running; }, keys, g: null };
  g = E.create({ seed: seedFromUrl() }); window.DENG.g = g; RD.setGame(g); g.drain();
  renderSlots();
  if (!canSave) $('slot-msg').textContent = '這個瀏覽器存不了檔（例如無痕視窗）：照樣能玩，只是關掉就沒了。';
  const fontReady = document.fonts && document.fonts.load ? document.fonts.load('32px "LXGW WenKai TC"', '燈下無明魄噬人火封') : Promise.resolve();
  fontReady.catch(() => {}).then(() => { RD.rebuild(); window.DENG.ready = true; });
  requestAnimationFrame(loop);
})();
