// ☀️ The morning after, in 3D: you wake up in a hotel room. The blinds open by themselves,
// the sun is unreasonable, there's a traffic cone in your bed, and your phone won't stop buzzing.

import * as THREE from 'three';
import { Stage3D, texFrom } from './kitchen3d.js';
import { buildAvatar } from './avatar.js';

const rand = (a, b) => a + Math.random() * (b - a);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

function canvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}

/** The phone's lock screen: the time, and Dave. */
function lockScreen(texts) {
  return canvas(256, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#1b1440');
    g.addColorStop(1, '#4a1a3a');
    x.fillStyle = g;
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff';
    x.textAlign = 'center';
    x.font = 'bold 64px Inter, Arial, sans-serif';
    x.fillText('11:47', w / 2, 96);
    x.font = '18px Inter, Arial, sans-serif';
    x.fillText('Sunday · way too bright', w / 2, 126);
    let y = 160;
    for (const t of texts.slice(-4)) {
      x.fillStyle = 'rgba(255,255,255,0.88)';
      x.beginPath();
      x.roundRect(14, y, w - 28, 74, 14);
      x.fill();
      x.fillStyle = '#111';
      x.textAlign = 'left';
      x.font = 'bold 15px Inter, Arial, sans-serif';
      x.fillText('Dave 🍺', 26, y + 24);
      x.font = '14px Inter, Arial, sans-serif';
      const words = t.split(' ');
      let line = '';
      let ly = y + 46;
      for (const wd of words) {
        if (x.measureText(line + wd).width > w - 60) {
          x.fillText(line, 26, ly);
          line = '';
          ly += 18;
          if (ly > y + 66) break;
        }
        line += wd + ' ';
      }
      if (ly <= y + 66) x.fillText(line, 26, ly);
      y += 84;
    }
  });
}

// 📰 the morning paper, headlines about your night
function newspaper(headlines) {
  return canvas(1024, 720, (x, w, h) => {
    x.fillStyle = '#f3efe4';
    x.fillRect(0, 0, w, h);
    x.fillStyle = '#1a1a1a';
    x.textAlign = 'center';
    x.font = 'bold 76px "Old English Text MT", Georgia, serif';
    x.fillText('The Daily Jackpot', w / 2, 88);
    x.fillRect(40, 110, w - 80, 5);
    x.font = 'italic 24px Georgia, serif';
    x.fillText(`${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })} · Price: one chip · "All the news that fits in a hangover"`, w / 2, 145);
    x.fillRect(40, 160, w - 80, 2);
    // wrap text into lines that fit
    const wrap = (text, font, maxW) => {
      x.font = font;
      const words = text.split(' ');
      const lines = [];
      let line = '';
      for (const wd of words) {
        const test = line ? line + ' ' + wd : wd;
        if (x.measureText(test).width > maxW && line) {
          lines.push(line);
          line = wd;
        } else line = test;
      }
      lines.push(line);
      return lines;
    };
    const [main, ...rest] = headlines;
    let y = 230;
    for (const l of wrap(main, 'bold 64px Georgia, serif', w - 100)) {
      x.fillText(l, w / 2, y);
      y += 70;
    }
    // a "photo": a very blurry casino
    const py = y + 10;
    const g = x.createLinearGradient(60, py, 460, py + 250);
    g.addColorStop(0, '#6b4a3a');
    g.addColorStop(1, '#2a1a14');
    x.fillStyle = g;
    x.fillRect(60, py, 400, 250);
    x.font = '120px serif';
    x.fillText('🎰', 260, py + 170);
    x.fillStyle = '#1a1a1a';
    x.font = 'italic 18px Georgia, serif';
    x.fillText('The scene of the incident. (Photo: Dave)', 260, py + 275);
    // the other stories down the side
    x.textAlign = 'left';
    let sy = py + 20;
    for (const story of rest.slice(0, 3)) {
      for (const l of wrap(story, 'bold 26px Georgia, serif', 470)) {
        if (sy > h - 20) break;
        x.fillText(l, 500, sy);
        sy += 30;
      }
      sy += 18;
    }
  });
}

