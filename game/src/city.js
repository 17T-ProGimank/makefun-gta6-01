// SOLMARA — the island city, built fresh from boxes, planes and cylinders.
// Golden hour: low sun in the WEST, orange horizon, streetlights on.
// Layout: 9 road lines per axis on a 54-unit pitch (42 block + 12 road),
// blocks of 42 between them, sea + beach to the SOUTH (+z), port EAST (+x),
// hills NORTH (-z), downtown towers at the centre.

const PITCH = 54; // block (42) + roadWidth (12)
const ROAD_AT = [-216, -162, -108, -54, 0, 54, 108, 162, 216];
const HALF = 210; // city.size / 2

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

// Procedural facade: base colour + a grid of windows, some lit warm.
// Returns { map, emissiveMap } canvases so windows glow at dusk.
function facadeTextures(baseHex, litRatio) {
  const w = 128, h = 256;
  const map = document.createElement('canvas');
  map.width = w; map.height = h;
  const emissive = document.createElement('canvas');
  emissive.width = w; emissive.height = h;
  const m = map.getContext('2d');
  const e = emissive.getContext('2d');
  m.fillStyle = baseHex;
  m.fillRect(0, 0, w, h);
  e.fillStyle = '#000000';
  e.fillRect(0, 0, w, h);
  const cols = 6, rows = 14;
  const cw = w / cols, ch = h / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw + cw * 0.22, y = r * ch + ch * 0.22;
      const ww = cw * 0.56, hh = ch * 0.56;
      const lit = Math.random() < litRatio;
      if (lit) {
        m.fillStyle = '#ffd27a';
        e.fillStyle = '#ffca6a';
      } else {
        m.fillStyle = '#2a3542';
        e.fillStyle = '#000000';
      }
      m.fillRect(x, y, ww, hh);
      e.fillRect(x, y, ww, hh);
    }
  }
  return { map, emissive };
}

function hexCss(hex) {
  return '#' + hex.toString(16).padStart(6, '0');
}

