# Sunvale

A cozy pixel-art farming game built with vanilla JavaScript and HTML5 Canvas. No frameworks, no build tools, no external assets.

## Features

- Farming, mining, and foraging
- NPC relationships and story progression
- Day/night cycles and weather
- Save/load via localStorage
- Generative audio and SFX (WebAudio)
- Pixel-art sprites generated at runtime

## Running

Open `index.html` directly in a browser, or serve the folder:

```bash
npx http-server .
# or
python -m http.server
```

## Controls

- **WASD / Arrow Keys** — Move
- **E / Space** — Interact
- **Enter** — Confirm
- **Mouse** — UI interaction

## Project Structure

| File | Purpose |
|------|---------|
| `index.html` | Entry point, script load order |
| `js/art-data.js` | ASCII pixel-art grids + palettes |
| `js/data.js` | Tunables, items, crops, NPC defs, story |
| `js/story.js` | Chapter + objective state machine |
| `js/sprites.js` | Canvas sprite builder + bitmap font |
| `js/world.js` | Procedural maps, tiles, collision, save |
| `js/entities.js` | Player, particles, NPC/chicken AI |
| `js/audio.js` | WebAudio SFX + generative music |
| `js/game.js` | Core state machine: time, money, inventory |
| `js/render.js` | 2D canvas renderer: camera, lighting, weather |
| `js/ui.js` | Canvas-drawn HUD/menus |
| `js/main.js` | Input, boot, RAF loop |
| `tools/` | Dev utilities (preview, sprite sheet) |

## License

MIT
