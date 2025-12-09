import { createFileRoute, redirect } from '@tanstack/react-router'
import { AuditLogPage } from '@/features/audit-log'
import { useAuthStore } from '@/stores/auth-store'
import { userHasPermission } from '@/lib/rbac'

export const Route = createFileRoute('/_authenticated/audit-log/')({
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()
    const user = auth.user
    if (!user || !userHasPermission(user.role, user.roles, 'audit.view')) {
      throw redirect({ to: '/403' })
    }
  },
  component: AuditLogPage,
})