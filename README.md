# Mahjong Solitaire

A classic mahjong solitaire (pair-matching) game in pure HTML, CSS, and JavaScript.
No frameworks, no build step, no runtime dependencies — and it runs fully offline.

## Features

- **8 layouts** — Pyramid, Turtle, Cross, Wall, Boat, Butterfly, Heart, Spider
- **144 canonical tiles** — dots, bamboo, characters, winds, dragons, flowers, seasons
- **Two modes** — Classic (pick a layout, clear it, win) and Endless (layouts chain one after another, score accumulates)
- **3 themes** — Traditional (ivory, dark wood, gold), Jade (pastel marble), Porcelain (vintage blue and gold)
- **Hint, undo, shuffle** — no penalties in Endless mode; dead-end positions are reshuffled automatically
- **Autosave** — close the tab mid-game and continue later
- **Statistics** — games played, wins, best score
- **Sound** — generated via the Web Audio API, no audio files
- **Accessibility** — three tile sizes up to "Maximum" (tiles scale to fill the screen for low-vision players), configurable blocked-tile transparency (0–50%), free tiles are always opaque, `prefers-reduced-motion` supported

## Quick start

1. Clone or download this repository.
2. Open `index.html` in any modern browser. No server, no build.
3. Optional: install as a PWA for a standalone offline window (Chrome → install icon in the address bar, or run `Маджонг.bat` on Windows).

## Controls

| Key | Action |
| --- | ------ |
| `Esc` | Pause |
| `H` | Hint |
| `S` | Shuffle |
| `Z` | Undo |

## Testing

```bash
node tests/run.js
```

288 dependency-free assertions (Node.js only) cover layouts, the tile set, game logic, scaling math, storage, and appearance settings. GitHub Actions runs the suite on every push — see `.github/workflows/tests.yml`.

## Project structure

```
mahjong/
├── index.html          Entry point
├── manifest.json       PWA manifest
├── sw.js               Service worker (offline cache)
├── Маджонг.bat         Windows launcher
├── css/
│   ├── main.css        Screens, menu, buttons
│   ├── tiles.css       Tile rendering
│   └── themes.css      The three themes
├── js/
│   ├── tileset.js      144 tiles and matching rules
│   ├── layouts.js      The 8 layouts
│   ├── game.js         Game logic
│   ├── render.js       Rendering and scaling
│   ├── audio.js        Web Audio sound effects
│   ├── storage.js      Settings and progress persistence
│   ├── app.js          UI controller
│   └── sw-register.js  Service worker registration
├── tests/              Zero-dependency test suite
└── icons/              App icons
```

## Adding a custom layout

Add an object to the `all` array in `js/layouts.js`:

```js
const myLayout = {
  id: 'mylayout',
  name: 'My Layout',
  description: 'Description',
  difficulty: 'easy', // easy | normal | hard
  icon: '★',
  layers: [
    // Each layer is an array of strings.
    // 'X' = tile, ' ' or '.' = empty
    [
      'XXX',
      'XXX',
      'XXX',
    ],
    [
     ' X ',
    ],
  ],
};
```

The number of `X` per layout must be even (tiles are removed in pairs). Layers are centered automatically.

## Implementation notes

- ~80 KB total (HTML + CSS + JS); loads instantly
- DOM/CSS rendering — smooth on weak GPUs, no canvas required
- Screen switching is driven by `body[data-screen]`; every screen has an opaque background, so no layers bleed through
- Tile scaling derives from the available stage area, so the board always fits the viewport at any size
- The service worker caches all assets after the first load; subsequent runs are fully offline
