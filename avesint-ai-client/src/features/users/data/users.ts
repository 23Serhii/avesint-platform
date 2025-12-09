import { faker } from '@faker-js/faker'

// фіксуємо seed
faker.seed(67890)

const ranks = [
  'солдат',
  'сержант',
  'старший сержант',
  'молодший лейтенант',
  'лейтенант',
  'старший лейтенант',
  'капітан',
]

const units = [
  'Опервідділ штабу',
  'Аналітичний відділ',
  'Ситуаційний центр',
  'Відділ РЕР',
  'Відділ БпЛА',
]

const rolesPool = ['commander', 'section_lead', 'analyst', 'duty_officer'] as const

export const users = Array.from({ length: 120 }, () => {
  const firstName = faker.person.firstName()
  const lastName = faker.person.lastName()
  const callsign = faker.hacker.noun().slice(0, 10).toUpperCase() // умовний позивний

  return {
    id: faker.string.uuid(),
    firstName,
    lastName,
    username: faker.internet
      .username({ firstName, lastName })
      .toLocaleLowerCase(),
    email: faker.internet.email({ firstName }).toLocaleLowerCase(),
    phoneNumber: faker.phone.number({ style: 'international' }),
    callsign,
    rank: faker.helpers.arrayElement(ranks),
    unit: faker.helpers.arrayElement(units),
    status: faker.helpers.arrayElement([
      'active',
      'inactive',
      'invited',
      'suspended',
    ] as const),
    role: faker.helpers.arrayElement(rolesPool),
    createdAt: faker.date.past(),
    updatedAt: faker.date.recent(),
  }
})
