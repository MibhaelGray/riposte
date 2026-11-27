'use strict';
// =====================================================================
//  RIPOSTE — a duel to the bell
//  Single-player PvE sword-duel platformer. Everything is code:
//  art is drawn procedurally, sound is synthesized with WebAudio.
// =====================================================================

// ---------- constants ----------
const W = 320, H = 180, S = 3;          // internal resolution and upscale
const ZW = 320;                          // width of one zone (one screen)
const GROUND = 150;
const GRAV = 0.22, JUMP = 4.3, RUN = 1.35;
const STANCE_OFF = [14, 10, 5];          // high / mid / low, measured up from the feet
const STANCE_NAME = ['HIGH', 'MID', 'LOW'];

// ---------- canvas ----------
const canvas = document.getElementById('game');
canvas.width = W * S; canvas.height = H * S;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
const buf = document.createElement('canvas');
buf.width = W; buf.height = H;
const g = buf.getContext('2d');

function fit() {
  const r = Math.min(innerWidth / W, innerHeight / H);
  canvas.style.width = Math.floor(W * r) + 'px';
  canvas.style.height = Math.floor(H * r) + 'px';
}
addEventListener('resize', fit); fit();

// ---------- input ----------
const keys = {}, pressed = {};
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
  KeyJ: 'attack', KeyX: 'attack', KeyK: 'jump', KeyZ: 'jump', Space: 'jump',
  KeyL: 'throw', KeyC: 'throw', ShiftLeft: 'roll', ShiftRight: 'roll', KeyV: 'roll',
  KeyU: 'slash', KeyI: 'heavy', KeyO: 'parry',
  Enter: 'start', Escape: 'pause', KeyP: 'pause', KeyR: 'restart', KeyM: 'mute',
};
addEventListener('keydown', e => {
  const k = KEYMAP[e.code]; if (!k) return;
  e.preventDefault(); audioInit();
  if (!keys[k]) pressed[k] = true;
  keys[k] = true;
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

// ---------- audio (synthesized) ----------
let AC = null, master = null, noiseBuf = null, muted = false;
function audioInit() {
  if (AC) return;
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.5; master.connect(AC.destination);
  } catch (e) { AC = null; }
}
function tone(f, d, type = 'square', v = 0.08, slide = 0, delay = 0) {
  if (!AC || muted) return;
  const t = AC.currentTime + delay;
  const o = AC.createOscillator(), gn = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f + slide), t + d);
  gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(gn); gn.connect(master); o.start(t); o.stop(t + d + 0.02);
}
function noise(d, v = 0.1, freq = 1000, delay = 0) {
  if (!AC || muted) return;
  if (!noiseBuf) {
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 2, AC.sampleRate);
    const a = noiseBuf.getChannelData(0);
    for (let i = 0; i < a.length; i++) a[i] = Math.random() * 2 - 1;
  }
  const t = AC.currentTime + delay;
  const s = AC.createBufferSource(); s.buffer = noiseBuf;
  const f = AC.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  const gn = AC.createGain();
  gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + d);
  s.connect(f); f.connect(gn); gn.connect(master); s.start(t); s.stop(t + d + 0.02);
}
const sfx = {
  clang() { tone(1400, 0.12, 'square', 0.05, -300); tone(2100, 0.2, 'triangle', 0.05, -200); noise(0.05, 0.08, 4000); },
  swish() { noise(0.08, 0.06, 2500); },
  slash() { noise(0.16, 0.09, 1600); tone(420, 0.12, 'triangle', 0.03, -200); },
  charge() { tone(180, 0.25, 'sawtooth', 0.03, 260); },
  heavy() { noise(0.18, 0.12, 900); tone(140, 0.2, 'square', 0.05, -60); },
  parry() { tone(2400, 0.3, 'triangle', 0.06, -900); tone(1600, 0.4, 'sine', 0.05); noise(0.06, 0.1, 5000); },
  kill() { noise(0.3, 0.25, 600); tone(160, 0.25, 'sawtooth', 0.07, -100); },
  hurt() { noise(0.15, 0.15, 900); tone(300, 0.15, 'square', 0.05, -150); },
  jump() { tone(260, 0.09, 'square', 0.03, 180); },
  disarm() { tone(700, 0.08, 'square', 0.05, 700); tone(1800, 0.25, 'triangle', 0.04, -600, 0.03); },
  throw() { noise(0.12, 0.08, 1800); tone(500, 0.1, 'triangle', 0.03, 300); },
  punch() { noise(0.08, 0.15, 350); tone(110, 0.08, 'square', 0.05, -40); },
  thud() { noise(0.25, 0.22, 200); tone(70, 0.25, 'sine', 0.1, -30); },
  blink() { tone(900, 0.15, 'sine', 0.04, -700); tone(300, 0.2, 'sine', 0.04, 600, 0.05); },
  pickup() { tone(660, 0.06, 'square', 0.04); tone(990, 0.08, 'square', 0.04, 0, 0.05); },
  stance() { tone(1200, 0.02, 'square', 0.012); },
  clear() { [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'square', 0.04, 0, i * 0.08)); },
  death() { tone(220, 0.7, 'sawtooth', 0.05, -180); },
  thunder() { noise(1.6, 0.25, 120, 0.15); noise(0.4, 0.15, 400, 0.1); },
  boss() { tone(98, 1.2, 'sawtooth', 0.05); tone(147, 1.2, 'sawtooth', 0.04, 0, 0.1); },
  bell() {
    [262, 330, 392, 523, 784].forEach((f, i) => tone(f, 3, 'sine', 0.07, 0, i * 0.02));
    tone(131, 3.5, 'triangle', 0.06);
  },
};

