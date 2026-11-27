// RIPOSTE — the 3D edition's view (opened from 3d.html; the 2D game in index.html does not load this file).
// game.js runs the duel exactly as before (rules, enemy brains, input). This file only replaces render():
// every frame it reads the game's state and poses a 3D scene from it. The 2D canvas is kept for the HUD.
import * as THREE from 'three';

const view = document.getElementById('view3d');
const renderer = new THREE.WebGLRenderer({ canvas: view, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9c5878, 160, 1000);
const camera = new THREE.PerspectiveCamera(30, 16 / 9, 2, 3000);
const Y = y => GROUND - y;                       // game y (down) -> world y (up); the main floor is y = 0
const col = h => new THREE.Color(h);
const UP = new THREE.Vector3(0, 1, 0), _d = new THREE.Vector3();

// ---------- shared geometry & helpers ----------
const CYL = new THREE.CylinderGeometry(1, 1, 1, 10), SPH = new THREE.SphereGeometry(1, 14, 10), BOX = new THREE.BoxGeometry(1, 1, 1);
const TAPER = new THREE.CylinderGeometry(1.15, 0.9, 1, 12);
const std = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, metalness: 0 }, o));
const glowMat = c => new THREE.MeshBasicMaterial({ color: c, fog: false });
function mesh(geo, mat, parent, shadow = true) { const m = new THREE.Mesh(geo, mat); m.castShadow = shadow; m.receiveShadow = shadow; parent.add(m); return m; }
// stretch a unit cylinder/box between two points
function limb(m, ax, ay, az, bx, by, bz, r, rz = r) {
  _d.set(bx - ax, by - ay, bz - az); const L = _d.length() || 0.001;
  m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); m.scale.set(r, L, rz);
  m.quaternion.setFromUnitVectors(UP, _d.multiplyScalar(1 / L));
}
const sprites = [];
const glowTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
function glow(parent, c, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
  s.scale.set(size, size, 1); parent.add(s); sprites.push(s); return s;
}

// ---------- sky, sun, light ----------
const skyC = document.createElement('canvas'); skyC.width = 4; skyC.height = 256;
const skyX = skyC.getContext('2d'), skyTex = new THREE.CanvasTexture(skyC); skyTex.colorSpace = THREE.SRGBColorSpace;
scene.background = skyTex;
const hemi = new THREE.HemisphereLight(0xffffff, 0x222222, 1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.5); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.5;
Object.assign(sun.shadow.camera, { left: -190, right: 190, top: 150, bottom: -60, near: 10, far: 700 }); sun.shadow.camera.updateProjectionMatrix();
scene.add(sun); scene.add(sun.target);
const fill = new THREE.DirectionalLight(0xffffff, 1.5); scene.add(fill); scene.add(fill.target);   // soft light from the camera's side so faces and colours read
const sunDisc = mesh(new THREE.CircleGeometry(1, 40), glowMat(0xfff4d8), scene, false), sunGlow = glow(scene, 0xffba78, 520);
const moonDisc = mesh(new THREE.CircleGeometry(1, 40), glowMat(0xe07060), scene, false);

// ---------- the world, built once from the game's own level data ----------
const world = new THREE.Group(); scene.add(world);
const stoneT = new THREE.CanvasTexture(stoneTex); stoneT.wrapS = stoneT.wrapT = THREE.RepeatWrapping; stoneT.colorSpace = THREE.SRGBColorSpace;
const stoneMat = std(0xffffff, { map: stoneT, roughness: 0.95 }), ruinMat = std(0x5a3656, { roughness: 1 }), farMat = std(0x5a3656, { roughness: 1 });
const woodMat = std(0x6a4a30), ironMat = std(0x1d1b21, { roughness: 0.6, metalness: 0.5 }), bannerMat = std(0x6a1a2a, { side: THREE.DoubleSide, roughness: 1 });
const FRONT = 34, BACK = -60;                    // how far the floor runs toward and away from the camera
function texturedBox(w, h, d) {                  // a box whose stone texture keeps one scale whatever its size
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / 42, uv.getY(k) * dims[f][1] / 42); }
  return g;
}
for (const s of solids) {
  const h = s.y >= GROUND ? 240 : s.h, m = mesh(texturedBox(s.w, h, FRONT - BACK), stoneMat, world);
  m.position.set(s.x + s.w / 2, Y(s.y) - h / 2, (FRONT + BACK) / 2);
}
for (const p of platforms) {
  mesh(BOX, woodMat, world).position.set(p.x + p.w / 2, Y(p.y) - 1.2, 0); world.children[world.children.length - 1].scale.set(p.w, 2.4, 13);
  for (const cx of [p.x + 2, p.x + p.w - 2]) for (const cz of [-5.5, 5.5]) { const c = mesh(CYL, ironMat, world, false); limb(c, cx, Y(p.y), cz, cx, 260, cz, 0.22); }
}
// a colonnade behind the floor, a second ruined row further off, mountains and the bell spire on the horizon
const totalW = ZONES.length * ZW;
for (const [z, sp, hgt, mat] of [[BACK + 9, 70, 66, ruinMat], [-190, 118, 120, farMat]]) {
  let prev = null;
  for (let k = -3; k * sp < totalW + 260; k++) {
    const x = k * sp + hash(k + z) * 20, tall = hgt * (0.82 + hash(k + 1 + z) * 0.3), w = 8 + hash(k + 2) * 3;
    const grounded = z < -100 || solidAt(x, GROUND + 1);
    if (grounded) {
      mesh(BOX, mat, world).position.set(x, tall / 2 - (z < -100 ? 30 : 0), z); world.children[world.children.length - 1].scale.set(w, tall + (z < -100 ? 60 : 0), w);
      const cap = mesh(BOX, mat, world); cap.position.set(x, tall + 1.2, z); cap.scale.set(w + 3.4, 2.6, w + 3.4);
      if (hash(k + 5) > 0.5) { const br = mesh(BOX, mat, world); br.position.set(x + 1, tall + 5, z); br.scale.set(w * 0.6, 8, w * 0.7); br.rotation.z = 0.2; }
    }
    if (prev && grounded && prev.grounded && hash(k + 3) > 0.3) {   // a pointed arch springing between two standing columns
      const top = Math.min(prev.tall, tall), half = (x - prev.x) / 2;
      const arch = mesh(new THREE.TorusGeometry(half, 1.7, 6, 22, Math.PI), mat, world); arch.position.set(prev.x + half, top, z); arch.scale.set(1, 0.8, 1.6);
    }
    prev = { x, tall, grounded };
  }
}
const backdrop = [];
function ridge(z, base, amp, freq, seed, mat) {
  const sh = new THREE.Shape(); sh.moveTo(-1400, -400);
  for (let x = -1400; x <= totalW + 1800; x += 40) sh.lineTo(x, base + amp * (fbm2(x * freq + seed, seed, 4) - 0.35) * 2);
  sh.lineTo(totalW + 1800, -400);
  const m = mesh(new THREE.ShapeGeometry(sh), mat, scene, false); m.position.z = z; backdrop.push(m); return m;
}
const farRidgeMat = new THREE.MeshBasicMaterial({ color: 0x8a5a78, fog: false }), midRidgeMat = new THREE.MeshBasicMaterial({ color: 0x5a3656, fog: false });
ridge(-1500, 0, 95, 0.0016, 11, farRidgeMat); ridge(-900, -40, 70, 0.003, 47, midRidgeMat);
const spire = new THREE.Group(); scene.add(spire); backdrop.push(spire);
mesh(BOX, midRidgeMat, spire, false).scale.set(46, 420, 46); spire.children[0].position.y = 150;
mesh(new THREE.ConeGeometry(34, 150, 4), midRidgeMat, spire, false).position.y = 430;
mesh(BOX, glowMat(0xffd27a), spire, false).position.set(0, 330, 24); spire.children[2].scale.set(9, 16, 1); glow(spire, 0xffc060, 150).position.set(0, 330, 30);
spire.position.set(totalW * 0.5, 0, -1100);

