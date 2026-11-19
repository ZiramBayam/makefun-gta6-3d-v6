// Procedural asset factory. Every surface is a canvas texture drawn at runtime and every model
// is built from shared low-poly geometry. No image, font, sound or network request is involved.

import { PALETTE } from './config.js';

const BOX = 'box';

/** Build the cached textures, materials and model makers for a seeded world. */
export function createAssets(THREE, random) {
  const materials = {};
  const textures = {};
  const geometries = {};
  const shaded = (color, extra = {}) => new THREE.MeshLambertMaterial({ color: new THREE.Color(color), ...extra });

  function texture(width, height, paint) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    paint(ctx, width, height);
    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    if (THREE.SRGBColorSpace) map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }

  // Facades: warm plaster with regular window bays. Instance colour tints the plaster later.
  function facadeMap(rows, glass) {
    return texture(128, 128, (ctx, w, h) => {
      ctx.fillStyle = glass ? '#dce9ea' : '#f2ead8';
      ctx.fillRect(0, 0, w, h);
      const cols = glass ? 4 : 3;
      const cw = w / cols;
      const ch = h / rows;
      for (let r = 0; r < rows; r += 1) {
        ctx.fillStyle = glass ? 'rgba(7,26,36,.13)' : 'rgba(122,88,64,.13)';
        ctx.fillRect(0, r * ch, w, 2);
        for (let c = 0; c < cols; c += 1) {
          const x = c * cw + cw * 0.2;
          const y = r * ch + ch * 0.18;
          const ww = cw * 0.6;
          const wh = ch * 0.58;
          const lit = random.chance(glass ? 0.24 : 0.13);
          ctx.fillStyle = glass
            ? (lit ? '#fff4d2' : '#7fb8c9')
            : (lit ? '#ffd166' : '#547b86');
          ctx.fillRect(x, y, ww, wh);
          ctx.fillStyle = 'rgba(255,255,255,.28)';
          ctx.fillRect(x + 1, y + 1, ww * 0.34, wh * 0.32);
          ctx.fillStyle = 'rgba(7,26,36,.32)';
          ctx.fillRect(x, y + wh, ww, 2);
        }
      }
    });
  }

  textures.facadeLow = facadeMap(4, false);
  textures.facadeMid = facadeMap(8, false);
  textures.facadeGlass = facadeMap(12, true);
  textures.road = texture(64, 64, (ctx, w, h) => {
    ctx.fillStyle = '#8d8271';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 180; i += 1) {
      ctx.fillStyle = random.chance(0.5) ? 'rgba(255,248,225,.08)' : 'rgba(7,26,36,.07)';
      ctx.fillRect(random.range(0, w), random.range(0, h), 1.6, 1.6);
    }
  });
  textures.water = texture(256, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#2aa9a2');
    grad.addColorStop(0.5, '#5ce0c6');
    grad.addColorStop(1, '#7fb8c9');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 46; i += 1) {
      ctx.strokeStyle = random.chance(0.5) ? 'rgba(255,255,255,.28)' : 'rgba(7,26,36,.11)';
      ctx.lineWidth = random.range(1, 3);
      const y = random.range(0, h);
      ctx.beginPath();
      ctx.moveTo(random.range(0, w * 0.5), y);
      ctx.quadraticCurveTo(random.range(w * 0.4, w * 0.7), y + random.range(-5, 5), random.range(w * 0.6, w), y);
      ctx.stroke();
    }
  });
  textures.park = texture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#93a86f';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 220; i += 1) {
      ctx.fillStyle = random.chance(0.6) ? 'rgba(255,245,210,.17)' : 'rgba(7,26,36,.12)';
      ctx.fillRect(random.range(0, w), random.range(0, h), 2, 3);
    }
  });
  textures.plaza = texture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#e8ddc4';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(151,123,94,.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i += 1) {
      ctx.beginPath(); ctx.moveTo(i * w / 4, 0); ctx.lineTo(i * w / 4, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * h / 4); ctx.lineTo(w, i * h / 4); ctx.stroke();
    }
  });

  materials.facadeLow = new THREE.MeshLambertMaterial({ map: textures.facadeLow, color: 0xffffff });
  materials.facadeMid = new THREE.MeshLambertMaterial({ map: textures.facadeMid, color: 0xffffff });
  materials.glass = new THREE.MeshLambertMaterial({ map: textures.facadeGlass, color: 0xffffff });
  materials.road = shaded('#8d8271');
  materials.water = new THREE.MeshLambertMaterial({ map: textures.water, color: 0xffffff });
  materials.park = shaded('#ffffff');
  materials.plaza = shaded('#ffffff');
  materials.ivory = shaded(PALETTE.ivory);
  materials.stone = shaded(PALETTE.stone);
  materials.terracotta = shaded(PALETTE.terracotta);
  materials.coral = shaded(PALETTE.coral);
  materials.sea = shaded(PALETTE.sea);
  materials.gold = new THREE.MeshBasicMaterial({ color: new THREE.Color(PALETTE.gold) });
  materials.beam = new THREE.MeshBasicMaterial({
    color: new THREE.Color(PALETTE.gold), transparent: true, opacity: 0.24,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  materials.beamCore = new THREE.MeshBasicMaterial({
    color: 0xfff0bd, transparent: true, opacity: 0.42,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
  });
  materials.shadow = new THREE.MeshBasicMaterial({
    color: new THREE.Color(PALETTE.shadow), transparent: true, opacity: 0.22, depthWrite: false,
  });
  materials.glassBlue = shaded(PALETTE.glass);
  materials.tyre = shaded('#17232b');
  materials.light = new THREE.MeshBasicMaterial({ color: 0xfff0c0 });
  materials.brake = new THREE.MeshBasicMaterial({ color: 0xd63c30 });
  materials.policeRed = new THREE.MeshBasicMaterial({ color: 0xff3b30 });
  materials.policeBlue = new THREE.MeshBasicMaterial({ color: 0x3b7bff });
  materials.smoke = new THREE.MeshBasicMaterial({ color: 0x5c6470, transparent: true, opacity: 0.45, depthWrite: false });

  geometries[BOX] = new THREE.BoxGeometry(1, 1, 1);
  geometries.cylinder = new THREE.CylinderGeometry(1, 1, 1, 8);
  geometries.wheel = new THREE.CylinderGeometry(1, 1, 1, 10);
  geometries.sphere = new THREE.SphereGeometry(1, 10, 8);
  geometries.cone = new THREE.ConeGeometry(1, 1, 5);
  geometries.plane = new THREE.PlaneGeometry(1, 1);
  geometries.ring = new THREE.TorusGeometry(1, 0.06, 5, 24);

  function box(parent, material, x, y, z, sx, sy, sz) {
    const mesh = new THREE.Mesh(geometries[BOX], material);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    parent.add(mesh);
    return mesh;
  }

  /** One building: a box with a window grid, a roof, awnings and optional roof plant. */
  function makeBuilding(buildingBlock, district) {
    const group = new THREE.Group();
    const tall = district === 6;
    const plaza = district === 5;
    const baseHeight = tall ? 62 : plaza ? 30 : 20;
    const height = baseHeight * buildingBlock.heightHint + random.range(0, tall ? 70 : 18);
    const width = buildingBlock.w;
    const depth = buildingBlock.d;
    const material = tall ? materials.glass : (height > 38 ? materials.facadeMid : materials.facadeLow);
    const body = box(group, material, 0, height / 2, 0, width, height, depth);
    body.material = material;
    const capColor = tall ? '#547b86' : (plaza ? '#d8c9ac' : PALETTE.terracotta);
    box(group, shaded(capColor), 0, height + 0.9, 0, width + 2.5, 1.8, depth + 2.5);

    if (!tall) {
      const awning = shaded(district === 3 ? PALETTE.coral : PALETTE.terracotta);
      box(group, awning, 0, 5.2, depth / 2 + 1.6, width * 0.66, 0.5, 3.2);
      box(group, awning, 0, 5.2, -depth / 2 - 1.6, width * 0.66, 0.5, 3.2);
      if (random.chance(0.55)) box(group, materials.stone, width * 0.22, height + 3.4, -depth * 0.16, 6, 5, 6);
    } else {
      box(group, materials.glassBlue, 0, height + 5, 0, width * 0.18, 8, depth * 0.18);
      box(group, materials.light, width * 0.26, height + 2, depth * 0.2, 3, 2, 3);
    }
    group.position.set(buildingBlock.x, 0, buildingBlock.z);
    group.userData = { height, district, body };
    return group;
  }

  /** Flat road strip with the warm paving material. */
  function makeRoad(road) {
    const mesh = new THREE.Mesh(geometries.plane, materials.road);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(road.w, road.d, 1);
    mesh.position.set(road.x, 0.035, road.z);
    return mesh;
  }

  /** A palm: tapered trunk, six angled fronds and a small crown. */
  function makePalm(x, z) {
    const group = new THREE.Group();
    const height = random.range(9, 15);
    const trunk = new THREE.Mesh(geometries.cylinder, shaded('#b98052'));
    trunk.scale.set(0.62, height, 0.62);
    trunk.position.y = height / 2;
    group.add(trunk);
    const frondMaterial = shaded(random.chance(0.5) ? '#3f8a6a' : '#4f9c72');
    for (let i = 0; i < 6; i += 1) {
      const frond = new THREE.Mesh(geometries.cone, frondMaterial);
      const angle = (i / 6) * Math.PI * 2 + random.range(-0.2, 0.2);
      frond.scale.set(1.5, 5.2, 0.42);
      frond.position.set(Math.cos(angle) * 2.2, height + 0.4, Math.sin(angle) * 2.2);
      frond.rotation.set(Math.PI / 2.5 * Math.cos(angle), -angle, Math.PI / 2.5 * Math.sin(angle));
      group.add(frond);
    }
    group.add(box(group, shaded('#7a5a38'), 0, height + 0.4, 0, 1.6, 1.2, 1.6));
    group.position.set(x, 0, z);
    return group;
  }

  /** Low-poly cars with readable silhouettes, lamps and a police light bar. */
  function makeCar(kind) {
    const group = new THREE.Group();
    const palette = {
      sedan: '#d9c39b', van: '#c96f4a', taxi: '#ffd166', police: '#f4f0e6',
    };
    const paint = shaded(palette[kind] ?? palette.sedan);
    const dark = shaded(kind === 'police' ? '#1d3a56' : '#36535a');
    const long = kind === 'van' ? 7.2 : 5.6;
    const high = kind === 'van' ? 3.5 : 2.35;
    box(group, paint, 0, 1.35, 0, 2.8, 1.55, long);
    box(group, dark, 0, 2.5, kind === 'van' ? 0.4 : -0.3, 2.55, high - 1.5, long * 0.54);
    box(group, materials.light, -0.92, 1.42, long / 2 + 0.06, 0.56, 0.42, 0.14);
    box(group, materials.light, 0.92, 1.42, long / 2 + 0.06, 0.56, 0.42, 0.14);
    box(group, materials.brake, -0.92, 1.4, -long / 2 - 0.06, 0.5, 0.34, 0.12);
    box(group, materials.brake, 0.92, 1.4, -long / 2 - 0.06, 0.5, 0.34, 0.12);

    const wheels = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const wheel = new THREE.Mesh(geometries.wheel, materials.tyre);
        wheel.rotation.z = Math.PI / 2;
        wheel.scale.set(0.61, 0.3, 0.61);
        wheel.position.set(sx * 1.42, 0.62, sz * long * 0.32);
        group.add(wheel);
        wheels.push(wheel);
      }
    }
    if (kind === 'police') {
      box(group, materials.policeBlue, -0.55, 3.1, 0, 0.9, 0.3, 0.55);
      box(group, materials.policeRed, 0.55, 3.1, 0, 0.9, 0.3, 0.55);
    }
    if (kind === 'taxi') box(group, shaded(PALETTE.shadow), 0, 3.25, 0, 1.2, 0.4, 0.7);
    group.userData = { kind, wheels, long };
    return group;
  }

  /** Blocky pedestrians; silhouette and palette distinguish each role at a glance. */
  function makePed(kind) {
    const group = new THREE.Group();
    const colors = {
      civilian: ['#ffb37a', '#5c7f9c'],
      runner: ['#ff6b4a', '#f6efdc'],
      gangster: ['#8c3f36', '#202c38'],
      cop: ['#4a6f9a', '#1d3a56'],
      named: ['#ffd166', '#c96f4a'],
    };
    const [skin, shirt] = colors[kind] ?? colors.civilian;
    const scale = kind === 'gangster' ? 1.1 : 1;
    box(group, shaded(shirt), 0, 1.12 * scale, 0, 0.85 * scale, 1.25 * scale, 0.55 * scale);
    const head = new THREE.Mesh(geometries.sphere, shaded(skin));
    head.scale.setScalar(0.38 * scale);
    head.position.y = 2.05 * scale;
    group.add(head);
    box(group, shaded('#273945'), -0.22 * scale, 0.38, 0, 0.26, 0.78, 0.3);
    box(group, shaded('#273945'), 0.22 * scale, 0.38, 0, 0.26, 0.78, 0.3);
    if (kind === 'gangster') box(group, materials.coral, 0, 2.28 * scale, 0, 0.82, 0.2, 0.62);
    if (kind === 'cop') box(group, shaded(PALETTE.shadow), 0, 2.33 * scale, 0, 0.86, 0.16, 0.62);
    if (kind === 'named') box(group, materials.gold, 0, 2.36 * scale, 0, 0.86, 0.18, 0.62);
    group.userData = { kind };
    return group;
  }

  /** Gold objective column: an outer beam, a bright core, a ring and a floating crest. */
  function makeMarker() {
    const group = new THREE.Group();
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 4.6, 120, 8, 1, true), materials.beam);
    beam.position.y = 60;
    group.add(beam);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.8, 120, 8, 1, true), materials.beamCore);
    core.position.y = 60;
    group.add(core);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(7, 0.4, 6, 28), materials.gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.7;
    group.add(ring);
    const orb = new THREE.Mesh(geometries.sphere, materials.gold);
    orb.scale.setScalar(1.6);
    orb.position.y = 12;
    group.add(orb);
    const crest = new THREE.Mesh(new THREE.OctahedronGeometry(2.2, 0), materials.gold);
    crest.position.y = 22;
    group.add(crest);
    group.userData = { beam, core, ring, orb, crest };
    return group;
  }

  /** Short-lived particle burst for collisions, gunfire and vehicle explosions. */
  function makeExplosion(x, z) {
    const group = new THREE.Group();
    const parts = [];
    for (let i = 0; i < 14; i += 1) {
      const material = i % 3 === 0 ? materials.smoke : (i % 3 === 1 ? materials.gold : materials.coral);
      const mesh = new THREE.Mesh(geometries.sphere, material);
      const size = random.range(0.5, 1.7);
      mesh.scale.setScalar(size);
      mesh.position.set(0, random.range(0.6, 2), 0);
      group.add(mesh);
      parts.push({
        mesh,
        vx: random.range(-9, 9),
        vy: random.range(4, 14),
        vz: random.range(-9, 9),
      });
    }
    group.position.set(x, 0, z);
    group.userData = { parts, life: 1.5 };
    return group;
  }

  /** A readable helicopter with a spinning main rotor, tail rotor and skids. */
  function makeHelicopter(kind = 'civilian') {
    const group = new THREE.Group();
    const paint = shaded(kind === 'police' ? '#1d3a56' : '#f0e6cf');
    const trim = shaded(kind === 'police' ? '#e8ddc4' : PALETTE.coral);
    const body = new THREE.Mesh(geometries.sphere, paint);
    body.scale.set(2.4, 1.9, 4.4);
    body.position.y = 2.6;
    group.add(body);
    const canopy = new THREE.Mesh(geometries.sphere, materials.glassBlue);
    canopy.scale.set(2.05, 1.35, 2.1);
    canopy.position.set(0, 2.9, 2.25);
    group.add(canopy);
    box(group, paint, 0, 2.7, -5.1, 0.9, 0.85, 5.2);
    box(group, trim, 0, 3.35, -7.4, 0.35, 2.6, 0.35);

    const rotor = new THREE.Group();
    rotor.position.y = 4.9;
    box(rotor, shaded('#2b3942'), 0, 0, 0, 0.7, 0.22, 0.7);
    box(rotor, shaded('#2b3942'), 0, 0, 0, 14, 0.14, 0.55);
    box(rotor, shaded('#2b3942'), 0, 0, 0, 0.55, 0.14, 14);
    group.add(rotor);
    const tailRotor = new THREE.Group();
    tailRotor.position.set(0.45, 3.5, -7.3);
    box(tailRotor, shaded('#2b3942'), 0, 0, 0, 0.12, 3.8, 0.2);
    box(tailRotor, shaded('#2b3942'), 0, 0, 0, 0.12, 0.2, 3.8);
    group.add(tailRotor);
    for (const side of [-1, 1]) {
      box(group, shaded('#2b3942'), side * 1.7, 0.7, 0, 0.2, 0.2, 5.2);
      box(group, shaded('#2b3942'), side * 1.7, 1.5, -1.8, 0.18, 1.6, 0.18);
      box(group, shaded('#2b3942'), side * 1.7, 1.5, 1.8, 0.18, 1.6, 0.18);
    }
    if (kind === 'police') {
      box(group, materials.policeBlue, -0.8, 2.1, -1.2, 0.6, 0.3, 0.7);
      box(group, materials.policeRed, 0.8, 2.1, -1.2, 0.6, 0.3, 0.7);
    }
    group.userData = { rotor, tailRotor, kind };
    return group;
  }

  /** Traffic cone used to close a road at high wanted levels. */
  function makeCone(x, z) {
    const group = new THREE.Group();
    const cone = new THREE.Mesh(geometries.cone, shaded('#ff8a3d'));
    cone.scale.set(0.8, 1.7, 0.8);
    cone.position.y = 0.85;
    group.add(cone);
    box(group, shaded('#f6efdc'), 0, 0.12, 0, 1.5, 0.2, 1.5);
    group.position.set(x, 0, z);
    return group;
  }

  /** A lamp post with a warm glass head used along the boulevards. */
  function makeLamp(x, z) {
    const group = new THREE.Group();
    const post = new THREE.Mesh(geometries.cylinder, shaded('#43545a'));
    post.scale.set(0.16, 9, 0.16);
    post.position.y = 4.5;
    group.add(post);
    box(group, materials.light, 0, 9.2, 0, 1.5, 0.5, 1.5);
    group.position.set(x, 0, z);
    return group;
  }

  return {
    materials, textures, geometries,
    makeBuilding, makeRoad, makePalm, makeCar, makePed,
    makeMarker, makeExplosion, makeHelicopter, makeCone, makeLamp,
  };
}
