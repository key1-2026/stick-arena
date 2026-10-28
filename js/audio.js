/* =========================================================
   STICK//ARENA — 程序化音效
   无外部音频资源，全部由 Web Audio 实时合成
   ========================================================= */

const GameAudio = (() => {
  const MASTER_LEVEL = 0.82;
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let musicBus = null;
  let muted = false;
  let noiseBuffer = null;
  let ambience = null;
  let musicMode = null;
  let musicTimer = null;
  let musicStep = 0;
  let musicNext = 0;
  let musicBase = 0.36;
  let musicDucked = false;

  function init() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : MASTER_LEVEL;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 16;
    comp.ratio.value = 6;
    comp.attack.value = 0.002;
    comp.release.value = 0.18;
    master.connect(comp);
    comp.connect(ctx.destination);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 1.2;
    sfxBus.connect(master);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0.0001;
    musicBus.connect(master);

    const len = Math.floor(ctx.sampleRate * 1.2);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  function now() { return ctx ? ctx.currentTime : 0; }

  function tone(freq, dur, opts = {}) {
    if (!ctx || muted) return;
    const t = now() + (opts.delay || 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (opts.endFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(24, opts.endFreq), t + dur);
    }
    filter.type = opts.filterType || 'lowpass';
    filter.frequency.setValueAtTime(opts.cutoff || 5000, t);
    filter.Q.value = opts.q || 0.6;
    const vol = (opts.volume === undefined ? 0.18 : opts.volume);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.03);
  }

  function noise(dur, opts = {}) {
    if (!ctx || muted || !noiseBuffer) return;
    const t = now() + (opts.delay || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType || 'bandpass';
    filter.frequency.setValueAtTime(opts.freq || 1400, t);
    if (opts.endFreq) filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.endFreq), t + dur);
    filter.Q.value = opts.q || 0.9;
    const gain = ctx.createGain();
    const vol = opts.volume === undefined ? 0.18 : opts.volume;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(sfxBus);
    src.start(t);
    src.stop(t + dur + 0.03);
  }

  /* ---------------- 程序化音乐 ---------------- */

  const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

  const MUSIC = {
    menu: {
      bpm: 82, padVol: .016,
      chords: [
        { root: 45, notes: [45, 48, 52, 55] }, // Am7
        { root: 41, notes: [41, 45, 48, 52] }, // Fmaj7
        { root: 48, notes: [48, 52, 55, 59] }, // Cmaj7
        { root: 43, notes: [43, 47, 50, 55] }, // G
        { root: 45, notes: [45, 48, 52, 55] },
        { root: 41, notes: [41, 45, 48, 52] },
        { root: 48, notes: [48, 52, 55, 59] },
        { root: 43, notes: [43, 47, 50, 55] }
      ]
    },
    battle: {
      bpm: 132, padVol: .018,
      chords: [
        { root: 45, notes: [45, 48, 52] }, // Am
        { root: 41, notes: [41, 45, 48] }, // F
        { root: 48, notes: [48, 52, 55] }, // C
        { root: 43, notes: [43, 47, 50] }, // G
        { root: 45, notes: [45, 48, 52] },
        { root: 41, notes: [41, 45, 48] },
        { root: 48, notes: [48, 52, 55] },
        { root: 43, notes: [43, 47, 50] }
      ]
    }
  };

  let musicStepDur = 0.12;

  function musicTone(freq, time, dur, opts = {}) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = opts.type || 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    osc.detune.value = opts.detune || 0;
    filter.type = opts.filterType || 'lowpass';
    filter.frequency.setValueAtTime(opts.cutoff || 2400, time);
    filter.Q.value = opts.q || .7;
    const vol = opts.volume === undefined ? .04 : opts.volume;
    const attack = Math.min(opts.attack === undefined ? .008 : opts.attack, dur * .5);
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, vol), time + attack);
    gain.gain.exponentialRampToValueAtTime(.0001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(musicBus);
    osc.start(time);
    osc.stop(time + dur + .04);
  }

  function musicPad(notes, time, dur, vol) {
    notes.forEach((n, i) => {
      const f = mtof(n);
      musicTone(f, time, dur, { type: 'sawtooth', volume: vol, attack: .26, cutoff: 620 + i * 130, q: .45, detune: -5 });
      musicTone(f, time, dur, { type: 'triangle', volume: vol * .72, attack: .3, cutoff: 1500, detune: 5 });
    });
  }

  function musicNoise(time, dur, opts = {}) {
    if (!ctx || muted || !noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType || 'highpass';
    filter.frequency.setValueAtTime(opts.freq || 1600, time);
    filter.Q.value = opts.q || .7;
    const gain = ctx.createGain();
    const vol = opts.volume === undefined ? .03 : opts.volume;
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002, vol), time + .004);
    gain.gain.exponentialRampToValueAtTime(.0001, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(musicBus);
    src.start(time);
    src.stop(time + dur + .02);
  }

  function musicKick(time, vol) {
    if (!ctx || muted) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(43, time + .2);
    gain.gain.setValueAtTime(.0001, time);
    gain.gain.exponentialRampToValueAtTime(vol, time + .006);
    gain.gain.exponentialRampToValueAtTime(.0001, time + .24);
    osc.connect(gain);
    gain.connect(musicBus);
    osc.start(time);
    osc.stop(time + .27);
  }

  function scheduleMusicStep(step, time) {
    const cfg = MUSIC[musicMode];
    if (!cfg) return;
    const seg = Math.floor(step / 8) % cfg.chords.length;
    const chord = cfg.chords[seg];
    const beat = step % 8;

    if (beat === 0) {
      musicPad(chord.notes, time, musicStepDur * 8 * 1.08, cfg.padVol);
      if (musicMode === 'menu') {
        musicTone(mtof(chord.root - 12), time, musicStepDur * 7, { type: 'sine', volume: .05, attack: .04, cutoff: 420 });
      }
    }

    if (musicMode === 'menu') {
      if (beat === 0 || beat === 4) {
        musicTone(mtof(chord.root), time, musicStepDur * 3.4, { type: 'triangle', volume: .034, attack: .02, cutoff: 700 });
      }
      if (step % 2 === 0) {
        const arp = [0, 2, 1, 3];
        const note = chord.notes[arp[(step / 2) % arp.length]] + 12;
        musicTone(mtof(note), time, musicStepDur * 2.6, { type: 'sine', volume: .021, attack: .01, cutoff: 3200 });
      }
      return;
    }

    if (step % 2 === 0) {
      const note = chord.notes[(step / 2) % chord.notes.length] + 12;
      musicTone(mtof(note), time, musicStepDur * 1.6, { type: 'triangle', volume: .022, attack: .005, cutoff: 3000 });
      const octave = step % 4 === 0 ? 0 : 12;
      musicTone(mtof(chord.root - 12 + octave), time, musicStepDur * 1.75, {
        type: 'sawtooth', volume: .052, attack: .005, cutoff: 540, q: 1.1
      });
    }
    if (step % 4 === 0) musicKick(time, .17);
    if (beat === 4) musicNoise(time, .17, { freq: 1900, volume: .058 });
    if (step % 2 === 0) musicNoise(time, .035, { freq: 7200, volume: .017 });
  }

  function scheduleMusic() {
    if (!ctx || !musicMode || !musicBus) return;
    const t = ctx.currentTime;
    if (musicNext < t - .25) musicNext = t + .03;
    while (musicNext < t + .22) {
      scheduleMusicStep(musicStep, musicNext);
      musicNext += musicStepDur;
      musicStep = (musicStep + 1) % 64;
    }
  }

  function playMusic(mode, force = false) {
    init();
    if (!ctx || !musicBus) return;
    if (musicMode === mode && musicTimer && !force) return;
    if (musicTimer) clearInterval(musicTimer);
    musicMode = MUSIC[mode] ? mode : 'menu';
    musicStep = 0;
    musicDucked = false;
    musicBase = musicMode === 'battle' ? .38 : .30;
    musicStepDur = 60 / MUSIC[musicMode].bpm / 4;
    const startAt = ctx.currentTime + .08;
    const t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(Math.max(.0001, musicBus.gain.value), t);
    musicBus.gain.exponentialRampToValueAtTime(.0001, t + .07);
    musicBus.gain.setValueAtTime(.0001, startAt);
    musicBus.gain.exponentialRampToValueAtTime(musicBase, startAt + .6);
    musicNext = startAt;
    musicTimer = setInterval(scheduleMusic, 55);
    scheduleMusic();
  }

  function stopMusic(fade = .5) {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
    musicMode = null;
    musicDucked = false;
    if (!ctx || !musicBus) return;
    const t = ctx.currentTime;
    musicBus.gain.cancelScheduledValues(t);
    musicBus.gain.setValueAtTime(Math.max(.0001, musicBus.gain.value), t);
    musicBus.gain.exponentialRampToValueAtTime(.0001, t + fade);
  }

  function duckMusic(duck) {
    musicDucked = !!duck;
    if (!ctx || !musicBus || !musicMode) return;
    const target = musicDucked ? musicBase * .34 : musicBase;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(target, ctx.currentTime, .12);
  }

  const api = {
    init,
    get muted() { return muted; },
    setMuted(value) {
      muted = !!value;
      if (master) {
        master.gain.setTargetAtTime(muted ? 0 : MASTER_LEVEL, now(), 0.03);
      }
    },
    toggleMute() {
      api.setMuted(!muted);
      return muted;
    },

    playMusic,
    stopMusic,
    duckMusic,
    get musicMode() { return musicMode; },
    get musicPlaying() { return !!musicTimer; },
    get musicVolume() { return musicBus ? musicBus.gain.value : 0; },

    ui() {
      init();
      tone(540, 0.05, { type: 'triangle', volume: 0.045, endFreq: 720 });
    },
    hover() {
      init();
      tone(760, 0.03, { type: 'sine', volume: 0.02, endFreq: 880 });
    },
    swing(heavy = false) {
      init();
      noise(heavy ? 0.22 : 0.13, { freq: heavy ? 700 : 1500, endFreq: 220, volume: heavy ? 0.22 : 0.11, q: 0.7 });
      tone(heavy ? 140 : 240, 0.1, { type: 'sawtooth', volume: 0.035, endFreq: 80 });
    },
    slash() {
      init();
      noise(0.16, { freq: 2200, endFreq: 500, volume: 0.12, q: 0.8 });
    },
    shoot() {
      init();
      noise(0.16, { freq: 3200, endFreq: 600, volume: 0.2, q: 0.5 });
      tone(170, 0.1, { type: 'square', volume: 0.07, endFreq: 58, cutoff: 2200 });
    },
    shotgun() {
      init();
      noise(0.28, { freq: 1900, endFreq: 160, volume: 0.3, q: 0.4 });
      tone(92, 0.24, { type: 'sawtooth', volume: 0.11, endFreq: 38, cutoff: 1200 });
    },
    bow() {
      init();
      tone(310, 0.1, { type: 'triangle', volume: 0.05, endFreq: 520, filterType: 'bandpass', cutoff: 1600 });
      noise(0.08, { freq: 4200, endFreq: 2400, volume: 0.04, q: 2 });
    },
    magic() {
      init();
      tone(480, 0.24, { type: 'sine', volume: 0.06, endFreq: 1120 });
      tone(760, 0.18, { type: 'triangle', volume: 0.025, endFreq: 1320, delay: 0.02 });
    },
    frost() {
      init();
      tone(1280, 0.35, { type: 'sine', volume: 0.05, endFreq: 320 });
      noise(0.35, { freq: 4200, endFreq: 900, volume: 0.05, q: 1.8 });
    },
    hit(heavy = false) {
      init();
      noise(heavy ? 0.24 : 0.1, { freq: heavy ? 480 : 900, endFreq: 120, volume: heavy ? 0.29 : 0.15, q: 0.6 });
      tone(heavy ? 70 : 115, heavy ? 0.22 : 0.1, { type: 'sine', volume: heavy ? 0.16 : 0.08, endFreq: 38 });
    },
    hurt() {
      init();
      tone(220, 0.12, { type: 'sawtooth', volume: 0.045, endFreq: 120, cutoff: 900 });
    },
    explosion() {
      init();
      noise(0.55, { freq: 1400, endFreq: 90, volume: 0.34, q: 0.4 });
      tone(58, 0.5, { type: 'sine', volume: 0.22, endFreq: 28 });
      tone(110, 0.24, { type: 'sawtooth', volume: 0.06, endFreq: 40 });
    },
    jump() {
      init();
      tone(300, 0.1, { type: 'sine', volume: 0.035, endFreq: 640 });
    },
    doubleJump() {
      init();
      tone(460, 0.14, { type: 'triangle', volume: 0.04, endFreq: 900 });
      noise(0.1, { freq: 2400, endFreq: 800, volume: 0.03 });
    },
    dash() {
      init();
      noise(0.18, { freq: 900, endFreq: 280, volume: 0.12, q: 0.6 });
    },
    guard() {
      init();
      tone(420, 0.08, { type: 'triangle', volume: 0.035, endFreq: 620 });
      noise(0.08, { freq: 1800, endFreq: 900, volume: 0.035, q: 1.4 });
    },
    block(heavy = false) {
      init();
      noise(heavy ? 0.18 : 0.09, {
        freq: heavy ? 700 : 1500,
        endFreq: heavy ? 180 : 620,
        volume: heavy ? 0.18 : 0.1,
        q: 0.9
      });
      tone(heavy ? 110 : 190, heavy ? 0.14 : 0.07, {
        type: 'triangle', volume: heavy ? 0.08 : 0.04, endFreq: heavy ? 62 : 120
      });
    },
    guardBreak() {
      init();
      noise(0.28, { freq: 2600, endFreq: 180, volume: 0.2, q: 0.55 });
      tone(78, 0.32, { type: 'sawtooth', volume: 0.09, endFreq: 34, cutoff: 1200 });
      tone(260, 0.2, { type: 'square', volume: 0.035, endFreq: 90 });
    },
    dodge() {
      init();
      noise(0.17, { freq: 1800, endFreq: 420, volume: 0.1, q: 0.7 });
      tone(620, 0.14, { type: 'sine', volume: 0.04, endFreq: 1240 });
    },
    hammer(heavy = false) {
      init();
      noise(heavy ? .3 : .2, { freq: heavy ? 320 : 460, endFreq: 110, volume: heavy ? .16 : .1, q: .65 });
      tone(heavy ? 68 : 92, heavy ? .32 : .22, { type: 'sawtooth', volume: heavy ? .08 : .05, endFreq: heavy ? 34 : 52, cutoff: 900 });
    },
    spear() {
      init();
      noise(.19, { freq: 2600, endFreq: 620, volume: .09, q: 1.5 });
      tone(720, .17, { type: 'triangle', volume: .035, endFreq: 260 });
    },
    dagger() {
      init();
      noise(.09, { freq: 3600, endFreq: 1400, volume: .055, q: 2.2 });
      tone(1240, .1, { type: 'sine', volume: .025, endFreq: 620 });
    },
    blink() {
      init();
      tone(900, 0.2, { type: 'sine', volume: 0.05, endFreq: 240 });
      tone(500, 0.18, { type: 'triangle', volume: 0.03, endFreq: 1400, delay: 0.03 });
    },
    heal() {
      init();
      [420, 540, 680].forEach((f, i) => tone(f, 0.4, { type: 'sine', volume: 0.04, endFreq: f * 1.35, delay: i * 0.09 }));
    },
    roar() {
      init();
      noise(0.42, { freq: 420, endFreq: 150, volume: 0.18, q: 0.7 });
      tone(96, 0.42, { type: 'sawtooth', volume: 0.09, endFreq: 58, cutoff: 700 });
    },
    trap() {
      init();
      noise(0.2, { freq: 600, endFreq: 2200, volume: 0.1, q: 1.2 });
      tone(150, 0.18, { type: 'triangle', volume: 0.06, endFreq: 420 });
    },
    charge() {
      init();
      tone(80, 0.9, { type: 'sawtooth', volume: 0.025, endFreq: 300, cutoff: 1400 });
      noise(0.8, { freq: 300, endFreq: 2400, volume: 0.025, q: 2 });
    },
    ult() {
      init();
      tone(130, 0.65, { type: 'sawtooth', volume: 0.1, endFreq: 52, cutoff: 800 });
      noise(0.5, { freq: 500, endFreq: 3200, volume: 0.11, q: 0.7 });
    },
    beam() {
      init();
      noise(0.7, { freq: 2600, endFreq: 300, volume: 0.25, q: 0.6 });
      tone(180, 0.7, { type: 'sawtooth', volume: 0.1, endFreq: 65, cutoff: 1600 });
      tone(1200, 0.35, { type: 'sine', volume: 0.05, endFreq: 200 });
    },
    countdown(last = false) {
      init();
      tone(last ? 880 : 440, last ? 0.35 : 0.12, { type: 'triangle', volume: last ? 0.09 : 0.05, endFreq: last ? 1320 : 440 });
    },
    ko() {
      init();
      tone(90, 0.9, { type: 'sawtooth', volume: 0.12, endFreq: 34, cutoff: 700 });
      noise(0.9, { freq: 900, endFreq: 80, volume: 0.2, q: 0.5 });
    },
    victory() {
      init();
      [392, 523, 659, 784].forEach((f, i) => tone(f, 0.55, { type: 'triangle', volume: 0.07, delay: i * 0.13 }));
    },
    defeat() {
      init();
      [330, 277, 220, 165].forEach((f, i) => tone(f, 0.5, { type: 'sine', volume: 0.06, delay: i * 0.16 }));
    },

    startAmbience() {
      init();
      if (!ctx || ambience) return;
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.gain.setTargetAtTime(0.013, now(), 1.4);
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 240;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      osc1.type = 'sawtooth';
      osc2.type = 'sine';
      osc1.frequency.value = 55;
      osc2.frequency.value = 82.4;
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      osc1.start();
      osc2.start();
      ambience = { gain, osc1, osc2 };
    },
    stopAmbience() {
      if (!ctx || !ambience) return;
      const a = ambience;
      ambience = null;
      a.gain.gain.setTargetAtTime(0.0001, now(), 0.2);
      setTimeout(() => {
        try { a.osc1.stop(); a.osc2.stop(); } catch (e) { /* noop */ }
      }, 420);
    }
  };

  return api;
})();