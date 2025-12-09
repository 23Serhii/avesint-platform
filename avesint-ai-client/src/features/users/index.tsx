// src/features/users/index.tsx
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { toast } from 'sonner'

import { api } from '@/lib/api/client'
import { ConfigDrawer } from '@/components/config-drawer'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

import { UsersDialogs } from './components/users-dialogs'
import { UsersPrimaryButtons } from './components/users-primary-buttons'
import { UsersProvider } from './components/users-provider'
import { UsersTable } from './components/users-table'
import {
    usersListResponseSchema,
    type User,
    type UserRole,
} from './data/schema'


const route = getRouteApi('/_authenticated/users/')

export function Users() {
    const search = route.useSearch()
    const [items, setItems] = useState<User[]>([])

    const rolesParam: UserRole[] | undefined =
        search.role && search.role.length > 0 ? (search.role as UserRole[]) : undefined

    const { data, isLoading } = useQuery({
        queryKey: ['users', search],
        queryFn: async () => {
            try {
                // можна використовувати listUsers або напряму api.get + схема
                const res = await api.get('/users', {
                    params: {
                        page: search.page ?? 1,
                        pageSize: search.pageSize ?? 10,
                        username: search.username || undefined,
                        roles: rolesParam && rolesParam.length > 0 ? rolesParam : undefined,
                    },
                })

                return usersListResponseSchema.parse(res.data)
            } catch (e) {
                // eslint-disable-next-line no-console
                console.error(e)
                toast.error('Не вдалося завантажити користувачів')
                return {
                    items: [] as User[],
                    page: search.page ?? 1,
                    pageSize: search.pageSize ?? 10,
                    total: 0,
                }
            }
        },
    })

    // синхронізуємо дані з локальним стейтом, щоб діалоги могли їх змінювати через setItems
    useEffect(() => {
        if (data?.items) {
            setItems(data.items)
        }
    }, [data])

    return (
        <UsersProvider items={items} setItems={setItems}>
            <Header fixed>
                <Search />
                <div className="ms-auto flex items-center space-x-4">
                    <ThemeSwitch />
                    <ConfigDrawer />
                    <ProfileDropdown />
                </div>
            </Header>

            <Main fixed className="gap-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">
                            Користувачі
                        </h1>
                        <p className="text-muted-foreground">
                            Керуйте обліковими записами, ролями та доступами в Avesint.
                        </p>
                    </div>
                    <UsersPrimaryButtons />
                </div>

                <UsersTable items={items} isLoading={isLoading} />
            </Main>

            <UsersDialogs />
        </UsersProvider>
    )
}