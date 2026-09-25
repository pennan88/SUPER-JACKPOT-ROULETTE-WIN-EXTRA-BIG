// Ball physics for the roulette wheel. Plain maths, no three.js, so a whole spin can be
// simulated up front: planSpin() tries launch speeds until the simulated ball comes to
// rest in the drawn pocket, and the wheel then plays that trajectory back. The ball
// really collides with the frets, diamonds and walls, so it can never pass through them.

export const N = 37;
export const TAU = Math.PI * 2;
export const STEP = TAU / N;

// Radii / heights (world units)
export const R_IN = 2.2;       // inner edge of pockets (foot of the centre cone)
export const R_POCKET = 3.0;   // pockets end, number ring starts
export const R_OUT = 3.4;      // outer edge of rotating disc
export const R_REST = 2.6;     // where a settled ball sits in its pocket
export const R_WALL = 4.0;     // outer wall of the ball track
export const DISC_Y = 0.02;
export const BALL_R = 0.1;

// Profile of the static bowl's sloped apron: [r, y] points
export const APRON = [[3.4, DISC_Y], [3.45, 0.06], [3.9, 0.34], [4.0, 0.36]];

// Frets between pockets: radial boxes from R_IN to R_POCKET standing on the disc
export const FRET_H = 0.035;   // low, so the ball can hop over them and rattle between pockets
export const FRET_T = 0.02;

// Diamond deflectors on the apron, alternating radial / tangential
export const DIAMOND_R = 3.68;
export const DIAMOND_LONG = 0.1;   // half-length along the long axis
export const DIAMOND_SHORT = 0.04; // half-width
export const DIAMOND_H = 0.035;    // half-height
export const DIAMOND_LIFT = 0.022; // centre height above the apron
export const DIAMONDS = Array.from({ length: 8 }, (_, i) => ({
  a: (i / 8) * TAU + STEP / 2,
  radial: i % 2 === 0,
}));

// Wheel spin-down: omega relaxes to idle at this rate (1/s)
export const SPIN_DOWN = 0.3;

export function surfaceY(r) {
  if (r <= APRON[0][0]) return DISC_Y;
  for (let i = 1; i < APRON.length; i++) {
    const [r1, y1] = APRON[i];
    const [r0, y0] = APRON[i - 1];
    if (r <= r1) return y0 + ((r - r0) / (r1 - r0)) * (y1 - y0);
  }
  return APRON[APRON.length - 1][1];
}

function surfaceSlope(r) {
  if (r <= APRON[0][0]) return 0;
  for (let i = 1; i < APRON.length; i++) {
    const [r1, y1] = APRON[i];
    const [r0, y0] = APRON[i - 1];
    if (r <= r1) return (y1 - y0) / (r1 - r0);
  }
  return 0;
}

/** Height of the ball's centre when resting on the surface at radius r. */
export const restY = (r) => surfaceY(r) + BALL_R * Math.sqrt(1 + surfaceSlope(r) ** 2);

/** Wheel angle and speed t seconds after being kicked to w0. */
export function wheelAt(phi0, w0, idle, t) {
  const f = Math.exp(-SPIN_DOWN * t);
  return { phi: phi0 + idle * t + ((w0 - idle) / SPIN_DOWN) * (1 - f), omega: idle + (w0 - idle) * f };
}

const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrapPi = (a) => a - TAU * Math.round(a / TAU);

// Tuning
const DT = 1 / 480;          // physics step (small enough that nothing tunnels)
export const FPS = 120;      // recorded trajectory rate
const REC_EVERY = Math.round(1 / DT / FPS);
const G = 38;                // gravity
const TL = 0.6;              // launch hop out of the pocket (s)
const R_LAUNCH = R_WALL - BALL_R;
const HOP = 0.75;
const E_FLOOR = 0.55, BOUNCE_MIN = 0.25;
const E_WALL = 0.2, E_CONE = 0.45, E_FRET = 0.1, E_DIAMOND = 0.3;
const ROLL_C0 = 1.5, ROLL_C1 = 0.2;     // rolling resistance on the apron
const ROTOR_MU = 0.5;                   // slip damping against the spinning rotor
const POCKET_MU = 1.2;                  // ...and inside a pocket
const POCKET_C0 = 1;                    // steady pocket drag: kills the last little wobbles
const A_RING = 30;                      // the number ring slopes steeply down into the pockets
const A_ROTOR = 9;                      // pocket floor dishes the ball towards R_REST
const K_POCKET = 2.5;                   // pocket floor pulls the ball towards its centre
const FRET_MID = (R_IN + R_POCKET) / 2;
const FRET_HL = (R_POCKET - R_IN) / 2;
const DIA_CR = Math.max(DIAMOND_SHORT, DIAMOND_H);
const DIA_HL = DIAMOND_LONG - DIA_CR;
const DIA_Y = surfaceY(DIAMOND_R) + DIAMOND_LIFT;

