// src/routes/_authenticated/tasks/index.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { Tasks } from '@/features/tasks'
import { userCanAny } from '@/lib/rbac'

export const Route = createFileRoute('/_authenticated/tasks/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    const user = auth.user

    if (!user) throw redirect({ to: '/sign-in' })

    const canView = userCanAny(user.role, user.roles, [
      'tasks.view.all',
      'tasks.view.own',
    ])

    if (!canView) {
      throw redirect({ to: '/403' })
    }
  },
  component: Tasks,
})