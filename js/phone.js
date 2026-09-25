// 📱 YOUR PHONE: Messages (Dave, who has feelings), a cab home, food delivery and a selfie
// camera. The handset is 3D (phone3d.js); this file is the phone's apps. Other modules plug in
// their own apps too: the bank, the map, your style, the store, goals, settings, Coming Soon™.

import * as THREE from 'three';
import { PhoneOverlay, SelfieCam, SCREEN_PX } from './phone3d.js';
import { REPLIES, buildDave } from './dave.js';
import { DATES, GIFTS, RING, PROPOSE_AT } from './girlfriend.js';
import { WALLPAPERS, playRingtone } from './skins.js';
import { CATALOG } from './avatar.js';
import { emit } from './events.js';
import { throwDrink } from './drinks.js';

const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const CAB = { base: 10, surge: 4.8 };
const FOOD = [
  { id: 'kebab', emoji: '🥙', name: 'Kebab', desc: 'Sobers you up a bit. Mostly garlic.', price: 15, sober: 2 },
  { id: 'pizza', emoji: '🍕', name: 'Pizza Slice', desc: 'One slice. Cold. Perfect.', price: 8, sober: 1 },
  { id: 'wrap', emoji: '🌯', name: 'Mystery Wrap', desc: 'Could be anything. Could be vodka.', price: 4, sober: 'mystery' },
];
const ETA_S = 8;
const MAX_PHOTOS = 6;

const moodLabel = (m) => (m >= 40 ? '🥰 loves you' : m >= 10 ? '🙂 in a good mood' : m > -25 ? '😐 normal Dave' : m > -45 ? '😒 annoyed' : '😤 FURIOUS');
const clock = () => new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/**
 * Scrolling, done by hand. The screen sits in a 3D transform (CSS3DRenderer), and Chrome's scroll
 * hit-testing doesn't find the lists inside it: the wheel scrolls the page behind the phone and a
 * finger drag does nothing. So: the wheel scrolls whatever list is under it (a sideways row, like the
 * store's filters, scrolls sideways), and you drag lists with a finger or the mouse (with a little
 * momentum). The map, the turntable and sliders handle their own touches.
 */
function assistScroll(screen) {
  const scrollable = (el, axis) => {
    for (; el && el !== screen; el = el.parentElement) {
      const s = getComputedStyle(el);
      if (axis === 'y' && /auto|scroll/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 1) return el;
      if (axis === 'x' && /auto|scroll/.test(s.overflowX) && el.scrollWidth > el.clientWidth + 1) return el;
    }
    return null;
  };

  screen.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault(); // never the page behind
      const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? screen.clientHeight : 1;
      let dx = e.deltaX * k;
      let dy = e.deltaY * k;
      if (e.shiftKey && !dx) [dx, dy] = [dy, 0];
      // a plain mouse wheel over a sideways row (the store's filters) scrolls it sideways
      const row = !dx && scrollable(e.target, 'x');
      if (row && (dy > 0 ? row.scrollLeft + row.clientWidth < row.scrollWidth - 1 : row.scrollLeft > 0)) [dx, dy] = [dy, 0];
      const across = Math.abs(dx) > Math.abs(dy);
      const el = across ? scrollable(e.target, 'x') : scrollable(e.target, 'y');
      el?.scrollBy(across ? { left: dx } : { top: dy });
    },
    { passive: false }
  );

  let drag = null;
  let coast = 0;
  let dragged = false; // a drag isn't a tap
  screen.addEventListener('pointerdown', (e) => {
    cancelAnimationFrame(coast);
    dragged = false;
    if ((e.pointerType === 'mouse' && e.button !== 0) || e.target.closest('canvas, input[type=range]')) return;
    // screen pixels per pixel of the phone's screen (it's scaled by the 3D view)
    const scale = screen.getBoundingClientRect().height / screen.offsetHeight || 1;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, scale, el: null, axis: null, v: 0, t: e.timeStamp, target: e.target };
  });
  screen.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = (e.clientX - drag.x) / drag.scale;
    const dy = (e.clientY - drag.y) / drag.scale;
    if (!drag.axis) {
      if (Math.hypot(dx, dy) < 8) return;
      drag.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      drag.el = scrollable(drag.target, drag.axis);
      dragged = true;
    }
    if (!drag.el) return;
    const d = drag.axis === 'x' ? dx : dy;
    if (drag.axis === 'x') drag.el.scrollLeft -= d;
    else drag.el.scrollTop -= d;
    const dt = Math.max(1, e.timeStamp - drag.t);
    drag.v = 0.8 * (d / dt) + 0.2 * drag.v; // px per ms, smoothed
    drag.x = e.clientX;
    drag.y = e.clientY;
    drag.t = e.timeStamp;
  });
  const release = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { el, axis } = drag;
    let v = drag.v * 16; // px per frame
    drag = null;
    if (!el || Math.abs(v) < 0.5) return;
    const step = () => {
      if (axis === 'x') el.scrollLeft -= v;
      else el.scrollTop -= v;
      v *= 0.94;
      if (Math.abs(v) > 0.3) coast = requestAnimationFrame(step);
    };
    coast = requestAnimationFrame(step);
  };
  screen.addEventListener('pointerup', release);
  screen.addEventListener('pointercancel', release);
  screen.addEventListener(
    'click',
    (e) => {
      if (!dragged) return;
      dragged = false;
      e.stopPropagation();
      e.preventDefault();
    },
    true
  );
}

