/**
 * Events — need-based director for the ambient reward events.
 *
 * The pigeon (Poop Rain) and the tornado (Auto Merge) used to run on fixed
 * countdowns. They don't any more: this module watches the session and
 * releases each offer at the moment it is actually worth something.
 *
 *   Pigeon  — a depleted wallet. The player just spent most of their coins,
 *             can't afford the cheapest upgrade, opened a panel where every
 *             row is disabled, or has been stalled for a while. The offer
 *             reads as relief, exactly when they are short.
 *   Tornado — a crowded pen. 75%+ full with pairs waiting, spawning about to
 *             be blocked, an animal about to hop the fence, a long manual
 *             merging grind, or a pen that filled up while they were away.
 *             The offer reads as a speed-up, exactly when it saves work.
 *
 * On top of the triggers sit frequency limits, counted independently per
 * feature: at most MAX_PER_WINDOW appearances inside a rolling
 * WINDOW_MINUTES (rolling, so quotas can't be stacked across a boundary),
 * a minimum gap between two appearances, and a cooldown that grows with
 * every dismissal until repeated dismissals suppress the feature for the
 * rest of the session. Only appearances that are actually shown consume
 * quota — a trigger that another rule suppresses costs nothing — and the
 * timestamps live in the save, so closing the game never resets the count.
 *
 * Shared rules: never both features at once, never over an open popup, a
 * celebration, a cinematic or a tutorial, never in the first minutes of a
 * new game, and no pigeon while the pen is crowded enough to be a tornado
 * case (the poop reward needs free space and attention to be worth taking).
 *
 * Every appearance is logged with the condition that fired and how the
 * player answered it, so acceptance rates can be compared per condition and
 * the weak ones dropped after launch: the last EVENTS.LOG_MAX records live
 * in the save (Events.history) and each one is also handed to an optional
 * window.EventAnalytics(record) hook.
 *
 * Every threshold, cooldown, cap and interval lives in CONFIG.EVENTS and can
 * be overridden at runtime through window.RemoteConfig.EVENTS.
 */
