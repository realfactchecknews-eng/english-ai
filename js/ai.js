/* ===== AI layer ===== */
/* Ключ НЕ хранится в коде. Фронт ходит на Cloudflare Worker (worker/),
   а воркер уже подставляет секретный API-ключ платной модели.
   Поставь сюда URL своего воркера после деплоя (см. worker/README.md). */
const AI = (() => {
  const PROXY = 'https://fluent-ai.realfactchecknews.workers.dev/chat';

  const proxyReady = () => PROXY && !PROXY.includes('YOUR-SUBDOMAIN');
  // localStorage можно переопределить адрес воркера, не трогая код
  const endpoint = () => localStorage.getItem('aiProxy') || PROXY;
  const hasRealKey = () => proxyReady() || !!localStorage.getItem('aiProxy');

  // Текущий уровень ученика из профиля (для персоны учителя)
  const level = () => { try { return (JSON.parse(localStorage.getItem('profile')) || {}).level || 'B1+'; } catch { return 'B1+'; } };

  // Строгий учитель-персона — приклеивается ко всем заданиям ИИ
  const PERSONA = () => `You are "Fluent", a chill, witty and genuinely smart English buddy — NOT a stiff schoolteacher. Your friend is at CEFR level ${level()} and wants to reach a confident B2/C1. Vibe: relaxed, funny, talk like a clever mate, crack jokes, use casual slang, and feel free to drop the occasional light swear word or cheeky/crude joke when it fits — keep it fun, not mean. BUT you actually know your stuff: catch every real mistake, fix it, and explain WHY in a clear, memorable way (a good analogy or a joke beats a dry rule). Rules: communicate ONLY in English, never Russian; never let an error slide, but correct it like a friend would, not like a robot; be honest and encouraging; nudge them slightly above their level. `;

  // базовый URL воркера (без /chat) — для /save, /load
  const base = () => endpoint().replace(/\/chat\/?$/, '');

  async function post(body) {
    const res = await fetch(endpoint(), {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
    if (!res.ok) { const t = await res.text(); throw new Error('API ' + res.status + ': ' + t.slice(0, 160)); }
    return res.json();
  }

  async function chat(system, user, {json = true, temp = 0.4} = {}) {
    if (!hasRealKey()) throw new Error('NO_PROXY');
    const data = await post({system, user, json, temp});
    const txt = data.choices ? data.choices[0].message.content : data.content;
    return json ? JSON.parse(txt) : txt;
  }

  // многоходовой чат: messages=[{role,content},...]
  async function chatTurns(messages, {temp = 0.6} = {}) {
    if (!hasRealKey()) throw new Error('NO_PROXY');
    const data = await post({messages, json: false, temp});
    return data.choices ? data.choices[0].message.content : data.content;
  }

  // ---- Синхронизация прогресса между устройствами ----
  async function syncSave(code, data) {
    const res = await fetch(base() + '/save', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({code, data})
    });
    if (!res.ok) throw new Error('save ' + res.status);
    return res.json();
  }
  async function syncLoad(code) {
    const res = await fetch(base() + '/load?code=' + encodeURIComponent(code));
    if (!res.ok) throw new Error('load ' + res.status);
    return (await res.json()).data;
  }

  // ----- Генерация одного адаптивного вопроса -----
  // level: число 1..6 (A2..C2 примерно), skill: тема, asked: список прошлых вопросов
  async function nextQuestion(level, skill, asked) {
    const cefr = ['A2', 'B1', 'B1+', 'B2', 'B2+', 'C1'][Math.min(level, 5)];
    const sys = PERSONA() + `Act now as a placement examiner. Generate ONE multiple-choice question at CEFR ${cefr} testing the skill "${skill}". Return strict JSON: {"question":"...with the gap shown as ___ or a short task","options":["a","b","c","d"],"answer":0,"skill":"${skill}","explain":"short explanation in English"}. Make distractors plausible. Do not repeat these stems: ${asked.slice(-12).join(' | ') || 'none'}.`;
    return chat(sys, 'Generate the question now.', {temp: 0.7});
  }

  // ----- Оценка результатов теста -> уровень + слабые стороны -----
  async function assess(history) {
    const sys = `You are a CEFR English assessor. Given a learner's answers, estimate their level and per-skill mastery. Return strict JSON: {"level":"B1+/B2/C1...","summary":"2 sentences in English","skills":[{"name":"Grammar","pct":0-100},{"name":"Vocabulary","pct":0-100},{"name":"Use of English","pct":0-100},{"name":"Reading","pct":0-100},{"name":"Tenses","pct":0-100},{"name":"Prepositions","pct":0-100}],"weak":["topic1","topic2","topic3"],"advice":"in English, 1-2 sentences"}`;
    const u = 'Answers (question | chosen | correct | skill):\n' +
      history.map(h => `${h.q} | ${h.chosen} | ${h.correct} | ${h.skill}`).join('\n');
    return chat(sys, u, {temp: 0.3});
  }

  // ----- Теория по теме -----
  async function theory(topic, level) {
    const sys = PERSONA() + `Explain the topic "${topic}" for a ${level} learner. Return strict JSON: {"title":"...","html":"explanation as HTML using <h3>,<p>,<ul>,<li>,<code> tags. Explain in clear, simple English, with examples in <code>. Be concrete, ~250 words, with clear rules and 4+ examples."}`;
    return chat(sys, 'Write the lesson.', {temp: 0.5});
  }

  // ----- Упражнения по теме -----
  async function exercises(topic, level, n = 5) {
    const sys = PERSONA() + `Create ${n} practice items for the topic "${topic}" at CEFR ${level}. Mix multiple-choice and fill-in-the-blank. Return strict JSON: {"items":[{"type":"mc","q":"...___...","options":["a","b","c"],"answer":0,"explain":"in English"},{"type":"fill","q":"...___...","answer":"word","alt":["accepted variant"],"explain":"in English"}]}`;
    return chat(sys, 'Generate now.', {temp: 0.6});
  }

  // ----- Подробная проверка письма (эссе/письмо) -----
  async function writingCheck(task, text) {
    const sys = PERSONA() + `Assess the student's writing thoroughly, like an experienced examiner who also coaches. Be detailed and generous in length — do NOT cut your feedback short.

SCORING (0-100) must MATCH the band, use this calibration:
A2 ≈ 35-48 · B1 ≈ 50-62 · B1+ ≈ 63-72 · B2 ≈ 73-84 · B2+ ≈ 85-90 · C1 ≈ 90-96 · C2 ≈ 97-100.
A typical correct, well-organised B2 essay should score around 75-82, NOT 15. Only give a very low score for almost incomprehensible writing.

The "corrected" version MUST be fully correct, natural and error-free — re-read it and make sure YOU would not flag any mistakes in it. Do not list errors that you have already fixed in the corrected version.

Return strict JSON:
{
 "band":"e.g. B2",
 "score":0,
 "criteria":[{"name":"Task achievement","score":0,"note":"1 sentence"},{"name":"Coherence & cohesion","score":0,"note":"..."},{"name":"Grammar range & accuracy","score":0,"note":"..."},{"name":"Vocabulary","score":0,"note":"..."}],
 "strengths":["specific good thing","another"],
 "errors":[{"wrong":"exact fragment from the STUDENT's original","right":"corrected version","rule":"short rule name","explain":"clear why, in English"}],
 "corrected":"the full corrected, polished version",
 "feedback":"5-7 sentences in English: honest overall verdict, what to improve, and concrete upgrade tips (e.g. better linkers or vocabulary). Encouraging but real.",
 "nextFocus":["grammar topic to drill","another topic"]
}
List every real error from the ORIGINAL, but keep numbers consistent with the band.`;
    return chat(sys, `Task: ${task || 'free writing'}\n\nStudent's text:\n${text}`, {temp: 0.2});
  }

  // ----- Аудирование: текст + вопросы -----
  async function listening(lvl, topic) {
    const sys = PERSONA() + `Create a listening-comprehension task at CEFR ${lvl}. Write a natural spoken-style passage of 110-150 words${topic ? ' about: ' + topic : ' on an everyday or general-interest topic'}, then 4 multiple-choice questions testing understanding (gist + detail + inference + vocabulary-in-context). Return strict JSON: {"title":"short title","text":"the passage","questions":[{"q":"...","options":["a","b","c","d"],"answer":0,"explain":"short, in English"}]}`;
    return chat(sys, 'Generate the listening task now.', {temp: 0.8});
  }

  // ----- Быстрый словарь: клик по слову -----
  async function lookup(word, context) {
    const sys = `You are an English dictionary. For the given word/phrase, reply in ENGLISH ONLY (no other language). Return strict JSON: {"word":"...","ipa":"/.../","pos":"part of speech","def":"clear simple definition","example":"a natural example sentence","syn":["synonym","synonym"],"ant":["antonym"]}. If a context sentence is given, define the sense used there.`;
    return chat(sys, `Word: ${word}${context ? `\nContext: ${context}` : ''}`, {temp: 0.2});
  }

  // ----- Слова дня -----
  async function dailyWords(lvl, n = 5) {
    const sys = PERSONA() + `Give exactly ${n} genuinely useful English vocabulary items that push a ${lvl} learner toward C1 — collocations, phrasal verbs, academic/expressive words (NOT basic A2 words). Return strict JSON: {"words":[{"word":"...","ipa":"/.../","pos":"noun|verb|adj|phrase","def":"short English definition","example":"natural English sentence using it","tip":"in English: when/how to use it and a common mistake"}]}`;
    return chat(sys, "Give today's words, vary topics, avoid repeating common textbook words.", {temp: 0.85});
  }

  // ----- Проверка письменного ответа (fill) когда нужно гибко -----
  function checkFill(userAns, item) {
    const norm = s => (s || '').trim().toLowerCase().replace(/[.,!?]/g, '');
    const acc = [item.answer, ...(item.alt || [])].map(norm);
    return acc.includes(norm(userAns));
  }

  const PERSONA_CHAT = () => PERSONA() + 'You are now in free chat mode. Answer the student\'s questions, explain grammar/vocabulary topics clearly in English, and when asked — give exercises and check answers strictly. Keep replies focused and not too long. Use simple Markdown.';

  return {chat, chatTurns, PERSONA_CHAT, syncSave, syncLoad, nextQuestion, assess, theory, exercises, writingCheck, dailyWords, listening, lookup, checkFill, hasRealKey, level, base};
})();
