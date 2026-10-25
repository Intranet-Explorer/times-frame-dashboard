# Times Frame Dashboard

<img src="assets/badge.svg" alt="built with Claude × Rectangular" height="34">

A cozy pixel-journal info board for the [Divoom Times Frame](https://divoom.com/products/times-frame), a 10.1" 800×1280 transparent desk display. It shows a rotating "What's New" view of the things I follow (AI, security, gaming, making, crypto, weather), drawn like a hand-made travel journal and animated on a loop.

The frame ships as a closed appliance. This turns it into a display that renders its own dashboard and pulls fresh copies by itself, with nothing else on the network.

<p>
<img src="assets/page-ai.png" width="30%" alt="AI & LLM page">
<img src="assets/page-security.png" width="30%" alt="Security page">
<img src="assets/page-make.png" width="30%" alt="Make / Tech page">
</p>

## What it is

The Times Frame is a nice panel wrapped around a locked-down Divoom app: canned dials, a phone app, a cloud account. Out of the box there's no way to put your own live data on it in a style you control.

So I took it apart. Underneath it's an Allwinner board running OpenWrt. Root is reachable over USB, and its local HTTP API (undocumented but real) will load and loop a full-screen video. That was the whole opening. Render the dashboard as a video, get it onto the frame, loop it. The result looks like a little illustrated journal that keeps itself current.

## How it works

Two halves: a generator that makes the video, and the frame that plays it.

```
feeds (RSS/JSON) -> generator (fetch, lay out, render) -> 800x1280 MP4
   -> public URL (GitHub raw) -> frame pulls it via its agent -> loops on screen
```

The generator runs off-device.

1. **Fetch.** Pull the latest items from each topic's feed (`src/fetch.py`).
2. **Build.** Compose a pixel-art page from the data: parchment panels on a night sky, one spread per topic (`src/build.py`, `src/template.html`). The data is baked into the layout.
3. **Render.** Drive a deterministic animation (page-turns, twinkling stars, hero glow) frame by frame in headless Chromium, then encode H.264 (`src/render.py`). The determinism is what makes the loop seamless.

The frame runs the last part itself.

4. **Display.** A small shell agent (`src/agent.sh`) lives on the frame. It curls the newest MP4 from a public URL and hands it to the frame's own display API over localhost, as a looping library clip with the stock clock and weather overlays switched off. cron runs it on a schedule, and it survives reboots.

The thing that makes step 4 work is that the frame fetches its own HTTPS. Divoom's cloud proxy only trusts their CDN, but the box's own curl (OpenSSL and a full CA bundle, both already installed) reaches anything. So the frame needs no helper on the network. It pulls the video for itself. No Pi, no bridge, nothing listening. The generator only has to drop a file somewhere public, which today is a GitHub raw URL, and a scheduled job can render straight into it.

## Getting root

Stock, the only path to custom content is Divoom's app. Underneath, it's an ordinary embedded Linux box once you look.

- **OpenWrt on Allwinner** (armv7, kernel 5.4-rt). adb is up over USB and adbd runs as root, so files push and pull with no login.
- **Writable overlay.** `/` is a union mount. The lower squashfs is read-only, but `/overlay` (ext4) is writable, so `/etc` is editable and edits persist across reboot.
- **Login was the only lock.** Console root had an unknown password. With the overlay writable that doesn't matter. Pull `/etc/shadow`, write in a hash you own, push it back. Full root, reversible from a backup.

After that it's a normal little machine with curl, cron, and tens of gigs free. The agent is just a script and a crontab line.

> This documents the method, not a working credential. Reset your own device.

## Design

- **Aesthetic.** A retro-game travel journal. Warm parchment with pixel borders and corner brackets, floating on a dark night sky so the transparent glass reads as depth. Fonts: Toriko (title), Pixelify Sans (headlines), DotGothic16 (labels), VT323 (numerals).
- **Pages.** Themed spreads rotate on their own. A console (clock, weather and forecast, crypto) stays pinned at the bottom.
- **Topics are a list.** Add or drop one and the layout flexes to fit.

## Status

Working end to end on hardware (hardware 510, firmware 510175):

- [x] Local API mapped, full render to display pipeline proven
- [x] Root and a persistent on-device agent. The frame self-fetches and updates with nothing else on the network
- [x] Looping playback, live feeds, article images, 30 fps
- [x] Stock clock and weather overlay suppressed for a clean canvas

## Roadmap

- [ ] **Floating cards.** Break the layout into panels so the night sky shows through, leaning into the transparent glass.
- [ ] **More pages, more motion.** Crypto (live charts, fear/greed gauge, ticker), PC gaming and emulation, leaks and rumors, each with its own animation.
- [ ] **LLM summaries.** A local model distills each item to a self-contained line, since you can't tap the screen.
- [ ] **A mascot.** A pixel creature wandering the margins.
- [ ] **Scheduled render.** A CI job renders and publishes the clip on its own, so the whole thing runs with no always-on hardware.

## Notes & credits

- Device behavior is documented in [`docs/API.md`](docs/API.md), building on community reverse-engineering and Divoom's own [DivoomDevelop](https://github.com/DivoomDevelop) tooling.
- Fonts are third-party. See [`fonts/README.md`](fonts/README.md).
- Built by **Rectangular** with **Claude**.
