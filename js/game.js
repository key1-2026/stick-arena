/* =========================================================
   STICK//ARENA — 流程、界面与对战系统
   ========================================================= */

const $ = id => document.getElementById(id);

const Input = {
  down: new Set(),
  pressed: new Set(),
  virtual: new Set(),
  init() {
    window.addEventListener('keydown', e => {
      const gameKeys = ['KeyA', 'KeyD', 'KeyJ', 'KeyK', 'KeyS', 'KeyU', 'KeyI', 'KeyO', 'KeyL', 'ShiftLeft', 'ShiftRight', 'ArrowLeft', 'ArrowRight'];
      if (gameKeys.includes(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
      GameAudio.init();
    });
    window.addEventListener('keyup', e => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
      this.pressed.clear();
      this.virtual.clear();
      if (typeof Game !== 'undefined' && Game.state === 'playing') Game.togglePause(true);
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) return;
      this.down.clear();
      this.pressed.clear();
      if (typeof Game !== 'undefined' && Game.state === 'playing') Game.togglePause(true);
    });
  },
  anyDown(codes) {
    return codes.some(c => this.down.has(c) || this.virtual.has(c));
  },
  anyPressed(codes) {
    return codes.some(c => this.pressed.has(c));
  },
  clear() {
    this.pressed.clear();
  }
};

/* =========================================================
   主菜单
   ========================================================= */

