# Mahjong Solitaire

A classic mahjong solitaire (pair-matching) game in pure HTML, CSS, and JavaScript.
No frameworks, no build step, no runtime dependencies — and it runs fully offline.

## Features

- **Settings as a real screen with a live preview (v38)** — the settings are no longer a narrow centered column: it is now a wide two-column screen. The left side holds the setting groups; the right side is a little "monitor" — a mini table with real tiles on themed felt (frame, woven cloth, gold inlay — all colors from the current theme). The scene demonstrates every tile-frame setting with genuine `.tile` elements, the very same classes and CSS variables the game uses: a free tile (highlight level), a blocked tile (transparency slider), a selected tile resting on top of a covered one (selection style), its dashed twin (match candidates), and a hint pair joined by the running dashed line (hint style). Change any setting and the mini-screen updates instantly (a `mahjong:settings` event from `js/app/options.js` / `settings.js`); switching the tile skin redraws the faces; a live legend below the screen names what is currently on. On narrow screens the preview moves above the settings; `prefers-reduced-motion` and lite graphics calm its animations.
- **28 layouts** — 8 base + 8 canonical v18 + 4 v22 + 8 v28: Pyramid, Turtle, Cross, Wall, Boat, Butterfly, Heart, Spider, Fortress, Tower, Bridge, Cloud, Pagoda, Crystal, Star, Flower, Dragon, Fan, Labyrinth, Square, Crown, Hourglass, Mushroom, Fish, Stairs, Barrel, Lighthouse, Ornament
- **Built-in tutorial** — a simple 6-step "How to play" walkthrough with mini-tile diagrams (goal, matching pairs, free vs. blocked tiles, how to tell layers apart, helper buttons); opens automatically on first launch, reopens from the main menu, and the final "Play!" button starts the easy Pyramid layout
- **5 tile sizes (v19)** — Tiny / Small / Medium / Large (default) / Extra-large, switchable in Settings or via `+` / `−` keys / zoom button during play
- **144 canonical tiles** — dots, bamboo, characters, winds, dragons, flowers, seasons
- **Two switchable tile skins (v19-skins)** — Classic (clean minimal, no gold frames, the default) and Ornate (ultra-traditional: golden engraved frame with corner pearls, soft inner glow, gradient-shaded symbols with stroke highlights). Pick one in Settings → "Tile skin"; the board re-renders live, even mid-game.
- **Music collection (v26-audio)** — a collection of 7 composed pieces synthesized live via the Web Audio API (no audio files): each has its own key, tempo, 8-bar harmony, three melodic motifs and an A–B–A–C form, with bass, pad, arpeggio, light human timing and ornaments on repeats. Every theme has a signature piece; in **Auto** mode the pieces play as a playlist with soft fade-outs (never the same piece twice in a row), or pick one piece to loop. Settings: toggle, volume, track picker, "Next" button; the pause menu has a quick switch; music ducks while paused
- **Polished animations** — cascading tile deal, matched pairs attract and dissolve with a golden spark burst, floating score popups, value-change pulses, staggered menu/card entrances, golden dust rising through the main menu, celebratory win screen
- **Two modes** — Classic (pick a layout, clear it, win) and Endless (layouts chain one after another, score accumulates)
- **Daily Mahjong (v21)** — one deterministic layout per calendar day (UTC), same for every player; click the 日 tile in the menu. Even-numbered days use a **Mix** — two layouts combined side by side; odd-numbered days use a single layout. Play as many times as you like, best score/time for the day is tracked.
- **Mix mode (v22)** — click the 混 tile in the menu to play a random Mix: two layouts combined side by side into one giant board. Deterministic from seed, so two players with the same seed get the same Mix.
- **Decorated main menu (v18)** — hanging red lanterns with 福/寿 glyphs in the top corners, lucky cloud ornaments, bamboo grove silhouette at the bottom, four red seal-stamps at the corners (禄/禧); the existing title tiles and rack of menu buttons are preserved untouched
- **SVG icons instead of emoji (v32)** — emoji such as 🌿 🎋 🍁 and symbols such as ✦ ❖ ⏭ ✕ need a system emoji font, which Windows 7 does not have (they show as empty boxes). All of them are now vector icons in `js/icons.js` (`<span data-icon="leaf">` in HTML, `Icons.get('star')` in JS), drawn with `currentColor` so they follow the theme. Achievements and tutorial slides store icon *names*.
- **Lite graphics mode (v32)** — `js/perf.js` + `css/lite.css`. Switched on automatically for Windows XP/Vista/7, old browsers (Chrome/Edge < 100, Firefox < 91) and ≤2 cores / ≤2 GB RAM, or manually in Settings → Graphics (Auto / Lite / Full). In *auto* a frame watchdog also switches to lite if the game runs below ~30 fps. Lite removes backdrop blur, drop-shadow filters, endless menu animations, SVG noise textures and blurred tile glows, and shortens the reverb impulse; gameplay cues (golden free tiles, dimmed blocked tiles) stay. Measured with CPU throttled 40× and software rendering: menu ~18 fps → ~57 fps.
- **Mix generator (v31)** — the *Mix* button opens a screen that generates ONE brand-new layout (`js/mixgen.js`). Choose how: *from two layouts* (two ready shapes of similar size are spliced along a wavy seam), *from scratch* (a blob grows from the centre toward random attractors, then smaller layers are stacked on top; optional mirror / cross symmetry and pyramid-style offset layers) or *surprise*. Sliders set the tile count (24–200, always even, so never 600+) and the layer count. The preview shows exactly the board you will play; "Другой узор" rolls a new one. Rules enforced by tests: even tile count in range, no overlaps within a layer, every upper tile is supported, ≤5 layers, always fully clearable. Generation is deterministic from `seed`, so *Continue* and the Daily mix just store the parameters (`mixSpec`) and regenerate the same board.
- **Decorated game field (v31)** — the board now sits on a proper mahjong table: a frame with a material per theme (walnut, marble, cobalt lacquer, black lacquer, crimson lacquer), woven cloth with a gold inlay line, brass corner plates, four wind studs (北 東 南 西) on the frame, and a coin-and-lotus medallion that emerges as the board is cleared. Everything scales with the tile size and stays under the tiles (`pointer-events: none`). Vertical calligraphy scrolls on both sides are kept (hidden on narrow screens).
- **Game screen redesign (v33)** — the whole screen is one table. A lacquered frame (wood / marble / lacquer per theme) runs along the screen edges and carries the controls; inside it the cloth with its gold inlay, brass corners and medallion fills everything else, and the tiles get almost all of it (board padding 0.06 of a tile, was 0.28). On wide screens (aspect ≥ 8:5) there is no top bar at all: score plates sit in a left rail, big labelled buttons (Size / Hint / Shuffle / Undo) in a right rail, so the full screen height goes to tiles; on tall/narrow screens a slim top bar is used. The old side scrolls were replaced by faint calligraphy on the rails.
- **Two new tile skins (v33)** — *Pictures*: 34 distinct big familiar drawings instead of characters (9 fruits for «dots», 9 flowers for «bamboo», 9 birds and animals for «characters», sun/cloud/moon/snowflake for winds, heart/frog/house for dragons; bonus tiles sit in a pink (flowers) or blue (seasons) ring with a star). *Contrast*: readable without colour — suit is the frame *shape* (circle / stalk / square), value is a huge digit (6 and 9 underlined), winds are a diamond with a letter and a pointer, dragons are black / hatched / empty hexagons; black on white only. Both are light SVG (no gradients, no ids except one hatch pattern) built on the shared `js/tileset-core.js`; the settings screen shows three sample tiles on every skin card.
- **Modular sources (v33)** — `js/app.js` is now `js/app/*.js` (core, modes, mix, play, win, saves, gallery, settings, pause, init): each file is an IIFE over one shared `App`; shared mutable state lives in `App.state`, calls between modules go through `App.name()`. `css/main.css` is now 12 files (base, buttons, select, game, pause, win, settings, common, tutorial, minitiles, mix, icons) linked in the same order, so the cascade is unchanged. `tests/structure.test.js` keeps every module ≤ 400 lines; `tests/smoke-dom.js` (needs `npm i --no-save jsdom`) boots the real page in a DOM and clicks through the game.
- **Ambient background (v18)** — a barely audible pink-noise pad at ~-40 dB simulates the hush of a tea ceremony; gentle LFO modulation makes the noise "breathe" (1 cycle per 14 s). Generated entirely via Web Audio, no audio files.
- **Per-piece timbres** — Imperial = bronze (two slightly detuned sines + inharmonic bell partials), Porcelain = glass (sine + 3rd & 5th harmonics), Jade & Night = koto (sine + soft triangle octave), Traditional = guzheng (triangle + sine octave shimmer). Only soft waveforms (no sawtooth/square), all through a lowpass and a convolution-reverb "hall".
- **Hover feedback** — a clean, quiet pure-sine note (taken from the key of the playing music) on mouseenter over a *free* tile, so the sound itself tells you the tile can be picked; blocked tiles stay silent. Throttled to 60 ms. Touch devices are unaffected.
- **Combo streaks** — clear pairs back-to-back (within 5 seconds) to build a ×2…×8 multiplier worth bonus points, with its own rising chime and a golden "Combo ×N" popup
- **8 achievements** — from "First win" and "Clean win" (no hints, shuffles, or undos) to "Combo ×5", speed runs, and layout collections; new ones announce with a toast and appear highlighted on the win screen
- **5 themes** — Traditional (ivory, dark wood, gold), Jade (pastel marble), Porcelain (vintage blue and gold), Night (black lacquer, gold, ivory tiles), Imperial (crimson lacquer and abundant gold)
- **Hint, undo, shuffle** — no penalties in Endless mode; dead-end positions are reshuffled automatically
- **Autosave** — close the tab mid-game and continue later; the undo history and the game clock survive the restart, and pause time never counts toward your result
- **Optimized save format (v21)** — tile `face` (the SVG string) is no longer persisted to localStorage; it's reconstructed from `Tileset` by `suit`/`rank` on load. The Cross layout (202 tiles × long SVG) no longer risks hitting the ~5 MB localStorage quota.
- **Per-layout progress** — each layout card shows how many times you have cleared it
- **Custom confirm dialog (v20)** — replaces the native `window.confirm()` with a themed overlay (red danger button, Esc to cancel, click backdrop to dismiss); works correctly in PWA standalone mode where the native dialog breaks
- **Self-hosted fonts (v20)** — Ma Shan Zheng, Noto Serif SC (400/600/700/900), Noto Sans SC (400/500/700), and ZCOOL XiaoWei are bundled in `/fonts/` and served locally; offline mode keeps the same calligraphic look (no system fallback degradation)
- **Statistics** — games played, wins, best score, best time; a golden "New record!" badge appears on the win screen when you beat your best score or time
- **Fullscreen mode** — one click in the pause menu (hidden where the API is unsupported)
- **Haptic feedback** — light vibration on match and win on mobile devices
- **Sound effects (v26-audio)** — 12 soft synthesized sounds (hover, select, deselect, blocked, match, combo, mismatch, hint, undo, shuffle, deal, win) on a shared bus: separate volume slider, a limiter against clipping and one shared reverb so everything sounds like it comes from the same room. Effects are played in the **key of the current music piece** (pentatonic degrees, never detuned — combos climb the scale instead of multiplying frequency). No audio files; add your own sound by dropping a file into `js/sounds/` (see the header of `js/audio.js`)
- **Accessibility** — five tile sizes from "Tiny" to "Extra-large", configurable blocked-tile transparency (0–50%), free tiles are always opaque, `prefers-reduced-motion` supported, toasts announced to screen readers

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
| `+` / `−` | Tile size |

