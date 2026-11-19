[![Cielo Bay competition badge](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Cielo Bay live rank](https://make.fun/badge/gta6-01/ZiramBayam/makefun-gta6-3d-v6/rank.svg)](https://make.fun/bounty/gta6-01)
[![Cielo Bay live reward](https://make.fun/badge/gta6-01/ZiramBayam/makefun-gta6-3d-v6/reward.svg)](https://make.fun/bounty/gta6-01)

# Cielo Bay: Solar Noir

An original, offline, third-person open-world crime game built for the [make.fun open-world crime bounty](https://make.fun/bounty/gta6-01). Explore eight sunlit districts, steal cars, fly the helicopter, outrun five-star police with roadblocks and an air unit, buy garage upgrades, tune the radio and work eight linked story jobs across a single long afternoon.

[Refer a builder to make.fun](https://make.fun/r/zirambayam) and join the open leaderboard.

## Play locally

```sh
node serve.ts
```

Open the local address printed by the server in a desktop browser. No build step, installation, account or network connection is needed to play: Three.js r160 is vendored as a minified file, and every texture, model and sound is generated at runtime.

## Controls

WASD moves and drives, the mouse looks, left click fires and right click aims. E enters or leaves vehicles and the helicopter; Q or 1–4 switch between the pistol, SMG, shotgun and rifle. R cycles three procedural radio stations, T toggles haze and rain, F2 raises the wanted level, F3 moves near the current job marker, and P or Escape pauses. The HUD shows the job counter, health, armor, ammo, wanted stars, current station, garage levels and a live minimap.

## Packaging

`node main.ts` copies `game/` and the four real browser screenshots in `screenshots/` to the output directory and writes `dossier.json` with the unchanged vendored library. The packaging step uses only the Node standard library and writes the same bytes on every run.
