// Thin project-facing wrapper for the 3D renderer. Keeping the boot sequence pointed at one
// named entry makes it obvious where pixels are produced and where camera state is held.

import { createRenderer } from './render3d.js';

/** Build the WebGL renderer used by the game loop. */
export function createGameRenderer(canvas, city, assets) {
  return createRenderer(canvas, city, assets);
}
