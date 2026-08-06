/**
 * CONFIG — every tunable value in the game lives here.
 * No gameplay numbers should be hardcoded elsewhere.
 */
const CONFIG = {
  // Virtual resolution (portrait, mobile). Canvas scales to fit screen.
  VIEW_W: 360,
  VIEW_H: 640,
  PIXEL_SCALE: 2,          // native art pixels -> screen pixels multiplier baseline

  // Spawning
  SPAWN_INTERVAL: 3.0,     // seconds between automatic baby spawns
  MAX_ANIMALS: 14,         // maximum simultaneous animals per farm
  SPAWN_POP_TIME: 0.35,

  // Economy
  INCOME_BY_STAGE: [2, 5, 12, 32],      // coins per poop for stage 1/2/3/4
  POOP_INTERVAL: 4.0,                   // default seconds between poops per animal
  POOP_INTERVAL_BY_STAGE: [4.0, 4.0, 4.0, 2.6],  // per-stage base poop interval (mutant poops fastest)
  POOP_INTERVAL_JITTER: 2.0,     // random extra seconds
  POOP_TO_COIN_DELAY: 1.4,       // poop sits, then transforms
  COIN_FLY_SPEED: 620,           // px/sec toward HUD
  // Per-farm upgrade system (see js/upgrades.js). All values data-driven.
  UPGRADES: {
    COST_GROWTH: 1.22,           // cost multiplier per level (1.15–1.30 recommended)
    FARM: {
      SPAWN: {
        label: 'SPAWN SPEED',
        baseCost: 100,
        maxLevel: 10,            // levels until minInterval is reached
        intervalStep: 0.2,       // seconds removed from spawn interval per level
        minInterval: 1.0,        // spawn interval floor
      },
    },
    // One entry per evolution stage; each level improves poop speed AND coin value.
    STAGES: [
      { label: 'BABY',   baseCost: 50,   maxLevel: 30, poopStep: 0.2,  minPoop: 1.5, coinStep: 1 },
      { label: 'ADULT',  baseCost: 300,  maxLevel: 30, poopStep: 0.2,  minPoop: 1.5, coinStep: 2 },
      { label: 'ELDER',  baseCost: 1000, maxLevel: 30, poopStep: 0.2,  minPoop: 1.5, coinStep: 3 },
      { label: 'MUTANT', baseCost: 4000, maxLevel: 30, poopStep: 0.25, minPoop: 0.8, coinStep: 8 },
    ],
  },

  // Evolution stages (index 0-3). Stage count drives merging, sprites, save data.
  STAGE_NAMES: ['BABY', 'ADULT', 'ELDER', 'MUTANT'],

  // Discovery celebration (first time a species+stage is created)
  DISCOVERY: {
    ZOOM_TIME: 0.7,          // camera zoom-in duration (s)
    ZOOM_AMOUNT: 0.35,       // extra scale toward the merge point
    FLASH_TIME: 0.45,        // bright flash duration (s)
    PRE_POPUP_TIME: 2.4,     // total sequence length before popup opens (s)
    SPARKLE_RATE: 0.12,      // seconds between golden sparkle bursts
    // Flavor text per species per stage (shown on the celebration popup)
    FLAVOR: {
      chicken: [
        'A TINY PUFF OF FLUFF!',
        'CLUCKS WITH GREAT PRIDE!',
        'WISE AND SLIGHTLY WEIRD.',
        'SCIENCE WENT TOO FAR!',
      ],
      sheep: [
        'SOFT, SLEEPY AND SMALL.',
        'WOOL FOR DAYS!',
        'ANCIENT FLUFF WISDOM.',
        'THE WOOL HAS AWAKENED!',
      ],
      cow: [
        'SMALL MOO, BIG DREAMS.',
        'PRODUCES PREMIUM MOO.',
        'HORNS OF THE ANCIENTS.',
        'UDDERLY MUTATED!',
      ],
    },
  },

  // UFO alien-collection layer (end-game, see js/ufo.js).
  // Mutant + Mutant merges feed aliens to a permanently parked UFO.
  UFO: {
    INCOME_PER_ALIEN: 25,      // coins per production drop, per collected alien
    INTERVAL: 5.0,             // seconds between automatic UFO coin drops
    QUICK_COLLECT_TIME: 0.7,   // fast tractor-beam collection after landing (s)
    CINEMATIC: {               // first-abduction cinematic phase durations (s)
      SPAWN: 0.9,              // alien lifeform materializes at the merge point
      ARRIVE: 1.5,             // UFO flies in from the sky
      BEAM: 1.5,               // tractor beam pulls the alien up
      FLY: 1.6,                // UFO travels to its landing corner
      LAND: 0.7,               // touchdown settle
    },
  },

  // Farm unlock costs
  UNLOCK_COSTS: [0, 10000, 250000],

  // Animal behaviour
  WALK_SPEED_MIN: 14,
  WALK_SPEED_MAX: 26,
  IDLE_TIME_MIN: 1.2,
  IDLE_TIME_MAX: 3.4,
  WALK_TIME_MIN: 0.8,
  WALK_TIME_MAX: 2.4,
  PECK_CHANCE: 0.45,       // chance an idle becomes a peck/graze
  BLINK_INTERVAL_MIN: 2.0,
  BLINK_INTERVAL_MAX: 5.0,

  // Merge
  MERGE_RADIUS: 26,        // px distance to count as a merge drop
  MERGE_ANIM_TIME: 0.45,

  // First-time tutorial (per farm): two pre-placed babies + drag hint
  TUTORIAL: {
    GAP: 70,               // px between the two starting babies
    HAND_CYCLE: 1.8,       // seconds per drag-hint loop
  },

  // Animation durations
  UNLOCK_PATH_TIME: 2.2,
  UNLOCK_CAMERA_PAUSE: 0.8,
  COIN_COUNT_LERP: 8,      // HUD money counter easing speed

  // Audio
  MUSIC_VOLUME: 0.35,
  SFX_VOLUME: 0.8,

  // Save
  SAVE_KEY: 'farm-evolution-save-v1',
  AUTOSAVE_INTERVAL: 10,   // seconds

  // Farms
  FARMS: [
    { id: 0, name: 'FARM 1', species: 'chicken', label: 'CHICKENS' },
    { id: 1, name: 'FARM 2', species: 'sheep',   label: 'SHEEP' },
    { id: 2, name: 'FARM 3', species: 'cow',     label: 'COWS' },
  ],
};
