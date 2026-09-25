// 🃏 BLACKJACK: a room of its own, dealt by a very smug dealer, with other players who come and go.
// Six decks, blackjack pays 3 to 2, the dealer stands on all 17s, double on any two cards, split,
// surrender, insurance, up to three hands at once, side bets (Perfect Pairs, 21+3), tipping,
// a hot/cold table, a waiter with free drinks, a high-limit table… and a pit boss who doesn't
// like card counters.

import { BlackjackTable, SPOTS, SEAT_ANGLES, MAX_HANDS } from './blackjack3d.js';
import { DEFAULT_LOOK, BASE } from './avatar.js';
import { celebrate, winLevel } from './fx.js';
import { emit } from './events.js';

const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const pick = (a) => a[(Math.random() * a.length) | 0];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const DECKS = 6;
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['S', 'H', 'D', 'C'];
const TABLES = {
  classic: { chips: [5, 25, 100, 500, 1000], min: 5, side: [0, 5, 25, 100], tip: 5, botBet: 1, name: 'BLACKJACK', sub: 'Pays 3 to 2 · Dealer stands on all 17s' },
  highlimit: { chips: [100, 500, 1000], min: 500, side: [0, 100, 250, 500], tip: 50, botBet: 10, name: 'HIGH LIMIT', sub: 'Minimum $500 · Madame Vivienne dealing' },
};
const BAN_MS = 90_000; // escorted out: no blackjack for a bit
const WAITER_DOOR = { x: -8, z: 3.6 };
const WAITER_SPOT = { x: -2.55, z: 2.05 };
const BOSS_DOOR = { x: 8, z: 3.6 };
const BOSS_SPOT = { x: 2.55, z: 2.05 };

// ---------- the rules ----------
const rankValue = (r) => (r === 'A' ? 11 : 'JQK'.includes(r) || r === '10' ? 10 : +r);
export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += rankValue(c.rank);
    if (c.rank === 'A') aces++;
  }
  while (total > 21 && aces) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}
const isBlackjack = (cards) => cards.length === 2 && handValue(cards).total === 21;
// Hi-Lo: 2–6 are +1, 10s and aces are −1 (the pit boss keeps this count too)
const hiLo = (c) => (rankValue(c.rank) <= 6 ? 1 : rankValue(c.rank) >= 10 ? -1 : 0);

function newShoe() {
  const shoe = [];
  for (let d = 0; d < DECKS; d++) for (const suit of SUITS) for (const rank of RANKS) shoe.push({ rank, suit });
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
}

// ---------- side bets ----------
const isRed = (c) => c.suit === 'H' || c.suit === 'D';
/** Perfect Pairs on your first two cards: [name, pays] or null. */
export function perfectPairs([a, b]) {
  if (a.rank !== b.rank) return null;
  if (a.suit === b.suit) return ['PERFECT PAIR', 25];
  if (isRed(a) === isRed(b)) return ['COLOURED PAIR', 12];
  return ['MIXED PAIR', 5];
}
const ORDER = (r) => RANKS.indexOf(r) + 1; // A=1 … K=13
/** 21+3: your two cards + the dealer's up card as a three-card poker hand. */
export function twentyOnePlus3(cards) {
  const flush = cards.every((c) => c.suit === cards[0].suit);
  const ranks = cards.map((c) => ORDER(c.rank)).sort((x, y) => x - y);
  const trips = ranks[0] === ranks[2];
  const run = (r) => r[1] === r[0] + 1 && r[2] === r[1] + 1;
  const straight = run(ranks) || (ranks[0] === 1 && run([ranks[1], ranks[2], 14])); // A-2-3 or Q-K-A
  if (trips && flush) return ['SUITED TRIPS', 100];
  if (straight && flush) return ['STRAIGHT FLUSH', 40];
  if (trips) return ['THREE OF A KIND', 30];
  if (straight) return ['STRAIGHT', 10];
  if (flush) return ['FLUSH', 5];
  return null;
}

// ---------- the dealer's mouth ----------
const QUIPS = {
  welcome: ['Welcome. Try not to cry on the felt.', 'Ah, fresh money. I mean, a fresh face.', 'Sit, sit. The house has missed you.'],
  deal: ['Cards are coming.', 'Good luck. You will need it.', "Let's see how this goes wrong."],
  hit: ['Bold.', 'Another? Sure.', 'Living dangerously.', 'If you say so.'],
  stand: ['Standing on that? Brave.', 'Interesting choice.', 'Fine. My turn.'],
  double: ['Feeling brave?', 'Double or nothing. Mostly nothing.', 'Ooh, a high roller.'],
  split: ['Two hands, twice the disappointment.', 'Splitting. How ambitious.', 'Now you can lose in stereo.'],
  surrender: ['Walking away? Wise. Rare, but wise.', 'Half is better than nothing. Barely.', 'Retreat! A classic.'],
  insurance: ['Insurance? Against what, exactly?', 'Would you like to insure your insurance?'],
  bust: ['Oof. So close to twenty-one, and yet.', 'Bust. Happens to the best. Mostly to you.', 'Twenty-two is not a lucky number.', 'The cards have spoken.'],
  playerBJ: ["Blackjack. Beginner's luck, obviously.", 'Hmph. Enjoy it while it lasts.', "I'll allow it."],
  dealerBJ: ['Would you look at that. Blackjack.', 'Natural. Like my talent.', 'The house always wins. Well, mostly.'],
  dealerBust: ['...The cards are sticky today.', "That's never happened before. Ever.", 'I let you have that one.'],
  win: ['Fine. Take your chips.', "Enjoy it. It won't last.", 'Congratulations, I suppose.'],
  lose: ['Better luck next time. There is always a next time.', 'Thank you for your donation.', 'The house thanks you.'],
  push: ['Nobody wins. My favourite.', 'A tie. How thrilling.', 'Push. Your money lives to lose another day.'],
  shuffle: ['Fresh shoe. Everybody look away.', 'Shuffling. No, I am not counting. Are you?'],
  join: ['Oh good, another one.', 'Welcome. Wallet out, please.', 'A new victim. I mean, player.'],
  side: ['A side bet. How very optimistic.', 'The side bets. Where hope goes to retire.'],
  sideWin: ['Hm. The side bet. Lucky.', "Don't get used to it."],
  tip: ['Oh! How generous. I may like you after all.', 'Thank you, friend. The cards will be kind. Maybe.', 'A tip! You are my favourite now.'],
  stiffed: ['A big win and not a penny for me. Noted.', 'No tip? After that? I will remember this.', 'Wow. Just... wow. Enjoy MY money.'],
  hot: ['The table is heating up. Suspicious.', "Everybody's winning. I hate it."],
  cold: ['Ah, a cold table. My favourite weather.', 'Brrr. Feel that? That is the house winning.'],
};
// once you've tipped, the dealer is a delight (for a few hands)
const NICE = {
  deal: ['Here you go, friend. Good luck!', 'Cards for my favourite player.'],
  hit: ['Go on, you can do it!', 'Good luck on this one!'],
  stand: ['Solid choice.', 'Smart. Let me see what I can do.'],
  bust: ['Ah, unlucky! Next one is yours.', 'So close! Chin up.'],
  lose: ["You'll get me next time, I'm sure.", 'Tough one. I almost feel bad.'],
  win: ['Well played! Truly.', 'Beautiful! Enjoy it.'],
  playerBJ: ['Blackjack! Wonderful!', 'Look at that! Well done!'],
  dealerBJ: ['Ah, sorry friend. Blackjack. It happens.'],
  push: ['A tie. At least nobody lost!'],
};

