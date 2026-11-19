// Keyboard, pointer-lock and mouse input. Held keys feed the movement vector; discrete presses
// are queued as named actions so a tap between two simulation frames is never lost or doubled.

const HELD = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  KeyF: 'handbrake',
};

const ACTIONS = {
  Space: 'melee', KeyJ: 'melee', KeyE: 'enter', KeyQ: 'nextWeapon',
  Digit1: 'weapon1', Digit2: 'weapon2', Digit3: 'weapon3', Digit4: 'weapon4',
  KeyR: 'radio', KeyT: 'weather', KeyH: 'headlights', KeyM: 'mute',
  KeyP: 'pause', Escape: 'pause', Enter: 'confirm',
  F2: 'wanted', F3: 'teleport', F5: 'save',
};

const SENSITIVITY = 0.0024;

/** Attach input listeners and return the per-frame input surface. */
export function createInput(renderer) {
  const canvas = renderer.canvas ?? document.getElementById('game');
  const held = new Set();
  const presses = [];
  const clicks = [];
  const mouse = { x: 0, y: 0, left: false, right: false, fire: false };

  function queue(name) {
    if (!presses.includes(name)) presses.push(name);
  }

  window.addEventListener('keydown', (event) => {
    if (HELD[event.code]) held.add(HELD[event.code]);
    else if (ACTIONS[event.code]) queue(ACTIONS[event.code]);
    else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (HELD[event.code]) held.delete(HELD[event.code]);
  });
  window.addEventListener('blur', () => {
    held.clear();
    mouse.left = false;
    mouse.right = false;
    mouse.fire = false;
  });

  canvas.addEventListener('pointerdown', (event) => {
    mouse.x = event.clientX;
    mouse.y = event.clientY;
    if (event.button === 0) {
      mouse.left = true;
      mouse.fire = true;
      clicks.push(renderer.screenToLogical(event.clientX, event.clientY));
      queue('click');
      if (document.pointerLockElement !== canvas && typeof canvas.requestPointerLock === 'function') {
        try {
          const request = canvas.requestPointerLock();
          if (request?.catch) request.catch(() => {});
        } catch { /* pointer lock is optional */ }
      }
    } else if (event.button === 2) {
      mouse.right = true;
    }
    event.preventDefault();
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) { mouse.left = false; mouse.fire = false; }
    if (event.button === 2) mouse.right = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  window.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement !== canvas) return;
    const api = renderer.api;
    api.yaw += (event.movementX || 0) * SENSITIVITY;
    api.pitch = Math.max(-0.35, Math.min(0.75, api.pitch - (event.movementY || 0) * SENSITIVITY));
    mouse.x += event.movementX || 0;
    mouse.y += event.movementY || 0;
  });

  return {
    mouse,
    /** Raw steering (x), throttle (z) and held modifiers. */
    axis() {
      return {
        x: (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
        z: (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0),
        sprint: held.has('sprint'),
        handbrake: held.has('handbrake'),
        shoot: mouse.fire,
        melee: false,
        enter: false,
      };
    },
    /** Named one-shot actions since the last call. */
    presses() {
      const taken = presses.slice();
      presses.length = 0;
      return taken;
    },
    /** Logical 1280x720 click positions since the last call. */
    clicks() {
      const taken = clicks.slice();
      clicks.length = 0;
      return taken;
    },
    lock() {
      if (document.pointerLockElement !== canvas && typeof canvas.requestPointerLock === 'function') {
        try {
          const request = canvas.requestPointerLock();
          if (request?.catch) request.catch(() => {});
        } catch { /* optional */ }
      }
    },
    unlock() {
      if (document.pointerLockElement === canvas && typeof document.exitPointerLock === 'function') {
        try { document.exitPointerLock(); } catch { /* optional */ }
      }
    },
    clear() {
      held.clear();
      presses.length = 0;
      clicks.length = 0;
      mouse.left = false;
      mouse.right = false;
      mouse.fire = false;
    },
  };
}
