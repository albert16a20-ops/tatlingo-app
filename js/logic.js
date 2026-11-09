// Логика курса — перенос domain/logic из Android-версии один в один,
// чтобы уроки, проверка ответов, повторение и серии работали так же.

// ---------- Татарский текст ----------
export const SPECIAL_LETTERS = ['ә', 'ө', 'ү', 'җ', 'ң', 'һ'];
const LOOKALIKES = { 'ә': 'а', 'ө': 'о', 'ү': 'у', 'җ': 'ж', 'ң': 'н', 'һ': 'х' };
const VARIANTS = {
  'ё': 'е', 'ə': 'ә', 'ӓ': 'ә', 'ö': 'ө', 'ӧ': 'ө', 'ü': 'ү', 'ӱ': 'ү',
  'ñ': 'ң', 'ӈ': 'ң', 'ӂ': 'җ', 'ҳ': 'һ',
};
const LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;

export const TatarText = {
  normalize(text) {
    let out = '';
    for (const raw of String(text).toLowerCase()) {
      const ch = VARIANTS[raw] || raw;
      out += LETTER_OR_DIGIT.test(ch) ? ch : ' ';
    }
    return out.trim().replace(/\s+/g, ' ');
  },
  fold(text) {
    let out = '';
    for (const ch of text) out += LOOKALIKES[ch] || ch;
    return out;
  },
  hasSpecial(text) {
    for (const ch of text) if (SPECIAL_LETTERS.includes(ch)) return true;
    return false;
  },
  firstConfusedLetter(answer, expected) {
    const a = [...answer], e = [...expected];
    if (a.length === e.length) {
      for (let i = 0; i < e.length; i++) {
        if (e[i] === a[i]) continue;
        if (SPECIAL_LETTERS.includes(e[i]) && LOOKALIKES[e[i]] === a[i]) return e[i];
        if (SPECIAL_LETTERS.includes(a[i]) && LOOKALIKES[a[i]] === e[i]) return a[i];
      }
    }
    const count = (arr, l) => arr.filter(c => c === l).length;
    return SPECIAL_LETTERS.find(l => count(e, l) > count(a, l)) || null;
  },
};

export function levenshtein(a, b) {
  if (a === b) return 0;
  const x = [...a], y = [...b];
  if (!x.length) return y.length;
  if (!y.length) return x.length;
  let prev = Array.from({ length: y.length + 1 }, (_, i) => i);
  let cur = new Array(y.length + 1);
  for (let i = 1; i <= x.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, cur] = [cur, prev];
  }
  return prev[y.length];
}

// ---------- Проверка ответов ----------
const MIN_LENGTH_FOR_TYPO = 4;

/** {kind:'correct'} | {kind:'almost', expected, reason:'letter'|'typo', letter} | {kind:'wrong', expected} */
export function checkAnswer(input, accepted, allowTypos = true) {
  const answer = TatarText.normalize(input);
  if (!answer) return { kind: 'wrong', expected: accepted[0] };
  const candidates = accepted.map(a => [a, TatarText.normalize(a)]);
  if (candidates.some(([, e]) => e === answer)) return { kind: 'correct' };

  const foldedAnswer = TatarText.fold(answer);
  for (const [original, expected] of candidates) {
    if (!TatarText.hasSpecial(expected) && !TatarText.hasSpecial(answer)) continue;
    const foldedExpected = TatarText.fold(expected);
    const same = foldedAnswer === foldedExpected;
    const typo = allowTypos && [...expected].length >= MIN_LENGTH_FOR_TYPO && levenshtein(foldedAnswer, foldedExpected) <= 1;
    if (!same && !typo) continue;
    const letter = TatarText.firstConfusedLetter(answer, expected);
    if (letter) return { kind: 'almost', expected: original, reason: 'letter', letter: letter.toUpperCase() };
  }
  if (allowTypos) {
    for (const [original, expected] of candidates) {
      if ([...expected].length >= MIN_LENGTH_FOR_TYPO && levenshtein(answer, expected) <= 1) {
        return { kind: 'almost', expected: original, reason: 'typo' };
      }
    }
  }
  return { kind: 'wrong', expected: accepted[0] };
}