// ---------- the other players ----------
// style: basic = roughly by the book, reckless = hits and doubles too much,
// grandma = always hits on 16, nervous = stands far too early
const REGULARS = [
  { name: 'Crypto Kevin', style: 'reckless', bets: [50, 100, 250, 500], look: { top: 'hoodie', glasses: 'shutters', hair: 'spiky', hairColor: '#e8c46a' }, lines: { hi: 'gm gm. Wen blackjack?', win: 'To the moon! 🚀', lose: "It's a dip. I'm buying the dip.", bust: 'Diamond hands... bust hands.', bye: 'Gotta check my portfolio. brb forever.' } },
  { name: 'Grandma Edna', style: 'grandma', bets: [5, 10, 25], look: { hair: 'bun', hairColor: '#d9d9d9', top: 'bathrobe', glasses: 'monocle', build: 'slim', face: 'grin' }, lines: { hi: 'Hello dears. Is this the bingo?', win: 'Ooh! Bingo!', lose: 'Back in my day the cards were nicer.', bust: 'Grandma always hits on 16.', bye: 'Time for my programme. Toodles!' } },
  { name: 'Big Tony', style: 'basic', bets: [100, 250, 500], look: { build: 'big', top: 'leather', neck: 'chain', hair: 'bald', facial: 'stubble', glasses: 'aviators', face: 'cool' }, lines: { hi: "Deal me in. Tony don't lose.", win: 'Tony told you.', lose: 'This dealer and me? We gonna talk.', bust: 'Fuhgeddaboudit.', bye: 'I got a guy to see about a thing.' } },
  { name: 'Tourist Tim', style: 'basic', bets: [10, 25, 50], look: { top: 'hawaiian', hat: 'cap', neck: 'lei', face: 'shock' }, lines: { hi: 'Is this where you win the car?', win: 'Wait, I WON? Honey!!', lose: 'Is that... bad?', bust: 'What does bust mean?', bye: 'Our tour bus is leaving!' } },
  { name: 'Lucky Linda', style: 'basic', bets: [25, 50, 100], look: { hair: 'long', hairColor: '#c0182a', top: 'sequin', glasses: 'stars', build: 'slim' }, lines: { hi: 'I brought my lucky rabbit foot. And a spare.', win: 'Luck is a skill, darling.', lose: 'The rabbit foot is on a break.', bust: 'I blame the lighting.', bye: 'Kisses! Off to the slots.' } },
  { name: 'Chad', style: 'reckless', bets: [100, 200, 500], look: { top: 'tank', build: 'big', hat: 'cap', glasses: 'aviators', hair: 'buzz', shirt: '#dce8f6' }, lines: { hi: 'Yo. I only double.', win: "LET'S GOOO", lose: 'Bro. Bro.', bust: 'Bro that card was rigged.', bye: 'Gym time. Later, nerds.' } },
  { name: 'Sweaty Steve', style: 'nervous', bets: [5, 10, 25], look: { top: 'tshirt', shirt: '#ff9ad0', hair: 'short', facial: 'mustache', face: 'shock' }, lines: { hi: 'Just one hand. Just one.', win: 'Oh thank god. Okay. Okay.', lose: "That was the rent. That's fine.", bust: 'Why did I hit? WHY DID I HIT?', bye: 'I should... go. I should go.' } },
  { name: "Dave's cousin Rob", style: 'reckless', bets: [25, 50, 100], look: { top: 'hawaiian', hair: 'mohawk', facial: 'goatee', hat: 'cowboy' }, lines: { hi: 'Dave says hi. Dave says you owe him.', win: 'Wait till Dave hears.', lose: "Dave's gonna laugh at me.", bust: 'Runs in the family.', bye: 'Gotta go find Dave.' } },
  { name: 'The Professor', style: 'basic', bets: [50, 100], look: { top: 'tux', neck: 'bowtie', glasses: 'monocle', hair: 'bald', facial: 'beard', hairColor: '#d9d9d9' }, lines: { hi: 'Statistically, I am already ahead.', win: 'As the models predicted.', lose: 'An outlier. Noted.', bust: 'The variance is... considerable.', bye: 'I have a lecture on probability. Ironic.' } },
  { name: 'Party Pam', style: 'reckless', bets: [25, 50, 100], look: { hair: 'ponytail', hairColor: '#ff9ad0', top: 'tank', hat: 'party', glasses: 'hearts', shirt: '#2de0ff' }, lines: { hi: 'Is this the party table? It is now!', win: 'WOOOO! Shots!', lose: 'Whatever! More shots!', bust: 'Oopsie!', bye: 'The club is calling me!' } },
];
const BOT_TALK = {
  hit: ['Hit me!', 'One more.', 'Card, please.', 'Gimme.'],
  stand: ["I'll stay.", 'Good for me.', 'Stand.', "I'm good."],
  double: ['Double down, baby!', 'Double!', 'All in. Well, double.'],
  bj: ['BLACKJACK!', 'Natural, baby!', 'Twenty-one! Pay me!'],
  // about you
  bustCard: ["Whoa, you're hitting that? Against a", "Hey! That's the dealer's bust card! He's showing a"],
  tookIt: ['See?! You took his bust card!', 'That was HIS card! You took it!', 'Unbelievable. You took the bust card.'],
  cheer: ['Nice hand!', 'Teach me your ways!', 'Now THAT is how you play!', 'Legend.'],
  clap: ['Blackjack! Nice!', 'Ooh, a natural!', '👏👏👏'],
  rookie: ['Oof. Rookie.', 'Happens to all of us.', 'Ouch.'],
  hot: ['This table is ON FIRE! 🔥', "We're all getting rich!", 'Nobody leave! The table is hot!'],
  drunk: ['Is it just me or are the cards spinning?', 'I love you guys. I love this table.', 'Who ordered all these drinks? Me? Nice.', 'Wait, which ones are my cards?'],
};

const WAITER_LOOK = { top: 'tux', neck: 'bowtie', hair: 'short', hairColor: '#1c120c', facial: 'mustache', face: 'grin', held: 'martini' };
const PIT_BOSS_LOOK = { top: 'leather', neck: 'necktie', hair: 'bald', facial: 'stubble', glasses: 'shutters', face: 'cool', build: 'big', pants: '#1f1f24', shoes: '#0a0a0a' };

/**
 * @param onOpen / onClose   only one 3D room renders at a time
 * @param onRound({ net, staked, multiple, mult })  a round is over (XP, challenges, the loyalty card)
 * @param booze       the waiter's drinks land in your bloodstream ({ pickDrink(), add(), level() })
 * @param highLimit() is the high-limit perk switched on?
 */
