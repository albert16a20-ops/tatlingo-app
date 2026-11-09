// Точка входа Mini App: загрузка курса и прогресса, навигация, связь с Telegram.
import { prepareCourse } from './logic.js';
import { store } from './store.js';
import { initAudio } from './audio.js';
import { h, icon, mascot } from './ui.js';
import { screens } from './screens.js';

const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData !== undefined ? window.Telegram.WebApp : null;
const inTelegram = !!(tg && tg.platform && tg.platform !== 'unknown');

export const app = { course: null, tg: inTelegram ? tg : null, nav: null };

const TABS = [
  { name: 'path', label: 'Путь', icon: 'home' },
  { name: 'review', label: 'Повторение', icon: 'refresh' },
  { name: 'chats', label: 'Чат', icon: 'chat' },
  { name: 'dictionary', label: 'Словарь', icon: 'translate' },
  { name: 'profile', label: 'Профиль', icon: 'person' },
];

const root = document.getElementById('app');
const viewHost = h('main.view');
const tabbar = h('nav.tabbar', { 'aria-label': 'Разделы' });
root.replaceChildren(viewHost, tabbar);

let stack = [];

function renderTabbar(active) {
  tabbar.replaceChildren(...TABS.map(t => h('button.tab', {
    type: 'button', class: t.name === active ? 'active' : '', 'aria-current': t.name === active ? 'page' : null,
    onclick: () => { if (t.name !== active) nav.tab(t.name); else viewHost.scrollTo({ top: 0, behavior: 'smooth' }); },
  }, h('span.tab-ic', icon(t.icon)), h('span.tab-label', t.label))));
}

function show(entry, direction) {
  const top = stack[stack.length - 1];
  if (top && top !== entry && top.view.onHide) top.view.onHide();
  const isTab = TABS.some(t => t.name === entry.name);
  document.body.classList.toggle('has-tabs', isTab);
  document.body.classList.toggle('is-sheet', !!entry.view.sheet);
  if (isTab) renderTabbar(entry.name);
  entry.view.el.classList.add('screen', 'enter-' + direction);
  viewHost.replaceChildren(entry.view.el);
  viewHost.scrollTop = entry.scroll || 0;
  if (entry.view.onShow) entry.view.onShow();
  if (app.tg) {
    if (stack.length > 1) app.tg.BackButton.show(); else app.tg.BackButton.hide();
  }
}

function make(name, params) {
  const view = screens[name](params || {});
  return { name, params, view };
}

export const nav = {
  go(name, params) {
    const top = stack[stack.length - 1];
    if (top) top.scroll = viewHost.scrollTop;
    const entry = make(name, params);
    stack.push(entry);
    show(entry, 'forward');
  },
  /** Заменить текущий экран (урок → итог). */
  replace(name, params) {
    stack.pop();
    const entry = make(name, params);
    stack.push(entry);
    show(entry, 'forward');
  },
  back() {
    const top = stack[stack.length - 1];
    if (top && top.view.onBack && top.view.onBack() === false) return;
    if (stack.length <= 1) return;
    stack.pop();
    if (top.view.onHide) top.view.onHide();
    const prev = stack[stack.length - 1];
    // Предыдущий экран перерисовываем — прогресс мог измениться.
    const scroll = prev.scroll;
    stack[stack.length - 1] = make(prev.name, prev.params);
    stack[stack.length - 1].scroll = scroll;
    show(stack[stack.length - 1], 'back');
  },
  tab(name) {
    stack.forEach(e => e.view.onHide && e.view.onHide());
    stack = [make(name)];
    show(stack[0], 'fade');
  },
  /** Сбросить всё к главному экрану. */
  home() { nav.tab('path'); },
};
app.nav = nav;

function applyTheme() {
  const t = store.state.settings.theme;
  const dark = t === 'dark' || (t === 'system' && (app.tg ? app.tg.colorScheme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches));
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (app.tg) {
    const bg = dark ? '#121A15' : '#FFF8EE';
    try { app.tg.setHeaderColor(bg); app.tg.setBackgroundColor(bg); } catch (e) { /* старый клиент */ }
    try { if (app.tg.setBottomBarColor) app.tg.setBottomBarColor(dark ? '#1C2620' : '#FFFDF8'); } catch (e) {}
  }
}
app.applyTheme = applyTheme;

async function start() {
  if (app.tg) {
    app.tg.ready();
    app.tg.expand();
    try { if (app.tg.disableVerticalSwipes) app.tg.disableVerticalSwipes(); } catch (e) {}
    app.tg.BackButton.onClick(() => nav.back());
    app.tg.onEvent('themeChanged', applyTheme);
    document.body.classList.add('in-telegram');
  }
  viewHost.replaceChildren(h('div.splash', mascot('happy', 140), h('div.splash-title', 'Tatlingo'), h('div.loader')));
  try {
    const [raw] = await Promise.all([
      fetch('content/course.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
      store.load(),
    ]);
    app.course = prepareCourse(raw);
  } catch (e) {
    viewHost.replaceChildren(h('div.splash', mascot('sad', 140), h('p.center', 'Не удалось загрузить курс. Проверь интернет и открой приложение ещё раз.')));
    return;
  }
  initAudio(app.course);
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  if (!store.state.settings.onboardingDone) {
    stack = [make('onboarding')];
    show(stack[0], 'fade');
  } else {
    nav.tab('path');
  }
  // Браузерная кнопка «назад» (вне Telegram).
  if (!app.tg) {
    history.replaceState({ t: 0 }, '');
    window.addEventListener('popstate', () => { nav.back(); history.pushState({ t: 1 }, ''); });
    history.pushState({ t: 1 }, '');
  }
}

start();
