/**
 * AnimalController — one instance per animal on the farm.
 * State machine: idle / walk / peck(graze) / drag / merging / spawning /
 * escape (walking off an unfenced farm, or jumping a full pen's fence —
 * see startEscape; an escaping animal is locked out of all interaction and
 * says goodbye in a speech bubble on its way out).
 * Handles blinking, breathing squash, walk bounce, poop production.
 */
/**
 * Farewell — the line an escaping animal says on its way out. Draws from a
 * reshuffled bag of CONFIG.ESCAPE.LINES rather than picking blind, so a
 * burst of escapes cycles the whole pool and never repeats back to back.
 */
const Farewell = (() => {
  let bag = [];
  let last = null;

  function next() {
    const pool = CONFIG.ESCAPE.LINES;
    if (!pool || !pool.length) return null;
    if (!bag.length) {
      bag = pool.slice();
      for (let i = bag.length - 1; i > 0; i--) {
        const j = U.randInt(0, i);
        const t = bag[i]; bag[i] = bag[j]; bag[j] = t;
      }
      // guard the seam between two bags: the next line out must differ
      // from the one the previous bag ended on
      if (bag.length > 1 && bag[bag.length - 1] === last) {
        const t = bag[bag.length - 1]; bag[bag.length - 1] = bag[0]; bag[0] = t;
      }
    }
    last = bag.pop();
    return last;
  }

  return { next };
})();

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
    this.escapeMode = null;
    this.escPhase = null;
    this.arcY = 0;       // hop/jump height offset (visual only)
    this.cueT = 0;       // time since the escape tell started
    this.farewell = null;   // goodbye line + which side its bubble sits on
    this.bubbleSide = 1;
    this.shadowW = SPRITES.ANIMAL_SIZES[species][stage][0] * CONFIG.ANIMAL_VISUAL_SCALE * 0.6;
    return this;
  }

  get frameName() {
    if (this.state === 'peck') {
      // dip down during middle of the peck
      const t = this.stateT / this.stateDur;
      return (t % 0.5) > 0.22 ? 'peck' : 'idle';
    }
    if (this.state === 'escape' && this.escPhase === 'hop') return 'walk';
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
   * Leave the farm for good. The animal is locked out of interaction from
   * this moment (it can no longer be picked up or matched), so the sequence
   * opens with a readable tell — a startled hop, the "!" cue popping in and
   * a brief opacity blink — before it sets off:
   *   mode 'walk' — wanders out through the nearest open edge (unfenced farm)
   *   mode 'jump' — hops the fence in an arc, then trots away (full pen);
   *                 `jump` carries that farm's Construction.jumpCfg()
   * Either way it produces nothing on the way out and never comes back.
   * Only the constructed farm ever calls this — see FarmScene.
   */
  startEscape(bounds, mode = 'walk', jump = null) {
    if (this.escaping) return;
    const cfg = CONFIG.ESCAPE;
    this.escaping = true;
    this.escapeCfg = cfg;
    this.escapeMode = mode === 'jump' && jump ? 'jump' : 'walk';
    this.dragging = false;
    // nearest open edge — left, right or bottom (the house sits at the top)
    const dl = this.x - bounds.x;
    const dr = bounds.x + bounds.w - this.x;
    const db = bounds.y + bounds.h - this.y;
    const m = Math.min(dl, dr, db);
    if (m === dl)      { this.exitX = bounds.x - 60; this.exitY = this.y + U.rand(-20, 30); }
    else if (m === dr) { this.exitX = bounds.x + bounds.w + 60; this.exitY = this.y + U.rand(-20, 30); }
    else               { this.exitX = this.x + U.rand(-40, 40); this.exitY = bounds.y + bounds.h + 70; }
    // the jump clears the fence line itself before the walk-away leg
    if (mode === 'jump' && jump) {
      const J = jump;
      this.jumpFromX = this.x; this.jumpFromY = this.y;
      if (m === dl)      { this.jumpToX = bounds.x - 30; this.jumpToY = this.y; }
      else if (m === dr) { this.jumpToX = bounds.x + bounds.w + 30; this.jumpToY = this.y; }
      else               { this.jumpToX = this.x; this.jumpToY = bounds.y + bounds.h + 34; }
      this.jumpDur = J.HOP_TIME;
      this.jumpH = J.HOP_HEIGHT;
    }
    this.escPhase = 'tell';
    this.arcY = 0;
    this.legT = 0;
    this.wobble = 0;
    this.cueT = 0;
    // the goodbye bubble opens on the same beat as the tell; it sits on the
    // side the animal is leaving *from*, so it trails rather than covering
    // the ground ahead (bubbleBox flips it back at the view edges)
    this.farewell = Farewell.next();
    this.bubbleSide = this.exitX > this.x ? -1 : 1;
    this.setState('escape', U.rand(cfg.TELL_MIN, cfg.TELL_MAX));
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
        this.cueT += dt;
        if (this.escPhase === 'tell') {
          // the tell: startled hops in place + a brief opacity blink, so the
          // player sees why this animal has stopped responding
          const k = U.clamp(this.stateT / this.stateDur, 0, 1);
          this.arcY = -Math.abs(Math.sin(k * Math.PI * cfg.TELL_HOPS)) * cfg.TELL_HOP_H;
          this.alpha = 0.72 + Math.abs(Math.sin(k * Math.PI * 4)) * 0.28;
          if (this.stateT >= this.stateDur) {
            this.arcY = 0;
            this.alpha = 1;
            this.escPhase = this.escapeMode === 'jump' ? 'hop' : 'go';
            this.setState('escape', this.escapeMode === 'jump' ? this.jumpDur : 1e9);
          }
          break;
        }
        if (this.escPhase === 'hop') {
          // deliberate arc over the fence, with a takeoff/landing squash
          const k = U.clamp(this.stateT / this.stateDur, 0, 1);
          this.x = U.lerp(this.jumpFromX, this.jumpToX, k);
          this.y = U.lerp(this.jumpFromY, this.jumpToY, k);
          this.arcY = -Math.sin(k * Math.PI) * this.jumpH;
          const stretch = Math.sin(k * Math.PI);
          this.scaleY = 1 + stretch * 0.16;
          this.scaleX = 1 - stretch * 0.10;
          if (this.jumpToX !== this.jumpFromX) this.facing = this.jumpToX > this.jumpFromX ? 1 : -1;
          if (k >= 1) {
            this.arcY = 0;
            this.scaleX = this.scaleY = 1;
            this.escPhase = 'go';
            this.setState('escape', 1e9);
          }
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
        this.x += Math.cos(ang) * cfg.SPEED * dt;
        this.y += Math.sin(ang) * cfg.SPEED * 0.7 * dt;
        this.facing = Math.cos(ang) > 0 ? 1 : -1;
        // fade out once past the boundary, then leave the board for good
        const out = this.x < bounds.x - 10 || this.x > bounds.x + bounds.w + 10 ||
                    this.y > bounds.y + bounds.h + 12;
        if (out) {
          this.alpha -= dt / cfg.FADE;
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
    // arcY lifts the sprite off the ground for the startled hops and the
    // fence jump; the shadow stays on the ground and shrinks with the height
    const arc = this.arcY || 0;
    const lift = (this.dragging ? -10 : 0) + arc;
    const airborne = U.clamp(1 - Math.abs(arc) / 46, 0.45, 1);
    // soft shadow
    ctx.globalAlpha = (this.dragging ? 0.18 : 0.28) * this.alpha * airborne;
    ctx.fillStyle = '#1c2b12';
    ctx.beginPath();
    ctx.ellipse(this.x, this.y + 2, this.shadowW / 2 * this.scaleX * airborne, 4 * airborne, 0, 0, 7);
    ctx.fill();
    ctx.globalAlpha = this.alpha;
    PIXEL.blit(ctx, img, this.x, this.y + this.hopY + lift, sc, this.facing < 0, this.scaleY, this.scaleX);
    ctx.globalAlpha = 1;
    // the tell / fleeing cue: an alarm bubble for as long as it is leaving
    if (this.escaping && this.alpha > 0.15) this.drawFleeCue(ctx);
  }

  /**
   * Alarm bubble over an animal that is leaving: pops in on the first beat
   * of the tell (the moment it stops responding to input) and rides along
   * until it is gone.
   */
  drawFleeCue(ctx) {
    const t = performance.now() / 1000;
    const pop = U.easeOutBack(U.clamp(this.cueT / 0.22, 0, 1));
    if (pop <= 0) return;
    const y = this.y + (this.arcY || 0) - this.radius * 1.7 - 16 + Math.sin(t * 6) * 2;
    ctx.save();
    ctx.translate(this.x, y);
    ctx.scale(pop, pop);
    ctx.translate(-this.x, -y);
    ctx.globalAlpha = this.alpha;
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.fillRect(this.x - 6, y - 8, 12, 16);
    ctx.fillStyle = '#c0453a';
    ctx.fillRect(this.x - 4, y - 6, 8, 12);
    ctx.fillStyle = '#fff6e8';
    ctx.fillRect(this.x - 1, y - 4, 2, 6);
    ctx.fillRect(this.x - 1, y + 3, 2, 2);
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  /**
   * Opacity of the farewell bubble: it tracks the animal's own fade but
   * bottoms out early (FADE_FLOOR), so the words are gone slightly before
   * the animal is — never a bubble hanging over empty ground.
   */
  get bubbleAlpha() {
    const f = CONFIG.ESCAPE.BUBBLE.FADE_FLOOR;
    return U.clamp((this.alpha - f) / (1 - f), 0, 1);
  }

  /**
   * Where the farewell bubble sits this frame (null if it has nothing to
   * say). Anchored above the "!" tell cue and offset to one side; the side
   * flips, then the whole box clamps, if it would run off the view.
   * FarmScene owns the drawing so it can de-overlap several at once.
   */
  bubbleBox() {
    if (!this.escaping || !this.farewell || this.bubbleAlpha <= 0) return null;
    const B = CONFIG.ESCAPE.BUBBLE;
    const w = Math.round(PixelFont.measure(this.farewell, B.TEXT)) + B.PAD_X * 2;
    const h = Math.round(PixelFont.snap(B.TEXT)) + B.PAD_Y * 2;
    // top of the "!" cue (see drawFleeCue) — the bubble stacks above it, so
    // neither one ever covers the animal's body or the fence line
    const cueTop = this.y + (this.arcY || 0) - this.radius * 1.7 - 24;
    const half = w / 2;
    let cx = this.x + this.bubbleSide * B.DX;
    if (cx - half < B.MARGIN) cx = this.x + B.DX;
    else if (cx + half > CONFIG.VIEW_W - B.MARGIN) cx = this.x - B.DX;
    cx = U.clamp(cx, B.MARGIN + half, CONFIG.VIEW_W - B.MARGIN - half);
    const bottom = cueTop - B.DY;
    return { x: Math.round(cx - half), y: Math.round(bottom - h), w, h, tailX: this.x };
  }

  /**
   * Cartoon speech bubble with a tail pointing down at the animal: cream
   * face, the art bible's dark outline, game font inside, and a short
   * scale-up pop so it reads as playful rather than as an error message.
   */
  drawSpeechBubble(ctx, box) {
    const B = CONFIG.ESCAPE.BUBBLE;
    const pop = U.easeOutBack(U.clamp(this.cueT / B.POP, 0, 1));
    if (pop <= 0) return;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    const tailX = Math.round(U.clamp(box.tailX, box.x + 6, box.x + box.w - 6));
    ctx.save();
    ctx.globalAlpha = this.bubbleAlpha;
    ctx.translate(cx, cy);
    ctx.scale(pop, pop);
    ctx.translate(-cx, -cy);
    // outline pass (box + tail), then the cream face inset by 1px
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.fillRect(box.x, box.y, box.w, box.h);
    for (let i = 0; i < 4; i++) ctx.fillRect(tailX - 3 + i, box.y + box.h + i, 4 - i, 1);
    ctx.fillStyle = '#fff6e8';
    ctx.fillRect(box.x + 1, box.y + 1, box.w - 2, box.h - 2);
    for (let i = 0; i < 3; i++) ctx.fillRect(tailX - 3 + i, box.y + box.h - 1 + i, 3 - i, 1);
    UI.drawText(ctx, this.farewell, cx, box.y + B.PAD_Y, B.TEXT, PIXEL.OUTLINE, 'center');
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
