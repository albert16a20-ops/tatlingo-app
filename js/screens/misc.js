// Повторение, словарь, профиль, настройки и знакомство (онбординг).
import { app } from '../app.js';
import { store, dayActivity, dueCount } from '../store.js';
import { today, Streak, Care, ACHIEVEMENTS, QUESTS, TatarText } from '../logic.js';
import { h, icon, mascot, button, speakerButton, progressBar, toast, modal, letterBar } from '../ui.js';
import { playVoice, sfx, feel } from '../audio.js';
import { topChips } from './path.js';

function titleBar(title, { back = false, actions = null } = {}) {
  return h('header.topbar',
    back && !app.tg ? h('button.icon-btn', { type: 'button', 'aria-label': 'Назад', onclick: () => app.nav.back() }, icon('back')) : null,
    h('h1.screen-title', title),
    actions);
}

// ---------- Повторение ----------
export function reviewScreen() {
  const s = store.state;
  const course = app.course;
  const learned = Object.keys(s.words).length;
  const due = dueCount(s, today());
  const weak = Object.entries(s.words)
    .sort((a, b) => a[1].ef - b[1].ef || a[1].due - b[1].due)
    .slice(0, 10)
    .map(([id]) => course.words[id])
    .filter(Boolean);
  const el = h('div.page',
    titleBar('Повторение'),
    h('div.center-col',
      mascot(due > 0 ? 'thinking' : 'happy', 120),
      learned === 0
        ? h('p.center', 'Пока нечего повторять — пройди первый урок!')
        : [
          h('h2.center', due > 0 ? `Пора повторить слов: ${due}` : 'Все слова пока свежи в памяти!'),
          h('p.center.muted', 'Повторяем слова по алгоритму интервального повторения. Ошибки здесь не отнимают жизни, а за повторение вернётся одна жизнь.'),
          button('Начать повторение', () => app.nav.go('lesson', { review: true })),
        ]),
    learned ? [
      h('h3.section', 'Слабые слова'),
      h('div.list', weak.map(w => h('div.card.row', h('b.grow', w.tt), h('span', w.ru)))),
    ] : null);
  return { el };
}

// ---------- Словарь ----------
let dictQuery = '';
let dictTopic = null;

export function dictionaryScreen() {
  const s = store.state;
  const course = app.course;
  const learned = Object.entries(s.words).map(([id, wp]) => {
    const w = course.words[id];
    return w ? { w, topic: course.topics[w.topic] || w.topic, strength: Math.min(1, Math.max(0.1, wp.rep / 6)) } : null;
  }).filter(Boolean);
  const topics = [...new Map(learned.map(i => [i.w.topic, i.topic])).entries()];

  const list = h('div.list');
  const chips = h('div.chips-row');
  const input = h('input.text-input.search', {
    type: 'search', value: dictQuery, placeholder: 'Поиск по-татарски или по-русски', autocomplete: 'off', autocorrect: 'off', spellcheck: 'false',
    oninput: e => { dictQuery = e.target.value; render(); },
  });
  const bar = letterBar(input, v => { dictQuery = v; render(); });
  bar.classList.add('hidden');
  input.addEventListener('focus', () => bar.classList.remove('hidden'));
  input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) bar.classList.add('hidden'); }, 150));

  function renderChips() {
    chips.replaceChildren(
      h('button.fchip', { type: 'button', class: dictTopic == null ? 'active' : '', onclick: () => { dictTopic = null; renderChips(); render(); } }, 'Все'),
      ...topics.map(([id, title]) => h('button.fchip', { type: 'button', class: dictTopic === id ? 'active' : '', onclick: () => { dictTopic = id; renderChips(); render(); } }, title)));
  }
  function render() {
    const needle = TatarText.fold(TatarText.normalize(dictQuery));
    const items = learned
      .filter(i => dictTopic == null || i.w.topic === dictTopic)
      .filter(i => !needle || TatarText.fold(TatarText.normalize(i.w.tt)).includes(needle) || TatarText.normalize(i.w.ru).includes(needle))
      .sort((a, b) => a.w.tt.toLowerCase().localeCompare(b.w.tt.toLowerCase(), 'tt'));
    list.replaceChildren(...items.slice(0, 400).map(i => h('div.card.word-row',
      h('span.word-pic', { 'aria-hidden': 'true' }, i.w.image || '•'),
      h('div.grow',
        h('div.word-tt', i.w.tt), h('div', i.w.ru), h('div.muted.small', i.topic),
        h('div', { 'aria-label': `Выучено на ${Math.round(i.strength * 100)} процентов` }, progressBar(i.strength, 'bar-thin'))),
      speakerButton(() => { if (!playVoice(i.w.audio)) toast('Для этого слова записи пока нет — скоро появится'); }))));
  }
  renderChips();
  render();

  const el = h('div.page',
    titleBar('Словарь'),
    learned.length === 0
      ? h('div.center-col', mascot('thinking', 120), h('p.center', 'Здесь появятся слова из пройденных уроков'))
      : [h('div.search-wrap', icon('search'), input), bar, chips, list]);
  return { el };
}

