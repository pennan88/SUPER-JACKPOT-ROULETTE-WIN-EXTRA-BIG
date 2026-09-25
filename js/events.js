// 📣 A tiny event bus: things that happen around the casino (a spin, a drink, a selfie…), so the
// daily challenges, achievements and loyalty card can listen without every module knowing them.

const subs = new Map();

/** fn(data) whenever `name` happens. */
export function on(name, fn) {
  if (!subs.has(name)) subs.set(name, []);
  subs.get(name).push(fn);
}

/**
 * Tell whoever is listening. Events used:
 *   spin      { game: 'roulette' | 'slots' | 'blackjack', net, staked, multiple, straight }
 *   drink     { price, bottle }
 *   selfie, food, cashout { amount }, buy { item }, freespins, dishes, broke, level { level }
 *   blackjack { type: 'natural' | 'double' | 'charlie' | 'split' | 'sidebet' | 'perfect' | 'tip' | 'counted' }
 */
export function emit(name, data = {}) {
  subs.get(name)?.forEach((fn) => fn(data));
}
