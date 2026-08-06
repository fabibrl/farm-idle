/**
 * AudioManager — all sound is synthesized with WebAudio (no asset files).
 * Provides SFX (merge, coin, poop, click, unlock) plus a gentle looping
 * background tune and ambient birds.
 */
const AudioManager = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let musicOn = true, sfxOn = true;
  let musicTimer = null, ambientTimer = null;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.connect(ctx.destination);
      musicGain = ctx.createGain(); musicGain.gain.value = CONFIG.MUSIC_VOLUME; musicGain.connect(master);
      sfxGain = ctx.createGain(); sfxGain.gain.value = CONFIG.SFX_VOLUME; sfxGain.connect(master);
      startMusic();
      startAmbient();
      return true;
    } catch (e) { return false; }
  }

  /** One synthesized note. */
  function tone(freq, dur, type = 'sine', vol = 0.3, dest = null, slide = 0) {
    if (!ctx || !sfxOn && dest !== musicGain) { if (dest !== musicGain) return; }
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ctx.currentTime + dur);
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(dest || sfxGain);
    o.start(); o.stop(ctx.currentTime + dur + 0.02);
  }

  function noise(dur, vol = 0.2, freq = 1000) {
    if (!ctx || !sfxOn) return;
    const len = ctx.sampleRate * dur;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(sfxGain);
    src.start();
  }

  // ---------------- SFX ----------------
  const SFX = {
    click()  { tone(650, 0.06, 'square', 0.12); tone(880, 0.05, 'square', 0.08); },
    merge()  {
      tone(440, 0.12, 'triangle', 0.3, null, 220);
      setTimeout(() => tone(660, 0.15, 'triangle', 0.3, null, 330), 60);
      setTimeout(() => tone(990, 0.25, 'sine', 0.25, null, 200), 130);
      noise(0.15, 0.12, 2400);
    },
    coin()   { tone(1320, 0.09, 'square', 0.12); setTimeout(() => tone(1760, 0.18, 'square', 0.1), 60); },
    poop()   { tone(180, 0.12, 'sine', 0.2, null, -80); noise(0.08, 0.06, 500); },
    pop()    { tone(520, 0.08, 'sine', 0.25, null, 300); },
    error()  { tone(220, 0.15, 'square', 0.12, null, -60); },
    buy()    {
      tone(660, 0.08, 'square', 0.18);
      setTimeout(() => tone(880, 0.1, 'square', 0.16), 70);
      setTimeout(() => tone(1320, 0.16, 'triangle', 0.2), 140);
    },
    unlock() {
      const seq = [523, 659, 784, 1047, 1319];
      seq.forEach((f, i) => setTimeout(() => tone(f, 0.35, 'triangle', 0.28), i * 110));
      setTimeout(() => noise(0.4, 0.1, 3000), 500);
    },
  };

  function play(name) { if (ctx && sfxOn && SFX[name]) SFX[name](); }

  // ---------------- MUSIC ----------------
  // Gentle pentatonic loop.
  const SCALE = [262, 294, 330, 392, 440, 523, 587, 659];
  let step = 0;
  function startMusic() {
    if (musicTimer) return;
    const beat = 0.32;
    musicTimer = setInterval(() => {
      if (!musicOn || !ctx) return;
      const bar = Math.floor(step / 8) % 4;
      // bass
      if (step % 4 === 0) tone(SCALE[[0, 3, 4, 3][bar]] / 2, beat * 2.2, 'triangle', 0.16, musicGain);
      // melody: sparse, wandering
      if (Math.random() < 0.6) {
        const n = SCALE[(step + bar * 2 + U.randInt(0, 2)) % SCALE.length];
        tone(n, beat * 1.4, 'sine', 0.10, musicGain);
      }
      step++;
    }, beat * 1000);
  }
  function startAmbient() {
    if (ambientTimer) return;
    ambientTimer = setInterval(() => {
      if (!musicOn || !ctx) return;
      // random birdsong chirp
      if (Math.random() < 0.4) {
        const f = U.rand(1800, 2600);
        tone(f, 0.08, 'sine', 0.04, musicGain, U.rand(200, 500));
        setTimeout(() => tone(f * 1.1, 0.1, 'sine', 0.03, musicGain, -300), 120);
      }
    }, 2600);
  }

  return {
    ensure, play,
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; },
    setMusic(v) { musicOn = v; if (musicGain) musicGain.gain.value = v ? CONFIG.MUSIC_VOLUME : 0; },
    setSfx(v) { sfxOn = v; },
  };
})();
