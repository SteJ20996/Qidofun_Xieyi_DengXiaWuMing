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
    altar: '按住 E 取印。取印時不能動，被咬就要重來。',
    seal1: '取到一印，寒意退了一些，也補了護持、火符與書墨。宅裡有東西醒了。',
    seal2: '兩印到手，大門開了。魄也往玄關去了。',
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

  // ---------- 開局、暫停、結束 ----------
  function seedFromUrl() { const m = /[?&]seed=(\d+)/.exec(location.search); return m ? +m[1] : (Date.now() % 100000) | 0; }
  function newGame(seed) {
    g = E.create({ seed: seed == null ? seedFromUrl() : seed });
    window.DENG.g = g;
    RD.setGame(g);
    $('log').innerHTML = ''; $('hint').classList.add('hidden');
    ['start', 'pause', 'end'].forEach((id) => $(id).classList.add('hidden'));
    $('hud').classList.remove('hidden');
    paused = false; running = true; snap = true; keys.clear(); holdTake = false; press = {};
    handle(g.drain());
  }
  function setPause(on, why) {
    if (!running) return;
    paused = on;
    $('pause').classList.toggle('hidden', !on);
    $('pause-why').textContent = why === 'blur' ? '視窗失去焦點，先停下來。冷卻、讀咒、取印都停在原處。' : '冷卻、讀咒、取印都停在原處。';
    keys.clear(); holdTake = false; press = {};
  }
  function fmt(s) { const m = Math.floor(s / 60), r = Math.floor(s % 60); return m + ':' + String(r).padStart(2, '0'); }
  function best() { try { return +localStorage.getItem('xieyi.deng.best') || 0; } catch (e) { return 0; } }
  function showBest() { const b = best(); $('best').textContent = b ? ' · 最快出宅 ' + fmt(b) : ''; }
  function endGame(win) {
    running = false;
    const s = g.stats;
    let rec = '';
    if (win) { const b = best(); if (!b || g.t < b) { try { localStorage.setItem('xieyi.deng.best', String(g.t)); } catch (e) { /* 沒有就算了 */ } rec = '（新紀錄）'; } }
    $('end-seal').textContent = win ? '出' : '失';
    $('end-seal').className = 'endseal' + (win ? '' : ' lose');
    $('end-title').textContent = win ? '出宅' : '失魂';
    $('end-text').textContent = win ? '天還沒亮，你帶著名印與息印出了大門。' : '寒意滿了。紙宅的夜，還沒過完。';
    const rows = [['用時', fmt(g.t) + rec], ['兩印', (g.seals.name ? '名' : '　') + ' ' + (g.seals.breath ? '息' : '　')], ['最高寒意', Math.round(s.maxChill)], ['被咬', s.bites + ' 次（護持擋下 ' + s.armorLost + '）'], ['魄撲空', s.whiffs + ' 次'], ['打散魄', s.disperse + ' 次'], ['用了', `劍 ${s.swordHits + s.swordMiss}・鈴 ${s.bells}・火符 ${s.fires}・咒 ${s.reads}`]];
    $('end-stats').innerHTML = rows.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('');
    $('end').classList.remove('hidden');
    SFX.play(win ? 'win' : 'lose');
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
        case 'busy': log(e.what === 'sword' || e.what === 'fire' ? (g.p.reading ? '讀咒中只能搖鈴（K）' : '取印中，先放開 E') : '手上正忙'); break;
        case 'sealDone': log('封戶：這個廊口十秒內誰也過不去', 'good'); break;
        case 'sealEnd': log('封戶散了'); break;
        case 'borrowDone': log('借火：火會燒十五秒，魄會被火吸引過去', 'good'); break;
        case 'takeStart': log('取印中……'); break;
        case 'takeCancel': if (e.why === 'bite') log('被咬，取印要重來', 'warn'); break;
        case 'seal': SFX.play('seal'); log('取得' + e.glyph + '印', 'good'); break;
        case 'wake': SFX.play('wake'); log(e.why === 'bell' ? '鈴聲吵醒了什麼' : e.why === 'touch' ? '你撞醒了一隻魄' : '宅裡有東西醒了', 'warn'); break;
        case 'disperse': SFX.play('disperse'); log('魄散了，過一陣子會在別處凝回來', 'good'); break;
        case 'reformStart': if (g.spotVisible(e)) log('那裡有東西在凝形', 'warn'); break;
        case 'exitOpen': SFX.play('door'); log('大門開了', 'good'); break;
        case 'pickup': log('撿到一張火符', 'good'); break;
        case 'lamp': SFX.play('lamp', e.on); break;
        case 'win': endGame(true); break;
        case 'lose': endGame(false); break;
      }
    }
  }

  // ---------- 輸入 ----------
  const MOVE = { KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1], KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0] };
  const ACT = { KeyJ: 'sword', KeyK: 'bell', KeyL: 'fire', KeyF: 'lamp', Space: 'lamp', Digit1: 'read1', Digit2: 'read2', Numpad1: 'read1', Numpad2: 'read2' };
  addEventListener('keydown', (ev) => {
    if (ev.code === 'Space' || ev.code.startsWith('Arrow')) ev.preventDefault();
    if (!$('start').classList.contains('hidden')) { if (ev.code === 'Enter' || ev.code === 'NumpadEnter') { ev.preventDefault(); begin(); } return; }
    if (!$('end').classList.contains('hidden')) { if (ev.code === 'Enter' || ev.code === 'NumpadEnter') { ev.preventDefault(); newGame(); } return; }
    if (ev.code === 'Escape') { setPause(!paused); return; }
    if (paused || !running) return;
    if (MOVE[ev.code]) keys.add(ev.code);
    if (ev.repeat) return;
    if (ACT[ev.code]) press[ACT[ev.code]] = true;
    if (ev.code === 'KeyE') holdTake = true;
  });
  addEventListener('keyup', (ev) => { keys.delete(ev.code); if (ev.code === 'KeyE') holdTake = false; });
  addEventListener('blur', () => { keys.clear(); holdTake = false; if (running && !paused) setPause(true, 'blur'); });
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
    $('goal').innerHTML = `<span class="s${g.seals.name ? ' got' : ''}"><i>名</i>印</span><span class="s${g.seals.breath ? ' got' : ''}"><i>息</i>印</span><span class="door${g.exitOpen ? ' open' : ''}">大門${g.exitOpen ? '開了' : '關著'}</span>`;
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

  function begin() { SFX.unlock(); newGame(); }
  $('btn-start').addEventListener('click', begin);
  $('btn-again').addEventListener('click', () => { SFX.unlock(); newGame(); });
  $('btn-resume').addEventListener('click', () => setPause(false));
  $('btn-restart').addEventListener('click', () => newGame());
  $('btn-pause').addEventListener('click', (ev) => { setPause(true); ev.currentTarget.blur(); });
  const muteBtns = () => ['btn-mute', 'btn-mute2'].forEach((id) => { $(id).classList.toggle('off', SFX.muted); $(id).textContent = SFX.muted ? '音效關' : '音效'; });
  ['btn-mute', 'btn-mute2'].forEach((id) => $(id).addEventListener('click', (ev) => { SFX.unlock(); SFX.toggle(); muteBtns(); ev.currentTarget.blur(); }));
  muteBtns(); showBest();
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) $('touchnote').textContent = '這一版是試做，只做了鍵盤與滑鼠；手機上還不能玩。';

  // 先在背景擺好宅子（開始畫面後面看得到一點點）
  window.DENG = { R, ENGINE: E, RENDER: RD, newGame, setPause, get paused() { return paused; }, get running() { return running; }, keys, g: null };
  g = E.create({ seed: seedFromUrl() }); window.DENG.g = g; RD.setGame(g); g.drain();
  const fontReady = document.fonts && document.fonts.load ? document.fonts.load('32px "LXGW WenKai TC"', '燈下無明魄噬人火封') : Promise.resolve();
  fontReady.catch(() => {}).then(() => { RD.rebuild(); window.DENG.ready = true; });
  requestAnimationFrame(loop);
})();
