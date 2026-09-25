// 🧓🔥🛸 Life around the roulette table, in 3D:
// - Grandma walks over after three losses in a row and minds some of your chips until tomorrow
// - three wins in a row and you're ON FIRE: the wheel's rim burns and spins earn ×1.5 XP
// - once in a blue moon, a UFO beams up a stack of your chips (it's in the terms and conditions)

import * as THREE from 'three';
import { buildAvatar, disposeAvatar, DEFAULT_LOOK } from './avatar.js';

const today = () => new Date().toDateString();
const FRONT_Z = 3.3; // the strip of felt between the wheel and you (the courier walks it too)
const G_START = new THREE.Vector3(13, 0.8, FRONT_Z);
const G_STOP = new THREE.Vector3(3.2, 0.8, FRONT_Z);
const UFO_CHANCE = 0.02; // per losing-or-winning spin, after the first few
const UFO_SPOT = new THREE.Vector3(6.0, -0.42, -1.2); // the open felt right of the wheel

function buildGrandma() {
  const g = buildAvatar({ ...DEFAULT_LOOK, skin: '#f1c27d', hair: 'bun', hairColor: '#d9d9d9', face: 'grin', top: 'bathrobe', shirt: '#b8a0d8', glasses: 'monocle', build: 'slim' });
  // a handbag, for the chips
  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.16), new THREE.MeshStandardMaterial({ color: 0x7a2a4a, roughness: 0.5 }));
  bag.position.set(0, -1.15, 0.1);
  g.armL.g.add(bag);
  g.root.scale.setScalar(0.72);
  return g;
}

function buildUfo() {
  const g = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: 0xc8d0da, metalness: 1, roughness: 0.25 });
  const disc = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), metal);
  disc.scale.set(1.6, 0.28, 1.6);
  g.add(disc);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.62, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: 0x9fffd0, transmission: 0.6, roughness: 0.05, transparent: true, opacity: 0.7 }));
  dome.position.y = 0.18;
  g.add(dome);
  // a little green passenger, waving
  const alien = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), new THREE.MeshStandardMaterial({ color: 0x5ee08f, roughness: 0.4 }));
  alien.position.y = 0.42;
  g.add(alien);
  const lights = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd23f }));
    l.position.set(Math.cos(a) * 1.5, -0.02, Math.sin(a) * 1.5);
    g.add(l);
    lights.push(l);
  }
  // the tractor beam: a soft green cone down to the felt
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(1.3, 1, 32, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x7dffb0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
  );
  g.add(beam);
  g.userData = { lights, beam };
  return g;
}

function chipStack(n = 7) {
  const g = new THREE.Group();
  const cols = [0xd62b2b, 0x1f9d4c, 0x161616, 0x7b3fbf, 0xe8a321];
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.06, 24), new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.45 }));
    c.position.y = 0.03 + i * 0.065;
    g.add(c);
  }
  return g;
}

// flickering flames around the wheel's rim, while you're on fire
function buildFire() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const grd = x.createRadialGradient(32, 40, 2, 32, 36, 30);
  grd.addColorStop(0, 'rgba(255,255,200,1)');
  grd.addColorStop(0.35, 'rgba(255,170,40,0.9)');
  grd.addColorStop(1, 'rgba(255,40,0,0)');
  x.fillStyle = grd;
  x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const g = new THREE.Group();
  for (let i = 0; i < 48; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    const a = (i / 48) * Math.PI * 2;
    s.position.set(Math.cos(a) * 4.45, 0.95, Math.sin(a) * 4.45);
    s.userData.phase = Math.random() * 10;
    g.add(s);
  }
  g.visible = false;
  return g;
}

/**
 * @param wheel      the roulette wheel (scene, camera, per-frame hook)
 * @param take(amount, point)  chips leave your rack, flying to a point on screen
 * @param give(amount, point)  chips come back to your rack
 * @param onUfo(amount)      a close encounter (for the trophy, and the morning paper)
 * @param onGrandma(amount)  Grandma minded some chips (the morning paper wants to know)
 */