// ---------- tiny helpers ----------
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
function hash(n) { const s = Math.sin(n * 127.1) * 43758.5453; return s - Math.floor(s); }
function pxLine(x0, y0, x1, y1, c) {
  g.fillStyle = c;
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1, err = dx + dy;
  for (let i = 0; i < 400; i++) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function disc(cx, cy, r, col) {
  g.fillStyle = col;
  for (let y = -r; y <= r; y++) {
    const w = Math.floor(Math.sqrt(r * r - y * y));
    g.fillRect(cx - w, cy + y, w * 2 + 1, 1);
  }
}
function makeGlow(rgbInner, rgbOuter) {
  const c = document.createElement('canvas'); c.width = c.height = 48;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(24, 24, 0, 24, 24, 24);
  gr.addColorStop(0, rgbInner); gr.addColorStop(1, rgbOuter);
  x.fillStyle = gr; x.fillRect(0, 0, 48, 48);
  return c;
}
const glow = makeGlow('rgba(255,170,80,0.5)', 'rgba(255,120,60,0)');
const glowCool = makeGlow('rgba(140,220,255,0.45)', 'rgba(80,160,255,0)');

// ---------- palettes (one per act) ----------
function makeSky(stops) { const gr = g.createLinearGradient(0, 0, 0, H); stops.forEach(([o, c]) => gr.addColorStop(o, c)); return gr; }
const PAL = [
  { sky: makeSky([[0, '#120a22'], [0.45, '#3a1b4a'], [0.72, '#a8426a'], [0.86, '#f39a62'], [1, '#f7b678']]),
    sun: ['#ffc98a', '#ffe0a8'], sunY: 128, sunR: 30, m1: '#7a3360', tower: '#4a1f4e', m2: '#4e2150', ruin: '#2d1636',
    banner: '#5c1a2e', mist: 'rgba(255,170,140,0.08)', ground: '#1b1221', brick: '#140d19', edge: '#7a4e6e', edge2: '#4a2f4a' },
  { sky: makeSky([[0, '#05070e'], [0.5, '#141d32'], [0.8, '#2b3a56'], [1, '#43557a']]),
    sun: null, m1: '#26324c', tower: '#1c2438', m2: '#1a2236', ruin: '#111726',
    banner: '#1f3a4a', mist: 'rgba(150,170,210,0.1)', ground: '#10141e', brick: '#0b0e16', edge: '#5a6c8c', edge2: '#2e3a52' },
  { sky: makeSky([[0, '#05030a'], [0.5, '#1a0a1e'], [0.8, '#4a0f24'], [1, '#7a1a2a']]),
    sun: ['#a8262e', '#e04a48'], sunY: 52, sunR: 16, m1: '#3a0f22', tower: '#2a0a18', m2: '#250a1a', ruin: '#170812',
    banner: '#4a0a14', mist: 'rgba(255,80,90,0.07)', ground: '#140a10', brick: '#0e070b', edge: '#6a2a3a', edge2: '#3a1420' },
  { sky: makeSky([[0, '#2a3a6a'], [0.45, '#8a6a9a'], [0.75, '#f0a080'], [1, '#ffe0a0']]),
    sun: ['#fff0c0', '#ffffff'], sunY: 140, sunR: 34, m1: '#9a6a8a', tower: '#6a4a6a', m2: '#6a4a6a', ruin: '#4a3048',
    banner: '#a07a30', mist: 'rgba(255,230,190,0.12)', ground: '#24182a', brick: '#1a1020', edge: '#c08aa0', edge2: '#6a4a62' },
];

// ---------- enemies ----------
const TYPES = {
  squire:  { name: 'Squire',  body: '#3d2a40', accent: '#ff5a6a', reaction: 34, aggr: 0.35, beat: 0.05, range: 30, speed: 0.8,  hp: 1, h: 18, rearm: 420, turn: 12 },
  duelist: { name: 'Duelist', body: '#28324e', accent: '#ffa040', reaction: 18, aggr: 0.6,  beat: 0.2,  range: 27, speed: 1.0,  hp: 1, h: 18, rearm: 300, turn: 9, parry: 0.25 },
  thrower: { name: 'Knifer',  body: '#30244a', accent: '#c07bff', reaction: 24, aggr: 0.4,  beat: 0.05, range: 62, speed: 1.0,  hp: 1, h: 18, rearm: 90,  turn: 8, throws: true },
  acolyte: { name: 'Acolyte', body: '#1e3434', accent: '#5affc0', reaction: 14, aggr: 0.55, beat: 0.1,  range: 36, speed: 1.35, hp: 1, h: 17, rearm: 200, turn: 6, dash: true },
  shade:   { name: 'Shade',   body: '#120f1a', accent: '#9a8aff', reaction: 16, aggr: 0.5,  beat: 0.15, range: 28, speed: 1.0,  hp: 1, h: 18, rearm: 200, turn: 7, blink: true, slash: 0.25 },
  gaoler:  { name: 'THE GAOLER', body: '#3b2a20', accent: '#ff7a2a', reaction: 20, aggr: 0.65, beat: 0.0, range: 24, speed: 0.75, hp: 4, h: 24, rearm: 120, turn: 10,
             boss: true, grip: true, slash: 0.7, heavy: 0.25, line: 'NO ONE CLIMBS PAST THE GAOLER. NO ONE EVER HAS.' },
  warden:  { name: 'THE WARDEN', body: '#17121d', accent: '#ffd54a', reaction: 11, aggr: 0.7,  beat: 0.35, range: 26, speed: 1.05, hp: 3, h: 21, rearm: 150, turn: 6,
             boss: true, parry: 0.45, slash: 0.3, heavy: 0.3, line: 'I SWORE YOUR OATH ONCE, WREN. THE BELL STAYS SILENT. GO HOME.' },
};

// ---------- zones, level geometry & story ----------
const solids = [], platforms = [], torches = [];
function rect(x, y, w, h) { solids.push({ x, y, w, h }); }
const ZONES = [
  { act: 0, title: 'ACT I — THE GATE', name: 'The Outer Gate', enemies: ['squire'], max: 1, weather: 'embers',
    story: 'The outer gate. A squire still keeps his watch, a hundred years after his king died.',
    hint: 'MATCH THEIR STANCE TO BLOCK  ·  STRIKE WHERE THEY ARE NOT',
    geo: z => { rect(z, GROUND, 320, 40); torches.push(z + 70, z + 250); } },
  { act: 0, name: 'Lantern Walk', enemies: ['squire', 'squire'], max: 1, weather: 'embers',
    story: 'Lanterns no living hand has lit burn along the walk.',
    hint: 'BLADES TOUCHING? FLICK YOUR STANCE TO DISARM  ·  U SLASHES THROUGH ANY GUARD',
    geo: z => { rect(z, GROUND, 320, 40); platforms.push({ x: z + 110, y: 122, w: 46 }, { x: z + 192, y: 108, w: 40 }); torches.push(z + 80, z + 280); } },
  { act: 0, name: 'The Broken Span', enemies: ['duelist'], max: 1, weather: 'embers',
    story: 'The span broke the night the king fell. His duelists never left it.',
    hint: 'DUELISTS PARRY  ·  O TO PARRY A THRUST AND LEAVE THEM OPEN',
    geo: z => { rect(z, GROUND, 140, 40); rect(z + 176, GROUND, 144, 40); torches.push(z + 60, z + 260); } },
  { act: 1, title: 'ACT II — THE DROWNED HALL', name: 'Hall of Knives', enemies: ['thrower', 'squire'], max: 2, weather: 'rain',
    story: 'Rain pours through the broken roof. The knifers here never let a climber get close.',
    hint: 'BLOCK A THROWN BLADE AT ITS HEIGHT  ·  OR ROLL BENEATH IT',
    geo: z => { rect(z, GROUND, 320, 40); platforms.push({ x: z + 40, y: 120, w: 44 }, { x: z + 236, y: 120, w: 44 }); torches.push(z + 150, z + 190); } },
  { act: 1, name: "The Gaoler's Pit", enemies: ['gaoler'], max: 1, weather: 'rain',
    story: 'Chains hang from the ceiling. Something heavy drags itself across the stone.',
    hint: 'HIS GRIP CANNOT BE BROKEN  ·  I FOR A HEAVY LUNGE, OR PARRY HIS SWINGS',
    geo: z => { rect(z, GROUND, 320, 40); torches.push(z + 40, z + 160, z + 280); } },
  { act: 1, name: 'Cloister of Ash', enemies: ['acolyte', 'acolyte', 'duelist'], max: 2, weather: 'rain',
    story: 'The acolytes tend the ashes of the old order. They move like smoke and strike from far away.',
    hint: 'ACOLYTES DASH IN FROM RANGE  ·  KEEP YOUR GUARD AT THEIR HEIGHT',
    geo: z => { rect(z, GROUND, 320, 40); platforms.push({ x: z + 136, y: 116, w: 48 }); torches.push(z + 60, z + 260); } },
  { act: 2, title: 'ACT III — THE SPIRE', name: 'The Dais', enemies: ['duelist', 'thrower', 'duelist'], max: 2, weather: 'ash',
    story: 'The old court waits on the dais for a king who will never return.',
    hint: 'IN THE AIR, HOLD ↓ AND PRESS J TO PLUNGE  ·  SHIFT IN THE AIR TO DASH',
    geo: z => { rect(z, GROUND, 320, 40); rect(z + 130, GROUND - 12, 60, 12); torches.push(z + 50, z + 270); } },
  { act: 2, name: 'Shadow Stair', enemies: ['shade', 'shade', 'shade'], max: 2, weather: 'ash',
    story: 'This high up, the dead have forgotten their own shapes. Shades step between the shadows.',
    hint: 'SHADES APPEAR BEHIND YOU  ·  NEVER STAND STILL',
    geo: z => { rect(z, GROUND, 110, 40); rect(z + 146, GROUND, 174, 40); platforms.push({ x: z + 60, y: 118, w: 40 }, { x: z + 200, y: 112, w: 44 }); torches.push(z + 30, z + 290); } },
  { act: 2, name: "Warden's Landing", enemies: ['warden'], max: 1, weather: 'ash',
    story: 'The Warden was the first of your order. He swore the same oath you did, and broke it.',
    hint: 'THE WARDEN PARRIES, SLASHES AND DISARMS  ·  THREE WOUNDS FELL HIM',
    geo: z => { rect(z, GROUND, 320, 40); torches.push(z + 40, z + 160, z + 280); } },
  { act: 3, title: 'THE BELL', name: 'The Bell', enemies: [], max: 0, weather: 'petals',
    story: 'Dawn. The bell hangs before you.',
    hint: 'RING THE BELL',
    geo: z => { rect(z, GROUND, 320, 40); torches.push(z + 180, z + 300); } },
];
ZONES.forEach((zn, i) => zn.geo(i * ZW));
const BELL_X = (ZONES.length - 1) * ZW + 240;

const INTRO = [
  'For a hundred years the Bell of Asher has hung silent at the top of the spire.',
  'While it stays silent, the dead stay at their posts. Squires, duelists and the Warden himself still guard the stair, fencing in the dark for a king long gone.',
  'You are Wren, the last of the Riposte, an order sworn to ring the bell. You are all that is left of that oath.',
  'Climb. Strike where they are not.',
];
const ENDING = [
  'The bell sounds across the valley for the first time in a hundred years.',
  'On every landing of the spire the old guard lower their blades, lie down in the ash, and rest.',
  'Wren sits beneath the bell until the sun is fully up. The oath is kept.',
  'THE END',
];

// ---------- game state ----------
let state = 'title';
let zi = 0, cleared = false, queue = [], spawnT = 0;
let player = null, enemies = [], swords = [], projs = [], parts = [];
let camX = 0, deaths = 0, kills = 0, timeF = 0, tick = 0;
let respawnT = 0, freeze = 0, shake = 0, flash = 0, provideT = 0, lightning = 0;
let winT = 0, bellSwing = 0, bannerT = 0, storyT = 0, speech = null;
let pages = null, pageI = 0, pageChars = 0, pagesDone = null;
const seenStory = new Set();
const weatherP = [];
for (let i = 0; i < 90; i++) weatherP.push({ x: rnd(0, W), y: rnd(0, H), s: rnd(0.6, 1.4), p: rnd(0, 6) });

function makeFighter(x, y, team, type) {
  const T = type ? TYPES[type] : null;
  return {
    x, y, vx: 0, vy: 0, facing: team === 'player' ? 1 : -1, team, type, T,
    stance: 1, prevStance: 1, armed: true, onGround: false, hitWall: false,
    lunge: 0, heavyL: false, windup: 0, slash: 0, parry: 0, plunge: false, dash: 0, dashDir: 1, airDashed: false,
    cool: 0, stun: 0, down: 0, roll: 0, rollDir: 1, kick: false, punch: 0,
    dead: false, deadT: 0, hp: T ? T.hp : 1, invuln: 0, flash: 0, anim: 0,
    h: T ? T.h : 18, want: 1, react: 30, turnT: 0, stanceCd: 0, plan: 'guard', dashNext: false, blinkT: 0,
    unarmedT: 0, contactT: 0, scarf: [],
  };
}
function clearActions(f) { f.lunge = 0; f.heavyL = false; f.windup = 0; f.slash = 0; f.parry = 0; f.dash = 0; f.plunge = false; }

function showPages(list, done) { pages = list; pageI = 0; pageChars = 0; pagesDone = done; state = 'story'; }

function newGame(startZone_ = 0) {
  deaths = 0; kills = 0; timeF = 0;
  swords = []; projs = []; parts = []; enemies = [];
  player = makeFighter(startZone_ * ZW + 40, GROUND, 'player');
  camX = startZone_ * ZW; respawnT = 0; provideT = 0; speech = null;
  seenStory.clear();
  startZone(startZone_);
  state = 'play';
}

function startZone(i) {
  zi = i;
  queue = ZONES[i].enemies.slice();
  cleared = queue.length === 0;
  spawnT = i === 0 ? 100 : 50;
  bannerT = ZONES[i].title ? 200 : 150;
  if (!seenStory.has(i)) { seenStory.add(i); storyT = 360; }
}

function respawn() {
  enemies = []; swords = []; projs = [];
  player = makeFighter(zi * ZW + 30, GROUND, 'player');
  player.invuln = 70;
  provideT = 0; speech = null;
  startZone(zi);
  bannerT = 0;
}

// ---------- fighter geometry ----------
function stanceY(f, s = f.stance) { return f.y - STANCE_OFF[s]; }
function lungeExt(f) {
  if (f.lunge <= 0) return 0;
  const L = f.heavyL ? 16 : 12, M = f.heavyL ? 12 : 6, k = f.heavyL ? 4 : 2;
  const t = L - f.lunge;
  if (t < 3) return Math.min(M, t * k);
  if (f.lunge > 3) return M;
  return Math.min(M, f.lunge * k);
}
function reach(f) { return 13 + lungeExt(f); }
function bodyBox(f) {
  const h = f.dead ? 3 : f.roll > 0 ? 8 : f.down > 0 ? 6 : f.h;
  return { x: f.x - 3, y: f.y - h, w: 6, h };
}
function pointIn(x, y, b) { return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }
function zoneL() { return zi * ZW + 4; }
function zoneR() { return (zi + 1) * ZW - 4; }
function bladeBusy(f) { return f.parry > 0 || f.slash > 0 || f.windup > 0 || f.plunge; }

// ---------- physics ----------
function overlapR(ax, ay, aw, ah, b) { return ax < b.x + b.w && ax + aw > b.x && ay < b.y + b.h && ay + ah > b.y; }
function physics(e, w, h) {
  e.vy = Math.min(e.vy + GRAV, 6);
  e.x += e.vx; e.hitWall = false;
  for (const s of solids) {
    if (overlapR(e.x - w / 2, e.y - h, w, h, s)) {
      if (e.vx > 0) e.x = s.x - w / 2; else if (e.vx < 0) e.x = s.x + s.w + w / 2;
      e.hitWall = true; e.vx = 0;
    }
  }
  const prevY = e.y, was = e.onGround;
  e.y += e.vy; e.onGround = false;
  for (const s of solids) {
    if (overlapR(e.x - w / 2, e.y - h, w, h, s)) {
      if (e.vy > 0) { e.y = s.y; e.onGround = true; } else { e.y = s.y + s.h + h; }
      e.vy = 0;
    }
  }
  if (e.vy >= 0) {
    for (const p of platforms) {
      if (e.x + w / 2 > p.x && e.x - w / 2 < p.x + p.w && prevY <= p.y && e.y >= p.y) {
        e.y = p.y; e.vy = 0; e.onGround = true;
      }
    }
  }
  return !was && e.onGround;
}
function solidAt(x, y) {
  for (const s of solids) if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) return true;
  return false;
}
function groundBelow(x, y) {
  for (const s of solids) if (x >= s.x && x <= s.x + s.w && s.y >= y - 2 && s.y < y + 60) return true;
  for (const p of platforms) if (x >= p.x && x <= p.x + p.w && p.y >= y - 2 && p.y < y + 60) return true;
  return false;
}

