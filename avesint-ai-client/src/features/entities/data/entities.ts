export type EntityType = 'infrastructure' | 'hq' | 'logistics' | 'airfield' | 'other'

export type EntityStatus = 'active' | 'under_observation' | 'neutralized'

export type Entity = {
  id: string
  name: string
  type: EntityType
  sector: string
  priority: 1 | 2 | 3 | 4 | 5
  status: EntityStatus
  latitude?: number
  longitude?: number
  lastActivityAt?: string
}

export const entities: Entity[] = [
  {
    id: 'ENT-0001',
    name: 'Склад БК (умовний)',
    type: 'logistics',
    sector: 'Схід',
    priority: 1,
    status: 'under_observation',
    latitude: 48.15,
    longitude: 37.74,
    lastActivityAt: new Date().toISOString(),
  },
  {
    id: 'ENT-0002',
    name: 'Міст через річку (оперативна дільниця)',
    type: 'infrastructure',
    sector: 'Південь',
    priority: 2,
    status: 'active',
    latitude: 47.0,
    longitude: 33.5,
    lastActivityAt: new Date().toISOString(),
  },
  {
    id: 'ENT-0003',
    name: 'Польовий командний пункт',
    type: 'hq',
    sector: 'Північ',
    priority: 1,
    status: 'neutralized',
    lastActivityAt: new Date().toISOString(),
  },
]
