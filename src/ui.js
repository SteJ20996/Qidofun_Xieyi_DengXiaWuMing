// 燈下無明 —— 介面：按鍵、滑鼠、HUD、提示、旁側文字、暫停與結束畫面、主迴圈。
// 失去焦點（切分頁、切視窗）就自動暫停，並放開所有按著的鍵，免得回來時人自己一直走。
(function () {
  const R = window.R, E = window.ENGINE, RD = window.RENDER, SFX = window.SFX;
  const $ = (id) => document.getElementById(id);
  const cv = $('world');
  RD.init(cv);

  let g = null, paused = false, running = false, last = 0, snap = false, frameN = 0, use3d = false;
  const RENDER3D = window.RENDER3D;
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
    track: '那隻魄在聞你的腳印（頭上有「嗅」）。腳印新的時候它跟得上；你一直走，它就追不上，停下來就會被追到。掩燈放輕腳步，腳印淡得快；封戶擋得住它，借火也能把它引開。',
    chill: '寒意很高。到燭火或借火旁邊可以取暖，但站在火光裡，魄看得見你。',
    view3d: '立體：鏡頭在你背後。W 往前、S 往後、A D 往左右；I、O 轉鏡頭，往前走時鏡頭會慢慢跟上。右上角或暫停面板可以換別的畫面。',
    viewFp: '第一人稱（試玩）：W 往前、S 往後、A D 往左右，I、O 轉頭；按 M 改用滑鼠轉頭（M 或 Esc 放開）。劍與火符只自動對準面前的魄。看不到的地方有魄時，畫面邊上有記號，紅的「噬」是它要撲了。'
  };
  // 觸控時，提到按鍵的提示換一種說法
  const HINT_TOUCH = {
    altar: '按住右下角的「取」取印。取印時不能動，被咬就要重來。',
    seal2: '兩印到手。回大門，按住「取」推開門閂（要一秒半）。魄也往玄關去了。',
    gate: '按住「取」推開門閂。推的時候不能動，被咬就要重來。魄在附近時，可以先借火把它引開，或封住它過來的廊口。',
    whiff: '劍揮空了。看飄出的字：「偏了」是方向不對，「差一步」是不夠近，「隔著」是中間有牆或屏。',
    controls: '左半邊按住拖動就走，推得越遠走得越快。右下角是劍、符、鈴、燈、借火、封戶；走到印臺或大門旁，按住「取」。',
    view3d: '立體：鏡頭在你背後。左半邊往上推就往鏡頭前方走；右半邊左右滑動轉鏡頭，往前走時鏡頭也會慢慢跟上。右上角可以換別的畫面。',
    viewFp: '第一人稱（試玩）：左半邊推著走，右半邊左右滑動轉頭。劍與火符只自動對準面前的魄。看不到的地方有魄時，畫面邊上有記號，紅的「噬」是它要撲了。'
  };
  const SPELL = { borrow: '借火', seal: '封戶' };

  // ---------- 畫面大小 ----------
  function resize() {
    const d = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(innerWidth * d); cv.height = Math.round(innerHeight * d);
    cv.style.width = innerWidth + 'px'; cv.style.height = innerHeight + 'px';
  }
  addEventListener('resize', () => { resize(); if (use3d) RENDER3D.resize(); }); resize();

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
    let t = (touch.on && HINT_TOUCH[key]) || HINT[key]; if (!t) return;
    const in3d = use3d && g && !g.attract;
    if (key === 'start') {   // 開頭的提示順便說怎麼操作：觸控說手指怎麼用；立體版說怎麼走、怎麼轉鏡頭
      const vk = fpv ? 'viewFp' : 'view3d';
      if (touch.on) t += '\n' + (in3d ? HINT_TOUCH[vk] : HINT_TOUCH.controls);
      else if (in3d) t += '\n' + HINT[vk];
      if (in3d) g._hint3d = vk;
      if (g && g.god) t += '\n第四格是無敵格：被咬、待在魄身邊都不加寒意，不會失魂；出宅不算最快紀錄。';
    }
    const h = $('hint'); h.textContent = t; h.classList.remove('hidden');
    clearTimeout(hintTimer); hintTimer = setTimeout(() => h.classList.add('hidden'), 9000);
  }
  $('hint').addEventListener('click', () => $('hint').classList.add('hidden'));

  // ---------- 存檔：四格（第四格是無敵格，擁有者 2026-11-24：「在我本地增設一個無敵存檔格子」） ----------
  // 無敵是「那一格」的事：從第四格開始或接著玩的局，被咬、待在魄身邊都不加寒意、不扣護持，不會失魂；出宅不算最快紀錄。
  // 抄到別格去的就是一般的局；別格抄進第四格，從第四格接著玩就是無敵。
  // 每一格存一局。這一局自動存在自己那格（取印、推開門閂、暫停、關頁面時）；暫停面板「存到」可以把這一刻抄進別格。
  // 別局的存檔要按兩次才蓋掉（頁面裡不能跳確認框）。瀏覽器存不了（無痕視窗等）時照樣能玩，只是存不下來。
  const SLOTS = 4, GOD = 4, CN = ['', '一', '二', '三', '四'], SLOT_KEY = { KeyU: 1, KeyI: 2, KeyO: 3, KeyP: 4 }, KEY_OF = ['', 'U', 'I', 'O', 'P'];
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
  // 開始畫面：四格（P 選第四格；暫停時 P 是繼續，所以第四格要用點的）
  function renderSlots() {
    const box = $('slots'); box.innerHTML = '';
    for (let n = 1; n <= SLOTS; n++) {
      const r = readSlot(n), isRun = r.kind === 'run';
      const d = document.createElement('div');
      d.className = 'slot' + (n === sel ? ' sel' : ''); d.dataset.n = n;
      d.className += n === GOD ? ' god' : '';
      d.innerHTML = `<div class="slot-h"><kbd>${KEY_OF[n]}</kbd>第${CN[n]}格${n === GOD ? '<span class="godtag">無敵</span>' : ''}</div><div class="slot-b">${r.kind === 'empty' && n === GOD ? '空的<br><span class="dim">不會失魂</span>' : slotInfo(r)}</div>` +
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
      b.innerHTML = `<span>${n < GOD ? `<kbd>${KEY_OF[n]}</kbd>` : ''}第${CN[n]}格${n === GOD ? '<i class="godtag">無敵</i>' : ''}</span><small>${sub}</small>`;
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
    msg.textContent = saveTo(n, newId()) ? `這一刻抄到第${CN[n]}格了${n === GOD ? '（無敵格：從那一格接著玩就是無敵）' : slot === GOD ? '（從那一格接著玩就是一般的局）' : ''}。這一局之後還是自動存在第${CN[slot]}格。` : '存不進去。';
    disarm(); renderSaveRow();
  }

  // ---------- 開局、接著玩、暫停、結束 ----------
  function seedFromUrl() { const m = /[?&]seed=(\d+)/.exec(location.search); return m ? +m[1] : (Date.now() % 100000) | 0; }
  function enter(gg) {
    g = gg; window.DENG.g = g;
    g.god = slot === GOD;   // 第四格：無敵
    RD.setGame(g);
    if (use3d) { try { sync3d(); } catch (e) { use3d = false; viewWhy = 'broken'; } }   // 立體版：鏡頭在人背後
    canvases(); renderView();
    $('log').innerHTML = ''; $('hint').classList.add('hidden');
    ['start', 'pause', 'end'].forEach((id) => $(id).classList.add('hidden'));
    $('hud').classList.remove('hidden');
    paused = false; running = true; snap = true; keys.clear(); holdTake = false; press = {}; dropTouch();
    disarm(); $('save-msg').textContent = '';
    lsSet('xieyi.deng.slot', String(slot));
    SFX.ambient(true); heartT = 0.3; creakT = 6 + Math.random() * 6;
    if (use3d) hint3d();
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
    paused = on; dropTouch(); if (on) unlockMouse();
    if (on) autosave(false);
    SFX.ambient(!on);
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
    running = false; unlockMouse();
    SFX.ambient(false);
    $('end').classList.toggle('win', win); $('end').classList.toggle('lose', !win);
    const s = g.stats;
    let rec = '';
    if (win && g.god) rec = '（無敵格，不算紀錄）';
    else if (win) { const b = best(); if (!b || g.t < b) { lsSet('xieyi.deng.best', String(g.t)); rec = '（新紀錄）'; } }
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
  // 回主頁（擁有者 2026-11-05：「遊戲內雖有存檔功能但是沒有回到主頁功能」）：
  // 這一局先自動存在自己那格，再回開始畫面；那一格預先選好，Enter 就接著玩。
  function toTitle() {
    if (running && g && g.state === 'play') autosave(false);
    running = false; paused = false; unlockMouse();
    keys.clear(); holdTake = false; press = {};
    SFX.ambient(false);
    ['pause', 'end'].forEach((id) => $(id).classList.add('hidden'));
    $('hud').classList.add('hidden'); $('log').innerHTML = ''; $('hint').classList.add('hidden');
    disarm(); $('save-msg').textContent = '';
    showcase();
    sel = slot; $('slot-msg').textContent = canSave ? '' : '這個瀏覽器存不了檔（例如無痕視窗）：照樣能玩，只是關掉就沒了。';
    renderSlots(); showBest();
    $('start').classList.remove('hidden');
  }

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
        case 'track': if (e.visible) log('魄在聞你的腳印', 'warn'); break;
        case 'swing': SFX.play('swish'); flash($('t-sword'), 'use', 400); break;
        case 'swordHit': SFX.play('hit'); break;
        case 'bell': SFX.play('bell'); flash($('t-bell'), 'use', 400); break;
        case 'fireThrow': SFX.play('throwIt'); flash($('t-fire'), 'use', 400); break;
        case 'fireBoom': SFX.play('boom'); break;
        case 'readStart': SFX.play('page'); flash($('t-book'), 'use', 400); log('讀咒：' + SPELL[e.spell]); break;
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
        case 'seal': SFX.play('seal'); bigStamp(e.glyph); log('取得' + e.glyph + '印', 'good'); autosave(true); break;
        case 'wake': SFX.play('wake'); log(e.why === 'bell' ? '鈴聲吵醒了什麼' : e.why === 'touch' ? '你撞醒了一隻魄' : '宅裡有東西醒了', 'warn'); break;
        case 'disperse': SFX.play('disperse'); log('魄散了，過一陣子會在別處凝回來', 'good'); break;
        case 'reformStart': if (g.spotVisible(e)) log('那裡有東西在凝形', 'warn'); break;
        case 'exitReady': log('兩印到手：回大門推開門閂', 'good'); break;
        case 'gateOpen': SFX.play('door'); bigStamp('開'); log('門閂推開了，快出去', 'good'); autosave(true); break;
        case 'pickup': log('撿到一張火符', 'good'); break;
        case 'lamp': SFX.play('lamp', e.on); flash($('t-lamp'), 'use', 400); break;
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
    if (!$('start').classList.contains('hidden')) {   // 開始畫面：U、I、O、P 選格（P 是無敵格），Enter 開始或繼續
      if (SLOT_KEY[ev.code]) { sel = SLOT_KEY[ev.code]; disarm(); renderSlots(); return; }
      if (ev.code === 'Enter' || ev.code === 'NumpadEnter') { ev.preventDefault(); startSel(); }
      return;
    }
    if (!$('end').classList.contains('hidden')) { if (ev.code === 'Enter' || ev.code === 'NumpadEnter') { ev.preventDefault(); endPrimary(); } else if (ev.code === 'KeyM' && !ev.repeat) toTitle(); return; }
    if (ev.code === 'Escape' || ev.code === 'KeyP') { setPause(!paused); return; }
    if (paused) { if (SLOT_KEY[ev.code] && !ev.repeat) saveAs(SLOT_KEY[ev.code]); else if (ev.code === 'KeyM' && !ev.repeat) toTitle(); return; }   // 暫停時 U、I、O：存到那一格；M 回主頁
    if (!running) return;
    if (MOVE[ev.code]) keys.add(ev.code);
    if (ev.code === 'KeyI' || ev.code === 'KeyO') keys.add(ev.code);   // 立體版：I、O 轉鏡頭（平面時沒有作用）
    if (ev.repeat) return;
    if (ev.code === 'KeyM' && use3d && fpv && RENDER3D.mode === 'play') { toggleMouseLook(); return; }   // 第一人稱：M 用滑鼠轉頭
    if (ACT[ev.code]) press[ACT[ev.code]] = true;
    if (ev.code === HOLD) holdTake = true;
  });
  addEventListener('keyup', (ev) => { keys.delete(ev.code); if (ev.code === HOLD) holdTake = false; });
  addEventListener('blur', () => { keys.clear(); holdTake = false; if (running && !paused) setPause(true, 'blur'); });
  addEventListener('pagehide', () => { if (running && g && g.state === 'play') autosave(false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { keys.clear(); holdTake = false; if (running && !paused) setPause(true, 'blur'); } });
  // 手機在手指放開後會補發「假的」滑鼠事件：剛摸過螢幕就不理滑鼠，免得對準跑到按鈕那裡、或點一下就揮劍
  const fromTouch = () => performance.now() - touch.lastT < 900;
  addEventListener('mousemove', (ev) => {
    if (mouseLocked()) { if (running && !paused) RENDER3D.turnBy(ev.movementX * 0.0032); return; }   // 第一人稱的滑鼠轉頭
    if (fromTouch()) return; mouse.x = ev.clientX; mouse.y = ev.clientY; mouse.t = performance.now(); mouse.in = true;
  });
  // 第一人稱：M 改用滑鼠轉頭（瀏覽器把滑鼠鎖在畫面裡；M 或 Esc 放開）。瀏覽器不讓鎖就照舊用 I、O
  function mouseLocked() { return !!document.pointerLockElement && document.pointerLockElement === $('world3d'); }
  function unlockMouse() { if (mouseLocked() && document.exitPointerLock) document.exitPointerLock(); }
  function toggleMouseLook() {
    if (mouseLocked()) { unlockMouse(); return; }
    const el = $('world3d');
    try { const r = el.requestPointerLock && el.requestPointerLock(); if (r && r.catch) r.catch(() => log('這個瀏覽器不讓滑鼠轉頭，請用 I、O 轉頭', 'warn')); } catch (e) { log('這個瀏覽器不讓滑鼠轉頭，請用 I、O 轉頭', 'warn'); }
  }
  // 鎖滑鼠要等一下才生效：按了 M 馬上暫停或回主頁，鎖可能晚到；晚到的時候已經不在第一人稱玩，就立刻放開
  document.addEventListener('pointerlockchange', () => {
    if (!mouseLocked()) return;
    if (!running || paused || !(use3d && fpv && RENDER3D.mode === 'play')) { unlockMouse(); return; }
    log('滑鼠轉頭：移動滑鼠就轉；再按 M 或 Esc 放開', 'good');
  });
  document.addEventListener('pointerlockerror', () => log('這個瀏覽器不讓滑鼠轉頭，請用 I、O 轉頭', 'warn'));
  document.addEventListener('mouseleave', () => { mouse.in = false; });
  const onDown = (ev) => {
    if (!running || paused || fromTouch()) return;
    mouse.x = ev.clientX; mouse.y = ev.clientY; mouse.t = performance.now(); mouse.in = true;
    if (ev.button === 0) press.sword = true;
    if (ev.button === 2) press.fire = true;
  };
  for (const c of [cv, $('world3d')]) { c.addEventListener('mousedown', onDown); c.addEventListener('contextmenu', (ev) => ev.preventDefault()); }
  // 工具鈕：滑鼠用 click；手指一按下就算（另一根手指正在拖動時也按得到），之後補發的 click 不再算一次
  document.querySelectorAll('[data-act]').forEach((b) => {
    b.addEventListener('click', (ev) => { ev.preventDefault(); if (fromTouch()) return; if (running && !paused) press[b.dataset.act] = true; b.blur(); });
    b.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse') return;
      ev.preventDefault(); touch.lastT = performance.now();
      if (running && !paused) press[b.dataset.act] = true;
      b.classList.add('pressed');
    });
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(t, () => b.classList.remove('pressed'));
  });

  // ---------- 觸控（2026-11-22，擁有者：「請優化手機版介面」） ----------
  // 摸到螢幕（或一開始就是觸控螢幕）就換成觸控介面：左半邊拖動走（推得越遠走得越快）；
  // 右下角一叢大按鈕；「取」要按住；立體版右半邊左右滑動轉鏡頭。電腦上不受影響。
  const touch = { on: false, stick: null, look: null, take: false, lastT: -1e9 };
  const STICK_R = 58;
  function enableTouch() {
    if (touch.on) return;
    touch.on = true; document.body.classList.add('touch');
    $('touchnote').textContent = '手機、平板建議橫拿，看得比較多。';
    if (!$('hint').classList.contains('hidden') && g && !g.attract) $('hint').classList.add('hidden');
  }
  function dropTouch() { touch.stick = null; touch.look = null; touch.take = false; $('stick').classList.add('hidden'); $('t-take').classList.remove('holding'); }
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) enableTouch();
  addEventListener('touchstart', () => { touch.lastT = performance.now(); enableTouch(); SFX.unlock(); }, { passive: true, capture: true });
  const tz = $('touchzone'), stickEl = $('stick'), knob = stickEl.firstElementChild;
  tz.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse' || !running || paused) return;
    ev.preventDefault(); touch.lastT = performance.now();
    if (ev.clientX < innerWidth * 0.5) {
      if (touch.stick) return;
      touch.stick = { id: ev.pointerId, x0: ev.clientX, y0: ev.clientY, dx: 0, dy: 0 };
      stickEl.style.left = ev.clientX + 'px'; stickEl.style.top = ev.clientY + 'px'; knob.style.transform = '';
      stickEl.classList.remove('hidden');
    } else {
      if (touch.look) return;
      touch.look = { id: ev.pointerId, x: ev.clientX };
    }
    try { tz.setPointerCapture(ev.pointerId); } catch (e) { /* 沒有就算了 */ }
  });
  tz.addEventListener('pointermove', (ev) => {
    const s = touch.stick, l = touch.look;
    if (s && ev.pointerId === s.id) {
      let dx = ev.clientX - s.x0, dy = ev.clientY - s.y0;
      const d = Math.hypot(dx, dy);
      if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
      s.dx = dx; s.dy = dy; knob.style.transform = `translate(${dx}px, ${dy}px)`;
    }
    if (l && ev.pointerId === l.id) {   // 立體版：右半邊左右滑動轉鏡頭
      const dx = ev.clientX - l.x; l.x = ev.clientX;
      if (use3d && RENDER3D.mode === 'play' && running && !paused) RENDER3D.turnBy(dx * 0.007);
    }
  });
  const endTouch = (ev) => {
    if (touch.stick && ev.pointerId === touch.stick.id) { touch.stick = null; stickEl.classList.add('hidden'); }
    if (touch.look && ev.pointerId === touch.look.id) touch.look = null;
  };
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) tz.addEventListener(t, endTouch);
  // 「取」：按住才算（取印一秒、推門閂一秒半）
  const takeBtn = $('t-take');
  takeBtn.addEventListener('pointerdown', (ev) => { ev.preventDefault(); touch.lastT = performance.now(); if (running && !paused) { touch.take = true; takeBtn.classList.add('holding'); } });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) takeBtn.addEventListener(t, () => { touch.take = false; takeBtn.classList.remove('holding'); });
  takeBtn.addEventListener('contextmenu', (ev) => ev.preventDefault());
  // 站的地方能不能取印、推門閂（和引擎的 tryTake 同一套距離）
  function takeNear() {
    const p = g.p;
    if (g.exitReady && !g.exitOpen && g.gate && Math.hypot(p.x - g.gate.x, p.y - g.gate.y) <= R.TAKE.gateReach) return 'gate';
    return g.altars.some((a) => !a.taken && Math.hypot(a.x - p.x, a.y - p.y) <= R.TAKE.reach) ? 'seal' : null;
  }

  let aimAuto = true;
  const cam3 = { turn: 0, follow: null };   // 立體版的鏡頭：I、O 轉；往前走時跟上
  function input() {
    let kx = 0, ky = 0;
    for (const k of keys) { const v = MOVE[k]; if (v) { kx += v[0]; ky += v[1]; } }
    if (touch.stick) {   // 手指推出去的方向；推得越遠走得越快（推到七成就是全速）
      const s = touch.stick, d = Math.hypot(s.dx, s.dy);
      if (d > 10) { const m = Math.min(1, (d - 10) / (STICK_R * 0.7 - 10)); kx += (s.dx / d) * m; ky += (s.dy / d) * m; }
    }
    let mx = kx, my = ky;
    const in3d = use3d && RENDER3D.mode === 'play', fp = in3d && fpv;
    cam3.turn = in3d ? (keys.has('KeyO') ? 1 : 0) - (keys.has('KeyI') ? 1 : 0) : 0;
    cam3.follow = null;
    if (in3d && (kx || ky)) {   // 立體：W 是鏡頭看的方向，S 往回，A、D 往左右
      const yaw = RENDER3D.yaw, fx = Math.cos(yaw), fy = Math.sin(yaw);
      mx = fx * -ky - fy * kx; my = fy * -ky + fx * kx;
      if (ky < -0.3 && !fp) cam3.follow = Math.atan2(my, mx);   // 往前走（帶一點左右也算）時，鏡頭慢慢轉到人走的方向（第一人稱不跟，只照你轉頭）
    }
    if (mx || my) moveDir = Math.atan2(my, mx);
    const locked = fp && mouseLocked();
    const now = performance.now(), useMouse = !locked && mouse.in && now - mouse.t < 2500;
    let aim = null, target = null;
    if (useMouse) {
      const d = Math.min(2, window.devicePixelRatio || 1), w = in3d ? RENDER3D.toWorld(mouse.x, mouse.y) : RD.toWorld(mouse.x * d, mouse.y * d);
      if (w) { aim = Math.atan2(w.y - g.p.y, w.x - g.p.x); target = w; }
    } else if (fp) aim = RENDER3D.yaw;   // 第一人稱：面向你看的方向（橫著走也不轉身）
    else if (mx || my) aim = moveDir;
    aimAuto = !useMouse;   // 沒用滑鼠：劍與火符自動對準看得見的魄（第一人稱只對準面前的）
    return { mx, my, aim, target, autoAim: aimAuto, aimCone: fp && aimAuto ? Math.min(0.8, RENDER3D.hfov()) : 0, press, hold: { take: holdTake || touch.take } };
  }

  // ---------- HUD ----------
  // 只有內容變了才改，免得 CSS 動畫每一幀重來
  const shown = {};
  const setHTML = (id, html) => { if (shown[id] !== html) { shown[id] = html; $(id).innerHTML = html; } };
  const flash = (el, cls, ms) => { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); clearTimeout(el['_' + cls]); el['_' + cls] = setTimeout(() => el.classList.remove(cls), ms); };
  let prev = null;
  function hud() {
    const p = g.p;
    const set = (id, v) => $(id).style.setProperty('--p', v);
    if (!prev || g !== prev.g) prev = { g, chill: p.chill, armor: p.armor, ink: p.ink, bell: p.bellCD };
    set('chill-fill', p.chill / R.P.chillMax); $('chill-num').textContent = Math.round(p.chill) + '/100';
    $('chill-fill').parentNode.parentNode.classList.toggle('high', p.chill >= 60);
    if (p.chill > prev.chill + 0.6) flash($('chill-fill').parentNode, 'hit', 450);
    // 護持：三方「護」印，一方擋一咬；少了一方就裂開
    const segs = [0, 1, 2].map((k) => { const v = Math.max(0, Math.min(18, p.armor - 18 * k)) / 18; return v >= 1 ? 'full' : v > 0 ? 'half' : 'empty'; });
    setHTML('armor-segs', segs.map((c) => `<i class="${c}">護</i>`).join(''));
    if (p.armor < prev.armor) { const k = Math.min(2, Math.floor(prev.armor / 18 - 1e-9)); flash($('armor-segs').children[k], 'crack', 700); }
    $('armor-num').textContent = p.armor + '/' + R.P.armorMax;
    set('eye-fill', p.lampOn ? 0 : p.adapt); $('eye-num').textContent = p.lampOn ? '點著燈' : Math.round(p.adapt * 100) + '%';
    const ex = g.exposedNow, xe = $('expose');
    xe.className = ex ? 'on' : 'off';
    setHTML('expose', ex ? '<b>顯</b>' + (p.lampOn ? '燈亮著，魄從遠處看得見你' : '你站在光裡，魄看得見你') : '<b>隱</b>魄要靠很近才察覺');
    if (!$('goal-name')) $('goal').innerHTML = '<span class="slotlab" id="goal-slot"></span><span class="s" id="goal-name"><i>名</i>印</span><span class="s" id="goal-breath"><i>息</i>印</span><span class="door" id="goal-door"></span>';
    $('goal-slot').textContent = `第${CN[slot]}格${g.god ? '・無敵' : ''}`;
    for (const [id, got] of [['goal-name', g.seals.name], ['goal-breath', g.seals.breath]]) {
      const el = $(id), was = el.classList.contains('got');
      el.classList.toggle('got', got);
      if (got && !was && prev.g === g && prev.sealsSeen) flash(el.querySelector('i'), 'stampin', 600);   // 剛取到：蓋一下
    }
    prev.sealsSeen = true;
    $('goal-door').classList.toggle('open', g.exitOpen); $('goal-door').textContent = '大門' + (g.exitOpen ? '開了' : g.exitReady ? '可以推開' : '關著');
    $('t-sword').style.setProperty('--cd', p.swordCD / R.SWORD.cd);
    $('t-bell').style.setProperty('--cd', p.bellCD / R.BELL.cd);
    if (prev.bell > 0 && p.bellCD <= 0) flash($('t-bell'), 'ready', 800);   // 鈴好了：亮一下
    setHTML('fire-n', '<b class="strip"></b>'.repeat(p.talismans) || '<span class="none">無</span>');
    $('t-fire').title = `火符：還有 ${p.talismans} 張。朝對準的方向丟出去，碰到第一隻魄或牆就燒起來。`;
    setHTML('ink-n', '墨' + [...Array(R.P.inkMax)].map((_, k) => `<i class="drop${k < p.ink ? ' on' : ''}"></i>`).join(''));
    if (p.ink < prev.ink) flash($('ink-n').children[p.ink], 'drip', 700);
    const door = g.findDoor();
    $('pg-seal').classList.toggle('off', !door.ok || p.ink <= 0);
    $('pg-borrow').classList.toggle('off', p.ink <= 0);
    $('pg-borrow').classList.toggle('reading', !!(p.reading && p.reading.spell === 'borrow'));
    $('pg-seal').classList.toggle('reading', !!(p.reading && p.reading.spell === 'seal'));
    const reading = !!p.reading;
    $('t-sword').classList.toggle('off', reading); $('t-fire').classList.toggle('off', reading || p.talismans <= 0);
    $('t-bell').classList.toggle('busy', reading);
    $('t-lamp').classList.toggle('covered', !p.lampOn); $('lamp-s').textContent = p.lampOn ? '點著' : '掩著';
    const fpNow = use3d && fpv && RENDER3D.mode === 'play';
    setHTML('aimmode', fpNow ? (mouseLocked() ? '<b>對準</b>面前（滑鼠轉頭，M 放開）' : aimAuto ? '<b>對準</b>面前看得見的魄（M 用滑鼠轉頭）' : '<b>對準</b>跟著滑鼠') : aimAuto ? '<b>對準</b>自動（看得見的魄）' : '<b>對準</b>跟著滑鼠');
    if (touch.on) {   // 觸控的「取」：站在印臺或大門旁才亮；正在取就是紅的
      const near = takeNear();
      takeBtn.classList.toggle('ready', !!near);
      setHTML('take-s', p.taking ? (p.taking.gate ? '推門中' : '取印中') : near === 'gate' ? '推門閂' : '取印');
    }
    if (frameN % 6 === 0) RD.minimap($('minimap'));
    prev.chill = p.chill; prev.armor = p.armor; prev.ink = p.ink; prev.bell = p.bellCD;
  }
  // 大印：取到印時蓋在畫面正中
  function bigStamp(glyph) {
    const el = $('bigstamp'); el.querySelector('span').textContent = glyph;
    el.classList.remove('hidden'); flash(el, 'show', 1500);
    clearTimeout(el._hide); el._hide = setTimeout(() => el.classList.add('hidden'), 1500);
  }

  // ---------- 開始畫面的展示：一盞燈在宅子裡飄，魄照常巡行 ----------
  // 開一局只給開始畫面看的宅子（魄不理那盞燈）；回主頁時再開一次，燈從剛才走到的地方接著走
  function showcase() {
    g = E.create({ seed: seedFromUrl() }); g.attract = true;
    const q = window.TOUR.at(tour.s); g.tp(q.x, q.y); tourDir = { dx: q.dx, dy: q.dy };
    window.DENG.g = g; RD.setGame(g); g.drain(); snap = true;
    if (use3d && !RENDER3D.failed) sync3d();
    canvases();
  }

  // ---------- 立體還是平面（擁有者 2026-11-05「我沒看到3d版的呢」、2026-11-22「遊戲內部沒有3d這個選項呀」） ----------
  // 開始畫面的選單角上、暫停面板、玩的時候右上角都能換：開始畫面是立體的長鏡頭，進一局是鏡頭在人背後的立體版。
  // 自己換成平面時說原因；按「立體」再試就不再自動換。按過的選擇記在 xieyi.deng.view（'3d'／'2d'）。網址 ?flat=1 只管這一次。
  const FLAT_URL = /[?&]flat=1/.test(location.search);
  let r3ready = false, r3game = null, viewWhy = FLAT_URL || lsGet('xieyi.deng.view') === '2d' ? '' : 'loading';
  let fpv = lsGet('xieyi.deng.view') === 'fp';   // 第一人稱（2026-11-24 試玩）：立體裡的另一種鏡頭；記成 'fp'

  const can3d = () => !!(RENDER3D && RENDER3D.ok());
  // 立體那邊蓋的是不是現在這一局、是開始畫面還是玩的那一種
  function sync3d() {
    RENDER3D.setCam(fpv ? 'first' : 'behind');
    const want = g.attract ? 'attract' : 'play';
    if (r3game !== g || RENDER3D.mode !== want) { RENDER3D.setGame(g, want); r3game = g; snap = true; }
  }
  // 哪一張畫布在前面：開始畫面的立體只要 3D；立體版還要上面那層字；平面只要 2D
  function canvases() {
    $('world3d').classList.toggle('hidden', !use3d);
    $('world3dfx').classList.toggle('hidden', !(use3d && g && !g.attract));
    cv.classList.toggle('hidden', use3d);
  }
  function hint3d() { const k = fpv ? 'viewFp' : 'view3d'; if (g && g._hint3d !== k) { g._hint3d = k; showHint(k); } }
  function set3d(on, save, force) {
    if (on) {
      if (!can3d()) { renderView(); return false; }
      try {
        if (!r3ready) { RENDER3D.init($('world3d'), $('world3dfx')); r3ready = true; }
        if (force) RENDER3D.force();
        sync3d();
      } catch (e) { use3d = false; viewWhy = 'broken'; canvases(); renderView(); return false; }
      use3d = true; viewWhy = '';
      canvases(); RENDER3D.resize();
      if (running) hint3d();
    } else {
      use3d = false; canvases(); snap = true;
    }
    if (!(use3d && fpv)) unlockMouse();
    if (save) lsSet('xieyi.deng.view', on ? (fpv ? 'fp' : '3d') : '2d');
    renderView();
    return true;
  }
  // 三種畫面：平面、立體（人的背後）、第一人稱。右上角的鈕照這個順序輪著換
  const VIEW_NAME = { '2d': '平面', '3d': '立體', fp: '第一人稱' }, VIEW_NEXT = { '2d': '3d', '3d': 'fp', fp: '2d' };
  const curView = () => (!use3d ? '2d' : fpv ? 'fp' : '3d');
  function setView(v, save) {
    if (v === '2d') { viewWhy = ''; return set3d(false, save); }
    fpv = v === 'fp';
    if (r3ready) RENDER3D.setCam(fpv ? 'first' : 'behind');
    return set3d(true, save, true);
  }
  function renderView() {
    const can = can3d(), cur = curView();
    for (const pre of ['vm', 'pv']) for (const v of ['2d', '3d', 'fp']) { const b = $(`${pre}-${v}`); b.classList.toggle('on', cur === v); if (v !== '2d') b.disabled = !can; }
    const next = can ? VIEW_NEXT[cur] : '2d';
    $('btn-view').textContent = '換成' + VIEW_NAME[next]; $('btn-view').dataset.next = next;
    $('btn-view').disabled = !can && cur === '2d';
    const fps = RENDER3D && RENDER3D.fps ? Math.round(RENDER3D.fps) : 0;
    const note = viewWhy === 'loading' && can ? '立體的宅子載入中……'
      : !window.THREE ? '立體要用的 three.js 沒載到，先用平面。'
      : !can || viewWhy === 'broken' ? '這個瀏覽器跑不了立體（WebGL 沒開），先用平面。'
      : viewWhy === 'slow' ? `這台跑立體太慢${fps ? `（每秒約 ${fps} 幀）` : ''}，自動換成平面。按「立體」再試，就不會再自動換。`
      : '';
    $('vm-note').textContent = note; $('pv-note').textContent = note;
  }
  // 路線在 src/tour.js：一條平滑閉合的曲線，等速走，不停不頓，看起來是一個長鏡頭
  const tour = { s: 0 };
  let tourDir = { dx: 1, dy: 0 };
  function tourStep(dt) {
    tour.s += window.TOUR.SPEED * dt;
    const q = window.TOUR.at(tour.s);
    g.tp(q.x, q.y); tourDir = { dx: q.dx, dy: q.dy };
    g.p.lampOn = true;
  }

  // ---------- 主迴圈 ----------
  let heartT = 0, creakT = 8;
  function loop(ts) {
    const dt = last ? Math.min(0.25, (ts - last) / 1000) : 0;
    last = ts; frameN++;
    if (g) {
      const onStart = !$('start').classList.contains('hidden') && g.attract;
      if (running && !paused) {
        const n = g.advance(dt, input());
        if (n > 0 || Object.keys(press).length) press = {};
        handle(g.drain());
        mood(dt);
      } else if (onStart) { tourStep(dt); g.advance(dt, {}); g.drain(); }
      if (use3d && RENDER3D.failed) {   // 這台跑不動 3D：回 2D，說原因
        set3d(false); viewWhy = 'slow'; renderView();
        if (running) log('這台跑立體太慢，換成平面', 'warn');
      }
      const go = running && !paused || onStart ? dt : 0;
      if (use3d) RENDER3D.frame(go, onStart ? { lead: tourDir, snap } : { snap, autoAim: aimAuto, turn: go ? cam3.turn : 0, follow: go ? cam3.follow : null });
      else RD.frame(go, { snap, attract: onStart, lead: onStart ? tourDir : null, autoAim: aimAuto });
      snap = false;
      if (!onStart) hud();
    }
    requestAnimationFrame(loop);
  }
  // 心跳（寒意高、或魄就在身邊而且中間沒有牆）與偶爾的嘎吱聲
  function mood(dt) {
    const p = g.p;
    let near = 0;
    for (const e of g.pos) { if (e.state === 'gone' || e.state === 'dormant') continue; const d = Math.hypot(e.x - p.x, e.y - p.y); if (d < 3 && g.hitClear(e.x, e.y, p.x, p.y)) near = Math.max(near, 1 - d / 3); }
    const v = Math.max((p.chill - 50) / 50, near);
    if (v > 0) { heartT -= dt; if (heartT <= 0) { SFX.play('heart', v); heartT = 1.15 - 0.55 * v; } } else heartT = 0.3;
    creakT -= dt; if (creakT <= 0) { SFX.play('creak'); creakT = 9 + Math.random() * 13; }
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
  ['btn-title', 'btn-title2'].forEach((id) => $(id).addEventListener('click', (ev) => { ev.currentTarget.blur(); toTitle(); }));
  const muteBtns = () => ['btn-mute', 'btn-mute2'].forEach((id) => { $(id).classList.toggle('off', SFX.muted); $(id).textContent = SFX.muted ? '音效關' : '音效'; });
  ['btn-mute', 'btn-mute2'].forEach((id) => $(id).addEventListener('click', (ev) => { SFX.unlock(); SFX.toggle(); muteBtns(); ev.currentTarget.blur(); }));
  muteBtns(); showBest();
  ['vm-2d', 'vm-3d', 'vm-fp', 'pv-2d', 'pv-3d', 'pv-fp'].forEach((id) => $(id).addEventListener('click', (ev) => { ev.currentTarget.blur(); setView(id.slice(3), true); }));
  $('btn-view').addEventListener('click', (ev) => { ev.currentTarget.blur(); setView(ev.currentTarget.dataset.next || '3d', true); });

  // 先在背景擺好宅子（開始畫面後面看得到一點點）
  window.DENG = { R, ENGINE: E, RENDER: RD, newGame, continueGame, setPause, toTitle, saveAs, readSlot, canSave, snap() { snap = true; }, tour, get use3d() { return use3d; }, set3d, setView, get fpv() { return fpv; }, get touch() { return touch; }, get slot() { return slot; }, get paused() { return paused; }, get running() { return running; }, keys, g: null };
  showcase();
  renderSlots(); renderView();
  if (!canSave) $('slot-msg').textContent = '這個瀏覽器存不了檔（例如無痕視窗）：照樣能玩，只是關掉就沒了。';
  const fontReady = document.fonts && document.fonts.load ? document.fonts.load('32px "LXGW WenKai TC"', '燈下無明魄噬人火封') : Promise.resolve();
  fontReady.catch(() => {}).then(() => {
    RD.rebuild();
    // 開始畫面的 3D 長鏡頭：three.js 載到了、瀏覽器能 3D、網址沒有 ?flat=1、玩家沒選平面才用；不然照舊 2D
    const pref = lsGet('xieyi.deng.view');
    if (!FLAT_URL && pref !== '2d' && !running) set3d(true, false, pref === '3d');
    if (viewWhy === 'loading') viewWhy = '';
    renderView();
    window.DENG.ready = true;
  });
  requestAnimationFrame(loop);
})();
