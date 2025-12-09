import { useAuthStore } from '@/stores/auth-store'
import {
  type Permission,
  getUserPermissions,
  userHasPermission,
  userCanAny,
} from '@/lib/rbac'

export function usePermissions() {
  const { auth } = useAuthStore()
  const user = auth.user

  const permissions = getUserPermissions(user?.role, user?.roles)

  return {
    permissions,
    has: (perm: Permission) =>
      userHasPermission(user?.role, user?.roles, perm),
    canAny: (perms: Permission[]) =>
      userCanAny(user?.role, user?.roles, perms),
  }
}