// ---------- particles ----------
function burst(x, y, n, color, spd = 2, life = 30, grav = 0.12, stick = false) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = Math.random() * spd;
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.5, life: life * rnd(0.5, 1), grav, color, stick });
  }
}
function spray(x, y, dir, n, color) {
  for (let i = 0; i < n; i++) {
    parts.push({ x, y, vx: dir * rnd(0.4, 3), vy: rnd(-2.5, 0.5), life: rnd(40, 70), grav: 0.15, color, stick: true });
  }
}
function sparks(x, y) { burst(x, y, 12, '#fff3b0', 2.5, 14, 0.05); burst(x, y, 5, '#ffffff', 1.5, 8, 0); }
function dust(x, y, n = 8) { for (let i = 0; i < n; i++) parts.push({ x: x + rnd(-6, 6), y, vx: rnd(-1.2, 1.2), vy: rnd(-0.8, -0.1), life: rnd(14, 26), grav: 0.02, color: '#8a6a80', stick: false }); }

// ---------- combat ----------
function fighterColors(f) {
  return f.team === 'player' ? { body: '#f3ecdf', acc: '#4fd8ff' } : { body: f.T.body, acc: f.T.accent };
}
function dropSword(f, dir, vy = -2.8) {
  swords.push({ x: f.x + f.facing * 6, y: stanceY(f), vx: dir * rnd(0.6, 1.6), vy, onGround: false, age: 0 });
  f.armed = false; f.unarmedT = 0; clearActions(f);
}
function kill(f, dir) {
  if (f.dead || f.invuln > 0) return;
  const c = fighterColors(f);
  if (f.hp > 1) {
    f.hp--; f.invuln = 50; f.stun = 22; f.flash = 8; f.vx = dir * 3; clearActions(f);
    spray(f.x, f.y - 10, dir, 16, c.acc); sfx.hurt(); freeze = 6; shake = 5;
    return;
  }
  f.dead = true; f.deadT = 0; f.vx = dir * 1.6; f.vy = -1.6;
  if (f.armed) dropSword(f, dir, -3.2);
  clearActions(f);
  spray(f.x, f.y - 10, dir, 26, c.acc);
  burst(f.x, f.y - 10, 8, c.body, 1.5, 30, 0.1, true);
  sfx.kill(); shake = 7; freeze = 6;
  if (f.team === 'player') { deaths++; respawnT = 110; sfx.death(); }
  else {
    kills++;
    if (f.T.boss) { freeze = 28; shake = 12; flash = 0.5; speech = null; burst(f.x, f.y - 12, 40, f.T.accent, 3, 60, 0.05); }
  }
}
function disarm(victim, by) {
  if (victim.T && victim.T.grip) { victim.stun = 26; victim.vx = (victim.x > by.x ? 1 : -1) * 2.5; clearActions(victim); sparks((victim.x + by.x) / 2, stanceY(victim)); sfx.clang(); freeze = 4; return; }
  const dir = victim.x > by.x ? 1 : -1;
  swords.push({ x: victim.x + victim.facing * 8, y: stanceY(victim), vx: dir * rnd(0.5, 1.5), vy: -3.8, onGround: false, age: 0 });
  victim.armed = false; victim.unarmedT = 0; victim.stun = 14; clearActions(victim);
  sparks((victim.x + by.x) / 2, stanceY(victim));
  sfx.disarm(); freeze = 4; shake = 3;
}
function tryParry(def, att) {
  if (def.parry <= 0 || !def.armed || def.dead) return false;
  if ((att.x - def.x) * def.facing <= 0) return false;
  att.stun = att.T && att.T.boss ? 34 : 54; att.vx = -att.facing * 1.5; clearActions(att);
  def.parry = 0; def.cool = 0;
  sparks(def.x + def.facing * 6, def.y - 13);
  burst(def.x + def.facing * 6, def.y - 13, 10, '#9fe8ff', 2, 20, 0);
  sfx.parry(); freeze = 9; shake = 3;
  return true;
}
function crossedS(a, b, sa, sb) {
  if (!a.armed || !b.armed || a.dead || b.dead) return false;
  if (a.roll > 0 || b.roll > 0 || a.down > 0 || b.down > 0 || a.stun > 0 || b.stun > 0) return false;
  if (bladeBusy(a) || bladeBusy(b)) return false;
  if (a.facing === b.facing) return false;
  if ((b.x - a.x) * a.facing <= 0) return false;
  if (Math.abs(stanceY(a, sa) - stanceY(b, sb)) > 2) return false;
  return Math.abs(b.x - a.x) <= reach(a) + reach(b) - 1;
}
function bladeHits(a, b) {
  if (!a.armed || a.roll > 0 || a.down > 0 || a.dead || a.stun > 0 || b.dead || bladeBusy(a)) return false;
  const y = stanceY(a), hx = a.x + a.facing * 3, tx = a.x + a.facing * reach(a);
  const bb = bodyBox(b);
  if (y < bb.y || y > bb.y + bb.h) return false;
  const lo = Math.min(hx, tx), hi = Math.max(hx, tx);
  return hi >= bb.x && lo <= bb.x + bb.w;
}
function slashHits(a, b) {
  if (!a.armed || a.slash < 7 || a.slash > 12 || b.dead || a.dead) return false;
  const x0 = a.facing > 0 ? a.x + 1 : a.x - 16;
  return overlapR(x0, a.y - 21, 15, 21, bodyBox(b));
}
function plungeHits(a, b) {
  if (!a.plunge || !a.armed || b.dead || a.dead) return false;
  return overlapR(a.x - 3, a.y - 3, 6, 9, bodyBox(b));
}
function plungeLand(f) {
  dust(f.x, f.y, 16); burst(f.x, f.y - 1, 10, '#ffffff', 2.2, 12, 0.05);
  shake = 5; sfx.thud(); f.stun = 10;
  const foes = f.team === 'player' ? enemies : [player];
  for (const t of foes) {
    if (t.dead || !t.onGround || Math.abs(t.x - f.x) > 26 || Math.abs(t.y - f.y) > 6) continue;
    t.stun = Math.max(t.stun, 26); t.vx = (t.x > f.x ? 1 : -1) * 2.4; clearActions(t);
  }
}
function clash(a, b) {
  a.lunge = 0; b.lunge = 0; a.heavyL = false; b.heavyL = false;
  a.vx = -a.facing * 2.2; b.vx = -b.facing * 2.2;
  a.cool = Math.max(a.cool, 10); b.cool = Math.max(b.cool, 10);
  sparks((a.x + b.x) / 2, stanceY(a));
  sfx.clang(); freeze = 3; shake = 2;
}
function unarmedHits(a, b) {
  if (a.dead || b.dead) return;
  if (a.punch === 6) {
    const px = a.x + a.facing * 7, py = a.y - 12, bb = bodyBox(b);
    if (pointIn(px, py, bb) || (b.down > 0 && Math.abs(b.x - px) < 7)) {
      if (b.down > 0 || b.stun > 0) kill(b, a.facing);
      else { b.stun = 28; b.vx = a.facing * 2.2; clearActions(b); sfx.punch(); burst(px, py, 6, '#ffffff', 1.5, 10, 0); shake = 2; }
    }
  }
  if (a.kick) {
    const bb = bodyBox(b);
    if (pointIn(a.x + a.facing * 3, a.y - 2, bb) || pointIn(a.x, a.y - 1, bb)) {
      if (b.down > 0) kill(b, a.facing);
      else {
        b.down = b.T && b.T.boss ? 30 : 55; b.vx = a.facing * 2.5; clearActions(b);
        if (b.armed && !(b.T && b.T.grip)) dropSword(b, a.facing);
        a.kick = false; a.vy = -2.6; a.vx = -a.facing * 1.2;
        sfx.punch(); burst(a.x, a.y, 8, '#ffffff', 2, 12, 0); shake = 4; freeze = 3;
      }
    }
  }
}
function combat() {
  const p = player;
  for (const e of enemies) {
    if (e.dead || p.dead) continue;
    const was = crossedS(p, e, p.prevStance, e.prevStance);
    const nowPre = crossedS(p, e, p.stance, e.stance);
    if (was && !nowPre && e.contactT > 5) {
      const pc = p.stance !== p.prevStance, ec = e.stance !== e.prevStance;
      if (pc && !ec) disarm(e, p); else if (ec && !pc) disarm(p, e);
    }
    const now = crossedS(p, e, p.stance, e.stance);
    if (now) {
      e.contactT++;
      if (p.lunge > 0 || e.lunge > 0) {
        if (p.heavyL && !e.heavyL) disarm(e, p);
        else if (e.heavyL && !p.heavyL) disarm(p, e);
        else clash(p, e);
      } else {
        const d = Math.abs(e.x - p.x), min = reach(p) + reach(e) - 8;
        if (d < min) { p.x -= p.facing * 0.6; e.x -= e.facing * 0.6; }
      }
    } else {
      e.contactT = 0;
      let ph = bladeHits(p, e), eh = bladeHits(e, p);
      if (ph && tryParry(e, p)) ph = false;
      if (eh && tryParry(p, e)) eh = false;
      if (ph) kill(e, p.facing);
      if (eh) kill(p, e.facing);
    }
    if (slashHits(p, e) && !tryParry(e, p)) kill(e, p.facing);
    if (slashHits(e, p) && !tryParry(p, e)) kill(p, e.facing);
    if (plungeHits(p, e)) kill(e, p.facing);
    if (plungeHits(e, p)) kill(p, e.facing);
    unarmedHits(p, e); unarmedHits(e, p);
  }
}

