// 🧾🧽 The back of house, in 3D: the receipt printer that brings you the bar tab,
// and the kitchen sink where you wash it off when your fake card says no.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (t) => 1 - (1 - t) ** 3;

/** One renderer per overlay, thrown away when it closes. */
export class Stage3D {
  constructor(container, fov) {
    this.container = container;
    const r = (this.renderer = new THREE.WebGLRenderer({ antialias: true }));
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.05;
    r.localClippingEnabled = true;
    container.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(r);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTex;

    this.fov = fov;
    this.camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
    this.anims = [];
    this.shake = 0;
    this.clock = new THREE.Clock();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.resize();
    r.setAnimationLoop(() => {
      if (this.paused) return;
      const raw = this.clock.getDelta();
      const dt = Math.min(0.05, raw); // physics stays stable; tweens below use real time so they always finish
      const t = this.clock.elapsedTime;
      // a finished tween may start the next one, so collect into a fresh list
      const list = this.anims;
      this.anims = [];
      for (const a of list) {
        a.t = Math.min(1, a.t + raw / a.dur);
        a.fn(a.t);
        if (a.t < 1) this.anims.push(a);
        else a.done?.();
      }
      this.update(dt, t);
      if (this.shake > 0) {
        this.shake = Math.max(0, this.shake - dt);
        const s = this.shake * 0.35;
        this.camera.position.x += rand(-s, s);
        this.camera.position.y += rand(-s, s);
      }
      r.render(this.scene, this.camera);
    });
  }

  /** Stop drawing (another 3D room is on top), and carry on again. */
  pause() {
    this.paused = true;
  }
  resume() {
    this.paused = false;
    this.clock.getDelta(); // don't count the time we were away
  }

  tween(dur, fn, done) {
    this.anims.push({ t: 0, dur, fn, done });
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    // narrow screens get a wider lens so the whole scene stays in view
    this.camera.fov = this.camera.aspect < 1.25 ? Math.min(78, this.fov * (1.25 / this.camera.aspect)) : this.fov;
    this.camera.updateProjectionMatrix();
  }

  update() {}

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.ro.disconnect();
    this.scene.traverse((o) => {
      o.geometry?.dispose();
      [].concat(o.material || []).forEach((m) => {
        m.map?.dispose();
        m.dispose();
      });
    });
    this.envTex.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.renderer.domElement.remove();
  }
}

export const texFrom = (canvas, renderer) => {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return t;
};

// ============================================================ the receipt

/**
 * rows: { kind: 'title'|'center'|'row'|'sep'|'total'|'small'|'barcode', text, value }
 * Returns the paper canvas and where the TOTAL line sits (0 = top, 1 = bottom).
 */
function drawReceipt(rows) {
  const W = 512;
  const heights = { title: 58, center: 34, small: 28, row: 36, sep: 26, total: 62, barcode: 96 };
  const H = 70 + rows.reduce((s, r) => s + heights[r.kind], 0);
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, W, 0);
  g.addColorStop(0, '#efeadb');
  g.addColorStop(0.5, '#fbf8ef');
  g.addColorStop(1, '#eee8d8');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  for (let i = 0; i < 900; i++) {
    x.fillStyle = `rgba(120,100,60,${Math.random() * 0.06})`;
    x.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  x.fillStyle = '#141210';
  x.textBaseline = 'middle';
  let y = 36;
  let totalY = 0.8;
  const mono = (px, bold) => `${bold ? 'bold ' : ''}${px}px "Courier New", Courier, monospace`;
  for (const r of rows) {
    const h = heights[r.kind];
    const mid = y + h / 2;
    if (r.kind === 'title' || r.kind === 'center' || r.kind === 'small') {
      x.font = r.kind === 'title' ? mono(44, true) : mono(r.kind === 'small' ? 20 : 25, true);
      x.textAlign = 'center';
      x.fillText(r.text, W / 2, mid);
    } else if (r.kind === 'row' || r.kind === 'total') {
      x.font = r.kind === 'total' ? mono(40, true) : mono(24, true);
      x.textAlign = 'left';
      x.fillText(r.text.length > 26 ? r.text.slice(0, 25) + '…' : r.text, 30, mid);
      x.textAlign = 'right';
      x.fillText(r.value, W - 30, mid);
      if (r.kind === 'total') totalY = mid / H;
    } else if (r.kind === 'sep') {
      x.font = mono(24, false);
      x.textAlign = 'center';
      x.fillText('- - - - - - - - - - - - - - - -', W / 2, mid);
    } else if (r.kind === 'barcode') {
      let bx = 90;
      while (bx < W - 90) {
        const bw = 2 + ((Math.random() * 4) | 0);
        x.fillRect(bx, y + 14, bw, h - 34);
        bx += bw + 2 + ((Math.random() * 4) | 0);
      }
    }
    y += h;
  }
  // torn edges
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i <= W; i += 16) {
    x.beginPath();
    x.moveTo(i, H);
    x.lineTo(i + 8, H - 10);
    x.lineTo(i + 16, H);
    x.fill();
  }
  x.globalCompositeOperation = 'source-over';
  return { canvas: c, totalY };
}

