// Урок и повторение: очередь заданий, проверка, жизни, итог (как LessonViewModel + CompleteLessonUseCase).
import { app } from '../app.js';
import { store, dueWords, weakestWords } from '../store.js';
import {
  buildLesson, buildReview, checkAnswer, isAccepted, qualityOf, Quality, Sm2, Streak, Hearts, calcXp,
  today, comboCheer, ACHIEVEMENTS, PRAISE, pick, shuffle,
} from '../logic.js';
import { h, icon, mascot, button, speakerButton, progressBar, toast, modal, letterBar, confetti, barsikSpeech } from '../ui.js';
import { playVoice, stopVoice, hasAudio, sfx, feel } from '../audio.js';
import { heartsNow } from './path.js';

const BARSIK_LINE_MS = 3500;

export function lessonScreen({ lessonId, review }) {
  const course = app.course;
  const el = h('div.lesson');
  const isReview = !!review;
  let lesson = null, exercises = [];

  if (isReview) {
    const day = today();
    const due = dueWords(store.state, day, 8);
    const ids = due.length ? due : weakestWords(store.state, 8);
    exercises = buildReview(ids.map(id => course.words[id]).filter(Boolean), course);
  } else {
    lesson = course.lessons[lessonId];
    if (lesson) exercises = buildLesson(lesson, course);
  }

  const queue = [...exercises];
  const total = exercises.length;
  const failedOnce = new Set();
  const wordQ = {};
  let done = 0, answersGiven = 0, mistakes = 0, combo = 0, lastRequeued = false;
  let startedAt = Date.now();
  let hearts = heartsNow();
  let current = null, answer = null, feedback = null;
  let finished = false, confirmedExit = false;

  const topbar = h('div.lesson-top');
  const lineHost = h('div.lesson-line');
  const body = h('div.lesson-body');
  const footer = h('div.lesson-footer');
  el.append(topbar, lineHost, body, footer);

  let lineTimer = null;
  function barsikSay(text, mood) {
    lineHost.replaceChildren(barsikSpeech(text, mood, { size: 52, onMascot: () => lineHost.classList.remove('show') }));
    lineHost.classList.add('show');
    clearTimeout(lineTimer);
    lineTimer = setTimeout(() => lineHost.classList.remove('show'), BARSIK_LINE_MS);
  }

  function renderTop() {
    const frac = total ? done / total : 0;
    topbar.replaceChildren(
      h('button.icon-btn', { type: 'button', 'aria-label': 'Закрыть урок', onclick: () => app.nav.back() }, icon('close')),
      progressBar(finished ? 1 : frac, 'bar-lesson'),
      h('div.chip.chip-heart', { 'aria-label': isReview ? 'Жизни не тратятся' : `Жизни: ${hearts}` }, icon('heart'), h('span', isReview ? '∞' : hearts)));
  }

  function message(mood, text, buttons) {
    topbar.replaceChildren();
    footer.replaceChildren();
    body.replaceChildren(h('div.message', mascot(mood, 140), h('p', text), ...buttons));
  }

  // ---------- Фазы ----------
  function start() {
    if (!exercises.length) {
      message('thinking', isReview ? 'Пока нечего повторять — пройди первый урок!' : 'Не удалось загрузить урок.',
        [button('Назад', () => app.nav.back())]);
      finished = true;
      return;
    }
    if (!isReview && hearts <= 0) { outOfHearts(); return; }
    const note = lesson && lesson.grammarNote && course.grammar[lesson.grammarNote];
    if (note) grammarIntro(note); else beginExercises();
  }

  function grammarIntro(note) {
    renderTop();
    body.replaceChildren(grammarNote(note));
    footer.replaceChildren(button('К заданиям', beginExercises));
  }

  function beginExercises() {
    startedAt = Date.now();
    barsikSay(isReview || !lesson ? 'Повторяем трудные слова. Здесь жизни не тратятся — не бойся ошибаться!' : `Поехали! Тема урока: ${lesson.title}`, 'happy');
    showExercise(queue[0]);
  }

  function outOfHearts() {
    message('sad', 'Жизни закончились. Жизни восстанавливаются по одной каждые 4 часа. А урок-повторение вернёт одну жизнь прямо сейчас!', [
      button('К повторению', () => { finished = true; app.nav.replace('lesson', { review: true }); }),
      button('Назад', () => { finished = true; app.nav.back(); }, { kind: 'secondary' }),
    ]);
  }

  // ---------- Задание ----------
  function setAnswer(a) {
    if (feedback) return;
    answer = a && String(a).trim() ? a : null;
    const btn = footer.querySelector('.check');
    if (btn) btn.disabled = !answer;
  }

  function showExercise(ex) {
    current = ex;
    answer = null;
    feedback = null;
    renderTop();
    const view = renderExercise(ex, { setAnswer, check, locked: () => !!feedback });
    view.classList.add('ex-enter');
    body.replaceChildren(view);
    body.scrollTop = 0;
    footer.replaceChildren(ex.type === 'matching' ? h('div') : button('Проверить', check, { cls: 'check', disabled: true }));
    const auto = view.querySelector('[data-autofocus]');
    if (auto) setTimeout(() => auto.focus({ preventScroll: true }), 300);
  }

  function check() {
    if (!current || !answer || feedback) return;
    const ex = current;
    const result = checkAnswer(answer, ex.accepted, ex.type === 'typing');
    answersGiven++;
    const q = qualityOf(result, failedOnce.has(ex.id));
    ex.words.forEach(id => { wordQ[id] = Math.min(wordQ[id] ?? Quality.PERFECT, q); });
    if (isAccepted(result)) {
      sfx('correct'); feel.ok();
      lastRequeued = false;
      combo++;
      if (comboCheer(combo)) barsikSay(`${combo} подряд без ошибок! Шәп!`, 'celebrate');
    } else {
      sfx('wrong'); feel.bad();
      mistakes++;
      combo = 0;
      lastRequeued = !failedOnce.has(ex.id);
      if (lastRequeued) { failedOnce.add(ex.id); queue.push(ex); }
      if (!isReview) {
        hearts = Math.max(0, hearts - 1);
        store.update(s => { s.player.hearts = Hearts.remove(s.player.hearts, Date.now()); });
        if (hearts === 1) barsikSay('Осторожно, осталась одна жизнь!', 'sad');
      }
    }
    feedback = result;
    body.querySelectorAll('button, input').forEach(b => { if (!b.classList.contains('speaker')) b.disabled = true; });
    renderTop();
    footer.replaceChildren(feedbackPanel(result, ex, next));
  }

  function next() {
    if (!feedback) return;
    queue.shift();
    if (!lastRequeued) done++;
    lastRequeued = false;
    if (!isReview && hearts <= 0) { outOfHearts(); return; }
    if (queue.length) showExercise(queue[0]); else finish();
  }

  function finish() {
    finished = true;
    sfx('complete');
    const seconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
    const outcome = completeLesson({
      lessonId: isReview ? 'review' : lesson.id, isReview, count: total, answersGiven, mistakes, seconds,
      wordQ, newWords: isReview ? [] : lesson.newWords,
    });
    app.nav.replace('result', outcome);
  }

  start();
  // Для автопроверки на локальном сервере: можно пройти урок скриптом.
  if (location.hostname === 'localhost') window.__lesson = { get current() { return current; }, setAnswer, check, next };

  return {
    el,
    sheet: true,
    onShow() { if (app.tg) try { app.tg.enableClosingConfirmation(); } catch (e) {} },
    onHide() {
      stopVoice();
      clearTimeout(lineTimer);
      if (app.tg) try { app.tg.disableClosingConfirmation(); } catch (e) {}
    },
    onBack() {
      if (finished || confirmedExit) return true;
      modal('Выйти из урока?', 'Прогресс этого урока не сохранится.', [
        { text: 'Остаться' },
        { text: 'Выйти', kind: 'danger', onClick: () => { confirmedExit = true; app.nav.back(); } },
      ]);
      return false;
    },
  };
}