// ---------- Профиль ----------
export function profileScreen() {
  const s = store.state;
  const day = today();
  const act = dayActivity(s, day);
  const streak = Streak.displayed(s.player.streak, day);
  const freezes = Streak.refresh(s.player.streak, day).freezes;
  const level = Care.level(s.player.xp);
  const mood = Care.mood(s.settings.lastCare, Date.now(), act.lessons > 0);
  const treats = Care.treats(s.player.xp, s.settings.treatsEaten, s.settings.bonusTreats);
  const tile = (ic, cls, value, label) => h('div.card.stat-tile', { 'aria-label': `${label}: ${value}` },
    h('span.badge', { class: cls }, icon(ic)), h('div', h('div.tile-value', value), h('div.muted.small', label)));

  const el = h('div.page',
    titleBar('Профиль', { actions: h('button.icon-btn', { type: 'button', 'aria-label': 'Настройки', onclick: () => app.nav.go('settings') }, icon('settings')) }),
    h('div', h('h2', 'Исәнме!'), h('div.muted', `Сегодня: ${Math.floor(act.seconds / 60)} из ${s.settings.goal} мин`)),
    h('button.card.barsik-card', { type: 'button', onclick: () => app.nav.go('room') },
      mascot(mood < Care.SAD_BELOW ? 'sad' : 'happy', 92),
      h('div.grow',
        h('div.barsik-name', 'Барсик'),
        h('div.strong', `Уровень ${level.number} · ${Care.LEVEL_TITLES[level.number - 1]}`),
        progressBar(level.progress, 'bar-red'),
        h('div.small', level.next != null ? `Ещё ${level.next} XP до следующего уровня` : 'Высший уровень — Барсик гордится тобой!'),
        h('div.small', `Настроение ${mood}% · чәкчәк: ${treats}`),
        h('div.link', 'В комнату →'))),
    h('div.grid2',
      tile('fire', 'b-streak', streak, 'Серия дней'),
      tile('bolt', 'b-gold', s.player.xp, 'Всего XP'),
      tile('book', 'b-green', Object.keys(s.words).length, 'Слов выучено'),
      tile('snow', 'b-blue', freezes, 'Заморозки')),
    h('p.muted', 'Заморозка спасает серию, если пропущен один день. Одна бесплатная — каждую неделю.'),
    h('h3.section', 'Задания на сегодня'),
    h('div.card.quests', QUESTS.map(q => {
      const v = Math.min(q.target, q.value(act));
      const done = v >= q.target;
      return h('div.quest',
        h('span.badge', { class: done ? 'b-green' : 'b-gold' }, icon(done ? 'check' : 'flag')),
        h('div.grow', h('div.row', h('b.grow', q.title), h('span', { class: done ? 'ok' : 'muted' }, `${v}/${q.target}`)), progressBar(v / q.target, done ? 'bar-ok' : '')));
    })),
    h('h3.section', 'Достижения'),
    h('div.grid2', ACHIEVEMENTS.map(a => {
      const got = !!s.achievements[a.id];
      return h('div.card.ach', { class: got ? 'got' : 'locked', 'aria-label': `${a.title}. ${a.desc}. ${got ? 'получено' : 'ещё не получено'}` },
        h('div.medal', a.emoji, got ? null : h('span.medal-lock', icon('lock'))),
        h('b', a.title), h('div.muted.small', a.desc));
    })));
  return { el };
}

// ---------- Настройки ----------
const GOALS = [[5, 'Легко'], [10, 'Обычно'], [15, 'Серьёзно'], [20, 'Интенсивно']];

