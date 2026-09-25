// ⚙️ YOUR STYLE, THE STORE, GOALS AND SETTINGS: four apps on your phone. Your 3D character on a
// turntable, a character editor, a store for hats and bling, and the actual settings (sound, music,
// Dave, motion).

import { AvatarStage, BASE, CATALOG, SLOTS, REQUIRED_SLOTS, DEFAULT_LOOK, portrait } from './avatar.js';
import { itemLevel } from './levels.js';
import { emit } from './events.js';

const PHONE_SLOTS = new Set(['phoneSkin', 'wallpaper']);

const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const byId = (id) => CATALOG.find((c) => c.id === id);

/**
 * @param prefs     [{ id, label, desc, get: () => bool, set: (bool) => void }]
 * @param preview   { tone(id), win(id) }: hear a ringtone, see a win style
 * @param wallet    the store only takes wallet money ({ cash(), spend(v) })
 * @param levels    fancier items need a level ({ level(), progress() })
 * @param goals     the Goals app: { html(), input(el), trophies() }
 * @param openApp   (id) => show another phone app
 * @returns app(id) to plug into the phone, plus your look
 */
export function createSettings({ store, sound, toast, wallet, levels, goals, prefs, openApp, preview: demo = {} }) {
  const getBalance = () => wallet.cash();
  let look = { ...DEFAULT_LOOK, ...store.get('fr.look', {}) };
  let owned = new Set(store.get('fr.owned', ['tshirt']));
  CATALOG.filter((c) => c.price === 0).forEach((c) => owned.add(c.id)); // the free defaults
  const save = () => {
    store.set('fr.look', look);
    store.set('fr.owned', [...owned]);
  };
  const listeners = [];

  // your face, for the Style app's icon
  let face = '';
  function refreshFace() {
    try {
      face = portrait(look);
    } catch {
      face = ''; // no WebGL for portraits: the emoji will do
    }
  }
  refreshFace();

  let host = null; // the phone view the app is drawn in
  let stage = null;
  let tab = null; // which of our apps is showing
  let trying = null; // a store item you're trying on (not bought)
  let storeSlot = 'all';
  let showPhone = false;

  function preview() {
    const l = trying ? { ...look, [trying.slot]: trying.id } : look;
    stage?.setLook(l, { phoneInHand: showPhone || PHONE_SLOTS.has(trying?.slot) });
  }

  /** What trying (or equipping) something does, besides dressing you up. */
  function demoItem(item) {
    if (PHONE_SLOTS.has(item.slot)) showPhone = true;
    if (item.slot === 'ringtone') demo.tone?.(item.id);
    if (item.slot === 'winFx') demo.win?.(item.id);
    if (item.slot === 'emote') stage?.playEmote(item.id);
  }

  function setLook(patch) {
    for (const [slot, id] of Object.entries(patch)) {
      const item = CATALOG.find((c) => c.id === id && c.slot === slot);
      if (item) demoItem(item);
    }
    look = { ...look, ...patch };
    save();
    preview();
    refreshFace();
    listeners.forEach((fn) => fn(look));
    sound.blip(1200, 0.04, 'triangle', 0.07);
  }

  // ---------- the apps' insides ----------
  const swatches = (key, colors) =>
    `<div class="st-swatches">${colors
      .map((c) => `<button type="button" class="st-sw${look[key] === c ? ' on' : ''}" data-set="${key}" data-val="${c}" style="--c:${c}" aria-label="${c}"></button>`)
      .join('')}</div>`;
  const chips = (key, opts) =>
    `<div class="st-chips">${opts
      .map(([v, label]) => `<button type="button" class="st-chip${look[key] === v ? ' on' : ''}" data-set="${key}" data-val="${v}">${label}</button>`)
      .join('')}</div>`;

  function characterHtml() {
    const slotRow = ([slot, label]) => {
      const mine = CATALOG.filter((c) => c.slot === slot && owned.has(c.id));
      const none = REQUIRED_SLOTS.has(slot) ? '' : `<button type="button" class="st-chip${!look[slot] ? ' on' : ''}" data-set="${slot}" data-val="">None</button>`;
      return `<h4>${label}</h4><div class="st-chips">${none}${mine
        .map((c) => `<button type="button" class="st-chip${look[slot] === c.id ? ' on' : ''}" data-set="${slot}" data-val="${c.id}">${c.emoji} ${c.name}</button>`)
        .join('')}${mine.length < CATALOG.filter((c) => c.slot === slot).length ? `<button type="button" class="st-chip st-more" data-goto="store" data-slot="${slot}">🛍️ More…</button>` : ''}</div>`;
    };
    return `
      <h4>Skin</h4>${swatches('skin', BASE.skin)}
      <h4>Hair</h4>${chips('hair', BASE.hair)}
      <h4>Hair colour</h4>${swatches('hairColor', BASE.hairColor)}
      <h4>Facial hair</h4>${chips('facial', BASE.facial)}
      <h4>Expression</h4>${chips('face', BASE.face)}
      <h4>Build</h4>${chips('build', BASE.build)}
      <h4>T-shirt colour ${!['tshirt', 'tank'].includes(look.top) ? '<small>(wear the T-shirt or tank top to see it)</small>' : ''}</h4>${swatches('shirt', BASE.shirt)}
      <h4>Pants colour ${['tux', 'goldsuit', 'sequin', 'tracksuit', 'bathrobe'].includes(look.top) ? '<small>(this outfit comes with its own)</small>' : ''}</h4>${swatches('pants', BASE.pants)}
      <h4>Shoes ${['tux', 'bathrobe'].includes(look.top) ? '<small>(this outfit comes with its own)</small>' : ''}</h4>${swatches('shoes', BASE.shoes)}
      <div class="st-sep">Your stuff</div>
      ${SLOTS.map(slotRow).join('')}`;
  }

  function storeHtml() {
    const bal = getBalance();
    const lvl = levels.level();
    const items = CATALOG.filter((c) => c.price > 0 && (storeSlot === 'all' || c.slot === storeSlot));
    const filters = [['all', '✨ All'], ...SLOTS];
    return `
      <div class="st-chips st-filters">${filters
        .map(([v, label]) => `<button type="button" class="st-chip${storeSlot === v ? ' on' : ''}" data-filter="${v}">${label}</button>`)
        .join('')}</div>
      <div class="st-store">${items
        .map((c) => {
          const has = owned.has(c.id);
          const worn = look[c.slot] === c.id;
          const onTry = trying?.id === c.id;
          const need = itemLevel(c);
          const locked = !has && lvl < need;
          const btn = has
            ? `<button type="button" class="btn st-equip${worn ? ' worn' : ''}" data-equip="${c.id}">${worn ? '✓ Equipped' : 'Equip'}</button>`
            : locked
              ? `<button type="button" class="btn st-buy locked" data-buy="${c.id}">🔒 Level ${need} · ${money(c.price)}</button>`
              : `<button type="button" class="btn gold st-buy${bal < c.price ? ' broke' : ''}" data-buy="${c.id}">Buy ${money(c.price)}</button>`;
          return `<div class="st-item${onTry ? ' trying' : ''}${has ? ' owned' : ''}${locked ? ' locked' : ''}">
            <button type="button" class="st-try" data-try="${c.id}" title="Try it on">
              <span class="st-emoji">${c.emoji}</span>
              <b>${c.name}</b>
              ${c.note ? `<small>${c.note}</small>` : ''}
              <em>${onTry ? '👀 Trying on' : { ringtone: '🔊 Tap to listen', winFx: '🎉 Tap to preview', emote: '🤳 Tap to see it' }[c.slot] || (has ? 'Owned' : 'Tap to try on')}</em>
            </button>
            ${btn}
          </div>`;
        })
        .join('')}</div>
      <p class="st-note">The store only takes wallet money 👛. Cash out your chips in the 🏦 Bank.</p>`;
  }

  function prefsHtml() {
    return `<div class="st-prefs">${prefs
      .map((p) =>
        p.options
          ? `<div class="st-pref"><span><b>${p.label}</b><small>${p.desc}</small></span>
          <div class="st-opts">${p.options.map(([v, l]) => `<button type="button" class="st-chip${p.get() === v ? ' on' : ''}" data-pref-opt="${p.id}" data-val="${v}">${l}</button>`).join('')}</div></div>`
          : `<label class="st-pref">
          <span><b>${p.label}</b><small>${p.desc}</small></span>
          <input type="checkbox" data-pref="${p.id}" ${p.get() ? 'checked' : ''}><i class="st-switch"></i>
        </label>`
      )
      .join('')}</div>
      <p class="st-note">Your character and everything you've bought are saved in this browser.</p>`;
  }

  // the strip under the turntable: your wallet and your level
  function barHtml() {
    const p = levels.progress();
    return `<span class="sa-wallet">👛 <b>${money(getBalance())}</b></span>
      <button type="button" class="sa-cash" data-app="bank">Cash out</button>
      <span class="st-lvl" title="${p.into} / ${p.need} XP to level ${p.level + 1}">⭐ Level ${p.level} <i style="--p:${(p.into / p.need).toFixed(3)}"></i></span>`;
  }

  const BODY = { style: characterHtml, store: storeHtml, goals: () => goals.html(), settings: prefsHtml };

  function redraw() {
    if (!host) return;
    const body = host.querySelector('.ph-scroll');
    const top = body.scrollTop;
    body.innerHTML = BODY[tab]();
    body.scrollTop = top;
    const bar = host.querySelector('.sa-bar');
    if (bar) bar.innerHTML = barHtml();
  }

  // ---------- plugging into the phone ----------
  function app(id, { label, emoji, title, sub, stageH = 0, bar = false, dock = false, icon }) {
    return {
      id,
      label,
      emoji,
      dock,
      icon,
      html: (header) => `${header(title, sub)}
        ${stageH ? `<div class="sa-stage" style="height:${stageH}px"><span class="sa-hint">Drag to spin 👆</span></div>` : ''}
        ${bar ? `<div class="sa-bar">${barHtml()}</div>` : ''}
        <div class="ph-scroll st-body">${BODY[id]()}</div>`,
      mount(v) {
        host = v;
        tab = id;
        const box = v.querySelector('.sa-stage');
        if (!box) return;
        stage = new AvatarStage(box, look);
        stage.setShelf(goals.trophies());
        showPhone = PHONE_SLOTS.has(storeSlot) && id === 'store';
        preview();
      },
      unmount() {
        if (tab !== id) return;
        stage?.dispose();
        stage = null;
        host = null;
        tab = null;
        trying = null;
        showPhone = false;
      },
      update: redraw,
      click,
      change,
    };
  }

  const apps = [
    app('style', { label: 'Style', emoji: '👤', title: 'Your style', sub: 'you, but better', stageH: 290, icon: () => (face ? `<img class="ph-face" src="${face}" alt="">` : '') }),
    app('store', { label: 'Store', emoji: '🛍️', title: 'Club Jackpot Store', sub: 'try anything on for free', stageH: 210, bar: true }),
    app('goals', { label: 'Goals', emoji: '🏆', title: 'Goals', sub: 'your trophies are on the shelf', stageH: 170, bar: true }),
    app('settings', { label: 'Settings', emoji: '⚙️', title: 'Settings', dock: true }),
  ];

  // ---------- taps ----------
  function click(t) {
    if (t.dataset.prefOpt) {
      prefs.find((p) => p.id === t.dataset.prefOpt)?.set(t.dataset.val);
      sound.blip(1000, 0.05, 'triangle', 0.08);
      redraw();
    } else if (tab === 'goals' && goals.input(t)) {
      redraw();
    } else if (t.dataset.set) {
      setLook({ [t.dataset.set]: t.dataset.val || null });
      redraw();
    } else if (t.dataset.goto) {
      storeSlot = t.dataset.slot || 'all';
      openApp(t.dataset.goto);
    } else if (t.dataset.filter) {
      storeSlot = t.dataset.filter;
      showPhone = PHONE_SLOTS.has(storeSlot);
      preview();
      redraw();
    } else if (t.dataset.try) {
      const item = byId(t.dataset.try);
      if (['ringtone', 'winFx', 'emote'].includes(item.slot)) {
        demoItem(item);
        return true;
      }
      trying = trying?.id === item.id ? null : item;
      demoItem(item);
      preview();
      sound.blip(trying ? 1000 : 700, 0.05, 'triangle', 0.07);
      redraw();
    } else if (t.dataset.equip) {
      const item = byId(t.dataset.equip);
      trying = null;
      setLook({ [item.slot]: look[item.slot] === item.id && !REQUIRED_SLOTS.has(item.slot) ? null : item.id });
      redraw();
    } else if (t.dataset.buy) {
      const item = byId(t.dataset.buy);
      if (levels.level() < itemLevel(item)) {
        sound.blip(160, 0.2, 'sawtooth', 0.1);
        toast(`🔒 ${item.name} unlocks at level ${itemLevel(item)}. You're level ${levels.level()}: keep betting!`);
        return true;
      }
      if (getBalance() < item.price) {
        sound.blip(160, 0.2, 'sawtooth', 0.1);
        toast(`👛 ${item.name} costs ${money(item.price)}. Your wallet has ${money(getBalance())}. Cash out some chips in the 🏦 Bank first.`);
        return true;
      }
      wallet.spend(item.price);
      owned.add(item.id);
      emit('buy', { item });
      trying = null;
      sound.cash();
      setLook({ [item.slot]: item.id });
      toast(`🛍️ ${item.emoji} ${item.name} bought and equipped! (-${money(item.price)})`);
      redraw();
    } else return false;
    return true;
  }

  function change(el) {
    if (el.dataset.perk) return goals.input(el);
    const id = el.dataset.pref;
    if (!id) return;
    prefs.find((p) => p.id === id)?.set(el.checked);
    sound.blip(el.checked ? 1000 : 600, 0.05, 'triangle', 0.08);
  }

  return {
    /** one of the phone apps: style, store, goals or settings */
    app: (id) => apps.find((a) => a.id === id),
    look: () => look,
    owns: (id) => owned.has(id),
    /** wallet or level changed: redraw, keeping your scroll */
    refresh() {
      redraw();
      stage?.setShelf(goals.trophies());
    },
    /** fn(look) whenever your character changes */
    onChange: (fn) => listeners.push(fn),
  };
}