// ---------- Итоги урока ----------
function completeLesson(r) {
  const now = Date.now();
  const day = today();
  const xp = calcXp(r.count, r.mistakes, r.seconds);
  const accuracy = r.answersGiven === 0 ? 100 : Math.min(100, Math.max(0, Math.floor((r.answersGiven - r.mistakes) * 100 / r.answersGiven)));
  const perfect = r.mistakes === 0;
  let streak = 0;
  const fresh = [];
  store.update(s => {
    const p = s.player;
    p.streak = Streak.register(p.streak, day);
    streak = p.streak.streak;
    p.hearts = Hearts.regenerate(p.hearts, now);
    if (r.isReview) p.hearts = Hearts.add(p.hearts, now);
    p.xp += xp.total;
    if (!r.isReview) p.lessons += 1;
    if (perfect && !r.isReview) p.perfect += 1;
    if (r.isReview) p.reviews += 1;

    if (!r.isReview) {
      const lp = s.lessons[r.lessonId];
      s.lessons[r.lessonId] = { count: (lp ? lp.count : 0) + 1, best: Math.max(lp ? lp.best : 0, accuracy), at: now };
    }
    const d = s.days[day] || { xp: 0, lessons: 0, perfect: 0, seconds: 0 };
    s.days[day] = { xp: d.xp + xp.total, lessons: d.lessons + 1, perfect: d.perfect + (perfect && !r.isReview ? 1 : 0), seconds: d.seconds + r.seconds };
    // Старше месяца статистика по дням не нужна.
    Object.keys(s.days).forEach(k => { if (Number(k) < day - 31) delete s.days[k]; });

    const ids = [...new Set([...Object.keys(r.wordQ), ...r.newWords])];
    ids.forEach(id => {
      const q = r.wordQ[id] ?? Quality.ALMOST;
      const cur = s.words[id];
      const sm = Sm2.review(cur ? { rep: cur.rep, int: cur.int, ef: cur.ef, due: cur.due } : Sm2.initial(day), q, day);
      s.words[id] = { ...sm, seen: (cur ? cur.seen : 0) + 1, ok: (cur ? cur.ok : 0) + (q >= 3 ? 1 : 0), at: cur ? cur.at : now };
    });

    const stats = { xp: p.xp, streak, lessons: p.lessons, perfect: p.perfect, words: Object.keys(s.words).length, reviews: p.reviews };
    ACHIEVEMENTS.forEach(a => {
      if (!s.achievements[a.id] && a.ok(stats)) { s.achievements[a.id] = now; fresh.push(a.id); }
    });
  });
  return { xp, accuracy, seconds: r.seconds, perfect, streak, achievements: fresh, isReview: r.isReview };
}

