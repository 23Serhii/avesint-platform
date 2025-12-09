import { z } from 'zod'

export const userRoleSchema = z.union([
    z.literal('admin'),
    z.literal('officer'),
    z.literal('analyst'),
    z.literal('user'),
])

export type UserRole = z.infer<typeof userRoleSchema>

export const userSchema = z.object({
    id: z.string(), // UUID з бекенду
    callsign: z.string(),
    displayName: z.string().nullable().optional(),
    role: userRoleSchema,
    isTwoFactorEnabled: z.boolean().optional().default(false),
    isBlocked: z.boolean().optional().default(false),
    createdAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().optional(),
})

export type User = z.infer<typeof userSchema>

export const userListSchema = z.array(userSchema)

// Відповідь бекенда: пагінований список користувачів
export const usersListResponseSchema = z.object({
    items: userListSchema,
    page: z.number(),
    pageSize: z.number(),
    total: z.number(),
})

export type UsersListResponse = z.infer<typeof usersListResponseSchema>