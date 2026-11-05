// 燈下無明 —— 開始畫面那盞燈的路線。
// 一條平滑、閉合的曲線，一路等速走，不停、不頓，所以看起來是一個長鏡頭，不像幾段短片接起來。
// 路線只走地板與廊口，不穿牆、不穿紙屏（穿紙屏時光會一下被擋、一下又亮，看起來就像剪接）。
// 繞一圈：玄關（經過大門）→ 天井的井 → 正廳 → 祠堂的燭與息印 → 東廂 → 偏房睡著的魄 → 回玄關。
// 穿過廊口時一律順著廊口直直走。測試會檢查不碰牆屏、每半格轉彎不超過 40 度、頭尾接得上。
(function (root) {
  const WAY = [
    [27.0, 24.6], [21.5, 25.3], [15.5, 24.8], [14.3, 22.4], [16.3, 21.2], [18.3, 20.6], [19.4, 19.7],  // 玄關：沿南邊經過大門，從照壁西頭繞上來
    [19.5, 18.5], [19.5, 17.2], [17.3, 14.9], [16.9, 12.4], [18.0, 10.3], [21.0, 10.0], // 直直穿過廊口進天井，繞著井
    [24.0, 10.5], [25.5, 9.5], [25.5, 8.5], [25.5, 7.2], [27.6, 5.6], [29.4, 4.6],       // 直直進正廳，往東
    [30.5, 4.5], [32.2, 4.5], [34.2, 3.4], [36.0, 4.4], [35.8, 6.6], [35.5, 7.6],         // 祠堂：經過燭與息印
    [35.5, 8.5], [35.5, 10.2], [34.2, 11.3], [32.8, 12.6], [32.7, 13.6], [33.8, 15.0], [35.3, 16.4], [35.5, 17.4],   // 東廂：從紙屏的缺口繞過去
    [35.5, 18.5], [35.5, 20.2], [34.5, 21.6], [32.5, 22.3], [30.5, 22.5], [28.6, 23.4]   // 偏房（照得到睡著的魄，不碰它），回玄關
  ];
  const SPEED = 1.15;   // 每秒幾格
  const STEP = 0.05;    // 重新取樣的間距（格）

  const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  // 向心 Catmull-Rom：過每一個點、轉彎圓順、不會打結
  function cr(p0, p1, p2, p3, u) {
    const t0 = 0, t1 = t0 + Math.sqrt(d2(p0, p1)) || 1e-6, t2 = t1 + Math.sqrt(d2(p1, p2)) || t1 + 1e-6, t3 = t2 + Math.sqrt(d2(p2, p3)) || t2 + 1e-6;
    const t = t1 + (t2 - t1) * u;
    const mix = (a, b, ta, tb) => [((tb - t) * a[0] + (t - ta) * b[0]) / (tb - ta), ((tb - t) * a[1] + (t - ta) * b[1]) / (tb - ta)];
    const A1 = mix(p0, p1, t0, t1), A2 = mix(p1, p2, t1, t2), A3 = mix(p2, p3, t2, t3);
    const B1 = mix(A1, A2, t0, t2), B2 = mix(A2, A3, t1, t3);
    return mix(B1, B2, t1, t2);
  }
  // 先密密取點，再照弧長等距重取，走起來才會等速
  function build(way) {
    const n = way.length, dense = [];
    for (let i = 0; i < n; i++) {
      const p0 = way[(i - 1 + n) % n], p1 = way[i], p2 = way[(i + 1) % n], p3 = way[(i + 2) % n];
      for (let k = 0; k < 40; k++) dense.push(cr(p0, p1, p2, p3, k / 40));
    }
    dense.push(dense[0]);
    const pts = [dense[0]];
    let carry = 0;
    for (let i = 1; i < dense.length; i++) {
      const a = dense[i - 1], b = dense[i], L = d2(a, b);
      let s = STEP - carry;
      while (s <= L) { const f = s / L; pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]); s += STEP; }
      carry = L - (s - STEP);
    }
    if (d2(pts[pts.length - 1], pts[0]) < STEP * 0.5) pts.pop();   // 頭尾接起來
    return pts;
  }
  const PTS = build(WAY), LEN = PTS.length * STEP;
  // 走了 s 格時燈在哪裡、往哪個方向
  function at(s) {
    const f = (((s % LEN) + LEN) % LEN) / STEP, i = Math.floor(f), u = f - i;
    const a = PTS[i % PTS.length], b = PTS[(i + 1) % PTS.length];
    const x = a[0] + (b[0] - a[0]) * u, y = a[1] + (b[1] - a[1]) * u, L = d2(a, b) || 1;
    return { x, y, dx: (b[0] - a[0]) / L, dy: (b[1] - a[1]) / L };
  }
  root.TOUR = { WAY, SPEED, STEP, PTS, LEN, at };
})(typeof globalThis !== 'undefined' ? globalThis : this);
