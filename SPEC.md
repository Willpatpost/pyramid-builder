# Pyramid Builder — Engineering Specification v0.1.0

This document is the authoritative contract for every department. Implement to contract. If reality forces a deviation, implement the closest workable match and REPORT the deviation in your completion message. Never silently change an export signature, a DOM id, or a constant another module reads.

## 1. Product

A single-page, static-hosted voxel survival game for GitHub Pages in the spirit of beta Minecraft, set in a desert. The player mines, crafts, fights mummies at night, dies, respawns — and wins by completing a solid stepped pyramid of sandstone with a 15×15 base (8 layers: 15, 13, 11, 9, 7, 5, 3, 1 — 680 sandstone blocks total). On completion the game pauses, congratulates the player extensively, and offers Share Milestone / Continue / Exit to Main Menu.

Play URL: https://willpatpost.github.io/pyramid-builder/

## 2. Hard constraints

- No build step. No network requests at runtime. No binary assets. All textures and sounds are procedural (canvas / WebAudio).
- THREE r128 UMD is vendored at `js/vendor/three.min.js`, loaded by `index.html` as a classic script BEFORE the module entry. It sets global `THREE`. Browser modules use the global; they never `import` three.
- Entry point: `<script type="module" src="js/main.js">`. All game code lives in `js/*.js` as ES modules with named exports only (no default exports anywhere).
- PURE modules — `config.js, blocks.js, world.js, physics.js, player.js, detect.js, stats.js` — must import cleanly under Node ≥ 18 with zero references to `THREE`, `window`, `document`, or any DOM/browser API. They are unit-tested headlessly in `tests/`. All other modules are browser-only.
- Style: ES2020, 2-space indent, double quotes, semicolons. No comments unless a non-obvious invariant demands one. No TODOs.
- Each department owns exactly the files listed in §8. Never create extra files, never touch another department's files, never run git. Report needed SPEC changes instead of editing them.

## 3. World, coordinates, palette

- Finite world `WX=160, WY=64, WZ=160`. A block at integer (x,y,z) occupies the unit cube [x,x+1)×[y,y+1)×[z,z+1). y is up; y=0 is the world floor. Valid: x,z ∈ [0,160), y ∈ [0,64).
- Chunks: 16×16 full-height columns. Chunk (cx,cz), cx,cz ∈ [0,10), spans x ∈ [16cx,16cx+16), z ∈ [16cz,16cz+16). `CHUNKS_X = CHUNKS_Z = 10`.
- Block ids: `0 air, 1 sand, 2 sandstone, 3 stone, 4 palm log, 5 palm leaves, 6 planks, 7 bedrock`.
- Item ids (≥100): `100 stick, 101 wooden pickaxe, 102 stone pickaxe, 103 wooden sword, 104 stone sword, 105 dates` (food).
- Terrain (seeded, deterministic per seed):
  - Dune heightmap h(x,z) ∈ [20,34] from smooth 2-octave value noise.
  - Layers top-down from h: 4 sand, then 3 sandstone, then stone, bedrock at y=0.
  - One oasis: flattened disc (radius ~13) at a seeded position; 6–9 palm trees on it (trunk 5–7 logs tall; canopy = 2 layers of leaves in a plus/diamond shape). 5 stone outcrops elsewhere breaking the sand surface. Spawn point = solid ground at the oasis edge.
- Falling sand: when a block becomes air and the block above is sand, that sand must fall. Main converts unsupported sand into a FallingSand entity; on landing it is written back with `setBlock`. Removal cascades upward through a sand column.

## 4. Module contracts

### 4.0 js/config.js — PURE — Engine

Exports every shared constant plus two RNG helpers. Exact names and values:

