/* =========================================================
   STICK//ARENA — 战斗实体与 AI
   ========================================================= */

const U = {
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  lerp: (a, b, t) => a + (b - a) * t,
  rand: (a = 0, b = 1) => a + Math.random() * (b - a),
  randInt: (a, b) => Math.floor(a + Math.random() * (b - a + 1)),
  choice: arr => arr[Math.floor(Math.random() * arr.length)],
  sign: v => v < 0 ? -1 : 1,
  formatTime(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  },
  rectOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  },
  circleRect(cx, cy, r, bx, by, bw, bh) {
    const nx = U.clamp(cx, bx, bx + bw);
    const ny = U.clamp(cy, by, by + bh);
    const dx = cx - nx, dy = cy - ny;
    return dx * dx + dy * dy <= r * r;
  },
  sweptRect(x0, y0, x1, y1, rect, radius = 0) {
    let enter = 0, exit = 1;
    for (const [start, delta, low, high] of [
      [x0, x1 - x0, rect.x - radius, rect.x + rect.w + radius],
      [y0, y1 - y0, rect.y - radius, rect.y + rect.h + radius]
    ]) {
      if (Math.abs(delta) < 1e-9) { if (start < low || start > high) return null; continue; }
      const first = (low - start) / delta, last = (high - start) / delta;
      enter = Math.max(enter, Math.min(first, last));
      exit = Math.min(exit, Math.max(first, last));
      if (enter > exit) return null;
    }
    return enter;
  },
  hexA(hex, alpha) {
    if (!hex) return `rgba(255,255,255,${alpha})`;
    if (hex.startsWith('rgb')) return hex.replace(/rgba?\(([^)]+)\)/, (m, p) => `rgba(${p.split(',').slice(0, 3).join(',')},${alpha})`);
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
};

function emptyIntent() {
  return {
    left: false, right: false, jumpPressed: false,
    normalPressed: false, skills: [false, false, false], ult: false,
    block: false, dodgePressed: false
  };
}

/* =========================================================
   斗士
   ========================================================= */

class Fighter {
  constructor(charKey, side, isAI) {
    this.key = charKey;
    this.data = CHARACTERS[charKey];
    this.side = side;
    this.isAI = isAI;
    this.maxHp = this.data.hp;
    this.hp = this.maxHp;
    this.x = side === 'player' ? 500 : 1100;
    this.y = WORLD.ground;
    this.vx = 0;
    this.vy = 0;
    this.facing = side === 'player' ? 1 : -1;
    this.onGround = true;
    this.jumpsLeft = 2;
    this.energy = 0;
    this.cooldowns = [0, 0, 0];
    this.statuses = [];
    this.action = null;
    this.hitstun = 0;
    this.invuln = 0;
    this.hitFlash = 0;
    this.hurtTimer = 0;
    this.animTime = Math.random() * 5;
    this.inputBuffer = {};
    this.stridePhase = 0;
    this.landTimer = 0;
    this.recoil = 0;
    this.impactDir = -1;
    this.poseEpoch = 0;
    this.actionSerial = 0;
    this.visualClock = 0;
    this.previousVisualClock = 0;
    this.previousAnimTime = this.animTime;
    this.previousActionTime = 0;
    this.blockstun = 0;
    this.comboOwner = null;
    this.comboHitCount = 0;
    this.comboIdx = -1;
    this.chainWindow = 0;
    this.queuedBasic = 0;
    this.guardTimer = 0;
    this.guardMeter = GAME_RULES.guardMax;
    this.blocking = false;
    this.guardBreak = 0;
    this.guardRegenDelay = 0;
    this.dodgeTime = 0;
    this.dodgeCd = 0;
    this.dodgeDir = side === 'player' ? 1 : -1;
    this.empowerTimer = 0;
    this.stance = 'blade';
    this.overload = 0;
    this.windCharge = 0;
    this.windReadyShown = false;
    this.overloadShown = false;
    this.ironWall = 0;
    this.decoyTimer = 0;
    this.resonanceTimer = 0;
    this.puppetX = this.x - this.facing * 96;
    this.puppetY = this.y;
    this.puppetLunge = 0;
    this.puppetPulse = 0;
    this.puppetLock = 0;
    this.muzzle = 0;
    this.slowMul = 1;
    this.dead = false;
    this.energyReady = false;
    this.deathTime = 0;
    this.stats = {
      damage: 0, maxCombo: 0, combo: 0, lastHitTime: -10,
      skillHits: 0, ults: 0
    };
    this.ai = null;
    if (isAI) this.ai = new AIBrain(this);
  }

  reset(x, facing) {
    this.visualClock = 0;
    this.previousVisualClock = 0;
    this.previousAnimTime = this.animTime;
    this.previousActionTime = 0;
    this.blockstun = 0;
    this.comboOwner = null;
    this.comboHitCount = 0;
    this.inputBuffer = {};
    this.stridePhase = 0;
    this.landTimer = 0;
    this.recoil = 0;
    this.poseEpoch++;
    this.x = x;
    this.y = WORLD.ground;
    this.previousX = x;
    this.previousY = WORLD.ground;
    this.visualX = x;
    this.visualY = WORLD.ground;
    this.vx = 0;
    this.vy = 0;
    this.facing = facing;
    this.hp = this.maxHp;
    this.energy = 0;
    this.energyReady = false;
    this.cooldowns = [0, 0, 0];
    this.statuses = [];
    this.action = null;
    this.hitstun = 0;
    this.invuln = 0;
    this.hitFlash = 0;
    this.hurtTimer = 0;
    this.dead = false;
    this.deathTime = 0;
    this.onGround = true;
    this.jumpsLeft = 2;
    this.comboIdx = -1;
    this.chainWindow = 0;
    this.queuedBasic = 0;
    this.guardTimer = 0;
    this.guardMeter = GAME_RULES.guardMax;
    this.blocking = false;
    this.guardBreak = 0;
    this.guardRegenDelay = 0;
    this.dodgeTime = 0;
    this.dodgeCd = 0;
    this.dodgeDir = facing;
    this.empowerTimer = 0;
    this.stance = 'blade';
    this.overload = 0;
    this.windCharge = 0;
    this.windReadyShown = false;
    this.overloadShown = false;
    this.ironWall = 0;
    this.decoyTimer = 0;
    this.resonanceTimer = 0;
    this.puppetX = x - facing * 96;
    this.puppetY = WORLD.ground;
    this.puppetLunge = 0;
    this.puppetPulse = 0;
    this.puppetLock = 0;
    this.stats = { damage: 0, maxCombo: 0, combo: 0, lastHitTime: -10, skillHits: 0, ults: 0 };
    if (this.ai) this.ai.reset(this);
  }

  get hurtbox() {
    return { x: this.x - 25, y: this.y - 154, w: 50, h: 154 };
  }

  hasStatus(type) {
    return this.statuses.some(s => s.type === type && s.time > 0);
  }

  status(type) {
    return this.statuses.find(s => s.type === type && s.time > 0);
  }

  isRooted() {
    return this.hasStatus('root');
  }

  canAct() {
    return !this.dead && !this.action && this.hitstun <= 0 && this.blockstun <= 0 && !this.isRooted();
  }

  addStatus(type, duration, data = {}) {
    const existing = this.statuses.find(s => s.type === type);
    if (existing) {
      existing.time = Math.max(existing.time, duration);
      existing.maxTime = Math.max(existing.maxTime, duration);
      Object.assign(existing, data);
    } else {
      this.statuses.push(Object.assign({ type, time: duration, maxTime: duration }, data));
    }
    if (type === 'burn' && !data.silent) {
      Game.burst(this.x, this.y - 70, '#ff8a3d', 5, 120);
    }
  }

  addEnergy(value) {
    if (this.dead || value <= 0) return;
    const before = this.energy;
    this.energy = U.clamp(this.energy + value, 0, GAME_RULES.maxEnergy);
    if (before < 100 && this.energy >= 100 && !this.energyReady) {
      this.energyReady = true;
      Game.onEnergyFull(this);
    }
  }

  updateStatuses(dt) {
    this.slowMul = 1;
    let root = false;
    for (let i = this.statuses.length - 1; i >= 0; i--) {
      const s = this.statuses[i];
      s.time -= dt;
      if (s.type === 'slow') {
        this.slowMul = Math.min(this.slowMul, 1 - (s.amount || 0.5));
      } else if (s.type === 'root') {
        root = true;
      } else if (s.type === 'burn') {
        s.tickAccum = (s.tickAccum || 0) + dt;
        if (s.tickAccum >= 0.5) {
          s.tickAccum -= 0.5;
          if (s.source && !s.source.dead) {
            Game.dealDamage(s.source, this, s.dmg || 8, {
              type: 'dot', noFeedback: true, energy: true, kb: 0, stun: 0,
              color: '#ff8a3d', silent: true
            });
          }
        }
      }
      if (s.time <= 0) this.statuses.splice(i, 1);
    }
    if (root) this.slowMul = 0;
  }

  jump() {
    if (this.jumpsLeft <= 0 || this.dead) return false;
    const first = this.jumpsLeft === 2;
    this.vy = -(first ? this.data.jump : this.data.doubleJump);
    this.onGround = false;
    this.jumpsLeft--;
    if (first) {
      GameAudio.jump();
      Game.dust(this.x, WORLD.ground, this.data.color, 7);
    } else {
      GameAudio.doubleJump();
      Game.addEffect({
        type: 'ring', x: this.x, y: this.y - 20, radius: 38,
        color: this.data.color, life: 0.32, maxLife: 0.32, lineWidth: 2
      });
      Game.burst(this.x, this.y - 22, this.data.color, 8, 150);
    }
    return true;
  }

  tryDodge(intent) {
    if (this.dodgeCd > 0 || !this.onGround || this.guardBreak > 0 || this.hitstun > 0 || this.blockstun > 0 || this.isRooted()) {
      return false;
    }
    const inputDir = (intent.right ? 1 : 0) - (intent.left ? 1 : 0);
    const dir = inputDir || -this.facing;
    this.blocking = false;
    this.dodgeTime = GAME_RULES.dodgeDuration;
    this.dodgeCd = GAME_RULES.dodgeCooldown;
    this.dodgeDir = dir;
    this.invuln = Math.max(this.invuln, GAME_RULES.dodgeDuration * .7);
    this.vx = dir * GAME_RULES.dodgeSpeed;
    this.vy = 0;
    GameAudio.dodge();
    Game.addEffect({
      type: 'ring', x: this.x, y: this.y - 76, radius: 42,
      color: '#aef4ff', life: .28, maxLife: .28, lineWidth: 2
    });
    Game.burst(this.x, this.y - 68, '#9fe8ff', 7, 150);
    return true;
  }

  breakGuard(dir = -this.facing) {
    if (this.dead || this.guardBreak > 0) return;
    this.blocking = false;
    this.blockstun = 0;
    this.guardMeter = 0;
    this.guardBreak = GAME_RULES.guardBreakTime;
    this.guardRegenDelay = GAME_RULES.guardBreakTime;
    this.hitstun = Math.max(this.hitstun, .5);
    this.action = null;
    this.vx = dir * 220;
    GameAudio.guardBreak();
    Game.shakeBy(6);
    Game.addEffect({
      type: 'ring', x: this.x, y: this.y - 78, radius: 76,
      color: '#ff7b7b', life: .42, maxLife: .42, lineWidth: 4
    });
    Game.burst(this.x, this.y - 82, '#ffb0a0', 18, 240);
    Game.floatText(this.x, this.y - 148, '破防', '#ff9b8f', 22);
  }

  handleIntent(intent, opp, dt) {
    if (this.dead || this.isRooted()) return;
    if (this.action) {
      this.blocking = false;
      return;
    }
    if (this.hitstun > 0 || this.blockstun > 0) {
      this.blocking = false;
      return;
    }
    if (this.dodgeTime > 0) return;

    if (intent.dodgePressed && this.tryDodge(intent)) {
      delete this.inputBuffer.dodgePressed;
      return;
    }

    if (intent.block && this.onGround && this.guardMeter > 0 && this.guardBreak <= 0) {
      if (!this.blocking) {
        this.blocking = true;
        this.guardRegenDelay = 0;
        GameAudio.guard();
        Game.addEffect({
          type: 'ring', x: this.x, y: this.y - 78, radius: 52,
          color: '#9fe8ff', life: .26, maxLife: .26, lineWidth: 2
        });
        Game.burst(this.x, this.y - 78, '#9fe8ff', 6, 120);
      }
      this.facing = opp.x >= this.x ? 1 : -1;
      this.vx *= Math.exp(-22 * dt);
      return;
    }

    if (this.blocking) {
      this.blocking = false;
      this.guardRegenDelay = Math.max(this.guardRegenDelay, .3);
    }

    if (intent.ult && this.energy >= 100) {
      delete this.inputBuffer.ult;
      this.castUlt(opp);
      return;
    }
    for (let i = 0; i < 3; i++) {
      if (intent.skills[i] && this.cooldowns[i] <= 0) {
        delete this.inputBuffer['skill' + i];
        this.castSkill(i, opp);
        return;
      }
    }
    if (intent.normalPressed) {
      this.startBasic(opp, false);
      return;
    }
    if (intent.jumpPressed && this.jump()) delete this.inputBuffer.jumpPressed;

    const dir = (intent.right ? 1 : 0) - (intent.left ? 1 : 0);
    const speed = this.data.speed * this.slowMul * (this.isAI && this.ai ? this.ai.cfg.move : 1);
    if (dir !== 0) {
      const accel = this.onGround ? 38 : 13;
      this.vx = U.lerp(this.vx, dir * speed, 1 - Math.exp(-accel * dt));
    } else {
      const fric = this.onGround ? 30 : 2.8;
      this.vx *= Math.exp(-fric * dt);
    }
  }

