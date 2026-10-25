#!/bin/sh
# Times Frame "What's New" agent — runs ON the frame (OpenWrt/ash).
#
# Fetches a pre-rendered 800x1280 looping clip over HTTPS and shows it as a
# fullscreen looping library item with the device clock/weather overlays hidden.
# The frame does this itself: its own curl (OpenSSL + CA bundle) reaches any
# host, so no bridge or push-box is needed. Install with cron + rc.local.
#
# No python/jq on the device, so: fresh album id per run (previous id tracked in
# a file), and the /upload body is hand-built with a per-part Content-Length
# (the device's parser requires it; curl -F does not emit it).
#
# Override the source branch/host with:  BASE=https://host/path  sh agent.sh
BASE="${BASE:-https://raw.githubusercontent.com/Intranet-Explorer/times-frame-dashboard/live}"
API="http://127.0.0.1:9000"
WORK=/userdata/whatsnew
LAST="$WORK/last_album"
MP4="$WORK/clip.mp4"
WEBP="$WORK/cover.webp"
mkdir -p "$WORK"

log(){ echo "[$(date '+%H:%M:%S')] $*"; }
post(){ curl -fsS -m 15 -X POST "$API/divoom_api" -d "$1"; echo; }
clen(){ wc -c < "$1" | tr -d ' '; }

# 1. pull the latest rendered clip + cover
log "fetch $BASE/journal.mp4"
curl -fsS -m 90 -o "$MP4"  "$BASE/journal.mp4"  || { log "FAIL: mp4 fetch";   exit 1; }
curl -fsS -m 30 -o "$WEBP" "$BASE/jcover.webp"  || { log "FAIL: cover fetch"; exit 1; }
log "got $(clen "$MP4") bytes mp4, $(clen "$WEBP") bytes cover"

# 2. unique names for this push
HASH=$(cat /proc/sys/kernel/random/uuid 2>/dev/null | tr -d - | cut -c1-24)
[ -n "$HASH" ] || HASH=$(date +%s)0000000000000000
HASH=$(echo "$HASH" | cut -c1-24)
VI="vi-$HASH.mp4"; VC="vi-$HASH.webp"
cp "$MP4" "$WORK/$VI"; cp "$WEBP" "$WORK/$VC"

# 3. tear down the previous album, stand up a fresh one
NEWID=$(( 800000 + $(date +%s) % 100000 ))
OLD=$(cat "$LAST" 2>/dev/null)
[ -n "$OLD" ] && { log "delete old album $OLD"; post "{\"Command\":\"Photo/DeleteAlbum\",\"ClockId\":$OLD}" >/dev/null; sleep 1; }
log "new album $NEWID"
post "{\"Command\":\"Photo/NewAlbum\",\"ClockId\":$NEWID,\"ClockName\":\"WhatsNew\"}" >/dev/null
sleep 1

# 4. build cmd.json (no trailing newline) and the exact multipart body
NOW=$(date +%s)000
PF=$(date +%s)
JSON="$WORK/cmd.json"
printf '%s' "{\"Command\":\"Photo/LocalAddToAlbum\",\"ReturnCode\":0,\"ClockId\":$NEWID,\"ParentClockId\":0,\"ParentItemId\":0,\"UserId\":0,\"SendTime\":$NOW,\"TakingTime\":$NOW,\"PhotoX\":0,\"PhotoY\":0,\"PhotoWidth\":800,\"PhotoHeight\":1280,\"PhotoIndex\":0,\"PhotoTotalCnt\":1,\"PhotoFlag\":$PF,\"FileName\":\"$VI\",\"PreviewFileName\":\"$VC\",\"PhotoTitle\":\"\"}" > "$JSON"

B="AstroToo$(cat /proc/sys/kernel/random/uuid 2>/dev/null | tr -d -)"
BODY="$WORK/body.bin"
JLEN=$(clen "$JSON"); MLEN=$(clen "$WORK/$VI"); CLEN=$(clen "$WORK/$VC")
{
  printf -- '--%s\r\n' "$B"
  printf 'Content-Disposition: form-data; name="json"; filename="cmd.json"\r\n'
  printf 'Content-Type: application/json\r\nContent-Length: %s\r\n\r\n' "$JLEN"
  cat "$JSON"
  printf '\r\n--%s\r\n' "$B"
  printf 'Content-Disposition: form-data; name="file"; filename="%s"\r\n' "$VI"
  printf 'Content-Type: application/octet-stream\r\nContent-Length: %s\r\n\r\n' "$MLEN"
  cat "$WORK/$VI"
  printf '\r\n--%s\r\n' "$B"
  printf 'Content-Disposition: form-data; name="file"; filename="%s"\r\n' "$VC"
  printf 'Content-Type: application/octet-stream\r\nContent-Length: %s\r\n\r\n' "$CLEN"
  cat "$WORK/$VC"
  printf '\r\n--%s--\r\n' "$B"
} > "$BODY"
log "upload $(clen "$BODY") byte body"
curl -fsS -m 120 -X POST "$API/upload" \
  -H "Content-Type: multipart/form-data; boundary=$B" \
  --data-binary @"$BODY" >/dev/null || { log "FAIL: upload"; exit 1; }
sleep 2

# 5. hide clock/weather/title, loop, mute (global config — all fields required)
post "{\"Command\":\"Photo/SetAlbumConfig\",\"SlideshowTheme\":0,\"SlideshowSpeed\":50,\"SubSlideshowTheme\":0,\"FillFrame\":0,\"FrameBackground\":0,\"DisplayOrder\":3,\"ReversePhotoOrder\":0,\"ShowTitle\":0,\"ShowClock\":0,\"ShowWeather\":0,\"VideoAutoPlay\":1,\"VideoPlayBack\":0,\"VideoAutoMute\":1,\"VideoVolume\":0}" >/dev/null

# 6. select it (twice, to override the native schedule)
post "{\"Command\":\"Channel/SetClockSelectId\",\"ClockId\":$NEWID}" >/dev/null
post "{\"Command\":\"Channel/SetClockSelectId\",\"ClockId\":$NEWID}" >/dev/null

echo "$NEWID" > "$LAST"
rm -f "$BODY"
# 7. tidy staged vi-* except this run's
find "$WORK" -name 'vi-*.mp4'  ! -name "$VI" -exec rm -f {} + 2>/dev/null
find "$WORK" -name 'vi-*.webp' ! -name "$VC" -exec rm -f {} + 2>/dev/null
log "done — showing album $NEWID"
