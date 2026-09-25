import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildScenery } from './scenery.js';
import {
  N, STEP, TAU, R_IN, R_POCKET, R_OUT, R_REST, DISC_Y, BALL_R, APRON, surfaceY,
  FRET_H, FRET_T, DIAMONDS, DIAMOND_R, DIAMOND_LONG, DIAMOND_SHORT, DIAMOND_H, DIAMOND_LIFT,
  FPS, wheelAt, planSpin,
} from './ballphysics.js';

// European single-zero wheel order, clockwise when viewed from above.
export const WHEEL_ORDER = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
  5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26,
];
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = (n) => (n === 0 ? 'green' : RED.has(n) ? 'red' : 'black');

// Angle convention: local angle θ maps to (r cosθ, y, -r sinθ); rotating the wheel
// group by φ around Y moves that point to world angle θ + φ.
const polar = (r, a, y = 0) => new THREE.Vector3(r * Math.cos(a), y, -r * Math.sin(a));

export class RouletteWheel {
  constructor(container, { onTick, onRoll, onClack } = {}) {
    this.container = container;
    this.onTick = onTick || (() => {});
    this.onRoll = onRoll || (() => {}); // (speed 0..1, trackPos 0..1) every frame while spinning
    this.onClack = onClack || (() => {}); // ball hits a deflector on the way down

    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    container.appendChild(renderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.camera.position.set(0, 7.3, 8.9);

    const controls = (this.controls = new OrbitControls(this.camera, renderer.domElement));
    controls.target.set(0, -0.2, 0.5);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 7;
    controls.maxDistance = 19;
    controls.minPolarAngle = 0.15;
    controls.maxPolarAngle = 1.2;

    this.addLights();
    this.build();
    this.scenery = buildScenery(this.scene, renderer);

    this.phi = 0;            // wheel rotation
    this.idleOmega = 0.3;    // wheel idle speed (rad/s)
    this.omega = this.idleOmega;
    this.ballRel = 0;        // ball angle relative to the wheel while resting in a pocket
    this.anim = null;

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();

    this.hooks = [];
    this.clock = new THREE.Clock();
    renderer.setAnimationLoop(() => this.frame());
  }

  addLights() {
    this.scene.add(new THREE.HemisphereLight(0xfff2dd, 0x1a1208, 0.5));
    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(3, 10, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    const s = key.shadow.camera;
    s.left = s.bottom = -9.5;
    s.right = s.top = 9.5;
    s.near = 1;
    s.far = 25;
    key.shadow.bias = -0.0005;
    this.scene.add(key);
    const warm = new THREE.PointLight(0xffb86b, 18, 20);
    warm.position.set(-5, 4, -3);
    this.scene.add(warm);
    // Gold burst light used by flash() on wins
    this.glow = new THREE.PointLight(0xffc24a, 0, 14, 1.5);
    this.glow.position.set(0, 3, 0);
    this.scene.add(this.glow);
  }

  build() {
    const gold = new THREE.MeshStandardMaterial({ color: 0xd9ab52, metalness: 1, roughness: 0.25 });
    const chrome = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 1, roughness: 0.18 });
    const woodDark = new THREE.MeshStandardMaterial({ color: 0x2b1409, roughness: 0.3, metalness: 0.05 });
    const woodRim = new THREE.MeshStandardMaterial({ color: 0x6e3314, roughness: 0.38, metalness: 0.05 });
    const woodCone = new THREE.MeshStandardMaterial({ color: 0x8c4a1c, roughness: 0.32, metalness: 0.05 });

    // Static bowl: sloped apron (ball track) + wooden rim
    const lathe = (pts, mat) => {
      const m = new THREE.Mesh(
        new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), 160),
        mat
      );
      mat.side = THREE.DoubleSide;
      m.castShadow = m.receiveShadow = true;
      this.scene.add(m);
      return m;
    };
    lathe([[3.38, -0.42], [3.38, DISC_Y], ...APRON, [4.03, 0.44], [4.06, 0.64]], woodDark);
    lathe([[4.06, 0.64], [4.3, 0.7], [4.62, 0.62], [4.74, 0.4], [4.74, -0.42]], woodRim);
    const rimTrim = new THREE.Mesh(new THREE.TorusGeometry(4.3, 0.03, 12, 160), gold);
    rimTrim.rotation.x = -Math.PI / 2;
    rimTrim.position.y = 0.705;
    this.scene.add(rimTrim);

    // Diamond deflectors on the apron
    for (const { a, radial } of DIAMONDS) {
      const d = new THREE.Mesh(new THREE.OctahedronGeometry(1, 0), gold);
      d.position.copy(polar(DIAMOND_R, a, surfaceY(DIAMOND_R) + DIAMOND_LIFT));
      d.scale.set(radial ? DIAMOND_LONG : DIAMOND_SHORT, DIAMOND_H, radial ? DIAMOND_SHORT : DIAMOND_LONG);
      d.rotation.y = a;
      d.castShadow = true;
      this.scene.add(d);
    }

    // Rotating wheel
    const wheel = (this.wheel = new THREE.Group());
    this.scene.add(wheel);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(R_OUT, 3.2, 0.42, 128), woodDark);
    base.position.y = DISC_Y - 0.212;
    wheel.add(base);

    const disc = new THREE.Mesh(
      new THREE.RingGeometry(R_IN, R_OUT, 148, 1),
      new THREE.MeshStandardMaterial({ map: this.makeDiscTexture(), roughness: 0.35, metalness: 0.1 })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = DISC_Y;
    disc.receiveShadow = true;
    wheel.add(disc);

    for (const [r, t] of [[R_POCKET, 0.012], [R_OUT, 0.03], [R_IN, 0.03]]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, t, 10, 160), gold);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = DISC_Y + 0.005;
      wheel.add(ring);
    }

    // Frets between pockets
    const fretGeo = new THREE.BoxGeometry(R_POCKET - R_IN, FRET_H, FRET_T);
    for (let i = 0; i < N; i++) {
      const a = i * STEP + STEP / 2;
      const f = new THREE.Mesh(fretGeo, chrome);
      f.position.copy(polar((R_IN + R_POCKET) / 2, a, DISC_Y + FRET_H / 2));
      f.rotation.y = a;
      f.castShadow = true;
      wheel.add(f);
    }

    // Centre cone
    const cone = new THREE.Mesh(
      new THREE.LatheGeometry(
        [[2.2, DISC_Y], [2.12, 0.1], [1.6, 0.3], [0.9, 0.45], [0.35, 0.5], [0, 0.5]].map(
          ([x, y]) => new THREE.Vector2(x, y)
        ),
        128
      ),
      woodCone
    );
    cone.castShadow = cone.receiveShadow = true;
    wheel.add(cone);

    // Turret
    const turret = new THREE.Group();
    const add = (geo, y, mat = gold) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.y = y;
      m.castShadow = true;
      turret.add(m);
      return m;
    };
    add(new THREE.CylinderGeometry(0.3, 0.38, 0.22, 48), 0.6);
    add(new THREE.CylinderGeometry(0.07, 0.07, 0.9, 24), 0.95);
    add(new THREE.SphereGeometry(0.15, 32, 16), 1.42);
    for (let k = 0; k < 2; k++) {
      const arm = add(new THREE.CylinderGeometry(0.035, 0.035, 1.7, 16), 0.9);
      arm.rotation.z = Math.PI / 2;
      arm.rotation.y = k * (Math.PI / 2);
    }
    for (let k = 0; k < 4; k++) {
      const knob = add(new THREE.SphereGeometry(0.07, 24, 12), 0.9);
      knob.position.x = Math.cos((k * Math.PI) / 2) * 0.85;
      knob.position.z = Math.sin((k * Math.PI) / 2) * 0.85;
    }
    wheel.add(turret);

    // Ball
    this.ball = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_R, 32, 16),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.12, metalness: 0.05 })
    );
    this.ball.castShadow = true;
    this.scene.add(this.ball);
  }

  makeDiscTexture() {
    const S = 2048;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const g = c.getContext('2d');
    const cx = S / 2;
    const k = S / 2 / R_OUT;
    const fill = { red: '#b3121f', black: '#161616', green: '#0e7a3a' };

    // Canvas y points down, so local angle θ is drawn at canvas angle -θ.
    const sector = (r0, r1, a0, a1) => {
      g.beginPath();
      g.arc(cx, cx, r1 * k, -a0, -a1, true);
      g.arc(cx, cx, r0 * k, -a1, -a0, false);
      g.closePath();
    };

    WHEEL_ORDER.forEach((n, i) => {
      const a0 = i * STEP - STEP / 2;
      const a1 = a0 + STEP;
      sector(R_IN, R_OUT, a0, a1);
      g.fillStyle = fill[colorOf(n)];
      g.fill();
    });

    // Darken pockets so they read as recessed
    const grad = g.createRadialGradient(cx, cx, R_IN * k, cx, cx, R_POCKET * k);
    grad.addColorStop(0, 'rgba(0,0,0,0.45)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.15)');
    grad.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.beginPath();
    g.arc(cx, cx, R_POCKET * k, 0, TAU);
    g.arc(cx, cx, R_IN * k, 0, TAU, true);
    g.fillStyle = grad;
    g.fill();

    // Gold dividers on the number ring
    g.strokeStyle = '#d9ab52';
    g.lineWidth = 4;
    for (let i = 0; i < N; i++) {
      const a = i * STEP + STEP / 2;
      g.beginPath();
      g.moveTo(cx + R_POCKET * k * Math.cos(a), cx - R_POCKET * k * Math.sin(a));
      g.lineTo(cx + R_OUT * k * Math.cos(a), cx - R_OUT * k * Math.sin(a));
      g.stroke();
    }

    // Numbers, top of glyph pointing outward
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = 'bold 78px Georgia, "Times New Roman", serif';
    WHEEL_ORDER.forEach((n, i) => {
      const a = i * STEP;
      const r = (R_POCKET + R_OUT) / 2;
      g.save();
      g.translate(cx + r * k * Math.cos(a), cx - r * k * Math.sin(a));
      g.rotate(Math.PI / 2 - a);
      g.fillText(String(n), 0, 4);
      g.restore();
    });

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.renderer.capabilities.getMaxAnisotropy();
    return tex;
  }

  resize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    const aspect = w / h;
    this.camera.aspect = aspect;
    // Widen FOV on narrow screens so the whole wheel stays in view
    this.camera.fov = aspect < 1.3 ? Math.min(75, 38 * (1.3 / aspect)) : 38;
    this.camera.updateProjectionMatrix();
  }

  /** Run fn(dt, t) every frame, for things living in this scene (hello, Dave). */
  onFrame(fn) {
    this.hooks.push(fn);
  }

  /** Stop rendering (e.g. while you are over at the slots). */
  pause() {
    this.renderer.setAnimationLoop(null);
  }
  resume() {
    this.clock.getDelta();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  /** Gold light pulse + a little extra wheel spin to celebrate a win. */
  flash(level = 0) {
    this.glow.intensity = 40 + level * 45;
    this.omega += 0.8 + level * 0.8;
  }

  /**
   * Spin and land on `target`. The ball's whole run is simulated up front (see
   * ballphysics.js) and then played back. Resolves with the pocket it settled in.
   */
  spin(target) {
    const opts = {
      pocket: WHEEL_ORDER.indexOf(target),
      phi0: this.phi,
      idle: this.idleOmega,
      rel0: ((this.ballRel % TAU) + TAU) % TAU,
    };
    const plan = planSpin(opts) || planSpin({ ...opts, budgetMs: 2000 });
    if (!plan) return Promise.resolve(target);
    return new Promise((resolve) => {
      this.anim = { plan, start: performance.now(), ev: 0, resolve };
    });
  }

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.glow.intensity *= Math.exp(-dt * 1.4);
    this.scenery.update(this.clock.elapsedTime, dt);

    let rel = this.ballRel;
    let r = R_REST;
    let y = DISC_Y + BALL_R;

    const a = this.anim;
    if (a) {
      const { plan } = a;
      // wall-clock based so a backgrounded tab still finishes on time
      const t = Math.min((performance.now() - a.start) / 1000, plan.T);
      // the wheel follows the same spin-down the simulation used, so the ball lines up
      ({ phi: this.phi, omega: this.omega } = wheelAt(plan.phi0, plan.omega0, plan.idle, t));

      const fr = plan.frames;
      const f = t * FPS;
      const i = Math.min(Math.floor(f), fr.length / 3 - 2);
      const k = Math.min(f - i, 1);
      rel = fr[i * 3] + (fr[i * 3 + 3] - fr[i * 3]) * k;
      r = fr[i * 3 + 1] + (fr[i * 3 + 4] - fr[i * 3 + 1]) * k;
      y = fr[i * 3 + 2] + (fr[i * 3 + 5] - fr[i * 3 + 2]) * k;
      // roll speed and track position for the audio: bright on the outer track, duller down the apron
      const ro = plan.roll;
      this.onRoll(ro[i * 2] + (ro[i * 2 + 2] - ro[i * 2]) * k, ro[i * 2 + 1] + (ro[i * 2 + 3] - ro[i * 2 + 1]) * k);

      // knocks against frets and diamonds; skip ones long gone (the tab was hidden)
      while (a.ev < plan.events.length && plan.events[a.ev].t <= t) {
        const e = plan.events[a.ev++];
        if (t - e.t > 0.25) continue;
        if (e.type === 'tick') this.onTick(e.v);
        else this.onClack();
      }

      if (t >= plan.T) {
        this.ballRel = rel = plan.endRel;
        this.anim = null;
        this.onRoll(0, 0);
        a.resolve(WHEEL_ORDER[plan.pocket]);
      }
    } else {
      this.omega += (this.idleOmega - this.omega) * (1 - Math.exp(-dt * 0.3));
      this.phi += this.omega * dt;
    }
    this.wheel.rotation.y = this.phi;
    this.ball.position.copy(polar(r, this.phi + rel, y));

    for (const h of this.hooks) h(dt, this.clock.elapsedTime);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}
