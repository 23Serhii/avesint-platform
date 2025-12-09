// src/features/events/events-map.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'
import type { LatLngExpression, LatLngBoundsExpression } from 'leaflet'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'

import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

import { listEvents } from '@/lib/api/events'
import type { Event } from '@/features/events/data/schema'

const UA_RU_BOUNDS: LatLngBoundsExpression = [
    [40.0, 19.0],
    [70.0, 50.0],
]

const DEFAULT_CENTER: LatLngExpression = [48.5, 32.0]

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

function severityColor(sev: Event['severity']): string {
    switch (sev) {
        case 'critical':
            return '#ef4444'
        case 'high':
            return '#f97316'
        case 'medium':
            return '#eab308'
        case 'low':
        default:
            return '#22c55e'
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

                // Беремо підтверджені / важливі події; можна розширити за потреби
                const res = await listEvents({
                    page: 1,
                    pageSize: 500,
                })

                // залишаємо тільки події з координатами
                const withGeo = res.items.filter(
                    (e) => e.latitude != null && e.longitude != null,
                )

                setItems(withGeo)
            } catch {
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
                        +new Date(b.occurredAt ?? b.createdAt) -
                        +new Date(a.occurredAt ?? a.createdAt),
                )
                .slice(0, 30),
        [items],
    )

    const center: LatLngExpression = useMemo(() => {
        if (!items.length) return DEFAULT_CENTER

        const lat =
            items.reduce((acc, e) => acc + (e.latitude ?? 0), 0) / items.length
        const lon =
            items.reduce((acc, e) => acc + (e.longitude ?? 0), 0) / items.length

        return [lat, lon] as LatLngExpression
    }, [items])

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
                            Оперативна карта реальних подій з БД: пересування, скупчення сил,
                            загрози інфраструктурі тощо.
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
                        <Card className="overflow-hidden">
                            <div className="relative h-[480px] w-full sm:h-[560px] lg:h-[68vh] 2xl:h-[720px]">
                                <MapContainer
                                    center={center}
                                    zoom={6}
                                    minZoom={4}
                                    maxZoom={12}
                                    scrollWheelZoom
                                    zoomControl={false}
                                    attributionControl={false}
                                    maxBounds={UA_RU_BOUNDS}
                                    className="absolute inset-0 h-full w-full"
                                >
                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                                    {items.map((e) => {
                                        if (e.latitude == null || e.longitude == null) return null

                                        const color = severityColor(e.severity)
                                        const radius =
                                            e.severity === 'critical'
                                                ? 11
                                                : e.severity === 'high'
                                                    ? 9
                                                    : 7

                                        return (
                                            <CircleMarker
                                                key={e.id}
                                                center={[e.latitude, e.longitude] as LatLngExpression}
                                                radius={radius}
                                                pathOptions={{
                                                    color,
                                                    fillColor: color,
                                                    fillOpacity: 0.9,
                                                    weight: 2,
                                                }}
                                            >
                                                <Popup>
                                                    <div className="space-y-1 text-xs">
                                                        <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">
                                {e.title ?? 'Без назви'}
                              </span>
                                                            <Badge
                                                                variant={severityVariant(e.severity) as never}
                                                                className="text-[10px]"
                                                            >
                                                                {severityLabel(e.severity)}
                                                            </Badge>
                                                        </div>
                                                        {e.summary && (
                                                            <p className="text-[11px] text-muted-foreground">
                                                                {e.summary}
                                                            </p>
                                                        )}
                                                        <p className="font-mono text-[10px] text-muted-foreground/80">
                                                            {e.latitude.toFixed(4)},{' '}
                                                            {e.longitude.toFixed(4)}
                                                        </p>
                                                        <p className="text-[10px] text-muted-foreground/70">
                                                            {new Date(
                                                                e.occurredAt ?? e.createdAt,
                                                            ).toLocaleString('uk-UA', {
                                                                dateStyle: 'short',
                                                                timeStyle: 'short',
                                                            })}
                                                        </p>
                                                    </div>
                                                </Popup>
                                            </CircleMarker>
                                        )
                                    })}
                                </MapContainer>

                                <div className="pointer-events-none absolute bottom-3 left-3 z-10">
                                    <Badge
                                        variant="outline"
                                        className="bg-background/85 text-[11px]"
                                    >
                                        Подій на мапі: {items.length}
                                    </Badge>
                                </div>
                            </div>
                        </Card>

                        {/* Права частина — фід подій з тих самих items */}
                        <Card className="h-[540px] overflow-hidden">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-sm font-medium">
                                    Останні події
                                </CardTitle>
                                <p className="text-xs text-muted-foreground">
                                    Останні зафіксовані події з координатами, напряму з реєстру
                                    подій.
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
                                                        variant={
                                                            severityVariant(event.severity) as never
                                                        }
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
                                                    {new Date(
                                                        event.occurredAt ?? event.createdAt,
                                                    ).toLocaleString('uk-UA', {
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