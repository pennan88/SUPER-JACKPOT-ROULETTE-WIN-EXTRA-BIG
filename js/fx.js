// Full-screen win / loss effects: particle bursts, banners, screen shake, "YOU DIED".

const money = (n) => '$' + Math.abs(Math.round(n)).toLocaleString('en-US');

let active = null; // { el, finish }

export const fxActive = () => !!active;
export function dismissFx() {
  if (active) active.finish();
}

function mount(el, duration, onClose) {
  dismissFx();
  document.body.appendChild(el);
  let timer;
  const finish = () => {
    if (active?.el !== el) return;
    active = null;
    clearTimeout(timer);
    el.classList.add('out');
    setTimeout(() => el.remove(), 700);
    onClose?.();
  };
  active = { el, finish };
  el.addEventListener('click', finish);
  timer = setTimeout(finish, duration);
  return finish;
}

// ---------- particles ----------
const canvas = document.createElement('canvas');
canvas.className = 'fx-canvas';
const ctx = canvas.getContext('2d');
let particles = [];
let emitters = [];
let running = false;
let last = 0;
let dpr = 1;
// a jackpot throws thousands; past this many on screen, new ones are skipped (nobody can tell)
const MAX_PARTICLES = 1100;

function sizeCanvas() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
}
addEventListener('resize', sizeCanvas);

const CONFETTI = ['#ffd84d', '#ff4d6d', '#4dd2ff', '#7dff6a', '#c77dff', '#ffffff', '#ff9f1c'];
const rand = (a, b) => a + Math.random() * (b - a);

function spawn(x, y, angle, speed, coin) {
  if (particles.length >= MAX_PARTICLES) return;
  particles.push({
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    rot: rand(0, Math.PI * 2),
    vr: rand(-8, 8),
    flip: rand(0, Math.PI * 2),
    vf: rand(6, 16),
    size: coin ? rand(10, 18) : rand(5, 9),
    coin,
    color: CONFETTI[(Math.random() * CONFETTI.length) | 0],
    life: rand(2.2, 3.6),
  });
}

function burst(x, y, count, power) {
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + rand(-1.25, 1.25);
    spawn(x, y, a, rand(350, 1050) * power, Math.random() < 0.55);
  }
}

