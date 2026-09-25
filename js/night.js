// 📰 Everything notable that happened since your last morning after, for the newspaper on your
// hotel bed: biggest loss, biggest win, drinks, weddings, break-ups, UFOs, the pit boss…

import { on } from './events.js';

const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const pick = (a) => a[(Math.random() * a.length) | 0];

export function createNight({ store }) {
  const fresh = () => ({ spins: 0, bigWin: 0, bigLoss: 0, drinks: 0, bottles: 0, ufo: 0, counted: false, grandma: 0, naturals: 0, love: [] });
  let log = { ...fresh(), ...store.get('fr.night', {}) };
  const save = () => store.set('fr.night', log);
  const bump = (fn) => (fn(log), save());

  on('spin', (e) => bump((l) => {
    l.spins++;
    if (e.net > l.bigWin) l.bigWin = e.net;
    if (-e.net > l.bigLoss) l.bigLoss = -e.net;
  }));
  on('drink', (e) => bump((l) => (l.drinks++, e.bottle && l.bottles++)));
  on('ufo', (e) => bump((l) => (l.ufo += e.amount || 0)));
  on('grandma', (e) => bump((l) => (l.grandma += e.amount || 0)));
  on('blackjack', (e) => bump((l) => {
    if (e.type === 'counted') l.counted = true;
    if (e.type === 'natural') l.naturals++;
  }));
  // love life: { type: 'yes' | 'married' | 'dumped' | 'breakup' | 'slapped', name }
  on('girlfriend', (e) => bump((l) => (l.love = [...l.love, { type: e.type, name: e.name }].slice(-6))));

  /** Headlines, the biggest story first. */
  function headlines() {
    const h = [];
    const last = (type) => [...log.love].reverse().find((x) => x.type === type);
    const wed = last('married');
    const dumped = last('dumped');
    const broke = last('breakup');
    const slap = last('slapped');
    if (wed) h.push(`LOCAL GAMBLER MARRIES ${(wed.name || 'STRANGER').toUpperCase()} IN VEGAS CHAPEL`);
    if (dumped) h.push(`${(dumped.name || 'DATE').toUpperCase()} DUMPS LOCAL GAMBLER BY TEXT`);
    if (broke) h.push(`GAMBLER BREAKS ${(broke.name || 'SOMEONE').toUpperCase()}'S HEART AT ROULETTE TABLE`);
    if (slap) h.push(`SLAP HEARD ACROSS CASINO FLOOR; ${(slap.name || 'PARTNER').toUpperCase()} "SAW EVERYTHING"`);
    if (log.ufo) h.push(`UFO BEAMS UP ${money(log.ufo)} IN CHIPS. CASINO: "IT'S IN THE T&Cs"`);
    if (log.counted) h.push('CARD COUNTER ESCORTED FROM BLACKJACK TABLE BY PIT BOSS');
    if (log.bigLoss >= 500) h.push(`LOCAL GAMBLER LOSES ${money(log.bigLoss)} ON A SINGLE BET`);
    if (log.bigWin >= 500) h.push(`LOCAL GAMBLER WINS ${money(log.bigWin)}, SPENDS IT ON NOTHING SENSIBLE`);
    if (log.grandma) h.push(`GRANDMA CONFISCATES ${money(log.grandma)} "FOR SAFEKEEPING"`);
    if (log.bottles) h.push(`${log.bottles} BOTTLE${log.bottles > 1 ? 'S' : ''} OF CHAMPAGNE POPPED; SPARKLERS "EVERYWHERE"`);
    if (log.drinks >= 5) h.push(`BAR RUNS LOW AFTER ONE CUSTOMER ORDERS ${log.drinks} DRINKS`);
    if (log.naturals) h.push(`SMUG DEALER DEALS ${log.naturals} BLACKJACK${log.naturals > 1 ? 'S' : ''}, IS "FINE ABOUT IT"`);
    if (log.bigLoss && log.bigLoss < 500) h.push(`GAMBLER LOSES ${money(log.bigLoss)}, CALLS IT "A STRATEGY"`);
    if (!h.length) h.push(pick(['NOTHING HAPPENED LAST NIGHT. SOURCES DISAGREE.', 'DAVE STILL OWES EVERYONE MONEY', 'TRAFFIC CONE FOUND IN HOTEL BED. AGAIN.']));
    h.push(pick(['WEATHER: TOO BRIGHT', 'CASINO INSISTS IT HAS NO CLOCKS', 'DAVE SEEN LEAVING WITH SOMEONE ELSE\'S SHOES', 'CONE SHORTAGE HITS CITY HOTELS']));
    return h;
  }

  return {
    headlines,
    /** Start a new night (after the paper's been read). */
    reset() {
      log = fresh();
      save();
    },
  };
}
