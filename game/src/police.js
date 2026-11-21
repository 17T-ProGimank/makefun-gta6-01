// police.js — SMPD wanted system for SOLMARA (gta6-01, session C)
// Wanted 0-5 stars: patrol cruisers chase the player on the road grid,
// AIR-1 helicopter circles overhead at 3+ stars, roadblocks block the
// road ahead at 3+ stars. Written fresh; no imports from other modules.

const ROAD_PITCH = 54; // block 42 + roadWidth 12 (spec CONFIG.city)
const ROAD_MIN = -216;
const ROAD_MAX = 216;
const WANTED_CAR_COUNT = { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4, 5: 6 };
const ARREST_TIME = 2; // seconds touching the player on foot
const HIDE_TIME = 10; // seconds unseen before wanted drops one star
const UNSEEN_DIST = 80; // no cruiser within this range counts as unseen

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function nearestRoadLine(v) {
  return clamp(Math.round(v / ROAD_PITCH) * ROAD_PITCH, ROAD_MIN, ROAD_MAX);
}

// Build a black-and-white SMPD cruiser from boxes (local only — do not
// reuse vehicles.js makeCar; this session must not read that file).
function makePoliceCar(G, x, z, heading) {
  const group = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.4, metalness: 0.6 });
  const white = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, roughness: 0.15, metalness: 0.8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.55, 4.4), black);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 2.2), glass);
  cabin.position.set(0, 1.05, -0.2);
  group.add(cabin);
  // White doors (classic black-and-white livery).
  const doorL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 1.9), white);
  doorL.position.set(-1.01, 0.55, 0.1);
  group.add(doorL);
  const doorR = doorL.clone();
  doorR.position.x = 1.01;
  group.add(doorR);
  // Light bar: red left, blue right, flashed by updatePolice.
  const redMat = new THREE.MeshStandardMaterial({ color: 0xaa0000, emissive: 0xff0000, emissiveIntensity: 1 });
  const blueMat = new THREE.MeshStandardMaterial({ color: 0x0000aa, emissive: 0x2244ff, emissiveIntensity: 1 });
  const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.4), black);
  barBase.position.set(0, 1.38, -0.2);
  group.add(barBase);
  const redLight = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.34), redMat);
  redLight.position.set(-0.38, 1.46, -0.2);
  group.add(redLight);
  const blueLight = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.34), blueMat);
  blueLight.position.set(0.38, 1.46, -0.2);
  group.add(blueLight);
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    group.add(w);
  }

  group.position.set(x, 0, z);
  group.rotation.y = heading || 0;
  G.scene.add(group);

  const car = {
    group,
    mesh: group,
    pos: group.position,
    heading: heading || 0,
    speed: 0,
    color: 0x14161a,
    kind: 'police',
    // Chase state: which road line we drive on, and our travel axis.
    axis: 'x',
    dir: 1,
    roadLine: nearestRoadLine(z),
    redLight,
    blueLight,
    flashT: Math.random(),
  };
  G.cars.push(car);
  return car;
}

function removePoliceCar(G, car) {
  G.scene.remove(car.group);
  const i = G.cars.indexOf(car);
  if (i >= 0) G.cars.splice(i, 1);
}

// Spawn a cruiser on a road line some distance from the player.
function spawnCruiser(G) {
  const p = G.player.pos;
  // Pick a road line roughly 90-130 units away, on either axis.
  const lines = [];
  for (let v = ROAD_MIN; v <= ROAD_MAX; v += ROAD_PITCH) lines.push(v);
  let x, z, axis, dir;
  if (Math.random() < 0.5) {
    axis = 'x';
    z = lines[Math.floor(Math.random() * lines.length)];
    const ahead = p.x + (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 40);
    x = clamp(nearestRoadLine(ahead), ROAD_MIN, ROAD_MAX);
    dir = ahead > p.x ? -1 : 1;
  } else {
    axis = 'z';
    x = lines[Math.floor(Math.random() * lines.length)];
    const ahead = p.z + (Math.random() < 0.5 ? -1 : 1) * (90 + Math.random() * 40);
    z = clamp(nearestRoadLine(ahead), ROAD_MIN, ROAD_MAX);
    dir = ahead > p.z ? -1 : 1;
  }
  const heading = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  const car = makePoliceCar(G, x, z, heading);
  car.axis = axis;
  car.dir = dir;
  car.roadLine = axis === 'x' ? nearestRoadLine(z) : nearestRoadLine(x);
  G.police.cars.push(car);
  return car;
}

