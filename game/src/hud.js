// hud.js — HUD, minimap and money helper for SOLMARA (gta6-01, session C)
// Reads G.state every frame and paints the DOM ids from the spec plus a
// top-down minimap. Written fresh; no imports from other modules.

const WORLD_HALF = 210; // CONFIG.city.size / 2
const ROAD_PITCH = 54; // block 42 + roadWidth 12
const GAME_START_MINUTES = 18 * 60 + 42; // golden hour 18:42
const GAME_MINUTES_PER_REAL_SECOND = 0.5; // clock creeps forward slowly

// Deterministic pseudo-random for the minimap's building blocks.
function hash2(ix, iz) {
  let h = (ix * 73856093) ^ (iz * 19349663);
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

export function initHUD(G) {
  const ids = ['hud', 'stars', 'money', 'objective', 'health-bar', 'health-fill',
    'speed', 'minimap', 'banner', 'banner-title', 'banner-sub',
    'wanted-label', 'mission-label', 'time'];
  G.hud.el = {};
  for (const id of ids) {
    G.hud.el[id] = document.getElementById(id);
  }
  // Build the 5 star spans if the page left #stars empty.
  const starsEl = G.hud.el.stars;
  if (starsEl && starsEl.children.length === 0) {
    for (let i = 0; i < 5; i++) {
      const s = document.createElement('span');
      s.className = 'star';
      s.textContent = '★';
      starsEl.appendChild(s);
    }
  }
  const mm = G.hud.el.minimap;
  G.hud.minimapCtx = mm ? mm.getContext('2d') : null;
  // Cache last-painted values so we only touch the DOM on change.
  G.hud._cache = { money: null, objective: null, health: null, speed: null,
    wanted: null, mission: null, time: null, stars: null };

  function addMoney(n) {
    G.state.money += n;
    if (G.hud.el.money) G.hud.el.money.textContent = '$' + G.state.money;
    G.hud._cache.money = G.state.money;
  }
  G.helpers.addMoney = addMoney;
}

function drawMinimap(G) {
  const ctx = G.hud.minimapCtx;
  if (!ctx) return;
  const S = 180;
  const scale = S / (WORLD_HALF * 2); // world -210..210 -> 0..180
  const toX = (x) => (x + WORLD_HALF) * scale;
  const toY = (z) => (z + WORLD_HALF) * scale; // north (-z) at top
  ctx.clearRect(0, 0, S, S);
  // Ground.
  ctx.fillStyle = '#3d5a3a';
  ctx.fillRect(0, 0, S, S);
  // Sea along the south edge (z > ~150), with a sand strip above it.
  ctx.fillStyle = '#d9c08a';
  ctx.fillRect(0, toY(138), S, toY(152) - toY(138));
  ctx.fillStyle = '#1d5f7a';
  ctx.fillRect(0, toY(152), S, S - toY(152));
  // Buildings: dark blocks between road lines (deterministic pattern).
  ctx.fillStyle = '#2c2f36';
  for (let gx = -216; gx < 216; gx += ROAD_PITCH) {
    for (let gz = -216; gz < 216; gz += ROAD_PITCH) {
      const ix = Math.round(gx / ROAD_PITCH);
      const iz = Math.round(gz / ROAD_PITCH);
      const r = hash2(ix, iz);
      if (r < 0.3) continue; // some blocks are parks / empty lots
      const bx = gx + 8, bz = gz + 8;
      const bw = 38 * (0.6 + r * 0.4);
      const bh = 38 * (0.6 + hash2(iz, ix) * 0.4);
      ctx.fillRect(toX(bx), toY(bz), bw * scale, bh * scale);
    }
  }
  // Roads on the 54-unit grid.
  ctx.strokeStyle = '#4a4f57';
  ctx.lineWidth = 12 * scale;
  ctx.beginPath();
  for (let v = -216; v <= 216; v += ROAD_PITCH) {
    ctx.moveTo(toX(v), 0);
    ctx.lineTo(toX(v), S);
    ctx.moveTo(0, toY(v));
    ctx.lineTo(S, toY(v));
  }
  ctx.stroke();
  // Mission target: yellow star.
  const t = G.state.objectiveTarget;
  if (t) {
    drawStar(ctx, toX(t.x), toY(t.z), 7, '#ffd23c');
    ctx.strokeStyle = '#ffd23c';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(toX(t.x), toY(t.z), 11, 0, Math.PI * 2);
    ctx.stroke();
  }
  // Police: blinking blue/red dots.
  const blink = Math.floor(G.state.time * 3) % 2 === 0;
  for (const car of G.police.cars) {
    ctx.fillStyle = blink ? '#3a86ff' : '#ff2e2e';
    ctx.beginPath();
    ctx.arc(toX(car.pos.x), toY(car.pos.z), 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  if (G.police.heli) {
    ctx.fillStyle = blink ? '#ff2e2e' : '#3a86ff';
    ctx.beginPath();
    ctx.arc(toX(G.police.heli.group.position.x), toY(G.police.heli.group.position.z), 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player position, declared once at the top: the range ring below and
  // the dot/wedge after it both need it (it used to be declared after the
  // ring, which threw a temporal-dead-zone ReferenceError every frame).
  const p = G.player.pos;
  // North marker + 100-unit range ring around the player.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('N', 6, 13);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(toX(p.x), toY(p.z), 100 * scale, 0, Math.PI * 2);
  ctx.stroke();
  // Player: white dot + heading wedge.
  const h = G.player.heading || 0;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(toX(p.x), toY(p.z), 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  const tipX = toX(p.x) + Math.sin(h) * 9;
  const tipY = toY(p.z) + Math.cos(h) * 9;
  const leftX = toX(p.x) + Math.sin(h + 2.5) * 6;
  const leftY = toY(p.z) + Math.cos(h + 2.5) * 6;
  const rightX = toX(p.x) + Math.sin(h - 2.5) * 6;
  const rightY = toY(p.z) + Math.cos(h - 2.5) * 6;
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(leftX, leftY);
  ctx.lineTo(rightX, rightY);
  ctx.closePath();
  ctx.fill();
}

export function updateHUD(G, dt) {
  const el = G.hud.el;
  const c = G.hud._cache || {};
  if (!el) return;

  // Stars: filled amber for current wanted, grey for the rest.
  if (el.stars && c.stars !== G.state.wanted) {
    const spans = el.stars.children;
    for (let i = 0; i < spans.length; i++) {
      spans[i].style.color = i < G.state.wanted ? '#ffb400' : '#5a5f68';
      spans[i].style.textShadow = i < G.state.wanted ? '0 0 6px rgba(255,180,0,0.8)' : 'none';
    }
    c.stars = G.state.wanted;
  }
  // Wanted label.
  if (el['wanted-label']) {
    const show = G.state.wanted > 0;
    el['wanted-label'].style.display = show ? '' : 'none';
    if (show && c.wanted !== G.state.wanted) {
      el['wanted-label'].textContent = 'WANTED ' + '★'.repeat(G.state.wanted);
      c.wanted = G.state.wanted;
    }
  }
  // Money.
  if (el.money && c.money !== G.state.money) {
    el.money.textContent = '$' + G.state.money;
    c.money = G.state.money;
  }
  // Objective.
  if (el.objective && c.objective !== G.state.objectiveText) {
    el.objective.textContent = G.state.objectiveText || '';
    c.objective = G.state.objectiveText;
  }
  // Health bar.
  if (el['health-fill']) {
    const hp = Math.max(0, Math.min(100, Math.round(G.state.health)));
    if (c.health !== hp) {
      el['health-fill'].style.width = hp + '%';
      el['health-fill'].style.background = hp > 50 ? '#37c978' : hp > 25 ? '#ffb400' : '#e5484d';
      c.health = hp;
    }
  }
  // Speed: only while driving.
  if (el.speed) {
    if (G.state.inVehicle) {
      const kmh = Math.round(Math.abs(G.state.speed || 0) * 3.6);
      if (c.speed !== kmh) {
        el.speed.textContent = kmh + ' km/h';
        c.speed = kmh;
      }
      el.speed.style.display = '';
    } else {
      el.speed.style.display = 'none';
      c.speed = null;
    }
  }
  // Mission label.
  if (el['mission-label']) {
    const label = 'MISSION ' + (G.state.missionIndex + 1) + '/9';
    if (c.mission !== label) {
      el['mission-label'].textContent = label;
      c.mission = label;
    }
  }
  // Clock: golden hour, creeping forward.
  if (el.time) {
    const mins = GAME_START_MINUTES + G.state.time * GAME_MINUTES_PER_REAL_SECOND;
    const hh = Math.floor(mins / 60) % 24;
    const mm = Math.floor(mins % 60);
    const text = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    if (c.time !== text) {
      el.time.textContent = text;
      c.time = text;
    }
  }
  // Minimap every frame.
  drawMinimap(G);
}
