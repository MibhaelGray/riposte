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
const K = 6;                              // screen pixels per world unit (1920x1080)
const canvas = document.getElementById('game');
canvas.width = W * K; canvas.height = H * K;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;

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
  KeyJ: 'attack', KeyX: 'attack', KeyZ: 'jump', Space: 'jump',
  KeyK: 'throw', KeyC: 'throw', KeyL: 'heavy', ShiftLeft: 'roll', ShiftRight: 'roll', KeyV: 'roll',
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
let player = null, enemies = [], swords = [], projs = [], parts = [], loot = [];
// ---- cosmetics looted from fallen foes (kept between runs) ----
const COSMETICS = {
  squire:  [{ id: 'squire_helm', name: "Squire's Helm", slot: 'head', props: { helm: '#8a8a92' }, col: '#8a8a92' }],
  duelist: [{ id: 'duelist_hat', name: "Duelist's Plumed Hat", slot: 'head', props: { hat: '#17141f', feather: '#ffa040' }, col: '#ffa040' }],
  thrower: [{ id: 'thrower_sash', name: 'Violet Sash', slot: 'sash', props: { sash: '#c07bff' }, col: '#c07bff' },
            { id: 'thrower_hood', name: "Cutpurse's Hood", slot: 'head', props: { hood: true }, col: '#6a5a7a' }],
  acolyte: [{ id: 'acolyte_mask', name: 'Bone Mask', slot: 'face', props: { mask: '#dfe9e4' }, col: '#dfe9e4' }],
  shade:   [{ id: 'shade_hood', name: 'Shade Cowl', slot: 'head', props: { hood: true }, col: '#b8a8ff' }],
  gaoler:  [{ id: 'gaoler_cape', name: "Gaoler's Mantle", slot: 'cape', props: { cape: '#3c1d10' }, col: '#ff7a2a' },
            { id: 'gaoler_chains', name: 'Gaol Chains', slot: 'sash', props: { chains: true }, col: '#6a6460' }],
  warden:  [{ id: 'warden_crown', name: "Warden's Crown", slot: 'head', props: { crown: '#ffd54a' }, col: '#ffd54a' },
            { id: 'warden_cape', name: 'Crimson Cape', slot: 'cape', props: { cape: '#5c1218' }, col: '#ff5a5a' }],
};
const COSMETIC_BY_ID = {}; for (const k in COSMETICS) for (const c of COSMETICS[k]) COSMETIC_BY_ID[c.id] = c;
let wardrobe = {}; // slot -> cosmetic id
try { wardrobe = JSON.parse(localStorage.getItem('riposte.wardrobe') || '{}') || {}; } catch (e) { wardrobe = {}; }
const HEAD_KEYS = ['helm', 'hat', 'feather', 'crown', 'hood'];
function lookOf(f) {
  if (f.team !== 'player') return LOOKS[f.type];
  const L = Object.assign({}, LOOKS.player);
  for (const slot in wardrobe) {
    const c = COSMETIC_BY_ID[wardrobe[slot]]; if (!c) continue;
    if (slot === 'head') for (const k of HEAD_KEYS) delete L[k];
    Object.assign(L, c.props);
  }
  return L;
}
function equip(c) {
  wardrobe[c.slot] = c.id;
  try { localStorage.setItem('riposte.wardrobe', JSON.stringify(wardrobe)); } catch (e) {}
}
const toasts = [];
function toast(x, y, str, col) { toasts.push({ x, y, str, col, t: 0 }); }
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
    unarmedT: 0, contactT: 0, scarf: [], offhand: false,
  };
}
function clearActions(f) { f.lunge = 0; f.heavyL = false; f.windup = 0; f.slash = 0; f.parry = 0; f.dash = 0; f.plunge = false; }

function showPages(list, done) { pages = list; pageI = 0; pageChars = 0; pagesDone = done; state = 'story'; }

