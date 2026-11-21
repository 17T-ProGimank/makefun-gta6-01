// gta6-01 — audio.js (session D)
// Procedural WebAudio only: NO audio files, NO network.
// Contract: initAudio(G), updateAudio(G, dt).
// Helpers attached here: G.helpers.playSound, G.helpers.resumeAudio.
// AudioContext is created ONLY after the first user gesture (pointerdown /
// keydown) or when initAudio is called from a gesture (START button).
// Engine hum, two-tone siren, synth SFX, and 3 procedural radio stations.

const STATIONS = [
  {
    name: 'SOL FM',
    bpm: 100,
    wave: 'sine',
    lead: [440, 0, 523.25, 0, 659.25, 0, 523.25, 0, 587.33, 0, 659.25, 0, 783.99, 659.25, 523.25, 0],
    bass: [110, 0, 0, 0, 130.81, 0, 0, 0, 98, 0, 0, 0, 146.83, 0, 130.81, 0],
  },
  {
    name: 'EMBER ROCK',
    bpm: 140,
    wave: 'square',
    lead: [220, 220, 0, 261.63, 329.63, 0, 261.63, 0, 196, 196, 0, 246.94, 293.66, 329.63, 392, 0],
    bass: [55, 0, 55, 0, 65.41, 0, 65.41, 0, 49, 0, 49, 0, 73.42, 0, 82.41, 0],
  },
  {
    name: 'BAY BASS',
    bpm: 120,
    wave: 'sawtooth',
    lead: [0, 349.23, 0, 415.3, 0, 349.23, 0, 293.66, 0, 329.63, 0, 392, 0, 415.3, 0, 0],
    bass: [82.41, 82.41, 0, 82.41, 98, 98, 0, 98, 87.31, 87.31, 0, 87.31, 110, 110, 0, 110],
  },
];

function ensureAudio(G) {
  const a = G.audio || (G.audio = {});
  if (a.ctx) return a.ctx;
  if (typeof window === 'undefined' || !window.AudioContext) return null;
  try {
    const ctx = new window.AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    a.ctx = ctx;
    a.master = master;
    a.noiseBuf = makeNoiseBuffer(ctx);
    startEngine(G);
    startSiren(G);
    return ctx;
  } catch (err) {
    return null;
  }
}

