# Mahjong Solitaire

A classic mahjong solitaire (pair-matching) game in pure HTML, CSS, and JavaScript.
No frameworks, no build step, no runtime dependencies — and it runs fully offline.

## Features

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
- **Decorated game field (v18)** — vertical calligraphy scrolls on the left (和 平 安 康) and right (福 禄 寿 喜) of the board, golden tassel ornaments at the four corners of the table; hidden on narrow screens
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

1260+ dependency-free assertions (Node.js only) cover layouts (incl. mix generator: combineLayouts, pickMixPair, getMixFromSeed — valid positions, no collisions, even tile count, deterministic), the tile set, game logic, combo math, the tutorial's slide catalog and navigation, endgame solvability (unique tile ids on oversized layouts and auto-recovery from deadlocked boards, 6 stress games × 28 layouts = 168 always-winnable parties), scaling math (incl. 5 tile sizes), animation math, the music engine's pure math (incl. per-theme timbres and ambient pad), the tile-skin switcher, the clean hover sound, a mock-AudioContext runtime check of every sound effect and of the music scheduler (envelopes, playlist, track switching), the custom confirm overlay, self-hosted fonts, favicons in SW cache, Daily Mahjong (deterministic seed per UTC date, even days use mix, daily statistics), save optimization, storage, appearance settings, the game clock, savegame history serialization, and theme variable parity. GitHub Actions runs the suite on every push — see `.github/workflows/tests.yml`.

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
│   └── themes.css      The five themes
├── js/
│   ├── tileset.js      144 tiles and matching rules
│   ├── layouts.js      The 28 layouts + mix generator
│   ├── game.js         Game logic
│   ├── render.js       Rendering and scaling
│   ├── audio.js        Sound-effect engine (shared bus, reverb, limiter, voice kit)
│   ├── sounds/         One file per sound effect + catalog (index.js)
│   ├── music.js        Music collection: 7 composed pieces, playlist, synth voices
│   ├── achievements.js Achievements (pure logic)
│   ├── tutorial.js     Tutorial walkthrough (pure logic + runtime)
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

- ~95 KB total (HTML + CSS + JS); loads instantly
- DOM/CSS rendering — smooth on weak GPUs, no canvas required
- Screen switching is driven by `body[data-screen]`; every screen has an opaque background, so no layers bleed through
- Tile scaling derives from the available stage area, so the board always fits the viewport at any size
- The service worker caches all assets after the first load; subsequent runs are fully offline