// ---------- control (shared by player and AI) ----------
function faceUpdate(f, move) {
  if (f.team === 'player') {
    let best = null, bd = 110;
    for (const e of enemies) {
      if (e.dead) continue;
      const d = Math.abs(e.x - f.x);
      if (d < bd && Math.abs(e.y - f.y) < 40) { bd = d; best = e; }
    }
    if (best) f.facing = best.x > f.x ? 1 : -1;
    else if (move) f.facing = move;
  } else {
    if (player && !player.dead && Math.abs(player.x - f.x) < 220) {
      const want = player.x > f.x ? 1 : -1;
      if (want !== f.facing) { if (++f.turnT >= f.T.turn) { f.facing = want; f.turnT = 0; } }
      else f.turnT = 0;
    } else if (move) f.facing = move;
  }
}
function control(f, inp) {
  f.prevStance = f.stance;
  if (f.dead) { if (f.onGround) f.vx *= 0.85; return; }
  if (f.stun > 0) { f.stun--; f.vx *= 0.85; return; }
  if (f.down > 0) { f.down--; f.vx *= 0.85; return; }
  if (f.roll > 0) { f.roll--; f.vx = f.rollDir * 2.3; return; }
  if (f.kick) { if (f.onGround) { f.kick = false; f.stun = 6; } return; }
  if (f.plunge) { if (f.onGround) { f.plunge = false; plungeLand(f); } return; }
  if (f.dash > 0) { f.dash--; f.vx = f.dashDir * 3.6; f.vy = Math.min(f.vy, 0.2); return; }
  if (f.windup > 0) {
    f.windup--; f.vx *= 0.75;
    if (f.windup === 0) { f.lunge = 16; f.heavyL = true; f.vx = f.facing * 2.6; sfx.heavy(); }
    return;
  }

  const move = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  if (f.lunge <= 0 && f.slash <= 0) faceUpdate(f, move);
  if (f.onGround) f.airDashed = false;
  const back = move && move !== f.facing;
  const busy = f.lunge > 0 || f.slash > 0 || f.parry > 0;
  const spd = RUN * (f.T ? f.T.speed : 1) * (back ? 0.72 : 1) * (busy ? 0.4 : 1);
  if (move) f.vx += (move * spd - f.vx) * (f.onGround ? 0.3 : 0.12);
  else f.vx *= f.onGround ? 0.7 : 0.97;

  const isP = f.team === 'player';
  if (f.armed && f.parry <= 0) {
    if (inp.upP && f.stance > 0) { f.stance--; if (isP) sfx.stance(); }
    if (inp.downP && f.stance < 2) { f.stance++; if (isP) sfx.stance(); }
  }
  if (inp.jumpP && f.onGround) { f.vy = -JUMP; f.onGround = false; if (isP) { sfx.jump(); dust(f.x, f.y, 4); } }
  if (inp.rollP && f.cool <= 0) {
    if (f.onGround) { f.roll = 16; f.rollDir = move || f.facing; f.cool = 12; clearActions(f); sfx.swish(); return; }
    if (!f.airDashed) { f.dash = 10; f.dashDir = move || f.facing; f.airDashed = true; f.cool = 8; f.lunge = 0; sfx.swish(); return; }
  }
  if (inp.attackP && f.cool <= 0) {
    if (f.armed) {
      if (!f.onGround && inp.down) { f.plunge = true; f.vy = 5; f.vx *= 0.3; f.cool = 20; sfx.swish(); }
      else { f.lunge = 12; f.heavyL = false; f.cool = 24; f.vx += f.facing * (f.dashNext ? 4 : 1); sfx.swish(); }
      f.dashNext = false;
    }
    else if (!f.onGround) { f.kick = true; f.vx = f.facing * 3; f.vy = Math.max(f.vy, 2.2); f.cool = 20; sfx.swish(); }
    else { f.punch = 10; f.cool = 16; sfx.swish(); }
  }
  if (inp.slashP && f.armed && f.cool <= 0) { f.slash = 18; f.cool = 30; f.lunge = 0; sfx.slash(); }
  if (inp.heavyP && f.armed && f.onGround && f.cool <= 0) { f.windup = 14; f.cool = 44; f.lunge = 0; f.vx = 0; sfx.charge(); }
  if (inp.parryP && f.armed && f.cool <= 0) { f.parry = 10; f.cool = 26; f.lunge = 0; }
  if (inp.throwP && f.armed && f.cool <= 0) {
    projs.push({ x: f.x + f.facing * 6, y: stanceY(f), vx: f.facing * 5.5, team: f.team, life: 80 });
    f.armed = false; f.unarmedT = 0; f.cool = 16; clearActions(f); sfx.throw();
  }
}

