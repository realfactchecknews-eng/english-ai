/* FLUENT AI proxy + sync — Cloudflare Worker.
   Маршруты:
     POST /chat  — проксирует запрос к ИИ (ключ скрыт).
                   body: {system,user,json,temp}  ИЛИ  {messages:[...],json,temp}
     POST /save  — сохранить прогресс. body: {code, data}
     GET  /load?code=XXX — загрузить прогресс.

   Переменные (Settings → Variables and Secrets):
     API_KEY (Secret), BASE_URL, MODEL, ALLOW_ORIGIN
   Для синхронизации привяжи KV-namespace как binding с именем STORE
   (Settings → Bindings → KV namespace → Variable name: STORE).
*/
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const cors = {
      'Access-Control-Allow-Origin': env.ALLOW_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (req.method === 'OPTIONS') return new Response(null, {headers: cors});

    // ---- Загрузка прогресса ----
    if (url.pathname === '/load') {
      if (!env.STORE) return json({error: 'no KV bound'}, 501, cors);
      const code = (url.searchParams.get('code') || '').trim().toLowerCase();
      if (!code) return json({error: 'no code'}, 400, cors);
      const data = await env.STORE.get('sync:' + code);
      return json({data: data ? JSON.parse(data) : null}, 200, cors);
    }

    if (req.method !== 'POST') return json({error: 'POST only'}, 405, cors);
    let body;
    try { body = await req.json(); } catch { return json({error: 'bad json'}, 400, cors); }

    // ---- Сохранение прогресса ----
    if (url.pathname === '/save') {
      if (!env.STORE) return json({error: 'no KV bound'}, 501, cors);
      const code = (body.code || '').trim().toLowerCase();
      if (!code || code.length < 4) return json({error: 'code too short'}, 400, cors);
      await env.STORE.put('sync:' + code, JSON.stringify(body.data || {}));
      return json({ok: true}, 200, cors);
    }

    // ---- Прокси к ИИ ----
    const {system = '', user = '', messages, json: wantJson = true, temp = 0.4} = body;
    const msgs = Array.isArray(messages) && messages.length
      ? messages
      : [...(system ? [{role: 'system', content: system}] : []), {role: 'user', content: user}];

    const upstream = await fetch(env.BASE_URL, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.API_KEY},
      body: JSON.stringify({
        model: env.MODEL,
        temperature: temp,
        ...(wantJson ? {response_format: {type: 'json_object'}} : {}),
        messages: msgs,
      }),
    });
    const text = await upstream.text();
    return new Response(text, {status: upstream.status, headers: {...cors, 'Content-Type': 'application/json'}});
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {status, headers: {...cors, 'Content-Type': 'application/json'}});
}
