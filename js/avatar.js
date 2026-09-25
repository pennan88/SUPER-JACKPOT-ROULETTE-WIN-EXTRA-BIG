// 🧑 YOU, in 3D: a character built exactly like Dave (same chunky shapes, same materials),
// customisable in Settings, with a store full of hats and bling to spend your winnings on.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Stage3D } from './kitchen3d.js';
import { caseMaterial, wallpaperTexture } from './skins.js';
import { buildShelf, disposeTree } from './trophies3d.js';

const rand = (a, b) => a + Math.random() * (b - a);

// ---------- what you can change for free ----------
export const BASE = {
  skin: ['#ffdbac', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5c3a1e'],
  hair: [
    ['bald', 'Bald'],
    ['short', 'Short'],
    ['spiky', 'Spiky'],
    ['long', 'Long'],
    ['afro', 'Afro'],
    ['mohawk', 'Mohawk'],
    ['bun', 'Bun'],
    ['ponytail', 'Ponytail'],
    ['buzz', 'Buzz cut'],
  ],
  hairColor: ['#1c120c', '#6b4423', '#b5651d', '#e8c46a', '#d9d9d9', '#c0182a', '#2de0ff'],
  facial: [
    ['none', 'None'],
    ['stubble', 'Stubble'],
    ['mustache', 'Mustache'],
    ['beard', 'Beard'],
    ['goatee', 'Goatee'],
  ],
  face: [
    ['grin', '😁 Grin'],
    ['smirk', '😏 Smirk'],
    ['shock', '😮 Shocked'],
    ['cool', '😌 Cool'],
  ],
  shirt: ['#dce8f6', '#1f1f24', '#c0182a', '#2e8b3e', '#2d5aa8', '#ff9ad0'],
  build: [
    ['slim', 'Slim'],
    ['regular', 'Regular'],
    ['big', 'Big'],
  ],
  pants: ['#2f4a78', '#1f1f24', '#7a5a3a', '#c9b28a', '#8b1c2c', '#2e6b3e'],
  shoes: ['#f4f4f4', '#0a0a0a', '#8a5a2b', '#c0182a', '#e8c35a'],
};

// ---------- the store ----------
// slot: which part of you it goes on. price 0 = you start with it.
export const CATALOG = [
  { id: 'tshirt', slot: 'top', name: 'T-shirt', emoji: '👕', price: 0 },
  { id: 'hawaiian', slot: 'top', name: 'Hawaiian Shirt', emoji: '🌺', price: 200 },
  { id: 'tux', slot: 'top', name: 'Tuxedo', emoji: '🤵', price: 1500 },
  { id: 'sequin', slot: 'top', name: 'Sequin Jacket', emoji: '🪩', price: 2500 },
  { id: 'goldsuit', slot: 'top', name: 'Solid Gold Suit', emoji: '🥇', price: 25000 },

  { id: 'party', slot: 'hat', name: 'Party Hat', emoji: '🎉', price: 50 },
  { id: 'cone', slot: 'hat', name: 'Traffic Cone', emoji: '🚧', price: 100, note: 'From the hotel room. Nobody asked.' },
  { id: 'cap', slot: 'hat', name: 'Lucky Cap', emoji: '🧢', price: 120 },
  { id: 'chef', slot: 'hat', name: 'Chef Hat', emoji: '👨‍🍳', price: 150, note: 'Earned in the kitchen. Or bought.' },
  { id: 'cowboy', slot: 'hat', name: 'Cowboy Hat', emoji: '🤠', price: 250 },
  { id: 'tophat', slot: 'hat', name: 'Top Hat', emoji: '🎩', price: 500 },
  { id: 'davetie', slot: 'hat', name: "Dave's Tie", emoji: '👔', price: 777, note: 'Worn round the head. As Dave intended.' },
  { id: 'crown', slot: 'hat', name: 'High Roller Crown', emoji: '👑', price: 5000 },

  { id: 'aviators', slot: 'glasses', name: 'Aviators', emoji: '😎', price: 120 },
  { id: 'shutters', slot: 'glasses', name: 'Shutter Shades', emoji: '🕶️', price: 300 },
  { id: 'hearts', slot: 'glasses', name: 'Heart Glasses', emoji: '😍', price: 400 },
  { id: 'monocle', slot: 'glasses', name: 'Monocle', emoji: '🧐', price: 800 },

  { id: 'lei', slot: 'neck', name: 'Flower Lei', emoji: '🌸', price: 60 },
  { id: 'bowtie', slot: 'neck', name: 'Bow Tie', emoji: '🎀', price: 80 },
  { id: 'chain', slot: 'neck', name: 'Gold Chain', emoji: '⛓️', price: 1000 },

  { id: 'tank', slot: 'top', name: 'Tank Top', emoji: '🎽', price: 60, note: 'In your T-shirt colour. Gun show.' },
  { id: 'bathrobe', slot: 'top', name: 'Hotel Bathrobe', emoji: '🛁', price: 180, note: 'Borrowed from the hotel room. Forever.' },
  { id: 'hoodie', slot: 'top', name: 'Hoodie', emoji: '🧥', price: 350 },
  { id: 'tracksuit', slot: 'top', name: 'Tracksuit', emoji: '🏃', price: 450 },
  { id: 'leather', slot: 'top', name: 'Leather Jacket', emoji: '🧥', price: 900, note: 'Cooler than the waiter.' },

  { id: 'beanie', slot: 'hat', name: 'Beanie', emoji: '🧶', price: 80 },
  { id: 'sombrero', slot: 'hat', name: 'Sombrero', emoji: '👒', price: 350 },
  { id: 'viking', slot: 'hat', name: 'Viking Helmet', emoji: '⚔️', price: 600 },
  { id: 'halo', slot: 'hat', name: 'Halo', emoji: '😇', price: 2000, note: 'For the saints of the roulette table.' },

  { id: 'threed', slot: 'glasses', name: '3D Glasses', emoji: '🎬', price: 90, note: 'For watching the wheel in 3D. It already is.' },
  { id: 'stars', slot: 'glasses', name: 'Star Glasses', emoji: '🤩', price: 350 },

  { id: 'medal', slot: 'neck', name: 'Participation Medal', emoji: '🏅', price: 5, note: 'For taking part.' },
  { id: 'necktie', slot: 'neck', name: 'Necktie', emoji: '👔', price: 70, note: 'Worn around the neck, unlike some people.' },
  { id: 'scarf', slot: 'neck', name: 'Scarf', emoji: '🧣', price: 120 },

  { id: 'beer', slot: 'held', name: 'Beer Mug', emoji: '🍺', price: 30, note: "Dave's spare." },
  { id: 'martini', slot: 'held', name: 'Martini', emoji: '🍸', price: 40, note: 'Shaken. Stirred. Carried.' },
  { id: 'rose', slot: 'held', name: 'Rose', emoji: '🌹', price: 60 },
  { id: 'chicken', slot: 'held', name: 'Rubber Chicken', emoji: '🐔', price: 99, note: 'Squeaks. Pays the same.' },
  { id: 'dice', slot: 'held', name: 'Lucky Dice', emoji: '🎲', price: 150, note: 'Luck not included.' },
  { id: 'moneybag', slot: 'held', name: 'Money Bag', emoji: '💰', price: 300, note: 'Contains $300. It was the $300 you paid.' },
  { id: 'mic', slot: 'held', name: 'Gold Microphone', emoji: '🎤', price: 700 },
  { id: 'sparkler', slot: 'held', name: 'Sparkler Bottle', emoji: '🍾', price: 1200, note: 'The bottle-girl special.' },

  { id: 'backpack', slot: 'back', name: 'GrubGrab Backpack', emoji: '🎒', price: 250, note: 'Straight off Marco. He knows.' },
  { id: 'cape', slot: 'back', name: 'Superhero Cape', emoji: '🦸', price: 900 },
  { id: 'wings', slot: 'back', name: 'Angel Wings', emoji: '🪽', price: 1500 },

  // your phone
  { id: 'graphite', slot: 'phoneSkin', name: 'Stock Graphite', emoji: '📱', price: 0 },
  { id: 'cracked', slot: 'phoneSkin', name: 'Cracked Screen', emoji: '💔', price: 50, note: 'It still works. Mostly.' },
  { id: 'banana', slot: 'phoneSkin', name: 'Banana Phone', emoji: '🍌', price: 150, note: 'Ring ring ring ring.' },
  { id: 'leopard', slot: 'phoneSkin', name: 'Leopard Case', emoji: '🐆', price: 300 },
  { id: 'neon', slot: 'phoneSkin', name: 'Neon Case', emoji: '💡', price: 400, note: 'Glows in the dark casino.' },
  { id: 'dave', slot: 'phoneSkin', name: 'Dave Case', emoji: '🍺', price: 777, note: 'Comes with a tiny Dave keychain. He is always with you now.' },
  { id: 'gold', slot: 'phoneSkin', name: 'Solid Gold Case', emoji: '🥇', price: 800 },
  { id: 'diamond', slot: 'phoneSkin', name: 'Diamond Case', emoji: '💎', price: 4000, note: 'Forty-four diamonds. Fake. Like the money.' },

  { id: 'neonwall', slot: 'wallpaper', name: 'Neon Nights', emoji: '🌃', price: 0 },
  { id: 'sunset', slot: 'wallpaper', name: 'Sunset', emoji: '🌅', price: 80 },
  { id: 'jackpotwall', slot: 'wallpaper', name: '777 Jackpot', emoji: '🎰', price: 100 },
  { id: 'space', slot: 'wallpaper', name: 'Deep Space', emoji: '🌌', price: 150 },
  { id: 'selfiewall', slot: 'wallpaper', name: 'Your Best Selfie', emoji: '🤳', price: 200, note: 'Your latest selfie, forever on your home screen.' },
  { id: 'moneywall', slot: 'wallpaper', name: 'Money', emoji: '💵', price: 300 },
  { id: 'davewall', slot: 'wallpaper', name: 'Dave', emoji: '🍺', price: 1, note: 'Why would you do this.' },

  { id: 'chime', slot: 'ringtone', name: 'Classic Chime', emoji: '🔔', price: 0 },
  { id: 'quack', slot: 'ringtone', name: 'Quack', emoji: '🦆', price: 75 },
  { id: 'retro', slot: 'ringtone', name: '8-Bit', emoji: '👾', price: 120 },
  { id: 'jackpottone', slot: 'ringtone', name: 'Jackpot Ding', emoji: '🎰', price: 150, note: 'Every text from Dave feels like a win. It is not.' },
  { id: 'airhorn', slot: 'ringtone', name: 'Air Horn', emoji: '📯', price: 200 },
  { id: 'orchestra', slot: 'ringtone', name: 'Tiny Orchestra', emoji: '🎻', price: 500 },

  // flair
  { id: 'classic', slot: 'winFx', name: 'Classic Coins', emoji: '🪙', price: 0 },
  { id: 'chickens', slot: 'winFx', name: 'Rubber Chickens', emoji: '🐔', price: 250 },
  { id: 'heartsfx', slot: 'winFx', name: 'Hearts', emoji: '💖', price: 300 },
  { id: 'money', slot: 'winFx', name: 'Money Rain', emoji: '💸', price: 500 },
  { id: 'daves', slot: 'winFx', name: 'Tiny Daves', emoji: '🍺', price: 777, note: 'Every win, dozens of tiny Daves.' },
  { id: 'fireworks', slot: 'winFx', name: 'Fireworks', emoji: '🎆', price: 1000 },

  { id: 'wave', slot: 'emote', name: 'Wave', emoji: '👋', price: 0 },
  { id: 'peace', slot: 'emote', name: 'Peace Sign', emoji: '✌️', price: 50 },
  { id: 'thumbsup', slot: 'emote', name: 'Thumbs Up', emoji: '👍', price: 60 },
  { id: 'facepalm', slot: 'emote', name: 'Facepalm', emoji: '🤦', price: 90, note: 'For after the spin.' },
  { id: 'flex', slot: 'emote', name: 'Flex', emoji: '💪', price: 120 },
  { id: 'dab', slot: 'emote', name: 'Dab', emoji: '🙆', price: 150, note: "It's 2016 in the casino." },
  { id: 'moneyrain', slot: 'emote', name: 'Make It Rain', emoji: '💸', price: 400, note: 'Selfies with money falling all around you.' },
  // the hotel room you wake up in, the morning after
  { id: 'motel', slot: 'hotel', name: 'Budget Room', emoji: '🛏️', price: 0, note: 'Comes with a traffic cone.' },
  { id: 'suite', slot: 'hotel', name: 'Gold Suite', emoji: '🛎️', price: 1500, level: 5, note: 'A gold headboard and champagne on ice. See it the morning after.' },
  { id: 'hottub', slot: 'hotel', name: 'Hot Tub Suite', emoji: '🛁', price: 4000, level: 9, note: 'The Gold Suite, plus a bubbling hot tub by the window.' },
  { id: 'tiger', slot: 'hotel', name: 'Penthouse (with Tiger)', emoji: '🐅', price: 12000, level: 14, note: 'Hot tub, chandelier and a pet tiger. Nobody asks where it came from.' },
];
export const SLOTS = [
  ['top', '👕 Outfit'],
  ['hat', '🎩 Hat'],
  ['glasses', '😎 Glasses'],
  ['neck', '⛓️ Neck'],
  ['held', '✋ In hand'],
  ['back', '🦸 Back'],
  ['phoneSkin', '📱 Phone case'],
  ['wallpaper', '🖼️ Wallpaper'],
  ['ringtone', '🔔 Ringtone'],
  ['winFx', '🎉 Win style'],
  ['emote', '🤳 Selfie emote'],
  ['hotel', '🏨 Hotel room'],
];
/** Slots you always have something in (no "None"). */
export const REQUIRED_SLOTS = new Set(['top', 'phoneSkin', 'wallpaper', 'ringtone', 'winFx', 'emote', 'hotel']);

export const DEFAULT_LOOK = {
  skin: '#f1c27d',
  hair: 'short',
  hairColor: '#6b4423',
  facial: 'none',
  face: 'grin',
  shirt: '#2d5aa8',
  top: 'tshirt',
  hat: null,
  glasses: null,
  neck: null,
  build: 'regular',
  pants: '#2f4a78',
  shoes: '#f4f4f4',
  held: null,
  back: null,
  phoneSkin: 'graphite',
  wallpaper: 'neonwall',
  ringtone: 'chime',
  winFx: 'classic',
  emote: 'wave',
  hotel: 'motel',
};

// ---------- the model (same build as Dave: root at the waist, feet on the floor at -1.46) ----------
const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...extra });

