import { mulberry32 } from "./config.js";

const TILE = 16;
const GRID = 8;
const SIZE = 128;
const INSET = 0.5 / SIZE;

const TILE_COLORS = [
  "#dbcf9c",
  "#d9c27e",
  "#e1cd8a",
  "#8b8b8b",
  "#6b4828",
  "#8c6b48",
  "#5a8f3a",
  "#c19a6b",
  "#3a3a3a"
];

function shade(hex, f) {
  const r = Math.round(Math.min(255, Math.max(0, parseInt(hex.slice(1, 3), 16) * f)));
  const g = Math.round(Math.min(255, Math.max(0, parseInt(hex.slice(3, 5), 16) * f)));
  const b = Math.round(Math.min(255, Math.max(0, parseInt(hex.slice(5, 7), 16) * f)));
  return "rgb(" + r + "," + g + "," + b + ")";
}

function tileFor(blockId, face) {
  switch (blockId) {
    case 1: return 0;
    case 2: return face === "side" ? 1 : 2;
    case 3: return 3;
    case 4: return face === "side" ? 4 : 5;
    case 5: return 6;
    case 6: return 7;
    case 7: return 8;
    default: return 0;
  }
}

function paintAtlas(ctx) {
  for (let i = 0; i < TILE_COLORS.length; i++) paintTile(ctx, i);
}

function paintTile(ctx, idx) {
  const rand = mulberry32(123456 + idx);
  const x = (idx % GRID) * TILE;
  const y = ((idx / GRID) | 0) * TILE;
  const base = TILE_COLORS[idx];

  ctx.fillStyle = base;
  ctx.fillRect(x, y, TILE, TILE);

  const specks = 10 + Math.floor(rand() * 6);
  for (let s = 0; s < specks; s++) {
    const px = Math.floor(rand() * TILE);
    const py = Math.floor(rand() * TILE);
    const size = 1 + Math.floor(rand() * 2);
    ctx.fillStyle = shade(base, 0.72 + rand() * 0.35);
    ctx.fillRect(x + px, y + py, size, size);
  }

  if (idx === 1) {
    ctx.fillStyle = "rgba(0,0,0,0.14)";
    for (let band = 0; band < 3; band++) {
      const by = 2 + Math.floor(rand() * 4) + band * 5;
      ctx.fillRect(x, y + by, TILE, 1);
    }
    ctx.fillStyle = "rgba(255,255,255,0.10)";
    ctx.fillRect(x, y + 5, TILE, 1);
    ctx.fillRect(x, y + 12, TILE, 1);
  }

  if (idx === 2) {
    ctx.fillStyle = "rgba(0,0,0,0.16)";
    ctx.fillRect(x, y, TILE, 1);
    ctx.fillRect(x, y + TILE - 1, TILE, 1);
    ctx.fillRect(x, y, 1, TILE);
    ctx.fillRect(x + TILE - 1, y, 1, TILE);
    ctx.fillStyle = "rgba(0,0,0,0.08)";
    ctx.fillRect(x + 2, y + 6, TILE - 4, 1);
    ctx.fillRect(x + 2, y + 10, TILE - 4, 1);
  }

  if (idx === 3) {
    ctx.fillStyle = shade(base, 0.6);
    for (let c = 0; c < 4; c++) {
      const px = 1 + Math.floor(rand() * (TILE - 3));
      const py = 1 + Math.floor(rand() * (TILE - 3));
      ctx.fillRect(x + px, y + py, 2, 2);
    }
    ctx.fillStyle = shade(base, 1.2);
    ctx.fillRect(x + Math.floor(rand() * (TILE - 4)) + 2, y + Math.floor(rand() * (TILE - 4)) + 2, 2, 1);
  }

  if (idx === 4) {
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    for (let stripe = 0; stripe < 4; stripe++) {
      const sx = 1 + Math.floor(rand() * (TILE - 2));
      ctx.fillRect(x + sx, y, 1, TILE);
    }
    ctx.fillStyle = shade(base, 1.25);
    ctx.fillRect(x + 3 + Math.floor(rand() * 8), y, 1, TILE);
  }

  if (idx === 5) {
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
    ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
    ctx.fillStyle = shade(base, 0.7);
    ctx.fillRect(x + 7, y + 7, 2, 2);
  }

  if (idx === 7) {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(x, y + 4, TILE, 1);
    ctx.fillRect(x, y + 10, TILE, 1);
    ctx.fillRect(x + 4, y, 1, 4);
    ctx.fillRect(x + 11, y + 5, 1, 5);
    ctx.fillRect(x + 6, y + 11, 1, 5);
  }

  if (idx === 8) {
    for (let py = 0; py < TILE; py += 2) {
      for (let px = 0; px < TILE; px += 2) {
        ctx.fillStyle = ((px + py) % 4 === 0) ? shade(base, 0.45) : shade(base, 1.5);
        ctx.fillRect(x + px + (py % 4 === 0 ? 0 : 1), y + py, 2, 2);
      }
    }
  }

  if (idx === 6) {
    for (let py = 0; py < TILE; py++) {
      for (let px = 0; px < TILE; px++) {
        if (rand() < 0.15) ctx.clearRect(x + px, y + py, 1, 1);
      }
    }
  }
}

function makeAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  paintAtlas(canvas.getContext("2d"));

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;

  function uv(blockId, face) {
    const tile = tileFor(blockId, face);
    const col = tile % GRID;
    const row = (tile / GRID) | 0;
    // CanvasTexture flips Y on upload, so v is measured from the canvas bottom.
    const u0 = col / GRID + INSET;
    const u1 = (col + 1) / GRID - INSET;
    const v0 = 1 - (row + 1) / GRID + INSET;
    const v1 = 1 - row / GRID - INSET;
    return [u0, v0, u1, v1];
  }

  return { texture, uv };
}

function drawItemArt(ctx, itemId) {
  if (itemId === 100) {
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(14, 4, 4, 22);
    ctx.fillRect(10, 8, 4, 22);
    return;
  }
  if (itemId === 101 || itemId === 102) {
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(14, 6, 4, 22);
    ctx.fillStyle = itemId === 101 ? "#a08050" : "#8b8b8b";
    ctx.fillRect(4, 2, 24, 4);
    ctx.fillRect(2, 6, 6, 4);
    ctx.fillRect(24, 6, 6, 4);
    return;
  }
  if (itemId === 103 || itemId === 104) {
    ctx.fillStyle = itemId === 103 ? "#a08050" : "#9a9a9a";
    ctx.fillRect(12, 2, 5, 18);
    ctx.fillRect(9, 5, 5, 18);
    ctx.fillStyle = "#6b4828";
    ctx.fillRect(8, 18, 12, 3);
    ctx.fillRect(13, 20, 4, 8);
    return;
  }
  if (itemId === 105) {
    ctx.fillStyle = "#4a7a2a";
    ctx.fillRect(15, 2, 2, 24);
    ctx.fillStyle = "#d65c26";
    ctx.fillRect(9, 7, 5, 5);
    ctx.fillRect(18, 9, 5, 5);
    ctx.fillRect(11, 14, 5, 5);
    ctx.fillRect(17, 16, 5, 5);
    ctx.fillStyle = "#b34418";
    ctx.fillRect(10, 8, 2, 2);
    ctx.fillRect(19, 10, 2, 2);
  }
}

function itemIconURL(itemId) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  if (itemId >= 1 && itemId <= 7) {
    const src = document.createElement("canvas");
    src.width = SIZE;
    src.height = SIZE;
    paintAtlas(src.getContext("2d"));
    const tile = tileFor(itemId, "side");
    const col = tile % GRID;
    const row = (tile / GRID) | 0;
    ctx.drawImage(src, col * TILE, row * TILE, TILE, TILE, 0, 0, 32, 32);
  } else {
    drawItemArt(ctx, itemId);
  }
  return canvas.toDataURL("image/png");
}

export { makeAtlas, itemIconURL };
