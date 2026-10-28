import { WX, WY, WZ, CHUNK, CHUNKS_X, CHUNKS_Z, BLOCK, ITEM, PHYS, MOB, WINP, VERSION, PAGES_URL } from "./config.js";
import { BLOCKS, ITEMS, RECIPES, breakTime, dropFor, canCraft, applyCraft, stackMax } from "./blocks.js";
import { World } from "./world.js";
import { makeAtlas, itemIconURL } from "./textures.js";
import { makeChunkMaterial, buildChunkGeometry } from "./meshing.js";
import { raycastVoxel, Body, moveBody, fallDamage, bodyIntersectsBlock } from "./physics.js";
import { Controls } from "./controls.js";
import { Player } from "./player.js";
import { Mobs } from "./mobs.js";
import { Entities } from "./entities.js";
import { DayNight } from "./daynight.js";
import { checkPyramid } from "./detect.js";
import { Stats } from "./stats.js";
import { UI } from "./ui.js";
import { runWinSequence } from "./win.js";
import { SFX } from "./sound.js";

const S = { MENU: 0, PLAYING: 1, PAUSED: 2, INVENTORY: 3, DEAD: 4, WIN: 5 };
let state = S.MENU;
let howtoFrom = S.MENU;

const canvas = document.getElementById("game-canvas");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
camera.rotation.order = "YXZ";

let scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0e1a);

const menuGroup = new THREE.Group();
{
  const amb = new THREE.AmbientLight(0xffffff, 0.5);
  const dir = new THREE.DirectionalLight(0xffe9b0, 0.8);
  dir.position.set(30, 50, 20);
  const total = 9 * 9 + 7 * 7 + 5 * 5 + 3 * 3 + 1;
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mat = new THREE.MeshLambertMaterial({ color: 0xd8b871 });
  const inst = new THREE.InstancedMesh(geo, mat, total);
  const m = new THREE.Matrix4();
  let n = 0;
  for (let i = 0; i < 5; i++) {
    const h = 4 - i;
    for (let dx = -h; dx <= h; dx++) {
      for (let dz = -h; dz <= h; dz++) {
        m.setPosition(dx, i + 0.5, dz);
        inst.setMatrixAt(n++, m);
      }
    }
  }
  menuGroup.add(amb, dir, inst);
  menuGroup.position.set(0, -2, 0);
  scene.add(menuGroup);
}
camera.position.set(14, 10, 14);
camera.lookAt(0, 2, 0);

const sfx = new SFX();
const stats = new Stats();
const atlas = makeAtlas();
const chunkMaterial = makeChunkMaterial(atlas);

const selectionBox = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x000000 })
);
selectionBox.visible = false;
const breakOverlay = new THREE.Mesh(
  new THREE.BoxGeometry(1.01, 1.01, 1.01),
  new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0 })
);
breakOverlay.visible = false;

let world = null;
let player = null;
let body = null;
let vy = 0;
let mobs = null;
let entities = null;
let dayNight = null;
let chunkMeshes = new Map();
let controls = null;
let won = false;
let winHandle = null;
let mineTarget = null;
let mineProgress = 0;
let digSoundT = 0;
let dialT = 0;

function chunkKey(cx, cz) {
  return cx * CHUNKS_Z + cz;
}

function markSelection(hit) {
  if (!hit) {
    selectionBox.visible = false;
    breakOverlay.visible = false;
    mineTarget = null;
    mineProgress = 0;
    return;
  }
  selectionBox.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
  selectionBox.visible = true;
  breakOverlay.position.copy(selectionBox.position);
}

function lookDir() {
  const v = new THREE.Vector3();
  camera.getWorldDirection(v);
  return v;
}

function lookOrigin() {
  return { x: camera.position.x, y: camera.position.y, z: camera.position.z };
}

function currentHit() {
  if (!world || state !== S.PLAYING || !controls || !controls.isLocked()) return null;
  const o = lookOrigin();
  const d = lookDir();
  return raycastVoxel(world, o.x, o.y, o.z, d.x, d.y, d.z, PHYS.REACH);
}

function buildAllChunks() {
  const t0 = performance.now();
  for (let cx = 0; cx < CHUNKS_X; cx++) {
    for (let cz = 0; cz < CHUNKS_Z; cz++) {
      rebuildChunk(cx, cz);
      world.clearChunkDirty(cx, cz);
    }
  }
  return performance.now() - t0;
}

function rebuildChunk(cx, cz) {
  const key = chunkKey(cx, cz);
  const geo = buildChunkGeometry(world, cx, cz, atlas);
  let mesh = chunkMeshes.get(key);
  if (!geo) {
    if (mesh) {
      scene.remove(mesh);
      chunkMeshes.delete(key);
    }
    return;
  }
  if (mesh) {
    mesh.geometry.dispose();
    mesh.geometry = geo;
  } else {
    mesh = new THREE.Mesh(geo, chunkMaterial);
    mesh.position.set(cx * CHUNK, 0, cz * CHUNK);
    scene.add(mesh);
    chunkMeshes.set(key, mesh);
  }
}

