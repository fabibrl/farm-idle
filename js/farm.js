/**
 * FarmScene — gameplay scene for one farm.
 * Owns: SpawnManager (auto baby spawns), MergeManager (drag & merge),
 * EconomyManager hooks (poop -> coin lifecycle).
 */
class FarmScene {
  constructor(farmId) {
    this.farmId = farmId;
    this.def = CONFIG.FARMS[farmId];
    this.animals = [];
    this.poops = [];       // {x, y, t, stage, phase}
    this.spawnT = 1.0;
    this.dragged = null;
    this.dragOffX = 0; this.dragOffY = 0;
    this.mergeTarget = null;
    this.bg = ENVIRONMENT.farm(farmId);
    this.bounds = {
      x: ENVIRONMENT.PLAY.x + 18,
      y: ENVIRONMENT.PLAY.y + 26,
      w: ENVIRONMENT.PLAY.w - 36,
      h: ENVIRONMENT.PLAY.h - 46,
    };
    this.tutorial = null;
    if (!SaveManager.data.tutorialDone[farmId]) {
      // first visit: exactly two babies pre-placed, spawning paused until they merge
      this.startTutorial();
    } else {
      // restore saved animals
      const saved = SaveManager.data.animals[farmId] || [];
      for (const a of saved) {
        const p = this.randomSpot();
        const an = new Animal(this.def.species, a.stage, p.x, p.y);
        an.setState('idle', U.rand(0.5, 2));
        an.scaleX = an.scaleY = 1;
        this.animals.push(an);
      }
    }
  }

  /** TutorialManager: seed the guaranteed first merge and show the drag hint. */
  startTutorial() {
    const cx = this.bounds.x + this.bounds.w / 2;
    const cy = this.bounds.y + this.bounds.h * 0.45;
    const gap = CONFIG.TUTORIAL.GAP / 2;
    const a = new Animal(this.def.species, 0, cx - gap, cy);
    const b = new Animal(this.def.species, 0, cx + gap, cy);
    for (const an of [a, b]) {
      an.setState('idle', 1e9); // hold still so the merge stays obvious
      an.scaleX = an.scaleY = 1;
      this.animals.push(an);
      Discovery.mark(this.def.species, 0);
    }
    this.tutorial = { a, b, t: 0 };
  }

  randomSpot() {
    return {
      x: U.rand(this.bounds.x, this.bounds.x + this.bounds.w),
      y: U.rand(this.bounds.y, this.bounds.y + this.bounds.h),
    };
  }

  /** SpawnManager: place a new animal at a free spot. */
  spawnAnimal(stage = 0, sfx = true) {
    if (this.animals.length >= CONFIG.MAX_ANIMALS) return null;
    let p = this.randomSpot(), tries = 0;
    while (tries++ < 12 && this.animals.some(a => U.dist(a.x, a.y, p.x, p.y) < 40)) {
      p = this.randomSpot();
    }
    const a = new Animal(this.def.species, stage, p.x, p.y);
    this.animals.push(a);
    Discovery.mark(this.def.species, stage); // babies count for the collection, no celebration
    VFXManager.dust(p.x, p.y, 6);
    if (sfx) AudioManager.play('pop');
    this.persist();
    return a;
  }

  /** EconomyManager: animal drops a poop that later becomes a coin. */
  dropPoop(animal) {
    this.poops.push({
      x: animal.x - animal.facing * 8,
      y: animal.y + 2,
      t: 0,
      stage: animal.stage,
      phase: 'poop',
    });
    AudioManager.play('poop');
  }

  updatePoops(dt) {
    for (let i = this.poops.length - 1; i >= 0; i--) {
      const p = this.poops[i];
      p.t += dt;
      if (p.phase === 'poop' && p.t >= CONFIG.POOP_TO_COIN_DELAY) {
        p.phase = 'glow';
        p.t = 0;
        VFXManager.sparkle(p.x, p.y - 6, 10, 10);
      } else if (p.phase === 'glow' && p.t >= 0.5) {
        // transform: launch flying coin toward the HUD counter
        const value = Upgrades.coinValue(this.farmId, p.stage);
        const target = UI.coinTarget();
        VFXManager.flyCoin(p.x, p.y - 6, target.x, target.y, () => {
          Game.addCoins(value);
          AudioManager.play('coin');
        });
        VFXManager.floatText(p.x, p.y - 18, '+' + value);
        this.poops.splice(i, 1);
      }
    }
  }

