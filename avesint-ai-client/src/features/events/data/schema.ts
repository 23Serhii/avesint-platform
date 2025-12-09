import {z} from 'zod'

// Де відбувається подія
export const theaterSchema = z.enum(['ua', 'tot', 'ru', 'intl_airspace'])
export type Theater = z.infer<typeof theaterSchema>

// Типи подій – заточені під ворожу активність
export const eventTypes = [
    {
        value: 'force_concentration',
        label: 'Скупчення сил / техніки',
    },
    {
        value: 'equipment_movement',
        label: 'Рух техніки / колон',
    },
    {
        value: 'strategic_aircraft',
        label: 'Стратегічна авіація РФ',
    },
    {
        value: 'military_transport_flight',
        label: 'Військово-транспортні / псевдоцивільні рейси',
    },
    {
        value: 'critical_infra_threat',
        label: 'Загроза нашим обʼєктам КІ',
    },
    {
        value: 'other_enemy_activity',
        label: 'Інша ворожа активність',
    },
] as const

export const eventSeverities = [
    {value: 'low', label: 'Низький'},
    {value: 'medium', label: 'Середній'},
    {value: 'high', label: 'Високий'},
    {value: 'critical', label: 'Критичний'},
] as const

export const eventStatuses = [
    {value: 'new', label: 'Нова'},
    {value: 'triage', label: 'На верифікації'},
    {value: 'confirmed', label: 'Підтверджено'},
    {value: 'dismissed', label: 'Відкинуто'},
    {value: 'archived', label: 'Архів'},
] as const

export const eventTypeSchema = z.enum([
    'force_concentration',
    'equipment_movement',
    'strategic_aircraft',
    'military_transport_flight',
    'critical_infra_threat',
    'other_enemy_activity',
])

export const eventSeveritySchema = z.enum([
    'low',
    'medium',
    'high',
    'critical',
])

export const eventStatusSchema = z.enum([
    'new',
    'triage',
    'confirmed',
    'dismissed',
    'archived',
])

export const eventSchema = z.object({
    id: z.string(),
    title: z.string(),
    summary: z.string().optional(),
    description: z.string().optional(),
    type: eventTypeSchema,
    severity: eventSeveritySchema,
    status: eventStatusSchema,

    theater: theaterSchema, // ua / tot / ru / intl_airspace

    confidence: z.number().min(0).max(1).optional(),

    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),

    incidentId: z.string().nullable().optional(),
    sourceIds: z.array(z.string()).default([]),

    occurredAt: z.string(),
    createdAt: z.string(),
    updatedAt: z.string().optional(),

    tags: z.array(z.string()).optional(),

    imageUrl: z.string().url().optional(),

    // зовнішній референс / посилання (наприклад telegram:channel:msgId або URL)
    externalRef: z.string().nullable().optional(),
})

export type Event = z.infer<typeof eventSchema>
export type EventType = z.infer<typeof eventTypeSchema>
export type EventStatus = z.infer<typeof eventStatusSchema>
export type EventSeverity = z.infer<typeof eventSeveritySchema>