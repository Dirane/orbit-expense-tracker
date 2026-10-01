/* Yaje — offline-first, bilingual (EN/FR) expense tracker. No dependencies. */
(() => {
  'use strict';

  const APP_VERSION = '2.0.0';
  const STORE_KEY = 'yaje.v1';
  const LEGACY_KEYS = ['orbit.v1']; // data from before the rename is migrated on first load
  const RATES_KEY = 'yaje.rates';
  const INSTALL_KEY = 'yaje.install';
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
  const readJSON = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };

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
  const DEFAULT_IDS = new Set(DEFAULT_CATS.map((c) => c.id));
  const CURRENCIES = ['XAF', 'XOF', 'USD', 'EUR', 'GBP', 'NGN', 'GHS', 'KES', 'ZAR', 'EGP', 'MAD', 'CAD', 'AUD', 'NZD', 'JPY', 'CNY', 'INR', 'KRW', 'SGD', 'HKD', 'AED', 'SAR', 'CHF', 'SEK', 'NOK', 'DKK', 'PLN', 'TRY', 'BRL', 'MXN'];
  const REGION_CURRENCY = { US: 'USD', GB: 'GBP', CM: 'XAF', GA: 'XAF', TD: 'XAF', CF: 'XAF', CG: 'XAF', GQ: 'XAF', SN: 'XOF', CI: 'XOF', BJ: 'XOF', BF: 'XOF', ML: 'XOF', TG: 'XOF', NE: 'XOF', NG: 'NGN', GH: 'GHS', KE: 'KES', ZA: 'ZAR', EG: 'EGP', MA: 'MAD', CA: 'CAD', AU: 'AUD', NZ: 'NZD', JP: 'JPY', CN: 'CNY', IN: 'INR', KR: 'KRW', SG: 'SGD', HK: 'HKD', AE: 'AED', SA: 'SAR', CH: 'CHF', SE: 'SEK', NO: 'NOK', DK: 'DKK', PL: 'PLN', TR: 'TRY', BR: 'BRL', MX: 'MXN', DE: 'EUR', FR: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR', BE: 'EUR', PT: 'EUR', IE: 'EUR', AT: 'EUR', FI: 'EUR', GR: 'EUR', LU: 'EUR' };
  // Rough scale so demo data feels realistic in any currency.
  const DEMO_SCALE = { JPY: 150, XAF: 600, XOF: 600, NGN: 1500, GHS: 15, KES: 130, ZAR: 18, EGP: 48, MAD: 10, INR: 85, KRW: 1400, CNY: 7, HKD: 8, AED: 4, SAR: 4, SEK: 10, NOK: 10, DKK: 7, PLN: 4, TRY: 40, BRL: 5, MXN: 18 };

  const deviceRegion = () => { try { return new Intl.Locale(navigator.language || 'en-US').maximize().region; } catch { return null; } };
  const isCurrency = (c) => { try { new Intl.NumberFormat('en', { style: 'currency', currency: c }); return /^[A-Z]{3}$/.test(c); } catch { return false; } };
  const guessCurrency = () => REGION_CURRENCY[deviceRegion()] || 'USD';
  const guessLang = () => {
    const langs = navigator.languages?.length ? navigator.languages : [navigator.language || 'en'];
    const first = langs.find((l) => /^(en|fr)\b/i.test(l));
    return first && /^fr/i.test(first) ? 'fr' : 'en';
  };

  /* =========================================================
     i18n
     ========================================================= */
  const DICT = window.YAJE_I18N;
  let lang = 'en';
  /** Translate `key`, interpolating {params}. Missing French keys fall back to English. */
  function t(key, params) {
    let s = DICT[lang]?.[key] ?? DICT.en[key];
    if (s === undefined) { console.warn('[i18n] missing key', key); return key; }
    if (typeof s === 'object') s = s.other;
    return params ? s.replace(/\{(\w+)\}/g, (m, k) => (k in params ? params[k] : m)) : s;
  }
  /** Plural-aware translate: French treats 0 and 1 as singular, English only 1. */
  function tn(key, n, params = {}) {
    const entry = DICT[lang]?.[key] ?? DICT.en[key];
    if (entry === undefined) { console.warn('[i18n] missing key', key); return key; }
    const one = lang === 'fr' ? Math.abs(n) < 2 : n === 1;
    const s = typeof entry === 'object' ? (one ? entry.one : entry.other) : entry;
    const all = { n: fmtNum(n), ...params };
    return s.replace(/\{(\w+)\}/g, (m, k) => (k in all ? all[k] : m));
  }
  /** BCP-47 locale: chosen language + the device's region (e.g. fr-CM), so formats feel local. */
  let localeCache = null;
  function locale() {
    if (localeCache?.lang === lang) return localeCache.tag;
    const region = deviceRegion();
    const cand = region ? `${lang}-${region}` : lang;
    let tag;
    try { tag = Intl.DateTimeFormat.supportedLocalesOf([cand]).length ? cand : (lang === 'fr' ? 'fr-FR' : 'en-US'); } catch { tag = lang; }
    localeCache = { lang, tag };
    return tag;
  }
  const fmtNum = (n) => { try { return new Intl.NumberFormat(locale()).format(n); } catch { return String(n); } };

  /* =========================================================
     Store
     ========================================================= */
  function defaults() {
    return {
      v: 1,
      settings: { currency: guessCurrency(), theme: 'system', lang: guessLang(), lastCat: {}, tips: {} },
      categories: DEFAULT_CATS.map((c) => ({ ...c })),
      txns: [],
      budgets: { total: null, byCat: {} },
      recurring: [],
    };
  }

  const validColor = (c) => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
  const validCents = (n) => Number.isInteger(n) && n > 0 && n <= MAX_CENTS;

  function cleanTxn(tx, catMap) {
    if (!tx || typeof tx !== 'object') return null;
    const type = tx.type === 'income' ? 'income' : 'expense';
    const amount = Math.round(Number(tx.amount));
    if (!validCents(amount) || !isValidYmd(tx.date)) return null;
    let cat = catMap.get(tx.categoryId);
    if (!cat || cat.type !== type) cat = catMap.get(FALLBACK[type]);
    const out = {
      id: typeof tx.id === 'string' && tx.id ? tx.id.slice(0, 80) : uid(),
      type, amount, categoryId: cat.id,
      note: typeof tx.note === 'string' ? tx.note.slice(0, NOTE_MAX) : '',
      date: tx.date,
      createdAt: Number.isFinite(tx.createdAt) ? tx.createdAt : Date.now(),
    };
    if (typeof tx.recurringId === 'string') out.recurringId = tx.recurringId;
    return out;
  }

  /** Validate and normalise anything that claims to be Yaje (or legacy Orbit) data. */
  function sanitize(d) {
    if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('Not a Yaje backup');
    const out = defaults();
    const s = d.settings || {};
    if (typeof s.currency === 'string' && isCurrency(s.currency.toUpperCase())) out.settings.currency = s.currency.toUpperCase();
    if (['system', 'dark', 'light'].includes(s.theme)) out.settings.theme = s.theme;
    if (['en', 'fr'].includes(s.lang)) out.settings.lang = s.lang;
    if (s.lastCat && typeof s.lastCat === 'object') out.settings.lastCat = { expense: String(s.lastCat.expense || ''), income: String(s.lastCat.income || '') };
    if (s.tips && typeof s.tips === 'object') out.settings.tips = { editHint: !!s.tips.editHint };

    if (Array.isArray(d.categories)) {
      const seen = new Set();
      const cats = [];
      for (const c of d.categories) {
        if (!c || typeof c.id !== 'string' || !c.id || seen.has(c.id)) continue;
        seen.add(c.id);
        const cat = {
          id: c.id.slice(0, 80),
          name: String(c.name || 'Untitled').trim().slice(0, 24) || 'Untitled',
          icon: ICONS.includes(c.icon) ? c.icon : 'dots',
          color: validColor(c.color) ? c.color : '#94A3B8',
          type: c.type === 'income' ? 'income' : 'expense',
        };
        if (c.custom === true) cat.custom = true;
        cats.push(cat);
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
        const tx = cleanTxn(raw, catMap);
        if (!tx) continue;
        if (ids.has(tx.id)) tx.id = uid();
        ids.add(tx.id);
        out.txns.push(tx);
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
  let loadError = false;
  function load() {
    let raw = null;
    try {
      raw = localStorage.getItem(STORE_KEY);
      if (!raw) for (const k of LEGACY_KEYS) { raw = localStorage.getItem(k); if (raw) break; }
    } catch { storageBroken = true; return defaults(); }
    if (!raw) return defaults();
    try {
      return sanitize(JSON.parse(raw));
    } catch {
      try { localStorage.setItem(`${STORE_KEY}.corrupt.${Date.now()}`, raw); } catch { /* full */ }
      loadError = true;
      return defaults();
    }
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(S));
      return true;
    } catch {
      toast(storageBroken ? t('err.storageOff') : t('err.storageFull'), { error: true, timeout: 6000 });
      return false;
    }
  }

  let S = load();
  lang = S.settings.lang;

  /* =========================================================
     Money
     ========================================================= */
  let fmtCache = {};
  const currencyDigits = () => {
    try { return new Intl.NumberFormat('en', { style: 'currency', currency: S.settings.currency }).resolvedOptions().maximumFractionDigits; } catch { return 2; }
  };
  function formatter(compact) {
    const key = (compact ? 'c' : 's') + locale();
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
  const currencyName = (c) => { try { return new Intl.DisplayNames([locale()], { type: 'currency' }).of(c); } catch { return c; } };

  /**
   * Parse an amount, allowing simple arithmetic: "12.50 + 8", "3*4.99", "(20-5)/2".
   * Accepts "," or "." as the decimal separator. Returns { cents, isExpr } or { error }.
   */
  function parseAmount(raw) {
    let s = String(raw ?? '').trim().replace(/[\s  ]+/g, '').replace(/[×xX]/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-');
    if (!s) return { error: t('amt.empty') };
    s = s.includes(',') && s.includes('.') ? s.replace(/,/g, '') : s.replace(/,/g, '.');
    if (!/^[\d.+\-*/()]+$/.test(s)) return { error: t('amt.chars') };
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
    try { v = expr(); if (i !== s.length) fail(); } catch { return { error: t('amt.invalid') }; }
    if (!Number.isFinite(v)) return { error: t('amt.calc') };
    const d = Math.min(currencyDigits(), 2);
    const units = Math.round(Number((v * 10 ** d).toPrecision(15)));
    const cents = units * 10 ** (2 - d);
    if (cents <= 0) return { error: t('amt.zero') };
    if (cents > MAX_CENTS) return { error: t('amt.large') };
    return { cents, isExpr: /[+\-*/()]/.test(s.replace(/^\+/, '')) };
  }

  /* =========================================================
     Selectors
     ========================================================= */
  const catById = (id) => S.categories.find((c) => c.id === id) || S.categories.find((c) => c.id === FALLBACK.expense);
  const catsOf = (type) => S.categories.filter((c) => c.type === type);
  /** Built-in categories follow the UI language unless the user renamed them. */
  const catName = (c) => (c.custom || !DEFAULT_IDS.has(c.id) ? c.name : t('cat.' + c.id));
  const sortTx = (a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt);
  const txInMonth = (mk) => S.txns.filter((x) => x.date.startsWith(mk + '-'));
  function totals(list) {
    let inc = 0, exp = 0;
    for (const x of list) x.type === 'income' ? (inc += x.amount) : (exp += x.amount);
    return { inc, exp, net: inc - exp };
  }
  function byCategory(list, type = 'expense') {
    const m = new Map();
    for (const x of list) if (x.type === type) m.set(x.categoryId, (m.get(x.categoryId) || 0) + x.amount);
    return [...m.entries()].map(([id, sum]) => ({ cat: catById(id), sum })).sort((a, b) => b.sum - a.sum);
  }
  function dailyExpense(mk) {
    const [y, m] = mkParts(mk);
    const arr = new Array(daysInMonth(y, m)).fill(0);
    for (const x of txInMonth(mk)) if (x.type === 'expense') arr[Number(x.date.slice(8)) - 1] += x.amount;
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
    const td = today();
    let added = 0;
    for (const r of S.recurring) {
      if (!r.active) continue;
      let guard = 0;
      while (r.next <= td && guard++ < 520) {
        S.txns.push({ id: uid(), type: r.type, amount: r.amount, categoryId: r.categoryId, note: r.note, date: r.next, createdAt: Date.now() + added, recurringId: r.id });
        added++;
        r.next = nextOccurrence(r, r.next);
      }
    }
    if (added) save();
    return added;
  }

  /* =========================================================
     Formatting helpers
     ========================================================= */
  const dtf = (opts) => new Intl.DateTimeFormat(locale(), opts);
  const cap = (s) => s.charAt(0).toLocaleUpperCase(locale()) + s.slice(1);
  const monthName = (mk, style = 'long') => { const [y, m] = mkParts(mk); return cap(dtf({ month: style, year: 'numeric' }).format(new Date(y, m - 1, 1))); };
  const monthOnly = (mk) => { const [y, m] = mkParts(mk); return dtf({ month: 'long' }).format(new Date(y, m - 1, 1)); };
  function dayLabel(s, { relative = true } = {}) {
    const td = today();
    if (relative && s === td) return t('day.today');
    if (relative && s === addDays(td, -1)) return t('day.yesterday');
    if (relative && s === addDays(td, 1)) return t('day.tomorrow');
    const d = parseYmd(s);
    const sameYear = d.getFullYear() === new Date().getFullYear();
    return cap(dtf({ weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) }).format(d));
  }
  const pct = (n) => { try { return new Intl.NumberFormat(locale(), { style: 'percent', maximumFractionDigits: 0 }).format(n); } catch { return `${Math.round(n * 100)}%`; } };

  /* =========================================================
     UI state & static text
     ========================================================= */
  const ui = { route: 'home', month: curMonth(), q: '', type: 'all', cat: 'all', allTime: false, selDay: null, lastDay: today() };

  const ROUTES = {
    home: { month: true, view: viewHome },
    activity: { month: true, view: viewActivity },
    insights: { month: true, view: viewInsights },
    budgets: { month: true, view: viewBudgets },
    settings: { month: false, view: viewSettings },
  };

  const view = $('#view');

  /** Apply translations to the static shell (nav, labels, aria). */
  function applyStaticText() {
    document.documentElement.lang = lang;
    for (const el of $$('[data-i18n]')) el.textContent = t(el.dataset.i18n);
    for (const el of $$('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
    for (const el of $$('[data-i18n-title]')) el.setAttribute('title', t(el.dataset.i18nTitle));
  }

  function greeting() {
    const h = new Date().getHours();
    return t(h < 5 ? 'greet.night' : h < 12 ? 'greet.morning' : h < 18 ? 'greet.afternoon' : 'greet.evening');
  }

  function render() {
    const r = ROUTES[ui.route];
    const title = t('route.' + ui.route);
    $('#title').textContent = title;
    $('#eyebrow').textContent = ui.route === 'home'
      ? (innerWidth < 640 ? greeting() : `${greeting()} · ${cap(dtf({ weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()))}`)
      : t('eyebrow.' + ui.route);
    document.title = `${title} · Yaje`;

    const ms = $('#monthSwitch');
    ms.hidden = !r.month || (ui.route === 'activity' && ui.allTime) || (ui.route === 'home' && !S.txns.length);
    const ml = $('#monthLabel');
    ml.textContent = monthName(ui.month, 'short');
    ml.setAttribute('aria-label', ui.month === curMonth() ? t('month.current', { m: monthName(ui.month) }) : t('month.jump', { m: monthName(ui.month) }));

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

  function setLang(next) {
    if (!['en', 'fr'].includes(next) || next === lang) return;
    lang = next;
    S.settings.lang = next;
    fmtCache = {};
    save();
    applyStaticText();
    render();
    toast(t('toast.lang'));
  }

  /* =========================================================
     Shared fragments
     ========================================================= */
  const badge = (cat, cls = '') => `<span class="badge ${cls}" style="--c:${cat.color}">${icon('c-' + cat.icon)}</span>`;
  const langSwitch = (id) => `<div class="segmented lang-switch" role="radiogroup" aria-label="${esc(t('set.language'))}" id="${id}">
      <button type="button" role="radio" data-action="set-lang" data-lang="en" aria-checked="${lang === 'en'}">English</button>
      <button type="button" role="radio" data-action="set-lang" data-lang="fr" aria-checked="${lang === 'fr'}">Français</button></div>`;

  function txItem(x, { showDate = false } = {}) {
    const c = catById(x.categoryId);
    const cn = catName(c);
    const title = x.note || cn;
    const sub = [x.note ? cn : null, showDate ? dayLabel(x.date) : null].filter(Boolean).join(' · ');
    const amt = x.type === 'income' ? money(x.amount, { sign: true }) : money(-x.amount);
    const aria = t('tx.aria', { title, type: t(x.type === 'income' ? 'type.income' : 'type.expense').toLowerCase(), amount: money(x.amount), date: dayLabel(x.date) });
    return `<li><button class="tx" type="button" data-action="edit-tx" data-id="${esc(x.id)}" aria-label="${esc(aria)}">
      ${badge(c)}
      <span class="tx-body"><span class="tx-title">${esc(title)}</span>
      <span class="tx-sub">${x.recurringId ? icon('i-repeat') : ''}${esc(sub || (x.recurringId ? t('tx.recurring') : cn))}</span></span>
      <span class="tx-amt num ${x.type}">${amt}</span>
    </button></li>`;
  }

  function emptyState({ ic = 'i-sparkle', title, body, actions = '' }) {
    return `<div class="empty"><div class="orb">${icon(ic)}</div><h3>${title}</h3><p>${body}</p>${actions ? `<div class="actions">${actions}</div>` : ''}</div>`;
  }

  const progressClass = (ratio) => (ratio >= 1 ? 'over' : ratio >= 0.8 ? 'warn' : '');
  const addBtn = (cls = 'btn-sm') => `<button class="btn ${cls}" data-action="add">${icon('i-plus', 'i i-sm')}${t('act.addTx')}</button>`;

  /* =========================================================
     View: Home
     ========================================================= */
  function currencyOptions(selected) {
    const list = CURRENCIES.includes(selected) ? CURRENCIES : [selected, ...CURRENCIES];
    return list.map((c) => `<option value="${c}" ${selected === c ? 'selected' : ''}>${c} — ${esc(currencyName(c))}</option>`).join('');
  }

  function welcomeView() {
    const feats = [['i-sparkle', 'feat.fast'], ['i-target', 'feat.budget'], ['c-wallet', 'feat.private']];
    return `<div class="welcome">
      <section class="card hero welcome-hero">
        <div class="welcome-orb" aria-hidden="true"><img src="icons/icon.svg" alt="" width="72" height="72"></div>
        <h2 class="welcome-title">${t('welcome.title1')} <span class="grad-text">${t('welcome.title2')}</span></h2>
        <p class="welcome-sub">${t('welcome.sub')}</p>
        <div class="onboard">
          <div class="field"><span class="label">${t('set.language')}</span>${langSwitch('welcomeLang')}</div>
          <div class="field"><label class="label" for="welcomeCurrency">${t('set.currency')}</label>
            <select class="select" id="welcomeCurrency">${currencyOptions(S.settings.currency)}</select></div>
        </div>
        <div class="welcome-actions">
          <button class="btn btn-primary" data-action="add">${icon('i-plus')}${t('welcome.cta')}</button>
          <button class="btn" data-action="demo">${t('welcome.demo')}</button>
        </div>
      </section>
      <div class="feature-grid">${feats.map(([ic, k]) => `<section class="card feature"><span class="badge badge-sm" style="--c:var(--accent)">${icon(ic)}</span><div><h3>${t(k + '.t')}</h3><p>${t(k + '.b')}</p></div></section>`).join('')}</div>
    </div>`;
  }

  /** Most-used categories over the last 60 days (falls back to defaults) for one-tap entry. */
  function quickCats() {
    const since = addDays(today(), -60);
    const freq = new Map();
    for (const x of S.txns) if (x.date >= since) freq.set(x.categoryId, (freq.get(x.categoryId) || 0) + 1);
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

    let budgetHtml = '';
    let thirdStat;
    if (budget) {
      const ratio = exp / budget;
      const left = budget - exp;
      const daysLeft = isCur ? dim - new Date().getDate() + 1 : 0;
      budgetHtml = `
        <div class="progress ${progressClass(ratio)}" role="progressbar" aria-label="${esc(t('home.budgetUsed'))}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(clamp(ratio, 0, 1) * 100)}"><span style="width:${clamp(ratio, 0, 1) * 100}%"></span></div>
        <div class="hero-meta"><span>${left >= 0 ? t('home.leftOf', { left: `<strong class="num">${money(left)}</strong>`, budget: money(budget) }) : t('home.overBy', { over: `<strong class="num neg">${money(-left)}</strong>`, budget: money(budget) })}</span><span>${t('home.used', { p: pct(ratio) })}</span></div>`;
      thirdStat = isCur && daysLeft > 0
        ? { k: t('home.perDay'), c: left > 0 ? Math.floor(left / daysLeft) : 0, cls: left > 0 ? '' : 'neg', ic: 'i-target', tone: 'avg' }
        : left >= 0 ? { k: t('home.budgetLeft'), c: left, cls: 'pos', ic: 'i-target', tone: 'avg' } : { k: t('home.overBudget'), c: -left, cls: 'neg', ic: 'i-alert', tone: 'out' };
    } else {
      const el = elapsedDays(mk);
      budgetHtml = `<a class="hero-cta" href="#/budgets">${icon('i-target', 'i i-sm')}<span>${t('home.setBudgetCta')}</span>${icon('i-right', 'i i-sm')}</a>`;
      thirdStat = { k: t('home.dailyAvg'), c: el ? Math.round(exp / el) : undefined, cls: '', ic: 'i-chart', tone: 'avg' };
    }
    const stats = [
      { k: t('type.income'), c: inc, cls: inc ? 'pos' : '', ic: 'i-down', tone: 'in' },
      { k: t('home.net'), c: net, sign: true, cls: net < 0 ? 'neg' : net > 0 ? 'pos' : '', ic: 'c-wallet', tone: 'net' },
      thirdStat,
    ];
    for (const st of stats) {
      st.v = st.c === undefined ? '—' : money(st.c, { sign: st.sign });
      st.compact = st.c === undefined ? '—' : money(st.c, { compact: true, sign: st.sign });
    }
    const nExp = list.filter((x) => x.type === 'expense').length;
    const nInc = list.filter((x) => x.type === 'income').length;
    const hero = `<section class="card hero home-hero" aria-label="${esc(t('home.summary'))}">
      <p class="hero-label">${isCur ? t('home.spentSoFar', { m: esc(monthOnly(mk)) }) : t('home.spentIn', { m: esc(monthOnly(mk)) })}</p>
      <p class="hero-amount num">${money(exp)}</p>
      <p class="hero-sub">${tn('n.expense', nExp)} · ${tn('n.deposit', nInc)}</p>
      ${budgetHtml}
      <div class="hero-stats">${stats.map((st) => `<div><p class="k"><span class="dot-ic ${st.tone}">${icon(st.ic)}</span>${st.k}</p><p class="v num ${st.cls}" title="${esc(st.v)}" data-full="${esc(st.v)}" data-compact="${esc(st.compact)}">${st.v}</p></div>`).join('')}</div>
    </section>`;

    const quick = `<section class="quick-wrap" aria-label="${esc(t('home.quickAdd'))}"><p class="quick-title">${t('home.quickAdd')}</p><div class="quick">
      ${quickCats().map((c) => `<button class="quick-chip" type="button" data-action="quick-add" data-cat="${esc(c.id)}" aria-label="${esc(t('home.quickAria', { c: catName(c) }))}">${badge(c, 'badge-sm')}<span>${esc(catName(c))}</span></button>`).join('')}
    </div></section>`;

    const spentBy = new Map(byCategory(list).map((x) => [x.cat.id, x.sum]));
    const alertRows = Object.entries(S.budgets.byCat)
      .map(([id, lim]) => ({ cat: catById(id), lim, spent: spentBy.get(id) || 0 }))
      .filter((a) => a.spent / a.lim >= 0.8)
      .sort((a, b) => b.spent / b.lim - a.spent / a.lim);
    const alerts = alertRows.length ? `<section class="card heads-up" aria-label="${esc(t('home.alerts'))}">
      <div class="card-head"><h2>${icon('i-alert', 'i i-sm')}${t('home.headsUp')}</h2><a class="link" href="#/budgets">${t('route.budgets')}</a></div>
      ${alertRows.slice(0, 3).map((a) => {
        const r = a.spent / a.lim;
        const over = a.spent > a.lim;
        return `<div class="hu-row">${badge(a.cat, 'badge-sm')}<div class="hu-body"><div class="row"><span class="nm">${esc(catName(a.cat))}</span>
          <span class="tag ${over ? 'over' : 'warn'}">${over ? t('home.overAmt', { a: money(a.spent - a.lim) }) : t('home.used', { p: pct(r) })}</span></div>
          <div class="progress ${progressClass(r)}"><span style="width:${clamp(r, 0, 1) * 100}%"></span></div></div></div>`;
      }).join('')}
      ${alertRows.length > 3 ? `<p class="faint small" style="margin-top:8px">${tn('home.moreNear', alertRows.length - 3)}</p>` : ''}
    </section>` : '';

    const recentList = list.slice(0, 5);
    const recent = `<section class="card list-card">
      <div class="card-head"><h2>${t('home.recent')}</h2>${list.length > recentList.length ? `<a class="link" href="#/activity">${t('home.seeAll', { n: fmtNum(list.length) })}</a>` : ''}</div>
      ${recentList.length ? `<ul class="tx-list">${recentList.map((x) => txItem(x, { showDate: true })).join('')}</ul>`
        : emptyState({ ic: 'i-list', title: t('empty.month', { m: esc(monthOnly(mk)) }), body: t('empty.monthBody'), actions: addBtn() })}
    </section>`;

    const endDay = isCur ? today() : `${mk}-${pad(dim)}`;
    const days = Array.from({ length: 7 }, (_, i) => addDays(endDay, i - 6));
    const daySums = days.map((d) => S.txns.reduce((acc, x) => (x.date === d && x.type === 'expense' ? acc + x.amount : acc), 0));
    const maxDay = Math.max(...daySums, 1);
    const weekTotal = daySums.reduce((a, b) => a + b, 0);
    const week = `<section class="card">
      <div class="card-head"><h2>${t('home.last7')}</h2><span class="num muted small">${money(weekTotal)} · ${t('home.perDayShort', { a: money(Math.round(weekTotal / 7)) })}</span></div>
      <div class="spark" role="img" aria-label="${esc(t('home.last7Aria', { a: money(weekTotal) }))}">${days.map((d, i) => `
        <div class="spark-col" title="${esc(dayLabel(d))} : ${money(daySums[i])}">
          <div class="spark-bar ${daySums[i] ? 'has' : ''} ${d === today() ? 'today' : ''}" style="height:${Math.max(4, (daySums[i] / maxDay) * 100)}%;animation-delay:${i * 40}ms"></div>
          <span class="spark-lbl">${esc(dtf({ weekday: 'narrow' }).format(parseYmd(d)).toUpperCase())}</span>
        </div>`).join('')}</div>
    </section>`;

    const cats = byCategory(list);
    const top = cats.slice(0, 4);
    const restSum = cats.slice(4).reduce((a, x) => a + x.sum, 0);
    const topCardHtml = cats.length ? `<section class="card">
      <div class="card-head"><h2>${t('home.topCats')}</h2><a class="link" href="#/insights">${t('route.insights')}</a></div>
      <div class="share-bar" role="img" aria-label="${esc(top.map((x) => `${catName(x.cat)} ${pct(x.sum / exp)}`).join(', '))}">
        ${top.map((x) => `<span style="flex:${x.sum};background:${x.cat.color}"></span>`).join('')}${restSum ? `<span style="flex:${restSum};background:#64748B"></span>` : ''}
      </div>
      <ul class="top-cats">${top.map((x) => `<li>${badge(x.cat, 'badge-sm')}<span class="nm">${esc(catName(x.cat))}</span><span class="pc">${pct(x.sum / exp)}</span><span class="num amt">${money(x.sum)}</span></li>`).join('')}</ul>
    </section>` : '';

    return `<div class="home">
      <div class="home-col">${hero}${quick}${alerts ? `<div class="o-alerts">${alerts}</div>` : ''}<div class="o-week">${week}</div></div>
      <div class="home-col"><div class="o-recent">${recent}</div>${topCardHtml ? `<div class="o-cats">${topCardHtml}</div>` : ''}</div>
    </div>`;
  }

  /* =========================================================
     View: Activity
     ========================================================= */
  function viewActivity() {
    const cats = S.categories.filter((c) => ui.type === 'all' || c.type === ui.type);
    if (ui.cat !== 'all' && !cats.some((c) => c.id === ui.cat)) ui.cat = 'all';
    const typeLbl = { all: t('filter.all'), expense: t('filter.expenses'), income: t('filter.income') };
    return `
      <div class="filters">
        <div class="search">
          ${icon('i-search')}
          <label class="sr-only" for="q">${t('act.searchLabel')}</label>
          <input class="input" id="q" type="search" placeholder="${esc(t('act.searchPh'))}" value="${esc(ui.q)}" autocomplete="off" enterkeyhint="search">
          <button class="clear" type="button" data-action="clear-search" aria-label="${esc(t('act.clearSearch'))}" ${ui.q ? '' : 'hidden'}>${icon('i-x', 'i i-sm')}</button>
        </div>
        <div class="chips" role="group" aria-label="${esc(t('act.filter'))}">
          ${['all', 'expense', 'income'].map((ty) => `<button class="chip" type="button" data-action="filter-type" data-type="${ty}" aria-pressed="${ui.type === ty}">${typeLbl[ty]}</button>`).join('')}
          <button class="chip" type="button" data-action="toggle-alltime" aria-pressed="${ui.allTime}">${t('filter.allTime')}</button>
        </div>
        <label class="sr-only" for="catFilter">${t('form.category')}</label>
        <select class="select" id="catFilter">
          <option value="all">${t('filter.allCats')}</option>
          ${cats.map((c) => `<option value="${esc(c.id)}" ${ui.cat === c.id ? 'selected' : ''}>${esc(catName(c))}${ui.type === 'all' && c.type === 'income' ? ` (${t('type.income').toLowerCase()})` : ''}</option>`).join('')}
        </select>
      </div>
      <section class="card list-card" id="txResults" aria-live="polite"></section>`;
  }

  function filteredTx() {
    let list = ui.allTime ? S.txns.slice() : txInMonth(ui.month);
    if (ui.type !== 'all') list = list.filter((x) => x.type === ui.type);
    if (ui.cat !== 'all') list = list.filter((x) => x.categoryId === ui.cat);
    const q = ui.q.trim().toLocaleLowerCase(locale());
    if (q) {
      const terms = q.split(/\s+/);
      list = list.filter((x) => {
        const c = catById(x.categoryId);
        const hay = `${x.note} ${catName(c)} ${c.name} ${(x.amount / 100).toFixed(2)} ${money(x.amount)} ${x.date} ${dayLabel(x.date, { relative: false })}`.toLocaleLowerCase(locale());
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
        ? emptyState({ ic: 'i-search', title: t('empty.noMatch'), body: t('empty.noMatchBody'), actions: `<button class="btn btn-sm" data-action="reset-filters">${t('act.clearFilters')}</button>` })
        : emptyState({ ic: 'i-list', title: ui.allTime ? t('empty.none') : t('empty.month', { m: esc(monthName(ui.month)) }), body: t('empty.noneBody'), actions: addBtn('btn-sm btn-primary') });
      return;
    }
    const LIMIT = 400;
    const groups = new Map();
    for (const x of list.slice(0, LIMIT)) { if (!groups.has(x.date)) groups.set(x.date, []); groups.get(x.date).push(x); }
    box.innerHTML = `
      <div class="summary-bar"><span>${tn('n.tx', list.length)}</span><span>${t('act.in')} <strong class="pos">${money(inc)}</strong></span><span>${t('act.out')} <strong class="neg">${money(exp)}</strong></span></div>
      ${[...groups.entries()].map(([d, items]) => `<div class="tx-group"><div class="tx-day"><span>${esc(dayLabel(d))}</span><span class="num">${money(totals(items).net, { sign: true })}</span></div><ul class="tx-list">${items.map((x) => txItem(x)).join('')}</ul></div>`).join('')}
      ${list.length > LIMIT ? `<p class="faint small" style="text-align:center;padding:14px">${t('act.limit', { a: fmtNum(LIMIT), b: fmtNum(list.length) })}</p>` : ''}`;
  }

  /* =========================================================
     View: Insights
     ========================================================= */
  function viewInsights() {
    const mk = ui.month;
    const list = txInMonth(mk);
    const { inc, exp, net } = totals(list);
    if (!list.length) {
      return `<section class="card">${emptyState({ ic: 'i-chart', title: t('ins.noData', { m: esc(monthName(mk)) }), body: t('ins.noDataBody'), actions: addBtn('btn-primary') })}</section><div style="margin-top:14px">${trendCard()}</div>`;
    }
    const isCur = mk === curMonth();
    const prevMk = addMonths(mk, -1);
    const elapsed = elapsedDays(mk);
    const [y, m] = mkParts(mk);
    const dim = daysInMonth(y, m);
    // Compare like-for-like: for the current month, last month up to the same day.
    const cutoff = isCur ? new Date().getDate() : 31;
    const prevExp = txInMonth(prevMk).filter((x) => x.type === 'expense' && Number(x.date.slice(8)) <= cutoff).reduce((s, x) => s + x.amount, 0);
    const delta = prevExp ? (exp - prevExp) / prevExp : null;
    const avg = elapsed ? Math.round(exp / elapsed) : 0;

    const deltaHtml = delta === null ? `<p class="stat-delta faint">${isCur ? t('ins.nothingYet') : t('ins.noPrev')}</p>`
      : `<p class="stat-delta ${delta > 0 ? 'neg' : 'pos'}">${delta > 0 ? '▲' : '▼'} ${isCur ? t('ins.vsSame', { p: pct(Math.abs(delta)) }) : t('ins.vsMonth', { p: pct(Math.abs(delta)), m: esc(monthOnly(prevMk)) })}</p>`;

    const cats = byCategory(list);
    const nInc = list.filter((x) => x.type === 'income').length;
    return `
      <div class="grid-2">
        <section class="card stat"><div class="stat-top"><span class="dot-ic out">${icon('i-up')}</span>${t('ins.spent')}</div><p class="stat-value num">${money(exp)}</p>${deltaHtml}</section>
        <section class="card stat"><div class="stat-top"><span class="dot-ic in">${icon('i-down')}</span>${t('type.income')}</div><p class="stat-value num">${money(inc)}</p><p class="stat-delta faint">${tn('n.deposit', nInc)}</p></section>
        <section class="card stat"><div class="stat-top"><span class="dot-ic net">${icon('c-wallet')}</span>${t('home.net')}</div><p class="stat-value num ${net < 0 ? 'neg' : net > 0 ? 'pos' : ''}">${money(net, { sign: true })}</p><p class="stat-delta faint">${inc ? t('ins.saved', { p: pct(Math.max(net, 0) / inc) }) : t('ins.noIncome')}</p></section>
        <section class="card stat"><div class="stat-top"><span class="dot-ic avg">${icon('i-chart')}</span>${t('home.dailyAvg')}</div><p class="stat-value num">${elapsed ? money(avg) : '—'}</p><p class="stat-delta faint">${elapsed ? tn('ins.overDays', elapsed) : t('ins.notStarted')}</p></section>
      </div>
      <div class="cols" style="margin-top:14px">
        <div class="stack">
          ${smartInsights({ exp, inc, net, delta, isCur, elapsed, dim, cats })}
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

  function smartInsights({ exp, inc, net, delta, isCur, elapsed, dim, cats }) {
    const items = [];
    const add = (ic, color, html) => items.push(`<div class="insight"><span class="badge" style="--c:${color}">${icon(ic)}</span><p>${html}</p></div>`);
    if (cats[0] && exp) add('c-' + cats[0].cat.icon, cats[0].cat.color, t('hl.top', { c: esc(catName(cats[0].cat)), p: pct(cats[0].sum / exp), a: money(cats[0].sum) }));
    if (delta !== null && Math.abs(delta) >= 0.01) {
      const key = (delta > 0 ? 'hl.more' : 'hl.less') + (isCur ? 'Same' : 'Prev');
      add(delta > 0 ? 'i-up' : 'i-down', delta > 0 ? '#FB7185' : '#34D399', t(key, { p: pct(Math.abs(delta)) }));
    }
    if (isCur && elapsed >= 3 && exp > 0 && elapsed < dim) {
      const projected = Math.round((exp / elapsed) * dim);
      const b = S.budgets.total;
      const tail = b ? (projected > b ? t('hl.paceOver', { a: money(projected - b) }) : t('hl.paceUnder', { a: money(b - projected) })) : '.';
      add('i-sparkle', '#818CF8', t('hl.pace', { a: money(projected) }) + tail);
    }
    if (inc > 0) {
      const rate = net / inc;
      add('c-wallet', rate >= 0 ? '#34D399' : '#FB7185', rate >= 0 ? t('hl.kept', { p: pct(rate) }) : t('hl.exceeded', { a: money(-net) }));
    }
    const dayMax = dailyExpense(ui.month).reduce((best, v, i) => (v > best.v ? { v, i } : best), { v: 0, i: -1 });
    if (dayMax.i >= 0 && items.length < 4) {
      add('i-chart', '#5EEAD4', t('hl.bigDay', { d: esc(dayLabel(`${ui.month}-${pad(dayMax.i + 1)}`, { relative: false })), a: money(dayMax.v) }));
    }
    const recurringMonthly = S.recurring.filter((r) => r.active && r.type === 'expense')
      .reduce((s, r) => s + (r.freq === 'monthly' ? r.amount : r.freq === 'weekly' ? Math.round((r.amount * 52) / 12) : Math.round(r.amount / 12)), 0);
    if (recurringMonthly && items.length < 5) add('i-repeat', '#E879F9', t('hl.recurring', { a: money(recurringMonthly) }));
    if (!items.length) return '';
    return `<section class="card"><div class="card-head"><h2>${t('ins.highlights')}</h2>${icon('i-sparkle', 'i i-sm')}</div>${items.slice(0, 5).join('')}</section>`;
  }

  function donutCard(cats, total) {
    const top = cats.slice(0, 5);
    const rest = cats.slice(5).reduce((s, x) => s + x.sum, 0);
    const segs = top.map((x) => ({ name: catName(x.cat), color: x.cat.color, sum: x.sum }));
    if (rest) segs.push({ name: t('ins.everythingElse'), color: '#64748B', sum: rest });
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
      <div class="card-head"><h2>${t('ins.whereWent')}</h2></div>
      <div class="donut-wrap">
        <div class="donut" role="img" aria-label="${esc(summary)}">
          <svg viewBox="0 0 160 160"><circle r="${R}" cx="80" cy="80" stroke="var(--surface-2)"></circle>${arcs}</svg>
          <div class="donut-center"><span class="small">${t('ins.total')}</span><span class="num">${money(total, { compact: total >= 10_000_000 })}</span></div>
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
      return `<button class="b ${v ? 'has' : ''} ${ui.selDay === d ? 'sel' : ''}" type="button" data-action="bar" data-day="${d}" data-v="${v}" aria-label="${esc(dayLabel(d, { relative: false }))} : ${esc(money(v))}" ${future ? 'tabindex="-1" style="opacity:.35"' : ''}><span style="height:${v ? Math.max(3, (v / max) * 100) : 1.5}%;animation-delay:${i * 12}ms"></span></button>`;
    }).join('');
    const sel = ui.selDay && ui.selDay.startsWith(mk) ? ui.selDay : null;
    const readout = sel ? `<span class="muted small">${esc(dayLabel(sel, { relative: false }))}</span><span class="num">${money(arr[Number(sel.slice(8)) - 1])}</span>`
      : `<span class="muted small">${t('ins.tapBar')}</span><span class="num faint" style="font-size:14px">${t('ins.avg', { a: money(avg) })}</span>`;
    return `<section class="card">
      <div class="card-head"><h2>${t('ins.daily')}</h2><span class="key"><span><i style="border-top:2px dashed var(--warn);height:0;border-radius:0"></i>${t('ins.avgKey')}</span></span></div>
      <div class="bar-readout" id="barReadout">${readout}</div>
      <div class="bars">${avg && max ? `<div class="avg-line" style="bottom:${(avg / max) * (100 - 5)}%"></div>` : ''}${bars}</div>
      <div class="bars-axis"><span>1</span><span>${Math.ceil(arr.length / 2)}</span><span>${arr.length}</span></div>
    </section>`;
  }

  function rankCard(cats) {
    const max = cats[0].sum;
    return `<section class="card"><div class="card-head"><h2>${t('ins.byCat')}</h2></div><ul class="rank">
      ${cats.map((x) => {
        const lim = S.budgets.byCat[x.cat.id];
        return `<li>${badge(x.cat, 'badge-sm')}<div><div class="row"><span class="nm">${esc(catName(x.cat))}</span><span class="num">${money(x.sum)}</span></div>
          <div class="progress" style="--c:${x.cat.color}"><span style="width:${(x.sum / max) * 100}%"></span></div>
          ${lim ? `<div class="faint small" style="margin-top:4px">${t('ins.ofLimit', { p: pct(x.sum / lim), a: money(lim) })}</div>` : ''}</div></li>`;
      }).join('')}</ul></section>`;
  }

  function trendCard() {
    const months = Array.from({ length: 6 }, (_, i) => addMonths(ui.month, i - 5));
    const data = months.map((mk) => ({ mk, ...totals(txInMonth(mk)) }));
    const max = Math.max(...data.flatMap((d) => [d.inc, d.exp]), 1);
    if (data.every((d) => !d.inc && !d.exp)) return '';
    return `<section class="card">
      <div class="card-head"><h2>${t('ins.trend')}</h2><span class="key"><span><i style="background:var(--income)"></i>${t('act.in')}</span><span><i style="background:var(--expense)"></i>${t('act.out')}</span></span></div>
      <div class="trend" role="img" aria-label="${esc(data.map((d) => `${monthName(d.mk, 'short')}: ${t('act.in')} ${money(d.inc)}, ${t('act.out')} ${money(d.exp)}`).join('; '))}">
        ${data.map((d, i) => `<div class="trend-col ${d.mk === ui.month ? 'cur' : ''}" title="${esc(monthName(d.mk))} — ${esc(t('act.in'))} ${esc(money(d.inc))} · ${esc(t('act.out'))} ${esc(money(d.exp))}">
          <div class="trend-pair"><span class="in" style="height:${(d.inc / max) * 100}%;animation-delay:${i * 50}ms"></span><span class="out" style="height:${(d.exp / max) * 100}%;animation-delay:${i * 50 + 25}ms"></span></div>
          <span class="spark-lbl">${esc(cap(dtf({ month: 'short' }).format(new Date(mkParts(d.mk)[0], mkParts(d.mk)[1] - 1, 1))))}</span></div>`).join('')}
      </div></section>`;
  }

  function topCard(list) {
    const top = list.filter((x) => x.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5);
    if (!top.length) return '';
    return `<section class="card list-card"><div class="card-head"><h2>${t('ins.largest')}</h2></div><ul class="tx-list">${top.map((x) => txItem(x, { showDate: true })).join('')}</ul></section>`;
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
        <div class="ring">${ringSvg(ratio)}<div class="ring-center"><span class="num">${pct(ratio)}</span><span class="small faint">${t('bud.used')}</span></div></div>
        <div class="info">
          <p class="hero-label">${t('bud.monthly')}</p>
          <p class="num" style="font-size:28px;font-weight:700;margin:4px 0">${money(b)}</p>
          <p class="muted small">${exp <= b ? t('bud.leftSpent', { l: `<span class="num">${money(b - exp)}</span>`, s: money(exp) }) : t('bud.overSpent', { o: `<span class="num neg">${money(exp - b)}</span>`, s: money(exp) })}</p>
          <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap"><button class="btn btn-sm" data-action="set-budget">${icon('i-edit', 'i i-sm')}${t('act.edit')}</button></div>
        </div>
      </div></section>`
      : `<section class="card hero">${emptyState({ ic: 'i-target', title: t('bud.setTitle'), body: t('bud.setBody'), actions: `<button class="btn btn-primary" data-action="set-budget">${icon('i-plus')}${t('bud.setBtn')}</button>` })}</section>`;

    const rows = catsOf('expense').map((c) => ({ c, lim: S.budgets.byCat[c.id] || 0, spent: spentBy.get(c.id) || 0 }))
      .sort((a, b2) => (b2.lim ? 1 : 0) - (a.lim ? 1 : 0) || (b2.lim && a.lim ? b2.spent / b2.lim - a.spent / a.lim : b2.spent - a.spent));
    const catRows = rows.map(({ c, lim, spent }) => {
      const r = lim ? spent / lim : 0;
      const tag = lim ? (r >= 1 ? `<span class="tag over">${icon('i-alert')}${t('bud.over')}</span>` : r >= 0.8 ? `<span class="tag warn">${pct(r)}</span>` : `<span class="tag ok">${icon('i-check')}${t('bud.onTrack')}</span>`) : '';
      const cn = catName(c);
      return `<div class="budget-row">
        ${badge(c)}
        <div style="min-width:0">
          <div class="row"><span class="nm">${esc(cn)}</span>${tag}<button class="btn btn-sm" style="margin-left:auto" data-action="set-cat-budget" data-id="${esc(c.id)}" aria-label="${esc(t(lim ? 'bud.editLimitFor' : 'bud.setLimitFor', { c: cn }))}">${lim ? t('act.edit') : t('bud.setLimit')}</button></div>
          ${lim ? `<div class="progress ${progressClass(r)}"><span style="width:${clamp(r, 0, 1) * 100}%"></span></div>
          <div class="meta"><span class="num">${t('bud.of', { s: money(spent), l: money(lim) })}</span><span class="num">${spent <= lim ? t('bud.left', { a: money(lim - spent) }) : t('home.overAmt', { a: money(spent - lim) })}</span></div>`
          : `<div class="meta"><span>${spent ? t('bud.noLimit', { a: money(spent) }) : t('bud.noSpend')}</span></div>`}
        </div></div>`;
    }).join('');

    const rules = S.recurring.slice().sort((a, b2) => (a.active === b2.active ? (a.next < b2.next ? -1 : 1) : a.active ? -1 : 1));
    const recurring = `<section class="card">
      <div class="card-head"><h2>${t('bud.recurring')}</h2><span class="faint small">${tn('n.activeRule', rules.filter((r) => r.active).length)}</span></div>
      ${rules.length ? rules.map((r) => {
        const c = catById(r.categoryId);
        const nm = r.note || catName(c);
        return `<div class="budget-row" style="grid-template-columns:auto 1fr auto">
          ${badge(c)}
          <div style="min-width:0"><div class="nm" style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(nm)}</div>
            <div class="faint small">${t('freq.' + r.freq)} · <span class="num ${r.type === 'income' ? 'pos' : ''}">${r.type === 'income' ? money(r.amount, { sign: true }) : money(r.amount)}</span> · ${r.active ? t('bud.next', { d: esc(dayLabel(r.next)) }) : t('bud.paused')}</div></div>
          <div style="display:flex;gap:6px">
            <button class="icon-btn" data-action="rule-toggle" data-id="${esc(r.id)}" aria-label="${esc(t(r.active ? 'bud.pauseX' : 'bud.resumeX', { x: nm }))}" title="${esc(t(r.active ? 'bud.pause' : 'bud.resume'))}">${icon(r.active ? 'i-pause' : 'i-play', 'i i-sm')}</button>
            <button class="icon-btn" data-action="rule-delete" data-id="${esc(r.id)}" aria-label="${esc(t('bud.deleteX', { x: nm }))}" title="${esc(t('act.delete'))}">${icon('i-trash', 'i i-sm')}</button>
          </div></div>`;
      }).join('') : `<p class="muted small" style="padding:4px 2px 6px">${t('bud.recurringEmpty')}</p>`}
    </section>`;

    return `<div class="cols"><div class="stack">${hero}${recurring}</div>
      <section class="card"><div class="card-head"><h2>${t('bud.catLimits')}</h2><span class="faint small">${esc(monthName(mk))}</span></div>${catRows}</section></div>`;
  }

  /* =========================================================
     View: Settings
     ========================================================= */
  let installPrompt = null;
  const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches || navigator.standalone === true;
  const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const canInstall = () => !isStandalone() && (!!installPrompt || isIOS());

  function viewSettings() {
    const cats = (type) => catsOf(type).map((c) => `<div class="cat-admin">${badge(c, 'badge-sm')}<span class="nm">${esc(catName(c))}</span>
      <button class="icon-btn" data-action="cat-edit" data-id="${esc(c.id)}" aria-label="${esc(t('cat.editX', { c: catName(c) }))}">${icon('i-edit', 'i i-sm')}</button></div>`).join('');
    const count = S.txns.length;
    return `<div class="cols"><div class="stack">
      ${canInstall() ? `<section class="card install-banner"><img src="icons/icon-192.png" alt="" width="48" height="48"><div class="txt"><b>${t('set.installT')}</b><span>${t('set.installB')}</span></div><button class="btn btn-sm btn-primary" data-action="install">${icon('i-phone', 'i i-sm')}${t('set.installBtn')}</button></section>` : ''}
      <section class="card">
        <div class="card-head"><h2>${t('set.prefs')}</h2></div>
        <div class="setting stack-sm"><div class="txt"><b>${t('set.language')}</b><span>${t('set.languageB')}</span></div>${langSwitch('settingsLang')}</div>
        <div class="setting"><div class="txt"><b id="lblTheme">${t('set.theme')}</b><span>${t('set.themeB')}</span></div>
          <select class="select" id="setTheme" aria-labelledby="lblTheme">${['system', 'dark', 'light'].map((v) => `<option value="${v}" ${S.settings.theme === v ? 'selected' : ''}>${t('theme.' + v)}</option>`).join('')}</select></div>
        <div class="setting stack-sm"><div class="txt"><b id="lblCur">${t('set.currency')}</b><span>${t('set.currencyB')}</span></div>
          <select class="select" id="setCurrency" aria-labelledby="lblCur">${currencyOptions(S.settings.currency)}</select></div>
      </section>
      <section class="card">
        <div class="card-head"><h2>${t('set.data')}</h2><span class="faint small">${tn('n.tx', count)}</span></div>
        <div class="setting"><div class="txt"><b>${t('set.csv')}</b><span>${t('set.csvB')}</span></div><button class="btn btn-sm" data-action="export-csv" ${count ? '' : 'disabled'}>${icon('i-download', 'i i-sm')}CSV</button></div>
        <div class="setting"><div class="txt"><b>${t('set.backup')}</b><span>${t('set.backupB')}</span></div><button class="btn btn-sm" data-action="export-json">${icon('i-download', 'i i-sm')}${t('set.backupBtn')}</button></div>
        <div class="setting"><div class="txt"><b>${t('set.restore')}</b><span>${t('set.restoreB')}</span></div><button class="btn btn-sm" data-action="import">${icon('i-upload', 'i i-sm')}${t('set.restoreBtn')}</button></div>
        <div class="setting"><div class="txt"><b>${t('set.demo')}</b><span>${t('set.demoB')}</span></div><button class="btn btn-sm" data-action="demo">${t('set.demoBtn')}</button></div>
        <div class="setting"><div class="txt"><b>${t('set.erase')}</b><span>${t('set.eraseB')}</span></div><button class="btn btn-sm btn-danger" data-action="erase">${icon('i-trash', 'i i-sm')}${t('set.eraseBtn')}</button></div>
      </section>
    </div>
    <div class="stack">
      <section class="card">
        <div class="card-head"><h2>${t('set.categories')}</h2><button class="btn btn-sm" data-action="cat-add">${icon('i-plus', 'i i-sm')}${t('act.new')}</button></div>
        <p class="label" style="margin:4px 4px 6px">${t('filter.expenses')}</p><div class="cat-grid-admin">${cats('expense')}</div>
        <p class="label" style="margin:16px 4px 6px">${t('type.income')}</p><div class="cat-grid-admin">${cats('income')}</div>
      </section>
      <p class="about">Yaje ${APP_VERSION} · ${t('set.about')}<br>${t('set.shortcuts')}</p>
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
     Generic modal (confirm / amount prompt / category editor / install)
     ========================================================= */
  const modalEl = $('#modal');
  let modalResolve = null;

  function openModal(html, { onMount, onSubmit, cls = '' } = {}) {
    if (modalEl.open) modalEl.close('cancel');
    return new Promise((resolve) => {
      modalResolve = resolve;
      modalEl.className = `modal ${cls}`;
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

  function confirmBox({ title, body, ok = t('act.confirm'), danger = false }) {
    return openModal(`<h2>${esc(title)}</h2><p>${body}</p>
      <div class="actions"><button class="btn" type="button" data-close="cancel" ${danger ? 'autofocus' : ''}>${t('act.cancel')}</button><button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" type="submit" value="ok" ${danger ? '' : 'autofocus'}>${esc(ok)}</button></div>`).then((v) => v === true);
  }

  function amountPrompt({ title, body, value }) {
    return openModal(`<h2>${esc(title)}</h2><p>${body}</p>
      <div class="field" style="margin-top:16px"><label class="label" for="mAmount">${t('form.amountIn', { c: esc(currencySymbol()) })}</label>
      <input class="input num" id="mAmount" inputmode="decimal" autocomplete="off" placeholder="0" value="${value ? esc(centsToInput(value)) : ''}" aria-describedby="mErr">
      <p class="error" id="mErr" role="alert"></p></div>
      <div class="actions">${value ? `<button class="btn btn-danger" type="button" data-close="clear">${t('act.remove')}</button>` : ''}<button class="btn" type="button" data-close="cancel">${t('act.cancel')}</button><button class="btn btn-primary" type="submit" value="ok">${t('act.save')}</button></div>`, {
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
    const shownName = editing ? catName(cat) : '';
    const res = await openModal(`<h2>${editing ? t('cat.edit') : t('cat.new')}</h2>
      ${editing ? '' : `<div class="segmented" role="radiogroup" aria-label="${esc(t('form.type'))}" style="margin:12px 0 4px">
        <button type="button" role="radio" data-type="expense" aria-checked="true">${t('type.expense')}</button><button type="button" role="radio" data-type="income" aria-checked="false">${t('type.income')}</button></div>`}
      <div class="field" style="margin-top:14px"><label class="label" for="cName">${t('cat.name')}</label>
        <input class="input" id="cName" maxlength="24" autocomplete="off" value="${esc(shownName)}" placeholder="${esc(t('cat.namePh'))}" aria-describedby="cErr"><p class="error" id="cErr" role="alert"></p></div>
      <div class="field"><span class="label" id="lblIcon">${t('cat.icon')}</span><div class="icon-pick" role="radiogroup" aria-labelledby="lblIcon">
        ${ICONS.map((ic) => `<button type="button" role="radio" data-icon="${ic}" aria-checked="${ic === st.icon}" aria-label="${ic}">${icon('c-' + ic, 'i i-sm')}</button>`).join('')}</div></div>
      <div class="field"><span class="label" id="lblColor">${t('cat.color')}</span><div class="swatches" role="radiogroup" aria-labelledby="lblColor">
        ${PALETTE.map((c) => `<button type="button" class="swatch" role="radio" data-color="${c}" style="--c:${c}" aria-checked="${c.toLowerCase() === st.color.toLowerCase()}" aria-label="${esc(t('cat.color'))} ${c}"></button>`).join('')}</div></div>
      <div class="actions">${editing && !isFallback ? `<button class="btn btn-danger" type="button" data-close="delete">${icon('i-trash', 'i i-sm')}${t('act.delete')}</button>` : ''}
        <button class="btn" type="button" data-close="cancel">${t('act.cancel')}</button><button class="btn btn-primary" type="submit" value="ok">${t('act.save')}</button></div>`, {
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
        if (!name) { err.textContent = t('cat.errName'); input.setAttribute('aria-invalid', 'true'); input.focus(); return false; }
        const lower = name.toLocaleLowerCase(locale());
        if (S.categories.some((c) => c.type === type && c.id !== cat?.id && catName(c).toLocaleLowerCase(locale()) === lower)) {
          err.textContent = t(type === 'income' ? 'cat.errDupIncome' : 'cat.errDupExpense', { c: name }); input.setAttribute('aria-invalid', 'true'); input.focus(); return false;
        }
        return { name, type, icon: st.icon, color: st.color };
      },
    });
    if (!res) return;
    if (res === 'delete') return deleteCategory(cat);
    if (editing) {
      // Renaming a built-in category pins the user's name; otherwise it keeps following the UI language.
      if (res.name !== shownName) Object.assign(cat, { name: res.name, custom: true });
      Object.assign(cat, { icon: res.icon, color: res.color });
    } else S.categories.push({ id: 'c_' + uid().slice(0, 8), ...res, custom: true });
    save();
    render();
    toast(editing ? t('cat.updated') : t('cat.added', { c: res.name }));
  }

  async function deleteCategory(cat) {
    const n = S.txns.filter((x) => x.categoryId === cat.id).length;
    const fb = FALLBACK[cat.type];
    const ok = await confirmBox({ title: t('cat.delTitle', { c: catName(cat) }), body: n ? tn('cat.delMove', n, { c: esc(catName(catById(fb))) }) : t('cat.delEmpty'), ok: t('act.delete'), danger: true });
    if (!ok) return;
    for (const x of S.txns) if (x.categoryId === cat.id) x.categoryId = fb;
    for (const r of S.recurring) if (r.categoryId === cat.id) r.categoryId = fb;
    delete S.budgets.byCat[cat.id];
    S.categories = S.categories.filter((c) => c.id !== cat.id);
    if (ui.cat === cat.id) ui.cat = 'all';
    save();
    render();
    toast(t('cat.deleted', { c: catName(cat) }));
  }

  /* =========================================================
     Transaction sheet
     ========================================================= */
  const sheet = $('#txnSheet');
  let sheetState = null;

  /** Recent distinct notes for a category, offered as autocomplete suggestions. */
  function noteSuggestions(categoryId) {
    const seen = new Set();
    for (const x of S.txns.slice().sort(sortTx)) {
      if (x.categoryId === categoryId && x.note && !seen.has(x.note)) seen.add(x.note);
      if (seen.size >= 8) break;
    }
    return [...seen];
  }

  function repeatHint(freq, date) {
    if (freq === 'none' || !isValidYmd(date)) return '';
    const d = parseYmd(date);
    const rule = { freq, day: d.getDate(), start: date };
    const next = nextOccurrence(rule, date);
    const when = freq === 'weekly' ? cap(dtf({ weekday: 'long' }).format(d))
      : freq === 'monthly' ? (lang === 'fr' && d.getDate() === 1 ? '1er' : String(d.getDate()))
      : dtf({ day: 'numeric', month: 'long' }).format(d);
    return t('rep.hint.' + freq, { w: esc(when), n: esc(dayLabel(next)) });
  }

  function openSheet(txn = null, preset = null) {
    if (sheet.open) return;
    const editing = !!txn;
    const type = txn?.type || preset?.type || 'expense';
    const lastCat = S.settings.lastCat?.[type];
    const st = {
      editing, id: txn?.id || null, type, repeat: 'none',
      categoryId: txn?.categoryId || preset?.categoryId || (catsOf(type).some((c) => c.id === lastCat) ? lastCat : catsOf(type)[0]?.id),
      recurringId: txn?.recurringId || null,
    };
    sheetState = st;
    const rule = st.recurringId ? S.recurring.find((r) => r.id === st.recurringId) : null;
    const defaultDate = !editing && ui.month !== curMonth() ? `${ui.month}-01` : today();
    const td = today(), yd = addDays(td, -1);

    sheet.innerHTML = `<form class="sheet-inner" novalidate>
      <div class="grabber" aria-hidden="true"></div>
      <div class="sheet-head"><h2 id="sheetTitle">${editing ? t('form.editTitle') : t('form.newTitle')}</h2>
        <button class="icon-btn" type="button" data-sheet="close" aria-label="${esc(t('act.close'))}">${icon('i-x')}</button></div>
      <div class="segmented type-switch" role="radiogroup" aria-label="${esc(t('form.type'))}">
        <button type="button" role="radio" data-type="expense" aria-checked="${type === 'expense'}">${icon('i-up', 'i i-sm')}${t('type.expense')}</button>
        <button type="button" role="radio" data-type="income" aria-checked="${type === 'income'}">${icon('i-down', 'i i-sm')}${t('type.income')}</button>
      </div>
      <div class="amount-field">
        <label class="sr-only" for="fAmount">${t('form.amount')}</label>
        <div class="amount-wrap"><span class="cur" aria-hidden="true">${esc(currencySymbol())}</span>
          <input class="amount-input num" id="fAmount" name="amount" inputmode="decimal" autocomplete="off" enterkeyhint="done" placeholder="0" value="${txn ? esc(centsToInput(txn.amount)) : ''}" aria-describedby="fAmountErr fAmountHelp"></div>
        <div class="amount-line"></div>
        <p class="error" id="fAmountErr" role="alert"></p>
        <p class="help" id="fAmountHelp">${t('form.mathTip')}</p>
      </div>
      <div class="field"><span class="label" id="lblCat">${t('form.category')}</span>
        <div class="cat-picker" id="catPicker" role="radiogroup" aria-labelledby="lblCat"></div></div>
      <div class="field">
        <label class="label" for="fNote">${t('form.note')} <span class="faint">${t('form.optional')}</span></label>
        <input class="input" id="fNote" name="note" maxlength="${NOTE_MAX}" autocomplete="off" list="noteSugg" placeholder="${esc(t('form.notePh'))}" value="${esc(txn?.note || '')}">
        <datalist id="noteSugg"></datalist>
      </div>
      <div class="field">
        <label class="label" for="fDate">${t('form.date')}</label>
        <div class="date-row">
          <div class="chips date-chips" role="group" aria-label="${esc(t('form.quickDates'))}">
            <button class="chip" type="button" data-date="${td}">${t('day.today')}</button>
            <button class="chip" type="button" data-date="${yd}">${t('day.yesterday')}</button>
          </div>
          <div class="date-input-wrap">${icon('i-calendar', 'i i-sm')}<input class="input date-input" id="fDate" name="date" type="date" required value="${txn?.date || defaultDate}" min="1900-01-01" max="2999-12-31" aria-describedby="fDateErr"></div>
        </div>
        <p class="error" id="fDateErr" role="alert"></p>
      </div>
      ${editing ? (rule ? `<div class="series-note">${icon('i-repeat')}<span>${t(rule.active ? 'form.seriesNote' : 'form.seriesNotePaused', { f: t('freq.' + rule.freq).toLowerCase() })}</span></div>` : '') : `
      <div class="field">
        <span class="label" id="lblRepeat">${t('form.repeat')}</span>
        <div class="segmented repeat-switch" role="radiogroup" aria-labelledby="lblRepeat">
          ${['none', 'weekly', 'monthly', 'yearly'].map((f) => `<button type="button" role="radio" data-repeat="${f}" aria-checked="${f === 'none'}">${t('rep.' + f)}</button>`).join('')}
        </div>
        <p class="help repeat-hint" id="repeatHint" aria-live="polite"></p>
      </div>`}
      <div class="sheet-actions">
        ${editing ? `<button class="btn btn-danger" type="button" data-sheet="delete" aria-label="${esc(t('form.deleteTx'))}">${icon('i-trash')}</button>` : ''}
        <button class="btn btn-primary" type="submit" id="saveBtn"></button>
      </div>
    </form>`;

    const form = sheet.firstElementChild;
    const amt = form.fAmount;
    const saveBtn = $('#saveBtn', form);
    renderCatPicker();
    refresh();
    st.initial = snapshot(form);

    form.addEventListener('submit', (e) => { e.preventDefault(); submitSheet(form); });
    form.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.type && b.dataset.type !== st.type) {
        st.type = b.dataset.type;
        $$('.type-switch [data-type]', form).forEach((x) => x.setAttribute('aria-checked', x === b));
        const lc = S.settings.lastCat?.[st.type];
        st.categoryId = catsOf(st.type).some((c) => c.id === lc) ? lc : catsOf(st.type)[0]?.id;
        renderCatPicker();
        refresh();
      } else if (b.dataset.cat) {
        st.categoryId = b.dataset.cat;
        $$('[data-cat]', form).forEach((x) => { x.setAttribute('aria-checked', x === b); x.tabIndex = x === b ? 0 : -1; });
        fillNotes();
      } else if (b.dataset.date) {
        form.fDate.value = b.dataset.date;
        form.fDate.removeAttribute('aria-invalid');
        $('#fDateErr').textContent = '';
        refresh();
      } else if (b.dataset.repeat) {
        st.repeat = b.dataset.repeat;
        $$('[data-repeat]', form).forEach((x) => x.setAttribute('aria-checked', x === b));
        refresh();
      } else if (b.dataset.sheet === 'close') {
        requestCloseSheet();
      } else if (b.dataset.sheet === 'delete') {
        const x = S.txns.find((y) => y.id === st.id);
        sheet.close();
        if (x) deleteTx(x);
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
    form.fDate.addEventListener('change', () => { form.fDate.removeAttribute('aria-invalid'); $('#fDateErr').textContent = ''; refresh(); });

    const fit = () => { amt.style.width = `${Math.max(1, amt.value.length || 1) + 0.6}ch`; };
    fit();
    $('.amount-field', form).addEventListener('click', (e) => { if (e.target !== amt) amt.focus(); });
    amt.addEventListener('input', () => {
      fit();
      const r = parseAmount(amt.value);
      amt.removeAttribute('aria-invalid');
      $('#fAmountErr').textContent = '';
      $('#fAmountHelp').textContent = !r.error && r.isExpr ? `= ${money(r.cents)}` : t('form.mathTip');
      refresh();
    });
    amt.addEventListener('blur', () => {
      const r = parseAmount(amt.value);
      if (!r.error && r.isExpr) { amt.value = centsToInput(r.cents); fit(); $('#fAmountHelp').textContent = t('form.mathTip'); }
    });

    sheet.showModal();
    if (editing) form.querySelector('.sheet-head .icon-btn').focus({ preventScroll: true });
    else if (matchMedia('(pointer: fine)').matches) amt.focus();
    else { form.querySelector('.sheet-head .icon-btn').focus({ preventScroll: true }); setTimeout(() => amt.focus(), 320); }

    function renderCatPicker() {
      $('#catPicker', form).innerHTML = catsOf(st.type).map((c) => `<button type="button" class="cat-opt" role="radio" data-cat="${esc(c.id)}" style="--c:${c.color}" aria-checked="${c.id === st.categoryId}" tabindex="${c.id === st.categoryId ? 0 : -1}">${badge(c)}<span>${esc(catName(c))}</span></button>`).join('');
      fillNotes();
    }
    function fillNotes() {
      $('#noteSugg', form).innerHTML = noteSuggestions(st.categoryId).map((n) => `<option value="${esc(n)}"></option>`).join('');
    }
    /** Keep the save label, date chips and repeat hint in sync with the form. */
    function refresh() {
      const r = parseAmount(amt.value);
      const label = editing ? t('form.saveChanges') : t(st.type === 'income' ? 'form.addIncome' : 'form.addExpense');
      saveBtn.textContent = !r.error && !editing ? `${label} · ${money(r.cents)}` : label;
      for (const c of $$('[data-date]', form)) c.setAttribute('aria-pressed', c.dataset.date === form.fDate.value);
      const hint = $('#repeatHint', form);
      if (hint) hint.innerHTML = repeatHint(st.repeat, form.fDate.value);
    }
  }

  const snapshot = (form) => JSON.stringify([sheetState.type, sheetState.categoryId, sheetState.repeat, form.fAmount.value, form.fNote.value, form.fDate.value]);
  const sheetDirty = () => sheet.open && sheetState && snapshot(sheet.firstElementChild) !== sheetState.initial;

  async function requestCloseSheet() {
    if (sheetDirty()) {
      const ok = await confirmBox({ title: t('form.discardT'), body: t('form.discardB'), ok: t('form.discard'), danger: true });
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
      $('#fDateErr').textContent = t('form.errDate');
      form.fDate.setAttribute('aria-invalid', 'true');
      if (!bad) form.fDate.focus();
      bad = true;
    }
    if (!st.categoryId || !S.categories.some((c) => c.id === st.categoryId && c.type === st.type)) st.categoryId = FALLBACK[st.type];
    if (bad) { haptic(30); return; }

    const note = form.fNote.value.trim().replace(/\s+/g, ' ').slice(0, NOTE_MAX);
    const firstEver = !S.txns.length;
    S.settings.lastCat = { ...S.settings.lastCat, [st.type]: st.categoryId };
    let txn;
    if (st.editing) {
      txn = S.txns.find((x) => x.id === st.id);
      if (!txn) { sheet.close(); toast(t('toast.gone'), { error: true }); return; }
      Object.assign(txn, { type: st.type, amount: amtR.cents, categoryId: st.categoryId, note, date });
    } else {
      txn = { id: uid(), type: st.type, amount: amtR.cents, categoryId: st.categoryId, note, date, createdAt: Date.now() };
      if (st.repeat !== 'none') {
        const rule = { id: uid(), type: st.type, amount: amtR.cents, categoryId: st.categoryId, note, freq: st.repeat, start: date, day: parseYmd(date).getDate(), active: true };
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
    let msg = st.editing ? t('toast.saved') : t(st.type === 'income' ? 'toast.addedIncome' : 'toast.addedExpense', { a: money(amtR.cents) });
    if (backfilled) msg += ' ' + tn('toast.backfill', backfilled);
    if (monthOf(date) !== ui.month && ROUTES[ui.route].month) {
      toast(`${msg} — ${monthName(monthOf(date))}`, { action: { label: t('act.view'), fn: () => { ui.month = monthOf(date); render(); } } });
    } else toast(msg);
    if (firstEver && !S.settings.tips.editHint) {
      S.settings.tips.editHint = true; save();
      setTimeout(() => toast(t('toast.editHint'), { timeout: 6000 }), 900);
    }
  }

  function deleteTx(x) {
    const idx = S.txns.indexOf(x);
    if (idx === -1) return;
    S.txns.splice(idx, 1);
    save();
    render();
    toast(t('toast.deleted'), {
      action: { label: t('act.undo'), fn: () => { if (!S.txns.some((y) => y.id === x.id)) { S.txns.push(x); save(); render(); toast(t('toast.restored')); } } },
    });
  }

  /* =========================================================
     Currency conversion
     ========================================================= */
  const RATE_API = 'https://open.er-api.com/v6/latest/';

  /** Rate for 1 `from` in `to`, derived from any cached table (cross rates work for any base). */
  function cachedRate(from, to) {
    const c = readJSON(RATES_KEY) || readJSON('orbit.rates');
    if (!c?.rates) return null;
    const f = from === c.base ? 1 : c.rates[from];
    const tt = to === c.base ? 1 : c.rates[to];
    return f > 0 && tt > 0 ? { rate: tt / f, time: c.time, source: 'cache' } : null;
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

  const countAmounts = () => S.txns.length + S.recurring.length + Object.keys(S.budgets.byCat).length + (S.budgets.total ? 1 : 0);

  async function changeCurrency(next, select) {
    const prev = S.settings.currency;
    if (next === prev || !isCurrency(next)) return;
    const n = countAmounts();
    const apply = (rate) => {
      const snap = JSON.stringify(S);
      S.settings.currency = next;
      fmtCache = {};
      if (rate) {
        const d = currencyDigits();
        const conv = (c) => convertCents(c, rate, d);
        for (const x of S.txns) x.amount = conv(x.amount);
        for (const r of S.recurring) r.amount = conv(r.amount);
        if (S.budgets.total) S.budgets.total = conv(S.budgets.total);
        for (const k of Object.keys(S.budgets.byCat)) S.budgets.byCat[k] = conv(S.budgets.byCat[k]);
      }
      save(); render();
      if (!n) return toast(t('cur.set', { c: next }));
      toast(rate ? tn('cur.converted', n, { c: next }) : t('cur.labelOnly', { c: next }), {
        action: { label: t('act.undo'), fn: () => { S = sanitize(JSON.parse(snap)); fmtCache = {}; save(); render(); toast(t('cur.back', { c: prev })); } },
      });
    };
    if (!n) return apply(null);

    const label = (c) => `${c} (${esc(currencyName(c))})`;
    const res = await openModal(`<h2>${t('cur.title', { c: esc(next) })}</h2>
      <p>${tn('cur.body', n, { a: label(prev), b: label(next) })}</p>
      <div class="field" style="margin-top:16px"><label class="label" for="mRate">${t('cur.rate')}</label>
        <div class="rate-row"><span class="num">1 ${esc(prev)} =</span><input class="input num" id="mRate" inputmode="decimal" autocomplete="off" placeholder="${esc(t('cur.loading'))}" aria-describedby="mRateHelp mErr"><span class="num">${esc(next)}</span></div>
        <p class="help" id="mRateHelp" aria-live="polite">${t('cur.fetching')}</p>
        <p class="error" id="mErr" role="alert"></p></div>
      <div class="actions"><button class="btn" type="button" data-close="cancel">${t('act.cancel')}</button><button class="btn" type="button" data-close="display">${t('cur.labelBtn')}</button>
        <button class="btn btn-primary" type="submit" value="ok">${t('cur.convert')}</button></div>`, {
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
          help.textContent = t(r.source === 'live' ? 'cur.live' : 'cur.cached', { w: when });
        } else {
          help.textContent = t('cur.manual');
          input.placeholder = '0.92';
          input.focus();
        }
      },
      onSubmit: (f) => {
        const input = f.querySelector('#mRate');
        const rate = parseRate(input.value);
        if (!rate) { f.querySelector('#mErr').textContent = t('cur.errRate'); input.setAttribute('aria-invalid', 'true'); input.focus(); return false; }
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
    const rows = [[t('csv.date'), t('csv.type'), t('csv.category'), t('csv.amount'), t('csv.currency'), t('csv.note'), t('csv.recurring')]];
    for (const x of S.txns.slice().sort(sortTx)) {
      rows.push([x.date, t(x.type === 'income' ? 'type.income' : 'type.expense'), catName(catById(x.categoryId)), (x.amount / 100).toFixed(2), S.settings.currency, x.note, x.recurringId ? t('csv.yes') : '']);
    }
    // Amount column is numeric and may legitimately be plain digits; only text cells are guarded.
    const csv = rows.map((r) => r.map((v, i) => (i === 3 ? v : csvCell(v))).join(',')).join('\r\n');
    download(`yaje-transactions-${today()}.csv`, '﻿' + csv, 'text/csv;charset=utf-8');
    toast(tn('toast.exported', S.txns.length));
  }
  function exportJson() {
    download(`yaje-backup-${today()}.json`, JSON.stringify({ app: 'yaje', exportedAt: new Date().toISOString(), ...S }, null, 2), 'application/json');
    toast(t('toast.backup'));
  }
  async function importFile(file) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) return toast(t('imp.tooBig'), { error: true });
    let data;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed || (!Array.isArray(parsed.txns) && !Array.isArray(parsed.categories))) throw new Error('shape');
      data = sanitize(parsed);
    } catch {
      return toast(t('imp.bad'), { error: true, timeout: 6000 });
    }
    const ok = await confirmBox({ title: t('imp.title'), body: t('imp.body', { a: tn('n.tx', S.txns.length), b: tn('n.tx', data.txns.length) }), ok: t('set.restoreBtn'), danger: true });
    if (!ok) return;
    S = data;
    lang = S.settings.lang;
    fmtCache = {};
    runRecurring();
    save();
    applyTheme();
    applyStaticText();
    render();
    toast(tn('imp.done', S.txns.length));
  }

  /* =========================================================
     Demo data
     ========================================================= */
  const DEMO_NOTES = {
    en: {
      rules: ['Salary', 'Rent', 'Netflix', 'Spotify', 'Internet', 'Gym membership'],
      food: ['Sushi night', 'Lunch with team', 'Pizza', 'Brunch', 'Thai takeaway', 'Burger joint', ''],
      groceries: ['Weekly groceries', 'Farmers market', 'Supermarket', ''],
      transport: ['Taxi', 'Bus pass top-up', 'Fuel', 'Parking', ''],
      shopping: ['New sneakers', 'Headphones', 'Book store', 'Home decor', ''],
      fun: ['Cinema', 'Concert tickets', 'Bowling', ''],
      coffee: ['Flat white', 'Latte', 'Cold brew', ''],
      health: ['Pharmacy', 'Vitamins'],
      bills: 'Electricity',
      freelance: ['Logo design', 'Website fix', 'Consulting call'],
      travel: 'Weekend trip',
    },
    fr: {
      rules: ['Salaire', 'Loyer', 'Netflix', 'Spotify', 'Internet', 'Abonnement salle de sport'],
      food: ['Soirée sushi', 'Déjeuner d’équipe', 'Pizza', 'Brunch', 'Plat à emporter', 'Burger', ''],
      groceries: ['Courses de la semaine', 'Marché', 'Supermarché', ''],
      transport: ['Taxi', 'Recharge carte bus', 'Carburant', 'Parking', ''],
      shopping: ['Nouvelles baskets', 'Écouteurs', 'Librairie', 'Déco maison', ''],
      fun: ['Cinéma', 'Billets de concert', 'Bowling', ''],
      coffee: ['Café crème', 'Latte', 'Café glacé', ''],
      health: ['Pharmacie', 'Vitamines'],
      bills: 'Électricité',
      freelance: ['Création de logo', 'Correction de site web', 'Consultation'],
      travel: 'Week-end en voyage',
    },
  };

  function buildDemo() {
    let seed = 42;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const scale = DEMO_SCALE[S.settings.currency] || 1;
    const N = DEMO_NOTES[lang];
    // Values are written in USD-like units, then scaled; large-unit currencies round to whole tens.
    const cents = (v) => {
      const x = v * scale;
      return scale >= 100 ? Math.max(1, Math.round(x / 10)) * 1000 : Math.max(1, Math.round(x * 100));
    };
    const data = defaults();
    data.settings = { ...S.settings };
    const add = (date, type, categoryId, value, note) => data.txns.push({ id: uid(), type, amount: cents(value), categoryId, note, date, createdAt: Date.now() });
    const td = today();
    const start = `${addMonths(curMonth(), -3)}-01`;
    const rules = [
      { type: 'income', categoryId: 'salary', amount: 4200, freq: 'monthly', day: 1 },
      { type: 'expense', categoryId: 'housing', amount: 1350, freq: 'monthly', day: 2 },
      { type: 'expense', categoryId: 'subscriptions', amount: 15.49, freq: 'monthly', day: 9 },
      { type: 'expense', categoryId: 'subscriptions', amount: 10.99, freq: 'monthly', day: 14 },
      { type: 'expense', categoryId: 'bills', amount: 64.2, freq: 'monthly', day: 18 },
      { type: 'expense', categoryId: 'health', amount: 39, freq: 'monthly', day: 5 },
    ].map((r, i) => ({ id: uid(), ...r, note: N.rules[i], amount: cents(r.amount), start: `${start.slice(0, 7)}-${pad(r.day)}`, active: true }));
    data.recurring = rules.map((r) => ({ ...r, next: r.start }));

    const pick = (a) => a[Math.floor(rnd() * a.length)];
    for (let d = start; d <= td; d = addDays(d, 1)) {
      const dow = parseYmd(d).getDay();
      if (rnd() < 0.55) add(d, 'expense', 'coffee', 3 + rnd() * 3, pick(N.coffee));
      if (rnd() < 0.42) add(d, 'expense', 'food', 9 + rnd() * 38, pick(N.food));
      if (dow === 6 || rnd() < 0.06) add(d, 'expense', 'groceries', 45 + rnd() * 90, pick(N.groceries));
      if (rnd() < 0.3) add(d, 'expense', 'transport', 4 + rnd() * 22, pick(N.transport));
      if (rnd() < 0.09) add(d, 'expense', 'shopping', 20 + rnd() * 130, pick(N.shopping));
      if ((dow === 5 || dow === 6) && rnd() < 0.35) add(d, 'expense', 'fun', 12 + rnd() * 55, pick(N.fun));
      if (rnd() < 0.03) add(d, 'expense', 'health', 8 + rnd() * 40, pick(N.health));
      if (Number(d.slice(8)) === 22) add(d, 'expense', 'bills', 70 + rnd() * 50, N.bills);
      if (rnd() < 0.04) add(d, 'income', 'freelance', 150 + rnd() * 600, pick(N.freelance));
    }
    add(addDays(td, -40), 'expense', 'travel', 280, N.travel);
    data.budgets = { total: cents(3200), byCat: { food: cents(380), coffee: cents(90), groceries: cents(420), transport: cents(180), shopping: cents(250), fun: cents(160) } };
    data.txns = data.txns.filter((x) => x.date >= start);
    return data;
  }

  async function loadDemo() {
    if (S.txns.length) {
      const ok = await confirmBox({ title: t('demo.title'), body: tn('demo.body', S.txns.length), ok: t('set.demoBtn'), danger: true });
      if (!ok) return;
    }
    S = buildDemo();
    runRecurring();
    save();
    ui.month = curMonth();
    if (location.hash !== '#/home') location.hash = '#/home';
    render();
    toast(tn('demo.loaded', S.txns.length));
  }

  /* =========================================================
     Theme
     ========================================================= */
  const mqlLight = matchMedia('(prefers-color-scheme: light)');
  function applyTheme() {
    const pref = S.settings.theme;
    const th = pref === 'system' ? (mqlLight.matches ? 'light' : 'dark') : pref;
    document.documentElement.dataset.theme = th;
    $('meta[name="theme-color"]').setAttribute('content', th === 'light' ? '#F2F4FA' : '#06070D');
  }
  mqlLight.addEventListener?.('change', () => { if (S.settings.theme === 'system') applyTheme(); });

  /* =========================================================
     Install to home screen
     Browsers never allow silent installation: Chromium needs the user to confirm the native
     prompt, and iOS has no API at all (Share → Add to Home Screen). So we invite on first visit,
     then confirm with a "Yaje has been added" popup once it's installed.
     ========================================================= */
  const installState = () => readJSON(INSTALL_KEY) || {};
  const setInstallState = (patch) => { try { localStorage.setItem(INSTALL_KEY, JSON.stringify({ ...installState(), ...patch })); } catch { /* optional */ } };
  const INVITE_SNOOZE = 3 * 24 * 60 * 60 * 1000;

  async function showInstallInvite({ force = false } = {}) {
    if (isStandalone()) return;
    const ios = isIOS();
    if (!ios && !installPrompt) return;
    const s = installState();
    if (!force && (s.installed || (s.dismissedAt && Date.now() - s.dismissedAt < INVITE_SNOOZE))) return;
    if (modalEl.open || sheet.open) { setTimeout(() => showInstallInvite({ force }), 4000); return; }

    const perks = ['install.p1', 'install.p2', 'install.p3'].map((k) => `<li>${icon('i-check', 'i i-sm')}${t(k)}</li>`).join('');
    const iosSteps = `<ol class="ios-steps">
      <li><span class="step-n">1</span><span>${t('install.ios1', { s: `<span class="ios-share" aria-label="${esc(t('install.share'))}">${icon('i-share', 'i i-sm')}</span>` })}</span></li>
      <li><span class="step-n">2</span><span>${t('install.ios2')}</span></li>
      <li><span class="step-n">3</span><span>${t('install.ios3')}</span></li></ol>`;
    const res = await openModal(`
      <div class="install-head"><img class="install-icon" src="icons/icon-192.png" alt="" width="72" height="72"><h2>${t('install.title')}</h2><p>${t('install.body')}</p></div>
      ${ios ? iosSteps : `<ul class="install-perks">${perks}</ul>`}
      <div class="actions"><button class="btn" type="button" data-close="cancel">${t('install.continue')}</button>
        <button class="btn btn-primary" type="submit" value="ok" autofocus>${ios ? t('install.gotIt') : t('install.add')}</button></div>`, { cls: 'install-modal' });

    if (res !== true) { setInstallState({ dismissedAt: Date.now() }); return; }
    if (ios) { setInstallState({ dismissedAt: Date.now() }); return; } // confirmation shows on first launch from the home screen
    const p = installPrompt;
    if (!p) return;
    try {
      p.prompt();
      const { outcome } = await p.userChoice;
      installPrompt = null;
      if (outcome === 'accepted') { setInstallState({ installed: true }); showInstalled(); } else setInstallState({ dismissedAt: Date.now() });
    } catch { /* prompt can only be used once */ }
    if (ui.route === 'settings') render();
  }

  async function showInstalled() {
    if (installState().welcomed) return;
    setInstallState({ installed: true, welcomed: true });
    if (modalEl.open) closeModal(null);
    haptic(20);
    await openModal(`
      <div class="install-head success"><div class="install-icon-wrap"><img class="install-icon" src="icons/icon-192.png" alt="" width="72" height="72"><span class="install-tick">${icon('i-check')}</span></div>
        <h2>${t('installed.title')}</h2><p>${t(isStandalone() ? 'installed.bodyApp' : 'installed.body')}</p></div>
      <div class="actions"><button class="btn" type="button" data-close="cancel">${t('installed.continue')}</button><button class="btn btn-primary" type="submit" value="ok" autofocus>${t('common.ok')}</button></div>`, { cls: 'install-modal' });
  }

  /* =========================================================
     Actions & events
     ========================================================= */
  const actions = {
    add: () => openSheet(),
    'quick-add': (el) => { const c = S.categories.find((x) => x.id === el.dataset.cat); if (c) openSheet(null, { type: c.type, categoryId: c.id }); },
    'edit-tx': (el) => { const x = S.txns.find((y) => y.id === el.dataset.id); if (x) openSheet(x); },
    'month-prev': () => { ui.month = addMonths(ui.month, -1); ui.selDay = null; render(); },
    'month-next': () => { ui.month = addMonths(ui.month, 1); ui.selDay = null; render(); },
    'month-today': () => { if (ui.month !== curMonth()) { ui.month = curMonth(); ui.selDay = null; render(); } },
    'filter-type': (el) => { ui.type = el.dataset.type; render(); },
    'toggle-alltime': () => { ui.allTime = !ui.allTime; render(); },
    'clear-search': () => { ui.q = ''; const q = $('#q'); q.value = ''; q.focus(); $('[data-action="clear-search"]').hidden = true; renderActivityList(); },
    'reset-filters': () => { ui.q = ''; ui.type = 'all'; ui.cat = 'all'; render(); },
    'set-lang': (el) => setLang(el.dataset.lang),
    bar: (el) => {
      ui.selDay = ui.selDay === el.dataset.day ? null : el.dataset.day;
      $$('.bars .b').forEach((b) => b.classList.toggle('sel', b.dataset.day === ui.selDay));
      const ro = $('#barReadout');
      if (ro && ui.selDay) ro.innerHTML = `<span class="muted small">${esc(dayLabel(ui.selDay, { relative: false }))}</span><span class="num">${money(Number(el.dataset.v))}</span>`;
      else render();
    },
    'set-budget': async () => {
      const v = await amountPrompt({ title: t('bud.monthly'), body: t('bud.promptBody'), value: S.budgets.total });
      if (v === null || v === undefined) return;
      S.budgets.total = v === 'clear' ? null : v;
      save(); render();
      toast(v === 'clear' ? t('bud.removed') : t('bud.setTo', { a: money(v) }));
    },
    'set-cat-budget': async (el) => {
      const c = catById(el.dataset.id);
      const cn = catName(c);
      const v = await amountPrompt({ title: t('bud.limitTitle', { c: cn }), body: t('bud.limitBody', { c: esc(cn) }), value: S.budgets.byCat[c.id] });
      if (v === null || v === undefined) return;
      if (v === 'clear') delete S.budgets.byCat[c.id]; else S.budgets.byCat[c.id] = v;
      save(); render();
      toast(v === 'clear' ? t('bud.limitRemoved', { c: cn }) : t('bud.limitSet', { c: cn, a: money(v) }));
    },
    'rule-toggle': (el) => {
      const r = S.recurring.find((x) => x.id === el.dataset.id);
      if (!r) return;
      r.active = !r.active;
      if (r.active) { const td = today(); let g = 0; while (r.next < td && g++ < 1000) r.next = nextOccurrence(r, r.next); }
      const n = runRecurring();
      save(); render();
      toast(r.active ? (n ? tn('bud.resumedN', n) : t('bud.resumed')) : t('bud.pausedToast'));
    },
    'rule-delete': async (el) => {
      const r = S.recurring.find((x) => x.id === el.dataset.id);
      if (!r) return;
      const ok = await confirmBox({ title: t('bud.stopTitle'), body: t('bud.stopBody'), ok: t('bud.stopBtn'), danger: true });
      if (!ok) return;
      S.recurring = S.recurring.filter((x) => x !== r);
      for (const x of S.txns) if (x.recurringId === r.id) delete x.recurringId;
      save(); render();
      toast(t('bud.ruleRemoved'));
    },
    'cat-add': () => categoryEditor(null),
    'cat-edit': (el) => { const c = S.categories.find((x) => x.id === el.dataset.id); if (c) categoryEditor(c); },
    'export-csv': exportCsv,
    'export-json': exportJson,
    import: () => { const f = $('#importFile'); f.value = ''; f.click(); },
    demo: loadDemo,
    erase: async () => {
      const ok = await confirmBox({ title: t('erase.title'), body: t('erase.body'), ok: t('erase.btn'), danger: true });
      if (!ok) return;
      const keep = { currency: S.settings.currency, theme: S.settings.theme, lang: S.settings.lang, lastCat: {}, tips: {} };
      S = defaults();
      S.settings = keep;
      save(); render();
      toast(t('erase.done'));
    },
    install: () => showInstallInvite({ force: true }),
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
    const el = e.target;
    if (el.id === 'catFilter') { ui.cat = el.value; renderActivityList(); }
    if (el.id === 'setTheme') { S.settings.theme = el.value; save(); applyTheme(); }
    if (el.id === 'setCurrency' || el.id === 'welcomeCurrency') changeCurrency(el.value, el);
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
    S = load(); lang = S.settings.lang; fmtCache = {}; applyTheme(); applyStaticText();
    if (!sheet.open && !modalEl.open) render();
  });

  // New day / app resumed: log due recurring items and refresh relative labels
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const added = runRecurring();
    const td = today();
    if (td !== ui.lastDay) { if (ui.month === monthOf(ui.lastDay)) ui.month = monthOf(td); ui.lastDay = td; }
    if (!sheet.open && !modalEl.open) render();
    if (added) toast(tn('toast.logged', added));
  });

  window.addEventListener('offline', () => toast(t('toast.offline')));

  /* =========================================================
     PWA: service worker & install events
     ========================================================= */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    if (ui.route === 'settings') render();
    setTimeout(() => showInstallInvite(), 1500);
  });
  window.addEventListener('appinstalled', () => { installPrompt = null; showInstalled(); if (ui.route === 'settings') render(); });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('sw.js');
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) location.reload(); });
        const prompt = (w) => toast(t('toast.update'), {
          timeout: 15000,
          action: { label: t('act.update'), fn: () => { reloading = true; w.postMessage('skipWaiting'); } },
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
  applyStaticText();
  const added = runRecurring();
  try { if (!localStorage.getItem(STORE_KEY) && S.txns.length) save(); } catch { /* storage unavailable */ } // finish migrating legacy data
  route(true);
  if (added) toast(tn('toast.logged', added));
  if (loadError) toast(t('err.corrupt'), { error: true, timeout: 7000 });
  if (storageBroken) toast(t('err.storageOff'), { error: true, timeout: 7000 });
  const params = new URLSearchParams(location.search);
  if (params.get('action') === 'add') {
    history.replaceState(null, '', location.pathname + location.hash);
    openSheet();
  }
  // First launch from the home screen: confirm the install (the only signal iOS gives us).
  if (isStandalone()) setTimeout(showInstalled, 600);
  else if (isIOS()) setTimeout(() => showInstallInvite(), 1500);

  // Exposed for automated QA only.
  window.__yaje = { parseAmount, nextOccurrence, sanitize, t, tn, get state() { return S; }, ui, showInstallInvite, showInstalled };
})();