function makeNoiseBuffer(ctx) {
  const len = ctx.sampleRate * 1;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function startEngine(G) {
  const a = G.audio;
  if (!a.ctx || a.engine) return;
  const osc = a.ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 55;
  const filter = a.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 320;
  const gain = a.ctx.createGain();
  gain.gain.value = 0;
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(a.master);
  osc.start();
  a.engine = { osc, gain, filter };
}

function startSiren(G) {
  const a = G.audio;
  if (!a.ctx || a.siren) return;
  const osc = a.ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = 700;
  const gain = a.ctx.createGain();
  gain.gain.value = 0;
  osc.connect(gain);
  gain.connect(a.master);
  osc.start();
  a.siren = { osc, gain, high: false, timer: 0 };
}

function tone(G, freq, dur, type, vol, delay, slideTo) {
  const a = G.audio;
  if (!a.ctx || !a.master) return;
  const t0 = a.ctx.currentTime + (delay || 0);
  const osc = a.ctx.createOscillator();
  osc.type = type || 'sine';
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  const gain = a.ctx.createGain();
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(vol || 0.2, t0 + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain);
  gain.connect(a.master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

function noiseHit(G, dur, filterFreq, vol, type) {
  const a = G.audio;
  if (!a.ctx || !a.master || !a.noiseBuf) return;
  const t0 = a.ctx.currentTime;
  const src = a.ctx.createBufferSource();
  src.buffer = a.noiseBuf;
  src.loop = true;
  const filter = a.ctx.createBiquadFilter();
  filter.type = type || 'lowpass';
  filter.frequency.setValueAtTime(filterFreq || 800, t0);
  filter.frequency.exponentialRampToValueAtTime(60, t0 + dur);
  const gain = a.ctx.createGain();
  gain.gain.setValueAtTime(vol || 0.4, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(a.master);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

function playSound(G, name) {
  const a = G.audio;
  if (!a || !a.ctx || a.ctx.state === 'suspended') return;
  switch (name) {
    case 'shot':
      noiseHit(G, 0.1, 3000, 0.35, 'highpass');
      tone(G, 180, 0.08, 'square', 0.15, 0, 60);
      break;
    case 'explosion':
      noiseHit(G, 0.6, 900, 0.6, 'lowpass');
      tone(G, 120, 0.5, 'sine', 0.4, 0, 35);
      break;
    case 'cash':
      tone(G, 880, 0.12, 'sine', 0.25);
      tone(G, 1318.5, 0.25, 'sine', 0.25, 0.1);
      break;
    case 'pickup':
      tone(G, 660, 0.1, 'sine', 0.2);
      tone(G, 990, 0.15, 'sine', 0.2, 0.07);
      break;
    case 'click':
      tone(G, 1200, 0.05, 'square', 0.12);
      break;
    case 'mission':
      tone(G, 523.25, 0.15, 'triangle', 0.3);
      tone(G, 659.25, 0.15, 'triangle', 0.3, 0.14);
      tone(G, 783.99, 0.35, 'triangle', 0.3, 0.28);
      break;
    case 'siren':
      tone(G, 950, 0.2, 'square', 0.08);
      break;
    case 'engine':
      break;
    default:
      break;
  }
}

function cycleRadio(G) {
  const a = G.audio;
  if (!a.radioOn) {
    a.radioOn = true;
    a.station = 0;
  } else {
    a.station += 1;
    if (a.station >= STATIONS.length) {
      a.radioOn = false;
      a.station = 0;
    }
  }
  a.step = 0;
  a.stepTimer = 0;
  const label = a.radioOn ? STATIONS[a.station].name : 'RADIO OFF';
  if (G.helpers && typeof G.helpers.showBanner === 'function') {
    G.helpers.showBanner(label, a.radioOn ? 'Press R to change station' : 'Press R for radio');
  }
}

function scheduleRadioStep(G) {
  const a = G.audio;
  if (!a.ctx || !a.master) return;
  const st = STATIONS[a.station];
  const idx = (a.step || 0) % 16;
  const stepDur = 60 / st.bpm / 2;
  const lead = st.lead[idx];
  const bass = st.bass[idx];
  if (lead) tone(G, lead, stepDur * 0.9, st.wave, 0.11);
  if (bass) tone(G, bass, stepDur * 0.95, 'triangle', 0.16);
  // Station flavour: EMBER ROCK gets a hi-hat tick on off-beats, SOL FM
  // gets a soft octave-up echo on its lead notes so the stations feel distinct.
  if (st.name === 'EMBER ROCK' && idx % 2 === 1) {
    noiseHit(G, 0.03, 6000, 0.05, 'highpass');
  } else if (st.name === 'SOL FM' && lead) {
    tone(G, lead * 2, stepDur * 0.5, 'sine', 0.04, stepDur * 0.5);
  }
  a.step = (a.step || 0) + 1;
}

export function initAudio(G) {
  G.audio = G.audio || {};
  const a = G.audio;
  if (typeof a.radioOn !== 'boolean') a.radioOn = false;
  if (typeof a.station !== 'number') a.station = 0;
  a.step = 0;
  a.stepTimer = 0;
  a._rPrev = false;
  a._gestureSeen = a._gestureSeen || false;

  if (!G.helpers) G.helpers = {};
  G.helpers.playSound = function playSoundHelper(name) {
    playSound(G, name);
  };
  G.helpers.resumeAudio = function resumeAudioHelper() {
    const ctx = ensureAudio(G);
    if (ctx && ctx.state === 'suspended') ctx.resume();
    return !!ctx;
  };

  if (a._wired) return;
  a._wired = true;
  const onGesture = function onGesture() {
    a._gestureSeen = true;
    const ctx = ensureAudio(G);
    if (ctx && ctx.state === 'suspended') ctx.resume();
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('pointerdown', onGesture, { once: false });
    window.addEventListener('keydown', onGesture, { once: false });
  }
  // If a gesture already happened (e.g. START click reaches us after the
  // pointerdown), build the context right away so sound works immediately.
  if (a._gestureSeen) {
    const ctx = ensureAudio(G);
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
}

export function updateAudio(G, dt) {
  const a = G.audio;
  if (!a) return;

  // R cycles radio stations (edge-triggered, polled from input state).
  const rDown = !!(G.input && G.input.keys && G.input.keys.has('KeyR'));
  if (rDown && !a._rPrev) cycleRadio(G);
  a._rPrev = rDown;

  const ctx = a.ctx;
  if (!ctx || ctx.state !== 'running') return;

  // Engine hum follows driving speed.
  if (a.engine) {
    const speed = G.state.speed || 0;
    const driving = !!G.state.inVehicle;
    const targetFreq = 50 + speed * 2.2;
    const targetGain = driving ? 0.04 + Math.min(0.08, speed * 0.0015) : 0;
    a.engine.osc.frequency.setTargetAtTime(targetFreq, ctx.currentTime, 0.08);
    a.engine.gain.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.1);
  }

  // Two-tone siren while wanted.
  if (a.siren) {
    const wanted = G.state.wanted || 0;
    if (wanted > 0) {
      a.siren.timer += dt;
      if (a.siren.timer >= 0.45) {
        a.siren.timer = 0;
        a.siren.high = !a.siren.high;
        a.siren.osc.frequency.setValueAtTime(a.siren.high ? 950 : 700, ctx.currentTime);
      }
      a.siren.gain.gain.setTargetAtTime(0.025, ctx.currentTime, 0.1);
    } else {
      a.siren.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
    }
  }

  // Procedural radio scheduler.
  if (a.radioOn) {
    const st = STATIONS[a.station];
    const stepDur = 60 / st.bpm / 2;
    a.stepTimer = (a.stepTimer || 0) + dt;
    while (a.stepTimer >= stepDur) {
      a.stepTimer -= stepDur;
      scheduleRadioStep(G);
    }
  }
}