// ---------- AI ----------
function otherStance(s) { const o = [0, 1, 2].filter(v => v !== s); return o[Math.floor(Math.random() * o.length)]; }
function nearestSword(e) {
  let best = null, bd = 1e9;
  for (const s of swords) {
    if (s.x < zoneL() || s.x > zoneR()) continue;
    const d = Math.abs(s.x - e.x);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
function aiInput(e) {
  const inp = {};
  const p = player, T = e.T;
  if (e.dead || e.stun > 0 || e.down > 0 || e.roll > 0 || e.kick || e.windup > 0) return inp;
  if (e.stanceCd > 0) e.stanceCd--;
  const dx = p.x - e.x, dist = Math.abs(dx), dir = dx >= 0 ? 1 : -1;
  let move = 0;
  const steer = s => {
    if (e.stanceCd > 0 || !e.armed) return;
    if (s < e.stance) { inp.upP = true; e.stanceCd = 5; }
    else if (s > e.stance) { inp.downP = true; e.stanceCd = 5; }
  };
  if (p.dead) { steer(1); return inp; }

  // shades step through the dark to land behind you
  if (T.blink && e.armed && e.onGround && ++e.blinkT > 170 && dist < 160 && p.onGround) {
    const nx = p.x - p.facing * 20;
    if (nx > zoneL() + 8 && nx < zoneR() - 8 && groundBelow(nx, p.y)) {
      burst(e.x, e.y - 9, 16, T.accent, 1.3, 26, -0.02);
      e.x = nx; e.y = p.y; e.vx = 0; e.vy = 0; e.facing = p.x > nx ? 1 : -1; e.turnT = 0; e.react = 14;
      burst(e.x, e.y - 9, 16, T.accent, 1.3, 26, -0.02);
      e.blinkT = 0; sfx.blink();
      return inp;
    }
    e.blinkT = 110;
  }

  if (!e.armed) {
    const s = nearestSword(e);
    if (s && (!p.armed || Math.abs(s.x - e.x) < Math.abs(s.x - p.x) + 20)) {
      move = Math.abs(s.x - e.x) < 3 ? 0 : Math.sign(s.x - e.x);
    } else if (p.armed) {
      move = dist < 80 ? -dir : 0;
      if (dist < 28 && e.onGround && Math.random() < 0.05) inp.jumpP = true;
    } else {
      move = dist > 8 ? dir : 0;
      if (dist < 10 && e.cool <= 0 && Math.random() < 0.15) inp.attackP = true;
    }
  } else {
    const crossing = crossedS(p, e, p.stance, e.stance);
    if (--e.react <= 0) {
      e.react = Math.round(T.reaction * rnd(0.6, 1.4));
      if (!p.armed) { e.want = p.down > 0 ? 2 : (!p.onGround ? 0 : 1); e.plan = 'attack'; }
      else if (Math.random() < T.aggr * 0.6 || (T.throws && dist > 45)) { e.want = otherStance(p.stance); e.plan = 'attack'; }
      else { e.want = p.stance; e.plan = 'guard'; }
    }
    if (p.roll > 0 && dist < 45) e.want = 2;
    if (!p.onGround && p.y < e.y - 8 && dist < 50) e.want = 0;
    if (p.down > 0 && dist < 30) { e.want = 2; e.plan = 'attack'; }
    if (crossing && e.contactT > 8 && Math.random() < T.beat * 0.08) {
      e.want = e.stance === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1; e.stanceCd = 0;
    }
    steer(e.want);

    let target = e.plan === 'attack' ? 19 : T.range;
    if (!p.armed) target = 12;
    if (dist > target + 3) move = dir; else if (dist < target - 3) move = -dir;

    if (e.cool <= 0) {
      const threat = p.lunge > 7 || p.slash > 12 || (p.windup > 0 && p.windup < 5);
      if (T.parry && threat && dist < 38 && Math.random() < T.parry * 0.35) inp.parryP = true;
      else if (T.slash && dist <= 16 && Math.random() < T.slash * 0.08) inp.slashP = true;
      else if (T.heavy && e.onGround && dist > 24 && dist < 34 && Math.random() < T.heavy * 0.03) inp.heavyP = true;
      else if (T.dash && dist > 28 && dist < 54 && e.stance !== p.stance && Math.random() < 0.05) { inp.attackP = true; e.dashNext = true; }
      else if (dist <= 23) {
        const open = !p.armed || e.stance !== p.stance || p.down > 0 || p.stun > 0;
        if (open && e.stance === e.want && Math.random() < T.aggr * 0.3) inp.attackP = true;
        else if (!open && Math.random() < 0.008) inp.attackP = true;
      }
    }
    if (T.throws && e.cool <= 0 && dist > 45 && dist < 150 && e.stance !== p.stance && Math.abs(p.y - e.y) < 6 && Math.random() < 0.03) inp.throwP = true;
  }

  if (move && e.onGround) {
    const ahead = e.x + move * 9;
    if (!groundBelow(ahead, e.y)) {
      const across = (p.x - ahead) * move > 0 && dist < 140;
      if (across) inp.jumpP = true; else move = 0;
    }
    if (e.hitWall) inp.jumpP = true;
  }
  if (move > 0) inp.right = true; else if (move < 0) inp.left = true;
  return inp;
}

// ---------- update ----------
function updateScarf(f) {
  const ax = f.x - f.facing * 2, ay = f.y - f.h + 1;
  if (f.scarf.length === 0) for (let i = 0; i < 8; i++) f.scarf.push({ x: ax, y: ay });
  f.scarf[0].x = ax; f.scarf[0].y = ay;
  const wind = ZONES[zi].weather === 'rain' ? -0.6 : 0;
  for (let i = 1; i < f.scarf.length; i++) {
    const s = f.scarf[i], q = f.scarf[i - 1];
    s.x += (q.x - f.facing * 1.6 - f.vx * 0.4 + wind - s.x) * 0.5;
    s.y += (q.y + Math.sin(tick * 0.25 + i) * 0.7 + 0.15 - s.y) * 0.5;
  }
}

function stepPlay() {
  if (pressed.pause) { state = 'paused'; return; }
  if (pressed.restart) { newGame(); return; }
  tick++;
  if (freeze > 0) { freeze--; return; }
  timeF++;

  const pin = player.dead ? {} : {
    left: keys.left, right: keys.right, down: keys.down, upP: pressed.up, downP: pressed.down,
    attackP: pressed.attack, jumpP: pressed.jump, throwP: pressed.throw, rollP: pressed.roll,
    slashP: pressed.slash, heavyP: pressed.heavy, parryP: pressed.parry,
  };
  control(player, pin);
  for (const e of enemies) control(e, aiInput(e));

  // physics & timers
  const all = [player, ...enemies];
  for (const f of all) {
    const fallV = f.vy;
    const landed = physics(f, 6, 18);
    if (landed && !f.dead && fallV > 3) dust(f.x, f.y, 5);
    if (f === player) {
      const R = cleared && zi < ZONES.length - 1 ? (zi + 2) * ZW - 4 : zoneR();
      const nx = clamp(f.x, zoneL(), R); if (nx !== f.x) { f.x = nx; f.vx = 0; }
    } else if (f.y > 0) {
      const nx = clamp(f.x, zoneL(), zoneR()); if (nx !== f.x) { f.x = nx; f.vx = 0; f.hitWall = true; }
    }
    if (f.lunge > 0) { f.lunge--; if (f.lunge === 0) f.heavyL = false; }
    if (f.slash > 0) f.slash--;
    if (f.parry > 0) f.parry--;
    if (f.cool > 0) f.cool--;
    if (f.punch > 0) f.punch--;
    if (f.invuln > 0) f.invuln--;
    if (f.flash > 0) f.flash--;
    if (f.dead) f.deadT++;
    f.anim++;
    if (!f.dead && f.y > H + 20) { // fell into a pit
      f.dead = true; f.armed = false; f.fell = true; clearActions(f);
      if (f === player) { deaths++; respawnT = 90; sfx.death(); } else kills++;
    }
    if (f.T && !f.armed && !f.dead) {
      if (++f.unarmedT > f.T.rearm) { f.armed = true; f.unarmedT = 0; burst(f.x, f.y - 10, 10, f.T.accent, 1.2, 20, 0); }
    }
  }
  updateScarf(player);

  // loose swords
  for (const s of swords) {
    s.age++;
    if (!s.onGround) s.vx *= 0.99; else s.vx *= 0.8;
    physics(s, 8, 2);
  }
  swords = swords.filter(s => s.y < H + 30);

  // thrown swords
  for (const p of projs) {
    p.x += p.vx; p.life--;
    if (solidAt(p.x, p.y) || p.x < zoneL() - 4 || p.x > zoneR() + 4 || p.life <= 0) {
      swords.push({ x: p.x - Math.sign(p.vx) * 4, y: p.y, vx: -p.vx * 0.15, vy: -1.5, onGround: false, age: 0 });
      p.done = true; continue;
    }
    const targets = p.team === 'player' ? enemies : [player];
    for (const t of targets) {
      if (t.dead || p.done) continue;
      const bb = bodyBox(t);
      const hit = (pointIn(p.x, p.y, bb) || pointIn(p.x - p.vx / 2, p.y, bb));
      if (!hit) continue;
      const facingIt = t.facing === -Math.sign(p.vx);
      const blocks = t.armed && t.stun <= 0 && t.roll <= 0 && t.down <= 0 && facingIt &&
        (t.parry > 0 || t.slash > 0 || (!bladeBusy(t) && Math.abs(stanceY(t) - p.y) <= 3));
      if (blocks) { sparks(p.x, p.y); sfx.clang(); freeze = 3; }
      else kill(t, Math.sign(p.vx));
      swords.push({ x: p.x, y: p.y, vx: -p.vx * 0.25, vy: -2.5, onGround: false, age: 0 });
      p.done = true;
    }
  }
  projs = projs.filter(p => !p.done);

  // pickups
  for (const f of all) {
    if (f.armed || f.dead || f.stun > 0 || f.down > 0 || f.kick) continue;
    for (const s of swords) {
      if (s.age < 18 || s.taken) continue;
      if (Math.abs(s.x - f.x) < 7 && Math.abs(s.y - f.y) < 10) {
        s.taken = true; f.armed = true; f.stance = 1; f.prevStance = 1; f.unarmedT = 0;
        if (f === player) sfx.pickup();
        break;
      }
    }
  }
  swords = swords.filter(s => !s.taken);

  combat();

  // a blade from above if the player is left with nothing
  if (!player.dead && !player.armed) {
    const any = swords.some(s => s.x > zoneL() && s.x < zoneR());
    if (!any && ++provideT > 200) {
      let x = clamp(player.x + (Math.random() < 0.5 ? -40 : 40), zoneL() + 10, zoneR() - 10);
      if (!groundBelow(x, GROUND)) x = player.x;
      swords.push({ x, y: -10, vx: 0, vy: 1, onGround: false, age: 0, gift: true });
      provideT = 0;
    }
  } else provideT = 0;

  enemies = enemies.filter(e => !(e.dead && (e.deadT > 260 || e.y > H + 40)));

  // zone flow
  if (!player.dead) {
    if (!cleared) {
      const alive = enemies.filter(e => !e.dead).length;
      if (queue.length && alive < ZONES[zi].max && --spawnT <= 0) {
        const mid = zi * ZW + ZW / 2;
        const x = player.x < mid ? (zi + 1) * ZW - 26 : zi * ZW + 26;
        const e = makeFighter(x, -20, 'enemy', queue.shift());
        e.facing = player.x > x ? 1 : -1;
        enemies.push(e);
        if (e.T.line) { speech = { who: e.T.name, text: e.T.line, t: 300, col: e.T.accent }; sfx.boss(); }
        spawnT = 80;
      }
      if (!queue.length && alive === 0 && enemies.every(e => e.dead)) { cleared = true; sfx.clear(); }
    } else if (zi < ZONES.length - 1 && player.x > (zi + 1) * ZW + 40) {
      startZone(zi + 1);
    }
    if (zi === ZONES.length - 1 && Math.abs(player.x - BELL_X) < 12) {
      state = 'win'; winT = 0; bellSwing = 1; flash = 1; sfx.bell();
      burst(BELL_X, 112, 60, '#ffe39a', 3, 80, 0.03);
    }
  } else if (--respawnT <= 0) respawn();

  // camera
  let tx = zi * ZW;
  if (cleared && zi < ZONES.length - 1) tx = clamp(player.x - W * 0.4, zi * ZW, (zi + 1) * ZW);
  camX += (tx - camX) * 0.1;

  // storm
  if (ZONES[zi].weather === 'rain' && lightning <= 0 && Math.random() < 0.003) { lightning = 10; sfx.thunder(); }
  if (lightning > 0) lightning--;

  updateParticles();
  if (shake > 0) shake *= 0.85;
  if (shake < 0.3) shake = 0;
  if (bannerT > 0) bannerT--;
  if (storyT > 0) storyT--;
  if (speech && --speech.t <= 0) speech = null;
}

function updateParticles() {
  for (const p of parts) {
    p.life--;
    if (p.landed) continue;
    p.vy += p.grav; p.x += p.vx; p.y += p.vy;
    if (p.stick && solidAt(p.x, p.y)) { p.landed = true; p.y = Math.floor(p.y); p.life = Math.max(p.life, 300); }
  }
  parts = parts.filter(p => p.life > 0);
  if (parts.length > 1200) parts.splice(0, parts.length - 1200);
  const wth = state === 'title' ? 'embers' : ZONES[zi].weather;
  for (const w of weatherP) {
    if (wth === 'rain') { w.x += -1.2 * w.s; w.y += 5 * w.s; }
    else if (wth === 'ash') { w.x += Math.sin(tick * 0.02 + w.p) * 0.3; w.y += 0.35 * w.s; }
    else if (wth === 'petals') { w.x += 0.5 * w.s + Math.sin(tick * 0.03 + w.p) * 0.4; w.y += 0.3 * w.s; }
    else { w.x += -0.15 * w.s + Math.sin(tick * 0.02 + w.p) * 0.1; w.y -= 0.25 * w.s; }
    if (w.y > H + 4) { w.y = -4; w.x = rnd(0, W + 60); }
    if (w.y < -4) { w.y = H + 4; w.x = rnd(0, W); }
    if (w.x < -6) w.x += W + 12;
    if (w.x > W + 6) w.x -= W + 12;
  }
}

function step() {
  if (pressed.mute) muted = !muted;
  if (state === 'title') {
    tick++; camX = (Math.sin(tick * 0.002) * 0.5 + 0.5) * 200; updateParticles();
    if (pressed.start || pressed.attack || pressed.jump) showPages(INTRO, () => newGame());
  } else if (state === 'story') {
    tick++; updateParticles();
    pageChars += 1.4;
    const full = pages[pageI].length;
    if (pressed.pause) { pagesDone(); }
    else if (pressed.start || pressed.attack || pressed.jump) {
      if (pageChars < full) pageChars = full;
      else if (++pageI >= pages.length) pagesDone();
      else pageChars = 0;
    }
  } else if (state === 'play') {
    stepPlay();
  } else if (state === 'paused') {
    if (pressed.pause || pressed.start) state = 'play';
    if (pressed.restart) newGame();
  } else if (state === 'win') {
    tick++; winT++; updateParticles();
    bellSwing *= 0.985;
    if (winT > 90 && (pressed.start || pressed.attack)) showPages(ENDING, () => { state = 'title'; });
  }
  if (flash > 0) flash = Math.max(0, flash - 0.03);
  for (const k in pressed) pressed[k] = false;
}

// ---------- rendering ----------
function curPal() { return PAL[state === 'title' ? 0 : ZONES[zi].act]; }

function layer(p, col, base, a) {
  g.fillStyle = col;
  for (let x = 0; x < W; x += 2) {
    const wx = x + camX * p;
    const h = Math.round(base + a[0] * Math.sin(wx * a[1]) + a[2] * Math.sin(wx * a[3] + 1.3) + a[4] * Math.sin(wx * a[5] + 2));
    g.fillRect(x, h, 2, H - h);
  }
}

function drawBackground() {
  const P = curPal();
  g.fillStyle = P.sky; g.fillRect(0, 0, W, H);
  // stars
  if (P !== PAL[3]) {
    for (let i = 0; i < 46; i++) {
      const sx = Math.round(((hash(i) * W * 3 - camX * 0.02) % W + W) % W), sy = Math.round(hash(i + 50) * 70);
      if ((tick + i * 17) % 120 < 110) { g.fillStyle = hash(i + 9) > 0.7 ? '#ffe9c8' : '#9b86c4'; g.fillRect(sx, sy, 1, 1); }
    }
  }
  // sun / moon
  if (P.sun) {
    const sunX = Math.round(205 - camX * 0.03);
    g.globalAlpha = 0.25; disc(sunX, P.sunY, P.sunR + 8, P.sun[1]); g.globalAlpha = 1;
    disc(sunX, P.sunY, P.sunR, P.sun[0]); disc(sunX, P.sunY, Math.round(P.sunR * 0.8), P.sun[1]);
  }
  // clouds (storm)
  if (P === PAL[1]) {
    g.fillStyle = '#0a0e18';
    for (let i = 0; i < 8; i++) {
      const cx = ((i * 97 - camX * 0.08 - tick * 0.05) % (W + 120) + W + 120) % (W + 120) - 60;
      for (let r = 0; r < 6; r++) g.fillRect(Math.round(cx - 30 + r * 2), 20 + i % 3 * 12 + r, 60 - r * 4, 1);
    }
  }
  // far mountains
  layer(0.1, P.m1, 100, [16, 0.011, 8, 0.029, 3, 0.09]);
  // the spire — the goal on the horizon
  const tx = Math.round(300 - camX * 0.1);
  g.fillStyle = P.tower;
  g.fillRect(tx - 7, 46, 14, 100); g.fillRect(tx - 10, 72, 20, 4); g.fillRect(tx - 9, 100, 18, 3);
  for (let i = 0; i < 14; i++) g.fillRect(tx - Math.floor(i / 2), 32 + i, Math.floor(i / 2) * 2 + 1, 1);
  g.fillStyle = (tick % 80 < 40) ? '#ffd54a' : '#d9a53c'; g.fillRect(tx - 1, 52, 3, 3);
  // nearer hills
  layer(0.25, P.m2, 116, [10, 0.017, 6, 0.043, 2, 0.13]);
  // ruins
  const p = 0.5, sp = 90;
  const k0 = Math.floor((camX * p) / sp) - 1;
  for (let k = k0; k < k0 + 6; k++) {
    const sx = Math.round(k * sp - camX * p), top = 66 + Math.floor(hash(k) * 30);
    g.fillStyle = P.ruin;
    g.fillRect(sx, top, 10, GROUND - top); g.fillRect(sx - 2, top, 14, 3);
    if (hash(k + 3) > 0.45) {
      for (let x = 0; x < sp - 10; x++) {
        const ay = Math.round(top + 6 + Math.pow((x - (sp - 10) / 2) / ((sp - 10) / 2), 2) * -10 + 10);
        g.fillRect(sx + 10 + x, ay - 4, 1, 3);
      }
    }
    if (hash(k + 7) > 0.5) {
      const sway = Math.round(Math.sin(tick * 0.03 + k) * 1);
      g.fillStyle = P.banner; g.fillRect(sx + 2 + sway, top + 8, 6, 22);
      g.fillStyle = P.ruin; g.fillRect(sx + 4 + sway, top + 28, 2, 2);
    }
  }
  // mist
  g.fillStyle = P.mist; g.fillRect(0, 122, W, 28);
  if (lightning > 0 && lightning % 4 < 2) { g.fillStyle = 'rgba(220,230,255,0.35)'; g.fillRect(0, 0, W, H); }
}

function drawWorld() {
  const cx = Math.round(camX);
  g.globalCompositeOperation = 'lighter';
  for (const t of torches) {
    const x = t - cx; if (x < -30 || x > W + 30) continue;
    const r = 1 + Math.sin(tick * 0.3 + t) * 0.06 + Math.sin(tick * 0.71 + t) * 0.04;
    const gl = ZONES[Math.floor(t / ZW)].act === 2 ? glowCool : glow;
    g.drawImage(gl, x - 30 * r, 120 - 30 * r, 60 * r, 60 * r);
  }
  g.globalCompositeOperation = 'source-over';
  for (const t of torches) {
    const x = t - cx; if (x < -10 || x > W + 10) continue;
    const cool = ZONES[Math.floor(t / ZW)].act === 2;
    g.fillStyle = '#2a1a22'; g.fillRect(x - 1, 128, 2, 22); g.fillRect(x - 2, 127, 4, 2);
    const fl = Math.floor(tick / 4 + t) % 3;
    g.fillStyle = cool ? '#4ab8ff' : '#ff8a3a'; g.fillRect(x - 1, 123 - fl, 3, 4 + fl);
    g.fillStyle = cool ? '#d0f0ff' : '#ffe07a'; g.fillRect(x, 125 - fl, 1, 2);
  }
  for (const p of platforms) {
    const x = p.x - cx; if (x > W || x + p.w < 0) continue;
    g.fillStyle = '#2e1d30';
    for (let y = 0; y < p.y; y += 3) { g.fillRect(x + 2, y, 1, 2); g.fillRect(x + p.w - 3, y, 1, 2); }
    g.fillStyle = '#5a3a4e'; g.fillRect(x, p.y, p.w, 4);
    g.fillStyle = '#a06e82'; g.fillRect(x, p.y, p.w, 1);
    g.fillStyle = '#3a2438'; g.fillRect(x, p.y + 3, p.w, 1);
  }
  for (const s of solids) {
    const x = s.x - cx; if (x > W || x + s.w < 0) continue;
    const P = PAL[ZONES[clamp(Math.floor(s.x / ZW), 0, ZONES.length - 1)].act];
    g.fillStyle = P.ground; g.fillRect(x, s.y, s.w, s.h);
    g.fillStyle = P.brick;
    for (let r = 0; r * 6 + 3 < s.h; r++) {
      const y = s.y + 3 + r * 6;
      if (y > H) break;
      g.fillRect(x, y, s.w, 1);
      for (let bx = (r % 2 ? 0 : 6); bx < s.w; bx += 12) g.fillRect(x + bx, y + 1, 1, 5);
    }
    g.fillStyle = P.edge; g.fillRect(x, s.y, s.w, 1);
    g.fillStyle = P.edge2; g.fillRect(x, s.y + 1, s.w, 1);
    for (let bx = 3; bx < s.w; bx += 7) if (hash(s.x + bx) > 0.6) { g.fillStyle = P.edge2; g.fillRect(x + bx, s.y - 1, 1, 1); }
    if (P === PAL[1]) { // puddle shine
      g.fillStyle = 'rgba(160,190,240,0.25)';
      for (let bx = 8; bx < s.w; bx += 37) g.fillRect(x + bx, s.y + 1, 10, 1);
    }
  }
  // chains in the Gaoler's pit
  const gz = 4 * ZW - cx;
  if (gz > -ZW && gz < W) {
    g.fillStyle = '#3a2a28';
    for (let i = 0; i < 6; i++) { const cxx = gz + 30 + i * 52, len = 30 + hash(i) * 50; for (let y = 0; y < len; y += 3) g.fillRect(cxx + Math.round(Math.sin(tick * 0.02 + i) * y * 0.03), y, 1, 2); }
  }
  // the bell
  const bx = BELL_X - cx;
  if (bx > -40 && bx < W + 40) {
    g.fillStyle = '#2a1a22';
    g.fillRect(bx - 20, 92, 3, 58); g.fillRect(bx + 18, 92, 3, 58); g.fillRect(bx - 23, 90, 47, 4);
    g.fillStyle = '#4a2f3a'; g.fillRect(bx - 23, 90, 47, 1);
    const sw = Math.sin(tick * 0.18) * bellSwing * 4;
    for (let r = 0; r < 22; r++) {
      const hw = Math.round(4 + Math.pow(r / 21, 1.6) * 9);
      const off = Math.round(sw * r / 21);
      g.fillStyle = r > 19 ? '#a0742a' : '#d9a53c';
      g.fillRect(bx - hw + off, 96 + r, hw * 2 + 1, 1);
      g.fillStyle = '#ffe39a'; g.fillRect(bx - hw + 2 + off, 96 + r, 1, 1);
    }
    g.fillStyle = '#6b4a1a'; g.fillRect(bx - 1 + Math.round(sw * 1.4), 118, 3, 3);
    if (state !== 'win' && zi === ZONES.length - 1 && tick % 60 < 30) {
      g.fillStyle = '#fff3c0'; g.fillRect(bx + 6, 102, 1, 1); g.fillRect(bx - 8, 110, 1, 1);
    }
  }
}

function drawScarf(f, cx) {
  for (let i = 1; i < f.scarf.length; i++) {
    const a = f.scarf[i - 1], b = f.scarf[i];
    pxLine(a.x - cx, a.y, b.x - cx, b.y, i < 3 ? '#4fd8ff' : i < 6 ? '#2a9bc4' : '#1d6f90');
  }
}

function drawFighter(f, ghostOff = 0) {
  const cx = Math.round(camX);
  const X = Math.round(f.x - ghostOff) - cx, Y = Math.round(f.y);
  if (X < -40 || X > W + 40) return;
  const isP = f.team === 'player';
  if (!ghostOff && !f.dead && isP && f.invuln > 0 && Math.floor(f.invuln / 4) % 2) return;
  const d = f.facing;
  const c = fighterColors(f);
  const body = f.flash > 0 ? '#ffffff' : c.body, acc = c.acc;
  const steel = isP ? '#eaf7ff' : '#cfc8e0';
  if (f.dead) {
    g.fillStyle = body; g.fillRect(X - 6, Y - 2, 12, 2);
    g.fillRect(d > 0 ? X - 10 : X + 6, Y - 3, 4, 3);
    g.fillStyle = acc; g.fillRect(d > 0 ? X - 9 : X + 7, Y - 3, 1, 1);
    return;
  }
  if (f.roll > 0) {
    const a = (16 - f.roll) / 16 * Math.PI * 2 * f.rollDir;
    disc(X, Y - 4, 4, body);
    g.fillStyle = acc; g.fillRect(Math.round(X + Math.cos(a) * 3), Math.round(Y - 4 + Math.sin(a) * 3), 2, 2);
    if (f.armed) { g.fillStyle = steel; g.fillRect(Math.round(X - Math.cos(a) * 5), Math.round(Y - 4 - Math.sin(a) * 5), 1, 1); }
    return;
  }
  const top = Y - f.h;
  const stars = () => {
    const t = f.anim * 0.2; g.fillStyle = '#ffe066';
    g.fillRect(X + Math.round(Math.cos(t) * 4), (f.down > 0 ? Y - 9 : top - 3) + Math.round(Math.sin(t)), 1, 1);
    g.fillRect(X - Math.round(Math.cos(t) * 4), (f.down > 0 ? Y - 9 : top - 3) - Math.round(Math.sin(t)), 1, 1);
  };
  if (f.down > 0) {
    g.fillStyle = body; g.fillRect(X - 6, Y - 3, 12, 3);
    g.fillRect(d > 0 ? X - 10 : X + 6, Y - 4, 4, 4);
    stars(); return;
  }
  if (isP && !ghostOff) drawScarf(f, cx);
  else if (f.type === 'warden' || f.type === 'gaoler') {
    g.fillStyle = f.type === 'warden' ? '#5c1a1a' : '#4a2a14';
    for (let i = 0; i < f.h - 8; i++) { const w = 1 + Math.floor(i / 3); g.fillRect(d > 0 ? X - 2 - w : X + 2, top + 5 + i, w, 1); }
  }
  // legs
  const hipY = Y - 7;
  if (f.kick) {
    pxLine(X, hipY, X + d * 6, Y, body); pxLine(X + 1, hipY, X + d * 6 + 1, Y, body);
    pxLine(X, hipY, X - d * 2, Y - 3, body);
  } else {
    let a = 0, b = 0;
    if (!f.onGround) { a = -2; b = 2; }
    else if (f.windup > 0 || f.lunge > 0) { a = d * 3; b = -d * 3; }
    else if (Math.abs(f.vx) > 0.25) { const ph = Math.floor(f.anim / 5) % 4; a = [-3, -1, 3, 1][ph]; b = -a; }
    const ly = f.onGround ? Y - 1 : Y - 2;
    pxLine(X - 1, hipY, X - 1 + a, ly, body); pxLine(X, hipY, X + a, ly, body);
    pxLine(X, hipY, X + b, ly, body); pxLine(X + 1, hipY, X + 1 + b, ly, body);
  }
  // torso + head (bosses are broader)
  const broad = f.type === 'gaoler' ? 1 : 0;
  g.fillStyle = body;
  g.fillRect(X - 2 - broad, top + 5, 4 + broad * 2, f.h - 12);
  g.fillRect(X - 2, top, 4, 4);
  const eyeX = d > 0 ? X + 1 : X - 2;
  g.fillStyle = isP ? '#1a1020' : acc; g.fillRect(eyeX, top + 1, 1, 1);
  if (isP) { g.fillStyle = acc; g.fillRect(d > 0 ? X - 2 : X + 1, top + 1, 1, 1); }
  else if (f.type === 'warden') { g.fillStyle = acc; g.fillRect(X - 2, top - 1, 1, 1); g.fillRect(X, top - 2, 1, 2); g.fillRect(X + 1, top - 1, 1, 1); }
  else if (f.type === 'gaoler') { g.fillStyle = '#5a4030'; g.fillRect(X - 3, top - 1, 6, 2); g.fillStyle = acc; g.fillRect(eyeX, top + 1, 1, 1); }
  else if (f.type === 'acolyte') { g.fillStyle = body; g.fillRect(X - 3, top - 1, 6, 2); g.fillRect(X - 3, top, 1, 6); g.fillRect(X + 2, top, 1, 6); }
  else if (f.type !== 'shade') { g.fillStyle = acc; g.fillRect(X - 1, top - 1, 2, 1); g.fillRect(d > 0 ? X - 2 : X + 1, top - 2, 1, 2); }

  // arm + blade
  const shX = X + d, shY = top + 6;
  if (f.armed) {
    if (f.slash > 0) {
      const t = (18 - f.slash) / 18;
      const ang = t < 0.33 ? -2.1 : -2.1 + (t - 0.33) / 0.67 * 2.9;
      const hx = shX + d * Math.cos(ang) * 4, hy = shY + Math.sin(ang) * 4;
      pxLine(shX, shY, hx, hy, body);
      pxLine(hx, hy, hx + d * Math.cos(ang) * 12, hy + Math.sin(ang) * 12, steel);
      if (f.slash >= 6 && f.slash <= 13) {
        for (let a = ang - 1.4; a < ang; a += 0.08) {
          const al = 0.15 + 0.6 * (a - (ang - 1.4)) / 1.4;
          g.fillStyle = `rgba(255,255,255,${al.toFixed(2)})`;
          g.fillRect(Math.round(shX + d * Math.cos(a) * 15), Math.round(shY + Math.sin(a) * 15), 1, 1);
          g.fillRect(Math.round(shX + d * Math.cos(a) * 14), Math.round(shY + Math.sin(a) * 14), 1, 1);
        }
      }
    } else if (f.parry > 0) {
      pxLine(shX, shY, X + d * 4, Y - 11, body);
      pxLine(X + d * 5, Y - 22, X + d * 5, Y - 6, steel);
      g.fillStyle = acc; g.fillRect(X + d * 5 - 1, Y - 10, 3, 1);
      if (f.parry > 6) { g.fillStyle = '#ffffff'; g.fillRect(X + d * 5, Y - 23, 1, 1); g.fillRect(X + d * 6, Y - 22, 1, 1); }
    } else if (f.windup > 0) {
      const hx = X - d * 3, hy = Y - 11;
      pxLine(shX, shY, hx, hy, body);
      pxLine(hx - d * 2, hy - 1, hx + d * 10, hy, (f.windup % 4 < 2) ? '#ffffff' : steel);
      g.fillStyle = acc; g.fillRect(hx - d, hy - 1, 1, 3);
    } else if (f.plunge) {
      pxLine(shX, shY, X + d * 2, Y - 8, body);
      pxLine(X + d * 2, Y - 7, X + d * 2, Y + 5, steel);
      g.fillStyle = 'rgba(255,255,255,0.4)'; g.fillRect(X + d * 2, Y - 20, 1, 12);
    } else {
      const ext = lungeExt(f);
      let hy = Math.round(stanceY(f)), hx = X + d * (4 + Math.round(ext * 0.7));
      if (f.stun > 0) hy = Y - 6;
      pxLine(shX, shY, hx, hy, body);
      g.fillStyle = acc; g.fillRect(hx + d, hy - 1, 1, 3);
      const tipX = f.stun > 0 ? hx + d * 9 : X + d * reach(f);
      pxLine(hx + d * 2, hy, tipX, f.stun > 0 ? hy + 3 : hy, f.heavyL ? '#ffffff' : steel);
      if (ext >= 6) {
        g.fillStyle = '#ffffff'; g.fillRect(tipX, hy, 1, 1);
        g.fillStyle = f.heavyL ? 'rgba(255,220,140,0.5)' : 'rgba(255,255,255,0.35)';
        g.fillRect(Math.min(hx, tipX) - (f.heavyL ? d * 8 : 0), hy - 1, Math.abs(tipX - hx) + (f.heavyL ? 8 : 0), 1);
        if (f.heavyL) g.fillRect(Math.min(hx, tipX), hy + 1, Math.abs(tipX - hx), 1);
      }
    }
  } else {
    const px = f.punch > 3 ? X + d * 7 : X + d * 3, py = f.punch > 3 ? Y - 12 : Y - 10;
    pxLine(shX, shY, px, py, body);
  }
  if (f.stun > 0) stars();
}

function drawFighterFull(f) {
  const fast = !f.dead && (f.dash > 0 || Math.abs(f.vx) > 2.6 || f.heavyL);
  if (fast) {
    g.globalAlpha = 0.18; drawFighter(f, f.vx * 4);
    g.globalAlpha = 0.32; drawFighter(f, f.vx * 2);
  }
  g.globalAlpha = f.type === 'shade' && !f.dead ? 0.72 + Math.sin(tick * 0.2) * 0.15 : 1;
  drawFighter(f);
  g.globalAlpha = 1;
}

function drawSwords() {
  const cx = Math.round(camX);
  for (const s of swords) {
    const X = Math.round(s.x) - cx, Y = Math.round(s.y);
    if (s.onGround) {
      g.fillStyle = '#d8e4ee'; g.fillRect(X - 4, Y - 1, 9, 1);
      g.fillStyle = '#8a6a40'; g.fillRect(X - 5, Y - 2, 1, 3);
      if (player && !player.armed && tick % 40 < 20) { g.fillStyle = '#ffffff'; g.fillRect(X + ((tick >> 2) % 9) - 4, Y - 1, 1, 1); }
    } else {
      const a = s.age * 0.45;
      pxLine(X - Math.cos(a) * 5, Y - Math.sin(a) * 5, X + Math.cos(a) * 5, Y + Math.sin(a) * 5, '#d8e4ee');
      if (s.gift) { g.fillStyle = 'rgba(255,240,180,0.5)'; g.fillRect(X - 1, Y - 12, 2, 10); }
    }
  }
  for (const p of projs) {
    const X = Math.round(p.x) - cx, Y = Math.round(p.y), d = Math.sign(p.vx);
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(Math.min(X - d * 14, X), Y, 14, 1);
    pxLine(X - d * 4, Y, X + d * 5, Y, '#eef6ff');
    g.fillStyle = '#8a6a40'; g.fillRect(X - d * 5, Y - 1, 1, 3);
  }
}

function drawParticles() {
  const cx = Math.round(camX);
  for (const p of parts) {
    g.globalAlpha = p.landed ? Math.min(1, p.life / 60) : Math.min(1, p.life / 10);
    g.fillStyle = p.color; g.fillRect(Math.round(p.x) - cx, Math.round(p.y), 1, 1);
  }
  g.globalAlpha = 1;
}

function drawWeather() {
  const wth = state === 'title' ? 'embers' : ZONES[zi].weather;
  for (const w of weatherP) {
    const x = Math.round(w.x), y = Math.round(w.y);
    if (wth === 'rain') { g.fillStyle = 'rgba(170,195,240,0.35)'; g.fillRect(x, y, 1, 3); g.fillRect(x - 1, y + 3, 1, 2); if (y > GROUND - 2 && y < GROUND + 3) { g.fillStyle = 'rgba(200,220,255,0.5)'; g.fillRect(x - 1, GROUND - 1, 3, 1); } }
    else if (wth === 'ash') { g.fillStyle = 'rgba(200,190,200,0.55)'; g.fillRect(x, y, 1, 1); }
    else if (wth === 'petals') { g.fillStyle = (w.p > 3) ? '#ffc0d0' : '#fff0c0'; g.fillRect(x, y, 2, 1); }
    else if ((tick + w.p * 10) % 90 < 70) { g.fillStyle = 'rgba(255,200,150,0.6)'; g.fillRect(x, y, 1, 1); }
  }
}

function drawBarrier() {
  if (cleared || state !== 'play') return;
  const x = Math.round((zi + 1) * ZW - camX) - 2;
  if (x > W + 2) return;
  for (let y = 0; y < GROUND; y += 2) {
    const a = 0.15 + 0.15 * Math.sin(tick * 0.1 + y * 0.2);
    g.fillStyle = `rgba(255,90,110,${a.toFixed(2)})`; g.fillRect(x, y, 2, 1);
  }
}

// ---------- HUD (drawn at full resolution) ----------
const vignette = (() => {
  const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(W * S / 2, H * S / 2, H * S * 0.35, W * S / 2, H * S / 2, W * S * 0.62);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(5,0,12,0.6)');
  x.fillStyle = gr; x.fillRect(0, 0, c.width, c.height);
  return c;
})();
function text(str, x, y, size = 18, color = '#fff', align = 'left', alpha = 1, font = '"Courier New", Courier, monospace') {
  ctx.globalAlpha = alpha;
  ctx.font = `bold ${size}px ${font}`;
  ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(10,4,18,0.75)'; ctx.fillText(str, x + 2, y + 2);
  ctx.fillStyle = color; ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}
const SERIF = 'Georgia, "Times New Roman", serif';
function wrap(str, maxW, size, font) {
  ctx.font = `bold ${size}px ${font}`;
  const words = str.split(' '), lines = []; let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
  }
  if (line) lines.push(line);
  return lines;
}
function fmtTime(f) {
  const s = f / 60, m = Math.floor(s / 60);
  return `${m}:${(s % 60).toFixed(1).padStart(4, '0')}`;
}
function drawHUD() {
  const CW = W * S, CH = H * S;
  text(`${zi + 1}/${ZONES.length}  ${ZONES[zi].name.toUpperCase()}`, 18, 30, 18, '#f3ecdf');
  text(fmtTime(timeF), CW - 18, 30, 18, '#f3ecdf', 'right');
  text(`FALLEN ${deaths}   SLAIN ${kills}`, CW - 18, 54, 14, '#c9a8d8', 'right');
  for (let i = 0; i < ZONES.length; i++) {
    ctx.fillStyle = i < zi ? '#4fd8ff' : i === zi ? '#ffffff' : 'rgba(255,255,255,0.25)';
    ctx.fillRect(18 + i * 22, 42, 16, 5);
  }
  // stance pips
  const bx = 18, by = CH - 86;
  text(player.armed ? 'STANCE' : 'UNARMED', bx, by - 10, 13, player.armed ? '#9fdcf0' : '#ff8a8a');
  for (let i = 0; i < 3; i++) {
    const on = player.armed && player.stance === i;
    ctx.fillStyle = on ? '#4fd8ff' : 'rgba(255,255,255,0.18)';
    ctx.fillRect(bx, by + i * 20, on ? 46 : 30, 12);
    text(STANCE_NAME[i], bx + 56, by + i * 20 + 11, 12, on ? '#ffffff' : 'rgba(255,255,255,0.4)');
  }
  // boss bar
  const boss = enemies.find(e => e.T.boss && !e.dead);
  if (boss) {
    const bw = 360, x0 = CW / 2 - bw / 2, y0 = CH - 78;
    text(boss.T.name, CW / 2, y0 - 8, 16, boss.T.accent, 'center', 1, SERIF);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x0, y0, bw, 8);
    const seg = bw / boss.T.hp;
    for (let i = 0; i < boss.hp; i++) { ctx.fillStyle = boss.T.accent; ctx.fillRect(x0 + i * seg + 2, y0 + 1, seg - 4, 6); }
  }
  // act title / zone banner
  if (bannerT > 0) {
    const tot = ZONES[zi].title ? 200 : 150;
    const a = Math.max(0, Math.min(1, bannerT / 30, (tot - bannerT) / 20));
    if (ZONES[zi].title) text(ZONES[zi].title, CW / 2, 200, 40, '#ffffff', 'center', a, SERIF);
    text(ZONES[zi].name.toUpperCase(), CW / 2, ZONES[zi].title ? 236 : 150, ZONES[zi].title ? 20 : 34, '#ffe3b0', 'center', a, SERIF);
  }
  // narration
  if (storyT > 0 && bannerT < 60 && !speech) {
    const a = Math.min(1, storyT / 40, (360 - storyT) / 30);
    const lines = wrap(ZONES[zi].story, 620, 17, SERIF);
    ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#05020a'; ctx.fillRect(CW / 2 - 330, 70, 660, 20 + lines.length * 24); ctx.globalAlpha = 1;
    lines.forEach((l, i) => text(l, CW / 2, 94 + i * 24, 17, '#f3e6d0', 'center', a, SERIF));
  }
  // boss speech
  if (speech) {
    const a = Math.min(1, speech.t / 30);
    const lines = wrap(speech.text, 560, 18, SERIF);
    ctx.globalAlpha = a * 0.7; ctx.fillStyle = '#05020a'; ctx.fillRect(CW / 2 - 300, 70, 600, 44 + lines.length * 24); ctx.globalAlpha = 1;
    text(speech.who, CW / 2, 94, 14, speech.col, 'center', a);
    lines.forEach((l, i) => text(l, CW / 2, 120 + i * 24, 18, '#ffffff', 'center', a, SERIF));
  }
  text(ZONES[zi].hint, CW / 2, CH - 22, 14, '#ffe3b0', 'center', 0.8);
  if (zi === 0) text('J THRUST · U SLASH · I HEAVY · O PARRY · L THROW · K JUMP · SHIFT ROLL/DASH', CW / 2, CH - 46, 13, '#ffffff', 'center', 0.85);
  if (cleared && zi < ZONES.length - 1 && !player.dead && tick % 50 < 34) text('GO ➜', CW - 30, CH / 2, 30, '#4fd8ff', 'right');
  if (player.dead) {
    ctx.fillStyle = 'rgba(20,0,10,0.35)'; ctx.fillRect(0, 0, CW, CH);
    text('STRUCK DOWN', CW / 2, CH / 2, 44, '#ff6a7a', 'center', 1, SERIF);
  }
}

