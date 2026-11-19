// Boot sequence and fixed-step game loop. The renderer draws as often as the browser allows;
// the simulation only ever advances in exact 1/60 ticks, so a saved afternoon can be replayed.

import { SEED, STEP, MAX_FRAME, SAVE_KEY } from './config.js';
import { createRandom } from './random.js';
import { createCity } from './city.js';
import { createAssets } from './assets.js';
import { createWorld } from './world.js';
import { createGameRenderer } from './render.js';
import { stagePhotoMode } from './shots.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';

const THREE = globalThis.THREE;
const canvas = document.getElementById('game');
const hudRoot = document.getElementById('hud');
const status = document.getElementById('status');

const city = createCity(createRandom(SEED));
const assets = createAssets(THREE, createRandom(SEED + 11));
const world = createWorld(city, createRandom(SEED));
const state = world.state;
const renderer = createGameRenderer(canvas, city, assets);
const hud = createHud(hudRoot);
const input = createInput(renderer);
const audio = createAudio();

let screen = 'title';
let previousScreen = 'title';
let accumulator = 0;
let lastFrame = 0;
let staged = null;

function announce(text) {
  if (status) status.textContent = text;
}

function saveExists() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(world.snapshot()));
    state.saveIndicator = 1.8;
    state.toast = 'PROGRESS SAVED';
    state.toastTimer = 2;
    announce('Progress saved');
    audio.sfx('upgrade');
  } catch {
    state.toast = 'SAVE UNAVAILABLE IN THIS BROWSER';
    state.toastTimer = 2;
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    world.restore(JSON.parse(raw));
    announce('Saved game restored');
    return true;
  } catch {
    return false;
  }
}

function setScreen(next) {
  if (!['title', 'controls', 'play', 'paused', 'win'].includes(next)) return;
  previousScreen = screen === 'controls' ? previousScreen : screen;
  screen = next;
  accumulator = 0;
  if (next === 'play') input.lock();
  else input.unlock();
  if (next === 'play') audio.resume();
  hud.render(state, screen, viewExtras());
}

function viewExtras() {
  return {
    mouse: input.mouse,
    saveExists: saveExists(),
    muted: !audio.enabled,
    city,
    objective: staged ?? world.objective(),
  };
}

function startNew() {
  world.reset();
  staged = null;
  input.clear();
  audio.resume();
  setScreen('play');
  announce('New game started');
}

function continueGame() {
  if (!loadGame()) { startNew(); return; }
  staged = null;
  input.clear();
  audio.resume();
  setScreen('play');
}

function movement(dt) {
  const raw = input.axis();
  const p = state.player;
  if (p.flying) {
    return { x: raw.x, z: raw.z, sprint: raw.sprint, handbrake: raw.handbrake };
  }
  if (!p.onFoot) {
    return { x: raw.x, z: raw.z, sprint: raw.sprint, handbrake: raw.handbrake };
  }
  const yaw = renderer.api.yaw;
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  return {
    x: rightX * raw.x + forwardX * raw.z,
    z: rightZ * raw.x + forwardZ * raw.z,
    sprint: raw.sprint,
    handbrake: raw.handbrake,
  };
}

