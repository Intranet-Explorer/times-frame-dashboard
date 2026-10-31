// Fetches real weather for the Times Frame broadcast.
// Open-Meteo (no key) for current conditions, 5-day forecast, and a regional
// observations table; suncalc for the moon. Returns the DATA object the
// broadcast template renders from. All formatting (units, icons, labels) is
// done here so the template stays dumb.
import SunCalc from 'suncalc';

const LAT = 44.98, LON = -93.27, TZ = 'America/Chicago';
const HOME = 'MINNEAPOLIS MN';

// upper-midwest regional cities for the observations screen
const CITIES = [
  ['DES MOINES', 41.59, -93.62], ['FARGO', 46.88, -96.79],
  ["INT'L FALLS", 48.60, -93.41], ['MILWAUKEE', 43.04, -87.91],
  ['MINNEAPOLIS', 44.98, -93.27], ['OMAHA', 41.26, -95.93],
  ['SIOUX FALLS', 43.55, -96.70], ['ST. PAUL', 44.95, -93.09],
];

const DOW = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
const MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

function compass(deg){
  const dirs=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return dirs[Math.round(((deg%360)/22.5))%16];
}
// WMO weather code -> { text, icon (ws4kp gif stem) }, day/night aware
function wmo(code, isDay=1){
  const d=isDay?1:0;
  const m={
    0:['Sunny', d?'Sunny':'Clear'], 1:['Mostly Clear', d?'Mostly-Clear':'Clear'],
    2:['Partly Cloudy','Partly-Cloudy'], 3:['Cloudy','Cloudy'],
    45:['Fog','Fog'], 48:['Fog','Fog'],
    51:['Drizzle','Rain'], 53:['Drizzle','Rain'], 55:['Drizzle','Rain'],
    56:['Frz Drizzle','Freezing-Rain'], 57:['Frz Drizzle','Freezing-Rain'],
    61:['Rain','Rain'], 63:['Rain','Rain'], 65:['Hvy Rain','Rain'],
    66:['Frz Rain','Freezing-Rain'], 67:['Frz Rain','Freezing-Rain'],
    71:['Light Snow','Light-Snow'], 73:['Snow','Snow'], 75:['Heavy Snow','Heavy-Snow'],
    77:['Snow','Snow'], 80:['Showers','Shower'], 81:['Showers','Shower'], 82:['Hvy Showers','Shower'],
    85:['Snow Showers','Snow'], 86:['Snow Showers','Heavy-Snow'],
    95:['T-Storms','Thunderstorm'], 96:['T-Storms','Thunderstorm'], 99:['T-Storms','Thunderstorm'],
  };
  return m[code] || ['--','No-Data'];
}
function shortCond(code){ // compact word for the regional table
  const [t]=wmo(code,1);
  return t.toUpperCase().replace('MOSTLY CLEAR','M CLEAR').replace('PARTLY CLOUDY','P CLOUDY');
}
function moonName(phase){ // 0..1
  const names=['New Moon','Waxing Crescent','First Quarter','Waxing Gibbous','Full Moon','Waning Gibbous','Last Quarter','Waning Crescent'];
  return names[Math.round(phase*8)%8];
}
function fmtTime(iso){
  // iso like 2026-10-31T07:50 (local tz from open-meteo)
  const [ ,hm ] = iso.split('T'); let [h,m]=hm.split(':').map(Number);
  const ap=h>=12?'p':'a'; h=h%12||12; return h+':'+String(m).padStart(2,'0')+ap;
}

async function j(url){ const r=await fetch(url); if(!r.ok) throw new Error('fetch '+r.status+' '+url); return r.json(); }

export async function getData(){
  const now = new Date();
  const base='https://api.open-meteo.com/v1/forecast';
  const mainU=`${base}?latitude=${LAT}&longitude=${LON}`+
    `&current=temperature_2m,relative_humidity_2m,dew_point_2m,weather_code,is_day,wind_speed_10m,wind_direction_10m,surface_pressure,visibility`+
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset`+
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${encodeURIComponent(TZ)}&forecast_days=5`;
  const lats=CITIES.map(c=>c[1]).join(','), lons=CITIES.map(c=>c[2]).join(',');
  const cityU=`${base}?latitude=${lats}&longitude=${lons}`+
    `&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m`+
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${encodeURIComponent(TZ)}`;

  const [main, cityRaw] = await Promise.all([j(mainU), j(cityU)]);
  const cityArr = Array.isArray(cityRaw)?cityRaw:[cityRaw];

  const c=main.current, dUnit='°';
  const [condText, condIcon]=wmo(c.weather_code, c.is_day);
  const current={
    loc:HOME, temp:Math.round(c.temperature_2m)+dUnit, cond:condText, icon:condIcon+'.gif',
    wind:(c.wind_speed_10m<1?'Calm':compass(c.wind_direction_10m)+' '+Math.round(c.wind_speed_10m)),
    humidity:Math.round(c.relative_humidity_2m)+'%',
    dewpoint:Math.round(c.dew_point_2m)+dUnit,
    visibility:(c.visibility>=16000?'10+ mi':(c.visibility/1609).toFixed(0)+' mi'),
    pressure:(c.surface_pressure*0.02953).toFixed(2),
  };

  const daily=main.daily, forecast=[];
  for(let i=0;i<Math.min(4,daily.time.length);i++){
    const dt=new Date(daily.time[i]+'T12:00');
    const [,ic]=wmo(daily.weather_code[i],1);
    forecast.push({day:DOW[dt.getDay()], icon:ic+'.gif', hi:Math.round(daily.temperature_2m_max[i])+dUnit, lo:Math.round(daily.temperature_2m_min[i])+dUnit});
  }

  const observations=CITIES.map((c0,i)=>{
    const cc=cityArr[i]?.current||{};
    return {city:c0[0], t:(cc.temperature_2m!=null?Math.round(cc.temperature_2m):'--'),
      w:(cc.weather_code!=null?shortCond(cc.weather_code):'--'),
      wind:(cc.wind_speed_10m!=null?(cc.wind_speed_10m<1?'CALM':compass(cc.wind_direction_10m)+' '+Math.round(cc.wind_speed_10m)):'--')};
  });

  const ill=SunCalc.getMoonIllumination(now);
  const almanac={
    sunrise:fmtTime(daily.sunrise[0]), sunset:fmtTime(daily.sunset[0]),
    sunriseTom:fmtTime(daily.sunrise[1]), sunsetTom:fmtTime(daily.sunset[1]),
    moon:moonName(ill.phase), moonFrac:Math.round(ill.fraction*100)+'%',
  };

  const date = DOW[now.getDay()] + ' ' + MON[now.getMonth()] + ' ' + now.getDate();
  const updated = now.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',timeZone:TZ}).toLowerCase().replace(' ','');
  // placeholder ticker until news sources are wired
  const ticker = [
    `Updated ${updated}`,
    `Now ${current.temp} ${current.cond}`,
    `Today high ${forecast[0]?.hi||''} low ${forecast[0]?.lo||''}`,
    `Sunrise ${almanac.sunrise}`, `Sunset ${almanac.sunset}`, `Moon ${almanac.moon}`,
  ].join('  •  ');

  return {date, dateShort:DOW[now.getDay()], current, forecast, observations, almanac, ticker,
          generated: now.toISOString()};
}

// allow `node data.mjs` to print the payload for debugging
if(import.meta.url===`file://${process.argv[1]}`){
  getData().then(d=>console.log(JSON.stringify(d,null,2))).catch(e=>{console.error(e);process.exit(1)});
}