// Build scales (width, depth) and where the torso's surface is, so things sit ON the body.
const BUILDS = { slim: [0.84, 0.82], regular: [1, 1], big: [1.28, 1.14] };
const TORSO_R = 0.52; // capsule radius
const TORSO_Y = 0.72; // capsule centre (body space)
const TORSO_HALF = 0.4; // half the straight part
const TORSO_DEPTH = 0.78; // depth squash
/** The capsule's radius at body height y (full radius on the straight part, shrinking over the ends). */
function torsoRadiusAt(y) {
  const top = TORSO_Y + TORSO_HALF;
  const bottom = TORSO_Y - TORSO_HALF;
  const dy = y > top ? y - top : y < bottom ? bottom - y : 0;
  return Math.sqrt(Math.max(0, TORSO_R * TORSO_R - dy * dy));
}
/** How far the torso surface is in front of (or behind) the centre line at body height y. */
function torsoSurfaceZ(y, bz) {
  return torsoRadiusAt(y) * TORSO_DEPTH * bz;
}
/** Distance from the centre line to the torso surface at height y, heading in direction (dx, dz). */
function torsoExit(y, dx, dz, bx, bz) {
  const r = torsoRadiusAt(y);
  const rx = r * bx;
  const rz = r * TORSO_DEPTH * bz;
  if (r <= 0) return 0;
  return 1 / Math.sqrt((dx / rx) ** 2 + (dz / rz) ** 2);
}

// Hats that cover the top of the head squash tall hair down to a short cut underneath
const HAT_COVERS = new Set(['party', 'cone', 'cap', 'chef', 'cowboy', 'tophat', 'crown', 'beanie', 'sombrero', 'viking']);
const TALL_HAIR = new Set(['spiky', 'afro', 'mohawk', 'bun']);

