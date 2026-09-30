# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
node serve.js              # dev server on http://localhost:8471 (or the "farm-idle" launch config)
npm run build:www          # -> www/          (Capacitor web assets)
npm run build:single       # -> farm-evolution.html (whole game inlined in one file)
npm run android:sync       # build:www + npx cap sync android
npm run android:apk        # ...then gradlew assembleDebug
```

Android builds need `JAVA_HOME=/opt/homebrew/opt/openjdk@21` and `ANDROID_HOME=~/Library/Android/sdk`.
App id `io.infinitygames.farmevolution`, minSdk 24, portrait-locked. Release builds still need a real keystore.

There is **no test suite, no linter and no bundler**. The available checks are:

```bash
for f in js/*.js; do node --check "$f" || echo "FAIL $f"; done
```

...plus actually running the game (see *Verifying changes*).

## Source of truth and generated files

`js/` + `index.html` + `css/` are the only sources. Everything else is generated and must never be
hand-edited:

- `www/` — written by `scripts/build-www.js` (a straight copy)
- `farm-evolution.html` — written by `scripts/build-single.js`, which inlines every `<script src>` and
  the stylesheet **in index.html's order**
- `android/app/src/main/assets/public/` — written by `cap sync`

After changing anything under `js/`, run `npm run build:www && npm run build:single` so the three
outputs stay in step.

## Architecture

### No modules — load order is the dependency graph

Every file is an IIFE assigned to a global `const` (`CONFIG`, `Upgrades`, `FTUE`, `UI`, `Game`, ...).
There is no import system. **`index.html`'s `<script>` list is the dependency manifest**: a new file
must be added there at a point after everything it touches at load time. Cross-module calls made
*inside* functions are fine in any order, since they resolve at call time — which is how the mutually
referencing managers (Game ↔ UI ↔ FTUE ↔ Events) work.

### One virtual stage

The game renders to a fixed **360×640** logical canvas that is letterboxed to the device. Every rect,
font size and offset in the code is in those units. The Figma design file is the single source of truth
for UI values and its frames are **720×1280, exactly 2×** — divide Figma values by 2. Do not eyeball
or approximate UI geometry; extract the exact values.

### CONFIG owns every number

`js/config.js` holds all tunables — no gameplay number should be hardcoded elsewhere. Two structural
ideas matter more than the values:

- **`CONFIG.CHAINS`** is each species' whole merge ladder (stage names, per-poop income, poop interval,
  flavour, per-row upgrade curve). Chains have different lengths and **nothing outside config may assume
  one** — go through the accessors at the bottom of the file (`stageCount`, `topStage`, `entry`,
  `cratePool`, ...) rather than indexing stages directly.
- **`CONFIG.FARMS[]` flags opt a farm into a feature**, and the feature reads the flag rather than
  checking a farm id: `splitUpgrades` (house opens FARM rows, a button opens the animal chain),
  `ftue` (which upgrade FTUE flows that farm teaches, in order), `onboarding` (that farm's opening runs
  off `CONFIG.ONBOARDING` instead of the general cost curve), `maxAnimals`, `incomeMult`/`costMult`.
  `CONFIG.CRATE.ENABLED_FARMS` and `CONFIG.CONSTRUCTION[farmId]` work the same way. Adding a farm to a
  feature should be a config edit, not a code edit.

### Per-farm state, everywhere

Almost everything in the save is an array indexed by `farmId` (`animals`, `upgrades`, `ufo`, `pigeon`,
`tornado`, `crate`, `idle`, `construction`, `discovered` by species). Only one farm is "live" as a
`FarmScene` at a time; the rest accrue through `Idle`, which never simulates frames — it computes
elapsed production from a stored timestamp on demand (launch, map, farm entry, coarse tick).

### The main loop's freeze hierarchy

`js/game.js` owns the loop and decides what is allowed to update. Reading this is the fastest way to
understand how the game's interruptions compose — in priority order: UFO abduction cinematic → tornado
sweep → discovery celebration → upgrade FTUE → normal play (scene + `Events`/`Pigeon`/`Tornado`/`Crate`).
Each layer freezes everything below it, which is what guarantees two interruptions never overlap.

### Two directors decide *when* things happen

- **`js/events.js`** — the ambient reward events do not run on timers. It watches the session and
  releases the pigeon (poop rain) when the wallet is empty and the tornado (auto merge) when the pen is
  crowded, under rolling frequency caps and dismissal cooldowns stored in the save.
- **`js/ftue.js`** — the two upgrade tutorials. It derives its current step from live state every frame
  rather than storing one, so a run pauses by itself (no overlay, game unfrozen) when the player can no
  longer afford the row, and resumes when they can. Flows are strictly ordered and latched once-ever in
  `SaveManager.data.ftue`.

### Save migrations

`SaveManager.defaults()` + `migrate()` in `js/save.js`. Every schema addition needs a back-fill in
`migrate` so existing saves stay playable. **Gotcha:** `load()` does `Object.assign(defaults(), parsed)`,
so a field with a default will *always* look present to `migrate`. When migrate must distinguish
"absent" from "the default value", the field has to be forced from the parsed save in `load()` — see how
`revealSeeded` and `ftue` are passed through. Getting this wrong silently disables the back-fill.

### Rendering and input

Sprites (`js/sprites.js`) and backgrounds (`js/environment.js`) are drawn **once** into offscreen
canvases and blitted; VFX come from an object pool. The game listens to **mouse and touch events, not
pointer events**. `UI.tap()` gets first refusal on every tap, then the scene.

## Verifying changes

There is no test harness, so gameplay and balance changes are verified by driving the running game
through its globals from the browser console (`Game`, `UI`, `FTUE`, `Upgrades`, `SaveManager`,
`ENVIRONMENT`). Useful specifics:

- **Synthetic input:** dispatch `mousedown` on the canvas and `mouseup` on `window`. Convert stage
  coordinates with `canvas.getBoundingClientRect()` and `scale = rect.width / 360`.
- **Resetting the save:** stub `SaveManager.save = () => {}` *before* `localStorage.clear()` +
  `location.reload()`, or the `beforeunload` autosave rewrites the save you just cleared.
  `Game.resetAll()` works in-place without a reload.
- **Popups can be opened directly**, e.g. `UI.openPopup({type:'upgrades', farmId:0, fx:{}})` or
  `{type:'discovery', species:'chicken', stage:3, fxT:0, confetti:[]}` (an out-of-range stage crashes
  the render loop).
- **Pixel-perfect checks** against Figma: set the browser pane to a 360×640 viewport at dpr 2 so
  `canvas.width === 720`, and assert that after every reload — the viewport resets on reload.
- **Balance changes want a timed fresh-save run**, not arithmetic: the opening has a tutorial merge, a
  blocking discovery popup and a spawn ramp in it, and pacing targets are stated in seconds and animal
  counts. Sample `coins` / animal count on an interval while the game plays in real time.

## Balance note worth knowing

Each farm's pen has a hard cap (`maxAnimals`), so **a faster spawn interval is worth nothing in steady
state while a rate bonus (poop speed, coin value) is worth something forever**. Any temporary income
bonus that gets withdrawn when an upgrade is bought will make that upgrade a permanent net loss,
however large the spawn improvement next to it. `CONFIG.ONBOARDING` documents this at the point where
it bites.
