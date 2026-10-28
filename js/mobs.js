import { MOB, PHYS, BLOCK, WX, WY, WZ } from "./config.js";
import { Body, moveBody } from "./physics.js";

function rayBoxT(ox, oy, oz, dx, dy, dz, minX, minY, minZ, maxX, maxY, maxZ) {
  let t0 = 0;
  let t1 = Infinity;
  if (dx === 0) {
    if (ox < minX || ox > maxX) return null;
  } else {
    let ta = (minX - ox) / dx;
    let tb = (maxX - ox) / dx;
    if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
  }
  if (dy === 0) {
    if (oy < minY || oy > maxY) return null;
  } else {
    let ta = (minY - oy) / dy;
    let tb = (maxY - oy) / dy;
    if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
  }
  if (dz === 0) {
    if (oz < minZ || oz > maxZ) return null;
  } else {
    let ta = (minZ - oz) / dz;
    let tb = (maxZ - oz) / dz;
    if (ta > tb) { const tmp = ta; ta = tb; tb = tmp; }
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
  }
  if (t0 > t1) return null;
  return t0;
}

export class Mobs {
  constructor(scene, world, dayNight) {
    this.scene = scene;
    this.world = world;
    this.dayNight = dayNight;
    this.mummies = [];
    this._dropCallbacks = [];
    this._spawnTimer = 0;
    this._texture = this._makeBandageTexture();
  }

