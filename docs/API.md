# Divoom Times Frame — local API notes

Empirical notes for the **Times Frame** (hardware 510, firmware 510175). The frame runs TinaLinux (Allwinner/OpenWrt-derived) and exposes an undocumented-but-real local HTTP API. These are the behaviors this project relies on; they are not an official contract and may differ by firmware.

## Transport

- `POST http://<frame-ip>:9000/divoom_api`, `Content-Type: application/json`. The `Command` field selects the operation. No account, token, or login required on a trusted LAN.
- Multipart upload routes: `POST /upload` (photo/video library), `POST /create_local_clock`, `POST /patch_local_clock`, `POST /replace_clock_dial_bg`, `POST /upload_local_asset`. Each multipart part needs its own `Content-Length`; use CRLF line endings.
- `GET /userdata/<path>` reads device files (screenshots, the photo DB).
- Discovery: `GET https://app.divoom-gz.com/Device/ReturnSameLANDevice` returns LAN devices sharing your WAN IP (`DevicePrivateIP`).

## What works, and what doesn't

| Goal | Verdict |
|---|---|
| Draw our own full-screen content | ✅ as a local-clock background **or** a photo/video-library item |
| Loop an animated **video** of our content | ✅ via the photo library (`VideoPlayBack: 0` = loop) |
| Animated **WebP** as a clock background | ❌ renders only the first frame (static) |
| Frame fetches **our image** from a URL (e.g. Azure) | ❌ cloud proxy whitelists only `f.divoom-gz.com` for images |
| Frame fetches **text** from an arbitrary public URL | ✅ via `NetData` elements (cloud-proxied, no host whitelist) |
| Persistent across reboot | ✅ saved local clocks and photo albums persist; a live `EnterCustomControlMode` takeover does **not** |

**Architectural consequence:** images/video reach the frame only by pushing over the LAN (the frame won't pull them). Text can be pulled from anywhere, but only as raw device-font text. For a custom-styled dashboard, render everything to a video off-device and push it.

## Key commands used here

- `Channel/GetClockInfo`, `Channel/GetConfig`, `Device/GetHardwareVersion`, `Device/GetLanCapabilities` — state.
- `Device/GetScreenSnapshot` → returns `snapShotPath` under `/userdata/`; download it to see the UI layer. **Note:** video plays on a hardware overlay plane the snapshot can't capture — a black snapshot over a playing video is expected.
- `Photo/NewAlbum` (**requires a caller-chosen `ClockId` in 800000–899999** plus `ClockName`), `Photo/GetLocalAlbumList`, `Photo/DeleteAlbum`.
- `Photo/LocalAddToAlbum` via `/upload` — JSON part + MP4 part (`vi-<24 hex>.mp4`) + WebP cover part. 800×1280, H.264/HEVC, ≤100 MB, ≤600 s.
- `Photo/SetAlbumConfig` — **global**, and **all fields are required together** (partial calls no-op). Set `ShowClock: 0`, `ShowWeather: 0`, `ShowTitle: 0` to hide the device overlays; `VideoPlayBack: 0` to loop, `VideoVolume: 0`, `VideoAutoPlay: 1`.
- `Channel/SetClockSelectId` — select a dial or album; send it **twice** to override a scheduled rotation.
- `Device/CreateLocalClock` / `PatchLocalClockInfo` — build a persistent local dial from a JSON `ItemList` + one background image (JPEG/WebP < 500 KB). Element fields are layout only (`disp`, `font`, `x/y/w/h`, `size`, `alig`, `color_1/2`, `item_id`, `image_addr`) — **there is no field to bind a data source URL**, which is why native data widgets can't point at your own feeds.

## Gotchas

- `EnterCustomControlMode` caches element properties by `(type, position-in-DispList)`, not by ID — a new layout with the same element count only updates text. Change the count (or `Exit` first) to reset geometry.
- Field-name typos in Divoom's docs are real: `BackgroudImageAddr` / `BackgroudImageLocalFlag` (no `n`). Mirror them exactly.
- Reddit blocks server-side fetches (403) — route those feeds through a different source or a proxy.
