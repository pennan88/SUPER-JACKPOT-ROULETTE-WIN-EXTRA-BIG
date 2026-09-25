// 🃏 The blackjack room, in 3D: a half-moon table, a shoe of cards, chips, and a very smug dealer
// (built with the same character builder as you: tux, bow tie, mustache, smirk).

import * as THREE from 'three';
import { Stage3D, texFrom } from './kitchen3d.js';
import { buildScenery } from './scenery.js';
import { buildAvatar, animateAvatar, disposeAvatar, DEFAULT_LOOK } from './avatar.js';

const TABLE_Y = -0.42;
const FLOOR_Y = -1.34; // where everyone's shoes are // the felt (same height as the roulette table, so the casino fits around it)
const R = 3.7; // the table's curve
const BACK_Z = -1.9; // the dealer's straight edge
export const CARD_W = 0.5;
export const CARD_H = 0.7;
const SHOE = new THREE.Vector3(3.05, TABLE_Y + 0.42, -1.72);
const DISCARD = new THREE.Vector3(-3.05, TABLE_Y + 0.11, -1.72);

// the other seats (degrees round the table from straight ahead; + is the dealer's left, your right)
export const SEAT_ANGLES = [82, 60, -60, -82];
const polar = (r, deg, y) => {
  const a = (deg * Math.PI) / 180;
  return new THREE.Vector3(Math.sin(a) * r, y, BACK_Z + Math.cos(a) * r);
};

const HAND_X = { 1: [0], 2: [1.25, -1.25], 3: [1.25, 0, -1.25] };
const handX = (h, n) => (HAND_X[n] || HAND_X[3])[h] ?? 0;
export const MAX_HANDS = 3;

// where things go on the felt
export const SPOTS = {
  dealer: (i) => new THREE.Vector3(-0.55 + i * 0.36, TABLE_Y + 0.006 + i * 0.002, -1.0),
  hand: (h, n, i) => new THREE.Vector3(handX(h, n) - 0.2 + i * 0.3, TABLE_Y + 0.006 + i * 0.002, 0.55 - i * 0.03),
  bet: (h, n) => new THREE.Vector3(handX(h, n), TABLE_Y, 1.35),
  // the side bets, either side of your main circle
  side: (kind) => new THREE.Vector3(kind === 'pairs' ? -0.64 : 0.64, TABLE_Y, 1.08),
  tip: () => new THREE.Vector3(0.55, TABLE_Y, -1.15),
  // a bot's cards fan out along the curve, turned to face their seat
  seatCard: (deg, i) => {
    const a = (deg * Math.PI) / 180;
    const tangent = new THREE.Vector3(Math.cos(a), 0, -Math.sin(a));
    return polar(2.35, deg, TABLE_Y + 0.006 + i * 0.002).addScaledVector(tangent, -0.15 + i * 0.28);
  },
  seatRot: (deg) => (deg * Math.PI) / 180,
  seatBet: (deg) => polar(3.1, deg, TABLE_Y),
};

const CHIP_COLORS = { 1: '#f2f2f2', 5: '#d62b2b', 25: '#1f9d4c', 100: '#161616', 500: '#7b3fbf', 1000: '#e8a321' };
const DENOMS = [1000, 500, 100, 25, 5, 1];
const breakdown = (v) => {
  const out = [];
  for (const d of DENOMS) while (v >= d && out.length < 14) (out.push(d), (v -= d));
  return out;
};

const DEALER_LOOK = {
  ...DEFAULT_LOOK,
  skin: '#e0ac69',
  hair: 'short',
  hairColor: '#1c120c',
  facial: 'mustache',
  face: 'smirk',
  build: 'regular',
  top: 'tux',
  neck: 'bowtie',
  shirt: '#f4f4f4',
  pants: '#1f1f24',
  shoes: '#0a0a0a',
};