function patternTexture(draw, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function topMaterial(look) {
  switch (look.top) {
    case 'hawaiian':
      return new THREE.MeshStandardMaterial({
        roughness: 0.8,
        map: patternTexture((x, n) => {
          x.fillStyle = '#1aa3a3';
          x.fillRect(0, 0, n, n);
          const cols = ['#ff5fa2', '#ffd23f', '#ff7a1a', '#ffffff'];
          for (let i = 0; i < 14; i++) {
            const cx = Math.random() * n;
            const cy = Math.random() * n;
            x.fillStyle = cols[i % cols.length];
            for (let p = 0; p < 5; p++) {
              const a = (p / 5) * Math.PI * 2;
              x.beginPath();
              x.arc(cx + Math.cos(a) * 7, cy + Math.sin(a) * 7, 6, 0, 7);
              x.fill();
            }
            x.fillStyle = '#ffd23f';
            x.beginPath();
            x.arc(cx, cy, 4, 0, 7);
            x.fill();
          }
          x.strokeStyle = '#0d6b3a';
          x.lineWidth = 4;
          for (let i = 0; i < 6; i++) {
            x.beginPath();
            x.moveTo(Math.random() * n, Math.random() * n);
            x.quadraticCurveTo(Math.random() * n, Math.random() * n, Math.random() * n, Math.random() * n);
            x.stroke();
          }
        }),
      });
    case 'tux':
      return mat(0x16161a, { roughness: 0.45 });
    case 'sequin':
      return new THREE.MeshStandardMaterial({
        color: 0xb066ff,
        metalness: 0.6,
        roughness: 0.3,
        map: patternTexture((x, n) => {
          x.fillStyle = '#b066ff';
          x.fillRect(0, 0, n, n);
          for (let i = 0; i < 260; i++) {
            x.fillStyle = `rgba(255,255,255,${Math.random() * 0.7})`;
            x.beginPath();
            x.arc(Math.random() * n, Math.random() * n, 1.6, 0, 7);
            x.fill();
          }
        }),
      });
    case 'goldsuit':
      return new THREE.MeshStandardMaterial({ color: 0xe8c35a, metalness: 1, roughness: 0.22 });
    case 'bathrobe':
      return new THREE.MeshStandardMaterial({
        roughness: 1,
        map: patternTexture((x, n) => {
          x.fillStyle = '#f7f5ef';
          x.fillRect(0, 0, n, n);
          for (let i = 0; i < 900; i++) {
            x.fillStyle = `rgba(180,170,150,${Math.random() * 0.25})`;
            x.fillRect(Math.random() * n, Math.random() * n, 2, 2);
          }
        }),
      });
    case 'hoodie':
      return mat(0x6b5b95, { roughness: 0.9 });
    case 'tracksuit':
      return mat(0xc0182a, { roughness: 0.55 });
    case 'leather':
      return mat(0x1a1a1c, { roughness: 0.32, metalness: 0.15 });
    default:
      return mat(look.shirt);
  }
}

function buildHair(look, head) {
  const m = mat(look.hairColor, { roughness: 0.9 });
  const add = (mesh) => head.add(mesh) && mesh;
  switch (look.hair) {
    case 'short': {
      const cap = add(new THREE.Mesh(new THREE.SphereGeometry(0.445, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.45), m));
      cap.rotation.x = -0.25;
      break;
    }
    case 'spiky':
      for (let i = 0; i < 11; i++) {
        const spike = add(new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.34, 6), m));
        const a = (i / 11) * Math.PI * 2;
        spike.position.set(Math.cos(a) * 0.22, 0.36, Math.sin(a) * 0.22 - 0.04);
        spike.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
      }
      add(new THREE.Mesh(new THREE.SphereGeometry(0.43, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.35), m)).rotation.x = -0.2;
      break;
    case 'long': {
      add(new THREE.Mesh(new THREE.SphereGeometry(0.455, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), m)).rotation.x = -0.3;
      // a curtain of hair round the back and sides (theta 0 faces the front), flaring a little at the ends
      const curtain = add(
        new THREE.Mesh(new THREE.CylinderGeometry(0.455, 0.5, 0.75, 28, 1, true, Math.PI * 0.62, Math.PI * 0.76), new THREE.MeshStandardMaterial({ color: look.hairColor, roughness: 0.9, side: THREE.DoubleSide }))
      );
      curtain.position.y = -0.3;
      break;
    }
    case 'afro':
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        if (Math.sin(a) > 0.45) continue; // keep the face clear
        const puff = add(new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), m));
        const up = i % 2 ? 0.35 : 0.2;
        puff.position.set(Math.cos(a) * 0.38, up, Math.sin(a) * 0.38 - 0.05);
      }
      add(new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), m)).position.set(0, 0.42, -0.05);
      break;
    case 'mohawk':
      for (let i = 0; i < 6; i++) {
        const fin = add(new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.38, 5), m));
        fin.position.set(0, 0.38 + Math.sin((i / 5) * Math.PI) * 0.06, 0.25 - i * 0.12);
        fin.rotation.x = -0.4 + i * 0.16;
      }
      break;
    case 'ponytail': {
      add(new THREE.Mesh(new THREE.SphereGeometry(0.445, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.48), m)).rotation.x = -0.25;
      const tie = add(new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 6, 12), mat(0xc0182a)));
      tie.position.set(0, 0.12, -0.44);
      const tail = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 8), m));
      tail.position.set(0, -0.18, -0.5);
      tail.rotation.x = 0.25;
      break;
    }
    case 'buzz': {
      const shell = add(new THREE.Mesh(new THREE.SphereGeometry(0.43, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), new THREE.MeshStandardMaterial({ color: look.hairColor, roughness: 1, transparent: true, opacity: 0.75 })));
      shell.rotation.x = -0.3;
      break;
    }
    case 'bun': {
      add(new THREE.Mesh(new THREE.SphereGeometry(0.445, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.48), m)).rotation.x = -0.25;
      add(new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10), m)).position.set(0, 0.5, -0.16);
      break;
    }
  }
}

function buildFace(look, head) {
  const dark = mat(0x1a1a1a, { roughness: 0.5 });
  const lip = mat(0x7a1d1d);
  const brow = mat(look.hairColor, { roughness: 0.9 });
  const eye = (x, round) => {
    const e = new THREE.Mesh(round ? new THREE.SphereGeometry(0.055, 10, 8) : new THREE.BoxGeometry(0.12, 0.028, 0.02), dark);
    e.position.set(x, 0.08, 0.39);
    head.add(e);
    return e;
  };
  const browAt = (x, y, rz) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.035, 0.03), brow);
    b.position.set(x, y, 0.39);
    b.rotation.z = rz;
    head.add(b);
  };
  const mouth = (arc, rz, x = 0, r = 0.13) => {
    const g = new THREE.Mesh(new THREE.TorusGeometry(r, 0.026, 8, 20, arc), lip);
    // tilt it back so the lower lip follows the chin instead of sticking out of it
    g.rotation.set(0.45, 0, rz);
    g.position.set(x, -0.14, arc >= Math.PI * 2 ? 0.39 : 0.365);
    head.add(g);
  };
  switch (look.face) {
    case 'smirk':
      eye(-0.15, true);
      eye(0.15, true);
      browAt(-0.15, 0.2, 0.1);
      browAt(0.15, 0.25, 0.35); // one eyebrow up
      mouth(Math.PI * 0.6, Math.PI * 1.15, 0.05, 0.11);
      break;
    case 'shock':
      eye(-0.15, true).scale.setScalar(1.4);
      eye(0.15, true).scale.setScalar(1.4);
      browAt(-0.15, 0.25, -0.1);
      browAt(0.15, 0.25, 0.1);
      mouth(Math.PI * 2, 0, 0, 0.07);
      break;
    case 'cool':
      eye(-0.15, false);
      eye(0.15, false);
      mouth(Math.PI * 0.7, Math.PI * 1.15, 0, 0.1);
      break;
    default:
      eye(-0.15, true);
      eye(0.15, true);
      browAt(-0.15, 0.2, 0.05);
      browAt(0.15, 0.2, -0.05);
      mouth(Math.PI, Math.PI);
  }
  // a nose and ears, like Dave's (minus the drinking)
  const skinDark = mat(new THREE.Color(look.skin).multiplyScalar(0.88));
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), skinDark);
  nose.position.set(0, -0.02, 0.41);
  head.add(nose);
  for (const x of [-0.42, 0.42]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), skinDark);
    ear.scale.set(0.6, 1, 0.8);
    ear.position.set(x, 0, 0);
    head.add(ear);
  }
}