// torches, banners, bell, the barrier at the zone's end
const flameMat = glowMat(0xffb040), torchObjs = torches.map(t => {
  const g = new THREE.Group(); g.position.set(t, 0, -10); world.add(g);
  limb(mesh(CYL, ironMat, g), 0, 0, 0, 0, 25, 0, 0.36); const cup = mesh(new THREE.CylinderGeometry(2, 1.1, 2.4, 8), ironMat, g); cup.position.y = 26;
  const fl = mesh(new THREE.ConeGeometry(1.5, 5.4, 8), flameMat.clone(), g, false); fl.position.y = 30;
  const core = mesh(new THREE.ConeGeometry(0.7, 3, 8), glowMat(0xfff4d8), g, false); core.position.y = 29;
  return { t, g, fl, core, halo: glow(g, 0xff9a46, 24) };
});
torchObjs.forEach(o => o.halo.position.y = 30);
const torchLights = [0, 1, 2].map(() => { const l = new THREE.PointLight(0xffa050, 0, 170, 1.7); scene.add(l); return l; });
const flashLights = [0, 1].map(() => { const l = new THREE.PointLight(0xfff0c8, 0, 120, 1.6); scene.add(l); return l; });
const bannerObjs = new Map();
const bell = mesh(new THREE.CylinderGeometry(4.5, 9, 13, 16, 1, true), std(0xc9a24a, { metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide }), scene);
bell.position.set(BELL_X, 44, 0);
const barrier = mesh(new THREE.PlaneGeometry(1, 150), new THREE.MeshBasicMaterial({ color: 0xff3c5a, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), scene, false);
barrier.rotation.y = Math.PI / 2; barrier.scale.x = FRONT - BACK;

// ---------- fighters: a 3D puppet posed from the game's own skeleton ----------
const bladeMat = std(0xdfe7ee, { metalness: 0.95, roughness: 0.22 }), goldMat = std(0xc8a060, { metalness: 0.8, roughness: 0.4 });
const figs = new Map();
function makeFig(f) {
  const look = lookOf(f), g = new THREE.Group(); scene.add(g);
  const ghost = look.smoke ? { transparent: true, opacity: 0.78 } : {};
  const lit = (c, k = 0.1) => col(c).lerp(col('#ffffff'), k);
  const body = std(lit(look.body), ghost), back = std(lit(look.back || look.body, 0.07), ghost), boot = std(lit(look.boots || look.back || look.body, 0.05), ghost);
  const P = { g, look };
  const c = (mat, geo = CYL) => mesh(geo, mat, g);
  P.torso = c(body, TAPER); P.pelvis = c(body, SPH); P.chest = c(body, SPH); P.head = c(body, SPH); P.neck = c(body);
  P.thA = c(body); P.shA = c(boot); P.ftA = c(boot, BOX); P.thB = c(back); P.shB = c(boot); P.ftB = c(boot, BOX);
  P.upA = c(body); P.foA = c(body); P.hdA = c(body, SPH); P.upB = c(back); P.foB = c(back); P.hdB = c(back, SPH);
  P.blade = c(bladeMat); P.guard = c(goldMat, SPH); P.pommel = c(goldMat, SPH); P.blade2 = c(bladeMat);
  P.tip = glow(g, f.team === 'player' ? 0xbef0ff : 0xffe2aa, 6);
  if (look.eye) { P.eye = mesh(SPH, glowMat(look.eye), g, false); P.eyeGlow = glow(g, look.eye, 5); }
  if (look.hat) {
    const hm = std(look.hat, { roughness: 0.7 }), hat = new THREE.Group(); g.add(hat); P.hat = hat;
    const crown = mesh(new THREE.CylinderGeometry(1.22, 1.3, 2.3, 14), hm, hat); crown.position.y = 1.2;
    const brim = mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.2, 22), hm, hat); brim.position.y = 0.1; brim.rotation.x = 0.1;
    if (look.cavalier) { const band = mesh(new THREE.CylinderGeometry(1.34, 1.36, 0.6, 14), std(look.cavalier), hat); band.position.y = 0.55; }
    P.plume = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => { const s = mesh(SPH, std(look.feather || '#ffffff', { roughness: 1 }), hat); s.scale.set(1.1 - i * 0.05, 0.9 - i * 0.04, 0.5); return s; });
  }
  if (look.helm) { P.helm = mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), std(look.helm, { metalness: 0.7, roughness: 0.4 }), g); }
  if (look.crown) { P.crown = mesh(new THREE.CylinderGeometry(1.3, 1.2, 1, 10, 1, true), std(look.crown, { metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide }), g); }
  if (look.longcoat || look.coat) { const cm = std(lit(look.body, 0.08), { side: THREE.DoubleSide }); P.tails = [0, 1, 2, 3].map(() => mesh(BOX, cm, g)); if (look.longcoat) P.hem = [0, 1].map(() => mesh(BOX, std(look.longcoat, { metalness: 0.6, roughness: 0.5 }), g)); }
  if (look.cape) P.cape = mesh(BOX, std(look.cape, { side: THREE.DoubleSide, roughness: 1 }), g);
  if (look.scarf) { const cols = look.scarf; P.scarf = [0, 1, 2, 3, 4, 5, 6].map(i => mesh(CYL, std(cols[Math.min(2, Math.floor(i / 2.4))], { roughness: 1 }), g, false)); }
  figs.set(f, P); return P;
}
function poseFig(f, P, t) {
  const g = P.g, look = P.look;
  // glide between simulation ticks in slow motion, exactly as the 2D view does
  const kx = f.x, ky = f.y; if (t < 1 && f.ox !== undefined) { f.x = f.ox + (f.x - f.ox) * t; f.y = f.oy + (f.y - f.oy) * t; }
  const R = rig(f, f.x), Hd = handsFor(f, R), d = R.d, s = R.s, L = R.L;
  const X = f.x, FY = f.y; f.x = kx; f.y = ky;
  const lx = x => x - X, ly = y => FY - y;                     // skeleton point -> local 3D
  g.position.set(X, Y(FY), 0); g.rotation.set(0, 0, 0); g.scale.setScalar(1); g.visible = FY < H + 30;
  const hip = [lx(R.hip[0]), ly(R.hip[1])], neck = [lx(R.neck[0]), ly(R.neck[1])], head = [lx(R.head[0]), ly(R.head[1])], sh = [lx(R.sh[0]), ly(R.sh[1])];
  const B = (look.broad || 1) * s;
  limb(P.torso, hip[0], hip[1], 0, neck[0], neck[1], 0, 1.42 * B, 1.15 * B);
  P.pelvis.position.set(hip[0], hip[1], 0); P.pelvis.scale.set(1.3 * B, 1.2 * s, 1.15 * B);
  P.chest.position.set(sh[0], sh[1] + 0.2, 0); P.chest.scale.set(1.5 * B, 1.3 * s, 1.75 * B);
  limb(P.neck, neck[0], neck[1], 0, head[0], head[1], 0, 0.6 * s);
  P.head.position.set(head[0], head[1], 0); P.head.scale.setScalar(L.head * 1.08);
  const leg = (th, shn, ft, k, z) => {
    const kn = [lx(k[0]), ly(k[1])], fo = [lx(k[2]), ly(k[3])];
    limb(th, hip[0], hip[1], z * 0.8, kn[0], kn[1], z, 0.98 * s); limb(shn, kn[0], kn[1], z, fo[0], fo[1] + 0.5, z, 0.74 * s);
    ft.position.set(fo[0] + d * 0.8 * s, fo[1] + 0.42 * s, z); ft.scale.set(2.5 * s, 0.85 * s, 1.15 * s);
  };
  leg(P.thA, P.shA, P.ftA, R.ka, 1.0 * s); leg(P.thB, P.shB, P.ftB, R.kb, -1.0 * s);
  const arm = (up, fo, hd, target, z) => {
    const e = ik(R.sh[0], R.sh[1], target[0], target[1], L.upper, L.fore, d), el = [lx(e[0]), ly(e[1])], ha = [lx(e[2]), ly(e[3])];
    limb(up, sh[0], sh[1], z, el[0], el[1], z * 0.9, 0.7 * B); limb(fo, el[0], el[1], z * 0.9, ha[0], ha[1], z * 0.55, 0.56 * s);
    hd.position.set(ha[0], ha[1], z * 0.55); hd.scale.setScalar(0.62 * s); return ha;
  };
  const hb = arm(P.upB, P.foB, P.hdB, Hd.off, -1.75 * B), ha = arm(P.upA, P.foA, P.hdA, Hd.hand, 1.75 * B), bz = 1.75 * B * 0.55;
  // the sword
  const armed = f.armed && !f.dead; P.blade.visible = P.guard.visible = P.pommel.visible = armed; P.tip.visible = false; P.blade2.visible = armed && !!f.offhand;
  if (armed) {
    const b = Hd.blade; let tx, ty;
    if (b[0] === null) { tx = lx(b[2]); ty = ly(b[3]); } else { tx = ha[0] + (b[2] - b[0]); ty = ha[1] - (b[3] - b[1]); }
    limb(P.blade, ha[0], ha[1], bz, tx, ty, bz, 0.17, 0.09);
    const ux = tx - ha[0], uy = ty - ha[1], ul = Math.hypot(ux, uy) || 1;
    P.guard.position.set(ha[0] + ux / ul * 0.5, ha[1] + uy / ul * 0.5, bz); P.guard.scale.set(0.42, 0.42, 1.25);
    P.pommel.position.set(ha[0] - ux / ul * 1.5, ha[1] - uy / ul * 1.5, bz); P.pommel.scale.setScalar(0.36);
    if (f.offhand) limb(P.blade2, hb[0], hb[1], -bz, hb[0] + d * 11, hb[1] + 1.5, -bz, 0.15, 0.08);
    // the glint that gives a thrust away, the live point of a lunge, the readiness of a riposte
    let gl = 0;
    if (f.prep > 0) { const a0 = Math.max(0, 1 - f.prepT / 9), a1 = f.prep <= 5 ? (6 - f.prep) / 5 : 0; gl = (f.team === 'player' ? 3 : 6) + a0 * 9 + a1 * 5 + (f.glint > 0 ? 5 : 0); }
    else if (lungeExt(f) >= 6) gl = f.heavyL ? 9 : 5.5; else if (f.riposteT > 0) gl = 5 + Math.sin(tick * 0.6) * 1.2; else if (f.windup > 0) gl = 5 + Math.sin(tick * 0.8) * 2; else if (f.parry > 6) gl = 7;
    if (gl > 0) { P.tip.visible = true; P.tip.position.set(tx, ty, bz + 0.3); P.tip.scale.set(gl, gl, 1); }
  }
  // head-dress
  const hx = head[0], hy = head[1], hr = L.head * 1.08;
  if (P.eye) { P.eye.position.set(hx + d * hr * 0.75, hy + 0.1, 0.55 * s); P.eye.scale.setScalar(0.3 * s); P.eyeGlow.position.set(hx + d * hr * 0.9, hy + 0.1, 0.9 * s); P.eye.visible = P.eyeGlow.visible = !f.dead; }
  const cx = THREE.MathUtils.clamp(f.cx || 0, -4.5, 4.5), cy = THREE.MathUtils.clamp(f.cy || 0, -4, 1.5);
  if (P.hat) {
    P.hat.position.set(hx, hy + hr * 0.62, 0); P.hat.scale.setScalar(s); P.hat.rotation.z = -d * 0.06;
    P.plume.forEach((q, i) => { const u = i / 10; q.position.set(d * (2.4 - u * 6.2) + cx * u * 0.7, 1.4 + Math.sin(u * 2.6) * 4.4 - u * 0.6 - Math.abs(cx) * u * 0.25, -1.3 + Math.sin(tick * 0.09 + i) * 0.15 * u); });
  }
  if (P.helm) { P.helm.position.set(hx, hy + 0.1, 0); P.helm.scale.setScalar(hr * 1.14); }
  if (P.crown) { P.crown.position.set(hx, hy + hr * 0.9, 0); P.crown.scale.setScalar(s); }
  // cloth: coat tails, cape and scarf swing on the game's own cloth spring
  const lift = cy - Math.abs(cx) * 0.24, wv = Math.sin(tick * 0.2) * 0.25;
  if (P.tails) {
    const len = look.longcoat ? 6.4 : 3.4;
    [[-d * 1.3, -d * 2.6 + cx, 1.15, 1], [-d * 1.3, -d * 2.6 + cx, -1.15, 1], [d * 1.0, d * 0.9 + cx * 0.45, 1.3, 0.92], [d * 1.0, d * 0.9 + cx * 0.45, -1.3, 0.92]].forEach(([ax, bx, z, k], i) => {
      const ex = hip[0] + bx * s, ey = hip[1] - len * k * s + lift * (i < 2 ? 1 : 0.6) + (i % 2 ? wv : -wv);
      limb(P.tails[i], hip[0] + ax * s * 0.6, hip[1] + 0.6, z * s * 0.8, ex, ey, z * s * 1.25, 0.16, 1.3 * s);
      if (P.hem && i < 2) { P.hem[i].position.set(ex, ey, z * s * 1.25); P.hem[i].scale.set(0.34, 0.34, 2.5 * s); }
    });
  }
  if (P.cape) limb(P.cape, sh[0] - d * 0.4, sh[1] + 0.6, 0, sh[0] - d * 3.2 + cx * 1.5, sh[1] - f.h * 0.66 + lift, 0, 0.14, 2.6 * s);
  if (P.scarf) {
    const pts = f.scarf, n = P.scarf.length; let px = neck[0], py = neck[1];
    for (let i = 0; i < n; i++) {
      const q = pts && pts.length > 1 ? pts[Math.min(pts.length - 1, 1 + Math.floor(i * (pts.length - 1) / n))] : null, qx = q ? q.x - X : px - d * 1.6, qy = q ? FY - q.y : py - 0.3;
      limb(P.scarf[i], px, py, -1.2, qx, qy, -1.5 - i * 0.12, 0.48 - i * 0.045, 0.16); px = qx; py = qy;
    }
  }
  // whole-body states the skeleton does not cover
  if (f.dead || f.down > 0) {
    const k = f.dead ? Math.min(1, f.deadT / 14) : 1, e = 1 - (1 - k) * (1 - k);
    g.rotation.z = f.facing * (Math.PI / 2 - 0.06) * e; g.position.y += 1.2 * e * s;
  } else if (f.roll > 0) {
    g.rotation.z = -f.rollDir * (16 - f.roll) / 16 * Math.PI * 2; g.scale.setScalar(0.62); g.position.y += 5.2 * s;
  }
}