// ---------- textures ----------
const SUIT_GLYPH = { S: '♠', H: '♥', D: '♦', C: '♣' };
function cardFace(rank, suit) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 358;
  const x = c.getContext('2d');
  x.fillStyle = '#fbfaf5';
  x.beginPath();
  x.roundRect(0, 0, 256, 358, 22);
  x.fill();
  x.strokeStyle = '#d8d3c4';
  x.lineWidth = 4;
  x.stroke();
  const red = suit === 'H' || suit === 'D';
  x.fillStyle = red ? '#c8102e' : '#141414';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  const g = SUIT_GLYPH[suit];
  const corner = (flip) => {
    x.save();
    if (flip) {
      x.translate(256, 358);
      x.rotate(Math.PI);
    }
    x.font = 'bold 54px Georgia, serif';
    x.fillText(rank, 36, 44);
    x.font = '44px serif';
    x.fillText(g, 36, 92);
    x.restore();
  };
  corner(false);
  corner(true);
  if ('JQK'.includes(rank)) {
    // a court card: a gold frame, the letter and a crown
    x.strokeStyle = '#c9953a';
    x.lineWidth = 6;
    x.strokeRect(62, 70, 132, 218);
    x.font = 'bold 120px Georgia, serif';
    x.fillText(rank, 128, 200);
    x.font = '56px serif';
    x.fillText(rank === 'K' ? '👑' : rank === 'Q' ? '💃' : '🎩', 128, 110);
  } else if (rank === 'A') {
    x.font = '170px serif';
    x.fillText(g, 128, 185);
  } else {
    x.font = '120px serif';
    x.fillText(g, 128, 185);
  }
  return c;
}

function cardBack() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 358;
  const x = c.getContext('2d');
  x.fillStyle = '#fbfaf5';
  x.beginPath();
  x.roundRect(0, 0, 256, 358, 22);
  x.fill();
  x.fillStyle = '#7a1024';
  x.beginPath();
  x.roundRect(14, 14, 228, 330, 14);
  x.fill();
  x.strokeStyle = 'rgba(232, 195, 90, 0.55)';
  x.lineWidth = 2;
  for (let i = -400; i < 400; i += 22) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + 358, 358);
    x.moveTo(i + 358, 0);
    x.lineTo(i, 358);
    x.stroke();
  }
  x.strokeStyle = '#e8c35a';
  x.lineWidth = 5;
  x.strokeRect(26, 26, 204, 306);
  x.fillStyle = '#e8c35a';
  x.font = 'bold 44px Georgia, serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('SJR', 128, 179);
  return c;
}

const FELTS = { classic: ['#16864d', '#063b21'], highlimit: ['#8a1830', '#34050f'] };