export function createTableLife({ wheel, store, toast, sound, getBalance, take, give, onUfo, onGrandma }) {
  const tmp = new THREE.Vector3();
  const screen = (obj, yUp) => {
    obj.getWorldPosition(tmp);
    tmp.y += yUp;
    tmp.project(wheel.camera);
    const r = wheel.renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((tmp.x + 1) / 2) * r.width, y: r.top + ((1 - tmp.y) / 2) * r.height };
  };

  let losses = 0;
  let wins = 0;
  let spins = 0;
  let gran = null; // { a, phase, t }
  let ufo = null; // { g, stack, phase, t, amount }
  const fire = buildFire();
  wheel.scene.add(fire);

  // Grandma gives back what she minded yesterday
  const held = store.get('fr.grandma', null);
  if (held?.amount && held.date !== today()) {
    store.set('fr.grandma', { amount: 0, date: held.date });
    setTimeout(() => {
      give(held.amount, { x: innerWidth - 80, y: 90 });
      toast(`👵 Grandma kept your ${'$' + held.amount.toLocaleString('en-US')} safe overnight. Here it is. (And a cookie. 🍪)`);
    }, 2500);
  }

  function grandmaVisit() {
    const minded = store.get('fr.grandma', null);
    if (gran || minded?.date === today()) return; // once a day is plenty
    const amount = Math.min(500, Math.floor(getBalance() * 0.2));
    if (amount < 5) return;
    const a = buildGrandma();
    a.root.position.copy(G_START);
    wheel.scene.add(a.root);
    gran = { a, phase: 'in', t: 0, amount };
  }

  function onFire(on) {
    fire.visible = on;
    if (!on) return;
    const el = document.createElement('div');
    el.className = 'hype';
    el.innerHTML = "YOU'RE ON FIRE! <small>🔥 ×1.5 XP while it lasts</small>";
    document.querySelector('.stage')?.appendChild(el);
    setTimeout(() => el.remove(), 2600);
    [392, 523, 659, 784].forEach((f, i) => sound.blip(f, 0.16, 'square', 0.07, i * 0.09));
  }

  function ufoVisit() {
    const amount = Math.min(250, Math.floor(getBalance() * 0.05) + 10);
    if (ufo || getBalance() < 50) return;
    const g = buildUfo();
    g.position.set(UFO_SPOT.x - 14, 12, UFO_SPOT.z - 6);
    wheel.scene.add(g);
    const stack = chipStack();
    stack.position.copy(UFO_SPOT);
    wheel.scene.add(stack);
    ufo = { g, stack, phase: 'in', t: 0, amount };
    for (let i = 0; i < 6; i++) sound.blip(300 + i * 140, 0.25, 'sine', 0.05, i * 0.12); // wooo-ooo
  }

  /** After every roulette spin. */
  function onSpin(net) {
    spins++;
    if (net < 0) {
      losses++;
      if (wins >= 3) setTimeout(() => toast("🧯 …and the fire's out."), 1800);
      wins = 0;
      onFire(false);
      if (losses >= 3) setTimeout(grandmaVisit, 2200);
    } else if (net > 0) {
      wins++;
      losses = 0;
      if (wins === 3) setTimeout(() => onFire(true), 1600);
    }
    if (spins > 5 && Math.random() < UFO_CHANCE) setTimeout(ufoVisit, 2600);
  }

  wheel.onFrame((dt, t) => {
    // 🔥
    if (fire.visible) {
      fire.children.forEach((s) => {
        const f = 0.7 + Math.sin(t * 13 + s.userData.phase) * 0.3;
        s.scale.set(0.55 * f, 0.9 * f, 1);
        s.position.y = 0.95 + f * 0.22;
      });
    }

    // 👵
    if (gran) {
      gran.t += dt;
      const { a } = gran;
      const p = a.root.position;
      let walking = true;
      if (gran.phase === 'in') {
        const k = Math.min(1, gran.t / 3.6);
        p.lerpVectors(G_START, G_STOP, k);
        if (k >= 1) {
          gran.phase = 'talk';
          gran.t = 0;
          const said = gran.amount;
          toast(`👵 Grandma: "Three in a row? That's enough, dear. I'll mind ${'$' + said.toLocaleString('en-US')} of this until tomorrow."`);
          if (take(said, screen(a.root, 1.4))) {
            store.set('fr.grandma', { amount: said, date: today() });
            onGrandma?.(said);
          }
        }
      } else if (gran.phase === 'talk') {
        walking = false;
        if (gran.t > 2.6) {
          gran.phase = 'out';
          gran.t = 0;
        }
      } else {
        const k = Math.min(1, gran.t / 4);
        p.lerpVectors(G_STOP, G_START, k);
        if (k >= 1) {
          wheel.scene.remove(a.root);
          disposeAvatar(a);
          gran = null;
        }
      }
      if (gran) {
        const stride = walking ? Math.sin(t * 6) * 0.35 : 0; // a slower shuffle
        a.legs[0].rotation.x = stride;
        a.legs[1].rotation.x = -stride;
        a.body.position.y = walking ? Math.abs(Math.sin(t * 6)) * 0.05 : 0;
        a.root.rotation.y = !walking ? 0 : gran.phase === 'in' ? -Math.PI / 2 : Math.PI / 2;
        // a wagging finger while she talks
        a.armR.g.rotation.set(walking ? -stride * 0.5 : -2.2 + Math.sin(t * 9) * 0.25, 0, 0.1);
      }
    }

    // 🛸
    if (ufo) {
      ufo.t += dt;
      const { g, stack } = ufo;
      const { lights, beam } = g.userData;
      lights.forEach((l, i) => l.material.color.setHSL((t * 0.8 + i / 10) % 1, 1, 0.6));
      g.rotation.y += dt * 2;
      const hover = new THREE.Vector3(UFO_SPOT.x, 2.0, UFO_SPOT.z);
      if (ufo.phase === 'in') {
        const k = Math.min(1, ufo.t / 2.2);
        g.position.lerpVectors(new THREE.Vector3(UFO_SPOT.x - 14, 12, UFO_SPOT.z - 6), hover, 1 - Math.pow(1 - k, 3));
        if (k >= 1) {
          ufo.phase = 'beam';
          ufo.t = 0;
        }
      } else if (ufo.phase === 'beam') {
        const k = Math.min(1, ufo.t / 2.4);
        const h = hover.y - UFO_SPOT.y;
        beam.material.opacity = Math.min(0.35, k * 1.5) * (0.8 + Math.sin(t * 20) * 0.2);
        beam.scale.set(1, h, 1);
        beam.position.y = -h / 2;
        stack.position.y = UFO_SPOT.y + k * k * (h - 0.3);
        stack.rotation.y += dt * 4;
        if (k >= 1) {
          ufo.phase = 'out';
          ufo.t = 0;
          wheel.scene.remove(stack);
          stack.traverse((o) => (o.geometry?.dispose(), o.material?.dispose()));
          if (take(ufo.amount, screen(g, 0))) {
            toast(`🛸 A UFO beamed up ${'$' + ufo.amount.toLocaleString('en-US')} of your chips. It's in the terms and conditions.`);
            onUfo?.(ufo.amount);
          }
          sound.blip(900, 0.5, 'sine', 0.06);
        }
      } else {
        beam.material.opacity = Math.max(0, beam.material.opacity - dt);
        const k = Math.min(1, ufo.t / 1.2);
        g.position.lerpVectors(hover, new THREE.Vector3(UFO_SPOT.x + 20, 16, UFO_SPOT.z - 10), k * k);
        if (k >= 1) {
          wheel.scene.remove(g);
          g.traverse((o) => (o.geometry?.dispose(), o.material?.dispose()));
          ufo = null;
        }
      }
    }
  });

  return {
    onSpin,
    /** ×1.5 XP while you're on fire */
    xpMult: () => (wins >= 3 ? 1.5 : 1),
  };
}
