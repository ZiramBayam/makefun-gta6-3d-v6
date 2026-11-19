// Solar Noir DOM instrumentation. The canvas sells the city; this layer sells the information:
// a magazine-style title, a live dashboard, an original dialogue card and a vector minimap.

import { BUTTON_IDS, PALETTE, VIEW, MISSIONS } from './config.js';
import { WEAPONS } from './weapons.js';
import { STATIONS } from './radio.js';
import { UPGRADES, nextCost } from './upgrades.js';

const field = (name, value = '') => `<span data-field="${name}">${value}</span>`;
const button = (id, label, extra = '') =>
  `<button class="btn ${extra}" type="button" data-action="${id}" id="btn-${id}">${label}</button>`;

const CONTROLS = `
  <div class="controls-grid">
    <b>WASD</b><span>Walk, steer and accelerate</span>
    <b>SHIFT</b><span>Sprint / helicopter climb</span>
    <b>MOUSE</b><span>Look around</span>
    <b>LEFT CLICK</b><span>Fire the current weapon</span>
    <b>RIGHT CLICK</b><span>Aim down the sights</span>
    <b>E</b><span>Enter or leave a car or helicopter</span>
    <b>Q / 1-4</b><span>Cycle or select pistol, SMG, shotgun, rifle</span>
    <b>J / SPACE</b><span>Melee strike</span>
    <b>F</b><span>Handbrake / helicopter descend</span>
    <b>R</b><span>Cycle radio station</span>
    <b>T</b><span>Toggle sun haze and rain</span>
    <b>F2</b><span>Add three wanted stars</span>
    <b>F3</b><span>Move near the current job marker</span>
    <b>P / ESC</b><span>Pause</span>
    <b>M</b><span>Mute</span>
  </div>`;

