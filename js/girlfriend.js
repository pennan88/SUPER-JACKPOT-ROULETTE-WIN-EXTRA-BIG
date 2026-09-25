// 💋 Your date: win a couple of spins and someone walks over to the roulette table. Pick a line. If it
// lands, you're together: they stand by the table cheering (or facepalming), text you, and a ❤️ meter
// goes up and down with how you treat them. Take them on dates, buy them gifts they actually wear,
// propose once the meter's full (Dave will be at the wedding, uninvited). Let it hit zero: dumped. By text.
//
// Who you date (girlfriend / boyfriend / partner) is a setting; it swaps names, looks and words.

import * as THREE from 'three';
import { buildAvatar, disposeAvatar, animateAvatar, DEFAULT_LOOK } from './avatar.js';
import { on, emit } from './events.js';

const pick = (a) => a[(Math.random() * a.length) | 0];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v) => Math.max(0, Math.min(100, v));
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');

const START = new THREE.Vector3(-13, 0.8, 2.9);
const SPOT = new THREE.Vector3(-4.4, 0.8, 2.9); // their place at the table, front left (the pick-up card sits on the right)
const RETRY_MS = 5 * 60_000; // turned down: another shot in a few minutes
const DUMPED_MS = 10 * 60_000;
const DATE_EVERY_MS = 3 * 60_000;
export const RING = 500; // wallet dollars
export const PROPOSE_AT = 90;

// who you date: the setting
export const WHO = [
  ['her', 'Girlfriend'],
  ['him', 'Boyfriend'],
  ['them', 'Partner'],
];
const WORDS = {
  her: { title: 'girlfriend', spouse: 'wife', their: 'her', they: 'she' },
  him: { title: 'boyfriend', spouse: 'husband', their: 'his', they: 'he' },
  them: { title: 'partner', spouse: 'spouse', their: 'their', they: 'they' },
};

// three people you might meet. taste: winner (loves a big win), sweet (lives for sweet texts),
// rich (only a high roller will do: gifts and fancy dates count extra, cheap ones count against you)
const PARTNERS = [
  {
    id: 'scarlett',
    emoji: '💋',
    taste: 'winner',
    names: { her: 'Scarlett', him: 'Sebastian', them: 'Sasha' },
    hi: '"Hey, lucky. Is this seat taken?"',
    looks: {
      her: { skin: '#e0ac69', hair: 'long', hairColor: '#c0182a', face: 'smirk', top: 'sequin', glasses: 'hearts', build: 'slim' },
      him: { skin: '#e0ac69', hair: 'short', hairColor: '#c0182a', face: 'smirk', top: 'leather', glasses: 'aviators', facial: 'stubble' },
      them: { skin: '#e0ac69', hair: 'spiky', hairColor: '#c0182a', face: 'smirk', top: 'hoodie', glasses: 'hearts', build: 'slim' },
    },
  },
  {
    id: 'mia',
    emoji: '🍸',
    taste: 'sweet',
    names: { her: 'Mia', him: 'Milo', them: 'Morgan' },
    hi: '"You look like you need a drink. And maybe some company."',
    looks: {
      her: { skin: '#c68642', hair: 'ponytail', hairColor: '#1c120c', face: 'grin', top: 'tank', shirt: '#2de0ff', neck: 'bowtie', build: 'slim' },
      him: { skin: '#c68642', hair: 'buzz', hairColor: '#1c120c', face: 'grin', top: 'tank', shirt: '#2de0ff', neck: 'bowtie' },
      them: { skin: '#c68642', hair: 'bun', hairColor: '#2de0ff', face: 'grin', top: 'tank', shirt: '#1f1f24', neck: 'bowtie' },
    },
  },
  {
    id: 'victoria',
    emoji: '💎',
    taste: 'rich',
    minLevel: 10,
    names: { her: 'Victoria', him: 'Victor', them: 'Vesper' },
    hi: '"Darling. I only date high rollers. Impress me."',
    looks: {
      her: { skin: '#f1c27d', hair: 'bun', hairColor: '#e8c46a', face: 'cool', top: 'goldsuit', neck: 'chain', glasses: 'monocle', build: 'slim' },
      him: { skin: '#f1c27d', hair: 'short', hairColor: '#e8c46a', face: 'cool', top: 'tux', neck: 'chain', glasses: 'monocle' },
      them: { skin: '#f1c27d', hair: 'long', hairColor: '#d9d9d9', face: 'cool', top: 'goldsuit', neck: 'chain', glasses: 'shutters' },
    },
  },
];

