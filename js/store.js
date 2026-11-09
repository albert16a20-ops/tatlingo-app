// Хранение прогресса: localStorage на устройстве + облако Telegram (CloudStorage),
// чтобы прогресс был один и тот же на телефоне и компьютере.
import { Hearts } from './logic.js';

const KEY = 'tatlingo_state_v1';
const tg = window.Telegram && window.Telegram.WebApp;

function fresh() {
  return {
    updatedAt: 0,
    settings: {
      onboardingDone: false, goal: 10, startLevel: 'beginner', courseLevel: '',
      sound: true, theme: 'light', female: false,
      cap: 0, treatsEaten: 0, lastCare: 0, bonusTreats: 0,
    },
    player: {
      xp: 0, lessons: 0, perfect: 0, reviews: 0,
      streak: { streak: 0, last: null, freezes: 1, freezeWeek: -1 },
      hearts: { count: Hearts.MAX, at: Date.now() },
    },
    lessons: {},
    words: {},
    days: {},
    achievements: {},
  };
}

// Слова храним массивами — так весь прогресс помещается в облако Telegram.
function pack(state) {
  const words = {};
  for (const [id, w] of Object.entries(state.words)) {
    words[id] = [w.rep, w.int, Math.round(w.ef * 100) / 100, w.due, w.seen, w.ok, w.at];
  }
  const lessons = {};
  for (const [id, l] of Object.entries(state.lessons)) lessons[id] = [l.count, l.best, l.at];
  return JSON.stringify({ ...state, words, lessons });
}

function unpack(text) {
  const raw = JSON.parse(text);
  const base = fresh();
  const words = {};
  for (const [id, a] of Object.entries(raw.words || {})) {
    words[id] = { rep: a[0], int: a[1], ef: a[2], due: a[3], seen: a[4], ok: a[5], at: a[6] };
  }
  const lessons = {};
  for (const [id, a] of Object.entries(raw.lessons || {})) lessons[id] = { count: a[0], best: a[1], at: a[2] };
  return {
    ...base, ...raw,
    settings: { ...base.settings, ...(raw.settings || {}) },
    player: { ...base.player, ...(raw.player || {}) },
    words, lessons,
  };
}

function readLocal() {
  try {
    const t = localStorage.getItem(KEY);
    return t ? unpack(t) : null;
  } catch (e) {
    return null;
  }
}

function writeLocal(text) {
  try { localStorage.setItem(KEY, text); } catch (e) { /* приватный режим — живём без сохранения */ }
}

// ---------- Облако Telegram ----------
const CHUNK = 4000; // лимит значения — 4096 символов
const cloud = tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast('6.9') ? tg.CloudStorage : null;

const cloudCall = (method, ...args) => new Promise(resolve => {
  try {
    cloud[method](...args, (err, value) => resolve(err ? null : value));
  } catch (e) {
    resolve(null);
  }
});

async function readCloud() {
  if (!cloud) return null;
  const meta = await cloudCall('getItems', ['st_n', 'st_t']);
  if (!meta || !meta.st_n) return null;
  const n = parseInt(meta.st_n, 10);
  const keys = Array.from({ length: n }, (_, i) => 'st_' + i);
  const parts = await cloudCall('getItems', keys);
  if (!parts) return null;
  try {
    return unpack(keys.map(k => parts[k] || '').join(''));
  } catch (e) {
    return null;
  }
}

let cloudTimer = null;
let cloudChunks = 0;
function scheduleCloud(text) {
  if (!cloud) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(async () => {
    const n = Math.ceil(text.length / CHUNK);
    for (let i = 0; i < n; i++) await cloudCall('setItem', 'st_' + i, text.slice(i * CHUNK, (i + 1) * CHUNK));
    for (let i = n; i < cloudChunks; i++) await cloudCall('removeItem', 'st_' + i);
    cloudChunks = n;
    await cloudCall('setItem', 'st_t', String(store.state.updatedAt));
    await cloudCall('setItem', 'st_n', String(n));
  }, 1500);
}

// ---------- Публичное API ----------
const listeners = new Set();

export const store = {
  state: fresh(),

  async load() {
    const local = readLocal();
    let cloudState = null;
    try {
      cloudState = await Promise.race([readCloud(), new Promise(r => setTimeout(() => r(null), 2500))]);
    } catch (e) { cloudState = null; }
    // Берём более свежую копию: можно учиться то на телефоне, то на компьютере.
    const best = [local, cloudState].filter(Boolean).sort((a, b) => b.updatedAt - a.updatedAt)[0];
    store.state = best || fresh();
    if (cloudState) cloudChunks = Math.ceil(pack(cloudState).length / CHUNK);
    if (best && best !== cloudState) scheduleCloud(pack(store.state));
  },

  /** Изменить состояние: fn получает черновик (копию) и меняет его. */
  update(fn) {
    const draft = structuredCloneSafe(store.state);
    fn(draft);
    draft.updatedAt = Date.now();
    store.state = draft;
    const text = pack(draft);
    writeLocal(text);
    scheduleCloud(text);
    listeners.forEach(l => l(draft));
  },

  reset() {
    const keep = store.state.settings;
    store.update(s => {
      Object.assign(s, fresh());
      s.settings = { ...fresh().settings, onboardingDone: true, theme: keep.theme, sound: keep.sound, female: keep.female, goal: keep.goal };
    });
  },

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

function structuredCloneSafe(o) {
  return typeof structuredClone === 'function' ? structuredClone(o) : JSON.parse(JSON.stringify(o));
}

// ---------- Выборки (как запросы Room в Android) ----------
export function dayActivity(state, day) {
  return state.days[day] || { xp: 0, lessons: 0, perfect: 0, seconds: 0 };
}

export function dueWords(state, day, limit) {
  return Object.entries(state.words)
    .filter(([, w]) => w.due <= day)
    .sort((a, b) => a[1].ef - b[1].ef || a[1].due - b[1].due)
    .slice(0, limit)
    .map(([id]) => id);
}

export function dueCount(state, day) {
  let n = 0;
  for (const w of Object.values(state.words)) if (w.due <= day) n++;
  return n;
}

export function weakestWords(state, limit) {
  return Object.entries(state.words)
    .sort((a, b) => a[1].ef - b[1].ef || (a[1].ok / a[1].seen) - (b[1].ok / b[1].seen))
    .slice(0, limit)
    .map(([id]) => id);
}
