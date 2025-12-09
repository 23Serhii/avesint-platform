### Огляд репозиторію AVESINT.AI (архітектура, модулі, ризики, рекомендації)

Цей документ є технічним оглядом поточного стану проєкту AVESINT.AI. Він узагальнює структуру, ключові модулі фронтенду/бекенду/воркера, точки інтеграції (HTTP, WebSocket), конфігурацію середовищ, а також містить ризики та практичні рекомендації для подальших ітерацій.

---

## 1) Загальна структура репозиторію

- avesint-ai-client — SPA на React 19 + Vite 7 (Tailwind, TanStack Router/Query, Socket.IO).
- avesint-ai-server/api — NestJS 11 + TypeORM + PostgreSQL + Socket.IO (REST API + WS gateway).
- osint-worker — асинхронний воркер (Python) для збору/обробки OSINT та інтеграції з API.
- docker-compose.yml — інфраструктурний конфіг для локального підняття сервісів.
- README.md — основний гайд зі швидким стартом і раціоналізацією модулів.

---

## 2) Бекенд (NestJS)

Точки входу та конфігурація:
- src/main.ts
  - Global prefix: /api
  - CORS: читається зі змінної CORS_ORIGINS (список через кому; дефолт — http://localhost:5173)
  - ValidationPipe: whitelist + transform
  - Порт: 3000

- src/app.module.ts
  - ConfigModule (isGlobal: true)
  - TypeORM: autoLoadEntities, synchronize за DB_SYNCHRONIZE
  - Підключені модулі: Users, Auth, TwoFactor, Events, AuditLog, Targets, Tasks, Osint, Stream, Reports
  - Socket.IO gateway: AiStreamGateway

Основні домени/модулі (огляд):
- Auth: контролери/DTO/гварди (JWT, roles), 2FA. Присутні dto/login, guards/roles.guard тощо.
- Users: керування користувачами (ролі, аудит доступів через AuditLog).
- Events: стрічка подій (перегляд, фільтрація, можлива верифікація).
- Osint: API для OSINT‑процесів, взаємодія з воркером, websocket оновлення.
- Stream: агрегуючий read‑only шар для нормалізованих елементів розвідданих (IntelligenceItem DTO).
- Tasks/Targets/Reports: задачі, цілі, звітність.
- AuditLog: журнал дій.

WebSocket:
- AiStreamGateway та окремі gateway у доменах (наприклад, osint.gateway.ts), використовують Socket.IO для push‑подій у клієнт.

Конфіг і безпека:
- .env параметри: DB_HOST/PORT/USER/PASS/NAME, DB_SYNCHRONIZE, CORS_ORIGINS тощо.
- Ролі/гварди: кастомний декоратор @Roles і Guards для JWT/ролей/refresh.
- Рекомендація: в продакшені DB_SYNCHRONIZE=false + міграції.

API зручно організований за модульною структурою Nest; для cross‑feature перегляду «стрічки» реалізовано StreamModule з уніфікованим DTO (IntelligenceItem) — як рекомендує README.

---

## 3) Фронтенд (React + Vite)

Технології:
- React 19, Vite 7, Tailwind 4, Radix UI, TanStack Router/Query, Zustand, socket.io-client, Leaflet (карта), Recharts.

Архітектура клієнта:
- Фіче‑орієнтована структура: src/features/* (overview, dashboard, events, auth, errors тощо).
- Компоненти лейауту: Header/Main/Sidebar; темізація, профіль, конфіґ‑дровер.
- Роутинг: TanStack Router (перегляд карти/дашборду/стрічки/аутентифікації).
- Інтеграція з бекендом: axios для REST, socket.io-client для WS. Є хук useOsintStream для підписки на події.

Приклади:
- features/overview/index.tsx — сторінка «Огляд», використовує Header/Main та локальний OverviewDashboard.
- features/dashboard/components/* — віджети дашборду, аналітика, задачі.
- hooks/useOsintStream.ts — робота з потоковими подіями OSINT через Socket.IO.

UI/UX за README рухається до уніфікації «стрічки» з нормалізованими елементами (IntelligenceItem) замість кількох дублюючих розділів.

---

## 4) Воркер (osint-worker)

Призначення:
- Інтеграція з Telegram/зовнішніми джерелами, обробка даних, відправка в API.

Ключі й примітки:
- src/telegram_worker.py — містить логіку взаємодії, вказівки про сумісність з бекендом (префікс /api у Nest main.ts).
- .env у каталозі воркера — конфіг для доступу до бекенду/джерел.

---

## 5) Інфраструктура і запуск

Локальний дев:
- Backend: pnpm i && pnpm start:dev у avesint-ai-server/api → http://localhost:3000/api
- Frontend: pnpm i && pnpm dev у avesint-ai-client → http://localhost:5173
- CORS: CORS_ORIGINS задавати списком (через кому) відповідно до доменів клієнта.
- БД: PostgreSQL; у деві допускається DB_SYNCHRONIZE=true (лише локально).

Docker:
- docker-compose.yml для одночасного підняття сервісів (перевірити змінні середовища й volume для Postgres).

---

## 6) Дані та DTO

- Бекенд використовує TypeORM entities (autoLoadEntities). StreamModule надає нормалізований DTO IntelligenceItem, який зводить події/новини/osint‑елементи до одного представлення.
- Фронтенд очікує цей формат на сторінці «Stream» і використовує фільтри type/status/confidence/time/source.

Рекомендації:
- Визначити контракт IntelligenceItem у спільному пакеті/файлі DTO на бекенді та використовувати його у всіх точках (OpenAPI схеми можуть допомогти фронту).

---

## 7) Безпека

- Аутентифікація/авторизація: JWT, 2FA, ролі (@Roles + RolesGuard), захищені WS‑з’єднання через токени.
- CORS керується змінними середовища.
- Рекомендації продакшену: HTTPS/WSS термінація, secure cookies (якщо використовуються), rate limiting, helmet, audit лог на критичних діях, централізована обробка помилок.

---

## 8) Відомі ризики і технічний борг

- Дублювання розділів на фронтенді (Events/OSINT/Review/News) → низька щільність інформації, різні фільтри/статуси. README вже пропонує уніфікацію через Stream.
- TypeORM synchronize у деві: ок, але потрібні міграції для продакшену.
- Валідація WS‑подій: переконатися, що guard’и застосовані системно, а формат подій стабільний.
- Конфіги CORS: багатодоменна підтримка працює через список; важливо не забути про продакшн‑URLs.

---

## 9) Практичні рекомендації (наступні кроки)

Швидкі перемоги:
1) Додати «Verification Queue» як пресет фільтрів сторінки Stream на фронті.
2) Уніфікувати UI‑компоненти: ItemRow/Card, ConfidenceMeter, SourceBadge, ItemActions.
3) Оприлюднити OpenAPI (Swagger) з описом IntelligenceItem і бекенд‑ендпоінтів Stream/Events/Osint.
4) Перевести налаштування WS‑URL у конфіг клієнта (env) з fallback на localhost.

Середньостроково:
5) Вимкнути DB_SYNCHRONIZE у продакшені, перейти на міграції.
6) Додати rate limiting/helmet на API рівні.
7) Розділити рівні доступу у WS‑каналах за ролями/просторами (namespaces/rooms) для скорочення фан‑ауту подій.

---

## 10) Висновок

Архітектура чиста і модульна: NestJS + React з Socket.IO та агрегуючим Stream‑шаром для уніфікації даних. Основна UX‑оптимізація — перейти на єдину «Стрічку» з пресетами фільтрів (Verification Queue) та уніфікованими компонентами. На бекенді — стабілізувати DTO, оприлюднити схеми (Swagger), впорядкувати міграції і безпекові практики для продакшену.
