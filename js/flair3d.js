// ✨ Your win style, in 3D: when you win, a burst of hearts, rubber chickens, tiny Daves, dollar
// bills or fireworks flies out over the classic celebration. One transparent layer on top,
// only rendering while something is flying.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildTrophy, disposeTree } from './trophies3d.js';

const rand = (a, b) => a + Math.random() * (b - a);

// ---------- the little things that fly ----------
function heart() {
  const s = new THREE.Shape();
  s.moveTo(0, -1);
  s.bezierCurveTo(1.3, -0.2, 1.2, 1, 0.5, 1);
  s.bezierCurveTo(0.2, 1, 0, 0.7, 0, 0.5);
  s.bezierCurveTo(0, 0.7, -0.2, 1, -0.5, 1);
  s.bezierCurveTo(-1.2, 1, -1.3, -0.2, 0, -1);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 3 });
  geo.center();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: [0xff2d6a, 0xff5fa2, 0xe0142c][(Math.random() * 3) | 0], roughness: 0.3, metalness: 0.1 }));
}

function chicken() {
  const g = new THREE.Group();
  const yellow = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.35 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), yellow);
  body.scale.set(1, 0.8, 1.3);
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), yellow);
  head.position.set(0, 1, 0.8);
  g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8), new THREE.MeshStandardMaterial({ color: 0xff7a1a }));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.95, 1.35);
  g.add(beak);
  const comb = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.4, 0.5), new THREE.MeshStandardMaterial({ color: 0xe0142c }));
  comb.position.set(0, 1.55, 0.75);
  g.add(comb);
  return g;
}

function daveHead() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1, 18, 14), new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.6 })));
  const band = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.12, 8, 24), new THREE.MeshStandardMaterial({ color: 0xc0182a }));
  band.rotation.x = Math.PI / 2 - 0.2;
  band.position.y = 0.45;
  g.add(band);
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  for (const x of [-0.35, 0.35]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.07, 0.05), dark);
    eye.position.set(x, 0.18, 0.93);
    g.add(eye);
  }
  const grin = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.07, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x7a1d1d }));
  grin.rotation.z = Math.PI;
  grin.position.set(0, -0.3, 0.9);
  g.add(grin);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe0706a }));
  nose.position.set(0, -0.02, 1);
  g.add(nose);
  return g;
}

let billTex = null;
function bill() {
  billTex ??= (() => {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 110;
    const x = c.getContext('2d');
    x.fillStyle = '#85bb65';
    x.fillRect(0, 0, 256, 110);
    x.strokeStyle = '#2e5a1c';
    x.lineWidth = 6;
    x.strokeRect(6, 6, 244, 98);
    x.fillStyle = '#2e5a1c';
    x.beginPath();
    x.arc(128, 55, 30, 0, 7);
    x.fill();
    x.fillStyle = '#85bb65';
    x.font = 'bold 44px Georgia, serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('$', 128, 57);
    x.fillStyle = '#2e5a1c';
    x.font = 'bold 26px Georgia, serif';
    x.fillText('100', 40, 30);
    x.fillText('100', 216, 82);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  return new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.03), new THREE.MeshStandardMaterial({ map: billTex, side: THREE.DoubleSide, roughness: 0.8 }));
}

// a leather wallet, open like a book: bills fly into it, then it snaps shut
function walletMesh() {
  const g = new THREE.Group();
  const leather = new THREE.MeshStandardMaterial({ color: 0x6b3a1e, roughness: 0.55 });
  const inside = new THREE.MeshStandardMaterial({ color: 0x3d1f0f, roughness: 0.8 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffd23f, metalness: 1, roughness: 0.25 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.7, 0.14), [leather, leather, leather, leather, inside, leather]);
  g.add(back);
  // the pocket the bills slide into
  const pocket = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.05), inside);
  pocket.position.set(0, -0.35, 0.1);
  g.add(pocket);
  // the front half swings on the bottom edge
  const hinge = new THREE.Group();
  hinge.position.set(0, -0.85, 0.07);
  g.add(hinge);
  const front = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.7, 0.14), [leather, leather, leather, leather, leather, inside]);
  front.position.set(0, 0.85, 0.07);
  hinge.add(front);
  const snap = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.06, 20), gold);
  snap.rotation.x = Math.PI / 2;
  snap.position.set(0, 0.55, 0.08);
  front.add(snap);
  // stitching, in gold thread
  const stitch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.02), gold);
  for (let i = 0; i < 20; i++) {
    const st = stitch.clone();
    st.position.set(-1.05 + i * 0.11, 0.72, 0.075);
    front.add(st);
  }
  hinge.rotation.x = 1.35; // open, lying towards you
  return { g, hinge };
}

