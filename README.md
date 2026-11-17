# solmar-heat

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/cendelobening/solmar-heat/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/cendelobening/solmar-heat/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLMAR HEAT is an original open-world crime game set in Solmar Bay, a sun-soaked coastal city you explore on foot and by car: steal cars, outrun the Solmar PD through a five-star wanted system, take on five story jobs for Rico Vane, and pull off the Big Score — built as static files with no build step and no network requests.

## Run it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=jme44qjv&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>

## The game

You are **Jax Marlowe**, a wheelman new in Solmar Bay. **Rico Vane** has five jobs for you:

1. **First Wheels** — steal a car and bring it to Rico's Garage.
2. **The Package** — pick up at Marina Market, deliver to the Grand Casino, on the clock.
3. **Getaway Driver** — pick up Lena at Bay Tower, lose the cops, reach the Hideout.
4. **Heat Wave** — survive a full police hunt, then lay low.
5. **The Big Score** — hit the Bay Bank vault and escape to Solmar Pier with the whole city on your tail.

- **Open world:** a seeded grid city with five districts (Marina Bay, Old Town, Downtown, Harbour South, Palm Hills), a beach and the sea, parks, palms, and landmarks — Solmar Pier, Bay Tower, the Grand Casino, Bay Bank, Sunset Stadium.
- **On foot and by car:** walk or run, steal any parked or traffic car with E, drive with arcade handling, crash damage, and traffic that flows along the avenues.
- **Wanted level:** stars 1–5. Stealing, shooting, and hitting pedestrians raise the heat; Solmar PD cruisers chase and ram you, and the heat only cools when you stay out of sight.
- **Combat:** mouse aim, click to shoot. Bullets damage police cruisers, traffic cars, and pedestrians (and raise the heat).
- **HUD + minimap:** health, cash, wanted stars, the current job objective, a live minimap with the mission marker and police positions, and an off-screen direction arrow.
- **Sound:** everything synthesized with WebAudio — engine hum, two-tone sirens, gunshots, and a funk bass groove. No audio files.
- **Save:** progress (money, jobs, position, health) autosaves to localStorage; continue from the title screen.

## Controls

WASD move / drive · Shift run · E enter & exit cars · mouse aim, click shoot · P pause · S save now · R restart story · M mute · Enter start / retry.

## Play locally

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

`?shot=start|street|drive|chase&seed=N` renders a deterministic capture frame from real gameplay and sets `window.__shotReady`.

## Hand in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.
