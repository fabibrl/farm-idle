/**
 * FTUE — the first-time experience for the game's two upgrade entry points.
 *
 * Farm 1 splits its upgrade menu in two (CONFIG.splitUpgrades): the farmhouse
 * opens the FARM rows, a dedicated on-screen button opens the animal chain.
 * Neither is self-explanatory the first time, so each gets one guided run:
 *
 *   'farm'    — the first time a farm upgrade is affordable: dim the scene,
 *               spotlight the house, open the panel, spotlight the row, buy.
 *   'animals' — the same for the animal button, and never before 'farm' has
 *               been finished.
 *
 * Which flows a farm runs, and in what order, is data: CONFIG.FARMS[].ftue
 * names them and CONFIG.FTUE.FLOWS holds their copy, so another farm enables
 * its own FTUE by listing flows there. A flow id is also the upgrade group it
 * teaches (js/upgrades.js `keyGroup`), which is the whole of the mapping
 * between a flow and the rows it points at.
 *
 * Rules this module enforces:
 *
 *   Strict order       Only the first flow a farm still owes can run, so an
 *                      affordable animal upgrade waits its turn rather than
 *                      jumping ahead of the house.
 *   One at a time      A run is inert (see `step`) while anything else owns
 *                      the screen — the merge tutorial, a celebration, the
 *                      welcome-back popup, a surprise box, a poop rain, a
 *                      tornado, the abduction cinematic — and Game freezes
 *                      those systems for the duration of an active step, so
 *                      neither side can start on top of the other.
 *   Once ever          Completing OR skipping a flow latches it in the save
 *                      (SaveManager.data.ftue), so it never comes back.
 *   Never a dead end   The steps are derived from live state every frame, not
 *                      stored. A balance that drops below the cost mid-run
 *                      simply makes `step` null: the overlay disappears, the
 *                      game unfreezes, and the run picks up where it left off
 *                      once the player can afford the row again.
 *   Player-driven      Steps advance on the panel opening and on the purchase
 *                      landing — never on a timer. The only timed thing here
 *                      is the success beat after the purchase is already made.
 *
 * Presentation and sequencing only: costs, discovery gating and purchase
 * logic are untouched. Drawing lives in js/ui.js (`drawFtue`), which reads
 * the getters below; the freeze and the tap routing live in js/game.js.
 */