let daveWallpaper = null;
function renderDaveWallpaper() {
  if (daveWallpaper) return daveWallpaper;
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(380, 800, false);
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xc0182a);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x552222, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(1, 2, 3);
  scene.add(key);
  const d = buildDave();
  d.root.scale.setScalar(1);
  d.armL.g.rotation.x = -2.2; // cheers 🍺
  scene.add(d.root);
  const cam = new THREE.PerspectiveCamera(32, 380 / 800, 0.1, 50);
  cam.position.set(0.3, 1.5, 6.5);
  cam.lookAt(0, 1.2, 0);
  r.render(scene, cam);
  daveWallpaper = r.domElement.toDataURL('image/jpeg', 0.85);
  r.dispose();
  r.forceContextLoss?.();
  return daveWallpaper;
}

/**
 * @param canOpen       () => bool, nothing else is taking over the screen
 * @param roomVisible   () => bool, the roulette room is showing (the courier walks in there)
 * @param bannersOn     () => bool, show Dave's text banners (a setting)
 *
 * Plug-in apps (phone.add(app)):
 *   { id, label, emoji, icon?() (html for the icon), dot?() (a badge), dock? (sits in the dock),
 *     html(header), mount?(view) once drawn, unmount?() when you leave,
 *     update?(view) (redraw in place, for apps with a 3D scene in them),
 *     click?(button) → true if it was theirs, input?(el), change?(el) }
 */