// a gold medal with your new level on it
function medal(level) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(110, 100, 10, 128, 128, 128);
  grd.addColorStop(0, '#fff2b0');
  grd.addColorStop(0.6, '#e0b45c');
  grd.addColorStop(1, '#8a5a12');
  x.fillStyle = grd;
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#7a4d0c';
  x.lineWidth = 8;
  x.beginPath();
  x.arc(128, 128, 104, 0, 7);
  x.stroke();
  x.fillStyle = '#5a3606';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = 'bold 30px Georgia, serif';
  x.fillText('LEVEL', 128, 70);
  x.font = `bold ${level > 99 ? 80 : 110}px Georgia, serif`;
  x.fillText(String(level), 128, 150);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // a cylinder cap maps its texture sideways once the disc faces you: turn it upright
  tex.center.set(0.5, 0.5);
  tex.rotation = Math.PI / 2;
  const gold = new THREE.MeshStandardMaterial({ color: 0xe0b45c, metalness: 1, roughness: 0.25 });
  const face = new THREE.MeshStandardMaterial({ map: tex, metalness: 0.6, roughness: 0.35 });
  const g = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.16, 48), [gold, face, face]);
  disc.rotation.x = Math.PI / 2;
  g.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 10, 48), gold);
  g.add(rim);
  // the ribbon
  const red = new THREE.MeshStandardMaterial({ color: 0xc0182a, roughness: 0.5, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.5), red);
    r.position.set(side * 0.32, 1.55, -0.1);
    r.rotation.z = side * 0.35;
    g.add(r);
  }
  return g;
}

// the loyalty card: 10 stars, then a big red REDEEMED, then the prize on the back
function cardTexture(side) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 320;
  const x = c.getContext('2d');
  const grd = x.createLinearGradient(0, 0, 512, 320);
  grd.addColorStop(0, side === 'back' ? '#2a0d14' : '#fff4d6');
  grd.addColorStop(1, side === 'back' ? '#5a1424' : '#f0d58a');
  x.fillStyle = grd;
  x.fillRect(0, 0, 512, 320);
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  if (side === 'back') {
    x.fillStyle = '#ffe9a8';
    x.font = 'bold 30px Georgia, serif';
    x.fillText('YOUR PRIZE:', 256, 110);
    x.font = 'bold 64px Georgia, serif';
    x.fillText('NOTHING', 256, 180);
    x.font = 'italic 22px Georgia, serif';
    x.fillText('Thank you for your loyalty.', 256, 250);
  } else {
    x.fillStyle = '#5a1424';
    x.font = 'bold 30px Georgia, serif';
    x.fillText('CLUB JACKPOT REWARDS', 256, 48);
    for (let i = 0; i < 10; i++) {
      const cx = 76 + (i % 5) * 90;
      const cy = 130 + Math.floor(i / 5) * 90;
      x.strokeStyle = '#5a1424';
      x.lineWidth = 4;
      x.beginPath();
      x.arc(cx, cy, 32, 0, 7);
      x.stroke();
      x.fillStyle = '#c0182a';
      x.font = 'bold 40px Georgia, serif';
      x.fillText('★', cx, cy + 2);
    }
    if (side === 'redeemed') {
      x.save();
      x.translate(256, 175);
      x.rotate(-0.2);
      x.strokeStyle = 'rgba(200, 16, 40, 0.9)';
      x.lineWidth = 10;
      x.strokeRect(-200, -52, 400, 104);
      x.fillStyle = 'rgba(200, 16, 40, 0.9)';
      x.font = 'bold 72px Georgia, serif';
      x.fillText('REDEEMED', 0, 4);
      x.restore();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function rubberStamp() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x7a4a24, roughness: 0.5 });
  const handle = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 14), wood);
  handle.position.y = 1.5;
  handle.scale.set(1, 0.8, 1);
  g.add(handle);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 0.9, 16), wood);
  neck.position.y = 0.95;
  g.add(neck);
  const block = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 0.7), wood);
  block.position.y = 0.35;
  g.add(block);
  const rubber = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.62), new THREE.MeshStandardMaterial({ color: 0xc0182a, roughness: 0.7 }));
  rubber.position.y = 0.12;
  g.add(rubber);
  return g;
}