function newGame(startZone_ = 0) {
  deaths = 0; kills = 0; timeF = 0;
  swords = []; projs = []; parts = []; enemies = []; loot = [];
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
  enemies = []; swords = []; projs = []; loot = [];
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
const impacts = [];
function impact(x, y, col, r = 18, slash = 0) { impacts.push({ x, y, col, r, slash, t: 0 }); }
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
function bloodOf(f) { return f.type === 'shade' ? '#5a48c0' : (Math.random() < 0.5 ? '#7a0a12' : '#a0141c'); }
function dropSword(f, dir, vy = -2.8) {
  swords.push({ x: f.x + f.facing * 6, y: stanceY(f), vx: dir * rnd(0.6, 1.6), vy, onGround: false, age: 0 });
  if (f.offhand) { swords.push({ x: f.x, y: stanceY(f), vx: dir * rnd(0.2, 1), vy: vy - 0.6, onGround: false, age: 0 }); f.offhand = false; }
  f.armed = false; f.unarmedT = 0; clearActions(f);
}
function kill(f, dir) {
  if (f.dead || f.invuln > 0) return;
  if (f.offhand) { // the second blade takes the blow and is knocked away
    f.offhand = false; f.invuln = 40; f.stun = 14; f.vx = dir * 2.6; clearActions(f);
    swords.push({ x: f.x, y: f.y - 10, vx: dir * rnd(1, 2), vy: -3.4, onGround: false, age: 0 });
    sparks(f.x - dir * 4, f.y - 10); impact(f.x - dir * 4, f.y - 10, '#9fe8ff', 14);
    sfx.clang(); freeze = 6; shake = 4;
    return;
  }
  const c = fighterColors(f);
  if (f.hp > 1) {
    f.hp--; f.invuln = 50; f.stun = 22; f.flash = 8; f.vx = dir * 3; clearActions(f);
    spray(f.x, f.y - 10, dir, 16, bloodOf(f)); sfx.hurt(); freeze = 6; shake = 5;
    return;
  }
  f.dead = true; f.deadT = 0; f.vx = dir * 1.6; f.vy = -1.6;
  if (f.armed) dropSword(f, dir, -3.2);
  clearActions(f);
  spray(f.x, f.y - 10, dir, 30, bloodOf(f));
  burst(f.x, f.y - 10, 10, bloodOf(f), 1.5, 30, 0.1, true);
  impact(f.x, f.y - 10, f.team === 'player' ? '#ff5060' : '#fff0d0', 22, dir);
  sfx.kill(); shake = 7; freeze = 6;
  if (f.team === 'player') { deaths++; respawnT = 110; sfx.death(); }
  else {
    kills++;
    const pool = COSMETICS[f.type];
    if (pool && (f.T.boss || Math.random() < 0.55)) {
      const c = pool[Math.floor(Math.random() * pool.length)];
      loot.push({ x: f.x, y: f.y - 12, vx: dir * 0.8, vy: -2.6, onGround: false, age: 0, c });
    }
    if (f.T.boss) { freeze = 28; shake = 12; flash = 0.5; speech = null; burst(f.x, f.y - 12, 40, f.T.accent, 3, 60, 0.05); }
  }
}
function disarm(victim, by) {
  if (victim.T && victim.T.grip) { victim.stun = 26; victim.vx = (victim.x > by.x ? 1 : -1) * 2.5; clearActions(victim); sparks((victim.x + by.x) / 2, stanceY(victim)); sfx.clang(); freeze = 4; return; }
  const dir = victim.x > by.x ? 1 : -1;
  if (victim.offhand) {
    swords.push({ x: victim.x, y: stanceY(victim), vx: dir * rnd(0.5, 1.5), vy: -3.8, onGround: false, age: 0 });
    victim.offhand = false; victim.stun = 10; clearActions(victim);
    sparks((victim.x + by.x) / 2, stanceY(victim)); sfx.disarm(); freeze = 4; shake = 3;
    return;
  }
  swords.push({ x: victim.x + victim.facing * 8, y: stanceY(victim), vx: dir * rnd(0.5, 1.5), vy: -3.8, onGround: false, age: 0 });
  victim.armed = false; victim.unarmedT = 0; victim.stun = 14; clearActions(victim);
  // a disarm is never also a kill: stop the attacker's lunge and shove the victim out of blade reach
  by.lunge = 0; by.heavyL = false; by.vx = 0; victim.x += dir * 7;
  sparks((victim.x + by.x) / 2, stanceY(victim));
  impact((victim.x + by.x) / 2, stanceY(victim), '#ffe6a0', 12);
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
  if (!a.armed || a.roll > 0 || a.down > 0 || a.dead || a.stun > 0 || b.dead || bladeBusy(a) || a.heavyL) return false;   // heavy lunge only disarms (blades crossed), never kills
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
      else { f.lunge = 12; f.heavyL = false; f.cool = f.offhand ? 16 : 24; f.vx += f.facing * (f.dashNext ? 4 : 1); sfx.swish(); }
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
    if (f.offhand) { f.offhand = false; f.cool = 12; sfx.throw(); }
    else { f.armed = false; f.unarmedT = 0; f.cool = 16; clearActions(f); sfx.throw(); }
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
    if (f.dead || f.stun > 0 || f.down > 0 || f.kick) continue;
    if (f.armed && (f !== player || f.offhand)) continue;
    for (const s of swords) {
      if (s.age < 18 || s.taken) continue;
      if (Math.abs(s.x - f.x) < 7 && Math.abs(s.y - f.y) < 10) {
        s.taken = true;
        if (f.armed) { f.offhand = true; toast(f.x, f.y - 22, 'TWO BLADES', '#9fe8ff'); }
        else { f.armed = true; f.stance = 1; f.prevStance = 1; f.unarmedT = 0; }
        if (f === player) sfx.pickup();
        break;
      }
    }
  }
  swords = swords.filter(s => !s.taken);
  for (const l of loot) {
    l.age++;
    l.vx *= l.onGround ? 0.8 : 0.99; physics(l, 5, 4);
    if (l.age > 20 && !player.dead && Math.abs(l.x - player.x) < 8 && Math.abs(l.y - player.y) < 12) {
      l.taken = true; equip(l.c); sfx.pickup();
      burst(l.x, l.y - 4, 16, l.c.col, 1.6, 26, 0.03); toast(player.x, player.y - 22, l.c.name.toUpperCase(), l.c.col);
    }
  }
  loot = loot.filter(l => !l.taken && l.y < H + 30);

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

// =====================================================================
//  RENDERING — cinematic vector renderer. No image assets: every
//  texture is generated from noise at load, every figure is a rig.
// =====================================================================
const RW = W * K, RH = H * K;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(h, a) { const c = hexRgb(h); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

// ---------- noise & procedural textures ----------
const PERM = (() => { const p = []; for (let i = 0; i < 256; i++) p.push(i); for (let i = 255; i > 0; i--) { const j = Math.floor(hash(i * 1.37 + 0.5) * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; } return p; })();
function lat(ix, iy, P) { ix = ((ix % P) + P) % P; iy = ((iy % P) + P) % P; return PERM[(PERM[ix & 255] + iy) & 255] / 255; }
function noise2(x, y, P = 256) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = lat(ix, iy, P), b = lat(ix + 1, iy, P), c = lat(ix, iy + 1, P), d = lat(ix + 1, iy + 1, P);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm2(x, y, oct = 5, P = 256) { let s = 0, a = 0.5, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f, P * f); n += a; a *= 0.5; f *= 2; } return s / n; }
function makeTex(w, h, fn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'), img = x.createImageData(w, h), D = img.data;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = (j * w + i) * 4, r = fn(i, j); D[k] = r[0]; D[k + 1] = r[1]; D[k + 2] = r[2]; D[k + 3] = r[3]; }
  x.putImageData(img, 0, 0); return c;
}
const stoneTex = makeTex(256, 256, (i, j) => {
  const row = Math.floor(j / 32), off = (row % 2) * 32, bx = (i + off) % 64, by = j % 32;
  const id = Math.floor(((i + off) % 256) / 64) + (row % 8) * 7;
  let l = 0.5 + 0.55 * (fbm2(i / 32, j / 32, 5, 8) - 0.5) * 2;
  l *= 0.82 + hash(id + 1) * 0.32;
  if (by < 3) l += 0.2; else if (by > 28) l -= 0.22;
  if (bx < 2) l += 0.1; else if (bx > 61) l -= 0.14;
  if (Math.abs(fbm2(i / 16 + 3, j / 16, 4, 16) - 0.5) < 0.012) l *= 0.5;
  if (by < 1 || bx < 1) l = 0.22;
  const v = clamp(l, 0, 1.25) * 190;
  return [v, v * 0.96, v * 0.92, 255];
});
function cloudTex(lit, dark) {
  return makeTex(512, 128, (i, j) => {
    const n = fbm2(i / 64, j / 32, 5, 8), yf = j / 128;
    const a = smooth(0.46, 0.72, n) * smooth(0, 0.3, yf) * smooth(1, 0.55, yf);
    const t = clamp(yf * 1.3 - 0.1 + (n - 0.5) * 0.8, 0, 1);
    return [dark[0] + (lit[0] - dark[0]) * t, dark[1] + (lit[1] - dark[1]) * t, dark[2] + (lit[2] - dark[2]) * t, a * 235];
  });
}
function fogTex(c) {
  return makeTex(512, 96, (i, j) => {
    const n = fbm2(i / 64, j / 24, 4, 8), yf = j / 96;
    return [c[0], c[1], c[2], smooth(0.3, 0.75, n) * Math.pow(Math.sin(Math.PI * yf), 1.5) * 200];
  });
}
const moonTex = makeTex(128, 128, (i, j) => {
  const dx = (i - 64) / 62, dy = (j - 64) / 62, r2 = dx * dx + dy * dy;
  if (r2 > 1) return [0, 0, 0, 0];
  const n = fbm2(i / 18, j / 18, 5, 8), cr = smooth(0.56, 0.63, fbm2(i / 9 + 3, j / 9, 3, 15));
  const l = (0.72 + 0.35 * (n - 0.5) * 2 - 0.22 * cr) * (1 - 0.4 * smooth(0.3, 1, r2) * (dx > 0 ? 1 : 0.3));
  return [240 * l, 112 * l, 96 * l, 255 * smooth(1, 0.94, r2)];
});
const grainTex = makeTex(256, 256, () => { const v = Math.random() * 255; return [v, v, v, 255]; });
const grainPat = ctx.createPattern(grainTex, 'repeat');
const stonePat = ctx.createPattern(stoneTex, 'repeat');
stonePat.setTransform(new DOMMatrix([1 / K, 0, 0, 1 / K, 0, 0]));

// ---------- acts: lighting & palette ----------
const ACTS = [
  { sky: ['#17122b', '#43305a', '#9c5878', '#e8956c', '#ffd49a'], stars: false,
    sun: { x: 228, y: 128, r: 11, core: '#fff4d8', glow: '255,186,120' }, rays: true,
    far: '#8a5a78', mid: '#5a3656', near: '#36203c', haze: '232,150,120',
    cloudLit: [255, 196, 160], cloudDark: [104, 66, 110], fogc: [246, 176, 150],
    ground: '#a08088', rim: '#ffd0a0', banner: '#6a1a2a', fg: '#0d0710', grade: 'rgba(255,150,80,0.22)', grass: true },
  { sky: ['#04060b', '#0b111c', '#16202e', '#223044', '#2e3e54'], stars: false, sun: null, rays: false,
    far: '#2a3546', mid: '#1b2433', near: '#111824', haze: '70,90,115',
    cloudLit: [96, 110, 134], cloudDark: [16, 20, 28], fogc: [120, 140, 170],
    ground: '#6a7484', rim: '#b4ccff', banner: '#1f3a4a', fg: '#05070b', grade: 'rgba(70,110,190,0.25)', wet: true },
  { sky: ['#030206', '#0e050b', '#240912', '#40101c', '#5e1822'], stars: true, moon: { x: 96, y: 46, r: 14 }, rays: false,
    far: '#3a1220', mid: '#250b14', near: '#17070d', haze: '120,30,40',
    cloudLit: [150, 46, 56], cloudDark: [18, 4, 8], fogc: [160, 50, 60],
    ground: '#6e4a50', rim: '#ff9a88', banner: '#4a0a14', fg: '#060205', grade: 'rgba(210,30,40,0.22)' },
  { sky: ['#2c4274', '#6e70a0', '#d49ca6', '#ffc892', '#fff2cc'], stars: false,
    sun: { x: 196, y: 140, r: 15, core: '#fffdf0', glow: '255,226,170' }, rays: true,
    far: '#a68aa6', mid: '#76607e', near: '#46344c', haze: '250,210,180',
    cloudLit: [255, 228, 210], cloudDark: [160, 130, 170], fogc: [255, 230, 210],
    ground: '#b09aa0', rim: '#fff2c8', banner: '#a07a30', fg: '#1a1018', grade: 'rgba(255,200,140,0.2)', grass: true },
];
for (const A of ACTS) { A.clouds = cloudTex(A.cloudLit, A.cloudDark); A.fog = fogTex(A.fogc); }

// ---------- transforms & primitives ----------
let shX = 0, shY = 0;
function curAct() { return ACTS[state === 'title' ? 0 : ZONES[zi].act]; }
function actAt(x) { return ACTS[ZONES[clamp(Math.floor(x / ZW), 0, ZONES.length - 1)].act]; }
function setLayer(p) { ctx.setTransform(K, 0, 0, K, (-camX * p + shX) * K, shY * K); }
function setUnits() { ctx.setTransform(K, 0, 0, K, 0, 0); }
function line(x0, y0, x1, y1) { ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.01, r), 0, Math.PI * 2); ctx.fill(); }
function capsule(ax, ay, bx, by, r1, r2) {
  const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 0.0001, nx = -dy / L, ny = dx / L;
  ctx.beginPath();
  ctx.moveTo(ax + nx * r1, ay + ny * r1); ctx.lineTo(bx + nx * r2, by + ny * r2);
  ctx.lineTo(bx - nx * r2, by - ny * r2); ctx.lineTo(ax - nx * r1, ay - ny * r1); ctx.closePath(); ctx.fill();
  circle(ax, ay, r1); circle(bx, by, r2);
}
function glowAt(x, y, r, rgb, a) {
  const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, `rgba(${rgb},${a})`); gr.addColorStop(0.35, `rgba(${rgb},${a * 0.35})`); gr.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
// two-bone inverse kinematics: returns [jointX, jointY, endX, endY]
function ik(ax, ay, bx, by, l1, l2, bend) {
  let dx = bx - ax, dy = by - ay, d = Math.hypot(dx, dy);
  const max = l1 + l2 - 0.001;
  if (d > max) { dx *= max / d; dy *= max / d; d = max; }
  if (d < 0.001) d = 0.001;
  const a = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const base = Math.atan2(dy, dx) + bend * a;
  return [ax + Math.cos(base) * l1, ay + Math.sin(base) * l1, ax + dx, ay + dy];
}
function groundYAt(x, y) {
  let best = null;
  for (const s of solids) if (x >= s.x && x <= s.x + s.w && s.y >= y - 1 && (best === null || s.y < best)) best = s.y;
  for (const p of platforms) if (x >= p.x && x <= p.x + p.w && p.y >= y - 1 && (best === null || p.y < best)) best = p.y;
  return best;
}

