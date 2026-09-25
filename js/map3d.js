// 🗺️ The casino map, in 3D, on your phone: a little diorama of the floor (the roulette table, the
// Dragon Rush cabinets, and the blackjack table behind a velvet rope). You're on it, as your own character.
// Tap somewhere and you walk there along a glowing trail.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildAvatar, animateAvatar, disposeAvatar } from './avatar.js';
import { buildDave } from './dave.js';

const ME_SCALE = 0.3; // your character, map-sized
const FLOOR = { w: 10, d: 16 }; // portrait, like the phone
const AISLE_X = 2.7; // the walkway down the side of the floor, round the tables
const VIEW = { yaw: 0, pitch: 0.95 };
const FOV = 45;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - (1 - t) ** 3;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const backOut = (t) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2;

// ---------- little helpers ----------
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}
const box = (w, h, d, mat, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z);
const cyl = (rt, rb, h, mat, x, y, z, seg = 20) => mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat, x, y, z);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// a loud casino carpet: burgundy, gold lattice, the odd cyan dot
const carpetTex = () => {
  const t = canvasTex(256, 256, (x) => {
    x.fillStyle = '#34091a';
    x.fillRect(0, 0, 256, 256);
    x.strokeStyle = 'rgba(232, 195, 90, 0.32)';
    x.lineWidth = 3;
    for (let i = -256; i <= 512; i += 64) {
      x.beginPath();
      x.moveTo(i, 0);
      x.lineTo(i + 256, 256);
      x.moveTo(i, 256);
      x.lineTo(i + 256, 0);
      x.stroke();
    }
    x.fillStyle = 'rgba(45, 224, 255, 0.4)';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 5; j++) {
      x.beginPath();
      x.arc(i * 64, 32 + j * 64, 5, 0, 7);
      x.fill();
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(4, 4);
  return t;
};

const wheelTex = () =>
  canvasTex(256, 256, (x) => {
    const n = 37;
    for (let i = 0; i < n; i++) {
      x.beginPath();
      x.moveTo(128, 128);
      x.arc(128, 128, 126, (i / n) * Math.PI * 2, ((i + 1) / n) * Math.PI * 2);
      x.fillStyle = i === 0 ? '#12a84e' : i % 2 ? '#c0182a' : '#161616';
      x.fill();
    }
    x.beginPath();
    x.arc(128, 128, 70, 0, 7);
    x.fillStyle = '#6b3514';
    x.fill();
    x.strokeStyle = '#e8c35a';
    x.lineWidth = 6;
    x.stroke();
  });

const glowTex = () =>
  canvasTex(128, 128, (x) => {
    const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 128, 128);
  });

// a beam of light: bright at the bottom, gone at the top
const beamTex = () =>
  canvasTex(8, 128, (x) => {
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, 'rgba(255,255,255,0.9)');
    x.fillStyle = g;
    x.fillRect(0, 0, 8, 128);
  });

/** A floating name tag: a dark pill with a neon border. */
function tag(text, color) {
  const font = '800 46px Inter, "Segoe UI Emoji", "Apple Color Emoji", sans-serif';
  const probe = document.createElement('canvas').getContext('2d');
  probe.font = font;
  const w = Math.ceil(probe.measureText(text).width) + 64;
  const h = 84;
  const map = canvasTex(w, h, (x) => {
    x.font = font;
    x.fillStyle = 'rgba(12, 6, 16, 0.86)';
    x.strokeStyle = color;
    x.lineWidth = 5;
    x.beginPath();
    x.roundRect(4, 4, w - 8, h - 8, 38);
    x.fill();
    x.stroke();
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(text, w / 2, h / 2 + 2);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false, transparent: true }));
  s.scale.set((w / h) * 0.85, 0.85, 1);
  s.renderOrder = 10;
  return s;
}

