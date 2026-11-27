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
  KeyU: 'slash', KeyI: 'heavy', KeyO: 'parry', Digit1: 'foe1', Digit2: 'foe2', Digit3: 'foe3', Tab: 'build',
  KeyE: 'grab', KeyF: 'grab',
  Enter: 'start', Escape: 'pause', KeyP: 'pause', KeyR: 'restart', KeyM: 'mute', KeyT: 'practice', KeyH: 'hat',
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
  tell() { tone(1900, 0.12, 'triangle', 0.035, 900); noise(0.05, 0.03, 6000); },
  hop() { noise(0.06, 0.05, 1400); },
  shatter() { noise(0.16, 0.22, 3200); noise(0.3, 0.1, 900, 0.03); tone(520, 0.08, 'square', 0.04, -300); },
  slash() { noise(0.16, 0.09, 1600); tone(420, 0.12, 'triangle', 0.03, -200); },
  charge() { tone(180, 0.25, 'sawtooth', 0.03, 260); },
  heavy() { noise(0.18, 0.12, 900); tone(140, 0.2, 'square', 0.05, -60); },
  parry() { tone(2400, 0.3, 'triangle', 0.06, -900); tone(1600, 0.4, 'sine', 0.05); noise(0.06, 0.1, 5000); },
  kill() { noise(0.3, 0.25, 600); tone(160, 0.25, 'sawtooth', 0.07, -100); },
  finisher() { tone(95, 1.1, 'sine', 0.16, -55); tone(48, 1.4, 'sawtooth', 0.05, -18, 0.04); noise(0.55, 0.3, 280); noise(0.14, 0.2, 750, 0.1); noise(0.9, 0.06, 3200, 0.2); },
  squelch() { noise(0.09, 0.07, 520); },
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
  caw() { tone(830, 0.1, 'sawtooth', 0.03, -270); tone(770, 0.13, 'sawtooth', 0.026, -290, 0.17); noise(0.3, 0.035, 700, 0.02); },
  rip() { noise(0.14, 0.09, 2200); noise(0.09, 0.05, 900, 0.03); },
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
  dummy:   { name: 'Training Dummy', body: '#4a4034', accent: '#e8d8a0', reaction: 30, aggr: 0, beat: 0, range: 30, speed: 0, hp: 1, h: 18, rearm: 100, turn: 12, dummy: true },
  sparrer: { name: 'Sparring Partner', body: '#3a4634', accent: '#bff0ff', reaction: 30, aggr: 0, beat: 0, range: 34, speed: 0.7, hp: 1, h: 18, rearm: 100, turn: 10, tell: 28, reel: 34, drill: true },
  squire:  { name: 'Squire',  body: '#3d2a40', accent: '#ff5a6a', reaction: 34, aggr: 0.35, beat: 0.05, range: 32, speed: 0.8,  hp: 1, h: 18, rearm: 420, turn: 12, tell: 26, reel: 28, hop: 0.15 },
  duelist: { name: 'Duelist', body: '#28324e', accent: '#ffa040', reaction: 18, aggr: 0.6,  beat: 0.2,  range: 29, speed: 1.0,  hp: 1, h: 18, rearm: 300, turn: 9, parry: 0.25, tell: 20, reel: 17, hop: 0.5, feint: 0.45 },
  thrower: { name: 'Knifer',  body: '#30244a', accent: '#c07bff', reaction: 24, aggr: 0.4,  beat: 0.05, range: 62, speed: 1.0,  hp: 1, h: 18, rearm: 150, turn: 8, throws: true, tell: 22, reel: 24, hop: 0.3 },
  acolyte: { name: 'Acolyte', body: '#1e3434', accent: '#5affc0', reaction: 14, aggr: 0.55, beat: 0.1,  range: 38, speed: 1.35, hp: 1, h: 17, rearm: 200, turn: 6, dash: true, tell: 17, reel: 20, hop: 0.6 },
  shade:   { name: 'Shade',   body: '#120f1a', accent: '#9a8aff', reaction: 16, aggr: 0.5,  beat: 0.15, range: 30, speed: 1.0,  hp: 1, h: 18, rearm: 200, turn: 7, blink: true, slash: 0.25, tell: 17, reel: 20, hop: 0.4 },
  reaver:  { name: 'Reaver',  body: '#26323c', accent: '#8fd8ff', reaction: 15, aggr: 0.7,  beat: 0.1,  range: 28, speed: 1.2,  hp: 1, h: 19, rearm: 220, turn: 7, dash: true, slash: 0.9, slashTell: 12, slashReach: 5, tell: 19, reel: 22, hop: 0.2, atk: 22 },
  forgehand: { name: 'Forgehand', body: '#3a2a22', accent: '#ff9a4a', reaction: 22, aggr: 0.5, beat: 0.0, range: 30, speed: 0.85, hp: 1, h: 20, rearm: 200, turn: 10, grip: true, heavy: 1.5, heavyTell: 14, tell: 24, reel: 26, hop: 0.1 },
  gaoler:  { name: 'THE GAOLER', body: '#3b2a20', accent: '#ff7a2a', reaction: 20, aggr: 0.65, beat: 0.0, range: 26, speed: 0.75, hp: 4, h: 24, rearm: 120, turn: 10,
             boss: true, grip: true, slash: 0.7, heavy: 0.25, tell: 24, reel: 22, atk: 20, line: 'NO ONE CLIMBS PAST THE GAOLER. NO ONE EVER HAS.' },
  falconer: { name: 'THE FALCONER', body: '#1b2630', accent: '#bfe8ff', reaction: 13, aggr: 0.6, beat: 0.2, range: 64, speed: 1.15, hp: 3, h: 20, rearm: 70, turn: 6,
             boss: true, throws: true, dash: true, parry: 0.3, tell: 18, reel: 16, hop: 0.7, feint: 0.3, line: 'I HAVE WATCHED YOU CLIMB SINCE THE GATE, LITTLE BIRD. THIS IS AS HIGH AS YOU FLY.' },
  hammer:  { name: 'THE HAMMER', body: '#3b2418', accent: '#ff7a2a', reaction: 18, aggr: 0.6, beat: 0.0, range: 28, speed: 0.8, hp: 3, h: 23, rearm: 120, turn: 9,
             boss: true, grip: true, heavy: 1.2, heavyTell: 10, slash: 0.6, slashTell: 10, slashReach: 4, tell: 22, reel: 20, atk: 27, line: 'WE CAST THAT BELL, MY BROTHER AND I. NO STRANGER RINGS IT.' },
  tongs:   { name: 'THE TONGS', body: '#2a2622', accent: '#ffd08a', reaction: 12, aggr: 0.65, beat: 0.25, range: 30, speed: 1.2, hp: 2, h: 18, rearm: 150, turn: 6,
             boss: true, dash: true, parry: 0.35, tell: 17, reel: 15, hop: 0.7, feint: 0.4 },
  warden:  { name: 'THE WARDEN', body: '#17121d', accent: '#ffd54a', reaction: 11, aggr: 0.7,  beat: 0.35, range: 28, speed: 1.05, hp: 3, h: 21, rearm: 150, turn: 6,
             boss: true, parry: 0.45, slash: 0.3, heavy: 0.3, tell: 16, reel: 13, hop: 0.6, feint: 0.6, line: 'I SWORE YOUR OATH ONCE, WREN. THE BELL STAYS SILENT. GO HOME.' },
};

// ---------- zones, level geometry & story ----------
const solids = [], platforms = [], torches = [];
function rect(x, y, w, h) { solids.push({ x, y, w, h }); }
const ZONES = [
  { act: 0, title: 'ACT I — THE GATE', name: 'The Outer Gate', enemies: ['squire'], max: 1, weather: 'embers',
    story: 'The outer gate. A squire still keeps his watch, a hundred years after his king died.',
    hint: 'A GLINT SHOWS WHERE THEY WILL STRIKE  ·  BLOCK IT, PARRY IT, OR HOP BACK',
    props: [[132, 'pot'], [238, 'stool']],
    geo: z => { rect(z, GROUND, 320, 40); torches.push(z + 70, z + 250); } },
  { act: 0, name: 'Lantern Walk', enemies: ['squire', 'squire'], max: 1, weather: 'embers',
    story: 'Lanterns no living hand has lit burn along the walk.',
    hint: 'BLADES TOUCHING? FLICK YOUR STANCE TO DISARM  ·  U SLASHES THROUGH ANY GUARD',
    props: [[88, 'pot'], [140, 'lantern'], [200, 'bottle'], [270, 'pot']],
    geo: z => { rect(z, GROUND, 320, 40); rect(z + 100, GROUND - 8, 120, 8); platforms.push({ x: z + 40, y: 124, w: 30 }, { x: z + 128, y: 112, w: 64 }, { x: z + 232, y: 124, w: 30 }); torches.push(z + 80, z + 280); } },
  { act: 0, name: 'The Broken Span', enemies: ['duelist'], max: 1, weather: 'embers',
    story: 'The span broke the night the king fell. His duelists never left it.',
    hint: 'DUELISTS PARRY  ·  HOLD J TO DRAW THE PARRY OUT, THEN LET GO',
    props: [[84, 'pot'], [158, 'skull'], [246, 'stool']],
    geo: z => { rect(z, GROUND, 114, 40); rect(z + 140, GROUND, 40, 40); rect(z + 206, GROUND, 114, 40); torches.push(z + 60, z + 260); } },
  { act: 0, name: 'The Gatehouse', enemies: ['squire', 'duelist', 'squire'], max: 2, weather: 'embers',
    story: 'Inside the gatehouse the portcullis has rusted open. The watch still changes on the hour.',
    hint: 'ONE FIGHTS, ONE WAITS HIS TURN  ·  HURL A POT WITH E TO STUN THE ONE WAITING',
    props: [[70, 'pot'], [122, 'stool'], [200, 'lantern'], [296, 'pot']],
    geo: z => { rect(z, GROUND, 320, 40); rect(z + 92, GROUND - 8, 154, 8); rect(z + 150, GROUND - 16, 96, 8); platforms.push({ x: z + 254, y: 124, w: 32 }); torches.push(z + 46, z + 302); } },
  { act: 0, name: 'The Tilt Yard', enemies: ['duelist', 'squire', 'duelist'], max: 2, weather: 'embers',
    story: "The tilt yard, where the king's duelists were made. The rails are rotten. The lessons are not.",
    hint: 'DUELISTS FEINT: THE GLINT JUMPS TO A NEW HEIGHT  ·  WAIT FOR THE SECOND GLINT',
    props: [[100, 'stool'], [154, 'pot'], [212, 'stool'], [268, 'pot']],
    geo: z => { rect(z, GROUND, 320, 40); for (const x of [70, 124, 184, 238]) rect(z + x, GROUND - 7, 12, 7); torches.push(z + 40, z + 280); } },
  { act: 1, title: 'ACT II — THE DROWNED HALL', name: 'Hall of Knives', enemies: ['thrower', 'squire'], max: 2, weather: 'rain',
    story: 'Rain pours through the broken roof. The knifers here never let a climber get close.',
    hint: 'BLOCK A THROWN BLADE AT ITS HEIGHT  ·  OR ROLL BENEATH IT',
    props: [[78, 'pot'], [112, 'bottle'], [160, 'stool'], [240, 'pot']],
    geo: z => { rect(z, GROUND, 320, 40); rect(z + 102, GROUND - 12, 20, 12); rect(z + 198, GROUND - 12, 20, 12); platforms.push({ x: z + 134, y: 118, w: 52 }); torches.push(z + 60, z + 260); } },
  { act: 1, name: 'The Cistern', enemies: ['thrower', 'duelist', 'thrower'], max: 2, weather: 'rain',
    story: 'The hall drains into a cistern with no bottom. Knifers wait on the far stones and let the dark do their work.',
    hint: 'JUMP THE GAPS  ·  A THROWN BLADE CAN STILL FIND YOU IN THE AIR',
    props: [[52, 'pot'], [122, 'bottle'], [160, 'stool'], [200, 'pot'], [268, 'skull']],
    geo: z => { rect(z, GROUND, 76, 40); rect(z + 102, GROUND, 116, 40); rect(z + 244, GROUND, 76, 40); platforms.push({ x: z + 136, y: 120, w: 48 }); torches.push(z + 40, z + 280); } },
  { act: 1, name: "The Gaoler's Pit", enemies: ['gaoler'], max: 1, weather: 'rain',
    story: 'Chains hang from the ceiling. Something heavy drags itself across the stone.',
    hint: 'HIS GRIP CANNOT BE BROKEN  ·  I FOR A HEAVY LUNGE, OR PARRY HIS SWINGS',
    props: [[92, 'stool'], [160, 'skull'], [226, 'pot']],
    geo: z => { rect(z, GROUND, 62, 40); rect(z + 62, GROUND + 10, 196, 30); rect(z + 258, GROUND, 62, 40); torches.push(z + 40, z + 280); } },
  { act: 1, name: 'Cloister of Ash', enemies: ['acolyte', 'acolyte', 'duelist'], max: 2, weather: 'rain',
    story: 'The acolytes tend the ashes of the old order. They move like smoke and strike from far away.',
    hint: 'ACOLYTES DASH IN FROM RANGE  ·  KEEP YOUR GUARD AT THEIR HEIGHT',
    props: [[72, 'pot'], [101, 'bottle'], [160, 'lantern'], [219, 'bottle'], [250, 'skull']],
    geo: z => { rect(z, GROUND, 320, 40); rect(z + 88, GROUND - 8, 26, 8); rect(z + 206, GROUND - 8, 26, 8); platforms.push({ x: z + 134, y: 118, w: 52 }); torches.push(z + 60, z + 260); } },
  { act: 1, name: 'The Drowned Choir', enemies: ['acolyte', 'thrower', 'duelist', 'acolyte'], max: 2, weather: 'rain',
    story: 'The choir sang the king to his rest and never stopped. The water has reached the stalls.',
    hint: 'TWO FLOORS  ·  JUMP UP TO THE GALLERY TO GET OUT FROM BETWEEN THEM',
    props: [[100, 'bottle'], [160, 'lantern'], [220, 'pot'], [300, 'skull']],
    geo: z => { rect(z, GROUND, 320, 40); rect(z + 44, GROUND - 10, 22, 10); rect(z + 254, GROUND - 10, 22, 10); platforms.push({ x: z + 70, y: 120, w: 180 }); torches.push(z + 24, z + 296); } },
  { act: 2, title: 'ACT III — THE FOUNDRY', name: 'The Bellows Room', enemies: ['forgehand', 'forgehand'], max: 1, weather: 'embers',
    story: 'The bellows still breathe. Here the bell was cast, and the hands that cast it never set their hammers down.',
    hint: 'HIS HEAVY LUNGE TEARS THE BLADE FROM A MATCHED GUARD  ·  PARRY IT (O), OR STRIKE AS HE DRAWS BACK',
    props: [[40, 'pot'], [129, 'lantern'], [160, 'stool'], [191, 'pot'], [276, 'skull']],
    geo: z => { rect(z, GROUND, 70, 40); rect(z + 70, GROUND + 12, 180, 28); rect(z + 250, GROUND, 70, 40); rect(z + 116, GROUND, 26, 12); rect(z + 178, GROUND, 26, 12); torches.push(z + 34, z + 286); } },
  { act: 2, name: 'The Casting Floor', enemies: ['thrower', 'forgehand', 'duelist'], max: 2, weather: 'embers',
    story: 'Channels of bell-metal still run white-hot across the floor. Nothing that falls in them comes out.',
    hint: 'HOLD THE EDGE  ·  A FOE WHO LEAPS ONTO YOUR BLADE IS THROWN BACK INTO THE CHANNEL',
    props: [[96, 'pot'], [176, 'skull'], [242, 'bottle'], [312, 'pot']],
    geo: z => { rect(z, GROUND, 120, 40); rect(z + 146, GROUND, 60, 40); rect(z + 232, GROUND, 88, 40); platforms.push({ x: z + 34, y: 124, w: 44 }, { x: z + 136, y: 116, w: 38 }, { x: z + 262, y: 124, w: 38 }); torches.push(z + 20, z + 304); } },   // each ledge ends over floor: stepping off one never drops you in a channel
  { act: 2, name: 'The Chain Gallery', enemies: ['acolyte', 'forgehand', 'duelist', 'forgehand'], max: 2, weather: 'embers',
    story: 'The great chains that hoisted the bell hang slack over the gallery. Something still pulls at them.',
    hint: 'OVER THE BRIDGE OR UNDER IT  ·  DO NOT LET THEM PIN YOU IN THE GAP',
    props: [[40, 'pot'], [100, 'lantern'], [160, 'skull'], [220, 'bottle'], [284, 'pot']],
    geo: z => { rect(z, GROUND, 320, 40); rect(z + 60, GROUND - 8, 70, 8); rect(z + 84, GROUND - 16, 46, 8); rect(z + 190, GROUND - 8, 70, 8); rect(z + 190, GROUND - 16, 46, 8); platforms.push({ x: z + 130, y: GROUND - 16, w: 60 }); torches.push(z + 30, z + 290); } },
  { act: 2, name: "The Founders' Anvil", enemies: ['hammer', 'tongs'], max: 2, weather: 'embers',
    story: 'Two brothers cast the Bell of Asher. They quarrelled over everything except who would be allowed to ring it.',
    hint: 'THE HAMMER HITS HARD, THE TONGS IS QUICK  ·  THEY TRADE PLACES, SO WATCH WHO STEPS IN',
    props: [[44, 'pot'], [100, 'lantern'], [220, 'lantern'], [276, 'pot']],
    geo: z => { rect(z, GROUND, 320, 40); rect(z + 130, GROUND - 9, 60, 9); platforms.push({ x: z + 52, y: 122, w: 40 }, { x: z + 228, y: 122, w: 40 }); torches.push(z + 30, z + 290); } },
  { act: 3, title: 'ACT IV — ABOVE THE STORM', name: 'The White Parapet', enemies: ['reaver', 'reaver'], max: 1, weather: 'snow',
    story: 'Above the storm the air is still and the stone is white with frost. The reavers were posted here because nothing else could stand the cold.',
    hint: 'REAVERS SLASH THROUGH ANY GUARD  ·  STRIKE AS THE BLADE GOES UP, PARRY (O), OR HOP BACK',
    props: [[48, 'pot'], [132, 'skull'], [188, 'stool'], [272, 'lantern']],
    geo: z => { rect(z, GROUND, 64, 40); rect(z + 64, GROUND + 7, 44, 33); rect(z + 108, GROUND + 14, 104, 26); rect(z + 212, GROUND + 7, 44, 33); rect(z + 256, GROUND, 64, 40); torches.push(z + 36, z + 284); } },
  { act: 3, name: 'The Rookery', enemies: ['thrower', 'reaver', 'thrower'], max: 2, weather: 'snow',
    story: 'The king kept his message-birds here. The birds are long gone. The knifers who fed them are not.',
    hint: 'KNIVES FROM BOTH SIDES  ·  CLIMB OUT OF THEIR LINE, OR ROLL UNDER IT',
    props: [[30, 'pot'], [124, 'lantern'], [160, 'skull'], [196, 'bottle'], [292, 'pot']],
    geo: z => { rect(z, GROUND, 320, 40); platforms.push({ x: z + 44, y: 128, w: 40 }, { x: z + 104, y: 112, w: 44 }, { x: z + 172, y: 112, w: 44 }, { x: z + 236, y: 128, w: 40 }, { x: z + 138, y: 94, w: 44 }); torches.push(z + 22, z + 298); } },
  { act: 3, name: 'The Frozen Stair', enemies: ['acolyte', 'reaver', 'duelist'], max: 2, weather: 'snow',
    story: 'A stair of black ice climbs toward the roost. Acolytes keep it swept. Reavers keep it empty.',
    hint: 'HIGH GROUND WINS  ·  JUMP, HOLD DOWN AND PRESS J TO PLUNGE ON A FOE BELOW',
    props: [[30, 'pot'], [70, 'bottle'], [160, 'lantern'], [250, 'skull'], [292, 'pot']],
    geo: z => { rect(z, GROUND, 320, 40); rect(z + 50, GROUND - 7, 220, 7); rect(z + 90, GROUND - 14, 140, 7); rect(z + 130, GROUND - 21, 60, 7); torches.push(z + 26, z + 294); } },
  { act: 3, name: "The Falconer's Roost", enemies: ['falconer'], max: 1, weather: 'snow',
    story: 'The Falconer hunted for the king. With no king and no birds left, she hunts whatever climbs.',
    hint: 'SHE THROWS, DASHES AND PARRIES  ·  RUSH HER WHILE HER HAND IS EMPTY  ·  THREE WOUNDS',
    props: [[60, 'pot'], [140, 'lantern'], [180, 'pot'], [264, 'skull']],
    geo: z => { rect(z, GROUND, 320, 40); rect(z + 100, GROUND - 11, 18, 11); rect(z + 202, GROUND - 11, 18, 11); platforms.push({ x: z + 28, y: 122, w: 38 }, { x: z + 254, y: 122, w: 38 }); torches.push(z + 80, z + 240); } },
  { act: 4, title: 'ACT V — THE SPIRE', name: 'The Dais', enemies: ['duelist', 'thrower', 'duelist'], max: 2, weather: 'ash',
    story: 'The old court waits on the dais for a king who will never return.',
    hint: 'IN THE AIR, HOLD DOWN AND PRESS J TO PLUNGE  ·  SHIFT IN THE AIR TO DASH',
    props: [[84, 'pot'], [118, 'lantern'], [160, 'skull'], [236, 'pot']],
    geo: z => { rect(z, GROUND, 320, 40); rect(z + 104, GROUND - 8, 112, 8); rect(z + 132, GROUND - 16, 56, 8); torches.push(z + 50, z + 270); } },
  { act: 4, name: 'The Throne Gallery', enemies: ['duelist', 'reaver', 'thrower', 'duelist'], max: 2, weather: 'ash',
    story: 'Empty thrones line the gallery, one for every king who ordered the bell kept silent.',
    hint: 'CLIMB THE BROKEN STAIR TO SPLIT THEM UP  ·  PLUNGE (DOWN + J) ON WHOEVER FOLLOWS',
    props: [[36, 'skull'], [130, 'pot'], [190, 'lantern'], [256, 'pot'], [300, 'skull']],
    geo: z => { rect(z, GROUND, 320, 40); rect(z + 236, GROUND - 8, 40, 8); platforms.push({ x: z + 50, y: 128, w: 40 }, { x: z + 110, y: 116, w: 40 }, { x: z + 170, y: 104, w: 40 }, { x: z + 230, y: 92, w: 44 }); torches.push(z + 24, z + 296); } },
  { act: 4, name: 'Shadow Stair', enemies: ['shade', 'shade', 'shade'], max: 2, weather: 'ash',
    story: 'This high up, the dead have forgotten their own shapes. Shades step between the shadows.',
    hint: 'SHADES APPEAR BEHIND YOU  ·  NEVER STAND STILL',
    props: [[40, 'skull'], [88, 'bottle'], [176, 'pot'], [262, 'lantern']],
    geo: z => { rect(z, GROUND, 110, 40); rect(z + 60, GROUND - 9, 50, 9); rect(z + 138, GROUND, 182, 40); rect(z + 138, GROUND - 9, 60, 9); platforms.push({ x: z + 204, y: 116, w: 44 }); torches.push(z + 30, z + 290); } },
  { act: 4, name: 'The Ossuary', enemies: ['shade', 'reaver', 'duelist', 'shade'], max: 2, weather: 'ash',
    story: 'Everyone who failed this climb before you is stacked along these walls. Some of them are still willing to try again.',
    hint: 'EVERYTHING YOU HAVE LEARNED  ·  WATCH THE GLINT, KEEP MOVING, STRIKE WHERE THEY ARE NOT',
    props: [[40, 'skull'], [100, 'skull'], [160, 'pot'], [226, 'lantern'], [282, 'skull']],
    geo: z => { rect(z, GROUND, 128, 40); rect(z + 128, GROUND + 9, 64, 31); rect(z + 192, GROUND, 128, 40); platforms.push({ x: z + 136, y: 126, w: 48 }); torches.push(z + 50, z + 270); } },
  { act: 4, name: "Warden's Landing", enemies: ['warden'], max: 1, weather: 'ash',
    story: 'The Warden was the first of your order. He swore the same oath you did, and broke it.',
    hint: 'THE WARDEN PARRIES, SLASHES AND DISARMS  ·  THREE WOUNDS FELL HIM',
    props: [[60, 'lantern'], [128, 'pot'], [196, 'skull'], [262, 'lantern']],
    geo: z => { rect(z, GROUND, 320, 40); rect(z + 74, GROUND - 6, 172, 6); torches.push(z + 40, z + 280); } },
  { act: 5, title: 'THE BELL', name: 'The Bell', enemies: [], max: 0, weather: 'petals',
    story: 'Dawn. The bell hangs before you.',
    hint: 'RING THE BELL',
    geo: z => { rect(z, GROUND, 320, 40); torches.push(z + 180, z + 300); } },
];
ZONES.forEach((zn, i) => zn.geo(i * ZW));
const BELL_X = (ZONES.length - 1) * ZW + 240;

const INTRO = [
  'For a hundred years the Bell of Asher has hung silent at the top of the spire.',
  'While it stays silent, the dead stay at their posts. Squires, reavers and the Warden himself still guard the stair, fencing in the dark for a king long gone.',
  'You are Wren, the last of the Riposte, an order sworn to ring the bell. You are all that is left of that oath.',
  'Climb. Strike where they are not.',
];
const ENDING = [
  'The bell sounds across the valley for the first time in a hundred years.',
  'On every landing of the spire the old guard lower their blades, lie down in the ash, and rest.',
  'Wren sits beneath the bell until the sun is fully up. The oath is kept.',
  'THE END',
];

