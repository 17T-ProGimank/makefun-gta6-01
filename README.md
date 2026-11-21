# SOLMARA — GTA 6-style open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![Rank](https://make.fun/badge/gta6-01/17T-ProGimank/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![Reward](https://make.fun/badge/gta6-01/17T-ProGimank/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

A 3D open-world crime game built with three.js for the [make.fun gta6-01 bounty](https://make.fun/bounty/gta6-01). Drive, fight, and climb the ranks in the original coastal city of **SOLMARA** — bay and beaches to the south, downtown towers, the eastern port, and the northern hills — all in golden-hour light with a chase camera.

You play **Dante Reyes**, a fixer-driven wheelman working jobs for **Mara Voss**. Nine chained missions take you from your first getaway to a bank heist and the title of SOLMARA LEGEND, while the SMPD hunts you with a 5-star wanted system, the AIR-1 helicopter, and roadblocks.

Referral: https://make.fun/r/m4psg5rh (code `m4psg5rh`)

## How to play

Open `game/index.html` in a desktop browser, or serve the folder:

```bash
npx serve game
```

## Controls

- **W / A / S / D** — drive / move
- **Space** — handbrake
- **E** — enter / exit vehicle
- **Mouse** — look around (chase camera follows the car)
- **F** — shoot (on foot, hitscan combat vs Vultures gang)
- **R** — radio (3 stations)
- **Esc / P** — pause menu

## Features

- 3D open world (three.js, vendored) with golden-hour lighting and chase cam
- Original city SOLMARA: bay, south beach, downtown, eastern port, northern hills
- 9 chained story missions (Dante Reyes / Mara Voss), payouts up to $5,000
- SMPD 5-star wanted system + AIR-1 helicopter + roadblocks
- Full HUD: wanted stars, circular minimap, money, objective banner, health, speed, clock
- Traffic (14 cars) and pedestrians (22) on the streets
- Combat: hitscan shooting against Vultures gang members
- Save system (localStorage + auto-save)
- Synthesized WebAudio sound + 3 radio stations
- Start / pause / game-over menus, explosion, smoke, and camera-shake effects

## Screenshots

See `screenshots/` — a wanted-3 police chase with a roadblock, the bank heist (+$5,000), a beach sunset drive, and an aerial view of downtown SOLMARA.

## License

MIT — see [LICENSE](LICENSE).