function makeHeli(G) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c2733, roughness: 0.5, metalness: 0.4 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 5.2), bodyMat);
  group.add(body);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 4.4), bodyMat);
  tail.position.set(0, 0.3, -4.4);
  group.add(tail);
  const glass = new THREE.Mesh(
    new THREE.BoxGeometry(1.9, 0.9, 1.6),
    new THREE.MeshStandardMaterial({ color: 0x2a4a66, roughness: 0.1, metalness: 0.9 })
  );
  glass.position.set(0, 0.1, 2.0);
  group.add(glass);
  // Main rotor (spins in updatePolice) + tail rotor.
  const rotor = new THREE.Group();
  const bladeGeo = new THREE.BoxGeometry(9, 0.08, 0.5);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
  const b1 = new THREE.Mesh(bladeGeo, bladeMat);
  const b2 = new THREE.Mesh(bladeGeo, bladeMat);
  b2.rotation.y = Math.PI / 2;
  rotor.add(b1, b2);
  rotor.position.y = 1.0;
  group.add(rotor);
  // Spotlight cone (visible beam) + real SpotLight aimed at the player.
  const coneGeo = new THREE.ConeGeometry(7, 40, 20, 1, true);
  const coneMat = new THREE.MeshBasicMaterial({
    color: 0xfff2b0, transparent: true, opacity: 0.13,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const cone = new THREE.Mesh(coneGeo, coneMat);
  cone.position.y = -20; // apex at the heli, wide end at the ground
  group.add(cone);
  const spot = new THREE.SpotLight(0xfff2b0, 900, 90, 0.28, 0.45, 1.2);
  spot.position.set(0, 0, 0);
  group.add(spot);
  spot.target.position.set(0, -40, 0);
  group.add(spot.target);

  group.position.set(G.player.pos.x + 30, 40, G.player.pos.z);
  G.scene.add(group);
  const heli = { group, rotor, cone, spot, angle: 0, radius: 34 };
  G.police.heli = heli;
  return heli;
}

function removeHeli(G) {
  if (!G.police.heli) return;
  G.scene.remove(G.police.heli.group);
  G.police.heli = null;
}

// Roadblock: 2-3 parked cruisers + barrier boxes across a road ahead of
// the player's direction of travel, snapped to a road line.
function spawnRoadblock(G) {
  const p = G.player.pos;
  const heading = G.player.heading || 0;
  // Player forward vector from heading. Convention shared by every module
  // (player.js, vehicles.js, hud.js): forward = (sin h, 0, cos h), so
  // heading 0 faces +z and heading PI/2 faces +x.
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  // Choose the dominant axis and place the block ~60 ahead on that road.
  let axis, line, along;
  if (Math.abs(fx) > Math.abs(fz)) {
    axis = 'x';
    along = nearestRoadLine(p.x + Math.sign(fx || 1) * 60);
    line = nearestRoadLine(p.z);
  } else {
    axis = 'z';
    along = nearestRoadLine(p.z + Math.sign(fz || 1) * 60);
    line = nearestRoadLine(p.x);
  }
  const group = new THREE.Group();
  const cars = [];
  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xd86a1e, roughness: 0.6 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.6 });
  const offsets = axis === 'x' ? [[0, -3.5], [0, 0.5], [0, 4.0]] : [[-3.5, 0], [0.5, 0], [4.0, 0]];
  const n = 2 + (Math.random() < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const [ox, oz] = offsets[i];
    const cx = axis === 'x' ? along : line + ox;
    const cz = axis === 'x' ? line + oz : along;
    const carHeading = axis === 'x' ? Math.PI / 2 : 0;
    const car = makePoliceCar(G, cx, cz, carHeading);
    car.speed = 0;
    cars.push(car);
  }
  // Barrier boxes between / beside the cruisers.
  for (let i = 0; i < 2; i++) {
    const t = i === 0 ? -6.5 : 6.5;
    const bx = axis === 'x' ? along : line + t;
    const bz = axis === 'x' ? line + t : along;
    const barrier = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.1, 3.2), barrierMat);
    barrier.position.set(bx, 0.55, bz);
    barrier.rotation.y = axis === 'x' ? 0 : Math.PI / 2;
    group.add(barrier);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.16, 0.25, 3.26), stripeMat);
    stripe.position.set(bx, 0.85, bz);
    stripe.rotation.y = barrier.rotation.y;
    group.add(stripe);
  }
  G.scene.add(group);
  const bx = axis === 'x' ? along : line;
  const bz = axis === 'x' ? line : along;
  // Shape missions.js reads: .pos {x,z} plus the flat .x/.z, .axis and
  // .group — roadblockPos() accepts any of them, but keep all three so no
  // reader ever has to guess.
  const block = { group, cars, pos: { x: bx, z: bz }, x: bx, z: bz, axis };
  G.police.roadblocks.push(block);
  return block;
}

