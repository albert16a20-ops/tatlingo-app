// Общие элементы интерфейса: создание DOM, иконки, Барсик, всплывающие сообщения, диалоги.
import { sfx, feel } from './audio.js';

/** h('div.card', {onclick}, 'текст', child) — маленький помощник для DOM. */
export function h(tag, attrs, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs !== undefined && (attrs === null || typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'class') el.className += (el.className ? ' ' : '') + v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c == null || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}

// ---------- Иконки (Material Symbols, упрощённые пути) ----------
const ICONS = {
  home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z',
  refresh: 'M17.65 6.35A7.96 7.96 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z',
  chat: 'M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM6 9h12v2H6V9zm8 5H6v-2h8v2zm4-6H6V6h12v2z',
  translate: 'm12.87 15.07-2.54-2.51.03-.03A17.52 17.52 0 0 0 14.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7 1.62-4.33L19.12 17h-3.24z',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
  settings: 'M19.14 12.94a7.07 7.07 0 0 0 0-1.88l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.49.49 0 0 0-.59-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.48.48 0 0 0-.48-.41h-3.84a.48.48 0 0 0-.48.41l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.49.49 0 0 0-.59.22L2.74 8.87a.48.48 0 0 0 .12.61l2.03 1.58a7.07 7.07 0 0 0 0 1.88l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.48-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 0 0-.12-.61l-2.03-1.58zM12 15.6a3.6 3.6 0 1 1 0-7.2 3.6 3.6 0 0 1 0 7.2z',
  back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
  close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
  check: 'M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  lock: 'M18 8h-1V6A5 5 0 0 0 7 6v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2zm-6 9a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm3.1-9H8.9V6a3.1 3.1 0 0 1 6.2 0v2z',
  star: 'M12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z',
  play: 'M8 5v14l11-7z',
  book: 'M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z',
  speaker: 'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
  heart: 'm12 21.35-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A5.99 5.99 0 0 1 16.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  fire: 'M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14a8 8 0 0 0 16 0C20 8.61 17.41 3.8 13.5.67zM11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8z',
  bolt: 'M11 21h-1l1-7H7.5c-.58 0-.57-.32-.38-.66.19-.34.05-.08.07-.12C8.48 10.94 10.42 7.54 13 3h1l-1 7h3.5c.49 0 .56.33.47.51l-.07.15C12.96 17.55 11 21 11 21z',
  snow: 'M22 11h-4.17l3.24-3.24-1.41-1.42L15 11h-2V9l4.66-4.66-1.42-1.41L13 6.17V2h-2v4.17L7.76 2.93 6.34 4.34 11 9v2H9L4.34 6.34 2.93 7.76 6.17 11H2v2h4.17l-3.24 3.24 1.41 1.42L9 13h2v2l-4.66 4.66 1.42 1.41L11 17.83V22h2v-4.17l3.24 3.24 1.42-1.41L13 15v-2h2l4.66 4.66 1.41-1.42L17.83 13H22z',
  flag: 'M14.4 6 14 4H5v17h2v-7h5.6l.4 2h7V6z',
  timer: 'M15 1H9v2h6V1zm-4 13h2V8h-2v6zm8.03-6.61 1.42-1.42c-.43-.51-.9-.99-1.41-1.41l-1.42 1.42A8.96 8.96 0 0 0 12 4a9 9 0 1 0 9 9c0-2.12-.74-4.07-1.97-5.61zM12 20a7 7 0 1 1 0-14 7 7 0 0 1 0 14z',
  search: 'M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
  send: 'M2.01 21 23 12 2.01 3 2 10l15 2-15 2z',
};

export function icon(name, cls = '') {
  const span = document.createElement('span');
  span.className = 'ic ' + cls;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24"><path d="${ICONS[name]}"/></svg>`;
  return span;
}