export const isAccepted = r => r.kind !== 'wrong';

export const Quality = { PERFECT: 5, ALMOST: 4, AFTER_MISTAKE: 3, WRONG: 2 };
export function qualityOf(result, hadMistakeBefore) {
  if (!isAccepted(result)) return Quality.WRONG;
  if (hadMistakeBefore) return Quality.AFTER_MISTAKE;
  if (result.kind === 'almost') return Quality.ALMOST;
  return Quality.PERFECT;
}

// ---------- SM-2 ----------
export const Sm2 = {
  initial: today => ({ rep: 0, int: 0, ef: 2.5, due: today }),
  review(state, quality, today) {
    const diff = 5 - quality;
    const ef = Math.max(1.3, state.ef + (0.1 - diff * (0.08 + diff * 0.02)));
    if (quality < 3) return { rep: 0, int: 1, ef, due: today + 1 };
    const int = state.rep === 0 ? 1 : state.rep === 1 ? 6 : Math.max(1, Math.round(state.int * state.ef));
    return { rep: state.rep + 1, int, ef, due: today + int };
  },
};

// ---------- Время ----------
/** Номер дня по местному календарю (как LocalDate.toEpochDay). */
export function today(now = new Date()) {
  return Math.floor(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000);
}

// ---------- XP, серия, жизни ----------
export const XP = { BASE: 10, PERFECT: 5, SPEED: 5, FAST_SECONDS: 10 };
export function calcXp(count, mistakes, seconds) {
  if (count <= 0) return { base: 0, perfect: 0, speed: 0, total: 0 };
  const perfect = mistakes === 0 ? XP.PERFECT : 0;
  const speed = seconds >= 1 && seconds <= count * XP.FAST_SECONDS ? XP.SPEED : 0;
  return { base: XP.BASE, perfect, speed, total: XP.BASE + perfect + speed };
}

export const Streak = {
  weekIndex: day => Math.floor((day + 3) / 7),
  refresh(s, day) {
    const week = Streak.weekIndex(day);
    return week !== s.freezeWeek ? { ...s, freezes: 1, freezeWeek: week } : s;
  },
  register(state, day) {
    const s = Streak.refresh(state, day);
    if (s.last == null) return { ...s, streak: 1, last: day };
    const gap = day - s.last;
    if (gap <= 0) return s;
    if (gap === 1) return { ...s, streak: s.streak + 1, last: day };
    if (gap === 2 && s.freezes > 0) return { ...s, streak: s.streak + 1, last: day, freezes: s.freezes - 1 };
    return { ...s, streak: 1, last: day };
  },
  displayed(s, day) {
    if (s.last == null) return 0;
    const gap = day - s.last;
    if (gap <= 1) return s.streak;
    if (gap === 2 && Streak.refresh(s, day).freezes > 0) return s.streak;
    return 0;
  },
};

export const Hearts = {
  MAX: 5,
  REGEN: 4 * 60 * 60 * 1000,
  regenerate(h, now) {
    if (h.count >= Hearts.MAX) return { count: Hearts.MAX, at: now };
    const gained = Math.floor((now - h.at) / Hearts.REGEN);
    if (gained <= 0) return h;
    const count = Math.min(Hearts.MAX, h.count + gained);
    return { count, at: count >= Hearts.MAX ? now : h.at + gained * Hearts.REGEN };
  },
  remove(h, now) {
    const c = Hearts.regenerate(h, now);
    if (c.count <= 0) return c;
    return { count: c.count - 1, at: c.count >= Hearts.MAX ? now : c.at };
  },
  add(h, now) {
    const c = Hearts.regenerate(h, now);
    const count = Math.min(Hearts.MAX, c.count + 1);
    return { count, at: count >= Hearts.MAX ? now : c.at };
  },
  millisToNext(h, now) {
    const c = Hearts.regenerate(h, now);
    return c.count >= Hearts.MAX ? null : Math.max(0, c.at + Hearts.REGEN - now);
  },
};

