import { WX, WY, WZ, CHUNK, CHUNKS_X, CHUNKS_Z, BLOCK, mulberry32, hash2 } from "./config.js";
import { BLOCKS } from "./blocks.js";

export class World {
  constructor(seed) {
    this.seed = seed;
    this.data = new Uint8Array(WX * WY * WZ);
    this._listeners = [];
    this._dirty = new Uint8Array(CHUNKS_X * CHUNKS_Z);
    this._heightmap = new Uint8Array(WX * WZ);
    this._generateTerrain();
  }

  _generateTerrain() {
    const seed = this.seed >>> 0;
    const rng = mulberry32(seed);

    for (let x = 0; x < WX; x++) {
      for (let z = 0; z < WZ; z++) {
        const h = this._valueNoise2D(x, z, seed);
        this._heightmap[x * WZ + z] = Math.round(20 + h * 14);
      }
    }

    const oasisCx = 20 + ((seed >>> 8) % (WX - 32));
    const oasisCz = 20 + ((seed >>> 16) % (WZ - 32));
    const oasisRadius = 13;
    const oasisFloor = 22;
    const r2 = oasisRadius * oasisRadius;

    for (let x = 0; x < WX; x++) {
      for (let z = 0; z < WZ; z++) {
        const dx = x - oasisCx;
        const dz = z - oasisCz;
        if (dx * dx + dz * dz <= r2) this._heightmap[x * WZ + z] = oasisFloor;
      }
    }

    const trees = [];
    let tries = 0;
    while (trees.length < 6 + ((seed >>> 24) % 4) && tries < 200) {
      tries++;
      const tx = oasisCx + Math.floor((rng() - 0.5) * (oasisRadius * 1.6));
      const tz = oasisCz + Math.floor((rng() - 0.5) * (oasisRadius * 1.6));
      const dx = tx - oasisCx;
      const dz = tz - oasisCz;
      if (dx * dx + dz * dz <= (oasisRadius - 2) * (oasisRadius - 2)) trees.push({ x: tx, z: tz });
    }

    const outcrops = [];
    tries = 0;
    while (outcrops.length < 5 && tries < 300) {
      tries++;
      const ox = 8 + Math.floor(rng() * (WX - 16));
      const oz = 8 + Math.floor(rng() * (WZ - 16));
      const dx = ox - oasisCx;
      const dz = oz - oasisCz;
      if (dx * dx + dz * dz > (oasisRadius + 8) * (oasisRadius + 8)) outcrops.push({ x: ox, z: oz });
    }

    for (let x = 0; x < WX; x++) {
      for (let z = 0; z < WZ; z++) {
        const h = this._heightmap[x * WZ + z];
        const base = (x * WZ + z) * WY;
        this.data[base] = BLOCK.BEDROCK;
        for (let y = 1; y <= h - 8; y++) this.data[base + y] = BLOCK.STONE;
        for (let y = h - 7; y <= h - 5; y++) this.data[base + y] = BLOCK.SANDSTONE;
        for (let y = h - 4; y <= h - 1; y++) this.data[base + y] = BLOCK.SAND;
      }
    }

    for (const t of trees) this._placePalmTree(t.x, t.z, rng);
    for (const o of outcrops) this._placeStoneOutcrop(o.x, o.z, rng);
  }

  _valueNoise2D(x, z, seed) {
    const base = this._noiseOctave(x, z, seed, 20);
    const detail = this._noiseOctave(x, z, seed + 1, 8);
    return 0.7 * base + 0.3 * detail;
  }

  _noiseOctave(x, z, seed, spacing) {
    const bx = Math.floor(x / spacing);
    const bz = Math.floor(z / spacing);
    const fx = (x - bx * spacing) / spacing;
    const fz = (z - bz * spacing) / spacing;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const v00 = hash2(seed, bx, bz);
    const v10 = hash2(seed, bx + 1, bz);
    const v01 = hash2(seed, bx, bz + 1);
    const v11 = hash2(seed, bx + 1, bz + 1);
    const b0 = v00 + (v10 - v00) * sx;
    const b1 = v01 + (v11 - v01) * sx;
    return b0 + (b1 - b0) * sz;
  }

