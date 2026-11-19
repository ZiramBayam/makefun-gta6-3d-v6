// One tuning table for the whole world: simulation rate, city grid, palette, districts and jobs.
// Every value here is authored and fixed; the seeded generator reads them but never changes them.

export const SEED = 20261118;

/** The simulation advances in exact sixtieths of a second, never in wall-clock slices. */
export const STEP = 1 / 60;

/** A tab that was backgrounded may hand back a long frame; cap the catch-up work. */
export const MAX_FRAME = 0.25;

export const VIEW = { width: 1280, height: 720 };

export const SAVE_KEY = 'cielo-bay-3d-save';

export const CITY = { block: 160, cols: 9, rows: 9, harborX: 6, harborZ: 2 };

export const PALETTE = {
  ivory: '#e8ddc4',
  terracotta: '#c96f4a',
  coral: '#ff6b4a',
  sea: '#5ce0c6',
  glass: '#7fb8c9',
  shadow: '#071a24',
  gold: '#ffd166',
  paper: '#f6efdc',
  stone: '#b9a988',
  ink: '#142a33',
};

export const DISTRICTS = [
  { name: 'Marisol Rows', color: '#c96f4a' },
  { name: 'Palma Vista', color: '#e6a16b' },
  { name: 'Puerto Alto', color: '#d9c39b' },
  { name: 'Coral Causeway', color: '#ff6b4a' },
  { name: 'Old Customs House', color: '#b96f52' },
  { name: 'Solano Plaza', color: '#e8ddc4' },
  { name: 'Glass Mile', color: '#7fb8c9' },
  { name: 'Seawall South', color: '#5ce0c6' },
];

/** Eight linked jobs, each with its own contact, objective type and payment. */
export const MISSIONS = [
  {
    title: 'First Light',
    brief: 'Nia Vale left a courier packet in Marisol Rows. Collect it and deliver it to the plaza bench.',
    reward: 450,
    kind: 'delivery',
    contact: 'Nia Vale',
  },
  {
    title: 'Vanishing Van',
    brief: 'Rafa Solis wants the harbor van back. Two crew are guarding it. Take the van, lose the heat.',
    reward: 900,
    kind: 'theft',
    contact: 'Rafa Solis',
  },
  {
    title: 'Causeway Runner',
    brief: 'Ines Marlow spotted a runner on Coral Causeway. Catch him before he reaches the seawall.',
    reward: 1100,
    kind: 'chase',
    contact: 'Ines Marlow',
  },
  {
    title: 'Palm Shadow',
    brief: 'Detective Ada Cruz needs a fast car at the garage on Palma Vista. Bring one in.',
    reward: 1300,
    kind: 'drive',
    contact: 'Ada Cruz',
  },
  {
    title: 'Tide Ledger',
    brief: 'Marisol Reyes has a ledger hidden by the old customs dock. Collect it before the tide turns.',
    reward: 1500,
    kind: 'pickup',
    contact: 'Marisol Reyes',
  },
  {
    title: 'Glass Mile Sprint',
    brief: 'Dante Ibarra dares you to run the Glass Mile in under a minute. Reach the tower mark.',
    reward: 1800,
    kind: 'race',
    contact: 'Dante Ibarra',
  },
  {
    title: 'Customs Break',
    brief: 'Ada Cruz has a warrant. Clear the three crew at the Customs House and secure the office.',
    reward: 2400,
    kind: 'fight',
    contact: 'Ada Cruz',
  },
  {
    title: 'Sunset Verdict',
    brief: 'The last four crew are waiting at Solano Plaza. End it there, in the last of the sun.',
    reward: 4000,
    kind: 'showdown',
    contact: 'Ada Cruz',
  },
];

/** Button identities shared by the renderer's click targets and the DOM HUD. */
export const BUTTON_IDS = ['play', 'continue', 'controls', 'back', 'resume', 'save', 'mute', 'restart'];

/** Radius, in world units, of the gold objective's collection circle. */
export const OBJECTIVE_RADIUS = 13;
