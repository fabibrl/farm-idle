/**
 * Idle — background & offline production for every unlocked farm.
 * Nothing is simulated frame by frame: each farm carries a lastUpdate
 * timestamp and elapsed production is computed on demand (launch, map,
 * entering a farm, periodic tick). Earnings accumulate into a per-farm
 * pending balance that is auto-collected on the map / on farm entry.
 */
const Idle = (() => {
  const capSeconds = () => CONFIG.IDLE.OFFLINE_CAP_HOURS * 3600;

  function rec(farmId) { return SaveManager.data.idle[farmId]; }

  /** Passive coins/sec of one saved animal, matching Upgrades.incomeRate. */
  function animalRate(farmId, stage) {
    return Upgrades.coinValue(farmId, stage)
         / (Upgrades.poopInterval(farmId, stage) + CONFIG.POOP_INTERVAL_JITTER / 2);
  }

  /**
   * How many animals offline spawning may leave on the board.
   *
   * The base threshold is a percentage of the farm's CURRENT animal cap (the
   * fence tier's capacity on construction farms), so it rescales with every
   * fence upgrade instead of being a fixed absolute number. On top of that it
   * never returns fewer than two babies per stage in that farm's chain: a
   * longer chain needs proportionally more raw material to climb, so Farm 1's
   * six-stage chicken chain comes back with a workable board instead of the
   * handful that was plenty for a four-stage one. Both terms stay clamped to
   * the farm's real capacity — offline play can never overfill the pen.
   */
  function offlineFillCap(farmId) {
    const cap = Construction.capacity(farmId);
    const pct = Math.floor(cap * (CONFIG.FARMS[farmId].offlinePenFill ?? CONFIG.IDLE.OFFLINE_PEN_FILL));
    const perChain = CONFIG.stageCount(CONFIG.FARMS[farmId].species) * CONFIG.IDLE.OFFLINE_PER_STAGE;
    return Math.min(cap, Math.max(pct, perChain));
  }

  /**
   * Advance one farm's clock to `now`. When `live` (the farm is being
   * simulated on-screen) only the timestamp is stamped; otherwise the
   * elapsed time (capped) becomes spawned babies + pending coins.
   */
  function reconcile(farmId, now, live) {
    const r = rec(farmId);
    // fresh save / clock rolled backwards: no elapsed time, restamp
    if (!r.last || now < r.last) { r.last = now; return; }
    const elapsed = Math.min((now - r.last) / 1000, capSeconds());
    r.last = now;
    if (live || elapsed <= 0) return;
    const d = SaveManager.data;
    // locked farms produce nothing; a construction farm is excluded entirely
    // until land + fence exist (its clock is stamped fresh on completion, so
    // unbuilt time never converts to earnings); spawning is paused until the
    // farm's first-merge tutorial is done, exactly like the live scene
    if (!d.unlocked[farmId] || !Construction.isComplete(farmId) || !d.tutorialDone[farmId]) return;

    // existing animals poop the whole time
    const animals = d.animals[farmId] || (d.animals[farmId] = []);
    let coins = 0;
    for (const a of animals) coins += animalRate(farmId, a.stage) * elapsed;

    // babies keep spawning on the farm's interval, but only up to the
    // offline pen-fill threshold (a partial fill so the board comes back
    // playable — active play can still reach the farm's full cap as usual);
    // the timer remainder carries across ticks so short ticks don't slow it
    const int = Upgrades.spawnInterval(farmId);
    const t = elapsed + (r.carry || 0);
    const free = Math.max(0, offlineFillCap(farmId) - animals.length);
    const spawns = Math.min(free, Math.floor(t / int));
    r.carry = t % int;
    for (let i = 1; i <= spawns; i++) {
      animals.push({ stage: 0 });
      coins += animalRate(farmId, 0) * Math.max(0, elapsed - i * int);
    }

    // landed UFO keeps dripping its alien income
    const ufo = d.ufo[farmId];
    if (ufo && ufo.landed && ufo.aliens > 0) {
      coins += ufo.aliens * Upgrades.alienValue(farmId) / CONFIG.UFO.INTERVAL * elapsed;
    }

    r.pending += coins;
  }

  /** Advance every farm; pass the farm currently simulated on-screen (or -1). */
  function tick(liveFarmId = -1) {
    const now = Date.now();
    for (const f of CONFIG.FARMS) reconcile(f.id, now, f.id === liveFarmId);
  }

  let launchReport = null; // {awaySec, capped, perFarm, total} captured once at boot

  /**
   * Boot-time reconcile for the welcome-back popup: measures how long the
   * game was closed (the most recent farm stamp from the previous session)
   * and how many coins each farm produced over that capped window (the
   * per-farm pending deltas the reconcile itself generates).
   */
  function launchTick() {
    const now = Date.now();
    let lastSeen = 0;
    for (const f of CONFIG.FARMS) lastSeen = Math.max(lastSeen, rec(f.id).last || 0);
    const before = CONFIG.FARMS.map(f => rec(f.id).pending);
    tick();
    const perFarm = CONFIG.FARMS.map(f => rec(f.id).pending - before[f.id]);
    const awaySec = lastSeen && now > lastSeen ? (now - lastSeen) / 1000 : 0;
    launchReport = {
      awaySec: Math.min(awaySec, capSeconds()),
      capped: awaySec > capSeconds(),
      perFarm,
      total: perFarm.reduce((a, b) => a + b, 0),
    };
  }

  /** One-shot: the boot report for the welcome-back popup (null after use). */
  function takeLaunchReport() { const r = launchReport; launchReport = null; return r; }

  /** Whole coins waiting to be collected on this farm. */
  function pending(farmId) { return Math.floor(rec(farmId).pending); }

  /** Take the whole-coin pending balance; the fraction keeps accruing. */
  function collect(farmId) {
    const r = rec(farmId);
    const amount = Math.floor(r.pending);
    r.pending -= amount;
    return amount;
  }

  return { tick, launchTick, takeLaunchReport, pending, collect };
})();