// ---------- Достижения и задания дня ----------
export const ACHIEVEMENTS = [
  { id: 'FIRST_STEP', emoji: '👣', title: 'Беренче адым', desc: 'Первый пройденный урок', ok: s => s.lessons >= 1 },
  { id: 'FLAWLESS', emoji: '🎯', title: 'Хатасыз', desc: 'Урок без единой ошибки', ok: s => s.perfect >= 1 },
  { id: 'REVIEWER', emoji: '🔁', title: 'Кабатлау', desc: 'Первое повторение', ok: s => s.reviews >= 1 },
  { id: 'WEEK', emoji: '🔥', title: 'Атна', desc: '7 дней подряд', ok: s => s.streak >= 7 },
  { id: 'DILIGENT', emoji: '📚', title: 'Тырыш', desc: '10 пройденных уроков', ok: s => s.lessons >= 10 },
  { id: 'STAR', emoji: '⭐', title: 'Йолдыз', desc: '500 XP', ok: s => s.xp >= 500 },
  { id: 'WORD_MASTER', emoji: '🏅', title: 'Сүз остасы', desc: '100 выученных слов', ok: s => s.words >= 100 },
  { id: 'MONTH', emoji: '🌙', title: 'Ай', desc: '30 дней подряд', ok: s => s.streak >= 30 },
];

export const QUESTS = [
  { id: 'EARN_XP', title: 'Набери 30 XP', target: 30, value: d => d.xp },
  { id: 'PERFECT_LESSONS', title: 'Пройди 2 урока без ошибок', target: 2, value: d => d.perfect },
];

// ---------- Путь обучения ----------
export const UNITS_OPEN_FOR_SOME = 3;

export function openUnitCount(course, startLevel, courseLevel) {
  if (courseLevel) return Math.max(0, course.units.findIndex(u => u.level === courseLevel));
  return startLevel === 'some' ? UNITS_OPEN_FOR_SOME : 0;
}

/** lessonId → 'locked' | 'available' | 'completed' | 'golden' */
export function nodeStates(course, lessonProgress, startLevel, courseLevel) {
  const openBefore = openUnitCount(course, startLevel, courseLevel);
  const result = {};
  let previousDone = true;
  for (const unit of course.units) {
    const unitOpen = unit.index < openBefore;
    for (const lesson of unit.lessons) {
      const p = lessonProgress[lesson.id];
      const done = !!p && p.count > 0;
      result[lesson.id] = done && p.best >= 100 ? 'golden'
        : done ? 'completed'
        : previousDone || unitOpen ? 'available' : 'locked';
      previousDone = done || unitOpen;
    }
  }
  return result;
}

export function currentLesson(course, states, openBefore) {
  for (const unit of course.units.slice(openBefore)) {
    for (const l of unit.lessons) if (states[l.id] === 'available') return l.id;
  }
  for (const [id, st] of Object.entries(states)) if (st === 'available') return id;
  return null;
}

// ---------- Барсик ----------
export const Care = {
  XP_PER_TREAT: 10,
  SAD_BELOW: 40,
  LEVEL_XP: [0, 50, 150, 300, 600, 1000, 1600, 2500, 4000],
  LEVEL_TITLES: ['Котёнок', 'Любопытный котёнок', 'Юный барс', 'Смелый барс', 'Ловкий барс', 'Мудрый барс', 'Снежный барс', 'Ак барс', 'Барс-аксакал'],
  treats: (xp, eaten, bonus = 0) => Math.max(0, Math.floor(xp / 10) + bonus - eaten),
  mood(lastCare, now, practicedToday) {
    if (lastCare <= 0) return 70;
    const hours = Math.floor(Math.max(0, now - lastCare) / 3600000);
    return Math.min(100, Math.max(15, 100 - hours * 4 + (practicedToday ? 10 : 0)));
  },
  level(xp) {
    const L = Care.LEVEL_XP;
    let i = 0;
    for (let k = 0; k < L.length; k++) if (xp >= L[k]) i = k;
    if (i + 1 >= L.length) return { number: i + 1, next: null, progress: 1 };
    return { number: i + 1, next: L[i + 1] - xp, progress: (xp - L[i]) / (L[i + 1] - L[i]) };
  },
};

