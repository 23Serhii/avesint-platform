// src/components/layout/app-sidebar.tsx
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
import { useAuthStore } from '@/stores/auth-store'
import type { NavItem, NavGroup as NavGroupType, Role } from './types'

function passesAccessControl(
    item: NavItem,
    role: Role | null,
    isAuthenticated: boolean,
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
    isAuthenticated: boolean,
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
    isAuthenticated: boolean,
): NavGroupType[] {
    return groups
        .map((group) => {
            const items = group.items
                .map((item) => filterNavItemByRole(item, role, isAuthenticated))
                .filter((item): item is NavItem => item !== null)

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

    return (
        <Sidebar collapsible={collapsible} variant={variant}>
            <SidebarHeader>{/* Можна додати TeamSwitcher за потреби */}</SidebarHeader>

            <SidebarContent>
                {filteredGroups.map((group) => (
                    <NavGroup key={group.title} {...group} />
                ))}
            </SidebarContent>

            <SidebarFooter>
                <NavUser user={sidebarData.user} />
            </SidebarFooter>

            <SidebarRail />
        </Sidebar>
    )
}