export function settingsScreen() {
  const el = h('div.page');
  const render = () => {
    const st = store.state.settings;
    const set = fn => { store.update(s => fn(s.settings)); app.applyTheme(); render(); };
    const seg = (options, value, onPick) => h('div.chips-row.wrap', options.map(([v, label]) =>
      h('button.fchip', { type: 'button', class: v === value ? 'active' : '', onclick: () => { sfx('tap'); feel.tap(); onPick(v); } }, label)));
    const toggle = (label, value, onChange) => h('label.switch-row', h('span.grow', label),
      h('input', { type: 'checkbox', role: 'switch', checked: value, onchange: e => onChange(e.target.checked) }));
    const levels = Object.values(app.course.levels);
    el.replaceChildren(
      titleBar('Настройки', { back: true }),
      h('div.card.section-card',
        h('h3', 'Звук и задания'),
        toggle('Звуковые эффекты', st.sound, v => set(s => { s.sound = v; })),
        h('div.label', 'Голос озвучки'),
        seg([[false, 'Мужской'], [true, 'Женский']], st.female, v => { set(s => { s.female = v; }); setTimeout(() => playVoice('salam'), 150); }),
        h('p.muted.small', 'Задания на произношение есть только в приложении для Android.')),
      h('div.card.section-card',
        h('h3', 'Цель на день'),
        seg(GOALS.map(([m]) => [m, `${m} мин`]), st.goal, v => set(s => { s.goal = v; }))),
      h('div.card.section-card',
        h('h3', 'Уровень сложности'),
        seg(levels.map(l => [l.id, `${l.id} · ${l.title}`]), st.courseLevel || null, v => set(s => { s.courseLevel = v; })),
        h('p.muted.small', 'Путь начнётся с выбранного уровня. Уроки уровней ниже останутся открытыми — к ним можно вернуться в любое время. Прогресс не сбрасывается.')),
      h('div.card.section-card',
        h('h3', 'Тема'),
        seg([['system', 'Как в Telegram'], ['light', 'Светлая'], ['dark', 'Тёмная']], st.theme, v => set(s => { s.theme = v; }))),
      h('div.card.section-card',
        h('h3', 'Прогресс'),
        h('p.muted.small', app.tg && app.tg.CloudStorage ? 'Прогресс хранится в облаке Telegram — он один и тот же на телефоне и компьютере.' : 'Прогресс хранится в этом браузере.'),
        button('Сбросить прогресс', () => modal('Сбросить весь прогресс?', 'XP, серия, пройденные уроки, слова и достижения будут удалены. Это нельзя отменить.', [
          { text: 'Отмена' },
          { text: 'Сбросить', kind: 'danger', onClick: () => { store.reset(); app.nav.home(); } },
        ]), { kind: 'danger-outline' })),
      h('div.card.section-card',
        h('h3', 'О приложении'),
        h('p', 'Tatlingo — курс литературного татарского для русскоговорящих. Версия для Telegram.'),
        h('p.muted.small', 'Озвучка: TatarTTS (ISSAI и Институт прикладной семиотики АН РТ), лицензия CC BY 4.0. Синтез речи: Piper. 3D-графика: three.js (MIT). Шрифты Rubik и Nunito (OFL).'),
        h('p.small', h('a', { href: 'https://t.me/tatlingo_app', target: '_blank', rel: 'noopener', onclick: openLink }, 'Канал Tatlingo в Telegram'))));
  };
  render();
  return { el };
}

function openLink(e) {
  if (app.tg) {
    e.preventDefault();
    try { app.tg.openTelegramLink(e.currentTarget.href); } catch (err) { window.open(e.currentTarget.href, '_blank'); }
  }
}

// ---------- Знакомство ----------
export function onboardingScreen() {
  const levels = Object.values(app.course.levels);
  let step = 0, goal = 10, level = levels.length ? levels[0].id : 'A1', female = false;
  const el = h('div.onboarding');
  const render = () => {
    const choice = (text, selected, onClick, desc) => h('button.choice', {
      type: 'button', role: 'radio', 'aria-checked': selected ? 'true' : 'false', class: selected ? 'selected' : '',
      onclick: () => { sfx('select'); feel.tap(); onClick(); render(); },
    }, h('span.radio'), desc ? h('span', h('span', text), h('br'), h('span.muted.small', desc)) : h('span', text));
    let content;
    if (step === 0) {
      content = [h('h1', 'Сәлам! Мин — Барсик, твой помощник'), h('p.muted', 'Сколько времени в день ты готов уделять татарскому?'),
        ...GOALS.map(([m, label]) => choice(`${label} · ${m} мин в день`, goal === m, () => { goal = m; }))];
    } else if (step === 1) {
      content = [h('h1', 'Твой уровень'), h('p.muted', 'Выбери уровень сложности. Если учишь с нуля — бери A1. Уровень можно поменять в настройках.'),
        ...levels.map(l => choice(`${l.id} · ${l.title}`, level === l.id, () => { level = l.id; }, l.description))];
    } else {
      content = [h('h1', 'Чей голос тебе нравится?'), h('p.muted', 'Все слова и фразы курса озвучены. Нажми, чтобы послушать — голос можно сменить в настройках.'),
        choice('Мужской голос', !female, () => { female = false; store.update(s => { s.settings.female = false; }); playVoice('salam'); }),
        choice('Женский голос', female, () => { female = true; store.update(s => { s.settings.female = true; }); playVoice('salam'); })];
    }
    el.replaceChildren(
      h('div.onb-scroll', mascot(step === 2 ? 'celebrate' : 'happy', 140), h('div.onb-step', { role: 'radiogroup' }, content)),
      h('div.step-dots', [0, 1, 2].map(i => h('span.dot', { class: i === step ? 'on' : '' }))),
      button(step < 2 ? 'Далее' : 'Начать', () => {
        if (step < 2) { step++; render(); return; }
        store.update(s => { Object.assign(s.settings, { onboardingDone: true, goal, startLevel: 'beginner', courseLevel: level, female }); });
        app.nav.home();
      }));
  };
  render();
  return { el };
}
