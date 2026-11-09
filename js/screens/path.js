// Главный экран — путь обучения: уровни, юниты, уроки «змейкой».
import { app } from '../app.js';
import { store, dayActivity, dueCount } from '../store.js';
import { today, nodeStates, openUnitCount, currentLesson, Streak, Hearts, assistantLine, TIPS } from '../logic.js';
import { h, icon, mascot, barsikSpeech, chip, toast, modal, progressBar } from '../ui.js';
import { sfx, feel } from '../audio.js';

const ZIGZAG = [0, 48, 80, 48, 0, -48, -80, -48];
let chosenLevel = null;
let tipIndex = -1;

export function heartsNow() {
  return Hearts.regenerate(store.state.player.hearts, Date.now()).count;
}

export function topChips() {
  const s = store.state;
  const day = dayActivity(s, today());
  const minutes = Math.floor(day.seconds / 60);
  const goal = s.settings.goal;
  const streak = Streak.displayed(s.player.streak, today());
  const hearts = heartsNow();
  return h('div.chips',
    chip('timer', `${minutes}/${goal}`, minutes >= goal ? 'chip-done' : 'chip-goal', `Цель на день: ${minutes} из ${goal} минут`),
    chip('fire', streak, 'chip-streak', `Серия: ${streak} дней`),
    chip('bolt', s.player.xp, 'chip-xp', `Опыт: ${s.player.xp} XP`),
    chip('heart', hearts, 'chip-heart', `Жизни: ${hearts}`));
}

export function noHeartsDialog() {
  modal('Жизни закончились', 'Жизни восстанавливаются по одной каждые 4 часа. А урок-повторение вернёт одну жизнь прямо сейчас!', [
    { text: 'Позже' },
    { text: 'К повторению', kind: 'primary', onClick: () => app.nav.go('lesson', { review: true }) },
  ]);
}

export function pathScreen() {
  const course = app.course;
  const s = store.state;
  const day = today();
  const states = nodeStates(course, s.lessons, s.settings.startLevel, s.settings.courseLevel);
  const openBefore = openUnitCount(course, s.settings.startLevel, s.settings.courseLevel);
  const current = currentLesson(course, states, openBefore);
  const act = dayActivity(s, day);
  const hearts = heartsNow();
  const line = assistantLine({
    lessons: s.player.lessons, hearts, streak: Streak.displayed(s.player.streak, day),
    practicedToday: act.lessons > 0, due: dueCount(s, day), todayXp: act.xp,
  });
  const mood = hearts <= 0 ? 'sad' : act.lessons > 0 ? 'celebrate' : 'happy';

  const levels = [...new Set(course.units.map(u => u.level))];
  const currentUnit = course.units.find(u => u.lessons.some(l => l.id === current));
  const selected = chosenLevel || (currentUnit && currentUnit.level) || levels[0];

  const el = h('div.path');
  const header = h('header.topbar', h('div.brand', 'Tatlingo'), topChips());

  const speechText = h('div.bubble.tappable');
  const setSpeech = () => { speechText.textContent = tipIndex < 0 ? line : TIPS[tipIndex % TIPS.length]; };
  setSpeech();
  speechText.addEventListener('click', () => { tipIndex++; sfx('tap'); setSpeech(); });
  const barsik = h('div.speech-row', mascot(mood, 84, () => app.nav.go('room')), speechText);

  const tabs = h('div.level-tabs', levels.map(id => {
    const nodes = course.units.filter(u => u.level === id).flatMap(u => u.lessons);
    const done = nodes.filter(l => states[l.id] === 'completed' || states[l.id] === 'golden').length;
    const frac = nodes.length ? done / nodes.length : 0;
    return h('button.level-tab', {
      type: 'button', class: id === selected ? 'active' : '',
      onclick: () => { chosenLevel = id; sfx('tap'); feel.tap(); app.nav.tab('path'); },
    }, h('b', id), ring(frac), h('span', `${done}/${nodes.length}`));
  }));

  const list = h('div.units');
  const visible = levels.length > 1 ? course.units.filter(u => u.level === selected) : course.units;
  let currentNode = null;
  visible.forEach((unit, i) => {
    if (i === 0 || visible[i - 1].level !== unit.level) {
      const lv = course.levels[unit.level] || { id: unit.level, title: unit.level, description: '' };
      list.append(h('div.level-header', h('span.level-badge', lv.id),
        h('div', h('div.level-title', `Уровень «${lv.title}»`), lv.description ? h('div.muted.small', lv.description) : null)));
    }
    const done = unit.lessons.filter(l => states[l.id] === 'completed' || states[l.id] === 'golden').length;
    list.append(h('section.unit-banner', { class: 'u' + (unit.index % 4) },
      h('div.unit-num', `Юнит ${unit.index + 1}`.toUpperCase()),
      h('h2', unit.title),
      h('div.unit-sub', unit.subtitle),
      h('div.unit-progress', progressBar(unit.lessons.length ? done / unit.lessons.length : 0, 'bar-white'),
        h('span', `Пройдено уроков: ${done} из ${unit.lessons.length}`))));
    unit.lessons.forEach((lesson, k) => {
      const st = states[lesson.id];
      const isCurrent = lesson.id === current;
      const offset = ZIGZAG[k % ZIGZAG.length];
      const glyph = st === 'locked' ? 'lock' : st === 'golden' ? 'star' : st === 'completed' ? 'check' : lesson.kind === 'grammar' ? 'book' : 'play';
      const stateText = { locked: 'закрыт', available: 'доступен', completed: 'пройден', golden: 'пройден без ошибок, золотой' }[st];
      const node = h('div.node-row',
        h('div.node-wrap', { style: { transform: `translateX(${offset}px)` } },
          isCurrent && offset >= 0 ? mascot('idle', 60) : null,
          h('div.node-col',
            h('button.node', {
              type: 'button', class: `st-${st} ${isCurrent ? 'current' : ''}`, 'aria-label': `${lesson.title}, ${stateText}`,
              onclick: () => {
                sfx('tap'); feel.tap();
                if (st === 'locked') toast('Сначала пройди предыдущий урок');
                else if (heartsNow() <= 0) noHeartsDialog();
                else app.nav.go('lesson', { lessonId: lesson.id });
              },
            }, h('span.node-shine'), icon(glyph)),
            h('div.node-title', { class: isCurrent ? 'bold' : '' }, lesson.title)),
          isCurrent && offset < 0 ? mascot('idle', 60) : null));
      if (isCurrent) currentNode = node;
      list.append(node);
    });
  });

  el.append(header, barsik, levels.length > 1 ? tabs : null, list);
  return {
    el,
    onShow() {
      // Прокрутка к текущему уроку при открытии.
      if (currentNode) requestAnimationFrame(() => currentNode.scrollIntoView({ block: 'center' }));
    },
  };
}

function ring(fraction) {
  const r = 7, c = 2 * Math.PI * r;
  const span = h('span.ring');
  span.innerHTML = `<svg viewBox="0 0 18 18"><circle cx="9" cy="9" r="${r}" class="ring-track"/><circle cx="9" cy="9" r="${r}" class="ring-fill" stroke-dasharray="${(c * fraction).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 9 9)"/></svg>`;
  return span;
}
