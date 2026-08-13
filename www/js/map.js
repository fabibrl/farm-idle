/**
 * MapScene — world map with three farm nodes, locked icons, map pins,
 * wooden name signs, and the rewarding golden unlock-path animation.
 */
class MapScene {
  constructor() {
    this.bg = ENVIRONMENT.worldMap();
    this.unlockAnim = null;   // {seg, t, farmId, phase}
    this.pinBob = 0;
    this.time = 0;
    this.smoke = [];          // rising chimney puffs {x,y,age,life,drift}
    this.smokeT = 0;
  }

  /** Begin glowing-path unlock animation toward farmId. */
  playUnlock(farmId) {
    this.unlockAnim = {
      farmId,
      seg: farmId - 1,          // path segment leading to this farm
      t: 0,
      phase: 'pause',           // pause -> path -> burst -> done
      pauseT: CONFIG.UNLOCK_CAMERA_PAUSE,
    };
    AudioManager.play('unlock');
  }

  update(dt) {
    this.pinBob += dt * 4;
    this.time += dt;

    // chimney smoke from unlocked farms
    this.smokeT -= dt;
    if (this.smokeT <= 0) {
      this.smokeT = 0.9 + Math.random() * 0.5;
      for (let i = 0; i < 3; i++) {
        const ch = ENVIRONMENT.THEME[i].chimney;
        if (ch && SaveManager.data.unlocked[i]) {
          this.smoke.push({ x: ch.x, y: ch.y, age: 0, life: 2.2 + Math.random(), drift: 4 + Math.random() * 6 });
        }
      }
    }
    for (const p of this.smoke) { p.age += dt; }
    this.smoke = this.smoke.filter(p => p.age < p.life);

    const a = this.unlockAnim;
    if (!a) return;
    if (a.phase === 'pause') {
      a.pauseT -= dt;
      if (a.pauseT <= 0) a.phase = 'path';
    } else if (a.phase === 'path') {
      a.t += dt / CONFIG.UNLOCK_PATH_TIME;
      // sprinkle sparkles along the advancing head of the path
      const pts = ENVIRONMENT.roadPoints(a.seg);
      const head = pts[Math.min(pts.length - 1, Math.floor(a.t * pts.length))];
      if (Math.random() < 0.8) VFXManager.sparkle(head.x, head.y, 2, 8);
      if (a.t >= 1) {
        a.phase = 'burst';
        a.burstT = 0;
        const n = ENVIRONMENT.MAP_NODES[a.farmId];
        VFXManager.burst(n.x, n.y - 10, ['#ffe98a', '#f4c437', '#ffffff', '#a07cc0'], 26, 130);
        VFXManager.sparkle(n.x, n.y - 16, 16, 34);
      }
    } else if (a.phase === 'burst') {
      a.burstT += dt;
      if (a.burstT > 1.1) {
        this.unlockAnim = null;
        Game.onUnlockAnimDone(a.farmId);
      }
    }
  }