function drawTitle() {
  const CW = W * S, CH = H * S;
  ctx.fillStyle = 'rgba(10,4,18,0.45)'; ctx.fillRect(0, 0, CW, CH);
  text('RIPOSTE', CW / 2, 140, 96, '#f3ecdf', 'center', 1, SERIF);
  text('a duel to the bell', CW / 2, 180, 22, '#4fd8ff', 'center', 1, SERIF);
  const lines = [
    ['← →  move', '↑ ↓  raise / lower your blade'],
    ['J  thrust', 'U  slash (breaks any guard, short reach)'],
    ['I  heavy lunge (breaks a block)', 'O  parry (stuns whoever strikes you)'],
    ['K  jump · in air: ↓+J plunge', 'SHIFT  roll · in air: dash'],
    ['L  throw your blade', 'unarmed: J punch · midair J dive-kick'],
  ];
  lines.forEach((l, i) => {
    text(l[0], CW / 2 - 20, 240 + i * 26, 15, '#ffffff', 'right');
    text(l[1], CW / 2 + 20, 240 + i * 26, 15, '#ffffff', 'left');
  });
  text('Match a foe\'s stance to block. One touch of steel is death — for them, and for you.', CW / 2, 390, 15, '#ffd8a8', 'center', 1, SERIF);
  if (tick % 60 < 40) text('PRESS ENTER TO BEGIN', CW / 2, CH - 44, 22, '#ffe39a', 'center');
  text('M: mute   P: pause   R: restart', CW - 14, CH - 12, 11, 'rgba(255,255,255,0.5)', 'right');
}

