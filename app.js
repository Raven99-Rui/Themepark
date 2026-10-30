(() => {
  'use strict';

  /* ========================================================================
     Setup
     ======================================================================== */

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(window.location.search);
  const FAST = params.get('fast') === '1';
  if (FAST) document.documentElement.classList.add('is-fast');

  const el = {
    body: document.body,
    themeColor: $('#themeColor'),
    veil: $('#veil'),
    flashLayer: $('#flashLayer'),
    toast: $('#toast'),
    soundToggle: $('#soundToggle'),

    screens: {
      exterior: $('#screenExterior'),
      interior: $('#screenInterior'),
      print: $('#screenPrint'),
      result: $('#screenResult')
    },

    boothStage: $('#boothStage'),
    boothSvg: $('#boothSvg'),
    curtainLeft: $('#curtainLeft'),
    curtainRight: $('#curtainRight'),
    curtainHit: $('#curtainHit'),
    curtainPull: $('#curtainPull'),
    footOpenBtn: $('#footOpenBtn'),

    backToBooth: $('#backToBooth'),
    cameraStatus: $('#cameraStatus'),
    cameraStatusText: $('#cameraStatusText'),
    embedBanner: $('#embedBanner'),
    embedBannerText: $('#embedBannerText'),
    openInNewTabBtn: $('#openInNewTabBtn'),
    errorOpenTabBtn: $('#errorOpenTabBtn'),
    video: $('#cameraVideo'),
    demoImage: $('#demoImage'),
    freezeFrame: $('#freezeFrame'),
    viewerIdle: $('#viewerIdle'),
    viewerNative: $('#viewerNative'),
    viewerLoading: $('#viewerLoading'),
    viewerError: $('#viewerError'),
    cameraErrorCopy: $('#cameraErrorCopy'),
    liveBadge: $('#liveBadge'),
    shotCounter: $('#shotCounter'),
    flipCameraBtn: $('#flipCameraBtn'),
    frameCount: $('#frameCount'),
    openCameraBtn: $('#openCameraBtn'),
    demoBtn: $('#demoBtn'),
    retryCameraBtn: $('#retryCameraBtn'),
    nativeCameraBtn: $('#nativeCameraBtn'),
    errorDemoBtn: $('#errorDemoBtn'),
    backToLiveCamera: $('#backToLiveCamera'),
    thumbRail: $('#thumbRail'),

    countdown: $('#countdown'),
    countdownNumber: $('#countdownNumber'),
    countdownShot: $('#countdownShot'),
    countdownCaption: $('.countdown-caption'),
    ringProgress: $('#ringProgress'),
    freeze: $('#freezeFrame'),
    viewerFlash: $('#viewerFlash'),

    coinModule: $('#coinModule'),
    coinButton: $('#coinButton'),
    coinStatus: $('#coinStatus'),
    creditDisplay: $('#creditDisplay'),
    startBtn: $('#startBtn'),
    startHint: $('#startHint'),
    panelLede: $('#panelLede'),
    sessionSpec: $('.session-spec'),

    developingOverlay: $('#developingOverlay'),
    developBar: $('#developBar'),
    developStatus: $('#developStatus'),
    nativeShotOverlay: $('#nativeShotOverlay'),
    nativeShotIndex: $('#nativeShotIndex'),
    nativeShootBtn: $('#nativeShootBtn'),
    nativeCancelBtn: $('#nativeCancelBtn'),
    nativeCaptureInput: $('#nativeCaptureInput'),

    screenPrint: $('#screenPrint'),
    printEyebrow: $('#printEyebrow'),
    printTitle: $('#printTitle'),
    printSub: $('#printSub'),
    printPaper: $('#printPaper'),
    printStripImg: $('#printStripImg'),
    machineCaption: $('#machineCaption'),
    collectBtn: $('#collectBtn'),

    screenResult: $('#screenResult'),
    stripPreview: $('#stripPreview'),
    nameInput: $('#nameInput'),
    dateInput: $('#dateInput'),
    messageInput: $('#messageInput'),
    nameCount: $('#nameCount'),
    messageCount: $('#messageCount'),
    saveBtn: $('#saveBtn'),
    inlineSaveBtn: $('#inlineSaveBtn'),
    retakeBtn: $('#retakeBtn'),
    printForm: $('#printForm'),

    saveSheet: $('#saveSheet'),
    saveSheetImage: $('#saveSheetImage'),
    saveSheetClose: $('#saveSheetClose'),
    saveSheetCloseBtn: $('#saveSheetCloseBtn')
  };

  const state = {
    screen: 'exterior',
    busy: false,
    soundOn: true,
    curtainOpen: false,
    curtainProgress: 0,
    credit: 0,
    cameraState: 'off',
    mode: 'idle', // idle | camera | demo | native
    facing: 'user',
    stream: null,
    cameraRequest: 0,
    sessionActive: false,
    sessionAbort: false,
    finishing: false,
    photos: [],
    printDataUrl: '',
    lastMode: 'camera',
    demoCache: null,
    toastTimer: 0,
    audioUnlocked: false,
    nativeResolve: null,
    nativeReject: null,
    nativeFocusHandler: null,
    nativeCancelHandler: null,
    nativeChangeHandler: null,
    nativeShootHandler: null
  };

  const T = FAST ? 0.16 : 1; // accelerated only when ?fast=1 is used for testing
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, Math.max(0, ms)));
  const isWeChat = /MicroMessenger/i.test(navigator.userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isEmbedded = (() => {
    try { return window.self !== window.top; } catch (error) { return true; }
  })();
  const isFileMode = location.protocol === 'file:';

  const SOUND_KEY = 'paper-photobooth-sound';

  /* ========================================================================
     Sound design — everything is synthesised, so the booth works offline.
     ======================================================================== */

  const AudioEngine = {
    ctx: null,
    master: null,
    noiseBuffer: null,
    muted: false,

    init() {
      if (this.ctx) return this.ctx;
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      try {
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.52;
        this.master.connect(this.ctx.destination);
        this.noiseBuffer = this.createNoiseBuffer(2.2);
      } catch (error) {
        this.ctx = null;
      }
      return this.ctx;
    },

    createNoiseBuffer(seconds) {
      const length = Math.floor(this.ctx.sampleRate * seconds);
      const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
      return buffer;
    },

    resume() {
      this.init();
      if (!this.ctx) return Promise.resolve();
      if (this.ctx.state === 'suspended') return this.ctx.resume().catch(() => {});
      return Promise.resolve();
    },

    setMuted(muted) {
      this.muted = muted;
      if (!this.ctx || !this.master) return;
      const now = this.ctx.currentTime;
      this.master.gain.cancelScheduledValues(now);
      this.master.gain.setTargetAtTime(muted ? 0 : 0.52, now, 0.02);
    },

    tone(freq, options = {}) {
      if (!this.ctx || this.muted) return;
      const {
        duration = 0.12,
        endFreq = null,
        type = 'sine',
        gain = 0.12,
        delay = 0,
        attack = 0.008
      } = options;
      const ctx = this.ctx;
      const start = ctx.currentTime + delay;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(Math.max(1, freq), start);
      if (endFreq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + duration);
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(gain, start + attack);
      env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(env).connect(this.master);
      osc.start(start);
      osc.stop(start + duration + 0.03);
    },

    noise(options = {}) {
      if (!this.ctx || this.muted || !this.noiseBuffer) return;
      const {
        duration = 0.12,
        gain = 0.12,
        type = 'bandpass',
        freq = 2200,
        endFreq = null,
        q = 0.9,
        delay = 0,
        attack = 0.004
      } = options;
      const ctx = this.ctx;
      const start = ctx.currentTime + delay;
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const env = ctx.createGain();
      src.buffer = this.noiseBuffer;
      src.loop = true;
      filter.type = type;
      filter.frequency.setValueAtTime(freq, start);
      if (endFreq) filter.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), start + duration);
      filter.Q.value = q;
      env.gain.setValueAtTime(0.0001, start);
      env.gain.linearRampToValueAtTime(gain, start + attack);
      env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      src.connect(filter).connect(env).connect(this.master);
      src.start(start);
      src.stop(start + duration + 0.03);
    },

    tick(final = false) {
      this.tone(final ? 1046.5 : 783.99, { duration: final ? 0.12 : 0.07, gain: final ? 0.09 : 0.055, type: 'sine' });
      this.tone((final ? 2093 : 1567.98), { duration: 0.035, gain: 0.018, delay: 0.005, type: 'triangle' });
    },

    shutter() {
      this.noise({ duration: 0.035, gain: 0.32, type: 'highpass', freq: 2800, q: 0.5 });
      this.tone(150, { duration: 0.11, endFreq: 62, gain: 0.22, type: 'sine' });
      this.noise({ duration: 0.028, gain: 0.18, type: 'bandpass', freq: 1800, delay: 0.06, q: 0.8 });
      this.tone(4200, { duration: 0.24, endFreq: 6800, gain: 0.017, type: 'sine', delay: 0.08 });
    },

    coin() {
      [2093, 2637, 3520].forEach((freq, index) => {
        this.tone(freq, {
          duration: 0.16 - index * 0.025,
          gain: 0.055 - index * 0.012,
          type: 'sine',
          delay: index * 0.025
        });
      });
      this.tone(880, { duration: 0.18, endFreq: 1320, gain: 0.035, type: 'triangle' });
      this.noise({ duration: 0.045, gain: 0.07, type: 'bandpass', freq: 4600, delay: 0.01, q: 1.4 });
    },

    curtain() {
      this.noise({ duration: 0.55, gain: 0.075, type: 'bandpass', freq: 900, endFreq: 350, q: 0.7, attack: 0.05 });
      this.noise({ duration: 0.22, gain: 0.03, type: 'lowpass', freq: 280, delay: 0.16 });
    },

    chime() {
      [523.25, 659.25, 783.99].forEach((freq, index) => {
        this.tone(freq, { duration: 0.55, gain: 0.038, type: 'sine', delay: index * 0.09, attack: 0.015 });
      });
    },

    printMotor() {
      this.tone(48, { duration: 2.9, endFreq: 43, gain: 0.055, type: 'sawtooth', attack: 0.1 });
      this.tone(96, { duration: 2.9, endFreq: 88, gain: 0.018, type: 'triangle', attack: 0.1 });
      this.noise({ duration: 2.9, gain: 0.025, type: 'lowpass', freq: 340, endFreq: 230, attack: 0.16 });
    },

    error() {
      this.tone(196, { duration: 0.2, gain: 0.06, type: 'triangle' });
      this.tone(147, { duration: 0.25, gain: 0.05, type: 'triangle', delay: 0.16 });
    }
  };

  function unlockAudio() {
    if (state.audioUnlocked) return;
    state.audioUnlocked = true;
    AudioEngine.resume();
  }

  function play(name) {
    if (!state.soundOn) return;
    try {
      AudioEngine.resume().then(() => {
        if (AudioEngine[name]) AudioEngine[name]();
      });
    } catch (error) {
      /* audio is a garnish, never a blocker */
    }
  }

  /* ========================================================================
     Utilities
     ======================================================================== */

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function todayISO() {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  }

  function displayDate(value) {
    if (!value) return '—';
    const parts = String(value).split('-');
    if (parts.length === 3) return `${parts[0]}.${parts[1]}.${parts[2]}`;
    return value;
  }

  function safeStorageGet(key) {
    try { return localStorage.getItem(key); } catch (error) { return null; }
  }

  function safeStorageSet(key, value) {
    try { localStorage.setItem(key, value); } catch (error) { /* private mode */ }
  }

  function showToast(message, duration = 2800) {
    if (!el.toast) return;
    window.clearTimeout(state.toastTimer);
    el.toast.textContent = message;
    el.toast.classList.add('is-visible');
    state.toastTimer = window.setTimeout(() => el.toast.classList.remove('is-visible'), duration);
  }

  function setSoundUI() {
    el.soundToggle.setAttribute('aria-pressed', String(state.soundOn));
    el.soundToggle.setAttribute('aria-label', state.soundOn ? '關閉音效' : '開啟音效');
    const label = $('.sound-label', el.soundToggle);
    if (label) label.textContent = state.soundOn ? 'SOUND ON' : 'SOUND OFF';
    AudioEngine.setMuted(!state.soundOn);
  }

  function setCameraStatus(status, text) {
    state.cameraState = status;
    el.cameraStatus.dataset.state = status;
    el.cameraStatusText.textContent = text;
  }

  function setCameraStatusByMode() {
    if (state.mode === 'demo') {
      el.cameraStatus.dataset.state = 'demo';
      el.cameraStatusText.textContent = '紙偶試拍';
      state.cameraState = 'ready';
    } else if (state.mode === 'native') {
      el.cameraStatus.dataset.state = 'ready';
      el.cameraStatusText.textContent = '系統相機';
      state.cameraState = 'ready';
    } else if (state.mode === 'camera' && state.stream) {
      el.cameraStatus.dataset.state = 'ready';
      el.cameraStatusText.textContent = '相機已就緒';
      state.cameraState = 'ready';
    } else {
      el.cameraStatus.dataset.state = 'off';
      el.cameraStatusText.textContent = '相機未開啟';
      state.cameraState = 'off';
    }
  }

  function canStart() {
    const sourceReady = (state.mode === 'camera' && state.stream && state.cameraState === 'ready')
      || (state.mode === 'demo' && state.cameraState === 'ready')
      || (state.mode === 'native' && state.cameraState === 'ready');
    return !state.sessionActive && !state.busy && state.credit > 0 && sourceReady;
  }

  function updatePanelLede() {
    if (!el.panelLede) return;
    if (state.sessionActive) {
      el.panelLede.innerHTML = '四格銀鹽，正在曝光。<br>望住鏡頭，不必急。';
    } else if (state.mode === 'demo') {
      el.panelLede.innerHTML = state.credit > 0
        ? '紙偶已坐定。<br>硬幣已投入，按下開始。'
        : '紙偶已坐定。<br>投一枚紀念幣，開始試拍。';
    } else if (state.mode === 'native') {
      el.panelLede.innerHTML = state.credit > 0
        ? '系統相機會接手。<br>硬幣已投入，按下開始。'
        : '系統相機會接手。<br>每次快門，拍下一格。';
    } else if (state.mode === 'camera' && state.cameraState === 'ready' && state.stream) {
      el.panelLede.innerHTML = state.credit > 0
        ? '相機已就緒。<br>硬幣已投入，坐定，準備四連拍。'
        : '相機已就緒。<br>投幣，坐定，準備四連拍。';
    } else if (state.cameraState === 'error') {
      el.panelLede.innerHTML = '鏡頭沒有亮起。<br>仍可用系統相機，或試玩紙偶。';
    } else {
      el.panelLede.innerHTML = '由你按下按鈕，才會開啟相機。<br>四格銀鹽，留住此刻。';
    }
  }

  function setSessionSpec(mode) {
    if (!el.sessionSpec) return;
    const spans = el.sessionSpec.querySelectorAll('span');
    if (spans.length < 3) return;
    if (mode === 'native') {
      spans[0].innerHTML = '<i aria-hidden="true">◎</i>系統快門';
      spans[2].innerHTML = '<i aria-hidden="true">✦</i>相機補光';
    } else {
      spans[0].innerHTML = '<i aria-hidden="true">3″</i>每 3 秒一張';
      spans[2].innerHTML = '<i aria-hidden="true">✦</i>自動補光';
    }
  }

  function updateStartState() {
    updatePanelLede();
    const sourceReady = (state.mode === 'camera' && !!state.stream && state.cameraState === 'ready')
      || (state.mode === 'demo' && state.cameraState === 'ready')
      || (state.mode === 'native' && state.cameraState === 'ready');

    el.startBtn.disabled = !canStart();
    el.startBtn.setAttribute('aria-disabled', String(!canStart()));

    if (state.sessionActive) {
      el.startHint.textContent = '拍攝中，請望住鏡頭。';
      el.startHint.classList.remove('is-alert');
      return;
    }

    if (!sourceReady) {
      if (state.cameraState === 'error') {
        el.startHint.textContent = '鏡頭尚未就緒，可重試、用系統相機，或紙偶試拍。';
      } else if (state.cameraState === 'loading') {
        el.startHint.textContent = '正在打開鏡頭，請允許相機權限。';
      } else {
        el.startHint.textContent = '請先開啟相機，並投入一枚硬幣。';
      }
      el.startHint.classList.remove('is-alert');
      return;
    }

    if (state.credit < 1) {
      el.startHint.textContent = '相機已就緒，請投入一枚硬幣。';
      el.startHint.classList.remove('is-alert');
      return;
    }

    el.startHint.textContent = '一切就緒。按下開始，第一聲倒數便會響起。';
    el.startHint.classList.remove('is-alert');
  }

  function nudgeStartHint(message) {
    el.startHint.textContent = message;
    el.startHint.classList.remove('is-alert');
    void el.startHint.offsetWidth;
    el.startHint.classList.add('is-alert');
    window.setTimeout(() => el.startHint.classList.remove('is-alert'), 420);
  }

  function resetThumbs() {
    $$('.thumb', el.thumbRail).forEach((thumb) => {
      thumb.classList.remove('has-photo', 'is-fresh');
      const img = $('img', thumb);
      img.hidden = true;
      img.removeAttribute('src');
    });
    el.frameCount.textContent = '0 / 4';
  }

  function markThumb(index, url) {
    const thumb = $(`.thumb[data-index="${index}"]`, el.thumbRail);
    if (!thumb) return;
    const img = $('img', thumb);
    img.src = url;
    img.hidden = false;
    thumb.classList.add('has-photo', 'is-fresh');
    el.frameCount.textContent = `${index + 1} / 4`;
    window.setTimeout(() => thumb.classList.remove('is-fresh'), 700);
  }

  function updateCounter(input, counter, max) {
    if (!counter) return;
    counter.textContent = `${input.value.length} / ${max}`;
  }

  function setShotCounter(number) {
    el.shotCounter.innerHTML = `${pad2(number)} <small>/ 04</small>`;
    el.countdownShot.textContent = String(number);
  }

  function fireFlash() {
    const flash = el.flashLayer;
    const viewerFlash = el.viewerFlash;
    flash.classList.remove('is-flashing');
    viewerFlash.classList.remove('is-flashing');
    void flash.offsetWidth;
    flash.classList.add('is-flashing');
    viewerFlash.classList.add('is-flashing');
    window.setTimeout(() => {
      flash.classList.remove('is-flashing');
      viewerFlash.classList.remove('is-flashing');
    }, 700);
  }

  function vibrate(pattern) {
    if (!navigator.vibrate) return;
    try { navigator.vibrate(pattern); } catch (error) { /* ignore */ }
  }

  /* ========================================================================
     Screen flow
     ======================================================================== */

  function focusScreen(name) {
    const screen = el.screens[name];
    if (!screen) return;
    const heading = screen.querySelector('h1, h2');
    if (!heading) return;
    heading.setAttribute('tabindex', '-1');
    try { heading.focus({ preventScroll: true }); } catch (error) { /* ignore */ }
  }

  async function goToScreen(name, { dark = false, focus = true } = {}) {
    if (state.busy || state.screen === name) return false;
    state.busy = true;
    el.veil.classList.toggle('is-dark', dark);
    el.veil.classList.add('is-on');
    await wait(reducedMotion ? 30 : 430);

    Object.entries(el.screens).forEach(([key, screen]) => {
      screen.hidden = key !== name;
    });
    state.screen = name;
    el.body.dataset.screen = name;
    if (el.themeColor) {
      el.themeColor.setAttribute('content', name === 'interior' ? '#0f2f25' : '#f0e6d1');
    }
    window.scrollTo(0, 0);
    await new Promise(requestAnimationFrame);
    el.veil.classList.remove('is-on');
    await wait(reducedMotion ? 30 : 470);

    state.busy = false;
    if (focus) window.setTimeout(() => focusScreen(name), 30);
    return true;
  }

  /* ========================================================================
     Curtain
     ======================================================================== */

  function applyCurtainProgress(progress) {
    const p = clamp(progress, 0, 1);
    state.curtainProgress = p;
    if (el.curtainLeft) {
      el.curtainLeft.setAttribute(
        'transform',
        `translate(${8 * p} 0) translate(220 0) scale(${1 - 0.66 * p} 1) translate(-220 0)`
      );
    }
    if (el.curtainRight) {
      el.curtainRight.setAttribute(
        'transform',
        `translate(${-8 * p} 0) translate(540 0) scale(${1 - 0.66 * p} 1) translate(-540 0)`
      );
    }
  }

  function setCurtainOpenUI(open) {
    state.curtainOpen = open;
    el.boothStage.classList.toggle('is-open', open);
    el.curtainPull.setAttribute('aria-expanded', String(open));
  }

  function resetCurtain() {
    applyCurtainProgress(0);
    setCurtainOpenUI(false);
    el.curtainPull.classList.remove('is-opening');
  }

  async function openCurtain(instant = false) {
    if (state.curtainOpen || state.busy) return;
    setCurtainOpenUI(true);
    el.curtainPull.classList.add('is-opening');
    if (!instant && state.soundOn) play('curtain');
    const start = state.curtainProgress;
    const duration = instant || reducedMotion ? 1 : 760;
    const started = performance.now();

    await new Promise((resolve) => {
      const step = (now) => {
        const t = clamp((now - started) / duration, 0, 1);
        applyCurtainProgress(start + (1 - start) * easeOutCubic(t));
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          resolve();
        }
      };
      requestAnimationFrame(step);
    });

    el.curtainPull.classList.remove('is-opening');
    // A short beat to let the open curtain and the lit room read, then step in.
    await wait(reducedMotion ? 80 : 300);
    if (state.screen === 'exterior' && !state.busy) {
      await enterBooth();
    }
  }

  function bindCurtainDrag() {
    let drag = null;

    const finish = (event) => {
      if (!drag) return;
      const { pointerId, startX, startY, moved, width } = drag;
      drag = null;
      try { el.curtainHit.releasePointerCapture(pointerId); } catch (error) { /* ignore */ }
      el.curtainHit.style.cursor = 'grab';
      if (state.curtainOpen) return;

      const progress = state.curtainProgress;
      const horizontal = Math.abs(event.clientX - startX) > Math.abs(event.clientY - startY);
      if (moved < 8 || (horizontal && progress > 0.26)) {
        openCurtain();
      } else {
        animateCurtainBack();
      }
    };

    el.curtainHit.addEventListener('pointerdown', (event) => {
      if (state.curtainOpen || state.busy) return;
      unlockAudio();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        width: el.curtainHit.getBoundingClientRect().width,
        moved: 0
      };
      try { el.curtainHit.setPointerCapture(event.pointerId); } catch (error) { /* ignore */ }
      el.curtainHit.style.cursor = 'grabbing';
      state.curtainProgress = 0;
    });

    el.curtainHit.addEventListener('pointermove', (event) => {
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = Math.abs(event.clientX - drag.startX);
      const dy = Math.abs(event.clientY - drag.startY);
      drag.moved = Math.max(drag.moved, Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY));
      if (dx < dy * 0.9) return;
      const progress = clamp(dx / Math.max(90, drag.width * 0.58), 0, 1);
      applyCurtainProgress(progress);
    });

    el.curtainHit.addEventListener('pointerup', finish);
    el.curtainHit.addEventListener('pointercancel', finish);

    let raf = 0;
    function animateCurtainBack() {
      const start = state.curtainProgress;
      if (start <= 0.01) {
        applyCurtainProgress(0);
        return;
      }
      const started = performance.now();
      const duration = reducedMotion ? 1 : 320;
      cancelAnimationFrame(raf);
      const step = (now) => {
        const t = clamp((now - started) / duration, 0, 1);
        applyCurtainProgress(start * (1 - easeOutCubic(t)));
        if (t < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }
  }

  /* ========================================================================
     Camera
     ======================================================================== */

  function cameraErrorMessage(error) {
    if (isFileMode) {
      return '你正以檔案方式開啟，即時相機需要 localhost 或 HTTPS。請用本機伺服器或部署後的網址開啟。';
    }
    if (isEmbedded) {
      return '頁面目前嵌在預覽框中，瀏覽器會封鎖相機。請先按「在新分頁開啟」，再開啟相機。';
    }
    if (!window.isSecureContext) {
      return '即時相機需要 HTTPS 或 localhost。你仍可使用系統相機完成四連拍。';
    }
    const name = error && error.name ? error.name : '';
    if (name === 'NotAllowedError' || name === 'SecurityError') {
      return '相機權限未開啟。請點網址列左側的相機／鎖頭圖示，允許相機後重新載入，再試一次。';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return '找不到可用的相機。你可以改用系統相機，或試玩紙偶。';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return '相機正被其他應用程式使用。請關閉其他相機程式，再試一次。';
    }
    if (name === 'OverconstrainedError') {
      return '這個鏡頭未能配合。再試一次，或改用系統相機。';
    }
    return '未能開啟相機。請再試一次，或使用系統相機。';
  }

  function cameraOpenUrl() {
    return isFileMode ? 'http://127.0.0.1:8765/' : location.href;
  }

  function openCameraInNewTab() {
    const url = cameraOpenUrl();
    let opened = null;
    try {
      opened = window.open(url, '_blank');
      if (opened) opened.opener = null;
    } catch (error) {
      opened = null;
    }
    if (!opened) {
      showToast('瀏覽器阻擋了新分頁，請手動開啟：' + url, 5000);
    }
  }

  function updateCameraEnvironment() {
    if (!isEmbedded && !isFileMode) return;
    if (!el.embedBanner) return;
    el.embedBanner.hidden = false;
    if (el.embedBannerText) {
      el.embedBannerText.textContent = isFileMode
        ? '目前以檔案方式開啟，瀏覽器會封鎖相機。請用本機 localhost 或部署後的 HTTPS 網址。'
        : '目前頁面嵌在預覽框中，瀏覽器可能會封鎖相機。';
    }
    if (el.openInNewTabBtn) {
      el.openInNewTabBtn.innerHTML = isFileMode
        ? '開啟本機預覽 <span aria-hidden="true">↗</span>'
        : '在新分頁開啟 <span aria-hidden="true">↗</span>';
    }
  }

  function showCameraError(error) {
    let message = cameraErrorMessage(error);
    el.cameraErrorCopy.textContent = message;
    if (el.errorOpenTabBtn) {
      el.errorOpenTabBtn.hidden = !(isEmbedded || isFileMode);
      el.errorOpenTabBtn.textContent = isFileMode ? '開啟本機預覽' : '在新分頁開啟';
    }
    if ((isEmbedded || isFileMode) && el.embedBanner) {
      el.embedBanner.hidden = false;
    }
    el.viewerIdle.hidden = true;
    el.viewerLoading.hidden = true;
    el.viewerNative.hidden = true;
    el.viewerError.hidden = false;
    el.video.hidden = true;
    el.demoImage.hidden = true;
    el.liveBadge.hidden = true;
    el.shotCounter.hidden = true;
    el.flipCameraBtn.hidden = true;
    setCameraStatus('error', '相機未能開啟');
    updateStartState();
    if (state.soundOn) play('error');
  }

  function stopCamera() {
    state.cameraRequest += 1;
    if (state.stream) {
      state.stream.getTracks().forEach((track) => {
        try { track.stop(); } catch (error) { /* ignore */ }
      });
    }
    state.stream = null;
    if (el.video) {
      try { el.video.pause(); } catch (error) { /* ignore */ }
      el.video.srcObject = null;
      el.video.hidden = true;
    }
  }

  async function updateFlipVisibility() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      el.flipCameraBtn.hidden = true;
      return;
    }
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      el.flipCameraBtn.hidden = cameras.length < 2;
    } catch (error) {
      el.flipCameraBtn.hidden = true;
    }
  }

  async function getMediaStream() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw Object.assign(new Error('getUserMedia unavailable'), { name: 'NotSupportedError' });
    }
    const desired = {
      audio: false,
      video: {
        facingMode: { ideal: state.facing },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      }
    };
    try {
      return await navigator.mediaDevices.getUserMedia(desired);
    } catch (error) {
      if (error && (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError')) {
        return await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }
      throw error;
    }
  }

  function waitForVideoMetadata(video, timeout = 5000) {
    if (video.readyState >= 1 && video.videoWidth > 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = window.setTimeout(() => {
        if (done) return;
        done = true;
        cleanup();
        reject(Object.assign(new Error('video metadata timeout'), { name: 'TimeoutError' }));
      }, timeout);
      const ready = () => {
        if (done) return;
        done = true;
        cleanup();
        resolve();
      };
      const cleanup = () => {
        window.clearTimeout(timer);
        video.removeEventListener('loadedmetadata', ready);
        video.removeEventListener('canplay', ready);
      };
      video.addEventListener('loadedmetadata', ready, { once: true });
      video.addEventListener('canplay', ready, { once: true });
    });
  }

  async function openCamera({ quiet = false } = {}) {
    if (state.sessionActive) return;
    // The interior fades in after the curtain; if someone taps during that
    // last half-second, wait for the transition instead of swallowing the tap.
    let waits = 0;
    while (state.busy && waits < 10) {
      await wait(120);
      waits += 1;
    }
    if (state.sessionActive || state.screen !== 'interior') return;
    unlockAudio();
    state.mode = 'camera';
    state.cameraRequest += 1;
    const requestId = state.cameraRequest;

    el.viewerIdle.hidden = true;
    el.viewerNative.hidden = true;
    el.viewerError.hidden = true;
    el.viewerLoading.hidden = false;
    el.demoImage.hidden = true;
    el.freezeFrame.hidden = true;
    el.freezeFrame.classList.remove('is-visible');
    el.liveBadge.hidden = true;
    el.shotCounter.hidden = true;
    el.video.hidden = true;
    setCameraStatus('loading', '正在開啟相機');
    updateStartState();

    stopCamera();
    state.cameraRequest = requestId;

    try {
      const stream = await getMediaStream();
      if (requestId !== state.cameraRequest) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      state.stream = stream;
      el.video.srcObject = stream;
      el.video.hidden = false;
      el.video.classList.toggle('no-mirror', state.facing !== 'user');
      try { await el.video.play(); } catch (error) { /* iOS may already autoplay */ }
      await waitForVideoMetadata(el.video);

      el.viewerLoading.hidden = true;
      el.viewerError.hidden = true;
      el.viewerIdle.hidden = true;
      if (el.embedBanner) el.embedBanner.hidden = true;
      el.liveBadge.hidden = false;
      el.shotCounter.hidden = false;
      el.video.hidden = false;
      setCameraStatus('ready', '相機已就緒');
      state.mode = 'camera';
      setSessionSpec('camera');
      updateStartState();
      updateFlipVisibility();
      if (!quiet) play('chime');
      if (el.body.dataset.screen === 'interior' && !quiet) {
        el.shotCounter.innerHTML = `01 <small>/ 04</small>`;
      }
    } catch (error) {
      if (requestId !== state.cameraRequest) return;
      stopCamera();
      state.mode = 'idle';
      showCameraError(error);
      if (error && error.name === 'NotSupportedError') {
        el.cameraErrorCopy.textContent = window.isSecureContext
          ? '這個瀏覽器沒有提供即時相機。請改用系統相機，或試玩紙偶。'
          : '即時相機需要 HTTPS 或 localhost。請改用系統相機，或試玩紙偶。';
      }
    }
  }

  function enableNativeMode({ quiet = false } = {}) {
    stopCamera();
    state.mode = 'native';
    state.cameraState = 'ready';
    el.viewerIdle.hidden = true;
    el.viewerError.hidden = true;
    el.viewerLoading.hidden = true;
    el.viewerNative.hidden = false;
    el.video.hidden = true;
    el.demoImage.hidden = true;
    el.freezeFrame.hidden = true;
    el.liveBadge.hidden = true;
    el.shotCounter.hidden = false;
    el.shotCounter.innerHTML = `01 <small>/ 04</small>`;
    el.flipCameraBtn.hidden = true;
    setCameraStatusByMode();
    setSessionSpec('native');
    updateStartState();
    if (!quiet) {
      play('chime');
      showToast('已改用系統相機。', 2200);
    }
  }

  function enableDemoMode({ quiet = false } = {}) {
    stopCamera();
    const demo = ensureDemoPhotos();
    state.mode = 'demo';
    state.cameraState = 'ready';
    el.viewerIdle.hidden = true;
    el.viewerError.hidden = true;
    el.viewerLoading.hidden = true;
    el.viewerNative.hidden = true;
    el.video.hidden = true;
    el.demoImage.hidden = false;
    el.demoImage.src = demo[0].url;
    el.freezeFrame.hidden = true;
    el.liveBadge.hidden = true;
    el.shotCounter.hidden = false;
    el.shotCounter.innerHTML = `01 <small>/ 04</small>`;
    el.flipCameraBtn.hidden = true;
    setCameraStatusByMode();
    setSessionSpec('demo');
    if (state.credit < 1) {
      insertCoin({ fromDemo: true });
    } else {
      updateStartState();
    }
    if (!quiet) {
      play('chime');
      showToast('紙偶已坐定，硬幣已投入。', 2200);
    }
  }

  async function flipCamera() {
    if (state.sessionActive || state.mode !== 'camera') return;
    state.facing = state.facing === 'user' ? 'environment' : 'user';
    await openCamera({ quiet: true });
    if (state.mode === 'camera' && state.stream) {
      showToast(state.facing === 'user' ? '已切換至前置鏡頭。' : '已切換至後置鏡頭。', 1800);
    }
  }

  async function setTorch(on) {
    if (!state.stream) return;
    const track = state.stream.getVideoTracks()[0];
    if (!track || !track.getCapabilities) return;
    try {
      const caps = track.getCapabilities();
      if (!caps.torch) return;
      await track.applyConstraints({ advanced: [{ torch: !!on }] });
    } catch (error) {
      /* screen flash still works */
    }
  }

  /* ========================================================================
     Capturing
     ======================================================================== */

  function createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function drawCover(ctx, source, sw, sh, targetW, targetH) {
    const sourceRatio = sw / sh;
    const targetRatio = targetW / targetH;
    let cropW;
    let cropH;
    if (sourceRatio > targetRatio) {
      cropH = sh;
      cropW = sh * targetRatio;
    } else {
      cropW = sw;
      cropH = sw / targetRatio;
    }
    const sx = (sw - cropW) / 2;
    const sy = (sh - cropH) / 2;
    ctx.drawImage(source, sx, sy, cropW, cropH, 0, 0, targetW, targetH);
  }

  function captureVideoFrame() {
    if (!state.stream || !el.video.videoWidth) {
      throw Object.assign(new Error('No camera frame available'), { name: 'NoFrameError' });
    }
    const canvas = createCanvas(960, 720);
    const ctx = canvas.getContext('2d');
    const vw = el.video.videoWidth;
    const vh = el.video.videoHeight;
    const sourceRatio = vw / vh;
    const targetRatio = 4 / 3;
    let cropW;
    let cropH;
    if (sourceRatio > targetRatio) {
      cropH = vh;
      cropW = vh * targetRatio;
    } else {
      cropW = vw;
      cropH = vw / targetRatio;
    }
    const sx = (vw - cropW) / 2;
    const sy = (vh - cropH) / 2;

    ctx.save();
    if (state.facing === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(el.video, sx, sy, cropW, cropH, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    return canvas;
  }

  function drawNativeImage(img) {
    const canvas = createCanvas(960, 720);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    drawCover(ctx, img, img.naturalWidth || img.width, img.naturalHeight || img.height, canvas.width, canvas.height);
    return canvas;
  }

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('image decode failed'));
      };
      image.src = objectUrl;
    });
  }

  function processFrame(sourceCanvas) {
    const width = 720;
    const height = 540;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(sourceCanvas, 0, 0, width, height);

    try {
      const image = ctx.getImageData(0, 0, width, height);
      const data = image.data;
      const cx = width / 2;
      const cy = height * 0.47;
      const maxRadius = Math.hypot(cx, height * 0.6);

      for (let y = 0; y < height; y += 1) {
        const ny = (y - cy) / maxRadius;
        for (let x = 0; x < width; x += 1) {
          const index = (y * width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];

          let l = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
          // A soft silver-gelatin S-curve: lifted blacks, creamy highlights.
          l = l * 0.82 + (l * l * (3 - 2 * l)) * 0.18;
          l = (l - 0.015) / 0.965;
          l = clamp(l, 0, 1);
          l = Math.pow(l, 0.94);

          let value = l * 255;
          // Subtle split tone: cool shadows, warm highlight.
          const highlight = Math.max(0, l - 0.58);
          const shadow = Math.max(0, 0.42 - l);
          let rr = value * (1 + highlight * 0.12) - shadow * 2;
          let gg = value + shadow * 0.4;
          let bb = value * (1 - highlight * 0.06) + shadow * 3.2;

          // silver grain — stronger in the midtones
          const grainAmount = 2.6 + (1 - Math.abs(l - 0.5) * 2) * 4.6;
          const noise = (Math.random() * 2 - 1) * grainAmount;
          rr += noise * 1.02;
          gg += noise * 0.95;
          bb += noise * 0.82;

          // optical vignette
          const nx = (x - cx) / maxRadius;
          const radius = Math.sqrt(nx * nx + ny * ny);
          const vignette = 1 - Math.pow(clamp(radius, 0, 1.15), 2.1) * 0.28;
          rr *= vignette;
          gg *= vignette;
          bb *= vignette;

          data[index] = clamp(rr, 0, 255);
          data[index + 1] = clamp(gg, 0, 255);
          data[index + 2] = clamp(bb, 0, 255);
          data[index + 3] = 255;
        }
      }
      ctx.putImageData(image, 0, 0);
    } catch (error) {
      // If a browser blocks canvas reads, keep the monochrome CSS look.
      ctx.filter = 'grayscale(1) contrast(1.16) brightness(1.02)';
      ctx.drawImage(sourceCanvas, 0, 0, width, height);
      ctx.filter = 'none';
    }

    // A little halation around a warm highlight.
    const bloom = ctx.createRadialGradient(width * 0.5, height * 0.34, 0, width * 0.5, height * 0.34, width * 0.64);
    bloom.addColorStop(0, 'rgba(255, 250, 235, .09)');
    bloom.addColorStop(0.45, 'rgba(255, 246, 226, .025)');
    bloom.addColorStop(1, 'rgba(255, 246, 226, 0)');
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = bloom;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    // Dust, tiny hairs and one or two scratches.
    ctx.save();
    for (let i = 0; i < 28; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const radius = Math.random() * 1.5 + 0.25;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = Math.random() > 0.54
        ? `rgba(255, 249, 232, ${Math.random() * 0.13 + 0.03})`
        : `rgba(15, 16, 13, ${Math.random() * 0.1 + 0.03})`;
      ctx.fill();
    }
    for (let i = 0; i < 2; i += 1) {
      const x = Math.random() * width;
      const y = Math.random() * height * 0.8;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.bezierCurveTo(x + 8, y + 18, x - 7, y + 46, x + 3, y + 88);
      ctx.strokeStyle = `rgba(255, 250, 235, ${Math.random() * 0.07 + 0.02})`;
      ctx.lineWidth = Math.random() * 0.7 + 0.35;
      ctx.stroke();
    }
    ctx.restore();

    return canvas;
  }

  function storePhoto(canvas, index) {
    const url = canvas.toDataURL('image/jpeg', 0.92);
    state.photos[index] = { canvas, url };
    markThumb(index, url);

    el.freezeFrame.src = url;
    el.freezeFrame.hidden = false;
    el.freezeFrame.classList.add('is-visible');
    if (state.mode === 'demo') {
      el.demoImage.src = url;
      el.demoImage.hidden = false;
    }
    setShotCounter(index + 1);
  }

  async function takeCameraShot(index) {
    await setTorch(true);
    await wait(Math.max(80, 190 * T));
    fireFlash();
    // Let the screen's fill light actually reach the face before the frame
    // is grabbed. The video element itself is never covered by the overlay.
    await wait(95);
    if (state.soundOn) play('shutter');
    vibrate([18, 36, 24]);
    const raw = captureVideoFrame();
    const processed = processFrame(raw);
    storePhoto(processed, index);
    window.setTimeout(() => setTorch(false), Math.max(100, 350 * T));
  }

  async function takeDemoShot(index) {
    fireFlash();
    if (state.soundOn) play('shutter');
    vibrate([18, 36, 24]);
    const demo = ensureDemoPhotos();
    const processed = demo[index].canvas;
    storePhoto(processed, index);
  }

  async function takeNativeShot(index, file) {
    const image = await loadImageFromFile(file);
    const raw = drawNativeImage(image);
    fireFlash();
    if (state.soundOn) play('shutter');
    vibrate([18, 36, 24]);
    const processed = processFrame(raw);
    storePhoto(processed, index);
  }

  /* ========================================================================
     Session
     ======================================================================== */

  function setCreditUI(value) {
    state.credit = value;
    if (value > 0) {
      el.coinModule.classList.add('is-credited');
      el.coinButton.classList.remove('is-used');
      el.coinStatus.textContent = '已投幣 · CREDIT 01';
      el.creditDisplay.textContent = '01';
      const label = $('.coin-label', el.coinModule);
      if (label) label.textContent = '硬幣已投入';
    } else {
      el.coinModule.classList.remove('is-credited');
      el.coinButton.classList.remove('is-used');
      el.coinStatus.textContent = '未投幣 · NO CREDIT';
      el.creditDisplay.textContent = '00';
      const label = $('.coin-label', el.coinModule);
      if (label) label.textContent = '投入硬幣';
    }
    updateStartState();
  }

  function insertCoin({ fromDemo = false } = {}) {
    if (state.sessionActive || state.credit > 0) return;
    state.credit = 1;
    unlockAudio();
    el.coinButton.classList.add('is-dropping');
    if (state.soundOn) play('coin');
    vibrate(12);
    el.coinModule.classList.add('is-credited');
    el.coinStatus.textContent = '已投幣 · CREDIT 01';
    el.creditDisplay.textContent = '01';
    const label = $('.coin-label', el.coinModule);
    if (label) label.textContent = '硬幣已投入';
    window.setTimeout(() => el.coinButton.classList.remove('is-dropping'), 780);
    window.setTimeout(() => {
      el.coinButton.classList.add('is-used');
      el.coinButton.classList.remove('is-dropping');
    }, 760);
    updateStartState();
    if (!fromDemo) showToast('鏘。一枚硬幣，換四格光陰。', 2200);
  }

  function consumeCredit() {
    state.credit = 0;
    el.creditDisplay.textContent = '00';
    el.coinStatus.textContent = '拍攝中 · IN SESSION';
    el.coinModule.classList.remove('is-credited');
    el.coinButton.classList.add('is-used');
    const label = $('.coin-label', el.coinModule);
    if (label) label.textContent = '拍攝中';
  }

  function setSessionControls(active) {
    state.sessionActive = active;
    el.backToBooth.disabled = active;
    el.coinButton.disabled = active;
    el.openCameraBtn.disabled = active;
    el.demoBtn.disabled = active;
    el.flipCameraBtn.disabled = active;
    if (active) {
      el.backToBooth.style.opacity = '.35';
      el.backToBooth.style.pointerEvents = 'none';
    } else {
      el.backToBooth.style.opacity = '';
      el.backToBooth.style.pointerEvents = '';
    }
    updateStartState();
  }

  function prepareForShooting() {
    resetThumbs();
    state.photos = [];
    el.freezeFrame.hidden = true;
    el.freezeFrame.classList.remove('is-visible');
    el.countdown.hidden = true;
    el.shotCounter.hidden = false;
    el.shotCounter.innerHTML = `01 <small>/ 04</small>`;
    el.liveBadge.hidden = state.mode !== 'camera';
    el.viewerIdle.hidden = true;
    el.viewerError.hidden = true;
    el.viewerNative.hidden = state.mode !== 'native';
    el.startBtn.disabled = true;
  }

  async function runCountdown(index) {
    el.freezeFrame.classList.remove('is-visible');
    el.freezeFrame.hidden = true;
    el.countdown.hidden = false;
    el.countdown.classList.remove('is-running');
    el.countdownNumber.textContent = '3';
    el.countdownCaption.innerHTML = `第 <b id="countdownShot">${index + 1}</b> 張 <i>·</i> SMILE`;
    setShotCounter(index + 1);
    void el.countdown.offsetWidth;
    el.countdown.classList.add('is-running');

    for (let n = 3; n >= 1; n -= 1) {
      el.countdownNumber.textContent = String(n);
      el.countdownNumber.style.animation = 'none';
      void el.countdownNumber.offsetWidth;
      el.countdownNumber.style.animation = '';
      if (state.soundOn) play(n === 1 ? 'tick' : 'tick');
      vibrate(n === 1 ? [8, 24, 8] : 6);
      await wait(1000 * T);
    }

    el.countdownNumber.textContent = '';
    el.countdownCaption.innerHTML = 'CHEESE <i>·</i> 保持微笑';
    await wait(150 * T);
  }

  async function runCameraSession() {
    for (let index = 0; index < 4; index += 1) {
      if (state.sessionAbort) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      await runCountdown(index);
      if (state.sessionAbort) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      el.countdown.hidden = true;
      await takeCameraShot(index);
      await wait(960 * T);
    }
  }

  async function runDemoSession() {
    for (let index = 0; index < 4; index += 1) {
      if (state.sessionAbort) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      await runCountdown(index);
      if (state.sessionAbort) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      el.countdown.hidden = true;
      await takeDemoShot(index);
      await wait(960 * T);
    }
  }

  async function runNativeSession() {
    for (let index = 0; index < 4; index += 1) {
      if (state.sessionAbort) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      setShotCounter(index + 1);
      const file = await requestNativeFile(index);
      if (state.sessionAbort) throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      await takeNativeShot(index, file);
      await wait(1050 * T);
    }
  }

  async function startSession() {
    if (!canStart()) {
      if (state.credit < 1) nudgeStartHint('先投入一枚硬幣，拍照亭才會亮起。');
      else if (!state.cameraState || state.cameraState === 'off') nudgeStartHint('先開啟相機，讓光線進來。');
      else nudgeStartHint('拍攝亭尚未準備好，請稍等。');
      return;
    }

    unlockAudio();
    setSessionControls(true);
    prepareForShooting();
    consumeCredit();
    if (state.soundOn) play('chime');
    state.sessionAbort = false;
    state.lastMode = state.mode;
    el.startHint.textContent = '拍攝中，請望住鏡頭。';
    el.startHint.classList.remove('is-alert');

    try {
      if (state.mode === 'demo') {
        await runDemoSession();
      } else if (state.mode === 'native') {
        await runNativeSession();
      } else {
        await runCameraSession();
      }
      await wait(420 * T);
      await finishSession();
    } catch (error) {
      if (error && error.name === 'AbortError') {
        abortSession();
      } else {
        failSession(error);
      }
    }
  }

  async function finishSession() {
    if (state.photos.filter(Boolean).length < 4) {
      throw Object.assign(new Error('missing frames'), { name: 'IncompleteSessionError' });
    }
    state.finishing = true;
    state.sessionActive = false;
    setSessionControls(false);
    setCreditUI(0);
    el.countdown.hidden = true;
    el.freezeFrame.hidden = true;
    el.freezeFrame.classList.remove('is-visible');
    el.liveBadge.hidden = true;
    el.shotCounter.hidden = true;
    el.startBtn.disabled = true;
    el.startHint.textContent = '四格已拍好，正在沖印。';
    stopCamera();
    setCameraStatus('off', '相機已關閉');

    el.developingOverlay.hidden = false;
    el.developBar.style.width = '0%';
    el.developStatus.textContent = '顯影 · DEVELOPING';
    await wait(180 * T);
    el.developBar.style.width = '44%';
    await wait(850 * T);
    el.developStatus.textContent = '定影 · FIXING';
    el.developBar.style.width = '72%';
    await wait(850 * T);
    el.developStatus.textContent = '水洗與風乾 · DRYING';
    el.developBar.style.width = '100%';
    await wait(920 * T);
    el.developingOverlay.hidden = true;
    await enterPrintScreen();
  }

  function abortSession() {
    state.sessionAbort = true;
    state.sessionActive = false;
    state.finishing = false;
    setSessionControls(false);
    setCreditUI(0);
    state.photos = [];
    resetThumbs();
    hideNativeModal();
    el.countdown.hidden = true;
    el.developingOverlay.hidden = true;
    el.nativeShotOverlay.hidden = true;
    el.freezeFrame.classList.remove('is-visible');
    el.freezeFrame.hidden = true;
    stopCamera();
    setCameraStatusByMode();
    updateStartState();
    showToast('這次拍攝已結束。準備好時，再投一枚硬幣。', 3200);
  }

  function failSession(error) {
    state.sessionActive = false;
    state.finishing = false;
    setSessionControls(false);
    state.photos = [];
    resetThumbs();
    hideNativeModal();
    el.countdown.hidden = true;
    el.developingOverlay.hidden = true;
    el.freezeFrame.classList.remove('is-visible');
    el.freezeFrame.hidden = true;
    stopCamera();
    if (error && error.name === 'NoFrameError') {
      showCameraError(error);
      showToast('相機畫面中斷了，請重新開啟鏡頭。', 3600);
    } else {
      setCameraStatus('error', '拍攝中斷');
      showCameraError(error || new Error('session failed'));
      showToast('拍攝中斷。請再試一次。', 3400);
    }
    updateStartState();
  }

  /* ========================================================================
     Native camera fallback
     ======================================================================== */

  function cleanupNativePromise() {
    if (state.nativeFocusHandler) {
      window.removeEventListener('focus', state.nativeFocusHandler);
      state.nativeFocusHandler = null;
    }
    if (state.nativeCancelHandler) {
      el.nativeCaptureInput.removeEventListener('cancel', state.nativeCancelHandler);
      state.nativeCancelHandler = null;
    }
    if (state.nativeChangeHandler) {
      el.nativeCaptureInput.removeEventListener('change', state.nativeChangeHandler);
      state.nativeChangeHandler = null;
    }
    if (state.nativeShootHandler) {
      el.nativeShootBtn.removeEventListener('click', state.nativeShootHandler);
      state.nativeShootHandler = null;
    }
    state.nativeResolve = null;
    state.nativeReject = null;
  }

  function hideNativeModal() {
    el.nativeShotOverlay.hidden = true;
    cleanupNativePromise();
  }

  function requestNativeFile(index) {
    return new Promise((resolve, reject) => {
      cleanupNativePromise();
      el.nativeShotIndex.textContent = String(index + 1);
      el.nativeShotOverlay.hidden = false;
      window.setTimeout(() => el.nativeShootBtn.focus({ preventScroll: true }), 60);

      let settled = false;
      const settle = (fn, value) => {
        if (settled) return;
        settled = true;
        cleanupNativePromise();
        fn(value);
      };

      state.nativeResolve = (file) => settle(resolve, file);
      state.nativeReject = (error) => settle(reject, error);

      state.nativeChangeHandler = () => {
        const file = el.nativeCaptureInput.files && el.nativeCaptureInput.files[0];
        el.nativeCaptureInput.value = '';
        if (file) {
          state.nativeResolve(file);
        } else {
          state.nativeReject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
        }
      };

      state.nativeCancelHandler = () => {
        state.nativeReject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
      };

      el.nativeCaptureInput.addEventListener('change', state.nativeChangeHandler);
      el.nativeCaptureInput.addEventListener('cancel', state.nativeCancelHandler);

      const onShoot = () => {
        if (settled) return;
        el.nativeShotOverlay.hidden = true;
        el.nativeCaptureInput.value = '';
        try {
          el.nativeCaptureInput.click();
        } catch (error) {
          state.nativeReject(Object.assign(new Error('camera input failed'), { name: 'AbortError' }));
        }
        // Some browsers do not fire a cancel event. If the picker closes
        // without a file, do not leave the session hanging forever.
        state.nativeFocusHandler = () => {
          window.setTimeout(() => {
            if (!settled) {
              const hasFile = el.nativeCaptureInput.files && el.nativeCaptureInput.files.length;
              if (!hasFile) {
                state.nativeReject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
              }
            }
          }, 900);
        };
        window.addEventListener('focus', state.nativeFocusHandler, { once: true });
      };

      state.nativeShootHandler = onShoot;
      el.nativeShootBtn.addEventListener('click', onShoot);
    });
  }

  /* ========================================================================
     Print / develop screen
     ======================================================================== */

  async function enterPrintScreen() {
    renderStrip();
    state.printDataUrl = el.stripPreview.toDataURL('image/jpeg', 0.92);
    el.printStripImg.src = state.printDataUrl;

    el.printEyebrow.textContent = '顯影中 · DEVELOPING';
    el.printTitle.innerHTML = '請稍候，<br>光正在紙上停留。';
    el.printSub.textContent = '四格銀鹽，正在慢慢浮現。';
    el.collectBtn.hidden = true;
    el.machineCaption.textContent = 'FEEDING PAPER';
    el.printPaper.classList.remove('is-out');

    await goToScreen('print');
    await wait(560 * T);
    el.printPaper.classList.add('is-out');
    if (state.soundOn) play('printMotor');

    await wait(3400 * T);
    el.printEyebrow.textContent = 'READY · COLLECT YOUR PRINT';
    el.printTitle.innerHTML = '相紙已印好，<br>請取回你的四格。';
    el.printSub.textContent = '四格銀鹽，已風乾。拿在手上，才算是今天。';
    el.collectBtn.hidden = false;
    el.machineCaption.textContent = 'READY TO COLLECT';
    if (state.soundOn) play('chime');
    window.setTimeout(() => el.collectBtn.focus({ preventScroll: true }), 80);
  }

  async function collectPrint() {
    if (state.busy) return;
    await goToScreen('result');
    renderStrip();
    updateCounters();
    showToast('已取相，寫下名字再保存。', 2200);
  }

  /* ========================================================================
     Canvas photo strip
     ======================================================================== */

  const STRIP = {
    width: 720,
    height: 2516,
    frameW: 672,
    frameH: 504,
    frameX: 24,
    frameTop: 70,
    frameGap: 12,
    footerTop: 2144
  };

  const FONT_DISPLAY = '"STSong", "Songti SC", "Noto Serif CJK SC", "Source Han Serif SC", "SimSun", serif';
  const FONT_SANS = '"Helvetica Neue", "Arial", "PingFang SC", "Microsoft YaHei", sans-serif';
  const FONT_SERIF_EN = '"Bodoni 72", "Didot", "Playfair Display", Georgia, "Times New Roman", serif';

  let grainPattern = null;

  function getGrainPattern(ctx) {
    if (grainPattern) return grainPattern;
    const canvas = createCanvas(160, 160);
    const nctx = canvas.getContext('2d');
    const image = nctx.createImageData(160, 160);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = Math.random() * 255;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 18;
    }
    nctx.putImageData(image, 0, 0);
    grainPattern = ctx.createPattern(canvas, 'repeat');
    return grainPattern;
  }

  function drawTrackedText(ctx, text, x, y, spacing, align = 'left') {
    const chars = Array.from(String(text));
    const widths = chars.map(char => ctx.measureText(char).width);
    const total = widths.reduce((sum, value) => sum + value, 0) + spacing * Math.max(0, chars.length - 1);
    let cursor = x;
    if (align === 'center') cursor -= total / 2;
    if (align === 'right') cursor -= total;
    chars.forEach((char, index) => {
      ctx.fillText(char, cursor, y);
      cursor += widths[index] + spacing;
    });
    return total;
  }

  function wrapCanvasText(ctx, text, maxWidth, maxLines = 2) {
    const chars = Array.from(String(text));
    const lines = [];
    let line = '';
    chars.forEach((char) => {
      if (char === '\n') {
        if (line) lines.push(line);
        line = '';
        return;
      }
      const test = line + char;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = char;
      } else {
        line = test;
      }
    });
    if (line) lines.push(line);
    return lines.slice(0, maxLines);
  }

  function getDetails() {
    const name = (el.nameInput.value || '').trim() || 'GUEST';
    const message = (el.messageInput.value || '').trim();
    const date = displayDate(el.dateInput.value || todayISO());
    return { name: name.slice(0, 12), message: message.slice(0, 28), date };
  }

  function renderStrip() {
    const canvas = el.stripPreview;
    const ctx = canvas.getContext('2d');
    canvas.width = STRIP.width;
    canvas.height = STRIP.height;

    // Film black
    const black = ctx.createLinearGradient(0, 0, 0, STRIP.height);
    black.addColorStop(0, '#141410');
    black.addColorStop(0.45, '#0e0e0b');
    black.addColorStop(1, '#11110d');
    ctx.fillStyle = black;
    ctx.fillRect(0, 0, STRIP.width, STRIP.height);

    // Top contact-sheet lettering
    ctx.fillStyle = 'rgba(241, 230, 209, .72)';
    ctx.font = `500 9px ${FONT_SANS}`;
    drawTrackedText(ctx, 'THE PAPER PHOTOBOOTH', STRIP.frameX, 44, 2.1, 'left');
    drawTrackedText(ctx, 'FOUR POSES · No. 07', STRIP.width - STRIP.frameX, 44, 2.1, 'right');
    ctx.strokeStyle = 'rgba(198, 154, 86, .42)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(STRIP.frameX, 54);
    ctx.lineTo(STRIP.width - STRIP.frameX, 54);
    ctx.stroke();

    // Frames
    for (let index = 0; index < 4; index += 1) {
      const x = STRIP.frameX;
      const y = STRIP.frameTop + index * (STRIP.frameH + STRIP.frameGap);
      ctx.fillStyle = '#080806';
      ctx.fillRect(x, y, STRIP.frameW, STRIP.frameH);
      const photo = state.photos[index];
      if (photo && photo.canvas) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(photo.canvas, x, y, STRIP.frameW, STRIP.frameH);
      } else {
        ctx.fillStyle = '#171712';
        ctx.fillRect(x, y, STRIP.frameW, STRIP.frameH);
      }
      ctx.strokeStyle = 'rgba(244, 232, 211, .15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, STRIP.frameW - 1, STRIP.frameH - 1);

      // tiny frame index inside the image edge
      ctx.fillStyle = 'rgba(245, 235, 215, .55)';
      ctx.font = `500 9px ${FONT_SERIF_EN}`;
      drawTrackedText(ctx, pad2(index + 1), x + 12, y + 20, 1.2, 'left');
    }

    // Cream paper footer
    ctx.fillStyle = '#efe4cf';
    ctx.fillRect(0, STRIP.footerTop, STRIP.width, STRIP.height - STRIP.footerTop);

    // paper texture
    const pattern = getGrainPattern(ctx);
    if (pattern) {
      ctx.save();
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = pattern;
      ctx.fillRect(0, STRIP.footerTop, STRIP.width, STRIP.height - STRIP.footerTop);
      ctx.restore();
    }

    // fine gold rule
    ctx.strokeStyle = 'rgba(176, 137, 77, .55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(STRIP.frameX, STRIP.footerTop + 22);
    ctx.lineTo(STRIP.width - STRIP.frameX, STRIP.footerTop + 22);
    ctx.stroke();

    const details = getDetails();

    // footer masthead
    ctx.fillStyle = '#8d6d3f';
    ctx.font = `500 10px ${FONT_SANS}`;
    drawTrackedText(ctx, 'THE PAPER PHOTOBOOTH', STRIP.frameX, STRIP.footerTop + 58, 2.8, 'left');
    drawTrackedText(ctx, 'No. 07', STRIP.width - STRIP.frameX, STRIP.footerTop + 58, 2.2, 'right');

    // message / quote
    ctx.fillStyle = '#564b39';
    const message = details.message;
    if (message) {
      const size = message.length > 16 ? 26 : 32;
      ctx.font = `400 ${size}px ${FONT_DISPLAY}`;
      const lines = wrapCanvasText(ctx, message, 560, 2);
      const lineHeight = size * 1.45;
      const totalHeight = lines.length * lineHeight;
      let y = STRIP.footerTop + 142 - totalHeight / 2;
      ctx.textAlign = 'center';
      lines.forEach((line) => {
        ctx.fillText(line, STRIP.width / 2, y);
        y += lineHeight;
      });
      ctx.textAlign = 'left';
    } else {
      ctx.fillStyle = '#867253';
      ctx.font = `italic 400 28px ${FONT_SERIF_EN}`;
      ctx.textAlign = 'center';
      ctx.fillText('A moment, kept.', STRIP.width / 2, STRIP.footerTop + 135);
      ctx.textAlign = 'left';
    }

    // divider
    ctx.strokeStyle = 'rgba(150, 113, 62, .4)';
    ctx.beginPath();
    ctx.moveTo(STRIP.frameX + 10, STRIP.footerTop + 204);
    ctx.lineTo(STRIP.width - STRIP.frameX - 10, STRIP.footerTop + 204);
    ctx.stroke();

    // Name
    ctx.fillStyle = '#99835f';
    ctx.font = `500 8px ${FONT_SANS}`;
    drawTrackedText(ctx, 'NAME · 名字', STRIP.frameX + 10, STRIP.footerTop + 236, 2.1, 'left');
    ctx.fillStyle = '#3e4034';
    ctx.font = `400 22px ${FONT_DISPLAY}`;
    ctx.fillText(details.name, STRIP.frameX + 10, STRIP.footerTop + 268);

    // Date
    ctx.fillStyle = '#99835f';
    ctx.font = `500 8px ${FONT_SANS}`;
    drawTrackedText(ctx, 'DATE · 日期', STRIP.width - STRIP.frameX - 10, STRIP.footerTop + 236, 2.1, 'right');
    ctx.fillStyle = '#3e4034';
    ctx.font = `400 20px ${FONT_SERIF_EN}`;
    drawTrackedText(ctx, details.date, STRIP.width - STRIP.frameX - 10, STRIP.footerTop + 267, 1.2, 'right');

    // microcopy and star
    ctx.fillStyle = '#9b8664';
    ctx.font = `500 7.2px ${FONT_SANS}`;
    drawTrackedText(ctx, 'SILVER GELATIN · FOUR POSES · MADE LOCALLY', STRIP.width / 2, STRIP.height - 30, 1.8, 'center');

    // tiny gold star
    ctx.save();
    ctx.translate(STRIP.width / 2, STRIP.footerTop + 320);
    ctx.fillStyle = 'rgba(176, 137, 77, .65)';
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const radius = i % 2 === 0 ? 5 : 1.4;
      const angle = (Math.PI / 4) * i - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // edge vignette on the whole paper
    const vignette = ctx.createLinearGradient(0, 0, STRIP.width, 0);
    vignette.addColorStop(0, 'rgba(52, 36, 15, .11)');
    vignette.addColorStop(0.045, 'rgba(52, 36, 15, 0)');
    vignette.addColorStop(0.955, 'rgba(52, 36, 15, 0)');
    vignette.addColorStop(1, 'rgba(52, 36, 15, .11)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, STRIP.width, STRIP.height);

    return canvas;
  }

  function updateCounters() {
    updateCounter(el.nameInput, el.nameCount, 12);
    updateCounter(el.messageInput, el.messageCount, 28);
  }

  let renderQueued = false;
  function scheduleStripRender() {
    updateCounters();
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => {
      renderQueued = false;
      renderStrip();
    });
  }

  /* ========================================================================
     Demo paper-doll portraits
     ======================================================================== */

  function roundRectPath(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function paperShadow(ctx, blur = 16, opacity = 0.22, offset = 10) {
    ctx.shadowColor = `rgba(35, 23, 12, ${opacity})`;
    ctx.shadowBlur = blur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = offset;
  }

  function clearShadow(ctx) {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  }

  function drawDemoPose(index) {
    const canvas = createCanvas(1440, 1080);
    const ctx = canvas.getContext('2d');
    const variants = [
      { bg: '#234b3b', arch: '#ead8b8', disc: '#7c2b38', cardigan: '#2f4f40', blouse: '#eadcc2', skin: '#e2c5a4', hair: '#24211d' },
      { bg: '#1f4033', arch: '#e4d0ad', disc: '#633040', cardigan: '#3b5b4b', blouse: '#f0e3ca', skin: '#dcbc9a', hair: '#1f1d1a' },
      { bg: '#2b5141', arch: '#f0dfc2', disc: '#853241', cardigan: '#27483a', blouse: '#e9d9bd', skin: '#e7cbaa', hair: '#26221e' },
      { bg: '#193a2e', arch: '#e7d5b5', disc: '#743142', cardigan: '#395848', blouse: '#f1e4cb', skin: '#dfc09f', hair: '#1d1b18' }
    ];
    const v = variants[index];
    const cx = 720 + (index % 2 === 0 ? -18 : 20);

    // Background paper layers
    ctx.fillStyle = v.bg;
    ctx.fillRect(0, 0, 1440, 1080);

    ctx.save();
    paperShadow(ctx, 20, 0.24, 12);
    ctx.fillStyle = v.arch;
    ctx.beginPath();
    ctx.moveTo(320, 1010);
    ctx.lineTo(320, 560);
    ctx.bezierCurveTo(320, 285, 460, 170, 720, 170);
    ctx.bezierCurveTo(980, 170, 1120, 285, 1120, 560);
    ctx.lineTo(1120, 1010);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    paperShadow(ctx, 18, 0.25, 10);
    ctx.fillStyle = v.disc;
    ctx.beginPath();
    ctx.arc(cx + 4, 510, 320, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(196, 154, 86, .75)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx + 4, 510, 300, 0, Math.PI * 2);
    ctx.stroke();

    // paper confetti
    const confetti = [
      [250, 320, -18, 24], [1160, 290, 12, 26], [1188, 720, -26, 18],
      [230, 790, 24, 20], [1030, 880, 17, 14], [340, 900, -12, 15]
    ];
    ctx.fillStyle = 'rgba(210, 174, 108, .85)';
    confetti.forEach(([x, y, rotation, size], i) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation * Math.PI / 180);
      if (i % 2 === 0) {
        ctx.fillRect(-size / 2, -size / 2, size, size);
      } else {
        ctx.beginPath();
        ctx.moveTo(0, -size);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    });

    // Table / foreground paper band
    ctx.fillStyle = 'rgba(18, 42, 33, .7)';
    ctx.beginPath();
    ctx.moveTo(0, 940);
    ctx.bezierCurveTo(300, 885, 1120, 900, 1440, 955);
    ctx.lineTo(1440, 1080);
    ctx.lineTo(0, 1080);
    ctx.closePath();
    ctx.fill();

    // Torso
    ctx.save();
    paperShadow(ctx, 22, 0.22, 14);
    ctx.fillStyle = v.cardigan;
    ctx.beginPath();
    ctx.moveTo(cx - 370, 1080);
    ctx.bezierCurveTo(cx - 330, 865, cx - 255, 785, cx - 130, 755);
    ctx.lineTo(cx + 130, 755);
    ctx.bezierCurveTo(cx + 255, 785, cx + 330, 865, cx + 370, 1080);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    paperShadow(ctx, 14, 0.16, 8);
    ctx.fillStyle = v.blouse;
    ctx.beginPath();
    ctx.moveTo(cx - 145, 767);
    ctx.bezierCurveTo(cx - 105, 800, cx - 70, 820, cx - 49, 851);
    ctx.lineTo(cx, 1010);
    ctx.lineTo(cx + 49, 851);
    ctx.bezierCurveTo(cx + 70, 820, cx + 105, 800, cx + 145, 767);
    ctx.lineTo(cx + 210, 1080);
    ctx.lineTo(cx - 210, 1080);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // collar line
    ctx.strokeStyle = 'rgba(64, 63, 48, .35)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx - 90, 785);
    ctx.quadraticCurveTo(cx, 840, cx + 90, 785);
    ctx.stroke();

    // Neck
    ctx.save();
    paperShadow(ctx, 10, 0.16, 6);
    ctx.fillStyle = '#caa987';
    roundRectPath(ctx, cx - 47, 655, 94, 155, 32);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = v.skin;
    roundRectPath(ctx, cx - 43, 652, 86, 135, 28);
    ctx.fill();

    // Hair back
    ctx.save();
    paperShadow(ctx, 22, 0.2, 12);
    ctx.fillStyle = v.hair;
    ctx.beginPath();
    ctx.ellipse(cx, 465, 248, 292, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // side locks
    ctx.fillStyle = v.hair;
    ctx.beginPath();
    ctx.moveTo(cx - 242, 385);
    ctx.bezierCurveTo(cx - 295, 520, cx - 285, 660, cx - 228, 760);
    ctx.bezierCurveTo(cx - 195, 700, cx - 190, 600, cx - 168, 500);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx + 242, 385);
    ctx.bezierCurveTo(cx + 295, 520, cx + 285, 660, cx + 228, 760);
    ctx.bezierCurveTo(cx + 195, 700, cx + 190, 600, cx + 168, 500);
    ctx.closePath();
    ctx.fill();

    // Face
    ctx.save();
    paperShadow(ctx, 16, 0.15, 9);
    ctx.fillStyle = v.skin;
    ctx.beginPath();
    ctx.ellipse(cx, 475, 166, 199, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // ears
    ctx.fillStyle = '#d4b18f';
    ctx.beginPath();
    ctx.ellipse(cx - 166, 490, 24, 38, -.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 166, 490, 24, 38, .1, 0, Math.PI * 2);
    ctx.fill();

    // gold earrings
    ctx.fillStyle = '#c79b56';
    ctx.beginPath();
    ctx.arc(cx - 168, 548, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 168, 548, 10, 0, Math.PI * 2);
    ctx.fill();

    // Fringe
    ctx.fillStyle = v.hair;
    ctx.beginPath();
    ctx.moveTo(cx - 168, 365);
    ctx.bezierCurveTo(cx - 145, 300, cx - 72, 272, cx - 20, 289);
    ctx.bezierCurveTo(cx + 38, 260, cx + 126, 294, cx + 166, 365);
    ctx.bezierCurveTo(cx + 127, 404, cx + 115, 352, cx + 74, 395);
    ctx.bezierCurveTo(cx + 42, 333, cx + 18, 350, cx - 14, 399);
    ctx.bezierCurveTo(cx - 51, 345, cx - 93, 409, cx - 127, 380);
    ctx.bezierCurveTo(cx - 144, 398, cx - 156, 379, cx - 168, 365);
    ctx.closePath();
    ctx.fill();

    // features
    const eyeY = 450;
    ctx.strokeStyle = 'rgba(33, 29, 24, .88)';
    ctx.fillStyle = 'rgba(33, 29, 24, .92)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const eyeOffset = 67;

    function openEye(x, closed = false) {
      if (closed) {
        ctx.beginPath();
        ctx.arc(x, eyeY + 7, 20, Math.PI * 1.12, Math.PI * 1.88);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.ellipse(x, eyeY, 11, 15, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255, 247, 227, .75)';
        ctx.beginPath();
        ctx.arc(x - 3.5, eyeY - 5, 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(33, 29, 24, .92)';
      }
    }

    if (index === 0) {
      openEye(cx - eyeOffset, false);
      openEye(cx + eyeOffset, false);
    } else if (index === 1) {
      openEye(cx - eyeOffset, true);
      openEye(cx + eyeOffset, true);
    } else if (index === 2) {
      openEye(cx - eyeOffset, false);
      openEye(cx + eyeOffset, true);
    } else {
      openEye(cx - eyeOffset, true);
      openEye(cx + eyeOffset, true);
    }

    // brows
    ctx.strokeStyle = 'rgba(49, 38, 29, .65)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cx - 93, 410);
    ctx.quadraticCurveTo(cx - 68, 396, cx - 42, 410);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + 42, 410);
    ctx.quadraticCurveTo(cx + 68, 396, cx + 93, 410);
    ctx.stroke();

    // nose
    ctx.strokeStyle = 'rgba(142, 99, 73, .55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx + 1, 493);
    ctx.quadraticCurveTo(cx - 8, 518, cx + 7, 522);
    ctx.stroke();

    // blush
    ctx.fillStyle = 'rgba(172, 91, 80, .15)';
    ctx.beginPath();
    ctx.ellipse(cx - 103, 527, 35, 19, -.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 103, 527, 35, 19, .08, 0, Math.PI * 2);
    ctx.fill();

    // mouth
    ctx.fillStyle = '#7f3b3c';
    ctx.strokeStyle = '#713136';
    if (index === 0) {
      ctx.beginPath();
      ctx.ellipse(cx, 568, 43, 25, 0, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = 'rgba(246, 231, 206, .9)';
      ctx.fillRect(cx - 29, 568, 58, 7);
    } else if (index === 1) {
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(cx, 552, 36, .18, Math.PI - .18);
      ctx.stroke();
    } else if (index === 2) {
      ctx.beginPath();
      ctx.ellipse(cx, 565, 18, 14, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(cx, 563, 49, 30, 0, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = 'rgba(247, 233, 208, .92)';
      ctx.fillRect(cx - 34, 563, 68, 7);
      ctx.fillStyle = 'rgba(126, 50, 55, .85)';
      ctx.beginPath();
      ctx.ellipse(cx, 585, 19, 8, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Collar brooch
    ctx.fillStyle = '#d2aa66';
    ctx.save();
    ctx.translate(cx - 77, 860);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-7, -7, 14, 14);
    ctx.restore();

    // Arms and hands
    ctx.strokeStyle = v.skin;
    ctx.fillStyle = v.skin;
    ctx.lineCap = 'round';
    const drawArm = (points, width = 52) => {
      ctx.save();
      ctx.strokeStyle = '#c5a17d';
      ctx.lineWidth = width + 5;
      ctx.beginPath();
      points.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
      ctx.stroke();
      ctx.strokeStyle = v.skin;
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.restore();
    };

    const drawPalm = (x, y, rotation = 0) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      paperShadow(ctx, 8, 0.18, 5);
      ctx.fillStyle = v.skin;
      ctx.beginPath();
      ctx.ellipse(0, 0, 42, 54, 0, 0, Math.PI * 2);
      ctx.fill();
      clearShadow(ctx);
      ctx.restore();
    };

    const drawFinger = (x, y, w, h, rotation = 0) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillStyle = v.skin;
      roundRectPath(ctx, -w / 2, -h / 2, w, h, w / 2);
      ctx.fill();
      ctx.restore();
    };

    if (index === 0) {
      // peace sign beside the cheek
      drawArm([[cx + 265, 1030], [cx + 300, 820], [cx + 240, 680]], 55);
      drawPalm(cx + 220, 585, -0.25);
      drawFinger(cx + 195, 505, 25, 92, -0.2);
      drawFinger(cx + 258, 512, 25, 98, 0.2);
      drawArm([[cx - 265, 1030], [cx - 300, 850], [cx - 272, 760]], 55);
    } else if (index === 1) {
      // both hands on cheeks
      drawArm([[cx - 270, 1030], [cx - 315, 820], [cx - 235, 640]], 54);
      drawArm([[cx + 270, 1030], [cx + 315, 820], [cx + 235, 640]], 54);
      drawPalm(cx - 190, 570, -0.3);
      drawPalm(cx + 190, 570, 0.3);
      [-1, 0, 1].forEach((offset) => {
        drawFinger(cx - 230 + offset * 20, 505 + Math.abs(offset) * 5, 18, 60, -0.15 + offset * 0.12);
        drawFinger(cx + 230 + offset * 20, 505 + Math.abs(offset) * 5, 18, 60, 0.15 + offset * 0.12);
      });
    } else if (index === 2) {
      // hand over one eye
      drawArm([[cx + 250, 1030], [cx + 300, 800], [cx + 190, 560]], 55);
      drawPalm(cx + 115, 430, -0.35);
      drawFinger(cx + 60, 380, 20, 74, -0.48);
      drawFinger(cx + 108, 360, 20, 82, -0.28);
      drawFinger(cx + 156, 366, 20, 78, -0.08);
      drawArm([[cx - 270, 1030], [cx - 310, 860], [cx - 270, 780]], 55);
      drawPalm(cx - 260, 735, 0.2);
    } else {
      // hands clasped under the chin
      drawArm([[cx - 250, 1030], [cx - 205, 830], [cx - 80, 705]], 54);
      drawArm([[cx + 250, 1030], [cx + 205, 830], [cx + 80, 705]], 54);
      drawPalm(cx - 45, 690, 0.5);
      drawPalm(cx + 45, 690, -0.5);
      drawFinger(cx - 26, 640, 18, 60, -0.2);
      drawFinger(cx + 26, 640, 18, 60, 0.2);
    }

    // small signature dot / paper label
    ctx.fillStyle = 'rgba(245, 234, 213, .62)';
    ctx.font = `500 8px ${FONT_SANS}`;
    drawTrackedText(ctx, 'PAPER DOLL · DEMO', 50, 1040, 2.3, 'left');

    // Slight paper grain to avoid flat vector edges before the silver process.
    for (let i = 0; i < 220; i += 1) {
      const x = Math.random() * 1440;
      const y = Math.random() * 1080;
      ctx.fillStyle = `rgba(255, 248, 230, ${Math.random() * 0.035})`;
      ctx.fillRect(x, y, 1.2, 1.2);
    }

    return canvas;
  }

  function ensureDemoPhotos() {
    if (state.demoCache) return state.demoCache;
    state.demoCache = [0, 1, 2, 3].map((index) => {
      const raw = drawDemoPose(index);
      const processed = processFrame(raw);
      return {
        canvas: processed,
        url: processed.toDataURL('image/jpeg', 0.92)
      };
    });
    return state.demoCache;
  }

  /* ========================================================================
     Save as PNG
     ======================================================================== */

  function filenameForDownload() {
    const now = new Date();
    const stamp = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}-${pad2(now.getHours())}${pad2(now.getMinutes())}`;
    return `paper-photobooth-${stamp}.png`;
  }

  function openSaveSheet(dataUrl) {
    el.toast.classList.remove('is-visible');
    el.saveSheetImage.src = dataUrl;
    el.saveSheet.hidden = false;
    window.setTimeout(() => el.saveSheetClose.focus({ preventScroll: true }), 60);
  }

  function closeSaveSheet() {
    el.saveSheet.hidden = true;
    el.saveSheetImage.removeAttribute('src');
  }

  function triggerDownload(dataUrl) {
    const link = document.createElement('a');
    link.download = filenameForDownload();
    link.href = dataUrl;
    link.rel = 'noopener';
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    window.setTimeout(() => {
      link.remove();
    }, 1000);
  }

  function savePng() {
    renderStrip();
    const dataUrl = el.stripPreview.toDataURL('image/png');

    if (isWeChat) {
      openSaveSheet(dataUrl);
      return;
    }

    try {
      if (el.stripPreview.toBlob) {
        el.stripPreview.toBlob((blob) => {
          if (!blob) {
            openSaveSheet(dataUrl);
            return;
          }
          const objectUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.download = filenameForDownload();
          link.href = objectUrl;
          link.rel = 'noopener';
          link.style.display = 'none';
          document.body.appendChild(link);
          link.click();
          link.remove();
          window.setTimeout(() => URL.revokeObjectURL(objectUrl), 6000);
          showToast('PNG 已生成。', 2400);
        }, 'image/png');
      } else {
        triggerDownload(dataUrl);
        showToast('PNG 已生成。', 2600);
      }
    } catch (error) {
      openSaveSheet(dataUrl);
    }
  }

  /* ========================================================================
     Reset / retake
     ======================================================================== */

  function resetInterior({ keepCredit = false } = {}) {
    state.mode = 'idle';
    state.sessionActive = false;
    state.sessionAbort = false;
    state.finishing = false;
    state.cameraRequest += 1;
    stopCamera();
    state.photos = [];
    resetThumbs();
    el.freezeFrame.hidden = true;
    el.freezeFrame.classList.remove('is-visible');
    el.freezeFrame.removeAttribute('src');
    el.demoImage.hidden = true;
    el.demoImage.removeAttribute('src');
    el.video.hidden = true;
    el.viewerIdle.hidden = false;
    el.viewerNative.hidden = true;
    el.viewerLoading.hidden = true;
    el.viewerError.hidden = true;
    el.liveBadge.hidden = true;
    el.shotCounter.hidden = true;
    el.countdown.hidden = true;
    el.nativeShotOverlay.hidden = true;
    el.developingOverlay.hidden = true;
    el.flipCameraBtn.hidden = true;
    el.startBtn.disabled = true;
    el.startHint.textContent = '請先開啟相機，並投入一枚硬幣。';
    el.startHint.classList.remove('is-alert');
    el.cameraStatus.dataset.state = 'off';
    el.cameraStatusText.textContent = '相機未開啟';
    state.cameraState = 'off';
    setCameraStatusByMode();
    setSessionSpec('camera');
    if (!keepCredit) {
      setCreditUI(0);
    } else {
      setCreditUI(1);
    }
    el.coinButton.classList.remove('is-used');
    updateStartState();
  }

  async function retake() {
    if (state.busy) return;
    closeSaveSheet();
    const mode = state.lastMode;
    const previousFacing = state.facing;
    resetInterior({ keepCredit: true });
    state.facing = previousFacing;
    state.printDataUrl = '';
    el.printPaper.classList.remove('is-out');
    el.collectBtn.hidden = true;
    await goToScreen('interior', { dark: true });
    if (mode === 'demo') {
      enableDemoMode({ quiet: true });
      showToast('硬幣還在，再影一輯吧。', 2400);
    } else if (mode === 'native') {
      enableNativeMode({ quiet: true });
      showToast('硬幣還在，再影一輯吧。', 2400);
    } else {
      setCameraStatus('loading', '正在開啟相機');
      el.viewerIdle.hidden = true;
      el.viewerLoading.hidden = false;
      await openCamera({ quiet: true });
      showToast('硬幣還在，再影一輯吧。', 2400);
    }
  }

  async function backToBooth() {
    if (state.sessionActive || state.busy) return;
    stopCamera();
    resetInterior({ keepCredit: false });
    resetCurtain();
    await goToScreen('exterior', { dark: true });
  }

  async function enterBooth() {
    if (state.busy) return;
    unlockAudio();
    if (state.soundOn) play('chime');
    resetInterior({ keepCredit: false });
    await goToScreen('interior', { dark: true });
    window.setTimeout(() => el.openCameraBtn.focus({ preventScroll: true }), 100);
  }

  /* ========================================================================
     Wiring
     ======================================================================== */

  function bindEvents() {
    document.addEventListener('pointerdown', unlockAudio, { once: true, capture: true });

    el.soundToggle.addEventListener('click', () => {
      unlockAudio();
      state.soundOn = !state.soundOn;
      safeStorageSet(SOUND_KEY, state.soundOn ? 'on' : 'off');
      setSoundUI();
      if (state.soundOn) play('tick');
    });

    el.curtainPull.addEventListener('click', () => {
      unlockAudio();
      openCurtain();
    });
    if (el.footOpenBtn) {
      el.footOpenBtn.addEventListener('click', () => {
        unlockAudio();
        openCurtain();
      });
    }
    bindCurtainDrag();

    el.backToBooth.addEventListener('click', backToBooth);

    el.openCameraBtn.addEventListener('click', () => openCamera());
    el.retryCameraBtn.addEventListener('click', () => openCamera());
    el.errorOpenTabBtn.addEventListener('click', openCameraInNewTab);
    el.openInNewTabBtn.addEventListener('click', openCameraInNewTab);
    el.demoBtn.addEventListener('click', () => enableDemoMode());
    el.nativeCameraBtn.addEventListener('click', () => enableNativeMode());
    el.errorDemoBtn.addEventListener('click', () => enableDemoMode());
    el.backToLiveCamera.addEventListener('click', () => openCamera());
    el.flipCameraBtn.addEventListener('click', flipCamera);
    el.coinButton.addEventListener('click', () => {
      unlockAudio();
      insertCoin();
    });
    el.startBtn.addEventListener('click', startSession);

    el.nativeCancelBtn.addEventListener('click', () => {
      if (state.nativeReject) state.nativeReject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
    });

    el.collectBtn.addEventListener('click', collectPrint);

    el.nameInput.addEventListener('input', scheduleStripRender);
    el.messageInput.addEventListener('input', scheduleStripRender);
    el.dateInput.addEventListener('input', scheduleStripRender);
    el.dateInput.addEventListener('change', scheduleStripRender);
    el.printForm.addEventListener('submit', event => event.preventDefault());
    el.saveBtn.addEventListener('click', savePng);
    el.inlineSaveBtn.addEventListener('click', () => {
      renderStrip();
      openSaveSheet(el.stripPreview.toDataURL('image/png'));
    });
    el.retakeBtn.addEventListener('click', retake);

    el.saveSheetClose.addEventListener('click', closeSaveSheet);
    el.saveSheetCloseBtn.addEventListener('click', closeSaveSheet);
    el.saveSheet.addEventListener('click', (event) => {
      if (event.target === el.saveSheet) closeSaveSheet();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (!el.saveSheet.hidden) closeSaveSheet();
        else if (!el.nativeShotOverlay.hidden && state.nativeReject) state.nativeReject(Object.assign(new Error('cancelled'), { name: 'AbortError' }));
      }
      if (event.key === 'Enter' && event.target === el.dateInput) {
        event.preventDefault();
        el.messageInput.focus();
      }
    });

    window.addEventListener('pagehide', () => {
      stopCamera();
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && state.sessionActive && state.mode === 'camera') {
        // Keep the session alive but release torch if the user leaves.
        setTorch(false);
      }
    });
  }

  function init() {
    const storedSound = safeStorageGet(SOUND_KEY);
    state.soundOn = storedSound !== 'off';
    AudioEngine.muted = !state.soundOn;
    setSoundUI();
    updateCameraEnvironment();

    el.dateInput.value = todayISO();
    updateCounters();
    setCreditUI(0);
    updateStartState();
    setCameraStatusByMode();
    resetThumbs();

    // Preload demo portraits only when they are actually requested; this
    // keeps the initial page light for real-camera users.
    el.dateInput.addEventListener('change', updateCounters);

    bindEvents();
  }

  init();
})();
