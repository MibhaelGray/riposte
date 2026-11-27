// Injected into the running game page. Freezes the RAF loop and drives step() directly.
buildsOn = false;   // the older checks below test the bare game: no relics, no scaling. The builds block at the end turns them back on.
(async () => {
  window.requestAnimationFrame = () => 0;
  await new Promise(r => setTimeout(r, 50));
  const R = [];
  const ok = (name, cond, info = '') => R.push((cond ? 'PASS ' : 'FAIL ') + name + (info ? '  [' + info + ']' : ''));
  const run = n => { for (let i = 0; i < n; i++) { step(); } };
  const tap = code => { dispatchEvent(new KeyboardEvent('keydown', { code })); const snap = Object.assign({}, pressed); dispatchEvent(new KeyboardEvent('keyup', { code })); return snap; };
  const clearP = () => { for (const k in pressed) pressed[k] = false; };
  localStorage.removeItem('riposte.wardrobe'); wardrobe = {};

  // ---------- 1. key remaps ----------
  ok('J -> attack', tap('KeyJ').attack === true); clearP();
  ok('K -> throw', tap('KeyK').throw === true && !tap('KeyK').jump); clearP();
  ok('L -> heavy', tap('KeyL').heavy === true && !tap('KeyL').throw); clearP();
  ok('Space -> jump', tap('Space').jump === true); clearP();

  // real key press through the loop: K throws the sword
  newGame(0); enemies = []; queue = []; run(5);
  dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyK' })); step(); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyK' })); clearP();
  ok('K in play throws blade', !player.armed && projs.length === 1);
  newGame(0); enemies = []; queue = []; run(5); player.cool = 0;
  dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyL' })); step(); dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyL' })); clearP();
  ok('L in play starts heavy windup', player.windup > 0, 'windup=' + player.windup);

  // ---------- 2. heavy lunge ----------
  function duel(type, ps, es, gap) {
    newGame(0); queue = []; clearP();
    const e = makeFighter(player.x + gap, GROUND, 'enemy', type); e.onGround = true; enemies = [e];
    player.onGround = true; player.facing = 1; e.facing = -1;
    player.stance = player.prevStance = ps; e.stance = e.prevStance = es; e.react = 9999; e.cool = 9999;
    return e;
  }
  // crossed (same stance) -> disarm, not kill
  let e = duel('squire', 1, 1, 24);
  const origAI = aiInput; window.aiInput = () => ({}); // freeze AI so the test is deterministic
  player.cool = 0; pressed.heavy = true; step(); clearP();
  let killedSame = false, disarmedSame = false;
  for (let i = 0; i < 60; i++) { step(); if (e.dead) killedSame = true; if (!e.armed) disarmedSame = true; }
  ok('heavy lunge, same stance: disarms', disarmedSame);
  ok('heavy lunge, same stance: does not kill', !killedSame);
  // different stance -> passes harmlessly
  e = duel('squire', 0, 2, 24); window.aiInput = () => ({});
  player.cool = 0; pressed.heavy = true; step(); clearP();
  let killedDiff = false, disarmedDiff = false, lungeSeen = false;
  for (let i = 0; i < 60; i++) { step(); if (player.heavyL) lungeSeen = true; if (!e.armed && !e.dead) disarmedDiff = true; if (e.dead) killedDiff = true; }
  ok('heavy lunge, diff stance: lunge happened', lungeSeen);
  ok('heavy lunge, diff stance: kills', killedDiff);
  ok('heavy lunge, diff stance: no disarm', !disarmedDiff);
  for (const [a, b] of [[1, 0], [1, 2], [2, 1], [0, 1], [2, 0]]) {
    e = duel('squire', a, b, 24); window.aiInput = () => ({});
    player.cool = 0; pressed.heavy = true; step(); clearP();
    let k = false; for (let i = 0; i < 60; i++) { step(); if (e.dead) k = true; }
    ok('heavy lunge kills past a blade at another height (' + a + ' vs ' + b + ')', k);
  }
  // a foe who reads the wind-up parries the lunge instead of dying to it
  window.aiInput = origAI;
  e = duel('duelist', 0, 2, 24); e.cool = 0; e.react = 0; e.readW = true; e.dodgeW = true; e.rollCd = 999;
  player.cool = 0; pressed.heavy = true; step(); clearP();
  let readDied = false, pStunned = false;
  for (let i = 0; i < 40; i++) { e.readW = true; e.dodgeW = true; e.cool = player.windup > 4 ? 9999 : Math.min(e.cool, 30) > 26 ? 0 : e.cool > 1000 ? 0 : e.cool; step(); if (e.dead) readDied = true; if (player.stun > 0) pStunned = true; }
  ok('foe who reads the heavy lunge parries it', !readDied && pStunned);
  window.aiInput = () => ({});
  // normal thrust still kills
  e = duel('squire', 0, 2, 22); window.aiInput = () => ({});
  player.cool = 0; pressed.attack = true; step(); clearP(); run(20);
  ok('normal thrust, diff stance: still kills', e.dead);
  window.aiInput = origAI;

  // ---------- 3. dual wield ----------
  newGame(0); enemies = []; queue = [];
  swords.push({ x: player.x, y: player.y - 1, vx: 0, vy: 0, onGround: true, age: 30 }); run(3);
  ok('armed player picks up 2nd sword', player.offhand && swords.length === 0);
  const hit = player.offhand; kill(player, 1);
  ok('2nd blade absorbs a killing blow', hit && !player.dead && !player.offhand && player.armed, 'dead=' + player.dead);
  ok('absorbed blade is dropped as loose sword', swords.length === 1);
  run(60); player.invuln = 0; kill(player, 1);
  ok('next blow kills normally', player.dead);
  // enemy pickup must not dual-wield
  newGame(0); queue = []; e = makeFighter(player.x + 100, GROUND, 'enemy', 'squire'); enemies = [e];
  swords.push({ x: e.x, y: e.y - 1, vx: 0, vy: 0, onGround: true, age: 30 }); window.aiInput = () => ({}); run(3); window.aiInput = origAI;
  ok('enemies cannot dual-wield', !e.offhand && swords.length === 1);
  // throw with two blades keeps main
  newGame(0); enemies = []; queue = []; run(5); player.offhand = true; player.cool = 0; pressed.throw = true; step(); clearP();
  ok('throw with two blades keeps one', player.armed && !player.offhand && projs.length === 1);
  // disarm with two blades only strips the off-hand
  newGame(0); enemies = []; queue = []; player.offhand = true; disarm(player, { x: player.x + 10 });
  ok('disarm strips off-hand first', player.armed && !player.offhand);
  // thrust cooldown
  newGame(0); enemies = []; queue = []; run(5); player.offhand = true; player.cool = 0; pressed.attack = true; step(); clearP(); for (let i = 0; i < 8 && !player.lunge; i++) step();
  ok('dual thrust cooldown 12', player.cool === 11 || player.cool === 12, 'cool=' + player.cool);
  // real fight: off-hand player stands still vs real AI duelist; count off-hand saves
  let saves = 0, deathsAt = null; window.__dbg = [];
  newGame(0); run(200);
  for (let trial = 0; trial < 5; trial++) {
    if (player.dead || !enemies.length) { newGame(0); run(200); }
    player.offhand = true; player.invuln = 0; let had = true;
    for (let i = 0; i < 900 && !player.dead; i++) { step(); if (had && !player.offhand && !player.dead) { saves++; had = false; } }
    window.__dbg.push({ dead: player.dead, px: player.x|0, en: enemies.map(x => [x.type, x.x|0, x.dead]), zi });
  }
  ok('real AI hit is absorbed by 2nd blade', saves > 0, 'saves=' + saves);

  // ---------- 4. loot ----------
  newGame(0); queue = []; Math._r = Math.random;
  let drops = 0;
  for (let i = 0; i < 40; i++) { e = makeFighter(player.x + 60, GROUND, 'enemy', 'acolyte'); enemies = [e]; loot = []; kill(e, 1); drops += loot.length; }
  ok('regular enemy drop rate ~55%', drops > 10 && drops < 35, drops + '/40');
  e = makeFighter(player.x + 60, GROUND, 'enemy', 'warden'); e.hp = 1; enemies = [e]; loot = []; kill(e, 1);
  ok('boss always drops', loot.length === 1 && e.T.boss === true, 'boss=' + e.T.boss);
  const missing = Object.keys(COSMETICS).filter(t => !ZONES.some(z => z.enemies.includes(t)));
  ok('every cosmetic source enemy appears in a zone', missing.length === 0, missing.join(','));
  // pick up crown via physics
  newGame(0); enemies = []; queue = [];
  loot.push({ x: player.x + 4, y: player.y - 30, vx: 0, vy: 0, onGround: false, age: 0, c: COSMETIC_BY_ID.warden_cape }); run(60);
  ok('loot falls and is picked up', loot.length === 0 && wardrobe.cape === 'warden_cape');
  ok('worn item shows in player look', lookOf(player).cape === '#5c1218');
  loot.push({ x: player.x, y: player.y - 2, vx: 0, vy: 0, onGround: true, age: 30, c: COSMETIC_BY_ID.gaoler_cape }); run(3);
  const L = lookOf(player);
  ok('a slot swaps (new cape replaces old)', L.cape === '#3c1d10');
  ok('wardrobe persisted', JSON.parse(localStorage.getItem('riposte.wardrobe')).cape === 'gaoler_cape');
  respawn();
  ok('outfit survives respawn', lookOf(player).cape === '#3c1d10');
  wardrobe.head = 'duelist_hat'; ok('old saved headwear never hides the plumed hat', lookOf(player).cavalier === '#c2222d' && lookOf(player).feather === '#f3b91f'); delete wardrobe.head;
  let headDrops = 0; for (let i = 0; i < 60; i++) { const q = makeFighter(player.x + 60, GROUND, 'enemy', ['squire', 'duelist', 'shade', 'warden'][i % 4]); q.hp = 1; enemies = [q]; loot = []; kill(q, 1); slowmo = 0; fin = null; if (loot.some(l => l.c.slot === 'head')) headDrops++; }
  ok('headwear no longer drops', headDrops === 0);
  // render every cosmetic without throwing
  let renderErr = '';
  for (const id in COSMETIC_BY_ID) { try { equip(COSMETIC_BY_ID[id]); render(); } catch (x) { renderErr += id + ':' + x.message + ' '; } }
  ok('every cosmetic renders', !renderErr, renderErr);
  localStorage.removeItem('riposte.wardrobe'); wardrobe = {};

  // ---------- 5. full playthrough (god-mode bot cuts down each zone, then walks on) ----------
  newGame(0); let stuck = '', errs = '';
  try {
    for (let z = 0; z < ZONES.length && state === 'play'; z++) {
      let t = 0;
      while (zi === z && state === 'play' && t < 4000) {
        t++; player.invuln = 5; if (player.onGround && ((t % 25 === 0 && groundBelow(player.x + 50, player.y) && groundBelow(player.x + 66, player.y)) || !groundBelow(player.x + 5, player.y))) pressed.jump = true;   // hops as it goes (never blind into a pit), and always jumps at a brink
        for (const en of enemies) if (!en.dead && t % 40 === 0) { en.invuln = 0; kill(en, 1); }
        keys.right = true; step();
      }
      if (t >= 4000) { stuck = 'zone ' + z + ' (' + ZONES[z].name + ') q=' + queue.length + ' e=' + enemies.filter(x=>!x.dead).length + ' x=' + player.x.toFixed(0); break; }
    }
    keys.right = false;
  } catch (x) { errs = x.message + ' @ zone ' + zi; }
  ok('playthrough reaches win state', state === 'win' && !stuck && !errs, 'state=' + state + ' ' + stuck + errs + ' kills=' + kills);
  // render each zone
  let zr = '';
  for (let z = 0; z < ZONES.length; z++) { try { newGame(z); run(30); render(); } catch (x) { zr += z + ':' + x.message + ' '; } }
  ok('every zone renders', !zr, zr);

  window.__results = R.join('\n');
})();
// ===== camera / finisher / gore checks (appended) =====
window.__results2 = null;
(async () => {
  for (let i = 0; i < 400 && !window.__results; i++) await new Promise(r => setTimeout(r, 100));
  const R = []; const ok = (n, c, info = '') => R.push((c ? 'PASS ' : 'FAIL ') + n + (info ? '  [' + info + ']' : ''));
  const run = n => { for (let i = 0; i < n; i++) step(); };
  const origAI = aiInput; window.aiInput = () => ({});
  const spawn = (dx, type = 'squire') => { const e = makeFighter(player.x + dx, GROUND, 'enemy', type); e.onGround = true; return e; };
  // zoom in when close, out when alone
  newGame(0); queue = []; enemies = [spawn(34)]; run(240);
  ok('camera zooms in on a close duel', cam.z > 1.4 && cam.z <= 1.6, 'z=' + cam.z.toFixed(2));
  let v = camView();
  ok('zoomed view stays inside the screen', v.x >= 0 && v.y >= 0 && v.x + W / v.z <= W + 1e-6 && v.y + H / v.z <= H + 1e-6);
  const sx = (player.x - camX - v.x) * v.z, ex = (enemies[0].x - camX - v.x) * v.z;
  ok('both fighters are in frame', sx > 10 && sx < W - 10 && ex > 10 && ex < W - 10, sx.toFixed(0) + ',' + ex.toFixed(0));
  enemies[0].x = player.x + 240; run(300);
  ok('camera pulls back for a distant foe', cam.z < 1.05, 'z=' + cam.z.toFixed(2));
  // two foes: far one keeps the camera wide
  enemies = [spawn(30), spawn(250)]; run(300);
  ok('a far second foe keeps the camera wide', cam.z < 1.05, 'z=' + cam.z.toFixed(2));
  // non-final kill: no slow motion
  kill(enemies[0], 1);
  ok('non-final kill: no slow motion', slowmo === 0 && !fin);
  ok('kill leaves blood on the killer blade', player.bloody > 0);
  // final kill: slow motion + close-up
  const before = parts.length; kill(enemies[1], 1);
  ok('final kill starts the finisher', slowmo > 100 && !!fin && parts.length > before + 30, 'slowmo=' + slowmo);
  let maxZ = 0, ticks0 = tick, frames = 0, renderErr = '';
  while (slowmo > 0 && frames < 1000) { step(); frames++; maxZ = Math.max(maxZ, cam.z); if (frames % 10 === 0) { try { render(); } catch (x) { renderErr = x.message; } } }
  ok('finisher zooms to a close-up', maxZ > 1.8, 'maxZ=' + maxZ.toFixed(2));
  ok('finisher renders without errors', !renderErr, renderErr);
  ok('slow motion ends and clears', slowmo === 0 && fin === null, 'frames=' + frames);
  ok('time really slowed', (tick - ticks0) < frames * 0.5, (tick - ticks0) + ' ticks in ' + frames + ' frames');
  ok('zone is marked cleared after finisher', cleared === true);
  run(400);
  ok('camera returns to normal after the finisher', cam.z === 1, 'z=' + cam.z);
  ok('canvas transform hook is removed', !Object.prototype.hasOwnProperty.call(ctx, 'setTransform'));
  // input during slow motion is not lost
  newGame(0); queue = []; enemies = [spawn(60)]; run(20); kill(enemies[0], 1);
  run(30); const y0 = player.y; dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' })); dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
  let jumped = false; for (let i = 0; i < 40; i++) { step(); if (player.y < y0 - 1) jumped = true; }
  ok('key pressed during slow motion still registers', jumped);
  // boss finisher
  newGame(ZONES.findIndex(z => z.enemies.includes('warden'))); queue = []; const b = spawn(40, 'warden'); b.hp = 1; enemies = [b]; run(10); kill(b, 1);
  ok('boss kill gets the long finisher', slowmo > 150 && fin && fin.boss);
  frames = 0; while (slowmo > 0 && frames < 1500) { step(); frames++; if (frames % 15 === 0) render(); }
  ok('boss finisher ends', slowmo === 0 && !fin);
  // player death: no slow motion, respawn works
  newGame(0); queue = ['squire']; enemies = [spawn(30)]; run(10); kill(player, -1);
  ok('player death: no slow motion', slowmo === 0 && player.dead);
  run(200); ok('player respawns', !player.dead);
  // particle cap holds under heavy gore
  newGame(0); queue = []; for (let i = 0; i < 60; i++) { const e = spawn(30); enemies = [e]; kill(e, 1); slowmo = 0; fin = null; }
  run(20); ok('particle count stays capped', parts.length <= 1200, 'parts=' + parts.length);
  window.aiInput = origAI;
  window.__results2 = R.join('\n');
})();
// ===== visual-effects checks (appended) =====
window.__results3 = null;
(async () => {
  for (let i = 0; i < 600 && !window.__results2; i++) await new Promise(r => setTimeout(r, 100));
  const R = []; const ok = (n, c, info = '') => R.push((c ? 'PASS ' : 'FAIL ') + n + (info ? '  [' + info + ']' : ''));
  const run = n => { for (let i = 0; i < n; i++) step(); };
  const origAI = aiInput;
  const spawn = (dx, type = 'squire') => { const e = makeFighter(player.x + dx, GROUND, 'enemy', type); e.onGround = true; return e; };
  // sky position: follows the zones and never goes backwards
  let mono = true; for (let i = 1; i < SKY_POS.length; i++) if (SKY_POS[i] < SKY_POS[i - 1]) mono = false;
  ok('sky only moves forward through the climb', mono && SKY_POS.length === ZONES.length);
  newGame(0); ok('zone 1 starts at sunset', skyPos === 0 && curAct().suns.length === 1 && curAct().suns[0].a === 1);
  newGame(ZONES.findIndex(q => q.act === 1)); const a4 = curAct(); ok('storm act keeps rain-slick floor', a4.wet === true && !a4.grass, 'sky=' + skyPos);
  newGame(ZONES.length - 1); const s0 = skyPos, y0 = curAct().suns.find(q => q.a > 0).y;
  player.x = BELL_X - 20; run(200); const s1 = skyPos, y1 = curAct().suns[curAct().suns.length - 1].y;
  ok('dawn breaks as you walk to the bell', s0 < ACTS.length - 1.3 && s1 > ACTS.length - 1.1 && y1 < y0, s0.toFixed(2) + '->' + s1.toFixed(2) + ' sunY ' + y0.toFixed(0) + '->' + y1.toFixed(0));
  player.x = BELL_X; run(5); ok('reaching the bell wins', state === 'win');
  run(430); ok('sun keeps rising after the bell', dawnExtra === 1 && curAct().suns[curAct().suns.length - 1].y < y1);
  let err = ''; try { render(); } catch (x) { err = x.message; } ok('win screen renders', !err, err);
  // palettes are valid colours at every point of the journey
  let bad = '';
  for (let p = 0; p <= ACTS.length - 0.999; p += 0.05) { const A = blendAct(p, ACTS[0]); for (const k of ['far', 'mid', 'near', 'ground', 'rim', 'banner', 'fg', ...A.sky.map((_, i) => 'sky' + i)]) { const v = k.startsWith('sky') ? A.sky[+k.slice(3)] : A[k]; if (!/^#[0-9a-f]{6}$/.test(v)) bad += p.toFixed(2) + ':' + k + '=' + v + ' '; } if (!/^rgba\(\d+,\d+,\d+,[\d.]+\)$/.test(A.grade) || !/^\d+,\d+,\d+$/.test(A.haze)) bad += p.toFixed(2) + ':grade/haze '; }
  ok('blended palettes are valid colours', !bad, bad.slice(0, 120));
  // clash throws a light that lights the fighters
  window.aiInput = () => ({});
  newGame(0); queue = []; enemies = [spawn(20)]; run(10); lights.length = 0; clash(player, enemies[0]);
  ok('a clash throws a flash of light', lights.length === 1 && lightFor(player).flash === true);
  run(30); ok('the flash fades', lights.length === 0 && !lightFor(player).flash);
  // banners: a slash cuts one, the scrap falls
  newGame(0); queue = []; enemies = []; run(5);
  const b = banners.find(q => q.x > 0 && q.x < ZW); player.x = b.x - 6; player.cool = 0; pressed.slash = true; step(); for (const k in pressed) pressed[k] = false; run(14);
  ok('a slash cuts a banner', b.cut && b.len < BANNER_LEN && scraps.length === 1, 'len=' + b.len.toFixed(1));
  run(500); ok('the cut scrap lands and fades', scraps.length === 0);
  newGame(0); ok('banners are whole again in a new game', banners.every(q => !q.cut && q.len === BANNER_LEN));
  // crows
  let withCrows = 0; for (let i = 0; i < 12; i++) { newGame(1); if (crows.length) withCrows++; }
  ok('crows perch in zones', withCrows >= 9, withCrows + '/12');
  for (let i = 0; i < 20 && !crows.length; i++) newGame(1);
  queue = []; enemies = [spawn(200)]; const n0 = crows.filter(c => !c.fly).length; kill(enemies[0], 1); slowmo = 0; fin = null;
  ok('a kill scatters the crows', n0 > 0 && crows.every(c => c.fly), 'perched before=' + n0);
  run(400); ok('scattered crows leave the screen', crows.length === 0, 'left=' + crows.length);
  // torch flame leans when a fighter rushes past
  newGame(0); queue = []; enemies = []; run(5); const t0 = torches.find(t => t > 0 && t < ZW); player.x = t0 - 8; let maxLean = 0;
  for (let i = 0; i < 20; i++) { player.vx = 3; keys.right = true; step(); maxLean = Math.max(maxLean, Math.abs((torchLean[t0] || { x: 0 }).x)); }
  keys.right = false; ok('torch flame leans as you rush past', maxLean > 0.4, 'lean=' + maxLean.toFixed(2));
  run(120); ok('flame settles again', Math.abs(torchLean[t0].x) < 0.05);
  // rain: ripples and lightning silhouettes
  newGame(ZONES.findIndex(z => z.weather === 'rain')); queue = []; enemies = [spawn(40)]; run(30);
  ok('rain makes ripples', ripples.length > 20 && ripples.length <= 90, 'n=' + ripples.length);
  err = ''; try { for (const L of [10, 9, 8, 7, 5, 4, 2, 0]) { lightning = L; render(); if (L === 9 && !silh) err = 'no silhouette at strike'; if (L === 7 && silh) err = 'silhouette too long'; } } catch (x) { err = x.message; }
  ok('lightning silhouette frames render', !err, err);
  newGame(0); lightning = 9; render(); ok('no silhouettes outside the storm', silh === false); lightning = 0;
  // blade trail
  newGame(0); queue = []; enemies = []; run(5); player.cool = 0; pressed.slash = true; step(); for (const k in pressed) pressed[k] = false;
  for (let i = 0; i < 10; i++) { step(); render(); }
  ok('a slash leaves a blade trail', player.trail && player.trail.length >= 5, 'n=' + (player.trail && player.trail.length));
  // soak: real AI fights in every zone, rendering every frame, with forced effects
  window.aiInput = origAI; err = '';
  for (let z = 0; z < ZONES.length && !err; z++) {
    try {
      newGame(z);
      for (let i = 0; i < 420; i++) {
        player.invuln = 5; keys.right = (i % 120) < 50; keys.left = (i % 120) > 85;
        if (i % 37 === 0) pressed.attack = true; if (i % 91 === 0) pressed.slash = true; if (i % 133 === 0) pressed.heavy = true; if (i % 77 === 0) pressed.jump = true;
        if (i === 200 && ZONES[z].weather === 'rain') lightning = 10;
        if (i === 260) for (const e of enemies) if (!e.dead) { e.invuln = 0; e.hp = 1; kill(e, 1); break; }
        step(); render();
      }
      keys.right = keys.left = false;
    } catch (x) { err = 'zone ' + z + ': ' + x.message + ' ' + (x.stack || '').split('\n')[1]; }
  }
  ok('every zone survives a rendered fight', !err, err);
  ok('canvas hook removed after soak', !Object.prototype.hasOwnProperty.call(ctx, 'setTransform'));
  // frame cost
  newGame(3); queue = ['squire', 'thrower']; run(200); const tA = performance.now(); for (let i = 0; i < 60; i++) { step(); render(); } const ms = (performance.now() - tA) / 60;
  ok('a frame in the storm act stays cheap', ms < 8, ms.toFixed(2) + ' ms');
  state = 'title'; err = ''; try { for (let i = 0; i < 30; i++) { step(); render(); } } catch (x) { err = x.message; } ok('title screen renders', !err, err);
  localStorage.removeItem('riposte.wardrobe');
  window.__results3 = R.join('\n');
})();

// ===== combat-flow checks (appended) =====
window.__results4 = null;
(async () => {
  for (let i = 0; i < 900 && !window.__results3; i++) await new Promise(r => setTimeout(r, 100));
  const R = []; const ok = (n, c, info = '') => R.push((c ? 'PASS ' : 'FAIL ') + n + (info ? '  [' + info + ']' : ''));
  const run = n => { for (let i = 0; i < n; i++) step(); };
  const clearP = () => { for (const k in pressed) pressed[k] = false; };
  const press = k => { pressed[k] = true; step(); clearP(); };
  const origAI = aiInput; window.aiInput = () => ({});
  const solo = () => { newGame(0); queue = []; enemies = []; run(5); clearP(); };
  const pair = (gap, ps, es) => { newGame(0); queue = []; clearP(); const e = makeFighter(player.x + gap, GROUND, 'enemy', 'squire'); e.onGround = true; e.facing = -1; enemies = [e]; player.onGround = true; player.facing = 1; player.stance = player.prevStance = ps; e.stance = e.prevStance = es; return e; };
  // --- input buffer ---
  solo(); player.cool = 3; press('attack');
  ok('early press is not dropped', player.lunge === 0);
  run(9); ok('...it comes out when recovery ends', player.lunge > 0, 'lunge=' + player.lunge);
  solo(); player.cool = 30; press('attack'); run(20);
  ok('a press far too early is forgotten', player.lunge === 0 && bufAct === null);
  solo(); freeze = 9; press('attack'); ok('nothing moves during hit-stop', player.lunge === 0);
  run(14); ok('a press during hit-stop comes out after it', player.lunge > 0, 'lunge=' + player.lunge);
  solo(); player.cool = 4; press('attack'); press('slash'); run(5);
  ok('the latest press wins', player.slash > 0 && player.lunge === 0);
  solo(); press('attack'); run(40); ok('one press gives one thrust', player.lunge === 0 && bufAct === null);
  solo(); player.vy = 1; player.y = GROUND - 4; player.onGround = false; press('jump'); let jumped = false; for (let i = 0; i < 8; i++) { step(); if (player.vy < -3) jumped = true; }
  ok('jump pressed just before landing still jumps', jumped);
  solo(); press('attack'); newGame(0); ok('buffer is cleared by a new game', bufAct === null && bufJump === 0);
  // --- recovery ---
  solo(); press('attack'); for (let i = 0; i < 8 && !player.lunge; i++) step(); const c1 = player.cool; ok('player thrust recovery 16', c1 === 15 || c1 === 16, 'cool=' + c1);
  solo(); press('slash'); ok('player slash recovery 22', player.cool === 21 || player.cool === 22, 'cool=' + player.cool);
  solo(); press('parry'); ok('player parry recovery 20', player.cool === 19 || player.cool === 20, 'cool=' + player.cool);
  let e = pair(200, 1, 1); control(e, { attackP: true }); ok('an enemy thrust starts with a wind-up, not a hit', e.prep === 26 && e.lunge === 0, 'prep=' + e.prep); let wf = 0; while (!e.lunge && wf < 60) { control(e, {}); wf++; } ok('...that lasts its full tell before the blade flies', wf === 26, 'frames=' + wf); ok('enemy thrust recovery unchanged (24)', e.cool === 24);
  e = pair(200, 1, 1); control(e, { slashP: true }); ok('enemy slash recovery unchanged (30)', e.cool === 30);
  e = pair(200, 1, 1); control(e, { parryP: true }); ok('enemy parry recovery unchanged (26)', e.cool === 26);
  // --- roll on its own timer ---
  const pressRoll = () => { keys.right = true; press('roll'); keys.right = false; };
  solo(); press('attack'); run(8); const cBefore = player.cool; pressRoll();
  ok('you can roll out of a thrust recovery', player.roll > 0 && cBefore > 0, 'cool was ' + cBefore);
  run(18); pressRoll(); ok('...but not roll again at once', player.roll === 0, 'rollCd=' + player.rollCd);
  run(14); pressRoll(); ok('roll is back after its own timer', player.roll > 0);
  solo(); pressRoll(); run(17); press('attack'); run(5); ok('you can thrust straight out of a roll', player.lunge > 0);
  e = pair(200, 1, 1); e.cool = 10; control(e, { rollP: true }); ok('enemies still cannot roll mid-recovery', e.roll === 0);
  // --- simultaneous hits clash ---
  e = pair(12, 0, 2); const l0 = lights.length; run(2);
  ok('point-blank at different heights: steel rings, nobody dies', !player.dead && !e.dead && lights.length > l0);
  run(30); ok('...and the clash pushes them apart', Math.abs(e.x - player.x) > 20 && !player.dead && !e.dead, 'gap=' + Math.abs(e.x - player.x).toFixed(1));
  ok('both are free again right after a clash', player.cool === 0 && e.cool === 0);
  let stuck = 0; e = pair(12, 0, 2); for (let i = 0; i < 300; i++) { keys.right = true; step(); if (freeze > 0) stuck++; } keys.right = false;
  ok('walking into a blade does not lock the game in hit-stop', stuck < 150 && !player.dead, 'frozen frames=' + stuck + '/300');
  e = pair(23, 0, 2); press('attack'); run(14); ok('a thrust from range still kills', e.dead && !player.dead);
  e = pair(23, 0, 2); e.cool = 0; control(e, { attackP: true }); run(45); ok('an enemy thrust from range still kills you', player.dead);
  e = pair(32, 0, 2); pressed.attack = true; control(e, { attackP: true }); step(); clearP(); let both = false; for (let i = 0; i < 20; i++) { step(); if (player.dead && e.dead) both = true; }
  ok('thrusting into each other is no longer a double death', !both && !(player.dead && e.dead), 'p=' + player.dead + ' e=' + e.dead);
  // --- parry -> riposte through the hit-stop ---
  const lateParry = () => { control(e, { attackP: true }); for (let i = 0; i < 60 && e.prep > 2; i++) step(); press('parry'); };
  e = pair(34, 1, 0); lateParry(); let parried = false, pressedDuring = false;
  for (let i = 0; i < 30; i++) { if (freeze > 4 && !pressedDuring && e.stun > 0) { pressed.attack = true; pressedDuring = true; parried = true; } keys.right = parried; step(); clearP(); if (e.dead) break; }
  keys.right = false;
  ok('parry, then step in and stab (pressed during the freeze) kills', parried && e.dead && !player.dead, 'parried=' + parried + ' dead=' + e.dead);
  // --- parries flow both ways ---
  e = pair(34, 1, 0); lateParry(); parried = false; pressedDuring = false;
  for (let i = 0; i < 30; i++) { if (freeze > 4 && !pressedDuring && e.stun > 0) { pressed.attack = true; pressedDuring = true; parried = true; } step(); clearP(); if (e.dead) break; }
  ok('parry then stab kills without stepping in', parried && e.dead && !player.dead, 'parried=' + parried + ' dead=' + e.dead);
  e = pair(24, 1, 0); e.parry = 10; press('attack'); let wasStunned = 0; for (let i = 0; i < 14 && !(player.stun > 0); i++) step(); wasStunned = player.stun;
  ok('being parried is a short stagger, not a cutscene', wasStunned > 0 && wasStunned <= 12 && player.cool <= 14, 'stun=' + wasStunned + ' cool=' + player.cool);
  ok('...and the foe who parried you means to riposte', e.riposteE > 0);
  const tf0 = timeF; for (let i = 0; i < 60 && (player.stun > 0 || player.cool > 0); i++) step(); const backIn = timeF - tf0; press('parry'); ok('...and you recover in time to parry that riposte', player.parry > 0 && backIn <= 15, 'stun=' + player.stun + ' cool=' + player.cool);
  const xx = player.x; keys.left = true; run(10); keys.left = false;
  ok('...and you can move again', player.x < xx - 3, 'moved ' + (xx - player.x).toFixed(1));
  e = pair(30, 1, 0); control(e, { attackP: true }); for (let i = 0; i < 60 && e.prep > 2; i++) step(); player.parry = 10; for (let i = 0; i < 14 && !(e.stun > 0); i++) step();
  ok('a parried enemy reels briefly and you get a riposte', e.stun >= 20 && e.stun <= 30 && player.riposteT > 0, 'stun=' + e.stun + ' rip=' + player.riposteT);
  // --- less waiting ---
  window.aiInput = origAI;
  newGame(1); let f0 = 0; while (!enemies.length && f0 < 400) { step(); f0++; } let e1 = enemies[0];
  ok('first foe appears on the ground at the far end', e1 && Math.abs(e1.x - player.x) > 200 && e1.y === GROUND, 'gap=' + (e1 ? Math.abs(e1.x - player.x).toFixed(0) : '-'));
  let pitOk = true, zoneOk = true;
  for (const z of ['The Broken Span', 'The Cistern', 'Shadow Stair', 'The Casting Floor'].map(n => ZONES.findIndex(q => q.name === n))) for (const px of [50, 100, 130, 180, 200, 260]) { newGame(z); player.x = z * ZW + px; queue = ['squire']; spawnT = 1; step(); const q = enemies[0]; if (!q || !solidAt(q.x, GROUND + 1)) pitOk = false; if (q && (q.x < z * ZW + 20 || q.x > (z + 1) * ZW - 20)) zoneOk = false; }
  ok('foes never drop into a pit', pitOk); ok('foes drop inside the zone', zoneOk);
  const hk = ZONES.findIndex(q => q.name === 'Hall of Knives'); newGame(hk); player.x = hk * ZW + 60; queue = ['thrower']; spawnT = 1; step(); ok('knifers still appear at the far wall', Math.abs(enemies[0].x - player.x) > 200, 'gap=' + Math.abs(enemies[0].x - player.x).toFixed(0));
  window.aiInput = () => ({});
  newGame(1); queue = ['squire', 'squire']; spawnT = 1; step(); kill(enemies[0], 1); slowmo = 0; fin = null; let g = 0; while (enemies.filter(q => !q.dead).length === 0 && g < 300) { step(); g++; }
  ok('next foe arrives within a second of a kill', g <= 45, g + ' frames');
  newGame(1); kill(player, -1); g = 0; while (player.dead && g < 300) { step(); g++; } let g2 = 0; while (!enemies.length && g2 < 300) { step(); g2++; }
  ok('you are back up in about a second', g <= 70, g + ' frames'); ok('and a foe is on its way straight after', g2 <= 25, g2 + ' frames');
  ok('you are briefly protected after respawning', player.invuln > 30, 'invuln=' + player.invuln);
  // --- real AI soak: fights still resolve ---
  window.aiInput = origAI; let kills0 = 0, deaths0 = 0, errs = '';
  try {
    for (let z = 0; z < 9; z++) {
      newGame(z); const k0 = kills, d0 = deaths;
      for (let i = 0; i < 1500; i++) {
        const en = enemies.find(q => !q.dead);
        if (en && !player.dead) { keys.right = en.x > player.x + 24; keys.left = en.x < player.x - 24; const md = keys.right ? 1 : keys.left ? -1 : 0; if (md && player.onGround && (player.hitWall || !groundBelow(player.x + md * 7, player.y))) pressed.jump = true; if (Math.abs(en.x - player.x) < 30 && i % 9 === 0) { if (player.stance === en.stance) pressed[Math.random() < 0.5 ? 'up' : 'down'] = true; else pressed.attack = true; } }
        step(); clearP();
      }
      keys.right = keys.left = false; kills0 += kills - k0; deaths0 += deaths - d0;
    }
  } catch (x) { errs = x.message; }
  ok('scripted fights against the real AI resolve', !errs && kills0 > 5, 'kills=' + kills0 + ' deaths=' + deaths0 + ' ' + errs);
  localStorage.removeItem('riposte.wardrobe');
  window.__results4 = R.join('\n');
})();
// ===== practice arena checks (appended) =====
window.__results5 = null;
(async () => {
  for (let i = 0; i < 1200 && !window.__results4; i++) await new Promise(r => setTimeout(r, 100));
  const R = []; const ok = (n, c, info = '') => R.push((c ? 'PASS ' : 'FAIL ') + n + (info ? '  [' + info + ']' : ''));
  const run = n => { for (let i = 0; i < n; i++) step(); };
  const clearP = () => { for (const k in pressed) pressed[k] = false; };
  state = 'title'; pressed.practice = true; step(); clearP();
  ok('T on the title screen opens the practice arena', state === 'play' && practice === true);
  run(120); const d = enemies[0];
  ok('a training dummy appears', enemies.length === 1 && d && d.type === 'dummy' && d.armed);
  const x0 = d.x; let attacked = false, stances = new Set(); for (let i = 0; i < 1300; i++) { step(); if (d.lunge > 0 || d.slash > 0 || d.windup > 0) attacked = true; stances.add(d.stance); }
  ok('the dummy never moves or attacks', Math.abs(d.x - x0) < 0.01 && !attacked);
  ok('the dummy cycles its guard height', stances.size === 3, [...stances].join(','));
  ok('practice never clears the zone', cleared === false);
  let err = ''; try { render(); } catch (x) { err = x.message; } ok('practice arena renders', !err, err);
  kill(d, 1); ok('no slow motion in practice', slowmo === 0 && !fin);
  let g = 0; while (enemies.filter(q => !q.dead).length === 0 && g < 300) { step(); g++; }
  ok('the dummy comes back after being cut down', g < 90 && enemies.some(q => !q.dead && q.type === 'dummy'), g + ' frames');
  for (let k = 0; k < 5; k++) { const q = enemies.find(z => !z.dead); kill(q, 1); run(120); }
  ok('it keeps coming back', enemies.filter(q => !q.dead).length === 1 && kills === 6, 'kills=' + kills);
  kill(player, -1); run(200); ok('you respawn in practice and the dummy returns', !player.dead && practice && enemies.some(q => !q.dead && q.type === 'dummy'));
  pressed.pause = true; step(); clearP(); ok('pause works in practice', state === 'paused');
  err = ''; try { render(); } catch (x) { err = x.message; } ok('pause menu renders', !err, err);
  pressed.practice = true; step(); clearP(); ok('T in the menu leaves practice', state === 'title' && practice === false);
  newGame(0); run(150); ok('a normal game is unaffected', practice === false && enemies[0] && enemies[0].type === 'squire');
  pressed.pause = true; step(); clearP(); pressed.practice = true; step(); clearP(); ok('T in the pause menu of a normal game opens practice', state === 'play' && practice === true);
  practice = false; state = 'title'; localStorage.removeItem('riposte.wardrobe');
  window.__results5 = R.join('\n');
})();

// ===== duel checks (appended): wind-ups, feints, back-step, riposte exchanges, sparring partner =====
window.__results6 = null;
(async () => {
  for (let i = 0; i < 1500 && !window.__results5; i++) await new Promise(r => setTimeout(r, 100));
  const R = []; const ok = (n, c, info = '') => R.push((c ? 'PASS ' : 'FAIL ') + n + (info ? '  [' + info + ']' : ''));
  const run = n => { for (let i = 0; i < n; i++) step(); };
  const clearP = () => { for (const k in pressed) pressed[k] = false; };
  const press = k => { pressed[k] = true; step(); clearP(); };
  const origAI = aiInput; const noAI = () => ({}); window.aiInput = noAI;
  const solo = () => { newGame(0); queue = []; enemies = []; run(5); clearP(); keys.attack = false; player.x += 80; };
  const pair = (gap, ps, es, type = 'squire') => { newGame(0); queue = []; clearP(); keys.attack = false; player.x += 80; const e = makeFighter(player.x + gap, GROUND, 'enemy', type); e.onGround = true; e.facing = -1; enemies = [e]; player.onGround = true; player.facing = 1; player.stance = player.prevStance = ps; e.stance = e.prevStance = es; return e; };
  let e;
  // --- your own wind-up and the feint ---
  solo(); press('attack'); ok('your thrust is drawn back first', player.prep > 0 && player.lunge === 0);
  run(5); ok('...and flies within a tenth of a second', player.lunge > 0, 'lunge=' + player.lunge);
  solo(); keys.attack = true; press('attack'); run(25); ok('holding J keeps the blade drawn', player.prep > 0 && player.lunge === 0);
  press('down'); ok('you can switch line while it is drawn', player.stance === 2 && player.prep > 0);
  keys.attack = false; run(2); ok('letting go sends the thrust on the new line', player.lunge > 0 && player.stance === 2);
  solo(); keys.attack = true; press('attack'); run(60); keys.attack = false; ok('a feint cannot be held forever', player.prep === 0);
  solo(); let xa = player.x; press('attack'); run(16); const tapStep = player.x - xa; solo(); xa = player.x; keys.attack = true; press('attack'); run(12); keys.attack = false; run(16); const heldStep = player.x - xa;
  ok('a held thrust lunges deeper than a quick one', heldStep > tapStep + 4, 'quick ' + tapStep.toFixed(1) + ' px, held ' + heldStep.toFixed(1) + ' px');
  solo(); keys.attack = true; press('attack'); run(10); press('parry'); keys.attack = false; ok('a feint can be dropped into a parry', player.prep === 0 && player.parry > 0 && player.lunge === 0);
  e = pair(34, 1, 1); keys.attack = true; press('attack'); run(3); control(e, { attackP: true, aim: 1 }); run(40); keys.attack = false;
  ok('a drawn-back blade guards nothing', player.dead);
  e = pair(22, 1, 1); control(e, { attackP: true, aim: 0 }); run(3); player.stance = player.prevStance = 0; press('attack'); run(10);
  ok('a thrust into a foe\'s wind-up stops them cold', e.dead && !player.dead);
  // --- back-step ---
  solo(); let hx = player.x; press('roll'); ok('SHIFT alone is a back-step, not a roll', player.hop > 0 && player.roll === 0);
  run(14); ok('...that carries you back out of reach', hx - player.x >= 13 && hx - player.x <= 26 && player.facing === 1, 'moved ' + (hx - player.x).toFixed(1));
  solo(); hx = player.x; keys.left = true; press('roll'); keys.left = false; ok('SHIFT with a direction still rolls', player.roll > 0 && player.hop === 0);
  solo(); player.onGround = false; player.y = GROUND - 20; press('roll'); ok('SHIFT in the air is still a dash', player.dash > 0 && player.hop === 0);
  // --- answering a telegraphed thrust ---
  e = pair(34, 1, 0); control(e, { attackP: true, aim: 0 }); ok('the wind-up shows the height it will strike at', e.prep > 0 && e.stance === 0);
  run(8); press('up'); run(34); ok('matching that height blocks it', !player.dead && !e.dead && e.over === 0);
  e = pair(34, 1, 0); control(e, { attackP: true, aim: 0 }); run(50); ok('doing nothing gets you killed', player.dead);
  e = pair(34, 1, 0); control(e, { attackP: true, aim: 0 }); run(22); press('roll'); let sawOver = 0; for (let i = 0; i < 30; i++) { step(); sawOver = Math.max(sawOver, e.over); }
  ok('hopping back makes it miss, and the foe overextends', !player.dead && sawOver >= 18, 'over=' + sawOver);
  e = pair(34, 1, 0); control(e, { attackP: true, aim: 0 }); run(22); press('roll'); for (let i = 0; i < 30 && !(e.over > 0); i++) step();
  press('up'); keys.right = true; let punished = false; for (let i = 0; i < 22; i++) { if (Math.abs(e.x - player.x) < 26 && !player.prep && !player.lunge) pressed.attack = true; step(); clearP(); if (e.dead) { punished = true; break; } } keys.right = false;
  ok('an overextended foe is open even at their own blade height', punished && player.stance === e.stance);
  // --- parry -> riposte ---
  const lateParry = () => { control(e, { attackP: true, aim: 0 }); for (let i = 0; i < 60 && e.prep > 2; i++) step(); press('parry'); for (let i = 0; i < 12 && !(e.stun > 0); i++) step(); };
  e = pair(34, 1, 0); lateParry(); ok('a timed parry beats the thrust aside', e.stun > 0 && !player.dead && player.riposteT > 0, 'stun=' + e.stun);
  freeze = 0; press('attack'); ok('the riposte has no wind-up', player.lunge > 0 && player.prep === 0, 'lunge=' + player.lunge + ' prep=' + player.prep);
  run(8); ok('...and kills the reeling foe', e.dead);
  e = pair(34, 1, 0, 'duelist'); lateParry(); const reelD = e.stun; e = pair(34, 1, 0, 'squire'); lateParry();
  ok('better fencers recover from a parry faster', reelD < e.stun, 'duelist ' + reelD + ' vs squire ' + e.stun);
  // --- foes answer back (real AI) ---
  window.aiInput = origAI;
  let cp = 0; for (let k = 0; k < 60; k++) { e = pair(30, 1, 0, 'duelist'); e.parried = true; e.cool = 0; if (origAI(e).parryP) cp++; }
  ok('a duelist often tries to parry a late riposte', cp > 15 && cp < 50, cp + '/60');
  cp = 0; for (let k = 0; k < 40; k++) { e = pair(30, 1, 0, 'squire'); e.parried = true; e.cool = 0; if (origAI(e).parryP) cp++; }
  ok('a squire never does', cp === 0);
  let baited = 0, killedAfter = 0, tries = 0;
  for (let k = 0; k < 60; k++) {
    e = pair(27, 2, 0, 'duelist'); e.react = 9999; e.plan = 'guard'; e.want = 0; e.seenS = 0; e.cool = 0; e.rollCd = 999; keys.attack = true; press('attack');
    let p0 = false; for (let i = 0; i < 9; i++) { step(); if (e.parry > 0) p0 = true; }
    if (p0) { baited++; keys.right = true; run(8); keys.attack = false; for (let i = 0; i < 12; i++) { step(); if (e.dead) { killedAfter++; break; } } }
    keys.attack = false; keys.right = false;
  }
  ok('a held wind-up draws out a duelist\'s parry about half the time', baited > 15 && baited < 48, baited + '/60');
  ok('...and striking after the parry has passed lands', killedAfter >= baited * 0.8, killedAfter + '/' + baited);
  let tapParried = 0; for (let k = 0; k < 60; k++) { e = pair(25, 2, 0, 'duelist'); e.react = 9999; e.plan = 'guard'; e.want = 0; e.seenS = 0; e.cool = 0; e.rollCd = 999; keys.right = true; press('attack'); for (let i = 0; i < 16; i++) { step(); if (player.stun > 0) { tapParried++; break; } } keys.right = false; }
  ok('a plain thrust at a duelist is parried about half the time', tapParried > 15 && tapParried < 48, tapParried + '/60');
  e = pair(21, 2, 0, 'duelist'); e.react = 9999; e.cool = 0; e.rollCd = 999; keys.right = true; press('attack'); e.parry = 10; for (let i = 0; i < 12 && !(player.stun > 0); i++) { e.parry = Math.max(e.parry, 3); step(); } keys.right = false;
  let rp = 0, rpPrep = 0; const tfr = timeF; for (let i = 0; i < 24; i++) { step(); if (e.prep > 0 && !rp) { rp = timeF - tfr; rpPrep = e.prep; } }
  ok('a foe who parries you ripostes at once, with a tell you can read', rp > 0 && rp <= 4 && rpPrep >= 15, 'started after ' + rp + ' frames, prep=' + rpPrep);
  for (let i = 0; i < 40 && e.prep > 2; i++) step(); press('parry'); for (let i = 0; i < 10 && !(e.stun > 0); i++) step();
  ok('...and you can parry that riposte back', e.stun > 0 && !player.dead, 'stun=' + e.stun + ' pdead=' + player.dead);
  let fe = 0; for (let k = 0; k < 60; k++) { e = pair(34, 1, 0, 'duelist'); e.cool = 0; control(e, { attackP: true, aim: 0 }); e.feinted = false; run(5); press('up'); const s0 = e.stance; for (let i = 0; i < 12; i++) step(); if (e.stance !== s0 && e.prep > 0) fe++; }
  ok('a duelist sometimes slips around an early block', fe > 12 && fe < 45, fe + '/60');
  fe = 0; for (let k = 0; k < 30; k++) { e = pair(34, 1, 0, 'squire'); e.cool = 0; control(e, { attackP: true, aim: 0 }); run(5); press('up'); const s0 = e.stance; for (let i = 0; i < 12; i++) step(); if (e.stance !== s0) fe++; }
  ok('a squire never feints', fe === 0);
  // --- foes attack from fencing distance with a tell ---
  let started = 0, farEnough = 0, offLine = 0;
  for (let k = 0; k < 20; k++) {
    e = pair(60, 1, 1, 'squire'); e.plan = 'attack'; e.react = 9999; e.cool = 0;
    for (let i = 0; i < 500; i++) { e.plan = 'attack'; e.react = 9999; step(); if (e.prep > 0) { started++; if (Math.abs(e.x - player.x) >= 28) farEnough++; if (e.stance !== player.stance) offLine++; break; } if (player.dead || e.dead) break; }
  }
  ok('an attacking foe winds up', started === 20, started + '/20');
  ok('...from beyond your reach', farEnough === started, farEnough + '/' + started);
  ok('...at a height your blade is not on', offLine === started, offLine + '/' + started);
  // --- sparring partner ---
  window.aiInput = origAI;
  state = 'title'; pressed.practice = true; step(); clearP(); run(60);
  press('foe2'); run(60); let sp = enemies.find(q => !q.dead);
  ok('2 in practice brings the sparring partner', practice && sp && sp.type === 'sparrer');
  let spAtk = 0, spX = 0; for (let i = 0; i < 900; i++) { step(); const q = enemies.find(z => !z.dead); if (q && q.prep === 1) spAtk++; }
  ok('he attacks on a steady beat', spAtk >= 3 && spAtk <= 12, spAtk + ' attacks in 15 s');
  ok('his touches do not kill you', !player.dead && deaths === 0 && touched > 0, 'touched=' + touched);
  let err = ''; try { render(); } catch (x) { err = x.message; } ok('sparring renders', !err, err);
  sp = enemies.find(q => !q.dead); kill(sp, 1); run(120); ok('he comes back when beaten', enemies.some(q => !q.dead && q.type === 'sparrer'));
  press('foe1'); run(60); ok('1 brings the dummy back', enemies.some(q => !q.dead && q.type === 'dummy') && !enemies.some(q => !q.dead && q.type === 'sparrer'));
  practice = false; practiceFoe = 'dummy'; state = 'title';
  // --- everything draws ---
  window.aiInput = noAI; err = '';
  try {
    e = pair(34, 1, 0); control(e, { attackP: true, aim: 0 }); run(3); render(); run(40); render(); e.over = 10; render();
    solo(); press('roll'); render(); keys.attack = true; press('attack'); run(8); render(); keys.attack = false; player.riposteT = 20; run(3); render();
  } catch (x) { err = x.message; }
  ok('wind-up, overextension, hop and riposte all render', !err, err);
  // --- real fights still resolve, both ways, with no errors ---
  window.aiInput = origAI; let pk = 0, ek = 0; err = '';
  try {
    for (let k = 0; k < 24; k++) {
      e = pair(70, 1, 1, ['squire', 'duelist', 'acolyte', 'shade'][k % 4]);
      for (let i = 0; i < 1500; i++) {
        if (i % 29 === 0) pressed.attack = true; if (i % 53 === 0) pressed.up = true; if (i % 71 === 0) pressed.down = true; if (i % 97 === 0) pressed.parry = true; if (i % 131 === 0) pressed.roll = true;
        keys.right = (i % 200) < 120 && Math.abs(e.x - player.x) > 30;
        step(); clearP(); if (i % 40 === 0) render();
        if (e.dead) { pk++; break; } if (player.dead) { ek++; break; }
      }
      keys.right = false;
    }
  } catch (x) { err = x.message + ' ' + (x.stack || '').split('\n')[1]; }
  ok('24 real fights run without an error', !err, err);
  ok('...and they end (someone wins)', pk + ek >= 20, 'you ' + pk + ', them ' + ek);
  ok('...with both sides able to win', pk > 0 && ek > 0, 'you ' + pk + ', them ' + ek);
  window.aiInput = origAI; newGame(0); state = 'title'; localStorage.removeItem('riposte.wardrobe');
  window.__results6 = R.join('\n');
})();

// ===== visual checks (appended): cloth, sparks, embers, scars, stains, stuck swords, title scene =====
window.__results7 = null;
(async () => {
  for (let i = 0; i < 1800 && !window.__results6; i++) await new Promise(r => setTimeout(r, 100));
  const R = []; const ok = (n, c, info = '') => R.push((c ? 'PASS ' : 'FAIL ') + n + (info ? '  [' + info + ']' : ''));
  const run = n => { for (let i = 0; i < n; i++) step(); };
  const clearP = () => { for (const k in pressed) pressed[k] = false; };
  const origAI = aiInput; window.aiInput = () => ({});
  let err = '';
  // title: storm scene draws, with and without a lightning strike
  state = 'title'; clearP();
  try { run(30); lightning = 0; render(); lightning = 9; render(); lightning = 4; render(); lightning = 0; } catch (x) { err = x.message; }
  ok('title scene renders (calm and in lightning)', !err, err);
  ok('title camera pushes in on the swordsman', cam.z > 1.5, 'z=' + cam.z.toFixed(2));
  ok('title weather is rain', curAct().wet === true);
  // cloth
  newGame(0); queue = []; enemies = []; run(40); const rest = player.cx || 0;
  keys.right = true; run(25); keys.right = false; const trailing = player.cx;
  ok('the coat trails behind a run', trailing < rest - 1, 'rest ' + rest.toFixed(2) + ', running ' + trailing.toFixed(2));
  let swung = false; for (let i = 0; i < 40; i++) { step(); if (player.cx > windNow() + 0.1) swung = true; }   // past where the wind alone would hold it
  ok('...and swings through when you stop', swung);
  player.vy = -4; player.onGround = false; let lifted = 0; for (let i = 0; i < 45; i++) { step(); lifted = Math.min(lifted, player.cy); }
  ok('...and lifts as you fall', lifted < -0.8, 'cy=' + lifted.toFixed(2));
  ok('cloth values stay sane', [player.cx, player.cy, player.cvx, player.cvy].every(v => Number.isFinite(v) && Math.abs(v) < 8));
  // sparks bounce and die
  newGame(0); queue = []; enemies = []; run(10); parts = []; sparks(player.x + 20, GROUND - 10);
  const sp0 = parts.filter(p => p.spark).length; let bounced = 0; for (let i = 0; i < 60; i++) { step(); bounced = Math.max(bounced, ...parts.filter(p => p.spark).map(p => p.b)); }
  ok('a clash throws heavy sparks', sp0 >= 6, sp0 + ' sparks');
  ok('...that bounce on the stone', bounced >= 1, 'bounces=' + bounced);
  run(120); ok('...and burn out', parts.filter(p => p.spark).length === 0);
  // embers
  newGame(0); queue = []; enemies = []; run(200); const em = parts.filter(p => p.ember).length;
  ok('torches shed embers', em > 3 && em < 200, em + ' embers');
  // scars
  newGame(0); queue = []; const e = makeFighter(player.x + 26, GROUND, 'enemy', 'squire'); e.onGround = true; e.facing = -1; enemies = [e]; player.onGround = true;
  for (let i = 0; i < 12; i++) clash(player, e);
  ok('clashes score the stone', scars.length >= 3 && scars.length <= 12, scars.length + ' scars');
  for (let i = 0; i < 300; i++) scar(player.x + (i % 40), player.y); ok('scars are capped', scars.length <= 90);
  err = ''; try { render(); } catch (x) { err = x.message; } ok('scarred stone renders', !err, err);
  respawn(); ok('scars survive a respawn', scars.length > 0); newGame(0); ok('...and are wiped by a new run', scars.length === 0);
  // blood stays
  newGame(0); queue = []; enemies = []; run(10); parts = []; spray(player.x + 10, GROUND - 8, 1, 20, '#a0141c'); run(600);
  ok('blood is still on the stone ten seconds later', parts.filter(p => p.landed).length >= 10, parts.filter(p => p.landed).length + ' stains');
  const rz = ZONES.findIndex(z => z.weather === 'rain');
  newGame(rz); queue = []; enemies = []; run(10); parts = []; spray(player.x + 10, GROUND - 8, 1, 20, '#a0141c'); run(900);
  ok('...but rain washes it away', rz >= 0 && parts.filter(p => p.stick && p.landed).length === 0, 'rain zone ' + rz + ', ' + parts.filter(p => p.stick && p.landed).length + ' left');
  // swords stick
  newGame(0); queue = []; enemies = []; run(10); swords = [{ x: player.x + 40, y: GROUND - 30, vx: 0.8, vy: 0, onGround: false, age: 0 }]; run(80);
  ok('a falling sword sticks point-first in the ground', swords.length === 1 && swords[0].onGround && typeof swords[0].stuck === 'number', JSON.stringify(swords[0] && swords[0].stuck));
  err = ''; try { render(); } catch (x) { err = x.message; } ok('stuck sword renders', !err, err);
  player.armed = false; player.x = swords[0].x - 10; keys.right = true; run(30); keys.right = false; ok('...and can still be picked up', player.armed);
  // finisher beat + blur
  newGame(0); queue = []; const q = makeFighter(player.x + 22, GROUND, 'enemy', 'squire'); q.onGround = true; enemies = [q]; cleared = false; run(20); kill(q, 1);
  err = ''; let sawBeat = false; try { for (let i = 0; i < 30; i++) { step(); render(); if (silh) sawBeat = true; } } catch (x) { err = x.message; }
  ok('the finisher flashes to a silhouette', sawBeat && !err, err);
  ok('...and only for a moment', !silh);
  // every zone still draws, and fast enough
  err = ''; let worst = 0;
  try { for (let z = 0; z < ZONES.length; z++) { newGame(z); run(30); const t0 = performance.now(); for (let i = 0; i < 5; i++) render(); worst = Math.max(worst, (performance.now() - t0) / 5); } } catch (x) { err = x.message; }
  ok('all zones render', !err, err);
  ok('a frame still draws in well under 16 ms', worst < 12, 'slowest zone ' + worst.toFixed(1) + ' ms');
  window.aiInput = origAI; newGame(0); state = 'title'; localStorage.removeItem('riposte.wardrobe');
  window.__results7 = R.join('\n');
})();

// ===== props & map checks (appended) =====
window.__results8 = null;
(async () => {
  for (let i = 0; i < 2000 && !window.__results7; i++) await new Promise(r => setTimeout(r, 100));
  const R = []; const ok = (n, c, info = '') => R.push((c ? 'PASS ' : 'FAIL ') + n + (info ? '  [' + info + ']' : ''));
  const run = n => { for (let i = 0; i < n; i++) step(); };
  const clearP = () => { for (const k in pressed) pressed[k] = false; };
  const press = k => { pressed[k] = true; step(); clearP(); };
  const origAI = aiInput; window.aiInput = () => ({});
  // a duel beside the first pot of zone 0: player stands by the pot, foe `gap` to the right at the same blade height
  const byPot = (gap, type = 'squire') => { newGame(0); queue = []; clearP(); run(3); const p = props[0]; player.x = p.x - 6; player.onGround = true; player.facing = 1; const e = makeFighter(player.x + gap, GROUND, 'enemy', type); e.onGround = true; e.facing = -1; e.stance = e.prevStance = 1; enemies = [e]; cleared = false; return e; };
  let e = byPot(90);
  ok('zone 0 has things to throw', props.length >= 2, props.map(p => p.kind).join(','));
  ok('standing by a pot offers it', nearProp(player) === props[0]);
  const n0 = props.length; press('grab');
  ok('E sends it flying at once', props.some(p => p.fly) && player.fling > 0);
  let hitAt = 0; for (let i = 1; i <= 40 && !hitAt; i++) { step(); if (e.stun > 0) hitAt = i; }
  ok('it reaches a foe 90 px away in a blink', hitAt > 0 && hitAt <= 22, hitAt + ' frames');
  ok('the foe is stunned for most of a second', e.stun >= 38 && e.stun <= 46, 'stun=' + e.stun);
  ok('the pot is gone', props.length === n0 - 1);
  ok('it leaves debris on the stone', parts.some(p => p.debris));
  freeze = 0; run(8); player.x = e.x - 21; press('attack'); run(12);
  ok('a stunned foe is open even at your own blade height', e.dead);
  e = byPot(90, 'warden'); press('grab'); let bs = 0; for (let i = 0; i < 40; i++) { step(); bs = Math.max(bs, e.stun); }
  ok('a boss shakes it off faster', bs > 0 && bs <= 22, 'stun=' + bs);
  e = byPot(60); press('grab'); let ps = 0; for (let i = 0; i < 40; i++) { e.parry = 5; step(); ps = Math.max(ps, e.stun); }
  ok('a foe who is parrying bats it away', ps === 0 && !props.some(p => p.fly));
  e = byPot(60); e.prep = 20; e.atkId = 1; press('grab'); for (let i = 0; i < 30 && !(e.stun > 0); i++) step();
  ok('a hit knocks a foe out of their wind-up', e.stun > 0 && e.prep === 0 && e.lunge === 0);
  newGame(0); queue = []; enemies = []; clearP(); run(3); player.x = props[0].x - 6; const n1 = props.length; press('grab'); run(90);
  ok('with no foe about it is simply thrown and breaks', props.length === n1 - 1);
  newGame(0); queue = []; enemies = []; clearP(); run(3); player.x = props[0].x - 40; const n2 = props.length; press('grab'); run(5);
  ok('E does nothing when nothing is in reach', props.length === n2 && !props.some(p => p.fly));
  e = byPot(90); press('grab'); run(40); kill(player, -1); run(200);
  ok('props are back after you fall', !player.dead && props.length === (ZONES[0].props || []).length, props.length + ' props');
  state = 'title'; pressed.practice = true; step(); clearP(); run(30); player.x = props[0].x - 6; press('grab'); run(100);
  const gone = props[0].back > 0; run(260);
  ok('in practice a thrown prop comes back', gone && props[0].back === 0 && !props[0].fly && nearProp(Object.assign({}, player, { x: props[0].x })) === props[0]);
  practice = false; state = 'title';
  let err = ''; try { e = byPot(90); render(); press('grab'); run(3); render(); run(30); render(); } catch (x) { err = x.message; }
  ok('props render at rest, in flight and broken', !err, err);
  // --- maps ---
  let bad = [];
  for (let z = 0; z < ZONES.length; z++) {
    const z0 = z * ZW; newGame(z); queue = [];
    for (const p of props) if (groundYAt(p.x, 100) !== p.y || solidAt(p.x, p.y - 1)) bad.push('prop ' + z + '@' + (p.x - z0));
    for (const t of torches) if (t >= z0 && t < z0 + ZW && (groundYAt(t, 100) !== GROUND || solidAt(t, GROUND - 1))) bad.push('torch ' + z + '@' + (t - z0));
    for (const dx of [4, 26, 30, 294, 316]) if (groundYAt(z0 + dx, GROUND - 4) !== GROUND || solidAt(z0 + dx, GROUND - 2)) bad.push('edge ' + z + '@' + dx);
  }
  ok('every prop and torch stands on the floor, and zone edges are level', bad.length === 0, bad.join(' '));
  ok('most zones now have their own shape', ZONES.filter((zn, z) => solids.filter(s => s.x >= z * ZW && s.x < (z + 1) * ZW).length + platforms.filter(p => p.x >= z * ZW && p.x < (z + 1) * ZW).length > 1).length >= 8);
  // you can cross every zone (a simple bot: run right, jump at walls and edges)
  bad = [];
  for (let z = 0; z < ZONES.length - 1; z++) {
    newGame(z); queue = []; enemies = []; cleared = true; clearP(); let done = false;
    for (let i = 0; i < 900 && !done; i++) { keys.right = true; if (player.onGround && (player.hitWall || !groundBelow(player.x + 7, player.y))) pressed.jump = true; step(); clearP(); if (player.dead) break; if (player.x > z * ZW + 300) done = true; }
    keys.right = false; if (!done) bad.push(z + (player.dead ? ' died' : ' stuck@' + Math.round(player.x - z * ZW)));
  }
  ok('every zone can be crossed on foot', bad.length === 0, bad.join(', '));
  // and foes can cross it to reach you
  window.aiInput = origAI; bad = []; const fellIn = [];
  for (let z = 0; z < ZONES.length - 1; z++) {
    let best = 999;
    for (let k = 0; k < 2 && best > 60; k++) {
      newGame(z); clearP(); queue = [ZONES[z].enemies[0]]; spawnT = 1; player.invuln = 9999; player.x = z * ZW + (z === 2 ? 80 : 50);
      for (let i = 0; i < 900; i++) { player.invuln = 9999; step(); const q = enemies[0]; if (q && q.fell) { fellIn.push(z); break; } if (q && !q.dead) best = Math.min(best, Math.abs(q.x - player.x)); if (best < 45) break; }
    }
    if (best > 60) bad.push(z + ' (closest ' + Math.round(best) + ')');
  }
  ok('foes can reach you across every layout', bad.length === 0, bad.join(', '));
  ok('...without falling into a pit on the way', fellIn.length === 0, 'fell in zones ' + fellIn.join(','));
  let falls = 0; for (let k = 0; k < 12; k++) { const z = ['The Broken Span', 'The Cistern', 'Shadow Stair'].map(n => ZONES.findIndex(q => q.name === n))[k % 3]; newGame(z); clearP(); queue = [ZONES[z].enemies[0]]; spawnT = 1; player.x = z * ZW + (z === 2 ? 80 : 50); for (let i = 0; i < 500; i++) { player.invuln = 9999; step(); if (enemies[0] && enemies[0].fell) { falls++; break; } } }
  ok('foes do not overshoot the gaps when they run in', falls === 0, falls + '/12 fell');
  err = ''; try { for (let z = 0; z < ZONES.length; z++) { newGame(z); run(20); render(); } } catch (x) { err = x.message; } ok('every reshaped zone renders', !err, err);
  window.aiInput = origAI; newGame(0); state = 'title'; localStorage.removeItem('riposte.wardrobe');
  window.__results8 = R.join('\n');
})();

// ===== longer climb: new levels, the frozen act, reavers and the Falconer (appended) =====
window.__results9 = null;
(async () => {
  for (let i = 0; i < 2400 && !window.__results8; i++) await new Promise(r => setTimeout(r, 100));
  const R = []; const ok = (n, c, info = '') => R.push((c ? 'PASS ' : 'FAIL ') + n + (info ? '  [' + info + ']' : ''));
  const run = n => { for (let i = 0; i < n; i++) step(); };
  const clearP = () => { for (const k in pressed) pressed[k] = false; };
  const zoneOf = name => ZONES.findIndex(z => z.name === name);
  ok('the climb ends at the bell', ZONES.length >= 17 && ZONES[ZONES.length - 1].name === 'The Bell' && BELL_X === (ZONES.length - 1) * ZW + 240);
  const NEW = ['The Gatehouse', 'The Cistern', 'The White Parapet', 'The Rookery', 'The Frozen Stair', "The Falconer's Roost", 'The Ossuary'];
  ok('all seven new landings exist', NEW.every(n => zoneOf(n) >= 0), NEW.filter(n => zoneOf(n) < 0).join(','));
  ok('acts only ever move forward', ZONES.every((z, i) => i === 0 || z.act === ZONES[i - 1].act || z.act === ZONES[i - 1].act + 1));
  ok('every act opens with a title card', ZONES.every((z, i) => !!z.title === (i === 0 || z.act !== ZONES[i - 1].act)));
  ok('every foe on the list is a real type with a look', ZONES.every(z => z.enemies.every(t => TYPES[t] && LOOKS[t])));
  ok('bosses stand alone: Gaoler, Falconer, Warden', ['gaoler', 'falconer', 'warden'].every(b => { const z = ZONES.find(q => q.enemies.includes(b)); return z && z.enemies.length === 1 && TYPES[b].boss; }));
  // the frozen act
  const fz = zoneOf('The White Parapet'); newGame(fz); run(20); const A = curAct();
  ok('the frozen act has snow, ice and a pale moon', A.snow === true && A.wet === true && !A.grass && A.moons.length === 1 && A.moons[0].pale === true && A.starA === 1, 'sky=' + skyPos);
  const y0 = weatherP.map(w => w.y).slice(); run(10); ok('snow falls', ZONES[zi].weather === 'snow' && weatherP.filter((w, i) => w.y > y0[i]).length > weatherP.length * 0.8);
  ok('a steady wind blows the snow', windNow() < 0.2);
  newGame(zoneOf("The Falconer's Roost")); run(700); const B = curAct();
  ok('the moon turns to blood where it hangs', B.moons.length === 2 && B.moons[0].pale && !B.moons[1].pale && B.moons[0].y === B.moons[1].y && B.moons[1].a > 0.2 && B.moons[1].a < 0.6, B.moons.map(m => m.a.toFixed(2)).join('/'));
  newGame(zoneOf('The Dais')); run(20); ok('the spire keeps its blood moon and ash', curAct().moons.length === 1 && !curAct().moons[0].pale && !curAct().snow && ZONES[zi].weather === 'ash');
  state = 'title'; skyKey = ''; const TA = curAct(); ok('the title storm is unchanged', TA.wet === true && !TA.snow && TA.moons.length === 1 && !TA.moons[0].pale); newGame(0);
  // reavers
  const origAI = aiInput;
  newGame(fz); let f0 = 0; while (!enemies.length && f0 < 400) { step(); f0++; }
  ok('a reaver meets you on the parapet', enemies[0] && enemies[0].type === 'reaver' && enemies[0].T.dash && enemies[0].T.slash > 0);
  let slashes = 0, closest = 999; for (let i = 0; i < 1500; i++) { player.invuln = 9999; player.armed = true; for (const e of enemies) e.invuln = 3; step(); const q = enemies.find(e => !e.dead); if (!q) break; if (q.slash > 0) slashes++; closest = Math.min(closest, Math.abs(q.x - player.x)); }
  ok('reavers crowd in and slash', closest < 26 && slashes > 0, 'closest ' + closest.toFixed(0) + ', slash frames ' + slashes);
  window.aiInput = () => ({}); newGame(fz); queue = []; const rv = makeFighter(player.x + 22, GROUND, 'enemy', 'reaver'); rv.onGround = true; rv.facing = -1; enemies = [rv]; run(3); rv.cool = 0; player.invuln = 0;
  window.aiInput = e => e === rv && !rv.slash && !rv.did2 ? (rv.did2 = true, { slashP: true }) : {}; step(); const s0 = rv.slash; let warn = 0; while (rv.slash > 13 && !player.dead && warn < 60) { step(); warn++; }
  ok('a reaver holds the cut high for a beat before it falls', s0 >= 29 && warn >= 15 && !player.dead && !rv.dead, 'slash ' + s0 + ', warning ' + warn + ' frames');
  run(5); ok('...and then it cuts through a guard', player.dead || touched > 0 || player.invuln > 0, 'dead ' + player.dead);
  newGame(fz); queue = []; const rv2 = makeFighter(player.x + 22, GROUND, 'enemy', 'reaver'); rv2.onGround = true; rv2.facing = -1; enemies = [rv2]; window.aiInput = e => e === rv2 && !rv2.did2 ? (rv2.did2 = true, { slashP: true }) : {}; run(3); rv2.cool = 0; rv2.did2 = false; step(); run(4);
  pressed.attack = true; step(); clearP(); run(14); ok('a quick thrust while the blade is up kills the reaver', rv2.dead && !player.dead, 'reaver dead ' + rv2.dead + ', player dead ' + player.dead); slowmo = 0; fin = null; freeze = 0;
  window.aiInput = origAI;
  // the Falconer
  newGame(zoneOf("The Falconer's Roost")); f0 = 0; while (!enemies.length && f0 < 400) { step(); f0++; } const F = enemies[0];
  ok('the Falconer waits at the far wall and speaks', F && F.type === 'falconer' && Math.abs(F.x - player.x) > 200 && speech && speech.who === 'THE FALCONER');
  let threw = 0, rearmed = false, was = true; for (let i = 0; i < 3600 && !(threw && rearmed); i++) { player.invuln = 9999; F.invuln = 3; step(); if (projs.length) threw++; if (!was && F.armed) rearmed = true; was = F.armed; if (F.dead) break; }
  ok('she throws her blade and draws another', threw > 0 && rearmed, 'threw ' + threw + ' rearmed ' + rearmed);
  window.aiInput = () => ({}); newGame(zoneOf("The Falconer's Roost")); queue = []; const b = makeFighter(player.x + 40, GROUND, 'enemy', 'falconer'); b.onGround = true; enemies = [b]; run(5);
  const hp0 = b.hp; kill(b, 1); ok('she takes three wounds', hp0 === 3 && b.hp === 2 && !b.dead);
  b.hp = 1; b.invuln = 0; kill(b, 1); ok('her fall is a coup de grâce', b.dead && fin && fin.boss === true); slowmo = 0; fin = null; freeze = 0;
  ok('new foes drop new cosmetics', COSMETIC_BY_ID.reaver_mantle && COSMETIC_BY_ID.falconer_cloak && COSMETIC_BY_ID.falconer_mask);
  // layouts
  window.aiInput = origAI;
  let bad = []; for (const n of NEW) { const z = zoneOf(n), z0 = z * ZW; if (!solidAt(z0 + 26, GROUND + 1) || !solidAt(z0 + 294, GROUND + 1) || solidAt(z0 + 26, GROUND - 1) || solidAt(z0 + 294, GROUND - 1)) bad.push(n); }
  ok('both ends of each new landing are level ground for foes to walk in on', bad.length === 0, bad.join(','));
  bad = []; for (const n of NEW) { const z = zoneOf(n); for (const t of torches.filter(t => t > z * ZW && t < (z + 1) * ZW)) if (platforms.some(p => t > p.x - 4 && t < p.x + p.w + 4 && p.y > 100) || !solidAt(t, GROUND + 1) || solidAt(t, GROUND - 1)) bad.push(n + '@' + (t - z * ZW)); }
  ok('no torch stands under a platform, on a step or over a pit', bad.length === 0, bad.join(','));
  bad = []; for (const n of NEW) { const z = zoneOf(n); newGame(z); for (const p of props) if (!solidAt(p.x, p.y + 1) && !platforms.some(q => p.x >= q.x && p.x <= q.x + q.w && Math.abs(q.y - p.y) < 1)) bad.push(n + '@' + (p.x - z * ZW)); }
  ok('every prop on the new landings rests on something', bad.length === 0, bad.join(','));
  // whole fights on the new landings: an untouchable player who only walks right must see every foe arrive
  bad = []; const fell = [];
  for (const n of NEW) {
    const z = zoneOf(n); newGame(z); clearP(); let seen = 0, t = 0;
    for (; t < 2600 && seen < ZONES[z].enemies.length; t++) { player.invuln = 9999; step(); for (const e of enemies) { if (!e.counted) { e.counted = true; seen++; } if (e.fell && !e.fellNoted) { e.fellNoted = true; fell.push(n + ':' + e.type); } if (!e.dead && t % 90 === 0 && Math.abs(e.x - player.x) < 60) kill(e, 1); } slowmo = 0; fin = null; }
    if (seen < ZONES[z].enemies.length) bad.push(n + ' ' + seen + '/' + ZONES[z].enemies.length);
  }
  ok('every foe on the new landings arrives', bad.length === 0, bad.join(', '));
  ok('...and none walks into a pit', fell.length === 0, fell.join(', '));
  let err = ''; try { for (const n of NEW) { newGame(zoneOf(n)); for (let i = 0; i < 240; i++) { step(); if (i % 8 === 0) render(); } } } catch (x) { err = x.message + ' @' + ZONES[zi].name; }
  ok('the new landings play and draw without errors', !err, err);
  let worst = 0; for (const n of NEW) { newGame(zoneOf(n)); run(60); const t0 = performance.now(); for (let i = 0; i < 5; i++) render(); worst = Math.max(worst, (performance.now() - t0) / 5); }
  ok('the new landings draw fast enough', worst < 14, worst.toFixed(1) + ' ms');
  newGame(0); ok('progress pips fit the longer climb', 18 + ZONES.length * 17 < W * S / 2);
  window.aiInput = origAI; newGame(0); state = 'title'; localStorage.removeItem('riposte.wardrobe');
  window.__results9 = R.join('\n');
})();

// ===== builds: relics, the choice after each landing, and foes that scale (appended) =====
window.__results10 = null;
(async () => {
  for (let i = 0; i < 3000 && !window.__results9; i++) await new Promise(r => setTimeout(r, 100));
  buildsOn = true;
  const R = []; const ok = (n, c, info = '') => R.push((c ? 'PASS ' : 'FAIL ') + n + (info ? '  [' + info + ']' : ''));
  const run = n => { for (let i = 0; i < n; i++) step(); };
  const clearP = () => { for (const k in pressed) pressed[k] = false; };
  const press = k => { pressed[k] = true; step(); clearP(); };
  const origAI = aiInput; const idle = () => { window.aiInput = () => ({}); };
  const calm = () => { slowmo = 0; fin = null; freeze = 0; };
  const give = o => { relics = Object.assign({}, o); relicOrder = Object.keys(o); };
  // an empty first landing with no choice pending, the player standing clear of the props, holding the given relics
  const solo = (o = {}) => { newGame(0); queue = []; enemies = []; lastPickZone = 99; run(5); clearP(); keys.right = keys.left = keys.attack = false; give(o); player.x += 80; player.cool = 0; player.invuln = 0; };
  const foe = (dx, type = 'squire', stance = 1) => { const e = makeFighter(player.x + dx, GROUND, 'enemy', type); e.onGround = true; e.facing = dx > 0 ? -1 : 1; e.stance = e.prevStance = stance; enemies.push(e); return e; };
  const until = (f, max = 400) => { let n = 0; while (!f() && n < max) { step(); n++; } return n; };

  // ---------- the relics themselves ----------
  ok('twenty-six relics, each with a name, a tier and words that read', RELICS.length === 26 && new Set(RELICS.map(r => r.id)).size === 26 &&
    RELICS.every(r => r.name && r.tier >= 0 && r.tier <= 2 && [1, 2, 3, 4].every(n => typeof r.desc(n) === 'string' && r.desc(n).length > 12 && !/undefined|NaN/.test(r.desc(n)))));
  ok('ten common, eleven rare, five legendary', [0, 1, 2].map(t => RELICS.filter(r => r.tier === t).length).join() === '10,11,5');

  // ---------- the choice ----------
  newGame(0); until(() => enemies.length);
  ok('no choice while a foe still stands', !offer && pickAt === 0);
  kill(enemies[0], 1); const waited = until(() => offer, 900);
  ok('clearing a landing offers three different relics', !!offer && offer.length === 3 && new Set(offer).size === 3 && offer.every(id => RELIC[id]), 'after ' + waited + ' frames');
  ok('...once the killing blow has played out', waited > 60);
  ok('the first landing offers no legendaries', !!offer && offer.every(id => RELIC[id].tier < 2));
  const tf = timeF, px0 = player.x; keys.right = true; run(30); keys.right = false;
  ok('the world holds still while you choose', timeF === tf && player.x === px0 && !!offer);
  let err = ''; try { render(); } catch (x) { err = x.message; } ok('the choice draws', !err, err);
  press('right'); const s1 = pickSel; press('left'); press('left'); press('left');
  ok('A and D move the choice and stop at the ends', s1 === 2 && pickSel === 0);
  const want = offer[1]; press('foe2');
  ok('pressing 2 takes the middle relic', !offer && relics[want] === 1 && relicOrder[0] === want && lastPickZone === 0, JSON.stringify(relics));
  run(80); ok('no second choice for the same landing', !offer && pickAt === 0 && cleared);
  player.invuln = 0; wardLeft = 0; kill(player, -1); until(() => !player.dead, 300); until(() => enemies.length); kill(enemies[0], 1); calm(); run(120);
  ok('falling and clearing it again gives nothing more', !offer && Object.values(relics).reduce((a, b) => a + b, 0) === 1, JSON.stringify(relics));
  ok('a fall does not cost you your build', relics[want] === 1);
  // enter and click
  newGame(0); queue = []; enemies = []; until(() => offer, 200); run(30); const mid = offer[1]; press('start');
  ok('ENTER takes the highlighted relic', !offer && relics[mid] === 1);
  newGame(0); queue = []; enemies = []; until(() => offer, 200); const third = offer[2]; run(5); press('attack');
  ok('a mashed J in the first moment takes nothing', !!offer); run(30); pickSel = 2; press('attack'); ok('...but a deliberate one does', !offer && relics[third] === 1);
  // walking out early
  newGame(0); queue = []; enemies = []; step(); const pend = pickAt; player.x = ZW + 45; step();
  ok('walking out before the choice appears opens it at the gate', pend > 0 && !!offer && zi === 0);
  run(14); press('foe1'); step();
  ok('...and then the next landing begins', !offer && zi === 1 && Object.keys(relics).length === 1);
  // tiers
  const gz = ZONES.findIndex(z => z.enemies.includes('gaoler')); newGame(gz); let allLeg = true; for (let i = 0; i < 40; i++) if (!rollOffer().every(id => RELIC[id].tier === 2)) allLeg = false;
  ok('a boss gives a choice of legendaries', allLeg);
  give({ storm: 2, mark: 3 }); let capped = false; for (let i = 0; i < 80; i++) if (rollOffer().some(id => id === 'storm' || id === 'mark')) capped = true;
  ok('a relic at its limit is not offered again', !capped);
  const rares = z => { zi = z; let c = 0; for (let i = 0; i < 300; i++) c += rollOffer().filter(id => RELIC[id].tier === 1).length; return c; }; newGame(0); const r0 = rares(0), r12 = rares(12); zi = 0;
  ok('rare relics come more often the higher you climb', r12 > r0 * 1.5, r0 + ' -> ' + r12);
  newGame(ZONES.length - 1); run(60); ok('the bell asks nothing of you', !offer && pickAt === 0);
  startPractice(); relics = { boots: 3 }; ok('the practice arena has no relics and no scaling', rel('boots') === 0 && threat() === 0); practice = false;
  buildsOn = false; newGame(0); queue = []; enemies = []; run(90); ok('with builds switched off the old game is untouched', !offer && pickAt === 0 && rel('boots') === 0); buildsOn = true;

  // ---------- commons ----------
  idle();
  solo(); press('attack'); until(() => player.lunge > 0, 20); const cool0 = player.cool, reach0 = reach(player) - lungeExt(player);
  solo({ whetstone: 2, wrist: 2 }); const idleReach = reach(player); press('attack'); until(() => player.lunge > 0, 20);
  ok('Whetstone: the lunge reaches further, the guard does not', idleReach === 15 && reach0 === 15 && reach(player) - lungeExt(player) === 18);
  ok('Quick Wrist: a thrust recovers sooner', cool0 - player.cool === 4, cool0 + ' -> ' + player.cool);
  const dist = o => { solo(o); const x0 = player.x; keys.right = true; run(60); keys.right = false; return player.x - x0; }; const d0 = dist(), d3 = dist({ boots: 3 });
  ok("Fencer's Boots: you cover more ground", d3 / d0 > 1.17 && d3 / d0 < 1.25, (d3 / d0).toFixed(3));
  solo(); press('roll'); const cd0 = player.rollCd, hop0 = player.hop; solo({ spring: 2 }); press('roll');
  ok('Coiled Spring: the back-step is ready sooner', hop0 > 0 && cd0 - player.rollCd === 7, cd0 + ' -> ' + player.rollCd);
  solo(); let e = foe(20); player.parry = 5; e.lunge = 6; tryParry(player, e); const rp0 = player.riposteT; solo({ steady: 2 }); e = foe(20); player.parry = 5; e.lunge = 6; tryParry(player, e);
  ok('Steady Hand: a longer riposte window', player.riposteT - rp0 === 18, rp0 + ' -> ' + player.riposteT); freeze = 0;
  solo(); press('heavy'); const w0 = player.windup; solo({ pommel: 2 }); press('heavy');
  ok('Heavy Pommel: the heavy lunge winds up faster', w0 - player.windup === 4, w0 + ' -> ' + player.windup);
  const potStun = o => { solo(o); const p = props[0]; player.x = p.x - 6; const q = foe(70); press('grab'); until(() => q.stun > 0, 60); return q.stun; }; const ps0 = potStun(), ps1 = potStun({ arm: 1 });
  ok("Pitcher's Arm: a thrown pot stuns longer", ps0 >= 44 && ps0 <= 46 && ps1 - ps0 === 23, ps0 + ' -> ' + ps1); freeze = 0;
  const tellOf = o => { solo(o); const q = foe(30); q.cool = 0; window.aiInput = x => x === q && !q.did2 ? (q.did2 = true, { attackP: true, aim: 0 }) : {}; step(); idle(); return q.prep; }; const t0 = tellOf(), t2 = tellOf({ eye: 2 });
  ok("Duelist's Eye: foes take longer to wind up", t0 === TYPES.squire.tell && t2 === Math.round(TYPES.squire.tell * 1.2), t0 + ' -> ' + t2);
  solo({ rush: 2 }); e = foe(30); kill(e, 1); calm(); ok('Bloodrush: a kill starts the rush', rushT === 135); const xr = player.x; keys.right = true; run(40); keys.right = false; const dr = player.x - xr; solo(); const xn = player.x; keys.right = true; run(40); keys.right = false;
  ok('...and you are faster while it lasts', dr / (player.x - xn) > 1.18, (dr / (player.x - xn)).toFixed(3));
  solo(); press('jump'); const vy0 = player.vy; solo({ feather: 2 }); press('jump');
  ok('Hawk Feather: a higher jump', player.vy < vy0 * 1.1, vy0.toFixed(2) + ' -> ' + player.vy.toFixed(2));

  // ---------- rares ----------
  solo({ spare: 1 }); respawn(); ok('Spare Blade: every landing begins with a second blade', player.offhand === true && player.armed);
  player.offhand = false; lastPickZone = 99; queue = []; let at5 = null; for (let i = 0; i < 6; i++) { e = foe(40); kill(e, 1); calm(); if (i === 4) at5 = player.offhand; }
  ok('...and a fresh one after six kills', at5 === false && player.offhand === true);
  solo(); press('throw'); run(220); const noMag = player.armed; solo({ lodestone: 1 }); press('throw'); const gone = !player.armed; const back = until(() => player.armed, 260);
  ok('Lodestone: a thrown blade flies back to your hand', gone && !noMag && player.armed && back < 200, 'back after ' + back + ' frames');
  ok('...and leaves nothing lying about', swords.length === 0, swords.length + ' loose');
  solo({ ghost: 1 }); press('throw'); run(140); const early = player.armed; run(20);
  ok('Ghost Blade: a new blade forms when you are left unarmed', !early && player.armed);
  solo({ shadow: 2 }); press('roll'); ok('Shadow Step: the back-step cannot be touched', player.hop > 0 && player.invuln >= 11, 'invuln ' + player.invuln);
  e = foe(14, 'squire', 0); kill(player, -1); ok('...so a blade passes through you', !player.dead);
  solo(); press('jump'); run(8); press('jump'); const noWing = player.vy; solo({ wing: 1 }); press('jump'); run(8); press('jump'); const second = player.vy, aj = player.airJumps; run(8); press('jump');
  ok("Crow's Wing: one more jump in mid-air, and only one", noWing > -3 && second < -3.5 && aj === 1 && player.vy > -3, noWing.toFixed(2) + ' / ' + second.toFixed(2) + ' / ' + player.vy.toFixed(2));
  until(() => player.onGround, 200); step(); ok('...and it comes back when you land', player.airJumps === 0);
  solo({ thunder: 1 }); let a = foe(22, 'squire', 0), b = foe(58); player.riposteT = 30; press('attack'); run(5);
  ok('Thunder Riposte: a riposte kill staggers the next foe', a.dead && b.stun >= 40 && !b.dead, 'a dead ' + a.dead + ', b stun ' + b.stun); calm();
  solo(); a = foe(22, 'squire', 0); b = foe(58); press('attack'); until(() => a.dead, 30); ok('...but an ordinary kill does not', a.dead && b.stun === 0); calm();
  solo(); e = foe(36); plungeLand(player); const plain = e.stun; solo({ meteor: 1 }); e = foe(36); plungeLand(player);
  ok('Meteor Plunge: a wider shockwave', plain === 0 && e.stun >= 40, plain + ' -> ' + e.stun);
  solo({ ward: 1 }); wardLeft = 1; e = foe(30); kill(player, -1); const saved = !player.dead && wardLeft === 0 && player.invuln > 0; player.invuln = 0; kill(player, -1);
  ok('Ward of Asher: turns one killing blow aside, then no more', saved && player.dead);
  until(() => !player.dead, 300); ok('...and is whole again on the next attempt', wardLeft === 1);
  const flask = o => { solo(o); const p = props[0]; player.x = p.x - 6; const q = foe(60), w = foe(84); press('grab'); until(() => q.stun > 0, 60); return [q.stun, w.stun]; }; const f0 = flask(), f1 = flask({ flask: 1 });
  ok('Powder Flask: the burst catches the foe beside the one you hit', f0[0] > 0 && f0[1] === 0 && f1[0] > 0 && f1[1] >= 30, f0 + ' -> ' + f1); freeze = 0;
  solo({ dread: 1 }); a = foe(30); b = foe(90); kill(a, 1); ok('Dread: a death freezes the nearest other foe', b.stun === 30, 'stun ' + b.stun); calm();
  solo(); e = foe(24); e.lunge = 9; step(); const g0 = e.stun; solo({ guard: 1 }); e = foe(24); e.lunge = 9; step();
  ok('Iron Guard: a thrust that lands on your guard staggers them', g0 === 0 && e.stun >= 14 && !player.dead, g0 + ' -> ' + e.stun); freeze = 0;

  // ---------- legendaries ----------
  solo({ echo: 1 }); e = foe(52, 'squire', 0); press('attack'); until(() => e.dead, 40);
  ok('Echo Blade: a thrust kills at a distance', e.dead && player.armed && Math.abs(e.x - player.x) > 35, 'gap ' + Math.abs(e.x - player.x).toFixed(0)); calm();
  ok('...and the ghost blade leaves nothing behind', swords.length <= 1 && !swords.some(s => s.home));
  solo({ echo: 1 }); e = foe(52, 'squire', 1); press('attack'); run(30); ok('...unless their guard is at its height', !e.dead);
  solo(); e = foe(52, 'squire', 0); press('attack'); run(30); ok('...and without the relic a thrust is just a thrust', !e.dead && projs.length === 0);
  solo({ storm: 1 }); const d = foe(110); for (let i = 0; i < 3; i++) { e = foe(30); kill(e, 1); calm(); } const queued = bolts.length; for (let i = 0; i < 20; i++) { step(); calm(); }
  ok('Stormcaller: the third kill calls lightning on the nearest foe', queued === 1 && d.dead, 'queued ' + queued + ', dead ' + d.dead);
  err = ''; try { boltFx.push({ x: player.x + 40, y: 120, t: 2, seed: 3 }); render(); } catch (x) { err = x.message; } ok('...and the bolt draws', !err, err); calm();
  solo(); press('parry'); const pr0 = player.parry; solo({ bell: 1 }); press('parry'); const pr1 = player.parry; a = foe(22); b = foe(60); a.lunge = 6; const did = tryParry(player, a);
  ok('Bell Shard: a longer parry that staggers everyone near', pr1 - pr0 === 6 && did && b.stun === 40 && a.stun > 0, pr0 + ' -> ' + pr1 + ', b stun ' + b.stun); freeze = 0;
  solo({ mark: 1 }); let g = foe(30, 'gaoler'); const hp0 = g.hp; kill(g, 1); const hp1 = g.hp; g.invuln = 0; kill(g, 1);
  ok("Executioner's Mark: two wounds a hit", hp0 === 4 && hp1 === 2 && g.dead); calm();
  solo({ cloak: 2 }); e = foe(30); kill(e, 1); ok('Wraith Cloak: untouchable after a kill', player.invuln === 65); calm();

  // ---------- foes that grow with the climb ----------
  window.aiInput = origAI;
  newGame(0); until(() => enemies.length);
  ok('the first landing is as it always was', threat() === 0 && enemies[0].T === TYPES.squire && queue.length + enemies.length === ZONES[0].enemies.length);
  const snap = JSON.stringify(TYPES); newGame(10); const q10 = queue.length; until(() => enemies.length); const E = enemies[0], B = TYPES[E.type];
  ok('high on the climb foes react sooner, wind up quicker and move faster', E.T !== B && E.T.reaction < B.reaction && E.T.tell < B.tell && E.T.speed > B.speed && E.T.aggr > B.aggr, E.type + ' tell ' + B.tell + '->' + E.T.tell + ' react ' + B.reaction + '->' + E.T.reaction);
  ok('...but the wind-up never becomes unreadable', Object.keys(TYPES).every(t => { zi = ZONES.length - 1; const x = makeFighter(0, GROUND, 'enemy', t); scaleFoe(x); return !TYPES[t].tell || x.T.tell >= 12; })); zi = 10;
  ok('...and the book of foes itself is unchanged', JSON.stringify(TYPES) === snap);
  ok('more of them come at you', q10 === ZONES[10].enemies.length + 2 && zoneMax() === ZONES[10].max + 1, 'queue ' + q10);
  newGame(3); ok('...but not yet on the lower landings', queue.length === ZONES[3].enemies.length && zoneMax() === ZONES[3].max);
  const wz = ZONES.findIndex(z => z.enemies.includes('warden')); newGame(wz); const qw = queue.length; until(() => enemies.length);
  ok('bosses stand alone and grow tougher', qw === 1 && enemies[0].T.boss && enemies[0].hp === TYPES.warden.hp + Math.floor(wz / 8), 'hp ' + enemies[0].hp);
  newGame(12); let el = 0, lowEl = 0; for (let i = 0; i < 300; i++) { zi = 12; const x = makeFighter(0, GROUND, 'enemy', 'squire'); scaleFoe(x); if (x.T.elite) { el++; if (x.hp !== 2) el = -999; } zi = 2; const y = makeFighter(0, GROUND, 'enemy', 'squire'); scaleFoe(y); if (y.T.elite) lowEl++; }
  ok('elites appear high on the climb and never at the bottom', el > 75 && el < 195 && lowEl === 0, el + '/300 at landing 13');
  newGame(12); queue = []; enemies = []; lastPickZone = 99; run(3); let x = null; while (!x || !x.T.elite) { x = makeFighter(player.x + 40, GROUND, 'enemy', 'squire'); scaleFoe(x); } x.onGround = true; enemies = [x];
  kill(x, 1); const alive = !x.dead && x.hp === 1; x.invuln = 0; kill(x, 1); ok('an elite takes two hits', alive && x.dead); calm();
  err = ''; try { x = makeFighter(player.x + 40, GROUND, 'enemy', 'duelist'); do scaleFoe(x); while (!x.T.elite); x.onGround = true; enemies = [x]; render(); } catch (q) { err = q.message; } ok('...and draws with its gold mark', !err, err);

  // ---------- the build on screen ----------
  err = ''; try {
    newGame(0); queue = []; enemies = []; lastPickZone = 99; run(5);
    for (let i = 0; i < RELICS.length; i += 3) { give(Object.fromEntries(RELICS.slice(0, i + 1).map((r, k) => [r.id, 1 + k % 3]))); offer = [0, 1, 2].map(k => RELICS[(i + k) % RELICS.length].id); pickT = 40; pickSel = i % 3; render(); }
    offer = null; give(Object.fromEntries(RELICS.slice(0, 16).map((r, k) => [r.id, 1 + k % 3]))); render(); keys.build = true; render(); keys.build = false; give({}); keys.build = true; render(); keys.build = false;
    give(Object.fromEntries(RELICS.slice(5, 21).map(r => [r.id, 1]))); state = 'win'; winT = 100; render(); state = 'play';
  } catch (q) { err = q.message; }
  ok('every icon, the choice, the build sheet and the win screen draw', !err, err);
  newGame(0); queue = []; enemies = []; lastPickZone = 99; run(5); give(Object.fromEntries(RELICS.slice(0, 16).map(r => [r.id, 2]))); const t0p = performance.now(); for (let i = 0; i < 10; i++) render(); const hudMs = (performance.now() - t0p) / 10;
  offer = RELICS.slice(0, 3).map(r => r.id); pickT = 40; const t1p = performance.now(); for (let i = 0; i < 10; i++) render(); const pickMs = (performance.now() - t1p) / 10; offer = null;
  ok('a full build costs nothing to draw', hudMs < 14 && pickMs < 16, hudMs.toFixed(1) + ' / ' + pickMs.toFixed(1) + ' ms');
  give({ boots: 2 }); newGame(0); ok('a new run starts with nothing', Object.keys(relics).length === 0 && relicOrder.length === 0 && !offer && lastPickZone === -1);

  // ---------- a whole run ----------
  newGame(0); let picks = 0, guard = 0; const tiers = [], zonesSeen = new Set();
  while (state === 'play' && guard++ < 90000) {
    if (offer) { if (pickT > 26) { tiers.push(offer.map(id => RELIC[id].tier).join('')); pressed.start = true; picks++; } step(); clearP(); continue; }
    zonesSeen.add(zi); player.invuln = 9999; calm();
    for (const q of enemies) if (!q.dead && q.anim > 20) { q.hp = 1; q.invuln = 0; kill(q, 1); }
    keys.right = cleared; if (cleared && player.onGround && (player.hitWall || !groundBelow(player.x + 7, player.y))) pressed.jump = true;
    step(); clearP();
  }
  keys.right = false; const total = Object.values(relics).reduce((s, v) => s + v, 0);
  ok('a whole run: every landing cleared, a relic chosen after each, the bell rung', state === 'win' && zonesSeen.size === ZONES.length && picks === ZONES.length - 1 && total === ZONES.length - 1, 'state ' + state + ', landing ' + (zi + 1) + ', picks ' + picks + ', relics ' + total + ', frames ' + guard);
  ok('...with legendaries from every boss landing', tiers.filter(t => t === '222').length === ZONES.filter((z, i) => zoneBoss(i)).length && tiers.filter(t => t === '222').length === 4, tiers.join(' '));
  err = ''; try { render(); } catch (q) { err = q.message; } ok('...and the build shown at the bell', !err && relicOrder.length > 0, err);

  window.aiInput = origAI; keys.build = false; newGame(0); state = 'title'; localStorage.removeItem('riposte.wardrobe');
  window.__results10 = R.join('\n');
})();

// ===== second batch of landings: the Foundry, forgehands, the two founders (appended) =====
window.__results11 = null;
(async () => {
  for (let i = 0; i < 3400 && !window.__results10; i++) await new Promise(r => setTimeout(r, 100));
  buildsOn = true;
  const R = []; const ok = (n, c, info = '') => R.push((c ? 'PASS ' : 'FAIL ') + n + (info ? '  [' + info + ']' : ''));
  const run = n => { for (let i = 0; i < n; i++) step(); };
  const clearP = () => { for (const k in pressed) pressed[k] = false; };
  const press = k => { pressed[k] = true; step(); clearP(); };
  const origAI = aiInput; const idle = () => { window.aiInput = () => ({}); };
  const calm = () => { slowmo = 0; fin = null; freeze = 0; };
  const give = o => { relics = Object.assign({}, o); relicOrder = Object.keys(o); };
  const solo = (o = {}) => { newGame(0); queue = []; enemies = []; lastPickZone = 99; run(5); clearP(); keys.right = keys.left = keys.attack = false; give(o); player.x += 80; player.cool = 0; player.invuln = 0; };
  const foe = (dx, type = 'squire', stance = 1) => { const e = makeFighter(player.x + dx, GROUND, 'enemy', type); e.onGround = true; e.facing = dx > 0 ? -1 : 1; e.stance = e.prevStance = stance; enemies.push(e); return e; };
  const until = (f, max = 400) => { let n = 0; while (!f() && n < max) { step(); n++; } return n; };
  const zoneOf = name => ZONES.findIndex(z => z.name === name);
  const NEW = ['The Tilt Yard', 'The Drowned Choir', 'The Bellows Room', 'The Casting Floor', 'The Chain Gallery', "The Founders' Anvil", 'The Throne Gallery'];

  ok('the climb is now twenty-four landings', ZONES.length === 24 && ZONES[23].name === 'The Bell' && BELL_X === 23 * ZW + 240 && SKY_POS.length === 24);
  ok('all seven new landings exist', NEW.every(n => zoneOf(n) >= 0), NEW.filter(n => zoneOf(n) < 0).join(','));
  ok('six acts: gate, hall, foundry, frozen night, spire, bell', ZONES.map(z => z.act).join('') === '000001111122223333444445' && ACTS.length === 6);
  ok('every act opens with a title card', ZONES.every((z, i) => !!z.title === (i === 0 || z.act !== ZONES[i - 1].act)));
  ok('every foe on the list is a real type with a look', ZONES.every(z => z.enemies.every(t => TYPES[t] && LOOKS[t])));

  // ---------- the foundry ----------
  const bz = zoneOf('The Bellows Room'); newGame(bz); run(20); let A = curAct();
  ok('the foundry is its own place: molten light, embers, no rain, no snow', A.forge === true && !A.wet && !A.snow && !A.grass && ZONES[zi].weather === 'embers' && A.moons.length === 0, 'sky=' + skyPos);
  newGame(zoneOf('The White Parapet')); run(20); A = curAct(); ok('above it the frozen night is as it was', A.snow === true && !A.forge && A.moons.length === 1 && A.moons[0].pale === true && A.starA === 1);
  newGame(zoneOf('The Dais')); run(20); A = curAct(); ok('...and the spire keeps its blood moon', !A.snow && !A.forge && A.moons.length === 1 && !A.moons[0].pale);
  state = 'title'; skyKey = ''; A = curAct(); ok('the title storm is unchanged', A.wet === true && !A.snow && !A.forge && A.moons.length === 1 && !A.moons[0].pale); newGame(0);
  let err = ''; try { newGame(zoneOf('The Casting Floor')); for (let i = 0; i < 60; i++) { step(); if (i % 6 === 0) render(); } } catch (x) { err = x.message; } ok('the molten channels draw', !err, err);

  // ---------- forgehands ----------
  idle();
  const wind = (o, type = 'forgehand') => { solo(o); const q = foe(30, type); q.cool = 0; window.aiInput = x => x === q && !q.d2 ? (q.d2 = true, { heavyP: true }) : {}; step(); idle(); return q; };
  let fh = wind(); const w0 = fh.windup;
  ok('a forgehand draws his heavy lunge back for a long beat', w0 === 28, 'windup ' + w0);
  err = ''; try { render(); } catch (x) { err = x.message; } ok('...with an amber star on the point', !err, err);
  until(() => !player.armed || player.dead || (fh.windup === 0 && fh.lunge === 0), 90);
  ok('it tears the blade from a matched guard', !player.armed && !player.dead); freeze = 0;
  fh = wind(); until(() => fh.windup <= 2, 60); press('parry'); until(() => fh.stun > 0 || player.dead || !player.armed, 40);
  ok('a parry stops it', player.armed && !player.dead && fh.stun > 0, 'armed ' + player.armed + ', stun ' + fh.stun); freeze = 0;
  fh = wind(); keys.right = true; run(6); keys.right = false; press('attack'); until(() => fh.dead || player.dead, 30);
  ok('a thrust while he draws back kills him', fh.dead && !player.dead && player.armed); calm();
  solo(); fh = foe(24, 'forgehand'); disarm(fh, player); ok('his grip cannot be broken', fh.armed && fh.stun > 0); freeze = 0;
  ok("Duelist's Eye lengthens that beat too", wind({ eye: 2 }).windup === 31);
  ok('the Gaoler and the Warden lunge as they always did', wind({}, 'gaoler').windup === 14 && wind({}, 'warden').windup === 14);
  solo(); press('heavy'); ok('...and so do you', player.windup === 14);

  // ---------- the two founders ----------
  window.aiInput = origAI;
  const az = zoneOf("The Founders' Anvil"); newGame(az); const qa = queue.length; player.invuln = 9999; let n = 0; while (enemies.length < 2 && n < 600) { player.invuln = 9999; step(); n++; }
  ok('the two founders come at you together', qa === 2 && enemies.length === 2 && enemies.map(e => e.type).join() === 'hammer,tongs' && enemies.every(e => e.T.boss), enemies.map(e => e.type).join());
  ok('...and no one else joins them', queue.length === 0 && zoneMax() === 2);
  err = ''; try { render(); } catch (x) { err = x.message; } ok('both of their bars draw', !err, err);
  idle(); const hm = enemies[0], tg = enemies[1]; calm(); hm.hp = 1; hm.invuln = 0; kill(hm, 1);
  ok('the first to fall is not the finisher', hm.dead && !fin && slowmo === 0 && !cleared);
  freeze = 0; run(5); tg.hp = 1; tg.invuln = 0; kill(tg, 1);
  ok('the second is', tg.dead && !!fin && fin.boss === true && slowmo > 100);
  calm(); player.invuln = 9999; until(() => offer, 400);
  ok('together they are worth a legendary', !!offer && offer.every(id => RELIC[id].tier === 2)); if (offer) { run(14); press('foe1'); }
  window.aiInput = origAI;
  ok('new foes drop new cosmetics', COSMETIC_BY_ID.forge_sash && COSMETIC_BY_ID.hammer_cape && COSMETIC_BY_ID.tongs_mask);

  // ---------- layouts ----------
  buildsOn = false;
  let bad = []; for (const nm of NEW) { const z = zoneOf(nm), z0 = z * ZW; if (!solidAt(z0 + 26, GROUND + 1) || !solidAt(z0 + 294, GROUND + 1) || solidAt(z0 + 26, GROUND - 1) || solidAt(z0 + 294, GROUND - 1)) bad.push(nm); }
  ok('both ends of each new landing are level ground for foes to walk in on', bad.length === 0, bad.join(','));
  bad = []; for (const nm of NEW) { const z = zoneOf(nm); for (const t of torches.filter(t => t > z * ZW && t < (z + 1) * ZW)) if (platforms.some(p => t > p.x - 4 && t < p.x + p.w + 4 && p.y > 100) || !solidAt(t, GROUND + 1) || solidAt(t, GROUND - 1)) bad.push(nm + '@' + (t - z * ZW)); }
  ok('no torch stands under a platform, on a step or over a pit', bad.length === 0, bad.join(','));
  bad = []; for (const nm of NEW) { const z = zoneOf(nm); newGame(z); for (const p of props) if (!solidAt(p.x, p.y + 1) && !platforms.some(q => p.x >= q.x && p.x <= q.x + q.w && Math.abs(q.y - p.y) < 1)) bad.push(nm + '@' + (p.x - z * ZW)); }
  ok('every prop on the new landings rests on something', bad.length === 0, bad.join(','));
  bad = []; window.aiInput = () => ({});
  for (const nm of NEW) {
    const z = zoneOf(nm); newGame(z); queue = []; enemies = []; cleared = true; clearP(); let done = false;
    for (let i = 0; i < 900 && !done; i++) { keys.right = true; if (player.onGround && (player.hitWall || !groundBelow(player.x + 7, player.y))) pressed.jump = true; step(); clearP(); if (player.dead) break; if (player.x > z * ZW + 300) done = true; }
    keys.right = false; if (!done) bad.push(nm + (player.dead ? ' died' : ' stuck@' + Math.round(player.x - z * ZW)));
  }
  ok('each new landing can be crossed on foot', bad.length === 0, bad.join(', '));
  window.aiInput = origAI; bad = []; const fell = [];
  for (const nm of NEW) {
    const z = zoneOf(nm); newGame(z); clearP(); let seen = 0, t = 0;
    for (; t < 3000 && seen < ZONES[z].enemies.length; t++) { player.invuln = 9999; step(); for (const e of enemies) { if (!e.counted) { e.counted = true; seen++; } if (e.fell && !e.fellNoted) { e.fellNoted = true; fell.push(nm + ':' + e.type); } if (!e.dead && t % 90 === 0 && Math.abs(e.x - player.x) < 60) { e.hp = 1; e.invuln = 0; kill(e, 1); } } slowmo = 0; fin = null; }
    if (seen < ZONES[z].enemies.length) bad.push(nm + ' ' + seen + '/' + ZONES[z].enemies.length);
  }
  ok('every foe on the new landings arrives', bad.length === 0, bad.join(', '));
  ok('...and none walks into a pit', fell.length === 0, fell.join(', '));
  // the player stands clear of the edges: met at the lip by your blade, a leaping foe is thrown back in, and that is fair play
  let falls = 0; const cz = zoneOf('The Casting Floor'); for (let k = 0; k < 16; k++) { newGame(cz); clearP(); queue = ['forgehand']; spawnT = 1; player.x = cz * ZW + (k % 2 ? 60 : 284); for (let i = 0; i < 900; i++) { player.invuln = 9999; step(); if (enemies[0] && enemies[0].fell) { falls++; break; } } }
  ok('forgehands cross the channels without falling in', falls === 0, falls + '/16 fell');
  err = ''; try { for (const nm of NEW) { newGame(zoneOf(nm)); for (let i = 0; i < 240; i++) { step(); if (i % 8 === 0) render(); } } } catch (x) { err = x.message + ' @' + ZONES[zi].name; }
  ok('the new landings play and draw without errors', !err, err);
  let worst = 0; for (const nm of NEW) { newGame(zoneOf(nm)); run(60); const t0 = performance.now(); for (let i = 0; i < 5; i++) render(); worst = Math.max(worst, (performance.now() - t0) / 5); }
  ok('the new landings draw fast enough', worst < 14, worst.toFixed(1) + ' ms');
  buildsOn = true;

  // ---------- a longer climb, a bigger build ----------
  err = ''; try { newGame(0); queue = []; enemies = []; lastPickZone = 99; run(5); give(Object.fromEntries(RELICS.slice(0, 23).map((r, k) => [r.id, 1 + k % 2]))); render(); keys.build = true; render(); keys.build = false; state = 'win'; winT = 100; render(); state = 'play'; } catch (x) { err = x.message; }
  ok('a twenty-three relic build fits the HUD, the sheet and the win screen', !err && 18 + 23 * 22 < W * S * 0.6 && 23 * 32 < W * S, err);
  newGame(ZONES.length - 2); ok('extra foes stop at three a landing', Math.min(3, Math.floor(threat() / 5)) === 3 && queue.length === 1);
  newGame(zoneOf('The Ossuary')); ok('...even at the top', queue.length === ZONES[zi].enemies.length + 3, 'queue ' + queue.length);
  ok('progress pips still fit', 18 + ZONES.length * 17 < W * S / 2);

  window.aiInput = origAI; keys.build = false; keys.right = false; newGame(0); state = 'title'; localStorage.removeItem('riposte.wardrobe');
  window.__results11 = R.join('\n');
})();
