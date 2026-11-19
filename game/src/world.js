// Pure, deterministic 2D simulation on the XZ plane. No Three.js, DOM, clock or network lives
// here: the renderer reads this state, and the same seed always replays the same afternoon.

import { SEED, CITY, OBJECTIVE_RADIUS } from './config.js';
import { createRandom } from './random.js';
import { createMissionPlan } from './missions.js';
import { WEAPONS, nextWeapon, capacityFor } from './weapons.js';
import { STATIONS } from './radio.js';
import { UPGRADES, purchase } from './upgrades.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const distance = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);

/** Build the initial state, including traffic, pedestrians and the parked helicopter. */
function buildState(city, random) {
  const plan = createMissionPlan();
  const limit = city.width / 2 - 40;
  const mainVertical = city.roads.filter((r) => r.axis === 'z' && r.w >= 28);
  const mainHorizontal = city.roads.filter((r) => r.axis === 'x' && r.d >= 28);
  const buildings = city.blocks.filter((b) => b.kind === 'building');
  const cars = [];

  for (let i = 0; i < 24; i += 1) {
    let x;
    let z;
    let angle;
    if (i % 2 === 0) {
      const road = mainVertical[i % mainVertical.length];
      const side = random.chance(0.5) ? 7 : -7;
      x = road.x + side;
      z = random.range(-limit, limit);
      angle = side > 0 ? Math.PI : 0;
    } else {
      const road = mainHorizontal[i % mainHorizontal.length];
      const side = random.chance(0.5) ? 7 : -7;
      x = random.range(-limit, limit);
      z = road.z + side;
      angle = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    const kind = random.pick(['sedan', 'sedan', 'taxi', 'van', 'sedan']);
    cars.push({
      id: `car-${i + 1}`, x, z, angle,
      speed: random.range(7, 12), kind,
      health: 100, maxHealth: 100, player: false,
      damageTint: 0, headlights: random.chance(0.3),
    });
  }

  const peds = [];
  for (let i = 0; i < 20; i += 1) {
    const home = buildings[random.int(0, buildings.length - 1)];
    peds.push({
      id: `ped-${i + 1}`,
      x: home.x + home.w / 2 + random.range(4, 9),
      z: home.z + random.range(-home.d / 2, home.d / 2),
      angle: random.range(0, Math.PI * 2),
      kind: random.chance(0.18) ? 'runner' : 'civilian',
      health: 30, state: 'walk', turnTimer: random.range(0.5, 3),
    });
  }

  const helicopter = {
    id: 'player-heli', x: city.objectiveSpots.garage.x + 34, z: city.objectiveSpots.garage.z - 30,
    altitude: 0, angle: Math.PI / 2, active: false, player: false, health: 100, isHeli: true,
  };

  return {
    player: {
      x: city.spawn.x, z: city.spawn.z, angle: Math.PI / 2,
      onFoot: true, carId: null, health: 100, armor: 35, ammo: WEAPONS[0].magazine,
      speed: 0, flying: false, vehicleKind: null,
    },
    cars, peds, enemies: [], police: [], effects: [], pickups: [], roadblocks: [],
    missionIndex: 0, stage: 0, money: 120, wanted: 0,
    health: 100, armor: 35, ammo: WEAPONS[0].magazine,
    time: 0, won: false, rain: false,
    events: [], dialogue: null, toast: '', hint: '', objectiveLabel: '',
    weaponIndex: 0, owned: [true, false, false, false],
    weaponAmmo: WEAPONS.map((w) => w.magazine),
    reserveAmmo: WEAPONS.map((w) => w.reserve),
    cooldown: 0, radioIndex: 0,
    upgrades: { engine: 0, armor: 0, capacity: 0 },
    saveIndicator: 0, toastTimer: 0, dialogueTimer: 0,
    helicopter,
    runner: { id: 'runner', x: city.objectiveSpots.runner.x, z: city.objectiveSpots.runner.z, angle: 0, active: false, health: 40 },
    policeSpawnTimer: 0,
    plan,
  };
}

/** Circle-versus-AABB resolution that slides the player along solid building walls. */
function collide(x, z, radius, city) {
  let px = x;
  let pz = z;
  const harbor = city.harbor;
  const water = (cx, cz) => (
    cx > harbor.x - harbor.w / 2 && cx < harbor.x + harbor.w / 2 &&
    cz > harbor.z - harbor.d / 2 && cz < harbor.z + harbor.d / 2 &&
    !city.blocks.some((b) => b.kind === 'pier' && Math.abs(cx - b.x) < b.w / 2 && Math.abs(cz - b.z) < b.d / 2)
  );
  if (water(px, pz)) return { x, z, hit: true };

  for (let pass = 0; pass < 2; pass += 1) {
    for (const block of city.blocks) {
      if (block.kind !== 'building') continue;
      const minX = block.x - block.w / 2;
      const maxX = block.x + block.w / 2;
      const minZ = block.z - block.d / 2;
      const maxZ = block.z + block.d / 2;
      const nx = clamp(px, minX, maxX);
      const nz = clamp(pz, minZ, maxZ);
      let dx = px - nx;
      let dz = pz - nz;
      let d = Math.hypot(dx, dz);
      if (d >= radius) continue;
      if (d < 0.0001) {
        const left = px - minX;
        const right = maxX - px;
        const near = pz - minZ;
        const far = maxZ - pz;
        const smallest = Math.min(left, right, near, far);
        if (smallest === left) px = minX - radius;
        else if (smallest === right) px = maxX + radius;
        else if (smallest === near) pz = minZ - radius;
        else pz = maxZ + radius;
      } else {
        px = nx + (dx / d) * radius;
        pz = nz + (dz / d) * radius;
      }
      dx = px - x;
      dz = pz - z;
      d = Math.hypot(dx, dz);
      if (d > 0.001) { void d; }
    }
  }
  const limit = city.width / 2 - 8;
  return { x: clamp(px, -limit, limit), z: clamp(pz, -limit, limit), hit: px !== x || pz !== z };
}

/** Create the world controller and its mutable state. */
export function createWorld(city, random) {
  const state = buildState(city, random);
  const plan = state.plan;
  let nextEffectId = 1;

  function event(type, extra = {}) {
    state.events.push({ type, time: state.time, ...extra });
    if (state.events.length > 240) state.events.splice(0, state.events.length - 240);
  }

  function toast(text, seconds = 2.6) {
    state.toast = text;
    state.toastTimer = seconds;
  }

  function say(dialogue, seconds = 5.5) {
    state.dialogue = dialogue ? { ...dialogue } : null;
    state.dialogueTimer = seconds;
  }

  function stage() {
    const mission = plan[state.missionIndex];
    return mission ? mission.stages[state.stage] : null;
  }

  function spotFor(key) {
    return city.objectiveSpots[key] ?? city.missionSpots[key] ?? city.objectiveSpots.deliver;
  }

  function liveEnemies() {
    return state.enemies.filter((enemy) => enemy.health > 0 && enemy.state !== 'down');
  }

  /** The gold marker's current world position and label. */
  function objective() {
    const current = stage();
    if (!current || state.won) return null;
    let spot = spotFor(current.spot);
    if (current.kind === 'chase' && state.runner.active) spot = state.runner;
    const guards = liveEnemies();
    if (current.kind === 'fight' && guards.length) spot = guards[0];
    return { x: spot.x, z: spot.z, label: current.label };
  }

  function spawnEnemies(count, x, z) {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + random.range(-0.3, 0.3);
      const radius = 16 + (i % 2) * 8;
      const placement = collide(x + Math.cos(angle) * radius, z + Math.sin(angle) * radius, 1.6, city);
      state.enemies.push({
        id: `gangster-${state.missionIndex}-${state.stage}-${i}`,
        x: placement.x, z: placement.z, angle: angle + Math.PI,
        health: 42, maxHealth: 42, kind: 'gangster', state: 'idle',
        attackTimer: random.range(0.4, 1.6), hitFlash: 0, money: random.int(45, 110),
      });
    }
    event('spawn', { count });
  }

  function beginMission(index) {
    state.missionIndex = index;
    state.stage = 0;
    state.enemies.length = 0;
    state.runner.active = false;
    const mission = plan[index];
    if (!mission) return;
    const first = mission.stages[0];
    say(first.dialogue);
    if (first.kind === 'fight') {
      const spot = spotFor(first.spot);
      spawnEnemies(first.enemies, spot.x, spot.z);
    }
    if (first.kind === 'chase') {
      state.runner.x = spotFor('runner').x;
      state.runner.z = spotFor('runner').z;
      state.runner.active = true;
    }
    if (index === 1) {
      const vanSpot = spotFor('van');
      spawnEnemies(2, vanSpot.x, vanSpot.z);
      state.cars.push({
        id: 'mission-van', x: vanSpot.x - 12, z: vanSpot.z - 12,
        angle: Math.PI / 4, speed: 0, kind: 'van', health: 120, maxHealth: 120,
        player: false, damageTint: 0, headlights: false,
      });
    }
    toast(`JOB ${index + 1}/8 — ${mission.title}`, 3.4);
    event('missionStart', { index, title: mission.title });
  }

  function advanceStage() {
    const mission = plan[state.missionIndex];
    if (!mission) return;
    state.stage += 1;
    if (state.stage >= mission.stages.length) {
      state.money += mission.reward;
      state.wanted = Math.max(0, state.wanted - 1);
      toast(`PAID $${mission.reward} — ${mission.title}`, 3.4);
      event('missionComplete', { index: state.missionIndex, reward: mission.reward });
      state.missionIndex += 1;
      state.stage = 0;
      if (state.missionIndex >= plan.length) {
        state.won = true;
        state.missionIndex = plan.length - 1;
        state.stage = plan[plan.length - 1].stages.length;
        say({ speaker: 'Cielo Bay', text: 'Eight jobs, one city, and the sun still has not set.' }, 10);
        event('win');
        return;
      }
      beginMission(state.missionIndex);
      return;
    }
    const current = stage();
    say(current.dialogue);
    toast(current.label, 2.4);
    event('stage', { index: state.missionIndex, stage: state.stage });
    if (current.kind === 'fight' && liveEnemies().length === 0) {
      const spot = spotFor(current.spot);
      spawnEnemies(current.enemies, spot.x, spot.z);
    }
    if (current.kind === 'chase') state.runner.active = true;
  }

  function checkObjective() {
    const current = objective();
    if (!current || state.won) return;
    state.objectiveLabel = current.label;
    const p = state.player;
    if (distance(p.x, p.z, current.x, current.z) > OBJECTIVE_RADIUS) return;
    if (stage()?.kind === 'fight' && liveEnemies().length) return;
    if (stage()?.kind === 'chase' && state.runner.active) state.runner.active = false;
    advanceStage();
  }

  function hurtPlayer(amount, reason) {
    const reduction = Math.min(0.55, state.upgrades.armor * 0.14);
    let damage = amount * (1 - reduction);
    if (state.armor > 0) {
      const absorbed = Math.min(state.armor, damage * 0.6);
      state.armor -= absorbed;
      damage -= absorbed;
    }
    state.health = Math.max(0, state.health - damage);
    state.player.health = state.health;
    state.player.armor = state.armor;
    if (damage > 1) event('hurt', { amount: damage, reason });
    if (state.health <= 0) {
      state.health = 100;
      state.armor = 30;
      state.player.health = 100;
      state.player.onFoot = true;
      state.player.carId = null;
      state.player.flying = false;
      state.player.x = city.spawn.x;
      state.player.z = city.spawn.z;
      state.wanted = Math.max(0, state.wanted - 2);
      toast('RECOVERED AT THE HOSPITAL', 3);
      event('busted');
    }
  }

  function explode(x, z, reason) {
    state.effects.push({ id: nextEffectId++, type: 'explosion', x, z, life: 1.7, maxLife: 1.7, reason });
    event('explosion', { x, z, reason });
  }

  function updatePlayer(dt, input) {
    const p = state.player;
    if (p.flying) {
      const heli = state.helicopter;
      heli.angle += (input.x || 0) * 1.5 * dt;
      const thrust = input.z || 0;
      heli.x = clamp(heli.x + Math.sin(heli.angle) * thrust * 26 * dt, -city.width / 2, city.width / 2);
      heli.z = clamp(heli.z + Math.cos(heli.angle) * thrust * 26 * dt, -city.depth / 2, city.depth / 2);
      heli.altitude = clamp(heli.altitude + ((input.sprint ? 1 : 0) - (input.handbrake ? 1 : 0)) * 14 * dt, 0, 95);
      p.x = heli.x; p.z = heli.z; p.angle = heli.angle;
      p.speed = Math.round(Math.abs(thrust) * 26);
      return;
    }

    const car = p.carId ? state.cars.find((c) => c.id === p.carId) : null;
    if (!p.onFoot && car) {
      const throttle = input.z || 0;
      const steer = input.x || 0;
      const topSpeed = (car.kind === 'van' ? 25 : 34) * (1 + state.upgrades.engine * 0.18);
      if (throttle > 0) car.speed += 17 * throttle * dt;
      else if (throttle < 0) car.speed -= 26 * dt;
      else car.speed *= Math.pow(0.4, dt);
      if (input.handbrake) car.speed *= Math.pow(0.12, dt);
      car.speed = clamp(car.speed, -8, topSpeed);
      car.angle += steer * (input.handbrake ? 2.1 : 1.35) * (car.speed / Math.max(8, topSpeed)) * dt * (car.speed >= 0 ? 1 : -1);
      const nextX = car.x + Math.sin(car.angle) * car.speed * dt;
      const nextZ = car.z + Math.cos(car.angle) * car.speed * dt;
      const resolved = collide(nextX, nextZ, 2.9, city);
      if (resolved.hit && Math.abs(car.speed) > 7) {
        car.health -= Math.abs(car.speed) * 0.65;
        hurtPlayer(Math.abs(car.speed) * 0.13, 'crash');
        event('crash', { x: car.x, z: car.z });
        car.speed *= -0.22;
      }
      car.x = resolved.x; car.z = resolved.z;
      car.damageTint = clamp(1 - car.health / car.maxHealth, 0, 1);
      p.x = car.x; p.z = car.z; p.angle = car.angle; p.speed = Math.round(car.speed * 3.2);
      if (car.health <= 0 && !p.flying) {
        explode(car.x, car.z, 'car');
        state.cars = state.cars.filter((c) => c.id !== car.id);
        p.onFoot = true; p.carId = null; p.speed = 0;
        hurtPlayer(12, 'explosion');
      }
      return;
    }

    let dx = input.x || 0;
    let dz = input.z || 0;
    const length = Math.hypot(dx, dz);
    if (length > 0.001) {
      dx /= length; dz /= length;
      p.angle = Math.atan2(dx, dz);
      const speed = input.sprint ? 13 : 7.4;
      const resolved = collide(p.x + dx * speed * dt, p.z + dz * speed * dt, 1.1, city);
      p.x = resolved.x; p.z = resolved.z;
      p.speed = Math.round(speed);
    } else {
      p.speed = 0;
    }
  }

  function updateTraffic(dt) {
    const p = state.player;
    for (const car of state.cars) {
      if (car.player) continue;
      if (car.speed === 0) continue;
      const nextX = car.x + Math.sin(car.angle) * car.speed * dt;
      const nextZ = car.z + Math.cos(car.angle) * car.speed * dt;
      const limit = city.width / 2 + 25;
      car.x = nextX > limit ? -limit : nextX < -limit ? limit : nextX;
      car.z = nextZ > limit ? -limit : nextZ < -limit ? limit : nextZ;
      if (distance(car.x, car.z, p.x, p.z) < 4 && p.onFoot && car.speed > 6) hurtPlayer(4, 'traffic');
    }
  }

  function updatePeds(dt) {
    for (const ped of state.peds) {
      ped.turnTimer -= dt;
      if (ped.turnTimer <= 0) {
        ped.angle = random.range(0, Math.PI * 2);
        ped.turnTimer = random.range(1.5, 6);
      }
      const speed = ped.kind === 'runner' ? 4.6 : 1.7;
      const resolved = collide(
        ped.x + Math.sin(ped.angle) * speed * dt,
        ped.z + Math.cos(ped.angle) * speed * dt,
        0.8, city,
      );
      ped.x = resolved.x; ped.z = resolved.z;
    }
    const runner = state.runner;
    if (runner.active) {
      const p = state.player;
      const away = Math.atan2(runner.x - p.x, runner.z - p.z);
      runner.angle = away;
      const resolved = collide(
        runner.x + Math.sin(away) * 8.5 * dt,
        runner.z + Math.cos(away) * 8.5 * dt,
        1, city,
      );
      runner.x = resolved.x; runner.z = resolved.z;
      if (distance(runner.x, runner.z, p.x, p.z) < OBJECTIVE_RADIUS) {
        runner.active = false;
        toast('RUNNER CAUGHT', 2);
        event('runnerCaught');
      }
    }
  }

  function spawnPolice(count, reason) {
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2 + random.range(-0.25, 0.25);
      const radius = 44 + i * 9;
      const p = state.player;
      state.police.push({
        id: `police-${state.time.toFixed(2)}-${i}`,
        x: clamp(p.x + Math.cos(angle) * radius, -city.width / 2, city.width / 2),
        z: clamp(p.z + Math.sin(angle) * radius, -city.depth / 2, city.depth / 2),
        angle: angle + Math.PI, speed: 0, kind: 'police', health: 100,
        role: 'pursuit', isHeli: false, player: false, damageTint: 0,
      });
    }
    if (state.wanted >= 3 && !state.roadblocks.length) {
      for (let i = 0; i < 2; i += 1) {
        const p = state.player;
        const x = clamp(p.x + (i === 0 ? 62 : -62), -city.width / 2 + 20, city.width / 2 - 20);
        const z = clamp(p.z + (i === 0 ? 10 : -10), -city.depth / 2 + 20, city.depth / 2 - 20);
        state.police.push({
          id: `block-${state.time.toFixed(2)}-${i}`, x, z, angle: p.angle,
          speed: 0, kind: 'police', health: 140, role: 'block',
          isHeli: false, player: false, damageTint: 0,
        });
        state.roadblocks.push({ id: `roadblock-${i}`, x, z, angle: p.angle });
      }
      event('roadblock', { reason });
    }
    if (state.wanted >= 3 && !state.police.some((unit) => unit.isHeli)) {
      state.police.push({
        id: 'police-heli', x: state.player.x + 52, z: state.player.z - 46,
        angle: 0, speed: 20, kind: 'police', health: 120,
        role: 'air', isHeli: true, player: false, altitude: 30, damageTint: 0,
      });
      event('policeHeli');
    }
  }

  function updatePolice(dt) {
    const p = state.player;
    for (const unit of state.police) {
      if (unit.role === 'block') continue;
      if (unit.isHeli) {
        unit.angle += dt * 0.75;
        unit.x += Math.sin(unit.angle) * 12 * dt + (p.x - unit.x) * dt * 0.42;
        unit.z += Math.cos(unit.angle) * 12 * dt + (p.z - unit.z) * dt * 0.42;
        unit.altitude = 28 + Math.sin(state.time * 1.4) * 2.5;
        continue;
      }
      const desired = Math.atan2(p.x - unit.x, p.z - unit.z);
      let delta = desired - unit.angle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      unit.angle += clamp(delta, -1.8 * dt, 1.8 * dt);
      unit.speed += (15 + state.wanted * 1.7 - unit.speed) * dt * 0.8;
      const resolved = collide(
        unit.x + Math.sin(unit.angle) * unit.speed * dt,
        unit.z + Math.cos(unit.angle) * unit.speed * dt,
        2.6, city,
      );
      unit.x = resolved.x; unit.z = resolved.z;
      if (distance(unit.x, unit.z, p.x, p.z) < 5.5) hurtPlayer(6 + state.wanted, 'police');
    }
    state.policeSpawnTimer -= dt;
    if (state.wanted > 0 && state.policeSpawnTimer <= 0) {
      const pursuit = state.police.filter((unit) => unit.role === 'pursuit').length;
      if (pursuit < Math.min(2 + state.wanted, 7)) spawnPolice(1, 'reinforcement');
      state.policeSpawnTimer = 7 + (5 - state.wanted) * 1.6;
    }
    if (state.wanted === 0 && state.police.length) state.police.length = 0;
  }

  function updateEnemies(dt) {
    const p = state.player;
    for (const enemy of state.enemies) {
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
      if (enemy.state === 'down') continue;
      const d = distance(enemy.x, enemy.z, p.x, p.z);
      if (d > 85) continue;
      if (d < 11) {
        enemy.state = 'attack';
        enemy.attackTimer -= dt;
        if (enemy.attackTimer <= 0) {
          enemy.attackTimer = 1.25;
          hurtPlayer(9, 'gangster');
          event('enemyFire', { x: enemy.x, z: enemy.z });
        }
      } else {
        enemy.state = 'chase';
        const angle = Math.atan2(p.x - enemy.x, p.z - enemy.z);
        enemy.angle = angle;
        const resolved = collide(enemy.x + Math.sin(angle) * 3.7 * dt, enemy.z + Math.cos(angle) * 3.7 * dt, 1.2, city);
        enemy.x = resolved.x; enemy.z = resolved.z;
      }
    }
  }

  function downTarget(target) {
    target.health = 0;
    target.state = 'down';
    const money = target.money ?? 65;
    state.pickups.push({ id: `cash-${nextEffectId++}`, type: 'cash', x: target.x, z: target.z, amount: money, life: 40 });
    event('kill', { x: target.x, z: target.z, money });
  }

  function rayHit(ox, oz, dx, dz, range, spread) {
    let best = null;
    let bestT = Infinity;
    const targets = [
      ...state.enemies.filter((e) => e.health > 0 && e.state !== 'down'),
      ...state.peds.filter((ped) => ped.kind === 'gangster' && ped.health > 0),
    ];
    for (const target of targets) {
      const vx = target.x - ox;
      const vz = target.z - oz;
      const along = vx * dx + vz * dz;
      if (along <= 0 || along > range) continue;
      const across = Math.abs(vx * dz - vz * dx);
      if (across > 1.7 + spread * along) continue;
      if (along < bestT) { bestT = along; best = target; }
    }
    return best;
  }

  /** Hitscan fire toward a world point (or the player's facing when no aim is supplied). */
  function fire(aim) {
    if (state.won || state.cooldown > 0) return false;
    const weapon = WEAPONS[state.weaponIndex];
    if (state.weaponAmmo[state.weaponIndex] <= 0) {
      const magazine = capacityFor(weapon, state.upgrades.capacity);
      const refill = Math.min(magazine, state.reserveAmmo[state.weaponIndex]);
      if (refill > 0) {
        state.weaponAmmo[state.weaponIndex] = refill;
        state.reserveAmmo[state.weaponIndex] -= refill;
        state.ammo = refill;
        state.cooldown = 0.35;
        event('reload', { weapon: weapon.label });
      } else {
        state.cooldown = 0.18;
        event('dryFire');
      }
      return false;
    }
    const p = state.player;
    let dx;
    let dz;
    if (aim && Number.isFinite(aim.x) && Number.isFinite(aim.z)) {
      const length = Math.hypot(aim.x - p.x, aim.z - p.z) || 1;
      dx = (aim.x - p.x) / length;
      dz = (aim.z - p.z) / length;
    } else {
      dx = Math.sin(p.angle);
      dz = Math.cos(p.angle);
    }
    state.cooldown = weapon.fireRate;
    state.weaponAmmo[state.weaponIndex] -= 1;
    state.ammo = state.weaponAmmo[state.weaponIndex];
    event('shoot', { weapon: weapon.label, x: p.x, z: p.z });

    for (let pellet = 0; pellet < weapon.pellets; pellet += 1) {
      const jitter = weapon.spread * random.range(-1, 1);
      const cos = Math.cos(jitter);
      const sin = Math.sin(jitter);
      const rdx = dx * cos - dz * sin;
      const rdz = dx * sin + dz * cos;
      const target = rayHit(p.x, p.z, rdx, rdz, weapon.range, weapon.spread);
      const tx = target ? target.x : p.x + rdx * weapon.range;
      const tz = target ? target.z : p.z + rdz * weapon.range;
      state.effects.push({
        id: nextEffectId++, type: 'tracer', x: p.x, z: p.z, tx, tz,
        life: 0.09, maxLife: 0.09, color: weapon.tracer,
      });
      if (!target) continue;
      target.health -= weapon.damage;
      target.hitFlash = 0.2;
      event('hit', { x: target.x, z: target.z, damage: weapon.damage });
      if (target.health <= 0) downTarget(target);
    }
    return true;
  }

  /** Close-range attack used when the sidearm is empty or the player prefers silence. */
  function melee() {
    if (state.won || state.cooldown > 0) return false;
    const p = state.player;
    state.cooldown = 0.42;
    let hit = false;
    for (const target of state.enemies) {
      if (target.health <= 0 || distance(p.x, p.z, target.x, target.z) > 3.6) continue;
      target.health -= 38;
      target.hitFlash = 0.25;
      event('melee', { x: target.x, z: target.z });
      hit = true;
      if (target.health <= 0) downTarget(target);
    }
    return hit;
  }

  /** E: leave a vehicle, steal the nearest car, or climb into the helicopter. */
  function tryEnter() {
    const p = state.player;
    if (p.flying) {
      const heli = state.helicopter;
      heli.player = false;
      p.flying = false;
      p.x = heli.x + 5; p.z = heli.z + 5;
      toast('LEFT THE HELICOPTER', 1.8);
      return true;
    }
    if (!p.onFoot) {
      const car = state.cars.find((c) => c.id === p.carId);
      if (car) { car.player = false; p.x = car.x + 4; p.z = car.z + 4; }
      p.onFoot = true; p.carId = null; p.speed = 0;
      return true;
    }
    const heli = state.helicopter;
    if (distance(p.x, p.z, heli.x, heli.z) < 11) {
      heli.player = true;
      heli.active = true;
      p.flying = true;
      p.x = heli.x; p.z = heli.z;
      toast('HELI AIRBORNE — SHIFT CLIMB / F DESCEND', 3);
      event('enterHeli');
      return true;
    }
    let nearest = null;
    let bestDistance = 8;
    for (const car of [...state.cars, ...state.police.filter((unit) => !unit.isHeli && unit.role !== 'block')]) {
      const d = distance(p.x, p.z, car.x, car.z);
      if (d < bestDistance) { bestDistance = d; nearest = car; }
    }
    if (!nearest) {
      const garage = spotFor('garage');
      if (distance(p.x, p.z, garage.x, garage.z) < 18) {
        toast('GARAGE — 1 ENGINE  2 ARMOR  3 GUNS', 2.5);
        return false;
      }
      return false;
    }
    nearest.player = true;
    p.onFoot = false;
    p.carId = nearest.id;
    p.x = nearest.x; p.z = nearest.z;
    if (state.police.includes(nearest)) addWanted(1, 'police car theft');
    event('enterCar', { kind: nearest.kind });
    return true;
  }

  function addWanted(n, reason = 'crime') {
    state.wanted = clamp(state.wanted + n, 0, 5);
    event('wanted', { level: state.wanted, reason });
    toast(`WANTED ${'★'.repeat(state.wanted)}${'☆'.repeat(5 - state.wanted)} — ${reason}`, 2.4);
    if (state.wanted > 0) spawnPolice(Math.max(1, state.wanted), reason);
    else state.police.length = 0;
  }

  function updatePickups(dt) {
    const p = state.player;
    for (const pickup of state.pickups) {
      pickup.life -= dt;
      if (distance(p.x, p.z, pickup.x, pickup.z) > 3.4) continue;
      if (pickup.type === 'cash') {
        state.money += pickup.amount;
        toast(`+$${pickup.amount}`, 1.4);
        event('cash', { amount: pickup.amount });
      } else if (pickup.type === 'health') {
        state.health = Math.min(100, state.health + 35);
        toast('+HEALTH', 1.4);
        event('pickup', { type: 'health' });
      } else if (pickup.type === 'armor') {
        state.armor = Math.min(100, state.armor + 40);
        toast('+ARMOR', 1.4);
        event('pickup', { type: 'armor' });
      } else {
        state.reserveAmmo[state.weaponIndex] += weaponAmmoGain();
        for (let i = 0; i < WEAPONS.length; i += 1) {
          if (!state.owned[i]) { state.owned[i] = true; toast(`${WEAPONS[i].label} UNLOCKED`, 2); break; }
        }
        toast('+AMMO', 1.4);
        event('pickup', { type: 'ammo' });
      }
      pickup.life = 0;
      state.player.health = state.health;
      state.player.armor = state.armor;
    }
    state.pickups = state.pickups.filter((pickup) => pickup.life > 0);
  }

  function weaponAmmoGain() {
    return Math.ceil(WEAPONS[state.weaponIndex].magazine * 1.5);
  }

  function updateEffects(dt) {
    for (const effect of state.effects) effect.life -= dt;
    state.effects = state.effects.filter((effect) => effect.life > 0);
  }

  function updateHints() {
    const p = state.player;
    const garage = spotFor('garage');
    if (p.flying) state.hint = 'W/S THRUST   A/D YAW   SHIFT CLIMB   F DESCEND   E EXIT';
    else if (!p.onFoot) state.hint = 'WASD DRIVE   F HANDBRAKE   E EXIT   F2 WANTED   F3 JOB';
    else if (distance(p.x, p.z, garage.x, garage.z) < 18) state.hint = 'GARAGE: 1 ENGINE · 2 ARMOR · 3 GUNS   E TO ENTER A CAR';
    else {
      const nearCar = state.cars.some((car) => distance(p.x, p.z, car.x, car.z) < 8);
      state.hint = nearCar ? 'E STEAL CAR   LEFT CLICK FIRE   RIGHT CLICK AIM   F3 JOB' : 'WASD MOVE   SHIFT SPRINT   E ENTER   LEFT CLICK FIRE   F3 JOB';
    }
  }

  /** Accumulator-driven step. The caller always passes dt = 1/60. */
  function step(dt, input = {}) {
    if (state.won) return;
    state.time += dt;
    state.cooldown = Math.max(0, state.cooldown - dt);
    state.toastTimer = Math.max(0, state.toastTimer - dt);
    state.dialogueTimer = Math.max(0, state.dialogueTimer - dt);
    state.saveIndicator = Math.max(0, state.saveIndicator - dt);
    if (state.toastTimer === 0) state.toast = '';
    if (state.dialogueTimer === 0) state.dialogue = null;

    updatePlayer(dt, input);
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateEnemies(dt);
    updatePickups(dt);
    updateEffects(dt);
    checkObjective();
    updateHints();
  }

  /** Jump just outside the objective radius so the gold beam stays readable. */
  function teleportNearObjective() {
    const target = objective();
    if (!target) return null;
    const p = state.player;
    const placement = collide(target.x + 21, target.z + 15, 1.2, city);
    p.x = placement.x; p.z = placement.z;
    p.angle = Math.atan2(target.x - p.x, target.z - p.z);
    if (p.carId) {
      const car = state.cars.find((c) => c.id === p.carId);
      if (car) { car.x = p.x; car.z = p.z; car.angle = p.angle; car.speed = 0; }
    }
    toast('MOVED NEAR THE JOB MARKER', 2);
    event('teleport', { x: p.x, z: p.z });
    return target;
  }

  /** Set the active job directly; used by the story flow and the photo-mode staging. */
  function setMission(index) {
    if (index < 0 || index >= plan.length) return;
    beginMission(index);
  }

  function cycleWeapon() {
    state.weaponIndex = nextWeapon(state.weaponIndex, state.owned);
    state.ammo = state.weaponAmmo[state.weaponIndex];
    event('weapon', { name: WEAPONS[state.weaponIndex].label });
    toast(WEAPONS[state.weaponIndex].label, 1.4);
    return state.weaponIndex;
  }

  function selectWeapon(index) {
    if (index < 0 || index >= WEAPONS.length || !state.owned[index]) return false;
    state.weaponIndex = index;
    state.ammo = state.weaponAmmo[index];
    event('weapon', { name: WEAPONS[index].label });
    return true;
  }

  function cycleRadio() {
    state.radioIndex = (state.radioIndex + 1) % STATIONS.length;
    toast(`RADIO — ${STATIONS[state.radioIndex].name}`, 2);
    event('radio', { station: STATIONS[state.radioIndex].name });
    return STATIONS[state.radioIndex].name;
  }

  function buyUpgrade(key) {
    const definition = UPGRADES.find((item) => item.key === key);
    if (!definition) return false;
    const result = purchase(definition, state.upgrades[key], state.money);
    if (!result.spent) {
      toast('NOT ENOUGH MONEY FOR THAT UPGRADE', 2);
      return false;
    }
    state.money -= result.spent;
    state.upgrades[key] = result.level;
    if (key === 'capacity') {
      for (let i = 0; i < WEAPONS.length; i += 1) {
        state.weaponAmmo[i] = Math.min(capacityFor(WEAPONS[i], result.level), state.weaponAmmo[i] + 12);
      }
    }
    toast(`${definition.label} UPGRADED TO ${result.level}  -$${result.spent}`, 2.6);
    state.saveIndicator = 1.4;
    event('upgrade', { key, level: result.level });
    return true;
  }

  /** Save only what matters to continuity; traffic can be regenerated from the seed. */
  function snapshot() {
    return {
      missionIndex: state.missionIndex,
      stage: state.stage,
      money: state.money,
      wanted: state.wanted,
      health: state.health,
      armor: state.armor,
      ammo: state.ammo,
      weaponIndex: state.weaponIndex,
      owned: [...state.owned],
      weaponAmmo: [...state.weaponAmmo],
      reserveAmmo: [...state.reserveAmmo],
      upgrades: { ...state.upgrades },
      radioIndex: state.radioIndex,
      time: state.time,
      rain: state.rain,
      won: state.won,
      player: { x: state.player.x, z: state.player.z, angle: state.player.angle },
    };
  }

  function restore(data) {
    if (!data || typeof data !== 'object') return;
    const values = ['missionIndex', 'stage', 'money', 'wanted', 'health', 'armor', 'ammo',
      'weaponIndex', 'radioIndex', 'time', 'rain', 'won'];
    for (const key of values) {
      if (typeof data[key] === typeof state[key] && data[key] !== undefined) state[key] = data[key];
    }
    state.missionIndex = clamp(state.missionIndex, 0, plan.length);
    if (data.owned?.length === state.owned.length) state.owned = [...data.owned];
    if (data.weaponAmmo?.length === state.weaponAmmo.length) state.weaponAmmo = [...data.weaponAmmo];
    if (data.reserveAmmo?.length === state.reserveAmmo.length) state.reserveAmmo = [...data.reserveAmmo];
    if (data.upgrades) state.upgrades = { ...state.upgrades, ...data.upgrades };
    if (data.player) {
      state.player.x = data.player.x ?? state.player.x;
      state.player.z = data.player.z ?? state.player.z;
      state.player.angle = data.player.angle ?? state.player.angle;
    }
    state.player.health = state.health;
    state.player.armor = state.armor;
    state.player.ammo = state.ammo;
    if (state.missionIndex < plan.length) setMission(state.missionIndex);
    state.stage = clamp(data.stage ?? 0, 0, Math.max(0, (plan[state.missionIndex]?.stages.length ?? 1) - 1));
    state.enemies.length = 0;
    if (stage()?.kind === 'fight') {
      const spot = spotFor(stage().spot);
      spawnEnemies(stage().enemies, spot.x, spot.z);
    }
    state.saveIndicator = 1.5;
    event('restore');
  }

  /** Restore the opening afternoon from the same seed. */
  function reset() {
    Object.assign(state, buildState(city, createRandom(SEED)));
    event('reset');
  }

  /** Stage a cinematic photo-mode state without changing the simulation's rules. */
  function photoScene(name) {
    reset();
    if (name === 'chase') {
      state.player.x = city.objectiveSpots.deliver.x - 30;
      state.player.z = city.objectiveSpots.deliver.z + 30;
      addWanted(5, 'photo chase');
      state.cars[2].x = state.player.x + 14;
      state.cars[2].z = state.player.z - 8;
      state.cars[2].angle = Math.PI / 2;
      state.cars[2].speed = 0;
      for (let i = 0; i < 3; i += 1) {
        state.effects.push({
          id: nextEffectId++, type: 'spark', x: state.player.x + 12 + i * 3,
          z: state.player.z - 6 + i, life: 3.2, maxLife: 3.2,
        });
      }
    } else if (name === 'mission' || name === 'fight') {
      setMission(7);
      state.stage = 1;
      const spot = spotFor('plaza');
      state.enemies.length = 0;
      spawnEnemies(4, spot.x, spot.z);
      state.player.x = spot.x + 24;
      state.player.z = spot.z + 18;
      state.player.angle = Math.atan2(spot.x - state.player.x, spot.z - state.player.z);
      say({ speaker: 'Dante Ibarra', text: 'No more messages. Finish it in the last of the sun.' }, 30);
      state.weaponIndex = 2;
      state.ammo = state.weaponAmmo[2];
    } else if (name === 'play') {
      setMission(0);
      state.player.x = city.objectiveSpots.pickup.x + 23;
      state.player.z = city.objectiveSpots.pickup.z + 16;
      state.player.angle = Math.atan2(-1, -1);
    }
  }

  return {
    state, step, fire, melee, tryEnter, objective, startNextMission: advanceStage,
    addWanted, snapshot, restore, reset, teleportNearObjective, setMission,
    cycleWeapon, selectWeapon, cycleRadio, buyUpgrade, photoScene,
  };
}
