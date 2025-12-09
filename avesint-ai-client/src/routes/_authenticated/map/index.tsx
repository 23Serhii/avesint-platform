// src/routes/_authenticated/map/index.tsx
'use client'

import { useEffect, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'

import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'

import { EventsProvider } from '@/features/events/components/events-provider'
import { EventsMapViewport } from '@/features/events/components/events-map-viewport'
import { EventsMapSidebar } from '@/features/events/components/events-map-sidebar'
import { listEvents } from '@/lib/api/events'
import type { Event } from '@/features/events/data/schema'

function MapPage() {
    const [items, setItems] = useState<Event[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                setError(null)

                // беремо побільше, щоб було що показувати на мапі
                const res = await listEvents({ page: 1, pageSize: 500 })
                setItems(res.items)
            } catch {
                setError('Не вдалося завантажити події для мапи')
            } finally {
                setLoading(false)
            }
        }

        void load()
    }, [])

    return (
        <EventsProvider>
            <Header fixed>
                <Search />
                <div className="ms-auto flex items-center space-x-4">
                    <ThemeSwitch />
                    <ConfigDrawer />
                    <ProfileDropdown />
                </div>
            </Header>

            <Main className="flex flex-1 flex-col gap-4 sm:gap-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Карта подій</h1>
                    <p className="text-sm text-muted-foreground">
                        Візуалізація ворожої активності: скупчення сил, рух колон, стратегічна
                        авіація, загрози нашій критичній інфраструктурі. Дані беруться напряму
                        з реєстру подій.
                    </p>
                </div>

                {loading && items.length === 0 && (
                    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                        Завантаження…
                    </div>
                )}

                {error && !loading && (
                    <div className="flex h-40 items-center justify-center text-sm text-red-500">
                        {error}
                    </div>
                )}

                {!loading && !error && (
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)] xl:grid-cols-[minmax(0,3fr)_minmax(360px,1fr)]">
                        <EventsMapViewport items={items} />
                        <EventsMapSidebar items={items} />
                    </div>
                )}
            </Main>
        </EventsProvider>
    )
}

export const Route = createFileRoute('/_authenticated/map/')({
    component: MapPage,
})