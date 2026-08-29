# Farm Evolution

**▶ Play now: https://fabibrl.github.io/farm-idle/**

A polished mobile-first merge/idle game prototype inspired by *Cow Evolution*, built with
vanilla JavaScript + HTML5 Canvas. Every visual asset is handcrafted pixel art generated
procedurally in code, following a single art bible (warm palette, dark warm-brown outlines,
soft two-tone shading, rounded cartoon silhouettes).

## Run it

```bash
node serve.js
```

Then open http://localhost:8471 (or use the `farm-evolution` launch config).
Any static file server works — there are no build steps and no dependencies.

## Gameplay

- **Merge**: drag two identical animals (same species + stage) together to evolve them.
  A golden ring highlights valid merge targets. Each farm has its own chain
  (`CONFIG.CHAINS`) and they can differ in length: Farm 1 runs the full seven-stage
  chicken chain — Baby → Teen → Adult → Strange → Mutant → Mutant 2 → **Final Chicken**
  (three stages of growing up, then four of an experiment going wrong) — while Farms 2
  and 3 keep their four-stage chains.
- **Economy**: every animal periodically drops a poop that transforms into a coin
  (stage 1/2/3 → 2/5/12 coins) which flies to the HUD counter.
- **Spawning**: each farm auto-spawns a baby every 3 s (capped); the **UPGRADE** button
  buys an extra baby with escalating cost.
- **Upgrades**: one row per stage, plus farm spawn speed and the final form's UFO
  drip. Every row stays hidden until that animal is discovered, then animates in.
- **UFO collection (end-game)**: merging two of a chain's last board stage creates
  its final form (Farm 1: the Final Chicken) instead of a bigger animal — the only
  animal the UFO abducts. The first one plays a full abduction cinematic and
  parks a UFO in the corner of the farm for good; later pairs are beamed up in
  under a second. Each collected alien permanently raises the UFO's passive coin
  drip (aliens x 25 coins every 5 s).
- **Progression**: unlock Farm 2 (Sheep, 10,000) and Farm 3 (Cows, 250,000) from the
  world map or the **UNLOCK** button — with a rewarding golden-path unlock animation.
- **EXIT** returns to the world map; tap any unlocked pin to switch farms.

## Architecture

| Module | File | Responsibility |
|---|---|---|
| GameManager | `js/game.js` | canvas, main loop, scenes, unlock flow, autosave |
| CONFIG | `js/config.js` | every tunable value (spawn rate, income, costs, timings) |
| PIXEL | `js/pixel.js` | pixel-art engine: surfaces, auto-outline, sprite cache, blit |
| SPRITES | `js/sprites.js` | all animals (one drawer per species, every stage of its chain × frames), props, buildings, icons |
| ENVIRONMENT | `js/environment.js` | pre-rendered farm pens + world map backgrounds |
| FarmScene | `js/farm.js` | spawn manager, merge manager, poop→coin economy, input |
| Animal | `js/animal.js` | per-animal state machine: idle/walk/peck, blink, breathe, bounce |
| MapScene | `js/map.js` | world map nodes, locks, pins, golden unlock path |
| UIManager | `js/ui.js` | bitmap pixel font, wooden panels/buttons, HUD, popups |
| VFXManager | `js/vfx.js` | pooled particles, flying coins, floating numbers, sparkles |
| AudioManager | `js/audio.js` | WebAudio-synthesized SFX, ambient birds, background tune |
| SaveManager | `js/save.js` | localStorage persistence (coins, farms, animals, settings) |

## Performance

- All sprites and backgrounds are rendered **once** into offscreen canvases and blitted.
- Particles/coins come from an object pool — no per-frame allocations once warm.
- Crisp integer pixel scaling, capped devicePixelRatio, 60 FPS target.

## Tuning

Open `js/config.js` — spawn interval, max animals, unlock costs, animation
durations, coin fly speed, walk speeds and audio volumes are all there.
`CONFIG.CHAINS` holds each species' whole merge ladder: stage names, per-poop
income, poop interval, flavor text and the upgrade cost curve. Adding, removing
or repricing a stage there is all it takes — nothing else in the codebase
assumes how long a chain is (sprites aside, which need art per stage).