// ---------- builds: one relic after every landing, and foes that grow with the climb ----------
// Tier 0 common, 1 rare, 2 legendary (bosses give legendaries). Every relic stacks: take it again and it grows.
let buildsOn = true;
let relics = {}, relicOrder = [], offer = null, pickSel = 1, pickT = 0, pickAt = 0, lastPickZone = -1;
let wardLeft = 0, rushT = 0, stormN = 0, spareK = 0, bolts = [], boltFx = [];
const secs = fr => (fr / 60).toFixed(fr % 6 ? 2 : 1) + 's';
const SPARE_EVERY = [6, 4, 3, 2];
const RELICS = [
  { id: 'whetstone', tier: 0, name: 'Whetstone', desc: n => `Your thrusts reach ${n * 10}% further.` },
  { id: 'boots', tier: 0, name: "Fencer's Boots", desc: n => `You move ${n * 7}% faster.` },
  { id: 'wrist', tier: 0, name: 'Quick Wrist', max: 5, desc: n => `You recover from a thrust ${Math.round(n * 12.5)}% sooner.` },
  { id: 'spring', tier: 0, name: 'Coiled Spring', desc: n => `Back-step and roll are ready ${Math.round((1 - 0.82 ** n) * 100)}% sooner.` },
  { id: 'steady', tier: 0, name: 'Steady Hand', desc: n => `After a parry you have ${n * 25}% longer to riposte.` },
  { id: 'pommel', tier: 0, name: 'Heavy Pommel', max: 5, desc: n => `Your heavy lunge (L) winds up ${Math.round((1 - 0.85 ** n) * 100)}% faster.` },
  { id: 'arm', tier: 0, name: "Pitcher's Arm", desc: n => `Pots and stools you throw stun ${n * 50}% longer.` },
  { id: 'eye', tier: 0, name: "Duelist's Eye", max: 6, desc: n => `Foes take ${n * 10}% longer to wind up a strike.` },
  { id: 'rush', tier: 0, name: 'Bloodrush', desc: n => `After a kill you move and strike faster for ${secs(90 + 45 * (n - 1))}.` },
  { id: 'feather', tier: 0, name: 'Hawk Feather', desc: n => `You jump ${n * 12}% higher.` },
  { id: 'spare', tier: 1, name: 'Spare Blade', desc: n => `Begin every landing with a second blade. A fresh one after every ${SPARE_EVERY[Math.min(n, 4) - 1]} kills.` },
  { id: 'lodestone', tier: 1, name: 'Lodestone', desc: n => `Your thrown blade (K) flies back to your hand${n > 1 ? ', ' + (n - 1) * 20 + '% faster' : ''}.` },
  { id: 'ghost', tier: 1, name: 'Ghost Blade', max: 4, desc: n => `Left unarmed, a new blade forms in your hand after ${secs(Math.max(45, 150 - 35 * (n - 1)))}.` },
  { id: 'shadow', tier: 1, name: 'Shadow Step', desc: n => `Nothing can touch you for the first ${secs(8 + 4 * (n - 1))} of a back-step, roll or air dash.` },
  { id: 'wing', tier: 1, name: "Crow's Wing", desc: n => `Jump ${n === 1 ? 'once' : n === 2 ? 'twice' : n + ' times'} more in mid-air.` },
  { id: 'thunder', tier: 1, name: 'Thunder Riposte', desc: n => `A kill with a riposte sends out a shock that stuns foes ${n > 1 ? 'in a ' + (n - 1) * 30 + '% wider ring' : 'nearby'}.` },
  { id: 'meteor', tier: 1, name: 'Meteor Plunge', desc: n => `Your plunge (DOWN + J in the air) lands with a shockwave ${n * 55}% wider and longer.` },
  { id: 'ward', tier: 1, name: 'Ward of Asher', desc: n => `${n === 1 ? 'Once' : n === 2 ? 'Twice' : n + ' times'} each landing, a killing blow is turned aside.` },
  { id: 'flask', tier: 1, name: 'Powder Flask', desc: n => `Pots and stools you throw burst, stunning everyone near where they land${n > 1 ? ' (wider)' : ''}.` },
  { id: 'dread', tier: 1, name: 'Dread', desc: n => `When a foe dies, the nearest other foe freezes for ${secs(30 + 15 * (n - 1))}.` },
  { id: 'guard', tier: 1, name: 'Iron Guard', desc: n => `A foe whose thrust lands on your guard is staggered for ${secs(16 + 8 * (n - 1))}.` },
  { id: 'echo', tier: 2, name: 'Echo Blade', desc: n => `Every thrust looses a ghost blade that flies ahead of you${n > 1 ? ', ' + (n - 1) * 35 + '% further' : ''}.` },
  { id: 'storm', tier: 2, name: 'Stormcaller', max: 2, desc: n => `Every ${n === 1 ? 'third' : 'second'} kill calls lightning down on the nearest foe.` },
  { id: 'bell', tier: 2, name: 'Bell Shard', desc: n => `Your parry lasts longer, and a parry that lands stuns every foe nearby for ${secs(40 + 15 * (n - 1))}.` },
  { id: 'mark', tier: 2, name: "Executioner's Mark", max: 3, desc: n => `Each hit takes ${1 + n} wounds from elites and bosses.` },
  { id: 'cloak', tier: 2, name: 'Wraith Cloak', desc: n => `After every kill nothing can touch you for ${secs(45 + 20 * (n - 1))}.` },
];
const RELIC = {}; for (const r of RELICS) RELIC[r.id] = r;
const TIER_NAME = ['COMMON', 'RARE', 'LEGENDARY'], TIER_COL = ['#e8e2d4', '#5ad0ff', '#ffc84a'];
function rel(id) { return (buildsOn && !practice && relics[id]) || 0; }
function threat() { return buildsOn && !practice ? zi : 0; }
function zoneBoss(i = zi) { return ZONES[i].enemies.some(t => TYPES[t].boss); }
function zoneMax() { return ZONES[zi].max; }   // never a crowd: higher landings send sharper foes, not more at once
function extraFoes() { return Math.min(2, Math.floor(threat() / 7)); }
// three to choose from: commons early, more rares the higher you climb, legendaries from a boss
function rollOffer() {
  const boss = zoneBoss(), out = [];
  for (let s = 0; s < 3; s++) {
    const tier = boss ? 2 : Math.random() < Math.min(0.6, 0.22 + 0.03 * zi) ? 1 : 0;
    let pool = RELICS.filter(r => r.tier === tier && !out.includes(r.id) && (relics[r.id] || 0) < (r.max || 99));
    if (!pool.length) pool = RELICS.filter(r => !out.includes(r.id) && (relics[r.id] || 0) < (r.max || 99));
    out.push(pool[Math.floor(Math.random() * pool.length)].id);
  }
  return out;
}
function openPick() { offer = rollOffer(); pickSel = 1; pickT = 0; pickAt = 0; sfx.clear(); }
function takeRelic(id) {
  const first = !relics[id];
  relics[id] = (relics[id] || 0) + 1; if (first) relicOrder.push(id);
  lastPickZone = zi; offer = null; bufAct = null; bufJump = 0; for (const k in pressed) pressed[k] = false;
  if (id === 'spare' && player.armed) player.offhand = true;
  if (id === 'ward') wardLeft++;
  if (player) { burst(player.x, player.y - 12, 22, TIER_COL[RELIC[id].tier], 1.8, 34, 0.02); toast(player.x, player.y - 26, RELIC[id].name.toUpperCase() + (relics[id] > 1 ? '  x' + relics[id] : ''), TIER_COL[RELIC[id].tier]); lightFlash(player.x, player.y - 12, 60, '255,236,190', 1, 16); }
  sfx.pickup();
}
function stepPick() {
  tick++; pickT++;
  if (pressed.left && pickSel > 0) { pickSel--; sfx.stance(); }
  if (pressed.right && pickSel < 2) { pickSel++; sfx.stance(); }
  let take = -1;
  if (pickT > 12) { if (pressed.foe1) take = 0; else if (pressed.foe2) take = 1; else if (pressed.foe3) take = 2; else if (pressed.pick) take = pressed.pick - 1; }
  if (pickT > 25 && (pressed.start || pressed.attack || pressed.jump)) take = pickSel;
  if (take >= 0 && offer[take]) takeRelic(offer[take]);
}
// a ring of force: staggers every foe inside it (bosses shrug off half)
function shock(x, y, r, stun, except, col = '#bfe8ff') {
  for (const e of enemies) {
    if (e.dead || e === except || Math.abs(e.x - x) > r || Math.abs(e.y - y) > 34) continue;
    clearActions(e); e.stun = Math.max(e.stun, e.T.boss ? Math.round(stun * 0.5) : stun); e.vx = (e.x >= x ? 1 : -1) * 1.6; e.flash = 6; e.parried = false; e.riposteE = 0;
  }
  impact(x, y - 8, col, r); lightFlash(x, y - 8, r * 1.4, '200,232,255', 1, 14); shake = Math.max(shake, 4);
}
// everything a build does when a foe falls
function onFoeDeath(f, dir) {
  if (!buildsOn || practice || !player || player.dead) return;
  let n;
  if ((n = rel('rush'))) rushT = 90 + 45 * (n - 1);
  if ((n = rel('cloak'))) player.invuln = Math.max(player.invuln, 45 + 20 * (n - 1));
  if ((n = rel('thunder')) && player.ripK && player.lunge > 0) { shock(f.x, f.y, 50 * (1 + 0.3 * (n - 1)), 50, f); sfx.parry(); }
  const others = enemies.filter(e => !e.dead && e !== f).sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x));
  if ((n = rel('dread')) && others[0]) { const e = others[0]; clearActions(e); e.stun = Math.max(e.stun, Math.round((30 + 15 * (n - 1)) * (e.T.boss ? 0.5 : 1))); e.flash = 5; toast(e.x, e.y - e.h - 6, 'DREAD', '#c9a8ff'); }
  if ((n = rel('spare')) && ++spareK >= SPARE_EVERY[Math.min(n, 4) - 1]) { spareK = 0; if (player.armed && !player.offhand) { player.offhand = true; toast(player.x, player.y - 22, 'TWO BLADES', '#9fe8ff'); } }
  if ((n = rel('storm')) && ++stormN >= (n >= 2 ? 2 : 3)) { stormN = 0; const near = enemies.filter(e => !e.dead && e !== f).sort((a, b) => Math.abs(a.x - player.x) - Math.abs(b.x - player.x))[0]; if (near) bolts.push({ e: near, t: 14 }); }
}
function updateBuild() {
  if (rushT > 0) rushT--;
  for (const b of bolts) {
    if (--b.t > 0) continue;
    b.done = true; const e = b.e; if (e.dead) continue;
    boltFx.push({ x: e.x, y: e.y - e.h, t: 0, seed: Math.random() * 99 }); sfx.thunder(); lightFlash(e.x, e.y - 12, 110, '210,230,255', 1, 16); shake = Math.max(shake, 8); flash = Math.max(flash, 0.25);
    burst(e.x, e.y - 10, 18, '#dff0ff', 2.6, 22, 0.02); scar(e.x, e.y, 1);
    e.invuln = 0; kill(e, e.x >= player.x ? 1 : -1);
  }
  bolts = bolts.filter(b => !b.done);
  for (const b of boltFx) b.t++; boltFx = boltFx.filter(b => b.t < 14);
}
// foes harden with every landing: quicker to react and strike, a little faster, more of them, and elites that take two hits
function scaleFoe(e) {
  const k = threat(); if (!k) return;
  const B = TYPES[e.type], T = Object.assign({}, B);
  T.reaction = Math.max(8, Math.round(B.reaction * Math.max(0.6, 1 - 0.022 * k)));
  if (B.tell) T.tell = Math.max(12, Math.round(B.tell * (1 - 0.016 * k)));
  T.aggr = Math.min(0.95, B.aggr + 0.012 * k); T.speed = B.speed * (1 + 0.012 * k);
  if (B.parry) T.parry = Math.min(0.6, B.parry + 0.008 * k);
  if (B.boss) T.hp = B.hp + Math.floor(k / 8);
  else if (k >= 3 && Math.random() < Math.min(0.45, 0.06 * (k - 2))) { T.hp = 2; T.elite = true; T.name = 'Elite ' + B.name; }
  e.T = T; e.hp = T.hp;
}

// ---------- game state ----------
let state = 'title';
let zi = 0, cleared = false, queue = [], spawnT = 0;
let leadFoe = null, foeThrowT = 0, lastAlive = 0;   // one foe presses the fight at a time; the rest wait their turn
let player = null, enemies = [], swords = [], projs = [], parts = [], loot = [];
let props = [];   // pots, stools, bottles, skulls and lanterns lying about: press E beside one to hurl it at the nearest foe
// ---- cosmetics looted from fallen foes (kept between runs) ----
const COSMETICS = {
  squire:  [{ id: 'squire_helm', name: "Squire's Helm", slot: 'head', props: { helm: '#8a8a92' }, col: '#8a8a92' }],
  duelist: [{ id: 'duelist_hat', name: "Duelist's Plumed Hat", slot: 'head', props: { hat: '#17141f', feather: '#ffa040' }, col: '#ffa040' }],
  thrower: [{ id: 'thrower_sash', name: 'Violet Sash', slot: 'sash', props: { sash: '#c07bff' }, col: '#c07bff' },
            { id: 'thrower_hood', name: "Cutpurse's Hood", slot: 'head', props: { hood: true }, col: '#6a5a7a' }],
  acolyte: [{ id: 'acolyte_mask', name: 'Bone Mask', slot: 'face', props: { mask: '#dfe9e4' }, col: '#dfe9e4' }],
  shade:   [{ id: 'shade_hood', name: 'Shade Cowl', slot: 'head', props: { hood: true }, col: '#b8a8ff' }],
  reaver:  [{ id: 'reaver_mantle', name: 'Frost Mantle', slot: 'cape', props: { cape: '#d8e2ea' }, col: '#d8e2ea' }],
  falconer: [{ id: 'falconer_cloak', name: "Falconer's Cloak", slot: 'cape', props: { cape: '#3a5a78' }, col: '#bfe8ff' },
             { id: 'falconer_mask', name: 'Hawk Mask', slot: 'face', props: { mask: '#e8f2f8' }, col: '#e8f2f8' }],
  forgehand: [{ id: 'forge_sash', name: 'Ember Sash', slot: 'sash', props: { sash: '#ff9a4a' }, col: '#ff9a4a' }],
  hammer:  [{ id: 'hammer_cape', name: "Founder's Mantle", slot: 'cape', props: { cape: '#5a2408' }, col: '#ff7a2a' }],
  tongs:   [{ id: 'tongs_mask', name: 'Brass Mask', slot: 'face', props: { mask: '#d8c8a8' }, col: '#ffd08a' }],
  gaoler:  [{ id: 'gaoler_cape', name: "Gaoler's Mantle", slot: 'cape', props: { cape: '#3c1d10' }, col: '#ff7a2a' },
            { id: 'gaoler_chains', name: 'Gaol Chains', slot: 'sash', props: { chains: true }, col: '#6a6460' }],
  warden:  [{ id: 'warden_crown', name: "Warden's Crown", slot: 'head', props: { crown: '#ffd54a' }, col: '#ffd54a' },
            { id: 'warden_cape', name: 'Crimson Cape', slot: 'cape', props: { cape: '#5c1218' }, col: '#ff5a5a' }],
};
const COSMETIC_BY_ID = {}; for (const k in COSMETICS) for (const c of COSMETICS[k]) COSMETIC_BY_ID[c.id] = c;
let wardrobe = {}; // slot -> cosmetic id
try { wardrobe = JSON.parse(localStorage.getItem('riposte.wardrobe') || '{}') || {}; } catch (e) { wardrobe = {}; }
const HEAD_KEYS = ['helm', 'hat', 'feather', 'cavalier', 'crown', 'hood'];
function lookOf(f) {
  if (f.team !== 'player') return LOOKS[f.type];
  const L = Object.assign({}, LOOKS.player);
  for (const slot in wardrobe) {
    const c = COSMETIC_BY_ID[wardrobe[slot]]; if (!c) continue;
    if (slot === 'head') continue;   // the swordsman always keeps their own plumed hat; old saved headwear is ignored
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
// duel camera: zoom and view-centre (in screen units, after horizontal scroll)
const cam = { z: 1, cx: W / 2, cy: H / 2 };
// finishing blow: slow motion + close-up.  fin = { f: victim, t: real frames, boss }
let slowmo = 0, slowAcc = 0, fin = null, bleeders = [];
const FIN_RATE = 0.28;
// input buffer: the last action pressed is remembered for a few frames, so a press made during a
// hit-stop or just before a recovery ends still comes out (parry -> riposte, flick -> thrust)
let bufAct = null, bufT = 0, bufJump = 0;
let touched = 0;
let practiceFoe = 'dummy';   // 'dummy' stands still, 'sparrer' fights back (but his touches do not kill)
let practice = false;   // practice arena: one training dummy that stands still and comes back when cut down
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
    unarmedT: 0, contactT: 0, scarf: [], offhand: false, pose: 1, rollCd: 0, did: false,
    prep: 0, prepT: 0, hop: 0, over: 0, riposteT: 0, atkId: 0, riposteE: 0, ripFx: 0, glint: 0,
  };
}
function clearActions(f) { f.lunge = 0; f.heavyL = false; f.windup = 0; f.slash = 0; f.parry = 0; f.dash = 0; f.plunge = false; f.prep = 0; f.hop = 0; f.over = 0; }

function showPages(list, done) { pages = list; pageI = 0; pageChars = 0; pagesDone = done; state = 'story'; }

function resetProps() {
  props = (ZONES[zi].props || []).map(([dx, kind]) => { const x = zi * ZW + dx; return { x, y: groundYAt(x, 100) ?? GROUND, kind, x0: x, fly: false, spin: 0, back: 0 }; });
}
const PROP_COL = { pot: '#a8623e', stool: '#7a5632', bottle: '#3f7a5e', skull: '#d8d0b8', lantern: '#ffb45a' };
function nearProp(f) {
  let best = null, bd = 17;
  for (const p of props) { if (p.fly || p.back > 0) continue; const d = Math.abs(p.x - f.x); if (d < bd && Math.abs(p.y - f.y) < 13) { bd = d; best = p; } }
  return best;
}
function shatterProp(p, dir) {
  const c = PROP_COL[p.kind];
  if (p.fly && rel('flask')) { shock(p.x, Math.min(p.y, GROUND + 14), 30 + 10 * (rel('flask') - 1), 40, null, '#ffd27a'); for (let i = 0; i < 14; i++) parts.push({ x: p.x, y: p.y, vx: rnd(-2.6, 2.6), vy: rnd(-2.8, -0.2), life: rnd(30, 60), grav: 0.15, spark: true, b: 0 }); }
  for (let i = 0; i < 12; i++) parts.push({ x: p.x, y: p.y, vx: dir * rnd(-0.6, 2.2) + rnd(-0.8, 0.8), vy: rnd(-2.6, -0.2), life: rnd(50, 80), grav: 0.16, color: i % 3 ? c : mixHex(c, '#000000', 0.4), stick: true, r: rnd(0.16, 0.34), debris: true });
  dust(p.x, p.y, 5);
  if (p.kind === 'lantern') { for (let i = 0; i < 12; i++) parts.push({ x: p.x, y: p.y, vx: rnd(-2, 2), vy: rnd(-2.6, -0.3), life: rnd(36, 70), grav: 0.15, spark: true, b: 0 }); lightFlash(p.x, p.y, 54, '255,190,110', 1, 14); }
  sfx.shatter();
  if (practice) { p.fly = false; p.back = 260; p.x = p.x0; p.y = groundYAt(p.x0, 100) ?? GROUND; } else props.splice(props.indexOf(p), 1);
}
// E beside a prop: it leaves your hand at once, straight at the nearest foe. A hit breaks their stance for a moment.
function hurlProp(p) {
  const f = player;
  let tg = null, bd = 230;
  for (const e of enemies) { if (e.dead || e.y > H) continue; const d = Math.abs(e.x - f.x); if (d < bd) { bd = d; tg = e; } }
  if (tg && f.lunge <= 0 && f.slash <= 0) f.facing = tg.x >= f.x ? 1 : -1;
  p.fly = true; p.tg = tg; p.x = f.x + f.facing * 4; p.y = f.y - 12; p.spin = 0; p.age = 0;
  if (tg) { const dx = tg.x - p.x, dy = tg.y - 11 - p.y, L = Math.hypot(dx, dy) || 1; p.vx = dx / L * 6.4; p.vy = dy / L * 6.4 - 0.5; }
  else { p.vx = f.facing * 5.6; p.vy = -1.4; }
  f.prep = 0; f.fling = 10; f.cool = Math.max(f.cool, 9); sfx.throw(); dust(f.x, f.y, 2);
}
function updateProps() {
  for (const p of props.slice()) {
    if (p.back > 0) { if (--p.back === 0) dust(p.x, p.y, 4); continue; }
    if (!p.fly) continue;
    p.age++; p.spin += 0.5;
    const t = p.tg && !p.tg.dead ? p.tg : null;
    if (t) {            // it bends toward its mark, so a hop sideways will not save them
      const dx = t.x - p.x, dy = t.y - 11 - p.y, L = Math.hypot(dx, dy) || 1;
      p.vx += (dx / L * 6.4 - p.vx) * 0.25; p.vy += (dy / L * 6.4 - p.vy) * 0.25;
    } else p.vy += 0.2;
    p.x += p.vx; p.y += p.vy;
    const dir = p.vx >= 0 ? 1 : -1;
    let hit = null;
    for (const e of enemies) if (!e.dead && e.roll <= 0 && Math.abs(e.x - p.x) < 5.5 && p.y > e.y - e.h - 2 && p.y < e.y + 1) { hit = e; break; }
    if (hit) {
      if (hit.parry > 0) { sparks(p.x, p.y); sfx.parry(); }       // batted out of the air
      else {
        clearActions(hit); hit.stun = Math.round((hit.T.boss ? 22 : 46) * (1 + 0.5 * rel('arm'))); hit.parried = false; hit.riposteE = 0; hit.vx = dir * 1.9; hit.flash = 6;
        impact(p.x, p.y, '#fff0d0', 14); freeze = 4; shake = Math.max(shake, 4); toast(hit.x, hit.y - hit.h - 6, 'STUNNED', '#ffe39a');
      }
      shatterProp(p, dir); continue;
    }
    if (solidAt(p.x, p.y) || p.age > 90 || p.y > H + 20 || p.x < zoneL() - 8 || p.x > zoneR() + 8) { p.y = Math.min(p.y, H); shatterProp(p, dir); }
  }
}
function startPractice() { newGame(0, true); bannerT = 0; storyT = 0; spawnT = 20; }
function newGame(startZone_ = 0, practice_ = false) {
  practice = practice_; touched = 0;
  freeze = 0; shake = 0;
  deaths = 0; kills = 0; timeF = 0;
  relics = {}; relicOrder = []; offer = null; pickAt = 0; lastPickZone = startZone_ - 1; wardLeft = 0; rushT = 0; stormN = 0; spareK = 0; bolts = []; boltFx = [];
  swords = []; projs = []; parts = []; enemies = []; loot = []; scars = []; bleeders = []; slowmo = 0; fin = null; toasts.length = 0; impacts.length = 0; lights.length = 0; ripples = []; resetBanners(); bufAct = null; bufJump = 0;
  player = makeFighter(startZone_ * ZW + 40, GROUND, 'player');
  camX = startZone_ * ZW; respawnT = 0; provideT = 0; speech = null;
  seenStory.clear();
  startZone(startZone_);
  skyPos = skyTarget(); dawnExtra = 0;
  state = 'play';
}

function startZone(i) {
  zi = i;
  resetProps();
  queue = practice ? [practiceFoe] : ZONES[i].enemies.slice();
  if (threat() && queue.length && !zoneBoss(i)) for (let n = extraFoes(); n > 0; n--) queue.push(ZONES[i].enemies[Math.floor(Math.random() * ZONES[i].enemies.length)]);   // the higher the landing, the more of them
  wardLeft = rel('ward'); pickAt = 0; bolts = [];
  if (rel('spare') && player && player.armed) player.offhand = true;
  cleared = queue.length === 0; leadFoe = null; foeThrowT = 0; lastAlive = 0;
  spawnT = i === 0 ? 100 : 50;
  bannerT = ZONES[i].title ? 200 : 150;
  spawnCrows(i);
  if (!seenStory.has(i)) { seenStory.add(i); storyT = 360; }
}