  _placePalmTree(x, z, rng) {
    const h = this._heightmap[x * WZ + z];
    const trunkHeight = 5 + Math.floor(rng() * 3);
    const topY = h + trunkHeight - 1;
    for (let y = h; y <= topY; y++) this.data[(x * WZ + z) * WY + y] = BLOCK.LOG;
    const plus = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let layer = 1; layer <= 2; layer++) {
      const y = topY + layer;
      if (y >= WY) break;
      for (const [dx, dz] of plus) {
        const lx = x + dx;
        const lz = z + dz;
        if (lx < 0 || lx >= WX || lz < 0 || lz >= WZ) continue;
        const idx = (lx * WZ + lz) * WY + y;
        if (this.data[idx] === BLOCK.AIR) this.data[idx] = BLOCK.LEAVES;
      }
    }
  }

  _placeStoneOutcrop(x, z, rng) {
    const h = this._heightmap[x * WZ + z];
    const extra = rng() > 0.5 ? 2 : 1;
    for (let i = 0; i < extra; i++) {
      const y = h - 1 + i;
      if (y < WY) this.data[(x * WZ + z) * WY + y] = BLOCK.STONE;
    }
  }

  getBlock(x, y, z) {
    if (y < 0) return BLOCK.BEDROCK;
    if (y >= WY || x < 0 || x >= WX || z < 0 || z >= WZ) return BLOCK.AIR;
    return this.data[(x * WZ + z) * WY + y];
  }

  setBlock(x, y, z, id) {
    if (y < 0 || y >= WY || x < 0 || x >= WX || z < 0 || z >= WZ) return;
    const base = (x * WZ + z) * WY;
    const oldId = this.data[base + y];
    if (oldId === id) return;
    this.data[base + y] = id;
    this._dirty[((x / CHUNK) | 0) * CHUNKS_Z + ((z / CHUNK) | 0)] = 1;
    for (const cb of this._listeners) cb(x, y, z, oldId, id, false);
    if (id !== BLOCK.AIR) return;
    let yy = y + 1;
    while (yy < WY && this.data[base + yy] === BLOCK.SAND) {
      this.data[base + yy] = BLOCK.AIR;
      for (const cb of this._listeners) cb(x, yy, z, BLOCK.SAND, BLOCK.AIR, true);
      yy++;
    }
  }

  onBlockChanged(cb) {
    this._listeners.push(cb);
  }

  isSolid(x, y, z) {
    if (y < 0) return true;
    if (y >= WY || x < 0 || x >= WX || z < 0 || z >= WZ) return false;
    const def = BLOCKS[this.data[(x * WZ + z) * WY + y]];
    return def ? def.solid : false;
  }

  heightAt(x, z) {
    if (x < 0 || x >= WX || z < 0 || z >= WZ) return 0;
    const base = (x * WZ + z) * WY;
    for (let y = WY - 1; y >= 0; y--) {
      if (this.data[base + y] !== BLOCK.AIR) return y + 1;
    }
    return 0;
  }

  findSpawn() {
    const seed = this.seed >>> 0;
    const oasisCx = 20 + ((seed >>> 8) % (WX - 32));
    const oasisCz = 20 + ((seed >>> 16) % (WZ - 32));
    const angle = (this.seed % 360) * (Math.PI / 180);
    const dist = 15;
    let x = Math.max(0, Math.min(WX - 1, Math.floor(oasisCx + dist * Math.cos(angle))));
    let z = Math.max(0, Math.min(WZ - 1, Math.floor(oasisCz + dist * Math.sin(angle))));
    let y = this.heightAt(x, z);
    while (y < WY - 2 && (this.getBlock(x, y, z) !== BLOCK.AIR || this.getBlock(x, y + 1, z) !== BLOCK.AIR)) y++;
    while (y > 0 && this.getBlock(x, y - 1, z) === BLOCK.AIR) y--;
    return { x, y, z };
  }

  isChunkDirty(cx, cz) {
    if (cx < 0 || cx >= CHUNKS_X || cz < 0 || cz >= CHUNKS_Z) return false;
    return this._dirty[cx * CHUNKS_Z + cz] === 1;
  }

  clearChunkDirty(cx, cz) {
    if (cx < 0 || cx >= CHUNKS_X || cz < 0 || cz >= CHUNKS_Z) return;
    this._dirty[cx * CHUNKS_Z + cz] = 0;
  }
}
