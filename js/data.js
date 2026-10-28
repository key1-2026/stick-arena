/* =========================================================
   STICK//ARENA — 战斗数据
   ========================================================= */

const WORLD = {
  width: 1600,
  height: 900,
  ground: 724,
  left: 90,
  right: 1510,
  gravity: 2650
};

const CHARACTERS = {
  warrior: {
    key: 'warrior',
    name: '战士',
    en: 'WARDEN',
    title: '铁壁先锋',
    role: '近战 · 重装',
    color: '#ff7a45',
    color2: '#ffc17a',
    dark: '#7c2416',
    glow: 'rgba(255,122,69,.65)',
    hp: 1150,
    speed: 302,
    jump: 920,
    doubleJump: 760,
    weight: 1.1,
    desc: '巨剑开路，钢铁意志。以高额生命与霸体冲锋撕开对手防线，越战越勇。',
    difficulty: '稳健',
    stats: { atk: 72, def: 96, mob: 48 },
    basicName: '裂风三连斩',
    basicHint: '三段巨剑连斩 · 第三段击飞',
    basic: [
      { dmg: 46, duration: 0.34, hitAt: 0.15, range: 148, height: 150, kb: 120, stun: 0.16 },
      { dmg: 52, duration: 0.36, hitAt: 0.16, range: 155, height: 150, kb: 150, stun: 0.18 },
      { dmg: 82, duration: 0.54, hitAt: 0.22, range: 178, height: 175, kb: 410, stun: 0.32, launch: 250, heavy: true }
    ],
    skills: [
      {
        key: 'U', name: '裂地斩', glyph: '裂', cd: 7.5,
        color: '#ff8a3d', desc: '挥出贴地剑气，命中造成伤害并强力击退。'
      },
      {
        key: 'I', name: '铁壁冲锋', glyph: '壁', cd: 10,
        color: '#e9b25f', desc: '短暂格挡后向前冲锋，撞击造成高额伤害。'
      },
      {
        key: 'O', name: '不屈战吼', glyph: '吼', cd: 15,
        color: '#ffd07a', desc: '回复生命，并在 6 秒内提升伤害、降低所受伤害。'
      }
    ],
    ult: {
      name: '天崩地裂', glyph: '天', color: '#ff9b55',
      desc: '跃向对手砸落，造成大范围重击与长时间眩晕。'
    }
  },

  mage: {
    key: 'mage',
    name: '法师',
    en: 'ARCANIST',
    title: '星辉术士',
    role: '远程 · 控场',
    color: '#8d7bff',
    color2: '#62e4ff',
    dark: '#24175c',
    glow: 'rgba(141,123,255,.65)',
    hp: 850,
    speed: 316,
    jump: 930,
    doubleJump: 800,
    weight: 0.92,
    desc: '以星光编织杀阵。擅长中远距离压制与范围冻结，但身板脆弱，需要保持距离。',
    difficulty: '进阶',
    stats: { atk: 94, def: 54, mob: 68 },
    basicName: '奥术秘弹',
    basicHint: '三段秘弹 · 末段造成额外击退',
    basic: [
      { dmg: 35, duration: 0.38, hitAt: 0.17, speed: 730, radius: 13, kb: 90, stun: 0.14 },
      { dmg: 38, duration: 0.4, hitAt: 0.17, speed: 760, radius: 13, kb: 100, stun: 0.15 },
      { dmg: 55, duration: 0.56, hitAt: 0.24, speed: 810, radius: 19, kb: 280, stun: 0.28, heavy: true }
    ],
    skills: [
      {
        key: 'U', name: '星尘散射', glyph: '星', cd: 8,
        color: '#8d7bff', desc: '向前方扇形射出 5 枚奥术飞弹，近距离可全部命中。'
      },
      {
        key: 'I', name: '冰霜新星', glyph: '霜', cd: 11,
        color: '#65e0ff', desc: '冻结周围敌人，造成伤害并大幅减速。'
      },
      {
        key: 'O', name: '相位闪现', glyph: '闪', cd: 9,
        color: '#b69bff', desc: '瞬移一段距离，并在原地引发奥术爆炸。'
      }
    ],
    ult: {
      name: '陨星天穹', glyph: '陨', color: '#b18cff',
      desc: '召唤持续坠落的流星雨，轰击敌方所在区域。'
    }
  },

  archer: {
    key: 'archer',
    name: '射手',
    en: 'RANGER',
    title: '逐风游侠',
    role: '远程 · 机动',
    color: '#4fe09b',
    color2: '#b9ff71',
    dark: '#0d4b35',
    glow: 'rgba(79,224,155,.62)',
    hp: 900,
    speed: 342,
    jump: 960,
    doubleJump: 830,
    weight: 0.9,
    desc: '林间的风，亦是致命的箭。依靠超高机动与陷阱拉扯距离，用箭雨收割战场。',
    difficulty: '灵活',
    stats: { atk: 86, def: 58, mob: 92 },
    basicName: '疾风连矢',
    basicHint: '快速三连射 · 空中亦可开弓',
    basic: [
      { dmg: 30, duration: 0.31, hitAt: 0.13, speed: 1120, radius: 9, kb: 60, stun: 0.12 },
      { dmg: 33, duration: 0.3, hitAt: 0.13, speed: 1150, radius: 9, kb: 65, stun: 0.13 },
      { dmg: 47, duration: 0.46, hitAt: 0.2, speed: 1250, radius: 11, kb: 210, stun: 0.22, heavy: true }
    ],
    skills: [
      {
        key: 'U', name: '追风三连', glyph: '连', cd: 8,
        color: '#4fe09b', desc: '瞬间射出三支追风箭，覆盖中距离。'
      },
      {
        key: 'I', name: '荆棘陷阱', glyph: '阱', cd: 12,
        color: '#9be26b', desc: '在脚下布置陷阱，触发后造成伤害并定身敌人。'
      },
      {
        key: 'O', name: '燕返', glyph: '燕', cd: 9,
        color: '#8af5c9', desc: '向后跃开并回身速射，后跃期间短暂无敌。'
      }
    ],
    ult: {
      name: '万箭齐发', glyph: '雨', color: '#9dff88',
      desc: '召来三轮箭雨覆盖敌方区域，最后补上一支破空巨箭。'
    }
  },

  gunner: {
    key: 'gunner',
    name: '火枪手',
    en: 'GUNSLINGER',
    title: '硝烟玫瑰',
    role: '中距 · 爆发',
    color: '#42d7de',
    color2: '#ffe06a',
    dark: '#0a4d56',
    glow: 'rgba(66,215,222,.62)',
    hp: 950,
    speed: 312,
    jump: 910,
    doubleJump: 770,
    weight: 1,
    desc: '优雅地补上一枪。中距离火力凶猛，散弹与燃烧瓶让对手无处落脚，终极火炮可贯穿全场。',
    difficulty: '均衡',
    stats: { atk: 90, def: 68, mob: 62 },
    basicName: '爆裂铳击',
    basicHint: '三段射击 · 第三段为近距散弹',
    basic: [
      { dmg: 43, duration: 0.42, hitAt: 0.15, speed: 1420, radius: 8, kb: 95, stun: 0.15 },
      { dmg: 46, duration: 0.4, hitAt: 0.15, speed: 1460, radius: 8, kb: 110, stun: 0.16 },
      { dmg: 24, duration: 0.62, hitAt: 0.23, pellets: 5, speed: 1180, radius: 7, kb: 150, stun: 0.2, heavy: true }
    ],
    skills: [
      {
        key: 'U', name: '燃烧瓶', glyph: '燃', cd: 9,
        color: '#ff8b42', desc: '投掷燃烧瓶，在地面留下持续灼烧的火场。'
      },
      {
        key: 'I', name: '散弹轰击', glyph: '霰', cd: 10,
        color: '#ffd85e', desc: '近距离扇形弹幕，全部命中可造成恐怖爆发。'
      },
      {
        key: 'O', name: '战术翻滚', glyph: '滚', cd: 8,
        color: '#71f0e0', desc: '翻滚躲避伤害，并强化 4 秒内的下一次普攻。'
      }
    ],
    ult: {
      name: '歼灭炮', glyph: '灭', color: '#63f4ff',
      desc: '短暂蓄力后发射横贯战场的毁灭光束，可被高高跃起躲开。'
    }
  },

  barbarian: {
    key: 'barbarian',
    name: '野蛮人',
    en: 'BARBARIAN',
    title: '裂颅蛮王',
    role: '近战 · 重锤',
    color: '#e2603c',
    color2: '#ffd27d',
    dark: '#5e1e12',
    glow: 'rgba(226,96,60,.64)',
    hp: 1260,
    speed: 292,
    jump: 885,
    doubleJump: 745,
    weight: 1.24,
    desc: '大锤落下，骨头和盾牌一起碎。血量厚、单发重，靠震地与冲撞把对手钉在墙角。',
    difficulty: '重压',
    stats: { atk: 94, def: 90, mob: 38 },
    basicName: '裂颅三锤',
    basicHint: '大锤三段 · 第三段砸地击飞',
    basic: [
      { dmg: 62, duration: 0.48, hitAt: 0.23, range: 170, height: 165, kb: 180, stun: 0.2 },
      { dmg: 70, duration: 0.5, hitAt: 0.25, range: 178, height: 170, kb: 220, stun: 0.23 },
      { dmg: 112, duration: 0.68, hitAt: 0.33, range: 205, height: 195, kb: 560, stun: 0.4, launch: 280, heavy: true }
    ],
    skills: [
      {
        key: 'U', name: '震地锤', glyph: '震', cd: 8.5,
        color: '#ff9b55', desc: '重锤砸地，冲击波沿地面推进，命中击飞。'
      },
      {
        key: 'I', name: '蛮牛冲撞', glyph: '撞', cd: 10.5,
        color: '#ffd27d', desc: '短暂蓄力后向前冲撞，把正面敌人撞飞。'
      },
      {
        key: 'O', name: '战吼', glyph: '吼', cd: 15,
        color: '#ffb36b', desc: '回复生命，并在 6 秒内提升伤害、降低所受伤害。'
      }
    ],
    ult: {
      name: '天罚巨锤', glyph: '罚', color: '#ffc06b',
      desc: '跃向对手砸下巨锤，造成大范围重击与眩晕。'
    }
  },

  goblin: {
    key: 'goblin',
    name: '哥布林',
    en: 'GOBLIN',
    title: '尖牙猎手',
    role: '中距 · 穿刺',
    color: '#79d64b',
    color2: '#e7ff77',
    dark: '#1d4a17',
    glow: 'rgba(121,214,75,.6)',
    hp: 820,
    speed: 348,
    jump: 955,
    doubleJump: 825,
    weight: 0.82,
    desc: '个子小，枪很长。用超远距离的连续突刺和控制陷阱把对手挡在攻击范围之外。',
    difficulty: '狡诈',
    stats: { atk: 84, def: 46, mob: 94 },
    basicName: '毒牙三刺',
    basicHint: '长枪三连刺 · 第三段突进击退',
    basic: [
      { dmg: 30, duration: 0.32, hitAt: 0.13, range: 205, height: 140, kb: 80, stun: 0.12 },
      { dmg: 34, duration: 0.34, hitAt: 0.14, range: 215, height: 145, kb: 95, stun: 0.13 },
      { dmg: 56, duration: 0.48, hitAt: 0.2, range: 240, height: 155, kb: 260, stun: 0.26, heavy: true }
    ],
    skills: [
      {
        key: 'U', name: '贯穿投枪', glyph: '投', cd: 8,
        color: '#baff62', desc: '投出贯穿长枪，命中造成高额伤害并击退。'
      },
      {
        key: 'I', name: '回马枪', glyph: '回', cd: 9.5,
        color: '#8ff06d', desc: '向后跃开，随后一记超远距离突刺。'
      },
      {
        key: 'O', name: '尖牙陷阱', glyph: '阱', cd: 13,
        color: '#c6ff7a', desc: '布置尖牙陷阱，触发后定身并减速敌人。'
      }
    ],
    ult: {
      name: '百枪穿心', glyph: '枪', color: '#d6ff64',
      desc: '召来多轮长枪从天而降，最后投出贯穿全场的巨枪。'
    }
  },

  assassin: {
    key: 'assassin',
    name: '刺客',
    en: 'ASSASSIN',
    title: '暗影之刃',
    role: '近战 · 爆发',
    color: '#c45cff',
    color2: '#ff9ede',
    dark: '#3b0a55',
    glow: 'rgba(196,92,255,.64)',
    hp: 780,
    speed: 372,
    jump: 985,
    doubleJump: 855,
    weight: 0.74,
    desc: '匕首只在最接近的距离说话。以瞬身、毒刃与烟幕贴近目标，再用终极连斩结束战斗。',
    difficulty: '致命',
    stats: { atk: 98, def: 44, mob: 98 },
    basicName: '影袭三刃',
    basicHint: '匕首三段快斩 · 第三段穿刺',
    basic: [
      { dmg: 26, duration: 0.24, hitAt: 0.1, range: 125, height: 130, kb: 50, stun: 0.1 },
      { dmg: 28, duration: 0.25, hitAt: 0.1, range: 130, height: 135, kb: 55, stun: 0.11 },
      { dmg: 50, duration: 0.4, hitAt: 0.16, range: 155, height: 145, kb: 230, stun: 0.24, heavy: true }
    ],
    skills: [
      {
        key: 'U', name: '影步', glyph: '影', cd: 7,
        color: '#d777ff', desc: '瞬身穿过敌人并回身斩击，位移期间短暂无敌。'
      },
      {
        key: 'I', name: '毒刃飞掷', glyph: '毒', cd: 9,
        color: '#ff8ad8', desc: '扇形掷出三把毒刃，命中附加持续中毒。'
      },
      {
        key: 'O', name: '烟幕遁', glyph: '烟', cd: 13,
        color: '#b48cff', desc: '掷出烟幕，遮蔽区域并减速其中的敌人。'
      }
    ],
    ult: {
      name: '瞬狱杀', glyph: '狱', color: '#ff8ae6',
      desc: '瞬移至对手身后，连续斩击后以一刀终结。'
    }
  }
};

