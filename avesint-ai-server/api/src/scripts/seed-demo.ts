// api/src/scripts/seed-demo.ts
//
// Очищає БД від доменних даних (окрім users) і заповнює більш реалістичними,
// різнорідними OSINT-джерелами, OSINT-айтемами, подіями, цілями та задачами.
//
// Фокус:
// - фронт: Донбас, Запорізький напрямок, лівобережна Херсонщина (ТОТ);
// - глибина ТОТ і РФ як тил ворога;
// - український тил (Київ, Львів, Дніпро, Одеса, Миколаїв) — диверсії, спроби розвідки,
//   підозріла активність, невідомі дрони;
// - авіація / цивільні борти з військовим вантажем;
// - без лінійних "прорив → одразу удар" сценаріїв.
//
// Запуск (з каталогу api/):
//   npm run seed:demo

import 'dotenv/config';
import { pool } from '../db';

async function main() {
  console.log('=== AVESINT DEMO SEED (реалістичніші дані) ===');

  const dbHost = process.env.DB_HOST ?? 'localhost';
  if (!['localhost', '127.0.0.1'].includes(dbHost)) {
    console.error(
      `DB_HOST=${dbHost} виглядає НЕ локальним, сідер зупинено для безпеки.`,
    );
    process.exit(1);
  }

  console.log('>> Truncate основних доменних таблиць (окрім users)…');

  const truncateSql = `
    TRUNCATE TABLE
      osint_items,
      osint_sources,
      events,
      targets,
      tasks,
      audit_log
    RESTART IDENTITY CASCADE;
  `;
  await pool.query(truncateSql);
  console.log('   OK: truncate завершено');

  // --- Базові довідники / географія ---

  type Theater = 'ua' | 'tot' | 'ru' | 'intl_airspace';
  type Zone = 'frontline' | 'ua_rear' | 'border' | 'ru_rear' | 'intl_airspace';

  const theaters: { key: Theater; name: string }[] = [
    { key: 'ua', name: 'Підконтрольна територія' },
    { key: 'tot', name: 'Тимчасово окупована територія' },
    { key: 'ru', name: 'Територія РФ' },
    { key: 'intl_airspace', name: 'Міжнародний повітряний простір' },
  ];

  const locations = [
    // Центральна Україна, тил
    {
      key: 'kyiv_energy',
      name: 'Енергетичні обʼєкти Києва',
      place: 'північні райони м. Київ',
      lat: 50.501,
      lon: 30.5,
      theater: 'ua' as Theater,
      region: 'Київська область',
      zone: 'ua_rear' as Zone,
    },
    {
      key: 'kyiv_rail',
      name: 'Київський залізничний вузол',
      place: 'район залізничних розвʼязок м. Київ',
      lat: 50.445,
      lon: 30.485,
      theater: 'ua' as Theater,
      region: 'Київська область',
      zone: 'ua_rear' as Zone,
    },
    {
      key: 'vinnytsia',
      name: 'Вінницький авіаційний напрямок (тил)',
      place: 'околиця м. Вінниця',
      lat: 49.234,
      lon: 28.463,
      theater: 'ua' as Theater,
      region: 'Вінницька область',
      zone: 'ua_rear' as Zone,
    },

    // Захід, глибокий тил
    {
      key: 'lviv',
      name: 'Львівський логістичний вузол (тил)',
      place: 'передмістя м. Львів',
      lat: 49.838,
      lon: 24.024,
      theater: 'ua' as Theater,
      region: 'Львівська область',
      zone: 'ua_rear' as Zone,
    },
    {
      key: 'lutsk',
      name: 'Луцький аеродром (тил)',
      place: 'район військового аеродрому поблизу Луцька',
      lat: 50.679,
      lon: 25.233,
      theater: 'ua' as Theater,
      region: 'Волинська область',
      zone: 'ua_rear' as Zone,
    },

    // Південь України (наш тил)
    {
      key: 'odesa_port',
      name: 'Одеський порт',
      place: 'портова зона м. Одеса',
      lat: 46.486,
      lon: 30.745,
      theater: 'ua' as Theater,
      region: 'Одеська область',
      zone: 'ua_rear' as Zone,
    },
    {
      key: 'mykolaiv',
      name: 'Миколаївський напрямок (тил)',
      place: 'околиці м. Миколаїв',
      lat: 46.953,
      lon: 32.014,
      theater: 'ua' as Theater,
      region: 'Миколаївська область',
      zone: 'ua_rear' as Zone,
    },

    // Дніпро / промисловий тил
    {
      key: 'dnipro_city',
      name: 'Дніпро (промислова зона)',
      place: 'промрайони м. Дніпро',
      lat: 48.467,
      lon: 35.04,
      theater: 'ua' as Theater,
      region: 'Дніпропетровська область',
      zone: 'ua_rear' as Zone,
    },

    // Схід / фронт
    {
      key: 'kharkiv_city',
      name: 'Харків (промислова зона)',
      place: 'промзона на східній околиці Харкова',
      lat: 49.964,
      lon: 36.327,
      theater: 'ua' as Theater,
      region: 'Харківська область',
      zone: 'ua_rear' as Zone, // обстріли тилу, але не колони ворога
    },
    {
      key: 'kupyansk',
      name: 'Купʼянський напрямок (фронт)',
      place: 'район м. Купʼянськ',
      lat: 49.7,
      lon: 37.65,
      theater: 'ua' as Theater,
      region: 'Харківська область',
      zone: 'frontline' as Zone,
    },
    {
      key: 'liman',
      name: 'Лимансько-Сіверський напрямок (фронт)',
      place: 'район м. Лиман',
      lat: 49.0,
      lon: 37.8,
      theater: 'ua' as Theater,
      region: 'Донецька область',
      zone: 'frontline' as Zone,
    },
    {
      key: 'chasy_yar',
      name: 'Бахмутський/Часів Яр напрямок (фронт)',
      place: 'район м. Часів Яр',
      lat: 48.56,
      lon: 37.6,
      theater: 'ua' as Theater,
      region: 'Донецька область',
      zone: 'frontline' as Zone,
    },
    {
      key: 'avdiivka',
      name: 'Авдіївський напрямок (фронт)',
      place: 'район м. Авдіївка',
      lat: 48.14,
      lon: 37.74,
      theater: 'ua' as Theater,
      region: 'Донецька область',
      zone: 'frontline' as Zone,
    },
    {
      key: 'belgorod_ru',
      name: 'Бєлгородський напрямок (РФ)',
      place: 'район м. Бєлгород (РФ)',
      lat: 50.6,
      lon: 36.58,
      theater: 'ru' as Theater,
      region: 'Бєлгородська область (РФ)',
    },
    {
      key: 'kursk_ru',
      name: 'Курський аеродром (РФ)',
      place: 'район військового аеродрому поблизу Курська (РФ)',
      lat: 51.75,
      lon: 36.295,
      theater: 'ru' as Theater,
      region: 'Курська область (РФ)',
    },
    {
      key: 'taganrog_ru',
      name: 'Таганрозький авіаційний вузол (РФ)',
      place: 'район аеродрому Таганрог (РФ)',
      lat: 47.258,
      lon: 38.92,
      theater: 'ru' as Theater,
      region: 'Ростовська область (РФ)',
    },

    // Далекий Схід РФ (для авіації далеко від України)
    {
      key: 'khabarovsk_ru',
      name: 'Хабаровський авіаційний кластер (РФ)',
      place: 'район військового аеродрому поблизу Хабаровська (РФ)',
      lat: 48.528,
      lon: 135.188,
      theater: 'ru' as Theater,
      region: 'Хабаровський край (РФ)',
    },
    {
      key: 'vladivostok_ru',
      name: 'Приморський авіаційний район (РФ)',
      place: 'район аеродрому поблизу Владивостока (РФ)',
      lat: 43.402,
      lon: 132.148,
      theater: 'ru' as Theater,
      region: 'Приморський край (РФ)',
    },
    // Запорізький фронт
    {
      key: 'zaporizhzhia_front',
      name: 'Запорізький напрямок (Оріхів – Роботине)',
      place: 'район м. Оріхів – с. Роботине',
      lat: 47.43,
      lon: 35.95,
      theater: 'ua' as Theater,
      region: 'Запорізька область',
      zone: 'frontline' as Zone,
    },

    // ТОТ Запоріжжя / Донбас (лівий берег, окупація)
    {
      key: 'berdiansk_tot',
      name: 'Бердянський напрямок (ТОТ)',
      place: 'околиці м. Бердянськ (тимчасово окуп.)',
      lat: 46.78,
      lon: 36.78,
      theater: 'tot' as Theater,
      region: 'Запорізька область (ТОТ)',
      zone: 'frontline' as Zone,
    },
    {
      key: 'melitopol_tot',
      name: 'Мелітополь (логістичний хаб, ТОТ)',
      place: 'район залізничного вузла м. Мелітополь (тимчасово окуп.)',
      lat: 46.846,
      lon: 35.365,
      theater: 'tot' as Theater,
      region: 'Запорізька область (ТОТ)',
      zone: 'frontline' as Zone,
    },
    {
      key: 'mariupol_tot',
      name: 'Маріуполь (промислова зона, ТОТ)',
      place: 'промислові райони м. Маріуполь (тимчасово окуп.)',
      lat: 47.095,
      lon: 37.546,
      theater: 'tot' as Theater,
      region: 'Донецька область (ТОТ)',
      zone: 'frontline' as Zone,
    },

    // Херсонщина — правий берег (наша, під обстрілами)
    {
      key: 'kherson_right_bank',
      name: 'Правобережна частина Херсонщини',
      place: 'м. Херсон та прилеглі громади правобережжя',
      lat: 46.655,
      lon: 32.617,
      theater: 'ua' as Theater,
      region: 'Херсонська область',
      zone: 'border' as Zone,
    },

    // Північ / кордон
    {
      key: 'chernihiv',
      name: 'Чернігівський напрямок (прикордонний район)',
      place: 'район м. Чернігів',
      lat: 51.5,
      lon: 31.3,
      theater: 'ua' as Theater,
      region: 'Чернігівська область',
      zone: 'border' as Zone,
    },
    {
      key: 'sumy_border',
      name: 'Сумський прикордонний район',
      place: 'північні райони Сумської області',
      lat: 51.2,
      lon: 34.0,
      theater: 'ua' as Theater,
      region: 'Сумська область',
      zone: 'border' as Zone,
    },

    // РФ / тил ворога
    {
      key: 'belgorod_ru',
      name: 'Бєлгородський напрямок (РФ)',
      place: 'район м. Бєлгород (РФ)',
      lat: 50.6,
      lon: 36.58,
      theater: 'ru' as Theater,
      region: 'Бєлгородська область (РФ)',
      zone: 'ru_rear' as Zone,
    },
    {
      key: 'kursk_ru',
      name: 'Курський аеродром (РФ)',
      place: 'район військового аеродрому поблизу Курська (РФ)',
      lat: 51.75,
      lon: 36.295,
      theater: 'ru' as Theater,
      region: 'Курська область (РФ)',
      zone: 'ru_rear' as Zone,
    },
    {
      key: 'taganrog_ru',
      name: 'Таганрозький авіаційний вузол (РФ)',
      place: 'район аеродрому Таганрог (РФ)',
      lat: 47.258,
      lon: 38.92,
      theater: 'ru' as Theater,
      region: 'Ростовська область (РФ)',
      zone: 'ru_rear' as Zone,
    },

    // Міжнародний повітряний простір
    {
      key: 'black_sea_airspace',
      name: 'Чорне море (міжнародний повітряний простір)',
      place: 'північно-західна частина Чорного моря',
      lat: 44.8,
      lon: 32.0,
      theater: 'intl_airspace' as Theater,
      region: 'Чорне море',
      zone: 'intl_airspace' as Zone,
    },
  ];

  const isEnemyGroundArea = (loc: (typeof locations)[number]) =>
    loc.theater === 'ru' ||
    loc.theater === 'tot' ||
    (loc.theater === 'ua' && loc.zone === 'frontline');

  const isFrontOrTot = (loc: (typeof locations)[number]) =>
    (loc.theater === 'ua' && loc.zone === 'frontline') || loc.theater === 'tot';

  const isUaRear = (loc: (typeof locations)[number]) =>
    loc.theater === 'ua' && loc.zone === 'ua_rear';

  // --- 1) OSINT_sources ---

  console.log('>> Insert OSINT sources…');

  const sources = [
    // Українські офіційні / напівофіційні
    {
      external_id: 'telegram:deepstate_ua',
      name: 'DeepState UA',
      type: 'telegram_channel',
      url: 'https://t.me/deepstate_ua',
      handle: 'deepstate_ua',
      language: 'uk',
      is_active: true,
      reliability: 0.8,
      category: 'osint-team',
      tags: ['ukrainian-osint', 'frontline'],
      description:
        'Український OSINT-проєкт з фокусом на карті бойових дій та щоденних оглядах.',
    },
    {
      external_id: 'telegram:atomiyk',
      name: 'Авіація ССО / БпЛА',
      type: 'telegram_channel',
      url: 'https://t.me/atomiyk',
      handle: 'atomiyk',
      language: 'uk',
      is_active: true,
      reliability: 0.75,
      category: 'official',
      tags: ['uaf', 'uav', 'strike'],
      description:
        'Канал Сил оборони з акцентом на ударах БпЛА, авіації та підготовці до них.',
    },
    {
      external_id: 'telegram:air_force_ua',
      name: 'Повітряні Сили ЗСУ (офіційно)',
      type: 'telegram_channel',
      url: 'https://t.me/kpszsu',
      handle: 'kpszsu',
      language: 'uk',
      is_active: true,
      reliability: 0.95,
      category: 'official',
      tags: ['uaf', 'air-defense', 'air-alerts'],
      description:
        'Офіційний ресурс Повітряних Сил: попередження, звіти про пуски та збиття.',
    },
    {
      external_id: 'telegram:local_kyiv_alerts',
      name: 'Київ. Оперативно',
      type: 'telegram_channel',
      url: 'https://t.me/kyiv_operativ',
      handle: 'kyiv_operativ',
      language: 'uk',
      is_active: true,
      reliability: 0.6,
      category: 'local-news',
      tags: ['local', 'kyiv', 'emergency'],
      description:
        'Міський новинний ресурс: вибухи, пожежі, перекриття доріг, підозрілі обʼєкти.',
    },
    {
      external_id: 'telegram:local_odesa_alerts',
      name: 'Одеса. Оперативно',
      type: 'telegram_channel',
      url: 'https://t.me/odesa_operativ',
      handle: 'odesa_operativ',
      language: 'uk',
      is_active: true,
      reliability: 0.55,
      category: 'local-news',
      tags: ['local', 'odesa', 'emergency'],
      description:
        'Локальний канал з повідомленнями про вибухи, пожежі, рух техніки в районі Одеси.',
    },

    // Ворожі / пропаганда
    {
      external_id: 'telegram:chdambiev',
      name: 'ChDambiev',
      type: 'telegram_channel',
      url: 'https://t.me/chdambiev',
      handle: 'chdambiev',
      language: 'ru',
      is_active: true,
      reliability: 0.3,
      category: 'enemy-prop',
      tags: ['ru-propaganda', 'mil-blog'],
      description:
        'Російський мілблог з пропагандистським ухилом і частковими даними з полів.',
    },
    {
      external_id: 'telegram:rybar',
      name: 'Rybar',
      type: 'telegram_channel',
      url: 'https://t.me/rybar',
      handle: 'rybar',
      language: 'ru',
      is_active: true,
      reliability: 0.4,
      category: 'enemy-prop',
      tags: ['ru-propaganda', 'front-summary'],
      description:
        'Пропагандистський канал з «аналітикою» та добірками відео з фронту.',
    },

    // Споттери, авіа-трекинг, OSINT-люди
    {
      external_id: 'telegram:air_tracker',
      name: 'Air Traffic Watch',
      type: 'telegram_channel',
      url: 'https://t.me/air_tracker',
      handle: 'air_tracker',
      language: 'en',
      is_active: true,
      reliability: 0.7,
      category: 'osint-individual',
      tags: ['adsb', 'aircraft', 'black-sea'],
      description:
        'OSINT-відстеження польотів стратегічної авіації та розвідників над Чорним морем.',
    },
    {
      external_id: 'telegram:spotter_dnipro',
      name: 'Дніпро-споттер',
      type: 'telegram_channel',
      url: 'https://t.me/spotter_dnipro',
      handle: 'spotter_dnipro',
      language: 'uk',
      is_active: true,
      reliability: 0.5,
      category: 'spotter',
      tags: ['local', 'dnipro', 'uav', 'air-defense'],
      description:
        'Аматорський канал зі спостереженнями за ППО, дронами та вибухами в районі Дніпра.',
    },
  ];

  const insertedSources = await Promise.all(
    sources.map(async (s) => {
      const res = await pool.query(
        `
          INSERT INTO osint_sources (
            "externalId",
            name,
            type,
            url,
            handle,
            language,
            "isActive",
            reliability,
            "totalItems",
            "confirmedItems",
            "disprovedItems",
            description,
            category,
            tags,
            meta
          )
          VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,
            0,0,0,
            $9,$10,$11,$12
          )
          ON CONFLICT ("externalId")
            DO UPDATE SET
              name        = EXCLUDED.name,
              type        = EXCLUDED.type,
              url         = COALESCE(osint_sources.url, EXCLUDED.url),
              handle      = COALESCE(osint_sources.handle, EXCLUDED.handle),
              language    = EXCLUDED.language,
              "isActive"  = EXCLUDED."isActive",
              category    = EXCLUDED.category,
              tags        = EXCLUDED.tags
          RETURNING id, "externalId", name
        `,
        [
          s.external_id,
          s.name,
          s.type,
          s.url,
          s.handle,
          s.language,
          s.is_active,
          s.reliability,
          s.description,
          s.category,
          s.tags,
          { demo: true },
        ],
      );
      return res.rows[0];
    }),
  );

  console.log(`   OK: додано/оновлено OSINT джерел: ${insertedSources.length}`);

  const sourceIdByExternal: Record<string, string> = {};
  for (const s of insertedSources) {
    sourceIdByExternal[s.externalId] = s.id;
  }

  // --- 2) OSINT items ---

  console.log('>> Insert OSINT items…');

  const now = new Date();
  const hoursAgo = (h: number) =>
    new Date(now.getTime() - h * 60 * 60 * 1000).toISOString();

  type RawItem = {
    sourceExternal: string;
    externalId: string;
    kind: 'text';
    title: string | null;
    content: string;
    summary: string | null;
    language: string | null;
    priority: 'low' | 'medium' | 'high' | 'critical';
    type:
      | 'equipment_movement'
      | 'force_concentration'
      | 'strategic_aircraft'
      | 'military_transport_flight'
      | 'critical_infra_threat'
      | 'other_enemy_activity'
      | 'strike'
      | 'info'
      | 'infoop_disinfo'
      | 'uav_swarm'
      | 'spotter_activity';
    category: string;
    tags: string[];
    credibility: number;
    parseDate: string;
    eventDate: string | null;
    rawUrl: string | null;
    lat: number | null;
    lon: number | null;
    theater: Theater | null;
  };

  const osintItems: RawItem[] = [];
  let extCounter = 10000;

  // 2.1 Рух ворожої техніки та скупчення сил — тільки фронт / ТОТ / РФ
  for (const loc of locations) {
    if (isEnemyGroundArea(loc)) {
      for (let i = 0; i < 2; i += 1) {
        extCounter += 1;
        const vehicles = 5 + i * 7 + Math.round(Math.random() * 4);
        const h = 4 + i * 5 + Math.round(Math.random() * 2);

        osintItems.push({
          sourceExternal: 'telegram:deepstate_ua',
          externalId: `telegram:deepstate_ua:${extCounter}`,
          kind: 'text',
          title: `Рух колони ворожої техніки (${loc.name})`,
          content:
            `Зафіксовано рух колони ворожої техніки (орієнтовно ${vehicles} одиниць) у ${loc.place}. ` +
            `У складі колони: ББМ, вантажівки з тентами, паливозаправники. Частина машин рухається в темну пору доби ` +
            `з вимкненими фарами та без розпізнавальних знаків.`,
          summary: `Рух колони техніки (до ${vehicles} одиниць) у ${loc.place}.`,
          language: 'uk',
          priority: i === 1 ? 'high' : 'medium',
          type: 'equipment_movement',
          category: 'movement',
          tags: [loc.region, loc.name, 'колона', 'рух техніки'],
          credibility: 0.7 + i * 0.05,
          parseDate: hoursAgo(h),
          eventDate: hoursAgo(h + 0.5),
          rawUrl: `https://t.me/deepstate_ua/${extCounter}`,
          lat: loc.lat + (Math.random() - 0.5) * 0.12,
          lon: loc.lon + (Math.random() - 0.5) * 0.12,
          theater: loc.theater,
        });
      }

      // Скупчення особового складу / польові табори (фронт і ТОТ)
      if (isFrontOrTot(loc)) {
        extCounter += 1;
        const personnel = 80 + Math.round(Math.random() * 60);

        osintItems.push({
          sourceExternal: 'telegram:rybar',
          externalId: `telegram:rybar:${extCounter}`,
          kind: 'text',
          title: `Скупчення живої сили (${loc.name})`,
          content:
            `Російські ресурси повідомляють про розгортання польового табору та скупчення до ${personnel} військових ` +
            `у районі ${loc.place}. Вказується, що на позиції стягуються мінометні розрахунки та командування батальйонної ланки.`,
          summary: `Повідомлення про скупчення до ${personnel} військових у ${loc.place}.`,
          language: 'ru',
          priority: 'medium',
          type: 'force_concentration',
          category: 'enemy_forces',
          tags: [loc.region, 'жива сила', 'табори', 'укріплення'],
          credibility: 0.5,
          parseDate: hoursAgo(10 + Math.random() * 4),
          eventDate: hoursAgo(11 + Math.random() * 4),
          rawUrl: `https://t.me/rybar/${extCounter}`,
          lat: loc.lat + (Math.random() - 0.5) * 0.2,
          lon: loc.lon + (Math.random() - 0.5) * 0.2,
          theater: loc.theater,
        });
      }
    }
  }

  // 2.2 Авіація, стратегічні та транспортні борти, Чорне море, цивільні рейси з вантажем
  const airTracks = [
    {
      callsign: 'FORTE12',
      type: 'strategic_aircraft' as const,
      description: 'RQ-4B Global Hawk (розвідувальний БпАК США)',
    },
    {
      callsign: 'MAGMA11',
      type: 'strategic_aircraft' as const,
      description: 'E-3 Sentry (AWACS, НАТО)',
    },
  ];

  const blackSeaLoc = locations.find((l) => l.key === 'black_sea_airspace')!;

  airTracks.forEach((track, idx) => {
    for (let i = 0; i < 3; i += 1) {
      extCounter += 1;
      const h = 3 + idx * 4 + i * 2;
      const altitude = 15000 + i * 1000 + Math.round(Math.random() * 500);
      const distance = 80 + i * 20 + Math.round(Math.random() * 10);

      osintItems.push({
        sourceExternal: 'telegram:air_tracker',
        externalId: `telegram:air_tracker:${extCounter}`,
        kind: 'text',
        title: `Патрулювання ${track.callsign} над Чорним морем`,
        content:
          `За даними ADS-B, борт ${track.callsign} (${track.description}) виконує патрулювання в ` +
          `північно-західній частині Чорного моря на висоті ~${altitude} м. Дистанція до узбережжя України орієнтовно ${distance} км. ` +
          `Трек свідчить про тривале колове патрулювання в інтересах моніторингу пусків та дій авіації РФ.`,
        summary: `${track.callsign} патрулює над Чорним морем (висота ~${altitude} м, дистанція ~${distance} км до узбережжя).`,
        language: 'en',
        priority: idx === 0 ? 'high' : 'medium',
        type: track.type,
        category: 'air_activity',
        tags: ['Black Sea', 'aircraft', track.callsign],
        credibility: 0.9,
        parseDate: hoursAgo(h),
        eventDate: hoursAgo(h + 0.25),
        rawUrl: `https://t.me/air_tracker/${extCounter}`,
        lat: blackSeaLoc.lat + (Math.random() - 0.5) * 1.0,
        lon: blackSeaLoc.lon + (Math.random() - 0.5) * 1.5,
        theater: 'intl_airspace',
      });
    }
  });

  const farEastAirLocs = locations.filter(
    (l) => l.key === 'khabarovsk_ru' || l.key === 'vladivostok_ru',
  );

  farEastAirLocs.forEach((loc) => {
    // патрулювання винищувальної/бомбардувальної авіації
    for (let i = 0; i < 2; i += 1) {
      extCounter += 1;
      const h = 6 + i * 3 + Math.random() * 2;
      const altitude = 8000 + i * 1500 + Math.round(Math.random() * 500);

      osintItems.push({
        sourceExternal: 'telegram:air_tracker',
        externalId: `telegram:air_tracker:${extCounter}`,
        kind: 'text',
        title: `Активність фронтової авіації (${loc.name})`,
        content:
          `OSINT‑спостерігачі фіксують зліт/посадку та патрулювання літаків тактичної авіації ` +
          `у районі ${loc.place}. Висота польотів ~${altitude} м, виконуються тренувальні/перегонні маршрути.`,
        summary: `Активність літаків тактичної авіації в районі ${loc.place} (висота ~${altitude} м).`,
        language: 'ru',
        priority: 'medium',
        type: 'strategic_aircraft',
        category: 'air_activity',
        tags: [loc.region, 'far-east', 'aircraft'],
        credibility: 0.6,
        parseDate: hoursAgo(h),
        eventDate: hoursAgo(h + 0.3),
        rawUrl: `https://t.me/air_tracker/${extCounter}`,
        lat: loc.lat + (Math.random() - 0.5) * 0.4,
        lon: loc.lon + (Math.random() - 0.5) * 0.6,
        theater: loc.theater,
      });
    }
  });

  // Цивільні рейси з ознаками військового вантажу
  const kyivRail = locations.find((l) => l.key === 'taganrog_ru')!;
  const lvivLoc = locations.find((l) => l.key === 'vladivostok_ru')!;

  [
    {
      airport: 'Таганрог (умовний аеропорт тилового базування)',
      loc: kyivRail,
    },
    {
      airport: 'Владівосток (логістичний хаб)',
      loc: lvivLoc,
    },
  ].forEach((node, idx) => {
    extCounter += 1;
    const h = 6 + idx * 2;
    osintItems.push({
      sourceExternal: 'telegram:air_tracker',
      externalId: `telegram:air_tracker:${extCounter}`,
      kind: 'text',
      title: `Підозрілий цивільний рейс із вантажем (${node.airport})`,
      content:
        `OSINT-спільнота фіксує рейс цивільного вантажного літака, який протягом останніх тижнів регулярно ` +
        `літає за маршрутом Близький Схід – ${node.airport}. На фото з завантаження видно палети, накриті тентами, ` +
        `частину ящиків марковано як «dual-use». Офіційно рейс заявлено як гуманітарний/комерційний.`,
      summary: `Регулярний цивільний рейс з вантажем подвійного призначення до ${node.airport}.`,
      language: 'en',
      priority: 'medium',
      type: 'military_transport_flight',
      category: 'air_activity',
      tags: [node.loc.region, 'civil-cargo', 'dual-use'],
      credibility: 0.65,
      parseDate: hoursAgo(h),
      eventDate: hoursAgo(h + 0.5),
      rawUrl: `https://t.me/air_tracker/${extCounter}`,
      lat: node.loc.lat + (Math.random() - 0.5) * 0.1,
      lon: node.loc.lon + (Math.random() - 0.5) * 0.1,
      theater: node.loc.theater,
    });
  });

  // 2.3 Підозріла активність / диверсії в тилу
  const infraLocations = locations.filter((l) =>
    /порт|енерг|залізничний|промзона/i.test(l.name),
  );

  infraLocations.forEach((loc) => {
    // Підозрілий збір інформації про обʼєкт
    extCounter += 1;
    osintItems.push({
      sourceExternal: 'telegram:local_kyiv_alerts',
      externalId: `telegram:local_kyiv_alerts:${extCounter}`,
      kind: 'text',
      title: `Підозрілі особи біля обʼєкта інфраструктури (${loc.name})`,
      content:
        `Місцеві мешканці повідомляють про двох невідомих осіб, які протягом ~40 хвилин фотографували ` +
        `огорожу, вежі спостереження та камери в районі ${loc.place}. Автомобіль із затемненими вікнами кілька разів ` +
        `обʼїжджав периметр, після чого різко виїхав у напрямку траси.`,
      summary: `Підозріла фотофіксація й автомобіль біля інфраструктурного обʼєкта (${loc.place}).`,
      language: 'uk',
      priority: 'high',
      type: 'critical_infra_threat',
      category: 'ci_threat',
      tags: [loc.region, 'спостерігачі', 'критична інфра', 'диверсія?'],
      credibility: 0.65,
      parseDate: hoursAgo(6 + Math.random() * 3),
      eventDate: hoursAgo(6.5 + Math.random() * 3),
      rawUrl: `https://t.me/kyiv_operativ/${extCounter}`,
      lat: loc.lat + (Math.random() - 0.5) * 0.05,
      lon: loc.lon + (Math.random() - 0.5) * 0.05,
      theater: loc.theater,
    });

    // Малий квадрокоптер уночі
    extCounter += 1;
    osintItems.push({
      sourceExternal: 'telegram:spotter_dnipro',
      externalId: `telegram:spotter_dnipro:${extCounter}`,
      kind: 'text',
      title: `Сигнали від невідомого квадрокоптера поблизу (${loc.name})`,
      content:
        `Кілька мешканців повідомили про характерний звук квадрокоптера над промисловою зоною у районі ${loc.place} ` +
        `близько 02:30. Візуального контакту немає, але частина свідків чула короткі зупинки двигуна над лінією електропередач ` +
        `та рух у напрямку резервуарів/цехів.`,
      summary: `Підозрюваний політ невеликого дрона над промисловою/енергетичною зоною (${loc.place}).`,
      language: 'uk',
      priority: 'medium',
      type: 'uav_swarm',
      category: 'uav',
      tags: [loc.region, 'uav', 'нічна активність'],
      credibility: 0.5,
      parseDate: hoursAgo(8 + Math.random() * 2),
      eventDate: hoursAgo(8.2 + Math.random() * 2),
      rawUrl: `https://t.me/spotter_dnipro/${extCounter}`,
      lat: loc.lat + (Math.random() - 0.5) * 0.07,
      lon: loc.lon + (Math.random() - 0.5) * 0.07,
      theater: loc.theater,
    });
  });

  // Диверсії на тиловій залізниці / складах
  const kyivLoc = locations.find((l) => l.key === 'kyiv_rail')!;
  const dniproLoc = locations.find((l) => l.key === 'dnipro_city')!;

  [
    {
      loc: kyivLoc,
      text:
        'вибух на відстої вантажних вагонів, пошкоджено кілька платформ із закритими контейнерами; ' +
        'офіційно озвучено як «пожежу через несправність гальм», однак очевидці повідомляють про кілька послідовних хлопків.',
    },
    {
      loc: dniproLoc,
      text:
        'локальна пожежа на складі паливно-мастильних матеріалів у промзоні; ' +
        'на відео видно характерні спалахи, схожі на підпал із використанням горючої суміші.',
    },
  ].forEach((item) => {
    extCounter += 1;
    osintItems.push({
      sourceExternal: 'telegram:local_kyiv_alerts',
      externalId: `telegram:local_kyiv_alerts:${extCounter}`,
      kind: 'text',
      title: `Можлива диверсія на тиловому обʼєкті (${item.loc.name})`,
      content:
        `Місцеві ресурси повідомляють про ${item.text} ` +
        `Розглядається версія навмисної диверсії, правоохоронні органи відпрацьовують можливі ДРГ.`,
      summary: `Можлива диверсія на тиловому обʼєкті в районі ${item.loc.place}.`,
      language: 'uk',
      priority: 'high',
      type: 'other_enemy_activity',
      category: 'sabotage',
      tags: [item.loc.region, 'диверсія', 'пожежа', 'залізниця/ПММ'],
      credibility: 0.6,
      parseDate: hoursAgo(9 + Math.random() * 2),
      eventDate: hoursAgo(9.5 + Math.random() * 2),
      rawUrl: `https://t.me/kyiv_operativ/${extCounter}`,
      lat: item.loc.lat + (Math.random() - 0.5) * 0.05,
      lon: item.loc.lon + (Math.random() - 0.5) * 0.05,
      theater: item.loc.theater,
    });
  });

  // 2.4 Пропаганда та дезінформація (без прямого "прорив → удар" в одному місці)
  locations.forEach((loc) => {
    if (!isFrontOrTot(loc)) return;
    extCounter += 1;

    osintItems.push({
      sourceExternal: 'telegram:chdambiev',
      externalId: `telegram:chdambiev:${extCounter}`,
      kind: 'text',
      title: `Пропагандистська заява про "успіхи" РФ (${loc.name})`,
      content:
        `Ворожі інформаційні ресурси заявляють про нібито "значне просування" підрозділів РФ у районі ${loc.place}. ` +
        `Не наводиться ані координат, ані перевіряльних фото/відео. Окремі твердження суперечать попереднім зведенням тих самих джерел.`,
      summary: `Пропагандистська заява про "просування" в районі ${loc.place} без підтверджень.`,
      language: 'ru',
      priority: 'low',
      type: 'info',
      category: 'infoop',
      tags: [loc.region, 'пропаганда', 'ІПсО'],
      credibility: 0.25,
      parseDate: hoursAgo(12 + Math.random() * 5),
      eventDate: null,
      rawUrl: `https://t.me/chdambiev/${extCounter}`,
      lat: loc.lat + (Math.random() - 0.5) * 0.25,
      lon: loc.lon + (Math.random() - 0.5) * 0.25,
      theater: loc.theater,
    });
  });

  // 2.5 Реальні удари / наслідки (окремо, з різними локаціями)
  const strikePairs = [
    {
      srcLoc: 'taganrog_ru',
      tgtLoc: 'melitopol_tot',
      description:
        'ймовірне ураження складу боєприпасів на ТОТ, зафіксовано тривалу детонацію та вторинні вибухи.',
    },
    {
      srcLoc: 'kursk_ru',
      tgtLoc: 'zaporizhzhia_front',
      description:
        'робота ударних БпЛА по польовому складу ПММ, спостерігається сильна пожежа.',
    },
    {
      srcLoc: 'belgorod_ru',
      tgtLoc: 'sumy_border',
      description:
        'артилерійський обстріл логістичного майданчика, пошкоджено вантажну інфраструктуру.',
    },
  ];

  strikePairs.forEach((pair, idx) => {
    const src = locations.find((l) => l.key === pair.srcLoc)!;
    const tgt = locations.find((l) => l.key === pair.tgtLoc)!;
    extCounter += 1;

    osintItems.push({
      sourceExternal: 'telegram:atomiyk',
      externalId: `telegram:atomiyk:${extCounter}`,
      kind: 'text',
      title: `Ураження обʼєкта забезпечення (${tgt.name})`,
      content:
        `Сили оборони завдали прицільного удару по обʼєкту забезпечення противника в районі ${tgt.place}: ${pair.description} ` +
        `За попередніми даними, знищено частину складу та техніку на майданчику завантаження.`,
      summary: `Прицільний удар по складу/обʼєкту забезпечення в районі ${tgt.place}.`,
      language: 'uk',
      priority: idx === 0 ? 'critical' : 'high',
      type: 'strike',
      category: 'combat',
      tags: [tgt.region, 'удар', 'склад', 'логістика'],
      credibility: 0.9,
      parseDate: hoursAgo(5 + idx * 2),
      eventDate: hoursAgo(5.5 + idx * 2),
      rawUrl: `https://t.me/atomiyk/${extCounter}`,
      lat: tgt.lat + (Math.random() - 0.5) * 0.1,
      lon: tgt.lon + (Math.random() - 0.5) * 0.1,
      theater: tgt.theater,
    });
  });

  console.log(`   INFO: сформовано сирих OSINT items: ${osintItems.length}`);

  const insertedItems = await Promise.all(
    osintItems.map(async (i) => {
      const sourceId = sourceIdByExternal[i.sourceExternal];
      if (!sourceId) return null;

      const res = await pool.query(
        `
          INSERT INTO osint_items (
            source_id,
            "externalId",
            kind,
            url,
            reliability,
            title,
            content,
            summary,
            language,
            priority,
            type,
            category,
            tags,
            credibility,
            "parseDate",
            "eventDate",
            "rawUrl",
            "mediaUrl",
            meta
          )
          VALUES (
            $1,$2,$3,
            $4,
            0.5,
            $5,$6,$7,
            $8,$9,$10,$11,
            $12,$13,
            $14,$15,
            $16,
            NULL,
            $17
          )
          ON CONFLICT ("externalId") DO NOTHING
          RETURNING id
        `,
        [
          sourceId,
          i.externalId,
          i.kind,
          i.rawUrl,
          i.title,
          i.content,
          i.summary,
          i.language,
          i.priority,
          i.type,
          i.category,
          i.tags,
          i.credibility,
          i.parseDate,
          i.eventDate,
          i.rawUrl,
          {
            demo: true,
            sourceExternalId: i.sourceExternal,
            theater: i.theater,
            lat: i.lat,
            lon: i.lon,
          },
        ],
      );
      return res.rows[0] ?? null;
    }),
  );

  console.log(
    `   OK: додано OSINT items: ${
      insertedItems.filter((x) => x !== null).length
    }`,
  );

  // --- 3) Events (агрегація OSINT у події) ---

  console.log('>> Insert events…');

  const eventsValues: string[] = [];
  const eventsParams: any[] = [];
  let p = 1;

  type EventArgs = {
    title: string;
    summary: string;
    description: string;
    type:
      | 'equipment_movement'
      | 'force_concentration'
      | 'strategic_aircraft'
      | 'military_transport_flight'
      | 'critical_infra_threat'
      | 'other_enemy_activity'
      | 'strike'
      | 'infoop_disinfo';
    severity: 'critical' | 'high' | 'medium' | 'low';
    status: 'pending' | 'confirmed' | 'disproved' | 'investigating';
    lat: number;
    lon: number;
    hoursAgo: number;
    confidence: number;
    externalRef: string | null;
    theater: Theater;
  };

  const pushEvent = (args: EventArgs) => {
    eventsValues.push(
      `(
        $${p++}, $${p++}, $${p++}, $${p++}, $${p++}, $${p++},
        $${p++}, $${p++},
        NOW() - INTERVAL '${args.hoursAgo} hours',
        $${p++},
        $${p++},
        NULL,
        NULL,
        NULL
      )`,
    );
    eventsParams.push(
      args.title,
      args.summary,
      args.description,
      args.type,
      args.severity,
      args.status,
      args.lat,
      args.lon,
      args.confidence,
      args.externalRef,
    );
  };

  // 3.1 Рух техніки / скупчення сил
  for (const loc of locations) {
    if (isEnemyGroundArea(loc)) {
      // Подія "Рух колони"
      pushEvent({
        title: `Рух колони техніки (${loc.name})`,
        summary: `Колона ворожої техніки рухається у ${loc.place} в напрямку переднього краю/логістичного вузла.`,
        description:
          `За даними кількох OSINT-джерел, у районі ${loc.place} відмічено рух змішаної колони техніки ` +
          `з паливозаправниками та вантажівками з тентами. Характер руху вказує на підвіз боєприпасів/ПММ та ротацію підрозділів.`,
        type: 'equipment_movement',
        severity: ['ua', 'tot'].includes(loc.theater) ? 'high' : 'medium',
        status: 'pending',
        lat: loc.lat,
        lon: loc.lon,
        hoursAgo: 3 + Math.random() * 3,
        confidence: 0.75,
        externalRef: null,
        theater: loc.theater,
      });
    }

    // Подія "Скупчення сил" лише для фронту/TOT
    if (isFrontOrTot(loc)) {
      pushEvent({
        title: `Скупчення сил противника (${loc.name})`,
        summary: `Ознаки формування польового табору та складу боєкомплекту у районі ${loc.place}.`,
        description:
          `Фото- та відеоматеріали з декількох джерел свідчать про розгортання польового табору противника ` +
          `у районі ${loc.place}. Відмічено палаткові містечка, техніку забезпечення, польові укриття для артилерії.`,
        type: 'force_concentration',
        severity: 'high',
        status: 'investigating',
        lat: loc.lat + (Math.random() - 0.5) * 0.15,
        lon: loc.lon + (Math.random() - 0.5) * 0.15,
        hoursAgo: 9 + Math.random() * 3,
        confidence: 0.65,
        externalRef: null,
        theater: loc.theater,
      });
    }
  }

  // 3.2 Авіація
  pushEvent({
    title: 'Патрулювання стратегічних платформ над Чорним морем',
    summary:
      'RQ-4B та інші розвідувальні борти здійснюють тривале патрулювання над північно-західною частиною Чорного моря.',
    description:
      'За ADS-B та повідомленнями OSINT-спільноти, протягом останніх годин фіксується присутність декількох ' +
      'розвідувальних платформ НАТО у повітряному просторі над Чорним морем. Це може вказувати на очікування активності РФ ' +
      'або моніторинг запусків ракет/БпЛА.',
    type: 'strategic_aircraft',
    severity: 'medium',
    status: 'confirmed',
    lat: blackSeaLoc.lat,
    lon: blackSeaLoc.lon,
    hoursAgo: 2.5,
    confidence: 0.9,
    externalRef: null,
    theater: 'intl_airspace',
  });

  // Подія про цивільні борти з вантажем
  [kyivRail, lvivLoc].forEach((loc) => {
    pushEvent({
      title: `Цивільні вантажні рейси з потенційно військовим вантажем (${loc.name})`,
      summary: `Регулярні рейси цивільних вантажних літаків із вантажем подвійного призначення до вузла ${loc.place}.`,
      description:
        `OSINT-спільнота відстежує низку цивільних вантажних рейсів, що прибувають до тилового вузла ${loc.place}. ` +
        `На доступних фото/відео помітні палети із закритими контейнерами, частина з маркуванням, типовим для обладнання подвійного призначення. ` +
        `Офіційно рейси проходять як комерційні/гуманітарні, що потребує додаткового аналізу.`,
      type: 'military_transport_flight',
      severity: 'medium',
      status: 'investigating',
      lat: loc.lat,
      lon: loc.lon,
      hoursAgo: 6 + Math.random() * 2,
      confidence: 0.6,
      externalRef: null,
      theater: loc.theater,
    });
  });

  // 3.3 Загрози критичній інфраструктурі
  infraLocations.forEach((loc) => {
    pushEvent({
      title: `Підозріла активність біля критичної інфраструктури (${loc.name})`,
      summary: `Повідомлення про підозрілу фотофіксацію та можливі розвідники біля обʼєкта у ${loc.place}.`,
      description:
        `Локальні джерела інформують про підозрілих осіб та автотранспорт, ` +
        `які детально оглядали периметр та підʼїзди до обʼєкта в районі ${loc.place}. Проводиться додаткова перевірка ` +
        `через відповідні служби, включно з аналізом камер відеоспостереження.`,
      type: 'critical_infra_threat',
      severity: 'high',
      status: 'investigating',
      lat: loc.lat,
      lon: loc.lon,
      hoursAgo: 6 + Math.random() * 3,
      confidence: 0.7,
      externalRef: null,
      theater: loc.theater,
    });
  });

  // 3.4 Удари по обʼєктах забезпечення
  strikePairs.forEach((pair, idx) => {
    const tgt = locations.find((l) => l.key === pair.tgtLoc)!;
    pushEvent({
      title: `Ураження складу/логістичного вузла (${tgt.name})`,
      summary: `Зафіксовано наслідки удару по обʼєкту забезпечення противника в районі ${tgt.place}.`,
      description:
        `OSINT-джерела публікують відео й фото наслідків ураження обʼєкта забезпечення в районі ${tgt.place}: ` +
        `${pair.description} Аналіз полумʼя та характеру детонації вказує на влучання в значні запаси боєприпасів та ПММ.`,
      type: 'strike',
      severity: idx === 0 ? 'critical' : 'high',
      status: 'confirmed',
      lat: tgt.lat + (Math.random() - 0.5) * 0.1,
      lon: tgt.lon + (Math.random() - 0.5) * 0.1,
      hoursAgo: 4 + idx * 1.5,
      confidence: 0.9,
      externalRef: null,
      theater: tgt.theater,
    });
  });

  // 3.5 Спростована дезінформація
  locations.forEach((loc) => {
    if (!isFrontOrTot(loc)) return;
    pushEvent({
      title: `Спростування пропагандистської заяви (${loc.name})`,
      summary: `Заяви противника про "значні успіхи" у районі ${loc.place} не підтверджені.`,
      description:
        `Після звірки з офіційними зведеннями та даними з місця, ` +
        `низку заяв противника про нібито "прориви" або "оточення" у районі ${loc.place} визнано дезінформацією. ` +
        `Лінія фронту залишається відносно стабільною, підтверджень суттєвих змін положення немає.`,
      type: 'infoop_disinfo',
      severity: 'low',
      status: 'disproved',
      lat: loc.lat,
      lon: loc.lon,
      hoursAgo: 7 + Math.random() * 4,
      confidence: 0.4,
      externalRef: null,
      theater: loc.theater,
    });
  });

  const eventsSql = `
    INSERT INTO events (
      title,
      summary,
      description,
      type,
      severity,
      status,
      latitude,
      longitude,
      occurred_at,
      confidence,
      external_ref,
      image_url,
      created_by,
      updated_by
    )
    VALUES
      ${eventsValues.join(',\n')}
    RETURNING id, title
  `;
  const eventsRes = await pool.query(eventsSql, eventsParams);
  console.log(`   OK: додано events: ${eventsRes.rowCount}`);

  // --- 4) Targets (цілі: склади, логістика, ППО, мости, енергетика) ---

  console.log('>> Insert targets…');

  const targetsValues: string[] = [];
  const targetsParams: any[] = [];
  p = 1;

  type TargetArgs = {
    title: string;
    description: string;
    type:
      | 'ammo_depot'
      | 'logistics_hub'
      | 'cp'
      | 'bridge'
      | 'rail_junction'
      | 'air_defense'
      | 'fuel_depot'
      | 'power_substation';
    status: 'active' | 'observed' | 'planned' | 'neutralized';
    priority: 'P0' | 'P1' | 'P2' | 'P3';
    lat: number;
    lon: number;
    firstHoursAgo: number;
    lastHoursAgo: number;
  };

  const pushTarget = (args: TargetArgs) => {
    targetsValues.push(
      `(
        $${p++}, $${p++}, $${p++}, $${p++}, $${p++},
        $${p++}, $${p++},
        NOW() - INTERVAL '${args.firstHoursAgo} hours',
        NOW() - INTERVAL '${args.lastHoursAgo} hours',
        NOW() - INTERVAL '${args.firstHoursAgo} hours',
        NOW() - INTERVAL '${args.lastHoursAgo} hours',
        FALSE
      )`,
    );
    targetsParams.push(
      args.title,
      args.description,
      args.type,
      args.status,
      args.priority,
      args.lat,
      args.lon,
    );
  };

  for (const loc of locations) {
    const enemyArea = isEnemyGroundArea(loc);

    // Склади БК / обʼєкти з боєкомплектом
    pushTarget({
      title: enemyArea
        ? `Склад БК противника (${loc.name})`
        : `Склад боєприпасів/майна (${loc.name})`,
      description: enemyArea
        ? `Ймовірний стаціонарний склад боєприпасів/артилерійського майна противника у районі ${loc.place}. `
        : `Обʼєкт зберігання боєприпасів/майна в районі ${loc.place}, потребує постійного моніторингу та захисту.`,
      type: 'ammo_depot',
      status: enemyArea ? 'active' : 'observed',
      priority: enemyArea ? 'P0' : 'P1',
      lat: loc.lat + (Math.random() - 0.5) * 0.1,
      lon: loc.lon + (Math.random() - 0.5) * 0.1,
      firstHoursAgo: 96 + Math.random() * 48,
      lastHoursAgo: 4 + Math.random() * 6,
    });

    // Логістичні хаби
    pushTarget({
      title: `Логістичний вузол (${loc.name})`,
      description: `Вузол забезпечення боєприпасами, ПММ та особовим складом, який підтримує угруповання сил у регіоні ${loc.region}.`,
      type: 'logistics_hub',
      status: enemyArea ? 'active' : 'observed',
      priority: enemyArea ? 'P1' : 'P2',
      lat: loc.lat + (Math.random() - 0.5) * 0.2,
      lon: loc.lon + (Math.random() - 0.5) * 0.2,
      firstHoursAgo: 168 + Math.random() * 72,
      lastHoursAgo: 8 + Math.random() * 12,
    });

    // Пункти управління
    pushTarget({
      title: enemyArea
        ? `Польовий пункт управління противника (${loc.name})`
        : `Польовий/тиловий пункт управління (${loc.name})`,
      description: `Імовірний пункт управління тактичного рівня, повʼязаний із силами на напрямку ${loc.name}.`,
      type: 'cp',
      status: 'active',
      priority: 'P1',
      lat: loc.lat + (Math.random() - 0.5) * 0.15,
      lon: loc.lon + (Math.random() - 0.5) * 0.15,
      firstHoursAgo: 120 + Math.random() * 48,
      lastHoursAgo: 6 + Math.random() * 10,
    });

    // Специфічні критичні обʼєкти
    if (/порт/i.test(loc.name)) {
      pushTarget({
        title: enemyArea
          ? `Паливний/портовий термінал противника (${loc.name})`
          : `Нафтовий/портовий термінал (${loc.name})`,
        description: `Комплекс резервуарів та перевалки ПММ у портовій зоні, важливий елемент логістичного ланцюга.`,
        type: 'fuel_depot',
        status: 'observed',
        priority: 'P2',
        lat: loc.lat + (Math.random() - 0.5) * 0.08,
        lon: loc.lon + (Math.random() - 0.5) * 0.08,
        firstHoursAgo: 240 + Math.random() * 120,
        lastHoursAgo: 10 + Math.random() * 10,
      });
    }

    if (/енерг|промзона/i.test(loc.name)) {
      pushTarget({
        title: `Підстанція / енергетичний вузол (${loc.name})`,
        description: `Крупний вузол електропостачання/промислова підстанція, потенційна ціль для ракетних/дронових ударів та диверсій.`,
        type: 'power_substation',
        status: enemyArea ? 'active' : 'planned',
        priority: 'P2',
        lat: loc.lat + (Math.random() - 0.5) * 0.07,
        lon: loc.lon + (Math.random() - 0.5) * 0.07,
        firstHoursAgo: 72 + Math.random() * 72,
        lastHoursAgo: 16 + Math.random() * 8,
      });
    }

    if (/залізничний/i.test(loc.name)) {
      pushTarget({
        title: `Залізничний вузол (${loc.name})`,
        description: `Вузлова залізнична станція та сортувальна гілка, через яку проходять ешелони постачання та евакуації.`,
        type: 'rail_junction',
        status: 'active',
        priority: 'P2',
        lat: loc.lat + (Math.random() - 0.5) * 0.06,
        lon: loc.lon + (Math.random() - 0.5) * 0.06,
        firstHoursAgo: 192 + Math.random() * 96,
        lastHoursAgo: 12 + Math.random() * 6,
      });
    }

    if (/аеродром|авіаційний/i.test(loc.name)) {
      pushTarget({
        title: `Позиція ППО/РЛС біля аеродрому (${loc.name})`,
        description: `Ймовірне розташування засобів ППО та радіолокації, що прикривають авіаційний обʼєкт.`,
        type: 'air_defense',
        status: 'active',
        priority: 'P0',
        lat: loc.lat + (Math.random() - 0.5) * 0.12,
        lon: loc.lon + (Math.random() - 0.5) * 0.12,
        firstHoursAgo: 168 + Math.random() * 72,
        lastHoursAgo: 5 + Math.random() * 5,
      });
    }
  }

  const targetsSql = `
    INSERT INTO targets (
      title,
      description,
      type,
      status,
      priority,
      latitude,
      longitude,
      "firstSeenAt",
      "lastSeenAt",
      "createdAt",
      "updatedAt",
      archived
    )
    VALUES
      ${targetsValues.join(',\n')}
    RETURNING id, title
  `;
  const targetsRes = await pool.query(targetsSql, targetsParams);
  console.log(`   OK: додано targets: ${targetsRes.rowCount}`);

  // --- 5) Tasks (задачі, привʼязані до подій/цілей) ---

  console.log('>> Insert tasks…');

  const tasksValues: string[] = [];
  const tasksParams: any[] = [];
  p = 1;

  type TaskArgs = {
    title: string;
    description: string;
    status: 'new' | 'in_progress' | 'done' | 'blocked';
    priority: 'low' | 'medium' | 'high' | 'critical';
    role: 'analyst' | 'intel' | 'ops' | 'comm';
    assigneeCallsign: string;
    assigneeRank: string;
    assigneeUnit: string;
    targetTitleLike: string | null;
    eventTitleLike: string | null;
    dueHoursAhead: number;
  };

  const pushTask = (args: TaskArgs) => {
    tasksValues.push(
      `(
        $${p++}, $${p++}, $${p++}, $${p++}, $${p++},
        NULL,
        $${p++}, $${p++}, $${p++},
        ${
          args.targetTitleLike
            ? `(SELECT id FROM targets WHERE title ILIKE $${p++} LIMIT 1)`
            : 'NULL'
        },
        ${
          args.eventTitleLike
            ? `(SELECT id FROM events WHERE title ILIKE $${p++} LIMIT 1)`
            : 'NULL'
        },
        NOW() - INTERVAL '1 hours',
        NOW() - INTERVAL '30 minutes',
        NOW() + INTERVAL '${args.dueHoursAhead} hours',
        NULL,
        NULL,
        FALSE,
        NULL
      )`,
    );

    tasksParams.push(
      args.title,
      args.description,
      args.status,
      args.priority,
      args.role,
      args.assigneeCallsign,
      args.assigneeRank,
      args.assigneeUnit,
    );

    if (args.targetTitleLike) {
      tasksParams.push(args.targetTitleLike);
    }
    if (args.eventTitleLike) {
      tasksParams.push(args.eventTitleLike);
    }
  };

  for (const loc of locations) {
    // Оцінка наслідків ураження складів / логістики
    pushTask({
      title: `Оцінити вплив по складах/логістиці (${loc.name})`,
      description:
        `Провести аналіз, як ураження складів/логістичних вузлів поблизу ${loc.place} ` +
        `вплинуло на інтенсивність обстрілів і темп забезпечення угруповань противника/наших сил на напрямку.`,
      status: 'in_progress',
      priority: 'high',
      role: 'analyst',
      assigneeCallsign: 'ANALYST-01',
      assigneeRank: 'капітан',
      assigneeUnit: 'відділ аналітики OSINT',
      targetTitleLike: `%Склад БК%(${loc.name})%`,
      eventTitleLike: `%Ураження складу/логістичного вузла (${loc.name})%`,
      dueHoursAhead: 12,
    });

    // Довідка про рух техніки (там, де ворог може рухатися)
    if (isEnemyGroundArea(loc)) {
      pushTask({
        title: `Підготувати довідку про рух ворожої техніки (${loc.name})`,
        description:
          `На основі останніх повідомлень сформувати довідку щодо структури, кількості та напрямків руху колон у ${loc.place}, ` +
          `із прогнозом можливого нарощування сил противника.`,
        status: 'new',
        priority: 'medium',
        role: 'analyst',
        assigneeCallsign: 'ANALYST-02',
        assigneeRank: 'лейтенант',
        assigneeUnit: 'аналітичний відділ',
        targetTitleLike: `%Логістичний вузол (${loc.name})%`,
        eventTitleLike: `%Рух колони техніки (${loc.name})%`,
        dueHoursAhead: 18,
      });
    }

    // Верифікація загроз критичній інфраструктурі (тільки для інфраструктурних локацій)
    if (infraLocations.some((x) => x.key === loc.key)) {
      pushTask({
        title: `Перевірити загрози для критичної інфраструктури (${loc.name})`,
        description:
          `Звірити повідомлення про підозрілу активність біля обʼєктів критичної інфраструктури ` +
          `в районі ${loc.place} з даними правоохоронних органів та служб безпеки.`,
        status: 'new',
        priority: 'high',
        role: 'intel',
        assigneeCallsign: 'INTEL-03',
        assigneeRank: 'старший лейтенант',
        assigneeUnit: 'розвідувальний відділ',
        targetTitleLike: `%Підстанція / енергетичний вузол (${loc.name})%`,
        eventTitleLike: `%Підозріла активність біля критичної інфраструктури (${loc.name})%`,
        dueHoursAhead: 24,
      });
    }

    // Комунікаційні задачі (спростування дезінформації)
    if (isFrontOrTot(loc)) {
      pushTask({
        title: `Підготувати меседж для спростування ІПсО (${loc.name})`,
        description:
          `Підготувати коротку довідку/меседж для публічного простору щодо не підтвердження заяв противника ` +
          `про "значні успіхи" у районі ${loc.place}. Узгодити формулювання з прес-службою.`,
        status: 'new',
        priority: 'medium',
        role: 'comm',
        assigneeCallsign: 'COMM-01',
        assigneeRank: 'майор',
        assigneeUnit: 'прес-служба',
        targetTitleLike: null,
        eventTitleLike: `%Спростування пропагандистської заяви (${loc.name})%`,
        dueHoursAhead: 10,
      });
    }

    // Аналіз цивільних рейсів із вантажем (лише для великих тилових хабів)
    if (['kyiv_rail', 'lviv'].includes(loc.key)) {
      pushTask({
        title: `Проаналізувати маршрути цивільних вантажних рейсів (${loc.name})`,
        description:
          `Зібрати інформацію щодо регулярних цивільних вантажних рейсів, які прибувають до вузла ${loc.place}. ` +
          `Порівняти маніфести вантажу з відкритими даними про постачання обладнання подвійного призначення.`,
        status: 'new',
        priority: 'medium',
        role: 'analyst',
        assigneeCallsign: 'ANALYST-03',
        assigneeRank: 'старший лейтенант',
        assigneeUnit: 'аналітичний відділ (міжнародні поставки)',
        targetTitleLike: `%Логістичний вузол (${loc.name})%`,
        eventTitleLike: `%Цивільні вантажні рейси з потенційно військовим вантажем (${loc.name})%`,
        dueHoursAhead: 36,
      });
    }
  }

  const tasksSql = `
    INSERT INTO tasks (
      title,
      description,
      status,
      priority,
      role,
      "assigneeId",
      "assigneeCallsign",
      "assigneeRank",
      "assigneeUnit",
      "targetId",
      "eventId",
      "createdAt",
      "updatedAt",
      "dueAt",
      "createdBy",
      "updatedBy",
      archived,
      "parentTaskId"
    )
    VALUES
      ${tasksValues.join(',\n')}
  `;
  const tasksRes = await pool.query(tasksSql, tasksParams);
  console.log(`   OK: додано tasks: ${tasksRes.rowCount}`);

  console.log('=== DEMO SEED COMPLETED SUCCESSFULLY ===');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('SEED FAILED', err);
    process.exit(1);
  });
