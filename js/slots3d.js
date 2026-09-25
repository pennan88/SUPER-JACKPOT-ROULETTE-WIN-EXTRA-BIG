import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { COLS, ROWS } from './rush-math.js';

// 🐉 DRAGON RUSH WIN BIG, in 3D: a 7×7 grid of chunky 3D gems inside a pagoda gate,
// in front of a sunset sky with mountains, drifting clouds, rising lanterns and a
// serpent dragon looping through the clouds. Symbols fall, bounce, explode and tumble.
// The camera is fixed (a gentle parallax follows the mouse); the grid is fitted into
// whatever rectangle the HTML layout leaves for it (`slotEl`).

const CELL = 1;
const TOP = (ROWS / 2) * CELL;
const W = COLS * CELL;
const xOf = (c) => (c - (COLS - 1) / 2) * CELL;
const yOf = (r) => ((ROWS - 1) / 2 - r) * CELL;
const EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
// the framed area the camera keeps in view (pagoda roof + pillars + base)
const FIT = { w: 12.4, h: 10.6, cy: 0.75, cx: 0.45 };

export const SYMBOL_INFO = {
  sapph: { name: 'SAPPHIRES', color: '#3d7bff' },
  amethyst: { name: 'AMETHYSTS', color: '#b061ff' },
  jade: { name: 'JADE RINGS', color: '#22c46e' },
  amber: { name: 'AMBER HEARTS', color: '#ff8c1a' },
  lantern: { name: 'LANTERNS', color: '#ff3b2f' },
  ingot: { name: 'GOLD INGOTS', color: '#ffc93a' },
  dragon: { name: 'DRAGONS', color: '#ff2d55' },
  pearl: { name: 'FLAMING PEARLS', color: '#ffd6ec' },
  // ✨ special markers
  envelope: { name: 'RED ENVELOPE', color: '#ff3b2f' },
  cookie: { name: 'FORTUNE COOKIE', color: '#f2c14e' },
  gong: { name: 'TEMPLE GONG', color: '#ffd23f' },
  firecracker: { name: 'FIRECRACKER', color: '#ff5a1f' },
  egg: { name: 'DRAGON EGG', color: '#ffb020' },
  egg1: { name: 'CRACKED EGG', color: '#ffb020' },
  wild: { name: 'BABY DRAGON WILD', color: '#3dff8a' },
  kite: { name: 'KITE', color: '#3dafff' },
  cat: { name: 'LUCKY CAT', color: '#ffd23f' },
  moon: { name: 'FULL MOON', color: '#ffe6a0' },
  panda: { name: 'LAZY PANDA', color: '#ffffff' },
  taxman: { name: 'DRAGON TAX INSPECTOR', color: '#5ee08f' },
};

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}
const tex = (c) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
};
function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}
function roundShape(w, h, r, cx = 0, cy = 0) {
  const s = new THREE.Shape();
  const x = cx - w / 2;
  const y = cy - h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
const glowTexture = (inner, outer = 'rgba(0,0,0,0)', size = 128) => {
  const [c, g] = canvas(size, size);
  const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner);
  gr.addColorStop(1, outer);
  g.fillStyle = gr;
  g.fillRect(0, 0, size, size);
  return tex(c);
};