function stampCanvas(text, color) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 220;
  const x = c.getContext('2d');
  x.strokeStyle = x.fillStyle = color;
  x.lineWidth = 16;
  x.beginPath();
  x.roundRect(14, 14, 484, 192, 26);
  x.stroke();
  x.font = 'bold 118px Impact, "Arial Black", sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(text, 256, 116);
  // rubber-stamp speckle
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 500; i++) {
    x.beginPath();
    x.arc(Math.random() * 512, Math.random() * 220, Math.random() * 3.2, 0, 7);
    x.fill();
  }
  return c;
}

export class ReceiptScene extends Stage3D {
  /** onTick: printer noise, onPrinted: the paper is all out */
  constructor(container, { rows, onTick, onPrinted }) {
    super(container, 36);
    const s = this.scene;
    s.background = new THREE.Color(0x140905);
    s.fog = new THREE.Fog(0x140905, 9, 26);
    s.add(new THREE.HemisphereLight(0xffe2c0, 0x201008, 0.6));
    const key = new THREE.DirectionalLight(0xfff0dd, 2.2);
    key.position.set(2, 5, 7);
    s.add(key);
    const warm = new THREE.PointLight(0xffa040, 40, 18, 1.5);
    warm.position.set(-3, 3, 3);
    s.add(warm);

    const { canvas, totalY } = drawReceipt(rows);
    this.W = 2.3;
    this.H = (this.W * canvas.height) / canvas.width;
    this.slotY = 1.12; // top of the printer, which sits on the bar
    this.printed = 0;
    this.onTick = onTick;
    this.onPrinted = onPrinted;
    this.tick = 0;

    // back bar: shelves of glowing bottles
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x3a1c0c, roughness: 0.5 });
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(30, 16), new THREE.MeshBasicMaterial({ color: 0x2a1004 }));
    glow.position.set(0, 4, -6.4);
    s.add(glow);
    const hues = [0x2f8f4e, 0x9c4a14, 0xd9a441, 0x7a1d2e, 0x3d6ea8, 0xe0e0d0];
    for (const sy of [1.4, 3.7, 6]) {
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(24, 0.12, 1), shelfMat);
      shelf.position.set(0, sy, -5.8);
      s.add(shelf);
      for (let bx = -11; bx < 11; bx += rand(0.5, 0.9)) {
        const h = rand(0.9, 1.5);
        const b = new THREE.Mesh(
          new THREE.CylinderGeometry(0.17, 0.2, h, 14),
          new THREE.MeshStandardMaterial({
            color: hues[(Math.random() * hues.length) | 0],
            emissive: 0x1a0a03,
            roughness: 0.15,
            metalness: 0.1,
            transparent: true,
            opacity: 0.7,
          })
        );
        b.position.set(bx, sy + h / 2 + 0.06, -5.8 + rand(-0.2, 0.2));
        s.add(b);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.4, 10), b.material);
        neck.position.set(b.position.x, sy + h + 0.25, b.position.z);
        s.add(neck);
      }
    }

    // the bar counter, top at y = 0
    const counter = new THREE.Mesh(
      new THREE.BoxGeometry(18, 1.2, 5),
      new THREE.MeshPhysicalMaterial({ color: 0x5a2b12, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 })
    );
    counter.position.set(0, -0.6, 0.5);
    s.add(counter);
    const rail = new THREE.Mesh(
      new THREE.CylinderGeometry(0.09, 0.09, 18, 12),
      new THREE.MeshStandardMaterial({ color: 0xd9b25a, metalness: 1, roughness: 0.25 })
    );
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, -0.15, 3.05);
    s.add(rail);

    // the printer sits on the bar and pushes the receipt up out of its top
    const printer = new THREE.Group();
    const body = new THREE.Mesh(
      new RoundedBoxGeometry(3.1, 1.1, 1.4, 4, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x2b2d31, roughness: 0.45, metalness: 0.3 })
    );
    body.position.y = 0.56;
    printer.add(body);
    const lip = new THREE.Mesh(new THREE.BoxGeometry(2.62, 0.04, 0.18), new THREE.MeshStandardMaterial({ color: 0x050506 }));
    lip.position.set(0, this.slotY + 0.005, -0.05);
    printer.add(lip);
    this.led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), new THREE.MeshBasicMaterial({ color: 0x33ff77 }));
    this.led.position.set(1.3, 0.3, 0.71);
    printer.add(this.led);
    const brand = document.createElement('canvas');
    brand.width = 512;
    brand.height = 64;
    const bx = brand.getContext('2d');
    bx.fillStyle = '#e0b45c';
    bx.font = 'bold 40px Georgia, serif';
    bx.textAlign = 'center';
    bx.textBaseline = 'middle';
    bx.fillText('CLUB JACKPOT · TABS', 256, 34);
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(2.3, 0.29),
      new THREE.MeshBasicMaterial({ map: texFrom(brand, this.renderer), transparent: true })
    );
    label.position.set(0, 0.62, 0.71);
    printer.add(label);
    s.add(printer);

    // the paper rises out of the slot header first (clipped below it) and curls back as it grows
    const paperTex = texFrom(canvas, this.renderer);
    const geo = new THREE.PlaneGeometry(this.W, this.H, 1, 60);
    this.base = geo.attributes.position.array.slice();
    this.paper = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        map: paperTex,
        emissive: 0xffffff,
        emissiveMap: paperTex, // thermal paper glows a bit under the bar lights
        emissiveIntensity: 0.35,
        roughness: 0.9,
        side: THREE.DoubleSide,
        transparent: true,
        clippingPlanes: [new THREE.Plane(new THREE.Vector3(0, 1, 0), -this.slotY)],
      })
    );
    this.paper.position.set(0, this.slotY - this.H / 2, -0.05);
    s.add(this.paper);
    this.totalLocalY = this.H / 2 - totalY * this.H;
    this.look = new THREE.Vector3(0, 1, 0);
    this.camera.position.set(0.4, 1.6, 7);
  }

  update(dt, t) {
    const speed = 1.35; // units per second
    if (this.printed < this.H) {
      this.t0 ??= t;
      this.printed = Math.min(this.H, (t - this.t0) * speed); // wall clock, so a slow frame never stalls it
      this.paper.position.y = this.slotY + this.printed - this.H / 2;
      this.led.visible = Math.floor(t * 12) % 2 === 0;
      if ((this.tick += dt) > 0.07) {
        this.tick = 0;
        this.onTick?.();
      }
      if (this.printed >= this.H) {
        this.led.visible = true;
        this.onPrinted?.();
      }
    }
    // curl and flutter: the higher above the slot, the more it leans back and waves
    const pos = this.paper.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const fromTop = this.H / 2 - this.base[i * 3 + 1];
      const up = Math.max(0, this.printed - fromTop);
      pos.setZ(i, -0.014 * up * up + Math.sin(t * 2.1 + fromTop * 1.7) * 0.05 * Math.min(1, up / 1.5));
    }
    pos.needsUpdate = true;
    this.paper.geometry.computeVertexNormals();

    // camera keeps the printer and the top of the paper in frame
    const top = this.slotY + this.printed;
    const mid = (top - 0.3) / 2;
    const span = top + 0.9;
    const fit = span / (2 * Math.tan((this.camera.fov * Math.PI) / 360)) + 1.5;
    const want = new THREE.Vector3(0.5, mid + 0.7, Math.max(6, fit));
    const k = 1 - Math.exp(-Math.max(dt, this.clock.elapsedTime - (this.lastT ?? 0)) * 3);
    this.lastT = this.clock.elapsedTime;
    this.camera.position.lerp(want, k);
    this.look.lerp(new THREE.Vector3(0, mid, 0), k);
    this.camera.lookAt(this.look);
  }

  /** A rubber stamp slams onto the TOTAL. */
  stamp(text, color) {
    this.stampMesh?.removeFromParent();
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.64),
      new THREE.MeshBasicMaterial({ map: texFrom(stampCanvas(text, color), this.renderer), transparent: true, opacity: 0, depthWrite: false })
    );
    // sit on the curled paper at the TOTAL line
    const up = Math.max(0, this.printed - (this.H / 2 - this.totalLocalY));
    m.position.set(0.25, this.totalLocalY, -0.014 * up * up + 0.04);
    m.rotation.set(Math.atan(-0.028 * up), 0, rand(-0.28, -0.14));
    this.paper.add(m);
    this.stampMesh = m;
    this.tween(0.16, (k) => {
      m.scale.setScalar(3 - 2 * k);
      m.material.opacity = k;
    }, () => (this.shake = 0.25));
  }

  /** Tear it off and throw it at the camera. */
  tearOff(done) {
    const p0 = this.paper.position.clone();
    const target = this.camera.position.clone().add(new THREE.Vector3(3, 1, -1));
    this.tween(0.7, (k) => {
      const e = k * k;
      this.paper.position.lerpVectors(p0, target, e);
      this.paper.rotation.set(e * 1.2, e * 2.4, e * 0.8);
    }, done);
  }
}

