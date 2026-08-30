/**
 * SaveManager — persists progress to localStorage and autosaves.
 */
const SaveManager = (() => {
  let data = null;

  // Chains are per species and each has its own length (Farm 1's chicken
  // chain is the long one), so every sized array is measured per farm.
  const STAGE_COUNT = species => CONFIG.stageCount(species);
  const UPGRADE_SLOTS = farmId => CONFIG.stageCount(CONFIG.FARMS[farmId].species);

  function defaults() {
    return {
      coins: 0,
      unlocked: [true, false, false],
      currentFarm: 0,
      settings: { music: true, sfx: true },
      // per-farm upgrade levels: { spawn, stages:[one level per evolution stage] }
      upgrades: CONFIG.FARMS.map(f => ({ spawn: 0, stages: CONFIG.stages(f.species).map(() => 0), et: 0 })),
      // per-farm animal snapshot: [{stage}...]
      animals: [[], [], []],
      // discovery collection: species -> [bool per stage], permanent once true
      discovered: discoveredDefaults(),
      // per-farm: upgrade keys ('spawn' | stage index | 'et') whose row has
      // already animated into the upgrade panel, so each discovery plays its
      // entry animation exactly once (see Upgrades.takeUnrevealed)
      upgradesRevealed: CONFIG.FARMS.map(() => []),
      // per-farm: has the first-merge tutorial been completed?
      tutorialDone: CONFIG.FARMS.map(() => false),
      // one-time: has the first-upgrade tutorial been completed?
      upgradeTutorialDone: false,
      // per-farm UFO alien-collection layer: each farm unlocks its own UFO
      // with the first Mutant+Mutant merge on that farm
      ufo: CONFIG.FARMS.map(() => ({ landed: false, aliens: 0, pending: 0 })),
      // per-farm pigeon reward-ad event: remaining perch time, so a pigeon
      // left on a farm is still there when the player comes back to it
      pigeon: CONFIG.FARMS.map(() => ({ remaining: 0 })),
      // per-farm tornado auto-merge reward-ad event: remaining availability
      // window of an offer already on screen
      tornado: CONFIG.FARMS.map(() => ({ remaining: 0 })),
      // reward-event director (see js/events.js): lifetime active play (the
      // new-game grace), the appearance log, and per-feature appearance
      // timestamps driving the rolling frequency cap. Player-level, not
      // per-farm: the quota follows the player across their farms.
      events: eventsDefault(),
      // per-farm parachute surprise box: cooldown remaining, whether a crate
      // is currently resting in the pen (it persists until tapped), the
      // stage rolled inside it, and a granted animal still waiting for a
      // free slot (-1 = none)
      crate: CONFIG.FARMS.map(() => crateDefault()),
      // per-farm latch: this farm's whole chain has been discovered, which is
      // what switches the surprise box on. Latched once and kept, so the
      // feature never turns itself back off (see js/crate.js `unlocked`).
      crateUnlocked: CONFIG.FARMS.map(() => false),
      // per-farm background production: last reconcile timestamp (ms epoch),
      // uncollected coin balance, and the carried spawn-timer remainder
      idle: CONFIG.FARMS.map(() => ({ last: 0, pending: 0, carry: 0 })),
      // per-farm step-by-step build state (only meaningful for farms with a
      // CONFIG.CONSTRUCTION entry): land bought, house built, fence tier
      construction: CONFIG.FARMS.map(() => ({ land: false, house: false, fence: 0 })),
      // one-time flag: upgradesRevealed has been back-filled from an older
      // save's discoveries (see migrate) — a new save needs no back-fill
      revealSeeded: true,
      firstRun: true,
    };
  }

  /** Frequency-limit slot for one reward event (timestamps in ms epoch). */
  function eventSlot() { return { shown: [], last: 0, extra: 0 }; }

  function eventsDefault() {
    return { play: 0, log: [], pigeon: eventSlot(), tornado: eventSlot() };
  }

  function crateDefault() {
    return { next: CONFIG.CRATE.COOLDOWN, active: 0, stage: -1, pending: -1 };
  }

  function discoveredDefaults() {
    const d = {};
    for (const f of CONFIG.FARMS) d[f.species] = CONFIG.stages(f.species).map(() => false);
    return d;
  }

  /** Bring older saves up to the current schema (extra stages, discovery data). */
  function migrate(d) {
    // a chain that has grown (Farm 1 went from four stages to six) simply
    // gains fresh level-0 slots; the old levels stay on the stages they were
    // bought for, so nothing a player paid for is lost or shifted
    d.upgrades.forEach((u, farmId) => {
      while (u.stages.length < UPGRADE_SLOTS(farmId)) u.stages.push(0);
      if (u.et === undefined) u.et = 0;
    });
    if (!d.discovered) d.discovered = discoveredDefaults();
    if (!d.ufo) d.ufo = CONFIG.FARMS.map(() => ({ landed: false, aliens: 0, pending: 0 }));
    // old saves had one global UFO: it becomes Farm 1's UFO, others start locked
    if (!Array.isArray(d.ufo)) {
      const legacy = d.ufo;
      d.ufo = CONFIG.FARMS.map((f, i) => i === 0
        ? { landed: !!legacy.landed, aliens: legacy.aliens || 0, pending: legacy.pending || 0 }
        : { landed: false, aliens: 0, pending: 0 });
    }
    while (d.ufo.length < CONFIG.FARMS.length) d.ufo.push({ landed: false, aliens: 0, pending: 0 });
    // the old `next` countdown on these slots is obsolete (js/events.js owns
    // timing now) — an older save simply carries a field nothing reads
    if (!d.pigeon) d.pigeon = CONFIG.FARMS.map(() => ({ remaining: 0 }));
    while (d.pigeon.length < CONFIG.FARMS.length) d.pigeon.push({ remaining: 0 });
    if (!d.tornado) d.tornado = CONFIG.FARMS.map(() => ({ remaining: 0 }));
    while (d.tornado.length < CONFIG.FARMS.length) d.tornado.push({ remaining: 0 });
    // reward-event director state, back-filled slot by slot so a save from
    // before any part of it existed starts with a clean, complete record
    if (!d.events) d.events = eventsDefault();
    if (typeof d.events.play !== 'number') d.events.play = 0;
    if (!Array.isArray(d.events.log)) d.events.log = [];
    for (const f of ['pigeon', 'tornado']) {
      const s = d.events[f] || (d.events[f] = eventSlot());
      if (!Array.isArray(s.shown)) s.shown = [];
      if (typeof s.last !== 'number') s.last = 0;
      if (typeof s.extra !== 'number') s.extra = 0;
    }
    if (!d.crate) d.crate = CONFIG.FARMS.map(() => crateDefault());
    while (d.crate.length < CONFIG.FARMS.length) d.crate.push(crateDefault());
    if (!d.crateUnlocked) d.crateUnlocked = CONFIG.FARMS.map(() => false);
    while (d.crateUnlocked.length < CONFIG.FARMS.length) d.crateUnlocked.push(false);
    // a crate rolled before the pool rule existed (or on a chain that has
    // since shrunk) is re-rolled on tap; clamp the stored index defensively
    for (const f of CONFIG.FARMS) {
      const c = d.crate[f.id];
      if (c.pending !== undefined && c.pending >= STAGE_COUNT(f.species)) c.pending = -1;
      if (c.stage !== undefined && c.stage >= STAGE_COUNT(f.species)) c.stage = -1;
      if (c.pending === undefined) c.pending = -1;
    }
    if (!d.idle) d.idle = CONFIG.FARMS.map(() => ({ last: 0, pending: 0, carry: 0 }));
    while (d.idle.length < CONFIG.FARMS.length) d.idle.push({ last: 0, pending: 0, carry: 0 });
    if (!d.construction) d.construction = CONFIG.FARMS.map(() => ({ land: false, house: false, fence: 0 }));
    while (d.construction.length < CONFIG.FARMS.length) d.construction.push({ land: false, house: false, fence: 0 });
    // saves from before the construction system: a construction farm that is
    // already unlocked keeps working as a finished farm (land + house owned,
    // fence at the top tier so its pen still fits every animal the player has)
    for (const f of CONFIG.FARMS) {
      const p = (CONFIG.CONSTRUCTION || {})[f.id];
      const c = d.construction[f.id];
      if (!p) continue;
      if (c.house === undefined) c.house = c.fence >= 1;
      if (d.unlocked[f.id] && !c.land) {
        c.land = true;
        c.house = true;
        c.fence = p.FENCE_LEVELS.length;
      }
    }
    // players from before the tutorial existed (or with animals already) skip it
    if (!d.tutorialDone) d.tutorialDone = CONFIG.FARMS.map(f => (d.animals[f.id] || []).length > 0);
    // players who already bought an upgrade skip the first-upgrade tutorial
    if (d.upgradeTutorialDone === undefined) {
      d.upgradeTutorialDone = d.upgrades.some(u => u.spawn > 0 || u.stages.some(s => s > 0));
    }
    for (const f of CONFIG.FARMS) {
      const n = STAGE_COUNT(f.species);
      if (!d.discovered[f.species]) d.discovered[f.species] = CONFIG.stages(f.species).map(() => false);
      while (d.discovered[f.species].length < n) d.discovered[f.species].push(false);
      // animals the player already owns don't need a (re)celebration
      for (const a of d.animals[f.id] || []) {
        if (a.stage < n) d.discovered[f.species][a.stage] = true;
      }
      // a save from before the chicken chain was deepened can hold animals
      // past the new top stage only if the chain ever shrinks — clamp so a
      // stale index can never index past the sprite table
      d.animals[f.id] = (d.animals[f.id] || []).map(a => ({ stage: Math.min(a.stage, n - 1) }));
    }
    // Existing saves: every upgrade the player can already see counts as
    // revealed, so opening the panel doesn't replay entry animations for rows
    // that have always been there. Seeded exactly once per save — Farm 1's
    // rows used to be ungated, so without this the whole panel would animate
    // in the first time it is opened now that the discovery gate applies
    // there too. Rows for stages the player has NOT reached stay unseeded, so
    // each still animates in on its own discovery, this session or a later one.
    if (!d.upgradesRevealed) d.upgradesRevealed = CONFIG.FARMS.map(() => []);
    while (d.upgradesRevealed.length < CONFIG.FARMS.length) d.upgradesRevealed.push([]);
    if (!d.revealSeeded) {
      d.revealSeeded = true;
      for (const f of CONFIG.FARMS) {
        const disc = d.discovered[f.species] || [];
        const seen = d.upgradesRevealed[f.id];
        const mark = k => { if (!seen.includes(k)) seen.push(k); };
        disc.forEach((v, s) => { if (v) mark(String(s)); });
        if (disc[0]) mark('spawn');
        if (d.ufo[f.id] && d.ufo[f.id].landed) mark('et');
      }
    }
    return d;
  }

  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.SAVE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      // revealSeeded is forced from the stored value: a save written before
      // the flag existed must read as unseeded, not inherit the default's true
      data = parsed
        ? migrate(Object.assign(defaults(), parsed, { revealSeeded: !!parsed.revealSeeded }))
        : defaults();
    } catch (e) { data = defaults(); }
    return data;
  }

  function save() {
    try { localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function reset() {
    data = defaults();
    save();
  }

  return {
    load, save, reset,
    get data() { return data || load(); },
  };
})();