function buildFacialHair(look, head) {
  const m = mat(look.hairColor, { roughness: 0.95 });
  if (look.facial === 'stubble') {
    // lots of tiny specks on a thin shell over the jaw, fading out at the edges
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 96;
    const x = c.getContext('2d');
    const col = new THREE.Color(look.hairColor);
    for (let i = 0; i < 2600; i++) {
      const u = Math.random();
      const v = Math.random();
      const edge = Math.min(u, 1 - u) * 4; // fade towards the ears
      const fade = Math.min(1, edge) * Math.min(1, (1 - v) * 3 + 0.2);
      x.fillStyle = `rgba(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0},${0.7 * fade})`;
      x.fillRect(u * 256, v * 96, 1.6, 1.6);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    // phi = PI/2 faces +z (the front): this shell covers cheeks, jaw and chin
    const shell = new THREE.Mesh(
      new THREE.SphereGeometry(0.424, 32, 12, Math.PI * 0.05, Math.PI * 0.9, Math.PI * 0.55, Math.PI * 0.33),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1 })
    );
    head.add(shell);
  } else if (look.facial === 'mustache') {
    // a handlebar: a thick arch under the nose that curls up at both ends (the waiter would approve)
    const bar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.034, 10, 20, Math.PI), m);
    bar.position.set(0, -0.1, 0.395);
    bar.rotation.x = 0.35;
    head.add(bar);
    for (const side of [-1, 1]) {
      const curl = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.018, 8, 14, Math.PI * 1.4), m);
      curl.position.set(side * 0.125, -0.085, 0.37);
      curl.rotation.set(0.2, side * 0.5, side > 0 ? Math.PI * 1.2 : -Math.PI * 0.6);
      head.add(curl);
    }
  } else if (look.facial === 'goatee') {
    const chin = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), m);
    chin.scale.set(1, 1.3, 0.7);
    chin.position.set(0, -0.31, 0.3);
    head.add(chin);
    const stache = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.04), m);
    stache.position.set(0, -0.08, 0.41);
    head.add(stache);
  } else if (look.facial === 'beard') {
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.44, 24, 14, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.4), m);
    beard.scale.set(1, 1.05, 1.02);
    beard.position.z = 0.02;
    head.add(beard);
  }
}

function buildHat(id, head) {
  if (!id) return;
  const g = new THREE.Group();
  g.position.y = 0.34;
  head.add(g);
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8c35a, metalness: 1, roughness: 0.25 });
  switch (id) {
    case 'party': {
      const tex = patternTexture((x, n) => {
        for (let i = 0; i < 8; i++) {
          x.fillStyle = i % 2 ? '#ff5fa2' : '#ffd23f';
          x.fillRect((i * n) / 8, 0, n / 8, n);
        }
      });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 20), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.7 }));
      cone.position.y = 0.3;
      cone.rotation.z = 0.2;
      g.add(cone);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(0xffffff));
      pom.position.set(-0.055, 0.57, 0);
      g.add(pom);
      break;
    }
    case 'cone': {
      const orange = mat(0xff6a13, { roughness: 0.6 });
      const c = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 24), orange);
      c.position.y = 0.42;
      g.add(c);
      for (const y of [0.3, 0.52]) {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * (1 - y / 0.8) + 0.02, 0.3 * (1 - (y - 0.08) / 0.8) + 0.02, 0.08, 24, 1, true), mat(0xffffff, { roughness: 0.4 }));
        band.position.y = y;
        g.add(band);
      }
      break;
    }
    case 'cap': {
      const red = mat(0xc0182a, { roughness: 0.7 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), red);
      dome.position.y = -0.1;
      g.add(dome);
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 24, 1, false, -Math.PI / 2, Math.PI), red);
      brim.position.set(0, 0.02, 0.32);
      brim.scale.z = 1.2;
      g.add(brim);
      break;
    }
    case 'chef': {
      const white = mat(0xffffff, { roughness: 0.9 });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.22, 24), white);
      band.position.y = 0.05;
      g.add(band);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), white);
        puff.position.set(Math.cos(a) * 0.2, 0.35, Math.sin(a) * 0.2);
        g.add(puff);
      }
      const top = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 10), white);
      top.position.set(0, 0.45, 0); // (position is read-only: set it, never replace it)
      g.add(top);
      break;
    }
    case 'cowboy': {
      const brown = mat(0x8a5a2b, { roughness: 0.8 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.04, 32), brown);
      brim.scale.z = 0.8;
      g.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.4, 24), brown);
      crown.position.y = 0.2;
      g.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.385, 0.385, 0.07, 24, 1, true), mat(0x2a1a0c));
      band.position.y = 0.05;
      g.add(band);
      break;
    }
    case 'tophat': {
      const black = mat(0x111114, { roughness: 0.4 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.04, 32), black);
      g.add(brim);
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.62, 28), black);
      crown.position.y = 0.32;
      g.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.345, 0.345, 0.1, 28, 1, true), mat(0xc0182a));
      band.position.y = 0.08;
      g.add(band);
      break;
    }
    case 'davetie': {
      // exactly the way Dave wears it
      g.position.y = 0;
      const red = mat(0xc0182a, { roughness: 0.6 });
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.05, 8, 32), red);
      band.rotation.x = Math.PI / 2 - 0.2;
      band.position.y = 0.2;
      g.add(band);
      for (const [dz, rz] of [[0, 0.5], [0.08, 0.8]]) {
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, 0.03), red);
        tail.position.set(0.44, 0.02, -0.08 + dz);
        tail.rotation.z = rz;
        g.add(tail);
      }
      break;
    }
    case 'beanie': {
      const knit = mat(0x2e8b3e, { roughness: 1 });
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.455, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), knit);
      dome.position.y = -0.14;
      g.add(dome);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.14, 24, 1, true), mat(0x236b30, { roughness: 1 }));
      cuff.position.y = -0.12;
      g.add(cuff);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), mat(0xffffff, { roughness: 1 }));
      pom.position.y = 0.34;
      g.add(pom);
      break;
    }
    case 'sombrero': {
      const straw = mat(0xd9b25a, { roughness: 0.9 });
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.05, 36), straw);
      g.add(brim);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.06, 8, 36), straw);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.05;
      g.add(rim);
      const crown = new THREE.Mesh(new THREE.ConeGeometry(0.36, 0.6, 24), straw);
      crown.position.y = 0.3;
      g.add(crown);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.34, 0.08, 24, 1, true), mat(0xc0182a));
      band.position.y = 0.08;
      g.add(band);
      break;
    }
    case 'viking': {
      const steel = new THREE.MeshStandardMaterial({ color: 0x9aa0a8, metalness: 0.9, roughness: 0.35 });
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.46, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), steel);
      helm.position.y = -0.12;
      g.add(helm);
      const bone = mat(0xf2ead8, { roughness: 0.6 });
      for (const side of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 12), bone);
        horn.position.set(side * 0.48, 0.12, 0);
        horn.rotation.z = -side * 0.9;
        g.add(horn);
      }
      const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.46, 0.03, 6, 32), steel);
      ridge.rotation.x = Math.PI / 2;
      ridge.position.y = -0.12;
      g.add(ridge);
      break;
    }
    case 'halo': {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.04, 10, 40), new THREE.MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffd24a, emissiveIntensity: 1.4, metalness: 0.5, roughness: 0.3 }));
      halo.rotation.x = Math.PI / 2;
      halo.position.y = 0.35;
      g.add(halo);
      break;
    }
    case 'crown': {
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.34, 0.2, 28, 1, true), gold);
      ring.material = gold.clone();
      ring.material.side = THREE.DoubleSide;
      ring.position.y = 0.05;
      g.add(ring);
      const gems = [0xc0182a, 0x2d5aa8, 0x2e8b3e];
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), gold);
        spike.position.set(Math.cos(a) * 0.35, 0.24, Math.sin(a) * 0.35);
        g.add(spike);
        const gem = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat(gems[i % 3], { roughness: 0.1, metalness: 0.3 }));
        gem.position.set(Math.cos(a) * 0.36, 0.05, Math.sin(a) * 0.36);
        g.add(gem);
      }
      break;
    }
  }
}

