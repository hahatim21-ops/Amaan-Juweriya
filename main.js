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
  const doorLight = $('.doorway-light');
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
      if (r.top < vh * 2.2) ensureLoaded(i); // lazy-load as it approaches
      if (pagesLive) {
        const st = vstate[i];
        if (!vis) {
          if (st.visible) { pauseVideo(i); rewind(i); } // gone: reset for next time
        } else if (current && !st.current) {
          if (videos[i].paused) restartVideo(i); // arrived: play from the start
          if (i === 1) preloadClean();
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
    ensureLoaded(1);
    const goLive = () => { pagesLive = true; vstate[0].current = false; syncPages(); };

    const tlo = gsap.timeline({ onComplete: afterOpen });
    if (reduced) {
      tlo.add(goLive, 0.3).to(door, { autoAlpha: 0, duration: 0.9, ease: 'power1.inOut' }, 0);
      return;
    }
    gsap.set(filmInner, { scale: 1.15, transformOrigin: '50% 50%' });
    tlo
      .to(doorCta, { autoAlpha: 0, scale: 1.25, duration: 0.4, ease: 'power2.out' }, 0)
      .to(sparkCanvas, { autoAlpha: 0, duration: 0.8 }, 0.2)
      // 1. the doors swing open, away from us, light pours through
      .to(leafL, { rotationY: 82, duration: 1.5, ease: 'power2.inOut' }, 0.15)
      .to(leafR, { rotationY: -82, duration: 1.5, ease: 'power2.inOut' }, 0.15)
      .to('.leaf-shade', { opacity: 0.75, duration: 1.5, ease: 'power1.in' }, 0.15)
      .to(doorLight, { opacity: 1, duration: 1.2, ease: 'power1.inOut' }, 0.3)
      // 2. we glide through the doorway
      .to(doorZoom, { scale: 5.5, duration: 1.6, ease: 'power3.in' }, 1.05)
      // 3. gold-white bloom, then cross-fade into v2 settling 1.15 → 1
      .to(flash, { opacity: 1, duration: 0.45, ease: 'power1.in' }, 2.15)
      .add(goLive, 2.5) // v2 starts from frame one just as the bloom peaks
      .set(door, { autoAlpha: 0 }, 2.62)
      .to(flash, { opacity: 0, duration: 0.9, ease: 'power1.out' }, 2.64)
      .to(filmInner, { scale: 1, duration: 1.8, ease: 'power3.out' }, 2.35);
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
     DATE FOIL — tap or scratch to reveal (v3)
     ========================================================== */
  const scene3 = scenes[1];
  const foilWrap = $('.foil', scene3);
  const fc = $('.foil-canvas', scene3);
  const fctx = fc.getContext('2d');
  const burstBox = $('.foil-burst', scene3);
  const dateGlow = $('.date-glow', scene3);
  const countdown = $('.countdown', scene3);
  let foilBase = null, foilMask = null, mctx = null, fW = 0, fH = 0, fDpr = 1;
  let revealed = false;
  const shim = { v: 0 };

  function buildFoil() {
    const r = fc.getBoundingClientRect();
    if (!r.width || !r.height) return;
    fDpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(r.width * fDpr), h = Math.round(r.height * fDpr);
    const keepMask = foilMask && foilMask.width === w && foilMask.height === h;
    fW = w; fH = h;
    fc.width = w; fc.height = h;

    // ---- base foil ----
    foilBase = document.createElement('canvas');
    foilBase.width = w; foilBase.height = h;
    const g = foilBase.getContext('2d');
    const vg = g.createLinearGradient(0, 0, 0, h);
    vg.addColorStop(0, '#8A6619');
    vg.addColorStop(0.16, '#D4AF37');
    vg.addColorStop(0.4, '#F7E9B0');
    vg.addColorStop(0.55, '#E8CF73');
    vg.addColorStop(0.82, '#B98B29');
    vg.addColorStop(1, '#7A5A14');
    g.fillStyle = vg;
    g.fillRect(0, 0, w, h);
    // horizontal brushed variation
    const hg = g.createLinearGradient(0, 0, w, 0);
    hg.addColorStop(0, 'rgba(91,14,20,.18)');
    hg.addColorStop(0.3, 'rgba(255,250,220,.12)');
    hg.addColorStop(0.5, 'rgba(91,14,20,.06)');
    hg.addColorStop(0.72, 'rgba(255,250,220,.16)');
    hg.addColorStop(1, 'rgba(91,14,20,.18)');
    g.fillStyle = hg;
    g.fillRect(0, 0, w, h);
    // embossed grain
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const k = (y * w + x) * 4;
        const n = (Math.random() - 0.5) * 22 + Math.sin((x + y) * 0.9) * 4;
        d[k] += n; d[k + 1] += n; d[k + 2] += n * 0.7;
      }
    }
    g.putImageData(img, 0, 0);
    // bevel edges
    const lw = Math.max(1, fDpr);
    g.fillStyle = 'rgba(255,248,215,.75)'; g.fillRect(0, lw * 2, w, lw);
    g.fillStyle = 'rgba(91,14,20,.45)'; g.fillRect(0, h - lw * 3, w, lw);
    g.fillStyle = 'rgba(60,8,14,.35)'; g.fillRect(0, 0, w, lw); g.fillRect(0, h - lw, w, lw);
    // label
    const fs = Math.round(h * 0.34);
    g.font = `700 ${fs}px Cinzel, "Times New Roman", serif`;
    if ('letterSpacing' in g) g.letterSpacing = `${Math.round(fs * 0.16)}px`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const label = '✦  Tap to Reveal  ✦';
    const cx = w / 2, cy = h / 2 + fs * 0.04;
    g.fillStyle = 'rgba(255,250,225,.75)';
    g.fillText(label, cx + lw * 0.5, cy + lw * 1.2); // highlight (emboss)
    g.fillStyle = 'rgba(40,5,9,.35)';
    g.fillText(label, cx - lw * 0.5, cy - lw * 0.8); // shade
    g.fillStyle = '#5B0E14';
    g.fillText(label, cx, cy);

    // ---- scratch mask ----
    if (!keepMask) {
      foilMask = document.createElement('canvas');
      foilMask.width = w; foilMask.height = h;
      mctx = foilMask.getContext('2d', { willReadFrequently: true });
      mctx.fillStyle = '#000';
      mctx.fillRect(0, 0, w, h);
    }
    renderFoil(performance.now());
  }

  function renderFoil(now) {
    if (!foilBase) return;
    const w = fW, h = fH;
    fctx.globalCompositeOperation = 'source-over';
    fctx.globalAlpha = 1;
    fctx.clearRect(0, 0, w, h);
    fctx.drawImage(foilBase, 0, 0);
    // moving sheen
    fctx.globalCompositeOperation = 'source-atop';
    const period = 3200;
    const p = reduced ? 0.5 : ((now % period) / period) * 1.8 - 0.4;
    const sx = p * w, sw = w * 0.22;
    const sg = fctx.createLinearGradient(sx - sw, 0, sx + sw, h * 0.6);
    sg.addColorStop(0, 'rgba(255,255,240,0)');
    sg.addColorStop(0.5, 'rgba(255,255,240,.55)');
    sg.addColorStop(1, 'rgba(255,255,240,0)');
    fctx.fillStyle = sg;
    fctx.fillRect(0, 0, w, h);
    // reveal shimmer: bright fast sweep + glow
    if (shim.v > 0) {
      const qx = shim.v * w * 1.4 - w * 0.2;
      const qg = fctx.createLinearGradient(qx - w * 0.3, 0, qx + w * 0.3, 0);
      qg.addColorStop(0, 'rgba(255,255,245,0)');
      qg.addColorStop(0.5, 'rgba(255,255,245,.9)');
      qg.addColorStop(1, 'rgba(255,255,245,0)');
      fctx.fillStyle = qg;
      fctx.fillRect(0, 0, w, h);
      fctx.fillStyle = `rgba(255,248,220,${0.3 * shim.v})`;
      fctx.fillRect(0, 0, w, h);
    }
    // apply scratch mask
    fctx.globalCompositeOperation = 'destination-in';
    fctx.drawImage(foilMask, 0, 0);
    fctx.globalCompositeOperation = 'source-over';
  }

  gsap.ticker.add(() => {
    if (!foilBase || foilWrap.classList.contains('is-gone')) return;
    if (!vstate[1].visible) return;
    renderFoil(performance.now());
  });

  // pointer: tap → reveal, drag → scratch
  let fDown = false, fMoved = 0, fLast = null, scratching = false, lastCheck = 0;
  const brush = () => Math.max(18, fH * 0.42);
  function fPoint(e) {
    const r = fc.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * fW, y: ((e.clientY - r.top) / r.height) * fH };
  }
  function scratchLine(a, b) {
    mctx.globalCompositeOperation = 'destination-out';
    mctx.lineCap = 'round';
    mctx.lineJoin = 'round';
    mctx.lineWidth = brush();
    mctx.beginPath();
    mctx.moveTo(a.x, a.y);
    mctx.lineTo(b.x, b.y);
    mctx.stroke();
  }
  function clearedRatio() {
    const { data } = mctx.getImageData(0, 0, fW, fH);
    let clear = 0, total = 0;
    for (let k = 3; k < data.length; k += 4 * 8) { total++; if (data[k] < 128) clear++; }
    return total ? clear / total : 0;
  }
  fc.addEventListener('pointerdown', (e) => {
    if (revealed) return;
    fDown = true; fMoved = 0; scratching = false;
    fLast = fPoint(e);
    try { fc.setPointerCapture(e.pointerId); } catch (_) {}
  });
  fc.addEventListener('pointermove', (e) => {
    if (!fDown || revealed) return;
    const p = fPoint(e);
    const dist = Math.hypot(p.x - fLast.x, p.y - fLast.y) / fDpr;
    fMoved += dist;
    if (fMoved > 8) {
      scratching = true;
      scratchLine(fLast, p);
      const now = performance.now();
      if (now - lastCheck > 120) {
        lastCheck = now;
        if (clearedRatio() >= 0.5) reveal();
      }
    }
    fLast = p;
  });
  const endPointer = () => {
    if (!fDown) return;
    fDown = false;
    if (revealed) return;
    if (!scratching) reveal();
    else if (clearedRatio() >= 0.5) reveal();
  };
  fc.addEventListener('pointerup', endPointer);
  fc.addEventListener('pointercancel', () => { fDown = false; });
  fc.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reveal(); }
  });

  function burst() {
    if (reduced) return;
    const r = burstBox.getBoundingClientRect();
    const n = 54;
    const frag = document.createDocumentFragment();
    const parts = [];
    for (let i = 0; i < n; i++) {
      const el = document.createElement('i');
      frag.appendChild(el);
      parts.push(el);
    }
    burstBox.appendChild(frag);
    parts.forEach((el) => {
      const x0 = Math.random() * r.width;
      const y0 = r.height * (0.2 + Math.random() * 0.6);
      const ang = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * r.width * 0.32;
      const size = 0.6 + Math.random() * 1.8;
      gsap.fromTo(el,
        { x: x0, y: y0, scale: size, opacity: 1 },
        {
          x: x0 + Math.cos(ang) * dist,
          y: y0 + Math.sin(ang) * dist * 0.75 - 10,
          scale: 0,
          opacity: 0,
          duration: 0.9 + Math.random() * 0.7,
          ease: 'power2.out',
          onComplete: () => el.remove(),
        });
    });
  }

  // After the reveal, v3 is swapped for an identical copy without the
  // "Scratch to reveal the Date!" line, so it never comes back on loop.
  const cleanVid = $('.vid-clean', scene3);
  let cleanSwapped = false;
  function preloadClean() {
    if (cleanVid.src) return;
    cleanVid.preload = 'auto';
    cleanVid.src = cleanVid.dataset.src;
    cleanVid.load();
  }
  function swapToClean() {
    if (cleanSwapped) return;
    cleanSwapped = true;
    preloadClean();
    const orig = videos[1];
    const go = () => {
      const p = cleanVid.play();
      const fade = () => {
        gsap.to(cleanVid, {
          autoAlpha: 1, duration: 0.6, ease: 'power1.inOut',
          onComplete: () => {
            orig.pause();
            orig.style.visibility = 'hidden';
            videos[1] = cleanVid; // playback, backdrop & veil now follow the clean copy
          },
        });
      };
      if (p && p.then) p.then(fade).catch(fade); else fade();
    };
    const sync = () => {
      try { cleanVid.currentTime = (orig.currentTime + 0.05) % (cleanVid.duration || 10); } catch (e) {}
      if (cleanVid.seeking) cleanVid.addEventListener('seeked', go, { once: true }); else go();
    };
    if (cleanVid.readyState >= 1) sync();
    else cleanVid.addEventListener('loadedmetadata', sync, { once: true });
  }

  function reveal() {
    if (revealed) return;
    revealed = true;
    fDown = false;
    scene3.classList.add('revealed');
    swapToClean();
    fc.setAttribute('aria-label', 'Date revealed: 18 and 20 December 2026');
    const tlr = gsap.timeline();
    if (reduced) {
      tlr.to(fc, { autoAlpha: 0, duration: 0.6 })
        .add(() => foilWrap.classList.add('is-gone'))
        .to(dateGlow, { opacity: 0.8, duration: 0.8 }, 0.2)
        .add(showCountdown, 0.5);
      return;
    }
    tlr
      .to(shim, { v: 1, duration: 0.42, ease: 'power2.in' })
      .add(burst, 0.38)
      .to(fc, { scale: 1.08, autoAlpha: 0, duration: 0.6, ease: 'power2.out' }, 0.4)
      .add(() => foilWrap.classList.add('is-gone'), 1.0)
      .fromTo(dateGlow, { opacity: 0 }, { opacity: 0.85, duration: 1.1, ease: 'power1.out' }, 0.55)
      .add(() => gsap.set(dateGlow, { clearProps: 'opacity' }), 1.7)
      .add(showCountdown, 0.9);
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
      syncPages();
      buildFoil();
    }, 120);
  });

  // build the foil once fonts are ready (Cinzel on the canvas)
  const fontsReady = document.fonts && document.fonts.load
    ? Promise.all([document.fonts.load('700 20px Cinzel'), document.fonts.ready]).catch(() => {})
    : Promise.resolve();
  buildFoil();
  fontsReady.then(() => { buildFoil(); layoutDoor(); });

  syncPages();

  // expose for debugging
  window.__invite = {
    lenis, reveal, CONFIG, audio,
    get gain() { return gain ? gain.gain.value : audio.volume; },
  };
})();
