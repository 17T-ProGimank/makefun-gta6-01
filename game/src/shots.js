// shots.js — screenshot poses for SOLMARA (session E, gta6-01)
// applyShot(G, name): poses the live game for one of four moments, called
// by main.js 1.2s after load when the URL carries ?shot=<name>.
// Every pose starts the run (hides the start menu, HUD stays on) and places
// Dante, his car, the wanted level, the objective and the camera using the
// same G every other module uses — no parallel state, no second scene.

import { spawnEnemy } from './combat.js';

function startRun(G) {
  G.state.started = true;
  G.state.paused = false;
  G.state.gameOver = false;
  G._shotCam = null;
  for (const id of ['menu-start', 'menu-pause', 'menu-gameover']) {
    const m = document.getElementById(id);
    if (m) m.style.display = 'none';
  }
}

function playerCar(G) {
  return (G.cars || []).find((c) => c.kind === 'player') || null;
}

function trafficCars(G) {
  return (G.cars || []).filter((c) => c.kind === 'traffic');
}

function putPlayerInCar(G, car, x, z, heading, speed) {
  car.pos.set(x, 0, z);
  car.heading = heading;
  car.group.rotation.y = heading;
  car.speed = speed || 0;
  G.player.onFoot = false;
  G.player.group.visible = false;
  G.player.pos.copy(car.pos);
  G.player.heading = heading;
  G.state.inVehicle = car;
}

function putPlayerOnFoot(G, x, z, heading) {
  G.state.inVehicle = null;
  G.player.onFoot = true;
  G.player.group.visible = true;
  G.player.pos.set(x, 0, z);
  G.player.heading = heading;
  G.player.group.rotation.y = heading;
}

// Park a traffic car on an east-west road line (axis 'x', lane = the road's
// z) with its AI state matching, so it keeps driving instead of snapping.
function placeTraffic(G, spots) {
  const cars = trafficCars(G);
  spots.forEach((s, i) => {
    const car = cars[i];
    if (!car) return;
    car._axis = 'x';
    car._lane = s.z;
    car._dir = s.dir || 1;
    car.pos.set(s.x, 0, s.z);
    car.heading = car._dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    car.group.rotation.y = car.heading;
    car.speed = 8 + Math.random() * 4;
    car._stopTimer = 0;
  });
}

function setWanted(G, n) {
  if (G.helpers && G.helpers.setWanted) G.helpers.setWanted(n);
  else G.state.wanted = n;
}

// Snap the camera to the chase position right now. The chase camera in
// main.js only lerps toward its target, and under a slow software renderer
// a screenshot can land while it is still descending from the menu orbit —
// snapping here makes every pose frame correctly from the first frame.
function snapCamera(G) {
  if (!G.camera) return;
  if (G._shotCam) {
    G.camera.position.copy(G._shotCam.pos);
    G.camera.lookAt(G._shotCam.look);
    return;
  }
  const focus = G.state.inVehicle || G.player;
  if (!focus || !focus.pos) return;
  const h = focus.heading || 0;
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  const dist = G.config.camera.dist;
  const height = G.config.camera.height;
  G.camera.position.set(
    focus.pos.x - fx * dist,
    focus.pos.y + height,
    focus.pos.z - fz * dist
  );
  G.camera.lookAt(
    focus.pos.x,
    focus.pos.y + G.config.camera.lookHeight,
    focus.pos.z
  );
}

function banner(G, title, sub) {
  // 9s so the banner is still on screen when the screenshot lands
  // (the pose fires at 1.2s, the shot is taken at ~5s virtual time).
  if (G.helpers && G.helpers.showBanner) G.helpers.showBanner(title, sub, 9000);
}

// cover: high-speed police chase downtown — wanted 3, AIR-1 overhead,
// Dante eastbound on road z=0 with traffic to weave through.
function poseCover(G) {
  startRun(G);
  const car = playerCar(G);
  if (car) putPlayerInCar(G, car, -54, 0, Math.PI / 2, 26);
  setWanted(G, 3);
  G.state.money = 2450;
  G.state.missionIndex = 2; // MISSION 3/9 — Hot Wheels
  G.state.objectiveText = 'Outrun the SMPD — lose the heat';
  G.state.objectiveTarget = { x: -120, z: 150, label: 'Beach Hideout' };
  placeTraffic(G, [
    { x: 30, z: 0, dir: 1 },
    { x: 64, z: 0, dir: 1 },
    { x: 20, z: 54, dir: -1 },
  ]);
  banner(G, 'HOT WHEELS', 'Three stars. AIR-1 is overhead.');
  snapCamera(G);
}

