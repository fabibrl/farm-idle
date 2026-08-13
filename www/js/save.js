/**
 * SaveManager — persists progress to localStorage and autosaves.
 */
const SaveManager = (() => {
  let data = null;

  const STAGE_COUNT = () => CONFIG.STAGE_NAMES.length;

  function defaults() {
    return {
      coins: 0,
      unlocked: [true, false, false],
      currentFarm: 0,
      settings: { music: true, sfx: true },
      // per-farm upgrade levels: { spawn, stages:[one level per evolution stage] }
      upgrades: CONFIG.FARMS.map(() => ({ spawn: 0, stages: CONFIG.STAGE_NAMES.map(() => 0) })),
      // per-farm animal snapshot: [{stage}...]
      animals: [[], [], []],
      // discovery collection: species -> [bool per stage], permanent once true
      discovered: discoveredDefaults(),
      // per-farm: has the first-merge tutorial been completed?
      tutorialDone: CONFIG.FARMS.map(() => false),
      // one-time: has the first-upgrade tutorial been completed?
      upgradeTutorialDone: false,
      // per-farm UFO alien-collection layer: each farm unlocks its own UFO
      // with the first Mutant+Mutant merge on that farm
      ufo: CONFIG.FARMS.map(() => ({ landed: false, aliens: 0, pending: 0 })),
      // per-farm pigeon reward-ad event: independent spawn countdown +
      // remaining perch time (so a pigeon survives leaving the farm)
      pigeon: CONFIG.FARMS.map(() => ({ next: CONFIG.PIGEON.SPAWN_INTERVAL, remaining: 0 })),
      // per-farm tornado auto-merge reward-ad event: independent offer
      // countdown + remaining availability window
      tornado: CONFIG.FARMS.map(() => ({ next: CONFIG.TORNADO.SPAWN_INTERVAL, remaining: 0 })),
      // per-farm background production: last reconcile timestamp (ms epoch),
      // uncollected coin balance, and the carried spawn-timer remainder
      idle: CONFIG.FARMS.map(() => ({ last: 0, pending: 0, carry: 0 })),
      firstRun: true,
    };
  }

  function discoveredDefaults() {
    const d = {};
    for (const f of CONFIG.FARMS) d[f.species] = CONFIG.STAGE_NAMES.map(() => false);
    return d;
  }

  /** Bring older saves up to the current schema (extra stages, discovery data). */
  function migrate(d) {
    for (const u of d.upgrades) {
      while (u.stages.length < STAGE_COUNT()) u.stages.push(0);
    }
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
    if (!d.pigeon) d.pigeon = CONFIG.FARMS.map(() => ({ next: CONFIG.PIGEON.SPAWN_INTERVAL, remaining: 0 }));
    while (d.pigeon.length < CONFIG.FARMS.length) d.pigeon.push({ next: CONFIG.PIGEON.SPAWN_INTERVAL, remaining: 0 });
    if (!d.tornado) d.tornado = CONFIG.FARMS.map(() => ({ next: CONFIG.TORNADO.SPAWN_INTERVAL, remaining: 0 }));
    while (d.tornado.length < CONFIG.FARMS.length) d.tornado.push({ next: CONFIG.TORNADO.SPAWN_INTERVAL, remaining: 0 });
    if (!d.idle) d.idle = CONFIG.FARMS.map(() => ({ last: 0, pending: 0, carry: 0 }));
    while (d.idle.length < CONFIG.FARMS.length) d.idle.push({ last: 0, pending: 0, carry: 0 });
    // players from before the tutorial existed (or with animals already) skip it
    if (!d.tutorialDone) d.tutorialDone = CONFIG.FARMS.map(f => (d.animals[f.id] || []).length > 0);
    // players who already bought an upgrade skip the first-upgrade tutorial
    if (d.upgradeTutorialDone === undefined) {
      d.upgradeTutorialDone = d.upgrades.some(u => u.spawn > 0 || u.stages.some(s => s > 0));
    }
    for (const f of CONFIG.FARMS) {
      if (!d.discovered[f.species]) d.discovered[f.species] = CONFIG.STAGE_NAMES.map(() => false);
      while (d.discovered[f.species].length < STAGE_COUNT()) d.discovered[f.species].push(false);
      // animals the player already owns don't need a (re)celebration
      for (const a of d.animals[f.id] || []) {
        if (a.stage < STAGE_COUNT()) d.discovered[f.species][a.stage] = true;
      }
    }
    return d;
  }

  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.SAVE_KEY);
      data = raw ? migrate(Object.assign(defaults(), JSON.parse(raw))) : defaults();
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