```
WX=160, WY=64, WZ=160, CHUNK=16, CHUNKS_X=10, CHUNKS_Z=10
BLOCK = { AIR:0, SAND:1, SANDSTONE:2, STONE:3, LOG:4, LEAVES:5, PLANKS:6, BEDROCK:7 }
ITEM  = { STICK:100, WOOD_PICK:101, STONE_PICK:102, WOOD_SWORD:103, STONE_SWORD:104, DATES:105 }
PHYS  = { GRAVITY:32, JUMP:9.2, WALK:4.3, SNEAK:1.6, REACH:5, EYE:1.62, PLAYER_W:0.6, PLAYER_H:1.8 }
DAY_SEC=480, NIGHT_SEC=300, BLEND_SEC=25
MOB   = { MAX_ALIVE:8, SPAWN_MIN:24, SPAWN_MAX:48, HP:10, SPEED:2.3, DMG:3, ATTACK_CD:1.0, AGGRO:16, DESPAWN:64 }
WINP  = { BASE:15, LAYERS:8 }   // layer i (0=bottom) is a square of side (15 - 2*i), half-width (7 - i)
MAX_STACK = 64
TOOL_DUR  = { wood:60, stone:132 }
PAGES_URL = "https://willpatpost.github.io/pyramid-builder/"
VERSION   = "0.1.0"
mulberry32(seed:int) -> ()=>float in [0,1)   // deterministic PRNG
hash2(seed:int, x:int, z:int) -> float in [0,1)  // deterministic per-coordinate hash
```

### 4.1 js/blocks.js — PURE — Engine

```
BLOCKS[id] = { name:string, solid:bool, opaque:bool, hardness:number,
               tool:"pickaxe"|null, needsTool:bool, drops:{id,count}|null }
```
- `hardness` = break time in seconds using the correct wooden tool for `needsTool` blocks, bare hands for the rest. Values: sand 0.7, leaves 0.3, log 2.2, planks 2.2, sandstone 1.5, stone 1.7, bedrock Infinity. `needsTool`: true for sandstone and stone (no drop and 3.3× slower without a pickaxe). `drops`: sand→{1,1}, sandstone→{2,1}, stone→{3,1}, log→{4,1}, leaves→ 10% chance {105,1} else null, planks→{6,1}, bedrock→null.
- `opaque` false only for air and leaves. `solid` false only for air.

```
ITEMS[id] = { name, kind:"material"|"tool"|"food",
              tool?:{ type:"pickaxe"|"sword", speedMult, dmg, dur },
              food?:{ heal } }
```
- stick: material. wooden pickaxe {type:"pickaxe", speedMult:2, dmg:2, dur:60}; stone pickaxe {speedMult:4, dmg:3, dur:132}; wooden sword {type:"sword", speedMult:1, dmg:4, dur:60}; stone sword {dmg:5, dur:132}; dates {heal:4}. Fist dmg is 1.

```
RECIPES = [ { out:{id,count}, in:[{id,count},...] }, ... ]
```
Exact list (order matters — UI shows this order):
1. 1 log → 4 planks
2. 2 planks → 4 sticks
3. 4 sand → 1 sandstone
4. 3 planks + 2 sticks → wooden pickaxe
5. 3 stone + 2 sticks → stone pickaxe
6. 2 planks + 1 stick → wooden sword
7. 2 stone + 1 stick → stone sword

```
breakTime(blockId, heldItem|null) -> seconds   // apply speedMult when held tool type matches block.tool
dropFor(blockId, heldItem|null) -> {id,count}|null   // null when needsTool unmet or no drop
canCraft(inv, recipeIndex) -> bool              // inv = Inventory-style slot array (see §4.6 shape)
applyCraft(inv, recipeIndex) -> bool            // consumes inputs, adds output, true on success
stackMax(id) -> 64 for blocks/materials/food, 1 for tools
```

### 4.2 js/world.js — PURE — Engine

```
class World {
  constructor(seed:number)
  getBlock(x,y,z) -> id       // y<0 -> BEDROCK; y>=WY or x/z out of [0,WX/WZ) -> AIR
  setBlock(x,y,z,id)          // bounds-checked no-op outside; fires onBlockChanged listeners;
                              // marks owning chunk dirty; if newId==AIR and block above is SAND,
                              // also converts that sand (and any sand column above it) to AIR while
                              // emitting for EACH removed sand a listener event with a special
                              // payload flag `fall:true` so main can spawn FallingSand entities
  onBlockChanged(cb:(x,y,z,oldId,newId,fall:boolean)=>void)
  isSolid(x,y,z) -> bool
  heightAt(x,z) -> y          // y of first air above topmost solid; spawn/mob placement uses it
  findSpawn() -> {x,y,z}      // feet position on solid ground at the oasis edge (seeded, deterministic)
  isChunkDirty(cx,cz) / clearChunkDirty(cx,cz)
  seed:number (readonly property)
}
```
- Storage: one `Uint8Array(WX*WY*WZ)`, index `idx = (x*WZ + z)*WY + y`.
- The sand-fall cascade in `setBlock` removes the unsupported sand column from the array immediately (so the world is never in an impossible state) and reports each removal through the listener with `fall:true`; main is responsible for spawning the visual entities.
- Terrain generation runs lazily in the constructor (synchronously is fine; ~1.6M cells must fill in under ~2s — use typed arrays and no per-cell allocations).

