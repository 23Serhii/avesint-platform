export type AppRole = 'admin' | 'officer' | 'analyst' | 'user'

export type Permission =
// Користувачі / ролі
  | 'users.view'
  | 'users.manage'
  | 'roles.manage'
  // Події
  | 'events.view'
  | 'events.review'
  | 'events.manage'
  // Задачі
  | 'tasks.view.all'
  | 'tasks.view.own'
  | 'tasks.manage'
  // Цілі / обʼєкти
  | 'targets.view'
  | 'targets.manage'
  // Аналітика / аудит
  | 'analytics.view'
  | 'audit.view'
  // Налаштування
  | 'settings.view'
  | 'settings.manage'

export const ROLE_PERMISSIONS: Record<AppRole, Permission[]> = {
  admin: [
    // Користувачі / ролі
    'users.view',
    'users.manage',
    'roles.manage',
    // Події
    'events.view',
    'events.review',
    'events.manage',
    // Задачі
    'tasks.view.all',
    'tasks.manage',
    // Цілі
    'targets.view',
    'targets.manage',
    // Аналітика / аудит
    'analytics.view',
    'audit.view',
    // Налаштування
    'settings.view',
    'settings.manage',
  ],
  officer: [
    // Користувачі – тільки перегляд (стан підлеглих)
    'users.view',
    // Події
    'events.view',
    'events.review',
    // Задачі
    'tasks.view.all',
    'tasks.manage',
    // Цілі
    'targets.view',
    'targets.manage',
    // Аналітика
    'analytics.view',
    // Налаштування – тільки перегляд
    'settings.view',
  ],
  analyst: [
    // Події
    'events.view',
    'events.review',
    // Задачі – лише свої
    'tasks.view.own',
    // Цілі
    'targets.view',
    // Аналітика
    'analytics.view',
  ],
  user: [
    // Мінімальний доступ
    'events.view',
    'tasks.view.own',
    'targets.view',
  ],
}

// Нормалізація ролей з user.role / user.roles
export function getUserRoles(rawRole?: string, rawRoles?: string[] | string): AppRole[] {
  const all: string[] = []

  if (rawRoles) {
    if (Array.isArray(rawRoles)) {
      all.push(...rawRoles)
    } else {
      all.push(
        ...rawRoles
          .split(',')
          .map((r) => r.trim())
      )
    }
  }
  if (rawRole) {
    all.push(rawRole)
  }

  const normalized = all
    .map((r) => r.toLowerCase().replace(/^role_/, ''))
    .filter(Boolean)

  const uniq = Array.from(new Set(normalized)) as AppRole[]

  return uniq.filter((r) => ['admin', 'officer', 'analyst', 'user'].includes(r))
}

// Обчислення effective permissions
export function getUserPermissions(rawRole?: string, rawRoles?: string[] | string): Permission[] {
  const roles = getUserRoles(rawRole, rawRoles)
  const perms = new Set<Permission>()

  roles.forEach((role) => {
    ROLE_PERMISSIONS[role]?.forEach((p) => perms.add(p))
  })

  return Array.from(perms)
}

// Проста перевірка
export function userHasPermission(
  rawRole: string | undefined,
  rawRoles: string[] | string | undefined,
  permission: Permission
): boolean {
  const perms = getUserPermissions(rawRole, rawRoles)
  return perms.includes(permission)
}

// Універсальна перевірка з OR по кількох правах
export function userCanAny(
  rawRole: string | undefined,
  rawRoles: string[] | string | undefined,
  permissions: Permission[]
): boolean {
  const perms = getUserPermissions(rawRole, rawRoles)
  return permissions.some((p) => perms.includes(p))
}