/**
 * VFXManager — pooled particles, flying coins, floating numbers,
 * transient glow effects. Zero per-frame allocations once warm.
 */
const VFXManager = (() => {
  const particles = [];
  const pool = new Pool(
    () => ({}),
    p => { p.dead = false; p.t = 0; }
  );

  function spawn(props) {
    const p = pool.get();
    Object.assign(p, {
      x: 0, y: 0, vx: 0, vy: 0, g: 0, life: 1, size: 3, col: '#fff',
      kind: 'square', img: null, text: null, targetX: null, targetY: null,
      speed: 0, onArrive: null, delay: 0,
    }, props);
    particles.push(p);
    return p;
  }

  /** Burst of colored squares (merge / unlock particles). */
  function burst(x, y, cols, n = 14, force = 90) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, f = U.rand(force * 0.4, force);
      spawn({
        x, y, vx: Math.cos(a) * f, vy: Math.sin(a) * f - 30,
        g: 160, life: U.rand(0.4, 0.8), size: U.randInt(2, 5),
        col: U.pick(cols), kind: 'square',
      });
    }
  }

  /** Soft dust puff at feet. */
  function dust(x, y, n = 5) {
    for (let i = 0; i < n; i++) {
      spawn({
        x: x + U.rand(-6, 6), y: y + U.rand(-2, 2),
        vx: U.rand(-18, 18), vy: U.rand(-24, -8), g: 20,
        life: U.rand(0.3, 0.55), size: U.randInt(2, 4),
        col: 'rgba(220,205,170,0.7)', kind: 'circle',
      });
    }
  }

  /** Golden sparkles. */
  function sparkle(x, y, n = 8, spread = 14) {
    for (let i = 0; i < n; i++) {
      spawn({
        x: x + U.rand(-spread, spread), y: y + U.rand(-spread, spread),
        vx: 0, vy: U.rand(-14, -4), g: 0,
        life: U.rand(0.35, 0.7), size: U.randInt(1, 3),
        col: U.pick(['#ffe98a', '#f4c437', '#fff6d0']), kind: 'star',
        delay: U.rand(0, 0.25),
      });
    }
  }

  /** Coin that flies to the HUD counter then triggers callback. */
  function flyCoin(x, y, tx, ty, onArrive) {
    spawn({
      x, y, targetX: tx, targetY: ty, speed: CONFIG.COIN_FLY_SPEED,
      life: 5, kind: 'coin', img: SPRITES.coin(2), onArrive,
      vx: U.rand(-50, 50), vy: U.rand(-120, -70), g: 0,
    });
  }

  /** Floating "+N" text. */
  function floatText(x, y, text, col = '#ffe98a') {
    spawn({ x, y, vx: 0, vy: -28, g: 0, life: 1.0, kind: 'text', text, col });
  }

  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.t += dt;
      if (p.kind === 'coin') {
        // brief hop then home to target
        if (p.t < 0.25) {
          p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt;
        } else {
          const d = U.dist(p.x, p.y, p.targetX, p.targetY);
          if (d < 14) {
            if (p.onArrive) p.onArrive();
            p.dead = true;
          } else {
            const sp = p.speed * dt;
            p.x += (p.targetX - p.x) / d * sp;
            p.y += (p.targetY - p.y) / d * sp;
          }
        }
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += p.g * dt;
      }
      if (p.t >= p.life || p.dead) {
        particles.splice(i, 1);
        pool.release(p);
      }
    }
  }

  function draw(ctx) {
    for (const p of particles) {
      if (p.delay > 0) continue;
      const a = U.clamp(1 - p.t / p.life, 0, 1);
      ctx.globalAlpha = a;
      if (p.kind === 'square') {
        ctx.fillStyle = p.col;
        ctx.fillRect(p.x - p.size / 2 | 0, p.y - p.size / 2 | 0, p.size, p.size);
      } else if (p.kind === 'circle') {
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 1, 0, 7); ctx.fill();
      } else if (p.kind === 'star') {
        ctx.fillStyle = p.col;
        const s = p.size;
        ctx.fillRect(p.x - s, p.y, s * 2 + 1, 1);
        ctx.fillRect(p.x, p.y - s, 1, s * 2 + 1);
      } else if (p.kind === 'coin') {
        const wob = 1 + Math.sin(p.t * 20) * 0.12;
        ctx.globalAlpha = 1;
        ctx.drawImage(p.img, p.x - 12, p.y - 12 * wob, 24, 24 * wob);
      } else if (p.kind === 'text') {
        UI.drawText(ctx, p.text, p.x, p.y, UI.SIZE.BODY, p.col, 'center', true);
      }
      ctx.globalAlpha = 1;
    }
  }

  return { burst, dust, sparkle, flyCoin, floatText, update, draw };
})();