### 4.3 js/textures.js — BROWSER — Engine

```
makeAtlas() -> { texture:THREE.CanvasTexture, uv(blockId, face) -> [u0,v0,u1,v1] }
```
- 128×128 canvas, 16px tiles, `NearestFilter` for both filters, `generateMipmaps=false`.
- Tile assignments (index into an 8×8 grid): 0 sand, 1 sandstone side, 2 sandstone top, 3 stone, 4 log side, 5 log top, 6 leaves, 7 planks, 8 bedrock. `face` ∈ "top"|"side"|"bottom" (bottom uses the side tile except log/sandstone which use top).
- Procedural 16×16 pixel art per tile, seeded speckle so it looks hand-pixelled, not flat noise. Sandstone side gets subtle horizontal banding (beta sandstone feel); leaves get hole-y dithering with some transparency (alpha 0 in ~15% of pixels).

```
itemIconURL(itemId) -> dataURL string   // 32×32 PNG: block items render their side tile scaled 2×;
                                        // stick/pickaxes/swords/dates get simple hand-drawn pixel art
```

### 4.4 js/meshing.js — BROWSER — Engine

```
makeChunkMaterial(atlas) -> THREE.MeshLambertMaterial   // { map: atlas.texture, vertexColors: true }
buildChunkGeometry(world, cx, cz, atlas) -> THREE.BufferGeometry|null
```
- One geometry per chunk: attributes `position` (Float32), `normal`, `uv`, `color` (Float32 RGB). Indexed or non-indexed — implementer's choice.
- Emit a face only when the neighbor cell is air or non-opaque (leaves), except leaf-vs-leaf faces are skipped.
- Per-face vertex shade baked into `color`: top 1.0, bottom 0.55, ±x 0.75, ±z 0.85.
- Geometry vertices are in chunk-local coordinates (block world pos minus chunk origin); main positions the mesh at the chunk origin.
- Return null for an all-air chunk. Must tolerate being called for any chunk at any time after edits. Target: build one chunk in < 30ms on this box.

### 4.5 js/physics.js — PURE — Gameplay

```
raycastVoxel(world, ox,oy,oz, dx,dy,dz, maxDist)
  -> null | { x,y,z, nx,ny,nz, px,py,pz }
```
- DDA voxel traversal (Amanatides & Woo). (x,y,z) = hit block; (nx,ny,nz) = face normal pointing back toward the ray origin; (px,py,pz) = hit point. Skips non-solid blocks (can still hit leaves — they are solid).

```
class Body { constructor(x,y,z,w,h) }   // position = feet center; AABB is
                                        // [x-w/2,x+w/2]×[y,y+h]×[z-w/2,z+w/2]; fields x,y,z mutable
moveBody(world, body, vx,vy,vz, dt) -> { onGround:bool, hitX:bool, hitY:bool, hitZ:bool,
                                         fell:number }
```
- Axis-separated sweep (x, then z, then y) against `world.isSolid`, sub-stepped so no block is tunnelled at max speed (velocity is < 20/s; dt ≤ 0.05; use 0.5-block sub-steps to be safe).
- `fell` = vertical distance fallen since last grounded, reported once on the frame the body lands (0 otherwise). Caller applies fall damage. When `hitY` and vy<0 the body rests on ground (onGround true, vy=0).
- Also clamps bodies to the world border: x,z stay within [0.5, WX-0.5].

```
fallDamage(fell:number) -> int   // Math.max(0, Math.floor(fell - 3)), capped at 15
bodyIntersectsBlock(body, x,y,z) -> bool   // used to forbid placing a block inside the player
```

### 4.6 js/player.js — PURE — Gameplay

```
class Inventory {
  slots: Array(36) of null|{ id:number, count:number, dur?:number }   // 0–8 = hotbar
  selected:number   // 0–8
  add(id, count, dur?) -> leftover:number   // stacks to stackMax(id); tools always occupy own slot
  removeSelected(1) / count(id) / held() -> slot|null
  consume(id, count) -> bool
}
class Player {
  hp:number = 20, maxHp = 20, dead:boolean = false
  inv = new Inventory()
  damage(n, cause:string) -> boolean   // returns true if this damage killed; sets dead, hp=0
  heal(n)
  eat() -> boolean                     // held item must be food: consume 1, heal, true
  respawn(pos:{x,y,z})                 // hp reset, dead=false; inventory clearing happens in main
  heldItem() -> slot|null
  damageHeld()                         // decrement tool dur by 1; remove at 0
}
```