// ---------- small things: props, loose swords, thrown blades, loot ----------
const PROPC = { pot: 0xa8623e, stool: 0x7a5632, bottle: 0x3f7a5e, skull: 0xd8d0b8, lantern: 0x1a161c };
const propObjs = new Map();
function makeProp(p) {
  const g = new THREE.Group(), m = std(PROPC[p.kind]); scene.add(g);
  const inner = new THREE.Group(); inner.position.y = 3; g.add(inner); g.userData.inner = inner;
  const add = (geo, mat, x, y, z, sx, sy, sz) => { const o = mesh(geo, mat, inner); o.position.set(x, y - 3, z); o.scale.set(sx, sy, sz); return o; };
  if (p.kind === 'pot') { add(SPH, m, 0, 2.6, 0, 2.9, 2.7, 2.9); add(CYL, m, 0, 5.4, 0, 1.6, 1.6, 1.6); add(CYL, std(0x6a3a22), 0, 6.3, 0, 1.9, 0.5, 1.9); }
  else if (p.kind === 'bottle') { add(CYL, std(PROPC.bottle, { roughness: 0.2, metalness: 0.3 }), 0, 2.1, 0, 1.1, 4.2, 1.1); add(CYL, m, 0, 5.3, 0, 0.45, 2.4, 0.45); }
  else if (p.kind === 'stool') { add(BOX, m, 0, 4.5, 0, 6.4, 1, 5); for (const [x, z] of [[-2.3, -1.6], [2.3, -1.6], [-2.3, 1.6], [2.3, 1.6]]) add(BOX, std(0x4a321c), x, 2.1, z, 0.7, 4.2, 0.7); }
  else if (p.kind === 'skull') { add(SPH, m, 0, 2.5, 0, 2.1, 2.1, 2.2); add(BOX, m, 0.2, 0.8, 0, 2.3, 1.5, 2.2); add(SPH, glowMat(0x15101a), 1.5, 2.5, 0.8, 0.6, 0.6, 0.6); add(SPH, glowMat(0x15101a), 1.5, 2.5, -0.8, 0.6, 0.6, 0.6); }
  else { add(BOX, glowMat(0xffbe64), 0, 2.8, 0, 2.2, 4.4, 2.2); add(BOX, m, 0, 0.25, 0, 3.2, 0.5, 3.2); add(BOX, m, 0, 5.3, 0, 2.8, 0.5, 2.8); glow(inner, 0xffaa50, 26); }
  propObjs.set(p, g); return g;
}
const pool = (n, make) => Array.from({ length: n }, make);
const looseBlades = pool(14, () => { const m = mesh(CYL, bladeMat, scene); m.visible = false; return m; });
const lootObjs = pool(6, () => { const g = new THREE.Group(); mesh(BOX, glowMat(0xffffff), g, false).scale.setScalar(2.6); glow(g, 0xffffff, 16); g.visible = false; scene.add(g); return g; });

