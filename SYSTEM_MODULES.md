### AVESINT.AI — детальний опис модулів і підсистем

Цей документ описує призначення, структуру та взаємодію всіх основних модулів у монорепозиторії AVESINT.AI. Матеріал узгоджений з README.md і PROJECT_ANALYSIS.md та доповнює їх деталями на рівні модулів.

---

## 1) Огляд архітектури та потік даних

- Клієнт (React SPA, папка: `avesint-ai-client`) звертається до бекенду (NestJS, папка: `avesint-ai-server/api`) через REST (`/api/*`) та WebSocket (Socket.IO).
- Воркер OSINT (папка: `osint-worker`) інтегрується із зовнішніми джерелами (наприклад, Telegram), нормалізує/верифікує дані і відправляє їх у бекенд.
- Бекенд зберігає дані в PostgreSQL (TypeORM). Частина пошукових/векторних можливостей реалізована через сервіс `QdrantService` (інтеграція з Qdrant).
- Уніфікований шар «Stream» агрегує дані різних типів у нормалізований DTO (IntelligenceItem) для єдиної стрічки на фронтенді.

Спрощений потік подій:
1) Джерело → osint-worker (парсинг/верифікація) → API (ендпоінти Osint/Events/Tasks).
2) API → зберігання в БД → повідомлення через Socket.IO (AiStreamGateway/інші gateway).
3) Клієнт → підписка на потоки/REST → відображення в «Stream», «Карта», «Аналітика».

---

## 2) Бекенд (NestJS) — модулі

Точка входу: `api/src/main.ts` (префікс `/api`, CORS, глобальні пайпи). Композиція модулів: `api/src/app.module.ts`.

Нижче — опис підключених доменних модулів і загальних сервісів.

### 2.1 AuthModule (`api/src/auth/*`)
- Призначення: аутентифікація (JWT), авторизація (ролі), інтеграція з користувачами та аудитом.
- Ключові файли:
  - `auth.module.ts` — декларація модуля (JwtModule, PassportModule, UsersModule, AuditLogModule).
  - `auth.controller.ts` — ендпоінти логіну/оновлення/валід.
  - guards/decorators: `common/decorators/roles.decorator.ts`, guards для ролей/JWT.
  - DTO: `auth/dto/login.dto.ts`; payload: `auth/interfaces/jwt-payload.interface.ts`.
- Основні ендпоінти (приклади):
  - `POST /api/auth/login` — видача JWT.
  - `GET /api/auth/me` — дані поточного користувача (за токеном).
- Залежності: UsersModule, AuditLogModule.

### 2.2 TwoFactorModule (`api/src/two-factor/*`)
- Призначення: другий фактор (TOTP/коди), керування увімкненням/перевіркою 2FA.
- Файли: `two-factor.controller.ts`, `two-factor.module.ts`, сервіс перевірки кодів.

### 2.3 UsersModule (`api/src/users/*`)
- Призначення: управління користувачами, ролями, профілем; інтеграція з Auth і AuditLog.
- Файли: `users.controller.ts`, `users.service.ts`, ентіті користувача (TypeORM), DTO.
- Ендпоінти: CRUD користувача, зміна ролей (обмежено ролями/guard’ами).

### 2.4 AuditLogModule (`api/src/audit-log/*`)
- Призначення: журналювання дій користувачів/системи (аудит важливих змін).
- Файли: `audit-log.controller.ts`, `audit-log.service.ts`, ентіті AuditLog.
- Використання: ін’єктується до сервісів доменів (напр., TargetsService) для запису аудиту.

### 2.5 EventsModule (`api/src/events/*`)
- Призначення: домен подій/інцидентів (OSINT події, повідомлення, геокоординати, статуси).
- Файли: `events.module.ts`, `events.controller.ts`, `events.service.ts`, ентіті Event, DTO, роут-файл.
- Можливості: CRUD, фільтрація, пагінація, пошук за часом/типом/статусом/джерелом, геополя.
- Інтеграції:
  - зі StreamModule для нормалізованої видачі подій у єдиній стрічці.
  - із воркером (створення/оновлення подій з фонових процесів).

### 2.6 TargetsModule (`api/src/targets/*`)
- Призначення: управління «цілями» (targets) для OSINT/аналітики.
- Файли: `targets.module.ts`, `targets.controller.ts`, `targets.service.ts`.
- Сервіс: `TargetsService` надає методи `list`, `getById`, `create`, `update`, `delete` з аудитом змін.
- Ендпоінти: CRUD, фільтрація списку.