// ---------------------------------------------------------------- symbols
function buildSymbols(clip) {
  const phys = (o) => new THREE.MeshPhysicalMaterial({ clippingPlanes: clip, envMapIntensity: 1.4, ...o });
  const gold = phys({ color: 0xffc53a, metalness: 1, roughness: 0.2, clearcoat: 0.6 });
  const label = makeLabel(clip);
  const T = {};
  const group = (...parts) => {
    const g = new THREE.Group();
    for (const [geo, mat, fn] of parts) {
      const m = new THREE.Mesh(geo, mat);
      fn?.(m);
      g.add(m);
    }
    return g;
  };

  // 💎 sapphire: faceted octahedron
  {
    const geo = new THREE.OctahedronGeometry(0.4, 0);
    geo.scale(0.95, 1.2, 0.75);
    T.sapph = group([geo, phys({ color: 0x2f6bff, roughness: 0.04, clearcoat: 1, flatShading: true, emissive: 0x0b2080, emissiveIntensity: 0.55, envMapIntensity: 2 })]);
  }
  // 🔮 amethyst: hexagonal crystal
  {
    const geo = new THREE.LatheGeometry([new THREE.Vector2(0, -0.46), new THREE.Vector2(0.28, -0.2), new THREE.Vector2(0.28, 0.2), new THREE.Vector2(0, 0.46)], 6);
    T.amethyst = group([geo, phys({ color: 0xa24dff, roughness: 0.05, clearcoat: 1, flatShading: true, emissive: 0x330a70, emissiveIntensity: 0.6, envMapIntensity: 2 }), (m) => (m.rotation.z = 0.35)]);
  }
  // 🟢 jade bi-disc
  {
    const geo = new THREE.TorusGeometry(0.26, 0.13, 20, 48);
    T.jade = group([geo, phys({ color: 0x17b85f, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.1, emissive: 0x03351a, emissiveIntensity: 0.7 })]);
  }
  // 🧡 amber heart
  {
    const s = new THREE.Shape();
    s.moveTo(0, 0.22);
    s.bezierCurveTo(0, 0.26, -0.06, 0.4, -0.22, 0.4);
    s.bezierCurveTo(-0.46, 0.4, -0.46, 0.13, -0.46, 0.13);
    s.bezierCurveTo(-0.46, -0.03, -0.3, -0.21, 0, -0.4);
    s.bezierCurveTo(0.3, -0.21, 0.46, -0.03, 0.46, 0.13);
    s.bezierCurveTo(0.46, 0.13, 0.46, 0.4, 0.22, 0.4);
    s.bezierCurveTo(0.06, 0.4, 0, 0.26, 0, 0.22);
    const geo = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.07, bevelSegments: 6, curveSegments: 28 });
    geo.center();
    geo.scale(0.9, 0.9, 1);
    T.amber = group([geo, phys({ color: 0xff8a1a, roughness: 0.1, clearcoat: 1, emissive: 0x6a1c00, emissiveIntensity: 0.55 })]);
  }
  // 🏮 lantern
  {
    const body = new THREE.SphereGeometry(0.33, 32, 20);
    body.scale(1, 0.82, 1);
    const red = phys({ color: 0xe3261c, roughness: 0.35, clearcoat: 0.8, emissive: 0x8a0e05, emissiveIntensity: 0.9 });
    const cap = new THREE.CylinderGeometry(0.16, 0.19, 0.08, 24);
    const rib = new THREE.TorusGeometry(0.33, 0.013, 6, 48);
    rib.scale(1, 0.82, 1);
    const tassel = new THREE.CylinderGeometry(0.025, 0.07, 0.2, 10);
    const hook = new THREE.TorusGeometry(0.05, 0.016, 8, 20);
    T.lantern = group(
      [body, red],
      [cap, gold, (m) => (m.position.y = 0.28)],
      [cap, gold, (m) => ((m.position.y = -0.28), (m.rotation.x = Math.PI))],
      ...[0, 1, 2, 3].map((i) => [rib, gold, (m) => (m.rotation.y = (i * Math.PI) / 4)]),
      [tassel, gold, (m) => (m.position.y = -0.42)],
      [hook, gold, (m) => (m.position.y = 0.37)],
    );
  }
  // 🪙 gold ingot (yuanbao)
  {
    const base = new THREE.SphereGeometry(0.36, 32, 16);
    base.scale(1.25, 0.45, 0.8);
    const end = new THREE.SphereGeometry(0.15, 20, 14);
    const dome = new THREE.SphereGeometry(0.2, 24, 16);
    const shiny = phys({ color: 0xffc53a, metalness: 1, roughness: 0.14, clearcoat: 1, emissive: 0x3a2000, emissiveIntensity: 0.5 });
    T.ingot = group(
      [base, shiny, (m) => (m.position.y = -0.08)],
      [end, shiny, (m) => m.position.set(-0.36, 0.05, 0)],
      [end, shiny, (m) => m.position.set(0.36, 0.05, 0)],
      [dome, shiny, (m) => m.position.set(0, 0.06, 0)],
    );
  }
  // 🐲 dragon medallion
  {
    const [c, g] = canvas(256, 256);
    const gr = g.createRadialGradient(128, 110, 10, 128, 128, 128);
    gr.addColorStop(0, '#ff4d4d');
    gr.addColorStop(0.7, '#b30d1d');
    gr.addColorStop(1, '#5a0510');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 256);
    g.font = `170px ${EMOJI}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('🐲', 128, 140);
    const face = new THREE.MeshStandardMaterial({ map: tex(c), roughness: 0.4, emissive: 0xffffff, emissiveMap: tex(c), emissiveIntensity: 0.35, clippingPlanes: clip });
    const disc = new THREE.CircleGeometry(0.41, 48);
    const side = new THREE.CylinderGeometry(0.43, 0.43, 0.14, 48, 1, true);
    side.rotateX(Math.PI / 2);
    const rim = new THREE.TorusGeometry(0.42, 0.045, 12, 60);
    T.dragon = group(
      [disc, face, (m) => (m.position.z = 0.07)],
      [side, gold],
      [rim, gold, (m) => (m.position.z = 0.07)],
      [rim, gold, (m) => (m.position.z = -0.07)],
    );
    T.dragon.scale.setScalar(1.05);
  }
  // 🔥 flaming pearl: the SCATTER
  {
    const pearl = new THREE.SphereGeometry(0.3, 40, 24);
    const mat = phys({ color: 0xfff0f6, roughness: 0.12, clearcoat: 1, iridescence: 1, iridescenceIOR: 1.35, emissive: 0xff5a9c, emissiveIntensity: 0.3 });
    const [fc, fg] = canvas(128, 128);
    const fl = fg.createRadialGradient(64, 76, 4, 64, 70, 62);
    fl.addColorStop(0, 'rgba(255,250,210,1)');
    fl.addColorStop(0.35, 'rgba(255,170,40,0.9)');
    fl.addColorStop(0.7, 'rgba(255,50,20,0.45)');
    fl.addColorStop(1, 'rgba(255,0,0,0)');
    fg.fillStyle = fl;
    fg.fillRect(0, 0, 128, 128);
    const flame = new THREE.MeshBasicMaterial({ map: tex(fc), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, clippingPlanes: clip });
    T.pearl = group(
      [new THREE.PlaneGeometry(1.1, 1.25), flame, (m) => ((m.position.set(0, 0.08, -0.25)), (m.name = 'flame'))],
      [pearl, mat],
      label('SCATTER'),
    );
  }
  buildMarkers(T, { clip, phys, gold, group, label });
  return T;
}

// the little tag under a special symbol (SCATTER, WILD, BOOM…)
const LABEL_GEO = new THREE.PlaneGeometry(0.95, 0.24);
function makeLabel(clip) {
  return (text, { top = '#fff6c0', bottom = '#ffb020', stroke = '#5a0510', y = -0.36 } = {}) => {
    const [lc, lg] = canvas(256, 64);
    const mat = new THREE.MeshBasicMaterial({ map: tex(lc), transparent: true, depthWrite: false, clippingPlanes: clip });
    const draw = () => {
      lg.clearRect(0, 0, 256, 64);
      lg.font = '900 40px Cinzel, Georgia, serif';
      const size = Math.min(40, (40 * 226) / lg.measureText(text).width);
      lg.font = `900 ${size}px Cinzel, Georgia, serif`;
      lg.textAlign = 'center';
      lg.textBaseline = 'middle';
      lg.lineWidth = 9;
      lg.strokeStyle = stroke;
      lg.strokeText(text, 128, 34);
      const tg = lg.createLinearGradient(0, 12, 0, 56);
      tg.addColorStop(0, top);
      tg.addColorStop(1, bottom);
      lg.fillStyle = tg;
      lg.fillText(text, 128, 34);
      mat.map.needsUpdate = true;
    };
    draw();
    document.fonts?.ready.then(draw);
    return [LABEL_GEO, mat, (m) => m.position.set(0, y, 0.34)];
  };
}

// ---------------------------------------------------------------- ✨ special markers
function buildMarkers(T, { clip, phys, gold, group, label }) {
  const std = (o) => new THREE.MeshStandardMaterial({ clippingPlanes: clip, ...o });
  const faceTex = (w, h, draw) => {
    const [c, g] = canvas(w, h);
    draw(g, w, h);
    return tex(c);
  };
  const glowMat = (inner) => new THREE.MeshBasicMaterial({ map: glowTexture(inner), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, clippingPlanes: clip, toneMapped: false });
  const black = std({ color: 0x141414, roughness: 0.5 });
  const white = phys({ color: 0xfaf6f0, roughness: 0.35, clearcoat: 0.6 });

  // 🧧 red envelope with a gold 福
  {
    const red = phys({ color: 0xe0141f, roughness: 0.3, clearcoat: 0.8, emissive: 0x6a0008, emissiveIntensity: 0.6 });
    const front = std({
      map: faceTex(160, 200, (g, w, h) => {
        g.fillStyle = '#d4101c';
        g.fillRect(0, 0, w, h);
        g.strokeStyle = '#ffd24a';
        g.lineWidth = 8;
        g.strokeRect(8, 8, w - 16, h - 16);
        g.beginPath();
        g.moveTo(8, 12);
        g.lineTo(w / 2, 78);
        g.lineTo(w - 8, 12);
        g.lineWidth = 6;
        g.stroke();
        g.fillStyle = '#ffd24a';
        g.beginPath();
        g.arc(w / 2, 122, 40, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#b00a14';
        g.font = '900 54px "Microsoft YaHei","PingFang SC","Noto Sans CJK SC",serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('福', w / 2, 126);
      }),
      roughness: 0.4,
      emissive: 0xffffff,
      emissiveIntensity: 0.25,
    });
    front.emissiveMap = front.map;
    T.envelope = group([new THREE.BoxGeometry(0.62, 0.78, 0.08), red], [new THREE.PlaneGeometry(0.6, 0.76), front, (m) => (m.position.z = 0.042)], label('+SPINS', { y: -0.44 }));
  }

  // 🥠 fortune cookie: a folded crescent with the fortune poking out
  {
    const dough = phys({ color: 0xc9731f, roughness: 0.45, clearcoat: 0.4, emissive: 0x4a1a00, emissiveIntensity: 0.45, envMapIntensity: 0.8 });
    const shell = new THREE.TorusGeometry(0.2, 0.15, 18, 36, Math.PI * 1.15);
    shell.rotateZ(-Math.PI * 0.075);
    shell.scale(1.2, 1, 0.9);
    const paper = std({
      map: faceTex(256, 48, (g, w, h) => {
        g.fillStyle = '#fffdf6';
        g.fillRect(0, 0, w, h);
        g.fillStyle = '#c0182a';
        g.font = 'bold 28px Georgia, serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('✦ LUCK ✦', w / 2, h / 2 + 2);
      }),
      roughness: 0.8,
      side: THREE.DoubleSide,
      emissive: 0xffffff,
      emissiveIntensity: 0.2,
    });
    paper.emissiveMap = paper.map;
    T.cookie = group(
      [shell, dough, (m) => (m.position.y = -0.12)],
      [new THREE.PlaneGeometry(0.52, 0.1), paper, (m) => (m.position.set(0.08, -0.14, 0.17), (m.rotation.z = -0.25))],
      label('FORTUNE'),
    );
  }

  // 🔔 temple gong on a little red frame (the disc swings when it rings)
  {
    const red = phys({ color: 0xb3121f, roughness: 0.35, clearcoat: 0.9 });
    const disc = new THREE.CylinderGeometry(0.27, 0.27, 0.05, 40);
    disc.rotateX(Math.PI / 2);
    const bright = phys({ color: 0xffc53a, metalness: 1, roughness: 0.16, clearcoat: 1, emissive: 0x4a2a00, emissiveIntensity: 0.5 });
    const g = group(
      [new THREE.CylinderGeometry(0.035, 0.035, 0.8, 10), red, (m) => m.position.set(-0.36, 0, -0.05)],
      [new THREE.CylinderGeometry(0.035, 0.035, 0.8, 10), red, (m) => m.position.set(0.36, 0, -0.05)],
      [new THREE.BoxGeometry(0.86, 0.07, 0.08), red, (m) => m.position.set(0, 0.37, -0.05)],
      label('RESPIN', { top: '#fff', bottom: '#ffd23f' }),
    );
    const swing = group([disc, bright], [new THREE.SphereGeometry(0.08, 16, 10), gold, (m) => (m.position.z = 0.03)], [new THREE.TorusGeometry(0.2, 0.012, 6, 36), gold, (m) => (m.position.z = 0.03)]);
    swing.name = 'swing';
    swing.position.y = 0.04;
    g.add(swing);
    T.gong = g;
  }

  // 🧨 firecracker with a fizzing fuse
  {
    const red = phys({ color: 0xff1f2a, roughness: 0.25, clearcoat: 1, emissive: 0x800008, emissiveIntensity: 0.7 });
    const body = new THREE.CylinderGeometry(0.15, 0.15, 0.58, 24);
    const band = new THREE.TorusGeometry(0.152, 0.02, 8, 24);
    band.rotateX(Math.PI / 2);
    const fuse = new THREE.CylinderGeometry(0.018, 0.018, 0.2, 8);
    const stick = group(
      [body, red],
      [band, gold, (m) => (m.position.y = 0.22)],
      [band, gold, (m) => (m.position.y = -0.22)],
      [new THREE.CylinderGeometry(0.1, 0.12, 0.05, 20), gold, (m) => (m.position.y = 0.31)],
      [fuse, std({ color: 0xd9c08a, roughness: 0.9 }), (m) => (m.position.set(0.03, 0.42, 0), (m.rotation.z = -0.3))],
      [new THREE.PlaneGeometry(0.34, 0.34), glowMat('rgba(255,230,120,1)'), (m) => (m.position.set(0.07, 0.53, 0.05), (m.name = 'spark'))],
    );
    stick.rotation.z = -0.3;
    stick.position.y = 0.02;
    const g = group(label('BOOM', { top: '#fff', bottom: '#ff5a1f' }));
    g.add(stick);
    T.firecracker = g;
  }

  // 🥚 dragon egg: red-gold scales; once cracked, the cracks glow from inside
  {
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const t = -Math.PI / 2 + (i / 20) * Math.PI;
      pts.push(new THREE.Vector2(Math.max(0.001, 0.27 * Math.cos(t) * (1 - 0.14 * Math.sin(t))), 0.37 * Math.sin(t)));
    }
    const shape = new THREE.LatheGeometry(pts, 32);
    const scales = (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#ffb347');
      gr.addColorStop(0.5, '#d0302a');
      gr.addColorStop(1, '#6a0a1a');
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,215,90,0.75)';
      g.lineWidth = 3;
      for (let y = 8; y < h; y += 22)
        for (let x = (y / 22) % 2 ? 0 : 16; x < w + 32; x += 32) {
          g.beginPath();
          g.arc(x, y, 14, 0.1 * Math.PI, 0.9 * Math.PI);
          g.stroke();
        }
    };
    // zigzag cracks all the way round (the lathe's texture seam faces the camera)
    const cracks = (g) => {
      g.strokeStyle = '#fff4b0';
      g.lineWidth = 9;
      g.lineJoin = 'round';
      g.shadowColor = '#ff8a00';
      g.shadowBlur = 12;
      for (let x0 = 0; x0 <= 512; x0 += 64) {
        g.beginPath();
        let x = x0;
        g.moveTo(x, 70);
        for (let y = 88; y <= 190; y += 18) g.lineTo((x += (y / 18) % 2 ? 16 : -16), y);
        g.stroke();
      }
    };
    const egg = (cracked) => {
      const map = faceTex(512, 256, (g, w, h) => {
        scales(g, w, h);
        if (cracked) cracks(g, w, h);
      });
      const glow = faceTex(512, 256, (g, w, h) => {
        g.fillStyle = '#000';
        g.fillRect(0, 0, w, h);
        if (cracked) cracks(g, w, h);
      });
      const mat = phys({ map, roughness: 0.3, clearcoat: 1, emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: cracked ? 2.4 : 0 });
      return group([shape, mat, (m) => (m.position.y = 0.02)], label(cracked ? 'CRACK!' : 'EGG', { top: '#fff4c0', bottom: '#ff8a00' }));
    };
    T.egg = egg(false);
    T.egg1 = egg(true);
  }

  // 🐉 baby dragon WILD: a rainbow-rimmed medallion
  {
    const face = std({
      map: faceTex(256, 256, (g) => {
        const gr = g.createRadialGradient(128, 110, 10, 128, 128, 128);
        gr.addColorStop(0, '#7dffb0');
        gr.addColorStop(0.65, '#12a060');
        gr.addColorStop(1, '#063a26');
        g.fillStyle = gr;
        g.fillRect(0, 0, 256, 256);
        g.font = `160px ${EMOJI}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('🐉', 128, 132);
      }),
      roughness: 0.35,
      emissive: 0xffffff,
      emissiveIntensity: 0.35,
    });
    face.emissiveMap = face.map;
    const rim = phys({ color: 0xffffff, metalness: 0.6, roughness: 0.15, iridescence: 1, iridescenceIOR: 1.8, clearcoat: 1, emissive: 0xff4fd8, emissiveIntensity: 0.35 });
    T.wild = group(
      [new THREE.PlaneGeometry(1.25, 1.25), glowMat('rgba(120,255,190,0.9)'), (m) => ((m.position.z = -0.15), (m.name = 'flame'))],
      [new THREE.CircleGeometry(0.39, 48), face, (m) => (m.position.z = 0.06)],
      [new THREE.CylinderGeometry(0.41, 0.41, 0.12, 48, 1, true).rotateX(Math.PI / 2), gold],
      [new THREE.TorusGeometry(0.4, 0.05, 12, 60), rim, (m) => (m.position.z = 0.06)],
      label('WILD', { top: '#f0fff4', bottom: '#3dff8a', stroke: '#033319' }),
    );
  }

  // 🪁 kite: four coloured panes, cross spars and a bow tail that wiggles
  {
    const pane = (a, b, color) => {
      const s = new THREE.Shape();
      s.moveTo(0, 0);
      s.lineTo(...a);
      s.lineTo(...b);
      s.closePath();
      return [new THREE.ShapeGeometry(s), phys({ color, roughness: 0.4, clearcoat: 0.6, side: THREE.DoubleSide, emissive: color, emissiveIntensity: 0.25 })];
    };
    const T_ = [0, 0.4];
    const R = [0.3, 0.08];
    const B = [0, -0.34];
    const L = [-0.3, 0.08];
    const spar = std({ color: 0x6a3a14, roughness: 0.7 });
    const tail = group(
      ...[0, 1, 2].map((i) => [new THREE.ConeGeometry(0.05, 0.1, 8).rotateZ(Math.PI / 2), phys({ color: [0xffd23f, 0xff3d6a, 0x3dafff][i], roughness: 0.4 }), (m) => m.position.set(0.02 + i * 0.05, -0.1 - i * 0.12, 0)]),
      ...[0, 1, 2].map((i) => [new THREE.ConeGeometry(0.05, 0.1, 8).rotateZ(-Math.PI / 2), phys({ color: [0xffd23f, 0xff3d6a, 0x3dafff][i], roughness: 0.4 }), (m) => m.position.set(-0.08 + i * 0.05, -0.1 - i * 0.12, 0)]),
    );
    tail.name = 'tail';
    tail.position.y = -0.34;
    const g = group(
      [...pane(T_, R, 0xff3d3d), () => {}],
      [...pane(R, B, 0xffd23f), () => {}],
      [...pane(B, L, 0x3dafff), () => {}],
      [...pane(L, T_, 0x3ddf7a), () => {}],
      [new THREE.CylinderGeometry(0.012, 0.012, 0.74, 6), spar, (m) => m.position.set(0, 0.03, 0.01)],
      [new THREE.CylinderGeometry(0.012, 0.012, 0.6, 6).rotateZ(Math.PI / 2), spar, (m) => m.position.set(0, 0.08, 0.01)],
    );
    g.add(tail);
    const out = group(label('KITE', { top: '#e8f6ff', bottom: '#3dafff', stroke: '#0a2a5a' }));
    g.position.y = 0.06;
    g.rotation.z = 0.12;
    out.add(g);
    T.kite = out;
  }

  // 🐱 lucky cat, waving (the paw is a pivot so it can wave harder when it's its turn)
  {
    const face = std({
      map: faceTex(128, 128, (g) => {
        g.clearRect(0, 0, 128, 128);
        g.strokeStyle = '#1a1a1a';
        g.lineWidth = 6;
        g.lineCap = 'round';
        for (const x of [40, 88]) {
          g.beginPath();
          g.arc(x, 56, 11, Math.PI * 1.1, Math.PI * 1.9);
          g.stroke();
        }
        g.fillStyle = '#ff7aa2';
        g.beginPath();
        g.arc(64, 72, 6, 0, Math.PI * 2);
        g.fill();
        g.lineWidth = 3;
        for (const s of [-1, 1])
          for (const dy of [-5, 5]) {
            g.beginPath();
            g.moveTo(64 + s * 20, 76 + dy * 0.4);
            g.lineTo(64 + s * 50, 72 + dy);
            g.stroke();
          }
      }),
      transparent: true,
      roughness: 0.6,
    });
    const pink = std({ color: 0xff8ab0, roughness: 0.5 });
    const collar = phys({ color: 0xe0141f, roughness: 0.3, clearcoat: 1 });
    const ear = new THREE.ConeGeometry(0.075, 0.13, 12);
    const paw = group([new THREE.CylinderGeometry(0.06, 0.07, 0.24, 14), white, (m) => (m.position.y = 0.12)], [new THREE.SphereGeometry(0.075, 14, 10), white, (m) => (m.position.y = 0.25)]);
    paw.name = 'paw';
    paw.position.set(0.2, 0.02, 0.1);
    const g = group(
      [new THREE.SphereGeometry(0.24, 24, 18).scale(1, 1.05, 0.85), white, (m) => (m.position.y = -0.14)],
      [new THREE.SphereGeometry(0.2, 24, 18).scale(1.1, 0.95, 0.9), white, (m) => (m.position.y = 0.17)],
      [ear, white, (m) => (m.position.set(-0.12, 0.33, 0), (m.rotation.z = 0.35))],
      [ear, white, (m) => (m.position.set(0.12, 0.33, 0), (m.rotation.z = -0.35))],
      [new THREE.PlaneGeometry(0.3, 0.3), face, (m) => m.position.set(0, 0.15, 0.205)],
      [new THREE.TorusGeometry(0.16, 0.025, 8, 28).rotateX(Math.PI / 2), collar, (m) => (m.position.y = 0.01)],
      [new THREE.SphereGeometry(0.045, 14, 10), gold, (m) => m.position.set(0, -0.03, 0.17)],
      [new THREE.CylinderGeometry(0.12, 0.12, 0.03, 28).rotateX(Math.PI / 2), gold, (m) => m.position.set(-0.07, -0.16, 0.2)],
      [new THREE.SphereGeometry(0.03, 8, 6), pink, (m) => m.position.set(0.12, 0.3, 0.05)],
      label('LUCKY', { top: '#fff', bottom: '#ffd23f' }),
    );
    g.add(paw);
    T.cat = g;
  }

  // 🌕 full moon with a soft halo
  {
    // a warm harvest moon (a pale one looked just like the pearl)
    const map = faceTex(256, 128, (g, w, h) => {
      const base = g.createLinearGradient(0, 0, 0, h);
      base.addColorStop(0, '#ffe79a');
      base.addColorStop(1, '#f5b440');
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 30; i++) {
        const x = Math.random() * w;
        const y = 16 + Math.random() * (h - 32);
        const r = 5 + Math.random() * 13;
        const gr = g.createRadialGradient(x, y, 0, x, y, r);
        gr.addColorStop(0, 'rgba(170,90,20,0.7)');
        gr.addColorStop(0.7, 'rgba(170,90,20,0.35)');
        gr.addColorStop(1, 'rgba(170,90,20,0)');
        g.fillStyle = gr;
        g.fillRect(x - r, y - r, r * 2, r * 2);
      }
    });
    const moon = phys({ map, roughness: 0.85, emissive: 0xffc860, emissiveMap: map, emissiveIntensity: 0.55, envMapIntensity: 0.6 });
    T.moon = group(
      [new THREE.PlaneGeometry(1.4, 1.4), glowMat('rgba(255,200,90,0.95)'), (m) => ((m.position.z = -0.3), (m.name = 'flame'))],
      [new THREE.SphereGeometry(0.33, 36, 24), moon],
      label('MOON', { top: '#fffbe6', bottom: '#ffd98a', stroke: '#3a2a00' }),
    );
  }

  // 🐼 sleepy panda head, Zzz floating off it
  {
    const patch = new THREE.SphereGeometry(1, 14, 10);
    const zzz = new THREE.MeshBasicMaterial({
      map: faceTex(128, 64, (g) => {
        g.font = '900 44px Georgia, serif';
        g.fillStyle = '#ffffff';
        g.strokeStyle = '#1a2a5a';
        g.lineWidth = 6;
        g.strokeText('Zz', 30, 48);
        g.fillText('Zz', 30, 48);
      }),
      transparent: true,
      depthWrite: false,
      clippingPlanes: clip,
    });
    T.panda = group(
      [new THREE.SphereGeometry(0.3, 28, 20).scale(1.05, 0.92, 0.9), white],
      [new THREE.SphereGeometry(0.1, 14, 10), black, (m) => m.position.set(-0.23, 0.23, -0.02)],
      [new THREE.SphereGeometry(0.1, 14, 10), black, (m) => m.position.set(0.23, 0.23, -0.02)],
      [patch, black, (m) => (m.position.set(-0.11, 0.02, 0.23), m.scale.set(0.085, 0.06, 0.04), (m.rotation.z = -0.5))],
      [patch, black, (m) => (m.position.set(0.11, 0.02, 0.23), m.scale.set(0.085, 0.06, 0.04), (m.rotation.z = 0.5))],
      [new THREE.SphereGeometry(0.04, 12, 8).scale(1.3, 0.8, 1), black, (m) => m.position.set(0, -0.07, 0.27)],
      [new THREE.PlaneGeometry(0.34, 0.17), zzz, (m) => (m.position.set(0.24, 0.34, 0.2), (m.name = 'zzz'))],
      label('ZZZ', { top: '#ffffff', bottom: '#b8c8e8', stroke: '#1a2a5a' }),
    );
  }

  // 🧾 the tax man: a curled receipt in a bowler hat
  {
    const paperGeo = new THREE.PlaneGeometry(0.5, 0.72, 1, 10);
    const p = paperGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, 0.06 * Math.cos((p.getY(i) / 0.72) * Math.PI * 1.4));
    paperGeo.computeVertexNormals();
    const paper = std({
      map: faceTex(160, 232, (g, w, h) => {
        g.fillStyle = '#fbfaf4';
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(w, 0);
        for (let x = w; x >= 0; x -= 16) g.lineTo(x, h - (x / 16) % 2 * 10);
        g.closePath();
        g.fill();
        g.fillStyle = '#333';
        g.textAlign = 'center';
        g.font = 'bold 17px monospace';
        g.fillText('DRAGON TAX', w / 2, 28);
        g.fillRect(14, 38, w - 28, 2);
        g.font = '12px monospace';
        g.textAlign = 'left';
        ['WIN ....... $$$', 'TAX ....... 10%', 'FEE ....... YES', 'SMILE ..... NO'].forEach((t, i) => g.fillText(t, 16, 60 + i * 20));
        g.save();
        g.translate(w / 2, 168);
        g.rotate(-0.25);
        g.strokeStyle = '#d0142a';
        g.fillStyle = '#d0142a';
        g.lineWidth = 4;
        g.strokeRect(-46, -18, 92, 36);
        g.font = 'bold 26px Georgia, serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText('PAID', 0, 2);
        g.restore();
      }),
      transparent: true,
      alphaTest: 0.5,
      roughness: 0.9,
      side: THREE.DoubleSide,
      emissive: 0xffffff,
      emissiveIntensity: 0.15,
    });
    paper.emissiveMap = paper.map;
    const hat = std({ color: 0x1a1a1a, roughness: 0.45, metalness: 0.2 });
    T.taxman = group(
      [paperGeo, paper, (m) => (m.rotation.z = 0.08)],
      [new THREE.CylinderGeometry(0.2, 0.2, 0.02, 24), hat, (m) => (m.position.set(-0.1, 0.36, 0.04), (m.rotation.z = 0.3))],
      [new THREE.SphereGeometry(0.13, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), hat, (m) => (m.position.set(-0.1, 0.37, 0.04), (m.rotation.z = 0.3))],
      label('TAX', { top: '#e8ffe8', bottom: '#5ee08f', stroke: '#0a3a1a' }),
    );
  }
}

