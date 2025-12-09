import React, { useState } from 'react'
import type { Event } from '../data/schema'

export type EventsDialogType = 'create' | 'update' | 'delete'

type EventsContextType = {
  open: EventsDialogType | null
  setOpen: (value: EventsDialogType | null) => void
  currentRow: Event | null
  setCurrentRow: React.Dispatch<React.SetStateAction<Event | null>>

  // 🔥 вибраний івент для карти
  selectedEventId: string | null
  setSelectedEventId: (id: string | null) => void
}

const EventsContext = React.createContext<EventsContextType | null>(null)

export function EventsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<EventsDialogType | null>(null)
  const [currentRow, setCurrentRow] = useState<Event | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)

  return (
    <EventsContext.Provider
      value={{
        open,
        setOpen,
        currentRow,
        setCurrentRow,
        selectedEventId,
        setSelectedEventId,
      }}
    >
      {children}
    </EventsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useEvents = () => {
  const ctx = React.useContext(EventsContext)
  if (!ctx) {
    throw new Error('useEvents must be used within <EventsProvider>')
  }
  return ctx
}