function remeshDirty() {
  for (let cx = 0; cx < CHUNKS_X; cx++) {
    for (let cz = 0; cz < CHUNKS_Z; cz++) {
      if (world.isChunkDirty(cx, cz)) {
        rebuildChunk(cx, cz);
        world.clearChunkDirty(cx, cz);
      }
    }
  }
}

function teardownGame() {
  if (mobs) mobs.clear();
  if (entities) entities.clear();
  chunkMeshes.forEach((mesh) => {
    mesh.geometry.dispose();
  });
  chunkMeshes = new Map();
  world = null;
  player = null;
  body = null;
  mobs = null;
  entities = null;
  dayNight = null;
  won = false;
  if (winHandle) {
    winHandle.stop();
    winHandle = null;
  }
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e1a);
  scene.add(menuGroup);
  camera.position.set(14, 10, 14);
  camera.lookAt(0, 2, 0);
  markSelection(null);
}

function startGame(seed) {
  teardownGame();
  world = new World(seed);
  player = new Player();
  dayNight = new DayNight(scene);
  mobs = new Mobs(scene, world, dayNight);
  entities = new Entities(scene, world);

  mobs.onDrop((id, count, x, y, z) => entities.spawnItem(id, count, x, y, z));
  if (mobs.onKill) mobs.onKill(() => stats.track("mummy_kill"));
  entities.onPickup((id, count, dur) => {
    const left = player.inv.add(id, count, dur);
    if (left < count) {
      sfx.play("pickup");
      ui.renderHotbar(player.inv);
      if (state === S.INVENTORY) ui.renderInventory(player.inv);
    }
  });

  world.onBlockChanged((x, y, z, oldId, newId, fall) => {
    if (fall) entities.spawnFallingSand(x, y, z);
  });

  const spawn = world.findSpawn();
  player.respawn(spawn);
  body = new Body(spawn.x, spawn.y, spawn.z, PHYS.PLAYER_W, PHYS.PLAYER_H);
  vy = 0;
  stats = new Stats();

  scene.add(selectionBox);
  scene.add(breakOverlay);
  const ms = buildAllChunks();
  ui.toast("Building the desert... " + Math.round(ms) + "ms", 1800);

  ui.setHUDVisible(true);
  ui.setHP(player.hp);
  ui.renderHotbar(player.inv);
  ui.showScreen(null);
  state = S.PLAYING;
  controls.lock();
}

function heldDmg() {
  const held = player.heldItem();
  if (held && ITEMS[held.id] && ITEMS[held.id].tool) return ITEMS[held.id].tool.dmg;
  return 1;
}

function applyPlayerDamage(n, cause) {
  if (!player || player.dead || state === S.WIN || state === S.MENU) return;
  ui.damageFlash();
  sfx.play("hurt");
  const died = player.damage(n, cause);
  ui.setHP(player.hp);
  if (died) onDeath(cause);
}

function onDeath(cause) {
  const wasInventory = state === S.INVENTORY;
  state = S.DEAD;
  controls.unlock();
  stats.track("death");
  const slots = player.inv.slots;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (s) {
      entities.spawnItem(s.id, s.count, body.x + (Math.random() - 0.5), body.y + 1, body.z + (Math.random() - 0.5), s.dur);
      slots[i] = null;
    }
  }
  if (wasInventory) ui.toggleInventory();
  const msg = document.getElementById("death-msg");
  if (msg) msg.textContent = cause === "mummy" ? "Slain by a mummy!" : cause === "fall" ? "Fell from a height!" : "You died!";
  ui.showScreen("dead");
  sfx.play("die");
}

function respawn() {
  const spawn = world.findSpawn();
  player.respawn(spawn);
  body = new Body(spawn.x, spawn.y, spawn.z, PHYS.PLAYER_W, PHYS.PLAYER_H);
  vy = 0;
  ui.setHP(player.hp);
  ui.renderHotbar(player.inv);
  ui.showScreen(null);
  state = S.PLAYING;
  controls.lock();
}

function triggerWin(info) {
  if (won) return;
  won = true;
  state = S.WIN;
  controls.unlock();
  markSelection(null);
  winHandle = runWinSequence({
    statsReport: stats.report(),
    sfx,
    handlers: {
      onShare: async () => {},
      onContinue: () => {
        if (winHandle) winHandle.stop();
        winHandle = null;
        ui.showScreen(null);
        state = S.PLAYING;
        controls.lock();
      },
      onExit: () => {
        if (winHandle) winHandle.stop();
        winHandle = null;
        exitToMenu();
      },
    },
  });
}

