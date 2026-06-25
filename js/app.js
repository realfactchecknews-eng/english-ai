/* ===== FLUENT · AI English Coach ===== */
const app = document.getElementById('app');
const SKILLS = ["Tenses","Prepositions","Use of English","Grammar","Vocabulary","Reading"];
const TEST_LEN = 10;

const SYNC_KEYS=['profile','attempts','writing','learnedWords','wordsCache','chatLog','deck','lastDaily'];
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
  if(!('speechSynthesis' in window))return toast('Your browser does not support speech');
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
  if(path==='/theory') return Theory();
  if(path==='/theory-read') return TheoryRead(params.get('t'));
  Home();
}
window.addEventListener('hashchange',router);

/* ---------- Home ---------- */
function Home(){
  const prof = store.get('profile',null);
  app.innerHTML = `
  <div class="hero fade">
    <span class="badge">AI English Coach · B1+ → B2 → C1</span>
    <h1>Take your English<br>to a confident level</h1>
    <p>The AI tests you, finds your weak spots and gives you personal theory and exercises for exactly those. No fluff.</p>
    <div class="row" style="justify-content:center">
      <a class="btn" href="#/test">${prof?'Retake the test':'Take the level test'}</a>
      ${prof?`<a class="btn ghost" href="#/dashboard">My progress (${prof.level})</a>`:''}
    </div>
    <div class="feature-grid">
      <div class="feat"><div class="ic">🎯</div><h3>Adaptive test</h3><p>Questions adjust to your answers and pin down your exact CEFR level.</p></div>
      <div class="feat"><div class="ic">🩺</div><h3>Weakness map</h3><p>See where you slip — grammar, tenses, prepositions, vocabulary.</p></div>
      <div class="feat"><div class="ic">📚</div><h3>Theory for you</h3><p>The AI explains the rule clearly with English examples.</p></div>
      <div class="feat"><div class="ic">✍️</div><h3>Exercises</h3><p>Drill your weak topic; the AI checks and explains your mistakes.</p></div>
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
  app.innerHTML = loader('The AI is picking a question…');
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
    <div class="qhead"><span class="pill">${esc(q.skill)}</span><span class="muted">Question ${T.i+1} / ${TEST_LEN}</span></div>
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
    `<div class="explain"><b>${ok?'Correct ✓':'Explanation:'}</b> ${esc(q.explain)}</div>`;
  const btn=document.createElement('button');
  btn.className='btn';btn.style.marginTop='18px';
  btn.textContent = T.i+1>=TEST_LEN?'See result →':'Next →';
  btn.onclick=()=>{T.i++;loadQuestion();};
  app.querySelector('.card').appendChild(btn);
}

async function finishTest(){
  app.innerHTML = loader('The AI is analysing your answers and grading your level…');
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
  return {level,summary:`You answered ${Math.round(score*100)}% of the questions correctly. This is an offline estimate — connect the AI for a precise analysis.`,
    skills,weak:weak.length?weak:['Use of English'],advice:'Focus on your weak topics in the Practice section.'};
}

/* ---------- Dashboard ---------- */
function Dashboard(){
  const p = store.get('profile',null);
  if(!p){
    app.innerHTML=`<div class="card fade"><div class="empty"><div class="ic">🧭</div><h2>No data yet</h2><p class="muted">Take the level test to see the map of your strengths and weaknesses.</p><a class="btn" style="margin-top:18px" href="#/test">Take the test</a></div></div>`;return;
  }
  const skills=(p.skills||[]).map(s=>{
    const w=s.pct<70;
    const col=s.pct<50?'var(--bad)':s.pct<70?'var(--warn)':'var(--good)';
    return `<div class="skill"><span class="nm ${w?'weak':''}">${esc(s.name)}</span>
      <div class="bar"><i style="width:${s.pct}%;background:${col}"></i></div>
      <span class="pct">${s.pct}%</span></div>`;
  }).join('');
  const weak=(p.weak||[]).map(t=>`<a class="topic" href="#/lesson?t=${encodeURIComponent(t)}">
    <span class="tag weak">weak spot</span><h3>${esc(t)}</h3><p>Theory + exercises from the AI →</p></a>`).join('');
  app.innerHTML=`
  <div class="card fade level-badge">
    <div class="muted">Your level</div>
    <div class="lv">${esc(p.level)}</div>
    <p class="muted" style="max-width:520px;margin:8px auto 0">${esc(p.summary||'')}</p>
  </div>
  <div class="card fade"><h2 style="margin-bottom:16px">Skills map</h2><div class="skills">${skills}</div></div>
  <div class="card fade"><h2 style="margin-bottom:6px">What to work on first</h2>
    <p class="muted" style="margin-bottom:14px">${esc(p.advice||'')}</p>
    <div class="topics">${weak||'<p class="muted">No weak topics found — great work!</p>'}</div></div>
  <div class="row" style="margin-top:18px;justify-content:center">
    <a class="btn ghost" href="#/practice">All practice topics</a>
    <a class="btn ghost" href="#/test">Retake the test</a>
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
      <span class="tag ${w?'weak':'ok'}">${w?'your weak spot':'practice'}</span>
      <h3>${esc(t)}</h3><p>Theory + 5 exercises →</p></a>`;
  }).join('');
  app.innerHTML=`<div class="card fade"><h2 style="margin-bottom:6px">Practice by topic</h2>
    <p class="muted" style="margin-bottom:16px">Pick a topic — the AI explains the rule and gives exercises with feedback.</p>
    <div class="topics">${cards}</div></div>`;
}

/* ---------- Lesson (theory + exercises) ---------- */
async function Lesson(topic){
  topic=topic||'Tenses';
  const lvl=store.get('profile',{}).level||'B2';
  app.innerHTML=loader('The AI is preparing a lesson on "'+esc(topic)+'"…');
  let th,ex;
  if(AI.hasRealKey()){
    try{ [th,ex]=await Promise.all([AI.theory(topic,lvl),AI.exercises(topic,lvl,5)]); }
    catch(e){ th=offTheory(topic); ex={items:BANK.exercises._generic}; }
  } else { th=offTheory(topic); ex={items:BANK.exercises._generic}; }
  renderLesson(topic,th,ex.items||[]);
}
function offTheory(t){return BANK.theory[t]||{title:t,html:'<p>Connect the AI (⚙) so it can generate theory for this topic. For now, basic exercises are available below.</p>'};}

function renderLesson(topic,th,items){
  const ex=items.map((it,idx)=>{
    if(it.type==='fill'){
      return `<div class="card ex-item" data-idx="${idx}" data-type="fill">
        <div class="qtext" style="font-size:16px">${esc(it.q).replace(/___/g,'<b>______</b>')}</div>
        <div class="fillrow"><input placeholder="your answer" data-input><button class="btn sm" data-check>Check</button></div>
        <div data-res></div></div>`;
    }
    const opts=(it.options||[]).map((o,i)=>`<div class="opt" data-i="${i}">${esc(o)}</div>`).join('');
    return `<div class="card ex-item" data-idx="${idx}" data-type="mc">
      <div class="qtext" style="font-size:16px">${esc(it.q).replace(/___/g,'<b>______</b>')}</div>
      <div class="opts">${opts}</div><div data-res></div></div>`;
  }).join('');
  app.innerHTML=`
  <div class="row" style="margin-bottom:16px"><a class="btn ghost sm" href="#/dashboard">← Back</a>
    <a class="btn ghost sm" href="#/lesson?t=${encodeURIComponent(topic)}" onclick="location.reload&&0">↻ New exercises</a></div>
  <div class="card fade theory"><h2>${esc(th.title||topic)}</h2>${th.html||''}</div>
  <h2 style="margin:24px 0 4px;font-family:Sora">Exercises</h2>
  <p class="muted" style="margin-bottom:14px">Solve and check — the AI explains every answer.</p>
  ${ex}`;
  // bind
  app.querySelectorAll('.ex-item').forEach(card=>{
    const it=items[+card.dataset.idx];
    if(card.dataset.type==='mc'){
      card.querySelectorAll('.opt').forEach(el=>el.onclick=()=>{
        const i=+el.dataset.i,ok=i===it.answer;
        card.querySelectorAll('.opt').forEach((o,idx)=>{o.style.pointerEvents='none';
          if(idx===it.answer)o.classList.add('correct');else if(idx===i)o.classList.add('wrong');else o.classList.add('dim');});
        card.querySelector('[data-res]').innerHTML=`<div class="explain"><b>${ok?'Correct ✓':'Explanation:'}</b> ${esc(it.explain||'')}</div>`;
      });
    } else {
      const input=card.querySelector('[data-input]');
      const go=()=>{
        const ok=AI.checkFill(input.value,it);
        input.style.borderColor=ok?'var(--good)':'var(--bad)';
        card.querySelector('[data-res]').innerHTML=`<div class="explain"><b>${ok?'Correct ✓':'Answer: '+esc(it.answer)}</b> ${esc(it.explain||'')}</div>`;
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
  const hist=store.get('writing',[]);
  const histHtml=hist.slice().reverse().slice(0,15).map((h,i)=>`
    <div class="topic" data-h="${hist.length-1-i}" style="cursor:pointer">
      <span class="tag ${h.score>=73?'ok':'weak'}">${esc(h.band||'')} · ${h.score||0}/100</span>
      <p class="muted" style="font-size:12px">${new Date(h.date).toLocaleDateString('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</p>
      <p style="font-size:13px;margin-top:4px">${esc((h.task||'').slice(0,70))}…</p></div>`).join('')
    ||'<p class="muted">No checks yet. Write your first essay!</p>';
  app.innerHTML=`
  <div class="tabs">
    <div class="tab active" data-tab="new">New writing</div>
    <div class="tab" data-tab="hist">History (${hist.length})</div>
  </div>
  <div id="wnewWrap" class="card fade">
    <h2 style="margin-bottom:6px">Writing · detailed feedback</h2>
    <p class="muted" style="margin-bottom:14px">Pick a ready-made topic or type your own. Fluent breaks it down by criteria, fixes it and grades you honestly.</p>
    <div class="row" style="margin-bottom:10px">
      <input id="wtopic" placeholder="Your own topic (optional)…" style="flex:1;min-width:220px;padding:12px 15px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--txt);font-size:14px">
    </div>
    <div class="explain" style="margin-bottom:14px"><b>Task:</b> <span id="wtask">${esc(task)}</span>
      <button class="btn ghost sm" id="wnew" style="margin-left:8px">↻ another</button></div>
    <textarea id="wtext" placeholder="Write your answer in English here…" style="width:100%;min-height:220px;padding:15px;border-radius:13px;border:1px solid var(--line);background:rgba(255,255,255,.03);color:var(--txt);font-size:15px;font-family:Inter;line-height:1.6;resize:vertical"></textarea>
    <div class="row" style="margin-top:14px"><button class="btn" id="wcheck">Check ✍️</button>
      <span class="muted" id="wcount">0 words</span></div>
    <div id="wres" style="margin-top:18px"></div>
  </div>
  <div id="whistWrap" class="card fade" style="display:none"><h2 style="margin-bottom:14px">Check history</h2>
    <div class="topics">${histHtml}</div></div>`;
  // tabs
  app.querySelectorAll('.tab').forEach(t=>t.onclick=()=>{
    app.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');
    document.getElementById('wnewWrap').style.display=t.dataset.tab==='new'?'':'none';
    document.getElementById('whistWrap').style.display=t.dataset.tab==='hist'?'':'none';
  });
  app.querySelectorAll('[data-h]').forEach(c=>c.onclick=()=>{
    const r=store.get('writing',[])[+c.dataset.h];if(r&&r.full)showWritingResult(r.full,true);
  });
  const ta=document.getElementById('wtext');
  const topic=document.getElementById('wtopic');
  topic.oninput=()=>{if(topic.value.trim())document.getElementById('wtask').textContent=topic.value.trim();};
  ta.oninput=()=>document.getElementById('wcount').textContent=(ta.value.trim().match(/\S+/g)||[]).length+' words';
  document.getElementById('wnew').onclick=()=>{if(!topic.value.trim())Writing();};
  document.getElementById('wcheck').onclick=async()=>{
    const text=ta.value.trim();
    if((text.match(/\S+/g)||[]).length<15)return toast('Write at least a couple of sentences');
    const res=document.getElementById('wres');res.innerHTML=loader('Fluent is reading your writing carefully…');
    if(!AI.hasRealKey()){res.innerHTML='<div class="explain">Writing feedback only works with the AI connected (worker).</div>';return;}
    const tk=document.getElementById('wtask').textContent;
    try{
      const r=await AI.writingCheck(tk,text);
      renderWriteResult(res,r);
      const log=store.get('writing',[]);
      log.push({date:Date.now(),score:r.score,band:r.band,task:tk,full:r});
      store.set('writing',log.slice(-40));
    }catch(e){res.innerHTML='<div class="explain"><b>Error:</b> '+esc(e.message)+'</div>';}
  };
}
function showWritingResult(r,modal){
  // открыть историческую проверку поверх
  Writing();
  setTimeout(()=>{document.querySelector('[data-tab="new"]').click();renderWriteResult(document.getElementById('wres'),r);
    document.getElementById('wres').scrollIntoView({behavior:'smooth'});},30);
}
function renderWriteResult(el,r){
  const errs=(r.errors||[]).map(e=>`<div style="padding:11px 0;border-top:1px solid var(--line)">
    <span style="color:var(--bad);text-decoration:line-through">${esc(e.wrong)}</span> →
    <span style="color:var(--good)">${esc(e.right)}</span>
    <div class="muted" style="font-size:13px;margin-top:3px"><b style="color:var(--acc2)">${esc(e.rule||'')}</b> — ${esc(e.explain||'')}</div></div>`).join('')
    || '<p class="muted">No real errors found — great job!</p>';
  const crit=(r.criteria||[]).map(c=>{
    const col=c.score<50?'var(--bad)':c.score<73?'var(--warn)':'var(--good)';
    return `<div class="crit"><span class="nm">${esc(c.name)}</span>
      <div class="bar"><i style="width:${c.score}%;background:${col}"></i></div>
      <span class="pct">${c.score}</span></div>
      <p class="muted" style="font-size:12px;margin:-2px 0 6px">${esc(c.note||'')}</p>`;
  }).join('');
  const strengths=(r.strengths||[]).map(s=>`<li>${esc(s)}</li>`).join('');
  const focus=(r.nextFocus||[]).map(f=>`<a class="pill" style="text-decoration:none" href="#/lesson?t=${encodeURIComponent(f)}">${esc(f)} →</a>`).join(' ');
  el.innerHTML=`
    <div class="card" style="margin:0">
      <div class="row" style="justify-content:space-between"><h3>Band: <span style="color:var(--acc2)">${esc(r.band||'')}</span></h3><span class="lv" style="font-size:32px">${r.score||0}<span style="font-size:16px">/100</span></span></div>
      ${crit?`<div style="margin:14px 0">${crit}</div>`:''}
      ${strengths?`<h3 style="margin:14px 0 6px;color:var(--good)">What's good</h3><ul class="theory">${strengths}</ul>`:''}
      <p class="muted" style="margin:14px 0 16px;line-height:1.6">${esc(r.feedback||'')}</p>
      <h3 style="margin-bottom:4px">Errors</h3>${errs}
      <h3 style="margin:18px 0 8px">Corrected version <button class="btn ghost sm" onclick="speak(this.nextElementSibling.textContent)">🔊</button></h3>
      <div class="explain" style="line-height:1.7">${esc(r.corrected||'')}</div>
      ${focus?`<h3 style="margin:18px 0 8px">Drill these next</h3><div class="row">${focus}</div>`:''}
    </div>`;
}

/* ---------- Колоды слов (Anki-style SRS) ---------- */
const DAY=86400000, NEW_PER_DAY=5;
function getDeck(){return store.get('deck',[]);}
function addToDeck(w){ // w: {w,ipa,pos,def,ex,syn}
  const deck=getDeck();
  if(deck.find(c=>c.w.toLowerCase()===w.w.toLowerCase()))return false;
  deck.push({...w,due:Date.now(),interval:0,ease:2.3,reps:0,added:Date.now()});
  store.set('deck',deck);return true;
}
function seedDaily(){
  const today=new Date().toISOString().slice(0,10);
  if(store.get('lastDaily','')===today)return;
  const deck=getDeck();const have=new Set(deck.map(c=>c.w.toLowerCase()));
  const pool=WORDBANK.filter(w=>!have.has(w.w.toLowerCase()));
  // перемешать и взять 5
  for(let i=pool.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[pool[i],pool[j]]=[pool[j],pool[i]];}
  pool.slice(0,NEW_PER_DAY).forEach(w=>addToDeck({w:w.w,ipa:w.ipa,pos:w.pos,def:w.def,ex:w.ex,syn:w.syn}));
  store.set('lastDaily',today);
}
function dueCards(){const n=Date.now();return getDeck().filter(c=>c.due<=n);}
function Words(){
  seedDaily();
  const deck=getDeck();const due=dueCards();
  const newToday=deck.filter(c=>Date.now()-c.added<DAY);
  const mastered=deck.filter(c=>c.interval>=21).length;
  app.innerHTML=`
  <div class="card fade level-badge" style="padding:24px">
    <div class="muted">Your word deck</div>
    <div class="deckstat">
      <div><b style="color:var(--acc2)">${deck.length}</b><span class="muted">total</span></div>
      <div><b style="color:var(--warn)">${due.length}</b><span class="muted">due</span></div>
      <div><b style="color:var(--good)">${mastered}</b><span class="muted">learned</span></div>
    </div>
    <div class="row" style="justify-content:center;margin-top:8px">
      <button class="btn" id="rev" ${due.length?'':'disabled'}>Review ${due.length?`(${due.length})`:'— all done for today'}</button>
      <button class="btn ghost" id="addMore">+ Add 5 words</button>
    </div>
  </div>
  <h2 style="margin:22px 0 6px;font-family:Sora">New today</h2>
  <p class="muted" style="margin-bottom:14px">5 fresh words a day. Hit “Review” and drill them like in Anki — the system reminds you at the right moment.</p>
  <div class="topics" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))" id="todayList">${newToday.map(wordCard).join('')||'<p class="muted">All reviewed for today 💪</p>'}</div>`;
  document.getElementById('rev').onclick=()=>review(dueCards());
  document.getElementById('addMore').onclick=()=>{store.set('lastDaily','');seedDaily();Words();toast('Added 5 words');};
}
function wordCard(c){
  return `<div class="card" style="margin:0">
    <div class="row" style="justify-content:space-between">
      <h3 style="font-size:21px">${esc(c.w)} <button class="btn ghost sm" onclick="speak('${esc(c.w).replace(/'/g,"")}')">🔊</button></h3>
      <span class="pill">${esc(c.pos||'')}</span></div>
    <p class="muted" style="margin:2px 0 8px">${esc(c.ipa||'')} · ${esc(c.def||'')}</p>
    <p style="font-style:italic">«${esc(c.ex||'')}»</p>
    ${c.syn?`<p class="muted" style="font-size:13px;margin-top:8px">≈ ${esc(c.syn)}</p>`:''}</div>`;
}
// SRS-сессия
function review(queue){
  if(!queue.length){toast('Nothing to review');return Words();}
  let idx=0;
  const show=()=>{
    if(idx>=queue.length){app.innerHTML=`<div class="card fade"><div class="empty"><div class="ic">🎉</div><h2>Session complete!</h2><p class="muted">Reviewed ${queue.length} words. Come back tomorrow.</p><a class="btn" style="margin-top:16px" href="#/words">Back to deck</a></div></div>`;return;}
    const c=queue[idx];
    app.innerHTML=`
    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <a class="btn ghost sm" href="#/words">← Exit</a><span class="muted">${idx+1} / ${queue.length}</span></div>
    <div class="flash" id="flash">
      <div class="flash-inner">
        <div class="flash-face">
          <div class="wd">${esc(c.w)}</div><div class="ipa">${esc(c.ipa||'')}</div>
          <button class="btn ghost sm" onclick="event.stopPropagation();speak('${esc(c.w).replace(/'/g,"")}')">🔊</button>
          <p class="muted" style="margin-top:14px">Tap to reveal the meaning</p>
        </div>
        <div class="flash-face flash-back">
          <span class="pill">${esc(c.pos||'')}</span>
          <div style="font-size:16px;margin:6px 0">${esc(c.def||'')}</div>
          <p style="font-style:italic;font-size:14px">«${esc(c.ex||'')}»</p>
          ${c.syn?`<p class="muted" style="font-size:13px">≈ ${esc(c.syn)}</p>`:''}
        </div>
      </div>
    </div>
    <div class="srs-btns" id="srs" style="display:none">
      <button class="again" data-g="0">Again</button>
      <button data-g="1">Hard</button>
      <button class="good" data-g="2">Good</button>
      <button class="easy" data-g="3">Easy</button>
    </div>`;
    const fl=document.getElementById('flash');
    fl.onclick=()=>{fl.classList.add('flip');document.getElementById('srs').style.display='grid';};
    document.querySelectorAll('#srs button').forEach(b=>b.onclick=()=>{grade(c,+b.dataset.g);idx++;show();});
  };
  show();
}
function grade(card,g){
  const deck=getDeck();const c=deck.find(x=>x.w===card.w);if(!c)return;
  c.reps=(c.reps||0)+1;
  if(g===0){c.interval=0;c.ease=Math.max(1.3,c.ease-0.2);c.due=Date.now()+10*60000;}
  else if(g===1){c.interval=Math.max(1,(c.interval||1)*1.2);c.ease=Math.max(1.3,c.ease-0.15);c.due=Date.now()+c.interval*DAY;}
  else if(g===2){c.interval=c.interval<1?1:c.interval*c.ease;c.due=Date.now()+c.interval*DAY;}
  else{c.ease+=0.15;c.interval=(c.interval<1?2:c.interval*c.ease*1.3);c.due=Date.now()+c.interval*DAY;}
  store.set('deck',deck);
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
    `<div class="muted" style="text-align:center;padding:30px">Ask anything about English: "explain Present Perfect", "give me 5 exercises on articles", "check this sentence …", "what's the difference between/among".</div>`;
  app.innerHTML=`
  <div class="card fade" style="display:flex;flex-direction:column;height:calc(100vh - 170px);min-height:420px">
    <div class="row" style="justify-content:space-between;margin-bottom:12px">
      <h2 style="font-size:20px">Chat with Fluent</h2>
      <button class="btn ghost sm" id="chatClear">Clear</button>
    </div>
    <div id="chatBox" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:12px;padding-right:4px">${bubbles}</div>
    <div class="fillrow" style="margin-top:14px">
      <input id="chatIn" placeholder="Type a message…" autocomplete="off">
      <button class="btn" id="chatSend">→</button>
    </div>
  </div>`;
  const box=document.getElementById('chatBox');box.scrollTop=box.scrollHeight;
  const input=document.getElementById('chatIn');
  document.getElementById('chatClear').onclick=()=>{store.set('chatLog',[]);Chat();};
  const send=async()=>{
    const text=input.value.trim();if(!text)return;
    if(!AI.hasRealKey()){toast('Chat works with the AI connected');return;}
    const log=store.get('chatLog',[]);
    log.push({role:'user',content:text});store.set('chatLog',log);
    input.value='';
    box.insertAdjacentHTML('beforeend',chatBubble({role:'user',content:text}));
    const tid='t'+Date.now();
    box.insertAdjacentHTML('beforeend',`<div id="${tid}" class="opt" style="align-self:flex-start;max-width:80%;cursor:default"><span class="muted">Fluent is typing…</span></div>`);
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

/* ---------- Теория (справочник) ---------- */
const THEORY_TOPICS=["Tenses","Conditionals","Articles","Modal verbs","Reported speech","Passive voice","Prepositions","Phrasal verbs","Use of English","Grammar","Vocabulary","Gerunds & Infinitives","Relative clauses","Comparatives & Superlatives","Word order & Inversion","Future forms"];
function Theory(){
  const cards=THEORY_TOPICS.map(t=>`<a class="topic" href="#/theory-read?t=${encodeURIComponent(t)}">
    <span class="tag ok">theory</span><h3>${esc(t)}</h3><p>Rules + examples →</p></a>`).join('');
  app.innerHTML=`<div class="card fade"><h2 style="margin-bottom:6px">Theory · grammar reference</h2>
    <p class="muted" style="margin-bottom:16px">Pure theory with examples. The AI explains any topic; at the end there's a button to jump to exercises.</p>
    <div class="topics">${cards}</div></div>`;
}
async function TheoryRead(topic){
  topic=topic||'Tenses';
  const lvl=store.get('profile',{}).level||'B2';
  app.innerHTML=loader('Preparing theory on "'+esc(topic)+'"…');
  let th;
  if(AI.hasRealKey()){try{th=await AI.theory(topic,lvl);}catch(e){th=offTheory(topic);}}
  else th=offTheory(topic);
  app.innerHTML=`
  <div class="row" style="margin-bottom:16px"><a class="btn ghost sm" href="#/theory">← All topics</a>
    <a class="btn ghost sm" href="#/lesson?t=${encodeURIComponent(topic)}">To exercises →</a></div>
  <div class="card fade theory"><h2>${esc(th.title||topic)}</h2>${th.html||''}</div>`;
}

/* ---------- Словарь по клику (двойной клик по слову) ---------- */
const lookupEl=document.getElementById('lookup');
let lookupCache=store.get('lookupCache',{});
function hideLookup(){lookupEl.classList.add('hidden');}
document.addEventListener('click',e=>{if(!lookupEl.contains(e.target))hideLookup();});
document.addEventListener('dblclick',async e=>{
  if(lookupEl.contains(e.target))return;
  const sel=(window.getSelection().toString()||'').trim();
  if(!sel||sel.length<2||sel.length>40||/[^a-zA-Z' -]/.test(sel))return;
  const ctx=e.target.textContent?e.target.textContent.slice(0,160):'';
  const x=Math.min(e.clientX,innerWidth-340),y=e.clientY+14;
  lookupEl.style.left=Math.max(10,x)+'px';lookupEl.style.top=y+'px';
  lookupEl.classList.remove('hidden');
  const key=sel.toLowerCase();
  if(lookupCache[key]){renderLookup(lookupCache[key]);return;}
  lookupEl.innerHTML='<div class="loader" style="padding:14px"><div class="spin" style="width:24px;height:24px"></div></div>';
  if(!AI.hasRealKey()){lookupEl.innerHTML='<p class="muted">Connect AI to look up words.</p>';return;}
  try{
    const d=await AI.lookup(sel,ctx);
    lookupCache[key]=d;store.set('lookupCache',lookupCache);
    renderLookup(d);
  }catch(err){lookupEl.innerHTML='<p class="muted">No definition found.</p>';}
});
function renderLookup(d){
  const syn=(d.syn||[]).length?`<div class="syn"><b>syn:</b> ${esc((d.syn||[]).join(', '))}</div>`:'';
  const ant=(d.ant||[]).length?`<div class="syn"><b>opp:</b> ${esc((d.ant||[]).join(', '))}</div>`:'';
  lookupEl.innerHTML=`
    <h4>${esc(d.word||'')} <span class="sp" onclick="speak('${esc(d.word||'').replace(/'/g,"")}')">🔊</span></h4>
    <div class="pos">${esc(d.ipa||'')} · ${esc(d.pos||'')}</div>
    <p style="margin:8px 0 4px">${esc(d.def||'')}</p>
    ${d.example?`<p class="muted" style="font-style:italic">«${esc(d.example)}»</p>`:''}
    ${syn}${ant}
    <button class="btn sm" style="margin-top:10px" onclick="addLookupToDeck('${esc((d.word||'').replace(/'/g,''))}')">+ to deck</button>`;
}
function addLookupToDeck(word){
  const d=lookupCache[word.toLowerCase()];if(!d)return;
  const ok=addToDeck({w:d.word,ipa:d.ipa,pos:d.pos,def:d.def,ex:d.example,syn:(d.syn||[]).join(', ')});
  toast(ok?'Added to deck ✓':'Already in deck');hideLookup();
}
window.addLookupToDeck=addLookupToDeck;

/* ---------- API key modal ---------- */
const km=document.getElementById('keyModal');
document.getElementById('keyBtn').onclick=()=>{document.getElementById('keyInput').value=localStorage.getItem('aiProxy')||'';km.classList.remove('hidden');};
km.onclick=e=>{if(e.target===km)km.classList.add('hidden');};
document.getElementById('keySave').onclick=()=>{
  const v=document.getElementById('keyInput').value.trim();
  if(v)localStorage.setItem('aiProxy',v);else localStorage.removeItem('aiProxy');
  km.classList.add('hidden');toast(v?'Worker saved ✓':'Reset to built-in');
};
document.getElementById('keyDefault').onclick=()=>{localStorage.removeItem('aiProxy');km.classList.add('hidden');toast('Using the built-in worker');};

/* ---- sync UI ---- */
const syncState=()=>{const c=localStorage.getItem('syncCode');document.getElementById('syncState').textContent=c?('On, code: '+c):'Off.';document.getElementById('syncInput').value=c||'';};
document.getElementById('keyBtn').addEventListener('click',syncState);
document.getElementById('syncOn').onclick=async()=>{
  const code=document.getElementById('syncInput').value.trim().toLowerCase();
  if(code.length<4)return toast('Code must be at least 4 characters');
  if(!AI.hasRealKey())return toast('A connected worker is required');
  try{
    const had=await pullState(code);
    localStorage.setItem('syncCode',code);
    if(had){toast('Progress loaded ✓');setTimeout(()=>location.reload(),600);}
    else{await pushState();toast('Sync enabled ✓');}
    syncState();
  }catch(e){toast('Error: '+e.message);}
};
document.getElementById('syncPush').onclick=async()=>{
  const code=localStorage.getItem('syncCode')||document.getElementById('syncInput').value.trim().toLowerCase();
  if(code.length<4)return toast('Enable sync first');
  localStorage.setItem('syncCode',code);
  try{await pushState();toast('Uploaded ✓');}catch(e){toast('Error: '+e.message);}
};
document.getElementById('syncOff').onclick=()=>{localStorage.removeItem('syncCode');syncState();toast('Sync disabled');};

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
