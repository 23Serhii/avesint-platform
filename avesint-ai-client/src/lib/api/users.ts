// src/lib/api/users.ts
import { api } from '@/lib/api/client'
import {
    usersListResponseSchema,
    type UsersListResponse,
    type UserRole,
} from '@/features/users/data/schema'

export type ListUsersParams = {
    page?: number
    pageSize?: number
    username?: string
    roles?: UserRole[]
}

// Отримати список користувачів з бекенда
export async function listUsers(params: ListUsersParams): Promise<UsersListResponse> {
    const res = await api.get('/users', {
        params: {
            page: params.page ?? 1,
            pageSize: params.pageSize ?? 10,
            username: params.username || undefined,
            roles: params.roles && params.roles.length > 0 ? params.roles : undefined,
        },
    })

    return usersListResponseSchema.parse(res.data)
}

// Оновити роль користувача (якщо на бекенді є відповідний ендпоінт)
export async function updateUserRole(userId: string, role: UserRole): Promise<void> {
    await api.patch(`/users/${userId}/role`, { role })
}