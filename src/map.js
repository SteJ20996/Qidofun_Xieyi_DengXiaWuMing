// 燈下無明 —— 紙宅的地圖與格子走訪。
// 地圖記號：# 牆　= 紙屏　o 井欄（矮，只擋走路）　d 廊口（可封戶）　X 大門（兩印到手才開）
//           S 起點　1 名印　2 息印　c 燭　p 魄（醒著）　q 魄（睡著）　f 火符
(function (root) {
  const ROWS = [
    '########################################',  // 0
    '#........#c..................c#........#',  // 1
    '#........#....................#........#',  // 2
    '#..1.....#.........p..........#.....2..#',  // 3
    '#........d.....#........#.....d........#',  // 4
    '#........#....................#........#',  // 5
    '#......c.#....................#.c......#',  // 6
    '#........#....................#........#',  // 7
    '####d#####====d==========d====#####d####',  // 8
    '#........=....................=........#',  // 9
    '#........=.c..................=........#',  // 10
    '#........=...===..............=........#',  // 11
    '#........=.........oo.........=........#',  // 12
    '#=====...d.........oo.........d...=====#',  // 13
    '#........=....................=........#',  // 14
    '#........=..............===...=........#',  // 15
    '#........=..................c.=........#',  // 16
    '#........=....................=........#',  // 17
    '####d##############d###############d####',  // 18
    '#........#....................#........#',  // 19
    '#........#....................#........#',  // 20
    '#........#....................#........#',  // 21
    '#........d....................d........#',  // 22
    '#........#......========......#........#',  // 23
    '#........#....................#....q...#',  // 24
    '#.f......#.........S..........#........#',  // 25
    '#........#....................#........#',  // 26
    '###################XX###################'   // 27
  ];

  // 格子種類
  const T = { FLOOR: 0, WALL: 1, SCREEN: 2, LOW: 3, DOOR: 4, EXIT: 5 };
  // 房間名（給提示與小地圖用）：[名字, x0, y0, x1, y1]
  const ROOMS = [
    ['書房', 1, 1, 8, 7], ['正廳', 10, 1, 29, 7], ['祠堂', 31, 1, 38, 7],
    ['西廂', 1, 9, 8, 17], ['天井', 10, 9, 29, 17], ['東廂', 31, 9, 38, 17],
    ['雜物間', 1, 19, 8, 26], ['玄關', 10, 19, 29, 26], ['偏房', 31, 19, 38, 26]
  ];

  function parse(rows) {
    rows = rows || ROWS;   // 測試可以給自己的場地
    const H = rows.length, W = rows[0].length;
    for (const r of rows) if (r.length !== W) throw new Error('地圖每列要一樣寬');
    const t = new Uint8Array(W * H);
    const m = { W, H, t, start: null, altars: [], candles: [], po: [], pickups: [], exits: [], doors: [] };
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const ch = rows[y][x], i = y * W + x;
      let k = T.FLOOR;
      if (ch === '#') k = T.WALL;
      else if (ch === '=') k = T.SCREEN;
      else if (ch === 'o') k = T.LOW;
      else if (ch === 'd') { k = T.DOOR; m.doors.push({ x, y, i }); }
      else if (ch === 'X') { k = T.EXIT; m.exits.push({ x, y, i }); }
      else if (ch === 'S') m.start = { x: x + 0.5, y: y + 0.5 };
      else if (ch === '1') m.altars.push({ key: 'name', glyph: '名', x: x + 0.5, y: y + 0.5 });
      else if (ch === '2') m.altars.push({ key: 'breath', glyph: '息', x: x + 0.5, y: y + 0.5 });
      else if (ch === 'c') m.candles.push({ x: x + 0.5, y: y + 0.5 });
      else if (ch === 'p') m.po.push({ x: x + 0.5, y: y + 0.5, dormant: false });
      else if (ch === 'q') m.po.push({ x: x + 0.5, y: y + 0.5, dormant: true });
      else if (ch === 'f') m.pickups.push({ kind: 'talisman', x: x + 0.5, y: y + 0.5 });
      t[i] = k;
    }
    m.at = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? T.WALL : t[y * W + x];
    m.room = (x, y) => { for (const r of ROOMS) if (x >= r[1] && x <= r[3] + 1 && y >= r[2] && y <= r[4] + 1) return r[0]; return ''; };
    return m;
  }

  // 沿線段走過的每一格（含起點那格），依序呼叫 fn(tx, ty)；fn 回傳 true 就停。
  // 線段剛好穿過格角時，兩旁的格都會走到，光與視線不會從兩堵斜靠的牆縫漏過去。
  function walk(x0, y0, x1, y1, fn) {
    let tx = Math.floor(x0), ty = Math.floor(y0);
    const ex = Math.floor(x1), ey = Math.floor(y1);
    const dx = x1 - x0, dy = y1 - y0;
    const sx = dx > 0 ? 1 : dx < 0 ? -1 : 0, sy = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    const tdx = sx ? Math.abs(1 / dx) : Infinity, tdy = sy ? Math.abs(1 / dy) : Infinity;
    let tmx = sx > 0 ? (tx + 1 - x0) / dx : sx < 0 ? (tx - x0) / dx : Infinity;
    let tmy = sy > 0 ? (ty + 1 - y0) / dy : sy < 0 ? (ty - y0) / dy : Infinity;
    if (fn(tx, ty)) return true;
    let guard = 0;
    while ((tx !== ex || ty !== ey) && guard++ < 400) {
      if (Math.min(tmx, tmy) > 1 + 1e-9) break;
      if (Math.abs(tmx - tmy) < 1e-9) {
        if (fn(tx + sx, ty)) return true;
        if (fn(tx, ty + sy)) return true;
        tx += sx; ty += sy; tmx += tdx; tmy += tdy;
      } else if (tmx < tmy) { tx += sx; tmx += tdx; }
      else { ty += sy; tmy += tdy; }
      if (fn(tx, ty)) return true;
    }
    return false;
  }

  root.MAP = { ROWS, T, ROOMS, parse, walk };
})(typeof globalThis !== 'undefined' ? globalThis : this);
