// 燈下無明 —— 劍、鈴、符的玩家動作（2026-11-25，擁有者：「劍鈴符請嘗試分別做一個玩家動作技能動畫」）
// 只是畫面：照引擎的起手（g.p.act）與出手事件（swing、fireThrow、bell）擺姿勢，規則一點都不動。
// 三種畫面共用同一套時間：平面（render.js）、人的背後（render3d.js 的人）、第一人稱（render3d.js 掛在鏡頭上的手）。
//
//   劍：起手時左手把劍舉到右肩後（0.1 秒，就是引擎的起手），出手時從右往左一劍劈過去、身子往前踏，收劍。
//   鈴：左手把銅鈴舉到面前，搖半秒多，放下。
//   符：起手時左手往後拉、符尖點著火（0.15 秒），出手時往前一甩，符離手（之後就是引擎裡飛出去的那張），收手。
(function (root) {
  const R = root.R;
  // 身子的姿勢（平面與人的背後）：以人為準，0 是正前方、往右手邊為正、往上為正（弧度）
  //   arm：左臂指的方向 [左右, 上下]；prop：手上的東西指的方向；lean：身子前傾；step：往前踏幾格；
  //   show：手上的東西有多顯（0–1）；glow：符上的火；shake：鈴搖得多兇
  const IDLE = { arm: [-0.25, -1.35], prop: [0, -1.2], lean: 0, step: 0, show: 0, glow: 0, shake: 0 };
  // 第一人稱的手（鏡頭座標：x 右、y 上、z 往後；看出去是 -z）：hand 手的位置、rot 手上東西的轉角（XYZ）
  const FP_IDLE = { hand: [-0.3, -0.62, -0.5], rot: [0, 0, 0], show: 0, glow: 0, shake: 0 };
  const K = (t, o) => Object.assign({ t }, o);

  const SW_UP = { arm: [0.7, 0.45], prop: [1.75, 0.45], lean: -0.05, show: 1 };   // 劍舉到右肩，劍尖朝右後
  const FI_UP = { arm: [-2.2, 0.6], prop: [-2.5, 1.1], lean: -0.1, show: 1, glow: 1 };   // 符往後拉、點著火
  const BE_UP = { arm: [-0.9, 0.75], show: 1 };   // 鈴舉到左前方、頭的高度（從人的背後看得到，不被斗笠擋住）
  const FSW_UP = { hand: [0.3, -0.08, -0.52], rot: [1.0, -0.7, 0.4], show: 1 };
  const FFI_UP = { hand: [-0.3, -0.13, -0.5], rot: [0.35, 0.2, -0.25], show: 1, glow: 1 };
  const FBE_UP = { hand: [-0.2, -0.12, -0.62], show: 1 };

  // 每一動的關鍵格。wind 是起手（時間照引擎的起手倒數），go 是出手之後（照畫面的時間走）。
  // 第一格永遠換成「開始這一動時的姿勢」，所以連著出招、中途換招都不會跳。e：到這一格的速度（lin 等速、out 先快後慢，沒寫是緩進緩出）
  const KEYS = {
    body: {
      sword: {
        wind: [K(0, {}), K(R.SWORD.windup, SW_UP)],
        go: [K(0, SW_UP),
          K(0.06, { arm: [0.25, -0.1], prop: [0.9, -0.05], lean: 0.08, step: 0.06, show: 1, e: 'lin' }),
          K(0.12, { arm: [-0.55, -0.15], prop: [-0.9, -0.12], lean: 0.12, step: 0.1, show: 1, e: 'lin' }),
          K(0.2, { arm: [-0.9, -0.45], prop: [-1.7, -0.45], lean: 0.12, step: 0.1, show: 1, e: 'out' }),
          K(0.3, { arm: [-0.85, -0.6], prop: [-1.6, -0.75], lean: 0.06, step: 0.05, show: 1 }),
          K(0.46, {})]
      },
      fire: {
        wind: [K(0, {}), K(R.FIRE.windup, FI_UP)],
        go: [K(0, Object.assign({}, FI_UP, { show: 0, glow: 0, fix: ['show', 'glow'] })),   // 出手的那一刻符就離手了（fix：不從當下的姿勢慢慢淡，直接沒了）
          K(0.07, { arm: [0.1, 0.2], prop: [0.1, 0.2], lean: 0.14, step: 0.08, e: 'out' }),
          K(0.18, { arm: [0.3, -0.45], prop: [0.3, -0.5], lean: 0.1, step: 0.08 }),
          K(0.45, {})]
      },
      bell: {
        go: [K(0, {}),
          K(0.1, Object.assign({}, BE_UP, { shake: 0.2 })),
          K(0.16, Object.assign({}, BE_UP, { shake: 1 })),
          K(0.55, Object.assign({}, BE_UP, { arm: [-0.95, 0.72], shake: 0.8 })),
          K(0.68, Object.assign({}, BE_UP, { arm: [-0.95, 0.66], shake: 0 })),
          K(0.9, {})]
      }
    },
    fp: {
      sword: {
        wind: [K(0, {}), K(R.SWORD.windup, FSW_UP)],
        go: [K(0, FSW_UP),
          K(0.06, { hand: [0.1, -0.2, -0.56], rot: [0.1, -0.4, 0.2], show: 1, e: 'lin' }),
          K(0.12, { hand: [-0.16, -0.25, -0.54], rot: [-0.1, 0.7, -0.2], show: 1, e: 'lin' }),
          K(0.2, { hand: [-0.3, -0.36, -0.48], rot: [-0.35, 1.2, -0.4], show: 1, e: 'out' }),
          K(0.3, { hand: [-0.32, -0.42, -0.48], rot: [-0.45, 1.2, -0.4], show: 1 }),
          K(0.46, {})]
      },
      fire: {
        wind: [K(0, {}), K(R.FIRE.windup, FFI_UP)],
        go: [K(0, Object.assign({}, FFI_UP, { show: 0, glow: 0, fix: ['show', 'glow'] })),
          K(0.07, { hand: [0, -0.1, -0.8], e: 'out' }),
          K(0.18, { hand: [0.08, -0.28, -0.66] }),
          K(0.45, {})]
      },
      bell: {
        go: [K(0, {}),
          K(0.1, Object.assign({}, FBE_UP, { shake: 0.2 })),
          K(0.16, Object.assign({}, FBE_UP, { shake: 1 })),
          K(0.55, Object.assign({}, FBE_UP, { shake: 0.8 })),
          K(0.68, Object.assign({}, FBE_UP, { hand: [-0.2, -0.15, -0.62], shake: 0 })),
          K(0.9, {})]
      }
    }
  };
  const BASE = { body: IDLE, fp: FP_IDLE };
  // 每一格補齊沒寫的欄位（沒寫就是站著的樣子）
  for (const which of ['body', 'fp']) for (const kind in KEYS[which]) for (const ph in KEYS[which][kind]) {
    KEYS[which][kind][ph] = KEYS[which][kind][ph].map((k) => Object.assign({}, BASE[which], k, { t: k.t, e: k.e, fix: k.fix }));
  }
  const WIND = { sword: R.SWORD.windup, fire: R.FIRE.windup };
  const END = { sword: 0.46, fire: 0.45, bell: 0.9 };
  const SHOW_IN = 0.04;   // 起手時手上的東西多快出現

  const lerp = (a, b, u) => a + (b - a) * u;
  function mix(a, b, u) {
    const o = {};
    for (const k in a) {
      if (k === 't' || k === 'e' || k === 'fix') continue;
      o[k] = Array.isArray(a[k]) ? a[k].map((v, i) => lerp(v, b[k][i], u)) : lerp(a[k], b[k], u);
    }
    return o;
  }
  function ease(u, e) { return e === 'lin' ? u : e === 'out' ? 1 - (1 - u) * (1 - u) : u * u * (3 - 2 * u); }
  function sample(keys, t, from) {
    if (keys[0].fix) { from = Object.assign({}, from); for (const f of keys[0].fix) from[f] = keys[0][f]; }
    if (t <= keys[0].t) return mix(from, from, 0);
    for (let i = 1; i < keys.length; i++) {
      if (t <= keys[i].t) {
        const a = i === 1 ? from : keys[i - 1], b = keys[i];
        return mix(a, b, ease((t - keys[i - 1].t) / (b.t - keys[i - 1].t), b.e));
      }
    }
    return mix(keys[keys.length - 1], keys[keys.length - 1], 0);
  }
  const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };

  // 一個畫面一個：收出手事件、每一幀照引擎走、給姿勢
  function tracker() {
    let a = null;
    const last = { body: mix(IDLE, IDLE, 0), fp: mix(FP_IDLE, FP_IDLE, 0) };
    function start(kind, phase, dir, ref) { a = { kind, phase, t: 0, dir, ref: ref || null, from: { body: last.body, fp: last.fp } }; }
    return {
      event(e, g) {
        if (e.type === 'swing') start('sword', 'go', e.dir);
        else if (e.type === 'fireThrow') start('fire', 'go', e.dir);
        else if (e.type === 'bell') start('bell', 'go', g.p.aim);
      },
      step(g, dt) {
        const act = g.p.act;
        if (act && (act.kind === 'sword' || act.kind === 'fire') && !(a && a.phase === 'wind' && a.ref === act)) start(act.kind, 'wind', act.dir, act);
        if (!a) return;
        if (a.phase === 'wind') {
          if (act === a.ref) a.t = Math.max(0, WIND[a.kind] - act.t);
          else { a.phase = 'go'; a.t = 0; a.from = { body: last.body, fp: last.fp }; }   // 沒收到出手事件（換了畫面）：當作出手了
        } else a.t += dt;
        if (a.phase === 'go' && a.t >= END[a.kind]) a = null;
      },
      pose(which) {
        if (!a) return (last[which] = mix(BASE[which], BASE[which], 0));
        const p = sample(KEYS[which][a.kind][a.phase], a.t, a.from[which]);
        if (a.phase === 'wind') p.show = Math.max(a.from[which].show, Math.min(1, a.t / SHOW_IN));
        last[which] = p;
        return p;
      },
      // 出招時身子轉向出招的方向（自動對準時可能和平常面向的不一樣），收招時慢慢轉回來
      face(aim) {
        if (!a) return aim;
        const end = END[a.kind];
        const w = a.phase === 'wind' ? Math.min(1, a.t / 0.05) : Math.min(1, (end - a.t) / 0.15);
        return aim + angDiff(a.dir, aim) * Math.max(0, w);
      },
      get kind() { return a ? a.kind : null; },
      get phase() { return a ? a.phase : null; },
      get t() { return a ? a.t : 0; },
      reset() { a = null; last.body = mix(IDLE, IDLE, 0); last.fp = mix(FP_IDLE, FP_IDLE, 0); }
    };
  }

  root.MOVES = { IDLE, FP_IDLE, KEYS, END, WIND, tracker, sample };
})(typeof window !== 'undefined' ? window : globalThis);
