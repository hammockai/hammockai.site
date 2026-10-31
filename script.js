/* script.js · Por qué existe: HTML y CSS no alcanzan para tres cosas: abrir y cerrar el menú del celular, marcar la sección activa en el menú y dibujar la escena pixel art del hero. Sin dependencias, sin llamadas a otros sitios. */
(() => {
  'use strict';

  const doc = document;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* Floating pill: denser once the page scrolls */
  const header = doc.querySelector('.site-header');
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle('is-scrolled', window.scrollY > 12);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* Mobile menu */
  const toggle = doc.getElementById('menu-toggle');
  const menu = doc.getElementById('mobile-menu');

  const setMenu = (open) => {
    if (!toggle || !menu) return;
    toggle.setAttribute('aria-expanded', String(open));
    menu.hidden = !open;
  };

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      setMenu(toggle.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', (event) => {
      if (event.target.closest('a')) setMenu(false);
    });
    doc.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        toggle.focus();
      }
    });
    doc.addEventListener('click', (event) => {
      if (toggle.getAttribute('aria-expanded') === 'true' && !event.target.closest('.site-header')) {
        setMenu(false);
      }
    });
    window.matchMedia('(min-width: 1024px)').addEventListener('change', (event) => {
      if (event.matches) setMenu(false);
    });
  }

  /* Current section highlighted in the pill nav */
  const navLinks = Array.from(doc.querySelectorAll('.nav-link'));
  const sections = navLinks
    .map((link) => doc.getElementById(link.getAttribute('href').slice(1)))
    .filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    const spy = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navLinks.forEach((link) => {
          if (link.getAttribute('href') === '#' + entry.target.id) {
            link.setAttribute('aria-current', 'true');
          } else {
            link.removeAttribute('aria-current');
          }
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });
    sections.forEach((section) => spy.observe(section));
  }


  /* Pixel scenes: 90s pixel art drawn on tiny canvases and scaled up.
     Everything is drawn with fillRect on a low-res grid (1 "pixel" = px css px),
     so it stays crisp, light and dependency-free. Each scene runs at ~12 fps,
     pauses when off screen or in a hidden tab, and shows a still frame for
     reduced motion. Scenes are declared in HTML with data-scene="name". */
  const desktop = window.matchMedia('(min-width: 768px)');
  const FPS = 12;

  const C = {
    sky: ['#04050c', '#070a1a', '#0b1029', '#10173a', '#161f4c', '#1d285e', '#273370'],
    sea: ['#1d4f8f', '#184584', '#143b78', '#10326b', '#0d2a5e', '#0a2250', '#081b42', '#061535'],
    dusk: ['#1b1036', '#2e1745', '#4a1d4f', '#6e2550', '#9b3550', '#c84f45', '#ec7a3c', '#ffa04a'],
    duskSea: ['#5a2d55', '#43244d', '#321e45', '#24183a', '#19122e', '#110d24'],
    star: '#cfd8ff', starDim: '#5b66a8',
    moon: '#f3eccd', moonShade: '#d6cca3', moonGlow: '#2b3778',
    sun: '#ffb347', sunCore: '#ffd27a', sunGlint: '#ffc46b', cloud: '#c25a6a',
    glintFar: '#3f7fc4', glint: '#6fb4e8', glintHi: '#bfe6ff',
    foam: '#e8fbff', foamDim: '#9fd8ee',
    waveTop: '#38c3d3', waveMid: '#1d97b3', waveLow: '#11698f',
    sand: '#efe2bd', sandHi: '#fff4d6', sandShade: '#cdb88a', sandWet: '#a8946a',
    trunk: '#7a5532', trunkDark: '#563a20',
    leafDark: '#1f6b35', leaf: '#2f8f46', leafHi: '#5cbf5f', coconut: '#4a2f17',
    hammock: '#0b0b0b', rope: '#3a3a3a',
    hull: '#5a3a1e', hullDark: '#3b2412', trim: '#c9a24a', sail: '#e9e2c8', sailShade: '#bfb595', flag: '#0d0d0d', flagMark: '#fafafa',
    skin: '#e3a77a', hair: '#2a1a10', shorts: '#ff6b35', board: '#f5f5f5',
    ember: '#ff6b35', gold: '#c9a24a', white: '#f4f1e6', eye: '#1a1a1a', mouth: '#8a4433',
    coat: '#1f2b55', bandana: '#b8322a', cap: '#2d5fa8', teal: '#1d97b3', cloak: '#2f5d4f', cloakDark: '#21443a',
    pants: '#2a2a2a', boot: '#141414', belt: '#3b2412',
    parch: '#efe2bd', parchDark: '#cdb88a', inkLine: '#4a3622',
    deck: '#5a3a1e', deckDark: '#3b2412',
    bug: '#9b4dca', bugDark: '#5e2a80', bugEye: '#ff4d4d', wing: '#d9c2ff',
    shield: '#38c3d3', shieldDim: '#1d6f8f', shieldHi: '#bfe6ff', spark: '#fff4d6',
    screen: '#141414', screenLine: '#3a3a3a', text: '#8a8f99'
  };

  /* Small seeded random, so stars and glints don't jump on every resize */
  const rng = (seed) => () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };

  const rect = (c, x, y, w, h, color) => {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), w, h);
  };

  /* Horizontal colour bands with a checkerboard dither between them (very 16-bit) */
  const bands = (c, colors, y0, y1, width) => {
    const step = (y1 - y0) / colors.length;
    colors.forEach((color, i) => {
      const a = Math.round(y0 + i * step);
      const b = Math.round(y0 + (i + 1) * step);
      rect(c, 0, a, width, b - a, color);
      const next = colors[i + 1];
      if (!next) return;
      for (let x = 0; x < width; x += 2) {
        rect(c, x + (b % 2), b - 1, 1, 1, next);
        if (x % 4 === 0) rect(c, x, b - 2, 1, 1, next);
      }
    });
  };

  /* A pre-painted backdrop (sky, sea, sun...) reused on every frame */
  const backdrop = (W, H, paint) => {
    const b = doc.createElement('canvas');
    b.width = W;
    b.height = H;
    paint(b.getContext('2d'));
    return b;
  };

  /* One palm, shaped like the logo: the trunk bows outward and the crown leans
     back toward the hammock. dir = -1 for the left palm, 1 for the right one. */
  const drawPalm = (c, bx, by, dir, t, th) => {
    const s = th >= 30 ? 1 : th / 30;
    const trunkX = (i) => {
      const u = i / th;
      return bx + dir * Math.round(s * (4 * Math.sin(Math.PI * u * 0.85) - 4 * u * u));
    };
    const tw = th >= 20 ? 2 : 1;
    for (let i = 0; i < th; i += 1) {
      rect(c, trunkX(i), by - i, tw, 1, i % 3 === 0 ? C.trunkDark : C.trunk);
    }
    const tx = trunkX(th) + (tw - 1);
    const ty = by - th;
    const sway = Math.sin(t * 0.9 + dir) * 0.06;
    const leaves = [-3.0, -2.65, -2.25, -1.85, -1.3, -0.9, -0.5, -0.15, 0.3, 2.85];
    leaves.forEach((a, n) => {
      const ang = a + sway;
      const len = Math.max(3, Math.round(((a > -2 && a < -1.1) ? 10 : (n % 2 ? 15 : 17)) * s));
      for (let p = 0; p <= len; p += 1) {
        const k = p / len;
        const x = tx + Math.cos(ang) * p;
        const y = ty + Math.sin(ang) * p + k * k * 8 * s;
        rect(c, x, y, 1, 1, k < 0.25 ? C.leaf : C.leafHi);
        if (k < 0.85) rect(c, x, y + 1, 1, 1, C.leaf);
        // leaflets hanging under the frond
        if (th >= 20 && p > 2 && p % 2 === 0 && k < 0.9) rect(c, x, y + 2, 1, 1 + (k > 0.4 ? 1 : 0), C.leafDark);
      }
    });
    if (th >= 20) {
      rect(c, tx - 1, ty + 1, 2, 2, C.coconut);
      rect(c, tx + 1, ty + 2, 1, 1, C.coconut);
    }
    return trunkX;
  };

  /* Sand mound with a foam ring breathing around the shore */
  const drawSand = (c, cx, cy, t, rx) => {
    const ry = rx >= 30 ? 8.5 : Math.max(2.5, rx * 0.3);
    const pulse = Math.sin(t * 1.4) > 0 ? 1 : 0;
    const fr = Math.max(3, Math.round(ry / 2));
    for (let dy = -2; dy <= 3; dy += 1) {
      const half = Math.round((rx + Math.min(5, rx / 3) + pulse) * Math.sqrt(Math.max(0, 1 - Math.pow(dy / (fr + 1), 2))));
      if (half <= 0) continue;
      for (let x = -half; x <= half; x += 1) {
        if ((x + dy + Math.floor(t * 3)) % 3 === 0) rect(c, cx + x, cy + dy, 1, 1, C.foamDim);
      }
      rect(c, cx - half, cy + dy, 1, 1, C.foam);
      rect(c, cx + half, cy + dy, 1, 1, C.foam);
    }
    for (let dy = -Math.ceil(ry); dy <= 2; dy += 1) {
      const r = dy < 0 ? ry : 3;
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - Math.pow(dy / r, 2))));
      if (half <= 0) continue;
      rect(c, cx - half, cy + dy, half * 2, 1, dy >= 1 ? C.sandWet : C.sand);
      if (dy < 0) rect(c, cx + Math.round(half * 0.45), cy + dy, Math.round(half * 0.55), 1, C.sandShade);
      if (dy < -ry / 2) rect(c, cx - Math.round(half * 0.7), cy + dy, Math.round(half * 0.5), 1, C.sandHi);
    }
  };

  /* The Hammock island: two palms with the black hammock slung between them.
     Returns the hammock curve so a scene can put someone in it. */
  const drawIsland = (c, cx, cy, t, o) => {
    drawSand(c, cx, cy, t, o.rx);
    const left = drawPalm(c, cx - o.gap, cy - 5, -1, t, o.th);
    const right = drawPalm(c, cx + o.gap - 1, cy - 5, 1, t + 1, o.th);
    const ax = left(o.hy) + 2;
    const bx = right(o.hy) - 1;
    const ay = cy - 5 - o.hy;
    const mid = (ax + bx) / 2;
    const half = (bx - ax) / 2;
    const sag = o.sag + (Math.sin(t * 1.1) > 0.3 ? 1 : 0);
    const curve = (x) => ay + sag * (1 - Math.pow((x - mid) / half, 2));
    for (let x = ax; x <= bx; x += 1) {
      const end = Math.abs((x - mid) / half) > 0.75;
      rect(c, x, curve(x), 1, end ? 1 : 2, end ? C.rope : C.hammock);
    }
    return { ax, bx, curve };
  };

  /* Sea glints: short light dashes that drift and blink */
  const makeGlints = (rand, W, top, H, density) => {
    const list = [];
    const seaH = H - top;
    for (let y = top + 1; y < H; y += 2) {
      const depth = (y - top) / seaH;
      const n = Math.max(2, Math.round(W / (density - depth * 12)));
      for (let i = 0; i < n; i += 1) {
        list.push({ y, x: rand() * W, len: 1 + Math.round(depth * 3 + rand() * 2), depth, phase: rand() * 6.3, speed: 0.5 + rand() * 1.5 });
      }
    }
    return list;
  };

  /* The runner: sizing, frame rate, pausing and reduced motion for any scene */
  const pixelScene = (target, make) => {
    const canvas = target.tagName === 'CANVAS' ? target : target.appendChild(doc.createElement('canvas'));
    const ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;
    const scene = make(ctx);
    const t0 = performance.now();
    const clock = () => (performance.now() - t0) / 1000;
    let running = false, visible = false, rafId = 0, last = 0;

    const paint = () => (reduceMotion.matches ? scene.still() : scene.draw(clock()));
    const layout = () => {
      const { w, h, px } = scene.size();
      if (!w || !h) return;
      const W = Math.ceil(w / px);
      const H = Math.ceil(h / px);
      canvas.width = W;
      canvas.height = H;
      canvas.style.width = W * px + 'px';
      canvas.style.height = H * px + 'px';
      ctx.imageSmoothingEnabled = false;
      scene.setup(W, H, px);
      paint();
    };
    const frame = (now) => {
      rafId = requestAnimationFrame(frame);
      if (now - last < 1000 / FPS) return;
      last = now;
      scene.draw(clock());
    };
    const start = () => {
      if (running || !visible || reduceMotion.matches || doc.hidden) return;
      running = true;
      rafId = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(rafId);
    };

    layout();
    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(layout, 150);
    });
    reduceMotion.addEventListener('change', () => {
      if (reduceMotion.matches) { stop(); paint(); } else start();
    });
    doc.addEventListener('visibilitychange', () => (doc.hidden ? stop() : start()));
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          visible = entry.isIntersecting;
          if (visible) start(); else stop();
        });
      }, { threshold: 0 }).observe(target);
    } else {
      visible = true;
      start();
    }
  };

  const sprite = (c, rows, x, y, pal, flip = false) => {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i += 1) {
        const key = row[flip ? row.length - 1 - i : i];
        if (key !== '.' && pal[key]) rect(c, x + i, y + j, 1, 1, pal[key]);
      }
    });
  };

  const drawGlints = (c, list, W, t, colors) => {
    list.forEach((g) => {
      if (Math.sin(t * g.speed + g.phase) < 0) return;
      const x = (g.x + t * (2 + g.depth * 6)) % (W + 6) - 3;
      const color = g.depth < 0.25 ? colors[0] : (g.phase > 5.6 ? colors[2] : colors[1]);
      rect(c, x, g.y, g.len, 1, color);
    });
  };

  const frameSize = (el, mobilePx = 3) => () => ({ w: el.clientWidth, h: el.clientHeight, px: desktop.matches ? 4 : mobilePx });

  const SCENES = {};

  /* Hero: night sea, the Hammock island, a pirate ship and a surfer */
  SCENES.hero = (el) => (ctx) => {
    const hero = doc.getElementById('home');
    let W = 0, H = 0, L = null, bg = null, stars = [], glints = [];

    const setup = (w, h, PX) => {
      W = w;
      H = h;
      const wide = desktop.matches;
      // On desktop, place things inside the first screenful so the island is always in view
      const frameH = wide ? Math.min(H, Math.ceil(window.innerHeight / PX)) : H;
      const horizon = Math.round(frameH * (wide ? 0.5 : 0.4));
      const seaH = H - horizon;
      const islandY = wide ? Math.round(frameH * 0.8) : horizon + Math.round(seaH * 0.48);
      L = {
        wide, horizon, islandY,
        islandX: Math.round(W * (wide ? 0.76 : 0.5)),
        lane: horizon + Math.round((islandY - horizon) * 0.4),
        moonX: Math.round(W * (wide ? 0.6 : 0.18)),
        moonY: Math.round(horizon * (wide ? 0.48 : 0.36))
      };

      const rand = rng(1979);
      stars = [];
      const count = Math.round((W * horizon) / 140);
      for (let i = 0; i < count; i += 1) {
        const x = Math.floor(rand() * W);
        const y = Math.floor(rand() * (horizon - 6));
        if (Math.abs(x - L.moonX) < 12 && Math.abs(y - L.moonY) < 12) continue;
        stars.push({ x, y, speed: 0.6 + rand() * 2, phase: rand() * 6.3, big: rand() > 0.9 });
      }
      glints = makeGlints(rand, W, horizon, H, 30);

      bg = backdrop(W, H, (b) => {
        bands(b, C.sky, 0, horizon, W);
        bands(b, C.sea, horizon, H, W);
        rect(b, 0, horizon, W, 1, '#2e66a8');
        for (let dy = -10; dy <= 10; dy += 1) {
          for (let dx = -10; dx <= 10; dx += 1) {
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d > 7.5 && d <= 10 && (dx + dy) % 2 === 0) rect(b, L.moonX + dx, L.moonY + dy, 1, 1, C.moonGlow);
            else if (d <= 6.5) rect(b, L.moonX + dx, L.moonY + dy, 1, 1, (dx > 2 && dy < 2) || (dx === -2 && dy === 1) || (dx === 0 && dy === -3) ? C.moonShade : C.moon);
          }
        }
      });
    };

    const drawStars = (t) => {
      stars.forEach((s) => {
        const on = Math.sin(t * s.speed + s.phase);
        if (on < -0.6) return;
        rect(ctx, s.x, s.y, 1, 1, on > 0.4 ? C.star : C.starDim);
        if (s.big && on > 0.8) {
          rect(ctx, s.x - 1, s.y, 1, 1, C.starDim);
          rect(ctx, s.x + 1, s.y, 1, 1, C.starDim);
          rect(ctx, s.x, s.y - 1, 1, 1, C.starDim);
          rect(ctx, s.x, s.y + 1, 1, 1, C.starDim);
        }
      });
    };

    const drawSea = (t) => {
      glints.forEach((g) => {
        if (Math.sin(t * g.speed + g.phase) < 0) return;
        const x = (g.x + t * (2 + g.depth * 6)) % (W + 6) - 3;
        const color = g.depth < 0.25 ? C.glintFar : (g.phase > 5.6 ? C.glintHi : C.glint);
        rect(ctx, x, g.y, g.len, 1, color);
      });
      /* Moonlight on the water: a broken column of light under the moon */
      for (let y = L.horizon + 2; y < L.horizon + (H - L.horizon) * 0.55; y += 2) {
        const k = (y - L.horizon) / (H - L.horizon);
        const wob = Math.round(Math.sin(t * 2 + y * 0.9) * (1 + k * 3));
        const w = Math.max(1, Math.round(6 - k * 4 + Math.sin(t * 3 + y) * 2));
        rect(ctx, L.moonX - w / 2 + wob, y, w, 1, k < 0.2 ? C.moon : C.glintHi);
      }
    };

    /* Pirate ship (flies the Hammock flag), sails left to right along the horizon */
    const drawShip = (t) => {
      const span = W + 60;
      const x = Math.round(((t * (W / 95) + W * 0.12) % span) - 34);
      const y = L.horizon - 21 + (Math.sin(t * 1.6) > 0 ? 0 : 1);
      // hull
      rect(ctx, x + 2, y + 16, 24, 1, C.trim);
      rect(ctx, x + 2, y + 17, 25, 2, C.hull);
      rect(ctx, x + 4, y + 19, 21, 1, C.hullDark);
      rect(ctx, x + 6, y + 20, 17, 1, C.hullDark);
      rect(ctx, x, y + 15, 4, 2, C.hull);
      [8, 12, 16, 20].forEach((p) => rect(ctx, x + p, y + 18, 1, 1, C.hullDark));
      rect(ctx, x + 27, y + 15, 4, 1, C.hullDark);
      // masts
      rect(ctx, x + 10, y + 2, 1, 14, C.hullDark);
      rect(ctx, x + 19, y + 5, 1, 11, C.hullDark);
      // sails, slightly bellied
      rect(ctx, x + 6, y + 4, 9, 9, C.sail);
      rect(ctx, x + 14, y + 5, 1, 7, C.sailShade);
      rect(ctx, x + 6, y + 12, 9, 1, C.sailShade);
      rect(ctx, x + 16, y + 7, 7, 7, C.sail);
      rect(ctx, x + 22, y + 8, 1, 5, C.sailShade);
      rect(ctx, x + 21, y + 9, 3, 1, C.sail);
      // flag: black with a tiny white hammock between two posts
      const wave = Math.sin(t * 4) > 0 ? 0 : 1;
      rect(ctx, x + 11, y - 3 + wave, 7, 5, C.flag);
      rect(ctx, x + 12, y - 2 + wave, 1, 2, C.flagMark);
      rect(ctx, x + 16, y - 2 + wave, 1, 2, C.flagMark);
      rect(ctx, x + 13, y - 1 + wave, 1, 1, C.flagMark);
      rect(ctx, x + 15, y - 1 + wave, 1, 1, C.flagMark);
      rect(ctx, x + 14, y + wave, 1, 1, C.flagMark);
      // wake
      if (Math.sin(t * 5) > -0.3) rect(ctx, x - 3, y + 20, 3, 1, C.foamDim);
      rect(ctx, x + 26, y + 20, 2, 1, C.foam);
    };

    /* A wave rolls in every ~24 s, with a surfer riding its face */
    const drawWave = (t) => {
      const period = 24;
      const speed = Math.max(14, W / 16);
      const len = Math.min(80, Math.round(W * 0.42));
      const travel = (t + 6) % period * speed;
      const head = Math.round(W + 6 - travel);
      if (head + len < -10) return;
      const base = L.lane;
      // On desktop the wave breaks out before it reaches the text column
      const fade = L.wide ? Math.min(1, Math.max(0, (head - W * 0.4) / (W * 0.14))) : 1;
      if (fade <= 0) return;
      const hMax = Math.max(1, Math.round((L.wide ? 9 : 7) * fade));
      const heightAt = (x) => {
        const r = (x - head) / len;
        if (r < 0 || r > 1) return 0;
        const s = r < 0.14 ? r / 0.14 : (1 - r) / 0.86;
        return Math.round(hMax * Math.pow(s, 1.3));
      };
      for (let x = Math.max(0, head); x < Math.min(W, head + len); x += 1) {
        const h = heightAt(x);
        if (h <= 0) continue;
        rect(ctx, x, base - h, 1, h, C.waveMid);
        rect(ctx, x, base - h, 1, Math.max(1, Math.round(h / 3)), C.waveTop);
        rect(ctx, x, base - 1, 1, 1, C.waveLow);
        const r = (x - head) / len;
        if (r < 0.3 || (x + Math.floor(t * 8)) % 5 === 0) rect(ctx, x, base - h, 1, 1, C.foam);
      }
      // curling lip and spray at the front of the wave
      const top = base - hMax;
      rect(ctx, head - 1, top, 2, 1, C.foam);
      rect(ctx, head - 2, top + 1, 1, 2, C.foam);
      rect(ctx, head - 1, top + 3, 1, 1, C.foamDim);
      if (Math.sin(t * 9) > 0) rect(ctx, head - 4, top - 1, 1, 1, C.foam);
      rect(ctx, head - 3, base - 1, 3, 1, C.foamDim);
      // whitewash trailing behind
      for (let x = head + Math.round(len * 0.3); x < head + len + 14; x += 2) {
        if ((x + Math.floor(t * 6)) % 3) rect(ctx, x, base, 1, 1, C.foamDim);
      }

      if (fade < 0.6) return;
      // surfer: board under the feet, arms out, facing the direction of travel (left)
      const sx = head + 5;
      const sy = base - heightAt(sx) + 1;
      const bob = Math.sin(t * 3) > 0 ? 0 : 1;
      rect(ctx, sx - 3, sy - 1, 8, 1, C.board);
      rect(ctx, sx - 1, sy - 1, 1, 1, C.shorts);
      rect(ctx, sx, sy - 3 + bob, 1, 2 - bob, C.skin);
      rect(ctx, sx + 2, sy - 3 + bob, 1, 2 - bob, C.skin);
      rect(ctx, sx, sy - 4 + bob, 3, 1, C.shorts);
      rect(ctx, sx + 1, sy - 7 + bob, 2, 3, C.skin);
      rect(ctx, sx - 1, sy - 6 + bob, 1, 1, C.skin);
      rect(ctx, sx + 3, sy - 7 + bob, 1, 1, C.skin);
      rect(ctx, sx + 1, sy - 9 + bob, 2, 2, C.skin);
      rect(ctx, sx + 1, sy - 9 + bob, 2, 1, C.hair);
    };

    const render = (t, shipT = t, waveT = t) => {
      ctx.drawImage(bg, 0, 0);
      drawStars(t);
      drawSea(t);
      drawShip(shipT);
      drawWave(waveT);
      drawIsland(ctx, L.islandX, L.islandY, t, L.wide ? { rx: 46, gap: 23, th: 40, hy: 16, sag: 6 } : { rx: 34, gap: 17, th: 30, hy: 13, sag: 6 });
    };

    return {
      size: () => {
        const wide = desktop.matches;
        return { w: hero.clientWidth, h: wide ? hero.clientHeight : 300, px: wide ? 4 : 3 };
      },
      setup,
      draw: (t) => render(t),
      // Reduced motion: one still frame with the ship and the surfer in view
      still: () => {
        const shipT = ((L.wide ? 0.57 * W : W - 33) + 34 - W * 0.12) / (W / 95);
        const waveT = 24 + (W * (L.wide ? 0.4 : 0.75)) / Math.max(14, W / 16) - 6;
        render(3, shipT, waveT);
      }
    };
  };

  /* About: hammock time at sunset, someone reading, a seagull passing by */
  const GULL = [['w...w', '.w.w.', '..w..'], ['.....', 'ww.ww', '..w..']];
  SCENES.sunset = (el) => (ctx) => {
    let W = 0, H = 0, bg = null, glints = [], horizon = 0, sunX = 0, island = null, clouds = [];

    const draw = (t) => {
      ctx.drawImage(bg, 0, 0);
      // retro sun: stripes slide down through the lower half
      const r = Math.max(8, Math.round(H * 0.14));
      for (let dy = -r; dy <= 0; dy += 1) {
        const half = Math.round(Math.sqrt(r * r - dy * dy));
        const stripe = dy > -r / 2 && ((dy + Math.floor(t * 2)) % 4 === 0);
        if (!stripe) rect(ctx, sunX - half, horizon + dy, half * 2, 1, dy < -r * 0.6 ? C.sunCore : C.sun);
      }
      clouds.forEach((c) => {
        const x = ((c.x + t * c.speed) % (W + c.w * 2)) - c.w;
        rect(ctx, x, c.y, c.w, 1, C.cloud);
        rect(ctx, x + 3, c.y - 1, c.w - 8, 1, C.cloud);
      });
      drawGlints(ctx, glints, W, t, ['#a8425a', C.sunGlint, C.sunCore]);
      // gull crosses every ~14 s
      const gx = ((t * W) / 10) % (W * 1.4) - 6;
      const gy = Math.round(H * 0.22 + Math.sin(t * 1.5) * 2);
      sprite(ctx, GULL[Math.floor(t * 4) % 2], gx, gy, { w: C.white });

      const o = desktop.matches ? { rx: 36, gap: 21, th: 26, hy: 10, sag: 4 } : { rx: 30, gap: 18, th: 22, hy: 9, sag: 4 };
      const h = drawIsland(ctx, island.x, island.y, t, o);
      // someone in the hammock, reading; the page turns now and then
      const from = Math.round(h.ax + (h.bx - h.ax) * 0.18), to = Math.round(h.bx - (h.bx - h.ax) * 0.12);
      for (let x = from; x <= to; x += 1) {
        const u = (x - from) / (to - from);
        const yy = h.curve(x) - 1;
        const color = u < 0.1 ? C.hair : u < 0.2 ? C.skin : u < 0.55 ? C.ember : u < 0.9 ? C.white : C.skin;
        rect(ctx, x, yy - (u < 0.2 ? 2 : 1), 1, u < 0.2 ? 3 : 2, color);
      }
      // an open book held over the chest; a page turns every few seconds
      const bx = Math.round(from + (to - from) * 0.3);
      const by = h.curve(bx) - 5;
      rect(ctx, bx, by, 4, 2, C.white);
      rect(ctx, bx + 2, by, 1, 2, C.parchDark);
      if (t % 5 < 0.4) rect(ctx, bx + 1, by - 1, 2, 1, C.white);
      rect(ctx, bx + 1, by + 2, 1, 2, C.skin);
    };

    return {
      size: frameSize(el, 3),
      setup: (w, h) => {
        W = w;
        H = h;
        horizon = Math.round(H * 0.6);
        sunX = Math.round(W * 0.7);
        island = { x: Math.round(W * 0.34), y: horizon + Math.round((H - horizon) * 0.5) };
        const rand = rng(2026);
        glints = makeGlints(rand, W, horizon, H, 26);
        clouds = [0, 1, 2].map((i) => ({ x: rand() * W, y: Math.round(horizon * (0.2 + i * 0.2)), w: 12 + Math.round(rand() * 14), speed: 0.6 + rand() }));
        bg = backdrop(W, H, (b) => {
          bands(b, C.dusk, 0, horizon, W);
          bands(b, C.duskSea, horizon, H, W);
        });
      },
      draw,
      still: () => draw(1)
    };
  };

  /* Precios por mercado (/es/): los botones eligen la lista; sin JavaScript se ven ambas. Sin cookies ni almacenamiento. */
  const root = doc.documentElement;
  const picks = doc.querySelectorAll('.market-pick');
  if (picks.length) {
    const names = { usd: 'Resto del mundo (USD)', clp: 'Chile (CLP)' };
    const chips = doc.querySelectorAll('.market-pick .chip');
    const setMarket = (m, announce) => {
      root.dataset.market = m;
      chips.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.market === m)));
      if (announce) doc.querySelectorAll('[data-market-status]').forEach((p) => { p.textContent = 'Mostrando precios: ' + names[m]; });
    };
    root.classList.add('mk-on');
    picks.forEach((p) => { p.hidden = false; });
    chips.forEach((b) => b.addEventListener('click', () => setMarket(b.dataset.market, true)));
    setMarket('usd', false);
  }

  doc.querySelectorAll('[data-scene]').forEach((el) => {
    const make = SCENES[el.dataset.scene];
    if (make) pixelScene(el, make(el));
  });
})();
