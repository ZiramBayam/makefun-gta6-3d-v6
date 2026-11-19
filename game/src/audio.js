// WebAudio-only sound. No sample is fetched: engines, sirens, radio and effects are synthesised
// from oscillators and a tiny generated noise buffer. Everything is created after a user gesture.

import { STATIONS } from './radio.js';

/** Open a small synthesis graph, with a safe null-object when WebAudio is unavailable. */
export function createAudio() {
  let context = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicGain = null;
  let noise = null;
  let nextNote = 0;
  let step = 0;
  let enabled = true;

  function ensure() {
    if (context || typeof window === 'undefined') return context;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return null;
    try {
      context = new Audio();
      master = context.createGain();
      master.gain.value = enabled ? 0.65 : 0;
      master.connect(context.destination);

      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter).connect(engineGain).connect(master);
      engineOsc.start();

      sirenOsc = context.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 620;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain).connect(master);
      sirenOsc.start();

      musicGain = context.createGain();
      musicGain.gain.value = 0.45;
      musicGain.connect(master);

      noise = context.createBuffer(1, Math.floor(context.sampleRate * 0.5), context.sampleRate);
      const data = noise.getChannelData(0);
      let seed = 48271;
      for (let i = 0; i < data.length; i += 1) {
        seed = (seed * 16807) % 2147483647;
        data[i] = (seed / 1073741823.5 - 1) * (1 - i / data.length);
      }
      nextNote = context.currentTime + 0.1;
    } catch {
      context = null;
    }
    return context;
  }

  function tone(frequency, duration, type = 'sine', volume = 0.16, slide = 0) {
    if (!context || !enabled) return;
    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, frequency + slide), now + duration);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain).connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function burst(duration = 0.22, volume = 0.3, cutoff = 900) {
    if (!context || !noise || !enabled) return;
    const now = context.currentTime;
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter).connect(gain).connect(master);
    source.start(now);
  }

  const SOUNDS = {
    shoot: () => { tone(360, 0.09, 'square', 0.1, -210); burst(0.07, 0.16, 1600); },
    hit: () => tone(680, 0.07, 'triangle', 0.09, -300),
    melee: () => burst(0.12, 0.22, 500),
    explosion: () => { burst(0.5, 0.46, 420); tone(74, 0.45, 'sawtooth', 0.24, -40); },
    crash: () => { burst(0.28, 0.34, 700); tone(130, 0.2, 'square', 0.1, -60); },
    enterCar: () => tone(180, 0.14, 'square', 0.1, 90),
    enterHeli: () => { tone(160, 0.16, 'sawtooth', 0.11, 80); tone(320, 0.22, 'triangle', 0.07, 90); },
    wanted: () => { tone(540, 0.16, 'square', 0.1, 120); tone(720, 0.2, 'square', 0.08, -140); },
    roadblock: () => { tone(310, 0.25, 'square', 0.1, 110); },
    missionStart: () => { tone(440, 0.12, 'triangle', 0.12, 220); },
    stage: () => { tone(520, 0.1, 'triangle', 0.1, 160); },
    missionComplete: () => { tone(523, 0.16, 'triangle', 0.14); tone(784, 0.26, 'triangle', 0.13); },
    win: () => { tone(523, 0.2, 'triangle', 0.16); tone(659, 0.3, 'triangle', 0.13); tone(784, 0.45, 'triangle', 0.12); },
    cash: () => { tone(880, 0.08, 'square', 0.1); tone(1180, 0.12, 'square', 0.08); },
    pickup: () => tone(640, 0.14, 'triangle', 0.12, 260),
    upgrade: () => { tone(392, 0.12, 'sawtooth', 0.11); tone(587, 0.2, 'triangle', 0.1); },
    reload: () => burst(0.1, 0.16, 2200),
    dryFire: () => tone(180, 0.05, 'square', 0.06),
    enemyFire: () => tone(250, 0.08, 'square', 0.06, -120),
    hurt: () => tone(160, 0.16, 'sawtooth', 0.1, -80),
    radio: () => tone(660, 0.08, 'sine', 0.09, 220),
    busted: () => tone(220, 0.5, 'sawtooth', 0.15, -140),
  };

  function playStep(station, index) {
    const now = context.currentTime;
    const beat = 60 / station.bpm / 2;
    const chord = station.chords[Math.floor(index / 8) % station.chords.length];
    const root = station.root * Math.pow(2, chord / 12);
    const bass = context.createOscillator();
    const bassGain = context.createGain();
    bass.type = station.bassWave;
    bass.frequency.value = root / 2;
    bassGain.gain.setValueAtTime(0.16, now);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + beat * 0.85);
    bass.connect(bassGain).connect(musicGain);
    bass.start(now); bass.stop(now + beat);

    if (index % 2 === 1) {
      const note = station.scale[(index * 3 + Math.floor(index / 8)) % station.scale.length];
      const lead = context.createOscillator();
      const leadGain = context.createGain();
      lead.type = station.leadWave;
      lead.frequency.value = root * Math.pow(2, note / 12) * 2;
      leadGain.gain.setValueAtTime(station.leadGain, now);
      leadGain.gain.exponentialRampToValueAtTime(0.001, now + beat * 0.7);
      lead.connect(leadGain).connect(musicGain);
      lead.start(now); lead.stop(now + beat);
    }
    if (index % 4 === 0) {
      const pad = context.createOscillator();
      const padGain = context.createGain();
      pad.type = 'sine';
      pad.frequency.value = root * 1.5;
      padGain.gain.setValueAtTime(0.045, now);
      padGain.gain.exponentialRampToValueAtTime(0.001, now + beat * 3.6);
      pad.connect(padGain).connect(musicGain);
      pad.start(now); pad.stop(now + beat * 4);
    }
  }

  return {
    get enabled() { return enabled; },
    resume() {
      const ctx = ensure();
      if (ctx?.state === 'suspended') ctx.resume().catch(() => {});
      return !!ctx;
    },
    sfx(name) {
      if (!ensure()) return;
      const play = SOUNDS[name];
      if (play) play();
    },
    /** Drive the engine, siren and the three procedural radio patterns. */
    update(dt, ctx) {
      const audio = ensure();
      if (!audio) return;
      const state = ctx?.state ?? {};
      const playing = ctx?.screen === 'play';
      const speed = Math.abs(state.player?.speed ?? 0);
      const flying = !!state.player?.flying;
      engineOsc.frequency.setTargetAtTime(flying ? 170 : 48 + speed * 3.4, audio.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(playing && !state.player?.onFoot ? 0.075 : flying ? 0.09 : 0,
        audio.currentTime, 0.1);
      const wanted = state.wanted ?? 0;
      sirenOsc.frequency.setTargetAtTime(620 + Math.sin(audio.currentTime * 5) * 190, audio.currentTime, 0.05);
      sirenGain.gain.setTargetAtTime(playing && wanted > 0 ? 0.055 : 0, audio.currentTime, 0.12);

      const station = STATIONS[state.radioIndex ?? 0] ?? STATIONS[0];
      const interval = 60 / station.bpm / 2;
      if (audio.currentTime >= nextNote) {
        if (playing || ctx?.screen === 'title') playStep(station, step);
        step += 1;
        nextNote = Math.max(nextNote + interval, audio.currentTime + interval * 0.5);
      }
      void dt;
    },
    setEnabled(on) {
      enabled = !!on;
      if (context && master) master.gain.setTargetAtTime(enabled ? 0.65 : 0, context.currentTime, 0.05);
      return enabled;
    },
  };
}
