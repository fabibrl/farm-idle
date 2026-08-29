/**
 * SPRITES — all pixel art authored in code at native resolution,
 * following the reference sheet: warm palette, dark warm-brown outlines,
 * soft two-tone shading, rounded cartoon silhouettes.
 *
 * Animal sprites face RIGHT by default; renderer flips for left.
 * Frames: 'idle' | 'walk' (legs offset) | 'peck' (head down / grazing).
 */
const SPRITES = (() => {

  // ---------- shared palette (sampled from the art bible) ----------
  const P = {
    outline: PIXEL.OUTLINE,
    // chicken
    chickBody: '#f6d879', chickShade: '#d9ab4c', chickLight: '#fdeeb0',
    henBody: '#f7ecd7', henShade: '#d9c193', henLight: '#fffaf0',
    comb: '#d8443a', combShade: '#a52f28', beak: '#e8933c', beakShade: '#b96a24',
    leg: '#c98a3e',
    // sheep
    woolLight: '#f2e9d6', woolMid: '#dfd2b4', woolShade: '#bfae8c',
    woolDark: '#4a3a2c', woolDarkHi: '#6a5642',
    sheepFace: '#3d2f24', sheepFaceHi: '#5c473a',
    // cow
    cowBody: '#f2e0c8', cowShade: '#d3bb99', cowPatch: '#6d4a2f', cowPatchHi: '#8a6140',
    muzzle: '#e8a9a0', muzzleShade: '#c2807a', horn: '#e8d8b8', hornShade: '#b8a380',
    // shared
    eyeWhite: '#ffffff', pupil: '#241a12', blush: '#e8a9a0',
    purple: '#7e5a9e', purpleHi: '#a07cc0', purpleDk: '#5c3f78',
    // chicken mutation line (stages 4-6): the plumage drifts off-color first,
    // long before any limb goes wrong — a sickly pale yellow-green that still
    // reads as feathers next to the healthy hen white above
    strangeBody: '#dfe6a2', strangeShade: '#b2ba72', strangeLight: '#f2f7cc',
    // mutant accents
    glow: '#7de87a', glowHi: '#c4ffb8', glowDk: '#3f9c48',
    tentacle: '#9a6ec0', tentacleHi: '#c09ae0', tentacleDk: '#6a4a90',
    // Mutant 2 abductee skins (final abducted form ONLY — see mutant2();
    // every earlier stage keeps the normal farm palette above)
    alienChick: '#8be07e', alienChickShade: '#4f9c58', alienChickHi: '#d6ffc4',
    alienBeak: '#c25ad8', alienBeakShade: '#8a3aa0',
    alienLeg: '#57945e',
    alienWoolLight: '#cfa9ee', alienWoolMid: '#a87ed2', alienWoolShade: '#7c55a6',
    alienFace: '#1f4a40', alienFaceHi: '#33685a',
    alienCow: '#b2e9dd', alienCowShade: '#7cbcab', alienHoof: '#4d8878',
    alienMuzzle: '#d98ce2', alienMuzzleShade: '#a45cb2',
    alienHorn: '#c2ecfa', alienHornShade: '#7fb4cc',
    // props
    wood: '#a9743f', woodHi: '#c8935a', woodDk: '#7d5027', woodDkr: '#5c3a1d',
    leaf: '#5a8f3c', leafHi: '#7fb35a', leafDk: '#3d6b28',
    leafDark: '#42702e', leafDarkHi: '#5c8f42', leafDarkDk: '#2e5220',
    stone: '#9a938a', stoneHi: '#bab3a8', stoneDk: '#6e675e',
    gold: '#f4c437', goldHi: '#ffe98a', goldDk: '#c88f1e', goldDkr: '#96660f',
    poo: '#7a5230', pooHi: '#96694a', pooDk: '#57381e',
    hay: '#e0b656', hayHi: '#f2d284', hayDk: '#b08a35',
    red: '#c0453a', redHi: '#dd6a56', redDk: '#8e2f27',
    blueRoof: '#4a7a8c', blueRoofHi: '#639aad', blueRoofDk: '#35596a',
  };

  // ============================================================
  //  ANIMALS
  // ============================================================

  /** Eye helper: white + pupil (+ optional blink). */
  function eye(s, x, y, blink) {
    if (blink) { s.rect(x, y + 1, 2, 1, P.pupil); return; }
    s.rect(x, y, 2, 2, P.eyeWhite);
    s.px(x + 1, y + 1, P.pupil);
    s.px(x + 1, y, P.pupil);
  }
  function smallEye(s, x, y, blink) {
    if (blink) { s.px(x, y, P.pupil); return; }
    s.px(x, y, P.eyeWhite); s.px(x + 1, y, P.pupil);
  }
  /** Mutant glowing eye: toxic-green iris with bright core. */
  function glowEye(s, x, y, blink) {
    if (blink) { s.rect(x, y + 1, 2, 1, P.glowDk); return; }
    s.rect(x, y, 2, 2, P.glow);
    s.px(x + 1, y, P.glowHi);
    s.px(x, y + 1, P.glowDk);
  }
  function smallGlowEye(s, x, y, blink) {
    if (blink) { s.px(x, y, P.glowDk); return; }
    s.px(x, y, P.glowHi); s.px(x + 1, y, P.glow);
  }
  /** Bulging oversized eye: the first thing that goes wrong on a chicken. */
  function bigEye(s, x, y, blink) {
    if (blink) { s.rect(x + 1, y + 2, 3, 1, P.pupil); return; }
    s.ellipse(x + 1.5, y + 1.5, 2, 2, P.eyeWhite);
    s.rect(x + 2, y + 1, 2, 2, P.pupil);
    s.px(x + 1, y + 1, P.eyeWhite);
  }

  // ----------------- CHICKEN -----------------
  /**
   * Farm 1's six board stages, one continuous lineage:
   *   0 BABY     round yellow puff
   *   1 TEEN     the same chick grown gangly — long legs, oversized feet,
   *              half-grown feathers coming in white over the yellow
   *   2 ADULT    the standard farm hen the teen was heading towards
   *   3 STRANGE  that hen, subtly wrong: bulging eyes, a giraffe neck,
   *              mismatched legs, plumage drifted off-color
   *   4 MUTANT   openly mutated: eyes budding where they shouldn't, an extra
   *              wing, a toothy grin, discolored patches, warped proportions
   *   5 MUTANT 2 chaos: a second head, four spindly legs, duplicated wings,
   *              tumor growths, the first glowing details
   * Every stage keeps the one before it readable inside it — comb, beak,
   * wattle and wing never leave, they only warp.
   */
  function drawChicken(s, stage, frame, blink) {
    const walk = frame === 'walk', peck = frame === 'peck';
    if (stage === 0) {
      // BABY CHICK 18x16 — round yellow puff, big eyes
      const hy = peck ? 2 : 0;
      // legs
      s.line(7, 13, 7, 15, P.leg); s.line(11 + (walk ? 1 : 0), 13, 11 + (walk ? 1 : 0), 15, P.leg);
      s.px(6, 15, P.leg); s.px(12 + (walk ? 1 : 0), 15, P.leg);
      // body+head blob
      s.ellipse(9, 8 + hy * 0.4, 6, 6, P.chickBody);
      s.shadeEllipse(9, 8 + hy * 0.4, 6, 6, P.chickShade, 1, 0.4);
      s.ellipse(7, 5 + hy * 0.3, 2.5, 2, P.chickLight);
      // tail nub
      s.px(3, 7, P.chickShade); s.px(2, 8, P.chickShade);
      // wing
      s.ellipse(7, 10 + hy * 0.4, 2.5, 2, P.chickShade);
      // beak
      s.px(15, 7 + hy, P.beak); s.px(16, 7 + hy, P.beak); s.px(15, 8 + hy, P.beakShade);
      // comb tuft
      s.px(9, 1 + hy, P.chickShade); s.px(10, 1 + hy, P.chickShade);
      eye(s, 11, 5 + hy, blink);
      s.px(13, 8 + hy, P.blush);
    } else if (stage === 1) {
      // TEEN 21x19 — the chick stretched out: gangly legs, oversized feet,
      // a small comb starting and white adult feathers patching in
      const hy = peck ? 3 : 0;
      // long thin legs with big clumsy feet
      s.line(8, 12, 8, 16, P.leg); s.line(13 + (walk ? 1 : 0), 12, 13 + (walk ? 1 : 0), 16, P.leg);
      s.rect(6, 17, 4, 1, P.leg); s.rect(12 + (walk ? 1 : 0), 17, 4, 1, P.leg);
      // stray half-grown tail feathers
      s.px(3, 7, P.henShade); s.px(2, 6, P.henBody); s.px(3, 9, P.chickShade);
      // body — chick yellow with adult white coming in unevenly
      s.ellipse(9, 9, 5.5, 5, P.chickBody);
      s.shadeEllipse(9, 9, 5.5, 5, P.chickShade, 1, 0.38);
      s.ellipse(7, 7, 2.2, 1.8, P.henBody);
      s.px(11, 11, P.henBody); s.px(10, 12, P.henLight);
      // stubby wing, half feathered
      s.ellipse(8, 11, 2.6, 2, P.chickShade);
      s.px(9, 10, P.henBody);
      // head on a thin new neck
      s.rect(12, 7 + hy, 3, 3, P.chickBody);
      s.ellipse(14, 5 + hy, 3.2, 3, P.chickBody);
      s.ellipse(13, 4 + hy, 1.4, 1.2, P.chickLight);
      // the comb, only just started
      s.px(13, 1 + hy, P.comb); s.px(14, 1 + hy, P.comb); s.px(14, 2 + hy, P.combShade);
      // beak
      s.rect(17, 5 + hy, 2, 1, P.beak); s.px(17, 6 + hy, P.beakShade);
      eye(s, 15, 4 + hy, blink);
    } else if (stage === 2) {
      // ADULT HEN 24x22 — white body, red comb, tail feathers
      const hy = peck ? 3 : 0;
      s.line(9, 18, 9, 21, P.leg); s.line(14 + (walk ? 1 : 0), 18, 14 + (walk ? 1 : 0), 21, P.leg);
      s.px(8, 21, P.leg); s.px(10, 21, P.leg); s.px(13 + (walk ? 1 : 0), 21, P.leg); s.px(15 + (walk ? 1 : 0), 21, P.leg);
      // tail
      s.ellipse(4, 8, 3, 4, P.henShade);
      s.ellipse(4, 6, 2, 2.5, P.henBody);
      // body
      s.ellipse(11, 13, 7, 6, P.henBody);
      s.shadeEllipse(11, 13, 7, 6, P.henShade, 1, 0.38);
      // head
      s.ellipse(17, 6 + hy, 4, 4, P.henBody);
      s.ellipse(15.5, 4.5 + hy, 1.8, 1.5, P.henLight);
      s.rect(14, 8 + hy, 5, 5, P.henBody); // neck join
      // wing
      s.ellipse(10, 14, 4, 3, P.henShade);
      s.ellipse(10, 13, 3, 2, P.henBody);
      // comb
      s.px(16, 1 + hy, P.comb); s.px(17, 0 + hy, P.comb); s.px(18, 1 + hy, P.comb);
      s.rect(16, 2 + hy, 3, 1, P.comb); s.px(17, 2 + hy, P.combShade);
      // beak + wattle
      s.rect(21, 6 + hy, 2, 1, P.beak); s.px(21, 7 + hy, P.beakShade);
      s.px(20, 8 + hy, P.comb); s.px(20, 9 + hy, P.combShade);
      eye(s, 18, 4 + hy, blink);
    } else if (stage === 3) {
      // STRANGE 28x26 — still plainly the adult hen, but every proportion is
      // slightly wrong: an absurd neck, mismatched legs, bulging eyes and
      // plumage that has drifted off-color. Nothing is duplicated yet.
      const hy = peck ? 4 : 0;
      // mismatched legs: one long and thin, one short and thick
      s.line(10, 19, 10, 24, P.leg); s.rect(9, 25, 3, 1, P.leg);
      s.rect(15 + (walk ? 1 : 0), 21, 2, 4, P.leg); s.rect(15 + (walk ? 1 : 0), 25, 3, 1, P.leg);
      // limp off-color tail plume, clear of the body behind it
      s.ellipse(3, 14, 3, 4, P.strangeShade);
      s.ellipse(2, 11, 2, 2.4, P.strangeBody);
      // body
      s.ellipse(11, 17, 7, 6, P.strangeBody);
      s.shadeEllipse(11, 17, 7, 6, P.strangeShade, 1, 0.36);
      // wing
      s.ellipse(10, 18, 4, 3, P.strangeShade);
      s.ellipse(10, 17, 3, 2, P.strangeBody);
      // giraffe neck
      s.rect(15, 5 + hy, 4, 12 - hy, P.strangeBody);
      s.rect(18, 5 + hy, 1, 12 - hy, P.strangeShade);
      // small head perched on top of it
      s.ellipse(19, 5 + hy, 4, 3.5, P.strangeBody);
      s.ellipse(18, 3.5 + hy, 1.6, 1.2, P.strangeLight);
      // comb, beak, wattle — all still the hen's
      s.px(15, 1 + hy, P.comb); s.px(16, 0 + hy, P.comb); s.px(17, 1 + hy, P.comb);
      s.rect(15, 2 + hy, 3, 1, P.comb); s.px(16, 2 + hy, P.combShade);
      s.rect(23, 5 + hy, 3, 1, P.beak); s.px(23, 6 + hy, P.beakShade);
      s.px(22, 7 + hy, P.comb); s.px(22, 8 + hy, P.combShade);
      // one enormous bulging eye, swollen straight out of the head
      bigEye(s, 19, 1 + hy, blink);
    } else if (stage === 4) {
      // MUTANT 32x30 — openly wrong: eyes budding off the head, an extra
      // wing sprouting over the back, a toothy grin under the beak and
      // discolored patches across warped proportions. Still one head.
      const hy = peck ? 4 : 0;
      // legs, still mismatched — the short one has thickened further
      s.line(11, 22, 11, 28, P.leg); s.rect(10, 29, 3, 1, P.leg);
      s.rect(17 + (walk ? 1 : 0), 24, 3, 5, P.leg); s.rect(17 + (walk ? 1 : 0), 29, 3, 1, P.leg);
      // tail plume behind the body, with the first purple growth on it
      s.ellipse(3, 16, 3.5, 4.5, P.strangeShade);
      s.ellipse(2, 11, 2.2, 2.6, P.purple);
      s.px(2, 9, P.purpleHi);
      // body, patchy and discolored
      s.ellipse(13, 20, 8, 7, P.strangeBody);
      s.shadeEllipse(13, 20, 8, 7, P.strangeShade, 1, 0.34);
      s.ellipse(15, 22, 2.6, 2, P.purpleDk);
      s.ellipse(10, 18, 2, 1.6, P.henBody);
      // the EXTRA wing, sprouted over the back, above the normal one
      s.ellipse(16, 16, 3.4, 2.6, P.strangeShade);
      s.ellipse(16, 15.5, 2.6, 1.8, P.strangeBody);
      s.ellipse(11, 21, 4.5, 3.4, P.strangeShade);
      s.ellipse(11, 20, 3.6, 2.6, P.strangeBody);
      // thick warped neck
      s.rect(18, 7 + hy, 5, 12 - hy, P.strangeBody);
      s.rect(22, 7 + hy, 1, 12 - hy, P.strangeShade);
      // oversized head
      s.ellipse(22, 7 + hy, 5, 4.5, P.strangeBody);
      s.ellipse(20.5, 5 + hy, 2, 1.5, P.strangeLight);
      // the comb has gone purple
      s.px(18, 1 + hy, P.purple); s.px(20, 0 + hy, P.purple); s.px(22, 1 + hy, P.purple);
      s.rect(18, 2 + hy, 5, 2, P.purple);
      s.px(19, 2 + hy, P.purpleHi); s.px(21, 2 + hy, P.purpleHi);
      s.rect(19, 4 + hy, 3, 1, P.purpleDk);
      // beak, and an unsettling grin under it
      s.rect(27, 7 + hy, 3, 2, P.beak); s.px(27, 9 + hy, P.beakShade);
      s.rect(23, 10 + hy, 5, 1, P.combShade);
      s.px(24, 11 + hy, P.eyeWhite); s.px(26, 11 + hy, P.eyeWhite);
      // eyes in the wrong places: bulging off the head, then one down the
      // neck and one budding on the back
      bigEye(s, 23, 2 + hy, blink);
      eye(s, 19, 8 + hy, blink);
      eye(s, 18, 13 + hy, blink);
      smallEye(s, 12, 17, blink);
    } else {
      // MUTANT 2 36x34 — chaos: a SECOND head on its own crooked neck, FOUR
      // spindly legs (one already a tentacle), duplicated wings, tumor
      // growths and the first bioluminescence. Every feature of the stage
      // before it is still here, just doubled or distorted.
      const hy = peck ? 4 : 0;
      // four spindly legs, no two alike
      s.line(9, 25, 9, 32, P.leg); s.rect(8, 33, 3, 1, P.leg);
      s.line(14, 27, 14, 32, P.leg); s.rect(13, 33, 3, 1, P.leg);
      s.line(19 + (walk ? 1 : 0), 24, 19 + (walk ? 1 : 0), 32, P.leg);
      s.rect(18 + (walk ? 1 : 0), 33, 3, 1, P.leg);
      s.line(23, 27, 24, 32, P.tentacle); s.px(25, 33, P.tentacleHi);
      // tail plume behind the body, now lumpy
      s.ellipse(3, 19, 3.5, 4.5, P.strangeShade);
      s.ellipse(2, 14, 2.4, 2.8, P.purple); s.px(2, 12, P.purpleHi);
      s.ellipse(6, 24, 2, 1.8, P.purpleDk);
      // asymmetric body with tumor patches
      s.ellipse(14, 22, 9, 8, P.strangeBody);
      s.shadeEllipse(14, 22, 9, 8, P.strangeShade, 1, 0.34);
      s.ellipse(17, 25, 3, 2.2, P.purpleDk);
      s.ellipse(9, 19, 2.4, 1.8, P.henBody);
      // glowing chest blotch
      s.ellipse(17, 27, 2.4, 1.8, P.glowDk);
      s.px(17, 26, P.glow);
      // THREE wings where there should be one
      s.ellipse(11, 23, 4.6, 3.4, P.strangeShade); s.ellipse(11, 22, 3.6, 2.6, P.strangeBody);
      s.ellipse(16, 24, 3.4, 2.6, P.strangeShade); s.ellipse(16, 23.5, 2.6, 1.8, P.strangeBody);
      s.ellipse(17, 17, 3.4, 2.4, P.strangeShade); s.ellipse(17, 16.5, 2.6, 1.6, P.strangeBody);
      // SECOND head — smaller, crooked neck, beak pointing backwards
      s.rect(8, 12, 3, 6, P.strangeBody);
      s.ellipse(8, 10, 3.4, 3, P.strangeBody);
      s.px(4, 10, P.beak); s.px(3, 10, P.beak); s.px(4, 11, P.beakShade);
      s.px(7, 6, P.purple); s.px(9, 5, P.purple); s.rect(7, 7, 3, 1, P.purpleDk);
      glowEye(s, 6, 9, blink);
      // MAIN head, on the long neck
      s.rect(20, 8 + hy, 5, 12 - hy, P.strangeBody);
      s.rect(24, 8 + hy, 1, 12 - hy, P.strangeShade);
      s.ellipse(24, 8 + hy, 5.5, 5, P.strangeBody);
      s.ellipse(22, 5.5 + hy, 2, 1.6, P.strangeLight);
      // tall purple crest
      s.px(22, 1 + hy, P.purple); s.px(24, 0 + hy, P.purple); s.px(26, 1 + hy, P.purple);
      s.rect(22, 2 + hy, 6, 2, P.purple);
      s.px(23, 2 + hy, P.purpleHi); s.px(25, 2 + hy, P.purpleHi);
      s.rect(23, 4 + hy, 4, 1, P.purpleDk);
      // beak + the grin, both grown
      s.rect(29, 8 + hy, 3, 2, P.beak); s.px(29, 10 + hy, P.beakShade);
      s.rect(25, 11 + hy, 5, 1, P.combShade);
      s.px(26, 12 + hy, P.eyeWhite); s.px(28, 12 + hy, P.eyeWhite);
      // glowing eyes, on and off the head
      glowEye(s, 25, 5 + hy, blink);
      glowEye(s, 21, 8 + hy, blink);
      glowEye(s, 20, 14 + hy, blink);
      smallGlowEye(s, 12, 18, blink);
    }
  }

  // ----------------- SHEEP -----------------
  /** Wool cloud made of overlapping bumps. */
  function woolCloud(s, cx, cy, rx, ry, light, mid, shade) {
    s.ellipse(cx, cy, rx, ry, mid);
    const bumps = 7;
    for (let i = 0; i < bumps; i++) {
      const a = (i / bumps) * Math.PI * 2;
      s.ellipse(cx + Math.cos(a) * rx * 0.8, cy + Math.sin(a) * ry * 0.8, rx * 0.32, ry * 0.34, mid);
    }
    s.shadeEllipse(cx, cy + 1, rx + 1, ry + 1, shade, 1, 0.32);
    s.ellipse(cx - rx * 0.35, cy - ry * 0.4, rx * 0.4, ry * 0.35, light);
  }

  function drawSheep(s, stage, frame, blink) {
    const walk = frame === 'walk', graze = frame === 'peck';
    if (stage === 0) {
      // BABY 18x16 — dark little lamb with pale wool cap
      const hy = graze ? 2 : 0;
      s.line(7, 13, 7, 15, P.sheepFace); s.line(12 + (walk ? 1 : 0), 13, 12 + (walk ? 1 : 0), 15, P.sheepFace);
      woolCloud(s, 8, 9, 5, 4.5, P.woolDarkHi, P.woolDark, '#332619');
      // pale head
      s.ellipse(13, 7 + hy, 3.5, 3.5, P.woolMid);
      s.ellipse(12, 5.5 + hy, 1.5, 1.3, P.woolLight);
      // ears
      s.rect(10, 6 + hy, 2, 1, P.woolShade); s.px(15, 9 + hy, P.woolShade);
      eye(s, 13, 6 + hy, blink);
      s.px(15, 9 + hy, P.pupil); // nose
    } else if (stage === 1) {
      // ADULT 24x20 — cream wool cloud, dark face
      const hy = graze ? 3 : 0;
      s.line(8, 16, 8, 19, P.sheepFace); s.line(15 + (walk ? 1 : 0), 16, 15 + (walk ? 1 : 0), 19, P.sheepFace);
      woolCloud(s, 11, 10, 7.5, 6, P.woolLight, P.woolMid, P.woolShade);
      // dark face
      s.ellipse(19, 8 + hy, 4, 4, P.sheepFace);
      s.ellipse(18, 6.5 + hy, 1.6, 1.4, P.sheepFaceHi);
      // wool tuft on head
      s.ellipse(17, 4 + hy, 2.5, 1.8, P.woolLight);
      // ears
      s.rect(15, 7 + hy, 2, 2, P.sheepFaceHi);
      eye(s, 19, 7 + hy, blink);
      s.px(22, 10 + hy, P.pupil);
    } else if (stage === 2) {
      // ELDER 30x26 — mega fluff, purple curly horns, extra eyes
      const hy = graze ? 3 : 0;
      s.line(10, 21, 10, 25, P.sheepFace); s.line(19 + (walk ? 1 : 0), 21, 19 + (walk ? 1 : 0), 25, P.sheepFace);
      woolCloud(s, 14, 13, 10, 8.5, P.woolLight, P.woolMid, P.woolShade);
      // face
      s.ellipse(23, 10 + hy, 5, 5, P.sheepFace);
      s.ellipse(21.5, 8 + hy, 2, 1.8, P.sheepFaceHi);
      // wool crown
      s.ellipse(21, 4.5 + hy, 3.5, 2.4, P.woolLight);
      // purple curly horns
      s.ellipse(17, 5 + hy, 2.2, 2.2, P.purple);
      s.ellipse(17, 5 + hy, 1, 1, P.purpleDk);
      s.px(16, 3 + hy, P.purpleHi);
      s.ellipse(26, 4 + hy, 2.2, 2.2, P.purple);
      s.ellipse(26, 4 + hy, 1, 1, P.purpleDk);
      s.px(27, 2 + hy, P.purpleHi);
      // THREE eyes
      eye(s, 21, 9 + hy, blink);
      eye(s, 25, 9 + hy, blink);
      smallEye(s, 23, 12 + hy, blink);
      s.px(27, 13 + hy, P.pupil);
    } else {
      // MUTANT 36x32 — colossal fluff, FOUR horns, second face in the wool,
      // glowing eyes, tentacles poking out underneath
      const hy = graze ? 3 : 0;
      // five legs
      s.line(9, 26, 9, 31, P.sheepFace); s.line(15 + (walk ? 1 : 0), 26, 15 + (walk ? 1 : 0), 31, P.sheepFace);
      s.line(21, 26, 21, 31, P.sheepFace); s.line(26 + (walk ? 1 : 0), 26, 26 + (walk ? 1 : 0), 31, P.sheepFace);
      s.line(12, 27, 12, 31, P.sheepFace);
      // tentacles peeking from under the wool
      s.line(6, 25, 3, 22, P.tentacle); s.px(2, 21, P.tentacleHi);
      s.line(30, 26, 33, 24, P.tentacle); s.px(34, 23, P.tentacleHi);
      // colossal wool cloud
      woolCloud(s, 16, 16, 12, 10, P.woolLight, P.woolMid, P.woolShade);
      // strange glowing wool tufts
      s.px(9, 9, P.glow); s.px(10, 10, P.glowDk);
      s.px(22, 22, P.glow); s.px(14, 20, P.glowDk);
      // SECOND tiny face embedded in the wool
      s.ellipse(9, 14, 3, 3, P.sheepFace);
      s.px(8, 12.5, P.sheepFaceHi);
      glowEye(s, 8, 13, blink);
      s.px(11, 15, P.pupil);
      // main face
      s.ellipse(27, 12 + hy, 5.5, 5.5, P.sheepFace);
      s.ellipse(25, 9.5 + hy, 2.2, 2, P.sheepFaceHi);
      // wool crown
      s.ellipse(25, 5 + hy, 4, 2.6, P.woolLight);
      // FOUR purple curly horns
      s.ellipse(20, 6 + hy, 2.4, 2.4, P.purple);
      s.ellipse(20, 6 + hy, 1, 1, P.purpleDk); s.px(19, 4 + hy, P.purpleHi);
      s.ellipse(31, 5 + hy, 2.4, 2.4, P.purple);
      s.ellipse(31, 5 + hy, 1, 1, P.purpleDk); s.px(32, 3 + hy, P.purpleHi);
      s.ellipse(15, 4, 1.8, 1.8, P.purple);
      s.ellipse(15, 4, 0.8, 0.8, P.purpleDk);
      s.ellipse(34, 9 + hy, 1.6, 1.6, P.purple);
      s.px(34, 8 + hy, P.purpleHi);
      // THREE glowing eyes + nose
      glowEye(s, 25, 11 + hy, blink);
      glowEye(s, 29, 11 + hy, blink);
      smallGlowEye(s, 27, 14 + hy, blink);
      s.px(31, 15 + hy, P.pupil);
    }
  }

  // ----------------- COW -----------------
  function cowPatches(s, spots) {
    for (const [x, y, rx, ry] of spots) {
      s.ellipse(x, y, rx, ry, P.cowPatch);
      s.px(x - 1, y - 1, P.cowPatchHi);
    }
  }
  function drawCow(s, stage, frame, blink) {
    const walk = frame === 'walk', graze = frame === 'peck';
    if (stage === 0) {
      // BABY CALF 18x16 — big head, tiny body
      const hy = graze ? 2 : 0;
      s.line(6, 13, 6, 15, P.cowShade); s.line(10 + (walk ? 1 : 0), 13, 10 + (walk ? 1 : 0), 15, P.cowShade);
      s.ellipse(8, 10, 5, 4, P.cowBody);
      s.shadeEllipse(8, 10, 5, 4, P.cowShade, 1, 0.4);
      cowPatches(s, [[6, 9, 1.6, 1.2]]);
      // big head
      s.ellipse(12, 6 + hy, 4.5, 4, P.cowBody);
      s.ellipse(11, 4.5 + hy, 1.8, 1.4, '#fbf0e0');
      cowPatches(s, [[10, 3.5 + hy, 1.4, 1]]);
      // ears
      s.rect(8, 4 + hy, 2, 2, P.cowShade); s.px(16, 5 + hy, P.cowShade);
      // muzzle
      s.ellipse(14, 8.5 + hy, 2.4, 1.6, P.muzzle);
      s.px(14, 8 + hy, P.pupil); s.px(16, 8 + hy, P.pupil);
      eye(s, 12, 4 + hy, blink);
      // tail
      s.px(3, 9, P.cowShade); s.px(2, 10, P.cowPatch);
    } else if (stage === 1) {
      // ADULT 26x22
      const hy = graze ? 3 : 0;
      s.line(9, 17, 9, 21, P.cowShade); s.line(16 + (walk ? 1 : 0), 17, 16 + (walk ? 1 : 0), 21, P.cowShade);
      s.rect(8, 21, 3, 1, P.cowShade); s.rect(15 + (walk ? 1 : 0), 21, 3, 1, P.cowShade);
      s.ellipse(12, 13, 8, 6, P.cowBody);
      s.shadeEllipse(12, 13, 8, 6, P.cowShade, 1, 0.36);
      cowPatches(s, [[8, 11, 2.4, 2], [15, 16, 2, 1.6]]);
      // head
      s.ellipse(19, 7 + hy, 5, 4.5, P.cowBody);
      s.ellipse(17.5, 5 + hy, 2, 1.6, '#fbf0e0');
      cowPatches(s, [[17, 4 + hy, 1.6, 1.2]]);
      // horns
      s.rect(15, 2 + hy, 2, 2, P.horn); s.px(15, 2 + hy, P.hornShade);
      s.rect(22, 2 + hy, 2, 2, P.horn); s.px(23, 2 + hy, P.hornShade);
      // ears
      s.rect(13, 6 + hy, 2, 2, P.cowShade);
      // muzzle
      s.ellipse(21.5, 10 + hy, 3, 2, P.muzzle);
      s.shadeEllipse(21.5, 10 + hy, 3, 2, P.muzzleShade, 1, 0.5);
      s.px(20, 10 + hy, P.pupil); s.px(23, 10 + hy, P.pupil);
      eye(s, 19, 5 + hy, blink);
      // tail
      s.px(4, 11, P.cowShade); s.px(3, 12, P.cowShade); s.px(3, 13, P.cowPatch);
    } else if (stage === 2) {
      // ELDER 32x28 — big horns, extra eyes, chaotic patches
      const hy = graze ? 3 : 0;
      s.line(11, 22, 11, 27, P.cowShade); s.line(20 + (walk ? 1 : 0), 22, 20 + (walk ? 1 : 0), 27, P.cowShade);
      s.rect(10, 27, 3, 1, P.cowShade); s.rect(19 + (walk ? 1 : 0), 27, 3, 1, P.cowShade);
      s.ellipse(14, 17, 10, 7.5, P.cowBody);
      s.shadeEllipse(14, 17, 10, 7.5, P.cowShade, 1, 0.34);
      cowPatches(s, [[8, 14, 3, 2.4], [18, 21, 2.6, 2], [14, 12, 2, 1.6]]);
      // head
      s.ellipse(23, 9 + hy, 6.5, 5.5, P.cowBody);
      s.ellipse(21, 6.5 + hy, 2.5, 2, '#fbf0e0');
      cowPatches(s, [[21, 5 + hy, 2, 1.4]]);
      // BIG curved horns
      s.rect(17, 3 + hy, 2, 3, P.horn); s.rect(16, 1 + hy, 2, 3, P.horn); s.px(16, 1 + hy, P.hornShade);
      s.rect(28, 3 + hy, 2, 3, P.horn); s.rect(29, 1 + hy, 2, 3, P.horn); s.px(30, 1 + hy, P.hornShade);
      // third tiny horn
      s.rect(23, 0 + hy, 1, 3, P.horn);
      // muzzle
      s.ellipse(26, 12.5 + hy, 3.6, 2.4, P.muzzle);
      s.shadeEllipse(26, 12.5 + hy, 3.6, 2.4, P.muzzleShade, 1, 0.5);
      s.px(24, 12 + hy, P.pupil); s.px(28, 12 + hy, P.pupil);
      // THREE eyes
      eye(s, 20, 7 + hy, blink);
      eye(s, 25, 7 + hy, blink);
      smallEye(s, 23, 10 + hy, blink);
      // tail
      s.px(4, 14, P.cowShade); s.px(3, 15, P.cowShade); s.px(3, 16, P.cowPatch);
    } else {
      // MUTANT 40x34 — FIVE horns, FOUR glowing eyes, purple mutant patches,
      // tentacle tail, an extra little leg
      const hy = graze ? 3 : 0;
      // legs (plus a stubby extra one in the middle)
      s.line(13, 27, 13, 33, P.cowShade); s.line(24 + (walk ? 1 : 0), 27, 24 + (walk ? 1 : 0), 33, P.cowShade);
      s.rect(12, 33, 3, 1, P.cowShade); s.rect(23 + (walk ? 1 : 0), 33, 3, 1, P.cowShade);
      s.line(18, 29, 18, 33, P.cowShade); s.rect(17, 33, 3, 1, P.cowShade);
      // tentacle tail
      s.line(6, 18, 3, 13, P.tentacle); s.line(3, 13, 5, 9, P.tentacle);
      s.px(5, 8, P.tentacleHi); s.px(3, 12, P.tentacleDk);
      s.px(6, 21, P.tentacle); s.px(5, 22, P.tentacleDk);
      // huge body
      s.ellipse(17, 21, 12, 9, P.cowBody);
      s.shadeEllipse(17, 21, 12, 9, P.cowShade, 1, 0.32);
      // chaotic patches — brown plus PURPLE mutant patches
      cowPatches(s, [[10, 17, 3.2, 2.6], [22, 26, 2.8, 2.2]]);
      s.ellipse(17, 15, 2.6, 2, P.purple); s.px(16, 14, P.purpleHi);
      s.ellipse(12, 24, 2.2, 1.8, P.purple); s.px(11, 23, P.purpleHi);
      // glowing patch
      s.ellipse(24, 17, 2, 1.6, P.glowDk); s.px(24, 16, P.glow);
      // head
      s.ellipse(29, 11 + hy, 7.5, 6.5, P.cowBody);
      s.ellipse(26.5, 8 + hy, 3, 2.4, '#fbf0e0');
      cowPatches(s, [[26, 6.5 + hy, 2.2, 1.6]]);
      // FIVE horns: two big curved pairs + tiny center horn
      s.rect(21, 4 + hy, 2, 4, P.horn); s.rect(20, 1 + hy, 2, 4, P.horn); s.px(20, 1 + hy, P.hornShade);
      s.rect(35, 4 + hy, 2, 4, P.horn); s.rect(36, 1 + hy, 2, 4, P.horn); s.px(37, 1 + hy, P.hornShade);
      s.rect(24, 2 + hy, 2, 3, P.horn); s.px(24, 2 + hy, P.hornShade);
      s.rect(32, 2 + hy, 2, 3, P.horn); s.px(33, 2 + hy, P.hornShade);
      s.rect(28, 0 + hy, 2, 3, P.horn);
      // ears
      s.rect(20, 8 + hy, 2, 2, P.cowShade);
      // muzzle with little fangs
      s.ellipse(32.5, 15 + hy, 4.2, 2.8, P.muzzle);
      s.shadeEllipse(32.5, 15 + hy, 4.2, 2.8, P.muzzleShade, 1, 0.5);
      s.px(30, 14.5 + hy, P.pupil); s.px(35, 14.5 + hy, P.pupil);
      s.px(30, 17 + hy, P.eyeWhite); s.px(34, 17 + hy, P.eyeWhite);
      // FOUR glowing eyes
      glowEye(s, 25, 9 + hy, blink);
      glowEye(s, 31, 9 + hy, blink);
      smallGlowEye(s, 28, 12 + hy, blink);
      smallGlowEye(s, 23, 12 + hy, blink);
    }
  }

  // One entry per BOARD stage of that species' chain (CONFIG.CHAINS), growing
  // steadily so each merge reads as a step up. The abducted final form is not
  // here — it has its own sprite (see mutant2()).
  const ANIMAL_SIZES = {
    chicken: [[18, 16], [21, 19], [24, 22], [28, 26], [32, 30], [36, 34]],
    sheep:   [[18, 16], [24, 20], [30, 26], [36, 32]],
    cow:     [[18, 16], [26, 22], [32, 28], [40, 34]],
  };
  const DRAWERS = { chicken: drawChicken, sheep: drawSheep, cow: drawCow };

  /** Get animal sprite canvas: species, board stage index, frame, blink. */
  function animal(species, stage, frame = 'idle', blink = false) {
    const [w, h] = ANIMAL_SIZES[species][stage];
    return PIXEL.sprite(`a:${species}:${stage}:${frame}:${blink ? 1 : 0}`, w + 2, h + 2, s => {
      s.g.translate(1, 1);
      DRAWERS[species](s, stage, frame, blink);
      s.g.translate(-1, -1);
      s.outline();
    });
  }

  // ============================================================
  //  ECONOMY SPRITES
  // ============================================================

  function poop(size = 0) {
    const d = 10 + size * 2;
    return PIXEL.sprite(`poop:${size}`, d + 2, d + 2, s => {
      const c = d / 2 + 1;
      s.ellipse(c, d - 2, d / 2 - 1, 2.4, P.poo);
      s.ellipse(c, d - 4.5, d / 2 - 2.5, 2.2, P.poo);
      s.ellipse(c, d - 6.5, d / 2 - 4, 1.8, P.poo);
      s.px(c, d - 8, P.poo);
      s.shadeEllipse(c, d - 2, d / 2 - 1, 2.4, P.pooDk, 1, 0.5);
      s.px(c - 2, d - 5, P.pooHi); s.px(c - 1, d - 7, P.pooHi);
      s.outline();
    });
  }

  function coin(size = 2) {  // size 0..3 like reference "coin assets"
    const d = [6, 8, 12, 16][size];
    return PIXEL.sprite(`coin:${size}`, d + 2, d + 2, s => {
      const c = d / 2 + 1, r = d / 2;
      s.ellipse(c, c, r, r, P.gold);
      s.shadeEllipse(c, c, r, r, P.goldDk, 1, 0.42);
      s.ellipse(c - r * 0.3, c - r * 0.35, r * 0.35, r * 0.3, P.goldHi);
      if (size >= 2) {
        s.ellipse(c, c, r - 2, r - 2, P.gold);
        // inner ring + face mark
        for (let a = 0; a < 16; a++) {
          const t = a / 16 * Math.PI * 2;
          s.px(Math.round(c + Math.cos(t) * (r - 1.6)), Math.round(c + Math.sin(t) * (r - 1.6)), P.goldDk);
        }
        s.rect(c - 1, c - r + 3, 2, d - 6, P.goldDk);
        s.px(c - r * 0.3 | 0, c - r * 0.35 | 0, P.goldHi);
      }
      s.outline();
    });
  }

  // ============================================================
  //  UFO / MUTANT 2 (end-game collection layer)
  // ============================================================

  /**
   * The chain's FINAL form — born from merging two of the last board stage
   * (Farm 1: the Final Chicken, hyper mutation). Built from scratch, sharing
   * no silhouette, pose, or feature set with the board stage below it: the
   * escalation is structural chaos — extra heads,
   * extra legs, eyes budding where they shouldn't, duplicated and
   * mismatched anatomy — while each still reads as the farm's animal.
   * On top of the chaos, the abduction changed them: every species swaps
   * its natural farm palette for its own alien skin (P.alien*) — sickly
   * bioluminescent green feathers, irradiated violet wool, spectral pale
   * hide — plus antennae with glowing tips. Earlier stages are untouched.
   * Bottom-anchored 30x28, blitted by the UFO exactly like the old alien.
   */
  function mutant2(species) {
    return PIXEL.sprite(`mut2:${species}`, 30, 28, s => {
      if (species === 'chicken') {
        // ABDUCTEE HYDRA CHICK — no yellow left on it: sickly biolumin-
        // escent green feathers, violet beaks, antennae with glowing tips.
        // THREE heads on necks of different heights, FOUR mismatched legs
        // (one is a tentacle), eyes budding on the body, one feathered
        // wing and one tentacle wing
        // four legs, no two alike
        s.line(8, 23, 8, 25, P.alienLeg); s.px(7, 26, P.alienLeg); s.px(9, 26, P.alienLeg);
        s.line(12, 23, 12, 27, P.alienLeg); s.px(11, 27, P.alienLeg); s.px(13, 27, P.alienLeg);
        s.line(18, 23, 18, 26, P.alienLeg); s.px(17, 27, P.alienLeg); s.px(19, 27, P.alienLeg);
        s.line(22, 23, 24, 26, P.tentacle); s.px(25, 27, P.tentacleHi); // tentacle leg
        // round body — irradiated speckles on the flank
        s.ellipse(15, 18, 8, 6, P.alienChick);
        s.shadeEllipse(15, 18, 8, 6, P.alienChickShade, 1, 0.36);
        s.ellipse(11, 15, 3, 2.2, P.alienChickHi);
        s.px(14, 16, P.alienChickHi); s.px(19, 18, P.alienChickHi);
        // one FEATHERED wing (left) ...
        s.ellipse(8, 18, 3, 4, P.alienChickShade);
        s.ellipse(8, 17, 2.2, 3, P.alienChick);
        // ... and one TENTACLE wing (right)
        s.line(22, 16, 26, 13, P.tentacle); s.line(26, 13, 27, 10, P.tentacle);
        s.px(27, 9, P.tentacleHi); s.px(25, 14, P.tentacleDk);
        // stray eyes budding on the body
        smallGlowEye(s, 12, 20, false);
        smallGlowEye(s, 18, 19, false);
        s.px(15, 22, P.glowDk); s.px(16, 22, P.glow);
        // CENTER head — big, tall neck, TWIN ANTENNAE, two glowing eyes
        s.rect(13, 8, 4, 5, P.alienChick);
        s.ellipse(15, 5, 4.5, 4, P.alienChick);
        s.shadeEllipse(15, 5, 4.5, 4, P.alienChickShade, 1, 0.3);
        s.px(13, 1, P.purple); s.px(13, 0, P.glowHi);   // left antenna, glowing tip
        s.px(17, 1, P.purple); s.px(17, 0, P.glowHi);   // right antenna, glowing tip
        s.rect(13, 6, 4, 2, P.alienBeak); s.px(14, 7, P.alienBeakShade);
        glowEye(s, 12, 4, false); glowEye(s, 16, 4, false);
        // LEFT head — small, low neck, beak points left, ONE eye
        s.rect(7, 12, 3, 3, P.alienChick);
        s.ellipse(6, 10, 3.2, 2.8, P.alienChick);
        s.shadeEllipse(6, 10, 3.2, 2.8, P.alienChickShade, 1, 0.35);
        s.px(2, 10, P.alienBeak); s.px(1, 10, P.alienBeak); s.px(2, 11, P.alienBeakShade);
        s.px(5, 7, P.purpleDk); s.px(5, 6, P.glow);     // bent antenna
        glowEye(s, 5, 9, false);
        // RIGHT head — tiny, high crooked neck, THREE stacked eyes
        s.rect(21, 8, 2, 6, P.alienChick); s.rect(22, 6, 2, 4, P.alienChick);
        s.ellipse(24, 4, 3, 2.6, P.alienChick);
        s.shadeEllipse(24, 4, 3, 2.6, P.alienChickShade, 1, 0.35);
        s.px(28, 4, P.alienBeak); s.px(28, 5, P.alienBeakShade);
        s.px(24, 1, P.purple); s.px(24, 0, P.glowHi);   // antenna, glowing tip
        smallGlowEye(s, 22, 3, false); smallGlowEye(s, 25, 3, false);
        s.px(24, 5, P.glow);
      } else if (species === 'sheep') {
        // ABDUCTEE WOOL TOTEM WORM — irradiated violet wool over deep
        // teal skin, antennae on the top face. Three wool blobs stacked
        // askew, a face on EVERY segment, SIX caterpillar legs, one
        // giant oversized horn
        // six stubby legs in a row
        for (let i = 0; i < 6; i++) {
          const lx = 5 + i * 4;
          s.line(lx, 24, lx, 27, P.alienFace); s.px(lx - 1, 27, P.alienFace);
        }
        // BOTTOM segment — widest blob, face on its right side
        woolCloud(s, 15, 21, 10, 4.5, P.alienWoolLight, P.alienWoolMid, P.alienWoolShade);
        s.ellipse(23, 20, 3.2, 2.8, P.alienFace);
        s.px(22, 18.5, P.alienFaceHi);
        glowEye(s, 22, 19.5, false);
        s.px(25, 21, P.pupil); // nose
        // MIDDLE segment — shoved left, one big lonely eye
        woolCloud(s, 11, 14, 7.5, 4, P.alienWoolLight, P.alienWoolMid, P.alienWoolShade);
        s.ellipse(6, 13, 2.8, 2.6, P.alienFace);
        s.rect(5, 12, 3, 2, P.glow); s.px(6, 12, P.glowHi); s.px(6, 13, P.pupil);
        // TOP segment — shoved right, the "real" two-eyed face, twin
        // antennae with glowing tips
        woolCloud(s, 18, 7, 6, 3.6, P.alienWoolLight, P.alienWoolMid, P.alienWoolShade);
        s.ellipse(19, 7, 3.4, 2.8, P.alienFace);
        s.px(17.5, 5.5, P.alienFaceHi);
        s.px(17, 2, P.purple); s.px(17, 1, P.glowHi);   // left antenna
        s.px(21, 2, P.purpleDk); s.px(21, 1, P.glow);   // right antenna
        smallGlowEye(s, 17, 6.5, false); smallGlowEye(s, 21, 6.5, false);
        s.px(19, 9, P.pupil); // mouth
        // GIANT oversized curled horn bursting from the top-left
        s.ellipse(10, 4, 3.6, 3.6, P.purple);
        s.ellipse(10, 4, 1.8, 1.8, P.purpleDk);
        s.px(8, 1, P.purpleHi); s.px(12, 6, P.purple);
        // tiny mismatched nub horn top-right
        s.px(24, 3, P.purple); s.px(25, 4, P.purpleDk);
        // stray eyes + glowing tufts buried in the wool
        s.px(15, 16, P.glow); s.px(16, 16, P.pupil);
        s.px(9, 22, P.glowDk); s.px(4, 17, P.glow);
        s.px(21, 12, P.glowHi);
      } else {
        // ABDUCTEE TWIN-HEAD STAMPEDE — spectral pale-teal hide with an
        // irradiated green patch, ice-blue horns, antennae with glowing
        // tips. TWO unequal heads, an eye-stalk sprouting between them,
        // SIX legs, twin tentacle tails, and eyes budding on the flank
        // six legs with hooves
        for (let i = 0; i < 6; i++) {
          const lx = 6 + i * 3.6;
          s.line(lx, 22, lx, 26, P.alienCowShade);
          s.rect(lx - 1, 26, 3, 1, P.alienHoof);
        }
        // long wide body
        s.ellipse(15, 18, 11, 5.5, P.alienCow);
        s.shadeEllipse(15, 18, 11, 5.5, P.alienCowShade, 1, 0.34);
        // patches: irradiated green left, one BIG purple blotch right
        s.ellipse(11, 17, 2.4, 1.8, P.glowDk); s.px(10, 16, P.glow);
        s.ellipse(20, 18, 3, 2.2, P.purple); s.px(19, 17, P.purpleHi);
        // eyes budding on the flank
        smallGlowEye(s, 14, 20, false);
        s.px(17, 21, P.glow); s.px(18, 21, P.pupil);
        // twin tentacle tails, curling apart
        s.line(4, 16, 1, 12, P.tentacle); s.px(1, 11, P.tentacleHi);
        s.line(5, 18, 2, 19, P.tentacleDk); s.px(1, 18, P.tentacle);
        // BIG head (left) — one huge up-swept horn, an antenna where the
        // other horn broke off
        s.rect(7, 9, 5, 6, P.alienCow);
        s.ellipse(9, 7, 5, 4.5, P.alienCow);
        s.shadeEllipse(9, 7, 5, 4.5, P.alienCowShade, 1, 0.3);
        s.rect(3, 2, 2, 4, P.alienHorn); s.rect(5, 1, 2, 3, P.alienHorn); s.px(4, 1, P.alienHornShade); // huge horn
        s.px(13, 3, P.purple); s.px(13, 2, P.glowHi); // antenna, glowing tip
        glowEye(s, 6, 6, false); glowEye(s, 10, 6, false);
        s.px(8, 4, P.glow); // third pinprick eye
        s.ellipse(9, 10, 3.4, 2, P.alienMuzzle);
        s.shadeEllipse(9, 10, 3.4, 2, P.alienMuzzleShade, 1, 0.5);
        s.px(8, 10, P.pupil); s.px(11, 10, P.pupil);
        // SMALL head (right) — half size, one tiny horn + one antenna
        s.rect(21, 11, 4, 4, P.alienCow);
        s.ellipse(23, 9, 3.4, 3, P.alienCow);
        s.shadeEllipse(23, 9, 3.4, 3, P.alienCowShade, 1, 0.35);
        s.px(20, 5, P.alienHorn); s.px(26, 5, P.purple); s.px(26, 4, P.glowHi);
        glowEye(s, 22, 8, false);
        s.ellipse(23, 11, 2, 1.4, P.alienMuzzle);
        s.px(22, 11, P.pupil); s.px(24, 11, P.pupil);
        // eye-stalk sprouting between the heads
        s.line(16, 10, 16, 4, P.tentacle); s.px(16, 5, P.tentacleDk);
        s.rect(15, 2, 3, 2, P.glow); s.px(16, 2, P.glowHi); s.px(16, 3, P.pupil);
      }
      s.outline();
    });
  }

  /**
   * Pixel UFO saucer. phase (0-2) animates the rim lights; aliens (capped
   * at 3 shown) puts collected passengers behind the glass dome.
   */
  function ufo(phase = 0, aliens = 0) {
    const shown = Math.min(aliens, 3);
    return PIXEL.sprite(`ufo:${phase}:${shown}`, 44, 26, s => {
      // glass dome
      s.ellipse(22, 10, 9, 7.5, '#9adcf0');
      s.shadeEllipse(22, 10, 9, 7.5, '#5aa8c8', 1, 0.35);
      s.ellipse(18, 6.5, 3.5, 2.5, '#d8f4fc');
      // collected aliens peeking through the dome
      if (shown >= 1) {
        s.ellipse(21, 9, 2.4, 2.2, P.glow);
        s.px(20, 9, P.pupil); s.px(22, 9, P.pupil);
      }
      if (shown >= 2) {
        s.ellipse(26, 10.5, 2, 1.8, P.glow);
        s.px(25, 10, P.pupil); s.px(27, 10, P.pupil);
      }
      if (shown >= 3) {
        s.ellipse(17, 11, 1.8, 1.6, P.glow);
        s.px(16, 11, P.pupil); s.px(18, 11, P.pupil);
      }
      // saucer disc
      s.ellipse(22, 16, 20, 6.5, '#b8c4cc');
      s.shadeEllipse(22, 16, 20, 6.5, '#7a8890', 1, 0.4);
      s.ellipse(14, 13.5, 6, 2, '#dce8ee');
      // dark underside
      s.ellipse(22, 19.5, 14, 3.2, '#5a6670');
      // rim lights chasing around the saucer
      for (let i = 0; i < 7; i++) {
        const lx = Math.round(7 + i * 5);
        const on = (i + phase) % 3 === 0;
        s.rect(lx, 16, 2, 2, on ? P.goldHi : P.goldDk);
      }
      // belly beam emitter
      s.rect(20, 21, 4, 2, P.glowDk);
      s.px(21, 21, P.glow);
      s.outline();
    });
  }

  // ============================================================
  //  PIGEON (reward-ad event, see js/pigeon.js)
  // ============================================================

  // pigeon palette: city-gray feathers with an iridescent neck
  const PG = {
    body: '#9aa4b2', shade: '#707a88', light: '#c6cfd8',
    wing: '#7d8794', wingHi: '#98a2b0',
    neck: '#5fae62', neck2: '#8a6ec0',
    beak: '#e8933c', beakDk: '#b96a24', foot: '#d1762e',
  };

  /**
   * Pixel pigeon, faces RIGHT, bottom anchored.
   * Frames: 'idle' | 'look' (head turned back) | 'flapUp' | 'flapDn'.
   */
  function pigeon(frame = 'idle', blink = false) {
    return PIXEL.sprite(`pigeon:${frame}:${blink ? 1 : 0}`, 22, 20, s => {
      const look = frame === 'look';
      const flapUp = frame === 'flapUp', flapDn = frame === 'flapDn';
      // feet
      s.line(9, 15, 9, 17, PG.foot); s.line(13, 15, 13, 17, PG.foot);
      s.px(8, 17, PG.foot); s.px(10, 17, PG.foot);
      s.px(12, 17, PG.foot); s.px(14, 17, PG.foot);
      // tail (points left)
      s.line(4, 10, 1, 8, PG.wing); s.line(4, 11, 1, 9, PG.shade);
      // body
      s.ellipse(10, 11, 6, 4.5, PG.body);
      s.shadeEllipse(10, 11, 6, 4.5, PG.shade, 1, 0.38);
      s.ellipse(8, 9, 2.5, 2, PG.light);
      // wing: folded, raised, or beating down
      if (flapUp) {
        s.ellipse(7, 5, 4.5, 2.2, PG.wing);
        s.ellipse(6, 4, 2.6, 1.4, PG.wingHi);
      } else if (flapDn) {
        s.ellipse(7, 14, 4.5, 2, PG.wing);
        s.px(4, 14, PG.wingHi);
      } else {
        s.ellipse(8, 11, 3.6, 2.6, PG.wing);
        s.px(6, 10, PG.wingHi); s.px(7, 10, PG.wingHi);
      }
      // head (turned back for the 'look' frame)
      const hx = look ? 6 : 15;
      s.ellipse(hx, 6, 3.4, 3.2, PG.body);
      s.ellipse(hx - 1, 4.5, 1.5, 1.2, PG.light);
      // iridescent neck feathers
      if (look) {
        s.px(8, 8, PG.neck); s.px(9, 9, PG.neck2); s.px(8, 9, PG.neck);
      } else {
        s.px(13, 8, PG.neck); s.px(14, 9, PG.neck2); s.px(13, 9, PG.neck);
      }
      // beak
      if (look) { s.rect(2, 6, 2, 1, PG.beak); s.px(3, 7, PG.beakDk); }
      else { s.rect(18, 6, 2, 1, PG.beak); s.px(18, 7, PG.beakDk); }
      // eye
      const ex = look ? 5 : 16;
      if (blink) s.px(ex, 5, PG.shade);
      else { s.px(ex, 5, P.pupil); s.px(ex - 1, 4, P.eyeWhite); }
      s.outline();
    });
  }

  // ============================================================
  //  TORNADO (reward-ad auto-merge event, see js/tornado.js)
  // ============================================================

  // tornado palette: pale storm-gray funnel with a dusty skirt
  const TN = {
    base: '#c8cdd4', hi: '#eef2f6', dk: '#98a1ac',
    dust: '#b09a72', dustDk: '#8a7350', leaf: '#5e9c31',
  };

  /**
   * Pixel tornado funnel, bottom anchored. Three spin frames: the
   * highlight streaks and debris flecks rotate around the cone.
   */
  function tornado(frame = 0) {
    return PIXEL.sprite(`tornado:${frame}`, 36, 42, s => {
      // stacked funnel bands, wide at the top, tapering to the ground
      const bands = [
        { y: 4, rx: 15 }, { y: 8, rx: 13.5 }, { y: 12, rx: 12 },
        { y: 16, rx: 10 }, { y: 20, rx: 8.5 }, { y: 24, rx: 7 },
        { y: 28, rx: 5.5 }, { y: 32, rx: 4 }, { y: 35, rx: 3 }, { y: 38, rx: 2 },
      ];
      bands.forEach((b, i) => {
        s.ellipse(18, b.y, b.rx, 2.4, TN.base);
        s.shadeEllipse(18, b.y, b.rx, 2.4, TN.dk, 1, 0.45);
        // spinning highlight streak: offset cycles with the frame
        const ph = (i + frame) % 3;
        const off = (ph - 1) * b.rx * 0.5;
        s.rect(18 + off - Math.max(1, b.rx * 0.3), b.y - 1, Math.max(2, b.rx * 0.6), 1, TN.hi);
      });
      // debris flecks whirling around the cone
      const specks = [[6, 6], [30, 10], [8, 18], [27, 22], [12, 28], [23, 31]];
      specks.forEach(([px, py], i) => {
        const on = (i + frame) % 3;
        if (on === 0) s.px(px, py, TN.leaf);
        else if (on === 1) s.px(px, py, TN.dust);
      });
      // dust skirt kicked up at the base
      s.ellipse(18, 39, 7, 1.8, TN.dust);
      s.shadeEllipse(18, 39, 7, 1.8, TN.dustDk, 1, 0.5);
      s.px(9 + frame, 38, TN.dust); s.px(27 - frame, 39, TN.dust);
      s.outline();
    });
  }

  // ============================================================
  //  PROPS
  // ============================================================

  function tree(variant = 0) {
    const dark = variant === 1;
    const L = dark ? P.leafDark : P.leaf, LH = dark ? P.leafDarkHi : P.leafHi, LD = dark ? P.leafDarkDk : P.leafDk;
    return PIXEL.sprite(`tree:${variant}`, 30, 36, s => {
      s.rect(13, 24, 4, 10, P.woodDk);
      s.px(13, 26, P.wood); s.px(13, 29, P.wood);
      s.ellipse(15, 14, 12, 11, L);
      s.ellipse(9, 18, 6, 5, L);
      s.ellipse(21, 18, 6, 5, L);
      s.shadeEllipse(15, 15, 12, 11, LD, 1, 0.3);
      s.ellipse(10, 9, 5, 4, LH);
      s.px(19, 12, LH); s.px(20, 13, LH); s.px(8, 16, LH);
      s.outline();
    });
  }

  function bush(variant = 0) {
    const dark = variant === 1;
    const L = dark ? P.leafDark : P.leaf, LH = dark ? P.leafDarkHi : P.leafHi, LD = dark ? P.leafDarkDk : P.leafDk;
    return PIXEL.sprite(`bush:${variant}`, 18, 12, s => {
      s.ellipse(8, 7, 7, 4, L);
      s.ellipse(5, 5, 3.5, 3, L);
      s.ellipse(12, 5, 3.5, 3, L);
      s.shadeEllipse(8, 7, 7, 4, LD, 1, 0.4);
      s.ellipse(5, 4, 2, 1.5, LH);
      if (variant === 2) { s.px(5, 6, '#e46a8a'); s.px(11, 4, '#e46a8a'); s.px(8, 7, '#f0a0b8'); }
      s.outline();
    });
  }

  function flower(variant = 0) {
    const cols = [['#e8e6e0', '#f4c437'], ['#e46a8a', '#f4c437'], ['#8a6ec0', '#f4e0a0']][variant % 3];
    return PIXEL.sprite(`flower:${variant}`, 8, 10, s => {
      s.line(4, 5, 4, 9, P.leafDk);
      s.px(2, 7, P.leaf); s.px(6, 8, P.leaf);
      s.px(3, 2, cols[0]); s.px(5, 2, cols[0]); s.px(3, 4, cols[0]); s.px(5, 4, cols[0]);
      s.px(4, 1, cols[0]); s.px(4, 5, cols[0]); s.px(2, 3, cols[0]); s.px(6, 3, cols[0]);
      s.px(4, 3, cols[1]);
    });
  }

  function rock(variant = 0) {
    const w = 12 + variant * 4;
    return PIXEL.sprite(`rock:${variant}`, w + 2, 10, s => {
      s.ellipse(w / 2, 6, w / 2 - 1, 3.2, P.stone);
      s.shadeEllipse(w / 2, 6, w / 2 - 1, 3.2, P.stoneDk, 1, 0.45);
      s.ellipse(w / 2 - 2, 4.5, 2, 1.4, P.stoneHi);
      s.outline();
    });
  }

  function barrel() {
    return PIXEL.sprite('barrel', 14, 16, s => {
      s.rect(2, 2, 10, 12, P.wood);
      s.ellipse(7, 2.5, 5, 1.6, P.woodHi);
      s.rect(2, 4, 10, 1, P.woodDkr);
      s.rect(2, 10, 10, 1, P.woodDkr);
      s.rect(3, 5, 2, 9, P.woodHi);
      s.rect(9, 5, 2, 9, P.woodDk);
      s.outline();
    });
  }

  function crate() {
    return PIXEL.sprite('crate', 14, 14, s => {
      s.rect(1, 1, 12, 12, P.wood);
      s.rect(1, 1, 12, 2, P.woodHi);
      s.rect(1, 11, 12, 2, P.woodDk);
      s.line(1, 1, 12, 12, P.woodDk);
      s.line(12, 1, 1, 12, P.woodDk);
      s.rect(1, 1, 1, 12, P.woodHi);
      s.outline();
    });
  }

  function haystack() {
    return PIXEL.sprite('hay', 20, 16, s => {
      s.ellipse(10, 11, 9, 4.5, P.hay);
      s.ellipse(10, 7, 6.5, 4, P.hay);
      s.ellipse(10, 3.5, 3.5, 2.5, P.hay);
      s.shadeEllipse(10, 11, 9, 4.5, P.hayDk, 1, 0.4);
      s.ellipse(7, 5, 2.5, 1.6, P.hayHi);
      s.px(4, 9, P.hayDk); s.px(14, 7, P.hayDk); s.px(9, 12, P.hayDk);
      s.outline();
    });
  }

  function sign(wide = false) {
    const w = wide ? 30 : 18;
    return PIXEL.sprite(`sign:${wide}`, w, 18, s => {
      s.rect(w / 2 - 1, 8, 3, 9, P.woodDk);
      s.rect(1, 2, w - 2, 8, P.wood);
      s.rect(1, 2, w - 2, 2, P.woodHi);
      s.rect(1, 8, w - 2, 2, P.woodDk);
      s.outline();
    });
  }

  function fenceH(len = 24) {
    return PIXEL.sprite(`fenceH:${len}`, len, 14, s => {
      for (let x = 0; x < len; x += 12) {
        s.rect(x + 1, 2, 3, 11, P.wood);
        s.rect(x + 1, 2, 1, 11, P.woodHi);
        s.rect(x + 3, 2, 1, 11, P.woodDk);
        s.rect(x + 1, 1, 3, 1, P.woodHi);
      }
      s.rect(0, 4, len, 2, P.woodHi);
      s.rect(0, 5, len, 1, P.wood);
      s.rect(0, 9, len, 2, P.wood);
      s.rect(0, 10, len, 1, P.woodDk);
      s.outline();
    });
  }

  // ============================================================
  //  BUILDINGS
  // ============================================================

  function farmhouse() {
    return PIXEL.sprite('farmhouse', 34, 30, s => {
      // walls
      s.rect(5, 14, 24, 14, '#e8d8b8');
      s.rect(5, 14, 24, 2, '#f4e8cc');
      // roof
      for (let i = 0; i < 9; i++) {
        s.rect(3 + i, 12 - i, 28 - i * 2, 1, i > 6 ? P.redHi : P.red);
      }
      s.rect(2, 12, 30, 2, P.redDk);
      // chimney
      s.rect(24, 3, 4, 7, P.stone);
      s.px(24, 3, P.stoneHi);
      // door
      s.rect(14, 19, 6, 9, P.woodDk);
      s.rect(15, 20, 4, 8, P.wood);
      s.px(18, 24, P.gold);
      // windows
      s.rect(8, 18, 4, 4, '#7ec8e0'); s.rect(9, 18, 1, 4, '#b8e4f0'); s.rect(8, 19, 4, 1, P.woodDk);
      s.rect(23, 18, 4, 4, '#7ec8e0'); s.rect(24, 18, 1, 4, '#b8e4f0'); s.rect(23, 19, 4, 1, P.woodDk);
      s.outline();
    });
  }

  /** Chicken coop — small wooden hut on stilts with hay roof and ramp. */
  function coop() {
    return PIXEL.sprite('coop', 32, 28, s => {
      // stilts
      s.rect(6, 22, 2, 5, P.woodDk); s.rect(24, 22, 2, 5, P.woodDk);
      // walls (vertical planks)
      s.rect(4, 10, 24, 13, P.wood);
      s.rect(4, 10, 24, 2, P.woodHi);
      for (let x = 8; x < 27; x += 4) s.rect(x, 12, 1, 11, P.woodDk);
      // hay roof
      for (let i = 0; i < 6; i++) s.rect(2 + i * 2, 9 - i, 28 - i * 4, 1, i > 3 ? P.hayHi : P.hay);
      s.rect(1, 9, 30, 2, P.hayDk);
      s.px(5, 8, P.hayHi); s.px(24, 7, P.hayDk);
      // round entry hole
      s.ellipse(16, 17, 4, 4.2, P.woodDkr);
      s.ellipse(16, 17, 2.8, 3, '#1c1208');
      // little window
      s.rect(23, 14, 3, 3, '#7ec8e0'); s.px(23, 14, '#b8e4f0');
      // ramp with rungs
      for (let i = 0; i < 5; i++) s.rect(11 - i, 22 + i, 7, 1, i % 2 ? P.wood : P.woodHi);
      s.outline();
    });
  }

  /** Nest with eggs (chicken farm decoration). */
  function nest() {
    return PIXEL.sprite('nest', 16, 10, s => {
      s.ellipse(8, 6, 7, 3.2, P.hay);
      s.shadeEllipse(8, 6, 7, 3.2, P.hayDk, 1, 0.45);
      s.ellipse(8, 5.5, 4.5, 2, P.hayDk);
      s.px(2, 5, P.hayHi); s.px(13, 4, P.hayHi);
      // eggs
      s.ellipse(6, 4.5, 1.8, 2, '#f7f2e6'); s.px(5, 3, '#ffffff');
      s.ellipse(10, 4.5, 1.8, 2, '#f0e8d4'); s.px(9, 3, '#fbf6ea');
      s.outline();
    });
  }

  /** Sheep cottage — timber-framed cozy house with wool decorations. */
  function cottage() {
    return PIXEL.sprite('cottage', 34, 32, s => {
      // walls
      s.rect(5, 16, 24, 14, '#efe6d2');
      s.rect(5, 16, 24, 2, '#f8f2e2');
      // timber frame
      s.rect(5, 16, 1, 14, P.woodDk); s.rect(28, 16, 1, 14, P.woodDk);
      s.rect(5, 23, 24, 1, P.woodDk);
      s.px(9, 24, P.woodDk); s.px(9, 25, P.woodDk);
      // steep blue roof
      for (let i = 0; i < 9; i++) s.rect(4 + i, 14 - i, 26 - i * 2, 1, i > 6 ? P.blueRoofHi : P.blueRoof);
      s.rect(3, 14, 28, 2, P.blueRoofDk);
      // chimney
      s.rect(23, 5, 4, 6, P.stone); s.px(23, 5, P.stoneHi); s.px(26, 10, P.stoneDk);
      // rounded door
      s.ellipse(17, 23, 3, 2, P.woodDk);
      s.rect(14, 23, 6, 7, P.woodDk);
      s.rect(15, 23, 4, 7, P.wood); s.ellipse(17, 23, 2, 1.4, P.wood);
      s.px(19, 26, P.gold);
      // round window
      s.ellipse(10, 19.5, 2.2, 2.2, '#7ec8e0'); s.px(9, 18, '#b8e4f0');
      // wool garland under the eave + wool wreath
      s.ellipse(8, 16.5, 1.6, 1.3, P.woolLight);
      s.ellipse(13, 17, 1.4, 1.2, P.woolMid);
      s.ellipse(21, 17, 1.4, 1.2, P.woolMid);
      s.ellipse(26, 16.5, 1.6, 1.3, P.woolLight);
      s.ellipse(24, 26, 2.2, 2.2, P.woolLight);
      s.ellipse(24, 26, 1, 1, '#efe6d2');
      s.outline();
    });
  }

  /** Windmill tower (blades drawn separately so they can spin). Hub at (9,6). */
  function windmillTower() {
    return PIXEL.sprite('windmillTower', 18, 30, s => {
      // tapered whitewashed body
      for (let y = 0; y < 21; y++) {
        const w = 8 + Math.round(y * 4 / 21);
        const x = Math.round(9 - w / 2);
        s.rect(x, 8 + y, w, 1, y % 6 === 5 ? '#d8ccb4' : '#e8ddc8');
        s.px(x + w - 1, 8 + y, '#c0b49c');
      }
      // cap
      s.ellipse(9, 7, 5, 3, P.blueRoofDk);
      s.ellipse(9, 6, 4, 2.4, P.blueRoof);
      s.px(7, 5, P.blueRoofHi);
      // window + door
      s.rect(8, 15, 3, 3, '#7ec8e0'); s.px(8, 15, '#b8e4f0');
      s.rect(7, 24, 4, 5, P.woodDk); s.rect(8, 25, 2, 4, P.wood);
      s.outline();
    });
  }

  /** Windmill blade cross, 4 rotation frames (frame 0-3). */
  function windmillBlades(frame = 0) {
    return PIXEL.sprite(`wmBlades:${frame}`, 28, 28, s => {
      const c = 14, a0 = frame * Math.PI / 8;
      for (let k = 0; k < 4; k++) {
        const a = a0 + k * Math.PI / 2;
        const dx = Math.cos(a), dy = Math.sin(a);
        s.line(c, c, c + dx * 12, c + dy * 12, P.wood);
        // canvas paddle alongside the outer half of each arm
        s.line(c + dx * 5 - dy * 2, c + dy * 5 + dx * 2,
               c + dx * 11 - dy * 2, c + dy * 11 + dx * 2, '#e8ddc8');
        s.line(c + dx * 6 - dy, c + dy * 6 + dx,
               c + dx * 11 - dy, c + dy * 11 + dx, '#f4ecd8');
      }
      s.ellipse(c, c, 2, 2, P.woodDk); s.px(c, c, P.woodHi);
      s.outline();
    });
  }

  /** Grain silo (cow farm). */
  function silo() {
    return PIXEL.sprite('silo', 16, 34, s => {
      s.rect(3, 8, 10, 24, '#d8d2c8');
      s.rect(3, 8, 3, 24, '#e8e4dc');
      s.rect(11, 8, 2, 24, '#a8a298');
      for (let y = 13; y < 32; y += 6) s.rect(3, y, 10, 1, '#a8a298');
      // red dome
      s.ellipse(8, 7, 5.5, 4, P.red);
      s.shadeEllipse(8, 7, 5.5, 4, P.redDk, 1, 0.4);
      s.px(5, 4, P.redHi); s.px(6, 4, P.redHi);
      // hatch
      s.rect(6, 17, 4, 5, '#8a95a0'); s.px(6, 17, '#b8c0c6');
      s.outline();
    });
  }

  /** Milk can (cow farm decoration). */
  function milkCan() {
    return PIXEL.sprite('milkCan', 10, 12, s => {
      s.rect(2, 4, 6, 7, '#c8d0d4');
      s.rect(2, 4, 2, 7, '#e4eaec');
      s.rect(6, 4, 2, 7, '#98a2a8');
      s.ellipse(5, 3.5, 3, 1.4, '#98a2a8');
      s.rect(4, 1, 2, 2, '#c8d0d4');
      s.rect(2, 7, 6, 1, '#8a95a0');
      s.outline();
    });
  }

  /** Rolled wool bale (sheep farm decoration). */
  function woolBale() {
    return PIXEL.sprite('woolBale', 14, 11, s => {
      s.ellipse(7, 6, 6, 4, P.woolLight);
      s.shadeEllipse(7, 6, 6, 4, P.woolShade, 1, 0.4);
      s.ellipse(7, 6, 3, 2, P.woolMid);
      s.ellipse(7, 6, 1.4, 1, P.woolLight);
      s.px(4, 3, '#ffffff'); s.px(3, 5, '#ffffff');
      s.outline();
    });
  }

  function barn() {
    return PIXEL.sprite('barn', 36, 32, s => {
      s.rect(4, 14, 28, 16, P.red);
      s.rect(4, 14, 28, 2, P.redHi);
      s.rect(4, 28, 28, 2, P.redDk);
      // gambrel roof
      for (let i = 0; i < 6; i++) s.rect(6 + i, 12 - i, 24 - i * 2, 1, P.woodDkr);
      s.rect(8, 5, 20, 3, P.woodDk);
      s.rect(4, 12, 28, 2, P.woodDkr);
      // hay door
      s.rect(15, 8, 6, 5, P.woodDk);
      s.rect(16, 9, 4, 3, P.hay);
      // big door + cross braces
      s.rect(13, 20, 10, 10, P.woodDk);
      s.rect(14, 21, 8, 9, P.wood);
      s.line(14, 21, 21, 29, P.woodDk);
      s.line(21, 21, 14, 29, P.woodDk);
      // white trim
      s.rect(6, 16, 2, 12, '#e8ddc8'); s.rect(28, 16, 2, 12, '#e8ddc8');
      s.outline();
    });
  }

  function shed() {
    return PIXEL.sprite('shed', 30, 26, s => {
      s.rect(4, 12, 22, 12, '#c8b088');
      s.rect(4, 12, 22, 2, '#dcc8a0');
      for (let i = 0; i < 7; i++) s.rect(2 + i, 11 - i, 26 - i * 2, 1, P.blueRoof);
      s.rect(2, 11, 26, 2, P.blueRoofDk);
      s.rect(6, 5, 8, 1, P.blueRoofHi);
      s.rect(12, 16, 6, 8, P.woodDk);
      s.rect(13, 17, 4, 7, P.wood);
      s.rect(6, 16, 4, 4, '#7ec8e0'); s.rect(6, 17, 4, 1, P.woodDk);
      s.outline();
    });
  }

  // ============================================================
  //  UI / MAP ICONS
  // ============================================================

  function mapPin() {
    return PIXEL.sprite('mapPin', 16, 20, s => {
      s.ellipse(8, 7, 6, 6, P.red);
      s.rect(5, 11, 6, 3, P.red);
      s.px(6, 14, P.red); s.px(7, 15, P.redDk); s.px(8, 16, P.redDk);
      s.px(7, 14, P.red); s.px(8, 14, P.redDk); s.px(9, 14, P.redDk);
      s.px(8, 15, P.redDk);
      s.shadeEllipse(8, 7, 6, 6, P.redDk, 1, 0.4);
      s.ellipse(6, 5, 2, 1.6, P.redHi);
      s.ellipse(8, 7, 2.4, 2.4, '#f4ece0');
      s.outline();
    });
  }

  function lock() {
    return PIXEL.sprite('lock', 16, 18, s => {
      // shackle
      s.rect(4, 2, 8, 2, P.stoneHi);
      s.rect(4, 2, 2, 6, P.stoneHi);
      s.rect(10, 2, 2, 6, P.stoneHi);
      s.px(5, 3, '#d8d2c8'); s.px(10, 3, P.stoneDk);
      // body
      s.rect(2, 7, 12, 9, '#b8ad9c');
      s.rect(2, 7, 12, 2, '#cec4b4');
      s.rect(2, 14, 12, 2, '#8c8272');
      // keyhole
      s.rect(7, 10, 2, 2, P.outline);
      s.rect(7, 12, 2, 2, P.outline);
      s.outline();
    });
  }

  function gear() {
    return PIXEL.sprite('gear', 16, 16, s => {
      const c = 8;
      for (let a = 0; a < 8; a++) {
        const t = a / 8 * Math.PI * 2;
        s.rect(Math.round(c + Math.cos(t) * 6) - 1, Math.round(c + Math.sin(t) * 6) - 1, 3, 3, '#d8d2c8');
      }
      s.ellipse(c, c, 5, 5, '#d8d2c8');
      s.shadeEllipse(c, c, 5, 5, '#a09888', 1, 0.4);
      s.ellipse(c, c, 2, 2, '#6a6458');
      s.outline();
    });
  }

  function arrowUp() {
    return PIXEL.sprite('arrowUp', 12, 12, s => {
      s.rect(4, 5, 4, 6, '#f4ece0');
      for (let i = 0; i < 4; i++) s.rect(1 + i, 5 - i, 10 - i * 2, 1, '#f4ece0');
      s.rect(4, 9, 4, 2, '#d0c4ac');
      s.outline();
    });
  }

  function xIcon() {
    return PIXEL.sprite('xIcon', 12, 12, s => {
      for (let i = 0; i < 9; i++) {
        s.rect(1 + i, 1 + i, 2, 2, '#f4ece0');
        s.rect(9 - i, 1 + i, 2, 2, '#f4ece0');
      }
      s.outline();
    });
  }

  /** Rewarded-video icon: little screen with a play triangle. */
  function adPlay() {
    return PIXEL.sprite('adPlay', 16, 12, s => {
      s.rect(1, 1, 14, 10, '#f4ece0');   // screen frame
      s.rect(2, 2, 12, 8, '#4a4440');    // dark screen
      for (let i = 0; i < 3; i++) s.rect(6 + i, 3 + i, 1, 6 - i * 2, '#7dbb4a');
      s.outline();
    });
  }

  return {
    animal, ANIMAL_SIZES, poop, coin, mutant2, ufo, pigeon, tornado,
    tree, bush, flower, rock, barrel, crate, haystack, sign, fenceH,
    farmhouse, barn, shed,
    coop, nest, cottage, windmillTower, windmillBlades, silo, milkCan, woolBale,
    mapPin, lock, gear, arrowUp, xIcon, adPlay,
    P,
  };
})();