### 4.7 js/controls.js — BROWSER — Gameplay

```
class Controls {
  constructor(canvas)
  lock() / unlock() / isLocked()
  yaw:number, pitch:number            // updated by mousemove while locked; pitch clamped to ±89°
  keys:Set<string>                    // 'w','a','s','d','space','shift'
  mouseLeft:boolean, mouseRight:boolean   // held state
  on(cb:(e:{type, i?})=>void)          // events: {type:'select',i} (wheel or digit keys 1–9),
                                        // {type:'use'} (right click), {type:'attack'} (left click),
                                        // {type:'inventory'} (E key), {type:'pause'} (pointerlock lost / Esc)
  dispose()
}
```
- Pointer lock on the canvas; when lock is lost, emit `pause` exactly once. Right click must call `preventDefault` (no context menu). The game canvas is the only lock target.

### 4.8 js/mobs.js — BROWSER — Gameplay

```
class Mobs {
  constructor(scene, world, dayNight)   // dayNight supplies isNight()
  update(dt, playerPos:{x,y,z}, damagePlayer:(n:number)=>void)
  attackAt(origin:{x,y,z}, dir:{x,y,z}, reach:number, dmg:number) -> boolean
    // ray-vs-AABB test against every live mummy; nearest within reach takes dmg + knockback
    // (dir*6 horizontal, +4 vertical), red flash, hp<=0 -> death drop + removal; returns true if any hit
  onDrop(cb:(id,count,x,y,z)=>void)     // mummies drop 0–2 sand
  aliveCount() / clear()
}
```
- Mummy mesh: THREE.Group of textured boxes (head, body, 2 arms, 2 legs; ~1.8 blocks tall), procedural bandage canvas texture, arms/legs swing while moving, red emissive flash on hit. Faces the movement direction.
- Spawn: only while `dayNight.isNight()`, `aliveCount() < MOB.MAX_ALIVE`, at a random surface point whose horizontal distance to the player is within [MOB.SPAWN_MIN, MOB.SPAWN_MAX], on sand or stone ground, at least 3 air above. One attempt per second max.
- AI per tick: distance < MOB.AGGRO → steer toward player at MOB.SPEED (jump when horizontally blocked and onGround, vel.y = PHYS.JUMP*0.8); otherwise wander (heading changes every few seconds, half speed). Attack when within 1.3 blocks and ATTACK_CD elapsed → `damagePlayer(MOB.DMG)`.
- Movement uses `physics.moveBody` with a 0.6×1.8 Body. Despawn: distance > MOB.DESPAWN, or at dawn (sink 1.5s then remove).

### 4.9 js/entities.js — BROWSER — Gameplay

```
class Entities {
  constructor(scene, world)
  spawnItem(id, count, x,y,z, dur?)       // block items: 0.25 cube with atlas tile; other items:
                                          // 0.4 plane with itemIconURL texture; small random toss velocity
  spawnFallingSand(x,y,z)                 // full-size sand cube, falls with gravity via moveBody,
                                          // on rest writes world.setBlock(floor(x),floor(y),floor(z), SAND)
  update(dt, playerPos)                   // gravity, ground rest, bob+rotate, magnet pickup within 1.4
  onPickup(cb:(id,count,dur)=>void)       // main adds to inventory + plays sound
  clear()
}
```
- Item entities despawn after 300s. FallingSand that cannot rest (lands on an entity-occupied cell — rare) just writes its block at the first solid-below cell.

### 4.10 js/daynight.js — BROWSER — Gameplay

```
class DayNight {
  constructor(scene)   // sun DirectionalLight + ambient + sun/moon sprite planes + THREE.Points stars
  update(dt, playerPos)
  isNight() -> boolean     // true during night phase and past 50% of dusk blend
  phase01() -> number      // 0..1 across full cycle, for the HUD dial
  reset()
}
```
- Cycle: DAY_SEC day → BLEND_SEC dusk → NIGHT_SEC night → BLEND_SEC dawn, looping. Lerp directional intensity 0.9↔0.12, ambient 0.65↔0.18, scene.background & fog color `#87ceeb` ↔ `#0a0e1a` through dusk/dawn orange `#e8955c`, stars fade in at night. Sun/moon orbit the player at radius ~90. `scene.fog = new THREE.Fog(color, 40, 140)` managed by this module.