// the coin is painted once into a sprite, then stamped (gradients + text per coin per frame was the lag)
const COIN_R = 36; // big enough for the largest coin at 2× pixel ratio
const COIN_PAD = 3;
const COIN_HALF = (COIN_R + COIN_PAD) / COIN_R; // sprite half-width per unit of coin radius
const coinSprite = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 2 * (COIN_R + COIN_PAD);
  const g = c.getContext('2d');
  const r = COIN_R;
  g.translate(r + COIN_PAD, r + COIN_PAD);
  const grd = g.createLinearGradient(-r, -r, r, r);
  grd.addColorStop(0, '#fff6c2');
  grd.addColorStop(0.45, '#f2c14e');
  grd.addColorStop(1, '#a8701a');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(0, 0, r, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 4;
  g.strokeStyle = '#7a4c0c';
  g.stroke();
  g.beginPath();
  g.arc(0, 0, r * 0.62, 0, Math.PI * 2);
  g.strokeStyle = 'rgba(122,76,12,0.6)';
  g.stroke();
  g.fillStyle = '#7a4c0c';
  g.font = `bold ${r}px Georgia, serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('$', 0, 2);
  return c;
})();

function tick(now) {
  const dt = Math.min((now - last) / 1000, 0.04);
  last = now;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = emitters.length - 1; i >= 0; i--) {
    const e = emitters[i];
    e.t += dt;
    e.acc += dt * e.rate;
    while (e.acc >= 1) {
      e.acc -= 1;
      e.emit();
    }
    if (e.t >= e.duration) emitters.splice(i, 1);
  }

  // update + draw, compacting the survivors in place (no new array every frame)
  const bottom = innerHeight + 40;
  let n = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.life -= dt;
    p.vy += 1100 * dt;
    const drag = p.coin ? 0.992 : 0.975;
    p.vx *= drag;
    p.vy *= drag;
    if (!p.coin) p.vy = Math.min(p.vy, 260); // confetti flutters
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.flip += p.vf * dt;
    if (p.life <= 0 || p.y > bottom) continue;
    particles[n++] = p;

    ctx.globalAlpha = Math.min(1, p.life / 0.5);
    const cos = Math.cos(p.rot) * dpr;
    const sin = Math.sin(p.rot) * dpr;
    if (p.coin) {
      // rotate, then squash sideways as it flips
      const k = Math.max(0.08, Math.abs(Math.cos(p.flip)));
      ctx.setTransform(cos * k, sin * k, -sin, cos, p.x * dpr, p.y * dpr);
      const h = p.size * COIN_HALF;
      ctx.drawImage(coinSprite, -h, -h, 2 * h, 2 * h);
    } else {
      const k = Math.cos(p.flip);
      ctx.setTransform(cos, sin, -sin * k, cos * k, p.x * dpr, p.y * dpr);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size, p.size, p.size * 2);
    }
  }
  particles.length = n;
  ctx.globalAlpha = 1;

  if (particles.length || emitters.length) {
    requestAnimationFrame(tick);
  } else {
    running = false;
    canvas.remove();
  }
}

function startParticles() {
  if (!canvas.isConnected) {
    sizeCanvas();
    document.body.appendChild(canvas);
  }
  if (!running) {
    running = true;
    last = performance.now();
    requestAnimationFrame(tick);
  }
}

/** A standalone coin + confetti burst. */
export function confetti(x = innerWidth / 2, y = innerHeight * 0.4, count = 120, power = 1.1) {
  startParticles();
  burst(x, y, count, power);
}

// ---------- win ----------
export const TIERS = ['WIN', 'BIG WIN', 'MEGA WIN', 'JACKPOT!'];

export function winLevel(net, staked) {
  const mult = net / Math.max(staked, 1);
  return mult >= 15 ? 3 : mult >= 4 ? 2 : mult >= 1.5 ? 1 : 0;
}

// your win style (bought in the store) plugs in here, for roulette and slots alike
let winFlair = null;
export const setWinFlair = (fn) => (winFlair = fn);

export function celebrate({ net, level, origin }) {
  const duration = 2600 + level * 900;
  winFlair?.({ level, origin });

  // Screen shake + flash
  const shaken = document.querySelectorAll('header, main');
  shaken.forEach((el) => {
    el.classList.remove('shake-0', 'shake-1', 'shake-2', 'shake-3');
    void el.offsetWidth;
    el.classList.add('shake-' + level);
  });
  setTimeout(() => shaken.forEach((el) => el.classList.remove('shake-' + level)), 900 + level * 250);

  // Particles
  startParticles();
  const ox = origin?.x ?? innerWidth / 2;
  const oy = origin?.y ?? innerHeight * 0.35;
  burst(ox, oy, 70 + level * 70, 1 + level * 0.15);
  if (level >= 1) {
    const fountain = (x, dir) => ({
      t: 0, acc: 0, rate: 40 + level * 25, duration: 1.2 + level * 0.5,
      emit: () => spawn(x, innerHeight + 10, -Math.PI / 2 + dir * rand(0.15, 0.55), rand(900, 1400), Math.random() < 0.5),
    });
    emitters.push(fountain(0, 1), fountain(innerWidth, -1));
  }
  if (level >= 3) {
    emitters.push({
      t: 0, acc: 0, rate: 90, duration: 3.5,
      emit: () => spawn(rand(0, innerWidth), -20, Math.PI / 2, rand(50, 250), true),
    });
  }
  if (level >= 2) {
    setTimeout(() => burst(innerWidth * 0.25, innerHeight * 0.45, 60, 1.1), 450);
    setTimeout(() => burst(innerWidth * 0.75, innerHeight * 0.45, 60, 1.1), 800);
  }

  // Banner
  const el = document.createElement('div');
  el.className = `win-fx lvl-${level}`;
  el.innerHTML = `
    <div class="flash"></div>
    <div class="rays"></div>
    <div class="win-inner">
      <div class="win-title">${TIERS[level].split('').map((c, i) => `<span style="--i:${i}">${c === ' ' ? '&nbsp;' : c}</span>`).join('')}</div>
      <div class="win-amount">+$0</div>
    </div>`;
  mount(el, duration);
  const amountEl = el.querySelector('.win-amount');
  const countDur = 900 + level * 500;
  const t0 = performance.now();
  (function count(now) {
    const u = Math.min((now - t0) / countDur, 1);
    amountEl.textContent = '+' + money(net * (1 - Math.pow(1 - u, 3)));
    if (u < 1 && el.isConnected) requestAnimationFrame(count);
    else amountEl.classList.add('done');
  })(t0);
}

// ---------- loss ----------
export function youDied({ lost, broke }) {
  const el = document.createElement('div');
  el.className = 'died';
  el.innerHTML = `
    <div class="died-band">
      <h1>YOU DIED</h1>
      <p>${broke ? 'Your wallet has been hollowed' : `${money(lost)} lost to the wheel`}</p>
    </div>`;
  mount(el, 4200);
}