// ============================================================ the sink

const PLATE_R = 1.46;

function plateGeometry(topOnly) {
  const lift = topOnly ? 0.006 : 0;
  const top = [[0.001, 0.03], [0.9, 0.03], [1.06, 0.06], [1.3, 0.14], [1.42, 0.17]].map(([r, h]) => [r, h + lift]);
  const under = [[1.46, 0.155], [1.44, 0.12], [1.28, 0.08], [1.02, -0.01], [0.86, -0.04], [0.8, -0.06], [0.001, -0.06]];
  const pts = (topOnly ? top : [...top, ...under]).map(([r, h]) => new THREE.Vector2(r, h));
  const g = new THREE.LatheGeometry(pts, 72);
  // flat, top-down UVs so painting on the texture lines up with the plate
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / (2 * PLATE_R) + 0.5, -p.getZ(i) / (2 * PLATE_R) + 0.5);
  uv.needsUpdate = true;
  return g;
}

function platePattern() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const x = c.getContext('2d');
  x.fillStyle = '#fbfbf7';
  x.fillRect(0, 0, 512, 512);
  x.strokeStyle = '#2d5aa8';
  x.lineWidth = 7;
  x.beginPath();
  x.arc(256, 256, 238, 0, 7);
  x.stroke();
  x.lineWidth = 3;
  x.beginPath();
  x.arc(256, 256, 222, 0, 7);
  x.stroke();
  x.fillStyle = 'rgba(45,90,168,0.12)';
  x.font = 'bold 90px Georgia, serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('♠', 256, 262);
  return c;
}