// ---------- sky & distance ----------
let bolt = null;
function drawSky(A) {
  setUnits();
  const gr = ctx.createLinearGradient(0, 0, 0, GROUND);
  A.sky.forEach((c, i) => gr.addColorStop(i / (A.sky.length - 1), c));
  ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H);
  if (A.stars) {
    for (let i = 0; i < 140; i++) {
      const x = ((hash(i) * W * 2 - camX * 0.01) % W + W) % W, y = hash(i + 3) * 100;
      const tw = 0.5 + 0.5 * Math.sin(tick * 0.05 + i * 1.7), r = hash(i + 11) > 0.93 ? 0.34 : 0.18;
      ctx.fillStyle = `rgba(255,236,230,${(0.12 + 0.7 * tw * hash(i + 7)).toFixed(3)})`;
      ctx.fillRect(x, y, r, r);
    }
  }
  if (A.sun) {
    const sx = A.sun.x - camX * 0.02, sy = A.sun.y;
    ctx.globalCompositeOperation = 'lighter';
    glowAt(sx, sy, 120, A.sun.glow, 0.5);
    if (A.rays) {
      for (let i = 0; i < 11; i++) {
        const a = -Math.PI / 2 + (i - 5) * 0.3 + Math.sin(tick * 0.003 + i * 2.1) * 0.05, sp = 0.035 + hash(i) * 0.05;
        ctx.fillStyle = `rgba(${A.sun.glow},${(0.02 + hash(i + 4) * 0.03).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a - sp) * 260, sy + Math.sin(a - sp) * 260);
        ctx.lineTo(sx + Math.cos(a + sp) * 260, sy + Math.sin(a + sp) * 260); ctx.closePath(); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, A.sun.r);
    sg.addColorStop(0, A.sun.core); sg.addColorStop(0.7, A.sun.core); sg.addColorStop(1, `rgba(${A.sun.glow},0.6)`);
    ctx.fillStyle = sg; circle(sx, sy, A.sun.r);
  }
  if (A.moon) {
    const mx = A.moon.x - camX * 0.02, my = A.moon.y, r = A.moon.r;
    ctx.globalCompositeOperation = 'lighter'; glowAt(mx, my, r * 5, '200,40,40', 0.35); ctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(moonTex, mx - r, my - r, r * 2, r * 2);
  }
  // two cloud decks
  const cw = W * 1.6;
  for (const [y, h, sp, par, a] of [[2, 56, 0.02, 0.03, 0.95], [34, 40, 0.045, 0.06, 0.6]]) {
    const off = ((tick * sp + camX * par) % cw + cw) % cw;
    ctx.globalAlpha = a;
    ctx.drawImage(A.clouds, -off, y, cw, h); ctx.drawImage(A.clouds, cw - off, y, cw, h);
  }
  ctx.globalAlpha = 1;
}
function drawLightning() {
  if (lightning <= 0) { bolt = null; return; }
  setUnits();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(190,210,255,${(0.035 * lightning).toFixed(3)})`; ctx.fillRect(0, 0, W, H);
  if (!bolt) {
    bolt = []; let x = rnd(30, W - 30), y = 0; bolt.push([x, y]);
    while (y < 125) { x += rnd(-6, 6); y += rnd(4, 9); bolt.push([x, y]); }
  }
  if (lightning > 3) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const [w, a] of [[3.5, 0.12], [1.3, 0.35], [0.4, 1]]) {
      ctx.strokeStyle = `rgba(225,235,255,${a})`; ctx.lineWidth = w; ctx.beginPath();
      bolt.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}
function ridge(p, base, amp, freq, seed, top, bottom) {
  setUnits();
  const off = camX * p;
  ctx.beginPath(); ctx.moveTo(-2, H);
  for (let x = -2; x <= W + 2; x += 2) {
    const wx = (x + off) * freq + seed;
    const n = fbm2(wx, seed * 0.13, 5), r = 1 - Math.abs(noise2(wx * 1.9 + 5, 1.3) * 2 - 1);
    ctx.lineTo(x, base - amp * (n * 0.8 + r * 0.45));
  }
  ctx.lineTo(W + 2, H); ctx.closePath();
  const gr = ctx.createLinearGradient(0, base - amp, 0, base + 18);
  gr.addColorStop(0, top); gr.addColorStop(1, bottom);
  ctx.fillStyle = gr; ctx.fill();
}
function hazeBand(A, y0, y1, a) {
  setUnits();
  const gr = ctx.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, `rgba(${A.haze},0)`); gr.addColorStop(1, `rgba(${A.haze},${a})`);
  ctx.fillStyle = gr; ctx.fillRect(0, y0, W, y1 - y0);
  ctx.fillStyle = `rgba(${A.haze},${a})`; ctx.fillRect(0, y1, W, H - y1);
}
function drawSpire(A) {
  setUnits();
  const x = 300 - camX * 0.1;
  ctx.fillStyle = A.mid; ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(x - 8, 140); ctx.lineTo(x - 6, 62); ctx.lineTo(x - 8, 60); ctx.lineTo(x - 8, 56); ctx.lineTo(x - 5.5, 56);
  ctx.lineTo(x - 5.5, 44); ctx.lineTo(x, 20); ctx.lineTo(x + 5.5, 44); ctx.lineTo(x + 5.5, 56); ctx.lineTo(x + 8, 56);
  ctx.lineTo(x + 8, 60); ctx.lineTo(x + 6, 62); ctx.lineTo(x + 8, 140); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  glowAt(x, 50, 9, '255,200,90', 0.35 + 0.15 * Math.sin(tick * 0.04));
  ctx.fillStyle = 'rgba(255,210,120,0.8)'; ctx.fillRect(x - 1.2, 48, 2.4, 3.5);
  for (let i = 0; i < 4; i++) if (hash(i + 30) > 0.4) { ctx.fillStyle = 'rgba(255,190,110,0.5)'; ctx.fillRect(x - 0.4 + (i % 2 ? 2 : -2.5), 72 + i * 14, 0.8, 1.6); }
  ctx.globalCompositeOperation = 'source-over';
}
function drawFar(A) {
  ridge(0.05, 112, 58, 0.011, 11, A.far, `rgba(${A.haze},1)`);
  hazeBand(A, 88, 132, 0.3);
  drawSpire(A);
  ridge(0.16, 130, 36, 0.019, 47, A.mid, A.far);
  hazeBand(A, 112, 146, 0.24);
}
function drawRuins(A) {
  const p = 0.45, sp = 70;
  setLayer(p);
  const k0 = Math.floor((camX * p) / sp) - 1;
  const px = k => k * sp + hash(k) * 20, ptop = k => 62 + hash(k + 1) * 26, pw = k => 7 + hash(k + 2) * 3;
  for (let k = k0; k < k0 + 7; k++) {
    const x = px(k), top = ptop(k), w = pw(k);
    const gr = ctx.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, A.near); gr.addColorStop(0.72, A.mid); gr.addColorStop(1, A.near);
    ctx.fillStyle = gr; ctx.fillRect(x, top, w, GROUND - top);
    ctx.fillStyle = A.near;
    ctx.fillRect(x - 1.5, top - 2, w + 3, 2.4); ctx.fillRect(x - 1.5, GROUND - 4, w + 3, 4);
    for (let r = 0; r < 4; r++) ctx.fillRect(x, top + 8 + r * 18, w, 0.35);
    if (hash(k + 5) > 0.5) {
      ctx.beginPath(); ctx.moveTo(x - 1.5, top - 2); ctx.lineTo(x + w * 0.3, top - 6 - hash(k) * 6);
      ctx.lineTo(x + w * 0.6, top - 3); ctx.lineTo(x + w + 1.5, top - 5); ctx.lineTo(x + w + 1.5, top - 2); ctx.closePath(); ctx.fill();
    }
    if (hash(k + 3) > 0.35) {
      const nx = px(k + 1), at = Math.min(top, ptop(k + 1)) + 4, mx = (x + w + nx) / 2;
      ctx.strokeStyle = A.near; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x + w, at + 20); ctx.quadraticCurveTo(x + w, at, mx, at - 11);
      ctx.quadraticCurveTo(nx, at, nx, at + 20); ctx.stroke();
      if (hash(k + 9) > 0.5) { // lit window behind the arch
        ctx.globalCompositeOperation = 'lighter';
        glowAt(mx, at + 10, 6, '255,170,90', 0.18);
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    if (hash(k + 7) > 0.5) {
      const bx = x + w / 2, by = top + 6, sw = Math.sin(tick * 0.03 + k) * 1.3 + (A.wet ? -1 : 0);
      ctx.fillStyle = A.banner;
      ctx.beginPath(); ctx.moveTo(bx - 2.6, by); ctx.lineTo(bx + 2.6, by);
      ctx.quadraticCurveTo(bx + 2.6 + sw, by + 12, bx + 2.2 + sw * 1.5, by + 23); ctx.lineTo(bx + sw * 1.5, by + 20);
      ctx.lineTo(bx - 2.2 + sw * 1.5, by + 23); ctx.quadraticCurveTo(bx - 2.6 + sw, by + 12, bx - 2.6, by); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(bx - 0.6 + sw * 0.6, by + 2, 0.8, 16);
    }
  }
  setUnits();
  ctx.fillStyle = `rgba(${A.haze},0.12)`; ctx.fillRect(0, 50, W, 100);
}
function drawFogLayer(A, y, h, speed, alpha, par) {
  setUnits();
  const tw = W * 1.4, off = ((camX * par + tick * speed) % tw + tw) % tw;
  ctx.globalAlpha = alpha;
  ctx.drawImage(A.fog, -off, y, tw, h); ctx.drawImage(A.fog, tw - off, y, tw, h);
  ctx.globalAlpha = 1;
}

// ---------- the playfield ----------
function chain(x, y0, y1, sway) {
  ctx.strokeStyle = '#1d1b21'; ctx.lineWidth = 0.22;
  let i = 0;
  for (let y = y0; y > y1; y -= 1.1, i++) {
    const xx = x + sway * (y0 - y) * 0.02;
    ctx.beginPath(); ctx.ellipse(xx, y, i % 2 ? 0.16 : 0.42, 0.56, 0, 0, Math.PI * 2); ctx.stroke();
  }
}
function flame(x, y, h, w, sway) {
  ctx.beginPath(); ctx.moveTo(x + sway, y - h);
  ctx.bezierCurveTo(x + w, y - h * 0.45, x + w * 0.9, y, x, y);
  ctx.bezierCurveTo(x - w * 0.9, y, x - w, y - h * 0.45, x + sway, y - h); ctx.fill();
}
function drawWorld(A) {
  setLayer(1);
  const x0 = camX - 6, x1 = camX + W + 6;
  // abyss under the floor line (visible in pits)
  let gr = ctx.createLinearGradient(0, GROUND - 8, 0, H);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.45, 'rgba(3,1,5,0.88)'); gr.addColorStop(1, '#000');
  ctx.fillStyle = gr; ctx.fillRect(x0, GROUND - 8, x1 - x0, H);
  // torch light (behind everything on the playfield)
  ctx.globalCompositeOperation = 'lighter';
  for (const t of torches) {
    if (t < x0 - 50 || t > x1 + 50) continue;
    const cool = ZONES[Math.floor(t / ZW)].act === 2, c = cool ? '110,180,255' : '255,150,70';
    const fl = 1 + Math.sin(tick * 0.31 + t) * 0.07 + Math.sin(tick * 0.77 + t * 2) * 0.05;
    glowAt(t, 122, 50 * fl, c, 0.3);
    ctx.save(); ctx.translate(t, GROUND); ctx.scale(1, 0.2); glowAt(0, 0, 26 * fl, c, 0.45); ctx.restore();
    if (actAt(t).wet) { const wg = ctx.createLinearGradient(0, GROUND, 0, GROUND + 14); wg.addColorStop(0, `rgba(${c},0.35)`); wg.addColorStop(1, `rgba(${c},0)`); ctx.fillStyle = wg; ctx.fillRect(t - 1.4, GROUND, 2.8, 14); }
  }
  ctx.globalCompositeOperation = 'source-over';
  // chains in the Gaoler's pit
  const gz = 4 * ZW;
  if (gz < x1 && gz + ZW > x0) for (let i = 0; i < 7; i++) chain(gz + 25 + i * 45, 30 + hash(i) * 60, -2, Math.sin(tick * 0.02 + i));
  // platforms
  for (const p of platforms) {
    if (p.x > x1 || p.x + p.w < x0) continue;
    chain(p.x + 2, p.y - 0.5, -2, 0); chain(p.x + p.w - 2, p.y - 0.5, -2, 0);
    gr = ctx.createLinearGradient(0, p.y, 0, p.y + 2.4);
    gr.addColorStop(0, '#8a6448'); gr.addColorStop(0.3, '#5a3c28'); gr.addColorStop(1, '#22150c');
    ctx.fillStyle = gr; ctx.fillRect(p.x, p.y, p.w, 2.4);
    ctx.strokeStyle = 'rgba(25,12,6,0.55)'; ctx.lineWidth = 0.1;
    for (let i = 0; i < 3; i++) line(p.x, p.y + 0.7 + i * 0.55, p.x + p.w, p.y + 0.8 + i * 0.55);
    ctx.fillStyle = rgba(actAt(p.x).rim, 0.5); ctx.fillRect(p.x, p.y, p.w, 0.25);
  }
  // stone
  for (const s of solids) {
    if (s.x > x1 || s.x + s.w < x0) continue;
    const SA = actAt(s.x + 1);
    ctx.fillStyle = stonePat; ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = SA.ground; ctx.fillRect(s.x, s.y, s.w, s.h);
    ctx.globalCompositeOperation = 'source-over';
    gr = ctx.createLinearGradient(0, s.y, 0, s.y + 28);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.8)');
    ctx.fillStyle = gr; ctx.fillRect(s.x, s.y + 1.5, s.w, s.h);
    ctx.fillStyle = rgba(SA.rim, 0.55); ctx.fillRect(s.x, s.y, s.w, 0.3);
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(s.x, s.y + 0.3, s.w, 0.4);
    if (s.y < GROUND) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(s.x + s.w - 0.8, s.y, 0.8, s.h); ctx.fillStyle = rgba(SA.rim, 0.25); ctx.fillRect(s.x, s.y, 0.4, s.h); }
    if (SA.wet) { ctx.fillStyle = 'rgba(170,195,240,0.14)'; for (let bx = s.x + 4; bx < s.x + s.w - 6; bx += 23) ctx.fillRect(bx, s.y + 0.4, 6 + hash(bx) * 8, 0.35); }
    if (SA.grass) {
      ctx.strokeStyle = '#2a2818'; ctx.lineWidth = 0.18; ctx.beginPath();
      for (let bx = Math.max(s.x, x0); bx < Math.min(s.x + s.w, x1); bx += 0.8) {
        const hh = hash(Math.floor(bx * 3.1)); if (hh < 0.45) continue;
        const len = 0.5 + hh * 1.5, sw = Math.sin(tick * 0.04 + bx * 0.7) * 0.3;
        ctx.moveTo(bx, s.y + 0.2); ctx.lineTo(bx + sw, s.y - len);
      }
      ctx.stroke();
    }
  }
  // torches
  for (const t of torches) {
    if (t < x0 - 6 || t > x1 + 6) continue;
    const cool = ZONES[Math.floor(t / ZW)].act === 2, TA = actAt(t);
    ctx.fillStyle = '#141016'; ctx.fillRect(t - 0.35, 125, 0.7, 25);
    ctx.beginPath(); ctx.moveTo(t - 2, 123.2); ctx.lineTo(t + 2, 123.2); ctx.lineTo(t + 1.1, 125.6); ctx.lineTo(t - 1.1, 125.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(TA.rim, 0.4); ctx.fillRect(t - 2, 123.2, 4, 0.25);
    const fl = 1 + Math.sin(tick * 0.5 + t) * 0.12 + Math.sin(tick * 1.3 + t * 2) * 0.08, sw = Math.sin(tick * 0.4 + t) * 0.45;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = cool ? 'rgba(60,140,255,0.75)' : 'rgba(255,100,30,0.75)'; flame(t, 123.4, 5.4 * fl, 1.6, sw);
    ctx.fillStyle = cool ? 'rgba(140,210,255,0.85)' : 'rgba(255,185,70,0.85)'; flame(t, 123.4, 3.8 * fl, 1.1, sw * 0.7);
    ctx.fillStyle = 'rgba(255,248,225,0.95)'; flame(t, 123.4, 2.1 * fl, 0.6, sw * 0.4);
    ctx.globalCompositeOperation = 'source-over';
  }
  drawBell();
}
function drawBell() {
  const bx = BELL_X;
  if (bx < camX - 40 || bx > camX + W + 40) return;
  const wood = ctx.createLinearGradient(0, 84, 0, 150);
  wood.addColorStop(0, '#4a3020'); wood.addColorStop(1, '#1c120c');
  ctx.fillStyle = wood;
  ctx.fillRect(bx - 21, 88, 3, 62); ctx.fillRect(bx + 18, 88, 3, 62); ctx.fillRect(bx - 25, 85, 50, 3.6);
  ctx.beginPath(); ctx.moveTo(bx - 28, 85.5); ctx.lineTo(bx, 77); ctx.lineTo(bx + 28, 85.5); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,230,190,0.35)'; ctx.fillRect(bx - 25, 85, 50, 0.3);
  if (zi === ZONES.length - 1 || state === 'win') { ctx.globalCompositeOperation = 'lighter'; glowAt(bx, 104, 34, '255,210,120', 0.22 + 0.08 * Math.sin(tick * 0.05) + bellSwing * 0.3); ctx.globalCompositeOperation = 'source-over'; }
  ctx.save(); ctx.translate(bx, 89); ctx.rotate(Math.sin(tick * 0.18) * bellSwing * 0.22);
  const hw = y => 4.2 + Math.pow(Math.max(0, y - 4) / 22, 2.2) * 9;
  ctx.beginPath(); ctx.moveTo(-4.2, 4); ctx.arc(0, 4, 4.2, Math.PI, 0);
  for (let y = 4; y <= 26; y++) ctx.lineTo(hw(y), y);
  ctx.lineTo(14.4, 28); ctx.lineTo(-14.4, 28);
  for (let y = 26; y >= 4; y--) ctx.lineTo(-hw(y), y);
  ctx.closePath();
  const bg = ctx.createLinearGradient(-14, 0, 14, 0);
  bg.addColorStop(0, '#2e1c0c'); bg.addColorStop(0.3, '#9a6a26'); bg.addColorStop(0.55, '#ffe2a2'); bg.addColorStop(0.68, '#c89040'); bg.addColorStop(1, '#3a220c');
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = 'rgba(40,20,5,0.6)'; ctx.lineWidth = 0.4;
  line(-hw(22), 22, hw(22), 22); line(-hw(10), 10, hw(10), 10);
  ctx.fillStyle = 'rgba(80,160,140,0.22)';
  for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(-8 + hash(i) * 16, 12 + hash(i + 2) * 12, 1.2, 0.6, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#2a1a0a'; ctx.fillRect(-1.6, -2.4, 3.2, 3);
  circle(Math.sin(tick * 0.18 + 1) * bellSwing * 3, 27, 1.4);
  ctx.restore();
}

