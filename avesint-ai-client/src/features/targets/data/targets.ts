import { faker } from '@faker-js/faker'
import type { TargetObject } from './schema'

faker.seed(20250221)

const kinds = ['object', 'target'] as const
const types = ['infrastructure', 'vehicle', 'personnel', 'position', 'other'] as const
const statuses = [
  'candidate',
  'observed',
  'confirmed',
  'tasked',
  'engaged',
  'neutralized',
] as const
const priorities = ['high', 'medium', 'low'] as const

const typeTitleMap: Record<string, string[]> = {
  infrastructure: [
    'Склад БК',
    'Командний пункт',
    'Радіолокаційна станція',
    'Антенне поле звʼязку',
  ],
  vehicle: ['Колона ББМ', 'Танковий взвод', 'РСЗВ батарея', 'Автоколона постачання'],
  personnel: ['Рота піхоти', 'Група штурму', 'Підрозділ ППО', 'Розрахунок мінометів'],
  position: ['Опорний пункт', 'Спостережний пункт', 'Вогнева позиція', 'Бліндаж'],
  other: ['Невідомий обʼєкт', 'Техніка в укритті', 'Тимчасовий табір'],
}

const locationHints = [
  'пн. околиця Бахмута',
  'район Кліщіївка',
  'пн.-зх. від Соледара',
  'район Часів Яр',
  'поблизу траси М-03',
  'район промзони',
]

const sources = ['БПЛА-розвідка', 'HUMINT', 'SIGINT', 'OSINT', 'Комбіноване']

export const targets: TargetObject[] = Array.from({ length: 80 }).map((_, i) => {
  const type = faker.helpers.arrayElement(types)
  const title =
    faker.helpers.arrayElement(typeTitleMap[type] ?? ['Обʼєкт']) +
    ' ' +
    faker.string.alpha({ casing: 'upper', length: 1 }) +
    '-' +
    faker.number.int({ min: 1, max: 9 })

  const now = new Date()
  const first = faker.date.recent({ days: 7, refDate: now })
  const last = faker.date.between({ from: first, to: now })

  return {
    id: String(i + 1),
    title,
    kind: faker.helpers.arrayElement(kinds),
    type,
    priority: faker.helpers.arrayElement(priorities),
    status: faker.helpers.arrayElement(statuses),
    gridRef: `38T ${faker.string.alphanumeric({ length: 5 }).toUpperCase()}`,
    locationText: faker.helpers.arrayElement(locationHints),
    lat: faker.location.latitude({ min: 48, max: 49 }),
    lon: faker.location.longitude({ min: 37, max: 39 }),
    firstSeenAt: first,
    lastSeenAt: last,
    source: faker.helpers.arrayElement(sources),
    notes: faker.lorem.sentence(),
  }
})
