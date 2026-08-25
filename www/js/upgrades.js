/**
 * Upgrades — per-farm, data-driven upgrade system.
 * Levels live in SaveManager.data.upgrades[farmId] = { spawn, stages:[s0,s1,s2] }.
 * All numbers come from CONFIG.UPGRADES / CONFIG base values; nothing hardcoded here.
 *
 * Keys used throughout: 'spawn' for the farm spawn-speed upgrade,
 * a stage index (0..CONFIG.STAGE_NAMES.length-1) for the animal upgrades,
 * or 'et' for the ET mutant (MUTANT 2).
 *
 * On constructed farms every upgrade is gated behind discovery — see
 * unlocked() — so the menu fills in as the player merges their way up.
 */
const Upgrades = (() => {
  const CU = () => CONFIG.UPGRADES;

  function farmData(farmId) {
    return SaveManager.data.upgrades[farmId];
  }

  function level(farmId, key) {
    const d = farmData(farmId);
    return key === 'spawn' ? d.spawn : d.stages[key];
  }

  function cost(farmId, key) {
    const def = key === 'spawn' ? CU().FARM.SPAWN : CU().STAGES[key];
    const growth = def.costGrowth || CU().COST_GROWTH;
    return Math.round(def.baseCost * Math.pow(growth, level(farmId, key)) * CONFIG.FARMS[farmId].costMult);
  }

  function maxLevel(key) {
    return key === 'spawn' ? CU().FARM.SPAWN.maxLevel : CU().STAGES[key].maxLevel;
  }

  function isMaxed(farmId, key) {
    return level(farmId, key) >= maxLevel(key);
  }

  /**
   * Discovery gating. On a constructed farm (Farm 2, Farm 3) an upgrade is
   * not offered up front: it unlocks only once the player has discovered the
   * animal it improves on that farm — the farm has spawned it and they have
   * matched their way up to it. Discovery is per species (so per farm) and
   * permanent, so an unlocked upgrade stays unlocked across sessions.
   * The spawn-speed upgrade rides on the baby: the farm has to have produced
   * one before its spawn rate can be tuned. The ET mutant follows the same
   * rule via its own discovery record. Farm 1 is never gated.
   */
  function unlocked(farmId, key) {
    if (!Construction.required(farmId)) return true;
    if (key === 'et') return Discovery.isEtDiscovered(farmId);
    const stage = key === 'spawn' ? 0 : key;
    return Discovery.isDiscovered(CONFIG.FARMS[farmId].species, stage);
  }

  /** What the player has to find before this upgrade exists. */
  function unlockHint(key) {
    const stage = key === 'et' ? null : key === 'spawn' ? 0 : key;
    return 'DISCOVER THE ' + (stage === null ? 'ET MUTANT' : CONFIG.STAGE_NAMES[stage]);
  }

  /**
   * Upgrades unlocked since this farm's panel was last opened, in panel
   * order — the panel plays its entry animation for exactly these, then they
   * are at rest for good. Marking happens here, on open, so a discovery made
   * while the panel is closed still animates the next time it is opened, and
   * a player who closes the panel mid-animation does not see it replayed.
   * The record is per farm and saved, so it survives a session.
   */
  function takeUnrevealed(farmId) {
    if (!Construction.required(farmId)) return [];   // Farm 1: nothing is gated
    const seen = SaveManager.data.upgradesRevealed[farmId];
    const fresh = keys().filter(k => unlocked(farmId, k) && !seen.includes(String(k)));
    if (fresh.length) {
      for (const k of fresh) seen.push(String(k));
      SaveManager.save();
    }
    return fresh;
  }

  /** Seconds between automatic baby spawns for this farm (optionally at a given level). */
  function spawnInterval(farmId, lv = level(farmId, 'spawn')) {
    const u = CU().FARM.SPAWN;
    return Math.max(u.minInterval, CONFIG.SPAWN_INTERVAL - lv * u.intervalStep);
  }

  /** Seconds between poops for one animal of this stage on this farm. */
  function poopInterval(farmId, stage, lv = level(farmId, stage)) {
    const u = CU().STAGES[stage];
    const base = (CONFIG.POOP_INTERVAL_BY_STAGE || [])[stage] ?? CONFIG.POOP_INTERVAL;
    return Math.max(u.minPoop, base - lv * u.poopStep);
  }

  /** Coins granted when a poop of this stage transforms on this farm. */
  function coinValue(farmId, stage, lv = level(farmId, stage)) {
    return Math.round((CONFIG.INCOME_BY_STAGE[stage] + lv * CU().STAGES[stage].coinStep)
                      * CONFIG.FARMS[farmId].incomeMult);
  }

  /** Coins one UFO alien pays out per production drop on this farm. */
  function alienValue(farmId) {
    return Math.round(CONFIG.UFO.INCOME_PER_ALIEN * CONFIG.FARMS[farmId].incomeMult);
  }

  /**
   * Current passive income of a farm in coins/sec: every animal's poop
   * value over its average cycle, plus the landed UFO's alien drip.
   * This is the economy's yardstick — reward ads price themselves off it
   * so acceleration always stays proportional to normal play.
   */
  function incomeRate(farmId, animals) {
    let rate = 0;
    for (const a of animals) {
      if (a.state === 'merging') continue;
      rate += coinValue(farmId, a.stage)
            / (poopInterval(farmId, a.stage) + CONFIG.POOP_INTERVAL_JITTER / 2);
    }
    const ufo = SaveManager.data.ufo[farmId];
    if (ufo && ufo.landed) rate += ufo.aliens * alienValue(farmId) / CONFIG.UFO.INTERVAL;
    return rate;
  }

  /** Attempt a purchase. Returns {ok} or {ok:false, reason}. */
  function buy(farmId, key) {
    if (!unlocked(farmId, key)) return { ok: false, reason: unlockHint(key) + '!' };
    if (isMaxed(farmId, key)) return { ok: false, reason: 'MAX LEVEL!' };
    const c = cost(farmId, key);
    if (SaveManager.data.coins < c) return { ok: false, reason: 'NOT ENOUGH COINS!' };
    SaveManager.data.coins -= c;
    const d = farmData(farmId);
    if (key === 'spawn') d.spawn++; else d.stages[key]++;
    SaveManager.save();
    return { ok: true };
  }

  /** Every upgrade key this farm's panel lists, in panel order. */
  function keys() {
    const k = ['spawn'];
    for (let s = 0; s < CU().STAGES.length; s++) k.push(s);
    return k;
  }

  /**
   * True if the player can afford at least one unlocked, non-maxed upgrade on
   * this farm — a locked upgrade never badges, it isn't buyable yet.
   */
  function anyAffordable(farmId) {
    return keys().some(k => unlocked(farmId, k) && !isMaxed(farmId, k) &&
                            SaveManager.data.coins >= cost(farmId, k));
  }

  /**
   * Everything the upgrade panel needs to render one card.
   * stats: [{name, cur, next}] — next is null when maxed, so the UI can
   * render a "cur > next" improvement comparison per stat.
   * A locked card carries no numbers at all: the animal it belongs to is
   * still unknown, so the panel only shows how to find it.
   */
  function info(farmId, key) {
    if (!unlocked(farmId, key)) {
      // an undiscovered upgrade has no row in the panel at all, so this is
      // only a guard: no label, and no cost — price is never evaluated while
      // an upgrade is locked
      return { key, locked: true, label: '???', hint: unlockHint(key),
               level: 0, maxed: false, cost: 0, stats: [] };
    }
    const lv = level(farmId, key);
    const maxed = isMaxed(farmId, key);
    const fmtS = v => v.toFixed(1) + 'S';
    let label, stats;
    if (key === 'spawn') {
      label = CU().FARM.SPAWN.label;
      stats = [{ name: 'EVERY', cur: fmtS(spawnInterval(farmId, lv)),
                 next: maxed ? null : fmtS(spawnInterval(farmId, lv + 1)) }];
    } else {
      label = CU().STAGES[key].label;
      stats = [
        { name: 'POOP', cur: fmtS(poopInterval(farmId, key, lv)),
          next: maxed ? null : fmtS(poopInterval(farmId, key, lv + 1)) },
        { name: 'COINS', cur: String(coinValue(farmId, key, lv)),
          next: maxed ? null : String(coinValue(farmId, key, lv + 1)) },
      ];
    }
    return { key, locked: false, label, level: lv, maxed, cost: maxed ? 0 : cost(farmId, key), stats };
  }

  return { level, cost, isMaxed, unlocked, keys, takeUnrevealed, spawnInterval, poopInterval, coinValue,
           alienValue, incomeRate, buy, info, anyAffordable };
})();
