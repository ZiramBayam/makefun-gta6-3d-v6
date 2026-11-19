// Garage upgrades spend mission money on lasting vehicle and weapon improvements.

export const UPGRADES = [
  { key: 'engine', label: 'ENGINE', effect: 'Top speed', costs: [500, 1100, 2000] },
  { key: 'armor', label: 'ARMOR', effect: 'Damage resistance', costs: [600, 1300, 2200] },
  { key: 'capacity', label: 'GUNS', effect: 'Ammo capacity', costs: [450, 1000, 1800] },
];

/** Cost of the next level, or null when already at maximum. */
export function nextCost(definition, level) {
  return level < definition.costs.length ? definition.costs[level] : null;
}

/** Apply a purchase. Returns the new level, or the old level when money is short. */
export function purchase(definition, level, money) {
  const cost = nextCost(definition, level);
  if (cost === null || money < cost) return { level, spent: 0 };
  return { level: level + 1, spent: cost };
}