function buildGlasses(id, head) {
  if (!id) return;
  const g = new THREE.Group();
  g.position.set(0, 0.08, 0.4);
  head.add(g);
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8c35a, metalness: 1, roughness: 0.25 });
  if (id !== 'monocle') {
    // arms from the outer edge of the frame back along the head to the ears
    const armMat = { threed: mat(0xffffff), shutters: mat(0xffffff), hearts: mat(0xff3d8a), stars: mat(0xff5fa2) }[id] || gold;
    for (const side of [-1, 1]) {
      const from = new THREE.Vector3(side * 0.29, 0, -0.01);
      const to = new THREE.Vector3(side * 0.43, 0.02, -0.4);
      const len = from.distanceTo(to);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.022, len), armMat);
      arm.position.copy(from).lerp(to, 0.5);
      arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), to.clone().sub(from).normalize());
      g.add(arm);
    }
  }
  if (id === 'aviators' || id === 'hearts') {
    const lensMat = id === 'hearts' ? mat(0xff3d8a, { roughness: 0.2, transparent: true, opacity: 0.9 }) : mat(0x111111, { roughness: 0.1, metalness: 0.5 });
    for (const x of [-0.16, 0.16]) {
      const lens = new THREE.Mesh(id === 'hearts' ? heartGeo() : new THREE.SphereGeometry(0.12, 16, 12), lensMat);
      if (id !== 'hearts') lens.scale.set(1, 0.8, 0.25);
      lens.position.x = x;
      g.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), id === 'hearts' ? lensMat : gold);
    g.add(bridge);
  } else if (id === 'shutters') {
    const white = mat(0xffffff, { roughness: 0.5 });
    for (let i = 0; i < 5; i++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.025, 0.03), white);
      slat.position.y = 0.08 - i * 0.04;
      g.add(slat);
    }
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.01), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.15 }));
    frame.position.set(0, 0, -0.01);
    g.add(frame);
  } else if (id === 'threed') {
    const frame = mat(0xffffff, { roughness: 0.6 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.03), frame);
    g.add(bar);
    [[-0.15, 0xff2a2a], [0.15, 0x2a6bff]].forEach(([x, c]) => {
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.13, 0.02), mat(c, { transparent: true, opacity: 0.85, roughness: 0.2 }));
      lens.position.set(x, 0, 0.02);
      g.add(lens);
    });
  } else if (id === 'stars') {
    const star = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.055 : 0.13;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      i ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    const geo = new THREE.ExtrudeGeometry(star, { depth: 0.03, bevelEnabled: false });
    const m = new THREE.MeshStandardMaterial({ color: 0xff5fa2, metalness: 0.6, roughness: 0.25 });
    for (const x of [-0.16, 0.16]) {
      const lens = new THREE.Mesh(geo, m);
      lens.position.x = x;
      g.add(lens);
    }
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), gold);
    g.add(bridge);
  } else if (id === 'monocle') {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 24), gold);
    ring.position.x = 0.15;
    g.add(ring);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.6, 6), gold);
    chain.position.set(0.24, -0.3, -0.05);
    chain.rotation.z = 0.3;
    g.add(chain);
  }
}

function heartGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.1);
  s.bezierCurveTo(0.13, -0.02, 0.12, 0.1, 0.05, 0.1);
  s.bezierCurveTo(0.02, 0.1, 0, 0.07, 0, 0.05);
  s.bezierCurveTo(0, 0.07, -0.02, 0.1, -0.05, 0.1);
  s.bezierCurveTo(-0.12, 0.1, -0.13, -0.02, 0, -0.1);
  return new THREE.ExtrudeGeometry(s, { depth: 0.02, bevelEnabled: false });
}

/** A loop round the neck that hangs down over the chest, lying exactly on the torso surface. */
function neckLoop(bx, bz, drop, n = 48) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2; // 0 = back of the neck, PI = front
    const front = (1 - Math.cos(a)) / 2; // 0 at the back, 1 at the front
    const dx = Math.sin(a);
    const dz = -Math.cos(a);
    const y = 1.5 - Math.pow(front, 2.2) * drop;
    // out along this direction until we leave the torso (never tighter than the neck)
    const out = Math.max(torsoExit(y, dx, dz, bx, bz), 0.2) + 0.03;
    pts.push(new THREE.Vector3(dx * out, y, dz * out));
  }
  return new THREE.CatmullRomCurve3(pts, true);
}

function buildNeck(id, body, bx, bz) {
  if (!id) return;
  const g = new THREE.Group();
  body.add(g);
  const onChest = (y, out = 0.03) => torsoSurfaceZ(y, bz) + out;
  if (id === 'chain') {
    const gold = new THREE.MeshStandardMaterial({ color: 0xe8c35a, metalness: 1, roughness: 0.2 });
    const loop = neckLoop(bx, bz, 0.42);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(loop, 80, 0.03, 8, true), gold));
    const medal = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 24), gold);
    medal.rotation.x = Math.PI / 2;
    medal.position.set(0, 1.5 - 0.42 - 0.09, onChest(0.99, 0.05));
    g.add(medal);
  } else if (id === 'lei') {
    const cols = [0xff5fa2, 0xffd23f, 0xff7a1a, 0xffffff, 0xb066ff];
    const pts = neckLoop(bx, bz, 0.36).getSpacedPoints(22);
    pts.slice(0, 22).forEach((p, i) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), mat(cols[i % cols.length]));
      f.position.copy(p);
      g.add(f);
    });
  } else if (id === 'bowtie' || id === 'necktie' || id === 'medal') {
    if (id === 'bowtie') {
      const red = mat(0xc0182a, { roughness: 0.5 });
      const z = onChest(1.43, 0.06);
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.16, 4), red);
        wing.rotation.z = (side * Math.PI) / 2;
        wing.position.set(side * 0.085, 1.43, z);
        g.add(wing);
      }
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), red);
      knot.position.set(0, 1.43, z + 0.01);
      g.add(knot);
    } else if (id === 'necktie') {
      // red with a gold stripe, so it shows up on any shirt
      const silk = mat(0xc0182a, { roughness: 0.4 });
      const knot = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.09, 0.06), silk);
      knot.position.set(0, 1.44, onChest(1.44, 0.03));
      g.add(knot);
      const top = 1.39;
      const bottom = 0.86;
      const zTop = onChest(top, 0.02);
      const zBottom = onChest(bottom, 0.02);
      const blade = new THREE.Mesh(new THREE.ConeGeometry(0.13, top - bottom, 4), silk);
      blade.scale.z = 0.25;
      blade.rotation.set(Math.PI + Math.atan2(zTop - zBottom, top - bottom), Math.PI / 4, 0);
      blade.position.set(0, (top + bottom) / 2, (zTop + zBottom) / 2);
      g.add(blade);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.02), mat(0xe8c35a));
      stripe.position.set(0, 1.2, onChest(1.2, 0.035));
      stripe.rotation.z = -0.5;
      g.add(stripe);
    } else {
      // participation medal on a red-and-white ribbon
      const ribbon = mat(0xc0182a, { roughness: 0.7 });
      const white = mat(0xffffff, { roughness: 0.7 });
      const medalY = 1.0;
      for (const side of [-1, 1]) {
        const from = new THREE.Vector3(side * 0.17, 1.5, onChest(1.5, 0.02));
        const to = new THREE.Vector3(side * 0.03, medalY + 0.08, onChest(medalY + 0.08, 0.03));
        const strap = new THREE.Mesh(new THREE.BoxGeometry(0.07, from.distanceTo(to), 0.015), side < 0 ? ribbon : white);
        strap.position.copy(from).lerp(to, 0.5);
        strap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), from.clone().sub(to).normalize());
        g.add(strap);
      }
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.025, 24), new THREE.MeshStandardMaterial({ color: 0xc98a3a, metalness: 0.9, roughness: 0.35 }));
      disc.rotation.x = Math.PI / 2;
      disc.position.set(0, medalY, onChest(medalY, 0.04));
      g.add(disc);
    }
  } else if (id === 'scarf') {
    const wool = mat(0xc0182a, { roughness: 1 });
    const wrap = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.09, 10, 24), wool);
    wrap.rotation.x = Math.PI / 2;
    wrap.position.set(0, 1.5, 0.02);
    g.add(wrap);
    const endTop = 1.44;
    const end = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 0.06), wool);
    end.position.set(0.13, endTop - 0.25, onChest(endTop - 0.25, 0.04));
    end.rotation.x = -Math.atan2(onChest(endTop, 0) - onChest(endTop - 0.5, 0), 0.5);
    g.add(end);
  }
}

