// SOLMARA — entrypoint. Builds the renderer, the shared G context, calls
// every module's init once, then runs the frame loop in the spec's order.
// Three.js arrives as the global THREE from vendor/three.min.js (classic
// script in index.html); every game module is an ES module imported here.

import { CONFIG } from './config.js';
import { initInput, updateInput } from './input.js';
import { buildCity } from './city.js';
import { initPlayer, updatePlayer } from './player.js';
import { initVehicles, updateVehicles } from './vehicles.js';
import { initPedestrians, updatePedestrians } from './pedestrians.js';
import { initPolice, updatePolice } from './police.js';
import { initMissions, updateMissions } from './missions.js';
import { initCombat, updateCombat } from './combat.js';
import { initHUD, updateHUD } from './hud.js';
import { initAudio, updateAudio } from './audio.js';
import { initSave } from './save.js';
import { initEffects, updateEffects } from './effects.js';
import { initMenus, updateMenus } from './menus.js';
import { applyShot } from './shots.js';

const app = document.getElementById('app');

// ---------- Renderer / scene / camera ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2000);
camera.position.set(-40, 26, 90);
camera.lookAt(0, 4, 0);
const clock = new THREE.Clock();

// ---------- Shared context G (shape fixed by the spec) ----------
const G = {
  scene, camera, renderer, clock,
  config: CONFIG,
  state: {
    money: CONFIG.money.start, wanted: 0, health: CONFIG.player.health,
    missionIndex: 0, objectiveText: '', objectiveTarget: null,
    started: false, paused: false, gameOver: false,
    time: 0, speed: 0, inVehicle: null, kills: 0, carsStolen: 0
  },
  player: { group: null, pos: new THREE.Vector3(-27, 0, 20), heading: 0, speed: 0, onFoot: true },
  cars: [],
  peds: [],
  police: { cars: [], heli: null, roadblocks: [] },
  missions: { list: [], currentIndex: 0, current: null },
  audio: { ctx: null, master: null, radioOn: false, station: 0 },
  hud: { el: {} },
  city: { bounds: CONFIG.city.size / 2, roads: [], spawnPoints: { garage: { x: -27, z: 42 }, beach: { x: 0, z: 196 }, downtown: { x: 0, z: 0 } } },
  input: { keys: new Set(), mouseDX: 0 },
  helpers: {}
};
window.SOLMARA = G; // handy for debugging in the console; harmless in play.

// ---------- Build the world, then init every module ----------
buildCity(G);
initInput(G);
initPlayer(G);
initVehicles(G);
initPedestrians(G);
initPolice(G);
initMissions(G);
initCombat(G);
initHUD(G);
initAudio(G);
initSave(G);
initEffects(G);
initMenus(G);

// ---------- Camera: slow orbit over the city on the menu, chase cam in play ----------
const camTarget = new THREE.Vector3(-27, 1.6, 27);
const camPos = new THREE.Vector3(-40, 26, 90);
const tmpForward = new THREE.Vector3();
const tmpLook = new THREE.Vector3();

function followCamera(dt) {
  // Screenshot poses: shots.js can pin the camera (e.g. the wide aerial
  // for the `city` shot) — a pinned camera wins over chase and menu orbit.
  if (G._shotCam) {
    camera.position.lerp(G._shotCam.pos, Math.min(1, dt * 3));
    camera.lookAt(G._shotCam.look);
    return;
  }
  if (!G.state.started) {
    // Menu backdrop: a slow golden-hour orbit around downtown.
    const t = performance.now() * 0.00004;
    const r = 120;
    tmpLook.set(0, 12, 0);
    camPos.set(Math.cos(t) * r, 46, Math.sin(t) * r);
    camera.position.lerp(camPos, Math.min(1, dt * 1.5));
    camera.lookAt(tmpLook);
    return;
  }
  const focus = G.state.inVehicle ? G.state.inVehicle.group : G.player.group;
  if (!focus) return;
  focus.getWorldDirection(tmpForward);
  tmpForward.y = 0;
  if (tmpForward.lengthSq() < 0.001) tmpForward.set(0, 0, 1);
  tmpForward.normalize();
  // A flick of the mouse nudges the chase camera sideways a touch, so the
  // player can glance around a corner without touching the steering.
  const glance = THREE.MathUtils.clamp(G.input.mouseDX * 0.0012, -0.35, 0.35);
  if (glance !== 0) tmpForward.applyAxisAngle(new THREE.Vector3(0, 1, 0), glance);
  const focusPos = focus.position;
  const dist = CONFIG.camera.dist;
  const height = CONFIG.camera.height;
  camPos.set(
    focusPos.x - tmpForward.x * dist,
    focusPos.y + height,
    focusPos.z - tmpForward.z * dist
  );
  if (camPos.y < 1.4) camPos.y = 1.4;
  camera.position.lerp(camPos, Math.min(1, dt * 5));
  tmpLook.set(focusPos.x, focusPos.y + CONFIG.camera.lookHeight, focusPos.z);
  camera.lookAt(tmpLook);
  // Camera shake: effects.js stores the trauma in G.effects.shakeAmt /
  // shakeT (decayed each frame by updateEffects); read it here so an
  // explosion actually rattles the chase camera.
  const fx = G.effects;
  if (fx && fx.shakeT > 0 && fx.shakeAmt > 0) {
    const s = fx.shakeAmt * (fx.shakeT / 0.45) * 0.55;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s * 0.7;
    camera.position.z += (Math.random() - 0.5) * s;
  }
}

// ---------- Resize ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Hiding the tab mid-chase must never leave the city running unwatched:
// pause automatically, the same way Esc does.
document.addEventListener('visibilitychange', () => {
  if (document.hidden && G.state.started && !G.state.gameOver) G.state.paused = true;
});

// ---------- Frame loop (update order fixed by the spec) ----------
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (G.state.started && !G.state.paused && !G.state.gameOver) {
    G.state.time += dt;
    updateInput(G, dt);
    updatePlayer(G, dt);
    updateVehicles(G, dt);
    updatePedestrians(G, dt);
    updatePolice(G, dt);
    updateMissions(G, dt);
    updateCombat(G, dt);
    updateEffects(G, dt);
    updateHUD(G, dt);
    updateAudio(G, dt);
    updateMenus(G, dt);
  }
  followCamera(dt);
  renderer.render(scene, camera);
}
loop();

// ---------- Screenshot poses: ?shot=cover|mission|drive|city ----------
const shotName = new URLSearchParams(window.location.search).get('shot');
if (shotName) {
  window.setTimeout(() => applyShot(G, shotName), 1200);
}
