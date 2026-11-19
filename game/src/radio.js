// Three procedurally composed radio stations. Each station is a small pattern recipe that the
// WebAudio module turns into bass, chords and a lead; there are no audio files to fetch.

export const STATIONS = [
  {
    name: 'Solar FM', bpm: 112, root: 220,
    chords: [0, 5, 7, 3], scale: [0, 2, 4, 7, 9],
    bassWave: 'triangle', leadWave: 'square', leadGain: 0.035,
    description: 'Bright afternoon pop for the long drive.',
  },
  {
    name: 'Harbor Waves', bpm: 84, root: 165,
    chords: [0, 3, 7, 5], scale: [0, 3, 5, 7, 10],
    bassWave: 'sine', leadWave: 'triangle', leadGain: 0.045,
    description: 'Slow brass and salt air off the docks.',
  },
  {
    name: 'Causeway Country', bpm: 128, root: 196,
    chords: [0, 4, 7, 9], scale: [0, 2, 4, 5, 7, 9],
    bassWave: 'sawtooth', leadWave: 'triangle', leadGain: 0.03,
    description: 'A highway rhythm with a sunset twang.',
  },
];

/** Station name for the HUD, wrapped for the cycle key. */
export function stationAt(index) {
  return STATIONS[((index % STATIONS.length) + STATIONS.length) % STATIONS.length];
}
