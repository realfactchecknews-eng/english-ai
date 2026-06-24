# FLUENT · AI English Coach

Платформа для прокачки английского с **B1+ до уверенного B2 / C1**. Внутри ИИ-репетитор (Groq), который тестирует уровень, находит слабые стороны и даёт по ним персональную теорию и упражнения.

🔗 Демо: `https://realfactchecknews-eng.github.io/english-ai/`

## Как работает
1. **Тест уровня** (`#/test`) — 10 адаптивных вопросов. Сложность растёт/падает по ходу ответов. ИИ выставляет CEFR-уровень.
2. **Прогресс** (`#/dashboard`) — уровень + карта навыков (Tenses, Prepositions, Use of English, Grammar, Vocabulary, Reading) и список слабых тем.
3. **Прокачка** (`#/practice` → `#/lesson`) — по выбранной теме ИИ генерирует теорию (по-русски, с английскими примерами) и 5 упражнений с проверкой и разбором.

## ИИ
- Ключ модели **не лежит в репозитории**. Фронт ходит на **Cloudflare Worker** (`worker/`), а воркер уже подставляет секретный ключ платной модели и проксирует запрос.
- Провайдеро-независимо (любой OpenAI-совместимый: OpenAI, Groq, DeepSeek, OpenRouter, Together) — задаётся через переменные воркера `BASE_URL` / `MODEL` / `API_KEY`. Инструкция: [`worker/README.md`](worker/README.md).
- После деплоя воркера впиши его адрес в `js/ai.js` → `PROXY`. Можно переопределить адрес в рантайме через ⚙ (localStorage).
- **Без воркера** платформа работает в офлайн-режиме на встроенном банке вопросов и теории (`js/data.js`).

## Стек
Чистый HTML/CSS/JS, SPA с hash-роутером, без сборки. Хостинг — GitHub Pages (`.nojekyll`).

## Структура
- `index.html` — каркас, навигация, модалка ключа
- `css/style.css` — тёмная сине-бирюзовая тема, частицы, glassmorphism
- `js/ai.js` — слой Groq (вопросы, оценка, теория, упражнения)
- `js/data.js` — офлайн-банк (работает без ключа)
- `js/app.js` — роутер, движок теста, дашборд, уроки, фон

## Деплой на GitHub Pages
```bash
cd ~/english-ai
git add -A && git commit -m "FLUENT AI English coach"
git remote add origin https://github.com/realfactchecknews-eng/english-ai.git
git push -u origin main
```
Затем Settings → Pages → Branch: `main` / root.
