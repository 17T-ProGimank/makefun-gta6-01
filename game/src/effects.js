// gta6-01 — effects.js (session D)
// Particle explosions, smoke, and camera shake. Written fresh from the
// shared spec only. Contract: initEffects(G), updateEffects(G, dt),
// spawnExplosion(G, pos, big), spawnSmoke(G, pos), shake(G, amt).
// Helpers attached here: G.helpers.spawnExplosion, G.helpers.spawnSmoke.
// Particles are a pooled THREE.Points (300 points, vertex colours, no
// external textures). Camera shake is stored on G.effects.shakeAmt /
// G.effects.shakeT for main.js to apply; this module only decays it.

const POOL_SIZE = 300;
const GRAVITY = 9;

function hasThree() {
  return typeof THREE !== 'undefined';
}

function toVec(pos) {
  if (!pos) return { x: 0, y: 1, z: 0 };
  if (typeof pos.x === 'number') return { x: pos.x, y: pos.y || 1, z: pos.z || 0 };
  return { x: 0, y: 1, z: 0 };
}

function allocParticle(fx) {
  for (let i = 0; i < fx.particles.length; i++) {
    if (fx.particles[i].life <= 0) return fx.particles[i];
  }
  return null;
}

function emit(fx, p, opts) {
  p.life = opts.life;
  p.maxLife = opts.life;
  p.x = opts.x;
  p.y = opts.y;
  p.z = opts.z;
  p.vx = opts.vx;
  p.vy = opts.vy;
  p.vz = opts.vz;
  p.r = opts.r;
  p.g = opts.g;
  p.b = opts.b;
  p.grav = opts.grav;
  p.drag = opts.drag;
}

export function spawnExplosion(G, pos, big) {
  const fx = G.effects;
  if (!fx || !fx.particles) return;
  const p = toVec(pos);
  const count = big ? 90 : 40;
  const speed = big ? 16 : 11;
  for (let i = 0; i < count; i++) {
    const pt = allocParticle(fx);
    if (!pt) break;
    const a = Math.random() * Math.PI * 2;
    const up = Math.random() * 0.9 + 0.2;
    const s = speed * (0.35 + Math.random() * 0.65);
    // Orange -> yellow -> red fireball colours.
    const pick = Math.random();
    let r = 1.0;
    let g = 0.55;
    let b = 0.1;
    if (pick < 0.33) {
      r = 1.0;
      g = 0.85;
      b = 0.25;
    } else if (pick < 0.66) {
      r = 0.95;
      g = 0.3;
      b = 0.08;
    }
    emit(fx, pt, {
      life: 0.6 + Math.random() * 0.7,
      x: p.x + (Math.random() - 0.5) * 1.5,
      y: p.y + (Math.random() - 0.5) * 1.5,
      z: p.z + (Math.random() - 0.5) * 1.5,
      vx: Math.cos(a) * s,
      vy: up * s,
      vz: Math.sin(a) * s,
      r,
      g,
      b,
      grav: 0.55,
      drag: 0.92,
    });
  }
  spawnSmoke(G, { x: p.x, y: p.y + 1, z: p.z });
  // Brief point light so the blast lights nearby buildings and cars.
  if (fx.scene && hasThree()) {
    const base = big ? 60 : 35;
    const light = new THREE.PointLight(0xff7722, base, big ? 40 : 25, 1.6);
    light.position.set(p.x, p.y + 2, p.z);
    fx.scene.add(light);
    fx.lights.push({ light, life: 0.35, maxLife: 0.35, base });
  }
  shake(G, big ? 1.6 : 0.9);
  if (G.helpers && typeof G.helpers.playSound === 'function') {
    G.helpers.playSound('explosion');
  }
}

export function spawnSmoke(G, pos) {
  const fx = G.effects;
  if (!fx || !fx.particles) return;
  const p = toVec(pos);
  for (let i = 0; i < 12; i++) {
    const pt = allocParticle(fx);
    if (!pt) break;
    const shade = 0.22 + Math.random() * 0.18;
    emit(fx, pt, {
      life: 1.4 + Math.random() * 1.2,
      x: p.x + (Math.random() - 0.5) * 2,
      y: p.y + Math.random() * 0.5,
      z: p.z + (Math.random() - 0.5) * 2,
      vx: (Math.random() - 0.5) * 1.2,
      vy: 1.5 + Math.random() * 1.5,
      vz: (Math.random() - 0.5) * 1.2,
      r: shade,
      g: shade,
      b: shade,
      grav: -0.12,
      drag: 0.985,
    });
  }
}