// ---------- the places ----------
const MODELS = {
  roulette(u) {
    const g = new THREE.Group();
    const wood = std(0x5a2a12, { roughness: 0.45 });
    const gold = std(0xe8c35a, { metalness: 1, roughness: 0.25 });
    g.add(box(3.1, 0.34, 1.5, std(0x2a120a), 0, 0.17, 0));
    g.add(box(3.4, 0.2, 1.8, wood, 0, 0.44, 0));
    g.add(box(3.2, 0.06, 1.62, std(0x0f6b3a, { roughness: 0.9 }), 0, 0.56, 0));
    // the wheel, spinning, with its ball going the other way
    const bowl = cyl(0.74, 0.62, 0.24, wood, -1.0, 0.66, 0, 40);
    g.add(bowl);
    const disc = mesh(new THREE.CircleGeometry(0.62, 48), std(0xffffff, { map: wheelTex(), roughness: 0.4 }), -1.0, 0.79, 0);
    disc.rotation.x = -Math.PI / 2;
    g.add(disc);
    g.add(cyl(0.02, 0.1, 0.26, gold, -1.0, 0.9, 0, 12));
    const ball = mesh(new THREE.SphereGeometry(0.05, 12, 8), std(0xffffff, { roughness: 0.2 }), 0, 0.84, 0);
    g.add(ball);
    // chip stacks on the felt
    [[0.1, 0xc0182a, 5], [0.45, 0x1e5bd6, 8], [0.85, 0x161616, 3], [1.2, 0x12a84e, 6]].forEach(([x, c, n]) =>
      g.add(cyl(0.1, 0.1, n * 0.035, std(c, { roughness: 0.4 }), x, 0.59 + (n * 0.035) / 2, 0.2 - x * 0.2, 16))
    );
    u.push((dt, t) => {
      disc.rotation.z += dt * 1.6;
      ball.position.set(-1.0 + Math.cos(-t * 3.2) * 0.5, 0.84, Math.sin(-t * 3.2) * 0.5);
    });
    return g;
  },

  slots(u) {
    const g = new THREE.Group();
    const body = std(0x2a1640, { metalness: 0.6, roughness: 0.35 });
    const sevens = canvasTex(128, 96, (x) => {
      x.fillStyle = '#fff';
      x.fillRect(0, 0, 128, 96);
      x.font = '900 52px Georgia, serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillStyle = '#111';
      x.fillText('777', 64, 52);
    });
    for (let i = 0; i < 5; i++) {
      const x = -1.36 + i * 0.68;
      const cab = new THREE.Group();
      cab.position.set(x, 0, -Math.abs(x) * 0.3);
      cab.rotation.y = -x * 0.28;
      cab.add(box(0.6, 1.3, 0.55, body, 0, 0.65, 0));
      const screen = new THREE.MeshBasicMaterial({ map: sevens, color: 0xffffff });
      cab.add(mesh(new THREE.PlaneGeometry(0.44, 0.34), screen, 0, 0.92, 0.28));
      const top = new THREE.MeshBasicMaterial({ color: 0xff2d9a });
      cab.add(box(0.64, 0.22, 0.58, top, 0, 1.42, 0));
      cab.add(cyl(0.02, 0.02, 0.4, std(0xcccccc, { metalness: 1, roughness: 0.2 }), 0.34, 0.95, 0.05, 8));
      cab.add(mesh(new THREE.SphereGeometry(0.06, 12, 8), std(0xff2030), 0.34, 1.17, 0.05));
      g.add(cab);
      u.push((dt, t) => {
        screen.color.setHSL((t * 0.25 + i * 0.18) % 1, 1, 0.62);
        top.color.setHSL((t * 0.4 + i * 0.2) % 1, 1, Math.sin(t * 6 + i) > 0 ? 0.6 : 0.35);
      });
    }
    return g;
  },

};