### 4.11 js/detect.js — PURE — Systems

```
checkPyramid(world, x, y, z) -> null | { cx:number, cy:number, cz:number }
verifyPyramid(world, cx, y0, cz) -> boolean
```
- Called by main immediately after the player places a sandstone block at (x,y,z). If that block completes a valid pyramid, return its base center. Layer i (0=bottom, 7=apex) is the square of half-width (7-i) centered (cx,cz) at height y0+i; EVERY cell of every layer must be sandstone. verifyPyramid checks top-down (apex first) and early-exits on the first wrong cell.
- Candidate enumeration: the placed block sits in layer L ∈ [0,7]; try cx ∈ [x-(7-L), x+(7-L)], cz ∈ [z-(7-L), z+(7-L)], y0 = y-L; skip candidates whose pyramid would exit world bounds. Return the first verified one.

### 4.12 js/stats.js — PURE — Systems

```
class Stats {
  track(ev:string, n=1)    // 'mine','place','sandstone_place','craft','death','mummy_kill'
  tick(dt)
  report() -> { seconds, mined, placed, sandstonePlaced, crafts, deaths, mummyKills }
  static fmtTime(s) -> "MM:SS" or "H:MM:SS"
}
```

### 4.13 js/ui.js — BROWSER — Presentation

```
class UI {
  constructor(handlers)   // { onPlay(seed), onHowTo, onHowToBack, onResume, onExitToMenu,
                          //   onRespawn, onCraft(recipeIndex), onMuteToggle }
  showScreen("main"|"howto"|"pause"|"dead"|"win"|null)
  setHUDVisible(bool)
  setHP(hp)               // 10 hearts, supports half hearts
  renderHotbar(inv)       // 9 slots: icon image, count, durability bar, selected outline
  renderInventory(inv)    // 27 grid + hotbar mirror + crafting list with craftable/enabled state
  toggleInventory() -> boolean   // returns new visibility
  toast(msg, ms=2500)
  setDial(phase01, isNight)
  damageFlash()           // brief red vignette pulse
  setVersion(v)
}
```
- Binds every DOM id in §5. Screens are exclusive. All buttons play the UI click via a `sfx` instance main passes in — no, keep ui.js sound-free: main wires button clicks to `sfx` itself where needed; ui.js only manipulates DOM.
- Crafting rows show output icon/name, required inputs, and are disabled (`disabled` class) when uncraftable.

### 4.14 js/win.js — BROWSER — Presentation

```
runWinSequence({ statsReport, sfx, handlers:{ onShare, onContinue, onExit } }) -> winHandle
winHandle.stop()          // clears timers + confetti; main calls on Continue/Exit before switching state
```
- Shows `#screen-win`. Sequence: fanfare (`sfx.play('win')`) → typewriter reveals ≥6 lines of escalating gold congratulations (20–35 words total, playful, Egyptian-flavored) → stats table (time, sandstone placed, blocks mined, mummies defeated, deaths) → confetti canvas animation (200 particles, gold/sand/white, gravity, 12s) → buttons enabled.
- Share: `navigator.share({ title:"Pyramid Builder Milestone", text, url:PAGES_URL })` with `text` built from the stats report; fallback `navigator.clipboard.writeText(text + " " + PAGES_URL)` then a toast "Copied to clipboard!". Always resolves `onShare` after attempting (main only logs).

### 4.15 js/sound.js — BROWSER — Presentation

```
class SFX {
  play(name)   // 'dig','break','place','hurt','mobhurt','mobdie','die','pickup','eat','craft','click','win'
  get/set muted
}
```
- WebAudio only, no assets. AudioContext created lazily on first play (autoplay policy). Short synth envelopes: filtered noise for dig/break, click transients for place/click/craft, square-wave stings for hurt/die, low sawtooth wobble for mummy, pop for pickup, arpeggio fanfare (~2.5s) for win. Master gain 0.3.

### 4.16 css/style.css — Presentation

Full styling: pixel-game aesthetic (system font stack, `image-rendering: pixelated` on icons), full-viewport canvas, HUD layout (hearts top-left above hotbar bottom-center, crosshair center, dial top-right), all `.screen` overlays (dark translucent backdrop, centered panels), main-menu title treatment (large gold "PYRAMID BUILDER" with sandstone-colored subtitle), win screen gold theme, inventory panel, toasts bottom-center, damage vignette, responsive down to 1024px wide. No external fonts, no images — CSS only.

