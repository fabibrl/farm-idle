/**
 * MapScene — world map with three farm nodes, locked icons, map pins,
 * wooden name signs, and the rewarding golden unlock-path animation.
 */
class MapScene {
  constructor() {
    this.bg = ENVIRONMENT.worldMap();
    this.unlockAnim = null;   // {seg, t, farmId, phase}
    this.pinBob = 0;
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

    // nodes: pin (unlocked) or lock (locked) + wooden sign
    for (let i = 0; i < 3; i++) {
      const n = ENVIRONMENT.MAP_NODES[i];
      const unlocked = save.unlocked[i];
      const hideLock = a && a.farmId === i && (a.phase === 'burst');

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
        // dark overlay on locked plot
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#120c06';
        ctx.beginPath(); ctx.ellipse(n.x, n.y, 45, 33, 0, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
        PIXEL.blit(ctx, SPRITES.lock(), n.x, n.y + 14, 2);
      }

      // wooden sign with farm name
      UI.woodSign(ctx, n.x, n.y + 40, CONFIG.FARMS[i].name, CONFIG.FARMS[i].label,
        unlocked ? null : U.fmtCost(CONFIG.UNLOCK_COSTS[i]));
    }
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
