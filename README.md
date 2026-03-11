# YouTube Speed Controller (Arc / Chromium Extension)

A small Manifest V3 browser extension that lets you set the playback speed of the current YouTube tab.

The loadable extension lives in `extension/` (that’s the folder you point Arc at when you “Load unpacked”).

## Features

- Slider to adjust speed from **0.25× → 4×** (applies on release)
- Preset buttons (0.5× / 1× / 1.5× / 2×)
- Manual speed input + **Apply** button (or press **Enter**)
- **Reset** button to return to **1×**
- Keyboard shortcuts in the popup:
  - **← / →**: -/+ 0.05×
  - **1–4**: presets (0.5× / 1× / 1.5× / 2×)

## Install in Arc

1. Open `arc://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select: `.../yt-speed-extension/extension`

After any code/icon changes, come back to `arc://extensions` and hit **Reload** on the extension.

## How to use

1. Open a YouTube video.
2. Click the extension icon in Arc’s toolbar.
3. Use any of:
   - Slider (drag, then release to apply)
   - Presets (click)
   - Manual input (type a number like `1.75`, then **Apply** or **Enter**)
   - **Reset** to return to `1.00×`

## How it works (high level)

- The popup UI is `extension/popup/index.html` + `extension/popup/popup.js` + `extension/popup/style.css`.
- When you apply a speed, the popup calls `chrome.scripting.executeScript(...)` on the active tab and runs:
  - `document.querySelector("video").playbackRate = <speed>`
- A background service worker (`extension/background.js`) also resets the playback rate to **1×** when a YouTube tab finishes loading (useful to avoid “sticky” speed across navigations).

## Project structure

- `extension/`
  - `manifest.json` — MV3 manifest (action popup, icons, permissions)
  - `background.js` — resets speed to 1× on YouTube page load
  - `content.js` — message-based speed setter (currently not registered in the manifest)
  - `popup/` — the popup UI shown when you click the extension icon
  - `icons/` — toolbar/extension icons referenced by the manifest
- `frontend/`
  - A Next.js app (static export) that can be used to prototype a popup UI.
  - This repo currently loads the popup from `extension/popup/` (not directly from `frontend/`).

## Developing / customizing

### Edit the popup UI directly

Modify these files, then reload the extension in `arc://extensions`:

- `extension/popup/index.html`
- `extension/popup/popup.js`
- `extension/popup/style.css`

### (Optional) Use the Next.js frontend

The Next.js project is configured with `output: "export"` and will generate static files in `frontend/out/`.

Typical workflow:

1. `cd frontend`
2. `bun run build`
3. Copy the exported files from `frontend/out/` into `extension/popup/`
4. Reload the extension in `arc://extensions`

## Notes / limitations

- The extension targets YouTube pages (`https://www.youtube.com/*`).
- The injected script updates the **first** `<video>` element found on the page.
- Speed is clamped to the popup’s allowed range (**0.25× → 4×**).