// the blackjack table: cards dealt at every seat, and an ace spinning over the dealer's spot
MODELS.blackjack = (u) => {
  const g = new THREE.Group();
  const felt = std(0x0f6a3a, { roughness: 0.9 });
  const leather = std(0x2a120a, { roughness: 0.45 });
  // a half-moon table, the dealer's straight edge at the back
  const half = (r, h) => new THREE.CylinderGeometry(r, r, h, 40, 1, false, -Math.PI / 2, Math.PI);
  g.add(cyl(0.3, 0.42, 0.5, std(0x1a0a06), 0, 0.25, -0.3, 16));
  g.add(mesh(half(1.5, 0.16), leather, 0, 0.55, -0.35));
  g.add(mesh(half(1.36, 0.06), felt, 0, 0.64, -0.35));
  g.add(box(0.7, 0.06, 0.2, std(0x111111, { roughness: 0.3 }), 0, 0.69, -0.24)); // the chip tray
  g.add(box(0.24, 0.16, 0.34, std(0x7a1020, { roughness: 0.4 }), 0.8, 0.74, -0.18)); // the shoe
  const face = canvasTex(64, 88, (x) => {
    x.fillStyle = '#fff';
    x.fillRect(0, 0, 64, 88);
    x.fillStyle = '#c0182a';
    x.font = '900 34px Georgia, serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('A♥', 32, 46);
  });
  const cardMat = new THREE.MeshStandardMaterial({ map: face, roughness: 0.5, side: THREE.DoubleSide });
  const cardGeo = new THREE.PlaneGeometry(0.16, 0.22);
  // two cards at each of five seats, and a stool in front of each
  for (let i = 0; i < 5; i++) {
    const a = -1.05 + i * 0.525;
    for (let k = 0; k < 2; k++) {
      const c = mesh(cardGeo, cardMat, Math.sin(a) * 0.95 + k * 0.07, 0.675 + k * 0.002, -0.35 + Math.cos(a) * 0.95 - k * 0.03);
      c.rotation.set(-Math.PI / 2, 0, -a + k * 0.2);
      g.add(c);
    }
    g.add(cyl(0.03, 0.03, 0.45, std(0xaaaaaa, { metalness: 1, roughness: 0.3 }), Math.sin(a) * 1.8, 0.22, -0.35 + Math.cos(a) * 1.8, 8));
    g.add(cyl(0.15, 0.13, 0.07, std(0x0f4f8a, { roughness: 0.5 }), Math.sin(a) * 1.8, 0.47, -0.35 + Math.cos(a) * 1.8, 16));
  }
  // an ace, spinning over the dealer's spot
  const tease = mesh(new THREE.PlaneGeometry(0.34, 0.47), cardMat, 0, 1.25, -0.3);
  g.add(tease);
  u.push((dt, t) => {
    tease.rotation.y += dt * 1.6;
    tease.position.y = 1.25 + Math.sin(t * 1.8) * 0.08;
  });
  return g;
};

/** A velvet rope on gold posts, all the way round a place that isn't open yet. */
function velvetRope(r = 1.95, posts = 10) {
  const g = new THREE.Group();
  const gold = std(0xe8c35a, { metalness: 1, roughness: 0.25 });
  const velvet = std(0xa0102a, { roughness: 0.6 });
  const at = (i) => new THREE.Vector3(Math.sin((i / posts) * Math.PI * 2) * r, 0.62, Math.cos((i / posts) * Math.PI * 2) * r);
  for (let i = 0; i < posts; i++) {
    const p = at(i);
    g.add(cyl(0.04, 0.06, 0.62, gold, p.x, 0.31, p.z, 10));
    g.add(mesh(new THREE.SphereGeometry(0.07, 12, 8), gold, p.x, 0.66, p.z));
    const q = at(i + 1);
    const mid = p.clone().lerp(q, 0.5);
    mid.y -= 0.2; // it sags
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p, mid, q), 12, 0.025, 6), velvet));
  }
  return g;
}