  // ---------------- MergeManager: input ----------------
  pointerDown(x, y) {
    // topmost animal under pointer
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      if (a.state === 'merging' || a.state === 'spawning') continue;
      if (U.dist(x, y, a.x, a.y - a.radius * 0.6) < a.radius + 8) {
        this.dragged = a;
        a.dragging = true;
        a.homeX = a.x; a.homeY = a.y;
        this.dragOffX = a.x - x; this.dragOffY = a.y - y;
        // draw on top
        this.animals.splice(i, 1);
        this.animals.push(a);
        AudioManager.play('click');
        return true;
      }
    }
    return false;
  }

  pointerMove(x, y) {
    if (!this.dragged) return;
    this.dragged.x = U.clamp(x + this.dragOffX, this.bounds.x - 10, this.bounds.x + this.bounds.w + 10);
    this.dragged.y = U.clamp(y + this.dragOffY, this.bounds.y - 10, this.bounds.y + this.bounds.h + 10);
    this.mergeTarget = this.findMergeTarget();
  }

  findMergeTarget() {
    const d = this.dragged;
    if (!d) return null;
    let best = null, bestDist = CONFIG.MERGE_RADIUS + d.radius * 0.5;
    for (const a of this.animals) {
      if (a === d || a.dead || a.state === 'merging' || a.state === 'spawning') continue;
      // mutants (final stage) can still pair up — they become a UFO alien
      if (a.species !== d.species || a.stage !== d.stage) continue;
      const dist = U.dist(a.x, a.y, d.x, d.y);
      if (dist < bestDist) { best = a; bestDist = dist; }
    }
    return best;
  }

  pointerUp() {
    const d = this.dragged;
    if (!d) return;
    d.dragging = false;
    this.dragged = null;
    const target = this.mergeTarget;
    this.mergeTarget = null;
    if (target) {
      this.merge(d, target);
    } else {
      d.setState('return', 1);
    }
  }

  /** Merge two identical animals into one evolved animal (instant swap, no animation). */
  merge(a, b) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const species = a.species, newStage = a.stage + 1;
    // remove both source animals immediately
    a.dead = b.dead = true;
    this.animals = this.animals.filter(an => !an.dead);
    AudioManager.play('merge');
    // Mutant + Mutant: no stage 5 — the pair permanently becomes an alien
    // collected by the UFO (full cinematic first time, quick beam after)
    if (newStage >= CONFIG.STAGE_NAMES.length) {
      VFXManager.burst(mx, my - 14, ['#7de87a', '#c4ffb8', '#a07cc0', '#ffffff'], 20, 120);
      VFXManager.sparkle(mx, my - 20, 12, 22);
      this.persist();
      UFO.collect(mx, my);
      return;
    }
    // replace with the evolved asset at the merge position, full size right away
    const evolved = new Animal(species, newStage, mx, my);
    evolved.setState('idle', U.rand(1, 2));
    evolved.scaleX = evolved.scaleY = 1;
    this.animals.push(evolved);
    const cols = ['#ffe98a', '#f4c437', '#fff6d0', '#ffffff'];
    VFXManager.burst(mx, my - 14, cols, 18, 110);
    VFXManager.sparkle(mx, my - 20, 12, 22);
    // first successful merge completes the tutorial and starts normal spawning
    if (this.tutorial) {
      this.tutorial = null;
      SaveManager.data.tutorialDone[this.farmId] = true;
      this.spawnT = 1.0;
    }
    this.persist();
    // first time this species+stage is ever created -> celebration!
    if (Discovery.mark(species, newStage)) {
      Game.startCelebration(evolved, mx, my);
    }
  }

  persist() {
    // animals spinning inside an active tornado are appended so an
    // autosave / reload mid-event can never lose them
    SaveManager.data.animals[this.farmId] =
      this.animals.filter(a => !a.dead && a.state !== 'merging').map(a => ({ stage: a.stage }))
        .concat(Tornado.heldSnapshot(this.farmId));
    SaveManager.save();
  }

  update(dt) {
    // SpawnManager tick (paused until the tutorial merge is done)
    if (!this.tutorial) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = Upgrades.spawnInterval(this.farmId);
        this.spawnAnimal(0);
      }
    } else {
      this.tutorial.t += dt;
    }

    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      a.update(dt, this.bounds, this);
      // keep the tutorial pair in place so the merge stays obvious
      if (this.tutorial && a.state === 'walk') a.setState('idle', 1e9);
      if (a.dead) this.animals.splice(i, 1);
    }
    this.updatePoops(dt);
  }

  draw(ctx) {
    ctx.drawImage(this.bg, 0, 0);

    // poops (under animals)
    for (const p of this.poops) {
      const img = SPRITES.poop(p.stage);
      if (p.phase === 'glow') {
        // pulsing golden aura
        const pulse = 0.5 + Math.sin(p.t * 20) * 0.2;
        ctx.globalAlpha = pulse;
        ctx.fillStyle = '#ffe98a';
        ctx.beginPath(); ctx.arc(p.x, p.y - 5, 14, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
      const pop = p.phase === 'poop' && p.t < 0.25 ? U.easeOutBack(p.t / 0.25) : 1;
      PIXEL.blit(ctx, img, p.x, p.y + 4, 2 * pop);
    }

    // merge target highlight ring
    if (this.mergeTarget) {
      const t = this.mergeTarget;
      ctx.strokeStyle = '#ffe98a';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 90) * 0.3;
      ctx.beginPath();
      ctx.ellipse(t.x, t.y, t.radius + 6, (t.radius + 6) * 0.6, 0, 0, 7);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // animals sorted by y for correct overlap; babies (stage 0) always render
    // above evolved animals so they stay easy to find and merge
    const layer = a => a.dragging ? 2 : a.stage === 0 ? 1 : 0;
    const sorted = this.animals.slice().sort((a, b) => layer(a) - layer(b) || a.y - b.y);
    for (const a of sorted) a.draw(ctx);

    // parked UFO / abduction cinematic (above the animals)
    UFO.draw(ctx);

    // pigeon on the fence + falling poops (above the animals)
    Pigeon.draw(ctx);

    // tornado offer icon / active tornado (above everything)
    Tornado.draw(ctx);

    if (this.tutorial) this.drawTutorial(ctx);
  }

  /** Drag hint: dashed guide + hand sweeping from one baby onto the other. */
  drawTutorial(ctx) {
    const { a, b, t } = this.tutorial;
    if (this.dragged) return; // hide while the player is already dragging
    const cycle = (t % CONFIG.TUTORIAL.HAND_CYCLE) / CONFIG.TUTORIAL.HAND_CYCLE;
    const move = U.clamp(cycle / 0.7, 0, 1);          // 70% travel, 30% hold
    const e = move * move * (3 - 2 * move);           // smoothstep
    const hx = U.lerp(a.x, b.x, e);
    const hy = U.lerp(a.y, b.y, e);
    const alpha = cycle > 0.85 ? (1 - cycle) / 0.15 : 1;

    // dashed guide line between the two animals
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 5]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y - 6);
    ctx.lineTo(b.x, b.y - 6);
    ctx.stroke();
    ctx.setLineDash([]);

    // hand pointer
    ctx.globalAlpha = alpha;
    UI.drawHand(ctx, hx + 4, hy - 4);
    ctx.restore();

    // hint label above the pair
    ctx.save();
    ctx.globalAlpha = 0.85 + Math.sin(t * 4) * 0.15;
    const lx = (a.x + b.x) / 2, ly = Math.min(a.y, b.y) - 48;
    UI.drawText(ctx, 'DRAG TO MERGE!', lx, ly, UI.SIZE.BUTTON, '#fff6e8', 'center', true);
    ctx.restore();
  }
}