// what you can say when they walk over: [line, kind]
const LINES = [
  ['Only if you stay for the next spin. 😏', 'smooth'],
  ['Are you a roulette wheel? Because you make my heart spin.', 'cheesy'],
  ["My friend Dave says I'm a catch. He also owes me money.", 'dave'],
];
const REPLIES = {
  sweet: ['miss u ❤️', 'ur my lucky charm', 'come watch me win 🥰', 'thinking about u'],
  flirty: ['u up? 😏', 'nice outfit today', 'wanna split a bottle? 🍾', 'bet ur cuter than my odds'],
  cold: ['busy.', 'k', "can't talk, gambling", 'who is this'],
};
const LOVE = { sweet: 12, flirty: 8, cold: -18, ignored: -6, bigWin: 3, broke: -8, counted: -12 };
const ANSWERS = {
  sweet: ['awww 🥹', 'stoppp ❤️', "you're sweet. keep winning though", 'ok that was cute'],
  flirty: ['😏😏', 'maybe 👀', "behave. (don't)", 'buy me a drink first 🍸'],
  cold: ['wow ok', 'rude 🙄', 'noted.', "i'll remember that"],
};
const TEXTS = {
  happy: ['hey lucky 😘', 'win me something shiny 💎', 'the waiter asked about u. i said ur taken 😌', 'dinner after ur big win? 🍝'],
  meh: ['where are u?', 'u said u were coming to the table', 'are we doing this or not', 'hellooo?'],
  sad: ['are you even listening to me', 'dave texts me more than u do', "i'm starting to think u love roulette more than me", 'last chance.'],
};

// dates: paid from your chips, a little 3D scene, and love (rich tastes judge the cheap ones)
export const DATES = [
  { id: 'slots', emoji: '🐉', name: 'A spin on Dragon Rush', cost: 0, love: 5, prop: 'slots' },
  { id: 'kebab', emoji: '🥙', name: 'GrubGrab kebab', cost: 30, love: 8, prop: 'kebab' },
  { id: 'dinner', emoji: '🍝', name: 'Dinner at the hotel', cost: 250, love: 18, prop: 'pasta' },
  { id: 'vip', emoji: '🍾', name: 'VIP bottle service', cost: 2500, love: 35, prop: 'bottle' },
];
// gifts: store items they'll wear, paid from your wallet
export const GIFTS = [
  { id: 'rose', slot: 'held', emoji: '🌹', name: 'A rose', price: 60 },
  { id: 'party', slot: 'hat', emoji: '🎉', name: 'Party hat', price: 50 },
  { id: 'lei', slot: 'neck', emoji: '🌺', name: 'Flower lei', price: 60 },
  { id: 'stars', slot: 'glasses', emoji: '🤩', name: 'Star glasses', price: 350 },
  { id: 'chain', slot: 'neck', emoji: '⛓️', name: 'Gold chain', price: 1000 },
  { id: 'crown', slot: 'hat', emoji: '👑', name: 'High Roller Crown', price: 5000 },
];
const giftLove = (price) => Math.round(4 + 4 * Math.log10(Math.max(1, price))); // rose 11, chain 16, crown 19

/**
 * @param look()    your character
 * @param level()   your level (the heiress has standards)
 * @param spend(v)  dates come out of your chips; false if you can't afford it
 * @param wallet    gifts and the ring come out of your wallet
 * @param flair     the 3D overlay: date(...) and wedding(...)
 */