  draw(ctx) {
    ctx.drawImage(this.bg, 0, 0);
    const save = SaveManager.data;
    const a = this.unlockAnim;

    // glowing unlock path
    if (a && (a.phase === 'path' || a.phase === 'burst')) {
      const pts = ENVIRONMENT.roadPoints(a.seg);
      const upTo = a.phase === 'burst' ? pts.length : Math.floor(a.t * pts.length);
      ctx.save();
      ctx.strokeStyle = '#ffe98a';
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.shadowColor = '#f4c437';
      ctx.shadowBlur = 12;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < upTo; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      ctx.restore();
      // dotted gold core
      ctx.fillStyle = '#fff6d0';
      for (let i = 0; i < upTo; i += 4) ctx.fillRect(pts[i].x - 1, pts[i].y - 1, 3, 3);
    }

    // nodes: themed idle animations, pin (unlocked) or chains+lock (locked), sign
    for (let i = 0; i < 3; i++) {
      const n = ENVIRONMENT.MAP_NODES[i];
      const theme = ENVIRONMENT.THEME[i];
      const unlocked = save.unlocked[i];
      const hideLock = a && a.farmId === i && (a.phase === 'burst');

      // waving grass tufts (static when locked)
      for (let t = 0; t < theme.grass.length; t++) {
        const gp = theme.grass[t];
        const sway = unlocked ? Math.round(Math.sin(this.time * 2.2 + t * 1.7 + i) * 2) : 0;
        ctx.fillStyle = '#8ab656';
        ctx.fillRect(gp.x + sway, gp.y - 8, 2, 4); ctx.fillRect(gp.x, gp.y - 4, 2, 4);
        ctx.fillRect(gp.x + 5, gp.y - 5, 2, 5);
        ctx.fillStyle = '#6a9840';
        ctx.fillRect(gp.x + 9 + sway, gp.y - 7, 2, 3); ctx.fillRect(gp.x + 9, gp.y - 4, 2, 4);
      }

      // spinning windmill blades (frozen when locked)
      if (theme.windmill) {
        const frame = unlocked ? Math.floor(this.time * 7) % 4 : 0;
        const bl = SPRITES.windmillBlades(frame);
        ctx.drawImage(bl, theme.windmill.x - 28, theme.windmill.y - 28, 56, 56);
      }

      // species mascot next to the farmhouse — readable before entering
      // (animated when unlocked, standing still on locked previews)
      const species = CONFIG.FARMS[i].species;
      const frame = unlocked && Math.sin(this.time * 1.6 + i * 2.1) > 0.55 ? 'peck' : 'idle';
      const blink = unlocked && Math.sin(this.time * 3 + i) > 0.96;
      PIXEL.blit(ctx, SPRITES.animal(species, 1, frame, blink), theme.animal.x, theme.animal.y, 2, i === 1);

      if (unlocked) {
        const pin = SPRITES.mapPin();
        const bob = Math.sin(this.pinBob + i) * 3;
        const isCurrent = save.currentFarm === i;
        PIXEL.blit(ctx, pin, n.x, n.y - 8 + bob, isCurrent ? 2.4 : 2);
        if (isCurrent) {
          ctx.globalAlpha = 0.5 + Math.sin(this.pinBob * 1.5) * 0.25;
          ctx.strokeStyle = '#ffe98a'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(n.x, n.y + 4, 18, 8, 0, 0, 7); ctx.stroke();
          ctx.globalAlpha = 1;
        }
      } else if (!hideLock) {
        // locked: just a lock icon centered over the themed plot — the farm
        // itself stays fully visible as a preview
        PIXEL.blit(ctx, SPRITES.lock(), n.x, n.y + 16, 2);
      }

      // wooden sign with farm name
      UI.woodSign(ctx, n.x, n.y + 40, CONFIG.FARMS[i].name, CONFIG.FARMS[i].label,
        unlocked ? null : U.fmtCost(CONFIG.UNLOCK_COSTS[i]));
    }

    // chimney smoke puffs (spawned only for unlocked farms)
    for (const p of this.smoke) {
      const k = p.age / p.life;
      const size = 4 + k * 8;
      ctx.globalAlpha = 0.45 * (1 - k);
      ctx.fillStyle = '#d8d2c8';
      ctx.fillRect(
        Math.round(p.x + Math.sin(p.age * 3) * 2 + k * p.drift - size / 2),
        Math.round(p.y - k * 26 - size / 2),
        Math.round(size), Math.round(size));
    }
    ctx.globalAlpha = 1;
  }

  /** Hit-test: returns farm id or -1. */
  tappedFarm(x, y) {
    for (let i = 0; i < 3; i++) {
      const n = ENVIRONMENT.MAP_NODES[i];
      if (U.dist(x, y, n.x, n.y) < 52) return i;
    }
    return -1;
  }
}
