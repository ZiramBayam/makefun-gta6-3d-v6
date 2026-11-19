// Photo-mode staging. The four submitted images are staged by driving the real world controller
// into genuine game states; this module only names those states and returns the live objective.

/** Put the world into a readable in-game scene and report the marker the HUD should show. */
export function stagePhotoMode(world, name) {
  world.photoScene(name);
  return world.objective();
}
