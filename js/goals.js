// 🏆 Goals: three daily challenges, achievements (trophies on your shelf), a loyalty card that
// stamps your losses and pays out nothing, and the perks your level unlocks.

import { on } from './events.js';

const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const today = () => new Date().toDateString();

// ---------- daily challenges ----------
// test(e, ctx) says whether an event counts; goal is how many times
export const CHALLENGES = [
  { id: 'win3', emoji: '🎡', text: 'Win 3 roulette spins', goal: 3, on: 'spin', test: (e) => e.game === 'roulette' && e.net > 0, xp: 80, cash: 20 },
  { id: 'streak', emoji: '🔥', text: 'Win 2 spins in a row', goal: 1, on: 'spin', test: (e, c) => c.streak >= 2, xp: 100, cash: 25 },
  { id: 'straight', emoji: '🎯', text: 'Hit a straight-up number', goal: 1, on: 'spin', test: (e) => e.straight, xp: 150, cash: 40 },
  { id: 'slots10', emoji: '🐉', text: 'Spin the slots 10 times', goal: 10, on: 'spin', test: (e) => e.game === 'slots', xp: 70, cash: 15 },
  { id: 'bigx', emoji: '💥', text: 'Get 5× your stake back on one spin', goal: 1, on: 'spin', test: (e) => e.multiple >= 5, xp: 120, cash: 30 },
  { id: 'bigbet', emoji: '💰', text: 'Bet $500 or more on one spin', goal: 1, on: 'spin', test: (e) => e.staked >= 500, xp: 80, cash: 20 },
  { id: 'lose5', emoji: '📉', text: 'Lose 5 spins. We believe in you.', goal: 5, on: 'spin', test: (e) => e.net < 0, xp: 60, cash: 15 },
  { id: 'drinks3', emoji: '🍸', text: 'Order 3 drinks from the menu', goal: 3, on: 'drink', xp: 60, cash: 15 },
  { id: 'bottle', emoji: '🍾', text: 'Order bottle service', goal: 1, on: 'drink', test: (e) => e.bottle, xp: 100, cash: 25 },
  { id: 'selfie', emoji: '🤳', text: 'Take 2 selfies', goal: 2, on: 'selfie', xp: 50, cash: 10 },
  { id: 'food', emoji: '🛵', text: 'Order food to your table', goal: 1, on: 'food', xp: 60, cash: 15 },
  { id: 'cashout', emoji: '👛', text: 'Cash out to your wallet', goal: 1, on: 'cashout', xp: 50, cash: 10 },
  { id: 'shop', emoji: '🛍️', text: 'Buy something in the store', goal: 1, on: 'buy', xp: 60, cash: 10 },
  { id: 'freespins', emoji: '✨', text: 'Trigger free spins on the slots', goal: 1, on: 'freespins', xp: 120, cash: 30 },
  { id: 'bj3', emoji: '🃏', text: 'Win 3 hands of blackjack', goal: 3, on: 'spin', test: (e) => e.game === 'blackjack' && e.net > 0, xp: 90, cash: 20 },
  { id: 'natural', emoji: '🂡', text: 'Get a blackjack', goal: 1, on: 'blackjack', test: (e) => e.type === 'natural', xp: 130, cash: 35 },
  { id: 'doubled', emoji: '✌️', text: 'Win a blackjack hand you doubled down on', goal: 1, on: 'blackjack', test: (e) => e.type === 'double', xp: 110, cash: 25 },
  { id: 'sidebet', emoji: '🎲', text: 'Win a blackjack side bet (Pairs or 21+3)', goal: 1, on: 'blackjack', test: (e) => e.type === 'sidebet', xp: 120, cash: 30 },
  { id: 'tipper', emoji: '💝', text: 'Tip the blackjack dealer', goal: 1, on: 'blackjack', test: (e) => e.type === 'tip', xp: 50, cash: 10 },
];
const SWEEP = { xp: 100, cash: 50 }; // all three done