function drawDirt(x, level) {
  const S = 256;
  x.clearRect(0, 0, S, S);
  const blob = (cx, cy, r, col) => {
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, col);
    g.addColorStop(0.7, col.replace(/[\d.]+\)$/, '0.55)'));
    g.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(cx, cy, r, r * rand(0.55, 1), rand(0, 3), 0, 7);
    x.fill();
  };
  const inside = () => {
    const a = rand(0, Math.PI * 2);
    const d = Math.sqrt(Math.random()) * 100;
    return [128 + Math.cos(a) * d, 128 + Math.sin(a) * d];
  };
  const sauces = ['rgba(122,38,18,0.9)', 'rgba(150,70,20,0.85)', 'rgba(90,60,30,0.85)', 'rgba(170,120,40,0.7)'];
  for (let i = 0; i < 7 + level * 2; i++) blob(...inside(), rand(12, 30), sauces[(Math.random() * sauces.length) | 0]);
  // grease smears
  x.lineCap = 'round';
  for (let i = 0; i < 3 + level; i++) {
    const [ax, ay] = inside();
    x.strokeStyle = 'rgba(200,170,60,0.45)';
    x.lineWidth = rand(8, 16);
    x.beginPath();
    x.moveTo(ax, ay);
    x.quadraticCurveTo(ax + rand(-50, 50), ay + rand(-50, 50), ax + rand(-60, 60), ay + rand(-60, 60));
    x.stroke();
  }
  // crumbs
  for (let i = 0; i < 40; i++) {
    const [cx, cy] = inside();
    x.fillStyle = `rgba(${140 + rand(0, 60)},${90 + rand(0, 40)},40,0.9)`;
    x.fillRect(cx, cy, rand(2, 4), rand(2, 4));
  }
  // lipstick on the rim, some nights
  if (Math.random() < 0.4) {
    x.strokeStyle = 'rgba(220,20,80,0.85)';
    x.lineWidth = 7;
    const a = rand(0, 6);
    x.beginPath();
    x.arc(128, 128, 112, a, a + 0.35);
    x.stroke();
    x.beginPath();
    x.arc(128, 128, 104, a + 0.05, a + 0.3);
    x.stroke();
  }
  // ketchup smiley, rarely
  if (Math.random() < 0.25) {
    x.strokeStyle = 'rgba(200,20,10,0.9)';
    x.fillStyle = 'rgba(200,20,10,0.9)';
    x.lineWidth = 6;
    x.beginPath();
    x.arc(128, 128, 38, 0.3, Math.PI - 0.3);
    x.stroke();
    x.beginPath();
    x.arc(114, 112, 6, 0, 7);
    x.arc(142, 112, 6, 0, 7);
    x.fill();
  }
}

/** Something gross stuck to the plate that has to be flicked off. */
function grossThing() {
  const kinds = [
    () => {
      // a whole shrimp
      const g = new THREE.Group();
      const m = new THREE.MeshStandardMaterial({ color: 0xff8a50, roughness: 0.45 });
      const body = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.075, 10, 22, Math.PI * 1.35), m);
      body.rotation.x = -Math.PI / 2;
      g.add(body);
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 8), new THREE.MeshStandardMaterial({ color: 0xe0472a }));
      tail.position.set(0.2, 0, 0.02);
      tail.rotation.z = -Math.PI / 2;
      g.add(tail);
      return { obj: g, name: 'a whole shrimp 🦐' };
    },
    () => {
      const gum = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.16, 1),
        new THREE.MeshStandardMaterial({ color: 0xff7fbf, roughness: 0.6 })
      );
      gum.scale.set(1, 0.45, 0.8);
      return { obj: gum, name: 'chewed gum' };
    },
    () => {
      const fry = new THREE.Mesh(
        new THREE.BoxGeometry(0.62, 0.07, 0.07),
        new THREE.MeshStandardMaterial({ color: 0xf2c14e, roughness: 0.7 })
      );
      return { obj: fry, name: 'one (1) fry' };
    },
    () => {
      const g = new THREE.Group();
      const olive = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshStandardMaterial({ color: 0x6b8e23, roughness: 0.35 }));
      olive.scale.set(1.25, 0.9, 0.9);
      g.add(olive);
      const pim = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: 0xd6202a }));
      pim.position.x = 0.15;
      g.add(pim);
      return { obj: g, name: 'a martini olive' };
    },
    () => {
      const chip = new THREE.Mesh(
        new THREE.CylinderGeometry(0.2, 0.2, 0.04, 20),
        new THREE.MeshStandardMaterial({ color: 0x9a1b1b, metalness: 0.2, roughness: 0.4 })
      );
      return { obj: chip, name: 'a casino chip?!' };
    },
  ];
  return kinds[(Math.random() * kinds.length) | 0]();
}

