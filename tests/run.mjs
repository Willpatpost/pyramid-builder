import { strict as assert } from "node:assert";

const detect = await import("../js/detect.js");
const { World } = await import("../js/world.js");
const blocks = await import("../js/blocks.js");
const { BLOCK } = await import("../js/config.js");
const { Inventory, Player } = await import("../js/player.js");
const physics = await import("../js/physics.js");

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ok - " + name);
  } catch (e) {
    failed++;
    console.log("  FAIL - " + name + " :: " + e.message);
  }
}

function fakeWorld(cells) {
  return {
    getBlock(x, y, z) {
      const k = x + "," + y + "," + z;
      return Object.prototype.hasOwnProperty.call(cells, k) ? cells[k] : BLOCK.AIR;
    }
  };
}

function buildPyramid(cells, cx, y0, cz, id) {
  for (let i = 0; i < 8; i++) {
    const h = 7 - i;
    for (let dx = -h; dx <= h; dx++) {
      for (let dz = -h; dz <= h; dz++) cells[(cx + dx) + "," + (y0 + i) + "," + (cz + dz)] = id;
    }
  }
}

console.log("detect:");
{
  const cells = {};
  buildPyramid(cells, 80, 30, 80, BLOCK.SANDSTONE);
  const w = fakeWorld(cells);
  test("valid pyramid detected from apex", () => {
    assert.deepEqual(detect.checkPyramid(w, 80, 37, 80), { cx: 80, cy: 30, cz: 80 });
  });
  test("valid pyramid detected from a base block", () => {
    assert.deepEqual(detect.checkPyramid(w, 87, 30, 74), { cx: 80, cy: 30, cz: 80 });
  });
  test("stone apex rejected", () => {
    const c2 = { ...cells };
    c2["80,37,80"] = BLOCK.STONE;
    assert.equal(detect.checkPyramid(fakeWorld(c2), 80, 37, 80), null);
  });
  test("missing base corner rejected", () => {
    const c2 = { ...cells };
    delete c2["73,30,73"];
    assert.equal(detect.checkPyramid(fakeWorld(c2), 80, 37, 80), null);
  });
  test("13-wide pyramid rejected", () => {
    const c3 = {};
    for (let i = 0; i < 8; i++) {
      const h = 6 - i;
      if (h < 0) break;
      for (let dx = -h; dx <= h; dx++) for (let dz = -h; dz <= h; dz++) c3[(60 + dx) + "," + (30 + i) + "," + (60 + dz)] = BLOCK.SANDSTONE;
    }
    assert.equal(detect.checkPyramid(fakeWorld(c3), 60, 37, 60), null);
  });
}

console.log("world:");
{
  const w1 = new World(123);
  const w2 = new World(123);
  test("same-seed determinism", () => {
    for (const [x, z] of [[10, 10], [80, 80], [150, 30]]) {
      assert.equal(w1.heightAt(x, z), w2.heightAt(x, z));
    }
  });
  test("setBlock/getBlock roundtrip + dirty flag", () => {
    w1.setBlock(10, 50, 10, BLOCK.STONE);
    assert.equal(w1.getBlock(10, 50, 10), BLOCK.STONE);
    assert.equal(w1.isChunkDirty(0, 0), true);
    w1.clearChunkDirty(0, 0);
    assert.equal(w1.isChunkDirty(0, 0), false);
  });
  test("sand-fall cascade emits fall event", () => {
    const events = [];
    w1.onBlockChanged((x, y, z, o, n, fall) => events.push({ x, y, z, fall }));
    w1.setBlock(20, 45, 20, BLOCK.SAND);
    w1.setBlock(20, 46, 20, BLOCK.SAND);
    w1.setBlock(20, 45, 20, BLOCK.AIR);
    const falls = events.filter((e) => e.fall);
    assert.equal(falls.length, 1);
    assert.equal(falls[0].y, 46);
    assert.equal(w1.getBlock(20, 46, 20), BLOCK.AIR);
  });
  test("out-of-bounds semantics", () => {
    assert.equal(w1.getBlock(5, -1, 5), BLOCK.BEDROCK);
    assert.equal(w1.getBlock(5, 64, 5), BLOCK.AIR);
    assert.equal(w1.getBlock(-1, 10, 5), BLOCK.AIR);
  });
}