// ---------------------------------------------------------------- the machine
export class DragonRush3D {
  constructor(container, { slotEl, onLeverDown, onLeverUp }) {
    this.container = container;
    this.slotEl = slotEl;
    this.onLeverDown = onLeverDown;
    this.onLeverUp = onLeverUp;
    this.speed = 1;

    const renderer = (this.renderer = new THREE.WebGLRenderer({ antialias: true }));
    // resolution drops a notch while frames are slow (huge wins) and comes back once it's calm
    this.maxRatio = Math.min(window.devicePixelRatio, 2);
    this.ratio = this.maxRatio;
    this.perf = { t: 0, n: 0, best: Infinity, calm: 0 };
    renderer.setPixelRatio(this.ratio);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.localClippingEnabled = true;
    container.appendChild(renderer.domElement);

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
    this.target = new THREE.Vector3(FIT.cx, FIT.cy, 0);
    this.dist = 26;

    this.scene.add(new THREE.HemisphereLight(0xfff0f4, 0x301030, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.3);
    key.position.set(3, 6, 10);
    this.scene.add(key);
    const warm = new THREE.PointLight(0xffb060, 30, 30, 1.6);
    warm.position.set(-6, 5, 6);
    this.scene.add(warm);
    const pink = new THREE.PointLight(0xff5aa0, 25, 30, 1.6);
    pink.position.set(7, -2, 6);
    this.scene.add(pink);

    // symbols are clipped to the window, so they fall in from the top edge like real tumbles
    this.clip = [new THREE.Plane(new THREE.Vector3(0, -1, 0), TOP), new THREE.Plane(new THREE.Vector3(0, 1, 0), TOP)];
    this.kinds = buildSymbols(this.clip);

    this.buildSky();
    this.buildDragon();
    this.buildGate();
    this.buildSpots();
    this.buildSparks();
    this.buildLever();

    this.board = new THREE.Group();
    this.scene.add(this.board);
    this.cells = Array.from({ length: COLS }, () => Array(ROWS).fill(null));

    this.anims = [];
    this.shake = 0;
    this.mode = 0;
    this.modeTarget = 0;
    this.boost = 0;
    this.pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    container.addEventListener('pointermove', (e) => {
      const r = container.getBoundingClientRect();
      this.pointer.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      this.pointer.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      renderer.domElement.style.cursor = this.hitsLever(e) ? (this.leverHeld ? 'grabbing' : 'grab') : '';
    });
    // the lever: press to pull, hold it down for turbo
    renderer.domElement.addEventListener('pointerdown', (e) => {
      if (!this.hitsLever(e)) return;
      e.preventDefault();
      this.leverHeld = true;
      this.leverTarget = 1;
      renderer.domElement.setPointerCapture?.(e.pointerId);
      renderer.domElement.style.cursor = 'grabbing';
      this.onLeverDown?.();
    });
    const release = () => {
      if (!this.leverHeld) return;
      this.leverHeld = false;
      this.leverTarget = 0;
      this.onLeverUp?.();
    };
    renderer.domElement.addEventListener('pointerup', release);
    renderer.domElement.addEventListener('pointercancel', release);
    addEventListener('blur', release);

    this.clock = new THREE.Clock();
    this.running = false;
    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
  }

  // ---------- scenery ----------
  buildSky() {
    const s = this.scene;
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(600, 260),
      new THREE.ShaderMaterial({
        depthWrite: false,
        uniforms: { uFree: { value: 0 } },
        vertexShader: 'varying float vY; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vY = w.y; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `varying float vY; uniform float uFree;
          void main(){
            float t = clamp((vY + 8.0) / 60.0, 0.0, 1.0);
            vec3 low = mix(vec3(1.0,0.62,0.45), vec3(1.0,0.84,0.45), uFree);
            vec3 mid = mix(vec3(0.85,0.22,0.5), vec3(0.62,0.2,0.75), uFree);
            vec3 top = mix(vec3(0.25,0.04,0.32), vec3(0.08,0.05,0.28), uFree);
            vec3 c = t < 0.35 ? mix(low, mid, smoothstep(0.0, 0.35, t)) : mix(mid, top, smoothstep(0.35, 1.0, t));
            gl_FragColor = vec4(pow(c, vec3(2.2)), 1.0);
          }`,
      }),
    );
    sky.position.set(0, 20, -120);
    s.add(sky);
    this.sky = sky;

    const sun = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,250,220,1)', 'rgba(255,160,120,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    sun.position.set(-30, 6, -110);
    s.add(sun);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshBasicMaterial({ color: 0xfff1d6, transparent: true, opacity: 0.9 }));
    disc.position.set(-30, 6, -109);
    s.add(disc);

    // mountain ranges, far → near, with two pagodas on the middle range
    const ranges = [
      { z: -95, base: -6, amp: 20, color: 0xc2507e, seed: 3 },
      { z: -70, base: -9, amp: 14, color: 0x8a2468, seed: 7 },
      { z: -48, base: -13, amp: 9, color: 0x4a1244, seed: 11 },
    ];
    for (const r of ranges) {
      const sh = new THREE.Shape();
      sh.moveTo(-220, -60);
      let seed = r.seed;
      const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
      for (let x = -220; x <= 220; x += 6) {
        const peak = Math.pow(Math.abs(Math.sin(x * 0.035 + r.seed)), 3) * r.amp + rnd() * r.amp * 0.25;
        sh.lineTo(x, r.base + peak);
      }
      sh.lineTo(220, -60);
      const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color: r.color }));
      m.position.z = r.z;
      s.add(m);
    }
    const pagoda = () => {
      const sh = new THREE.Shape();
      const tiers = 5;
      let y = 0;
      const pts = [];
      for (let i = 0; i < tiers; i++) {
        const w = 3.2 - i * 0.5;
        pts.push([-w * 0.55, y], [-w * 0.55, y + 0.9], [-w, y + 1.0], [-w * 0.6, y + 1.35]);
        y += 1.35;
      }
      sh.moveTo(pts[0][0], 0);
      pts.forEach(([x, py]) => sh.lineTo(x, py));
      sh.lineTo(0, y + 1.4);
      [...pts].reverse().forEach(([x, py]) => sh.lineTo(-x, py));
      sh.lineTo(-pts[0][0], 0);
      return new THREE.ShapeGeometry(sh);
    };
    const pg = pagoda();
    [[-40, -2, -69, 1.6], [46, -4, -69, 1.2]].forEach(([x, y, z, k]) => {
      const m = new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ color: 0x6a1a58 }));
      m.position.set(x, y, z);
      m.scale.setScalar(k);
      s.add(m);
    });

    // clouds
    const [cc, cg] = canvas(256, 128);
    for (let i = 0; i < 9; i++) {
      const x = 40 + Math.random() * 176;
      const y = 60 + Math.random() * 30;
      const rr = 26 + Math.random() * 30;
      const gr = cg.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, 'rgba(255,255,255,0.9)');
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      cg.fillStyle = gr;
      cg.fillRect(0, 0, 256, 128);
    }
    const cloudTex = tex(cc);
    this.clouds = [];
    for (let i = 0; i < 16; i++) {
      const z = -20 - Math.random() * 60;
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 0.5),
        new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity: 0.35 + Math.random() * 0.4, color: new THREE.Color().setHSL(0.93 + Math.random() * 0.08, 0.7, 0.9) }),
      );
      const k = 14 + Math.random() * 22;
      m.scale.set(k, k, 1);
      m.position.set(-90 + Math.random() * 180, -4 + Math.random() * 26, z);
      m.userData.v = 0.4 + Math.random() * 0.9;
      s.add(m);
      this.clouds.push(m);
    }

    // rising sky lanterns
    const [lc, lg] = canvas(64, 96);
    const lgr = lg.createRadialGradient(32, 50, 2, 32, 50, 32);
    lgr.addColorStop(0, 'rgba(255,200,80,0.9)');
    lgr.addColorStop(1, 'rgba(255,90,20,0)');
    lg.fillStyle = lgr;
    lg.fillRect(0, 0, 64, 96);
    lg.fillStyle = '#ff5a1f';
    roundRect(lg, 20, 30, 24, 36, 8);
    lg.fill();
    lg.fillStyle = '#ffe08a';
    lg.fillRect(22, 28, 20, 4);
    lg.fillRect(22, 64, 20, 4);
    const lanternTex = tex(lc);
    this.lanterns = [];
    for (let i = 0; i < 44; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 1), new THREE.MeshBasicMaterial({ map: lanternTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      const k = 0.8 + Math.random() * 1.2;
      m.scale.setScalar(k);
      m.position.set(-40 + Math.random() * 80, -14 + Math.random() * 40, -8 - Math.random() * 40);
      m.userData = { v: 0.4 + Math.random() * 0.8, ph: Math.random() * 6 };
      s.add(m);
      this.lanterns.push(m);
    }

    // golden sparkles in the air
    const n = 260;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = -30 + Math.random() * 60;
      pos[i * 3 + 1] = -10 + Math.random() * 30;
      pos[i * 3 + 2] = -4 - Math.random() * 30;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.dust = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.22, map: glowTexture('rgba(255,240,180,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffd98a }));
    s.add(this.dust);
  }

  buildDragon() {
    const N = (this.dragonN = 70);
    const seg = new THREE.SphereGeometry(1, 18, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.35, emissive: 0x3a0000 });
    const body = (this.dragonBody = new THREE.InstancedMesh(seg, mat, N));
    const cRed = new THREE.Color(0xd4202a);
    const cGold = new THREE.Color(0xffc53a);
    for (let i = 0; i < N; i++) body.setColorAt(i, i % 5 === 0 ? cGold : cRed);
    this.scene.add(body);
    const spikes = (this.dragonSpikes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.4, 1.1, 6), new THREE.MeshStandardMaterial({ color: 0xffc53a, metalness: 0.8, roughness: 0.3, emissive: 0x402000 }), N));
    this.scene.add(spikes);
    const [c, g] = canvas(256, 256);
    g.font = `210px ${EMOJI}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('🐲', 128, 140);
    this.dragonHead = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex(c), transparent: true, depthWrite: false }));
    this.scene.add(this.dragonHead);
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,120,60,0.9)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.dragonGlow = glow;
    this.scene.add(glow);
    this.dragonT = 0;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._head = new THREE.Vector3();
    this._ahead = new THREE.Vector3();
  }

  dragonAt(a, near, out) {
    const z = -24 + 7 * Math.cos(a) + near * 14;
    return out.set(22 * Math.sin(a) * (1 - near * 0.45), 8.5 + 3.5 * Math.sin(2 * a + 0.5) + 1.2 * Math.sin(5 * a) - near * 3, z);
  }

  updateDragon(dt) {
    this.dragonT += dt * (0.2 + this.boost * 0.5 + this.mode * 0.1);
    const near = this.boost;
    for (let i = 0; i < this.dragonN; i++) {
      const a = this.dragonT - i * 0.042;
      this.dragonAt(a, near, this._v);
      const r = i < 3 ? 1.05 : 1.15 * Math.pow(1 - i / this.dragonN, 0.7) + 0.12;
      this._s.set(r, r, r);
      this._m.compose(this._v, this._q.identity(), this._s);
      this.dragonBody.setMatrixAt(i, this._m);
      const sk = i % 2 === 0 && i > 2 ? r * 0.9 : 0;
      this._s.set(sk, sk, sk);
      this._v.y += r * 0.9;
      this._m.compose(this._v, this._q.identity(), this._s);
      this.dragonSpikes.setMatrixAt(i, this._m);
    }
    this.dragonBody.instanceMatrix.needsUpdate = true;
    this.dragonSpikes.instanceMatrix.needsUpdate = true;
    const head = this.dragonAt(this.dragonT + 0.03, near, this._head);
    const ahead = this.dragonAt(this.dragonT + 0.08, near, this._ahead);
    const k = 4.2;
    this.dragonHead.position.set(head.x, head.y + 0.4, head.z + 0.8);
    this.dragonHead.scale.set(ahead.x > head.x ? -k : k, k, 1);
    this.dragonGlow.position.set(head.x, head.y, head.z + 0.5);
    this.dragonGlow.scale.setScalar(9 + this.mode * 4 + this.boost * 6);
    this.dragonBody.material.emissive.setRGB(0.25 + this.mode * 0.4 + this.boost * 0.6, 0.02 + this.mode * 0.15, 0);
  }

  buildGate() {
    const s = this.scene;
    const gold = new THREE.MeshPhysicalMaterial({ color: 0xffc53a, metalness: 1, roughness: 0.22, clearcoat: 0.5 });
    const red = new THREE.MeshPhysicalMaterial({ color: 0xb3121f, roughness: 0.35, clearcoat: 0.9, clearcoatRoughness: 0.15 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x8e0f1f, roughness: 0.45, metalness: 0.2 });

    // the window: a warm cream panel with lattice cells
    const [pc, pg] = canvas(COLS * 64, ROWS * 64);
    pg.fillStyle = '#fbeede';
    pg.fillRect(0, 0, pc.width, pc.height);
    for (let c = 0; c < COLS; c++) {
      pg.fillStyle = c % 2 ? 'rgba(255,214,170,0.35)' : 'rgba(255,255,255,0.35)';
      pg.fillRect(c * 64, 0, 64, pc.height);
      for (let r = 0; r < ROWS; r++) {
        pg.strokeStyle = 'rgba(190,90,60,0.16)';
        pg.lineWidth = 2;
        roundRect(pg, c * 64 + 5, r * 64 + 5, 54, 54, 10);
        pg.stroke();
      }
    }
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.2, W + 0.2), new THREE.MeshStandardMaterial({ map: tex(pc), roughness: 0.9, emissive: 0xffffff, emissiveMap: tex(pc), emissiveIntensity: 0.25 }));
    panel.position.z = -0.62;
    s.add(panel);

    const ring = (ow, iw, depth, mat, z, bevel = 0.06) => {
      const sh = roundShape(ow, ow, 0.35);
      sh.holes.push(roundShape(iw, iw, 0.2));
      const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 10 });
      const m = new THREE.Mesh(geo, mat);
      m.position.z = z;
      s.add(m);
      return m;
    };
    ring(W + 0.95, W + 0.2, 0.34, gold, -0.6);
    ring(W + 1.6, W + 0.9, 0.24, red, -0.75);

    // pillars
    const pillarH = 2 * TOP + 2.2;
    const pillar = new THREE.CylinderGeometry(0.34, 0.34, pillarH, 32);
    const band = new THREE.TorusGeometry(0.36, 0.06, 10, 32);
    const px = W / 2 + 1.15;
    for (const sx of [-1, 1]) {
      const p = new THREE.Mesh(pillar, red);
      p.position.set(sx * px, 0.1, -0.4);
      s.add(p);
      for (const y of [-TOP - 0.7, -TOP - 0.45, TOP + 0.6, TOP + 0.85]) {
        const b = new THREE.Mesh(band, gold);
        b.rotation.x = Math.PI / 2;
        b.position.set(sx * px, y, -0.4);
        s.add(b);
      }
    }

    // pagoda roof with upturned eaves
    const Wr = W / 2 + 2.1;
    const sh = new THREE.Shape();
    sh.moveTo(-Wr, 0.45);
    sh.quadraticCurveTo(-Wr + 0.9, -0.2, -Wr + 2.1, -0.2);
    sh.lineTo(Wr - 2.1, -0.2);
    sh.quadraticCurveTo(Wr - 0.9, -0.2, Wr, 0.45);
    sh.quadraticCurveTo(Wr - 1.3, 0.35, Wr - 2.6, 1.35);
    sh.lineTo(-Wr + 2.6, 1.35);
    sh.quadraticCurveTo(-Wr + 1.3, 0.35, -Wr, 0.45);
    const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.06, bevelSegments: 2, curveSegments: 16 }), roofMat);
    const roofY = TOP + 1.1;
    roof.position.set(0, roofY, -1.4);
    s.add(roof);
    const ridge = new THREE.Mesh(new THREE.BoxGeometry(2 * (Wr - 2.6) + 0.5, 0.2, 0.5), gold);
    ridge.position.set(0, roofY + 1.45, -0.6);
    s.add(ridge);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(2 * px + 0.9, 0.34, 0.6), red);
    beam.position.set(0, roofY - 0.38, -0.4);
    s.add(beam);
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2 * px + 0.95, 0.07, 0.62), gold);
    for (const dy of [-0.2, 0.18]) {
      const t = trim.clone();
      t.position.set(0, roofY - 0.38 + dy, -0.39);
      s.add(t);
    }
    const ball = new THREE.SphereGeometry(0.16, 16, 12);
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(ball, gold);
      b.position.set(sx * Wr, roofY + 0.5, 0.2);
      s.add(b);
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 8), gold);
      fin.position.set(sx * (Wr - 2.5), roofY + 1.85, -0.6);
      fin.rotation.z = -sx * 0.35;
      s.add(fin);
    }
    // the 龍 plaque
    const [qc, qg] = canvas(256, 256);
    qg.fillStyle = '#7a0a14';
    roundRect(qg, 8, 8, 240, 240, 30);
    qg.fill();
    qg.lineWidth = 14;
    qg.strokeStyle = '#ffc53a';
    qg.stroke();
    qg.fillStyle = '#ffd55a';
    qg.font = '900 170px "Microsoft YaHei","PingFang SC","Noto Sans CJK SC",serif';
    qg.textAlign = 'center';
    qg.textBaseline = 'middle';
    qg.fillText('龍', 128, 136);
    const plaque = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 1.25), new THREE.MeshStandardMaterial({ map: tex(qc), roughness: 0.4, metalness: 0.2, emissive: 0xffffff, emissiveMap: tex(qc), emissiveIntensity: 0.3 }));
    // just proud of the roof's front face (-1.4 + 1.6 depth + 0.08 bevel = 0.28), or the two z-fight and flicker
    plaque.position.set(0, roofY + 0.5, 0.34);
    s.add(plaque);

    // base plinth
    const base = new THREE.Mesh(new THREE.BoxGeometry(2 * px + 1.2, 0.55, 1.4), red);
    base.position.set(0, -TOP - 0.95, -0.5);
    s.add(base);
    const baseTrim = new THREE.Mesh(new THREE.BoxGeometry(2 * px + 1.25, 0.09, 1.45), gold);
    baseTrim.position.set(0, -TOP - 0.68, -0.5);
    s.add(baseTrim);
  }

  // ---------- the lever (right of the gate) ----------
  buildLever() {
    const gold = new THREE.MeshPhysicalMaterial({ color: 0xffc53a, metalness: 1, roughness: 0.2, clearcoat: 0.6 });
    const red = new THREE.MeshPhysicalMaterial({ color: 0xff1f3d, roughness: 0.12, clearcoat: 1, emissive: 0x800010, emissiveIntensity: 0.6 });
    this.leverBallMat = red;
    const x = W / 2 + 1.85;
    const y = -0.9;
    const lever = (this.lever = new THREE.Group());
    lever.position.set(x, y, -0.1);
    lever.scale.setScalar(1.35);
    this.scene.add(lever);
    // the housing bolted to the pillar
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.3, 0.5), new THREE.MeshPhysicalMaterial({ color: 0x8e0f1f, roughness: 0.35, clearcoat: 0.9 }));
    plate.position.set(-0.3, 0, -0.1);
    lever.add(plate);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.5, 32), gold);
    hub.rotation.z = Math.PI / 2;
    lever.add(hub);
    const pivot = (this.leverPivot = new THREE.Group());
    lever.add(pivot);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 2.3, 16), gold);
    arm.position.y = 1.15;
    pivot.add(arm);
    const ball = (this.leverBall = new THREE.Mesh(new THREE.SphereGeometry(0.4, 32, 20), red));
    ball.position.y = 2.4;
    pivot.add(ball);
    const glow = (this.leverGlow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: glowTexture('rgba(255,90,120,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })));
    glow.position.set(0, 2.4, 0.3);
    glow.scale.setScalar(1.6);
    pivot.add(glow);
    this.leverParts = [plate, hub, arm, ball];
    this.leverAngle = 0;
    this.leverVel = 0;
    this.leverTarget = 0;
    this.leverHeld = false;
    this.leverTurbo = 0;
    this.ray = new THREE.Raycaster();
  }
  hitsLever(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(v, this.camera);
    // a fat hit zone around the ball so it's easy to grab on phones
    if (this.ray.intersectObjects(this.leverParts, false).length) return true;
    const p = this.leverBall.getWorldPosition(new THREE.Vector3());
    return this.ray.ray.distanceToPoint(p) < 0.75;
  }
  // true while the held lever makes everything go turbo
  setLeverTurbo(on) {
    this.leverTurbo = on ? 1 : 0;
  }
  updateLever(dt, t) {
    // springy: snaps down fast, wobbles back up on release
    const k = this.leverTarget ? 900 : 260;
    this.leverVel += (this.leverTarget - this.leverAngle) * k * dt;
    this.leverVel *= Math.pow(this.leverTarget ? 0.0005 : 0.02, dt);
    this.leverAngle += this.leverVel * dt;
    this.leverPivot.rotation.x = this.leverAngle * 1.25;
    const pulse = this.leverTurbo ? 0.6 + 0.4 * Math.sin(t * 22) : 0.35 + 0.15 * Math.sin(t * 3);
    this.leverBallMat.emissiveIntensity = 0.5 + pulse;
    this.leverGlow.material.opacity = pulse;
    this.leverGlow.scale.setScalar(1.4 + pulse * (this.leverTurbo ? 1.8 : 0.6));
    if (this.leverTurbo && Math.random() < dt * 30) {
      this.burst(this.leverBall.getWorldPosition(new THREE.Vector3()), Math.random() < 0.5 ? '#ffd23f' : '#ff3d6a', 2, 0.5);
    }
  }

  // ---------- multiplier spots ----------
  buildSpots() {
    this.spotTex = new Map();
    const plane = new THREE.PlaneGeometry(0.96, 0.96);
    const glowPlane = new THREE.PlaneGeometry(1.5, 1.5);
    const glowMap = glowTexture('rgba(255,255,255,0.9)');
    this.spots = Array.from({ length: COLS }, (_, c) =>
      Array.from({ length: ROWS }, (_, r) => {
        const m = new THREE.Mesh(plane, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
        m.position.set(xOf(c), yOf(r), -0.5);
        m.visible = false;
        // a soft pulsing halo behind each multiplier tile
        const glow = new THREE.Mesh(glowPlane, new THREE.MeshBasicMaterial({ map: glowMap, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
        glow.position.set(xOf(c), yOf(r), -0.55);
        glow.visible = false;
        this.scene.add(glow);
        m.userData = { v: 0, glow, ph: Math.random() * 6.28 };
        this.scene.add(m);
        return m;
      }),
    );
  }
  // colour tiers: gold ×2–4, pink ×8–16, purple ×32–64, blue ×128–256, rainbow ×512+
  spotTier(v) {
    if (v >= 512) return { a: '#fff0ff', b: '#ff4fd8', edge: '#5ab4ff', glow: '#ff9af0', rainbow: true };
    if (v >= 128) return { a: '#d8f4ff', b: '#3d8bff', edge: '#1a2a9a', glow: '#6ac8ff' };
    if (v >= 32) return { a: '#f0dcff', b: '#9b3dff', edge: '#3a0a8a', glow: '#c77dff' };
    if (v >= 8) return { a: '#ffe0ee', b: '#ff3d8a', edge: '#8a0a3a', glow: '#ff6ab0' };
    return { a: '#fff6c8', b: '#ffb020', edge: '#a0520a', glow: '#ffc53a' };
  }
  spotTexture(v) {
    if (this.spotTex.has(v)) return this.spotTex.get(v);
    const S = 256;
    const [c, g] = canvas(S, S);
    if (v === 1) {
      // marked: a gentle golden frame with corner studs
      g.fillStyle = 'rgba(255,200,90,0.22)';
      roundRect(g, 8, 8, S - 16, S - 16, 30);
      g.fill();
      g.lineWidth = 7;
      g.strokeStyle = 'rgba(255,190,60,0.9)';
      g.stroke();
      g.fillStyle = '#ffd76a';
      for (const [x, y] of [[26, 26], [S - 26, 26], [26, S - 26], [S - 26, S - 26]]) {
        g.beginPath();
        g.arc(x, y, 7, 0, Math.PI * 2);
        g.fill();
      }
    } else {
      const t = this.spotTier(v);
      // tile: glassy radial fill, inner ring, lattice sparkle
      const fill = g.createRadialGradient(S / 2, S * 0.42, 10, S / 2, S / 2, S * 0.72);
      fill.addColorStop(0, t.a);
      fill.addColorStop(0.55, t.b);
      fill.addColorStop(1, t.edge);
      g.fillStyle = fill;
      roundRect(g, 6, 6, S - 12, S - 12, 32);
      g.fill();
      if (t.rainbow) {
        const rb = g.createLinearGradient(0, 0, S, S);
        ['#ff3d6a', '#ffd23f', '#3dff8a', '#5ab4ff', '#c77dff'].forEach((col, i) => rb.addColorStop(i / 4, col));
        g.globalAlpha = 0.55;
        g.fillStyle = rb;
        g.fill();
        g.globalAlpha = 1;
      }
      g.lineWidth = 8;
      g.strokeStyle = '#fff6d8';
      g.stroke();
      g.lineWidth = 3;
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      roundRect(g, 22, 22, S - 44, S - 44, 22);
      g.stroke();
      // top gloss
      const gloss = g.createLinearGradient(0, 6, 0, S * 0.5);
      gloss.addColorStop(0, 'rgba(255,255,255,0.55)');
      gloss.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gloss;
      roundRect(g, 14, 12, S - 28, S * 0.42, 26);
      g.fill();
      // compact badge in the top-left corner, peeking out beside the symbol
      const txt = `×${v}`;
      g.font = `900 ${txt.length > 4 ? 30 : 36}px Cinzel, Georgia, serif`;
      const w = Math.max(78, g.measureText(txt).width + 26);
      const bx = 8;
      g.fillStyle = 'rgba(40,4,20,0.9)';
      roundRect(g, bx, 8, w, 50, 25);
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#ffd76a';
      g.stroke();
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const tg = g.createLinearGradient(0, 14, 0, 56);
      tg.addColorStop(0, '#ffffff');
      tg.addColorStop(0.5, '#fff0a0');
      tg.addColorStop(1, t.glow);
      g.lineWidth = 6;
      g.strokeStyle = '#2a0010';
      g.strokeText(txt, bx + w / 2, 35);
      g.fillStyle = tg;
      g.fillText(txt, bx + w / 2, 35);
    }
    const tx = tex(c);
    this.spotTex.set(v, tx);
    return tx;
  }
  setSpot(c, r, v) {
    const m = this.spots[c][r];
    const prev = m.userData.v;
    const glow = m.userData.glow;
    m.userData.v = v;
    if (!v) {
      m.visible = false;
      glow.visible = false;
      return;
    }
    // only the first map needs a shader rebuild; swapping one texture for another doesn't
    if (!m.material.map) m.material.needsUpdate = true;
    m.material.map = this.spotTexture(v);
    m.material.opacity = 1;
    m.visible = true;
    glow.visible = v >= 2;
    if (v >= 2) glow.material.color.set(this.spotTier(v).glow);
    if (v !== prev) {
      this.tween(360, (u) => m.scale.setScalar(1 + 0.5 * Math.sin(u * Math.PI) * (1 - u * 0.4)));
      if (v >= 2) {
        const col = this.spotTier(v).glow;
        this.flash(m.position, col, 1.2 + Math.log2(v) * 0.18);
        this.burst(m.position, col, 6 + Math.log2(v) * 2, 0.7);
      }
    }
  }
  resetSpots() {
    for (const col of this.spots) for (const m of col) {
      if (!m.visible) continue;
      const glow = m.userData.glow;
      glow.visible = false;
      this.tween(300, (u) => {
        m.material.opacity = 1 - u;
        if (u >= 1) {
          m.visible = false;
          m.userData.v = 0;
          m.material.opacity = 1;
        }
      });
    }
  }
  pulseSpots(t) {
    for (const col of this.spots) for (const m of col) {
      const { v, glow, ph } = m.userData;
      if (!glow.visible) continue;
      const k = Math.min(1, 0.35 + Math.log2(v) / 10);
      const s = 0.5 + 0.5 * Math.sin(t * (2.5 + Math.log2(v) * 0.4) + ph);
      glow.material.opacity = k * (0.45 + 0.55 * s);
      glow.scale.setScalar(0.95 + 0.25 * s * k);
    }
  }
  // the multiplier-spot labels sit at the top of the tile, so they stay readable behind symbols
  spotValue(c, r) {
    return this.spots[c][r].userData.v;
  }

  // ---------- particles ----------
  buildSparks() {
    const N = (this.sparkN = 900);
    const mesh = (this.sparks = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.07), new THREE.MeshBasicMaterial({ toneMapped: false }), N));
    mesh.frustumCulled = false;
    this.sparkData = Array.from({ length: N }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3(), s: 1 }));
    const zero = new THREE.Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < N; i++) {
      mesh.setMatrixAt(i, zero);
      mesh.setColorAt(i, new THREE.Color(1, 1, 1));
    }
    this.scene.add(mesh);
    this.sparkNext = 0;
    this.flashTex = glowTexture('rgba(255,255,255,1)');
    this.flashes = Array.from({ length: 16 }, () => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      m.visible = false;
      this.scene.add(m);
      return m;
    });
    this.flashNext = 0;
    this.orbs = Array.from({ length: 24 }, () => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ map: this.flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
      m.visible = false;
      this.scene.add(m);
      return m;
    });
    this.orbNext = 0;
  }
  burst(pos, color, n = 14, power = 1) {
    const col = (this._burstColor ||= new THREE.Color()).set(color);
    const white = (this._white ||= new THREE.Color(1, 1, 1));
    for (let i = 0; i < n; i++) {
      const k = this.sparkNext++ % this.sparkN;
      const d = this.sparkData[k];
      d.life = 1;
      d.p.copy(pos);
      const a = Math.random() * Math.PI * 2;
      const sp = (2 + Math.random() * 5) * power;
      d.v.set(Math.cos(a) * sp, Math.sin(a) * sp + 2, 1 + Math.random() * 3);
      d.s = 0.6 + Math.random() * 1.2;
      this.sparks.setColorAt(k, Math.random() < 0.25 ? white : col);
    }
    this.sparks.instanceColor.needsUpdate = true;
  }
  // 🎆 bursts all around the gate
  fireworks(n = 10) {
    const colors = ['#ffd23f', '#ff3d6a', '#3dff8a', '#5ab4ff', '#ffffff', '#ff8a1a', '#c77dff'];
    for (let i = 0; i < n; i++) {
      this.tween(1, () => {}, i * 140 + Math.random() * 120).then(() => {
        const p = new THREE.Vector3((Math.random() - 0.5) * 13, -1 + Math.random() * 7, 0.8);
        const col = colors[(Math.random() * colors.length) | 0];
        this.burst(p, col, 34, 1.7);
        this.flash(p, col, 3.2);
      });
    }
  }
  flash(pos, color = '#ffffff', size = 1.6) {
    const m = this.flashes[this.flashNext++ % this.flashes.length];
    m.material.color.set(color);
    m.position.set(pos.x, pos.y, 0.6);
    m.visible = true;
    this.tween(420, (u) => {
      m.scale.setScalar(size * (0.4 + u * 1.4));
      m.material.opacity = 1 - u;
      if (u >= 1) m.visible = false;
    });
  }

  // ---------- tweens ----------
  tween(dur, fn, delay = 0) {
    return new Promise((res) => this.anims.push({ start: performance.now() + delay, dur: Math.max(1, dur), fn, res }));
  }
  wait(ms) {
    return this.tween(ms / this.speed, () => {});
  }

  // ---------- symbols on the grid ----------
  make(id) {
    const o = this.kinds[id].clone();
    const part = (n) => o.getObjectByName(n);
    o.userData = { id, ph: Math.random() * 6.28, base: this.kinds[id].scale.x, flame: part('flame'), paw: part('paw'), spark: part('spark'), swing: part('swing'), tail: part('tail'), zzz: part('zzz') };
    this.board.add(o);
    return o;
  }
  remove(o) {
    this.board.remove(o);
  }
  setGrid(grid) {
    for (const col of this.cells) for (const o of col) o && this.remove(o);
    this.cells = grid.map((col, c) =>
      col.map((id, r) => {
        const o = this.make(id);
        o.position.set(xOf(c), yOf(r), 0);
        return o;
      }),
    );
  }
  // gravity fall with a squashy little bounce at the end
  fall(o, y0, y1, u) {
    const b = o.userData.base;
    if (u < 0.72) {
      const k = u / 0.72;
      o.position.y = y0 + (y1 - y0) * k * k;
      o.scale.set(b * 0.94, b * 1.08, b);
    } else {
      const k = (u - 0.72) / 0.28;
      const w = Math.sin(k * Math.PI);
      o.position.y = y1 + w * 0.09;
      const q = Math.sin(k * Math.PI * 2) * (1 - k);
      o.scale.set(b * (1 + 0.12 * q), b * (1 - 0.16 * q), b);
    }
  }
  dropOut() {
    const ps = [];
    this.cells.forEach((col, c) =>
      col.forEach((o) => {
        if (!o) return;
        const y0 = o.position.y;
        ps.push(
          this.tween(300 / this.speed, (u) => {
            o.position.y = y0 - u * u * (ROWS * CELL + 1.5);
            if (u >= 1) this.remove(o);
          }, (c * 40) / this.speed),
        );
      }),
    );
    this.cells = Array.from({ length: COLS }, () => Array(ROWS).fill(null));
    return Promise.all(ps);
  }
  dropIn(grid, onLand, onEach) {
    const ps = [];
    grid.forEach((col, c) =>
      col.forEach((id, r) => {
        const o = this.make(id);
        const y1 = yOf(r);
        const y0 = y1 + ROWS * CELL + 0.4;
        o.position.set(xOf(c), y0, 0);
        this.cells[c][r] = o;
        const p = this.tween(380 / this.speed, (u) => this.fall(o, y0, y1, u), (c * 75 + (ROWS - 1 - r) * 30) / this.speed);
        if (r === ROWS - 1) p.then(() => onLand?.(c));
        if (onEach) p.then(() => onEach(c, r, id));
        ps.push(p);
      }),
    );
    return Promise.all(ps);
  }
  async explode(cells, color) {
    const objs = cells.map(([c, r]) => this.cells[c][r]).filter(Boolean);
    await this.tween(420 / this.speed, (u) =>
      objs.forEach((o) => {
        const b = o.userData.base;
        o.scale.setScalar(b * (1 + 0.3 * Math.sin(Math.min(u * 1.8, 1) * Math.PI * 0.5) + 0.05 * Math.sin(u * 50)));
        o.rotation.z = Math.sin(u * 38) * 0.14 * u;
      }),
    );
    for (const [c, r] of cells) {
      const o = this.cells[c][r];
      if (!o) continue;
      this.burst(o.position, color, 12);
      this.flash(o.position, color, 1.5);
      this.remove(o);
      this.cells[c][r] = null;
    }
  }
  tumble(step, onLand) {
    const ps = [];
    for (let c = 0; c < COLS; c++) {
      const keep = this.cells[c].filter(Boolean);
      const n = ROWS - keep.length;
      if (!n) continue;
      const col = Array(ROWS).fill(null);
      const delay = (c * 35) / this.speed;
      const dur = (240 + n * 55) / this.speed;
      keep.forEach((o, i) => {
        const to = n + i;
        col[to] = o;
        const y0 = o.position.y;
        const y1 = yOf(to);
        if (Math.abs(y0 - y1) > 0.01) ps.push(this.tween(dur, (u) => this.fall(o, y0, y1, u), delay));
      });
      step.fresh
        .filter((f) => f.c === c)
        .forEach((f) => {
          const o = this.make(f.sym);
          const y1 = yOf(f.r);
          const y0 = y1 + n * CELL + 0.3;
          o.position.set(xOf(c), y0, 0);
          col[f.r] = o;
          const p = this.tween(dur, (u) => this.fall(o, y0, y1, u), delay + ((n - 1 - f.r) * 25) / this.speed);
          if (f.r === n - 1) p.then(() => onLand?.(c));
          ps.push(p);
        });
      this.cells[c] = col;
    }
    return Promise.all(ps);
  }
  // pulse a bunch of cells (the scatters) for a moment
  highlight(cells, color = '#ffe08a') {
    const objs = cells.map(([c, r]) => this.cells[c][r]).filter(Boolean);
    objs.forEach((o) => this.flash(o.position, color, 2.2));
    return this.tween(1200, (u) =>
      objs.forEach((o) => {
        const b = o.userData.base;
        o.scale.setScalar(b * (1 + 0.25 * Math.abs(Math.sin(u * Math.PI * 4))));
        if (u >= 1) o.scale.setScalar(b);
      }),
    );
  }
  // ---------- ✨ marker moves ----------
  cellPos(c, r) {
    return new THREE.Vector3(xOf(c), yOf(r), 0.4);
  }
  /** Replace whatever is at (c, r) with a new symbol, popping it in. */
  swap(c, r, id, color = '#ffffff') {
    const old = this.cells[c][r];
    if (old) this.remove(old);
    const o = this.make(id);
    o.position.set(xOf(c), yOf(r), 0);
    this.cells[c][r] = o;
    this.flash(o.position, color, 1.7);
    this.burst(o.position, color, 10, 0.8);
    const b = o.userData.base;
    return this.tween(340 / this.speed, (u) => o.scale.setScalar(b * (u < 1 ? 0.3 + 0.7 * u + Math.sin(u * Math.PI) * 0.4 : 1)));
  }
  // one object thrown out of a blast, spinning and shrinking
  fling(o, from) {
    const v = o.position.clone().sub(from).setZ(0);
    if (v.lengthSq() < 1e-4) v.set(Math.random() - 0.5, 1, 0);
    v.normalize().multiplyScalar(2.4);
    const p0 = o.position.clone();
    const b = o.userData.base;
    const spin = (Math.random() - 0.5) * 14;
    return this.tween(460 / this.speed, (u) => {
      o.position.set(p0.x + v.x * u, p0.y + v.y * u + 1.6 * u - 3.2 * u * u, p0.z + 2 * u);
      o.rotation.z = u * spin;
      o.scale.setScalar(b * (1 - u * 0.85));
      if (u >= 1) this.remove(o);
    });
  }
  /** 🧨 each firecracker in the chain goes off in turn, throwing out what's around it. */
  async blast(chain, removed, onBang) {
    const left = new Set(removed.map(([c, r]) => c * ROWS + r));
    const ps = [];
    for (const [c, r] of chain) {
      const p = this.cellPos(c, r);
      this.flash(p, '#ffb020', 3.6);
      this.flash(p, '#ffffff', 1.8);
      this.burst(p, '#ff5a1f', 36, 1.8);
      this.burst(p, '#ffd23f', 18, 1.2);
      this.kick(0.45);
      onBang?.();
      for (let dc = -1; dc <= 1; dc++)
        for (let dr = -1; dr <= 1; dr++) {
          const x = c + dc;
          const y = r + dr;
          if (!left.delete(x * ROWS + y)) continue;
          const o = this.cells[x][y];
          this.cells[x][y] = null;
          if (o) ps.push(this.fling(o, p));
        }
      await this.wait(190);
    }
    await Promise.all(ps);
  }
  /** 🪁 the kites fly off the top, and every copy of their symbol follows them up. */
  kiteAway(kites, color = '#ffffff') {
    const ps = [];
    kites.forEach((k, i) => {
      const kite = this.cells[k.c][k.r];
      this.cells[k.c][k.r] = null;
      const delay = (i * 250) / this.speed;
      if (kite) {
        const p0 = kite.position.clone();
        ps.push(
          this.tween(1300 / this.speed, (u) => {
            kite.position.set(p0.x + Math.sin(u * 9) * 0.5 * u, p0.y + u * u * (TOP + 4 - p0.y), 0.6 * u);
            kite.rotation.z = Math.sin(u * 14) * 0.45;
            if (u >= 1) this.remove(kite);
          }, delay),
        );
      }
      k.cells.forEach(([c, r], j) => {
        const o = this.cells[c][r];
        if (!o) return;
        this.cells[c][r] = null;
        const p0 = o.position.clone();
        const tx = xOf(k.c);
        ps.push(
          this.tween(900 / this.speed, (u) => {
            if (u > 0 && !o.userData.lifted) {
              o.userData.lifted = true;
              this.flash(p0, color, 1.3);
            }
            const e = u * u;
            o.position.set(p0.x + (tx - p0.x) * e * 0.7 + Math.sin(u * 10 + j) * 0.15, p0.y + e * (TOP + 3 - p0.y), p0.z + u);
            o.rotation.z = u * 5;
            if (u >= 1) this.remove(o);
          }, delay + (350 + j * 45) / this.speed),
        );
      });
    });
    return Promise.all(ps);
  }
  /** A glowing orb flies from one point to another (moon gathering, cat waving at a spot…). */
  orb(from, to, color = '#ffe08a', delay = 0, dur = 560) {
    const m = this.orbs[this.orbNext++ % this.orbs.length];
    m.material.color.set(color);
    return this.tween(dur / this.speed, (u) => {
      m.visible = u < 1;
      m.position.lerpVectors(from, to, 1 - (1 - u) * (1 - u));
      m.position.y += Math.sin(u * Math.PI) * 0.9;
      m.position.z = 0.9;
      m.scale.setScalar(0.55 + Math.sin(u * Math.PI) * 0.6);
      if (u >= 1) this.flash(to, color, 1.5);
    }, delay / this.speed);
  }
  /** 🐱 make the cat at (c, r) wave like it means it. */
  wave(c, r) {
    const o = this.cells[c][r];
    if (!o) return;
    o.userData.wave = performance.now() + 800 / this.speed;
    this.flash(o.position, '#ffd23f', 1.4);
  }
  /** 🔔 every gong on the board rings. */
  ringGongs() {
    for (const col of this.cells)
      for (const o of col) {
        if (o?.userData.id !== 'gong') continue;
        o.userData.ring = performance.now() + 1400;
        this.flash(o.position, '#ffd23f', 3);
        this.burst(o.position, '#ffd23f', 24, 1.4);
      }
    this.kick(0.6);
    return this.wait(1000);
  }
  /** 🥚 crack the egg at (c, r) (it's swapped for the cracked one). */
  crack(c, r) {
    this.kick(0.15);
    this.burst(this.cellPos(c, r), '#ffb020', 14, 0.7);
    return this.swap(c, r, 'egg1', '#ffb020');
  }
  /** 🐣 hatch: the egg and its neighbours become wilds, in a little ripple. */
  hatch({ c, r, cells }) {
    const p = this.cellPos(c, r);
    this.flash(p, '#7dffb0', 4);
    this.burst(p, '#3dff8a', 40, 1.6);
    this.burst(p, '#ffffff', 16, 1.2);
    this.kick(0.5);
    return Promise.all(cells.map(([x, y], i) => this.wait(i * 90).then(() => this.swap(x, y, 'wild', '#3dff8a'))));
  }

  cellsOf(id) {
    const out = [];
    this.cells.forEach((col, c) => col.forEach((o, r) => o?.userData.id === id && out.push([c, r])));
    return out;
  }
  // screen position (px, relative to the container) of the centre of some cells
  screenOf(cells) {
    const v = new THREE.Vector3();
    for (const [c, r] of cells) v.add(new THREE.Vector3(xOf(c), yOf(r), 0.4));
    v.divideScalar(Math.max(1, cells.length)).project(this.camera);
    return { x: ((v.x + 1) / 2) * this.W, y: ((1 - v.y) / 2) * this.H };
  }

  // ---------- moods ----------
  kick(amount = 0.25) {
    this.shake = Math.max(this.shake, amount);
  }
  setMode(free) {
    this.modeTarget = free ? 1 : 0;
  }
  swoop() {
    this.boost = 1;
  }

  // ---------- icons for the HTML (paytable, win tally) ----------
  icons(size = 96) {
    if (this._icons) return this._icons;
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    r.setSize(size, size);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    const scene = new THREE.Scene();
    const pm = new THREE.PMREMGenerator(r);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.add(new THREE.HemisphereLight(0xfff0f4, 0x301030, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 2.3);
    key.position.set(3, 6, 10);
    scene.add(key);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    cam.position.set(0, 0, 2.3);
    const out = {};
    for (const id of Object.keys(this.kinds)) {
      const o = this.kinds[id].clone();
      scene.add(o);
      r.render(scene, cam);
      out[id] = r.domElement.toDataURL();
      scene.remove(o);
    }
    pm.dispose();
    r.dispose();
    r.forceContextLoss();
    return (this._icons = out);
  }

  // ---------- loop ----------
  start() {
    if (this.running) return;
    this.running = true;
    this.clock.getDelta();
    this.resize();
    this.renderer.setAnimationLoop(() => this.frame());
  }
  stop() {
    this.running = false;
    this.renderer.setAnimationLoop(null);
  }
  resize() {
    const w = this.container.clientWidth || 1;
    const h = this.container.clientHeight || 1;
    this.W = w;
    this.H = h;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    const cr = this.container.getBoundingClientRect();
    const sr = this.slotEl.getBoundingClientRect();
    const rw = sr.width > 40 ? sr.width : w;
    const rh = sr.height > 40 ? sr.height : h;
    const cx = sr.width > 40 ? sr.left - cr.left + sr.width / 2 : w / 2;
    const cy = sr.height > 40 ? sr.top - cr.top + sr.height / 2 : h / 2;
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    this.dist = Math.max((FIT.h * h) / (2 * tan * rh), (FIT.w * h) / (2 * tan * rw));
    this.camera.aspect = w / h;
    this.camera.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
    this.camera.updateProjectionMatrix();
  }
  // watch the frame rate in half-second windows: slow → render fewer pixels, calm for a while → back up
  adapt(raw) {
    const p = this.perf;
    if (raw > 0.25) return; // a hitch or a hidden tab, not a trend
    p.t += raw;
    p.n++;
    if (p.t < 0.5) return;
    const avg = p.t / p.n;
    p.t = p.n = 0;
    p.best = Math.min(p.best, avg); // ≈ the display's refresh interval
    const min = Math.min(1, this.maxRatio) * 0.75;
    let next = this.ratio;
    if (avg > Math.max(0.024, p.best * 1.5)) {
      next = Math.max(min, this.ratio - 0.25);
      p.calm = 0;
    } else if (avg < p.best * 1.25 + 0.002 && ++p.calm >= 6 && this.ratio < this.maxRatio) {
      next = Math.min(this.maxRatio, this.ratio + 0.25);
      p.calm = 0;
    }
    if (next !== this.ratio) {
      this.ratio = next;
      this.renderer.setPixelRatio(next);
      this.renderer.setSize(this.W, this.H, false);
    }
  }
  frame() {
    const raw = this.clock.getDelta();
    const dt = Math.min(raw, 0.05);
    const t = this.clock.elapsedTime;
    const now = performance.now();
    this.adapt(raw);

    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      const u = (now - a.start) / a.dur;
      if (u < 0) continue;
      a.fn(Math.min(u, 1));
      if (u >= 1) {
        this.anims.splice(i, 1);
        a.res();
      }
    }

    // camera: parallax + shake
    const p = this.pointer;
    p.sx += (p.x - p.sx) * 0.04;
    p.sy += (p.y - p.sy) * 0.04;
    this.shake *= 0.9;
    const sh = this.shake;
    this.camera.position.set(FIT.cx + p.sx * 1.2 + (Math.random() - 0.5) * sh, FIT.cy - p.sy * 0.7 + (Math.random() - 0.5) * sh, this.dist);
    this.camera.lookAt(this.target.x + p.sx * 0.3, this.target.y, 0);

    // idle symbol life
    for (const o of this.board.children) {
      const { ph, flame, paw, spark, swing, tail, zzz, wave, ring } = o.userData;
      o.rotation.y = Math.sin(t * 1.3 + ph) * 0.32;
      if (flame) flame.scale.set(1 + Math.sin(t * 9 + ph) * 0.06, 1 + Math.sin(t * 7 + ph) * 0.1, 1);
      if (paw) {
        const hard = wave > now;
        paw.rotation.z = 0.25 + Math.sin(t * (hard ? 18 : 5) + ph) * (hard ? 0.75 : 0.35);
      }
      if (spark) spark.scale.setScalar(0.6 + Math.random() * 0.7);
      if (tail) tail.rotation.z = Math.sin(t * 4 + ph) * 0.3;
      if (zzz) {
        const k = (t * 0.45 + ph) % 1;
        zzz.position.y = 0.3 + k * 0.22;
        zzz.scale.setScalar(0.5 + k * 0.7);
      }
      if (swing) swing.rotation.x = ring > now ? Math.sin(t * 16) * 0.6 * ((ring - now) / 1400) : 0;
    }

    // sparks
    let any = false;
    for (let i = 0; i < this.sparkN; i++) {
      const d = this.sparkData[i];
      if (d.life <= 0) continue;
      any = true;
      d.life -= dt * 1.4;
      d.v.y -= 9 * dt;
      d.p.addScaledVector(d.v, dt);
      const s = Math.max(0, d.life) * d.s;
      this._q.setFromEuler(this._e.set(t * 5 + i, t * 3, 0));
      this._m.compose(d.p, this._q, this._s.set(s, s, s));
      this.sparks.setMatrixAt(i, this._m);
    }
    if (any || this._sparksWere) this.sparks.instanceMatrix.needsUpdate = true;
    this._sparksWere = any;

    // sky life
    this.mode += (this.modeTarget - this.mode) * 0.02;
    this.boost *= Math.pow(0.35, dt);
    this.sky.material.uniforms.uFree.value = this.mode;
    for (const c of this.clouds) {
      c.position.x += c.userData.v * dt * (1 + this.boost * 3);
      if (c.position.x > 100) c.position.x = -100;
    }
    for (const l of this.lanterns) {
      l.position.y += l.userData.v * dt;
      l.position.x += Math.sin(t * 0.6 + l.userData.ph) * dt * 0.3;
      if (l.position.y > 28) l.position.y = -14;
    }
    this.dust.rotation.y = Math.sin(t * 0.05) * 0.1;
    this.updateDragon(dt);
    this.updateLever(dt, t);
    this.pulseSpots(t);

    this.renderer.render(this.scene, this.camera);
  }
}
