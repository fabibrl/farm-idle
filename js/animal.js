/**
 * AnimalController — one instance per animal on the farm.
 * State machine: idle / walk / peck(graze) / drag / merging / spawning.
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
    this.shadowW = SPRITES.ANIMAL_SIZES[species][stage][0] * CONFIG.ANIMAL_VISUAL_SCALE * 0.6;
    return this;
  }

  get frameName() {
    if (this.state === 'peck') {
      // dip down during middle of the peck
      const t = this.stateT / this.stateDur;
      return (t % 0.5) > 0.22 ? 'peck' : 'idle';
    }
    if (this.state === 'walk' && !this.dragging) return (this.bob % (Math.PI * 2)) < Math.PI ? 'walk' : 'idle';
    return 'idle';
  }

  setState(state, dur) {
    this.state = state;
    this.stateT = 0;
    this.stateDur = dur;
  }

  chooseNext(bounds) {
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
    } else if (this.state === 'walk') {
      this.scaleY = 1 + Math.abs(Math.sin(this.bob)) * 0.05;
    }

    // poop production (not while spawning/merging)
    if (this.state !== 'spawning' && this.state !== 'merging') {
      this.poopT -= dt;
      if (this.poopT <= 0) {
        this.poopT = Upgrades.poopInterval(farm.farmId, this.stage) + U.rand(0, CONFIG.POOP_INTERVAL_JITTER);
        farm.dropPoop(this);
      }
    }
  }

  /** Visual bounce offset while walking. */
  get hopY() {
    return this.state === 'walk' && !this.dragging ? -Math.abs(Math.sin(this.bob)) * 3 : 0;
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
    ctx.globalAlpha = this.dragging ? 0.18 : 0.28;
    ctx.fillStyle = '#1c2b12';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 2, this.shadowW / 2 * this.scaleX, 4, 0, 0, 7);
    ctx.fill();
    ctx.globalAlpha = 1;
    PIXEL.blit(ctx, img, this.x, this.y + this.hopY + lift, sc, this.facing < 0, this.scaleY, this.scaleX);
  }
}