/** Что Барсик говорит на главном экране (AssistantBrain). */
export function assistantLine(c) {
  if (c.lessons === 0) return 'Сәлам! Мин — Барсик, твой помощник. Начнём с первого урока — там самые нужные слова: «привет» и «спасибо».';
  if (c.hearts <= 0) return 'Жизни закончились — не беда! Пройди повторение, и я верну одну жизнь.';
  if (c.streak > 0 && !c.practicedToday) return `Серия уже ${c.streak} дн.! Сегодня занятия ещё не было — один короткий урок, и серия продолжится.`;
  if (c.hearts === 1) return 'Осталась одна жизнь. Будь внимательнее — или загляни в повторение, оно вернёт жизнь.';
  if (c.due >= 5) return `Слов пора повторить: ${c.due}. Загляни во вкладку «Повторение», пока они не забылись!`;
  if (c.todayXp >= 1 && c.todayXp < 30) return `До задания дня осталось ${30 - c.todayXp} XP — ещё один урок, и готово!`;
  if (c.practicedToday) return `Афәрин! Сегодняшнее занятие засчитано, серия — ${c.streak} дн. Можно ещё урок, если хочется.`;
  const h = new Date().getHours();
  if (h >= 4 && h <= 11) return 'Хәерле иртә! Доброе утро! Начнём день с татарского?';
  if (h >= 12 && h <= 17) return 'Хәерле көн! Добрый день! Самое время для урока.';
  return 'Хәерле кич! Добрый вечер! Пара слов перед сном запоминается лучше всего.';
}

export const comboCheer = n => n === 3 || n === 5 || (n >= 8 && n % 4 === 0);

// ---------- Сборка урока (LessonBuilder) ----------
const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export { shuffle };
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
export { pick };

function distractors(word, pool, inRussian) {
  const forbidden = new Set((inRussian ? word.acceptedRu : word.acceptedTt).map(TatarText.normalize));
  const others = pool.filter(w => w.id !== word.id);
  const same = shuffle(others.filter(w => w.topic === word.topic));
  const rest = shuffle(others.filter(w => w.topic !== word.topic));
  const out = [], seen = new Set();
  for (const w of [...same, ...rest]) {
    const text = inRussian ? w.ru : w.tt;
    const n = TatarText.normalize(text);
    if (forbidden.has(n) || seen.has(n)) continue;
    seen.add(n);
    out.push(text);
    if (out.length === 3) break;
  }
  return out;
}

function choice(word, pool, dir, prefix) {
  const ttRu = dir === 'tt_ru';
  return {
    type: 'choice', id: `${prefix}:choice_${dir}:${word.id}`, direction: dir,
    prompt: ttRu ? word.tt : word.ru,
    options: shuffle([...distractors(word, pool, ttRu), ttRu ? word.ru : word.tt]),
    accepted: ttRu ? word.acceptedRu : word.acceptedTt,
    image: ttRu ? word.image : null, audio: ttRu ? word.audio : null, words: [word.id],
  };
}
const listening = (word, pool, prefix) => ({
  type: 'listening', id: `${prefix}:listen:${word.id}`, audio: word.audio, text: word.tt, translation: word.ru,
  mode: 'choice', options: shuffle([...distractors(word, pool, false), word.tt]), accepted: word.acceptedTt, words: [word.id],
});
const typing = (word, dir, prefix) => {
  const ttRu = dir === 'tt_ru';
  return {
    type: 'typing', id: `${prefix}:type_${dir}:${word.id}`, direction: dir,
    prompt: ttRu ? word.tt : word.ru, accepted: ttRu ? word.acceptedRu : word.acceptedTt,
    audio: ttRu ? word.audio : null, words: [word.id],
  };
};
function matching(words, prefix) {
  const seenT = new Set(), seenR = new Set(), unique = [];
  for (const w of words) {
    const t = TatarText.normalize(w.tt), r = TatarText.normalize(w.ru);
    if (seenT.has(t) || seenR.has(r)) continue;
    seenT.add(t); seenR.add(r); unique.push(w);
  }
  return {
    type: 'matching', id: `${prefix}:match:${unique.map(w => w.id).join('_')}`,
    pairs: unique.map(w => [w.tt, w.ru]), accepted: ['matched'], words: unique.map(w => w.id),
  };
}