// ---------- figures ----------
const LOOKS = {
  player:  { body: '#262a33', back: '#1a1d24', coat: true, scarf: ['#8eeaff', '#35b4e0', '#16698c'] },
  squire:  { body: '#3c3029', back: '#281f1a', helm: '#8a8a92', eye: '#ff5a6a' },
  duelist: { body: '#2c2739', back: '#1c1926', coat: true, hat: '#17141f', feather: '#ffa040', eye: '#ffa040' },
  thrower: { body: '#2e2535', back: '#1d1722', hood: true, sash: '#c07bff', eye: '#c07bff' },
  acolyte: { body: '#1f2e2e', back: '#142121', robe: true, hood: true, mask: '#dfe9e4', eye: '#5affc0' },
  shade:   { body: '#0d0b14', back: '#08070c', hood: true, eye: '#b8a8ff', smoke: true },
  gaoler:  { body: '#33271f', back: '#211913', helm: '#4e4640', eye: '#ff7a2a', cape: '#3c1d10', chains: true, broad: 1.35 },
  warden:  { body: '#17141d', back: '#0e0c12', crown: '#ffd54a', eye: '#ffd54a', cape: '#5c1218', coat: true },
};
function lightFor(f) {
  let best = null, bd = 60;
  for (const t of torches) { const d = Math.abs(t - f.x); if (d < bd) { bd = d; best = t; } }
  if (best !== null) {
    const cool = ZONES[clamp(Math.floor(best / ZW), 0, ZONES.length - 1)].act === 2;
    const dx = best - f.x, dy = 123 - (f.y - 10), L = Math.hypot(dx, dy) || 1;
    return { x: dx / L, y: dy / L, col: cool ? '#9fd4ff' : '#ffc080', k: 1 - bd / 60 };
  }
  const A = curAct();
  const lx = A.sun ? A.sun.x + camX * 0.98 : A.moon ? A.moon.x + camX * 0.98 : f.x + 100;
  return { x: Math.sign(lx - f.x) || 1, y: -0.45, col: A.rim, k: 0.55 };
}
function rig(f, X) {
  const d = f.facing, s = f.h / 18, Y = f.y;
  const L = { thigh: 4.3 * s, shin: 4.3 * s, torso: 6.0 * s, upper: 3.9 * s, fore: 3.9 * s, head: 1.45 * s };
  const spd = Math.abs(f.vx), ext = lungeExt(f);
  let hipY, lean = 0.05, fa, fb;
  if (f.kick) { hipY = Y - 6.5 * s; fa = [X + d * 4.8 * s, Y - 0.2]; fb = [X - d * 0.8, Y - 3.2 * s]; lean = -0.35; }
  else if (f.plunge) { hipY = Y - 7.8 * s; fa = [X + d * 1.4, Y - 3.2 * s]; fb = [X - d * 1.6, Y - 2.4 * s]; lean = 0.15; }
  else if (!f.onGround) { hipY = Y - 8.2 * s; fa = [X + d * 2.0 * s, Y - 3.0 * s]; fb = [X - d * 1.4 * s, Y - 1.6 * s]; lean = 0.1; }
  else if (f.windup > 0) { hipY = Y - 6.9 * s; fa = [X + d * 3.0 * s, Y]; fb = [X - d * 3.4 * s, Y]; lean = -0.18; }
  else if (f.lunge > 0) { const t = ext / (f.heavyL ? 12 : 6); hipY = Y - (7.7 - 1.3 * t) * s; fa = [X + d * (2.6 + t * 3.4) * s, Y]; fb = [X - d * (2.8 + t * 1.8) * s, Y]; lean = 0.15 + t * 0.3; }
  else if (spd > 0.25) {
    const ph = f.anim * 0.3 * clamp(spd / 1.2, 0.7, 1.5), sw = 2.5 * s, lift = 1.5 * s, dir = Math.sign(f.vx);
    fa = [X + Math.sin(ph) * sw * dir, Y - Math.max(0, Math.cos(ph)) * lift];
    fb = [X - Math.sin(ph) * sw * dir, Y - Math.max(0, -Math.cos(ph)) * lift];
    hipY = Y - 8.1 * s + Math.abs(Math.sin(ph)) * 0.3; lean = 0.14 * dir * d;
  } else { hipY = Y - 7.7 * s + Math.sin(f.anim * 0.06) * 0.12; fa = [X + d * 2.3 * s, Y]; fb = [X - d * 2.4 * s, Y]; }
  if (f.armed && f.onGround && !f.windup && !f.slash && !f.parry && !f.kick) {
    if (f.stance === 2) { hipY += 1.1 * s; lean += 0.28; } else if (f.stance === 0) lean -= 0.04;
  }
  if (f.stun > 0) lean = -0.28;
  const hip = [X - d * 0.2, hipY];
  const neck = [hip[0] + Math.sin(lean) * L.torso * d, hipY - Math.cos(lean) * L.torso];
  const head = [neck[0] + d * (0.3 + lean * 0.8), neck[1] - L.head - 0.35];
  const sh = [neck[0] - d * 0.1, neck[1] + 0.8 * s];
  return { d, s, L, X, Y, hip, neck, head, sh,
    ka: ik(hip[0], hip[1], fa[0], fa[1], L.thigh, L.shin, -d),
    kb: ik(hip[0], hip[1], fb[0], fb[1], L.thigh, L.shin, -d) };
}
function handsFor(f, R) {
  const d = R.d, X = R.X, Y = R.Y, s = R.s;
  let hand, blade = null, off;
  if (f.armed) {
    if (f.slash > 0) {
      const t = (18 - f.slash) / 18, ang = t < 0.33 ? -2.1 + t * 0.3 : -2.0 + (t - 0.33) / 0.67 * 2.8;
      hand = [R.sh[0] + d * Math.cos(ang) * 6.5 * s, R.sh[1] + Math.sin(ang) * 6.5 * s];
      blade = [hand[0], hand[1], hand[0] + d * Math.cos(ang) * 11, hand[1] + Math.sin(ang) * 11]; R.slashAng = ang;
    } else if (f.parry > 0) { hand = [X + d * 3.4 * s, Y - 11.5 * s]; blade = [hand[0], hand[1], hand[0] + d * 0.5, hand[1] - 11]; }
    else if (f.windup > 0) { hand = [X - d * 2.6 * s, Y - 11 * s]; blade = [hand[0], hand[1], hand[0] + d * 11, hand[1] + 0.3]; }
    else if (f.plunge) { hand = [X + d * 1.2, Y - 10.5 * s]; blade = [hand[0], hand[1], hand[0] + d * 0.4, hand[1] + 14]; }
    else if (f.stun > 0) { hand = [X + d * 3.2 * s, Y - 7.5 * s]; blade = [hand[0], hand[1], hand[0] + d * 9.5, hand[1] + 3.5]; }
    else { const ext = lungeExt(f), hy = stanceY(f); hand = [X + d * (4.2 + ext * 0.7), hy]; blade = [null, null, X + d * reach(f), hy]; }
    const fencer = f.team === 'player' || f.type === 'duelist' || f.type === 'warden';
    off = fencer && f.onGround && !f.slash ? [X - d * 3.4 * s, Y - 16.2 * s] : [X - d * 1.6 * s, Y - 8.2 * s];
    if (Math.abs(f.vx) > 0.6 && f.onGround && !f.lunge) off = [X - d * 1.5 * s + Math.sin(f.anim * 0.3) * 1.6, Y - 9 * s];
  } else {
    hand = f.punch > 3 ? [X + d * 7.2, Y - 12.4 * s] : [X + d * 3.2 * s, Y - 12.6 * s];
    off = [X + d * 2.0 * s, Y - 13.4 * s];
  }
  return { hand, blade, off };
}
function leg(hip, k, d, s, ox, oy) {
  capsule(hip[0] + ox, hip[1] + oy, k[0] + ox, k[1] + oy, 1.0 * s, 0.72 * s);
  capsule(k[0] + ox, k[1] + oy, k[2] + ox, k[3] + oy, 0.72 * s, 0.5 * s);
  capsule(k[2] + ox, k[3] + oy - 0.15, k[2] + ox + d * 1.3 * s, k[3] + oy + 0.05, 0.45 * s, 0.32 * s);
}
// draws the whole silhouette; when `rim` is set, every part is filled with one rim-light colour
function paintBody(f, R, Hd, look, rimCol, ox, oy, rim) {
  const s = R.s, d = R.d, hx = R.head[0] + ox, hy = R.head[1] + oy;
  const F = c => { ctx.fillStyle = rim ? rimCol : c; };
  const B = look.broad || 1;
  F(look.back);
  const ea = ik(R.sh[0], R.sh[1], Hd.off[0], Hd.off[1], R.L.upper, R.L.fore, d);
  capsule(R.sh[0] + ox, R.sh[1] + oy, ea[0] + ox, ea[1] + oy, 0.72 * s * B, 0.58 * s * B);
  capsule(ea[0] + ox, ea[1] + oy, ea[2] + ox, ea[3] + oy, 0.58 * s * B, 0.5 * s);
  leg(R.hip, R.kb, d, s, ox, oy);
  if (look.robe) {
    F(look.body); leg(R.hip, R.ka, d, s, ox, oy);
    const sw = Math.sin(tick * 0.12) * 0.5 - f.vx * 0.8;
    ctx.beginPath();
    ctx.moveTo(R.neck[0] - 1.5 * s + ox, R.neck[1] + 1 + oy); ctx.lineTo(R.neck[0] + 1.5 * s + ox, R.neck[1] + 1 + oy);
    ctx.lineTo(R.X + 3.4 * s + sw + ox, R.Y - 0.4 + oy); ctx.lineTo(R.X - 3.4 * s + sw * 1.3 + ox, R.Y - 0.4 + oy); ctx.closePath(); ctx.fill();
  }
  F(look.body);
  capsule(R.hip[0] + ox, R.hip[1] + oy, R.neck[0] + ox, R.neck[1] + oy, 1.25 * s * B, 1.5 * s * B);
  if (look.coat) {
    const tail = 2.2 + Math.min(2.5, Math.abs(f.vx) * 1.2);
    ctx.beginPath(); ctx.moveTo(R.hip[0] - d * 0.9 + ox, R.hip[1] - 1.2 + oy);
    ctx.lineTo(R.hip[0] - d * tail + ox, R.hip[1] + 3.8 * s + oy + Math.sin(tick * 0.2) * 0.2);
    ctx.lineTo(R.hip[0] + d * 0.8 + ox, R.hip[1] + 2.4 * s + oy); ctx.closePath(); ctx.fill();
  }
  if (!look.robe) leg(R.hip, R.ka, d, s, ox, oy);
  capsule(R.neck[0] + ox, R.neck[1] + oy, hx - d * 0.2, hy + 0.6, 0.55 * s, 0.55 * s);
  circle(hx, hy, R.L.head);
  if (look.hood) {
    circle(hx - d * 0.15, hy - 0.1, R.L.head * 1.2);
    ctx.beginPath(); ctx.moveTo(hx + d * 0.9, hy - 1.7 * s); ctx.lineTo(hx - d * 2.8 * s, hy + 0.6); ctx.lineTo(hx + d * 0.2, hy + 1.6 * s); ctx.closePath(); ctx.fill();
  }
  if (look.helm) {
    F(look.helm);
    ctx.beginPath(); ctx.ellipse(hx, hy - 0.45 * s, 2.5 * s, 0.45 * s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(hx, hy - 0.4 * s, 1.65 * s, Math.PI, 0); ctx.fill();
  }
  if (look.hat) {
    F(look.hat);
    ctx.beginPath(); ctx.ellipse(hx, hy - 0.95 * s, 2.9 * s, 0.42 * s, 0, 0, Math.PI * 2); ctx.fill();
    capsule(hx, hy - 1.2 * s, hx - d * 0.3, hy - 2.5 * s, 1.15 * s, 1.0 * s);
    if (!rim) { ctx.strokeStyle = look.feather; ctx.lineWidth = 0.45; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx - d * 0.6, hy - 2.3 * s); ctx.quadraticCurveTo(hx - d * 2.2, hy - 4.8 * s, hx - d * 4.4, hy - 3.6 * s + Math.sin(tick * 0.1) * 0.3); ctx.stroke(); }
  }
  if (!rim) {
    if (look.mask) { ctx.fillStyle = look.mask; ctx.beginPath(); ctx.ellipse(hx + d * 0.55 * s, hy + 0.1, 0.75 * s, 1.0 * s, 0, 0, Math.PI * 2); ctx.fill(); }
    if (look.crown) {
      ctx.fillStyle = look.crown; ctx.beginPath();
      ctx.moveTo(hx - 1.5 * s, hy - 1.0 * s); ctx.lineTo(hx - 1.4 * s, hy - 2.6 * s); ctx.lineTo(hx - 0.7 * s, hy - 1.7 * s); ctx.lineTo(hx, hy - 3.0 * s);
      ctx.lineTo(hx + 0.7 * s, hy - 1.7 * s); ctx.lineTo(hx + 1.4 * s, hy - 2.6 * s); ctx.lineTo(hx + 1.5 * s, hy - 1.0 * s); ctx.closePath(); ctx.fill();
    }
    if (look.sash) { ctx.strokeStyle = look.sash; ctx.lineWidth = 0.55; line(R.sh[0] + ox - d * 0.6, R.sh[1] + oy, R.hip[0] + ox + d * 0.9, R.hip[1] + oy - 0.4); }
    if (look.chains) { ctx.strokeStyle = '#6a6460'; ctx.lineWidth = 0.3; ctx.setLineDash([0.5, 0.35]); line(R.sh[0] - d * 1.4, R.sh[1] - 0.3, R.hip[0] + d * 1.6, R.hip[1] - 0.5); line(R.sh[0] + d * 1.2, R.sh[1], R.hip[0] - d * 1.5, R.hip[1] + 0.2); ctx.setLineDash([]); }
  }
  F(look.body);
  const eb = ik(R.sh[0], R.sh[1], Hd.hand[0], Hd.hand[1], R.L.upper, R.L.fore, d);
  capsule(R.sh[0] + ox, R.sh[1] + oy, eb[0] + ox, eb[1] + oy, 0.75 * s * B, 0.6 * s * B);
  capsule(eb[0] + ox, eb[1] + oy, eb[2] + ox, eb[3] + oy, 0.6 * s * B, 0.5 * s);
  circle(eb[2] + ox, eb[3] + oy, 0.62 * s);
  return eb;
}
function drawBlade(f, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#2a1c14'; ctx.lineWidth = 0.55; line(x0 - ux * 1.5, y0 - uy * 1.5, x0, y0);
  ctx.fillStyle = '#c8a060'; circle(x0 - ux * 1.75, y0 - uy * 1.75, 0.38);
  ctx.strokeStyle = '#c8a060'; ctx.lineWidth = 0.42;
  line(x0 + ux * 0.4 + nx * 1.3, y0 + uy * 0.4 + ny * 1.3, x0 + ux * 0.4 - nx * 1.3, y0 + uy * 0.4 - ny * 1.3);
  const bx = x0 + ux * 0.55, by = y0 + uy * 0.55, w = 0.3;
  ctx.beginPath(); ctx.moveTo(bx + nx * w, by + ny * w);
  ctx.lineTo(x1 - ux * 1.5 + nx * w * 0.75, y1 - uy * 1.5 + ny * w * 0.75); ctx.lineTo(x1, y1);
  ctx.lineTo(x1 - ux * 1.5 - nx * w * 0.75, y1 - uy * 1.5 - ny * w * 0.75); ctx.lineTo(bx - nx * w, by - ny * w); ctx.closePath();
  const gr = ctx.createLinearGradient(bx + nx * w, by + ny * w, bx - nx * w, by - ny * w);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#b8c4cf'); gr.addColorStop(1, '#56606c');
  ctx.fillStyle = gr; ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  const gt = ((tick + Math.abs(x0) * 7) % 170) / 24;
  if (gt < 1) glowAt(bx + (x1 - bx) * gt, by + (y1 - by) * gt, 1.6, '255,255,255', 0.8);
  if (f && lungeExt(f) >= 6) {
    glowAt(x1, y1, f.heavyL ? 4 : 2.6, f.heavyL ? '255,215,140' : '230,245,255', 0.85);
    ctx.strokeStyle = f.heavyL ? 'rgba(255,210,130,0.4)' : 'rgba(255,255,255,0.22)'; ctx.lineWidth = f.heavyL ? 1.3 : 0.7;
    line(x1 - ux * (f.heavyL ? 18 : 10), y1 - uy * (f.heavyL ? 18 : 10), x1, y1);
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawScarf(f, R) {
  const pts = f.scarf; if (pts.length < 2) return;
  const cols = LOOKS.player.scarf;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  let px = R ? R.neck[0] : pts[0].x, py = R ? R.neck[1] : pts[0].y;
  for (let i = 1; i < pts.length; i++) {
    const t = i / pts.length;
    ctx.strokeStyle = t < 0.35 ? cols[0] : t < 0.7 ? cols[1] : cols[2];
    ctx.lineWidth = 1.2 - t * 0.65;
    line(px, py, pts[i].x, pts[i].y); px = pts[i].x; py = pts[i].y;
  }
}
function drawCape(f, R, col) {
  const d = R.d;
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(R.sh[0] + d * 0.6, R.sh[1] - 0.4);
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    ctx.lineTo(R.sh[0] - d * (0.6 + t * (2.4 + Math.min(3, Math.abs(f.vx) * 2))) + Math.sin(tick * 0.08 + i) * 0.35 * t, R.sh[1] + t * f.h * 0.66);
  }
  ctx.lineTo(R.hip[0] + d * 0.5, R.hip[1] + 1.5); ctx.closePath(); ctx.fill();
}
function stars(x, y, t) {
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) { const a = t * 0.15 + i * 2.1; glowAt(x + Math.cos(a) * 2.6, y + Math.sin(a) * 0.7, 0.9, '255,225,120', 0.9); }
  ctx.globalCompositeOperation = 'source-over';
}
function drawLying(f, look, lt, standT, blood) {
  const d = f.facing, s = f.h / 18, X = f.x, Y = f.y;
  if (blood && f.type !== 'shade') {
    ctx.save(); ctx.translate(X - d * 2.5, Y + 0.15); ctx.scale(1, 0.22);
    const r = Math.min(8 * s, 1 + f.deadT * 0.06), gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    gr.addColorStop(0, 'rgba(70,6,10,0.92)'); gr.addColorStop(0.8, 'rgba(50,4,8,0.85)'); gr.addColorStop(1, 'rgba(40,2,6,0)');
    ctx.fillStyle = gr; circle(0, 0, r); ctx.restore();
  }
  const paint = (col, ox, oy) => {
    ctx.fillStyle = col;
    capsule(X + ox, Y - 1.1 * s + oy, X - d * 6 * s + ox, Y - 1.3 * s + oy, 1.2 * s, 1.4 * s);
    circle(X - d * 7.9 * s + ox, Y - 1.4 * s + oy, 1.45 * s);
    capsule(X + ox, Y - 1.1 * s + oy, X + d * 2.4 * s + ox, Y - 2.6 * s + oy, 1.0 * s, 0.72 * s);
    capsule(X + d * 2.4 * s + ox, Y - 2.6 * s + oy, X + d * 4.6 * s + ox, Y - 0.6 + oy, 0.72 * s, 0.5 * s);
    capsule(X + ox, Y - 0.9 * s + oy, X + d * 5.4 * s + ox, Y - 0.5 + oy, 0.9 * s, 0.5 * s);
    capsule(X - d * 5 * s + ox, Y - 1.6 * s + oy, X - d * 3 * s + ox, Y - 0.5 + oy, 0.6 * s, 0.5 * s);
  };
  ctx.save();
  const t = smooth(0, 1, standT);
  ctx.translate(X, Y); ctx.rotate(d * Math.PI / 2 * (1 - t)); ctx.translate(-X, -Y);
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * 0.6; paint(lt.col, 0, -0.3);
  ctx.globalAlpha = ga; paint(look.body, 0, 0);
  ctx.restore();
}
function drawRolling(f, look, lt) {
  const d = f.rollDir, s = f.h / 18, a = (16 - f.roll) / 16 * Math.PI * 2 * d;
  const body = (col, ox, oy) => {
    ctx.save(); ctx.translate(f.x + ox, f.y - 3.6 * s + oy); ctx.rotate(a); ctx.fillStyle = col;
    capsule(0, 1.4, 0, -1.6, 1.6 * s, 1.5 * s); circle(d * 1.0, -3.0 * s, 1.35 * s);
    capsule(0.2, 1.0, d * 2.4, 2.4, 0.9, 0.6); capsule(0, -0.5, d * 2.2, -1, 0.6, 0.5);
    ctx.restore();
  };
  if (f.team === 'player') drawScarf(f, null);
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * 0.7; body(lt.col, lt.x * 0.3, lt.y * 0.3);
  ctx.globalAlpha = ga; body(look.body, 0, 0);
}
function drawFighter(f) {
  if (f.y > H + 30 || f.x < camX - 40 || f.x > camX + W + 40) return;
  const isP = f.team === 'player', look = lookOf(f), lt = lightFor(f);
  let alpha = (!f.dead && isP && f.invuln > 0 && Math.floor(f.invuln / 4) % 2) ? 0.35 : 1;
  if (look.smoke) alpha *= f.dead ? Math.max(0, 1 - f.deadT / 50) : 0.78 + Math.sin(tick * 0.15) * 0.12;
  if (alpha <= 0.01) return;
  const gy = groundYAt(f.x, f.y);
  if (gy !== null && !f.dead) {
    const sc = clamp(1 - (gy - f.y) / 40, 0.2, 1);
    ctx.fillStyle = `rgba(0,0,0,${(0.42 * sc).toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(f.x, gy + 0.2, 4.4 * f.h / 18 * sc, 0.75 * sc, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = alpha;
  if (f.dead) { drawLying(f, look, lt, f.deadT / 16, true); ctx.globalAlpha = 1; return; }
  if (f.down > 0) { drawLying(f, look, lt, 1, false); stars(f.x - f.facing * 7, f.y - 4, f.anim); ctx.globalAlpha = 1; return; }
  if (f.roll > 0) { drawRolling(f, look, lt); ctx.globalAlpha = 1; return; }
  const R = rig(f, f.x), Hd = handsFor(f, R);
  if (look.smoke) {
    for (let i = 0; i < 6; i++) {
      const t = ((tick * 0.6 + i * 17) % 40) / 40;
      ctx.fillStyle = `rgba(40,30,70,${(0.25 * (1 - t)).toFixed(3)})`;
      circle(f.x + Math.sin(i * 2 + tick * 0.05) * 2, f.y - 8 - t * 14, 1.5 + t * 3);
    }
  }
  if (isP) drawScarf(f, R);
  if (look.cape) drawCape(f, R, look.cape);
  { // edge light: thin act-tinted outline so fighters read against busy backdrops
    const A = curAct(), ec = isP ? '#9fe8ff' : (look.eye || A.rim);
    ctx.globalCompositeOperation = 'lighter';
    glowAt(f.x, f.y - 9, 13, hexRgb(A.rim).join(','), 0.10 * alpha);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha * 0.55;
    for (const [ox, oy] of [[-0.45, 0], [0.45, 0], [0, -0.45]]) paintBody(f, R, Hd, look, ec, ox, oy, true);
    ctx.globalAlpha = alpha;
  }
  if (f.offhand && f.armed) {
    const ea = ik(R.sh[0], R.sh[1], Hd.off[0], Hd.off[1], R.L.upper, R.L.fore, R.d);
    const hx = ea[2], hy = ea[3], tip = f.parry > 0 ? [hx + R.d * 6, hy - 9] : [hx + R.d * 10.5, hy + 1.5 + Math.sin(f.anim * 0.08) * 0.4];
    ctx.globalAlpha = alpha * 0.9; drawBlade(f, hx, hy, tip[0], tip[1]); ctx.globalAlpha = alpha;
  }
  ctx.globalAlpha = alpha * (0.5 + 0.45 * lt.k);
  paintBody(f, R, Hd, look, lt.col, lt.x * 0.3, lt.y * 0.3, true);
  ctx.globalAlpha = alpha;
  const hand = paintBody(f, R, Hd, look, null, 0, 0, false);
  if (f.armed) {
    const b = Hd.blade, x0 = hand[2], y0 = hand[3];
    let x1, y1;
    if (b[0] === null) { x1 = b[2]; y1 = b[3]; } else { x1 = x0 + (b[2] - b[0]); y1 = y0 + (b[3] - b[1]); }
    drawBlade(f, x0, y0, x1, y1);
    ctx.globalCompositeOperation = 'lighter';
    if (f.windup > 0) glowAt(x0, y0, 4, '255,210,130', 0.35 + 0.3 * Math.sin(tick * 0.8));
    if (f.parry > 6) glowAt(x1, y1 + 3, 4, '160,230,255', 0.6);
    if (f.slash >= 5 && f.slash <= 13 && R.slashAng !== undefined) {
      ctx.lineCap = 'round';
      const a1 = R.slashAng, a0 = a1 - 1.5, r = 14 * R.s;
      for (let i = 0; i < 14; i++) {
        const ta = a0 + (a1 - a0) * i / 14, tb = a0 + (a1 - a0) * (i + 1) / 14;
        ctx.strokeStyle = `rgba(230,240,255,${(0.04 + 0.42 * i / 14).toFixed(3)})`; ctx.lineWidth = 0.4 + 1.9 * i / 14;
        line(R.sh[0] + R.d * Math.cos(ta) * r, R.sh[1] + Math.sin(ta) * r, R.sh[0] + R.d * Math.cos(tb) * r, R.sh[1] + Math.sin(tb) * r);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (look.eye) {
    ctx.globalCompositeOperation = 'lighter';
    const ex = R.head[0] + R.d * 0.75 * R.s, ey = R.head[1] - 0.1;
    glowAt(ex, ey, 1.8, hexRgb(look.eye).join(','), 0.6);
    ctx.fillStyle = 'rgba(255,255,255,0.9)'; circle(ex, ey, 0.22);
    ctx.globalCompositeOperation = 'source-over';
  }
  if (f.stun > 0) stars(R.head[0], R.head[1] - 2.6, f.anim);
  if (f.flash > 0) { ctx.globalCompositeOperation = 'lighter'; glowAt(f.x, f.y - 9, 10, '255,255,255', 0.5 * f.flash / 8); ctx.globalCompositeOperation = 'source-over'; }
  ctx.globalAlpha = 1;
}
function drawFighterFull(f) {
  const fast = !f.dead && f.roll <= 0 && f.down <= 0 && (f.dash > 0 || Math.abs(f.vx) > 2.6 || f.heavyL);
  if (fast) {
    const isP = f.team === 'player', look = lookOf(f);
    const col = isP ? '#7fe0ff' : rgba(look.eye || '#ffffff', 1);
    for (const [k, a] of [[4.5, 0.1], [2.2, 0.2]]) {
      const R = rig(f, f.x - f.vx * k); const Hd = handsFor(f, R);
      ctx.globalAlpha = a; paintBody(f, R, Hd, look, col, 0, 0, true);
    }
    ctx.globalAlpha = 1;
  }
  drawFighter(f);
}
function drawSwords() {
  setLayer(1);
  for (const s of swords) {
    if (s.onGround) {
      if (player && !player.armed) { ctx.globalCompositeOperation = 'lighter'; glowAt(s.x, s.y - 0.5, 5, '200,235,255', 0.25 + 0.2 * Math.sin(tick * 0.15)); ctx.globalCompositeOperation = 'source-over'; }
      drawBlade(null, s.x - 4, s.y - 0.4, s.x + 5, s.y - 0.4);
    } else {
      const a = s.age * 0.45;
      if (s.gift) { ctx.globalCompositeOperation = 'lighter'; glowAt(s.x, s.y, 8, '255,235,180', 0.45); ctx.globalCompositeOperation = 'source-over'; }
      drawBlade(null, s.x - Math.cos(a) * 4.5, s.y - Math.sin(a) * 4.5, s.x + Math.cos(a) * 4.5, s.y + Math.sin(a) * 4.5);
    }
  }
  for (const p of projs) {
    const d = Math.sign(p.vx);
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createLinearGradient(p.x - d * 18, 0, p.x, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.45)');
    ctx.strokeStyle = gr; ctx.lineWidth = 0.6; line(p.x - d * 18, p.y, p.x, p.y);
    ctx.globalCompositeOperation = 'source-over';
    drawBlade(null, p.x - d * 4.5, p.y, p.x + d * 5, p.y);
  }
}
function drawParticles() {
  for (const l of loot) { // looted cosmetics: a bobbing, glowing trinket
    const by = l.y - 3 - (l.onGround ? 1.2 + Math.sin(tick * 0.1 + l.x) * 0.8 : 0);
    ctx.globalCompositeOperation = 'lighter'; glowAt(l.x, by, 6, hexRgb(l.c.col).join(','), 0.45 + 0.15 * Math.sin(tick * 0.2)); ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = l.c.col; ctx.save(); ctx.translate(l.x, by); ctx.rotate(Math.PI / 4 + (l.onGround ? 0 : l.age * 0.3));
    ctx.fillRect(-1.3, -1.3, 2.6, 2.6); ctx.fillStyle = 'rgba(255,255,255,0.8)'; ctx.fillRect(-0.5, -1.3, 0.9, 0.9); ctx.restore();
  }
  for (let i = toasts.length - 1; i >= 0; i--) {
    const t = toasts[i]; t.t++; if (t.t > 90) { toasts.splice(i, 1); continue; }
    const a = Math.min(1, (90 - t.t) / 20);
    ctx.font = 'bold 4.5px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillStyle = `rgba(0,0,0,${(a * 0.7).toFixed(2)})`; ctx.fillText(t.str, t.x + 0.4, t.y - t.t * 0.08 + 0.4);
    ctx.fillStyle = rgba(t.col, a); ctx.fillText(t.str, t.x, t.y - t.t * 0.08);
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = impacts.length - 1; i >= 0; i--) {
    const m = impacts[i]; m.t++; const k = m.t / 24;
    if (k >= 1) { impacts.splice(i, 1); continue; }
    const e = 1 - Math.pow(1 - k, 3), a = (1 - k) * 0.8;
    ctx.strokeStyle = rgba(m.col, a); ctx.lineWidth = 1.6 * (1 - k) + 0.2;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r * e, 0, Math.PI * 2); ctx.stroke();
    if (m.slash) { // bright diagonal cut line through the victim
      const L = 26 * (1 - Math.pow(1 - Math.min(1, k * 3), 2));
      ctx.strokeStyle = rgba('#ffffff', a); ctx.lineWidth = 1.4 * (1 - k);
      line(m.x - m.slash * L, m.y + L * 0.35, m.x + m.slash * L, m.y - L * 0.35);
    }
    glowAt(m.x, m.y, m.r * 0.6, hexRgb(m.col).join(','), a * 0.5);
  }
  ctx.globalCompositeOperation = 'source-over';
  setLayer(1);
  ctx.lineCap = 'round';
  for (const p of parts) {
    const a = p.landed ? Math.min(1, p.life / 60) : Math.min(1, p.life / 10);
    if (p.stick) {
      ctx.globalAlpha = a; ctx.fillStyle = p.color;
      if (p.landed) { ctx.beginPath(); ctx.ellipse(p.x, p.y, 0.85, 0.22, 0, 0, Math.PI * 2); ctx.fill(); } else circle(p.x, p.y, 0.32);
    } else if (p.color === '#8a6a80') {
      ctx.globalAlpha = a * 0.35; ctx.fillStyle = '#b0a2a8'; circle(p.x, p.y, 0.5 + Math.max(0, 26 - p.life) * 0.06);
    } else {
      ctx.globalAlpha = a; ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = p.color; ctx.lineWidth = 0.3; line(p.x, p.y, p.x - p.vx * 1.4, p.y - p.vy * 1.4);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.globalAlpha = 1;
}
function drawBarrier() {
  if (cleared || state !== 'play') return;
  setLayer(1);
  const x = (zi + 1) * ZW - 1;
  ctx.globalCompositeOperation = 'lighter';
  const gr = ctx.createLinearGradient(x - 4, 0, x + 1, 0);
  gr.addColorStop(0, 'rgba(255,60,90,0)'); gr.addColorStop(1, `rgba(255,60,90,${(0.22 + 0.1 * Math.sin(tick * 0.1)).toFixed(3)})`);
  ctx.fillStyle = gr; ctx.fillRect(x - 4, 0, 5, GROUND);
  ctx.globalCompositeOperation = 'source-over';
}
function drawForeground(A) {
  const p = 1.25; setLayer(p);
  const x0 = camX * p - 10, x1 = camX * p + W + 10;
  ctx.fillStyle = A.fg; ctx.strokeStyle = A.fg; ctx.lineCap = 'round';
  for (let x = Math.floor(x0 / 4) * 4; x < x1; x += 4) {
    const h = hash(x * 0.37 + 2);
    if (A.grass) {
      if (h < 0.35) continue;
      ctx.lineWidth = 0.55; ctx.beginPath();
      for (let b = 0; b < 4; b++) {
        const bx = x + b * 1.1, len = 5 + hash(x + b) * 9 * h, sw = Math.sin(tick * 0.03 + bx * 0.4) * 1.2;
        ctx.moveTo(bx, H + 1); ctx.quadraticCurveTo(bx + sw * 0.4, H - len * 0.5, bx + sw, H - len);
      }
      ctx.stroke();
    } else if (h > 0.8) { ctx.beginPath(); ctx.ellipse(x, H + 1, 3 + h * 4, 2 + h * 3, 0, 0, Math.PI * 2); ctx.fill(); }
  }
}
function drawWeather() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const wth = state === 'title' ? 'embers' : ZONES[zi].weather;
  ctx.lineCap = 'round';
  for (const w of weatherP) {
    const x = w.x * K, y = w.y * K;
    if (wth === 'rain') { ctx.strokeStyle = `rgba(175,200,240,${(0.1 + w.s * 0.12).toFixed(3)})`; ctx.lineWidth = w.s * 1.3; line(x, y, x - 5 * w.s, y + 22 * w.s); }
    else if (wth === 'ash') { const big = w.s > 1.25; ctx.fillStyle = `rgba(205,195,205,${big ? 0.16 : 0.5})`; circle(x, y, big ? 7 * w.s : 1.4 * w.s); }
    else if (wth === 'petals') { ctx.save(); ctx.translate(x, y); ctx.rotate(tick * 0.03 + w.p); ctx.fillStyle = w.p > 3 ? 'rgba(255,190,205,0.85)' : 'rgba(255,240,200,0.85)'; ctx.beginPath(); ctx.ellipse(0, 0, 3.4 * w.s, 1.4 * w.s, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    else {
      const tw = 0.5 + 0.5 * Math.sin(tick * 0.1 + w.p * 5);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,160,80,${(0.22 * tw).toFixed(3)})`; circle(x, y, 4.5 * w.s);
      ctx.fillStyle = `rgba(255,225,170,${(0.85 * tw).toFixed(3)})`; circle(x, y, 1.1 * w.s);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  if (wth === 'rain') {
    ctx.strokeStyle = 'rgba(200,220,255,0.35)'; ctx.lineWidth = 1;
    for (let i = 0; i < 14; i++) { const sx = hash(i * 3.7 + Math.floor(tick / 5) * 13.1) * RW; ctx.beginPath(); ctx.ellipse(sx, GROUND * K + 2, 6, 1.5, 0, 0, Math.PI * 2); ctx.stroke(); }
  }
}

// ---------- post-processing ----------
const bloomC = document.createElement('canvas'); bloomC.width = 320; bloomC.height = 180;
const bctx = bloomC.getContext('2d');
bctx.filter = 'blur(2px)'; const BLOOM_OK = bctx.filter === 'blur(2px)'; bctx.filter = 'none';
const vignetteC = (() => {
  const c = document.createElement('canvas'); c.width = RW; c.height = RH;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(RW / 2, RH * 0.48, RH * 0.38, RW / 2, RH * 0.48, RW * 0.66);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(4,0,10,0.72)');
  x.fillStyle = gr; x.fillRect(0, 0, RW, RH);
  return c;
})();
let letterbox = 0, titleHero = null;
function post(A) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (BLOOM_OK) {
    bctx.globalCompositeOperation = 'copy';
    bctx.filter = 'brightness(0.7) contrast(2.6) blur(3px)';
    bctx.drawImage(canvas, 0, 0, 320, 180);
    bctx.filter = 'none';
    ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.5;
    ctx.drawImage(bloomC, 0, 0, RW, RH);
    ctx.globalAlpha = 1;
  }
  ctx.globalCompositeOperation = 'soft-light'; ctx.fillStyle = A.grade; ctx.fillRect(0, 0, RW, RH);
  ctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(vignetteC, 0, 0);
  ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.06;
  ctx.save(); ctx.translate(-Math.random() * 256, -Math.random() * 256);
  ctx.fillStyle = grainPat; ctx.fillRect(0, 0, RW + 256, RH + 256); ctx.restore();
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  letterbox += ((speech && state === 'play' ? 1 : 0) - letterbox) * 0.08;
  if (letterbox > 0.01) { const h = letterbox * RH * 0.09; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, RW, h); ctx.fillRect(0, RH - h, RW, h); }
  if (flash > 0) { ctx.fillStyle = `rgba(255,245,220,${flash.toFixed(2)})`; ctx.fillRect(0, 0, RW, RH); }
}