function buildHeld(id, arm) {
  if (!id) return;
  const g = new THREE.Group();
  g.position.set(0, -1.02, 0.17);
  g.scale.setScalar(1.35);
  arm.add(g);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xdff4ff, roughness: 0.05, transparent: true, opacity: 0.45 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xe8c35a, metalness: 1, roughness: 0.25 });
  switch (id) {
    case 'beer': {
      const beer = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.13, 0.38, 16), new THREE.MeshStandardMaterial({ color: 0xffbe3c, roughness: 0.1, transparent: true, opacity: 0.85 }));
      beer.position.y = -0.1;
      g.add(beer);
      const foam = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.09, 16), mat(0xffffff, { roughness: 0.9 }));
      foam.position.y = 0.12;
      g.add(foam);
      break;
    }
    case 'martini': {
      const bowl = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.18, 20, 1, true), glassMat);
      bowl.rotation.x = Math.PI;
      bowl.position.y = 0.2;
      g.add(bowl);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.24, 6), glassMat);
      stem.position.y = 0;
      g.add(stem);
      const olive = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat(0x6b8e23));
      olive.position.set(0.03, 0.2, 0);
      g.add(olive);
      break;
    }
    case 'rose': {
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), mat(0x2e7d32));
      stem.position.y = 0.05;
      g.add(stem);
      const red = mat(0xc0182a, { roughness: 0.5 });
      for (let i = 0; i < 5; i++) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), red);
        const a = (i / 5) * Math.PI * 2;
        petal.position.set(Math.cos(a) * 0.04, 0.32, Math.sin(a) * 0.04);
        g.add(petal);
      }
      break;
    }
    case 'chicken': {
      const yellow = mat(0xffd23f, { roughness: 0.35 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), yellow);
      body.scale.set(1, 0.8, 1.3);
      g.add(body);
      const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.22, 4, 8), yellow);
      neck.position.set(0, 0.16, 0.12);
      neck.rotation.x = 0.4;
      g.add(neck);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), yellow);
      head.position.set(0, 0.3, 0.17);
      g.add(head);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 8), mat(0xff7a1a));
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.29, 0.25);
      g.add(beak);
      const comb = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 0.08), mat(0xe0142c));
      comb.position.set(0, 0.38, 0.16);
      g.add(comb);
      break;
    }
    case 'dice': {
      const white = mat(0xffffff, { roughness: 0.3 });
      const pip = mat(0x111111);
      [[-0.07, 0, 0.2], [0.08, 0.04, -0.3]].forEach(([x, y, r]) => {
        const die = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), white);
        die.position.set(x, y, 0);
        die.rotation.set(r, r * 1.5, r * 0.5);
        for (const [px, py] of [[-0.03, 0.03], [0.03, -0.03], [0, 0]]) {
          const d = new THREE.Mesh(new THREE.SphereGeometry(0.013, 6, 4), pip);
          d.position.set(px, py, 0.066);
          die.add(d);
        }
        g.add(die);
      });
      break;
    }
    case 'moneybag': {
      const sack = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), mat(0xc8a06a, { roughness: 0.9 }));
      sack.scale.y = 0.9;
      sack.position.y = -0.15;
      g.add(sack);
      const top = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 10), sack.material);
      top.position.y = 0.1;
      g.add(top);
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const x = c.getContext('2d');
      x.fillStyle = '#1f7a3a';
      x.font = 'bold 50px Arial, sans-serif';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('$', 32, 34);
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const label = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.2), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
      label.position.set(0, -0.15, 0.215);
      g.add(label);
      break;
    }
    case 'mic': {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.34, 12), gold);
      g.add(handle);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), new THREE.MeshStandardMaterial({ color: 0xd9d9d9, metalness: 0.9, roughness: 0.4, wireframe: false }));
      head.position.y = 0.21;
      g.add(head);
      break;
    }
    case 'sparkler': {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.4, 14), new THREE.MeshStandardMaterial({ color: 0xe8c35a, metalness: 0.7, roughness: 0.3 }));
      bottle.position.y = 0.05;
      g.add(bottle);
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.16, 10), bottle.material);
      neck.position.y = 0.32;
      g.add(neck);
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff3b0 }));
      spark.position.y = 0.48;
      g.add(spark);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const ray = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.16, 0.012), new THREE.MeshBasicMaterial({ color: 0xffd24a }));
        ray.position.set(Math.cos(a) * 0.09, 0.48 + Math.sin(a) * 0.09, 0);
        ray.rotation.z = a - Math.PI / 2;
        g.add(ray);
      }
      break;
    }
  }
}

function buildBack(id, body, bx, bz) {
  if (!id) return;
  const g = new THREE.Group();
  body.add(g);
  const behind = (y, out = 0) => -(torsoSurfaceZ(y, bz) + out);
  if (id === 'backpack') {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d');
    x.fillStyle = '#1aa37a';
    x.fillRect(0, 0, 128, 128);
    x.fillStyle = '#fff';
    x.font = 'bold 48px Arial, sans-serif';
    x.textAlign = 'center';
    x.fillText('GG', 64, 78);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const green = mat(0x1aa37a, { roughness: 0.6 });
    const branded = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 });
    const depth = 0.45;
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.8 * Math.min(1.1, bx), 0.85, depth), [green, green, green, green, green, branded]);
    bag.position.set(0, 0.85, behind(0.85, depth / 2 - 0.01));
    g.add(bag);
    // straps over the shoulders, down the front
    const strapMat = mat(0x0e6b4f, { roughness: 0.7 });
    for (const side of [-1, 1]) {
      const pts = [
        new THREE.Vector3(side * 0.24, 1.2, behind(1.2, 0.02)),
        new THREE.Vector3(side * 0.26, 1.52, -0.05),
        new THREE.Vector3(side * 0.24, 1.3, torsoSurfaceZ(1.3, bz) + 0.02),
        new THREE.Vector3(side * 0.24, 0.85, torsoSurfaceZ(0.85, bz) + 0.02),
      ];
      g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.035, 6), strapMat));
    }
  } else if (id === 'cape') {
    const red = new THREE.MeshStandardMaterial({ color: 0xc0182a, roughness: 0.6, side: THREE.DoubleSide });
    const top = 1.45;
    const h = 1.8;
    const geo = new THREE.PlaneGeometry(0.95 * bx, h, 8, 16);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const yy = pos.getY(i) + h / 2; // 0 at the bottom, h at the top
      const down = (h - yy) / h; // 0 at the shoulders, 1 at the hem
      const bodyY = top - (h - yy);
      pos.setX(i, pos.getX(i) * (1 + down * 0.35)); // flares out towards the hem
      // hugs the back at the top, then hangs straight and lets go of the body
      pos.setZ(i, behind(Math.max(bodyY, 0.3), 0.03) - down * down * 0.15 - Math.abs(pos.getX(i)) * 0.06);
      pos.setY(i, bodyY);
    }
    geo.computeVertexNormals();
    g.add(new THREE.Mesh(geo, red));
    for (const side of [-1, 1]) {
      const clasp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe8c35a, metalness: 1, roughness: 0.25 }));
      clasp.position.set(side * 0.22, 1.47, torsoSurfaceZ(1.47, bz) + 0.03);
      g.add(clasp);
    }
  } else if (id === 'wings') {
    const feather = mat(0xffffff, { roughness: 0.6 });
    const tip = mat(0xf1ece0, { roughness: 0.6 });
    for (const side of [-1, 1]) {
      const wing = new THREE.Group();
      wing.position.set(side * 0.18, 1.18, behind(1.18, 0.04));
      wing.rotation.set(0.15, side * 0.55, 0); // swept back, not forward
      // rows of long feathers fanning out and up from the shoulder blade
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 6 - row; i++) {
          const len = 0.55 + i * 0.12 - row * 0.12;
          const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.055 - row * 0.008, len, 3, 8), row ? tip : feather);
          const a = -0.4 + i * 0.22; // fan from a little below horizontal to about 45 degrees up
          f.position.set(side * (Math.cos(a) * (0.2 + len / 2)), Math.sin(a) * (0.2 + len / 2) + 0.2 - row * 0.08, -row * 0.03);
          f.rotation.z = side * (Math.PI / 2 - a);
          f.scale.z = 0.35;
          wing.add(f);
        }
      }
      g.add(wing);
    }
  }
}

/**
 * Build your character. Same skeleton as Dave: { root, body, head, armL, armR, legs }.
 * The root sits at the waist; feet are 1.46 below it (times the scale).
 */
/** A little phone in your character's hand, to show off a case and wallpaper on the turntable. */
function buildHandPhone(look, arm) {
  const g = new THREE.Group();
  g.position.set(0, -1.12, 0.1);
  g.rotation.x = 1.1; // the arm is raised; keep the phone upright, screen towards the viewer
  arm.add(g);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.44, 0.03), new THREE.MeshStandardMaterial({ color: 0x2b2d33, metalness: 0.85, roughness: 0.3 }));
  g.add(body);
  const cm = caseMaterial(look.phoneSkin);
  if (cm) {
    const shell = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.48, 0.05), cm);
    shell.position.z = -0.012;
    g.add(shell);
  }
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.41), new THREE.MeshBasicMaterial({ map: wallpaperTexture(look.wallpaper.replace(/wall$/, '')), toneMapped: false }));
  screen.position.z = 0.017;
  g.add(screen);
  if (look.phoneSkin === 'cracked') {
    const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.41), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, wireframe: true }));
    crack.position.z = 0.018;
    g.add(crack);
  }
  return g;
}

