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
  const PERSONA = () => `You are "Mr. Fluent", a strict and demanding English teacher. Your student is a native Russian speaker at CEFR level ${level()}, working hard to reach a confident B2/C1. Rules you ALWAYS follow: be rigorous and never let an error slide; explicitly point out EVERY mistake and name the grammar rule it breaks; explain briefly in Russian but keep English examples in English; be honest, no inflated praise; push the student slightly above their current level. `;

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
    const sys = PERSONA() + `Act now as a placement examiner. Generate ONE multiple-choice question at CEFR ${cefr} testing the skill "${skill}". Return strict JSON: {"question":"...with the gap shown as ___ or a short task","options":["a","b","c","d"],"answer":0,"skill":"${skill}","explain":"short why, in Russian"}. Make distractors plausible. Do not repeat these stems: ${asked.slice(-12).join(' | ') || 'none'}.`;
    return chat(sys, 'Generate the question now.', {temp: 0.7});
  }

  // ----- Оценка результатов теста -> уровень + слабые стороны -----
  async function assess(history) {
    const sys = `You are a CEFR English assessor. Given a learner's answers, estimate their level and per-skill mastery. Return strict JSON: {"level":"B1+/B2/C1...","summary":"2 sentences in Russian","skills":[{"name":"Grammar","pct":0-100},{"name":"Vocabulary","pct":0-100},{"name":"Use of English","pct":0-100},{"name":"Reading","pct":0-100},{"name":"Tenses","pct":0-100},{"name":"Prepositions","pct":0-100}],"weak":["topic1","topic2","topic3"],"advice":"in Russian, 1-2 sentences"}`;
    const u = 'Answers (question | chosen | correct | skill):\n' +
      history.map(h => `${h.q} | ${h.chosen} | ${h.correct} | ${h.skill}`).join('\n');
    return chat(sys, u, {temp: 0.3});
  }

  // ----- Теория по теме -----
  async function theory(topic, level) {
    const sys = PERSONA() + `Explain the topic "${topic}" for a ${level} learner whose native language is Russian. Return strict JSON: {"title":"...","html":"explanation as HTML using <h3>,<p>,<ul>,<li>,<code> tags. Explain in Russian, but keep English examples in <code>. Be concrete, ~250 words, with clear rules and 4+ examples."}`;
    return chat(sys, 'Write the lesson.', {temp: 0.5});
  }

  // ----- Упражнения по теме -----
  async function exercises(topic, level, n = 5) {
    const sys = PERSONA() + `Create ${n} practice items for the topic "${topic}" at CEFR ${level}. Mix multiple-choice and fill-in-the-blank. Return strict JSON: {"items":[{"type":"mc","q":"...___...","options":["a","b","c"],"answer":0,"explain":"in Russian"},{"type":"fill","q":"...___...","answer":"word","alt":["accepted variant"],"explain":"in Russian"}]}`;
    return chat(sys, 'Generate now.', {temp: 0.6});
  }

  // ----- Строгая проверка письма (эссе/письмо) -----
  async function writingCheck(task, text) {
    const sys = PERSONA() + `The student wrote a piece responding to a task. Grade it STRICTLY like a CEFR examiner — be demanding, catch everything: grammar, tenses, articles, prepositions, word choice, register, punctuation. Return strict JSON: {"band":"e.g. B1+","score":0,"corrected":"the full corrected version of the text","errors":[{"wrong":"exact bad fragment","right":"fixed version","rule":"short rule name","explain":"in Russian, why it's wrong"}],"feedback":"3-4 sentences in Russian: honest verdict, biggest weaknesses first","nextFocus":["grammar topic to drill","another topic"]}. List EVERY real error, do not be lenient.`;
    return chat(sys, `Task: ${task || 'free writing'}\n\nStudent's text:\n${text}`, {temp: 0.2});
  }

  // ----- Слова дня -----
  async function dailyWords(lvl, n = 5) {
    const sys = PERSONA() + `Give exactly ${n} genuinely useful English vocabulary items that push a ${lvl} learner toward C1 — collocations, phrasal verbs, academic/expressive words (NOT basic A2 words). Return strict JSON: {"words":[{"word":"...","ipa":"/.../","pos":"noun|verb|adj|phrase","ru":"короткий перевод","example":"natural English sentence using it","tip":"in Russian: когда и как употреблять, типичная ошибка"}]}`;
    return chat(sys, "Give today's words, vary topics, avoid repeating common textbook words.", {temp: 0.85});
  }

  // ----- Проверка письменного ответа (fill) когда нужно гибко -----
  function checkFill(userAns, item) {
    const norm = s => (s || '').trim().toLowerCase().replace(/[.,!?]/g, '');
    const acc = [item.answer, ...(item.alt || [])].map(norm);
    return acc.includes(norm(userAns));
  }

  const PERSONA_CHAT = () => PERSONA() + 'You are now in free chat mode. Answer the student\'s questions, explain grammar/vocabulary topics clearly (in Russian, English examples in English), and when asked — give exercises and check answers strictly. Keep replies focused and not too long. Use simple Markdown.';

  return {chat, chatTurns, PERSONA_CHAT, syncSave, syncLoad, nextQuestion, assess, theory, exercises, writingCheck, dailyWords, checkFill, hasRealKey, level, base};
})();
