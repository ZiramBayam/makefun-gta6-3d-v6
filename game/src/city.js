// The city is a measured nine-by-nine grid: streets, sidewalks, a harbor cut out of the
// south-east corner, eight named districts and six walkable objective intersections.
// Nothing here reads a clock or an external asset; the same seed always draws the same map.

import { CITY, DISTRICTS } from './config.js';

/** Which of the eight districts owns a grid cell. */
function districtAt(col, row) {
  if (col >= CITY.harborX && row >= 6) return 7;      // Seawall South
  if (col >= CITY.harborX && row >= 3) return 6;      // Glass Mile
  if (row >= 6) return 3;                             // Coral Causeway
  if (col >= CITY.harborX) return 2;                  // Puerto Alto
  if (col <= 2 && row <= 2) return 0;                 // Marisol Rows
  if (row <= 2) return 1;                             // Palma Vista
  if (col <= 2) return 4;                             // Old Customs House
  return 5;                                           // Solano Plaza
}

/** Build all static city data from the seeded source. */
export function createCity(random) {
  const { block, cols, rows, harborX, harborZ } = CITY;
  const width = cols * block;
  const depth = rows * block;
  const halfW = width / 2;
  const halfD = depth / 2;
  const roadWidth = 28;
  const inset = 16;

  const gridX = Array.from({ length: cols + 1 }, (_, i) => i * block - halfW);
  const gridZ = Array.from({ length: rows + 1 }, (_, i) => i * block - halfD);
  const harborRowStart = rows - 1 - harborZ;
  const harbor = {
    x: (gridX[harborX] + gridX[cols]) / 2,
    z: (gridZ[harborRowStart] + gridZ[rows]) / 2,
    w: (cols - harborX) * block,
    d: (rows - harborRowStart) * block,
  };

  const districts = DISTRICTS.map((d) => ({ name: d.name, color: d.color }));
  const roads = [];
  const blocks = [];
  const parks = [];
  const piers = [];

  // Main streets and their thin lane edging. The wider central axes read as boulevards.
  for (let i = 0; i <= cols; i += 1) {
    const gx = gridX[i];
    const mainWidth = gx === 0 ? 48 : (Math.abs(gx) === 320 ? 34 : roadWidth);
    roads.push({ x: gx, z: 0, w: mainWidth, d: depth, axis: 'z' });
    roads.push({ x: gx + mainWidth / 2 + 3, z: 0, w: 3, d: depth, axis: 'z' });
  }
  for (let j = 0; j <= rows; j += 1) {
    const gz = gridZ[j];
    const mainWidth = gz === 0 ? 48 : (Math.abs(gz) === 320 ? 34 : roadWidth);
    roads.push({ x: 0, z: gz, w: width, d: mainWidth, axis: 'x' });
    roads.push({ x: 0, z: gz + mainWidth / 2 + 3, w: width, d: 3, axis: 'x' });
  }

  for (let col = 0; col < cols; col += 1) {
    for (let row = 0; row < rows; row += 1) {
      const x = gridX[col] + block / 2;
      const z = gridZ[row] + block / 2;
      const district = districtAt(col, row);
      const inHarbor = col >= harborX && row >= harborRowStart;
      let kind = 'building';
      if (inHarbor) kind = 'pier';
      else if ((col === 4 && row === 4) || (col === 2 && row === 5)) kind = 'plaza';
      else if ((col * 7 + row * 11 + random.int(0, 3)) % 17 === 0) kind = 'park';

      const cityBlock = {
        x,
        z,
        w: block - inset,
        d: block - inset,
        district,
        kind,
        heightHint: random.range(0.72, 1.18),
        tint: random.range(0.86, 1.1),
      };
      blocks.push(cityBlock);
      if (kind === 'park') parks.push({ x, z, w: cityBlock.w, d: cityBlock.d });
      if (kind === 'pier' && row === harborRowStart) piers.push({ x, z, w: cityBlock.w, d: block * 1.4 });
    }
  }

  const landmarks = [
    { name: 'Old Customs House', x: gridX[2], z: gridZ[5], color: '#b96f52' },
    { name: 'Solano Plaza', x: gridX[4], z: gridZ[4], color: '#e8ddc4' },
    { name: 'Glass Mile', x: gridX[7], z: gridZ[2], color: '#7fb8c9' },
    { name: 'Seawall South', x: harbor.x, z: harbor.z, color: '#5ce0c6' },
  ];

  // Objective points sit on intersections, never at the centre of a solid block.
  const objectiveSpots = {
    pickup: { x: gridX[2] + 8, z: gridZ[2] + 8 },
    deliver: { x: gridX[4] + 8, z: gridZ[4] + 8 },
    van: { x: gridX[7], z: gridZ[7] },
    garage: { x: gridX[3] + 8, z: gridZ[6] + 8 },
    runner: { x: gridX[8] - 8, z: gridZ[3] + 8 },
    plaza: { x: gridX[4] + 8, z: gridZ[5] + 8 },
  };

  // Later jobs need their own destinations but the canonical six keys stay untouched.
  const missionSpots = {
    customs: { x: gridX[2], z: gridZ[5] },
    ledger: { x: gridX[6], z: gridZ[7] },
    tower: { x: gridX[8] - 8, z: gridZ[2] + 8 },
    finale: { x: gridX[5], z: gridZ[5] },
  };

  const spawn = { x: gridX[2], z: gridZ[5] };

  return {
    width, depth, districts, roads, blocks, harbor, parks, piers,
    landmarks, spawn, objectiveSpots, missionSpots,
  };
}
