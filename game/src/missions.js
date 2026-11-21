// gta6-01 — missions.js (session D)
// Chained story jobs for Dante Reyes. Written fresh from the shared spec only.
// Contract: MISSIONS (9 jobs), initMissions(G), updateMissions(G, dt).
// Helpers attached here: G.helpers.setObjective, G.helpers.startMission.
// Helpers used defensively (&&): showBanner (menus), addMoney (hud),
// saveGame/loadGame (save), setWanted (police), playSound (audio).

const ARRIVE_DIST = 8;

function clampCoord(v) {
  return Math.max(-200, Math.min(200, v));
}

function playerPos(G) {
  const p = G.player;
  if (!p) return { x: 0, z: 0 };
  if (p.pos && typeof p.pos.x === 'number') return { x: p.pos.x, z: p.pos.z };
  if (p.group && p.group.position) return { x: p.group.position.x, z: p.group.position.z };
  return { x: 0, z: 0 };
}

function dist2D(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function banner(G, title, sub) {
  if (G.helpers && typeof G.helpers.showBanner === 'function') {
    G.helpers.showBanner(title, sub || '');
  }
}

function pay(G, n) {
  if (G.helpers && typeof G.helpers.addMoney === 'function') G.helpers.addMoney(n);
  else G.state.money = (G.state.money || 0) + n;
}

function setWantedSafe(G, n) {
  if (G.helpers && typeof G.helpers.setWanted === 'function') G.helpers.setWanted(n);
  else G.state.wanted = Math.max(0, Math.min(5, n));
}

function saveSafe(G) {
  if (G.helpers && typeof G.helpers.saveGame === 'function') G.helpers.saveGame();
}

function setObjective(G, text, target) {
  G.state.objectiveText = text;
  G.state.objectiveTarget = target || null;
  if (G.missions) {
    const cur = G.missions.current;
    if (cur) cur._liveTarget = target || null;
  }
}

function baseOnDone(mission) {
  return function onDone(G) {
    pay(G, mission.reward);
    banner(G, 'MISSION PASSED', mission.title + '  +$' + mission.reward);
    if (G.helpers && typeof G.helpers.playSound === 'function') {
      G.helpers.playSound('cash');
    }
    saveSafe(G);
  };
}

export const MISSIONS = [
  {
    id: 'first-gear',
    title: 'First Gear',
    giver: 'Mara Voss',
    brief: 'Dante owes a debt. Drive to the Ember Garage and meet Mara.',
    objective: 'Drive to the Ember Garage',
    target: { x: -40, z: 60, label: 'Ember Garage' },
    reward: 200,
    onStart(G) {
      // Read the live target: initMissions resolves it from spawnPoints,
      // so a stale fallback baked into the literal must never be used.
      const live = MISSIONS[0];
      setObjective(G, live.objective, live.target);
      banner(G, live.title, 'Meet Mara Voss at the Ember Garage.');
      if (G.helpers && typeof G.helpers.playSound === 'function') G.helpers.playSound('mission');
    },
    onDone: baseOnDone({ title: 'First Gear', reward: 200 }),
  },
  {
    id: 'pickup',
    title: 'The Pickup',
    giver: 'Mara Voss',
    brief: 'Steal a car off the street and deliver it to the port.',
    objective: 'Steal a car (walk up and press E)',
    target: { x: 180, z: 0, label: 'Solmara Port' },
    reward: 400,
    onStart(G) {
      G.missions.rt.phase = 1;
      setObjective(G, 'Steal a car (walk up and press E)', null);
      banner(G, 'The Pickup', 'Steal a car and deliver it to the port.');
      if (G.helpers && typeof G.helpers.playSound === 'function') G.helpers.playSound('mission');
    },
    onDone: baseOnDone({ title: 'The Pickup', reward: 400 }),
  },
  {
    id: 'hot-wheels',
    title: 'Hot Wheels',
    giver: 'Mara Voss',
    brief: 'The SMPD is watching. Reach 2 stars, then lose the heat.',
    objective: 'Reach wanted level 2, then lose it',
    target: { x: -120, z: 150, label: 'Beach Hideout' },
    reward: 600,
    onStart(G) {
      G.missions.rt.phase = 1;
      G.missions.rt.seenHigh = false;
      setObjective(G, 'Reach wanted level 2, then lose it', null);
      banner(G, 'Hot Wheels', 'Get the cops riled up — then vanish.');
      if (G.helpers && typeof G.helpers.playSound === 'function') G.helpers.playSound('mission');
    },
    onDone: baseOnDone({ title: 'Hot Wheels', reward: 600 }),
  },
  {
    id: 'exchange',
    title: 'The Exchange',
    giver: 'Mara Voss',
    brief: 'Deliver a package downtown. The Vultures will not let it go easy.',
    objective: 'Deliver the package downtown',
    target: { x: 0, z: 0, label: 'Downtown Drop' },
    reward: 900,
    onStart(G) {
      G.missions.rt.phase = 1;
      setObjective(G, 'Deliver the package downtown', G.missions.current.target);
      banner(G, 'The Exchange', 'Downtown drop. Watch your back.');
      if (G.helpers && typeof G.helpers.playSound === 'function') G.helpers.playSound('mission');
    },
    onDone: baseOnDone({ title: 'The Exchange', reward: 900 }),
  },
  {
    id: 'air-support',
    title: 'Air Support',
    giver: 'Mara Voss',
    brief: 'AIR-1 is overhead. Stay hot at 3 stars for 20 seconds and live.',
    objective: 'Survive at wanted level 3 for 20 seconds',
    target: { x: 0, z: 0, label: 'Downtown' },
    reward: 1200,
    onStart(G) {
      G.missions.rt.phase = 1;
      G.missions.rt.timer = 0;
      setObjective(G, 'Survive at wanted level 3 for 20 seconds', null);
      banner(G, 'Air Support', 'AIR-1 is on you. Do not get caught.');
      if (G.helpers && typeof G.helpers.playSound === 'function') G.helpers.playSound('mission');
    },
    onDone: baseOnDone({ title: 'Air Support', reward: 1200 }),
  },
  {
    id: 'roadblock-run',
    title: 'Roadblock Run',
    giver: 'Mara Voss',
    brief: 'SMPD roadblocks are up. Smash through 2 of them.',
    objective: 'Smash through 2 roadblocks (0/2)',
    target: { x: 120, z: -120, label: 'North Highway' },
    reward: 1500,
    onStart(G) {
      G.missions.rt.phase = 1;
      G.missions.rt.passed = [];
      setObjective(G, 'Smash through 2 roadblocks (0/2)', null);
      banner(G, 'Roadblock Run', 'Two roadblocks. Foot down.');
      if (G.helpers && typeof G.helpers.playSound === 'function') G.helpers.playSound('mission');
    },
    onDone: baseOnDone({ title: 'Roadblock Run', reward: 1500 }),
  },
  {
    id: 'heist',
    title: 'The Heist',
    giver: 'Mara Voss',
    brief: 'Rob the Solmara Bank, grab $5000, and escape the heat.',
    objective: 'Rob the Solmara Bank',
    target: { x: 21, z: 0, label: 'Solmara Bank' },
    reward: 2500,
    onStart(G) {
      G.missions.rt.phase = 1;
      setObjective(G, 'Rob the Solmara Bank', G.missions.current.target);
      banner(G, 'The Heist', 'In and out. $5000 on the table.');
      if (G.helpers && typeof G.helpers.playSound === 'function') G.helpers.playSound('mission');
    },
    onDone: baseOnDone({ title: 'The Heist', reward: 2500 }),
  },
  {
    id: 'payback',
    title: 'Payback',
    giver: 'Mara Voss',
    brief: 'Silas Rook is at the port with his crew. End it.',
    objective: 'Take down Silas Rook and his crew at the port (0/5)',
    target: { x: 180, z: 0, label: 'Solmara Port' },
    reward: 4000,
    onStart(G) {
      G.missions.rt.phase = 1;
      G.missions.rt.killsAtStart = G.state.kills || 0;
      G.state.missionEnemies = 5;
      setObjective(G, 'Take down Silas Rook and his crew at the port (0/5)', G.missions.current.target);
      banner(G, 'Payback', 'Silas Rook. The port. No mercy.');
      if (G.helpers && typeof G.helpers.playSound === 'function') G.helpers.playSound('mission');
    },
    onDone: baseOnDone({ title: 'Payback', reward: 4000 }),
  },
  {
    id: 'clean-getaway',
    title: 'Clean Getaway',
    giver: 'Mara Voss',
    brief: 'Five stars. The whole island is hunting you. Lose them all.',
    objective: 'Reach wanted level 5, then lose it all',
    target: { x: -120, z: 150, label: 'Beach Hideout' },
    reward: 5000,
    onStart(G) {
      G.missions.rt.phase = 1;
      G.missions.rt.seenHigh = false;
      setObjective(G, 'Reach wanted level 5, then lose it all', null);
      banner(G, 'Clean Getaway', 'Five stars. One way out: gone.');
      if (G.helpers && typeof G.helpers.playSound === 'function') G.helpers.playSound('mission');
    },
    onDone: baseOnDone({ title: 'Clean Getaway', reward: 5000 }),
  },
];

function resolveTargets(G) {
  const sp = (G.city && G.city.spawnPoints) || {};
  const garage = sp.garage || { x: -40, z: 60 };
  const beach = sp.beach || { x: -120, z: 150 };
  const downtown = sp.downtown || { x: 0, z: 0 };
  const port = { x: 180, z: 0 };
  const bank = {
    x: clampCoord(downtown.x + 21),
    z: clampCoord(downtown.z),
  };
  const northHighway = { x: 120, z: -120 };
  const map = {
    'first-gear': { ...garage, label: 'Ember Garage' },
    pickup: { ...port, label: 'Solmara Port' },
    'hot-wheels': { ...beach, label: 'Beach Hideout' },
    exchange: { ...downtown, label: 'Downtown Drop' },
    'air-support': { ...downtown, label: 'Downtown' },
    'roadblock-run': { ...northHighway, label: 'North Highway' },
    heist: { ...bank, label: 'Solmara Bank' },
    payback: { ...port, label: 'Solmara Port' },
    'clean-getaway': { ...beach, label: 'Beach Hideout' },
  };
  for (const m of MISSIONS) {
    if (map[m.id]) m.target = map[m.id];
  }
}

function startMission(G, index) {
  const m = MISSIONS[index];
  if (!m) return;
  G.missions.currentIndex = index;
  G.missions.current = m;
  G.state.missionIndex = index;
  G.missions.rt = { phase: 1, timer: 0, killsAtStart: 0, seenHigh: false, passed: [] };
  if (typeof m.onStart === 'function') m.onStart(G);
}

function completeMission(G) {
  const m = G.missions.current;
  if (!m) return;
  if (typeof m.onDone === 'function') m.onDone(G);
  const next = G.missions.currentIndex + 1;
  G.missions.current = null;
  G.state.missionIndex = next;
  G.missions.currentIndex = next;
  saveSafe(G);
  if (next >= MISSIONS.length) {
    G.state.missionIndex = MISSIONS.length;
    G.state.objectiveText = 'Solmara is yours.';
    G.state.objectiveTarget = null;
    pay(G, 1000);
    banner(G, 'SOLMARA LEGEND', 'Every job done. The debt is paid. +$1000 legend bonus');
    if (G.helpers && typeof G.helpers.playSound === 'function') G.helpers.playSound('mission');
    saveSafe(G);
    return;
  }
  startMission(G, next);
}

function roadblockPos(rb) {
  if (!rb) return null;
  if (rb.pos && typeof rb.pos.x === 'number') return { x: rb.pos.x, z: rb.pos.z };
  if (typeof rb.x === 'number') return { x: rb.x, z: rb.z || 0 };
  if (rb.group && rb.group.position) return { x: rb.group.position.x, z: rb.group.position.z };
  return null;
}

export function initMissions(G) {
  G.missions = G.missions || {};
  resolveTargets(G);
  G.missions.list = MISSIONS;
  G.missions.currentIndex = G.state.missionIndex || 0;
  G.missions.current = null;
  G.missions.rt = { phase: 1, timer: 0, killsAtStart: 0, seenHigh: false, passed: [] };
  if (!G.helpers) G.helpers = {};
  G.helpers.setObjective = function setObjectiveHelper(text, target) {
    setObjective(G, text, target);
  };
  G.helpers.startMission = function startMissionHelper(index) {
    const i = typeof index === 'number' ? index : G.state.missionIndex || 0;
    if (i >= MISSIONS.length) return;
    startMission(G, i);
  };
}

export function updateMissions(G, dt) {
  if (!G.state.started || G.state.paused || G.state.gameOver) return;
  const m = G.missions && G.missions.current;
  if (!m) return;
  const rt = G.missions.rt || { phase: 1 };
  const pos = playerPos(G);
  const kills = G.state.kills || 0;

  switch (m.id) {
    case 'first-gear': {
      if (m.target && dist2D(pos, m.target) < ARRIVE_DIST) completeMission(G);
      break;
    }
    case 'pickup': {
      if (rt.phase === 1) {
        if ((G.state.carsStolen || 0) > 0) {
          rt.phase = 2;
          setObjective(G, 'Deliver the car to the Solmara Port', m.target);
          banner(G, 'Car Stolen', 'Now deliver it to the port.');
        }
      } else if (m.target && dist2D(pos, m.target) < ARRIVE_DIST) {
        completeMission(G);
      }
      break;
    }
    case 'hot-wheels': {
      if (rt.phase === 1) {
        if ((G.state.wanted || 0) >= 2) {
          rt.phase = 2;
          rt.seenHigh = true;
          setObjective(G, 'Now lose the heat — get back to 0 stars', m.target);
          banner(G, 'Heat Is On', 'Two stars. Now disappear.');
        }
      } else if ((G.state.wanted || 0) === 0) {
        completeMission(G);
      }
      break;
    }
    case 'exchange': {
      if (rt.phase === 1) {
        if (m.target && dist2D(pos, m.target) < ARRIVE_DIST) {
          rt.phase = 2;
          rt.killsAtStart = kills;
          G.state.missionEnemies = 3;
          setObjective(G, 'Ambush! Take out 3 Vultures (0/3)', null);
          banner(G, 'AMBUSH', 'The Vultures are here. Fight!');
        }
      } else {
        const done = kills - rt.killsAtStart;
        setObjective(G, 'Ambush! Take out 3 Vultures (' + Math.min(3, done) + '/3)', null);
        if (done >= 3) completeMission(G);
      }
      break;
    }
    case 'air-support': {
      if ((G.state.wanted || 0) >= 3) {
        rt.timer = (rt.timer || 0) + dt;
        const left = Math.max(0, Math.ceil(20 - rt.timer));
        setObjective(G, 'Survive at wanted level 3 — ' + left + 's left', null);
        if (rt.timer >= 20) completeMission(G);
      }
      break;
    }
    case 'roadblock-run': {
      const rbs = (G.police && G.police.roadblocks) || [];
      let count = (rt.passed || []).length;
      rbs.forEach(function (rb, i) {
        if ((rt.passed || []).indexOf(i) !== -1) return;
        const rp = roadblockPos(rb);
        if (rp && dist2D(pos, rp) < 12) {
          rt.passed.push(i);
          count = rt.passed.length;
          setObjective(G, 'Smash through 2 roadblocks (' + count + '/2)', null);
          banner(G, 'Roadblock Smashed', count + ' of 2 down.');
          if (G.helpers && typeof G.helpers.playSound === 'function') {
            G.helpers.playSound('explosion');
          }
        }
      });
      if (count >= 2) completeMission(G);
      break;
    }
    case 'heist': {
      if (rt.phase === 1) {
        if (m.target && dist2D(pos, m.target) < ARRIVE_DIST) {
          rt.phase = 2;
          rt.bankPos = { x: m.target.x, z: m.target.z };
          pay(G, 5000);
          setWantedSafe(G, Math.max(2, G.state.wanted || 0));
          setObjective(G, 'Escape! Get 40m from the bank with the cash', null);
          banner(G, 'BANK ROBBED', '+$5000. Run!');
        }
      } else if (rt.bankPos && dist2D(pos, rt.bankPos) > 40) {
        completeMission(G);
      }
      break;
    }
    case 'payback': {
      const done = kills - (rt.killsAtStart || 0);
      setObjective(
        G,
        'Take down Silas Rook and his crew at the port (' + Math.min(5, done) + '/5)',
        m.target
      );
      if (done >= 5) completeMission(G);
      break;
    }
    case 'clean-getaway': {
      if (rt.phase === 1) {
        if ((G.state.wanted || 0) >= 5) {
          rt.phase = 2;
          rt.seenHigh = true;
          setObjective(G, 'Five stars! Now lose them all', m.target);
          banner(G, 'FIVE STARS', 'The whole island is hunting you.');
        }
      } else if ((G.state.wanted || 0) === 0) {
        completeMission(G);
      }
      break;
    }
    default:
      break;
  }
}