const isHard = e => e.type === 'typing' || e.type === 'speaking';

export function buildLesson(lesson, course) {
  const W = course.words;
  const newWords = lesson.newWords.map(id => W[id]).filter(Boolean);
  const words = [...new Set([...lesson.newWords, ...lesson.practiceWords])].map(id => W[id]).filter(Boolean);
  const target = Math.min(15, Math.max(10, lesson.exerciseCount));
  // Произношения в веб-версии нет — авторские задания на речь пропускаем.
  const authored = lesson.exercises.filter(e => e.type !== 'speaking');
  const pool = course.wordList;
  const prefix = lesson.id;
  const intro = newWords.map(w => choice(w, pool, 'tt_ru', prefix));
  const candidates = [...intro];
  if (words.length >= 3) candidates.push(matching(shuffle(words).slice(0, 5), prefix));
  words.forEach(w => candidates.push(listening(w, pool, prefix)));
  words.forEach(w => candidates.push(typing(w, 'ru_tt', prefix)));
  words.forEach(w => candidates.push(choice(w, pool, 'ru_tt', prefix)));
  words.forEach(w => candidates.push(typing(w, 'tt_ru', prefix)));
  const chosen = candidates.slice(0, Math.max(0, target - authored.length));
  const introIds = new Set(intro.map(e => e.id));
  const first = chosen.filter(e => introIds.has(e.id));
  const rest = chosen.filter(e => !introIds.has(e.id));
  return [...first, ...shuffle([...authored, ...rest.filter(e => !isHard(e))]), ...shuffle(rest.filter(isHard))];
}

export function buildReview(words, course, count = 12) {
  if (!words.length) return [];
  const pool = course.wordList;
  const singles = shuffle(words.flatMap(w => [choice(w, pool, 'ru_tt', 'review'), listening(w, pool, 'review'), typing(w, 'ru_tt', 'review')]));
  const match = words.length >= 3 ? [matching(words.slice(0, 5), 'review')] : [];
  return shuffle([...singles.slice(0, count - match.length), ...match]);
}

// ---------- Подготовка курса из JSON ----------
export function prepareCourse(raw) {
  const words = {};
  const levels = {};
  raw.levels.forEach(l => { levels[l.id] = l; });
  const topics = {};
  raw.topics.forEach(t => { topics[t.id] = t.title; });
  const units = raw.units.map((u, index) => {
    (u.words || []).forEach(w => {
      words[w.id] = {
        id: w.id, tt: w.tt, ru: w.ru, topic: w.topic, image: w.image || null, audio: w.audio || w.id,
        acceptedTt: [...new Set([w.tt, ...(w.acceptedTt || [])])],
        acceptedRu: [...new Set([w.ru, ...(w.acceptedRu || [])])],
      };
    });
    return {
      id: u.id, index, title: u.title, subtitle: u.subtitle || '', level: u.level || 'A1',
      lessons: u.lessons.map(l => ({
        id: l.id, unitId: u.id, title: l.title, kind: l.kind || 'vocabulary',
        newWords: l.newWords || [], practiceWords: l.practiceWords || [],
        grammarNote: l.grammarNote || null, exerciseCount: l.exerciseCount || 12,
        exercises: (l.exercises || []).map(normalizeExercise),
      })),
      grammar: u.grammar || [],
    };
  });
  const grammar = {};
  units.forEach(u => u.grammar.forEach(g => { grammar[g.id] = g; }));
  const lessons = {};
  units.forEach(u => u.lessons.forEach(l => { lessons[l.id] = l; }));
  return {
    units, words, wordList: Object.values(words), grammar, lessons, levels, topics,
    dialogs: raw.dialogs,
    audio: new Set(raw.audio), audioFemale: new Set(raw.audioFemale),
  };
}

