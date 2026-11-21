// pedestrians.js — sidewalk walkers (session B, gta6-01)
// Figures built from boxes + a sphere head, random shirt colours.
// They walk along sidewalks (road edges), turn at block ends, pause
// randomly, and flee from the player when the heat is on (wanted >= 3).
// Sidewalks sit beside the road lines city.js paves: 54-unit pitch
// (block 42 + road 12), 9 lines from -216 to 216.

const ROAD_LINES = [-216, -162, -108, -54, 0, 54, 108, 162, 216];
const SIDEWALK_OFFSET = 8.5; // road half-width (6) + sidewalk margin
const SHIRT_COLORS = [
  0xd94f30, 0x2e6fb0, 0x3a9e5f, 0xc9a227, 0x8e44ad,
  0xe67e22, 0x16a085, 0xd8d8d8, 0x5b8c5a, 0xb03a5b,
];

function makePed(G) {
  const group = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({
    color: SHIRT_COLORS[Math.floor(Math.random() * SHIRT_COLORS.length)],
    roughness: 0.8,
  });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.85 });

  const legGeo = new THREE.BoxGeometry(0.2, 0.7, 0.22);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.12, 0.35, 0);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.12, 0.35, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.6, 0.3), shirt);
  torso.position.set(0, 1.0, 0);
  const armGeo = new THREE.BoxGeometry(0.14, 0.55, 0.16);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.36, 1.0, 0);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.36, 1.0, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 14, 10), skin);
  head.position.set(0, 1.48, 0);

  group.add(legL, legR, torso, armL, armR, head);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  G.scene.add(group);
  return { group, legL, legR, armL, armR };
}

function randomSidewalkPos() {
  // Pick a road line, walk along its sidewalk on one side or the other.
  const line = ROAD_LINES[Math.floor(Math.random() * ROAD_LINES.length)];
  const side = Math.random() < 0.5 ? 1 : -1;
  const along = (Math.random() * 2 - 1) * 190;
  const horizontal = Math.random() < 0.5;
  if (horizontal) {
    return { x: along, z: line + side * SIDEWALK_OFFSET, axis: 'x' };
  }
  return { x: line + side * SIDEWALK_OFFSET, z: along, axis: 'z' };
}

export function initPedestrians(G) {
  G.peds.length = 0;
  const count = (G.config && G.config.peds && G.config.peds.count) || 22;
  for (let i = 0; i < count; i++) {
    const parts = makePed(G);
    const start = randomSidewalkPos();
    const dir = Math.random() < 0.5 ? 1 : -1;
    parts.group.position.set(start.x, 0, start.z);
    const heading = start.axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    parts.group.rotation.y = heading;
    G.peds.push({
      group: parts.group,
      pos: parts.group.position,
      heading,
      speed: 1 + Math.random() * 1,
      _axis: start.axis,
      _dir: dir,
      _pauseTimer: Math.random() * 3,
      _walkPhase: Math.random() * Math.PI * 2,
      _legL: parts.legL,
      _legR: parts.legR,
      _armL: parts.armL,
      _armR: parts.armR,
      _fleeing: false,
    });
  }
}

export function updatePedestrians(G, dt) {
  const bounds = (G.city && G.city.bounds) || 210;
  const wanted = (G.state && G.state.wanted) || 0;
  const px = G.player ? G.player.pos.x : 0;
  const pz = G.player ? G.player.pos.z : 0;

  for (const ped of G.peds) {
    // --- Flee: at wanted >= 3, run away from the player ---
    let fleeX = 0;
    let fleeZ = 0;
    let fleeing = false;
    if (wanted >= 3) {
      const dx = ped.pos.x - px;
      const dz = ped.pos.z - pz;
      const d = Math.hypot(dx, dz);
      if (d < 30) {
        fleeing = true;
        fleeX = dx / (d || 1);
        fleeZ = dz / (d || 1);
      }
    }
    ped._fleeing = fleeing;

    // Dodge: step sideways off the sidewalk edge when a car passes close
    let dodgeX = 0;
    let dodgeZ = 0;
    for (const car of G.cars) {
      const cdx = ped.pos.x - car.pos.x;
      const cdz = ped.pos.z - car.pos.z;
      const cd = Math.hypot(cdx, cdz);
      if (cd < 3.5 && cd > 0.01) {
        // Step perpendicular to the car's travel direction
        const perpX = Math.cos(car.heading);
        const perpZ = -Math.sin(car.heading);
        const side = (cdx * perpX + cdz * perpZ) >= 0 ? 1 : -1;
        dodgeX = perpX * side;
        dodgeZ = perpZ * side;
        break;
      }
    }
    if (dodgeX !== 0 || dodgeZ !== 0) {
      ped.pos.x += dodgeX * 2.5 * dt;
      ped.pos.z += dodgeZ * 2.5 * dt;
    }

    if (fleeing) {
      ped.speed = 3.5;
      ped.pos.x += fleeX * ped.speed * dt;
      ped.pos.z += fleeZ * ped.speed * dt;
      ped.heading = Math.atan2(fleeX, fleeZ);
      ped.group.rotation.y = ped.heading;
    } else {
      // --- Random pauses (waiting, looking at a shop window) ---
      if (ped._pauseTimer > 0) {
        ped._pauseTimer -= dt;
        ped.speed = 0;
      } else {
        ped.speed = 1 + Math.sin(ped._walkPhase * 0.13) * 0.4 + 0.6; // 1..2-ish, varies per ped
        if (ped._axis === 'x') {
          ped.pos.x += ped._dir * ped.speed * dt;
          ped.heading = ped._dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          ped.pos.z += ped._dir * ped.speed * dt;
          ped.heading = ped._dir > 0 ? 0 : Math.PI;
        }
        ped.group.rotation.y = ped.heading;
        if (Math.random() < dt * 0.06) ped._pauseTimer = 1 + Math.random() * 4;
      }

      // Turn around at the end of a block / city edge
      const along = ped._axis === 'x' ? ped.pos.x : ped.pos.z;
      if (along > bounds - 8 || along < -bounds + 8) {
        ped._dir *= -1;
      }
    }

    // Walk-cycle swing
    if (ped.speed > 0.1) {
      ped._walkPhase += dt * ped.speed * 4.5;
      const swing = Math.sin(ped._walkPhase) * 0.5;
      ped._legL.rotation.x = swing;
      ped._legR.rotation.x = -swing;
      ped._armL.rotation.x = -swing * 0.6;
      ped._armR.rotation.x = swing * 0.6;
    } else {
      ped._legL.rotation.x *= 0.8;
      ped._legR.rotation.x *= 0.8;
      ped._armL.rotation.x *= 0.8;
      ped._armR.rotation.x *= 0.8;
    }

    // Keep peds inside the city
    if (ped.pos.x > bounds) ped.pos.x = bounds;
    if (ped.pos.x < -bounds) ped.pos.x = -bounds;
    if (ped.pos.z > bounds) ped.pos.z = bounds;
    if (ped.pos.z < -bounds) ped.pos.z = -bounds;
  }
}
