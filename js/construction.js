/**
 * Construction — step-by-step farm build progression (see CONFIG.CONSTRUCTION).
 * A construction farm goes: buy the land (map) -> build the house (starts
 * animal spawning) -> build the fence (animals stop escaping, production
 * starts) -> fence upgrades (capacity + pen footprint + art tier).
 *
 * The farm produces NOTHING — no money, no background/offline accrual — until
 * land + house + fence all exist; with the house but no fence, animals spawn
 * and then wander off the plot (see js/animal.js 'escape').
 * State lives in SaveManager.data.construction[farmId] = { land, house, fence }.
 * Farms without a CONFIG entry are always "complete" and keep the classic
 * one-shot unlock behavior.
 */
const Construction = (() => {
  function plan(farmId) { return (CONFIG.CONSTRUCTION || {})[farmId] || null; }
  function state(farmId) { return SaveManager.data.construction[farmId]; }

  /** Does this farm use the step-by-step build flow at all? */
  function required(farmId) { return !!plan(farmId); }

  function landOwned(farmId) { return !required(farmId) || !!state(farmId).land; }

  /** The house is what starts animal spawning. Classic farms always have one. */
  function houseBuilt(farmId) { return !required(farmId) || !!state(farmId).house; }

  /** Current fence tier (0 = not built yet). Non-construction farms: 0. */
  function fenceLevel(farmId) { return required(farmId) ? state(farmId).fence : 0; }

  function maxFenceLevel(farmId) { return required(farmId) ? plan(farmId).FENCE_LEVELS.length : 0; }

  function fenceBuilt(farmId) { return !required(farmId) || state(farmId).fence >= 1; }

  /** Definition of the current fence tier, or null while unbuilt. */
  function levelDef(farmId, lv = fenceLevel(farmId)) {
    const p = plan(farmId);
    if (!p || lv < 1) return null;
    return p.FENCE_LEVELS[Math.min(lv, p.FENCE_LEVELS.length) - 1];
  }

  /** Definition of the next buildable/upgradable tier, or null at max. */
  function nextDef(farmId) {
    const p = plan(farmId);
    if (!p) return null;
    const lv = fenceLevel(farmId);
    return lv < p.FENCE_LEVELS.length ? p.FENCE_LEVELS[lv] : null;
  }

  /** Land + house + fence: the farm is operational. */
  function isComplete(farmId) {
    return !required(farmId) ||
      (!!state(farmId).land && !!state(farmId).house && state(farmId).fence >= 1);
  }

  /**
   * Hard animal cap. No house: nothing spawns at all. House but no fence:
   * the unfenced cap (they escape anyway). Fenced: the tier's capacity.
   */
  function capacity(farmId) {
    if (!required(farmId)) return CONFIG.MAX_ANIMALS;
    if (!houseBuilt(farmId)) return 0;
    const def = levelDef(farmId);
    return def ? def.capacity : plan(farmId).UNFENCED_CAPACITY;
  }

  /** House standing, no fence yet: spawned animals wander off and are lost. */
  function escapesActive(farmId) {
    return required(farmId) && houseBuilt(farmId) && !fenceBuilt(farmId);
  }

  /** Escape tuning for this farm (only meaningful while escapesActive). */
  function escapeCfg(farmId) { return plan(farmId); }

  /** Seconds this animal stays on the board before walking off. */
  function escapeDelay(farmId) {
    const p = plan(farmId);
    if (!p) return Infinity;
    return Math.max(1, p.ESCAPE_TIME + U.rand(-p.ESCAPE_VARIANCE, p.ESCAPE_VARIANCE));
  }

  /** Map purchase price (falls back to the classic unlock cost). */
  function landCost(farmId) {
    return required(farmId) ? plan(farmId).LAND_COST : CONFIG.UNLOCK_COSTS[farmId];
  }

  function houseCost(farmId) { return required(farmId) ? plan(farmId).HOUSE_COST : 0; }

  /** Called by the unlock flow once the map purchase animation lands. */
  function grantLand(farmId) {
    if (!required(farmId)) return;
    state(farmId).land = true;
    SaveManager.save();
  }

  /**
   * The build step waiting for the player:
   *   'land'    — plot not bought yet (handled by the map unlock flow)
   *   'house'   — bare plot, nothing spawns
   *   'fence'   — animals spawn but escape
   *   'upgrade' — operational, fence can still grow
   *   'max'     — fully built
   */
  function stage(farmId) {
    if (!required(farmId)) return 'max';
    if (!landOwned(farmId)) return 'land';
    if (!houseBuilt(farmId)) return 'house';
    if (!fenceBuilt(farmId)) return 'fence';
    return nextDef(farmId) ? 'upgrade' : 'max';
  }

  /** Cost of the next build step, or 0 when there is nothing left to buy. */
  function nextCost(farmId) {
    const s = stage(farmId);
    if (s === 'house') return houseCost(farmId);
    if (s === 'fence' || s === 'upgrade') return nextDef(farmId).cost;
    return 0;
  }

  /** Is there a purchase waiting on this farm (drives the map/HUD badges)? */
  function pending(farmId) {
    const s = stage(farmId);
    return s === 'house' || s === 'fence';
  }

  /**
   * Stamp the farm's idle clock to NOW so background/offline production
   * starts from this moment — never retroactively for the time the farm sat
   * unbuilt (see js/idle.js, which skips incomplete farms entirely).
   */
  function startIdleClock(farmId) {
    const r = SaveManager.data.idle[farmId];
    r.last = Date.now();
    r.carry = 0;
    r.pending = 0;
  }

  /** Build the farmhouse: from here babies start spawning. */
  function buyHouse(farmId) {
    if (!required(farmId) || houseBuilt(farmId)) return { ok: false, reason: 'ALREADY BUILT!' };
    const c = houseCost(farmId);
    if (SaveManager.data.coins < c) return { ok: false, reason: 'NOT ENOUGH COINS!' };
    SaveManager.data.coins -= c;
    state(farmId).house = true;
    SaveManager.save();
    return { ok: true };
  }

  /**
   * Build (level 0 -> 1) or upgrade the fence. The build that completes
   * construction also starts the farm's idle clock.
   */
  function buyFence(farmId) {
    const nxt = nextDef(farmId);
    if (!nxt) return { ok: false, reason: 'MAX LEVEL!' };
    if (!houseBuilt(farmId)) return { ok: false, reason: 'BUILD THE HOUSE FIRST!' };
    if (SaveManager.data.coins < nxt.cost) return { ok: false, reason: 'NOT ENOUGH COINS!' };
    SaveManager.data.coins -= nxt.cost;
    state(farmId).fence++;
    if (state(farmId).fence === 1) startIdleClock(farmId);
    SaveManager.save();
    return { ok: true };
  }

  /** Buy whatever the current stage offers. */
  function buyNext(farmId) {
    const s = stage(farmId);
    if (s === 'house') return buyHouse(farmId);
    if (s === 'fence' || s === 'upgrade') return buyFence(farmId);
    return { ok: false, reason: 'MAX LEVEL!' };
  }

  /**
   * Everything the build panel needs to render its current state:
   * where the player is, what the next purchase is, what it costs and what
   * it unlocks, plus the live fence tier / animal count once fenced.
   */
  function info(farmId, animalCount = 0) {
    const s = stage(farmId);
    const lv = fenceLevel(farmId);
    const maxLv = maxFenceLevel(farmId);
    const nxt = nextDef(farmId);
    const COPY = {
      house: { title: 'BUILD THE HOUSE', unlocks: 'ANIMALS START SPAWNING' },
      fence: { title: 'BUILD THE FENCE', unlocks: 'ANIMALS STOP ESCAPING' },
      upgrade: { title: 'UPGRADE THE FENCE', unlocks: 'BIGGER PEN, MORE ANIMALS' },
      max: { title: 'FARM COMPLETE!', unlocks: 'EVERYTHING IS BUILT' },
    };
    const copy = COPY[s] || COPY.max;
    // step 1 land / 2 house / 3 fence / 4.. upgrades
    const step = s === 'land' ? 1 : s === 'house' ? 2 : 2 + Math.min(lv + 1, maxLv);
    return {
      stage: s,
      step,
      steps: 2 + maxLv,
      title: copy.title,
      unlocks: copy.unlocks,
      cost: nextCost(farmId),
      maxed: s === 'max',
      fenceBuilt: fenceBuilt(farmId),
      level: lv,
      maxLevel: maxLv,
      capacity: capacity(farmId),
      nextCapacity: nxt ? nxt.capacity : null,
      animals: animalCount,
    };
  }

  return {
    required, landOwned, houseBuilt, fenceLevel, maxFenceLevel, fenceBuilt,
    levelDef, nextDef, isComplete, capacity, escapesActive, escapeCfg,
    escapeDelay, landCost, houseCost, nextCost, stage, pending, grantLand,
    buyHouse, buyFence, buyNext, info,
  };
})();
