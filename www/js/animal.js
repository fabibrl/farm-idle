/**
 * AnimalController — one instance per animal on the farm.
 * State machine: idle / walk / peck(graze) / drag / merging / spawning /
 * escape (unfenced construction farms only, see startEscape).
 * Handles blinking, breathing squash, walk bounce, poop production.
 */
class Animal {
  constructor(species, stage, x, y) {
    this.init(species, stage, x, y);
  }

  init(species, stage, x, y) {
    this.species = species;
    this.stage = stage;
    this.x = x; this.y = y;
    this.homeX = x; this.homeY = y;
    this.facing = Math.random() < 0.5 ? 1 : -1;
    this.state = 'spawning';
    this.stateT = 0;
    this.stateDur = CONFIG.SPAWN_POP_TIME;
    this.walkDx = 0; this.walkDy = 0;
    this.speed = U.rand(CONFIG.WALK_SPEED_MIN, CONFIG.WALK_SPEED_MAX);
    this.blinkT = U.rand(CONFIG.BLINK_INTERVAL_MIN, CONFIG.BLINK_INTERVAL_MAX);
    this.blinking = 0;
    this.bob = Math.random() * Math.PI * 2;
    this.poopT = U.rand(1, CONFIG.POOP_INTERVAL + CONFIG.POOP_INTERVAL_JITTER);
    this.dragging = false;
    this.dead = false;
    this.scaleX = 1; this.scaleY = 1;
    this.alpha = 1;
    // escape (house built, no fence): own countdown per animal so they
    // leave staggered — set by FarmScene, see Construction.escapeDelay()
    this.escapeT = Infinity;
    this.escaping = false;
    this.escapeCfg = null;
    this.shadowW = SPRITES.ANIMAL_SIZES[species][stage][0] * CONFIG.ANIMAL_VISUAL_SCALE * 0.6;
    return this;
  }

  get frameName() {
    if (this.state === 'peck') {
      // dip down during middle of the peck
      const t = this.stateT / this.stateDur;
      return (t % 0.5) > 0.22 ? 'peck' : 'idle';
    }
    const walking = this.state === 'walk' || (this.state === 'escape' && this.escPhase === 'go');
    if (walking && !this.dragging) return (this.bob % (Math.PI * 2)) < Math.PI ? 'walk' : 'idle';
    return 'idle';
  }

  setState(state, dur) {
    this.state = state;
    this.stateT = 0;
    this.stateDur = dur;
  }

  /**
   * Start wandering off the plot: the animal idles a beat, then drifts
   * toward the nearest open edge with the normal walk animation and fades
   * out past the boundary. Called by FarmScene once this animal's own
   * escape timer runs out (house built, no fence). A successful match
   * cancels it simply by removing the animal from the board.
   */
  startEscape(bounds, cfg) {
    if (this.escaping) return;
    this.escaping = true;
    this.escapeCfg = cfg;
    // nearest open edge — left, right or bottom (the house sits at the top)
    const dl = this.x - bounds.x;
    const dr = bounds.x + bounds.w - this.x;
    const db = bounds.y + bounds.h - this.y;
    const m = Math.min(dl, dr, db);
    if (m === dl)      { this.exitX = bounds.x - 60; this.exitY = this.y + U.rand(-20, 30); }
    else if (m === dr) { this.exitX = bounds.x + bounds.w + 60; this.exitY = this.y + U.rand(-20, 30); }
    else               { this.exitX = this.x + U.rand(-40, 40); this.exitY = bounds.y + bounds.h + 70; }
    this.escPhase = 'pause';
    this.legT = 0;
    this.wobble = 0;
    this.setState('escape', U.rand(cfg.ESCAPE_PAUSE_MIN, cfg.ESCAPE_PAUSE_MAX));
  }