export function resultScreen(o) {
  const title = o.isReview ? 'Повторение завершено! +1 жизнь' : o.perfect ? 'Без единой ошибки! Афәрин!' : 'Урок пройден!';
  const comment = o.isReview ? 'Повторение завершено — держи жизнь! ❤️'
    : o.perfect ? 'Хатасыз! Ни одной ошибки — я горжусь тобой!'
    : o.accuracy >= 80 ? 'Шәп! Отличный результат. Слова с ошибками я добавлю в повторение.'
    : 'Хорошее начало! Трудные слова вернутся в повторении — так они точно запомнятся.';
  const xpValue = h('div.stat-value', '+0');
  const bonus = o.xp.perfect + o.xp.speed;
  const el = h('div.result',
    h('div.result-scroll',
      mascot(o.perfect ? 'celebrate' : 'happy', 150),
      h('h1.center', title),
      h('div.bubble.wide', comment),
      h('div.stats',
        h('div.stat.gold', { 'aria-label': `Получено ${o.xp.total} XP` }, h('div.stat-label', 'Опыт'), xpValue),
        h('div.stat.green', { 'aria-label': `Точность ${o.accuracy} процентов` }, h('div.stat-label', 'Точность'), h('div.stat-value', o.accuracy + '%')),
        h('div.stat.teal', h('div.stat-label', 'Время'), h('div.stat-value', `${Math.floor(o.seconds / 60)}:${String(o.seconds % 60).padStart(2, '0')}`))),
      bonus > 0 ? h('p.center', `${o.xp.base} базовых XP + ${bonus} бонусных`) : null,
      h('p.center.strong', `Серия: ${o.streak} дн.`),
      o.achievements.length ? [
        h('h2', 'Новые достижения'),
        ...o.achievements.map(id => {
          const a = ACHIEVEMENTS.find(x => x.id === id);
          return h('div.ach-new', h('span.ach-emoji', a.emoji), h('div', h('b', a.title), h('div', a.desc)));
        }),
      ] : null),
    button('Продолжить', () => app.nav.back()));
  return {
    el,
    sheet: true,
    onShow() {
      confetti(o.perfect ? 140 : 70);
      const startT = performance.now();
      (function tick(t) {
        const k = Math.min(1, (t - startT) / 1200);
        xpValue.textContent = '+' + Math.round(o.xp.total * k);
        if (k < 1) requestAnimationFrame(tick);
      })(startT);
    },
  };
}