// 🏨 the upgrades, if you bought them: a painting of Dave, champagne, a hot tub, a tiger
function hotelProps(s, tier, renderer) {
  const rank = { motel: 0, suite: 1, hottub: 2, tiger: 3 }[tier] || 0;
  const out = { bubbles: [], tail: null };
  if (rank < 1) return out;
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8c35a, metalness: 1, roughness: 0.25 });
  // a gold-framed portrait of Dave (a gift from the management, apparently)
  const art = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 2),
    new THREE.MeshStandardMaterial({
      map: texFrom(
        canvas(160, 200, (x, w, h) => {
          x.fillStyle = '#3a1a2a';
          x.fillRect(0, 0, w, h);
          x.font = '110px serif';
          x.textAlign = 'center';
          x.fillText('🧔', w / 2, 125);
          x.fillStyle = '#e8c35a';
          x.font = 'bold 20px Georgia, serif';
          x.fillText('DAVE', w / 2, 180);
        }),
        renderer
      ),
      roughness: 0.6,
    })
  );
  art.position.set(3.7, 3.1, -8.25);
  s.add(art);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(1.85, 2.25, 0.08), gold);
  frame.position.set(3.7, 3.1, -8.32);
  s.add(frame);
  // champagne on ice, on the nightstand
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.18, 0.34, 18), new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 1, roughness: 0.2 }));
  bucket.position.set(2.05, 1.27, 0.95);
  s.add(bucket);
  const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.55, 12), new THREE.MeshStandardMaterial({ color: 0x0f3d1e, metalness: 0.3, roughness: 0.15 }));
  bottle.position.set(2.05, 1.5, 0.95);
  bottle.rotation.z = 0.3;
  s.add(bottle);
  if (rank >= 2) {
    // a hot tub by the window, bubbling away
    const tub = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.9, 32, 1, true), new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.5, side: THREE.DoubleSide }));
    tub.position.set(2.5, 0.45, -6.6);
    s.add(tub);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.08, 8, 40), new THREE.MeshStandardMaterial({ color: 0x8a5a33, roughness: 0.4 }));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(2.5, 0.9, -6.6);
    s.add(rim);
    const water = new THREE.Mesh(new THREE.CircleGeometry(1.25, 32), new THREE.MeshStandardMaterial({ color: 0x3fd0e0, roughness: 0.05, metalness: 0.2, emissive: 0x0a5a66, emissiveIntensity: 0.5 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(2.5, 0.8, -6.6);
    s.add(water);
    const bubMat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, roughness: 0.1 });
    for (let i = 0; i < 16; i++) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), bubMat);
      b.userData = { a: Math.random() * 6.28, r: Math.random() * 1.1, phase: Math.random() };
      s.add(b);
      out.bubbles.push(b);
    }
  }
  if (rank >= 3) {
    // a chandelier…
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.05, 8, 32), gold);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 5.2, -3);
    s.add(ring);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff1c0 }));
      bulb.position.set(Math.cos(a) * 0.8, 5.1, -3 + Math.sin(a) * 0.8);
      s.add(bulb);
    }
    // …and a tiger, asleep on the carpet. nobody knows where it came from either.
    const stripes = texFrom(
      canvas(256, 64, (x, w, h) => {
        x.fillStyle = '#e8801a';
        x.fillRect(0, 0, w, h);
        x.fillStyle = '#1a1208';
        for (let i = 8; i < w; i += 26) x.fillRect(i, 0, 9, h);
      }),
      renderer
    );
    const fur = new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.8 });
    const tiger = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 1.5, 8, 16), fur);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.45;
    tiger.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 14), new THREE.MeshStandardMaterial({ color: 0xe8801a, roughness: 0.8 }));
    head.position.set(1.25, 0.5, 0.1);
    tiger.add(head);
    for (const z of [-0.2, 0.2]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.18, 8), head.material);
      ear.position.set(1.25, 0.9, 0.1 + z);
      tiger.add(ear);
    }
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 10), new THREE.MeshStandardMaterial({ color: 0xfff4e0 }));
    muzzle.position.set(1.6, 0.42, 0.1);
    tiger.add(muzzle);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 8), fur);
    tail.position.set(-1.3, 0.35, 0);
    tail.rotation.z = 1.2;
    tiger.add(tail);
    tiger.position.set(-1.2, 0, -6.3);
    tiger.rotation.y = -0.2;
    tiger.scale.setScalar(1.25);
    s.add(tiger);
    out.tail = tail;
  }
  return out;
}

