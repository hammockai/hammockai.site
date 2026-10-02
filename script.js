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
    window.matchMedia('(min-width: 768px)').addEventListener('change', (event) => {
      if (event.matches) setMenu(false);
    });
  }

  /* Scroll reveals: fade + 8px rise, staggered via --d */
  const revealables = Array.from(doc.querySelectorAll('[data-reveal]'));
  const showAll = () => revealables.forEach((el) => el.classList.add('is-visible'));

  if (reduceMotion.matches || !('IntersectionObserver' in window)) {
    showAll();
  } else {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });
    revealables.forEach((el) => observer.observe(el));
    reduceMotion.addEventListener('change', (event) => {
      if (event.matches) {
        showAll();
        observer.disconnect();
      }
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

  /* Hero scene: 90s pixel-art island, drawn on a tiny canvas and scaled up.
     Everything is drawn with fillRect on a low-res grid (1 "pixel" = PX css px),
     so it stays crisp, light and dependency-free. Runs at ~12 fps, pauses when
     off screen or in a hidden tab, and shows a still frame for reduced motion. */
  const scene = doc.getElementById('hero-scene');
  const hero = doc.getElementById('home');

  if (scene && hero && scene.getContext) {
    const ctx = scene.getContext('2d');
    const desktop = window.matchMedia('(min-width: 768px)');
    const FPS = 12;

    const C = {
      sky: ['#04050c', '#070a1a', '#0b1029', '#10173a', '#161f4c', '#1d285e', '#273370'],
      sea: ['#1d4f8f', '#184584', '#143b78', '#10326b', '#0d2a5e', '#0a2250', '#081b42', '#061535'],
      star: '#cfd8ff', starDim: '#5b66a8',
      moon: '#f3eccd', moonShade: '#d6cca3', moonGlow: '#2b3778',
      glintFar: '#3f7fc4', glint: '#6fb4e8', glintHi: '#bfe6ff',
      foam: '#e8fbff', foamDim: '#9fd8ee',
      waveTop: '#38c3d3', waveMid: '#1d97b3', waveLow: '#11698f',
      sand: '#efe2bd', sandHi: '#fff4d6', sandShade: '#cdb88a', sandWet: '#a8946a',
      trunk: '#7a5532', trunkDark: '#563a20',
      leafDark: '#1f6b35', leaf: '#2f8f46', leafHi: '#5cbf5f', coconut: '#4a2f17',
      hammock: '#0b0b0b', rope: '#3a3a3a',
      hull: '#5a3a1e', hullDark: '#3b2412', trim: '#c9a24a', sail: '#e9e2c8', sailShade: '#bfb595', flag: '#0d0d0d', flagMark: '#fafafa',
      skin: '#e3a77a', hair: '#2a1a10', shorts: '#ff6b35', board: '#f5f5f5'
    };

    let PX = 4, W = 0, H = 0, L = null, bg = null, stars = [], glints = [];
    let running = false, rafId = 0, last = 0;
    const t0 = performance.now();

    /* Small seeded random, so the stars and glints don't jump on every resize */
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
    const bands = (c, colors, y0, y1) => {
      const step = (y1 - y0) / colors.length;
      colors.forEach((color, i) => {
        const a = Math.round(y0 + i * step);
        const b = Math.round(y0 + (i + 1) * step);
        rect(c, 0, a, W, b - a, color);
        const next = colors[i + 1];
        if (!next) return;
        for (let x = 0; x < W; x += 2) {
          rect(c, x + (b % 2), b - 1, 1, 1, next);
          if (x % 4 === 0) rect(c, x, b - 2, 1, 1, next);
        }
      });
    };

    /* Layout depends on the screen: island right of the text on desktop, centred on phones */
    const layout = () => {
      const wide = desktop.matches;
      PX = wide ? 4 : 3;
      const cssW = hero.clientWidth;
      const cssH = wide ? hero.clientHeight : 300;
      W = Math.ceil(cssW / PX);
      H = Math.ceil(cssH / PX);
      scene.width = W;
      scene.height = H;
      scene.style.width = W * PX + 'px';
      scene.style.height = H * PX + 'px';
      ctx.imageSmoothingEnabled = false;

      const horizon = Math.round(H * (wide ? 0.56 : 0.4));
      const seaH = H - horizon;
      L = {
        wide, horizon,
        islandX: Math.round(W * (wide ? 0.76 : 0.5)),
        islandY: horizon + Math.round(seaH * (wide ? 0.4 : 0.48)),
        lane: horizon + Math.round(seaH * (wide ? 0.2 : 0.2)),
        moonX: Math.round(W * (wide ? 0.6 : 0.18)),
        moonY: Math.round(horizon * (wide ? 0.32 : 0.36))
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

      glints = [];
      for (let y = horizon + 1; y < H; y += 2) {
        const depth = (y - horizon) / seaH;
        const n = Math.max(2, Math.round(W / (30 - depth * 12)));
        for (let i = 0; i < n; i += 1) {
          glints.push({ y, x: rand() * W, len: 1 + Math.round(depth * 3 + rand() * 2), depth, phase: rand() * 6.3, speed: 0.5 + rand() * 1.5 });
        }
      }

      /* Static backdrop (sky, moon, sea bands) is painted once per resize */
      bg = doc.createElement('canvas');
      bg.width = W;
      bg.height = H;
      const b = bg.getContext('2d');
      bands(b, C.sky, 0, horizon);
      bands(b, C.sea, horizon, H);
      rect(b, 0, horizon, W, 1, '#2e66a8');
      for (let dy = -10; dy <= 10; dy += 1) {
        for (let dx = -10; dx <= 10; dx += 1) {
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > 7.5 && d <= 10 && (dx + dy) % 2 === 0) rect(b, L.moonX + dx, L.moonY + dy, 1, 1, C.moonGlow);
          else if (d <= 6.5) rect(b, L.moonX + dx, L.moonY + dy, 1, 1, (dx > 2 && dy < 2) || (dx === -2 && dy === 1) || (dx === 0 && dy === -3) ? C.moonShade : C.moon);
        }
      }
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

    /* One palm: a curved trunk and drooping fronds. dir = -1 leans left, 1 leans right */
    const drawPalm = (bx, by, dir, t) => {
      const th = L.wide ? 40 : 30;
      const lean = 7;
      const trunkX = (i) => bx + dir * Math.round(Math.pow(i / th, 2) * lean);
      for (let i = 0; i < th; i += 1) {
        rect(ctx, trunkX(i), by - i, 2, 1, i % 3 === 0 ? C.trunkDark : C.trunk);
      }
      const tx = trunkX(th) + 1;
      const ty = by - th;
      const sway = Math.sin(t * 0.9 + dir) * 0.06;
      const leaves = [-3.0, -2.65, -2.25, -1.85, -1.3, -0.9, -0.5, -0.15, 0.3, 2.85];
      leaves.forEach((a, n) => {
        const ang = a + sway;
        const len = (a > -2 && a < -1.1) ? 10 : (n % 2 ? 15 : 17);
        for (let s = 0; s <= len; s += 1) {
          const k = s / len;
          const x = tx + Math.cos(ang) * s;
          const y = ty + Math.sin(ang) * s + k * k * 8;
          rect(ctx, x, y, 1, 1, k < 0.25 ? C.leaf : C.leafHi);
          if (k < 0.85) rect(ctx, x, y + 1, 1, 1, C.leaf);
          // leaflets hanging under the frond
          if (s > 2 && s % 2 === 0 && k < 0.9) rect(ctx, x, y + 2, 1, 1 + (k > 0.4 ? 1 : 0), C.leafDark);
        }
      });
      rect(ctx, tx - 1, ty + 1, 2, 2, C.coconut);
      rect(ctx, tx + 1, ty + 2, 1, 1, C.coconut);
      return trunkX;
    };

    const drawIsland = (t) => {
      const cx = L.islandX;
      const cy = L.islandY;
      const rx = L.wide ? 40 : 30;
      // foam ring breathing around the shore
      const pulse = Math.sin(t * 1.4) > 0 ? 1 : 0;
      for (let dy = -2; dy <= 3; dy += 1) {
        const half = Math.round((rx + 5 + pulse) * Math.sqrt(1 - Math.pow(dy / 4, 2)));
        for (let x = -half; x <= half; x += 1) {
          if ((x + dy + Math.floor(t * 3)) % 3 === 0) rect(ctx, cx + x, cy + dy, 1, 1, C.foamDim);
        }
        rect(ctx, cx - half, cy + dy, 1, 1, C.foam);
        rect(ctx, cx + half, cy + dy, 1, 1, C.foam);
      }
      // sand mound: wet edge, body, highlight, shade
      for (let dy = -8; dy <= 2; dy += 1) {
        const ry = dy < 0 ? 8.5 : 3;
        const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - Math.pow(dy / ry, 2))));
        if (half <= 0) continue;
        rect(ctx, cx - half, cy + dy, half * 2, 1, dy >= 1 ? C.sandWet : C.sand);
        if (dy < 0) rect(ctx, cx + Math.round(half * 0.45), cy + dy, Math.round(half * 0.55), 1, C.sandShade);
        if (dy < -3) rect(ctx, cx - Math.round(half * 0.7), cy + dy, Math.round(half * 0.5), 1, C.sandHi);
      }
      // palms and the black hammock slung between them
      const gap = L.wide ? 16 : 12;
      const left = drawPalm(cx - gap, cy - 5, -1, t);
      const right = drawPalm(cx + gap - 1, cy - 5, 1, t + 1);
      const hy = L.wide ? 16 : 13;
      const ax = left(hy) + 2;
      const bx = right(hy) - 1;
      const ay = cy - 5 - hy;
      const mid = (ax + bx) / 2;
      const half = (bx - ax) / 2;
      const sag = 6 + (Math.sin(t * 1.1) > 0.3 ? 1 : 0);
      for (let x = ax; x <= bx; x += 1) {
        const u = (x - mid) / half;
        const y = ay + sag * (1 - u * u);
        const end = Math.abs(u) > 0.75;
        rect(ctx, x, y, 1, end ? 1 : 2, end ? C.rope : C.hammock);
      }
    };

    const render = (t, shipT = t, waveT = t) => {
      ctx.drawImage(bg, 0, 0);
      drawStars(t);
      drawSea(t);
      drawShip(shipT);
      drawWave(waveT);
      drawIsland(t);
    };

    const frame = (now) => {
      rafId = requestAnimationFrame(frame);
      if (now - last < 1000 / FPS) return;
      last = now;
      render((now - t0) / 1000);
    };

    const start = () => {
      if (running || reduceMotion.matches || doc.hidden) return;
      running = true;
      rafId = requestAnimationFrame(frame);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(rafId);
    };

    /* Reduced motion: one still frame with the ship and the surfer in view */
    const still = () => {
      const shipT = ((L.wide ? 0.57 * W : W - 33) + 34 - W * 0.12) / (W / 95);
      const waveT = 24 + (W * (L.wide ? 0.4 : 0.75)) / Math.max(14, W / 16) - 6;
      render(3, shipT, waveT);
    };

    const setup = () => {
      layout();
      if (reduceMotion.matches) still();
      else render((performance.now() - t0) / 1000);
    };
    setup();

    let resizeTimer = 0;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(setup, 150);
    });
    reduceMotion.addEventListener('change', () => {
      if (reduceMotion.matches) { stop(); still(); } else start();
    });
    doc.addEventListener('visibilitychange', () => (doc.hidden ? stop() : start()));

    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        entries.forEach((entry) => (entry.isIntersecting ? start() : stop()));
      }, { threshold: 0 }).observe(hero);
    } else {
      start();
    }
  }
})();