console.log("blocks:");
{
  test("breakTime with tools", () => {
    assert.equal(blocks.breakTime(BLOCK.SANDSTONE, { id: 101 }), 1.5);
    assert.equal(blocks.breakTime(BLOCK.SANDSTONE, { id: 102 }), 0.75);
    assert.ok(Math.abs(blocks.breakTime(BLOCK.SANDSTONE, null) - 4.95) < 1e-9);
    assert.equal(blocks.breakTime(BLOCK.SAND, null), 0.7);
  });
  test("dropFor needsTool gating", () => {
    assert.equal(blocks.dropFor(BLOCK.SANDSTONE, null), null);
    assert.deepEqual(blocks.dropFor(BLOCK.SANDSTONE, { id: 101 }), { id: BLOCK.SANDSTONE, count: 1 });
    assert.deepEqual(blocks.dropFor(BLOCK.SAND, null), { id: BLOCK.SAND, count: 1 });
  });
  test("crafted tools carry durability", () => {
    const inv = [{ id: BLOCK.PLANKS, count: 3 }, { id: 100, count: 2 }, null];
    assert.equal(blocks.applyCraft(inv, 3), true);
    assert.deepEqual(inv[2], { id: 101, count: 1, dur: 60 });
  });
  test("sand to sandstone recipe consumes 4", () => {
    const inv = [{ id: BLOCK.SAND, count: 64 }, null];
    assert.equal(blocks.applyCraft(inv, 2), true);
    assert.equal(inv[0].count, 60);
    assert.deepEqual(inv[1], { id: BLOCK.SANDSTONE, count: 1 });
  });
  test("stackMax", () => {
    assert.equal(blocks.stackMax(101), 1);
    assert.equal(blocks.stackMax(BLOCK.SAND), 64);
  });
}

console.log("player:");
{
  test("inventory stacking across slots", () => {
    const inv = new Inventory();
    assert.equal(inv.add(BLOCK.SAND, 70), 0);
    assert.equal(inv.slots[0].count, 64);
    assert.equal(inv.slots[1].count, 6);
  });
  test("inventory reports leftover only when full", () => {
    const inv = new Inventory();
    for (let i = 0; i < 36; i++) inv.slots[i] = { id: BLOCK.SAND, count: 64 };
    assert.equal(inv.add(BLOCK.SAND, 10), 10);
  });
  test("tools take own slots with default dur", () => {
    const inv = new Inventory();
    inv.add(101, 1);
    inv.add(101, 1);
    assert.equal(inv.slots[0].dur, 60);
    assert.equal(inv.slots[1].id, 101);
  });
  test("damageHeld breaks tool at zero", () => {
    const inv = new Inventory();
    inv.add(101, 1);
    const p = new Player();
    p.inv = inv;
    for (let i = 0; i < 60; i++) p.damageHeld();
    assert.equal(inv.slots[0], null);
  });
  test("damage, death, respawn", () => {
    const p = new Player();
    assert.equal(p.damage(25, "mummy"), true);
    assert.equal(p.dead, true);
    p.heal(5);
    assert.equal(p.hp, 0);
    p.respawn({ x: 1, y: 2, z: 3 });
    assert.equal(p.hp, 20);
    assert.equal(p.dead, false);
  });
  test("eat consumes and heals", () => {
    const p = new Player();
    p.hp = 10;
    p.inv.add(105, 2);
    p.inv.selected = 0;
    assert.equal(p.eat(), true);
    assert.equal(p.hp, 14);
    assert.equal(p.inv.count(105), 1);
  });
}

console.log("physics:");
{
  const w = new World(7);
  test("raycast straight down hits top block with +y normal", () => {
    const gx = 40;
    const gz = 40;
    const h = w.heightAt(gx, gz);
    const hit = physics.raycastVoxel(w, gx + 0.5, h + 3, gz + 0.5, 0, -1, 0, 10);
    assert.equal(hit.y, h - 1);
    assert.equal(hit.ny, 1);
    assert.equal(hit.nx, 0);
  });
  test("raycast respects maxDist", () => {
    const h = w.heightAt(40, 40);
    assert.equal(physics.raycastVoxel(w, 40.5, h + 30, 40.5, 0, -1, 0, 10), null);
  });
  test("moveBody lands exactly on surface and reports fell", () => {
    const gx = 50;
    const gz = 50;
    const h = w.heightAt(gx, gz);
    const body = new physics.Body(gx + 0.5, h + 6, gz + 0.5, 0.6, 1.8);
    let fell = 0;
    let onGround = false;
    for (let i = 0; i < 200 && !onGround; i++) {
      const res = physics.moveBody(w, body, 0, -10, 0, 0.05);
      onGround = res.onGround;
      if (res.fell > 0) fell = res.fell;
    }
    assert.equal(onGround, true);
    assert.equal(body.y, h);
    assert.ok(fell >= 5 && fell <= 6.5, "fell=" + fell);
  });
  test("fallDamage thresholds", () => {
    assert.equal(physics.fallDamage(3), 0);
    assert.equal(physics.fallDamage(3.9), 0);
    assert.equal(physics.fallDamage(4), 1);
    assert.equal(physics.fallDamage(5.5), 2);
    assert.equal(physics.fallDamage(100), 15);
  });
  test("bodyIntersectsBlock", () => {
    const body = new physics.Body(10.5, 20, 10.5, 0.6, 1.8);
    assert.equal(physics.bodyIntersectsBlock(body, 10, 20, 10), true);
    assert.equal(physics.bodyIntersectsBlock(body, 12, 20, 10), false);
  });
}

console.log("");
console.log(passed + " passed, " + failed + " failed");
process.exit(failed > 0 ? 1 : 0);
