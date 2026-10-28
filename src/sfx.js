// 燈下無明 —— 聲音：全部用 WebAudio 現場合成，沒有音檔。
// 黑暗裡的蓄撲只有聲音提示，所以這裡的「嘶」聲是規則的一部分，不只是裝飾。
(function (root) {
  let ac = null, master = null, muted = false, noiseBuf = null;
  try { muted = localStorage.getItem('xieyi.deng.mute') === '1'; } catch (e) { /* 沒有就算了 */ }

  function ensure() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return true; }
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return false;
    ac = new AC();
    master = ac.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }
  function out(pan) {
    if (pan == null || !ac.createStereoPanner) return master;
    const p = ac.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); p.connect(master); return p;
  }
  function tone(f, dur, vol, type, dest, f2) {
    const o = ac.createOscillator(), gn = ac.createGain(), t = ac.currentTime;
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(gn); gn.connect(dest || master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, filt, f0, f1, dest, q) {
    const s = ac.createBufferSource(), bf = ac.createBiquadFilter(), gn = ac.createGain(), t = ac.currentTime;
    s.buffer = noiseBuf; bf.type = filt || 'bandpass'; bf.Q.value = q || 1.2;
    bf.frequency.setValueAtTime(f0, t); if (f1) bf.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur / 3)); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(bf); bf.connect(gn); gn.connect(dest || master); s.start(t); s.stop(t + dur + 0.05);
  }
  const S = {
    bell() { const d = out(); tone(880, 1.8, 0.22, 'sine', d); tone(1318, 1.4, 0.12, 'sine', d); tone(2210, 0.9, 0.06, 'sine', d); tone(587, 2.2, 0.08, 'triangle', d); },
    // 蓄撲：由低升高的嘶聲，0.45 秒；音量看距離、左右看方位
    hiss(dist, dx) { const v = Math.max(0.05, 0.5 * (1 - dist / 9)); noise(0.45, v, 'bandpass', 380, 1900, out(dx / 4), 3); tone(90, 0.45, v * 0.35, 'sawtooth', out(dx / 4), 140); },
    bite() { noise(0.25, 0.5, 'lowpass', 900, 200); tone(70, 0.3, 0.4, 'sine', null, 40); },
    whiff() { noise(0.18, 0.12, 'bandpass', 1200, 400); },
    swish() { noise(0.16, 0.22, 'highpass', 2500, 900, null, 0.7); },
    hit() { noise(0.12, 0.35, 'lowpass', 1400, 300); tone(160, 0.15, 0.2, 'triangle', null, 90); },
    boom() { noise(0.6, 0.55, 'lowpass', 1600, 120); tone(110, 0.5, 0.35, 'sine', null, 45); },
    throwIt() { noise(0.2, 0.15, 'bandpass', 600, 2400, null, 2); },
    page() { noise(0.07, 0.18, 'highpass', 3000); setTimeout(() => ac && noise(0.06, 0.12, 'highpass', 3500), 80); },
    seal() { tone(320, 0.12, 0.35, 'square'); setTimeout(() => ac && tone(260, 0.16, 0.3, 'square'), 110); },
    fail() { tone(160, 0.25, 0.15, 'triangle', null, 120); },
    disperse() { noise(1.0, 0.25, 'bandpass', 900, 3000, null, 0.8); },
    wake() { tone(55, 1.2, 0.25, 'sawtooth', null, 48); noise(1.0, 0.1, 'lowpass', 300, 120); },
    lamp(on) { noise(0.08, 0.12, 'bandpass', on ? 1800 : 600); },
    door() { tone(70, 1.2, 0.3, 'triangle', null, 50); noise(0.8, 0.2, 'lowpass', 500, 100); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => ac && tone(f, 0.9, 0.12, 'sine'), i * 160)); },
    lose() { tone(196, 1.6, 0.2, 'sine', null, 98); noise(1.5, 0.15, 'lowpass', 600, 80); }
  };
  root.SFX = {
    unlock: ensure,
    play(name, ...a) { if (!ac || muted || !S[name]) return; try { S[name](...a); } catch (e) { /* 聲音出錯不影響遊戲 */ } },
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem('xieyi.deng.mute', muted ? '1' : '0'); } catch (e) { /* 沒有就算了 */ } if (master) master.gain.value = muted ? 0 : 0.7; return muted; }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
