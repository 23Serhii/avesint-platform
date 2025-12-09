'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type {
    LatLngBoundsExpression,
    LatLngExpression,
    Map as LeafletMap,
    CircleMarker as LeafletCircleMarker,
} from 'leaflet'
import { Crosshair } from 'lucide-react'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'

import { Badge } from '@/components/ui/badge'
import type { Event, Theater } from '../data/schema'
import { useEvents } from './events-provider'

// UA + RU + Далекий Схід
const UKR_RUS_BOUNDS: LatLngBoundsExpression = [
    [40, 19],   // південно‑західний кут
    [70, 150],  // північно‑східний кут (аж до Далекого Сходу)
]

type DomainFilter = 'all' | 'ground' | 'air' | 'critical' | 'other'

type EventsMapViewportProps = {
    items: Event[]
}

// Евристика театру за координатами (заточена під наш демо‑набір):
function inferTheaterByCoords(lat: number, lon: number): Theater {
    // Міжнародний повітряний простір над Чорним морем (повітряні треки)
    if (lat < 45 && lon > 26 && lon < 40) {
        return 'intl_airspace'
    }

    // Далекий Схід РФ: авіабази/польоти далеко на сході
    if (lon >= 120) {
        return 'ru'
    }

    // Європейська частина РФ — умовно східніше України, але так,
    // щоб Сумська область (≈ 34E) лишилась UA, а Бєлгород/Курськ/Таганрог стали RU
    if (lat >= 50 && lon >= 36) {
        return 'ru'
    }

    // ТОТ: південь/схід України (Мелітополь, Бердянськ, Маріуполь)
    if (lat <= 48.7 && lon >= 34 && lon <= 40) {
        return 'tot'
    }

    // За замовчуванням — UA (підконтрольна територія або тил)
    return 'ua'
}