/**
 * Simulate one spin. rel0 is the ball's angle relative to the wheel (resting in a pocket),
 * launch is the ball's angular speed on the track (rad/s, against the wheel).
 * Returns the recorded trajectory in wheel-relative polar coords plus sound events.
 */
export function simulate({ phi0, omega0, idle, rel0, launch, maxT = 13 }) {
  const frames = [];   // rel, r, y per 1/FPS
  const roll = [];     // speed 0..1, trackPos 0..1 per 1/FPS
  const events = [];   // { t, type: 'tick' | 'clack', v }
  const wheel = (t) => wheelAt(phi0, omega0, idle, t);

  // --- Launch: hop straight up out of the pocket, then arc out onto the track ---
  // The ball only starts moving sideways relative to the wheel once it is clear of the frets.
  const wl = wheel(TL);
  const K = (-(launch + wl.omega) * TL) / 3; // extra angle, so the arc ends at -launch rad/s
  const launchPos = (t) => {
    const s = t / TL;
    const m = smooth(s);
    const r = lerp(R_REST, R_LAUNCH, m);
    const y = lerp(DISC_Y + BALL_R, restY(R_LAUNCH), m) + HOP * Math.sin(Math.PI * s);
    const rel = rel0 + K * s * s * s;
    const th = wheel(t).phi + rel;
    return [r * Math.cos(th), y, -r * Math.sin(th), rel, r];
  };
  const nLaunch = Math.round(TL * FPS);
  for (let i = 0; i < nLaunch; i++) {
    const p = launchPos(i / FPS);
    frames.push(p[3], p[4], p[1]);
    roll.push(0, 0);
  }

  let [x, y, z] = launchPos(TL);
  const e = 1e-4;
  const pb = launchPos(TL - e);
  let vx = (x - pb[0]) / e, vy = (y - pb[1]) / e, vz = (z - pb[2]) / e;
  let rel = launchPos(TL)[3];

  let t = TL;
  let still = 0;
  let lastTick = -1, lastClack = -1;
  let settled = false;
  let step = 0;

  while (t < maxT) {
    t += DT;
    step++;
    const f = Math.exp(-SPIN_DOWN * t);
    const phi = phi0 + idle * t + ((omega0 - idle) / SPIN_DOWN) * (1 - f);
    const omega = idle + (omega0 - idle) * f;

    vy -= G * DT;
    x += vx * DT;
    y += vy * DT;
    z += vz * DT;

    let r = Math.hypot(x, z);
    let rx = x / r, rz = z / r;

    // Outer wall of the track
    if (r > R_WALL - BALL_R) {
      r = R_WALL - BALL_R;
      x = rx * r;
      z = rz * r;
      const vr = vx * rx + vz * rz;
      if (vr > 0) {
        vx -= (1 + E_WALL) * vr * rx;
        vz -= (1 + E_WALL) * vr * rz;
      }
    }
    // Foot of the centre cone
    if (r < R_IN + BALL_R) {
      r = R_IN + BALL_R;
      x = rx * r;
      z = rz * r;
      const vr = vx * rx + vz * rz;
      if (vr < 0) {
        vx -= (1 + E_CONE) * vr * rx;
        vz -= (1 + E_CONE) * vr * rz;
      }
    }

    // Floor: the static apron, or the spinning rotor inside R_OUT
    const onRotor = r < R_OUT;
    const s = surfaceSlope(r);
    const q = Math.sqrt(1 + s * s);
    const nx = (-s * rx) / q, ny = 1 / q, nz = (-s * rz) / q;
    const floorY = surfaceY(r) + BALL_R * q;
    const svx = onRotor ? omega * z : 0;
    const svz = onRotor ? -omega * x : 0;
    let grounded = false;
    let relSpeed = Infinity;
    if (y <= floorY + 1e-4) {
      grounded = true;
      if (y < floorY) y = floorY;
      let ux = vx - svx, uy = vy, uz = vz - svz;
      const un = ux * nx + uy * ny + uz * nz;
      if (un < 0) {
        const j = -un > BOUNCE_MIN ? (1 + E_FLOOR) * un : un;
        ux -= j * nx;
        uy -= j * ny;
        uz -= j * nz;
        // landing in a pocket clicks too, not just knocking a fret
        if (r < R_POCKET && -un > 0.8 && t - lastTick > 0.03) {
          events.push({ t, type: 'tick', v: Math.min(1, -un / 4) });
          lastTick = t;
        }
      }
      const un2 = ux * nx + uy * ny + uz * nz;
      let tx = ux - un2 * nx, ty = uy - un2 * ny, tz = uz - un2 * nz;
      const tl = Math.hypot(tx, ty, tz);
      if (tl > 1e-9) {
        const dec = onRotor ? (r < R_POCKET ? POCKET_MU * tl + POCKET_C0 : ROTOR_MU * tl + 0.3) * DT : (ROLL_C0 + ROLL_C1 * tl) * DT;
        const k = Math.max(0, 1 - dec / tl);
        tx *= k;
        ty *= k;
        tz *= k;
      }
      ux = tx + un2 * nx;
      uy = ty + un2 * ny;
      uz = tz + un2 * nz;
      relSpeed = Math.hypot(ux, uy, uz);
      vx = ux + svx;
      vy = uy;
      vz = uz + svz;

      if (onRotor) {
        // The rotor dishes down into the pockets and each pocket is rounded
        const ar = r > R_POCKET ? -A_RING : -A_ROTOR * clamp((r - R_REST) / 0.3, -1, 1);
        vx += ar * rx * DT;
        vz += ar * rz * DT;
        if (r < R_POCKET) {
          const thRel = Math.atan2(-z, x) - phi;
          const w = wrapPi(thRel - Math.round(thRel / STEP) * STEP) * r;
          const at = -K_POCKET * clamp(w / 0.12, -1, 1);
          vx += at * rz * DT;
          vz -= at * rx * DT;
        }
      }
    }

    const th = Math.atan2(-z, x);

    // Frets (rotate with the wheel)
    if (r < R_POCKET + BALL_R && y < DISC_Y + FRET_H + BALL_R) {
      const thRel = th - phi;
      const k = Math.round((thRel - STEP / 2) / STEP);
      const a = k * STEP + STEP / 2 + phi;
      const dx = Math.cos(a), dz = -Math.sin(a); // along the fret
      const ex = -dz, ez = dx;                   // across it
      const u = x * dx + z * dz - FRET_MID;
      const w = x * ex + z * ez;
      const yl = y - (DISC_Y + FRET_H / 2);
      const du = u - clamp(u, -FRET_HL, FRET_HL);
      const dy = yl - clamp(yl, -FRET_H / 2, FRET_H / 2);
      let dw = w - clamp(w, -FRET_T / 2, FRET_T / 2);
      if (du === 0 && dy === 0 && dw === 0) dw = (w < 0 ? -1 : 1) * 1e-6;
      const d = Math.hypot(du, dy, dw);
      if (d < BALL_R) {
        const mx = (du * dx + dw * ex) / d, my = dy / d, mz = (du * dz + dw * ez) / d;
        const push = BALL_R - d;
        x += mx * push;
        y += my * push;
        z += mz * push;
        const fvx = omega * z, fvz = -omega * x;
        const ux = vx - fvx, uz = vz - fvz;
        const vn = ux * mx + vy * my + uz * mz;
        if (vn < 0) {
          const j = (1 + E_FRET) * vn;
          vx -= j * mx;
          vy -= j * my;
          vz -= j * mz;
          if (-vn > 0.25 && t - lastTick > 0.03) {
            events.push({ t, type: 'tick', v: Math.min(1, -vn / 3) });
            lastTick = t;
          }
        }
      }
    }

    // Diamonds (fixed to the bowl)
    if (r > DIAMOND_R - 0.3 && r < DIAMOND_R + 0.3) {
      const i = (((Math.round((th - STEP / 2) / (TAU / 8))) % 8) + 8) % 8;
      const dm = DIAMONDS[i];
      const cx = DIAMOND_R * Math.cos(dm.a), cz = -DIAMOND_R * Math.sin(dm.a);
      const ax = dm.radial ? Math.cos(dm.a) : Math.sin(dm.a);
      const az = dm.radial ? -Math.sin(dm.a) : Math.cos(dm.a);
      const tau = clamp((x - cx) * ax + (z - cz) * az, -DIA_HL, DIA_HL);
      const px = x - (cx + ax * tau), py = y - DIA_Y, pz = z - (cz + az * tau);
      const d = Math.hypot(px, py, pz);
      const min = BALL_R + DIA_CR;
      if (d < min && d > 0) {
        const mx = px / d, my = py / d, mz = pz / d;
        x += mx * (min - d);
        y += my * (min - d);
        z += mz * (min - d);
        const vn = vx * mx + vy * my + vz * mz;
        if (vn < 0) {
          const j = (1 + E_DIAMOND) * vn;
          vx -= j * mx;
          vy -= j * my;
          vz -= j * mz;
          if (-vn > 0.6 && t - lastClack > 0.15) {
            events.push({ t, type: 'clack', v: Math.min(1, -vn / 6) });
            lastClack = t;
          }
        }
      }
    }

    // Keep rel continuous (unwrapped)
    const thRel = Math.atan2(-z, x) - phi;
    rel += wrapPi(thRel - rel);

    if (step % REC_EVERY === 0) {
      r = Math.hypot(x, z);
      frames.push(rel, r, y);
      const onTrack = grounded && r > R_POCKET;
      const angSpeed = Math.abs((x * vz - z * vx) / (r * r));
      roll.push(onTrack ? Math.min(1, angSpeed / 13) : 0, onTrack ? clamp((r - R_POCKET) / (R_LAUNCH - R_POCKET), 0, 1) : 0);
    }

    if (!(Math.abs(x) < 10 && Math.abs(z) < 10 && y > -1 && y < 5)) return { ok: false };

    // Settled: sitting low in a pocket, barely moving against the rotor
    if (grounded && r < R_POCKET && relSpeed < 0.12) still += DT;
    else still = 0;
    if (still > 0.35) {
      settled = true;
      break;
    }
  }
  if (!settled) return { ok: false };

  // Roll the last little bit to the bottom of the pocket
  const pocketK = Math.round(rel / STEP);
  const endRel = pocketK * STEP;
  const [sRel, sR, sY] = frames.slice(-3);
  const nBlend = Math.round(0.5 * FPS);
  for (let i = 1; i <= nBlend; i++) {
    const m = smooth(i / nBlend);
    frames.push(lerp(sRel, endRel, m), lerp(sR, R_REST, m), lerp(sY, DISC_Y + BALL_R, m));
    roll.push(0, 0);
  }

  return {
    ok: true,
    pocket: ((pocketK % N) + N) % N,
    endRel,
    T: (frames.length / 3 - 1) / FPS,
    frames: Float64Array.from(frames),
    roll: Float32Array.from(roll),
    events,
    phi0,
    omega0,
    idle,
  };
}

/**
 * Find a spin that lands in pocket index `pocket`. Tries random launch and wheel speeds;
 * the landing pocket is chaotic in both, so a match usually turns up within a few dozen tries.
 */
export function planSpin({ pocket, phi0, idle, rel0, rand = Math.random, budgetMs = 250 }) {
  let fallback = null;
  const t0 = performance.now();
  while (performance.now() - t0 < budgetMs) {
    const sim = simulate({
      phi0,
      idle,
      rel0,
      omega0: 2.4 + rand() * 0.6,
      launch: 7.5 + rand() * 2.5,
    });
    if (!sim.ok || sim.T < 6 || sim.T > 12) continue;
    if (sim.pocket === pocket) return sim;
    fallback ||= sim;
  }
  return fallback; // out of time (rare): the ball lands wherever it really went, still a fair draw
}
