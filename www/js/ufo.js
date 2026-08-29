/**
 * UFOManager — end-game final-form collection layer.
 *
 * Every farm unlocks its own UFO independently. The first time two of a
 * chain's LAST board stage are merged on a farm, the full abduction
 * cinematic plays (gameplay paused, input blocked): the pair becomes that
 * chain's final form — on Farm 1 the Final Chicken, the hyper mutation at
 * the peak of the seven-stage chain, and the only animal the UFO ever takes
 * — a UFO flies in, beams it up, then parks permanently beside the farmhouse
 * in the upper-right corner of the scene, outside the pen. Every later
 * top-stage merge there is a sub-second quick collect into the parked UFO.
 *
 * Each collected final form permanently raises the UFO's passive coin drip
 * (aliens * Upgrades.alienValue coins every INTERVAL seconds — the internal
 * `aliens` counter/config names are kept for save compatibility).
 */
const UFO = (() => {
  const C = () => CONFIG.UFO;
  // each farm has its own UFO: always operate on the current farm's slot
  const data = () => SaveManager.data.ufo[SaveManager.data.currentFarm];
  // the collected final form is the current farm's own species
  const species = () => CONFIG.FARMS[SaveManager.data.currentFarm].species;
  // its display name comes from that chain (Farm 1: 'FINAL')
  const finalName = () => CONFIG.finalStage(species()).name;

  let cine = null;       // first-time cinematic {phase, t, x, y, ufoX, ufoY, alien:{y, s}, fromX, fromY}
  let collects = [];     // quick collect anims: {x, y, t}
  let prodT = 0;         // production timer
  let bobT = 0;          // idle hover / light animation clock
  let flashT = 0;        // brief tractor-beam flash when an alien arrives

  const smooth = t => { t = U.clamp(t, 0, 1); return t * t * (3 - 2 * t); };

  /**
   * Permanent parking spot: hovering beside the farmhouse in the upper-right
   * corner of the scene, anchored to the view's top/right edges (not the
   * pen). It fills the clear sky strip between the top HUD bar (backdrop
   * ends at y 56) and the pen's back fence (starts at y 140), to the right
   * of the farmhouse (widest building ends at x 234) — fully outside the
   * fenced animal area, never covering the house, and clear of the settings
   * button (ends at y 44). The right flanking tree was moved to the
   * bottom-right grass (environment.js) to keep this corner open. The whole
   * 360x640 virtual view is letterboxed on every device, so an edge anchor
   * inside it stays fully visible and tappable at any resolution or aspect
   * ratio. (Saucer is 88x52 px, bottom-anchored; counter extends ~30 px
   * below.)
   */
  function spot() {
    return {
      x: CONFIG.VIEW_W - 48,   // right-edge anchored: saucer spans x 268-356
      y: 110,                  // top-edge anchored: saucer spans y 58-110
    };
  }

  /** Entry point from FarmScene.merge for a top-stage pair. */
  function collect(x, y) {
    // record the final form as in-transit so a reload mid-animation can't lose it
    data().pending = (data().pending || 0) + 1;
    SaveManager.save();
    if (!data().landed) {
      if (cine) return; // already playing (shouldn't happen: input is blocked)
      cine = {
        phase: 'spawn', t: 0, x, y,
        ufoX: x, ufoY: -30,
        alien: { y, s: 0 },
      };
    } else {
      collects.push({ x, y, t: 0 });
      AudioManager.play('beam');
    }
  }

  /** One reached the UFO: bump the collection + production for good. */
  function addAlien() {
    const p = spot();
    data().aliens++;
    data().pending = Math.max(0, (data().pending || 0) - 1);
    SaveManager.save();
    AudioManager.play('alien');
    VFXManager.burst(p.x, p.y - 24, ['#7de87a', '#c4ffb8', '#ffe98a', '#ffffff'], 20, 120);
    VFXManager.sparkle(p.x, p.y - 26, 14, 26);
    VFXManager.floatText(p.x, p.y - 52, '+1 ' + finalName(), '#c4ffb8');
    VFXManager.floatText(p.x, p.y - 38, '+' + Upgrades.alienValue(SaveManager.data.currentFarm) + '/' + C().INTERVAL.toFixed(0) + 'S');
    flashT = 0.3;
  }

  // ---------------- update ----------------
  function update(dt) {
    bobT += dt;
    if (flashT > 0) flashT -= dt;
    if (cine) { updateCinematic(dt); return; }

    // recover final forms stranded by a reload mid-animation
    const stranded = (data().pending || 0) - collects.length;
    if (stranded > 0) {
      if (!data().landed) {
        // replay the abduction from the middle of the pen
        const cx = ENVIRONMENT.PLAY.x + ENVIRONMENT.PLAY.w / 2;
        const cy = ENVIRONMENT.PLAY.y + ENVIRONMENT.PLAY.h / 2;
        cine = { phase: 'spawn', t: 0, x: cx, y: cy, ufoX: cx, ufoY: -30, alien: { y: cy, s: 0 } };
        return;
      }
      for (let i = 0; i < stranded; i++) addAlien();
    }

    // quick collects (post-landing, < 1 s each)
    for (let i = collects.length - 1; i >= 0; i--) {
      const c = collects[i];
      c.t += dt;
      if (c.t >= C().QUICK_COLLECT_TIME) {
        collects.splice(i, 1);
        addAlien();
      }
    }

    // passive coin production, scaling with the collection
    if (data().landed && data().aliens > 0) {
      prodT += dt;
      if (prodT >= C().INTERVAL) {
        prodT = 0;
        const p = spot();
        const value = data().aliens * Upgrades.alienValue(SaveManager.data.currentFarm);
        const t = UI.coinTarget();
        VFXManager.flyCoin(p.x, p.y - 18, t.x, t.y, () => {
          Game.addCoins(value);
          AudioManager.play('coin');
        });
        VFXManager.floatText(p.x, p.y - 34, '+' + value);
      }
    }
  }

  function updateCinematic(dt) {
    const c = cine, D = C().CINEMATIC;
    c.t += dt;
    if (c.phase === 'spawn') {
      // the merged pair materializes as the final form
      c.alien.s = U.easeOutBack(Math.min(c.t / 0.5, 1));
      if (Math.random() < 0.3) VFXManager.sparkle(c.x, c.y - 12, 3, 14);
      if (c.t >= D.SPAWN) { c.phase = 'arrive'; c.t = 0; AudioManager.play('ufo'); }
    } else if (c.phase === 'arrive') {
      // UFO descends from the sky to hover over the final form
      const t = smooth(c.t / D.ARRIVE);
      c.ufoX = c.x + Math.sin(t * Math.PI * 3) * 12 * (1 - t);
      c.ufoY = U.lerp(-30, c.y - 92, t);
      if (c.t >= D.ARRIVE) { c.phase = 'beam'; c.t = 0; AudioManager.play('beam'); }
    } else if (c.phase === 'beam') {
      // tractor beam pulls the final form up into the saucer
      const t = U.clamp(c.t / D.BEAM, 0, 1);
      c.alien.y = U.lerp(c.y, c.ufoY + 14, t * t);
      c.alien.s = 1 - t * 0.7;
      if (Math.random() < 0.5) VFXManager.sparkle(c.x, U.lerp(c.y, c.ufoY + 20, Math.random()), 2, 8);
      if (c.t >= D.BEAM) {
        c.phase = 'fly'; c.t = 0;
        c.fromX = c.ufoX; c.fromY = c.ufoY;
        VFXManager.burst(c.ufoX, c.ufoY - 10, ['#7de87a', '#c4ffb8', '#ffffff'], 16, 100);
        AudioManager.play('ufo');
      }
    } else if (c.phase === 'fly') {
      // cruise to the permanent landing corner with a little arc
      const p = spot();
      const t = smooth(c.t / D.FLY);
      c.ufoX = U.lerp(c.fromX, p.x, t);
      c.ufoY = U.lerp(c.fromY, p.y - 26, t) - Math.sin(t * Math.PI) * 26;
      if (c.t >= D.FLY) { c.phase = 'land'; c.t = 0; }
    } else if (c.phase === 'land') {
      const p = spot();
      c.ufoX = p.x;
      c.ufoY = U.lerp(p.y - 26, p.y, smooth(c.t / D.LAND));
      if (c.t >= D.LAND) {
        cine = null;
        data().landed = true;
        addAlien();   // first alien joins the collection (also saves)
      }
    }
  }

  // ---------------- draw ----------------
  /** Soft tractor-beam cone from the saucer belly down to the ground. */
  function drawBeam(ctx, x, topY, groundY, alpha, wTop = 7, wBot = 24) {
    ctx.save();
    ctx.globalAlpha = alpha * 0.45;
    ctx.fillStyle = '#c4ffb8';
    ctx.beginPath();
    ctx.moveTo(x - wTop, topY); ctx.lineTo(x + wTop, topY);
    ctx.lineTo(x + wBot, groundY); ctx.lineTo(x - wBot, groundY);
    ctx.closePath(); ctx.fill();
    ctx.globalAlpha = alpha * 0.3;
    ctx.beginPath(); ctx.ellipse(x, groundY, wBot, 6, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  function drawSaucer(ctx, x, y, aliens, shadow = true) {
    if (shadow) {
      ctx.globalAlpha = 0.2;
      ctx.fillStyle = '#1c2b12';
      ctx.beginPath(); ctx.ellipse(x, spot().y + 6, 26, 6, 0, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    const phase = Math.floor(bobT * 5) % 3;
    PIXEL.blit(ctx, SPRITES.ufo(phase, aliens), x, y, 2);
  }

  function draw(ctx) {
    if (cine) { drawCinematic(ctx); return; }
    if (!data().landed) return;
    const p = spot();
    const bob = Math.sin(bobT * 2) * 2;

    // arrival flash: short tractor beam under the parked saucer
    if (flashT > 0) drawBeam(ctx, p.x, p.y - 6 + bob, p.y + 8, Math.min(1, flashT * 4));

    // final forms being beamed in (quick collect)
    for (const c of collects) {
      const t = U.clamp(c.t / C().QUICK_COLLECT_TIME, 0, 1);
      const pop = U.easeOutBack(Math.min(c.t / 0.15, 1));
      const e = smooth(t);
      const ax = U.lerp(c.x, p.x, e);
      const ay = U.lerp(c.y, p.y - 12, e) - Math.sin(e * Math.PI) * 36;
      PIXEL.blit(ctx, SPRITES.mutant2(species()), ax, ay, 2 * pop * (1 - t * 0.55));
      if (Math.random() < 0.5) VFXManager.sparkle(ax, ay - 8, 1, 6);
    }

    drawSaucer(ctx, p.x, p.y + bob, data().aliens);

    // collection counter under the saucer, in the sky gap above the pen's
    // back fence (fence starts at y 140; the counter ends right there)
    if (data().aliens > 0) {
      PIXEL.blit(ctx, SPRITES.mutant2(species()), p.x - 2, p.y + 30, 1);
      UI.drawText(ctx, 'X' + data().aliens, p.x + 6, p.y + 16, UI.SIZE.BODY, '#c4ffb8', 'left', true);
    }
  }

  function drawCinematic(ctx) {
    const c = cine;
    // dim the farm for drama
    ctx.fillStyle = 'rgba(8, 12, 28, 0.35)';
    ctx.fillRect(0, 0, CONFIG.VIEW_W, CONFIG.VIEW_H);

    if (c.phase === 'beam') {
      const pulse = 0.7 + Math.sin(bobT * 16) * 0.3;
      drawBeam(ctx, c.ufoX, c.ufoY - 4, c.y + 6, pulse);
    }
    if (c.phase !== 'fly' && c.phase !== 'land') {
      PIXEL.blit(ctx, SPRITES.mutant2(species()), c.x, c.alien.y, 2 * c.alien.s);
    }
    if (c.phase !== 'spawn') {
      drawSaucer(ctx, c.ufoX, c.ufoY, 0, c.phase === 'land');
    }
  }

  return {
    collect, update, draw,
    get cinematicActive() { return !!cine; },
    /** Clear transient animation state (farm switch / full reset). */
    reset() { cine = null; collects = []; prodT = 0; flashT = 0; },
  };
})();