// ---------- Отрисовка заданий ----------
function renderExercise(ex, api) {
  switch (ex.type) {
    case 'choice': return choiceView(ex, api);
    case 'tiles': return tilesView(ex.direction === 'ru_tt' ? 'Собери перевод' : 'Собери перевод', ex.prompt, ex.tiles, api, ex.audio);
    case 'typing': return typingView(ex, api);
    case 'listening': return listeningView(ex, api);
    case 'matching': return matchingView(ex, api);
    case 'fill_blank': return fillView(ex, api);
    default: return h('div', 'Неизвестное задание');
  }
}

function layout(title, ...children) {
  return h('div.ex', h('h2.ex-title', title), ...children);
}

function promptRow(text, audioKey) {
  const play = audioKey && hasAudio(audioKey) ? () => { if (!playVoice(audioKey)) toast('Для этого слова записи пока нет — скоро появится'); } : null;
  return h('div.prompt-row', play ? speakerButton(play) : null, h('div.prompt', text));
}

function optionList(options, api, cls = '') {
  const wrap = h('div.options', { class: cls, role: 'radiogroup' });
  options.forEach(opt => {
    const b = h('button.option', {
      type: 'button', role: 'radio', 'aria-checked': 'false',
      onclick: () => {
        if (api.locked()) return;
        sfx('select'); feel.tap();
        wrap.querySelectorAll('.option').forEach(o => { o.classList.remove('selected'); o.setAttribute('aria-checked', 'false'); });
        b.classList.add('selected');
        b.setAttribute('aria-checked', 'true');
        api.setAnswer(opt);
        if (api.onSelect) api.onSelect(opt);
      },
    }, opt);
    wrap.append(b);
  });
  return wrap;
}

function choiceView(ex, api) {
  return layout(ex.direction === 'tt_ru' ? 'Выбери перевод' : 'Выбери правильный вариант',
    promptRow(ex.prompt, ex.audio),
    ex.image ? h('div.emoji-pic', { 'aria-hidden': 'true' }, ex.image) : null,
    optionList(ex.options, api));
}

function typingView(ex, api) {
  const toTatar = ex.direction === 'ru_tt';
  const input = h('input.text-input', {
    type: 'text', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'done',
    placeholder: toTatar ? 'Ответ по-татарски' : 'Ответ по-русски', 'data-autofocus': true,
    oninput: e => api.setAnswer(e.target.value),
    onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); api.check(); } },
  });
  return layout(toTatar ? 'Напиши по-татарски' : 'Напиши по-русски',
    promptRow(ex.prompt, ex.audio),
    input,
    toTatar ? letterBar(input, v => api.setAnswer(v)) : null,
    toTatar ? h('p.muted.small', 'Буквы Ә Ө Ү Җ Ң Һ — на панели под полем') : null);
}

function listeningView(ex, api) {
  const available = hasAudio(ex.audio);
  const play = () => { if (!playVoice(ex.audio)) toast('Для этого слова записи пока нет — скоро появится'); };
  if (available) play();
  const header = [
    h('div.center-row', speakerButton(play, true)),
    !available ? h('div.placeholder-card', h('div.small', 'Запись носителя скоро появится. Пока прочитай:'), h('div.prompt', ex.text)) : null,
  ];
  if (ex.mode === 'tiles') return tilesView('Послушай и собери фразу', null, ex.options, api, null, header);
  return layout('Послушай и выбери', ...header, optionList(ex.options, api));
}

function tilesView(title, prompt, tiles, api, audioKey, header = []) {
  const bank = shuffle(tiles);
  const chosen = [];
  const answerArea = h('div.answer-area', { 'aria-live': 'polite' });
  const bankArea = h('div.bank');
  const hint = h('p.muted.small', 'Нажимай на слова, чтобы собрать ответ');
  const render = () => {
    answerArea.replaceChildren(...chosen.map(i => h('button.tile', {
      type: 'button',
      onclick: () => { if (api.locked()) return; sfx('tap'); chosen.splice(chosen.indexOf(i), 1); report(); },
    }, bank[i])));
    bankArea.replaceChildren(...bank.map((w, i) => chosen.includes(i)
      ? h('span.tile.placeholder', { 'aria-hidden': 'true' }, w)
      : h('button.tile', { type: 'button', onclick: () => { if (api.locked()) return; sfx('tap'); feel.tap(); chosen.push(i); report(); } }, w)));
    hint.style.display = chosen.length ? 'none' : '';
  };
  const report = () => { render(); api.setAnswer(chosen.length ? chosen.map(i => bank[i]).join(' ') : null); };
  render();
  return layout(title, ...header, prompt != null ? promptRow(prompt, audioKey) : null, answerArea, hint, bankArea);
}