function feltCanvas(style = 'classic') {
  const W = 2048;
  const H = 1024;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const k = W / (2 * R);
  const cx = W / 2;
  const bg = x.createRadialGradient(cx, 0, 100, cx, 0, W * 0.6);
  bg.addColorStop(0, FELTS[style][0]);
  bg.addColorStop(1, FELTS[style][1]);
  x.fillStyle = bg;
  x.fillRect(0, 0, W, H);
  const img = x.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 12;
    img.data[i] += n;
    img.data[i + 1] += n;
    img.data[i + 2] += n;
  }
  x.putImageData(img, 0, 0);
  const gold = '#e8c35a';
  // text around an arc (centred on the dealer's edge)
  const arcText = (text, r, size, from, to) => {
    x.font = `bold ${size}px Georgia, serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    const chars = [...text];
    chars.forEach((ch, i) => {
      const a = from + ((to - from) * (i + 0.5)) / chars.length;
      x.save();
      x.translate(cx + Math.cos(a) * r * k, Math.sin(a) * r * k);
      x.rotate(a - Math.PI / 2);
      x.fillText(ch, 0, 0);
      x.restore();
    });
  };
  x.fillStyle = gold;
  arcText('BLACKJACK PAYS 3 TO 2', 1.7, 54, Math.PI * 0.8, Math.PI * 0.2);
  x.fillStyle = 'rgba(255, 255, 255, 0.75)';
  arcText('Dealer must stand on all 17s', 2.02, 34, Math.PI * 0.8, Math.PI * 0.2);
  // the insurance band
  x.strokeStyle = gold;
  x.lineWidth = 5;
  for (const r of [2.25, 2.6]) {
    x.beginPath();
    x.arc(cx, 0, r * k, Math.PI * 0.18, Math.PI * 0.82);
    x.stroke();
  }
  x.fillStyle = gold;
  arcText('✦ INSURANCE PAYS 2 TO 1 ✦', 2.425, 38, Math.PI * 0.78, Math.PI * 0.22);
  // betting circles (one, or two when you split)
  const circle = (bx, bz, label, r = 0.36) => {
    const px = cx + bx * k;
    const py = (bz - BACK_Z) * k;
    x.strokeStyle = gold;
    x.lineWidth = 6;
    x.beginPath();
    x.arc(px, py, r * k, 0, Math.PI * 2);
    x.stroke();
    x.lineWidth = 2;
    x.beginPath();
    x.arc(px, py, (r - 0.06) * k, 0, Math.PI * 2);
    x.stroke();
    x.fillStyle = 'rgba(232, 195, 90, 0.55)';
    x.font = `bold ${r < 0.3 ? 20 : 26}px Georgia, serif`;
    x.fillText(label, px, r < 0.3 ? py : py + (r + 0.08) * k);
  };
  circle(0, 1.35, 'BET');
  circle(-1.25, 1.35, '✦');
  circle(1.25, 1.35, '✦');
  circle(-0.64, 1.08, 'PAIRS', 0.2);
  circle(0.64, 1.08, '21+3', 0.2);
  for (const deg of SEAT_ANGLES) {
    const a = (deg * Math.PI) / 180;
    circle(Math.sin(a) * 3.1, BACK_Z + Math.cos(a) * 3.1, '');
  }
  // the dealer's card box
  x.strokeStyle = 'rgba(232, 195, 90, 0.4)';
  x.setLineDash([14, 10]);
  x.strokeRect(cx - 0.9 * k, (-1.4 - BACK_Z) * k, 1.8 * k, 0.8 * k);
  return c;
}

function chipMesh(value) {
  const col = CHIP_COLORS[value] || '#888';
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = col;
  x.beginPath();
  x.arc(64, 64, 64, 0, 7);
  x.fill();
  x.strokeStyle = '#fff';
  x.lineWidth = 10;
  x.setLineDash([16, 18]);
  x.beginPath();
  x.arc(64, 64, 56, 0, 7);
  x.stroke();
  x.setLineDash([]);
  x.fillStyle = value === 1 ? '#222' : '#fff';
  x.font = 'bold 34px Georgia, serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(value >= 1000 ? '1K' : String(value), 64, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const face = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 });
  const side = new THREE.MeshStandardMaterial({ color: col, roughness: 0.45 });
  return new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.045, 28), [side, face, face]);
}

const MADAME_LOOK = {
  ...DEFAULT_LOOK,
  skin: '#f1c27d',
  hair: 'bun',
  hairColor: '#1c120c',
  facial: 'none',
  face: 'cool',
  build: 'slim',
  top: 'tux',
  neck: 'chain',
  glasses: 'monocle',
  shirt: '#f4f4f4',
  pants: '#1f1f24',
  shoes: '#0a0a0a',
};

export class BlackjackTable extends Stage3D {
  constructor(container, { highLimit = false } = {}) {
    super(container, 40);
    const s = this.scene;
    this.scenery = buildScenery(s, this.renderer, { table: false });
    s.add(new THREE.HemisphereLight(0xfff2dd, 0x1a1208, 0.6));
    const key = new THREE.SpotLight(0xfff0dd, 120, 22, 0.6, 0.5, 1.2);
    key.position.set(0, 8, 2.5);
    key.target.position.set(0, TABLE_Y, -0.2);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    this.renderer.shadowMap.enabled = true;
    s.add(key, key.target);
    const warm = new THREE.PointLight(0xffb86b, 14, 16);
    warm.position.set(-4, 3, -3);
    s.add(warm);

    this.highLimit = highLimit;
    this.buildTable();
    this.faces = new Map(); // card textures, made once
    this.backTex = texFrom(cardBack(), this.renderer);
    this.edgeMat = new THREE.MeshStandardMaterial({ color: 0xf2efe6, roughness: 0.6 });
    this.cards = [];
    this.stacks = new Map(); // key → chip group

    this.dealer = buildAvatar(highLimit ? MADAME_LOOK : DEALER_LOOK);
    this.dealer.root.scale.setScalar(0.74);
    this.dealer.root.position.set(0, 0, -2.45);
    this.standOnFloor(this.dealer);
    s.add(this.dealer.root);
    this.bots = [];
    this.dealerEmote = null;
    this.reach = 0; // 0..1, how far the dealer's arm is out (dealing)

    this.camera.position.set(0, 4.1, 5.4);
    this.lookAt = new THREE.Vector3(0, -0.1, -0.35);
    this.camera.lookAt(this.lookAt);
    this.onFrame = null;
  }

  buildTable() {
    const s = this.scene;
    const shape = new THREE.Shape();
    shape.moveTo(-R, 0);
    shape.lineTo(R, 0);
    shape.absarc(0, 0, R, 0, -Math.PI, true);
    // the felt
    const geo = new THREE.ShapeGeometry(shape, 64);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + R) / (2 * R), 1 + pos.getY(i) / R);
    const felt = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: texFrom(feltCanvas(this.highLimit ? 'highlimit' : 'classic'), this.renderer), roughness: 0.95 }));
    this.felt = felt;
    felt.rotation.x = -Math.PI / 2;
    felt.position.set(0, TABLE_Y, BACK_Z);
    felt.receiveShadow = true;
    s.add(felt);
    // wooden body under it
    const body = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, { depth: 0.9, bevelEnabled: false, curveSegments: 48 }),
      new THREE.MeshStandardMaterial({ color: 0x3a1a0c, roughness: 0.4 })
    );
    body.rotation.x = -Math.PI / 2;
    body.position.set(0, TABLE_Y - 0.91, BACK_Z);
    s.add(body);
    // the padded leather rail around the curve, with gold trim
    const pts = [];
    for (let i = 0; i <= 64; i++) {
      const a = Math.PI + (i / 64) * Math.PI; // π..2π in shape space = the player side
      pts.push(new THREE.Vector3(Math.cos(a) * (R + 0.1), TABLE_Y + 0.07, BACK_Z - Math.sin(a) * (R + 0.1)));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const rail = new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.17, 14), new THREE.MeshStandardMaterial({ color: 0x1a0b08, roughness: 0.35 }));
    rail.castShadow = true;
    s.add(rail);
    const trimPts = pts.map((p) => p.clone().setY(TABLE_Y + 0.005).sub(new THREE.Vector3(0, 0, 0)).multiply(new THREE.Vector3(0.975, 1, 1)));
    const trim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(trimPts.map((p) => new THREE.Vector3(p.x, p.y, BACK_Z + (p.z - BACK_Z) * 0.975))), 96, 0.018, 6), new THREE.MeshStandardMaterial({ color: 0xe8c35a, metalness: 1, roughness: 0.25 }));
    s.add(trim);
    // a carpet under the table, for the dealer and the players to stand on
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#3a0c16';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(232, 195, 90, 0.35)';
    g.lineWidth = 3;
    for (let i = 0; i < 256; i += 64) {
      g.beginPath();
      g.moveTo(i + 32, 0);
      g.lineTo(i + 64, 32);
      g.lineTo(i + 32, 64);
      g.lineTo(i, 32);
      g.closePath();
      g.stroke();
    }
    const carpetTex = texFrom(c, this.renderer);
    carpetTex.wrapS = carpetTex.wrapT = THREE.RepeatWrapping;
    carpetTex.repeat.set(10, 10);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(11, 64), new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = FLOOR_Y;
    floor.receiveShadow = true;
    s.add(floor);

    // the dealer's chip tray
    const trayMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.3, metalness: 0.4 });
    const tray = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.08, 0.5), trayMat);
    tray.position.set(0, TABLE_Y + 0.04, BACK_Z + 0.3);
    s.add(tray);
    [1000, 500, 100, 25, 5, 1, 1, 5, 25, 100].forEach((v, i) => {
      for (let k = 0; k < 2 + ((i * 7) % 3); k++) {
        const c = chipMesh(v);
        c.position.set(-0.99 + i * 0.22, TABLE_Y + 0.1 + k * 0.045, BACK_Z + 0.3);
        c.scale.setScalar(0.62);
        s.add(c);
      }
    });
    // the shoe: a leaning box of cards
    const shoe = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.38, 0.9), new THREE.MeshStandardMaterial({ color: 0x20120a, roughness: 0.4 }));
    shoe.add(box);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.3, 0.8), new THREE.MeshStandardMaterial({ color: 0x7a1024, roughness: 0.6 }));
    deck.position.set(0, 0.05, 0.02);
    shoe.add(deck);
    shoe.position.set(SHOE.x, TABLE_Y + 0.2, SHOE.z - 0.15);
    shoe.rotation.set(0.2, -0.5, 0);
    shoe.castShadow = true;
    s.add(shoe);
    // discard pile on the other side
    const discard = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.75), new THREE.MeshStandardMaterial({ color: 0x20120a, roughness: 0.4 }));
    discard.position.copy(DISCARD);
    discard.rotation.y = 0.5;
    s.add(discard);
  }

  faceTex(rank, suit) {
    const k = rank + suit;
    if (!this.faces.has(k)) this.faces.set(k, texFrom(cardFace(rank, suit), this.renderer));
    return this.faces.get(k);
  }

  /** Deal a card from the shoe to `to`, face up or down. Resolves when it lands. */
  deal(card, to, faceUp = true, rotY = 0) {
    const front = new THREE.MeshStandardMaterial({ map: this.faceTex(card.rank, card.suit), roughness: 0.55 });
    const back = new THREE.MeshStandardMaterial({ map: this.backTex, roughness: 0.55 });
    const e = this.edgeMat;
    const m = new THREE.Mesh(new THREE.BoxGeometry(CARD_W, 0.006, CARD_H), [e, e, front, back, e, e]);
    m.castShadow = true;
    m.position.copy(SHOE);
    m.rotation.set(0, -0.5, Math.PI);
    this.scene.add(m);
    const entry = { mesh: m, faceUp };
    this.cards.push(entry);
    const from = SHOE.clone();
    this.reach = 1;
    return new Promise((res) =>
      this.tween(
        0.38,
        (t) => {
          const k = 1 - Math.pow(1 - t, 3);
          m.position.lerpVectors(from, to, k);
          m.position.y += Math.sin(t * Math.PI) * 0.35;
          m.rotation.y = -0.5 * (1 - k) + rotY * k;
          m.rotation.z = faceUp ? Math.PI * (1 - k) : Math.PI;
        },
        () => {
          this.reach = 0;
          res(entry);
        }
      )
    );
  }

  /** Turn a face-down card over (the dealer's hole card). */
  flip(entry) {
    return new Promise((res) => {
      const m = entry.mesh;
      const y0 = m.position.y;
      this.tween(
        0.35,
        (t) => {
          m.rotation.z = Math.PI * (1 - t);
          m.position.y = y0 + Math.sin(t * Math.PI) * 0.25;
        },
        () => {
          entry.faceUp = true;
          res();
        }
      );
    });
  }

  /** Slide a card to a new spot (splitting a pair). */
  move(entry, to) {
    return new Promise((res) => {
      const from = entry.mesh.position.clone();
      this.tween(
        0.3,
        (t) => {
          entry.mesh.position.lerpVectors(from, to, 1 - Math.pow(1 - t, 3));
          entry.mesh.position.y += Math.sin(t * Math.PI) * 0.15;
        },
        res
      );
    });
  }

  /** Sweep every card off to the discard pile. */
  clearCards() {
    const list = this.cards;
    this.cards = [];
    if (!list.length) return Promise.resolve();
    const target = DISCARD.clone().setY(TABLE_Y + 0.3);
    return new Promise((res) => {
      const from = list.map((c) => c.mesh.position.clone());
      this.tween(
        0.45,
        (t) => {
          const k = t * t;
          list.forEach((c, i) => {
            c.mesh.position.lerpVectors(from[i], target, k);
            c.mesh.rotation.z = c.faceUp ? Math.PI * k : Math.PI;
          });
        },
        () => {
          list.forEach((c) => {
            this.scene.remove(c.mesh);
            c.mesh.geometry.dispose();
            c.mesh.material.forEach((m, i) => i >= 2 && i <= 3 && m.dispose());
          });
          res();
        }
      );
    });
  }

  /** A stack of chips worth `amount` at `at` (replaces whatever was under `key`). */
  setStack(key, amount, at) {
    this.removeStack(key);
    if (!amount) return;
    const g = new THREE.Group();
    breakdown(amount).forEach((v, i) => {
      const c = chipMesh(v);
      c.position.y = 0.025 + i * 0.047;
      c.rotation.y = Math.random() * 6;
      c.castShadow = true;
      g.add(c);
    });
    g.position.copy(at);
    this.scene.add(g);
    this.stacks.set(key, g);
  }

  removeStack(key) {
    const g = this.stacks.get(key);
    if (!g) return;
    this.scene.remove(g);
    g.traverse((o) => {
      o.geometry?.dispose();
      [].concat(o.material || []).forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    });
    this.stacks.delete(key);
  }

  /** Stacks slide towards you (won) or off to the dealer's tray (lost), then vanish. */
  sweepStack(key, toPlayer) {
    const g = this.stacks.get(key);
    if (!g) return Promise.resolve();
    const from = g.position.clone();
    const to = toPlayer ? new THREE.Vector3(from.x * 0.6, TABLE_Y + 0.5, 3.6) : new THREE.Vector3(0, TABLE_Y + 0.1, BACK_Z + 0.3);
    return new Promise((res) =>
      this.tween(
        0.55,
        (t) => {
          g.position.lerpVectors(from, to, t * t);
          g.position.y += Math.sin(t * Math.PI) * 0.3;
        },
        () => {
          this.removeStack(key);
          res();
        }
      )
    );
  }

  /** Put a character's shoes on the carpet. */
  standOnFloor(a) {
    a.root.position.y = 0;
    a.root.updateMatrixWorld(true);
    a.root.position.y = FLOOR_Y - new THREE.Box3().setFromObject(a.root).min.y;
    a.restY = a.root.position.y;
  }

  /** Someone walks from `from` to `to` ({ x, z } on the floor) and turns to `face` (the waiter, the pit boss). */
  addPerson(look, from, to, face = 0) {
    const a = buildAvatar(look);
    a.root.scale.setScalar(0.7);
    this.standOnFloor(a);
    const f = new THREE.Vector3(from.x, a.restY, from.z);
    const t = new THREE.Vector3(to.x, a.restY, to.z);
    a.root.position.copy(f);
    this.scene.add(a.root);
    const person = { a, deg: 0, phase: Math.random() * 10, walk: null, emote: null, emoteUntil: 0 };
    this.bots.push(person);
    person.arrived = this.walk(person, f, t, face);
    return person;
  }

  /** They walk off to `to` and are gone. */
  sendAway(person, to) {
    const out = new THREE.Vector3(to.x, person.a.restY, to.z);
    return this.walk(person, person.a.root.position.clone(), out, 0).then(() => {
      this.scene.remove(person.a.root);
      disposeAvatar(person.a);
      this.bots = this.bots.filter((b) => b !== person);
    });
  }

  /** The table's mood: -5 (ice cold, blue) … +5 (on fire, orange). */
  setHeat(h) {
    const m = this.felt?.material;
    if (!m) return;
    m.emissive = new THREE.Color(h > 0 ? 0xff6a00 : 0x2a6cff);
    m.emissiveIntensity = Math.min(1, Math.abs(h) / 5) * 0.28;
    m.needsUpdate = true;
  }

  /** Another player takes the seat at `deg`: walks in from the side (or is simply there). */
  addBot(look, deg, walkIn = true) {
    const a = buildAvatar(look);
    a.root.scale.setScalar(0.68);
    this.standOnFloor(a);
    const seat = polar(4.4, deg, a.restY);
    const from = polar(9.5, deg + Math.sign(deg) * 25, a.restY);
    a.root.position.copy(walkIn ? from : seat);
    const face = (deg * Math.PI) / 180 + Math.PI; // towards the middle of the table
    a.root.rotation.y = face;
    this.scene.add(a.root);
    const bot = { a, deg, phase: Math.random() * 10, walk: null, emote: null, emoteUntil: 0 };
    this.bots.push(bot);
    if (walkIn) this.walk(bot, from, seat, face);
    return bot;
  }

  /** They get up and leave. */
  removeBot(bot) {
    const out = polar(9.5, bot.deg + Math.sign(bot.deg) * 25, bot.a.restY);
    return this.walk(bot, bot.a.root.position.clone(), out, Math.atan2(out.x - bot.a.root.position.x, out.z - bot.a.root.position.z)).then(() => {
      this.scene.remove(bot.a.root);
      disposeAvatar(bot.a);
      this.bots = this.bots.filter((b) => b !== bot);
    });
  }

  walk(bot, from, to, faceAtEnd) {
    const heading = Math.atan2(to.x - from.x, to.z - from.z);
    const dur = Math.max(1.2, from.distanceTo(to) / 3.2);
    return new Promise((res) => {
      bot.walk = { from, to, heading, faceAtEnd, t: 0, dur, res };
    });
  }

  botGesture(bot, emote, secs = 2.2) {
    bot.emote = emote;
    bot.emoteUntil = this.clock.elapsedTime + secs;
  }

  botHead(bot) {
    const v = new THREE.Vector3();
    bot.a.head.getWorldPosition(v);
    return v.add(new THREE.Vector3(0, 0.62, 0));
  }

  /** The dealer does a little something: an emote name from the store, for a few seconds. */
  gesture(emote, secs = 2.5) {
    this.dealerEmote = emote;
    this.emoteUntil = this.clock.elapsedTime + secs;
  }

  /** Where a point in the room is, in px from the canvas's top-left (for the HTML labels and bubbles). */
  screen(v) {
    const p = v.clone().project(this.camera);
    const el = this.renderer.domElement;
    return { x: ((p.x + 1) / 2) * el.clientWidth, y: ((1 - p.y) / 2) * el.clientHeight };
  }

  dealerHead() {
    const v = new THREE.Vector3();
    this.dealer.head.getWorldPosition(v);
    return v.add(new THREE.Vector3(0, 0.75, 0));
  }

  update(dt, t) {
    this.scenery.update(t, dt);
    if (this.dealerEmote && t > this.emoteUntil) this.dealerEmote = null;
    animateAvatar(this.dealer, t, { emote: this.dealerEmote });
    for (const b of this.bots) {
      const w = b.walk;
      if (w) {
        w.t = Math.min(1, w.t + dt / w.dur);
        b.a.root.position.lerpVectors(w.from, w.to, w.t);
        b.a.root.position.y = b.a.restY + Math.abs(Math.sin(w.t * w.dur * 9)) * 0.08; // a bouncy walk
        b.a.root.rotation.y = w.t < 0.9 ? w.heading : w.faceAtEnd;
        const swing = Math.sin(w.t * w.dur * 9) * 0.6;
        animateAvatar(b.a, t + b.phase);
        b.a.armL.g.rotation.x = swing;
        b.a.armR.g.rotation.x = -swing;
        if (b.a.legs?.[0]) {
          b.a.legs[0].rotation.x = swing * 0.8;
          b.a.legs[1].rotation.x = -swing * 0.8;
        }
        if (w.t >= 1) {
          b.walk = null;
          b.a.root.position.y = b.a.restY;
          b.a.root.rotation.y = w.faceAtEnd;
          b.a.legs?.forEach?.((l) => (l.rotation.x = 0));
          w.res();
        }
        continue;
      }
      if (b.emote && t > b.emoteUntil) b.emote = null;
      animateAvatar(b.a, t + b.phase, { emote: b.emote });
    }
    // reaching out to deal
    this.reachNow = (this.reachNow || 0) + ((this.reach || 0) - (this.reachNow || 0)) * Math.min(1, dt * 14);
    if (!this.dealerEmote && this.reachNow > 0.01) {
      this.dealer.armR.g.rotation.x = -1.3 * this.reachNow;
      this.dealer.armR.g.rotation.z = 0.12 + 0.35 * this.reachNow;
    }
    // keep the camera steady, with a gentle breathing drift
    this.camera.position.set(Math.sin(t * 0.25) * 0.05, 4.1 + Math.sin(t * 0.4) * 0.02, 5.4);
    this.camera.lookAt(this.lookAt);
    this.onFrame?.(dt, t);
  }

  dispose() {
    disposeAvatar(this.dealer);
    this.bots.forEach((b) => disposeAvatar(b.a));
    this.faces.forEach((t) => t.dispose());
    super.dispose();
  }
}