/**
 * Build your character.
 * opts.phoneInHand: hold your phone up (the store's phone-case preview)
 */
export function buildAvatar(look = DEFAULT_LOOK, opts = {}) {
  look = { ...DEFAULT_LOOK, ...look }; // older saves (and couriers) may not have every field
  const skin = mat(look.skin, { roughness: 0.65 });
  const top = topMaterial(look);
  // some outfits come with their own trousers (and the bathrobe comes with none)
  const pantsCol = { tux: 0x16161a, goldsuit: 0xe8c35a, sequin: 0x241034, tracksuit: 0xc0182a }[look.top] ?? look.pants;
  const pants =
    look.top === 'bathrobe' ? skin : look.top === 'goldsuit' ? new THREE.MeshStandardMaterial({ color: pantsCol, metalness: 1, roughness: 0.25 }) : mat(pantsCol, { roughness: 0.8 });
  const shoe = mat(look.top === 'tux' ? 0x0a0a0a : look.top === 'bathrobe' ? 0xffffff : look.shoes, { roughness: look.top === 'bathrobe' ? 1 : 0.5 });
  const sleeves = look.top === 'tank' ? skin : top;
  const [bx, bz] = BUILDS[look.build] || BUILDS.regular;

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const legs = [-0.24, 0.24].map((x) => {
    const g = new THREE.Group();
    g.position.x = x * (bx > 1 ? 1.12 : 1);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.15, 1.45, 12), pants);
    leg.position.y = -0.72;
    g.add(leg);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.14, 0.46), shoe);
    foot.position.set(0, -1.46, 0.09);
    g.add(foot);
    root.add(g);
    return g;
  });

  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.52, 0.8, 6, 16), top);
  torso.scale.set(bx, 1, 0.78 * bz);
  torso.position.y = 0.72;
  body.add(torso);
  if (look.top === 'tux' || look.top === 'goldsuit' || look.top === 'sequin') {
    // shirt front and lapels
    const shirt = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 3), mat(0xffffff, { roughness: 0.6 }));
    shirt.rotation.x = Math.PI + 0.25;
    shirt.position.set(0, 1.12, torsoSurfaceZ(1.12, bz) - 0.02);
    shirt.scale.z = 0.3;
    body.add(shirt);
    if (look.top === 'tux' && !look.neck) {
      const bow = mat(0x111111);
      for (const side of [-1, 1]) {
        const wing = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.14, 4), bow);
        wing.rotation.z = (side * Math.PI) / 2;
        wing.position.set(side * 0.07, 1.42, torsoSurfaceZ(1.42, bz) + 0.05);
        body.add(wing);
      }
    }
  } else if (look.top === 'tshirt') {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.04, 8, 20), mat(new THREE.Color(look.shirt).multiplyScalar(0.8)));
    collar.rotation.x = Math.PI / 2 + 0.3;
    collar.position.set(0, 1.45, 0.05);
    body.add(collar);
  } else if (look.top === 'bathrobe') {
    // a V of chest, a belt, and a robe down to the knees
    const v = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 3), skin);
    v.rotation.x = Math.PI;
    v.scale.z = 0.3;
    v.position.set(0, 1.2, 0.36 * bz);
    body.add(v);
    const belt = new THREE.Mesh(new THREE.TorusGeometry(0.5 * bx, 0.05, 8, 24), mat(0xe8dcc0, { roughness: 1 }));
    belt.rotation.x = Math.PI / 2;
    belt.scale.y = 0.8 * bz;
    belt.position.y = 0.3;
    body.add(belt);
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.52 * bx, 0.6 * bx, 0.8, 20, 1, true), top);
    skirt.material = top.clone();
    skirt.material.side = THREE.DoubleSide;
    skirt.scale.z = 0.85 * bz;
    skirt.position.y = -0.15;
    body.add(skirt);
  } else if (look.top === 'hoodie') {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.13, 10, 20), top);
    hood.position.set(0, 1.5, -0.2);
    hood.rotation.x = 1.1;
    body.add(hood);
    const pocket = new THREE.Mesh(new THREE.BoxGeometry(0.55 * bx, 0.22, 0.06), mat(0x5a4c80, { roughness: 0.9 }));
    pocket.position.set(0, 0.45, 0.4 * bz);
    body.add(pocket);
    for (const side of [-1, 1]) {
      const string = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), mat(0xffffff));
      string.position.set(side * 0.08, 1.22, 0.4 * bz);
      body.add(string);
    }
  } else if (look.top === 'leather') {
    for (const side of [-1, 1]) {
      const lapel = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.32, 0.05), top);
      lapel.position.set(side * 0.16, 1.32, 0.34 * bz);
      lapel.rotation.set(0.2, 0, side * -0.4);
      body.add(lapel);
    }
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.9, 0.02), new THREE.MeshStandardMaterial({ color: 0xcfd4d8, metalness: 1, roughness: 0.3 }));
    zip.position.set(0.05, 0.75, 0.41 * bz);
    body.add(zip);
  } else if (look.top === 'tracksuit') {
    const zip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.9, 0.02), mat(0xffffff));
    zip.position.set(0, 0.75, 0.41 * bz);
    body.add(zip);
    for (const leg of legs) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.3, 0.03), mat(0xffffff));
      stripe.position.set(leg.position.x > 0 ? 0.16 : -0.16, -0.72, 0);
      leg.add(stripe);
    }
  }
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.25, 12), skin);
  neck.position.y = 1.55;
  body.add(neck);

  const arm = (side) => {
    const g = new THREE.Group();
    g.position.set(side * (0.1 + 0.52 * bx), 1.3, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.75, 4, 10), sleeves);
    upper.position.y = -0.45;
    g.add(upper);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skin);
    hand.position.y = -0.95;
    g.add(hand);
    if (look.top === 'tracksuit') {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.85, 0.03), mat(0xffffff));
      stripe.position.set(side * 0.14, -0.45, 0);
      g.add(stripe);
    }
    body.add(g);
    return { g, hand };
  };
  const armL = arm(-1);
  const armR = arm(1);

  const head = new THREE.Group();
  head.position.y = 1.95;
  body.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.42, 24, 18), skin));
  buildFace(look, head);
  // tall hair gets squashed down under a hat instead of poking through it
  buildHair(HAT_COVERS.has(look.hat) && TALL_HAIR.has(look.hair) ? { ...look, hair: 'short' } : look, head);
  buildFacialHair(look, head);
  buildHat(look.hat, head);
  buildGlasses(look.glasses, head);
  buildNeck(look.neck, body, bx, bz);
  buildHeld(look.held, armL.g); // left hand: the right one holds your phone in selfies
  buildBack(look.back, body, bx, bz);
  if (opts.phoneInHand) buildHandPhone(look, armR.g);

  // fingers for emotes (hidden until an emote needs them): a V sign, and a thumb
  const fingerMat = skin;
  const peace = new THREE.Group();
  for (const side of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.14, 3, 6), fingerMat);
    f.position.set(side * 0.045, -1.13, 0);
    f.rotation.z = side * 0.3;
    peace.add(f);
  }
  peace.visible = false;
  armL.g.add(peace);
  const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.1, 3, 6), fingerMat);
  thumb.position.set(0, -0.95, 0.16);
  thumb.rotation.x = Math.PI / 2;
  thumb.visible = false;
  armL.g.add(thumb);

  root.traverse((o) => o.isMesh && (o.castShadow = true));
  return { root, body, head, armL, armR, legs, holding: !!look.held, phoneInHand: !!opts.phoneInHand, props: { peace, thumb } };
}

/** Throw a character away (geometries, materials, textures). */
export function disposeAvatar(a) {
  a?.root.traverse((o) => {
    o.geometry?.dispose();
    [].concat(o.material || []).forEach((m) => {
      m.map?.dispose();
      m.dispose();
    });
  });
  a?.root.removeFromParent();
}

