/**
 * Upgrades — per-farm, data-driven upgrade system.
 * Levels live in SaveManager.data.upgrades[farmId] = { spawn, stages:[...], et }.
 * All numbers come from the farm's chain (CONFIG.CHAINS) and CONFIG.UPGRADES;
 * nothing is hardcoded here, and no chain length is assumed — a farm's rows
 * are exactly as many as its species has stages.
 *
 * Keys used throughout: 'spawn' for the farm spawn-speed upgrade, a board
 * stage index for the animal upgrades, or 'et' for the chain's final,
 * UFO-abducted form (Farm 1: the Final Chicken).
 *
 * Every upgrade is gated behind discovery — see unlocked() — so the menu
 * fills in one row at a time as the player merges their way up the chain.
 */
const Upgrades = (() => {
  const CU = () => CONFIG.UPGRADES;
  const species = farmId => CONFIG.FARMS[farmId].species;

  function farmData(farmId) {
    return SaveManager.data.upgrades[farmId];
  }

  /** The upgrade definition behind a key, or null if the chain has no row for it. */
  function def(farmId, key) {
    if (key === 'spawn') return CU().FARM.SPAWN;
    const entry = CONFIG.entry(species(farmId), key);
    return (entry && entry.up) || null;
  }

  function level(farmId, key) {
    const d = farmData(farmId);
    return key === 'spawn' ? d.spawn : key === 'et' ? (d.et || 0) : d.stages[key];
  }

  function cost(farmId, key) {
    const u = def(farmId, key);
    if (!u) return 0;
    const growth = u.costGrowth || CU().COST_GROWTH;
    return Math.round(u.baseCost * Math.pow(growth, level(farmId, key)) * CONFIG.FARMS[farmId].costMult);
  }

  function maxLevel(farmId, key) {
    const u = def(farmId, key);
    return u ? u.maxLevel : 0;
  }

  function isMaxed(farmId, key) {
    return level(farmId, key) >= maxLevel(farmId, key);
  }

  /**
   * Discovery gating, on every farm. An upgrade is not offered up front: it
   * unlocks only once the player has discovered the animal it improves on
   * that farm — the farm has spawned it and they have matched their way up to
   * it. Until then the row does not exist in the panel at all, so a long
   * chain never spoils its own ending. Discovery is per species (so per farm)
   * and permanent, so an unlocked upgrade stays unlocked across sessions.
   * The spawn-speed upgrade rides on the baby: the farm has to have produced
   * one before its spawn rate can be tuned. The final abducted form follows
   * the same rule via its own discovery record.
   */
  function unlocked(farmId, key) {
    if (!def(farmId, key)) return false;   // this chain has no such row
    if (key === 'et') return Discovery.isEtDiscovered(farmId);
    const stage = key === 'spawn' ? 0 : key;
    return Discovery.isDiscovered(species(farmId), stage);
  }

  /** What the player has to find before this upgrade exists. */
  function unlockHint(farmId, key) {
    const sp = species(farmId);
    const stage = key === 'spawn' ? 0 : key;
    return 'DISCOVER THE ' + (key === 'et' ? CONFIG.finalStage(sp).name : CONFIG.stageName(sp, stage));
  }

  /**
   * Upgrades unlocked since this farm's panel was last opened, in panel
   * order — the panel plays its entry animation for exactly these, then they
   * are at rest for good. Marking happens here, on open, so a discovery made
   * while the panel is closed still animates the next time it is opened, and
   * a player who closes the panel mid-animation does not see it replayed.
   * The record is per farm and saved, so it survives a session.
   *
   * `group` scopes this to one entry point's rows: opening the farm menu
   * must not consume the animal menu's pending reveals, so each panel plays
   * the entry animation for exactly the rows it actually shows.
   */
  function takeUnrevealed(farmId, group) {
    const seen = SaveManager.data.upgradesRevealed[farmId];
    const fresh = keys(farmId, group).filter(k => unlocked(farmId, k) && !seen.includes(String(k)));
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
    const s = CONFIG.stage(species(farmId), stage);
    const u = s.up;
    return Math.max(u.minPoop, (s.poop ?? CONFIG.POOP_INTERVAL) - lv * u.poopStep);
  }

  /** Coins granted when a poop of this stage transforms on this farm. */
  function coinValue(farmId, stage, lv = level(farmId, stage)) {
    const s = CONFIG.stage(species(farmId), stage);
    return Math.round((s.income + lv * s.up.coinStep) * CONFIG.FARMS[farmId].incomeMult);
  }

  /**
   * Coins one collected final form pays out per UFO production drop on this
   * farm, including its own upgrade levels where the chain offers that row.
   */
  function alienValue(farmId, lv = level(farmId, 'et')) {
    const u = def(farmId, 'et');
    const step = u ? lv * u.incomeStep : 0;
    return Math.round((CONFIG.UFO.INCOME_PER_ALIEN + step) * CONFIG.FARMS[farmId].incomeMult);
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
    if (!unlocked(farmId, key)) return { ok: false, reason: unlockHint(farmId, key) + '!' };
    if (isMaxed(farmId, key)) return { ok: false, reason: 'MAX LEVEL!' };
    const c = cost(farmId, key);
    if (SaveManager.data.coins < c) return { ok: false, reason: 'NOT ENOUGH COINS!' };
    SaveManager.data.coins -= c;
    const d = farmData(farmId);
    if (key === 'spawn') d.spawn++;
    else if (key === 'et') d.et = (d.et || 0) + 1;
    else d.stages[key]++;
    SaveManager.save();
    // a purchase that empties the wallet is a poop-rain trigger (js/events.js)
    Events.onPurchase(farmId);
    return { ok: true };
  }

  /**
   * Which entry point owns a row. A farm with CONFIG.splitUpgrades shows its
   * upgrades through two entry points — the farmhouse for 'farm' rows, the
   * animal button for the chain — so every key belongs to exactly one group.
   * Farms without the flag list both groups in one panel, so grouping only
   * ever narrows an existing list; it never changes a row, cost or effect.
   */
  function keyGroup(key) { return key === 'spawn' ? 'farm' : 'animals'; }

  /**
   * Every upgrade key this farm's panel could list, in panel order: the farm
   * row, then one row per board stage of its chain, then the abducted final
   * form last — that one only where the chain defines an upgrade for it.
   * `group` ('farm' | 'animals') narrows the list to one entry point's rows;
   * omit it for the whole menu.
   */
  function keys(farmId, group) {
    const sp = species(farmId);
    const k = ['spawn'];
    for (let s = 0; s < CONFIG.stageCount(sp); s++) k.push(s);
    if (CONFIG.finalStage(sp).up) k.push('et');
    return group ? k.filter(key => keyGroup(key) === group) : k;
  }

  /** Is this upgrade unlocked, not maxed, and affordable right now? */
  function affordable(farmId, key) {
    return unlocked(farmId, key) && !isMaxed(farmId, key) &&
           SaveManager.data.coins >= cost(farmId, key);
  }

  /**
   * True if the player can afford at least one unlocked, non-maxed upgrade on
   * this farm — a locked upgrade never badges, it isn't buyable yet. Pass a
   * group to badge one entry point only (each carries its own badge).
   */
  function anyAffordable(farmId, group) {
    return keys(farmId, group).some(k => affordable(farmId, k));
  }

  /**
   * The cheapest upgrade the player can afford right now, as
   * {key, cost, group}, or null. The first-upgrade tutorial uses it to decide
   * which entry point to spotlight on a farm whose menu is split.
   */
  function cheapestAffordable(farmId, group) {
    let best = null;
    for (const k of keys(farmId, group)) {
      if (!affordable(farmId, k)) continue;
      const c = cost(farmId, k);
      if (!best || c < best.cost) best = { key: k, cost: c, group: keyGroup(k) };
    }
    return best;
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
      return { key, locked: true, label: '???', hint: unlockHint(farmId, key),
               level: 0, maxed: false, cost: 0, stats: [] };
    }
    const sp = species(farmId);
    const lv = level(farmId, key);
    const maxed = isMaxed(farmId, key);
    const fmtS = v => v.toFixed(1) + 'S';
    let label, stats;
    if (key === 'spawn') {
      label = CU().FARM.SPAWN.label;
      stats = [{ name: 'EVERY', cur: fmtS(spawnInterval(farmId, lv)),
                 next: maxed ? null : fmtS(spawnInterval(farmId, lv + 1)) }];
    } else if (key === 'et') {
      // the abducted form never poops: its row buys UFO drip instead
      label = CONFIG.finalStage(sp).name;
      stats = [
        { name: 'EVERY', cur: CONFIG.UFO.INTERVAL.toFixed(1) + 'S', next: null },
        { name: 'COINS', cur: String(alienValue(farmId, lv)),
          next: maxed ? null : String(alienValue(farmId, lv + 1)) },
      ];
    } else {
      label = CONFIG.stageName(sp, key);
      stats = [
        { name: 'POOP', cur: fmtS(poopInterval(farmId, key, lv)),
          next: maxed ? null : fmtS(poopInterval(farmId, key, lv + 1)) },
        { name: 'COINS', cur: String(coinValue(farmId, key, lv)),
          next: maxed ? null : String(coinValue(farmId, key, lv + 1)) },
      ];
    }
    return { key, locked: false, label, level: lv, maxed, cost: maxed ? 0 : cost(farmId, key), stats };
  }

  return { level, cost, isMaxed, unlocked, keys, keyGroup, takeUnrevealed, spawnInterval, poopInterval,
           coinValue, alienValue, incomeRate, buy, info, affordable, anyAffordable, cheapestAffordable };
})();
