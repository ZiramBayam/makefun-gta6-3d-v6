// Third-person WebGL renderer. Static city geometry is instanced into a handful of draw calls;
// only moving vehicles, people and effects get their own groups. Light is warm, high and low.

import { VIEW, PALETTE, DISTRICTS } from './config.js';

/** Build the scene once, then update it from simulation state on every draw. */
export function createRenderer(canvas, city, assets) {
  const THREE = globalThis.THREE;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1);
  renderer.setSize(VIEW.width, VIEW.height, false);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#e9e6d8');
  scene.fog = new THREE.FogExp2('#ded8c5', 0.00135);

  const camera = new THREE.PerspectiveCamera(62, VIEW.width / VIEW.height, 0.5, 2800);
  camera.position.set(city.spawn.x - 16, 16, city.spawn.z - 26);

  scene.add(new THREE.HemisphereLight(0xfff3d8, 0x7e9189, 1.75));
  const sun = new THREE.DirectionalLight(0xfff0cd, 1.35);
  sun.position.set(260, 340, -190);
  scene.add(sun);
  const bounce = new THREE.DirectionalLight(0x9dd7d0, 0.35);
  bounce.position.set(-180, 90, 220);
  scene.add(bounce);

  const api = {
    buttons: [],
    objectiveScreen: null,
    cameraMode: 'follow',
    yaw: Math.PI / 2,
    pitch: 0.26,
    aim: false,
    gl: renderer.getContext(),
  };
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();
  let frame = 0;
  let lastTime = 0;

  function instanceMesh(geometry, material, count) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }

  // ---------- static ground, water, roads and city fabric ----------

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(city.width + 1600, city.depth + 1600),
    new THREE.MeshLambertMaterial({ color: new THREE.Color(PALETTE.ivory) }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const waterTexture = assets.textures.water.clone();
  waterTexture.needsUpdate = true;
  waterTexture.wrapS = THREE.RepeatWrapping;
  waterTexture.wrapT = THREE.RepeatWrapping;
  waterTexture.repeat.set(7, 7);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(city.harbor.w, city.harbor.d),
    new THREE.MeshLambertMaterial({ map: waterTexture }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(city.harbor.x, 0.06, city.harbor.z);
  scene.add(water);

  const roads = instanceMesh(assets.geometries.plane, assets.materials.road, city.roads.length);
  city.roads.forEach((road, index) => {
    dummy.position.set(road.x, 0.045, road.z);
    dummy.rotation.set(-Math.PI / 2, 0, 0);
    dummy.scale.set(road.w, road.d, 1);
    dummy.updateMatrix();
    roads.setMatrixAt(index, dummy.matrix);
  });
  roads.instanceMatrix.needsUpdate = true;

  // Lane dashes give the boulevards a readable rhythm even from a chase camera.
  const dashPositions = [];
  for (const road of city.roads) {
    if (road.w < 28 && road.d < 28) continue;
    const vertical = road.axis === 'z';
    const span = vertical ? city.depth : city.width;
    for (let offset = -span / 2 + 12; offset < span / 2 - 12; offset += 26) {
      dashPositions.push(vertical
        ? { x: road.x, z: offset, sx: 0.8, sz: 10 }
        : { x: offset, z: road.z, sx: 10, sz: 0.8 });
    }
  }
  const dashes = instanceMesh(assets.geometries.box,
    new THREE.MeshBasicMaterial({ color: 0xf6efdc, transparent: true, opacity: 0.55 }), dashPositions.length);
  dashPositions.forEach((dash, index) => {
    dummy.position.set(dash.x, 0.09, dash.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(dash.sx, 0.05, dash.sz);
    dummy.updateMatrix();
    dashes.setMatrixAt(index, dummy.matrix);
  });
  dashes.instanceMatrix.needsUpdate = true;

  const pads = instanceMesh(assets.geometries.box, assets.materials.stone, city.blocks.length);
  city.blocks.forEach((block, index) => {
    dummy.position.set(block.x, 0.03, block.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(block.w + 5, 0.1, block.d + 5);
    dummy.updateMatrix();
    pads.setMatrixAt(index, dummy.matrix);
  });
  pads.instanceMatrix.needsUpdate = true;

  const greenBlocks = city.blocks.filter((block) => block.kind === 'park');
  const plazaBlocks = city.blocks.filter((block) => block.kind === 'plaza');
  for (const [group, map] of [[greenBlocks, assets.textures.park], [plazaBlocks, assets.textures.plaza]]) {
    if (!group.length) continue;
    const mesh = instanceMesh(assets.geometries.plane,
      new THREE.MeshLambertMaterial({ map }), group.length);
    group.forEach((block, index) => {
      dummy.position.set(block.x, 0.11, block.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(block.w, block.d, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }

  const piers = instanceMesh(assets.geometries.box, assets.materials.stone, Math.max(1, city.piers.length));
  city.piers.forEach((pier, index) => {
    dummy.position.set(pier.x, 0.2, pier.z + pier.d * 0.2);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(pier.w * 0.95, 0.45, pier.d * 0.9);
    dummy.updateMatrix();
    piers.setMatrixAt(index, dummy.matrix);
  });
  piers.instanceMatrix.needsUpdate = true;

  // ---------- buildings: three facade bands, roof caps and long cool shadows ----------

  const bands = { low: [], mid: [], glass: [] };
  city.blocks.forEach((block, index) => {
    if (block.kind !== 'building') return;
    const base = block.district === 6 ? 72 : block.district === 5 ? 30 : 19;
    const height = base * block.heightHint + (index % 6) * (block.district === 6 ? 8 : 3.4);
    const type = block.district === 6 ? 'glass' : height > 34 ? 'mid' : 'low';
    const districtColor = DISTRICTS[block.district]?.color ?? PALETTE.terracotta;
    bands[type].push({ block, height, districtColor });
  });

  for (const [type, list] of Object.entries(bands)) {
    if (!list.length) continue;
    const material = type === 'glass' ? assets.materials.glass
      : type === 'mid' ? assets.materials.facadeMid : assets.materials.facadeLow;
    const mesh = instanceMesh(assets.geometries.box, material, list.length);
    list.forEach(({ block, height, districtColor }, index) => {
      dummy.position.set(block.x, height / 2, block.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(block.w * 0.94, height, block.d * 0.94);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.set(type === 'glass' ? '#a8cfda' : districtColor).multiplyScalar(block.tint);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  const allBuildings = [...bands.low, ...bands.mid, ...bands.glass];
  const caps = instanceMesh(assets.geometries.box, assets.materials.terracotta, allBuildings.length);
  const shadowGeo = assets.geometries.plane.clone();
  shadowGeo.rotateX(-Math.PI / 2);
  const shadows = instanceMesh(shadowGeo, assets.materials.shadow, allBuildings.length);
  const shadowAngle = Math.atan2(-0.8, 0.6);
  allBuildings.forEach(({ block, height }, index) => {
    dummy.position.set(block.x, height + 0.8, block.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(block.w * 0.98, 1.6, block.d * 0.98);
    dummy.updateMatrix();
    caps.setMatrixAt(index, dummy.matrix);

    const length = Math.min(height * 0.72, 90);
    dummy.position.set(block.x - 0.8 * length * 0.5, 0.13, block.z + 0.6 * length * 0.5);
    dummy.rotation.set(0, shadowAngle, 0);
    dummy.scale.set(block.w * 1.05, length, 1);
    dummy.updateMatrix();
    shadows.setMatrixAt(index, dummy.matrix);
  });
  caps.instanceMatrix.needsUpdate = true;
  shadows.instanceMatrix.needsUpdate = true;

  // ---------- palms and lamp posts along the boulevards ----------

  const palms = [];
  let palmIndex = 0;
  for (const road of city.roads) {
    if (road.w < 28 && road.d < 28) continue;
    const vertical = road.axis === 'z';
    const span = vertical ? city.depth : city.width;
    for (let offset = -span / 2 + 50; offset < span / 2 - 30; offset += 118) {
      palmIndex += 1;
      const side = palmIndex % 2 === 0 ? 21 : -21;
      palms.push(vertical
        ? { x: road.x + side, z: offset, h: 9 + (palmIndex % 4) * 1.4 }
        : { x: offset, z: road.z + side, h: 9 + (palmIndex % 3) * 1.7 });
    }
  }
  const trunks = instanceMesh(assets.geometries.cylinder, assets.materials.terracotta, palms.length);
  const fronds = instanceMesh(assets.geometries.cone,
    new THREE.MeshLambertMaterial({ color: 0x3f8a6a, flatShading: true }), palms.length * 5);
  palms.forEach((palm, index) => {
    dummy.position.set(palm.x, palm.h / 2, palm.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(0.55, palm.h, 0.55);
    dummy.updateMatrix();
    trunks.setMatrixAt(index, dummy.matrix);
    for (let f = 0; f < 5; f += 1) {
      const angle = (f / 5) * Math.PI * 2 + index * 0.3;
      dummy.position.set(palm.x + Math.cos(angle) * 2, palm.h + 0.3, palm.z + Math.sin(angle) * 2);
      dummy.rotation.set(Math.PI / 2.8 * Math.cos(angle), -angle, Math.PI / 2.8 * Math.sin(angle));
      dummy.scale.set(1.35, 4.6, 0.4);
      dummy.updateMatrix();
      fronds.setMatrixAt(index * 5 + f, dummy.matrix);
    }
  });
  trunks.instanceMatrix.needsUpdate = true;
  fronds.instanceMatrix.needsUpdate = true;

  const lampSpots = [];
  for (let i = 1; i < 9; i += 2) {
    for (let j = 1; j < 9; j += 2) {
      lampSpots.push({
        x: i * 160 - city.width / 2 + 20,
        z: j * 160 - city.depth / 2 + 20,
      });
    }
  }
  const lampPosts = instanceMesh(assets.geometries.cylinder,
    new THREE.MeshLambertMaterial({ color: 0x43545a }), lampSpots.length);
  const lampHeads = instanceMesh(assets.geometries.box, assets.materials.light, lampSpots.length);
  lampSpots.forEach((spot, index) => {
    dummy.position.set(spot.x, 4.5, spot.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(0.18, 9, 0.18);
    dummy.updateMatrix();
    lampPosts.setMatrixAt(index, dummy.matrix);
    dummy.position.set(spot.x, 9.2, spot.z);
    dummy.scale.set(1.5, 0.45, 1.5);
    dummy.updateMatrix();
    lampHeads.setMatrixAt(index, dummy.matrix);
  });
  lampPosts.instanceMatrix.needsUpdate = true;
  lampHeads.instanceMatrix.needsUpdate = true;

  // Landmark plaques: original district names, drawn on canvas at runtime.
  for (const landmark of city.landmarks) {
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 512;
    signCanvas.height = 112;
    const ctx = signCanvas.getContext('2d');
    ctx.fillStyle = 'rgba(7,26,36,.84)';
    ctx.fillRect(0, 0, 512, 112);
    ctx.fillStyle = landmark.color;
    ctx.fillRect(0, 0, 12, 112);
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#f6efdc';
    ctx.fillText(landmark.name.toUpperCase(), 32, 74);
    const texture = new THREE.CanvasTexture(signCanvas);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }));
    sprite.scale.set(58, 12.7, 1);
    sprite.position.set(landmark.x, 17, landmark.z);
    scene.add(sprite);
  }

  // ---------- objective marker ----------

  const marker = assets.makeMarker();
  scene.add(marker);
  const markerGlow = new THREE.Mesh(
    new THREE.CircleGeometry(13, 28),
    new THREE.MeshBasicMaterial({ color: 0xffd166, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  markerGlow.rotation.x = -Math.PI / 2;
  markerGlow.position.y = 0.16;
  scene.add(markerGlow);

  // ---------- dynamic entity pools ----------

  const pools = {
    cars: new Map(), peds: new Map(), enemies: new Map(),
    helis: new Map(), cones: new Map(), pickups: new Map(), effects: new Map(),
  };

  function poolEntry(pool, id, factory) {
    let entry = pool.get(id);
    if (!entry) {
      entry = { group: factory(), seen: false };
      scene.add(entry.group);
      pool.set(id, entry);
    }
    return entry;
  }

  function prunePool(pool) {
    for (const [id, entry] of pool) {
      if (entry.seen) { entry.seen = false; } else { entry.group.visible = false; }
      if (entry.expired) { scene.remove(entry.group); pool.delete(id); }
    }
  }

  function healthBar() {
    const group = new THREE.Group();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.42),
      new THREE.MeshBasicMaterial({ color: 0x071a24, transparent: true, opacity: 0.9 }));
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.28),
      new THREE.MeshBasicMaterial({ color: 0xff6b4a }));
    fill.position.z = 0.02;
    group.add(back, fill);
    group.position.y = 3.5;
    group.userData = { fill };
    return group;
  }

  const rainCount = 900;
  const rainPositions = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i += 1) {
    rainPositions[i * 3] = (i % 97) * 13 - 630;
    rainPositions[i * 3 + 1] = (i % 53) * 1.8;
    rainPositions[i * 3 + 2] = (i % 89) * 14 - 620;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.Points(rainGeo,
    new THREE.PointsMaterial({ color: 0xdff4f0, size: 0.55, transparent: true, opacity: 0.8 }));
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  function updateCars(state) {
    const all = [...state.cars, ...state.police.filter((unit) => !unit.isHeli)];
    for (const car of all) {
      const entry = poolEntry(pools.cars, car.id, () => assets.makeCar(car.kind));
      entry.seen = true;
      entry.group.visible = true;
      entry.group.position.set(car.x, 0.18, car.z);
      entry.group.rotation.y = car.angle;
      if (car.kind === 'police' && !entry.lights) {
        entry.lights = [];
        entry.group.traverse((child) => {
          if (child.material === assets.materials.policeRed || child.material === assets.materials.policeBlue) {
            entry.lights.push(child);
          }
        });
      }
      if (entry.lights) {
        const flash = Math.floor(state.time * 7) % 2 === 0;
        entry.lights[0].visible = flash;
        if (entry.lights[1]) entry.lights[1].visible = !flash;
      }
    }
    prunePool(pools.cars);
  }

  function updatePeople(state) {
    for (const ped of state.peds) {
      const entry = poolEntry(pools.peds, ped.id, () => assets.makePed(ped.kind));
      entry.seen = true;
      entry.group.visible = true;
      entry.group.position.set(ped.x, Math.sin(state.time * 5 + ped.x) * 0.06, ped.z);
      entry.group.rotation.y = ped.angle;
    }
    prunePool(pools.peds);

    for (const enemy of state.enemies) {
      const entry = poolEntry(pools.enemies, enemy.id, () => {
        const group = assets.makePed('gangster');
        const bar = healthBar();
        group.add(bar);
        group.userData.bar = bar;
        return group;
      });
      entry.seen = true;
      entry.group.visible = true;
      entry.group.position.set(enemy.x, 0, enemy.z);
      entry.group.rotation.y = enemy.angle;
      const down = enemy.state === 'down' || enemy.health <= 0;
      entry.group.rotation.z = down ? Math.PI / 2.4 : 0;
      entry.group.position.y = down ? 0.6 : 0;
      const bar = entry.group.userData.bar;
      bar.visible = !down && enemy.health > 0;
      bar.quaternion.copy(camera.quaternion);
      const fill = bar.userData.fill;
      const fraction = Math.max(0.02, enemy.health / enemy.maxHealth);
      fill.scale.x = fraction;
      fill.position.x = -(3.4 - 3.4 * fraction) / 2;
    }
    prunePool(pools.enemies);

    const runner = state.runner;
    if (runner.active) {
      const entry = poolEntry(pools.peds, runner.id, () => assets.makePed('runner'));
      entry.seen = true;
      entry.group.visible = true;
      entry.group.position.set(runner.x, 0, runner.z);
      entry.group.rotation.y = runner.angle;
    }
  }

  function updateHelis(state) {
    const units = [
      { id: state.helicopter.id, x: state.helicopter.x, z: state.helicopter.z,
        altitude: state.helicopter.altitude, angle: state.helicopter.angle, kind: 'civilian' },
      ...state.police.filter((unit) => unit.isHeli),
    ];
    for (const unit of units) {
      const entry = poolEntry(pools.helis, unit.id, () => assets.makeHelicopter(unit.kind));
      entry.seen = true;
      entry.group.visible = true;
      entry.group.position.set(unit.x, (unit.altitude ?? 0) + 2.2, unit.z);
      entry.group.rotation.y = unit.angle;
      entry.group.rotation.z = Math.sin(state.time * 1.5) * 0.045;
      const rotor = entry.group.userData.rotor;
      if (rotor) rotor.rotation.y += 0.42;
      const tail = entry.group.userData.tailRotor;
      if (tail) tail.rotation.z += 0.35;
    }
    prunePool(pools.helis);
  }

  function updateRoadblocks(state) {
    state.roadblocks.forEach((block, index) => {
      for (let i = -3; i <= 3; i += 1) {
        const id = `${block.id}-${i}`;
        const entry = poolEntry(pools.cones, id, () => assets.makeCone(0, 0));
        entry.seen = true;
        entry.group.visible = true;
        entry.group.position.set(
          block.x + Math.cos(block.angle) * i * 5.5,
          0,
          block.z - Math.sin(block.angle) * i * 5.5,
        );
        void index;
      }
    });
    prunePool(pools.cones);
  }

  function updatePickups(state) {
    for (const pickup of state.pickups) {
      const entry = poolEntry(pools.pickups, pickup.id, () => {
        const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.3, 0),
          pickup.type === 'cash'
            ? assets.materials.gold
            : new THREE.MeshBasicMaterial({ color: pickup.type === 'health' ? 0xff6b4a : 0x5ce0c6 }));
        return mesh;
      });
      entry.seen = true;
      entry.group.visible = true;
      entry.group.position.set(pickup.x, 1.7 + Math.sin(state.time * 3 + pickup.x) * 0.35, pickup.z);
      entry.group.rotation.y += 0.05;
    }
    prunePool(pools.pickups);
  }

  function updateEffects(state, dt) {
    for (const effect of state.effects) {
      let entry = pools.effects.get(effect.id);
      if (!entry) {
        if (effect.type === 'explosion') entry = { group: assets.makeExplosion(effect.x, effect.z), kind: 'explosion' };
        else if (effect.type === 'tracer') {
          const mesh = new THREE.Mesh(assets.geometries.box,
            new THREE.MeshBasicMaterial({ color: new THREE.Color(effect.color ?? '#ffd166') }));
          entry = { group: mesh, kind: 'tracer' };
        } else {
          const mesh = new THREE.Mesh(assets.geometries.sphere,
            new THREE.MeshBasicMaterial({ color: 0xffd166 }));
          mesh.scale.setScalar(0.7);
          entry = { group: mesh, kind: 'spark' };
        }
        scene.add(entry.group);
        pools.effects.set(effect.id, entry);
      }
      entry.seen = true;
      entry.group.visible = true;
      const age = 1 - effect.life / effect.maxLife;
      if (effect.type === 'tracer') {
        const dx = effect.tx - effect.x;
        const dz = effect.tz - effect.z;
        entry.group.position.set((effect.x + effect.tx) / 2, 1.6, (effect.z + effect.tz) / 2);
        entry.group.rotation.y = Math.atan2(dx, dz);
        entry.group.scale.set(0.16, 0.16, Math.max(0.5, Math.hypot(dx, dz)));
      } else if (effect.type === 'spark') {
        entry.group.position.set(effect.x + Math.sin(effect.id * 9) * (1 + age * 3), 1.5 + age * 4,
          effect.z + Math.cos(effect.id * 7) * (1 + age * 3));
        entry.group.scale.setScalar(0.8 * (1 - age * 0.6));
      } else {
        entry.group.position.set(effect.x, 0, effect.z);
        for (const part of entry.group.userData.parts) {
          part.mesh.position.x += part.vx * dt * (1 - age * 0.5);
          part.mesh.position.y += part.vy * dt * (1 - age) - 6 * dt * age;
          part.mesh.position.z += part.vz * dt * (1 - age * 0.5);
          part.mesh.scale.setScalar(Math.max(0.05, 1 - age));
        }
      }
    }
    for (const [id, entry] of pools.effects) {
      if (entry.seen) entry.seen = false;
      else { entry.expired = true; }
      if (entry.expired) { scene.remove(entry.group); pools.effects.delete(id); }
    }
  }

  function updateRain(state, dt) {
    rain.visible = !!state.rain;
    if (!state.rain) return;
    const positions = rainGeo.attributes.position.array;
    const px = state.player.x;
    const pz = state.player.z;
    for (let i = 0; i < rainCount; i += 1) {
      positions[i * 3 + 1] -= 34 * dt;
      if (positions[i * 3 + 1] < 0) positions[i * 3 + 1] = 42;
      positions[i * 3] += px - (i % 97) * 13 + 630 - positions[i * 3];
      positions[i * 3 + 2] += pz - (i % 89) * 14 + 620 - positions[i * 3 + 2];
    }
    rainGeo.attributes.position.needsUpdate = true;
  }

  function updateMarker(state, screen, dt) {
    const target = globalThis.CBObjective;
    const visible = !!target && screen !== 'title';
    marker.visible = visible;
    markerGlow.visible = visible;
    if (!visible) { api.objectiveScreen = null; return; }
    marker.position.set(target.x, 0, target.z);
    markerGlow.position.set(target.x, 0.16, target.z);
    marker.userData.ring.rotation.z += dt * 1.1;
    marker.userData.crest.rotation.y += dt * 1.6;
    marker.userData.orb.position.y = 12 + Math.sin(state.time * 2.6) * 1.7;
    marker.userData.beam.material.opacity = 0.2 + Math.sin(state.time * 3) * 0.045;
    api.objectiveScreen = worldToScreen(target.x, target.z);
  }

  function updateCamera(state, screen) {
    const p = state.player;
    const forwardX = Math.sin(api.yaw);
    const forwardZ = Math.cos(api.yaw);
    let desired;
    let lookAt;
    if (screen === 'title') {
      const angle = frame * 0.0032;
      desired = new THREE.Vector3(
        city.spawn.x + 70 + Math.sin(angle) * 46,
        31 + Math.sin(angle * 0.7) * 4,
        city.spawn.z - 62 + Math.cos(angle) * 34,
      );
      lookAt = new THREE.Vector3(city.spawn.x + 130, 10, city.spawn.z + 140);
    } else {
      const distance = api.aim ? 12 : (p.onFoot ? 18 : p.flying ? 30 : 26);
      const height = api.aim ? 4.2 : (p.flying ? 16 : p.onFoot ? 8 : 11);
      desired = new THREE.Vector3(
        p.x - forwardX * distance * Math.cos(api.pitch),
        height + (p.flying ? p.x === state.helicopter.x ? state.helicopter.altitude : 0 : 0) + Math.sin(api.pitch) * distance * 0.35,
        p.z - forwardZ * distance * Math.cos(api.pitch),
      );
      lookAt = new THREE.Vector3(p.x + forwardX * 5, p.flying ? 4 : 2.8, p.z + forwardZ * 5);
    }
    camera.position.lerp(desired, screen === 'title' ? 0.045 : 0.13);
    camera.lookAt(lookAt);
    const targetFov = api.aim ? 44 : 62;
    if (Math.abs(camera.fov - targetFov) > 0.05) {
      camera.fov += (targetFov - camera.fov) * 0.16;
      camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  }

  function worldToScreen(x, z) {
    const point = new THREE.Vector3(x, 3, z).project(camera);
    return {
      x: (point.x * 0.5 + 0.5) * VIEW.width,
      y: (-point.y * 0.5 + 0.5) * VIEW.height,
      visible: point.z < 1 && Math.abs(point.x) < 1.1 && Math.abs(point.y) < 1.1,
    };
  }

  function screenToLogical(x, y) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((x - rect.left) / (rect.width || VIEW.width)) * VIEW.width,
      y: ((y - rect.top) / (rect.height || VIEW.height)) * VIEW.height,
    };
  }

  function resize() {
    const width = globalThis.innerWidth || canvas.clientWidth || VIEW.width;
    const height = globalThis.innerHeight || canvas.clientHeight || VIEW.height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  /** Draw one frame from the simulation state. */
  function draw(state, screen = 'play', extras = {}) {
    frame += 1;
    const dt = Math.min(0.05, lastTime ? 1 / 60 : 1 / 60);
    lastTime = state.time;
    api.aim = !!(extras.mouse && extras.mouse.right);
    waterTexture.offset.x += dt * 0.012;
    waterTexture.offset.y += dt * 0.004;
    scene.fog.density = state.rain ? 0.0021 : 0.00135;
    scene.background.set(state.rain ? '#d5dcd6' : '#e9e6d8');

    updateCars(state);
    updatePeople(state);
    updateHelis(state);
    updateRoadblocks(state);
    updatePickups(state);
    updateEffects(state, dt);
    updateRain(state, dt);
    updateCamera(state, screen);
    updateMarker(state, screen, dt);
    renderer.render(scene, camera);
  }

  return { draw, resize, api, camera, scene, renderer, worldToScreen, screenToLogical };
}
