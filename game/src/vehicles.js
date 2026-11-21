// vehicles.js — arcade cars + traffic AI (session B, gta6-01)
// Cars built from boxes + cylinder wheels. No external models.
// Traffic follows the road grid (road lines every 54 units: block 42 +
// road 12, exactly as city.js builds them) and never leaves the road,
// so it can never clip through buildings.

// Road lines of the grid, from CONFIG.city (block 42 + roadWidth 12 = 54
// pitch, 9 lines from -216 to 216 — the same lines city.js paves).
const ROAD_LINES = [-216, -162, -108, -54, 0, 54, 108, 162, 216];

function nearestRoadLine(v) {
  let best = ROAD_LINES[0];
  let bestD = Math.abs(v - best);
  for (const line of ROAD_LINES) {
    const d = Math.abs(v - line);
    if (d < bestD) { bestD = d; best = line; }
  }
  return best;
}

function randomRoadLine() {
  return ROAD_LINES[Math.floor(Math.random() * ROAD_LINES.length)];
}

export function makeCar(G, color, kind) {
  const group = new THREE.Group();

  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x18242e, roughness: 0.15, metalness: 0.8 });
  const tyre = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95 });
  const hub = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, roughness: 0.4, metalness: 0.7 });

  // Body
  const body = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.65, 1.95), paint);
  body.position.y = 0.55;
  // Cabin
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.6, 1.7), glass);
  cabin.position.set(-0.25, 1.15, 0);
  // Roof panel (paint over the glass box so it reads as a car, not a greenhouse)
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.08, 1.6), paint);
  roof.position.set(-0.25, 1.47, 0);
  // Bumpers
  const bumperF = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 1.9), hub);
  bumperF.position.set(2.2, 0.4, 0);
  const bumperR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 1.9), hub);
  bumperR.position.set(-2.2, 0.4, 0);
  group.add(body, cabin, roof, bumperF, bumperR);

  // Wheels (cylinders, axle along Z)
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 14);
  wheelGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10);
  hubGeo.rotateX(Math.PI / 2);
  const wheelPositions = [
    [1.45, 0.95], [1.45, -0.95], [-1.45, 0.95], [-1.45, -0.95],
  ];
  const wheels = [];
  for (const [wx, wz] of wheelPositions) {
    const w = new THREE.Mesh(wheelGeo, tyre);
    w.position.set(wx, 0.36, wz);
    const h = new THREE.Mesh(hubGeo, hub);
    h.position.set(wx, 0.36, wz);
    group.add(w, h);
    wheels.push(w);
  }

  // Headlights (emissive, front = +X)
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xfff2c0, emissive: 0xffe9a0, emissiveIntensity: 1.6,
  });
  for (const hz of [0.6, -0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.34), headMat);
    lamp.position.set(2.22, 0.62, hz);
    group.add(lamp);
  }
  // Taillights (red, rear = -X)
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0xaa1111, emissive: 0xcc0000, emissiveIntensity: 1.2,
  });
  for (const hz of [0.6, -0.6]) {
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.34), tailMat);
    lamp.position.set(-2.22, 0.62, hz);
    group.add(lamp);
  }

  // Police livery: white doors + light bar
  if (kind === 'police') {
    const doorMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.3 });
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 1.97), doorMat);
    door.position.set(0.1, 0.62, 0);
    group.add(door);
    const barBase = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.1, 0.9), tyre);
    barBase.position.set(-0.25, 1.55, 0);
    const redLens = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.16, 0.4),
      new THREE.MeshStandardMaterial({ color: 0xcc0000, emissive: 0xff2222, emissiveIntensity: 2 })
    );
    redLens.position.set(-0.25, 1.66, 0.23);
    const blueLens = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, 0.16, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x0022cc, emissive: 0x2244ff, emissiveIntensity: 2 })
    );
    blueLens.position.set(-0.25, 1.66, -0.23);
    group.add(barBase, redLens, blueLens);
  }

  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  G.scene.add(group);

  const car = {
    group,
    pos: group.position,
    heading: 0,
    speed: 0,
    color,
    kind,
    mesh: group,
    wheels,
    // traffic-AI state
    _axis: 'x',
    _dir: 1,
    _lane: 0,
    _cruise: 9,
    _stopTimer: 0,
    _turnCooldown: 0,
    _steerVis: 0,
  };
  group.rotation.y = 0;
  G.cars.push(car);
  return car;
}

