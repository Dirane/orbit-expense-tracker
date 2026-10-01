/* Orbit — offline-first expense tracker. No dependencies. */
(() => {
  'use strict';

  const APP_VERSION = '1.1.0';
  const STORE_KEY = 'orbit.v1';
  const MAX_CENTS = 99_999_999_999; // 999,999,999.99
  const NOTE_MAX = 140;

  /* =========================================================
     Utilities
     ========================================================= */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const icon = (id, cls = 'i') => `<svg class="${cls}" aria-hidden="true"><use href="#${id}"/></svg>`;
  const haptic = (ms = 10) => { try { navigator.vibrate?.(ms); } catch { /* unsupported */ } };

  // Dates are stored as local 'YYYY-MM-DD' strings (never via toISOString, which is UTC).
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => ymd(new Date());
  const parseYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const isValidYmd = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && ymd(parseYmd(s)) === s && s >= '1900-01-01' && s <= '2999-12-31';
  const monthOf = (s) => s.slice(0, 7);
  const curMonth = () => monthOf(today());
  const daysInMonth = (y, m) => new Date(y, m, 0).getDate(); // m is 1-based
  const addDays = (s, n) => { const d = parseYmd(s); d.setDate(d.getDate() + n); return ymd(d); };
  const addMonths = (mk, n) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
  const mkParts = (mk) => mk.split('-').map(Number);

  /* =========================================================
     Constants
     ========================================================= */
  const PALETTE = ['#5EEAD4', '#818CF8', '#F472B6', '#FB923C', '#FACC15', '#34D399', '#60A5FA', '#F87171', '#C084FC', '#2DD4BF', '#E879F9', '#94A3B8'];
  const ICONS = ['food', 'cart', 'car', 'bag', 'bolt', 'home', 'heart', 'play', 'globe', 'book', 'coffee', 'gift', 'repeat', 'dumbbell', 'paw', 'briefcase', 'laptop', 'trend', 'wallet', 'baby', 'shirt', 'dots'];
  const FALLBACK = { expense: 'other', income: 'other-income' };
  const DEFAULT_CATS = [
    { id: 'food', name: 'Dining', icon: 'food', color: '#FB923C', type: 'expense' },
    { id: 'groceries', name: 'Groceries', icon: 'cart', color: '#34D399', type: 'expense' },
    { id: 'transport', name: 'Transport', icon: 'car', color: '#60A5FA', type: 'expense' },
    { id: 'shopping', name: 'Shopping', icon: 'bag', color: '#F472B6', type: 'expense' },
    { id: 'bills', name: 'Bills', icon: 'bolt', color: '#FACC15', type: 'expense' },
    { id: 'housing', name: 'Housing', icon: 'home', color: '#818CF8', type: 'expense' },
    { id: 'health', name: 'Health', icon: 'heart', color: '#F87171', type: 'expense' },
    { id: 'fun', name: 'Entertainment', icon: 'play', color: '#C084FC', type: 'expense' },
    { id: 'travel', name: 'Travel', icon: 'globe', color: '#2DD4BF', type: 'expense' },
    { id: 'coffee', name: 'Coffee', icon: 'coffee', color: '#E879F9', type: 'expense' },
    { id: 'subscriptions', name: 'Subscriptions', icon: 'repeat', color: '#5EEAD4', type: 'expense' },
    { id: 'other', name: 'Other', icon: 'dots', color: '#94A3B8', type: 'expense' },
    { id: 'salary', name: 'Salary', icon: 'briefcase', color: '#34D399', type: 'income' },
    { id: 'freelance', name: 'Freelance', icon: 'laptop', color: '#5EEAD4', type: 'income' },
    { id: 'investments', name: 'Investments', icon: 'trend', color: '#818CF8', type: 'income' },
    { id: 'gifts', name: 'Gifts', icon: 'gift', color: '#F472B6', type: 'income' },
    { id: 'other-income', name: 'Other income', icon: 'dots', color: '#94A3B8', type: 'income' },
  ];
  const CURRENCIES = ['USD', 'EUR', 'GBP', 'XAF', 'XOF', 'NGN', 'GHS', 'KES', 'ZAR', 'EGP', 'MAD', 'CAD', 'AUD', 'NZD', 'JPY', 'CNY', 'INR', 'KRW', 'SGD', 'HKD', 'AED', 'SAR', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'TRY', 'BRL', 'MXN'];
  const REGION_CURRENCY = { US: 'USD', GB: 'GBP', CM: 'XAF', GA: 'XAF', TD: 'XAF', CF: 'XAF', CG: 'XAF', GQ: 'XAF', SN: 'XOF', CI: 'XOF', BJ: 'XOF', BF: 'XOF', ML: 'XOF', TG: 'XOF', NE: 'XOF', NG: 'NGN', GH: 'GHS', KE: 'KES', ZA: 'ZAR', EG: 'EGP', MA: 'MAD', CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY', CN: 'CNY', IN: 'INR', KR: 'KRW', SG: 'SGD', HK: 'HKD', AE: 'AED', SA: 'SAR', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', TR: 'TRY', BR: 'BRL', MX: 'MXN', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', PT: 'EUR', IE: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR' };
  // Rough scale so demo data feels realistic in any currency.
  const DEMO_SCALE = { JPY: 150, XAF: 600, XOF: 600, NGN: 1500, GHS: 15, KES: 130, ZAR: 18, EGP: 48, MAD: 10, INR: 85, KRW: 1400, CNY: 7, HKD: 8, AED: 4, SAR: 4, SEK: 10, NOK: 10, DKK: 7, PLN: 4, TRY: 40, BRL: 5, MXN: 18 };

  const locale = () => navigator.language || 'en-US';
  const isCurrency = (c) => { try { new Intl.NumberFormat('en', { style: 'currency', currency: c }); return /^[A-Z]{3}$/.test(c); } catch { return false; } };
  function guessCurrency() {
    try {
      const region = new Intl.Locale(locale()).maximize().region;
      return REGION_CURRENCY[region] || 'USD';
    } catch { return 'USD'; }
  }

  /* =========================================================
     Store
     ========================================================= */
  function defaults() {
    return {
      v: 1,
      settings: { currency: guessCurrency(), theme: 'system', lastCat: {} },
      categories: DEFAULT_CATS.map((c) => ({ ...c })),
      txns: [],
      budgets: { total: null, byCat: {} },
      recurring: [],
    };
  }

  const validColor = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  const validCents = (n) => Number.isInteger(n) && n > 0 && n <= MAX_CENTS;

  function cleanTxn(t, catMap) {
    if (!t || typeof t !== 'object') return null;
    const type = t.type === 'income' ? 'income' : 'expense';
    const amount = Math.round(Number(t.amount));
    if (!validCents(amount) || !isValidYmd(t.date)) return null;
    let cat = catMap.get(t.categoryId);
    if (!cat || cat.type !== type) cat = catMap.get(FALLBACK[type]);
    const out = {
      id: typeof t.id === 'string' && t.id ? t.id.slice(0, 80) : uid(),
      type, amount, categoryId: cat.id,
      note: typeof t.note === 'string' ? t.note.slice(0, NOTE_MAX) : '',
      date: t.date,
      createdAt: Number.isFinite(t.createdAt) ? t.createdAt : Date.now(),
    };
    if (typeof t.recurringId === 'string') out.recurringId = t.recurringId;
    return out;
  }

  /** Validate and normalise anything that claims to be Orbit data (storage or imports). */
  function sanitize(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Not an Orbit backup');
    const out = defaults();
    const s = d.settings || {};
    if (typeof s.currency === 'string' && isCurrency(s.currency.toUpperCase())) out.settings.currency = s.currency.toUpperCase();
    if (['system', 'dark', 'light'].includes(s.theme)) out.settings.theme = s.theme;
    if (s.lastCat && typeof s.lastCat === 'object') out.settings.lastCat = { expense: String(s.lastCat.expense || ''), income: String(s.lastCat.income || '') };

    if (Array.isArray(d.categories)) {
      const seen = new Set();
      const cats = [];
      for (const c of d.categories) {
        if (!c || typeof c.id !== 'string' || !c.id || seen.has(c.id)) continue;
        seen.add(c.id);
        cats.push({
          id: c.id.slice(0, 80),
          name: String(c.name || 'Untitled').trim().slice(0, 24) || 'Untitled',
          icon: ICONS.includes(c.icon) ? c.icon : 'dots',
          color: validColor(c.color) ? c.color : '#94A3B8',
          type: c.type === 'income' ? 'income' : 'expense',
        });
      }
      for (const fb of Object.values(FALLBACK)) {
        const i = cats.findIndex((c) => c.id === fb);
        const def = DEFAULT_CATS.find((x) => x.id === fb);
        if (i === -1) cats.push({ ...def });
        else cats[i].type = def.type; // fallbacks must keep their type
      }
      out.categories = cats;
    }
    const catMap = new Map(out.categories.map((c) => [c.id, c]));

    if (Array.isArray(d.txns)) {
      const ids = new Set();
      for (const raw of d.txns) {
        const t = cleanTxn(raw, catMap);
        if (!t) continue;
        if (ids.has(t.id)) t.id = uid();
        ids.add(t.id);
        out.txns.push(t);
      }
    }

    const b = d.budgets || {};
    const total = Math.round(Number(b.total));
    out.budgets.total = validCents(total) ? total : null;
    if (b.byCat && typeof b.byCat === 'object') {
      for (const [k, v] of Object.entries(b.byCat)) {
        const c = catMap.get(k);
        const n = Math.round(Number(v));
        if (c && c.type === 'expense' && validCents(n)) out.budgets.byCat[k] = n;
      }
    }

    if (Array.isArray(d.recurring)) {
      for (const r of d.recurring) {
        if (!r || typeof r !== 'object') continue;
        const amount = Math.round(Number(r.amount));
        const type = r.type === 'income' ? 'income' : 'expense';
        if (!validCents(amount) || !isValidYmd(r.start) || !isValidYmd(r.next) || !['weekly', 'monthly', 'yearly'].includes(r.freq)) continue;
        let cat = catMap.get(r.categoryId);
        if (!cat || cat.type !== type) cat = catMap.get(FALLBACK[type]);
        out.recurring.push({
          id: typeof r.id === 'string' && r.id ? r.id : uid(),
          type, amount, categoryId: cat.id, freq: r.freq,
          note: typeof r.note === 'string' ? r.note.slice(0, NOTE_MAX) : '',
          start: r.start, next: r.next,
          day: clamp(Math.round(Number(r.day)) || parseYmd(r.start).getDate(), 1, 31),
          active: r.active !== false,
        });
      }
    }
    return out;
  }

  let storageBroken = false;
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch { storageBroken = true; return defaults(); }
    if (!raw) return defaults();
    try {
      return sanitize(JSON.parse(raw));
    } catch {
      try { localStorage.setItem(`${STORE_KEY}.corrupt.${Date.now()}`, raw); } catch { /* full */ }
      queueMicrotask(() => toast('Saved data was unreadable. A copy was kept and Orbit started fresh.', { error: true, timeout: 7000 }));
      return defaults();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(S));
      return true;
    } catch (e) {
      toast(storageBroken ? 'Storage is unavailable (private mode?). Changes will not persist.' : 'Could not save — device storage is full.', { error: true, timeout: 6000 });
      return false;
    }
  }

  let S = load();

  /* =========================================================
     Money
     ========================================================= */
  let fmtCache = {};
  const currencyDigits = () => {
    try { return new Intl.NumberFormat('en', { style: 'currency', currency: S.settings.currency }).resolvedOptions().maximumFractionDigits; } catch { return 2; }
  };
  function formatter(compact) {
    const key = compact ? 'c' : 's';
    if (!fmtCache[key]) {
      const opts = { style: 'currency', currency: S.settings.currency };
      if (compact) Object.assign(opts, { notation: 'compact', maximumFractionDigits: 1 });
      try { fmtCache[key] = new Intl.NumberFormat(locale(), opts); } catch { fmtCache[key] = new Intl.NumberFormat('en-US', opts); }
    }
    return fmtCache[key];
  }
  function money(cents, { sign = false, compact = false } = {}) {
    const s = formatter(compact).format(Math.abs(cents) / 100);
    if (sign && cents !== 0) return (cents < 0 ? '−' : '+') + s;
    return cents < 0 ? '−' + s : s;
  }
  const currencySymbol = () => {
    try {
      return formatter(false).formatToParts(0).find((p) => p.type === 'currency')?.value || S.settings.currency;
    } catch { return S.settings.currency; }
  };
  const centsToInput = (cents) => {
    const d = Math.min(currencyDigits(), 2);
    return (cents / 100).toFixed(d).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
  };

  /**
   * Parse an amount, allowing simple arithmetic: "12.50 + 8", "3*4.99", "(20-5)/2".
   * Returns { cents, isExpr } or { error }.
   */
  function parseAmount(raw) {
    let s = String(raw ?? '').trim().replace(/\s+/g, '').replace(/[×xX]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-');
    if (!s) return { error: 'Enter an amount' };
    s = s.includes(',') && s.includes('.') ? s.replace(/,/g, '') : s.replace(/,/g, '.');
    if (!/^[\d.+\-*/()]+$/.test(s)) return { error: 'Use numbers only — simple math like 12+8 works too' };
    let i = 0;
    const fail = () => { throw new Error('syntax'); };
    const number = () => {
      const m = /^\d*\.?\d*/.exec(s.slice(i))[0];
      if (!m || m === '.') fail();
      i += m.length;
      return parseFloat(m);
    };
    const factor = () => {
      if (s[i] === '-') { i++; return -factor(); }
      if (s[i] === '+') { i++; return factor(); }
      if (s[i] === '(') { i++; const v = expr(); if (s[i] !== ')') fail(); i++; return v; }
      return number();
    };
    const term = () => {
      let v = factor();
      while (s[i] === '*' || s[i] === '/') { const op = s[i++]; const r = factor(); v = op === '*' ? v * r : v / r; }
      return v;
    };
    const expr = () => {
      let v = term();
      while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const r = term(); v = op === '+' ? v + r : v - r; }
      return v;
    };
    let v;
    try { v = expr(); if (i !== s.length) fail(); } catch { return { error: "That doesn't look like a valid amount" }; }
    if (!Number.isFinite(v)) return { error: "That calculation doesn't work" };
    const d = Math.min(currencyDigits(), 2);
    const units = Math.round(Number((v * 10 ** d).toPrecision(15)));
    const cents = units * 10 ** (2 - d);
    if (cents <= 0) return { error: 'Amount must be greater than zero' };
    if (cents > MAX_CENTS) return { error: 'That amount is too large' };
    return { cents, isExpr: /[+\-*/()]/.test(s.replace(/^\+/, '')) };
  }

  /* =========================================================
     Selectors
     ========================================================= */
  const catById = (id) => S.categories.find((c) => c.id === id) || S.categories.find((c) => c.id === FALLBACK.expense);
  const catsOf = (type) => S.categories.filter((c) => c.type === type);
  const sortTx = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt);
  const txInMonth = (mk) => S.txns.filter((t) => t.date.startsWith(mk + '-'));
  function totals(list) {
    let inc = 0, exp = 0;
    for (const t of list) t.type === 'income' ? (inc += t.amount) : (exp += t.amount);
    return { inc, exp, net: inc - exp };
  }
  function byCategory(list, type = 'expense') {
    const m = new Map();
    for (const t of list) if (t.type === type) m.set(t.categoryId, (m.get(t.categoryId) || 0) + t.amount);
    return [...m.entries()].map(([id, sum]) => ({ cat: catById(id), sum })).sort((a, b) => b.sum - a.sum);
  }
  function dailyExpense(mk) {
    const [y, m] = mkParts(mk);
    const arr = new Array(daysInMonth(y, m)).fill(0);
    for (const t of txInMonth(mk)) if (t.type === 'expense') arr[Number(t.date.slice(8)) - 1] += t.amount;
    return arr;
  }
  /** Days of the month that have "elapsed" (for averages / pacing). */
  function elapsedDays(mk) {
    const [y, m] = mkParts(mk);
    const cm = curMonth();
    if (mk < cm) return daysInMonth(y, m);
    if (mk > cm) return 0;
    return new Date().getDate();
  }

  /* =========================================================
     Recurring engine
     ========================================================= */
  function nextOccurrence(rule, from) {
    const d = parseYmd(from);
    if (rule.freq === 'weekly') { d.setDate(d.getDate() + 7); return ymd(d); }
    let y = d.getFullYear(), m = d.getMonth() + 1;
    if (rule.freq === 'monthly') { m += 1; if (m > 12) { m = 1; y += 1; } }
    else { y += 1; m = parseYmd(rule.start).getMonth() + 1; }
    return `${y}-${pad(m)}-${pad(Math.min(rule.day, daysInMonth(y, m)))}`;
  }
  /** Materialise any due occurrences up to today. Returns number of transactions created. */
  function runRecurring() {
    const t = today();
    let added = 0;
    for (const r of S.recurring) {
      if (!r.active) continue;
      let guard = 0;
      while (r.next <= t && guard++ < 520) {
        S.txns.push({ id: uid(), type: r.type, amount: r.amount, categoryId: r.categoryId, note: r.note, date: r.next, createdAt: Date.now() + added, recurringId: r.id });
        added++;
        r.next = nextOccurrence(r, r.next);
      }
    }
    if (added) save();
    return added;
  }
  const freqLabel = (f) => ({ weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' }[f] || f);

  /* =========================================================
     Formatting helpers
     ========================================================= */
  const dtf = (opts) => new Intl.DateTimeFormat(locale(), opts);
  const monthName = (mk, style = 'long') => { const [y, m] = mkParts(mk); return dtf({ month: style, year: 'numeric' }).format(new Date(y, m - 1, 1)); };
  const monthOnly = (mk) => { const [y, m] = mkParts(mk); return dtf({ month: 'long' }).format(new Date(y, m - 1, 1)); };
  function dayLabel(s, { relative = true } = {}) {
    const t = today();
    if (relative && s === t) return 'Today';
    if (relative && s === addDays(t, -1)) return 'Yesterday';
    if (relative && s === addDays(t, 1)) return 'Tomorrow';
    const d = parseYmd(s);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return dtf({ weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) }).format(d);
  }
  const shortDate = (s) => { const d = parseYmd(s); return dtf({ month: 'short', day: 'numeric' }).format(d); };
  const pct = (n) => `${Math.round(n * 100)}%`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  /* =========================================================
     UI state
     ========================================================= */
  const ui = {
    route: 'home',
    month: curMonth(),
    q: '',
    type: 'all',
    cat: 'all',
    allTime: false,
    selDay: null,
    lastDay: today(),
  };

  const ROUTES = {
    home: { title: 'Overview', month: true, view: viewHome },
    activity: { title: 'Activity', month: true, view: viewActivity },
    insights: { title: 'Insights', month: true, view: viewInsights },
    budgets: { title: 'Budgets', month: true, view: viewBudgets },
    settings: { title: 'Settings', month: false, view: viewSettings },
  };

  const view = $('#view');

  function greeting() {
    const h = new Date().getHours();
    return h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  }

  function render() {
    const r = ROUTES[ui.route];
    $('#title').textContent = r.title;
    $('#eyebrow').textContent = ui.route === 'home'
      ? (innerWidth < 640 ? greeting() : `${greeting()} · ${dtf({ weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}`)
      : { activity: 'Every transaction, searchable', insights: 'Patterns in your money', budgets: 'Limits that keep you on track', settings: 'Preferences & your data' }[ui.route];
    document.title = `${r.title} · Orbit`;

    const ms = $('#monthSwitch');
    ms.hidden = !r.month || (ui.route === 'activity' && ui.allTime);
    const ml = $('#monthLabel');
    ml.textContent = monthName(ui.month, 'short');
    ml.setAttribute('aria-label', `${monthName(ui.month)}${ui.month === curMonth() ? ' (current month)' : ' — jump to current month'}`);

    for (const a of $$('.nav-item')) {
      if (a.dataset.route === ui.route) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    }
    view.innerHTML = r.view();
    view.style.animation = 'none';
    void view.offsetWidth; // restart entrance animation
    view.style.animation = '';
    afterRender[ui.route]?.();
  }

  const afterRender = {
    activity() { renderActivityList(); },
    home() { fitHeroStats(); },
  };

  /** Show full figures when they fit; fall back to compact notation (e.g. $4.2K) when they'd be clipped. */
  function fitHeroStats() {
    for (const el of $$('.hero-stats .v[data-full]')) {
      el.textContent = el.dataset.full;
      if (el.scrollWidth > el.clientWidth + 1) el.textContent = el.dataset.compact;
    }
  }
  document.fonts?.ready.then(() => { if (ui.route === 'home') fitHeroStats(); }); // re-measure once web fonts swap in
  let fitTimer;
  window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(() => { if (ui.route === 'home') fitHeroStats(); }, 120); });

  /* =========================================================
     Shared fragments
     ========================================================= */
  const badge = (cat, cls = '') => `<span class="badge ${cls}" style="--c:${cat.color}">${icon('c-' + cat.icon)}</span>`;

  function txItem(t, { showDate = false } = {}) {
    const c = catById(t.categoryId);
    const title = t.note || c.name;
    const sub = [t.note ? c.name : null, showDate ? dayLabel(t.date) : null].filter(Boolean).join(' · ');
    const amt = t.type === 'income' ? money(t.amount, { sign: true }) : money(-t.amount);
    return `<li><button class="tx" type="button" data-action="edit-tx" data-id="${esc(t.id)}" aria-label="${esc(`${title}, ${t.type === 'income' ? 'income' : 'expense'} ${money(t.amount)}, ${dayLabel(t.date)}. Edit`)}">
      ${badge(c)}
      <span class="tx-body"><span class="tx-title">${esc(title)}</span>
      <span class="tx-sub">${t.recurringId ? icon('i-repeat') : ''}${esc(sub || (t.recurringId ? 'Recurring' : c.name))}</span></span>
      <span class="tx-amt num ${t.type}">${amt}</span>
    </button></li>`;
  }

  function emptyState({ ic = 'i-sparkle', title, body, actions = '' }) {
    return `<div class="empty"><div class="orb">${icon(ic)}</div><h3>${title}</h3><p>${body}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
  }

  function progressClass(ratio) { return ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : ''; }

  /* =========================================================
     View: Home
     ========================================================= */
  function welcomeView() {
    const feats = [
      ['i-sparkle', 'Log in seconds', 'Quick-add chips, smart categories, and an amount field that does the math.'],
      ['i-target', 'Budgets that pace you', 'See what you can spend per day and get nudged before you overshoot.'],
      ['c-wallet', 'Private & offline', 'No account, no cloud. Everything stays on this device and works without signal.'],
    ];
    return `<div class="welcome">
      <section class="card hero welcome-hero">
        <div class="welcome-orb" aria-hidden="true"><img src="icons/icon.svg" alt="" width="72" height="72"></div>
        <h2 class="welcome-title">Your money, <span class="grad-text">in orbit.</span></h2>
        <p class="welcome-sub">A calm, fast way to see where every coin goes — budgets, insights and recurring bills in one place.</p>
        <div class="welcome-actions">
          <button class="btn btn-primary" data-action="add">${icon('i-plus')}Add first transaction</button>
          <button class="btn" data-action="demo">Explore with demo data</button>
        </div>
      </section>
      <div class="feature-grid">${feats.map(([ic, t, b]) => `<section class="card feature"><span class="badge badge-sm" style="--c:var(--accent)">${icon(ic)}</span><div><h3>${t}</h3><p>${b}</p></div></section>`).join('')}</div>
      <p class="about">Tip: install Orbit from Settings to use it like a native app.</p>
    </div>`;
  }

  /** Most-used categories over the last 60 days (falls back to defaults) for one-tap entry. */
  function quickCats() {
    const since = addDays(today(), -60);
    const freq = new Map();
    for (const t of S.txns) if (t.date >= since) freq.set(t.categoryId, (freq.get(t.categoryId) || 0) + 1);
    const ranked = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => S.categories.find((c) => c.id === id)).filter(Boolean);
    for (const c of catsOf('expense')) if (ranked.length < 5 && !ranked.includes(c)) ranked.push(c);
    return ranked.slice(0, 5);
  }

  function viewHome() {
    if (!S.txns.length) return welcomeView();
    const mk = ui.month;
    const list = txInMonth(mk).sort(sortTx);
    const { inc, exp, net } = totals(list);
    const isCur = mk === curMonth();
    const budget = S.budgets.total;
    const [y, m] = mkParts(mk);
    const dim = daysInMonth(y, m);

    // Hero: budget progress + key numbers
    let budgetHtml = '';
    let thirdStat;
    if (budget) {
      const ratio = exp / budget;
      const left = budget - exp;
      const daysLeft = isCur ? dim - new Date().getDate() + 1 : 0;
      budgetHtml = `
        <div class="progress ${progressClass(ratio)}" role="progressbar" aria-label="Monthly budget used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(clamp(ratio, 0, 1) * 100)}"><span style="width:${clamp(ratio, 0, 1) * 100}%"></span></div>
        <div class="hero-meta"><span>${left >= 0 ? `<strong class="num">${money(left)}</strong> left of ${money(budget)}` : `<strong class="num neg">${money(-left)}</strong> over your ${money(budget)} budget`}</span><span>${pct(ratio)} used</span></div>`;
      thirdStat = isCur && daysLeft > 0
        ? { k: 'Per day left', c: left > 0 ? Math.floor(left / daysLeft) : 0, v: money(left > 0 ? Math.floor(left / daysLeft) : 0), cls: left > 0 ? '' : 'neg', ic: 'i-target', tone: 'avg' }
        : left >= 0 ? { k: 'Budget left', c: left, v: money(left), cls: 'pos', ic: 'i-target', tone: 'avg' } : { k: 'Over budget', c: -left, v: money(-left), cls: 'neg', ic: 'i-alert', tone: 'out' };
    } else {
      const el = elapsedDays(mk);
      budgetHtml = `<a class="hero-cta" href="#/budgets">${icon('i-target', 'i i-sm')}<span>Set a monthly budget to get a daily allowance</span>${icon('i-right', 'i i-sm')}</a>`;
      thirdStat = { k: 'Daily avg', c: el ? Math.round(exp / el) : undefined, v: el ? money(Math.round(exp / el)) : '—', cls: '', ic: 'i-chart', tone: 'avg' };
    }
    const stats = [
      { k: 'Income', c: inc, v: money(inc), cls: inc ? 'pos' : '', ic: 'i-down', tone: 'in' },
      { k: 'Net', c: net, sign: true, v: money(net, { sign: true }), cls: net < 0 ? 'neg' : net > 0 ? 'pos' : '', ic: 'c-wallet', tone: 'net' },
      thirdStat,
    ];
    for (const st of stats) if (st.c !== undefined) st.compact = money(st.c, { compact: true, sign: st.sign });
    const hero = `<section class="card hero home-hero" aria-label="Monthly summary">
      <p class="hero-label">Spent in ${esc(monthOnly(mk))}${isCur ? ' so far' : ''}</p>
      <p class="hero-amount num">${money(exp)}</p>
      <p class="hero-sub">${plural(list.filter((t) => t.type === 'expense').length, 'expense')} · ${plural(list.filter((t) => t.type === 'income').length, 'deposit')}</p>
      ${budgetHtml}
      <div class="hero-stats">${stats.map((st) => `<div><p class="k"><span class="dot-ic ${st.tone}">${icon(st.ic)}</span>${st.k}</p><p class="v num ${st.cls}" title="${esc(st.v)}" data-full="${esc(st.v)}" data-compact="${esc(st.compact || st.v)}">${st.v}</p></div>`).join('')}</div>
    </section>`;

    // Quick add
    const quick = `<section class="quick" aria-label="Quick add">
      ${quickCats().map((c) => `<button class="quick-chip" type="button" data-action="quick-add" data-cat="${esc(c.id)}" aria-label="Add ${esc(c.name)} ${c.type}">${badge(c, 'badge-sm')}<span>${esc(c.name)}</span></button>`).join('')}
    </section>`;

    // Budget alerts, condensed into one card
    const spentBy = new Map(byCategory(list).map((x) => [x.cat.id, x.sum]));
    const alertRows = Object.entries(S.budgets.byCat)
      .map(([id, lim]) => ({ cat: catById(id), lim, spent: spentBy.get(id) || 0 }))
      .filter((a) => a.spent / a.lim >= 0.8)
      .sort((a, b) => b.spent / b.lim - a.spent / a.lim);
    const alerts = alertRows.length ? `<section class="card heads-up" aria-label="Budget alerts">
      <div class="card-head"><h2>${icon('i-alert', 'i i-sm')}Heads up</h2><a class="link" href="#/budgets">Budgets</a></div>
      ${alertRows.slice(0, 3).map((a) => {
        const r = a.spent / a.lim;
        const over = a.spent > a.lim;
        return `<div class="hu-row">${badge(a.cat, 'badge-sm')}<div class="hu-body"><div class="row"><span class="nm">${esc(a.cat.name)}</span>
          <span class="tag ${over ? 'over' : 'warn'}">${over ? `${money(a.spent - a.lim)} over` : `${pct(r)} used`}</span></div>
          <div class="progress ${progressClass(r)}"><span style="width:${clamp(r, 0, 1) * 100}%"></span></div></div></div>`;
      }).join('')}
      ${alertRows.length > 3 ? `<p class="faint small" style="margin-top:8px">+${alertRows.length - 3} more near their limit</p>` : ''}
    </section>` : '';

    // Recent
    const recentList = list.slice(0, 5);
    const recent = `<section class="card list-card">
      <div class="card-head"><h2>Recent</h2>${list.length > recentList.length ? `<a class="link" href="#/activity">See all ${list.length}</a>` : ''}</div>
      ${recentList.length ? `<ul class="tx-list">${recentList.map((t) => txItem(t, { showDate: true })).join('')}</ul>`
        : emptyState({ ic: 'i-list', title: `Nothing in ${esc(monthOnly(mk))}`, body: 'Transactions you add for this month will show up here.', actions: `<button class="btn btn-sm" data-action="add">${icon('i-plus', 'i i-sm')}Add transaction</button>` })}
    </section>`;

    // Seven-day sparkline (ending today, or the end of the selected month)
    const endDay = isCur ? today() : `${mk}-${pad(dim)}`;
    const days = Array.from({ length: 7 }, (_, i) => addDays(endDay, i - 6));
    const daySums = days.map((d) => S.txns.reduce((acc, t) => (t.date === d && t.type === 'expense' ? acc + t.amount : acc), 0));
    const maxDay = Math.max(...daySums, 1);
    const weekTotal = daySums.reduce((a, b) => a + b, 0);
    const week = `<section class="card">
      <div class="card-head"><h2>Last 7 days</h2><span class="num muted small">${money(weekTotal)} · ${money(Math.round(weekTotal / 7))}/day</span></div>
      <div class="spark" role="img" aria-label="Spending over the last 7 days, total ${esc(money(weekTotal))}">${days.map((d, i) => `
        <div class="spark-col" title="${esc(dayLabel(d))}: ${money(daySums[i])}">
          <div class="spark-bar ${daySums[i] ? 'has' : ''} ${d === today() ? 'today' : ''}" style="height:${Math.max(4, (daySums[i] / maxDay) * 100)}%;animation-delay:${i * 40}ms"></div>
          <span class="spark-lbl">${esc(dtf({ weekday: 'narrow' }).format(parseYmd(d)))}</span>
        </div>`).join('')}</div>
    </section>`;

    // Top categories with a segmented share bar
    const cats = byCategory(list);
    const top = cats.slice(0, 4);
    const restSum = cats.slice(4).reduce((a, x) => a + x.sum, 0);
    const topCard = cats.length ? `<section class="card">
      <div class="card-head"><h2>Top categories</h2><a class="link" href="#/insights">Insights</a></div>
      <div class="share-bar" role="img" aria-label="${esc('Share of spending: ' + top.map((x) => `${x.cat.name} ${pct(x.sum / exp)}`).join(', '))}">
        ${top.map((x) => `<span style="flex:${x.sum};background:${x.cat.color}"></span>`).join('')}${restSum ? `<span style="flex:${restSum};background:#64748B"></span>` : ''}
      </div>
      <ul class="top-cats">${top.map((x) => `<li>${badge(x.cat, 'badge-sm')}<span class="nm">${esc(x.cat.name)}</span><span class="pc">${pct(x.sum / exp)}</span><span class="num amt">${money(x.sum)}</span></li>`).join('')}</ul>
    </section>` : '';

    return `<div class="home">
      <div class="home-col">${hero}${quick}${alerts ? `<div class="o-alerts">${alerts}</div>` : ''}<div class="o-week">${week}</div></div>
      <div class="home-col"><div class="o-recent">${recent}</div>${topCard ? `<div class="o-cats">${topCard}</div>` : ''}</div>
    </div>`;
  }

  /* =========================================================
     View: Activity
     ========================================================= */
  function viewActivity() {
    const cats = S.categories.filter((c) => ui.type === 'all' || c.type === ui.type);
    if (ui.cat !== 'all' && !cats.some((c) => c.id === ui.cat)) ui.cat = 'all';
    return `
      <div class="filters">
        <div class="search">
          ${icon('i-search')}
          <label class="sr-only" for="q">Search transactions</label>
          <input class="input" id="q" type="search" placeholder="Search notes, categories, amounts…" value="${esc(ui.q)}" autocomplete="off" enterkeyhint="search">
          <button class="clear" type="button" data-action="clear-search" aria-label="Clear search" ${ui.q ? '' : 'hidden'}>${icon('i-x', 'i i-sm')}</button>
        </div>
        <div class="chips" role="group" aria-label="Filter">
          ${['all', 'expense', 'income'].map((t) => `<button class="chip" type="button" data-action="filter-type" data-type="${t}" aria-pressed="${ui.type === t}">${{ all: 'All', expense: 'Expenses', income: 'Income' }[t]}</button>`).join('')}
          <button class="chip" type="button" data-action="toggle-alltime" aria-pressed="${ui.allTime}">All time</button>
        </div>
        <label class="sr-only" for="catFilter">Category</label>
        <select class="select" id="catFilter">
          <option value="all">All categories</option>
          ${cats.map((c) => `<option value="${esc(c.id)}" ${ui.cat === c.id ? 'selected' : ''}>${esc(c.name)}${ui.type === 'all' ? (c.type === 'income' ? ' (income)' : '') : ''}</option>`).join('')}
        </select>
      </div>
      <section class="card list-card" id="txResults" aria-live="polite"></section>`;
  }

  function filteredTx() {
    let list = ui.allTime ? S.txns.slice() : txInMonth(ui.month);
    if (ui.type !== 'all') list = list.filter((t) => t.type === ui.type);
    if (ui.cat !== 'all') list = list.filter((t) => t.categoryId === ui.cat);
    const q = ui.q.trim().toLowerCase();
    if (q) {
      const terms = q.split(/\s+/);
      list = list.filter((t) => {
        const c = catById(t.categoryId);
        const hay = `${t.note} ${c.name} ${(t.amount / 100).toFixed(2)} ${money(t.amount)} ${t.date} ${dayLabel(t.date, { relative: false })}`.toLowerCase();
        return terms.every((term) => hay.includes(term));
      });
    }
    return list.sort(sortTx);
  }

  function renderActivityList() {
    const box = $('#txResults');
    if (!box) return;
    const list = filteredTx();
    const { inc, exp } = totals(list);
    if (!list.length) {
      const filtered = ui.q || ui.type !== 'all' || ui.cat !== 'all';
      box.innerHTML = filtered
        ? emptyState({ ic: 'i-search', title: 'No matches', body: 'Try a different search or clear your filters.', actions: `<button class="btn btn-sm" data-action="reset-filters">Clear filters</button>` })
        : emptyState({ ic: 'i-list', title: ui.allTime ? 'No transactions yet' : `Nothing in ${esc(monthName(ui.month))}`, body: 'Add an expense or income and it will appear here.', actions: `<button class="btn btn-sm btn-primary" data-action="add">${icon('i-plus', 'i i-sm')}Add transaction</button>` });
      return;
    }
    const LIMIT = 400;
    const shown = list.slice(0, LIMIT);
    const groups = new Map();
    for (const t of shown) { if (!groups.has(t.date)) groups.set(t.date, []); groups.get(t.date).push(t); }
    box.innerHTML = `
      <div class="summary-bar"><span>${plural(list.length, 'transaction')}</span><span>In <strong class="pos">${money(inc)}</strong></span><span>Out <strong class="neg">${money(exp)}</strong></span></div>
      ${[...groups.entries()].map(([d, items]) => {
        const net = totals(items).net;
        return `<div class="tx-group"><div class="tx-day"><span>${esc(dayLabel(d))}</span><span class="num">${money(net, { sign: true })}</span></div><ul class="tx-list">${items.map((t) => txItem(t)).join('')}</ul></div>`;
      }).join('')}
      ${list.length > LIMIT ? `<p class="faint small" style="text-align:center;padding:14px">Showing the latest ${LIMIT} of ${list.length}. Narrow your search to see more.</p>` : ''}`;
  }

  /* =========================================================
     View: Insights
     ========================================================= */
  function viewInsights() {
    const mk = ui.month;
    const list = txInMonth(mk);
    const { inc, exp, net } = totals(list);
    if (!list.length) {
      return `<section class="card">${emptyState({ ic: 'i-chart', title: `No data for ${esc(monthName(mk))}`, body: 'Insights appear once you add transactions for this month.', actions: `<button class="btn btn-primary" data-action="add">${icon('i-plus')}Add transaction</button>` })}</section>${trendCard()}`;
    }
    const isCur = mk === curMonth();
    const prevMk = addMonths(mk, -1);
    const elapsed = elapsedDays(mk);
    const [y, m] = mkParts(mk);
    const dim = daysInMonth(y, m);
    // Compare like-for-like: for the current month, last month up to the same day.
    const cutoff = isCur ? new Date().getDate() : 31;
    const prevExp = txInMonth(prevMk).filter((t) => t.type === 'expense' && Number(t.date.slice(8)) <= cutoff).reduce((s, t) => s + t.amount, 0);
    const delta = prevExp ? (exp - prevExp) / prevExp : null;
    const avg = elapsed ? Math.round(exp / elapsed) : 0;

    const deltaHtml = delta === null ? `<p class="stat-delta faint">${isCur ? 'Nothing by this day last month' : 'No data last month'}</p>`
      : `<p class="stat-delta ${delta > 0 ? 'neg' : 'pos'}">${delta > 0 ? '▲' : '▼'} ${pct(Math.abs(delta))} vs ${isCur ? 'same point last month' : esc(monthOnly(prevMk))}</p>`;

    const cats = byCategory(list);
    return `
      <div class="grid-2">
        <section class="card stat"><div class="stat-top"><span class="dot-ic out">${icon('i-up')}</span>Spent</div><p class="stat-value num">${money(exp)}</p>${deltaHtml}</section>
        <section class="card stat"><div class="stat-top"><span class="dot-ic in">${icon('i-down')}</span>Income</div><p class="stat-value num">${money(inc)}</p><p class="stat-delta faint">${plural(list.filter((t) => t.type === 'income').length, 'deposit')}</p></section>
        <section class="card stat"><div class="stat-top"><span class="dot-ic net">${icon('c-wallet')}</span>Net</div><p class="stat-value num ${net < 0 ? 'neg' : net > 0 ? 'pos' : ''}">${money(net, { sign: true })}</p><p class="stat-delta faint">${inc ? `${pct(Math.max(net, 0) / inc)} saved` : 'No income logged'}</p></section>
        <section class="card stat"><div class="stat-top"><span class="dot-ic avg">${icon('i-chart')}</span>Daily avg</div><p class="stat-value num">${elapsed ? money(avg) : '—'}</p><p class="stat-delta faint">${elapsed ? `over ${plural(elapsed, 'day')}` : 'Month not started'}</p></section>
      </div>
      <div class="cols" style="margin-top:14px">
        <div class="stack">
          ${smartInsights({ mk, list, exp, inc, net, delta, isCur, elapsed, dim, cats })}
          ${cats.length ? donutCard(cats, exp) : ''}
          ${dailyCard(mk, avg)}
        </div>
        <div class="stack">
          ${cats.length ? rankCard(cats) : ''}
          ${trendCard()}
          ${topCard(list)}
        </div>
      </div>`;
  }

  function smartInsights({ list, exp, inc, net, delta, isCur, elapsed, dim, cats }) {
    const items = [];
    const add = (ic, color, html) => items.push(`<div class="insight"><span class="badge" style="--c:${color}">${icon(ic)}</span><p>${html}</p></div>`);
    if (cats[0] && exp) add('c-' + cats[0].cat.icon, cats[0].cat.color, `<strong>${esc(cats[0].cat.name)}</strong> is your top category at <strong>${pct(cats[0].sum / exp)}</strong> of spending (${money(cats[0].sum)}).`);
    if (delta !== null && Math.abs(delta) >= 0.01) {
      add(delta > 0 ? 'i-up' : 'i-down', delta > 0 ? '#FB7185' : '#34D399', `You've spent <strong>${pct(Math.abs(delta))} ${delta > 0 ? 'more' : 'less'}</strong> than ${isCur ? 'at this point last month' : 'the month before'}.`);
    }
    if (isCur && elapsed >= 3 && exp > 0 && elapsed < dim) {
      const projected = Math.round((exp / elapsed) * dim);
      const b = S.budgets.total;
      const tail = b ? (projected > b ? ` — about <strong class="neg">${money(projected - b)} over</strong> your budget.` : ` — <strong class="pos">${money(b - projected)} under</strong> budget.`) : '.';
      add('i-sparkle', '#818CF8', `At this pace you'll spend about <strong>${money(projected)}</strong> by month end${tail}`);
    }
    if (inc > 0) {
      const rate = net / inc;
      add('c-wallet', rate >= 0 ? '#34D399' : '#FB7185', rate >= 0 ? `You kept <strong>${pct(rate)}</strong> of your income this month.` : `Spending exceeded income by <strong>${money(-net)}</strong>.`);
    }
    const dayMax = dailyExpense(ui.month).reduce((best, v, i) => (v > best.v ? { v, i } : best), { v: 0, i: -1 });
    if (dayMax.i >= 0 && items.length < 4) {
      add('i-chart', '#5EEAD4', `Your biggest spending day was <strong>${esc(dayLabel(`${ui.month}-${pad(dayMax.i + 1)}`, { relative: false }))}</strong> at ${money(dayMax.v)}.`);
    }
    const recurringMonthly = S.recurring.filter((r) => r.active && r.type === 'expense')
      .reduce((s, r) => s + (r.freq === 'monthly' ? r.amount : r.freq === 'weekly' ? Math.round((r.amount * 52) / 12) : Math.round(r.amount / 12)), 0);
    if (recurringMonthly && items.length < 5) add('i-repeat', '#E879F9', `Recurring costs come to about <strong>${money(recurringMonthly)}</strong> a month.`);
    if (!items.length) return '';
    return `<section class="card"><div class="card-head"><h2>Highlights</h2>${icon('i-sparkle', 'i i-sm')}</div>${items.slice(0, 5).join('')}</section>`;
  }

  function donutCard(cats, total) {
    const top = cats.slice(0, 5);
    const rest = cats.slice(5).reduce((s, x) => s + x.sum, 0);
    const segs = top.map((x) => ({ name: x.cat.name, color: x.cat.color, sum: x.sum }));
    if (rest) segs.push({ name: 'Everything else', color: '#64748B', sum: rest });
    const R = 60, C = 2 * Math.PI * R;
    let off = 0;
    const arcs = segs.map((s) => {
      const len = (s.sum / total) * C;
      const gap = segs.length > 1 && len > 4 ? 2.5 : 0;
      const el = `<circle class="seg" r="${R}" cx="80" cy="80" stroke="${s.color}" stroke-dasharray="${Math.max(len - gap, 0.01)} ${C}" stroke-dashoffset="${-off}"></circle>`;
      off += len;
      return el;
    }).join('');
    const summary = segs.map((s) => `${s.name} ${pct(s.sum / total)}`).join(', ');
    return `<section class="card">
      <div class="card-head"><h2>Where it went</h2></div>
      <div class="donut-wrap">
        <div class="donut" role="img" aria-label="${esc('Spending by category: ' + summary)}">
          <svg viewBox="0 0 160 160"><circle r="${R}" cx="80" cy="80" stroke="var(--surface-2)"></circle>${arcs}</svg>
          <div class="donut-center"><span class="small">Total</span><span class="num">${money(total, { compact: total >= 10_000_000 })}</span></div>
        </div>
        <ul class="legend">${segs.map((s) => `<li><span class="sw" style="background:${s.color}"></span><span class="nm">${esc(s.name)}</span><span class="pc">${pct(s.sum / total)}</span></li>`).join('')}</ul>
      </div>
    </section>`;
  }

  function dailyCard(mk, avg) {
    const arr = dailyExpense(mk);
    const max = Math.max(...arr, 1);
    const isCur = mk === curMonth();
    const todayD = new Date().getDate();
    const bars = arr.map((v, i) => {
      const d = `${mk}-${pad(i + 1)}`;
      const future = isCur && i + 1 > todayD;
      return `<button class="b ${v ? 'has' : ''} ${ui.selDay === d ? 'sel' : ''}" type="button" data-action="bar" data-day="${d}" data-v="${v}" aria-label="${esc(dayLabel(d, { relative: false }))}: ${esc(money(v))}" ${future ? 'tabindex="-1" style="opacity:.35"' : ''}><span style="height:${v ? Math.max(3, (v / max) * 100) : 1.5}%;animation-delay:${i * 12}ms"></span></button>`;
    }).join('');
    const sel = ui.selDay && ui.selDay.startsWith(mk) ? ui.selDay : null;
    const readout = sel ? `<span class="muted small">${esc(dayLabel(sel, { relative: false }))}</span><span class="num">${money(arr[Number(sel.slice(8)) - 1])}</span>`
      : `<span class="muted small">Tap a bar for details</span><span class="num faint" style="font-size:14px">avg ${money(avg)}</span>`;
    return `<section class="card">
      <div class="card-head"><h2>Daily spending</h2><span class="key"><span><i style="border-top:2px dashed var(--warn);height:0;border-radius:0"></i>Avg</span></span></div>
      <div class="bar-readout" id="barReadout">${readout}</div>
      <div class="bars">${avg && max ? `<div class="avg-line" style="bottom:${(avg / max) * (100 - 5)}%"></div>` : ''}${bars}</div>
      <div class="bars-axis"><span>1</span><span>${Math.ceil(arr.length / 2)}</span><span>${arr.length}</span></div>
    </section>`;
  }

  function rankCard(cats) {
    const max = cats[0].sum;
    return `<section class="card"><div class="card-head"><h2>By category</h2></div><ul class="rank">
      ${cats.map((x) => {
        const lim = S.budgets.byCat[x.cat.id];
        return `<li>${badge(x.cat, 'badge-sm')}<div><div class="row"><span class="nm">${esc(x.cat.name)}</span><span class="num">${money(x.sum)}</span></div>
          <div class="progress" style="--c:${x.cat.color}"><span style="width:${(x.sum / max) * 100}%"></span></div>
          ${lim ? `<div class="faint small" style="margin-top:4px">${pct(x.sum / lim)} of ${money(lim)} limit</div>` : ''}</div></li>`;
      }).join('')}</ul></section>`;
  }

  function trendCard() {
    const months = Array.from({ length: 6 }, (_, i) => addMonths(ui.month, i - 5));
    const data = months.map((mk) => ({ mk, ...totals(txInMonth(mk)) }));
    const max = Math.max(...data.flatMap((d) => [d.inc, d.exp]), 1);
    if (data.every((d) => !d.inc && !d.exp)) return '';
    return `<section class="card">
      <div class="card-head"><h2>6-month trend</h2><span class="key"><span><i style="background:var(--income)"></i>In</span><span><i style="background:var(--expense)"></i>Out</span></span></div>
      <div class="trend" role="img" aria-label="${esc('Income and spending by month: ' + data.map((d) => `${monthName(d.mk, 'short')} in ${money(d.inc)}, out ${money(d.exp)}`).join('; '))}">
        ${data.map((d, i) => `<div class="trend-col ${d.mk === ui.month ? 'cur' : ''}" title="${esc(monthName(d.mk))}: in ${esc(money(d.inc))} · out ${esc(money(d.exp))}">
          <div class="trend-pair"><span class="in" style="height:${(d.inc / max) * 100}%;animation-delay:${i * 50}ms"></span><span class="out" style="height:${(d.exp / max) * 100}%;animation-delay:${i * 50 + 25}ms"></span></div>
          <span class="spark-lbl">${esc(dtf({ month: 'short' }).format(new Date(mkParts(d.mk)[0], mkParts(d.mk)[1] - 1, 1)))}</span></div>`).join('')}
      </div></section>`;
  }

  function topCard(list) {
    const top = list.filter((t) => t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5);
    if (!top.length) return '';
    return `<section class="card list-card"><div class="card-head"><h2>Largest expenses</h2></div><ul class="tx-list">${top.map((t) => txItem(t, { showDate: true })).join('')}</ul></section>`;
  }

  /* =========================================================
     View: Budgets
     ========================================================= */
  function ringSvg(ratio, size = 132) {
    const R = 56, C = 2 * Math.PI * R;
    const shown = clamp(ratio, 0, 1);
    const stroke = ratio >= 1 ? 'var(--danger)' : ratio >= 0.8 ? 'var(--warn)' : 'url(#ringGrad)';
    return `<svg viewBox="0 0 132 132" width="${size}" height="${size}" aria-hidden="true">
      <defs><linearGradient id="ringGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5EEAD4"/><stop offset=".55" stop-color="#818CF8"/><stop offset="1" stop-color="#C084FC"/></linearGradient></defs>
      <circle class="track" r="${R}" cx="66" cy="66"></circle>
      <circle class="val" r="${R}" cx="66" cy="66" stroke="${stroke}" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - shown)}" ${shown === 0 ? 'stroke-opacity="0"' : ''}></circle>
    </svg>`;
  }

  function viewBudgets() {
    const mk = ui.month;
    const list = txInMonth(mk);
    const exp = totals(list).exp;
    const b = S.budgets.total;
    const ratio = b ? exp / b : 0;
    const spentBy = new Map(byCategory(list).map((x) => [x.cat.id, x.sum]));

    const hero = b ? `
      <section class="card hero"><div class="budget-hero">
        <div class="ring">${ringSvg(ratio)}<div class="ring-center"><span class="num">${pct(ratio)}</span><span class="small faint">used</span></div></div>
        <div class="info">
          <p class="hero-label">Monthly budget</p>
          <p class="num" style="font-size:28px;font-weight:700;margin:4px 0">${money(b)}</p>
          <p class="muted small">${exp <= b ? `<span class="num">${money(b - exp)}</span> left · ${money(exp)} spent` : `<span class="num neg">${money(exp - b)} over</span> · ${money(exp)} spent`}</p>
          <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn btn-sm" data-action="set-budget">${icon('i-edit', 'i i-sm')}Edit</button></div>
        </div>
      </div></section>`
      : `<section class="card hero">${emptyState({ ic: 'i-target', title: 'Set a monthly budget', body: 'Give yourself a spending limit and Orbit will show how much you can spend each day.', actions: `<button class="btn btn-primary" data-action="set-budget">${icon('i-plus')}Set budget</button>` })}</section>`;

    const rows = catsOf('expense').map((c) => ({ c, lim: S.budgets.byCat[c.id] || 0, spent: spentBy.get(c.id) || 0 }))
      .sort((a, b2) => (b2.lim ? 1 : 0) - (a.lim ? 1 : 0) || (b2.lim && a.lim ? b2.spent / b2.lim - a.spent / a.lim : b2.spent - a.spent));
    const catRows = rows.map(({ c, lim, spent }) => {
      const r = lim ? spent / lim : 0;
      const tag = lim ? (r >= 1 ? `<span class="tag over">${icon('i-alert')}Over</span>` : r >= 0.8 ? `<span class="tag warn">${pct(r)}</span>` : `<span class="tag ok">${icon('i-check')}On track</span>`) : '';
      return `<div class="budget-row">
        ${badge(c)}
        <div style="min-width:0">
          <div class="row"><span class="nm">${esc(c.name)}</span>${tag}<button class="btn btn-sm" style="margin-left:auto" data-action="set-cat-budget" data-id="${esc(c.id)}" aria-label="${lim ? 'Edit' : 'Set'} limit for ${esc(c.name)}">${lim ? 'Edit' : 'Set limit'}</button></div>
          ${lim ? `<div class="progress ${progressClass(r)}"><span style="width:${clamp(r, 0, 1) * 100}%"></span></div>
          <div class="meta"><span class="num">${money(spent)} of ${money(lim)}</span><span class="num">${spent <= lim ? `${money(lim - spent)} left` : `${money(spent - lim)} over`}</span></div>`
          : `<div class="meta"><span>${spent ? `${money(spent)} spent · no limit` : 'No spending yet'}</span></div>`}
        </div></div>`;
    }).join('');

    const rules = S.recurring.slice().sort((a, b2) => (a.active === b2.active ? (a.next < b2.next ? -1 : 1) : a.active ? -1 : 1));
    const recurring = `<section class="card">
      <div class="card-head"><h2>Recurring</h2><span class="faint small">${plural(rules.filter((r) => r.active).length, 'active rule')}</span></div>
      ${rules.length ? rules.map((r) => {
        const c = catById(r.categoryId);
        return `<div class="budget-row" style="grid-template-columns:auto 1fr auto">
          ${badge(c)}
          <div style="min-width:0"><div class="nm" style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(r.note || c.name)}</div>
            <div class="faint small">${freqLabel(r.freq)} · <span class="num ${r.type === 'income' ? 'pos' : ''}">${r.type === 'income' ? money(r.amount, { sign: true }) : money(r.amount)}</span> · ${r.active ? `next ${esc(dayLabel(r.next))}` : 'Paused'}</div></div>
          <div style="display:flex;gap:6px">
            <button class="icon-btn" data-action="rule-toggle" data-id="${esc(r.id)}" aria-label="${r.active ? 'Pause' : 'Resume'} ${esc(r.note || c.name)}" title="${r.active ? 'Pause' : 'Resume'}">${icon(r.active ? 'i-pause' : 'i-play', 'i i-sm')}</button>
            <button class="icon-btn" data-action="rule-delete" data-id="${esc(r.id)}" aria-label="Delete recurring rule ${esc(r.note || c.name)}" title="Delete">${icon('i-trash', 'i i-sm')}</button>
          </div></div>`;
      }).join('') : `<p class="muted small" style="padding:4px 2px 6px">Automate rent, subscriptions or salary: when adding a transaction, choose <strong>Repeat</strong> and Orbit logs it for you.</p>`}
    </section>`;

    return `<div class="cols"><div class="stack">${hero}${recurring}</div>
      <section class="card"><div class="card-head"><h2>Category limits</h2><span class="faint small">${esc(monthName(mk))}</span></div>${catRows}</section></div>`;
  }

  /* =========================================================
     View: Settings
     ========================================================= */
  let installPrompt = null;
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

  function viewSettings() {
    let names;
    try { names = new Intl.DisplayNames([locale()], { type: 'currency' }); } catch { names = null; }
    const curList = CURRENCIES.includes(S.settings.currency) ? CURRENCIES : [S.settings.currency, ...CURRENCIES];
    const cats = (type) => catsOf(type).map((c) => `<div class="cat-admin">${badge(c, 'badge-sm')}<span class="nm">${esc(c.name)}</span>
      <button class="icon-btn" data-action="cat-edit" data-id="${esc(c.id)}" aria-label="Edit category ${esc(c.name)}">${icon('i-edit', 'i i-sm')}</button></div>`).join('');
    const count = S.txns.length;
    return `<div class="cols"><div class="stack">
      <section class="card">
        <div class="card-head"><h2>Preferences</h2></div>
        <div class="setting"><div class="txt"><b id="lblTheme">Appearance</b><span>Follow your device or pick a theme</span></div>
          <select class="select" id="setTheme" aria-labelledby="lblTheme">${[['system', 'System'], ['dark', 'Dark'], ['light', 'Light']].map(([v, l]) => `<option value="${v}" ${S.settings.theme === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="setting stack-sm"><div class="txt"><b id="lblCur">Currency</b><span>Switching converts your amounts at today’s rate</span></div>
          <select class="select" id="setCurrency" aria-labelledby="lblCur">${curList.map((c) => `<option value="${c}" ${S.settings.currency === c ? 'selected' : ''}>${c}${names ? ' — ' + esc(names.of(c)) : ''}</option>`).join('')}</select></div>
        ${installPrompt && !isStandalone() ? `<div class="setting"><div class="txt"><b>Install Orbit</b><span>Add to your home screen, works offline</span></div><button class="btn btn-sm btn-primary" data-action="install">${icon('i-phone', 'i i-sm')}Install</button></div>` : ''}
      </section>
      <section class="card">
        <div class="card-head"><h2>Your data</h2><span class="faint small">${plural(count, 'transaction')}</span></div>
        <div class="setting"><div class="txt"><b>Export to CSV</b><span>Open in Excel, Numbers or Sheets</span></div><button class="btn btn-sm" data-action="export-csv" ${count ? '' : 'disabled'}>${icon('i-download', 'i i-sm')}CSV</button></div>
        <div class="setting"><div class="txt"><b>Back up</b><span>Full backup including budgets & categories</span></div><button class="btn btn-sm" data-action="export-json">${icon('i-download', 'i i-sm')}Backup</button></div>
        <div class="setting"><div class="txt"><b>Restore</b><span>Replace current data with a backup file</span></div><button class="btn btn-sm" data-action="import">${icon('i-upload', 'i i-sm')}Restore</button></div>
        <div class="setting"><div class="txt"><b>Demo data</b><span>Fill Orbit with 3 months of sample activity</span></div><button class="btn btn-sm" data-action="demo">Load demo</button></div>
        <div class="setting"><div class="txt"><b>Erase everything</b><span>Delete all transactions, budgets and rules</span></div><button class="btn btn-sm btn-danger" data-action="erase">${icon('i-trash', 'i i-sm')}Erase</button></div>
      </section>
    </div>
    <div class="stack">
      <section class="card">
        <div class="card-head"><h2>Categories</h2><button class="btn btn-sm" data-action="cat-add">${icon('i-plus', 'i i-sm')}New</button></div>
        <p class="label" style="margin:4px 4px 6px">Expenses</p><div class="cat-grid-admin">${cats('expense')}</div>
        <p class="label" style="margin:16px 4px 6px">Income</p><div class="cat-grid-admin">${cats('income')}</div>
      </section>
      <p class="about">Orbit ${APP_VERSION} · Private by design — everything is stored on this device only.<br>Shortcuts: <kbd>N</kbd> new transaction · <kbd>/</kbd> search</p>
    </div></div>`;
  }

  /* =========================================================
     Toasts
     ========================================================= */
  function toast(msg, { action, error = false, timeout = 4000 } = {}) {
    const box = $('#toasts');
    while (box.children.length >= 3) box.firstElementChild.remove();
    const el = document.createElement('div');
    el.className = `toast${error ? ' err' : ''}`;
    el.innerHTML = `${icon(error ? 'i-alert' : 'i-check')}<span class="msg"></span>`;
    el.querySelector('.msg').textContent = msg;
    let timer;
    const dismiss = () => { clearTimeout(timer); el.classList.add('out'); setTimeout(() => el.remove(), 200); };
    if (action) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = action.label;
      b.addEventListener('click', () => { dismiss(); action.fn(); });
      el.appendChild(b);
    }
    box.appendChild(el);
    timer = setTimeout(dismiss, action ? Math.max(timeout, 6000) : timeout);
    el.addEventListener('mouseenter', () => clearTimeout(timer));
    el.addEventListener('mouseleave', () => { timer = setTimeout(dismiss, 2500); });
  }

  /* =========================================================
     Generic modal (confirm / amount prompt / category editor)
     ========================================================= */
  const modalEl = $('#modal');
  let modalResolve = null;

  function openModal(html, { onMount, onSubmit } = {}) {
    if (modalEl.open) modalEl.close('cancel');
    return new Promise((resolve) => {
      modalResolve = resolve;
      modalEl.innerHTML = `<form class="modal-inner" method="dialog" novalidate>${html}</form>`;
      const form = modalEl.firstElementChild;
      // Only the primary action is a submit button, so Enter can never trigger Remove/Delete.
      form.addEventListener('click', (e) => {
        const b = e.target.closest('[data-close]');
        if (b) closeModal(b.dataset.close === 'cancel' ? null : b.dataset.close);
      });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!onSubmit) return closeModal(true);
        const res = onSubmit(form);
        if (res !== false) closeModal(res);
      });
      modalEl.showModal();
      onMount?.(form);
    });
  }
  function closeModal(value) {
    const r = modalResolve;
    modalResolve = null;
    if (modalEl.open) modalEl.close();
    r?.(value);
  }
  // A stale 'close' event can arrive after a follow-up modal (e.g. confirm) has already opened — ignore it then.
  modalEl.addEventListener('close', () => { if (!modalEl.open && modalResolve) closeModal(null); });
  modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(null); });

  function confirmBox({ title, body, ok = 'Confirm', danger = false }) {
    return openModal(`<h2>${esc(title)}</h2><p>${body}</p>
      <div class="actions"><button class="btn" type="button" data-close="cancel" ${danger ? 'autofocus' : ''}>Cancel</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="submit" value="ok" ${danger ? '' : 'autofocus'}>${esc(ok)}</button></div>`).then((v) => v === true);
  }

  function amountPrompt({ title, body, value }) {
    return openModal(`<h2>${esc(title)}</h2><p>${body}</p>
      <div class="field" style="margin-top:16px"><label class="label" for="mAmount">Amount (${esc(currencySymbol())})</label>
      <input class="input num" id="mAmount" inputmode="decimal" autocomplete="off" placeholder="0" value="${value ? esc(centsToInput(value)) : ''}" aria-describedby="mErr">
      <p class="error" id="mErr" role="alert"></p></div>
      <div class="actions">${value ? `<button class="btn btn-danger" type="button" data-close="clear">Remove</button>` : ''}<button class="btn" type="button" data-close="cancel">Cancel</button><button class="btn btn-primary" type="submit" value="ok">Save</button></div>`, {
      onMount: (f) => { const i = f.querySelector('#mAmount'); i.focus(); i.select(); },
      onSubmit: (f) => {
        const input = f.querySelector('#mAmount');
        const r = parseAmount(input.value);
        if (r.error) { f.querySelector('#mErr').textContent = r.error; input.setAttribute('aria-invalid', 'true'); input.focus(); return false; }
        return r.cents;
      },
    });
  }

  async function categoryEditor(cat) {
    const editing = !!cat;
    const st = { type: cat?.type || 'expense', icon: cat?.icon || 'dots', color: cat?.color || PALETTE[S.categories.length % PALETTE.length] };
    const isFallback = editing && Object.values(FALLBACK).includes(cat.id);
    const res = await openModal(`<h2>${editing ? 'Edit category' : 'New category'}</h2>
      ${editing ? '' : `<div class="segmented" role="radiogroup" aria-label="Category type" style="margin:12px 0 4px">
        <button type="button" role="radio" data-type="expense" aria-checked="true">Expense</button><button type="button" role="radio" data-type="income" aria-checked="false">Income</button></div>`}
      <div class="field" style="margin-top:14px"><label class="label" for="cName">Name</label>
        <input class="input" id="cName" maxlength="24" autocomplete="off" value="${esc(cat?.name || '')}" placeholder="e.g. Kids, Car loan" aria-describedby="cErr"><p class="error" id="cErr" role="alert"></p></div>
      <div class="field"><span class="label" id="lblIcon">Icon</span><div class="icon-pick" role="radiogroup" aria-labelledby="lblIcon">
        ${ICONS.map((ic) => `<button type="button" role="radio" data-icon="${ic}" aria-checked="${ic === st.icon}" aria-label="${ic}">${icon('c-' + ic, 'i i-sm')}</button>`).join('')}</div></div>
      <div class="field"><span class="label" id="lblColor">Color</span><div class="swatches" role="radiogroup" aria-labelledby="lblColor">
        ${PALETTE.map((c) => `<button type="button" class="swatch" role="radio" data-color="${c}" style="--c:${c}" aria-checked="${c.toLowerCase() === st.color.toLowerCase()}" aria-label="Color ${c}"></button>`).join('')}</div></div>
      <div class="actions">${editing && !isFallback ? `<button class="btn btn-danger" type="button" data-close="delete">${icon('i-trash', 'i i-sm')}Delete</button>` : ''}
        <button class="btn" type="button" data-close="cancel">Cancel</button><button class="btn btn-primary" type="submit" value="ok">Save</button></div>`, {
      onMount: (f) => {
        f.addEventListener('click', (e) => {
          const b = e.target.closest('button[type="button"]');
          if (!b) return;
          if (b.dataset.type) { st.type = b.dataset.type; $$('[data-type]', f).forEach((x) => x.setAttribute('aria-checked', x === b)); }
          if (b.dataset.icon) { st.icon = b.dataset.icon; $$('[data-icon]', f).forEach((x) => x.setAttribute('aria-checked', x === b)); }
          if (b.dataset.color) { st.color = b.dataset.color; $$('[data-color]', f).forEach((x) => x.setAttribute('aria-checked', x === b)); }
        });
        if (!editing) f.querySelector('#cName').focus();
      },
      onSubmit: (f) => {
        const input = f.querySelector('#cName');
        const name = input.value.trim().replace(/\s+/g, ' ');
        const err = f.querySelector('#cErr');
        const type = editing ? cat.type : st.type;
        if (!name) { err.textContent = 'Give the category a name'; input.setAttribute('aria-invalid', 'true'); input.focus(); return false; }
        if (S.categories.some((c) => c.type === type && c.id !== cat?.id && c.name.toLowerCase() === name.toLowerCase())) {
          err.textContent = `${type === 'income' ? 'An income' : 'An expense'} category called “${name}” already exists`; input.setAttribute('aria-invalid', 'true'); input.focus(); return false;
        }
        return { name, type, icon: st.icon, color: st.color };
      },
    });
    if (!res) return;
    if (res === 'delete') return deleteCategory(cat);
    if (editing) Object.assign(cat, { name: res.name, icon: res.icon, color: res.color });
    else S.categories.push({ id: 'c_' + uid().slice(0, 8), ...res });
    save();
    render();
    toast(editing ? 'Category updated' : `Added “${res.name}”`);
  }

  async function deleteCategory(cat) {
    const n = S.txns.filter((t) => t.categoryId === cat.id).length;
    const fb = FALLBACK[cat.type];
    const ok = await confirmBox({ title: `Delete “${cat.name}”?`, body: n ? `${plural(n, 'transaction')} will move to “${esc(catById(fb).name)}”.` : 'This category has no transactions.', ok: 'Delete', danger: true });
    if (!ok) return;
    for (const t of S.txns) if (t.categoryId === cat.id) t.categoryId = fb;
    for (const r of S.recurring) if (r.categoryId === cat.id) r.categoryId = fb;
    delete S.budgets.byCat[cat.id];
    S.categories = S.categories.filter((c) => c.id !== cat.id);
    if (ui.cat === cat.id) ui.cat = 'all';
    save();
    render();
    toast(`Deleted “${cat.name}”`);
  }

  /* =========================================================
     Transaction sheet
     ========================================================= */
  const sheet = $('#txnSheet');
  let sheetState = null;

  function openSheet(txn = null, preset = null) {
    if (sheet.open) return;
    const editing = !!txn;
    const type = txn?.type || preset?.type || 'expense';
    const lastCat = S.settings.lastCat?.[type];
    const st = {
      editing, id: txn?.id || null, type,
      categoryId: txn?.categoryId || preset?.categoryId || (catsOf(type).some((c) => c.id === lastCat) ? lastCat : catsOf(type)[0]?.id),
      recurringId: txn?.recurringId || null,
    };
    sheetState = st;
    const rule = st.recurringId ? S.recurring.find((r) => r.id === st.recurringId) : null;
    const defaultDate = !editing && ui.month !== curMonth() ? `${ui.month}-01` : today();

    sheet.innerHTML = `<form class="sheet-inner" novalidate>
      <div class="grabber" aria-hidden="true"></div>
      <div class="sheet-head"><h2 id="sheetTitle">${editing ? 'Edit transaction' : 'New transaction'}</h2>
        <button class="icon-btn" type="button" data-sheet="close" aria-label="Close">${icon('i-x')}</button></div>
      <div class="segmented" role="radiogroup" aria-label="Type">
        <button type="button" role="radio" data-type="expense" aria-checked="${type === 'expense'}">Expense</button>
        <button type="button" role="radio" data-type="income" aria-checked="${type === 'income'}">Income</button>
      </div>
      <div class="amount-field">
        <label class="sr-only" for="fAmount">Amount</label>
        <div class="amount-wrap"><span class="cur" aria-hidden="true">${esc(currencySymbol())}</span>
          <input class="amount-input num" id="fAmount" name="amount" inputmode="decimal" autocomplete="off" placeholder="0" value="${txn ? esc(centsToInput(txn.amount)) : ''}" aria-describedby="fAmountErr fAmountHelp"></div>
        <div class="amount-line"></div>
        <p class="error" id="fAmountErr" role="alert"></p>
        <p class="help" id="fAmountHelp">Tip: math works — try 12.50+8</p>
      </div>
      <div class="field"><span class="label" id="lblCat">Category</span>
        <div class="cat-picker" id="catPicker" role="radiogroup" aria-labelledby="lblCat"></div></div>
      <div class="field">
        <label class="label" for="fNote">Note <span class="faint">(optional)</span></label>
        <input class="input" id="fNote" name="note" maxlength="${NOTE_MAX}" autocomplete="off" placeholder="What was it for?" value="${esc(txn?.note || '')}">
      </div>
      <div class="row-2" style="margin-top:14px">
        <div class="field" style="margin:0"><label class="label" for="fDate">Date</label>
          <input class="input" id="fDate" name="date" type="date" required value="${txn?.date || defaultDate}" min="1900-01-01" max="2999-12-31" aria-describedby="fDateErr"></div>
        <div class="field" style="margin:0"><label class="label" for="fRepeat">Repeat</label>
          <select class="select" id="fRepeat" name="repeat" ${editing ? 'disabled' : ''}>
            <option value="none">Never</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></div>
      </div>
      <div class="quick-dates">
        <button class="chip" type="button" data-date="${today()}">Today</button>
        <button class="chip" type="button" data-date="${addDays(today(), -1)}">Yesterday</button>
      </div>
      <p class="error" id="fDateErr" role="alert"></p>
      ${rule ? `<div class="series-note">${icon('i-repeat')}<span>Part of a ${freqLabel(rule.freq).toLowerCase()} series${rule.active ? '' : ' (paused)'}. Edits apply to this entry only.</span></div>` : ''}
      <div class="sheet-actions">
        ${editing ? `<button class="btn btn-danger" type="button" data-sheet="delete" aria-label="Delete transaction">${icon('i-trash')}</button>` : ''}
        <button class="btn btn-primary" type="submit">${editing ? 'Save changes' : 'Add transaction'}</button>
      </div>
    </form>`;

    const form = sheet.firstElementChild;
    renderCatPicker();
    st.initial = snapshot(form);

    form.addEventListener('submit', (e) => { e.preventDefault(); submitSheet(form); });
    form.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.type && b.dataset.type !== st.type) {
        st.type = b.dataset.type;
        $$('.segmented [data-type]', form).forEach((x) => x.setAttribute('aria-checked', x === b));
        const lc = S.settings.lastCat?.[st.type];
        st.categoryId = catsOf(st.type).some((c) => c.id === lc) ? lc : catsOf(st.type)[0]?.id;
        renderCatPicker();
      } else if (b.dataset.cat) {
        st.categoryId = b.dataset.cat;
        $$('[data-cat]', form).forEach((x) => x.setAttribute('aria-checked', x === b));
      } else if (b.dataset.date) {
        form.fDate.value = b.dataset.date;
        $('#fDateErr').textContent = '';
      } else if (b.dataset.sheet === 'close') {
        requestCloseSheet();
      } else if (b.dataset.sheet === 'delete') {
        const t = S.txns.find((x) => x.id === st.id);
        sheet.close();
        if (t) deleteTx(t);
      }
    });
    // Arrow-key navigation inside radio groups
    form.addEventListener('keydown', (e) => {
      const b = e.target.closest('[role="radio"]');
      if (!b || !['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
      const group = $$('[role="radio"]', b.parentElement);
      const i = group.indexOf(b) + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1);
      const nb = group[(i + group.length) % group.length];
      nb.focus(); nb.click(); e.preventDefault();
    });
    const amt = form.fAmount;
    const fit = () => { amt.style.width = `${Math.max(1, amt.value.length || 1) + 0.6}ch`; };
    fit();
    $('.amount-field', form).addEventListener('click', (e) => { if (e.target !== amt) amt.focus(); });
    amt.addEventListener('input', () => {
      fit();
      const r = parseAmount(amt.value);
      amt.removeAttribute('aria-invalid');
      $('#fAmountErr').textContent = '';
      $('#fAmountHelp').textContent = !r.error && r.isExpr ? `= ${money(r.cents)}` : 'Tip: math works — try 12.50+8';
    });
    amt.addEventListener('blur', () => {
      const r = parseAmount(amt.value);
      if (!r.error && r.isExpr) { amt.value = centsToInput(r.cents); fit(); $('#fAmountHelp').textContent = 'Tip: math works — try 12.50+8'; }
    });

    sheet.showModal();
    if (!editing && matchMedia('(pointer: fine)').matches) amt.focus();
    else form.querySelector('.sheet-head .icon-btn').focus({ preventScroll: true });
    if (!editing && !matchMedia('(pointer: fine)').matches) setTimeout(() => amt.focus(), 320);

    function renderCatPicker() {
      $('#catPicker', form).innerHTML = catsOf(st.type).map((c) => `<button type="button" class="cat-opt" role="radio" data-cat="${esc(c.id)}" style="--c:${c.color}" aria-checked="${c.id === st.categoryId}" tabindex="${c.id === st.categoryId ? 0 : -1}">${badge(c)}<span>${esc(c.name)}</span></button>`).join('');
    }
  }

  const snapshot = (form) => JSON.stringify([sheetState.type, sheetState.categoryId, form.fAmount.value, form.fNote.value, form.fDate.value, form.fRepeat.value]);
  const sheetDirty = () => sheet.open && sheetState && snapshot(sheet.firstElementChild) !== sheetState.initial;

  async function requestCloseSheet() {
    if (sheetDirty()) {
      const ok = await confirmBox({ title: 'Discard changes?', body: 'Your unsaved changes will be lost.', ok: 'Discard', danger: true });
      if (!ok) return;
    }
    sheet.close();
  }
  sheet.addEventListener('cancel', (e) => { if (sheetDirty()) { e.preventDefault(); requestCloseSheet(); } });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) requestCloseSheet(); });
  sheet.addEventListener('close', () => { sheetState = null; });

  function submitSheet(form) {
    const st = sheetState;
    const amtR = parseAmount(form.fAmount.value);
    const date = form.fDate.value;
    let bad = false;
    if (amtR.error) {
      $('#fAmountErr').textContent = amtR.error;
      form.fAmount.setAttribute('aria-invalid', 'true');
      form.fAmount.focus();
      bad = true;
    }
    if (!isValidYmd(date)) {
      $('#fDateErr').textContent = 'Pick a valid date';
      form.fDate.setAttribute('aria-invalid', 'true');
      if (!bad) form.fDate.focus();
      bad = true;
    }
    if (!st.categoryId || !S.categories.some((c) => c.id === st.categoryId && c.type === st.type)) st.categoryId = FALLBACK[st.type];
    if (bad) { haptic(30); return; }

    const note = form.fNote.value.trim().replace(/\s+/g, ' ').slice(0, NOTE_MAX);
    const repeat = form.fRepeat.value;
    S.settings.lastCat = { ...S.settings.lastCat, [st.type]: st.categoryId };
    let txn;
    if (st.editing) {
      txn = S.txns.find((t) => t.id === st.id);
      if (!txn) { sheet.close(); toast('That transaction no longer exists', { error: true }); return; }
      Object.assign(txn, { type: st.type, amount: amtR.cents, categoryId: st.categoryId, note, date });
    } else {
      txn = { id: uid(), type: st.type, amount: amtR.cents, categoryId: st.categoryId, note, date, createdAt: Date.now() };
      if (repeat !== 'none') {
        const rule = { id: uid(), type: st.type, amount: amtR.cents, categoryId: st.categoryId, note, freq: repeat, start: date, day: parseYmd(date).getDate(), active: true };
        rule.next = nextOccurrence(rule, date);
        S.recurring.push(rule);
        txn.recurringId = rule.id;
      }
      S.txns.push(txn);
    }
    const backfilled = runRecurring();
    save();
    sheet.close();
    haptic();
    render();
    const label = st.type === 'income' ? 'Income' : 'Expense';
    const msg = st.editing ? 'Changes saved' : `${label} of ${money(amtR.cents)} added${backfilled ? ` (+${backfilled} past repeats)` : ''}`;
    if (monthOf(date) !== ui.month && ROUTES[ui.route].month) {
      toast(`${msg} to ${monthName(monthOf(date))}`, { action: { label: 'View', fn: () => { ui.month = monthOf(date); render(); } } });
    } else toast(msg);
  }

  function deleteTx(t) {
    const idx = S.txns.indexOf(t);
    if (idx === -1) return;
    S.txns.splice(idx, 1);
    save();
    render();
    toast('Transaction deleted', {
      action: { label: 'Undo', fn: () => { if (!S.txns.some((x) => x.id === t.id)) { S.txns.push(t); save(); render(); toast('Restored'); } } },
    });
  }

  /* =========================================================
     Currency conversion
     ========================================================= */
  const RATES_KEY = 'orbit.rates';
  const RATE_API = 'https://open.er-api.com/v6/latest/';

  /** Rate for 1 `from` in `to`, derived from any cached table (cross rates work for any base). */
  function cachedRate(from, to) {
    try {
      const c = JSON.parse(localStorage.getItem(RATES_KEY) || 'null');
      if (!c?.rates) return null;
      const f = from === c.base ? 1 : c.rates[from];
      const t = to === c.base ? 1 : c.rates[to];
      return f > 0 && t > 0 ? { rate: t / f, time: c.time, source: 'cache' } : null;
    } catch { return null; }
  }

  async function fetchRate(from, to) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
      const res = await fetch(RATE_API + encodeURIComponent(from), { signal: ctrl.signal, cache: 'no-store' });
      const j = await res.json();
      const rate = j?.rates?.[to];
      if (j?.result !== 'success' || !(rate > 0)) throw new Error('bad response');
      const time = (j.time_last_update_unix || Date.now() / 1000) * 1000;
      try { localStorage.setItem(RATES_KEY, JSON.stringify({ base: from, rates: j.rates, time })); } catch { /* optional */ }
      return { rate, time, source: 'live' };
    } catch {
      return cachedRate(from, to);
    } finally { clearTimeout(timer); }
  }

  const parseRate = (v) => {
    const n = Number(String(v).trim().replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 && n <= 1e7 ? n : null;
  };
  const fmtRate = (r) => (r >= 100 ? r.toFixed(2) : r >= 1 ? r.toFixed(4) : r.toPrecision(4)).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

  /** Convert integer cents by `rate`, rounding to the target currency's precision. */
  function convertCents(cents, rate, digits) {
    const d = Math.min(digits, 2);
    const step = 10 ** (2 - d);
    const units = Math.round(Number(((cents / 100) * rate * 10 ** d).toPrecision(15)));
    return clamp(Math.max(1, units) * step, step, MAX_CENTS);
  }

  function countAmounts() {
    return S.txns.length + S.recurring.length + Object.keys(S.budgets.byCat).length + (S.budgets.total ? 1 : 0);
  }

  async function changeCurrency(next, select) {
    const prev = S.settings.currency;
    if (next === prev || !isCurrency(next)) return;
    const n = countAmounts();
    const apply = (rate) => {
      const snapshot = JSON.stringify(S);
      S.settings.currency = next;
      fmtCache = {};
      if (rate) {
        const d = currencyDigits();
        const conv = (c) => convertCents(c, rate, d);
        for (const t of S.txns) t.amount = conv(t.amount);
        for (const r of S.recurring) r.amount = conv(r.amount);
        if (S.budgets.total) S.budgets.total = conv(S.budgets.total);
        for (const k of Object.keys(S.budgets.byCat)) S.budgets.byCat[k] = conv(S.budgets.byCat[k]);
      }
      save(); render();
      toast(rate ? `Converted ${plural(n, 'amount')} to ${next}` : `Showing amounts in ${next} (not converted)`, {
        action: { label: 'Undo', fn: () => { S = sanitize(JSON.parse(snapshot)); fmtCache = {}; save(); render(); toast(`Back to ${prev}`); } },
      });
    };
    if (!n) return apply(null);

    let names;
    try { names = new Intl.DisplayNames([locale()], { type: 'currency' }); } catch { names = null; }
    const label = (c) => (names ? `${c} (${esc(names.of(c))})` : c);
    const res = await openModal(`<h2>Switch to ${esc(next)}</h2>
      <p>Convert your ${plural(n, 'amount')} from ${label(prev)} to ${label(next)}, or keep the numbers and only change the currency label.</p>
      <div class="field" style="margin-top:16px"><label class="label" for="mRate">Exchange rate</label>
        <div class="rate-row"><span class="num">1 ${esc(prev)} =</span><input class="input num" id="mRate" inputmode="decimal" autocomplete="off" placeholder="Loading…" aria-describedby="mRateHelp mErr"><span class="num">${esc(next)}</span></div>
        <p class="help" id="mRateHelp" aria-live="polite">Fetching today’s rate…</p>
        <p class="error" id="mErr" role="alert"></p></div>
      <div class="actions"><button class="btn" type="button" data-close="cancel">Cancel</button><button class="btn" type="button" data-close="display">Label only</button>
        <button class="btn btn-primary" type="submit" value="ok">Convert</button></div>`, {
      onMount: async (f) => {
        const input = f.querySelector('#mRate');
        const help = f.querySelector('#mRateHelp');
        let edited = false;
        input.addEventListener('input', () => { edited = true; input.removeAttribute('aria-invalid'); f.querySelector('#mErr').textContent = ''; });
        const r = await fetchRate(prev, next);
        if (!f.isConnected || edited) return;
        if (r) {
          input.value = fmtRate(r.rate);
          const when = dtf({ month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(r.time));
          help.textContent = r.source === 'live' ? `Live market rate · updated ${when}. You can adjust it.` : `Offline — using saved rate from ${when}. You can adjust it.`;
        } else {
          help.textContent = 'Couldn’t load a live rate. Enter it manually.';
          input.placeholder = 'e.g. 0.92';
          input.focus();
        }
      },
      onSubmit: (f) => {
        const input = f.querySelector('#mRate');
        const rate = parseRate(input.value);
        if (!rate) { f.querySelector('#mErr').textContent = 'Enter a positive exchange rate, like 0.92'; input.setAttribute('aria-invalid', 'true'); input.focus(); return false; }
        return rate;
      },
    });
    if (res === 'display') apply(null);
    else if (typeof res === 'number') apply(res);
    else if (select) select.value = prev; // cancelled
  }

  /* =========================================================
     Import / export
     ========================================================= */
  function download(name, content, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const csvCell = (v) => {
    let s = String(v ?? '');
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  function exportCsv() {
    const rows = [['Date', 'Type', 'Category', 'Amount', 'Currency', 'Note', 'Recurring']];
    for (const t of S.txns.slice().sort(sortTx)) {
      rows.push([t.date, t.type, catById(t.categoryId).name, (t.amount / 100).toFixed(2), S.settings.currency, t.note, t.recurringId ? 'yes' : '']);
    }
    // Amount column is numeric and may legitimately be plain digits; only text cells are guarded.
    const csv = rows.map((r) => r.map((v, i) => (i === 3 ? v : csvCell(v))).join(',')).join('\r\n');
    download(`orbit-transactions-${today()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
    toast(`Exported ${plural(S.txns.length, 'transaction')}`);
  }
  function exportJson() {
    download(`orbit-backup-${today()}.json`, JSON.stringify({ app: 'orbit', exportedAt: new Date().toISOString(), ...S }, null, 2), 'application/json');
    toast('Backup downloaded');
  }
  async function importFile(file) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return toast('That file is too large to be an Orbit backup', { error: true });
    let data;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || (!Array.isArray(parsed.txns) && !Array.isArray(parsed.categories))) throw new Error('shape');
      data = sanitize(parsed);
    } catch {
      return toast("Couldn't read that file. Choose an Orbit backup (.json).", { error: true, timeout: 6000 });
    }
    const ok = await confirmBox({ title: 'Restore backup?', body: `This replaces your current data (${plural(S.txns.length, 'transaction')}) with the backup (${plural(data.txns.length, 'transaction')}).`, ok: 'Restore', danger: true });
    if (!ok) return;
    S = data;
    fmtCache = {};
    runRecurring();
    save();
    applyTheme();
    render();
    toast(`Restored ${plural(S.txns.length, 'transaction')}`);
  }

  /* =========================================================
     Demo data
     ========================================================= */
  function buildDemo() {
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const scale = DEMO_SCALE[S.settings.currency] || 1;
    // Values are written in USD-like units, then scaled; large-unit currencies round to whole tens.
    const cents = (v) => {
      const x = v * scale;
      return scale >= 100 ? Math.max(1, Math.round(x / 10)) * 1000 : Math.max(1, Math.round(x * 100));
    };
    const data = defaults();
    data.settings = { ...S.settings };
    const add = (date, type, categoryId, value, note, recurringId) => data.txns.push({ id: uid(), type, amount: cents(value), categoryId, note, date, createdAt: Date.now(), ...(recurringId ? { recurringId } : {}) });
    const t = today();
    const start = `${addMonths(curMonth(), -3)}-01`;
    const rules = [
      { type: 'income', categoryId: 'salary', amount: 4200, note: 'Salary', freq: 'monthly', day: 1 },
      { type: 'expense', categoryId: 'housing', amount: 1350, note: 'Rent', freq: 'monthly', day: 2 },
      { type: 'expense', categoryId: 'subscriptions', amount: 15.49, note: 'Netflix', freq: 'monthly', day: 9 },
      { type: 'expense', categoryId: 'subscriptions', amount: 10.99, note: 'Spotify', freq: 'monthly', day: 14 },
      { type: 'expense', categoryId: 'bills', amount: 64.2, note: 'Internet', freq: 'monthly', day: 18 },
      { type: 'expense', categoryId: 'health', amount: 39, note: 'Gym membership', freq: 'monthly', day: 5 },
    ].map((r) => ({ id: uid(), ...r, amount: cents(r.amount), start: `${start.slice(0, 7)}-${pad(r.day)}`, active: true }));
    data.recurring = rules.map((r) => ({ ...r, next: r.start }));

    const notes = {
      food: ['Sushi night', 'Lunch with team', 'Pizza', 'Brunch', 'Thai takeaway', 'Burger joint', ''],
      groceries: ['Weekly groceries', 'Farmers market', 'Supermarket', ''],
      transport: ['Uber', 'Metro card top-up', 'Fuel', 'Parking', ''],
      shopping: ['New sneakers', 'Headphones', 'Book store', 'Home decor', ''],
      fun: ['Cinema', 'Concert tickets', 'Bowling', ''],
      coffee: ['Flat white', 'Latte', 'Cold brew', ''],
      health: ['Pharmacy', 'Vitamins'],
      travel: ['Weekend train trip', 'Hotel'],
      bills: ['Electricity', 'Phone bill'],
    };
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    for (let d = start; d <= t; d = addDays(d, 1)) {
      const dow = parseYmd(d).getDay();
      if (rnd() < 0.55) add(d, 'expense', 'coffee', 3 + rnd() * 3, pick(notes.coffee));
      if (rnd() < 0.42) add(d, 'expense', 'food', 9 + rnd() * 38, pick(notes.food));
      if (dow === 6 || rnd() < 0.06) add(d, 'expense', 'groceries', 45 + rnd() * 90, pick(notes.groceries));
      if (rnd() < 0.3) add(d, 'expense', 'transport', 4 + rnd() * 22, pick(notes.transport));
      if (rnd() < 0.09) add(d, 'expense', 'shopping', 20 + rnd() * 130, pick(notes.shopping));
      if ((dow === 5 || dow === 6) && rnd() < 0.35) add(d, 'expense', 'fun', 12 + rnd() * 55, pick(notes.fun));
      if (rnd() < 0.03) add(d, 'expense', 'health', 8 + rnd() * 40, pick(notes.health));
      if (Number(d.slice(8)) === 22) add(d, 'expense', 'bills', 70 + rnd() * 50, 'Electricity');
      if (rnd() < 0.04) add(d, 'income', 'freelance', 150 + rnd() * 600, pick(['Logo design', 'Website fix', 'Consulting call']));
    }
    add(addDays(t, -40), 'expense', 'travel', 280, 'Weekend train trip');
    data.budgets = { total: cents(3200), byCat: { food: cents(380), coffee: cents(90), groceries: cents(420), transport: cents(180), shopping: cents(250), fun: cents(160) } };
    data.txns = data.txns.filter((x) => x.date >= start);
    return data;
  }

  async function loadDemo() {
    if (S.txns.length) {
      const ok = await confirmBox({ title: 'Replace with demo data?', body: `Your ${plural(S.txns.length, 'transaction')} will be replaced. Back up first if you want to keep them.`, ok: 'Load demo', danger: true });
      if (!ok) return;
    }
    S = buildDemo();
    runRecurring();
    save();
    ui.month = curMonth();
    location.hash = '#/home';
    render();
    toast(`Loaded ${plural(S.txns.length, 'demo transaction')}`);
  }

  /* =========================================================
     Theme
     ========================================================= */
  const mqlLight = matchMedia('(prefers-color-scheme: light)');
  function applyTheme() {
    const pref = S.settings.theme;
    const t = pref === 'system' ? (mqlLight.matches ? 'light' : 'dark') : pref;
    document.documentElement.dataset.theme = t;
    $('meta[name="theme-color"]').setAttribute('content', t === 'light' ? '#F2F4FA' : '#06070D');
  }
  mqlLight.addEventListener?.('change', () => { if (S.settings.theme === 'system') applyTheme(); });

  /* =========================================================
     Actions & events
     ========================================================= */
  const actions = {
    add: () => openSheet(),
    'quick-add': (el) => { const c = S.categories.find((x) => x.id === el.dataset.cat); if (c) openSheet(null, { type: c.type, categoryId: c.id }); },
    'edit-tx': (el) => { const t = S.txns.find((x) => x.id === el.dataset.id); if (t) openSheet(t); },
    'month-prev': () => { ui.month = addMonths(ui.month, -1); ui.selDay = null; render(); },
    'month-next': () => { ui.month = addMonths(ui.month, 1); ui.selDay = null; render(); },
    'month-today': () => { if (ui.month !== curMonth()) { ui.month = curMonth(); ui.selDay = null; render(); } },
    'filter-type': (el) => { ui.type = el.dataset.type; render(); },
    'toggle-alltime': () => { ui.allTime = !ui.allTime; render(); },
    'clear-search': () => { ui.q = ''; const q = $('#q'); q.value = ''; q.focus(); $('[data-action="clear-search"]').hidden = true; renderActivityList(); },
    'reset-filters': () => { ui.q = ''; ui.type = 'all'; ui.cat = 'all'; render(); },
    bar: (el) => {
      ui.selDay = ui.selDay === el.dataset.day ? null : el.dataset.day;
      $$('.bars .b').forEach((b) => b.classList.toggle('sel', b.dataset.day === ui.selDay));
      const ro = $('#barReadout');
      if (ro && ui.selDay) ro.innerHTML = `<span class="muted small">${esc(dayLabel(ui.selDay, { relative: false }))}</span><span class="num">${money(Number(el.dataset.v))}</span>`;
      else render();
    },
    'set-budget': async () => {
      const v = await amountPrompt({ title: 'Monthly budget', body: 'How much do you want to spend at most each month?', value: S.budgets.total });
      if (v === null || v === undefined) return;
      S.budgets.total = v === 'clear' ? null : v;
      save(); render();
      toast(v === 'clear' ? 'Monthly budget removed' : `Budget set to ${money(v)}`);
    },
    'set-cat-budget': async (el) => {
      const c = catById(el.dataset.id);
      const v = await amountPrompt({ title: `${c.name} limit`, body: `Monthly spending limit for ${esc(c.name)}.`, value: S.budgets.byCat[c.id] });
      if (v === null || v === undefined) return;
      if (v === 'clear') delete S.budgets.byCat[c.id]; else S.budgets.byCat[c.id] = v;
      save(); render();
      toast(v === 'clear' ? `Removed ${c.name} limit` : `${c.name} limit set to ${money(v)}`);
    },
    'rule-toggle': (el) => {
      const r = S.recurring.find((x) => x.id === el.dataset.id);
      if (!r) return;
      r.active = !r.active;
      if (r.active) { const t = today(); let g = 0; while (r.next < t && g++ < 1000) r.next = nextOccurrence(r, r.next); }
      const n = runRecurring();
      save(); render();
      toast(r.active ? `Resumed${n ? ` — logged ${plural(n, 'transaction')}` : ''}` : 'Paused — no new entries will be added');
    },
    'rule-delete': async (el) => {
      const r = S.recurring.find((x) => x.id === el.dataset.id);
      if (!r) return;
      const ok = await confirmBox({ title: 'Stop this repeat?', body: 'Future entries won’t be created. Transactions already logged are kept.', ok: 'Stop repeating', danger: true });
      if (!ok) return;
      S.recurring = S.recurring.filter((x) => x !== r);
      for (const t of S.txns) if (t.recurringId === r.id) delete t.recurringId;
      save(); render();
      toast('Recurring rule removed');
    },
    'cat-add': () => categoryEditor(null),
    'cat-edit': (el) => { const c = S.categories.find((x) => x.id === el.dataset.id); if (c) categoryEditor(c); },
    'export-csv': exportCsv,
    'export-json': exportJson,
    import: () => { const f = $('#importFile'); f.value = ''; f.click(); },
    demo: loadDemo,
    erase: async () => {
      const ok = await confirmBox({ title: 'Erase everything?', body: 'All transactions, budgets, recurring rules and custom categories will be permanently deleted from this device. Consider a backup first.', ok: 'Erase all data', danger: true });
      if (!ok) return;
      const keep = { currency: S.settings.currency, theme: S.settings.theme, lastCat: {} };
      S = defaults();
      S.settings = keep;
      save(); render();
      toast('All data erased');
    },
    install: async () => {
      if (!installPrompt) return;
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      installPrompt = null;
      if (outcome === 'accepted') toast('Orbit installed');
      render();
    },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || el.disabled) return;
    const fn = actions[el.dataset.action];
    if (fn) { e.preventDefault(); fn(el, e); }
  });

  let searchTimer;
  view.addEventListener('input', (e) => {
    if (e.target.id === 'q') {
      ui.q = e.target.value;
      $('[data-action="clear-search"]').hidden = !ui.q;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderActivityList, 120);
    }
  });
  view.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'catFilter') { ui.cat = t.value; renderActivityList(); }
    if (t.id === 'setTheme') { S.settings.theme = t.value; save(); applyTheme(); }
    if (t.id === 'setCurrency') changeCurrency(t.value, t);
  });
  $('#importFile').addEventListener('change', (e) => importFile(e.target.files[0]));

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if (typing || sheet.open || modalEl.open) return;
    if (e.key === 'n' || e.key === 'N') { e.preventDefault(); openSheet(); }
    else if (e.key === '/') {
      e.preventDefault();
      if (ui.route !== 'activity') { location.hash = '#/activity'; setTimeout(() => $('#q')?.focus(), 50); } else $('#q')?.focus();
    }
  });

  // Router
  function route(initial = false) {
    const m = location.hash.match(/^#\/([\w-]+)/);
    const r = m && ROUTES[m[1]] ? m[1] : 'home';
    const changed = r !== ui.route;
    ui.route = r;
    if (sheet.open && !initial) sheet.close();
    render();
    if (!initial && changed) { window.scrollTo({ top: 0 }); view.focus({ preventScroll: true }); }
  }
  window.addEventListener('hashchange', () => route());

  // Keep multiple tabs in sync
  window.addEventListener('storage', (e) => {
    if (e.key !== STORE_KEY) return;
    S = load(); fmtCache = {}; applyTheme();
    if (!sheet.open && !modalEl.open) render();
  });

  // New day / app resumed: log due recurring items and refresh relative labels
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const added = runRecurring();
    const t = today();
    if (t !== ui.lastDay) { if (ui.month === monthOf(ui.lastDay)) ui.month = monthOf(t); ui.lastDay = t; }
    if (!sheet.open && !modalEl.open) render();
    if (added) toast(`Logged ${plural(added, 'recurring transaction')}`);
  });

  window.addEventListener('offline', () => toast('You’re offline — Orbit keeps working and saves locally.'));

  /* =========================================================
     PWA: service worker & install
     ========================================================= */
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installPrompt = e; if (ui.route === 'settings') render(); });
  window.addEventListener('appinstalled', () => { installPrompt = null; });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('sw.js');
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) location.reload(); });
        const prompt = (w) => toast('A new version of Orbit is ready', {
          timeout: 15000,
          action: { label: 'Update', fn: () => { reloading = true; w.postMessage('skipWaiting'); } },
        });
        if (reg.waiting && navigator.serviceWorker.controller) prompt(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const w = reg.installing;
          w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) prompt(w); });
        });
      } catch { /* SW optional */ }
    });
  }

  /* =========================================================
     Boot
     ========================================================= */
  applyTheme();
  const added = runRecurring();
  route(true);
  if (added) toast(`Logged ${plural(added, 'recurring transaction')}`);
  if (storageBroken) toast('Storage is unavailable (private mode?). Changes will not persist.', { error: true, timeout: 7000 });
  const params = new URLSearchParams(location.search);
  if (params.get('action') === 'add') {
    history.replaceState(null, '', location.pathname + location.hash);
    openSheet();
  }

  // Exposed for automated QA only.
  window.__orbit = { parseAmount, nextOccurrence, sanitize, get state() { return S; }, ui };
})();
