/**
 * TornadoManager — reward-ad event layer (Tornado Auto Merge).
 *
 * At most every SPAWN_INTERVAL seconds — and only once the pen is crowded
 * with several merges pending (see offerWorthwhile) — a tornado icon
 * appears on the left side of the screen and stays available for
 * STAY_TIME seconds. Tapping it opens
 * the reward-ad popup; completing the ad sends a large pixel tornado
 * sweeping across the farm. The tornado is pure quality-of-life: it
 * performs exactly the merges the player could make by hand, only much
 * faster. It sweeps the pen collecting every animal that will take part
 * in a merge and leaves everything else grazing untouched; then, once
 * collection is complete, the pooled animals resolve in one cascading
 * pass (2 x level N -> 1 x level N+1, repeated until fewer than 2 remain
 * at every level — e.g. 4 babies -> 2 adults -> 1 elder). Animals are
 * pooled and merged strictly per species, never across species, matching
 * the manual drag-merge rule. Odd leftovers survive unchanged, and
 * max-level Mutants only pair off into UFO aliens on farms where the UFO
 * has already been unlocked — otherwise they are never even collected.
 * The evolved survivors are tossed back onto the farm and the tornado
 * leaves. Ignoring the icon loses the offer until the next cycle.
 *
 * Per-farm state (offer countdown + remaining availability) lives in
 * SaveManager.data.tornado, so every farm runs its own independent event.
 * Only one offer can be active at a time on a farm, and it never appears
 * during the merge tutorial (Game only ticks this manager during normal
 * gameplay). While the tornado is running all farm input is blocked and
 * spawning is paused; normal gameplay resumes the moment it leaves.
 *
 * Balancing values live in CONFIG.TORNADO and can be overridden at
 * runtime through window.RemoteConfig.TORNADO (Remote Config hook).
 */
