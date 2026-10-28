import { BLOCK, WINP, WX, WY, WZ } from "./config.js";

// layer i (0=bottom) has half-width HW - i; the apex at y0 + TOP is a single cell
const HW = (WINP.BASE - 1) / 2;
const TOP = WINP.LAYERS - 1;

export function verifyPyramid(world, cx, y0, cz) {
  for (let i = TOP; i >= 0; i--) {
    const hw = HW - i;
    for (let dx = -hw; dx <= hw; dx++) {
      for (let dz = -hw; dz <= hw; dz++) {
        if (world.getBlock(cx + dx, y0 + i, cz + dz) !== BLOCK.SANDSTONE) return false;
      }
    }
  }
  return true;
}

export function checkPyramid(world, x, y, z) {
  for (let layer = 0; layer <= TOP; layer++) {
    const hw = HW - layer;
    const y0 = y - layer;
    if (y0 < 0 || y0 + TOP >= WY) continue;
    for (let cx = x - hw; cx <= x + hw; cx++) {
      if (cx < HW || cx + HW >= WX) continue;
      for (let cz = z - hw; cz <= z + hw; cz++) {
        if (cz < HW || cz + HW >= WZ) continue;
        if (verifyPyramid(world, cx, y0, cz)) return { cx, cy: y0, cz };
      }
    }
  }
  return null;
}
