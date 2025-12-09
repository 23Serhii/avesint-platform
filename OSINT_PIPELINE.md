### OSINT Pipeline — текстова схема та відповідність поточному проєкту

Цей документ описує цільову схему конвеєра OSINT та відображає її на поточну реалізацію в репозиторії.

1. Джерела даних
- News
  - Статус: частково/планується. Готового news-воркера немає у цьому репозиторії. Передбачено можливість легко додати RSS/HTTP-парсер за аналогією з Telegram worker.
- TG (Telegram)
  - Статус: реалізовано. osint-worker/src/telegram_worker.py відстежує канали, витягує текст/посилання/медіа-URL, формує payload і шле до бекенду.

2. Модуль парсингу
- Реалізовано в osint-worker/src/telegram_worker.py. Отримує сирі дані з Telegram (текст, посилання на YouTube, дата публікації, media-url тощо).

3. Модуль обробки даних (Gemma 3:12B через Ollama)
- Воркер викликає локальний Ollama (за замовчуванням model: gemma3:12b) для класифікації/пріоритезації/структурування.
- Очікувана структурована відповідь моделі (всередині воркера) та фолбек:
  {
    "type": "",
    "priority": "low|medium|high|critical",
    "category": "",
    "credibility": 0.0,
    "summary": "",
    "eventDate": null,
    "tags": []
  }
- Воркер будує OsintIngestDto з полями item/source та передає їх у бекенд:
  - item: { externalId, kind, title, content, summary, language, priority, type, category, tags, credibility, parseDate, eventDate, rawUrl, mediaUrl, meta }
  - source: { externalId, type, name, url, category }

4. Модуль збереження
- Реляційна БД (PostgreSQL)
  - Збереження джерела (osint_sources) та айтема (osint_items) — api/src/osint/osint.service.ts
  - Формування події для стрічки (events) — api/src/events/events.service.ts викликається з OsintService.ingest
- Векторне сховище
  - Підтримка Qdrant: є службовий скрипт синхронізації api/src/scripts/qdrant-sync-osint.ts (витягає дані з Qdrant і інжестить у бекенд). Автоматичної побудови ембедінгів під час ingest поки немає в бекенді; це заплановано як наступний крок.
  - ChromaDB: наразі не інтегровано в цьому репозиторії.

5. Фронтенд ↔ Бекенд
- REST: /stream (JWT guard) — api/src/stream/stream.controller.ts і stream.service.ts; клієнт: avesint-ai-client/src/lib/api/stream.ts
- WebSocket (Socket.IO): namespace /osint; бекенд транслює подію osint:item — api/src/osint/osint.gateway.ts; клієнтський хук прослуховує — avesint-ai-client/src/hooks/useOsintStream.ts
- UI стрічки: сторінка /stream — avesint-ai-client/src/routes/_authenticated/stream/index.tsx (показує live-події та підтримує пагінацію REST вибірки)

6. Додатковий блок (Backend ↔ Gemma 3:12B)
- У бекенді окремих endpoint/сервісів для уточнення запитів / аналітики через Gemma наразі немає. Обробка відбувається на боці воркера перед інжестом. Це може бути додано як розширення (наприклад, сервіс для query rewriting/summary по top‑K з векторного сховища) — наразі поза мінімальною реалізацією.

Висновок: Чи працює проєкт «як у схемі» зараз?
- Джерела: Telegram — так; News — потрібен окремий воркер/парсер (відсутній у цьому репо).
- Парсинг: так (у TG-воркері).
- Обробка через Gemma (класифікація/пріоритизація/структурування): так, у воркері через Ollama, з фолбеком.
- Збереження: так — у Postgres; векторна база — є Qdrant-скрипт, але немає автоматичної побудови ембедінгів при ingest у бекенді (можна увімкнути окремим компонентом).
- Фронтенд↔Бекенд: так — REST + Live через Socket.IO, стрічка подій працює, теги відображаються.
- Додатковий бекенд‑LLM блок: поки ні (на рівні бекенда), реалізовано у воркері.

Наступні кроки (коротко):
- Додати news-воркер (RSS або HTTP) за аналогією з telegram_worker.py.
- Додати опціональну побудову ембедінгів та upsert у Qdrant/ChromaDB під час ingest (feature-flag).
- Додати бекенд‑ендпоінти для семантичного пошуку та аналітики (за потреби).
