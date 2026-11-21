// gta6-01 — menus.js (session D)
// Start / pause / game-over menus + centre banner. Written fresh from the
// shared spec only. Contract: initMenus(G), updateMenus(G, dt).
// Helpers attached here: G.helpers.showBanner.
// Helpers used defensively (&&): startMission (missions), loadGame (save),
// resumeAudio (audio), playSound (audio).
// Button ids are not fixed by the spec, so buttons are found inside each
// menu by their label text (START / CONTINUE / RESUME / RESTART / MENU).

const BANNER_MS = 3000;

function el(id) {
  return typeof document !== 'undefined' ? document.getElementById(id) : null;
}

function findButton(menuEl, pattern) {
  if (!menuEl) return null;
  const btns = menuEl.querySelectorAll('button');
  for (const b of btns) {
    if (pattern.test((b.textContent || '').trim())) return b;
  }
  return null;
}

function showMenu(id) {
  const m = el(id);
  if (m) m.style.display = 'flex';
}

function hideMenu(id) {
  const m = el(id);
  if (m) m.style.display = 'none';
}

function hideAllMenus() {
  hideMenu('menu-start');
  hideMenu('menu-pause');
  hideMenu('menu-gameover');
}

function clickSound(G) {
  if (G.helpers && typeof G.helpers.playSound === 'function') G.helpers.playSound('click');
}

function resetRunState(G) {
  G.state.money = 500;
  G.state.wanted = 0;
  G.state.health = 100;
  G.state.missionIndex = 0;
  G.state.objectiveText = '';
  G.state.objectiveTarget = null;
  G.state.started = true;
  G.state.paused = false;
  G.state.gameOver = false;
  G.state.kills = 0;
  G.state.carsStolen = 0;
  G.state.speed = 0;
  G.state.inVehicle = null;
  if (G.missions) {
    G.missions.currentIndex = 0;
    G.missions.current = null;
  }
  // Put Dante back at the Ember Garage so a restart is never stranded.
  const sp = (G.city && G.city.spawnPoints) || {};
  const garage = sp.garage || { x: -40, z: 60 };
  if (G.player) {
    if (G.player.pos && typeof G.player.pos.x === 'number') {
      G.player.pos.x = garage.x;
      G.player.pos.z = garage.z;
      if (typeof G.player.pos.y === 'number') G.player.pos.y = 0;
    }
    if (G.player.group && G.player.group.position) {
      G.player.group.position.set(garage.x, 0, garage.z);
    }
    G.player.onFoot = true;
  }
}

function beginRun(G, missionIndex) {
  if (G.helpers && typeof G.helpers.resumeAudio === 'function') {
    G.helpers.resumeAudio();
  }
  G.state.started = true;
  G.state.paused = false;
  G.state.gameOver = false;
  hideAllMenus();
  if (G.helpers && typeof G.helpers.startMission === 'function') {
    G.helpers.startMission(missionIndex);
  }
}

function showBanner(G, title, sub, ms) {
  const bannerEl = el('banner');
  const titleEl = el('banner-title');
  const subEl = el('banner-sub');
  if (!bannerEl) return;
  if (titleEl) titleEl.textContent = title || '';
  if (subEl) subEl.textContent = sub || '';
  bannerEl.style.display = 'block';
  bannerEl.style.opacity = '1';
  const m = G.menus || (G.menus = {});
  if (m._bannerTimer) clearTimeout(m._bannerTimer);
  m._bannerTimer = setTimeout(function () {
    bannerEl.style.opacity = '0';
    setTimeout(function () {
      bannerEl.style.display = 'none';
    }, 400);
  }, ms || BANNER_MS);
}

