/* ===== FLUENT · AI English Coach ===== */
const app = document.getElementById('app');
const SKILLS = ["Tenses","Prepositions","Use of English","Grammar","Vocabulary","Reading"];
const TEST_LEN = 10;

const store = {
  get:(k,d)=>{try{return JSON.parse(localStorage.getItem(k))??d}catch{return d}},
  set:(k,v)=>localStorage.setItem(k,JSON.stringify(v)),
};
const toast = m => {
  const t=document.createElement('div');t.className='toast';t.textContent=m;
  document.body.appendChild(t);setTimeout(()=>t.remove(),2600);
};
const esc = s => (s||'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
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
