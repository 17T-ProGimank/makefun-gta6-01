// Keyboard input: one shared Set of pressed KeyboardEvent.code values on
// G.input.keys. Every other module reads keys through isDown(); nothing here
// moves the player or a car — updateInput is intentionally a no-op.

export function initInput(G) {
  const down = (e) => {
    if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
    G.input.keys.add(e.code);
  };
  const up = (e) => {
    G.input.keys.delete(e.code);
  };
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  // A lost window focus must never leave a key "stuck" down.
  window.addEventListener('blur', () => G.input.keys.clear());
  // Track horizontal mouse movement so the camera module can add a
  // slight look offset while driving; reset every frame by updateInput.
  window.addEventListener('mousemove', (e) => { G.input.mouseDX = e.movementX || 0; });
}

export function updateInput(G, dt) {
  // Keys live on G.input.keys; nothing to step per frame.
  // Decay the mouse delta so a single flick does not spin the camera.
  G.input.mouseDX *= 0.85;
  if (Math.abs(G.input.mouseDX) < 0.01) G.input.mouseDX = 0;
}

export function isDown(G, code) {
  return G.input.keys.has(code);
}