// ---------- achievements (each one a trophy on the shelf) ----------
export const ACHIEVEMENTS = [
  { id: 'firstwin', name: "Beginner's Luck", desc: 'Win a spin', kind: 'chip', tier: 'bronze', on: 'spin', test: (e) => e.net > 0 },
  { id: 'straight', name: 'Straight Shooter', desc: 'Hit a straight-up number', kind: 'cup', tier: 'silver', on: 'spin', test: (e) => e.straight },
  { id: 'jackpot', name: 'Jackpot', desc: 'Get 20× your stake back on one spin', kind: 'star', tier: 'gold', on: 'spin', test: (e) => e.multiple >= 20 },
  { id: 'whale', name: 'Whale Watching', desc: 'Bet $10,000 on one spin', kind: 'chip', tier: 'gold', on: 'spin', test: (e) => e.staked >= 10000 },
  { id: 'broke', name: 'Rock Bottom', desc: 'Hit $0', kind: 'cup', tier: 'bronze', on: 'broke' },
  { id: 'dishes', name: 'Dishpan Hands', desc: 'Wash off a bar tab', kind: 'cup', tier: 'bronze', on: 'dishes' },
  { id: 'dragon', name: 'Dragon Tamer', desc: 'Trigger free spins on the slots', kind: 'star', tier: 'silver', on: 'freespins' },
  { id: 'influencer', name: 'Influencer', desc: 'Take 10 selfies', kind: 'star', tier: 'bronze', on: 'selfie', goal: 10 },
  { id: 'bubbly', name: 'Make It Rain', desc: 'Order a Moët or bigger', kind: 'bottle', tier: 'gold', on: 'drink', test: (e) => e.price >= 2500 },
  { id: 'regular', name: 'Regular', desc: 'Finish 10 daily challenges', kind: 'cup', tier: 'gold', on: 'challenge', goal: 10 },
  { id: 'loyal', name: 'Loyal Customer', desc: 'Redeem a full loyalty card', kind: 'cup', tier: 'silver', on: 'loyalty' },
  { id: 'level10', name: 'High Roller', desc: 'Reach level 10', kind: 'crown', tier: 'gold', on: 'level', test: (e) => e.level >= 10 },
  { id: 'natural', name: 'Natural', desc: 'Get a blackjack', kind: 'chip', tier: 'silver', on: 'blackjack', test: (e) => e.type === 'natural' },
  { id: 'charlie', name: 'Five Card Charlie', desc: 'Win a blackjack hand with 5 or more cards', kind: 'star', tier: 'gold', on: 'blackjack', test: (e) => e.type === 'charlie' },
  { id: 'perfect', name: 'Perfect Pair', desc: 'Hit a perfect pair side bet (25×)', kind: 'chip', tier: 'gold', on: 'blackjack', test: (e) => e.type === 'perfect' },
  { id: 'taken', name: 'Taken', desc: 'Get yourself a date at the roulette table', kind: 'cup', tier: 'silver', on: 'girlfriend', test: (e) => e.type === 'yes' },
  { id: 'firstdate', name: 'Dinner for Two', desc: 'Take your date on a date', kind: 'bottle', tier: 'bronze', on: 'girlfriend', test: (e) => e.type === 'date' },
  { id: 'married', name: 'Married in Vegas', desc: 'Propose, and get married (Dave will be there)', kind: 'crown', tier: 'gold', on: 'girlfriend', test: (e) => e.type === 'married' },
  { id: 'dumped', name: 'Dumped by Text', desc: 'Get dumped. By text. 💔', kind: 'cup', tier: 'bronze', on: 'girlfriend', test: (e) => e.type === 'dumped' },
  { id: 'ufo', name: 'Close Encounter', desc: 'Have your chips abducted by a UFO', kind: 'star', tier: 'silver', on: 'ufo' },
  { id: 'counted', name: 'Counted Out', desc: 'Get walked out of blackjack by the pit boss', kind: 'cup', tier: 'bronze', on: 'blackjack', test: (e) => e.type === 'counted' },
];
const ACH_XP = 150;
const KIND_EMOJI = { cup: '🏆', star: '⭐', chip: '🪙', bottle: '🍾', crown: '👑' };

// ---------- the loyalty card ----------
export const STAMP_EVERY = 100; // $ lost per stamp
export const CARD_SIZE = 10;

// ---------- level perks ----------
export const PERKS = [
  { id: 'booth', level: 5, emoji: '🛋️', name: 'VIP booth', desc: 'Bottle service is 20% off. You sit on velvet now.' },
  { id: 'highroller', level: 10, emoji: '🎩', name: 'High-roller table', desc: 'Red velvet felt and velvet ropes. Minimum $100 a spin, ×1.5 XP.', toggle: true },
  { id: 'highlimit', level: 12, emoji: '🥂', name: 'High-limit blackjack', desc: 'Burgundy felt, Madame Vivienne dealing, regulars betting 10×. Minimum $500 a hand, ×1.5 XP.', toggle: true },
  { id: 'whale', level: 15, emoji: '🐋', name: 'Whale mode', desc: 'Enormous chips and an inflatable whale. Minimum $1,000 a spin, ×2 XP.', toggle: true },
];
export const BOOTH_DISCOUNT = 0.2;

