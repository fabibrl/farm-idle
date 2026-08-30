/**
 * Crate — the parachute surprise box (Farm 1 for now, see CONFIG.CRATE).
 *
 * Every COOLDOWN seconds a wooden crate drifts down under a parachute and
 * lands on a free slot inside the pen. It rests there with a gentle idle
 * animation and NEVER expires: the offer is only consumed when the player
 * taps it, which opens the reveal popup (UI 'crateReveal'). From there they
 * either COLLECT the animal inside, or watch a rewarded ad to get the next
 * evolution up instead. Dismissing the popup leaves the crate on the ground,
 * still tappable — the reward can't be lost by accident.
 *
 * What's inside is rolled once, when the crate spawns, and persisted, so the
 * reveal shows the same animal across a reopen or a relaunch. The pool comes
 * from the farm's own chain via CONFIG.cratePool (a rule, not a list: the
 * first entry and the last two are excluded), filtered down to stages the
 * player has already discovered so the box never spoils an unseen animal.
 * Because the top two chain entries are excluded, the ad upgrade — always
 * roll + 1 — can never produce the chain's final form.
 *
 * Per-farm state lives in SaveManager.data.crate: the cooldown, whether a
 * crate is currently resting in the pen, the stage rolled inside it, and a
 * granted animal still waiting for a free slot. The cooldown only runs while
 * there is nothing waiting for the player (no crate on the ground, no
 * pending animal), so an ignored crate never queues up a second one; it
 * keeps running while the game is closed, through Idle.reconcile, under the
 * same offline cap as every other system.
 *
 * Balancing values live in CONFIG.CRATE and can be overridden at runtime
 * through window.RemoteConfig.CRATE (Remote Config hook).
 */