const FTUE = (() => {
  const C = () => CONFIG.FTUE;

  // The live run, or null. `successT` is null until the purchase lands, then
  // counts the success beat up to CONFIG.FTUE.SUCCESS_TIME.
  let run = null;

  const flows = farmId => CONFIG.ftueFlows(farmId);
  const done = flow => !!SaveManager.data.ftue[flow];

  function markDone(flow) {
    if (!flow || done(flow)) return;
    SaveManager.data.ftue[flow] = true;
    SaveManager.save();
  }

  /**
   * Nothing in this group can ever be bought again (every row maxed, or the
   * chain has no row for it at all). A locked row is not exhausted — it is
   * simply undiscovered and may still become buyable — so this is only ever
   * true for a group that is genuinely finished. Such a flow has nothing left
   * to teach with, and is latched so it can never block the one behind it.
   */
  function exhausted(farmId, group) {
    return Upgrades.keys(farmId, group).every(k => Upgrades.isMaxed(farmId, k));
  }

  /**
   * The flow this farm still owes, in configured order, or null. Reading it
   * also retires a flow whose group is finished, which is what keeps the
   * ordering from deadlocking on an entry point that can no longer be taught.
   */
  function owed(farmId) {
    for (const f of flows(farmId)) {
      if (done(f)) continue;
      if (exhausted(farmId, f)) { markDone(f); continue; }
      return f;
    }
    return null;
  }

  // ---------------- flow -> screen ----------------
  /**
   * Which element a flow asks the player to tap: its configured entry point
   * on a split farm, or the single UPGRADE button on a farm that keeps one
   * menu. Either way it is the control that opens the rows being taught.
   */
  function entryOf(farmId, flow) {
    if (!flow) return null;
    return CONFIG.splitUpgrades(farmId) ? C().FLOWS[flow].entry : 'upgrade';
  }

  /** The panel group that entry point opens (null = the whole, unsplit menu). */
  function groupOf(farmId, flow) {
    return CONFIG.splitUpgrades(farmId) ? flow : null;
  }

  /** Is this the upgrade panel the current run is teaching? */
  function ourPanel(p) {
    return !!p && p.type === 'upgrades' && p.farmId === run.farmId &&
           (p.group || null) === groupOf(run.farmId, run.flow);
  }

  /**
   * The row the run points at: the cheapest thing in its group the player can
   * afford right now. Null is the pause signal — there is nothing to buy, so
   * the run has no honest target and goes quiet until there is one.
   */
  function target() {
    return run ? Upgrades.cheapestAffordable(run.farmId, run.flow) : null;
  }

  /**
   * Is something else already on screen that a run must not draw over? The
   * same list gates starting a run and resuming a paused one, so an event
   * that landed while the FTUE was waiting is always answered first.
   */
  function screenBusy() {
    if (Game.celebrating || Game.popupPending) return true;
    if (UFO.cinematicActive || Tornado.active) return true;
    if (Pigeon.present || Tornado.present || Crate.present) return true;
    const scene = Game.farm;
    return !scene || !!scene.tutorial;
  }

  /**
   * The step to show right now, derived fresh every frame:
   *
   *   'entry'   — spotlight the entry point, nothing else tappable
   *   'buy'     — its panel is open: spotlight the row
   *   'success' — the purchase landed; the closing beat is playing
   *   null      — the run is paused (or there is no run): no overlay, and the
   *               game is not frozen
   */
  function step() {
    if (!run || Game.scene !== 'farm' || SaveManager.data.currentFarm !== run.farmId) return null;
    if (run.successT !== null) return 'success';
    if (screenBusy() || !target()) return null;
    const p = UI.popup;
    if (!p) return 'entry';
    return ourPanel(p) ? 'buy' : null;
  }

  // ---------------- starting ----------------
  /**
   * Everything that has to be true before a run may begin. The screen has to
   * be free (screenBusy), and the entry point has to actually open the
   * upgrade panel: a house with building left to do opens the BUILD panel
   * instead, which would strand the player one step in.
   */
  function canStart(farmId, flow) {
    if (!C().ENABLED || run) return false;
    if (Game.scene !== 'farm' || UI.popup || screenBusy()) return false;
    if (entryOf(farmId, flow) === 'house') {
      if (Construction.stage(farmId) !== 'max') return false;
    } else if (!Construction.fenceBuilt(farmId)) {
      return false;
    }
    return !!Upgrades.cheapestAffordable(farmId, flow);
  }

  function start(farmId, flow) {
    const scene = Game.farm;
    if (scene) scene.pointerUp();   // settle an in-progress drag
    UI.cancelPress();
    run = { farmId, flow, t: 0, successT: null };
    AudioManager.play('pop');
  }

  // ---------------- per-frame ----------------
  /** Called every farm frame, whether or not a run is showing. */
  function update(dt) {
    const farmId = SaveManager.data.currentFarm;
    if (run) {
      // a farm switch abandons the run without latching it: it starts over
      // the next time this farm's conditions line up
      if (farmId !== run.farmId && run.successT === null) { run = null; return; }
      run.t += dt;
      if (run.successT !== null) {
        run.successT += dt;
        if (run.successT >= C().SUCCESS_TIME) run = null;
      }
      return;
    }
    const flow = owed(farmId);
    if (flow && canStart(farmId, flow)) start(farmId, flow);
  }

  // ---------------- outcomes ----------------
  /**
   * An upgrade was bought. Buying from a group latches that group's flow
   * whether or not the FTUE asked for it — the player has used the entry
   * point, so there is nothing left to introduce — and if it was the running
   * flow, the success beat closes it out.
   */
  function onPurchase(farmId, key) {
    const flow = Upgrades.keyGroup(key);
    if (!flows(farmId).includes(flow)) return;
    const finishing = run && run.farmId === farmId && run.flow === flow && run.successT === null;
    markDone(flow);
    if (finishing) run.successT = 0;
  }

  /**
   * The player opted out — the SKIP affordance, or closing the panel mid-run.
   * Guided, never forced: a skipped flow counts as complete and is never
   * retried, so a player who does not want the lesson is not asked twice.
   */
  function skip() {
    if (!run) return;
    markDone(run.flow);
    run = null;
  }

  /**
   * May this entry point show its red "!" badge? Not while a run is on
   * screen (one call to action at a time), and not before the flow that
   * introduces those rows is finished — the FTUE's own spotlight is the
   * first invitation the player gets. A farm with no FTUE always badges.
   * `group` is the entry point's own rows, or null for an unsplit menu that
   * covers every flow at once.
   */
  function badgeAllowed(farmId, group) {
    if (step() !== null) return false;
    const fl = flows(farmId);
    const want = group ? [group] : fl;
    return want.every(f => !fl.includes(f) || done(f));
  }

  /** Full reset (save wipe): drop the live run, latches go with the save. */
  function reset() { run = null; }

  return {
    update, onPurchase, skip, badgeAllowed, reset,
    get step() { return step(); },
    get active() { return step() !== null; },
    get t() { return run ? run.t : 0; },
    get successT() { return run ? run.successT : null; },
    get flow() { return run ? run.flow : null; },
    /** The running flow's copy block (labels + the one-line explanation). */
    get copy() { return run ? C().FLOWS[run.flow] : null; },
    /** 'house' | 'animals' | 'upgrade' | null — the control being spotlighted. */
    get entryId() { return run ? entryOf(run.farmId, run.flow) : null; },
    /**
     * The upgrade key the 'buy' step points at, or null. Keys can be the
     * number 0, so callers must compare against null rather than test
     * truthiness.
     */
    get buyKey() {
      if (step() !== 'buy') return null;
      const t = target();
      return t ? t.key : null;
    },
  };
})();
