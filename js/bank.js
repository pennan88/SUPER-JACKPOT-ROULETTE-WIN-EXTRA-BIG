// 🏦 JACKPOTBANK, an app on your phone: your chips and your wallet, cashing out (chips → wallet, up
// to a daily limit that grows with your level), and adding (fake) funds by (fake) card or (fake)
// Swish. It's all pretend: nothing is charged, stored or sent anywhere.

import { RATE, dailyLimit } from './wallet.js';

const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const digits = (s) => s.replace(/\D/g, '');
const AMOUNTS = [100, 500, 1000, 5000];

function brandOf(num) {
  if (/^4/.test(num)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(num)) return 'mastercard';
  if (/^3[47]/.test(num)) return 'amex';
  if (/^6/.test(num)) return 'discover';
  return '';
}

function luhn(num) {
  let sum = 0;
  for (let i = 0; i < num.length; i++) {
    let d = +num[num.length - 1 - i];
    if (i % 2) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return num.length >= 13 && sum % 10 === 0;
}

/**
 * @param phone       () => the phone (to put it away once the money's in)
 * @param getBalance  () => chips in the casino. onTable: () => chips on the table
 * @param pending     () => wallet money still flying in
 * @param cashOut     (amount, toEl) => swap chips for wallet money; returns how much it swapped
 * @param deposit     (amount) => add fake money (the chips fly in once the phone is away)
 * @param reset       () => back to the starting balance (true if it did)
 * @param startBalance what reset goes back to
 */
export function createBank({ sound, toast, wallet, levels, phone, getBalance, onTable, pending, cashOut, deposit, reset, startBalance }) {
  let view = null;
  let header = null; // the phone's own header (with its back button), for the main page
  let page = 'home'; // home · card · swish · approve · wait · done
  let cashAmt = 100; // in wallet dollars; it costs cashAmt × RATE in chips
  let amount = 500; // what you're depositing
  let error = ''; // why the card was declined
  let waiting = ''; // what the waiting screen says
  let added = 0;
  let nudged = false; // you're broke: the app gets a badge

  const cashMax = () => Math.max(0, Math.min(wallet.left(), Math.floor(getBalance() / RATE)));
  const q = (s) => view?.querySelector(s);
  const sub = (title, small) => `<div class="ph-head"><button type="button" class="ph-back" data-page="home" aria-label="Back">‹</button><div><b>${title}</b><small>${small}</small></div></div>`;
  const amountBtns = (custom) =>
    `<div class="amounts${custom ? '' : ' amounts-4'}">${AMOUNTS.map((a) => `<button type="button" class="amount-opt" data-amount="${a}">${money(a)}</button>`).join('')}${
      custom ? '<input name="custom" inputmode="numeric" placeholder="Other" autocomplete="off" aria-label="Custom amount">' : ''
    }</div>`;

  // ---------- the pages ----------
  const PAGES = {
    home: () => `${header('JackpotBank', 'your money, sort of')}
      <div class="ph-scroll bk">
        <div class="bk-cards">
          <div class="bk-card chips"><small>🎰 Casino chips</small><b class="bk-casino"></b><span>Club Jackpot · <em class="bk-table"></em> on the table</span></div>
          <div class="bk-card purse"><small>👛 Wallet</small><b class="bk-wallet"></b><span>the store only takes this</span></div>
        </div>
        <h4>💱 Cash out</h4>
        <p class="bk-rate"><b>${money(RATE)}</b> in chips = <b>$1</b> in your wallet</p>
        <div class="wm-limit"><span class="bk-left"></span><div class="wm-bar"><i class="bk-bar"></i></div></div>
        <input type="range" class="bk-range" min="0" step="1" aria-label="Amount to cash out">
        <div class="wm-chips">
          <button type="button" class="st-chip" data-amt="50">$50</button>
          <button type="button" class="st-chip" data-amt="100">$100</button>
          <button type="button" class="st-chip" data-amt="250">$250</button>
          <button type="button" class="st-chip" data-amt="max">Max</button>
        </div>
        <button type="button" class="btn gold bk-go" data-cashout></button>
        <p class="bk-foot"></p>
        <h4>💳 Add funds</h4>
        <div class="bk-add">
          <button type="button" class="bk-fund card" data-page="card"><span>💳</span>Card</button>
          <button type="button" class="bk-fund swish" data-page="swish"><span>📱</span>Swish</button>
        </div>
        <p class="st-note">Fake money only. Nothing is charged, stored or sent, ever.</p>
        <button type="button" class="linkbtn bk-reset" data-reset>Reset balance to ${money(startBalance)}</button>
      </div>`,

    card: () => `${sub('💳 Add funds', 'a fake card, for fake money')}
      <div class="ph-scroll bk">
        <div class="notice">
          <strong>This is a fake payment form.</strong> Nothing is charged, stored or sent anywhere.
          Please don't type a real card: use <code>4242 4242 4242 4242</code>.
          <button type="button" class="linkbtn" data-fill>Fill test card</button>
        </div>
        <div class="card-preview">
          <div class="cp-top"><div class="emv"></div><div class="cp-brand">FAKECARD</div></div>
          <div class="cp-number">•••• •••• •••• ••••</div>
          <div class="cp-row">
            <div><small>Card holder</small><span class="cp-name">YOUR NAME</span></div>
            <div><small>Expires</small><span class="cp-exp">MM/YY</span></div>
          </div>
        </div>
        <div class="bk-form">
          <label class="field full">Card number<input name="number" inputmode="numeric" placeholder="4242 4242 4242 4242" autocomplete="off" spellcheck="false"></label>
          <label class="field full">Name on card<input name="holder" placeholder="Lucky Player" autocomplete="off" spellcheck="false"></label>
          <label class="field">Expiry<input name="exp" inputmode="numeric" placeholder="MM/YY" autocomplete="off"></label>
          <label class="field">CVC<input name="cvc" inputmode="numeric" placeholder="123" autocomplete="off"></label>
          <div class="field full">Amount${amountBtns(true)}</div>
          <p class="form-error full" role="alert">${error}</p>
          <button type="button" class="btn gold wide full bk-pay" data-pay></button>
          <p class="tiny full">Tip: <code>4000 0000 0000 0002</code> always gets declined.</p>
        </div>
      </div>`,

    swish: () => `${sub('📱 Swish', '(fake)')}
      <div class="ph-scroll bk">
        <div class="notice"><strong>This is a fake Swish.</strong> No app opens, no phone number is needed and no real money moves.</div>
        <div class="field">Amount${amountBtns(false)}</div>
        <button type="button" class="btn swish-go wide bk-swish" data-swish></button>
      </div>`,

    approve: () => `${sub('📱 Swish', '(not really)')}
      <div class="ph-scroll bk bk-center">
        <div class="sp-screen">
          <div class="sp-app">📱 Swish <small>(not really)</small></div>
          <div class="sp-to">Pay to<br><b>SUPER JACKPOT ROULETTE</b></div>
          <div class="sp-amt">${money(amount)}</div>
          <div class="sp-msg">Message: “definitely a good idea”</div>
          <button type="button" class="sp-approve" data-approve>Approve with Pretend-ID™</button>
        </div>
      </div>`,

    wait: () => `${sub('🏦 JackpotBank', 'one moment…')}
      <div class="ph-scroll bk bk-center"><div class="state"><div class="spinner"></div><p>${waiting}</p></div></div>`,

    done: () => `${sub('🏦 JackpotBank', 'all done')}
      <div class="ph-scroll bk bk-center"><div class="state"><div class="check">✓</div><p><strong>${money(added)}</strong> of fake money added</p><p class="tiny">Putting your phone away so you can watch the chips fly in…</p></div></div>`,
  };

  function show(p) {
    page = p;
    if (!view) return;
    view.innerHTML = PAGES[page]();
    paint();
  }

  // fill in the numbers in place, so the slider and the card form keep working while you use them
  function paint() {
    if (!view) return;
    if (page === 'home') {
      const max = cashMax();
      cashAmt = Math.max(Math.min(1, max), Math.min(cashAmt, max));
      const limit = wallet.limit();
      const left = wallet.left();
      q('.bk-casino').textContent = money(getBalance());
      q('.bk-table').textContent = money(onTable());
      q('.bk-wallet').textContent = money(wallet.cash() - pending());
      q('.bk-left').textContent = `${money(left)} of ${money(limit)} left today`;
      q('.bk-bar').style.width = `${((limit - left) / limit) * 100}%`;
      const range = q('.bk-range');
      range.max = max;
      range.value = cashAmt;
      range.disabled = !max;
      const go = q('.bk-go');
      go.disabled = !max;
      go.textContent = max ? `Swap ${money(cashAmt * RATE)} in chips for ${money(cashAmt)}` : 'Nothing to cash out';
      const lvl = levels.level();
      q('.bk-foot').textContent =
        !left ? `That's today's limit. It resets at midnight, and level ${lvl + 1} raises it to ${money(dailyLimit(lvl + 1))}.` :
        getBalance() < RATE ? `You need at least ${money(RATE)} in chips to get $1. Win some first (or, you know, the fake card).` :
        `Resets at midnight. Level ${lvl + 1} raises it to ${money(dailyLimit(lvl + 1))} a day.`;
    }
    const custom = q('[name=custom]');
    view.querySelectorAll('.amount-opt').forEach((b) => b.classList.toggle('active', !custom?.value && +b.dataset.amount === amount));
    if (q('.bk-pay')) q('.bk-pay').textContent = amount ? `Deposit ${money(amount)}` : 'Deposit';
    if (q('.bk-swish')) q('.bk-swish').textContent = `📱 Swish ${money(amount || 0)}`;
  }

  // ---------- the card ----------
  function cardPreview() {
    const d = digits(q('[name=number]').value);
    q('.cp-number').textContent = (d + '•'.repeat(Math.max(0, 16 - d.length))).replace(/(.{4})/g, '$1 ').trim();
    q('.cp-name').textContent = q('[name=holder]').value.trim().toUpperCase() || 'YOUR NAME';
    q('.cp-exp').textContent = q('[name=exp]').value || 'MM/YY';
    const brand = brandOf(d);
    q('.card-preview').dataset.brand = brand;
    q('.cp-brand').textContent = brand ? brand.toUpperCase() : 'FAKECARD';
  }

  function validate() {
    const errs = [];
    const mark = (el, bad, msg) => {
      el.classList.toggle('invalid', bad);
      if (bad) errs.push(msg);
    };
    const f = (n) => q(`[name=${n}]`);
    mark(f('number'), !luhn(digits(f('number').value)), 'Card number is invalid (try 4242 4242 4242 4242)');
    mark(f('holder'), !f('holder').value.trim(), 'Enter a name');
    const [mm, yy] = f('exp').value.split('/').map(Number);
    const now = new Date();
    const expired =
      !mm || mm > 12 || yy == null || isNaN(yy) ||
      2000 + yy < now.getFullYear() || (2000 + yy === now.getFullYear() && mm < now.getMonth() + 1);
    mark(f('exp'), expired, 'Expiry date is invalid or in the past');
    mark(f('cvc'), !/^\d{3,4}$/.test(f('cvc').value), 'CVC must be 3–4 digits');
    mark(f('custom'), amount < 1 || amount > 100000, 'Amount must be between $1 and $100,000');
    return errs;
  }

  function payByCard() {
    const errs = validate();
    q('.form-error').textContent = errs[0] || '';
    if (errs.length) return;
    // Stripe-style "decline" test card, for fun
    const declined = digits(q('[name=number]').value) === '4000000000000002';
    const amt = amount;
    waiting = 'Pretending to contact the bank…';
    show('wait'); // (and the card details are gone with the form: never kept, never sent)
    setTimeout(() => {
      if (declined) {
        if (!view) return (page = 'home');
        error = 'Card declined (that’s the decline test card 😉)';
        show('card');
        error = '';
        return;
      }
      paid(amt, '');
    }, 1300);
  }

  // ---------- the money's in ----------
  function paid(amt, how) {
    added = amt;
    deposit(amt);
    sound.cash();
    toast(`${how ? how + ': ' : ''}+${money(amt)} fake dollars added`);
    if (!view) return (page = 'home');
    show('done');
    setTimeout(() => {
      if (page !== 'done') return;
      page = 'home';
      phone().close();
    }, 1400);
  }

  function doCashOut() {
    const toEl = q('.bk-card.purse');
    if (cashOut(Math.min(cashAmt, cashMax()), toEl)) paint();
  }

  return {
    /** you're broke: badge the app */
    nudge() {
      nudged = true;
      phone()?.badge();
    },
    app: {
      id: 'bank',
      label: 'Bank',
      emoji: '🏦',
      dock: true,
      dot: () => nudged,
      html(h) {
        header = h;
        return PAGES[page]();
      },
      mount(v) {
        view = v;
        nudged = false;
        phone().badge();
        paint();
      },
      unmount() {
        view = null;
        if (page !== 'wait') page = 'home';
      },
      update: () => page === 'home' && paint(),
      input(el) {
        const n = el.name;
        if (el.classList.contains('bk-range')) {
          cashAmt = +el.value;
          paint();
        } else if (n === 'number') {
          el.value = digits(el.value).slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
          cardPreview();
        } else if (n === 'exp') {
          let d = digits(el.value).slice(0, 4);
          if (d.length === 1 && +d > 1) d = '0' + d;
          el.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
          cardPreview();
        } else if (n === 'cvc') {
          el.value = digits(el.value).slice(0, 4);
        } else if (n === 'holder') {
          cardPreview();
        } else if (n === 'custom') {
          el.value = digits(el.value).slice(0, 6);
          amount = +el.value || 0;
          paint();
        }
      },
      click(t) {
        if (t.dataset.page) {
          if (t.dataset.page !== 'home') amount = 500;
          show(t.dataset.page);
          if (page === 'card') q('[name=number]').focus();
        } else if (t.dataset.amt) {
          cashAmt = t.dataset.amt === 'max' ? cashMax() : +t.dataset.amt;
          paint();
          sound.blip(1200, 0.04, 'triangle', 0.07);
        } else if (t.dataset.cashout != null) {
          doCashOut();
        } else if (t.dataset.amount) {
          amount = +t.dataset.amount;
          const custom = q('[name=custom]');
          if (custom) custom.value = '';
          paint();
        } else if (t.dataset.fill != null) {
          q('[name=number]').value = '4242 4242 4242 4242';
          q('[name=holder]').value = 'Lucky Player';
          q('[name=exp]').value = `12/${String((new Date().getFullYear() + 3) % 100).padStart(2, '0')}`;
          q('[name=cvc]').value = '123';
          q('.bk-form').querySelectorAll('.invalid').forEach((el) => el.classList.remove('invalid'));
          q('.form-error').textContent = '';
          cardPreview();
        } else if (t.dataset.pay != null) {
          payByCard();
        } else if (t.dataset.swish != null) {
          if (!amount) return true;
          show('approve');
          sound.blip(1320, 0.08, 'sine', 0.1);
          sound.blip(1760, 0.12, 'sine', 0.1, 0.09);
        } else if (t.dataset.approve != null) {
          const amt = amount;
          waiting = 'Scanning your imaginary fingerprint…';
          show('wait');
          setTimeout(() => paid(amt, '📱 Swished'), 1500);
        } else if (t.dataset.reset != null) {
          if (reset()) paint();
        } else return false;
        return true;
      },
    },
  };
}