/** Create the interface once and return a compact render API. */
export function createHud(root) {
  root.className = 'hud-root';
  root.innerHTML = `
    <div class="hud-play" data-screen="play">
      <div class="hud-corner hud-top-left">
        <div class="job-line">JOB <span data-field="job">1/8</span> <em data-field="objective">—</em></div>
        <div class="job-title" data-field="jobTitle">First Light</div>
        <div class="money-line">$<span data-field="money">120</span><small>TAKE HOME PAY</small></div>
        <div class="bars">
          <div class="bar-row"><span class="bar-label">HEALTH</span><span class="bar-track"><i class="bar-fill health" data-bar="health"></i></span></div>
          <div class="bar-row"><span class="bar-label">ARMOR</span><span class="bar-track"><i class="bar-fill armor" data-bar="armor"></i></span></div>
        </div>
      </div>

      <div class="hud-corner hud-top-right">
        <div class="stars" data-field="wanted">☆☆☆☆☆</div>
        <div class="radio-line" data-field="radio">SOLAR FM</div>
        <div class="save-line" data-field="save">AUTOSAVE READY</div>
      </div>

      <div class="hud-corner hud-bottom-left">
        <div class="weapon-line"><span data-field="weapon">PISTOL</span><span class="ammo" data-field="ammo">12</span><span class="reserve" data-field="reserve">/ 96</span></div>
        <div class="upgrade-line" data-field="upgrades">GARAGE: ENGINE 0 · ARMOR 0 · GUNS 0</div>
      </div>

      <div class="hud-corner hud-bottom-right">
        <canvas id="minimap" width="176" height="176" aria-label="City minimap"></canvas>
        <div class="map-caption">CIELO BAY · LIVE MAP</div>
      </div>

      <div class="compass"><span class="arrow">▲</span><span data-field="compass">N</span> · <span data-field="district">MARISOL ROWS</span></div>
      <div class="crosshair" data-role="crosshair"></div>
      <div class="toast" data-role="toast"></div>
      <div class="dialogue"><div class="speaker" data-field="speaker"></div><div class="words" data-field="words"></div><div class="enemy-health"><i data-bar="enemy"></i></div></div>
      <div class="hint" data-field="hint"></div>
      <div class="hud-corner" style="right:38px;top:246px;min-width:178px;text-align:right">
        <div class="speed-value"><span data-field="speed">0</span><span> KM/H</span></div>
        <div class="vehicle-line" data-field="vehicle">ON FOOT</div>
        <div class="damage-line" data-field="damage"></div>
      </div>
    </div>

    <div class="screen screen-title" data-screen="title">
      <div class="menu-panel">
        <div class="logo"><span class="first">CIELO</span><span class="second">BAY</span></div>
        <div class="rule"></div>
        <div class="tagline">SOLAR NOIR — EIGHT JOBS, ONE CITY, ONE LONG AFTERNOON.</div>
        <div class="menu-buttons">
          ${button('play', 'NEW GAME')}
          ${button('continue', 'CONTINUE SAVE', 'secondary')}
          ${button('controls', 'CONTROLS', 'secondary')}
        </div>
        <div class="footer-note">MADE OFFLINE FOR MAKE.FUN · ORIGINAL CITY, ORIGINAL STORY</div>
      </div>
    </div>

    <div class="screen screen-dim" data-screen="controls">
      <div class="menu-panel"><h1 class="menu-title">CONTROLS</h1><div class="menu-sub">THE WHOLE CITY IN YOUR HANDS</div>
        ${CONTROLS}${button('back', 'BACK', 'secondary')}
      </div>
    </div>

    <div class="screen screen-dim" data-screen="paused">
      <div class="menu-panel"><h1 class="menu-title">PAUSED</h1><div class="menu-sub">THE SUN CAN WAIT</div>
        <div class="menu-buttons">${button('resume', 'RESUME')}${button('save', 'SAVE GAME', 'secondary')}${button('mute', 'MUTE SOUND', 'secondary')}${button('controls', 'CONTROLS', 'secondary')}${button('restart', 'RESTART', 'secondary')}</div>
      </div>
    </div>

    <div class="screen screen-dim" data-screen="win">
      <div class="menu-panel"><h1 class="menu-title">CIELO BAY IS YOURS</h1>
        <div class="menu-sub">EIGHT JOBS COMPLETE · THE LIGHT HOLDS</div>
        <div class="stat-list">FINAL TAKE <b data-field="finalMoney">$0</b><br>FINAL WANTED <b data-field="finalWanted">0 STARS</b><br>STORY <b>ALL 8 JOBS CLEARED</b></div>
        <div class="menu-buttons">${button('restart', 'PLAY AGAIN')}${button('save', 'SAVE GAME', 'secondary')}</div>
      </div>
    </div>`;

  const nodes = new Map();
  for (const node of root.querySelectorAll('[data-field]')) nodes.set(node.dataset.field, node);
  const bars = new Map();
  for (const node of root.querySelectorAll('[data-bar]')) bars.set(node.dataset.bar, node);
  const screens = new Map();
  for (const node of root.querySelectorAll('[data-screen]')) screens.set(node.dataset.screen, node);
  const crosshair = root.querySelector('[data-role="crosshair"]');
  const toast = root.querySelector('[data-role="toast"]');
  const dialogue = root.querySelector('.dialogue');
  const map = root.querySelector('#minimap');
  const mapCtx = map.getContext('2d');

  const buttons = BUTTON_IDS.map((id) => ({ id, element: root.querySelector(`[data-action="${id}"]`) }));
  const money = (value) => Math.round(value).toLocaleString('en-US');
  const stars = (level) => '★'.repeat(level) + '☆'.repeat(5 - level);

  function set(fieldName, value) {
    const node = nodes.get(fieldName);
    if (node && node.textContent !== String(value)) node.textContent = String(value);
  }

  function setBar(name, fraction) {
    const node = bars.get(name);
    if (node) node.style.width = `${Math.max(0, Math.min(100, fraction * 100))}%`;
  }

  function drawMinimap(state, city, objective) {
    if (!mapCtx || !city) return;
    const size = map.width;
    const scale = size / (city.width + 80);
    const tx = (x) => size / 2 + x * scale;
    const tz = (z) => size / 2 + z * scale;
    mapCtx.clearRect(0, 0, size, size);
    mapCtx.fillStyle = 'rgba(7,26,36,.92)';
    mapCtx.fillRect(0, 0, size, size);

    mapCtx.fillStyle = 'rgba(92,224,198,.42)';
    mapCtx.fillRect(tx(city.harbor.x - city.harbor.w / 2), tz(city.harbor.z - city.harbor.d / 2),
      city.harbor.w * scale, city.harbor.d * scale);

    mapCtx.strokeStyle = 'rgba(232,221,196,.42)';
    mapCtx.lineWidth = 4;
    for (const road of city.roads) {
      if (road.w < 28 && road.d < 28) continue;
      mapCtx.beginPath();
      if (road.axis === 'z') { mapCtx.moveTo(tx(road.x), 0); mapCtx.lineTo(tx(road.x), size); }
      else { mapCtx.moveTo(0, tz(road.z)); mapCtx.lineTo(size, tz(road.z)); }
      mapCtx.stroke();
    }
    mapCtx.strokeStyle = 'rgba(232,221,196,.16)';
    mapCtx.lineWidth = 1;
    for (const block of city.blocks) {
      if (block.kind !== 'building') continue;
      mapCtx.fillStyle = block.district === 6 ? 'rgba(127,184,201,.48)' : 'rgba(201,111,74,.38)';
      mapCtx.fillRect(tx(block.x - block.w / 2), tz(block.z - block.d / 2), block.w * scale, block.d * scale);
    }

    const dot = (x, z, color, radius) => {
      mapCtx.beginPath();
      mapCtx.fillStyle = color;
      mapCtx.arc(tx(x), tz(z), radius, 0, Math.PI * 2);
      mapCtx.fill();
    };
    for (const car of state.cars) dot(car.x, car.z, 'rgba(246,239,220,.5)', 1.4);
    for (const unit of state.police) dot(unit.x, unit.z, unit.isHeli ? PALETTE.gold : PALETTE.glass, 2.3);
    for (const enemy of state.enemies) if (enemy.health > 0) dot(enemy.x, enemy.z, PALETTE.coral, 2.2);

    if (objective) {
      const x = tx(objective.x);
      const z = tz(objective.z);
      mapCtx.strokeStyle = PALETTE.gold;
      mapCtx.lineWidth = 1.5;
      mapCtx.beginPath(); mapCtx.arc(x, z, 7 + Math.sin(state.time * 4) * 1.5, 0, Math.PI * 2); mapCtx.stroke();
      mapCtx.beginPath(); mapCtx.moveTo(x - 4, z); mapCtx.lineTo(x + 4, z);
      mapCtx.moveTo(x, z - 4); mapCtx.lineTo(x, z + 4); mapCtx.stroke();
    }
    mapCtx.save();
    mapCtx.translate(tx(state.player.x), tz(state.player.z));
    mapCtx.rotate(-state.player.angle);
    mapCtx.fillStyle = PALETTE.paper;
    mapCtx.beginPath(); mapCtx.moveTo(0, -6); mapCtx.lineTo(4, 5); mapCtx.lineTo(-4, 5); mapCtx.closePath(); mapCtx.fill();
    mapCtx.restore();
  }

  let lastCity = null;
  function render(state, screen, extras = {}) {
    for (const [name, node] of screens) node.classList.toggle('visible', name === screen);
    const play = screens.get('play');
    play.classList.toggle('visible', screen === 'play' || screen === 'paused');
    if (screen === 'title') {
      const cont = buttons.find((b) => b.id === 'continue')?.element;
      if (cont) cont.style.display = extras.saveExists ? '' : 'none';
    }
    if (screen === 'win') {
      set('finalMoney', `$${money(state.money)}`);
      set('finalWanted', `${state.wanted} STARS`);
    }
    if (screen !== 'play' && screen !== 'paused') return;

    const mission = state.plan?.[Math.min(state.missionIndex, state.plan.length - 1)];
    const weapon = WEAPONS[state.weaponIndex] ?? WEAPONS[0];
    const radio = STATIONS[state.radioIndex] ?? STATIONS[0];
    set('job', `${Math.min(state.missionIndex + 1, 8)}/8`);
    set('objective', extras.objective?.label ?? state.objectiveLabel ?? mission?.title ?? '—');
    set('jobTitle', mission?.title ?? 'Sunset Verdict');
    set('money', money(state.money));
    set('wanted', stars(state.wanted));
    set('radio', radio.name.toUpperCase());
    set('save', state.saveIndicator > 0 ? '● SAVED JUST NOW' : 'AUTOSAVE READY');
    nodes.get('save').classList.toggle('flash', state.saveIndicator > 0);
    set('weapon', weapon.label);
    set('ammo', state.weaponAmmo[state.weaponIndex] ?? state.ammo);
    set('reserve', `/ ${state.reserveAmmo[state.weaponIndex] ?? 0}`);
    set('upgrades', `GARAGE: ${UPGRADES.map((item) =>
      `${item.label} ${state.upgrades[item.key]}${nextCost(item, state.upgrades[item.key]) ? '' : ' MAX'}`).join(' · ')}`);
    set('speed', state.player.speed ?? 0);
    set('vehicle', state.player.flying ? 'AIRBORNE' : state.player.onFoot ? 'ON FOOT'
      : (state.cars.find((car) => car.id === state.player.carId)?.kind ?? 'vehicle').toUpperCase());
    const car = state.cars.find((c) => c.id === state.player.carId);
    set('damage', car && car.health < car.maxHealth ? `DAMAGE ${Math.round(100 - car.health / car.maxHealth * 100)}%` : '');
    set('hint', state.hint ?? '');
    setBar('health', state.health / 100);
    setBar('armor', state.armor / 100);
    const enemy = state.enemies.find((e) => e.health > 0);
    setBar('enemy', enemy ? enemy.health / enemy.maxHealth : 0);
    dialogue.classList.toggle('visible', !!state.dialogue && screen === 'play');
    if (state.dialogue) {
      set('speaker', state.dialogue.speaker ?? '');
      set('words', state.dialogue.text ?? '');
    }
    toast.classList.toggle('visible', !!state.toast && screen === 'play');
    if (state.toast) toast.textContent = state.toast;
    crosshair.classList.toggle('aim', !!extras.mouse?.right);

    const bearing = (state.player.angle * 180 / Math.PI + 360) % 360;
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    set('compass', directions[Math.round(bearing / 45) % 8]);
    const districtIndex = Math.max(0, Math.min(7,
      Math.floor((state.player.x + 720) / 160 / 1.5) % 8));
    set('district', (extras.city?.districts ?? lastCity?.districts)?.[districtIndex]?.name
      ?? 'CIELO BAY');
    if (extras.city) lastCity = extras.city;
    drawMinimap(state, extras.city ?? lastCity, extras.objective);
  }

  return { render, buttons, root };
}