// ---------- particles: blood and debris as solid specks, sparks and embers as light ----------
const MAXP = 1300;
function points(additive, size) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3)); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXP * 3), 3));
  const mat = new THREE.PointsMaterial({ size, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true, map: additive ? glowTex : null, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: !additive });
  const p = new THREE.Points(geo, mat); p.frustumCulled = false; scene.add(p); return p;
}
const solidPts = points(false, 1.5), lightPts = points(true, 5);
const _c = new THREE.Color(), colCache = {};
function updateParticles3() {
  let a = 0, b = 0; const sp = solidPts.geometry.attributes, lp = lightPts.geometry.attributes;
  for (const p of parts) {
    const z = ((p.x * 7.3 + (p.seed || p.life0 || 0)) % 5) - 2.5 + (p.landed ? ((p.x * 13.7) % 9) - 4.5 : 0);
    if (p.stick || p.color === '#8a6a80') {
      if (a >= MAXP) continue;
      const c = colCache[p.color] || (colCache[p.color] = new THREE.Color(p.color));
      sp.position.setXYZ(a, p.x, Y(p.y) + (p.landed ? 0.15 : 0), z); sp.color.setXYZ(a, c.r, c.g, c.b); a++;
    } else {
      if (b >= MAXP) continue;
      const k = Math.min(1, p.life / 20);
      if (p.spark) _c.setRGB(1, 0.72, 0.3); else if (p.ember) { if (p.cool) _c.setRGB(0.55, 0.8, 1); else _c.setRGB(1, 0.65, 0.3); } else _c.set(p.color || '#ffffff');
      lp.position.setXYZ(b, p.x, Y(p.y), z); lp.color.setXYZ(b, _c.r * k, _c.g * k, _c.b * k); b++;
    }
  }
  solidPts.geometry.setDrawRange(0, a); lightPts.geometry.setDrawRange(0, b);
  sp.position.needsUpdate = sp.color.needsUpdate = lp.position.needsUpdate = lp.color.needsUpdate = true;
}