/** Strike a pose with the left arm (and head). The right arm is busy with the phone in selfies. */
function applyEmote(a, t, id) {
  a.props.peace.visible = id === 'peace';
  a.props.thumb.visible = id === 'thumbsup';
  const L = a.armL.g.rotation;
  switch (id) {
    case 'peace':
      L.set(-2.5, 0, -0.35);
      a.head.rotation.z = 0.15;
      break;
    case 'thumbsup':
      L.set(-1.4 + Math.sin(t * 4) * 0.05, 0, -0.15);
      break;
    case 'facepalm':
      L.set(-2.55, 0, 0.62);
      a.head.rotation.x = 0.35;
      a.head.rotation.y = 0;
      break;
    case 'flex':
      L.set(0, 0, -2.0 + Math.sin(t * 5) * 0.08);
      a.head.rotation.y = -0.45;
      a.body.rotation.z = 0.06;
      break;
    case 'dab':
      L.set(-1.85, 0, 1.1);
      a.head.rotation.set(0.45, 0.25, -0.35);
      break;
    case 'moneyrain':
    case 'wave':
    default:
      L.set(0, 0, -2.5 + Math.sin(t * 7) * 0.3); // a proper wave
  }
}

/** Idle life: breathe, look around, the odd little bounce. Pass an emote to strike a pose. */
export function animateAvatar(a, t, { pose = 'idle', emote = null } = {}) {
  a.body.position.y = Math.sin(t * 2) * 0.02;
  a.body.rotation.z = Math.sin(t * 0.9) * 0.03;
  a.head.rotation.set(Math.sin(t * 0.8) * 0.05, Math.sin(t * 0.6) * 0.25, 0);
  if (a.phoneInHand) a.armR.g.rotation.set(-1.1, 0, 0.15); // showing off the phone
  if (pose === 'selfie') {
    a.armR.g.rotation.set(-1.35, 0, 0.85); // arm out to the side, holding the phone (out of shot)
    applyEmote(a, t, emote || 'wave');
  } else if (emote) {
    if (!a.phoneInHand) a.armR.g.rotation.set(-Math.sin(t * 1.3) * 0.08, 0, 0.12);
    applyEmote(a, t, emote);
  } else {
    a.props.peace.visible = a.props.thumb.visible = false;
    // holding something? show it off a little
    a.armL.g.rotation.set(a.holding ? -0.55 + Math.sin(t * 1.3) * 0.05 : Math.sin(t * 1.3) * 0.08, 0, -0.12);
    if (!a.phoneInHand) a.armR.g.rotation.set(-Math.sin(t * 1.3) * 0.08, 0, 0.12);
  }
}

// ---------- the dressing room: your character on a turntable ----------
export class AvatarStage extends Stage3D {
  constructor(container, look) {
    super(container, 32);
    const s = this.scene;
    s.background = new THREE.Color(0x14070c);
    s.fog = new THREE.Fog(0x14070c, 12, 30);
    s.add(new THREE.HemisphereLight(0xffe8f0, 0x1a0808, 0.55));
    const key = new THREE.SpotLight(0xfff0dd, 90, 20, 0.5, 0.5, 1.2);
    key.position.set(2.5, 7, 5);
    key.target.position.set(0, 0.6, 0);
    s.add(key, key.target);
    const rim = new THREE.PointLight(0xff5aa0, 25, 12, 1.5);
    rim.position.set(-3, 3, -3);
    s.add(rim);
    const rim2 = new THREE.PointLight(0x2de0ff, 18, 12, 1.5);
    rim2.position.set(3, 2, -3);
    s.add(rim2);

    // velvet curtains behind, a gold-trimmed turntable underfoot
    const curtainTex = (() => {
      const c = document.createElement('canvas');
      c.width = 256;
      c.height = 64;
      const x = c.getContext('2d');
      for (let i = 0; i < 256; i++) {
        const v = 0.55 + Math.sin(i * 0.25) * 0.3;
        x.fillStyle = `rgb(${Math.round(120 * v)}, ${Math.round(12 * v)}, ${Math.round(30 * v)})`;
        x.fillRect(i, 0, 1, 64);
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.repeat.x = 3;
      return t;
    })();
    const curtain = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 12, 48, 1, true, Math.PI * 0.6, Math.PI * 0.8), new THREE.MeshStandardMaterial({ map: curtainTex, side: THREE.BackSide, roughness: 0.9 }));
    curtain.position.y = 4;
    s.add(curtain);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(12, 48), new THREE.MeshStandardMaterial({ color: 0x1a0b10, roughness: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.3;
    s.add(floor);
    this.table = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.7, 0.2, 48), new THREE.MeshStandardMaterial({ color: 0x2a0d14, roughness: 0.4 }));
    disc.position.y = -1.2;
    this.floorY = -1.1; // top of the disc: what the shoes stand on
    this.table.add(disc);
    const trim = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.05, 8, 64), new THREE.MeshStandardMaterial({ color: 0xe8c35a, metalness: 1, roughness: 0.25 }));
    trim.rotation.x = Math.PI / 2;
    trim.position.y = -1.1;
    this.table.add(trim);
    s.add(this.table);
    // sparkles drifting through the spotlight
    const n = 120;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([rand(-4, 4), rand(-1, 5), rand(-3, 2)], i * 3);
    this.sparkles = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(pos, 3)),
      new THREE.PointsMaterial({ color: 0xffe9a8, size: 0.05, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    s.add(this.sparkles);

    this.spin = 0.5;
    this.drag = null;
    this.setLook(look);
    this.camera.position.set(0, 1.6, 9.4); // room above the head for a top hat
    this.camera.lookAt(0, 1.0, 0);

    // drag to spin it yourself
    const el = this.renderer.domElement;
    el.style.touchAction = 'none';
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', (e) => {
      this.drag = { x: e.clientX, spin: this.spin };
      el.setPointerCapture?.(e.pointerId);
      el.style.cursor = 'grabbing';
    });
    el.addEventListener('pointermove', (e) => {
      if (this.drag) this.spin = this.drag.spin + (e.clientX - this.drag.x) * 0.012;
    });
    const up = () => {
      this.drag = null;
      el.style.cursor = 'grab';
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  }

  setLook(look, opts = {}) {
    disposeAvatar(this.avatar);
    this.avatar = buildAvatar(look, opts);
    // stand exactly on the disc: measure how far below the waist the lowest point (the soles) is
    this.avatar.root.position.y = 0;
    this.avatar.root.updateMatrixWorld(true);
    this.restY = this.floorY - new THREE.Box3().setFromObject(this.avatar.root).min.y;
    this.avatar.root.position.y = this.restY;
    this.table.add(this.avatar.root);
    this.pop = 0.35; // a little hop when something changes
  }

  /** Your trophies, on shelves behind the turntable. list: [{ kind, tier, earned }] */
  setShelf(list) {
    if (this.shelf) {
      this.scene.remove(this.shelf);
      disposeTree(this.shelf);
    }
    this.shelf = buildShelf(list);
    this.shelf.position.set(0, -0.2, -2.6);
    this.scene.add(this.shelf);
  }

  /** Show an emote for a few seconds (the store's try-on). */
  playEmote(id) {
    this.emote = id;
    this.emoteUntil = this.clock.elapsedTime + 4;
    this.spin = Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2; // face the front for it
  }

  update(dt, t) {
    if (!this.drag && !this.emote) this.spin += dt * 0.35;
    this.table.rotation.y = this.spin;
    if (this.emote && t > this.emoteUntil) this.emote = null;
    animateAvatar(this.avatar, t, { emote: this.emote });
    if (this.pop > 0) {
      this.pop = Math.max(0, this.pop - dt);
      this.avatar.root.position.y = this.restY + Math.sin((1 - this.pop / 0.35) * Math.PI) * 0.25;
    }
    const p = this.sparkles.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) + dt * 0.25;
      if (y > 5) y = -1;
      p.setY(i, y);
    }
    p.needsUpdate = true;
  }
}

// ---------- a portrait of your character (for the top-right button) ----------
let portraitRenderer = null;
let portraitEnv = null;
export function portrait(look, size = 96) {
  portraitRenderer ??= new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  const r = portraitRenderer;
  r.setPixelRatio(1);
  r.setSize(size * 2, size * 2, false);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  portraitEnv ??= new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = portraitEnv;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.8);
  key.position.set(1, 2, 3);
  scene.add(key);
  const a = buildAvatar(look);
  scene.add(a.root);
  a.head.rotation.y = 0.25;
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  const hasHat = !!look.hat;
  cam.position.set(0.4, 2.1 + (hasHat ? 0.2 : 0), 3.6 + (hasHat ? 0.4 : 0));
  cam.lookAt(0, 1.98 + (hasHat ? 0.15 : 0), 0);
  r.render(scene, cam);
  const url = r.domElement.toDataURL('image/png');
  disposeAvatar(a);
  return url;
}
