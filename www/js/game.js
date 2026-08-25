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
  let lastT = 0, dt = 0, elapsed = 0, autosaveT = 0, idleT = 0;
  let started = false;
  let celebration = null;        // active discovery celebration, see startCelebration()
  let upgradeTutorial = null;    // active first-upgrade tutorial: {t}, see maybeStartUpgradeTutorial()

  // ---------------- setup ----------------
  function init() {
    canvas = document.getElementById('game');
    ctx = canvas.getContext('2d');
    SaveManager.load();
    // apply capped offline production to every farm before scenes build,
    // recording time away + earnings for the welcome-back popup
    Idle.launchTick();
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
    // the map is the default entry point after a launch, whatever farm the
    // player was in when they left
    scene = 'map';
    AudioManager.play('click');
    const rep = Idle.takeLaunchReport();
    if (rep && rep.awaySec >= CONFIG.IDLE.WELCOME_MIN_AWAY && Math.floor(rep.total) >= 1) {
      // once per launch, only after a real absence with something to show;
      // openT lets the map render a beat before the popup layers over it
      welcome = { rep, claimed: false, openT: 0.5 };
    } else {
      mapScene.queuePendingCollect();
    }
  }

  // ---------------- welcome-back offline earnings ----------------
  let welcome = null;   // {rep, claimed, openT} while the welcome-back popup is pending/up

  /**
   * Grant the welcome-back earnings exactly once. mult=2 after a completed
   * reward ad doubles the offline part; every dismissal path (COLLECT, the
   * X, an ad that fails or is skipped) grants mult=1 so the player can
   * never lose the base amount. The claimed flag makes any second call
   * (double-tap, stray ad callback) a no-op.
   */
  function claimWelcome(mult = 1) {
    if (!welcome || welcome.claimed) return;
    welcome.claimed = true;
    const rep = welcome.rep;
    UI.closePopup();
    // coins fly to the wallet from each farm's map node, staggered like the
    // regular map collection, the counter ticking up as each lands
    let delay = 0.25, granted = 0;
    for (const f of CONFIG.FARMS) {
      const amt = Idle.collect(f.id)
                + Math.floor(rep.perFarm[f.id]) * (mult - 1); // ad bonus: the offline part again
      if (amt <= 0) continue;
      granted += amt;
      mapScene.queueBurst(f.id, amt, delay);
      delay += CONFIG.IDLE.MAP_STAGGER;
    }
    if (granted > 0 && mult > 1) {
      VFXManager.burst(W / 2, H / 2 - 60, ['#ffe98a', '#f4c437', '#fff6d0', '#ffffff'], 26, 130);
      VFXManager.sparkle(W / 2, H / 2 - 70, 14, 40);
      AudioManager.play('unlock');
    }
    SaveManager.save();
    welcome = null;
  }

  /** Rewarded ad completed successfully: double the offline earnings. */
  function onWelcomeAdDone() { claimWelcome(2); }

  /**
   * Rewarded ad failed, was unavailable, or was skipped: collection never
   * blocks on the ad — the base amount is granted with a short non-blocking
   * note. A real ad SDK should call this from its failure/skip callbacks
   * (the built-in simulated ad always completes).
   */
  function onWelcomeAdFailed() {
    UI.showToast('AD NOT AVAILABLE - COINS COLLECTED!');
    claimWelcome(1);
  }

  /** Deliver a farm's accumulated background earnings as flying coins. */
  function collectFarmPending(farmId) {
    const amt = Idle.collect(farmId);
    if (amt <= 0) return;
    const b = farmScene.bounds;
    VFXManager.coinPayout(b.x + b.w / 2, b.y + b.h / 2, amt, 40, 25);
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
  /** Cheapest unlocked, non-maxed upgrade cost on the current farm. */
  function cheapestUpgradeCost() {
    const id = SaveManager.data.currentFarm;
    let min = Infinity;
    for (const k of Upgrades.keys()) {
      if (Upgrades.unlocked(id, k) && !Upgrades.isMaxed(id, k)) min = Math.min(min, Upgrades.cost(id, k));
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
    // a farm still under construction points at its build CTA, not upgrades
    if (!Construction.fenceBuilt(farmScene.farmId)) return;
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
  /**
   * Open the house menu of a construction farm: the build panel while there
   * is still something to build, the upgrade panel once the farm is finished
   * (the house is that farm's single entry point, so it must never open a
   * dead-end "nothing left to build" panel).
   */
  function openBuild(farmId) {
    if (Construction.stage(farmId) === 'max') {
      UI.openPopup({ type: 'upgrades', farmId, fx: {} });
      return;
    }
    UI.openPopup({ type: 'build', farmId, fx: 0 });
  }

  /**
   * A construction step was purchased: the scene re-bakes for the new stage
   * (house, fence footprint + art) and the map redraws its plot.
   */
  function onConstructionBuilt(farmId) {
    if (farmScene && farmScene.farmId === farmId) farmScene.refresh();
    SaveManager.save();
  }

  function onButton(id) {
    if (id === 'settings') {
      UI.openPopup({ type: 'settings' });
    } else if (id === 'upgrade') {
      UI.openPopup({ type: 'upgrades', farmId: SaveManager.data.currentFarm, fx: {} });
    } else if (id === 'map') {
      goToMap();
    }
  }

  function onMapFarmTap(id) {
    if (welcome) return; // welcome-back popup pending/up: claim it first
    AudioManager.play('click');
    if (SaveManager.data.unlocked[id]) {
      // switch farm: load that farm's own animals, upgrades and UFO state
      Idle.tick(); // reconcile so the board matches what accumulated offscreen
      Pigeon.reset(); // pays out any rain still falling, keeps saved perch state
      Tornado.reset();
      SaveManager.data.currentFarm = id;
      SaveManager.save();
      UFO.reset();
      farmScene = new FarmScene(id);
      scene = 'farm';
      collectFarmPending(id);
    } else {
      UI.openPopup({ type: 'unlock', farmId: id });
    }
  }

  // ---------------- unlock flow ----------------
  function tryUnlock(farmId) {
    // construction farms buy the bare land here; everything else is built
    // in-scene (see js/construction.js)
    const cost = Construction.landCost(farmId);
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
    Construction.grantLand(farmId);
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
    // stamp the live farm's clock before it goes background, accrue the rest
    Idle.tick(SaveManager.data.currentFarm);
    scene = 'map';
    mapScene.queuePendingCollect();
  }

  function resetAll() {
    Pigeon.reset(true); // discard any in-flight rain, no payout into the fresh save
    Tornado.reset();
    SaveManager.reset();
    celebration = null;
    upgradeTutorial = null;
    welcome = null;
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

    // welcome-back popup: opens over the map once it has rendered a beat
    // (and never clobbers another popup — it waits for the slot instead)
    if (welcome && !welcome.claimed) {
      welcome.openT -= dt;
      if (welcome.openT <= 0 && !UI.popup) {
        UI.openPopup({ type: 'welcomeBack', rep: welcome.rep });
      }
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
          // reward events wait for a working farm: no tutorial pending and
          // (on construction farms) a fence for the pigeon to perch on
          const paused = !!farmScene.tutorial || !Construction.fenceBuilt(farmScene.farmId);
          farmScene.update(dt); UFO.update(dt);
          Pigeon.update(dt, paused);
          Tornado.update(dt, paused);
        }
      }
    }
    else mapScene.update(dt);
    VFXManager.update(dt);

    // background farms: reconcile elapsed production on a coarse tick
    idleT += dt;
    if (idleT >= CONFIG.IDLE.TICK_INTERVAL) {
      idleT = 0;
      Idle.tick(scene === 'farm' ? SaveManager.data.currentFarm : -1);
      // while watching the map, freshly accrued coins keep flying in
      // (paused while the welcome-back popup is pending/up: that pending
      // balance belongs to the popup's COLLECT, not the ambient sweep)
      if (scene === 'map' && !mapScene.unlockAnim && !welcome) mapScene.queuePendingCollect();
    }

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
    Idle.tick(scene === 'farm' ? SaveManager.data.currentFarm : -1);
    if (farmScene) farmScene.persist();
    SaveManager.save();
  });

  return {
    addCoins, onButton, tryUnlock, onUnlockAnimDone, resetAll,
    openBuild, onConstructionBuilt,
    startCelebration, endCelebration, onUpgradePurchased,
    claimWelcome, onWelcomeAdDone, onWelcomeAdFailed,
    get scene() { return scene; },
    get farm() { return farmScene; },
    get celebrating() { return !!celebration; },
    get upgradeTutorialActive() { return !!upgradeTutorial; },
    dt: 1 / 60,
  };
})();