### 2.7 TasksModule (`api/src/tasks/*`)
- Призначення: планування/виконання асинхронних задач (OSINT перевірки, парсинг, верифікація).
- Файли: `tasks.module.ts`, `tasks.controller.ts`, `tasks.service.ts`.
- Можливості: CRUD задач/підзадач, зміна статусів, отримання прогресу; інтеграція з воркером.

### 2.8 OsintModule (`api/src/osint/*`)
- Призначення: API-шар для OSINT процесів та джерел (прийом/керування даними від воркерів).
- Файли: `osint.module.ts`, `osint.controller.ts`, `osint-sources.controller.ts`, `osint.gateway.ts` (за наявності).
- Можливості: реєстрація джерел, надсилання нових елементів, публікація подій у WebSocket.

### 2.9 StreamModule (`api/src/stream/*`)
- Призначення: агрегований read-only шар для уніфікованої стрічки розвідданих.
- Файли: `stream.module.ts`, `stream.controller.ts`, сервіс агрегації, DTO `IntelligenceItem`.
- Можливості: читання нормалізованих елементів з Events/Osint/інших доменів. Використовується клієнтом для сторінки «Stream».

### 2.10 ReportsModule (`api/src/reports/*`)
- Призначення: звіти/експорти/аналітика на API-рівні.
- Файли: `reports.module.ts`, `reports.controller.ts`, `reports.service.ts`.
- Можливості: побудова агрегатів, експорти (CSV/PDF), підбірки по фільтрах.

### 2.11 AI / AiStream / Пошук
- AiStreamGateway (`api/src/ai-stream/ai-stream.gateway.ts`)
  - Призначення: Socket.IO push оновлення (нові елементи стрічки, зміни статусів тощо).
- AI Query (`api/src/ai/*`)
  - `ai-query.module.ts`, `ai-query.controller.ts` — запити до AI/пошуку.
  - `ai-qdrant-search.controller.ts` + `common/qdrant.service.ts` — векторний пошук подій/документів у Qdrant.
- Ai-Map/Search Controllers (`api/src/ai-stream/ai-map.controller.ts`, `ai-stream/ai-search.controller.ts`)
  - Ендпоінти для карти (вибірка подій у viewport) й пошуку.

### 2.12 Common/Infrastructure
- `common/qdrant.service.ts` — сервіс інтеграції з Qdrant (створення/запити колекцій, upsert/пошук векторів).
- `common/decorators/roles.decorator.ts` — декоратор ролей для guard’ів.
- Конфігурація: `ConfigModule` (isGlobal), `TypeOrmModule` (autoLoadEntities, `DB_SYNCHRONIZE` для деву).

Безпека та доступ:
- JWT, ролі (@Roles + Guards), 2FA. CORS керується `CORS_ORIGINS`. WebSocket захищається токеном.

---

## 3) Фронтенд (React SPA)

Технології: React 19, Vite 7, TypeScript, Tailwind, shadcn/ui (Radix), TanStack Router/Query, socket.io-client, Leaflet, Recharts.

Організація коду: фіче-орієнтована структура `src/features/*`, спільні бібліотеки у `src/lib/*`, утиліти та хелпери — `src/shared/*` (фактичні шляхи можуть відрізнятися — орієнтуйтеся на проект).

Ключові фічі/модулі:
- Auth (`src/features/auth/*`)
  - Компоненти логіну/форм, інтеграція з API (`/api/auth/login`), зберігання токена, guard для маршрутів.
- Events (`src/features/events/*`)
  - Список подій, рядок дії для елемента (наприклад, `event-row-actions.tsx`), мапа подій і панелі фільтрів.
- Stream (`src/features/stream/*` або інтегровано в AI/Overview)
  - Рендер уніфікованого `IntelligenceItem` списку, фільтри type/status/confidence/time/source, підписка на Socket.IO.
- AI (`src/features/ai/*`)
  - Панель AI-запиту (`ai-query-panel.tsx`), інтеграція з AI/пошук ендпоінтами бекенду.
- Targets (`src/features/targets/*`)
  - CRUD для цілей, схеми валідації (`data/schema.ts`), таблиці/деталі.
- Tasks (`src/features/dashboard/components/DashboardTasks.tsx` та `src/features/tasks/*`)
  - Віджети завдань, перегляд підзадач, статуси.
- Overview/Dashboard (`src/features/overview/*`, `src/features/dashboard/*`)
  - Карти, графіки (Recharts), пайчарти, KPI.
- Загальні бібліотеки API: `src/lib/api/*`
  - REST-клієнт (axios), обгортки запитів, клієнт стріму (`lib/api/stream.ts`).