export function EventsMapViewport({ items }: EventsMapViewportProps) {
    const { selectedEventId } = useEvents()
    const [theaterFilter, setTheaterFilter] = useState<'all' | Theater>('all')
    const [domainFilter, setDomainFilter] = useState<DomainFilter>('all')

    const mapRef = useRef<LeafletMap | null>(null)

    const filteredEvents = useMemo(() => {
        return items.filter((e) => {
            if (e.latitude == null || e.longitude == null) return false

            // Явний theater від бекенду має пріоритет; якщо його нема — інферимо
            const eventTheater: Theater =
                e.theater ?? inferTheaterByCoords(e.latitude, e.longitude)

            if (theaterFilter !== 'all' && eventTheater !== theaterFilter) {
                return false
            }

            if (domainFilter === 'ground') {
                if (e.type !== 'force_concentration' && e.type !== 'equipment_movement') {
                    return false
                }
            } else if (domainFilter === 'air') {
                // Тільки авіаційні типи; умовний "чорноморський флот" не потрапить сюди,
                // якщо він буде мати інший type (наприклад, 'naval_activity').
                if (
                    e.type !== 'strategic_aircraft' &&
                    e.type !== 'military_transport_flight'
                ) {
                    return false
                }
            } else if (domainFilter === 'critical') {
                if (e.type !== 'critical_infra_threat') return false
            } else if (domainFilter === 'other') {
                if (e.type !== 'other_enemy_activity') return false
            }

            return true
        })
    }, [items, theaterFilter, domainFilter])

    const center: LatLngExpression = useMemo(() => {
        if (!filteredEvents.length) return [48.5, 32.0] // умовний центр UA

        const avgLat =
            filteredEvents.reduce((acc, e) => acc + (e.latitude ?? 0), 0) /
            filteredEvents.length
        const avgLon =
            filteredEvents.reduce((acc, e) => acc + (e.longitude ?? 0), 0) /
            filteredEvents.length

        return [avgLat, avgLon] as LatLngExpression
    }, [filteredEvents])

    const focusEvent = useMemo(
        () =>
            filteredEvents.find(
                (e) =>
                    e.id === selectedEventId &&
                    e.latitude != null &&
                    e.longitude != null,
            ),
        [filteredEvents, selectedEventId],
    )

    useEffect(() => {
        if (!mapRef.current || !focusEvent) return

        mapRef.current.setView(
            [focusEvent.latitude!, focusEvent.longitude!] as LatLngExpression,
            Math.max(mapRef.current.getZoom(), 7),
            { animate: true },
        )
    }, [focusEvent])

    return (
        <div className="bg-background relative h-[480px] w-full overflow-hidden rounded-xl border sm:h-[560px] lg:h-[68vh] 2xl:h-[720px]">
            <MapContainer
                center={center}
                zoom={6}
                minZoom={3}
                maxZoom={12}
                scrollWheelZoom
                zoomControl={false}
                attributionControl={false}
                maxBounds={UKR_RUS_BOUNDS}
                className="absolute inset-0 z-0 h-full w-full"
                ref={mapRef}
            >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                {filteredEvents.map((event) => {
                    const severityColor =
                        event.severity === 'critical'
                            ? '#ef4444'
                            : event.severity === 'high'
                                ? '#f97316'
                                : event.severity === 'medium'
                                    ? '#eab308'
                                    : '#22c55e'

                    const baseRadius =
                        event.severity === 'critical'
                            ? 11
                            : event.severity === 'high'
                                ? 9
                                : 7

                    const isSelected = event.id === selectedEventId

                    return (
                        <CircleMarker
                            key={event.id}
                            center={[event.latitude!, event.longitude!] as LatLngExpression}
                            radius={isSelected ? baseRadius + 2 : baseRadius}
                            pathOptions={{
                                color: isSelected ? '#0ea5e9' : severityColor,
                                fillColor: severityColor,
                                fillOpacity: isSelected ? 1 : 0.9,
                                weight: isSelected ? 3 : 2,
                            }}
                            ref={(marker: LeafletCircleMarker | null) => {
                                if (marker && isSelected) marker.openPopup()
                            }}
                        >
                            <Popup>
                                <div className="space-y-2 text-xs">
                                    <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {event.title ?? 'Без назви'}
                    </span>
                                        <Badge variant="outline" className="text-[10px]">
                                            {event.severity.toUpperCase()}
                                        </Badge>
                                    </div>

                                    {event.summary && (
                                        <p className="text-muted-foreground text-[11px]">
                                            {event.summary}
                                        </p>
                                    )}

                                    <p className="text-muted-foreground/80 font-mono text-[10px]">
                                        {event.latitude?.toFixed(4)}, {event.longitude?.toFixed(4)}
                                    </p>
                                    <p className="text-muted-foreground/70 text-[10px]">
                                        {new Date(event.occurredAt).toLocaleString('uk-UA', {
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

            {/* Тактичний оверлей */}
            <div className="pointer-events-none absolute inset-0 z-10">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.16),transparent_60%),radial-gradient(circle_at_bottom,_rgba(34,197,94,0.18),transparent_55%)]" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.22)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.22)_1px,transparent_1px)] bg-[size:40px_40px] opacity-75 mix-blend-screen" />
            </div>

            {/* Верхня панель + фільтри */}
            <div className="bg-background/85 absolute inset-x-0 top-0 z-20 border-b px-4 py-2 text-xs backdrop-blur-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className="bg-background/90 inline-flex h-6 w-6 items-center justify-center rounded-full border">
                            <Crosshair className="h-3 w-3" />
                        </div>
                        <div className="flex flex-col">
                            <span className="font-medium">Оперативна карта подій</span>
                            <span className="text-muted-foreground text-[11px]">
                Ворожа активність: скупчення сил, рух колон, авіація, загрози КІ
              </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {/* ТВД */}
                        <div className="bg-background/80 inline-flex items-center gap-1 rounded-full border px-2 py-1">
                            {[
                                { id: 'all', label: 'Усі' },
                                { id: 'ua', label: 'UA' },
                                { id: 'tot', label: 'ТОТ' },
                                { id: 'ru', label: 'RU' },
                                { id: 'intl_airspace', label: 'Повітря' },
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setTheaterFilter(opt.id as 'all' | Theater)}
                                    className={[
                                        'rounded-full px-2 py-0.5 text-[11px]',
                                        theaterFilter === opt.id
                                            ? 'bg-emerald-500 text-emerald-50'
                                            : 'text-muted-foreground hover:bg-muted',
                                    ].join(' ')}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {/* Домени */}
                        <div className="bg-background/80 inline-flex items-center gap-1 rounded-full border px-2 py-1">
                            {[
                                { id: 'all', label: 'Усе' },
                                { id: 'ground', label: 'Сухопутні' },
                                { id: 'air', label: 'Авіація' },
                                { id: 'critical', label: 'Крит. інфра' },
                                { id: 'other', label: 'Інше' },
                            ].map((opt) => (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setDomainFilter(opt.id as DomainFilter)}
                                    className={[
                                        'rounded-full px-2 py-0.5 text-[11px]',
                                        domainFilter === opt.id
                                            ? 'bg-sky-500 text-sky-50'
                                            : 'text-muted-foreground hover:bg-muted',
                                    ].join(' ')}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* Нижній бейдж */}
            <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-1 text-[10px]">
                <Badge variant="outline" className="bg-background/80 text-[11px]">
                    Відображено подій: {filteredEvents.length}
                </Badge>
            </div>
        </div>
    )
}