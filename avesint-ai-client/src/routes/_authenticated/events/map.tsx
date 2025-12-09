// src/routes/_authenticated/events/map.tsx
import { createFileRoute } from '@tanstack/react-router'
import { EventsMap } from '@/features/events/events-map'
import { EventsProvider } from '@/features/events/components/events-provider'

function EventsMapRoute() {
  // Обгортаємо у провайдер, бо карта використовує useEvents (виділення і фокус)
  return (
    <EventsProvider>
      <EventsMap />
    </EventsProvider>
  )
}

export const Route = createFileRoute('/_authenticated/events/map')({
  component: EventsMapRoute,
})