- Сокети: `hooks/useOsintStream.ts` (може бути розташований в `src/hooks/*`) — підписка на Socket.IO події.

Маршрутизація:
- @tanstack/react-router з файловими маршрутами; приклади з README: `/_authenticated/map/`, сторінки для дашборду, стрічки, аутентифікації.

Стейт/кеш:
- TanStack Query для серверних даних, локальний стан (наприклад, Zustand) для UI-параметрів/фільтрів.

---

## 4) OSINT Worker (`osint-worker`)

Призначення: інтеграція з зовнішніми джерелами OSINT (зокрема Telegram), нормалізація/верифікація, відправка у бекенд.

Ключові файли:
- `src/telegram_worker.py` — основний сценарій роботи з Telegram (парсинг/черги/надсилання до API). Враховує, що у Nest префікс `/api` заданий у `main.ts`.

Конфігурація:
- `.env` у корені воркера: URL API, токени доступу до джерел, параметри черг/затримок.

Пайплайн (див. також `OSINT_PIPELINE.md`):
1) Збір: отримання даних із каналів/ботів/джерел.
2) Нормалізація: приведення джерельних полів до внутрішніх DTO/схем.
3) Верифікація/тріаж: автоматичні перевірки, евристики, оцінка довіри (confidence).
4) Відправка до API: створення/оновлення подій, запуск задач/підзадач через Tasks/Osint ендпоінти.

---

## 5) Інфраструктура і конфігурація

- `docker-compose.yml` — локальний підйом залежностей (PostgreSQL тощо). Перевіряйте змінні середовища та volume’и.
- Бекенд `.env` (в `avesint-ai-server/api`):
  - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASS`, `DB_NAME`
  - `DB_SYNCHRONIZE=true` (лише для розробки)
  - `CORS_ORIGINS=http://localhost:5173`
  - `JWT_SECRET=...`

Запуск:
- Backend: `cd avesint-ai-server/api && pnpm i && pnpm start:dev` → http://localhost:3000/api
- Frontend: `cd avesint-ai-client && pnpm i && pnpm dev` → http://localhost:5173
- Docker (опційно): `docker-compose up -d`

---

## 6) Контракти даних і DTO

- TypeORM ентіті: авто-підвантаження через `autoLoadEntities` у `TypeOrmModule.forRootAsync`.
- Stream DTO: `IntelligenceItem` — уніфікація подій/новин/OSINT елементів для фронтенду.
- AI/Qdrant: пошукові DTO для запитів/відповідей; інтеграція через `QdrantService`.

---

## 7) Безпека

- Аутентифікація: JWT; авторизація: ролі (@Roles + Guards); 2FA модуль.
- CORS: конфіг із `CORS_ORIGINS`.
- WebSocket: авторизація по токену, сегментація подій через простори/кімнати (за потреби).
- Аудит: AuditLog для критичних сценаріїв.

---

## 8) Взаємодії між модулями (приклади)

- TargetsService → AuditLogService: запис змін при `create/update/delete` target.
- OsintController → EventsService: створення події з воркера, подальший push через AiStreamGateway.
- AiMapController → EventsService/StreamService: вибірка подій для карти (за bbox/фільтрами).
- AiQdrantSearchController → QdrantService: векторний пошук по подіях/контенту.

---

## 9) Орієнтири у коді (корисні файли)

- `api/src/app.module.ts` — повний список підключених модулів бекенду.
- `api/src/common/qdrant.service.ts` — інтеграція з Qdrant.
- `api/src/targets/targets.service.ts` — приклад сервісу з аудитом та CRUD логікою.
- `api/src/tasks/tasks.controller.ts` — приклади ендпоінтів задач/підзадач.
- `api/src/events/events.controller.ts` — CRUD та фільтрація подій.
- `api/src/ai/ai-qdrant-search.controller.ts` — приклад контролера для пошуку в Qdrant.
- `client/src/features/ai/ai-query-panel.tsx` — фронтенд-панель AI/пошуку.
- `client/src/features/targets/data/schema.ts` — валідаційні схеми для Targets.
- `osint-worker/src/telegram_worker.py` — вхідна точка для збору з Telegram.

---

## 10) Нотатки щодо подальшої документалізації

- Рекомендується опублікувати Swagger/OpenAPI схеми для всіх ендпоінтів (включно з Stream/Osint/AI) та зафіксувати контракт `IntelligenceItem`.
- Додати діаграму компонентів і послідовностей (PlantUML/Mermaid) у цю ж директорію при потребі пояснювальної записки.
