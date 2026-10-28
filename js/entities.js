import { BLOCK, PHYS } from "./config.js";
import { Body, moveBody } from "./physics.js";
import { makeAtlas, itemIconURL } from "./textures.js";

const FACE_UV_A = [0, 1, 0, 1];
const FACE_UV_B = [1, 1, 0, 0];

export class Entities {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.items = [];
    this.sands = [];
    this.atlas = makeAtlas();
    this._blockMaterial = new THREE.MeshLambertMaterial({ map: this.atlas.texture });
    this._cubeGeos = new Map();
    this._planeGeo = new THREE.PlaneGeometry(0.4, 0.4);
    this._iconMaterials = new Map();
    this._sandGeo = null;
    this._pickupCallbacks = [];
  }

  _applyBoxUVs(geometry, uvTop, uvSide, uvBottom) {
    const faces = [uvSide, uvSide, uvTop, uvBottom, uvSide, uvSide];
    const uv = geometry.attributes.uv;
    for (let f = 0; f < 6; f++) {
      const r = faces[f];
      for (let c = 0; c < 4; c++) {
        const i = (f * 4 + c) * 2;
        uv.array[i] = r[0] + FACE_UV_A[c] * (r[2] - r[0]);
        uv.array[i + 1] = r[1] + FACE_UV_B[c] * (r[3] - r[1]);
      }
    }
    uv.needsUpdate = true;
  }

  _blockGeometry(id) {
    let geo = this._cubeGeos.get(id);
    if (!geo) {
      geo = new THREE.BoxGeometry(0.25, 0.25, 0.25);
      this._applyBoxUVs(geo, this.atlas.uv(id, "top"), this.atlas.uv(id, "side"), this.atlas.uv(id, "bottom"));
      this._cubeGeos.set(id, geo);
    }
    return geo;
  }

  _iconMaterial(id) {
    let mat = this._iconMaterials.get(id);
    if (!mat) {
      const texture = new THREE.TextureLoader().load(itemIconURL(id));
      texture.magFilter = THREE.NearestFilter;
      texture.minFilter = THREE.NearestFilter;
      texture.generateMipmaps = false;
      mat = new THREE.MeshLambertMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
      this._iconMaterials.set(id, mat);
    }
    return mat;
  }

  spawnItem(id, count, x, y, z, dur) {
    let mesh;
    let size;
    if (id < 100) {
      size = 0.25;
      mesh = new THREE.Mesh(this._blockGeometry(id), this._blockMaterial);
    } else {
      size = 0.4;
      mesh = new THREE.Mesh(this._planeGeo, this._iconMaterial(id));
    }
    mesh.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(mesh);
    this.items.push({
      id,
      count,
      dur,
      size,
      body: new Body(x, y, z, size, size),
      mesh,
      vel: {
        x: (Math.random() - 0.5) * 2.4,
        y: 2.2 + Math.random() * 1.2,
        z: (Math.random() - 0.5) * 2.4
      },
      age: 0,
      phase: Math.random() * Math.PI * 2
    });
  }

  spawnFallingSand(x, y, z) {
    if (!this._sandGeo) {
      this._sandGeo = new THREE.BoxGeometry(1, 1, 1);
      this._applyBoxUVs(
        this._sandGeo,
        this.atlas.uv(BLOCK.SAND, "top"),
        this.atlas.uv(BLOCK.SAND, "side"),
        this.atlas.uv(BLOCK.SAND, "bottom")
      );
    }
    const mesh = new THREE.Mesh(this._sandGeo, this._blockMaterial);
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.scene.add(mesh);
    this.sands.push({
      body: new Body(x + 0.5, y, z + 0.5, 1, 1),
      mesh,
      vel: { y: 0 }
    });
  }

  update(dt, playerPos) {
    const px = playerPos.x;
    const py = playerPos.y + 0.9;
    const pz = playerPos.z;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.age += dt;
      if (it.age >= 300) {
        this.scene.remove(it.mesh);
        this.items.splice(i, 1);
        continue;
      }

      const dx = px - it.body.x;
      const dy = py - (it.body.y + it.size / 2);
      const dz = pz - it.body.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      if (dist < 0.5) {
        for (const cb of this._pickupCallbacks) cb(it.id, it.count, it.dur);
        this.scene.remove(it.mesh);
        this.items.splice(i, 1);
        continue;
      }

      if (dist < 1.4) {
        const move = (7 * dt) / dist;
        it.body.x += dx * move;
        it.body.y += dy * move;
        it.body.z += dz * move;
      } else {
        it.vel.y -= PHYS.GRAVITY * dt;
        const res = moveBody(this.world, it.body, it.vel.x, it.vel.y, it.vel.z, dt);
        if (res.onGround) {
          it.vel.y = 0;
          it.vel.x *= Math.max(0, 1 - 10 * dt);
          it.vel.z *= Math.max(0, 1 - 10 * dt);
        }
        if (res.hitY && it.vel.y > 0) it.vel.y = 0;
      }

      it.mesh.position.set(
        it.body.x,
        it.body.y + it.size / 2 + Math.sin(it.age * 2 + it.phase) * 0.06,
        it.body.z
      );
      it.mesh.rotation.y += dt * 1.5;
    }

    for (let i = this.sands.length - 1; i >= 0; i--) {
      const fs = this.sands[i];
      fs.vel.y -= PHYS.GRAVITY * dt;
      const res = moveBody(this.world, fs.body, 0, fs.vel.y, 0, dt);
      fs.mesh.position.set(fs.body.x, fs.body.y + 0.5, fs.body.z);
      if (res.hitY && fs.vel.y < 0) {
        const fx = Math.floor(fs.body.x);
        const fy = Math.floor(fs.body.y);
        const fz = Math.floor(fs.body.z);
        let writeY = fy;
        if (this.world.getBlock(fx, fy, fz) !== BLOCK.AIR) {
          writeY = -1;
          for (let sy = fy - 1; sy >= 0; sy--) {
            if (this.world.getBlock(fx, sy, fz) !== BLOCK.AIR) {
              writeY = sy + 1;
              break;
            }
          }
          if (writeY < 0) writeY = fy;
        }
        this.world.setBlock(fx, writeY, fz, BLOCK.SAND);
        this.scene.remove(fs.mesh);
        this.sands.splice(i, 1);
      }
    }
  }

  onPickup(cb) {
    this._pickupCallbacks.push(cb);
  }

  clear() {
    for (const it of this.items) this.scene.remove(it.mesh);
    for (const fs of this.sands) this.scene.remove(fs.mesh);
    this.items = [];
    this.sands = [];
  }
}