const Menu = {
  config: { char: 'warrior', map: 'lava', diff: 'normal', opp: 'random' },
  previewOpp: 'mage',
  time: 0,
  previewAccum: 0,
  fxAccum: 0,
  particles: [],
  fxW: 0,
  fxH: 0,
  avatarCanvases: [],

  init() {
    this.load();
    $('fighterDetail').open = !TouchControls.isMobileDevice();
    this.buildCharacters();
    this.buildMaps();
    this.buildDifficulties();
    this.buildOpponents();
    this.buildHelp();
    this.bind();
    this.resizeFx();
    this.update();
    this.tickPreview(0.016, true);
  },

  load() {
    try {
      const saved = JSON.parse(localStorage.getItem('stickArenaMenu') || 'null');
      if (saved && CHARACTERS[saved.char] && MAPS[saved.map] && DIFFICULTIES[saved.diff]) {
        this.config = Object.assign(this.config, saved);
        if (this.config.opp !== 'random' && !CHARACTERS[this.config.opp]) this.config.opp = 'random';
        if (this.config.opp === this.config.char) this.config.opp = 'random';
      }
    } catch (e) { /* noop */ }
  },

  save() {
    try { localStorage.setItem('stickArenaMenu', JSON.stringify(this.config)); } catch (e) { /* noop */ }
  },

  buildCharacters() {
    const grid = $('characterGrid');
    grid.innerHTML = '';
    this.avatarCanvases = [];
    CHAR_ORDER.forEach((key, i) => {
      const c = CHARACTERS[key];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'character-card';
      btn.dataset.char = key;
      btn.setAttribute('aria-label', c.name + ' · ' + c.title);
      btn.setAttribute('aria-pressed', 'false');
      btn.style.setProperty('--char-color', c.color);
      btn.style.setProperty('--char-color2', c.color2);
      btn.style.setProperty('--char-glow', U.hexA(c.color, .18));
      btn.style.setProperty('--char-glow-soft', U.hexA(c.color, .08));
      btn.innerHTML = `
        <span class="cc-copy">
          <span class="cc-index">${String(i + 1).padStart(2, '0')} / FIGHTER</span>
          <span class="cc-name">${c.name}</span>
          <span class="cc-en">${c.en}</span>
          <span class="cc-role">${c.role}</span>
        </span>
        <span class="cc-arrow">↗</span>
        <canvas class="cc-canvas" width="212" height="188"></canvas>
      `;
      grid.appendChild(btn);
      const canvas = btn.querySelector('canvas');
      Render.drawAvatar(canvas, key, i * 0.8);
      this.avatarCanvases.push({ canvas, key });
      btn.addEventListener('click', () => {
        GameAudio.ui();
        this.config.char = key;
        if (this.config.opp !== 'random' && this.config.opp === key) this.config.opp = 'random';
        this.updatePreviewOpp();
        this.update();
        this.save();
      });
      btn.addEventListener('mouseenter', () => GameAudio.hover());
    });
  },

  buildMaps() {
    const list = $('mapList');
    list.innerHTML = '';
    MAP_ORDER.forEach(key => {
      const m = MAPS[key];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'map-card';
      btn.dataset.map = key;
      btn.style.setProperty('--map-accent', m.accent);
      btn.innerHTML = `
        <span class="map-thumb"><canvas width="360" height="162"></canvas></span>
        <span class="map-name">${m.name}</span>
        <span class="map-en">${m.en}</span>
      `;
      list.appendChild(btn);

      const thumb = btn.querySelector('canvas');
      const off = document.createElement('canvas');
      off.width = 1600;
      off.height = 900;
      const octx = off.getContext('2d');
      Render.drawMap(octx, key, 0.3);
      const ctx = thumb.getContext('2d');
      ctx.drawImage(off, 0, 0, 1600, 900, 0, 0, thumb.width, thumb.height);
      ctx.fillStyle = 'rgba(3,6,10,.18)';
      ctx.fillRect(0, 0, thumb.width, thumb.height);

      btn.addEventListener('click', () => {
        GameAudio.ui();
        this.config.map = key;
        this.update();
        this.save();
      });
      btn.addEventListener('mouseenter', () => GameAudio.hover());
    });
  },

  buildDifficulties() {
    const list = $('difficultyList');
    list.innerHTML = '';
    DIFF_ORDER.forEach(key => {
      const d = DIFFICULTIES[key];
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'diff-btn';
      btn.dataset.diff = key;
      btn.style.setProperty('--diff-color', d.color);
      btn.innerHTML = `
        <span class="diff-name">${d.name}</span>
        <span class="diff-bars">${[1, 2, 3, 4].map(i => `<i class="${i <= d.bars ? 'on' : ''}"></i>`).join('')}</span>
      `;
      btn.addEventListener('click', () => {
        GameAudio.ui();
        this.config.diff = key;
        this.update();
        this.save();
      });
      btn.addEventListener('mouseenter', () => GameAudio.hover());
      list.appendChild(btn);
    });
  },

  buildOpponents() {
    const list = $('opponentList');
    list.innerHTML = '';
    const entries = [{ key: 'random', name: '随机', en: 'RANDOM', color: '#b9c4ce', mark: '?' }]
      .concat(CHAR_ORDER.map(key => ({
        key, name: CHARACTERS[key].name, en: CHARACTERS[key].en,
        color: CHARACTERS[key].color, mark: CHARACTERS[key].name[0]
      })));
    entries.forEach(en => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'opp-btn';
      btn.dataset.opp = en.key;
      btn.style.setProperty('--opp-color', en.color);
      btn.innerHTML = `<span class="opp-mark">${en.mark}</span><span>${en.name}</span><small>${en.en}</small>`;
      btn.addEventListener('click', () => {
        GameAudio.ui();
        this.config.opp = en.key;
        this.updatePreviewOpp();
        this.update();
        this.save();
      });
      btn.addEventListener('mouseenter', () => GameAudio.hover());
      list.appendChild(btn);
    });
  },

  buildHelp() {
    const wrap = $('helpRoster');
    wrap.innerHTML = CHAR_ORDER.map(key => {
      const c = CHARACTERS[key];
      const skills = c.skills.map(s => `<li><i>${s.key}</i><b>${s.name}</b> · ${s.desc}</li>`).join('');
      return `<div class="help-char" style="--hc:${c.color}">
        <div class="help-char-head"><b>${c.name}</b><small>${c.en}</small></div>
        <ul>
          <li><i>J</i><b>${c.basicName}</b> · 普攻三段</li>
          ${skills}
          <li><i>L</i><b>${c.ult.name}</b> · 终极技能</li>
        </ul>
      </div>`;
    }).join('');
  },

  bind() {
    $('startBtn').addEventListener('click', () => {
      GameAudio.init();
      GameAudio.ui();
      Game.startMatch(this.config);
    });
    $('trainingBtn').addEventListener('click', () => {
      GameAudio.init();
      GameAudio.ui();
      Game.startTraining(this.config);
    });
    $('trainingResetBtn').addEventListener('click', () => {
      GameAudio.ui();
      Game.resetTraining();
    });
    $('trainingExitBtn').addEventListener('click', () => {
      GameAudio.ui();
      Game.showMenu();
    });
    $('trainingToggleBtn').addEventListener('click', () => {
      GameAudio.ui();
      $('trainingBar').classList.toggle('collapsed');
      const collapsed = $('trainingBar').classList.contains('collapsed');
      $('trainingToggleBtn').textContent = collapsed ? '展开' : '收起';
    });
    $('trainingSparBtn').addEventListener('click', () => {
      if (!Game.training) return;
      GameAudio.ui();
      Game.trainingSparring = !Game.trainingSparring;
      Game.trainingAttackTimer = 1.1;
      Game.updateTrainingSparBtn();
      Game.toast(
        Game.trainingSparring ? '木桩反击已开启 · 练习格挡与闪避' : '木桩反击已关闭',
        Game.trainingSparring ? '#ff9b8f' : '#75e7ac',
        1.8
      );
    });
    $('orientationBtn').addEventListener('click', () => {
      GameAudio.init();
      GameAudio.ui();
      Game.enterLandscape();
    });
    $('installBtn').addEventListener('click', () => Game.promptInstall());
    $('installClose').addEventListener('click', () => {
      $('installOverlay').hidden = true;
      try { localStorage.setItem('stickArenaInstallDismissed', '1'); } catch (e) { /* noop */ }
    });
    $('installDoneBtn').addEventListener('click', () => {
      $('installOverlay').hidden = true;
      try { localStorage.setItem('stickArenaInstallDismissed', '1'); } catch (e) { /* noop */ }
    });
    $('quickStartBtn').addEventListener('click', () => {
      GameAudio.init();
      GameAudio.ui();
      Game.startMatch(this.config);
    });
    $('helpBtn').addEventListener('click', () => this.openHelp());
    $('helpClose').addEventListener('click', () => this.closeHelp());
    $('helpOverlay').addEventListener('click', e => {
      if (e.target === $('helpOverlay')) this.closeHelp();
    });
    const helpCard = document.querySelector('.help-card');
    const helpCollapseBtn = $('helpCollapseBtn');
    const applyHelpCollapsed = collapsed => {
      if (!helpCard || !helpCollapseBtn) return;
      helpCard.classList.toggle('collapsed', collapsed);
      helpCollapseBtn.textContent = collapsed ? '展开说明' : '收起说明';
      helpCollapseBtn.setAttribute('aria-expanded', String(!collapsed));
    };
    try { applyHelpCollapsed(localStorage.getItem('stickArenaHelpCollapsed') === '1'); } catch (e) { /* noop */ }
    if (helpCollapseBtn) {
      helpCollapseBtn.addEventListener('click', () => {
        const collapsed = !helpCard.classList.contains('collapsed');
        applyHelpCollapsed(collapsed);
        try { localStorage.setItem('stickArenaHelpCollapsed', collapsed ? '1' : '0'); } catch (e) { /* noop */ }
      });
    }
    $('muteBtn').addEventListener('click', () => Game.toggleMute());
    $('muteGameBtn').addEventListener('click', () => Game.toggleMute());
    $('fsBtn').addEventListener('click', () => Game.toggleFullscreen());
    document.addEventListener('fullscreenchange', () => {
      Game.updateFullscreenUI();
      Game.resize();
    });
    $('pauseBtn').addEventListener('click', () => Game.togglePause());
    $('resumeBtn').addEventListener('click', () => Game.togglePause(false));
    $('layoutSaveBtn').addEventListener('click', () => { GameAudio.ui(); Game.closeTouchLayout(true); });
    $('layoutCancelBtn').addEventListener('click', () => { GameAudio.ui(); Game.closeTouchLayout(false); });
    $('layoutCloseBtn').addEventListener('click', () => { GameAudio.ui(); Game.closeTouchLayout(false); });
    $('layoutCollapseBtn').addEventListener('click', () => { GameAudio.ui(); Game.toggleTouchLayoutPanel(); });
    $('layoutResetBtn').addEventListener('click', () => { GameAudio.ui(); Game.resetTouchLayout(); });
    $('restartBtn').addEventListener('click', () => { GameAudio.ui(); Game.restartCurrent(); });
    $('quitBtn').addEventListener('click', () => { GameAudio.ui(); Game.showMenu(); });
    $('rematchBtn').addEventListener('click', () => { GameAudio.ui(); Game.restartCurrent(); });
    $('backMenuBtn').addEventListener('click', () => { GameAudio.ui(); Game.showMenu(); });

    window.addEventListener('resize', () => {
      this.resizeFx();
      Game.resize();
    });
    window.addEventListener('keydown', e => {
      const focusedControl = e.target && typeof e.target.closest === 'function' &&
        e.target.closest('button, a, summary, input, select, textarea, [contenteditable="true"]');
      if (e.code === 'Escape') {
        if (!$('helpOverlay').hidden) { this.closeHelp(); return; }
        if (!$('layoutOverlay').hidden) { Game.closeTouchLayout(false); return; }
        if (Game.state === 'playing' || Game.state === 'paused') Game.togglePause();
      }
      if (e.code === 'KeyF' && !e.repeat) {
        e.preventDefault();
        Game.toggleFullscreen();
      }
      if ((e.key === '?' || (e.shiftKey && e.code === 'Slash')) && Game.state === 'menu' && $('helpOverlay').hidden) {
        this.openHelp();
      }
      if (e.code === 'Enter' && !focusedControl && Game.state === 'menu' && $('helpOverlay').hidden) {
        Game.startMatch(this.config);
      }
      if (e.code === 'KeyT' && Game.state === 'menu' && $('helpOverlay').hidden) {
        e.preventDefault();
        Game.startTraining(this.config);
      }
    });
  },

  openHelp() {
    GameAudio.init();
    GameAudio.ui();
    $('helpOverlay').hidden = false;
    if (Game.state === 'playing') Game.togglePause(true);
  },

  closeHelp() {
    GameAudio.ui();
    $('helpOverlay').hidden = true;
  },

  updatePreviewOpp() {
    if (this.config.opp !== 'random') {
      this.previewOpp = this.config.opp;
    } else {
      const pool = CHAR_ORDER.filter(k => k !== this.config.char);
      this.previewOpp = U.choice(pool);
    }
  },

  update() {
    const c = CHARACTERS[this.config.char];
    const map = MAPS[this.config.map];
    const diff = DIFFICULTIES[this.config.diff];
    if (this.config.opp !== 'random') this.previewOpp = this.config.opp;
    else if (this.previewOpp === this.config.char) this.updatePreviewOpp();
    const opp = CHARACTERS[this.previewOpp];

    document.querySelectorAll('.character-card').forEach(el => {
      const active = el.dataset.char === this.config.char;
      el.classList.toggle('active', active);
      el.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    document.querySelectorAll('.map-card').forEach(el => {
      el.classList.toggle('active', el.dataset.map === this.config.map);
    });
    document.querySelectorAll('.diff-btn').forEach(el => {
      el.classList.toggle('active', el.dataset.diff === this.config.diff);
    });
    document.querySelectorAll('.opp-btn').forEach(el => {
      el.classList.toggle('active', el.dataset.opp === this.config.opp);
    });

    $('detailRole').textContent = c.role;
    $('detailName').innerHTML = `${c.name} <small>${c.en}</small>`;
    $('detailDiff').textContent = c.difficulty;
    $('detailDesc').textContent = c.desc;
    $('statList').innerHTML = [
      ['攻击', c.stats.atk], ['防御', c.stats.def], ['机动', c.stats.mob]
    ].map(([label, value]) => `
      <div class="stat-row"><span>${label}</span><div class="stat-track"><i style="width:${Math.min(100, value)}%"></i></div><b>${value}</b></div>
    `).join('');
    $('basicName').textContent = c.basicName;
    $('basicHint').textContent = c.basicHint;
    $('detailSkills').innerHTML = c.skills.map(s => `
      <span class="detail-skill" style="--skill-c:${s.color}"><i>${s.key}</i><b>${s.name}</b><small>${s.cd}s</small></span>
    `).join('') + `
      <span class="detail-skill ultimate" style="--skill-c:${c.ult.color}"><i>L</i><b>${c.ult.name}</b><small>充能</small></span>
    `;
    document.documentElement.style.setProperty('--selected-color', c.color);

    $('previewMapName').textContent = map.name;
    $('previewMapEn').textContent = map.en;
    $('previewP1').textContent = c.name;
    $('previewP2').textContent = this.config.opp === 'random' ? `随机 · ${opp.name}` : opp.name;
    $('previewDiff').textContent = `CPU · ${diff.name}`;
    $('mapDesc').textContent = map.desc;
    $('difficultyTag').textContent = diff.name;
    $('difficultyDesc').textContent = diff.desc;
    $('selectedSummary').innerHTML = `<span class="ss-label">YOUR LOADOUT</span><span class="ss-main">${c.name} <i>VS</i> ${this.config.opp === 'random' ? '随机' : opp.name}</span>`;
    $('previewCanvas').parentElement.style.setProperty('--selected-color', c.color);

    const faviconColor = c.color;
    document.documentElement.style.setProperty('--accent', faviconColor);
  },

  tickPreview(dt) {
    if ($('menuScreen').style.display === 'none') return;
    this.time += dt;
    this.tickFx(dt);
    this.drawPreview();
  },

  drawPreview() {
    const canvas = $('previewCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const c = CHARACTERS[this.config.char];
    const opp = CHARACTERS[this.previewOpp];
    const t = this.time;
    Render.drawMap(ctx, this.config.map, t);

    const dummy = (data, x, facing, energy, phase) => ({
      data, x, y: WORLD.ground, facing, vx: 0, vy: 0, onGround: true,
      animTime: t + phase, action: null, energy, hitstun: 0, statuses: [],
      hitFlash: 0, hurtTimer: 0, dead: false, muzzle: 0
    });
    const p1 = dummy(c, 508, 1, 0, 0);
    const p2 = dummy(opp, 1092, -1, 0, 2.2);
    Render.drawShadow(ctx, p1);
    Render.drawShadow(ctx, p2);
    Render.drawFighter(ctx, p1, t);
    Render.drawFighter(ctx, p2, t);

    // 前景微光
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(800, 640, 20, 800, 640, 450);
    glow.addColorStop(0, U.hexA(c.color, .05));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 300, 1600, 600);
    ctx.restore();
  },

  tickFx(dt) {
    const canvas = $('menuFx');
    if (!canvas || !this.fxW) return;
    this.fxAccum += dt;
    if (this.fxAccum < 1 / 30) return;
    const step = this.fxAccum;
    this.fxAccum = 0;
    this.time += 0;
    const ctx = canvas.getContext('2d');
    const accent = MAPS[this.config.map].accent;
    Render.drawMenuFx(ctx, this.fxW, this.fxH, this.time, accent, this.particles);
    this.particles.forEach(p => {
      p.y -= p.sp * step;
      if (p.y < -30) { p.y = this.fxH + 20; p.x = Math.random() * this.fxW; }
    });
  },

  resizeFx() {
    const canvas = $('menuFx');
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.fxW = window.innerWidth;
    this.fxH = window.innerHeight;
    canvas.width = Math.floor(this.fxW * dpr);
    canvas.height = Math.floor(this.fxH * dpr);
    canvas.style.width = this.fxW + 'px';
    canvas.style.height = this.fxH + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (!this.particles.length) {
      this.particles = Array.from({ length: 42 }, () => ({
        x: Math.random() * this.fxW,
        y: Math.random() * this.fxH,
        size: U.rand(.7, 2.2),
        ph: U.rand(0, 10),
        sway: U.rand(8, 38),
        sp: U.rand(3, 15)
      }));
    }
  },

  refresh() {
    this.update();
    this.drawPreview();
  }
};

/* =========================================================
   手机触屏控制
   ========================================================= */

const TouchControls = {
  root: null,
  pauseBtn: null,
  muteBtn: null,
  fsBtn: null,
  layoutBtn: null,
  stick: null,
  buttons: [],
  layoutItems: [],
  skillBtns: [],
  ultBtn: null,
  active: new Map(),
  sig: '',
  layout: null,
  prevLayout: null,
  layoutEditing: false,
  stickPointer: null,
  stickDir: null,
  layoutDrag: null,

  isMobileDevice() {
    const ua = navigator.userAgent || '';
    const points = navigator.maxTouchPoints || 0;
    const iPad = /Macintosh/i.test(ua) && points > 1;
    if (iPad || /Android|iPhone|iPad|iPod/i.test(ua)) return true;
    // 触屏电脑仍采用键盘界面；屏幕窄或支持触摸不代表手机。
    if (/Windows NT|CrOS|X11|Macintosh/i.test(ua)) return false;
    if (navigator.userAgentData && navigator.userAgentData.mobile) return true;
    return points > 0 && (!ua || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches));
  },

  init() {
    this.root = $('touchControls');
    if (!this.root) return;
    this.pauseBtn = $('touchPauseBtn');
    this.muteBtn = $('touchMuteBtn');
    this.fsBtn = $('touchFsBtn');
    this.layoutBtn = $('touchLayoutBtn');
    this.stick = $('touchStick');
    this.buttons = Array.from(this.root.querySelectorAll('[data-touch]'));
    this.buttons.forEach(btn => {
      const label = document.createElement('span');
      label.className = 'tb-label';
      label.textContent = { KeyS: '格挡', ShiftLeft: '闪避', KeyK: '跳跃', KeyJ: '普攻' }[btn.dataset.touch] || '技能';
      btn.appendChild(label);
    });
    this.layoutItems = Array.from(this.root.querySelectorAll('[data-layout]'));
    this.skillBtns = Array.from(this.root.querySelectorAll('.touch-skill'));
    this.ultBtn = this.root.querySelector('.touch-ult');
    this.blockBtn = this.root.querySelector('.touch-block');
    this.dodgeBtn = this.root.querySelector('.touch-dodge');
    this.blockGuardFill = this.blockBtn ? this.blockBtn.querySelector('.tb-guard i') : null;

    this.loadLayout();
    this.buttons.forEach(btn => this.bind(btn));
    this.bindStick();
    this.bindLayoutDrag();
    if (this.layout) this.applyLayout(this.layout);
    if (this.pauseBtn) {
      this.pauseBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (Game.state === 'playing' || Game.state === 'paused') {
          GameAudio.ui();
          Game.togglePause();
        }
      });
    }
    if (this.muteBtn) {
      this.muteBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (Game.state === 'playing' || Game.state === 'paused') {
          Game.toggleMute();
          GameAudio.ui();
        }
      });
    }
    if (this.fsBtn) {
      // iOS 等不支持元素全屏的浏览器直接隐藏按钮，避免无意义点击。
      if (!document.documentElement.requestFullscreen) this.fsBtn.style.display = 'none';
      this.fsBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (Game.state === 'playing' || Game.state === 'paused') {
          GameAudio.ui();
          Game.toggleFullscreen();
        }
      });
    }
    if (this.layoutBtn) {
      this.layoutBtn.addEventListener('pointerdown', e => {
        e.preventDefault();
        if (Game.state === 'playing' || Game.state === 'paused') {
          GameAudio.ui();
          Game.openTouchLayout();
        }
      });
    }

    const touch = this.isMobileDevice();
    document.body.classList.toggle('touch-device', touch);

    window.addEventListener('touchstart', () => {
      if (!this.isMobileDevice()) return;
      document.body.classList.add('touch-device');
      if (Game.state === 'playing' || Game.state === 'paused') this.setEnabled(true);
    }, { once: true, passive: true });

    window.addEventListener('pointerup', e => { this.releasePointer(e.pointerId); this.releaseStick(e.pointerId); });
    window.addEventListener('pointercancel', e => { this.releasePointer(e.pointerId); this.releaseStick(e.pointerId); });
    window.addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.releaseAll();
    });
    this.root.addEventListener('contextmenu', e => e.preventDefault());
  },

  bind(btn) {
    const code = btn.dataset.touch;
    btn.addEventListener('pointerdown', e => {
      if (this.layoutEditing) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (Game.state !== 'playing') return;
      if (this.active.has(e.pointerId)) return;
      e.preventDefault();
      GameAudio.init();
      if (navigator.vibrate) { try { navigator.vibrate(7); } catch (err) { /* noop */ } }
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      this.active.set(e.pointerId, { btn, code });
      btn.classList.add('active');
      Input.down.add(code);
      Input.pressed.add(code);
    });
    btn.addEventListener('lostpointercapture', e => this.releasePointer(e.pointerId));
  },

  bindStick() {
    if (!this.stick) return;
    this.stick.addEventListener('pointerdown', e => {
      if (this.layoutEditing) return;
      if (Game.state !== 'playing') return;
      if (this.stickPointer !== null) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      e.preventDefault();
      GameAudio.init();
      if (navigator.vibrate) { try { navigator.vibrate(4); } catch (err) { /* noop */ } }
      this.stickPointer = e.pointerId;
      try { this.stick.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      this.stick.classList.add('active');
      this.updateStick(e);
    });
    this.stick.addEventListener('pointermove', e => {
      if (e.pointerId !== this.stickPointer) return;
      e.preventDefault();
      this.updateStick(e);
    });
    this.stick.addEventListener('pointerup', e => this.releaseStick(e.pointerId));
    this.stick.addEventListener('pointercancel', e => this.releaseStick(e.pointerId));
  },

  updateStick(e) {
    if (!this.stick) return;
    const b = this.stick.getBoundingClientRect();
    if (!b.width) return;
    const cx = b.left + b.width / 2;
    let dx = (e.clientX - cx) / (b.width * .34);
    dx = U.clamp(dx, -1, 1);
    const deadzone = .18;
    const dir = dx < -deadzone ? 'KeyA' : dx > deadzone ? 'KeyD' : null;
    if (dir !== this.stickDir) {
      if (this.stickDir) Input.virtual.delete(this.stickDir);
      if (dir) Input.virtual.add(dir);
      this.stickDir = dir;
    }
    this.stick.style.setProperty('--sx', (dx * b.width * .19).toFixed(1) + 'px');
    this.stick.classList.toggle('active', Math.abs(dx) > .05);
  },

  releaseStick(id = null) {
    if (this.stickPointer === null || (id !== null && id !== this.stickPointer)) return;
    if (this.stickDir) Input.virtual.delete(this.stickDir);
    this.stickDir = null;
    this.stickPointer = null;
    if (this.stick) {
      this.stick.classList.remove('active');
      this.stick.style.setProperty('--sx', '0px');
    }
  },

  loadLayout() {
    try {
      const saved = JSON.parse(localStorage.getItem('stickArenaTouchLayout') || 'null');
      if (!saved || !saved.controls) return;
      const keys = ['stick', 'block', 'dodge', 'skill0', 'skill1', 'skill2', 'jump', 'ult', 'attack'];
      const clean = {};
      for (const key of keys) {
        const p = saved.controls[key];
        if (!Array.isArray(p) || p.length < 2) return;
        const x = Number(p[0]), y = Number(p[1]);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;
        clean[key] = [U.clamp(x, 3, 97), U.clamp(y, 4, 96)];
      }
      this.layout = clean;
    } catch (e) { /* 无效的旧布局直接忽略 */ }
  },

  capturePositions() {
    if (!this.root) return null;
    const rect = this.root.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    const out = {};
    this.layoutItems.forEach(el => {
      const key = el.dataset.layout;
      if (!key) return;
      const b = el.getBoundingClientRect();
      if (!b.width && !b.height) return;
      out[key] = [
        Math.round(U.clamp((b.left + b.width / 2 - rect.left) / rect.width * 100, 3, 97) * 100) / 100,
        Math.round(U.clamp((b.top + b.height / 2 - rect.top) / rect.height * 100, 4, 96) * 100) / 100
      ];
    });
    return Object.keys(out).length ? out : null;
  },

  applyLayout(layout) {
    if (!this.root) return;
    if (!layout) {
      this.root.classList.remove('custom-layout');
      this.layoutItems.forEach(el => {
        el.style.removeProperty('--lx');
        el.style.removeProperty('--ly');
      });
      return;
    }
    this.root.classList.add('custom-layout');
    this.layoutItems.forEach(el => {
      const p = layout[el.dataset.layout];
      if (!p) return;
      el.style.setProperty('--lx', Number(p[0]).toFixed(2));
      el.style.setProperty('--ly', Number(p[1]).toFixed(2));
    });
  },

  layoutHasConflict() {
    const root = this.root.getBoundingClientRect();
    if (!root.width || !root.height) return false;
    const items = this.layoutItems.concat([this.pauseBtn, this.muteBtn, this.fsBtn, this.layoutBtn].filter(Boolean));
    const boxes = items.map(el => el.getBoundingClientRect()).filter(b => b.width && b.height);
    const gap = 6;
    for (let i = 0; i < boxes.length; i++) {
      const a = boxes[i];
      if (a.left < root.left || a.top < root.top || a.right > root.right || a.bottom > root.bottom) return true;
      for (let j = i + 1; j < boxes.length; j++) {
        const b = boxes[j];
        if (a.left < b.right + gap && a.right + gap > b.left && a.top < b.bottom + gap && a.bottom + gap > b.top) return true;
      }
    }
    return false;
  },

  validateLayout() {
    if (this.layout && !this.layoutEditing && this.layoutHasConflict()) {
      // 旧布局位置仍保留在本地；当前屏幕用互不重叠的默认网格。
      this.layout = null;
      this.applyLayout(null);
    }
  },

  beginLayoutEdit() {
    if (!this.root) return;
    this.prevLayout = this.layout ? JSON.parse(JSON.stringify(this.layout)) : null;
    this.layoutEditing = true;
    this.root.classList.add('on', 'layout-editing');
    if (!this.layout) {
      this.root.classList.remove('custom-layout');
      this.layoutItems.forEach(el => {
        el.style.removeProperty('--lx');
        el.style.removeProperty('--ly');
      });
      const captured = this.capturePositions();
      if (captured) this.layout = captured;
    }
    if (this.layout) this.applyLayout(this.layout);
  },

  endLayoutEdit() {
    if (!this.root) return;
    this.layoutEditing = false;
    this.root.classList.remove('layout-editing');
    if (this.layout) this.applyLayout(this.layout);
    else this.applyLayout(null);
    this.prevLayout = null;
    this.releaseStick();
  },

  saveLayout() {
    if (!this.layout) return;
    try {
      localStorage.setItem('stickArenaTouchLayout', JSON.stringify({
        version: 1,
        controls: this.layout
      }));
    } catch (e) { /* 隐私模式可能禁用存储 */ }
    this.endLayoutEdit();
  },

  cancelLayoutEdit() {
    this.layout = this.prevLayout ? JSON.parse(JSON.stringify(this.prevLayout)) : null;
    this.endLayoutEdit();
  },

  resetLayout() {
    try { localStorage.removeItem('stickArenaTouchLayout'); } catch (e) { /* noop */ }
    this.layout = null;
    if (!this.root) return;
    this.root.classList.remove('custom-layout');
    this.layoutItems.forEach(el => {
      el.style.removeProperty('--lx');
      el.style.removeProperty('--ly');
    });
    const captured = this.capturePositions();
    if (captured) {
      this.layout = captured;
      this.applyLayout(this.layout);
    }
  },

  bindLayoutDrag() {
    this.layoutItems.forEach(el => {
      el.addEventListener('pointerdown', e => {
        if (!this.layoutEditing) return;
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const key = el.dataset.layout;
        if (!key || !this.layout) return;
        e.preventDefault();
        e.stopPropagation();
        const rect = this.root.getBoundingClientRect();
        const b = el.getBoundingClientRect();
        const offsetX = e.clientX - (b.left + b.width / 2);
        const offsetY = e.clientY - (b.top + b.height / 2);
        el.classList.add('dragging');
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
        const move = ev => {
          if (ev.pointerId !== e.pointerId) return;
          ev.preventDefault();
          const x = (ev.clientX - offsetX - rect.left) / Math.max(1, rect.width) * 100;
          const y = (ev.clientY - offsetY - rect.top) / Math.max(1, rect.height) * 100;
          const previous = this.layout[key].slice();
          this.layout[key] = [
            Math.round(U.clamp(x, 3, 97) * 100) / 100,
            Math.round(U.clamp(y, 4, 96) * 100) / 100
          ];
          this.applyLayout(this.layout);
          if (this.layoutHasConflict()) {
            this.layout[key] = previous;
            this.applyLayout(this.layout);
          }
        };
        const finish = ev => {
          if (ev.pointerId !== e.pointerId) return;
          el.classList.remove('dragging');
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', finish);
          el.removeEventListener('pointercancel', finish);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', finish);
        el.addEventListener('pointercancel', finish);
      });
    });
  },

  releasePointer(id) {
    const rec = this.active.get(id);
    if (!rec) return;
    this.active.delete(id);
    rec.btn.classList.remove('active');
    if (!Array.from(this.active.values()).some(r => r.code === rec.code)) {
      Input.down.delete(rec.code);
    }
  },

  releaseAll() {
    this.releaseStick();
    Input.virtual.clear();
    const codes = new Set();
    this.active.forEach(rec => {
      rec.btn.classList.remove('active');
      codes.add(rec.code);
    });
    this.active.clear();
    codes.forEach(code => Input.down.delete(code));
    this.buttons.forEach(btn => {
      btn.classList.remove('active');
      Input.down.delete(btn.dataset.touch);
    });
  },

  setEnabled(on) {
    if (!this.root) return;
    this.root.classList.toggle('on', !!on);
    if (on) this.validateLayout();
    if (!on) {
      this.releaseAll();
      this.setPaused(false);
    }
  },

  setPaused(paused) {
    if (!this.root) return;
    this.root.classList.toggle('paused', !!paused);
    if (!paused) this.validateLayout();
    if (this.pauseBtn) {
      this.pauseBtn.textContent = paused ? '继续' : '暂停';
      this.pauseBtn.setAttribute('aria-label', paused ? '继续战斗' : '暂停');
    }
  },

  sync(data) {
    if (!this.root || !data) return;
    this.skillBtns.forEach((btn, i) => {
      const skill = data.skills[i];
      if (!skill) return;
      btn.style.setProperty('--tb-color', skill.color || data.color);
      btn.dataset.cd = skill.cd;
      const glyph = btn.querySelector('.tb-glyph');
      if (glyph) glyph.textContent = skill.glyph;
      const label = btn.querySelector('.tb-label');
      if (label) label.textContent = skill.name;
      btn.setAttribute('aria-label', `${skill.key} ${skill.name}`);
    });
    if (this.ultBtn && data.ult) {
      this.ultBtn.style.setProperty('--tb-color', data.ult.color || data.color2);
      const glyph = this.ultBtn.querySelector('.tb-glyph');
      if (glyph) glyph.textContent = data.ult.glyph || '终';
      const label = this.ultBtn.querySelector('.tb-label');
      if (label) label.textContent = data.ult.name;
      this.ultBtn.setAttribute('aria-label', `L ${data.ult.name}`);
    }
    this.sig = '';
  },

  update(p) {
    if (!this.root || !p) return;
    const touch = document.body.classList.contains('touch-device') ||
      window.innerWidth <= 900 ||
      (window.matchMedia && window.matchMedia('(any-pointer: coarse)').matches);
    if (!touch) return;
    const sig = p.cooldowns.map(c => c.toFixed(1)).join('|') +
      '|' + Math.floor(p.energy) + '|' + (p.energy >= 100 ? 1 : 0) +
      '|' + Math.round(p.guardMeter) + '|' + (p.guardBreak > 0 ? 1 : 0) +
      '|' + p.dodgeCd.toFixed(1) + '|' + (p.blocking ? 1 : 0);
    if (sig === this.sig) return;
    this.sig = sig;

    this.skillBtns.forEach((btn, i) => {
      const cd = p.cooldowns[i] || 0;
      const cooling = cd > .02;
      btn.classList.toggle('cooling', cooling);
      btn.classList.toggle('ready', !cooling);
      const cdEl = btn.querySelector('.tb-cd');
      if (cdEl) cdEl.textContent = cooling ? (cd >= 1 ? Math.ceil(cd) : cd.toFixed(1)) : '';
    });

    if (this.ultBtn) {
      const ready = p.energy >= 100;
      this.ultBtn.classList.toggle('ready', ready);
      this.ultBtn.classList.toggle('cooling', !ready);
      const cdEl = this.ultBtn.querySelector('.tb-cd');
      if (cdEl) cdEl.textContent = ready ? '' : Math.round(p.energy) + '%';
    }

    if (this.blockBtn) {
      const broken = p.guardBreak > 0 || p.guardMeter <= 0;
      this.blockBtn.classList.toggle('depleted', broken);
      this.blockBtn.classList.toggle('guarding', !!p.blocking);
      if (this.blockGuardFill) {
        this.blockGuardFill.style.width = U.clamp(p.guardMeter / GAME_RULES.guardMax, 0, 1) * 100 + '%';
      }
    }

    if (this.dodgeBtn) {
      const cooling = p.dodgeCd > .02;
      this.dodgeBtn.classList.toggle('cooling', cooling);
      const cdEl = this.dodgeBtn.querySelector('.tb-cd');
      if (cdEl) cdEl.textContent = cooling ? (p.dodgeCd >= 1 ? Math.ceil(p.dodgeCd) : p.dodgeCd.toFixed(1)) : '';
    }
  }
};

/* =========================================================
   游戏主控
   ========================================================= */

const Game = {
  state: 'menu',
  config: null,
  player: null,
  enemy: null,
  projectiles: [],
  zones: [],
  effects: [],
  particles: [],
  floaters: [],
  worldTime: 0,
  timeLeft: GAME_RULES.duration,
  introTime: 0,
  introStep: -1,
  endTimer: 0,
  endReason: '',
  endWinner: 'draw',
  hitstop: 0,
  shake: 0,
  flashAlpha: 0,
  flashColor: '#fff',
  announceTimer: 0,
  toastTimer: 0,
  hitVignette: 0,
  comboCount: 0,
  comboTimer: 0,
  hudLag1: 0,
  hudLag2: 0,
  lastBeep: 99,
  skillCards: [],
  buffSig1: '',
  buffSig2: '',
  lastHitSound: 0,
  resultShown: false,
  training: false,
  trainingSparring: false,
  trainingAttackTimer: 2.2,
  trainingTasks: null,
  trainingSignature: '',
  installPrompt: null,
  orientationPaused: false,
  lastTime: null,
  simulationAccum: 0,

  init() {
    this.canvas = $('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.pauseOverlay = $('pauseOverlay');
    this.resultOverlay = $('resultOverlay');
    this.announceEl = $('announce');
    this.toastEl = $('statusToast');
    this.comboEl = $('comboBadge');
    this.flashEl = $('screenFlash');
    this.vignetteEl = $('hitVignette');
    Input.init();
    TouchControls.init();
    TouchControls.setEnabled(false);
    Menu.init();
    this.initKeyboardGuide();
    this.resize();
    this.loadMute();
    this.updateMuteUI();
    this.updateFullscreenUI();
    this.armMusic();
    this.initInstall();
    this.updateOrientation();
    window.addEventListener('orientationchange', () => setTimeout(() => this.updateOrientation(), 180));
    window.addEventListener('resize', () => this.updateOrientation());
    document.addEventListener('fullscreenchange', () => this.updateOrientation());
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  },

  initKeyboardGuide() {
    let collapsed = false;
    try { collapsed = localStorage.getItem('stickArenaKeyboardGuideCollapsed') === '1'; } catch (e) { /* 存储不可用时使用默认展开状态 */ }
    this.setKeyboardGuideCollapsed(collapsed, false);
    $('keyboardGuideToggle').addEventListener('click', () => {
      this.setKeyboardGuideCollapsed(!$('keyboardGuide').classList.contains('collapsed'));
    });
  },

  setKeyboardGuideCollapsed(collapsed, save = true) {
    $('keyboardGuide').classList.toggle('collapsed', collapsed);
    $('keyboardGuideContent').hidden = collapsed;
    $('keyboardGuideToggle').textContent = collapsed ? '展开' : '收起';
    $('keyboardGuideToggle').setAttribute('aria-expanded', String(!collapsed));
    if (save) {
      try { localStorage.setItem('stickArenaKeyboardGuideCollapsed', collapsed ? '1' : '0'); } catch (e) { /* 当前会话仍可正常收起和展开 */ }
    }
  },

  initInstall() {
    try {
      const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
      document.body.classList.toggle('standalone-app', standalone);
    } catch (e) { /* noop */ }
    window.addEventListener('beforeinstallprompt', e => {
      e.preventDefault();
      this.installPrompt = e;
      const btn = $('installBtn');
      if (btn) btn.hidden = false;
    });
    window.addEventListener('appinstalled', () => {
      this.installPrompt = null;
      const btn = $('installBtn');
      if (btn) btn.hidden = true;
      this.toast('已安装到手机 · 从桌面启动', '#75e7ac', 2.2);
    });
    const touch = TouchControls.isMobileDevice();
    const standalone = document.body.classList.contains('standalone-app');
    if (touch && !standalone) {
      const btn = $('installBtn');
      if (btn) btn.hidden = false;
    }
    if ('serviceWorker' in navigator && navigator.serviceWorker && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(() => { /* 离线能力不可用时不影响游戏 */ });
    }
  },

  promptInstall() {
    GameAudio.init();
    GameAudio.ui();
    if (this.installPrompt) {
      const prompt = this.installPrompt;
      this.installPrompt = null;
      prompt.prompt();
      prompt.userChoice.then(choice => {
        if (choice && choice.outcome === 'accepted') {
          $('installBtn').hidden = true;
          this.toast('正在安装手机版…', '#75e7ac', 1.8);
        }
      }).catch(() => { /* noop */ });
      return;
    }
    $('installOverlay').hidden = false;
  },

  enterLandscape() {
    const go = async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch (e) { /* 浏览器可能要求用户手势，按钮点击已提供 */ }
      try {
        if (screen.orientation && screen.orientation.lock) {
          await screen.orientation.lock('landscape');
        }
      } catch (e) { /* iOS / 桌面浏览器通常不支持方向锁定 */ }
      this.updateOrientation();
    };
    go();
  },

  updateOrientation() {
    const touch = TouchControls.isMobileDevice();
    const portrait = window.innerHeight > window.innerWidth;
    document.body.classList.toggle('is-landscape', touch && !portrait);
    document.body.classList.toggle('is-portrait', touch && portrait);
    const overlay = $('orientationOverlay');
    if (!overlay) return;
    const gameVisible = $('gameScreen') && !$('gameScreen').hidden;
    const show = touch && portrait && gameVisible;
    if (show) {
      if (overlay.hidden) overlay.hidden = false;
      if (this.state === 'playing') {
        this.orientationPaused = true;
        this.togglePause(true);
        if (this.pauseOverlay) this.pauseOverlay.hidden = true;
      }
    } else if (!overlay.hidden) {
      overlay.hidden = true;
      if (this.orientationPaused && this.state === 'paused') this.togglePause(false);
      this.orientationPaused = false;
      // 手动暂停后旋转屏幕，仍需显示暂停菜单，保留“继续战斗”入口。
      if (this.pauseOverlay) this.pauseOverlay.hidden = this.state !== 'paused';
    }
  },

  resize() {
    const scale = Math.min(window.innerWidth / 1600, window.innerHeight / 900);
    $('gameFrame').style.setProperty('--game-scale', scale.toFixed(4));
    // UI 独立于世界画布布局，仅校验自定义触控布局是否仍适配当前屏幕。
    TouchControls.validateLayout();

    // 画布逻辑坐标始终是 1600×900；只在设备像素密度/窗口变大时提高后备分辨率。
    if (!this.canvas || !this.ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const mobile = TouchControls.isMobileDevice();
    const cap = mobile ? 1 : 2;
    const renderScale = Math.min(cap, Math.max(mobile ? .65 : 1, scale * dpr));
    const w = Math.round(1600 * renderScale);
    const h = Math.round(900 * renderScale);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.ctx.setTransform(w / 1600, 0, 0, h / 900, 0, 0);
    if (this.player && (this.state === 'paused' || this.state === 'over')) this.render();
    this.updateOrientation();
  },

  armMusic() {
    const start = () => {
      GameAudio.init();
      if (this.state === 'menu') GameAudio.playMusic('menu');
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
  },

  toggleMute() {
    GameAudio.init();
    const muted = GameAudio.toggleMute();
    try { localStorage.setItem('stickArenaMuted', muted ? '1' : '0'); } catch (e) { /* noop */ }
    this.updateMuteUI();
    if (!muted && !GameAudio.musicPlaying) {
      if (this.state === 'menu') GameAudio.playMusic('menu');
      else if (this.state === 'playing' || this.state === 'paused') GameAudio.playMusic('battle');
    }
  },

  toggleFullscreen() {
    const doc = document;
    if (doc.fullscreenElement) {
      if (doc.exitFullscreen) doc.exitFullscreen().catch(() => {});
      return;
    }
    const root = doc.documentElement;
    if (!root.requestFullscreen) {
      if (this.player) this.toast('当前浏览器不支持全屏', '#ffd85e');
      return;
    }
    root.requestFullscreen().catch(() => {
      if (this.player) this.toast('全屏启动被浏览器拦截', '#ffd85e');
    });
  },

  updateFullscreenUI() {
    const on = !!document.fullscreenElement;
    $('fsBtn').textContent = on ? '⤢' : '⛶';
    $('fsBtn').setAttribute('aria-label', on ? '退出全屏' : '切换全屏');
    $('fsBtn').title = on ? '退出全屏' : '全屏';
    const touchFs = $('touchFsBtn');
    if (touchFs) {
      touchFs.textContent = on ? '退出' : '全屏';
      touchFs.setAttribute('aria-label', on ? '退出全屏' : '切换全屏');
    }
  },

  loadMute() {
    let muted = false;
    try { muted = localStorage.getItem('stickArenaMuted') === '1'; } catch (e) { /* noop */ }
    GameAudio.setMuted(muted);
  },

  updateMuteUI() {
    const muted = GameAudio.muted;
    $('muteIcon').textContent = muted ? '×' : '♪';
    $('muteLabel').textContent = muted ? '静音' : '声音';
    $('muteGameBtn').textContent = muted ? '×' : '♪';
    const touchMute = $('touchMuteBtn');
    if (touchMute) {
      touchMute.textContent = muted ? '静音' : '声音';
      touchMute.setAttribute('aria-label', muted ? '开启声音' : '静音');
    }
  },

  startMatch(config, options = {}) {
    document.body.classList.add('in-match');
    this.lastTime = performance.now();
    this.simulationAccum = 0;
    this.orientationPaused = false;
    this.training = options.training === true;
    this.config = {
      char: config.char, map: config.map, diff: config.diff, opp: config.opp
    };
    let oppKey = config.opp;
    if (oppKey !== 'random' && !CHARACTERS[oppKey]) oppKey = 'random';
    if (oppKey === 'random') {
      const pool = CHAR_ORDER.filter(k => k !== config.char);
      oppKey = U.choice(pool.length ? pool : CHAR_ORDER);
    }
    this.enemyKey = oppKey;
    this.player = new Fighter(config.char, 'player', false);
    this.enemy = new Fighter(oppKey, 'enemy', !this.training);
    if (this.training) {
      // 木桩拥有更高生命，但血量会正常下降；击破后自动重置，方便持续练习。
      this.enemy.maxHp = 1500;
      this.enemy.hp = this.enemy.maxHp;
      this.enemy.trainingDummy = true;
    } else {
      this.enemy.ai.setDifficulty(config.diff);
    }
    this.player.reset(this.training ? 790 : 520, 1);
    this.enemy.reset(this.training ? 950 : 1080, -1);
    if (this.training) this.player.energy = 100;
    this.projectiles = [];
    this.pendingHits = [];
    this.collectHits = false;
    this.resolvingTrades = false;
    this.hudAccum = 0;
    this.hudPending = false;
    this.hudDirty = false;
    this.zones = [];
    this.effects = [];
    this.particles = [];
    this.floaters = [];
    this.worldTime = 0;
    this.timeLeft = GAME_RULES.duration;
    this.introTime = 2.55;
    this.introStep = -1;
    this.endTimer = 0;
    this.endReason = '';
    this.endWinner = 'draw';
    this.hitstop = 0;
    this.shake = 0;
    this.cameraX = 800;
    this.cameraZoom = 1;
    this.flashAlpha = 0;
    this.announceTimer = 0;
    this.toastTimer = 0;
    this.hitVignette = 0;
    this.comboCount = 0;
    this.comboTimer = 0;
    this.hudLag1 = this.player.hp;
    this.hudLag2 = this.enemy.hp;
    this.lastBeep = 99;
    this.resultShown = false;
    this.buffSig1 = this.buffSig2 = '';
    this.lastHitSound = 0;
    this.lastImpactTime = -1;
    this.trainingSparring = false;
    this.trainingAttackTimer = 2.2;
    this.trainingDummyResetTimer = 0;
    this.trainingTasks = { combo: false, skill: false, ult: false, defense: false };
    this.trainingSignature = '';

    $('menuScreen').style.display = 'none';
    $('gameScreen').hidden = false;
    $('keyboardGuide').hidden = false;
    $('helpOverlay').hidden = true;
    this.pauseOverlay.hidden = true;
    this.resultOverlay.hidden = true;
    $('layoutOverlay').hidden = true;
    TouchControls.endLayoutEdit();
    $('statusToast').classList.remove('show');
    this.setPlayerHud();
    this.buildSkillDock();
    this.setMatchChrome();
    TouchControls.sync(this.player.data);
    TouchControls.setEnabled(false);
    this.resize();
    GameAudio.init();
    GameAudio.startAmbience();
    GameAudio.playMusic('battle', true);

    if (this.training) {
      this.state = 'playing';
      this.introTime = 0;
      this.introStep = 0;
      TouchControls.setEnabled(true);
      this.updateHUD(0);
      this.showAnnounce('TRAINING', '训练场', '木桩不会还手 · 自由练习', '', 1.6);
      this.toast(TouchControls.isMobileDevice() ? '左侧移动，右侧出招。连点普攻可接三连击。' : '训练场已就绪 · 左侧可查看操作说明', this.player.data.color2, 1.8);
    } else {
      this.state = 'intro';
      this.updateHUD(0);
      this.showAnnounce('ROUND 01', 'STICK//ARENA', `${this.player.data.name}  VS  ${this.enemy.data.name}`, '', .9);
      this.introStep = 0;
    }
    this.updateOrientation();
  },

  startTraining(config) {
    this.startMatch(config, { training: true });
  },

  restartCurrent() {
    if (this.training) this.startTraining(this.config);
    else this.startMatch(this.config);
  },

  resetTraining() {
    if (!this.training || !this.player || !this.enemy) return;
    this.player.reset(790, 1);
    this.player.energy = 100;
    this.enemy.reset(950, -1);
    this.enemy.hp = this.enemy.maxHp;
    this.projectiles = [];
    this.zones = [];
    this.effects = [];
    this.particles = [];
    this.floaters = [];
    this.comboCount = 0;
    this.comboTimer = 0;
    this.hudLag1 = this.player.hp;
    this.hudLag2 = this.enemy.hp;
    this.trainingDummyResetTimer = 0;
    this.trainingTasks = { combo: false, skill: false, ult: false, defense: false };
    this.trainingSignature = '';
    this.trainingAttackTimer = 1.6;
    this.updateHUD(0);
    this.toast('木桩已重置 · 继续练习', '#75e7ac', 1.4);
  },

  restoreTrainingDummy() {
    const e = this.enemy;
    if (!e) return;
    this.trainingDummyResetTimer = 0;
    e.hp = e.maxHp;
    e.dead = false;
    e.deathTime = 0;
    e.action = null;
    e.hitstun = 0;
    e.blockstun = 0;
    if (e.comboOwner) e.comboOwner.stats.combo = 0;
    e.comboOwner = null;
    e.comboHitCount = 0;
    e.vx = 0;
    e.vy = 0;
    e.onGround = true;
    e.statuses = [];
    e.hitFlash = 0;
    e.hurtTimer = 0;
    this.hudLag2 = e.maxHp;
    this.addEffect({
      type: 'ring', x: e.x, y: e.y - 70, radius: 76,
      color: '#75e7ac', life: .45, maxLife: .45, lineWidth: 3
    });
    this.toast('木桩已重置 · 继续练习', '#75e7ac', 1.3);
  },

  setMatchChrome() {
    const training = !!this.training;
    $('matchMode').textContent = training ? '训练场' : '1 VS 1';
    $('timerLabel').textContent = training ? '自由练习' : '剩余时间';
    $('trainingBar').hidden = !training;
    document.body.classList.toggle('training-mode', training);
    if (training) {
      const compact = TouchControls.isMobileDevice();
      $('trainingBar').classList.toggle('collapsed', compact);
      $('trainingToggleBtn').textContent = compact ? '展开' : '收起';
    }
    this.updateTrainingSparBtn();
    const dock = $('skillDock');
    if (dock) dock.classList.toggle('training-dock', training);
  },

  updateTrainingSparBtn() {
    const btn = $('trainingSparBtn');
    if (!btn) return;
    btn.textContent = this.trainingSparring ? '木桩反击：开' : '木桩反击：关';
    btn.classList.toggle('on', !!this.trainingSparring);
    btn.setAttribute('aria-pressed', this.trainingSparring ? 'true' : 'false');
  },

  updateTraining(dt) {
    if (!this.training || !this.player || !this.enemy) return;
    const p = this.player;
    if (this.trainingDummyResetTimer > 0) {
      this.trainingDummyResetTimer -= dt;
      // 击破后先定住木桩，避免 0 血目标继续行动。
      this.enemy.action = null;
      this.enemy.vx = 0;
      this.enemy.vy = 0;
      this.enemy.onGround = true;
      this.enemy.hitstun = Math.max(this.enemy.hitstun, .12);
      if (this.trainingDummyResetTimer <= 0) this.restoreTrainingDummy();
    }
    // 训练场里冷却恢复更快；脱战 1 秒后才缓慢回能，避免命中回能和被动回能重复累计。
    if (this.worldTime - p.stats.lastHitTime > 1) p.energy = Math.min(100, p.energy + 8 * dt);
    p.cooldowns = p.cooldowns.map(cd => Math.max(0, cd - dt * 1.2));
    if (this.trainingSparring) {
      this.trainingAttackTimer -= dt;
      if (this.trainingAttackTimer <= 0) {
        this.trainingAttackTimer = 2.1 + U.rand(0, .8);
        if (this.enemy.canAct() && !p.dead && Math.abs(this.enemy.x - p.x) < 640) {
          this.enemy.facing = p.x >= this.enemy.x ? 1 : -1;
          this.enemy.startBasic(p, false);
        }
      }
    }
    if (p.stats.maxCombo >= 3) this.trainingTasks.combo = true;
    if (p.action && p.action.type === 'skill') this.trainingTasks.skill = true;
    if (p.action && p.action.type === 'ult') this.trainingTasks.ult = true;
  },

  updateTrainingUI() {
    if (!this.training || !this.trainingTasks) return;
    const p = this.player;
    const t = this.trainingTasks;
    const sig = [
      t.combo, t.skill, t.ult, t.defense,
      Math.round(p.stats.damage), p.stats.maxCombo, p.stats.ults,
      Math.floor(p.energy)
    ].join('|');
    if (sig === this.trainingSignature) return;
    this.trainingSignature = sig;
    document.querySelectorAll('[data-training-task]').forEach(el => {
      el.classList.toggle('done', !!t[el.dataset.trainingTask]);
    });
    $('trainingDamage').textContent = Math.round(p.stats.damage);
    $('trainingCombo').textContent = p.stats.maxCombo;
    $('trainingUlt').textContent = p.stats.ults;
    $('trainingEnergy').textContent = Math.floor(p.energy) + '%';
  },

  showMenu() {
    document.body.classList.remove('in-match');
    this.state = 'menu';
    this.training = false;
    TouchControls.setEnabled(false);
    $('gameScreen').hidden = true;
    $('menuScreen').style.display = '';
    this.pauseOverlay.hidden = true;
    this.resultOverlay.hidden = true;
    $('helpOverlay').hidden = true;
    $('layoutOverlay').hidden = true;
    TouchControls.endLayoutEdit();
    $('trainingBar').hidden = true;
    $('orientationOverlay').hidden = true;
    this.orientationPaused = false;
    document.body.classList.remove('training-mode');
    $('matchMode').textContent = '1 VS 1 · STICK//ARENA';
    $('timerLabel').textContent = '剩余时间';
    GameAudio.stopAmbience();
    GameAudio.playMusic('menu', true);
    Menu.refresh();
    Menu.resizeFx();
  },

  setPlayerHud() {
    const p = this.player, e = this.enemy;
    $('kbBasicName').textContent = '普攻 · 三段连击';
    $('kbBasicName').title = p.data.basicName;
    p.data.skills.forEach((skill, i) => { $('kbSkillName' + i).textContent = skill.name; });
    $('kbUltName').textContent = p.data.ult.name;
    const p1 = document.querySelector('.duelist.p1');
    const p2 = document.querySelector('.duelist.p2');
    const dock = $('skillDock');
    if (!p1 || !p2 || !dock) return;
    p1.style.setProperty('--p-color', p.data.color);
    p1.style.setProperty('--p-color2', p.data.color2);
    p1.style.setProperty('--p1-color', p.data.color);
    p2.style.setProperty('--p-color', e.data.color);
    p2.style.setProperty('--p-color2', e.data.color2);
    p2.style.setProperty('--p2-color', e.data.color);
    dock.style.setProperty('--p-color', p.data.color);
    this.canvas.parentElement.style.setProperty('--p-color', p.data.color);

    $('p1Portrait').style.setProperty('--p-color', p.data.color);
    $('p1Portrait').querySelector('span').textContent = p.data.name[0];
    $('p2Portrait').style.setProperty('--p-color', e.data.color);
    $('p2Portrait').querySelector('span').textContent = e.data.name[0];
    $('p1Name').textContent = p.data.name;
    $('p2Name').textContent = this.training ? '训练木桩' : e.data.name;
    $('dockFighter').textContent = `${p.data.name} · ${p.data.title}`;
    $('cpuBadge').textContent = this.training
      ? 'TRAINING · 木桩不还手'
      : `CPU · ${DIFFICULTIES[this.config.diff].name} · ${e.data.name}`;
    $('p1HpText').textContent = `HP ${Math.ceil(p.hp)} / ${p.maxHp}`;
    $('p2HpText').textContent = `HP ${Math.ceil(e.hp)} / ${e.maxHp}`;
    $('p1EnergyText').textContent = '0';
    $('p2EnergyText').textContent = '0';
    $('p1EnergyFill').style.width = '0%';
    $('p2EnergyFill').style.width = '0%';
    $('p1GuardFill').style.width = '100%';
    $('p2GuardFill').style.width = '100%';
    $('p1GuardText').textContent = '100';
    $('p2GuardText').textContent = '100';
    $('p1HpFill').style.width = '100%';
    $('p2HpFill').style.width = '100%';
    $('p1HpLag').style.width = '100%';
    $('p2HpLag').style.width = '100%';
    $('p1Buffs').innerHTML = '';
    $('p2Buffs').innerHTML = '';
  },

  buildSkillDock() {
    const p = this.player;
    const d = p.data;
    const slots = $('dockSlots');
    slots.innerHTML = '';
    this.skillCards = [];

    const basic = document.createElement('div');
    basic.className = 'skill-card basic ready';
    basic.style.setProperty('--skill-color', d.color);
    basic.style.setProperty('--skill-glow', U.hexA(d.color, .22));
    basic.innerHTML = `
      <span class="skill-key">J</span>
      <span class="skill-glyph">${d.name[0]}</span>
      <span class="skill-name">${d.basicName}</span>
      <span class="skill-sub">普攻 · 连按三段</span>
    `;
    slots.appendChild(basic);

    d.skills.forEach((s, i) => {
      const card = document.createElement('div');
      card.className = 'skill-card ready';
      card.style.setProperty('--skill-color', s.color);
      card.style.setProperty('--skill-glow', U.hexA(s.color, .25));
      card.innerHTML = `
        <span class="skill-key">${s.key}</span>
        <span class="skill-glyph">${s.glyph}</span>
        <span class="skill-name">${s.name}</span>
        <span class="skill-sub">冷却 ${s.cd}s</span>
        <span class="skill-cd-mask"><b></b></span>
      `;
      slots.appendChild(card);
      this.skillCards.push({
        el: card,
        mask: card.querySelector('.skill-cd-mask'),
        text: card.querySelector('.skill-cd-mask b'),
        type: 'skill',
        index: i,
        cd: s.cd
      });
    });

    const ult = document.createElement('div');
    ult.className = 'skill-card ult cooling';
    ult.style.setProperty('--skill-color', d.ult.color);
    ult.style.setProperty('--skill-glow', U.hexA(d.ult.color, .3));
    ult.innerHTML = `
      <span class="skill-key">L</span>
      <span class="skill-glyph">${d.ult.glyph}</span>
      <span class="skill-name">${d.ult.name}</span>
      <span class="skill-cd-mask"><b>0%</b></span>
      <span class="ult-charge"><i></i></span>
    `;
    slots.appendChild(ult);
    this.ultCard = {
      el: ult,
      mask: ult.querySelector('.skill-cd-mask'),
      text: ult.querySelector('.skill-cd-mask b'),
      charge: ult.querySelector('.ult-charge i')
    };
  },

  

  getPlayerIntent() {
    return {
      left: Input.anyDown(['KeyA', 'ArrowLeft']),
      right: Input.anyDown(['KeyD', 'ArrowRight']),
      jumpPressed: Input.anyPressed(['KeyK']),
      normalPressed: Input.anyPressed(['KeyJ']),
      skills: [
        Input.anyPressed(['KeyU']),
        Input.anyPressed(['KeyI']),
        Input.anyPressed(['KeyO'])
      ],
      ult: Input.anyPressed(['KeyL']),
      block: Input.anyDown(['KeyS']),
      dodgePressed: Input.anyPressed(['ShiftLeft', 'ShiftRight'])
    };
  },

  loop(now) {
    const elapsed = this.lastTime === null ? 1 / 60 : Math.max(0, (now - this.lastTime) / 1000);
    this.lastTime = now;

    if (this.state === 'menu') {
      this.simulationAccum = 0;
      Menu.tickPreview(Math.min(elapsed, .045));
      Input.clear();
    } else if (this.state === 'playing' || this.state === 'intro' || this.state === 'ending') {
      // 低帧率时补足实际经过的时间；以 60 Hz 小步推进，避免大步长漏掉碰撞。
      // 浏览器长时间挂起后最多补算一秒；正常切后台会由失焦处理自动暂停。
      const step = 1 / 60;
      let advancedTime = 0;
      this.batchUpdating = true;
      this.simulationAccum += Math.min(elapsed, 1);
      while (this.simulationAccum + 1e-9 >= step) {
        this.simulationAccum = Math.max(0, this.simulationAccum - step);
        advancedTime += step;
        this.update(step);
        // 一次按键只触发一次；高刷新率下没有更新时保留输入至下一步。
        Input.clear();
        if (this.state !== 'playing' && this.state !== 'intro' && this.state !== 'ending') {
          this.simulationAccum = 0;
          break;
        }
      }
      this.batchUpdating = false;
      if (this.hudPending) { this.hudPending = false; this.updateHUD(advancedTime); }
      this.render();
    } else {
      this.simulationAccum = 0;
      Input.clear();
    }
    requestAnimationFrame(this.loop);
  },

  update(dt) {
    this.worldTime += dt;
    this.updateAnnounce(dt);
    this.updateToast(dt);
    this.updateVisualTimers(dt);

    if (this.state === 'intro') {
      this.updateIntro(dt);
      return;
    }

    if (this.state === 'ending') {
      this.endTimer -= dt;
      this.updateDeath(dt);
      this.updateEffects(dt * .55);
      this.updateParticles(dt * .45);
      this.updateFloaters(dt);
      if (this.endTimer <= 0 && !this.resultShown) this.showResult();
      this.updateHUD(dt);
      return;
    }

    if (this.state !== 'playing') {
      this.updateHUD(dt);
      return;
    }

    if (!this.training) {
      const before = Math.ceil(this.timeLeft);
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.finishByTime();
        return;
      }
      const after = Math.ceil(this.timeLeft);
      if (after <= 5 && after !== before && after > 0) GameAudio.countdown(after === 1);
    }

    if (this.hitstop > 0) {
      // 顿帧期间也接收操作，命中停顿结束后立即响应。
      this.player.bufferInput(this.getPlayerIntent(), 0);
      for (const fighter of [this.player, this.enemy]) {
        fighter.previousX = fighter.x;
        fighter.previousY = fighter.y;
      }
      this.hitstop -= dt;
      this.updateParticles(dt * .18);
      this.updateFloaters(dt * .35);
      this.updateHUD(dt);
      return;
    }

    const p1Intent = this.getPlayerIntent();
    const p2Intent = this.training ? emptyIntent() : this.enemy.ai.think(dt, this.player);
    this.pendingHits = [];
    this.collectHits = true;
    this.player.update(dt, this.enemy, p1Intent);
    this.enemy.update(dt, this.player, this.player.dead ? emptyIntent() : p2Intent);
    this.resolvePushboxes();
    this.player.updateActiveHitbox(this.enemy);
    this.enemy.updateActiveHitbox(this.player);
    // 近战、飞行道具和场地区域统一结算，避免数组顺序抢先决定胜负。
    this.updateProjectiles(dt);
    this.updateZones(dt);
    this.collectHits = false;
    this.flushHits();
    if (this.training) this.updateTraining(dt);

    if (this.state !== 'playing') {
      this.updateEffects(dt);
      this.updateParticles(dt);
      this.updateFloaters(dt);
      this.updateHUD(dt);
      return;
    }

    this.updateEffects(dt);
    this.updateParticles(dt);
    this.updateFloaters(dt);

    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.comboCount = 0;
    }
    this.updateHUD(dt);
  },

  updateVisualTimers(dt) {
    this.shake *= Math.exp(-19 * dt);
    if (this.player && this.enemy) {
      const distance = Math.abs(this.player.x - this.enemy.x);
      const zoom = 1 + .18 * U.clamp(1 - distance / 1050, 0, 1);
      const halfView = 800 / zoom;
      const focus = U.clamp((this.player.x + this.enemy.x) / 2, halfView, 1600 - halfView);
      const follow = 1 - Math.exp(-5 * dt);
      this.cameraX = U.lerp(this.cameraX === undefined ? 800 : this.cameraX, focus, follow);
      this.cameraZoom = U.lerp(this.cameraZoom === undefined ? 1 : this.cameraZoom, zoom, follow);
    }
    this.flashAlpha = Math.max(0, this.flashAlpha - dt * 3.3);
    this.hitVignette = Math.max(0, this.hitVignette - dt * 2.5);
    this.flashEl.style.opacity = this.flashAlpha.toFixed(3);
    this.flashEl.style.background = this.flashColor;
    this.vignetteEl.style.opacity = this.hitVignette.toFixed(3);
  },

  resolvePushboxes() {
    const p = this.player, e = this.enemy;
    if (!p || !e || p.dead || e.dead || !p.onGround || !e.onGround || p.dodgeTime > 0 || e.dodgeTime > 0) return;
    // 普通地面移动保持身位；跳跃、闪避和跨过身位的瞬移仍可换边。
    const dx = e.x - p.x;
    const overlap = COMBAT.pushboxWidth - Math.abs(dx);
    if (overlap <= 0) return;
    const dir = dx ? U.sign(dx) : p.facing;
    if (e.trainingDummy) {
      p.x = U.clamp(e.x - dir * COMBAT.pushboxWidth, WORLD.left, WORLD.right);
      return;
    }
    p.x = U.clamp(p.x - dir * overlap / 2, WORLD.left, WORLD.right);
    e.x = U.clamp(e.x + dir * overlap / 2, WORLD.left, WORLD.right);
    const remaining = COMBAT.pushboxWidth - Math.abs(e.x - p.x);
    if (remaining > 0) {
      if (p.x === WORLD.left || p.x === WORLD.right) e.x = U.clamp(e.x + dir * remaining, WORLD.left, WORLD.right);
      else p.x = U.clamp(p.x - dir * remaining, WORLD.left, WORLD.right);
    }
  },

  flushHits() {
    const hits = this.pendingHits || [];
    this.pendingHits = [];
    this.pendingKOs = [];
    this.resolvingTrades = true;
    try { for (const hit of hits) this.dealDamage(hit.attacker, hit.target, hit.amount, hit.opts); }
    finally { this.resolvingTrades = false; }
    if (this.pendingKOs.length) {
      const loser = this.pendingKOs[0].loser;
      const winner = this.player.dead && this.enemy.dead ? 'draw' : this.pendingKOs[0].winner;
      this.onKO(loser, winner);
    }
  },

  updateIntro(dt) {
    this.introTime -= dt;
    const elapsed = 2.55 - this.introTime;
    const steps = [
      { t: 0.0, main: 'ROUND 01', kicker: 'STICK//ARENA', sub: `${this.player.data.name}  VS  ${this.enemy.data.name}`, cls: '', dur: .62 },
      { t: 0.62, main: '3', kicker: 'READY', sub: '准备战斗', cls: 'fight', dur: .48 },
      { t: 1.13, main: '2', kicker: 'READY', sub: '观察对手', cls: 'fight', dur: .48 },
      { t: 1.64, main: '1', kicker: 'READY', sub: '不要留手', cls: 'fight', dur: .48 },
      { t: 2.08, main: 'FIGHT!', kicker: 'ENGAGE', sub: '', cls: 'fight', dur: .7 }
    ];
    while (this.introStep + 1 < steps.length && elapsed >= steps[this.introStep + 1].t) {
      this.introStep++;
      const s = steps[this.introStep];
      this.showAnnounce(s.main, s.kicker, s.sub, s.cls, s.dur);
      GameAudio.countdown(s.main === 'FIGHT!' || s.main === '1');
    }
    this.player.update(dt, this.enemy, emptyIntent());
    this.enemy.update(dt, this.player, emptyIntent());
    this.updateEffects(dt);
    this.updateParticles(dt);
    this.updateHUD(dt);
    if (elapsed >= 2.1 && this.state === 'intro') {
      this.state = 'playing';
      TouchControls.setEnabled(true);
      this.lastBeep = 99;
      this.updateOrientation();
    }
  },

  updateDeath(dt) {
    [this.player, this.enemy].forEach(f => {
      if (!f || !f.dead) return;
      f.deathTime += dt;
      f.vy += WORLD.gravity * dt;
      f.y += f.vy * dt;
      f.x += f.vx * dt;
      f.vx *= Math.exp(-4.5 * dt);
      f.x = U.clamp(f.x, WORLD.left, WORLD.right);
      if (f.y >= WORLD.ground) {
        f.y = WORLD.ground;
        f.vy = 0;
        f.onGround = true;
      }
    });
  },

  finishByTime() {
    const pRatio = this.player.hp / this.player.maxHp;
    const eRatio = this.enemy.hp / this.enemy.maxHp;
    let winner = 'draw';
    if (Math.abs(pRatio - eRatio) > 0.001) winner = pRatio > eRatio ? 'player' : 'enemy';
    this.endReason = 'TIME';
    this.endWinner = winner;
    this.endTimer = 1.9;
    this.state = 'ending';
    TouchControls.setEnabled(false);
    this.showAnnounce('TIME UP', '时间到', winner === 'draw' ? '双方势均力敌' : (winner === 'player' ? '血量领先 · 胜利' : '血量落后 · 败北'), 'ko', 1.8);
    GameAudio.ko();
    this.flash('#ffb066', .12);
    this.updateHUD(0);
  },

  onKO(loser, winner) {
    if (this.training) return;
    if (this.resolvingTrades) { this.pendingKOs.push({ loser, winner }); return; }
    if (this.state !== 'playing' && this.state !== 'intro') return;
    this.endReason = 'KO';
    this.endWinner = winner;
    this.endTimer = 1.8;
    this.state = 'ending';
    TouchControls.setEnabled(false);
    this.showAnnounce(winner === 'draw' ? 'DOUBLE K.O.' : 'K.O.', 'KNOCK OUT', winner === 'draw' ? '双方同时倒地' : loser.side === 'player' ? '你被击倒了' : '对手被击倒', 'ko', 1.8);
    this.flash('#ff5a65', .32);
    this.shake = Math.max(this.shake, 22);
    GameAudio.ko();
    if (loser === this.player) {
      this.hitVignette = 1;
    }
    this.projectiles.forEach(p => { p.dead = true; });
    this.projectiles = [];
    this.zones = [];
    this.updateHUD(0);
  },

  showResult() {
    $('keyboardGuide').hidden = true;
    this.resultShown = true;
    this.state = 'over';
    TouchControls.setEnabled(false);
    const p = this.player, e = this.enemy;
    const win = this.endWinner;
    const title = win === 'player' ? '胜利' : (win === 'enemy' ? '败北' : '平局');
    const card = this.resultOverlay.querySelector('.result-card');
    card.classList.toggle('lose', win === 'enemy');
    card.classList.toggle('draw', win === 'draw');
    $('resultTitle').textContent = title;
    $('resultBadge').textContent = win === 'player' ? 'VICTORY' : (win === 'enemy' ? 'DEFEAT' : 'DRAW');
    $('resultSub').textContent = win === 'player'
      ? (this.endReason === 'KO' ? '漂亮的终结。对手倒在了你的连击之下。' : '时间耗尽，你以更高的剩余生命赢得判定。')
      : win === 'enemy'
        ? (this.endReason === 'KO' ? '战斗还没有结束。调整战术，再来一局。' : '时间耗尽，对手的生命值更高。')
        : '双方战至最后，未能分出胜负。';
    $('resultReason').textContent = this.endReason === 'KO' ? 'K.O.' : '判定';
    $('resultKicker').textContent = this.endReason === 'KO' ? 'MATCH COMPLETE / KNOCKOUT' : 'MATCH COMPLETE / JUDGEMENT';
    $('resultTime').textContent = U.formatTime(GAME_RULES.duration - this.timeLeft);
    $('rsP1Name').textContent = p.data.name;
    $('rsP2Name').textContent = e.data.name;
    $('rsP1Hp').textContent = Math.round(Math.max(0, p.hp) / p.maxHp * 100) + '%';
    $('rsP2Hp').textContent = Math.round(Math.max(0, e.hp) / e.maxHp * 100) + '%';
    $('statDamage').textContent = Math.round(p.stats.damage);
    $('statCombo').textContent = p.stats.maxCombo;
    $('statSkills').textContent = p.stats.skillHits;
    $('statUlt').textContent = p.stats.ults;
    this.resultOverlay.style.setProperty('--p-color', p.data.color);
    this.resultOverlay.style.setProperty('--p2-color', e.data.color);
    this.resultOverlay.hidden = false;
    GameAudio.stopMusic(1);
    GameAudio.stopAmbience();
    if (win === 'player') GameAudio.victory();
    else if (win === 'enemy') GameAudio.defeat();
    this.announceEl.classList.remove('show');
  },

  openTouchLayout() {
    if (this.state === 'playing') this.togglePause(true);
    if (this.state !== 'paused') return;
    this.pauseOverlay.hidden = true;
    const overlay = $('layoutOverlay');
    overlay.hidden = false;
    overlay.classList.remove('collapsed');
    $('layoutCollapseBtn').textContent = '收起面板';
    TouchControls.beginLayoutEdit();
  },

  closeTouchLayout(save = false) {
    if (!$('layoutOverlay') || $('layoutOverlay').hidden) return;
    if (save) {
      TouchControls.saveLayout();
      this.toast('键位布局已保存', '#ffc27e', 1.4);
    } else {
      TouchControls.cancelLayoutEdit();
    }
    $('layoutOverlay').hidden = true;
    $('layoutOverlay').classList.remove('collapsed');
    if (this.state === 'paused') this.pauseOverlay.hidden = false;
  },

  toggleTouchLayoutPanel() {
    const overlay = $('layoutOverlay');
    const collapsed = overlay.classList.toggle('collapsed');
    $('layoutCollapseBtn').textContent = collapsed ? '展开面板' : '收起面板';
  },

  resetTouchLayout() {
    TouchControls.resetLayout();
    this.toast('已恢复默认键位 · 可继续调整', '#ffc27e', 1.5);
  },

  togglePause(force) {
    if (this.state === 'playing' || this.state === 'paused') {
      if (this.state === 'playing') {
        this.state = 'paused';
        this.simulationAccum = 0;
        this.pauseOverlay.hidden = false;
        $('keyboardGuide').hidden = true;
        Input.down.clear();
        Input.pressed.clear();
        if (this.player) this.player.inputBuffer = {};
        TouchControls.releaseAll();
        TouchControls.setPaused(true);
        GameAudio.duckMusic(true);
        GameAudio.ui();
      } else if (force !== true) {
        if (!$('layoutOverlay').hidden) {
          this.closeTouchLayout(false);
          return;
        }
        this.state = 'playing';
        this.lastTime = performance.now();
        this.simulationAccum = 0;
        this.pauseOverlay.hidden = true;
        $('keyboardGuide').hidden = false;
        TouchControls.setPaused(false);
        GameAudio.duckMusic(false);
        GameAudio.ui();
      }
    }
  },

  /* ---------------- 伤害与能量 ---------------- */

  dealDamage(attacker, target, amount, opts = {}) {
    // 木桩归零后等待重置期间，不再产生伤害、连击和充能。
    if (!attacker || !target || target.dead || target.hp <= 0 || this.state !== 'playing') return false;
    if (target.invuln > 0 && !opts.ignoreInvuln) {
      if (this.training && this.trainingSparring && target === this.player && this.trainingTasks) {
        this.trainingTasks.defense = true;
      }
      if (!opts.silent) this.floatText(target.x, target.y - 142, '闪避', '#9ff3ff', 16);
      return false;
    }
    if (this.collectHits) {
      this.pendingHits.push({ attacker, target, amount, opts: Object.assign({}, opts, { sourceAction: opts.sourceAction || attacker.action }) });
      return true;
    }
    const sourceAction = opts.sourceAction || attacker.action;
    const protectedAction = target.action && (target.action.opts.superArmor || target.action.opts.armor);
    const counterHit = opts.type !== 'dot' && !protectedAction && target.action && target.action.time < target.action.startup;
    const punishHit = opts.type !== 'dot' && !protectedAction && target.action && target.action.time >= target.action.activeEnd;
    const continuingCombo = opts.type !== 'dot' && target.comboOwner === attacker && target.hitstun > 0;
    const comboHits = continuingCombo ? target.comboHitCount + 1 : 1;

    let incoming = amount;
    if (opts.type !== 'dot') incoming *= Math.max(COMBAT.minimumDamageScale, 1 - COMBAT.comboScaleStep * (comboHits - 1));
    if (this.training && attacker === this.enemy) incoming *= .55;
    if (attacker.hasStatus('warBuff')) incoming *= 1.25;
    if (attacker.key === 'chilin' && attacker.empowerTimer > 0) incoming *= 1.18;
    if (target.hasStatus('warBuff')) incoming *= .76;
    if (target.guardTimer > 0 || target.hasStatus('guard')) incoming *= .45;
    if (target.action && target.action.opts && target.action.opts.guard) incoming *= .5;
    if (target.ironWall > 0 && opts.type !== 'dot') incoming *= .34;
    if (target.decoyTimer > 0 && opts.type !== 'dot') incoming *= .4;

    const dir = opts.dir !== undefined ? opts.dir : (attacker.facing || 1);
    const targetFacing = target.facing || 1;
    const blocked = !opts.unblockable &&
      opts.type !== 'dot' &&
      target.blocking &&
      target.guardMeter > 0 &&
      target.guardBreak <= 0 &&
      dir * targetFacing < 0;
    if (!blocked && counterHit) incoming *= 1.1;

    let damage = incoming;
    if (blocked) damage *= GAME_RULES.blockDamage;
    damage = blocked && opts.type === 'basic' ? 0 : Math.max(1, Math.round(damage));
    if (sourceAction && opts.type !== 'dot') sourceAction.contact = blocked ? (sourceAction.contact || 'block') : 'hit';

    const trainingDummy = this.training && target === this.enemy;
    const trainingPlayer = this.training && target === this.player;
    const hpBefore = target.hp;
    target.hp = Math.max(0, target.hp - damage);
    // 训练木桩可以正常打到 0 血，击破后短暂停顿再自动回满，避免出现“锁血”的假象。
    if (trainingDummy && target.hp <= 0 && this.trainingDummyResetTimer <= 0) {
      this.trainingDummyResetTimer = 1.15;
      this.toast('木桩已击破 · 即将重置', '#ffc27e', 1.2);
      this.addEffect({
        type: 'ring', x: target.x, y: target.y - 70, radius: 92,
        color: '#ffc27e', life: .5, maxLife: .5, lineWidth: 4
      });
    }
    // 训练模式也不让玩家真正倒下，方便反复练习格挡和闪避。
    if (trainingPlayer) target.hp = Math.max(1, target.hp);
    const actualDamage = hpBefore - target.hp;
    this.hudDirty = true;
    target.hitFlash = opts.type === 'dot' ? .045 : .095;
    target.hurtTimer = opts.type === 'dot' ? .04 : .18;
    if (opts.type !== 'dot' && !blocked) {
      target.impactDir = dir * targetFacing;
      target.recoil = opts.heavy ? 1 : .55;
    }
    if (opts.energy !== false) {
      if (!attacker.dead) attacker.addEnergy(actualDamage * GAME_RULES.energyDealt);
      if (target.hp > 0) target.addEnergy(actualDamage * GAME_RULES.energyTaken);
    }
    attacker.stats.damage += actualDamage;
    if (!blocked && opts.type !== 'dot') {
      if (attacker.key === 'arashi') {
        attacker.windCharge = Math.min(100, (attacker.windCharge || 0) + (opts.type === 'ult' ? 0 : 9));
        if (attacker.windCharge >= 100 && !attacker.windReadyShown) {
          attacker.windReadyShown = true;
          this.floatText(attacker.x, attacker.y - 190, '风势满', '#8ff8e6', 18);
          this.toast('风势已满 · 下一次必杀强化', '#8ff8e6', 1.1);
        }
      } else if (attacker.key === 'chilin') {
        attacker.overload = Math.min(100, (attacker.overload || 0) + (opts.type === 'ult' ? 12 : 5));
        if (attacker.overload >= 100 && !attacker.overloadShown) {
          attacker.overloadShown = true;
          this.floatText(attacker.x, attacker.y - 190, '过载满', '#ffc879', 18);
        }
      }
    }

    if (blocked) {
      const guardCost = incoming * GAME_RULES.guardCost + (opts.heavy ? 12 : 5);
      target.guardMeter = Math.max(0, target.guardMeter - guardCost);
      target.guardRegenDelay = Math.max(target.guardRegenDelay, .45);
      if (this.training && this.trainingSparring && target === this.player && this.trainingTasks) {
        this.trainingTasks.defense = true;
      }
      if (target.guardMeter <= 0) target.breakGuard(dir);
    }

    if (opts.type !== 'dot' && !blocked) {
      const ct = this.worldTime;
      target.comboOwner = attacker;
      target.comboHitCount = comboHits;
      attacker.stats.combo = comboHits;
      attacker.stats.lastHitTime = ct;
      attacker.stats.maxCombo = Math.max(attacker.stats.maxCombo, attacker.stats.combo);
      if (opts.type === 'skill' || opts.type === 'ult') attacker.stats.skillHits++;
      if (attacker === this.player) {
        this.comboCount = attacker.stats.combo;
        this.comboTimer = 1.5;
      }
      if (target === this.player) {
        this.comboCount = 0;
        this.comboTimer = 0;
      }
    } else if (blocked) {
      // 被格挡的招式不算连击，避免防御反而帮助对手叠连段。
      attacker.stats.combo = 0;
      if (attacker === this.player) {
        this.comboCount = 0;
        this.comboTimer = 0;
      }
    }

    if (opts.type !== 'dot') {
      const armor = target.action && (target.action.opts.superArmor || target.action.opts.armor);
      if (blocked) {
        if (target.guardBreak <= 0) {
          target.blockstun = Math.max(target.blockstun, opts.blockstun || (opts.heavy ? 16 : 11) / 60);
          target.vx = dir * (opts.heavy ? 65 : 35);
        }
      } else if (trainingDummy) {
        // 木桩固定站位，只保留短暂受击反馈，不击退也不浮空。
        target.action = null;
        target.queuedBasic = 0;
        target.hitstun = Math.max(target.hitstun, opts.stun !== undefined ? opts.stun : .24);
        target.vx = 0;
        target.vy = 0;
        target.onGround = true;
      } else if (target.ironWall > 0) {
        target.hitstun = Math.max(target.hitstun, .05);
        target.vx = dir * (opts.kb !== undefined ? opts.kb : 100) * .16 / (target.data.weight || 1);
      } else if (!armor) {
        target.blocking = false;
        target.blockstun = 0;
        target.action = null;
        target.queuedBasic = 0;
        const stun = ((opts.stun !== undefined ? opts.stun : .22) + (counterHit ? 4 / 60 : 0)) * Math.max(.65, 1 - .025 * (comboHits - 1));
        target.hitstun = Math.max(target.hitstun, stun);
        target.vx = dir * (opts.kb !== undefined ? opts.kb : 120) / (target.data.weight || 1);
        if (opts.launch) {
          target.vy = -opts.launch;
          target.onGround = false;
          target.jumpsLeft = 1;
        }
      } else {
        target.hitstun = Math.max(target.hitstun, .06);
      }
    }

    if (opts.status) target.addStatus(opts.status.type, opts.status.time, opts.status);
    if (!opts.noFeedback && !blocked && (counterHit || punishHit)) {
      this.floatText(target.x, target.y - 173, counterHit ? '反击' : '抓收招', '#ffe2a1', 18);
    }

    if (!opts.noFeedback) {
      if (blocked) {
        this.hitstop = Math.max(this.hitstop, opts.heavy ? .04 : .018);
        this.shake = Math.max(this.shake, opts.heavy ? 5 : 2);
        this.addEffect({ type: 'impact', x: target.x - dir * 30, y: target.y - 88,
          dir, color: '#aef4ff', heavy: !!opts.heavy, blocked: true, life: .16, maxLife: .16 });
        this.burst(target.x, target.y - 88, '#9fe8ff', opts.heavy ? 14 : 8, 160);
        if (target.guardBreak <= 0) {
          this.addEffect({
            type: 'ring', x: target.x + targetFacing * 8, y: target.y - 80, radius: 54,
            color: '#9fe8ff', life: .28, maxLife: .28, lineWidth: 3
          });
          this.floatText(target.x, target.y - 140, '格挡', '#c8f4ff', 18);
          GameAudio.block(!!opts.heavy);
        }
        if (target === this.player) {
          this.hitVignette = Math.min(1, this.hitVignette + (opts.heavy ? .4 : .2));
          GameAudio.hurt();
        }
      } else {
        // 霰弹或多段攻击集中命中时只触发一次顿帧，避免整段连招反复卡住。
        if (opts.type !== 'dot' && this.worldTime - this.lastImpactTime >= .045) {
          this.hitstop = Math.max(this.hitstop, opts.heavy ? .065 : .025);
          this.lastImpactTime = this.worldTime;
          this.addEffect({ type: 'impact', x: target.x - dir * 17, y: target.y - 92,
            dir, color: opts.color || attacker.data.color2, heavy: !!opts.heavy, life: .18, maxLife: .18 });
        }
        this.shake = Math.max(this.shake, opts.heavy ? 10 : (opts.type === 'dot' ? 0 : 3));
        this.burst(target.x, target.y - 92, opts.color || attacker.data.color, opts.heavy ? 14 : 6, opts.heavy ? 330 : 180);
        this.floatText(
          target.x + U.rand(-12, 12), target.y - 138,
          String(actualDamage),
          opts.color || '#fff', opts.heavy ? 34 : (opts.type === 'dot' ? 14 : 23),
          opts.type === 'dot'
        );
        if (this.worldTime - this.lastHitSound > .035) {
          this.lastHitSound = this.worldTime;
          GameAudio.hit(!!opts.heavy, attacker.key);
        }
        if (target === this.player) {
          this.hitVignette = Math.min(1, this.hitVignette + (opts.heavy ? .55 : .3));
          GameAudio.hurt();
        }
      }
    } else if (opts.type === 'dot') {
      this.burst(target.x + U.rand(-14, 14), target.y - 60, opts.color || '#ff8a3d', 2, 70);
    }

    if (target.hp <= 0 && !trainingDummy && !trainingPlayer) {
      target.dead = true;
      target.action = null;
      target.hitstun = 99;
      target.vx = dir * 240;
      target.vy = -280;
      target.onGround = false;
      const winner = target === this.player ? 'enemy' : 'player';
      this.onKO(target, winner);
    }
    if (!blocked && opts.type !== 'dot' && actualDamage > 0 && target.hp > 0 && opts.onConfirmedHit) {
      opts.onConfirmedHit();
    }
    return true;
  },

  onEnergyFull(fighter) {
    if (fighter === this.player) {
      this.toast('终极充能完成 · 按 L 释放', fighter.data.color2, 2.4);
      GameAudio.charge();
    } else {
      this.toast('警告 · 对手终极技能已就绪', '#ff6d79', 2);
    }
    this.burst(fighter.x, fighter.y - 85, fighter.data.color, 18, 240);
  },

  /* ---------------- 投影物 ---------------- */

  spawnProjectile(p) {
    p.attackType = p.attackType || (p.owner.action ? p.owner.action.type : 'basic');
    p.sourceAction = p.sourceAction || p.owner.action;
    p.dead = false;
    p.pierce = p.pierce === undefined ? 1 : p.pierce;
    p.trail = p.trail || [];
    p.trailTimer = p.trailTimer || 0;
    p.seed = p.seed || U.rand(0, 6);
    p.age = 0;
    if (p.radius === undefined) p.radius = 10;
    this.projectiles.push(p);
  },

  updateProjectiles(dt) {
    const targetFor = p => p.owner === this.player ? this.enemy : this.player;
    const starGates = this.zones.filter(z => z.type === 'starGate' && z.life > 0);
    for (const p of this.projectiles) {
      if (p.dead) continue;
      p.age += dt;
      p.life -= dt;
      if (p.life <= 0) { p.dead = true; continue; }
      const fromX = p.x, fromY = p.y;
      if (p.gravity) p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'shockwave') p.spin = 0;
      if (p.spin !== undefined && p.kind === 'molotov') p.spin += dt * 8;

      p.trailTimer -= dt;
      if (p.trailTimer <= 0 && ['orb', 'bigOrb', 'star', 'meteor', 'molotov'].includes(p.kind)) {
        p.trailTimer = .024;
        p.trail.push({ x: p.x, y: p.y });
        if (p.trail.length > 9) p.trail.shift();
      }

      if (p.x < -200 || p.x > 1800 || p.y < -600 || p.y > 1000) { p.dead = true; continue; }

      const target = targetFor(p);
      const fraction = target && !target.dead ? U.sweptRect(fromX, fromY, p.x, p.y, target.hurtbox, p.radius) : null;
      // 星轨结界：敌方飞行道具被拦截，己方星屑穿过时发生折射。
      // 沿本帧运动路径检查，按接触先后处理，防止高速弹丸穿过结界。
      const gates = [];
      for (const z of starGates) {
        const contact = U.sweptRect(fromX, fromY, p.x, p.y,
          { x: z.x - z.radius * .72, y: WORLD.ground - 238, w: z.radius * 1.44, h: 238 }, p.radius);
        if (contact !== null && (fraction === null || contact <= fraction)) gates.push({ z, contact });
      }
      if (gates.length > 1) gates.sort((a, b) => a.contact - b.contact);
      for (const {z, contact} of gates) {
        if (p.owner === z.owner) {
          if (!p.refracted && p.kind !== 'meteor' && p.attackType !== 'ult' &&
              ['star', 'orb', 'bigOrb', 'arrow', 'dagger'].includes(p.kind)) {
            p.refracted = true;
            // 折射出第二发，而不是把原本的弹道抬到天上。
            this.projectiles.push(Object.assign({}, p, {
              x: p.x, y: p.y + 24, vy: (p.vy || 0) + 26,
              damage: Math.max(1, Math.round((p.damage || 0) * .55)),
              refracted: true, trail: [], trailTimer: 0, life: Math.max(.2, (p.life || 1) * .8)
            }));
            this.addEffect({
              type: 'ring', x: z.x, y: p.y, radius: 38,
              color: z.color, life: .2, maxLife: .2, lineWidth: 3
            });
          }
        } else {
          p.dead = true;
          p.x = U.lerp(fromX, p.x, contact);
          p.y = U.lerp(fromY, p.y, contact);
          this.addEffect({
            type: 'burst', x: p.x, y: p.y, radius: 42,
            color: z.color, seed: 1.2, life: .24, maxLife: .24
          });
          this.burst(p.x, p.y, z.color, 10, 180);
          break;
        }
      }
      if (p.dead) continue;

      const dodged = fraction !== null && target.invuln > 0;
      if (dodged && this.training && target === this.player && this.trainingTasks) this.trainingTasks.defense = true;
      const hitTarget = fraction !== null && !dodged;
      if (hitTarget) {
        p.x = U.lerp(fromX, p.x, fraction);
        p.y = U.lerp(fromY, p.y, fraction);
      }

      if (p.kind === 'molotov') {
        if (hitTarget || p.y >= WORLD.ground - 14) {
          this.molotovExplode(p, target);
          p.dead = true;
          continue;
        }
      } else if (p.kind === 'meteor') {
        if (hitTarget || p.y >= WORLD.ground - 12) {
          this.meteorExplode(p, target);
          p.dead = true;
          continue;
        }
      } else if (p.kind === 'skyArrow') {
        if (hitTarget) {
          this.dealDamage(p.owner, target, p.damage, {
            kb: p.kb, stun: p.stun, type: 'ult', color: p.color,
            sourceAction: p.sourceAction,
            dir: U.sign(target.x - p.x) || 1
          });
          this.smallImpact(p.x, p.y, p.color, 10);
          GameAudio.hit(false);
          p.dead = true;
          continue;
        }
        if (p.y >= WORLD.ground - 4) {
          this.smallImpact(p.x, WORLD.ground, p.color, 8);
          p.dead = true;
          continue;
        }
      } else if (hitTarget) {
        const actionType = p.attackType;
        const hit = this.dealDamage(p.owner, target, p.damage, {
          kb: p.kb, stun: p.stun,
          type: actionType === 'ult' ? 'ult' : actionType === 'skill' ? 'skill' : 'basic',
          color: p.color, dir: Math.abs(p.vx) > 10 ? U.sign(p.vx) : U.sign(target.x - p.owner.x), heavy: p.damage >= 55,
          status: p.status, sourceAction: p.sourceAction
        });
        if (hit && p.empowered) {
          this.explode(p.x, p.y, 92, p.color, p.owner, 22, { type: p.attackType, sourceAction: p.sourceAction });
        }
        this.smallImpact(p.x, p.y, p.color, p.kind === 'pellet' ? 4 : 8);
        if (p.hitOnce !== false) p.dead = true;
        else { p.pierce -= 1; if (p.pierce <= 0) p.dead = true; }
        if (p.owner === this.player && !hit) { /* invuln dodged */ }
        continue;
      }

      const groundY = WORLD.ground - 5;
      if (p.kind !== 'shockwave' && p.kind !== 'meteor' && p.kind !== 'skyArrow' && p.y >= groundY) {
        this.smallImpact(p.x, groundY, p.color, 4);
        p.dead = true;
        continue;
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  },

  molotovExplode(p, target) {
    const x = U.clamp(p.x, WORLD.left, WORLD.right);
    this.addZone({
      type: 'fire', x, y: WORLD.ground, radius: 126, owner: p.owner,
      life: 3.4, maxLife: 3.4, tick: .3, damage: 11, seed: U.rand(0, 10)
    });
    this.addEffect({
      type: 'burst', x, y: WORLD.ground - 20, radius: 95,
      color: '#ff8a3d', seed: U.rand(0, 4), life: .4, maxLife: .4
    });
    this.addEffect({
      type: 'ring', x, y: WORLD.ground, radius: 120,
      color: '#ff9a45', life: .5, maxLife: .5, lineWidth: 4
    });
    this.burst(x, WORLD.ground - 18, '#ff8a3d', 20, 240);
    GameAudio.explosion();
    this.shake = Math.max(this.shake, 9);
    if (target && !target.dead && Math.abs(target.x - x) < 100 && target.y > WORLD.ground - 140) {
      this.dealDamage(p.owner, target, 36, {
        kb: 180, stun: .25, type: 'skill', color: '#ff9a45',
        dir: U.sign(target.x - x) || 1, status: { type: 'burn', time: 2.2, dmg: 7, color: '#ff9a45', source: p.owner }
      });
    }
  },

  meteorExplode(p, target) {
    const x = p.x, y = WORLD.ground;
    this.explode(x, y - 20, 132, p.color, p.owner, p.damage, { burn: true, heavy: true, type: p.attackType, sourceAction: p.sourceAction });
  },

  explode(x, y, radius, color, owner, damage, opts = {}) {
    this.addEffect({
      type: 'burst', x, y, radius,
      color, seed: U.rand(0, 5), life: .48, maxLife: .48
    });
    this.addEffect({
      type: 'ring', x, y: y + 20, radius: radius * 1.5,
      color, life: .55, maxLife: .55, lineWidth: 5
    });
    this.burst(x, y, color, 24, 350);
    this.shake = Math.max(this.shake, opts.heavy ? 12 : 7);
    GameAudio.explosion();
    const target = owner === this.player ? this.enemy : this.player;
    if (target && !target.dead) {
      const dx = target.x - x;
      const dy = (target.y - 80) - y;
      if (Math.abs(dx) < radius && Math.abs(dy) < radius + 80) {
        this.dealDamage(owner, target, damage, {
          kb: 260, stun: .3, type: opts.type || 'ult', color, heavy: true,
          sourceAction: opts.sourceAction,
          dir: U.sign(dx) || 1,
          status: opts.burn ? { type: 'burn', time: 2, dmg: 7, color: '#ff9a45', source: owner } : null
        });
      }
    }
  },

  smallImpact(x, y, color, count) {
    this.burst(x, y, color, count, 140);
    this.addEffect({
      type: 'ring', x, y, radius: 22, color,
      life: .22, maxLife: .22, lineWidth: 2
    });
  },

  /* ---------------- 区域 / 状态 ---------------- */

  addZone(z) {
    this.zones.push(z);
  },

  updateZones(dt) {
    for (const z of this.zones) {
      z.life -= dt;
      if (z.type === 'fire') {
        z.tick -= dt;
        if (Math.random() < dt * 18) {
          this.particles.push({
            x: z.x + U.rand(-z.radius * .8, z.radius * .8),
            y: WORLD.ground - U.rand(0, 18), vx: U.rand(-15, 15), vy: U.rand(-80, -30),
            gravity: -20, life: U.rand(.3, .8), maxLife: .8, size: U.rand(1, 3),
            color: '#ff9a45', shape: 'circle', alpha: .7
          });
        }
        if (z.tick <= 0) {
          z.tick = .42;
          const target = z.owner === this.player ? this.enemy : this.player;
          if (target && !target.dead && Math.abs(target.x - z.x) < z.radius && target.y > WORLD.ground - 150) {
            this.dealDamage(z.owner, target, z.damage, {
              type: 'dot', color: '#ff9a45', noFeedback: true, energy: true,
              status: { type: 'burn', time: 1.15, dmg: 5, color: '#ff9a45', source: z.owner }
            });
          }
        }
      } else if (z.type === 'trap') {
        if (!z.armed) {
          z.armTimer -= dt;
          if (z.armTimer <= 0) z.armed = true;
        } else {
          const target = z.owner === this.player ? this.enemy : this.player;
          if (target && !target.dead && Math.abs(target.x - z.x) < 68 && target.y > WORLD.ground - 90) {
            z.life = 0;
            const hit = this.dealDamage(z.owner, target, z.damage, {
              kb: 60, stun: 1.15, type: 'skill', color: '#8aff7a',
              dir: U.sign(target.x - z.x) || 1,
              status: { type: 'root', time: 1.15, color: '#8aff7a' }
            });
            if (hit) target.addStatus('slow', 1.5, { amount: .45, color: '#8aff7a' });
            this.addEffect({
              type: 'ring', x: z.x, y: WORLD.ground, radius: 90,
              color: '#8aff7a', life: .4, maxLife: .4, lineWidth: 4
            });
            this.burst(z.x, WORLD.ground - 20, '#8aff7a', 20, 250);
            this.shake = Math.max(this.shake, 6);
            GameAudio.trap();
          }
        }
      } else if (z.type === 'smoke') {
        const target = z.owner === this.player ? this.enemy : this.player;
        const inside = target && !target.dead && Math.abs(target.x - z.x) < z.radius && target.y > WORLD.ground - 155;
        if (inside) {
          target.addStatus('slow', .6, { amount: .38, color: z.color });
          z.tick -= dt;
          if (z.tick <= 0) {
            z.tick = .48;
            this.dealDamage(z.owner, target, z.damage, {
              type: 'dot', color: z.color, noFeedback: true, energy: false,
              kb: 0, stun: 0, silent: true
            });
          }
        }
      }
    }
    this.zones = this.zones.filter(z => z.life > 0);
  },

  /* ---------------- 视觉实体 ---------------- */

  addEffect(e) {
    e.maxLife = e.maxLife || e.life || .4;
    this.effects.push(e);
    if (this.effects.length > 100) this.effects.splice(0, this.effects.length - 100);
  },

  updateEffects(dt) {
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter(e => e.life > 0);
  },

  burst(x, y, color, count, power, shape = 'line') {
    for (let i = 0; i < count; i++) {
      const ang = U.rand(0, Math.PI * 2);
      const speed = U.rand(power * .25, power);
      this.particles.push({
        x, y, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed - 40,
        gravity: 900, life: U.rand(.2, .55), maxLife: .55,
        size: U.rand(1.2, 2.8), color, shape, alpha: U.rand(.5, 1)
      });
    }
    const limit = document.body.classList.contains('touch-device') ? 180 : 360;
    if (this.particles.length > limit) this.particles.splice(0, this.particles.length - limit);
  },

  dust(x, y, color, count, power = 130) {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + U.rand(-12, 12), y: y - U.rand(0, 8),
        vx: U.rand(-power, power) * .6, vy: U.rand(-power * .4, -15),
        gravity: 320, life: U.rand(.25, .6), maxLife: .6,
        size: U.rand(2, 5), color: color || '#cfd7db',
        shape: 'smoke', alpha: U.rand(.1, .3), blend: false
      });
    }
  },

  muzzleFlash(x, y, dir, d, scale = 1) {
    this.addEffect({
      type: 'burst', x: x + dir * 8, y, radius: 34 * scale,
      color: d.color2, seed: U.rand(0, 3), life: .12, maxLife: .12
    });
    for (let i = 0; i < 7; i++) {
      this.particles.push({
        x, y, vx: dir * U.rand(150, 600) * scale, vy: U.rand(-90, 90),
        gravity: 60, life: U.rand(.08, .25), maxLife: .25,
        size: U.rand(1, 3), color: i % 2 ? '#fff' : d.color2, shape: 'line', alpha: .9
      });
    }
    this.dust(x, y, '#d7e5e8', 4, 80);
  },

  floatText(x, y, text, color, size = 20, small = false) {
    if (this.floaters.length >= 40) this.floaters.shift();
    this.floaters.push({
      x, y, text, color: color || '#fff', size, life: .75, maxLife: .75,
      vy: -58, small
    });
  },

  updateParticles(dt) {
    for (const p of this.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.gravity) p.vy += p.gravity * dt;
      p.vx *= Math.exp(-2.2 * dt);
    }
    this.particles = this.particles.filter(p => p.life > 0);
    const limit = document.body.classList.contains('touch-device') ? 180 : 360;
    if (this.particles.length > limit) this.particles.splice(0, this.particles.length - limit);
  },

  updateFloaters(dt) {
    for (const f of this.floaters) {
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= Math.exp(-2 * dt);
    }
    this.floaters = this.floaters.filter(f => f.life > 0);
  },

  shakeNow() {
    if (this.shake <= 0) return { x: 0, y: 0 };
    const a = this.shake;
    // 与时间关联的短促震动，在高刷新率下也不会逐帧随机抖动。
    return { x: Math.sin(this.worldTime * 117) * a * .55,
      y: Math.sin(this.worldTime * 93 + 1.7) * a * .28 };
  },

  shakeBy(amount) {
    this.shake = Math.max(this.shake, amount || 0);
  },

  flash(color, alpha) {
    this.flashColor = color;
    this.flashAlpha = Math.max(this.flashAlpha, alpha);
  },

  showAnnounce(main, kicker = '', sub = '', cls = '', duration = 1) {
    this.announceEl.className = 'announce show ' + cls;
    $('announceMain').textContent = main;
    $('announceKicker').textContent = kicker;
    $('announceSub').textContent = sub;
    this.announceTimer = duration;
  },

  updateAnnounce(dt) {
    if (this.announceTimer > 0) {
      this.announceTimer -= dt;
      if (this.announceTimer <= 0) this.announceEl.classList.remove('show');
    }
  },

  toast(text, color, duration = 1.4) {
    this.toastEl.textContent = text;
    this.toastEl.style.color = color || '#fff';
    this.toastEl.classList.add('show');
    this.toastTimer = duration;
  },

  updateToast(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.toastEl.classList.remove('show');
    }
  },

  onUlt(fighter) {
    if (this.training && fighter === this.player) this.trainingTasks.ult = true;
    if (fighter === this.player) {
      this.toast(`终极技能 · ${fighter.data.ult.name}`, fighter.data.color2, 1.3);
    } else {
      this.toast(`对手释放 · ${fighter.data.ult.name}`, '#ff6d79', 1.3);
    }
    this.addEffect({
      type: 'ring', x: fighter.x, y: fighter.y - 75, radius: 48,
      color: fighter.data.color2, life: .45, maxLife: .45, lineWidth: 3
    });
    this.burst(fighter.x, fighter.y - 80, fighter.data.color, 16, 250);
  },

  /* ---------------- HUD ---------------- */

  updateHUD(dt) {
    if (dt > 0 && this.batchUpdating) { this.hudPending = true; return; }
    this.hudAccum = (this.hudAccum || 0) + dt;
    if (dt > 0 && !this.hudDirty && this.hudAccum + 1e-8 < 1 / 30) return;
    this.hudAccum = 0;
    this.hudDirty = false;
    if (!this.player) return;
    const p = this.player, e = this.enemy;
    const p1 = p.hp / p.maxHp, p2 = e.hp / e.maxHp;
    this.hudLag1 = Math.max(p.hp, this.hudLag1 - p.maxHp * .55 * Math.max(dt, .001));
    this.hudLag2 = Math.max(e.hp, this.hudLag2 - e.maxHp * .55 * Math.max(dt, .001));

    $('p1HpFill').style.width = (p1 * 100).toFixed(2) + '%';
    $('p2HpFill').style.width = (p2 * 100).toFixed(2) + '%';
    $('p1HpLag').style.width = (this.hudLag1 / p.maxHp * 100).toFixed(2) + '%';
    $('p2HpLag').style.width = (this.hudLag2 / e.maxHp * 100).toFixed(2) + '%';
    $('p1HpText').textContent = `HP ${Math.ceil(p.hp)} / ${p.maxHp}`;
    $('p2HpText').textContent = `HP ${Math.ceil(e.hp)} / ${e.maxHp}`;
    $('p1EnergyFill').style.width = p.energy.toFixed(1) + '%';
    $('p2EnergyFill').style.width = e.energy.toFixed(1) + '%';
    $('p1EnergyText').textContent = Math.floor(p.energy) + '%';
    $('p2EnergyText').textContent = Math.floor(e.energy) + '%';
    $('p1EnergyFill').classList.toggle('full', p.energy >= 100);
    $('p2EnergyFill').classList.toggle('full', e.energy >= 100);

    const p1Guard = U.clamp(p.guardMeter / GAME_RULES.guardMax, 0, 1);
    const p2Guard = U.clamp(e.guardMeter / GAME_RULES.guardMax, 0, 1);
    $('p1GuardFill').style.width = (p1Guard * 100).toFixed(1) + '%';
    $('p2GuardFill').style.width = (p2Guard * 100).toFixed(1) + '%';
    $('p1GuardText').textContent = Math.round(p.guardMeter);
    $('p2GuardText').textContent = Math.round(e.guardMeter);
    $('p1GuardFill').classList.toggle('low', p1Guard < .3);
    $('p2GuardFill').classList.toggle('low', p2Guard < .3);
    $('p1GuardFill').classList.toggle('broken', p.guardBreak > 0);
    $('p2GuardFill').classList.toggle('broken', e.guardBreak > 0);

    const time = this.training ? '∞' : U.formatTime(this.timeLeft);
    $('timer').textContent = time;
    $('timer').classList.toggle('urgent', !this.training && this.timeLeft <= 20 && this.state !== 'over');
    const p1Low = p.hp / p.maxHp < .25;
    const p2Low = e.hp / e.maxHp < .25;
    $('p1HpFill').style.filter = p1Low ? 'saturate(1.4) brightness(1.15)' : '';
    $('p2HpFill').style.filter = p2Low ? 'saturate(1.4) brightness(1.15)' : '';
    $('p1HpFill').closest('.duelist').classList.toggle('low-hp', p1Low);
    $('p2HpFill').closest('.duelist').classList.toggle('low-hp', p2Low);
    $('p1HpFill').closest('.duelist').classList.toggle('hp-hit', p.hitFlash > .02);
    $('p2HpFill').closest('.duelist').classList.toggle('hp-hit', e.hitFlash > .02);

    this.updateSkillHud(p);
    TouchControls.update(p);
    this.updateBuffs(p, 'p1');
    this.updateBuffs(e, 'p2');
    this.updateTrainingUI();

    if (this.comboCount >= 2 && this.comboTimer > 0) {
      this.comboEl.classList.add('show');
      $('comboCount').textContent = this.comboCount;
    } else {
      this.comboEl.classList.remove('show');
    }
    this.comboEl.style.setProperty('--p-color', p.data.color);
  },

  updateSkillHud(p) {
    if (!this.skillCards.length) return;
    this.skillCards.forEach((c, i) => {
      const cd = p.cooldowns[i];
      const cooling = cd > 0.02;
      c.el.classList.toggle('cooling', cooling);
      c.el.classList.toggle('ready', !cooling);
      const ratio = U.clamp(cd / c.cd, 0, 1);
      c.mask.style.setProperty('--cd', ratio.toFixed(3));
      c.text.textContent = cooling ? (cd >= 1 ? Math.ceil(cd) : cd.toFixed(1)) : '';
      const label = $('kbSkillState' + i);
      label.textContent = cooling ? c.text.textContent + 's' : '就绪';
      label.classList.toggle('cooling', cooling);
    });
    const ready = p.energy >= 100;
    this.ultCard.el.classList.toggle('ready', ready);
    this.ultCard.el.classList.toggle('cooling', !ready);
    this.ultCard.mask.style.background = ready ? 'none' : 'rgba(2,4,8,.72)';
    this.ultCard.text.textContent = ready ? '' : Math.round(p.energy) + '%';
    this.ultCard.charge.style.width = p.energy + '%';
    $('kbUltState').textContent = ready ? '就绪' : Math.round(p.energy) + '%';
    $('kbUltState').classList.toggle('cooling', !ready);
  },

  updateBuffs(f, which) {
    const list = [];
    f.statuses.forEach(s => {
      if (s.type === 'warBuff') list.push({ label: '战吼', color: f.data.color, time: s.time });
      else if (s.type === 'slow') list.push({ label: '减速', color: '#79e7ff', time: s.time });
      else if (s.type === 'root') list.push({ label: '定身', color: '#8aff7a', time: s.time });
      else if (s.type === 'burn') list.push({ label: '灼烧', color: '#ff9a45', time: s.time });
      else if (s.type === 'overclock' && !(f.key === 'chilin' && f.empowerTimer > 0)) {
      list.push({ label: '超频', color: '#ffc879', time: s.time });
    }
    });
    if (f.empowerTimer > 0) list.push({ label: '强化', color: '#ffd85e', time: f.empowerTimer });
    if (f.ironWall > 0) list.push({ label: '铁壁', color: f.data.color2, time: f.ironWall });
    if (f.decoyTimer > 0) list.push({ label: '替身', color: f.data.color2, time: f.decoyTimer });
    if (f.key === 'arashi' && f.windCharge > 0) {
      list.push({ label: f.windCharge >= 100 ? '风势·满' : '风势 ' + Math.round(f.windCharge) + '%', color: f.data.color2, time: 99 });
    }
    if (f.key === 'chilin') {
      list.push({ label: f.stance === 'mech' ? '机关形态' : '人剑形态', color: f.data.color2, time: 99 });
      if (f.overload > 0) list.push({ label: '过载 ' + Math.round(f.overload) + '%', color: f.data.color, time: 99 });
    }
    if (f.guardTimer > 0) list.push({ label: '技能格挡', color: f.data.color2, time: f.guardTimer });
    if (f.blocking) list.push({ label: '格挡中', color: '#9fe8ff', time: 99 });
    if (f.dodgeTime > 0) list.push({ label: '闪避', color: '#aef4ff', time: f.dodgeTime });
    if (f.dodgeCd > .05) list.push({ label: '闪避冷却', color: '#aef4ff', time: f.dodgeCd });
    if (f.guardBreak > 0) list.push({ label: '破防', color: '#ff7b7b', time: f.guardBreak });
    if (f.energy >= 100) list.push({ label: '大招就绪', color: f.data.color2, time: 99 });
    const sig = list.map(s => s.label + Math.ceil(s.time)).join('|');
    if ((which === 'p1' ? this.buffSig1 : this.buffSig2) === sig) return;
    if (which === 'p1') this.buffSig1 = sig; else this.buffSig2 = sig;
    const html = list.map(s => `<span class="buff-chip" style="--buff-color:${s.color}"><i></i>${s.label}${s.time < 90 ? ' ' + Math.ceil(s.time) + 's' : ''}</span>`).join('');
    $(which === 'p1' ? 'p1Buffs' : 'p2Buffs').innerHTML = html;
  },

  /* ---------------- 渲染 ---------------- */

  drawDefense(ctx, f) {
    if (f.blocking) {
      ctx.save();
      ctx.translate(f.x + f.facing * 10, f.y - 84);
      ctx.scale(f.facing, 1);
      ctx.globalAlpha = .72;
      ctx.strokeStyle = f.guardMeter < 30 ? '#ffb36b' : '#9fe8ff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 58, -1.02, 1.02);
      ctx.stroke();
      ctx.globalAlpha = .24;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.arc(0, 0, 58, -.88, .88);
      ctx.stroke();
      ctx.restore();
    }
    if (f.guardBreak > 0) {
      ctx.save();
      ctx.translate(f.x, f.y - 84);
      ctx.globalAlpha = .5;
      ctx.strokeStyle = '#ff7b7b';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.arc(0, 0, 62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (f.dodgeTime > 0) {
      ctx.save();
      ctx.globalAlpha = .2;
      ctx.strokeStyle = '#aef4ff';
      ctx.lineWidth = 3;
      for (let i = 1; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(f.x - f.dodgeDir * i * 22, f.y - 72, 22 - i * 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  },

  render() {
    if (this.state === 'menu' || !this.player) return;
    const ctx = this.ctx;
    const sx = this.canvas.width / 1600;
    const sy = this.canvas.height / 900;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    // 后备画布可能高于 1600×900；用单位矩阵清整张画布，再恢复逻辑坐标缩放。
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
    const sh = this.shakeNow();
    const blend = (this.state === 'playing' || this.state === 'intro') && this.hitstop <= 0 ?
      U.clamp(this.simulationAccum * 60, 0, 1) : 1;
    const visualTime = this.worldTime + this.simulationAccum;
    for (const fighter of [this.player, this.enemy]) {
      const oldX = fighter.previousX === undefined ? fighter.x : fighter.previousX;
      const oldY = fighter.previousY === undefined ? fighter.y : fighter.previousY;
      const teleport = Math.abs(oldX - fighter.x) > 180 || Math.abs(oldY - fighter.y) > 180;
      fighter.visualX = teleport ? fighter.x : U.lerp(oldX, fighter.x, blend);
      fighter.visualY = teleport ? fighter.y : U.lerp(oldY, fighter.y, blend);
      fighter.animationAlpha = blend;
    }
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.translate(800, WORLD.ground);
    ctx.scale(this.cameraZoom || 1, this.cameraZoom || 1);
    ctx.translate(-(this.cameraX === undefined ? 800 : this.cameraX), -WORLD.ground);
    Render.drawMap(ctx, this.config.map, this.worldTime);

    for (const z of this.zones) {
      Render.drawZone(ctx, z, this.worldTime);
    }

    Render.drawShadow(ctx, this.player);
    Render.drawShadow(ctx, this.enemy);

    [this.player, this.enemy].forEach(f => {
      Render.drawFighter(ctx, f, visualTime);
      ctx.save(); ctx.translate(f.visualX - f.x, f.visualY - f.y);
      this.drawDefense(ctx, f);
      ctx.restore();
    });

    for (const p of this.projectiles) {
      Render.drawProjectileTrail(ctx, p, this.worldTime);
      Render.drawProjectile(ctx, p, this.worldTime);
    }
    for (const e of this.effects) Render.drawEffect(ctx, e, this.worldTime);
    for (const p of this.particles) Render.drawParticle(ctx, p);
    for (const f of this.floaters) {
      const a = U.clamp(f.life / f.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `${f.small ? 600 : 700} ${f.size}px ${f.small ? '"Cascadia Mono", monospace' : '"Bahnschrift Condensed", "Arial Narrow", sans-serif'}`;
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,.7)';
      ctx.lineWidth = 4;
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
    ctx.restore();

    if (this.flashAlpha > 0.001) {
      ctx.save();
      ctx.globalAlpha = Math.min(.8, this.flashAlpha);
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, 1600, 900);
      ctx.restore();
    }
  }
};

/* =========================================================
   启动
   ========================================================= */

window.addEventListener('load', () => {
  Game.init();
  const params = new URLSearchParams(location.search);
  if (params.get('demo') === '1') {
    setTimeout(() => {
      Game.startMatch({ char: 'warrior', map: 'lava', diff: 'normal', opp: 'mage' });
    }, 250);
  } else if (params.get('training') === '1') {
    setTimeout(() => Game.startTraining(Menu.config), 250);
  } else if (params.get('quick') === '1') {
    setTimeout(() => Game.startMatch(Menu.config), 250);
  }
});