// ---------- weather: rain, ash, petals or embers in a box of air that follows the camera ----------
const WN = 460, wp = Array.from({ length: WN }, () => ({ x: (Math.random() - 0.5) * 560, y: Math.random() * 210 - 10, z: Math.random() * 150 - 90, s: 0.6 + Math.random() * 0.8, p: Math.random() * 6 }));
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WN * 6), 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xafc8f0, transparent: true, opacity: 0.38, fog: false, depthWrite: false })); rain.frustumCulled = false; scene.add(rain);
const flakeGeo = new THREE.BufferGeometry(); flakeGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WN * 3), 3));
const flakes = new THREE.Points(flakeGeo, new THREE.PointsMaterial({ size: 2, map: glowTex, transparent: true, depthWrite: false, sizeAttenuation: true, fog: false })); flakes.frustumCulled = false; scene.add(flakes);
function updateWeather() {
  const kind = state === 'title' ? 'rain' : ZONES[zi].weather, rp = rainGeo.attributes.position, fp = flakeGeo.attributes.position;
  rain.visible = kind === 'rain'; flakes.visible = !!kind && kind !== 'rain';
  if (!kind) return;
  if (kind === 'snow') { flakes.material.color.set(0xf0f6ff); flakes.material.blending = THREE.NormalBlending; flakes.material.size = 2; flakes.material.opacity = 0.9; }
  else if (kind === 'ash') { flakes.material.color.set(0xcdc3cd); flakes.material.blending = THREE.NormalBlending; flakes.material.size = 1.6; flakes.material.opacity = 0.6; }
  else if (kind === 'petals') { flakes.material.color.set(0xffc4d0); flakes.material.blending = THREE.NormalBlending; flakes.material.size = 2.4; flakes.material.opacity = 0.9; }
  else if (kind !== 'rain') { flakes.material.color.set(0xffa050); flakes.material.blending = THREE.AdditiveBlending; flakes.material.size = 2.6; flakes.material.opacity = 0.8; }
  for (let i = 0; i < WN; i++) {
    const w = wp[i];
    if (kind === 'rain') { w.x -= 1.4 * w.s; w.y -= 6.4 * w.s; }
    else if (kind === 'ash') { w.x += Math.sin(tick * 0.02 + w.p) * 0.3; w.y -= 0.35 * w.s; }
    else if (kind === 'snow') { w.x += -0.5 * w.s + Math.sin(tick * 0.025 + w.p) * 0.3; w.y -= 0.6 * w.s; }
    else if (kind === 'petals') { w.x += 0.5 * w.s + Math.sin(tick * 0.03 + w.p) * 0.4; w.y -= 0.3 * w.s; }
    else { w.x += -0.15 * w.s + Math.sin(tick * 0.02 + w.p) * 0.1; w.y += 0.25 * w.s; }
    if (w.y < -10) { w.y = 200; w.x = (Math.random() - 0.5) * 560; } else if (w.y > 200) w.y = -10;
    if (w.x < -280) w.x += 560; else if (w.x > 280) w.x -= 560;
    const x = focus.x + w.x;
    if (kind === 'rain') { rp.setXYZ(i * 2, x, w.y, w.z); rp.setXYZ(i * 2 + 1, x + 1.5 * w.s, w.y + 7 * w.s, w.z); } else fp.setXYZ(i, x, w.y, w.z);
  }
  rp.needsUpdate = fp.needsUpdate = true;
}