// a burst throws dozens of the same thing: build each shape once and share its geometry,
// giving every copy its own materials so it can still fade out on its own
const templates = {};
function copyOf(make) {
  const t = (templates[make.name] ||= make());
  t.userData.shared = true;
  const o = t.clone();
  o.traverse((m) => {
    if (!m.material) return;
    m.material = m.material.clone();
    m.material.transparent = true;
  });
  return o;
}
const HEART_COLORS = [0xff2d6a, 0xff5fa2, 0xe0142c];

const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
const lerp = (a, b, t) => a + (b - a) * t;

export function createFlair() {
  let renderer = null;
  let scene = null;
  let camera = null;
  let env = null;
  const bits = [];
  const sparks = [];
  const tweens = []; // scripted set pieces: fn(dt) returns false when done
  let running = false;
  let last = 0;

  function ensure() {
    if (renderer) return;
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    const el = renderer.domElement;
    el.className = 'flair-layer';
    document.body.appendChild(el);
    scene = new THREE.Scene();
    env = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.6);
    key.position.set(0.3, 0.8, 1);
    scene.add(key);
    // an orthographic camera measured in screen pixels, so bursts start exactly where the win is
    camera = new THREE.OrthographicCamera(0, 1, 0, -1, -2000, 2000);
    resize();
    addEventListener('resize', resize);
  }
  function resize() {
    if (!renderer) return;
    renderer.setSize(innerWidth, innerHeight);
    camera.right = innerWidth;
    camera.bottom = -innerHeight;
    camera.updateProjectionMatrix();
  }

  function spawn(mesh, x, y, v, size, life, spin = 6) {
    mesh.scale.multiplyScalar(size);
    mesh.position.set(x, -y, 0);
    mesh.rotation.set(rand(0, 6), rand(0, 6), rand(0, 6));
    scene.add(mesh);
    bits.push({ mesh, v, spin: new THREE.Vector3(rand(-spin, spin), rand(-spin, spin), rand(-spin, spin)), life, max: life });
  }

  function firework(x, y, color) {
    const n = 90;
    const pos = new Float32Array(n * 3);
    const vel = [];
    for (let i = 0; i < n; i++) {
      pos.set([x, -y, 0], i * 3);
      const a = Math.random() * Math.PI * 2;
      const sp = rand(120, 380);
      vel.push([Math.cos(a) * sp, Math.sin(a) * sp]);
    }
    const pts = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ color, size: 7, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    scene.add(pts);
    sparks.push({ pts, vel, life: 1.6 });
  }

  /** Throw a burst of your style from (x, y) on screen. level 0..3 = WIN .. JACKPOT. */
  function burst(style, { x = innerWidth / 2, y = innerHeight * 0.4 } = {}, level = 1) {
    ensure();
    const n = 14 + level * 10;
    if (style === 'fireworks') {
      const cols = [0xff2d9a, 0x2de0ff, 0xffd23f, 0x5ee08f, 0xb066ff];
      for (let i = 0; i < 3 + level * 2; i++) {
        setTimeout(() => firework(rand(innerWidth * 0.15, innerWidth * 0.85), rand(innerHeight * 0.12, innerHeight * 0.5), cols[i % cols.length]), i * 260);
      }
    } else if (style === 'money') {
      // it's raining money, from the top of the screen
      for (let i = 0; i < n + 10; i++) spawn(bill(), rand(0, innerWidth), rand(-200, -30), new THREE.Vector3(rand(-40, 40), rand(-60, -20), 0), rand(18, 26), rand(3, 4.5), 3);
    } else {
      const make = { heartsfx: heart, chickens: chicken, daves: daveHead }[style];
      if (!make) return;
      for (let i = 0; i < n; i++) {
        const a = rand(Math.PI * 0.15, Math.PI * 0.85);
        const sp = rand(380, 820);
        const mesh = copyOf(make);
        if (make === heart) mesh.material.color.setHex(HEART_COLORS[(Math.random() * 3) | 0]);
        spawn(mesh, x, y, new THREE.Vector3(Math.cos(a) * sp * (Math.random() < 0.5 ? -1 : 1), Math.sin(a) * sp, 0), rand(14, 24), rand(2.2, 3.2));
      }
    }
    run();
  }

  function run() {
    if (running) return;
    running = true;
    last = performance.now();
    renderer.setAnimationLoop(frame);
  }

  const centre = (el) => {
    const r = el?.getBoundingClientRect();
    return r && r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth - 60, y: 30 };
  };

  /** 👛 Bills fly from `fromEl` into a 3D wallet, which snaps shut and flies to `toEl`. */
  function cashOut({ fromEl, toEl, amount, onDone }) {
    ensure();
    const { g, hinge } = walletMesh();
    const size = Math.min(70, innerWidth / 9);
    const home = { x: innerWidth / 2, y: innerHeight * 0.42 };
    g.position.set(home.x, -home.y, 0);
    g.rotation.set(0.25, -0.35, 0);
    g.scale.setScalar(0.01);
    scene.add(g);
    const from = centre(fromEl);
    const nBills = Math.min(12, 3 + Math.round(Math.log10(Math.max(1, amount)) * 3));
    const flying = [];
    const tClose = 0.35 + nBills * 0.09 + 0.6;
    const tFly = tClose + 0.45;
    let t = 0;
    tweens.push((dt) => {
      t += dt;
      // pop in
      const pop = Math.min(1, t / 0.35);
      g.scale.setScalar(size * ease(pop) * (1 + Math.sin(pop * Math.PI) * 0.12) + 0.001);
      g.rotation.y = -0.35 + Math.sin(t * 2) * 0.08;
      // bills, one after another
      while (flying.length < nBills && t > 0.35 + flying.length * 0.09) {
        const b = bill();
        b.scale.setScalar(size * 0.55);
        b.position.set(from.x, -from.y, 60);
        scene.add(b);
        flying.push({ b, t0: t, spin: rand(-1, 1) });
      }
      for (const f of flying) {
        if (!f.b.parent) continue;
        const k = (t - f.t0) / 0.55;
        const e = ease(k);
        f.b.position.x = lerp(from.x, home.x, e);
        f.b.position.y = lerp(-from.y, -home.y + size * 0.2, e) + Math.sin(e * Math.PI) * 120;
        f.b.rotation.set(0.3, 0, f.spin * (1 - e) * 3);
        f.b.scale.setScalar(size * lerp(0.55, 0.4, e));
        if (k >= 1) {
          scene.remove(f.b);
          f.b.geometry.dispose();
          f.b.material.dispose();
        }
      }
      // snap shut
      hinge.rotation.x = lerp(1.35, 0, ease((t - tClose) / 0.22));
      // then off to your wallet
      if (t > tFly) {
        const to = centre(toEl);
        const k = ease((t - tFly) / 0.5);
        g.position.x = lerp(home.x, to.x, k);
        g.position.y = lerp(-home.y, -to.y, k);
        g.scale.setScalar(size * lerp(1, 0.25, k));
        g.rotation.y += dt * 8 * k;
      }
      if (t > tFly + 0.5) {
        onDone?.();
        scene.remove(g);
        g.traverse((o) => o.geometry?.dispose());
        return false;
      }
      return true;
    });
    run();
  }

  /** 🏆 A new trophy spins in, glints, and heads off to your shelf. */
  function trophy(kind, tier) {
    ensure();
    const g = new THREE.Group();
    const t = buildTrophy(kind, tier);
    t.position.y = -0.35;
    g.add(t);
    const size = Math.min(240, innerWidth / 3.2);
    const at = { x: innerWidth / 2, y: innerHeight * 0.42 };
    g.position.set(at.x, -at.y, 0);
    g.rotation.x = 0.15;
    g.scale.setScalar(0.001);
    scene.add(g);
    for (let i = 0; i < 2; i++) setTimeout(() => firework(at.x + rand(-140, 140), at.y + rand(-100, 20), [0xffd23f, 0xfff2b0][i]), 300 + i * 250);
    let k = 0;
    tweens.push((dt) => {
      k += dt;
      const inK = ease(k / 0.5);
      const out = k > 2.6 ? ease((k - 2.6) / 0.45) : 0;
      g.scale.setScalar(size * inK * (1 - out) + 0.001);
      g.rotation.y += dt * (1.2 + (1 - inK) * 10);
      g.position.x = at.x + out * innerWidth * 0.35;
      g.position.y = -at.y + Math.sin(k * 2) * 6 + out * 140;
      if (k > 3.05) {
        scene.remove(g);
        disposeTree(g);
        return false;
      }
      return true;
    });
    run();
  }

  /** 🎟️ Your loyalty card flies in, gets stamped REDEEMED, flips over to show the prize. */
  function stampCard(onDone) {
    ensure();
    const size = Math.min(150, innerWidth / 5);
    const at = { x: innerWidth / 2, y: innerHeight * 0.45 };
    const front = cardTexture('front');
    const redeemed = cardTexture('redeemed');
    const back = cardTexture('back');
    const edge = new THREE.MeshStandardMaterial({ color: 0xe0b45c, metalness: 0.6, roughness: 0.3 });
    // matte card stock (a shiny finish washes the print out)
    const faceMat = new THREE.MeshStandardMaterial({ map: front, roughness: 0.9, envMapIntensity: 0.25 });
    const backMat = new THREE.MeshStandardMaterial({ map: back, roughness: 0.9, envMapIntensity: 0.25 });
    const card = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2, 0.04), [edge, edge, edge, edge, faceMat, backMat]);
    const g = new THREE.Group();
    g.add(card);
    const stamp = rubberStamp();
    stamp.rotation.x = Math.PI / 2; // stands on the card, facing you
    stamp.position.set(0.2, 0, 6);
    g.add(stamp);
    g.position.set(at.x, -at.y, 0);
    g.rotation.set(-0.35, 0, 0);
    g.scale.setScalar(0.001);
    scene.add(g);
    let k = 0;
    let slammed = false;
    let told = false;
    tweens.push((dt) => {
      k += dt;
      // fly in with a spin
      const inK = ease(k / 0.5);
      g.scale.setScalar(size * inK + 0.001);
      g.rotation.z = (1 - inK) * -1.2;
      // the stamp comes down... SLAM
      if (k > 0.7 && k < 1.3) {
        const d = (k - 0.7) / 0.35;
        stamp.position.z = d < 1 ? lerp(6, 0.05, d * d) : lerp(0.05, 4, ease((k - 1.05) / 0.25));
        if (d >= 1 && !slammed) {
          slammed = true;
          faceMat.map = redeemed;
          faceMat.needsUpdate = true;
          g.position.x = at.x + 8;
        }
      }
      if (k >= 1.3) stamp.visible = false;
      if (slammed && k < 1.4) g.position.x = at.x + Math.sin(k * 90) * 6 * (1.4 - k) * 10;
      // flip over to the prize
      if (k > 1.9) g.rotation.y = Math.PI * ease((k - 1.9) / 0.6);
      if (k > 2.6 && !told) {
        told = true;
        onDone?.();
      }
      // and away
      const out = k > 4.2 ? ease((k - 4.2) / 0.45) : 0;
      if (out) {
        g.scale.setScalar(size * (1 - out) + 0.001);
        g.position.y = -at.y - out * 200;
        g.rotation.z = out * 1.5;
      }
      if (k > 4.7) {
        scene.remove(g);
        disposeTree(g);
        redeemed.dispose();
        front.dispose();
        return false;
      }
      return true;
    });
    run();
  }

  /** ⭐ A gold medal with your new level spins up in the middle of the screen. */
  function levelUp(level) {
    ensure();
    const g = medal(level);
    const size = Math.min(110, innerWidth / 6);
    const at = { x: innerWidth / 2, y: innerHeight * 0.38 };
    g.position.set(at.x, -at.y, 0);
    g.scale.setScalar(0.001);
    scene.add(g);
    let t = 0;
    const cols = [0xffd23f, 0xfff2b0, 0xff9a3c];
    for (let i = 0; i < 3; i++) setTimeout(() => firework(at.x + rand(-160, 160), at.y + rand(-90, 60), cols[i]), 250 + i * 220);
    tweens.push((dt) => {
      t += dt;
      const inK = ease(t / 0.5);
      const out = t > 2.4 ? ease((t - 2.4) / 0.4) : 0;
      g.scale.setScalar(size * inK * (1 - out) + 0.001);
      // spin in fast, settle facing you with a little wobble, then float up and away
      g.rotation.y = (1 - inK) * Math.PI * 4 + Math.sin(t * 3) * 0.25 * inK;
      g.position.y = -at.y + Math.sin(t * 2.2) * 6 + out * 160;
      if (t > 2.8) {
        scene.remove(g);
        g.traverse((o) => {
          o.geometry?.dispose();
          [].concat(o.material || []).forEach((m) => {
            m.map?.dispose();
            m.dispose();
          });
        });
        return false;
      }
      return true;
    });
    run();
  }

  function frame() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.life -= dt;
      const isBill = b.mesh.geometry?.type === 'PlaneGeometry';
      if (isBill) {
        // flutter down
        b.v.x += Math.sin(now / 300 + i) * 30 * dt;
        b.mesh.position.x += b.v.x * dt;
        b.mesh.position.y += b.v.y * dt - 40 * dt;
      } else {
        b.v.y -= 900 * dt; // gravity (screen pixels)
        b.mesh.position.addScaledVector(b.v, dt);
      }
      b.mesh.rotation.x += b.spin.x * dt;
      b.mesh.rotation.y += b.spin.y * dt;
      b.mesh.rotation.z += b.spin.z * dt;
      const fade = Math.min(1, b.life / 0.6);
      b.mesh.traverse((o) => {
        if (!o.material) return;
        o.material.transparent = true;
        o.material.opacity = fade;
      });
      if (b.life <= 0 || b.mesh.position.y < -innerHeight - 200) {
        scene.remove(b.mesh);
        const shared = b.mesh.userData.shared;
        b.mesh.traverse((o) => {
          if (!shared) o.geometry?.dispose();
          if (o.material && o.material.map !== billTex) o.material.dispose();
        });
        bits.splice(i, 1);
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life -= dt;
      const p = s.pts.geometry.attributes.position;
      for (let k = 0; k < p.count; k++) {
        s.vel[k][1] -= 220 * dt;
        p.setXY(k, p.getX(k) + s.vel[k][0] * dt, p.getY(k) + s.vel[k][1] * dt);
      }
      p.needsUpdate = true;
      s.pts.material.opacity = Math.max(0, s.life / 1.6);
      if (s.life <= 0) {
        scene.remove(s.pts);
        s.pts.geometry.dispose();
        s.pts.material.dispose();
        sparks.splice(i, 1);
      }
    }
    for (let i = tweens.length - 1; i >= 0; i--) if (!tweens[i](dt)) tweens.splice(i, 1);
    renderer.render(scene, camera);
    if (!bits.length && !sparks.length && !tweens.length) {
      running = false;
      renderer.setAnimationLoop(null);
      renderer.clear();
    }
  }

  // setting up WebGL + the environment map stalls for a moment: do it while the page is idle,
  // not on the first win / level-up
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 3000));
  idle(() => ensure(), { timeout: 8000 });

  return { burst, cashOut, levelUp, trophy, stampCard };
}
