// 燈下無明 —— 立體版：同一個引擎、同一張地圖，只換成立體的紙宅。
// 兩種用法：
// - 開始畫面的長鏡頭（attract）：一盞紙燈籠照路線（src/tour.js）飄過宅子，鏡頭在後上方。
// - 可玩的立體版（play，2026-11-22，擁有者：「遊戲內部沒有3d這個選項呀」）：鏡頭在人的背後。
//   地板就是 2D 地上那一層（RENDER.floorFrame：紙、墨、光、腳印、蓄撲的紅圈、劍弧……），
//   牆、紙屏、人、魄站在上面；牆與紙屏的明暗也照引擎算的「看得見多少」，所以看得見什麼和平面版一模一樣。
//   立起來的字（噬、嗅、凝、飄出來的字）與結霜、被咬一閃畫在上面一層透明畫布（RENDER.overlayFrame）。
// three.js r128（cdnjs 的全域版 THREE）。載不到或瀏覽器不能 3D，就用 2D。
// 座標：引擎的 (x, y) 是 three 的 (x, 高度, y)；一格一單位。
(function (root) {
  const R = root.R, MAP = root.MAP, T = MAP.T;
  const FONT = '"LXGW WenKai TC", "Kaiti TC", "BiauKai", "DFKai-SB", "Noto Serif TC", serif';
  const WALL_H = 1.5, SCREEN_H = 1.3, LANTERN_Y = 1.0;
  const FS = 32;   // 立體版地板：一格幾像素
  const RM = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let THREE, renderer, scene, camera, cv, fxCv = null, g = null, t = 0, mode = 'attract';
  let lantern, lanternLight, lanternGlow, candles = [], poSprites = [], screens = [], doors = null, motes, moteData = [];
  let sealTex = null, sealPanels = [];   // 封戶：廊口立起來的一張大符紙（引擎裡封住的廊口擋住整格）
  let walls = [], wallMesh = null, altars3 = [], wellMats = [], lureSprites = [], shotSprites = [], player = null, floorCv = null, floorTex = null, shadowPlane = null, flameTex = null, fireGlyph = null;
  let cam = null;   // 開始畫面的鏡頭：位置、看的點、朝向（平滑跟著燈）
  const view = { yaw: -Math.PI / 2, x: 0, y: 0, z: 0, lx: 0, lz: 0, ready: false };   // 立體版的鏡頭：yaw 是人的背後朝哪個方向看
  // 畫質：0 全開（燈投影子）、1 關影子降解析度、2 太慢就回 2D（ui 看 failed）。
  // keep：不自動降（玩家按了「立體」，或網址 ?keep3d=1）。
  const perf = { q: 0, ft: [], sum: 0, last: 0, warm: 0, slow: 0, slowSum: 0, fps: 0, failed: false, keep: /[?&]keep3d=1/.test(root.location ? location.search : '') };
  const CAM = { back: 4.8, up: 7.0, ahead: 1.6 };          // 開始畫面
  const PCAM = { back: 4.3, up: 4.4, ahead: 2.6, fov: 55 }; // 立體版：人的背後、高過牆頭，往前多看一點（人在畫面下方三分之一）
  const FCAM = { eye: 1.05, pitch: -0.16, fov: 72 };       // 第一人稱（2026-11-24 試玩）：眼睛的高度，微微往下看，看得到腳前的地
  let camMode = 'behind', viewLamp = null, viewSword = null, swingT = 9, offscreen = 0;

  // 能不能跑 3D：只試一次（每試一次就多開一個 WebGL，開太多瀏覽器會把舊的關掉），試完就放掉
  let okCache = null;
  function ok() {
    if (!root.THREE) return false;
    if (okCache !== null) return okCache;
    try {
      const c = document.createElement('canvas'), gl = c.getContext('webgl') || c.getContext('experimental-webgl');
      okCache = !!gl;
      const lose = gl && gl.getExtension('WEBGL_lose_context'); if (lose) lose.loseContext();
    } catch (e) { okCache = false; }
    return okCache;
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
  let texs = [];   // 這一座宅子用到的貼圖；重蓋時一起放掉
  function tex(canvas) { const t2 = new THREE.CanvasTexture(canvas); t2.encoding = THREE.sRGBEncoding; t2.anisotropy = 4; texs.push(t2); return t2; }
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
  // 牆的側面：墨色灰牆，刷痕；牆腳木踢腳、牆頭一道樑
  function plasterCanvas() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 192;
    const x = c.getContext('2d');
    x.fillStyle = '#3d352d'; x.fillRect(0, 0, 128, 192);
    for (let k = 0; k < 90; k++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '20,16,12' : '90,80,68'},${0.05 + Math.random() * 0.08})`; x.fillRect(Math.random() * 128, Math.random() * 170, 2 + Math.random() * 10, 10 + Math.random() * 50); }
    x.fillStyle = '#24190f'; x.fillRect(0, 168, 128, 24);   // 踢腳
    x.fillStyle = 'rgba(120,90,60,.25)'; x.fillRect(0, 168, 128, 2);
    x.fillStyle = '#2a1f15'; x.fillRect(0, 0, 128, 12);     // 樑
    return c;
  }
  // 牆頂：一排排的瓦
  function roofCanvas() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#26272b'; x.fillRect(0, 0, 128, 128);
    for (let row = 0; row < 8; row++) for (let k = 0; k < 4; k++) {
      const cx = k * 32 + (row % 2) * 16 + 16, cy = row * 16 + 12;
      const gr = x.createLinearGradient(cx - 14, 0, cx + 14, 0);
      gr.addColorStop(0, '#1c1d21'); gr.addColorStop(0.5, '#43454c'); gr.addColorStop(1, '#1c1d21');
      x.fillStyle = gr; x.beginPath(); x.ellipse(cx, cy, 14, 9, 0, Math.PI, 0); x.lineTo(cx + 14, cy + 4); x.lineTo(cx - 14, cy + 4); x.closePath(); x.fill();
    }
    return c;
  }
  // 井欄的石頭
  function stoneCanvas() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 64;
    const x = c.getContext('2d');
    x.fillStyle = '#4a453e'; x.fillRect(0, 0, 128, 64);
    x.strokeStyle = 'rgba(20,18,15,.6)'; x.lineWidth = 2;
    for (let row = 0; row < 2; row++) for (let k = 0; k < 4; k++) { x.strokeRect(k * 32 + (row % 2) * 16 - 16, row * 32 + 1, 32, 31); }
    for (let k = 0; k < 60; k++) { x.fillStyle = `rgba(${Math.random() < 0.5 ? '20,18,15' : '110,104,94'},.15)`; x.fillRect(Math.random() * 128, Math.random() * 64, 2 + Math.random() * 4, 2 + Math.random() * 3); }
    return c;
  }
  function skyCanvas() {
    const c = document.createElement('canvas'); c.width = 4; c.height = 256;
    const x = c.getContext('2d'), gr = x.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#1b2030'); gr.addColorStop(0.45, '#11131a'); gr.addColorStop(0.7, '#0b0a09'); gr.addColorStop(1, '#0b0a09');
    x.fillStyle = gr; x.fillRect(0, 0, 4, 256);
    return c;
  }
  // 封戶：一張寫著「封」的大符紙
  function sealCanvas() {
    const c = document.createElement('canvas'); c.width = 128; c.height = 160;
    const x = c.getContext('2d');
    x.fillStyle = '#f0deb0'; x.fillRect(0, 0, 128, 160);
    x.strokeStyle = '#b4392a'; x.lineWidth = 6; x.strokeRect(6, 6, 116, 148);
    x.fillStyle = '#b4392a'; x.font = `96px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('封', 64, 84);
    return c;
  }
  function radial(color) {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, color.replace('A', 1)); gr.addColorStop(1, color.replace('A', 0));
    x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    return c;
  }

  function init(canvas, overlay) {
    THREE = root.THREE; cv = canvas; fxCv = overlay || null;
    renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
    renderer.setPixelRatio(Math.min(1.5, root.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;   // 亮處不死白、暗處留層次（地板那一層不套，平面版的樣子照舊）
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 90);
    resize();
  }
  function resize() {
    if (!renderer) return;
    const w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // 開始畫面：選單在左時，把燈放在右半邊；窄螢幕選單在下面，把燈放在上面五分之一（和 2D 的開始畫面一樣）
    if (mode === 'play') camera.clearViewOffset();
    else if (w > 980) camera.setViewOffset(w, h, -w * 0.18, 0, w, h); else camera.setViewOffset(w, h, 0, h * 0.29, w, h);
    camera.updateProjectionMatrix();
    if (fxCv) { const d = Math.min(2, root.devicePixelRatio || 1); fxCv.width = Math.round(w * d); fxCv.height = Math.round(h * d); }
  }

  // ---------- 照地圖蓋宅子 ----------
  // 放掉舊宅子的形狀、材質、貼圖、影子圖（回主頁、換成立體時會再蓋一座，不放掉會一直佔著顯示記憶體）
  function drop(s) {
    const mats = new Set();
    s.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach((mt) => mats.add(mt));
      if (o.shadow && o.shadow.map) { o.shadow.map.dispose(); o.shadow.map = null; }
    });
    mats.forEach((mt) => mt.dispose());
    texs.forEach((t2) => t2.dispose()); texs = [];
  }
  function setGame(game, md) {
    if (scene) drop(scene);
    restartPerf();   // 前一陣子 3D 沒有在畫：幀率從頭量
    g = game; mode = md === 'play' ? 'play' : 'attract';
    candles = []; poSprites = []; screens = []; doors = null; cam = null; walls = []; altars3 = []; wellMats = []; lureSprites = []; shotSprites = []; player = null; shadowPlane = null;
    fx3 = []; parts = []; flashLight = null; kit = null;   // 劍鈴符的立體效果：舊的跟著舊宅子一起放掉
    sealPanels = []; sealTex = null;
    view.ready = false; view.yaw = g.p.aim;
    while (camera.children.length) camera.remove(camera.children[0]);   // 第一人稱拿在手上的燈與劍：重蓋時拿掉舊的
    if (camera.parent) camera.parent.remove(camera);   // 鏡頭還掛在舊宅子上的話拿下來，不然新宅子裡它不會跟著動
    viewLamp = null; viewSword = null; swingT = 9;
    const play = mode === 'play', m = g.m, W = m.W, H = m.H;
    lensFor(); resize();
    scene = new THREE.Scene();
    scene.background = tex(skyCanvas());   // 牆頭上面是夜空：上面一點點靛青，往下沉到墨色
    scene.fog = new THREE.FogExp2(0x0b0a09, play ? 0.03 : 0.065);
    scene.add(new THREE.AmbientLight(play ? 0xc8c0b0 : 0x1c2232, play ? 0.75 : 0.3));
    // 地板。開始畫面：2D 的宣紙底圖，照燈光亮。立體版：每一幀由 2D 畫地上那一層（墨、光、腳印、紅圈……），不再受燈光影響
    if (play) {
      floorCv = document.createElement('canvas'); floorCv.width = W * FS; floorCv.height = H * FS;
      floorTex = tex(floorCv);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ map: floorTex, toneMapped: false }));
      floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, H / 2);
      scene.add(floor);
      // 手燈讓牆投在地上的影子（關影子那一級就不畫）
      shadowPlane = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.ShadowMaterial({ opacity: 0.4 }));
      shadowPlane.rotation.x = -Math.PI / 2; shadowPlane.position.set(W / 2, 0.004, H / 2); shadowPlane.receiveShadow = true;
      scene.add(shadowPlane);
    } else {
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex(root.RENDER.floorCanvas(m)), roughness: 0.96, metalness: 0 }));
      floor.rotation.x = -Math.PI / 2; floor.position.set(W / 2, 0, H / 2); floor.receiveShadow = true;
      scene.add(floor);
    }
    // ---- 2026-11-24 擁有者：「三維模式下能不能優化一下整體美術和撞擊空間盒子」 ----
    // 立起來的東西照引擎擋住的範圍蓋：紙屏擋整格就蓋成整格厚的紙屏、井欄是 2×2 的方井、印臺與燭臺是實心的矮家具、
    // 大門貼著門裡那一面。看到撞得到的地方，就是撞得到的地方。
    // 牆：墨色的灰牆，牆腳一道木踢腳、牆頭一道樑；牆頂鋪瓦。深淺照引擎的「看得見」（instanceColor 乘在貼圖上）
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m.at(x, y) === T.WALL) walls.push({ x, y, i: y * W + x, k: 0.82 + Math.random() * 0.26 });
    const wallSide = new THREE.MeshStandardMaterial({ map: tex(plasterCanvas()), roughness: 0.93 }), wallTop = new THREE.MeshStandardMaterial({ map: tex(roofCanvas()), roughness: 0.8 });
    wallMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, WALL_H, 1), [wallSide, wallSide, wallTop, wallSide, wallSide, wallSide], walls.length);
    const o = new THREE.Object3D(), col = new THREE.Color();
    walls.forEach((q, i) => { o.position.set(q.x + 0.5, WALL_H / 2, q.y + 0.5); o.updateMatrix(); wallMesh.setMatrixAt(i, o.matrix); wallMesh.setColorAt(i, col.setRGB(q.k, q.k * 0.97, q.k * 0.93)); });
    wallMesh.castShadow = true; wallMesh.receiveShadow = true;
    scene.add(wallMesh);
    // 紙屏：引擎裡紙屏擋住整格，所以蓋成 0.8 格厚的紙屏（兩面糊紙、木頭的頂與邊；平面版也畫 0.76 格寬）。
    // 被哪一邊的光照到都會亮（亮度照引擎的光），後面的魄看得到影子
    const lat = tex(latticeCanvas()), SCR_T = 0.8;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (m.at(x, y) !== T.SCREEN) continue;
      const horiz = m.at(x - 1, y) === T.SCREEN || m.at(x + 1, y) === T.SCREEN || !(m.at(x, y - 1) === T.SCREEN || m.at(x, y + 1) === T.SCREEN);
      const paper = new THREE.MeshStandardMaterial({ map: lat, transparent: true, opacity: 0.88, side: THREE.DoubleSide, roughness: 1, emissive: new THREE.Color(0xffb565), emissiveMap: lat, emissiveIntensity: 0 });
      const wood = new THREE.MeshStandardMaterial({ color: 0x4a2f1c, roughness: 0.8 });
      const mats = horiz ? [wood, wood, wood, wood, paper, paper] : [paper, paper, wood, wood, wood, wood];
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 1 : SCR_T, SCREEN_H, horiz ? SCR_T : 1), mats);
      mesh.position.set(x + 0.5, SCREEN_H / 2, y + 0.5); mesh.receiveShadow = true; mesh.castShadow = true;
      scene.add(mesh); screens.push({ mesh, paper, wood, i: y * W + x });
    }
    // 井：引擎裡井欄是 2×2 的一塊，所以蓋成方井：石井欄圍一圈、裡面黑水，上面一個木頭的「井」字架
    const wl = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (m.at(x, y) === T.LOW) wl.push([x, y]);
    if (wl.length) {
      const x0 = Math.min(...wl.map((q) => q[0])), x1 = Math.max(...wl.map((q) => q[0])) + 1, z0 = Math.min(...wl.map((q) => q[1])), z1 = Math.max(...wl.map((q) => q[1])) + 1;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, wx = x1 - x0, wz = z1 - z0, th = 0.2, hh = 0.45;
      const stone = new THREE.MeshStandardMaterial({ map: tex(stoneCanvas()), roughness: 0.95 }), beam = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.85 });
      const box = (w, h, d, x, y, z, mt) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mt); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; scene.add(b); return b; };
      box(wx, hh, th, cx, hh / 2, z0 + th / 2, stone); box(wx, hh, th, cx, hh / 2, z1 - th / 2, stone);
      box(th, hh, wz - th * 2, x0 + th / 2, hh / 2, cz, stone); box(th, hh, wz - th * 2, x1 - th / 2, hh / 2, cz, stone);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(wx - th * 2, wz - th * 2), new THREE.MeshBasicMaterial({ color: 0x050607 }));
      water.rotation.x = -Math.PI / 2; water.position.set(cx, 0.2, cz); scene.add(water);
      for (const f of [-0.28, 0.28]) { box(wx + 0.3, 0.07, 0.09, cx, hh + 0.04, cz + f * wz / 2 * 1.4, beam); box(0.09, 0.07, wz + 0.3, cx + f * wx / 2 * 1.4, hh + 0.1, cz, beam); }
      const wi = Math.floor(cz) * W + Math.floor(cx);
      wellMats = [{ mat: stone, base: new THREE.Color(0xffffff), i: wi }, { mat: beam, base: new THREE.Color(0x5a3a22), i: wi }];
    }
    // 燭：放在一張矮燭臺上（引擎裡燭臺擋住那一格）；一根蠟燭、一朵火；開始畫面還有一盞會跳的光（立體版的燭光已經畫在地板上）
    flameTex = tex(radial('rgba(255,190,90,A)'));
    const STAND_H = 0.32;
    for (const c of m.candles) {
      const standM = new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.85 });
      const stand = new THREE.Mesh(new THREE.BoxGeometry(0.7, STAND_H, 0.7), standM);
      stand.position.set(c.x, STAND_H / 2, c.y); stand.castShadow = true; stand.receiveShadow = true; scene.add(stand);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.38, 10), new THREE.MeshStandardMaterial({ color: 0xefe6d2, roughness: 0.8, emissive: 0x3a2a10, emissiveIntensity: 0.4 }));
      stick.position.set(c.x, STAND_H + 0.19, c.y); scene.add(stick);
      const flame = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: 0xffc070, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      flame.position.set(c.x, STAND_H + 0.47, c.y); flame.scale.set(0.32, 0.42, 1); scene.add(flame);
      let light = null;
      if (!play) { light = new THREE.PointLight(0xffa04a, 1.0, 5.0, 2); light.position.set(c.x, STAND_H + 0.6, c.y); scene.add(light); }
      candles.push({ c, stick, stand, standM, flame, light, ph: Math.random() * 6 });
    }
    // 印臺：一張鋪紅布的供桌（引擎裡擋住那一格）；取走了印就不見
    for (const a of g.altars) {
      const tableM = new THREE.MeshStandardMaterial({ color: 0x3b2a1e, roughness: 0.85 }), clothM = new THREE.MeshStandardMaterial({ color: 0x8a2a1e, roughness: 0.9 });
      const table = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.55, 0.8), tableM);
      table.position.set(a.x, 0.275, a.y); table.castShadow = true; table.receiveShadow = true; scene.add(table);
      const cloth = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.03, 0.44), clothM);
      cloth.position.set(a.x, 0.565, a.y); scene.add(cloth);
      const sealMs = [0, 0, 1, 0, 0, 0].map((k) => new THREE.MeshStandardMaterial(k ? { map: tex(glyphCanvas(a.glyph, 128, '#f6ecd8', { bg: '#b4392a' })), roughness: 0.6 } : { color: 0xb4392a, roughness: 0.6 }));
      const seal = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, 0.42), sealMs);
      seal.position.set(a.x, 0.65, a.y); seal.castShadow = true; scene.add(seal);
      altars3.push({ a, table, seal, mats: [{ mat: tableM, base: new THREE.Color(0x3b2a1e) }, { mat: clothM, base: new THREE.Color(0x8a2a1e) }].concat(sealMs.map((mt) => ({ mat: mt, base: mt.color.clone() }))), i: Math.floor(a.y) * W + Math.floor(a.x) });
    }
    // 大門：兩扇門板貼著門裡那一面（引擎裡關著的大門擋住整格），繞著門軸往外開，裡面那一面寫「門」
    if (m.exits.length) {
      const ex = m.exits, x0 = ex[0].x, x1 = ex[ex.length - 1].x + 1, z = ex[0].y + 0.07, dw = (x1 - x0) / 2;
      const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a2618, roughness: 0.8 });
      const mk = (hx, off) => { const pv = new THREE.Group(); pv.position.set(hx, 0, z); const d = new THREE.Mesh(new THREE.BoxGeometry(dw, WALL_H * 0.95, 0.14), doorMat); d.position.set(off, WALL_H * 0.475, 0); d.castShadow = true; pv.add(d); scene.add(pv); return pv; };
      const left = mk(x0, dw / 2), right = mk(x1, -dw / 2);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshStandardMaterial({ map: tex(glyphCanvas('門', 128, '#e8d9b8')), transparent: true, roughness: 0.9 }));
      sign.position.set((x0 + x1) / 2, WALL_H * 0.55, z - 0.08); sign.rotation.y = Math.PI; scene.add(sign);
      doors = { left, right, sign, mat: doorMat, open: 0, idx: ex.map((e) => e.y * W + e.x) };
    }
    sealTex = tex(sealCanvas());
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
    // 光裡的灰塵
    const geo = new THREE.BufferGeometry(), pos = new Float32Array(60 * 3);
    moteData = [];
    for (let k = 0; k < 60; k++) moteData.push({ ox: (Math.random() - 0.5) * 6, oy: Math.random() * 1.6, oz: (Math.random() - 0.5) * 6, ph: Math.random() * 6 });
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    motes = new THREE.Points(geo, new THREE.PointsMaterial({ map: flameTex, color: 0xffe2b0, size: play ? 0.05 : 0.06, transparent: true, opacity: play ? 0.5 : 0.65, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(motes);
    if (play) buildPlayer(); else buildLantern();
  }

  // 開始畫面那盞燈：圓的紙燈籠，幾道竹骨、上下木蓋、提把，正面一個「燈」；會投影子的光
  function lanternModel(scale) {
    const grp = new THREE.Group();
    const shade = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), new THREE.MeshStandardMaterial({ color: 0xffe6b8, emissive: 0xffa848, emissiveIntensity: 1.25, roughness: 0.7 }));
    shade.scale.set(1, 1.22, 1);
    const ribMat = new THREE.MeshStandardMaterial({ color: 0x6a3e1c, roughness: 0.8, emissive: 0x2a1406, emissiveIntensity: 0.6 });
    for (const yy of [-0.12, -0.04, 0.04, 0.12]) { const r = 0.17 * Math.sqrt(1 - Math.pow(yy / (0.17 * 1.22), 2)); const rib = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 6, 28), ribMat); rib.rotation.x = Math.PI / 2; rib.position.y = yy; grp.add(rib); }
    const capMat = new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.7 });
    const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.05, 14), capMat), capB = capT.clone();
    capT.position.y = 0.215; capB.position.y = -0.215;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.32, 6), capMat); handle.position.y = 0.39;
    const word = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(glyphCanvas('燈', 128, '#8a3a12')), transparent: true, depthTest: false, opacity: 0.85 }));
    word.scale.set(0.17, 0.17, 1); word.renderOrder = 2;
    grp.add(shade, capT, capB, handle, word);
    const glowS = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
    glowS.scale.set(1.2, 1.2, 1); grp.add(glowS);
    grp.scale.setScalar(scale || 1);
    return { grp, shade, glow: glowS, word, handle };
  }
  function lampLight(power, dist) {
    const l = new THREE.PointLight(0xffc27a, power, dist, 1.6);
    l.castShadow = perf.q === 0; l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.004; l.shadow.camera.near = 0.1; l.shadow.camera.far = 9;
    return l;
  }
  function buildLantern() {
    const L = lanternModel(1);
    lantern = L.grp; lanternGlow = L.glow;
    lanternLight = lampLight(1.9, 8.5);
    lantern.add(lanternLight);
    scene.add(lantern);
  }
  // 立體版的人：墨色長衫、紙色的臉、斗笠，右手提一盞小燈籠（點著時發光、投影子；掩著時是暗的）
  function buildPlayer() {
    const grp = new THREE.Group();
    const robeM = new THREE.MeshStandardMaterial({ color: 0x1e1b18, roughness: 1, emissive: 0x0e0c0a, emissiveIntensity: 1 });
    const robe = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.9, 20), robeM); robe.position.y = 0.45;
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.08, 16), new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.9 })); collar.position.y = 0.88;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 14), new THREE.MeshStandardMaterial({ color: 0xefe3c8, roughness: 0.85, emissive: 0x2a2418, emissiveIntensity: 0.5 })); head.position.y = 1.0;
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.14, 24), new THREE.MeshStandardMaterial({ color: 0x5a4630, roughness: 0.95 })); hat.position.y = 1.13;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.42, 8), robeM); arm.position.set(0.04, 0.72, 0.24); arm.rotation.x = -0.5;
    grp.add(robe, collar, head, hat, arm);
    const L = lanternModel(0.62);   // 手燈：提在右手前方
    L.grp.position.set(0.16, 0.55, 0.34);
    grp.add(L.grp);
    const light = lampLight(1.5, 7.5);   // 燈光放在場景裡，每一幀照手燈在哪裡擺（第一人稱時人不畫，光照樣要有）
    scene.add(grp, light);
    lanternLight = light; lanternGlow = L.glow; lantern = null;
    player = { grp, lamp: L, light, robe };
    // 第一人稱：右手提的燈在畫面右下，左手的桃木劍揮的時候才掃過畫面
    const VL = lanternModel(0.3);
    VL.handle.visible = false;   // 提把在畫面外，不畫
    VL.grp.position.set(0.3, -0.27, -0.6);
    viewLamp = VL;
    const sw = swordModel(); sw.visible = false;
    viewSword = sw;
    camera.add(VL.grp, sw);
    buildKit();
    scene.add(camera);
    // 借火的火、飛出去的火符：立起來的一團火（字在地板那層也有光）
    fireGlyph = tex(glyphCanvas('火', 128, '#c8461f', { glow: 'rgba(255,150,60,.95)' }));
  }
  // 桃木劍：劍身沿著 -z（第一人稱拿在手上；人的背後那種會轉成朝外）
  function swordModel() {
    const sw = new THREE.Group(), wood = new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.8, emissive: 0x2a1406, emissiveIntensity: 0.6 });
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.012, 0.62), wood); blade.position.z = -0.31;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 4), wood); tip.rotation.x = -Math.PI / 2; tip.position.z = -0.65;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.02, 0.025), new THREE.MeshStandardMaterial({ color: 0x3a2412, roughness: 0.7 })); guard.position.z = -0.01;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.14, 8), new THREE.MeshStandardMaterial({ color: 0xb4392a, roughness: 0.8 })); grip.rotation.x = Math.PI / 2; grip.position.z = 0.07;
    sw.add(blade, tip, guard, grip);
    return sw;
  }

  // ---------- 劍、鈴、符的立體效果（2026-11-24，擁有者：「劍鈴符能不能做出3d效果？」） ----------
  // 只在立體版（人的背後、第一人稱）有；平面版不變。地板那一層原本的劍弧、鈴圈、火光照舊畫在地上，
  // 這裡再加立起來的：揮劍的光弧與手上的劍、打中的火星；鈴的銅鈴、往外擴的金圈與一層薄光；
  // 飛出去的黃紙符（邊轉邊拖火）、炸開的火球、往外噴的火、往上飄的火星與照亮四周的一閃。
  // 規則一點都沒動：這些只看引擎送出的事件（swing、swordHit、bell、fireBoom）與 g.shots、g.lures。
  let fx3 = [], parts = [], flashLight = null, kit = null;
  function buildKit() {
    kit = {
      torus: new THREE.TorusGeometry(1, 0.03, 6, 56),
      sphere: new THREE.SphereGeometry(1, 24, 16),
      talisman: tex(talismanCanvas()),
      bellGeo: new THREE.LatheGeometry([[0, 0.2], [0.05, 0.19], [0.09, 0.14], [0.11, 0.04], [0.13, -0.04], [0.17, -0.1], [0.16, -0.12]].map(([x, y]) => new THREE.Vector2(x, y)), 24),
      bellMat: new THREE.MeshStandardMaterial({ color: 0xb48a3a, metalness: 0.6, roughness: 0.35, emissive: 0x3a2a08, emissiveIntensity: 0.5, side: THREE.DoubleSide }),
      talGeo: new THREE.PlaneGeometry(0.2, 0.44)
    };
    flashLight = new THREE.PointLight(0xff8a3a, 0, 6.5, 2);   // 火符炸開時照亮四周的一閃（燈一直在，只改亮度，免得換燈數讓畫面卡一下）
    scene.add(flashLight);
  }
  function talismanCanvas() {
    const c = document.createElement('canvas'); c.width = 64; c.height = 144;
    const x = c.getContext('2d');
    x.fillStyle = '#e8c860'; x.fillRect(0, 0, 64, 144);
    x.strokeStyle = '#b4392a'; x.lineWidth = 4; x.strokeRect(5, 5, 54, 134);
    x.fillStyle = '#b4392a'; x.font = `48px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('火', 32, 50); x.font = `26px ${FONT}`; x.fillText('符', 32, 104);
    return c;
  }
  // add：發光的（疊加）；不然是一般的透明，在亮的紙地上也看得出顏色
  const addMat = (color, opacity, plain) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, blending: plain ? THREE.NormalBlending : THREE.AdditiveBlending, side: THREE.DoubleSide });
  // 一個效果：物件、壽命、每一幀怎麼變；時間到就拿掉並放掉自己的形狀與材質（共用的不放）
  function addFx(obj, life, step, own, parent) {
    (parent || scene).add(obj);
    fx3.push({ obj, life, t: 0, step, own: own || [], parent: parent || scene });
  }
  function stepFx(dt) {
    fx3 = fx3.filter((f) => {
      f.t += dt;
      const q = Math.min(1, f.t / f.life);
      f.step(f.obj, q, f.t);
      if (q < 1) return true;
      f.parent.remove(f.obj);
      for (const o of f.own) o.dispose();
      return false;
    });
  }
  // 火星、火焰：一群小光點，照速度飛、慢慢變小變淡（最多 140 顆，用完的重複用）
  function burst(x, y, z, n, o) {
    n = RM ? Math.ceil(n / 2) : n;
    for (let k = 0; k < n; k++) {
      let s = parts.find((q) => !q.alive);
      if (!s) { if (parts.length >= 140) return; s = { sp: new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })) }; scene.add(s.sp); parts.push(s); }
      const a = Math.random() * Math.PI * 2, sp = o.speed * (0.5 + Math.random() * 0.7), up = o.up * (0.6 + Math.random() * 0.8);
      Object.assign(s, { alive: true, t: 0, life: o.life * (0.7 + Math.random() * 0.6), x, y, z, vx: Math.cos(a) * sp, vy: up, vz: Math.sin(a) * sp, s0: o.size, s1: o.size * (o.shrink == null ? 0.2 : o.shrink), g: o.grav || 0 });
      s.sp.material.color.setHex(o.color); s.sp.visible = true;
    }
  }
  function stepParts(dt) {
    for (const s of parts) {
      if (!s.alive) continue;
      s.t += dt;
      const q = s.t / s.life;
      if (q >= 1) { s.alive = false; s.sp.visible = false; continue; }
      s.vy -= s.g * dt; s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt;
      s.sp.position.set(s.x, s.y, s.z);
      const sz = s.s0 + (s.s1 - s.s0) * q;
      s.sp.scale.set(sz, sz, 1); s.sp.material.opacity = 1 - q;
    }
  }
  // 引擎的事件（ui 在立體版時轉過來）
  function event(e) {
    if (mode !== 'play' || !scene || !kit) return;
    const fp = camMode === 'first';
    if (e.type === 'swing') {
      if (fp) swingT = 0;   // 第一人稱：手上的劍掃過畫面
      slash(e.x, e.y, e.dir, fp);
    } else if (e.type === 'swordHit') {
      burst(e.x, 0.75, e.y, 12, { color: 0xfff0d0, speed: 2.2, up: 0.8, life: 0.35, size: 0.14, grav: 3 });
      burst(e.x, 0.75, e.y, 6, { color: 0x3a3a44, speed: 1.2, up: 0.4, life: 0.5, size: 0.22, shrink: 1.4 });   // 魄被打出來的墨
    } else if (e.type === 'bell') ring(e.x, e.y, fp);
    else if (e.type === 'fireBoom') boom3(e.x, e.y);
  }
  // 揮劍：一道淡淡的光弧從右往左掃過（腰的高度）；人的背後那種還看得到手上那把劍跟著掃
  function slash(x, y, dir, fp) {
    const half = 1.1, r0 = R.SWORD.reach * 0.62, r1 = R.SWORD.reach * 0.95;   // 細細的一彎
    const geo = new THREE.RingGeometry(r0, r1, 28, 1, -(dir + half), half * 2), mat = addMat(0xffe2b0, 0.5);
    const arc = new THREE.Mesh(geo, mat);
    arc.rotation.x = -Math.PI / 2 + 0.18; arc.position.set(x, 0.78, y);
    const total = geo.index.count;
    geo.setDrawRange(0, 0);
    addFx(arc, 0.34, (o, q) => { const r = Math.min(1, q / 0.4); geo.setDrawRange(0, Math.ceil(total * r / 6) * 6); mat.opacity = 0.5 * (q < 0.4 ? 1 : 1 - (q - 0.4) / 0.6); }, [geo, mat]);
    if (fp) return;
    const pivot = new THREE.Group(), sw = swordModel();
    sw.rotation.y = -Math.PI / 2; sw.position.set(0.12, 0, 0);   // 劍身朝外（沿 +x）
    pivot.add(sw); pivot.position.set(x, 0.74, y);
    const own = []; sw.traverse((o) => { if (o.geometry) own.push(o.geometry); if (o.material) own.push(o.material); });
    addFx(pivot, 0.3, (o, q) => { const r = Math.min(1, q / 0.55); o.rotation.y = -(dir + half - r * half * 2); o.rotation.z = 0.15; o.visible = q < 0.9; }, own);
  }
  // 鈴：一口銅鈴搖起來；三道金圈與一層薄光往外擴到震得開的距離
  function ring(x, y, fp) {
    const bell = new THREE.Group(), cup = new THREE.Mesh(kit.bellGeo, kit.bellMat), clap = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), kit.bellMat);
    clap.position.y = -0.12; bell.add(cup, clap);
    const own = [clap.geometry];
    if (fp) { bell.position.set(-0.3, -0.2, -0.75); bell.scale.setScalar(0.42); }   // 第一人稱：左手搖的鈴，在畫面左下
    else bell.position.set(x, 1.55, y);
    addFx(bell, 0.7, (o, q, tt) => { o.rotation.z = Math.sin(tt * 32) * 0.55 * (1 - q); o.visible = q < 0.95; }, own, fp ? camera : scene);
    const R0 = R.BELL.r;
    [0.55, 0.85, 1.15].forEach((h, k) => {
      const mat = addMat(0xd9a030, 0.9, true), tor = new THREE.Mesh(kit.torus, mat);
      tor.rotation.x = Math.PI / 2; tor.position.set(x, h, y); tor.scale.setScalar(0.3);
      addFx(tor, 0.55 + k * 0.06, (o, q) => { const r = Math.max(0, (q * (0.55 + k * 0.06) - k * 0.06) / 0.55); o.scale.setScalar(0.3 + (R0 - 0.3) * Math.min(1, r * 1.2)); mat.opacity = 0.9 * (1 - r); }, [mat]);
    });
    const smat = addMat(0xd9a030, 0.12, true), shell = new THREE.Mesh(kit.sphere, smat);
    shell.position.set(x, 0.6, y); shell.scale.setScalar(0.3);
    addFx(shell, 0.45, (o, q) => { o.scale.setScalar(0.3 + (R0 - 0.3) * q); smat.opacity = 0.12 * (1 - q); }, [smat]);
    burst(x, 1.0, y, 10, { color: 0xffe09a, speed: 1.6, up: 0.6, life: 0.6, size: 0.1 });
  }
  // 火符炸開：火球、往外噴的火、往上飄的火星，還有照亮四周的一閃
  function boom3(x, y) {
    const R0 = R.FIRE.boom;
    const omat = addMat(0xe0581c, 0.6, true), ball = new THREE.Mesh(kit.sphere, omat);   // 外層橘紅的火
    ball.position.set(x, 0.65, y); ball.scale.setScalar(0.2);
    addFx(ball, 0.5, (o, q) => { o.scale.setScalar(0.2 + (R0 * 0.85 - 0.2) * Math.min(1, q / 0.45)); omat.opacity = 0.6 * (1 - q); }, [omat]);
    const cmat = addMat(0xffb040, 0.9), core = new THREE.Mesh(kit.sphere, cmat);   // 裡面發亮的芯
    core.position.set(x, 0.65, y); core.scale.setScalar(0.12);
    addFx(core, 0.32, (o, q) => { o.scale.setScalar(0.12 + 0.35 * q); cmat.opacity = 0.9 * (1 - q); }, [cmat]);
    burst(x, 0.6, y, 22, { color: 0xff6a20, speed: R0 * 2.2, up: 1.3, life: 0.65, size: 0.75, shrink: 0.15 });
    burst(x, 0.5, y, 12, { color: 0xffc060, speed: 0.6, up: 1.6, life: 1.3, size: 0.09, shrink: 0.5, grav: -0.3 });
    flashLight.position.set(x, 0.9, y); flashLight.intensity = 3.5; flashLight.userData.t = 0;
  }
  function spritePool(list, n, make) { while (list.length < n) { const s = make(); scene.add(s); list.push(s); } list.forEach((s, k) => { s.visible = k < n; }); return list; }

  // ---------- 一幀 ----------
  function frame(dt, w) {
    if (!renderer || !g) return;
    if (mode === 'play') framePlay(dt, w || {}); else frameAttract(dt, w || {});
    watchPerf();
  }
  function moteStep(px, py) {
    const arr = motes.geometry.attributes.position.array;
    moteData.forEach((q, k) => {
      const a = q.ph + t * 0.25;
      arr[k * 3] = px + q.ox + Math.cos(a) * 0.4; arr[k * 3 + 1] = 0.2 + ((q.oy + t * 0.05) % 1.6); arr[k * 3 + 2] = py + q.oz + Math.sin(a * 0.8) * 0.4;
    });
    motes.geometry.attributes.position.needsUpdate = true;
  }
  function poStep(lift) {   // 魄：引擎說看得見才畫
    for (const q of poSprites) {
      const e = q.e, vis = e.vis, P = R.PO;
      if (e.state === 'gone') {   // 凝回：看得見那個地方時，慢慢浮出來
        const f = e.formSpot && e.goneT <= P.formT && g.spotVisible(e.formSpot) ? 1 - Math.max(0, e.goneT) / P.formT : 0;
        q.sp.visible = mode === 'play' && f > 0;
        if (q.sp.visible) { q.sp.material.map = q.looks.lit; q.sp.material.opacity = 0.15 + 0.35 * f; q.sp.material.rotation = 0; q.sp.position.set(e.formSpot.x, 0.7 * lift, e.formSpot.y); q.sp.scale.setScalar(0.9); }
        continue;
      }
      if (!vis) { q.sp.visible = false; continue; }
      q.sp.visible = true;
      if (q.sp.material.map !== q.looks[vis.mode]) { q.sp.material.map = q.looks[vis.mode]; q.sp.material.needsUpdate = true; }
      const hpF = mode === 'play' ? 0.5 + 0.5 * Math.max(0.25, e.hp / P.hp) : 1;
      q.sp.material.opacity = vis.mode === 'silhouette' ? 0.85 : Math.min(1, vis.a * (vis.mode === 'dark' ? 1.4 : 1.1)) * hpF;
      const dorm = e.state === 'dormant';
      q.sp.material.rotation = dorm ? -0.5 : 0;
      const wob = RM ? 1 : 1 + 0.05 * Math.sin(t * 3 + e.id);
      const jit = RM ? 0 : e.state === 'windup' ? (Math.random() - 0.5) * 0.05 : e.state === 'stagger' ? (Math.random() - 0.5) * 0.08 : 0;
      q.sp.scale.set((dorm ? 0.8 : 1.0) * wob * lift, (dorm ? 0.8 : 1.0) * wob * lift, 1);
      q.sp.position.set(e.x + jit, dorm ? 0.35 : 0.7 * lift + (RM ? 0 : Math.sin(t * 1.7 + e.id) * 0.05), e.y);
    }
  }
  function frameAttract(dt, w) {
    t += dt;
    const p = g.p, v = g.view(13);
    // 燈：在路線上飄，微微上下
    const bob = RM ? 0 : Math.sin(t * 2.2) * 0.06;
    lantern.position.set(p.x, LANTERN_Y + bob, p.y);
    const fl = RM ? 1 : 0.92 + 0.08 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1);
    lanternLight.intensity = 1.9 * fl; lanternGlow.material.opacity = 0.7 * fl;
    for (const c of candles) { const f = RM ? 1 : 0.85 + 0.15 * Math.sin(t * 11 + c.ph) * Math.sin(t * 7 + c.ph * 2); c.light.intensity = 1.0 * f; c.flame.scale.set(0.3, 0.42 * f, 1); }
    // 紙屏：照引擎算的光發亮（哪一邊照到都算）
    for (const s of screens) s.paper.emissiveIntensity = Math.min(0.9, (v.light[s.i] || 0) * 0.9);
    poStep(1);
    moteStep(p.x, p.y);
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
  }

  // 立體版：w.turn（I、O 轉鏡頭，-1..1）、w.follow（往前走時鏡頭慢慢轉到人走的方向）、w.snap、w.autoAim
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  function framePlay(dt, w) {
    const p = g.p;
    const v = root.RENDER.floorFrame(dt, floorCv, FS, { autoAim: w.autoAim });
    floorTex.needsUpdate = true;
    t += dt;
    const seen = (i) => Math.max(Math.min(1, (v.vis[i] || 0) * 1.3), g.explored[i] ? 0.1 : 0);   // 和 2D 的墨一樣：看不見就黑，走過的留一點
    // 牆
    const col = new THREE.Color();
    walls.forEach((q, k) => { const f = seen(q.i); wallMesh.setColorAt(k, col.setRGB(q.k * f, q.k * 0.96 * f, q.k * 0.9 * f)); });
    wallMesh.instanceColor.needsUpdate = true;
    // 紙屏：看得見才看得到紙，被照到才發亮
    for (const s of screens) { const f = seen(s.i); s.paper.color.setScalar(f); s.wood.color.setHex(0x4a2f1c).multiplyScalar(Math.max(f, 0.03)); s.paper.emissiveIntensity = f > 0.1 ? Math.min(0.9, (v.light[s.i] || 0) * 0.9) : 0; }
    for (const wm of wellMats) wm.mat.color.copy(wm.base).multiplyScalar(seen(wm.i));
    for (const q of altars3) { const f = seen(q.i); q.seal.visible = !q.a.taken; for (const mm of q.mats) mm.mat.color.copy(mm.base).multiplyScalar(Math.max(f, 0.02)); }
    // 燭：火苗直接看得到才畫（隔著紙屏只有地板上那一團暈）
    for (const c of candles) {
      const line = g.sightLine(p.x, p.y, c.c.x, c.c.y), near = Math.hypot(c.c.x - p.x, c.c.y - p.y) < 14, f = RM ? 1 : 0.85 + 0.15 * Math.sin(t * 11 + c.ph) * Math.sin(t * 7 + c.ph * 2);
      c.flame.visible = line === 'clear' && near; c.flame.scale.set(0.3, 0.42 * f, 1);
      const cf = seen(Math.floor(c.c.y) * g.m.W + Math.floor(c.c.x));
      c.stick.visible = line !== 'blocked' && near; c.stick.material.color.setScalar(Math.max(0.15, cf));
      c.standM.color.setHex(0x3b2a1e).multiplyScalar(Math.max(cf, 0.03));
    }
    // 大門：推開門閂後兩扇往外開
    if (doors) {
      doors.open += ((g.exitOpen ? 1 : 0) - doors.open) * (1 - Math.pow(0.05, dt));
      doors.left.rotation.y = -1.3 * doors.open; doors.right.rotation.y = 1.3 * doors.open;
      const f = Math.max(...doors.idx.map((i) => seen(i)), 0.02);
      doors.mat.color.setRGB(0.29 * f, 0.15 * f, 0.094 * f);
    }
    // 封戶：廊口立起一張大符紙擋住整格（和引擎一樣）；快沒了會閃
    const sl = [...g.sealed.values()];
    while (sealPanels.length < sl.length) { const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.96, 1.25), new THREE.MeshStandardMaterial({ map: sealTex, side: THREE.DoubleSide, transparent: true, roughness: 0.9, emissive: 0x3a1a08, emissiveIntensity: 0.35 })); scene.add(mesh); sealPanels.push(mesh); }
    sealPanels.forEach((mesh, k) => {
      const q = sl[k]; mesh.visible = !!q; if (!q) return;
      const across = g.m.at(q.x, q.y - 1) === T.WALL || g.m.at(q.x, q.y - 1) === T.SCREEN;   // 上下是牆：廊口東西向，符紙南北向擋著
      mesh.position.set(q.x + 0.5, 0.66, q.y + 0.5);
      mesh.rotation.set(0, across ? Math.PI / 2 : 0, RM ? 0 : Math.sin(t * 1.7 + k) * 0.02);
      const W0 = g.m.W, f = Math.max(0.06, ...[[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => seen((q.y + dy) * W0 + q.x + dx)));
      mesh.material.color.setScalar(f);
      mesh.material.opacity = q.t < 2 && !RM ? 0.45 + 0.55 * Math.abs(Math.sin(t * 9)) : 1;
    });
    // 借火的火、飛出去的火符
    spritePool(lureSprites, g.lures.length, () => new THREE.Sprite(new THREE.SpriteMaterial({ map: fireGlyph, transparent: true, depthWrite: false })));
    g.lures.forEach((l, k) => {
      const s = lureSprites[k], line = g.sightLine(p.x, p.y, l.x, l.y), fl = RM ? 1 : 0.88 + 0.12 * Math.sin(t * 13 + l.id);
      s.visible = line === 'clear'; s.position.set(l.x, 0.42 + (RM ? 0 : 0.04 * Math.sin(t * 5)), l.y); s.scale.set(0.75 * fl, 0.75 * fl, 1); s.material.opacity = Math.min(1, l.t / 2);
    });
    // 飛出去的火符：一張黃紙符邊轉邊飛，後面拖著火
    spritePool(shotSprites, g.shots.length, () => new THREE.Mesh(kit.talGeo, new THREE.MeshBasicMaterial({ map: kit.talisman, side: THREE.DoubleSide, transparent: true })));
    g.shots.forEach((q, k) => {
      const s = shotSprites[k];
      s.position.set(q.x, 0.7 + (RM ? 0 : Math.sin(t * 20 + k) * 0.03), q.y);
      s.rotation.set(0.25, -q.dir + (RM ? 0 : t * 16), 0);
      if (dt > 0) burst(q.x, 0.7, q.y, 1, { color: 0xff8a30, speed: 0.25, up: 0.5, life: 0.35, size: 0.28, shrink: 0.2 });
    });
    // 借火的火：看得到時，火苗一直往上竄
    if (dt > 0 && !RM) g.lures.forEach((l, k) => { if (lureSprites[k] && lureSprites[k].visible && Math.random() < dt * 14) burst(l.x + (Math.random() - 0.5) * 0.3, 0.25, l.y + (Math.random() - 0.5) * 0.3, 1, { color: 0xff8a30, speed: 0.1, up: 0.9, life: 0.6, size: 0.35, shrink: 0.1 }); });
    stepFx(dt); stepParts(dt);
    if (flashLight && flashLight.intensity > 0) { flashLight.userData.t += dt; flashLight.intensity = Math.max(0, 3.5 * (1 - flashLight.userData.t / 0.5)); }
    poStep(1.1);
    // 人：面向對準的方向；走路時身子微微起伏，手燈晃
    const fp = camMode === 'first';
    const walk = RM ? 0 : p.moving ? Math.abs(Math.sin(t * 9)) * 0.04 : 0;
    player.grp.position.set(p.x, walk, p.y);
    player.grp.rotation.y = -p.aim;
    player.grp.visible = !fp;
    const sw = RM ? 0 : p.moving ? Math.sin(t * 9) * 0.12 : Math.sin(t * 2) * 0.03;
    player.lamp.grp.rotation.x = sw;
    const fl = RM ? 1 : 0.9 + 0.1 * Math.sin(t * 13) * Math.sin(t * 7.3 + 1);
    for (const L of [player.lamp, viewLamp]) {
      L.shade.material.emissiveIntensity = p.lampOn ? 1.25 * fl : 0;
      L.shade.material.color.setHex(p.lampOn ? 0xffe6b8 : 0x4a4038);
      L.glow.visible = p.lampOn; L.glow.material.opacity = 0.55 * fl;
    }
    viewLamp.grp.visible = fp;
    player.light.intensity = p.lampOn ? 1.5 * fl : 0;
    player.light.castShadow = p.lampOn && perf.q === 0;
    if (shadowPlane) shadowPlane.visible = p.lampOn && perf.q === 0;
    moteStep(p.x, p.y); motes.visible = p.lampOn;
    // 鏡頭。I、O 轉（第一人稱還可以用滑鼠轉）。人的背後：在人後上方、高過牆頭，往前走時慢慢轉到人走的方向。
    // 第一人稱：眼睛的高度、看鏡頭朝的方向，走路時微微起伏；人不畫，手燈在畫面右下
    if (w.turn) view.yaw += w.turn * 1.9 * dt;
    if (w.follow != null && !fp) view.yaw += angDiff(w.follow, view.yaw) * (1 - Math.pow(0.4, dt));
    const fx = Math.cos(view.yaw), fz = Math.sin(view.yaw);
    const sh = root.RENDER.shake / 0.3, jit = () => (sh ? (Math.random() - 0.5) * 0.12 * sh : 0);
    if (fp) {
      const bob = RM ? 0 : p.moving ? Math.sin(t * 9) * 0.025 : 0;
      view.x = p.x; view.y = FCAM.eye + bob; view.z = p.y; view.ready = false;   // 換回人的背後時鏡頭重新就位
      camera.position.set(p.x + jit() * 0.4, FCAM.eye + bob + jit() * 0.4, p.y);
      camera.lookAt(p.x + fx, FCAM.eye + bob + Math.tan(FCAM.pitch), p.y + fz);
      viewLamp.grp.position.set(0.3, -0.27 + (RM ? 0 : p.moving ? Math.abs(Math.sin(t * 9)) * 0.015 : 0), -0.6);
      viewLamp.grp.rotation.z = sw * 0.6;
      // 劍：揮的那一下（引擎的 swing 事件，見 event）從右往左掃過畫面；無敵格沒有冷卻也照樣掃
      swingT += dt;
      const q = swingT / 0.28;
      viewSword.visible = q < 1;
      if (q < 1) { viewSword.position.set(0.32 - q * 0.6, -0.22 - Math.sin(q * Math.PI) * 0.05, -0.45); viewSword.rotation.set(-0.15, 0.9 - q * 1.8, -0.4); }
    } else {
      const want = { x: p.x - fx * PCAM.back, y: PCAM.up, z: p.y - fz * PCAM.back, lx: p.x + fx * PCAM.ahead, lz: p.y + fz * PCAM.ahead };
      const k = !view.ready || w.snap ? 1 : 1 - Math.pow(0.002, dt);
      for (const key of ['x', 'y', 'z', 'lx', 'lz']) view[key] += (want[key] - view[key]) * k;
      view.ready = true;
      camera.position.set(view.x + jit(), view.y + jit(), view.z);
      camera.lookAt(view.lx, 0.45, view.lz);
      viewSword.visible = false;
    }
    // 手燈的光：第一人稱在畫面右下那盞燈的位置；人的背後在人右手的燈
    camera.updateMatrixWorld();
    (fp ? viewLamp.grp : player.lamp.grp).getWorldPosition(player.light.position);
    renderer.render(scene, camera);
    if (fxCv) { root.RENDER.overlayFrame(dt, fxCv, proj); if (fp) fpMarks(); else offscreen = 0; }
  }
  // 第一人稱的鏡頭：視角比較寬，近的牆不被切掉
  function lensFor() {
    const fp = mode === 'play' && camMode === 'first';
    camera.fov = mode === 'play' ? (fp ? FCAM.fov : PCAM.fov) : 42;
    camera.near = fp ? 0.05 : 0.1;
  }
  function setCam(m) { camMode = m === 'first' ? 'first' : 'behind'; if (camera) { lensFor(); resize(); } }
  // 橫的半個視角（弧度）：自動對準只對這個角度以內的魄
  function hfov() { return Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect); }
  // 第一人稱的疊層：中間一點準星；看得見（照引擎）但不在畫面裡的魄，在畫面邊上朝它的方向畫記號，
  // 要撲的是紅的「噬」。2D 看得到四周，第一人稱只看得到前面，這些記號補回 2D 本來就給的資訊，不多給。
  function fpMarks() {
    const c = fxCv.getContext('2d'), W = fxCv.width, H = fxCv.height, p = g.p, u = Math.min(W, H) / 100;
    c.save();
    c.fillStyle = 'rgba(236,226,200,.75)'; c.strokeStyle = 'rgba(20,16,12,.7)'; c.lineWidth = u * 0.25;
    c.beginPath(); c.arc(W / 2, H / 2, u * 0.55, 0, Math.PI * 2); c.fill(); c.stroke();
    const hf = hfov();
    offscreen = 0;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (const e of g.pos) {
      if (e.state === 'gone' || !e.vis) continue;
      let rel = Math.atan2(e.y - p.y, e.x - p.x) - view.yaw;
      while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
      if (Math.abs(rel) < hf * 0.92) continue;
      offscreen++;
      const wind = e.state === 'windup' && e.windVisible, pulse = RM ? 1 : 0.75 + 0.25 * Math.sin(t * 12);
      // 畫在一個橢圓上：左右在兩邊，正後方在畫面中間偏下（避開下面一排工具鈕）
      const X = W / 2 + Math.sin(rel) * W * 0.44, Y = H / 2 - Math.cos(rel) * H * 0.27, r = u * (wind ? 4.6 : 3.4);
      c.globalAlpha = wind ? pulse : e.vis.mode === 'silhouette' ? 0.5 : 0.8;
      c.fillStyle = wind ? 'rgba(180,57,42,.92)' : e.vis.mode === 'dark' ? 'rgba(20,40,38,.75)' : 'rgba(236,226,200,.88)';
      c.beginPath(); c.arc(X, Y, r, 0, Math.PI * 2); c.fill();
      c.lineWidth = u * 0.35; c.strokeStyle = wind ? '#f7efe0' : 'rgba(28,26,23,.7)'; c.stroke();
      const a = Math.atan2(Y - H / 2, X - W / 2);   // 往外指的小三角：魄在那個方向
      c.beginPath(); c.moveTo(X + Math.cos(a) * r * 1.55, Y + Math.sin(a) * r * 1.55); c.lineTo(X + Math.cos(a + 0.5) * r * 1.05, Y + Math.sin(a + 0.5) * r * 1.05); c.lineTo(X + Math.cos(a - 0.5) * r * 1.05, Y + Math.sin(a - 0.5) * r * 1.05); c.closePath(); c.fill();
      c.font = `${Math.round(r * 1.25)}px ${FONT}`;
      c.fillStyle = wind ? '#f7efe0' : e.vis.mode === 'dark' ? '#cfeee6' : e.vis.mode === 'silhouette' ? '#3c3630' : '#2e3338';
      c.fillText(wind ? '噬' : '魄', X, Y + r * 0.05);
    }
    c.restore();
  }
  // 世界上 (x, y)、高 h 的點在疊層畫布的哪裡；k 是那裡一格幾像素
  let v3 = null, v3b = null;
  function proj(x, h, y) {
    v3 = v3 || new THREE.Vector3(); v3b = v3b || new THREE.Vector3();
    if (mode === 'play' && camMode === 'first' && g && Math.hypot(x - g.p.x, y - g.p.y) < 0.35) {   // 第一人稱：落在自己身上的字（噬、寒 +、取印）放在畫面中間偏下
      const H = fxCv.height;
      return { X: fxCv.width / 2, Y: H * (0.6 - (h - 1.25) * 0.12), k: H / 9 };
    }
    v3.set(x, h, y).project(camera);
    if (v3.z > 1 || v3.z < -1) return null;
    const W = fxCv.width, H = fxCv.height, d = camera.position.distanceTo(v3b.set(x, h, y));
    return { X: (v3.x + 1) / 2 * W, Y: (1 - v3.y) / 2 * H, k: H / (2 * Math.max(0.5, d) * Math.tan(camera.fov * Math.PI / 360)) };
  }
  // 滑鼠指到的地方（腰的高度）在世界上哪一格：給對準用
  let ray = null, plane = null;
  function toWorld(clientX, clientY) {
    ray = ray || new THREE.Raycaster(); plane = plane || new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.6);
    const r = cv.getBoundingClientRect();
    ray.setFromCamera({ x: ((clientX - r.left) / r.width) * 2 - 1, y: -((clientY - r.top) / r.height) * 2 + 1 }, camera);
    const hit = new THREE.Vector3();
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return { x: hit.x, y: hit.z };
  }

  // 太慢就降：先關影子、降解析度；還是太慢就請 ui 換回 2D，免得一頓一頓的又像剪接。
  // 量法（2026-11-05 改，擁有者在自己的電腦上沒看到 3D）：
  // - 先熱身一秒半不算（載貼圖、編譯著色器時會卡幾幀）；
  // - 視窗在背景、或某一幀超過四分之一秒（卡一下、分頁被暫停），那一幀不算；連續十二幀都這樣，才算真的跑不動；
  // - 收滿兩秒（至少十幀）才判斷一次，看的是中位數，偶爾卡一下不會被當成慢。
  function restartPerf(warm) { perf.ft = []; perf.sum = 0; perf.slow = 0; perf.slowSum = 0; perf.last = 0; perf.warm = warm || 0; }
  function downgrade() {
    if (perf.q === 0) { perf.q = 1; if (lanternLight) lanternLight.castShadow = false; renderer.setPixelRatio(1); resize(); restartPerf(1.0); }
    else { perf.q = 2; perf.failed = true; }
  }
  function watchPerf() {
    const now = performance.now(), d = perf.last ? (now - perf.last) / 1000 : 0;
    perf.last = now;
    if (!d || perf.keep || perf.failed) return;
    if (root.document && document.hidden) return;
    if (perf.warm < 1.5) { perf.warm += Math.min(d, 0.1); return; }
    if (d > 0.25) {
      perf.slow++; perf.slowSum += d;
      if (perf.slow >= 12) { perf.fps = perf.slow / perf.slowSum; downgrade(); }
      return;
    }
    perf.slow = 0; perf.slowSum = 0;
    perf.ft.push(d); perf.sum += d;
    if (perf.ft.length < 10 || (perf.sum < 2 && perf.ft.length < 120)) return;
    const sorted = perf.ft.slice().sort((a, b) => a - b);
    perf.fps = 1 / sorted[sorted.length >> 1];
    perf.ft = []; perf.sum = 0;
    if ((perf.q === 0 && perf.fps < 30) || (perf.q === 1 && perf.fps < 20)) downgrade();
  }
  // 玩家按了「立體」：不再自動降；之前降到回 2D 的，改用關影子的那一級再試
  function force() {
    perf.keep = true;
    if (perf.failed) { perf.failed = false; perf.q = 1; if (lanternLight) lanternLight.castShadow = false; if (renderer) { renderer.setPixelRatio(1); resize(); } }
    restartPerf();
  }
  // 暫停、結束畫面時 3D 不畫新的一幀：回來時幀率從頭量
  function pausePerf() { perf.last = 0; }

  root.RENDER3D = {
    ok, init, setGame, frame, event, resize, force, pausePerf, toWorld, proj: (x, h, y) => proj(x, h, y), turnBy(rad) { view.yaw += rad; }, setCam, hfov,
    get camMode() { return camMode; }, get offscreen() { return offscreen; }, get sealShown() { return sealPanels.filter((q) => q.visible).length; }, get fxCount() { return fx3.length + parts.filter((q) => q.alive).length; }, get flash() { return flashLight ? flashLight.intensity : 0; }, get camPos() { return camera ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : null; },
    get cam() { return cam; }, get view() { return view; }, get yaw() { return view.yaw; }, get mode() { return mode; }, get game() { return g; },
    get quality() { return perf.q; }, get failed() { return perf.failed; }, get fps() { return perf.fps; }, get keep() { return perf.keep; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