// ---------- Барсик (тот же рисунок, что в приложении) ----------
export function mascot(mood = 'idle', size = 120, onClick) {
  const spots = [[24, 44], [20, 60], [76, 44], [80, 60]].map(([x, y], i) =>
    [0, 1, 2].map(k => {
      const a = i * 1.3 + k * 2.1;
      return `<circle cx="${(x + Math.cos(a) * 2.6).toFixed(2)}" cy="${(y + Math.sin(a) * 2.6).toFixed(2)}" r="1.2" fill="var(--spots)" opacity=".8"/>`;
    }).join('')).join('');
  const eyes = [39, 61].map(cx => {
    if (mood === 'happy' || mood === 'celebrate') {
      return `<path d="M${cx - 5} 51 A5 5 0 0 1 ${cx + 5} 51" fill="none" stroke="#2B2F33" stroke-width="2.5" stroke-linecap="round"/>`;
    }
    return `<g class="m-eye" style="transform-origin:${cx}px 49px">
      <circle cx="${cx}" cy="49" r="5.8" fill="#fff"/>
      <circle cx="${cx}" cy="49" r="5" fill="url(#iris)"/>
      <circle cx="${cx}" cy="49" r="2.4" fill="#0A0D14"/>
      <circle cx="${cx - 1.7}" cy="47.1" r="1.6" fill="#fff"/>
      <circle cx="${cx + 1.6}" cy="50.5" r=".7" fill="#fff" opacity=".7"/>
      <circle cx="${cx}" cy="49" r="5.8" fill="none" stroke="#2B2F33" stroke-width=".8"/></g>`;
  }).join('');
  const mouth = {
    happy: '<path d="M57.5 67.4 A8 5.5 0 0 1 42.5 67.4" fill="none" stroke="#2B2F33" stroke-width="2" stroke-linecap="round"/>',
    celebrate: '<path d="M57 70 A7 6 0 0 1 43 70 Z" fill="#7A2230"/>',
    sad: '<path d="M43.4 70.6 A7 4 0 0 1 56.6 70.6" fill="none" stroke="#2B2F33" stroke-width="2" stroke-linecap="round"/>',
  }[mood] || '<path d="M54.33 67.25 A5 3.5 0 0 1 45.67 67.25" fill="none" stroke="#2B2F33" stroke-width="2" stroke-linecap="round"/>';
  const sad = mood === 'sad'
    ? '<path d="M33 42 L43 39 M67 42 L57 39" stroke="#2B2F33" stroke-width="1.8" stroke-linecap="round"/><circle cx="66" cy="57" r="2.2" fill="#64B5F6"/>'
    : '';
  const sparks = mood === 'celebrate'
    ? [[8, 20], [92, 18], [6, 70], [94, 72]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="var(--gold)"/>`).join('')
    : '';
  const ears = [27, 73].map(x => `<circle cx="${x}" cy="27" r="12" fill="var(--fur)" stroke="var(--fur-line)" stroke-width="1.8"/><circle cx="${x}" cy="28" r="6" fill="#F2A7A7"/>`).join('');
  const svg = `<svg viewBox="0 0 100 100" class="m-${mood}"><defs><radialGradient id="iris"><stop offset="0" stop-color="#E8D690"/><stop offset=".5" stop-color="#9BB88F"/><stop offset="1" stop-color="#4F6E55"/></radialGradient></defs>
    <g class="m-body">${ears}
    <ellipse cx="50" cy="57" rx="38" ry="33" fill="var(--fur)" stroke="var(--fur-line)" stroke-width="1.8"/>${spots}
    <path d="M32 30 L68 30 L66.5 24 L33.5 24 Z" fill="#0B7A45"/>
    <path d="M33.5 24.5 C35 13 65 13 66.5 24.5 Z" fill="#0D8C50"/>
    <path d="M50 15.5 L37 24.5 M50 15.5 L50 24.5 M50 15.5 L63 24.5" stroke="var(--gold)" stroke-width="1.2"/>
    <path d="M32.5 29 L67.5 29" stroke="var(--gold)" stroke-width="2.4"/>
    <circle cx="40" cy="26.7" r="1.2" fill="#9FE8CF"/><circle cx="50" cy="26.7" r="1.2" fill="#9FE8CF"/><circle cx="60" cy="26.7" r="1.2" fill="#9FE8CF"/>
    <circle cx="50" cy="15.2" r="1.6" fill="var(--gold)"/>
    <ellipse cx="50" cy="69" rx="18" ry="12" fill="#fff"/>
    ${eyes}${sad}
    <path d="M46 60 L54 60 L50 64.5 Z" fill="#E57373"/>${mouth}
    <circle cx="28" cy="63" r="4" fill="#F2A7A7" opacity=".45"/><circle cx="72" cy="63" r="4" fill="#F2A7A7" opacity=".45"/>
    ${sparks}</g></svg>`;
  const el = h('div.mascot', { role: 'img', 'aria-label': moodLabel(mood), style: { width: size + 'px', height: size + 'px' } });
  el.innerHTML = svg;
  if (onClick) {
    el.classList.add('tappable');
    el.addEventListener('click', () => {
      sfx('select');
      feel.tap();
      el.classList.remove('petted');
      void el.offsetWidth;
      el.classList.add('petted');
      onClick();
    });
  }
  return el;
}

const moodLabel = m => ({ happy: 'Барсик радуется', sad: 'Барсик грустит', celebrate: 'Барсик празднует', thinking: 'Барсик задумался' }[m] || 'Барсик');

/** Барсик с репликой в «облачке». */
export function barsikSpeech(text, mood = 'happy', { size = 76, onMascot, onBubble } = {}) {
  return h('div.speech-row',
    mascot(mood, size, onMascot),
    h('div.bubble', { onclick: onBubble, class: onBubble ? 'tappable' : '' }, text));
}

// ---------- Кнопки ----------
export function button(text, onClick, { kind = 'primary', disabled = false, cls = '', style } = {}) {
  return h('button.btn', {
    class: `btn-${kind} ${cls}`, disabled, style, type: 'button',
    onclick: e => { if (!e.currentTarget.disabled) { sfx('tap'); feel.tap(); onClick && onClick(e); } },
  }, text);
}

export function speakerButton(onClick, big = false) {
  return h('button.speaker', {
    class: big ? 'big' : '', type: 'button', 'aria-label': 'Прослушать',
    onclick: e => { e.stopPropagation(); feel.tap(); onClick(); },
  }, icon('speaker'));
}

export function chip(iconName, value, cls, label) {
  return h('div.chip', { class: cls, 'aria-label': label, title: label }, icon(iconName), h('span', value));
}

export function progressBar(fraction, cls = '') {
  return h('div.bar', { class: cls }, h('div.bar-fill', { style: { width: Math.round(Math.max(0, Math.min(1, fraction)) * 100) + '%' } }));
}

// ---------- Сообщения и диалоги ----------
let toastTimer = null;
export function toast(text) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div.toast', { role: 'status', 'aria-live': 'polite' });
    el.id = 'toast';
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

/** Модальное окно: buttons = [{text, kind, onClick}] */
export function modal(title, body, buttons) {
  const close = () => { overlay.classList.remove('show'); setTimeout(() => overlay.remove(), 200); };
  const overlay = h('div.overlay', { onclick: e => { if (e.target === overlay) close(); } },
    h('div.dialog', { role: 'dialog', 'aria-modal': 'true' },
      h('h3', title),
      typeof body === 'string' ? h('p', body) : body,
      h('div.dialog-actions', buttons.map(b => button(b.text, () => { close(); b.onClick && b.onClick(); }, { kind: b.kind || 'text' })))));
  document.body.append(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  return close;
}

// ---------- Панель татарских букв ----------
export function letterBar(input, onInput) {
  let upper = false;
  const letters = ['ә', 'ө', 'ү', 'җ', 'ң', 'һ'];
  const bar = h('div.letters');
  const render = () => {
    bar.replaceChildren(
      h('button.letter.shift', {
        type: 'button', 'aria-label': upper ? 'Строчные буквы' : 'Заглавные буквы',
        onpointerdown: e => e.preventDefault(),
        onclick: () => { upper = !upper; render(); },
      }, upper ? 'аа' : 'АА'),
      ...letters.map(l => {
        const ch = upper ? l.toUpperCase() : l;
        return h('button.letter', {
          type: 'button', 'aria-label': 'Вставить букву ' + ch,
          // Не забираем фокус у поля — клавиатура телефона не прячется.
          onpointerdown: e => e.preventDefault(),
          onclick: () => {
            const s = input.selectionStart ?? input.value.length;
            const e2 = input.selectionEnd ?? input.value.length;
            input.value = input.value.slice(0, s) + ch + input.value.slice(e2);
            input.setSelectionRange(s + ch.length, s + ch.length);
            input.focus();
            sfx('tap');
            onInput && onInput(input.value);
          },
        }, ch);
      }));
  };
  render();
  return bar;
}

// ---------- Конфетти ----------
export function confetti(pieces = 80) {
  const canvas = h('canvas.confetti');
  document.body.append(canvas);
  const dpr = window.devicePixelRatio || 1;
  const W = canvas.width = innerWidth * dpr, H = canvas.height = innerHeight * dpr;
  const g = canvas.getContext('2d');
  const colors = ['#0B7A45', '#C2412D', '#E3A52A', '#0F6E64', '#FFE8B0', '#5BD08F'];
  const parts = Array.from({ length: pieces }, () => ({
    x: Math.random() * W, y: -Math.random() * H * 0.6, vx: (Math.random() - 0.5) * 2 * dpr, vy: (2 + Math.random() * 3) * dpr,
    r: (4 + Math.random() * 5) * dpr, a: Math.random() * 6, va: (Math.random() - 0.5) * 0.3, c: colors[Math.floor(Math.random() * colors.length)],
  }));
  const start = performance.now();
  (function frame(t) {
    g.clearRect(0, 0, W, H);
    const fade = Math.max(0, 1 - (t - start - 2600) / 900);
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.a += p.va; p.vy += 0.03 * dpr;
      g.save(); g.globalAlpha = fade; g.translate(p.x, p.y); g.rotate(p.a); g.fillStyle = p.c;
      g.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2); g.restore();
    });
    if (fade > 0) requestAnimationFrame(frame); else canvas.remove();
  })(start);
}

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
