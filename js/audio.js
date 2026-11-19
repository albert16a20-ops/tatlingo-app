// Озвучка курса (те же m4a, что в Android) и звуки интерфейса.
// iOS разрешает звук только после касания, поэтому плеер «разблокируется» первым нажатием.
import { store } from './store.js';

let course = null;
const voice = new Audio();
voice.preload = 'auto';
voice.setAttribute('playsinline', '');

export function initAudio(c) {
  course = c;
  const unlock = () => {
    if (ctx && ctx.state === 'suspended') ctx.resume();
    if (!voice.src) {
      // Короткая тишина — после неё iOS даёт играть звук и вне обработчика касания.
      voice.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
      voice.play().catch(() => {});
    }
    loadSfx();
  };
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
}

function urlFor(key) {
  if (!course || !key) return null;
  if (store.state.settings.female && course.audioFemale.has(key)) return `audio_female/${encodeURIComponent(key)}.m4a`;
  if (course.audio.has(key)) return `audio/${encodeURIComponent(key)}.m4a`;
  return null;
}

export const hasAudio = key => !!urlFor(key);

/** Проиграть запись; false — записи нет. */
export function playVoice(key) {
  const url = urlFor(key);
  if (!url) return false;
  try {
    voice.pause();
    stopBarsik();
    voice.src = url;
    voice.currentTime = 0;
    const p = voice.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { return false; }
  return true;
}

export function stopVoice() {
  try { voice.pause(); } catch (e) { /* ничего */ }
  stopBarsik();
}

// ---------- Голос Барсика: женская запись, высота ×1.4, темп ×1.05 («как у бурундука») ----------
const BARSIK_PITCH = 1.4, BARSIK_SPEED = 1.05;
const barsikCache = new Map();
let barsikSrc = null, barsikToken = 0;

function stopBarsik() {
  barsikToken++;
  if (barsikSrc) { try { barsikSrc.stop(); } catch (e) { /* уже остановлен */ } barsikSrc = null; }
}

/**
 * WSOLA: растягивает звук во времени в [alpha] раз, не меняя высоту.
 * Потом буфер играется с playbackRate = BARSIK_PITCH — голос становится выше, а темп — BARSIK_SPEED.
 */
function stretch(input, sr, alpha) {
  const N = Math.round(sr * 0.04) & ~1, Hs = N >> 1, Ha = Hs / alpha, tol = Math.round(sr * 0.012);
  const outLen = Math.ceil(input.length * alpha) + N;
  const out = new Float32Array(outLen), norm = new Float32Array(outLen);
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
  const at = i => (i >= 0 && i < input.length ? input[i] : 0);
  let prev = 0;
  for (let k = 0; k * Hs < outLen - N; k++) {
    const nominal = Math.round(k * Ha);
    if (nominal > input.length) break;
    let best = nominal;
    if (k > 0) {
      const nat = prev + Hs;
      let bestScore = -Infinity;
      for (let d = -tol; d <= tol; d += 2) {
        const pos = nominal + d;
        let s = 0;
        for (let i = 0; i < N; i += 4) s += at(nat + i) * at(pos + i);
        if (s > bestScore) { bestScore = s; best = pos; }
      }
    }
    const o = k * Hs;
    for (let i = 0; i < N; i++) { out[o + i] += at(best + i) * win[i]; norm[o + i] += win[i]; }
    prev = best;
  }
  for (let i = 0; i < outLen; i++) if (norm[i] > 1e-3) out[i] /= norm[i];
  return out;
}

async function barsikBuffer(url) {
  if (barsikCache.has(url)) return barsikCache.get(url);
  const data = await fetch(url).then(r => r.arrayBuffer());
  const buf = await new Promise((ok, fail) => ctx.decodeAudioData(data, ok, fail));
  const mono = stretch(buf.getChannelData(0), buf.sampleRate, BARSIK_PITCH / BARSIK_SPEED);
  const res = ctx.createBuffer(1, mono.length, buf.sampleRate);
  res.getChannelData(0).set(mono);
  if (barsikCache.size > 40) barsikCache.delete(barsikCache.keys().next().value);
  barsikCache.set(url, res);
  return res;
}

/** Голос Барсика (комната и чат). Если Web Audio нет — обычная запись. */
export function playBarsik(key) {
  const url = course && key && course.audioFemale.has(key) ? `audio_female/${encodeURIComponent(key)}.m4a` : urlFor(key);
  if (!url) return false;
  if (!ctx) return playVoice(key);
  try { voice.pause(); } catch (e) { /* ничего */ }
  stopBarsik();
  const token = barsikToken;
  if (ctx.state === 'suspended') ctx.resume();
  barsikBuffer(url).then(buf => {
    if (token !== barsikToken) return;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = BARSIK_PITCH;
    src.connect(ctx.destination);
    src.start();
    barsikSrc = src;
  }).catch(() => { if (token === barsikToken) playVoice(key); });
  return true;
}

// ---------- Звуки интерфейса (Web Audio — без задержки) ----------
const SFX = { tap: 0.45, select: 0.55, correct: 0.8, wrong: 0.7, match: 0.7, complete: 0.85 };
const AC = window.AudioContext || window.webkitAudioContext;
const ctx = AC ? new AC() : null;
const buffers = {};
let loading = false;

function loadSfx() {
  if (loading || !ctx) return;
  loading = true;
  Object.keys(SFX).forEach(name => {
    fetch(`sfx/sfx_${name}.wav`)
      .then(r => r.arrayBuffer())
      .then(b => new Promise((ok, fail) => ctx.decodeAudioData(b, ok, fail)))
      .then(buf => { buffers[name] = buf; })
      .catch(() => {});
  });
}

export function sfx(name) {
  if (!store.state.settings.sound || !ctx || !buffers[name]) return;
  try {
    if (ctx.state === 'suspended') ctx.resume();
    const src = ctx.createBufferSource();
    const gain = ctx.createGain();
    gain.gain.value = SFX[name];
    src.buffer = buffers[name];
    src.connect(gain).connect(ctx.destination);
    src.start();
  } catch (e) { /* без звука */ }
}

// ---------- Вибрация Telegram ----------
const haptic = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.HapticFeedback;
export const feel = {
  tap: () => { try { haptic && haptic.selectionChanged(); } catch (e) {} },
  ok: () => { try { haptic && haptic.notificationOccurred('success'); } catch (e) {} },
  bad: () => { try { haptic && haptic.notificationOccurred('error'); } catch (e) {} },
};
