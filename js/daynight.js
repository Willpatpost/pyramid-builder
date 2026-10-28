import { DAY_SEC, NIGHT_SEC, BLEND_SEC } from "./config.js";

const DAY_COLOR = 0x87ceeb;
const DUSK_COLOR = 0xe8955c;
const NIGHT_COLOR = 0x0a0e1a;

function canvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

function sunTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(32, 32, 6, 32, 32, 30);
  grad.addColorStop(0, "rgba(255, 236, 170, 1)");
  grad.addColorStop(0.55, "rgba(255, 200, 90, 0.95)");
  grad.addColorStop(1, "rgba(255, 170, 60, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return canvasTexture(canvas);
}

function moonTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#c8d2dc";
  ctx.beginPath();
  ctx.arc(32, 32, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#a9b3be";
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 17;
    ctx.beginPath();
    ctx.arc(32 + Math.cos(a) * r, 32 + Math.sin(a) * r, 2 + Math.random() * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvasTexture(canvas);
}

function makeStars() {
  const positions = new Float32Array(300 * 3);
  for (let i = 0; i < 300; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = 0.04 + Math.random() * (Math.PI / 2 - 0.04);
    const r = 120;
    positions[i * 3] = r * Math.cos(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi);
    positions[i * 3 + 2] = r * Math.cos(phi) * Math.sin(theta);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 2,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    fog: false
  });
  return new THREE.Points(geometry, material);
}

export class DayNight {
  constructor(scene) {
    this.scene = scene;
    this.t = 0;
    this._total = DAY_SEC + BLEND_SEC + NIGHT_SEC + BLEND_SEC;

    this.sunLight = new THREE.DirectionalLight(0xffffff, 0.9);
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    scene.add(this.sunLight);
    scene.add(this.ambientLight);

    this.sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTexture(), depthWrite: false, fog: false }));
    this.sunSprite.scale.set(16, 16, 1);
    this.moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: moonTexture(), depthWrite: false, fog: false }));
    this.moonSprite.scale.set(12, 12, 1);
    this.stars = makeStars();
    scene.add(this.sunSprite);
    scene.add(this.moonSprite);
    scene.add(this.stars);

    scene.background = new THREE.Color(DAY_COLOR);
    scene.fog = new THREE.Fog(DAY_COLOR, 40, 140);
    this._day = new THREE.Color(DAY_COLOR);
    this._dusk = new THREE.Color(DUSK_COLOR);
    this._night = new THREE.Color(NIGHT_COLOR);
  }

  update(dt, playerPos) {
    this.t += dt;
    if (this.t >= this._total) this.t -= this._total;
    const t = this.t;

    let dark;
    if (t < DAY_SEC) dark = 0;
    else if (t < DAY_SEC + BLEND_SEC) dark = (t - DAY_SEC) / BLEND_SEC;
    else if (t < DAY_SEC + BLEND_SEC + NIGHT_SEC) dark = 1;
    else dark = 1 - (t - DAY_SEC - BLEND_SEC - NIGHT_SEC) / BLEND_SEC;

    this.sunLight.intensity = 0.9 - 0.78 * dark;
    this.ambientLight.intensity = 0.65 - 0.47 * dark;

    const bg = this.scene.background;
    if (dark <= 0.5) bg.copy(this._day).lerp(this._dusk, dark * 2);
    else bg.copy(this._dusk).lerp(this._night, (dark - 0.5) * 2);
    this.scene.fog.color.copy(bg);

    this.stars.material.opacity = dark;
    this.stars.position.set(playerPos.x, playerPos.y, playerPos.z);

    const sunAngle = t < DAY_SEC
      ? Math.PI * (t / DAY_SEC)
      : Math.PI + Math.PI * ((t - DAY_SEC) / (this._total - DAY_SEC));
    const moonAngle = sunAngle + Math.PI;

    this.sunSprite.position.set(
      playerPos.x + Math.cos(sunAngle) * 90,
      playerPos.y + Math.sin(sunAngle) * 80,
      playerPos.z + 35
    );
    this.moonSprite.position.set(
      playerPos.x + Math.cos(moonAngle) * 90,
      playerPos.y + Math.sin(moonAngle) * 80,
      playerPos.z - 35
    );

    const lightAngle = Math.sin(sunAngle) >= Math.sin(moonAngle) ? sunAngle : moonAngle;
    this.sunLight.position.set(Math.cos(lightAngle) * 100, Math.sin(lightAngle) * 100, 35);
  }

  isNight() {
    const duskMid = DAY_SEC + BLEND_SEC / 2;
    const nightEnd = DAY_SEC + BLEND_SEC + NIGHT_SEC;
    return this.t >= duskMid && this.t < nightEnd;
  }

  phase01() {
    return this.t / this._total;
  }

  reset() {
    this.t = 0;
  }
}
