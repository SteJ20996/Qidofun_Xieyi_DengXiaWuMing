// 燈下無明 —— 3D 的開始畫面（長鏡頭）：同一個引擎、同一張地圖、同一條路線（src/tour.js），只換成立體的紙宅。
// 第一步只用在開始畫面；可玩的 3D 版（鏡頭在人背後）下一步再做。
// three.js r128（cdnjs 的全域版 THREE）。載不到或瀏覽器不能 3D，就回到 2D 的開始畫面。
// 座標：引擎的 (x, y) 是 three 的 (x, 高度, y)；一格一單位。
(function (root) {
  const R = root.R, MAP = root.MAP, T = MAP.T;
  const FONT = '"LXGW WenKai TC", "Kaiti TC", "BiauKai", "DFKai-SB", "Noto Serif TC", serif';
  const WALL_H = 1.5, SCREEN_H = 1.3, LANTERN_Y = 1.0;
  const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let THREE, renderer, scene, camera, cv, g = null, t = 0;
  let lantern, lanternLight, lanternGlow, candles = [], poSprites = [], screens = [], doors = null, motes, moteData = [];
  let cam = null;   // 鏡頭的位置、看的點、朝向（平滑跟著燈）
  // 畫質：0 全開（燈投影子）、1 關影子降解析度、2 太慢就回 2D（ui 看 failed）。網址 ?keep3d=1 不自動降（測試用）
  const perf = { q: 0, avg: 1 / 60, last: 0, since: 0, failed: false, keep: /[?&]keep3d=1/.test(root.location ? location.search : '') };
  const CAM = { back: 4.8, up: 7.0, ahead: 1.6 };

  function ok() {
    if (!root.THREE) return false;
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); } catch (e) { return false; }
  }

  // ---------- 字與紙的貼圖 ----------
  function glyphCanvas(ch, size, color, o) {
    o = o || {};
    const c = document.createElement('canvas'); c.width = c.height = size;
    const x = c.getContext('2d');
    if (o.bg) { x.fillStyle = o.bg; x.fillRect(0, 0, size, size); }
    if (o.glow) { x.shadowColor = o.glow; x.shadowBlur = size * 0.14; }
    if (o.blur) x.filter = `blur(${o.blur}px)`;
    x.font = `${Math.round(size * 0.74)}px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = color;
    x.fillText(ch, size / 2, size / 2 + size * 0.03);
    if (o.glow) x.fillText(ch, size / 2, size / 2 + size * 0.03);
    return c;
  }
  function tex(canvas) { const t2 = new THREE.CanvasTexture(canvas); t2.encoding = THREE.sRGBEncoding; t2.anisotropy = 4; return t2; }
  function latticeCanvas() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#f2e8d0'; x.fillRect(0, 0, 128, 128);
    x.fillStyle = 'rgba(90,70,40,.06)'; for (let k = 0; k < 60; k++) x.fillRect(Math.random() * 128, Math.random() * 128, 1 + Math.random() * 6, 1);
    x.strokeStyle = 'rgba(60,45,30,.55)'; x.lineWidth = 2;
    for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(k * 32, 0); x.lineTo(k * 32, 128); x.stroke(); x.beginPath(); x.moveTo(0, k * 32); x.lineTo(128, k * 32); x.stroke(); }
    x.strokeStyle = 'rgba(40,28,18,.9)'; x.lineWidth = 7; x.strokeRect(3, 3, 122, 122);
    return c;
  }
  function radial(color) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, color.replace('A', 1)); gr.addColorStop(1, color.replace('A', 0));
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return c;
  }

  function init(canvas) {
    THREE = root.THREE; cv = canvas;
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
    renderer.setPixelRatio(Math.min(1.75, root.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90);
    resize();
  }
  function resize() {
    if (!renderer) return;
    const w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 選單在左時，把燈放在右半邊（和 2D 的開始畫面一樣）
    if (w > 980) camera.setViewOffset(w, h, -w * 0.18, 0, w, h); else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }

  // ---------- 照地圖蓋宅子 ----------
  function setGame(game) {
    g = game; candles = []; poSprites = []; screens = []; doors = null; cam = null;
    const m = g.m, W = m.W, H = m.H;
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b0a09);
    scene.fog = new THREE.FogExp2(0x0b0a09, 0.065);
    scene.add(new THREE.AmbientLight(0x1c2232, 0.3));
    // 地板：2D 的宣紙底圖（只有地板、房名、廊口）
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex(root.RENDER.floorCanvas(m)), roughness: 0.96, metalness: 0 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, H / 2); floor.receiveShadow = true;
    scene.add(floor);
    // 牆：墨色的塊，深淺稍微不一，像墨暈
    const walls = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m.at(x, y) === T.WALL) walls.push([x, y]);
    const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(1, WALL_H, 1), new THREE.MeshStandardMaterial({ color: 0x2b241d, roughness: 0.92 }), walls.length);
    const o = new THREE.Object3D(), col = new THREE.Color();
    walls.forEach(([x, y], i) => { o.position.set(x + 0.5, WALL_H / 2, y + 0.5); o.updateMatrix(); wm.setMatrixAt(i, o.matrix); const k = 0.78 + Math.random() * 0.3; wm.setColorAt(i, col.setRGB(k, k * 0.96, k * 0.9)); });
    wm.castShadow = true; wm.receiveShadow = true;
    scene.add(wm);
    // 紙屏：格子紙，半透；被哪一邊的光照到都會亮（亮度照引擎的光），後面的魄看得到影子
    const lat = tex(latticeCanvas());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (m.at(x, y) !== T.SCREEN) continue;
      const horiz = m.at(x - 1, y) === T.SCREEN || m.at(x + 1, y) === T.SCREEN;
      const mat = new THREE.MeshStandardMaterial({ map: lat, transparent: true, opacity: 0.86, side: THREE.DoubleSide, roughness: 1, emissive: new THREE.Color(0xffb565), emissiveMap: lat, emissiveIntensity: 0 });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 1 : 0.1, SCREEN_H, horiz ? 0.1 : 1), mat);
      mesh.position.set(x + 0.5, SCREEN_H / 2, y + 0.5); mesh.receiveShadow = true;
      scene.add(mesh); screens.push({ mesh, i: y * W + x });
    }
    // 井
    const wells = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m.at(x, y) === T.LOW) wells.push([x, y]);
    if (wells.length) {
      const cx = wells.reduce((a, q) => a + q[0], 0) / wells.length + 0.5, cz = wells.reduce((a, q) => a + q[1], 0) / wells.length + 0.5;
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.0, 0.45, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x3a332c, roughness: 0.95, side: THREE.DoubleSide }));
      rim.position.set(cx, 0.225, cz); rim.castShadow = true; rim.receiveShadow = true; scene.add(rim);
      const top = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.98, 28), new THREE.MeshStandardMaterial({ color: 0x4a423a, roughness: 0.9 }));
      top.rotation.x = -Math.PI / 2; top.position.set(cx, 0.451, cz); scene.add(top);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28), new THREE.MeshBasicMaterial({ color: 0x050404 }));
      hole.rotation.x = -Math.PI / 2; hole.position.set(cx, 0.44, cz); scene.add(hole);
    }
    // 燭：一根蠟燭、一朵火、一盞會跳的光
    const flameTex = tex(radial('rgba(255,190,90,A)'));
    for (const c of m.candles) {
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.38, 10), new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.8, emissive: 0x3a2a10, emissiveIntensity: 0.4 }));
      stick.position.set(c.x, 0.19, c.y); scene.add(stick);
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      flame.position.set(c.x, 0.47, c.y); flame.scale.set(0.32, 0.42, 1); scene.add(flame);
      const light = new THREE.PointLight(0xffa04a, 1.0, 5.0, 2); light.position.set(c.x, 0.6, c.y); scene.add(light);
      candles.push({ flame, light, ph: Math.random() * 6 });
    }
    // 印臺
    for (const a of g.altars) {
      const table = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.5, 0.6), new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.85 }));
      table.position.set(a.x, 0.25, a.y); table.castShadow = true; table.receiveShadow = true; scene.add(table);
      const seal = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), [0, 0, 1, 0, 0, 0].map((k) => new THREE.MeshStandardMaterial(k ? { map: tex(glyphCanvas(a.glyph, 128, '#f6ecd8', { bg: '#b4392a' })), roughness: 0.6 } : { color: 0xb4392a, roughness: 0.6 })));
      seal.position.set(a.x, 0.57, a.y); seal.castShadow = true; scene.add(seal);
    }
    // 大門：兩扇門板，裡面那一面寫「門」
    if (m.exits.length) {
      const ex = m.exits, x0 = ex[0].x, x1 = ex[ex.length - 1].x + 1, z = ex[0].y + 0.2;
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a2618, roughness: 0.8 });
      const left = new THREE.Mesh(new THREE.BoxGeometry((x1 - x0) / 2, WALL_H * 0.95, 0.14), doorMat), right = left.clone();
      left.position.set(x0 + (x1 - x0) / 4, WALL_H * 0.475, z); right.position.set(x1 - (x1 - x0) / 4, WALL_H * 0.475, z);
      left.castShadow = right.castShadow = true;
      scene.add(left, right);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshStandardMaterial({ map: tex(glyphCanvas('門', 128, '#e8d9b8')), transparent: true, roughness: 0.9 }));
      sign.position.set((x0 + x1) / 2, WALL_H * 0.55, z - 0.08); sign.rotation.y = Math.PI; scene.add(sign);
      doors = { left, right };
    }
    // 魄：字的貼圖；照見是墨，黑暗裡是微光，隔紙屏是影子（從半透的紙屏後面看得到）
    const looks = {
      lit: tex(glyphCanvas('魄', 256, '#2e3338', { glow: 'rgba(235,242,245,.95)' })),
      dark: tex(glyphCanvas('魄', 256, '#d6f2ea', { glow: 'rgba(160,240,222,.95)' })),
      silhouette: tex(glyphCanvas('魄', 256, '#120e0b', { blur: 3 }))
    };
    for (const e of g.pos) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: looks.lit, transparent: true, depthWrite: false }));
      sp.scale.set(1.0, 1.0, 1); sp.visible = false; scene.add(sp);
      poSprites.push({ e, sp, looks });
    }
    // 那盞燈：紙燈籠、裡面的火、會投影子的光
    lantern = new THREE.Group();   // 圓的紙燈籠：幾道竹骨、上下木蓋、提把，正面一個「燈」
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffe6b8, emissive: 0xffa848, emissiveIntensity: 1.25, roughness: 0.7 }));
    shade.scale.set(1, 1.22, 1);
    const ribMat = new THREE.MeshStandardMaterial({ color: 0x6a3e1c, roughness: 0.8, emissive: 0x2a1406, emissiveIntensity: 0.6 });
    for (const yy of [-0.12, -0.04, 0.04, 0.12]) { const r = 0.17 * Math.sqrt(1 - Math.pow(yy / (0.17 * 1.22), 2)); const rib = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 6, 28), ribMat); rib.rotation.x = Math.PI / 2; rib.position.y = yy; lantern.add(rib); }
    const capMat = new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.7 });
    const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.05, 14), capMat), capB = capT.clone();
    capT.position.y = 0.215; capB.position.y = -0.215;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 6), capMat); handle.position.y = 0.39;
    const word = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(glyphCanvas('燈', 128, '#8a3a12')), transparent: true, depthTest: false, opacity: 0.85 }));
    word.scale.set(0.17, 0.17, 1); word.renderOrder = 2;
    lantern.add(shade, capT, capB, handle, word);
    lanternGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
    lanternGlow.scale.set(1.2, 1.2, 1); lantern.add(lanternGlow);
    lanternLight = new THREE.PointLight(0xffc27a, 1.9, 8.5, 1.6);
    lanternLight.castShadow = true; lanternLight.shadow.mapSize.set(512, 512); lanternLight.shadow.bias = -0.004; lanternLight.shadow.camera.near = 0.1; lanternLight.shadow.camera.far = 9;
    lantern.add(lanternLight);
    scene.add(lantern);
    // 光裡的灰塵
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(60 * 3);
    moteData = [];
    for (let k = 0; k < 60; k++) moteData.push({ ox: (Math.random() - 0.5) * 6, oy: Math.random() * 1.6, oz: (Math.random() - 0.5) * 6, ph: Math.random() * 6 });
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    motes = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffe2b0, size: 0.035, transparent: true, opacity: 0.65, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(motes);
  }

  // ---------- 一幀 ----------
  function frame(dt, w) {
    if (!renderer || !g) return;
    w = w || {};
    t += dt;
    const p = g.p, v = g.view(13);
    // 燈：在路線上飄，微微上下
    const bob = RM ? 0 : Math.sin(t * 2.2) * 0.06;
    lantern.position.set(p.x, LANTERN_Y + bob, p.y);
    const fl = RM ? 1 : 0.92 + 0.08 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1);
    lanternLight.intensity = 1.9 * fl; lanternGlow.material.opacity = 0.7 * fl;
    for (const c of candles) { const f = RM ? 1 : 0.85 + 0.15 * Math.sin(t * 11 + c.ph) * Math.sin(t * 7 + c.ph * 2); c.light.intensity = 1.0 * f; c.flame.scale.set(0.3, 0.42 * f, 1); }
    // 紙屏：照引擎算的光發亮（哪一邊照到都算）
    for (const s of screens) s.mesh.material.emissiveIntensity = Math.min(0.9, (v.light[s.i] || 0) * 0.9);
    // 魄：引擎說看得見才畫
    for (const q of poSprites) {
      const e = q.e, vis = e.vis;
      if (e.state === 'gone' || !vis) { q.sp.visible = false; continue; }
      q.sp.visible = true;
      q.sp.material.map = q.looks[vis.mode]; q.sp.material.needsUpdate = true;
      q.sp.material.opacity = vis.mode === 'silhouette' ? 0.85 : Math.min(1, vis.a * (vis.mode === 'dark' ? 1.4 : 1.1));
      const dorm = e.state === 'dormant';
      q.sp.material.rotation = dorm ? -0.5 : 0;
      const wob = RM ? 1 : 1 + 0.05 * Math.sin(t * 3 + e.id);
      q.sp.scale.set((dorm ? 0.8 : 1.0) * wob, (dorm ? 0.8 : 1.0) * wob, 1);
      q.sp.position.set(e.x, dorm ? 0.35 : 0.7 + (RM ? 0 : Math.sin(t * 1.7 + e.id) * 0.05), e.y);
    }
    // 灰塵：跟著燈飄
    const arr = motes.geometry.attributes.position.array;
    moteData.forEach((q, k) => {
      const a = q.ph + t * 0.25;
      arr[k * 3] = p.x + q.ox + Math.cos(a) * 0.4; arr[k * 3 + 1] = 0.2 + ((q.oy + t * 0.05) % 1.6); arr[k * 3 + 2] = p.y + q.oz + Math.sin(a * 0.8) * 0.4;
    });
    motes.geometry.attributes.position.needsUpdate = true;
    // 鏡頭：在燈的後上方，朝著燈要去的方向；位置與朝向都慢慢跟，一路平順
    const lead = w.lead || { dx: 1, dy: 0 };
    if (!cam || w.snap) cam = { dx: lead.dx, dy: lead.dy, x: p.x - lead.dx * CAM.back, y: CAM.up, z: p.y - lead.dy * CAM.back, lx: p.x + lead.dx * CAM.ahead, lz: p.y + lead.dy * CAM.ahead };
    const kd = 1 - Math.pow(0.35, dt), kp = 1 - Math.pow(0.12, dt);
    cam.dx += (lead.dx - cam.dx) * kd; cam.dy += (lead.dy - cam.dy) * kd;
    const dl = Math.hypot(cam.dx, cam.dy) || 1, dx = cam.dx / dl, dy = cam.dy / dl;
    cam.x += (p.x - dx * CAM.back - cam.x) * kp; cam.z += (p.y - dy * CAM.back - cam.z) * kp; cam.y += (CAM.up - cam.y) * kp;
    cam.lx += (p.x + dx * CAM.ahead - cam.lx) * kp; cam.lz += (p.y + dy * CAM.ahead - cam.lz) * kp;
    camera.position.set(cam.x, cam.y, cam.z);
    camera.lookAt(cam.lx, 0.3, cam.lz);
    renderer.render(scene, camera);
    watchPerf();
  }
  // 太慢就降：先關影子、降解析度；還是太慢就請 ui 換回 2D，免得一頓一頓的又像剪接
  function watchPerf() {
    const now = performance.now();
    if (perf.last) { const d = Math.min(0.5, (now - perf.last) / 1000); perf.avg += (d - perf.avg) * 0.05; perf.since += d; }
    perf.last = now;
    if (perf.keep || perf.since < 2.5) return;
    const fps = 1 / perf.avg;
    if (perf.q === 0 && fps < 30) { perf.q = 1; lanternLight.castShadow = false; renderer.setPixelRatio(1); resize(); perf.since = 0; }
    else if (perf.q === 1 && fps < 20) { perf.q = 2; perf.failed = true; }
  }

  root.RENDER3D = { ok, init, setGame, frame, resize, get cam() { return cam; }, get quality() { return perf.q; }, get failed() { return perf.failed; } };
})(typeof globalThis !== 'undefined' ? globalThis : this);