const CHAR_ORDER = ['warrior', 'mage', 'archer', 'gunner', 'barbarian', 'goblin', 'assassin'];

const MAPS = {
  lava: {
    key: 'lava', name: '熔岩峡谷', en: 'LAVA RIFT',
    desc: '灼热岩层与飞散的火星', accent: '#ff7a45',
    swatch: ['#2a1016', '#892d1c', '#ff7a45']
  },
  bamboo: {
    key: 'bamboo', name: '月下竹林', en: 'MOONLIT GROVE',
    desc: '月色穿过幽深竹海', accent: '#70e2b1',
    swatch: ['#071d24', '#12443f', '#70e2b1']
  },
  ruins: {
    key: 'ruins', name: '天空遗迹', en: 'SKY RUINS',
    desc: '云海之上的失落神殿', accent: '#f0b072',
    swatch: ['#20152f', '#7d4b64', '#f0b072']
  },
  neon: {
    key: 'neon', name: '霓虹都市', en: 'NEON ROOF',
    desc: '雨夜楼顶的电子对决', accent: '#ff5fbf',
    swatch: ['#050914', '#291052', '#ff5fbf']
  }
};

const MAP_ORDER = ['lava', 'bamboo', 'ruins', 'neon'];

const DIFFICULTIES = {
  easy: {
    key: 'easy', name: '新兵', en: 'ROOKIE', color: '#7bd6aa', bars: 1,
    desc: '反应迟缓、出手犹豫。适合熟悉操作与技能。',
    reaction: 0.7, interval: 0.46, aggression: 0.34, skillRate: 0.22,
    dodge: 0.05, ultRate: 0.35, move: 0.82, mistake: 0.34
  },
  normal: {
    key: 'normal', name: '老练', en: 'VETERAN', color: '#ffd269', bars: 2,
    desc: '攻守有度，会抓破绽并主动使用技能。',
    reaction: 0.42, interval: 0.29, aggression: 0.55, skillRate: 0.46,
    dodge: 0.15, ultRate: 0.6, move: 0.93, mistake: 0.16
  },
  hard: {
    key: 'hard', name: '精锐', en: 'ELITE', color: '#ff9658', bars: 3,
    desc: '连招紧凑，会闪避弹道并惩罚空档。',
    reaction: 0.24, interval: 0.17, aggression: 0.71, skillRate: 0.68,
    dodge: 0.31, ultRate: 0.8, move: 1, mistake: 0.07
  },
  master: {
    key: 'master', name: '宗师', en: 'MASTER', color: '#ff5b72', bars: 4,
    desc: '近乎本能的判断。走位、闪避、连招与终结技一气呵成。',
    reaction: 0.12, interval: 0.095, aggression: 0.87, skillRate: 0.88,
    dodge: 0.52, ultRate: 0.94, move: 1.07, mistake: 0.02
  }
};

