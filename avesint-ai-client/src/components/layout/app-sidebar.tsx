// src/components/layout/app-sidebar.tsx
import { useAuthStore } from '@/stores/auth-store'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { sidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'
import type { NavItem, NavGroup as NavGroupType, Role } from './types'

// Данні користувача з NavUser (email не використовуємо — показуємо callsign)
type NavUserData = {
  name: string
  callsign: string
  avatar: string
}

// Узагальнений тип користувача зі стору (мінімально необхідні поля)
type StoreUser = {
  role?: Role
  fullName?: string
  firstName?: string
  lastName?: string
  name?: string
  username?: string
  email?: string
  callsign?: string
}

function passesAccessControl(
  item: NavItem,
  role: Role | null,
  isAuthenticated: boolean
): boolean {
  // guestOnly / authOnly
  if (item.authOnly && !isAuthenticated) return false
  if (item.guestOnly && isAuthenticated) return false

  // roles
  if (item.roles && role && !item.roles.includes(role)) return false
  if (item.roles && !role) return false

  return true
}

function filterNavItemByRole(
  item: NavItem,
  role: Role | null,
  isAuthenticated: boolean
): NavItem | null {
  // Перевіряємо лише доступ до самого пункту меню (не чіпаємо children)
  if (!passesAccessControl(item, role, isAuthenticated)) {
    return null
  }

  return item
}

function filterGroupsByRole(
  groups: NavGroupType[],
  role: Role | null,
  isAuthenticated: boolean
): NavGroupType[] {
  return groups
    .map((group) => {
      const items = group.items
        .map((item) => filterNavItemByRole(item, role, isAuthenticated))
        .filter((i): i is NavItem => i !== null)

      return {
        ...group,
        items,
      }
    })
    .filter((group) => group.items.length > 0)
}

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { auth } = useAuthStore()

  const role: Role | null = (auth.user?.role as Role | undefined) ?? null
  const isAuthenticated = !!auth.user

  const filteredGroups = filterGroupsByRole(
    sidebarData.navGroups,
    role,
    isAuthenticated,
  )

  const currentUser: NavUserData = buildNavUserData(auth.user)

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>{/* Можна додати TeamSwitcher за потреби */}</SidebarHeader>

      <SidebarContent>
        {filteredGroups.map((group) => (
          <NavGroup key={group.title} {...group} />
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={currentUser} />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function buildNavUserData(user: StoreUser | undefined | null): NavUserData {
  if (!user) {
    return {
      name: 'Гість',
      callsign: '',
      avatar: '/assets/avatar.png', // статичний
    }
  }
  return {
    name: resolveDisplayName(user),
    callsign: resolveCallsign(user),
    avatar: '/assets/avatar.png', // статичний
  }
}

function resolveDisplayName(user: StoreUser): string {
  if (user.fullName && user.fullName.trim()) return user.fullName
  const fl = [user.firstName, user.lastName].filter(Boolean).join(' ').trim()
  if (fl) return fl
  if (user.name && user.name.trim()) return user.name
  return user.username || user.email || 'Користувач'
}

function resolveCallsign(user: StoreUser): string {
  if (user.callsign && user.callsign.trim()) return user.callsign
  if (user.username && user.username.trim()) return user.username
  if (user.email && user.email.includes('@')) return user.email.split('@')[0]!
  return ''
}