## Testing

```bash
node tests/run.js
```

1415+ dependency-free assertions (Node.js only) cover layouts (incl. mix generator: combineLayouts, pickMixPair, getMixFromSeed — valid positions, no collisions, even tile count, deterministic), the tile set, game logic, combo math, the tutorial's slide catalog and navigation, endgame solvability (unique tile ids on oversized layouts and auto-recovery from deadlocked boards, 6 stress games × 28 layouts = 168 always-winnable parties), scaling math (incl. 5 tile sizes), animation math, the music engine's pure math (incl. per-theme timbres and ambient pad), the tile-skin switcher, the clean hover sound, a mock-AudioContext runtime check of every sound effect and of the music scheduler (envelopes, playlist, track switching), the custom confirm overlay, self-hosted fonts, favicons in SW cache, Daily Mahjong (deterministic seed per UTC date, even days use mix, daily statistics), save optimization, storage, appearance settings, the game clock, savegame history serialization, theme variable parity, and the v38 settings screen with its live preview (markup, cascade order, SW cache, scene sync, legend, the mahjong:settings event wiring). GitHub Actions runs the suite on every push — see `.github/workflows/tests.yml`.

## Project structure

```
mahjong/
├── index.html          Entry point
├── manifest.json       PWA manifest
├── sw.js               Service worker (offline cache)
├── Маджонг.bat         Windows launcher
├── css/                18 modules: base, buttons, select, game, pause, win,
│   │                   settings, preview (v38), common, tutorial, minitiles,
│   │                   mix, icons, tiles, highlight, menu, themes, lite
├── js/
│   ├── tileset.js      144 tiles and matching rules (facade over 4 skins)
│   ├── tileset-*.js    Skins: classic, ornate, pictures, clear (+ shared core)
│   ├── layouts.js      The 28 layouts + mix generator
│   ├── game.js         Game logic
│   ├── render.js       Rendering and scaling
│   ├── audio.js        Sound-effect engine (shared bus, reverb, limiter, voice kit)
│   ├── sounds/         One file per sound effect + catalog (index.js)
│   ├── music.js        Music collection: 7 composed pieces, playlist, synth voices
│   ├── achievements.js Achievements (pure logic)
│   ├── tutorial.js     Tutorial walkthrough (pure logic + runtime)
│   ├── storage.js      Settings and progress persistence
│   ├── app/            UI controller: core, modes, mix, play, win, saves,
│   │                   gallery, settings, options, preview (v38), pause, init
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

- ~95 KB total (HTML + CSS + JS); loads instantly
- DOM/CSS rendering — smooth on weak GPUs, no canvas required
- Screen switching is driven by `body[data-screen]`; every screen has an opaque background, so no layers bleed through
- Tile scaling derives from the available stage area, so the board always fits the viewport at any size
- The service worker caches all assets after the first load; subsequent runs are fully offline
