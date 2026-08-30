/**
 * Discovery — tracks which species+stage evolutions the player has created.
 * Each unique evolution unlocks exactly once, is permanently saved, and can
 * later back an encyclopedia / collection book / achievements screen.
 */
const Discovery = (() => {

  function list(species) {
    return SaveManager.data.discovered[species];
  }

  function isDiscovered(species, stage) {
    return !!list(species)[stage];
  }

  /**
   * Mark a species+stage as discovered.
   * Returns true only the FIRST time (i.e. this creation is a new discovery).
   */
  function mark(species, stage) {
    const l = list(species);
    if (l[stage]) return false;
    l[stage] = true;
    SaveManager.save();
    return true;
  }

  /**
   * The chain's final, abducted form (Farm 1: the Final Chicken). It is
   * discovered by matching two of the last board stage on that farm, which is
   * exactly what starts its UFO layer, so the farm's saved UFO state IS the
   * discovery record (landed, or one already collected / in transit).
   */
  function isEtDiscovered(farmId) {
    const u = SaveManager.data.ufo[farmId];
    return !!u && (u.landed || u.aliens > 0 || (u.pending || 0) > 0);
  }

  /**
   * Has this farm's whole chain been discovered — every board stage AND the
   * final, abducted form? This is the end of that farm's collection, and
   * what gates the parachute surprise box (see js/crate.js).
   */
  function chainComplete(farmId) {
    const sp = CONFIG.FARMS[farmId].species;
    return CONFIG.stages(sp).every((_, i) => isDiscovered(sp, i)) && isEtDiscovered(farmId);
  }

  /** Full collection snapshot: [{species, label, stages:[{name, discovered}]}] */
  function collection() {
    return CONFIG.FARMS.map(f => ({
      species: f.species,
      label: f.label,
      stages: CONFIG.stages(f.species).map((s, i) => ({
        name: s.name,
        discovered: isDiscovered(f.species, i),
      })),
    }));
  }

  /**
   * Display name for the celebration popup, e.g. "STRANGE CHICKEN". A stage
   * whose name doesn't read well in front of the species (the chain's
   * "MUTANT 2" wants to be "MUTANT CHICKEN 2") carries its own `title`.
   */
  function displayName(species, stage) {
    const s = CONFIG.stage(species, stage);
    return s.title || (s.name + ' ' + species.toUpperCase());
  }

  function flavor(species, stage) {
    const s = CONFIG.stage(species, stage);
    return (s && s.flavor) || '';
  }

  return { isDiscovered, isEtDiscovered, chainComplete, mark, collection, displayName, flavor };
})();
