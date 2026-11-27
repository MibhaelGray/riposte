# RIPOSTE — a duel to the bell

A one-hit-kill sword-duel platformer that runs in the browser. Climb 24 landings of a ruined bell tower, from the outer gate through the Foundry and above the storm to the bell. One touch of a blade kills, you included. After every landing you take one relic out of three, so each run builds differently, and the enemies get sharper the higher you go.

## Play

**Play it in your browser: <https://mibhaelgray.github.io/riposte/>** (keyboard needed).

To run it on your own computer instead, you need Python 3 (macOS already has it). In this folder, run:

```bash
python3 serve.py 8123
```

Then open <http://localhost:8123>.

## Controls

| Key | Action |
| --- | --- |
| A / D or ← / → | Move |
| W / S or ↑ / ↓ | Raise / lower your guard (high, mid, low) |
| Space or Z | Jump (DOWN + J in the air plunges) |
| S S (tap DOWN twice) | Drop through the ledge you're standing on |
| J or X | Thrust (hold to feint). Without a sword: a random punch or kick, and three blows knock someone out |
| U | Slash |
| L or I | Heavy lunge |
| O | Parry. Answer with J for the riposte |
| K or C | Throw your sword |
| E or F | Hurl a nearby pot, bottle, skull, stool or lantern |
| Shift or V | Back-step (with a direction: roll, which nothing can touch) |
| Tab (hold) | Show your build |
| 1 / 2 / 3 | Pick a relic |
| Esc or P | Pause |
| R | Restart the run |
| T | Practice arena |
| M | Mute |

## Files

- `index.html`, `game.js`: the whole game
- `serve.py`: a tiny local server that stops the browser caching old versions
- `tests/checks.js`: about 390 automated checks, run inside the game page
- `3d.html`, `view3d.js`: an experimental 3D view of the same game (shelved; needs internet for three.js)
- `game.v1.js`, `game.v2.js`: early versions, kept for history
