/* ===== FLUENT · AI English Coach ===== */
const app = document.getElementById('app');
const SKILLS = ["Tenses","Prepositions","Use of English","Grammar","Vocabulary","Reading"];
const TEST_LEN = 10;

const SYNC_KEYS=['profile','attempts','writing','learnedWords','wordsCache','chatLog'];
const store = {
  get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},
  set:(k,v)=>{localStorage.setItem(k,JSON.stringify(v));if(SYNC_KEYS.includes(k))schedulePush();},
};
/* ---- Sync ---- */
let pushTimer=null;
function schedulePush(){
  if(!localStorage.getItem('syncCode'))return;
  clearTimeout(pushTimer);
  pushTimer=setTimeout(pushState,1500);
}
function gatherState(){const o={};SYNC_KEYS.forEach(k=>{const v=localStorage.getItem(k);if(v!=null)o[k]=v;});return o;}
async function pushState(){
  const code=localStorage.getItem('syncCode');if(!code||!AI.hasRealKey())return;
  try{await AI.syncSave(code,gatherState());}catch(e){/* тихо */}
}
async function pullState(code){
  const data=await AI.syncLoad(code);
  if(data){Object.entries(data).forEach(([k,v])=>localStorage.setItem(k,v));return true;}
  return false;
}
const toast = m => {
  const t=document.createElement('div');t.className='toast';t.textContent=m;
  document.body.appendChild(t);setTimeout(()=>t.remove(),2600);
};
const esc = s => (s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
// озвучка через браузер (Web Speech API), без внешних API
function speak(text){
  if(!('speechSynthesis' in window))return toast('Браузер не умеет озвучку');
  speechSynthesis.cancel();
  const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=.92;
  const v=speechSynthesis.getVoices().find(x=>/en[-_]/i.test(x.lang));if(v)u.voice=v;
  speechSynthesis.speak(u);
}
window.speak=speak;
const loader = msg => `<div class="card fade"><div class="loader"><div class="spin"></div><p class="muted">${msg}</p></div></div>`;

/* ---------- Router ---------- */
function router(){
  const h = location.hash || '#/';
  document.querySelectorAll('#nav a').forEach(a=>a.classList.toggle('active',a.getAttribute('href')===h.split('?')[0]));
  const [path,q] = h.slice(1).split('?');
  const params = new URLSearchParams(q);
  if(path==='/'||path==='') return Home();
  if(path==='/test') return TestView();
  if(path==='/dashboard') return Dashboard();
  if(path==='/practice') return Practice();
  if(path==='/lesson') return Lesson(params.get('t'));
  if(path==='/write') return Writing();
  if(path==='/words') return Words();
  if(path==='/chat') return Chat();
  Home();
}
window.addEventListener('hashchange',router);

/* ---------- Home ---------- */
function Home(){
  const prof = store.get('profile',null);
  app.innerHTML = `
  <div class="hero fade">
    <span class="badge">AI English Coach · B1+ → B2 → C1</span>
    <h1>Подними английский<br>до уверенного уровня</h1>
    <p>ИИ протестирует тебя, найдёт слабые места и будет давать персональную теорию и упражнения именно по ним. Без воды.</p>
    <div class="row" style="justify-content:center">
      <a class="btn" href="#/test">${prof?'Пройти тест заново':'Пройти тест уровня'}</a>
      ${prof?`<a class="btn ghost" href="#/dashboard">Мой прогресс (${prof.level})</a>`:''}
    </div>
    <div class="feature-grid">
      <div class="feat"><div class="ic">🎯</div><h3>Адаптивный тест</h3><p>Вопросы подстраиваются под твои ответы и ставят точный CEFR-уровень.</p></div>
      <div class="feat"><div class="ic">🩺</div><h3>Карта слабостей</h3><p>Видно проседание по грамматике, временам, предлогам, лексике.</p></div>
      <div class="feat"><div class="ic">📚</div><h3>Теория под тебя</h3><p>ИИ объясняет правило по-русски с английскими примерами.</p></div>
      <div class="feat"><div class="ic">✍️</div><h3>Упражнения</h3><p>Тренируешь именно слабую тему, ИИ проверяет и объясняет ошибки.</p></div>
    </div>
  </div>`;
}

/* ---------- Test (adaptive) ---------- */
const T = {i:0,level:3,history:[],asked:[],cur:null};

async function TestView(){
  Object.assign(T,{i:0,level:3,history:[],asked:[],cur:null});
  loadQuestion();
}

async function loadQuestion(){
  if(T.i>=TEST_LEN) return finishTest();
  app.innerHTML = loader('ИИ подбирает вопрос…');
  const skill = SKILLS[T.i % SKILLS.length];
  let q;
  if(AI.hasRealKey()){
    try{ q = await AI.nextQuestion(T.level,skill,T.asked); }
    catch(e){ q = pickOffline(skill); }
  } else { q = pickOffline(skill); }
  q.skill = q.skill||skill;
  T.cur = q; T.asked.push(q.question||q.q);
  renderQuestion(q);
}

function pickOffline(skill){
  const pool = BANK.questions.filter(x=>Math.abs(x.level-T.level)<=1);
  const bySkill = pool.filter(x=>x.skill===skill);
  const pick = (bySkill.length?bySkill:pool)[Math.floor(Math.random()*(bySkill.length?bySkill.length:pool.length))]
    || BANK.questions[Math.floor(Math.random()*BANK.questions.length)];
  return {...pick};
}

function renderQuestion(q){
  const opts = q.options.map((o,i)=>`<div class="opt" data-i="${i}">${esc(o)}</div>`).join('');
  app.innerHTML = `
  <div class="card fade">
    <div class="qhead"><span class="pill">${esc(q.skill)}</span><span class="muted">Вопрос ${T.i+1} / ${TEST_LEN}</span></div>
    <div class="progress"><i style="width:${T.i/TEST_LEN*100}%"></i></div>
    <div class="qtext">${esc(q.question||q.q).replace(/___/g,'<b>______</b>')}</div>
    <div class="opts">${opts}</div>
    <div id="exp"></div>
  </div>`;
  app.querySelectorAll('.opt').forEach(el=>el.onclick=()=>answer(parseInt(el.dataset.i),q));
}

function answer(i,q){
  const correct = q.answer;
  const ok = i===correct;
  document.querySelectorAll('.opt').forEach((el,idx)=>{
    el.style.pointerEvents='none';
    if(idx===correct)el.classList.add('correct');
    else if(idx===i)el.classList.add('wrong');
    else el.classList.add('dim');
  });
  T.history.push({q:q.question||q.q,chosen:q.options[i],correct:q.options[correct],skill:q.skill,ok});
  T.level = Math.max(1,Math.min(6,T.level+(ok?1:-1)));
  if(q.explain) document.getElementById('exp').innerHTML =
    `<div class="explain"><b>${ok?'Верно ✓':'Разбор:'}</b> ${esc(q.explain)}</div>`;
  const btn=document.createElement('button');
  btn.className='btn';btn.style.marginTop='18px';
  btn.textContent = T.i+1>=TEST_LEN?'Узнать результат →':'Дальше →';
  btn.onclick=()=>{T.i++;loadQuestion();};
  app.querySelector('.card').appendChild(btn);
}

async function finishTest(){
  app.innerHTML = loader('ИИ анализирует ответы и определяет уровень…');
  let result;
  if(AI.hasRealKey()){
    try{ result = await AI.assess(T.history); }catch(e){ result = offlineAssess(); }
  } else { result = offlineAssess(); }
  result.date = Date.now();
  store.set('profile',result);
  // история попыток
  const hist = store.get('attempts',[]); hist.push({date:result.date,level:result.level});
  store.set('attempts',hist.slice(-20));
  location.hash='#/dashboard';
}

function offlineAssess(){
  const byskill={};
  T.history.forEach(h=>{(byskill[h.skill]=byskill[h.skill]||[]).push(h.ok)});
  const skills=Object.entries(byskill).map(([name,a])=>({name,pct:Math.round(a.filter(Boolean).length/a.length*100)}));
  const score=T.history.filter(h=>h.ok).length/T.history.length;
  const level=score>0.8?'C1':score>0.6?'B2':score>0.4?'B1+':'B1';
  const weak=skills.filter(s=>s.pct<70).map(s=>s.name);
  return {level,summary:`Ты ответил правильно на ${Math.round(score*100)}% вопросов. Оценка по офлайн-режиму — подключи Groq-ключ для точного ИИ-анализа.`,
    skills,weak:weak.length?weak:['Use of English'],advice:'Сфокусируйся на слабых темах в разделе «Прокачка».'};
}

/* ---------- Dashboard ---------- */
function Dashboard(){
  const p = store.get('profile',null);
  if(!p){
    app.innerHTML=`<div class="card fade"><div class="empty"><div class="ic">🧭</div><h2>Пока нет данных</h2><p class="muted">Пройди тест уровня, чтобы увидеть карту своих сильных и слабых сторон.</p><a class="btn" style="margin-top:18px" href="#/test">Пройти тест</a></div></div>`;return;
  }
  const skills=(p.skills||[]).map(s=>{
    const w=s.pct<70;
    const col=s.pct<50?'var(--bad)':s.pct<70?'var(--warn)':'var(--good)';
    return `<div class="skill"><span class="nm ${w?'weak':''}">${esc(s.name)}</span>
      <div class="bar"><i style="width:${s.pct}%;background:${col}"></i></div>
      <span class="pct">${s.pct}%</span></div>`;
  }).join('');
  const weak=(p.weak||[]).map(t=>`<a class="topic" href="#/lesson?t=${encodeURIComponent(t)}">
    <span class="tag weak">слабое место</span><h3>${esc(t)}</h3><p>Теория + упражнения от ИИ →</p></a>`).join('');
  app.innerHTML=`
  <div class="card fade level-badge">
    <div class="muted">Твой уровень</div>
    <div class="lv">${esc(p.level)}</div>
    <p class="muted" style="max-width:520px;margin:8px auto 0">${esc(p.summary||'')}</p>
  </div>
  <div class="card fade"><h2 style="margin-bottom:16px">Карта навыков</h2><div class="skills">${skills}</div></div>
  <div class="card fade"><h2 style="margin-bottom:6px">Что качать в первую очередь</h2>
    <p class="muted" style="margin-bottom:14px">${esc(p.advice||'')}</p>
    <div class="topics">${weak||'<p class="muted">Слабых тем не найдено — отличная работа!</p>'}</div></div>
  <div class="row" style="margin-top:18px;justify-content:center">
    <a class="btn ghost" href="#/practice">Все темы для прокачки</a>
    <a class="btn ghost" href="#/test">Пройти тест заново</a>
  </div>`;
}

/* ---------- Practice (все темы) ---------- */
function Practice(){
  const p=store.get('profile',null);
  const weak=new Set(p?.weak||[]);
  const allTopics=["Tenses","Prepositions","Use of English","Conditionals","Phrasal verbs","Articles","Modal verbs","Reported speech","Passive voice","Vocabulary"];
  const cards=allTopics.map(t=>{
    const w=weak.has(t);
    return `<a class="topic" href="#/lesson?t=${encodeURIComponent(t)}">
      <span class="tag ${w?'weak':'ok'}">${w?'твоё слабое':'тренировка'}</span>
      <h3>${esc(t)}</h3><p>Теория + 5 упражнений →</p></a>`;
  }).join('');
  app.innerHTML=`<div class="card fade"><h2 style="margin-bottom:6px">Прокачка по темам</h2>
    <p class="muted" style="margin-bottom:16px">Выбери тему — ИИ объяснит правило и даст упражнения с проверкой.</p>
    <div class="topics">${cards}</div></div>`;
}

/* ---------- Lesson (theory + exercises) ---------- */
async function Lesson(topic){
  topic=topic||'Tenses';
  const lvl=store.get('profile',{}).level||'B2';
  app.innerHTML=loader('ИИ готовит урок по теме «'+esc(topic)+'»…');
  let th,ex;
  if(AI.hasRealKey()){
    try{ [th,ex]=await Promise.all([AI.theory(topic,lvl),AI.exercises(topic,lvl,5)]); }
    catch(e){ th=offTheory(topic); ex={items:BANK.exercises._generic}; }
  } else { th=offTheory(topic); ex={items:BANK.exercises._generic}; }
  renderLesson(topic,th,ex.items||[]);
}
function offTheory(t){return BANK.theory[t]||{title:t,html:'<p>Подключи Groq-ключ (⚙), чтобы ИИ сгенерировал теорию по этой теме. Пока доступны базовые упражнения ниже.</p>'};}

function renderLesson(topic,th,items){
  const ex=items.map((it,idx)=>{
    if(it.type==='fill'){
      return `<div class="card ex-item" data-idx="${idx}" data-type="fill">
        <div class="qtext" style="font-size:16px">${esc(it.q).replace(/___/g,'<b>______</b>')}</div>
        <div class="fillrow"><input placeholder="твой ответ" data-input><button class="btn sm" data-check>Проверить</button></div>
        <div data-res></div></div>`;
    }
    const opts=(it.options||[]).map((o,i)=>`<div class="opt" data-i="${i}">${esc(o)}</div>`).join('');
    return `<div class="card ex-item" data-idx="${idx}" data-type="mc">
      <div class="qtext" style="font-size:16px">${esc(it.q).replace(/___/g,'<b>______</b>')}</div>
      <div class="opts">${opts}</div><div data-res></div></div>`;
  }).join('');
  app.innerHTML=`
  <div class="row" style="margin-bottom:16px"><a class="btn ghost sm" href="#/dashboard">← Назад</a>
    <a class="btn ghost sm" href="#/lesson?t=${encodeURIComponent(topic)}" onclick="location.reload&&0">↻ Новые упражнения</a></div>
  <div class="card fade theory"><h2>${esc(th.title||topic)}</h2>${th.html||''}</div>
  <h2 style="margin:24px 0 4px;font-family:Sora">Упражнения</h2>
  <p class="muted" style="margin-bottom:14px">Реши и проверь — ИИ объяснит каждый ответ.</p>
  ${ex}`;
  // bind
  app.querySelectorAll('.ex-item').forEach(card=>{
    const it=items[+card.dataset.idx];
    if(card.dataset.type==='mc'){
      card.querySelectorAll('.opt').forEach(el=>el.onclick=()=>{
        const i=+el.dataset.i,ok=i===it.answer;
        card.querySelectorAll('.opt').forEach((o,idx)=>{o.style.pointerEvents='none';
          if(idx===it.answer)o.classList.add('correct');else if(idx===i)o.classList.add('wrong');else o.classList.add('dim');});
        card.querySelector('[data-res]').innerHTML=`<div class="explain"><b>${ok?'Верно ✓':'Разбор:'}</b> ${esc(it.explain||'')}</div>`;
      });
    } else {
      const input=card.querySelector('[data-input]');
      const go=()=>{
        const ok=AI.checkFill(input.value,it);
        input.style.borderColor=ok?'var(--good)':'var(--bad)';
        card.querySelector('[data-res]').innerHTML=`<div class="explain"><b>${ok?'Верно ✓':'Правильно: '+esc(it.answer)}</b> ${esc(it.explain||'')}</div>`;
      };
      card.querySelector('[data-check]').onclick=go;
      input.addEventListener('keydown',e=>{if(e.key==='Enter')go();});
    }
  });
}

/* ---------- Writing (строгая проверка эссе/письма) ---------- */
const WRITE_TASKS=[
  "Write an opinion essay (120-180 words): «Online learning is better than traditional school.» Do you agree?",
  "Write an email to a friend (90-120 words) describing your last trip and inviting them to come next time.",
  "Write a for-and-against essay (150-200 words): «Social media does more harm than good.»",
  "Describe your dream job and explain why it suits you (100-150 words).",
  "Write a complaint email to a hotel about a bad stay (100-140 words), formal register.",
];
function Writing(){
  const task=WRITE_TASKS[Math.floor(Math.random()*WRITE_TASKS.length)];
  app.innerHTML=`
  <div class="card fade">
    <h2 style="margin-bottom:6px">Письмо · строгая проверка</h2>
    <p class="muted" style="margin-bottom:16px">Mr. Fluent проверит как экзаменатор: найдёт все ошибки, исправит и покажет, что подтянуть.</p>
    <div class="explain" style="margin-bottom:14px"><b>Задание:</b> <span id="wtask">${esc(task)}</span>
      <button class="btn ghost sm" id="wnew" style="margin-left:8px">↻ другое</button></div>
    <textarea id="wtext" placeholder="Пиши свой ответ на английском здесь…" style="width:100%;min-height:200px;padding:15px;border-radius:13px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--txt);font-size:15px;font-family:Inter;line-height:1.6;resize:vertical"></textarea>
    <div class="row" style="margin-top:14px"><button class="btn" id="wcheck">Проверить ✍️</button>
      <span class="muted" id="wcount">0 слов</span></div>
    <div id="wres" style="margin-top:18px"></div>
  </div>`;
  const ta=document.getElementById('wtext');
  ta.oninput=()=>document.getElementById('wcount').textContent=(ta.value.trim().match(/\S+/g)||[]).length+' слов';
  document.getElementById('wnew').onclick=()=>Writing();
  document.getElementById('wcheck').onclick=async()=>{
    const text=ta.value.trim();
    if(text.split(/\s+/).length<15)return toast('Напиши хотя бы пару предложений');
    const res=document.getElementById('wres');res.innerHTML=loader('Mr. Fluent проверяет твоё письмо…');
    if(!AI.hasRealKey()){res.innerHTML='<div class="explain">Проверка письма работает только с подключённым ИИ (воркер).</div>';return;}
    try{
      const r=await AI.writingCheck(document.getElementById('wtask').textContent,text);
      renderWriteResult(res,r);
      const log=store.get('writing',[]);log.push({date:Date.now(),score:r.score,band:r.band});store.set('writing',log.slice(-30));
    }catch(e){res.innerHTML='<div class="explain"><b>Ошибка:</b> '+esc(e.message)+'</div>';}
  };
}
function renderWriteResult(el,r){
  const errs=(r.errors||[]).map(e=>`<div style="padding:11px 0;border-top:1px solid var(--line)">
    <span style="color:var(--bad);text-decoration:line-through">${esc(e.wrong)}</span> →
    <span style="color:var(--good)">${esc(e.right)}</span>
    <div class="muted" style="font-size:13px;margin-top:3px"><b style="color:var(--acc2)">${esc(e.rule||'')}</b> — ${esc(e.explain||'')}</div></div>`).join('')
    || '<p class="muted">Грубых ошибок не найдено — отлично!</p>';
  const focus=(r.nextFocus||[]).map(f=>`<a class="pill" style="text-decoration:none" href="#/lesson?t=${encodeURIComponent(f)}">${esc(f)} →</a>`).join(' ');
  el.innerHTML=`
    <div class="card" style="margin:0">
      <div class="row" style="justify-content:space-between"><h3>Оценка: <span style="color:var(--acc2)">${esc(r.band||'')}</span></h3><span class="lv" style="font-size:30px">${r.score||0}/100</span></div>
      <p class="muted" style="margin:6px 0 16px">${esc(r.feedback||'')}</p>
      <h3 style="margin-bottom:4px">Ошибки</h3>${errs}
      <h3 style="margin:18px 0 8px">Исправленный вариант <button class="btn ghost sm" onclick="speak(this.nextElementSibling.textContent)">🔊</button></h3>
      <div class="explain">${esc(r.corrected||'')}</div>
      ${focus?`<h3 style="margin:18px 0 8px">Что подтянуть</h3><div class="row">${focus}</div>`:''}
    </div>`;
}

/* ---------- Words of the day ---------- */
function Words(){
  const today=new Date().toISOString().slice(0,10);
  const cache=store.get('wordsCache',{});
  if(cache.date===today && cache.words){ renderWords(cache.words,today); return; }
  app.innerHTML=loader('Mr. Fluent подбирает слова на сегодня…');
  if(!AI.hasRealKey()){app.innerHTML='<div class="card fade"><div class="empty"><div class="ic">🔌</div><p>Слова дня генерирует ИИ — нужен подключённый воркер.</p></div></div>';return;}
  AI.dailyWords(AI.level(),6).then(r=>{
    const words=r.words||[];
    store.set('wordsCache',{date:today,words});
    // копим выученные
    renderWords(words,today);
  }).catch(e=>app.innerHTML='<div class="card fade"><div class="empty"><div class="ic">⚠️</div><p>'+esc(e.message)+'</p></div></div>');
}
function renderWords(words,today){
  const learned=new Set(store.get('learnedWords',[]).map(w=>w.word));
  const cards=words.map((w,i)=>`
    <div class="card" style="margin:0">
      <div class="row" style="justify-content:space-between">
        <h3 style="font-size:22px">${esc(w.word)} <button class="btn ghost sm" onclick="speak('${esc(w.word).replace(/'/g,"")}')">🔊</button></h3>
        <span class="pill">${esc(w.pos||'')}</span>
      </div>
      <p class="muted" style="margin:2px 0 8px">${esc(w.ipa||'')} · ${esc(w.ru||'')}</p>
      <p style="font-style:italic">«${esc(w.example||'')}» <button class="btn ghost sm" onclick="speak('${esc(w.example||'').replace(/'/g,"")}')">🔊</button></p>
      <p class="muted" style="font-size:13px;margin-top:8px">💡 ${esc(w.tip||'')}</p>
      <button class="btn ${learned.has(w.word)?'ghost':''} sm" data-learn="${i}" style="margin-top:12px">${learned.has(w.word)?'✓ в словаре':'+ выучил'}</button>
    </div>`).join('');
  const total=store.get('learnedWords',[]).length;
  app.innerHTML=`<div class="card fade level-badge" style="padding:22px">
      <div class="muted">Слова дня · ${today}</div>
      <p class="muted" style="margin-top:4px">В твоём словаре: <b style="color:var(--acc2)">${total}</b> слов</p></div>
    <div class="topics" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">${cards}</div>
    <div class="row" style="margin-top:18px;justify-content:center">
      <button class="btn ghost" id="wReroll">↻ Новый набор</button></div>`;
  app.querySelectorAll('[data-learn]').forEach(b=>b.onclick=()=>{
    const w=words[+b.dataset.learn];const arr=store.get('learnedWords',[]);
    if(!arr.find(x=>x.word===w.word)){arr.push({word:w.word,ru:w.ru,date:Date.now()});store.set('learnedWords',arr);}
    b.className='btn ghost sm';b.textContent='✓ в словаре';toast('Добавлено в словарь');
  });
  document.getElementById('wReroll').onclick=()=>{store.set('wordsCache',{});Words();};
}

/* ---------- Chat с Mr. Fluent (с памятью) ---------- */
function md(t){
  return esc(t)
    .replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>')
    .replace(/`([^`]+)`/g,'<code>$1</code>')
    .replace(/^\s*[-*]\s+(.*)$/gm,'• $1')
    .replace(/\n/g,'<br>');
}
const CHAT_MAX=24; // сколько последних реплик помним
function Chat(){
  const log=store.get('chatLog',[]);
  const bubbles=log.map(m=>chatBubble(m)).join('') ||
    `<div class="muted" style="text-align:center;padding:30px">Спроси что угодно про английский: «объясни Present Perfect», «дай 5 упражнений на артикли», «проверь предложение …», «в чём разница between/among».</div>`;
  app.innerHTML=`
  <div class="card fade" style="display:flex;flex-direction:column;height:calc(100vh - 170px);min-height:420px">
    <div class="row" style="justify-content:space-between;margin-bottom:12px">
      <h2 style="font-size:20px">Чат с Mr. Fluent</h2>
      <button class="btn ghost sm" id="chatClear">Очистить</button>
    </div>
    <div id="chatBox" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding-right:4px">${bubbles}</div>
    <div class="fillrow" style="margin-top:14px">
      <input id="chatIn" placeholder="Напиши сообщение…" autocomplete="off">
      <button class="btn" id="chatSend">→</button>
    </div>
  </div>`;
  const box=document.getElementById('chatBox');box.scrollTop=box.scrollHeight;
  const input=document.getElementById('chatIn');
  document.getElementById('chatClear').onclick=()=>{store.set('chatLog',[]);Chat();};
  const send=async()=>{
    const text=input.value.trim();if(!text)return;
    if(!AI.hasRealKey()){toast('Чат работает с подключённым ИИ');return;}
    const log=store.get('chatLog',[]);
    log.push({role:'user',content:text});store.set('chatLog',log);
    input.value='';
    box.insertAdjacentHTML('beforeend',chatBubble({role:'user',content:text}));
    const tid='t'+Date.now();
    box.insertAdjacentHTML('beforeend',`<div id="${tid}" class="opt" style="align-self:flex-start;max-width:80%;cursor:default"><span class="muted">Mr. Fluent печатает…</span></div>`);
    box.scrollTop=box.scrollHeight;
    try{
      const msgs=[{role:'system',content:AI.PERSONA_CHAT()},...log.slice(-CHAT_MAX)];
      const reply=await AI.chatTurns(msgs);
      const l2=store.get('chatLog',[]);l2.push({role:'assistant',content:reply});store.set('chatLog',l2.slice(-60));
      document.getElementById(tid).outerHTML=chatBubble({role:'assistant',content:reply});
    }catch(e){document.getElementById(tid).outerHTML=chatBubble({role:'assistant',content:'⚠️ '+e.message});}
    box.scrollTop=box.scrollHeight;
  };
  document.getElementById('chatSend').onclick=send;
  input.addEventListener('keydown',e=>{if(e.key==='Enter')send();});
  input.focus();
}
function chatBubble(m){
  const me=m.role==='user';
  return `<div style="align-self:${me?'flex-end':'flex-start'};max-width:82%;
    padding:12px 16px;border-radius:15px;line-height:1.55;font-size:15px;
    ${me?'background:linear-gradient(135deg,var(--acc),#9a7bff);color:#fff;border-bottom-right-radius:5px':
        'background:rgba(255,255,255,.04);border:1px solid var(--line);border-bottom-left-radius:5px'}">
    ${me?esc(m.content):md(m.content)}
    ${me?'':'<button class="btn ghost sm" style="margin-top:8px" onclick="speak(this.parentElement.innerText)">🔊</button>'}</div>`;
}

/* ---------- API key modal ---------- */
const km=document.getElementById('keyModal');
document.getElementById('keyBtn').onclick=()=>{document.getElementById('keyInput').value=localStorage.getItem('aiProxy')||'';km.classList.remove('hidden');};
km.onclick=e=>{if(e.target===km)km.classList.add('hidden');};
document.getElementById('keySave').onclick=()=>{
  const v=document.getElementById('keyInput').value.trim();
  if(v)localStorage.setItem('aiProxy',v);else localStorage.removeItem('aiProxy');
  km.classList.add('hidden');toast(v?'Воркер сохранён ✓':'Сброшено к вшитому');
};
document.getElementById('keyDefault').onclick=()=>{localStorage.removeItem('aiProxy');km.classList.add('hidden');toast('Используется вшитый воркер');};

/* ---- sync UI ---- */
const syncState=()=>{const c=localStorage.getItem('syncCode');document.getElementById('syncState').textContent=c?('Включена, код: '+c):'Выключена.';document.getElementById('syncInput').value=c||'';};
document.getElementById('keyBtn').addEventListener('click',syncState);
document.getElementById('syncOn').onclick=async()=>{
  const code=document.getElementById('syncInput').value.trim().toLowerCase();
  if(code.length<4)return toast('Код минимум 4 символа');
  if(!AI.hasRealKey())return toast('Нужен подключённый воркер');
  try{
    const had=await pullState(code);
    localStorage.setItem('syncCode',code);
    if(had){toast('Прогресс загружен ✓');setTimeout(()=>location.reload(),600);}
    else{await pushState();toast('Синхронизация включена ✓');}
    syncState();
  }catch(e){toast('Ошибка: '+e.message);}
};
document.getElementById('syncPush').onclick=async()=>{
  const code=localStorage.getItem('syncCode')||document.getElementById('syncInput').value.trim().toLowerCase();
  if(code.length<4)return toast('Сначала включи синхронизацию');
  localStorage.setItem('syncCode',code);
  try{await pushState();toast('Выгружено ✓');}catch(e){toast('Ошибка: '+e.message);}
};
document.getElementById('syncOff').onclick=()=>{localStorage.removeItem('syncCode');syncState();toast('Синхронизация выключена');};

/* ---------- bg particles ---------- */
(function(){
  const c=document.getElementById('bg'),x=c.getContext('2d');let w,h,ps;
  function rs(){w=c.width=innerWidth;h=c.height=innerHeight;ps=Array.from({length:46},()=>({x:Math.random()*w,y:Math.random()*h,r:Math.random()*1.8+.4,vx:(Math.random()-.5)*.25,vy:(Math.random()-.5)*.25}))}
  rs();addEventListener('resize',rs);
  (function loop(){x.clearRect(0,0,w,h);ps.forEach(p=>{p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>w)p.vx*=-1;if(p.y<0||p.y>h)p.vy*=-1;
    x.beginPath();x.arc(p.x,p.y,p.r,0,7);x.fillStyle='rgba(120,150,255,.5)';x.fill();});
    ps.forEach((a,i)=>ps.slice(i+1).forEach(b=>{const d=Math.hypot(a.x-b.x,a.y-b.y);if(d<120){x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.strokeStyle=`rgba(108,140,255,${.12*(1-d/120)})`;x.stroke();}}));
    requestAnimationFrame(loop);})();
})();

router();