  chooseNext(bounds) {
    // an animal already on its way out never returns to normal wandering
    if (this.escaping) { this.escPhase = 'go'; this.setState('escape', 1e9); return; }
    if (Math.random() < CONFIG.PECK_CHANCE) {
      this.setState('peck', U.rand(1.0, 2.0));
    } else if (Math.random() < 0.55) {
      // pick a wander target direction
      const a = Math.random() * Math.PI * 2;
      this.walkDx = Math.cos(a); this.walkDy = Math.sin(a) * 0.6;
      if (this.walkDx !== 0) this.facing = this.walkDx > 0 ? 1 : -1;
      this.setState('walk', U.rand(CONFIG.WALK_TIME_MIN, CONFIG.WALK_TIME_MAX));
    } else {
      this.setState('idle', U.rand(CONFIG.IDLE_TIME_MIN, CONFIG.IDLE_TIME_MAX));
    }
  }

  update(dt, bounds, farm) {
    this.stateT += dt;
    this.bob += dt * (this.state === 'walk' ? 10 : 3);

    // blinking
    this.blinkT -= dt;
    if (this.blinkT <= 0) {
      this.blinking = 0.12;
      this.blinkT = U.rand(CONFIG.BLINK_INTERVAL_MIN, CONFIG.BLINK_INTERVAL_MAX);
    }
    if (this.blinking > 0) this.blinking -= dt;

    if (this.dragging) {
      // slight lift wobble while dragged
      this.scaleX = U.lerp(this.scaleX, 1.06, dt * 10);
      this.scaleY = U.lerp(this.scaleY, 1.06, dt * 10);
      return;
    }

    switch (this.state) {
      case 'spawning': {
        const t = U.clamp(this.stateT / this.stateDur, 0, 1);
        const s = U.easeOutBack(t);
        this.scaleX = s; this.scaleY = s;
        if (t >= 1) { this.scaleX = this.scaleY = 1; this.chooseNext(bounds); }
        break;
      }
      case 'merging': {
        // shrink into the merge point
        const t = U.clamp(this.stateT / this.stateDur, 0, 1);
        this.x = U.lerp(this.x, this.mergeX, dt * 14);
        this.y = U.lerp(this.y, this.mergeY, dt * 14);
        this.scaleX = this.scaleY = 1 - U.easeInCubic(t) * 0.9;
        if (t >= 1) this.dead = true;
        break;
      }
      case 'return': {
        const d = U.dist(this.x, this.y, this.homeX, this.homeY);
        if (d < 3) { this.x = this.homeX; this.y = this.homeY; this.chooseNext(bounds); }
        else {
          this.x += (this.homeX - this.x) / d * 220 * dt;
          this.y += (this.homeY - this.y) / d * 220 * dt;
        }
        break;
      }
      case 'walk': {
        this.x += this.walkDx * this.speed * dt;
        this.y += this.walkDy * this.speed * dt;
        // clamp to pen; bounce off edges
        if (this.x < bounds.x) { this.x = bounds.x; this.walkDx *= -1; this.facing *= -1; }
        if (this.x > bounds.x + bounds.w) { this.x = bounds.x + bounds.w; this.walkDx *= -1; this.facing *= -1; }
        if (this.y < bounds.y) { this.y = bounds.y; this.walkDy *= -1; }
        if (this.y > bounds.y + bounds.h) { this.y = bounds.y + bounds.h; this.walkDy *= -1; }
        if (this.stateT >= this.stateDur) this.chooseNext(bounds);
        break;
      }
      case 'escape': {
        const cfg = this.escapeCfg;
        if (this.escPhase === 'pause') {
          if (this.stateT >= this.stateDur) { this.escPhase = 'go'; this.setState('escape', 1e9); }
          break;
        }
        // drift toward the exit, re-aiming every leg with a random angle
        // offset so the walk reads as wandering, not a scripted straight line
        this.legT -= dt;
        if (this.legT <= 0) {
          this.legT = U.rand(0.5, 1.2);
          this.wobble = U.rand(-0.55, 0.55);
        }
        const ang = Math.atan2(this.exitY - this.y, this.exitX - this.x) + this.wobble;
        this.x += Math.cos(ang) * cfg.ESCAPE_SPEED * dt;
        this.y += Math.sin(ang) * cfg.ESCAPE_SPEED * 0.7 * dt;
        this.facing = Math.cos(ang) > 0 ? 1 : -1;
        // fade out once past the plot boundary, then leave the board for good
        const out = this.x < bounds.x - 10 || this.x > bounds.x + bounds.w + 10 ||
                    this.y > bounds.y + bounds.h + 12;
        if (out) {
          this.alpha -= dt / cfg.ESCAPE_FADE;
          if (this.alpha <= 0) { this.alpha = 0; this.dead = true; this.escaped = true; }
        }
        break;
      }
      case 'peck':
      case 'idle': {
        if (this.stateT >= this.stateDur) this.chooseNext(bounds);
        break;
      }
    }

    // breathing squash (idle) / bounce (walk)
    if (this.state === 'idle' || this.state === 'peck') {
      this.scaleY = 1 + Math.sin(this.bob) * 0.02;
      this.scaleX = 1 - Math.sin(this.bob) * 0.015;
    } else if (this.state === 'walk' || (this.state === 'escape' && this.escPhase === 'go')) {
      this.scaleY = 1 + Math.abs(Math.sin(this.bob)) * 0.05;
    }

    // poop production (not while spawning/merging, and never once an animal
    // has started walking off the farm — an escapee produces nothing)
    if (this.state !== 'spawning' && this.state !== 'merging' && !this.escaping) {
      this.poopT -= dt;
      if (this.poopT <= 0) {
        this.poopT = Upgrades.poopInterval(farm.farmId, this.stage) + U.rand(0, CONFIG.POOP_INTERVAL_JITTER);
        farm.dropPoop(this);
      }
    }
  }

