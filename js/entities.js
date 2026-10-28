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
    normalPressed: false, skills: [false, false, false], ult: false
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
    this.comboIdx = -1;
    this.chainWindow = 0;
    this.queuedBasic = 0;
    this.guardTimer = 0;
    this.empowerTimer = 0;
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
    this.x = x;
    this.y = WORLD.ground;
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
    this.empowerTimer = 0;
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
    return !this.dead && !this.action && this.hitstun <= 0 && !this.isRooted();
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

  handleIntent(intent, opp, dt) {
    if (this.dead || this.hitstun > 0 || this.isRooted()) return;
    if (this.action) return;

    if (intent.ult && this.energy >= 100) {
      this.castUlt(opp);
      return;
    }
    for (let i = 0; i < 3; i++) {
      if (intent.skills[i] && this.cooldowns[i] <= 0) {
        this.castSkill(i, opp);
        return;
      }
    }
    if (intent.normalPressed) {
      this.startBasic(opp, false);
      return;
    }
    if (intent.jumpPressed) this.jump();

    const dir = (intent.right ? 1 : 0) - (intent.left ? 1 : 0);
    const speed = this.data.speed * this.slowMul * (this.isAI && this.ai ? this.ai.cfg.move : 1);
    if (dir !== 0) {
      const accel = this.onGround ? 18 : 9;
      this.vx = U.lerp(this.vx, dir * speed, 1 - Math.exp(-accel * dt));
    } else {
      const fric = this.onGround ? 13 : 2.4;
      this.vx *= Math.exp(-fric * dt);
    }
  }

  update(dt, opp, intent) {
    this.animTime += dt;
    if (this.muzzle > 0) this.muzzle = Math.max(0, this.muzzle - dt * 6);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.guardTimer = Math.max(0, this.guardTimer - dt);
    this.empowerTimer = Math.max(0, this.empowerTimer - dt);
    this.chainWindow = Math.max(0, this.chainWindow - dt);
    this.queuedBasic = Math.max(0, this.queuedBasic - dt);
    for (let i = 0; i < 3; i++) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
    this.updateStatuses(dt);

    if (this.dead) {
      this.deathTime += dt;
      this.vy += WORLD.gravity * dt;
      this.y += this.vy * dt;
      if (this.y > WORLD.ground) { this.y = WORLD.ground; this.vy = 0; }
      return;
    }

    if (this.hitstun > 0) this.hitstun = Math.max(0, this.hitstun - dt);

    if (!this.action && this.hitstun <= 0 && !this.isRooted()) {
      this.facing = opp.x >= this.x ? 1 : -1;
    }

    if (this.action) {
      if (intent.normalPressed && this.action.type === 'basic' && this.comboIdx < 2 && this.action.time > this.action.duration * 0.22) {
        this.queuedBasic = 0.55;
      }
      this.updateAction(dt, opp);
    } else if (this.hitstun <= 0) {
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
        this.y = WORLD.ground;
        this.vy = 0;
        this.onGround = true;
        this.jumpsLeft = 2;
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
  }

  updateAction(dt, opp) {
    const a = this.action;
    if (!a) return;
    a.time += dt;
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
    if (a.time >= a.duration) {
      const wasBasic = a.type === 'basic';
      const follow = wasBasic && this.queuedBasic > 0 && this.comboIdx < 2;
      if (a.opts.onEnd) a.opts.onEnd();
      this.action = null;
      this.queuedBasic = 0;
      if (follow) {
        this.startBasic(opp, true);
      } else if (wasBasic) {
        if (this.comboIdx < 2) {
          this.chainWindow = 0.62;
        } else {
          this.comboIdx = -1;
          this.chainWindow = 0;
        }
      }
    }
  }

  beginAction(type, key, duration, events, opts = {}) {
    this.action = {
      type, key, time: 0, duration,
      events: (events || []).slice().sort((a, b) => a.t - b.t),
      eventIndex: 0, opts
    };
    this.queuedBasic = 0;
    if (opts.stop !== false) this.vx *= 0.2;
  }

  startBasic(opp, next) {
    if (this.dead) return;
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
    }], { drag: 15 });
    if (this.onGround) this.vx += this.facing * (idx === 2 ? 170 : 80);
    if (this.data.key === 'warrior' && idx === 2) Game.shakeBy(3);
  }

  performBasic(idx, b, opp) {
    const d = this.data;
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
        x: this.x + this.facing * 38, y: this.y - 96,
        vx: this.facing * b.speed, vy: big ? -18 : 0,
        radius: b.radius, damage: b.dmg, kb: b.kb, stun: b.stun,
        color: big ? d.color2 : d.color, glow: U.hexA(d.color, .65), life: 1.35
      });
      if (big) {
        Game.addEffect({
          type: 'ring', x: this.x + this.facing * 38, y: this.y - 96, radius: 30,
          color: d.color2, life: .28, maxLife: .28, lineWidth: 2
        });
      }
    } else if (d.key === 'archer') {
      GameAudio.bow();
      const big = !!b.heavy;
      this.spawnArrow({
        x: this.x + this.facing * 40, y: this.y - 98,
        vx: this.facing * b.speed, vy: big ? 0 : -8,
        radius: big ? 11 : 9, damage: b.dmg, kb: b.kb, stun: b.stun,
        kind: big ? 'bigArrow' : 'arrow', color: d.color, glow: U.hexA(d.color, .55), life: 1.4
      });
    } else {
      const empowered = this.empowerTimer > 0;
      if (empowered) {
        this.empowerTimer = 0;
        Game.toast('火药强化 · 下一发爆裂', d.color2);
      }
      if (b.pellets) {
        GameAudio.shotgun();
        Game.shakeBy(7);
        Game.muzzleFlash(this.x + this.facing * 66, this.y - 96, this.facing, d);
        for (let i = 0; i < b.pellets; i++) {
          const ang = (i - (b.pellets - 1) / 2) * 0.055;
          this.spawnBullet({
            x: this.x + this.facing * 62, y: this.y - 96 + Math.sin(ang) * 18,
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
        Game.muzzleFlash(this.x + this.facing * 68, this.y - 96, this.facing, d);
        this.spawnBullet({
          x: this.x + this.facing * 64, y: this.y - 96,
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
      trail: [], trailTimer: 0, spin: 0, glow: U.hexA(this.data.color, .65)
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
    const box = {
      x: this.facing > 0 ? this.x + 4 : this.x - range - 4,
      y: this.y - height,
      w: range + 8,
      h: height
    };
    if (U.rectOverlap(box, opp.hurtbox)) {
      return Game.dealDamage(this, opp, damage, Object.assign({
        type: 'basic', color: this.data.color, dir: this.facing
      }, opts));
    }
    return false;
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
    } else {
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
    } else {
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
    this.orbit = Math.random() > .5 ? 1 : -1;
    this.hesitate = 0;
    this.strafeTimer = 0;
    this.reactLock = 0;
  }

  reset() {
    this.decision = .6;
    this.moveDir = 0;
    this.doJump = this.doNormal = this.doUlt = false;
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
      } else if (dist < range.retreat && f.key !== 'warrior') {
        this.moveDir = -dir;
      } else if (dist < 65 && f.key === 'warrior') {
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

    // 防御判断
    if (!f.action && this.defTimer <= 0) {
      this.defTimer = U.rand(.09, .17);
      const threat = this.scanThreat(opp);
      if (threat && Math.random() < cfg.dodge && f.onGround) {
        this.doJump = true;
        this.reactLock = cfg.reaction * .8;
      } else if (threat && Math.random() < cfg.dodge * .8 && !f.onGround && f.jumpsLeft > 0) {
        this.doJump = true;
      }
      if (opp.action && dist < 230 && Math.random() < cfg.dodge * .55 && f.onGround) {
        this.doJump = true;
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
    this.doJump = false;
    this.doNormal = false;
    this.doUlt = false;
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
        } else {
          if (i === 1 && dist < 240) weight = 2.6;
          if (i === 2 && (dist < 180 || f.hp / f.maxHp < .6)) weight = 2.2;
          if (i === 0 && dist > 220) weight = 1.4;
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