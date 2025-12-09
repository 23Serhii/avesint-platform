// src/features/osint/use-ai-stream.ts
import { useEffect, useState } from 'react'
import { io, type Socket } from 'socket.io-client'

export type AiStreamEventSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type AiStreamEvent = {
    id: string
    type: string
    title: string
    source?: string
    ts: string
    severity?: AiStreamEventSeverity
}

function getSocketBaseUrl(): string | undefined {
    const apiUrl = import.meta.env.VITE_API_URL as string | undefined
    try {
        if (!apiUrl) return undefined
        const u = new URL(apiUrl)
        return u.origin // strip "/api"
    } catch {
        return undefined
    }
}

export function useAiStream() {
    const [events, setEvents] = useState<AiStreamEvent[]>([])
    const [connected, setConnected] = useState(false)

    useEffect(() => {
        const base = getSocketBaseUrl()

        const socket: Socket = base
            ? io(base + '/ai-stream', {
                  path: '/socket.io',
                  transports: ['websocket'],
                  withCredentials: true,
              })
            : io('/ai-stream', {
                  path: '/socket.io',
                  transports: ['websocket'],
                  withCredentials: true,
              })

        socket.on('connect', () => {
            setConnected(true)
        })

        socket.on('disconnect', () => {
            setConnected(false)
        })

        socket.on('ai_stream_event', (payload: any) => {
            const ev: AiStreamEvent = {
                id:
                    typeof payload?.id === 'string' && payload.id
                        ? payload.id
                        : crypto.randomUUID(),
                type: typeof payload?.type === 'string' ? payload.type : 'info',
                title: typeof payload?.title === 'string' ? payload.title : 'Подія AI',
                source:
                    typeof payload?.source === 'string' ? payload.source : undefined,
                ts:
                    typeof payload?.ts === 'string' && payload.ts
                        ? payload.ts
                        : new Date().toISOString(),
                severity: (payload?.severity as AiStreamEventSeverity | undefined) ?? 'info',
            }

            setEvents((prev) => [ev, ...prev].slice(0, 100))
        })

        return () => {
            socket.disconnect()
        }
    }, [])

    return { events, connected }
}