function spawnTrafficCar(G) {
  const palette = [0xc0392b, 0x2e6fb0, 0xd8d8d8, 0x3a3f44, 0xc9a227, 0x5b8c5a, 0x8e44ad, 0xe67e22];
  const color = palette[Math.floor(Math.random() * palette.length)];
  const car = makeCar(G, color, 'traffic');
  const axis = Math.random() < 0.5 ? 'x' : 'z';
  const lane = randomRoadLine();
  const along = (Math.random() * 2 - 1) * 180;
  if (axis === 'x') {
    car.pos.set(along, 0, lane);
    car._axis = 'x';
    car._lane = lane;
  } else {
    car.pos.set(lane, 0, along);
    car._axis = 'z';
    car._lane = lane;
  }
  car._dir = Math.random() < 0.5 ? 1 : -1;
  car.heading = axis === 'x' ? (car._dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car._dir > 0 ? 0 : Math.PI);
  car._cruise = 8 + Math.random() * 4;
  car._stopTimer = Math.random() * 4;
  car.group.rotation.y = car.heading;
  return car;
}

export function initVehicles(G) {
  G.cars.length = 0;
  // The player's own car (Dante's ride) parked on the road just south of
  // the Ember Garage — on road line z=54, never inside the garage building
  // or sunk into a sidewalk slab.
  const spawn = (G.city && G.city.spawnPoints && G.city.spawnPoints.garage) || { x: 0, z: 0 };
  const playerCar = makeCar(G, 0xd94f30, 'player');
  playerCar.pos.set(spawn.x, 0, 54);
  playerCar.heading = Math.PI / 2;
  playerCar.group.rotation.y = playerCar.heading;
  // Traffic
  const count = (G.config && G.config.traffic && G.config.traffic.count) || 14;
  for (let i = 0; i < count; i++) spawnTrafficCar(G);
}

function updatePlayerCar(G, car, dt) {
  const keys = (G.input && G.input.keys) || new Set();
  const cfg = G.config.car;

  let throttle = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) throttle += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) throttle -= 1;
  let steer = 0;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) steer += 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) steer -= 1;

  if (throttle > 0) {
    car.speed += cfg.accel * dt;
  } else if (throttle < 0) {
    if (car.speed > 0.5) car.speed -= cfg.brake * dt; // braking while moving forward
    else car.speed -= cfg.accel * 0.6 * dt; // reversing
  } else {
    // Engine drag / rolling resistance
    const drag = 8 * dt;
    if (Math.abs(car.speed) <= drag) car.speed = 0;
    else car.speed -= Math.sign(car.speed) * drag;
  }
  if (car.speed > cfg.maxSpeed) car.speed = cfg.maxSpeed;
  if (car.speed < -cfg.reverseMax) car.speed = -cfg.reverseMax;

  // Steering scales with speed and flips when reversing
  const steerAuthority = Math.min(Math.abs(car.speed) / 8, 1);
  car.heading += cfg.turn * steer * steerAuthority * Math.sign(car.speed || 1) * dt;
  car.group.rotation.y = car.heading;

  car.pos.x += Math.sin(car.heading) * car.speed * dt;
  car.pos.z += Math.cos(car.heading) * car.speed * dt;

  // Stay in the city
  const bounds = (G.city && G.city.bounds) || 210;
  if (car.pos.x > bounds) { car.pos.x = bounds; car.speed *= 0.4; }
  if (car.pos.x < -bounds) { car.pos.x = -bounds; car.speed *= 0.4; }
  if (car.pos.z > bounds) { car.pos.z = bounds; car.speed *= 0.4; }
  if (car.pos.z < -bounds) { car.pos.z = -bounds; car.speed *= 0.4; }

  // Crime: mowing down a pedestrian or ramming another car at speed draws
  // the SMPD. Throttled so one crash is one star, not one per frame.
  car._crimeCooldown = Math.max(0, (car._crimeCooldown || 0) - dt);
  if (car._crimeCooldown <= 0 && Math.abs(car.speed) > 4) {
    let hit = false;
    for (const ped of G.peds || []) {
      if (Math.hypot(ped.pos.x - car.pos.x, ped.pos.z - car.pos.z) < 2.4) {
        // Shove the pedestrian clear of the wheels instead of driving over them.
        const dx = ped.pos.x - car.pos.x;
        const dz = ped.pos.z - car.pos.z;
        const d = Math.hypot(dx, dz) || 1;
        ped.pos.x += (dx / d) * 3;
        ped.pos.z += (dz / d) * 3;
        hit = true;
        break;
      }
    }
    if (!hit) {
      for (const other of G.cars) {
        if (other === car || other.kind !== 'traffic') continue;
        if (Math.hypot(other.pos.x - car.pos.x, other.pos.z - car.pos.z) < 3.4) {
          hit = true;
          break;
        }
      }
    }
    if (hit) {
      car._crimeCooldown = 4;
      if (G.helpers && G.helpers.raiseWanted) G.helpers.raiseWanted(1);
    }
  }

  // Wheel spin + front-wheel steer visual
  const spin = (car.speed * dt) / 0.36;
  for (let i = 0; i < car.wheels.length; i++) {
    car.wheels[i].rotation.z += spin;
  }
  car._steerVis = steer * 0.35 * steerAuthority;

  G.state.speed = Math.abs(car.speed);
}