function handlePresses() {
  for (const action of input.presses()) {
    switch (action) {
      case 'confirm':
        if (screen === 'title' || screen === 'win') startNew();
        else if (screen === 'paused') setScreen('play');
        break;
      case 'pause':
        if (screen === 'play') setScreen('paused');
        else if (screen === 'paused') setScreen('play');
        else if (screen === 'controls') setScreen(previousScreen);
        break;
      case 'click':
        if (screen === 'title' || screen === 'win') startNew();
        break;
      case 'enter': if (screen === 'play') world.tryEnter(); break;
      case 'melee': if (screen === 'play') world.melee(); break;
      case 'nextWeapon': if (screen === 'play') world.cycleWeapon(); break;
      case 'weapon1': case 'weapon2': case 'weapon3': case 'weapon4':
        if (screen === 'play') world.selectWeapon(Number(action.slice(-1)) - 1);
        break;
      case 'radio': if (screen === 'play') { world.cycleRadio(); audio.sfx('radio'); } break;
      case 'weather':
        if (screen === 'play') {
          state.rain = !state.rain;
          state.toast = state.rain ? 'SUN HAZE — RAIN ON' : 'CLEAR AFTERNOON';
          state.toastTimer = 2;
        }
        break;
      case 'headlights':
        if (screen === 'play') {
          const car = state.cars.find((c) => c.id === state.player.carId);
          if (car) car.headlights = !car.headlights;
          state.toast = `HEADLIGHTS ${car && car.headlights ? 'ON' : 'OFF'}`;
          state.toastTimer = 1.6;
        }
        break;
      case 'wanted': if (screen === 'play') world.addWanted(3, 'siren test'); break;
      case 'teleport':
        if (screen === 'play') { world.teleportNearObjective(); audio.sfx('radio'); }
        break;
      case 'save': if (screen === 'play' || screen === 'paused' || screen === 'win') saveGame(); break;
      case 'mute':
        audio.setEnabled(!audio.enabled);
        state.toast = audio.enabled ? 'SOUND ON' : 'SOUND MUTED';
        state.toastTimer = 1.6;
        break;
      default: break;
    }
  }
}

function drainEvents() {
  for (const event of state.events) {
    audio.sfx(event.type);
    if (event.type === 'win') setScreen('win');
  }
  state.events.length = 0;
}

function stepSimulation() {
  const move = movement(STEP);
  world.step(STEP, move);
  if (screen === 'play' && input.mouse.fire && state.weaponAmmo[state.weaponIndex] > 0) {
    if (state.player.onFoot && !state.player.flying) {
      state.player.angle = renderer.api.yaw + Math.PI;
    }
    world.fire();
  }
}

function frame(timestamp) {
  const seconds = lastFrame ? Math.min(MAX_FRAME, (timestamp - lastFrame) / 1000) : 0;
  lastFrame = timestamp;
  accumulator += seconds;

  handlePresses();
  while (accumulator >= STEP && screen === 'play') {
    stepSimulation();
    accumulator -= STEP;
  }
  if (screen !== 'play') accumulator = 0;
  drainEvents();
  audio.update(seconds, { state, screen });

  if (screen === 'play' && state.won) setScreen('win');
  staged = staged && screen === 'play' ? null : staged;
  globalThis.CBObjective = staged ?? world.objective();
  renderer.draw(state, screen, viewExtras());
  hud.render(state, screen, viewExtras());
  requestAnimationFrame(frame);
}

hud.root.addEventListener('click', (event) => {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  event.preventDefault();
  switch (target.dataset.action) {
    case 'play': startNew(); break;
    case 'continue': continueGame(); break;
    case 'controls': setScreen('controls'); break;
    case 'back': setScreen(previousScreen === 'controls' ? 'title' : previousScreen); break;
    case 'resume': setScreen('play'); break;
    case 'save': saveGame(); break;
    case 'mute':
      audio.setEnabled(!audio.enabled);
      for (const button of hud.buttons) {
        if (button.id === 'mute' && button.element) {
          button.element.textContent = audio.enabled ? 'MUTE SOUND' : 'UNMUTE SOUND';
        }
      }
      break;
    case 'restart': startNew(); break;
    default: break;
  }
});

window.addEventListener('resize', () => renderer.resize());
window.addEventListener('keydown', (event) => {
  if (event.code === 'Enter' && (screen === 'title' || screen === 'win')) {
    event.preventDefault();
    startNew();
  }
}, { capture: true });

window.CB = {
  world, city, state, renderer, input, audio, hud,
  get screen() { return screen; },
  setScreen,
  startNew,
  continueGame,
  saveGame,
  loadGame,
  stage(name) {
    if (screen !== 'play') setScreen('play');
    staged = stagePhotoMode(world, name);
    return staged;
  },
};

renderer.resize();
hud.render(state, screen, viewExtras());
requestAnimationFrame(frame);
announce('Cielo Bay: Solar Noir ready');