function exitToMenu() {
  teardownGame();
  ui.setHUDVisible(false);
  ui.showScreen("main");
  state = S.MENU;
  howtoFrom = S.MENU;
}

function toggleInventory() {
  if (state === S.PLAYING) {
    state = S.INVENTORY;
    controls.unlock();
    ui.toggleInventory();
    ui.renderInventory(player.inv);
  } else if (state === S.INVENTORY) {
    ui.toggleInventory();
    state = S.PLAYING;
    controls.lock();
  }
}

function pauseGame() {
  if (state !== S.PLAYING) return;
  state = S.PAUSED;
  controls.unlock();
  markSelection(null);
  ui.showScreen("pause");
  sfx.play("click");
}

function resumeGame() {
  if (state !== S.PAUSED) return;
  ui.showScreen(null);
  state = S.PLAYING;
  controls.lock();
}

function stringSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 1000000000;
}

const ui = new UI({
  onPlay: (seed) => {
    sfx.play("click");
    const s = seed && seed.trim() ? stringSeed(seed.trim()) : Date.now() % 1000000000;
    startGame(s);
  },
  onHowTo: () => {
    howtoFrom = state;
    sfx.play("click");
    ui.showScreen("howto");
  },
  onHowToBack: () => {
    sfx.play("click");
    ui.showScreen(howtoFrom === S.PAUSED ? "pause" : "main");
  },
  onResume: () => {
    sfx.play("click");
    resumeGame();
  },
  onExitToMenu: () => {
    sfx.play("click");
    exitToMenu();
  },
  onRespawn: () => {
    sfx.play("click");
    respawn();
  },
  onCraft: (recipeIndex) => {
    if (state !== S.INVENTORY) return;
    if (applyCraft(player.inv.slots, recipeIndex)) {
      sfx.play("craft");
      stats.track("craft");
      ui.renderInventory(player.inv);
      ui.renderHotbar(player.inv);
    } else {
      ui.toast("Missing materials");
    }
  },
  onMuteToggle: () => {
    sfx.muted = !sfx.muted;
    ui.toast(sfx.muted ? "Sound off" : "Sound on");
  },
});
ui.setVersion(VERSION);

controls = new Controls(canvas);
controls.on((e) => {
  if (e.type === "select" && player) {
    player.inv.selected = e.i;
    ui.renderHotbar(player.inv);
  } else if (e.type === "inventory") {
    toggleInventory();
  } else if (e.type === "pause") {
    if (state === S.PLAYING) pauseGame();
  } else if (e.type === "attack") {
    if (state === S.PLAYING && controls.isLocked()) {
      const o = lookOrigin();
      const d = lookDir();
      if (mobs.attackAt(o, d, 3.5, heldDmg())) sfx.play("mobhurt");
      const held = player.heldItem();
      if (held && ITEMS[held.id] && ITEMS[held.id].tool) player.damageHeld();
      ui.renderHotbar(player.inv);
    }
  } else if (e.type === "use") {
    if (state !== S.PLAYING || !controls.isLocked()) return;
    const held = player.heldItem();
    if (held && ITEMS[held.id] && ITEMS[held.id].food) {
      if (player.eat()) {
        sfx.play("eat");
        ui.setHP(player.hp);
        ui.renderHotbar(player.inv);
      }
      return;
    }
    if (held && held.id < 100 && held.count > 0) {
      const hit = currentHit();
      if (!hit) return;
      const tx = hit.x + hit.nx;
      const ty = hit.y + hit.ny;
      const tz = hit.z + hit.nz;
      if (tx < 0 || tx >= WX || ty < 0 || ty >= WY || tz < 0 || tz >= WZ) return;
      if (world.getBlock(tx, ty, tz) !== BLOCK.AIR) return;
      if (bodyIntersectsBlock(body, tx, ty, tz)) return;
      world.setBlock(tx, ty, tz, held.id);
      held.count--;
      if (held.count <= 0) player.inv.slots[player.inv.selected] = null;
      sfx.play("place");
      stats.track("place");
      ui.renderHotbar(player.inv);
      if (held.id === BLOCK.SANDSTONE) {
        stats.track("sandstone_place");
        const found = checkPyramid(world, tx, ty, tz);
        if (found) triggerWin(found);
      }
    }
  }
});

canvas.addEventListener("click", () => {
  if (state === S.PLAYING && controls && !controls.isLocked()) controls.lock();
});

