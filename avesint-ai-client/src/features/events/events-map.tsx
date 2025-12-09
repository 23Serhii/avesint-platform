// src/features/events/events-map.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

import type { Event } from './data/schema'
import { EventsMapViewport } from './components/events-map-viewport'
import { listEvents } from '@/lib/api/events'

function severityLabel(sev: Event['severity']) {
    switch (sev) {
        case 'critical':
            return 'Критичне'
        case 'high':
            return 'Високе'
        case 'medium':
            return 'Середнє'
        case 'low':
            return 'Низьке'
        default:
            return sev
    }
}

function severityVariant(
    sev: Event['severity'],
): 'default' | 'secondary' | 'outline' | 'destructive' {
    switch (sev) {
        case 'critical':
            return 'destructive'
        case 'high':
            return 'default'
        case 'medium':
            return 'secondary'
        case 'low':
        default:
            return 'outline'
    }
}

export function EventsMap() {
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
            } catch (e) {
                setError('Не вдалося завантажити події для мапи')
            } finally {
                setLoading(false)
            }
        }

        void load()
    }, [])

    const latestEvents = useMemo(
        () =>
            [...items]
                .sort(
                    (a, b) =>
                        +new Date(b.occurredAt) - +new Date(a.occurredAt),
                )
                .slice(0, 30),
        [items],
    )

    return (
        <>
            <Header fixed>
                <Search />
                <div className="ms-auto flex items-center space-x-4">
                    <ThemeSwitch />
                    <ConfigDrawer />
                    <ProfileDropdown />
                </div>
            </Header>

            <Main className="flex flex-1 flex-col gap-4 lg:gap-6">
                <div className="flex flex-wrap items-end justify-between gap-2">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Карта подій</h2>
                        <p className="text-muted-foreground">
                            Оперативна карта розвідподій, вогневих уражень, пересувань та інших
                            ключових активностей.
                        </p>
                    </div>
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
                    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)] lg:gap-6">
                        {/* Ліва частина — карта */}
                        <EventsMapViewport items={items} />

                        {/* Права частина — фід подій */}
                        <Card className="h-[540px] overflow-hidden">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium">
                                    Останні події
                                </CardTitle>
                                <p className="text-xs text-muted-foreground">
                                    Останні зафіксовані події з коротким описом, пріоритетом та часом.
                                </p>
                            </CardHeader>
                            <CardContent className="h-full border-t px-0 py-0">
                                <ScrollArea className="h-[460px]">
                                    <div className="space-y-1 px-3 py-2">
                                        {latestEvents.map((event) => (
                                            <div
                                                key={event.id}
                                                className="flex flex-col gap-1 rounded-md border bg-background/60 px-3 py-2 text-xs"
                                            >
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="text-sm font-medium">
                                                        {event.title}
                                                    </div>
                                                    <Badge
                                                        variant={severityVariant(event.severity) as never}
                                                        className="text-[10px] font-normal"
                                                    >
                                                        {severityLabel(event.severity)}
                                                    </Badge>
                                                </div>

                                                {event.summary && (
                                                    <p className="text-[11px] text-muted-foreground/90">
                                                        {event.summary}
                                                    </p>
                                                )}

                                                <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                                    {event.latitude != null &&
                                                        event.longitude != null && (
                                                            <span className="font-mono text-[10px]">
                                {event.latitude.toFixed(4)},{' '}
                                                                {event.longitude.toFixed(4)}
                              </span>
                                                        )}
                                                </div>

                                                <div className="text-[10px] text-muted-foreground/70">
                                                    {new Date(event.occurredAt).toLocaleString('uk-UA', {
                                                        dateStyle: 'short',
                                                        timeStyle: 'short',
                                                    })}
                                                </div>
                                            </div>
                                        ))}

                                        {latestEvents.length === 0 && (
                                            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                                                Подій поки немає. Після надходження розвідданих тут
                                                відображатимуться останні активності.
                                            </p>
                                        )}
                                    </div>
                                </ScrollArea>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </Main>
        </>
    )
}