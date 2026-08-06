/**
 * GameManager — owns the canvas, main loop, scene switching
 * (loading / farm / map), global economy, unlock flow and autosave.
 */
const Game = (() => {
  const W = CONFIG.VIEW_W, H = CONFIG.VIEW_H;
  let canvas, ctx, scale = 1, offX = 0, offY = 0;
  let scene = 'loading';         // 'loading' | 'farm' | 'map'
  let farmScene = null;
  let mapScene = null;
  let lastT = 0, dt = 0, elapsed = 0, autosaveT = 0;
  let started = false;
  let celebration = null;        // active discovery celebration, see startCelebration()
  let upgradeTutorial = null;    // active first-upgrade tutorial: {t}, see maybeStartUpgradeTutorial()

  // ---------------- setup ----------------
  function init() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    SaveManager.load();
    AudioManager.setMusic(SaveManager.data.settings.music);
    AudioManager.setSfx(SaveManager.data.settings.sfx);
    resize();
    window.addEventListener('resize', resize);
    bindInput();
    mapScene = new MapScene();
    farmScene = new FarmScene(SaveManager.data.currentFarm);
    UI.syncCoins();
    scheduleFrame(loop);
  }

  /**
   * rAF normally, with a timer watchdog so the idle sim keeps running when
   * the tab is hidden (rAF stops firing there, even for pending frames).
   * Whichever fires first runs the frame; the loser is a no-op.
   */
  function scheduleFrame(fn) {
    let done = false;
    const run = t => { if (done) return; done = true; fn(t); };
    requestAnimationFrame(run);
    setTimeout(() => run(performance.now()), 50);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const sw = window.innerWidth, sh = window.innerHeight;
    scale = Math.min(sw / W, sh / H);
    canvas.style.width = Math.round(W * scale) + 'px';
    canvas.style.height = Math.round(H * scale) + 'px';
    canvas.width = Math.round(W * scale * dpr);
    canvas.height = Math.round(H * scale * dpr);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const rect = { w: Math.round(W * scale), h: Math.round(H * scale) };
    offX = (sw - rect.w) / 2; offY = (sh - rect.h) / 2;
  }

  // ---------------- input ----------------
  function toGame(e) {
    const r = canvas.getBoundingClientRect();
    const cx = (e.touches ? (e.touches[0] || e.changedTouches[0]).clientX : e.clientX) - r.left;
    const cy = (e.touches ? (e.touches[0] || e.changedTouches[0]).clientY : e.clientY) - r.top;
    return { x: cx / scale, y: cy / scale };
  }

  function bindInput() {
    const down = e => {
      e.preventDefault();
      AudioManager.ensure();
      const p = toGame(e);
      if (scene === 'loading') { start(); return; }
      if (UFO.cinematicActive) return;                   // abduction cinematic blocks all input
      if (Tornado.active) return;                        // tornado sweep blocks all input
      if (celebration && !celebration.popupOpen) return; // sequence plays untouched
      if (UI.tap(p.x, p.y)) return;
      if (celebration) return;                           // popup swallows farm taps
      if (upgradeTutorial) return;                       // tutorial: only the upgrade flow is tappable
      if (scene === 'farm' && Tornado.tap(p.x, p.y)) return;
      if (scene === 'farm' && Pigeon.tap(p.x, p.y)) return;
      if (scene === 'farm') farmScene.pointerDown(p.x, p.y);
      else if (scene === 'map' && !mapScene.unlockAnim) {
        const id = mapScene.tappedFarm(p.x, p.y);
        if (id >= 0) onMapFarmTap(id);
      }
    };
    const move = e => {
      e.preventDefault();
      if (UFO.cinematicActive || Tornado.active) return;
      const p = toGame(e);
      if (scene === 'farm') farmScene.pointerMove(p.x, p.y);
    };
    const up = e => {
      e.preventDefault();
      if (UFO.cinematicActive || Tornado.active) return;
      if (scene === 'farm') farmScene.pointerUp();
    };
    canvas.addEventListener('mousedown', down);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    canvas.addEventListener('touchend', up, { passive: false });
  }

  function start() {
    if (started) return;
    started = true;
    scene = 'farm';
    AudioManager.play('click');
  }

  // ---------------- discovery celebration ----------------
  /**
   * Interrupt gameplay for a first-time evolution: zoom toward the merge
   * point, flash, golden sparkles, then open the discovery popup.
   * Gameplay resumes when the player presses CONTINUE (endCelebration).
   */
  function startCelebration(animal, x, y) {
    celebration = {
      t: 0, x, y,
      species: animal.species,
      stage: animal.stage,
      animal,
      sparkleT: 0,
      popupOpen: false,
    };
    AudioManager.play('unlock');
  }

  function updateCelebration() {
    const c = celebration, D = CONFIG.DISCOVERY;
    c.t += dt;
    // let the new animal finish its spawn pop, then hold it still
    if (c.animal.state === 'spawning') c.animal.update(dt, farmScene.bounds, farmScene);
    // golden sparkles raining around the merge point
    c.sparkleT -= dt;
    if (c.sparkleT <= 0 && !c.popupOpen) {
      c.sparkleT = D.SPARKLE_RATE;
      VFXManager.sparkle(c.x, c.y - 16, 5, 26);
      if (Math.random() < 0.5) {
        VFXManager.burst(c.x, c.y - 14, ['#ffe98a', '#f4c437', '#fff6d0'], 4, 70);
      }
    }
    if (!c.popupOpen && c.t >= D.PRE_POPUP_TIME) {
      c.popupOpen = true;
      UI.openPopup({ type: 'discovery', species: c.species, stage: c.stage, fxT: 0, confetti: [] });
    }
  }

  /** Camera zoom factor toward the merge point during the celebration. */
  function celebrationZoom() {
    const c = celebration, D = CONFIG.DISCOVERY;
    const t = Math.min(c.t / D.ZOOM_TIME, 1);
    return 1 + D.ZOOM_AMOUNT * (1 - Math.pow(1 - t, 3)); // ease-out cubic
  }

  /** White flash alpha, peaking right after the zoom lands. */
  function celebrationFlash() {
    const c = celebration, D = CONFIG.DISCOVERY;
    const ft = c.t - D.ZOOM_TIME * 0.55;
    if (ft < 0 || ft > D.FLASH_TIME) return 0;
    return Math.sin((ft / D.FLASH_TIME) * Math.PI) * 0.85;
  }

  function endCelebration() {
    celebration = null;
    farmScene.persist();
  }

  // ---------------- first-upgrade tutorial ----------------
  /** Cheapest non-maxed upgrade cost on the current farm. */
  function cheapestUpgradeCost() {
    const id = SaveManager.data.currentFarm;
    const keys = ['spawn'];
    for (let s = 0; s < CONFIG.UPGRADES.STAGES.length; s++) keys.push(s);
    let min = Infinity;
    for (const k of keys) {
      if (!Upgrades.isMaxed(id, k)) min = Math.min(min, Upgrades.cost(id, k));
    }
    return min;
  }

  /**
   * First time the player can afford an upgrade: freeze gameplay, spotlight
   * the UPGRADE button, then the BUY button, until the purchase completes.
   */
  function maybeStartUpgradeTutorial() {
    if (upgradeTutorial || SaveManager.data.upgradeTutorialDone) return;
    if (farmScene.tutorial || UI.popup) return;
    if (SaveManager.data.coins < cheapestUpgradeCost()) return;
    farmScene.pointerUp(); // settle any in-progress drag
    upgradeTutorial = { t: 0 };
    AudioManager.play('pop');
  }

  /** Any successful upgrade purchase completes the tutorial for good. */
  function onUpgradePurchased() {
    if (!SaveManager.data.upgradeTutorialDone) {
      SaveManager.data.upgradeTutorialDone = true;
      SaveManager.save();
    }
    upgradeTutorial = null;
  }

  // ---------------- economy ----------------
  function addCoins(n) {
    SaveManager.data.coins += n;
    UI.pulseCoin();
  }

  // ---------------- buttons ----------------
  function onButton(id) {
    if (id === 'settings') {
      UI.openPopup({ type: 'settings' });
    } else if (id === 'upgrade') {
      UI.openPopup({ type: 'upgrades', farmId: SaveManager.data.currentFarm, fx: {} });
    } else if (id === 'unlock') {
      const next = SaveManager.data.unlocked.indexOf(false);
      if (next === -1) { UI.showToast('ALL FARMS UNLOCKED!'); return; }
      UI.openPopup({ type: 'unlock', farmId: next });
    } else if (id === 'exit') {
      goToMap();
    }
  }

  function onMapFarmTap(id) {
    AudioManager.play('click');
    if (SaveManager.data.unlocked[id]) {
      // switch farm: load that farm's own animals, upgrades and UFO state
      Pigeon.reset(); // pays out any rain still falling, keeps saved perch state
      Tornado.reset();
      SaveManager.data.currentFarm = id;
      SaveManager.save();
      UFO.reset();
      farmScene = new FarmScene(id);
      scene = 'farm';
    } else {
      UI.openPopup({ type: 'unlock', farmId: id });
    }
  }

  // ---------------- unlock flow ----------------
  function tryUnlock(farmId) {
    const cost = CONFIG.UNLOCK_COSTS[farmId];
    if (SaveManager.data.coins < cost) {
      UI.showToast('NOT ENOUGH COINS!');
      AudioManager.play('error');
      return;
    }
    SaveManager.data.coins -= cost;
    SaveManager.save();
    UI.closePopup();
    // move to map & play the golden path animation
    goToMap();
    mapScene.playUnlock(farmId);
  }

  function onUnlockAnimDone(farmId) {
    SaveManager.data.unlocked[farmId] = true;
    SaveManager.data.currentFarm = farmId;
    SaveManager.save();
    // brief pause then enter the new farm
    setTimeout(() => {
      UFO.reset();
      Pigeon.reset();
      Tornado.reset();
      farmScene = new FarmScene(farmId);
      scene = 'farm';
      AudioManager.play('pop');
    }, 900);
  }

  function goToMap() {
    farmScene.persist();
    scene = 'map';
  }

  function resetAll() {
    Pigeon.reset(true); // discard any in-flight rain, no payout into the fresh save
    Tornado.reset();
    SaveManager.reset();
    celebration = null;
    upgradeTutorial = null;
    UFO.reset();
    UI.syncCoins();
    mapScene = new MapScene();
    farmScene = new FarmScene(0);
    scene = 'farm';
  }

  // ---------------- main loop ----------------
  function loop(t) {
    dt = Math.min((t - lastT) / 1000, 0.05);
    lastT = t;
    elapsed += dt;
    Game.dt = dt;

    if (scene === 'loading') {
      UI.drawLoading(ctx, elapsed);
      scheduleFrame(loop);
      return;
    }

    // update (gameplay pauses during a celebration, the upgrade tutorial,
    // or the UFO abduction cinematic — the cinematic itself keeps animating)
    if (celebration) updateCelebration();
    else if (scene === 'farm') {
      if (UFO.cinematicActive) UFO.update(dt);
      // tornado sweep: gameplay paused, only the storm + UFO collects animate
      else if (Tornado.active) { Tornado.updateRun(dt); UFO.update(dt); }
      else {
        maybeStartUpgradeTutorial();
        if (upgradeTutorial) upgradeTutorial.t += dt;
        else {
          farmScene.update(dt); UFO.update(dt);
          Pigeon.update(dt, !!farmScene.tutorial);
          Tornado.update(dt, !!farmScene.tutorial);
        }
      }
    }
    else mapScene.update(dt);
    VFXManager.update(dt);

    // autosave
    autosaveT += dt;
    if (autosaveT >= CONFIG.AUTOSAVE_INTERVAL) {
      autosaveT = 0;
      if (scene === 'farm') farmScene.persist();
      else SaveManager.save();
    }

    // draw
    ctx.fillStyle = '#1a140e';
    ctx.fillRect(0, 0, W, H);
    if (scene === 'farm') {
      if (celebration) {
        // zoom the camera toward the merge location
        const z = celebrationZoom();
        ctx.save();
        ctx.translate(celebration.x, celebration.y);
        ctx.scale(z, z);
        ctx.translate(-celebration.x, -celebration.y);
        farmScene.draw(ctx);
        VFXManager.draw(ctx);
        ctx.restore();
        const flash = celebrationFlash();
        if (flash > 0) {
          ctx.globalAlpha = flash;
          ctx.fillStyle = '#fff9e0';
          ctx.fillRect(0, 0, W, H);
          ctx.globalAlpha = 1;
        }
      } else {
        // subtle screen shake while poops are hitting the ground
        const sh = Pigeon.shakeOffset();
        ctx.save();
        ctx.translate(sh.x, sh.y);
        farmScene.draw(ctx);
        VFXManager.draw(ctx);
        ctx.restore();
      }
    } else {
      mapScene.draw(ctx);
      VFXManager.draw(ctx);
    }
    UI.drawHUD(ctx, scene);
    UI.drawPopup(ctx);
    if (upgradeTutorial && scene === 'farm') UI.drawUpgradeTutorial(ctx, upgradeTutorial.t);

    scheduleFrame(loop);
  }

  window.addEventListener('load', init);
  window.addEventListener('beforeunload', () => {
    if (farmScene) farmScene.persist();
    SaveManager.save();
  });

  return {
    addCoins, onButton, tryUnlock, onUnlockAnimDone, resetAll,
    startCelebration, endCelebration, onUpgradePurchased,
    get scene() { return scene; },
    get farm() { return farmScene; },
    get celebrating() { return !!celebration; },
    get upgradeTutorialActive() { return !!upgradeTutorial; },
    dt: 1 / 60,
  };
})();
