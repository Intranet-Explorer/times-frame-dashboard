// Renders the Times Frame broadcast to a looping H.264 clip + cover.
//   node render.mjs            fetch live weather, render, output to ./out
//   node render.mjs --mock     use the template's built-in mock data (offline)
// Output: out/journal.mp4, out/jcover.webp  (what the frame pulls from `live`)
import { chromium } from 'playwright';
import { spawnSync } from 'node:child_process';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getData } from './data.mjs';

const DIR = dirname(fileURLToPath(import.meta.url));
const MOCK = process.argv.includes('--mock');
const FPS = 30;
const OUT = join(DIR, 'out');
const FRAMES = join(DIR, '.frames');
const SCAN = join(DIR, 'assets', 'scanlines.png');

function ff(args){ const r=spawnSync('ffmpeg', args, {stdio:['ignore','ignore','inherit']}); if(r.status!==0) throw new Error('ffmpeg failed'); }

async function main(){
  let data=null;
  if(!MOCK){ console.log('fetching weather...'); data=await getData(); console.log('got', data.current.temp, data.current.cond, '| generated', data.generated); }

  rmSync(FRAMES,{recursive:true,force:true}); mkdirSync(FRAMES,{recursive:true}); mkdirSync(OUT,{recursive:true});
  const browser = await chromium.launch({args:['--force-color-profile=srgb']});
  const page = await browser.newPage({viewport:{width:800,height:1280},deviceScaleFactor:1});
  if(data) await page.addInitScript(d=>{window.DATA=d;}, data);
  await page.goto('file://'+join(DIR,'broadcast.html'));
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForTimeout(400);

  const LOOP = await page.evaluate(()=>window.LOOP);
  const N = Math.round(FPS*LOOP);
  console.log(`rendering ${N} frames (${LOOP}s loop @ ${FPS}fps)`);
  for(let i=0;i<N;i++){
    const t=i/FPS;
    await page.evaluate(a=>{ window.setT(a.t); document.querySelectorAll('.tick').forEach(e=>e.style.animation='scroll '+a.loop+'s linear '+(-a.t)+'s paused'); }, {t, loop:LOOP});
    await page.screenshot({path: join(FRAMES, 'f_'+String(i).padStart(4,'0')+'.png')});
  }
  await browser.close();

  console.log('encoding...');
  const crt = [
    `[0:v]scale=680:1088:flags=bilinear,scale=800:1280:flags=bilinear[ch]`,
    `[ch]gblur=sigma=0.7[soft]`,
    `[soft]split[b][g];[g]gblur=sigma=6[bl];[b][bl]blend=all_mode=screen:all_opacity=0.24[bloom]`,
    `[bloom][1:v]overlay=0:y='-mod(n*0.18\\,2)'[sc]`,
    `[sc]eq=contrast=1.03:saturation=1.12:brightness=0.05,format=yuv420p`,
  ].join(';');
  ff(['-y','-framerate',String(FPS),'-i',join(FRAMES,'f_%04d.png'),'-i',SCAN,
      '-filter_complex',crt,'-r',String(FPS),'-c:v','libx264','-pix_fmt','yuv420p',
      '-preset','veryfast','-crf','28','-movflags','+faststart', join(OUT,'journal.mp4')]);
  ff(['-y','-i',join(FRAMES,'f_0000.png'),'-vframes','1', join(OUT,'jcover.webp')]);
  rmSync(FRAMES,{recursive:true,force:true});
  console.log('done ->', join(OUT,'journal.mp4'));
}
main().catch(e=>{console.error(e);process.exit(1)});