function normalizeExercise(e) {
  const base = { type: e.type, id: e.id, words: e.words || [] };
  const accepted = e.acceptedAnswers || [];
  switch (e.type) {
    case 'choice':
      return { ...base, prompt: e.prompt, direction: e.direction || 'tt_ru', options: e.options, accepted, image: e.image || null, audio: e.audio || null };
    case 'tiles':
      return { ...base, prompt: e.prompt, direction: e.direction || 'tt_ru', tiles: e.tiles, accepted, audio: e.audio || null };
    case 'typing':
      return { ...base, prompt: e.prompt, direction: e.direction || 'tt_ru', accepted, audio: e.audio || null };
    case 'listening': {
      const mode = e.mode === 'tiles' ? 'tiles' : 'choice';
      return { ...base, audio: e.audio, text: e.text, translation: e.translation || null, mode,
        options: mode === 'tiles' ? e.tiles : e.options, accepted: accepted.length ? accepted : [e.text] };
    }
    case 'matching':
      return { ...base, pairs: e.pairs, accepted: ['matched'] };
    case 'fill_blank':
      return { ...base, before: e.before || '', after: e.after || '', options: e.options, accepted, translation: e.translation || null, hint: e.hint || null };
    default:
      return { ...base, text: e.text, accepted };
  }
}

// ---------- Диалоги с Барсиком (DialogEngine, без голосового ввода) ----------
const NOT_UNDERSTOOD = 'Гафу ит, аңламадым.';
const MOVE_ON = 'Ярый, әйдә дәвам итик!';
const DEFAULT_NAME = 'дустым';
const NAME_STOP = new Set(['минем', 'исемем', 'мин', 'сәлам', 'салам', 'исәнме', 'исәнмесез', 'ә', 'мине', 'атыйлар', 'исем', 'бу', 'меня', 'зовут', 'я', 'привет']);

export function buildSpellings(texts) {
  const map = new Map(), plain = new Set();
  texts.forEach(t => TatarText.normalize(t).split(' ').filter(w => [...w].length > 1).forEach(w => {
    if (TatarText.hasSpecial(w)) { const f = TatarText.fold(w); if (!map.has(f)) map.set(f, w); } else plain.add(w);
  }));
  plain.forEach(p => map.delete(p));
  return map;
}

