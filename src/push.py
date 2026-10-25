#!/usr/bin/env python3
"""Push journal.mp4 to the Times Frame and display it as a looping video.

Usage: python3 src/push.py <frame-ip> [mp4] [cover]

Replaces the "WhatsNew" album with a fresh one holding the new clip, hides the
device clock/weather overlays (global), and selects the album. The frame loops it.
"""
import sys, json, uuid, hashlib, time, secrets, random, urllib.request

def api(ip, cmd, **kw):
    d = {"Command": cmd}; d.update(kw)
    req = urllib.request.Request("http://%s:9000/divoom_api" % ip, data=json.dumps(d).encode(),
                                 method="POST", headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=15).read().decode())

def part(boundary, name, fn, data):
    return ("--%s\r\nContent-Disposition: form-data; name=\"%s\"; filename=\"%s\"\r\n"
            "Content-Type: application/octet-stream\r\nContent-Length: %d\r\n\r\n"
            % (boundary, name, fn, len(data))).encode() + data

def upload_video(ip, album, mp4, cover):
    mb = open(mp4, 'rb').read(); cb = open(cover, 'rb').read()
    h = hashlib.sha256(mb).hexdigest()[:24]; now = int(time.time() * 1000)
    meta = {"Command": "Photo/LocalAddToAlbum", "ReturnCode": 0, "ClockId": album,
            "ParentClockId": 0, "ParentItemId": 0, "UserId": 0, "SendTime": now, "TakingTime": now,
            "PhotoX": 0, "PhotoY": 0, "PhotoWidth": 800, "PhotoHeight": 1280,
            "PhotoIndex": 0, "PhotoTotalCnt": 1, "PhotoFlag": secrets.randbelow(2**31 - 1),
            "FileName": "vi-%s.mp4" % h, "PreviewFileName": "vi-%s.webp" % h, "PhotoTitle": ""}
    mj = json.dumps(meta).encode(); b = "AstroToo" + uuid.uuid4().hex
    jp = ("--%s\r\nContent-Disposition: form-data; name=\"json\"; filename=\"cmd.json\"\r\n"
          "Content-Type: application/json\r\nContent-Length: %d\r\n\r\n" % (b, len(mj))).encode() + mj
    body = (jp + b"\r\n" + part(b, "file", "vi-%s.mp4" % h, mb) + b"\r\n"
            + part(b, "file", "vi-%s.webp" % h, cb) + ("\r\n--%s--\r\n" % b).encode())
    req = urllib.request.Request("http://%s:9000/upload" % ip, data=body, method="POST",
                                 headers={"Content-Type": "multipart/form-data; boundary=" + b})
    return json.loads(urllib.request.urlopen(req, timeout=120).read().decode())

def main():
    ip = sys.argv[1]
    mp4 = sys.argv[2] if len(sys.argv) > 2 else "journal.mp4"
    cover = sys.argv[3] if len(sys.argv) > 3 else "jcover.webp"
    # fresh album
    for a in api(ip, "Photo/GetLocalAlbumList").get("AlbumList", []):
        if a.get("ClockName") == "WhatsNew" and a.get("AlbumType") == 0:
            api(ip, "Photo/DeleteAlbum", ClockId=a["ClockId"])
    time.sleep(1)
    album = random.randint(800000, 899999)
    api(ip, "Photo/NewAlbum", ClockId=album, ClockName="WhatsNew"); time.sleep(1.5)
    assert {a["ClockId"]: a["ClockName"] for a in
            api(ip, "Photo/GetLocalAlbumList").get("AlbumList", [])}.get(album) == "WhatsNew"
    print("upload:", upload_video(ip, album, mp4, cover)); time.sleep(2)
    # clean canvas: hide device overlays, loop, muted (global config, all fields required)
    api(ip, "Photo/SetAlbumConfig", SlideshowTheme=0, SlideshowSpeed=50, SubSlideshowTheme=0,
        FillFrame=0, FrameBackground=0, DisplayOrder=3, ReversePhotoOrder=0,
        ShowTitle=0, ShowClock=0, ShowWeather=0, VideoAutoPlay=1, VideoPlayBack=0,
        VideoAutoMute=1, VideoVolume=0)
    api(ip, "Channel/SetClockSelectId", ClockId=album)
    api(ip, "Channel/SetClockSelectId", ClockId=album)
    print("showing album", album)

if __name__ == '__main__':
    main()
