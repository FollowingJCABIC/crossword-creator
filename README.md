# Crossword Generator (Web)

A React-based crossword generator that accepts word lists in any language (UTF-8) and arranges them into a crossword-style grid.

## Setup

```bash
npm install
npm run dev
```

## Features

- Paste words separated by commas or new lines.
- Load built-in English or Hebrew presets (including a large Hebrew library list).
- Toggle classic crossword rules vs. allowing disconnected words.
- Auto-sizing grid with configurable growth attempts.
- Text-only grid export view.

## Loading Word Banks

There are two ways to load word banks:

1. **Use a preset**: pick one from the preset dropdown in the Inputs panel. Presets are defined in `src/preloaded.js`.
2. **Paste your own**: replace the textarea contents with your list (one per line or comma-separated).

You can also paste JSON directly:

```json
["word1", "word2", "word3"]
```

or:

```json
{ "words": ["word1", "word2"] }
```

## Adding Your Own Preset

Open `src/preloaded.js` and add a new entry under `PRELOADED_LISTS`, then (optionally) add translations under `PRELOADED_TRANSLATIONS`:

```js
export const PRELOADED_LISTS = {
  ...
  my_custom_list: ["alpha", "beta", "gamma"],
};

export const PRELOADED_TRANSLATIONS = {
  ...
  my_custom_list: {
    alpha: "Alpha",
    beta: "Beta",
  },
};
```

The new preset will appear automatically in the dropdown.

## Notes on RTL Scripts

The generator uses Unicode code points, so Hebrew/Arabic input works. The grid is still positioned left-to-right internally, but your browser will render RTL glyphs correctly.

## Background Chant

To enable the background chant, add an audio file named `chant.mp3` to `public/`, or use the file picker in the app to load a local audio file. Playback requires a user click (browser autoplay policies).
