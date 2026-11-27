/* ==========================================================
   Amaan & Juwairiyah — Nikah & Walima
   Vanilla JS · GSAP · Lenis
   ========================================================== */
(() => {
  'use strict';

  /* ---------------- CONFIG ---------------- */
  const CONFIG = {
    // Countdown target: Nikah, 18 Dec 2026, 16:30 IST (Asia/Kolkata, +05:30)
    nikahAt: '2026-12-18T16:30:00+05:30',
    maps: {
      nikah: 'https://www.google.com/maps/search/?api=1&query=Race+Course+Masjid+Mahalaxmi+Mumbai',
      walima: 'https://www.google.com/maps/search/?api=1&query=Bayview+Lawns+Princess+Dock+Mazgaon+Mumbai',
    },
    music: { src: 'assets/web/song.mp3', volume: 0.8, fadeIn: 1.5 },
    door: { w: 941, h: 1672, medallionX: 0.50, medallionY: 0.53, doorwayX: 0.4995, doorwayY: 0.5553 },
  };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.scrollTo(0, 0);

  const root = document.documentElement;
  const door = $('#door');
  const doorStage = $('.door-stage');
  const doorZoom = $('.door-zoom');
  const doorScene = $('.door-scene');
  const leafL = $('.leaf-l');
  const leafR = $('.leaf-r');
  const doorBg = $('.door-bg');
  let doorwayPt = { x: window.innerWidth / 2, y: window.innerHeight * 0.55 };
  const doorCta = $('.door-cta');
  const sparkCanvas = $('.door-sparkles');
  const flash = $('#flash');
  const filmInner = $('#film');
  const scenes = $$('.scene');
  const videos = scenes.map((s) => $('video', s));
  const progressBar = $('#progress');
  const progressFill = $('#progress span');
  const musicBtn = $('#music');
  const hint = $('.scroll-hint');

  /* ==========================================================
     LENIS — one long, naturally scrolling column of pages
     ========================================================== */
  let lenis = null;
  if (!reduced && window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop(); // locked until the door is opened
  }

  /* ==========================================================
     VIDEOS
     Every page plays from its first frame when you arrive on it,
     then loops. A page that is only peeking in waits on frame one.
     ========================================================== */
  const N = scenes.length;
  const vstate = videos.map((v, i) => ({ loaded: i === 0, visible: i === 0, current: false }));

  function ensureLoaded(i) {
    const v = videos[i];
    if (!v || vstate[i].loaded) return;
    vstate[i].loaded = true;
    v.autoplay = false; // we decide when it plays
    v.preload = 'auto';
    v.src = v.dataset.src;
    v.load();
  }
  function playVideo(i) {
    const v = videos[i];
    if (!vstate[i].loaded) ensureLoaded(i);
    if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); }
  }
  function pauseVideo(i) {
    const v = videos[i];
    if (!v.paused) v.pause();
  }
  function rewind(i) {
    const v = videos[i];
    if (!vstate[i].loaded) return;
    try { if (v.currentTime > 0) v.currentTime = 0; } catch (e) { /* not seekable yet */ }
  }
  function restartVideo(i) {
    if (!vstate[i].loaded) ensureLoaded(i);
    rewind(i);
    playVideo(i);
  }

  /* ==========================================================
     PAGE STATE (driven by scroll position)
     ========================================================== */
  const backdropLayers = $$('.backdrop > div');
  const ending = $('.ending');
  let pagesLive = false; // becomes true as the doors finish opening
  let currentPage = -1;

  function syncPages() {
    const vh = window.innerHeight;
    let best = 0, bestCover = -1;
    for (let i = 0; i < N; i++) {
      const s = scenes[i];
      const r = s.getBoundingClientRect();
      const visH = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      const vis = visH > 1;
      const cover = visH / Math.min(vh, r.height); // how much of it is on screen
      const current = cover >= 0.55;
      if (r.top < vh * 2.2) { // lazy-load as it approaches
        ensureLoaded(i);
        if (videos[i].preload !== 'auto') videos[i].preload = 'auto';
      }
      if (pagesLive) {
        const st = vstate[i];
        if (!vis) {
          if (st.visible) { pauseVideo(i); rewind(i); hideLines(i); } // gone: reset for next time
        } else if (current && !st.current) {
          if (videos[i].paused) { restartVideo(i); showLines(i); } // arrived: play from the start, text appears
        } else if (!current && !st.current && videos[i].paused) {
          rewind(i); // only peeking in: wait on the first frame
        }
        st.visible = vis;
        st.current = current;
      }
      s.classList.toggle('is-settled', current);
      if (cover > bestCover) { bestCover = cover; best = i; }
    }
    if (best !== currentPage) {
      currentPage = best;
      backdropLayers.forEach((b, i) => b.classList.toggle('on', i === best));
    }
    const max = document.documentElement.scrollHeight - vh;
    const prog = max > 0 ? Math.min(1, window.scrollY / max) : 0;
    progressFill.style.transform = `scaleY(${prog})`;
    scenes[N - 1].classList.toggle('is-end', prog > 0.97);
  }

  /* ---------- text lines: one after another, as each page arrives ---------- */
  const pageLines = scenes.map((s) => $$('.tl', s));
  function showLines(i) {
    const ls = pageLines[i].filter((el) => !(revealed && el.hasAttribute('data-scratch-line')));
    if (!ls.length) return;
    gsap.killTweensOf(ls);
    if (reduced) {
      gsap.to(ls, { opacity: 1, duration: 0.6, stagger: 0.15 });
      return;
    }
    gsap.fromTo(ls,
      { opacity: 0, y: 14, filter: 'blur(8px)' },
      { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.95, ease: 'power2.out', stagger: 0.3, delay: 0.25, clearProps: 'filter,transform' });
  }
  function hideLines(i) {
    gsap.killTweensOf(pageLines[i]);
    gsap.set(pageLines[i], { opacity: 0, clearProps: 'filter,transform' });
  }

  let syncQueued = false;
  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    requestAnimationFrame(() => { syncQueued = false; syncPages(); });
  }
  window.addEventListener('scroll', queueSync, { passive: true });

  /* ==========================================================
     DOOR — layout, sparkles, opening
     ========================================================== */
  let medallion = { x: 0, y: 0 };
  function layoutDoor() {
    if (!door.isConnected) return;
    const r = doorStage.getBoundingClientRect();
    const { w: dw, h: dh, medallionX, medallionY, doorwayX, doorwayY } = CONFIG.door;
    const s = Math.max(r.width / dw, r.height / dh);
    const iw = dw * s, ih = dh * s;
    const ox = (r.width - iw) / 2, oy = (r.height - ih) / 2;
    // the layered artwork, cover-fitted like object-fit: cover
    Object.assign(doorScene.style, { left: `${ox}px`, top: `${oy}px`, width: `${iw}px`, height: `${ih}px` });
    const mx = ox + iw * medallionX;
    const my = oy + ih * medallionY;
    medallion = { x: mx, y: my };
    doorCta.style.left = `${mx}px`;
    doorCta.style.top = `${my}px`;
    doorCta.style.setProperty('--ring', `${Math.round(iw * 0.15)}px`);
    const wx = ox + iw * doorwayX, wy = oy + ih * doorwayY;
    doorZoom.style.transformOrigin = `${wx}px ${wy}px`;
    doorwayPt = { x: r.left + wx, y: r.top + wy };
    flash.style.setProperty('--fx', `${r.left + wx}px`);
    flash.style.setProperty('--fy', `${r.top + wy}px`);
    sizeSparkles();
  }

  // --- drifting gold sparkles ---
  const sctx = sparkCanvas.getContext('2d');
  const sparks = [];
  let sW = 0, sH = 0, sDpr = 1, sparkRAF = 0;
  const sprite = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 32;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grd.addColorStop(0, 'rgba(255,250,225,1)');
    grd.addColorStop(0.25, 'rgba(245,230,168,.9)');
    grd.addColorStop(0.6, 'rgba(212,175,55,.35)');
    grd.addColorStop(1, 'rgba(212,175,55,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 32, 32);
    return c;
  })();
  function sizeSparkles() {
    const r = sparkCanvas.getBoundingClientRect();
    sDpr = Math.min(window.devicePixelRatio || 1, 2);
    sW = r.width; sH = r.height;
    sparkCanvas.width = Math.round(sW * sDpr);
    sparkCanvas.height = Math.round(sH * sDpr);
    if (!sparks.length) {
      const n = reduced ? 14 : 38;
      for (let i = 0; i < n; i++) sparks.push(newSpark(true));
    }
  }
  function newSpark(anywhere) {
    return {
      x: Math.random(),
      y: anywhere ? Math.random() : 1.05,
      r: 3 + Math.random() * 7,
      vy: 0.004 + Math.random() * 0.012, // fraction of height per second
      sway: 0.01 + Math.random() * 0.03,
      phase: Math.random() * Math.PI * 2,
      tw: 0.6 + Math.random() * 1.6,
    };
  }
  function renderSparkles(now) {
    const t = now / 1000;
    sctx.setTransform(sDpr, 0, 0, sDpr, 0, 0);
    sctx.clearRect(0, 0, sW, sH);
    for (const p of sparks) {
      if (!reduced) {
        p.y -= p.vy / 60;
        if (p.y < -0.05) Object.assign(p, newSpark(false));
      }
      const x = (p.x + Math.sin(t * 0.6 + p.phase) * p.sway) * sW;
      const y = p.y * sH;
      const a = reduced ? 0.55 : 0.25 + 0.75 * Math.abs(Math.sin(t * p.tw + p.phase));
      sctx.globalAlpha = a;
      sctx.drawImage(sprite, x - p.r, y - p.r, p.r * 2, p.r * 2);
    }
    sctx.globalAlpha = 1;
    if (!reduced) sparkRAF = requestAnimationFrame(renderSparkles);
  }

  layoutDoor();
  if (reduced) renderSparkles(0); else sparkRAF = requestAnimationFrame(renderSparkles);

  // iOS (notably Low Power Mode) only lets a video play if it was first
  // started from a tap. Start every video once inside the door tap, then
  // park it on frame one; from then on JS may play it whenever we like.
  function unlockVideos() {
    const all = videos.map((v, i) => [v, i]);
    all.forEach(([v, i]) => {
      if (i > 0 && !vstate[i].loaded) {
        vstate[i].loaded = true;
        v.autoplay = false;
        v.preload = 'metadata';
        v.src = v.dataset.src;
      }
      if (i === 0) return; // v2 is handled by the door sequence
      const p = v.play();
      if (p && p.then) {
        p.then(() => {
          const wanted = i > 0 && pagesLive && vstate[i].current;
          if (!wanted) { v.pause(); try { v.currentTime = 0; } catch (e) {} }
        }).catch(() => {});
      }
    });
  }

  // --- opening ---
  let opened = false;
  function openDoor() {
    if (opened) return;
    opened = true;
    door.setAttribute('aria-hidden', 'true');
    startMusic(); // inside the user gesture
    // v2 waits on its very first frame (which is also what the doorway shows)
    // and only starts once the doors are out of the way.
    const v2 = videos[0];
    const unlock = v2.play(); // gesture-initiated play keeps iOS low-power mode happy
    if (unlock && unlock.then) unlock.then(() => { if (!pagesLive) { v2.pause(); rewind(0); } }).catch(() => {});
    v2.pause();
    rewind(0);
    unlockVideos();
    const goLive = () => {
      pagesLive = true;
      vstate[0].current = false;
      syncPages();
      const tc = document.querySelector('meta[name="theme-color"]');
      if (tc) tc.setAttribute('content', '#0B1430');
      root.classList.add('is-inside');
    };

    const tlo = gsap.timeline({ onComplete: afterOpen });
    if (reduced) {
      tlo.add(goLive, 0.3).to(door, { autoAlpha: 0, duration: 0.9, ease: 'power1.inOut' }, 0);
      return;
    }
    // The real first page sits right behind the doors (held on frame one),
    // slightly enlarged around the doorway so it settles in as we step through.
    gsap.set(filmInner, { scale: 1.12, transformOrigin: `${doorwayPt.x}px ${doorwayPt.y}px` });
    tlo
      .to(doorCta, { autoAlpha: 0, scale: 1.25, duration: 0.4, ease: 'power2.out' }, 0)
      .to(sparkCanvas, { autoAlpha: 0, duration: 0.8 }, 0.2)
      .to(doorBg, { autoAlpha: 0, duration: 0.35, ease: 'power1.out' }, 0) // nothing between the doors and the page
      // 1. the doors swing open, away from us, onto the invitation itself
      .to(leafL, { rotationY: 82, duration: 1.4, ease: 'power2.inOut' }, 0.1)
      .to(leafR, { rotationY: -82, duration: 1.4, ease: 'power2.inOut' }, 0.1)
      .to('.leaf-shade', { opacity: 0.75, duration: 1.4, ease: 'power1.in' }, 0.1)
      // 2. we step through: the frame grows past the screen edges and fades away
      .to(doorZoom, { scale: 2.6, duration: 1.4, ease: 'power2.in' }, 0.95)
      .to(door, { autoAlpha: 0, duration: 0.6, ease: 'power1.in' }, 1.75)
      // 3. the page settles into place and starts from its first frame
      .to(filmInner, { scale: 1, duration: 1.9, ease: 'power2.out' }, 0.9)
      .add(goLive, 2.05);
  }
  function afterOpen() {
    cancelAnimationFrame(sparkRAF);
    door.remove();
    flash.style.display = 'none';
    gsap.set(filmInner, { clearProps: 'transform' });
    root.classList.remove('is-locked');
    if (lenis) lenis.start();
    syncPages();
    musicBtn.classList.add('is-shown');
    gsap.to(musicBtn, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'back.out(2)' });
    progressBar.style.opacity = '1';
  }
  door.addEventListener('click', openDoor);
  door.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDoor(); }
  });
  door.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  door.focus({ preventScroll: true });

  /* ==========================================================
     MUSIC — Web Audio gain (iOS ignores <audio>.volume)
     ========================================================== */
  const audio = new Audio(CONFIG.music.src);
  audio.loop = true;
  audio.preload = 'auto';
  // belt and braces: some mobile browsers drop `loop` after an interruption
  audio.addEventListener('ended', () => {
    if (!musicOn) return;
    audio.currentTime = 0;
    const p = audio.play();
    if (p && p.catch) p.catch(() => {});
  });
  let actx = null, gain = null, musicOn = false;

  function startMusic() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        actx = new AC();
        const src = actx.createMediaElementSource(audio);
        gain = actx.createGain();
        gain.gain.value = 0;
        src.connect(gain).connect(actx.destination);
        if (actx.state === 'suspended') actx.resume();
      }
    } catch (e) { gain = null; }
    if (!gain) audio.volume = 0;
    musicOn = true;
    setMusicUI(true);
    const p = audio.play();
    if (p && p.then) {
      p.then(() => fadeTo(CONFIG.music.volume, CONFIG.music.fadeIn))
        .catch(() => { musicOn = false; setMusicUI(false); });
    } else fadeTo(CONFIG.music.volume, CONFIG.music.fadeIn);
  }
  let fadeTimer = 0;
  function fadeTo(v, dur, done) {
    clearTimeout(fadeTimer);
    if (gain && actx) {
      const t = actx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(v, t + dur);
      if (done) fadeTimer = setTimeout(done, dur * 1000);
    } else {
      gsap.to(audio, { volume: v, duration: dur, ease: 'none', overwrite: true, onComplete: done });
    }
  }
  function setMusicUI(on) {
    musicBtn.classList.toggle('is-off', !on);
    musicBtn.setAttribute('aria-pressed', String(on));
    musicBtn.setAttribute('aria-label', on ? 'Pause music' : 'Play music');
  }
  musicBtn.addEventListener('click', () => {
    if (musicOn) {
      musicOn = false;
      setMusicUI(false);
      fadeTo(0, 0.6, () => { if (!musicOn) audio.pause(); });
    } else {
      musicOn = true;
      setMusicUI(true);
      if (actx && actx.state === 'suspended') actx.resume();
      const p = audio.play();
      if (p && p.catch) p.catch(() => { musicOn = false; setMusicUI(false); });
      fadeTo(CONFIG.music.volume, 1);
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (musicOn) audio.pause();
      videos.forEach((v) => v.pause());
    } else {
      if (musicOn) {
        if (actx && actx.state === 'suspended') actx.resume();
        audio.play().catch(() => {});
      }
      syncPages();
      vstate.forEach((st, i) => { if (pagesLive && st.current) playVideo(i); });
    }
  });

  const retryPlayback = () => {
    if (!pagesLive) return;
    vstate.forEach((st, i) => { if (st.current && videos[i].paused) playVideo(i); });
  };
  document.addEventListener('touchend', retryPlayback, { passive: true });
  document.addEventListener('click', retryPlayback);

  /* ==========================================================
     SCROLL HINT
     ========================================================== */
  function onFirstScroll() {
    if (window.scrollY > 8) {
      hint.classList.add('is-gone');
      window.removeEventListener('scroll', onFirstScroll);
    }
  }
  window.addEventListener('scroll', onFirstScroll, { passive: true });

  /* ==========================================================
     DATE REVEAL (v3) — scratch the velvet ribbon to reveal the date.
     The ribbon is drawn on a canvas; scratching erases it with a
     soft brush (gold sparkles follow your finger). Once about 45%
     is cleared, the rest dissolves in a burst of gold.
     ========================================================== */
  const scene3 = scenes[1];
  const scratchWrap = $('.scratch', scene3);
  const sc = $('.scratch-canvas', scene3);
  const sctx2 = sc.getContext('2d');
  const scratchHint = $('.scratch-hint', scene3);
  const burstBox = $('.foil-burst', scene3);
  const dateGlow = $('.date-glow', scene3);
  const countdown = $('.countdown', scene3);
  const scratchLine = $('.tl[data-scratch-line]', scene3); // the "Scratch to reveal the Date!" text
  let revealed = false;
  let rBase = null, rMask = null, rMctx = null, rW = 0, rH = 0, rDpr = 1;

  function buildRibbon() {
    const r = sc.getBoundingClientRect();
    if (!r.width || !r.height) return;
    rDpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(r.width * rDpr), h = Math.round(r.height * rDpr);
    const keepMask = rMask && rMask.width === w && rMask.height === h;
    rW = w; rH = h;
    sc.width = w; sc.height = h;

    rBase = document.createElement('canvas');
    rBase.width = w; rBase.height = h;
    const g = rBase.getContext('2d');
    // velvet
    const vg = g.createLinearGradient(0, 0, 0, h);
    vg.addColorStop(0, '#7A141D');
    vg.addColorStop(0.5, '#560B13');
    vg.addColorStop(1, '#34060B');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
    const sh = g.createLinearGradient(0, 0, 0, h);
    sh.addColorStop(0, 'rgba(255,225,225,.16)');
    sh.addColorStop(0.4, 'rgba(255,255,255,0)');
    sh.addColorStop(1, 'rgba(0,0,0,.25)');
    g.fillStyle = sh;
    g.fillRect(0, 0, w, h);
    // velvet nap
    g.globalAlpha = 0.05;
    g.strokeStyle = '#fff';
    g.lineWidth = Math.max(1, rDpr * 0.6);
    for (let x = -h; x < w; x += 4 * rDpr) { g.beginPath(); g.moveTo(x, h); g.lineTo(x + h * 0.6, 0); g.stroke(); }
    g.globalAlpha = 1;
    // gold borders: outer bands + inner hairlines
    const gold = g.createLinearGradient(0, 0, w, 0);
    gold.addColorStop(0, '#A87C22'); gold.addColorStop(0.25, '#E9CF7A'); gold.addColorStop(0.5, '#F5E6A8');
    gold.addColorStop(0.75, '#D4AF37'); gold.addColorStop(1, '#A87C22');
    const bw = Math.max(2, Math.round(2 * rDpr));
    g.fillStyle = gold;
    g.fillRect(0, 0, w, bw); g.fillRect(0, h - bw, w, bw);
    g.globalAlpha = 0.75;
    g.fillRect(0, Math.round(h * 0.15), w, Math.max(1, rDpr * 0.8));
    g.fillRect(0, Math.round(h * 0.85), w, Math.max(1, rDpr * 0.8));
    g.globalAlpha = 1;
    // label
    const fs = Math.round(h * 0.3);
    g.font = `600 ${fs}px Cinzel, "Times New Roman", serif`;
    if ('letterSpacing' in g) g.letterSpacing = `${Math.round(fs * 0.22)}px`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const label = '✦   Scratch to Reveal   ✦';
    const tw = g.measureText(label).width;
    const tg = g.createLinearGradient(w / 2 - tw / 2, 0, w / 2 + tw / 2, 0);
    tg.addColorStop(0, '#B8892A'); tg.addColorStop(0.3, '#F5E6A8'); tg.addColorStop(0.55, '#D4AF37');
    tg.addColorStop(0.8, '#F5E6A8'); tg.addColorStop(1, '#B8892A');
    g.fillStyle = 'rgba(20,2,6,.6)';
    g.fillText(label, w / 2, h / 2 + fs * 0.08 + rDpr);
    g.fillStyle = tg;
    g.fillText(label, w / 2, h / 2 + fs * 0.08);

    if (!keepMask) {
      rMask = document.createElement('canvas');
      rMask.width = w; rMask.height = h;
      rMctx = rMask.getContext('2d', { willReadFrequently: true });
      rMctx.fillStyle = '#000';
      rMctx.fillRect(0, 0, w, h);
    }
    renderRibbon(performance.now());
  }

  function renderRibbon(now) {
    if (!rBase) return;
    const w = rW, h = rH;
    sctx2.globalCompositeOperation = 'source-over';
    sctx2.clearRect(0, 0, w, h);
    sctx2.drawImage(rBase, 0, 0);
    // a soft sheen gliding across the velvet
    sctx2.globalCompositeOperation = 'source-atop';
    const p = reduced ? 0.5 : ((now % 4200) / 4200) * 1.8 - 0.4;
    const sx = p * w, sw = w * 0.2;
    const sg = sctx2.createLinearGradient(sx - sw, 0, sx + sw, h);
    sg.addColorStop(0, 'rgba(255,230,190,0)');
    sg.addColorStop(0.5, 'rgba(255,230,190,.22)');
    sg.addColorStop(1, 'rgba(255,230,190,0)');
    sctx2.fillStyle = sg;
    sctx2.fillRect(0, 0, w, h);
    sctx2.globalCompositeOperation = 'destination-in';
    sctx2.drawImage(rMask, 0, 0);
    sctx2.globalCompositeOperation = 'source-over';
  }

  gsap.ticker.add(() => {
    if (!rBase || revealed || !vstate[1].visible) return;
    renderRibbon(performance.now());
  });

  // pointer scratching
  let rDown = false, rLast = null, rMoved = 0, lastCheck = 0, lastSpark = 0;
  const rPoint = (e) => {
    const r = sc.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * rW, y: ((e.clientY - r.top) / r.height) * rH, cx: e.clientX - r.left, cy: e.clientY - r.top };
  };
  function scratchTo(a, b) {
    rMctx.globalCompositeOperation = 'destination-out';
    rMctx.lineCap = 'round';
    rMctx.lineJoin = 'round';
    rMctx.lineWidth = rH * 0.95;
    rMctx.beginPath();
    rMctx.moveTo(a.x, a.y);
    rMctx.lineTo(b.x, b.y);
    rMctx.stroke();
  }
  function clearedRatio() {
    const { data } = rMctx.getImageData(0, 0, rW, rH);
    let clear = 0, total = 0;
    for (let k = 3; k < data.length; k += 4 * 9) { total++; if (data[k] < 128) clear++; }
    return total ? clear / total : 0;
  }
  function sparkAt(x, y) {
    if (reduced) return;
    const el = document.createElement('i');
    burstBox.appendChild(el);
    const bb = burstBox.getBoundingClientRect(), sr = sc.getBoundingClientRect();
    const px = x + (sr.left - bb.left), py = y + (sr.top - bb.top);
    gsap.fromTo(el, { x: px, y: py, scale: 0.6 + Math.random(), opacity: 1 },
      { x: px + (Math.random() - 0.5) * 40, y: py - 10 - Math.random() * 26, scale: 0, opacity: 0,
        duration: 0.6 + Math.random() * 0.4, ease: 'power2.out', onComplete: () => el.remove() });
  }
  sc.addEventListener('pointerdown', (e) => {
    if (revealed) return;
    rDown = true; rMoved = 0;
    rLast = rPoint(e);
    try { sc.setPointerCapture(e.pointerId); } catch (_) {}
    scratchHint.classList.add('is-gone');
  });
  sc.addEventListener('pointermove', (e) => {
    if (!rDown || revealed) return;
    const p = rPoint(e);
    rMoved += Math.hypot(p.x - rLast.x, p.y - rLast.y) / rDpr;
    scratchTo(rLast, p);
    rLast = p;
    const now = performance.now();
    if (now - lastSpark > 35) { lastSpark = now; sparkAt(p.cx, p.cy); }
    if (now - lastCheck > 120) {
      lastCheck = now;
      if (clearedRatio() >= 0.45) reveal();
    }
  });
  const rEnd = () => {
    if (!rDown) return;
    rDown = false;
    if (revealed) return;
    if (rMoved < 6) {
      // a tap: nudge them to scratch
      scratchHint.classList.remove('is-gone');
      gsap.fromTo(sc, { x: -5 }, { x: 0, duration: 0.5, ease: 'elastic.out(1.2, 0.3)' });
    } else if (clearedRatio() >= 0.45) reveal();
  };
  sc.addEventListener('pointerup', rEnd);
  sc.addEventListener('pointercancel', () => { rDown = false; });
  sc.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(); }
  });

  function burst() {
    if (reduced) return;
    const r = burstBox.getBoundingClientRect();
    const frag = document.createDocumentFragment();
    const parts = [];
    for (let i = 0; i < 56; i++) {
      const el = document.createElement('i');
      frag.appendChild(el);
      parts.push(el);
    }
    burstBox.appendChild(frag);
    parts.forEach((el) => {
      const x0 = Math.random() * r.width;
      const y0 = r.height * (0.2 + Math.random() * 0.6);
      const ang = Math.random() * Math.PI * 2;
      const dist = 26 + Math.random() * r.width * 0.28;
      gsap.fromTo(el,
        { x: x0, y: y0, scale: 0.6 + Math.random() * 1.8, opacity: 1 },
        { x: x0 + Math.cos(ang) * dist, y: y0 + Math.sin(ang) * dist * 0.7 - 8, scale: 0, opacity: 0,
          duration: 0.9 + Math.random() * 0.7, ease: 'power2.out', onComplete: () => el.remove() });
    });
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    rDown = false;
    scene3.classList.add('revealed');
    scratchHint.classList.add('is-gone');
    sc.setAttribute('aria-label', 'Date revealed: 18 and 20 December 2026');
    // the "Scratch to reveal the Date!" line is no longer needed
    if (scratchLine) gsap.to(scratchLine, { opacity: 0, duration: 0.8, ease: 'power1.out', overwrite: true });
    const done = () => scratchWrap.classList.add('is-gone');
    const tlr = gsap.timeline();
    if (reduced) {
      tlr.to(sc, { autoAlpha: 0, duration: 0.6 }).add(done)
        .to(dateGlow, { opacity: 0.8, duration: 0.8 }, 0.2)
        .add(showCountdown, 0.5);
      return;
    }
    tlr
      .add(burst, 0)
      .to(sc, { scale: 1.06, autoAlpha: 0, duration: 0.7, ease: 'power2.out' }, 0)
      .add(done, 0.75)
      .fromTo(dateGlow, { opacity: 0 }, { opacity: 0.85, duration: 1.1, ease: 'power1.out' }, 0.2)
      .add(() => gsap.set(dateGlow, { clearProps: 'opacity' }), 1.4)
      .add(showCountdown, 0.6);
  }

  /* ==========================================================
     COUNTDOWN
     ========================================================== */
  const target = new Date(CONFIG.nikahAt).getTime();
  const cdNums = { d: $('[data-unit="d"]', countdown), h: $('[data-unit="h"]', countdown), m: $('[data-unit="m"]', countdown), s: $('[data-unit="s"]', countdown) };
  const cdPrev = { d: '', h: '', m: '', s: '' };
  let cdShown = false, cdTimer = 0;

  function setUnit(key, txt) {
    if (cdPrev[key] === txt) return;
    cdPrev[key] = txt;
    const el = cdNums[key];
    const spans = el.querySelectorAll('span');
    const old = spans[spans.length - 1];
    if (!cdShown || reduced || !vstate[1].visible) {
      spans.forEach((s, i) => { if (i < spans.length - 1) s.remove(); });
      old.textContent = txt;
      return;
    }
    const nu = document.createElement('span');
    nu.textContent = txt;
    el.appendChild(nu);
    gsap.fromTo(nu, { yPercent: 90, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.55, ease: 'power3.out' });
    gsap.to(old, { yPercent: -90, opacity: 0, duration: 0.55, ease: 'power3.out', onComplete: () => old.remove() });
  }
  const pad = (n) => String(n).padStart(2, '0');
  function tick() {
    const diff = target - Date.now();
    if (diff <= 0) {
      countdown.classList.add('is-done');
      clearInterval(cdTimer);
      return;
    }
    const s = Math.floor(diff / 1000);
    setUnit('d', pad(Math.floor(s / 86400)));
    setUnit('h', pad(Math.floor((s % 86400) / 3600)));
    setUnit('m', pad(Math.floor((s % 3600) / 60)));
    setUnit('s', pad(s % 60));
  }
  tick();
  cdTimer = setInterval(tick, 1000);

  function showCountdown() {
    gsap.to(countdown, {
      autoAlpha: 1, y: 0, duration: reduced ? 0.6 : 1.1, ease: 'power3.out',
      onComplete: () => { cdShown = true; },
    });
  }

  /* ==========================================================
     MAP BUTTONS
     ========================================================== */
  $$('.map-btn').forEach((btn) => {
    btn.href = CONFIG.maps[btn.dataset.map];
    btn.addEventListener('pointerdown', (e) => {
      const r = btn.getBoundingClientRect();
      const rip = document.createElement('span');
      rip.className = 'ripple';
      rip.style.left = `${e.clientX - r.left}px`;
      rip.style.top = `${e.clientY - r.top}px`;
      btn.appendChild(rip);
      setTimeout(() => rip.remove(), 700);
    });
  });

  /* ==========================================================
     REPLAY
     ========================================================== */
  $('.replay').addEventListener('click', () => {
    if (lenis) lenis.scrollTo(0, { duration: 3.2, easing: (t) => 1 - Math.pow(1 - t, 3) });
    else window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
  });

  /* ==========================================================
     RESIZE
     ========================================================== */
  let rzT = 0;
  window.addEventListener('resize', () => {
    clearTimeout(rzT);
    rzT = setTimeout(() => {
      layoutDoor();
      buildRibbon();
      syncPages();
    }, 120);
  });

  // build the foil once fonts are ready (Cinzel on the canvas)
  const fontsReady = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load('700 20px Cinzel'), document.fonts.ready]).catch(() => {})
    : Promise.resolve();
  buildRibbon();
  fontsReady.then(() => { buildRibbon(); layoutDoor(); });

  syncPages();

  // expose for debugging
  window.__invite = {
    lenis, reveal, CONFIG, audio,
    get gain() { return gain ? gain.gain.value : audio.volume; },
  };
})();