// ---------- the map ----------
export class CasinoMap {
  /**
   * canvas: where to draw. places: [{ id, name, emoji, color, pos: [x, z], soon }] (a model each, in MODELS;
   *   a soon place is roped off, and you can't walk in)
   * here: where you are. look: your character. dave: put Dave by the roulette table?
   * onPick(id): you tapped a place on the map
   */
  constructor(canvas, { places, here, look, dave = false, onPick }) {
    this.canvas = canvas;
    this.onPick = onPick;
    const r = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.3;

    const s = (this.scene = new THREE.Scene());
    s.background = new THREE.Color(0x0c0610);
    s.fog = new THREE.Fog(0x0c0610, 22, 42);
    const pmrem = new THREE.PMREMGenerator(r);
    this.env = s.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    s.add(new THREE.HemisphereLight(0xffe0f0, 0x200810, 0.7));
    const key = new THREE.DirectionalLight(0xfff0dd, 1.4);
    key.position.set(-4, 10, 6);
    s.add(key);

    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
    this.fit = 20; // how far back the whole floor fits (see resize)
    this.updates = [];
    this.glow = glowTex();
    this.buildFloor();

    // the places, each on a glowing pad
    this.places = new Map();
    this.hits = [];
    places.forEach((p, i) => {
      const color = new THREE.Color(p.color);
      const root = new THREE.Group();
      root.position.set(p.pos[0], 0, p.pos[1]);
      const pop = new THREE.Group(); // pops up out of the floor on the way in
      root.add(pop);
      pop.add(cyl(1.55, 1.6, 0.06, std(0x1a0a14, { roughness: 0.3, metalness: 0.4 }), 0, 0.03, 0, 48));
      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45 });
      const ring = mesh(new THREE.RingGeometry(1.42, 1.56, 64), ringMat, 0, 0.07, 0);
      ring.rotation.x = -Math.PI / 2;
      pop.add(ring);
      const haloMat = new THREE.MeshBasicMaterial({ map: this.glow, color, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false });
      const halo = mesh(new THREE.PlaneGeometry(4.2, 4.2), haloMat, 0, 0.08, 0);
      halo.rotation.x = -Math.PI / 2;
      pop.add(halo);
      const model = MODELS[p.id]?.(this.updates);
      if (model) pop.add(model);
      if (p.soon) pop.add(velvetRope());
      const light = new THREE.PointLight(color, p.soon ? 3 : 6, 6, 1.6);
      light.position.set(0, 2.4, 0.6);
      root.add(light);
      const label = tag(`${p.emoji} ${p.name}${p.soon ? ' · SOON' : ''}`, p.color);
      label.position.set(0, 2.7, 0);
      root.add(label);
      const hit = mesh(new THREE.CylinderGeometry(1.6, 1.6, 2.8, 16), new THREE.MeshBasicMaterial({ visible: false }), 0, 1.4, 0);
      hit.userData.id = p.id;
      root.add(hit);
      this.hits.push(hit);
      s.add(root);
      this.places.set(p.id, { ...p, i, root, pop, ringMat, haloMat, ring, label, light, spot: new THREE.Vector3(p.pos[0], 0, p.pos[1] + 1.25) });
    });

    // the beacon over whatever you've picked
    const beamMat = (this.beamMat = new THREE.MeshBasicMaterial({ map: beamTex(), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    this.beam = mesh(new THREE.CylinderGeometry(1.3, 1.5, 7, 32, 1, true), beamMat, 0, 3.5, 0);
    this.beam.visible = false;
    s.add(this.beam);

    // you
    this.me = new THREE.Group();
    this.avatar = buildAvatar(look);
    this.avatar.root.scale.setScalar(ME_SCALE);
    this.me.add(this.avatar.root);
    this.me.updateMatrixWorld(true);
    this.avatar.root.position.y = -new THREE.Box3().setFromObject(this.avatar.root).min.y + 0.07;
    const arrow = (this.arrow = mesh(new THREE.ConeGeometry(0.22, 0.44, 4), new THREE.MeshBasicMaterial({ color: 0xffd23f }), 0, 2.0, 0));
    arrow.rotation.x = Math.PI;
    this.me.add(arrow);
    const pulseMat = (this.pulseMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.pulse = mesh(new THREE.RingGeometry(0.36, 0.46, 40), pulseMat, 0, 0.09, 0);
    this.pulse.rotation.x = -Math.PI / 2;
    this.me.add(this.pulse);
    this.here = here;
    this.me.position.copy(this.places.get(here)?.spot || new THREE.Vector3());
    s.add(this.me);

    // Dave, hanging round the roulette table, obviously
    const table = this.places.get('roulette');
    if (dave && table) {
      this.dave = buildDave();
      this.dave.root.scale.setScalar(ME_SCALE * 0.95);
      this.dave.root.updateMatrixWorld(true);
      const feet = new THREE.Box3().setFromObject(this.dave.root).min.y;
      this.dave.root.position.set(table.pos[0] - 1.9, 0.07 - feet, table.pos[1] + 1.1);
      this.dave.root.rotation.y = 0.5;
      this.dave.armL.g.rotation.x = -2.2; // cheers 🍺
      s.add(this.dave.root);
    }

    // the trail you walk along
    const dotGeo = new THREE.SphereGeometry(0.07, 8, 6);
    const dotMat = (this.dotMat = new THREE.MeshBasicMaterial({ color: 0xffe27a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.dots = Array.from({ length: 48 }, () => {
      const d = mesh(dotGeo, dotMat);
      d.visible = false;
      s.add(d);
      return d;
    });
    this.burstMat = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.burst = mesh(new THREE.RingGeometry(0.5, 0.62, 48), this.burstMat, 0, 0.1, 0);
    this.burst.rotation.x = -Math.PI / 2;
    s.add(this.burst);

    this.buildAir();

    // the camera: swoops down from above on the way in, then drifts
    this.view = { ...VIEW };
    this.target = new THREE.Vector3(0, 0, 0.4);
    this.aim = this.target.clone();
    this.dist = this.fit;
    this.intro = 0;
    this.selected = null;
    this.hovered = null;
    this.trip = null;
    this.clock = new THREE.Clock();
    this.bindPointer();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.resize();
    r.setAnimationLoop(() => this.frame());
  }

  buildFloor() {
    const s = this.scene;
    const { w, d } = FLOOR;
    const carpet = carpetTex();
    carpet.repeat.set(w / 3.75, d / 3.75);
    const floor = mesh(new THREE.PlaneGeometry(w, d), std(0xffffff, { map: carpet, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    s.add(floor);
    // the walkway down the side, with gold trim
    const gold = std(0xe8c35a, { metalness: 1, roughness: 0.25 });
    const aisle = mesh(new THREE.PlaneGeometry(1.1, d - 1), std(0x7a1a30, { roughness: 0.9 }), AISLE_X, 0.01, 0);
    aisle.rotation.x = -Math.PI / 2;
    s.add(aisle);
    for (const x of [AISLE_X - 0.58, AISLE_X + 0.58]) s.add(box(0.04, 0.02, d - 1, gold, x, 0.02, 0));
    const wall = std(0x1a0b12, { roughness: 0.7 });
    const neonPink = new THREE.MeshBasicMaterial({ color: 0xff2d9a });
    const neonCyan = new THREE.MeshBasicMaterial({ color: 0x2de0ff });
    s.add(box(w, 0.9, 0.3, wall, 0, 0.45, -d / 2), box(w, 0.06, 0.06, neonPink, 0, 0.93, -d / 2 + 0.16));
    for (const side of [-1, 1]) s.add(box(0.3, 0.9, d, wall, (side * w) / 2, 0.45, 0), box(0.06, 0.06, d, neonCyan, side * (w / 2 - 0.16), 0.93, 0));
  }

  buildAir() {
    const s = this.scene;
    // gold dust drifting up through the lights
    const n = 160;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 14, Math.random() * 6, (Math.random() - 0.5) * 14], i * 3);
    this.dust = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ map: this.glow, color: 0xffe0a0, size: 0.16, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    s.add(this.dust);
    // two searchlights sweeping the floor
    this.sweeps = [0xff2d9a, 0x2de0ff].map((c, i) => {
      const g = new THREE.Group();
      const geo = new THREE.ConeGeometry(1.8, 11, 32, 1, true);
      geo.translate(0, -5.5, 0); // tip at the lamp
      g.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
      g.position.set(i ? 6.5 : -6.5, 9, -6.5);
      s.add(g);
      return g;
    });
  }

  resize() {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    // back off until the floor fits across, and top to bottom
    const tan = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
    this.fit = clamp(Math.max((FLOOR.w / 2 + 0.6) / (tan * this.camera.aspect), ((FLOOR.d / 2) * 1.05) / tan), 12, 32);
  }

  // ---------- touch ----------
  bindPointer() {
    const el = this.canvas;
    el.style.touchAction = 'none';
    const ndc = (e) => new THREE.Vector2((e.offsetX / el.clientWidth) * 2 - 1, -(e.offsetY / el.clientHeight) * 2 + 1);
    const ray = new THREE.Raycaster();
    const pick = (e) => {
      ray.setFromCamera(ndc(e), this.camera);
      return ray.intersectObjects(this.hits, false)[0]?.object.userData.id || null;
    };
    let down = null;
    this.onDown = (e) => {
      down = { x: e.clientX, y: e.clientY, yaw: this.view.yaw, pitch: this.view.pitch, moved: false };
      el.setPointerCapture?.(e.pointerId);
    };
    this.onMove = (e) => {
      if (down) {
        const dx = e.clientX - down.x;
        const dy = e.clientY - down.y;
        if (Math.hypot(dx, dy) > 6) down.moved = true;
        if (down.moved) {
          this.view.yaw = clamp(down.yaw - dx * 0.008, -1.1, 1.1);
          this.view.pitch = clamp(down.pitch + dy * 0.005, 0.55, 1.4);
          this.lastDrag = this.clock.elapsedTime;
        }
        return;
      }
      const id = pick(e);
      if (id !== this.hovered) {
        this.hovered = id;
        el.style.cursor = id ? 'pointer' : 'grab';
      }
    };
    this.onUp = (e) => {
      if (down && !down.moved && !this.trip) {
        const id = pick(e);
        if (id) this.onPick?.(id);
      }
      down = null;
    };
    this.onLeave = () => (this.hovered = null);
    el.addEventListener('pointerdown', this.onDown);
    el.addEventListener('pointermove', this.onMove);
    el.addEventListener('pointerup', this.onUp);
    el.addEventListener('pointercancel', this.onUp);
    el.addEventListener('pointerleave', this.onLeave);
    el.style.cursor = 'grab';
  }

  /** Light a place up and fly over to it (null: back to the whole floor). */
  select(id) {
    this.selected = id;
    const p = this.places.get(id);
    this.beam.visible = !!p;
    if (p) {
      this.beam.position.set(p.pos[0], 3.5, p.pos[1]);
      this.beamMat.color.set(p.color);
      this.beamGrow = 0;
      p.pop.scale.setScalar(1.12); // a little bounce
    }
  }

  /** Walk to a place along the aisle, leaving a glowing trail. done() once you get there. */
  travel(id, done) {
    const p = this.places.get(id);
    if (!p || this.trip) return;
    const from = this.me.position.clone();
    const to = p.spot.clone();
    const curve = new THREE.CatmullRomCurve3(route(from, to), false, 'centripetal');
    const len = curve.getLength();
    this.trip = { curve, t: 0, dur: clamp(len / 5.2, 1.1, 2.6), done, id, len };
    this.dots.forEach((d, i) => {
      d.position.copy(curve.getPointAt((i + 0.5) / this.dots.length));
      d.position.y = 0.12;
      d.visible = true;
      d.scale.setScalar(0.001);
    });
    this.dotMat.opacity = 1;
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    this.intro = Math.min(1, this.intro + dt / 1.7);
    const k = easeInOut(this.intro);

    this.updates.forEach((fn) => fn(dt, t));

    // pads: pop in on the way in; glow when hovered or picked
    for (const p of this.places.values()) {
      const local = clamp((this.intro * 1.7 - 0.25 - p.i * 0.12) / 0.55, 0, 1);
      const want = local >= 1 ? 1 : backOut(local);
      if (local < 1) p.pop.scale.setScalar(Math.max(0.001, want));
      else p.pop.scale.setScalar(THREE.MathUtils.lerp(p.pop.scale.x, 1, 1 - Math.exp(-dt * 8)));
      p.label.visible = local > 0.6;
      p.label.position.y = 2.7 + Math.sin(t * 1.6 + p.i) * 0.07;
      const on = p.id === this.selected;
      const hot = on || p.id === this.hovered;
      p.ringMat.opacity = on ? 0.75 + Math.sin(t * 6) * 0.25 : hot ? 0.85 : p.soon ? 0.25 : 0.45;
      p.haloMat.opacity = on ? 0.55 : hot ? 0.4 : 0.2;
      p.light.intensity = (on ? 11 : 6) * (p.soon ? 0.5 : 1);
    }
    if (this.beam.visible) {
      this.beamGrow = Math.min(1, this.beamGrow + dt * 2.5);
      this.beam.scale.set(1, ease(this.beamGrow), 1);
      this.beam.position.y = 3.5 * ease(this.beamGrow);
      this.beamMat.opacity = 0.35 + Math.sin(t * 3) * 0.1;
      this.beam.rotation.y += dt * 0.4;
    }

    // you: idle, or walking the trail
    const a = this.avatar;
    animateAvatar(a, t);
    if (this.trip) {
      const trip = this.trip;
      trip.t = Math.min(1, trip.t + dt / trip.dur);
      const u = easeInOut(trip.t);
      const pos = trip.curve.getPointAt(u);
      const ahead = trip.curve.getTangentAt(Math.min(0.999, u + 0.001));
      this.me.position.set(pos.x, 0, pos.z);
      this.me.rotation.y = Math.atan2(ahead.x, ahead.z);
      const step = t * 14;
      a.legs[0].rotation.x = Math.sin(step) * 0.7;
      a.legs[1].rotation.x = -Math.sin(step) * 0.7;
      a.armL.g.rotation.x = -Math.sin(step) * 0.6;
      a.armR.g.rotation.x = Math.sin(step) * 0.6;
      a.body.position.y = Math.abs(Math.sin(step)) * 0.12;
      this.dots.forEach((d, i) => {
        const at = (i + 0.5) / this.dots.length;
        const s = at <= u + 0.02 ? 1 : clamp(1 - (at - u) * 4, 0.001, 1) * 0.5;
        d.scale.setScalar(s * (1 + Math.sin(t * 8 - i * 0.6) * 0.25));
      });
      this.aim.set(pos.x, 0, pos.z);
      if (trip.t >= 1) {
        this.trip = null;
        this.here = trip.id;
        a.legs.forEach((l) => (l.rotation.x = 0));
        this.burst.position.set(pos.x, 0.1, pos.z);
        this.burstT = 0;
        this.fadeDots = 1;
        setTimeout(() => trip.done?.(), 450);
      }
    } else {
      // turn back to face the camera
      this.me.rotation.y = THREE.MathUtils.lerp(this.me.rotation.y, this.view.yaw, 1 - Math.exp(-dt * 5));
      const p = this.places.get(this.selected);
      this.aim.set(p ? p.pos[0] : 0, 0, p ? p.pos[1] + 0.4 : 0.4);
    }
    this.arrow.position.y = 1.95 + Math.abs(Math.sin(t * 3)) * 0.25;
    this.arrow.rotation.y = t * 2;
    const ph = (t * 0.9) % 1;
    this.pulse.scale.setScalar(1 + ph * 2.2);
    this.pulseMat.opacity = 0.8 * (1 - ph);
    if (this.fadeDots) {
      this.fadeDots = Math.max(0, this.fadeDots - dt * 1.2);
      this.dotMat.opacity = this.fadeDots;
      if (!this.fadeDots) this.dots.forEach((d) => (d.visible = false));
    }
    if (this.burstT != null) {
      this.burstT += dt;
      const b = Math.min(1, this.burstT / 0.7);
      this.burst.scale.setScalar(1 + b * 3);
      this.burstMat.opacity = 1 - b;
      if (b >= 1) this.burstT = null;
    }
    if (this.dave) {
      this.dave.body.rotation.z = Math.sin(t * 1.4) * 0.08;
      this.dave.armL.g.rotation.x = -2.2 + Math.sin(t * 2.3) * 0.25;
    }

    // air
    const d = this.dust.geometry.attributes.position;
    for (let i = 0; i < d.count; i++) {
      let y = d.getY(i) + dt * 0.35;
      if (y > 6) y = 0;
      d.setY(i, y);
    }
    d.needsUpdate = true;
    this.sweeps.forEach((g, i) => g.rotation.set(0.55 + Math.sin(t * 0.5 + i * 2) * 0.25, 0, (i ? -1 : 1) * (0.5 + Math.sin(t * 0.37 + i) * 0.35)));

    // the camera: the intro swoop, then it follows what you're looking at, and sways a little
    this.aim.z = clamp(this.aim.z, -FLOOR.d / 2 + 3, FLOOR.d / 2 - 4); // keep the floor filling the view
    this.target.lerp(this.aim, 1 - Math.exp(-dt * 3));
    const wantDist = this.selected || this.trip ? this.fit * 0.7 : this.fit;
    this.dist = THREE.MathUtils.lerp(this.dist, wantDist, 1 - Math.exp(-dt * 2.5));
    const idle = t - (this.lastDrag ?? -99) > 4;
    const sway = idle ? Math.sin(t * 0.25) * 0.12 : 0;
    const yaw = THREE.MathUtils.lerp(-0.9, this.view.yaw + sway, k);
    const pitch = THREE.MathUtils.lerp(1.52, this.view.pitch, k);
    const dist = THREE.MathUtils.lerp(34, this.dist, k);
    this.camera.position.set(
      this.target.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      this.target.y + Math.sin(pitch) * dist,
      this.target.z + Math.cos(yaw) * Math.cos(pitch) * dist
    );
    this.camera.lookAt(this.target);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    const el = this.canvas;
    el.removeEventListener('pointerdown', this.onDown);
    el.removeEventListener('pointermove', this.onMove);
    el.removeEventListener('pointerup', this.onUp);
    el.removeEventListener('pointercancel', this.onUp);
    el.removeEventListener('pointerleave', this.onLeave);
    disposeAvatar(this.avatar);
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      [].concat(o.material || []).forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    });
    this.env.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
  }
}

/** From one spot to another: out to the walkway down the side, along it, and in again. */
function route(from, to) {
  const pts = [from.clone(), new THREE.Vector3(AISLE_X, 0, from.z), new THREE.Vector3(AISLE_X, 0, to.z), to.clone()];
  // drop points that sit on top of each other (the curve hates those)
  return pts.filter((p, i) => i === 0 || p.distanceTo(pts[i - 1]) > 0.2);
}