function drawStory() {
  const CW = W * S, CH = H * S;
  ctx.fillStyle = 'rgba(5,2,10,0.82)'; ctx.fillRect(0, 0, CW, CH);
  const str = pages[pageI].slice(0, Math.floor(pageChars));
  const big = pages[pageI] === 'THE END';
  const lines = wrap(pages[pageI], 700, big ? 48 : 22, SERIF);
  let shown = 0;
  const y0 = CH / 2 - lines.length * 17;
  lines.forEach((l, i) => {
    const part = str.slice(shown, shown + l.length); shown += l.length + 1;
    text(part, CW / 2, y0 + i * 34, big ? 48 : 22, big ? '#ffe39a' : '#f3e6d0', 'center', 1, SERIF);
  });
  for (let i = 0; i < pages.length; i++) { ctx.fillStyle = i === pageI ? '#ffe39a' : 'rgba(255,255,255,0.25)'; ctx.fillRect(CW / 2 - pages.length * 10 + i * 20, CH - 70, 12, 3); }
  if (pageChars >= pages[pageI].length && tick % 60 < 40) text('ENTER ▸', CW - 30, CH - 30, 16, '#ffe39a', 'right');
  text('ESC to skip', 30, CH - 30, 12, 'rgba(255,255,255,0.45)', 'left');
}