export function initMenus(G) {
  G.menus = G.menus || {};
  if (!G.helpers) G.helpers = {};
  G.helpers.showBanner = function showBannerHelper(title, sub, ms) {
    showBanner(G, title, sub, ms);
  };
  if (G.menus._wired) return;
  G.menus._wired = true;
  G.menus._escPrev = false;
  G.menus._gameOverShown = false;

  hideMenu('menu-pause');
  hideMenu('menu-gameover');

  const startMenu = el('menu-start');
  const pauseMenu = el('menu-pause');
  const overMenu = el('menu-gameover');

  // CONTINUE is only offered when a save exists.
  const continueBtn = findButton(startMenu, /continue/i);
  G.menus._continueBtn = continueBtn || null;
  let hasSave = false;
  try {
    hasSave = !!(
      typeof localStorage !== 'undefined' && localStorage.getItem('solmara-save-v1')
    );
  } catch (err) {
    hasSave = false;
  }
  if (continueBtn) continueBtn.style.display = hasSave ? '' : 'none';

  const startBtn = findButton(startMenu, /start/i);
  if (startBtn) {
    startBtn.addEventListener('click', function () {
      clickSound(G);
      resetRunState(G);
      beginRun(G, 0);
    });
  }
  if (continueBtn) {
    continueBtn.addEventListener('click', function () {
      clickSound(G);
      if (G.helpers && typeof G.helpers.loadGame === 'function') {
        G.helpers.loadGame();
      }
      const idx = Math.min(G.state.missionIndex || 0, 8);
      beginRun(G, idx);
    });
  }

  const resumeBtn = findButton(pauseMenu, /resume|continue/i);
  if (resumeBtn) {
    resumeBtn.addEventListener('click', function () {
      clickSound(G);
      G.state.paused = false;
      hideMenu('menu-pause');
    });
  }
  const pauseRestartBtn = findButton(pauseMenu, /restart/i);
  if (pauseRestartBtn) {
    pauseRestartBtn.addEventListener('click', function () {
      clickSound(G);
      resetRunState(G);
      beginRun(G, 0);
    });
  }
  const pauseMenuBtn = findButton(pauseMenu, /^menu$/i);
  if (pauseMenuBtn) {
    pauseMenuBtn.addEventListener('click', function () {
      clickSound(G);
      G.state.paused = false;
      G.state.started = false;
      hideAllMenus();
      showMenu('menu-start');
    });
  }

  const overRestartBtn = findButton(overMenu, /restart/i);
  if (overRestartBtn) {
    overRestartBtn.addEventListener('click', function () {
      clickSound(G);
      resetRunState(G);
      beginRun(G, 0);
    });
  }
  const overMenuBtn = findButton(overMenu, /menu/i);
  if (overMenuBtn) {
    overMenuBtn.addEventListener('click', function () {
      clickSound(G);
      G.state.gameOver = false;
      G.state.started = false;
      hideAllMenus();
      showMenu('menu-start');
    });
  }
}

export function updateMenus(G, dt) {
  const m = G.menus || (G.menus = {});

  // Keep CONTINUE honest: a save can appear mid-session (auto-save every
  // 30s), so re-check while the start menu is the active screen instead
  // of only once at init.
  if (!G.state.started && m._continueBtn) {
    let hasSave = false;
    try {
      hasSave = !!(
        typeof localStorage !== 'undefined' && localStorage.getItem('solmara-save-v1')
      );
    } catch (err) {
      hasSave = false;
    }
    m._continueBtn.style.display = hasSave ? '' : 'none';
  }

  // Esc toggles pause (edge-triggered). Never pauses before the run starts
  // or after game over.
  const escDown = !!(G.input && G.input.keys && G.input.keys.has('Escape'));
  if (escDown && !m._escPrev && G.state.started && !G.state.gameOver) {
    G.state.paused = !G.state.paused;
    if (G.state.paused) showMenu('menu-pause');
    else hideMenu('menu-pause');
    clickSound(G);
  }
  m._escPrev = escDown;

  // Game over: show the panel once, hide it again if the run restarts.
  if (G.state.gameOver) {
    if (!m._gameOverShown) {
      m._gameOverShown = true;
      hideMenu('menu-pause');
      showMenu('menu-gameover');
      if (G.helpers && typeof G.helpers.playSound === 'function') {
        G.helpers.playSound('explosion');
      }
    }
  } else if (m._gameOverShown) {
    m._gameOverShown = false;
    hideMenu('menu-gameover');
  }
}