const Tornado = (() => {
  const C = () => Object.assign({}, CONFIG.TORNADO, (window.RemoteConfig || {}).TORNADO);
  // each farm has its own tornado slot: always operate on the current farm's
  const data = () => SaveManager.data.tornado[SaveManager.data.currentFarm];

  const ICON = { x: 38, y: 132 };  // bottom-anchored icon spot, left side

  let icon = null;   // {t} the offer icon is visible / available
  let run = null;    // active tornado, see start()
  let clockT = 0;    // spin animation clock

  const smooth = t => { t = U.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  /**
   * Reward-ad timing: only offer the tornado at a moment where it saves
   * real manual work — a crowded pen with several merges waiting. The
   * countdown may have long elapsed; the icon then appears the moment the
   * farm actually fills up ("here's a boost if you want it", not a nag).
   * Mutant pairs only count where the UFO is unlocked (they can't merge
   * otherwise, matching the funnel's own rule).
   */
  function offerWorthwhile() {
    const scene = Game.farm;
    if (!scene || scene.tutorial) return false;
    if (scene.animals.length < C().MIN_ANIMALS) return false;
    const top = CONFIG.STAGE_NAMES.length - 1;
    const landed = SaveManager.data.ufo[SaveManager.data.currentFarm].landed;
    const counts = {};
    for (const a of scene.animals) {
      if (a.state === 'merging') continue;
      if (a.stage === top && !landed) continue;
      const k = a.species + ':' + a.stage;
      counts[k] = (counts[k] || 0) + 1;
    }
    let pairs = 0;
    for (const k in counts) pairs += Math.floor(counts[k] / 2);
    return pairs >= C().MIN_PAIRS;
  }

  // ---------------- availability cycle ----------------
  function update(dt, tutorialActive) {
    clockT += dt;
    const d = data();
    if (!C().ENABLED) { icon = null; return; }

    // restore an offer that was left available on this farm
    if (!icon && d.remaining > 0 && !tutorialActive) icon = { t: 0 };

    // offer countdown: one offer at a time, never during the tutorial,
    // and only released once the pen is crowded enough to be worth it
    if (!icon && d.remaining <= 0 && !tutorialActive) {
      d.next -= dt;
      if (d.next <= 0 && offerWorthwhile()) {
        icon = { t: 0 };
        d.remaining = C().STAY_TIME;
        SaveManager.save();
        VFXManager.sparkle(ICON.x, ICON.y - 20, 8, 16);
        AudioManager.play('pop');
      }
    }

    if (icon) {
      // availability countdown (frozen while the reward popup / ad is
      // open, so closing the popup never eats the player's window)
      const p = UI.popup;
      const frozen = p && (p.type === 'tornadoAd' || p.type === 'adPlaying');
      if (!frozen) {
        icon.t += dt;
        d.remaining -= dt;
        if (d.remaining <= 0) {
          // ignored: the opportunity is lost until the next cycle
          d.remaining = 0;
          d.next = C().SPAWN_INTERVAL;
          SaveManager.save();
          icon = null;
        }
      }
    }
  }

  // ---------------- interaction ----------------
  /** Returns true if the tap hit the tornado icon (opens the ad popup). */
  function tap(x, y) {
    if (!icon || run) return false;
    if (U.dist(x, y, ICON.x, ICON.y - 16) > 24) return false;
    AudioManager.play('click');
    UI.openPopup({ type: 'tornadoAd' });
    return true;
  }

  /** Reward panel numbers for the popup. */
  function info() {
    return { adDur: C().AD_DURATION };
  }

  /** The reward ad finished successfully: consume the offer, unleash it. */
  function adCompleted() {
    const d = data();
    d.remaining = 0;
    d.next = C().SPAWN_INTERVAL + C().REWARD_COOLDOWN;
    SaveManager.save();
    if (icon) {
      VFXManager.burst(ICON.x, ICON.y - 16, ['#c8cdd4', '#eef2f6', '#ffe98a'], 12, 90);
      icon = null;
    }
    start();
  }

  // ---------------- active tornado ----------------
  function start() {
    const scene = Game.farm;
    scene.pointerUp(); // settle any in-progress drag defensively
    run = {
      phase: 'enter', t: 0,
      scene,
      x: -40,
      y: scene.bounds.y + scene.bounds.h * 0.55,
      held: [],      // animals spinning inside: {species, stage, angle, r, h, maxH, spin, pull, sx, sy}
      ejected: 0,    // eject-phase counter
      dustT: 0,
    };
    AudioManager.play('wind');
  }

  /**
   * Simulate the full merge cascade over ALL animals (farm + funnel),
   * pooled per species — never across species, matching the manual
   * drag-merge rule. Returns, per species, the set of stages that will
   * see at least one merge: exactly the animals worth collecting. A
   * stage with a single animal only becomes "active" when lower-stage
   * merges will produce it a partner, so untouched singles stay out.
   * Max-level Mutants only pair off where the UFO has been unlocked.
   */
  function mergePlan() {
    const top = CONFIG.STAGE_NAMES.length - 1;
    const landed = SaveManager.data.ufo[run.scene.farmId].landed;
    const pools = {};
    const add = (sp, st) => {
      const c = pools[sp] = pools[sp] || [];
      c[st] = (c[st] || 0) + 1;
    };
    for (const a of run.scene.animals) if (a.state !== 'merging') add(a.species, a.stage);
    for (const h of run.held) add(h.species, h.stage);
    const active = {};
    for (const sp in pools) {
      const counts = pools[sp];
      active[sp] = new Set();
      for (let s = 0; s <= top; s++) {
        const canPair = s < top || landed;
        const pairs = canPair ? Math.floor((counts[s] || 0) / 2) : 0;
        if (pairs > 0) active[sp].add(s);
        if (s < top) counts[s + 1] = (counts[s + 1] || 0) + pairs;
      }
    }
    return active;
  }

  /** Will this animal take part in the cascade? (see mergePlan) */
  function collectible(a, active) {
    return !!active[a.species] && active[a.species].has(a.stage);
  }

  /** Pull one farm animal into the funnel. */
  function capture(a) {
    a.dead = true; // FarmScene.update would splice it, but we run instead
    const i = run.scene.animals.indexOf(a);
    if (i >= 0) run.scene.animals.splice(i, 1);
    run.held.push({
      species: a.species, stage: a.stage,
      angle: U.rand(0, Math.PI * 2),
      r: U.rand(12, 22),
      h: 6, maxH: U.rand(16, 48),
      spin: U.rand(0, 5),
      pull: 0, sx: a.x, sy: a.y,
    });
    VFXManager.dust(a.x, a.y, 5);
    AudioManager.play('flap');
  }

  /**
   * Suck in the collectible animals the sweeping funnel has passed or
   * come close to. Animals that won't merge are left grazing untouched.
   */
  function captureNear() {
    const active = mergePlan();
    for (let i = run.scene.animals.length - 1; i >= 0; i--) {
      const a = run.scene.animals[i];
      if (a.state === 'merging' || !collectible(a, active)) continue;
      if (a.x < run.x + 22 || U.dist(a.x, a.y, run.x, run.y) < 52) capture(a);
    }
  }

  /**
   * Magnet mode (gather phase): pull in every remaining collectible
   * animal regardless of distance, so the pool is complete before the
   * one-shot resolution.
   */
  function captureRemaining() {
    const active = mergePlan();
    for (let i = run.scene.animals.length - 1; i >= 0; i--) {
      const a = run.scene.animals[i];
      if (a.state === 'merging' || !collectible(a, active)) continue;
      capture(a);
    }
  }

  /** Toss one funnel animal back onto a free spot of the pen. */
  function eject(h) {
    const r = run;
    let p = r.scene.randomSpot(), tries = 0;
    while (tries++ < 12 && r.scene.animals.some(a => U.dist(a.x, a.y, p.x, p.y) < 40)) {
      p = r.scene.randomSpot();
    }
    const a = new Animal(h.species, h.stage, p.x, p.y);
    r.scene.animals.push(a);
    VFXManager.dust(p.x, p.y, 6);
    AudioManager.play('pop');
  }

  /**
   * Collection is complete: resolve the whole pool in one cascading pass.
   * Per species (never across species), from the lowest level up:
   * 2 x level N -> 1 x level N+1, newly created animals feeding straight
   * into the next level, until fewer than 2 remain at every level. Odd
   * leftovers survive unchanged. Max-level Mutant pairs become UFO aliens
   * only where the UFO is unlocked; otherwise Mutants pass through as-is.
   * The survivors replace the funnel contents for the eject phase.
   */
  function resolvePool() {
    const r = run;
    const top = CONFIG.STAGE_NAMES.length - 1;
    const landed = SaveManager.data.ufo[r.scene.farmId].landed;
    const pools = {};
    for (const h of r.held) {
      const c = pools[h.species] = pools[h.species] || [];
      c[h.stage] = (c[h.stage] || 0) + 1;
    }
    const survivors = [];
    let aliens = 0, ty = r.y - 70;
    for (const sp in pools) {
      const counts = pools[sp];
      for (let s = 0; s <= top; s++) {
        let c = counts[s] || 0;
        if (s < top) {
          const pairs = Math.floor(c / 2);
          if (pairs > 0) {
            counts[s + 1] = (counts[s + 1] || 0) + pairs;
            c -= pairs * 2;
            // discoveries still count (no celebration mid-storm)
            Discovery.mark(sp, s + 1);
            VFXManager.floatText(r.x, ty, pairs + 'X ' + CONFIG.STAGE_NAMES[s + 1] + '!');
            ty -= 14;
          }
        } else if (landed) {
          const pairs = Math.floor(c / 2);
          c -= pairs * 2;
          aliens += pairs;
        }
        // odd leftovers and unmergeable max-level animals survive as-is
        for (let i = 0; i < c; i++) survivors.push({ species: sp, stage: s });
      }
    }
    // one big satisfying blast as everything evolves at once
    AudioManager.play('merge');
    VFXManager.burst(r.x, r.y - 44, ['#ffe98a', '#f4c437', '#fff6d0', '#ffffff'], 26, 130);
    VFXManager.sparkle(r.x, r.y - 50, 16, 26);
    if (aliens > 0) {
      VFXManager.burst(r.x, r.y - 44, ['#7de87a', '#c4ffb8', '#a07cc0'], 14, 110);
      VFXManager.floatText(r.x, ty, aliens + 'X ALIEN!', '#c4ffb8');
      for (let i = 0; i < aliens; i++) UFO.collect(r.x + U.rand(-10, 10), r.y - 40);
    }
    // survivors keep spinning in the funnel until ejected one by one
    r.held = survivors.map(v => ({
      species: v.species, stage: v.stage,
      angle: U.rand(0, Math.PI * 2), r: U.rand(12, 22),
      h: U.rand(16, 40), maxH: U.rand(16, 48),
      spin: U.rand(0, 5), pull: 1, sx: r.x, sy: r.y,
    }));
  }

  /** Main tick while the tornado is on the farm (gameplay is paused). */
  function updateRun(dt) {
    const r = run, cfg = C();
    const speed = Math.max(0.2, cfg.TRAVEL_SPEED);
    clockT += dt;
    r.t += dt;

    // animals spiral around the funnel, rising as they get pulled in
    for (const h of r.held) {
      h.angle += dt * (7 + h.spin);
      if (h.pull < 1) h.pull = Math.min(1, h.pull + dt / 0.3);
      h.h = Math.min(h.maxH, h.h + dt * 40);
    }

    // constant dust, leaves and debris kicked up around the base
    r.dustT -= dt;
    if (r.dustT <= 0) {
      r.dustT = 0.07;
      VFXManager.dust(r.x + U.rand(-16, 16), r.y + U.rand(-2, 4), 2);
      if (Math.random() < 0.45) {
        VFXManager.burst(r.x + U.rand(-12, 12), r.y - U.rand(6, 56),
          ['#5e9c31', '#7dbb4a', '#c8b088', '#b09a72'], 2, 55);
      }
    }

    // untouched animals keep wandering and poops keep ripening while the
    // storm works (only spawning and player input are paused)
    for (let i = r.scene.animals.length - 1; i >= 0; i--) {
      const a = r.scene.animals[i];
      a.update(dt, r.scene.bounds, r.scene);
      if (a.dead) r.scene.animals.splice(i, 1);
    }
    r.scene.updatePoops(dt);

    if (r.phase === 'enter') {
      // roll in from the left edge
      const t = smooth(r.t / (0.7 / speed));
      r.x = U.lerp(-40, r.scene.bounds.x + 8, t);
      if (t >= 1) { r.phase = 'sweep'; r.t = 0; }
    } else if (r.phase === 'sweep') {
      // weave across the whole pen, collecting every animal that will
      // take part in the cascade — no merging yet, collection only
      const B = r.scene.bounds;
      const t = Math.min(r.t / (2.6 / speed), 1);
      r.x = U.lerp(B.x + 8, B.x + B.w - 8, t);
      r.y = B.y + B.h * 0.55 + Math.sin(t * Math.PI * 2.2) * B.h * 0.28;
      captureNear();
      if (t >= 1) { r.phase = 'gather'; r.t = 0; }
    } else if (r.phase === 'gather') {
      // drift to the pen center, magnet-pull any collectible stragglers,
      // then — with the pool complete — resolve every merge at once
      const B = r.scene.bounds;
      r.x = U.lerp(r.x, B.x + B.w / 2, Math.min(1, dt * 2.5));
      r.y = U.lerp(r.y, B.y + B.h * 0.5, Math.min(1, dt * 2.5));
      captureRemaining();
      if (r.t >= 0.5 / speed) {
        resolvePool();
        r.phase = 'eject'; r.t = 0; r.ejected = 0;
      }
    } else if (r.phase === 'eject') {
      // toss the evolved survivors back out, one animal at a time
      while (r.held.length && r.t >= r.ejected * C().MERGE_INTERVAL) {
        eject(r.held.shift());
        r.ejected++;
      }
      if (!r.held.length) {
        r.scene.persist();
        r.phase = 'exit'; r.t = 0; r.exitX = r.x;
        AudioManager.play('wind');
      }
    } else if (r.phase === 'exit') {
      // spin away past the right edge; normal gameplay resumes right after
      const t = r.t / (0.8 / speed);
      r.x = U.lerp(r.exitX, CONFIG.VIEW_W + 50, t * t);
      if (t >= 1) { run = null; }
    }
  }

  // ---------------- draw ----------------
  function drawIcon(ctx) {
    const t = icon.t;
    const bob = Math.sin(t * 3) * 1.5;
    // pulsing golden ring so the offer reads as tappable
    const pulse = (Math.sin(t * 5) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = 0.35 + pulse * 0.3;
    ctx.strokeStyle = '#ffe98a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ICON.x, ICON.y - 16, 20 + pulse * 2, 0, 7); ctx.stroke();
    ctx.restore();
    const frame = Math.floor(clockT * 10) % 3;
    PIXEL.blit(ctx, SPRITES.tornado(frame), ICON.x, ICON.y + bob, 1.2);
    // golden "!" bubble, matching the pigeon offer style
    const by = ICON.y - 44 + Math.sin(t * 5) * 2;
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.beginPath(); ctx.arc(ICON.x, by, 8, 0, 7); ctx.fill();
    ctx.fillStyle = SPRITES.P.gold;
    ctx.beginPath(); ctx.arc(ICON.x, by, 6, 0, 7); ctx.fill();
    ctx.fillStyle = SPRITES.P.goldHi;
    ctx.beginPath(); ctx.arc(ICON.x - 1, by - 1, 4, 0, 7); ctx.fill();
    ctx.fillStyle = SPRITES.P.gold;
    ctx.beginPath(); ctx.arc(ICON.x, by + 1, 4, 0, 7); ctx.fill();
    UI.drawText(ctx, '!', ICON.x, by - 5, UI.SIZE.BODY, '#5c3a1d', 'center');
    // remaining availability bar under the icon
    const frac = U.clamp(data().remaining / C().STAY_TIME, 0, 1);
    ctx.fillStyle = PIXEL.OUTLINE; ctx.fillRect(ICON.x - 14, ICON.y + 5, 28, 5);
    ctx.fillStyle = '#3a2817';     ctx.fillRect(ICON.x - 13, ICON.y + 6, 26, 3);
    ctx.fillStyle = '#ffe98a';     ctx.fillRect(ICON.x - 13, ICON.y + 6, Math.round(26 * frac), 3);
  }

  function drawRun(ctx) {
    const r = run;
    // ground shadow
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#1c2b12';
    ctx.beginPath(); ctx.ellipse(r.x, r.y + 5, 26, 7, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;

    // orbit position of a held animal (pull-in lerps from its old spot)
    const pos = h => {
      const ox = r.x + Math.cos(h.angle) * h.r;
      const oy = r.y - h.h + Math.sin(h.angle) * h.r * 0.35;
      const e = smooth(h.pull);
      return { x: U.lerp(h.sx, ox, e), y: U.lerp(h.sy, oy, e) };
    };
    const back = r.held.filter(h => Math.sin(h.angle) < 0);
    const front = r.held.filter(h => Math.sin(h.angle) >= 0);
    const drawHeld = h => {
      const p = pos(h);
      const img = SPRITES.animal(h.species, h.stage, 'idle', false);
      PIXEL.blit(ctx, img, p.x, p.y, 1.25, Math.cos(h.angle) < 0);
    };
    // behind the funnel, then the funnel, then the front arc
    for (const h of back) drawHeld(h);
    const frame = Math.floor(clockT * 14) % 3;
    const wob = Math.sin(clockT * 9) * 2;
    PIXEL.blit(ctx, SPRITES.tornado(frame), r.x + wob, r.y + 6, 2.2, false, 1, 1 + Math.sin(clockT * 13) * 0.05);
    for (const h of front) drawHeld(h);
  }

  function draw(ctx) {
    if (icon && !run) drawIcon(ctx);
    if (run) drawRun(ctx);
  }

  /**
   * Animals currently held inside the funnel, as save-format entries.
   * FarmScene.persist appends this so an autosave / reload mid-tornado
   * can never lose the herd (they come back unmerged, nothing worse).
   */
  function heldSnapshot(farmId) {
    if (!run || run.scene.farmId !== farmId) return [];
    return run.held.map(h => ({ stage: h.stage }));
  }

  /** Clear transient animation state (farm switch / full reset). */
  function reset() { icon = null; run = null; }

  return {
    update, updateRun, draw, tap, adCompleted, info, heldSnapshot, reset,
    get active() { return !!run; },
  };
})();
