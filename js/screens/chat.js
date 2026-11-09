// Переписка с Барсиком по сценариям (dialogs.json) — как в приложении, без голосового ввода.
import { app } from '../app.js';
import { DialogEngine, buildSpellings } from '../logic.js';
import { h, icon, mascot, barsikSpeech, button, letterBar } from '../ui.js';
import { playVoice, stopVoice, sfx } from '../audio.js';

const COLORS = ['u0', 'u1', 'u2', 'u3'];

export function chatListScreen() {
  const dialogs = app.course.dialogs;
  const el = h('div.page',
    h('header.topbar', h('h1.screen-title', 'Поболтать с Барсиком')),
    barsikSpeech('Сәлам! Давай переписываться по-татарски. Выбери тему — я начну разговор, а ты отвечай как умеешь. Если не знаешь, что сказать, нажми на подсказку.', 'happy', { size: 72, onMascot: () => app.nav.go('room') }),
    h('div.list', dialogs.map((d, i) => h('button.card.dialog-card', { type: 'button', onclick: () => app.nav.go('chat', { id: d.id }) },
      h('span.dialog-emoji', { class: COLORS[i % 4] }, d.emoji || '💬'),
      h('div.grow', h('b', d.title), d.description ? h('div.muted.small', d.description) : null),
      h('span.pill', d.level || 'A1')))));
  return { el };
}

export function chatScreen({ id }) {
  const course = app.course;
  const dialog = course.dialogs.find(d => d.id === id);
  const texts = [
    ...course.wordList.map(w => w.tt),
    ...Object.values(dialog.steps).flatMap(s => [s.say, ...(s.suggest || []), ...(s.replies || []).map(r => r.say || '')]),
  ];
  const engine = new DialogEngine(dialog, buildSpellings(texts));
  let typing = false;
  let timers = [];

  const feed = h('div.chat-feed', { 'aria-live': 'polite' });
  const suggestions = h('div.suggest');
  const input = h('input.text-input.chat-input', {
    type: 'text', placeholder: 'Напиши по-татарски…', autocomplete: 'off', autocorrect: 'off', autocapitalize: 'sentences', spellcheck: 'false', enterkeyhint: 'send',
    onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); submit(input.value); } },
  });
  const bar = letterBar(input);
  const sendBtn = h('button.send', { type: 'button', 'aria-label': 'Отправить', onclick: () => submit(input.value) }, icon('send'));
  const composer = h('div.composer', bar, h('div.composer-row', input, sendBtn));
  const endActions = h('div.chat-end');

  const el = h('div.chat',
    h('header.topbar',
      !app.tg ? h('button.icon-btn', { type: 'button', 'aria-label': 'Назад', onclick: () => app.nav.back() }, icon('back')) : null,
      h('h1.screen-title', `${dialog.emoji || '💬'} ${dialog.title}`)),
    h('p.muted.small.center', 'Нажми на сообщение Барсика — увидишь перевод'),
    feed, suggestions, endActions, composer);

  const scroll = () => requestAnimationFrame(() => { feed.scrollTop = feed.scrollHeight; });

  function bubble(line, fromUser) {
    if (fromUser) return h('div.msg.user', line.text);
    if (line.kind === 'note') return h('div.msg.note', line.text);
    const ru = h('div.msg-ru', line.ru || '');
    ru.hidden = true;
    const b = h('div.msg.bot', {
      onclick: () => { if (line.ru) ru.hidden = !ru.hidden; if (line.audio) playVoice(line.audio); scroll(); },
    }, h('div', line.text), line.ru ? ru : null);
    return h('div.msg-row', mascot('happy', 34), b);
  }

  function botSays(lines) {
    if (!lines.length) { updateComposer(); return; }
    typing = true;
    updateComposer();
    const dots = h('div.msg-row.typing', mascot('thinking', 34), h('div.msg.bot.dots', h('span'), h('span'), h('span')));
    feed.append(dots);
    scroll();
    let delay = 0;
    lines.forEach((line, i) => {
      delay += line.kind === 'note' ? 250 : 650;
      timers.push(setTimeout(() => {
        dots.before(bubble(line, false));
        if (line.kind === 'say' && line.audio) playVoice(line.audio);
        if (i === lines.length - 1) {
          dots.remove();
          typing = false;
          if (engine.finished) sfx('complete');
          updateComposer();
        }
        scroll();
      }, delay));
    });
  }

  function updateComposer() {
    const finished = engine.finished && !typing;
    composer.hidden = finished;
    suggestions.replaceChildren(...(!typing && !engine.finished ? (engine.step.suggest || []) : [])
      .map(t => h('button.fchip', { type: 'button', onclick: () => submit(t) }, t)));
    endActions.replaceChildren(...(finished ? [
      button('Поговорить ещё раз', restart),
      button('Другие темы', () => app.nav.back(), { kind: 'secondary' }),
    ] : []));
    sendBtn.disabled = typing;
    scroll();
  }

  function submit(text) {
    const clean = String(text).trim();
    if (!clean || engine.finished || typing) return;
    sfx('tap');
    input.value = '';
    feed.append(bubble({ text: clean }, true));
    suggestions.replaceChildren();
    botSays(engine.answer(clean));
  }

  function restart() {
    timers.forEach(clearTimeout);
    timers = [];
    feed.replaceChildren();
    botSays(engine.start());
  }

  restart();
  return {
    el,
    onHide() { timers.forEach(clearTimeout); stopVoice(); },
  };
}