// the same three challenges for everyone on the same day
function dailyPick(date) {
  let h = 2166136261;
  for (const ch of date) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 2 ** 32;
  const pool = CHALLENGES.map((c) => c.id);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

/**
 * @param levels   { level(), bonus(xp) }
 * @param wallet   { gift(v) }
 * @param flair    { trophy(kind, tier), stampCard(onDone) }
 * @param onChange ()    something on the Goals tab changed
 * @param onPerks  ()    a perk was switched on or off (or unlocked)
 */
export function createGoals({ store, levels, wallet, toast, sound, flair, onChange, onPerks }) {
  let day = store.get('fr.goals.day', null);
  const earned = store.get('fr.goals.ach', {});
  const counts = store.get('fr.goals.count', {});
  const card = store.get('fr.loyalty', { lost: 0, stamps: 0, redeemed: 0 });
  const perkOn = store.get('fr.perks', {});
  let streak = 0;

  const save = () => {
    store.set('fr.goals.day', day);
    store.set('fr.goals.ach', earned);
    store.set('fr.goals.count', counts);
    store.set('fr.loyalty', card);
    store.set('fr.perks', perkOn);
  };
  const fresh = () => {
    if (day?.date === today()) return;
    day = { date: today(), ids: dailyPick(today()), prog: {}, done: {}, swept: false };
    save();
  };
  fresh();

  // ---------- rewards ----------
  function completeChallenge(c) {
    day.done[c.id] = true;
    levels.bonus(c.xp);
    wallet.gift(c.cash);
    sound.blip(880, 0.1, 'triangle', 0.1);
    sound.blip(1320, 0.16, 'triangle', 0.1, 0.1);
    toast(`✅ Challenge done: ${c.text.replace(/\. .*$/, '')}! +${c.xp} XP, +${money(c.cash)} to your wallet`);
    handle('challenge', {});
    if (!day.swept && day.ids.every((id) => day.done[id])) {
      day.swept = true;
      setTimeout(() => {
        levels.bonus(SWEEP.xp);
        wallet.gift(SWEEP.cash);
        toast(`🌟 All three challenges done today! Bonus: +${SWEEP.xp} XP and ${money(SWEEP.cash)}`);
      }, 2200);
    }
  }

  function unlock(a) {
    earned[a.id] = Date.now();
    levels.bonus(ACH_XP);
    flair.trophy(a.kind, a.tier);
    sound.blip(660, 0.15, 'triangle', 0.12);
    sound.blip(990, 0.15, 'triangle', 0.12, 0.12);
    sound.blip(1320, 0.3, 'triangle', 0.12, 0.24);
    setTimeout(() => toast(`🏆 Achievement unlocked: ${a.name}! +${ACH_XP} XP. It's on your shelf in 📱 → 🏆 Goals.`), 400);
  }

  // ---------- listening ----------
  function handle(name, e) {
    fresh();
    const ctx = { streak };
    for (const id of day.ids) {
      const c = CHALLENGES.find((x) => x.id === id);
      if (!c || c.on !== name || day.done[id] || (c.test && !c.test(e, ctx))) continue;
      day.prog[id] = (day.prog[id] || 0) + 1;
      if (day.prog[id] >= c.goal) completeChallenge(c);
    }
    for (const a of ACHIEVEMENTS) {
      if (a.on !== name || earned[a.id] || (a.test && !a.test(e, ctx))) continue;
      if (a.goal) {
        counts[a.id] = (counts[a.id] || 0) + 1;
        if (counts[a.id] < a.goal) continue;
      }
      unlock(a);
    }
    save();
    onChange?.();
  }

  on('spin', (e) => {
    streak = e.net > 0 ? streak + 1 : e.net < 0 ? 0 : streak;
    // every $100 you lose is a stamp on your loyalty card
    if (e.net < 0 && card.stamps < CARD_SIZE) {
      card.lost += -e.net;
      const before = card.stamps;
      while (card.lost >= STAMP_EVERY && card.stamps < CARD_SIZE) {
        card.lost -= STAMP_EVERY;
        card.stamps++;
      }
      if (card.stamps === CARD_SIZE) card.lost = 0;
      if (card.stamps > before && card.stamps === CARD_SIZE) {
        setTimeout(() => toast('🎟️ Your loyalty card is full! Redeem it in 📱 → 🏆 Goals.'), 2500);
      }
    }
    handle('spin', e);
  });
  for (const name of ['drink', 'selfie', 'food', 'cashout', 'buy', 'freespins', 'dishes', 'broke', 'level', 'blackjack', 'ufo', 'girlfriend']) on(name, (e) => handle(name, e));

  // ---------- perks ----------
  const unlocked = (p) => levels.level() >= p.level;
  const perk = (id) => {
    const p = PERKS.find((x) => x.id === id);
    return !!p && unlocked(p) && (!p.toggle || !!perkOn[id]);
  };

  // ---------- the Goals tab ----------
  function html() {
    fresh();
    const lvl = levels.level();
    const chs = day.ids.map((id) => CHALLENGES.find((c) => c.id === id)).filter(Boolean);
    const got = ACHIEVEMENTS.filter((a) => earned[a.id]).length;
    return `
      <h4>Today's challenges <small>(new ones at midnight)</small></h4>
      <div class="gl-list">${chs
        .map((c) => {
          const n = Math.min(c.goal, day.prog[c.id] || 0);
          const done = !!day.done[c.id];
          return `<div class="gl-ch${done ? ' done' : ''}">
            <span class="gl-emoji">${c.emoji}</span>
            <div class="gl-main"><b>${c.text}</b>
              <div class="gl-bar"><i style="width:${((done ? c.goal : n) / c.goal) * 100}%"></i></div>
              <small>${done ? 'Done!' : `${n} / ${c.goal}`} · +${c.xp} XP · +${money(c.cash)} 👛</small></div>
            <span class="gl-check">${done ? '✓' : ''}</span>
          </div>`;
        })
        .join('')}</div>
      <p class="st-note">${day.swept ? '🌟 All three done today. Show-off.' : `Finish all three for a bonus: +${SWEEP.xp} XP and ${money(SWEEP.cash)}.`}</p>

      <h4>Loyalty card</h4>
      <div class="gl-card${card.stamps >= CARD_SIZE ? ' full' : ''}">
        <div class="gl-card-head"><b>🎟️ Club Jackpot Rewards</b><small>One stamp for every ${money(STAMP_EVERY)} you lose</small></div>
        <div class="gl-stamps">${Array.from({ length: CARD_SIZE }, (_, i) => `<i class="${i < card.stamps ? 'on' : ''}">${i < card.stamps ? '★' : i + 1}</i>`).join('')}</div>
        <div class="gl-card-foot">
          <small>${card.stamps >= CARD_SIZE ? 'Full! Redeem it for a fabulous prize.' : `Lose ${money(STAMP_EVERY - card.lost)} more for the next stamp.`}${card.redeemed ? ` Redeemed ${card.redeemed}×.` : ''}</small>
          <button type="button" class="btn gold gl-redeem" data-redeem ${card.stamps >= CARD_SIZE ? '' : 'disabled'}>Redeem</button>
        </div>
      </div>

      <h4>Level perks</h4>
      <div class="st-prefs gl-perks">${PERKS.map((p) => {
        const open = lvl >= p.level;
        if (!open) return `<div class="st-pref gl-locked"><span><b>${p.emoji} ${p.name}</b><small>${p.desc}</small></span><em>🔒 Level ${p.level}</em></div>`;
        if (!p.toggle) return `<div class="st-pref"><span><b>${p.emoji} ${p.name}</b><small>${p.desc}</small></span><em class="gl-on">✓ Active</em></div>`;
        return `<label class="st-pref"><span><b>${p.emoji} ${p.name}</b><small>${p.desc}</small></span>
          <input type="checkbox" data-perk="${p.id}" ${perkOn[p.id] ? 'checked' : ''}><i class="st-switch"></i></label>`;
      }).join('')}</div>

      <h4>Achievements <small>${got} / ${ACHIEVEMENTS.length} · +${ACH_XP} XP each</small></h4>
      <div class="gl-achs">${ACHIEVEMENTS.map((a) => {
        const has = !!earned[a.id];
        const prog = a.goal && !has ? ` (${Math.min(a.goal, counts[a.id] || 0)}/${a.goal})` : '';
        return `<div class="gl-ach${has ? ' got' : ''} tier-${a.tier}"><span>${has ? KIND_EMOJI[a.kind] : '🔒'}</span><b>${a.name}</b><small>${a.desc}${prog}</small></div>`;
      }).join('')}</div>`;
  }

  /** A click or change on the Goals tab; true if it was ours. */
  function input(t) {
    if (t.dataset.perk) {
      perkOn[t.dataset.perk] = t.checked;
      save();
      sound.blip(t.checked ? 1000 : 600, 0.05, 'triangle', 0.08);
      onPerks?.();
      return true;
    }
    if (t.dataset.redeem != null) {
      if (card.stamps < CARD_SIZE) return true;
      card.stamps = 0;
      card.lost = 0;
      card.redeemed++;
      save();
      onChange?.();
      flair.stampCard(() => {
        toast('🎟️ You redeemed 10 stamps for: absolutely nothing. Thank you for your loyalty!');
        setTimeout(() => handle('loyalty', {}), 2400); // once the card has gone
      });
      return true;
    }
    return false;
  }

  return {
    html,
    input,
    perk,
    /** for the trophy shelf */
    trophies: () => ACHIEVEMENTS.map((a) => ({ kind: a.kind, tier: a.tier, earned: !!earned[a.id] })),
  };
}
