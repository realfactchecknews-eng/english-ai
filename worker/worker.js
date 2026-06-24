/* FLUENT AI proxy — Cloudflare Worker.
   Прячет API-ключ платной модели. Фронт шлёт {system,user,json,temp},
   воркер добавляет ключ и модель и проксирует в OpenAI-совместимый эндпоинт.

   Секреты/переменные (Settings → Variables в дашборде или wrangler secret):
     API_KEY   — секрет, ключ провайдера (обязательно)
     BASE_URL  — напр. https://api.openai.com/v1/chat/completions
                 (Groq: https://api.groq.com/openai/v1/chat/completions)
     MODEL     — напр. gpt-4o-mini / gpt-4o / llama-3.3-70b-versatile
     ALLOW_ORIGIN — твой GitHub Pages, напр. https://realfactchecknews-eng.github.io
*/
export default {
  async fetch(req, env) {
    const origin = env.ALLOW_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    if (req.method === 'OPTIONS') return new Response(null, {headers: cors});
    if (req.method !== 'POST') return json({error: 'POST only'}, 405, cors);

    let body;
    try { body = await req.json(); } catch { return json({error: 'bad json'}, 400, cors); }
    const {system = '', user = '', json: wantJson = true, temp = 0.4} = body;
    if (!user) return json({error: 'no user'}, 400, cors);

    const upstream = await fetch(env.BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + env.API_KEY,
      },
      body: JSON.stringify({
        model: env.MODEL,
        temperature: temp,
        ...(wantJson ? {response_format: {type: 'json_object'}} : {}),
        messages: [
          ...(system ? [{role: 'system', content: system}] : []),
          {role: 'user', content: user},
        ],
      }),
    });

    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: {...cors, 'Content-Type': 'application/json'},
    });
  },
};

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {status, headers: {...cors, 'Content-Type': 'application/json'}});
}
