'use client'

import { useMemo } from 'react'
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  ZoomControl,
} from 'react-leaflet'
import type { LatLngExpression, LatLngBoundsExpression } from 'leaflet'

import { Badge } from '@/components/ui/badge'
import type { Event } from '@/features/events/data/schema'

// UA + RU bounds
const UA_RU_BOUNDS: LatLngBoundsExpression = [
  [40.0, 20.0],
  [70.0, 60.0],
]

const DEFAULT_CENTER: LatLngExpression = [49.0, 32.0]

function severityColor(sev: Event['severity'] | null | undefined): string {
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

type DashboardMiniMapProps = {
  events: Event[]
}

export function DashboardMiniMap({ events }: DashboardMiniMapProps) {
  const visibleEvents = useMemo(
    () =>
      events.filter(
        (e) => typeof e.latitude === 'number' && typeof e.longitude === 'number',
      ),
    [events],
  )

  const center: LatLngExpression = useMemo(() => {
    if (!visibleEvents.length) return DEFAULT_CENTER
    const lat =
      visibleEvents.reduce((a, e) => a + (e.latitude ?? 0), 0) /
      visibleEvents.length
    const lon =
      visibleEvents.reduce((a, e) => a + (e.longitude ?? 0), 0) /
      visibleEvents.length
    return [lat, lon]
  }, [visibleEvents])

  return (
    <div className="border rounded-lg overflow-hidden bg-background">
      <div className="relative z-0" style={{ height: '320px' }}>
        <MapContainer
          center={center}
          zoom={5}
          minZoom={4}
          maxZoom={9}
          maxBounds={UA_RU_BOUNDS}
          maxBoundsViscosity={1}
          zoomControl={false}
          scrollWheelZoom={true}
          doubleClickZoom={true}
          touchZoom={true}
          dragging={true}
          attributionControl={false}
          className="h-full w-full z-0"
        >
          <ZoomControl position="bottomright" />

          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

          {visibleEvents.map((event) => {
            const color = severityColor(event.severity)
            const radius =
              event.severity === 'critical'
                ? 9
                : event.severity === 'high'
                  ? 7
                  : 6

            return (
              <CircleMarker
                key={event.id}
                center={[event.latitude!, event.longitude!] as LatLngExpression}
                radius={radius}
                pathOptions={{
                  color,
                  fillColor: color,
                  fillOpacity: 0.9,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="space-y-1 text-[11px]">
                    <div className="text-xs font-medium">
                      {event.title ?? 'Без назви'}
                    </div>
                    <div className="text-muted-foreground">
                      {event.summary ?? event.description ?? 'Без опису'}
                    </div>
                    <div className="font-mono text-muted-foreground/70">
                      {event.latitude?.toFixed(4)}, {event.longitude?.toFixed(4)}
                    </div>
                    <div className="text-muted-foreground/70">
                      {new Date(event.occurredAt ?? event.createdAt).toLocaleString(
                        'uk-UA',
                        { dateStyle: 'short', timeStyle: 'short' },
                      )}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>

        <div className="pointer-events-none absolute bottom-3 left-3 z-10">
          <Badge variant="outline" className="bg-background/85 text-[11px]">
            Подій на мапі: {visibleEvents.length}
          </Badge>
        </div>
      </div>
    </div>
  )
}