export function createPhone({ button, store, sound, toast, booze, dave, gf, hangover, settings, courier, getBalance, spend, pause3d, resume3d, canOpen, roomVisible, bannersOn = () => true }) {
  const apps = new Map(); // the plug-in apps, by id
  let layer = null;
  let overlay = null;
  let screen = null;
  let view = 'home';
  let selfie = null;
  let typing = false;
  let chips = null;
  let cab = 'idle';
  let order = null; // { item, left }
  let photos = store.get('fr.selfies', []);
  let viewing = null;
  let chatWith = 'dave'; // whose messages you're reading: 'dave' or 'gf'
  let gfTyping = false;
  let gfChips = null;
  let gfMenu = null; // 'date' | 'gift' | null: the menu open under their thread
  let gfSure = false; // tapped "break up" once

  // ---------- the button in the top bar ----------
  const badge = () => {
    const n = dave.unread() + gf.unread();
    const other = [...apps.values()].some((a) => a.dot?.());
    button.querySelector('.ph-badge').textContent = n ? (n > 9 ? '9+' : n) : other ? '!' : '';
    button.classList.toggle('has-unread', n > 0 || other);
  };
  badge();
  button.addEventListener('click', () => (layer ? close() : open()));
  addEventListener('keydown', (e) => {
    if (e.code !== 'KeyP' || e.repeat || /INPUT|TEXTAREA/.test(document.activeElement?.tagName)) return;
    if (layer) close();
    else open();
  });

  // ---------- open / close ----------
  function open(app = 'home') {
    if (layer) return show(app);
    if (!canOpen()) return toast('📱 Not now, you have your hands full.');
    layer = document.createElement('div');
    layer.className = 'phone-layer';
    layer.innerHTML = `<div class="ph-dim"></div><div class="ph-stage"></div>`;
    document.body.appendChild(layer);
    document.body.classList.add('phone-on');
    screen = document.createElement('div');
    screen.className = `ph-screen skin-${settings.look().phoneSkin}`;
    screen.style.width = SCREEN_PX.w + 'px';
    screen.style.height = SCREEN_PX.h + 'px';
    screen.innerHTML = `
      <div class="ph-status"><span class="ph-time">${clock()}</span><span class="ph-island"></span><span class="ph-icons">📶 🔋</span></div>
      <div class="ph-view"></div>
      <button type="button" class="ph-homebar" aria-label="Home"></button>`;
    assistScroll(screen);
    screen.addEventListener('click', onClick);
    screen.addEventListener('input', (e) => apps.get(view)?.input?.(e.target));
    screen.addEventListener('change', (e) => apps.get(view)?.change?.(e.target));
    layer.querySelector('.ph-dim').addEventListener('click', close);
    layer.addEventListener('wheel', (e) => e.preventDefault(), { passive: false }); // the page stays put behind the phone
    pause3d();
    overlay = new PhoneOverlay(layer.querySelector('.ph-stage'), screen, { skin: settings.look().phoneSkin });
    overlay.open();
    addEventListener('keydown', onKey, true);
    requestAnimationFrame(() => layer?.classList.add('on'));
    show(app);
    sound.blip(1200, 0.04, 'triangle', 0.07);
    sound.blip(1600, 0.05, 'triangle', 0.06, 0.05);
  }

  function close() {
    if (!layer) return;
    const dying = layer;
    const o = overlay;
    stopCamera();
    apps.get(view)?.unmount?.();
    layer = null;
    overlay = null;
    screen = null;
    removeEventListener('keydown', onKey, true);
    dying.classList.remove('on');
    o.close(() => {
      o.dispose();
      dying.remove();
      document.body.classList.remove('phone-on');
      resume3d();
    });
    sound.blip(900, 0.04, 'triangle', 0.06);
    badge();
  }

  const onKey = (e) => {
    if (e.code === 'Escape') {
      viewing ? ((viewing = null), render()) : view !== 'home' ? show('home') : close();
    }
    if (e.code === 'Space' || e.code === 'Escape') {
      e.stopPropagation(); // not a spin, not the slots
      if (!/INPUT|TEXTAREA/.test(e.target.tagName) || e.code === 'Escape') e.preventDefault(); // (but typing a space works)
    }
  };

  function show(app) {
    if (view === 'camera' && app !== 'camera') stopCamera();
    if (view !== app) apps.get(view)?.unmount?.();
    view = app;
    viewing = null;
    if (app === 'messages') {
      chips = null;
      gfChips = null;
      if (!dave.met() && gf.met()) chatWith = 'gf';
      if (chatWith === 'gf') gf.markRead();
      else dave.markRead();
    }
    render();
    if (app === 'camera') startCamera();
    badge();
  }

  // ---------- screens ----------
  function render() {
    if (!screen) return;
    screen.querySelector('.ph-time').textContent = clock();
    const v = screen.querySelector('.ph-view');
    const ext = apps.get(view);
    v.className = `ph-view v-${view}`;
    if (ext) {
      ext.unmount?.();
      v.innerHTML = ext.html(header);
      ext.mount?.(v);
    } else {
      v.innerHTML = { home: homeHtml, messages: messagesHtml, cab: cabHtml, food: foodHtml, camera: cameraHtml }[view]();
    }
    if (view === 'messages') {
      const list = v.querySelector('.msg-list');
      if (list) list.scrollTop = list.scrollHeight;
    }
  }

  /** Redraw an app if it's on screen, keeping your scroll (an app with a 3D scene redraws itself in place). */
  function refresh(id) {
    if (!screen || (id && view !== id && view !== 'home')) return;
    const v = screen.querySelector('.ph-view');
    const ext = apps.get(view);
    if (ext?.update) return ext.update(v);
    const top = v.querySelector('.ph-scroll')?.scrollTop;
    render();
    const now = v.querySelector('.ph-scroll');
    if (now && top) now.scrollTop = top;
  }

  function wallpaperCss() {
    const id = settings.look().wallpaper.replace(/wall$/, '');
    if (id === 'selfie' && photos.length) return `center/cover no-repeat url(${photos[photos.length - 1]})`;
    if (id === 'dave') return `center/cover no-repeat url(${renderDaveWallpaper()})`;
    return (WALLPAPERS[id] || WALLPAPERS.neon).css || WALLPAPERS.neon.css;
  }

  function homeHtml() {
    const n = dave.unread() + gf.unread();
    const app = (id, emoji, label, extra = '') => `<button type="button" class="ph-app" data-app="${id}"><span class="ph-icon i-${id}">${emoji}${extra}</span><small>${label}</small></button>`;
    const dot = (d) => (d ? `<b class="ph-dot">${d === true ? '!' : d}</b>` : '');
    const ext = (a) => app(a.id, a.icon?.() || a.emoji, a.label, dot(a.dot?.()));
    const all = [...apps.values()];
    return `
      <div class="ph-home" style="background:${wallpaperCss()}">
        <div class="ph-clock">${clock()}</div>
        <div class="ph-date">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        <div class="ph-grid">
          ${all.filter((a) => !a.dock).map(ext).join('')}
          ${app('cab', '🚕', 'CabCab')}
          ${app('food', '🛵', 'GrubGrab')}
          ${app('camera', '📸', 'Camera')}
        </div>
        <p class="ph-tip">Press <kbd>P</kbd> to put your phone away</p>
        <div class="ph-dock">
          ${app('messages', '💬', 'Messages', dot(n))}
          ${all.filter((a) => a.dock).map(ext).join('')}
        </div>
      </div>`;
  }

  const header = (title, sub = '') => `<div class="ph-head"><button type="button" class="ph-back" data-app="home">‹</button><div><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;

  // Dave and (if you've met her) Scarlett, a tab each
  function threadTabs() {
    if (!gf.met() || !dave.met()) return '';
    const tab = (id, label, n) => `<button type="button" class="msg-tab${chatWith === id ? ' on' : ''}" data-thread="${id}">${label}${n ? ` <b>${n}</b>` : ''}</button>`;
    return `<div class="msg-tabs">${tab('dave', 'Dave 🍺', dave.unread())}${tab('gf', `${gf.name()} ${gf.emoji()}`, gf.unread())}</div>`;
  }

  function bubblesHtml(list, mine) {
    return list
      .map((x, i) => {
        const prev = list[i - 1];
        const stamp = !prev || x.t - prev.t > 5 * 60000 ? `<div class="msg-stamp">${new Date(x.t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>` : '';
        return `${stamp}<div class="msg ${x.from === mine ? 'me' : 'them'}">${esc(x.m)}</div>`;
      })
      .join('');
  }

  function gfHtml() {
    gfChips ??= ['sweet', 'flirty', 'cold'].map((kind) => ({ kind, m: pick(gf.replies[kind]) })).sort(() => Math.random() - 0.5);
    const list = gf.thread();
    const last = list[list.length - 1];
    const love = gf.love();
    const sub = gfTyping ? 'typing…' : gf.dating() ? `${gf.married() ? '💍 ' : ''}your ${gf.title()} · ❤️ ${love}%` : gf.ended() === 'breakup' ? '💔 you ended it' : '💔 dumped you';
    const menu =
      gfMenu === 'date'
        ? `<div class="gf-menu">${DATES.map((d) => `<button type="button" class="gf-opt" data-gdate="${d.id}"><span>${d.emoji}</span><b>${d.name}</b><em>${d.cost ? money(d.cost) : 'free'}</em></button>`).join('')}</div>`
        : gfMenu === 'gift'
        ? `<div class="gf-menu">${GIFTS.map((g) => `<button type="button" class="gf-opt${gf.gifts()[g.slot] === g.id ? ' worn' : ''}" data-ggift="${g.id}"><span>${g.emoji}</span><b>${g.name}</b><em>👛 ${money(g.price)}</em></button>`).join('')}</div>`
        : `<div class="msg-chips">${gfChips.map((c) => `<button type="button" class="msg-chip ${c.kind === 'sweet' ? 'nice' : c.kind === 'cold' ? 'mean' : 'weird'}" data-greply="${c.kind}" data-m="${esc(c.m)}">${esc(c.m)}</button>`).join('')}</div>`;
    const canPropose = !gf.married() && !gf.engaged() && love >= PROPOSE_AT;
    const actions = `<div class="gf-actions">
        <button type="button" class="gf-act${gfMenu === 'date' ? ' on' : ''}" data-gmenu="date">💌 Date</button>
        <button type="button" class="gf-act${gfMenu === 'gift' ? ' on' : ''}" data-gmenu="gift">🎁 Gift</button>
        <button type="button" class="gf-act breakup${gfSure ? ' sure' : ''}" data-gbreakup>${gfSure ? (gf.married() ? '💔 Divorce? Tap again' : '💔 Sure? Tap again') : '💔'}</button>
        ${canPropose ? `<button type="button" class="gf-act ring" data-gpropose>💍 Propose · 👛 ${money(RING)}</button>` : ''}
      </div>`;
    return `
      ${header(`${gf.name()} ${gf.emoji()}`, sub)}
      ${threadTabs()}
      ${gf.dating() ? `<div class="gf-meter"><i style="width:${love}%"></i></div>` : ''}
      <div class="msg-list">${bubblesHtml(list, 'me')}${last?.from === 'me' ? '<div class="msg-seen">Delivered</div>' : ''}${gfTyping ? '<div class="msg them typing"><i></i><i></i><i></i></div>' : ''}</div>
      ${gf.dating() ? actions + menu : ''}`;
  }

  function messagesHtml() {
    if (chatWith === 'gf' && gf.met()) return gfHtml();
    if (!dave.met()) {
      return `${header('Messages')}<div class="msg-empty">No messages yet.<br><small>You don't know anyone called Dave. Yet.</small></div>`;
    }
    chips ??= [pick(REPLIES.nice), pick(REPLIES.weird), pick(REPLIES.mean)]
      .map((m, i) => ({ kind: ['nice', 'weird', 'mean'][i], m }))
      .sort(() => Math.random() - 0.5);
    const wantsSorry = dave.wantsSorry();
    const thread = dave.thread();
    const bubbles = thread
      .map((x, i) => {
        const prev = thread[i - 1];
        const stamp = !prev || x.t - prev.t > 5 * 60000 ? `<div class="msg-stamp">${new Date(x.t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>` : '';
        return `${stamp}<div class="msg ${x.from === 'me' ? 'me' : 'them'}">${esc(x.m)}</div>`;
      })
      .join('');
    const last = thread[thread.length - 1];
    const seen = last?.from === 'me' ? '<div class="msg-seen">Delivered</div>' : '';
    return `
      ${header('Dave 🍺', typing ? 'typing…' : moodLabel(dave.mood()))}
      ${threadTabs()}
      <div class="msg-list">${bubbles}${seen}${typing ? '<div class="msg them typing"><i></i><i></i><i></i></div>' : ''}</div>
      <div class="msg-chips">
        ${wantsSorry ? `<button type="button" class="msg-chip sorry" data-reply="sorry" data-m="${esc(REPLIES.sorry[0])}">${esc(REPLIES.sorry[0])}</button>` : ''}
        ${chips.map((c) => `<button type="button" class="msg-chip ${c.kind}" data-reply="${c.kind}" data-m="${esc(c.m)}">${esc(c.m)}</button>`).join('')}
      </div>`;
  }

  function cabHtml() {
    const fare = CAB.base * CAB.surge;
    const body = {
      idle: `
        <div class="cab-card">
          <div class="cab-row"><span>📍 From</span><b>Club Jackpot, table 7</b></div>
          <div class="cab-row"><span>🏠 To</span><b>Home</b></div>
          <div class="cab-row"><span>💸 Fare</span><b>${money(CAB.base)} × <span class="surge">${CAB.surge}× surge</span> = ${money(fare)}</b></div>
          <button type="button" class="btn gold wide" data-cab="book">🚕 Request ride · ${money(fare)}</button>
          <p class="cab-fine">Surge pricing is in effect because it is always in effect.</p>
        </div>`,
      coming: `<div class="cab-card"><div class="cab-car">🚕</div><b>Kevin (4.9★) is on his way</b><p>Silver Prius · smells like pine</p><div class="cab-bar"><i></i></div></div>`,
    }[cab];
    return `${header('CabCab')}<div class="cab-map"><i class="road h1"></i><i class="road h2"></i><i class="road v1"></i><i class="road v2"></i><span class="pin you">🎰</span><span class="pin home">🏠</span>${cab === 'coming' ? '<span class="pin car">🚕</span>' : ''}</div>${body}`;
  }

  function foodHtml() {
    if (order) {
      return `${header('GrubGrab')}<div class="food-track"><div class="food-big">🛵</div><b>Marco is bringing your ${order.item.emoji} ${order.item.name}</b><p>${order.left > 0 ? `Arriving in ${order.left}s` : 'At your table!'}</p><div class="cab-bar"><i style="width:${(1 - order.left / ETA_S) * 100}%"></i></div><p class="cab-fine">Put your phone away to watch him walk in.</p></div>`;
    }
    return `${header('GrubGrab', 'delivers to casino tables, sadly')}<div class="food-list">${FOOD.map(
      (f) => `<div class="food-item"><span class="food-emoji">${f.emoji}</span><div><b>${f.name}</b><small>${f.desc}</small></div><button type="button" class="btn gold" data-food="${f.id}">${money(f.price)}</button></div>`
    ).join('')}</div>`;
  }

  function cameraHtml() {
    if (viewing != null) {
      return `${header('Photo')}<div class="cam-view"><img src="${photos[viewing]}" alt="Selfie"></div><button type="button" class="btn wide" data-photo-close>Back to camera</button>`;
    }
    return `
      ${header('Camera', 'selfie mode 🤳')}
      <div class="cam-finder"><canvas class="cam-canvas"></canvas><div class="cam-flash"></div></div>
      <div class="cam-emotes">${ownedEmotes()
        .map((e) => `<button type="button" class="cam-emote${e.id === emote ? ' on' : ''}" data-emote="${e.id}" title="${e.name}">${e.emoji}</button>`)
        .join('')}</div>
      <div class="cam-controls">
        <button type="button" class="cam-look" data-settings title="Change your look">👕</button>
        <button type="button" class="cam-shutter" data-shoot aria-label="Take selfie"></button>
        <span class="cam-count">${photos.length}/${MAX_PHOTOS}</span>
      </div>
      <div class="cam-roll">${photos.map((p, i) => `<button type="button" data-photo="${i}"><img src="${p}" alt=""></button>`).reverse().join('') || '<small>No selfies yet. Be brave.</small>'}</div>`;
  }

  // ---------- the selfie camera ----------
  let emote = settings.look().emote;
  const ownedEmotes = () => CATALOG.filter((c) => c.slot === 'emote' && settings.owns(c.id));
  function startCamera() {
    const canvas = screen?.querySelector('.cam-canvas');
    if (!canvas) return;
    stopCamera();
    selfie = new SelfieCam(canvas, { look: settings.look(), drunk: booze.level(), dave: dave.met() && (dave.here() || Math.random() < 0.4), emote });
  }
  function stopCamera() {
    selfie?.dispose();
    selfie = null;
  }
  settings.onChange((look) => {
    selfie?.setLook(look);
    if (look.emote !== emote && !layer) emote = look.emote;
  });

  function shoot() {
    if (!selfie) return;
    const f = screen.querySelector('.cam-flash');
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
    sound.blip(2400, 0.03, 'square', 0.08);
    sound.blip(900, 0.08, 'triangle', 0.07, 0.04);
    const url = selfie.snap({ caption: `Club Jackpot · ${money(getBalance())} 💸` });
    photos = [...photos, url].slice(-MAX_PHOTOS);
    emit('selfie');
    try {
      store.set('fr.selfies', photos);
    } catch {}
    render();
    startCamera();
  }

  // ---------- the cab home ----------
  function bookCab() {
    const fare = CAB.base * CAB.surge;
    if (getBalance() < fare) return toast(`💳 Declined. The ride is ${money(fare)}. You have ${money(getBalance())}. Walking it is.`);
    spend(fare);
    cab = 'coming';
    render();
    sound.blip(660, 0.1, 'triangle', 0.08);
    setTimeout(() => {
      cab = 'idle';
      const drinks = booze.count();
      const drunk = booze.bac() >= 3;
      close();
      setTimeout(() => {
        if (drunk) {
          booze.sober(99);
          hangover.wakeUpNow({ drinks, fare }, 'cab');
        } else {
          toast(`🚕 Kevin drove you round the block and dropped you back at the casino. "You looked lost." (-${money(fare)})`);
        }
      }, 700);
    }, 3200);
  }

  // ---------- food ----------
  function orderFood(item) {
    if (order) return toast('🛵 One order at a time. Marco has one scooter.');
    if (getBalance() < item.price) return toast(`💳 Declined. Even the ${money(item.price)} ${item.name}.`);
    spend(item.price);
    emit('food', { item });
    order = { item, left: ETA_S };
    sound.cash();
    render();
    const tick = setInterval(() => {
      order.left--;
      if (view === 'food') render();
      if (order.left > 0) return;
      clearInterval(tick);
      if (layer) close();
      setTimeout(() => arrive(item), 600);
    }, 1000);
  }

  function arrive(item) {
    const finish = () => (order = null);
    const eat = (from) => {
      const target = booze.target();
      throwDrink({ emoji: item.emoji }, from, target, () => {
        if (item.sober === 'mystery') {
          if (Math.random() < 0.35) {
            booze.add({ emoji: '🌯', name: 'Mystery Wrap (it was vodka)', abv: 1.5 });
          } else {
            booze.sober(3);
            toast('🌯 The Mystery Wrap was… great? You feel much better. Don\'t ask.');
          }
        } else {
          booze.sober(item.sober);
          toast(`${item.emoji} ${item.name} delivered! You feel ${item.sober > 1 ? 'a lot' : 'a bit'} less drunk.`);
        }
        finish();
      });
    };
    // no roulette room on screen (you're at the slots)? He just hands it over.
    if (!roomVisible() || !courier.deliver({ foodName: item.name.toLowerCase(), onArrive: eat, onStolen: () => {
      toast(`🍺 Dave ate your ${item.name}. Marco shrugs and leaves. No refunds.`);
      finish();
    } })) {
      eat({ x: innerWidth / 2, y: 120 });
    }
  }

  // ---------- taps ----------
  function onClick(e) {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.classList.contains('ph-homebar')) return show('home');
    if (t.dataset.app) return show(t.dataset.app);
    if (apps.get(view)?.click?.(t)) return;
    if (t.dataset.thread) {
      chatWith = t.dataset.thread;
      if (chatWith === 'gf') gf.markRead();
      else dave.markRead();
      sound.blip(1200, 0.03, 'sine', 0.05);
      return render();
    }
    if (t.dataset.gbreakup != null) {
      if (gfSure) gf.breakUp();
      gfSure = !gfSure;
      gfMenu = null;
      return render();
    }
    if (t.dataset.gmenu) {
      gfSure = false;
      gfMenu = gfMenu === t.dataset.gmenu ? null : t.dataset.gmenu;
      sound.blip(1100, 0.03, 'sine', 0.05);
      return render();
    }
    if (t.dataset.gdate) {
      gfMenu = null;
      gf.date(t.dataset.gdate);
      return render();
    }
    if (t.dataset.ggift) {
      gfMenu = null;
      gf.gift(t.dataset.ggift);
      return render();
    }
    if (t.dataset.gpropose != null) {
      gf.propose();
      return render();
    }
    if (t.dataset.greply) {
      if (gfTyping) return;
      gf.reply(t.dataset.greply, t.dataset.m);
      gfChips = null;
      sound.blip(1500, 0.03, 'sine', 0.06);
      return render();
    }
    if (t.dataset.reply) {
      if (typing) return;
      dave.reply(t.dataset.reply, t.dataset.m);
      chips = null;
      sound.blip(1500, 0.03, 'sine', 0.06);
      return render();
    }
    if (t.dataset.cab === 'book') return bookCab();
    if (t.dataset.food) return orderFood(FOOD.find((f) => f.id === t.dataset.food));
    if (t.dataset.shoot != null) return shoot();
    if (t.dataset.emote) {
      emote = t.dataset.emote;
      selfie?.setEmote(emote);
      screen.querySelectorAll('.cam-emote').forEach((b) => b.classList.toggle('on', b.dataset.emote === emote));
      return sound.blip(1200, 0.04, 'triangle', 0.07);
    }
    if (t.dataset.photo != null) {
      viewing = +t.dataset.photo;
      stopCamera();
      return render();
    }
    if (t.dataset.photoClose != null) {
      viewing = null;
      render();
      return startCamera();
    }
    if (t.dataset.settings != null) show('style');
  }

  // ---------- Dave talks to the phone ----------
  dave.on((type, data) => {
    if (type === 'typing') typing = data;
    if (type === 'message' || type === 'read') badge();
    if (layer && view === 'messages') {
      if (type === 'message') dave.markRead();
      render();
    }
  });
  const playTone = (id) => playRingtone(sound, (id || settings.look().ringtone).replace(/tone$/, ''));

  // ---------- …and so does Scarlett ----------
  gf.on((type, data) => {
    if (type === 'typing') gfTyping = data;
    badge();
    if (layer && view === 'messages') {
      if (type === 'message' && chatWith === 'gf') gf.markRead();
      render();
    }
  });
  gf.setHooks({
    tone: () => playTone(),
    isReading: () => !!layer && view === 'messages' && chatWith === 'gf',
    onText: () => {
      button.classList.remove('buzz');
      void button.offsetWidth;
      button.classList.add('buzz');
      overlay?.vibrate();
    },
  });
  dave.setHooks({
    tone: () => playTone(),
    openPhone: (app) => open(app),
    closePhone: close,
    isReading: () => (!!layer && view === 'messages') || !bannersOn(),
    phonePoint: () => {
      const r = button.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    },
    onText: () => {
      button.classList.remove('buzz');
      void button.offsetWidth;
      button.classList.add('buzz');
      overlay?.vibrate();
      badge();
    },
  });

  return {
    open,
    close,
    isOpen: () => !!layer,
    playTone,
    /** plug in an app (see the top of createPhone) */
    add(app) {
      apps.set(app.id, app);
      badge();
    },
    refresh,
    badge,
    /** which app is on screen (null when the phone is away) */
    current: () => (layer ? view : null),
  };
}
