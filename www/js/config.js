/**
 * CONFIG — every tunable value in the game lives here.
 * No gameplay numbers should be hardcoded elsewhere.
 */
const CONFIG = {
  // Virtual resolution (portrait, mobile). Canvas scales to fit screen.
  VIEW_W: 360,
  VIEW_H: 640,
  PIXEL_SCALE: 2,          // native art pixels -> screen pixels multiplier baseline
  ANIMAL_VISUAL_SCALE: 1.7, // animals render ~15% smaller than props (visual only;
                            // hit/merge radii still use PIXEL_SCALE)

  // Spawning
  SPAWN_INTERVAL: 3.0,     // seconds between automatic baby spawns
  MAX_ANIMALS: 14,         // maximum simultaneous animals per farm
  SPAWN_POP_TIME: 0.35,

  // ---------------- Economy ----------------
  // Poop is the primary income source. Per-animal passive rate (coins/sec)
  // = coins-per-poop / (interval + jitter/2):
  //   BABY 2/5s = 0.4    ADULT 4/5s = 0.8    ELDER 10/5s = 2.0    MUTANT 24/3.6s = 6.7
  // Each merge tier roughly doubles per-poop value without going fully
  // exponential (x2, x2.5, x2.4), and the animal cap means every merge
  // frees a pen slot that a free spawn refills — so merging always grows
  // the idle rate, and the idle rate is never zero.
  INCOME_BY_STAGE: [2, 4, 10, 24],      // coins per poop for stage 1/2/3/4
  POOP_INTERVAL: 4.0,                   // default seconds between poops per animal
  POOP_INTERVAL_BY_STAGE: [4.0, 4.0, 4.0, 2.6],  // per-stage base poop interval (mutant poops fastest)
  POOP_INTERVAL_JITTER: 2.0,     // random extra seconds
  POOP_TO_COIN_DELAY: 1.4,       // poop sits, then transforms
  COIN_FLY_SPEED: 620,           // px/sec toward HUD
  // Per-farm upgrade system (see js/upgrades.js). All values data-driven.
  //
  // Pacing targets (farm 1 baseline; later farms scale via costMult):
  //   short-term  (30-90s): BABY level, SPAWN level, another merge
  //   medium-term (3-8min): ADULT/ELDER levels, first ELDER, first MUTANT
  //   long-term  (10-20m+): MUTANT levels, farm unlock, first alien
  // Each tier has its own cost growth (no single global curve): cheap tiers
  // grow slowest so there is always a small purchase within reach, while
  // rising income keeps time-to-next-upgrade roughly flat instead of
  // walling. Every level adds a visible +coinStep per poop.
  UPGRADES: {
    COST_GROWTH: 1.18,           // fallback cost multiplier per level
    FARM: {
      SPAWN: {
        label: 'SPAWN SPEED',
        baseCost: 100,
        costGrowth: 1.3,         // strong effect (more animals = more merges), few levels
        maxLevel: 10,            // levels until minInterval is reached
        intervalStep: 0.2,       // seconds removed from spawn interval per level
        minInterval: 1.0,        // spawn interval floor
      },
    },
    // One entry per evolution stage; each level improves poop speed AND coin value.
    STAGES: [
      { label: 'BABY',   baseCost: 30,   costGrowth: 1.16, maxLevel: 30, poopStep: 0.2,  minPoop: 1.5, coinStep: 1 },
      { label: 'ADULT',  baseCost: 120,  costGrowth: 1.17, maxLevel: 30, poopStep: 0.2,  minPoop: 1.5, coinStep: 2 },
      { label: 'ELDER',  baseCost: 500,  costGrowth: 1.18, maxLevel: 30, poopStep: 0.2,  minPoop: 1.5, coinStep: 4 },
      { label: 'MUTANT', baseCost: 2500, costGrowth: 1.20, maxLevel: 30, poopStep: 0.25, minPoop: 0.8, coinStep: 8 },
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

  // UFO Mutant 2 collection layer (end-game, see js/ufo.js).
  // Mutant + Mutant merges feed MUTANT 2s (each farm's final, fully
  // mutated animal form) to a permanently parked UFO. Internal ALIEN key
  // names are kept for save compatibility.
  UFO: {
    INCOME_PER_ALIEN: 25,      // coins per production drop, per collected Mutant 2
    INTERVAL: 5.0,             // seconds between automatic UFO coin drops
    QUICK_COLLECT_TIME: 0.7,   // fast tractor-beam collection after landing (s)
    CINEMATIC: {               // first-abduction cinematic phase durations (s)
      SPAWN: 0.9,              // Mutant 2 materializes at the merge point
      ARRIVE: 1.5,             // UFO flies in from the sky
      BEAM: 1.5,               // tractor beam pulls the Mutant 2 up
      FLY: 1.6,                // UFO travels to its landing corner
      LAND: 0.7,               // touchdown settle
    },
  },

  // Pigeon reward-ad event (see js/pigeon.js). Every value here is a
  // Remote Config default: override at runtime via
  // window.RemoteConfig = { PIGEON: { SPAWN_INTERVAL: 30, ... } }.
  // Reward = REWARD_MINUTES of the farm's CURRENT passive income, split
  // across the rain — the ad scales with the player's economy forever
  // (meaningful acceleration, never mandatory, never game-breaking).
  PIGEON: {
    ENABLED: true,         // reward ad offer on/off (kill switch)
    SPAWN_INTERVAL: 75,    // seconds between pigeon visits (offers stay occasional)
    STAY_TIME: 120,        // seconds the pigeon waits on the fence
    FLY_TIME: 2.6,         // fly-across-and-land duration (s)
    LEAVE_TIME: 1.6,       // fly-away duration when ignored (s)
    POOP_COUNT: 10,        // poops per Poop Rain
    COIN_PER_POOP: 0,      // 0 = auto: income-based (see REWARD_MINUTES); >0 = fixed override
    REWARD_MINUTES: 4,     // rain total = this many minutes of current passive income
    MIN_PER_POOP: 5,       // reward floor per poop (fresh-farm early game)
    RAIN_DURATION: 3.5,    // seconds over which the poops spawn
    REWARD_COOLDOWN: 0,    // extra seconds before the next visit after a claim
    AD_DURATION: 3.0,      // simulated reward-ad length (s)
  },

  // Tornado Auto Merge reward-ad event (see js/tornado.js). Every value
  // here is a Remote Config default: override at runtime via
  // window.RemoteConfig = { TORNADO: { SPAWN_INTERVAL: 30, ... } }.
  // The offer waits for a moment where it saves real work: it only appears
  // once the countdown has elapsed AND the pen is crowded with several
  // merges pending ("here's a boost if you want it", never a nag).
  TORNADO: {
    ENABLED: true,         // reward ad offer on/off (kill switch)
    SPAWN_INTERVAL: 150,   // seconds between tornado offers (minimum)
    STAY_TIME: 60,         // seconds the icon stays available once it appears
    MIN_ANIMALS: 8,        // pen crowding required before the offer appears
    MIN_PAIRS: 2,          // pending merge pairs required before the offer appears
    TRAVEL_SPEED: 1.0,     // tornado animation speed multiplier
    MERGE_INTERVAL: 0.12,  // seconds between survivors tossed back out after the merge blast
    REWARD_COOLDOWN: 0,    // extra seconds before the next offer after a claim
    AD_DURATION: 3.0,      // simulated reward-ad length (s)
  },

  // Background / offline production (see js/idle.js). Every unlocked farm
  // keeps spawning animals and earning coins while the player is elsewhere
  // (another farm, the map, or with the game closed).
  IDLE: {
    OFFLINE_CAP_HOURS: 2,    // max hours of production applied after being away
    TICK_INTERVAL: 5,        // seconds between background reconcile ticks
    MAP_STAGGER: 0.5,        // seconds between each farm's coin-collect burst on the map
    COINS_PER_COLLECT: 5,    // max flying coins used to deliver one pending balance
    // offline spawning stops at this fraction of MAX_ANIMALS (default; each
    // farm can override via its offlinePenFill) so the board comes back
    // playable, never merged-locked at the 100% active-play cap
    OFFLINE_PEN_FILL: 0.65,
    // welcome-back popup: summarizes offline earnings on launch with an
    // optional rewarded-ad 2x. Only shown after a real absence so quick
    // app switches don't trigger it.
    WELCOME_MIN_AWAY: 60,      // seconds away required before the popup shows
    WELCOME_AD_DURATION: 3.0,  // simulated reward-ad length (s)
  },

  // Farm unlock costs — the long-term goals. Tuned to ~15-25 min of the
  // previous farm's mature income (goal windows stretch as the player
  // progresses, but never wall).
  UNLOCK_COSTS: [0, 12000, 120000],

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

  // Farms. Dynamic balance: each farm scales the whole economy up —
  // incomeMult multiplies every coin payout (poops, aliens) and costMult
  // multiplies every upgrade cost, so the curve keeps its early-game shape
  // while numbers, goals and ad rewards grow with the player.
  // offlinePenFill: fraction of MAX_ANIMALS that offline spawning may fill
  // (per-farm balance knob; falls back to IDLE.OFFLINE_PEN_FILL if omitted).
  FARMS: [
    { id: 0, name: 'FARM 1', species: 'chicken', label: 'CHICKENS', incomeMult: 1,  costMult: 1,  offlinePenFill: 0.65 },
    { id: 1, name: 'FARM 2', species: 'sheep',   label: 'SHEEP',    incomeMult: 4,  costMult: 4,  offlinePenFill: 0.65 },
    { id: 2, name: 'FARM 3', species: 'cow',     label: 'COWS',     incomeMult: 12, costMult: 12, offlinePenFill: 0.65 },
  ],
};
