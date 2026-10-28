// 燈下無明 —— 規則表：所有數值都在這裡，調平衡只動這個檔。
// 單位：距離是「格」，時間是「秒」。來源：2026-10-26 攻防自查 md 的數值，加上 2026-10-28 審視後的預設（見 docs/DESIGN.md）。
(function (root) {
  const R = {
    TITLE: '燈下無明', SUB: '紙宅 · 試夜', VERSION: '0.1',
    STEP: 1 / 120,          // 固定步長：畫面幾 Hz 都一樣（120Hz、144Hz、60Hz、卡頓）
    MAX_FRAME: 0.1,         // 一幀最多補 0.1 秒；切分頁回來不會一下跳好幾秒

    // 人
    P: { r: 0.3, speed: 3.2, chillMax: 100, armorMax: 54, talismans: 3, talismanMax: 5, ink: 3, inkMax: 3, biteKnock: 0.2 },

    // 手燈與「燈下無明」：點燈看得清近處，卻從遠處就被看見；掩燈後眼睛慢慢習慣黑暗，看得更遠
    LAMP: { r: 4.2, adaptT: 2.5, adaptR: 5.5, glare: 0.35, adaptLoss: 0.3 },

    // 暴露：點燈或站在別的光裡（借火、燭、火光）就算暴露
    EXPOSE: { light: 0.35, see: 9, seeScreen: 6, dark: 2.2 },

    // 魄
    PO: {
      hp: 60, r: 0.35,
      patrol: 1.2, investigate: 2.0, chase: 2.7,          // 人走 3.2，直路跑得掉，停下來做事就會被追上
      windStart: 0.75, biteR: 0.95, windT: 0.45,           // 靠到 0.75 格才蓄，蓄撲時停步，結算時看人還在不在 0.95 格內
      whiffT: 0.55, recoilT: 0.7, bite: 18,                // 撲空僵 0.55 秒（反擊窗口）；咬中後退開 0.7 秒
      auraR: 1.4, aura: 5,                                 // 久留身邊每秒 +5 寒意，不經護心衣
      reformT: 14, formT: 1.5, formClear: 2.5, formRepick: 3, reformFar: 8,
      searchT: 4, searchR: 2.5, loseT: 0.25, lureR: 10, lingerMin: 1, lingerMax: 2.2,
      repath: 0.35, stuckT: 1.2
    },

    // 桃木劍：數值照 md（傷 24、退 0.35、停 0.12、間隔 1.05）；定位改成「打了就跑」
    SWORD: { dmg: 24, knock: 0.35, stagger: 0.12, cd: 1.05, windup: 0.10, reach: 1.2, arc: 65 },

    // 銅鈴：不耗東西，但聲音穿得過紙牆，會把魄引來（免費的工具用「暴露」付代價）
    BELL: { r: 2.4, knock: 1.4, stun: 1.2, dmg: 6, cd: 7, hear: 12 },

    // 火符：射線碰到第一隻魄或牆就引燃；灼燒只扣血
    FIRE: { range: 4.6, speed: 16, windup: 0.15, boom: 1.3, dmg: 26, burn: 6, burnT: 3, stagger: 0.25, knock: 0.3, flashR: 2.5, flashT: 0.5 },

    // 《燼琅嬛》兩頁咒：讀咒時不能走（一走就合書，不耗墨）；被咬、魄貼身也會中斷
    BOOK: {
      borrow: { cost: 1, read: 1.2, range: 5, life: 15, r: 3.2, I: 0.9 },  // 借火：照路、引魄、取暖
      seal: { cost: 1, read: 0.9, reach: 1.6, life: 10 }                   // 封戶：擋住一切，只讓光透過
    },

    // 光源
    LIGHT: { lamp: { r: 4.2, I: 1 }, candle: { r: 2.8, I: 0.85 }, screen: 0.45, paperGlow: 0.35 },

    // 取暖：火邊每秒退 4 點寒意，但站在火光裡就是暴露
    WARM: { r: 1.6, rate: 4 },

    // 取印：按住 E 一秒；取印處補給
    TAKE: { t: 1.0, reach: 1.1, armor: 18, talisman: 1, ink: 1, chill: -15 },

    // 魄的巡行點
    WAY: {
      po1: [[12, 2], [27, 2], [19, 6], [12, 6], [27, 6], [19, 2], [13, 9], [26, 9], [13, 17], [26, 17], [16, 13], [23, 13]],
      po2: [[33, 10], [36, 16], [33, 20], [36, 25], [33, 2], [36, 6], [25, 20], [27, 25]],
      hall: [[12, 20], [27, 20], [12, 25], [27, 25], [19, 21]]   // 兩印到手後，兩隻魄都會到玄關一帶
    },
    HALL: [19.5, 21.5]
  };
  root.R = R;
})(typeof globalThis !== 'undefined' ? globalThis : this);
