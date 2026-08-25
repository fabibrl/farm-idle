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
   * The ET mutant (MUTANT 2) — the farm's final, fully mutated form. It is
   * discovered by matching two Mutants on that farm, which is exactly what
   * starts its UFO layer, so the farm's saved UFO state IS the discovery
   * record (landed, or a Mutant 2 already collected / in transit).
   */
  function isEtDiscovered(farmId) {
    const u = SaveManager.data.ufo[farmId];
    return !!u && (u.landed || u.aliens > 0 || (u.pending || 0) > 0);
  }

  /** Full collection snapshot: [{species, label, stages:[{name, discovered}]}] */
  function collection() {
    return CONFIG.FARMS.map(f => ({
      species: f.species,
      label: f.label,
      stages: CONFIG.STAGE_NAMES.map((name, i) => ({
        name,
        discovered: isDiscovered(f.species, i),
      })),
    }));
  }

  /** Display name, e.g. "MUTANT CHICKEN". */
  function displayName(species, stage) {
    return CONFIG.STAGE_NAMES[stage] + ' ' + species.toUpperCase();
  }

  function flavor(species, stage) {
    const f = CONFIG.DISCOVERY.FLAVOR[species];
    return (f && f[stage]) || '';
  }

  return { isDiscovered, isEtDiscovered, mark, collection, displayName, flavor };
})();
