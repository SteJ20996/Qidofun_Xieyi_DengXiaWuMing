// 燈下無明 —— 畫面：宣紙是光，墨是黑暗。看得見的地方露出紙，其餘是墨。
(function (root) {
  const R = root.R, MAP = root.MAP, T = MAP.T;
  const FONT = '"LXGW WenKai TC", "Kaiti TC", "BiauKai", "DFKai-SB", "Noto Serif TC", serif';
  const C = { ink: '#0d0c0b', wall: '#211d19', paper: '#ebe0c6', court: '#ddd6c4', screen: '#f2e8d0', red: '#b4392a', gold: '#d9a441', po: '#3c4247', poDark: '#cfeee6' };
  const TS = 48;   // 底圖每格幾像素
  const hyp = Math.hypot;

  let cv, ctx, g, art, mask, mctx, warm, wctx, cam = { x: 0, y: 0, s: 40 }, fx = [], floats = [], t = 0;

  function rnd(seed) { let a = seed; return () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff; }; }

  // ---------- 靜態底圖：地板、牆、紙屏、井、廊口、房名 ----------
  function buildArt(m) {
    const c = document.createElement('canvas');
    c.width = m.W * TS; c.height = m.H * TS;
    const x = c.getContext('2d'), r = rnd(1016);
    x.fillStyle = C.paper; x.fillRect(0, 0, c.width, c.height);
    // 天井鋪石，其他房間鋪木板
    for (let ty = 0; ty < m.H; ty++) for (let tx = 0; tx < m.W; tx++) {
      const k = m.at(tx, ty), court = m.room(tx, ty) === '天井';
      if (k === T.WALL) continue;
      const px = tx * TS, py = ty * TS;
      if (court) {
        x.fillStyle = C.court; x.fillRect(px, py, TS, TS);
        x.strokeStyle = 'rgba(40,34,28,.10)'; x.lineWidth = 1; x.strokeRect(px + 1.5, py + 1.5, TS - 3, TS - 3);
      } else {
        x.strokeStyle = 'rgba(60,45,30,.07)'; x.lineWidth = 1;
        for (let k2 = 1; k2 < 3; k2++) { x.beginPath(); x.moveTo(px, py + (k2 * TS) / 3 + 0.5); x.lineTo(px + TS, py + (k2 * TS) / 3 + 0.5); x.stroke(); }
      }
      // 紙的纖維
      x.fillStyle = 'rgba(90,70,40,.05)';
      for (let k2 = 0; k2 < 6; k2++) x.fillRect(px + r() * TS, py + r() * TS, 1 + r() * 5, 1);
    }
    // 房名：淡淡寫在地上
    x.textAlign = 'center'; x.textBaseline = 'middle';
    for (const [name, x0, y0, x1, y1] of MAP.ROOMS) {
      x.font = `${Math.round(TS * 1.6)}px ${FONT}`; x.fillStyle = 'rgba(40,30,20,.075)';
      x.fillText(name, ((x0 + x1 + 1) / 2) * TS, ((y0 + y1 + 1) / 2) * TS);
    }
    // 牆：墨塊加毛邊
    for (let ty = 0; ty < m.H; ty++) for (let tx = 0; tx < m.W; tx++) {
      if (m.at(tx, ty) !== T.WALL) continue;
      const px = tx * TS, py = ty * TS;
      x.fillStyle = C.wall; x.fillRect(px - 0.5, py - 0.5, TS + 1, TS + 1);
      x.fillStyle = 'rgba(0,0,0,.35)';
      for (let k2 = 0; k2 < 5; k2++) x.fillRect(px + r() * TS, py + r() * TS, 2 + r() * 10, 1 + r() * 2);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {   // 牆與地板的交界：一道不太直的墨線
        const k = m.at(tx + dx, ty + dy);
        if (k === T.WALL || k === T.EXIT) continue;
        x.strokeStyle = 'rgba(10,8,6,.9)'; x.lineWidth = 3 + r() * 2.5; x.lineCap = 'round';
        x.beginPath();
        if (dx) { const ex = px + (dx > 0 ? TS : 0); x.moveTo(ex + (r() - 0.5) * 2, py + r() * 4); x.quadraticCurveTo(ex + (r() - 0.5) * 4, py + TS / 2, ex + (r() - 0.5) * 2, py + TS - r() * 4); }
        else { const ey = py + (dy > 0 ? TS : 0); x.moveTo(px + r() * 4, ey + (r() - 0.5) * 2); x.quadraticCurveTo(px + TS / 2, ey + (r() - 0.5) * 4, px + TS - r() * 4, ey + (r() - 0.5) * 2); }
        x.stroke();
      }
    }
    // 紙屏：格子窗
    for (let ty = 0; ty < m.H; ty++) for (let tx = 0; tx < m.W; tx++) {
      if (m.at(tx, ty) !== T.SCREEN) continue;
      const px = tx * TS, py = ty * TS, horiz = m.at(tx - 1, ty) === T.SCREEN || m.at(tx + 1, ty) === T.SCREEN;
      const M = TS * 0.12, bx = horiz ? px : px + M, by = horiz ? py + M : py, bw = horiz ? TS : TS - 2 * M, bh = horiz ? TS - 2 * M : TS;
      x.fillStyle = C.screen; x.fillRect(bx, by, bw, bh);
      x.strokeStyle = 'rgba(60,45,30,.45)'; x.lineWidth = 1;
      for (let k2 = 1; k2 < 4; k2++) { x.beginPath(); x.moveTo(bx + (bw * k2) / 4, by); x.lineTo(bx + (bw * k2) / 4, by + bh); x.stroke(); x.beginPath(); x.moveTo(bx, by + (bh * k2) / 4); x.lineTo(bx + bw, by + (bh * k2) / 4); x.stroke(); }
      x.strokeStyle = 'rgba(40,28,18,.85)'; x.lineWidth = 2.5; x.strokeRect(bx + 1, by + 1, bw - 2, bh - 2);
    }
    // 井
    const wells = [];
    for (let ty = 0; ty < m.H; ty++) for (let tx = 0; tx < m.W; tx++) if (m.at(tx, ty) === T.LOW) wells.push([tx, ty]);
    if (wells.length) {
      const cx = (wells.reduce((a, w) => a + w[0], 0) / wells.length + 0.5) * TS, cy = (wells.reduce((a, w) => a + w[1], 0) / wells.length + 0.5) * TS;
      x.fillStyle = 'rgba(30,26,22,.85)'; x.beginPath(); x.arc(cx, cy, TS * 0.95, 0, Math.PI * 2); x.fill();
      x.fillStyle = 'rgba(12,10,9,1)'; x.beginPath(); x.arc(cx, cy, TS * 0.62, 0, Math.PI * 2); x.fill();
      x.font = `${Math.round(TS * 1.2)}px ${FONT}`; x.fillStyle = 'rgba(235,224,198,.55)'; x.fillText('井', cx, cy + 2);
    }
    // 廊口：兩側門框
    for (const d of m.doors) {
      const px = d.x * TS, py = d.y * TS, vert = m.at(d.x, d.y - 1) === T.WALL || m.at(d.x, d.y - 1) === T.SCREEN;
      x.fillStyle = 'rgba(70,45,25,.55)';
      if (vert) { x.fillRect(px, py + 2, TS, 3); x.fillRect(px, py + TS - 5, TS, 3); }
      else { x.fillRect(px + 2, py, 3, TS); x.fillRect(px + TS - 5, py, 3, TS); }
    }
    return c;
  }

  // ---------- 座標 ----------
  const sx = (x) => (x - cam.x) * cam.s + cv.width / 2;
  const sy = (y) => (y - cam.y) * cam.s + cv.height / 2;

  function glyph(ch, x, y, size, color, o) {
    o = o || {};
    ctx.save();
    ctx.translate(sx(x), sy(y));
    if (o.rot) ctx.rotate(o.rot);
    if (o.scale) ctx.scale(o.scale, o.scale);
    ctx.globalAlpha = o.a == null ? 1 : o.a;
    if (o.glow) { ctx.shadowColor = o.glow; ctx.shadowBlur = o.blur || 12; }
    if (o.filter) ctx.filter = o.filter;
    ctx.font = `${Math.round(size * cam.s)}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (o.stroke) { ctx.lineWidth = o.stroke; ctx.strokeStyle = o.strokeColor || C.paper; ctx.lineJoin = 'round'; ctx.strokeText(ch, 0, 0); }
    ctx.fillStyle = color; ctx.fillText(ch, 0, 0);
    ctx.restore();
  }
  function glow(x, y, r, color, a) {
    const X = sx(x), Y = sy(y), rr = r * cam.s;
    const gr = ctx.createRadialGradient(X, Y, 0, X, Y, rr);
    gr.addColorStop(0, color.replace('A', a)); gr.addColorStop(1, color.replace('A', 0));
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(X, Y, rr, 0, Math.PI * 2); ctx.fill();
  }

  // ---------- 事件變成畫面上的效果 ----------
  function float(text, x, y, color, o) { floats.push(Object.assign({ text, x, y, color: color || C.ink, t: 0, life: 1.1, size: 0.55 }, o || {})); }
  function event(e) {
    const p = g.p;
    switch (e.type) {
      case 'swing': fx.push({ k: 'swing', x: e.x, y: e.y, dir: e.dir, t: 0, life: 0.2 }); break;
      case 'swordHit': fx.push({ k: 'splash', x: e.x, y: e.y, t: 0, life: 0.35, c: '20,18,16' }); break;
      case 'swordMiss': float(e.why === 'dir' ? '空 · 偏了' : e.why === 'far' ? '空 · 差一步' : e.why === 'wall' ? '空 · 隔著' : '空', e.x, e.y, '#6b5a48', { size: 0.42 }); break;
      case 'bell': fx.push({ k: 'ring', x: e.x, y: e.y, t: 0, life: 0.45, r: R.BELL.r }); fx.push({ k: 'hear', x: e.x, y: e.y, t: 0, life: 1.4, r: R.BELL.hear }); float('鈴', e.x, e.y - 0.9, '#8a6a1c'); break;
      case 'fireBoom': fx.push({ k: 'boom', x: e.x, y: e.y, t: 0, life: 0.5 }); break;
      case 'bite': fx.push({ k: 'bite', t: 0, life: 0.45 }); float('噬', p.x, p.y - 0.8, C.red, { size: 0.7 }); float(e.absorbed ? (e.chill ? `護 −${e.absorbed}　寒 +${e.chill}` : `護 −${e.absorbed}`) : `寒 +${e.chill}`, p.x, p.y + 0.8, e.absorbed ? '#5b4a8a' : '#3f6f8a', { size: 0.36 }); break;
      case 'whiff': { const po = g.pos.find((q) => q.id === e.id); if (po && po.vis) float('撲空', e.x, e.y - 0.8, '#6b5a48', { size: 0.4 }); break; }
      case 'interrupt': { const po = g.pos.find((q) => q.id === e.id); if (po) float('斷', po.x, po.y - 0.9, C.red, { size: 0.5 }); break; }
      case 'disperse': fx.push({ k: 'disperse', x: e.x, y: e.y, t: 0, life: 1.0, seed: Math.random() * 1e6 }); if (g.poVis({ state: 'patrol', x: e.x, y: e.y }) || hyp(e.x - p.x, e.y - p.y) < 4.5) float('散', e.x, e.y - 0.6, '#4a4540', { size: 0.6 }); break;
      case 'wake': { const po = g.pos.find((q) => q.id === e.id); if (po && po.vis) float('醒', e.x, e.y - 0.9, C.red, { size: 0.5 }); break; }
      case 'seal': fx.push({ k: 'stamp', x: p.x, y: p.y, t: 0, life: 0.8, glyph: e.glyph }); break;
      case 'sealDone': fx.push({ k: 'sealIn', x: e.x + 0.5, y: e.y + 0.5, t: 0, life: 0.4 }); break;
      case 'borrowDone': fx.push({ k: 'ignite', x: e.x, y: e.y, t: 0, life: 0.5 }); break;
      case 'pickup': float('+符', p.x, p.y - 0.8, C.red, { size: 0.42 }); break;
    }
  }

  // ---------- 一幀 ----------
  function frame(dt, w) {
    t += dt;
    const W = cv.width, H = cv.height, m = g.m, p = g.p;
    // 鏡頭：每格大小跟著螢幕；跟著人走，稍微平滑
    const s = Math.max(26, Math.min(76, Math.min(W / 21, H / 12.5)));
    cam.s = s;
    const k = 1 - Math.pow(0.0005, dt);
    cam.x += (p.x - cam.x) * k; cam.y += (p.y - cam.y) * k;
    if (w && w.snap) { cam.x = p.x; cam.y = p.y; }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.ink; ctx.fillRect(0, 0, W, H);
    const v = g.view(13);
    // 底圖
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(art, sx(0), sy(0), m.W * s, m.H * s);
    drawFloorThings(v);
    // 墨：看不見的地方蓋起來；走過的地方留一點點牆影
    const md = mask.data;
    for (let i = 0; i < m.W * m.H; i++) {
      const b = Math.min(1, v.vis[i] * 1.3);
      let a = 1 - b;
      if (g.explored[i] && a > 0.9) a = 0.9;
      md[i * 4] = 13; md[i * 4 + 1] = 12; md[i * 4 + 2] = 11; md[i * 4 + 3] = Math.round(a * 255);
      const L = v.light[i] * (v.paper[i] ? 0.4 : 1) * (v.vis[i] > 0 ? 1 : 0);
      const wd = warm.data; wd[i * 4] = 255; wd[i * 4 + 1] = 150; wd[i * 4 + 2] = 60; wd[i * 4 + 3] = Math.round(Math.min(1, L) * 60);
    }
    mctx.putImageData(mask, 0, 0); wctx.putImageData(warm, 0, 0);
    ctx.drawImage(mctx.canvas, sx(0), sy(0), m.W * s, m.H * s);
    ctx.globalCompositeOperation = 'soft-light';
    ctx.drawImage(wctx.canvas, sx(0), sy(0), m.W * s, m.H * s);
    ctx.globalCompositeOperation = 'source-over';
    drawLights(v);
    drawPos(v);
    drawPlayer();
    drawShots();
    drawFx(dt);
    drawFloats(dt);
    drawScreenFx(dt);
  }

  function visAt(v, x, y) { const i = Math.floor(y) * g.m.W + Math.floor(x); return v.vis[i] || 0; }

  // 地上的東西：先畫，讓墨蓋過去
  function drawFloorThings(v) {
    const p = g.p;
    for (const a of g.altars) {
      ctx.fillStyle = '#3b2a1e'; ctx.fillRect(sx(a.x - 0.42), sy(a.y - 0.3), 0.84 * cam.s, 0.6 * cam.s);
      if (!a.taken) {
        ctx.fillStyle = C.red; ctx.fillRect(sx(a.x - 0.24), sy(a.y - 0.24), 0.48 * cam.s, 0.48 * cam.s);
        glyph(a.glyph, a.x, a.y + 0.02, 0.36, '#f6ecd8');
      }
    }
    for (const k of g.pickups) if (!k.taken) {
      ctx.save(); ctx.translate(sx(k.x), sy(k.y)); ctx.rotate(-0.25);
      ctx.fillStyle = '#e8c860'; ctx.fillRect(-0.13 * cam.s, -0.32 * cam.s, 0.26 * cam.s, 0.64 * cam.s);
      ctx.restore(); glyph('火', k.x, k.y, 0.24, C.red, { rot: -0.25 });
    }
    // 大門
    for (const e of g.m.exits) {
      ctx.fillStyle = g.exitOpen ? 'rgba(235,224,198,.0)' : '#4a2618';
      if (!g.exitOpen) ctx.fillRect(sx(e.x), sy(e.y), cam.s, cam.s * 0.9);
    }
    const ex = g.m.exits;
    if (ex.length) { const cx = (ex[0].x + ex[ex.length - 1].x + 1) / 2, cy = ex[0].y + 0.45; glyph('門', cx, cy, 0.8, g.exitOpen ? '#7a5a2a' : '#e8d9b8', { a: g.exitOpen ? 0.55 : 0.9 }); }
    // 封戶：紙條橫過廊口
    for (const [, s] of g.sealed) {
      const blink = s.t < 2 ? 0.45 + 0.55 * Math.abs(Math.sin(t * 9)) : 1;
      const vert = g.m.at(s.x, s.y - 1) === T.WALL || g.m.at(s.x, s.y - 1) === T.SCREEN;
      ctx.save(); ctx.globalAlpha = blink; ctx.translate(sx(s.x + 0.5), sy(s.y + 0.5)); if (vert) ctx.rotate(Math.PI / 2);
      ctx.fillStyle = '#f0deb0'; ctx.fillRect(-0.18 * cam.s, -0.5 * cam.s, 0.36 * cam.s, cam.s);
      ctx.strokeStyle = C.red; ctx.lineWidth = 2; ctx.strokeRect(-0.18 * cam.s, -0.5 * cam.s, 0.36 * cam.s, cam.s);
      ctx.restore();
      glyph('封', s.x + 0.5, s.y + 0.5, 0.3, C.red, { a: blink });
    }
  }

  // 光源本身：火苗看得見就畫（隔著紙屏只看到一團暈）
  function drawLights(v) {
    for (const c of g.m.candles) {
      const b = visAt(v, c.x, c.y), line = g.sightLine(g.p.x, g.p.y, c.x, c.y);
      if (line === 'blocked' || hyp(c.x - g.p.x, c.y - g.p.y) > 14) continue;
      const fl = 0.85 + 0.15 * Math.sin(t * 11 + c.x * 3) * Math.sin(t * 7 + c.y);
      glow(c.x, c.y - 0.1, line === 'paper' ? 0.9 : 0.6, 'rgba(255,170,70,A)', line === 'paper' ? 0.25 : 0.55 * fl);
      if (line === 'clear') {
        ctx.fillStyle = '#efe6d2'; ctx.fillRect(sx(c.x - 0.06), sy(c.y - 0.05), 0.12 * cam.s, 0.32 * cam.s);
        ctx.fillStyle = `rgba(255,${190 + 30 * fl | 0},90,.95)`; ctx.beginPath(); ctx.ellipse(sx(c.x), sy(c.y - 0.16), 0.07 * cam.s, 0.13 * cam.s * fl, 0, 0, Math.PI * 2); ctx.fill();
      }
      void b;
    }
    for (const l of g.lures) {
      const line = g.sightLine(g.p.x, g.p.y, l.x, l.y);
      if (line === 'blocked') continue;
      const fade = Math.min(1, l.t / 2), fl = 0.85 + 0.15 * Math.sin(t * 13 + l.id);
      glow(l.x, l.y, 1.1, 'rgba(255,150,60,A)', (line === 'paper' ? 0.25 : 0.6) * fade);
      if (line === 'clear') glyph('火', l.x, l.y - 0.05 * Math.sin(t * 5), 0.55, '#c8461f', { a: fade * fl, glow: 'rgba(255,150,60,.9)', blur: 16 });
    }
    // 黑暗中，印還有一點紅光（眼睛習慣後看得到）
    if (!g.p.lampOn && g.p.adapt > 0.3) for (const a of g.altars) if (!a.taken && hyp(a.x - g.p.x, a.y - g.p.y) <= g.p.adapt * R.LAMP.adaptR + 1 && g.sightLine(g.p.x, g.p.y, a.x, a.y) === 'clear') glow(a.x, a.y, 0.5, 'rgba(200,60,40,A)', 0.35 * g.p.adapt);
  }

  // 魄：照見是灰墨；黑暗裡是微光；隔紙屏是剪影
  function drawPos(v) {
    const P = R.PO;
    for (const e of g.pos) {
      if (e.state === 'gone') {
        if (e.formSpot && e.goneT <= P.formT && g.spotVisible(e.formSpot)) {
          const f = 1 - Math.max(0, e.goneT) / P.formT, s = e.formSpot;
          for (let k = 0; k < 14; k++) { const a = k * 2.4 + t * 2, r = (1 - f) * 1.4 + 0.15; ctx.fillStyle = `rgba(40,44,48,${0.25 + 0.5 * f})`; ctx.beginPath(); ctx.arc(sx(s.x + Math.cos(a) * r), sy(s.y + Math.sin(a) * r), 0.05 * cam.s, 0, Math.PI * 2); ctx.fill(); }
          glyph('魄', s.x, s.y, 0.8, C.po, { a: 0.15 + 0.35 * f });
          glyph('凝', s.x, s.y - 0.85, 0.32, '#5c6168', { a: 0.6 });
        }
        continue;
      }
      const vis = e.vis;
      if (!vis) continue;
      const hpF = Math.max(0.25, e.hp / P.hp);
      let ox = 0, oy = 0;
      if (e.state === 'stagger') { ox = (Math.random() - 0.5) * 0.08; oy = (Math.random() - 0.5) * 0.08; }
      if (e.state === 'windup') { ox = (Math.random() - 0.5) * 0.05; }
      const wob = 1 + 0.05 * Math.sin(t * 3 + e.id), x = e.x + ox, y = e.y + oy;
      const dorm = e.state === 'dormant';
      if (vis.mode === 'silhouette') {
        glyph('魄', x, y, 0.9, 'rgba(30,24,20,1)', { a: 0.55 * vis.a, filter: 'blur(3px)', scale: wob });
        continue;
      }
      if (vis.mode === 'dark') {
        glyph('魄', x, y, dorm ? 0.7 : 0.9, C.poDark, { a: Math.min(1, vis.a * 1.4) * (0.5 + 0.5 * hpF), glow: 'rgba(170,240,225,.9)', blur: 14, scale: wob, rot: dorm ? -0.4 : 0 });
      } else {
        glow(x, y, 0.75, 'rgba(225,240,245,A)', 0.35 * vis.a);
        glyph('魄', x, y, dorm ? 0.7 : 0.9, C.po, { a: vis.a * (0.45 + 0.55 * hpF), scale: wob, rot: dorm ? -0.4 : 0, stroke: 3, strokeColor: 'rgba(235,240,240,.5)' });
      }
      if (dorm) glyph('眠', x + 0.45, y - 0.55, 0.26, '#6e7378', { a: 0.6 * vis.a });
      if (e.burnT > 0) for (let k = 0; k < 3; k++) glyph('火', x + Math.sin(t * 6 + k * 2) * 0.35, y + 0.35 - ((t * 1.5 + k / 3) % 1) * 0.8, 0.22, '#d2552a', { a: 0.8 });
      // 蓄撲：「噬」字與撲擊範圍圈（看得見才有；黑暗裡只有聲音）
      if (e.state === 'windup' && e.windVisible) {
        const f = 1 - e.windT / P.windT;
        ctx.save(); ctx.setLineDash([6, 5]); ctx.strokeStyle = `rgba(180,57,42,${0.5 + 0.4 * f})`; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(sx(e.x), sy(e.y), P.biteR * cam.s, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
        ctx.fillStyle = `rgba(180,57,42,${0.08 + 0.12 * f})`; ctx.beginPath(); ctx.arc(sx(e.x), sy(e.y), P.biteR * cam.s, -Math.PI / 2, -Math.PI / 2 + f * Math.PI * 2); ctx.lineTo(sx(e.x), sy(e.y)); ctx.fill();
        glyph('噬', e.x, e.y - 0.95, 0.55 + 0.15 * f, C.red, { stroke: 4, strokeColor: 'rgba(240,230,210,.85)' });
      }
      if (e.state === 'recover' && vis) glyph('…', e.x, e.y - 0.8, 0.4, '#6b5a48', { a: 0.7 });
    }
  }

  function drawPlayer() {
    const p = g.p, x = p.x, y = p.y;
    // 讀咒與取印的進度圈
    const prog = p.reading ? p.reading.t / p.reading.dur : p.taking ? p.taking.t / R.TAKE.t : 0;
    if (prog > 0) {
      ctx.strokeStyle = p.reading ? 'rgba(150,40,30,.85)' : 'rgba(180,57,42,.9)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(sx(x), sy(y), 0.55 * cam.s, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2); ctx.stroke();
      glyph(p.reading ? (p.reading.spell === 'seal' ? '封戶' : '借火') : '取印', x, y - 0.85, 0.3, '#7a2a1e', { stroke: 3 });
    }
    ctx.fillStyle = C.paper; ctx.strokeStyle = '#1c1a17'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sx(x), sy(y), p.r * cam.s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    glyph('人', x, y + 0.02, 0.42, '#1c1a17');
    // 對準方向：一小撇
    const ax = x + Math.cos(p.aim) * 0.5, ay = y + Math.sin(p.aim) * 0.5;
    ctx.strokeStyle = 'rgba(180,57,42,.9)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(sx(x + Math.cos(p.aim) * 0.36), sy(y + Math.sin(p.aim) * 0.36)); ctx.lineTo(sx(ax), sy(ay)); ctx.stroke();
    // 手燈：掛在身側
    const lx = x + Math.cos(p.aim + 1.9) * 0.36, ly = y + Math.sin(p.aim + 1.9) * 0.36;
    if (p.lampOn) { glow(lx, ly, 0.5, 'rgba(255,190,90,A)', 0.8); ctx.fillStyle = '#ffdc96'; }
    else ctx.fillStyle = '#2a2420';
    ctx.strokeStyle = '#5a3a1e'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(sx(lx), sy(ly), 0.11 * cam.s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  function drawShots() {
    for (const s of g.shots) {
      glow(s.x, s.y, 0.5, 'rgba(255,140,50,A)', 0.7);
      glyph('火', s.x, s.y, 0.32, '#b8361c');
    }
  }

  function drawFx(dt) {
    for (const f of fx) {
      f.t += dt;
      const q = f.t / f.life;
      if (f.k === 'swing') {
        ctx.save(); ctx.strokeStyle = `rgba(30,24,18,${0.85 * (1 - q)})`; ctx.lineCap = 'round'; ctx.lineWidth = 0.16 * cam.s * (1 - q * 0.6);
        const a0 = f.dir - 1.0 + q * 0.5, a1 = f.dir + 1.0;
        ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), R.SWORD.reach * 0.85 * cam.s, a0, a1); ctx.stroke(); ctx.restore();
      } else if (f.k === 'splash') {
        for (let k = 0; k < 7; k++) { const a = k * 0.9, r = 0.2 + q * 0.6; ctx.fillStyle = `rgba(${f.c},${0.7 * (1 - q)})`; ctx.beginPath(); ctx.arc(sx(f.x + Math.cos(a) * r), sy(f.y + Math.sin(a) * r), (0.09 - 0.05 * q) * cam.s, 0, Math.PI * 2); ctx.fill(); }
      } else if (f.k === 'ring') {
        ctx.strokeStyle = `rgba(217,164,65,${0.9 * (1 - q)})`; ctx.lineWidth = 3;
        for (const k of [1, 0.7]) { ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), f.r * Math.min(1, q * 1.3) * k * cam.s, 0, Math.PI * 2); ctx.stroke(); }
      } else if (f.k === 'hear') {   // 鈴聲傳得很遠：一道淡淡的圈
        ctx.strokeStyle = `rgba(217,164,65,${0.28 * (1 - q)})`; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(sx(f.x), sy(f.y), f.r * q * cam.s, 0, Math.PI * 2); ctx.stroke();
      } else if (f.k === 'boom') {
        glow(f.x, f.y, R.FIRE.boom * (0.6 + q * 0.6), 'rgba(230,100,40,A)', 0.75 * (1 - q));
        for (let k = 0; k < 10; k++) { const a = k * 0.63, r = q * R.FIRE.boom; ctx.fillStyle = `rgba(160,40,20,${0.8 * (1 - q)})`; ctx.beginPath(); ctx.arc(sx(f.x + Math.cos(a) * r), sy(f.y + Math.sin(a) * r), 0.07 * cam.s, 0, Math.PI * 2); ctx.fill(); }
        if (q < 0.5) glyph('焚', f.x, f.y, 0.6, '#a8301a', { a: 1 - q * 2 });
      } else if (f.k === 'disperse') {
        const r2 = rnd(f.seed | 0);
        for (let k = 0; k < 18; k++) { const a = r2() * 6.28, d = q * (0.6 + r2() * 1.2); ctx.fillStyle = `rgba(45,48,52,${0.6 * (1 - q)})`; ctx.beginPath(); ctx.arc(sx(f.x + Math.cos(a) * d), sy(f.y + Math.sin(a) * d), 0.05 * cam.s, 0, Math.PI * 2); ctx.fill(); }
      } else if (f.k === 'stamp') {
        const sc = 1.6 - Math.min(1, q * 3) * 0.6;
        ctx.save(); ctx.globalAlpha = 1 - Math.max(0, q - 0.6) / 0.4; ctx.translate(sx(f.x), sy(f.y - 1)); ctx.scale(sc, sc);
        ctx.fillStyle = C.red; ctx.fillRect(-0.3 * cam.s, -0.3 * cam.s, 0.6 * cam.s, 0.6 * cam.s); ctx.restore();
        glyph(f.glyph, f.x, f.y - 1, 0.42 * sc, '#f6ecd8', { a: 1 - Math.max(0, q - 0.6) / 0.4 });
      } else if (f.k === 'sealIn' || f.k === 'ignite') {
        glow(f.x, f.y, 0.9, f.k === 'ignite' ? 'rgba(255,150,60,A)' : 'rgba(200,60,40,A)', 0.6 * (1 - q));
      }
    }
    fx = fx.filter((f) => f.t < f.life);
  }

  function drawFloats(dt) {
    for (const f of floats) {
      f.t += dt;
      const q = f.t / f.life;
      glyph(f.text, f.x, f.y - q * 0.5, f.size, f.color, { a: q < 0.7 ? 1 : 1 - (q - 0.7) / 0.3, stroke: 3, strokeColor: 'rgba(236,226,200,.8)' });
    }
    floats = floats.filter((f) => f.t < f.life);
  }

  // 寒意：畫面邊緣結霜（魄在身邊、寒意高時都會出現）；被咬時一閃
  function drawScreenFx() {
    const W = cv.width, H = cv.height, p = g.p;
    let near = 0;
    for (const e of g.pos) {
      if (e.state === 'gone' || e.state === 'dormant') continue;
      const d = hyp(e.x - p.x, e.y - p.y);
      if (d < 3 && g.hitClear(e.x, e.y, p.x, p.y)) near = Math.max(near, 1 - d / 3);
    }
    const frost = Math.min(1, near * 0.75 + (p.chill / 100) * 0.35);
    if (frost > 0.02) {
      const gr = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * (0.55 - 0.25 * frost), W / 2, H / 2, Math.max(W, H) * 0.72);
      gr.addColorStop(0, 'rgba(210,235,250,0)'); gr.addColorStop(1, `rgba(215,238,252,${0.75 * frost})`);
      ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
    }
    if (!p.lampOn && p.adapt > 0) { ctx.fillStyle = `rgba(30,50,70,${0.12 * p.adapt})`; ctx.fillRect(0, 0, W, H); }
    for (const f of fx) if (f.k === 'bite') { const q = f.t / f.life; ctx.fillStyle = `rgba(160,30,20,${0.28 * (1 - q)})`; ctx.fillRect(0, 0, W, H); }
    void frost;
  }

  // ---------- 小地圖：只有看清楚過的牆、屏、門與印；沒有魄 ----------
  function minimap(mc) {
    const m = g.m, x = mc.getContext('2d'), k = mc.width / m.W;
    x.clearRect(0, 0, mc.width, mc.height);
    for (let ty = 0; ty < m.H; ty++) for (let tx = 0; tx < m.W; tx++) {
      const i = ty * m.W + tx;
      if (!g.explored[i]) continue;
      const t2 = m.t[i];
      x.fillStyle = t2 === T.WALL ? '#2a241e' : t2 === T.SCREEN ? '#a89c84' : t2 === T.LOW ? '#5a5248' : t2 === T.EXIT ? (g.exitOpen ? '#e8c860' : '#6a3420') : '#e6dcc2';
      x.fillRect(tx * k, ty * k, k + 0.3, k + 0.3);
    }
    for (const a of g.altars) if (g.explored[Math.floor(a.y) * m.W + Math.floor(a.x)]) { x.fillStyle = a.taken ? '#8a7f6c' : C.red; x.fillRect(a.x * k - 2.5, a.y * k - 2.5, 5, 5); }
    for (const [, s] of g.sealed) { x.fillStyle = C.red; x.fillRect(s.x * k, s.y * k, k, k); }
    x.fillStyle = '#b4392a'; x.strokeStyle = '#fff'; x.lineWidth = 1;
    x.beginPath(); x.arc(g.p.x * k, g.p.y * k, 2.6, 0, Math.PI * 2); x.fill(); x.stroke();
  }

  function init(canvas) {
    cv = canvas; ctx = cv.getContext('2d');
  }
  function setGame(game) {
    g = game; fx = []; floats = [];
    art = art || buildArt(g.m);
    const mc = document.createElement('canvas'); mc.width = g.m.W; mc.height = g.m.H; mctx = mc.getContext('2d'); mask = mctx.createImageData(g.m.W, g.m.H);
    const wc = document.createElement('canvas'); wc.width = g.m.W; wc.height = g.m.H; wctx = wc.getContext('2d'); warm = wctx.createImageData(g.m.W, g.m.H);
    cam.x = g.p.x; cam.y = g.p.y;
  }
  function toWorld(px, py) { return { x: (px - cv.width / 2) / cam.s + cam.x, y: (py - cv.height / 2) / cam.s + cam.y }; }
  root.RENDER = { init, setGame, frame, event, minimap, toWorld, FONT, cam, rebuild() { art = null; if (g) art = buildArt(g.m); } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
