/**
 * PigeonManager — reward-ad event layer (Pigeon & Poop Rain).
 *
 * Every SPAWN_INTERVAL seconds a pigeon flies across the screen and lands
 * on the back fence of the current farm, where it perches for STAY_TIME
 * seconds playing idle animations (blinking, looking around, the odd wing
 * flap). Tapping it opens the reward-ad popup; completing the ad removes
 * the pigeon and triggers a Poop Rain: poops (the same asset the animals
 * produce) fall over the pen and each one auto-collects into coins worth
 * one Level 1 (baby) animal drop. Ignoring the pigeon for STAY_TIME loses
 * the opportunity until the next visit.
 *
 * Per-farm state (spawn countdown + remaining perch time) lives in
 * SaveManager.data.pigeon, so every farm runs its own independent event
 * and a pigeon left perched on one farm is restored when returning to it.
 * Only one pigeon can exist at a time on a farm, and it never appears
 * during the merge tutorial, the upgrade tutorial, celebrations or the
 * UFO cinematic (Game only ticks this manager during normal gameplay).
 *
 * Balancing values live in CONFIG.PIGEON and can be overridden at runtime
 * through window.RemoteConfig.PIGEON (Remote Config hook).
 */
const Pigeon = (() => {
  const C = () => Object.assign({}, CONFIG.PIGEON, (window.RemoteConfig || {}).PIGEON);
  // each farm has its own pigeon slot: always operate on the current farm's
  const data = () => SaveManager.data.pigeon[SaveManager.data.currentFarm];

  let bird = null;      // {state:'fly'|'idle'|'leave', t, x, y, fromX, fromY, toX, toY, dir, ...}
  let poops = [];       // {x, y, vy, groundY, state:'fall'|'land', t}
  let rain = null;      // {t, spawned}
  let rainValue = 0;    // coins per poop, locked in when the ad completes
  let shakeT = 0;       // impact screen-shake time left

  const smooth = t => { t = U.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  /**
   * Random perch spot on the back fence rail — clear of the UFO corner on
   * the right and the farmhouse behind the fence center.
   */
  function perchSpot() {
    const P = ENVIRONMENT.PLAY, cx = CONFIG.VIEW_W / 2;
    const x = Math.random() < 0.5
      ? U.rand(P.x + 30, cx - 64)
      : U.rand(cx + 64, P.x + P.w - 90);
    return { x, y: P.y - 12 };
  }

  /** Coins one poop pays out (auto mode: one Level 1 animal drop). */
  function poopValue() {
    const v = C().COIN_PER_POOP;
    return v > 0 ? v : Upgrades.coinValue(SaveManager.data.currentFarm, 0);
  }

  function spawn(restore) {
    const p = perchSpot();
    const dir = Math.random() < 0.5 ? 1 : -1;   // 1 = enters from the left
    bird = {
      state: restore ? 'idle' : 'fly', t: 0,
      x: p.x, y: p.y, toX: p.x, toY: p.y,
      fromX: dir === 1 ? -24 : CONFIG.VIEW_W + 24,
      fromY: p.y - 70,
      dir,
      blink: false, blinkT: U.rand(1, 3),
      look: false, lookT: U.rand(2, 4),
      flap: 0, flapT: U.rand(3, 6),
      attractT: 2.0,
    };
    if (!restore) {
      bird.x = bird.fromX; bird.y = bird.fromY;
      data().remaining = C().STAY_TIME;
      SaveManager.save();
      AudioManager.play('flap');
    }
  }

  // ---------------- update ----------------
  function update(dt, tutorialActive) {
    if (shakeT > 0) shakeT -= dt;
    const d = data();

    // restore a pigeon that was left perched on this farm
    if (!bird && d.remaining > 0 && !tutorialActive) spawn(true);

    // spawn countdown: one pigeon at a time, never during the tutorial
    if (!bird && d.remaining <= 0 && !tutorialActive) {
      d.next -= dt;
      if (d.next <= 0) spawn(false);
    }

    if (bird) updateBird(dt);
    if (rain || poops.length) updateRain(dt);
  }

  function updateBird(dt) {
    const b = bird, d = data();
    b.t += dt;
    if (b.state === 'fly') {
      // swoop across the sky, then glide down onto the fence rail
      const t = smooth(b.t / C().FLY_TIME);
      b.x = U.lerp(b.fromX, b.toX, t);
      b.y = U.lerp(b.fromY, b.toY, t * t) - Math.sin(t * Math.PI) * 16;
      if (b.t >= C().FLY_TIME) {
        b.state = 'idle'; b.t = 0; b.x = b.toX; b.y = b.toY;
        VFXManager.dust(b.x, b.y, 4);
        AudioManager.play('coo');
      }
    } else if (b.state === 'idle') {
      // perch countdown (frozen while the reward popup / ad is open, so
      // closing the popup never eats the player's remaining window)
      const p = UI.popup;
      const frozen = p && (p.type === 'pigeonAd' || p.type === 'adPlaying');
      if (!frozen) {
        d.remaining -= dt;
        if (d.remaining <= 0) {
          // ignored: the opportunity is lost until the next visit
          d.remaining = 0;
          d.next = C().SPAWN_INTERVAL;
          SaveManager.save();
          b.state = 'leave'; b.t = 0;
          b.fromX = b.x; b.fromY = b.y;
          b.dir = b.x < CONFIG.VIEW_W / 2 ? -1 : 1;
          AudioManager.play('flap');
          return;
        }
      }
      // idle acting: blink, look around, occasional wing flap
      b.blinkT -= dt;
      if (b.blinkT <= 0) { b.blink = !b.blink; b.blinkT = b.blink ? 0.12 : U.rand(1.5, 4); }
      b.lookT -= dt;
      if (b.lookT <= 0) { b.look = !b.look; b.lookT = b.look ? U.rand(0.5, 1.1) : U.rand(2, 4.5); }
      if (b.flap > 0) b.flap -= dt;
      else {
        b.flapT -= dt;
        if (b.flapT <= 0) { b.flap = 0.4; b.flapT = U.rand(3.5, 7); AudioManager.play('flap'); }
      }
      // attention sparkle so the player spots the visitor
      b.attractT -= dt;
      if (b.attractT <= 0) { b.attractT = 3.2; VFXManager.sparkle(b.x, b.y - 28, 4, 10); }
    } else if (b.state === 'leave') {
      const t = b.t / C().LEAVE_TIME;
      b.x = b.fromX + b.dir * t * 260;
      b.y = b.fromY - smooth(t) * 180 + Math.sin(b.t * 14) * 2;
      if (b.t >= C().LEAVE_TIME) bird = null;
    }
  }

  function updateRain(dt) {
    if (rain) {
      rain.t += dt;
      const count = C().POOP_COUNT;
      const gap = C().RAIN_DURATION / count;
      while (rain.spawned < count && rain.t >= rain.spawned * gap) {
        const P = ENVIRONMENT.PLAY;
        poops.push({
          x: U.rand(P.x + 14, P.x + P.w - 14),
          groundY: U.rand(P.y + 20, P.y + P.h - 8),
          y: -16 - U.rand(0, 30),
          vy: U.rand(120, 200),
          state: 'fall', t: 0,
        });
        rain.spawned++;
      }
      if (rain.spawned >= count) rain = null;
    }
    for (let i = poops.length - 1; i >= 0; i--) {
      const p = poops[i];
      p.t += dt;
      if (p.state === 'fall') {
        p.vy += 620 * dt;
        p.y += p.vy * dt;
        if (p.y >= p.groundY) {
          p.y = p.groundY; p.state = 'land'; p.t = 0;
          VFXManager.dust(p.x, p.y, 6);
          AudioManager.play('poop');
          shakeT = 0.18;
        }
      } else if (p.t >= 0.4) {
        // auto-collect: the poop turns into coins flying to the HUD
        const value = rainValue;
        const tgt = UI.coinTarget();
        VFXManager.flyCoin(p.x, p.y - 6, tgt.x, tgt.y, () => {
          Game.addCoins(value);
          AudioManager.play('coin');
        });
        VFXManager.floatText(p.x, p.y - 18, '+' + value);
        VFXManager.sparkle(p.x, p.y - 8, 5, 8);
        poops.splice(i, 1);
      }
    }
  }

  // ---------------- interaction ----------------
  /** Returns true if the tap hit the perched pigeon (opens the ad popup). */
  function tap(x, y) {
    if (!bird || bird.state !== 'idle') return false;
    if (U.dist(x, y, bird.x, bird.y - 12) > 22) return false;
    AudioManager.play('coo');
    UI.openPopup({ type: 'pigeonAd' });
    return true;
  }

  /** The reward ad finished successfully: pigeon leaves, poops fall. */
  function adCompleted() {
    const d = data();
    d.remaining = 0;
    d.next = C().SPAWN_INTERVAL + C().REWARD_COOLDOWN;
    SaveManager.save();
    if (bird) {
      VFXManager.burst(bird.x, bird.y - 12, ['#ffe98a', '#fff6d0', '#c6cfd8', '#ffffff'], 14, 100);
      VFXManager.sparkle(bird.x, bird.y - 16, 8, 14);
      bird = null;
    }
    rainValue = poopValue();
    rain = { t: 0, spawned: 0 };
    AudioManager.play('unlock');
  }

  // ---------------- draw ----------------
  function draw(ctx) {
    // ground shadows under falling poops
    for (const p of poops) {
      if (p.state !== 'fall') continue;
      const near = U.clamp(1 - (p.groundY - p.y) / 220, 0.15, 1);
      ctx.globalAlpha = 0.22 * near;
      ctx.fillStyle = '#1c2b12';
      ctx.beginPath(); ctx.ellipse(p.x, p.groundY + 2, 8 * near + 2, 3 * near + 1, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }

    if (bird) {
      const b = bird;
      const flying = b.state !== 'idle';
      let frame = 'idle';
      if (flying) frame = Math.floor(b.t * 12) % 2 ? 'flapUp' : 'flapDn';
      else if (b.flap > 0) frame = Math.floor(b.t * 16) % 2 ? 'flapUp' : 'flapDn';
      else if (b.look) frame = 'look';
      const bob = b.state === 'idle' ? Math.sin(b.t * 2.2) * 0.8 : 0;
      const img = SPRITES.pigeon(frame, b.blink && !flying);
      PIXEL.blit(ctx, img, b.x, b.y + bob, 2, b.dir === -1);

      // golden "!" bubble while perched, so the offer reads as tappable
      if (b.state === 'idle') {
        const pulse = Math.sin(b.t * 5) * 2;
        const by = b.y - 40 + pulse;
        ctx.fillStyle = PIXEL.OUTLINE;
        ctx.beginPath(); ctx.arc(b.x, by, 8, 0, 7); ctx.fill();
        ctx.fillStyle = SPRITES.P.gold;
        ctx.beginPath(); ctx.arc(b.x, by, 6, 0, 7); ctx.fill();
        ctx.fillStyle = SPRITES.P.goldHi;
        ctx.beginPath(); ctx.arc(b.x - 1, by - 1, 4, 0, 7); ctx.fill();
        ctx.fillStyle = SPRITES.P.gold;
        ctx.beginPath(); ctx.arc(b.x, by + 1, 4, 0, 7); ctx.fill();
        UI.drawText(ctx, '!', b.x, by - 5, 10, '#5c3a1d', 'center');
      }
    }

    // falling poops (same asset the animals produce, squash bounce on impact)
    for (const p of poops) {
      const squash = p.state === 'land' && p.t < 0.18 ? 0.72 + (p.t / 0.18) * 0.28 : 1;
      PIXEL.blit(ctx, SPRITES.poop(0), p.x, p.y + 4, 2, false, squash, 1 + (1 - squash) * 0.8);
    }
  }

  /** Subtle screen offset while a poop impact shake is active. */
  function shakeOffset() {
    if (shakeT <= 0) return { x: 0, y: 0 };
    const a = (shakeT / 0.18) * 2.2;
    return { x: (Math.random() * 2 - 1) * a, y: (Math.random() * 2 - 1) * a };
  }

  /** Reward panel numbers for the popup. */
  function info() {
    return { count: C().POOP_COUNT, value: poopValue(), adDur: C().AD_DURATION };
  }

  /**
   * Clear transient animation state (farm switch / full reset). A rain in
   * progress pays out its remaining poops instantly so switching farms
   * never costs the player their reward; discard=true (save reset) skips it.
   */
  function reset(discard = false) {
    if (!discard) {
      const pending = poops.length + (rain ? C().POOP_COUNT - rain.spawned : 0);
      if (pending > 0) Game.addCoins(pending * rainValue);
    }
    bird = null; poops = []; rain = null; shakeT = 0;
  }

  return { update, draw, tap, adCompleted, shakeOffset, info, reset };
})();
