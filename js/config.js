export const WX = 160;
export const WY = 64;
export const WZ = 160;
export const CHUNK = 16;
export const CHUNKS_X = 10;
export const CHUNKS_Z = 10;

export const BLOCK = {
  AIR: 0,
  SAND: 1,
  SANDSTONE: 2,
  STONE: 3,
  LOG: 4,
  LEAVES: 5,
  PLANKS: 6,
  BEDROCK: 7
};

export const ITEM = {
  STICK: 100,
  WOOD_PICK: 101,
  STONE_PICK: 102,
  WOOD_SWORD: 103,
  STONE_SWORD: 104,
  DATES: 105
};

export const PHYS = {
  GRAVITY: 32,
  JUMP: 9.2,
  WALK: 4.3,
  SNEAK: 1.6,
  REACH: 5,
  EYE: 1.62,
  PLAYER_W: 0.6,
  PLAYER_H: 1.8
};

export const DAY_SEC = 480;
export const NIGHT_SEC = 300;
export const BLEND_SEC = 25;

export const MOB = {
  MAX_ALIVE: 8,
  SPAWN_MIN: 24,
  SPAWN_MAX: 48,
  HP: 10,
  SPEED: 2.3,
  DMG: 3,
  ATTACK_CD: 1.0,
  AGGRO: 16,
  DESPAWN: 64
};

export const WINP = { BASE: 15, LAYERS: 8 };

export const MAX_STACK = 64;
export const TOOL_DUR = { wood: 60, stone: 132 };

export const PAGES_URL = "https://willpatpost.github.io/pyramid-builder/";
export const VERSION = "0.1.0";

export function mulberry32(seed) {
  let state = seed >>> 0;
  return function () {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash2(seed, x, z) {
  let h = seed;
  h = Math.imul(h ^ 0x6D2B79F5, 0x85EBCA6B);
  h = Math.imul(h ^ (h >>> 16), 0xC2B2AE35);
  h = h ^ Math.imul(x ^ 0x6D2B79F5, 0x85EBCA6B);
  h = Math.imul(h ^ (h >>> 16), 0xC2B2AE35);
  h = h ^ Math.imul(z ^ 0x6D2B79F5, 0x85EBCA6B);
  h = Math.imul(h ^ (h >>> 16), 0xC2B2AE35);
  h = h ^ (h >>> 15);
  return (h >>> 0) / 4294967296;
}