export class DishScene extends Stage3D {
  /**
   * drunk: 0..4, makes the sponge wander
   * onPlate(n): a plate got cleaned · onGross(name): something gross got flicked off
   * onScrub(): scrubbing noise
   */
  constructor(container, { drunk = 0, onPlate, onGross, onScrub }) {
    super(container, 42);
    this.drunk = drunk;
    this.onPlate = onPlate;
    this.onGross = onGross;
    this.onScrub = onScrub;
    this.active = true;
    this.plates = 0;
    const s = this.scene;
    s.background = new THREE.Color(0x1c2428);
    this.renderer.toneMappingExposure = 0.8;
    s.add(new THREE.HemisphereLight(0xeef6ff, 0x2a2a24, 0.45));
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(2, 8, 4);
    s.add(key);
    this.tube = new THREE.PointLight(0xdff4ff, 26, 20, 1.4);
    this.tube.position.set(-1, 5, 1);
    s.add(this.tube);

    this.buildKitchen();
    this.buildSink();
    this.buildRack();
    this.buildSponge();
    this.buildBubbles();

    this.patternTex = texFrom(platePattern(), this.renderer);
    this.plateGeo = plateGeometry(false);
    this.dirtGeo = plateGeometry(true);
    this.dirtyStack = [];
    for (let i = 0; i < 6; i++) {
      const p = this.makePlate(true);
      p.position.set(-4.7, 0.08 + i * 0.2, 0.6);
      p.rotation.y = rand(0, 6);
      s.add(p);
      this.dirtyStack.push(p);
    }
    this.sinkPos = new THREE.Vector3(0, -0.34, 0.3);
    this.nextPlate();

    this.camera.position.set(0, 7.6, 5.6);
    this.camera.lookAt(0, -0.3, 0.45);

    // input: drag to scrub
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.aim = new THREE.Vector3(0, 0, 1.5);
    this.down = false;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      this.ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(this.ndc, this.camera);
      const hit = new THREE.Vector3();
      if (this.ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.1), hit)) this.aim.copy(hit);
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerdown', (e) => {
      move(e);
      this.down = true;
      el.setPointerCapture?.(e.pointerId);
    });
    const up = () => (this.down = false);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  buildKitchen() {
    const s = this.scene;
    // white tiles, some of them questionable
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const x = c.getContext('2d');
    x.fillStyle = '#9aa3a6';
    x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        x.fillStyle = `hsl(190, 8%, ${86 + Math.random() * 6}%)`;
        x.fillRect(i * 64 + 3, j * 64 + 3, 58, 58);
        if (Math.random() < 0.18) {
          x.fillStyle = 'rgba(120,100,40,0.25)';
          x.beginPath();
          x.arc(i * 64 + rand(10, 54), j * 64 + rand(10, 54), rand(6, 16), 0, 7);
          x.fill();
        }
      }
    const tex = texFrom(c, this.renderer);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 3);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(26, 10), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3 }));
    wall.position.set(0, 3, -4.5);
    s.add(wall);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ color: 0x3b3430, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -4;
    s.add(floor);

    // stainless counter with a hole for the basin
    this.steel = new THREE.MeshStandardMaterial({ color: 0x8e959b, metalness: 0.9, roughness: 0.4 });
    const bw = 5.2;
    const bd = 3.6;
    const slab = (w, d, px, pz) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, d), this.steel);
      m.position.set(px, -0.15, pz);
      s.add(m);
    };
    slab((14 - bw) / 2, 9, -(bw / 2 + (14 - bw) / 4), 0);
    slab((14 - bw) / 2, 9, bw / 2 + (14 - bw) / 4, 0);
    slab(bw, (9 - bd) / 2, 0, -(bd / 2 + (9 - bd) / 4));
    slab(bw, (9 - bd) / 2, 0, bd / 2 + (9 - bd) / 4);
    const front = new THREE.Mesh(new THREE.BoxGeometry(14, 3.7, 0.2), this.steel);
    front.position.set(0, -2.15, 4.5);
    s.add(front);
    this.basin = { w: bw, d: bd };
  }

  buildSink() {
    const s = this.scene;
    const { w, d } = this.basin;
    const inner = new THREE.MeshStandardMaterial({ color: 0x5d6368, metalness: 0.95, roughness: 0.3, side: THREE.DoubleSide });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(w, d), inner);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.5;
    s.add(floor);
    const wallX = new THREE.PlaneGeometry(d, 1.5);
    const wallZ = new THREE.PlaneGeometry(w, 1.5);
    [[wallX, -w / 2, 0, Math.PI / 2], [wallX, w / 2, 0, -Math.PI / 2], [wallZ, 0, -d / 2, 0], [wallZ, 0, d / 2, Math.PI]].forEach(([g, x, z, ry]) => {
      const m = new THREE.Mesh(g, inner);
      m.position.set(x, -0.75, z);
      m.rotation.y = ry;
      s.add(m);
    });

    // soapy water that sloshes a little
    const wg = new THREE.PlaneGeometry(w, d, 26, 18);
    wg.rotateX(-Math.PI / 2);
    this.waterBase = wg.attributes.position.array.slice();
    this.water = new THREE.Mesh(
      wg,
      new THREE.MeshStandardMaterial({ color: 0x6fa9c4, transparent: true, opacity: 0.55, roughness: 0.06, metalness: 0.1 })
    );
    this.water.position.y = -0.5;
    s.add(this.water);

    // suds, piled up against the walls
    const n = 170;
    this.suds = new THREE.InstancedMesh(
      new THREE.SphereGeometry(1, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 }),
      n
    );
    this.sudsData = [];
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const side = i % 4;
      const along = rand(-0.5, 0.5);
      const inward = Math.random() ** 2 * 0.8;
      let x = side < 2 ? (side ? 1 : -1) * (w / 2 - inward) : along * w;
      let z = side >= 2 ? (side === 2 ? -1 : 1) * (d / 2 - inward) : along * d;
      const r = rand(0.1, 0.34);
      this.sudsData.push({ x, z, r, ph: rand(0, 6) });
      m.makeScale(r, r * 0.8, r).setPosition(x, -0.48, z);
      this.suds.setMatrixAt(i, m);
    }
    s.add(this.suds);

    // faucet
    const chrome = new THREE.MeshStandardMaterial({ color: 0xf2f4f6, metalness: 1, roughness: 0.12 });
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.7, 18), chrome);
    post.position.set(0, 0.85, -d / 2 - 0.45);
    s.add(post);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.11, 14, 28, Math.PI), chrome);
    arc.rotation.y = Math.PI / 2;
    arc.position.set(0, 1.7, -d / 2 + 0.1);
    s.add(arc);
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.3, 14), chrome);
    spout.position.set(0, 1.55, -d / 2 + 0.65);
    s.add(spout);
    for (const hx of [-0.55, 0.55]) {
      const h = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 16), chrome);
      h.position.set(hx, 0.1, -d / 2 - 0.45);
      s.add(h);
    }
    // the drip that never stops
    this.drip = new THREE.Mesh(
      new THREE.SphereGeometry(0.05, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.8, roughness: 0 })
    );
    this.drip.position.set(0, 1.4, -d / 2 + 0.65);
    s.add(this.drip);
  }

  buildRack() {
    const s = this.scene;
    const wire = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.8, roughness: 0.3 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 3.6), wire);
    base.position.set(4.7, 0.05, 0.4);
    s.add(base);
    for (let i = 0; i < 11; i++) {
      for (const dx of [-0.9, 0.9]) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 6), wire);
        t.position.set(4.7 + dx, 0.4, -1.2 + i * 0.32);
        s.add(t);
      }
    }
  }

  buildSponge() {
    const g = new THREE.Group();
    const foam = new THREE.Mesh(new RoundedBoxGeometry(1.05, 0.36, 0.7, 4, 0.1), new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.95 }));
    g.add(foam);
    const scrub = new THREE.Mesh(new RoundedBoxGeometry(1.06, 0.12, 0.71, 3, 0.05), new THREE.MeshStandardMaterial({ color: 0x2e8b3e, roughness: 1 }));
    scrub.position.y = -0.22;
    g.add(scrub);
    g.position.set(1.6, 0.4, 1.4);
    this.sponge = g;
    this.spongeVel = new THREE.Vector3();
    this.scene.add(g);
  }

  buildBubbles() {
    this.bubbles = [];
    const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, roughness: 0, iridescence: 1, iridescenceIOR: 1.3 });
    const geo = new THREE.SphereGeometry(1, 16, 12);
    for (let i = 0; i < 36; i++) {
      const b = new THREE.Mesh(geo, mat);
      b.visible = false;
      this.scene.add(b);
      this.bubbles.push({ mesh: b, life: 0 });
    }
    this.sparkles = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(40 * 3), 3)),
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.22, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    this.sparkVel = Array.from({ length: 40 }, () => new THREE.Vector3());
    this.scene.add(this.sparkles);
  }

  makePlate(dirty) {
    const g = new THREE.Group();
    const plate = new THREE.Mesh(
      this.plateGeo,
      new THREE.MeshPhysicalMaterial({ map: this.patternTex, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide })
    );
    g.add(plate);
    if (dirty) {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      drawDirt(ctx, Math.min(6, this.plates));
      const tex = texFrom(c, this.renderer);
      const dirt = new THREE.Mesh(
        this.dirtGeo,
        new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 0.85, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })
      );
      g.add(dirt);
      g.userData = { ctx, tex, dirt, start: this.dirtAmount(ctx), gross: [] };
    }
    return g;
  }

  dirtAmount(ctx) {
    const d = ctx.getImageData(0, 0, 256, 256).data;
    let sum = 0;
    for (let i = 3; i < d.length; i += 4 * 5) sum += d[i];
    return sum;
  }

  nextPlate() {
    const top = this.dirtyStack.pop() || this.makePlate(true);
    if (!top.parent) this.scene.add(top);
    // refill from the back door, there are always more plates
    const fresh = this.makePlate(true);
    fresh.position.set(-4.7, 0.08 + this.dirtyStack.length * 0.2, 0.6);
    fresh.rotation.y = rand(0, 6);
    this.scene.add(fresh);
    this.dirtyStack.unshift(fresh);
    this.dirtyStack.forEach((p, i) => (p.position.y = 0.08 + i * 0.2));

    // every other plate or so comes with a little surprise
    const d = top.userData;
    const n = Math.random() < 0.55 ? 1 + (Math.random() < 0.3 ? 1 : 0) : 0;
    for (let i = 0; i < n; i++) {
      const gt = grossThing();
      const a = rand(0, 6);
      const r = rand(0.2, 0.75);
      gt.obj.position.set(Math.cos(a) * r, 0.1, Math.sin(a) * r);
      gt.obj.rotation.y = rand(0, 6);
      top.add(gt.obj);
      d.gross.push({ ...gt, vel: null });
    }

    this.plate = null;
    const from = top.position.clone();
    const r0 = top.rotation.y;
    this.tween(0.55, (k) => {
      const e = ease(k);
      top.position.lerpVectors(from, this.sinkPos, e);
      top.position.y += Math.sin(Math.PI * k) * 1.4;
      top.rotation.set(0, r0 * (1 - e), 0);
    }, () => (this.plate = top));
  }

  /** Paint the dirt away under the sponge. */
  scrubAt(x, z, strength) {
    const d = this.plate.userData;
    const lx = x - this.plate.position.x;
    const lz = z - this.plate.position.z;
    if (Math.hypot(lx, lz) > PLATE_R + 0.3) return false;
    const px = (lx / (2 * PLATE_R) + 0.5) * 256;
    const py = (lz / (2 * PLATE_R) + 0.5) * 256;
    const ctx = d.ctx;
    ctx.globalCompositeOperation = 'destination-out';
    const g = ctx.createRadialGradient(px, py, 0, px, py, 34);
    g.addColorStop(0, `rgba(0,0,0,${0.5 * strength})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px - 36, py - 36, 72, 72);
    ctx.globalCompositeOperation = 'source-over';
    d.tex.needsUpdate = true;
    return true;
  }

  spawnBubble(p) {
    const b = this.bubbles.find((x) => x.life <= 0);
    if (!b) return;
    b.life = rand(0.8, 1.6);
    b.max = b.life;
    b.mesh.visible = true;
    b.mesh.position.set(p.x + rand(-0.4, 0.4), p.y + rand(-0.1, 0.2), p.z + rand(-0.3, 0.3));
    b.r = rand(0.05, 0.16);
    b.v = new THREE.Vector3(rand(-0.3, 0.3), rand(0.5, 1.1), rand(-0.3, 0.3));
  }

  sparkle(at) {
    const pos = this.sparkles.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(i, at.x, at.y + 0.2, at.z);
      this.sparkVel[i].set(rand(-2, 2), rand(1, 3.5), rand(-2, 2));
    }
    pos.needsUpdate = true;
    this.sparkles.material.opacity = 1;
  }

  finishPlate() {
    const p = this.plate;
    this.plate = null;
    this.plates++;
    this.sparkle(p.position);
    p.userData.dirt.visible = false;
    const slot = Math.min(10, this.plates - 1);
    const from = p.position.clone();
    const to = new THREE.Vector3(4.7, 1.25, -1.2 + slot * 0.32 + 0.16);
    this.tween(0.75, (k) => {
      const e = ease(k);
      p.position.lerpVectors(from, to, e);
      p.position.y += Math.sin(Math.PI * k) * 2.2;
      p.rotation.set(-e * Math.PI * 0.5, 0, e * Math.PI * 2);
    }, () => {
      p.rotation.set(-Math.PI / 2, 0, 0);
      if (this.active) this.nextPlate();
    });
    this.onPlate?.(this.plates);
  }

  update(dt, t) {
    // the fluorescent tube flickers, as they do
    this.tube.intensity = Math.random() < 0.015 ? 4 : 18;

    // water slosh + bobbing suds
    const wp = this.water.geometry.attributes.position;
    for (let i = 0; i < wp.count; i++) {
      const x = this.waterBase[i * 3];
      const z = this.waterBase[i * 3 + 2];
      wp.setY(i, Math.sin(x * 1.6 + t * 1.8) * 0.025 + Math.cos(z * 2.1 + t * 1.3) * 0.02);
    }
    wp.needsUpdate = true;
    const m = new THREE.Matrix4();
    this.sudsData.forEach((s, i) => {
      const r = s.r * (1 + Math.sin(t * 1.5 + s.ph) * 0.06);
      m.makeScale(r, r * 0.8, r).setPosition(s.x, -0.48 + Math.sin(t * 1.2 + s.ph) * 0.02, s.z);
      this.suds.setMatrixAt(i, m);
    });
    this.suds.instanceMatrix.needsUpdate = true;

    // drip, drip, drip
    this.drip.position.y -= dt * (1 + (1.4 - this.drip.position.y) * 4);
    if (this.drip.position.y < -0.45) this.drip.position.y = 1.4;

    // sponge chases the pointer; a drunk hand wanders off
    const wob = this.drunk * 0.22;
    const target = this.aim.clone().add(new THREE.Vector3(Math.sin(t * 1.7) * wob + Math.sin(t * 4.1) * wob * 0.3, 0, Math.cos(t * 1.3) * wob));
    const pressing = this.down && this.active;
    target.y = pressing ? -0.02 : 0.45;
    const before = this.sponge.position.clone();
    this.sponge.position.lerp(target, 1 - Math.exp(-dt * 14));
    const vel = this.sponge.position.clone().sub(before).divideScalar(Math.max(dt, 1e-3));
    this.spongeVel.lerp(vel, 0.3);
    this.sponge.rotation.z = THREE.MathUtils.clamp(-this.spongeVel.x * 0.05, -0.35, 0.35);
    this.sponge.rotation.x = THREE.MathUtils.clamp(this.spongeVel.z * 0.05, -0.35, 0.35);
    this.sponge.scale.y = pressing ? 0.75 : 1;

    // scrubbing: only moving counts
    const speed = Math.hypot(this.spongeVel.x, this.spongeVel.z);
    if (pressing && this.plate && speed > 0.6) {
      const steps = Math.min(6, Math.ceil(before.distanceTo(this.sponge.position) / 0.12));
      let hit = false;
      for (let k = 1; k <= steps; k++) {
        const p = before.clone().lerp(this.sponge.position, k / steps);
        hit = this.scrubAt(p.x, p.z, Math.min(1, speed / 6)) || hit;
      }
      if (hit) {
        if (Math.random() < 0.5) this.spawnBubble(this.sponge.position);
        if ((this.scrubT = (this.scrubT || 0) + dt) > 0.12) {
          this.scrubT = 0;
          this.onScrub?.();
        }
      }
      // flick off anything gross the sponge runs into
      for (const g of this.plate.userData.gross) {
        if (g.vel) continue;
        const wpos = g.obj.getWorldPosition(new THREE.Vector3());
        if (wpos.distanceTo(this.sponge.position) < 0.55) {
          const away = wpos.clone().sub(this.sponge.position).setY(0).normalize();
          g.vel = away.multiplyScalar(rand(4, 6)).setY(rand(3, 5));
          g.spin = new THREE.Vector3(rand(-9, 9), rand(-9, 9), rand(-9, 9));
          this.scene.attach(g.obj);
          this.onGross?.(g.name);
        }
      }
    }

    // flicked gross things fly off the plate and out of the sink
    for (const p of this.scene.children) {
      if (!p.userData?.gross) continue;
      p.userData.gross = p.userData.gross.filter((g) => {
        if (!g.vel) return true;
        g.vel.y -= 14 * dt;
        g.obj.position.addScaledVector(g.vel, dt);
        g.obj.rotation.x += g.spin.x * dt;
        g.obj.rotation.y += g.spin.y * dt;
        g.obj.rotation.z += g.spin.z * dt;
        if (g.obj.position.y < -4) {
          g.obj.removeFromParent();
          return false;
        }
        return true;
      });
    }

    // is it clean yet?
    if (this.plate && this.active) {
      const d = this.plate.userData;
      if ((this.checkT = (this.checkT || 0) + dt) > 0.15) {
        this.checkT = 0;
        d.left = this.dirtAmount(d.ctx) / Math.max(1, d.start);
      }
      if (d.left !== undefined && d.left < 0.1 && !d.gross.some((g) => !g.vel)) this.finishPlate();
    }

    // bubbles rise, grow and pop
    for (const b of this.bubbles) {
      if (b.life <= 0) continue;
      b.life -= dt;
      b.mesh.position.addScaledVector(b.v, dt);
      b.mesh.scale.setScalar(b.r * (1 + (1 - b.life / b.max) * 0.8));
      if (b.life <= 0) b.mesh.visible = false;
    }
    // sparkles
    if (this.sparkles.material.opacity > 0) {
      const pos = this.sparkles.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        this.sparkVel[i].y -= 6 * dt;
        pos.setXYZ(i, pos.getX(i) + this.sparkVel[i].x * dt, pos.getY(i) + this.sparkVel[i].y * dt, pos.getZ(i) + this.sparkVel[i].z * dt);
      }
      pos.needsUpdate = true;
      this.sparkles.material.opacity = Math.max(0, this.sparkles.material.opacity - dt * 1.4);
    }

    // the camera leans a little toward the sponge
    const cx = THREE.MathUtils.clamp(this.sponge.position.x * 0.08, -0.5, 0.5);
    this.camera.position.x += (cx - this.camera.position.x) * (1 - Math.exp(-dt * 2));
    this.camera.lookAt(0, -0.3, 0.45);
  }

  /** How much of the current plate is still dirty (0..1). */
  get dirtLeft() {
    return this.plate?.userData.left ?? 1;
  }

  stop() {
    this.active = false;
    this.down = false;
  }
}
