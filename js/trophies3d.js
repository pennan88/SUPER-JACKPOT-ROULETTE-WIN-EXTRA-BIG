// 🏆 Trophies, in 3D: one per achievement, on a shelf behind your character (and spinning
// across the screen the moment you earn one).

import * as THREE from 'three';

const TIERS = {
  gold: { color: 0xe8c35a, roughness: 0.22 },
  silver: { color: 0xd8dde3, roughness: 0.2 },
  bronze: { color: 0xc07a3e, roughness: 0.32 },
};

const metal = (tier) => new THREE.MeshStandardMaterial({ ...TIERS[tier], metalness: 1 });
const marble = () => new THREE.MeshStandardMaterial({ color: 0x1b1b1f, roughness: 0.35, metalness: 0.2 });

function plinth(g) {
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.14, 0.5), marble());
  base.position.y = 0.07;
  g.add(base);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.4), marble());
  cap.position.y = 0.17;
  g.add(cap);
}

function cup(g, m) {
  const pts = [[0, 0], [0.14, 0], [0.14, 0.03], [0.04, 0.06], [0.035, 0.2], [0.07, 0.24], [0.17, 0.32], [0.2, 0.5], [0.19, 0.52], [0.16, 0.36], [0.06, 0.27], [0, 0.26]];
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 32), m);
  body.position.y = 0.2;
  g.add(body);
  for (const side of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 8, 20, Math.PI * 1.2), m);
    h.position.set(side * 0.2, 0.62, 0);
    h.rotation.z = side < 0 ? Math.PI * 0.4 : -Math.PI * 0.4 + Math.PI;
    g.add(h);
  }
}

function star(g, m) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 ? 0.09 : 0.22;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const fn = i ? 'lineTo' : 'moveTo';
    s[fn](Math.cos(a) * r, Math.sin(a) * r);
  }
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 });
  geo.center();
  const st = new THREE.Mesh(geo, m);
  st.position.y = 0.52;
  g.add(st);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.14, 12), m);
  post.position.y = 0.27;
  g.add(post);
}

function chip(g, m, tier) {
  const face = new THREE.MeshStandardMaterial({ color: tier === 'gold' ? 0x111111 : tier === 'silver' ? 0x1d4ed8 : 0xc0182a, roughness: 0.4 });
  const c = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.06, 32), [m, face, face]);
  c.rotation.x = Math.PI / 2;
  c.position.y = 0.46;
  g.add(c);
  for (let i = 0; i < 6; i++) {
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.03), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
    const a = (i / 6) * Math.PI * 2;
    notch.position.set(Math.cos(a) * 0.19, 0.46 + Math.sin(a) * 0.19, 0);
    notch.rotation.z = a;
    g.add(notch);
  }
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.1, 12), m);
  post.position.y = 0.24;
  g.add(post);
}

function bottle(g, m) {
  const glass = new THREE.MeshStandardMaterial({ color: 0x0f3d1e, roughness: 0.15, metalness: 0.3 });
  const pts = [[0, 0], [0.09, 0], [0.095, 0.24], [0.06, 0.32], [0.035, 0.36], [0.035, 0.46], [0, 0.46]];
  const b = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 24), glass);
  b.position.y = 0.2;
  g.add(b);
  const foil = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 16), m);
  foil.position.y = 0.62;
  g.add(foil);
  const label = new THREE.Mesh(new THREE.CylinderGeometry(0.097, 0.097, 0.09, 24, 1, true), m);
  label.position.y = 0.33;
  g.add(label);
}

function crown(g, m) {
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.16, 0.12, 24, 1, true), m);
  m.side = THREE.DoubleSide;
  ring.position.y = 0.3;
  g.add(ring);
  const gem = new THREE.MeshStandardMaterial({ color: 0xe0142c, roughness: 0.1, metalness: 0.3 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.14, 8), m);
    spike.position.set(Math.cos(a) * 0.16, 0.42, Math.sin(a) * 0.16);
    g.add(spike);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), m);
    ball.position.set(Math.cos(a) * 0.16, 0.5, Math.sin(a) * 0.16);
    g.add(ball);
    const j = new THREE.Mesh(new THREE.OctahedronGeometry(0.03), gem);
    j.position.set(Math.cos(a + 0.5) * 0.17, 0.3, Math.sin(a + 0.5) * 0.17);
    g.add(j);
  }
}

const SHAPES = { cup, star, chip, bottle, crown };

/** A trophy about 0.7 units tall, standing at y = 0. */
export function buildTrophy(kind = 'cup', tier = 'gold') {
  const g = new THREE.Group();
  plinth(g);
  (SHAPES[kind] || cup)(g, metal(tier), tier);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

/** An empty spot on the shelf: a dim plinth with a question mark floating over it. */
function emptySpot() {
  const g = new THREE.Group();
  plinth(g);
  g.children.forEach((c) => (c.material = new THREE.MeshStandardMaterial({ color: 0x2a1a20, roughness: 0.8, transparent: true, opacity: 0.55 })));
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(255, 233, 168, 0.35)';
  x.font = 'bold 48px Georgia, serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('?', 32, 34);
  const tex = new THREE.CanvasTexture(c);
  const q = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  q.scale.setScalar(0.3);
  q.position.y = 0.42;
  g.add(q);
  return g;
}

/**
 * Two wooden shelves, one each side of the turntable, with a trophy for every achievement you
 * have (and a "?" for the rest).
 * @param list [{ kind, tier, earned }]
 */
export function buildShelf(list) {
  const root = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x4a2412, roughness: 0.45 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xe8c35a, metalness: 1, roughness: 0.3 });
  const perSide = Math.ceil(list.length / 2);
  const perRow = Math.ceil(perSide / 2);
  const spots = [];
  for (const side of [-1, 1]) {
    for (let row = 0; row < 2; row++) {
      const y = row ? 2.1 : 0.55;
      const board = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 0.8), wood);
      board.position.set(side * 3.1, y, 0);
      root.add(board);
      // a little display light over each shelf
      const lamp = new THREE.PointLight(0xfff0d0, 16, 4, 1.4);
      lamp.position.set(side * 3.1, y + 1.0, 0.9);
      root.add(lamp);
      const lip = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.03, 0.03), brass);
      lip.position.set(side * 3.1, y + 0.02, 0.41);
      root.add(lip);
      for (let i = 0; i < perRow; i++) spots.push(new THREE.Vector3(side * 3.1 + (i - (perRow - 1) / 2) * Math.min(0.72, 2.1 / Math.max(1, perRow - 1)), y + 0.05, 0.05));
    }
  }
  list.forEach((t, i) => {
    const spot = spots[i];
    if (!spot) return;
    const m = t.earned ? buildTrophy(t.kind, t.tier) : emptySpot();
    m.position.copy(spot);
    m.scale.setScalar(t.earned ? 1.05 : 0.9);
    m.rotation.y = -Math.sign(spot.x) * 0.25; // turned slightly towards the middle
    root.add(m);
  });
  return root;
}

export function disposeTree(o) {
  o?.traverse((n) => {
    n.geometry?.dispose();
    [].concat(n.material || []).forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
  });
}
