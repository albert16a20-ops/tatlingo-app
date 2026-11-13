// Комната Барсика: тот же 3D-Барсик (three.js), забота о нём, «Угадай слово».
import { app } from '../app.js';
import { store, dayActivity } from '../store.js';
import { today, Streak, Care, TIPS, PET_LINES, TICKLE_LINES, pick, shuffle } from '../logic.js';
import { h, icon, mascot, button, chip, progressBar } from '../ui.js';
import { playVoice, stopVoice, sfx, feel } from '../audio.js';

const DURATIONS = { pet: 1400, tickle: 1300, eat: 4400, talk: 1600, happy: 900, wave: 1800 };
let tipIndex = 0;

export function roomScreen() {
  const course = app.course;
  const learnedIds = Object.keys(store.state.words);
  const learned = learnedIds.map(id => course.words[id]).filter(Boolean);
  const hasLearned = learned.length >= 3;
  const talkWords = learned.length ? learned : course.wordList.slice(0, 6);
  // Пословицы (первые две темы юнита «Пословицы и обороты») и длинные фразы из уроков — всё уже озвучено.
  const sayingsUnit = course.units.find(u => u.id.includes('sayings'));
  const proverbs = sayingsUnit
    ? [...new Set(sayingsUnit.lessons.flatMap(l => l.newWords))].slice(0, 12).map(id => course.words[id]).filter(Boolean)
        .map(w => ({ tt: w.tt, ru: w.ru, audio: w.audio }))
    : [];
  const phraseMap = new Map();
  course.units.forEach(u => u.lessons.forEach(l => l.exercises.forEach(e => {
    if (e.type === 'listening' && String(e.audio).startsWith('snt_') && e.translation && e.text.split(/\s+/).length >= 5) {
      phraseMap.set(e.audio, { tt: e.text, ru: e.translation, audio: e.audio });
    }
  })));
  const phrases = [...phraseMap.values()];
  let lastSaid = null;
  const pickNew = list => { let x; do { x = pick(list); } while (list.length > 1 && x === lastSaid); lastSaid = x; return x; };
  // Сколько Барсик «говорит»: по длине фразы
  const speakMs = text => Math.min(6500, 900 + text.length * 80);

  const stats = h('div.chips.center-row');
  const levelBox = h('div.card.level-box');
  const speech = h('div.bubble.wide.room-line');
  const stage = h('div.room-stage');
  const panel = h('div.room-panel');
  const fx = h('div.room-fx', { 'aria-hidden': 'true' });

  let ready = false, drawn = false, failed = false, quiz = null, resetTimer = null;
  const frame = h('iframe.barsik-frame', { src: 'barsik3d/index.html', title: 'Барсик в 3D', allow: 'autoplay' });
  const loader = h('div.loader');
  const fallback = h('div.room-fallback');

  const mood = () => Care.mood(store.state.settings.lastCare, Date.now(), dayActivity(store.state, today()).lessons > 0);
  const sad = () => mood() < Care.SAD_BELOW;
  const treats = () => Care.treats(store.state.player.xp, store.state.settings.treatsEaten, store.state.settings.bonusTreats);

  const js = fn => {
    try { const B = frame.contentWindow && frame.contentWindow.Barsik; if (ready && B) fn(B); } catch (e) { /* сцена не готова */ }
  };

  // Мост для 3D-сцены (в Android это window.Android из WebView).
  window.Barsik3DBridge = {
    onReady() {
      ready = true;
      js(B => { B.setCap(store.state.settings.cap); B.setSad(sad()); });
    },
    onDrawn() { drawn = true; loader.remove(); },
    onFail() { useFallback(); },
    onTap(part) { if (part === 'head') pet(); else tickle(); },
    onLog() {},
  };
  const failTimer = setTimeout(() => { if (!drawn) useFallback(); }, 12000);

  function useFallback() {
    if (failed) return;
    failed = true;
    frame.remove();
    loader.remove();
    renderFallback('idle');
  }
  function renderFallback(action) {
    if (!failed) return;
    const m = action === 'pet' || action === 'happy' || action === 'eat' ? 'celebrate' : action === 'talk' ? 'happy' : sad() ? 'sad' : 'idle';
    fallback.replaceChildren(h('div.rug'), mascot(m, 190, pet));
  }

  function renderStats() {
    const lvl = Care.level(store.state.player.xp);
    stats.replaceChildren(
      chip('heart', mood() + '%', 'chip-heart', `Настроение Барсика: ${mood()} процентов`),
      h('div.chip.chip-xp', { 'aria-label': `Угощений: ${treats()}` }, h('span', '🍯 ' + treats())),
      chip('fire', Streak.displayed(store.state.player.streak, today()), 'chip-streak', 'Серия'));
    levelBox.replaceChildren(
      h('div.strong.center', `Барсик · Уровень ${lvl.number} · ${Care.LEVEL_TITLES[lvl.number - 1]}`),
      progressBar(lvl.progress, 'bar-gold'));
  }

  function act(action, line, emoji, ms) {
    speech.textContent = line;
    if (action) js(B => B.play(action, ms || DURATIONS[action] || 1200));
    renderFallback(action);
    if (emoji) burst(emoji);
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => renderFallback('idle'), ms || DURATIONS[action] || 1200);
  }

  function burst(emoji) {
    for (let i = 0; i < 6; i++) {
      const d = h('span.fx', emoji);
      d.style.left = (30 + Math.random() * 40) + '%';
      d.style.animationDelay = (i * 0.09) + 's';
      fx.append(d);
      setTimeout(() => d.remove(), 1700);
    }
  }

  const care = () => store.update(s => { s.settings.lastCare = Date.now(); });

  function pet() { sfx('select'); feel.tap(); act('pet', pick(PET_LINES), '❤️'); care(); afterCare(); }
  function tickle() { sfx('tap'); feel.tap(); act('tickle', pick(TICKLE_LINES), '✨'); care(); afterCare(); }
  function afterCare() { js(B => B.setSad(sad())); renderStats(); }

  function feed() {
    if (treats() <= 0) { act(null, `Чәкчәк закончился 😿 За каждые ${Care.XP_PER_TREAT} XP в уроках я получаю новое угощение!`, ''); return; }
    sfx('match');
    // «Тәмле!» Барсик говорит, когда доел
    setTimeout(() => playVoice('tamle'), 3300);
    act('eat', 'Тәмле! Рәхмәт! Чәкчәк — самое вкусное на свете 😋', '🍯');
    store.update(s => { s.settings.treatsEaten += 1; s.settings.lastCare = Date.now(); });
    afterCare();
    renderPanel();
  }

  function talk() {
    const w = pick(talkWords);
    playVoice(w.audio);
    act('talk', `«${w.tt}» — это «${w.ru}». Повтори за мной!`, '💬');
  }

  function proverb() {
    if (!proverbs.length) return;
    const p = pickNew(proverbs);
    playVoice(p.audio);
    act('talk', `Мәкаль: «${p.tt}» — «${p.ru}».`, '📜', speakMs(p.tt));
  }

  function phrase() {
    if (!phrases.length) return;
    const p = pickNew(phrases);
    playVoice(p.audio);
    act('talk', `«${p.tt}» — «${p.ru}»`, '💬', speakMs(p.tt));
  }

  function tip() { act('talk', TIPS[tipIndex++ % TIPS.length], '💡'); }

  function changeCap() {
    sfx('select');
    store.update(s => { s.settings.cap = (s.settings.cap + 1) % 4; s.settings.lastCare = Date.now(); });
    js(B => B.setCap(store.state.settings.cap));
    act('happy', 'Яңа түбәтәй! Новая тюбетейка — матур, да?', '🎉');
    afterCare();
  }

  function startQuiz() {
    if (!hasLearned) { act(null, 'Сначала пройди пару уроков — тогда я буду загадывать слова!', ''); return; }
    const word = pick(learned);
    const wrong = [...new Set(shuffle(course.wordList.filter(w => w.id !== word.id && w.ru !== word.ru)).slice(0, 8).map(w => w.ru))].slice(0, 2);
    quiz = { word, options: shuffle([...wrong, word.ru]), answer: null };
    playVoice(word.audio);
    act('talk', `Что я сказал? «${word.tt}»`, '❓');
    renderPanel();
  }

  function answerQuiz(opt) {
    if (!quiz || quiz.answer) return;
    quiz.answer = opt;
    if (opt === quiz.word.ru) {
      sfx('correct'); feel.ok();
      act('pet', `Дөрес! «${quiz.word.tt}» — это «${quiz.word.ru}». Ты молодец! 🎉`, '🎉');
      care(); afterCare();
    } else {
      sfx('wrong'); feel.bad();
      act('talk', `Юк-юк! «${quiz.word.tt}» — это «${quiz.word.ru}». Попробуем ещё?`, '🤔');
    }
    renderPanel();
  }

  function renderPanel() {
    if (quiz) {
      const solved = !!quiz.answer;
      panel.replaceChildren(
        ...quiz.options.map(o => button(o, () => answerQuiz(o), {
          kind: !solved ? 'primary' : o === quiz.word.ru ? 'success' : o === quiz.answer ? 'danger' : 'muted',
        })),
        h('div.btn-row',
          button('🔊 ' + quiz.word.tt, () => playVoice(quiz.word.audio), { kind: 'secondary' }),
          solved ? button('Далее', startQuiz, { kind: 'secondary' }) : button('Закрыть', () => { quiz = null; renderPanel(); }, { kind: 'secondary' })),
        solved ? button('Закрыть', () => { quiz = null; renderPanel(); }, { kind: 'secondary' }) : null);
      return;
    }
    panel.replaceChildren(
      h('div.btn-row',
        button('💬 Поговорить', () => app.nav.go('chats')),
        button('🎲 Угадай слово', startQuiz, { kind: 'orange' })),
      h('div.btn-row',
        button(`Угостить (${treats()})`, feed, { kind: 'gold' }),
        button('Скажи слово', talk)),
      h('div.btn-row',
        button('📜 Пословица', proverb, { kind: 'secondary' }),
        button('🗣 Длинная фраза', phrase, { kind: 'secondary' })),
      h('div.btn-row',
        button('Совет', tip, { kind: 'secondary' }),
        button('Тюбетейка', changeCap, { kind: 'secondary' })));
  }

  stage.append(fallback, frame, loader, fx);
  renderStats();
  renderPanel();
  speech.textContent = sad() ? 'Я так соскучился… Погладь меня, пожалуйста!' : 'Сәлам! Заходи в гости! Погладь меня или угости чәкчәком!';

  const el = h('div.room',
    h('header.topbar',
      !app.tg ? h('button.icon-btn', { type: 'button', 'aria-label': 'Назад', onclick: () => app.nav.back() }, icon('back')) : null,
      h('h1.screen-title', 'Комната Барсика')),
    stats, levelBox, speech, stage,
    h('p.muted.small.center', 'Погладь голову · пощекочи животик · поверни Барсика пальцем'),
    panel);
  return {
    el,
    onHide() { clearTimeout(failTimer); clearTimeout(resetTimer); stopVoice(); delete window.Barsik3DBridge; },
  };
}
