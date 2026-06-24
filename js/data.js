/* ===== Офлайн-банк: работает без API-ключа ===== */
const BANK = {
  // адаптивный пул вопросов, level 1..6, со skill-тегом
  questions: [
    {level:1,skill:"Tenses",q:"She ___ to school every day.",options:["go","goes","going","gone"],answer:1,explain:"Present Simple, 3-е лицо ед.ч. → +s: goes."},
    {level:1,skill:"Prepositions",q:"I'm good ___ playing chess.",options:["in","at","on","for"],answer:1,explain:"good AT (doing) something — устойчивое сочетание."},
    {level:1,skill:"Vocabulary",q:"Choose the synonym of 'big':",options:["tiny","large","narrow","weak"],answer:1,explain:"big = large."},
    {level:2,skill:"Tenses",q:"By the time we arrived, the film ___.",options:["started","has started","had started","starts"],answer:2,explain:"Past Perfect: действие до другого прошлого — had started."},
    {level:2,skill:"Use of English",q:"He suggested ___ a break.",options:["to take","taking","take","took"],answer:1,explain:"suggest + V-ing → suggested taking."},
    {level:2,skill:"Grammar",q:"If I ___ you, I'd apologize.",options:["am","was","were","be"],answer:2,explain:"Second conditional: were для всех лиц."},
    {level:3,skill:"Prepositions",q:"She apologized ___ being late.",options:["for","of","to","with"],answer:0,explain:"apologize FOR something."},
    {level:3,skill:"Vocabulary",q:"'To put off' means:",options:["to wear","to postpone","to remove","to start"],answer:1,explain:"put off = отложить, postpone."},
    {level:3,skill:"Use of English",q:"Hardly ___ when it started to rain.",options:["we left","had we left","we had left","did we left"],answer:1,explain:"Инверсия после Hardly: had we left."},
    {level:4,skill:"Grammar",q:"I'd rather you ___ smoke here.",options:["don't","didn't","not","wouldn't"],answer:1,explain:"I'd rather + past simple (didn't) для просьбы о другом человеке."},
    {level:4,skill:"Tenses",q:"This time next week I ___ on a beach.",options:["will lie","will be lying","lie","am lying"],answer:1,explain:"Future Continuous: процесс в конкретный момент будущего."},
    {level:4,skill:"Vocabulary",q:"A 'breakthrough' is:",options:["a failure","a major discovery","a short break","an argument"],answer:1,explain:"breakthrough = прорыв, важное достижение."},
    {level:5,skill:"Use of English",q:"No sooner had he sat down ___ the phone rang.",options:["when","than","that","then"],answer:1,explain:"No sooner ... than (фиксированная конструкция)."},
    {level:5,skill:"Grammar",q:"___ his efforts, he failed.",options:["Despite","Although","However","Because"],answer:0,explain:"Despite + существительное/герундий."},
    {level:5,skill:"Vocabulary",q:"'Meticulous' is closest to:",options:["careless","very careful","fast","lazy"],answer:1,explain:"meticulous = дотошный, очень тщательный."},
  ],
  theory: {
    "Tenses":{title:"Времена: ключевые ловушки",html:"<h3>Perfect vs Simple</h3><p>Present Perfect связывает прошлое с настоящим: <code>I have lost my keys</code> (и сейчас их нет). Past Simple — завершённое прошлое с маркером времени: <code>I lost them yesterday</code>.</p><h3>Past Perfect</h3><p>Действие <b>до</b> другого прошлого: <code>When I arrived, they had already left</code>.</p><ul><li><code>She has worked here since 2019</code> (продолжается)</li><li><code>By 2020 she had worked there for a year</code> (до точки в прошлом)</li></ul>"},
    "Prepositions":{title:"Предлоги после глаголов и прилагательных",html:"<h3>Частые связки</h3><ul><li>good <code>at</code>, interested <code>in</code>, afraid <code>of</code></li><li>depend <code>on</code>, apologize <code>for</code>, succeed <code>in</code></li><li>responsible <code>for</code>, married <code>to</code>, similar <code>to</code></li></ul><p>Их нужно учить как фразы целиком — логики часто нет.</p>"},
    "Use of English":{title:"Use of English: инверсия и герундий",html:"<h3>Инверсия</h3><p>После отрицательных наречий в начале — обратный порядок: <code>Never have I seen...</code>, <code>Hardly had I left when...</code>, <code>No sooner had... than...</code>.</p><h3>Gerund / Infinitive</h3><ul><li>suggest, enjoy, avoid + <code>V-ing</code></li><li>decide, agree, manage + <code>to V</code></li></ul>"},
    "Grammar":{title:"Грамматика B2: условные и wish",html:"<h3>Conditionals</h3><ul><li>2nd: <code>If I were rich, I would travel</code></li><li>3rd: <code>If I had known, I would have come</code></li></ul><h3>Wish</h3><p><code>I wish I knew</code> (сейчас не знаю), <code>I wish I had known</code> (сожаление о прошлом).</p>"},
    "Vocabulary":{title:"Словарь B2+: фразовые и идиомы",html:"<h3>Фразовые глаголы</h3><ul><li>put off = отложить</li><li>come up with = придумать</li><li>look into = изучить</li><li>carry out = выполнить</li></ul><p>Учите в контексте предложения, а не списком.</p>"},
  },
  exercises: {
    _generic:[
      {type:"mc",q:"By next year I ___ here for a decade.",options:["work","will have worked","worked"],answer:1,explain:"Future Perfect."},
      {type:"fill",q:"She's interested ___ art.",answer:"in",alt:[],explain:"interested IN."},
      {type:"mc",q:"He avoided ___ the question.",options:["to answer","answering","answer"],answer:1,explain:"avoid + V-ing."},
      {type:"fill",q:"If I ___ (be) you, I'd rest.",answer:"were",alt:["was"],explain:"2nd conditional — were."},
      {type:"mc",q:"Never ___ such a view.",options:["I have seen","have I seen","I saw"],answer:1,explain:"Инверсия после Never."},
    ]
  }
};
