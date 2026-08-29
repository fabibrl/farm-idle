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
    this.ghosts = [];      // in-scene hit rects (the farmhouse), see drawHouse()
    // fence jumping (construction farms only): pressure builds while spawns
    // bounce off a full pen — see updateFenceJump()
    this.penPressure = 0;
    this.jumpCooldown = 0;
    const J = Construction.jumpCfg(farmId);
    this.jumpAt = J ? Math.max(1, J.PRESSURE_TIME + U.rand(-J.VARIANCE, J.VARIANCE)) : Infinity;
    this.setBounds();
    this.tutorial = null;
    if (Construction.capacity(farmId) <= 0) {
      // nothing has been built here yet: no animals, no tutorial — the scene
      // is just the plot plus its build call-to-action
    } else if (!SaveManager.data.tutorialDone[farmId]) {
      // first visit: exactly two babies pre-placed, spawning paused until they merge
      this.startTutorial();
    } else {
      // restore saved animals (incl. offline-spawned ones) on free spots
      const saved = SaveManager.data.animals[farmId] || [];
      const cap = Construction.capacity(farmId);
      for (const a of saved.slice(0, cap)) {
        const p = this.freeSpot();
        const an = new Animal(this.def.species, a.stage, p.x, p.y);
        an.setState('idle', U.rand(0.5, 2));
        an.scaleX = an.scaleY = 1;
        this.armEscape(an);
        this.animals.push(an);
      }
    }
  }

  /** Walk/spawn area: the current fence footprint (or the whole plot). */
  setBounds() {
    const R = ENVIRONMENT.playRect(this.farmId);
    this.bounds = { x: R.x + 18, y: R.y + 26, w: R.w - 36, h: R.h - 46 };
  }

  /**
   * A build step completed: re-bake the background, recalculate the playable
   * area for the new fence footprint (so added capacity is physically
   * usable), pull existing animals back inside it and start the first-merge
   * tutorial if the house has only just made spawning possible.
   */
  refresh() {
    this.bg = ENVIRONMENT.farm(this.farmId);
    this.setBounds();
    const b = this.bounds;
    for (const a of this.animals) {
      a.x = U.clamp(a.x, b.x, b.x + b.w);
      a.y = U.clamp(a.y, b.y, b.y + b.h);
      a.homeX = a.x; a.homeY = a.y;
      if (!Construction.escapesActive(this.farmId)) {
        // the fence is up: escape logic is off for good
        a.escaping = false;
        a.escapeT = Infinity;
        a.farewell = null;
        a.alpha = 1;
        a.arcY = 0;
        if (a.state === 'escape') a.setState('idle', U.rand(0.5, 2));
      }
    }
    if (!this.tutorial && Construction.capacity(this.farmId) > 0 &&
        !SaveManager.data.tutorialDone[this.farmId]) {
      this.startTutorial();
    }
    this.spawnT = Math.min(this.spawnT, Upgrades.spawnInterval(this.farmId));
  }

  /**
   * Fence jumping — construction farms only (Construction.jumpCfg is null
   * everywhere else, so no other farm ever runs this): while the pen sits at
   * capacity and spawns keep getting blocked, pressure builds; when it runs
   * out, one eligible animal hops the fence and is lost, making room instead
   * of hard-blocking spawning forever. Babies (below MIN_STAGE) never jump.
   * A cooldown keeps it to an occasional event, not a drain.
   */
  updateFenceJump(dt) {
    const J = Construction.jumpCfg(this.farmId);
    if (!J) return;   // not a construction farm: animals are never lost here
    this.jumpCooldown = Math.max(0, this.jumpCooldown - dt);
    // pressure only builds while the pen is full and spawns are bouncing off
    // it; it bleeds away as soon as a merge or a jump has freed a slot
    if (this.animals.length < Construction.capacity(this.farmId)) {
      this.penPressure = Math.max(0, this.penPressure - dt);
      return;
    }
    // no fence yet: the walk-off escape covers this stage instead
    if (Construction.escapesActive(this.farmId)) return;
    this.penPressure += dt;
    if (this.penPressure < this.jumpAt || this.jumpCooldown > 0) return;
    const victim = this.pickJumper(J);
    if (!victim) return;      // only babies in the pen: nothing jumps
    this.penPressure = 0;
    this.jumpAt = Math.max(1, J.PRESSURE_TIME + U.rand(-J.VARIANCE, J.VARIANCE));
    this.jumpCooldown = J.COOLDOWN;
    victim.startEscape(this.bounds, 'jump', J);
    AudioManager.play('pop');
  }

  /**
   * Which animal hops the fence: the cheapest eligible tier present (tier 2
   * and up), picked at random within it — a full pen costs the player its
   * most redundant animal, never its best.
   */
  pickJumper(J = Construction.jumpCfg(this.farmId)) {
    if (!J) return null;
    const min = J.MIN_STAGE;
    const eligible = this.animals.filter(a =>
      a.stage >= min && !a.escaping && !a.dragging && !a.dead &&
      a.state !== 'merging' && a.state !== 'spawning');
    if (!eligible.length) return null;
    const lowest = Math.min(...eligible.map(a => a.stage));
    return U.pick(eligible.filter(a => a.stage === lowest));
  }

  /** Give one animal its own escape countdown (no fence = animals wander off). */
  armEscape(animal) {
    animal.escapeT = Construction.escapesActive(this.farmId)
      ? Construction.escapeDelay(this.farmId) : Infinity;
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

  /** Random pen position kept clear of existing animals (best effort). */
  freeSpot() {
    let p = this.randomSpot(), tries = 0;
    while (tries++ < 12 && this.animals.some(a => U.dist(a.x, a.y, p.x, p.y) < 40)) {
      p = this.randomSpot();
    }
    return p;
  }

  /** SpawnManager: place a new animal at a free spot. */
  spawnAnimal(stage = 0, sfx = true) {
    // hard cap: the fence tier's capacity on construction farms
    if (this.animals.length >= Construction.capacity(this.farmId)) return null;
    const p = this.freeSpot();
    const a = new Animal(this.def.species, stage, p.x, p.y);
    this.armEscape(a);
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
    // the farmhouse is the entry point for the build/upgrade menu
    for (const gh of this.ghosts) {
      if (x >= gh.x && x <= gh.x + gh.w && y >= gh.y && y <= gh.y + gh.h) {
        AudioManager.play('click');
        Game.openBuild(this.farmId);
        return true;
      }
    }
    // topmost animal under pointer — an animal that has started leaving is
    // locked out of interaction (the tell shows the player why)
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      if (a.state === 'merging' || a.state === 'spawning' || a.escaping) continue;
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
      if (a.escaping) continue;   // on its way out: no longer matchable
      // the chain's top stage can still pair up — it becomes the final form
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
    // Two of the chain's last board stage: the pair never lands as an animal
    // — it permanently becomes the chain's final form (Farm 1: the Final
    // Chicken), collected by the UFO (full cinematic first time, quick beam
    // after). This is the only animal the UFO ever abducts.
    if (newStage >= CONFIG.stageCount(species)) {
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
    // a successful match cancels both escapes; the evolved animal starts a
    // fresh countdown of its own
    this.armEscape(evolved);
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
    // SpawnManager tick (paused until the tutorial merge is done, and
    // silent while nothing has been built that could hold animals)
    if (Construction.capacity(this.farmId) <= 0) {
      this.updatePoops(dt);
      return;
    }
    if (!this.tutorial) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = Upgrades.spawnInterval(this.farmId);
        this.spawnAnimal(0);   // returns null while the pen is full
      }
      this.updateFenceJump(dt);
    } else {
      this.tutorial.t += dt;
    }

    // no fence: every animal counts down its own escape timer and then
    // wanders off the plot (staggered, never all at once)
    const escapes = Construction.escapesActive(this.farmId) && !this.tutorial;

    let lost = false;
    for (let i = this.animals.length - 1; i >= 0; i--) {
      const a = this.animals[i];
      if (escapes && !a.escaping && !a.dragging && a.state !== 'merging') {
        a.escapeT -= dt;
        if (a.escapeT <= 0) a.startEscape(this.bounds, 'walk');
      }
      a.update(dt, this.bounds, this);
      // keep the tutorial pair in place so the merge stays obvious
      if (this.tutorial && a.state === 'walk') a.setState('idle', 1e9);
      if (a.dead) {
        if (a.escaped) lost = true;
        this.animals.splice(i, 1);
      }
    }
    // an animal that walked off is gone for good — keep the save in step
    if (lost) {
      if (this.dragged && this.dragged.dead) { this.dragged = null; this.mergeTarget = null; }
      this.persist();
    }
    this.updatePoops(dt);
  }

  /**
   * Render order (back to front): background, the farmhouse layer (ghost
   * placeholder + call-to-action indicator), poops, animals, UFO/pigeon/
   * tornado, then the tutorial overlay. Tutorial content always draws last,
   * so nothing in the scene can cover it — and the house indicator is
   * suppressed entirely while the tutorial runs.
   */
  draw(ctx) {
    ctx.drawImage(this.bg, 0, 0);
    this.drawHouse(ctx);

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

    // farewell bubbles of everything on its way out, above every animal
    this.drawFarewells(ctx, sorted);

    // parked UFO / abduction cinematic (above the animals)
    UFO.draw(ctx);

    // pigeon on the fence + falling poops (above the animals)
    Pigeon.draw(ctx);

    // tornado offer icon / active tornado (above everything)
    Tornado.draw(ctx);

    if (this.tutorial) this.drawTutorial(ctx);
  }

  /**
   * Goodbye bubbles (see Animal.bubbleBox): drawn here, after every animal,
   * so they always sit on top — and so several animals leaving at once can
   * be de-overlapped against each other. Each bubble is lifted above any
   * already-placed one it would collide with, never into an unreadable
   * cluster; the tail keeps pointing at its own animal.
   */
  drawFarewells(ctx, sorted) {
    const gap = CONFIG.ESCAPE.BUBBLE.GAP;
    const placed = [];
    for (const a of sorted) {
      const box = a.bubbleBox();
      if (!box) continue;
      for (let pass = 0; pass < placed.length; pass++) {
        let hit = false;
        for (const p of placed) {
          if (box.x < p.x + p.w + gap && p.x < box.x + box.w + gap &&
              box.y < p.y + p.h + gap && p.y < box.y + box.h + gap) {
            box.y = p.y - gap - box.h;
            hit = true;
          }
        }
        if (!hit) break;
      }
      placed.push(box);
      a.drawSpeechBubble(ctx, box);
    }
  }

  // ---------------- construction: in-scene call to action ----------------
  /**
   * The farmhouse is the farm's single entry point: tapping it opens the
   * build/upgrade menu (Game.openBuild). There are no loose in-scene build
   * buttons — this draws the house layer only:
   *   - the ghosted placeholder while the house itself is unbuilt (the built
   *     house is baked into the background, see ENVIRONMENT.farm)
   *   - the ghosted fence footprint, so "you need a fence" still reads in
   *     the scene (a hint, not a button — it is not tappable)
   *   - the call-to-action indicator when a purchase is actually affordable
   * Registers the house's hit rect on this.ghosts.
   */
  drawHouse(ctx) {
    this.ghosts = [];
    if (!Construction.required(this.farmId)) return;
    const stage = Construction.stage(this.farmId);
    const hr = ENVIRONMENT.houseRect(this.farmId);
    const pulse = 0.55 + Math.sin(performance.now() / 380) * 0.2;

    if (stage === 'house') {
      // not built yet: a plain translucent ghost right where it will stand —
      // no outline or highlight around it, the badge is the only indicator
      ctx.globalAlpha = 0.45;
      ctx.drawImage(hr.img, hr.x, hr.y, hr.w, hr.h);
      ctx.globalAlpha = 1;
    } else if (stage === 'fence') {
      // outline the footprint the first fence tier will enclose
      const R = ENVIRONMENT.rectForLevel(this.farmId, 1);
      const gx = R.x - 12, gy = R.y - 20, gw = R.w + 24, gh = R.h + 14;
      this.dashedRect(ctx, gx, gy, gw, gh, pulse);
      // ghost posts at the corners so it reads as a fence, not a UI box
      const [face, hi] = ENVIRONMENT.fencePalette();
      ctx.globalAlpha = pulse * 0.55;
      for (const [px, py] of [[gx, gy], [gx + gw - 8, gy], [gx, gy + gh - 16], [gx + gw - 8, gy + gh - 16]]) {
        ctx.fillStyle = face; ctx.fillRect(px, py, 8, 16);
        ctx.fillStyle = hi; ctx.fillRect(px, py, 2, 16);
      }
      ctx.globalAlpha = 1;
    }

    this.ghosts.push({ id: 'house', x: hr.x - 8, y: hr.y - 8, w: hr.w + 16, h: hr.h + 16 });
    this.drawHouseCTA(ctx, hr);
  }

  /**
   * Is there a purchase the player can actually afford right now? While the
   * farm is still going up that means the next build step; once everything
   * is built the house is the way into the upgrade menu instead, so it
   * badges for an affordable upgrade. An undiscovered (locked) upgrade never
   * counts — the badge only ever signals a purchase that can be made (see
   * Upgrades.anyAffordable).
   */
  buildActionReady() {
    if (!Construction.required(this.farmId)) return false;
    if (Construction.stage(this.farmId) === 'max') {
      return SaveManager.data.upgradeTutorialDone && Upgrades.anyAffordable(this.farmId);
    }
    const inf = Construction.info(this.farmId);
    return !inf.maxed && SaveManager.data.coins >= inf.cost;
  }

  /**
   * Call-to-action on the house: the game's standard red "!" notification
   * badge (UI.drawBadge — the same component the UPGRADE button uses), and
   * nothing else. Pinned to the house sprite's top-right corner so it holds
   * at any resolution, clamped into UI.safeArea() to stay clear of the HUD.
   * Shown only when a real purchase is affordable, and suppressed while the
   * first-merge tutorial is running.
   */
  drawHouseCTA(ctx, hr) {
    if (this.tutorial || !this.buildActionReady()) return;
    const safe = UI.safeArea();
    const bx = U.clamp(hr.x + hr.w - 2, safe.x + 10, safe.x + safe.w - 10);
    const by = U.clamp(hr.y + 2, safe.y + 10, safe.y + safe.h - 10);
    UI.drawBadge(ctx, bx, by);
  }

  dashedRect(ctx, x, y, w, h, pulse) {
    ctx.save();
    ctx.globalAlpha = 0.45 + pulse * 0.4;
    ctx.strokeStyle = '#fff6e8';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 5]);
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
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
    UI.drawText(ctx, 'DRAG TO MERGE!', lx, ly, 8.5, '#fff6e8', 'center');
    ctx.restore();
  }
}