const DIFF_ORDER = ['easy', 'normal', 'hard', 'master'];

const AI_RANGE = {
  warrior: { basic: 150, ideal: 120, retreat: 60, ult: 330 },
  mage: { basic: 520, ideal: 470, retreat: 270, ult: 560 },
  archer: { basic: 620, ideal: 540, retreat: 280, ult: 620 },
  gunner: { basic: 500, ideal: 390, retreat: 210, ult: 720 },
  barbarian: { basic: 175, ideal: 130, retreat: 70, ult: 360 },
  goblin: { basic: 215, ideal: 180, retreat: 100, ult: 900 },
  assassin: { basic: 135, ideal: 100, retreat: 55, ult: 330 }
};

const AI_SKILL_RANGE = {
  warrior: [[0, 380], [120, 560], [0, 220], [0, 340]],
  mage: [[140, 760], [0, 250], [0, 400], [0, 700]],
  archer: [[180, 780], [0, 180], [0, 340], [0, 850]],
  gunner: [[160, 580], [0, 280], [0, 380], [120, 900]],
  barbarian: [[0, 440], [100, 560], [0, 220], [0, 360]],
  goblin: [[180, 820], [0, 320], [0, 230], [0, 900]],
  assassin: [[0, 360], [100, 650], [0, 320], [0, 330]]
};