function drawWin() {
  const CW = W * S, CH = H * S;
  const a = Math.min(1, winT / 60);
  ctx.fillStyle = `rgba(10,4,18,${0.5 * a})`; ctx.fillRect(0, 0, CW, CH);
  text('THE BELL RINGS', CW / 2, 160, 56, '#ffe39a', 'center', a, SERIF);
  const rank = deaths === 0 ? 'UNBROKEN' : deaths < 4 ? 'RESOLUTE' : deaths < 10 ? 'STUBBORN' : 'UNDYING';
  text(`TIME ${fmtTime(timeF)}     FALLEN ${deaths}     SLAIN ${kills}`, CW / 2, 230, 20, '#ffffff', 'center', a);
  text(rank, CW / 2, 290, 36, '#4fd8ff', 'center', a, SERIF);
  if (winT > 90 && tick % 60 < 40) text('PRESS ENTER', CW / 2, CH - 50, 20, '#ffe39a', 'center');
}

function render() {
  g.save();
  if (shake > 0) g.translate(Math.round(rnd(-shake, shake)), Math.round(rnd(-shake, shake)));
  drawBackground();
  drawWorld();
  if (state !== 'title' && player) {
    drawSwords();
    for (const e of enemies) if (e.dead) drawFighterFull(e);
    for (const e of enemies) if (!e.dead) drawFighterFull(e);
    drawFighterFull(player);
  }
  drawParticles();
  drawBarrier();
  g.restore();
  drawWeather();

  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(buf, 0, 0, W * S, H * S);
  ctx.drawImage(vignette, 0, 0);
  if (flash > 0) { ctx.fillStyle = `rgba(255,245,220,${flash.toFixed(2)})`; ctx.fillRect(0, 0, W * S, H * S); }

  if (state === 'title') drawTitle();
  else if (state === 'story') drawStory();
  else if (player) {
    drawHUD();
    if (state === 'paused') {
      ctx.fillStyle = 'rgba(10,4,18,0.6)'; ctx.fillRect(0, 0, W * S, H * S);
      text('PAUSED', W * S / 2, H * S / 2, 48, '#ffffff', 'center', 1, SERIF);
      text('P to resume · R to restart', W * S / 2, H * S / 2 + 40, 16, '#c9a8d8', 'center');
    }
    if (state === 'win') drawWin();
  }
  if (muted) text('MUTED', W * S / 2, 24, 12, 'rgba(255,255,255,0.5)', 'center');
}

// ---------- main loop (fixed 60 Hz simulation) ----------
// ?zone=N jumps straight into zone N (useful for testing)
const qZone = parseInt(new URLSearchParams(location.search).get('zone'), 10);
if (qZone >= 0 && qZone < ZONES.length) newGame(qZone);

let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(100, now - last); last = now;
  while (acc >= 1000 / 60) { step(); acc -= 1000 / 60; }
  render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