  bufferInput(intent, dt = 0) {
    for (const key of Object.keys(this.inputBuffer)) {
      this.inputBuffer[key] -= dt;
      if (this.inputBuffer[key] <= 0) delete this.inputBuffer[key];
    }
    for (const key of ['normalPressed', 'jumpPressed', 'dodgePressed', 'ult']) {
      if (intent[key]) this.inputBuffer[key] = key === 'jumpPressed' ? COMBAT.jumpBuffer : COMBAT.attackBuffer;
    }
    intent.skills.forEach((pressed, i) => { if (pressed) this.inputBuffer['skill' + i] = COMBAT.attackBuffer; });
  }

  bufferedIntent(intent) {
    const out = Object.assign({}, intent, { skills: intent.skills.slice() });
    for (const key of ['normalPressed', 'jumpPressed', 'dodgePressed', 'ult']) {
      out[key] = !!(intent[key] || this.inputBuffer[key]);
    }
    out.skills = out.skills.map((pressed, i) => !!(pressed || this.inputBuffer['skill' + i]));
    return out;
  }

  update(dt, opp, intent) {
    this.previousVisualClock = this.visualClock;
    this.previousAnimTime = this.animTime;
    this.previousActionTime = this.action ? this.action.time : 0;
    this.visualClock += dt;
    this.bufferInput(intent, dt);
    intent = this.bufferedIntent(intent);
    this.previousX = this.x;
    this.previousY = this.y;
    this.animTime += dt;
    this.stridePhase += Math.abs(this.vx) * dt * .035;
    this.landTimer = Math.max(0, this.landTimer - dt);
    this.recoil *= Math.exp(-18 * dt);
    if (this.muzzle > 0) this.muzzle = Math.max(0, this.muzzle - dt * 6);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.guardTimer = Math.max(0, this.guardTimer - dt);
    this.guardBreak = Math.max(0, this.guardBreak - dt);
    this.guardRegenDelay = Math.max(0, this.guardRegenDelay - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.empowerTimer = Math.max(0, this.empowerTimer - dt);
    this.ironWall = Math.max(0, this.ironWall - dt);
    this.decoyTimer = Math.max(0, this.decoyTimer - dt);
    this.resonanceTimer = Math.max(0, this.resonanceTimer - dt);
    this.chainWindow = Math.max(0, this.chainWindow - dt);
    this.queuedBasic = Math.max(0, this.queuedBasic - dt);
    for (let i = 0; i < 3; i++) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    if (this.key === 'senmen') {
      this.puppetY = this.y;
      this.puppetPulse += dt;
      if (this.puppetLock > 0) {
        // 替身期间傀儡钉在原地，玩家可以拉开距离诱骗对手。
        this.puppetLock = Math.max(0, this.puppetLock - dt);
        this.puppetLunge = 0;
      } else {
        this.puppetLunge *= Math.exp(-5 * dt);
        const puppetTarget = this.x - this.facing * 96 + this.facing * this.puppetLunge;
        this.puppetX += (puppetTarget - this.puppetX) * (1 - Math.exp(-13 * dt));
      }
    }
    this.updateStatuses(dt);
    const wasDodging = this.dodgeTime > 0;
    if (wasDodging) {
      this.dodgeTime = Math.max(0, this.dodgeTime - dt);
      this.vx = this.dodgeDir * GAME_RULES.dodgeSpeed;
      this.vy = 0;
      this.blocking = false;
    }

    if (this.dead) {
      this.deathTime += dt;
      this.vy += WORLD.gravity * dt;
      this.y += this.vy * dt;
      if (this.y > WORLD.ground) { this.y = WORLD.ground; this.vy = 0; }
      return;
    }

    if (this.hitstun > 0) this.hitstun = Math.max(0, this.hitstun - dt);
    if (this.blockstun > 0) this.blockstun = Math.max(0, this.blockstun - dt);
    if (this.hitstun > 0 || this.blockstun > 0) this.vx *= Math.exp(-10 * dt);
    if (this.hitstun <= 0 && this.comboHitCount) {
      if (this.comboOwner) this.comboOwner.stats.combo = 0;
      this.comboOwner = null;
      this.comboHitCount = 0;
    }

    if (!this.action && this.hitstun <= 0 && this.blockstun <= 0 && !this.isRooted()) {
      this.facing = opp.x >= this.x ? 1 : -1;
    }

    if (this.action) {
      if (intent.normalPressed && this.action.type === 'basic' && this.comboIdx < 2) {
        this.queuedBasic = this.action.duration - this.action.time + .2;
        delete this.inputBuffer.normalPressed;
        intent.normalPressed = false;
      }
      const a = this.action;
      const confirmed = !!a.contact;
      const recovery = a.type === 'basic' && a.time >= (confirmed ? a.startup + 1 / 60 : a.duration * .88);
      const canDodge = intent.dodgePressed && this.dodgeCd <= 0 && this.onGround && this.guardBreak <= 0;
      const canSpecial = confirmed && (intent.ult && this.energy >= 100 ||
        intent.skills.some((pressed, i) => pressed && this.cooldowns[i] <= 0));
      const canJumpCancel = a.contact === 'hit' && intent.jumpPressed && this.jumpsLeft > 0 && this.comboIdx < 2;
      const skillToUlt = a.type === 'skill' && a.contact === 'hit' && a.eventIndex >= a.events.length &&
        a.time >= a.lastEventAt + 2 / 60 && intent.ult && this.energy >= 100;
      if (((recovery && (canDodge || canSpecial || canJumpCancel)) || skillToUlt) && this.hitstun <= 0 && this.blockstun <= 0 && !this.isRooted()) {
        this.action = null;
        this.queuedBasic = 0;
        this.handleIntent(intent, opp, dt);
      } else {
        this.updateAction(dt, opp);
      }
    } else if (this.hitstun <= 0 && this.blockstun <= 0) {
      this.handleIntent(intent, opp, dt);
    }

    // 物理
    const gravityScale = this.action && this.action.opts.gravityScale !== undefined ? this.action.opts.gravityScale : 1;
    if (!this.onGround) this.vy += WORLD.gravity * gravityScale * dt;
    this.x += this.vx * dt;
    this.x = U.clamp(this.x, WORLD.left, WORLD.right);
    if (!this.onGround) {
      this.y += this.vy * dt;
      if (this.y >= WORLD.ground) {
        const landingSpeed = this.vy;
        this.y = WORLD.ground;
        this.vy = 0;
        this.onGround = true;
        this.jumpsLeft = 2;
        this.landTimer = .16;
        if (landingSpeed > 420) {
          Game.dust(this.x, WORLD.ground, this.data.color2, 6, 100);
          Game.addEffect({ type: 'ring', x: this.x, y: WORLD.ground + 2, radius: 35,
            color: this.data.color2, life: .2, maxLife: .2, lineWidth: 1.4 });
        }
        if (Math.abs(this.vx) > 120) Game.dust(this.x, WORLD.ground, '#cfd7db', 5);
      }
    } else {
      this.y = WORLD.ground;
      this.vy = 0;
      if (this.jumpsLeft !== 2 && !this.action) this.jumpsLeft = 2;
    }

    // 地面摩擦
    if (this.onGround && !this.action && Math.abs(this.vx) < 18) this.vx = 0;
    if (Math.abs(this.vx) < 1) this.vx = 0;

    if (this.blocking) {
      this.guardMeter = Math.max(0, this.guardMeter - GAME_RULES.guardDrain * dt);
      if (this.guardMeter <= 0) this.breakGuard(-this.facing);
    } else if (this.guardBreak <= 0 && this.guardRegenDelay <= 0) {
      this.guardMeter = Math.min(GAME_RULES.guardMax, this.guardMeter + GAME_RULES.guardRegen * dt);
    }

    // 冲刺结束收住惯性，避免闪避后继续滑出很远。
    if (wasDodging && this.dodgeTime <= 0) this.vx *= .3;
    if (!Game.collectHits) this.updateActiveHitbox(opp);
  }

  updateActiveHitbox(opp) {
    const a = this.action;
    if (!a || a.type !== 'basic' || !a.basicData.range || this.dead ||
        a.time + 1e-8 < a.startup || a.time >= a.activeEnd) return;
    const b = a.basicData;
    this.meleeStrike(b.range, b.height || 150, b.dmg, {
      kb: b.kb, stun: b.stun, blockstun: b.blockstun, launch: b.launch || 0,
      heavy: !!b.heavy, type: 'basic', color: this.data.color, activePass: true
    }, opp);
  }

  updateAction(dt, opp) {
    const a = this.action;
    if (!a) return;
    a.time += dt;
    if (a.opts.rootMotion && this.onGround) {
      const progress = U.clamp(a.time / (a.startup + 2 / 60), 0, 1);
      const eased = 1 - (1 - progress) * (1 - progress);
      this.x += a.facing * a.opts.rootMotion * (eased - a.rootProgress);
      a.rootProgress = eased;
    }
    while (a.eventIndex < a.events.length && a.time >= a.events[a.eventIndex].t) {
      const event = a.events[a.eventIndex++];
      try { event.fn(); } catch (e) { console.error(e); }
      if (!this.action) return;
    }
    if (a.opts.drag !== undefined) {
      this.vx *= Math.exp(-a.opts.drag * dt);
    } else {
      this.vx *= Math.exp(-9 * dt);
    }
    const chainReady = a.type === 'basic' && this.queuedBasic > 0 && this.comboIdx < 2 &&
      a.eventIndex >= a.events.length && a.time >= (a.contact ? a.basicData.chainAt : a.basicData.whiffChainAt);
    if (a.time >= a.duration || chainReady) {
      const wasBasic = a.type === 'basic';
      const follow = wasBasic && this.queuedBasic > 0 && this.comboIdx < 2;
      if (a.opts.onEnd) a.opts.onEnd();
      this.action = null;
      this.queuedBasic = 0;
      if (follow) {
        this.startBasic(opp, true);
      } else if (wasBasic) {
        if (this.comboIdx < 2) {
          this.chainWindow = 8 / 60;
        } else {
          this.comboIdx = -1;
          this.chainWindow = 0;
        }
      }
    }
  }

  beginAction(type, key, duration, events, opts = {}) {
    const ordered = (events || []).slice().sort((a, b) => a.t - b.t);
    this.action = {
      type, key, time: 0, duration,
      events: ordered, eventIndex: 0, opts, serial: ++this.actionSerial,
      startedAt: this.visualClock, facing: this.facing, contact: null,
      lastEventAt: ordered.length ? ordered[ordered.length - 1].t : 0,
      startup: opts.basicData ? opts.basicData.hitAt : Math.min(duration * .28, .15),
      activeEnd: opts.basicData ? opts.basicData.activeEnd : duration * .7,
      recoveryAt: opts.basicData ? opts.basicData.activeEnd : duration * .7,
      basicData: opts.basicData || null, hitTargets: new Set(), rootProgress: 0
    };
    this.blocking = false;
    this.queuedBasic = 0;
    if (opts.stop !== false) this.vx *= 0.2;
  }

  startBasic(opp, next) {
    if (this.dead) return;
    delete this.inputBuffer.normalPressed;
    let idx;
    if (next) idx = Math.min(2, this.comboIdx + 1);
    else if (this.chainWindow > 0 && this.comboIdx >= 0 && this.comboIdx < 2) idx = this.comboIdx + 1;
    else idx = 0;
    this.comboIdx = idx;
    this.chainWindow = 0;
    this.facing = opp.x >= this.x ? 1 : -1;
    const b = this.data.basic[idx];
    const heavy = !!b.heavy;
    this.beginAction('basic', 'basic' + idx, b.duration, [{
      t: b.hitAt,
      fn: () => this.performBasic(idx, b, opp)
    }], { drag: 22, rootMotion: b.rootMotion, basicData: b });
  }

  performBasic(idx, b, opp) {
    const d = this.data;
    // 弹道从武器前端附近出发；贴脸时收回出生点，避免越过目标导致空枪。
    const muzzle = {
      x: this.x + this.facing * Math.min(d.key === 'archer' ? 74 : 120,
        Math.max(0, Math.abs(opp.x - this.x) - 28)),
      y: this.y - 100
    };
    if (d.key === 'warrior') {
      GameAudio.swing(!!b.heavy);
      this.meleeStrike(b.range, b.height || 150, b.dmg, {
        kb: b.kb, stun: b.stun, launch: b.launch || 0, heavy: !!b.heavy,
        type: 'basic', color: d.color
      }, opp);
      Game.addEffect({
        type: 'slash', x: this.x + this.facing * b.range * 0.35, y: this.y - 85,
        radius: b.range * 0.66, color: d.color, face: this.facing,
        angle: this.facing > 0 ? -0.25 : Math.PI - 0.25, heavy: !!b.heavy,
        life: 0.18, maxLife: 0.18
      });
    } else if (d.key === 'mage') {
      GameAudio.magic();
      const big = !!b.heavy;
      this.spawnOrb(big ? 'bigOrb' : 'orb', {
        x: muzzle.x, y: muzzle.y,
        vx: this.facing * b.speed, vy: big ? -18 : 0,
        radius: b.radius, damage: b.dmg, kb: b.kb, stun: b.stun,
        color: big ? d.color2 : d.color, glow: U.hexA(d.color, .65), life: 1.35
      });
      if (big) {
        Game.addEffect({
          type: 'ring', x: muzzle.x, y: muzzle.y, radius: 30,
          color: d.color2, life: .28, maxLife: .28, lineWidth: 2
        });
      }
    } else if (d.key === 'archer') {
      GameAudio.bow();
      const big = !!b.heavy;
      this.spawnArrow({
        x: muzzle.x, y: muzzle.y,
        vx: this.facing * b.speed, vy: big ? 0 : -8,
        radius: big ? 11 : 9, damage: b.dmg, kb: b.kb, stun: b.stun,
        kind: big ? 'bigArrow' : 'arrow', color: d.color, glow: U.hexA(d.color, .55), life: 1.4
      });
    } else if (d.key === 'barbarian' || d.key === 'goblin' || d.key === 'assassin') {
      const heavy = !!b.heavy;
      if (d.key === 'barbarian') {
        GameAudio.hammer(heavy);
        this.meleeStrike(b.range, b.height || 165, b.dmg, {
          kb: b.kb, stun: b.stun, launch: b.launch || 0, heavy,
          type: 'basic', color: d.color
        }, opp);
        Game.addEffect({
          type: 'slash', x: this.x + this.facing * b.range * 0.42, y: this.y - 76,
          radius: b.range * 0.78, color: d.color, face: this.facing,
          angle: this.facing > 0 ? -0.18 : Math.PI - 0.18, heavy,
          life: 0.2, maxLife: 0.2
        });
        if (heavy) {
          Game.addEffect({
            type: 'burst', x: this.x + this.facing * 78, y: WORLD.ground - 35,
            radius: 92, color: d.color, seed: 1.4, life: .3, maxLife: .3
          });
          Game.dust(this.x + this.facing * 60, WORLD.ground, d.color, 14, 260);
        }
      } else if (d.key === 'goblin') {
        GameAudio.spear();
        this.meleeStrike(b.range, b.height || 145, b.dmg, {
          kb: b.kb, stun: b.stun, launch: b.launch || 0, heavy,
          type: 'basic', color: d.color
        }, opp);
        Game.addEffect({
          type: 'slash', x: this.x + this.facing * b.range * 0.52, y: this.y - 87,
          radius: b.range * 0.55, color: d.color, face: this.facing,
          angle: this.facing > 0 ? 0.02 : Math.PI - 0.02, heavy,
          life: 0.16, maxLife: 0.16
        });
        if (heavy) {
          Game.addEffect({
            type: 'burst', x: this.x + this.facing * b.range * 0.78, y: this.y - 88,
            radius: 54, color: d.color2, seed: 2.2, life: .22, maxLife: .22
          });
        }
      } else {
        GameAudio.dagger();
        this.meleeStrike(b.range, b.height || 135, b.dmg, {
          kb: b.kb, stun: b.stun, launch: b.launch || 0, heavy,
          type: 'basic', color: d.color
        }, opp);
        Game.addEffect({
          type: 'slash', x: this.x + this.facing * b.range * 0.45, y: this.y - 86,
          radius: b.range * 0.62, color: d.color, face: this.facing,
          angle: this.facing > 0 ? -0.55 : Math.PI - 0.55, heavy,
          life: 0.13, maxLife: 0.13
        });
        if (heavy) {
          Game.addEffect({
            type: 'burst', x: this.x + this.facing * b.range * 0.7, y: this.y - 86,
            radius: 46, color: d.color2, seed: 3.4, life: .18, maxLife: .18
          });
        }
      }
    } else if (d.key === 'arashi' || d.key === 'genbu' || d.key === 'astra' ||
               d.key === 'chilin' || d.key === 'senmen') {
      const heavy = !!b.heavy;
      const mech = d.key === 'chilin' && this.stance === 'mech';
      if (d.key === 'astra' && idx === 2) {
        GameAudio.magic();
        this.spawnOrb('star', {
          x: muzzle.x, y: muzzle.y, vx: this.facing * b.speed, vy: -12,
          radius: b.radius, damage: b.dmg, kb: b.kb, stun: b.stun,
          color: d.color2, glow: U.hexA(d.color, .66), life: 1.4
        });
        Game.addEffect({
          type: 'ring', x: muzzle.x, y: muzzle.y, radius: 28,
          color: d.color2, life: .25, maxLife: .25, lineWidth: 2
        });
      } else if (d.key === 'senmen') {
        GameAudio.dagger();
        const hit = this.meleeStrike(b.range, b.height || 140, b.dmg, {
          kb: b.kb, stun: b.stun, launch: b.launch || 0, heavy,
          type: 'basic', color: d.color
        }, opp);
        Game.addEffect({
          type: 'slash', x: this.x + this.facing * b.range * .46, y: this.y - 86,
          radius: b.range * .58, color: d.color, face: this.facing,
          angle: this.facing > 0 ? -.7 : Math.PI - .7, heavy, life: .14, maxLife: .14
        });
        if (heavy) {
          const puppetHit = this.puppetStrike(128, 150, Math.round(b.dmg * .8), {
            kb: 210, stun: .3, heavy: true, color: d.color2
          }, opp);
          if (hit && puppetHit) this.triggerResonance(opp);
        }
      } else if (d.key === 'genbu') {
        GameAudio.hammer(heavy);
        this.meleeStrike(b.range, b.height || 158, b.dmg, {
          kb: b.kb, stun: b.stun, launch: b.launch || 0, heavy,
          type: 'basic', color: d.color
        }, opp);
        Game.addEffect({
          type: 'slash', x: this.x + this.facing * b.range * .38, y: this.y - 78,
          radius: b.range * .7, color: d.color, face: this.facing,
          angle: this.facing > 0 ? -.15 : Math.PI - .15, heavy,
          life: .22, maxLife: .22
        });
        if (heavy) {
          Game.addEffect({
            type: 'burst', x: this.x + this.facing * 72, y: WORLD.ground - 22,
            radius: 105, color: d.color, seed: 1.8, life: .32, maxLife: .32
          });
          Game.shakeBy(7);
          Game.dust(this.x + this.facing * 55, WORLD.ground, d.color, 16, 280);
        }
      } else if (mech) {
        GameAudio.hammer(heavy);
        this.meleeStrike(b.range + 8, b.height || 160, Math.round(b.dmg * 1.18), {
          kb: b.kb + 30, stun: b.stun + .02, launch: b.launch || 0, heavy,
          type: 'basic', color: d.color
        }, opp);
        Game.addEffect({
          type: 'burst', x: this.x + this.facing * 70, y: this.y - 78,
          radius: 68, color: d.color2, seed: 2.6, life: .2, maxLife: .2
        });
        if (heavy) {
          Game.shakeBy(8);
          Game.dust(this.x + this.facing * 50, WORLD.ground, d.color, 12, 240);
        }
      } else {
        GameAudio.swing(heavy);
        this.meleeStrike(b.range, b.height || 150, b.dmg, {
          kb: b.kb, stun: b.stun, launch: b.launch || 0, heavy,
          type: 'basic', color: d.color
        }, opp);
        Game.addEffect({
          type: 'slash', x: this.x + this.facing * b.range * .4, y: this.y - 88,
          radius: b.range * .62, color: d.key === 'arashi' ? d.color2 : d.color,
          face: this.facing, angle: this.facing > 0 ? -.45 : Math.PI - .45,
          heavy, life: .15, maxLife: .15
        });
        if (d.key === 'arashi' && heavy) {
          Game.addEffect({
            type: 'burst', x: this.x + this.facing * 66, y: this.y - 74,
            radius: 58, color: d.color2, seed: 2.1, life: .22, maxLife: .22
          });
        }
      }
    } else {
      const empowered = this.empowerTimer > 0;
      if (empowered) {
        this.empowerTimer = 0;
        Game.toast('火药强化 · 下一发爆裂', d.color2);
      }
      if (b.pellets) {
        GameAudio.shotgun();
        Game.shakeBy(7);
        Game.muzzleFlash(muzzle.x, muzzle.y, this.facing, d);
        for (let i = 0; i < b.pellets; i++) {
          const ang = (i - (b.pellets - 1) / 2) * 0.055;
          this.spawnBullet({
            x: muzzle.x, y: muzzle.y + Math.sin(ang) * 18,
            vx: Math.cos(ang) * b.speed * this.facing,
            vy: Math.sin(ang) * b.speed,
            radius: b.radius, damage: b.dmg, kb: b.kb, stun: b.stun,
            kind: 'pellet', color: d.color2, glow: U.hexA(d.color, .6),
            life: 0.34, empowered: empowered && i === Math.floor(b.pellets / 2)
          });
        }
      } else {
        GameAudio.shoot();
        this.muzzle = 1;
        Game.muzzleFlash(muzzle.x, muzzle.y, this.facing, d);
        this.spawnBullet({
          x: muzzle.x, y: muzzle.y,
          vx: this.facing * b.speed, vy: 0,
          radius: b.radius, damage: b.dmg, kb: b.kb, stun: b.stun,
          kind: 'bullet', color: d.color2, glow: U.hexA(d.color, .7), life: 1.4,
          empowered
        });
        this.vx -= this.facing * 65;
      }
    }
  }

  spawnOrb(kind, o) {
    Game.spawnProjectile(Object.assign({
      owner: this, kind, gravity: 0, pierce: 1, hitOnce: true,
      trail: [], trailTimer: 0, spin: 0, seed: U.rand(0, 6), glow: U.hexA(this.data.color, .65)
    }, o));
  }

  spawnArrow(o) {
    Game.spawnProjectile(Object.assign({
      owner: this, kind: 'arrow', gravity: 120, pierce: 1, hitOnce: true,
      trail: [], trailTimer: 0, sky: false
    }, o));
  }

  spawnBullet(o) {
    Game.spawnProjectile(Object.assign({
      owner: this, gravity: 0, pierce: 1, hitOnce: true,
      trail: [], trailTimer: 0, sky: false
    }, o));
  }

  meleeStrike(range, height, damage, opts, opp) {
    const a = this.action;
    if (a && a.type === 'basic' && opts.type === 'basic') {
      if (Game.collectHits && !opts.activePass) return false;
      if (a.time + 1e-8 < a.startup || a.time >= a.activeEnd || a.hitTargets.has(opp)) return false;
    }
    const box = {
      x: this.facing > 0 ? this.x + 4 : this.x - range - 4,
      y: this.y - height,
      w: range + 8,
      h: height
    };
    if (U.rectOverlap(box, opp.hurtbox)) {
      const hit = Game.dealDamage(this, opp, damage, Object.assign({
        type: 'basic', color: this.data.color, dir: this.facing
      }, opts));
      if (hit && a && a.type === 'basic') a.hitTargets.add(opp);
      return hit;
    }
    return false;
  }

  puppetStrike(range, height, damage, opts, opp) {
    if (!opp || opp.dead) return false;
    const oldX = this.x, oldFacing = this.facing;
    this.x = this.puppetX;
    this.facing = opp.x >= this.x ? 1 : -1;
    const hit = this.meleeStrike(range, height, damage, Object.assign({
      type: 'skill', color: this.data.color2, dir: this.facing
    }, opts), opp);
    this.x = oldX;
    this.facing = oldFacing;
    return hit;
  }

  triggerResonance(opp) {
    if (!this.data || this.data.key !== 'senmen' || !opp || opp.dead) return;
    this.resonanceTimer = 0;
    const armored = opp.ironWall > 0 ||
      !!(opp.action && opp.action.opts && (opp.action.opts.superArmor || opp.action.opts.armor));
    if (!armored) {
      opp.hitstun = Math.max(opp.hitstun, .42);
      opp.vx *= .35;
      opp.action = null;
      opp.queuedBasic = 0;
    } else {
      opp.hitstun = Math.max(opp.hitstun, .06);
    }
    Game.floatText(opp.x, opp.y - 178, armored ? '共鸣 · 抵消' : '共鸣 · 僵直', this.data.color2, 20);
    Game.addEffect({
      type: 'ring', x: opp.x, y: opp.y - 82, radius: 74,
      color: this.data.color2, life: .32, maxLife: .32, lineWidth: 4
    });
    Game.addEffect({
      type: 'burst', x: opp.x, y: opp.y - 86, radius: 82,
      color: this.data.color, seed: 3.7, life: .3, maxLife: .3
    });
    GameAudio.hit(true, 'dagger');
    Game.shakeBy(6);
  }

  castSkill(index, opp) {
    if (this.dead || this.action || this.hitstun > 0 || this.cooldowns[index] > 0) return;
    const skill = this.data.skills[index];
    this.cooldowns[index] = skill.cd;
    this.facing = opp.x >= this.x ? 1 : -1;
    this.comboIdx = -1;
    this.chainWindow = 0;
    const d = this.data;
    const dir = this.facing;

    if (d.key === 'warrior') {
      if (index === 0) {
        this.beginAction('skill', 'Q', .66, [
          { t: .1, fn: () => GameAudio.swing(true) },
          {
            t: .27, fn: () => {
              GameAudio.slash();
              Game.shakeBy(7);
              Game.spawnProjectile({
                owner: this, kind: 'shockwave', x: this.x + dir * 55, y: WORLD.ground - 34,
                vx: dir * 660, vy: 0, radius: 58, damage: 96, kb: 420, stun: .4,
                color: d.color, glow: U.hexA(d.color, .7), life: 1.25, gravity: 0,
                pierce: 1, hitOnce: true, trail: [], trailTimer: 0, groundOnly: true
              });
              Game.addEffect({
                type: 'slash', x: this.x + dir * 55, y: WORLD.ground - 50,
                radius: 85, color: d.color, face: dir, angle: dir > 0 ? 0 : Math.PI,
                heavy: true, life: .25, maxLife: .25
              });
              Game.dust(this.x + dir * 60, WORLD.ground, d.color, 14, 260);
            }
          }
        ], { drag: 12 });
      } else if (index === 1) {
        this.guardTimer = .42;
        this.beginAction('skill', 'W', 1.0, [
          {
            t: .05, fn: () => {
              this.addStatus('guard', .4, { silent: true });
              Game.addEffect({
                type: 'ring', x: this.x, y: this.y - 78, radius: 44,
                color: d.color2, life: .3, maxLife: .3, lineWidth: 3
              });
              GameAudio.charge();
            }
          },
          { t: .18, fn: () => { this.vx = dir * 900; GameAudio.dash(); Game.dust(this.x, WORLD.ground, d.color, 10); } },
          {
            t: .33, fn: () => {
              this.meleeStrike(116, 170, 98, {
                kb: 520, stun: .4, launch: 160, heavy: true, type: 'skill', color: d.color
              }, opp);
              Game.addEffect({
                type: 'burst', x: this.x + dir * 70, y: this.y - 90, radius: 72,
                color: d.color, seed: 1.3, life: .25, maxLife: .25
              });
              Game.shakeBy(9);
            }
          },
          {
            t: .51, fn: () => {
              this.meleeStrike(112, 170, 88, {
                kb: 470, stun: .35, launch: 120, heavy: true, type: 'skill', color: d.color
              }, opp);
            }
          }
        ], { drag: 2.8, superArmor: true });
      } else {
        this.beginAction('skill', 'E', .72, [
          { t: .06, fn: () => GameAudio.roar() },
          {
            t: .2, fn: () => {
              const heal = Math.min(130, this.maxHp - this.hp);
              this.hp += heal;
              this.addStatus('warBuff', 6, { color: d.color });
              this.addStatus('slow', .8, { amount: .3, color: d.color2 });
              Game.addEffect({
                type: 'ring', x: this.x, y: this.y - 70, radius: 190,
                color: d.color2, life: .65, maxLife: .65, lineWidth: 5, fill: true
              });
              Game.burst(this.x, this.y - 80, d.color2, 20, 260);
              Game.floatText(this.x, this.y - 180, `+${Math.round(heal)}`, d.color2, 26);
              Game.shakeBy(5);
              GameAudio.heal();
            }
          }
        ], { drag: 10 });
      }
    } else if (d.key === 'mage') {
      if (index === 0) {
        this.beginAction('skill', 'Q', .55, [
          { t: .12, fn: () => GameAudio.magic() },
          {
            t: .24, fn: () => {
              for (let i = -2; i <= 2; i++) {
                const ang = i * 0.085;
                Game.spawnProjectile({
                  owner: this, kind: 'star', x: this.x + dir * 42, y: this.y - 100,
                  vx: dir * 800 * Math.cos(ang), vy: Math.sin(ang) * 800,
                  radius: 9, damage: 27, kb: 85, stun: .13,
                  color: i === 0 ? d.color2 : d.color, glow: U.hexA(d.color, .65),
                  life: 1.15, gravity: 0, pierce: 1, hitOnce: true,
                  trail: [], trailTimer: 0
                });
              }
              Game.addEffect({
                type: 'ring', x: this.x + dir * 45, y: this.y - 100, radius: 34,
                color: d.color2, life: .25, maxLife: .25, lineWidth: 2
              });
            }
          }
        ], { drag: 12 });
      } else if (index === 1) {
        this.beginAction('skill', 'W', .8, [
          { t: .1, fn: () => GameAudio.frost() },
          {
            t: .26, fn: () => {
              const cx = this.x;
              const cy = this.y - 75;
              Game.addEffect({
                type: 'frost', x: cx, y: cy, radius: 245, color: d.color2,
                life: .6, maxLife: .6, seed: 0
              });
              Game.addEffect({
                type: 'ring', x: cx, y: WORLD.ground, radius: 250,
                color: d.color2, life: .55, maxLife: .55, lineWidth: 3
              });
              const dx = opp.x - cx, dy = (opp.y - 75) - cy;
              if (Math.sqrt(dx * dx + dy * dy) < 255) {
                Game.dealDamage(this, opp, 68, {
                  kb: 120, stun: .45, type: 'skill', color: d.color2,
                  dir: U.sign(opp.x - cx), status: { type: 'slow', time: 2.2, amount: .56, color: d.color2 },
                  heavy: false
                });
              }
              Game.burst(cx, cy, d.color2, 18, 270);
              Game.shakeBy(6);
            }
          }
        ], { drag: 12 });
      } else {
        this.beginAction('skill', 'E', .52, [
          {
            t: .06, fn: () => {
              const oldX = this.x, oldY = this.y;
              this.invuln = .45;
              let nx = this.x + dir * 285;
              if (nx < WORLD.left + 30 || nx > WORLD.right - 30) nx = this.x - dir * 220;
              this.x = U.clamp(nx, WORLD.left, WORLD.right);
              this.vx = 0;
              GameAudio.blink();
              Game.addEffect({
                type: 'burst', x: oldX, y: oldY - 78, radius: 120,
                color: d.color, seed: .7, life: .45, maxLife: .45
              });
              Game.addEffect({
                type: 'ring', x: this.x, y: this.y - 78, radius: 40,
                color: d.color2, life: .35, maxLife: .35, lineWidth: 2
              });
              Game.burst(oldX, oldY - 78, d.color, 16, 210);
              const dx = opp.x - oldX;
              if (Math.abs(dx) < 180) {
                Game.dealDamage(this, opp, 58, {
                  kb: 220, stun: .25, type: 'skill', color: d.color,
                  dir: dx >= 0 ? 1 : -1, status: { type: 'slow', time: 1.2, amount: .35, color: d.color2 }
                });
              }
            }
          }
        ], { drag: 8 });
      }
    } else if (d.key === 'archer') {
      if (index === 0) {
        this.beginAction('skill', 'Q', .6, [
          { t: .1, fn: () => GameAudio.bow() },
          {
            t: .16, fn: () => {
              for (let i = 0; i < 3; i++) {
                this.spawnArrow({
                  x: this.x + dir * 42, y: this.y - 98 + (i - 1) * 5,
                  vx: dir * 1180, vy: (i - 1) * 35,
                  radius: 9, damage: 29, kb: 80, stun: .13,
                  kind: 'arrow', color: d.color, glow: U.hexA(d.color, .55), life: 1.25
                });
              }
            }
          }
        ], { drag: 12 });
      } else if (index === 1) {
        this.beginAction('skill', 'W', .5, [
          { t: .1, fn: () => GameAudio.trap() },
          {
            t: .18, fn: () => {
              const tx = U.clamp(this.x + dir * 72, WORLD.left + 30, WORLD.right - 30);
              Game.zones = Game.zones.filter(z => !(z.type === 'trap' && z.owner === this));
              Game.addZone({
                type: 'trap', x: tx, y: WORLD.ground, radius: 62,
                owner: this, life: 11, maxLife: 11, armed: false, armTimer: .4,
                damage: 52, triggered: false, seed: 1
              });
              Game.addEffect({
                type: 'ring', x: tx, y: WORLD.ground, radius: 60,
                color: d.color, life: .4, maxLife: .4, lineWidth: 2
              });
            }
          }
        ], { drag: 12 });
      } else {
        this.beginAction('skill', 'E', .68, [
          {
            t: .06, fn: () => {
              this.invuln = .4;
              this.vx = -dir * 690;
              this.vy = -350;
              this.onGround = false;
              GameAudio.dash();
              Game.dust(this.x, WORLD.ground, d.color, 12);
            }
          },
          {
            t: .31, fn: () => {
              GameAudio.bow();
              this.spawnArrow({
                x: this.x + dir * 30, y: this.y - 96, vx: dir * 1200, vy: -25,
                radius: 9, damage: 34, kb: 130, stun: .16, kind: 'arrow',
                color: d.color, glow: U.hexA(d.color, .6), life: 1.3
              });
            }
          },
          {
            t: .42, fn: () => {
              this.spawnArrow({
                x: this.x + dir * 30, y: this.y - 88, vx: dir * 1230, vy: 35,
                radius: 9, damage: 34, kb: 140, stun: .16, kind: 'arrow',
                color: d.color, glow: U.hexA(d.color, .6), life: 1.3
              });
            }
          }
        ], { drag: 1.1 });
      }
    } else if (d.key === 'gunner') {
      if (index === 0) {
        this.beginAction('skill', 'Q', .68, [
          { t: .1, fn: () => GameAudio.swing() },
          {
            t: .28, fn: () => {
              GameAudio.shoot();
              Game.spawnProjectile({
                owner: this, kind: 'molotov', x: this.x + dir * 38, y: this.y - 100,
                vx: dir * 540, vy: -440, radius: 12, damage: 40, kb: 100, stun: .2,
                color: '#ff9a45', glow: U.hexA('#ff8a3d', .6), life: 2.2,
                gravity: 1400, pierce: 1, trail: [], trailTimer: 0, spin: 0,
                molotov: true
              });
            }
          }
        ], { drag: 12 });
      } else if (index === 1) {
        this.beginAction('skill', 'W', .72, [
          {
            t: .22, fn: () => {
              GameAudio.shotgun();
              Game.shakeBy(9);
              this.vx = -dir * 190;
              this.muzzle = 1;
              Game.muzzleFlash(this.x + dir * 70, this.y - 96, dir, d, 1.6);
              for (let i = 0; i < 8; i++) {
                const ang = (i - 3.5) * 0.05;
                this.spawnBullet({
                  x: this.x + dir * 60, y: this.y - 96 + Math.sin(ang) * 15,
                  vx: dir * Math.cos(ang) * 1180, vy: Math.sin(ang) * 1180,
                  radius: 7, damage: 20, kb: 65, stun: .09, kind: 'pellet',
                  color: d.color2, glow: U.hexA(d.color, .65), life: .34
                });
              }
            }
          }
        ], { drag: 9 });
      } else {
        this.beginAction('skill', 'E', .55, [
          {
            t: .05, fn: () => {
              this.invuln = .4;
              this.vx = -dir * 640;
              this.vy = -230;
              this.onGround = false;
              this.empowerTimer = 4;
              GameAudio.dash();
              Game.dust(this.x, WORLD.ground, d.color, 10);
              Game.addEffect({
                type: 'ring', x: this.x, y: this.y - 30, radius: 50,
                color: d.color2, life: .3, maxLife: .3, lineWidth: 2
              });
              Game.toast('战术翻滚 · 下一次普攻强化', d.color2);
            }
          }
        ], { drag: 1.2 });
      }
    } else if (d.key === 'barbarian') {
      if (index === 0) {
        this.beginAction('skill', 'Q', .82, [
          { t: .08, fn: () => { GameAudio.hammer(true); Game.shakeBy(4); } },
          {
            t: .28, fn: () => {
              GameAudio.hammer(true);
              Game.shakeBy(11);
              Game.spawnProjectile({
                owner: this, kind: 'shockwave', x: this.x + dir * 58, y: WORLD.ground - 34,
                vx: dir * 600, vy: 0, radius: 70, damage: 108, kb: 520, stun: .45,
                color: d.color, glow: U.hexA(d.color, .7), life: 1.3, gravity: 0,
                pierce: 1, hitOnce: true, trail: [], trailTimer: 0, groundOnly: true
              });
              Game.addEffect({
                type: 'crack', x: this.x + dir * 82, y: WORLD.ground, radius: 155,
                color: d.color, seed: 1.7, life: .48, maxLife: .48
              });
              Game.addEffect({
                type: 'burst', x: this.x + dir * 88, y: WORLD.ground - 20, radius: 92,
                color: d.color, seed: 1.1, life: .32, maxLife: .32
              });
              Game.dust(this.x + dir * 72, WORLD.ground, d.color, 18, 330);
            }
          }
        ], { drag: 10 });
      } else if (index === 1) {
        this.beginAction('skill', 'W', .98, [
          {
            t: .05, fn: () => {
              this.guardTimer = .45;
              this.addStatus('guard', .45, { silent: true });
              GameAudio.charge();
              Game.addEffect({
                type: 'ring', x: this.x, y: this.y - 76, radius: 52,
                color: d.color2, life: .3, maxLife: .3, lineWidth: 3
              });
            }
          },
          {
            t: .18, fn: () => {
              this.vx = dir * 920;
              GameAudio.dash();
              Game.dust(this.x, WORLD.ground, d.color, 14, 300);
            }
          },
          {
            t: .34, fn: () => {
              this.meleeStrike(136, 185, 112, {
                kb: 560, stun: .42, launch: 210, heavy: true, type: 'skill', color: d.color
              }, opp);
              Game.addEffect({
                type: 'burst', x: this.x + dir * 78, y: this.y - 88, radius: 82,
                color: d.color, seed: 1.6, life: .28, maxLife: .28
              });
              Game.shakeBy(10);
            }
          },
          {
            t: .54, fn: () => {
              this.meleeStrike(126, 175, 76, {
                kb: 500, stun: .36, launch: 150, heavy: true, type: 'skill', color: d.color2
              }, opp);
            }
          }
        ], { drag: 2.6, superArmor: true });
      } else {
        this.beginAction('skill', 'E', .82, [
          { t: .06, fn: () => GameAudio.roar() },
          {
            t: .22, fn: () => {
              const heal = Math.min(115, this.maxHp - this.hp);
              this.hp += heal;
              this.addStatus('warBuff', 6, { color: d.color });
              this.addStatus('slow', .7, { amount: .28, color: d.color2 });
              Game.addEffect({
                type: 'ring', x: this.x, y: this.y - 72, radius: 205,
                color: d.color2, life: .7, maxLife: .7, lineWidth: 5, fill: true
              });
              Game.burst(this.x, this.y - 80, d.color2, 24, 290);
              Game.floatText(this.x, this.y - 184, `+${Math.round(heal)}`, d.color2, 27);
              Game.shakeBy(6);
              GameAudio.heal();
            }
          }
        ], { drag: 10 });
      }
    } else if (d.key === 'goblin') {
      if (index === 0) {
        this.beginAction('skill', 'Q', .58, [
          { t: .08, fn: () => GameAudio.spear() },
          {
            t: .22, fn: () => {
              GameAudio.spear();
              Game.spawnProjectile({
                owner: this, kind: 'spear', x: this.x + dir * 52, y: this.y - 92,
                vx: dir * 1120, vy: 0, radius: 16, damage: 92, kb: 340, stun: .3,
                color: d.color, glow: U.hexA(d.color, .7), life: 1.2,
                gravity: 0, pierce: 2, hitOnce: true, trail: [], trailTimer: 0
              });
              Game.addEffect({
                type: 'ring', x: this.x + dir * 52, y: this.y - 92, radius: 28,
                color: d.color2, life: .22, maxLife: .22, lineWidth: 2
              });
            }
          }
        ], { drag: 11 });
      } else if (index === 1) {
        this.beginAction('skill', 'W', .8, [
          {
            t: .04, fn: () => {
              this.invuln = .35;
              this.vx = -dir * 580;
              GameAudio.dash();
              Game.dust(this.x, WORLD.ground, d.color, 12);
            }
          },
          {
            t: .26, fn: () => {
              this.vx = dir * 940;
              GameAudio.spear();
              Game.dust(this.x, WORLD.ground, d.color2, 10);
            }
          },
          {
            t: .4, fn: () => {
              this.meleeStrike(238, 155, 96, {
                kb: 430, stun: .34, launch: 110, heavy: true, type: 'skill', color: d.color2
              }, opp);
              Game.addEffect({
                type: 'slash', x: this.x + dir * 150, y: this.y - 88,
                radius: 135, color: d.color2, face: dir,
                angle: dir > 0 ? 0.02 : Math.PI - 0.02, heavy: true,
                life: .18, maxLife: .18
              });
              Game.shakeBy(6);
            }
          }
        ], { drag: 3.2 });
      } else {
        this.beginAction('skill', 'E', .56, [
          { t: .08, fn: () => GameAudio.trap() },
          {
            t: .2, fn: () => {
              const tx = U.clamp(this.x + dir * 78, WORLD.left + 30, WORLD.right - 30);
              Game.zones = Game.zones.filter(z => !(z.type === 'trap' && z.owner === this));
              Game.addZone({
                type: 'trap', x: tx, y: WORLD.ground, radius: 68,
                owner: this, life: 10, maxLife: 10, armed: false, armTimer: .5,
                damage: 58, triggered: false, seed: 2.4
              });
              Game.addEffect({
                type: 'ring', x: tx, y: WORLD.ground, radius: 72,
                color: d.color, life: .42, maxLife: .42, lineWidth: 3
              });
              Game.burst(tx, WORLD.ground - 18, d.color, 12, 190);
            }
          }
        ], { drag: 12 });
      }
    } else if (d.key === 'assassin') {
      if (index === 0) {
        this.beginAction('skill', 'Q', .56, [
          {
            t: .04, fn: () => {
              this.invuln = Math.max(this.invuln, .28);
              GameAudio.blink();
            }
          },
          {
            t: .11, fn: () => {
              const oldX = this.x, oldY = this.y;
              const nx = U.clamp(opp.x - dir * 54, WORLD.left + 30, WORLD.right - 30);
              this.x = nx;
              this.facing = opp.x >= this.x ? 1 : -1;
              this.vx = 0;
              Game.addEffect({
                type: 'burst', x: oldX, y: oldY - 82, radius: 78,
                color: d.color, seed: 2.3, life: .28, maxLife: .28
              });
              Game.addEffect({
                type: 'ring', x: this.x, y: this.y - 82, radius: 34,
                color: d.color2, life: .24, maxLife: .24, lineWidth: 2
              });
              Game.burst(oldX, oldY - 82, d.color, 14, 220);
            }
          },
          {
            t: .22, fn: () => {
              this.meleeStrike(160, 165, 84, {
                kb: 250, stun: .28, heavy: true, type: 'skill', color: d.color
              }, opp);
              Game.addEffect({
                type: 'slash', x: this.x + dir * 54, y: this.y - 88,
                radius: 92, color: d.color2, face: this.facing,
                angle: this.facing > 0 ? -0.7 : Math.PI - 0.7, heavy: true,
                life: .16, maxLife: .16
              });
              Game.shakeBy(5);
            }
          }
        ], { drag: 3.4 });
      } else if (index === 1) {
        this.beginAction('skill', 'W', .52, [
          { t: .08, fn: () => GameAudio.dagger() },
          {
            t: .18, fn: () => {
              for (let i = -1; i <= 1; i++) {
                const ang = i * .14;
                Game.spawnProjectile({
                  owner: this, kind: 'dagger', x: this.x + dir * 36, y: this.y - 90,
                  vx: dir * 960 * Math.cos(ang), vy: Math.sin(ang) * 960,
                  radius: 9, damage: 24, kb: 70, stun: .12,
                  color: d.color2, glow: U.hexA(d.color, .65), life: .95,
                  gravity: 0, pierce: 1, hitOnce: true, trail: [], trailTimer: 0,
                  status: { type: 'burn', time: 2.2, dmg: 5, color: d.color, source: this }
                });
              }
              Game.addEffect({
                type: 'burst', x: this.x + dir * 38, y: this.y - 90, radius: 42,
                color: d.color2, seed: 1.2, life: .2, maxLife: .2
              });
            }
          }
        ], { drag: 10 });
      } else {
        this.beginAction('skill', 'E', .62, [
          { t: .06, fn: () => GameAudio.dagger() },
          {
            t: .18, fn: () => {
              const tx = U.clamp(this.x + dir * 105, WORLD.left + 60, WORLD.right - 60);
              Game.addZone({
                type: 'smoke', x: tx, y: WORLD.ground, radius: 148,
                owner: this, life: 4.2, maxLife: 4.2, tick: .35, damage: 7,
                color: d.color, seed: 3.1
              });
              Game.addEffect({
                type: 'burst', x: tx, y: WORLD.ground - 50, radius: 128,
                color: d.color, seed: 2.8, life: .55, maxLife: .55
              });
              Game.burst(tx, WORLD.ground - 40, d.color, 22, 220);
            }
          }
        ], { drag: 12 });
      }
    } else if (d.key === 'arashi') {
      if (index === 0) {
        const charged = this.windCharge >= 100;
        this.beginAction('skill', 'Q', .56, [
          { t: .1, fn: () => GameAudio.slash() },
          {
            t: .19, fn: () => {
              const angles = charged ? [-.16, 0, .16] : [0];
              for (const ang of angles) {
                this.spawnOrb('orb', {
                  x: this.x + dir * 52, y: this.y - 96,
                  vx: dir * 930 * Math.cos(ang), vy: Math.sin(ang) * 930,
                  radius: charged ? 15 : 13, damage: charged ? 44 : 62,
                  kb: 190, stun: .24, color: charged ? d.color2 : d.color,
                  glow: U.hexA(d.color2, .7), life: 1.15,
                  trail: [], trailTimer: 0
                });
              }
              if (charged) {
                this.windCharge = 0;
                this.windReadyShown = false;
                Game.toast('风势释放 · 三段气刃', d.color2, 1);
                Game.shakeBy(6);
              }
              Game.addEffect({
                type: 'slash', x: this.x + dir * 54, y: this.y - 96,
                radius: 70, color: d.color2, face: dir,
                angle: dir > 0 ? -.1 : Math.PI - .1, heavy: charged,
                life: .2, maxLife: .2
              });
            }
          }
        ], { drag: 8 });
      } else if (index === 1) {
        this.beginAction('skill', 'W', .64, [
          {
            t: .06, fn: () => {
              this.invuln = Math.max(this.invuln, .26);
              GameAudio.charge();
            }
          },
          {
            t: .22, fn: () => {
              this.meleeStrike(142, 205, 92, {
                kb: 170, stun: .42, launch: 620, heavy: true, type: 'skill', color: d.color2
              }, opp);
              this.vy = -310;
              this.onGround = false;
              Game.addEffect({
                type: 'slash', x: this.x + dir * 34, y: this.y - 130,
                radius: 96, color: d.color2, face: dir, angle: -1.1, heavy: true,
                life: .2, maxLife: .2
              });
              Game.shakeBy(7);
              GameAudio.hit(true);
            }
          },
          {
            t: .38, fn: () => {
              this.meleeStrike(128, 170, 34, {
                kb: 100, stun: .2, type: 'skill', color: d.color
              }, opp);
            }
          }
        ], { drag: 4, superArmor: true });
      } else {
        this.beginAction('skill', 'E', .62, [
          { t: .08, fn: () => { this.vx = dir * 510; GameAudio.dash(); Game.dust(this.x, WORLD.ground, d.color2, 10, 260); } },
          {
            t: .18, fn: () => {
              this.meleeStrike(172, 156, 44, {
                kb: 80, stun: .22, type: 'skill', color: d.color
              }, opp);
            }
          },
          {
            t: .31, fn: () => {
              this.meleeStrike(180, 166, 48, {
                kb: 120, stun: .25, type: 'skill', color: d.color2
              }, opp);
            }
          },
          {
            t: .45, fn: () => {
              this.meleeStrike(186, 170, 52, {
                kb: 360, stun: .32, launch: 190, heavy: true, type: 'skill', color: d.color2
              }, opp);
              Game.addEffect({
                type: 'ring', x: this.x + dir * 42, y: this.y - 92, radius: 92,
                color: d.color2, life: .3, maxLife: .3, lineWidth: 4
              });
            }
          }
        ], { drag: 4.5 });
      }
    } else if (d.key === 'genbu') {
      if (index === 0) {
        this.beginAction('skill', 'Q', .82, [
          { t: .08, fn: () => { this.addStatus('guard', .32, { silent: true }); GameAudio.charge(); } },
          {
            t: .3, fn: () => {
              const close = Math.abs(opp.x - this.x) < 158 && opp.y > WORLD.ground - 230;
              const grabbed = close && !opp.dead && Game.dealDamage(this, opp, 128, {
                kb: 240, stun: .86, launch: 390, heavy: true, type: 'skill',
                unblockable: true, color: d.color2, dir
              });
              if (grabbed) {
                Game.floatText(opp.x, opp.y - 170, '撼山抱', d.color2, 20);
                Game.addEffect({
                  type: 'burst', x: this.x + dir * 58, y: this.y - 78, radius: 88,
                  color: d.color2, seed: 2.2, life: .36, maxLife: .36
                });
                Game.shakeBy(12);
                GameAudio.hammer(true);
              } else {
                Game.addEffect({
                  type: 'ring', x: this.x + dir * 62, y: this.y - 76, radius: 40,
                  color: d.color, life: .22, maxLife: .22, lineWidth: 2
                });
                GameAudio.swing(true);
              }
            }
          }
        ], { drag: 2.2, superArmor: true });
      } else if (index === 1) {
        this.beginAction('skill', 'W', .48, [
          {
            t: .08, fn: () => {
              this.ironWall = 2.7;
              this.guardTimer = Math.max(this.guardTimer, .2);
              this.addStatus('ironWall', 2.7, { color: d.color2 });
              GameAudio.guard();
              Game.addEffect({
                type: 'ring', x: this.x, y: this.y - 76, radius: 58,
                color: d.color2, life: .45, maxLife: .45, lineWidth: 4
              });
              Game.floatText(this.x, this.y - 178, '铁壁', d.color2, 20);
            }
          }
        ], { drag: 16 });
      } else {
        this.beginAction('skill', 'E', .76, [
          { t: .1, fn: () => GameAudio.charge() },
          {
            t: .3, fn: () => {
              this.meleeStrike(232, 180, 108, {
                kb: 250, stun: .5, launch: 260, heavy: true, type: 'skill', color: d.color2
              }, opp);
              Game.addEffect({
                type: 'crack', x: this.x, y: WORLD.ground, radius: 190,
                color: d.color, seed: 1.6, life: .55, maxLife: .55
              });
              Game.addEffect({
                type: 'ring', x: this.x, y: WORLD.ground, radius: 190,
                color: d.color2, life: .5, maxLife: .5, lineWidth: 7
              });
              Game.dust(this.x, WORLD.ground, d.color, 22, 300);
              Game.shakeBy(16);
              GameAudio.hammer(true);
            }
          }
        ], { drag: 5, superArmor: true });
      }
    } else if (d.key === 'astra') {
      if (index === 0) {
        this.beginAction('skill', 'Q', .52, [
          { t: .08, fn: () => GameAudio.magic() },
          {
            t: .2, fn: () => {
              this.spawnOrb('star', {
                x: this.x + dir * 54, y: this.y - 108,
                vx: dir * 880, vy: 0, radius: 14, damage: 58,
                kb: 180, stun: .24, color: d.color2, glow: U.hexA(d.color2, .7),
                life: 1.25, trail: [], trailTimer: 0
              });
              Game.addEffect({
                type: 'ring', x: this.x + dir * 54, y: this.y - 108, radius: 36,
                color: d.color2, life: .28, maxLife: .28, lineWidth: 2
              });
            }
          }
        ], { drag: 12 });
      } else if (index === 1) {
        const targetX = U.clamp(opp.x, WORLD.left + 40, WORLD.right - 40);
        this.beginAction('skill', 'W', .82, [
          { t: .1, fn: () => GameAudio.charge() },
          {
            t: .3, fn: () => {
              this.spawnOrb('meteor', {
                x: targetX, y: -260, vx: 0, vy: 780, gravity: 1200,
                radius: 42, damage: 112, kb: 310, stun: .42, heavy: true,
                color: d.color, glow: U.hexA(d.color, .6), life: 2.2,
                trail: [], trailTimer: 0, hitOnce: true
              });
              Game.addEffect({
                type: 'target', x: targetX, y: WORLD.ground, radius: 105,
                color: d.color, life: .7, maxLife: .7
              });
            }
          }
        ], { drag: 10 });
      } else {
        this.beginAction('skill', 'E', .66, [
          { t: .08, fn: () => GameAudio.magic() },
          {
            t: .24, fn: () => {
              const spots = [
                U.clamp(this.x - dir * 170, WORLD.left + 50, WORLD.right - 50),
                U.clamp(this.x + dir * 190, WORLD.left + 50, WORLD.right - 50)
              ];
              for (const x of spots) {
                Game.addZone({
                  type: 'starGate', x, y: WORLD.ground, radius: 60,
                  owner: this, life: 7.5, maxLife: 7.5, color: d.color2,
                  seed: U.rand(0, 8), tick: 0
                });
                Game.addEffect({
                  type: 'ring', x, y: WORLD.ground - 92, radius: 74,
                  color: d.color2, life: .5, maxLife: .5, lineWidth: 4
                });
                Game.burst(x, WORLD.ground - 92, d.color, 12, 200);
              }
              Game.floatText(this.x, this.y - 188, '星轨结界', d.color2, 20);
            }
          }
        ], { drag: 9 });
      }
    } else if (d.key === 'chilin') {
      if (index === 0) {
        if (this.stance === 'mech') {
          this.beginAction('skill', 'Q', .82, [
            { t: .1, fn: () => GameAudio.charge() },
            {
              t: .38, fn: () => {
                this.spawnBullet({
                  x: this.x + dir * 58, y: this.y - 100,
                  vx: dir * 1050, vy: 0, radius: 17, damage: 104,
                  kb: 350, stun: .38, kind: 'bullet', color: d.color2,
                  glow: U.hexA(d.color, .7), life: 1.3, heavy: true
                });
                Game.shakeBy(9);
                Game.muzzleFlash(this.x + dir * 58, this.y - 100, dir, d, 1.1);
                GameAudio.shotgun();
              }
            }
          ], { drag: 8, superArmor: true });
        } else {
          this.beginAction('skill', 'Q', .58, [
            {
              t: .08, fn: () => {
                this.invuln = Math.max(this.invuln, .18);
                this.vx = dir * 820;
                GameAudio.dash();
                Game.dust(this.x, WORLD.ground, d.color2, 10, 240);
              }
            },
            {
              t: .2, fn: () => {
                this.meleeStrike(184, 162, 78, {
                  kb: 260, stun: .32, heavy: true, type: 'skill', color: d.color2
                }, opp);
                Game.addEffect({
                  type: 'slash', x: this.x + dir * 60, y: this.y - 90,
                  radius: 100, color: d.color2, face: dir, angle: dir > 0 ? -.05 : Math.PI - .05,
                  heavy: true, life: .18, maxLife: .18
                });
              }
            }
          ], { drag: 4 });
        }
      } else if (index === 1) {
        this.beginAction('skill', 'W', .58, [
          { t: .08, fn: () => GameAudio.charge() },
          {
            t: .2, fn: () => {
              this.overload = Math.min(100, this.overload + 36);
              this.empowerTimer = Math.max(this.empowerTimer, 5);
              this.addStatus('overclock', 5, { color: d.color2 });
              this.overloadShown = false;
              Game.addEffect({
                type: 'ring', x: this.x, y: this.y - 84, radius: 62,
                color: d.color2, life: .5, maxLife: .5, lineWidth: 4
              });
              Game.floatText(this.x, this.y - 186, '齿轮过载', d.color2, 20);
            }
          }
        ], { drag: 12 });
      } else {
        const instant = this.overload >= 100;
        this.beginAction('skill', 'E', instant ? .16 : .38, [
          { t: .04, fn: () => GameAudio.guard() },
          {
            t: instant ? .08 : .18, fn: () => {
              this.stance = this.stance === 'blade' ? 'mech' : 'blade';
              this.overload = Math.min(100, this.overload + 34);
              if (this.overload >= 100) {
                this.empowerTimer = Math.max(this.empowerTimer, 5);
                this.overload = 0;
                this.overloadShown = false;
                Game.toast('超频切换 · 终极技能强化', d.color2, 1.1);
              }
              Game.addEffect({
                type: 'burst', x: this.x, y: this.y - 84, radius: 92,
                color: this.stance === 'mech' ? d.color2 : d.color, seed: 2.1,
                life: .34, maxLife: .34
              });
              Game.burst(this.x, this.y - 84, d.color2, 16, 220);
              GameAudio.hammer(this.stance === 'mech');
              this.overloadShown = false;
            }
          }
        ], { drag: 8 });
      }
    } else if (d.key === 'senmen') {
      if (index === 0) {
        this.beginAction('skill', 'Q', .62, [
          { t: .06, fn: () => GameAudio.dagger() },
          {
            t: .17, fn: () => {
              const playerHit = this.meleeStrike(116, 148, 42, {
                kb: 70, stun: .2, type: 'skill', color: d.color
              }, opp);
              this.puppetLock = 0;
              this.puppetLunge = dir * 145;
              this.puppetX = U.clamp(this.x + dir * 175, WORLD.left + 20, WORLD.right - 20);
              const puppetHit = this.puppetStrike(178, 165, 66, {
                kb: 210, stun: .3, heavy: true, color: d.color2
              }, opp);
              this.resonanceTimer = .42;
              if (playerHit && puppetHit) this.triggerResonance(opp);
              Game.addEffect({
                type: 'slash', x: this.puppetX, y: this.y - 100,
                radius: 92, color: d.color2, face: dir,
                angle: dir > 0 ? -.6 : Math.PI - .6, heavy: true,
                life: .16, maxLife: .16
              });
            }
          }
        ], { drag: 7 });
      } else if (index === 1) {
        this.beginAction('skill', 'W', .5, [
          {
            t: .05, fn: () => {
              this.invuln = Math.max(this.invuln, .3);
              GameAudio.blink();
            }
          },
          {
            t: .14, fn: () => {
              const oldX = this.x;
              this.x = U.clamp(this.x + dir * 180, WORLD.left + 30, WORLD.right - 30);
              this.vx = 0;
              this.facing = opp.x >= this.x ? 1 : -1;
              Game.burst(oldX, this.y - 86, d.color, 16, 230);
              Game.addEffect({
                type: 'ring', x: this.x, y: this.y - 86, radius: 42,
                color: d.color2, life: .28, maxLife: .28, lineWidth: 3
              });
            }
          }
        ], { drag: 12 });
      } else {
        this.beginAction('skill', 'E', .52, [
          { t: .06, fn: () => GameAudio.blink() },
          {
            t: .18, fn: () => {
              this.decoyTimer = 4;
              this.puppetLock = 4;
              this.puppetLunge = 0;
              this.puppetX = U.clamp(this.x - this.facing * 84, WORLD.left + 20, WORLD.right - 20);
              this.addStatus('decoy', 4, { color: d.color2 });
              Game.addEffect({
                type: 'ring', x: this.puppetX, y: this.y - 82, radius: 58,
                color: d.color2, life: .45, maxLife: .45, lineWidth: 3
              });
              Game.addEffect({
                type: 'burst', x: this.x, y: this.y - 86, radius: 74,
                color: d.color, seed: 4.1, life: .3, maxLife: .3
              });
              Game.floatText(this.x, this.y - 186, '傀儡替身', d.color2, 20);
            }
          }
        ], { drag: 8 });
      }
    }
    Game.addEffect({
      type: 'ring', x: this.x, y: this.y - 70, radius: 34,
      color: skill.color, life: .25, maxLife: .25, lineWidth: 2
    });
  }

  castUlt(opp) {
    if (this.dead || this.energy < 100 || this.action) return;
    this.energy = 0;
    this.energyReady = false;
    this.stats.ults++;
    this.cooldowns = [0, 0, 0];
    this.facing = opp.x >= this.x ? 1 : -1;
    this.comboIdx = -1;
    this.chainWindow = 0;
    const d = this.data;
    const dir = this.facing;
    Game.onUlt(this);
    GameAudio.ult();
    Game.flash(d.color, .2);

    if (d.key === 'warrior') {
      let targetX = opp.x;
      this.beginAction('ult', 'R', 1.72, [
        {
          t: .06, fn: () => {
            this.invuln = 1.45;
            this.onGround = false;
            this.vy = -1080;
            this.vx = U.clamp((targetX - this.x) / .68, -1000, 1000);
            GameAudio.charge();
            Game.addEffect({
              type: 'target', x: targetX, y: WORLD.ground, radius: 120,
              color: d.color, life: .85, maxLife: .85
            });
            Game.shakeBy(5);
          }
        },
        {
          t: .5, fn: () => {
            this.x = U.clamp(targetX, WORLD.left, WORLD.right);
            this.vy = 1900;
          }
        },
        {
          t: .72, fn: () => {
            this.y = WORLD.ground;
            this.onGround = true;
            this.vy = 0;
            this.vx = 0;
            Game.shakeBy(24);
            Game.flash('#ffb066', .36);
            Game.addEffect({
              type: 'crack', x: this.x, y: WORLD.ground, radius: 330,
              color: d.color, seed: .8, life: .7, maxLife: .7
            });
            Game.addEffect({
              type: 'ring', x: this.x, y: WORLD.ground, radius: 330,
              color: d.color, life: .75, maxLife: .75, lineWidth: 8
            });
            Game.addEffect({
              type: 'ring', x: this.x, y: WORLD.ground, radius: 220,
              color: d.color2, life: .55, maxLife: .55, lineWidth: 4
            });
            Game.addEffect({
              type: 'burst', x: this.x, y: WORLD.ground - 50, radius: 180,
              color: d.color, seed: 2.1, life: .5, maxLife: .5
            });
            Game.burst(this.x, WORLD.ground - 20, d.color, 38, 460);
            Game.dust(this.x, WORLD.ground, d.color, 26, 420);
            const dx = Math.abs(opp.x - this.x);
            if (dx < 340) {
              Game.dealDamage(this, opp, 260, {
                kb: 560, stun: 1.0, launch: 500, heavy: true,
                type: 'ult', color: d.color, dir: U.sign(opp.x - this.x),
                status: { type: 'slow', time: 2.2, amount: .45, color: d.color2 }
              });
            }
          }
        }
      ], { drag: 10, superArmor: true, gravityScale: 1 });
    } else if (d.key === 'mage') {
      this.beginAction('ult', 'R', 2.5, [
        {
          t: .05, fn: () => {
            this.invuln = .7;
            GameAudio.charge();
            Game.addEffect({
              type: 'ring', x: this.x, y: this.y - 90, radius: 70,
              color: d.color2, life: .8, maxLife: .8, lineWidth: 3
            });
          }
        },
        ...[0.38, .56, .74, .92, 1.1, 1.28, 1.46].map((tm, i) => ({
          t: tm,
          fn: () => {
            const tx = U.clamp(opp.x + U.rand(-130, 130), WORLD.left + 30, WORLD.right - 30);
            Game.addEffect({
              type: 'target', x: tx, y: WORLD.ground, radius: 56,
              color: d.color2, life: .42, maxLife: .42
            });
            Game.spawnProjectile({
              owner: this, kind: 'meteor', x: tx, y: -80 - U.rand(0, 240),
              vx: U.rand(-20, 20), vy: 1180, radius: 30, damage: 56,
              kb: 240, stun: .25, color: d.color, glow: U.hexA(d.color, .7),
              life: 3, gravity: 260, pierce: 1, trail: [], trailTimer: 0,
              meteor: true, seed: i * 2.1, burn: true
            });
          }
        }))
      ], { drag: 20, superArmor: true });
    } else if (d.key === 'archer') {
      this.beginAction('ult', 'R', 2.75, [
        { t: .08, fn: () => { this.invuln = .35; GameAudio.charge(); } },
        ...[.38, .78, 1.18].map((tm, wave) => ({
          t: tm,
          fn: () => {
            for (let i = 0; i < 4; i++) {
              const tx = U.clamp(opp.x + (i - 1.5) * 52 + U.rand(-16, 16), WORLD.left + 25, WORLD.right - 25);
              Game.spawnProjectile({
                owner: this, kind: 'skyArrow',
                x: tx, y: -60 - U.rand(0, 250),
                vx: U.rand(-30, 30), vy: 1250 + U.rand(0, 150),
                radius: 18, damage: 32, kb: 120, stun: .16,
                color: d.color, glow: U.hexA(d.color, .6), life: 2.6,
                gravity: 300, pierce: 1, trail: [], trailTimer: 0,
                skyArrow: true
              });
              Game.addEffect({
                type: 'target', x: tx, y: WORLD.ground, radius: 38,
                color: d.color2, life: .3, maxLife: .3
              });
            }
            if (wave === 2) {
              Game.shakeBy(7);
              GameAudio.bow();
            }
          }
        })),
        {
          t: 1.55, fn: () => {
            GameAudio.bow();
            Game.shakeBy(6);
            this.spawnArrow({
              x: this.x + dir * 52, y: this.y - 94,
              vx: dir * 1500, vy: 0, radius: 18, damage: 105,
              kb: 420, stun: .35, kind: 'bigArrow', color: d.color2,
              glow: U.hexA(d.color2, .8), life: 1.6
            });
          }
        }
      ], { drag: 18, superArmor: true });
    } else if (d.key === 'gunner') {
      let beamX = this.x;
      this.beginAction('ult', 'R', 2.25, [
        {
          t: .05, fn: () => {
            this.invuln = 1.2;
            this.vx = 0;
            GameAudio.charge();
            this.chargeBeam = true;
          }
        },
        {
          t: .18, fn: () => {
            const from = this.facing > 0 ? this.x + 44 : this.x - 1480;
            Game.addEffect({
              type: 'beam', x: from, y: this.y - 92, height: 5,
              length: 1480, color: U.hexA(d.color, .55),
              life: 1.0, maxLife: 1.0, charge: true
            });
          }
        },
        {
          t: 1.16, fn: () => {
            this.chargeBeam = false;
            this.muzzle = 1;
            const from = this.facing > 0 ? this.x + 48 : this.x - 1480;
            Game.addEffect({
              type: 'beam', x: from, y: this.y - 92, height: 112,
              length: 1480, color: d.color, life: .55, maxLife: .55
            });
            Game.addEffect({
              type: 'burst', x: this.x + this.facing * 70, y: this.y - 92,
              radius: 115, color: d.color2, seed: 1.9, life: .4, maxLife: .4
            });
            Game.shakeBy(22);
            Game.flash('#d8fdff', .55);
            GameAudio.beam();
            const targetLineY = this.y - 92;
            const inFront = this.facing > 0 ? opp.x >= this.x : opp.x <= this.x;
            if (inFront && Math.abs((opp.y - 80) - targetLineY) < 120) {
              Game.dealDamage(this, opp, 250, {
                kb: 500, stun: .55, launch: 220, heavy: true,
                type: 'ult', color: d.color2, dir: this.facing,
                status: { type: 'burn', time: 2.2, dmg: 8, color: '#ff9a45' }
              });
            }
            Game.burst(this.x + this.facing * 100, this.y - 92, d.color2, 25, 320);
          }
        }
      ], { drag: 20, superArmor: true });
    } else if (d.key === 'barbarian') {
      const targetX = opp.x;
      this.beginAction('ult', 'R', 1.78, [
        {
          t: .06, fn: () => {
            this.invuln = 1.5;
            this.onGround = false;
            this.vy = -1120;
            this.vx = U.clamp((targetX - this.x) / .7, -1000, 1000);
            GameAudio.charge();
            Game.addEffect({
              type: 'target', x: targetX, y: WORLD.ground, radius: 140,
              color: d.color, life: .9, maxLife: .9
            });
            Game.shakeBy(6);
          }
        },
        {
          t: .52, fn: () => {
            this.x = U.clamp(targetX, WORLD.left, WORLD.right);
            this.vy = 1980;
          }
        },
        {
          t: .74, fn: () => {
            this.y = WORLD.ground;
            this.onGround = true;
            this.vy = 0;
            this.vx = 0;
            GameAudio.hammer(true);
            Game.shakeBy(28);
            Game.flash('#ffb066', .4);
            Game.addEffect({
              type: 'crack', x: this.x, y: WORLD.ground, radius: 380,
              color: d.color, seed: 1.3, life: .8, maxLife: .8
            });
            Game.addEffect({
              type: 'ring', x: this.x, y: WORLD.ground, radius: 380,
              color: d.color, life: .8, maxLife: .8, lineWidth: 10
            });
            Game.addEffect({
              type: 'ring', x: this.x, y: WORLD.ground, radius: 245,
              color: d.color2, life: .58, maxLife: .58, lineWidth: 5
            });
            Game.addEffect({
              type: 'burst', x: this.x, y: WORLD.ground - 58, radius: 205,
              color: d.color, seed: 2.6, life: .55, maxLife: .55
            });
            Game.burst(this.x, WORLD.ground - 24, d.color, 46, 520);
            Game.dust(this.x, WORLD.ground, d.color, 30, 460);
            if (Math.abs(opp.x - this.x) < 380) {
              Game.dealDamage(this, opp, 300, {
                kb: 600, stun: 1.15, launch: 540, heavy: true,
                type: 'ult', color: d.color, dir: U.sign(opp.x - this.x),
                status: { type: 'slow', time: 2.4, amount: .48, color: d.color2 }
              });
            }
          }
        }
      ], { drag: 10, superArmor: true, gravityScale: 1 });
    } else if (d.key === 'goblin') {
      this.beginAction('ult', 'R', 2.4, [
        {
          t: .05, fn: () => {
            this.invuln = .55;
            GameAudio.charge();
            Game.addEffect({
              type: 'ring', x: this.x, y: this.y - 88, radius: 58,
              color: d.color2, life: .6, maxLife: .6, lineWidth: 3
            });
          }
        },
        ...[.38, .72, 1.06].map((tm, wave) => ({
          t: tm,
          fn: () => {
            for (let i = 0; i < 3; i++) {
              const tx = U.clamp(opp.x + (i - 1) * 58 + U.rand(-18, 18), WORLD.left + 25, WORLD.right - 25);
              Game.spawnProjectile({
                owner: this, kind: 'skySpear', x: tx, y: -70 - U.rand(0, 230),
                vx: U.rand(-25, 25), vy: 1250 + U.rand(0, 120),
                radius: 17, damage: 30, kb: 100, stun: .17,
                color: d.color, glow: U.hexA(d.color, .65), life: 2.6,
                gravity: 300, pierce: 1, trail: [], trailTimer: 0
              });
              Game.addEffect({
                type: 'target', x: tx, y: WORLD.ground, radius: 42,
                color: d.color2, life: .3, maxLife: .3
              });
            }
            GameAudio.spear();
            if (wave === 2) Game.shakeBy(8);
          }
        })),
        {
          t: 1.48, fn: () => {
            GameAudio.spear();
            Game.shakeBy(10);
            Game.spawnProjectile({
              owner: this, kind: 'spear', x: this.x + dir * 58, y: this.y - 92,
              vx: dir * 1520, vy: 0, radius: 26, damage: 118, kb: 500, stun: .42,
              color: d.color2, glow: U.hexA(d.color2, .8), life: 1.5,
              gravity: 0, pierce: 3, hitOnce: true, trail: [], trailTimer: 0
            });
            Game.addEffect({
              type: 'ring', x: this.x + dir * 58, y: this.y - 92, radius: 42,
              color: d.color2, life: .3, maxLife: .3, lineWidth: 3
            });
          }
        }
      ], { drag: 16, superArmor: true });
    } else if (d.key === 'assassin') {
      this.beginAction('ult', 'R', 1.82, [
        {
          t: .04, fn: () => {
            this.invuln = 1.35;
            this.vx = 0;
            GameAudio.blink();
            Game.addEffect({
              type: 'burst', x: this.x, y: this.y - 86, radius: 98,
              color: d.color, seed: 2.2, life: .35, maxLife: .35
            });
          }
        },
        {
          t: .16, fn: () => {
            const oldX = this.x;
            this.x = U.clamp(opp.x - dir * 54, WORLD.left + 30, WORLD.right - 30);
            this.vx = 0;
            this.facing = opp.x >= this.x ? 1 : -1;
            Game.burst(oldX, this.y - 86, d.color, 18, 250);
            Game.addEffect({
              type: 'ring', x: this.x, y: this.y - 86, radius: 46,
              color: d.color2, life: .32, maxLife: .32, lineWidth: 3
            });
          }
        },
        ...[.34, .52, .7].map(tm => ({
          t: tm,
          fn: () => {
            this.facing = opp.x >= this.x ? 1 : -1;
            GameAudio.dagger();
            this.meleeStrike(172, 180, 58, {
              kb: 60, stun: .2, type: 'ult', color: d.color
            }, opp);
            Game.addEffect({
              type: 'slash', x: this.x + this.facing * 56, y: this.y - 88,
              radius: 92, color: d.color2, face: this.facing,
              angle: this.facing > 0 ? -0.7 : Math.PI - 0.7, heavy: true,
              life: .14, maxLife: .14
            });
            Game.shakeBy(5);
          }
        })),
        {
          t: .96, fn: () => {
            this.facing = opp.x >= this.x ? 1 : -1;
            GameAudio.dagger();
            this.meleeStrike(180, 195, 148, {
              kb: 540, stun: .58, launch: 260, heavy: true, type: 'ult', color: d.color2
            }, opp);
            Game.addEffect({
              type: 'crack', x: this.x + this.facing * 70, y: WORLD.ground, radius: 180,
              color: d.color2, seed: 3.2, life: .55, maxLife: .55
            });
            Game.addEffect({
              type: 'burst', x: this.x + this.facing * 68, y: this.y - 90, radius: 118,
              color: d.color2, seed: 2.7, life: .35, maxLife: .35
            });
            Game.flash(d.color2, .3);
            Game.shakeBy(18);
          }
        }
      ], { drag: 7, superArmor: true });
    } else if (d.key === 'arashi') {
      this.beginAction('ult', 'R', 1.78, [
        {
          t: .04, fn: () => {
            this.invuln = 1.35;
            this.vx = U.clamp((opp.x - dir * 48 - this.x) / .5, -900, 900);
            GameAudio.charge();
            Game.addEffect({
              type: 'target', x: opp.x, y: WORLD.ground, radius: 100,
              color: d.color2, life: .5, maxLife: .5
            });
          }
        },
        ...[.28, .44, .6, .76].map((tm, i) => ({
          t: tm,
          fn: () => {
            this.facing = opp.x >= this.x ? 1 : -1;
            this.meleeStrike(164, 170, 38, {
              kb: 60, stun: .18, type: 'ult', color: i % 2 ? d.color2 : d.color
            }, opp);
            GameAudio.swing(i === 3);
            Game.addEffect({
              type: 'slash', x: this.x + this.facing * 48, y: this.y - 86 - (i % 2) * 16,
              radius: 84, color: i % 2 ? d.color2 : d.color, face: this.facing,
              angle: this.facing > 0 ? -.45 : Math.PI - .45, heavy: i === 3,
              life: .13, maxLife: .13
            });
            Game.shakeBy(4);
          }
        })),
        {
          t: 1.08, fn: () => {
            this.facing = opp.x >= this.x ? 1 : -1;
            this.meleeStrike(186, 220, 116, {
              kb: 330, stun: .55, launch: 620, heavy: true, type: 'ult', color: d.color2
            }, opp);
            this.vy = -420;
            this.onGround = false;
            GameAudio.hit(true);
            Game.addEffect({
              type: 'burst', x: this.x + this.facing * 54, y: this.y - 126,
              radius: 118, color: d.color2, seed: 2.4, life: .4, maxLife: .4
            });
            Game.addEffect({
              type: 'ring', x: this.x, y: this.y - 116, radius: 128,
              color: d.color2, life: .5, maxLife: .5, lineWidth: 7
            });
            Game.flash(d.color2, .25);
            Game.shakeBy(18);
          }
        }
      ], { drag: 4, superArmor: true });
    } else if (d.key === 'genbu') {
      this.beginAction('ult', 'R', 1.95, [
        {
          t: .04, fn: () => {
            this.invuln = 1.3;
            this.vx = U.clamp((opp.x - this.x) / .45, -700, 700);
            GameAudio.roar();
            Game.addEffect({
              type: 'target', x: opp.x, y: WORLD.ground, radius: 150,
              color: d.color, life: .7, maxLife: .7
            });
          }
        },
        ...[.34, .62, .9].map((tm, i) => ({
          t: tm,
          fn: () => {
            this.meleeStrike(190 + i * 18, 180, 46, {
              kb: 90, stun: .3, type: 'ult', color: i % 2 ? d.color2 : d.color
            }, opp);
            Game.addEffect({
              type: 'crack', x: this.x + this.facing * 70, y: WORLD.ground,
              radius: 130 + i * 18, color: d.color, seed: 1.1 + i * .7,
              life: .45, maxLife: .45
            });
            Game.dust(this.x + this.facing * 50, WORLD.ground, d.color, 14, 260);
            Game.shakeBy(8 + i * 2);
            GameAudio.hammer(i === 2);
          }
        })),
        {
          t: 1.22, fn: () => {
            this.meleeStrike(250, 200, 156, {
              kb: 430, stun: .72, launch: 320, heavy: true, type: 'ult', color: d.color2
            }, opp);
            Game.addEffect({
              type: 'crack', x: this.x, y: WORLD.ground, radius: 340,
              color: d.color2, seed: 2.8, life: .75, maxLife: .75
            });
            Game.addEffect({
              type: 'ring', x: this.x, y: WORLD.ground, radius: 340,
              color: d.color2, life: .7, maxLife: .7, lineWidth: 11
            });
            Game.dust(this.x, WORLD.ground, d.color2, 28, 340);
            Game.flash(d.color, .3);
            Game.shakeBy(24);
          }
        }
      ], { drag: 3.2, superArmor: true });
    } else if (d.key === 'astra') {
      const center = U.clamp(opp.x, WORLD.left + 60, WORLD.right - 60);
      this.beginAction('ult', 'R', 2.05, [
        {
          t: .04, fn: () => {
            this.invuln = 1.7;
            this.vx = 0;
            GameAudio.magic();
            Game.addEffect({
              type: 'target', x: center, y: WORLD.ground, radius: 190,
              color: d.color2, life: 1.7, maxLife: 1.7
            });
            Game.addEffect({
              type: 'ring', x: this.x, y: this.y - 90, radius: 110,
              color: d.color2, life: .55, maxLife: .55, lineWidth: 5
            });
          }
        },
        ...Array.from({ length: 9 }, (_, i) => ({
          t: .22 + i * .16,
          fn: () => {
            const x = U.clamp(center + U.rand(-220, 220), WORLD.left + 30, WORLD.right - 30);
            this.spawnOrb('meteor', {
              x, y: -240, vx: 0, vy: 760, gravity: 1200,
              radius: 30, damage: 34, kb: 140, stun: .22,
              color: i % 2 ? d.color2 : d.color, glow: U.hexA(d.color, .6),
              life: 2.1, trail: [], trailTimer: 0, hitOnce: true
            });
          }
        })),
        {
          t: 1.72, fn: () => {
            Game.explode(center, WORLD.ground - 40, 210, d.color2, this, 96, {
              burn: false, heavy: true, type: 'ult', sourceAction: this.action
            });
            Game.addEffect({
              type: 'ring', x: center, y: WORLD.ground - 52, radius: 230,
              color: d.color2, life: .75, maxLife: .75, lineWidth: 10
            });
            Game.flash(d.color2, .32);
            Game.shakeBy(20);
            GameAudio.explosion();
          }
        }
      ], { drag: 8 });
    } else if (d.key === 'chilin') {
      const mech = this.stance === 'mech';
      if (mech) {
        this.beginAction('ult', 'R', 2.0, [
          {
            t: .04, fn: () => {
              this.invuln = 1.55;
              this.vx = U.clamp((opp.x - this.x) / .5, -650, 650);
              GameAudio.charge();
              this.addStatus('overclock', 5, { color: d.color2 });
            }
          },
          ...[.38, .66, .94].map((tm, i) => ({
            t: tm,
            fn: () => {
              this.meleeStrike(220, 195, 52, {
                kb: 130, stun: .32, heavy: i === 2, type: 'ult', color: i % 2 ? d.color2 : d.color
              }, opp);
              Game.addEffect({
                type: 'burst', x: this.x + this.facing * 92, y: WORLD.ground - 24,
                radius: 125, color: d.color2, seed: 1.3 + i * .8, life: .34, maxLife: .34
              });
              Game.dust(this.x + this.facing * 70, WORLD.ground, d.color, 16, 280);
              Game.shakeBy(9 + i * 3);
              GameAudio.hammer(i === 2);
            }
          })),
          {
            t: 1.28, fn: () => {
              this.meleeStrike(270, 210, 150, {
                kb: 470, stun: .65, launch: 380, heavy: true, type: 'ult', color: d.color2
              }, opp);
              Game.explode(this.x + this.facing * 110, WORLD.ground - 40, 180, d.color2, this, 44, {
                burn: true, heavy: true, type: 'ult', sourceAction: this.action
              });
              Game.flash(d.color2, .28);
              Game.shakeBy(22);
            }
          }
        ], { drag: 4.2, superArmor: true });
      } else {
        this.beginAction('ult', 'R', 1.8, [
          {
            t: .04, fn: () => {
              this.invuln = 1.3;
              this.vx = U.clamp((opp.x - dir * 54 - this.x) / .5, -900, 900);
              GameAudio.dash();
            }
          },
          {
            t: .22, fn: () => {
              this.facing = opp.x >= this.x ? 1 : -1;
              this.x = U.clamp(opp.x - this.facing * 58, WORLD.left + 30, WORLD.right - 30);
              this.vx = 0;
              this.addStatus('overclock', 5, { color: d.color2 });
            }
          },
          ...[.38, .54, .7, .86].map((tm, i) => ({
            t: tm,
            fn: () => {
              this.facing = opp.x >= this.x ? 1 : -1;
              this.meleeStrike(176, 180, 42, {
                kb: 70, stun: .2, type: 'ult', color: i % 2 ? d.color2 : d.color
              }, opp);
              Game.addEffect({
                type: 'slash', x: this.x + this.facing * 56, y: this.y - 88,
                radius: 96, color: d.color2, face: this.facing,
                angle: this.facing > 0 ? -.7 : Math.PI - .7, heavy: i === 3,
                life: .13, maxLife: .13
              });
              Game.shakeBy(5);
            }
          })),
          {
            t: 1.16, fn: () => {
              this.meleeStrike(204, 200, 138, {
                kb: 480, stun: .58, launch: 300, heavy: true, type: 'ult', color: d.color2
              }, opp);
              Game.addEffect({
                type: 'crack', x: this.x + this.facing * 80, y: WORLD.ground,
                radius: 210, color: d.color2, seed: 3.4, life: .6, maxLife: .6
              });
              Game.flash(d.color2, .3);
              Game.shakeBy(18);
            }
          }
        ], { drag: 5, superArmor: true });
      }
    } else if (d.key === 'senmen') {
      this.beginAction('ult', 'R', 1.95, [
        {
          t: .04, fn: () => {
            this.invuln = 1.45;
            this.vx = 0;
            this.puppetLock = 0;
            this.puppetLunge = dir * 180;
            this.puppetX = U.clamp(opp.x + dir * 80, WORLD.left + 30, WORLD.right - 30);
            GameAudio.blink();
            Game.addEffect({
              type: 'ring', x: this.x, y: this.y - 90, radius: 90,
              color: d.color2, life: .5, maxLife: .5, lineWidth: 4
            });
          }
        },
        ...Array.from({ length: 5 }, (_, i) => ({
          t: .26 + i * .18,
          fn: () => {
            this.facing = opp.x >= this.x ? 1 : -1;
            const playerHit = this.meleeStrike(128, 152, 26, {
              kb: 40, stun: .16, type: 'ult', color: d.color
            }, opp);
            const puppetHit = this.puppetStrike(186, 172, 32, {
              kb: 55, stun: .18, type: 'ult', color: d.color2
            }, opp);
            GameAudio.dagger();
            Game.addEffect({
              type: 'slash', x: i % 2 ? this.puppetX : this.x + this.facing * 52,
              y: this.y - 92, radius: 92, color: i % 2 ? d.color2 : d.color,
              face: this.facing, angle: this.facing > 0 ? -.55 : Math.PI - .55,
              heavy: false, life: .12, maxLife: .12
            });
            if (i === 4 && playerHit && puppetHit) this.triggerResonance(opp);
            Game.shakeBy(4);
          }
        })),
        {
          t: 1.3, fn: () => {
            this.facing = opp.x >= this.x ? 1 : -1;
            const playerHit = this.meleeStrike(200, 205, 92, {
              kb: 420, stun: .55, launch: 300, heavy: true, type: 'ult', color: d.color2
            }, opp);
            const puppetHit = this.puppetStrike(210, 205, 96, {
              kb: 420, stun: .55, launch: 300, heavy: true, color: d.color2
            }, opp);
            if (playerHit && puppetHit) this.triggerResonance(opp);
            Game.flash(d.color2, .3);
            Game.shakeBy(20);
          }
        }
      ], { drag: 5, superArmor: true });
    }
  }

  findNearestPoint() {
    return { x: this.x, y: this.y - 80 };
  }
}

/* =========================================================
   AI
   ========================================================= */

class AIBrain {
  constructor(fighter) {
    this.fighter = fighter;
    this.cfg = DIFFICULTIES.normal;
    this.decision = 0.7;
    this.defTimer = 0;
    this.moveDir = 0;
    this.doJump = false;
    this.doNormal = false;
    this.doSkills = [false, false, false];
    this.doUlt = false;
    this.doDodge = false;
    this.blockTimer = 0;
    this.orbit = Math.random() > .5 ? 1 : -1;
    this.hesitate = 0;
    this.strafeTimer = 0;
    this.reactLock = 0;
  }

