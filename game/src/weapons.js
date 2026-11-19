// Four distinct weapons. The first is the starting sidearm; the rest come from pickups and
// garage capacity upgrades. Rates are seconds between shots, damage is per hit and spread is
// the angular tolerance of the hitscan ray.

export const WEAPONS = [
  {
    name: 'Pistol', label: 'PISTOL', fireRate: 0.24, damage: 26, spread: 0.035,
    magazine: 12, reserve: 96, range: 95, pellets: 1, tracer: '#ffd166',
  },
  {
    name: 'SMG', label: 'SMG', fireRate: 0.075, damage: 13, spread: 0.085,
    magazine: 32, reserve: 240, range: 70, pellets: 1, tracer: '#5ce0c6',
  },
  {
    name: 'Shotgun', label: 'SHOTGUN', fireRate: 0.72, damage: 13, spread: 0.19,
    magazine: 8, reserve: 60, range: 38, pellets: 6, tracer: '#ff6b4a',
  },
  {
    name: 'Rifle', label: 'RIFLE', fireRate: 0.36, damage: 58, spread: 0.012,
    magazine: 10, reserve: 70, range: 160, pellets: 1, tracer: '#7fb8c9',
  },
];

/** Cycle to the next owned weapon, wrapping at the end of the list. */
export function nextWeapon(index, owned) {
  for (let step = 1; step <= WEAPONS.length; step += 1) {
    const candidate = (index + step) % WEAPONS.length;
    if (owned[candidate]) return candidate;
  }
  return index;
}

/** Ammo capacity after a garage weapon upgrade. */
export function capacityFor(weapon, level) {
  return weapon.magazine + level * Math.ceil(weapon.magazine * 0.35);
}