const Crate = (() => {
  const C = () => Object.assign({}, CONFIG.CRATE, (window.RemoteConfig || {}).CRATE);
  const data = (id = SaveManager.data.currentFarm) => SaveManager.data.crate[id];
  const speciesOf = id => CONFIG.FARMS[id].species;

  /** Does this farm run the surprise box at all? (per-farm opt-in) */
  function enabledFor(farmId) {
    const cfg = C();
    return !!cfg.ENABLED && !!(cfg.ENABLED_FARMS || [])[farmId];
  }

  /**
   * Is the feature live on this farm yet? It stays completely dormant — no
   * crates, no cooldown, nothing shown anywhere — until the player has
   * discovered that farm's ENTIRE chain, the final abducted form included.
   * The box is an end-of-collection reward, so before that point it does not
   * exist as far as the rest of the game is concerned.
   *
   * Completion is latched into the save the first time it is seen, so the
   * feature can never switch itself back off. The latch frame deliberately
   * returns false and (re)starts the cooldown from that moment: the first
   * crate arrives one full cooldown after the collection is finished, and
   * offline time from before the unlock can't be spent on it.
   */
  function unlocked(farmId) {
    if (!enabledFor(farmId)) return false;
    const d = SaveManager.data;
    if (d.crateUnlocked[farmId]) return true;
    if (!Discovery.chainComplete(farmId)) return false;
    d.crateUnlocked[farmId] = true;
    data(farmId).next = C().COOLDOWN;
    SaveManager.save();
    return false;
  }

  /** Pure read of that latch, for draw paths that must not mutate state. */
  function isLive(farmId) {
    return enabledFor(farmId) && !!SaveManager.data.crateUnlocked[farmId];
  }

  let box = null;        // {state:'drop'|'land'|'idle', t, x, y, fromY, groundY, sway, chute, sparkleT}
  let opening = null;    // in-scene opening sequence, see startOpening()
  let retryT = 0;        // seconds until the next landing-spot attempt while the pen is full
  let claiming = false;  // re-entrancy guard around a grant

  // ---------------- contents ----------------
  /**
   * The stages this farm's box may contain: simply the chain's eligible pool
   * (CONFIG.cratePool — the chain minus its first entry and its last two).
   * No discovery filter is needed on top of that: the feature only runs once
   * the whole chain has been discovered (see `unlocked`), so every entry in
   * the pool is by definition an animal the player has already seen.
   */
  function pool(farmId) {
    return CONFIG.cratePool(speciesOf(farmId));
  }

  /**
   * Weighted pick from that pool. WEIGHTS maps onto the chain's eligible
   * entries lowest-tier-first (so weights stay meaningful whichever stages
   * are currently discovered); a pool longer than the list reuses its last
   * weight. Returns -1 when nothing is eligible yet.
   */
  function roll(farmId) {
    const avail = pool(farmId);
    if (!avail.length) return -1;
    const w = C().WEIGHTS || [];
    const base = CONFIG.cratePool(speciesOf(farmId));
    const weightOf = stage => {
      const i = base.indexOf(stage);
      return (w.length ? (w[i] !== undefined ? w[i] : w[w.length - 1]) : 1) || 0;
    };
    const total = avail.reduce((a, s) => a + weightOf(s), 0);
    if (total <= 0) return U.pick(avail);
    let r = Math.random() * total;
    for (const s of avail) {
      r -= weightOf(s);
      if (r <= 0) return s;
    }
    return avail[avail.length - 1];
  }

  /** The stage a rewarded ad upgrades a roll to — never past the top board stage. */
  function upgradeOf(farmId, stage) {
    return Math.min(stage + 1, CONFIG.topStage(speciesOf(farmId)));
  }

  // ---------------- spawning ----------------
  /**
   * A landing spot inside the pen that is clear of every animal — a crate
   * must never come down on top of one, or outside the fence. Returns null
   * when the board is too crowded to find one (the drop is then delayed).
   */
  function landingSpot(scene) {
    const b = scene.bounds, clear = C().CLEAR_RADIUS;
    for (let i = 0; i < 24; i++) {
      const p = {
        x: U.rand(b.x + 12, b.x + b.w - 12),
        y: U.rand(b.y + 14, b.y + b.h - 6),
      };
      if (!scene.animals.some(a => U.dist(a.x, a.y, p.x, p.y) < clear)) return p;
    }
    return null;
  }

  /** Is there physically room for the crate's animal once it is opened? */
  function penHasRoom(farmId) {
    const scene = Game.farm;
    if (!scene || scene.farmId !== farmId) return false;
    return scene.animals.length < Construction.capacity(farmId);
  }

  /**
   * Try to start a drop. Fails (and is retried on RETRY_INTERVAL) while the
   * pen is full or too crowded for a clear landing slot — the cooldown has
   * already elapsed, so the crate arrives the moment a slot opens up.
   */
  function trySpawn(farmId) {
    const scene = Game.farm;
    if (!scene || scene.farmId !== farmId) return false;
    if (!penHasRoom(farmId)) return false;
    const stage = roll(farmId);
    if (stage < 0) return false;          // nothing discovered in the pool yet
    const p = landingSpot(scene);
    if (!p) return false;
    const d = data(farmId);
    d.active = 1;
    d.stage = stage;
    SaveManager.save();
    open(p, false);
    return true;
  }

  /** Build the in-scene crate. `restore` skips the descent (reload / re-entry). */
  function open(p, restore) {
    box = {
      state: restore ? 'idle' : 'drop', t: 0,
      x: p.x, y: restore ? p.y : -24,
      groundY: p.y,
      sway: U.rand(0, Math.PI * 2),
      swayDir: Math.random() < 0.5 ? 1 : -1,
      chute: restore ? 0 : 1,
      sparkleT: 1.0,
    };
    if (!restore) AudioManager.play('flap');
  }

  // ---------------- update ----------------
  function update(dt, paused) {
    const id = SaveManager.data.currentFarm;
    if (!unlocked(id)) return;
    const d = data(id);

    // the opening sequence owns its reward until it lands
    if (opening) { updateOpening(dt); return; }

    // a granted animal that had nowhere to go takes the first free slot
    if (d.pending >= 0) placePending(id);

    if (!box) {
      if (paused) return;
      retryT -= dt;
      if (d.active) {
        // a crate was left resting here: put it back on a clear slot
        if (retryT > 0) return;
        const scene = Game.farm;
        const p = scene ? landingSpot(scene) : null;
        if (p) open(p, true);
        else retryT = C().RETRY_INTERVAL;
        return;
      }
      // the cooldown only runs while nothing is already waiting for the
      // player — an ignored crate must never accumulate a queue
      if (d.pending >= 0) return;
      d.next -= dt;
      if (d.next > 0 || retryT > 0) return;
      if (!trySpawn(id)) retryT = C().RETRY_INTERVAL;
      return;
    }
    // the saved offer went away underneath the animation (a reset, a farm
    // rebuilt beneath us): drop the orphan rather than leave a crate on the
    // ground that no longer has anything to give
    if (!d.active || d.stage < 0) { box = null; return; }
    updateBox(dt);
  }

  function updateBox(dt) {
    const cfg = C(), b = box;
    b.t += dt;
    if (b.state === 'drop') {
      const t = U.clamp(b.t / cfg.DROP_TIME, 0, 1);
      b.y = U.lerp(-24, b.groundY, t);
      // the crate swings under the canopy the whole way down
      b.sway += dt * 1.6;
      if (t >= 1) {
        b.state = 'land'; b.t = 0;
        b.y = b.groundY;
        VFXManager.dust(b.x, b.y, 8);
        AudioManager.play('pop');
      }
    } else if (b.state === 'land') {
      b.chute = Math.max(0, 1 - b.t / cfg.CHUTE_FADE);
      if (b.t >= cfg.BOUNCE_TIME && b.chute <= 0) { b.state = 'idle'; b.t = 0; }
    } else {
      // resting: gentle bob + the occasional attention sparkle
      b.sparkleT -= dt;
      if (b.sparkleT <= 0) {
        b.sparkleT = cfg.SPARKLE_RATE;
        VFXManager.sparkle(b.x, b.y - 14, 5, 12);
      }
    }
  }

  /** Horizontal drift under the canopy (drop phase only). */
  function swayX() {
    return box.state === 'drop'
      ? Math.sin(box.sway) * C().DROP_SWAY * box.swayDir * (1 - box.t / C().DROP_TIME)
      : 0;
  }

  /**
   * Background/offline cooldown, driven by Idle.reconcile with its already
   * capped elapsed window (CONFIG.IDLE.OFFLINE_CAP_HOURS) — so time away
   * counts toward the next crate exactly like every other system, and never
   * more than the cap. A crate already on the ground or a reward already
   * waiting for a slot freezes the timer, so nothing queues up.
   */
  function offlineTick(farmId, elapsed) {
    if (!unlocked(farmId)) return;
    const d = data(farmId);
    if (d.active || d.pending >= 0) return;
    d.next = Math.max(0, d.next - elapsed);
  }

  // ---------------- interaction ----------------
  /** Returns true if the tap hit the resting crate (opens the reveal popup). */
  function tap(x, y) {
    if (!box || box.state === 'drop') return false;
    const d = data();
    if (d.stage < 0) return false;
    if (U.dist(x, y, box.x, box.y - 12) > C().TAP_RADIUS) return false;
    AudioManager.play('click');
    const id = SaveManager.data.currentFarm;
    // only the animal that was found is passed in — what EVOLVE turns it
    // into is deliberately not available to the popup, so it cannot be
    // previewed there; the upgrade is resolved by claim() after the ad
    UI.openPopup({
      type: 'crateReveal', farmId: id, stage: d.stage,
      fxT: 0, sparks: [], adLoading: false,
      origin: { x: box.x, y: box.y - 12 },
    });
    return true;
  }

  /**
   * Reveal-popup numbers. Deliberately does NOT expose the upgraded stage:
   * what the ad pays out is only revealed once it has been watched.
   */
  function info() {
    const id = SaveManager.data.currentFarm;
    return { species: speciesOf(id), stage: data(id).stage, adDur: C().AD_DURATION };
  }

  // ---------------- claiming ----------------
  /**
   * Take the reward. `upgraded` grants the next evolution (rewarded ad),
   * otherwise the animal as rolled.
   *
   * Idempotent by construction: the crate's `active` flag is cleared before
   * anything is granted, so a second call — a double tap, a stray ad
   * callback firing after a manual collect — is a no-op and one ad view can
   * never be claimed twice.
   */
  function claim(upgraded) {
    const id = SaveManager.data.currentFarm;
    const d = data(id);
    if (claiming || !d.active || d.stage < 0) return;
    claiming = true;
    try {
      const stage = upgraded ? upgradeOf(id, d.stage) : d.stage;
      // Consume the offer first: from here the reward is owed exactly once.
      // It is parked in `pending` — the same persisted slot a reward waiting
      // for space uses — for the whole opening sequence, so a crash or a
      // kill mid-animation can never swallow it; finishOpening clears it
      // once the animal is actually standing in the pen.
      d.active = 0;
      d.stage = -1;
      d.pending = stage;
      // the cooldown starts on COLLECTION, not on the spawn
      d.next = C().COOLDOWN;
      SaveManager.save();
      const at = box ? { x: box.x, y: box.y } : null;
      box = null;
      retryT = 0;
      startOpening(id, stage, upgraded, at);
    } finally {
      claiming = false;
    }
  }

  // ---------------- in-scene opening sequence ----------------
  /**
   * The payoff, played in the pen rather than in a popup: the crate bursts
   * open where it stood and the animal hops out of it, landing in the slot
   * that was reserved for it before any of this started.
   *
   * Non-blocking on purpose — the farm keeps updating and the player keeps
   * dragging and merging while it runs. The animal only becomes a real
   * Animal at the end (finishOpening); until then it is a drawing, so it
   * can't be picked up half-emerged.
   */
  function startOpening(farmId, stage, evolved, at) {
    const scene = Game.farm;
    const p = at || (scene && scene.farmId === farmId ? landingSpot(scene) : null);
    if (!scene || scene.farmId !== farmId || !p) {
      // nowhere to play it (left the farm mid-ad): grant it straight away
      finishOpening(farmId, stage, p);
      return;
    }
    // hold the slot for the whole animation: spawns can't take it now
    scene.reserveSlot();
    const cfg = C().OPEN;
    opening = {
      farmId, stage, evolved, t: 0,
      x: p.x, y: p.y,
      dur: evolved ? cfg.EVOLVE_DURATION : cfg.DURATION,
      popped: false, landed: false,
    };
    AudioManager.play('unlock');
  }

  function updateOpening(dt) {
    const o = opening, cfg = C().OPEN;
    o.t += dt;
    // the lid lets go: light burst, dust at the base, particles
    if (!o.popped && o.t >= cfg.POP) {
      o.popped = true;
      const cols = o.evolved
        ? ['#ffffff', '#fff6d0', '#ffe98a', '#7de87a', '#c4ffb8']
        : ['#ffe98a', '#f4c437', '#fff6d0', '#ffffff'];
      VFXManager.burst(o.x, o.y - 14, cols, o.evolved ? 26 : 18, o.evolved ? 140 : 110);
      VFXManager.sparkle(o.x, o.y - 18, o.evolved ? 12 : 8, 18);
      VFXManager.dust(o.x, o.y, 8);
      AudioManager.play('pop');
    }
    // touchdown: squash-and-stretch bounce, plus an energy flourish on an
    // evolved arrival (this landing is the reveal, so it gets extra weight)
    if (!o.landed && o.t >= cfg.LAND) {
      o.landed = true;
      VFXManager.dust(o.x, o.y, 7);
      if (o.evolved) {
        VFXManager.sparkle(o.x, o.y - 16, 14, 22);
        VFXManager.burst(o.x, o.y - 12, ['#c4ffb8', '#7de87a', '#fff6d0', '#ffffff'], 14, 90);
        AudioManager.play('merge');
      }
    }
    if (o.t >= o.dur) {
      const { farmId, stage } = o;
      const at = { x: o.x, y: o.y };
      endOpening();
      finishOpening(farmId, stage, at);
    }
  }

  /** Drop the sequence and give its reserved slot back. */
  function endOpening() {
    const scene = Game.farm;
    if (opening && scene && scene.farmId === opening.farmId) scene.releaseSlot();
    opening = null;
  }

  /**
   * The animal arrives for real. On success the persisted `pending` marker
   * is cleared; if the pen somehow has no room after all (the farm changed
   * underneath the animation) the marker stays and the waiting indicator
   * takes over, so the reward is still never lost.
   */
  function finishOpening(farmId, stage, at) {
    if (place(farmId, stage, at, true)) {
      data(farmId).pending = -1;
      SaveManager.save();
      return;
    }
    UI.showToast('PEN FULL - ANIMAL IS WAITING!');
  }

  /** The rewarded ad completed: the player gets the next evolution up. */
  function adCompleted() { claim(true); }

  /**
   * The rewarded ad failed, was unavailable, or was skipped. An ad problem
   * must never cost the player the reward: the base animal is granted with a
   * short non-blocking note. A real ad SDK should call this from its
   * failure/skip callbacks (the built-in simulated ad always completes).
   */
  function adFailed() {
    UI.showToast('AD NOT AVAILABLE - ANIMAL COLLECTED!');
    claim(false);
  }

  /**
   * Spawn the reward, or return false when the pen has no room for it.
   * `quiet` skips the arrival flourish: the opening sequence has just played
   * its own landing effects on this exact spot and must not double them up.
   */
  function place(farmId, stage, at, quiet = false) {
    const scene = Game.farm;
    if (!scene || scene.farmId !== farmId) return false;
    const sp = speciesOf(farmId);
    // a stage the player has never seen (an ad upgrade past their best) is a
    // real first-time evolution and earns the full discovery celebration
    const fresh = !Discovery.isDiscovered(sp, stage);
    const a = scene.spawnAnimal(stage, false, at);
    if (!a) return false;
    if (!quiet) {
      VFXManager.burst(a.x, a.y - 12, ['#ffe98a', '#f4c437', '#fff6d0'], 14, 100);
      VFXManager.sparkle(a.x, a.y - 16, 8, 16);
      AudioManager.play('pop');
    }
    if (fresh) Game.startCelebration(a, a.x, a.y);
    return true;
  }

  /** A held reward waits for a slot; the indicator stays up until it lands. */
  function placePending(farmId) {
    const d = data(farmId);
    if (!penHasRoom(farmId)) return;
    const stage = d.pending;
    d.pending = -1;
    SaveManager.save();
    place(farmId, stage, null);
  }

  // ---------------- draw ----------------
  function draw(ctx) {
    const id = SaveManager.data.currentFarm;
    if (!isLive(id)) return;
    if (box) drawBox(ctx);
    if (opening) drawOpening(ctx);
    // the badge means "waiting for space" — an arrival that is mid-animation
    // already has its slot, so it must never show one
    else drawPendingBadge(ctx, id);
  }

  /**
   * The opening sequence: the crate splits open and shrinks away while the
   * animal arcs out of it and lands with a squash-and-stretch bounce. Drawn
   * with the same blit scale and ground shadow the real animals use, so the
   * hand-off at the end is invisible.
   */
  function drawOpening(ctx) {
    const o = opening, cfg = C().OPEN;
    const t = o.t;

    // --- the crate: anticipation squash, then blown open and shrinking away
    const crateA = t < cfg.POP ? 1 : U.clamp(1 - (t - cfg.POP) / cfg.CRATE_FADE, 0, 1);
    if (crateA > 0) {
      const anticip = t < cfg.POP ? 1 - Math.sin((t / cfg.POP) * Math.PI) * 0.16 : 1;
      ctx.globalAlpha = crateA;
      PIXEL.blit(ctx, SPRITES.giftCrate(t >= cfg.POP), o.x, o.y, 2,
                 false, anticip * crateA, (2 - anticip) * (0.6 + crateA * 0.4));
      if (t >= cfg.POP) {
        // the lid tumbling up and off to the side
        const lt = t - cfg.POP;
        ctx.save();
        ctx.translate(o.x + lt * 46, o.y - 30 - lt * 150 + lt * lt * 240);
        ctx.rotate(lt * 8);
        PIXEL.blit(ctx, SPRITES.crateLid(), 0, 0, 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // --- burst of light out of the open crate, brighter for an evolution
    if (t >= cfg.POP) {
      const bt = U.clamp((t - cfg.POP) / (cfg.LAND - cfg.POP), 0, 1);
      ctx.globalAlpha = (o.evolved ? 0.55 : 0.34) * (1 - bt) * (1 - bt);
      ctx.fillStyle = o.evolved ? '#e8ffdd' : '#fff6d0';
      ctx.beginPath();
      ctx.arc(o.x, o.y - 14, 18 + bt * (o.evolved ? 60 : 42), 0, 7);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // --- expanding energy ring on an evolved landing (this IS the reveal)
    if (o.evolved && o.landed) {
      const rt = U.clamp((t - cfg.LAND) / cfg.EVOLVE_RING, 0, 1);
      if (rt < 1) {
        ctx.globalAlpha = (1 - rt) * 0.75;
        ctx.strokeStyle = '#c4ffb8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(o.x, o.y, 8 + rt * 46, (8 + rt * 46) * 0.45, 0, 0, 7);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // --- the animal, arcing out of the crate and settling where it lands
    const at = U.clamp((t - cfg.EMERGE) / (cfg.LAND - cfg.EMERGE), 0, 1);
    if (at <= 0) return;
    const img = SPRITES.animal(speciesOf(o.farmId), o.stage, 'idle', false);
    // ballistic arc up and back down to the ground
    const hop = at < 1 ? Math.sin(at * Math.PI) * cfg.HOP_H : 0;
    // squash-and-stretch: stretched while flying, squashed on impact, settled
    let sx = 1, sy = 1;
    if (at < 1) {
      const stretch = Math.abs(Math.cos(at * Math.PI)) * 0.14;
      sx = 1 - stretch; sy = 1 + stretch;
    } else {
      const bt = U.clamp((t - cfg.LAND) / cfg.BOUNCE, 0, 1);
      const s = Math.sin(bt * Math.PI * 2) * (1 - bt) * 0.26;
      sx = 1 + s; sy = 1 - s;
    }
    const pop = Math.min(1, U.easeOutBack(U.clamp(at * 2.2, 0, 1)));
    // ground shadow, matching Animal.draw's
    const airborne = U.clamp(1 - hop / cfg.HOP_H, 0.45, 1);
    ctx.globalAlpha = 0.28 * airborne;
    ctx.fillStyle = '#1c2b12';
    ctx.beginPath();
    ctx.ellipse(o.x, o.y + 2, img.width * CONFIG.ANIMAL_VISUAL_SCALE * 0.3 * airborne, 4 * airborne, 0, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
    PIXEL.blit(ctx, img, o.x, o.y - hop, CONFIG.ANIMAL_VISUAL_SCALE * pop, false, sy, sx);
  }

  function drawBox(ctx) {
    const b = box, cfg = C();
    const x = b.x + swayX();

    // ground shadow, tightening as the crate comes down
    if (b.state === 'drop') {
      const near = U.clamp(1 - (b.groundY - b.y) / 320, 0.15, 1);
      ctx.globalAlpha = 0.22 * near;
      ctx.fillStyle = '#1c2b12';
      ctx.beginPath(); ctx.ellipse(b.x, b.groundY + 2, 10 * near + 3, 4 * near + 1, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // landing squash, then a gentle idle bob so it reads as interactive
    let squashY = 1, squashX = 1, bob = 0;
    if (b.state === 'land' && b.t < cfg.BOUNCE_TIME) {
      const t = b.t / cfg.BOUNCE_TIME;
      const s = Math.sin(t * Math.PI * 2) * (1 - t) * 0.22;
      squashY = 1 - s; squashX = 1 + s;
    } else if (b.state === 'idle') {
      bob = Math.sin(b.t * 2.4) * 1.2;
    }

    // parachute above, with its cords, while it is still inflated
    if (b.chute > 0) {
      const img = SPRITES.parachute();
      const cy = b.y - 44;
      ctx.globalAlpha = b.chute;
      const collapse = b.state === 'land' ? 0.4 + b.chute * 0.6 : 1;
      PIXEL.blit(ctx, img, x, cy, 2, false, collapse, collapse);
      ctx.strokeStyle = '#e8d8b4';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const dx of [-15, -5, 5, 15]) {
        ctx.moveTo(Math.round(x + dx * collapse), Math.round(cy - 2));
        ctx.lineTo(Math.round(b.x + (dx > 0 ? 7 : -7)), Math.round(b.y - 18));
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // the crate itself
    PIXEL.blit(ctx, SPRITES.giftCrate(false), x, b.y + bob, 2, false, squashY, squashX);

    // golden "!" bubble while it rests, matching the pigeon's tappable cue
    if (b.state === 'idle') {
      const pulse = Math.sin(b.t * 5) * 2;
      const by = b.y - 46 + pulse;
      ctx.fillStyle = PIXEL.OUTLINE;
      ctx.beginPath(); ctx.arc(b.x, by, 8, 0, 7); ctx.fill();
      ctx.fillStyle = SPRITES.P.gold;
      ctx.beginPath(); ctx.arc(b.x, by, 6, 0, 7); ctx.fill();
      ctx.fillStyle = SPRITES.P.goldHi;
      ctx.beginPath(); ctx.arc(b.x - 1, by - 1, 4, 0, 7); ctx.fill();
      ctx.fillStyle = SPRITES.P.gold;
      ctx.beginPath(); ctx.arc(b.x, by + 1, 4, 0, 7); ctx.fill();
      UI.drawText(ctx, '!', b.x, by - 5, UI.SIZE.BODY, '#5c3a1d', 'center');
    }
  }

  /**
   * A reward that couldn't be placed yet: a small chip in the corner of the
   * pen showing the animal that is waiting, so the player can see the reward
   * is held rather than lost.
   */
  function drawPendingBadge(ctx, farmId) {
    const stage = data(farmId).pending;
    if (stage < 0) return;
    const R = ENVIRONMENT.playRect(farmId);
    const x = R.x + 42, y = R.y + 46;
    const t = performance.now() / 1000;
    ctx.globalAlpha = 0.85 + Math.sin(t * 4) * 0.15;
    UI.woodPanel(ctx, x - 27, y - 25, 54, 50, { gold: true, flecks: false, seams: false });
    ctx.globalAlpha = 1;
    const img = SPRITES.animal(speciesOf(farmId), stage, 'idle', false);
    PIXEL.blit(ctx, img, x, y + 9, Math.min(1.5, 30 / img.height));
    UI.drawText(ctx, 'PEN FULL', x, y + 13, 4.5, '#ffe98a', 'center', false, false, 48);
  }

  /**
   * Clear transient animation state (farm switch / reset). The crate itself
   * is saved state, so a crate left resting is rebuilt on return; nothing is
   * paid out or lost here.
   */
  function reset() {
    // an opening caught mid-flight resolves instantly rather than being
    // thrown away: the animal lands right now, on the farm it belongs to,
    // and the persisted `pending` marker covers it if that farm is gone
    if (opening) {
      const { farmId, stage, x, y } = opening;
      endOpening();
      finishOpening(farmId, stage, { x, y });
    }
    box = null; retryT = 0; claiming = false;
  }

  return { update, draw, tap, info, claim, adCompleted, adFailed, reset,
           offlineTick, enabledFor, isLive };
})();
