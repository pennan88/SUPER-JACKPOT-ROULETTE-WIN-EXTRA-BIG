// 🗺️ MAP, an app on your phone: the whole casino floor in 3D (map3d.js). Pick a place, walk there.
// A new room is a place here, a model in map3d.js and a case in main.js's go(). (A place that isn't
// open yet gets soon: true: roped off, and you can't walk in.)

import { CasinoMap } from './map3d.js';

export const PLACES = [
  { id: 'slots', emoji: '🐉', name: 'Dragon Rush', color: '#ff2d9a', pos: [-0.4, -4.6], desc: '7×7 tumbling slots, ×1024 spots. DING DING DING.' },
  { id: 'roulette', emoji: '🎡', name: 'Roulette', color: '#2de08f', pos: [-0.4, 0.4], desc: 'The big wheel. Red or black. Mostly black.' },
  { id: 'blackjack', emoji: '🃏', name: 'Blackjack', color: '#3fa9ff', pos: [-0.4, 5.0], desc: 'Pays 3 to 2. A very smug dealer, and regulars with opinions.' },
];
const byId = (id) => PLACES.find((p) => p.id === id);

/**
 * @param here    () => the place you're at ('roulette', 'slots' or 'blackjack')
 * @param go      (id) => actually go there (put the phone away, walk into the room)
 * @param blocked (id) => why you can't go there right now ('' if you can)
 * @param look    () => your character
 * @param daveMet () => does Dave hang round the roulette table yet?
 */
export function createMap({ sound, toast, here, go, blocked = () => '', look, daveMet }) {
  let map = null;
  let view = null;
  let selected = null;
  let walking = false;
  let steps = null; // the footsteps timer

  function cardHtml() {
    const p = byId(selected);
    if (!p) return `<div class="mp-card mp-idle"><span class="mp-big">📍</span><div><b>You're at ${byId(here()).name}</b><small>Tap a spot on the map, or pick one below. Drag to look around.</small></div></div>`;
    const at = p.id === here();
    const btn = p.soon
      ? '<button type="button" class="mp-go soon" data-go>🚧 Coming soon</button>'
      : at
      ? '<button type="button" class="mp-go here" data-go>📍 You\'re here</button>'
      : `<button type="button" class="mp-go" data-go style="--c:${p.color}">${walking ? 'Walking…' : 'Go ➜'}</button>`;
    return `<div class="mp-card" style="--c:${p.color}"><span class="mp-big">${p.emoji}</span><div><b>${p.name}</b><small>${p.desc}</small></div>${btn}</div>`;
  }

  function listHtml() {
    const h = here();
    return PLACES.map(
      (p) => `<button type="button" class="mp-place${p.id === selected ? ' on' : ''}${p.soon ? ' soon' : ''}" data-place="${p.id}" style="--c:${p.color}">
        <span>${p.emoji}</span><small>${p.name}</small>${p.id === h ? '<i>YOU</i>' : p.soon ? '<i>SOON</i>' : ''}
      </button>`
    ).join('');
  }

  function redraw() {
    if (!view) return;
    view.querySelector('.mp-info').innerHTML = cardHtml();
    view.querySelector('.mp-list').innerHTML = listHtml();
  }

  function pick(id) {
    if (walking) return;
    selected = selected === id ? null : id;
    map?.select(selected);
    sound.blip(selected ? 1100 : 700, 0.05, 'triangle', 0.07);
    redraw();
  }

  function walk() {
    const p = byId(selected);
    if (!p || walking) return;
    if (p.soon) {
      sound.blip(160, 0.2, 'sawtooth', 0.1);
      view.querySelector('.mp-go')?.animate([{ translate: '0' }, { translate: '-6px' }, { translate: '6px' }, { translate: '0' }], { duration: 250 });
      return toast(`🚧 ${p.name} is coming soon™. There's a velvet rope and everything.`);
    }
    if (p.id === here()) return toast(`📍 You're already at ${p.name}.`);
    const why = blocked(p.id);
    if (why) return toast(why);
    walking = true;
    redraw();
    sound.blip(880, 0.06, 'triangle', 0.08);
    sound.blip(1320, 0.08, 'triangle', 0.07, 0.07);
    // footsteps
    steps = setInterval(() => sound.blip(180 + Math.random() * 40, 0.03, 'sine', 0.05), 170);
    map.travel(p.id, () => {
      clearInterval(steps);
      walking = false;
      sound.blip(1568, 0.12, 'sine', 0.09);
      go(p.id);
    });
  }

  return {
    id: 'map',
    label: 'Map',
    emoji: '🗺️',
    dock: true,
    html: (header) => `${header('Club Jackpot', 'casino floor map')}
      <div class="mp-map"><canvas class="mp-canvas"></canvas><span class="mp-legend">Tap a spot to go there · drag to look around</span></div>
      <div class="mp-info">${cardHtml()}</div>
      <div class="mp-list">${listHtml()}</div>`,
    mount(v) {
      view = v;
      selected = null;
      walking = false;
      map = new CasinoMap(v.querySelector('.mp-canvas'), { places: PLACES, here: here(), look: look(), dave: daveMet(), onPick: pick });
      sound.blip(520, 0.12, 'sine', 0.06);
      sound.blip(780, 0.16, 'sine', 0.05, 0.12);
    },
    unmount() {
      clearInterval(steps);
      map?.dispose();
      map = null;
      view = null;
      walking = false;
    },
    update: redraw,
    click(t) {
      if (t.dataset.place) pick(t.dataset.place);
      else if (t.dataset.go != null) walk();
      else return false;
      return true;
    },
  };
}
