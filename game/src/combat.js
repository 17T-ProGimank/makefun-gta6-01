// combat.js — hitscan shooting + Vulture enemies (session B, gta6-01)
// Enemies are box + sphere figures in dark red. Ammo is infinite.
// Muzzle flash / explosion helpers live in effects.js (session D), so
// they are called defensively — only if they exist yet.

let _enemies = [];
let _fPrev = false;
let _mousePrev = false;

function playSoundSafe(G, name) {
  if (G.helpers && G.helpers.playSound) {
    try { G.helpers.playSound(name); } catch (e) { /* audio not ready */ }
  }
}

export function spawnEnemy(G, x, z) {
  const group = new THREE.Group();

  const vest = new THREE.MeshStandardMaterial({ color: 0x5a1414, roughness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: 0xb07a52, roughness: 0.8 });

  const legGeo = new THREE.BoxGeometry(0.22, 0.8, 0.24);
  const legL = new THREE.Mesh(legGeo, dark);
  legL.position.set(-0.14, 0.4, 0);
  const legR = new THREE.Mesh(legGeo, dark);
  legR.position.set(0.14, 0.4, 0);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.34), vest);
  torso.position.set(0, 1.12, 0);
  const armGeo = new THREE.BoxGeometry(0.16, 0.6, 0.18);
  const armL = new THREE.Mesh(armGeo, vest);
  armL.position.set(-0.4, 1.12, 0);
  const armR = new THREE.Mesh(armGeo, vest);
  armR.position.set(0.4, 1.12, 0);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 16, 12), skin);
  head.position.set(0, 1.62, 0);
  // Dark bandana / cap so Vultures read as a crew at a glance
  const cap = new THREE.Mesh(
    new THREE.SphereGeometry(0.215, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
    new THREE.MeshStandardMaterial({ color: 0x3a0d0d, roughness: 0.9 })
  );
  cap.position.set(0, 1.64, 0);
  // Simple gun (small dark box in the right hand)
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5), dark);
  gun.position.set(0.4, 0.85, 0.3);

  group.add(legL, legR, torso, armL, armR, head, cap, gun);
  group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  group.position.set(x, 0, z);
  G.scene.add(group);

  const enemy = {
    group,
    pos: group.position,
    heading: 0,
    health: 100,
    speed: 3.2,
    _shootTimer: 1 + Math.random(),
    _dead: false,
    _fallTimer: 0,
    _fallAngle: 0,
    _walkPhase: Math.random() * Math.PI * 2,
    _legL: legL,
    _legR: legR,
    label: 'Vulture',
  };
  _enemies.push(enemy);
  return enemy;
}

export function damagePlayer(n) {
  // Attached to G.helpers.damagePlayer in initCombat; also exported for
  // other modules that receive G. Uses the G passed at init time via
  // the closure below — see initCombat.
  if (typeof damagePlayer._G !== 'undefined' && damagePlayer._G) {
    const G = damagePlayer._G;
    if (G.state.gameOver) return;
    G.state.health -= n;
    if (G.state.health <= 0) {
      G.state.health = 0;
      G.state.gameOver = true;
    }
  }
}

function shoot(G) {
  // Hitscan from the player (on foot) or the driven car, toward where
  // the camera looks. Nearest enemy inside a narrow forward cone and
  // within 60 units takes a hit.
  const p = G.player;
  if (!p) return;
  const origin = new THREE.Vector3(p.pos.x, p.pos.y + 1.5, p.pos.z);
  const dir = new THREE.Vector3();
  if (G.camera) G.camera.getWorldDirection(dir);
  else dir.set(Math.sin(p.heading), 0, Math.cos(p.heading));
  dir.y = 0;
  if (dir.lengthSq() < 0.001) dir.set(Math.sin(p.heading), 0, Math.cos(p.heading));
  dir.normalize();

  // Muzzle flash at the gun position (defensive: effects.js may not exist yet)
  const muzzle = origin.clone().addScaledVector(dir, 1.2);
  if (G.helpers && G.helpers.spawnExplosion) {
    try { G.helpers.spawnExplosion(muzzle, false); } catch (e) { /* effects not ready */ }
  }
  playSoundSafe(G, 'shot');
  // Firing a gun on a public street draws the SMPD (one star per shot,
  // capped at 5 by setWanted inside raiseWanted).
  if (G.helpers && G.helpers.raiseWanted) {
    try { G.helpers.raiseWanted(1); } catch (e) { /* police not ready */ }
  }

  let best = null;
  let bestD = 60;
  for (const e of _enemies) {
    if (e._dead) continue;
    const dx = e.pos.x - origin.x;
    const dz = e.pos.z - origin.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 60 || dist < 0.5) continue;
    // Cone check: lateral offset from the aim ray must be small
    const along = dx * dir.x + dz * dir.z;
    if (along <= 0) continue; // behind the player
    const perpX = dx - dir.x * along;
    const perpZ = dz - dir.z * along;
    const lateral = Math.hypot(perpX, perpZ);
    if (lateral > 1.6 + dist * 0.03) continue;
    if (dist < bestD) { bestD = dist; best = e; }
  }

  if (best) {
    // Damage falls off with range: close shots hit harder
    const dmg = bestD < 20 ? 34 : (bestD < 40 ? 26 : 18);
    best.health -= dmg; // ~3 close hits (or ~5 long ones) to kill
    // Hit reaction: small knock-back flash via a quick scale pulse
    best.group.scale.set(1.08, 0.95, 1.08);
    if (best.health <= 0) killEnemy(G, best);
  }
}