  reset() {
    this.decision = .6;
    this.moveDir = 0;
    this.doJump = this.doNormal = this.doUlt = false;
    this.doDodge = false;
    this.blockTimer = 0;
    this.doSkills = [false, false, false];
    this.hesitate = 0;
    this.reactLock = 0;
  }

  setDifficulty(key) {
    this.cfg = DIFFICULTIES[key] || DIFFICULTIES.normal;
  }

  think(dt, opp) {
    const f = this.fighter;
    const cfg = this.cfg;
    const intent = emptyIntent();
    if (f.dead || opp.dead) return intent;

    this.decision -= dt;
    this.defTimer -= dt;
    this.blockTimer = Math.max(0, this.blockTimer - dt);
    this.reactLock = Math.max(0, this.reactLock - dt);
    this.hesitate = Math.max(0, this.hesitate - dt);

    const dx = opp.x - f.x;
    const dist = Math.abs(dx);
    const dir = dx >= 0 ? 1 : -1;
    const range = AI_RANGE[f.key];

    // 持续走位：根据理想距离保持站位
    if (!f.action && f.hitstun <= 0) {
      if (this.hesitate > 0) {
        this.moveDir = 0;
      } else if (dist > range.ideal + 95) {
        this.moveDir = dir;
      } else if (dist < range.retreat && !['warrior', 'barbarian', 'assassin', 'arashi', 'genbu', 'chilin', 'senmen'].includes(f.key)) {
        this.moveDir = -dir;
      } else if (dist < 65 && ['warrior', 'barbarian', 'assassin', 'arashi', 'genbu', 'chilin', 'senmen'].includes(f.key)) {
        this.moveDir = 0;
      } else {
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
          this.strafeTimer = U.rand(.7, 1.6);
          this.orbit = Math.random() < .5 ? -1 : 1;
        }
        this.moveDir = cfg.aggression > .6 ? this.orbit * .3 : 0;
      }
      if (f.x < WORLD.left + 80 && this.moveDir < 0) this.moveDir = dir;
      if (f.x > WORLD.right - 80 && this.moveDir > 0) this.moveDir = -dir;
    } else {
      this.moveDir = 0;
    }

