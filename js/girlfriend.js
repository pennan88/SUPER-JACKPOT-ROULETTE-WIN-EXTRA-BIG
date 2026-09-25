// 💋 Scarlett: win a couple of spins and she walks over to the roulette table. Pick a line. If it
// lands, she's your girlfriend: she stands by the table cheering (or facepalming), texts you, and a
// ❤️ meter goes up and down with how you treat her. Let it hit zero and she dumps you. By text.

import * as THREE from 'three';
import { buildAvatar, disposeAvatar, animateAvatar, DEFAULT_LOOK } from './avatar.js';
import { on, emit } from './events.js';

const NAME = 'Scarlett';
const pick = (a) => a[(Math.random() * a.length) | 0];
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v) => Math.max(0, Math.min(100, v));

const START = new THREE.Vector3(-13, 0.8, 2.9);
const SPOT = new THREE.Vector3(-4.4, 0.8, 2.9); // her place at the table, front left (the pick-up card sits on the right)
const RETRY_MS = 5 * 60_000; // turned down: she'll give you another shot in a few minutes
const DUMPED_MS = 10 * 60_000;

// what you can say when she walks over: [line, kind]
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
  flirty: ['😏😏', 'maybe 👀', 'behave. (don\'t)', 'buy me a drink first 🍸'],
  cold: ['wow ok', 'rude 🙄', 'noted.', "i'll remember that"],
};
const TEXTS = {
  happy: ['hey lucky 😘', 'win me something shiny 💎', 'the waiter asked about u. i said ur taken 😌', 'dinner after ur big win? 🍝'],
  meh: ['where are u?', 'u said u were coming to the table', 'are we doing this or not', 'hellooo?'],
  sad: ["are you even listening to me", 'dave texts me more than u do', "i'm starting to think u love roulette more than me", 'last chance.'],
};

export function createGirlfriend({ wheel, store, sound, toast, booze, look, getBalance }) {
  const state = store.get('fr.gf', { met: false, dating: false, love: 50, thread: [], lastRead: 0, nextTry: 0 });
  const save = () => store.set('fr.gf', state);
  const hooks = {};
  const listeners = [];
  const tell = (type, data) => listeners.forEach((fn) => fn(type, data));

  let her = null; // the 3D Scarlett: { a, phase, t, emote, emoteUntil }
  let wins = 0;
  let spins = 0;
  let talking = null; // the pick-up card
  let readTimer = 0;
  let textTimer = 0;

  // ---------- in 3D, by the table ----------
  function arrive(then) {
    if (her) return then?.();
    const a = buildAvatar({ ...DEFAULT_LOOK, skin: '#e0ac69', hair: 'long', hairColor: '#c0182a', face: 'smirk', top: 'sequin', shirt: '#c0182a', glasses: 'hearts', build: 'slim' });
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

  // ---------- meeting her ----------
  function approach() {
    if (state.dating || talking || her || Date.now() < state.nextTry) return;
    arrive(() => {
      sound.blip(660, 0.1, 'sine', 0.06);
      sound.blip(990, 0.14, 'sine', 0.06, 0.1);
      talking = document.createElement('div');
      talking.className = 'gf-talk';
      talking.innerHTML = `
        <div class="gf-who">💋 ${NAME}</div>
        <p>"Hey, lucky. Is this seat taken?"</p>
        <div class="gf-lines">${LINES.map(([l, k]) => `<button type="button" class="btn" data-line="${k}">${l}</button>`).join('')}</div>`;
      document.querySelector('.stage')?.appendChild(talking);
      talking.addEventListener('click', (e) => {
        const b = e.target.closest('[data-line]');
        if (b) answer(b.dataset.line);
      });
    });
  }

  /** Does the line land? Your outfit, your streak and your blood alcohol all get a vote. */
  function answer(kind) {
    const drunk = booze.level();
    const me = look();
    let p = 0.5;
    if (kind === 'smooth') p += 0.15;
    if (kind === 'cheesy') p += wins >= 3 ? 0.25 : -0.1; // cheesy works when you're winning
    if (kind === 'dave') p += drunk >= 2 ? 0.2 : -0.25; // only funny if you're both a bit tipsy
    if (drunk >= 3) p -= 0.2; // slurring
    if (me.top !== 'tshirt' || me.hat) p += 0.1; // made an effort
    const yes = Math.random() < p;
    talking.remove();
    talking = null;
    state.met = true;
    if (yes) {
      state.dating = true;
      state.love = 60;
      save();
      toast(`💋 ${NAME} put her number in your phone. You have a girlfriend!`);
      react('wave');
      emit('girlfriend', { type: 'yes' });
      setTimeout(() => fromHer(pick(TEXTS.happy)), 4000);
      scheduleTexts();
    } else {
      state.nextTry = Date.now() + RETRY_MS;
      save();
      toast(`💋 ${NAME}: "${pick(['Nice try. 🙄', 'Wow. No.', 'Maybe when you win something big.', 'I have a boyfriend. His name is Not You.'])}"`);
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
    if (!hooks.isReading?.()) toast(`💋 ${NAME}: ${msg}`);
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
        const delta = kind === 'flirty' ? (Math.random() < 0.7 ? 15 : -5) : LOVE[kind];
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
    // read and didn't answer? she noticed
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
    state.dating = false;
    state.love = 0;
    state.nextTry = Date.now() + DUMPED_MS;
    save();
    clearTimeout(textTimer);
    fromHer("it's not me. it's you. 💔");
    setTimeout(() => fromHer('dave can have ur number instead'), 1500);
    sound.blip(330, 0.4, 'triangle', 0.08);
    sound.blip(262, 0.6, 'triangle', 0.08, 0.35);
    leave();
    emit('girlfriend', { type: 'dumped' });
  }

  // ---------- she follows your luck ----------
  on('spin', (e) => {
    if (e.game !== 'roulette') return;
    spins++;
    wins = e.net > 0 ? wins + 1 : e.net < 0 ? 0 : wins;
    if (state.dating) {
      react(e.multiple >= 5 ? 'dab' : e.net > 0 ? 'wave' : e.net < 0 ? 'facepalm' : null);
      if (e.multiple >= 5) setLove(state.love + LOVE.bigWin);
      if (e.net < 0 && getBalance() < 1) {
        if (setLove(state.love + LOVE.broke)) setTimeout(() => fromHer('babe. are you ok? 😬'), 2500);
      }
    } else if (spins >= 3 && wins >= 2 && Math.random() < 0.5) setTimeout(approach, 1800);
  });
  on('blackjack', (e) => {
    if (e.type === 'counted' && state.dating && setLove(state.love + LOVE.counted)) setTimeout(() => fromHer('you got thrown out of BLACKJACK?? 🙄'), 3000);
  });

  // already together? she's at the table when you get there
  if (state.dating) {
    arrive();
    scheduleTexts();
  }

  return {
    name: NAME,
    met: () => state.met,
    dating: () => state.dating,
    love: () => state.love,
    thread: () => state.thread,
    replies: REPLIES,
    reply,
    markRead,
    unread,
    /** 'message' | 'typing' | 'read' | 'love' */
    on: (fn) => listeners.push(fn),
    /** the phone plugs in: tone(), onText(), isReading() */
    setHooks: (h) => Object.assign(hooks, h),
  };
}
