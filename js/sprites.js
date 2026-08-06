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
    // mutant (stage 4) accents
    glow: '#7de87a', glowHi: '#c4ffb8', glowDk: '#3f9c48',
    tentacle: '#9a6ec0', tentacleHi: '#c09ae0', tentacleDk: '#6a4a90',
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

  // ----------------- CHICKEN -----------------
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
    } else if (stage === 2) {
      // ELDER 30x28 — plump, purple crest, THREE eyes, twin wattles
      const hy = peck ? 3 : 0;
      s.line(12, 23, 12, 27, P.leg); s.line(18 + (walk ? 1 : 0), 23, 18 + (walk ? 1 : 0), 27, P.leg);
      s.rect(11, 27, 3, 1, P.leg); s.rect(17 + (walk ? 1 : 0), 27, 3, 1, P.leg);
      // tail plume
      s.ellipse(5, 12, 4, 5, P.henShade);
      s.ellipse(4, 9, 2.5, 3, P.purple);
      s.ellipse(4, 8, 1.5, 1.8, P.purpleHi);
      // body
      s.ellipse(14, 17, 9, 8, P.henBody);
      s.shadeEllipse(14, 17, 9, 8, P.henShade, 1, 0.36);
      // head (big)
      s.ellipse(21, 8 + hy, 6, 6, P.henBody);
      s.ellipse(18.5, 5.5 + hy, 2.5, 2, P.henLight);
      s.rect(17, 12 + hy, 8, 5, P.henBody);
      // wing
      s.ellipse(12, 18, 5, 4, P.henShade);
      s.ellipse(12, 17, 4, 3, P.henBody);
      // purple mutant crest
      s.px(18, 1 + hy, P.purple); s.px(20, 0 + hy, P.purple); s.px(22, 1 + hy, P.purple);
      s.rect(18, 2 + hy, 6, 2, P.purple);
      s.px(19, 2 + hy, P.purpleHi); s.px(21, 2 + hy, P.purpleHi);
      s.rect(19, 4 + hy, 4, 1, P.purpleDk);
      // beak + twin wattles
      s.rect(26, 8 + hy, 3, 2, P.beak); s.rect(26, 10 + hy, 2, 1, P.beakShade);
      s.px(24, 12 + hy, P.comb); s.px(24, 13 + hy, P.combShade);
      s.px(26, 12 + hy, P.comb); s.px(26, 13 + hy, P.combShade);
      // THREE eyes
      eye(s, 22, 6 + hy, blink);
      eye(s, 18, 6 + hy, blink);
      smallEye(s, 21, 10 + hy, blink);
    } else {
      // MUTANT 36x34 — TWO heads, THREE legs, glowing eyes, tentacle tail
      const hy = peck ? 3 : 0;
      // three legs
      s.line(12, 29, 12, 33, P.leg); s.line(18 + (walk ? 1 : 0), 29, 18 + (walk ? 1 : 0), 33, P.leg);
      s.line(24, 29, 24, 33, P.leg);
      s.rect(11, 33, 3, 1, P.leg); s.rect(17 + (walk ? 1 : 0), 33, 3, 1, P.leg); s.rect(23, 33, 3, 1, P.leg);
      // tentacle tail — three curling purple stalks
      s.line(7, 20, 4, 14, P.tentacle); s.line(4, 14, 5, 10, P.tentacle);
      s.px(5, 9, P.tentacleHi); s.px(4, 13, P.tentacleDk);
      s.line(8, 18, 3, 17, P.tentacle); s.px(2, 16, P.tentacleHi);
      s.line(8, 22, 4, 22, P.tentacleDk); s.px(3, 21, P.tentacle);
      // plump body
      s.ellipse(17, 22, 10, 9, P.henBody);
      s.shadeEllipse(17, 22, 10, 9, P.henShade, 1, 0.34);
      // wing
      s.ellipse(14, 23, 5, 4, P.henShade);
      s.ellipse(14, 22, 4, 3, P.henBody);
      // glowing chest blotch
      s.ellipse(20, 26, 2.4, 1.8, P.glowDk);
      s.px(20, 25, P.glow);
      // SECOND (rear) head — small, faces backwards
      s.ellipse(9, 10, 4, 4, P.henBody);
      s.ellipse(8, 8.5, 1.6, 1.4, P.henLight);
      s.rect(8, 13, 5, 4, P.henBody);
      s.px(4, 10, P.beak); s.px(3, 10, P.beak); s.px(4, 11, P.beakShade); // beak points left
      s.px(8, 4, P.purple); s.px(10, 3, P.purple); s.rect(8, 5, 4, 1, P.purpleDk);
      glowEye(s, 7, 8, blink);
      // MAIN head (big)
      s.ellipse(25, 9 + hy, 6.5, 6, P.henBody);
      s.ellipse(22.5, 6 + hy, 2.5, 2, P.henLight);
      s.rect(20, 13 + hy, 9, 6, P.henBody);
      // tall purple crest
      s.px(22, 1 + hy, P.purple); s.px(24, 0 + hy, P.purple); s.px(26, 1 + hy, P.purple); s.px(28, 2 + hy, P.purple);
      s.rect(22, 2 + hy, 7, 2, P.purple);
      s.px(23, 2 + hy, P.purpleHi); s.px(25, 2 + hy, P.purpleHi); s.px(27, 3 + hy, P.purpleHi);
      s.rect(23, 4 + hy, 5, 1, P.purpleDk);
      // big beak + twin wattles
      s.rect(31, 9 + hy, 3, 2, P.beak); s.rect(31, 11 + hy, 2, 1, P.beakShade);
      s.px(29, 13 + hy, P.comb); s.px(29, 14 + hy, P.combShade);
      s.px(31, 13 + hy, P.comb); s.px(31, 14 + hy, P.combShade);
      // THREE glowing eyes
      glowEye(s, 26, 7 + hy, blink);
      glowEye(s, 22, 7 + hy, blink);
      smallGlowEye(s, 24, 11 + hy, blink);
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

  const ANIMAL_SIZES = {
    chicken: [[18, 16], [24, 22], [30, 28], [36, 34]],
    sheep:   [[18, 16], [24, 20], [30, 26], [36, 32]],
    cow:     [[18, 16], [26, 22], [32, 28], [40, 34]],
  };
  const DRAWERS = { chicken: drawChicken, sheep: drawSheep, cow: drawCow };

  /** Get animal sprite canvas: species, stage 0-3, frame, blink. */
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

  return {
    animal, ANIMAL_SIZES, poop, coin,
    tree, bush, flower, rock, barrel, crate, haystack, sign, fenceH,
    farmhouse, barn, shed,
    mapPin, lock, gear, arrowUp, xIcon,
    P,
  };
})();