function matchingView(ex, api) {
  const left = shuffle(ex.pairs.map(p => p[0]));
  const right = shuffle(ex.pairs.map(p => p[1]));
  const matched = new Set();
  let selL = null, selR = null;
  const colL = h('div.match-col'), colR = h('div.match-col');
  const btnsL = {}, btnsR = {};
  const isPair = (t, r) => ex.pairs.some(p => p[0] === t && p[1] === r);
  const refresh = () => {
    left.forEach(t => { btnsL[t].className = 'match ' + (matched.has(t) ? 'done' : selL === t ? 'selected' : ''); btnsL[t].disabled = matched.has(t); });
    right.forEach(r => {
      const done = ex.pairs.some(p => p[1] === r && matched.has(p[0]));
      btnsR[r].className = 'match ' + (done ? 'done' : selR === r ? 'selected' : '');
      btnsR[r].disabled = done;
    });
  };
  const tryMatch = () => {
    if (selL == null || selR == null) { sfx('select'); feel.tap(); refresh(); return; }
    if (isPair(selL, selR)) {
      matched.add(selL);
      if (matched.size === ex.pairs.length) { selL = selR = null; refresh(); api.setAnswer('matched'); api.check(); return; }
      sfx('match'); feel.tap();
    } else {
      sfx('wrong'); feel.bad();
      const a = btnsL[selL], b = btnsR[selR];
      [a, b].forEach(x => { x.classList.add('wrong'); setTimeout(() => x.classList.remove('wrong'), 600); });
    }
    selL = selR = null;
    setTimeout(refresh, 0);
  };
  left.forEach(t => { btnsL[t] = h('button.match', { type: 'button', onclick: () => { selL = t; tryMatch(); } }, t); colL.append(btnsL[t]); });
  right.forEach(r => { btnsR[r] = h('button.match', { type: 'button', onclick: () => { selR = r; tryMatch(); } }, r); colR.append(btnsR[r]); });
  refresh();
  return layout('Найди пары', h('div.match-grid', colL, colR));
}

function fillView(ex, api) {
  const blank = h('span.blank', '＿＿');
  const opts = optionList(ex.options, { ...api, onSelect: o => { blank.textContent = o; } }, 'options-grid');
  return layout('Заполни пропуск',
    h('div.fill-sentence', ex.before, blank, ex.after),
    ex.translation ? h('p.muted', ex.translation) : null,
    opts);
}

function feedbackPanel(result, ex, onContinue) {
  const kind = result.kind;
  const title = kind === 'correct' ? pick(PRAISE)
    : kind === 'almost' ? (result.reason === 'letter' && result.letter ? `Почти! Обрати внимание на букву ${result.letter}`
      : result.reason === 'letter' ? 'Почти! Обрати внимание на татарские буквы' : 'Небольшая опечатка — засчитано!')
    : 'Неправильно';
  const transcript = ex.type === 'listening' ? ex.text + (ex.translation ? ' — ' + ex.translation : '') : null;
  const detail = kind === 'correct' ? transcript : `Правильно: ${result.expected}`;
  const ok = kind !== 'wrong';
  return h('div.feedback', { class: 'fb-' + kind, role: 'status' },
    h('div.fb-row',
      h('div.fb-mascot', mascot(ok ? 'happy' : 'sad', 60), h('span.fb-badge', icon(ok ? 'check' : 'close'))),
      h('div.fb-text', h('div.fb-title', title), detail ? h('div.fb-detail', detail) : null,
        !ok && ex.hint ? h('div.fb-hint', ex.hint) : null)),
    button('Продолжить', onContinue, { kind: ok ? 'primary' : 'danger' }));
}

// ---------- Грамматическая справка ----------
export function grammarNote(note) {
  const legend = note.showLegend !== false
    ? h('div.legend', h('span.seg-root', 'корень'), '  ·  ', h('span.seg-affix', 'аффикс'))
    : null;
  return h('div.grammar',
    h('div.grammar-head', mascot('thinking', 72), h('h2', note.title)),
    ...note.paragraphs.map(p => h('p', p)),
    legend,
    ...(note.examples || []).map(ex => h('div.example',
      h('div.example-text',
        h('div.example-tt', ...ex.parts.map(part => h('span', { class: part.role === 'root' ? 'seg-root' : part.role === 'affix' ? 'seg-affix' : '' }, part.text))),
        h('div.muted', ex.translation)),
      ex.audio && hasAudio(ex.audio) ? speakerButton(() => playVoice(ex.audio)) : null)));
}