function tick(dt) {
  if (state === S.PLAYING || state === S.INVENTORY || state === S.DEAD) stats.tick(dt);

  if (state === S.PLAYING && controls.isLocked()) {
    const speed = controls.keys.has("shift") ? PHYS.SNEAK : PHYS.WALK;
    const d = lookDir();
    const flat = new THREE.Vector3(d.x, 0, d.z);
    if (flat.lengthSq() > 0) flat.normalize();
    const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), flat).multiplyScalar(-1);
    let ix = 0;
    let iz = 0;
    if (controls.keys.has("w")) iz += 1;
    if (controls.keys.has("s")) iz -= 1;
    if (controls.keys.has("d")) ix += 1;
    if (controls.keys.has("a")) ix -= 1;
    const wish = new THREE.Vector3().addScaledVector(flat, iz).addScaledVector(right, ix);
    if (wish.lengthSq() > 0) wish.normalize().multiplyScalar(speed);
    if (controls.keys.has("space")) vy = PHYS.JUMP;
    vy -= PHYS.GRAVITY * dt;
    if (vy < -50) vy = -50;
    const res = moveBody(world, body, wish.x, vy, wish.z, dt);
    if (res.onGround) vy = 0;
    if (res.fell > 0) {
      const dmg = fallDamage(res.fell);
      if (dmg > 0) applyPlayerDamage(dmg, "fall");
    }
  } else if (state === S.DEAD || state === S.INVENTORY) {
    vy -= PHYS.GRAVITY * dt;
    if (vy < -50) vy = -50;
    moveBody(world, body, 0, vy, 0, dt);
  }

  camera.position.set(body.x, body.y + PHYS.EYE, body.z);
  camera.rotation.x = controls.pitch;
  camera.rotation.y = controls.yaw;

  const hit = currentHit();
  markSelection(hit);

  if (state === S.PLAYING && controls.isLocked() && controls.mouseLeft && hit) {
    const key = hit.x + "," + hit.y + "," + hit.z;
    if (mineTarget !== key) {
      mineTarget = key;
      mineProgress = 0;
    }
    const blockId = world.getBlock(hit.x, hit.y, hit.z);
    if (blockId !== BLOCK.AIR && blockId !== BLOCK.BEDROCK) {
      const t = breakTime(blockId, player.heldItem());
      mineProgress += dt / Math.max(t, 0.05);
      digSoundT += dt;
      if (digSoundT > 0.25) {
        digSoundT = 0;
        sfx.play("dig");
      }
      breakOverlay.visible = true;
      breakOverlay.material.opacity = Math.min(0.6, mineProgress * 0.6);
      if (mineProgress >= 1) {
        const drop = dropFor(blockId, player.heldItem());
        world.setBlock(hit.x, hit.y, hit.z, BLOCK.AIR);
        if (drop) entities.spawnItem(drop.id, drop.count, hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
        stats.track("mine");
        sfx.play("break");
        const held = player.heldItem();
        if (held && ITEMS[held.id] && ITEMS[held.id].tool) {
          player.damageHeld();
          ui.renderHotbar(player.inv);
        }
        mineTarget = null;
        mineProgress = 0;
        breakOverlay.visible = false;
        breakOverlay.material.opacity = 0;
      }
    }
  } else {
    mineTarget = null;
    mineProgress = 0;
    breakOverlay.visible = false;
    breakOverlay.material.opacity = 0;
  }

  if (state === S.PLAYING || state === S.INVENTORY || state === S.DEAD) {
    dayNight.update(dt, camera.position);
    mobs.update(dt, { x: body.x, y: body.y, z: body.z }, (n) => applyPlayerDamage(n, "mummy"));
    entities.update(dt, { x: body.x, y: body.y, z: body.z });
    remeshDirty();
    dialT += dt;
    if (dialT > 0.5) {
      dialT = 0;
      ui.setDial(dayNight.phase01(), dayNight.isNight());
    }
  }
}

let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (state === S.MENU) {
    menuGroup.rotation.y += dt * 0.15;
  } else {
    tick(dt);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

window.__PB = {
  VERSION,
  get state() {
    return state;
  },
  get world() {
    return world;
  },
  get player() {
    return player;
  },
  get mobs() {
    return mobs;
  },
  get stats() {
    return stats;
  },
  checkPyramid,
  forceWin: () => {
    if (!world || state === S.WIN) return false;
    const d = lookDir();
    const cx = Math.floor(camera.position.x + d.x * 12);
    const cz = Math.floor(camera.position.z + d.z * 12);
    const y0 = world.heightAt(cx, cz);
    if (y0 < 2 || y0 + 8 >= WY) return false;
    for (let i = 0; i < WINP.LAYERS; i++) {
      const h = 7 - i;
      for (let dx = -h; dx <= h; dx++) {
        for (let dz = -h; dz <= h; dz++) {
          world.setBlock(cx + dx, y0 + i, cz + dz, BLOCK.SANDSTONE);
        }
      }
    }
    const found = checkPyramid(world, cx, y0 + 7, cz);
    if (found) {
      triggerWin(found);
      return true;
    }
    return false;
  },
};
