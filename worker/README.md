# FLUENT AI Worker (Cloudflare)

Прокси, который прячет API-ключ платной модели. Фронт ходит сюда, ключ нигде в репозитории не лежит.

## Деплой за 3 минуты (через дашборд, без CLI)
1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Create Worker**.
2. Назови `fluent-ai`, **Deploy**, затем **Edit code** — вставь содержимое `worker.js`, **Deploy**.
3. **Settings → Variables and Secrets**:
   - `API_KEY` → **Encrypt** (Secret) → твой ключ провайдера.
   - `BASE_URL` (Text) → эндпоинт провайдера:
     - OpenAI: `https://api.openai.com/v1/chat/completions`
     - Groq: `https://api.groq.com/openai/v1/chat/completions`
     - DeepSeek: `https://api.deepseek.com/chat/completions`
     - OpenRouter: `https://openrouter.ai/api/v1/chat/completions`
   - `MODEL` (Text) → напр. `gpt-4o-mini`, `gpt-4o`, `llama-3.3-70b-versatile`.
   - `ALLOW_ORIGIN` (Text) → `https://realfactchecknews-eng.github.io`
4. Скопируй адрес воркера (`https://fluent-ai.<твой>.workers.dev`).
5. В `js/ai.js` впиши `const PROXY = 'https://fluent-ai.<твой>.workers.dev/chat';` и запушь.

## Через CLI (опционально)
```bash
npm i -g wrangler
cd worker
wrangler deploy
wrangler secret put API_KEY
# BASE_URL / MODEL / ALLOW_ORIGIN — в дашборде или wrangler.toml [vars]
```

## Проверка
```bash
curl -X POST https://fluent-ai.<твой>.workers.dev/chat \
  -H 'Content-Type: application/json' \
  -d '{"system":"Reply with JSON {\"ok\":true}","user":"ping","json":true}'
```