function killEnemy(G, enemy) {
  enemy._dead = true;
  enemy._fallTimer = 0;
  G.state.kills += 1;
  // A body on the street means more heat.
  if (G.helpers && G.helpers.raiseWanted) {
    try { G.helpers.raiseWanted(1); } catch (e) { /* police not ready */ }
  }
  if (G.helpers && G.helpers.addMoney) {
    try { G.helpers.addMoney(50); } catch (e) { /* hud not ready */ }
  }
  playSoundSafe(G, 'cash');
}

export function initCombat(G) {
  _enemies = [];
  G.enemies = _enemies;
  damagePlayer._G = G;
  G.helpers.damagePlayer = damagePlayer;
  _fPrev = false;
  _mousePrev = false;
}

export function updateCombat(G, dt) {
  if (!G.player) return;
  const keys = (G.input && G.input.keys) || new Set();
  const fDown = keys.has('KeyF');
  const mouseDown = !!(G.input && G.input.mouseDown);
  // Fire on the press edge of F or the left mouse button
  if ((fDown && !_fPrev) || (mouseDown && !_mousePrev)) {
    if (!G.state.gameOver && !G.state.paused) shoot(G);
  }
  _fPrev = fDown;
  _mousePrev = mouseDown;

  const px = G.player.pos.x;
  const pz = G.player.pos.z;

  for (let i = _enemies.length - 1; i >= 0; i--) {
    const e = _enemies[i];

    if (e._dead) {
      // Fall over, then fade out and disappear after 3 seconds
      e._fallTimer += dt;
      e._fallAngle = Math.min(Math.PI / 2, e._fallAngle + dt * 3);
      e.group.rotation.x = -e._fallAngle;
      if (e._fallTimer > 3) {
        G.scene.remove(e.group);
        _enemies.splice(i, 1);
      }
      continue;
    }

    // Reset the hit-reaction scale pulse
    e.group.scale.lerp(new THREE.Vector3(1, 1, 1), dt * 8);

    const dx = px - e.pos.x;
    const dz = pz - e.pos.z;
    const dist = Math.hypot(dx, dz);

    // Chase the player when close enough, stop at shooting range
    if (dist < 40 && dist > 8) {
      const nx = dx / dist;
      const nz = dz / dist;
      e.pos.x += nx * e.speed * dt;
      e.pos.z += nz * e.speed * dt;
      e.heading = Math.atan2(nx, nz);
      e.group.rotation.y = e.heading;
      e._walkPhase += dt * e.speed * 4;
      const swing = Math.sin(e._walkPhase) * 0.5;
      e._legL.rotation.x = swing;
      e._legR.rotation.x = -swing;
    } else if (dist <= 8) {
      e.heading = Math.atan2(dx, dz);
      e.group.rotation.y = e.heading;
      e._legL.rotation.x *= 0.8;
      e._legR.rotation.x *= 0.8;
    }

    // Shoot back: small periodic damage inside 25 units
    if (dist < 25 && !G.state.gameOver && G.player.onFoot !== false) {
      e._shootTimer -= dt;
      if (e._shootTimer <= 0) {
        e._shootTimer = 1.1 + Math.random() * 0.5;
        if (G.helpers && G.helpers.damagePlayer) {
          G.helpers.damagePlayer(6);
        }
        // Return-fire flash at the enemy's gun
        if (G.helpers && G.helpers.spawnExplosion) {
          try {
            const flashPos = new THREE.Vector3(e.pos.x, 1.4, e.pos.z);
            G.helpers.spawnExplosion(flashPos, false);
          } catch (err) { /* effects not ready */ }
        }
        playSoundSafe(G, 'shot');
      }
    } else {
      e._shootTimer = Math.max(e._shootTimer, 0.4);
    }
  }
}
