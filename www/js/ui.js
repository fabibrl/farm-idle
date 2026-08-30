/**
 * UIManager — HUD, buttons, popups and wooden panels. All typography
 * renders through the global 'pixel-art-font' engine (js/font.js).
 */
const UI = (() => {
  const W = CONFIG.VIEW_W, H = CONFIG.VIEW_H;
  const P = () => SPRITES.P;

  // ---------------- typography ('pixel-art-font') ----------------
  // SIZE is the hierarchy scale (TITLE 20 / SUBTITLE 15 / BUTTON+BODY 10 /
  // CAPTION 5). drawText/measure keep the historical signature so every
  // module (farm, ufo, pigeon, tornado, vfx) shares this one text path.
  const SIZE = PixelFont.SIZE;

  function measure(text, size) { return PixelFont.measure(text, size); }

  function drawText(ctx, text, x, y, size = SIZE.BODY, col = '#fff', align = 'left', outline = false, shadow = false, maxWidth = 0) {
    return PixelFont.draw(ctx, text, x, y, size, col, align, outline, shadow, maxWidth);
  }

  /**
   * Popup title bar + centered title, geometry from Figma E04 (19:72/19:78):
   * outline at (px+8, py-15) w pw-16 h 33, dark wood face, 3.5px bevels,
   * seam at py+0.5; title 13px #ffe98a with em-top at py-5.
   */
  function popupTitle(ctx, text, px, py, pw, opts = {}) {
    const p = P();
    // E04's bar (19:72) is 33 tall with 3.5px bevels; the others (20:70 etc.)
    // use the 30-tall bar with 3px bevels
    const tall = !!opts.tall;
    const bt = tall ? py - 15 : py - 12;      // outline top
    const bh = tall ? 33 : 30;
    const ft = bt + 2, fh = bh - 4;           // face
    const bev = tall ? 3.5 : 3;
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.fillRect(px + 8, bt, pw - 16, bh);
    ctx.fillStyle = p.woodDk;
    ctx.fillRect(px + 10, ft, pw - 20, fh);
    ctx.fillStyle = p.wood;
    ctx.fillRect(px + 10, ft, pw - 20, bev);
    ctx.fillStyle = p.woodDkr;
    ctx.fillRect(px + 10, ft + fh - bev, pw - 20, bev);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(px + 10, ft + fh / 2 - 1, pw - 20, 1);
    const maxW = pw - 76;
    const base = opts.size || 13;
    const ts = PixelFont.fit(text, base, maxW);
    const top = opts.top !== undefined ? opts.top : (tall ? py - 5 : py - 3);
    drawText(ctx, text, px + pw / 2, top + (base - ts) / 2, ts, '#ffe98a', 'center', false, false, maxW);
  }

  // ---------------- wooden panels ----------------
  function woodPanel(ctx, x, y, w, h, opts = {}) {
    const p = P();
    // outline
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    // base
    ctx.fillStyle = opts.dark ? p.woodDk : p.wood;
    ctx.fillRect(x, y, w, h);
    // top light bevel, bottom dark bevel
    ctx.fillStyle = opts.dark ? p.wood : p.woodHi;
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = p.woodDkr;
    ctx.fillRect(x, y + h - 3, w, 3);
    // plank seams
    if (opts.seams !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (let py = y + 12; py < y + h - 6; py += 14) ctx.fillRect(x, py, w, 1);
    }
    // wood grain flecks (Figma panels without them pass flecks: false)
    if (opts.flecks !== false) {
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      for (let i = 0; i < w * h / 260; i++) {
        ctx.fillRect(x + ((i * 53) % (w - 8)) + 4, y + ((i * 37) % (h - 10)) + 5, 4, 1);
      }
    }
    if (opts.gold) {
      // gold corner studs
      ctx.fillStyle = p.gold;
      for (const [cx, cy] of [[x + 4, y + 4], [x + w - 7, y + 4], [x + 4, y + h - 7], [x + w - 7, y + h - 7]]) {
        ctx.fillRect(cx, cy, 3, 3);
        ctx.fillStyle = p.goldHi; ctx.fillRect(cx, cy, 1, 1); ctx.fillStyle = p.gold;
      }
    }
  }

  /** Dark inset capsule (coin counter background). */
  function inset(ctx, x, y, w, h) {
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#3a2817';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#2e1f10';
    ctx.fillRect(x, y, w, 2);
  }

  /**
   * Figma upgrade-button component (46:67, "Upgrades — States" page):
   * seven `state` variants sharing one geometry — only fills, opacity,
   * icons and label change. All values are Figma px / 2, offsets relative
   * to the outer rect (b.x-2, b.y-2).
   */
  const BTN_STATES = {
    'default':   { face: '#5e9c31', bevel: '#7dbb4a', drop: '#41701f' },
    'pressed':   { face: '#41701f', bevel: '#5e9c31', drop: '#41701f' },
    'disabled':  { face: '#8c8678', bevel: '#aaa596', drop: '#635e52', dim: true },
    'max-level': { face: '#f4c437', bevel: '#ffe98a', drop: '#c88f1e', label: 'MAX', labelCol: '#5c3a1d' },
    'locked':    { face: '#7d5027', bevel: '#a9743f', drop: '#5c3a1d', labelCol: '#e0cfa8' },
    'ad-unlock': { face: '#5e9c31', bevel: '#7dbb4a', drop: '#41701f', label: 'WATCH AD', labelCx: 55.5 },
    'loading':   { face: '#8c8678', bevel: '#aaa596', drop: '#635e52', dim: true, label: 'LOADING', labelCol: '#e0cfa8', labelCx: 54.5 },
  };

  function drawStateButton(ctx, b) {
    const st = BTN_STATES[b.state];
    const ox = b.x - 2, oy = b.y - 2;
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.fillRect(ox, oy, b.w + 4, b.h + 4);
    ctx.fillStyle = st.drop;
    ctx.fillRect(b.x, b.y + b.h - 4, b.w, 4);
    ctx.fillStyle = st.face;
    ctx.fillRect(b.x, b.y, b.w, b.h - 2);
    ctx.fillStyle = st.bevel;
    ctx.fillRect(b.x, b.y, b.w, 3);
    ctx.fillRect(b.x, b.y, 3, b.h - 6);
    if (b.state === 'locked') {
      // pixel lock (cream/300) + face-colored keyhole
      ctx.fillStyle = '#e0cfa8';
      ctx.fillRect(ox + 13.5, oy + 9.5, 2, 4);
      ctx.fillRect(ox + 19.5, oy + 9.5, 2, 4);
      ctx.fillRect(ox + 13.5, oy + 7.5, 8, 2);
      ctx.fillRect(ox + 11.5, oy + 13.5, 12, 9);
      ctx.fillStyle = st.face;
      ctx.fillRect(ox + 16.5, oy + 16.5, 2, 3);
    } else if (b.state === 'ad-unlock') {
      // play plate + stepped triangle
      ctx.fillStyle = PIXEL.OUTLINE;
      ctx.fillRect(ox + 6.5, oy + 11, 12, 10);
      ctx.fillStyle = '#fff6e8';
      ctx.fillRect(ox + 10, oy + 13, 2, 6);
      ctx.fillRect(ox + 12, oy + 14, 2, 4);
      ctx.fillRect(ox + 14, oy + 15, 2, 2);
    }
    if (st.dim) {
      ctx.fillStyle = 'rgba(40,30,20,0.45)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    if (b.state === 'loading') {
      // 4-dot pixel spinner, stepped opacity, rotating with time
      const step = Math.floor(performance.now() / 150) % 4;
      const dots = [[13.5, 10.5], [17.5, 14.5], [13.5, 18.5], [9.5, 14.5]];
      for (let i = 0; i < 4; i++) {
        ctx.globalAlpha = [1, 0.7, 0.45, 0.2][(i - step + 4) % 4];
        ctx.fillStyle = '#fff6e8';
        ctx.fillRect(ox + dots[i][0], oy + dots[i][1], 3, 3);
      }
      ctx.globalAlpha = 1;
    }
    const label = st.label !== undefined ? st.label : b.label;
    if (label) {
      drawText(ctx, label, ox + (st.labelCx || 50), oy + 11.75, 8.5, st.labelCol || '#fff6e8', 'center', false, false, 92);
    }
  }

  /** Colored button (green/gray/red) with bevel + icon + label. */
  function drawButton(ctx, b) {
    if (b.state) { drawStateButton(ctx, b); return; }
    const p = P();
    const cols = {
      green: ['#5e9c31', '#7dbb4a', '#41701f'],
      gray: ['#8c8678', '#aaa596', '#635e52'],
      red: ['#c0453a', '#dd6a56', '#8e2f27'],
      wood: [p.wood, p.woodHi, p.woodDk],
    }[b.color];
    const pr = b.pressed ? 2 : 0;
    const y = b.y + pr;
    // outline + drop
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    ctx.fillStyle = cols[2];
    ctx.fillRect(b.x, b.y + b.h - 4, b.w, 4);
    // face
    ctx.fillStyle = cols[0];
    ctx.fillRect(b.x, y, b.w, b.h - 4 - pr + 2);
    ctx.fillStyle = cols[1];
    ctx.fillRect(b.x, y, b.w, 3);
    ctx.fillRect(b.x, y, 3, b.h - 6);
    if (b.disabled) {
      ctx.fillStyle = 'rgba(40,30,20,0.45)';
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }
    // content
    if (b.layout) {
      // exact icon/label placement from Figma (offsets from the outer rect)
      const ox = b.x - 2, oy = b.y - 2 + pr;
      if (b.icon) {
        const img = b.icon();
        ctx.drawImage(img, ox + b.layout.iconX, oy + b.layout.iconY, b.layout.iconW, b.layout.iconH);
      }
      if (b.label) {
        if (b.layout.center) {
          drawText(ctx, b.label, b.x + b.w / 2, oy + b.layout.labelY, b.layout.labelPx, '#fff6e8', 'center');
        } else {
          drawText(ctx, b.label, ox + b.layout.labelX, oy + b.layout.labelY, b.layout.labelPx, '#fff6e8', 'left');
        }
      }
      return;
    }
    let tx = b.x + b.w / 2;
    const ty = y + (b.h - 4) / 2;
    if (b.icon) {
      const img = b.icon();
      const isc = b.iconScale || 2;
      const iw = img.width * isc, ih = img.height * isc;
      if (b.label) {
        const availW = b.w - iw - 8;
        const fs = PixelFont.fit(b.label, b.labelSize || SIZE.BUTTON, availW);
        const lw = Math.min(measure(b.label, fs), availW);
        const total = iw + 6 + lw;
        ctx.drawImage(img, Math.round(tx - total / 2), Math.round(ty - ih / 2), iw, ih);
        drawText(ctx, b.label, tx - total / 2 + iw + 6, ty - fs / 2, fs, '#fff6e8', 'left', true, false, availW);
      } else {
        ctx.drawImage(img, Math.round(tx - iw / 2), Math.round(ty - ih / 2), iw, ih);
      }
    } else if (b.label) {
      const availW = b.w - 8;
      const fs = PixelFont.fit(b.label, b.labelSize || SIZE.BUTTON, availW);
      drawText(ctx, b.label, tx, ty - fs / 2, fs, '#fff6e8', 'center', true, false, availW);
    }
  }

  /** Small wooden sign with 1-2 lines (used on world map). `altLine1` is the
   *  other title this sign can show (a farm swaps its generic name for its
   *  themed one once the house is up): it is never drawn, only measured, so
   *  the board keeps one width and the swap reads as a rename. */
  function woodSign(ctx, cx, cy, line1, line2, cost, altLine1) {
    const w = Math.max(measure(line1, SIZE.BUTTON),
                       altLine1 ? measure(altLine1, SIZE.BUTTON) : 0,
                       line2 ? measure(line2, SIZE.CAPTION) : 0,
                       cost ? measure(cost, SIZE.CAPTION) + 12 : 0) + 18;
    const h = 18 + (line2 ? 9 : 0) + (cost ? 11 : 0);
    woodPanel(ctx, cx - w / 2, cy, w, h, {});
    drawText(ctx, line1, cx, cy + 5, SIZE.BUTTON, '#f4e8cc', 'center', true);
    let yy = cy + 17;
    if (line2) { drawText(ctx, line2, cx, yy, SIZE.CAPTION, '#e0cfa8', 'center'); yy += 10; }
    if (cost) {
      const img = SPRITES.coin(1);
      const tw = measure(cost, SIZE.CAPTION);
      ctx.drawImage(img, cx - tw / 2 - 12, yy - 3, 10, 10);
      drawText(ctx, cost, cx - tw / 2, yy, SIZE.CAPTION, '#ffe98a', 'left');
    }
    // legs
    ctx.fillStyle = P().woodDk;
    ctx.fillRect(cx - w / 2 + 4, cy + h, 3, 5);
    ctx.fillRect(cx + w / 2 - 7, cy + h, 3, 5);
  }

  // ---------------- upgrade panel cards ----------------
  /**
   * One parchment card in the upgrade panel, laid out COST > BENEFIT > ACTION:
   * the right column leads with a big coin+cost (gold when affordable, red
   * with a NEED hint when not) above the UPGRADE button; the left column has
   * the upgrade name and per-stat "cur > next" improvement rows. Registers
   * its hit rect on popup.cards and applies the purchase flash from popup.fx.
   * Returns the card's bottom y.
   */
  // ---------------- upgrade panel ----------------
  /**
   * The panel lists ONLY discovered upgrades: an undiscovered animal has no
   * row, no placeholder and no gap, so the player is never shown that
   * anything else exists (see Upgrades.unlocked). The panel is pinned to the
   * top it has at full height and grows downwards, so rows never shift.
   *
   * A long chain (Farm 1 fully discovered is eight rows) grows past what the
   * stage can show, so once the content exceeds UPGRADES_MAX_PH the panel
   * stops growing and scrolls inside itself instead — see drawUpgrades.
   */
  const UPGRADES_TOP = 56;       // (H - 528) / 2: the full-height panel's top
  const UPGRADES_MAX_PH = 528;   // panel height ceiling — beyond this it scrolls
  const CARD_H = { spawn: 76, stage: 88 };
  // A row discovered since the panel was last open slides in and fades up
  // while the rows below it make room, then a shine sweeps across it.
  const REVEAL = { DUR: 0.36, STAGGER: 0.1, SLIDE: 22, SHINE: 0.5 };
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  /** Seconds this row has been revealing for, or null if it is at rest. */
  function revealT(popup, key) {
    const d = popup.reveal && popup.reveal[key];
    return d === undefined ? null : popup.revealT - d;
  }

  /** 0..1 entry progress (1 = settled in its resting state). */
  function revealP(popup, key) {
    const t = revealT(popup, key);
    return t === null ? 1 : U.clamp(t / REVEAL.DUR, 0, 1);
  }

  /** 0..1 shine-sweep progress, or null when no sweep is running. */
  function revealShine(popup, key) {
    const t = revealT(popup, key);
    if (t === null) return null;
    const s = (t - REVEAL.DUR) / REVEAL.SHINE;
    return s >= 0 && s <= 1 ? s : null;
  }

  /**
   * Row layout: every discovered upgrade in progression order, each taking
   * only the fraction of its height it has grown to, plus the panel height
   * that fits them. Pure metrics — called for the panel frame and again to
   * draw, so both always agree.
   */
  function upgradeLayout(popup) {
    const rows = [];
    let dy = 32, first = true, stageSection = false;
    for (const key of Upgrades.keys(popup.farmId, popup.group)) {
      if (!Upgrades.unlocked(popup.farmId, key)) continue;
      const spawn = key === 'spawn';
      const p = easeOut(revealP(popup, key));
      // 'FARM' heads the spawn row, the animal's name the first stage row
      const caption = spawn ? 'FARM' : stageSection ? null
                    : CONFIG.FARMS[popup.farmId].label;
      if (!first) dy += (caption ? 22 : 10) * p;
      if (caption && !spawn) stageSection = true;
      const h = spawn ? CARD_H.spawn : CARD_H.stage;
      rows.push({ key, dy, h, p, caption, shine: revealShine(popup, key) });
      dy += h * p;
      first = false;
    }
    // 16px of panel below the last row; an empty list keeps a small plaque.
    // The panel takes the content's height until it hits the ceiling, after
    // which it stays put and the rows scroll inside it.
    const ch = rows.length ? dy + 16 : 96;
    return { rows, ch, ph: Math.min(ch, UPGRADES_MAX_PH) };
  }

  /**
   * The scrollable row list. Rows are drawn into a clipped viewport shifted
   * by popup.scroll, and only the BUY buttons actually inside that viewport
   * are registered as hit rects — a row scrolled out of sight can't be
   * tapped through the panel frame.
   */
  // A split farm opens this panel through two entry points, each showing only
  // its own rows — the title says which one the player is in.
  const UPGRADE_TITLE = { farm: 'FARM UPGRADES', animals: 'ANIMAL UPGRADES' };

  function drawUpgrades(ctx, px, py, pw, ph) {
    popupTitle(ctx, UPGRADE_TITLE[popup.group] || 'UPGRADES!', px, py, pw, { tall: true });
    popup.cards = [];
    const { rows, ch } = upgradeLayout(popup);
    const view = { x: px + 4, y: py + 24, w: pw - 8, h: ph - 32 };
    popup.maxScroll = Math.max(0, ch - ph);
    popup.scroll = U.clamp(popup.scroll || 0, 0, popup.maxScroll);
    followReveal(popup, rows, view.y - py, view.h);
    const sc = popup.scroll;

    ctx.save();
    ctx.beginPath();
    ctx.rect(view.x, view.y, view.w, view.h);
    ctx.clip();
    for (const r of rows) {
      const ry = py + r.dy - sc;
      if (ry > view.y + view.h || ry + r.h < view.y) continue;   // fully off-view
      if (r.caption) {
        ctx.globalAlpha = r.p;
        drawText(ctx, r.caption, px + 10, ry - 10.25, SIZE.CAPTION, '#e0cfa8');
        ctx.globalAlpha = 1;
      }
      const inf = Upgrades.info(popup.farmId, r.key);
      if (r.p >= 1 && r.shine === null) {
        upgradeCard(ctx, popup, px + 12, ry, pw - 24, r.h, inf, view);
      } else {
        drawRevealingCard(ctx, px + 12, ry, pw - 24, r.h, inf, r, view);
      }
    }
    ctx.restore();

    if (popup.maxScroll > 0) drawScrollbar(ctx, px, pw, view, sc, popup.maxScroll, ch);
    if (!rows.length) {
      drawText(ctx, 'NOTHING TO UPGRADE YET', px + pw / 2, py + 40, 7, '#e0cfa8', 'center', false, false, pw - 28);
    }
    drawPanelFx(ctx);
  }

  /**
   * On a long chain the row that just unlocked can be below the fold, where
   * its entry animation would play unseen — so while rows are still coming
   * in, the list scrolls to keep the newest one on screen. The moment the
   * player scrolls by hand it stops following and leaves them in control.
   */
  function followReveal(popup, rows, viewTop, viewH) {
    if (popup.userScrolled || !popup.reveal) return;
    const fresh = rows.filter(r => revealT(popup, r.key) !== null);
    if (!fresh.length) return;
    const last = fresh[fresh.length - 1];
    if (revealT(popup, last.key) > REVEAL.DUR + REVEAL.SHINE) return;   // settled
    const want = last.dy + last.h - viewTop - viewH;
    popup.scroll = U.clamp(Math.max(popup.scroll, want), 0, popup.maxScroll);
  }

  /** Slim thumb on the panel's right edge showing how far down the list is. */
  function drawScrollbar(ctx, px, pw, view, scroll, maxScroll, contentH) {
    const x = px + pw - 6, top = view.y + 2, h = view.h - 4;
    const th = Math.max(24, h * (view.h / contentH));
    const ty = top + (h - th) * (scroll / maxScroll);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.fillRect(x, top, 3, h);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = '#e0cfa8';
    ctx.fillRect(x, ty, 3, th);
    ctx.globalAlpha = 1;
  }

  /**
   * One row mid-entry: clipped to the height it has grown to (so it never
   * spills onto the row below), slid in from the right, faded up, then lit
   * by a diagonal shine. Its BUY button is registered at its resting rect,
   * so the row stays tappable the whole way in.
   */
  function drawRevealingCard(ctx, x, y, w, h, inf, r, view) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 4, y - 4, w + 8, Math.max(0, r.h * r.p) + 8);
    ctx.clip();
    ctx.globalAlpha = r.p;
    ctx.translate((1 - r.p) * REVEAL.SLIDE, 0);
    upgradeCard(ctx, popup, x, y, w, h, inf, view);
    ctx.globalAlpha = 1;
    if (r.shine !== null) {
      const sx = x - 44 + (w + 88) * r.shine;
      ctx.globalAlpha = 0.4 * Math.sin(r.shine * Math.PI);
      ctx.fillStyle = '#fff6e8';
      ctx.beginPath();
      ctx.moveTo(sx, y + h); ctx.lineTo(sx + 18, y + h);
      ctx.lineTo(sx + 40, y); ctx.lineTo(sx + 22, y);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function upgradeCard(ctx, popup, x, y, w, h, inf, view) {
    // parchment card (x,y,w,h = inner face rect; all values Figma E04 / 2)
    ctx.fillStyle = PIXEL.OUTLINE; ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#e8d8b4'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#f2e6c8'; ctx.fillRect(x, y, w, 3);

    const afford = !inf.maxed && SaveManager.data.coins >= inf.cost;
    const spawn = h === 76;   // the shorter spawn-speed card has its own offsets

    // ---- right column: cost (coin 19:90, text 19:91), UPGRADE button (19:93) ----
    if (!inf.maxed) {
      const costTxt = U.fmt(inf.cost);
      const costSize = PixelFont.fit(costTxt, 13, 51);
      ctx.drawImage(SPRITES.coin(2), x + (spawn ? 196 : 195.5), y + (spawn ? 12.5 : 18.5), 16, 16);
      drawText(ctx, costTxt, x + (spawn ? 216 : 215.5), y + (spawn ? 14.5 : 20.5) + (13 - costSize) / 2,
               costSize, afford ? '#58972a' : '#b0442f', 'left');
    }
    const fx = popup.fx[inf.key] || 0;
    const btn = { x: x + 200, y: y + (spawn ? 40 : 52), w: 96, h: 28 };
    // state mapping per the Figma upgrade-button component (46:67)
    const state = inf.maxed ? 'max-level'
                : fx > 0.85 ? 'pressed'
                : afford ? 'default' : 'disabled';
    drawButton(ctx, { ...btn, state, label: 'UPGRADE' });

    // ---- left column: name, then per-stat label line + "cur > next" line ----
    const textW = 190;
    drawText(ctx, inf.label + ' LV ' + inf.level, x + 10, y + (spawn ? 8.75 : 8), spawn ? 8.5 : 10, '#000000', 'left', false, false, textW);
    let ly = y + (spawn ? 27.75 : 29.25);
    const ox = x - 2;   // Figma offsets in the cards are relative to the outer rect
    let row = 0;
    for (const st of inf.stats) {
      drawText(ctx, st.name, x + 10, ly, 6.5, '#8a6a3c');
      const vy = ly + (!spawn && row === 0 ? 9.5 : 10);
      drawText(ctx, st.cur, ox + 12, vy, 8.5, '#7d5027');
      if (st.next && st.next !== st.cur) {
        let vx = Math.ceil((12 + measure(st.cur, 8.5) + 4) / 2) * 2;
        drawText(ctx, '>', ox + vx, vy, 8.5, '#4a8f2c');
        vx = Math.ceil((vx + measure('>', 8.5) + 2) / 2) * 2;
        drawText(ctx, st.next, ox + vx, vy, 8.5, '#3f7d1e');
      }
      ly += 29.5;
      row++;
    }

    // purchase highlight flash
    if (fx > 0) {
      popup.fx[inf.key] = Math.max(0, fx - Game.dt * 2);
      ctx.globalAlpha = fx * 0.45;
      ctx.fillStyle = '#ffe98a';
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 1;
    }

    // only a button fully inside the scroll viewport is tappable
    if (!view || (btn.y >= view.y && btn.y + btn.h <= view.y + view.h)) {
      popup.cards.push({ key: inf.key, btn });
    }
    return y + h;
  }

  // sparkle particles drawn above the popup (VFXManager renders below it)
  let panelFx = [];
  function spawnPanelFx(x, y) {
    for (let i = 0; i < 12; i++) {
      panelFx.push({
        x: x + U.rand(-16, 16), y: y + U.rand(-8, 8),
        vx: U.rand(-30, 30), vy: U.rand(-70, -20),
        t: U.rand(0.35, 0.6), max: 0.6,
        col: U.pick(['#ffe98a', '#f4c437', '#fff6d0', '#ffffff']),
      });
    }
  }
  function drawPanelFx(ctx) {
    for (let i = panelFx.length - 1; i >= 0; i--) {
      const p = panelFx[i];
      p.t -= Game.dt;
      if (p.t <= 0) { panelFx.splice(i, 1); continue; }
      p.x += p.vx * Game.dt; p.y += p.vy * Game.dt;
      ctx.globalAlpha = Math.min(1, p.t / p.max * 2);
      ctx.fillStyle = p.col;
      const s = p.t > p.max * 0.5 ? 3 : 2;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), s, s);
      ctx.globalAlpha = 1;
    }
  }

  // ---------------- state ----------------
  let buttons = [];
  let popup = null;         // {type:'unlock'|'settings'|'confirm-reset', ...}
  let toast = null;         // {text, t}
  let displayedCoins = 0;
  let coinPulse = 0;

  const COIN_POS = { x: 30, y: 27 };
  function coinTarget() { return { x: COIN_POS.x, y: COIN_POS.y }; }

  // Height of the HUD's top bar backdrop (Figma 30:3, 112/2).
  const HUD_H = 56;

  /**
   * The band of the scene that in-scene UI may occupy: below the HUD bar,
   * above the bottom button row, inset from the stage edges. Derived from
   * the live HUD geometry rather than fixed coordinates, so anything
   * anchored through it stays clear of both bars — the 360x640 stage itself
   * is letterboxed to fit the device, which keeps it inside notches and
   * rounded corners at every resolution and aspect ratio.
   */
  function safeArea() {
    const M = 10;
    let bottom = H - M;
    // the bottom action row (top-anchored buttons live under the HUD bar)
    for (const b of buttons) {
      if (b.y > H / 2) bottom = Math.min(bottom, b.y - 8);
    }
    const top = HUD_H + 8;
    return { x: M, y: top, w: W - M * 2, h: Math.max(0, bottom - top) };
  }

  /**
   * The bottom action row is anchored to the stage's bottom edge, and the
   * whole 360x640 stage is letterboxed to fit the device, so these rects hold
   * at every resolution, aspect ratio and safe-area inset. The left slot in
   * that row holds ONE of two entry points, decided by config:
   *   - a farm WITHOUT CONFIG.splitUpgrades: the single UPGRADE button that
   *     opens the whole menu;
   *   - a farm WITH it (Farm 1): the animal-upgrades button, since the
   *     farmhouse has taken over farm upgrades. That one is icon-only — a
   *     square left-anchored button whose 44px icon has to carry the meaning
   *     with no label under it, so it is sized to stay legible when the whole
   *     360x640 stage is letterboxed down to the smallest supported screen.
   * The two never coexist, and both sit on the same bottom edge, so the row's
   * shape, the safe area below it and everything anchored through it are the
   * same either way — and the button is clear of the pen, the house, the
   * UFO's parking spot and the HUD by construction.
   */
  function makeButtons() {
    // rects and icon/label placement from Figma E03 (14:29), Figma px / 2
    const split = () => CONFIG.splitUpgrades(SaveManager.data.currentFarm);
    const species = () => CONFIG.FARMS[SaveManager.data.currentFarm].species;
    buttons = [
      { id: 'upgrade', color: 'green', x: 75, y: 586, w: 100, h: 40, label: 'UPGRADE', icon: () => SPRITES.arrowUp(), scene: 'farm',
        layout: { iconX: 5, iconY: 8, iconW: 24, iconH: 24, labelX: 30.5, labelY: 17, labelPx: 10 },
        show: () => !split() },
      { id: 'animals', color: 'green', x: 75, y: 570, w: 56, h: 56, icon: () => SPRITES.animalUp(species()), scene: 'farm',
        layout: { iconX: 8, iconY: 6, iconW: 44, iconH: 44 },
        show: () => split() },
      { id: 'map', color: 'red', x: 185, y: 586, w: 100, h: 40, label: 'MAP', icon: () => SPRITES.mapPin(), scene: 'farm',
        layout: { iconX: 11.5, iconY: 7, iconW: 24, iconH: 30, labelX: 48, labelY: 15, labelPx: 12 } },
      { id: 'settings', color: 'wood', x: 314, y: 12, w: 34, h: 32, icon: () => SPRITES.gear(), scene: 'both',
        layout: { iconX: 5.5, iconY: 3.5, iconW: 27, iconH: 27 } },
    ];
  }
  makeButtons();

  /** Is this button on screen in the given scene right now? */
  function visible(b, scene) {
    if (b.scene !== 'both' && b.scene !== scene) return false;
    return !b.show || b.show();
  }

  /** Red notification badge with a white "!", centered at (cx, cy). */
  function drawBadge(ctx, cx, cy) {
    const pulse = 1 + Math.sin(performance.now() / 220) * 0.08;
    const r = Math.round(8 * pulse);
    ctx.fillStyle = PIXEL.OUTLINE;
    ctx.beginPath(); ctx.arc(cx, cy, r + 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#c0453a';
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#dd6a56';
    ctx.beginPath(); ctx.arc(cx - 1, cy - 1, r - 2, 0, 7); ctx.fill();
    ctx.fillStyle = '#c0453a';
    ctx.beginPath(); ctx.arc(cx, cy + 1, r - 2, 0, 7); ctx.fill();
    drawText(ctx, '!', cx, cy - 5, SIZE.BODY, '#fff6e8', 'center');
  }

  // ---------------- HUD ----------------
  function drawHUD(ctx, scene) {
    const p = P();
    // top bar backdrop (Figma 30:3 — rgba(26,20,14,0.5), h 112/2)
    ctx.fillStyle = 'rgba(26,20,14,0.5)';
    ctx.fillRect(0, 0, W, HUD_H);

    // coin capsule
    displayedCoins = U.lerp(displayedCoins, SaveManager.data.coins, Math.min(1, CONFIG.COIN_COUNT_LERP * Game.dt));
    if (Math.abs(displayedCoins - SaveManager.data.coins) < 1) displayedCoins = SaveManager.data.coins;
    inset(ctx, 14, 12, 118, 30);
    const coinImg = SPRITES.coin(3);
    coinPulse = Math.max(0, coinPulse - Game.dt * 4);
    const cs = 26 + coinPulse * 8;
    ctx.drawImage(coinImg, COIN_POS.x - cs / 2, COIN_POS.y - cs / 2, cs, cs);
    drawText(ctx, U.fmt(displayedCoins), 48, 21, 12, '#fff6e8', 'left', false, false, 78);

    // name plaque — fixed rects from Figma (farm 18:23, map 17:11)
    if (scene === 'map') {
      woodPanel(ctx, 142, 12, 116, 30, { gold: true, flecks: false });
      drawText(ctx, 'WORLD MAP', 201, 22, 10, '#f4e8cc', 'center', false, false, 112);
    } else {
      woodPanel(ctx, 146, 12, 109, 30, { gold: true, flecks: false });
      drawText(ctx, CONFIG.FARMS[SaveManager.data.currentFarm].name, 200, 21, 13, '#f4e8cc', 'center', false, false, 105);
    }

    // buttons for this scene
    for (const b of buttons) {
      if (!visible(b, scene)) continue;
      drawButton(ctx, b);
      // red "!" badge while an upgrade this button opens is affordable (only
      // after the first-upgrade tutorial has been completed). Each entry
      // point badges for its own rows: the ANIMALS button only for the chain,
      // the farmhouse only for the farm rows (see FarmScene.drawHouseCTA).
      if (b.id !== 'upgrade' && b.id !== 'animals') continue;
      if (SaveManager.data.upgradeTutorialDone &&
          Upgrades.anyAffordable(SaveManager.data.currentFarm, b.id === 'animals' ? 'animals' : null)) {
        drawBadge(ctx, b.x + b.w - 2, b.y - 2);
      }
    }

    // toast
    if (toast) {
      toast.t -= Game.dt;
      if (toast.t <= 0) toast = null;
      else {
        const a = Math.min(1, toast.t * 2);
        ctx.globalAlpha = a;
        const tt = PixelFont.truncate(toast.text, SIZE.BODY, W - 52);
        const tw2 = measure(tt, SIZE.BODY) + 24;
        inset(ctx, W / 2 - tw2 / 2, 84, tw2, 22);
        drawText(ctx, tt, W / 2, 90, SIZE.BODY, '#ffb0a0', 'center');
        ctx.globalAlpha = 1;
      }
    }
  }

  // ---------------- discovery celebration popup ----------------
  /**
   * Full-screen celebration for a first-time evolution: golden frame around
   * big animal art, sparkles + confetti, name, stage, flavor and CONTINUE.
   */
  function drawDiscovery(ctx, px, py, pw, ph) {
    const p = P();
    popup.fxT += Game.dt;
    const t = popup.fxT;
    const cx = px + pw / 2;

    popupTitle(ctx, 'NEW EVOLUTION', px, py, pw);
    drawText(ctx, 'DISCOVERED!', cx, py + 48, 16, '#ffe98a', 'center', false, false, pw - 24);

    // golden frame (22:33: outer 158px at 101, py+69.5)
    const fs = 150, fx = cx - fs / 2, fy = py + 73.5;
    ctx.fillStyle = PIXEL.OUTLINE; ctx.fillRect(fx - 4, fy - 4, fs + 8, fs + 8);
    ctx.fillStyle = p.gold;        ctx.fillRect(fx - 2, fy - 2, fs + 4, fs + 4);
    ctx.fillStyle = p.goldHi;      ctx.fillRect(fx - 2, fy - 2, fs + 4, 2);
    ctx.fillStyle = p.goldDk;      ctx.fillRect(fx - 2, fy + fs, fs + 4, 2);
    ctx.fillStyle = '#3a2c1c';     ctx.fillRect(fx + 2, fy + 2, fs - 4, fs - 4);
    // corner studs
    ctx.fillStyle = p.goldHi;
    for (const [sx, sy] of [[fx - 2, fy - 2], [fx + fs - 2, fy - 2], [fx - 2, fy + fs - 2], [fx + fs - 2, fy + fs - 2]]) {
      ctx.fillRect(sx, sy, 4, 4);
    }

    // magical glow behind the animal
    ctx.save();
    ctx.beginPath(); ctx.rect(fx + 2, fy + 2, fs - 4, fs - 4); ctx.clip();
    const pulse = 0.30 + Math.sin(t * 4) * 0.12;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffe98a';
    ctx.beginPath(); ctx.arc(cx, fy + fs / 2 + 8, 56, 0, 7); ctx.fill();
    ctx.globalAlpha = pulse * 0.7;
    ctx.beginPath(); ctx.arc(cx, fy + fs / 2 + 8, 34, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    // rotating god-rays
    ctx.globalAlpha = 0.15;
    ctx.fillStyle = '#fff6d0';
    for (let i = 0; i < 6; i++) {
      const a = t * 0.6 + (i / 6) * Math.PI * 2;
      ctx.save();
      ctx.translate(cx, fy + fs / 2 + 8);
      ctx.rotate(a);
      ctx.fillRect(-7, -fs, 14, fs * 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    // the star of the show, gently bobbing
    const img = SPRITES.animal(popup.species, popup.stage, 'idle', false);
    const bob = Math.sin(t * 3) * 2;
    const sc = Math.min(3, (fs - 34) / img.height);
    PIXEL.blit(ctx, img, cx, fy + fs - 18 + bob, sc * Math.min(1, U.easeOutBack(Math.min(t * 2.5, 1))));
    // sparkles twinkling inside the frame
    ctx.fillStyle = '#fff6d0';
    for (let i = 0; i < 7; i++) {
      const tw = (Math.sin(t * 5 + i * 2.1) + 1) / 2;
      if (tw < 0.55) continue;
      const sx = fx + 12 + ((i * 47) % (fs - 24));
      const sy = fy + 12 + ((i * 71) % (fs - 24));
      const ss = tw > 0.8 ? 2 : 1;
      ctx.fillRect(sx - ss, sy, ss * 2 + 1, 1);
      ctx.fillRect(sx, sy - ss, 1, ss * 2 + 1);
    }
    ctx.restore();

    // flavor first (white, 30:106), then the name below it (22:20)
    PixelFont.drawWrapped(ctx, Discovery.flavor(popup.species, popup.stage), cx, py + 230.75, 5.5, '#ffffff', 'center', pw - 28, 2);
    drawText(ctx, Discovery.displayName(popup.species, popup.stage), cx, py + 257.5, 12, '#ffe98a', 'center', false, false, pw - 24);

    // CONTINUE
    popup.okRect = { x: px + 50, y: py + ph - 56, w: pw - 100, h: 40 };
    drawButton(ctx, { ...popup.okRect, color: 'green', label: 'CONTINUE', layout: { labelY: 19, labelPx: 10, center: true } });

    // confetti raining over the whole popup
    if (popup.confetti.length < 60 && Math.random() < 0.5) {
      popup.confetti.push({
        x: px + Math.random() * pw, y: py - 14,
        vx: U.rand(-14, 14), vy: U.rand(36, 70),
        sway: Math.random() * Math.PI * 2,
        col: U.pick(['#ffe98a', '#f4c437', '#dd6a56', '#7dbb4a', '#a07cc0', '#7ec8e0']),
        s: U.randInt(2, 4),
      });
    }
    for (let i = popup.confetti.length - 1; i >= 0; i--) {
      const c = popup.confetti[i];
      c.sway += Game.dt * 4;
      c.x += (c.vx + Math.sin(c.sway) * 16) * Game.dt;
      c.y += c.vy * Game.dt;
      if (c.y > py + ph + 10) { popup.confetti.splice(i, 1); continue; }
      ctx.fillStyle = c.col;
      const wob = Math.abs(Math.sin(c.sway));
      ctx.fillRect(Math.round(c.x), Math.round(c.y), c.s, Math.max(1, Math.round(c.s * wob)));
    }
  }

  // ---------------- welcome-back popup ----------------
  /**
   * Layout numbers for the welcome-back popup. The per-farm breakdown only
   * appears when 2+ farms actually earned something; the panel height grows
   * with the rows and the cap note.
   */
  function welcomeMetrics() {
    // fixed geometry from Figma E08 (23:4/23:31)
    return { cardH: 122, ph: 256 };
  }

  function drawWelcome(ctx, px, py, pw) {
    const rep = popup.rep;
    const total = Math.floor(rep.total);
    popupTitle(ctx, 'WELCOME BACK!', px, py, pw, { size: 8.5, top: py - 1.25 });
    // parchment card (23:31)
    ctx.fillStyle = PIXEL.OUTLINE; ctx.fillRect(px + 18, py + 24, pw - 36, 126);
    ctx.fillStyle = '#e8d8b4'; ctx.fillRect(px + 20, py + 26, pw - 40, 122);
    ctx.fillStyle = '#f2e6c8'; ctx.fillRect(px + 20, py + 26, pw - 40, 3);
    const cx = px + pw / 2;
    drawText(ctx, 'YOU WERE AWAY FOR', cx, py + 37.75, 6.5, '#7d5027', 'center');
    drawText(ctx, U.fmtDur(rep.awaySec), cx, py + 51.25, 8.5, '#000000', 'center');
    // total earned while away — big and black, coin at a fixed spot (23:43/23:44)
    ctx.drawImage(SPRITES.coin(2), px + 48, py + 84, 21.5, 21.5);
    drawText(ctx, '+' + U.fmt(total), px + 130.5, py + 86.5, 16, '#000000', 'center', false, false, 122);
    PixelFont.drawWrapped(ctx, 'WHILE YOU WERE AWAY, THE FARMS WERE PRODUCTIVE.', cx, py + 131.5, 4, '#7d5027', 'center', 131.5, 2);
    // primary collect + secondary rewarded-ad 2x (play icon + coin + amount)
    popup.okRect = { x: px + 30, y: py + 158, w: pw - 60, h: 40 };
    popup.adRect = { x: px + 30, y: py + 206, w: pw - 60, h: 34 };
    drawButton(ctx, { ...popup.okRect, color: 'green', label: 'COLLECT', layout: { labelY: 19, labelPx: 10, center: true } });
    drawButton(ctx, { ...popup.adRect, color: 'wood' });
    ctx.drawImage(SPRITES.adPlay(), px + 39.5, py + 212, 32, 24);
    ctx.drawImage(SPRITES.coin(2), px + 85, py + 216.5, 14.5, 14.5);
    drawText(ctx, U.fmt(total * 2), px + 104, py + 219, 10, '#fff6e8', 'left', false, false, 64);
  }

  // ---------------- parachute surprise box: reveal popup ----------------
  /**
   * The crate's reveal (see js/crate.js). It opens on a short animation —
   * the box rattles, the lid bursts off on a beam of light, the animal rises
   * out of it — and then settles into the actual choice: the two possible
   * outcomes shown SIDE BY SIDE, so the upgrade the ad buys is obvious
   * before the player commits to watching it.
   *
   *   left  — COLLECT: the animal as rolled, free, placed straight in the pen
   *   right — REWARD AD: the next evolution up instead
   *
   * Neither button exists until the reveal has finished playing, so the
   * animation can't be tapped through into a choice; the close X is always
   * live and leaves the crate on the ground, still tappable.
   */
  // where the crate sits, and where the animal it contained comes to rest —
  // one and the same spot, so the reveal lands the animal exactly where the
  // settled popup shows it and nothing jumps when the animation ends
  const CRATE_ART_Y = 150;
  const CRATE_POP = 0.42;      // the moment the lid lets go

  function drawCrateReveal(ctx, px, py, pw, ph) {
    const cfg = Object.assign({}, CONFIG.CRATE, (window.RemoteConfig || {}).CRATE);
    popup.fxT += Game.dt;
    const t = popup.fxT;
    const cx = px + pw / 2, groundY = py + CRATE_ART_Y;
    const species = CONFIG.FARMS[popup.farmId].species;
    popup.ready = t >= cfg.REVEAL_TIME;

    popupTitle(ctx, 'SURPRISE BOX!', px, py, pw, { size: 10, top: py - 2 });
    drawCrateBurst(ctx, cx, groundY, t, species);

    // name and buttons fade in as the burst settles
    const uiA = U.clamp((t - (cfg.REVEAL_TIME - 0.3)) / 0.3, 0, 1);
    if (uiA <= 0) { popup.okRect = popup.adRect = null; return; }
    ctx.save();
    ctx.globalAlpha = uiA;
    drawText(ctx, Discovery.displayName(species, popup.stage), cx, py + 164, 12,
             '#ffe98a', 'center', false, false, pw - 28);

    // COLLECT takes it as it is; EVOLVE trades a rewarded video for the next
    // stage — which is never previewed here, only revealed after the ad
    popup.okRect = { x: px + 30, y: py + 190, w: pw - 60, h: 40 };
    popup.adRect = { x: px + 30, y: py + 238, w: pw - 60, h: 36 };
    drawButton(ctx, { ...popup.okRect, color: 'green', label: 'COLLECT',
      layout: { labelY: 19, labelPx: 10, center: true } });
    // the ad button greys out the instant it is pressed, so one ad view can
    // never be started twice (the grant itself is idempotent as well)
    if (popup.adLoading) {
      drawStateButton(ctx, { ...popup.adRect, state: 'loading' });
    } else {
      drawButton(ctx, { ...popup.adRect, color: 'wood' });
      ctx.drawImage(SPRITES.adPlay(), popup.adRect.x + 26, popup.adRect.y + 7, 28, 21);
      drawText(ctx, 'EVOLVE', popup.adRect.x + 62, popup.adRect.y + 12, 10, '#fff6e8', 'left', false, false, 80);
    }
    ctx.restore();
  }

  /**
   * The opening beat: the box rattles, its lid blows off on a shaft of
   * light, sparks fly and the animal hops out — landing on the exact spot
   * the settled popup keeps it. Purely presentational: it runs on the
   * popup's own clock and grants nothing. The crate fades away behind the
   * animal, so the finished state is just the animal on the panel.
   */
  function drawCrateBurst(ctx, cx, groundY, t, species) {
    const pop = CRATE_POP;
    ctx.save();

    if (t >= pop) {
      // shaft of light out of the open box, widening as it brightens
      const bt = U.clamp((t - pop) / 0.45, 0, 1);
      // the beam is part of the reveal only: it is fully gone by the time the
      // popup settles, leaving just the animal on the panel
      ctx.globalAlpha = (0.55 - bt * 0.15) * U.clamp(1 - (t - pop) / 0.7, 0, 1);
      ctx.fillStyle = '#fff6d0';
      const topW = 24 + bt * 70, botW = 18, h = 60 + bt * 60;
      ctx.beginPath();
      ctx.moveTo(cx - botW / 2, groundY - 24);
      ctx.lineTo(cx - topW / 2, groundY - 24 - h);
      ctx.lineTo(cx + topW / 2, groundY - 24 - h);
      ctx.lineTo(cx + botW / 2, groundY - 24);
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = 1;
    }

    // the box: rattling while shut, open once the lid is gone, then gone
    const crateA = t < pop ? 1 : U.clamp(1 - (t - pop - 0.25) / 0.35, 0, 1);
    if (crateA > 0) {
      const shake = t < pop ? Math.sin(t * 46) * (1 + t * 4) : 0;
      const squash = t < pop ? 1 + Math.sin(t * 24) * 0.05 : 1;
      ctx.globalAlpha = crateA;
      PIXEL.blit(ctx, SPRITES.giftCrate(t >= pop), cx + shake, groundY, 3, false, squash, 2 - squash);
      ctx.globalAlpha = 1;
    }

    if (t >= pop) {
      // lid tumbling up and away
      const lt = t - pop;
      ctx.save();
      ctx.globalAlpha = U.clamp(1 - lt / 0.7, 0, 1);
      ctx.translate(cx + lt * 34, groundY - 52 - lt * 130 + lt * lt * 190);
      ctx.rotate(lt * 7);
      PIXEL.blit(ctx, SPRITES.crateLid(), 0, 0, 3);
      ctx.restore();
      // one-shot spark ring
      if (!popup.sparks.length) {
        for (let i = 0; i < 22; i++) {
          const a = (i / 22) * Math.PI * 2 + Math.random();
          const f = U.rand(60, 150);
          popup.sparks.push({ x: cx, y: groundY - 26, vx: Math.cos(a) * f, vy: Math.sin(a) * f - 60,
            col: U.pick(['#ffe98a', '#f4c437', '#fff6d0', '#ffffff']), s: U.randInt(2, 4), life: 0 });
        }
        AudioManager.play('unlock');
      }
    }

    // the animal itself: pops out of the box, arcs up and settles at groundY
    const at = U.clamp((t - pop - 0.1) / 0.45, 0, 1);
    if (at > 0) {
      const img = SPRITES.animal(species, popup.stage, 'idle', false);
      const sc = Math.min(3, 108 / img.height) * Math.min(1, U.easeOutBack(at));
      PIXEL.blit(ctx, img, cx, groundY - Math.sin(at * Math.PI) * 16, sc);
    }

    for (const s of popup.sparks) {
      s.life += Game.dt;
      s.x += s.vx * Game.dt; s.y += s.vy * Game.dt; s.vy += 220 * Game.dt;
      ctx.globalAlpha = U.clamp(1 - s.life / 0.9, 0, 1);
      ctx.fillStyle = s.col;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), s.s, s.s);
    }
    ctx.restore();
  }

  // ---------------- build / fence-upgrade panel ----------------
  /**
   * Construction panel for a staged farm (see js/construction.js): where the
   * player is in the build sequence, what the next purchase is, what it
   * costs and what it unlocks — plus the live fence tier and animal count
   * once the fence exists. The action button reuses the Figma upgrade-button
   * component states (default / disabled / max-level / pressed).
   */
  function drawBuild(ctx, px, py, pw, ph) {
    const id = popup.farmId;
    const scene = Game.farm && Game.farm.farmId === id ? Game.farm : null;
    const inf = Construction.info(id, scene ? scene.animals.length : 0);
    const cx = px + pw / 2;
    popupTitle(ctx, 'BUILD ' + CONFIG.FARMS[id].name, px, py, pw, { size: 10, top: py - 2 });

    // parchment card
    ctx.fillStyle = PIXEL.OUTLINE; ctx.fillRect(px + 18, py + 26, pw - 36, 154);
    ctx.fillStyle = '#e8d8b4'; ctx.fillRect(px + 20, py + 28, pw - 40, 150);
    ctx.fillStyle = '#f2e6c8'; ctx.fillRect(px + 20, py + 28, pw - 40, 3);

    // where we are in the sequence, and what comes next
    drawText(ctx, 'STEP ' + inf.step + ' OF ' + inf.steps, cx, py + 38, 5.5, '#7d5027', 'center');
    drawText(ctx, inf.title, cx, py + 50, 10, '#5c3a1d', 'center', false, false, pw - 52);
    PixelFont.drawWrapped(ctx, inf.unlocks, cx, py + 68, 5.5, '#7d5027', 'center', pw - 56, 2);

    // live fence status (only meaningful once the fence stands)
    ctx.fillStyle = 'rgba(124,80,39,0.25)';
    ctx.fillRect(px + 30, py + 92, pw - 60, 1);
    let ry = py + 100;
    if (inf.fenceBuilt) {
      statRow(ctx, px, pw, ry, 'FENCE TIER', inf.level + ' / ' + inf.maxLevel);
      ry += 14;
      statRow(ctx, px, pw, ry, 'ANIMALS', inf.animals + ' / ' + inf.capacity);
      ry += 14;
      if (inf.nextCapacity) {
        statRow(ctx, px, pw, ry, 'NEXT CAPACITY', inf.capacity + ' > ' + inf.nextCapacity, '#3f7d1e');
        ry += 14;
      }
    } else {
      statRow(ctx, px, pw, ry, 'FENCE', 'NOT BUILT');
      ry += 14;
      statRow(ctx, px, pw, ry, 'ANIMALS', inf.capacity > 0 ? 'ESCAPING!' : 'NONE YET', '#b0442f');
      ry += 14;
    }

    // price
    const afford = !inf.maxed && SaveManager.data.coins >= inf.cost;
    if (!inf.maxed) {
      const txt = U.fmt(inf.cost);
      const tw = measure(txt, 13);
      ctx.drawImage(SPRITES.coin(2), cx - tw / 2 - 20, py + 150, 16, 16);
      drawText(ctx, txt, cx - tw / 2, py + 152, 13, afford ? '#58972a' : '#b0442f', 'left');
    } else {
      drawText(ctx, 'NOTHING LEFT TO BUILD', cx, py + 154, 6.5, '#58972a', 'center', false, false, pw - 52);
    }

    // action button (Figma upgrade-button component geometry: 96x28)
    popup.fx = Math.max(0, (popup.fx || 0) - Game.dt * 2);
    popup.okRect = { x: cx - 48, y: py + 200, w: 96, h: 28 };
    const state = inf.maxed ? 'max-level'
                : popup.fx > 0.85 ? 'pressed'
                : afford ? 'default' : 'disabled';
    drawStateButton(ctx, { ...popup.okRect, state, label: inf.stage === 'upgrade' ? 'UPGRADE' : 'BUILD' });
    drawPanelFx(ctx);
  }

  /** One label/value row inside the build panel's parchment card. */
  function statRow(ctx, px, pw, y, label, value, col = '#7d5027') {
    drawText(ctx, label, px + 34, y, 6.5, '#8a6a3c', 'left');
    drawText(ctx, value, px + pw - 34, y, 6.5, col, 'right');
  }

  // ---------------- popup open/close transition ----------------
  /**
   * A panel that knows where it came from (popup.origin — the button that
   * opened it) grows out of that point and shrinks back into it, so the
   * origin of the screen is never ambiguous. The dimmed backdrop fades on the
   * same curve, and the panel's whole content is composed offscreen and
   * blitted as one piece, so nothing inside it pops in late or fades on its
   * own schedule.
   *
   * The transition is non-blocking: taps are still handled while it plays
   * (see tap/closing), a close can start mid-open, and reopening picks up the
   * progress already on screen instead of restarting from zero — so an
   * interrupted panel never stacks or flickers.
   *
   * Panels without an origin (settings, discovery, ads, ...) are unchanged:
   * they appear and disappear the way they always did.
   */
  const POPUP_FX = {
    IN: 0.28,        // seconds, ease-out with a small settle overshoot
    OUT: 0.2,        // seconds, ease-in (slower to leave the rest, then away)
    FROM: 0.85,      // scale the panel grows out of / collapses back into
  };

  /** Ease-out with a restrained settle bounce (peaks ~2% over full size). */
  function settle(p) {
    const q = p - 1;
    return 1 + 3 * q * q * q + 2 * q * q;
  }

  let fxLayer = null;   // offscreen canvas the transitioning panel composes into

  /** Is the current panel on its way out? While it is, it swallows nothing. */
  function closing() { return !!(popup && popup.anim && popup.anim.dir === 'out'); }

  /**
   * Advance the transition one frame. Returns {scale, alpha} while one is
   * running, or null once the panel is settled — a finished close clears the
   * popup, so callers must re-check `popup` afterwards.
   */
  function advancePopupFx() {
    const a = popup.anim;
    if (!a) return null;
    if (a.dir === 'in') {
      a.p = Math.min(1, a.p + Game.dt / POPUP_FX.IN);
      if (a.p >= 1) { popup.anim = null; startPendingReveal(); return null; }
    } else {
      a.p = Math.max(0, a.p - Game.dt / POPUP_FX.OUT);
      if (a.p <= 0) { popup = null; panelFx = []; return null; }
    }
    // scale — in: ease-out with the settle overshoot; out: ease-in as it goes
    const e = a.dir === 'in' ? settle(a.p) : 1 - (1 - a.p) * (1 - a.p);
    // the fade never overshoots, and spans the whole transition rather than
    // finishing in its first third, so panel and backdrop read as one motion
    const f = 1 - (1 - a.p) * (1 - a.p);
    return { scale: POPUP_FX.FROM + (1 - POPUP_FX.FROM) * e, alpha: U.clamp(f, 0, 1) };
  }

  /**
   * The rows discovered since this panel was last open are held back until
   * the panel has finished opening, so their entry animation plays on a
   * settled panel instead of fighting the transition (and so the panel's
   * height doesn't grow twice on the way in).
   */
  function startPendingReveal() {
    const fresh = popup.pendingReveal;
    popup.pendingReveal = null;
    if (!fresh || !fresh.length) return;
    popup.reveal = {};
    fresh.forEach((k, i) => { popup.reveal[k] = i * REVEAL.STAGGER; });
    popup.revealT = 0;
  }

  /** Begin the leave transition, or close outright when there is none. */
  function beginClose() {
    if (!popup) return;
    if (!popup.origin) { popup = null; panelFx = []; return; }
    popup.press = null;   // an armed purchase does not survive the exit
    popup.anim = { dir: 'out', p: popup.anim ? popup.anim.p : 1 };
  }

  // ---------------- popups ----------------
  function drawPopup(ctx) {
    if (!popup) return;

    // simulated reward ad: full-screen placeholder, auto-completes
    if (popup.type === 'adPlaying') {
      popup.t += Game.dt;
      ctx.fillStyle = 'rgba(8,8,12,0.94)';
      ctx.fillRect(0, 0, W, H);
      // values from Figma E11 (25:56..25:67), Figma px / 2
      drawText(ctx, 'REWARD AD', W / 2, 237.5, SIZE.TITLE, '#fff6e8', 'center');
      drawText(ctx, 'SIMULATED AD PLACEHOLDER', W / 2, 268.25, 4.5, '#8c8678', 'center');
      // silly ad: pigeon on a bombing run across the screen
      const t = Math.min(popup.t / popup.dur, 1);
      const bx = U.lerp(40, W - 40, t);
      const by = H / 2 + 4 + Math.sin(popup.t * 6) * 6;
      const frame = Math.floor(popup.t * 10) % 2 ? 'flapUp' : 'flapDn';
      PIXEL.blit(ctx, SPRITES.poop(0), bx - 14, by + 26 + Math.sin(popup.t * 3) * 8, 2);
      PIXEL.blit(ctx, SPRITES.pigeon(frame, false), bx, by, 3);
      // progress bar
      inset(ctx, W / 2 - 80, H / 2 + 60, 160, 14);
      ctx.fillStyle = '#7dbb4a';
      ctx.fillRect(W / 2 - 78, H / 2 + 62, Math.max(0, Math.round(156 * t)), 10);
      drawText(ctx, 'REWARD IN ' + Math.ceil(popup.dur - popup.t) + 'S', W / 2, 408.25, 4.5, '#c8b088', 'center');
      if (popup.t >= popup.dur) { const done = popup.onDone; popup = null; done(); }
      return;
    }

    const fx = advancePopupFx();
    if (!popup) return;                      // the leave transition just ended
    const dim = popup.type === 'discovery' ? 'rgba(16,10,6,0.75)' : 'rgba(16,10,6,0.55)';
    if (!fx) {
      ctx.fillStyle = dim;
      ctx.fillRect(0, 0, W, H);
      drawPopupBody(ctx);
      return;
    }
    // mid-transition: the backdrop fades unscaled while the panel — frame,
    // rows, buttons and all — is composed offscreen and blitted scaled about
    // its origin, so the whole screen moves and fades as one element
    if (!fxLayer) {
      fxLayer = document.createElement('canvas');
      fxLayer.width = W; fxLayer.height = H;
    }
    const g = fxLayer.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H);
    g.imageSmoothingEnabled = false;
    drawPopupBody(g);
    ctx.save();
    ctx.globalAlpha = fx.alpha;
    ctx.fillStyle = dim;
    ctx.fillRect(0, 0, W, H);
    // smoothing only for this blit: nearest-neighbour would drop rows and
    // shimmer across the 0.85 -> 1 sweep
    ctx.imageSmoothingEnabled = true;
    ctx.translate(popup.origin.x, popup.origin.y);
    ctx.scale(fx.scale, fx.scale);
    ctx.translate(-popup.origin.x, -popup.origin.y);
    ctx.drawImage(fxLayer, 0, 0);
    ctx.restore();
  }

  /** The panel itself, drawn at its resting rect (see drawPopup for the
   *  backdrop and the open/close transition that composes this). */
  function drawPopupBody(ctx) {
    // the upgrade panel's entry animations advance before its height is
    // measured, so the frame and the rows inside it are always in step
    if (popup.type === 'upgrades') popup.revealT = (popup.revealT || 0) + Game.dt;

    const pw = popup.type === 'upgrades' ? 324 : popup.type === 'discovery' ? 280
             : popup.type === 'build' ? 260 : 240;
    const ph = popup.type === 'upgrades' ? upgradeLayout(popup).ph
             : popup.type === 'discovery' ? 344
             : popup.type === 'unlock' ? 210
             : popup.type === 'build' ? 258
             : popup.type === 'pigeonAd' ? 254
             : popup.type === 'tornadoAd' ? 270.5
             : popup.type === 'crateReveal' ? 294
             : popup.type === 'welcomeBack' ? welcomeMetrics(popup.rep).ph : 190;
    // the upgrades panel is pinned to the top it has at full height: it grows
    // downwards as rows unlock, so no row ever shifts under the player;
    // the tornado panel sits higher than the centering formula (Figma 25:4)
    const px = (W - pw) / 2;
    const py = popup.type === 'upgrades' ? UPGRADES_TOP
             : popup.type === 'tornadoAd' ? 152
             : (H - ph) / 2 - 20;
    popup.rect = { x: px, y: py, w: pw, h: ph };
    // Figma: only the confirm-reset panel (21:4) shows plank seams
    woodPanel(ctx, px, py, pw, ph, { gold: true, flecks: false, seams: popup.type === 'confirm-reset' });

    // close X (discovery must be dismissed with CONTINUE); drawn after the
    // branch so the title bar never paints over it
    popup.closeRect = popup.type === 'discovery' ? null
      : { x: px + pw - 16, y: py - 16, w: 28, h: 26 };

    if (popup.type === 'unlock') {
      const f = CONFIG.FARMS[popup.farmId];
      // construction farms buy bare land here and build the rest in-scene
      const build = Construction.required(popup.farmId);
      const unlockCost = Construction.landCost(popup.farmId);
      // values from Figma E12 (26:2..26:47), Figma px / 2
      popupTitle(ctx, (build ? 'BUY LAND: ' : 'UNLOCK ') + f.name, px, py, pw, { size: 10, top: py - 2 });
      // inner parchment card
      ctx.fillStyle = PIXEL.OUTLINE; ctx.fillRect(px + 18, py + 28, pw - 36, 104);
      ctx.fillStyle = '#e8d8b4'; ctx.fillRect(px + 20, py + 30, pw - 40, 100);
      ctx.fillStyle = '#f2e6c8'; ctx.fillRect(px + 20, py + 30, pw - 40, 3);
      // animal preview (26:35: bottom-center at 116.75, py+110.5)
      const img = SPRITES.animal(f.species, CONFIG.showcaseStage(f.species), 'idle', false);
      PIXEL.blit(ctx, img, px + 56.75, py + 110.5, 3.0);
      drawText(ctx, f.label.replace(/S$/, '') + ' FARM', px + 120, py + 52.25, 8.5, '#5c3a1d', 'left', false, false, 96);
      drawText(ctx, build ? 'LAND COST:' : 'UNLOCK COST:', px + 138.5, py + 72.75, 4.5, '#7d5027', 'left');
      const cost = U.fmt(unlockCost);
      ctx.drawImage(SPRITES.coin(2), px + 121.5, py + 88.5, 16, 16);
      drawText(ctx, cost, px + 141.5, py + 92.25, 8.5, '#000000', 'left');
      if (build) {
        drawText(ctx, 'EMPTY PLOT - BUILD IT YOURSELF!', px + pw / 2, py + 138, 5.5, '#ffe98a', 'center', false, false, pw - 32);
      }
      // unlock button
      const can = SaveManager.data.coins >= unlockCost;
      popup.okRect = { x: px + 40, y: py + ph - 60, w: pw - 80, h: 40 };
      drawButton(ctx, { ...popup.okRect, color: 'green', label: build ? 'BUY LAND' : 'UNLOCK', disabled: !can,
        layout: { labelY: 19, labelPx: 10, center: true } });
    } else if (popup.type === 'build') {
      drawBuild(ctx, px, py, pw, ph);
    } else if (popup.type === 'upgrades') {
      drawUpgrades(ctx, px, py, pw, ph);
    } else if (popup.type === 'discovery') {
      drawDiscovery(ctx, px, py, pw, ph);
    } else if (popup.type === 'pigeonAd') {
      const inf = Pigeon.info();
      // values from Figma E09 (24:2..24:51), Figma px / 2
      popupTitle(ctx, 'POOP RAIN!', px, py, pw, { size: 10, top: py - 2 });
      // parchment card
      ctx.fillStyle = PIXEL.OUTLINE; ctx.fillRect(px + 18, py + 26, pw - 36, 132);
      ctx.fillStyle = '#e8d8b4'; ctx.fillRect(px + 20, py + 28, pw - 40, 128);
      ctx.fillStyle = '#f2e6c8'; ctx.fillRect(px + 20, py + 28, pw - 40, 3);
      // the messenger, gently bobbing, with a COO! beside its head
      popup.fxT = (popup.fxT || 0) + Game.dt;
      const bob = Math.sin(popup.fxT * 3) * 2;
      PIXEL.blit(ctx, SPRITES.pigeon('idle', false), px + 58, py + 92 + bob, 3);
      drawText(ctx, 'COO!', px + 87.5, py + 36.75, 4.5, '#7d5027', 'left');
      // reward explanation (24:37 / 30:38)
      drawText(ctx, 'WATCH AN AD', px + 97, py + 72.5, 10, '#5c3a1d', 'left', false, false, 110);
      drawText(ctx, 'POOP MEANS MONEY', px + 97, py + 88.5, 7, '#7d5027', 'left', false, false, 115);
      // scattered poop cluster (30:33..30:36, 24:40 — bottom-center anchors)
      for (const [bx2, by2] of [[73.5, 116.5], [39.25, 109], [56.5, 125], [67, 146], [39.5, 140]]) {
        PIXEL.blit(ctx, SPRITES.poop(0), px + bx2, py + by2, 1.25);
      }
      // payout: coin + big value (30:39 / 24:43)
      ctx.drawImage(SPRITES.coin(2), px + 115, py + 111, 22.5, 22.5);
      drawText(ctx, '+' + U.fmt(inf.value), px + 140.5, py + 116.5, 15, '#000000', 'left', false, false, 56);
      // watch button + note below it
      popup.okRect = { x: px + 40, y: py + 175, w: pw - 80, h: 40 };
      drawButton(ctx, { ...popup.okRect, color: 'green', icon: () => SPRITES.adPlay(), label: 'REWARD AD',
        layout: { iconX: 11, iconY: 9, iconW: 32, iconH: 24, labelX: 52.5, labelY: 17, labelPx: 10 } });
      drawText(ctx, 'COINS COLLECT AUTOMATICALLY!', px + pw / 2, py + 223.75, 4.5, '#ffffff', 'center', false, false, pw - 44);
    } else if (popup.type === 'tornadoAd') {
      // values from Figma E10 (25:2..25:48), Figma px / 2
      popupTitle(ctx, 'TORNADO ALERT!', px, py, pw, { size: 10, top: py - 2 });
      // parchment card
      ctx.fillStyle = PIXEL.OUTLINE; ctx.fillRect(px + 18, py + 26, pw - 36, 132);
      ctx.fillStyle = '#e8d8b4'; ctx.fillRect(px + 20, py + 28, pw - 40, 128);
      ctx.fillStyle = '#f2e6c8'; ctx.fillRect(px + 20, py + 28, pw - 40, 3);
      // the storm itself, spinning and swaying (25:35: 72x84, bottom-center 116, py+127)
      popup.fxT = (popup.fxT || 0) + Game.dt;
      const frame = Math.floor(popup.fxT * 10) % 3;
      const sway = Math.sin(popup.fxT * 4) * 2;
      const timg = SPRITES.tornado(frame);
      PIXEL.blit(ctx, timg, px + 56 + sway, py + 127, 72 / timg.width);
      // reward explanation
      drawText(ctx, 'WATCH AN AD', px + 112.5, py + 60.75, 8.5, '#5c3a1d', 'left', false, false, 100);
      drawText(ctx, 'TO UNLEASH A', px + 132, py + 80.25, 4.5, '#7d5027', 'left');
      drawText(ctx, 'MERGE STORM!', px + 96.5, py + 106.5, 10, '#b8860b', 'left', false, false, 120);
      // mutants feed the UFO only where it has been unlocked
      const ufoReady = SaveManager.data.ufo[SaveManager.data.currentFarm].landed;
      const chain = CONFIG.chain(CONFIG.FARMS[SaveManager.data.currentFarm].species);
      const topName = chain.stages[chain.stages.length - 1].name;
      drawText(ctx, ufoReady ? topName + 'S BECOME ' + chain.final.name + '!'
                             : 'MERGES ALL THE WAY TO ' + topName + 'S!',
        px + pw / 2, py + 144.25, 4.5, '#7d5027', 'center', false, false, pw - 44);
      // single watch button (dismiss via the close X)
      popup.okRect = { x: px + 40, y: py + 192, w: pw - 80, h: 40 };
      popup.cancelRect = null;
      drawButton(ctx, { ...popup.okRect, color: 'green', icon: () => SPRITES.adPlay(), label: 'REWARD AD',
        layout: { iconX: 13, iconY: 10, iconW: 32, iconH: 24, labelX: 53, labelY: 17, labelPx: 10 } });
    } else if (popup.type === 'crateReveal') {
      drawCrateReveal(ctx, px, py, pw, ph);
    } else if (popup.type === 'welcomeBack') {
      drawWelcome(ctx, px, py, pw);
    } else if (popup.type === 'settings') {
      popupTitle(ctx, 'SETTINGS', px, py, pw);
      popup.musicRect = { x: px + 30, y: py + 34, w: pw - 60, h: 34 };
      popup.sfxRect = { x: px + 30, y: py + 78, w: pw - 60, h: 34 };
      popup.resetRect = { x: px + 30, y: py + 128, w: pw - 60, h: 34 };
      const lay = { labelY: 14, labelPx: 10, center: true };
      drawButton(ctx, { ...popup.musicRect, color: 'wood', label: 'MUSIC: ' + (AudioManager.musicOn ? 'ON' : 'OFF'), layout: lay });
      drawButton(ctx, { ...popup.sfxRect, color: 'wood', label: 'SOUND: ' + (AudioManager.sfxOn ? 'ON' : 'OFF'), layout: lay });
      drawButton(ctx, { ...popup.resetRect, color: 'red', label: 'RESET SAVE', layout: lay });
    } else if (popup.type === 'confirm-reset') {
      popupTitle(ctx, 'RESET GAME?', px, py, pw);
      drawText(ctx, 'ALL PROGRESS WILL BE LOST!', px + pw / 2, py + 42.5, 7.5, '#f4e8cc', 'center', false, false, pw - 40);
      popup.okRect = { x: px + 30, y: py + 84, w: pw - 60, h: 36 };
      popup.cancelRect = { x: px + 30, y: py + 130, w: pw - 60, h: 36 };
      drawButton(ctx, { ...popup.okRect, color: 'red', label: 'YES, RESET', layout: { labelY: 17, labelPx: 10, center: true } });
      drawButton(ctx, { ...popup.cancelRect, color: 'gray', label: 'CANCEL', layout: { labelY: 15, labelPx: 10, center: true } });
    }

    if (popup.closeRect) {
      drawButton(ctx, { ...popup.closeRect, color: 'red', icon: () => SPRITES.xIcon(), pressed: false,
        layout: { iconX: 6, iconY: 5, iconW: 20, iconH: 20 } });
    }
  }

  function inRect(x, y, r) { return r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

  // ---------------- upgrade panel: scroll + deferred purchase ----------------
  const DRAG_SLOP = 5;   // px of movement that turns a press into a scroll

  /** Pointer moved while a popup press is live: scroll the upgrade list. */
  function drag(x, y) {
    if (!popup || !popup.press) return false;
    const p = popup.press;
    const dy = y - p.y;
    if (Math.abs(dy) > DRAG_SLOP) p.moved = true;
    if (p.moved) {
      popup.userScrolled = true;   // the player took over: stop following reveals
      popup.scroll = U.clamp(p.scroll - dy, 0, popup.maxScroll || 0);
    }
    return true;
  }

  /**
   * Pointer released. A press that never turned into a scroll and comes up
   * on the same BUY button it started on is the actual purchase.
   */
  function release(x, y) {
    if (!popup || !popup.press) return false;
    const p = popup.press;
    popup.press = null;
    if (p.moved || !p.card || !inRect(x, y, p.card.btn)) return true;
    const r = Upgrades.buy(popup.farmId, p.card.key);
    if (r.ok) {
      AudioManager.play('buy');
      popup.fx[p.card.key] = 1;
      spawnPanelFx(p.card.btn.x + p.card.btn.w / 2, p.card.btn.y + p.card.btn.h / 2);
      Game.onUpgradePurchased();
    } else {
      AudioManager.play('error');
      toast = { text: r.reason, t: 1.6 };
    }
    return true;
  }

  /** Mouse wheel / trackpad over an open upgrade panel. */
  function scrollBy(dy) {
    if (!popup || popup.type !== 'upgrades' || closing()) return false;
    popup.userScrolled = true;
    popup.scroll = U.clamp((popup.scroll || 0) + dy, 0, popup.maxScroll || 0);
    return true;
  }

  // ---------------- first-upgrade tutorial overlay ----------------
  /** Pixel-style pointing hand, fingertip at (x, y). */
  function drawHand(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#2b2116';
    ctx.fillRect(-3, -2, 8, 14);   // finger outline
    ctx.fillRect(-7, 8, 16, 10);   // palm outline
    ctx.fillStyle = '#fff4e0';
    ctx.fillRect(-2, -1, 6, 12);   // finger
    ctx.fillRect(-6, 9, 14, 8);    // palm
    ctx.restore();
  }

  /**
   * Which entry point the first-upgrade tutorial points at while no panel is
   * open, as {id, target, label}. With one UPGRADE button that is always the
   * button; on a split farm it is whichever entry point owns the cheapest
   * upgrade the player can currently afford — the farmhouse for a farm row,
   * the ANIMALS button for a chain row. Gameplay is frozen for the duration,
   * so the answer can't drift under the player mid-tutorial.
   */
  function tutorialEntry() {
    const id = SaveManager.data.currentFarm;
    if (!CONFIG.splitUpgrades(id)) {
      return { id: 'upgrade', target: buttons.find(b => b.id === 'upgrade'), label: 'UPGRADE YOUR FARM!' };
    }
    const best = Upgrades.cheapestAffordable(id);
    if (!best) return null;
    if (best.group === 'farm') {
      const hr = ENVIRONMENT.houseRect(id);
      return { id: 'house', target: { x: hr.x, y: hr.y, w: hr.w, h: hr.h }, label: 'TAP THE HOUSE!' };
    }
    return { id: 'animals', target: buttons.find(b => b.id === 'animals'), label: 'UPGRADE YOUR ANIMALS!' };
  }

  /** 'upgrade' | 'animals' | 'house' | null — the entry point the tutorial wants tapped. */
  function tutorialEntryId() {
    const e = tutorialEntry();
    return e ? e.id : null;
  }

  /**
   * Spotlight for the first-upgrade tutorial: pulsing glow + hand + label on
   * the entry point (see tutorialEntry), then on the cheapest affordable BUY
   * button inside the upgrade panel. Drawn above HUD and popup.
   */
  function drawUpgradeTutorial(ctx, t) {
    let target = null, label = null;
    if (!popup) {
      const entry = tutorialEntry();
      if (!entry) return;
      target = entry.target;
      label = entry.label;
    } else if (popup.type === 'upgrades') {
      let best = Infinity;
      for (const c of popup.cards || []) {
        const inf = Upgrades.info(popup.farmId, c.key);
        if (!inf.maxed && SaveManager.data.coins >= inf.cost && inf.cost < best) {
          best = inf.cost;
          target = c.btn;
        }
      }
      label = 'TAP BUY!';
    }
    if (!target) return;

    // pulsing golden glow around the target
    const pulse = (Math.sin(t * 6) + 1) / 2;
    const g = 4 + pulse * 4;
    ctx.save();
    ctx.globalAlpha = 0.55 + pulse * 0.45;
    ctx.strokeStyle = '#ffe98a';
    ctx.lineWidth = 3;
    ctx.strokeRect(target.x - g, target.y - g, target.w + g * 2, target.h + g * 2);
    ctx.globalAlpha = 0.25 + pulse * 0.2;
    ctx.fillStyle = '#ffe98a';
    ctx.fillRect(target.x - 2, target.y - 2, target.w + 4, target.h + 4);
    ctx.restore();

    // bobbing hand pointing at the target
    drawHand(ctx, target.x + target.w / 2 + 10, target.y + target.h / 2 + 8 + Math.sin(t * 4) * 4);

    // instruction label, kept fully on screen: above the target normally, but
    // below it when there is no room (the farmhouse sits right under the HUD
    // bar, and the label must not read as part of the top bar)
    const lw = measure(label, SIZE.BUTTON);
    const lx = U.clamp(target.x + target.w / 2, lw / 2 + 6, W - lw / 2 - 6);
    const safe = safeArea();
    const above = target.y - g - 22;
    drawText(ctx, label, lx, above >= safe.y ? above : target.y + target.h + g + 8,
             SIZE.BUTTON, '#ffe98a', 'center', true, false, W - 12);
  }

  /** Returns true if the tap was consumed by UI. */
  function tap(x, y) {
    // a panel on its way out swallows nothing: the tap goes to whatever is
    // behind it, so tapping the button again reopens it mid-exit
    if (popup && !closing()) {
      if (popup.type === 'welcomeBack') {
        // every way out pays at least the base amount (claim is idempotent)
        if (inRect(x, y, popup.closeRect) || inRect(x, y, popup.okRect)) {
          AudioManager.play('click');
          Game.claimWelcome(1);
        } else if (inRect(x, y, popup.adRect)) {
          // ad popup replaces this one, blocking further taps until it ends
          AudioManager.play('click');
          popup = { type: 'adPlaying', t: 0, dur: CONFIG.IDLE.WELCOME_AD_DURATION, onDone: Game.onWelcomeAdDone };
        }
        return true;
      }
      if (inRect(x, y, popup.closeRect)) {
        if (Game.upgradeTutorialActive) return true; // tutorial: must buy before closing
        // walking away from a reward offer counts as a dismissal: it extends
        // that event's cooldown (see js/events.js)
        if (popup.type === 'pigeonAd') Events.dismissed('pigeon');
        else if (popup.type === 'tornadoAd') Events.dismissed('tornado');
        AudioManager.play('click'); beginClose(); return true;
      }
      if (popup.type === 'upgrades') {
        // the list scrolls, so a press only ARMS a purchase: it goes through
        // on release, and only if the finger stayed put (see drag/release)
        const card = (popup.cards || []).find(c => inRect(x, y, c.btn));
        popup.press = { y, scroll: popup.scroll || 0, moved: false, card };
        return true;
      }
      if (popup.type === 'discovery') {
        if (inRect(x, y, popup.okRect)) {
          AudioManager.play('click');
          popup = null;
          Game.endCelebration();
        }
        return true; // no other way out — gameplay stays paused until CONTINUE
      }
      if (popup.type === 'adPlaying') return true; // no skipping the ad
      if (popup.type === 'pigeonAd') {
        if (inRect(x, y, popup.okRect)) {
          AudioManager.play('click');
          popup = { type: 'adPlaying', t: 0, dur: Pigeon.info().adDur, onDone: Pigeon.adCompleted };
        }
        return true;
      }
      if (popup.type === 'tornadoAd') {
        if (inRect(x, y, popup.okRect)) {
          AudioManager.play('click');
          popup = { type: 'adPlaying', t: 0, dur: Tornado.info().adDur, onDone: Tornado.adCompleted };
        } else if (inRect(x, y, popup.cancelRect)) {
          AudioManager.play('click');
          Events.dismissed('tornado');
          popup = null;
        }
        return true;
      }
      if (popup.type === 'crateReveal') {
        // both buttons only exist once the reveal has finished playing, so
        // the animation can never be tapped through into a choice
        if (inRect(x, y, popup.okRect)) {
          AudioManager.play('click');
          popup = null;
          Crate.claim(false);
        } else if (inRect(x, y, popup.adRect) && !popup.adLoading) {
          popup.adLoading = true;
          AudioManager.play('click');
          popup = { type: 'adPlaying', t: 0, dur: Crate.info().adDur, onDone: Crate.adCompleted };
        }
        return true;
      }
      if (popup.type === 'build') {
        if (inRect(x, y, popup.okRect)) {
          const r = Construction.buyNext(popup.farmId);
          if (r.ok) {
            AudioManager.play('buy');
            popup.fx = 1;
            spawnPanelFx(popup.okRect.x + popup.okRect.w / 2, popup.okRect.y + popup.okRect.h / 2);
            Game.onConstructionBuilt(popup.farmId);
          } else {
            AudioManager.play('error');
            toast = { text: r.reason, t: 1.6 };
          }
        }
        return true;
      }
      if (popup.type === 'unlock' && inRect(x, y, popup.okRect)) {
        Game.tryUnlock(popup.farmId);
        return true;
      }
      if (popup.type === 'settings') {
        if (inRect(x, y, popup.musicRect)) { AudioManager.setMusic(!AudioManager.musicOn); SaveManager.data.settings.music = AudioManager.musicOn; SaveManager.save(); AudioManager.play('click'); return true; }
        if (inRect(x, y, popup.sfxRect)) { AudioManager.setSfx(!AudioManager.sfxOn); SaveManager.data.settings.sfx = AudioManager.sfxOn; SaveManager.save(); AudioManager.play('click'); return true; }
        if (inRect(x, y, popup.resetRect)) { AudioManager.play('click'); popup = { type: 'confirm-reset' }; return true; }
      }
      if (popup.type === 'confirm-reset') {
        if (inRect(x, y, popup.okRect)) { AudioManager.play('click'); popup = null; Game.resetAll(); return true; }
        if (inRect(x, y, popup.cancelRect)) { AudioManager.play('click'); popup = null; return true; }
      }
      return true; // modal swallows all taps
    }
    for (const b of buttons) {
      if (!visible(b, Game.scene)) continue;
      // tutorial: only the entry point it spotlights is tappable
      if (Game.upgradeTutorialActive && b.id !== tutorialEntryId()) continue;
      if (inRect(x, y, b)) {
        AudioManager.play('click');
        Game.onButton(b.id);
        return true;
      }
    }
    return false;
  }

  // ---------------- loading screen ----------------
  function drawLoading(ctx, t) {
    // values from Figma E01 (14:27), all Figma px / 2
    ctx.fillStyle = '#2e2416';
    ctx.fillRect(0, 0, W, H);
    // decorative fence strip
    const f = SPRITES.fenceH(24);
    for (let x = 0; x < W; x += 44) ctx.drawImage(f, x, 380, 44, 26);
    drawText(ctx, 'FARM EVOLUTION', W / 2, 255.5, SIZE.TITLE, '#ffe98a', 'center', false, false, W - 24);
    const img = SPRITES.animal('chicken', CONFIG.showcaseStage('chicken'), (t * 3 | 0) % 2 ? 'walk' : 'idle');
    PIXEL.blit(ctx, img, W / 2, 350, 3);
    const dots = '.'.repeat(1 + ((t * 2) | 0) % 3);
    drawText(ctx, 'TAP TO START', W / 2, 590.5, 12, '#f4e8cc', 'center');
    drawText(ctx, 'LOADING' + dots, W / 2, 420.75, 7.5, '#c8b088', 'center');
  }

  return {
    SIZE, drawText, measure, woodPanel, woodSign, drawButton, drawHUD, drawPopup, drawLoading,
    drawHand, drawUpgradeTutorial, drawBadge, safeArea, tutorialEntryId,
    /** Center of an on-screen button — the point a panel grows out of. */
    buttonCenter(id) {
      const b = buttons.find(bt => bt.id === id);
      return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : null;
    },
    tap, drag, release, scrollBy, coinTarget,
    pulseCoin() { coinPulse = 1; },
    showToast(text) { toast = { text, t: 1.6 }; },
    openPopup(p) {
      if (p.type === 'upgrades') {
        // rows discovered since this panel was last open animate in, one
        // after the other rather than all at once — held until the panel has
        // finished opening (see startPendingReveal)
        p.reveal = {};
        p.revealT = 0;
        p.pendingReveal = Upgrades.takeUnrevealed(p.farmId, p.group);
        p.scroll = 0;
        p.maxScroll = 0;
        p.userScrolled = false;
        // a panel where every row is disabled is the player looking straight
        // at their shortage — a poop-rain trigger (js/events.js)
        Events.onUpgradesOpened(p.farmId, p.group);
      }
      if (p.origin) {
        // opening over a panel that is still leaving resumes from the
        // progress already on screen, so an interrupt never flickers
        p.anim = { dir: 'in', p: popup && popup.origin ? (popup.anim ? popup.anim.p : 1) : 0 };
      }
      popup = p;
      // no transition to wait for (or one that starts already settled):
      // the fresh rows animate in right away, as they always did
      if (p.anim && p.anim.p >= 1) p.anim = null;
      if (!p.anim) startPendingReveal();
    },
    closePopup() { popup = null; panelFx = []; },
    /** A live press was interrupted (scene change, cinematic): drop it. */
    cancelPress() { if (popup) popup.press = null; },
    get popup() { return popup; },
    syncCoins() { displayedCoins = SaveManager.data.coins; },
  };
})();
