// avesint-ai-client/src/features/targets/data/schema.ts
import { z } from 'zod'

export const targetStatusSchema = z.enum([
    'candidate',    // виявлено, ще не підтверджено
    'observed',     // спостерігається
    'confirmed',    // підтверджена
    'tasked',       // є задачі по цілі
    'neutralized',  // нейтралізована
])

export const targetPrioritySchema = z.enum(['high', 'medium', 'low'])

export const targetTypeSchema = z.enum([
    'infrastructure',
    'vehicle',
    'personnel',
    'position',
    'other',
])

export const targetSchema = z.object({
    id: z.string(),
    title: z.string(),
    kind: z.literal('target').or(z.literal('object')),
    type: targetTypeSchema,
    priority: targetPrioritySchema,
    status: targetStatusSchema,
    // текстове місце, якщо є
    locationText: z.string().optional(),
    // решта метаданих
    firstSeenAt: z.date(),
    lastSeenAt: z.date(),
    source: z.string().optional(),
    notes: z.string().optional(),
    archived: z.boolean().default(false),
})

export type TargetStatus = z.infer<typeof targetStatusSchema>
export type TargetPriority = z.infer<typeof targetPrioritySchema>
export type TargetType = z.infer<typeof targetTypeSchema>
export type TargetObject = z.infer<typeof targetSchema>