export function buildCity(G) {
  const { scene } = G;
  const C = G.config.colors;
  const city = G.city;
  city.bounds = HALF;
  city.roads = [];
  city.spawnPoints = {
    // Garage point is on the sidewalk IN FRONT of the garage (z=42), not
    // inside the building (the garage body spans z 18..36) — Dante and the
    // first mission target must be reachable without clipping through walls.
    garage: { x: -27, z: 42 },
    beach: { x: 0, z: 196 },
    downtown: { x: 0, z: 0 }
  };

  // ---------- Sky: gradient dome + low western sun + orange haze ----------
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4; skyCanvas.height = 256;
  const sg = skyCanvas.getContext('2d');
  const grad = sg.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, hexCss(C.skyTop));
  grad.addColorStop(0.55, '#c96a5a');
  grad.addColorStop(0.8, hexCss(C.skyHorizon));
  grad.addColorStop(1, '#ff7a2a');
  sg.fillStyle = grad;
  sg.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(850, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false })
  );
  scene.add(sky);

  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(46, 32),
    new THREE.MeshBasicMaterial({ color: C.sun, fog: false })
  );
  sun.position.set(-780, 95, 60);
  sun.lookAt(0, 40, 0);
  scene.add(sun);
  // A second, larger halo disc so the sun bleeds into the haze.
  const halo = new THREE.Mesh(
    new THREE.CircleGeometry(90, 32),
    new THREE.MeshBasicMaterial({ color: 0xff8a3c, transparent: true, opacity: 0.28, fog: false })
  );
  halo.position.set(-782, 95, 60);
  halo.lookAt(0, 40, 0);
  scene.add(halo);

  scene.fog = new THREE.Fog(0xe07f45, 160, 720);

  // ---------- Light: warm low directional sun + soft hemisphere ----------
  const sunLight = new THREE.DirectionalLight(0xffb347, 2.0);
  sunLight.position.set(-260, 110, 60);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.set(2048, 2048);
  sunLight.shadow.camera.left = -260;
  sunLight.shadow.camera.right = 260;
  sunLight.shadow.camera.top = 260;
  sunLight.shadow.camera.bottom = -260;
  sunLight.shadow.camera.far = 700;
  sunLight.shadow.bias = -0.0004;
  scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0xffc27a, 0x33482e, 0.75));
  const fill = new THREE.AmbientLight(0x604a55, 0.5);
  scene.add(fill);

  // ---------- Ground, sea, sand ----------
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 1100),
    new THREE.MeshLambertMaterial({ color: C.ground })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  ground.receiveShadow = true;
  scene.add(ground);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 300),
    new THREE.MeshLambertMaterial({ color: C.sea })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.25, 375);
  scene.add(sea);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(480, 34),
    new THREE.MeshLambertMaterial({ color: C.sand })
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.02, 212);
  sand.receiveShadow = true;
  scene.add(sand);

  // ---------- Roads + centre lines ----------
  const roadMat = new THREE.MeshLambertMaterial({ color: C.road });
  const lineMat = new THREE.MeshBasicMaterial({ color: 0xd8a83c });
  const roadGeoX = new THREE.PlaneGeometry(432, 12);
  const roadGeoZ = new THREE.PlaneGeometry(12, 432);
  const lineGeoX = new THREE.PlaneGeometry(432, 0.5);
  const lineGeoZ = new THREE.PlaneGeometry(0.5, 432);
  for (const at of ROAD_AT) {
    const rx = new THREE.Mesh(roadGeoX, roadMat);
    rx.rotation.x = -Math.PI / 2;
    rx.position.set(0, 0.0, at);
    rx.receiveShadow = true;
    scene.add(rx);
    const rz = new THREE.Mesh(roadGeoZ, roadMat);
    rz.rotation.x = -Math.PI / 2;
    rz.position.set(at, 0.0, 0);
    rz.receiveShadow = true;
    scene.add(rz);
    const lx = new THREE.Mesh(lineGeoX, lineMat);
    lx.rotation.x = -Math.PI / 2;
    lx.position.set(0, 0.06, at);
    scene.add(lx);
    const lz = new THREE.Mesh(lineGeoZ, lineMat);
    lz.rotation.x = -Math.PI / 2;
    lz.position.set(at, 0.06, 0);
    scene.add(lz);
    city.roads.push({ axis: 'x', at, x1: -216, x2: 216, z1: at, z2: at });
    city.roads.push({ axis: 'z', at, x1: at, x2: at, z1: -216, z2: 216 });
  }

  // ---------- Buildings: sidewalks + towers, facades with lit windows ----------
  const sidewalkMat = new THREE.MeshLambertMaterial({ color: C.sidewalk });
  const sidewalkGeo = new THREE.BoxGeometry(46, 0.35, 46);
  const facadeMats = C.buildingPalette.map((hex) => {
    const { map, emissive } = facadeTextures(hexCss(hex), 0.42);
    const mapTex = new THREE.CanvasTexture(map);
    mapTex.colorSpace = THREE.SRGBColorSpace;
    const emTex = new THREE.CanvasTexture(emissive);
    emTex.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshLambertMaterial({
      map: mapTex, emissive: 0xffb35c, emissiveMap: emTex, emissiveIntensity: 0.85
    });
  });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (let gx = -4; gx < 4; gx++) {
    for (let gz = -4; gz < 4; gz++) {
      const cx = gx * PITCH + PITCH / 2;
      const cz = gz * PITCH + PITCH / 2;
      const distCentre = Math.hypot(cx, cz);
      const slab = new THREE.Mesh(sidewalkGeo, sidewalkMat);
      slab.position.set(cx, 0.1, cz);
      slab.receiveShadow = true;
      scene.add(slab);
      // Ember Garage block keeps its low landmark building (see below).
      if (cx === -27 && cz === 27) continue;
      const downtown = distCentre < 80;
      const tall = downtown ? rand(30, 68) : rand(7, distCentre < 150 ? 26 : 15);
      const w = downtown ? rand(20, 30) : rand(14, 26);
      const d = downtown ? rand(20, 30) : rand(14, 26);
      const b = new THREE.Mesh(boxGeo, pick(facadeMats));
      b.scale.set(w, tall, d);
      b.position.set(cx + rand(-4, 4), 0.3 + tall / 2, cz + rand(-4, 4));
      b.castShadow = true;
      b.receiveShadow = true;
      scene.add(b);
      // A second low neighbour on larger outer blocks.
      if (!downtown && Math.random() < 0.5) {
        const h2 = rand(5, 10);
        const b2 = new THREE.Mesh(boxGeo, pick(facadeMats));
        b2.scale.set(rand(10, 16), h2, rand(10, 16));
        b2.position.set(cx + rand(-12, 12), 0.3 + h2 / 2, cz + rand(-12, 12));
        b2.castShadow = true;
        scene.add(b2);
      }
    }
  }

  // ---------- Ember Garage landmark (Mara's place, mission start) ----------
  const garage = new THREE.Group();
  const garageBody = new THREE.Mesh(
    new THREE.BoxGeometry(30, 7, 18),
    new THREE.MeshLambertMaterial({ color: 0x4a3f38 })
  );
  garageBody.position.y = 3.5;
  garageBody.castShadow = true;
  garage.add(garageBody);
  const garageRoof = new THREE.Mesh(
    new THREE.BoxGeometry(32, 1, 20),
    new THREE.MeshLambertMaterial({ color: 0x2c2622 })
  );
  garageRoof.position.y = 7.4;
  garage.add(garageRoof);
  const garageSign = new THREE.Mesh(
    new THREE.BoxGeometry(24, 2.2, 0.6),
    new THREE.MeshBasicMaterial({ color: 0xff7a1f })
  );
  garageSign.position.set(0, 6.2, 9.2);
  garage.add(garageSign);
  const garageDoor = new THREE.Mesh(
    new THREE.PlaneGeometry(12, 5),
    new THREE.MeshLambertMaterial({ color: 0x8a8f96 })
  );
  garageDoor.position.set(-6, 2.8, 9.05);
  garage.add(garageDoor);
  garage.position.set(-27, 0.3, 27);
  scene.add(garage);

  // ---------- Streetlights: poles + warm glowing lamps ----------
  const poleGeo = new THREE.CylinderGeometry(0.14, 0.2, 6.4, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2e3138 });
  const lampGeo = new THREE.SphereGeometry(0.55, 10, 8);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffc36a });
  const lampLightMat = new THREE.MeshLambertMaterial({ color: 0x3a3f47, emissive: 0xffb347, emissiveIntensity: 1.4 });
  for (const at of ROAD_AT) {
    for (let t = -189; t <= 189; t += PITCH) {
      for (const [x, z] of [[t, at + 7.2], [at + 7.2, t]]) {
        const pole = new THREE.Mesh(poleGeo, poleMat);
        pole.position.set(x, 3.2, z);
        scene.add(pole);
        const lamp = new THREE.Mesh(lampGeo, lampMat);
        lamp.position.set(x, 6.6, z);
        scene.add(lamp);
        const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.5), lampLightMat);
        head.position.set(x, 6.5, z);
        scene.add(head);
      }
    }
  }
  // A handful of real point lights downtown so the towers glow warmly.
  for (const [x, z] of [[-54, -54], [54, -54], [-54, 54], [54, 54], [0, 0]]) {
    const pl = new THREE.PointLight(0xff9a3c, 60, 70, 1.8);
    pl.position.set(x, 8, z);
    scene.add(pl);
  }

  // ---------- Palms along the beach ----------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5c3a });
  const frondMat = new THREE.MeshLambertMaterial({ color: 0x2e6b34 });
  for (let px = -210; px <= 210; px += 30) {
    if (Math.abs(px) < 24) continue; // keep the beach spawn clear
    const palm = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 8, 6), trunkMat);
    trunk.position.y = 4;
    trunk.rotation.z = rand(-0.12, 0.12);
    palm.add(trunk);
    const crown = new THREE.Mesh(new THREE.ConeGeometry(3.2, 3.4, 7), frondMat);
    crown.position.y = 9;
    palm.add(crown);
    palm.position.set(px + rand(-6, 6), 0, 202 + rand(-4, 8));
    palm.castShadow = true;
    scene.add(palm);
  }

  // ---------- Port EAST: containers + cranes ----------
  const portSlab = new THREE.Mesh(
    new THREE.BoxGeometry(120, 0.4, 130),
    new THREE.MeshLambertMaterial({ color: 0x6a6f75 })
  );
  portSlab.position.set(272, 0.1, 0);
  portSlab.receiveShadow = true;
  scene.add(portSlab);
  const containerColors = [0xb03a2e, 0x2e6fb0, 0x3a8a4a, 0xd8a83c, 0x7a4a9a];
  for (let i = 0; i < 26; i++) {
    const c = new THREE.Mesh(
      boxGeo,
      new THREE.MeshLambertMaterial({ color: pick(containerColors) })
    );
    const stack = Math.random() < 0.3 ? 2 : 1;
    c.scale.set(12, 2.6 * stack, 2.6);
    c.position.set(rand(228, 312), 0.3 + 1.3 * stack, rand(-55, 55));
    c.rotation.y = Math.random() < 0.5 ? 0 : Math.PI / 2;
    c.castShadow = true;
    scene.add(c);
  }
  for (const zc of [-38, 38]) {
    const crane = new THREE.Group();
    const legMat = new THREE.MeshLambertMaterial({ color: 0xd8a83c });
    for (const [lx, lz] of [[-4, -3], [4, -3], [-4, 3], [4, 3]]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 26, 1.4), legMat);
      leg.position.set(lx, 13, lz);
      crane.add(leg);
    }
    const arm = new THREE.Mesh(new THREE.BoxGeometry(34, 1.6, 2), legMat);
    arm.position.set(6, 26, 0);
    crane.add(arm);
    const hook = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 2), new THREE.MeshLambertMaterial({ color: 0x2e3138 }));
    hook.position.set(16, 21, 0);
    crane.add(hook);
    crane.position.set(258, 0, zc);
    scene.add(crane);
  }

  // ---------- Boats in the bay + buoys ----------
  const hullMat = new THREE.MeshLambertMaterial({ color: 0xe8e2d4 });
  for (const [bx, bz, s] of [[-90, 300, 1], [60, 330, 1.4], [150, 290, 0.8]]) {
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(10 * s, 2.4, 4 * s), hullMat);
    hull.position.y = 0.8;
    boat.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(4 * s, 2.4, 3 * s),
      new THREE.MeshLambertMaterial({ color: 0x2e6fb0 }));
    cabin.position.set(-1, 2.8, 0);
    boat.add(cabin);
    boat.position.set(bx, -0.2, bz);
    boat.rotation.y = rand(0, Math.PI);
    scene.add(boat);
  }
  const buoyMat = new THREE.MeshBasicMaterial({ color: 0xff5340 });
  for (const [bx, bz] of [[-40, 260], [110, 270], [0, 320]]) {
    const buoy = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), buoyMat);
    buoy.position.set(bx, 0.4, bz);
    scene.add(buoy);
  }

  // ---------- Hills NORTH: dark green cones ----------
  const hillMat = new THREE.MeshLambertMaterial({ color: 0x2c4a28 });
  for (let i = 0; i < 9; i++) {
    const h = rand(26, 70);
    const hill = new THREE.Mesh(new THREE.ConeGeometry(rand(30, 60), h, 8), hillMat);
    hill.position.set(rand(-330, 330), h / 2 - 2, rand(-330, -235));
    hill.castShadow = true;
    scene.add(hill);
  }
}

export function randomRoadPos(G) {
  const roads = G.city.roads;
  const road = roads[Math.floor(Math.random() * roads.length)];
  if (road.axis === 'x') {
    return { x: rand(road.x1 + 8, road.x2 - 8), z: road.at + rand(-4, 4) };
  }
  return { x: road.at + rand(-4, 4), z: rand(road.z1 + 8, road.z2 - 8) };
}

export function clampToCity(G, x, z) {
  const b = G.city.bounds - 4;
  return {
    x: Math.max(-b, Math.min(b, x)),
    z: Math.max(-b, Math.min(b, z))
  };
}