function respawn() {
  enemies = []; swords = []; projs = []; loot = []; bleeders = []; slowmo = 0; fin = null; bufAct = null; bufJump = 0;
  player = makeFighter(zi * ZW + 30, GROUND, 'player');
  player.invuln = 70;
  provideT = 0; speech = null;
  startZone(zi);
  bannerT = 0; spawnT = 20;
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
function reach(f) { return 15 + lungeExt(f) + (f === player && f.lunge > 0 ? 1.5 * rel('whetstone') : 0); }   // blade tip, measured from the fighter's centre
function bodyBox(f) {
  const h = f.dead ? 3 : f.roll > 0 ? 8 : f.down > 0 ? 6 : f.h;
  if (!f.dead && !f.armed && f.pose === 2) return { x: f.x - 3, y: f.y - 11, w: 6, h: 11 };          // ducking: clears HIGH (14)
  if (!f.dead && !f.armed && f.pose === 0) return { x: f.x - 3, y: f.y - h, w: 6, h: h - 7 };        // raised: clears LOW (5)
  return { x: f.x - 3, y: f.y - h, w: 6, h };
}
function pointIn(x, y, b) { return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h; }
function zoneL() { return zi * ZW + 4; }
function zoneR() { return (zi + 1) * ZW - 4; }
function bladeBusy(f) { return f.parry > 0 || f.slash > 0 || f.windup > 0 || f.plunge || f.prep > 0; }   // a blade drawn back for a thrust guards nothing

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
      if (e.vy > 0) { e.y = s.y; e.onGround = true; e.vy = 0; }
      else if (prevY - h >= s.y + s.h - 1) { e.y = s.y + s.h + h; e.vy = 0; }      // a real ceiling: bump your head on it
      else { e.x = e.x < s.x + s.w / 2 ? s.x - w / 2 : s.x + s.w + w / 2; e.hitWall = true; }   // shoved into its side: step out, never down through the floor
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

// ---------- world effects: flashes of light, ripples, banners, crows ----------
const lights = [];       // brief flashes thrown by steel on steel
function lightFlash(x, y, r = 48, rgb = '255,232,190', a = 1, life = 10) { lights.push({ x, y, r, rgb, a, t: 0, life }); if (lights.length > 12) lights.shift(); }
let ripples = [], silh = false;
const torchLean = {};    // torch x -> { x, v }: flames lean in the wind of a passing lunge
const BANNER_X = [[110, 215], [40, 255], [100, 220], [112, 212], [92, 228], [90, 230], [85, 235], [165, 270], [100, 220], [60, 120]];
const BANNER_TOP = 100, BANNER_LEN = 39;
let banners = [], scraps = [], crows = [];
function resetBanners() {
  banners = []; scraps = [];
  BANNER_X.forEach((xs, i) => xs.forEach(x => banners.push({ x: i * ZW + x, len: BANNER_LEN, cut: false, sway: 0, v: 0 })));
}
resetBanners();
// a blade passing through cloth cuts it; the loose end flutters down
function cutBannersAt(x, y, dir, wide, cy) {
  for (const b of banners) {
    const bot = BANNER_TOP + b.len;
    if (Math.abs(x - b.x) > 4.5 + wide || y < BANNER_TOP + 4 || y > bot - 1 || b.len <= 9) continue;
    const c = clamp(cy, BANNER_TOP + 8, bot - 2);
    scraps.push({ x: b.x, y: c, w: 8, h: bot - c, vx: dir * rnd(0.3, 0.9), vy: -0.5, rot: 0, vr: dir * rnd(0.02, 0.06), life: 420, t: 0, col: actAt(b.x).banner, tail: !b.cut });
    b.len = c - BANNER_TOP; b.cut = true; b.v += dir * 0.9;
    sfx.rip(); burst(b.x, c, 6, '#c9b8a0', 1, 20, 0.02);
  }
}
function spawnCrows(i) {
  crows = [];
  const z = i * ZW, spots = [];
  for (const b of banners) if (b.x > z && b.x < z + ZW) spots.push([b.x + rnd(-3, 3), BANNER_TOP - 0.5]);
  for (const p of platforms) if (p.x >= z && p.x < z + ZW) spots.push([p.x + p.w * rnd(0.25, 0.75), p.y]);
  for (let k = 0; k < 2; k++) { const x = z + rnd(150, 300), gy = groundYAt(x, 100); if (gy !== null && gy >= GROUND - 20) spots.push([x, gy]); }
  for (const [x, y] of spots) if (x > z + 75 && Math.random() < 0.7) crows.push({ x, y, fly: false, dir: Math.random() < 0.5 ? -1 : 1, t: rnd(0, 200), vx: 0, vy: 0 });
}
function scatterCrows(x, r) {
  let any = false;
  for (const c of crows) {
    if (c.fly || Math.abs(c.x - x) > r) continue;
    c.fly = true; c.dir = (c.x >= x ? 1 : -1) * (Math.random() < 0.25 ? -1 : 1); c.vx = c.dir * rnd(1.0, 1.9); c.vy = -rnd(0.8, 1.6); c.t = rnd(0, 6); any = true;
  }
  if (any) sfx.caw();
}

// ---------- particles ----------
// scars: nicks and scores cut into the stone by the fight. They stay for the rest of the run.
let scars = [];
function scar(x, y, kind = 0) {
  const gy = groundYAt(x, y - 8); if (gy === null) return;
  scars.push({ x, y: gy, kind, len: rnd(2.6, 5.6), ang: rnd(-0.6, 0.6), seed: Math.random() * 99 });
  if (scars.length > 90) scars.shift();
}
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
// heavier blood: droplets of mixed size thrown in an arc; they streak in the air and stain where they land
function gush(x, y, dir, n, f, pow = 1, up = 1) {
  for (let i = 0; i < n; i++) {
    parts.push({ x: x + rnd(-1, 1), y: y + rnd(-1, 1), vx: dir * rnd(0.3, 3.4) * pow + rnd(-0.5, 0.5), vy: rnd(-3.6, -0.6) * pow * up,
      life: rnd(50, 90), grav: 0.15, color: bloodOf(f, true), stick: true, r: rnd(0.2, 0.5) });
  }
}
function sparks(x, y) {
  burst(x, y, 12, '#fff3b0', 2.5, 14, 0.05); burst(x, y, 5, '#ffffff', 1.5, 8, 0); lightFlash(x, y);
  // a few heavy sparks fall, skitter across the stone and die out
  for (let i = 0; i < 9; i++) parts.push({ x, y, vx: rnd(-2.4, 2.4), vy: rnd(-3.1, -0.4), life: rnd(38, 80), grav: 0.17, spark: true, b: 0 });
}
function dust(x, y, n = 8) { for (let i = 0; i < n; i++) parts.push({ x: x + rnd(-6, 6), y, vx: rnd(-1.2, 1.2), vy: rnd(-0.8, -0.1), life: rnd(14, 26), grav: 0.02, color: '#8a6a80', stick: false }); }

// ---------- combat ----------
function fighterColors(f) {
  return f.team === 'player' ? { body: '#f3ecdf', acc: '#4fd8ff' } : { body: f.T.body, acc: f.T.accent };
}
function bloodOf(f, bright) {
  if (f.type === 'shade') return bright && Math.random() < 0.4 ? '#8a78f0' : '#5a48c0';
  const r = Math.random();
  return bright ? (r < 0.35 ? '#c4121e' : r < 0.7 ? '#a0141c' : '#7a0a12') : (r < 0.5 ? '#7a0a12' : '#a0141c');
}
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
  if (practice && f.team === 'player') {      // sparring: a touch stings, nothing more
    f.invuln = 45; f.stun = 16; f.flash = 8; f.vx = dir * 2.6; clearActions(f);
    toast(f.x, f.y - 26, 'TOUCHED', '#ff8a8a'); sfx.hurt(); freeze = 5; shake = 3; touched++;
    return;
  }
  if (f === player && wardLeft > 0 && rel('ward')) {     // the ward takes the blow instead
    wardLeft--; f.invuln = 55; f.stun = 0; f.vx = dir * 2; clearActions(f);
    shock(f.x, f.y, 36, 34, null, '#ffe39a'); sparks(f.x - dir * 4, f.y - 10); toast(f.x, f.y - 26, 'WARDED', '#ffe39a'); sfx.parry(); freeze = 8;
    return;
  }
  const dmg = f.team === 'enemy' ? 1 + rel('mark') : 1;
  if (f.hp > dmg) {
    f.hp -= dmg; f.invuln = 50; f.stun = 22; f.flash = 8; f.vx = dir * 3; clearActions(f);
    spray(f.x, f.y - 10, dir, 16, bloodOf(f)); sfx.hurt(); freeze = 6; shake = 5;
    return;
  }
  f.dead = true; f.deadT = 0; f.vx = dir * 1.6; f.vy = -1.6;
  if (f.armed) dropSword(f, dir, -3.2);
  clearActions(f);
  spray(f.x, f.y - 10, dir, 30, bloodOf(f));
  burst(f.x, f.y - 10, 10, bloodOf(f), 1.5, 30, 0.1, true);
  gush(f.x, f.y - 10, dir, 16, f, 0.8);
  impact(f.x, f.y - 10, f.team === 'player' ? '#ff5060' : '#fff0d0', 22, dir);
  sfx.kill(); shake = 7; freeze = 6;
  // whoever struck the blow carries blood on their blade for a while
  const killer = f.team === 'player' ? enemies.filter(e => !e.dead).sort((a, b) => Math.abs(a.x - f.x) - Math.abs(b.x - f.x))[0] : player;
  if (killer && !killer.dead) killer.bloody = 360;
  bleeders.push({ f, t: 0, n: 2, dir });
  scatterCrows(f.x, 400);
  if (f.team === 'player') { deaths++; respawnT = 55; sfx.death(); }
  else {
    kills++; onFoeDeath(f, dir);
    const pool = (COSMETICS[f.type] || []).filter(c => c.slot !== 'head');   // headwear no longer drops: the hat stays
    if (pool.length && (f.T.boss || Math.random() < 0.55)) {
      const c = pool[Math.floor(Math.random() * pool.length)];
      loot.push({ x: f.x, y: f.y - 12, vx: dir * 0.8, vy: -2.6, onGround: false, age: 0, c });
    }
    if (f.T.boss) { freeze = 28; shake = 12; flash = 0.5; speech = null; burst(f.x, f.y - 12, 40, f.T.accent, 3, 60, 0.05); }
    // the last foe of a zone (or a boss) dies in slow motion, in close-up
    if (practice) queue.push(practiceFoe);
    else if ((f.T.boss && !queue.length && !enemies.some(e => e !== f && !e.dead && e.T.boss)) || (!queue.length && enemies.every(e => e.dead))) {     // of two bosses, only the second fall is the finisher
      fin = { f, t: 0, boss: !!f.T.boss, dir };
      slowmo = f.T.boss ? 190 : 135; slowAcc = 0; freeze = f.T.boss ? 7 : 5; shake = Math.max(shake, 10);
      f.gore = true; f.vy = -2.3; f.vx = dir * 1.9;
      gush(f.x, f.y - 11, dir, 34, f, 1.05); gush(f.x, f.y - 11, -dir, 8, f, 0.5);
      bannerT = 0; storyT = 0;
      bleeders[bleeders.length - 1].n = f.T.boss ? 9 : 6;
      sfx.finisher(); lightFlash(f.x, f.y - 10, 80, '255,238,220', 1, 16);
    }
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
  const mine = def.team === 'player';
  clearActions(att);
  // a parry is not the end of the exchange, it hands over the initiative: the parried fighter reels for a moment
  // and the parrier gets a riposte. Parried yourself, you recover in time to parry the riposte back.
  if (att.team === 'player') { att.stun = 12; att.cool = 14; def.riposteE = 50; }
  else { att.stun = (att.T && att.T.reel) || 20; att.cool = 0; att.parried = true; def.riposteT = att.stun + 16 + 9 * rel('steady'); }
  att.vx = -att.facing * (mine ? 0.8 : 1.5);
  def.parry = 0; def.cool = 0;
  if (mine) def.vx = def.facing * 2.2;                             // your parry carries you forward into the riposte
  sparks(def.x + def.facing * 6, def.y - 13); lightFlash(def.x + def.facing * 6, def.y - 13, 64, '170,230,255', 1, 13); scar(def.x + def.facing * 9, def.y);
  burst(def.x + def.facing * 6, def.y - 13, 10, '#9fe8ff', 2, 20, 0);
  sfx.parry(); freeze = 9; shake = 3;
  if (mine && rel('bell')) shock(def.x, def.y, 70, 40 + 15 * (rel('bell') - 1), att, '#ffe39a');     // the shard rings: everyone near staggers
  return true;
}
function crossedS(a, b, sa, sb) {
  if (!a.armed || !b.armed || a.dead || b.dead) return false;
  if (a.roll > 0 || b.roll > 0 || a.down > 0 || b.down > 0 || a.stun > 0 || b.stun > 0 || a.over > 0 || b.over > 0) return false;
  if (bladeBusy(a) || bladeBusy(b)) return false;
  if (a.facing === b.facing) return false;
  if ((b.x - a.x) * a.facing <= 0) return false;
  if (Math.abs(stanceY(a, sa) - stanceY(b, sb)) > 2) return false;
  return Math.abs(b.x - a.x) <= reach(a) + reach(b) - 1;
}
function bladeHits(a, b) {
  if (!a.armed || a.roll > 0 || a.down > 0 || a.dead || a.stun > 0 || a.over > 0 || b.dead || bladeBusy(a)) return false;   // a heavy lunge that meets a blade disarms it (see combat); one that finds no blade runs them through
  const y = stanceY(a), hx = a.x + a.facing * 3, tx = a.x + a.facing * reach(a);
  const bb = bodyBox(b);
  if (y < bb.y || y > bb.y + bb.h) return false;
  const lo = Math.min(hx, tx), hi = Math.max(hx, tx);
  return hi >= bb.x && lo <= bb.x + bb.w;
}
function slashHits(a, b) {
  if (!a.armed || a.slash < 7 || a.slash > 12 || b.dead || a.dead) return false;
  const w = 17 + (a.T && a.T.slashReach || 0), x0 = a.facing > 0 ? a.x + 1 : a.x - 1 - w;
  return overlapR(x0, a.y - 23, w, 23, bodyBox(b));
}
function plungeHits(a, b) {
  if (!a.plunge || !a.armed || b.dead || a.dead) return false;
  return overlapR(a.x - 3, a.y - 3, 6, 9, bodyBox(b));
}
function plungeLand(f) {
  dust(f.x, f.y, 16); burst(f.x, f.y - 1, 10, '#ffffff', 2.2, 12, 0.05);
  shake = 5; sfx.thud(); f.stun = f.team === 'player' ? 5 : 10; scar(f.x, f.y, 1);
  const foes = f.team === 'player' ? enemies : [player], pm = f === player ? 1 + 0.55 * rel('meteor') : 1;
  if (pm > 1) { impact(f.x, f.y - 4, '#ffd9a0', 26 * pm); lightFlash(f.x, f.y - 6, 40 * pm, '255,220,170', 1, 12); shake = 8; }
  for (const t of foes) {
    if (t.dead || !t.onGround || Math.abs(t.x - f.x) > 26 * pm || Math.abs(t.y - f.y) > 6) continue;
    t.stun = Math.max(t.stun, Math.round(26 * pm)); t.vx = (t.x > f.x ? 1 : -1) * 2.4; clearActions(t);
  }
}
function clash(a, b, kb = 2.2) {
  if (Math.random() < 0.7) scar((a.x + b.x) / 2 + rnd(-5, 5), Math.max(a.y, b.y));
  a.lunge = 0; b.lunge = 0; a.heavyL = false; b.heavyL = false;
  a.vx = -a.facing * kb; b.vx = -b.facing * kb;
  a.cool = 8; b.cool = 8;
  sparks((a.x + b.x) / 2, stanceY(a));
  sfx.clang(); freeze = 3; shake = 2;
}
function unarmedHits(a, b) {
  if (a.dead || b.dead) return;
  if (a.punch === 6) {
    const px = a.x + a.facing * 7, py = a.y - 12, bb = bodyBox(b);
    if (pointIn(px, py, bb) || (b.down > 0 && Math.abs(b.x - px) < 7)) {
      if (b.down > 0 || b.stun > 0 || b.over > 0) kill(b, a.facing);
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
        if (p.heavyL && !e.heavyL) { e.heavyHits = (e.heavyHits || 0) + 1; disarm(e, p); }
        else if (e.heavyL && !p.heavyL) disarm(p, e);
        else { const onGuard = e.lunge > 0 && p.lunge <= 0; clash(p, e); const ig = rel('guard'); if (onGuard && ig) { e.stun = Math.max(e.stun, Math.round((16 + 8 * (ig - 1)) * (e.T.boss ? 0.5 : 1))); e.flash = 5; toast(e.x, e.y - e.h - 6, 'STAGGERED', '#bfe8ff'); } }
      } else {
        const d = Math.abs(e.x - p.x), min = reach(p) + reach(e) - 8;
        if (d < min) { p.x -= p.facing * 0.6; e.x -= e.facing * 0.6; }
      }
    } else {
      e.contactT = 0;
      let ph = bladeHits(p, e), eh = bladeHits(e, p);
      if (ph && tryParry(e, p)) ph = false;
      if (eh && tryParry(p, e)) eh = false;
      if (ph && eh) clash(p, e, 2.7);            // both blades land at once: steel rings, nobody dies
      else if (ph) kill(e, p.facing);
      else if (eh) kill(p, e.facing);
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
function thrust(f, rip, deep) {
  const isP = f.team === 'player';
  f.prep = 0; f.lunge = 12; f.heavyL = false; f.cool = isP ? Math.max(6, (f.offhand ? 12 : 16) - 2 * rel('wrist') - (rushT > 0 && rel('rush') ? 4 : 0)) : 24; f.atkId++;
  f.ripK = !!rip;
  if (isP && f === player && rel('echo')) projs.push({ x: f.x + f.facing * 10, y: stanceY(f), vx: f.facing * 6.5, team: 'player', life: Math.round(55 * (1 + 0.35 * (rel('echo') - 1)) / 6.5), echo: true });   // the ghost of the thrust flies on ahead
  // foes lunge deep from out of your reach. Your own quick thrust is a short step; a held one, or a riposte, is a full lunge
  f.vx += f.facing * (f.dashNext ? 5.5 : rip || deep ? 3 : isP || !f.onGround ? 1 : 4.2);
  f.dashNext = false; if (rip) { f.riposteT = 0; f.ripFx = 10; }
  sfx.swish();
}
function shadowStep(f) { const n = rel('shadow'); if (n && f === player) { f.invuln = Math.max(f.invuln, 8 + 4 * (n - 1)); burst(f.x, f.y - 10, 6, '#3a3550', 1, 14, 0); } }
function control(f, inp) {
  f.prevStance = f.stance;
  if (f.dead) { if (f.onGround) f.vx *= 0.85; return; }
  if (f.stun > 0) { f.stun--; f.vx *= 0.85; return; }
  if (f.down > 0) { f.down--; f.vx *= 0.85; return; }
  if (f.over > 0) { f.over--; f.vx *= 0.8; return; }                                   // overextended after a thrust that found nothing: wide open
  if (f.roll > 0) { f.roll--; f.vx = f.rollDir * 2.3; return; }
  if (f.hop > 0) { f.hop--; f.vx = -f.facing * (f.hop > 3 ? 2.6 : 1.1); return; }      // quick hop back, blade still up
  if (f.kick) { if (f.onGround) { f.kick = false; f.stun = 6; } return; }
  if (f.plunge) { if (f.onGround) { f.plunge = false; plungeLand(f); } return; }
  if (f.dash > 0) { f.dash--; f.vx = f.dashDir * 3.6; f.vy = Math.min(f.vy, 0.2); return; }
  if (f.windup > 0) {
    f.windup--; f.vx *= 0.75;
    if (f.windup === 0) { f.lunge = 16; f.heavyL = true; f.vx = f.facing * 2.6; sfx.heavy(); }
    return;
  }

  const move = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  // unarmed: hold S to duck (high thrusts pass over), hold W to raise up (low thrusts pass under)
  const prevPose = f.pose;
  f.pose = !f.armed && f.team === 'player' && f.onGround && !f.punch ? (inp.down ? 2 : inp.up ? 0 : 1) : 1;
  if (f.pose !== prevPose && f.pose !== 1) sfx.stance();
  if (f.lunge <= 0 && f.slash <= 0) faceUpdate(f, move);
  if (f.onGround) { f.airDashed = false; f.airJumps = 0; }
  const back = move && move !== f.facing;
  const busy = f.lunge > 0 || f.slash > 0 || f.parry > 0 || (f.prep > 0 && (f.team !== 'player' || f.prepT > 5));   // a quick thrust does not slow your step; a held one does
  const spd = RUN * (f.T ? f.T.speed : 1) * (f === player ? (1 + 0.07 * rel('boots')) * (rushT > 0 && rel('rush') ? 1.25 : 1) : 1) * (back ? 0.72 : 1) * (busy ? 0.4 : 1) * (f.pose === 2 ? 0.45 : f.pose === 0 ? 0.7 : 1) * (f.entering ? 2.3 : 1);
  if (move) f.vx += (move * spd - f.vx) * (f.onGround ? 0.3 : 0.12);
  else f.vx *= f.onGround ? 0.7 : 0.97;

  const isP = f.team === 'player';
  if (f.armed && f.parry <= 0 && (isP || (f.prep <= 0 && f.lunge <= 0))) {    // you may change line mid wind-up (a feint); foes commit to theirs
    if (inp.upP && f.stance > 0) { f.stance--; if (isP) sfx.stance(); }
    if (inp.downP && f.stance < 2) { f.stance++; if (isP) sfx.stance(); }
  }
  if (inp.jumpP && (f.onGround || (isP && !f.plunge && (f.airJumps || 0) < rel('wing')))) {
    if (!f.onGround) { f.airJumps = (f.airJumps || 0) + 1; bufJump = 0; burst(f.x, f.y, 8, '#cfd8e8', 1.4, 16, 0.02); }      // a beat of black wings
    f.vy = -JUMP * (isP ? 1 + 0.06 * rel('feather') : 1); f.onGround = false; if (isP) { sfx.jump(); dust(f.x, f.y, 4); }
  }
  // the player can roll or dash out of a move's recovery; enemies keep the old shared timer
  // back-step: SHIFT with no direction held (foes ask for it outright). A short hop out of reach that keeps your guard.
  if ((inp.hopP || (isP && inp.rollP && !move)) && f.onGround && f.rollCd <= 0) {
    clearActions(f); f.hop = 9; f.rollCd = isP ? Math.round(22 * 0.82 ** rel('spring')) : 40; f.did = true; sfx.hop(); dust(f.x, f.y, 3); if (isP) shadowStep(f); return;
  }
  if (inp.rollP && f.rollCd <= 0 && (isP || f.cool <= 0)) {
    if (f.onGround) { f.roll = 16; f.rollDir = move || f.facing; f.rollCd = isP ? Math.round(28 * 0.82 ** rel('spring')) : 28; if (!isP) f.cool = 12; clearActions(f); f.did = true; sfx.swish(); if (isP) shadowStep(f); return; }
    if (!f.airDashed) { f.dash = 10; f.dashDir = move || f.facing; f.airDashed = true; f.rollCd = isP ? Math.round(18 * 0.82 ** rel('spring')) : 18; if (!isP) f.cool = 8; f.lunge = 0; f.did = true; sfx.swish(); if (isP) shadowStep(f); return; }
  }
  // every thrust is drawn back before it flies. Yours is quick (hold J to keep it drawn: a feint); a foe's is long
  // enough to read, and shows the height it will come in at.
  if (f.prep > 0) {
    f.prepT++;
    if (!f.armed || inp.parryP || inp.slashP || inp.heavyP || inp.throwP) f.prep = 0;
    else if (f.prep > 1) f.prep--;
    else if (!(isP && inp.attackH && f.prepT < 50)) thrust(f, false, isP && f.prepT >= 8);
  }
  else if (inp.attackP && f.cool <= 0) {
    f.did = true;
    if (f.armed) {
      if (!f.onGround && inp.down) { f.plunge = true; f.vy = 5; f.vx *= 0.3; f.cool = 20; f.dashNext = false; sfx.swish(); }
      else if (!f.onGround) thrust(f, false);
      else if (isP && f.riposteT > 0) thrust(f, true);                                   // the riposte: no wind-up at all
      else {
        f.prep = isP ? 4 : Math.round((inp.quick ? Math.max(17, Math.round((f.T.tell || 20) * 0.85)) : (f.T.tell || 20)) * (1 + 0.1 * rel('eye')));
        f.prepT = 0; f.atkId++; f.lunge = 0;
        if (inp.aim !== undefined) f.stance = inp.aim;
        if (!isP) sfx.tell();
      }
    }
    else if (!f.onGround) { f.kick = true; f.vx = f.facing * 3; f.vy = Math.max(f.vy, 2.2); f.cool = 20; sfx.swish(); }
    else { f.punch = 10; f.cool = 16; sfx.swish(); }
  }
  if (inp.slashP && f.armed && f.cool <= 0) { if (f.onGround) scar(f.x + f.facing * rnd(9, 15), f.y); const st = !isP && f.T.slashTell ? Math.round(f.T.slashTell * (1 + 0.1 * rel('eye'))) : 0; f.slash = 18 + st; f.cool = (isP ? 22 : 30) + st; f.lunge = 0; f.did = true; if (st) sfx.tell(); else sfx.slash(); }   // some foes hold the blade high for a beat before the cut
  if (inp.heavyP && f.armed && f.onGround && f.cool <= 0) { const hm = f === player ? 0.85 ** rel('pommel') : 1, ht = f !== player && f.T && f.T.heavyTell ? Math.round(f.T.heavyTell * (1 + 0.1 * rel('eye'))) : 0; f.windup = Math.max(5, Math.round(14 * hm)) + ht; f.cool = Math.round(44 * hm) + ht; f.lunge = 0; f.vx = 0; f.did = true; sfx.charge(); }
  if (inp.parryP && f.armed && f.cool <= 0) { f.parry = f === player && rel('bell') ? 16 : 10; f.cool = isP ? 20 : 26; f.lunge = 0; f.did = true; }
  if (inp.throwP && f.armed && f.cool <= 0) {
    projs.push({ x: f.x + f.facing * 6, y: stanceY(f), vx: f.facing * 5.5, team: f.team, life: 80 });
    if (f.team !== 'player') foeThrowT = 150;
    if (f.offhand) { f.offhand = false; f.cool = 12; sfx.throw(); }
    else { f.armed = false; f.unarmedT = 0; f.cool = 16; clearActions(f); sfx.throw(); }
  }
}

// ---------- AI ----------
// a duel, not a brawl: only the foe nearest you presses the attack. The others hold off at a distance,
// keep their guard up, and step in when the one in front of you falls, loses his blade or is left behind.
function pickLead() {
  const live = enemies.filter(e => !e.dead && !e.T.dummy && !e.T.drill);
  if (live.length < 2) { leadFoe = live[0] || null; return; }
  const d = e => Math.abs(e.x - player.x) + Math.abs(e.y - player.y) * 0.5 + (e.armed ? 0 : 80) + (e.entering ? 40 : 0);
  let best = live[0]; for (const e of live) if (d(e) < d(best)) best = e;
  if (!leadFoe || !live.includes(leadFoe) || d(best) < d(leadFoe) - 18) leadFoe = best;
}
function waitingTurn(e) { return !!leadFoe && leadFoe !== e && !leadFoe.dead && enemies.includes(leadFoe); }
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
  let readParry = false;
  const p = player, T = e.T;
  if (e.dead || e.stun > 0 || e.down > 0 || e.roll > 0 || e.kick || e.windup > 0 || e.over > 0 || e.hop > 0) return inp;
  if (e.prep > 0) {
    // committed to the thrust. A feinter who sees you move to block early slips the blade to another line.
    if (T.feint && !e.feinted && e.prepT === Math.floor(T.tell * 0.5) && p.armed && !p.dead && p.stance === e.stance && !bladeBusy(p)) {
      e.feinted = true;
      if (Math.random() < T.feint) { e.stance = otherStance(p.stance); e.prep += 8; e.glint = 9; sfx.tell(); }
    }
    return inp;
  }
  if (T.dummy) {
    if (!p.dead) e.facing = p.x >= e.x ? 1 : -1;
    const want = [1, 0, 1, 2][Math.floor(e.anim / 300) % 4];
    if (e.armed && e.anim % 300 === 0) { if (want < e.stance) inp.upP = true; else if (want > e.stance) inp.downP = true; }
    return inp;
  }
  if (e.stanceCd > 0) e.stanceCd--;
  const dx = p.x - e.x, dist = Math.abs(dx), dir = dx >= 0 ? 1 : -1;
  const waiting = waitingTurn(e);
  let move = 0;
  const steer = s => {
    if (e.stanceCd > 0 || !e.armed) return;
    if (s < e.stance) { inp.upP = true; e.stanceCd = 5; }
    else if (s > e.stance) { inp.downP = true; e.stanceCd = 5; }
  };
  if (p.dead) { steer(1); return inp; }
  const canHop = () => e.onGround && e.rollCd <= 0 && groundBelow(e.x - e.facing * 22, e.y) && e.x - e.facing * 22 > zoneL() + 6 && e.x - e.facing * 22 < zoneR() - 6;

  // shades step through the dark to land behind you
  if (T.blink && !waiting && e.armed && e.onGround && ++e.blinkT > 170 && dist < 160 && p.onGround) {
    const nx = p.x - p.facing * 20;
    if (nx > zoneL() + 8 && nx < zoneR() - 8 && groundBelow(nx, p.y) && !solidAt(nx, p.y - 2) && !solidAt(nx, p.y - 12)) {
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
    // foes do not see a change of height at once: it takes them a beat (longer for slower types) to
    // register where your blade now is, and that beat is your opening to flick and thrust
    if (e.seenS === undefined) e.seenS = p.stance;
    if (p.stance !== e.seenS) { if ((e.seenT = (e.seenT || 0) + 1) >= T.reaction * 0.9 + 8) { e.seenS = p.stance; e.seenT = 0; } } else e.seenT = 0;
    const seen = e.seenS;
    if (--e.react <= 0) {
      e.react = Math.round(T.reaction * rnd(0.6, 1.4));
      if (!p.armed) { e.want = p.down > 0 ? 2 : (!p.onGround ? 0 : 1); e.plan = 'attack'; }
      else if (Math.random() < T.aggr * 0.6 || (T.throws && dist > 45)) { e.want = otherStance(seen); e.plan = 'attack'; }
      else { e.want = seen; e.plan = 'guard'; }
    }
    if (p.roll > 0 && dist < 45) e.want = 2;
    if (!p.onGround && p.y < e.y - 8 && dist < 50) e.want = 0;
    if (p.down > 0 && dist < 30) { e.want = 2; e.plan = 'attack'; }
    if (crossing && e.contactT > 8 && Math.random() < T.beat * 0.08) {
      e.want = e.stance === 1 ? (Math.random() < 0.5 ? 0 : 2) : 1; e.stanceCd = 0;
    }
    // reading a heavy lunge: a foe may see the wind-up and parry the lunge as it comes in, beating the blade
    // aside and leaving the attacker open. Each time the lunge works on them they get wiser.
    if (p.windup > 0 && p.armed) {
      if (!e.readW) {
        e.readW = true;
        const base = T.boss ? 0.5 : 0.25 + (30 - Math.min(30, T.reaction)) * 0.015;
        e.dodgeW = Math.random() < Math.min(0.92, base + 0.3 * (e.heavyHits || 0)); e.dodgeS = otherStance(p.stance); e.dodgeT = 0;
      }
      if (e.dodgeW && p.windup < 9) e.dodgeT = 34;
    } else e.readW = false;
    // hold the new height through the lunge and its recovery, and look to punish
    if (e.dodgeT > 0) { e.dodgeT--; if (dist < 60) e.plan = 'attack'; }
    readParry = e.dodgeW && e.armed && p.armed && ((p.windup > 0 && p.windup <= 3) || (p.heavyL && p.lunge > 0)) && dist < 48 && e.parry <= 0 && e.cool <= 0;
    steer(e.want);

    const pOpen = !p.armed || p.down > 0 || p.stun > 0;
    // fencing distance: a foe looking to attack stands just beyond your reach and lunges in from there
    let target = e.plan === 'attack' || T.drill ? (T.atk || 34) : T.range;
    if (!p.armed) target = 28;
    if (p.down > 0 || p.stun > 0) target = 22;
    if (waiting) target = Math.max(target, 74);      // waiting a turn: out of the fight, but close enough to step in
    if (dist > target + 3) move = dir; else if (dist < target - 3) move = -dir;
    if (!waiting && e.onGround && p.onGround && p.y - e.y > 8 && dist >= 12 && dist < 70) move = dir;   // on a ledge above you: come down to fight, not hover out of reach
    // standing on a gallery right over your head: drop through it to your floor
    if (!waiting && e.onGround && p.onGround && p.y - e.y > 8 && dist < 40 && Math.random() < 0.04 && !solidAt(e.x, e.y + 1) &&
        platforms.some(q => Math.abs(q.y - e.y) < 1 && e.x > q.x && e.x < q.x + q.w)) { e.y += 1; e.onGround = false; e.vy = 0.5; return inp; }

    // just parried: a trained blade tries to parry the riposte it knows is coming. Strike at once and it is too
    // late for them; hesitate and they catch it (or wait out their parry and then strike).
    if (e.parried) {
      e.parried = false;
      if (T.parry && dist < 44 && Math.random() < Math.min(0.9, T.parry * 2.2)) { inp.parryP = true; e.cool = 0; return inp; }
    }
    // answering your thrust: decided once, the moment your blade draws back. Parriers parry on sight (so a held
    // wind-up baits the parry out), the nimble hop away, the rest trust their guard.
    if (p.atkId !== e.sawAtk && (p.prep > 0 || p.lunge > 0) && !p.heavyL) {
      e.sawAtk = p.atkId; e.resp = null;
      if (dist < 46 && e.riposteE <= 0) {
        const r = Math.random(), pp = T.parry ? Math.min(0.85, T.parry * 2) : 0, hp = canHop() ? (T.hop || 0) * 0.4 : 0;
        e.resp = r < pp ? 'parry' : r < pp + hp ? 'hop' : null; e.respT = T.boss ? 3 : 4;
      }
    }
    if (p.prep > 0 && p.prepT === 34) e.sawAtk = -1;           // still holding it? they look again
    let respParry = false;
    if (e.resp) {
      if (!(p.prep > 0 || p.lunge > 0)) e.resp = null;
      else if (--e.respT <= 0) { if (e.resp === 'parry') respParry = e.cool <= 0; else if (canHop()) inp.hopP = true; e.resp = null; }
    }
    if (e.riposteE > 0) e.riposteE--;
    if (T.drill) e.drillT = (e.drillT || 0) + 1;

    const bracing = e.dodgeW && p.windup > 0;      // has read your heavy lunge and is waiting to parry it
    const inbound = projs.some(q => q.team !== 'player' && Math.abs(q.x - p.x) < 100);   // a knife already on its way: let it be answered first
    if (e.cool <= 0 && !respParry && !inp.hopP && !bracing && !waiting && !(inbound && !T.boss)) {
      const level = e.onGround && Math.abs(p.y - e.y) < 8;
      // where to strike: any line your blade is not on (an unarmed target can only duck, rise or get away)
      const aim = () => { if (!p.armed) return p.down > 0 ? 2 : Math.floor(Math.random() * 3); return otherStance(p.stance); };
      const go = quick => { inp.attackP = true; inp.aim = aim(); inp.quick = quick; e.feinted = false; };
      const lo = T.atk || pOpen ? 14 : 30;
      if (e.riposteE > 0 && level && dist < 42) { go(true); e.riposteE = 0; }                                   // riposte after their parry
      else if (T.parry && p.slash > 12 && dist < 38 && Math.random() < T.parry * 0.35) inp.parryP = true;
      else if (T.slash && (T.slashTell ? dist >= 19 && dist <= 25 : dist <= 16) && Math.random() < T.slash * 0.08) inp.slashP = true;   // a held cut is thrown from just outside your point
      else if (T.heavy && e.onGround && dist > 26 && dist < 36 && groundBelow(e.x + dir * 18, e.y) && groundBelow(e.x + dir * 38, e.y) && Math.random() < T.heavy * 0.03) inp.heavyP = true;   // never from a ledge: the lunge would carry them over it
      else if (T.drill) { if (level && dist >= 28 && dist <= 38 && e.drillT > 95) { go(false); e.drillT = 0; } }  // the sparring partner attacks on a steady beat
      else if (T.dash && level && dist > 36 && dist < 48 && e.plan === 'attack' && Math.random() < 0.05) { go(false); e.dashNext = true; }
      else if (level && e.plan === 'attack' && dist >= lo && dist <= 38 && Math.random() < T.aggr * 0.14) go(false);
      else if (level && dist <= 38 && dist >= 20 && p.armed && p.cool > 9 && p.lunge <= 0 && p.prep <= 0 && Math.random() < T.aggr * 0.3) go(false);   // you missed: they come for you
      else if (level && pOpen && dist <= 34 && Math.random() < T.aggr * 0.25) go(false);
      // crowded and exposed: hop back to fencing distance rather than stand in your reach
      else if (p.armed && !pOpen && dist < 25 && e.stance !== p.stance && canHop() && Math.random() < (T.hop || 0) * 0.1) inp.hopP = true;
    }
    if (respParry) { inp.parryP = true; inp.attackP = inp.slashP = inp.heavyP = false; }
    // a knifer waiting his turn may still throw, but only while the foe in front of you is not mid-attack, and never
    // with another blade already in the air: one thing to answer at a time
    const lull = !waiting || (!(leadFoe.prep > 0 || leadFoe.windup > 0 || leadFoe.lunge > 0 || leadFoe.slash > 0) && (leadFoe.cool > 8 || Math.abs(leadFoe.x - p.x) > 44 || leadFoe.stun > 0 || !leadFoe.armed));
    if (T.throws && lull && (T.boss || foeThrowT <= 0) && !projs.some(q => q.team !== 'player') && e.cool <= 0 && dist > 45 && dist < 150 && e.stance !== p.stance && Math.abs(p.y - e.y) < 6 && Math.random() < (waiting ? 0.05 : T.boss ? 0.03 : 0.012)) inp.throwP = true;   // waiting knifers seize the brief lulls
  }

  if (move && e.onGround) {
    const ahead = e.x + move * 9;
    if (!groundBelow(ahead, e.y)) {
      e.entering = false;        // never sprint at an edge: a running jump would carry them clean over the far side
      const across = (p.x - ahead) * move > 0 && dist < 240;     // anywhere on the same landing: they come to you
      if (across) { inp.jumpP = true; e.jumpDir = move; } else move = 0;
    }
    if (e.hitWall) inp.jumpP = true;
  }
  // over a pit there is no changing your mind: carry the jump through to the far side
  if (e.onGround) { if (!inp.jumpP) e.jumpDir = 0; }
  else if (e.jumpDir && !groundBelow(e.x, e.y)) move = e.jumpDir;
  else if (!e.jumpDir && Math.abs(e.vx) > 0.3 && groundBelow(e.x, e.y) && !groundBelow(e.x + Math.sign(e.vx) * 11, e.y)) move = -Math.sign(e.vx);   // hopping up a step beside a drop: do not sail off the far edge
  if (readParry) { inp.parryP = true; inp.attackP = inp.slashP = inp.heavyP = inp.throwP = false; }
  if (move > 0) inp.right = true; else if (move < 0) inp.left = true;
  return inp;
}

// ---------- update ----------
// wind: steady in the rain, gusty everywhere, strong on the title screen
function windNow() {
  const gust = Math.sin(tick * 0.021) * 0.5 + Math.sin(tick * 0.057 + 2) * 0.3;
  if (state === 'title') return -2.3 + gust * 1.1;
  const wth = state === 'play' ? ZONES[zi].weather : '';
  return (wth === 'rain' ? -1.0 : wth === 'snow' ? -0.45 : 0) + gust * 0.45;
}
// coats, capes and plumes hang on a loose spring: they trail a lunge, swing through when you stop, and lift in a fall
function updateCloth(f) {
  const tx = clamp(-f.vx * 1.5 + windNow(), -5, 5), ty = clamp(-f.vy * 1.1, -4.5, 2);
  f.cvx = ((f.cvx || 0) + (tx - (f.cx || 0)) * 0.14) * 0.8; f.cx = (f.cx || 0) + f.cvx;
  f.cvy = ((f.cvy || 0) + (ty - (f.cy || 0)) * 0.14) * 0.8; f.cy = (f.cy || 0) + f.cvy;
}
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
  if (offer) { stepPick(); return; }
  if (pressed.pause) { state = 'paused'; return; }
  if (pressed.restart) { if (practice) startPractice(); else newGame(); return; }
  if (practice && (pressed.foe1 || pressed.foe2)) {
    const want = pressed.foe1 ? 'dummy' : 'sparrer';
    if (want !== practiceFoe) { practiceFoe = want; for (const e of enemies) dust(e.x, e.y, 8); enemies = []; swords = []; projs = []; queue = [want]; spawnT = 15; }
  }
  tick++;
  for (const k of ['attack', 'slash', 'heavy', 'parry', 'roll']) if (pressed[k]) { bufAct = k; bufT = k === 'parry' ? 5 : 8; }
  if (pressed.jump) bufJump = 6;
  if (freeze > 0) { freeze--; return; }
  timeF++;

  for (const f of enemies) { f.ox = f.x; f.oy = f.y; } player.ox = player.x; player.oy = player.y;
  // wounds pump for a few beats after the blow
  for (const b of bleeders) {
    b.t++;
    if (b.n > 0 && b.t % 8 === 0) {
      b.n--; const k = 0.45 + b.n * 0.09, lying = b.f.onGround && b.t > 12;
      gush(b.f.x - (lying ? b.f.facing * 3 : 0), b.f.y - (lying ? 1.5 : 10), lying ? -b.f.facing * 0.5 : b.dir * 0.6, 6 + b.n, b.f, k, lying ? 0.8 : 1);
      if (fin) sfx.squelch();
    }
  }
  bleeders = bleeders.filter(b => b.n > 0 && b.f.y < H + 20);
  for (const f of [player, ...enemies]) {
    if (!(f.bloody > 0)) continue;
    f.bloody--;
    if (f.armed && !f.dead && f.bloody > 150 && f.bloody % 16 === 0)
      parts.push({ x: f.x + f.facing * (reach(f) - 1 - Math.random() * 5), y: stanceY(f) + 0.3, vx: 0, vy: 0.2, life: 60, grav: 0.12, color: '#8a0c14', stick: true, r: 0.28 });
  }

  updateProps(); updateBuild();
  // ---- the world reacts ----
  const everyone = [player, ...enemies];
  for (const f of everyone) if (!f.dead) updateCloth(f);
  for (const l of lights) l.t++;
  for (let i = lights.length - 1; i >= 0; i--) if (lights[i].t >= lights[i].life) lights.splice(i, 1);
  for (const t of torches) {
    if (t < camX - 40 || t > camX + W + 40) continue;
    const L = torchLean[t] || (torchLean[t] = { x: 0, v: 0 });
    for (const f of everyone) if (!f.dead && Math.abs(f.x - t) < 12 && Math.abs(f.vx) > 1.7 && f.y > 122) L.v += f.vx * 0.07;
    for (const pr of projs) if (Math.abs(pr.x - t) < 5 && pr.y < 142) L.v += Math.sign(pr.vx) * 0.5;
    L.v -= L.x * 0.09; L.v *= 0.9; L.x = clamp(L.x + L.v, -3.4, 3.4);
    if (Math.random() < 0.11) parts.push({ x: t + rnd(-0.9, 0.9), y: 119.5, vx: rnd(-0.14, 0.14) + L.x * 0.15, vy: rnd(-0.55, -0.2), life: rnd(55, 130), grav: -0.003, ember: true, seed: Math.random() * 9, cool: ZONES[Math.floor(t / ZW)].act === 4 });
  }
  for (const b of banners) {
    if (b.x < camX - 20 || b.x > camX + W + 20) continue;
    for (const f of everyone) if (!f.dead && Math.abs(f.x - b.x) < 9 && f.y - f.h < BANNER_TOP + b.len + 3) b.v += f.vx * 0.045;
    b.v -= b.sway * 0.06; b.v *= 0.93; b.sway = clamp(b.sway + b.v, -5, 5);
  }
  for (const f of everyone) {
    if (f.dead || !f.armed) continue;
    if (f.lunge > 0 && lungeExt(f) >= 4) cutBannersAt(f.x + f.facing * reach(f), stanceY(f), f.facing, 0, stanceY(f) - rnd(1, 5));
    if (f.slash >= 7 && f.slash <= 12) cutBannersAt(f.x + f.facing * 8, f.y - 16, f.facing, 5, f.y - rnd(20, 30));
    if (f.plunge) cutBannersAt(f.x, f.y - 6, f.facing, 0, f.y - 8);
  }
  for (const pr of projs) cutBannersAt(pr.x, pr.y, Math.sign(pr.vx), 0, pr.y - rnd(0, 3));
  for (const sc of scraps) {
    sc.t++; sc.life--;
    if (sc.landed) continue;
    sc.vy = Math.min(0.75, sc.vy + 0.03); sc.x += sc.vx + Math.sin(sc.t * 0.14) * 0.35; sc.y += sc.vy; sc.vx *= 0.985; sc.rot += sc.vr + Math.cos(sc.t * 0.14) * 0.02;
    if (solidAt(sc.x, sc.y + 1)) { sc.landed = true; sc.life = Math.min(sc.life, 240); }
  }
  scraps = scraps.filter(sc => sc.life > 0 && sc.y < H + 20);
  for (const c of crows) {
    c.t++;
    if (c.fly) { c.x += c.vx; c.y += c.vy; c.vy = Math.max(-2.3, c.vy - 0.025); }
    else if (everyone.some(f => !f.dead && Math.abs(f.x - c.x) < 24 && Math.abs(f.y - c.y) < 46)) scatterCrows(c.x, 0.5);
  }
  crows = crows.filter(c => c.y > -14 && Math.abs(c.x - (camX + W / 2)) < W);
  if (ZONES[zi].weather === 'rain') {
    for (let k = 0; k < 2; k++) { const x = camX + rnd(0, W), gy = groundYAt(x, 40); if (gy !== null) ripples.push({ x, y: gy, t: 0, s: rnd(0.7, 1.2) }); }
    for (const f of everyone) if (!f.dead && f.onGround && Math.abs(f.vx) > 0.8 && tick % 6 === 0) ripples.push({ x: f.x, y: f.y, t: 0, s: 1.7 });
  }
  for (const r of ripples) r.t++;
  ripples = ripples.filter(r => r.t < 22); if (ripples.length > 90) ripples.splice(0, ripples.length - 90);

  const pin = player.dead ? {} : {
    left: keys.left, right: keys.right, down: keys.down, up: keys.up, upP: pressed.up, downP: pressed.down,
    attackP: bufAct === 'attack', attackH: keys.attack, jumpP: bufJump > 0, throwP: pressed.throw, rollP: bufAct === 'roll',
    slashP: bufAct === 'slash', heavyP: bufAct === 'heavy', parryP: bufAct === 'parry',
  };
  player.did = false; const wasGround = player.onGround;
  if (pressed.grab && !player.dead && player.stun <= 0 && player.down <= 0 && player.roll <= 0 && !player.kick && !player.plunge) { const np = nearProp(player); if (np) hurlProp(np); }
  if (player.fling > 0) player.fling--;
  control(player, pin);
  if (player.did || player.dead) bufAct = null; else if (bufAct && --bufT <= 0) bufAct = null;
  if (bufJump > 0) { bufJump--; if (wasGround && !player.onGround) bufJump = 0; }
  pickLead(); if (foeThrowT > 0) foeThrowT--;
  for (const e of enemies) {
    if (e.entering) {      // the run-in ends near you, or as soon as there is a step or a gap ahead to judge
      const ed = player.x >= e.x ? 1 : -1;
      if (Math.abs(e.x - player.x) < 105 || e.anim > 200 || player.dead || !groundBelow(e.x + ed * 44, e.y) || solidAt(e.x + ed * 34, e.y - 3)) e.entering = false;
    }
    control(e, aiInput(e));
  }

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
    if (f.lunge > 0) {
      f.lunge--;
      if (f.lunge === 0) {      // a thrust that ran its course met no blade: a foe who missed is left overextended and open
        if (f.team === 'enemy' && !f.dead && !player.dead && f.onGround) { f.over = f.heavyL ? 28 : 22; scar(f.x + f.facing * 14, f.y); }
        f.heavyL = false;
      }
    }
    if (f.riposteT > 0) f.riposteT--;
    if (f.glint > 0) f.glint--;
    if (f.ripFx > 0) f.ripFx--;
    if (f.slash > 0) { f.slash--; if (f.slash === 18 && f.team !== 'player' && f.T.slashTell) sfx.slash(); }
    if (f.parry > 0) f.parry--;
    if (f.cool > 0) f.cool--;
    if (f.rollCd > 0) f.rollCd--;
    if (f.punch > 0) f.punch--;
    if (f.invuln > 0) f.invuln--;
    if (f.flash > 0) f.flash--;
    if (f.dead) f.deadT++;
    f.anim++;
    if (!f.dead && f.y > H + 20) { // fell into a pit
      f.dead = true; f.armed = false; f.fell = true; clearActions(f);
      if (f === player) { deaths++; respawnT = 45; sfx.death(); } else kills++;
    }
    if (f.T && !f.armed && !f.dead) {
      if (++f.unarmedT > f.T.rearm) { f.armed = true; f.unarmedT = 0; burst(f.x, f.y - 10, 10, f.T.accent, 1.2, 20, 0); }
    }
    if (f === player && !f.armed && !f.dead && rel('ghost') && ++f.unarmedT > Math.max(45, 150 - 35 * (rel('ghost') - 1))) {
      f.armed = true; f.unarmedT = 0; f.stance = 1; f.prevStance = 1; burst(f.x + f.facing * 6, f.y - 11, 14, '#bfe8ff', 1.4, 24, 0); toast(f.x, f.y - 24, 'GHOST BLADE', '#bfe8ff'); sfx.pickup();
    }
  }
  updateScarf(player);

  // loose swords
  for (const s of swords) {
    s.age++;
    if (s.home) {      // lodestone: the blade flies back to the hand that threw it
      if (player.dead || (player.armed && player.offhand) || !rel('lodestone')) s.home = false;
      else {
        const dx = player.x - s.x, dy = player.y - 11 - s.y, L = Math.hypot(dx, dy) || 1, v = Math.min(L, 4.4 * (1 + 0.2 * (rel('lodestone') - 1)));
        if (s.age > 8) { s.x += dx / L * v; s.y += dy / L * v; s.vx = 0; s.vy = 0; s.onGround = false; }
        if (L < 7 && s.age > 8) { s.taken = true; if (player.armed) player.offhand = true; else { player.armed = true; player.stance = 1; player.prevStance = 1; player.unarmedT = 0; } sfx.pickup(); }
        if (s.age > 8) continue;
      }
    }
    if (!s.onGround) s.vx *= 0.99; else s.vx *= 0.8;
    const wasAir = !s.onGround, vy0 = s.vy;
    physics(s, 8, 2);
    if (wasAir && s.onGround && s.stuck === undefined) { s.stuck = (s.vx >= 0 ? 1 : -1) * rnd(0.1, 0.5); s.vx = 0; s.quiver = 14; if (vy0 > 1.5) { dust(s.x, s.y, 3); scar(s.x, s.y); } }
    if (s.quiver > 0) s.quiver--;
  }
  swords = swords.filter(s => s.y < H + 30);

  // thrown swords
  for (const p of projs) {
    p.x += p.vx; p.life--;
    if (solidAt(p.x, p.y) || p.x < zoneL() - 4 || p.x > zoneR() + 4 || p.life <= 0) {
      if (!p.echo) swords.push({ x: p.x - Math.sign(p.vx) * 4, y: p.y, vx: -p.vx * 0.15, vy: -1.5, onGround: false, age: 0, home: p.team === 'player' && !!rel('lodestone') });
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
      if (!p.echo) swords.push({ x: p.x, y: p.y, vx: -p.vx * 0.25, vy: -2.5, onGround: false, age: 0, home: p.team === 'player' && !!rel('lodestone') });
      p.done = true;
    }
  }
  projs = projs.filter(p => !p.done);

  // pickups
  for (const f of all) {
    if (f.dead || f.stun > 0 || f.down > 0 || f.kick) continue;
    if (f.armed && (f !== player || f.offhand)) continue;
    for (const s of swords) {
      if (s.age < 18 || s.taken || s.home) continue;
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
      if (alive < lastAlive && alive > 0 && !practice) spawnT = Math.max(spawnT, 50);   // one falls while another still stands: a breath before his replacement (an empty landing refills at once)
      lastAlive = alive;
      if (queue.length && alive < zoneMax() && --spawnT <= 0) {
        const mid = zi * ZW + ZW / 2, far = player.x < mid ? (zi + 1) * ZW - 26 : zi * ZW + 26, NT = TYPES[queue[0]];
        // foes walk in from the far end of the zone (the practice dummy simply stands at its mark)
        let x = far;
        if (NT.dummy || NT.drill) x = zi * ZW + (player.x < zi * ZW + 150 ? 205 : 95);
        while (!solidAt(x, GROUND + 1) && x > zi * ZW + 8 && x < (zi + 1) * ZW - 8) x += far > player.x ? -4 : 4;
        const e = makeFighter(x, GROUND, 'enemy', queue.shift()); e.onGround = true; dust(x, GROUND, 10); scaleFoe(e);
        e.entering = !NT.throws && !NT.dummy && !NT.drill;   // run in from the far end, then slow to a fighting pace
        e.facing = player.x > x ? 1 : -1;
        enemies.push(e);
        if (e.T.line) { speech = { who: e.T.name, text: e.T.line, t: 300, col: e.T.accent }; sfx.boss(); }
        spawnT = 30; lastAlive++;
      }
      if (!queue.length && alive === 0 && enemies.every(e => e.dead)) { cleared = true; sfx.clear(); if (buildsOn && !practice && zi > lastPickZone && zi < ZONES.length - 1) pickAt = 40; }
    } else if (zi < ZONES.length - 1 && player.x > (zi + 1) * ZW + 40) {
      if (pickAt > 0) openPick(); else startZone(zi + 1);      // never leave a landing without choosing its relic
    }
    if (pickAt > 0 && slowmo <= 0 && !offer && --pickAt === 0) openPick();
    if (zi === ZONES.length - 1 && Math.abs(player.x - BELL_X) < 12) {
      state = 'win'; winT = 0; bellSwing = 1; flash = 1; sfx.bell();
      burst(BELL_X, 112, 60, '#ffe39a', 3, 80, 0.03);
    }
  } else if (--respawnT <= 0) respawn();

  skyPos += (skyTarget() - skyPos) * (zi === ZONES.length - 1 ? 0.03 : 0.012);
  // camera
  let tx = zi * ZW;
  if (cleared && zi < ZONES.length - 1) tx = clamp(player.x - W * 0.4, zi * ZW, (zi + 1) * ZW);
  camX += (tx - camX) * 0.1;

  // storm
  if (ZONES[zi].weather === 'rain' && lightning <= 0 && Math.random() < 0.003) { lightning = 10; sfx.thunder(); scatterCrows(camX + W / 2, 400); }
  if (lightning > 0) lightning--;

  updateParticles();
  if (shake > 0) shake *= 0.85;
  if (shake < 0.3) shake = 0;
  if (bannerT > 0) bannerT--;
  if (storyT > 0) storyT--;
  if (speech && --speech.t <= 0) speech = null;
}

let partsDone = false;   // set when slow motion already advanced the particles this frame
function updateParticles(dt = 1) {
  if (partsDone && dt === 1) return;
  for (const p of parts) {
    p.life -= dt;
    if (p.landed) continue;
    if (p.ember) {      // embers ride the wind and are dragged along by anyone rushing past
      p.vx += (windNow() * 0.03 + Math.sin(tick * 0.07 + p.seed) * 0.012) * dt; p.vx *= 0.985;
      if (state === 'play' && player) for (const f of [player, ...enemies]) if (!f.dead && Math.abs(f.vx) > 1.5 && Math.abs(f.x - p.x) < 13 && Math.abs(f.y - 12 - p.y) < 26) { p.vx += f.vx * 0.06 * dt; p.vy += (Math.random() - 0.65) * 0.14 * dt; }
    }
    p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    if (p.spark && p.vy > 0 && solidAt(p.x, p.y)) { p.y -= p.vy * dt; p.vy *= -0.42; p.vx *= 0.72; if (++p.b > 3 || Math.abs(p.vy) < 0.25) { p.vy = 0; p.grav = 0; p.vx *= 0.5; p.life = Math.min(p.life, 26); } }
    if (p.stick && solidAt(p.x, p.y)) { p.landed = true; p.y = Math.floor(p.y); p.wet = !p.debris && state === 'play' && ZONES[zi].weather === 'rain'; p.life = p.wet ? (p.r ? 760 : 420) : (p.r ? 5400 : 2700); p.life0 = p.life; }
  }
  parts = parts.filter(p => p.life > 0);
  if (parts.length > 1200) parts.splice(0, parts.length - 1200);
  const wth = state === 'title' ? 'rain' : ZONES[zi].weather;
  for (const w of weatherP) {
    if (wth === 'rain') { w.x += -1.2 * w.s * dt; w.y += 5 * w.s * dt; }
    else if (wth === 'ash') { w.x += Math.sin(tick * 0.02 + w.p) * 0.3 * dt; w.y += 0.35 * w.s * dt; }
    else if (wth === 'petals') { w.x += (0.5 * w.s + Math.sin(tick * 0.03 + w.p) * 0.4) * dt; w.y += 0.3 * w.s * dt; }
    else if (wth === 'snow') { w.x += (-0.5 * w.s + Math.sin(tick * 0.025 + w.p) * 0.3) * dt; w.y += 0.6 * w.s * dt; }
    else { w.x += (-0.15 * w.s + Math.sin(tick * 0.02 + w.p) * 0.1) * dt; w.y -= 0.25 * w.s * dt; }
    if (w.y > H + 4) { w.y = -4; w.x = rnd(0, W + 60); }
    if (w.y < -4) { w.y = H + 4; w.x = rnd(0, W); }
    if (w.x < -6) w.x += W + 12;
    if (w.x > W + 6) w.x -= W + 12;
  }
}

function updateCam() {
  let tz = 1, fx = W / 2, fy = H / 2, k = 0.05;
  if (state === 'title') { tz = 2; fx = W * 0.33 + 32; fy = 124; k = 0.2; }
  if (state === 'play' && player) {
    if (fin) { tz = fin.boss ? 2.15 : 1.95; fx = fin.f.x - fin.dir * 5 - camX; fy = Math.min(fin.f.y, GROUND + 4) - 9; k = 0.13; }
    else if (player.dead) { tz = 1.35; fx = player.x - camX; fy = Math.min(player.y, GROUND + 4) - 10; k = 0.06; }
    else {
      let lo = player.x, hi = player.x, top = player.y, n = 0;
      for (const e of enemies) {
        if (e.dead || e.y > H) continue;          // every living foe stays in frame, so nothing strikes from off-screen
        lo = Math.min(lo, e.x); hi = Math.max(hi, e.x); top = Math.min(top, e.y); n++;
      }
      for (const pr of projs) if (pr.team !== 'player') { lo = Math.min(lo, pr.x); hi = Math.max(hi, pr.x); }
      if (n) { tz = clamp(W / (hi - lo + 150), 1, 1.6); fx = (lo + hi) / 2 - camX; fy = (Math.min(player.y, GROUND) + top) / 2 - 12; }
    }
  }
  cam.z += (tz - cam.z) * k;
  cam.cx += (fx - cam.cx) * k * 1.6; cam.cy += (fy - cam.cy) * k * 1.6;
  if (Math.abs(cam.z - 1) < 0.002 && tz === 1) cam.z = 1;
}
// the part of the (unzoomed) screen the camera currently shows
function camView() {
  const vw = W / cam.z, vh = H / cam.z;
  return { x: clamp(cam.cx - vw / 2, 0, W - vw), y: clamp(cam.cy - vh * 0.62, 0, H - vh), z: cam.z };
}

function step() {
  updateCam();
  partsDone = false;
  if (state === 'play' && slowmo > 0) {
    // slow motion: the duel advances a fraction of a tick per frame; blood and weather move smoothly
    slowmo--; if (fin) fin.t++;
    const rate = slowmo > 24 ? FIN_RATE : FIN_RATE + (1 - FIN_RATE) * (1 - slowmo / 24);
    if (freeze <= 0) updateParticles(rate);
    partsDone = true;
    if (slowmo === 0) { fin = null; slowAcc = 0; }
    else { slowAcc += rate; if (slowAcc < 1) return; slowAcc -= 1; }
  }
  if (pressed.mute) muted = !muted;
  if (state === 'title') {
    tick++; camX = 30 + Math.sin(tick * 0.004) * 5; updateParticles();
    if (lightning <= 0 && Math.random() < 0.0035) { lightning = 10; sfx.thunder(); } else if (lightning > 0) lightning--;
    if (pressed.practice) startPractice();
    else if (pressed.start || pressed.attack || pressed.jump) showPages(INTRO, () => newGame());
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
    if (pressed.restart) { if (practice) startPractice(); else newGame(); }
    if (pressed.practice) { if (practice) { practice = false; state = 'title'; } else startPractice(); }
    if (pressed.hat) { delete wardrobe.head; try { localStorage.setItem('riposte.wardrobe', JSON.stringify(wardrobe)); } catch (e) {} }
  } else if (state === 'win') {
    tick++; winT++; updateParticles(); skyPos = ACTS.length - 1; dawnExtra = Math.min(1, winT / 420);
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
const paleMoonTex = makeTex(128, 128, (i, j) => {
  const dx = (i - 64) / 62, dy = (j - 64) / 62, r2 = dx * dx + dy * dy;
  if (r2 > 1) return [0, 0, 0, 0];
  const n = fbm2(i / 18, j / 18, 5, 8), cr = smooth(0.56, 0.63, fbm2(i / 9 + 3, j / 9, 3, 15));
  const l = (0.8 + 0.3 * (n - 0.5) * 2 - 0.2 * cr) * (1 - 0.4 * smooth(0.3, 1, r2) * (dx > 0 ? 1 : 0.3));
  return [222 * l, 234 * l, 255 * l, 255 * smooth(1, 0.94, r2)];
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
  { sky: ['#050305', '#120806', '#2a1208', '#55220c', '#8a3a10'], stars: false, sun: null, rays: false,
    far: '#3a1c12', mid: '#26120c', near: '#170a07', haze: '200,90,30',
    cloudLit: [190, 96, 40], cloudDark: [20, 10, 8], fogc: [220, 110, 50],
    ground: '#7a5a4a', rim: '#ffb060', banner: '#5a2408', fg: '#080403', grade: 'rgba(255,110,20,0.22)', forge: true },
  { sky: ['#02040c', '#07102a', '#10224a', '#1e3a66', '#35557c'], stars: true, moon: { x: 96, y: 46, r: 14, pale: true }, rays: false,
    far: '#42587c', mid: '#2a3c5a', near: '#182438', haze: '120,160,220',
    cloudLit: [190, 210, 240], cloudDark: [30, 44, 70], fogc: [200, 220, 250],
    ground: '#93a4b8', rim: '#e8f6ff', banner: '#2a4a70', fg: '#060a12', grade: 'rgba(110,160,255,0.2)', wet: true, snow: true },
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

// ---------- a sky that travels with the climb ----------
// Each zone sits somewhere on the journey 0 sunset -> 1 storm -> 2 foundry -> 3 frozen night -> 4 blood moon -> 5 dawn; palettes are blended between acts.
const SKY_POS = [0, 0.1, 0.22, 0.34, 0.46, 1, 1.07, 1.16, 1.26, 1.38, 2, 2.08, 2.2, 2.36, 3, 3.08, 3.2, 3.4, 4, 4.05, 4.11, 4.18, 4.3, 5];
let skyPos = 0, dawnExtra = 0, skyKey = '', skyCache = null;
const lerp = (a, b, t) => a + (b - a) * t;
function mixHex(a, b, t) { const A = hexRgb(a), B = hexRgb(b); return '#' + [0, 1, 2].map(i => Math.round(lerp(A[i], B[i], t)).toString(16).padStart(2, '0')).join(''); }
function mixTriple(a, b, t) { const A = a.split(',').map(Number), B = b.split(',').map(Number); return [0, 1, 2].map(i => Math.round(lerp(A[i], B[i], t))).join(','); }
function mixRgba(a, b, t) {
  const A = a.match(/[\d.]+/g).map(Number), B = b.match(/[\d.]+/g).map(Number);
  return `rgba(${Math.round(lerp(A[0], B[0], t))},${Math.round(lerp(A[1], B[1], t))},${Math.round(lerp(A[2], B[2], t))},${lerp(A[3], B[3], t).toFixed(3)})`;
}
function blendAct(pos, base, rise = 0, A0, B0) {     // A0/B0: blend a chosen pair of acts instead of two neighbours
  const i = clamp(Math.floor(pos), 0, ACTS.length - 2), t = A0 ? pos : clamp(pos - i, 0, 1), A = A0 || ACTS[i], B = B0 || ACTS[i + 1];
  const o = { wet: base.wet, grass: base.grass, snow: base.snow, forge: base.forge };
  o.sky = A.sky.map((c, k) => mixHex(c, B.sky[k], t));
  for (const k of ['far', 'mid', 'near', 'ground', 'rim', 'banner', 'fg']) o[k] = mixHex(A[k], B[k], t);
  o.haze = mixTriple(A.haze, B.haze, t);
  o.grade = mixRgba(A.grade, B.grade, t);
  o.starA = lerp(A.stars ? 1 : 0, B.stars ? 1 : 0, t);
  o.raysA = lerp(A.rays ? 1 : 0, B.rays ? 1 : 0, t);
  o.layers = t < 0.004 ? [[A, 1]] : t > 0.996 ? [[B, 1]] : [[A, 1 - t], [B, t]];       // cloud and fog cross-fade
  // suns set and rise through the horizon as they fade; the moon does the same
  o.suns = []; o.moons = [];
  if (A.sun && t < 0.996) o.suns.push(Object.assign({}, A.sun, { a: 1 - t, y: A.sun.y + t * 36 }));
  if (B.sun && t > 0.004) o.suns.push(Object.assign({}, B.sun, { a: t, y: B.sun.y + (1 - t) * 36 - rise * 26 }));
  const both = A.moon && B.moon;                      // one moon to the next: it stays where it hangs and turns to blood
  if (A.moon && t < 0.996) o.moons.push(Object.assign({}, A.moon, { a: both ? 1 : 1 - t, y: A.moon.y + (both ? 0 : t * 30) }));
  if (B.moon && t > 0.004) o.moons.push(Object.assign({}, B.moon, { a: t, y: B.moon.y + (both ? 0 : (1 - t) * 30) }));
  o.sun = o.suns.find(q => q.a > 0.5) || null; o.moon = o.moons.find(q => q.a > 0.5) || null;
  return o;
}
function skyTarget() {
  if (zi < ZONES.length - 1) return SKY_POS[zi];
  // the last landing: night gives way to dawn as you walk to the bell
  const z0 = zi * ZW + 20, rise = player ? clamp((player.x - z0) / (BELL_X - z0), 0, 1) : 1;
  return ACTS.length - 1.5 + 0.5 * rise;
}

// ---------- transforms & primitives ----------
let shX = 0, shY = 0;
function curAct() {
  if (state === 'title') return skyCache && skyKey === 'title' ? skyCache : (skyKey = 'title', skyCache = blendAct(0.07, ACTS[1], 0, ACTS[1], ACTS[4]));
  const key = zi + '|' + skyPos.toFixed(3) + '|' + dawnExtra.toFixed(2);
  if (key !== skyKey) { skyKey = key; skyCache = blendAct(skyPos, ACTS[ZONES[zi].act], dawnExtra); }
  return skyCache;
}
const ZONE_ACT = [];
function actAt(x) {
  if (state === 'title') return curAct();
  const i = clamp(Math.floor(x / ZW), 0, ZONES.length - 1);
  return ZONE_ACT[i] || (ZONE_ACT[i] = blendAct(SKY_POS[i], ACTS[ZONES[i].act]));
}
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
  if (A.starA > 0.01) {
    for (let i = 0; i < 140; i++) {
      const x = ((hash(i) * W * 2 - camX * 0.01) % W + W) % W, y = hash(i + 3) * 100;
      const tw = 0.5 + 0.5 * Math.sin(tick * 0.05 + i * 1.7), r = hash(i + 11) > 0.93 ? 0.34 : 0.18;
      ctx.fillStyle = `rgba(255,236,230,${((0.12 + 0.7 * tw * hash(i + 7)) * A.starA).toFixed(3)})`;
      ctx.fillRect(x, y, r, r);
    }
  }
  for (const sun of A.suns) {
    const sx = sun.x - camX * 0.02, sy = sun.y;
    ctx.globalCompositeOperation = 'lighter';
    glowAt(sx, sy, 120, sun.glow, 0.5 * sun.a);
    if (A.raysA > 0.01) {
      for (let i = 0; i < 11; i++) {
        const a = -Math.PI / 2 + (i - 5) * 0.3 + Math.sin(tick * 0.003 + i * 2.1) * 0.05, sp = 0.035 + hash(i) * 0.05;
        ctx.fillStyle = `rgba(${sun.glow},${((0.02 + hash(i + 4) * 0.03) * sun.a * A.raysA).toFixed(3)})`;
        ctx.beginPath(); ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a - sp) * 260, sy + Math.sin(a - sp) * 260);
        ctx.lineTo(sx + Math.cos(a + sp) * 260, sy + Math.sin(a + sp) * 260); ctx.closePath(); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sun.r);
    sg.addColorStop(0, sun.core); sg.addColorStop(0.7, sun.core); sg.addColorStop(1, `rgba(${sun.glow},0.6)`);
    ctx.globalAlpha = Math.min(1, sun.a * 1.4); ctx.fillStyle = sg; circle(sx, sy, sun.r); ctx.globalAlpha = 1;
  }
  for (const moon of A.moons) {
    const mx = moon.x - camX * 0.02, my = moon.y, r = moon.r;
    ctx.globalCompositeOperation = 'lighter'; glowAt(mx, my, r * 5, moon.pale ? '120,170,255' : '200,40,40', (moon.pale ? 0.3 * (1 - (A.moons.length > 1 ? A.moons[1].a : 0)) : 0.35) * moon.a); ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = moon.a; ctx.drawImage(moon.pale ? paleMoonTex : moonTex, mx - r, my - r, r * 2, r * 2); ctx.globalAlpha = 1;
  }
  // two cloud decks
  const cw = W * 1.6;
  for (const [y, h, sp, par, a] of [[2, 56, 0.02, 0.03, 0.95], [34, 40, 0.045, 0.06, 0.6]]) {
    const off = ((tick * sp + camX * par) % cw + cw) % cw;
    for (const [L, la] of A.layers) {
      ctx.globalAlpha = a * la;
      ctx.drawImage(L.clouds, -off, y, cw, h); ctx.drawImage(L.clouds, cw - off, y, cw, h);
    }
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
// the bell tower, close: it fills the right of the title screen and climbs out of frame
function drawTitleTower(A) {
  setUnits();
  const x = 205 - camX * 0.3, w = 25, top = 30;
  const body = mixHex(A.near, '#000000', 0.45), dark = mixHex(A.near, '#000000', 0.75);
  let g = ctx.createLinearGradient(x - w, 0, x + w, 0);
  g.addColorStop(0, mixHex(A.mid, '#000000', 0.25)); g.addColorStop(0.22, body); g.addColorStop(1, dark);
  ctx.fillStyle = g; ctx.fillRect(x - w, top, w * 2, GROUND - top + 2);
  ctx.fillStyle = dark;
  ctx.fillRect(x - w - 2.5, 108, w * 2 + 5, 2.6); ctx.fillRect(x - w - 2.5, 66, w * 2 + 5, 3.2);       // string courses
  for (let i = 0; i < 9; i++) ctx.fillRect(x - w + hash(i + 60) * 3, 112 + i * 4.6, w * 2 - hash(i + 61) * 6, 0.22);
  ctx.beginPath(); ctx.moveTo(x - w - 2.5, 150); ctx.lineTo(x - w + 3, 112); ctx.lineTo(x - w + 3, 150); ctx.closePath(); ctx.fill();   // buttress
  // the belfry: a tall arch open to the storm, lamplight inside, and the bell
  const ax = x, ay = 104, ah = 30, aw = 11;
  const arch = () => { ctx.beginPath(); ctx.moveTo(ax - aw, ay); ctx.lineTo(ax - aw, ay - ah + aw); ctx.quadraticCurveTo(ax - aw, ay - ah - 3, ax, ay - ah - 6); ctx.quadraticCurveTo(ax + aw, ay - ah - 3, ax + aw, ay - ah + aw); ctx.lineTo(ax + aw, ay); ctx.closePath(); };
  arch(); ctx.fillStyle = mixHex(A.sky[2], '#000000', 0.35); ctx.fill();
  ctx.save(); arch(); ctx.clip();
  ctx.globalCompositeOperation = 'lighter';
  glowAt(ax - 3, ay - 6, 22, '255,176,96', 0.42 + 0.06 * Math.sin(tick * 0.07)); glowAt(ax - 5, ay - 3, 8, '255,214,150', 0.5);
  ctx.globalCompositeOperation = 'source-over';
  const sw = Math.sin(tick * 0.018) * 0.1 + (lightning > 0 ? 0.05 : 0);
  ctx.translate(ax, ay - ah - 1); ctx.rotate(sw);
  ctx.fillStyle = '#07060a'; ctx.fillRect(-0.5, 0, 1, 6);
  ctx.beginPath(); ctx.moveTo(-2.2, 6); ctx.quadraticCurveTo(-3.2, 9, -4.4, 16.5); ctx.quadraticCurveTo(-5.4, 19, -6.6, 20.2); ctx.lineTo(6.6, 20.2); ctx.quadraticCurveTo(5.4, 19, 4.4, 16.5); ctx.quadraticCurveTo(3.2, 9, 2.2, 6); ctx.closePath(); ctx.fill();
  circle(-sw * 14, 21.6, 1.25);                                                                   // clapper
  ctx.strokeStyle = 'rgba(255,190,110,0.5)'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.moveTo(-2.4, 7); ctx.quadraticCurveTo(-3.3, 9.5, -4.5, 16.5); ctx.stroke();   // lamplight on the bell's lip
  ctx.restore();
  ctx.strokeStyle = dark; ctx.lineWidth = 1.6; arch(); ctx.stroke();
  for (const [wx, wy] of [[-13, 124], [9, 131], [-6, 139]]) {                                     // slit windows, one lit
    ctx.fillStyle = '#040308'; ctx.fillRect(x + wx, wy, 1.5, 5.5);
    if (wy === 131) { ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,180,100,0.55)'; ctx.fillRect(x + wx + 0.3, wy + 0.6, 0.9, 4.3); glowAt(x + wx + 0.7, wy + 2.7, 5, '255,170,90', 0.3); ctx.globalCompositeOperation = 'source-over'; }
  }
  if (silh) {     // lightning: the tower is a black slab, the belfry a bright hole with the bell hanging in it
    ctx.fillStyle = 'rgba(2,3,8,0.92)'; ctx.fillRect(x - w - 2.5, top, w * 2 + 5, GROUND - top + 2);
    arch(); ctx.fillStyle = 'rgba(214,227,255,0.85)'; ctx.fill();
    ctx.save(); ctx.translate(ax, ay - ah - 1); ctx.rotate(sw); ctx.fillStyle = '#04050a'; ctx.fillRect(-0.5, 0, 1, 6);
    ctx.beginPath(); ctx.moveTo(-2.2, 6); ctx.quadraticCurveTo(-3.2, 9, -4.4, 16.5); ctx.quadraticCurveTo(-5.4, 19, -6.6, 20.2); ctx.lineTo(6.6, 20.2); ctx.quadraticCurveTo(5.4, 19, 4.4, 16.5); ctx.quadraticCurveTo(3.2, 9, 2.2, 6); ctx.closePath(); ctx.fill(); circle(-sw * 14, 21.6, 1.25); ctx.restore();
    return;
  }
  ctx.fillStyle = rgba(A.rim, 0.22); ctx.fillRect(x - w, top, 0.5, GROUND - top);                  // storm light down the windward edge
  g = ctx.createLinearGradient(0, 118, 0, GROUND + 2);                                              // its foot is lost in mist
  g.addColorStop(0, `rgba(${A.haze},0)`); g.addColorStop(1, `rgba(${A.haze},0.5)`);
  ctx.fillStyle = g; ctx.fillRect(x - w - 4, 118, w * 2 + 8, GROUND - 116);
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
// shafts of sun or moonlight slanting through the broken arches, with dust drifting in them
function drawShafts(A) {
  const src = [];
  for (const q of A.suns) src.push({ x: q.x, a: q.a * A.raysA, c: q.glow });
  for (const q of A.moons) src.push({ x: q.x, a: q.a * (q.pale ? 0.6 * (1 - (A.moons.length > 1 ? A.moons[1].a : 0)) : 0.75), c: q.pale ? '190,215,255' : '255,150,140' });
  if (!src.length) return;
  const p = 0.45, sp = 70; setLayer(p);
  const k0 = Math.floor((camX * p) / sp) - 1;
  const px = k => k * sp + hash(k) * 20, ptop = k => 62 + hash(k + 1) * 26, pw = k => 7 + hash(k + 2) * 3;
  ctx.globalCompositeOperation = 'lighter';
  for (const L of src) {
    if (L.a < 0.02) continue;
    for (let k = k0; k < k0 + 7; k++) {
      if (hash(k + 3) <= 0.35) continue;                                  // only where an arch stands
      const xl = px(k) + pw(k) + 1.5, xr = px(k + 1) - 1.5, at = Math.min(ptop(k), ptop(k + 1)) - 2, mx = (xl + xr) / 2;
      const lean = clamp((mx - camX * p - L.x) / 150, -0.75, 0.75) || 0.2, fall = GROUND - at, sh = lean * fall * 0.85, wide = (xr - xl) * 0.22;
      const a = (0.15 + 0.04 * Math.sin(tick * 0.013 + k * 2.1)) * L.a;
      const g = ctx.createLinearGradient(0, at, 0, GROUND);
      g.addColorStop(0, `rgba(${L.c},0)`); g.addColorStop(0.16, `rgba(${L.c},${a.toFixed(3)})`); g.addColorStop(0.75, `rgba(${L.c},${(a * 0.45).toFixed(3)})`); g.addColorStop(1, `rgba(${L.c},0)`);
      ctx.fillStyle = g;
      for (const [i0, i1] of [[0.08, 0.5], [0.42, 0.95]]) {            // two overlapping beams read as one uneven shaft
        const a0 = xl + (xr - xl) * i0, a1 = xl + (xr - xl) * i1;
        ctx.beginPath(); ctx.moveTo(a0, at); ctx.lineTo(a1, at); ctx.lineTo(a1 + sh + wide, GROUND); ctx.lineTo(a0 + sh - wide, GROUND); ctx.closePath(); ctx.fill();
      }
      for (let m = 0; m < 7; m++) {                                       // dust motes turning in the light
        const u = (hash(k * 7 + m) + tick * 0.0009 * (0.5 + hash(m + k))) % 1, v = hash(k * 3 + m * 5), y = at + fall * (0.1 + 0.8 * ((v + tick * 0.0006) % 1));
        const x = xl + (xr - xl) * u + sh * (y - at) / fall + Math.sin(tick * 0.02 + m + k) * 1.2;
        ctx.fillStyle = `rgba(${L.c},${(a * 4 * (0.5 + 0.5 * Math.sin(tick * 0.05 + m * 2 + k))).toFixed(3)})`; ctx.fillRect(x, y, 0.3, 0.3);
      }
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawFogLayer(A, y, h, speed, alpha, par) {
  setUnits();
  const tw = W * 1.4, off = ((camX * par + tick * speed) % tw + tw) % tw;
  for (const [L, la] of A.layers) {
    ctx.globalAlpha = alpha * la;
    ctx.drawImage(L.fog, -off, y, tw, h); ctx.drawImage(L.fog, tw - off, y, tw, h);
  }
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
  // the foundry's channels: bell-metal glows up out of every pit (the stone drawn afterwards hides the rest)
  for (let z = Math.max(0, Math.floor(x0 / ZW)); z <= Math.min(ZONES.length - 1, Math.floor(x1 / ZW)); z++) {
    if (!ACTS[ZONES[z].act].forge) continue;
    const mg = ctx.createLinearGradient(0, GROUND - 4, 0, H), pulse = 0.85 + 0.15 * Math.sin(tick * 0.05 + z);
    mg.addColorStop(0, 'rgba(255,120,30,0)'); mg.addColorStop(0.3, `rgba(255,130,40,${(0.5 * pulse).toFixed(3)})`); mg.addColorStop(0.7, `rgba(255,190,90,${(0.95 * pulse).toFixed(3)})`); mg.addColorStop(1, '#fff0c0');
    ctx.fillStyle = mg; ctx.fillRect(z * ZW, GROUND - 4, ZW, H - GROUND + 4);
  }
  // torch light (behind everything on the playfield)
  ctx.globalCompositeOperation = 'lighter';
  for (const t of torches) {
    if (t < x0 - 50 || t > x1 + 50) continue;
    const cool = ZONES[Math.floor(t / ZW)].act === 4, c = cool ? '110,180,255' : '255,150,70';
    const ln = torchLean[t] ? Math.abs(torchLean[t].x) : 0;
    const fl = (1 + Math.sin(tick * 0.31 + t) * 0.07 + Math.sin(tick * 0.77 + t * 2) * 0.05) * (1 - Math.min(0.3, ln * 0.1));
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
    if (silh) { ctx.fillStyle = 'rgba(2,3,8,0.86)'; ctx.fillRect(p.x, p.y, p.w, 2.4); }
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
    for (const c of scars) {
      if (c.x < s.x || c.x > s.x + s.w || Math.abs(c.y - s.y) > 1 || c.x < x0 || c.x > x1) continue;
      ctx.lineCap = 'round';
      const n = c.kind ? 4 : 1;
      for (let i = 0; i < n; i++) {
        const an = c.kind ? c.seed + i * 1.7 : c.ang, L = c.kind ? c.len * (0.5 + hash(c.seed + i) * 0.6) : c.len, dx = Math.cos(an) * L, dy = Math.abs(Math.sin(an)) * L * 0.55 + 0.7;
        const ax = c.kind ? c.x : c.x - dx / 2, bx = c.kind ? c.x + dx : c.x + dx / 2;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 0.46; line(ax, s.y + 0.6, bx, s.y + 0.6 + dy);
        ctx.strokeStyle = rgba(SA.rim, 0.42); ctx.lineWidth = 0.17; line(ax, s.y + 1.0, bx, s.y + 1.0 + dy);
      }
    }
    if (SA.snow) {   // a crust of snow along the top of the stone, with small drifts
      ctx.fillStyle = 'rgba(232,242,255,0.93)'; ctx.fillRect(s.x, s.y - 0.4, s.w, 1.2);
      for (let bx = s.x + 3; bx < s.x + s.w - 5; bx += 9) { ctx.beginPath(); ctx.ellipse(bx + hash(bx) * 5, s.y - 0.35, 2.2 + hash(bx + 3) * 2.4, 0.5 + hash(bx + 5) * 0.55, 0, Math.PI, 0); ctx.fill(); }
    }
    if (SA.wet) { ctx.fillStyle = 'rgba(170,195,240,0.14)'; for (let bx = s.x + 4; bx < s.x + s.w - 6; bx += 23) ctx.fillRect(bx, s.y + 0.4, 6 + hash(bx) * 8, 0.35); }
    if (SA.grass) { // grass parts and flattens around anyone standing or lying in it
      const feet = state === 'play' && player ? [player, ...enemies].filter(f => Math.abs(f.y - s.y) < 2.5 && f.x > s.x - 8 && f.x < s.x + s.w + 8) : [];
      ctx.strokeStyle = '#2a2818'; ctx.lineWidth = 0.2; ctx.beginPath();
      const g0 = Math.floor(Math.max(s.x, x0) / 0.7) * 0.7;
      for (let bx = g0; bx < Math.min(s.x + s.w, x1); bx += 0.7) {
        const hh = hash(Math.floor(bx * 3.1)); if (hh < 0.4 || bx < s.x) continue;
        let len = 0.7 + hh * 2.1, sw = Math.sin(tick * 0.04 + bx * 0.7) * 0.35, push = 0;
        for (const f of feet) { const dx = bx - f.x, rr = f.dead ? 9 : 6; if (Math.abs(dx) < rr) push += (dx < 0 ? -1 : 1) * (1 - Math.abs(dx) / rr) * (1 + Math.min(1.5, Math.abs(f.vx)) * 0.5); }
        if (push) { sw += push * 1.5; len *= 1 - Math.min(0.6, Math.abs(push) * 0.4); }
        ctx.moveTo(bx, s.y + 0.2); ctx.quadraticCurveTo(bx + sw * 0.3, s.y - len * 0.6, bx + sw, s.y - len);
      }
      ctx.stroke();
    }
    if (silh) { ctx.fillStyle = 'rgba(2,3,8,0.86)'; ctx.fillRect(s.x, s.y, s.w, s.h); }
  }
  // torches
  for (const t of torches) {
    if (t < x0 - 6 || t > x1 + 6) continue;
    const cool = ZONES[Math.floor(t / ZW)].act === 4, TA = actAt(t);
    ctx.fillStyle = '#141016'; ctx.fillRect(t - 0.35, 125, 0.7, 25);
    ctx.beginPath(); ctx.moveTo(t - 2, 123.2); ctx.lineTo(t + 2, 123.2); ctx.lineTo(t + 1.1, 125.6); ctx.lineTo(t - 1.1, 125.6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = rgba(TA.rim, 0.4); ctx.fillRect(t - 2, 123.2, 4, 0.25);
    const lean = torchLean[t] ? torchLean[t].x : 0;
    const fl = (1 + Math.sin(tick * 0.5 + t) * 0.12 + Math.sin(tick * 1.3 + t * 2) * 0.08) * (1 - Math.min(0.4, Math.abs(lean) * 0.12)), sw = Math.sin(tick * 0.4 + t) * 0.45 + lean * 1.25;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = cool ? 'rgba(60,140,255,0.75)' : 'rgba(255,100,30,0.75)'; flame(t, 123.4, 5.4 * fl, 1.6, sw);
    ctx.fillStyle = cool ? 'rgba(140,210,255,0.85)' : 'rgba(255,185,70,0.85)'; flame(t, 123.4, 3.8 * fl, 1.1, sw * 0.7);
    ctx.fillStyle = 'rgba(255,248,225,0.95)'; flame(t, 123.4, 2.1 * fl, 0.6, sw * 0.4);
    ctx.globalCompositeOperation = 'source-over';
  }
  drawBanners(x0, x1);
  drawBell();
}
function drawBanners(x0, x1) {
  for (const b of banners) {
    if (b.x < x0 - 12 || b.x > x1 + 12) continue;
    const A = actAt(b.x), top = BANNER_TOP, bot = top + b.len, hw = 4, k = b.len / BANNER_LEN;
    const sw = (Math.sin(tick * 0.035 + b.x) * 0.9 + b.sway) * k;
    chain(b.x - 4.8, top, -2, 0); chain(b.x + 4.8, top, -2, 0);
    ctx.fillStyle = '#17121a'; ctx.fillRect(b.x - 5.8, top - 0.6, 11.6, 1);
    ctx.fillStyle = silh ? '#05060a' : A.banner; ctx.beginPath();
    ctx.moveTo(b.x - hw, top + 0.3); ctx.lineTo(b.x + hw, top + 0.3);
    ctx.quadraticCurveTo(b.x + hw + sw * 0.5, top + b.len * 0.5, b.x + hw + sw * 1.4, bot);
    if (b.cut) for (let i = 1; i <= 5; i++) ctx.lineTo(b.x + hw - i * (2 * hw / 5) + sw * 1.4, bot - (i % 2 ? 0.9 + hash(b.x + i) * 1.4 : 0));
    else { ctx.lineTo(b.x + sw * 1.4, bot - 3.6); ctx.lineTo(b.x - hw + sw * 1.4, bot); }
    ctx.quadraticCurveTo(b.x - hw + sw * 0.5, top + b.len * 0.5, b.x - hw, top + 0.3); ctx.fill();
    if (!silh) {
      ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.7;
      ctx.beginPath(); ctx.moveTo(b.x - 1.2, top + 1); ctx.quadraticCurveTo(b.x - 1.2 + sw * 0.5, top + b.len * 0.5, b.x - 1.2 + sw * 1.3, bot - 3.4); ctx.stroke();
      ctx.fillStyle = rgba(A.rim, 0.32); ctx.fillRect(b.x - hw, top + 0.3, hw * 2, 0.3); ctx.fillRect(b.x - hw + 0.4 + sw * 0.08, top + 4.5, hw * 2 - 0.8, 0.5);
    }
  }
  for (const sc of scraps) {
    ctx.globalAlpha = Math.min(1, sc.life / 60); ctx.fillStyle = sc.col;
    if (sc.landed) { ctx.fillRect(sc.x - sc.h / 2, sc.y - 0.1, Math.min(sc.h, 10), 0.6); continue; }
    ctx.save(); ctx.translate(sc.x, sc.y); ctx.rotate(sc.rot); ctx.scale(Math.cos(sc.t * 0.1) * 0.5 + 0.6, 1);
    ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(-2.4, 1); ctx.lineTo(-0.8, 0.1); ctx.lineTo(0.8, 1.2); ctx.lineTo(2.4, 0.2); ctx.lineTo(4, 0.8);
    if (sc.tail) { ctx.lineTo(4, sc.h); ctx.lineTo(0, sc.h - 3.4); ctx.lineTo(-4, sc.h); } else { ctx.lineTo(4, sc.h); ctx.lineTo(-4, sc.h); }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.globalAlpha = 1;
}
// flashes from clashing steel light the air and splash across the ground
function drawLights() {
  if (!lights.length) return;
  setLayer(1); ctx.globalCompositeOperation = 'lighter';
  for (const l of lights) {
    const k = Math.pow(1 - l.t / l.life, 1.6), gy = groundYAt(l.x, l.y);
    glowAt(l.x, l.y, l.r * (0.7 + 0.3 * k), l.rgb, 0.5 * l.a * k);
    if (gy !== null && gy - l.y < 40) { ctx.save(); ctx.translate(l.x, gy + 0.4); ctx.scale(1, 0.2); glowAt(0, 0, l.r * 1.25, l.rgb, 0.7 * l.a * k); ctx.restore(); }
  }
  ctx.globalCompositeOperation = 'source-over';
}
// rain-slick stone mirrors the duel: sky sheen, torch streaks, rippling figures and rain rings
function drawReflections() {
  setLayer(1);
  const x0 = camX - 6, x1 = camX + W + 6, who = state === 'play' && player ? [player, ...enemies] : state === 'title' && titleHero ? [titleHero] : [];
  for (const s of solids) {
    if (s.x > x1 || s.x + s.w < x0 || !actAt(s.x + 1).wet) continue;
    const y = s.y, la = 0.1 + (lightning > 0 ? lightning * 0.035 : 0);
    const g = ctx.createLinearGradient(0, y, 0, y + 12);
    g.addColorStop(0, `rgba(150,178,225,${la.toFixed(3)})`); g.addColorStop(1, 'rgba(150,178,225,0)');
    ctx.fillStyle = g; ctx.fillRect(s.x, y + 0.3, s.w, 12);
    ctx.globalCompositeOperation = 'lighter';
    for (const t of torches) {
      if (t < s.x || t > s.x + s.w || y !== GROUND) continue;
      const cool = ZONES[Math.floor(t / ZW)].act === 4, c = cool ? '110,180,255' : '255,160,80', lean = torchLean[t] ? torchLean[t].x : 0;
      for (let i = 0; i < 9; i++) { // a broken, wavering streak of firelight
        const wob = Math.sin(tick * 0.11 + i * 1.3 + t) * (0.25 + i * 0.13) + lean * 0.3;
        ctx.save(); ctx.translate(t + wob, y + 1 + i * 1.5); ctx.scale(1, 0.3); glowAt(0, 0, 3.4 - i * 0.24, c, 0.5 - i * 0.05); ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (const f of who) {
      if (f.dead || f.roll > 0 || f.down > 0 || f.x < s.x - 4 || f.x > s.x + s.w + 4 || f.y > y + 0.5 || y - f.y > 44) continue;
      const look = lookOf(f); if (look.smoke) continue;
      const R = rig(f, f.x), Hd = handsFor(f, R), fade = clamp(1 - (y - f.y) / 44, 0, 1), col = f.team === 'player' ? '#0d1a24' : '#0a0c12';
      for (let b = 0; b < 5; b++) {
        ctx.save();
        ctx.beginPath(); ctx.rect(s.x, y + 0.35 + b * 2.3, s.w, 2.3); ctx.clip();
        ctx.translate(Math.sin(tick * 0.13 + b * 1.4 + f.x * 0.21) * (0.2 + b * 0.24), y); ctx.scale(1, -0.62); ctx.translate(0, -y);
        ctx.globalAlpha = (0.46 - b * 0.07) * fade;
        const hand = paintBody(f, R, Hd, look, col, 0, 0, true);
        if (f.armed) {
          const bl = Hd.blade, hx = hand[2], hy = hand[3], tx = bl[0] === null ? bl[2] : hx + (bl[2] - bl[0]), ty = bl[0] === null ? bl[3] : hy + (bl[3] - bl[1]);
          ctx.strokeStyle = 'rgba(205,222,245,0.55)'; ctx.lineWidth = 0.35; line(hx, hy, tx, ty);
        }
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
  }
  // rain rings (and the splashes of running feet)
  ctx.lineWidth = 0.16;
  for (const r of ripples) {
    if (r.x < x0 || r.x > x1) continue;
    const k = r.t / 22, rx = (0.5 + r.t * 0.2) * r.s;
    ctx.strokeStyle = `rgba(205,222,255,${((1 - k) * 0.5).toFixed(3)})`;
    ctx.beginPath(); ctx.ellipse(r.x, r.y + 0.25, rx, rx * 0.26, 0, 0, Math.PI * 2); ctx.stroke();
    if (r.t < 4) line(r.x, r.y, r.x + (r.s > 1.5 ? 0.5 : 0), r.y - (1.6 - r.t * 0.35) * r.s);
  }
}
function drawCrows() {
  if (!crows.length) return;
  setLayer(1); ctx.fillStyle = '#07050a';
  for (const c of crows) {
    if (!c.fly) {
      const d = Math.sin(c.t * 0.011 + c.x) > 0 ? 1 : -1, bob = Math.sin(c.t * 0.05 + c.x) > 0.93 ? 0.45 : 0;
      ctx.beginPath(); ctx.ellipse(c.x, c.y - 1.5, 1.9, 1.15, -0.25 * d, 0, Math.PI * 2); ctx.fill();
      circle(c.x + d * 1.5, c.y - 2.7 + bob, 0.78);
      ctx.beginPath(); ctx.moveTo(c.x + d * 2.1, c.y - 2.95 + bob); ctx.lineTo(c.x + d * 3.3, c.y - 2.5 + bob); ctx.lineTo(c.x + d * 2.1, c.y - 2.3 + bob); ctx.fill();
      ctx.beginPath(); ctx.moveTo(c.x - d * 1.2, c.y - 1.8); ctx.lineTo(c.x - d * 3.7, c.y - 0.5); ctx.lineTo(c.x - d * 1.3, c.y - 0.8); ctx.fill();
      ctx.fillRect(c.x - 0.5, c.y - 0.6, 0.18, 0.6); ctx.fillRect(c.x + 0.4, c.y - 0.6, 0.18, 0.6);
    } else {
      const d = c.dir, wy = Math.sin(c.t * 0.75) * 2.7;
      ctx.beginPath(); ctx.ellipse(c.x, c.y, 1.9, 0.8, -0.2 * d, 0, Math.PI * 2); ctx.fill();
      circle(c.x + d * 1.8, c.y - 0.4, 0.7);
      ctx.beginPath(); ctx.moveTo(c.x + d * 2.3, c.y - 0.55); ctx.lineTo(c.x + d * 3.4, c.y - 0.2); ctx.lineTo(c.x + d * 2.3, c.y); ctx.fill();
      ctx.beginPath(); ctx.moveTo(c.x - d * 1.4, c.y - 0.3); ctx.lineTo(c.x - d * 3.6, c.y + 0.5); ctx.lineTo(c.x - d * 1.4, c.y + 0.4); ctx.fill();
      ctx.beginPath(); ctx.moveTo(c.x + d * 1.0, c.y); ctx.quadraticCurveTo(c.x - d * 0.2, c.y - wy * 0.9, c.x - d * 2.8, c.y - wy * 1.6); ctx.lineTo(c.x - d * 1.2, c.y + 0.2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(c.x + d * 0.6, c.y); ctx.quadraticCurveTo(c.x + d * 0.2, c.y - wy * 0.6, c.x - d * 1.0, c.y - wy * 1.15); ctx.lineTo(c.x - d * 0.9, c.y + 0.3); ctx.fill();
    }
  }
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
  player:  { body: '#28304c', back: '#1a2036', coat: true, longcoat: '#c9a24a', hat: '#131218', feather: '#f3b91f', cavalier: '#c2222d', boots: '#3d2616', scarf: ['#8eeaff', '#35b4e0', '#16698c'] },
  dummy:   { body: '#5a4a34', back: '#3c3122', helm: '#b9a36a', sash: '#e8d8a0' },
  sparrer: { body: '#4a5a44', back: '#2f3a2c', helm: '#9fb0b8', sash: '#bff0ff', eye: '#bff0ff' },
  squire:  { body: '#3c3029', back: '#281f1a', helm: '#8a8a92', eye: '#ff5a6a' },
  duelist: { body: '#2c2739', back: '#1c1926', coat: true, hat: '#17141f', feather: '#ffa040', eye: '#ffa040' },
  thrower: { body: '#2e2535', back: '#1d1722', hood: true, sash: '#c07bff', eye: '#c07bff' },
  acolyte: { body: '#1f2e2e', back: '#142121', robe: true, hood: true, mask: '#dfe9e4', eye: '#5affc0' },
  shade:   { body: '#0d0b14', back: '#08070c', hood: true, eye: '#b8a8ff', smoke: true },
  reaver:  { body: '#2a3640', back: '#1b242c', helm: '#c8d4dc', eye: '#8fd8ff', cape: '#d8e2ea', broad: 1.15 },
  falconer: { body: '#1d2832', back: '#121a22', hood: true, mask: '#e8f2f8', eye: '#bfe8ff', cape: '#3a5a78', coat: true, sash: '#bfe8ff' },
  forgehand: { body: '#3a2c24', back: '#261c16', hood: true, sash: '#ff9a4a', eye: '#ff9a4a', broad: 1.2 },
  hammer:  { body: '#3b2a1e', back: '#261a12', helm: '#5a4a3c', eye: '#ff7a2a', cape: '#5a2408', chains: true, broad: 1.4 },
  tongs:   { body: '#2c2824', back: '#1c1916', hood: true, mask: '#d8c8a8', eye: '#ffd08a', sash: '#ffd08a', coat: true },
  gaoler:  { body: '#33271f', back: '#211913', helm: '#4e4640', eye: '#ff7a2a', cape: '#3c1d10', chains: true, broad: 1.35 },
  warden:  { body: '#17141d', back: '#0e0c12', crown: '#ffd54a', eye: '#ffd54a', cape: '#5c1218', coat: true },
};
function lightFor(f) {
  let fl = null, fs = 0.12;
  for (const l of lights) {
    const sv = l.a * (1 - l.t / l.life) * (1 - Math.hypot(l.x - f.x, l.y - (f.y - 10)) / (l.r * 1.5));
    if (sv > fs) { fs = sv; fl = l; }
  }
  if (fl) {
    const dx = fl.x - f.x, dy = fl.y - (f.y - 10), L = Math.hypot(dx, dy) || 1;
    return { x: dx / L, y: dy / L, col: `rgb(${fl.rgb})`, k: Math.min(1.2, fs * 1.7), flash: true };
  }
  let best = null, bd = 60;
  for (const t of torches) { const d = Math.abs(t - f.x); if (d < bd) { bd = d; best = t; } }
  if (best !== null) {
    const cool = ZONES[clamp(Math.floor(best / ZW), 0, ZONES.length - 1)].act === 4;
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
  else if (f.windup > 0) { hipY = Y - 6.5 * s; fa = [X + d * 3.0 * s, Y]; fb = [X - d * 3.6 * s, Y]; lean = -0.3; }
  else if (f.hop > 0) { hipY = Y - 8.4 * s; fa = [X + d * 2.8 * s, Y - 1.0 * s]; fb = [X - d * 2.4 * s, Y - 2.0 * s]; lean = -0.14; }
  else if (f.over > 0) { hipY = Y - 6.0 * s; fa = [X + d * 6.4 * s, Y]; fb = [X - d * 4.6 * s, Y]; lean = 0.72; }
  else if (f.prep > 0) { const q = Math.min(1, f.prepT / 5); hipY = Y - (7.7 - 0.8 * q) * s; fa = [X + d * 2.6 * s, Y]; fb = [X - d * (2.4 + 1.2 * q) * s, Y]; lean = 0.05 - 0.24 * q; }
  else if (f.lunge > 0) { const t = ext / (f.heavyL ? 12 : 6); hipY = Y - (7.7 - 1.6 * t) * s; fa = [X + d * (2.8 + t * 3.8) * s, Y]; fb = [X - d * (2.8 + t * 2.0) * s, Y]; lean = 0.2 + t * 0.4; }
  else if (spd > 0.25) {
    const ph = f.anim * 0.3 * clamp(spd / 1.2, 0.7, 1.5), sw = 2.5 * s, lift = 1.5 * s, dir = Math.sign(f.vx);
    fa = [X + Math.sin(ph) * sw * dir, Y - Math.max(0, Math.cos(ph)) * lift];
    fb = [X - Math.sin(ph) * sw * dir, Y - Math.max(0, -Math.cos(ph)) * lift];
    hipY = Y - 8.1 * s + Math.abs(Math.sin(ph)) * 0.3; lean = 0.14 * dir * d;
  } else { hipY = Y - 7.7 * s + Math.sin(f.anim * 0.06) * 0.12; fa = [X + d * 2.3 * s, Y]; fb = [X - d * 2.4 * s, Y]; }
  if (f.armed && f.onGround && !f.windup && !f.slash && !f.parry && !f.kick && !f.over) {
    if (f.stance === 2) { hipY += 1.1 * s; lean += 0.28; } else if (f.stance === 0) lean -= 0.04;
  }
  if (!f.armed && f.onGround && f.pose === 2) { hipY += 3.2 * s; lean += 0.45; fa = [X + d * 3.0 * s, Y]; fb = [X - d * 2.6 * s, Y]; }
  if (!f.armed && f.onGround && f.pose === 0) { hipY -= 0.6 * s; fa = [X + d * 1.8 * s, Y - 4.2 * s]; fb = [X - d * 0.6 * s, Y]; lean -= 0.06; }
  if (f.slash > 0 && f.onGround) { const q = Math.max(0, (18 - f.slash) / 18); lean += q < 0.33 ? -0.24 * (q / 0.33) : -0.24 + 0.62 * smooth(0.33, 0.8, q); hipY += 0.5 * s; }
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
      const t = Math.max(-0.5, (18 - f.slash) / 18), ang = t < 0.33 ? -2.1 + t * 0.3 : -2.0 + (t - 0.33) / 0.67 * 2.8;
      hand = [R.sh[0] + d * Math.cos(ang) * 6.5 * s, R.sh[1] + Math.sin(ang) * 6.5 * s];
      blade = [hand[0], hand[1], hand[0] + d * Math.cos(ang) * 13.4, hand[1] + Math.sin(ang) * 13.4]; R.slashAng = ang;
    } else if (f.parry > 0) { hand = [X + d * 3.4 * s, Y - 11.5 * s]; blade = [hand[0], hand[1], hand[0] + d * 0.5, hand[1] - 13.4]; }
    else if (f.windup > 0) { hand = [X - d * 2.6 * s, Y - 11 * s]; blade = [hand[0], hand[1], hand[0] + d * 13.4, hand[1] + 0.3]; }
    else if (f.plunge) { hand = [X + d * 1.2, Y - 10.5 * s]; blade = [hand[0], hand[1], hand[0] + d * 0.4, hand[1] + 17]; }
    else if (f.stun > 0) { hand = [X + d * 3.2 * s, Y - 7.5 * s]; blade = [hand[0], hand[1], hand[0] + d * 11.6, hand[1] + 4.2]; }
    else if (f.over > 0) { const hy = Math.min(Y - 3.2, stanceY(f) + 2.2); hand = [X + d * 8.6, hy]; blade = [hand[0], hand[1], hand[0] + d * 12.6, Math.min(Y - 0.6, hy + 4.6)]; }
    else if (f.prep > 0) { const q = Math.min(1, f.prepT / 5), hy = stanceY(f); hand = [X + d * (4.2 - 4.6 * q), hy - 0.5 * q]; blade = [hand[0], hand[1], hand[0] + d * 13.3, hy]; }
    else { const ext = lungeExt(f), hy = stanceY(f); hand = [X + d * (4.2 + ext * 0.7), hy]; blade = [null, null, X + d * reach(f), hy]; }
    const fencer = f.team === 'player' || f.type === 'duelist' || f.type === 'warden';
    off = fencer && f.onGround && !f.slash ? [X - d * 3.4 * s, Y - 16.2 * s] : [X - d * 1.6 * s, Y - 8.2 * s];
    if (Math.abs(f.vx) > 0.6 && f.onGround && !f.lunge) off = [X - d * 1.5 * s + Math.sin(f.anim * 0.3) * 1.6, Y - 9 * s];
    if (f.fling > 0) off = [X + d * (1 + (10 - f.fling) * 0.7) * s, Y - (13.5 - (10 - f.fling) * 0.25) * s];
  } else {
    hand = f.punch > 3 ? [X + d * 7.2, Y - 12.4 * s] : [X + d * 3.2 * s, Y - 12.6 * s];
    off = [X + d * 2.0 * s, Y - 13.4 * s];
    if (f.fling > 0) off = [X + d * (1 + (10 - f.fling) * 0.7) * s, Y - (13.5 - (10 - f.fling) * 0.25) * s];
    if (f.pose === 2) { hand = [hand[0], hand[1] + 3.6 * s]; off = [off[0] - d * 0.5, off[1] + 3.6 * s]; }
    else if (f.pose === 0) { hand = [hand[0] - d * 0.6, hand[1] - 1.6 * s]; off = [off[0], off[1] - 1.8 * s]; }
  }
  return { hand, blade, off };
}
function leg(hip, k, d, s, ox, oy, boot) {
  capsule(hip[0] + ox, hip[1] + oy, k[0] + ox, k[1] + oy, 1.0 * s, 0.72 * s);
  capsule(k[0] + ox, k[1] + oy, k[2] + ox, k[3] + oy, 0.72 * s, 0.5 * s);
  capsule(k[2] + ox, k[3] + oy - 0.15, k[2] + ox + d * 1.3 * s, k[3] + oy + 0.05, 0.45 * s, 0.32 * s);
  if (boot) { // tall cuffed riding boots with a buckle
    const keep = ctx.fillStyle, tx = k[0] + (k[2] - k[0]) * 0.3 + ox, ty = k[1] + (k[3] - k[1]) * 0.3 + oy;
    ctx.fillStyle = boot;
    capsule(tx, ty, k[2] + ox, k[3] + oy - 0.1, 0.86 * s, 0.62 * s);
    capsule(k[2] + ox - d * 0.2, k[3] + oy - 0.2, k[2] + ox + d * 1.7 * s, k[3] + oy + 0.02, 0.55 * s, 0.4 * s);
    capsule(tx - 0.15, ty, tx + 0.15, ty, 1.12 * s, 1.12 * s);                       // flared cuff
    ctx.fillStyle = 'rgba(255,235,190,0.22)'; ctx.fillRect(tx - 1.0 * s, ty - 0.95 * s, 2.0 * s, 0.28 * s);
    ctx.fillStyle = '#d8b455'; ctx.fillRect(k[2] + ox + d * 0.1 - 0.25, k[3] + oy - 1.25 * s, 0.5, 0.5);   // buckle
    ctx.fillStyle = keep;
  }
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
  leg(R.hip, R.kb, d, s, ox, oy, !rim && look.boots ? '#2a1a0f' : null);
  if (look.robe) {
    F(look.body); leg(R.hip, R.ka, d, s, ox, oy);
    const sw = Math.sin(tick * 0.12) * 0.5 + (f.cx || 0) * 0.6;
    ctx.beginPath();
    ctx.moveTo(R.neck[0] - 1.5 * s + ox, R.neck[1] + 1 + oy); ctx.lineTo(R.neck[0] + 1.5 * s + ox, R.neck[1] + 1 + oy);
    ctx.lineTo(R.X + 3.4 * s + sw + ox, R.Y - 0.4 + oy); ctx.lineTo(R.X - 3.4 * s + sw * 1.3 + ox, R.Y - 0.4 + oy); ctx.closePath(); ctx.fill();
  }
  F(look.body);
  capsule(R.hip[0] + ox, R.hip[1] + oy, R.neck[0] + ox, R.neck[1] + oy, 1.25 * s * B, 1.5 * s * B);
  if (look.longcoat) { // a long duelist's coat: split tails to the knee, high collar, gilt edging and buttons
    const cxl = clamp(f.cx || 0, -4.4, 4.4), lift = clamp(f.cy || 0, -4, 1.5) - Math.abs(cxl) * 0.24, wv = Math.sin(tick * 0.2) * 0.25 + Math.sin(tick * 0.62 + f.x) * 0.16 * Math.min(2, Math.abs(cxl)), hpx = R.hip[0] + ox, hpy = R.hip[1] + oy, nx = R.neck[0] + ox, ny = R.neck[1] + oy;
    ctx.beginPath(); ctx.moveTo(hpx - d * 1.2, hpy - 1.6);
    ctx.quadraticCurveTo(hpx - d * 2.2 + cxl * 0.55, hpy + 2.5 * s + lift * 0.3, hpx - d * 2.6 + cxl, hpy + 6.4 * s + wv + lift);
    ctx.lineTo(hpx - d * 0.9 + cxl * 0.6, hpy + 5.6 * s - wv + lift * 0.8); ctx.lineTo(hpx - d * 0.2, hpy + 3.2 * s);
    ctx.lineTo(hpx + d * 0.5 + cxl * 0.5, hpy + 5.9 * s + wv + lift * 0.7); ctx.lineTo(hpx + d * 1.5 + cxl * 0.3, hpy + 5.2 * s + lift * 0.4);
    ctx.lineTo(hpx + d * 1.25, hpy - 1.2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(nx - d * 1.5 * s, ny + 0.9 * s); ctx.lineTo(nx - d * 1.25 * s, ny - 1.5 * s); ctx.lineTo(nx + d * 0.3 * s, ny + 0.2 * s); ctx.closePath(); ctx.fill();   // collar
    if (!rim) {
      ctx.strokeStyle = look.longcoat; ctx.lineWidth = 0.28; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(nx + d * 0.9 * s, ny + 0.6 * s); ctx.lineTo(hpx + d * 1.2, hpy - 0.6); ctx.lineTo(hpx + d * 1.45 + cxl * 0.3, hpy + 5.1 * s + lift * 0.4); ctx.stroke();           // front edge
      ctx.beginPath(); ctx.moveTo(hpx - d * 2.5 + cxl, hpy + 6.3 * s + wv + lift); ctx.lineTo(hpx - d * 0.9 + cxl * 0.6, hpy + 5.6 * s - wv + lift * 0.8); ctx.stroke();                     // hem
      ctx.lineWidth = 0.5; ctx.strokeStyle = '#141018'; line(hpx - d * 1.2, hpy - 0.9, hpx + d * 1.25, hpy - 0.7);                                                          // belt
      ctx.fillStyle = look.longcoat; ctx.fillRect(hpx + d * 0.55 - 0.3, hpy - 1.15, 0.6, 0.6);
      for (let i = 1; i <= 3; i++) circle(nx + (hpx - nx) * (i / 4.2) + d * 0.55 * s, ny + (hpy - ny) * (i / 4.2), 0.2);
      F(look.body);
    }
  } else if (look.coat) {
    const tail = 2.2 + Math.min(2.5, Math.abs(f.vx) * 1.2);
    ctx.beginPath(); ctx.moveTo(R.hip[0] - d * 0.9 + ox, R.hip[1] - 1.2 + oy);
    ctx.lineTo(R.hip[0] - d * tail + ox, R.hip[1] + 3.8 * s + oy + Math.sin(tick * 0.2) * 0.2);
    ctx.lineTo(R.hip[0] + d * 0.8 + ox, R.hip[1] + 2.4 * s + oy); ctx.closePath(); ctx.fill();
  }
  if (!look.robe) leg(R.hip, R.ka, d, s, ox, oy, !rim && look.boots);
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
  if (look.hat && look.cavalier) { // black cavalier hat: tall flat-topped crown, very wide brim folded up on one side, red band and edging, upright yellow plume
    F(look.hat);
    const by = hy - 1.0 * s, cx = hx + d * 0.1 * s, cw = 1.75 * s, ch = 2.5 * s, fx = cx - d * 2.3 * s;
    ctx.beginPath(); ctx.ellipse(cx + d * 0.5 * s, by + 0.05 * s, 4.7 * s, 0.6 * s, 0.05 * d, 0, Math.PI * 2); ctx.fill();                    // wide flat brim
    ctx.beginPath(); ctx.moveTo(cx - d * 4.3 * s, by + 0.2 * s); ctx.quadraticCurveTo(cx - d * 3.9 * s, by - 2.2 * s, fx + d * 0.6 * s, by - 2.5 * s);   // brim folded up against the crown
    ctx.lineTo(cx - d * 1.2 * s, by + 0.2 * s); ctx.closePath(); ctx.fill();
    ctx.fillRect(cx - cw, by - ch, cw * 2, ch);                                                                                               // straight-sided crown
    ctx.beginPath(); ctx.ellipse(cx, by - ch, cw, 0.32 * s, 0, 0, Math.PI * 2); ctx.fill();                                                   // flat top
    if (!rim) {
      ctx.fillStyle = look.cavalier; ctx.fillRect(cx - cw, by - 0.95 * s, cw * 2, 0.7 * s);                                                   // red band
      ctx.strokeStyle = look.cavalier; ctx.lineWidth = 0.22 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.ellipse(cx + d * 0.5 * s, by + 0.05 * s, 4.7 * s, 0.6 * s, 0.05 * d, 0.08, Math.PI - 0.08); ctx.stroke();          // red edge on the brim
      ctx.beginPath(); ctx.moveTo(cx - d * 4.3 * s, by + 0.2 * s); ctx.quadraticCurveTo(cx - d * 3.9 * s, by - 2.2 * s, fx + d * 0.6 * s, by - 2.5 * s); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.10)'; ctx.fillRect(cx + d * cw * 0.35 - 0.25 * s, by - ch, 0.5 * s, ch - 0.95 * s);                 // felt sheen
      // a full ostrich plume standing up from the fold and curling back over
      const sw = Math.sin(tick * 0.08) * 0.3 + Math.sin(tick * 0.5 + 1) * 0.1 * Math.min(2, Math.abs(f.cx || 0)) + clamp((f.cx || 0) * d * 0.5, -2.2, 1.4), px = fx + d * 0.5 * s, py = by - 1.9 * s;
      const P = t => { const u = 1 - t, c1x = px - d * 0.2 * s, c1y = py - 4.2 * s, c2x = px - d * 2.2 * s + d * sw * 0.3, c2y = py - 6.6 * s, ex = px - d * 4.6 * s + d * sw, ey = py - 4.4 * s + sw * 0.4;
        return [u * u * u * px + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex, u * u * u * py + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey]; };
      for (const [w, col] of [[2.3, rgba(look.feather, 0.32)], [1.5, rgba(look.feather, 0.75)], [0.8, look.feather]]) {
        ctx.strokeStyle = col; ctx.lineWidth = w * s; ctx.beginPath(); ctx.moveTo(px, py);
        for (let t = 0.1; t <= 1.001; t += 0.1) { const q = P(t); ctx.lineTo(q[0], q[1]); } ctx.stroke();
      }
      ctx.strokeStyle = rgba(look.feather, 0.55); ctx.lineWidth = 0.5 * s;                                                                   // wispy barbs
      for (let i = 2; i <= 22; i++) { const q = P(i / 22.5), r = P(i / 22.5 + 0.04), nx = -(r[1] - q[1]), ny = r[0] - q[0], L = (0.9 + hash(i) * 0.6) * (0.6 + i / 30) * s / (Math.hypot(nx, ny) || 1);
        line(q[0], q[1], q[0] + nx * L - d * 0.3 * s, q[1] + ny * L + 0.3 * s); line(q[0], q[1], q[0] - nx * L * 0.8 - d * 0.3 * s, q[1] - ny * L * 0.8 + 0.3 * s); }
      ctx.strokeStyle = '#fff0b0'; ctx.lineWidth = 0.16 * s; ctx.beginPath(); ctx.moveTo(px, py); for (let t = 0.1; t <= 1.001; t += 0.1) { const q = P(t); ctx.lineTo(q[0], q[1]); } ctx.stroke();   // quill
    }
  } else if (look.hat) {
    F(look.hat);
    ctx.beginPath(); ctx.ellipse(hx, hy - 0.95 * s, 2.9 * s, 0.42 * s, 0, 0, Math.PI * 2); ctx.fill();
    capsule(hx, hy - 1.2 * s, hx - d * 0.3, hy - 2.5 * s, 1.15 * s, 1.0 * s);
    if (!rim) { ctx.strokeStyle = look.feather; ctx.lineWidth = 0.45; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(hx - d * 0.6, hy - 2.3 * s); ctx.quadraticCurveTo(hx - d * 2.2, hy - 4.8 * s, hx - d * 4.4, hy - 3.6 * s + Math.sin(tick * 0.1) * 0.3 - Math.abs(f.cx || 0) * 0.2); ctx.stroke(); }
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
  if (f && f.bloody > 0) { // fresh blood down the last two-thirds of the blade
    const a = Math.min(1, f.bloody / 150) * 0.9;
    ctx.strokeStyle = `rgba(150,8,18,${a.toFixed(3)})`; ctx.lineWidth = 0.42; ctx.lineCap = 'butt';
    line(bx + (x1 - bx) * 0.35, by + (y1 - by) * 0.35, x1 - ux * 0.6, y1 - uy * 0.6); ctx.lineCap = 'round';
  }
  ctx.globalCompositeOperation = 'lighter';
  const gt = ((tick + Math.abs(x0) * 7) % 170) / 24;
  if (gt < 1) glowAt(bx + (x1 - bx) * gt, by + (y1 - by) * gt, 1.6, '255,255,255', 0.8);
  if (f && f.team !== 'player' && f.windup > 0 && f.T && f.T.heavyTell) {   // a heavy lunge drawn back: an amber star on the point. A matched guard will not stop this one either
    const a = Math.min(1, 0.55 + f.windup / 40), r = 2.4 + Math.min(f.windup, 16) * 0.12;
    glowAt(x1, y1, r * 1.7, '255,160,60', a * 0.85);
    ctx.strokeStyle = `rgba(255,205,140,${a.toFixed(3)})`; ctx.lineWidth = 0.34;
    line(x1 - r * 1.5, y1, x1 + r * 1.5, y1); line(x1, y1 - r * 1.5, x1, y1 + r * 1.5);
  }
  if (f && f.slash > 18) {   // a held cut: a red star on the raised point warns that a guard will not stop this one
    const a = Math.min(1, 0.5 + (f.slash - 18) / 14), r = 2.6 + (f.slash - 18) * 0.12;
    glowAt(x1, y1, r * 1.6, '255,110,80', a * 0.85);
    ctx.strokeStyle = `rgba(255,170,140,${a.toFixed(3)})`; ctx.lineWidth = 0.34;
    line(x1 - r * 1.5, y1, x1 + r * 1.5, y1); line(x1, y1 - r * 1.5, x1, y1 + r * 1.5);
  }
  if (f && f.prep > 0) {
    // a star on the point, at the height the thrust will come in: brightest as the blade is drawn back, and
    // flaring again just before it flies. A faint line shows the path.
    const foe = f.team !== 'player', rgb = foe ? '255,226,170' : '190,240,255';
    const a0 = Math.max(0, 1 - f.prepT / 9), a1 = f.prep <= 5 ? (6 - f.prep) / 5 : 0, a = Math.min(1, (foe ? 0.45 : 0.18) + a0 * 0.75 + a1 * 0.55 + (f.glint > 0 ? 0.6 : 0));
    const r = (foe ? 2.4 : 1.5) + a0 * 2.6 + a1 * 1.2;
    glowAt(x1, y1, r * 1.5, rgb, a * 0.8);
    ctx.strokeStyle = `rgba(${rgb},${a.toFixed(3)})`; ctx.lineWidth = 0.34;
    line(x1 - r * 1.5, y1, x1 + r * 1.5, y1); line(x1, y1 - r * 1.5, x1, y1 + r * 1.5);
    ctx.lineWidth = 0.22; line(x1 - r * 0.7, y1 - r * 0.7, x1 + r * 0.7, y1 + r * 0.7); line(x1 - r * 0.7, y1 + r * 0.7, x1 + r * 0.7, y1 - r * 0.7);
    if (foe) { ctx.strokeStyle = `rgba(${rgb},${(0.1 + a1 * 0.16).toFixed(3)})`; ctx.lineWidth = 0.3; line(x1, y1, x1 + ux * 16, y1); }
  }
  if (f && f.riposteT > 0 && f.prep <= 0 && f.lunge <= 0) glowAt(x1, y1, 2.2 + Math.sin(tick * 0.6) * 0.5, '170,230,255', 0.7);   // your blade is ready to riposte
  if (f && lungeExt(f) >= 6) {
    if (f.ripFx > 0) { ctx.strokeStyle = 'rgba(170,230,255,0.55)'; ctx.lineWidth = 1.2; line(x1 - ux * 20, y1 - uy * 20, x1, y1); }
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
  const d = R.d, cxl = clamp(f.cx || 0, -5, 5), lift = clamp(f.cy || 0, -4, 1.5) - Math.abs(cxl) * 0.3;
  ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(R.sh[0] + d * 0.6, R.sh[1] - 0.4);
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    ctx.lineTo(R.sh[0] - d * (0.6 + t * 2.4) + cxl * t * (0.5 + t) + Math.sin(tick * 0.08 + i) * 0.35 * t + Math.sin(tick * 0.55 + i * 1.3) * 0.14 * t * Math.min(2.5, Math.abs(cxl)), R.sh[1] + t * f.h * 0.66 + lift * t * t);
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
    const r = Math.min((f.gore ? 13 : 9) * s, 1 + f.deadT * (f.gore ? 0.09 : 0.06)), gr = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
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
function surfaceAt(x, gy) {
  for (const s of solids) if (x >= s.x && x <= s.x + s.w && s.y === gy) return [s.x, s.w, 9];
  for (const p of platforms) if (x >= p.x && x <= p.x + p.w && p.y === gy) return [p.x, p.w, 2.3];
  return null;
}
// a fast-moving blade leaves a fading ribbon of light behind it
function trailBlade(f, x0, y0, x1, y1, rgb) {
  const T = f.trail || (f.trail = []);
  if (f.trailTick !== tick) {
    f.trailTick = tick;
    T.push({ bx: x0 + (x1 - x0) * 0.35, by: y0 + (y1 - y0) * 0.35, tx: x1, ty: y1, k: tick });
    while (T.length > 7 || (T.length && tick - T[0].k > 9)) T.shift();
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 1; i < T.length; i++) {
    const a = T[i - 1], b = T[i], d = Math.hypot(b.tx - a.tx, b.ty - a.ty);
    if (d < 1.9 || d > 26 || b.k - a.k > 2) continue;
    ctx.fillStyle = `rgba(${rgb},${(Math.pow(i / T.length, 1.6) * Math.min(1, d / 5) * 0.42).toFixed(3)})`;
    ctx.beginPath(); ctx.moveTo(a.bx, a.by); ctx.lineTo(a.tx, a.ty); ctx.lineTo(b.tx, b.ty); ctx.lineTo(b.bx, b.by); ctx.closePath(); ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
}
function drawFighter(f) {
  if (f.y > H + 30 || f.x < camX - 40 || f.x > camX + W + 40) return;
  if (f.T && f.T.elite && !f.dead) {
    ctx.globalCompositeOperation = 'lighter'; glowAt(f.x, f.y - 10, 15, '255,196,90', 0.2 + 0.07 * Math.sin(tick * 0.12 + f.x)); ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < f.hp; i++) { ctx.fillStyle = '#ffc84a'; ctx.beginPath(); const px = f.x + (i - (f.hp - 1) / 2) * 2.6, py = f.y - f.h - 6.5; ctx.moveTo(px, py - 1.1); ctx.lineTo(px + 0.9, py); ctx.lineTo(px, py + 1.1); ctx.lineTo(px - 0.9, py); ctx.closePath(); ctx.fill(); }
  }
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
  if (!f.armed && f.trail) f.trail.length = 0;
  // a long shadow thrown away from the nearest light (torch, sun, moon or a flash of steel)
  const surf = gy !== null && gy - f.y < 1.5 && !look.smoke ? surfaceAt(f.x, gy) : null;
  if (surf && !silh) {
    const sh = clamp(-lt.x * 1.2 / (Math.abs(lt.y) + 0.3), -1.9, 1.9);
    ctx.save();
    ctx.beginPath(); ctx.rect(surf[0], gy + 0.3, surf[1], surf[2]); ctx.clip();
    ctx.translate(f.x, gy); ctx.transform(1, 0, -sh, -0.42, 0, 0); ctx.translate(-f.x, -gy);
    ctx.globalAlpha = alpha * (0.22 + 0.2 * Math.min(1, lt.k));
    paintBody(f, R, Hd, look, '#000000', 0, 0, true);
    ctx.restore(); ctx.globalAlpha = alpha;
  }
  if (look.smoke) {
    for (let i = 0; i < 6; i++) {
      const t = ((tick * 0.6 + i * 17) % 40) / 40;
      ctx.fillStyle = `rgba(40,30,70,${(0.25 * (1 - t)).toFixed(3)})`;
      circle(f.x + Math.sin(i * 2 + tick * 0.05) * 2, f.y - 8 - t * 14, 1.5 + t * 3);
    }
  }
  if (isP) drawScarf(f, R);
  if (look.cape) drawCape(f, R, look.cape);
  if (!silh) { // edge light: thin act-tinted outline so fighters read against busy backdrops
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
    const hx = ea[2], hy = ea[3], tip = f.parry > 0 ? [hx + R.d * 7.2, hy - 11] : [hx + R.d * 12.8, hy + 1.5 + Math.sin(f.anim * 0.08) * 0.4];
    ctx.globalAlpha = alpha * 0.9; drawBlade(f, hx, hy, tip[0], tip[1]); ctx.globalAlpha = alpha;
  }
  if (!silh) {
    const ro = lt.flash ? 0.6 : 0.3;
    ctx.globalAlpha = alpha * Math.min(1, 0.5 + 0.45 * lt.k);
    paintBody(f, R, Hd, look, lt.col, lt.x * ro, lt.y * ro, true);
  }
  ctx.globalAlpha = alpha;
  // a lightning strike reduces everyone to a hard black shape
  const hand = silh ? paintBody(f, R, Hd, look, '#04050a', 0, 0, true) : paintBody(f, R, Hd, look, null, 0, 0, false);
  if (f.armed) {
    const b = Hd.blade, x0 = hand[2], y0 = hand[3];
    let x1, y1;
    if (b[0] === null) { x1 = b[2]; y1 = b[3]; } else { x1 = x0 + (b[2] - b[0]); y1 = y0 + (b[3] - b[1]); }
    trailBlade(f, x0, y0, x1, y1, isP ? '170,225,255' : look.eye ? hexRgb(look.eye).join(',') : '255,240,220');
    drawBlade(f, x0, y0, x1, y1);
    ctx.globalCompositeOperation = 'lighter';
    if (f.windup > 0) glowAt(x0, y0, 4, '255,210,130', 0.35 + 0.3 * Math.sin(tick * 0.8));
    if (f.parry > 6) glowAt(x1, y1 + 3, 4, '160,230,255', 0.6);
    if (f.slash >= 5 && f.slash <= 13 && R.slashAng !== undefined) {
      ctx.lineCap = 'round';
      const a1 = R.slashAng, a0 = a1 - 1.5, r = 16.5 * R.s;
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
  const fast = !f.dead && f.roll <= 0 && f.down <= 0 && (f.dash > 0 || Math.abs(f.vx) > 2.6 || f.heavyL || f.lunge > 7);
  if (fast) {
    const isP = f.team === 'player', look = lookOf(f);
    const col = isP ? '#7fe0ff' : rgba(look.eye || '#ffffff', 1);
    for (const [k, a] of [[4.5, 0.1], [2.2, 0.2]]) {
      const R = rig(f, f.x - f.vx * k); const Hd = handsFor(f, R);
      ctx.globalAlpha = a; paintBody(f, R, Hd, look, col, 0, 0, true);
    }
    ctx.globalAlpha = 1;
  }
  const sm = f.dead || f.roll > 0 || f.down > 0 ? 0 : f.dash > 0 ? 0.2 : f.lunge > (f.heavyL ? 9 : 7) ? (f.heavyL ? 0.2 : 0.13) : 0;
  if (sm) { ctx.save(); ctx.translate(f.x, f.y); ctx.scale(1 + sm, 1 - sm * 0.3); ctx.translate(-f.x, -f.y); drawFighter(f); ctx.restore(); }
  else drawFighter(f);
}
function drawPropShape(p, sil) {
  const c = PROP_COL[p.kind], F = col => { ctx.fillStyle = sil ? '#04050a' : col; }, dk = mixHex(c, '#000000', 0.45);
  if (p.kind === 'pot') {
    F(c); ctx.beginPath(); ctx.moveTo(-1.5, -6.2); ctx.lineTo(1.5, -6.2); ctx.quadraticCurveTo(1.1, -5.2, 2.7, -3.6); ctx.quadraticCurveTo(3.3, -1.2, 1.7, 0); ctx.lineTo(-1.7, 0); ctx.quadraticCurveTo(-3.3, -1.2, -2.7, -3.6); ctx.quadraticCurveTo(-1.1, -5.2, -1.5, -6.2); ctx.fill();
    F(dk); ctx.fillRect(-1.8, -6.6, 3.6, 0.7); ctx.fillRect(-2.6, -3.3, 5.2, 0.35);
    if (!sil) { ctx.fillStyle = 'rgba(255,230,200,0.28)'; ctx.beginPath(); ctx.ellipse(-1.2, -2.6, 0.5, 1.5, 0.2, 0, Math.PI * 2); ctx.fill(); }
  } else if (p.kind === 'bottle') {
    F(c); ctx.fillRect(-1.1, -4.2, 2.2, 4.2); ctx.fillRect(-0.45, -6.4, 0.9, 2.4); ctx.beginPath(); ctx.ellipse(0, -4.2, 1.1, 0.5, 0, 0, Math.PI * 2); ctx.fill();
    F('#c8b07a'); ctx.fillRect(-0.5, -6.9, 1, 0.6);
    if (!sil) { ctx.fillStyle = 'rgba(220,255,235,0.4)'; ctx.fillRect(-0.8, -3.8, 0.4, 3.2); }
  } else if (p.kind === 'stool') {
    F(dk); ctx.fillRect(-2.6, -4.2, 0.7, 4.2); ctx.fillRect(1.9, -4.2, 0.7, 4.2); ctx.fillRect(-0.3, -4.2, 0.6, 3.9); ctx.fillRect(-2.4, -2, 4.8, 0.4);
    F(c); ctx.fillRect(-3.2, -5, 6.4, 1); if (!sil) { ctx.fillStyle = 'rgba(255,225,180,0.25)'; ctx.fillRect(-3.2, -5, 6.4, 0.25); }
  } else if (p.kind === 'skull') {
    F(c); ctx.beginPath(); ctx.arc(0, -2.6, 2.1, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(-1.3, -1.4, 2.6, 1.4);
    F('#15101a'); circle(-0.8, -2.5, 0.55); circle(0.9, -2.5, 0.55); ctx.fillRect(-0.15, -1.6, 0.3, 0.6); for (let i = -1; i <= 1; i++) ctx.fillRect(i * 0.7 - 0.08, -0.7, 0.16, 0.7);
  } else {  // lantern
    F('#1a161c'); ctx.fillRect(-1.6, -0.5, 3.2, 0.5); ctx.fillRect(-1.3, -5.6, 2.6, 0.5); ctx.fillRect(-1.5, -5.2, 0.3, 4.8); ctx.fillRect(1.2, -5.2, 0.3, 4.8);
    ctx.strokeStyle = sil ? '#04050a' : '#1a161c'; ctx.lineWidth = 0.3; ctx.beginPath(); ctx.arc(0, -6, 1, Math.PI, 0); ctx.stroke();
    if (!sil) { ctx.fillStyle = 'rgba(255,190,100,0.9)'; ctx.fillRect(-1.1, -5, 2.2, 4.4); ctx.fillStyle = '#fff3d0'; ctx.fillRect(-0.4, -3.8, 0.8, 2.4); }
  }
}
function drawProps() {
  setLayer(1);
  const near = state === 'play' && player && !player.dead ? nearProp(player) : null;
  for (const p of props) {
    if (p.back > 0 || p.x < camX - 12 || p.x > camX + W + 12) continue;
    if (!p.fly && !silh) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 0.15, 3.4, 0.55, 0, 0, Math.PI * 2); ctx.fill(); }
    if (p.kind === 'lantern' && !silh) { ctx.globalCompositeOperation = 'lighter'; glowAt(p.x, p.y - 3, 15 + Math.sin(tick * 0.2 + p.x0) * 1.2, '255,170,80', 0.3); ctx.globalCompositeOperation = 'source-over'; }
    if (p === near && !silh) { ctx.globalCompositeOperation = 'lighter'; glowAt(p.x, p.y - 3, 8, '255,240,200', 0.3 + 0.12 * Math.sin(tick * 0.2)); ctx.globalCompositeOperation = 'source-over'; }
    ctx.save(); ctx.translate(p.x, p.y);
    if (p.fly) { ctx.translate(0, -3); ctx.rotate(p.spin * (p.vx >= 0 ? 1 : -1)); ctx.translate(0, 3); }
    drawPropShape(p, silh); ctx.restore();
    if (p.fly && !silh) { ctx.globalCompositeOperation = 'lighter'; ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 0.7; line(p.x, p.y - 3, p.x - p.vx * 2.2, p.y - 3 - p.vy * 2.2); ctx.globalCompositeOperation = 'source-over'; }
    if (p === near && !silh) {   // the key to press, floating over it
      const by = p.y - 12.5 + Math.sin(tick * 0.1) * 0.5;
      ctx.fillStyle = 'rgba(10,4,18,0.75)'; ctx.fillRect(p.x - 2.3, by - 3.6, 4.6, 4.6);
      ctx.strokeStyle = 'rgba(255,227,154,0.9)'; ctx.lineWidth = 0.25; ctx.strokeRect(p.x - 2.3, by - 3.6, 4.6, 4.6);
      ctx.font = 'bold 3.6px "Courier New", monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe39a'; ctx.fillText('E', p.x, by);
    }
  }
}
function drawSwords() {
  setLayer(1);
  for (const s of swords) {
    if (s.onGround) {
      if (player && !player.armed) { ctx.globalCompositeOperation = 'lighter'; glowAt(s.x, s.y - 0.5, 5, '200,235,255', 0.25 + 0.2 * Math.sin(tick * 0.15)); ctx.globalCompositeOperation = 'source-over'; }
      if (s.stuck !== undefined) {   // point buried in the ground, hilt quivering
        const an = s.stuck + Math.sin(s.quiver * 1.3) * 0.05 * s.quiver / 14;
        drawBlade(null, s.x - Math.sin(an) * 11.3, s.y - Math.cos(an) * 11.3, s.x + Math.sin(an) * 1.4, s.y + Math.cos(an) * 1.4);
      } else drawBlade(null, s.x - 5, s.y - 0.4, s.x + 6, s.y - 0.4);
    } else {
      const a = s.age * 0.45;
      if (s.gift) { ctx.globalCompositeOperation = 'lighter'; glowAt(s.x, s.y, 8, '255,235,180', 0.45); ctx.globalCompositeOperation = 'source-over'; }
      drawBlade(null, s.x - Math.cos(a) * 5.5, s.y - Math.sin(a) * 5.5, s.x + Math.cos(a) * 5.5, s.y + Math.sin(a) * 5.5);
    }
  }
  for (const p of projs) {
    const d = Math.sign(p.vx);
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createLinearGradient(p.x - d * 18, 0, p.x, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.45)');
    ctx.strokeStyle = gr; ctx.lineWidth = 0.6; line(p.x - d * 18, p.y, p.x, p.y);
    ctx.globalCompositeOperation = 'source-over';
    if (p.echo) { ctx.globalCompositeOperation = 'lighter'; glowAt(p.x, p.y, 5, '150,220,255', 0.5); ctx.globalAlpha = 0.6; }
    drawBlade(null, p.x - d * 5.5, p.y, p.x + d * 6, p.y);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
  for (const s of swords) if (s.home && !s.onGround) { ctx.globalCompositeOperation = 'lighter'; glowAt(s.x, s.y, 6, '190,230,255', 0.5); ctx.globalCompositeOperation = 'source-over'; }
  // lightning called by the build: a jagged stroke from the sky to its mark
  for (const b of boltFx) {
    const a = 1 - b.t / 14; ctx.globalCompositeOperation = 'lighter';
    for (const [w, al] of [[2.2, 0.25], [0.7, 0.95]]) {
      ctx.strokeStyle = `rgba(215,235,255,${(al * a).toFixed(3)})`; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(b.x + (hash(b.seed) - 0.5) * 30, -4);
      for (let i = 1; i <= 7; i++) ctx.lineTo(b.x + (i === 7 ? 0 : (hash(b.seed + i * 3.1) - 0.5) * 16 * (1 - i / 8)), -4 + (b.y + 10) * i / 7);
      ctx.stroke();
    }
    glowAt(b.x, b.y + 6, 22, '200,228,255', 0.7 * a); ctx.globalCompositeOperation = 'source-over';
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
      const r = p.r || 0.32;
      if (p.landed) {
        // dry stains darken and stay; in the rain they spread, thin and wash away
        const age = 1 - p.life / (p.life0 || p.life), wash = p.wet ? age : 0;
        if (p.wet) ctx.globalAlpha = a * (1 - wash * 0.75); else if (age > 0.02) ctx.globalAlpha = a * 0.82;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, r * 2.7 * (1 + wash * 2.2), r * 0.7 * (1 + wash * 0.5), 0, 0, Math.PI * 2); ctx.fill();
      }
      else {
        if (p.r) { ctx.strokeStyle = p.color; ctx.lineWidth = r * 1.1; line(p.x, p.y, p.x - p.vx * 0.9, p.y - p.vy * 0.9); }
        circle(p.x, p.y, r);
      }
    } else if (p.spark) {
      const k = Math.min(1, p.life / 40), c = k > 0.6 ? '255,244,200' : k > 0.3 ? '255,170,70' : '230,80,30';
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(${c},${Math.min(1, p.life / 14).toFixed(3)})`; ctx.lineWidth = 0.34; line(p.x, p.y, p.x - p.vx * 1.6, p.y - p.vy * 1.6 - 0.05);
      glowAt(p.x, p.y, 1.5, c, 0.35 * Math.min(1, p.life / 14));
      ctx.globalCompositeOperation = 'source-over';
    } else if (p.ember) {
      const tw = 0.6 + 0.4 * Math.sin(tick * 0.3 + p.seed * 7), fa = Math.min(1, p.life / 30) * tw, c = p.cool ? '150,205,255' : '255,180,90';
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(${c},${(fa * 0.9).toFixed(3)})`; circle(p.x, p.y, 0.22);
      glowAt(p.x, p.y, 1.1, c, fa * 0.3);
      ctx.globalCompositeOperation = 'source-over';
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
  const wth = state === 'title' ? 'rain' : ZONES[zi].weather;
  ctx.lineCap = 'round';
  for (const w of weatherP) {
    const x = w.x * K, y = w.y * K;
    if (wth === 'rain') { ctx.strokeStyle = `rgba(175,200,240,${(0.1 + w.s * 0.12).toFixed(3)})`; ctx.lineWidth = w.s * 1.3; line(x, y, x - 5 * w.s, y + 22 * w.s); }
    else if (wth === 'ash') { const big = w.s > 1.25; ctx.fillStyle = `rgba(205,195,205,${big ? 0.16 : 0.5})`; circle(x, y, big ? 7 * w.s : 1.4 * w.s); }
    else if (wth === 'snow') { const big = w.s > 1.25; ctx.fillStyle = `rgba(240,246,255,${big ? 0.22 : 0.88})`; circle(x, y, big ? 6 * w.s : 1.7 * w.s); }
    else if (wth === 'petals') { ctx.save(); ctx.translate(x, y); ctx.rotate(tick * 0.03 + w.p); ctx.fillStyle = w.p > 3 ? 'rgba(255,190,205,0.85)' : 'rgba(255,240,200,0.85)'; ctx.beginPath(); ctx.ellipse(0, 0, 3.4 * w.s, 1.4 * w.s, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    else {
      const tw = 0.5 + 0.5 * Math.sin(tick * 0.1 + w.p * 5);
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = `rgba(255,160,80,${(0.22 * tw).toFixed(3)})`; circle(x, y, 4.5 * w.s);
      ctx.fillStyle = `rgba(255,225,170,${(0.85 * tw).toFixed(3)})`; circle(x, y, 1.1 * w.s);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
}

// ---------- post-processing ----------
const dofC = document.createElement('canvas'); dofC.width = 480; dofC.height = 270;
const dctx = dofC.getContext('2d');
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
  if (practice) {
    text('PRACTICE ARENA', 18, 30, 18, '#bff0ff');
    const spar = practiceFoe === 'sparrer';
    text('1  DUMMY', 18, 52, 12, spar ? 'rgba(255,255,255,0.55)' : '#bff0ff');
    text('2  SPARRING PARTNER', 92, 52, 12, spar ? '#bff0ff' : 'rgba(255,255,255,0.55)');
    text(spar ? 'He attacks on a beat and his touches do not kill. Watch the glint on his point:' : 'The dummy stands still and comes back when cut down.', 18, 74, 12, '#c9a8d8');
    if (spar) text('match its height to block, parry it (O) then J at once, or hop back (SHIFT) and punish the miss.', 18, 90, 12, '#c9a8d8');
    text(spar ? `TOUCHES LANDED ${kills}   TAKEN ${touched}` : `DUMMIES CUT DOWN ${kills}`, CW - 18, 30, 14, '#c9a8d8', 'right');
    text('MENU or P: controls · T in the menu: leave', CW - 18, 50, 12, 'rgba(255,255,255,0.6)', 'right');
  } else {
    text(`${zi + 1}/${ZONES.length}  ${ZONES[zi].name.toUpperCase()}`, 18, 30, 18, '#f3ecdf');
    text(fmtTime(timeF), CW - 18, 30, 18, '#f3ecdf', 'right');
    text(`FALLEN ${deaths}   SLAIN ${kills}`, CW - 18, 54, 14, '#c9a8d8', 'right');
    if (buildsOn) {
      text(`THREAT ${zi + 1}`, CW - 18, 74, 13, zi >= 10 ? '#ff6a6a' : zi >= 5 ? '#ffa46a' : '#d8b890', 'right');
      drawRelicRow(18, 56, 18, 22);
      text(relicOrder.length ? 'TAB: BUILD' : '', 22 + relicOrder.length * 22, 69, 10, 'rgba(255,255,255,0.4)');
      if (wardLeft > 0 && rel('ward')) text('WARD ' + wardLeft, 18, 92, 11, '#ffe39a');
    }
  }
  for (let i = 0; i < (practice ? 0 : ZONES.length); i++) {
    ctx.fillStyle = i < zi ? '#4fd8ff' : i === zi ? '#ffffff' : 'rgba(255,255,255,0.25)';
    ctx.fillRect(18 + i * (ZONES.length > 12 ? 17 : 22), 42, ZONES.length > 12 ? 12 : 16, 5);
  }
  // stance pips
  const bx = 18, by = CH - 86;
  text(player.armed ? 'STANCE' : 'UNARMED', bx, by - 10, 13, player.armed ? '#9fdcf0' : '#ff8a8a');
  for (let i = 0; i < 3; i++) {
    const on = player.armed ? player.stance === i : player.pose === i;
    ctx.fillStyle = on ? (player.armed ? '#4fd8ff' : '#ff8a8a') : 'rgba(255,255,255,0.18)';
    ctx.fillRect(bx, by + i * 20, on ? 46 : 30, 12);
    text(player.armed ? STANCE_NAME[i] : ['RAISE  W', 'STAND', 'DUCK  S'][i], bx + 56, by + i * 20 + 11, 12, on ? '#ffffff' : 'rgba(255,255,255,0.4)');
  }
  // boss bars (two when brothers fight side by side)
  enemies.filter(e => e.T.boss && !e.dead).forEach((boss, bi) => {
    const bw = 360, x0 = CW / 2 - bw / 2, y0 = CH - 78 - bi * 34;
    text(boss.T.name, CW / 2, y0 - 8, 16, boss.T.accent, 'center', 1, SERIF);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(x0, y0, bw, 8);
    const seg = bw / boss.T.hp;
    for (let i = 0; i < boss.hp; i++) { ctx.fillStyle = boss.T.accent; ctx.fillRect(x0 + i * seg + 2, y0 + 1, seg - 4, 6); }
  });
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
  if (zi === 0) text('J THRUST · K THROW · L HEAVY · U SLASH · O PARRY · SPACE JUMP · SHIFT HOP/ROLL', CW / 2, CH - 46, 13, '#ffffff', 'center', 0.85);
  if (cleared && !offer && pickAt <= 0 && zi < ZONES.length - 1 && !player.dead && tick % 50 < 34) text('GO ➜', CW - 30, CH / 2, 30, '#4fd8ff', 'right');
  if (player.dead) {
    ctx.fillStyle = 'rgba(20,0,10,0.35)'; ctx.fillRect(0, 0, CW, CH);
    text('STRUCK DOWN', CW / 2, CH / 2, 44, '#ff6a7a', 'center', 1, SERIF);
  }
  if (offer) drawPick();
  else if (keys.build && buildsOn && !practice && state === 'play') drawBuild();
}

const CONTROL_LINES = [
  ['← →  or  A D   move', '↑ ↓  or  W S   raise / lower your blade'],
  ['J   thrust · hold to feint, W S switches line', 'U   slash (breaks any guard, short reach)'],
  ['L   heavy lunge (disarms a blade, kills past it)', 'O   parry, then J at once to riposte'],
  ['SPACE   jump · in air: ↓ + J plunge', 'SHIFT   hop back · with A D: roll · in air: dash'],
  ['K   throw your blade', 'walk over a loose sword to wield two'],
  ['E   hurl a nearby pot, stool or lantern', 'a hit stuns: close in and finish it'],
  ['unarmed:  J punch · midair J dive-kick', 'unarmed:  hold S duck · hold W rise'],
];
function drawControls(y0, dy) {
  const CW = W * S;
  CONTROL_LINES.forEach((l, i) => {
    text(l[0], CW / 2 - 20, y0 + i * dy, 15, '#ffffff', 'right');
    text(l[1], CW / 2 + 20, y0 + i * dy, 15, '#ffffff', 'left');
  });
}
// a small on-screen button (top centre) opens the pause menu with the controls; P and Esc do the same
const MENU_BTN = { x: W * S / 2 - 46, y: 12, w: 92, h: 24 };
function drawMenuButton(open) {
  const b = MENU_BTN;
  ctx.fillStyle = 'rgba(10,4,18,0.55)'; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  text(open ? '▶ RESUME' : '❚❚ MENU', b.x + b.w / 2, b.y + 17, 13, '#f3ecdf', 'center');
}
const PRACTICE_BTN = { x: W * S / 2 - 120, y: H * S - 68, w: 240, h: 30 };
function drawPracticeButton(label) {
  const b = PRACTICE_BTN;
  ctx.fillStyle = 'rgba(20,40,54,0.8)'; ctx.fillRect(b.x, b.y, b.w, b.h);
  ctx.strokeStyle = 'rgba(79,216,255,0.7)'; ctx.lineWidth = 1; ctx.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
  text(label, b.x + b.w / 2, b.y + 21, 15, '#bff0ff', 'center');
}
canvas.addEventListener('pointerdown', ev => {
  const r = canvas.getBoundingClientRect(), x = (ev.clientX - r.left) * (W * S) / r.width, y = (ev.clientY - r.top) * (H * S) / r.height, b = MENU_BTN;
  audioInit();
  if (offer && state === 'play') { for (let i = 0; i < 3; i++) { const q = pickRect(i); if (x >= q.x && x <= q.x + q.w && y >= q.y - 10 && y <= q.y + q.h) { if (pickSel === i || pickT > 12) pressed.pick = i + 1; pickSel = i; } } return; }
  if ((state === 'play' || state === 'paused') && x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 6) pressed.pause = true;
  const q = PRACTICE_BTN;
  if ((state === 'title' || state === 'paused') && x >= q.x && x <= q.x + q.w && y >= q.y && y <= q.y + q.h) pressed.practice = true;
});
function drawTitle() {
  const CW = W * S, CH = H * S;
  let g = ctx.createLinearGradient(0, 0, 0, CH);
  g.addColorStop(0, 'rgba(4,3,10,0.72)'); g.addColorStop(0.3, 'rgba(4,3,10,0.12)'); g.addColorStop(0.72, 'rgba(4,3,10,0)'); g.addColorStop(1, 'rgba(4,3,10,0.7)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, CW, CH);
  const tx = CW / 2;   // centred, in line with the practice button and the motto below
  text('RIPOSTE', tx + 4, 124, 104, 'rgba(0,0,0,0.6)', 'center', 1, SERIF);
  text('RIPOSTE', tx, 120, 104, '#f3ecdf', 'center', 1, SERIF);
  ctx.fillStyle = 'rgba(194,34,45,0.9)'; ctx.fillRect(tx - 150, 138, 300, 2);
  text('a duel to the bell', tx, 168, 22, '#bfe6f5', 'center', 1, SERIF);
  if (tick % 70 < 48) text('PRESS ENTER TO BEGIN', tx, 214, 18, '#ffe39a', 'center');
  drawPracticeButton('T   PRACTICE ARENA');
  text('One touch of steel is death, for them and for you.', CW / 2, CH - 18, 13, 'rgba(255,216,168,0.75)', 'center', 1, SERIF);
  text('M: mute   P in game: controls', CW - 14, CH - 12, 11, 'rgba(255,255,255,0.45)', 'right');
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
  if (relicOrder.length) { text('YOUR BUILD', CW / 2, 336, 12, 'rgba(255,255,255,0.6)', 'center', a); ctx.globalAlpha = a; drawRelicRow(CW / 2 - relicOrder.length * 16 + 3, 346, 26, 32); ctx.globalAlpha = 1; }
  if (winT > 90 && tick % 60 < 40) text('PRESS ENTER', CW / 2, CH - 50, 20, '#ffe39a', 'center');
}

// ---------- builds: icons, the choice of three, and the build sheet ----------
function relicGlyph(id) {      // drawn in a -1..1 box with the stroke and fill already set
  const L = (...q) => { ctx.beginPath(); ctx.moveTo(q[0], q[1]); for (let i = 2; i < q.length; i += 2) ctx.lineTo(q[i], q[i + 1]); ctx.stroke(); };
  const Fp = (...q) => { ctx.beginPath(); ctx.moveTo(q[0], q[1]); for (let i = 2; i < q.length; i += 2) ctx.lineTo(q[i], q[i + 1]); ctx.closePath(); ctx.fill(); };
  const O = (x, y, r, fill) => { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); if (fill) ctx.fill(); else ctx.stroke(); };
  const A = (x, y, r, a0, a1) => { ctx.beginPath(); ctx.arc(x, y, r, a0, a1); ctx.stroke(); };
  const Q = (...q) => { ctx.beginPath(); ctx.moveTo(q[0], q[1]); for (let i = 2; i < q.length; i += 4) ctx.quadraticCurveTo(q[i], q[i + 1], q[i + 2], q[i + 3]); ctx.stroke(); };
  const sw = (x0, y0, x1, y1) => { L(x0, y0, x1, y1); const dx = x1 - x0, dy = y1 - y0, n = Math.hypot(dx, dy), ux = dx / n, uy = dy / n; L(x0 + ux * 0.38 - uy * 0.24, y0 + uy * 0.38 + ux * 0.24, x0 + ux * 0.38 + uy * 0.24, y0 + uy * 0.38 - ux * 0.24); };
  switch (id) {
    case 'whetstone': sw(-0.75, 0.55, 0.7, -0.75); Fp(-0.05, 0.85, 0.8, 0.85, 0.8, 0.45, -0.05, 0.45); break;
    case 'boots': L(-0.25, -0.8, -0.25, 0.55, 0.7, 0.55, 0.7, 0.2, 0.25, 0.05, 0.25, -0.8); L(-0.9, 0, -0.5, 0); L(-0.9, 0.35, -0.5, 0.35); break;
    case 'wrist': sw(-0.6, 0, 0.85, 0); L(-0.9, -0.5, -0.1, -0.5); L(-0.9, 0.5, -0.1, 0.5); break;
    case 'spring': L(-0.7, 0.75, 0.5, 0.45, -0.5, 0.15, 0.5, -0.15, -0.5, -0.45, 0.7, -0.75); break;
    case 'steady': O(0, 0, 0.78); L(0, -0.48, 0, 0, 0.36, 0.22); break;
    case 'pommel': L(-0.75, 0.75, 0.15, -0.15); Fp(0, -0.8, 0.8, -0.2, 0.45, 0.2, -0.35, -0.4); break;
    case 'arm': Fp(-0.42, -0.45, 0.42, -0.45, 0.7, 0.1, 0.4, 0.82, -0.4, 0.82, -0.7, 0.1); L(-0.55, -0.72, 0.55, -0.72); break;
    case 'eye': Q(-0.9, 0, 0, -0.95, 0.9, 0, 0, 0.95, -0.9, 0); O(0, 0, 0.3, true); break;
    case 'rush': Fp(0, -0.88, 0.55, 0.22, 0.32, 0.72, -0.32, 0.72, -0.55, 0.22); break;
    case 'feather': L(-0.7, 0.82, 0.62, -0.72); L(-0.3, 0.38, -0.58, -0.12); L(0.02, 0.02, -0.26, -0.5); L(0.32, -0.36, 0.06, -0.82); L(-0.3, 0.38, 0.2, 0.52); L(0.02, 0.02, 0.52, 0.16); L(0.32, -0.36, 0.78, -0.2); break;
    case 'spare': sw(-0.75, 0.72, 0.45, -0.78); sw(0.75, 0.72, -0.45, -0.78); break;
    case 'lodestone': L(-0.55, 0.78, -0.55, -0.1); A(0, -0.1, 0.55, Math.PI, 0); L(0.55, -0.1, 0.55, 0.78); L(-0.82, 0.45, -0.28, 0.45); L(0.28, 0.45, 0.82, 0.45); break;
    case 'ghost': ctx.setLineDash([0.2, 0.16]); sw(-0.72, 0.72, 0.72, -0.72); ctx.setLineDash([]); break;
    case 'shadow': L(0.55, -0.62, 0.02, 0, 0.55, 0.62); L(-0.1, -0.62, -0.63, 0, -0.1, 0.62); break;
    case 'wing': L(-0.9, 0.3, -0.2, -0.62, 0.9, -0.42, 0.3, 0, 0.72, 0.2, 0.1, 0.3, 0.42, 0.62, -0.3, 0.42, -0.9, 0.3); break;
    case 'thunder': O(0, 0, 0.88); Fp(0.16, -0.7, -0.4, 0.08, -0.04, 0.08, -0.2, 0.7, 0.4, -0.16, 0.04, -0.16); break;
    case 'meteor': L(0, -0.9, 0, 0.1); Fp(-0.36, 0.02, 0.36, 0.02, 0, 0.56); L(-0.9, 0.82, -0.28, 0.82); L(0.28, 0.82, 0.9, 0.82); L(-0.58, 0.5, -0.82, 0.28); L(0.58, 0.5, 0.82, 0.28); break;
    case 'ward': L(-0.65, -0.72, 0.65, -0.72, 0.65, 0.1, 0, 0.86, -0.65, 0.1, -0.65, -0.72); L(0, -0.42, 0, 0.4); L(-0.3, -0.06, 0.3, -0.06); break;
    case 'flask': O(0, 0.28, 0.5); L(-0.15, -0.2, -0.15, -0.7, 0.15, -0.7, 0.15, -0.2); L(0.5, -0.6, 0.8, -0.86); L(0.62, -0.3, 0.92, -0.3); break;
    case 'dread': O(0, -0.15, 0.62); O(-0.23, -0.2, 0.14, true); O(0.23, -0.2, 0.14, true); L(-0.3, 0.42, -0.3, 0.82, 0.3, 0.82, 0.3, 0.42); L(0, 0.5, 0, 0.82); break;
    case 'guard': L(0.2, -0.85, 0.2, 0.85); L(-0.9, 0, 0.05, 0); Fp(0.08, 0, -0.26, -0.24, -0.26, 0.24); L(0.45, -0.3, 0.8, -0.55); L(0.45, 0.3, 0.8, 0.55); break;
    case 'echo': sw(-0.85, 0, 0.15, 0); A(0.05, 0, 0.38, -0.9, 0.9); A(0.05, 0, 0.64, -0.9, 0.9); A(0.05, 0, 0.9, -0.9, 0.9); break;
    case 'storm': A(-0.32, -0.38, 0.34, Math.PI * 0.6, Math.PI * 1.75); A(0.18, -0.5, 0.4, Math.PI * 1.1, Math.PI * 1.95); A(0.56, -0.3, 0.26, Math.PI * 1.4, Math.PI * 0.45); L(-0.5, -0.08, 0.66, -0.08); Fp(0.12, 0.02, -0.3, 0.5, 0, 0.5, -0.16, 0.92, 0.36, 0.3, 0.06, 0.3); break;
    case 'bell': Q(-0.62, 0.5, -0.56, -0.72, 0, -0.78, 0.56, -0.72, 0.62, 0.5); L(-0.78, 0.5, 0.78, 0.5); O(0, 0.74, 0.13, true); break;
    case 'mark': O(0, 0, 0.62); L(-0.95, 0, -0.3, 0); L(0.3, 0, 0.95, 0); L(0, -0.95, 0, -0.3); L(0, 0.3, 0, 0.95); break;
    case 'cloak': Q(0, -0.88, -0.72, -0.6, -0.72, 0.86); Q(0, -0.88, 0.72, -0.6, 0.72, 0.86); L(-0.72, 0.86, 0.72, 0.86); O(0, -0.28, 0.22, true); break;
  }
}
function drawRelicIcon(id, x, y, size, n = 1, alpha = 1) {     // x, y: top-left of the tile, in HUD space
  const r = RELIC[id], col = TIER_COL[r.tier];
  ctx.save(); ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(12,8,22,0.86)'; ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, size / 22); ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
  ctx.translate(x + size / 2, y + size / 2); ctx.scale(size * 0.36, size * 0.36);
  ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 0.15; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  relicGlyph(id);
  ctx.restore();
  if (n > 1) { const fs = Math.max(9, Math.round(size * 0.5)); text('x' + n, x + size + 1, y + size + 1, fs, '#000000', 'right', alpha); text('x' + n, x + size, y + size, fs, '#ffffff', 'right', alpha); }
}
const PICK = { w: 250, h: 286, gap: 26, y: 150 };
function pickRect(i) { const x0 = (W * S - (PICK.w * 3 + PICK.gap * 2)) / 2; return { x: x0 + i * (PICK.w + PICK.gap), y: PICK.y, w: PICK.w, h: PICK.h }; }
function drawPick() {
  const CW = W * S, CH = H * S, a = Math.min(1, pickT / 14);
  ctx.fillStyle = `rgba(6,3,12,${(0.9 * a).toFixed(3)})`; ctx.fillRect(0, 0, CW, CH);
  const boss = zoneBoss();
  text(boss ? 'A LEGEND FALLS: CLAIM A RELIC' : 'CHOOSE A RELIC', CW / 2, 96, 36, boss ? '#ffc84a' : '#ffe9c0', 'center', a, SERIF);
  text('one for every landing you clear  ·  take the same relic again and it grows stronger', CW / 2, 124, 13, '#c9a8d8', 'center', a);
  offer.forEach((id, i) => {
    const r = RELIC[id], q = pickRect(i), sel = i === pickSel, col = TIER_COL[r.tier], have = relics[id] || 0;
    const rise = (1 - Math.min(1, Math.max(0, (pickT - i * 4) / 12))) * 30, y = q.y + rise - (sel ? 8 : 0), al = a * Math.min(1, Math.max(0, (pickT - i * 4) / 10));
    ctx.globalAlpha = al;
    if (sel) { ctx.fillStyle = col; ctx.globalAlpha = al * (0.2 + 0.06 * Math.sin(tick * 0.12)); ctx.fillRect(q.x - 7, y - 7, q.w + 14, q.h + 14); ctx.globalAlpha = al; }
    const g = ctx.createLinearGradient(0, y, 0, y + q.h); g.addColorStop(0, '#1d1630'); g.addColorStop(1, '#0c0916');
    ctx.fillStyle = g; ctx.fillRect(q.x, y, q.w, q.h);
    ctx.strokeStyle = sel ? col : 'rgba(255,255,255,0.22)'; ctx.lineWidth = sel ? 2.5 : 1; ctx.strokeRect(q.x + 0.5, y + 0.5, q.w - 1, q.h - 1);
    ctx.globalAlpha = 1;
    text(String(i + 1), q.x + 14, y + 26, 16, 'rgba(255,255,255,0.55)', 'left', al);
    drawRelicIcon(id, q.x + q.w / 2 - 34, y + 26, 68, 1, al);
    text(TIER_NAME[r.tier], q.x + q.w / 2, y + 120, 12, col, 'center', al);
    text(r.name, q.x + q.w / 2, y + 150, 23, '#ffffff', 'center', al, SERIF);
    wrap(r.desc(have + 1), q.w - 36, 15, SERIF).forEach((l, k) => text(l, q.x + q.w / 2, y + 182 + k * 21, 15, '#e6dccb', 'center', al, SERIF));
    text(have ? `YOU HAVE ${have}  ->  ${have + 1}` : 'NEW', q.x + q.w / 2, y + q.h - 16, 12, have ? '#9fe8ff' : 'rgba(255,255,255,0.45)', 'center', al);
  });
  if (pickT > 25) text('A / D  choose      ENTER or J  take      or press 1, 2, 3', CW / 2, 476, 14, '#ffe3b0', 'center', 0.9);
  if (relicOrder.length) { text('YOUR BUILD', CW / 2, 502, 11, 'rgba(255,255,255,0.5)', 'center'); drawRelicRow(CW / 2 - relicOrder.length * 12, 508, 20, 24); }
}
function drawRelicRow(x, y, size, step) { relicOrder.forEach((id, i) => drawRelicIcon(id, x + i * step, y, size, relics[id])); }
function drawBuild() {
  const CW = W * S, CH = H * S;
  ctx.fillStyle = 'rgba(6,3,12,0.88)'; ctx.fillRect(0, 0, CW, CH);
  text('YOUR BUILD', CW / 2, 70, 34, '#ffe9c0', 'center', 1, SERIF);
  const k = threat();
  text(k ? `THREAT ${k + 1}:  foes react ${Math.round((1 - Math.max(0.6, 1 - 0.022 * k)) * 100)}% sooner, move ${Math.round(1.2 * k)}% faster` + (k >= 3 ? `, ${Math.round(Math.min(0.45, 0.06 * (k - 2)) * 100)}% are elites` : '') + (extraFoes() ? `, ${extraFoes()} more per landing` : '') : 'THREAT 1:  the foes have not yet begun to harden', CW / 2, 96, 13, '#ff9a8a', 'center');
  if (!relicOrder.length) { text('Nothing yet. Clear a landing and choose your first relic.', CW / 2, 250, 18, '#e6dccb', 'center', 1, SERIF); return; }
  const per = Math.ceil(relicOrder.length / 2), rowH = Math.min(50, 392 / Math.max(per, 1));
  relicOrder.forEach((id, i) => {
    const col = i < per ? 0 : 1, row = i < per ? i : i - per, x = 60 + col * 430, y = 122 + row * rowH, r = RELIC[id];
    drawRelicIcon(id, x, y, 34, relics[id]);
    text(r.name, x + 48, y + 14, 16, TIER_COL[r.tier], 'left', 1, SERIF);
    wrap(r.desc(relics[id]), 360, 12, SERIF).slice(0, rowH < 44 ? 1 : 2).forEach((l, q) => text(l, x + 48, y + 30 + q * 13, 12, '#d8cfc0', 'left', 1, SERIF));
  });
}

const rawSetTransform = CanvasRenderingContext2D.prototype.setTransform.bind(ctx);
function render() {
  const A = curAct();
  shX = shake > 0 ? rnd(-shake, shake) * 0.4 : 0; shY = shake > 0 ? rnd(-shake, shake) * 0.4 : 0;
  delete ctx.setTransform;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  // duel camera: every world-space transform below is scaled about the camera's view
  const V = camView();
  if (V.z > 1.001) {
    const ox = -V.x * K * V.z, oy = -V.y * K * V.z;
    ctx.setTransform = (a, b, c, d, e, f) => rawSetTransform(a * V.z, b * V.z, c * V.z, d * V.z, e * V.z + ox, f * V.z + oy);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
  const finK = fin ? Math.min(1, fin.t / 10) * Math.min(1, slowmo / 24) : 0;
  drawSky(A);
  drawLightning();
  drawFar(A);
  drawFogLayer(A, 86, 40, -0.035, 0.36, 0.14);            // slow mist between the mountains and the ruins
  drawRuins(A);
  drawShafts(A);
  drawFogLayer(A, 100, 42, 0.05, 0.55, 0.3);
  // depth of field: as the camera closes on a duel the backdrop falls out of focus
  if (BLOOM_OK && V.z > 1.03) {
    const dk = clamp((V.z - 1.03) / 0.4, 0, 1);
    dctx.globalCompositeOperation = 'copy'; dctx.filter = 'blur(1.7px)'; dctx.drawImage(canvas, 0, 0, dofC.width, dofC.height); dctx.filter = 'none';
    rawSetTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = dk; ctx.drawImage(dofC, 0, 0, RW, RH); ctx.globalAlpha = 1;
  }
  // the first instants of a lightning strike: white sky, everything else a black cut-out
  const storm = state === 'title' || (state === 'play' && ZONES[zi].weather === 'rain');
  // the killing blow: for a heartbeat the whole stage is one flat colour and the fighters are cut out in black
  const beat = !!fin && slowmo > 0 && fin.t >= 2 && fin.t <= 11;
  silh = beat || (storm && (lightning >= 8 || lightning === 5 || lightning === 4));
  if (silh) { rawSetTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = beat ? (fin.t <= 3 ? '#fff1e0' : 'rgba(178,14,28,0.97)') : 'rgba(214,227,255,0.8)'; ctx.fillRect(0, 0, RW, RH); }
  if (state === 'title') drawTitleTower(A);
  drawWorld(A);
  drawReflections();
  drawLights();
  drawCrows();
  if (state === 'title') {
    if (!titleHero) { titleHero = makeFighter(0, GROUND, 'player'); titleHero.onGround = true; }
    titleHero.x = camX + W * 0.33; titleHero.anim = tick; updateScarf(titleHero); updateCloth(titleHero);
    setLayer(1); drawFighter(titleHero);
  } else if (player) {
    if (finK > 0 && !beat) { // the stage falls dark behind a finishing blow
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = `rgba(10,0,4,${(0.5 * finK).toFixed(3)})`; ctx.fillRect(0, 0, RW, RH);
    }
    drawProps();
    drawSwords();
    setLayer(1);
    // in slow motion, glide bodies between simulation ticks
    const all = [player, ...enemies], t = slowmo > 0 && freeze <= 0 ? clamp(slowAcc, 0, 1) : 1;
    if (t < 1) for (const f of all) if (f.ox !== undefined) { f.rx = f.x; f.ry = f.y; f.x = f.ox + (f.x - f.ox) * t; f.y = f.oy + (f.y - f.oy) * t; }
    for (const e of enemies) if (e.dead) drawFighterFull(e);
    for (const e of enemies) if (!e.dead) drawFighterFull(e);
    drawFighterFull(player);
    if (t < 1) for (const f of all) if (f.rx !== undefined) { f.x = f.rx; f.y = f.ry; f.rx = undefined; }
  }
  drawParticles();
  drawBarrier();
  drawFogLayer(A, 128, 36, 0.12, 0.26, 1.1);
  drawForeground(A);
  drawWeather();
  delete ctx.setTransform;   // back to screen space
  post(A);
  if (finK > 0) { // blood-red edges while the blow lands
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const g = ctx.createRadialGradient(RW / 2, RH / 2, RH * 0.35, RW / 2, RH / 2, RW * 0.62);
    g.addColorStop(0, 'rgba(120,0,10,0)'); g.addColorStop(1, `rgba(120,0,10,${(0.5 * finK).toFixed(3)})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, RW, RH);
  }

  // HUD is laid out in a 960x540 space
  ctx.setTransform(K / S, 0, 0, K / S, 0, 0);
  if (state === 'title') drawTitle();
  else if (state === 'story') drawStory();
  else if (player) {
    drawHUD();
    if (fin && fin.t > 16 && slowmo > 0) { // the call of a clean hit
      const k = Math.min(1, (fin.t - 16) / 7), a = Math.min(1, slowmo / 20), cx = W * S / 2;
      const word = fin.boss ? 'COUP DE GRÂCE' : 'TOUCHÉ', size = (fin.boss ? 58 : 72) * (1 + (1 - k) * (1 - k) * 1.3);
      ctx.globalAlpha = 0.5 * a * k; ctx.fillStyle = '#12000a'; ctx.fillRect(0, 96, W * S, 4); ctx.fillRect(0, 186, W * S, 4);
      text(word, cx + 3, 168 + 3, size, '#2a0006', 'center', a * k, SERIF);
      text(word, cx, 168, size, '#d8182a', 'center', a * k, SERIF);
    }
    if (state === 'paused') {
      ctx.fillStyle = 'rgba(10,4,18,0.9)'; ctx.fillRect(0, 0, W * S, H * S);
      text('PAUSED', W * S / 2, 120, 48, '#ffffff', 'center', 1, SERIF);
      text('CONTROLS', W * S / 2, 168, 14, '#4fd8ff', 'center');
      drawControls(200, 25);
      text('A glint on a foe\'s point shows where the thrust will land. Match its height to block, parry it, or hop away.', W * S / 2, 388, 15, '#ffd8a8', 'center', 1, SERIF);
      text('P or ESC to resume  ·  R to restart  ·  M to mute' + (wardrobe.head ? '  ·  H to put your own hat back on' : ''), W * S / 2, 432, 15, '#c9a8d8', 'center');
      drawPracticeButton(practice ? 'T   LEAVE PRACTICE' : 'T   PRACTICE ARENA');
    }
    if ((state === 'play' && !offer) || state === 'paused') drawMenuButton(state === 'paused');
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