  /** Visual bounce offset while walking. */
  get hopY() {
    const walking = this.state === 'walk' || (this.state === 'escape' && this.escPhase === 'go');
    return walking && !this.dragging ? -Math.abs(Math.sin(this.bob)) * 3 : 0;
  }

  get img() {
    return SPRITES.animal(this.species, this.stage, this.frameName, this.blinking > 0);
  }

  /** Approximate radius for hit tests. */
  get radius() {
    return SPRITES.ANIMAL_SIZES[this.species][this.stage][0] * CONFIG.PIXEL_SCALE * 0.5;
  }

  draw(ctx) {
    const img = this.img;
    const sc = CONFIG.ANIMAL_VISUAL_SCALE;
    const lift = this.dragging ? -10 : 0;
    // soft shadow
    ctx.globalAlpha = (this.dragging ? 0.18 : 0.28) * this.alpha;
    ctx.fillStyle = '#1c2b12';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 2, this.shadowW / 2 * this.scaleX, 4, 0, 0, 7);
    ctx.fill();
    ctx.globalAlpha = this.alpha;
    PIXEL.blit(ctx, img, this.x, this.y + this.hopY + lift, sc, this.facing < 0, this.scaleY, this.scaleX);
    ctx.globalAlpha = 1;
    // fleeing cue: a bobbing "!" so the stage reads as "you need a fence"
    if (this.escaping && this.alpha > 0.15) this.drawFleeCue(ctx);
  }

  /** Small alarm bubble over an animal that has started walking off. */
  drawFleeCue(ctx) {
    const t = performance.now() / 1000;
    const y = this.y - this.radius * 1.7 - 16 + Math.sin(t * 6) * 2;
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.fillRect(this.x - 6, y - 8, 12, 16);
    ctx.fillStyle = '#c0453a';
    ctx.fillRect(this.x - 4, y - 6, 8, 12);
    ctx.fillStyle = '#fff6e8';
    ctx.fillRect(this.x - 1, y - 4, 2, 6);
    ctx.fillRect(this.x - 1, y + 3, 2, 2);
    ctx.globalAlpha = 1;
  }
}