const GAME_RULES = {
  duration: 180,
  energyDealt: 0.16,
  energyTaken: 0.26,
  maxEnergy: 100,
  guardMax: 100,
  guardDrain: 9,
  guardRegen: 22,
  guardRegenDelay: .42,
  blockDamage: .24,
  guardCost: .4,
  guardBreakTime: .9,
  dodgeDuration: .26,
  dodgeCooldown: 1.55,
  dodgeSpeed: 760
};

// 60 Hz 战斗帧表：起手 / 有效判定 / 收招。数值与动画、取消窗口共用。
const COMBAT = Object.freeze({
  fps: 60, attackBuffer: 10 / 60, jumpBuffer: 8 / 60,
  pushboxWidth: 52, minimumDamageScale: .35, comboScaleStep: .08
});
const BASIC_FRAMES = {
  warrior:   [[6,3,11,20,20,80], [7,3,13,23,28,95], [11,4,21,29,36,360]],
  mage:      [[8,1,17,17,0,70], [8,1,18,19,0,80], [13,1,24,25,0,230]],
  archer:    [[7,1,15,16,0,55], [7,1,16,18,0,65], [11,1,22,23,0,190]],
  gunner:    [[5,1,16,17,0,65], [6,1,16,19,0,75], [10,1,25,24,0,140]],
  barbarian: [[10,4,16,26,24,100], [11,4,17,30,30,125], [16,5,24,35,44,430]],
  goblin:    [[7,3,12,21,16,65], [7,3,14,24,22,80], [12,4,20,29,30,230]],
  assassin:  [[4,2,10,17,18,45], [5,2,11,21,24,60], [8,3,17,26,32,230]]
};
for (const key of CHAR_ORDER) {
  CHARACTERS[key].basic.forEach((move, index) => {
    const [startup, active, recovery, stun, step, knockback] = BASIC_FRAMES[key][index];
    Object.assign(move, {
      startupFrames: startup, activeFrames: active, recoveryFrames: recovery,
      hitAt: startup / 60, activeEnd: (startup + active) / 60,
      duration: (startup + active + recovery) / 60,
      chainAt: (startup + active + 2) / 60,
      whiffChainAt: (startup + active + 6) / 60,
      stun: stun / 60, blockstun: Math.max(8, startup + active + 3) / 60,
      rootMotion: step, kb: knockback
    });
  });
}