// mission: the bank heist (mission 7) — Dante on foot at the Solmara Bank
// with the $5000 payout, wanted 2, Vultures closing in.
function poseMission(G) {
  startRun(G);
  const sp = (G.city && G.city.spawnPoints) || {};
  const downtown = sp.downtown || { x: 0, z: 0 };
  const bank = { x: downtown.x + 21, z: downtown.z };
  putPlayerOnFoot(G, bank.x + 3, bank.z + 5, Math.PI * 0.8);
  G.state.money = 5500;
  G.state.missionIndex = 6; // MISSION 7/9 — The Heist
  G.state.objectiveText = 'Escape! Get 40m from the bank with the cash';
  G.state.objectiveTarget = { x: bank.x, z: bank.z, label: 'Solmara Bank' };
  setWanted(G, 2);
  // Vultures in front of the chase camera (Dante faces north-west from the
  // bank, so they stand north/east of him), close enough to read as a threat.
  spawnEnemy(G, bank.x + 12, bank.z - 7);
  spawnEnemy(G, bank.x + 18, bank.z + 4);
  if (G.helpers && G.helpers.spawnSmoke) {
    G.helpers.spawnSmoke(new THREE.Vector3(bank.x, 1, bank.z));
  }
  banner(G, 'BANK ROBBED', '+$5000 — Run!');
  snapCamera(G);
}

// drive: coastal cruise at sunset — Dante westbound along the sand at
// z=215 (south of the palms, north of the waterline), driving INTO the
// low western sun with the sea on his left and the coast road on his
// right. The beach, not the road, is what makes the coast read on camera.
function poseDrive(G) {
  startRun(G);
  const car = playerCar(G);
  if (car) putPlayerInCar(G, car, 80, 215, -Math.PI / 2, 22);
  setWanted(G, 0);
  G.state.money = 1250;
  G.state.missionIndex = 0; // MISSION 1/9 — First Gear
  G.state.objectiveText = 'Cruise the coast — Solmara Bay at sunset';
  G.state.objectiveTarget = { x: 0, z: 196, label: 'Solmara Beach' };
  // Two cars cruising the coast road (z=162) so the drive does not feel empty.
  placeTraffic(G, [
    { x: 40, z: 162, dir: -1 },
    { x: -30, z: 162, dir: -1 },
  ]);
  banner(G, 'SOLMARA BAY', 'Golden hour on the coast road.');
  snapCamera(G);
}

// city: wide aerial of downtown + the bay at golden hour — the camera is
// pinned high over the sea looking north (main.js honours G._shotCam),
// traffic spread across the downtown grid below.
function poseCity(G) {
  startRun(G);
  const car = playerCar(G);
  if (car) putPlayerInCar(G, car, -54, 0, Math.PI / 2, 12);
  setWanted(G, 0);
  G.state.money = 500;
  G.state.missionIndex = 0;
  G.state.objectiveText = 'Solmara — a city at golden hour';
  G.state.objectiveTarget = null;
  G._shotCam = {
    // Low and far south over the water, looking north: the bay fills the
    // foreground, then the beach, then downtown and the northern hills.
    pos: new THREE.Vector3(70, 95, 330),
    look: new THREE.Vector3(-15, 0, -30),
  };
  placeTraffic(G, [
    { x: -54, z: 0, dir: 1 },
    { x: 0, z: 54, dir: 1 },
    { x: 54, z: -54, dir: -1 },
    { x: 108, z: 0, dir: 1 },
    { x: -108, z: 54, dir: -1 },
    { x: 0, z: -108, dir: 1 },
    { x: 54, z: 108, dir: -1 },
    { x: -54, z: -108, dir: 1 },
  ]);
  banner(G, 'SOLMARA', 'Downtown towers, the bay, and the hills beyond.');
  snapCamera(G);
}

export function applyShot(G, name) {
  const shot = name || new URLSearchParams(window.location.search).get('shot');
  if (!shot) return;
  G._shotApplied = shot;
  switch (shot) {
    case 'cover':
      poseCover(G);
      break;
    case 'mission':
      poseMission(G);
      break;
    case 'drive':
      poseDrive(G);
      break;
    case 'city':
      poseCity(G);
      break;
    default:
      break;
  }
}