// ---------- palette: each act's colours drive sky, fog and light ----------
let palKey = '';
function applyPalette(A) {
  const key = A.sky.join() + A.rim + A.ground;
  if (key === palKey) return; palKey = key;
  const g = skyX.createLinearGradient(0, 0, 0, 256); A.sky.forEach((c, i) => g.addColorStop(i / (A.sky.length - 1) * 0.86, c)); g.addColorStop(1, A.sky[A.sky.length - 1]);
  skyX.fillStyle = g; skyX.fillRect(0, 0, 4, 256); skyTex.needsUpdate = true;
  const haze = col(`rgb(${A.haze})`);
  scene.fog.color.copy(haze).lerp(col(A.sky[3]), 0.35);
  hemi.color.set(A.sky[2]).lerp(col('#ffffff'), 0.35); hemi.groundColor.set(A.near).lerp(col(A.sky[3]), 0.4); fill.color.set(A.sky[3]).lerp(col('#ffffff'), 0.6);
  sun.color.set(A.rim);
  stoneMat.color.set(A.ground).lerp(col('#ffffff'), 0.45).multiplyScalar(1.7); ruinMat.color.set(A.mid); farMat.color.set(A.far).lerp(col(A.mid), 0.5);
  farRidgeMat.color.set(A.far).lerp(col(A.sky[3]), 0.3); midRidgeMat.color.set(A.mid).lerp(col(A.sky[3]), 0.15); bannerMat.color.set(A.banner).lerp(col('#ffffff'), 0.12);
}

// ---------- camera: the game's duel camera, with real depth and a swing round on the killing blow ----------
const focus = new THREE.Vector3(160, 20, 0); let yaw = 0.085, orbit = 0;
function updateCamera() {
  const V = camView(), vw = W / V.z, vh = H / V.z;
  focus.set(camX + V.x + vw / 2, Y(V.y + vh * 0.56), 0);
  const dist = (vh / 2) / Math.tan(camera.fov * Math.PI / 360);
  const lean = player ? THREE.MathUtils.clamp(player.vx * 0.02, -0.06, 0.06) : 0;
  orbit += ((fin && slowmo > 0 ? (fin.dir || 1) * -0.62 : 0) - orbit) * (fin ? 0.035 : 0.06);
  const base = state === 'title' ? 0.34 + Math.sin(tick * 0.006) * 0.22 : 0.085 + Math.sin(tick * 0.004) * 0.035;
  yaw += (base + lean + orbit - yaw) * 0.08;
  const sx = shake > 0 ? (Math.random() - 0.5) * shake * 0.5 : 0, sy = shake > 0 ? (Math.random() - 0.5) * shake * 0.5 : 0;
  camera.position.set(focus.x + Math.sin(yaw) * dist + sx, focus.y + dist * 0.15 + sy, Math.cos(yaw) * dist);
  camera.lookAt(focus.x + sx, focus.y + sy, 0);
}