// ---------- HUD (drawn at full resolution) ----------
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
  if (zi === 0) text('J THRUST · K THROW · L HEAVY · U SLASH · O PARRY · SPACE JUMP · SHIFT ROLL/DASH', CW / 2, CH - 46, 13, '#ffffff', 'center', 0.85);
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
    ['L  heavy lunge (breaks a block)', 'O  parry (stuns whoever strikes you)'],
    ['SPACE  jump · in air: ↓+J plunge', 'SHIFT  roll · in air: dash'],
    ['K  throw your blade', 'unarmed: J punch · midair J dive-kick'],
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
  const A = curAct();
  shX = shake > 0 ? rnd(-shake, shake) * 0.4 : 0; shY = shake > 0 ? rnd(-shake, shake) * 0.4 : 0;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  drawSky(A);
  drawLightning();
  drawFar(A);
  drawRuins(A);
  drawFogLayer(A, 100, 42, 0.05, 0.55, 0.3);
  drawWorld(A);
  if (state === 'title') {
    if (!titleHero) { titleHero = makeFighter(0, GROUND, 'player'); titleHero.onGround = true; }
    titleHero.x = camX + W * 0.7; titleHero.anim = tick; updateScarf(titleHero);
    setLayer(1); drawFighter(titleHero);
  } else if (player) {
    drawSwords();
    setLayer(1);
    for (const e of enemies) if (e.dead) drawFighterFull(e);
    for (const e of enemies) if (!e.dead) drawFighterFull(e);
    drawFighterFull(player);
  }
  drawParticles();
  drawBarrier();
  drawFogLayer(A, 128, 36, 0.12, 0.26, 1.1);
  drawForeground(A);
  drawWeather();
  post(A);

  // HUD is laid out in a 960x540 space
  ctx.setTransform(K / S, 0, 0, K / S, 0, 0);
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
  ctx.setTransform(1, 0, 0, 1, 0, 0);
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
