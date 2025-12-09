// src/events/events.schema.ts
import { z } from 'zod';

export const eventSeverityEnum = z.enum(['critical', 'high', 'medium', 'low']);
export const eventStatusEnum = z.enum(['pending', 'confirmed', 'disproved']);

export const eventTypeEnum = z.string().min(1); // Поки що вільний текст, можна зробити enum

// Подія так, як ми її повертаємо на фронт
export const eventDtoSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  summary: z.string().nullable(),
  description: z.string().nullable(),
  type: z.string(),
  severity: eventSeverityEnum,
  status: eventStatusEnum,
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  occurredAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  confidence: z.number().nullable(),
  externalRef: z.string().nullable(),
  imageUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
});

export type EventDto = z.infer<typeof eventDtoSchema>;

// Параметри фільтрації/пагінації з query
export const listEventsQuerySchema = z.object({
  page: z
    .string()
    .transform((v) => (Number.isNaN(Number(v)) ? 1 : Number(v)))
    .optional()
    .default(1),
  pageSize: z
    .string()
    .transform((v) => (Number.isNaN(Number(v)) ? 10 : Number(v)))
    .optional()
    .default(10),

  status: z.union([eventStatusEnum, z.array(eventStatusEnum)]).optional(),

  severity: z.union([eventSeverityEnum, z.array(eventSeverityEnum)]).optional(),

  type: z.union([z.string(), z.array(z.string())]).optional(),

  search: z.string().optional(),

  // нові фільтри по часу
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),

  // нові фільтри для bounding box (мапа)
  latMin: z
    .string()
    .transform((v) => Number(v))
    .optional(),
  latMax: z
    .string()
    .transform((v) => Number(v))
    .optional(),
  lngMin: z
    .string()
    .transform((v) => Number(v))
    .optional(),
  lngMax: z
    .string()
    .transform((v) => Number(v))
    .optional(),
});

// Створення події
export const createEventSchema = z.object({
  title: z.string().min(3),
  summary: z.string().optional(),
  description: z.string().optional(),
  type: z.string().min(1),
  severity: eventSeverityEnum,
  status: eventStatusEnum.optional().default('pending'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  occurredAt: z.string().datetime(),
  confidence: z.number().min(0).max(1).optional(),
  externalRef: z.string().optional(),
  imageUrl: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
});

// Часткове оновлення події
export const updateEventSchema = createEventSchema.partial();

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;
export type ListEventsQuery = z.infer<typeof listEventsQuerySchema>;
