'use client'

import { useMemo } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { uk } from 'date-fns/locale'
import { Badge } from '@/components/ui/badge'
import type { Event } from '../data/schema'
import { eventTypes } from '../data/schema'
import { useEvents } from './events-provider'

type EventsMapSidebarProps = {
  items: Event[]
}

const theaterLabel: Record<Event['theater'], string> = {
  ua: 'UA',
  tot: 'ТОТ',
  ru: 'RU',
  intl_airspace: 'Повітря',
}

export function EventsMapSidebar({ items }: EventsMapSidebarProps) {
  const { selectedEventId, setSelectedEventId } = useEvents()

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          new Date(b.occurredAt).getTime() -
          new Date(a.occurredAt).getTime()
      ),
    [items]
  )

  return (
    <div className="flex h-[480px] flex-col rounded-xl border bg-card sm:h-[560px] lg:h-[68vh] 2xl:h-[720px]">
      <div className="border-b px-4 py-2">
        <div className="text-xs font-semibold uppercase text-muted-foreground">
          Стрічка подій
        </div>
        <p className="text-[11px] text-muted-foreground">
          Клік по події центрує карту та відкриває попап.
        </p>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {sorted.map((event) => {
          const isActive = event.id === selectedEventId
          const typeMeta = eventTypes.find((t) => t.value === event.type)
          const typeLabel = typeMeta?.label ?? event.type

          const timeAgo = formatDistanceToNow(
            new Date(event.occurredAt),
            { addSuffix: true, locale: uk }
          )

          const severityDot =
            event.severity === 'critical'
              ? 'bg-red-500'
              : event.severity === 'high'
                ? 'bg-orange-500'
                : event.severity === 'medium'
                  ? 'bg-yellow-400'
                  : 'bg-emerald-400'

          return (
            <button
              key={event.id}
              type="button"
              onClick={() => setSelectedEventId(event.id)}
              className={[
                'w-full rounded-md border px-3 py-2 text-left text-xs transition',
                'hover:border-emerald-400/70 hover:bg-emerald-500/5',
                isActive
                  ? 'border-emerald-500 bg-emerald-500/10 shadow-sm'
                  : 'border-border/60 bg-background/60',
              ].join(' ')}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`h-2 w-2 rounded-full ${severityDot}`}
                  />
                  <span className="font-medium line-clamp-2">
                    {event.title}
                  </span>
                </div>
                <Badge
                  variant="outline"
                  className="text-[10px] px-1 py-0 leading-tight"
                >
                  {theaterLabel[event.theater]}
                </Badge>
              </div>

              <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                <span>{typeLabel}</span>
                <span>•</span>
                <span>{timeAgo}</span>
                {event.confidence != null && (
                  <>
                    <span>•</span>
                    <span>Conf: {Math.round(event.confidence * 100)}%</span>
                  </>
                )}
              </div>

              {event.summary && (
                <p className="line-clamp-2 text-[11px] text-muted-foreground">
                  {event.summary}
                </p>
              )}
            </button>
          )
        })}

        {sorted.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            Немає подій для відображення.
          </p>
        )}
      </div>
    </div>
  )
}
