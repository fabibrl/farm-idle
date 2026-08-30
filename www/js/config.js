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
  MAX_ANIMALS: 14,         // default max simultaneous animals per farm
                           // (a farm may raise its own ceiling: FARMS[].maxAnimals)
  SPAWN_POP_TIME: 0.35,

  // ---------------- Economy ----------------
  // Poop is the primary income source. Per-animal passive rate (coins/sec)
  // = coins-per-poop / (interval + jitter/2). Every per-stage economy number
  // now lives on that stage's entry in CHAINS below — one merge chain per
  // species, each free to be as long as its farm needs. Each merge tier
  // roughly doubles per-poop value without going fully exponential, and the
  // animal cap means every merge frees a pen slot that a free spawn refills
  // — so merging always grows the idle rate, and the idle rate is never zero.
  POOP_INTERVAL: 4.0,                   // fallback seconds between poops per animal
  POOP_INTERVAL_JITTER: 2.0,     // random extra seconds
  POOP_TO_COIN_DELAY: 1.4,       // poop sits, then transforms
  COIN_FLY_SPEED: 620,           // px/sec toward HUD
  // Per-farm upgrade system (see js/upgrades.js). All values data-driven.
  //
  // Pacing targets (farm 1 baseline; later farms scale via costMult):
  //   short-term  (30-90s): early-tier levels, SPAWN level, another merge
  //   medium-term (3-8min): mid-tier levels, the next stage discovered
  //   long-term  (10-20m+): top-tier levels, farm unlock, the first abduction
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
    // Per-stage upgrade definitions now live on each stage in CHAINS (`up`).
  },

  // ---------------- Merge chains ----------------
  // One chain per species — the single source of truth for that farm's whole
  // evolution ladder: how many board stages it has, what each is called, what
  // it earns, and what its upgrade costs. Chains are independent, so a farm
  // can be deepened without touching any other farm.
  //
  //   stages[] — the animals that live in the pen. Merging two of stage i
  //              produces stage i+1; merging two of the LAST board stage
  //              produces `final` instead.
  //   final    — the abducted form: it never walks the pen. The pair that
  //              creates it is taken by the UFO on the spot (full cinematic
  //              the first time, quick beam after) and from then on it pays a
  //              passive drip. `up` gives it an upgrade row of its own; a
  //              chain that omits `up` simply has no row for it.
  //
  // Per stage:
  //   name       label in the upgrade panel / tornado popups
  //   title      discovery-popup name (defaults to "<name> <SPECIES>")
  //   income     coins per poop at level 0
  //   poop       seconds between poops at level 0
  //   flavor     discovery-popup one-liner
  //   up         { baseCost, costGrowth, maxLevel, poopStep, minPoop, coinStep }
  //              — one upgrade row; every level improves poop speed AND value.
  //
  // Cost curve: baseCost climbs by a steady ~2.6x per tier and costGrowth
  // ramps gently (1.16 -> 1.19) instead of stepping at the top, so the ladder
  // scales smoothly end to end and time-to-next-upgrade stays roughly flat.
  CHAINS: {
    // Farm 1 — the full seven-stage chicken chain: three stages of ordinary
    // growing up (baby -> teen -> adult), then four of an experiment going
    // progressively wrong (strange -> mutant -> mutant 2 -> final).
    chicken: {
      stages: [
        { name: 'BABY',     income: 2,  poop: 4.0, flavor: 'A TINY PUFF OF FLUFF!',
          up: { baseCost: 30,   costGrowth: 1.16, maxLevel: 30, poopStep: 0.2,  minPoop: 1.5, coinStep: 1 } },
        { name: 'TEEN',     income: 4,  poop: 4.0, flavor: 'ALL LEGS AND ATTITUDE!',
          up: { baseCost: 80,   costGrowth: 1.16, maxLevel: 30, poopStep: 0.2,  minPoop: 1.5, coinStep: 2 } },
        { name: 'ADULT',    income: 8,  poop: 4.0, flavor: 'CLUCKS WITH GREAT PRIDE!',
          up: { baseCost: 210,  costGrowth: 1.17, maxLevel: 30, poopStep: 0.2,  minPoop: 1.5, coinStep: 3 } },
        { name: 'STRANGE',  income: 16, poop: 3.6, flavor: 'SOMETHING IS OFF HERE...',
          up: { baseCost: 550,  costGrowth: 1.17, maxLevel: 30, poopStep: 0.2,  minPoop: 1.4, coinStep: 6 } },
        { name: 'MUTANT',   income: 32, poop: 3.2, flavor: 'SCIENCE WENT TOO FAR!',
          up: { baseCost: 1400, costGrowth: 1.18, maxLevel: 30, poopStep: 0.25, minPoop: 1.2, coinStep: 11 } },
        { name: 'MUTANT 2', income: 64, poop: 2.6, flavor: 'TWO HEADS, ZERO ANSWERS!',
          title: 'MUTANT CHICKEN 2',
          up: { baseCost: 3600, costGrowth: 1.19, maxLevel: 30, poopStep: 0.25, minPoop: 0.8, coinStep: 20 } },
      ],
      // the stage that represents this farm outside the pen (map sign, unlock
      // popup, loading screen): the ordinary adult, never a mutation
      showcase: 2,
      // Hyper mutation: the peak of the chain and the only chicken the UFO
      // abducts. Its upgrade row raises what every collected one pays.
      final: {
        name: 'FINAL', title: 'FINAL CHICKEN', flavor: 'PEAK HYPER MUTATION!',
        up: { baseCost: 9000, costGrowth: 1.20, maxLevel: 30, incomeStep: 10 },
      },
    },

    // Farms 2 and 3 keep their original four-stage chains untouched.
    sheep: {
      stages: [
        { name: 'BABY',   income: 2,  poop: 4.0, flavor: 'SOFT, SLEEPY AND SMALL.',
          up: { baseCost: 30,   costGrowth: 1.16, maxLevel: 30, poopStep: 0.2,  minPoop: 1.5, coinStep: 1 } },
        { name: 'ADULT',  income: 4,  poop: 4.0, flavor: 'WOOL FOR DAYS!',
          up: { baseCost: 120,  costGrowth: 1.17, maxLevel: 30, poopStep: 0.2,  minPoop: 1.5, coinStep: 2 } },
        { name: 'ELDER',  income: 10, poop: 4.0, flavor: 'ANCIENT FLUFF WISDOM.',
          up: { baseCost: 500,  costGrowth: 1.18, maxLevel: 30, poopStep: 0.2,  minPoop: 1.5, coinStep: 4 } },
        { name: 'MUTANT', income: 24, poop: 2.6, flavor: 'THE WOOL HAS AWAKENED!',
          up: { baseCost: 2500, costGrowth: 1.20, maxLevel: 30, poopStep: 0.25, minPoop: 0.8, coinStep: 8 } },
      ],
      showcase: 1,
      final: { name: 'MUTANT 2', title: 'MUTANT 2 SHEEP', flavor: 'ABDUCTED AND IMPROVED!' },
    },
    cow: {
      stages: [
        { name: 'BABY',   income: 2,  poop: 4.0, flavor: 'SMALL MOO, BIG DREAMS.',
          up: { baseCost: 30,   costGrowth: 1.16, maxLevel: 30, poopStep: 0.2,  minPoop: 1.5, coinStep: 1 } },
        { name: 'ADULT',  income: 4,  poop: 4.0, flavor: 'PRODUCES PREMIUM MOO.',
          up: { baseCost: 120,  costGrowth: 1.17, maxLevel: 30, poopStep: 0.2,  minPoop: 1.5, coinStep: 2 } },
        { name: 'ELDER',  income: 10, poop: 4.0, flavor: 'HORNS OF THE ANCIENTS.',
          up: { baseCost: 500,  costGrowth: 1.18, maxLevel: 30, poopStep: 0.2,  minPoop: 1.5, coinStep: 4 } },
        { name: 'MUTANT', income: 24, poop: 2.6, flavor: 'UDDERLY MUTATED!',
          up: { baseCost: 2500, costGrowth: 1.20, maxLevel: 30, poopStep: 0.25, minPoop: 0.8, coinStep: 8 } },
      ],
      showcase: 1,
      final: { name: 'MUTANT 2', title: 'MUTANT 2 COW', flavor: 'ABDUCTED AND IMPROVED!' },
    },
  },

  // Discovery celebration (first time a species+stage is created)
  DISCOVERY: {
    ZOOM_TIME: 0.7,          // camera zoom-in duration (s)
    ZOOM_AMOUNT: 0.35,       // extra scale toward the merge point
    FLASH_TIME: 0.45,        // bright flash duration (s)
    PRE_POPUP_TIME: 2.4,     // total sequence length before popup opens (s)
    SPARKLE_RATE: 0.12,      // seconds between golden sparkle bursts
    // Flavor text lives on each stage in CHAINS (see `flavor`).
  },

  // UFO final-form collection layer (end-game, see js/ufo.js).
  // Merging two of a chain's LAST board stage produces that chain's `final`
  // form (Farm 1: the Final Chicken) and feeds it straight to a permanently
  // parked UFO. Internal ALIEN key names are kept for save compatibility.
  UFO: {
    INCOME_PER_ALIEN: 25,      // coins per production drop, per collected final form
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

  // Need-based reward-event director (see js/events.js). The pigeon and the
  // tornado do not run on timers: each is released at the moment it actually
  // helps — an emptied wallet for the cash boost, a crowded pen for the
  // auto-merge — under frequency limits counted separately per feature so
  // neither can turn into spam. Every value here is a Remote Config default:
  // override at runtime via window.RemoteConfig = { EVENTS: { ... } }.
  EVENTS: {
    ENABLED: true,              // director on/off (kill switch for both events)
    LOG: true,                  // console-log every appearance and its outcome
    LOG_MAX: 30,                // appearance records kept in the save
    NEW_GAME_GRACE: 240,        // seconds of active play before any event may fire
    CONDITION_TTL: 20,          // seconds a one-shot trigger waits for a free screen

    // Frequency limits, applied independently to each feature.
    LIMITS: {
      WINDOW_MINUTES: 120,          // rolling window the cap is measured over
      MAX_PER_WINDOW: 5,            // appearances allowed inside that window
      MIN_INTERVAL_MINUTES: 12,     // minimum gap between two appearances
      DISMISS_COOLDOWN_MINUTES: 10, // added to that gap per dismissal this session
      DISMISS_SUPPRESS: 3,          // dismissals that shelve the feature for the session
    },

    // Poop rain triggers — a depleted wallet (see Events.pigeonCondition).
    PIGEON: {
      SAMPLE_INTERVAL: 0.5,   // seconds between wallet samples
      SPEND_WINDOW: 180,      // seconds the spending burst is measured over
      SPEND_FRACTION: 0.7,    // 70%+ of the wallet gone inside that window
      MIN_PEAK_COSTS: 1,      // ...off a wallet worth at least this many cheapest upgrades
      BROKE_TIME: 15,         // seconds below the cheapest upgrade before offering
      STALL_TIME: 150,        // seconds unable to afford anything = a real stall
      EMPTY_FRACTION: 0.5,    // post-purchase wallet under half the next cheapest = emptied
    },

    // Tornado triggers — a crowded pen (see Events.tornadoCondition).
    TORNADO: {
      FILL_PCT: 0.75,         // pen at 75%+ of its capacity
      MIN_PAIRS: 2,           // ...with this many merges waiting
      NEAR_CAP_SLOTS: 1,      // free slots left = spawning about to be blocked
      JUMP_WARN: 0.6,         // fence-jump pressure ratio that makes it a rescue
      MERGE_WINDOW: 300,      // seconds manual merges are counted over
      MERGE_GRIND: 6,         // manual merges in that window = real effort saved
      RETURN_AWAY: 900,       // seconds away that make a filled pen a welcome-back case
      RETURN_WINDOW: 300,     // seconds that case stays live after returning
      RETURN_FILL_PCT: 0.6,   // ...and the pen came back at least this full
    },
  },

  // Pigeon reward-ad event (see js/pigeon.js). Timing is not here: the
  // director in js/events.js decides WHEN a pigeon visits (CONFIG.EVENTS).
  // Every value here is a Remote Config default: override at runtime via
  // window.RemoteConfig = { PIGEON: { STAY_TIME: 30, ... } }.
  // Reward = REWARD_MINUTES of the farm's CURRENT passive income, split
  // across the rain — the ad scales with the player's economy forever
  // (meaningful acceleration, never mandatory, never game-breaking).
  PIGEON: {
    ENABLED: true,         // reward ad offer on/off (kill switch)
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

  // Tornado Auto Merge reward-ad event (see js/tornado.js). Timing is not
  // here: the director in js/events.js decides WHEN the offer appears — a
  // pen crowded enough that the sweep saves real work (CONFIG.EVENTS).
  // Every value here is a Remote Config default: override at runtime via
  // window.RemoteConfig = { TORNADO: { STAY_TIME: 30, ... } }.
  TORNADO: {
    ENABLED: true,         // reward ad offer on/off (kill switch)
    STAY_TIME: 60,         // seconds the icon stays available once it appears
    TRAVEL_SPEED: 1.0,     // tornado animation speed multiplier
    MERGE_INTERVAL: 0.12,  // seconds between survivors tossed back out after the merge blast
    REWARD_COOLDOWN: 0,    // extra seconds before the next offer after a claim
    AD_DURATION: 3.0,      // simulated reward-ad length (s)
  },

  // Parachute surprise box (see js/crate.js). Every COOLDOWN seconds a crate
  // drifts down under a parachute and lands on a free slot in the pen. It
  // rests there until tapped — it never expires — and tapping it opens a
  // reveal popup offering the animal inside, or (rewarded ad) the next
  // evolution up. Every value here is a Remote Config default: override at
  // runtime via window.RemoteConfig = { CRATE: { COOLDOWN: 60, ... } }.
  //
  // The contents pool is derived from the farm's own chain, never hardcoded:
  // see CONFIG.cratePool — index 0 and the last two entries of the chain
  // (board stages + the final form) are excluded, so the box can never hand
  // out a baby, and the ad upgrade can never reach the final form. On Farm
  // 1's seven-entry chicken chain that leaves TEEN, ADULT, STRANGE and
  // MUTANT, whose ad upgrade tops out at MUTANT 2. Enabling another farm is
  // one flag in ENABLED_FARMS — its pool follows from its own chain.
  CRATE: {
    ENABLED: true,               // reward event on/off (kill switch)
    ENABLED_FARMS: [true, false, false],  // per-farm opt-in, index = farm id
    COOLDOWN: 300,               // seconds between crates; the timer starts
                                 // when the previous crate is COLLECTED, so
                                 // ignoring one never queues up more
    SKIP_FIRST: 1,               // chain entries excluded from the front (the baby)
    SKIP_LAST: 2,                // ...and from the back (final form + the one below it)
    // Relative draw weights over the eligible pool, lowest tier first. Extra
    // entries are ignored; a pool longer than this list reuses the last
    // weight. Mid-tier animals are the common outcome, top-tier the rare one.
    WEIGHTS: [8, 5, 3, 2],
    DROP_TIME: 4.0,              // parachute descent duration (s)
    DROP_SWAY: 16,               // horizontal drift amplitude while falling (px)
    BOUNCE_TIME: 0.45,           // landing squash + settle (s)
    CHUTE_FADE: 0.8,             // parachute collapse/fade after touchdown (s)
    SPARKLE_RATE: 2.4,           // seconds between attention sparkles while resting
    TAP_RADIUS: 26,              // tap hit radius around the resting crate (px)
    CLEAR_RADIUS: 34,            // keep the landing spot this far from animals (px)
    RETRY_INTERVAL: 0.5,         // seconds between landing-spot retries when the pen is full
    REVEAL_TIME: 1.15,           // popup crate-burst animation before the choices appear (s)
    AD_DURATION: 3.0,            // simulated reward-ad length (s)

    // In-scene opening sequence, played after the popup closes: the crate
    // bursts open in the pen and the animal hops out of it. Non-blocking —
    // the farm keeps running and stays fully interactive throughout — and
    // its pen slot is reserved before it starts, so a spawn can never take
    // the spot out from under it. Offsets are seconds from the start.
    OPEN: {
      DURATION: 0.85,            // total sequence length after COLLECT (s)
      EVOLVE_DURATION: 1.10,     // ...after an ad: same beats, longer hold at the end
      POP: 0.12,                 // anticipation squash, then the lid lets go
      EMERGE: 0.20,              // the animal starts coming out
      LAND: 0.55,                // it touches down
      BOUNCE: 0.22,              // squash-and-stretch settle after landing
      HOP_H: 34,                 // peak of its arc above the ground (px) — low
                                 // enough that a crate resting against the
                                 // back fence still hops entirely inside the pen
      CRATE_FADE: 0.38,          // remnants shrink away over this, from POP (s)
      EVOLVE_RING: 0.45,         // expanding energy ring on an evolved landing (s)
    },
  },

  // Background / offline production (see js/idle.js). Every unlocked farm
  // keeps spawning animals and earning coins while the player is elsewhere
  // (another farm, the map, or with the game closed).
  IDLE: {
    OFFLINE_CAP_HOURS: 2,    // max hours of production applied after being away
    TICK_INTERVAL: 5,        // seconds between background reconcile ticks
    MAP_STAGGER: 0.5,        // seconds between each farm's coin-collect burst on the map
    COINS_PER_COLLECT: 5,    // max flying coins used to deliver one pending balance
    // offline spawning stops at this fraction of the farm's animal cap
    // (default; each farm can override via its offlinePenFill) so the board
    // comes back playable, never merged-locked at the 100% active-play cap
    OFFLINE_PEN_FILL: 0.65,
    // ...but never below this many animals per stage in that farm's chain:
    // a longer chain needs more raw material on the board to climb it, so
    // the floor scales with chain depth instead of with the pen (see
    // Idle.offlineFillCap). Still clamped to the farm's real capacity.
    OFFLINE_PER_STAGE: 2,
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

  // ---------------- Farm construction ----------------
  // Step-by-step build progression, keyed by farm id (see js/construction.js).
  // The system is fully data-driven: adding a farm to this map is all it takes
  // to put that farm on the staged build flow — every consumer (scene, map,
  // build panel, idle, escapes) reads its numbers, art tier and copy from
  // here. Farms without an entry keep the classic one-shot unlock, untouched.
  //   1. LAND_COST buys the plot on the map (replaces UNLOCK_COSTS for this
  //      farm) — the scene opens but the plot is bare and produces nothing.
  //   2. HOUSE_COST builds the farmhouse: this is what starts animal
  //      spawning. Without the house there are no animals at all.
  //   3. FENCE_LEVELS[0] builds the pen. Until it exists, spawned animals
  //      wander off the plot and are lost (see the ESCAPE_* values below),
  //      and the farm is excluded from background/offline production —
  //      the idle clock is stamped the moment the fence completes.
  //      Both ways of losing an animal (that walk-off and FENCE_JUMP) are
  //      exclusive to farms listed here: on every other farm animals stay
  //      contained and spawning simply stops at the capacity limit.
  //   4. Later levels upgrade the fence: a higher hard animal cap and a
  //      physically bigger pen footprint. The fence art never changes — every
  //      farm and every tier renders Farm 1's wood fence (see
  //      ENVIRONMENT.drawFence); an upgrade grows the enclosure, not its look.
  // On every construction farm, land + house + first fence together add up to
  // that farm's old UNLOCK_COSTS lump sum, so reaching an operational farm
  // costs exactly what it did before; the fence upgrades are new, optional
  // capacity growth beyond that. Every farm's final tier caps at
  // MAX_ANIMALS — the pen is a fixed physical size, so the top tier is the
  // point where a constructed farm plays exactly like a classic one, and
  // later farms scale up by *starting* more generous rather than by ending
  // higher. All values are balance-tunable.
  CONSTRUCTION: {
    1: {
      LAND_COST: 4000,
      HOUSE_COST: 3000,
      FENCE_LEVELS: [
        { cost: 5000,  capacity: 6,  size: 0.62 },
        { cost: 14000, capacity: 10, size: 0.82 },
        { cost: 40000, capacity: 14, size: 1.00 },
      ],
      // House built, no fence: animals still spawn (up to this cap) but each
      // one walks off the plot when its own escape timer runs out. The timer
      // starts at spawn and is staggered by +/- ESCAPE_VARIANCE seconds so
      // they never leave all at once. Shared leaving animation values (the
      // tell, walk speed, fade) live in CONFIG.ESCAPE.
      UNFENCED_CAPACITY: 5,
      ESCAPE_TIME: 14,        // seconds on the board before an animal leaves
      ESCAPE_VARIANCE: 5,     // +/- random seconds on that timer

      // Fence jumping — the constructed farm's second way of losing an
      // animal. Once the pen is fenced and full, spawn pressure keeps
      // building until an older animal hops the fence and is lost, so the
      // board makes room instead of hard-blocking spawns. Tier 1 (babies)
      // never jump — only MIN_STAGE and above, and the cheapest eligible
      // tier goes first, so a full pen costs the player its most redundant
      // animal, never its best.
      FENCE_JUMP: {
        ENABLED: true,
        MIN_STAGE: 1,          // stage index: 1 = tier 2 (ADULT) and above
        PRESSURE_TIME: 8,      // seconds of blocked spawns before one jumps
        VARIANCE: 3,           // +/- random seconds on that pressure timer
        COOLDOWN: 18,          // minimum seconds between jumps on this farm
        HOP_TIME: 0.95,        // arc over the fence (s)
        HOP_HEIGHT: 40,        // peak of the arc above the ground line (px)
      },
    },

    // Farm 3 (cows) — same build sequence as Farm 2, scaled to its slot in
    // the progression. Costs are 10x Farm 2's throughout, matching the 10x
    // step between the two farms' old lump-sum unlocks (12000 -> 120000), so
    // land + house + first fence still total exactly UNLOCK_COSTS[2].
    // Production scales on top of that through FARMS[2].incomeMult (12 vs
    // Farm 2's 4), so a built Farm 3 out-earns Farm 2 without needing any
    // per-farm income values here.
    2: {
      LAND_COST: 40000,
      HOUSE_COST: 30000,
      // Capacities start higher than Farm 2's (8/11 vs 6/10) and still land
      // on MAX_ANIMALS at the top tier — the pen footprint is the same
      // physical rect on every farm, so the ceiling is shared and the
      // scaling shows up as a roomier farm from the very first fence.
      FENCE_LEVELS: [
        { cost: 50000,  capacity: 8,  size: 0.70 },
        { cost: 140000, capacity: 11, size: 0.86 },
        { cost: 400000, capacity: 14, size: 1.00 },
      ],
      // Cows are slower and heavier than sheep: a bigger unfenced herd, a
      // touch longer on the board before wandering off, and a lower, slower
      // hop when one does clear the fence.
      UNFENCED_CAPACITY: 7,
      ESCAPE_TIME: 16,
      ESCAPE_VARIANCE: 5,
      FENCE_JUMP: {
        ENABLED: true,
        MIN_STAGE: 1,          // stage index: 1 = tier 2 (ADULT) and above
        PRESSURE_TIME: 9,
        VARIANCE: 3,
        COOLDOWN: 20,
        HOP_TIME: 1.05,
        HOP_HEIGHT: 34,
      },
    },
  },

  // ---------------- Leaving the farm ----------------
  // Animation values shared by both ways an animal leaves for good (see
  // js/animal.js 'escape'): the unfenced walk-off and the fence jump. Both
  // belong to the construction farms above — a farm without a CONSTRUCTION
  // entry never escapes, so nothing here is ever reached from Farm 1.
  // An animal that has started leaving is locked out of interaction — it
  // can't be picked up or matched — so the sequence opens with a readable
  // tell (startled hop + "!" + a brief opacity blink) before it sets off.
  ESCAPE: {
    TELL_MIN: 0.55,        // shortest startled beat before setting off (s)
    TELL_MAX: 1.20,        // longest
    TELL_HOPS: 2,          // startled hops during the tell
    TELL_HOP_H: 7,         // startled hop height (px)
    SPEED: 22,             // px/sec while walking out (normal walk anim)
    FADE: 0.8,             // seconds to fade out past the boundary
    // Farewell speech bubble — pops in on the same beat as the tell (so it
    // doubles as the "this one no longer responds" signal) and rides along
    // above the animal until it is gone. LINES is a plain tunable pool:
    // add, edit or reorder freely, no code change needed. Lines are drawn
    // from a reshuffled bag, so the same one never comes up twice in a row.
    LINES: ['GOODBYE!', 'BYE!', 'SO LONG!', "I'M OUT!", 'LATER!', 'ADIOS!'],
    BUBBLE: {
      POP: 0.15,           // scale-up pop-in (s)
      TEXT: 6.5,           // text size (px)
      PAD_X: 5,            // text padding inside the bubble (px)
      PAD_Y: 4,
      DX: 14,              // sideways offset from the animal (flips at edges)
      DY: 6,               // gap above the "!" tell cue
      MARGIN: 4,           // keep this far inside the view edges
      GAP: 3,              // min spacing between two bubbles
      FADE_FLOOR: 0.4,     // bubble is fully gone while the animal is still
                           // this visible (it never lingers over empty ground)
    },
  },

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
  // offlinePenFill: fraction of the farm's animal cap that offline spawning
  // may fill (per-farm balance knob; falls back to IDLE.OFFLINE_PEN_FILL).
  // maxAnimals: that farm's own pen ceiling (falls back to MAX_ANIMALS) —
  // a longer merge chain needs more raw material on the board to climb, so
  // Farm 1's six-stage chicken chain runs a roomier pen than the four-stage
  // farms; babies are the smallest sprites in the game, so the extra head-
  // count still fits the same physical pen rect.
  // themedName is the map sign's title once the plot's house is bought (the
  // moment animals start spawning there); before that the sign shows `name`.
  //
  // splitUpgrades splits the farm's upgrade menu across two entry points —
  // the farmhouse opens the FARM rows, a dedicated on-screen button opens the
  // animal chain (see CONFIG.splitUpgrades and js/upgrades.js `keyGroup`).
  // A farm without the flag keeps the single UPGRADE button holding both.
  FARMS: [
    { id: 0, name: 'FARM 1', themedName: 'CHICKEN FARM', species: 'chicken', label: 'CHICKENS', incomeMult: 1,  costMult: 1,  offlinePenFill: 0.72, maxAnimals: 18, splitUpgrades: true },
    { id: 1, name: 'FARM 2', themedName: 'SHEEP FARM',   species: 'sheep',   label: 'SHEEP',    incomeMult: 4,  costMult: 4,  offlinePenFill: 0.65 },
    { id: 2, name: 'FARM 3', themedName: 'COW FARM',     species: 'cow',     label: 'COWS',     incomeMult: 12, costMult: 12, offlinePenFill: 0.65 },
  ],
};

// ---------------- chain accessors ----------------
// Every consumer reads a species' ladder through these, so nothing outside
// this file needs to know how long any chain is.
Object.assign(CONFIG, {
  /** The whole chain definition for a species. */
  chain(species) { return CONFIG.CHAINS[species]; },
  /** Board stages only (the animals that live in the pen). */
  stages(species) { return CONFIG.CHAINS[species].stages; },
  /** How many board stages this species has (merging tops out one below). */
  stageCount(species) { return CONFIG.CHAINS[species].stages.length; },
  /** Index of the last board stage — merging two of these feeds the UFO. */
  topStage(species) { return CONFIG.CHAINS[species].stages.length - 1; },
  stage(species, i) { return CONFIG.CHAINS[species].stages[i]; },
  /** Upgrade-panel label of one board stage, e.g. 'MUTANT 2'. */
  stageName(species, i) {
    const s = CONFIG.CHAINS[species].stages[i];
    return s ? s.name : '';
  },
  /** The stage that represents a farm outside the pen (map, popups, loading). */
  showcaseStage(species) { return CONFIG.CHAINS[species].showcase ?? 1; },
  /** The abducted final form (never on the board). */
  finalStage(species) { return CONFIG.CHAINS[species].final; },
  /** Chain entry by upgrade key: a stage index, or 'et' for the final form. */
  entry(species, key) {
    return key === 'et' ? CONFIG.finalStage(species) : CONFIG.stage(species, key);
  },
  /**
   * Board stages a parachute surprise box may contain, for one species.
   *
   * The exclusion is a RULE, not a list, so it stays correct if a chain is
   * ever extended or shortened and applies automatically to any farm that
   * enables the feature. It is measured against the WHOLE chain — the board
   * stages plus the final, abducted form — and drops CRATE.SKIP_FIRST
   * entries from the front and CRATE.SKIP_LAST from the back:
   *
   *   chicken (6 board stages + final = 7): 1..4 -> TEEN, ADULT, STRANGE, MUTANT
   *   sheep / cow (4 + final = 5):          1..2 -> ADULT, ELDER
   *
   * Because the last two entries are always excluded, the highest possible
   * roll is one below the top board stage — so the ad upgrade (roll + 1) can
   * reach the top board stage at most, and NEVER the final form.
   */
  cratePool(species) {
    const len = CONFIG.stageCount(species) + 1;   // board stages + the final form
    const last = len - 1 - CONFIG.CRATE.SKIP_LAST;
    const out = [];
    for (let i = CONFIG.CRATE.SKIP_FIRST; i <= last; i++) out.push(i);
    return out;
  },
  /** This farm's hard animal cap before construction/fence limits apply. */
  farmMaxAnimals(farmId) {
    return CONFIG.FARMS[farmId].maxAnimals ?? CONFIG.MAX_ANIMALS;
  },
  /**
   * Does this farm split its upgrade entry points? House = farm upgrades,
   * dedicated button = animal upgrades. Off means one UPGRADE button holds
   * the whole menu — flip the flag in FARMS to enable it on another farm.
   */
  splitUpgrades(farmId) { return !!CONFIG.FARMS[farmId].splitUpgrades; },
});