    // 防御判断：优先用格挡或闪避，其次才是跳跃。
    if (!f.action && this.defTimer <= 0) {
      this.defTimer = U.rand(.09, .17);
      const threat = this.scanThreat(opp);
      const meleeThreat = !!opp.action && dist < 260;
      if ((threat || meleeThreat) && f.guardBreak <= 0) {
        const roll = Math.random();
        if (f.onGround && f.guardMeter > 32 && roll < cfg.dodge * .55) {
          this.blockTimer = Math.max(this.blockTimer, U.rand(.3, .55));
          this.reactLock = cfg.reaction * .6;
        } else if (f.onGround && f.dodgeCd <= 0 && roll < cfg.dodge) {
          this.doDodge = true;
          this.reactLock = cfg.reaction;
        } else if (f.onGround && roll < cfg.dodge * .8) {
          this.doJump = true;
          this.reactLock = cfg.reaction * .8;
        } else if (!f.onGround && f.jumpsLeft > 0 && roll < cfg.dodge * .8) {
          this.doJump = true;
        }
      }
    }

    // 决策
    if (this.decision <= 0) {
      this.decision = cfg.interval * U.rand(.72, 1.32);
      if (Math.random() < cfg.mistake) {
        this.hesitate = U.rand(.25, .65);
        this.doNormal = false;
      } else {
        this.decide(opp, dist, dir);
      }
    }