// ---------- the frame ----------
const _v = new THREE.Vector3();
let hero3 = null;
const silMat = new THREE.MeshBasicMaterial({ color: 0x04050a, fog: false }), stageRed = new THREE.MeshBasicMaterial({ color: 0x4c0711, fog: false }), stageBone = new THREE.MeshBasicMaterial({ color: 0xa8957e, fog: false }), beatBone = new THREE.Color(0xfff1e0), beatRed = new THREE.Color(0xb20e1c);
const toHud = (x, y, z) => { _v.set(x, y, z).project(camera); return [(_v.x * 0.5 + 0.5) * W * S, (-_v.y * 0.5 + 0.5) * H * S]; };
function render3D() {
  // keep the two canvases the same size on screen
  const cw = canvas.clientWidth, ch = canvas.clientHeight;
  if (view.clientWidth !== cw || renderer.__h !== ch) { renderer.setSize(cw, ch, false); renderer.__h = ch; }
  const A = curAct(); applyPalette(A);
  updateCamera();
  // light: a low sun (or moon) behind the fight, so figures are rim-lit and throw long shadows toward you
  const hasSun = A.suns.length > 0, hasMoon = A.moons.length > 0, sa = hasSun ? A.suns.reduce((m, q) => Math.max(m, q.a), 0) : 0, ma = hasMoon ? A.moons.reduce((m, q) => Math.max(m, q.a), 0) : 0;
  sun.intensity = 0.7 + 2.3 * sa + 1.5 * ma + (lightning > 0 ? lightning * 0.6 : 0); hemi.intensity = 1.05 + 0.3 * sa + (lightning > 0 ? lightning * 0.25 : 0);
  sun.position.set(focus.x + (hasMoon && !hasSun ? -150 : 170), 120 + (hasMoon ? 90 : 0), -210); sun.target.position.set(focus.x, 0, 0);
  fill.position.set(focus.x - 120, 110, 300); fill.target.position.set(focus.x, 10, 0); fill.intensity = 0.55 + 0.4 * sa + 0.3 * ma + (lightning > 0 ? lightning * 0.3 : 0);
  sunDisc.visible = sunGlow.visible = sa > 0.02; moonDisc.visible = ma > 0.02;
  if (sunDisc.visible) { const q = A.suns[A.suns.length - 1]; sunDisc.position.set(camera.position.x + (q.x - 160) * 7.5, (150 - q.y) * 9 + 20, -2400); sunDisc.scale.setScalar(q.r * 5); sunGlow.position.copy(sunDisc.position); sunGlow.material.opacity = 0.8 * sa; sunDisc.material.color.set(q.core); }
  if (moonDisc.visible) { const q = A.moons[A.moons.length - 1]; moonDisc.position.set(camera.position.x + (q.x - 160) * 7.5, (150 - q.y) * 9 - 40, -2400); moonDisc.scale.setScalar(q.r * 9); }
  spire.position.x = camera.position.x + 900 - camX * 0.25;
  // torches: flames flicker and lean with the game's wind; the three nearest carry real light
  const cool = state !== 'title' && ZONES[zi].act === 4;
  for (const o of torchObjs) {
    const L = torchLean[o.t], lean = L ? L.x : 0, fl = 1 + Math.sin(tick * 0.5 + o.t) * 0.12 + Math.sin(tick * 1.3 + o.t * 2) * 0.08;
    o.fl.scale.set(1, fl, 1); o.fl.rotation.z = -lean * 0.16; o.core.rotation.z = -lean * 0.1; o.fl.material.color.set(cool ? 0x4a9aff : 0xff8a30); o.halo.material.color.set(cool ? 0x4a8cff : 0xff9a46); o.halo.scale.setScalar(22 * fl); o.halo.material.opacity = 0.7;
  }
  const near = torchObjs.slice().sort((p, q) => Math.abs(p.t - focus.x) - Math.abs(q.t - focus.x));
  torchLights.forEach((l, i) => { const o = near[i]; if (!o) { l.intensity = 0; return; } l.position.set(o.t, 31, -6); l.color.set(cool ? 0x6ab0ff : 0xffa050); l.intensity = 1700 * (1 + Math.sin(tick * 0.31 + o.t) * 0.08); });
  flashLights.forEach((l, i) => { const f = lights[lights.length - 1 - i]; if (!f) { l.intensity = 0; return; } const k = Math.pow(1 - f.t / f.life, 1.6); l.position.set(f.x, Y(f.y), 6); l.color.set(`rgb(${f.rgb})`); l.intensity = 5200 * f.a * k; });
  // banners
  for (const b of banners) {
    let o = bannerObjs.get(b);
    if (!o) { o = new THREE.Group(); const m = mesh(new THREE.PlaneGeometry(5.4, 1), bannerMat, o); m.position.y = -0.5; o.userData.m = m; for (const cx of [-2, 2]) limb(mesh(CYL, ironMat, o, false), cx, 0, 0, cx, 200, 0, 0.2); mesh(BOX, ironMat, o).scale.set(7, 0.7, 0.7); scene.add(o); bannerObjs.set(b, o); }
    o.position.set(b.x, Y(BANNER_TOP), -7); o.userData.m.scale.y = b.len; o.userData.m.position.y = -b.len / 2; o.userData.m.rotation.z = b.sway * 0.05; o.userData.m.position.x = b.sway * 0.9;
  }
  for (const [b, o] of bannerObjs) if (!banners.includes(b)) { scene.remove(o); bannerObjs.delete(b); }
  barrier.visible = state === 'play' && !cleared && !practice; barrier.position.set((zi + 1) * ZW - 1, 60, (FRONT + BACK) / 2); barrier.material.opacity = 0.16 + 0.07 * Math.sin(tick * 0.1);
  bell.rotation.z = (typeof bellSwing === 'number' ? bellSwing : 0) * 0.5;
  // fighters
  let all = player && state !== 'title' ? [player, ...enemies] : [];
  if (state === 'title' || (state === 'story' && !player)) {          // the swordsman waits on the title screen, coat in the wind
    hero3 = hero3 || makeFighter(0, GROUND, 'player'); hero3.onGround = true; hero3.x = camX + W * 0.33; hero3.anim = tick;
    if (state === 'title') { updateScarf(hero3); updateCloth(hero3); }
    all = [hero3];
  }
  const t = slowmo > 0 && freeze <= 0 ? Math.max(0, Math.min(1, slowAcc)) : 1;
  for (const f of all) poseFig(f, figs.get(f) || makeFig(f), t);
  for (const [f, P] of figs) if (!all.includes(f)) { scene.remove(P.g); figs.delete(f); }
  if (player && figs.has(player)) { const P = figs.get(player); P.g.visible = P.g.visible && !(player.invuln > 0 && !player.dead && Math.floor(player.invuln / 4) % 2); }
  // props
  for (const p of props) {
    const g = propObjs.get(p) || makeProp(p); g.visible = !(p.back > 0);
    g.position.set(p.x, Y(p.y) + (p.fly ? -3 : 0), p.fly ? 0.5 : -4); g.userData.inner.rotation.z = p.fly ? -p.spin * (p.vx >= 0 ? 1 : -1) : 0;
  }
  for (const [p, g] of propObjs) if (!props.includes(p)) { scene.remove(g); propObjs.delete(p); }
  // loose and thrown blades
  let bi = 0;
  for (const s of swords) {
    const m = looseBlades[bi++]; if (!m) break; m.visible = true; const y = Y(s.y);
    if (s.onGround && s.stuck !== undefined) { const an = s.stuck + Math.sin((s.quiver || 0) * 1.3) * 0.05 * (s.quiver || 0) / 14; limb(m, s.x - Math.sin(an) * 11.3, y + Math.cos(an) * 11.3, 2, s.x + Math.sin(an) * 1.4, y - Math.cos(an) * 1.4, 2, 0.17, 0.09); }
    else if (s.onGround) limb(m, s.x - 5, y + 0.4, 3, s.x + 6, y + 0.4, 3, 0.17, 0.09);
    else { const a = s.age * 0.45; limb(m, s.x - Math.cos(a) * 5.5, y + Math.sin(a) * 5.5, 1, s.x + Math.cos(a) * 5.5, y - Math.sin(a) * 5.5, 1, 0.17, 0.09); }
  }
  for (const p of projs) { const m = looseBlades[bi++]; if (!m) break; m.visible = true; const dd = Math.sign(p.vx); limb(m, p.x - dd * 5.5, Y(p.y), 0.6, p.x + dd * 6, Y(p.y), 0.6, 0.17, 0.09); }
  for (; bi < looseBlades.length; bi++) looseBlades[bi].visible = false;
  lootObjs.forEach((g, i) => { const l = loot[i]; g.visible = !!l; if (!l) return; g.position.set(l.x, Y(l.y) + 4 + (l.onGround ? Math.sin(tick * 0.1 + l.x) * 0.8 : 0), 0); g.rotation.set(tick * 0.03, tick * 0.05, 0.7); g.children[0].material.color.set(l.c.col); g.children[1].material.color.set(l.c.col); });
  updateParticles3(); updateWeather();
  // the killing blow: for a heartbeat the stage is one flat colour and everything on it a black cut-out
  const beat = !!fin && slowmo > 0 && fin.t >= 2 && fin.t <= 11;
  if (beat) {
    const kids = scene.children.slice(), was = kids.map(o => o.visible), sv = sprites.map(o => o.visible), bg = scene.background, bone = fin.t <= 3;
    const isFig = new Set([...figs.values()].map(P => P.g)), off = new Set([...backdrop, solidPts, lightPts, rain, flakes, barrier, sunDisc, moonDisc]);
    sprites.forEach(o => o.visible = false); scene.background = bone ? beatBone : beatRed;
    kids.forEach((o, i) => o.visible = was[i] && !off.has(o) && !isFig.has(o)); scene.overrideMaterial = bone ? stageBone : stageRed; renderer.render(scene, camera);   // the stage, a shade darker than the sky
    kids.forEach((o, i) => o.visible = was[i] && isFig.has(o)); scene.overrideMaterial = silMat; scene.background = null; renderer.autoClear = false; renderer.render(scene, camera); renderer.autoClear = true;   // the duelists, pure black
    scene.overrideMaterial = null; scene.background = bg; kids.forEach((o, i) => o.visible = was[i]); sprites.forEach((o, i) => o.visible = sv[i]);
  } else renderer.render(scene, camera);

  // ----- HUD on the 2D canvas, over the 3D view -----
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, RW, RH);
  ctx.setTransform(K / S, 0, 0, K / S, 0, 0);
  const CW = W * S, CH = H * S;
  if (state === 'title') drawTitle();
  else if (state === 'story') drawStory();
  else if (player) {
    if (state === 'play' && !player.dead) {                           // the key over a prop in reach
      const np = nearProp(player);
      if (np) { const [x, y] = toHud(np.x, Y(np.y) + 12 + Math.sin(tick * 0.1) * 0.5, -4); ctx.fillStyle = 'rgba(10,4,18,0.78)'; ctx.fillRect(x - 11, y - 14, 22, 22); ctx.strokeStyle = 'rgba(255,227,154,0.9)'; ctx.lineWidth = 1; ctx.strokeRect(x - 10.5, y - 13.5, 21, 21); text('E', x, y + 3, 16, '#ffe39a', 'center'); }
    }
    for (let i = toasts.length - 1; i >= 0; i--) { const q = toasts[i]; q.t++; if (q.t > 90) { toasts.splice(i, 1); continue; } const [x, y] = toHud(q.x, Y(q.y) + q.t * 0.08, 0); text(q.str, x, y, 15, q.col, 'center', Math.min(1, (90 - q.t) / 20), 'Georgia, serif'); }
    drawHUD();
    if (fin && fin.t > 16 && slowmo > 0) {
      const k = Math.min(1, (fin.t - 16) / 7), a = Math.min(1, slowmo / 20), word = fin.boss ? 'COUP DE GRÂCE' : 'TOUCHÉ', size = (fin.boss ? 58 : 72) * (1 + (1 - k) * (1 - k) * 1.3);
      text(word, CW / 2 + 3, 171, size, '#2a0006', 'center', a * k, 'Georgia, serif'); text(word, CW / 2, 168, size, '#d8182a', 'center', a * k, 'Georgia, serif');
    }
    if (state === 'paused') {
      ctx.fillStyle = 'rgba(10,4,18,0.88)'; ctx.fillRect(0, 0, CW, CH);
      text('PAUSED', CW / 2, 120, 48, '#ffffff', 'center', 1, 'Georgia, serif'); text('CONTROLS', CW / 2, 168, 14, '#4fd8ff', 'center'); drawControls(200, 25);
      text('A glint on a foe\'s point shows where the thrust will land. Match its height to block, parry it, or hop away.', CW / 2, 388, 15, '#ffd8a8', 'center', 1, 'Georgia, serif');
      text('P or ESC to resume  ·  R to restart  ·  M to mute', CW / 2, 432, 15, '#c9a8d8', 'center');
      drawPracticeButton(practice ? 'T   LEAVE PRACTICE' : 'T   PRACTICE ARENA');
    }
    if (state === 'play' || state === 'paused') drawMenuButton(state === 'paused');
    if (state === 'win') drawWin();
  }
  if (flash > 0) { ctx.fillStyle = `rgba(255,245,220,${flash.toFixed(2)})`; ctx.fillRect(0, 0, CW, CH); }
  if (muted) text('MUTED', CW / 2, 24, 12, 'rgba(255,255,255,0.5)', 'center');
  if (state === 'title') text('3D EDITION', CW - 14, CH - 26, 11, 'rgba(191,230,245,0.7)', 'right');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

// take over drawing from the 2D renderer
window.render = render3D;
window.__view3d = { scene, camera, renderer, figs };