export function createBlackjack({ sound, toast, getBalance, adjust, onOpen, onClose, onRound, booze, highLimit }) {
  let el = null;
  let table = null;
  let T = TABLES.classic;
  let shoe = newShoe();
  let count = 0; // the running Hi-Lo count
  let phase = 'bet'; // bet | deal | insurance | play | bots | dealer | escort
  let bet = 0; // per hand
  let nHands = 1;
  let side = { pairs: 0, trips: 0 };
  let lastBet = 25;
  let hands = []; // yours: { cards, entries, bet, done, doubled, fromSplit, fromAces, surrendered }
  let active = 0;
  let dealer = { cards: [], entries: [], hole: null };
  let insurance = 0;
  let sideStaked = 0;
  let sideBack = 0;
  let bubbleUntil = 0;
  let churnTimer = 0;
  let waiterTimer = 0;
  let round = 0;
  let mood = 0; // > 0 after a tip: a nice dealer. < 0 after you stiff him.
  let lastTip = -99;
  let heat = 0; // -5 … +5: a cold or hot table
  let tookBust = false;
  let avgBet = 0;
  let suspicion = 0;
  let bannedUntil = 0;
  let visitors = []; // the waiter, the pit boss: { kind, name, t3, bubble, tag, offer }
  const seats = SEAT_ANGLES.map((deg) => ({ deg, bot: null }));

  const $ = (s) => el.querySelector(s);
  const seated = () => seats.map((s) => s.bot).filter((b) => b && b.ready && !b.leaving);
  const inHand = () => seated().filter((b) => b.hand);
  const rightOf = () => inHand().filter((b) => b.deg > 0).sort((a, b) => b.deg - a.deg); // dealt before you
  const leftOf = () => inHand().filter((b) => b.deg < 0).sort((a, b) => b.deg - a.deg); // after you
  const drunk = () => booze?.level?.() || 0;
  const hot = () => heat >= 3;

  function say(kind, extra = '') {
    if (!el) return;
    const b = $('.bj-bubble.dealer');
    b.textContent = extra || pick(mood > 0 && NICE[kind] ? NICE[kind] : QUIPS[kind]);
    b.classList.add('on');
    bubbleUntil = performance.now() + 2800;
  }

  function botSay(bot, text, ms = 2400) {
    if (!el || !bot?.bubble) return;
    bot.bubble.textContent = text;
    bot.bubble.classList.add('on');
    bot.bubbleUntil = performance.now() + ms;
  }
  // someone at the table pipes up (a drunk table is a chatty table)
  const chatty = (p) => Math.random() < Math.min(0.95, p * (1 + drunk() * 0.4));
  const someone = (pref) => {
    const list = seated();
    return list.find((b) => b.style === pref) || pick(list);
  };

  function banner(text, cls = '') {
    const b = $('.bj-banner');
    b.className = `bj-banner on ${cls}`;
    b.textContent = text;
    clearTimeout(banner.t);
    banner.t = setTimeout(() => b.classList.remove('on'), 1900);
  }

  const cardSnap = () => {
    sound.blip(2600, 0.02, 'square', 0.04);
    sound.blip(900, 0.03, 'triangle', 0.05, 0.01);
  };

  function draw() {
    if (shoe.length < 15) {
      shoe = newShoe();
      count = 0;
    }
    return shoe.pop();
  }

  // ---------- the other players come and go ----------
  const randomLook = (base) => ({ ...DEFAULT_LOOK, skin: pick(BASE.skin), ...base.look });

  function labelFor(name, cls = '') {
    const bubble = document.createElement('div');
    bubble.className = 'bj-bubble bot';
    const tag = document.createElement('div');
    tag.className = `bj-name ${cls}`;
    tag.textContent = name;
    $('.bj-labels').append(bubble, tag);
    return { bubble, tag };
  }

  function join(seat, walkIn = true) {
    if (!table || seat.bot) return;
    const used = new Set(seats.map((s) => s.bot?.name));
    const who = pick(REGULARS.filter((r) => !used.has(r.name)));
    if (!who) return;
    const bot = { ...who, deg: seat.deg, ready: !walkIn, rounds: 0, hand: null, result: '' };
    bot.t3 = table.addBot(randomLook(who), seat.deg, walkIn);
    Object.assign(bot, labelFor(who.name));
    seat.bot = bot;
    if (walkIn) {
      const check = () => {
        if (!table) return;
        if (bot.t3.walk) return setTimeout(check, 200);
        bot.ready = true;
        botSay(bot, who.lines.hi, 3000);
        if (Math.random() < 0.5) setTimeout(() => say('join'), 1400);
        renderLabels();
      };
      check();
    }
  }

  function leave(seat) {
    const bot = seat.bot;
    if (!bot || bot.leaving) return;
    bot.leaving = true;
    botSay(bot, bot.lines.bye, 2200);
    setTimeout(() => {
      if (!table) return;
      table.removeBot(bot.t3).then(() => {
        bot.bubble?.remove();
        bot.tag?.remove();
        if (seat.bot === bot) seat.bot = null;
      });
    }, 900);
  }

  /** Between hands: someone might leave, someone might sit down. */
  function churn(pLeave = 0.22, pJoin = 0.35) {
    if (!table || phase !== 'bet') return;
    for (const seat of seats) {
      const b = seat.bot;
      if (b && b.ready && !b.leaving && b.rounds >= 2 && Math.random() < pLeave) leave(seat);
      else if (!b && Math.random() < pJoin) join(seat);
    }
  }

  // ---------- the waiter: a free drink now and then ----------
  function waiterVisit() {
    if (!table || !booze || visitors.some((v) => v.kind === 'waiter') || phase === 'escort') return;
    const t3 = table.addPerson({ ...DEFAULT_LOOK, skin: pick(BASE.skin), ...WAITER_LOOK }, WAITER_DOOR, WAITER_SPOT, 0);
    const v = { kind: 'waiter', name: 'Waiter', t3, ...labelFor('Waiter', 'staff') };
    visitors.push(v);
    t3.arrived.then(() => {
      if (!table || v.gone) return;
      botSay(v, pick(['Free drink? On the house! 🍸', 'Something to drink, champ?', 'Compliments of the casino! 🍸']), 7500);
      v.offer = document.createElement('div');
      v.offer.className = 'bj-offer';
      v.offer.innerHTML = '<button type="button" class="btn gold" data-drink="yes">🍸 Yes please</button><button type="button" class="btn" data-drink="no">No thanks</button>';
      $('.bj-labels').append(v.offer);
      v.leaveTimer = setTimeout(() => waiterLeave(v, 'Suit yourself!'), 8000);
    });
  }
  function waiterLeave(v, line) {
    if (!table || v.gone) return;
    v.gone = true;
    clearTimeout(v.leaveTimer);
    v.offer?.remove();
    if (line) botSay(v, line, 1800);
    table.sendAway(v.t3, WAITER_DOOR).then(() => {
      v.bubble.remove();
      v.tag.remove();
      visitors = visitors.filter((x) => x !== v);
    });
  }

  // ---------- the pit boss: you've been counting cards ----------
  async function escort() {
    if (!table) return;
    phase = 'escort';
    render();
    const t3 = table.addPerson({ ...DEFAULT_LOOK, skin: pick(BASE.skin), ...PIT_BOSS_LOOK }, BOSS_DOOR, BOSS_SPOT, 0);
    const v = { kind: 'boss', name: 'Pit Boss', t3, ...labelFor('Pit Boss', 'staff boss') };
    visitors.push(v);
    say('', 'Uh oh.');
    await t3.arrived;
    if (!table) return;
    sound.blip(220, 0.4, 'sawtooth', 0.08);
    botSay(v, 'Evening. Lovely maths you have been doing tonight.', 3200);
    const snitch = someone('basic');
    if (snitch) setTimeout(() => botSay(snitch, 'I knew it. Counter.', 2400), 1200);
    await wait(3400);
    if (!table) return;
    botSay(v, 'The roulette table misses you. Let me walk you over.', 3200);
    table.gesture('wave', 3);
    say('', 'Bye bye now. 👋');
    await wait(3000);
    emit('blackjack', { type: 'counted' });
    bannedUntil = Date.now() + BAN_MS;
    close(true);
    toast('🚨 The pit boss walked you back to roulette. No blackjack for 90 seconds. (Were you counting cards?)');
  }

  // ---------- rendering the HTML chrome ----------
  function render() {
    if (!el) return;
    $('.bj-bal').textContent = money(getBalance());
    const inPlay = hands.reduce((a, h) => a + h.bet, 0);
    $('.bj-bet').textContent = phase === 'bet' ? `${money(bet)}${nHands > 1 ? ` ×${nHands}` : ''}` : money(inPlay);
    const acts = $('.bj-actions');
    $('.bj-chips').hidden = phase !== 'bet';
    $('.bj-extras').hidden = phase !== 'bet';
    if (phase === 'bet') {
      $('.bj-extras').innerHTML = `
        <button type="button" class="bj-pill" data-hands title="How many hands you play at once">✋ ${nHands} hand${nHands > 1 ? 's' : ''}</button>
        <button type="button" class="bj-pill${side.pairs ? ' on' : ''}" data-side="pairs" title="Perfect Pairs: mixed pair 5×, coloured pair 12×, perfect pair 25×">Pairs ${side.pairs ? money(side.pairs) : 'off'}</button>
        <button type="button" class="bj-pill${side.trips ? ' on' : ''}" data-side="trips" title="21+3: flush 5×, straight 10×, three of a kind 30×, straight flush 40×, suited trips 100×">21+3 ${side.trips ? money(side.trips) : 'off'}</button>
        <button type="button" class="bj-pill tip" data-tip title="Tip the dealer. He'll be nicer. For a while.">💝 Tip ${money(T.tip)}</button>`;
      acts.innerHTML = `
        <button type="button" class="btn" data-act="clear" ${bet ? '' : 'disabled'}>Clear</button>
        <button type="button" class="btn" data-act="rebet" ${lastBet && lastBet * nHands <= getBalance() ? '' : 'disabled'}>Rebet ${money(lastBet)}</button>
        <button type="button" class="btn gold bj-deal" data-act="deal" ${bet ? '' : 'disabled'}>DEAL</button>`;
    } else if (phase === 'insurance') {
      const cost = Math.floor(inPlay / 2);
      acts.innerHTML = `<span class="bj-q">Insurance for ${money(cost)}?</span>
        <button type="button" class="btn" data-act="insNo">No thanks</button>
        <button type="button" class="btn gold" data-act="insYes" ${getBalance() >= cost ? '' : 'disabled'}>Insure</button>`;
    } else if (phase === 'play') {
      const h = hands[active];
      const fresh = h.cards.length === 2;
      const canDouble = fresh && getBalance() >= h.bet;
      const canSplit = hands.length < MAX_HANDS && fresh && !h.fromSplit && rankValue(h.cards[0].rank) === rankValue(h.cards[1].rank) && getBalance() >= h.bet;
      const canSurrender = fresh && !h.fromSplit;
      acts.innerHTML = `
        <button type="button" class="btn bj-hit" data-act="hit" title="H">Hit</button>
        <button type="button" class="btn bj-stand" data-act="stand" title="S">Stand</button>
        <button type="button" class="btn" data-act="double" title="D" ${canDouble ? '' : 'disabled'}>Double</button>
        <button type="button" class="btn" data-act="split" title="X" ${canSplit ? '' : 'disabled'}>Split</button>
        <button type="button" class="btn" data-act="surrender" title="R" ${canSurrender ? '' : 'disabled'}>Surrender</button>`;
    } else {
      const turn = phase === 'bots' ? 'Other players…' : phase === 'dealer' ? "Dealer's turn…" : phase === 'escort' ? '🚨 …' : '…';
      acts.innerHTML = `<span class="bj-q">${turn}</span>`;
    }
    renderHeat();
    renderLabels();
  }

  function renderHeat() {
    const h = $('.bj-heat');
    const n = Math.abs(heat);
    h.className = `bj-heat ${heat > 0 ? 'hot' : heat < 0 ? 'cold' : ''}`;
    h.textContent = heat >= 3 ? '🔥 HOT TABLE · ×1.5 XP' : heat <= -3 ? '❄️ COLD TABLE' : `${heat > 0 ? '🔥' : heat < 0 ? '❄️' : '🌡️'} ${'▮'.repeat(n)}${'▯'.repeat(5 - n)}`;
    table?.setHeat(heat);
  }

  function totalText(cards, hideHole, fromSplit = false) {
    if (!cards.length) return '';
    const shown = hideHole ? cards.filter((c) => c !== dealer.hole) : cards;
    if (!hideHole && !fromSplit && isBlackjack(cards)) return 'BLACKJACK'; // after a split, it's just 21
    const v = handValue(shown);
    if (v.total > 21) return 'BUST';
    return v.soft && v.total < 21 && !hideHole ? `${v.total - 10} / ${v.total}` : String(v.total);
  }

  function renderLabels() {
    if (!el) return;
    const labels = $('.bj-labels');
    const items = [];
    if (dealer.cards.length) items.push({ key: 'dealer', text: totalText(dealer.cards, !!dealer.hole), at: SPOTS.dealer(Math.max(0, dealer.cards.length - 1) / 2), dz: -0.55 });
    hands.forEach((h, i) => {
      if (!h.cards.length) return;
      const text = h.surrendered ? 'SURRENDER' : totalText(h.cards, false, h.fromSplit) + (h.doubled ? ' ×2' : '');
      items.push({ key: 'h' + i, text, at: SPOTS.hand(i, hands.length, (h.cards.length - 1) / 2), dz: 0.52, on: phase === 'play' && i === active && hands.length > 1 });
    });
    for (const b of seated()) {
      if (!b.hand?.cards.length) continue;
      const text = b.result || totalText(b.hand.cards, false) + (b.hand.doubled ? ' ×2' : '');
      items.push({ key: 'b' + b.deg, text, at: SPOTS.seatCard(b.deg, (b.hand.cards.length - 1) / 2), dz: 0.45, on: b.turn, small: true });
    }
    labels.querySelectorAll('.bj-total').forEach((n) => n.remove());
    labels.insertAdjacentHTML(
      'afterbegin',
      items
        .map((it) => {
          const cls = it.text === 'BUST' || it.text.startsWith('−') || it.text === 'SURRENDER' ? ' bust' : it.text === 'BLACKJACK' || it.text.startsWith('+') ? ' bj' : '';
          return `<span class="bj-total${it.on ? ' on' : ''}${it.small ? ' small' : ''}${cls}" data-k="${it.key}">${it.text}</span>`;
        })
        .join('')
    );
    labels._items = items;
    placeLabels();
  }

  function placeLabels() {
    if (!el || !table) return;
    const labels = $('.bj-labels');
    (labels._items || []).forEach((it) => {
      const node = labels.querySelector(`[data-k="${it.key}"]`);
      if (!node) return;
      const p = table.screen(it.at.clone().setZ(it.at.z + it.dz));
      node.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%)`;
    });
    const now = performance.now();
    const b = $('.bj-bubble.dealer');
    if (b.classList.contains('on')) {
      if (now > bubbleUntil) b.classList.remove('on');
      const p = table.screen(table.dealerHead());
      b.style.transform = `translate(${p.x}px, ${Math.max(b.offsetHeight + 8, p.y)}px) translate(-50%, -100%)`; // not over the top bar
    }
    const w = el.clientWidth;
    const people = [...seats.map((s) => s.bot).filter((x) => x?.t3), ...visitors];
    for (const who of people) {
      const head = table.screen(table.botHead(who.t3));
      // people at the edge of the screen: keep their name and words inside it
      const x = Math.min(w - 70, Math.max(70, head.x));
      const bx = Math.min(w - 110, Math.max(110, head.x));
      who.tag.style.transform = `translate(${x}px, ${head.y}px) translate(-50%, -100%)`;
      if (who.bubble.classList.contains('on')) {
        if (now > who.bubbleUntil) who.bubble.classList.remove('on');
        who.bubble.style.transform = `translate(${bx}px, ${head.y - 26}px) translate(-50%, -100%)`;
      }
      if (who.offer) who.offer.style.transform = `translate(${bx}px, ${head.y + 8}px) translate(-50%, 0)`;
    }
  }

  // ---------- dealing ----------
  // target: 'dealer', your hand's index, or a bot
  async function dealTo(target, faceUp = true) {
    const card = draw();
    if (faceUp) count += hiLo(card);
    let to;
    let rot = 0;
    if (target === 'dealer') {
      to = SPOTS.dealer(dealer.cards.length);
      dealer.cards.push(card);
    } else if (typeof target === 'number') {
      const h = hands[target];
      to = SPOTS.hand(target, hands.length, h.cards.length);
      h.cards.push(card);
    } else {
      to = SPOTS.seatCard(target.deg, target.hand.cards.length);
      rot = SPOTS.seatRot(target.deg);
      target.hand.cards.push(card);
    }
    cardSnap();
    const entry = await table.deal(card, to, faceUp, rot);
    if (target === 'dealer') {
      dealer.entries.push(entry);
      if (!faceUp) dealer.hole = card;
    } else if (typeof target === 'number') hands[target].entries.push(entry);
    renderLabels();
    return card;
  }

  /** After a split: slide every hand's cards and chips to their new spots. */
  async function relayout() {
    const n = hands.length;
    for (let k = 0; k < MAX_HANDS; k++) table.removeStack('bet' + k);
    hands.forEach((h, i) => table.setStack('bet' + i, h.bet, SPOTS.bet(i, n)));
    await Promise.all(hands.flatMap((h, i) => h.entries.map((e, j) => table.move(e, SPOTS.hand(i, n, j)))));
  }

  // ---------- a round ----------
  async function startRound() {
    if (phase !== 'bet' || !bet) return;
    const total = bet * nHands + side.pairs + side.trips;
    if (bet < T.min) return toast(`This table's minimum is ${money(T.min)} a hand.`);
    if (total > getBalance()) return toast(`That's ${money(total)} and you have ${money(getBalance())}. The dealer can count, unfortunately.`);
    lastBet = bet;
    round++;
    // the pit boss's maths: a big bet just when the count is high?
    const trueCount = count / Math.max(1, shoe.length / 52);
    const totalMain = bet * nHands;
    if (avgBet && trueCount >= 2 && totalMain >= avgBet * 3) suspicion += 1;
    else suspicion = Math.max(0, suspicion - 0.25);
    avgBet = avgBet ? avgBet * 0.8 + totalMain * 0.2 : totalMain;

    adjust(-total);
    phase = 'deal';
    await table.clearCards();
    if (shoe.length < DECKS * 52 * 0.25) {
      shoe = newShoe();
      count = 0;
      say('shuffle');
      await wait(700);
    }
    hands = Array.from({ length: nHands }, () => ({ cards: [], entries: [], bet, done: false, doubled: false }));
    dealer = { cards: [], entries: [], hole: null };
    insurance = 0;
    tookBust = false;
    active = 0;
    sideStaked = side.pairs + side.trips;
    sideBack = 0;
    hands.forEach((h, i) => table.setStack('bet' + i, bet, SPOTS.bet(i, nHands)));
    if (side.pairs) table.setStack('side-pairs', side.pairs, SPOTS.side('pairs'));
    if (side.trips) table.setStack('side-trips', side.trips, SPOTS.side('trips'));
    if (sideStaked && chatty(0.3)) say('side');
    // everyone else puts their chips down
    for (const b of seated()) {
      b.result = '';
      b.turn = false;
      b.hand = { cards: [], bet: pick(b.bets) * T.botBet, doubled: false };
      table.setStack('bot' + b.deg, b.hand.bet, SPOTS.seatBet(b.deg));
    }
    sound.chip();
    bet = 0;
    render();
    if (!sideStaked && chatty(0.3)) say('deal');
    // round the table from the dealer's left, twice, the dealer last (second card face down)
    for (let pass = 0; pass < 2; pass++) {
      for (const b of rightOf()) {
        await dealTo(b);
        await wait(70);
      }
      for (let i = 0; i < hands.length; i++) {
        await dealTo(i);
        await wait(70);
      }
      for (const b of leftOf()) {
        await dealTo(b);
        await wait(70);
      }
      await dealTo('dealer', pass === 0);
      await wait(120);
    }
    await wait(150);
    await settleSideBets();

    // an ace showing: insurance? (only you get asked; the others never take it)
    if (dealer.cards[0].rank === 'A' && !hands.every((h) => isBlackjack(h.cards))) {
      phase = 'insurance';
      say('insurance');
      render();
      return; // insYes / insNo carry on
    }
    await afterInsurance();
  }

  async function settleSideBets() {
    if (!sideStaked) return;
    const mine = hands[0].cards;
    const results = [];
    if (side.pairs) results.push(['pairs', side.pairs, perfectPairs(mine)]);
    if (side.trips) results.push(['trips', side.trips, twentyOnePlus3([...mine, dealer.cards[0]])]);
    for (const [kind, amt, hit] of results) {
      if (!hit) continue;
      const win = amt * hit[1];
      sideBack += win + amt;
      table.setStack('sidepay-' + kind, win, SPOTS.side(kind).add({ x: kind === 'pairs' ? -0.34 : 0.34, y: 0, z: 0 }));
      banner(`${hit[0]}! ×${hit[1]}`, 'win');
      sound.win(hit[1] >= 25 ? 2 : 1);
      say('sideWin');
      emit('blackjack', { type: 'sidebet' });
      if (hit[0] === 'PERFECT PAIR') emit('blackjack', { type: 'perfect' });
      await wait(900);
    }
    await Promise.all(results.flatMap(([kind, , hit]) => [table.sweepStack('side-' + kind, !!hit), table.sweepStack('sidepay-' + kind, true)]));
    if (sideBack) adjust(sideBack);
  }

  async function afterInsurance() {
    phase = 'deal';
    render();
    const up = rankValue(dealer.cards[0].rank);
    // the dealer peeks with an ace or a ten showing
    if ((up === 11 || up === 10) && isBlackjack(dealer.cards)) {
      await revealHole();
      table.gesture('dab', 3);
      say('dealerBJ');
      return settle();
    }
    if (insurance) toast(`🛡️ No blackjack. Your ${money(insurance)} insurance is gone. As predicted.`);
    await playBots(rightOf());
    return yourTurn();
  }

  /** Your hands, one after another (a blackjack plays itself). */
  async function yourTurn() {
    let clapped = false;
    while (active < hands.length && isBlackjack(hands[active].cards) && !hands[active].fromSplit) {
      if (!clapped) {
        clapped = true;
        table.gesture('facepalm', 3);
        say('playerBJ');
        banner('BLACKJACK!', 'win');
        clap();
      }
      hands[active].done = true;
      active++;
      await wait(700);
    }
    if (active >= hands.length) return afterYou();
    phase = 'play';
    render();
  }

  function clap() {
    for (const b of seated()) {
      if (!chatty(0.45)) continue;
      table.botGesture(b.t3, 'wave', 2);
      botSay(b, pick(BOT_TALK.clap), 1800);
    }
  }

  // ---------- the bots play ----------
  function botMove(b) {
    const cards = b.hand.cards;
    const v = handValue(cards);
    const up = rankValue(dealer.cards[0].rank);
    if (v.total >= 21) return 'stand';
    if (cards.length === 2 && (v.total === 11 || (v.total === 10 && up < 10))) return b.style === 'nervous' ? 'hit' : 'double';
    if (b.style === 'reckless') {
      if (cards.length === 2 && v.total >= 9 && v.total <= 11) return 'double';
      if (v.total < 18 && Math.random() < 0.35) return 'hit';
    }
    if (b.style === 'grandma' && v.total === 16) return 'hit';
    if (b.style === 'nervous') return v.total < 12 ? 'hit' : 'stand';
    if (v.soft) return v.total <= 17 || (v.total === 18 && up >= 9) ? 'hit' : 'stand';
    if (v.total <= 11) return 'hit';
    if (v.total === 12) return up >= 4 && up <= 6 ? 'stand' : 'hit';
    if (v.total <= 16) return up >= 7 ? 'hit' : 'stand';
    return 'stand';
  }

  async function playBots(list) {
    if (!list.length) return;
    const was = phase;
    phase = 'bots';
    render();
    for (const b of list) {
      if (!table) return;
      b.turn = true;
      renderLabels();
      await wait(350);
      if (isBlackjack(b.hand.cards)) {
        botSay(b, pick(BOT_TALK.bj));
        table.botGesture(b.t3, 'dab', 2.5);
        await wait(700);
      } else {
        for (let guard = 0; guard < 8; guard++) {
          const move = botMove(b);
          if (move === 'stand') {
            if (chatty(0.4)) botSay(b, pick(drunk() >= 3 && Math.random() < 0.4 ? BOT_TALK.drunk : BOT_TALK.stand), 1600);
            await wait(350);
            break;
          }
          botSay(b, pick(move === 'double' ? BOT_TALK.double : BOT_TALK.hit), 1500);
          await wait(420);
          if (move === 'double') {
            b.hand.bet *= 2;
            b.hand.doubled = true;
            table.setStack('bot' + b.deg, b.hand.bet, SPOTS.seatBet(b.deg));
            sound.chip();
            await dealTo(b);
            break;
          }
          await dealTo(b);
          if (handValue(b.hand.cards).total > 21) break;
        }
        if (handValue(b.hand.cards).total > 21) {
          botSay(b, b.lines.bust);
          table.botGesture(b.t3, 'facepalm', 2.4);
          if (Math.random() < 0.5) say('bust');
          await wait(600);
        }
      }
      b.turn = false;
      renderLabels();
    }
    phase = was;
  }

  async function revealHole() {
    const entry = dealer.entries[1];
    if (!entry || entry.faceUp) return;
    cardSnap();
    await table.flip(entry);
    if (dealer.hole) count += hiLo(dealer.hole);
    dealer.hole = null;
    renderLabels();
  }

  // ---------- your hand(s) ----------
  async function nextHand() {
    hands[active].done = true;
    active++;
    while (active < hands.length) {
      // a split hand gets its second card when its turn comes
      if (hands[active].cards.length < 2) {
        await dealTo(active);
        if (hands[active].fromAces) {
          hands[active].done = true;
          active++;
          continue;
        }
      }
      if (handValue(hands[active].cards).total === 21) {
        hands[active].done = true;
        active++;
        continue;
      }
      phase = 'play';
      render();
      return;
    }
    return afterYou();
  }

  async function afterYou() {
    await playBots(leftOf());
    return dealerTurn();
  }

  async function hit() {
    if (phase !== 'play') return;
    phase = 'deal';
    render();
    // hitting a stiff hand while the dealer shows a bust card? the table has opinions
    const before = handValue(hands[active].cards).total;
    const up = rankValue(dealer.cards[0].rank);
    if (before >= 12 && before <= 16 && up >= 2 && up <= 6 && hands[active].cards.length === 2) {
      tookBust = true;
      const who = someone('basic');
      if (who && chatty(0.7)) botSay(who, `${pick(BOT_TALK.bustCard)} ${dealer.cards[0].rank}?!`, 2600);
    } else if (chatty(0.3)) say('hit');
    await dealTo(active);
    const v = handValue(hands[active].cards);
    phase = 'play';
    if (v.total > 21) {
      sound.blip(180, 0.25, 'sawtooth', 0.08);
      banner('BUST', 'lose');
      table.gesture('thumbsup', 2.4);
      say('bust');
      const who = someone();
      if (who && chatty(0.35)) setTimeout(() => botSay(who, pick(BOT_TALK.rookie), 1800), 700);
      await wait(500);
      return nextHand();
    }
    if (v.total === 21) return nextHand();
    render();
  }

  async function stand() {
    if (phase !== 'play') return;
    if (handValue(hands[active].cards).total < 13 && Math.random() < 0.6) say('stand');
    phase = 'deal';
    return nextHand();
  }

  async function double() {
    const h = hands[active];
    if (phase !== 'play' || h.cards.length !== 2 || getBalance() < h.bet) return;
    adjust(-h.bet);
    h.bet *= 2;
    h.doubled = true;
    table.setStack('bet' + active, h.bet, SPOTS.bet(active, hands.length));
    sound.chip();
    say('double');
    phase = 'deal';
    render();
    await dealTo(active);
    if (handValue(h.cards).total > 21) {
      banner('BUST', 'lose');
      table.gesture('thumbsup', 2.4);
      say('bust');
      await wait(500);
    }
    return nextHand();
  }

  async function split() {
    const h = hands[active];
    if (phase !== 'play' || hands.length >= MAX_HANDS || h.cards.length !== 2 || h.fromSplit || rankValue(h.cards[0].rank) !== rankValue(h.cards[1].rank) || getBalance() < h.bet) return;
    adjust(-h.bet);
    phase = 'deal';
    const aces = h.cards[0].rank === 'A';
    const half = (i) => ({ cards: [h.cards[i]], entries: [h.entries[i]], bet: h.bet, done: false, doubled: false, fromSplit: true, fromAces: aces });
    hands.splice(active, 1, half(0), half(1));
    say('split');
    emit('blackjack', { type: 'split' });
    sound.chip();
    render();
    await relayout();
    await dealTo(active);
    // split aces get one card each, and that's it
    if (aces || handValue(hands[active].cards).total === 21) return nextHand();
    phase = 'play';
    render();
  }

  async function surrender() {
    const h = hands[active];
    if (phase !== 'play' || h.cards.length !== 2 || h.fromSplit) return;
    h.surrendered = true;
    say('surrender');
    sound.blip(400, 0.15, 'triangle', 0.06);
    phase = 'deal';
    renderLabels();
    return nextHand();
  }

  // ---------- the dealer, and paying out ----------
  async function dealerTurn() {
    phase = 'dealer';
    render();
    await wait(300);
    await revealHole();
    const alive = (h) => !h.surrendered && handValue(h.cards).total <= 21 && !(isBlackjack(h.cards) && !h.fromSplit);
    const live = hands.some(alive) || inHand().some((b) => alive(b.hand));
    if (live) {
      while (handValue(dealer.cards).total < 17) {
        await wait(450);
        await dealTo('dealer');
      }
      if (handValue(dealer.cards).total > 21) {
        banner('DEALER BUSTS', 'win');
        say('dealerBust');
      }
    }
    await wait(350);
    settle();
  }

  /** 'bj' | 'win' | 'push' | 'lose' | 'surrender' for one hand against the dealer */
  function outcome(h) {
    if (h.surrendered) return 'surrender';
    const d = handValue(dealer.cards).total;
    const dBJ = isBlackjack(dealer.cards);
    const v = handValue(h.cards).total;
    const pBJ = isBlackjack(h.cards) && !h.fromSplit;
    if (v > 21) return 'lose';
    if (pBJ && !dBJ) return 'bj';
    if (dBJ && !pBJ) return 'lose';
    if (pBJ && dBJ) return 'push';
    if (d > 21 || v > d) return 'win';
    if (v === d) return 'push';
    return 'lose';
  }
  const paid = (res, stake) => (res === 'bj' ? stake * 2.5 : res === 'win' ? stake * 2 : res === 'push' ? stake : res === 'surrender' ? stake / 2 : 0);

  async function settle() {
    phase = 'dealer';
    const dBJ = isBlackjack(dealer.cards);
    let staked = insurance + sideStaked;
    let returned = (dBJ && insurance ? insurance * 3 : 0) + sideBack;
    const results = hands.map((h, i) => {
      staked += h.bet;
      const res = outcome(h);
      const back = paid(res, h.bet);
      returned += back;
      return { res, back, h, i };
    });
    returned = Math.floor(returned);
    const net = returned - staked;
    const botResults = inHand().map((b) => {
      const res = outcome(b.hand);
      return { b, res, back: Math.floor(paid(res, b.hand.bet)) };
    });

    // the dealer pays winners next to their bet, then it all slides to its owner (or the tray)
    const wins = (r) => r.res === 'win' || r.res === 'bj';
    for (const r of results) if (wins(r)) table.setStack('pay' + r.i, Math.floor(r.back - r.h.bet), SPOTS.bet(r.i, hands.length).add({ x: 0.42, y: 0, z: -0.05 }));
    for (const r of botResults) if (wins(r)) table.setStack('botpay' + r.b.deg, r.back - r.b.hand.bet, SPOTS.seatBet(r.b.deg).add({ x: 0.3, y: 0, z: 0.2 }));
    if ([...results, ...botResults].some(wins)) sound.chip();
    await wait([...results, ...botResults].some(wins) ? 650 : 250);
    await Promise.all([
      ...results.flatMap((r) => [table.sweepStack('bet' + r.i, r.res !== 'lose'), table.sweepStack('pay' + r.i, true)]),
      ...botResults.flatMap((r) => [table.sweepStack('bot' + r.b.deg, r.res !== 'lose'), table.sweepStack('botpay' + r.b.deg, true)]),
    ]);
    const mainBack = returned - sideBack; // the side bets were paid when they landed
    if (mainBack) adjust(mainBack);

    // the others react
    for (const r of botResults) {
      const n = r.back - r.b.hand.bet;
      r.b.result = r.res === 'push' ? 'PUSH' : n > 0 ? `+${money(n)}` : handValue(r.b.hand.cards).total > 21 ? 'BUST' : `−${money(-n)}`;
      r.b.rounds++;
      if (chatty(0.5) && handValue(r.b.hand.cards).total <= 21) {
        if (wins(r)) {
          botSay(r.b, r.b.lines.win);
          table.botGesture(r.b.t3, r.res === 'bj' ? 'dab' : 'flex', 2.4);
        } else if (r.res === 'lose') {
          botSay(r.b, r.b.lines.lose);
          table.botGesture(r.b.t3, 'facepalm', 2.2);
        }
      }
    }
    // …and at you: you took the dealer's bust card, and the dealer made his hand
    if (tookBust && handValue(dealer.cards).total <= 21) {
      const losers = botResults.filter((r) => r.res === 'lose');
      const who = (losers.find((r) => r.b.style === 'basic') || losers[0])?.b;
      if (who) setTimeout(() => botSay(who, pick(BOT_TALK.tookIt), 2600), 900);
    }

    // and you: what just happened, in words
    const any = (x) => results.some((r) => r.res === x);
    const big = net >= Math.max(100, (staked - sideStaked) * 1.5);
    if (net > 0) {
      banner(any('bj') ? `BLACKJACK! +${money(net)}` : `YOU WIN ${money(net)}`, 'win');
      if (!any('bj') && handValue(dealer.cards).total <= 21) say('win');
      const level = winLevel(net, staked);
      celebrate({ net, level, origin: { x: innerWidth / 2, y: innerHeight * 0.55 } });
      sound.win(level);
      if (big) {
        const fan = someone();
        if (fan) setTimeout(() => botSay(fan, pick(BOT_TALK.cheer), 2200), 500);
        // Grandma is proud of you
        const gran = seated().find((b) => b.style === 'grandma');
        if (gran && Math.random() < 0.6) {
          setTimeout(() => {
            if (!el) return;
            botSay(gran, 'Here, dear. Buy yourself something nice. 👵', 2800);
            adjust(5);
            toast('👵 Grandma Edna slid you $5.');
          }, 1500);
        }
        // no tip after a win like that? the dealer notices
        if (mood <= 0 && round - lastTip > 3) {
          setTimeout(() => say('stiffed'), 2200);
          mood = Math.min(mood, 0) - 2;
        }
      }
    } else if (net < 0) {
      const allBust = hands.every((h) => handValue(h.cards).total > 21);
      banner(any('surrender') && results.length === 1 ? 'SURRENDERED' : results.every((r) => r.res === 'lose') ? (allBust ? 'BUST' : 'DEALER WINS') : `NET ${money(net)}`, 'lose');
      if (!dBJ && !allBust && !any('surrender')) say('lose');
    } else {
      banner('PUSH', '');
      say('push');
    }

    // the table heats up (or cools down)
    const before = heat;
    heat = Math.max(-5, Math.min(5, heat + Math.sign(net)));
    if (heat >= 3 && before < 3) {
      setTimeout(() => say('hot'), 2400);
      for (const b of seated()) {
        table.botGesture(b.t3, 'wave', 2.4);
        if (chatty(0.5)) botSay(b, pick(BOT_TALK.hot), 2400);
      }
    } else if (heat <= -3 && before > -3) setTimeout(() => say('cold'), 2400);
    // the dealer's mood fades
    mood += mood > 0 ? -1 : mood < 0 ? 1 : 0;

    // the rest of the casino wants to know
    results.forEach((r) => {
      if (r.res === 'bj') emit('blackjack', { type: 'natural' });
      if (wins(r) && r.h.doubled) emit('blackjack', { type: 'double' });
      if (wins(r) && r.h.cards.length >= 5) emit('blackjack', { type: 'charlie' });
    });
    onRound?.({ net, staked, multiple: returned / staked, mult: (hot() ? 1.5 : 1) * (T === TABLES.highlimit ? 1.5 : 1) });

    phase = 'bet';
    bet = Math.max(0, Math.min(lastBet, Math.floor((getBalance() - side.pairs - side.trips) / nHands)));
    if (bet) table?.setStack('pending', bet, SPOTS.bet(0, 1));
    render();
    // the pit boss has been watching
    if (suspicion >= 3) {
      suspicion = 0;
      setTimeout(() => el && phase === 'bet' && escort(), 1800);
      return;
    }
    setTimeout(() => churn(), 2600);
  }

  // ---------- input ----------
  async function tip() {
    if (getBalance() < T.tip) return toast("You can't even afford to tip. The dealer understands. Barely.");
    adjust(-T.tip);
    lastTip = round;
    mood = Math.max(mood, 0) + 3;
    table.setStack('tip', T.tip, SPOTS.tip());
    sound.chip();
    say('tip');
    table.gesture('peace', 2);
    emit('blackjack', { type: 'tip' });
    render();
    await wait(600);
    table?.sweepStack('tip', false);
  }

  function onClick(e) {
    const t = e.target.closest('button');
    if (!t || !el) return;
    if (t.dataset.drink) {
      const v = visitors.find((x) => x.kind === 'waiter');
      if (!v) return;
      if (t.dataset.drink === 'yes') {
        const d = booze.pickDrink();
        booze.add(d);
        sound.clink?.();
        waiterLeave(v, pick(['Enjoy! 🍸', 'Cheers!', 'There you go!']));
        toast(`${d.emoji || '🍸'} ${d.name || 'A drink'}, on the house.`);
        const who = someone();
        if (who && drunk() >= 2 && chatty(0.5)) setTimeout(() => botSay(who, pick(BOT_TALK.drunk), 2400), 1200);
      } else waiterLeave(v, 'Suit yourself!');
      return;
    }
    if (phase === 'bet') {
      if (t.dataset.chip) {
        const v = +t.dataset.chip;
        if ((bet + v) * nHands + side.pairs + side.trips > getBalance()) return toast("You can't bet chips you don't have. Even here.");
        bet += v;
        sound.chip();
        table.setStack('pending', bet, SPOTS.bet(0, 1));
        return render();
      }
      if (t.dataset.hands != null) {
        nHands = (nHands % MAX_HANDS) + 1;
        sound.blip(1000, 0.04, 'triangle', 0.06);
        return render();
      }
      if (t.dataset.side) {
        const k = t.dataset.side;
        const opts = T.side;
        side[k] = opts[(opts.indexOf(side[k]) + 1) % opts.length] || 0;
        sound.chip();
        return render();
      }
      if (t.dataset.tip != null) return tip();
    }
    const act = t.dataset.act;
    if (act === 'clear') {
      bet = 0;
      table.removeStack('pending');
      render();
    } else if (act === 'rebet') {
      bet = Math.min(lastBet, Math.floor(getBalance() / nHands));
      table.setStack('pending', bet, SPOTS.bet(0, 1));
      sound.chip();
      render();
    } else if (act === 'deal') {
      table.removeStack('pending');
      startRound();
    } else if (act === 'hit') hit();
    else if (act === 'stand') stand();
    else if (act === 'double') double();
    else if (act === 'split') split();
    else if (act === 'surrender') surrender();
    else if (act === 'insYes' || act === 'insNo') {
      if (act === 'insYes') {
        insurance = Math.floor(hands.reduce((a, h) => a + h.bet, 0) / 2);
        adjust(-insurance);
        sound.chip();
      }
      afterInsurance();
    }
  }

  /** Keys at the table: H hit, S stand, D double, X split, R surrender, Space/Enter deal, Esc leave. (P is your phone.) */
  function key(e) {
    if (!el || e.repeat) return;
    if (['phone-on', 'settings-on'].some((c) => document.body.classList.contains(c)) || document.querySelector('dialog[open]')) return;
    const k = e.code;
    const press = (act) => $(`[data-act="${act}"]:not(:disabled)`)?.click();
    if (k === 'Escape') {
      e.preventDefault();
      if (phase === 'bet') close();
    } else if (k === 'Space' || k === 'Enter') {
      e.preventDefault();
      if (phase === 'bet') press('deal');
      else if (phase === 'play') press('stand');
    } else if (k === 'KeyH') press('hit');
    else if (k === 'KeyS') press('stand');
    else if (k === 'KeyD') press('double');
    else if (k === 'KeyX') press('split');
    else if (k === 'KeyR') press('surrender');
  }

  // ---------- the room ----------
  function fitTop() {
    // the top bar stays: phone, wallet, drinks and settings work from the table too
    if (el) el.style.top = `${Math.max(0, document.querySelector('.topbar')?.getBoundingClientRect().bottom || 0)}px`;
  }

  function open() {
    if (el) return;
    if (Date.now() < bannedUntil) return toast(`🚨 The pit boss is still watching the door. Try again in ${Math.ceil((bannedUntil - Date.now()) / 1000)} seconds.`);
    T = highLimit?.() ? TABLES.highlimit : TABLES.classic;
    el = document.createElement('div');
    el.className = `bj${T === TABLES.highlimit ? ' high-limit' : ''}`;
    el.innerHTML = `
      <div class="bj-stage"></div>
      <div class="bj-title"><b>🂡 ${T.name}</b><small>${T.sub}</small><span class="bj-heat"></span></div>
      <div class="bj-labels"><div class="bj-bubble dealer"></div></div>
      <div class="bj-banner"></div>
      <div class="bj-bar">
        <div class="bj-money"><span>Balance <b class="bj-bal"></b></span><span>Bet <b class="bj-bet"></b></span></div>
        <div class="bj-chips">${T.chips.map((v) => `<button type="button" class="bj-chip pchip c${v}" data-chip="${v}" aria-label="Add ${money(v)}">${v >= 1000 ? v / 1000 + 'K' : v}</button>`).join('')}</div>
        <div class="bj-extras"></div>
        <div class="bj-actions"></div>
      </div>`;
    document.body.appendChild(el);
    document.body.classList.add('in-blackjack');
    fitTop();
    addEventListener('resize', fitTop);
    onOpen?.();
    table = new BlackjackTable($('.bj-stage'), { highLimit: T === TABLES.highlimit });
    table.onFrame = () => placeLabels();
    el.addEventListener('click', onClick);
    requestAnimationFrame(() => el?.classList.add('on'));
    phase = 'bet';
    hands = [];
    dealer = { cards: [], entries: [], hole: null };
    visitors = [];
    side = { pairs: 0, trips: 0 };
    heat = 0;
    // a couple of regulars are already sitting there
    const n = 1 + Math.floor(Math.random() * 3);
    [...seats].sort(() => Math.random() - 0.5).slice(0, n).forEach((s) => join(s, false));
    lastBet = Math.max(lastBet, T.min);
    bet = Math.min(lastBet, Math.floor(getBalance()));
    if (bet) table.setStack('pending', bet, SPOTS.bet(0, 1));
    render();
    setTimeout(() => say('welcome'), 700);
    // while you think about your bet, people wander in and out; now and then the waiter drops by
    churnTimer = setInterval(() => churn(0.12, 0.18), 9000);
    const nextWaiter = () => (waiterTimer = setTimeout(() => (waiterVisit(), nextWaiter()), 35000 + Math.random() * 35000));
    nextWaiter();
    sound.blip(660, 0.08, 'triangle', 0.08);
  }

  function close(force = false) {
    if (!el || (phase !== 'bet' && !force)) return;
    const dying = el;
    const t = table;
    el = null;
    table = null;
    phase = 'bet';
    clearInterval(churnTimer);
    clearTimeout(waiterTimer);
    visitors.forEach((v) => clearTimeout(v.leaveTimer));
    visitors = [];
    removeEventListener('resize', fitTop);
    seats.forEach((s) => (s.bot = null));
    dying.classList.remove('on');
    setTimeout(() => {
      t?.dispose();
      dying.remove();
      document.body.classList.remove('in-blackjack');
      onClose?.();
    }, 350);
  }

  return {
    open,
    close,
    key,
    isOpen: () => !!el,
    /** mid-hand (or being walked out): you can't leave yet */
    busy: () => !!el && phase !== 'bet',
    refresh: render,
    /** the phone or settings opened over the table: stop drawing it */
    pause: () => table?.pause(),
    resume: () => table?.resume(),
  };
}
