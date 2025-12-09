import { createFileRoute, redirect } from '@tanstack/react-router'
import { AnalyticsPage } from '@/features/analytics'
import { useAuthStore } from '@/stores/auth-store'
import { userHasPermission } from '@/lib/rbac'

export const Route = createFileRoute('/_authenticated/analytics/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    const user = auth.user
    if (!user || !userHasPermission(user.role, user.roles, 'analytics.view')) {
      throw redirect({ to: '/403' })
    }
  },
  component: AnalyticsPage,
})