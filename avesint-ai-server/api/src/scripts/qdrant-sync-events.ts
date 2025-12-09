// api/src/scripts/qdrant-sync-events.ts
//
// Синхронізація всіх подій з таблиці events у Qdrant.
// Використовує той самий QdrantService.upsertEvent, що й OsintService/EventsService.
//
// Запуск (з каталогу api/):
//   npm run sync:qdrant:events

import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module'
import { pool } from '../db'
import { QdrantService } from '../common/qdrant.service'

async function fetchAllEvents() {
  const res = await pool.query(`
    SELECT
      id,
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
      tags
    FROM events
    ORDER BY occurred_at DESC
  `)

  return res.rows as Array<{
    id: string
    title: string
    summary: string | null
    description: string | null
    type: string
    severity: string
    status: string
    latitude: number | null
    longitude: number | null
    occurred_at: Date
    confidence: number | null
    external_ref: string | null
    tags: string[] | null
  }>
}

async function main() {
  console.log('=== QDRANT SYNC: EVENTS → QDRANT ===')

  const dbHost = process.env.DB_HOST ?? 'localhost'
  if (!['localhost', '127.0.0.1'].includes(dbHost)) {
    console.error(
      `DB_HOST=${dbHost} виглядає НЕ локальним, сінк зупинено для безпеки.`,
    )
    process.exit(1)
  }

  console.log('>> Завантажуємо події з таблиці events...')
  const events = await fetchAllEvents()
  console.log(`   OK: знайдено подій: ${events.length}`)

  if (events.length === 0) {
    console.log('   Подій немає, нічого синхронізувати. Вихід.')
    return
  }

  console.log('>> Піднімаємо Nest-контекст...')
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn', 'log'],
  })
  const qdrant = app.get(QdrantService)

  let ok = 0
  let failed = 0

  for (const ev of events) {
    try {
      await qdrant.upsertEvent({
        id: ev.id,
        title: ev.title ?? null,
        summary: ev.summary ?? null,
        description: ev.description ?? null,
        time: ev.occurred_at.toISOString(),
        severity: ev.severity ?? null,
        status: ev.status ?? null,
        latitude: ev.latitude ?? null,
        longitude: ev.longitude ?? null,
        tags: ev.tags ?? null,
        aiClassification: null,
        sourceName: null,
        isRoutine: false,
      })
      ok += 1
      if (ok % 50 === 0) {
        console.log(`   synced ${ok}/${events.length} events...`)
      }
    } catch (e) {
      failed += 1
      // eslint-disable-next-line no-console
      console.error(
        '   Failed to upsert event in Qdrant:',
        ev.id,
        '-',
        (e as Error).message,
      )
    }
  }

  console.log(`>> Синхронізація завершена. OK: ${ok}, failed: ${failed}`)

  await app.close()
}

main()
  .then(() => {
    console.log('=== QDRANT SYNC: EVENTS → QDRANT DONE ===')
    process.exit(0)
  })
  .catch((err) => {
    console.error('FATAL: sync events to Qdrant failed:', err)
    process.exit(1)
  })