export function shake(G, amt) {
  const fx = G.effects;
  if (!fx) return;
  fx.shakeAmt = Math.max(fx.shakeAmt || 0, amt || 0.5);
  fx.shakeT = 0.45;
}

export function initEffects(G) {
  G.effects = G.effects || {};
  const fx = G.effects;
  fx.shakeAmt = 0;
  fx.shakeT = 0;
  fx.lights = [];
  fx.scene = G.scene || null;
  fx.particles = [];
  for (let i = 0; i < POOL_SIZE; i++) {
    fx.particles.push({
      life: 0, maxLife: 1,
      x: 0, y: -1000, z: 0, vx: 0, vy: 0, vz: 0,
      r: 1, g: 1, b: 1, grav: 1, drag: 1,
    });
  }
  if (hasThree() && G.scene) {
    const geo = new THREE.BufferGeometry();
    fx.positions = new Float32Array(POOL_SIZE * 3);
    fx.colours = new Float32Array(POOL_SIZE * 3);
    for (let i = 0; i < POOL_SIZE; i++) {
      fx.positions[i * 3 + 1] = -1000;
      fx.colours[i * 3] = 1;
      fx.colours[i * 3 + 1] = 1;
      fx.colours[i * 3 + 2] = 1;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(fx.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(fx.colours, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: true,
      depthWrite: false,
    });
    fx.points = new THREE.Points(geo, mat);
    fx.points.frustumCulled = false;
    G.scene.add(fx.points);
  }
  if (!G.helpers) G.helpers = {};
  G.helpers.spawnExplosion = function spawnExplosionHelper(pos, big) {
    spawnExplosion(G, pos, big);
  };
  G.helpers.spawnSmoke = function spawnSmokeHelper(pos) {
    spawnSmoke(G, pos);
  };
}

export function updateEffects(G, dt) {
  const fx = G.effects;
  if (!fx || !fx.particles) return;
  const step = Math.min(dt, 0.05);
  for (let i = 0; i < fx.particles.length; i++) {
    const p = fx.particles[i];
    if (p.life <= 0) continue;
    p.life -= step;
    if (p.life <= 0) {
      p.y = -1000;
      continue;
    }
    p.vy -= GRAVITY * p.grav * step;
    p.vx *= Math.pow(p.drag, step * 60);
    p.vy *= Math.pow(p.drag, step * 60);
    p.vz *= Math.pow(p.drag, step * 60);
    p.x += p.vx * step;
    p.y += p.vy * step;
    p.z += p.vz * step;
    if (p.y < 0.05) {
      p.y = 0.05;
      p.vy = Math.abs(p.vy) * 0.3;
    }
  }
  // Push particle state into the GPU buffers (dead ones sit at y=-1000).
  if (fx.points) {
    for (let i = 0; i < fx.particles.length; i++) {
      const p = fx.particles[i];
      fx.positions[i * 3] = p.x;
      fx.positions[i * 3 + 1] = p.y;
      fx.positions[i * 3 + 2] = p.z;
      const fade = p.life > 0 ? Math.min(1, p.life / (p.maxLife * 0.5)) : 0;
      fx.colours[i * 3] = p.r * fade;
      fx.colours[i * 3 + 1] = p.g * fade;
      fx.colours[i * 3 + 2] = p.b * fade;
    }
    fx.points.geometry.attributes.position.needsUpdate = true;
    fx.points.geometry.attributes.color.needsUpdate = true;
  }
  // Fade and remove blast lights.
  for (let i = fx.lights.length - 1; i >= 0; i--) {
    const entry = fx.lights[i];
    entry.life -= step;
    if (entry.life <= 0) {
      if (fx.scene) fx.scene.remove(entry.light);
      fx.lights.splice(i, 1);
    } else {
      entry.light.intensity = (entry.base || 60) * (entry.life / entry.maxLife);
    }
  }
  // Decay camera shake; main.js reads shakeAmt/shakeT each frame.
  if (fx.shakeT > 0) {
    fx.shakeT -= step;
    if (fx.shakeT <= 0) {
      fx.shakeT = 0;
      fx.shakeAmt = 0;
    }
  }
}