## 5. DOM contract (index.html — written by head, immutable)

ids: `game-canvas, hud, crosshair, hearts, hotbar, dial, dial-indicator, held-label, vignette, toast-container, panel-inventory, inv-grid, inv-hotbar, craft-list, btn-inv-close, screen-main, logo-title, logo-sub, seed-input, btn-play, btn-howto, version-footer, screen-howto, howto-content, btn-howto-back, screen-pause, btn-resume, btn-pause-howto, btn-exit-menu, screen-dead, death-msg, btn-respawn, btn-death-menu, screen-win, confetti, win-title, win-congrats, win-stats, btn-share, btn-continue, btn-exit-win`.

Hotbar slots: `#hotbar` contains 9 `.hb-slot`, each with `.hb-icon` (img), `.hb-count`, `.hb-dur > .hb-dur-fill`. Inventory grid: 27 `.inv-slot` in `#inv-grid`, 9 more in `#inv-hotbar`. Crafting rows in `#craft-list`: `.craft-row` per recipe with `.craft-icon`, `.craft-name`, `.craft-needs`, `button.craft-btn[data-recipe]`.

Screens use class `screen` and are hidden unless `.active`. `#hud` and `#panel-inventory` hidden by default.

## 6. main.js wiring (owned by head — departments read for context)

- States: MENU → PLAYING ⇄ PAUSED / INVENTORY / DEAD / WIN. THREE scene, PerspectiveCamera (fov 75), WebGLRenderer on `#game-canvas`.
- Play: `new World(seed || Date.now()%1e9)`, build all chunk meshes, `Player` at `world.findSpawn()`, Controls lock, DayNight reset, Stats reset.
- Loop (rAF, dt clamped 0.05): if PLAYING — input→velocity (yaw-relative), gravity, `moveBody`, fall damage on land, mining hold (breakTime progress on targeted block, selection wireframe), controls events (attack → mobs.attackAt with held dmg; use → place block / eat; select), daynight/mobs/entities update, remesh dirty chunks, HUD sync, render. Sandstone placement → `stats.track('sandstone_place')` + `detect.checkPyramid` → WIN.
- WIN: freeze loop updates, `runWinSequence`, Continue → PLAYING, Exit → MENU (dispose world state).
- DEAD: drop inventory via entities, overlay; Respawn → `player.respawn(world.findSpawn())`.
- Sand-fall listener from world → `entities.spawnFallingSand` per event.
- Debug handle: `window.__PB = { VERSION, state getters, world, player, mobs, entities, detect, forceWin() }` (forceWin builds a test pyramid 3 blocks in front of the player — used by browser smoke tests).
- On window resize: renderer + camera aspect update.

## 7. Acceptance criteria

1. `node --check` passes on every `js/*.js`.
2. Pure modules import cleanly under `node -e "import('...')"`; `tests/*.test.mjs` (QA) pass under `node --test`/plain node: detect (valid pyramid detected; wrong apex block, missing base corner, 13-wide pyramid all rejected), world (determinism, roundtrip, dirty flags, sand-fall events, bounds), blocks (recipes, breakTime, drops), player (damage/heal/eat/death, inventory stacking + durability), physics (raycast faces, moveBody ground/wall, fallDamage).
3. Browser smoke (headless where possible): zero console errors from load through menu → play → 10s of loop; `__PB.forceWin()` shows the win screen; screenshots of menu and win captured.
4. Game is completable by a player: mine sand/stone/sandstone, craft, survive a night, place 680 sandstone, get the win sequence with working Share/Continue/Exit.

## 8. Department file ownership

| Department | Files |
| --- | --- |
| Engine (lead + 2 workers) | js/config.js, js/blocks.js, js/world.js, js/textures.js, js/meshing.js |
| Gameplay (lead + 2 workers) | js/physics.js, js/controls.js, js/player.js, js/mobs.js, js/entities.js, js/daynight.js |
| Presentation (lead + 3 workers) | js/ui.js, js/win.js, js/sound.js, css/style.css |
| Systems (lead + 1 worker) | js/detect.js, js/stats.js |
| Head (CEO) | index.html, js/main.js, README.md, SPEC.md, git, deploy, integration, tests/ harness |
