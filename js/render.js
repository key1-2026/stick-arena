/* =========================================================
   STICK//ARENA — 场景与火柴人渲染
   ========================================================= */

const Render = (() => {
  const W = 1600;
  const H = 900;
  const GROUND = 724;
  const TAU = Math.PI * 2;
  const mapCache = {};
  const backgroundCache = new Map();
  const backgroundStats = { rasterizations: 0, reuses: 0 };

  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const easeInOut = t => {
    t = clamp(t, 0, 1);
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function line(ctx, x1, y1, x2, y2, color, width = 2, alpha = 1) {
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
  }

  function poly(ctx, points, fill, stroke, width = 2) {
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  function glowCircle(ctx, x, y, r, color, inner = 1) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(0.32, color.replace(/[\d.]+\)$/, '0.34)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    ctx.restore();
  }

  function getCache(key) {
    if (mapCache[key]) return mapCache[key];
    const cache = { key };
    const R = rng({
      lava: 9351, bamboo: 4177, ruins: 8823, neon: 6209
    }[key] || 1);

    if (key === 'lava') {
      cache.stars = Array.from({ length: 56 }, () => ({
        x: R() * W, y: 30 + R() * 380, r: 0.5 + R() * 1.5, a: 0.08 + R() * 0.35
      }));
      cache.ridges = Array.from({ length: 3 }, (_, layer) => {
        const pts = [[0, 700]];
        let x = 0;
        while (x <= W) {
          const step = 100 + R() * 170;
          pts.push([x, 500 + layer * 62 + R() * (110 - layer * 20)]);
          x += step;
        }
        pts.push([W, 700]);
        return pts;
      });
      cache.cracks = Array.from({ length: 13 }, (_, i) => ({
        x: 80 + i * 118 + R() * 50,
        len: 40 + R() * 100,
        bend: (R() - 0.5) * 70,
        w: 1 + R() * 3
      }));
      cache.embers = Array.from({ length: 46 }, () => ({
        x: R() * W, y: 250 + R() * 650, sp: 8 + R() * 30,
        size: 1 + R() * 2.6, ph: R() * TAU, sway: 10 + R() * 30
      }));
      cache.rocks = Array.from({ length: 12 }, () => ({
        x: R() * W, y: 688 + R() * 25, w: 25 + R() * 80, h: 8 + R() * 24
      }));
    }

    if (key === 'bamboo') {
      cache.bambooFar = Array.from({ length: 20 }, () => ({
        x: R() * W, w: 4 + R() * 8, h: 440 + R() * 330, a: 0.18 + R() * 0.18,
        nodes: 4 + Math.floor(R() * 5), lean: (R() - 0.5) * 24
      }));
      cache.bambooNear = Array.from({ length: 12 }, () => ({
        x: -30 + R() * (W + 60), w: 8 + R() * 13, h: 560 + R() * 330, a: 0.42 + R() * 0.36,
        nodes: 5 + Math.floor(R() * 5), lean: (R() - 0.5) * 32
      }));
      cache.fireflies = Array.from({ length: 34 }, () => ({
        x: R() * W, y: 280 + R() * 440, ph: R() * TAU, sp: 0.4 + R() * 1.2,
        size: 1 + R() * 2, sway: 20 + R() * 50
      }));
      cache.stones = Array.from({ length: 16 }, () => ({
        x: R() * W, y: 720 + R() * 170, w: 50 + R() * 130, h: 8 + R() * 18, a: 0.1 + R() * 0.25
      }));
    }

    if (key === 'ruins') {
      cache.stars = Array.from({ length: 38 }, () => ({
        x: R() * W, y: 40 + R() * 280, r: 0.5 + R() * 1.4, a: 0.08 + R() * 0.3
      }));
      cache.clouds = Array.from({ length: 13 }, () => ({
        x: R() * W, y: 360 + R() * 280, w: 130 + R() * 300, h: 20 + R() * 54,
        a: 0.05 + R() * 0.13, sp: 2 + R() * 6
      }));
      cache.islands = Array.from({ length: 5 }, () => ({
        x: 80 + R() * 1440, y: 190 + R() * 320, w: 70 + R() * 150, h: 20 + R() * 34
      }));
      cache.columns = Array.from({ length: 5 }, (_, i) => ({
        x: 120 + i * 350 + R() * 70, h: 120 + R() * 140, w: 20 + R() * 18, a: 0.16 + R() * 0.18
      }));
      cache.motes = Array.from({ length: 38 }, () => ({
        x: R() * W, y: 200 + R() * 560, ph: R() * TAU, size: 1 + R() * 2.4,
        sp: 2 + R() * 9, sway: 10 + R() * 35
      }));
    }

    if (key === 'neon') {
      cache.stars = Array.from({ length: 40 }, () => ({
        x: R() * W, y: 20 + R() * 240, r: 0.4 + R() * 1.2, a: 0.05 + R() * 0.22
      }));
      cache.buildings = [
        Array.from({ length: 18 }, () => ({ x: 0, w: 0, h: 0, layer: 0 })),
        Array.from({ length: 15 }, () => ({ x: 0, w: 0, h: 0, layer: 1 }))
      ];
      [0, 1].forEach(layer => {
        let x = -40;
        cache.buildings[layer] = [];
        while (x < W + 50) {
          const w = 60 + R() * 110;
          const h = 120 + R() * (layer === 0 ? 250 : 340);
          cache.buildings[layer].push({
            x, w, h: h, layer,
            windows: Array.from({ length: Math.floor(h / 28) * Math.floor(w / 30) }, (_, i) => ({
              x: 8 + (i % Math.floor(w / 30)) * 28,
              y: 16 + Math.floor(i / Math.floor(w / 30)) * 27,
              on: R() > 0.56
            })).slice(0, 22)
          });
          x += w + 6 + R() * 22;
        }
      });
      cache.rain = Array.from({ length: 95 }, () => ({
        x: R() * W, y: R() * H, len: 14 + R() * 28, sp: 600 + R() * 700, a: 0.08 + R() * 0.24
      }));
      cache.signs = [
        { x: 220, y: 260, w: 24, h: 170, color: '#ff4fa3', dir: 1 },
        { x: 1350, y: 220, w: 18, h: 120, color: '#42f0ff', dir: -1 },
        { x: 980, y: 300, w: 54, h: 20, color: '#ffd45e', dir: 1 }
      ];
    }
    mapCache[key] = cache;
    return cache;
  }

  function drawSky(ctx, stops) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    stops.forEach(s => g.addColorStop(s[0], s[1]));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  function drawStars(ctx, stars, t) {
    stars.forEach((s, i) => {
      const a = s.a * (0.65 + 0.35 * Math.sin(t * 1.3 + i));
      ctx.fillStyle = `rgba(255,238,220,${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, TAU);
      ctx.fill();
    });
  }

  function drawLava(ctx, t) {
    const c = getCache('lava');
    drawSky(ctx, [
      [0, '#130a18'], [0.42, '#2a0f18'], [0.66, '#7d2b1c'], [0.74, '#1b0b11'], [1, '#080407']
    ]);
    drawStars(ctx, c.stars, t);
    glowCircle(ctx, 1180, 310, 300, 'rgba(255,112,48,0.34)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sun = ctx.createRadialGradient(1180, 330, 10, 1180, 330, 150);
    sun.addColorStop(0, 'rgba(255,190,110,0.85)');
    sun.addColorStop(0.45, 'rgba(255,102,44,0.34)');
    sun.addColorStop(1, 'rgba(255,70,20,0)');
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(1180, 330, 170, 0, TAU);
    ctx.fill();
    ctx.restore();

    for (let layer = 0; layer < 3; layer++) {
      const pts = c.ridges[layer].map(([x, y]) => [x, y + 10 + layer * 4]);
      poly(ctx, pts, ['#25111b', '#1b0c15', '#110810'][layer]);
    }

    // 火山口
    ctx.save();
    ctx.globalAlpha = 0.9;
    poly(ctx, [[680, 500], [770, 392], [860, 500]], '#160a10');
    ctx.globalCompositeOperation = 'lighter';
    const volcano = ctx.createLinearGradient(760, 400, 760, 520);
    volcano.addColorStop(0, 'rgba(255,90,30,0.5)');
    volcano.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = volcano;
    ctx.beginPath();
    ctx.moveTo(742, 470);
    ctx.quadraticCurveTo(770, 420, 790, 470);
    ctx.quadraticCurveTo(770, 450, 742, 470);
    ctx.fill();
    ctx.restore();

    // 熔岩雾
    ctx.save();
    const mist = ctx.createLinearGradient(0, 540, 0, 720);
    mist.addColorStop(0, 'rgba(255,86,36,0)');
    mist.addColorStop(1, 'rgba(255,86,36,0.2)');
    ctx.fillStyle = mist;
    ctx.fillRect(0, 540, W, 184);
    ctx.restore();

    // 岩地
    const floor = ctx.createLinearGradient(0, GROUND, 0, H);
    floor.addColorStop(0, '#241116');
    floor.addColorStop(0.13, '#160b10');
    floor.addColorStop(1, '#070406');
    ctx.fillStyle = floor;
    ctx.fillRect(0, GROUND, W, H - GROUND);

    // 地表凹凸
    ctx.beginPath();
    ctx.moveTo(-20, GROUND + 2);
    let x = -20;
    let rr = rng(99);
    while (x < W + 40) {
      const step = 30 + rr() * 65;
      ctx.lineTo(x, GROUND - rr() * 7);
      x += step;
    }
    ctx.lineTo(W + 40, GROUND + 7);
    ctx.lineTo(W + 40, H);
    ctx.lineTo(-20, H);
    ctx.closePath();
    ctx.fillStyle = '#1a0d12';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,113,52,0.75)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // 裂缝发光
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    c.cracks.forEach((cr, i) => {
      const pulse = 0.35 + 0.2 * Math.sin(t * 2 + i);
      ctx.strokeStyle = `rgba(255,94,36,${pulse})`;
      ctx.lineWidth = cr.w;
      ctx.beginPath();
      ctx.moveTo(cr.x, GROUND + 7);
      ctx.lineTo(cr.x + cr.bend * 0.4, GROUND + cr.len * 0.55);
      ctx.lineTo(cr.x + cr.bend, GROUND + cr.len);
      ctx.stroke();
    });
    ctx.restore();

    c.rocks.forEach(r => {
      ctx.fillStyle = 'rgba(8,4,7,0.9)';
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.w / 2, r.h / 2, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,108,48,0.18)';
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // 火星
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    c.embers.forEach((e, i) => {
      const y = ((e.y - t * e.sp) % 780 + 780) % 780 + 90;
      const x = e.x + Math.sin(t * 0.8 + e.ph) * e.sway;
      const a = 0.25 + 0.55 * Math.max(0, Math.sin(t * 2 + e.ph));
      ctx.fillStyle = `rgba(255,${110 + (i % 3) * 28},45,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, e.size, 0, TAU);
      ctx.fill();
    });
    ctx.restore();

    // 前景熔岩边
    ctx.save();
    const rim = ctx.createLinearGradient(0, GROUND, 0, GROUND + 34);
    rim.addColorStop(0, 'rgba(255,121,48,0.40)');
    rim.addColorStop(1, 'rgba(255,80,28,0)');
    ctx.fillStyle = rim;
    ctx.fillRect(0, GROUND, W, 34);
    ctx.restore();
  }

  function drawBamboo(ctx, t) {
    const c = getCache('bamboo');
    drawSky(ctx, [
      [0, '#06151c'], [0.52, '#0c2a2b'], [0.72, '#173f38'], [1, '#05100e']
    ]);

    glowCircle(ctx, 1160, 242, 340, 'rgba(151,241,207,0.22)');
    const moon = ctx.createRadialGradient(1132, 218, 10, 1160, 242, 132);
    moon.addColorStop(0, 'rgba(238,255,237,0.98)');
    moon.addColorStop(0.63, 'rgba(185,236,204,0.9)');
    moon.addColorStop(0.94, 'rgba(112,196,166,0.15)');
    moon.addColorStop(1, 'rgba(112,196,166,0)');
    ctx.fillStyle = moon;
    ctx.beginPath();
    ctx.arc(1160, 242, 138, 0, TAU);
    ctx.fill();

    // 薄雾
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const g = ctx.createLinearGradient(0, 340 + i * 105, 0, 470 + i * 105);
      g.addColorStop(0, 'rgba(86,159,139,0)');
      g.addColorStop(0.5, `rgba(86,159,139,${0.055 - i * 0.01})`);
      g.addColorStop(1, 'rgba(86,159,139,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 340 + i * 105, W, 130);
    }
    ctx.restore();

    // 远处竹
    c.bambooFar.forEach((b, i) => {
      drawBambooStalk(ctx, b, t, false);
    });

    // 远处石阶
    ctx.fillStyle = 'rgba(26,65,55,0.4)';
    ctx.fillRect(0, 680, W, 50);

    // 月光洒落
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const beam = ctx.createLinearGradient(1020, 280, 860, 720);
    beam.addColorStop(0, 'rgba(164,255,219,0.08)');
    beam.addColorStop(1, 'rgba(164,255,219,0)');
    ctx.fillStyle = beam;
    ctx.beginPath();
    ctx.moveTo(1050, 280);
    ctx.lineTo(1210, 280);
    ctx.lineTo(1010, 724);
    ctx.lineTo(730, 724);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 近处竹
    c.bambooNear.forEach(b => drawBambooStalk(ctx, b, t, true));

    // 地面
    const floor = ctx.createLinearGradient(0, GROUND, 0, H);
    floor.addColorStop(0, '#16372e');
    floor.addColorStop(0.08, '#0c241e');
    floor.addColorStop(1, '#030c0a');
    ctx.fillStyle = floor;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.strokeStyle = 'rgba(137,231,178,0.42)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, GROUND);
    ctx.lineTo(W, GROUND);
    ctx.stroke();

    c.stones.forEach(s => {
      ctx.save();
      ctx.globalAlpha = s.a;
      ctx.fillStyle = '#5d9d80';
      ctx.beginPath();
      ctx.ellipse(s.x, s.y, s.w / 2, s.h / 2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    });

    // 草叶
    const r = rng(615);
    ctx.strokeStyle = 'rgba(56,132,99,0.4)';
    for (let i = 0; i < 46; i++) {
      const gx = r() * W;
      const h = 6 + r() * 20;
      const sway = Math.sin(t * 1.2 + i) * 3;
      ctx.lineWidth = 1 + r() * 1.2;
      ctx.beginPath();
      ctx.moveTo(gx, GROUND + 2);
      ctx.quadraticCurveTo(gx + sway, GROUND - h * 0.45, gx + sway * 1.5, GROUND - h);
      ctx.stroke();
    }

    // 萤火
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    c.fireflies.forEach((f, i) => {
      const x = f.x + Math.sin(t * f.sp + f.ph) * f.sway;
      const y = f.y + Math.cos(t * f.sp * 0.7 + f.ph) * 22;
      const a = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 2.2 + f.ph));
      glowCircle(ctx, x, y, f.size * 8, `rgba(145,255,190,${a * 0.2})`);
      ctx.fillStyle = `rgba(200,255,208,${a})`;
      ctx.beginPath();
      ctx.arc(x, y, f.size, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawBambooStalk(ctx, b, t, near) {
    const sway = Math.sin(t * 0.5 + b.x * 0.01) * (near ? 5 : 2);
    const topX = b.x + b.lean + sway;
    ctx.save();
    ctx.globalAlpha = b.a;
    ctx.strokeStyle = near ? '#174c3b' : '#0e3129';
    ctx.lineWidth = b.w;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x, GROUND + 10);
    ctx.quadraticCurveTo(b.x + b.lean * 0.5, GROUND - b.h * 0.55, topX, GROUND - b.h);
    ctx.stroke();

    // 竹节
    ctx.strokeStyle = near ? 'rgba(88,167,128,0.55)' : 'rgba(62,125,100,0.3)';
    ctx.lineWidth = 1.5;
    for (let i = 1; i <= b.nodes; i++) {
      const p = i / (b.nodes + 1);
      const y = GROUND + 10 - b.h * p;
      const x = b.x + b.lean * p + sway * p;
      ctx.beginPath();
      ctx.moveTo(x - b.w * 0.9, y);
      ctx.lineTo(x + b.w * 0.9, y);
      ctx.stroke();
    }

    // 竹叶
    for (let i = 0; i < 5; i++) {
      const p = 0.52 + i * 0.1;
      const y = GROUND - b.h * p;
      const x = b.x + b.lean * p + sway * p;
      const dir = i % 2 === 0 ? 1 : -1;
      const leafSway = Math.sin(t * 1.3 + i + b.x) * 3;
      ctx.strokeStyle = near ? 'rgba(38,112,82,0.75)' : 'rgba(27,80,64,0.45)';
      ctx.lineWidth = near ? 2.2 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + dir * (18 + i * 3) + leafSway, y - 12, x + dir * (38 + i * 5) + leafSway, y - 20);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRuins(ctx, t) {
    const c = getCache('ruins');
    drawSky(ctx, [
      [0, '#160f2a'], [0.35, '#3a2446'], [0.58, '#98525d'], [0.72, '#d58a63'], [0.78, '#49333c'], [1, '#100c14']
    ]);
    drawStars(ctx, c.stars, t);
    glowCircle(ctx, 1110, 390, 390, 'rgba(255,164,102,0.32)');
    const sun = ctx.createRadialGradient(1110, 410, 10, 1110, 410, 110);
    sun.addColorStop(0, 'rgba(255,225,180,0.95)');
    sun.addColorStop(0.55, 'rgba(255,175,115,0.38)');
    sun.addColorStop(1, 'rgba(255,130,90,0)');
    ctx.fillStyle = sun;
    ctx.beginPath();
    ctx.arc(1110, 410, 130, 0, TAU);
    ctx.fill();

    // 云层
    c.clouds.forEach((cl, i) => {
      const x = ((cl.x + t * cl.sp) % (W + 400)) - 200;
      ctx.save();
      ctx.globalAlpha = cl.a;
      ctx.fillStyle = i % 3 === 0 ? '#f7b98f' : '#e5aec0';
      ctx.beginPath();
      ctx.ellipse(x, cl.y, cl.w / 2, cl.h / 2, 0, 0, TAU);
      ctx.ellipse(x + cl.w * 0.25, cl.y - cl.h * 0.25, cl.w * 0.26, cl.h * 0.45, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    });

    // 浮空岛
    c.islands.forEach((is, i) => {
      const bob = Math.sin(t * 0.25 + i * 1.7) * 7;
      const y = is.y + bob;
      ctx.save();
      ctx.globalAlpha = 0.5;
      poly(ctx, [
        [is.x - is.w / 2, y], [is.x + is.w / 2, y],
        [is.x + is.w * 0.22, y + is.h], [is.x - is.w * 0.16, y + is.h + 14],
        [is.x - is.w * 0.38, y + is.h * 0.35]
      ], '#2d1e31', 'rgba(232,167,128,0.2)');
      ctx.strokeStyle = 'rgba(232,167,128,0.18)';
      ctx.lineWidth = 1.5;
      for (let k = 0; k < 3; k++) {
        const px = is.x - is.w * 0.25 + k * is.w * 0.24;
        ctx.beginPath();
        ctx.moveTo(px, y + 4);
        ctx.lineTo(px + (k % 2 ? 8 : -6), y - 25 - k * 4);
        ctx.stroke();
      }
      ctx.restore();
    });

    // 远处断柱
    c.columns.forEach(col => {
      ctx.save();
      ctx.globalAlpha = col.a;
      ctx.fillStyle = '#261b2d';
      ctx.fillRect(col.x, GROUND - col.h, col.w, col.h);
      ctx.fillRect(col.x - 8, GROUND - col.h - 10, col.w + 16, 10);
      ctx.restore();
    });

    // 漂浮的碎石
    ctx.save();
    ctx.globalAlpha = 0.45;
    const r = rng(441);
    for (let i = 0; i < 14; i++) {
      const x = r() * W;
      const y = 220 + r() * 360 + Math.sin(t * 0.5 + i) * 10;
      ctx.fillStyle = '#372633';
      ctx.fillRect(x, y, 5 + r() * 13, 4 + r() * 8);
    }
    ctx.restore();

    // 飞鸟
    ctx.strokeStyle = 'rgba(40,25,45,0.55)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const bx = 250 + i * 40 + Math.sin(t * 0.3 + i) * 18;
      const by = 260 + i * 25;
      ctx.beginPath();
      ctx.moveTo(bx - 8, by);
      ctx.quadraticCurveTo(bx - 3, by - 5, bx, by);
      ctx.quadraticCurveTo(bx + 3, by - 5, bx + 8, by);
      ctx.stroke();
    }

    // 神殿地面
    const floor = ctx.createLinearGradient(0, GROUND, 0, H);
    floor.addColorStop(0, '#3b2c39');
    floor.addColorStop(0.12, '#241b27');
    floor.addColorStop(1, '#0c0910');
    ctx.fillStyle = floor;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = 'rgba(240,176,114,0.26)';
    ctx.fillRect(0, GROUND, W, 2);

    // 地砖
    ctx.strokeStyle = 'rgba(208,157,120,0.1)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 9; i++) {
      const gx = i * 210 - 40;
      ctx.beginPath();
      ctx.moveTo(gx, GROUND);
      ctx.lineTo(gx - 60, H);
      ctx.stroke();
    }
    for (let i = 1; i < 5; i++) {
      const gy = GROUND + 34 * i + i * i * 8;
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }

    // 地面符文
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) {
      const cx = 300 + i * 500;
      const pulse = 0.12 + 0.08 * Math.sin(t * 1.2 + i);
      ctx.strokeStyle = `rgba(255,181,111,${pulse})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, GROUND + 78, 48, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, GROUND + 78, 32, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();

    // 尘埃
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    c.motes.forEach(m => {
      const x = m.x + Math.sin(t * 0.4 + m.ph) * m.sway;
      const y = ((m.y - t * m.sp) % 620 + 620) % 620 + 160;
      ctx.fillStyle = `rgba(255,206,160,${0.12 + 0.18 * (0.5 + 0.5 * Math.sin(t + m.ph))})`;
      ctx.fillRect(x, y, m.size, m.size);
    });
    ctx.restore();
  }

  function drawNeon(ctx, t) {
    const c = getCache('neon');
    drawSky(ctx, [
      [0, '#040711'], [0.4, '#0b0b20'], [0.6, '#210d38'], [0.72, '#471943'], [0.78, '#100b1a'], [1, '#05050a']
    ]);
    drawStars(ctx, c.stars, t);
    glowCircle(ctx, 1260, 300, 380, 'rgba(255,60,184,0.12)');
    glowCircle(ctx, 420, 390, 300, 'rgba(53,216,255,0.10)');

    // 后方楼群
    [0, 1].forEach(layer => {
      c.buildings[layer].forEach((b, bi) => {
        const baseY = layer === 0 ? 640 : 690;
        const y = baseY - b.h;
        ctx.fillStyle = layer === 0 ? '#0a0d18' : '#080a13';
        ctx.fillRect(b.x, y, b.w, b.h);
        ctx.fillStyle = layer === 0 ? 'rgba(255,90,190,0.05)' : 'rgba(73,220,255,0.05)';
        ctx.fillRect(b.x, y, b.w, 1.5);
        b.windows.forEach((win, wi) => {
          if (!win.on) return;
          const blink = Math.sin(t * 0.5 + wi + bi) > -0.94;
          if (!blink) return;
          const color = (wi + bi) % 4 === 0 ? '255,93,190' : ((wi + bi) % 4 === 1 ? '85,230,255' : '255,214,104');
          ctx.fillStyle = `rgba(${color},${layer === 0 ? 0.18 : 0.32})`;
          ctx.fillRect(b.x + win.x, y + win.y, 8, 3);
        });
      });
    });

    // 霓虹招牌
    c.signs.forEach((s, i) => {
      const flick = 0.55 + 0.45 * (Math.sin(t * (2 + i * 0.7) + i * 2) > -0.5 ? 1 : 0.2);
      ctx.save();
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 18;
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = flick * 0.8;
      ctx.lineWidth = 2;
      ctx.strokeRect(s.x, s.y, s.w, s.h);
      if (s.w > 30) {
        for (let k = 0; k < 2; k++) {
          ctx.beginPath();
          ctx.moveTo(s.x + 8, s.y + 6 + k * 8);
          ctx.lineTo(s.x + s.w - 8, s.y + 6 + k * 8);
          ctx.stroke();
        }
      }
      ctx.restore();
    });

    // 雨
    const rain = c.rain;
    ctx.save();
    ctx.strokeStyle = 'rgba(157,225,255,0.55)';
    ctx.lineWidth = 1;
    rain.forEach(r => {
      const y = ((r.y + t * r.sp) % (H + 80)) - 40;
      const x = ((r.x - y * 0.08) % (W + 100) + W + 100) % (W + 100);
      ctx.globalAlpha = r.a;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 3, y + r.len);
      ctx.stroke();
    });
    ctx.restore();

    // 屋顶地面
    const floor = ctx.createLinearGradient(0, GROUND, 0, H);
    floor.addColorStop(0, '#101424');
    floor.addColorStop(0.15, '#090b14');
    floor.addColorStop(1, '#030408');
    ctx.fillStyle = floor;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.save();
    ctx.shadowColor = '#ff4fc8';
    ctx.shadowBlur = 15;
    ctx.fillStyle = 'rgba(255,79,200,0.72)';
    ctx.fillRect(0, GROUND, W, 2);
    ctx.restore();

    // 积水反光
    const r = rng(778);
    for (let i = 0; i < 7; i++) {
      const px = 80 + i * 220 + r() * 60;
      const pw = 70 + r() * 150;
      const g = ctx.createLinearGradient(0, GROUND + 8, 0, GROUND + 70);
      g.addColorStop(0, 'rgba(78,205,255,0.10)');
      g.addColorStop(0.5, 'rgba(255,74,188,0.04)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(px, GROUND + 34, pw / 2, 20 + r() * 15, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(156,229,255,0.11)';
      ctx.stroke();
    }

    // 地面反光带
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const refl = ctx.createLinearGradient(0, GROUND, 0, H);
    refl.addColorStop(0, 'rgba(255,74,188,0.06)');
    refl.addColorStop(0.4, 'rgba(57,215,255,0.025)');
    refl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = refl;
    ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.restore();

    // 前景线缆
    ctx.strokeStyle = 'rgba(4,6,12,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 130);
    ctx.quadraticCurveTo(400, 190, 820, 110);
    ctx.quadraticCurveTo(1220, 45, 1600, 150);
    ctx.stroke();
  }

  function drawMap(ctx, key, t) {
    // Scenery is intentionally sampled at 30 Hz; fighter animation stays at the
    // display refresh rate. Two reusable bitmaps bound memory to about 11 MB.
    if (typeof document === 'undefined' || !document.createElement) return drawMapScene(ctx, key, t);
    let entry = backgroundCache.get(key);
    if (!entry) {
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const painter = canvas.getContext('2d');
      if (!painter) return drawMapScene(ctx, key, t);
      entry = { canvas, painter, frame: -1 };
      backgroundCache.set(key, entry);
    } else {
      backgroundCache.delete(key);
      backgroundCache.set(key, entry);
    }
    const frame = Math.floor(Math.max(0, t || 0) * 30 + 1e-7);
    if (entry.frame !== frame) {
      entry.painter.setTransform(1,0,0,1,0,0);
      drawMapScene(entry.painter, key, frame / 30);
      entry.frame = frame;
      backgroundStats.rasterizations++;
    } else backgroundStats.reuses++;
    while (backgroundCache.size > 2) {
      const oldest = backgroundCache.keys().next().value;
      const stale = backgroundCache.get(oldest);
      backgroundCache.delete(oldest);
      stale.canvas.width = stale.canvas.height = 1;
    }
    ctx.drawImage(entry.canvas, 0, 0, W, H);
  }

  function drawMapScene(ctx, key, t) {
    ctx.save();
    if (key === 'bamboo') drawBamboo(ctx, t);
    else if (key === 'ruins') drawRuins(ctx, t);
    else if (key === 'neon') drawNeon(ctx, t);
    else drawLava(ctx, t);

    // 聚光落在交战区，给地面和远景分出层次。
    const accent = (MAPS[key] || MAPS.lava).accent;
    ctx.save();
    const light = ctx.createLinearGradient(0, 180, 0, GROUND + 30);
    light.addColorStop(0, 'rgba(220,238,255,0)');
    light.addColorStop(.65, 'rgba(220,238,255,.025)');
    light.addColorStop(1, 'rgba(220,238,255,.055)');
    poly(ctx, [[580,180],[900,180],[1380,GROUND],[210,GROUND]], light);
    const floor = ctx.createRadialGradient(800, GROUND, 30, 800, GROUND, 690);
    floor.addColorStop(0, U.hexA(accent, .11));
    floor.addColorStop(.7, U.hexA(accent, .035));
    floor.addColorStop(1, U.hexA(accent, 0));
    ctx.translate(800, GROUND + 7); ctx.scale(1, .15); ctx.translate(-800, -GROUND);
    ctx.fillStyle = floor; ctx.fillRect(80, GROUND-710, 1440, 1420);
    ctx.restore();
    line(ctx, 130, GROUND + 1, 1470, GROUND + 1, accent, 1, .16);

    // 全场景压暗，突出角色
    const vignette = ctx.createRadialGradient(W / 2, 470, 280, W / 2, 470, 980);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.62, 'rgba(0,0,0,0.02)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.62)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    const bottom = ctx.createLinearGradient(0, 760, 0, H);
    bottom.addColorStop(0, 'rgba(0,0,0,0)');
    bottom.addColorStop(1, 'rgba(0,0,0,0.38)');
    ctx.fillStyle = bottom;
    ctx.fillRect(0, 760, W, H - 760);
    ctx.restore();
  }

  /* ---------------- 火柴人 ---------------- */

  function arm(origin, a1, l1, a2, l2) {
    const elbow = {
      x: origin.x + Math.cos(a1) * l1,
      y: origin.y + Math.sin(a1) * l1
    };
    const hand = {
      x: elbow.x + Math.cos(a2) * l2,
      y: elbow.y + Math.sin(a2) * l2
    };
    return { elbow, hand };
  }


  const poseCache = new WeakMap();
  const smoothstep = value => { const x = clamp(value, 0, 1); return x * x * (3 - 2 * x); };

  function attackCurve(time, hitAt, activeEnd, duration, rest, windup, contact, follow) {
    // The contact keyframe is exactly the first active simulation frame.
    const strikeLength = Math.min(3 / 60, Math.max(1 / 60, hitAt * .55));
    const strikeStart = Math.max(1 / 120, hitAt - strikeLength);
    const followEnd = Math.min(duration - 1 / 120, Math.max(hitAt + 1 / 60, activeEnd));
    if (time < strikeStart) return lerp(rest, windup, smoothstep(time / strikeStart));
    if (time < hitAt) return lerp(windup, contact, easeInOut((time - strikeStart) / (hitAt - strikeStart)));
    if (time < followEnd) return lerp(contact, follow, easeOut((time - hitAt) / (followEnd - hitAt)));
    return lerp(follow, rest, smoothstep((time - followEnd) / Math.max(1 / 120, duration - followEnd)));
  }

  function basicPose(f, action) {
    const key = f.key || f.data.key;
    const parsedIndex = Number(String(action.key || '').replace('basic', ''));
    const index = Number.isFinite(action.comboIndex) ? action.comboIndex : Number.isFinite(parsedIndex) ? parsedIndex : Math.max(0, f.comboIdx || 0);
    const b = action.basicData || f.data.basic[index];
    const hit = action.startup === undefined ? b.hitAt : action.startup;
    const activeEnd = action.activeEnd === undefined ? (b.activeEnd || hit + 3 / 60) : action.activeEnd;
    const time = action.time, length = action.duration;
    const curve = (rest, wind, contact, follow = contact) => attackCurve(time, hit, activeEnd, length, rest, wind, contact, follow);
    const power = curve(0, -.16, 1, .8);
    const ranged = ['mage','archer','gunner'].includes(key);
    // Each strike has its own silhouette: cut, returning cut, committed finisher.
    const angles = {
      warrior: [[1.25,-.85,-.03,.72],[.68,1.16,-.16,-.86],[-.72,-2.18,.24,1.02]],
      barbarian: [[1.25,-1.25,.13,.94],[.9,1.48,-.17,-.9],[-.78,-2.48,.38,1.28]],
      assassin: [[1.2,-.58,-.04,.5],[.48,1.04,-.22,-.86],[-.7,-1.85,.1,.86]],
      goblin: [[1.2,.58,-.03,.12],[.15,.7,-.06,.16],[.2,-.75,-.13,.35]],
      arashi: [[1.15,-.72,-.05,.48],[.5,1.1,-.18,-.82],[-.65,-1.95,.2,.9]],
      genbu: [[1.25,-1.18,.1,.82],[.86,1.35,-.15,-.78],[-.74,-2.3,.3,1.1]],
      astra: [[1.2,-.35,.16,.28],[.7,.94,-.12,-.5],[-.4,-1.4,.22,.46]],
      chilin: [[1.2,-.6,-.04,.48],[.56,1.0,-.2,-.82],[-.7,-1.9,.16,.9]],
      senmen: [[1.18,-.5,-.06,.4],[.42,.95,-.24,-.8],[-.62,-1.7,.12,.7]]
    };
    let angle;
    if (angles[key]) angle = curve(...angles[key][index]);
    else if (key === 'mage') angle = curve(1.2,-.4,.28,.38);
    else angle = curve(.42,.14,.28,.4);
    const kick = time >= hit ? Math.exp(-(time - hit) * 30) : 0;
    const recover = smoothstep((time - activeEnd) / Math.max(1 / 60, length - activeEnd));
    const rootTravel = action.opts && action.opts.rootMotion || 0;
    return {
      armFA: angle, armFB: angle + (ranged ? .02 : .08),
      armBA: key === 'barbarian' ? curve(1.7,-1.05,.58,1.8) : ranged ? curve(1.8,1.1,.6,1.35) : curve(1.8,1.4,2.05,1.7),
      armBB: key === 'archer' ? curve(1.7,-1.38,-.72,.5) : key === 'barbarian' ? curve(1.7,-.95,.7,1.8) : 1.7,
      weaponAngle: ranged ? curve(.45,-.08,0,-.12) : key === 'goblin' ? curve(.75,.12,-.03,.08) : angle,
      bowDraw: time < hit ? smoothstep(time / Math.max(hit,1/60)) : Math.exp(-(time - hit) * 36),
      lean: ranged ? 2 - kick * (key === 'gunner' ? 8 : 4) : 2 + power * (key === 'barbarian' ? 14 : 9),
      hipShift: ranged ? -kick * 3 : power * 4,
      crouch: (key === 'assassin' ? 3 : 0) + Math.max(0,power) * (b.heavy ? 7 : 2.5),
      footLead: ranged ? 0 : Math.max(0,power) * (b.heavy ? 12 : 7),
      footAnchor: ranged ? 0 : rootTravel * (action.rootProgress || 0) * (1 - recover),
      backFootLift: !ranged && time > activeEnd ? Math.sin(recover * Math.PI) * 8 : 0
    };
  }

  function sampleFighter(f, worldTime) {
    const alpha = Number.isFinite(f.animationAlpha) ? clamp(f.animationAlpha, 0, 1) : 1;
    const realClock = Number.isFinite(f.visualClock) ? f.visualClock : worldTime;
    const previousClock = Number.isFinite(f.previousVisualClock) ? f.previousVisualClock : realClock;
    const clock = lerp(previousClock, realClock, alpha);
    const sample = Object.create(f);
    if (Number.isFinite(f.previousAnimTime)) sample.animTime = lerp(f.previousAnimTime, f.animTime, alpha);
    if (f.action) {
      const before = Number.isFinite(f.previousActionTime) ? Math.min(f.previousActionTime, f.action.time) : f.action.time;
      sample.action = Object.assign({}, f.action, { time: lerp(before, f.action.time, alpha) });
    }
    return { sample, clock };
  }

  function mixPose(from, to, weight) {
    if (weight >= 1) return to;
    const pose = {};
    for (const key of Object.keys(to)) {
      const value = to[key], previous = from[key];
      if (value && typeof value === 'object') pose[key] = { x: lerp(previous.x,value.x,weight), y: lerp(previous.y,value.y,weight) };
      else if (key === 'weaponAngle' || key === 'roll') {
        const delta = Math.atan2(Math.sin(value - previous),Math.cos(value - previous));
        pose[key] = previous + delta * weight;
      } else pose[key] = lerp(previous,value,weight);
    }
    return pose;
  }

  function makePose(f, worldTime) {
    const { sample, clock } = sampleFighter(f, worldTime);
    const action = sample.action;
    const mode = action ? action.type + ':' + (action.serial === undefined ? action.key : action.serial) :
      f.dead ? 'dead' : f.hitstun > 0 && !f.blocking ? 'hit' : f.dodgeTime > 0 ? 'dodge' :
      f.blocking || f.blockstun > 0 ? 'block' : !f.onGround ? 'air' : Math.abs(f.vx || 0) > 25 ? 'walk' : 'idle';
    let state = poseCache.get(f);
    if (state && state.clock === clock && state.mode === mode && state.epoch === f.poseEpoch) return state.pose;
    const target = makeRawPose(sample, clock);
    const reset = !state || state.epoch !== f.poseEpoch || clock < state.clock || Math.abs(f.x - state.x) > 190;
    if (reset) {
      state = { pose:target, from:target, mode, startedAt:clock, duration:0, clock, epoch:f.poseEpoch, x:f.x, trails:[], action:f.action, sample };
      poseCache.set(f,state);
    } else if (state.mode !== mode) {
      // Outgoing action objects stop at the exact cancel frame. Sample that pose,
      // rather than the last rendered frame (which differs at 30/60/144 Hz).
      let from = state.pose;
      if (state.action && action && state.action !== f.action) {
        const old = Object.assign(Object.create(sample), { action:state.action, recoil:0, hitstun:0 });
        from = makeRawPose(old, clock);
      }
      state.from = from;
      state.mode = mode;
      state.startedAt = action ? clock - action.time : clock;
      state.duration = mode === 'hit' ? 0 : action ? Math.min(.045,(action.startup || .12)*.45) : mode === 'dodge' ? .025 : .07;
    }
    const age = Math.max(0,clock - state.startedAt);
    let weight = state.duration > 0 ? smoothstep(age / state.duration) : 1;
    if (action && action.startup !== undefined && action.time >= action.startup) weight = 1;
    const pose = mixPose(state.from,target,weight);
    const movingFast = !f.dead && (f.dodgeTime > 0 || (action && Math.abs(f.vx) > 220));
    if (movingFast && clock > state.clock && (!state.trails.length || clock - state.trails[state.trails.length-1].time >= 2/60)) {
      state.trails.push({ pose:state.pose, x:f.visualX === undefined ? f.x : f.visualX,
        y:f.visualY === undefined ? f.y : f.visualY, facing:f.facing, time:clock });
    }
    state.trails = state.trails.filter(item => clock-item.time < .1).slice(-3);
    state.pose = pose; state.clock = clock; state.x = f.x; state.action = f.action; state.sample = sample;
    return pose;
  }

  const readyPose = { armFA:1.28,armFB:1.78,armBA:1.88,armBB:1.76,weaponAngle:1.32,bowDraw:0,lean:0,crouch:0,hipShift:0,roll:0 };
  function poseTimeline(time, points) {
    if (time <= points[0][0]) return points[0][1];
    for (let i=1;i<points.length;i++) if (time <= points[i][0]) {
      const before=points[i-1],after=points[i];
      const k=smoothstep((time-before[0])/Math.max(1/120,after[0]-before[0]));
      const result={};
      for (const key of Object.keys(readyPose)) result[key]=lerp(before[1][key],after[1][key],k);
      return result;
    }
    return points[points.length-1][1];
  }

  function specialPose(f,a) {
    const key=f.key||f.data.key,type=a.type,time=a.time,duration=a.duration;
    const pose=values=>Object.assign({},readyPose,values);
    const channel=values=>pose({armFA:-1.7,armFB:-1.4,armBA:-1.9,armBB:-1.6,weaponAngle:-1.55,lean:-4,...values});
    const thrust=values=>pose({armFA:.18,armFB:.25,armBA:1.55,armBB:1.35,weaponAngle:0,lean:9,...values});
    let hit=.24,wind=readyPose,contact=readyPose,follow=readyPose;
    if(type==='ult') {
      if(key==='warrior'||key==='barbarian') {
        hit=key==='warrior'?.72:.74;
        wind=channel({armFA:-2.05,armFB:-1.9,weaponAngle:-2.05});
        contact=pose({armFA:.75,armFB:.85,weaponAngle:.8,lean:15,crouch:12,hipShift:5});
        follow=pose({armFA:1.0,armFB:1.05,weaponAngle:1.02,lean:9,crouch:8});
        return poseTimeline(time,[[0,readyPose],[.08,wind],[hit-.09,wind],[hit,contact],[hit+.12,follow],[duration,readyPose]]);
      }
      if(key==='mage') {
        const cast=channel({lean:-2});
        return poseTimeline(time,[[0,readyPose],[.16,cast],[1.46,cast],[duration,readyPose]]);
      }
      if(key==='archer') {
        const sky=pose({armFA:-1.3,armFB:-1.55,armBA:-1.55,armBB:-1.75,weaponAngle:-1.4,bowDraw:1,lean:-3});
        const aim=thrust({armBA:1.2,armBB:-.8,bowDraw:1,lean:-2});
        return poseTimeline(time,[[0,readyPose],[.18,sky],[1.35,sky],[1.55,aim],[1.66,thrust({bowDraw:0,lean:-7})],[duration,readyPose]]);
      }
      if(key==='gunner') {
        const aim=thrust({armBA:.25,armBB:.1,lean:-5,crouch:7});
        const kick=thrust({armBA:.25,armBB:.1,lean:-19,crouch:10,hipShift:-9});
        return poseTimeline(time,[[0,readyPose],[.18,aim],[1.13,aim],[1.19,kick],[1.45,aim],[duration,readyPose]]);
      }
      if(key==='assassin') {
        const points=[[0,readyPose],[.16,channel({crouch:5})]];
        for(const tm of [.28,.47,.66,.85,1.04,1.23]) {
          const reverse=Math.round(tm*100)%2;
          points.push([tm,thrust({armFA:reverse?-.6:.3,armFB:reverse?-.5:.4,weaponAngle:reverse?-.5:.4,crouch:7,lean:13})]);
        }
        points.push([duration,readyPose]);return poseTimeline(time,points);
      }
      const cast=thrust({armFA:-.12,armFB:-.06,weaponAngle:0,crouch:6});
      return poseTimeline(time,[[0,readyPose],[.2,channel({})],[.38,cast],[1.5,cast],[duration,readyPose]]);
    }
    const slot=a.key;
    if(key==='warrior'||key==='barbarian') {
      if(slot==='Q') {hit=key==='warrior'?.27:.28;wind=channel({armFA:-2.25,armFB:-2.15,weaponAngle:-2.2});contact=thrust({armFA:.62,armFB:.7,weaponAngle:.7,crouch:8,lean:13});}
      else if(slot==='W') {hit=.33;wind=pose({armFA:-2.3,armFB:-2.4,armBA:-1.6,armBB:-1.8,weaponAngle:-2.35,crouch:6,lean:3});contact=Object.assign({},wind,{lean:18,hipShift:3,crouch:9});}
      else {hit=.2;wind=channel({armFA:-1.95,armFB:-1.35,weaponAngle:-1.8});contact=channel({armFA:-1.7,armFB:-1.2,weaponAngle:-1.6,lean:-6,crouch:3});}
    } else if(key==='mage') {
      hit=slot==='Q'?.24:slot==='W'?.26:.06;
      wind=channel({armFA:-.7,armFB:-.8,weaponAngle:-.6});
      contact=slot==='W'?pose({armFA:.4,armFB:.25,armBA:.5,armBB:.3,weaponAngle:.25,crouch:10,lean:-4}):thrust({armBA:-.55,armBB:-.75,lean:slot==='E'?9:3});
    } else if(key==='archer') {
      hit=slot==='Q'?.16:slot==='W'?.18:.31;
      wind=slot==='W'?pose({armFA:1.0,armFB:1.5,armBA:1.2,armBB:1.5,weaponAngle:1.4,crouch:8}):thrust({armBA:1.2,armBB:-1.3,bowDraw:1,lean:-3});
      contact=slot==='W'?Object.assign({},wind,{crouch:17,lean:10}):thrust({armBA:1.25,armBB:-.7,bowDraw:0,lean:slot==='E'?-15:1});
    } else if(key==='gunner') {
      hit=slot==='Q'?.28:slot==='W'?.22:.05;
      wind=slot==='Q'?channel({armFA:-2.2,armFB:-1.5,weaponAngle:-2.2}):thrust({armBA:.4,armBB:.3,lean:-5});
      contact=slot==='Q'?thrust({lean:9}):thrust({armBA:.4,armBB:.3,lean:-15,hipShift:-5});
      if(slot==='E') return pose({armFA:1.4,armFB:1.9,armBA:1.2,armBB:1.8,weaponAngle:1.6,crouch:22*smoothstep(time/.06)*(1-smoothstep((time-duration+.1)/.1)),lean:8,roll:TAU*easeInOut(time/duration)});
    } else if(key==='goblin') {
      hit=slot==='Q'?.24:slot==='W'?.4:.2;
      wind=slot==='E'?pose({armFA:1.05,armFB:1.5,weaponAngle:1.35,crouch:9}):pose({armFA:-.65,armFB:-.6,weaponAngle:-.6,lean:-7});
      contact=slot==='E'?Object.assign({},wind,{crouch:17,lean:9}):thrust({crouch:6,lean:14});
    } else {
      hit=slot==='Q'?.22:.18;
      wind=slot==='E'?pose({armFA:1.2,armFB:1.6,weaponAngle:1.4,crouch:9}):pose({armFA:-.9,armFB:-.8,weaponAngle:-.85,crouch:4});
      contact=slot==='E'?Object.assign({},wind,{crouch:16,lean:10}):thrust({armFA:-.08,armFB:0,weaponAngle:-.05,crouch:6,lean:12});
    }
    follow=Object.assign({},contact,{lean:contact.lean*.65,crouch:contact.crouch*.7});
    const preparation=Math.max(1/120,hit-Math.min(.07,hit*.45));
    return poseTimeline(time,[[0,readyPose],[preparation,wind],[hit,contact],[Math.min(duration-.04,hit+.08),follow],[duration,readyPose]]);
  }

  function makeRawPose(f, t) {
    const d = f.data;
    const action = f.action;
    const moving = !action && Math.abs(f.vx || 0) > 25 && f.onGround;
    const hit = !action && !f.blocking && (f.hitstun > 0 || (f.recoil || 0) > .16);
    const animationTime = Number.isFinite(f.animTime) ? f.animTime : t;
    const bob = Math.sin(animationTime * 2.3) * 1.6;

    let hip = { x: 0, y: -64 + bob * 0.2 };
    let neck = { x: 0.5, y: -124 + bob };
    let lean = 0;
    let crouch = 0;
    let footF = { x: 18, y: 0 };
    let footB = { x: -18, y: 0 };
    let armFA = 1.28;
    let armFB = 1.78;
    let armBA = 1.88;
    let armBB = 1.76;
    let weaponAngle = 1.32;
    let bowDraw = 0;
    let armLen = 27;
    let roll = 0;

    if (moving) {
      const phase = f.stridePhase === undefined ? animationTime * 11 : f.stridePhase;
      const s = Math.sin(phase);
      const c = Math.cos(phase);
      const step = s * 21;
      footF = { x: 10 + step, y: -Math.max(0, s) * 17 };
      footB = { x: -10 - step, y: -Math.max(0, -s) * 17 };
      hip.y = -63 + Math.abs(c) * 2.5;
      neck.y = -123 + Math.abs(c) * 2.5;
      lean = 7 * Math.sign((f.vx || 0) * (f.facing || 1));
      armFA = 1.35 - s * 0.75;
      armFB = 1.48 - s * 0.58;
      armBA = 1.65 + s * 0.75;
      armBB = 1.62 + s * 0.58;
      weaponAngle = 1.23;
    }

    if (!f.onGround) {
      const descent = smoothstep(((f.vy || 0) + 160) / 520);
      hip.y = lerp(-66,-70,descent);
      neck.y = lerp(-124,-128,descent);
      footF = { x: lerp(14,20,descent), y: lerp(-26,-9,descent) };
      footB = { x: lerp(-12,-18,descent), y: lerp(-17,-5,descent) };
      lean = lerp(6,-4,descent);
      armFA = lerp(-.6,.55,descent);
      armFB = lerp(-.85,.72,descent);
      armBA = -0.4;
      armBB = -0.65;
      weaponAngle = lerp(-.35,.8,descent);
    }

    if (hit) {
      lean = (f.impactDir || -1) * (9 + (f.recoil || 0) * 12);
      neck.x = (f.impactDir || -1) * (4 + (f.recoil || 0) * 5);
      hip.x = -2;
      footF = { x: -7, y: 0 };
      footB = { x: -27, y: 0 };
      armFA = -2.2;
      armFB = -2.55;
      armBA = -1.65;
      armBB = -1.95;
      weaponAngle = 2.3;
    }

    let actionPose = null;
    if (action) {
      if (action.type === 'basic') {
        actionPose = basicPose(f, action);
      } else if (action.type === 'skill' || action.type === 'ult') {
        actionPose = specialPose(f, action);
      }

      if (actionPose) {
        const weight = action.type === 'basic' ? 1 :
          1 - smoothstep((action.time - action.duration + .08) / .08);
        if (actionPose.armFA !== undefined) armFA = lerp(armFA, actionPose.armFA, weight);
        if (actionPose.armFB !== undefined) armFB = lerp(armFB, actionPose.armFB, weight);
        if (actionPose.armBA !== undefined) armBA = lerp(armBA, actionPose.armBA, weight);
        if (actionPose.armBB !== undefined) armBB = lerp(armBB, actionPose.armBB, weight);
        if (actionPose.weaponAngle !== undefined) weaponAngle = lerp(weaponAngle, actionPose.weaponAngle, weight);
        if (actionPose.bowDraw !== undefined) bowDraw = lerp(bowDraw, actionPose.bowDraw, weight);
        if (actionPose.lean !== undefined) lean = lerp(lean, actionPose.lean, weight);
        if (actionPose.hipShift !== undefined) hip.x += actionPose.hipShift * weight;
        if (actionPose.crouch !== undefined) crouch = lerp(crouch, actionPose.crouch, weight);
        if (actionPose.footLead !== undefined) footF.x += actionPose.footLead;
        if (actionPose.footAnchor !== undefined) footB.x -= actionPose.footAnchor;
        if (actionPose.backFootLift !== undefined) footB.y -= actionPose.backFootLift;
        if (actionPose.roll !== undefined) roll = actionPose.roll;
      }
    }

    // 防御、闪避和落地各有独立重心，避免一直保持站立姿势滑行。
    if (!action && (f.blocking || f.blockstun > 0)) { armFA = -.65; armFB = -1.6; armBA = -.95; armBB = -1.8; weaponAngle = -1.05; crouch += 10; lean = -4; }
    if (f.dodgeTime > 0) { crouch += 24; lean = 19 * ((f.dodgeDir || 1) * (f.facing || 1)); armFA = 2.3; armFB = 2.6; weaponAngle = 2.15; }
    crouch += Math.sin(clamp((f.landTimer || 0) / .16, 0, 1) * Math.PI) * 10;
    hip.y += crouch * 0.4;
    neck.y += crouch * 0.6;
    lean += crouch * 0.14;

    neck.x += lean * 0.42;
    const head = { x: neck.x + lean * 0.32, y: neck.y - 27 };
    const shoulderF = { x: neck.x + 3, y: neck.y + 7 };
    const shoulderB = { x: neck.x - 3, y: neck.y + 7 };
    const frontArm = arm(shoulderF, armFA, armLen, armFB, armLen);
    const backArm = arm(shoulderB, armBA, armLen, armBB, armLen);

    const kneeF = {
      x: (hip.x + footF.x) / 2 + 6 + crouch * 0.55,
      y: (hip.y + footF.y) / 2 + crouch * 0.1
    };
    const kneeB = {
      x: (hip.x + footB.x) / 2 - 5 + crouch * 0.4,
      y: (hip.y + footB.y) / 2 + crouch * 0.1
    };

    return {
      hip, neck, head, shoulderF, shoulderB,
      elbowF: frontArm.elbow, handF: frontArm.hand,
      elbowB: backArm.elbow, handB: backArm.hand,
      kneeF, footF, kneeB, footB,
      weaponAngle, bowDraw, lean, crouch, roll,
      headR: 16
    };
  }

  function strokeLimb(ctx, a, b, c, outer, inner, width) {
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.lineTo(c.x, c.y);
    };
    path();
    ctx.strokeStyle = outer;
    ctx.lineWidth = width + 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    path();
    ctx.strokeStyle = inner;
    ctx.lineWidth = width;
    ctx.stroke();
    ctx.save(); ctx.globalAlpha *= .25;
    path(); ctx.strokeStyle = '#e8f6ff'; ctx.lineWidth = 1.1; ctx.stroke(); ctx.restore();
  }

  function drawHead(ctx, f, pose, color, outline) {
    const { head, headR } = pose;
    const d = f.data;
    ctx.save();
    ctx.translate(head.x, head.y);

    // 头部光晕
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glowCircle(ctx, 0, 0, 38, d.glow.replace('rgba', 'rgba'));
    ctx.restore();

    ctx.beginPath();
    ctx.arc(0, 0, headR, 0, TAU);
    ctx.fillStyle = 'rgba(7,12,18,0.96)';
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.stroke();

    // 发光眼睛
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = d.color2;
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 9;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(4, -3);
    ctx.lineTo(10, -1);
    ctx.stroke();
    ctx.restore();

    if (d.key === 'warrior') {
      // 头带
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-13, -5);
      ctx.lineTo(7, -6);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,137,80,0.55)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-12, -5);
      ctx.quadraticCurveTo(-28, -2, -38, 8);
      ctx.stroke();
    } else if (d.key === 'mage') {
      // 兜帽
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-14, -2);
      ctx.quadraticCurveTo(-8, -23, 8, -14);
      ctx.stroke();
      ctx.strokeStyle = d.color2;
      ctx.fillStyle = d.color2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(-7, -11, 2, 0, TAU);
      ctx.fill();
    } else if (d.key === 'archer') {
      // 尖兜帽
      ctx.fillStyle = 'rgba(20,75,53,0.9)';
      ctx.beginPath();
      ctx.moveTo(-12, -6);
      ctx.quadraticCurveTo(-8, -27, 12, -18);
      ctx.lineTo(4, -9);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = d.color2;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      ctx.arc(-5, -10, 1.5, 0, TAU);
      ctx.fill();
    } else if (d.key === 'barbarian') {
      // 双角战盔
      ctx.strokeStyle = d.color2;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-13, -8);
      ctx.quadraticCurveTo(-30, -18, -34, -31);
      ctx.moveTo(13, -8);
      ctx.quadraticCurveTo(30, -18, 34, -31);
      ctx.stroke();
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -2, 16, 3.55, 5.85);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.18)';
      ctx.beginPath();
      ctx.arc(-9, -1, 2.2, 0, TAU);
      ctx.fill();
    } else if (d.key === 'goblin') {
      // 大耳朵与尖牙
      ctx.fillStyle = 'rgba(45,105,30,.98)';
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-14, -4);
      ctx.quadraticCurveTo(-38, -18, -35, 3);
      ctx.quadraticCurveTo(-27, 5, -14, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(14, -4);
      ctx.quadraticCurveTo(38, -18, 35, 3);
      ctx.quadraticCurveTo(27, 5, 14, 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#f8ffd6';
      ctx.beginPath();
      ctx.moveTo(2, 9);
      ctx.lineTo(7, 9);
      ctx.lineTo(4.5, 14);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = d.color2;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-16, -15);
      ctx.quadraticCurveTo(-4, -25, 7, -18);
      ctx.stroke();
    } else if (d.key === 'assassin') {
      // 兜帽与面罩
      ctx.fillStyle = 'rgba(38,8,56,.98)';
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(-16, 5);
      ctx.quadraticCurveTo(-21, -22, 2, -21);
      ctx.quadraticCurveTo(22, -17, 17, 5);
      ctx.quadraticCurveTo(4, 11, -16, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = d.color2;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-10, 1);
      ctx.lineTo(11, 0);
      ctx.stroke();
      ctx.fillStyle = d.color2;
      ctx.globalAlpha = .8;
      ctx.beginPath();
      ctx.arc(-5, -1, 1.6, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (d.key === 'gunner') {
      // 帽子与雪茄
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-18, -10);
      ctx.lineTo(16, -12);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-10, -11);
      ctx.lineTo(-6, -22);
      ctx.lineTo(8, -20);
      ctx.lineTo(11, -11);
      ctx.stroke();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = '#ffb24a';
      ctx.shadowColor = '#ff8a3d';
      ctx.shadowBlur = 8;
      ctx.fillRect(12, 5, 7, 2);
      ctx.restore();
    } else if (d.key === 'arashi') {
      // 护额与随风飘带
      ctx.strokeStyle = d.color2;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(-14, -7);
      ctx.lineTo(13, -8);
      ctx.stroke();
      ctx.strokeStyle = U.hexA(d.color, .8);
      ctx.lineWidth = 2.6;
      ctx.beginPath();
      ctx.moveTo(-12, -7);
      ctx.quadraticCurveTo(-28, -14, -37, -4);
      ctx.stroke();
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-3, 1, 12, 3.5, 5.9);
      ctx.stroke();
    } else if (d.key === 'genbu') {
      // 苦行僧额印与念珠
      ctx.fillStyle = d.color2;
      ctx.beginPath();
      ctx.arc(-2, -8, 3.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = U.hexA(d.color2, .8);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 2, 14, .3, 2.8);
      ctx.stroke();
      ctx.fillStyle = d.color;
      for (let i = 0; i < 4; i++) {
        const a = .55 + i * .55;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 16, Math.sin(a) * 16, 2, 0, TAU);
        ctx.fill();
      }
    } else if (d.key === 'astra') {
      // 占星师高冠与星环
      ctx.fillStyle = 'rgba(42,26,86,.96)';
      ctx.strokeStyle = d.color2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-17, 2);
      ctx.lineTo(-12, -20);
      ctx.lineTo(0, -31);
      ctx.lineTo(13, -19);
      ctx.lineTo(17, 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = d.color2;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(0, -14, 20, 5, .2, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = d.color2;
      ctx.beginPath();
      ctx.arc(0, -31, 2.2, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (d.key === 'chilin') {
      // 机关目镜与黄铜护额
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-16, -9);
      ctx.lineTo(14, -10);
      ctx.stroke();
      ctx.fillStyle = '#24170f';
      ctx.strokeStyle = d.color2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-7, -1, 7, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = d.color2;
      ctx.beginPath();
      ctx.arc(-7, -1, 2.2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#a87845';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(10, -1, 4, 0, TAU);
      ctx.stroke();
    } else if (d.key === 'senmen') {
      // 皮影戏面妆与头冠
      ctx.fillStyle = 'rgba(66,11,34,.96)';
      ctx.strokeStyle = d.color2;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-16, -2);
      ctx.quadraticCurveTo(-10, -23, 0, -22);
      ctx.quadraticCurveTo(12, -22, 16, -2);
      ctx.quadraticCurveTo(0, 8, -16, -2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(-12, 1);
      ctx.quadraticCurveTo(0, 8, 13, 0);
      ctx.stroke();
      ctx.fillStyle = d.color2;
      ctx.globalAlpha = .85;
      ctx.beginPath();
      ctx.arc(-5, -7, 2, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawSword(ctx, d, pose) {
    const a = pose.weaponAngle;
    ctx.save();
    ctx.translate(pose.handF.x, pose.handF.y);
    ctx.rotate(a);

    // 剑柄
    ctx.strokeStyle = '#c8a06a';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(10, 0);
    ctx.stroke();
    ctx.strokeStyle = '#f5d79d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, -10);
    ctx.lineTo(8, 10);
    ctx.stroke();

    // 剑身
    const blade = ctx.createLinearGradient(8, 0, 104, 0);
    blade.addColorStop(0, '#65758c');
    blade.addColorStop(0.45, '#eef8ff');
    blade.addColorStop(1, '#ffd7b0');
    ctx.strokeStyle = 'rgba(255,169,92,0.35)';
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 14;
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(103, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = blade;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(102, 0);
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18, -1.2);
    ctx.lineTo(97, -1.2);
    ctx.stroke();
    ctx.restore();
  }

  function drawStaff(ctx, d, pose, t) {
    const a = pose.weaponAngle;
    ctx.save();
    ctx.translate(pose.handF.x, pose.handF.y);
    ctx.rotate(a);
    ctx.strokeStyle = '#8b6a53';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-35, 0);
    ctx.lineTo(62, 0);
    ctx.stroke();
    ctx.strokeStyle = '#c7a17a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-30, -1);
    ctx.lineTo(57, -1);
    ctx.stroke();

    const orbX = 68;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.75 + 0.25 * Math.sin(t * 5);
    glowCircle(ctx, orbX, 0, 30 * pulse, d.glow);
    const og = ctx.createRadialGradient(orbX, 0, 0, orbX, 0, 15);
    og.addColorStop(0, '#ffffff');
    og.addColorStop(0.35, d.color2);
    og.addColorStop(1, 'rgba(100,220,255,0)');
    ctx.fillStyle = og;
    ctx.beginPath();
    ctx.arc(orbX, 0, 15, 0, TAU);
    ctx.fill();
    ctx.restore();

    // 法杖环
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(orbX, 0, 10, 0.4, 5.5);
    ctx.stroke();
    ctx.restore();
  }

  function drawBow(ctx, d, pose) {
    const a = pose.weaponAngle;
    ctx.save();
    ctx.translate(pose.handF.x, pose.handF.y);
    ctx.rotate(a);
    // 弓臂
    ctx.strokeStyle = '#b87744';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -39);
    ctx.quadraticCurveTo(22, 0, 0, 39);
    ctx.stroke();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -39);
    ctx.quadraticCurveTo(22, 0, 0, 39);
    ctx.stroke();

    const pull = 7 + pose.bowDraw * 17;
    ctx.strokeStyle = 'rgba(225,255,240,0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(0, -39);
    ctx.lineTo(18 - pull, 0);
    ctx.lineTo(0, 39);
    ctx.stroke();

    if (pose.bowDraw > 0.05) {
      ctx.strokeStyle = '#e6ffe8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(18 - pull, 0);
      ctx.lineTo(74, 0);
      ctx.stroke();
      ctx.fillStyle = d.color2;
      ctx.beginPath();
      ctx.moveTo(74, 0);
      ctx.lineTo(66, -4);
      ctx.lineTo(66, 4);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGun(ctx, d, pose, t) {
    const a = pose.weaponAngle;
    ctx.save();
    ctx.translate(pose.handF.x, pose.handF.y);
    ctx.rotate(a);
    ctx.fillStyle = '#1a2730';
    ctx.strokeStyle = '#b7e9ee';
    ctx.lineWidth = 2;
    // 枪身
    ctx.beginPath();
    ctx.moveTo(-15, -5);
    ctx.lineTo(42, -4);
    ctx.lineTo(54, 0);
    ctx.lineTo(42, 4);
    ctx.lineTo(-8, 5);
    ctx.lineTo(-15, 11);
    ctx.lineTo(-26, 9);
    ctx.lineTo(-22, -1);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 枪管
    ctx.strokeStyle = d.color2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(44, -2);
    ctx.lineTo(65, -2);
    ctx.stroke();
    // 准星
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(30, -6);
    ctx.lineTo(30, -11);
    ctx.stroke();
    // 枪口余火
    if (pose.muzzle > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glowCircle(ctx, 66, -2, 24 * pose.muzzle, 'rgba(255,190,80,0.7)');
      ctx.restore();
    }
    ctx.restore();
  }

  function drawHammer(ctx, d, pose) {
    const a = pose.weaponAngle;
    ctx.save();
    ctx.translate(pose.handF.x, pose.handF.y);
    ctx.rotate(a);
    ctx.lineCap = 'round';

    // 木柄
    ctx.strokeStyle = '#4a2b1c';
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.lineTo(84, 0);
    ctx.stroke();
    ctx.strokeStyle = '#b87745';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-28, -1);
    ctx.lineTo(82, -1);
    ctx.stroke();

    // 锤头
    const metal = ctx.createLinearGradient(70, -28, 110, 30);
    metal.addColorStop(0, '#6f7b87');
    metal.addColorStop(.45, '#e7eef4');
    metal.addColorStop(1, '#59616b');
    ctx.save();
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 14;
    ctx.fillStyle = metal;
    ctx.strokeStyle = '#111820';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(70, -31, 42, 62, 6);
    else ctx.rect(70, -31, 42, 62);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.fillRect(78, -24, 5, 48);
    ctx.fillStyle = d.color;
    ctx.fillRect(92, -20, 8, 40);
    ctx.strokeStyle = d.color2;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(76, -25);
    ctx.lineTo(106, -25);
    ctx.stroke();
    ctx.restore();
  }

  function drawSpear(ctx, d, pose) {
    const a = pose.weaponAngle;
    ctx.save();
    ctx.translate(pose.handF.x, pose.handF.y);
    ctx.rotate(a);
    ctx.lineCap = 'round';

    // 长枪杆
    ctx.strokeStyle = '#3d2a1c';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-48, 0);
    ctx.lineTo(100, 0);
    ctx.stroke();
    ctx.strokeStyle = '#b98552';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-44, -1);
    ctx.lineTo(98, -1);
    ctx.stroke();

    // 枪头
    const steel = ctx.createLinearGradient(92, -15, 136, 15);
    steel.addColorStop(0, '#7b8c76');
    steel.addColorStop(.5, '#f0ffe6');
    steel.addColorStop(1, '#a3c275');
    ctx.fillStyle = steel;
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(130, 0);
    ctx.quadraticCurveTo(107, -15, 94, -8);
    ctx.lineTo(100, 0);
    ctx.lineTo(94, 8);
    ctx.quadraticCurveTo(107, 15, 130, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 红缨
    ctx.strokeStyle = d.color2;
    ctx.lineWidth = 3;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(94, 0);
      ctx.quadraticCurveTo(84, 10 + i * 4, 68, 8 + i * 6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawDagger(ctx, d, pose) {
    const a = pose.weaponAngle;
    ctx.save();
    ctx.translate(pose.handF.x, pose.handF.y);
    ctx.rotate(a);
    ctx.lineCap = 'round';

    // 握柄
    ctx.strokeStyle = '#2b1a36';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(2, 0);
    ctx.stroke();
    ctx.strokeStyle = d.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(2, 0);
    ctx.stroke();

    // 护手
    ctx.strokeStyle = d.color2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(2, -9);
    ctx.lineTo(2, 9);
    ctx.stroke();

    // 短刃
    const blade = ctx.createLinearGradient(2, 0, 46, 0);
    blade.addColorStop(0, '#c7b7da');
    blade.addColorStop(.45, '#ffffff');
    blade.addColorStop(1, d.color2);
    ctx.save();
    ctx.shadowColor = d.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = blade;
    ctx.strokeStyle = '#0b0a10';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(3, -5);
    ctx.quadraticCurveTo(36, -8, 48, 0);
    ctx.quadraticCurveTo(34, 6, 3, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(10, -2);
    ctx.lineTo(38, -2);
    ctx.stroke();
    ctx.restore();
  }

  function drawFist(ctx, d, pose) {
    const a = pose.weaponAngle;
    ctx.save();
    ctx.translate(pose.handF.x, pose.handF.y);
    ctx.rotate(a);
    ctx.strokeStyle = '#e9c39a';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(2, 0);
    ctx.stroke();
    ctx.fillStyle = d.dark;
    ctx.strokeStyle = d.color2;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(7, 0, 8, 0, TAU);
    ctx.fill();
    ctx.stroke();
    ctx.strokeStyle = U.hexA ? U.hexA(d.color2, .72) : d.color2;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(22, 0, 13, -1.1, 1.1);
    ctx.stroke();
    ctx.restore();
  }

  function drawGauntlet(ctx, d, pose) {
    const a = pose.weaponAngle;
    ctx.save();
    ctx.translate(pose.handF.x, pose.handF.y);
    ctx.rotate(a);
    ctx.fillStyle = '#4d3a26';
    ctx.strokeStyle = d.color2;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect ? ctx.roundRect(-12, -14, 34, 28, 6) : ctx.rect(-12, -14, 34, 28);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = d.color;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(18, -10 + i * 10, 3.2, 0, TAU);
      ctx.fill();
    }
    ctx.strokeStyle = U.hexA(d.color2, .6);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(8, -12);
    ctx.lineTo(22, 0);
    ctx.lineTo(8, 12);
    ctx.stroke();
    ctx.restore();
  }

  function drawMechBlade(ctx, f, d, pose) {
    const a = pose.weaponAngle;
    ctx.save();
    ctx.translate(pose.handF.x, pose.handF.y);
    ctx.rotate(a);
    if (f.stance === 'mech') {
      ctx.fillStyle = '#3b2a21';
      ctx.strokeStyle = d.color2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-14, -13, 48, 26, 5) : ctx.rect(-14, -13, 48, 26);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(30, -8, 32, 16, 4) : ctx.rect(30, -8, 32, 16);
      ctx.fill();
      ctx.strokeStyle = '#fff0c9';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(38, -4);
      ctx.lineTo(58, -4);
      ctx.stroke();
      ctx.fillStyle = '#ffb24a';
      ctx.beginPath();
      ctx.arc(-3, 0, 3, 0, TAU);
      ctx.fill();
    } else {
      ctx.strokeStyle = '#7c3a20';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-8, 0);
      ctx.lineTo(9, 0);
      ctx.stroke();
      ctx.strokeStyle = d.color2;
      ctx.shadowColor = d.color;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(92, 0);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff4dd';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(16, -1);
      ctx.lineTo(86, -1);
      ctx.stroke();
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.moveTo(8, -10);
      ctx.lineTo(18, 0);
      ctx.lineTo(8, 10);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawWeapon(ctx, f, pose, t) {
    const d = f.data;
    if (d.key === 'warrior') drawSword(ctx, d, pose);
    else if (d.key === 'mage') drawStaff(ctx, d, pose, t);
    else if (d.key === 'archer') drawBow(ctx, d, pose);
    else if (d.key === 'barbarian') drawHammer(ctx, d, pose);
    else if (d.key === 'goblin') drawSpear(ctx, d, pose);
    else if (d.key === 'assassin') drawDagger(ctx, d, pose);
    else if (d.key === 'arashi') drawFist(ctx, d, pose);
    else if (d.key === 'genbu') drawGauntlet(ctx, d, pose);
    else if (d.key === 'astra') drawStaff(ctx, d, pose, t);
    else if (d.key === 'chilin') drawMechBlade(ctx, f, d, pose);
    else if (d.key === 'senmen') drawDagger(ctx, d, pose);
    else drawGun(ctx, d, pose, t);
  }

  function drawAccessories(ctx, f, pose, t) {
    const d = f.data;
    if (d.key === 'warrior') {
      // 围巾
      const flutter = Math.sin(t * 7) * 5;
      ctx.strokeStyle = 'rgba(255,107,55,0.65)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pose.neck.x - 4, pose.neck.y + 3);
      ctx.quadraticCurveTo(-28, pose.neck.y + 15 + flutter, -48, pose.neck.y + 7 - flutter);
      ctx.stroke();
      // 肩甲
      ctx.strokeStyle = d.color2;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(pose.shoulderF.x, pose.shoulderF.y + 1, 10, -1.2, 1.5);
      ctx.stroke();
    } else if (d.key === 'mage') {
      // 斗篷
      ctx.fillStyle = 'rgba(82,64,150,0.30)';
      ctx.strokeStyle = 'rgba(140,120,255,0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pose.neck.x - 2, pose.neck.y + 5);
      ctx.quadraticCurveTo(-26 + Math.sin(t * 2) * 3, -66, -31, -8 + Math.sin(t * 3) * 2);
      ctx.lineTo(-8, -12);
      ctx.quadraticCurveTo(-5, -50, pose.neck.x + 2, pose.neck.y + 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 漂浮符文
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 2; i++) {
        const ang = t * 1.4 + i * Math.PI;
        ctx.fillStyle = i ? d.color : d.color2;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(20 + Math.cos(ang) * 22, -100 + Math.sin(ang) * 10, 2, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    } else if (d.key === 'archer') {
      // 箭袋
      ctx.save();
      ctx.translate(-17, -98);
      ctx.rotate(-0.3);
      ctx.fillStyle = 'rgba(18,68,48,0.95)';
      ctx.strokeStyle = 'rgba(111,224,169,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-5, 0, 10, 34, 3) : ctx.rect(-5, 0, 10, 34);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#d8ffcf';
      ctx.lineWidth = 1.2;
      for (let i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(i * 3, 2);
        ctx.lineTo(i * 3 - 2, -15);
        ctx.stroke();
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.moveTo(i * 3 - 2, -15);
        ctx.lineTo(i * 3 - 5, -11);
        ctx.lineTo(i * 3 + 1, -11);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    } else if (d.key === 'barbarian') {
      // 兽皮披肩
      ctx.fillStyle = 'rgba(70,36,25,.95)';
      ctx.strokeStyle = 'rgba(255,188,119,.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pose.neck.x - 5, pose.neck.y + 4);
      ctx.quadraticCurveTo(-27, -104, -35, -76);
      ctx.quadraticCurveTo(-25, -72, -21, -82);
      ctx.quadraticCurveTo(-18, -65, -11, -72);
      ctx.lineTo(pose.neck.x + 3, pose.neck.y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 肩甲铆钉
      ctx.fillStyle = d.color2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.arc(-22 + i * 7, -78 + i * 3, 1.5, 0, TAU);
        ctx.fill();
      }
    } else if (d.key === 'goblin') {
      // 细长尾巴
      ctx.strokeStyle = 'rgba(86,164,52,.8)';
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-9, -58);
      ctx.quadraticCurveTo(-42, -48 + Math.sin(t * 5) * 4, -52, -22 + Math.sin(t * 5) * 5);
      ctx.stroke();
      // 骨牙项链
      ctx.fillStyle = '#e8e0c0';
      for (let i = 0; i < 3; i++) {
        const x = -4 + i * 5;
        ctx.beginPath();
        ctx.moveTo(x, pose.neck.y + 12);
        ctx.lineTo(x + 2, pose.neck.y + 18);
        ctx.lineTo(x + 4, pose.neck.y + 12);
        ctx.closePath();
        ctx.fill();
      }
    } else if (d.key === 'assassin') {
      // 飘带
      const flutter = Math.sin(t * 6.5) * 7;
      ctx.strokeStyle = 'rgba(196,92,255,.7)';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pose.neck.x - 5, pose.neck.y + 5);
      ctx.quadraticCurveTo(-32, pose.neck.y + 19 + flutter, -56, pose.neck.y + 5 - flutter);
      ctx.stroke();
      // 背后短刃
      ctx.save();
      ctx.translate(-13, -76);
      ctx.rotate(-0.65);
      ctx.strokeStyle = d.color2;
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(25, 0);
      ctx.stroke();
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-5, 0);
      ctx.lineTo(2, 0);
      ctx.stroke();
      ctx.restore();
    } else if (d.key === 'gunner') {
      // 风衣下摆
      ctx.strokeStyle = 'rgba(50,139,150,0.55)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(pose.neck.x - 2, pose.neck.y + 6);
      ctx.quadraticCurveTo(-20, -85, -28, -42 + Math.sin(t * 3) * 3);
      ctx.stroke();
    } else if (d.key === 'arashi') {
      // 腰间束带与风迹
      const flutter = Math.sin(t * 7) * 5;
      ctx.strokeStyle = U.hexA(d.color2, .7);
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pose.hip.x - 2, pose.hip.y);
      ctx.quadraticCurveTo(-30, pose.hip.y + 16 + flutter, -52, pose.hip.y + 3 - flutter);
      ctx.stroke();
      ctx.strokeStyle = U.hexA(d.color, .45);
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        const yy = -108 + i * 13;
        ctx.beginPath();
        ctx.moveTo(-22 - i * 4, yy);
        ctx.quadraticCurveTo(-40, yy - 8 + Math.sin(t * 4 + i) * 5, -58 - i * 3, yy + 2);
        ctx.stroke();
      }
    } else if (d.key === 'genbu') {
      // 宽厚肩背与念珠
      ctx.fillStyle = 'rgba(68,47,28,.42)';
      ctx.strokeStyle = U.hexA(d.color2, .28);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pose.neck.x - 4, pose.neck.y + 4);
      ctx.quadraticCurveTo(-30, -108, -42, -66);
      ctx.quadraticCurveTo(-24, -60, -16, -76);
      ctx.lineTo(pose.neck.x + 3, pose.neck.y + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = d.color2;
      for (let i = 0; i < 6; i++) {
        const a = 1.9 + i * .24;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 31, -104 + Math.sin(a) * 15, 2.4, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = U.hexA(d.color, .45);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-20, -84, 16, 1.4, 4.3);
      ctx.stroke();
    } else if (d.key === 'astra') {
      // 上窄下宽的星象长袍
      const sway = Math.sin(t * 2.1) * 4;
      ctx.fillStyle = 'rgba(58,38,112,.34)';
      ctx.strokeStyle = U.hexA(d.color2, .25);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pose.neck.x - 3, pose.neck.y + 6);
      ctx.quadraticCurveTo(-26, -60, -39 + sway, -8);
      ctx.quadraticCurveTo(-16, -2, -3, -12);
      ctx.quadraticCurveTo(3, -54, pose.neck.x + 4, pose.neck.y + 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const ang = t * .8 + i * TAU / 3;
        ctx.fillStyle = i % 2 ? d.color2 : d.color;
        ctx.globalAlpha = .45;
        ctx.beginPath();
        ctx.arc(-20 + Math.cos(ang) * 17, -56 + Math.sin(ang) * 26, 1.8, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    } else if (d.key === 'chilin') {
      // 背负的折叠偃甲匣
      const open = f.stance === 'mech';
      ctx.save();
      ctx.translate(-17, -104);
      ctx.rotate(-.12);
      ctx.fillStyle = 'rgba(48,31,20,.96)';
      ctx.strokeStyle = d.color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-17, 0, 34, 46, 5) : ctx.rect(-17, 0, 34, 46);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = U.hexA(d.color2, .8);
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-13, 8 + i * 10);
        ctx.lineTo(13, 8 + i * 10);
        ctx.stroke();
      }
      if (open) {
        ctx.strokeStyle = d.color2;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-14, 8);
        ctx.lineTo(-34, -2);
        ctx.moveTo(14, 8);
        ctx.lineTo(34, -2);
        ctx.stroke();
        ctx.fillStyle = d.color2;
        ctx.beginPath();
        ctx.arc(-36, -3, 3.5, 0, TAU);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(36, -3, 3.5, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    } else if (d.key === 'senmen') {
      // 红绳、戏服下摆与巨型傀儡
      const puppetWorldX = Number.isFinite(f.puppetX) ? f.puppetX : f.x - f.facing * 96;
      const px = (puppetWorldX - f.x) * f.facing;
      const py = Number.isFinite(f.puppetY) ? f.puppetY - f.y : 0;
      const sway = Math.sin(t * 2.2) * 4;
      ctx.strokeStyle = 'rgba(255,120,150,.4)';
      ctx.lineWidth = 1.3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(pose.handF.x, pose.handF.y);
        ctx.quadraticCurveTo(px * .45, -170 + i * 12, px, py - 150 + i * 10);
        ctx.stroke();
      }
      // 本体下摆
      ctx.fillStyle = 'rgba(92,18,45,.42)';
      ctx.strokeStyle = U.hexA(d.color2, .3);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(pose.hip.x - 4, pose.hip.y);
      ctx.quadraticCurveTo(-30, -24, -36 + sway, -3);
      ctx.quadraticCurveTo(-14, 3, 0, -8);
      ctx.lineTo(pose.hip.x + 4, pose.hip.y + 2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 傀儡：木架、关节与红绳
      ctx.save();
      ctx.translate(px, py);
      ctx.strokeStyle = 'rgba(255,209,224,.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(0, -156);
      ctx.lineTo(0, -212);
      ctx.stroke();
      ctx.strokeStyle = '#5b3a2a';
      ctx.lineWidth = 9;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -146);
      ctx.lineTo(0, -76);
      ctx.stroke();
      ctx.strokeStyle = '#c58e62';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(-3, -140);
      ctx.lineTo(-34, -110 + Math.sin(t * 2.4) * 5);
      ctx.moveTo(3, -140);
      ctx.lineTo(34, -116 - Math.sin(t * 2.4) * 5);
      ctx.moveTo(-2, -76);
      ctx.lineTo(-24, -16);
      ctx.moveTo(2, -76);
      ctx.lineTo(24, -16);
      ctx.stroke();
      ctx.fillStyle = '#3d2117';
      ctx.strokeStyle = d.color2;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, -160, 15, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = d.color2;
      ctx.beginPath();
      ctx.arc(-5, -162, 2, 0, TAU);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(5, -162, 2, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,120,150,.6)';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, -160, 20, .4, 2.6);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFighter(ctx, f, t, options = {}) {
    const d = f.data;
    if (!d) return;
    const pose = makePose(f, t || 0);
    const state = poseCache.get(f);
    t = state ? state.clock : t;
    if (!options.noTrail && state) for (const sample of state.trails) {
      const fade = clamp(1 - (t - sample.time) / .12, 0, 1);
      ctx.save(); ctx.translate(sample.x, sample.y); ctx.scale(sample.facing >= 0 ? 1 : -1, 1);
      ctx.globalAlpha = fade * .16;
      const p = sample.pose;
      if (p.roll) { ctx.translate(0,-55); ctx.rotate(p.roll); ctx.translate(0,55); }
      line(ctx, p.hip.x, p.hip.y, p.neck.x, p.neck.y, d.color, 7);
      strokeLimb(ctx, p.hip, p.kneeF, p.footF, d.color, d.color, 4);
      strokeLimb(ctx, p.shoulderF, p.elbowF, p.handF, d.color, d.color, 3);
      ctx.strokeStyle = d.color2; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.head.x, p.head.y, p.headR, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    const outline = '#061018';

    ctx.save();
    ctx.translate(f.visualX === undefined ? f.x : f.visualX, f.visualY === undefined ? f.y : f.visualY);
    ctx.scale(f.facing >= 0 ? 1 : -1, 1);
    if (pose.roll) { ctx.translate(0,-55); ctx.rotate(pose.roll); ctx.translate(0,55); }
    if (f.dead) {
      const k = clamp((f.deathTime || 0) / .52, 0, 1);
      const ease = k * k * (3 - 2 * k);
      ctx.globalAlpha = .82;
      ctx.rotate(-1.32 * ease);
    }

    // 终极充能光环
    if (f.energy >= 100 && !f.dead) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const a = 0.18 + 0.12 * Math.sin(t * 4);
      const g = ctx.createRadialGradient(0, -82, 10, 0, -82, 92);
      g.addColorStop(0, 'rgba(255,255,255,0.04)');
      g.addColorStop(0.55, d.glow.replace(/[\d.]+\)$/, `${a})`));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, -78, 55, 92, 0, 0, TAU);
      ctx.fill();
      // 环绕光点
      for (let i = 0; i < 4; i++) {
        const ang = t * 1.6 + i * TAU / 4;
        ctx.fillStyle = d.color2;
        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(Math.cos(ang) * 38, -80 + Math.sin(ang) * 10, 2.2, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }

    // 状态视觉
    if (f.statuses && !f.dead) {
      for (const s of f.statuses) {
        if (s.type === 'root') {
          ctx.strokeStyle = 'rgba(126,224,120,0.75)';
          ctx.lineWidth = 3;
          for (let i = 0; i < 4; i++) {
            const ang = -0.35 + i * 0.22;
            ctx.beginPath();
            ctx.moveTo(-18 + i * 10, 0);
            ctx.quadraticCurveTo(-22 + i * 12, -24, -8 + i * 9, -38 - i * 4);
            ctx.stroke();
          }
        } else if (s.type === 'slow') {
          ctx.strokeStyle = 'rgba(114,229,255,0.6)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(0, -8, 28, 9 + Math.sin(t * 4) * 2, 0, 0, TAU);
          ctx.stroke();
        } else if (s.type === 'burn') {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          for (let i = 0; i < 3; i++) {
            const fx = -12 + i * 12 + Math.sin(t * 7 + i) * 3;
            const fh = 11 + Math.sin(t * 10 + i) * 5;
            ctx.fillStyle = 'rgba(255,138,52,0.55)';
            ctx.beginPath();
            ctx.moveTo(fx - 4, -4);
            ctx.quadraticCurveTo(fx, -4 - fh, fx + 4, -4);
            ctx.fill();
          }
          ctx.restore();
        } else if (s.type === 'warBuff') {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.strokeStyle = `rgba(255,180,90,${0.28 + 0.12 * Math.sin(t * 5)})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.ellipse(0, -78, 48, 78, 0, 0, TAU);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 后腿、后臂
    strokeLimb(ctx, pose.hip, pose.kneeB, pose.footB, outline, shade(d.color, -0.36), 5);
    strokeLimb(ctx, pose.shoulderB, pose.elbowB, pose.handB, outline, shade(d.color, -0.4), 4.5);

    // 躯干
    ctx.strokeStyle = outline;
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(pose.hip.x, pose.hip.y);
    ctx.lineTo(pose.neck.x, pose.neck.y);
    ctx.stroke();
    const torso = ctx.createLinearGradient(pose.hip.x, pose.hip.y, pose.neck.x, pose.neck.y);
    torso.addColorStop(0, shade(d.color, -0.16));
    torso.addColorStop(0.5, d.color);
    torso.addColorStop(1, d.color2);
    ctx.strokeStyle = torso;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(pose.hip.x, pose.hip.y);
    ctx.lineTo(pose.neck.x, pose.neck.y);
    ctx.stroke();

    // 髋关节
    ctx.fillStyle = outline;
    ctx.beginPath();
    ctx.arc(pose.hip.x, pose.hip.y, 6, 0, TAU);
    ctx.fill();
    ctx.fillStyle = d.color2;
    ctx.beginPath();
    ctx.arc(pose.hip.x, pose.hip.y, 2.2, 0, TAU);
    ctx.fill();

    // 前腿
    strokeLimb(ctx, pose.hip, pose.kneeF, pose.footF, outline, d.color, 7);

    // 披风/配件（躯干后）
    drawAccessories(ctx, f, pose, t);

    // 头部
    drawHead(ctx, f, pose, d.color, outline);

    // 前臂
    strokeLimb(ctx, pose.shoulderF, pose.elbowF, pose.handF, outline, d.color, 6.5);

    // 武器
    const weaponPose = Object.assign({}, pose, {
      muzzle: f.muzzle || 0
    });
    drawWeapon(ctx, f, weaponPose, t);

    // 关节亮点
    ctx.fillStyle = d.color2;
    [pose.elbowF, pose.handF, pose.kneeF, pose.footF].forEach((p, i) => {
      ctx.save();
      ctx.globalAlpha = 0.45 + 0.18 * Math.sin(t * 5 + i);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.8, 0, TAU);
      ctx.fill();
      ctx.restore();
    });

    // 白闪仅重绘骨架，不对整个已绘制场景使用 source-atop，避免矩形白块。
    if (f.hitFlash > 0) {
      ctx.save(); ctx.globalAlpha = clamp(f.hitFlash / .095, 0, 1) * .85;
      const white = '#f5fcff';
      strokeLimb(ctx, pose.hip, pose.kneeF, pose.footF, white, white, 3);
      strokeLimb(ctx, pose.hip, pose.kneeB, pose.footB, white, white, 2);
      strokeLimb(ctx, pose.shoulderF, pose.elbowF, pose.handF, white, white, 2.5);
      line(ctx, pose.hip.x, pose.hip.y, pose.neck.x, pose.neck.y, white, 7);
      ctx.strokeStyle = white; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(pose.head.x, pose.head.y, pose.headR, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  function shade(hex, amt) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = clamp(Math.round(r + (amt > 0 ? (255 - r) * amt : r * amt)), 0, 255);
    g = clamp(Math.round(g + (amt > 0 ? (255 - g) * amt : g * amt)), 0, 255);
    b = clamp(Math.round(b + (amt > 0 ? (255 - b) * amt : b * amt)), 0, 255);
    return `rgb(${r},${g},${b})`;
  }

  function drawShadow(ctx, f) {
    const air = clamp((WORLD.ground - f.y) / 250, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.34 - air * 0.18;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(f.visualX === undefined ? f.x : f.visualX, WORLD.ground + 4, 36 - air * 12, 8 - air * 3, 0, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  /* ---------------- 弹道 / 特效 / 粒子 ---------------- */

  function drawProjectile(ctx, p, t) {
    ctx.save();
    ctx.translate(p.x, p.y);
    const color = p.color || '#fff';
    const ang = Math.atan2(p.vy || 0, p.vx || 1);
    ctx.rotate(p.spin !== undefined ? p.spin : ang);

    if (p.kind === 'orb' || p.kind === 'bigOrb' || p.kind === 'star') {
      const r = p.radius || 12;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glowCircle(ctx, 0, 0, r * 3.2, p.glow || 'rgba(145,120,255,0.7)');
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.38, color);
      g.addColorStop(1, 'rgba(20,10,50,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, TAU);
      ctx.fill();
      ctx.restore();

      // 尾迹碎片
      if (p.kind === 'bigOrb') {
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, r + 6, -0.9, 0.9);
        ctx.stroke();
      }
    } else if (p.kind === 'arrow' || p.kind === 'bigArrow' || p.kind === 'skyArrow') {
      const scale = p.kind === 'bigArrow' ? 1.6 : 1;
      ctx.strokeStyle = p.glow || color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = 7 * scale;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-52 * scale, 0);
      ctx.lineTo(20 * scale, 0);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(235,255,245,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-18 * scale, 0);
      ctx.lineTo(19 * scale, 0);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(25 * scale, 0);
      ctx.lineTo(16 * scale, -5 * scale);
      ctx.lineTo(16 * scale, 5 * scale);
      ctx.closePath();
      ctx.fill();
      // 尾羽
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-15 * scale, 0);
      ctx.lineTo(-24 * scale, -5 * scale);
      ctx.moveTo(-15 * scale, 0);
      ctx.lineTo(-24 * scale, 5 * scale);
      ctx.stroke();
    } else if (p.kind === 'bullet' || p.kind === 'pellet') {
      const scale = p.kind === 'pellet' ? 0.7 : 1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = p.glow || 'rgba(130,245,255,0.7)';
      ctx.lineWidth = 8 * scale;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(-38 * scale, 0);
      ctx.lineTo(11 * scale, 0);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(0, 0, 11 * scale, 3.2 * scale, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(-3 * scale, 0, 16 * scale, 2 * scale, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    } else if (p.kind === 'shockwave') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const r = p.radius || 50;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 20;
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(0, 0, r, -1.2, 1.2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,240,210,0.95)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, r - 4, -1.15, 1.15);
      ctx.stroke();
      ctx.restore();
    } else if (p.kind === 'molotov') {
      ctx.rotate(-0.4);
      ctx.fillStyle = 'rgba(255,186,91,0.8)';
      ctx.strokeStyle = '#ffd9a0';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(-7, -12, 14, 24, 3) : ctx.rect(-7, -12, 14, 24);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(0, -16, 5, 0, TAU);
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glowCircle(ctx, 0, -16, 22, 'rgba(255,120,40,0.55)');
      ctx.restore();
    } else if (p.kind === 'meteor') {
      const r = p.radius || 32;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glowCircle(ctx, 0, 0, r * 2.8, 'rgba(255,104,48,0.65)');
      ctx.restore();
      ctx.fillStyle = '#3b1a1b';
      ctx.strokeStyle = '#ffb067';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 9; i++) {
        const ang = i / 9 * TAU;
        const rr = r * (0.75 + 0.25 * Math.sin(i * 4.1 + p.seed));
        const px = Math.cos(ang) * rr;
        const py = Math.sin(ang) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,161,74,0.65)';
      ctx.beginPath();
      ctx.arc(-r * 0.2, -r * 0.1, r * 0.4, 0, TAU);
      ctx.fill();
    } else if (p.kind === 'spear' || p.kind === 'skySpear') {
      const scale = p.kind === 'skySpear' ? .8 : 1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = p.glow || color;
      ctx.globalAlpha = .28;
      ctx.lineWidth = 16 * scale;
      ctx.beginPath();
      ctx.moveTo(-70 * scale, 0);
      ctx.lineTo(26 * scale, 0);
      ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = '#3d2a1c';
      ctx.lineWidth = 5 * scale;
      ctx.beginPath();
      ctx.moveTo(-76 * scale, 0);
      ctx.lineTo(24 * scale, 0);
      ctx.stroke();
      ctx.strokeStyle = '#c89962';
      ctx.lineWidth = 1.5 * scale;
      ctx.beginPath();
      ctx.moveTo(-72 * scale, -1);
      ctx.lineTo(22 * scale, -1);
      ctx.stroke();
      ctx.fillStyle = color;
      ctx.strokeStyle = '#f3ffe0';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(52 * scale, 0);
      ctx.quadraticCurveTo(32 * scale, -11 * scale, 20 * scale, -5 * scale);
      ctx.lineTo(26 * scale, 0);
      ctx.lineTo(20 * scale, 5 * scale);
      ctx.quadraticCurveTo(32 * scale, 11 * scale, 52 * scale, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (p.kind === 'dagger') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = p.glow || color;
      ctx.globalAlpha = .3;
      ctx.lineWidth = 12;
      ctx.beginPath();
      ctx.moveTo(-28, 0);
      ctx.lineTo(16, 0);
      ctx.stroke();
      ctx.restore();
      ctx.fillStyle = color;
      ctx.strokeStyle = '#fff0ff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(24, 0);
      ctx.quadraticCurveTo(5, -9, -8, -3);
      ctx.lineTo(-4, 0);
      ctx.lineTo(-8, 3);
      ctx.quadraticCurveTo(5, 9, 24, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#2b1a36';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-13, 0);
      ctx.lineTo(-3, 0);
      ctx.stroke();
    } else if (p.kind === 'iceShard') {
      ctx.fillStyle = color;
      ctx.strokeStyle = '#eaffff';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-8, -7);
      ctx.lineTo(-2, 0);
      ctx.lineTo(-8, 7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawProjectileTrail(ctx, p, t) {
    if (!p.trail || p.trail.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < p.trail.length; i++) {
      const tr = p.trail[i];
      const a = (i / p.trail.length) * 0.22;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(tr.x, tr.y, (p.radius || 8) * (0.3 + i / p.trail.length * 0.8), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawZone(ctx, z, t) {
    if (z.type === 'fire') {
      const pulse = 0.72 + 0.28 * Math.sin(t * 9 + z.seed);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(z.x, GROUND + 2, 10, z.x, GROUND + 2, z.radius);
      g.addColorStop(0, `rgba(255,142,45,${0.34 * pulse})`);
      g.addColorStop(0.55, 'rgba(255,84,30,0.17)');
      g.addColorStop(1, 'rgba(255,60,20,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(z.x, GROUND + 8, z.radius * 1.2, 28, 0, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 9; i++) {
        const seed = z.seed + i * 2.13;
        const fx = z.x + Math.sin(seed * 7.1) * z.radius * 0.82;
        const h = (24 + 28 * (0.5 + 0.5 * Math.sin(t * (4 + i * 0.4) + seed))) * (0.8 + 0.2 * pulse);
        const w = 12 + (i % 3) * 6;
        ctx.fillStyle = i % 2 ? 'rgba(255,122,38,0.5)' : 'rgba(255,190,75,0.38)';
        ctx.beginPath();
        ctx.moveTo(fx - w, GROUND + 4);
        ctx.quadraticCurveTo(fx - w * 0.3, GROUND - h * 0.55, fx, GROUND - h);
        ctx.quadraticCurveTo(fx + w * 0.4, GROUND - h * 0.4, fx + w, GROUND + 4);
        ctx.fill();
      }
      ctx.restore();
    } else if (z.type === 'trap') {
      ctx.save();
      const armed = z.armed;
      ctx.strokeStyle = armed ? 'rgba(137,240,129,0.8)' : 'rgba(137,240,129,0.35)';
      ctx.fillStyle = 'rgba(72,153,78,0.18)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(z.x, GROUND + 1, 34, 10, 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const ang = i / 6 * TAU + Math.sin(t * 0.5) * 0.08;
        const r = 24;
        const x = z.x + Math.cos(ang) * r;
        const h = armed ? 18 + Math.sin(t * 3 + i) * 4 : 8;
        ctx.strokeStyle = armed ? '#9aff8f' : 'rgba(137,240,129,0.5)';
        ctx.beginPath();
        ctx.moveTo(x, GROUND);
        ctx.quadraticCurveTo(x + 4, GROUND - h * 0.6, x + (i % 2 ? 8 : -7), GROUND - h);
        ctx.stroke();
      }
      ctx.restore();
    } else if (z.type === 'smoke') {
      const pulse = .82 + .18 * Math.sin(t * 3.4 + z.seed);
      ctx.save();
      const g = ctx.createRadialGradient(z.x, GROUND - 55, 12, z.x, GROUND - 55, z.radius);
      g.addColorStop(0, 'rgba(126,64,160,.42)');
      g.addColorStop(.5, 'rgba(90,50,120,.28)');
      g.addColorStop(1, 'rgba(60,24,80,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(z.x, GROUND - 48, z.radius * 1.05, 84 * pulse, 0, 0, TAU);
      ctx.fill();
      for (let i = 0; i < 9; i++) {
        const seed = z.seed + i * 1.7;
        const px = z.x + Math.sin(seed * 3.7 + t * .55) * z.radius * .72;
        const py = GROUND - 32 - (i % 4) * 23 + Math.sin(seed * 5.3 + t * 1.1) * 9;
        const r = 22 + (i % 3) * 10;
        ctx.fillStyle = i % 2 ? 'rgba(188,116,226,.12)' : 'rgba(120,78,160,.18)';
        ctx.beginPath();
        ctx.arc(px, py, r * pulse, 0, TAU);
        ctx.fill();
      }
      ctx.strokeStyle = 'rgba(212,156,255,.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(z.x, GROUND + 1, z.radius * .9, 16, 0, 0, TAU);
      ctx.stroke();
      ctx.restore();
    } else if (z.type === 'starGate') {
      const pulse = .78 + .22 * Math.sin(t * 4 + z.seed);
      const cy = GROUND - 108;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createLinearGradient(z.x, GROUND, z.x, GROUND - 238);
      g.addColorStop(0, U.hexA(z.color, .04));
      g.addColorStop(.55, U.hexA(z.color, .16 * pulse));
      g.addColorStop(1, U.hexA(z.color, .02));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(z.x, cy, z.radius * .72, 124, 0, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = U.hexA(z.color, .72);
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.ellipse(z.x, cy, z.radius * .72, 116, 0, 0, TAU);
      ctx.stroke();
      ctx.strokeStyle = U.hexA(z.color, .34);
      ctx.lineWidth = 1.2;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.ellipse(z.x, cy, z.radius * (.42 + i * .13), 104 - i * 15, t * .16 + i * .7, 0, TAU);
        ctx.stroke();
      }
      for (let i = 0; i < 4; i++) {
        const a = t * .9 + i * TAU / 4;
        ctx.fillStyle = z.color;
        ctx.globalAlpha = .55;
        ctx.beginPath();
        ctx.arc(z.x + Math.cos(a) * z.radius * .65, cy + Math.sin(a) * 86, 2.3, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawEffect(ctx, e, t) {
    const p = clamp(1 - e.life / e.maxLife, 0, 1);
    const fade = clamp(e.life / e.maxLife, 0, 1);
    ctx.save();
    if (e.type === 'impact') {
      ctx.translate(e.x, e.y); ctx.scale(e.dir || 1, 1);
      ctx.globalCompositeOperation = 'lighter';
      const radius = (e.heavy ? 61 : 36) * (.55 + easeOut(p) * .8);
      ctx.globalAlpha = fade * fade;
      // 冷色格挡火花与白芯命中星芒使用不同轮廓。
      const count = e.blocked ? 4 : 6;
      ctx.fillStyle = e.color;
      for (let i = 0; i < count; i++) {
        const angle = i / count * TAU + .22;
        const length = radius * (i % 2 ? .63 : 1);
        ctx.save(); ctx.rotate(angle);
        poly(ctx, [[-4,0],[length*.34,-3],[length,0],[length*.34,3]], e.color);
        ctx.restore();
      }
      ctx.globalAlpha = Math.pow(fade, 3); ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(0,0,e.heavy ? 13 : 8,e.heavy ? 24 : 14,-.4,0,TAU); ctx.fill();
      ctx.globalAlpha = fade * .6; ctx.lineWidth = e.heavy ? 2.5 : 1.5; ctx.strokeStyle = e.color;
      ctx.beginPath(); ctx.arc(0,0,radius*.6,-1.3,1.3); ctx.stroke();
    } else if (e.type === 'slash') {
      ctx.translate(e.x, e.y);
      ctx.scale(e.face || 1, 1);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade;
      ctx.strokeStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 8;
      const r = e.radius || 90;
      const angle = (e.angle || 0) - ((e.face || 1) < 0 ? Math.PI : 0);
      const start = angle - 1.15 + p * .7;
      const end = angle + 1.05 + p * .18;
      const outer = r * (.93 + p * .12);
      const inner = outer - (e.heavy ? 20 : 12) * fade;
      ctx.globalAlpha = fade * .6;
      ctx.beginPath(); ctx.arc(0,0,outer,start,end);
      ctx.quadraticCurveTo(Math.cos(end)*inner,Math.sin(end)*inner,Math.cos(end)*inner,Math.sin(end)*inner);
      ctx.arc(0,0,Math.max(1,inner),end,start,true); ctx.closePath(); ctx.fillStyle=e.color; ctx.fill();
      ctx.globalAlpha = fade;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, outer - 2, start + 0.15, end - 0.1);
      ctx.stroke();
    } else if (e.type === 'ring') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade * 0.9;
      ctx.strokeStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 22;
      ctx.lineWidth = e.lineWidth || 4;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.radius * (0.25 + p * 0.95), e.radius * (0.1 + p * 0.28) * (e.squash || 1), 0, 0, TAU);
      ctx.stroke();
      if (e.fill) {
        ctx.globalAlpha = fade * 0.08;
        ctx.fillStyle = e.color;
        ctx.fill();
      }
    } else if (e.type === 'burst') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade;
      const r = e.radius * (0.4 + easeOut(p) * 0.8);
      const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, r);
      g.addColorStop(0, 'rgba(255,255,255,0.9)');
      g.addColorStop(0.2, e.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = fade * 0.8;
      for (let i = 0; i < 10; i++) {
        const ang = e.seed + i / 10 * TAU;
        const r1 = r * 0.3;
        const r2 = r * (0.8 + 0.2 * Math.sin(i));
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(ang) * r1, e.y + Math.sin(ang) * r1);
        ctx.lineTo(e.x + Math.cos(ang) * r2, e.y + Math.sin(ang) * r2);
        ctx.stroke();
      }
    } else if (e.type === 'frost') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade;
      ctx.strokeStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 18;
      for (let i = 0; i < 11; i++) {
        const ang = i / 11 * TAU + p * 0.2;
        const r1 = 18 + p * e.radius * 0.28;
        const r2 = e.radius * (0.55 + p * 0.5);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(e.x + Math.cos(ang) * r1, e.y + Math.sin(ang) * r1);
        ctx.lineTo(e.x + Math.cos(ang) * r2, e.y + Math.sin(ang) * r2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(e.x + Math.cos(ang) * r2, e.y + Math.sin(ang) * r2, 3 + p * 4, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = fade * 0.45;
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.ellipse(e.x, e.y, e.radius * (0.3 + p * 0.8), e.radius * (0.12 + p * 0.2), 0, 0, TAU);
      ctx.fill();
    } else if (e.type === 'beam') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade;
      const h = e.height || 80;
      const y = e.y;
      const g = ctx.createLinearGradient(e.x, y - h / 2, e.x, y + h / 2);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.22, e.color);
      g.addColorStop(0.5, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.78, e.color);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(e.x, y - h / 2, e.length || 1500, h);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(e.x, y - h * 0.08, e.length || 1500, h * 0.16);
      for (let i = 0; i < 5; i++) {
        const yy = y - h / 2 + ((t * 300 + i * 37) % h);
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(e.x + 20, yy, (e.length || 1500) - 40, 1);
      }
    } else if (e.type === 'crack') {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = fade;
      ctx.strokeStyle = e.color;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 18;
      ctx.lineWidth = 3;
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * TAU + e.seed;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.lineTo(e.x + Math.cos(ang) * e.radius * (0.55 + p * 0.5), e.y + Math.sin(ang) * e.radius * 0.18);
        ctx.stroke();
      }
    } else if (e.type === 'target') {
      ctx.globalAlpha = 0.4 + 0.3 * Math.sin(t * 12);
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(e.x, WORLD.ground, e.radius, e.radius * 0.28, 0, 0, TAU);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(e.x - 8, WORLD.ground);
      ctx.lineTo(e.x + 8, WORLD.ground);
      ctx.moveTo(e.x, WORLD.ground - 8);
      ctx.lineTo(e.x, WORLD.ground + 8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawParticle(ctx, particle) {
    const p = particle;
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.save();
    ctx.globalAlpha = a * (p.alpha || 1);
    if (p.blend !== false) ctx.globalCompositeOperation = 'lighter';
    if (p.shape === 'line') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
      ctx.stroke();
    } else if (p.shape === 'smoke') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1.4 - a * 0.4), 0, TAU);
      ctx.fill();
    } else {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.3, p.size * (p.shrink ? a : 1)), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMenuFx(ctx, w, h, t, accent, particles) {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createRadialGradient(w * 0.7, h * 0.25, 0, w * 0.7, h * 0.25, w * 0.8);
    g.addColorStop(0, accent + '24');
    g.addColorStop(0.4, accent + '0c');
    g.addColorStop(1, 'rgba(4,7,12,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.strokeStyle = accent + '12';
    ctx.lineWidth = 1;
    const gap = 74;
    for (let x = -h; x < w + h; x += gap) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + h * 0.5, h);
      ctx.stroke();
    }
    ctx.restore();

    particles.forEach(p => {
      const y = ((p.y - t * p.sp) % (h + 40) + h + 40) % (h + 40) - 20;
      const x = p.x + Math.sin(t * 0.5 + p.ph) * p.sway;
      const a = 0.15 + 0.4 * (0.5 + 0.5 * Math.sin(t * 1.8 + p.ph));
      ctx.fillStyle = accent;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(x, y, p.size, 0, TAU);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawAvatar(canvas, key, t = 0) {
    const ctx = canvas.getContext('2d');
    const cw = canvas.width;
    const ch = canvas.height;
    ctx.clearRect(0, 0, cw, ch);
    const dummy = {
      data: CHARACTERS[key], x: cw * 0.56, y: ch * 0.92, facing: 1,
      vx: 0, vy: 0, onGround: true, action: null, animTime: t,
      energy: 0, hitstun: 0, statuses: [], hitFlash: 0, hurtTimer: 0
    };
    ctx.save();
    const scale = Math.min(cw / 215, ch / 174);
    ctx.translate(cw / 2, ch / 2 + 6);
    ctx.scale(scale, scale);
    ctx.translate(-cw / 2, -ch / 2);
    drawFighter(ctx, dummy, t);
    ctx.restore();
  }

  return {
    W, H, GROUND, TAU, clamp, lerp, easeOut, easeInOut, rng,
    drawMap, drawFighter, drawShadow, drawProjectile, drawProjectileTrail,
    drawZone, drawEffect, drawParticle, drawMenuFx, drawAvatar, shade, samplePose: makePose,
    getRenderStats() { return Object.assign({ backgroundBitmaps: backgroundCache.size }, backgroundStats); },
    drawFigurePreview(ctx, key, x, y, facing, t) {
      const dummy = {
        data: CHARACTERS[key], x, y, facing, vx: 0, vy: 0, onGround: true,
        action: null, animTime: t, energy: 0, hitstun: 0, statuses: [], hitFlash: 0, hurtTimer: 0
      };
      drawFighter(ctx, dummy, t);
    }
  };
})();
