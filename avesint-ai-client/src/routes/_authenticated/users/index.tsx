// src/routes/_authenticated/users/index.tsx
import z from 'zod'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Users } from '@/features/users'
import { roles } from '@/features/users/data/data'
import { useAuthStore } from '@/stores/auth-store'
import { userHasPermission } from '@/lib/rbac'

const usersSearchSchema = z.object({
  page: z.number().optional().catch(1),
  pageSize: z.number().optional().catch(10),
  status: z
    .array(
      z.union([
        z.literal('active'),
        z.literal('inactive'),
        z.literal('invited'),
        z.literal('suspended'),
      ]),
    )
    .optional()
    .catch([]),
  role: z
    .array(z.enum(roles.map((r) => r.value as (typeof roles)[number]['value'])))
    .optional()
    .catch([]),
  username: z.string().optional().catch(''),
})

export const Route = createFileRoute('/_authenticated/users/')({
  validateSearch: usersSearchSchema,

  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    const user = auth.user

    if (!user || !userHasPermission(user.role, user.roles, 'users.view')) {
      throw redirect({ to: '/403' })
    }
  },

  component: Users,
})