  _makeBandageTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#d8c8a8";
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = "#bfae8c";
    for (let y = 0; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
    ctx.fillStyle = "#c9b894";
    for (let y = 2; y < 16; y += 4) ctx.fillRect(0, y, 16, 1);
    ctx.fillStyle = "rgba(150, 138, 112, 0.5)";
    for (let i = 0; i < 22; i++) {
      ctx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.generateMipmaps = false;
    return texture;
  }

  _makeMummy() {
    const group = new THREE.Group();
    const material = new THREE.MeshLambertMaterial({ map: this._texture });

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), material);
    head.position.y = 1.6;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), material);
    torso.position.y = 1.15;

    const armGeo = new THREE.BoxGeometry(0.18, 0.65, 0.18);
    armGeo.translate(0, -0.325, 0);
    const leftArm = new THREE.Mesh(armGeo, material);
    leftArm.position.set(0.34, 1.45, 0);
    const rightArm = new THREE.Mesh(armGeo, material);
    rightArm.position.set(-0.34, 1.45, 0);

    const legGeo = new THREE.BoxGeometry(0.2, 0.8, 0.2);
    legGeo.translate(0, -0.4, 0);
    const leftLeg = new THREE.Mesh(legGeo, material);
    leftLeg.position.set(0.13, 0.8, 0);
    const rightLeg = new THREE.Mesh(legGeo, material);
    rightLeg.position.set(-0.13, 0.8, 0);

    group.add(head, torso, leftArm, rightArm, leftLeg, rightLeg);
    this.scene.add(group);
    return { group, material, leftArm, rightArm, leftLeg, rightLeg };
  }

  _spawn(x, y, z) {
    const mesh = this._makeMummy();
    mesh.group.position.set(x, y, z);
    this.mummies.push({
      body: new Body(x, y, z, 0.6, 1.8),
      mesh,
      hp: MOB.HP,
      vel: { x: 0, y: 0, z: 0 },
      wanderHeading: Math.random() * Math.PI * 2,
      wanderTimer: 2 + Math.random() * 4,
      attackCd: 0,
      flash: 0,
      walkPhase: Math.random() * Math.PI * 2,
      sinking: false,
      sinkTimer: 0
    });
  }

  _remove(i) {
    this.scene.remove(this.mummies[i].mesh.group);
    this.mummies.splice(i, 1);
  }

  update(dt, playerPos, damagePlayer) {
    this._trySpawn(dt, playerPos);
    const night = this.dayNight.isNight();

    for (let i = this.mummies.length - 1; i >= 0; i--) {
      const m = this.mummies[i];
      const dx = playerPos.x - m.body.x;
      const dz = playerPos.z - m.body.z;
      const hDist = Math.sqrt(dx * dx + dz * dz);

      if (hDist > MOB.DESPAWN) {
        this._remove(i);
        continue;
      }

      if (!night && !m.sinking) {
        m.sinking = true;
        m.sinkTimer = 0;
        m.vel.x = 0;
        m.vel.z = 0;
      }

      if (m.sinking) {
        m.sinkTimer += dt;
        m.mesh.group.position.set(m.body.x, m.body.y - Math.min(1, m.sinkTimer / 1.5), m.body.z);
        if (m.sinkTimer >= 1.5) this._remove(i);
        continue;
      }

      m.vel.y -= PHYS.GRAVITY * dt;

      let speed;
      if (hDist < MOB.AGGRO) {
        const inv = 1 / (hDist || 1e-9);
        m.vel.x = dx * inv * MOB.SPEED;
        m.vel.z = dz * inv * MOB.SPEED;
        m.mesh.group.rotation.y = Math.atan2(dx, dz);
        speed = MOB.SPEED;
      } else {
        m.wanderTimer -= dt;
        if (m.wanderTimer <= 0) {
          m.wanderHeading = Math.random() * Math.PI * 2;
          m.wanderTimer = 2 + Math.random() * 4;
        }
        m.vel.x = Math.cos(m.wanderHeading) * (MOB.SPEED / 2);
        m.vel.z = Math.sin(m.wanderHeading) * (MOB.SPEED / 2);
        m.mesh.group.rotation.y = m.wanderHeading;
        speed = MOB.SPEED / 2;
      }

      if (hDist < 1.3 && Math.abs(m.body.y - playerPos.y) < 1.8 && m.attackCd <= 0) {
        damagePlayer(MOB.DMG);
        m.attackCd = MOB.ATTACK_CD;
      }
      if (m.attackCd > 0) m.attackCd -= dt;

      const res = moveBody(this.world, m.body, m.vel.x, m.vel.y, m.vel.z, dt);
      if (res.onGround) m.vel.y = 0;
      if (res.hitY && m.vel.y > 0) m.vel.y = 0;
      if ((res.hitX || res.hitZ) && res.onGround) m.vel.y = PHYS.JUMP * 0.8;

      m.mesh.group.position.set(m.body.x, m.body.y, m.body.z);

      m.walkPhase += speed * dt * 4;
      const swing = Math.sin(m.walkPhase) * 0.6;
      m.mesh.leftArm.rotation.x = swing;
      m.mesh.rightArm.rotation.x = -swing;
      m.mesh.leftLeg.rotation.x = -swing;
      m.mesh.rightLeg.rotation.x = swing;

      if (m.flash > 0) {
        m.flash -= dt;
        if (m.flash <= 0) m.mesh.material.emissive.setHex(0x000000);
      }
    }
  }

  _trySpawn(dt, playerPos) {
    if (!this.dayNight.isNight() || this.aliveCount() >= MOB.MAX_ALIVE) return;
    this._spawnTimer += dt;
    if (this._spawnTimer < 1) return;
    this._spawnTimer -= 1;
    for (let attempt = 0; attempt < 8; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = MOB.SPAWN_MIN + Math.random() * (MOB.SPAWN_MAX - MOB.SPAWN_MIN);
      const x = playerPos.x + Math.cos(angle) * radius;
      const z = playerPos.z + Math.sin(angle) * radius;
      if (x < 2 || x > WX - 2 || z < 2 || z > WZ - 2) continue;
      const gx = Math.round(x);
      const gz = Math.round(z);
      const gy = this.world.heightAt(gx, gz);
      if (gy < 1 || gy > WY - 3) continue;
      const ground = this.world.getBlock(gx, gy - 1, gz);
      if (ground !== BLOCK.SAND && ground !== BLOCK.STONE) continue;
      if (this.world.getBlock(gx, gy, gz) !== BLOCK.AIR) continue;
      if (this.world.getBlock(gx, gy + 1, gz) !== BLOCK.AIR) continue;
      if (this.world.getBlock(gx, gy + 2, gz) !== BLOCK.AIR) continue;
      this._spawn(gx + 0.5, gy, gz + 0.5);
      return;
    }
  }

  attackAt(origin, dir, reach, dmg) {
    const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y + dir.z * dir.z);
    if (len === 0) return false;
    const dx = dir.x / len;
    const dy = dir.y / len;
    const dz = dir.z / len;

    let best = null;
    let bestT = reach;
    for (const m of this.mummies) {
      const t = rayBoxT(
        origin.x, origin.y, origin.z, dx, dy, dz,
        m.body.x - 0.3, m.body.y, m.body.z - 0.3,
        m.body.x + 0.3, m.body.y + 1.8, m.body.z + 0.3
      );
      if (t !== null && t >= 0 && t < bestT) {
        bestT = t;
        best = m;
      }
    }

    if (!best) return false;

    best.hp -= dmg;
    best.flash = 0.15;
    best.mesh.material.emissive.setHex(0xcc2020);
    best.vel.x += dx * 6;
    best.vel.z += dz * 6;
    best.vel.y = 4;

    if (best.hp <= 0) {
      const n = Math.floor(Math.random() * 3);
      for (const cb of this._dropCallbacks) {
        cb(BLOCK.SAND, n, best.body.x, best.body.y + 0.5, best.body.z);
      }
      this._remove(this.mummies.indexOf(best));
    }
    return true;
  }

  onDrop(cb) {
    this._dropCallbacks.push(cb);
  }

  aliveCount() {
    let n = 0;
    for (const m of this.mummies) {
      if (!m.sinking) n++;
    }
    return n;
  }

  clear() {
    for (let i = this.mummies.length - 1; i >= 0; i--) this._remove(i);
  }
}