    intent.left = this.moveDir < -0.05;
    intent.right = this.moveDir > 0.05;
    intent.jumpPressed = this.doJump;
    intent.normalPressed = this.doNormal;
    intent.skills = this.doSkills.slice();
    intent.ult = this.doUlt;
    intent.block = this.blockTimer > 0;
    intent.dodgePressed = this.doDodge;
    this.doJump = false;
    this.doNormal = false;
    this.doUlt = false;
    this.doDodge = false;
    this.doSkills = [false, false, false];
    return intent;
  }

  decide(opp, dist, dir) {
    const f = this.fighter;
    const cfg = this.cfg;
    const range = AI_RANGE[f.key];
    const skillRanges = AI_SKILL_RANGE[f.key];

    // 终极技能
    if (f.energy >= 100 && Math.random() < cfg.ultRate) {
      if (dist <= range.ult) {
        this.doUlt = true;
        return;
      }
    }

    // 技能选择
    const candidates = [];
    for (let i = 0; i < 3; i++) {
      if (f.cooldowns[i] > 0) continue;
      const r = skillRanges[i];
      if (dist >= r[0] && dist <= r[1]) {
        let weight = 1;
        if (f.key === 'warrior') {
          if (i === 2 && (f.hp / f.maxHp < .55 || dist < 180)) weight = 2.2;
          if (i === 1 && dist < 520) weight = 1.6;
        } else if (f.key === 'mage') {
          if (i === 1 && dist < 240) weight = 3;
          if (i === 2 && (dist < 150 || f.hp / f.maxHp < .4)) weight = 2.6;
        } else if (f.key === 'archer') {
          if (i === 1 && dist < 180) weight = 2.2;
          if (i === 2 && (dist < 150 || f.hp / f.maxHp < .45)) weight = 3;
        } else if (f.key === 'barbarian') {
          if (i === 1 && dist < 540) weight = 2.5;
          if (i === 2 && (f.hp / f.maxHp < .55 || dist < 200)) weight = 2.4;
          if (i === 0 && dist > 180) weight = 1.8;
        } else if (f.key === 'goblin') {
          if (i === 1 && dist < 280) weight = 2.8;
          if (i === 2 && dist < 230) weight = 2.1;
          if (i === 0 && dist > 200) weight = 1.6;
        } else if (f.key === 'assassin') {
          if (i === 0 && dist < 300) weight = 2.6;
          if (i === 2 && (f.hp / f.maxHp < .5 || dist < 220)) weight = 2.4;
          if (i === 1 && dist > 180) weight = 1.7;
        } else if (f.key === 'gunner') {
          if (i === 1 && dist < 240) weight = 2.6;
          if (i === 2 && (dist < 180 || f.hp / f.maxHp < .6)) weight = 2.2;
          if (i === 0 && dist > 220) weight = 1.4;
        } else if (f.key === 'arashi') {
          if (i === 0 && f.windCharge >= 100) weight = 3.2;
          if (i === 1 && dist < 210) weight = 2.4;
          if (i === 2 && dist > 140 && dist < 330) weight = 2.1;
        } else if (f.key === 'genbu') {
          if (i === 0 && dist < 150) weight = 3;
          if (i === 1 && f.hp / f.maxHp < .65) weight = 2.6;
          if (i === 2 && dist < 250) weight = 2.2;
        } else if (f.key === 'astra') {
          if (i === 0 && dist > 180) weight = 1.7;
          if (i === 1 && dist < 540) weight = 2.4;
          if (i === 2) {
            const hasGate = Game.zones.some(z => z.type === 'starGate' && z.owner === f);
            weight = hasGate ? .45 : (dist < 260 ? 2.2 : 1.3);
          }
        } else if (f.key === 'chilin') {
          if (i === 2) weight = f.overload >= 100 ? 2.8 : 1.1;
          if (i === 0 && f.stance === 'mech' && dist > 220) weight = 2.2;
          if (i === 0 && f.stance === 'blade' && dist < 230) weight = 2.4;
          if (i === 1 && f.hp / f.maxHp < .6) weight = 1.8;
        } else if (f.key === 'senmen') {
          if (i === 0 && dist < 260) weight = 2.5;
          if (i === 1 && (dist > 220 || f.hp / f.maxHp < .5)) weight = 2;
          if (i === 2 && f.hp / f.maxHp < .62) weight = 2.6;
        }
        candidates.push({ i, weight });
      }
    }

    if (candidates.length && Math.random() < cfg.skillRate) {
      const total = candidates.reduce((s, c) => s + c.weight, 0);
      let roll = Math.random() * total;
      for (const c of candidates) {
        roll -= c.weight;
        if (roll <= 0) {
          this.doSkills[c.i] = true;
          return;
        }
      }
    }

    // 普攻
    const inRange = dist < range.basic + 40;
    if (inRange && Math.random() < cfg.aggression + (f.comboIdx >= 0 ? .15 : 0)) {
      this.doNormal = true;
    } else if (!inRange && dist < range.basic + 300 && Math.random() < .1) {
      this.doNormal = true;
    }

    // 偶尔主动跳跃绕后
    if (Math.random() < .035 && f.onGround) this.doJump = true;
  }

  scanThreat(opp) {
    const f = this.fighter;
    const cfg = this.cfg;
    for (const p of Game.projectiles) {
      if (!p || p.dead || p.owner === f) continue;
      const dx = f.x - p.x;
      const yDist = Math.abs((f.y - 82) - p.y);
      const approaching = (p.vx || 0) * dx > 0 || (p.vx || 0) === 0;
      if (Math.abs(dx) < 390 && yDist < 95 && approaching) {
        if (p.kind === 'meteor' || p.kind === 'skyArrow') {
          if (Math.abs(p.x - f.x) < 90) return true;
        } else if (p.kind !== 'shockwave') {
          return true;
        }
      }
    }
    for (const z of Game.zones) {
      if (z.type === 'fire' && z.owner !== f && Math.abs(z.x - f.x) < z.radius + 20 && f.onGround) return true;
      if (z.type === 'trap' && z.owner !== f && Math.abs(z.x - f.x) < 80 && f.onGround) return true;
    }
    return false;
  }
}