const Events = (() => {
  const base = () => CONFIG.EVENTS;
  const over = () => (window.RemoteConfig || {}).EVENTS || {};
  const C = () => Object.assign({}, base(), over());
  /** One config section, Remote-Config overlaid (LIMITS / PIGEON / TORNADO). */
  const sub = k => Object.assign({}, base()[k], over()[k]);

  const FEATURES = ['pigeon', 'tornado'];
  const data = () => SaveManager.data.events;
  const slot = f => data()[f];

  // ---------------- session state ----------------
  let clock = 0;                 // seconds of active farm play this session
  const session = {
    dismissals: { pigeon: 0, tornado: 0 },
    pending: null,               // one-shot trigger: {feature, cond, expires}
    wallet: [],                  // {t, coins} samples over the spend window
    stallT: 0,                   // seconds unable to afford any upgrade
    merges: [],                  // clock stamps of manual merges
    offlineT: 0,                 // seconds the "came back to a full pen" case stays live
  };

  const present = f => f === 'pigeon' ? Pigeon.present : Tornado.present;

  // ---------------- bookkeeping ----------------
  /**
   * One frame of signal tracking. Called from the main loop while the farm
   * is being played; `paused` covers the tutorial and an unbuilt farm, where
   * no signal means anything yet.
   */
  function update(dt, paused) {
    if (paused || !C().ENABLED) return;
    clock += dt;
    data().play += dt;
    trackWallet(dt);
    if (session.offlineT > 0) session.offlineT -= dt;
    const p = session.pending;
    if (p && clock >= p.expires) session.pending = null;
  }

  /** Cheapest unlocked, non-maxed upgrade on this farm (Infinity if none). */
  function cheapestCost(farmId) {
    let min = Infinity;
    for (const k of Upgrades.keys(farmId)) {
      if (Upgrades.unlocked(farmId, k) && !Upgrades.isMaxed(farmId, k)) {
        min = Math.min(min, Upgrades.cost(farmId, k));
      }
    }
    return min;
  }

  /**
   * Wallet history (sampled, not per frame) plus the stall timer: how long
   * the player has been unable to afford a single upgrade on this farm.
   */
  function trackWallet(dt) {
    const P = sub('PIGEON'), farmId = SaveManager.data.currentFarm;
    const w = session.wallet;
    if (!w.length || clock - w[w.length - 1].t >= P.SAMPLE_INTERVAL) {
      w.push({ t: clock, coins: SaveManager.data.coins });
    }
    while (w.length && w[0].t < clock - P.SPEND_WINDOW) w.shift();
    const broke = cheapestCost(farmId) < Infinity && !Upgrades.anyAffordable(farmId);
    session.stallT = broke ? session.stallT + dt : 0;
  }

  /** Highest balance seen inside the spend window. */
  function walletPeak() {
    let peak = 0;
    for (const s of session.wallet) peak = Math.max(peak, s.coins);
    return peak;
  }

  function recentMerges(window) {
    while (session.merges.length && session.merges[0] < clock - window) session.merges.shift();
    return session.merges.length;
  }

  // ---------------- pen state (tornado signals) ----------------
  /**
   * Live snapshot of the pen: how full it is and how many merges are waiting.
   * Mutant pairs only count where the UFO is unlocked (they can't merge
   * otherwise, matching the funnel's own rule). Null while there is no
   * playable pen (map, tutorial, farm still under construction).
   */
  function penStats() {
    const scene = Game.farm;
    if (!scene || scene.tutorial || Game.scene !== 'farm') return null;
    const farmId = scene.farmId;
    const cap = Construction.capacity(farmId);
    if (cap <= 0) return null;
    const top = CONFIG.topStage(CONFIG.FARMS[farmId].species);
    const landed = SaveManager.data.ufo[farmId].landed;
    const counts = {};
    let count = 0;
    for (const a of scene.animals) {
      if (a.state === 'merging' || a.escaping) continue;
      count++;
      if (a.stage === top && !landed) continue;
      const k = a.species + ':' + a.stage;
      counts[k] = (counts[k] || 0) + 1;
    }
    let pairs = 0;
    for (const k in counts) pairs += Math.floor(counts[k] / 2);
    return { scene, farmId, count, cap, fill: count / cap, pairs };
  }

  /** Is an animal about to hop the fence? (construction farms only) */
  function jumpRisk(s, T) {
    const J = Construction.jumpCfg(s.farmId);
    if (!J) return false;
    const at = s.scene.jumpAt || J.PRESSURE_TIME;
    if (s.scene.penPressure / at < T.JUMP_WARN) return false;
    return s.scene.animals.some(a => a.stage >= J.MIN_STAGE && !a.escaping && !a.dead);
  }

  // ---------------- trigger conditions ----------------
  /**
   * Which wallet condition (if any) is true right now, strongest first. A
   * farm with nothing left to buy has no shortage to relieve, so it never
   * triggers.
   */
  function pigeonCondition() {
    const P = sub('PIGEON'), farmId = SaveManager.data.currentFarm;
    const cheapest = cheapestCost(farmId);
    if (cheapest === Infinity) return null;
    const coins = SaveManager.data.coins;
    if (coins >= cheapest) return null;              // they can still buy something
    if (session.stallT >= P.STALL_TIME) return 'stalled';
    const peak = walletPeak();
    if (peak >= cheapest * P.MIN_PEAK_COSTS && coins <= peak * (1 - P.SPEND_FRACTION)) {
      return 'spend_burst';
    }
    if (session.stallT >= P.BROKE_TIME) return 'below_cheapest';
    return null;
  }

  /** Which pen condition (if any) is true right now, most specific first. */
  function tornadoCondition() {
    const T = sub('TORNADO');
    const s = penStats();
    if (!s || s.pairs < 1) return null;
    if (session.offlineT > 0 && s.fill >= T.RETURN_FILL_PCT) return 'offline_return';
    if (jumpRisk(s, T)) return 'fence_jump_risk';
    if (s.count >= s.cap - T.NEAR_CAP_SLOTS) return 'spawn_blocked';
    if (s.pairs >= T.MIN_PAIRS && s.fill >= T.FILL_PCT) return 'pen_crowded';
    if (s.pairs >= T.MIN_PAIRS && recentMerges(T.MERGE_WINDOW) >= T.MERGE_GRIND) return 'manual_grind';
    return null;
  }

  /**
   * Pen too busy for a poop rain: the reward needs free space and the
   * player's attention, and a crowded pen is the tornado's moment, not the
   * pigeon's.
   */
  function penBusy() {
    const s = penStats();
    if (!s) return false;
    return s.fill >= sub('TORNADO').FILL_PCT || tornadoCondition() !== null;
  }

  // ---------------- frequency limits ----------------
  /** Appearance stamps inside the rolling window (clock jumps are dropped). */
  function windowStamps(f) {
    const L = sub('LIMITS'), t = Date.now();
    const s = slot(f);
    s.shown = s.shown.filter(ts => ts <= t && t - ts < L.WINDOW_MINUTES * 60000);
    return s.shown;
  }

  /** Seconds that must pass between two appearances of this feature. */
  function requiredGap(f) {
    const L = sub('LIMITS'), s = slot(f);
    return L.MIN_INTERVAL_MINUTES * 60
         + session.dismissals[f] * L.DISMISS_COOLDOWN_MINUTES * 60
         + (s.extra || 0);
  }

  function quotaOk(f) {
    const L = sub('LIMITS'), s = slot(f), t = Date.now();
    if (windowStamps(f).length >= L.MAX_PER_WINDOW) return false;
    if (s.last && t >= s.last && t - s.last < requiredGap(f) * 1000) return false;
    return true;
  }

  // ---------------- shared gating ----------------
  /**
   * Everything that has to be true before ANY appearance: past the new-game
   * grace, on a farm, nothing else on screen that the offer could interrupt
   * or collide with, the feature not suppressed by dismissals, and inside
   * its own frequency budget.
   */
  function canShow(f) {
    const g = C();
    if (!g.ENABLED) return false;
    if (data().play < g.NEW_GAME_GRACE) return false;
    if (Game.scene !== 'farm' || Game.celebrating || Game.upgradeTutorialActive) return false;
    if (UI.popup || UFO.cinematicActive || Tornado.active) return false;
    // never two offers at once (nor a second one over a rain still falling)
    if (present('pigeon') || present('tornado')) return false;
    if (session.dismissals[f] >= sub('LIMITS').DISMISS_SUPPRESS) return false;
    if (f === 'pigeon' && penBusy()) return false;
    return quotaOk(f);
  }

  /**
   * The feature asks whether it may appear. Returns the condition that fired
   * (to be handed straight back to shown()), or null. A queued one-shot
   * condition wins over the continuous ones and survives CONDITION_TTL
   * seconds, so a trigger that lands while a popup is open still fires the
   * moment the screen is free.
   */
  function request(f) {
    if (!canShow(f)) return null;
    const p = session.pending;
    if (p && p.feature === f) { session.pending = null; return p.cond; }
    return f === 'pigeon' ? pigeonCondition() : tornadoCondition();
  }

  /** Queue a one-shot condition raised by a game action (purchase, panel). */
  function queue(f, cond) {
    if (!C().ENABLED || present(f)) return;
    session.pending = { feature: f, cond, expires: clock + C().CONDITION_TTL };
  }

  // ---------------- one-shot triggers ----------------
  /**
   * An upgrade was bought. A purchase that leaves the wallet unable to reach
   * the next cheapest upgrade is the classic "I just spent everything"
   * moment the poop rain answers.
   */
  function onPurchase(farmId) {
    const P = sub('PIGEON');
    const cheapest = cheapestCost(farmId);
    if (cheapest === Infinity) return;
    if (SaveManager.data.coins < cheapest * P.EMPTY_FRACTION) queue('pigeon', 'purchase_emptied');
  }

  /**
   * An upgrade panel was opened. Every row disabled — at least one thing
   * left to buy, none of it affordable — is the player looking straight at
   * their shortage.
   */
  function onUpgradesOpened(farmId, group) {
    const keys = Upgrades.keys(farmId, group)
      .filter(k => Upgrades.unlocked(farmId, k) && !Upgrades.isMaxed(farmId, k));
    if (!keys.length) return;
    if (keys.some(k => Upgrades.affordable(farmId, k))) return;
    queue('pigeon', 'upgrades_all_disabled');
  }

  /** A manual drag-merge (the tornado's grind signal; storm merges don't count). */
  function onManualMerge() { session.merges.push(clock); }

  /**
   * Boot-time offline report: a long absence makes a pen that filled up
   * while away a tornado case for the next few minutes of play.
   */
  function onOfflineReturn(awaySec) {
    const T = sub('TORNADO');
    if (awaySec >= T.RETURN_AWAY) session.offlineT = T.RETURN_WINDOW;
  }

  // ---------------- appearance log ----------------
  function emit(rec) {
    if (C().LOG) console.log('[event]', rec.feature, rec.condition, rec.outcome);
    const hook = window.EventAnalytics;
    if (typeof hook === 'function') { try { hook(Object.assign({}, rec)); } catch (e) {} }
  }

  /** The most recent record for this feature (the one still being answered). */
  function lastRecord(f) {
    const log = data().log;
    for (let i = log.length - 1; i >= 0; i--) if (log[i].feature === f) return log[i];
    return null;
  }

  function outcome(f, result) {
    const rec = lastRecord(f);
    if (!rec || rec.outcome !== 'shown') return;
    rec.outcome = result;
    SaveManager.save();
    emit(rec);
  }

  /**
   * The feature is now on screen: consume quota, stamp the appearance and
   * log which condition released it.
   */
  function shown(f, cond) {
    const s = slot(f), t = Date.now();
    s.shown.push(t);
    s.last = t;
    s.extra = 0;
    windowStamps(f);
    const rec = { feature: f, condition: cond, t, outcome: 'shown' };
    const log = data().log;
    log.push(rec);
    while (log.length > C().LOG_MAX) log.shift();
    SaveManager.save();
    emit(rec);
  }

  /** The offer was taken (the reward ad completed). */
  function accepted(f) {
    slot(f).extra = f === 'pigeon'
      ? (CONFIG.PIGEON.REWARD_COOLDOWN || 0)
      : (CONFIG.TORNADO.REWARD_COOLDOWN || 0);
    session.dismissals[f] = 0;   // a claim clears the dismissal streak
    outcome(f, 'accepted');
  }

  /**
   * The offer was ignored (it timed out) or actively dismissed (the popup
   * was closed without watching). Each dismissal extends the cooldown, and
   * DISMISS_SUPPRESS of them shelve the feature for the rest of the session.
   * Counted once per appearance: closing the popup and then letting the
   * offer time out is one dismissal, not two.
   */
  function dismissed(f) {
    const rec = lastRecord(f);
    if (!rec || rec.outcome !== 'shown') return;
    session.dismissals[f]++;
    outcome(f, 'dismissed');
  }

  /** Acceptance rate per condition over the saved log — for tuning. */
  function stats() {
    const out = {};
    for (const r of data().log) {
      const k = r.feature + ':' + r.condition;
      const e = out[k] || (out[k] = { shown: 0, accepted: 0, dismissed: 0 });
      e.shown++;
      if (r.outcome === 'accepted') e.accepted++;
      else if (r.outcome === 'dismissed') e.dismissed++;
    }
    return out;
  }

  /** Full reset (save wipe): drop every session signal. */
  function reset() {
    clock = 0;
    session.pending = null;
    session.wallet = [];
    session.merges = [];
    session.stallT = 0;
    session.offlineT = 0;
    for (const f of FEATURES) session.dismissals[f] = 0;
  }

  return {
    update, request, shown, accepted, dismissed, reset, stats,
    onPurchase, onUpgradesOpened, onManualMerge, onOfflineReturn,
    // introspection (debug / tuning)
    penStats, pigeonCondition, tornadoCondition,
    get history() { return data().log; },
  };
})();
