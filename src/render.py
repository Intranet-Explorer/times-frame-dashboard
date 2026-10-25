#!/usr/bin/env python3
"""Render journal.html to a seamless looping MP4 (journal.mp4) + cover (jcover.webp).

The page exposes window.setT(t) which positions every animation deterministically
for time t, so we render exact frames and get a clean loop. Requires playwright
(chromium) and ffmpeg on PATH.
"""
import os, subprocess
from PIL import Image
from playwright.sync_api import sync_playwright

FPS = 30
T = 29.4          # loop length; must match template.html's const T
WIDTH, HEIGHT = 800, 1280

def main():
    os.makedirs('frames', exist_ok=True)
    for f in os.listdir('frames'):
        os.remove(os.path.join('frames', f))
    n = int(round(FPS * T))
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': WIDTH, 'height': HEIGHT}, device_scale_factor=1)
        pg.goto('file://' + os.path.abspath('journal.html'))
        pg.wait_for_timeout(800)
        for i in range(n):
            pg.evaluate('window.setT(%f)' % (i / FPS))
            pg.screenshot(path='frames/f_%04d.png' % i)
        b.close()
    subprocess.run(['ffmpeg', '-y', '-framerate', str(FPS), '-i', 'frames/f_%04d.png',
                    '-c:v', 'libx264', '-profile:v', 'main', '-pix_fmt', 'yuv420p',
                    '-crf', '20', '-movflags', '+faststart', '-r', str(FPS), 'journal.mp4'],
                   check=True)
    Image.open('frames/f_0000.png').convert('RGB').save('jcover.webp', 'WEBP', quality=82)
    print('wrote journal.mp4 + jcover.webp')

if __name__ == '__main__':
    main()