function updateTrafficCar(G, car, dt) {
  car._turnCooldown -= dt;

  // Random short stops (waiting at a light / dropping someone off)
  if (car._stopTimer > 0) {
    car._stopTimer -= dt;
    car.speed = Math.max(0, car.speed - 20 * dt);
  } else {
    // Loose player avoidance: slow down if the player car is close ahead
    let targetSpeed = car._cruise;
    const playerCar = G.state.inVehicle;
    if (playerCar) {
      const dx = playerCar.pos.x - car.pos.x;
      const dz = playerCar.pos.z - car.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 12) {
        const ahead = car._axis === 'x'
          ? Math.sign(dx) === car._dir
          : Math.sign(dz) === car._dir;
        if (ahead) targetSpeed = 0;
      }
    }
    // Car-following: don't rear-end the traffic car ahead in the same lane
    for (const other of G.cars) {
      if (other === car || other.kind !== 'traffic') continue;
      if (other._axis !== car._axis || other._lane !== car._lane || other._dir !== car._dir) continue;
      const gap = car._axis === 'x'
        ? (other.pos.x - car.pos.x) * car._dir
        : (other.pos.z - car.pos.z) * car._dir;
      if (gap > 0 && gap < 10) { targetSpeed = 0; break; }
    }
    if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + 10 * dt);
    else car.speed = Math.max(targetSpeed, car.speed - 14 * dt);
    if (Math.random() < dt * 0.05) car._stopTimer = 1 + Math.random() * 3;
  }

  // Move along the current road axis, snapped to its lane
  if (car._axis === 'x') {
    car.pos.x += car._dir * car.speed * dt;
    car.pos.z = car._lane;
    car.heading = car._dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    car.pos.z += car._dir * car.speed * dt;
    car.pos.x = car._lane;
    car.heading = car._dir > 0 ? 0 : Math.PI;
  }
  car.group.rotation.y = car.heading;

  // At an intersection (crossing another road line), maybe turn
  const along = car._axis === 'x' ? car.pos.x : car.pos.z;
  const line = nearestRoadLine(along);
  if (car._turnCooldown <= 0 && Math.abs(along - line) < Math.max(0.6, car.speed * dt * 1.5)) {
    const roll = Math.random();
    if (roll < 0.3) {
      // Turn onto the crossing road
      car._axis = car._axis === 'x' ? 'z' : 'x';
      car._lane = line;
      car._dir = Math.random() < 0.5 ? 1 : -1;
      car._turnCooldown = 2;
    } else if (roll < 0.38) {
      // U-turn (rare)
      car._dir *= -1;
      car._turnCooldown = 3;
    } else {
      // Straight on; don't re-roll at this same intersection
      car._turnCooldown = 1.5;
    }
  }

  // Hard clamp: never leave the road grid
  const bounds = (G.city && G.city.bounds) || 210;
  if (car.pos.x > 200 || car.pos.x < -200 || car.pos.z > 200 || car.pos.z < -200) {
    car._dir *= -1;
    car.pos.x = Math.max(-200, Math.min(200, car.pos.x));
    car.pos.z = Math.max(-200, Math.min(200, car.pos.z));
  }

  const spin = (car.speed * dt) / 0.36;
  for (const w of car.wheels) w.rotation.z += spin;
}

export function updateVehicles(G, dt) {
  let driving = false;
  for (const car of G.cars) {
    if (car.kind === 'police') continue; // police.js drives its own cars
    if (car === G.state.inVehicle) {
      updatePlayerCar(G, car, dt);
      driving = true;
    } else if (car.kind === 'traffic') {
      updateTrafficCar(G, car, dt);
    } else if (car.kind === 'player') {
      // Parked player car: gentle idle, no motion
      car.speed = 0;
    }
  }
  if (!driving) G.state.speed = 0;
}
