import { WX, WZ } from "./config.js";

export function raycastVoxel(world, ox, oy, oz, dx, dy, dz, maxDist) {
  const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (len === 0) return null;
  const ndx = dx / len;
  const ndy = dy / len;
  const ndz = dz / len;

  let x = Math.floor(ox);
  let y = Math.floor(oy);
  let z = Math.floor(oz);

  const stepX = ndx > 0 ? 1 : ndx < 0 ? -1 : 0;
  const stepY = ndy > 0 ? 1 : ndy < 0 ? -1 : 0;
  const stepZ = ndz > 0 ? 1 : ndz < 0 ? -1 : 0;

  const tDeltaX = ndx !== 0 ? Math.abs(1 / ndx) : Infinity;
  const tDeltaY = ndy !== 0 ? Math.abs(1 / ndy) : Infinity;
  const tDeltaZ = ndz !== 0 ? Math.abs(1 / ndz) : Infinity;

  let tMaxX = ndx > 0 ? (x + 1 - ox) / ndx : ndx < 0 ? (x - ox) / ndx : Infinity;
  let tMaxY = ndy > 0 ? (y + 1 - oy) / ndy : ndy < 0 ? (y - oy) / ndy : Infinity;
  let tMaxZ = ndz > 0 ? (z + 1 - oz) / ndz : ndz < 0 ? (z - oz) / ndz : Infinity;

  let tEntry = 0;
  let axis = -1;

  while (true) {
    if (axis !== -1 && world.isSolid(x, y, z)) {
      return {
        x,
        y,
        z,
        nx: axis === 0 ? -stepX : 0,
        ny: axis === 1 ? -stepY : 0,
        nz: axis === 2 ? -stepZ : 0,
        px: ox + ndx * tEntry,
        py: oy + ndy * tEntry,
        pz: oz + ndz * tEntry
      };
    }
    if (tMaxX <= tMaxY && tMaxX <= tMaxZ) {
      if (tMaxX > maxDist) return null;
      x += stepX;
      tEntry = tMaxX;
      tMaxX += tDeltaX;
      axis = 0;
    } else if (tMaxY <= tMaxZ) {
      if (tMaxY > maxDist) return null;
      y += stepY;
      tEntry = tMaxY;
      tMaxY += tDeltaY;
      axis = 1;
    } else {
      if (tMaxZ > maxDist) return null;
      z += stepZ;
      tEntry = tMaxZ;
      tMaxZ += tDeltaZ;
      axis = 2;
    }
  }
}

export class Body {
  constructor(x, y, z, w, h) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
    this.h = h;
    this._fallDist = 0;
    this._refY = y;
  }
}

function aabbCollides(world, minX, minY, minZ, maxX, maxY, maxZ) {
  const x1 = Math.floor(maxX - 1e-9);
  const y1 = Math.floor(maxY - 1e-9);
  const z1 = Math.floor(maxZ - 1e-9);
  for (let x = Math.floor(minX); x <= x1; x++) {
    for (let y = Math.floor(minY); y <= y1; y++) {
      for (let z = Math.floor(minZ); z <= z1; z++) {
        if (world.isSolid(x, y, z)) return true;
      }
    }
  }
  return false;
}

export function moveBody(world, body, vx, vy, vz, dt) {
  let hitX = false;
  let hitY = false;
  let hitZ = false;

  if (vx !== 0) {
    const d = vx * dt;
    const n = Math.max(1, Math.ceil(Math.abs(d) / 0.5));
    const step = d / n;
    for (let i = 0; i < n; i++) {
      const testX = body.x + step;
      if (aabbCollides(world, testX - body.w / 2, body.y, body.z - body.w / 2, testX + body.w / 2, body.y + body.h, body.z + body.w / 2)) {
        body.x = step > 0
          ? Math.floor(testX + body.w / 2) - body.w / 2
          : Math.floor(testX - body.w / 2) + 1 + body.w / 2;
        hitX = true;
        break;
      }
      body.x = testX;
    }
  }

  if (vz !== 0) {
    const d = vz * dt;
    const n = Math.max(1, Math.ceil(Math.abs(d) / 0.5));
    const step = d / n;
    for (let i = 0; i < n; i++) {
      const testZ = body.z + step;
      if (aabbCollides(world, body.x - body.w / 2, body.y, testZ - body.w / 2, body.x + body.w / 2, body.y + body.h, testZ + body.w / 2)) {
        body.z = step > 0
          ? Math.floor(testZ + body.w / 2) - body.w / 2
          : Math.floor(testZ - body.w / 2) + 1 + body.w / 2;
        hitZ = true;
        break;
      }
      body.z = testZ;
    }
  }

  let onGround = false;

  if (vy !== 0) {
    const d = vy * dt;
    const n = Math.max(1, Math.ceil(Math.abs(d) / 0.5));
    const step = d / n;
    for (let i = 0; i < n; i++) {
      const testY = body.y + step;
      if (aabbCollides(world, body.x - body.w / 2, testY, body.z - body.w / 2, body.x + body.w / 2, testY + body.h, body.z + body.w / 2)) {
        if (step > 0) {
          body.y = Math.floor(testY + body.h) - body.h;
        } else {
          body.y = Math.floor(testY) + 1;
          if (vy <= 0) onGround = true;
        }
        hitY = true;
        break;
      }
      body.y = testY;
    }
  }

  if (!onGround && vy <= 0) {
    const y0 = Math.floor(body.y - 1e-3);
    const x1 = Math.floor(body.x + body.w / 2 - 1e-9);
    const z1 = Math.floor(body.z + body.w / 2 - 1e-9);
    for (let x = Math.floor(body.x - body.w / 2); x <= x1; x++) {
      for (let z = Math.floor(body.z - body.w / 2); z <= z1; z++) {
        if (world.isSolid(x, y0, z)) {
          onGround = true;
          break;
        }
      }
      if (onGround) break;
    }
  }

  if (body.x < 0.5) body.x = 0.5;
  else if (body.x > WX - 0.5) body.x = WX - 0.5;
  if (body.z < 0.5) body.z = 0.5;
  else if (body.z > WZ - 0.5) body.z = WZ - 0.5;

  const drop = body._refY - body.y;
  if (drop > 0) body._fallDist += drop;
  body._refY = body.y;

  let fell = 0;
  if (onGround) {
    fell = body._fallDist;
    body._fallDist = 0;
  }

  return { onGround, hitX, hitY, hitZ, fell };
}

export function fallDamage(fell) {
  return Math.min(15, Math.max(0, Math.floor(fell - 3)));
}

export function bodyIntersectsBlock(body, x, y, z) {
  return (
    body.x - body.w / 2 < x + 1 &&
    body.x + body.w / 2 > x &&
    body.y < y + 1 &&
    body.y + body.h > y &&
    body.z - body.w / 2 < z + 1 &&
    body.z + body.w / 2 > z
  );
}
