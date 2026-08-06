# Farm Evolution

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

- **Merge**: drag two identical animals (same species + stage) together to evolve them
  (Baby → Adult → Elder mutant). A golden ring highlights valid merge targets.
- **Economy**: every animal periodically drops a poop that transforms into a coin
  (stage 1/2/3 → 2/5/12 coins) which flies to the HUD counter.
- **Spawning**: each farm auto-spawns a baby every 3 s (capped); the **UPGRADE** button
  buys an extra baby with escalating cost.
- **Progression**: unlock Farm 2 (Sheep, 10,000) and Farm 3 (Cows, 250,000) from the
  world map or the **UNLOCK** button — with a rewarding golden-path unlock animation.
- **EXIT** returns to the world map; tap any unlocked pin to switch farms.

## Architecture

| Module | File | Responsibility |
|---|---|---|
| GameManager | `js/game.js` | canvas, main loop, scenes, unlock flow, autosave |
| CONFIG | `js/config.js` | every tunable value (spawn rate, income, costs, timings) |
| PIXEL | `js/pixel.js` | pixel-art engine: surfaces, auto-outline, sprite cache, blit |
| SPRITES | `js/sprites.js` | all animals (3 species × 3 stages × frames), props, buildings, icons |
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

Open `js/config.js` — spawn interval, max animals, income table, unlock costs,
animation durations, coin fly speed, walk speeds and audio volumes are all there.