export class DialogEngine {
  constructor(dialog, spellings) {
    this.dialog = dialog;
    this.spellings = spellings;
    this.start();
  }
  get step() { return this.dialog.steps[this.stepId]; }
  get finished() { return !!this.step.end; }
  start() {
    this.stepId = this.dialog.start;
    this.misses = 0;
    this.vars = {};
    return [this.stepLine()];
  }
  answer(text) {
    if (this.finished) return [];
    const lines = [];
    const note = this.spellingNote(text);
    if (note) lines.push(note);
    const tokens = TatarText.normalize(text).split(' ').filter(Boolean).map(TatarText.fold);
    const replies = this.step.replies || [];
    const reply = replies.find(r => (r.match || []).length && r.match.some(stem => this.matches(tokens, stem)))
      || replies.find(r => !(r.match || []).length);
    if (!reply) {
      this.misses++;
      if (this.misses < 2 || !replies.length) {
        const hint = this.step.hint || (this.step.suggest && this.step.suggest[0] ? `Можно ответить так: «${this.step.suggest[0]}»` : '');
        lines.push({ text: NOT_UNDERSTOOD, ru: 'Извини, не понял.', audio: 'dlg_not_understood', kind: 'say' });
        if (hint) lines.push({ text: '💡 ' + hint, kind: 'note' });
        return lines;
      }
      lines.push({ text: MOVE_ON, ru: 'Ладно, давай продолжим!', audio: 'dlg_move_on', kind: 'say' });
      return [...lines, ...this.go(replies[0], text, -1)];
    }
    return [...lines, ...this.go(reply, text, replies.indexOf(reply))];
  }
  go(reply, text, idx) {
    if (reply.capture === 'name') this.vars.name = this.extractName(text);
    const lines = [];
    if (reply.say && idx >= 0) lines.push(this.line(reply.say, reply.ru || '', `dlg_${this.dialog.id}_${this.stepId}_r${idx}`));
    this.stepId = reply.next;
    this.misses = 0;
    lines.push(this.stepLine());
    return lines;
  }
  stepLine() { return this.line(this.step.say, this.step.ru || '', `dlg_${this.dialog.id}_${this.stepId}`); }
  line(text, ru, key) {
    const hasVars = text.includes('{');
    return { text: this.fill(text), ru: this.fill(ru), audio: hasVars ? null : key, kind: 'say' };
  }
  fill(t) {
    let s = t;
    for (const [k, v] of Object.entries(this.vars)) s = s.split(`{${k}}`).join(v);
    return s.split('{name}').join(DEFAULT_NAME);
  }
  matches(tokens, stem) {
    const f = TatarText.fold(TatarText.normalize(stem));
    return f.includes(' ') ? tokens.join(' ').includes(f) : tokens.some(t => t.startsWith(f));
  }
  spellingNote(text) {
    const fixes = [];
    const seen = new Set();
    for (const token of TatarText.normalize(text).split(' ')) {
      if (!token || TatarText.hasSpecial(token)) continue;
      const right = this.spellings.get(token);
      if (right && right !== token && !seen.has(token)) { seen.add(token); fixes.push(`${token} → ${right}`); }
      if (fixes.length === 3) break;
    }
    return fixes.length ? { text: '✍️ С татарскими буквами: ' + fixes.join(', '), kind: 'note' } : null;
  }
  extractName(text) {
    const words = text.split(/[\s,.!?—-]+/).filter(w => w.trim() && !NAME_STOP.has(TatarText.normalize(w)));
    const w = words[words.length - 1];
    return w ? w[0].toUpperCase() + w.slice(1) : DEFAULT_NAME;
  }
}

// ---------- Подсказки и тексты ----------
export const PRAISE = ['Отлично!', 'Бик яхшы!', 'Афәрин!', 'Так держать!', 'Молодец!'];
export const TIPS = [
  'В татарском нет рода: «ул» — это и «он», и «она». Одной сложностью меньше!',
  'Ударение в татарских словах чаще всего на последнем слоге: алмА, кибЕт, мәктӘп.',
  'Ә — мягкий звук между «а» и «э». Слушай записи и повторяй вслух: «әни», «рәхмәт».',
  'Ө и ү — мягкие пары к «о» и «у». Губы округлены, звук — ближе к «ё» и «ю»: өч, дүрт.',
  'Ң произносится в нос, как «ng» в английском song: миңа, сеңел.',
  'Һ — лёгкий выдох, как английское h: шәһәр, зинһар.',
  'Татарский «склеивает» слова: өй → өйләр → өйләрдә — «в домах». Корень не меняется!',
  'После числа слово остаётся в единственном числе: ике алма — «два яблока».',
  'Сабантуй — праздник плуга, его отмечают летом с песнями, борьбой корэш и скачками.',
  'Чәкчәк подают к чаю как символ гостеприимства. Чәй эчәбез! — «Пьём чай!»',
  'Понемногу каждый день работает лучше, чем час раз в неделю. Даже 5 минут — это шаг!',
  'Нажимай на меня ещё — у меня много советов!',
];
export const PET_LINES = ['Мырр… Рәхмәт! Как приятно.', 'Ещё, ещё! За ушком — особенно хорошо.', 'Ты самый лучший друг! Дус — это «друг» по-татарски.', 'Мырр-мырр… Я бы так весь день сидел.'];
export const TICKLE_LINES = ['Хи-хи! Щекотно!', 'Ой-ой, не надо, я сейчас лопну от смеха!', 'Ха-ха! Лучше пройди урок, а потом щекочи!'];