export function createGirlfriend({ wheel, store, sound, toast, booze, look, level, getBalance, spend, wallet, flair }) {
  const state = store.get('fr.gf', { met: false, dating: false, love: 50, thread: [], lastRead: 0, nextTry: 0 });
  state.partner ??= 'scarlett';
  state.gifts ??= {};
  state.lastDate ??= 0;
  const save = () => store.set('fr.gf', state);
  const hooks = {};
  const listeners = [];
  const tell = (type, data) => listeners.forEach((fn) => fn(type, data));

  const who = () => store.get('fr.gf.who', 'her');
  const words = () => WORDS[who()] || WORDS.her;
  const partner = (id = state.partner) => PARTNERS.find((p) => p.id === id) || PARTNERS[0];
  const name = (id) => partner(id).names[who()];
  const title = () => (state.married ? words().spouse : words().title);
  const theirLook = (id = state.partner) => ({ ...DEFAULT_LOOK, ...partner(id).looks[who()], ...(id === state.partner ? state.gifts : {}) });
  const rich = () => partner().taste === 'rich';

  let her = null; // the 3D date: { a, phase, t, emote, emoteUntil }
  let wins = 0;
  let spins = 0;
  let talking = null; // the pick-up card
  let readTimer = 0;
  let textTimer = 0;
  let engaged = false; // proposed, the ceremony's playing

  // ---------- in 3D, by the table ----------
  function arrive(then, id = state.partner) {
    if (her) return then?.();
    const a = buildAvatar(theirLook(id));
    a.root.scale.setScalar(0.74);
    a.root.position.copy(START);
    wheel.scene.add(a.root);
    her = { a, phase: 'in', t: 0, emote: null, emoteUntil: 0, then };
  }
  function leave() {
    if (!her || her.phase === 'out') return;
    her.phase = 'out';
    her.t = 0;
  }
  /** New clothes (a gift): swap the model where it stands. */
  function redress() {
    if (!her || her.phase !== 'stay') return;
    const pos = her.a.root.position.clone();
    wheel.scene.remove(her.a.root);
    disposeAvatar(her.a);
    her.a = buildAvatar(theirLook());
    her.a.root.scale.setScalar(0.74);
    her.a.root.position.copy(pos);
    wheel.scene.add(her.a.root);
  }
  function react(emote) {
    if (!her || her.phase !== 'stay') return;
    her.emote = emote;
    her.emoteUntil = wheel.clock.elapsedTime + 2.4;
  }

  wheel.onFrame((dt, t) => {
    if (!her) return;
    her.t += dt;
    const { a } = her;
    const p = a.root.position;
    let walking = her.phase !== 'stay';
    if (her.phase === 'in') {
      const k = Math.min(1, her.t / 3.2);
      p.lerpVectors(START, SPOT, k);
      if (k >= 1) {
        her.phase = 'stay';
        her.then?.();
        her.then = null;
        walking = false;
      }
    } else if (her.phase === 'out') {
      const k = Math.min(1, her.t / 3.2);
      p.lerpVectors(SPOT, START, k);
      if (k >= 1) {
        wheel.scene.remove(a.root);
        disposeAvatar(a);
        her = null;
        return;
      }
    }
    if (her.emote && t > her.emoteUntil) her.emote = null;
    animateAvatar(a, t, { emote: walking ? null : her.emote });
    const stride = walking ? Math.sin(t * 7) * 0.45 : 0;
    a.legs[0].rotation.x = stride;
    a.legs[1].rotation.x = -stride;
    a.root.rotation.y = walking ? (her.phase === 'in' ? Math.PI / 2 : -Math.PI / 2) : 0.5; // turned towards you
  });

  // ---------- meeting ----------
  function approach() {
    if (state.dating || talking || her || Date.now() < state.nextTry) return;
    const eligible = PARTNERS.filter((p) => !p.minLevel || level() >= p.minLevel);
    const p = pick(eligible);
    arrive(() => {
      sound.blip(660, 0.1, 'sine', 0.06);
      sound.blip(990, 0.14, 'sine', 0.06, 0.1);
      talking = document.createElement('div');
      talking.className = 'gf-talk';
      talking.dataset.partner = p.id;
      talking.innerHTML = `
        <div class="gf-who">${p.emoji} ${p.names[who()]}</div>
        <p>${p.hi}</p>
        <div class="gf-lines">${LINES.map(([l, k]) => `<button type="button" class="btn" data-line="${k}">${l}</button>`).join('')}</div>`;
      document.querySelector('.stage')?.appendChild(talking);
      talking.addEventListener('click', (e) => {
        const b = e.target.closest('[data-line]');
        if (b) answer(b.dataset.line, p);
      });
    }, p.id);
  }

  /** Does the line land? Your outfit, your streak and your blood alcohol all get a vote. */
  function answer(kind, p) {
    const drunk = booze.level();
    const me = look();
    let chance = 0.5;
    if (kind === 'smooth') chance += 0.15;
    if (kind === 'cheesy') chance += wins >= 3 ? 0.25 : -0.1; // cheesy works when you're winning
    if (kind === 'dave') chance += drunk >= 2 ? 0.2 : -0.25; // only funny if you're both a bit tipsy
    if (drunk >= 3) chance -= 0.2; // slurring
    if (me.top !== 'tshirt' || me.hat) chance += 0.1; // made an effort
    if (p.taste === 'rich' && getBalance() < 5000) chance -= 0.2; // "that's all you've got?"
    const yes = Math.random() < chance;
    talking.remove();
    talking = null;
    state.met = true;
    if (yes) {
      // a new number, a new thread
      if (state.partner !== p.id) state.thread = [];
      Object.assign(state, { dating: true, partner: p.id, love: 60, married: false, gifts: {}, lastRead: Date.now() });
      save();
      toast(`${p.emoji} ${name()} put ${words().their} number in your phone. You have a ${words().title}!`);
      react('wave');
      emit('girlfriend', { type: 'yes' });
      setTimeout(() => fromHer(pick(TEXTS.happy)), 4000);
      scheduleTexts();
    } else {
      state.nextTry = Date.now() + RETRY_MS;
      save();
      toast(`${p.emoji} ${p.names[who()]}: "${pick(['Nice try. 🙄', 'Wow. No.', 'Maybe when you win something big.', "I'm seeing someone. Their name is Not You."])}"`);
      setTimeout(leave, 600);
    }
  }

  // ---------- texting ----------
  function fromHer(msg) {
    state.thread = [...state.thread, { from: 'her', m: msg, t: Date.now() }].slice(-60);
    save();
    hooks.tone?.();
    hooks.onText?.();
    tell('message');
    if (!hooks.isReading?.()) toast(`${partner().emoji} ${name()}: ${msg}`);
  }

  function scheduleTexts() {
    clearTimeout(textTimer);
    if (!state.dating) return;
    textTimer = setTimeout(() => {
      if (!document.hidden && state.dating) {
        // texts you leave unanswered count against you
        if (unread() >= 2) setLove(state.love + LOVE.ignored);
        if (state.dating) fromHer(pick(state.love >= 55 ? TEXTS.happy : state.love >= 25 ? TEXTS.meh : TEXTS.sad));
      }
      scheduleTexts();
    }, rand(120_000, 240_000));
  }

  function reply(kind, msg) {
    state.thread = [...state.thread, { from: 'me', m: msg, t: Date.now() }].slice(-60);
    state.lastRead = Date.now();
    clearTimeout(readTimer);
    save();
    tell('message');
    setTimeout(() => {
      tell('typing', true);
      setTimeout(() => {
        tell('typing', false);
        let delta = kind === 'flirty' ? (Math.random() < 0.7 ? 15 : -5) : LOVE[kind];
        if (partner().taste === 'sweet') delta += kind === 'sweet' ? 4 : kind === 'cold' ? -7 : 0; // words matter more
        if (setLove(state.love + delta)) fromHer(pick(ANSWERS[delta < 0 ? 'cold' : kind]));
      }, rand(1200, 2600));
    }, 600);
  }

  function markRead() {
    const had = unread();
    state.lastRead = Date.now();
    save();
    tell('read');
    clearTimeout(readTimer);
    if (!had || !state.dating) return;
    // read and didn't answer? noted
    readTimer = setTimeout(() => {
      if (setLove(state.love + LOVE.ignored)) fromHer(pick(['left on read. cute.', '👀', 'ok then']));
    }, 45_000);
  }
  const unread = () => state.thread.filter((x) => x.from === 'her' && x.t > state.lastRead).length;

  /** Move the ❤️ meter; returns false if that was the end of it. */
  function setLove(v) {
    state.love = clamp(v);
    save();
    tell('love');
    if (state.dating && state.love <= 0) {
      dumped();
      return false;
    }
    return true;
  }

  function dumped() {
    const wasMarried = state.married;
    Object.assign(state, { dating: false, married: false, love: 0, gifts: {}, nextTry: Date.now() + DUMPED_MS });
    save();
    clearTimeout(textTimer);
    if (wasMarried) {
      fromHer("i've sent the divorce papers to the hotel. 💔");
      setTimeout(() => fromHer('i get the cone.'), 1500);
    } else {
      fromHer("it's not me. it's you. 💔");
      setTimeout(() => fromHer('dave can have ur number instead'), 1500);
    }
    sound.blip(330, 0.4, 'triangle', 0.08);
    sound.blip(262, 0.6, 'triangle', 0.08, 0.35);
    leave();
    emit('girlfriend', { type: 'dumped' });
  }

  // ---------- dates, gifts, the ring ----------
  function date(id) {
    const d = DATES.find((x) => x.id === id);
    if (!d || !state.dating) return;
    const wait = state.lastDate + DATE_EVERY_MS - Date.now();
    if (wait > 0) return toast(`${partner().emoji} "We literally just went out. Give it ${Math.ceil(wait / 60000)} min."`);
    if (d.cost && !spend(d.cost)) return toast(`💳 ${d.name} is ${money(d.cost)}. You have ${money(getBalance())} in chips.`);
    state.lastDate = Date.now();
    save();
    // the rich one isn't impressed by kebabs
    let delta = d.love;
    if (rich()) delta = d.cost >= 250 ? Math.round(d.love * 1.5) : -6;
    flair.date({ me: look(), them: theirLook(), prop: d.prop }, () => {
      if (!setLove(state.love + delta)) return;
      fromHer(delta < 0 ? pick(['a kebab. really.', "i've had better dates with my accountant", 'next time: champagne.']) : pick([`${d.emoji} best date ever`, 'ok that was really fun 🥰', 'again tomorrow?', "you're full of surprises"]));
      emit('girlfriend', { type: 'date' });
      react('wave');
    });
  }

  function gift(id) {
    const g = GIFTS.find((x) => x.id === id);
    if (!g || !state.dating) return;
    if (wallet.cash() < g.price) return toast(`👛 ${g.name} is ${money(g.price)} from your wallet. You have ${money(wallet.cash())}.`);
    wallet.spend(g.price);
    state.gifts = { ...state.gifts, [g.slot]: g.id };
    save();
    sound.cash?.();
    redress();
    react('peace');
    const delta = Math.round(giftLove(g.price) * (rich() ? 1.5 : 1));
    if (setLove(state.love + delta)) setTimeout(() => fromHer(pick([`${g.emoji} omg i love it`, `wearing it right now ${g.emoji}`, 'you shouldnt have. (you should have)'])), 1200);
  }

  function propose() {
    if (!state.dating || state.married || engaged || state.love < PROPOSE_AT) return;
    if (wallet.cash() < RING) return toast(`💍 A ring is ${money(RING)} from your wallet. You have ${money(wallet.cash())}.`);
    wallet.spend(RING);
    engaged = true;
    flair.wedding({ me: look(), them: theirLook() }, () => {
      engaged = false;
      state.married = true;
      state.love = 100;
      save();
      tell('love');
      toast(`💍 You married ${name()}! Dave was the best man. Nobody invited him.`);
      emit('girlfriend', { type: 'married' });
      setTimeout(() => fromHer('hi, spouse 🥹💍'), 2500);
    });
  }

  // ---------- they follow your luck ----------
  on('spin', (e) => {
    if (e.game !== 'roulette') return;
    spins++;
    wins = e.net > 0 ? wins + 1 : e.net < 0 ? 0 : wins;
    if (state.dating) {
      react(e.multiple >= 5 ? 'dab' : e.net > 0 ? 'wave' : e.net < 0 ? 'facepalm' : null);
      if (e.multiple >= 5) setLove(state.love + LOVE.bigWin * (partner().taste === 'winner' ? 2 : 1));
      if (e.net < 0 && getBalance() < 1) {
        if (setLove(state.love + LOVE.broke)) setTimeout(() => fromHer('babe. are you ok? 😬'), 2500);
      }
    } else if (spins >= 3 && wins >= 2 && Math.random() < 0.5) setTimeout(approach, 1800);
  });
  on('blackjack', (e) => {
    if (e.type === 'counted' && state.dating && setLove(state.love + LOVE.counted)) setTimeout(() => fromHer('you got thrown out of BLACKJACK?? 🙄'), 3000);
  });

  // already together? they're at the table when you get there
  if (state.dating) {
    arrive();
    scheduleTexts();
  }

  return {
    name: () => name(),
    emoji: () => partner().emoji,
    title,
    met: () => state.met,
    dating: () => state.dating,
    married: () => !!state.married,
    engaged: () => engaged,
    love: () => state.love,
    thread: () => state.thread,
    gifts: () => state.gifts,
    replies: REPLIES,
    reply,
    markRead,
    unread,
    date,
    gift,
    propose,
    /** the "who you date" setting changed: new clothes, same person */
    restyle: () => redress(),
    /** 'message' | 'typing' | 'read' | 'love' */
    on: (fn) => listeners.push(fn),
    /** the phone plugs in: tone(), onText(), isReading() */
    setHooks: (h) => Object.assign(hooks, h),
  };
}
