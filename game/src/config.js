// SOLMARA — fixed tuning for the whole game. Every module reads these
// numbers from here and nowhere else, so balance changes in one place.

export const CONFIG = {
  city: { size: 420, block: 42, roadWidth: 12, blocks: 9 },
  colors: {
    skyTop: 0x35507a, skyHorizon: 0xff9a3c, sun: 0xffb347,
    road: 0x23272e, sidewalk: 0x9aa0a8, ground: 0x3d5a3a,
    sea: 0x1d5f7a, sand: 0xd9c08a,
    buildingPalette: [0x8a6f5c, 0x6f7d8a, 0x9a8a6f, 0x7a6f8a, 0xb08a5c, 0x5c7a8a],
    windowLit: 0xffd27a, windowDark: 0x2a3542
  },
  player: { walkSpeed: 6, runSpeed: 10, health: 100 },
  car: { accel: 20, brake: 32, maxSpeed: 40, reverseMax: 12, turn: 2.4 },
  traffic: { count: 14 },
  peds: { count: 22 },
  police: { maxCars: 6, heliSpeed: 24, roadblockAtStars: 3 },
  money: { start: 500 },
  camera: { dist: 10, height: 5, lookHeight: 1.6 }
};

// Lock the tuning table (shallow-freeze each section, then the root) so no
// module can retune the game by accident at runtime.
for (const key of Object.keys(CONFIG)) Object.freeze(CONFIG[key]);
Object.freeze(CONFIG);
