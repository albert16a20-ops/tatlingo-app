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
    voice.src = url;
    voice.currentTime = 0;
    const p = voice.play();
    if (p && p.catch) p.catch(() => {});
  } catch (e) { return false; }
  return true;
}

export function stopVoice() {
  try { voice.pause(); } catch (e) { /* ничего */ }
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