function clearRoadblocks(G) {
  for (const block of G.police.roadblocks) {
    for (const car of block.cars) removePoliceCar(G, car);
    G.scene.remove(block.group);
  }
  G.police.roadblocks = [];
}

export function initPolice(G) {
  G.police.cars = [];
  G.police.heli = null;
  G.police.roadblocks = [];
  G.police._arrestT = 0;
  G.police._hideT = 0;
  G.police._flashT = 0;

  function setWanted(n) {
    const v = clamp(Math.round(n) || 0, 0, 5);
    G.state.wanted = v;
    if (v === 0) {
      G.police._hideT = 0;
      G.police._arrestT = 0;
    }
  }
  G.helpers.setWanted = setWanted;

  // Crimes raise the heat. Other modules call this when the player steals
  // a car, hits a ped/car, kills someone in front of police, or shoots.
  G.helpers.raiseWanted = function (n) {
    setWanted(G.state.wanted + (n || 1));
    G.police._hideT = 0;
  };

  G.police._setWanted = setWanted;
}

export function updatePolice(G, dt) {
  if (!G.state.started || G.state.paused || G.state.gameOver) return;
  const wanted = G.state.wanted;
  const p = G.player.pos;

  // --- Cruiser count follows wanted level ---
  const want = WANTED_CAR_COUNT[wanted] || 0;
  while (G.police.cars.length < want) spawnCruiser(G);
  while (G.police.cars.length > want) {
    removePoliceCar(G, G.police.cars[G.police.cars.length - 1]);
  }

  // --- Chase: move along the road grid toward the player ---
  const speed = 16 + wanted * 2.5; // 18.5 @1 star .. 28.5 @5 stars
  for (const car of G.police.cars) {
    const dx = p.x - car.pos.x;
    const dz = p.z - car.pos.z;
    // At an intersection (near a grid line on the moving axis) we may turn.
    const along = car.axis === 'x' ? car.pos.x : car.pos.z;
    const nearLine = Math.abs(along - nearestRoadLine(along)) < 1.2;
    if (nearLine) {
      // Snap onto the intersection, then pick the axis that closes the
      // bigger gap toward the player.
      if (car.axis === 'x') car.pos.x = nearestRoadLine(car.pos.x);
      else car.pos.z = nearestRoadLine(car.pos.z);
      if (Math.abs(dx) >= Math.abs(dz)) {
        car.axis = 'x';
        car.dir = dx >= 0 ? 1 : -1;
      } else {
        car.axis = 'z';
        car.dir = dz >= 0 ? 1 : -1;
      }
    }
    if (car.axis === 'x') {
      car.pos.x += car.dir * speed * dt;
      car.pos.z += (car.roadLine - car.pos.z) * Math.min(1, dt * 6);
      car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.pos.z += car.dir * speed * dt;
      car.pos.x += (car.roadLine - car.pos.x) * Math.min(1, dt * 6);
      car.heading = car.dir > 0 ? 0 : Math.PI;
    }
    car.pos.x = clamp(car.pos.x, ROAD_MIN, ROAD_MAX);
    car.pos.z = clamp(car.pos.z, ROAD_MIN, ROAD_MAX);
    car.group.rotation.y = car.heading;
    car.speed = speed;
    // Flashing light bar: red and blue alternate.
    car.flashT += dt * 6;
    const on = Math.sin(car.flashT) > 0;
    car.redLight.material.emissiveIntensity = on ? 2.2 : 0.15;
    car.blueLight.material.emissiveIntensity = on ? 0.15 : 2.2;
  }

  // --- Arrest: a cruiser touching the player on foot for 2s = BUSTED ---
  if (G.player.onFoot) {
    let touching = false;
    for (const car of G.police.cars) {
      const d = Math.hypot(car.pos.x - p.x, car.pos.z - p.z);
      if (d < 3.2) { touching = true; break; }
    }
    if (touching && wanted > 0) {
      G.police._arrestT += dt;
      if (G.police._arrestT >= ARREST_TIME) {
        G.state.gameOver = true;
        G.police._arrestT = 0;
        if (G.helpers.showBanner) G.helpers.showBanner('BUSTED', 'SMPD menangkapmu');
      }
    } else {
      G.police._arrestT = 0;
    }
  } else {
    G.police._arrestT = 0;
  }

  // --- AIR-1 helicopter at 3+ stars ---
  if (wanted >= 3 && !G.police.heli) makeHeli(G);
  if (wanted < 3 && G.police.heli) removeHeli(G);
  if (G.police.heli) {
    const heli = G.police.heli;
    heli.angle += (G.config.police.heliSpeed / heli.radius) * dt;
    heli.group.position.set(
      p.x + Math.cos(heli.angle) * heli.radius,
      40,
      p.z + Math.sin(heli.angle) * heli.radius
    );
    heli.rotor.rotation.y += dt * 22;
    // Spotlight follows the player.
    heli.spot.target.position.set(p.x, 0, p.z);
    heli.spot.target.updateMatrixWorld();
    // Beam cone tilts from heli toward the player: the cone's apex sits
    // at the heli and its axis (-Y) is rotated onto the heli->player
    // direction, stretched to reach the ground.
    const dx = p.x - heli.group.position.x;
    const dz = p.z - heli.group.position.z;
    const dir = new THREE.Vector3(dx, -40, dz);
    const beamLen = dir.length();
    dir.normalize();
    heli.cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), dir);
    heli.cone.scale.set(1, beamLen / 40, 1);
  }

  // --- Roadblocks at 3+ stars ---
  if (wanted >= G.config.police.roadblockAtStars) {
    // Keep one live roadblock ahead of the player; rebuild it if the
    // player drove far past it.
    const block = G.police.roadblocks[0];
    const far = !block || Math.hypot(block.x - p.x, block.z - p.z) > 150;
    if (far) {
      clearRoadblocks(G);
      spawnRoadblock(G);
    }
  } else if (G.police.roadblocks.length > 0) {
    clearRoadblocks(G);
  }

  // --- Wanted decay: 10s with no cruiser nearby loses one star ---
  if (wanted > 0) {
    let nearest = Infinity;
    for (const car of G.police.cars) {
      nearest = Math.min(nearest, Math.hypot(car.pos.x - p.x, car.pos.z - p.z));
    }
    if (nearest > UNSEEN_DIST) {
      G.police._hideT += dt;
      if (G.police._hideT >= HIDE_TIME) {
        G.police._hideT = 0;
        G.police._setWanted(wanted - 1);
      }
    } else {
      G.police._hideT = 0;
    }
  }
}
