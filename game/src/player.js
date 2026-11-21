// player.js — Dante Reyes on foot (session B, gta6-01)
// Figure built from boxes + a sphere head. No external models.
// Movement is camera-relative; E enters/exits the nearest car.

const _fwd = { x: 0, z: 0 };

export function initPlayer(G) {
  const group = new THREE.Group();

  const skin = new THREE.MeshStandardMaterial({ color: 0xc98d64, roughness: 0.8 });
  const jacket = new THREE.MeshStandardMaterial({ color: 0x274156, roughness: 0.7 });
  const pants = new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.85 });
  const shoes = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });

  // Legs
  const legGeo = new THREE.BoxGeometry(0.22, 0.8, 0.24);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.14, 0.4, 0);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.14, 0.4, 0);
  // Shoes
  const shoeGeo = new THREE.BoxGeometry(0.24, 0.1, 0.38);
  const shoeL = new THREE.Mesh(shoeGeo, shoes);
  shoeL.position.set(-0.14, 0.05, 0.05);
  const shoeR = new THREE.Mesh(shoeGeo, shoes);
  shoeR.position.set(0.14, 0.05, 0.05);
  // Torso (jacket)
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.34), jacket);
  torso.position.set(0, 1.12, 0);
  // Arms
  const armGeo = new THREE.BoxGeometry(0.16, 0.6, 0.18);
  const armL = new THREE.Mesh(armGeo, jacket);
  armL.position.set(-0.4, 1.12, 0);
  const armR = new THREE.Mesh(armGeo, jacket);
  armR.position.set(0.4, 1.12, 0);
  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), skin);
  head.position.set(0, 1.62, 0);
  // Hair cap
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.215, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshStandardMaterial({ color: 0x1c1410, roughness: 0.9 })
  );
  hair.position.set(0, 1.64, 0);

  group.add(legL, legR, shoeL, shoeR, torso, armL, armR, head, hair);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });

  const spawn = (G.city && G.city.spawnPoints && G.city.spawnPoints.garage) || { x: 0, z: 0 };
  group.position.set(spawn.x, 0, spawn.z);

  G.scene.add(group);
  G.player = {
    group,
    pos: group.position,
    heading: 0,
    speed: 0,
    onFoot: true,
    _vy: 0,
    _grounded: true,
    _ePrev: false,
    _walkPhase: 0,
    _legL: legL,
    _legR: legR,
    _armL: armL,
    _armR: armR,
  };
}

function nearestCar(G, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of G.cars) {
    const dx = car.pos.x - G.player.pos.x;
    const dz = car.pos.z - G.player.pos.z;
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function updatePlayer(G, dt) {
  const p = G.player;
  if (!p || !p.group) return;
  const keys = (G.input && G.input.keys) || new Set();
  const cfg = G.config.player;
  const bounds = (G.city && G.city.bounds) || 210;

  // --- E: enter / exit car (edge triggered, with a short cooldown so
  // one press can never enter AND immediately exit again) ---
  const eDown = keys.has('KeyE');
  p._eCooldown = Math.max(0, (p._eCooldown || 0) - dt);
  if (eDown && !p._ePrev && p._eCooldown <= 0) {
    p._eCooldown = 0.4;
    if (p.onFoot) {
      const car = nearestCar(G, 4);
      if (car) {
        p.onFoot = false;
        p.speed = 0;
        G.state.inVehicle = car;
        p.group.visible = false;
        if (car.kind === 'traffic') {
          G.state.carsStolen += 1;
          // Grand theft auto, in front of the whole street: the SMPD notices.
          if (G.helpers && G.helpers.raiseWanted) G.helpers.raiseWanted(1);
        }
        if (G.helpers && G.helpers.playSound) G.helpers.playSound('click');
      }
    } else if (G.state.inVehicle) {
      const car = G.state.inVehicle;
      // Step out to the side of the car (right side relative to heading:
      // forward is (sin h, cos h), so right is (-cos h, sin h)).
      const sideX = -Math.cos(car.heading);
      const sideZ = Math.sin(car.heading);
      p.pos.set(car.pos.x + sideX * 2.2, 0, car.pos.z + sideZ * 2.2);
      p.heading = car.heading;
      p.group.rotation.y = p.heading;
      p.onFoot = true;
      G.state.inVehicle = null;
      G.state.speed = 0;
      p.group.visible = true;
      if (G.helpers && G.helpers.playSound) G.helpers.playSound('click');
    }
  }
  p._ePrev = eDown;

  // --- In a vehicle: the player figure rides along, hidden ---
  if (!p.onFoot) {
    if (G.state.inVehicle) {
      p.pos.copy(G.state.inVehicle.pos);
      p.pos.y = 0;
    }
    p.speed = 0;
    return;
  }

  // --- On foot movement, camera-relative ---
  let ix = 0;
  let iz = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) iz += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) iz -= 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) ix -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) ix += 1;

  // Camera forward projected onto the ground plane
  let camX = 0;
  let camZ = -1;
  if (G.camera) {
    const dir = new THREE.Vector3();
    G.camera.getWorldDirection(dir);
    camX = dir.x;
    camZ = dir.z;
    const len = Math.hypot(camX, camZ) || 1;
    camX /= len;
    camZ /= len;
  }
  // Camera right = forward rotated -90deg around Y
  const rightX = -camZ;
  const rightZ = camX;

  let mx = camX * iz + rightX * ix;
  let mz = camZ * iz + rightZ * ix;
  const mLen = Math.hypot(mx, mz);
  const moving = mLen > 0.01;
  if (moving) {
    mx /= mLen;
    mz /= mLen;
  }

  const running = keys.has('ShiftLeft') || keys.has('ShiftRight');
  const targetSpeed = moving ? (running ? cfg.runSpeed : cfg.walkSpeed) : 0;
  // Smooth acceleration toward target speed
  const accelRate = moving ? 40 : 30;
  if (p.speed < targetSpeed) p.speed = Math.min(targetSpeed, p.speed + accelRate * dt);
  else p.speed = Math.max(targetSpeed, p.speed - accelRate * dt);

  if (moving && p.speed > 0.1) {
    p.heading = Math.atan2(mx, mz);
    p.group.rotation.y = p.heading;
    p.pos.x += mx * p.speed * dt;
    p.pos.z += mz * p.speed * dt;
    // Walk-cycle swing for legs and arms
    p._walkPhase += dt * p.speed * 1.6;
    const swing = Math.sin(p._walkPhase) * 0.55;
    p._legL.rotation.x = swing;
    p._legR.rotation.x = -swing;
    p._armL.rotation.x = -swing * 0.7;
    p._armR.rotation.x = swing * 0.7;
  } else {
    p._legL.rotation.x *= 0.8;
    p._legR.rotation.x *= 0.8;
    p._armL.rotation.x *= 0.8;
    p._armR.rotation.x *= 0.8;
  }

  // --- Jump (small hop, Space) ---
  if ((keys.has('Space')) && p._grounded) {
    p._vy = 7;
    p._grounded = false;
  }
  if (!p._grounded) {
    p._vy -= 20 * dt;
    p.pos.y += p._vy * dt;
    if (p.pos.y <= 0) {
      p.pos.y = 0;
      p._vy = 0;
      p._grounded = true;
    }
  }

  // --- Stay inside the city ---
  if (p.pos.x > bounds) p.pos.x = bounds;
  if (p.pos.x < -bounds) p.pos.x = -bounds;
  if (p.pos.z > bounds) p.pos.z = bounds;
  if (p.pos.z < -bounds) p.pos.z = -bounds;

  _fwd.x = mx;
  _fwd.z = mz;
}
