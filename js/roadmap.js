// 🔮 COMING SOON™, an app on your phone: what's next (maybe), and a hype button that changes nothing.

// Keep in sync with the "COMING SOON™" section of README.md
const HEADLINERS = [
  { id: 'multiplayer', icon: '👯', title: 'MULTIPLAYER', desc: 'Lose fake money together, in real time, with your friends.', tag: 'perchance', pct: 35 },
  { id: 'slots', icon: '🎰', title: 'SLOTS', desc: 'SHIPPED! 🐉 DRAGON RUSH WIN BIG is live: 7×7 tumbles, ×1024 multiplier spots. Open 🗺️ Map on your phone and head over. DING DING DING.', tag: 'LIVE ✅', pct: 100 },
  { id: 'funny', icon: '🤡', title: 'OTHER FUNNY STUFF', desc: "You'll know it when you see it.", tag: 'guaranteed', pct: 100 },
];
const MAYBES = [
  ['🃏', 'Blackjack table in the corner, dealt by a suspiciously smug dealer', 'LIVE ✅'],
  ['🏆', 'Leaderboard of Shame, ranked by the biggest fake loss in one spin', 'someday'],
  ['🐔', 'Chicken mode: the ball is a tiny rubber chicken. Pays the same. Sounds worse.', 'please'],
  ['🍸', 'Free drinks: a waiter walks past every 30 seconds and never stops at your table', 'LIVE ✅'],
  ['🍾', 'VIP bottle service: bottle girls, sparklers, and your song from YouTube', 'LIVE ✅'],
  ['🧽', "Bar tab: can't pay? Wash dishes in the kitchen until the chef lets you go", 'LIVE ✅'],
  ['🍺', 'Dave remembers you: he borrows chips off your rack and texts you "u up? 🎰"', 'LIVE ✅'],
  ['🤕', 'Close the tab drunk and wake up hungover in a hotel room with a traffic cone', 'LIVE ✅'],
  ['📱', 'A phone: text Dave back (and regret it), call a cab, order a kebab, take selfies', 'LIVE ✅'],
  ['🎩', 'Your own 3D character, and a store full of hats (on your phone)', 'LIVE ✅'],
  ['🗺️', 'A map of the whole casino on your phone. Tap somewhere, walk there.', 'LIVE ✅'],
  ['🎲', 'Craps, purely so we can say "craps" in the game', 'lol'],
  ['🧓', 'Your grandma, who tells you to stop after 3 losses in a row', 'she insists'],
  ['🎟️', 'Loyalty card: earn points for every fake dollar lost, redeem for nothing', 'LIVE ✅'],
  ['📉', 'Fake stock ticker of your net worth, with dramatic crash sounds', 'maybe'],
  ['🌙', 'Night mode, even though casinos famously have no clocks or windows', 'ironic'],
  ['🔁', 'Martingale button: doubles your bet after every loss until the heat death of the universe', 'dangerous'],
  ['🎤', 'Hype announcer who screams "HE\'S ON FIRE" after two wins in a row', 'if bored'],
  ['🎁', 'Daily login bonus of $1, delivered via a 30-second unskippable animation', 'LIVE ✅'],
  ['🐋', 'Whale mode: 10× bigger chips and a velvet rope around the table', 'LIVE ✅'],
  ['🛸', 'Alien abduction: a UFO beams your chips away (it\'s in the T&Cs)', 'classified'],
  ['🎮', 'Controller support, because roulette on a gamepad is how nature intended', 'maybe'],
  ['🥚', 'Easter eggs we will absolutely forget where we hid', 'already lost'],
];

export function createRoadmap({ store, sound }) {
  const hype = store.get('fr.hype', {});
  const hypeBtn = (id) =>
    `<button type="button" class="rm-hype" data-hype="${id}" title="Hype it (changes nothing, feels great)">🔥 <b>${hype[id] || 0}</b></button>`;

  return {
    id: 'soon',
    label: 'Soon™',
    emoji: '🔮',
    html: (header) => `${header('Coming Soon™', 'subject to change, vibes, and whether we can be bothered')}
      <div class="ph-scroll rm-phone">
        <div class="rm-headliners">${HEADLINERS.map(
          (h) => `<div class="rm-card">
            <div class="rm-icon">${h.icon}</div>
            <div class="rm-title">${h.title}</div>
            <div class="rm-desc">${h.desc}</div>
            <div class="rm-meter" title="${h.pct}% likely (source: vibes)"><i style="width:${h.pct}%"></i></div>
            <div class="rm-row"><span class="rm-tag t-${h.pct}">${h.tag}</span>${hypeBtn(h.id)}</div>
          </div>`
        ).join('')}</div>
        <h3 class="rm-h3">🧪 Also maybe, possibly, who knows</h3>
        <ul class="rm-list">${MAYBES.map(
          ([icon, text, tag], i) =>
            `<li><span class="rm-li-icon">${icon}</span><span class="rm-li-text">${text}</span><span class="rm-tag${tag.startsWith('LIVE') ? ' live' : ''}">${tag}</span>${hypeBtn('m' + i)}</li>`
        ).join('')}</ul>
        <p class="rm-foot">None of these are promises. Some of these are threats.</p>
      </div>`,
    click(b) {
      if (!b.classList.contains('rm-hype')) return false;
      const id = b.dataset.hype;
      hype[id] = (hype[id] || 0) + 1;
      store.set('fr.hype', hype);
      b.querySelector('b').textContent = hype[id];
      b.classList.remove('bump');
      void b.offsetWidth;
      b.classList.add('bump');
      sound.chip();
      return true;
    },
  };
}