export class HangoverScene extends Stage3D {
  constructor(container, { texts, onBuzz, headlines = null, hotel = 'motel', spouse = null }) {
    super(container, 52);
    this.onBuzz = onBuzz;
    const s = this.scene;
    s.background = new THREE.Color(0x0b0806);
    this.renderer.toneMappingExposure = 0.3;
    this.exposure = 0.3;
    this.shades = false;

    s.add((this.hemi = new THREE.HemisphereLight(0xfff4e0, 0xb08a66, 0.25)));
    this.sun = new THREE.DirectionalLight(0xfff1d0, 0);
    this.sun.position.set(0, 5, -8);
    this.sun.target.position.set(0, 0, 3);
    s.add(this.sun, this.sun.target);

    // the room: striped hotel wallpaper, beige carpet
    const paper = texFrom(
      canvas(256, 256, (x) => {
        x.fillStyle = '#cdb99a';
        x.fillRect(0, 0, 256, 256);
        for (let i = 0; i < 256; i += 32) {
          x.fillStyle = 'rgba(150,120,80,0.35)';
          x.fillRect(i, 0, 12, 256);
        }
      }),
      this.renderer
    );
    paper.wrapS = paper.wrapT = THREE.RepeatWrapping;
    paper.repeat.set(4, 2);
    const room = new THREE.Mesh(new THREE.BoxGeometry(12, 6.5, 16), new THREE.MeshStandardMaterial({ map: paper, side: THREE.BackSide, roughness: 0.9 }));
    room.position.set(0, 3.25, -0.5);
    s.add(room);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(12, 16), new THREE.MeshStandardMaterial({ color: 0x6b5a48, roughness: 1 }));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.01, -0.5);
    s.add(carpet);

    // the window, far wall: pure daylight behind a set of blinds
    const sky = texFrom(
      canvas(64, 256, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#bfe4ff');
        g.addColorStop(0.6, '#ffffff');
        g.addColorStop(1, '#fff3cf');
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
      }),
      this.renderer
    );
    const win = new THREE.Mesh(new THREE.PlaneGeometry(4, 3.2), new THREE.MeshBasicMaterial({ map: sky, color: 0xffffff }));
    win.position.set(0, 3, -8.2);
    s.add(win);
    this.winMat = win.material;
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.6 });
    for (const [w, h, x, y] of [[4.4, 0.2, 0, 4.7], [4.4, 0.2, 0, 1.3], [0.2, 3.6, -2.1, 3], [0.2, 3.6, 2.1, 3]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.25), frameMat);
      b.position.set(x, y, -8.1);
      s.add(b);
    }
    this.slats = [];
    const slatMat = new THREE.MeshStandardMaterial({ color: 0xe9e2d2, roughness: 0.7, side: THREE.DoubleSide });
    for (let i = 0; i < 17; i++) {
      const sl = new THREE.Mesh(new THREE.BoxGeometry(4, 0.2, 0.01), slatMat);
      sl.position.set(0, 1.45 + i * 0.19, -8);
      s.add(sl);
      this.slats.push(sl);
    }

    // god rays through the slats, and the dust floating in them
    const rayTex = texFrom(
      canvas(8, 128, (x, w, h) => {
        const g = x.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, 'rgba(255,245,210,0.9)');
        g.addColorStop(1, 'rgba(255,245,210,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, w, h);
      }),
      this.renderer
    );
    this.rays = new THREE.Group();
    this.rayMat = new THREE.MeshBasicMaterial({ map: rayTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 7; i++) {
      // each ray: a thin sheet from the window slanting down into the room
      const holder = new THREE.Group();
      holder.position.set(0, 1.7 + i * 0.42, -8);
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 9.5), this.rayMat);
      sheet.rotation.x = -Math.PI / 2 + 0.42;
      sheet.position.set(0, -2.05, 4.3);
      holder.add(sheet);
      this.rays.add(holder);
    }
    s.add(this.rays);
    const n = 260;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([rand(-2, 2), rand(0.5, 4.5), rand(-7.5, 3)], i * 3);
    this.dust = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ color: 0xfff4d0, size: 0.035, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    s.add(this.dust);

    // the bed you're lying in (foreground): rumpled duvet and a pillow
    const duvetGeo = new THREE.PlaneGeometry(8, 5, 48, 30);
    const dp = duvetGeo.attributes.position;
    for (let i = 0; i < dp.count; i++) {
      const x = dp.getX(i);
      const y = dp.getY(i);
      dp.setZ(i, Math.sin(x * 1.7) * 0.12 + Math.cos(y * 2.3 + x) * 0.1 + Math.sin(x * 4 + y * 3) * 0.04);
    }
    duvetGeo.computeVertexNormals();
    const duvet = new THREE.Mesh(duvetGeo, new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.95 }));
    duvet.rotation.x = -Math.PI / 2;
    duvet.position.set(0, 0.75, 3.3);
    s.add(duvet);
    const pillow = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), duvet.material);
    pillow.scale.set(1.3, 0.35, 0.8);
    pillow.position.set(-2.6, 0.95, 4.3);
    s.add(pillow);

    // nightstand: the phone, and a $5 glass of water
    const wood = new THREE.MeshStandardMaterial({ color: 0x5a3a22, roughness: 0.6 });
    const stand = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 1.3), wood);
    stand.position.set(2.5, 0.55, 1.3);
    s.add(stand);
    this.phone = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.98), new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.3, metalness: 0.4 }));
    this.phone.add(body);
    // screens glow on their own: not affected by the blinding exposure
    this.screenMat = new THREE.MeshBasicMaterial({ map: texFrom(lockScreen(texts), this.renderer), toneMapped: false });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.9), this.screenMat);
    screen.rotation.x = -Math.PI / 2;
    screen.position.y = 0.03;
    this.phone.add(screen);
    // propped up against the glass so you can read it from bed
    this.phone.position.set(2.2, 1.4, 1.45);
    this.phone.rotation.set(1.05, -0.3, 0);
    s.add(this.phone);
    this.phoneBase = this.phone.position.clone();
    const glass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.17, 0.14, 0.5, 18, 1, true),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
    );
    glass.position.set(2.85, 1.35, 1.0);
    s.add(glass);
    const water = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.36, 18), new THREE.MeshStandardMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.6, roughness: 0.05 }));
    water.position.set(2.85, 1.29, 1.0);
    s.add(water);
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.42, 0.24),
      new THREE.MeshBasicMaterial({
        map: texFrom(
          canvas(128, 72, (x, w, h) => {
            x.fillStyle = '#fffbe8';
            x.fillRect(0, 0, w, h);
            x.fillStyle = '#b3122a';
            x.font = 'bold 40px Georgia, serif';
            x.textAlign = 'center';
            x.fillText('$5', w / 2, 50);
          }),
          this.renderer
        ),
      })
    );
    tag.position.set(3.1, 1.25, 1.2);
    tag.rotation.set(-0.3, -0.5, 0.2);
    s.add(tag);

    // there is a traffic cone in your bed. nobody knows why.
    const cone = new THREE.Group();
    const orange = new THREE.MeshStandardMaterial({ color: 0xff6a13, roughness: 0.6 });
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.4, 24), orange);
    c.position.y = 0.8;
    cone.add(c);
    for (const y of [0.55, 0.95]) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * (1 - (y - 0.1) / 1.4) + 0.02, 0.45 * (1 - (y - 0.2) / 1.4) + 0.02, 0.12, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
      band.position.y = y;
      cone.add(band);
    }
    const foot = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.1, 1.1), orange);
    foot.position.y = 0.05;
    cone.add(foot);
    cone.rotation.set(0.25, 0.4, -0.35); // tucked into bed with you
    cone.scale.setScalar(0.8);
    cone.position.set(0.9, 0.72, 1.7);
    s.add(cone);

    // the morning paper, on the bed
    if (headlines) {
      const news = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.06), new THREE.MeshStandardMaterial({ map: texFrom(newspaper(headlines), this.renderer), roughness: 0.9, side: THREE.DoubleSide }));
      news.position.set(0.55, 1.06, 3.4);
      news.rotation.set(-0.7, 0.05, 0.04);
      s.add(news);
    }
    // the upgrades you bought
    this.props = hotelProps(s, hotel, this.renderer);
    if (hotel !== 'motel') room.material.color.set(0xffe2b8); // warmer, fancier walls
    // married? they're standing at the end of the bed, arms crossed
    if (spouse) {
      const a = buildAvatar(spouse.look);
      a.root.position.set(-0.5, 0, -2.2);
      a.root.updateMatrixWorld(true);
      a.root.position.y = 0.02 - new THREE.Box3().setFromObject(a.root).min.y;
      a.root.rotation.y = 0.15;
      s.add(a.root);
      this.spouse = a;
    }

    this.look = new THREE.Vector3(0, 2.6, -7);
    this.camera.position.set(0.2, 1.35, 5.4);
    this.buzzT = 1.5;
  }

  update(dt, t) {
    // the blinds open by themselves. why would they do that.
    const open = smooth((t - 1.2) / 4.5);
    this.slats.forEach((sl, i) => (sl.rotation.x = open * (1.35 + Math.sin(i * 1.7) * 0.08)));
    this.rayMat.opacity = open * (this.shades ? 0.12 : 0.32);
    this.dust.material.opacity = open * 0.8;
    this.sun.intensity = open * (this.shades ? 1.2 : 3.2);
    this.hemi.intensity = 0.25 + open * 0.9;
    // exposure blows out when the blinds open, then settles to merely too bright
    const peak = this.shades ? 0.85 : t < 6.2 ? 0.3 + open * 2.1 : 1.35 + Math.max(0, 7.8 - t) * 0.6;
    this.exposure += (peak - this.exposure) * (1 - Math.exp(-dt * 3));
    this.renderer.toneMappingExposure = this.exposure;

    const dp = this.dust.geometry.attributes.position;
    for (let i = 0; i < dp.count; i++) {
      let y = dp.getY(i) + Math.sin(t * 0.3 + i) * 0.0015 - 0.0008;
      if (y < 0.4) y = 4.5;
      dp.setY(i, y);
      dp.setX(i, dp.getX(i) + Math.cos(t * 0.2 + i * 0.7) * 0.001);
    }
    dp.needsUpdate = true;

    // the tub bubbles, the tiger dreams, the spouse taps a foot
    for (const b of this.props.bubbles) {
      const u = b.userData;
      const k = (t * 0.6 + u.phase) % 1;
      b.position.set(2.5 + Math.cos(u.a + t * 0.3) * u.r, 0.82 + k * 0.25, -6.6 + Math.sin(u.a + t * 0.3) * u.r);
      b.scale.setScalar(1 - k * 0.7);
    }
    if (this.props.tail) this.props.tail.rotation.z = 1.2 + Math.sin(t * 1.5) * 0.25;
    if (this.spouse) {
      const a = this.spouse;
      a.head.rotation.set(0, Math.sin(t * 0.7) * 0.15, Math.sin(t * 2.2) * 0.05);
      a.armL.g.rotation.set(-1.2, 0, 0.95); // arms crossed
      a.armR.g.rotation.set(-1.2, 0, -0.95);
      a.legs[1].rotation.x = Math.max(0, Math.sin(t * 6)) * -0.2; // tap, tap, tap
    }

    // the phone buzzes. it's Dave.
    if ((this.buzzT -= dt) < 0) {
      this.buzzT = rand(2.5, 4.5);
      this.buzzing = 0.45;
      this.onBuzz?.();
    }
    if (this.buzzing > 0) {
      this.buzzing -= dt;
      this.phone.position.set(this.phoneBase.x + rand(-0.015, 0.015), this.phoneBase.y, this.phoneBase.z + rand(-0.015, 0.015));
    } else this.phone.position.copy(this.phoneBase);

    // groggy head: slow sway, a bit of a tilt, the room breathes
    this.camera.position.set(0.2 + Math.sin(t * 0.35) * 0.12, 1.35 + Math.sin(t * 0.5) * 0.05, 5.4);
    this.camera.lookAt(this.look.x + Math.sin(t * 0.27) * 0.5, this.look.y + Math.sin(t * 0.41) * 0.2, this.look.z);
    this.camera.rotateZ(Math.sin(t * 0.3) * 0.05 - 0.06);
    const base = this.camera.aspect < 1.25 ? Math.min(78, this.fov * (1.25 / this.camera.aspect)) : this.fov;
    this.camera.fov = base + Math.sin(t * 0.6) * 1.8;
    this.camera.updateProjectionMatrix();
  }

  /** Sunglasses on: the world gets bearable. */
  putOnShades() {
    this.shades = true;
  }
}
