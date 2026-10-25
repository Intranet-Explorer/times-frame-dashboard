# Divoom Times Frame: local API & device notes

Empirical notes for the Times Frame (hardware 510, firmware 510175). The frame runs OpenWrt (TinaLinux, Allwinner) and exposes an undocumented but real local HTTP API. These are the behaviors this project relies on. They are not an official contract and may differ by firmware.

## Transport

- `POST http://<frame-ip>:9000/divoom_api`, `Content-Type: application/json`. The `Command` field selects the operation. No account, token, or login required on the LAN.
- Multipart upload routes: `POST /upload` (photo/video library), `POST /create_local_clock`, `POST /patch_local_clock`, `POST /replace_clock_dial_bg`, `POST /upload_local_asset`. Each multipart part needs its own `Content-Length`, with CRLF line endings. Standard `multipart/form-data` without per-part `Content-Length` (for example `curl -F`) is accepted but stores nothing.
- `GET /userdata/<path>` reads device files (screenshots, the photo DB).
- Discovery: `GET https://app.divoom-gz.com/Device/ReturnSameLANDevice` returns LAN devices sharing your WAN IP (`DevicePrivateIP`).

## What works, and what doesn't

| Goal | Verdict |
|---|---|
| Draw our own full-screen content | yes, as a local-clock background or a photo/video-library item |
| Loop an animated video of our content | yes, via the photo library (`VideoPlayBack: 0` = loop) |
| Animated WebP as a clock background | no, renders only the first frame (static) |
| Frame pulls our image/video via the Divoom cloud proxy | no, the proxy whitelists only `f.divoom-gz.com` |
| Frame pulls text from an arbitrary URL (`NetData`) | yes, cloud-proxied, but raw device-font text only |
| Frame pulls anything over HTTPS from its own shell | yes, once rooted (see below) |
| Persistent across reboot | yes for saved local clocks and photo albums; a live `EnterCustomControlMode` takeover does not survive |

The distinction that matters: the cloud proxy is whitelisted, but the device's own network stack is not. The stock app can only load media Divoom's cloud will relay, so without root you push media over the LAN and can't point a saved dial at your own feed. With root, the frame's own curl fetches any host directly. That is the whole basis for the self-updating agent here.

## Key commands used here

- `Channel/GetClockInfo`, `Channel/GetConfig`, `Device/GetHardwareVersion`, `Device/GetLanCapabilities` for state.
- `Device/GetScreenSnapshot` returns `snapShotPath` under `/userdata/`. Download it to see the UI layer. Video plays on a hardware overlay plane the snapshot can't capture, so a black snapshot over a playing video is expected.
- `Photo/NewAlbum` (requires a caller-chosen `ClockId` in 800000-899999 plus `ClockName`), `Photo/GetLocalAlbumList`, `Photo/DeleteAlbum`.
- `Photo/LocalAddToAlbum` via `/upload`, with a JSON part, an MP4 part (`vi-<24 hex>.mp4`), and a WebP cover part. 800×1280, H.264/HEVC, up to 100 MB and 600 s.
- `Photo/SetAlbumConfig` is global, and all fields are required together (partial calls no-op). Set `ShowClock: 0`, `ShowWeather: 0`, `ShowTitle: 0` to hide the device overlays; `VideoPlayBack: 0` to loop; `VideoVolume: 0`; `VideoAutoPlay: 1`.
- `Channel/SetClockSelectId` selects a dial or album. Send it twice to override a scheduled rotation.
- `Device/CreateLocalClock` and `PatchLocalClockInfo` build a persistent local dial from a JSON `ItemList` plus one background image (JPEG/WebP under 500 KB). Element fields are layout only (`disp`, `font`, `x/y/w/h`, `size`, `alig`, `color_1/2`, `item_id`, `image_addr`). There is no field to bind a data source URL, which is why native data widgets can't point at your own feeds.

## The device underneath

What a rooted look turns up, and why the self-fetch approach works:

- OpenWrt on Allwinner, armv7, kernel 5.4-rt. adb is available over USB, and adbd runs as root, so `push`/`pull` work with no login.
- The root filesystem is a writable overlay: read-only squashfs lower (`/rom`), ext4 `/overlay` upper, union-mounted at `/`. `/etc` is editable and edits persist. Console root is password-locked from the factory, but with the overlay writable that is trivially reset by rewriting `/etc/shadow`.
- A real userland: curl with libcurl plus OpenSSL 1.1 and a system CA bundle, cron, lua, busybox ash. Tens of GB free on the data partition.
- `/etc/rc.local` runs at boot as root and is the natural hook for a boot-time agent.
- No firewall. There are no iptables or nftables binaries and no netfilter modules. The local services (`:9000` display API, adbd, an aux daemon) bind `0.0.0.0`, so on a shared network containment is a job for network isolation, not an on-device firewall. The frame also holds a persistent plaintext MQTT (`:1883`) connection to Divoom's cloud.

The agent (`src/agent.sh`) uses only this stock userland: curl to fetch the rendered clip, the `/upload` and `Photo/*` API over localhost to display it, and cron to repeat.

## Gotchas

- `EnterCustomControlMode` caches element properties by `(type, position-in-DispList)`, not by ID. A new layout with the same element count only updates text. Change the count, or `Exit` first, to reset geometry.
- Field-name typos in Divoom's docs are real: `BackgroudImageAddr` and `BackgroudImageLocalFlag` (no `n`). Mirror them exactly.
- Reddit blocks server-side fetches (403). Route those feeds through a different source or a proxy.
