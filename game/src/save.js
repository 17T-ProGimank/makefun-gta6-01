// save.js — localStorage save/load + autosave for SOLMARA (gta6-01, session C)
// Key: 'solmara-save-v1'. Written fresh; no imports from other modules.

const SAVE_KEY = 'solmara-save-v1';
const AUTOSAVE_MS = 30000;

function buildSaveData(G) {
  return {
    version: 1,
    savedAt: Date.now(),
    money: G.state.money,
    missionIndex: G.state.missionIndex,
    health: G.state.health,
    kills: G.state.kills || 0,
    carsStolen: G.state.carsStolen || 0,
    time: G.state.time || 0,
    player: {
      x: G.player.pos.x,
      z: G.player.pos.z,
      heading: G.player.heading || 0,
    },
    inVehicle: !!G.state.inVehicle,
  };
}

function applySaveData(G, data) {
  if (!data || typeof data !== 'object') return false;
  // Reject saves from a different/unknown format version.
  if (data.version !== 1) return false;
  if (typeof data.money === 'number') G.state.money = data.money;
  if (typeof data.missionIndex === 'number') {
    G.state.missionIndex = Math.max(0, Math.min(8, Math.floor(data.missionIndex)));
  }
  if (typeof data.health === 'number') {
    G.state.health = Math.max(1, Math.min(100, data.health));
  }
  if (typeof data.kills === 'number') G.state.kills = data.kills;
  if (typeof data.carsStolen === 'number') G.state.carsStolen = data.carsStolen;
  if (typeof data.time === 'number') G.state.time = data.time;
  if (data.player && typeof data.player.x === 'number' && typeof data.player.z === 'number') {
    G.player.pos.x = data.player.x;
    G.player.pos.z = data.player.z;
    if (G.player.group) {
      G.player.group.position.x = data.player.x;
      G.player.group.position.z = data.player.z;
    }
    if (typeof data.player.heading === 'number') {
      G.player.heading = data.player.heading;
      if (G.player.group) G.player.group.rotation.y = data.player.heading;
    }
    // Never restore the player inside a car: the car may not exist on a
    // fresh load, so always resume on foot at the saved spot.
    G.player.onFoot = true;
    G.state.inVehicle = null;
  }
  return true;
}

export function saveGame(G) {
  try {
    const data = buildSaveData(G);
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    return false;
  }
}

export function loadGame(G) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    return applySaveData(G, data);
  } catch (e) {
    return false;
  }
}

export function resetSave(G) {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {
    // Storage unavailable — nothing to clear.
  }
  G.state.money = G.config.money.start;
  G.state.missionIndex = 0;
  G.state.health = G.config.player.health;
  G.state.kills = 0;
  G.state.carsStolen = 0;
  G.state.time = 0;
  G.state.wanted = 0;
  if (G.city.spawnPoints && G.city.spawnPoints.garage) {
    G.player.pos.x = G.city.spawnPoints.garage.x;
    G.player.pos.z = G.city.spawnPoints.garage.z;
    if (G.player.group) {
      G.player.group.position.x = G.player.pos.x;
      G.player.group.position.z = G.player.pos.z;
    }
  }
  G.player.heading = 0;
  G.player.onFoot = true;
  G.state.inVehicle = null;
  return true;
}

export function initSave(G) {
  G.helpers.saveGame = function () { return saveGame(G); };
  G.helpers.loadGame = function () { return loadGame(G); };
  // Load any existing save and apply it at startup.
  loadGame(G);
  // Autosave every 30s while the game is running.
  G.save = G.save || {};
  G.save._timer = setInterval(function () {
    if (G.state.started && !G.state.gameOver) saveGame(G);
  }, AUTOSAVE_MS);
}
