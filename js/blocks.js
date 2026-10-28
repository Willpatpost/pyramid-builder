import { BLOCK, ITEM, MAX_STACK } from "./config.js";

export const BLOCKS = [
  { name: "air", solid: false, opaque: false, hardness: 0, tool: null, needsTool: false, drops: null },
  { name: "sand", solid: true, opaque: true, hardness: 0.7, tool: null, needsTool: false, drops: { id: BLOCK.SAND, count: 1 } },
  { name: "sandstone", solid: true, opaque: true, hardness: 1.5, tool: "pickaxe", needsTool: true, drops: { id: BLOCK.SANDSTONE, count: 1 } },
  { name: "stone", solid: true, opaque: true, hardness: 1.7, tool: "pickaxe", needsTool: true, drops: { id: BLOCK.STONE, count: 1 } },
  { name: "palm log", solid: true, opaque: true, hardness: 2.2, tool: null, needsTool: false, drops: { id: BLOCK.LOG, count: 1 } },
  { name: "palm leaves", solid: true, opaque: false, hardness: 0.3, tool: null, needsTool: false, drops: { id: ITEM.DATES, count: 1 } },
  { name: "planks", solid: true, opaque: true, hardness: 2.2, tool: null, needsTool: false, drops: { id: BLOCK.PLANKS, count: 1 } },
  { name: "bedrock", solid: true, opaque: true, hardness: Infinity, tool: null, needsTool: false, drops: null }
];

export const ITEMS = {
  [ITEM.STICK]: { name: "stick", kind: "material" },
  [ITEM.WOOD_PICK]: { name: "wooden pickaxe", kind: "tool", tool: { type: "pickaxe", speedMult: 2, dmg: 2, dur: 60 } },
  [ITEM.STONE_PICK]: { name: "stone pickaxe", kind: "tool", tool: { type: "pickaxe", speedMult: 4, dmg: 3, dur: 132 } },
  [ITEM.WOOD_SWORD]: { name: "wooden sword", kind: "tool", tool: { type: "sword", speedMult: 1, dmg: 4, dur: 60 } },
  [ITEM.STONE_SWORD]: { name: "stone sword", kind: "tool", tool: { type: "sword", speedMult: 1, dmg: 5, dur: 132 } },
  [ITEM.DATES]: { name: "dates", kind: "food", food: { heal: 4 } }
};

export const RECIPES = [
  { out: { id: BLOCK.PLANKS, count: 4 }, in: [{ id: BLOCK.LOG, count: 1 }] },
  { out: { id: ITEM.STICK, count: 4 }, in: [{ id: BLOCK.PLANKS, count: 2 }] },
  { out: { id: BLOCK.SANDSTONE, count: 1 }, in: [{ id: BLOCK.SAND, count: 4 }] },
  { out: { id: ITEM.WOOD_PICK, count: 1 }, in: [{ id: BLOCK.PLANKS, count: 3 }, { id: ITEM.STICK, count: 2 }] },
  { out: { id: ITEM.STONE_PICK, count: 1 }, in: [{ id: BLOCK.STONE, count: 3 }, { id: ITEM.STICK, count: 2 }] },
  { out: { id: ITEM.WOOD_SWORD, count: 1 }, in: [{ id: BLOCK.PLANKS, count: 2 }, { id: ITEM.STICK, count: 1 }] },
  { out: { id: ITEM.STONE_SWORD, count: 1 }, in: [{ id: BLOCK.STONE, count: 2 }, { id: ITEM.STICK, count: 1 }] }
];

export function breakTime(blockId, heldItem) {
  const blk = BLOCKS[blockId];
  if (!blk || blockId === BLOCK.AIR) return 0;
  if (blockId === BLOCK.BEDROCK) return Infinity;
  const held = heldItem ? ITEMS[heldItem.id] : null;
  if (held && held.tool && blk.tool && held.tool.type === blk.tool) {
    return (blk.hardness * 2) / held.tool.speedMult;
  }
  if (blk.needsTool) return blk.hardness * 3.3;
  return blk.hardness;
}

export function dropFor(blockId, heldItem) {
  const blk = BLOCKS[blockId];
  if (!blk || !blk.drops) return null;
  if (blk.needsTool) {
    const held = heldItem ? ITEMS[heldItem.id] : null;
    if (!held || !held.tool || held.tool.type !== blk.tool) return null;
  }
  if (blockId === BLOCK.LEAVES && Math.random() >= 0.1) return null;
  return { id: blk.drops.id, count: blk.drops.count };
}

export function canCraft(inv, recipeIndex) {
  const slots = Array.isArray(inv) ? inv : inv.slots;
  const recipe = RECIPES[recipeIndex];
  if (!recipe || !slots) return false;
  const counts = new Map();
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (s) counts.set(s.id, (counts.get(s.id) || 0) + s.count);
  }
  for (const inp of recipe.in) {
    if ((counts.get(inp.id) || 0) < inp.count) return false;
  }
  return true;
}

export function applyCraft(inv, recipeIndex) {
  const slots = Array.isArray(inv) ? inv : inv.slots;
  const recipe = RECIPES[recipeIndex];
  if (!recipe || !slots || !canCraft(slots, recipeIndex)) return false;

  const outId = recipe.out.id;
  const outCount = recipe.out.count;
  const max = stackMax(outId);

  let target = -1;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!s) {
      if (target === -1) target = i;
    } else if (s.id === outId && s.count + outCount <= max) {
      target = i;
      break;
    }
  }
  if (target === -1) return false;

  for (const inp of recipe.in) {
    let needed = inp.count;
    for (let i = 0; i < slots.length && needed > 0; i++) {
      const s = slots[i];
      if (s && s.id === inp.id) {
        const take = Math.min(s.count, needed);
        s.count -= take;
        needed -= take;
        if (s.count === 0) slots[i] = null;
      }
    }
  }

  const out = slots[target];
  if (out) {
    out.count += outCount;
  } else {
    const slot = { id: outId, count: outCount };
    const outDef = ITEMS[outId];
    if (outDef && outDef.kind === "tool") slot.dur = outDef.tool.dur;
    slots[target] = slot;
  }
  return true;
}

export function stackMax(id) {
  const item = ITEMS[id];
  if (item && item.kind === "tool") return 1;
  return MAX_STACK;
}
