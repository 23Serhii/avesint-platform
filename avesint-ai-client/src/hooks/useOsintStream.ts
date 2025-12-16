// src/hooks/useOsintStream.ts
import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';


export type OsintPriority = 'low' | 'medium' | 'high' | 'critical'
export type OsintKind = 'text' | 'video' | 'image' | 'infra' | 'other'

export type OsintStreamItem = {
    id: string
    source: {
        id: string
        name: string
        category?: string
    }
    item: {
        externalId: string
        kind: OsintKind
        title?: string | null
        content: string
        summary?: string | null
        language?: string | null
        priority?: OsintPriority
        type?: string | null
        category?: string | null
        tags?: string[]
        credibility?: number
        parseDate: string
        eventDate?: string | null
        rawUrl?: string | null
        mediaUrl?: string | null
        meta?: Record<string, unknown>
    }
}

type UseOsintStreamOptions = {
    onItem: (item: OsintStreamItem) => void
}

// Глобальний сокет, який шариться між усіма хукамі
let sharedSocket: Socket | null = null
let subscribersCount = 0

const OSINT_EVENT_NAME = 'osint:item'
const SOCKET_PATH = '/socket.io'
const OSINT_NAMESPACE = '/osint'

function getSocketBaseUrl(): string | undefined {
  const apiUrl = import.meta.env.VITE_API_URL as string | undefined
  if (!apiUrl) return undefined

  try {
    const url = new URL(apiUrl)
    return url.origin // відкидаємо "/api"
  } catch {
    return undefined
  }
}

function createSharedSocket(): Socket {
  const base = getSocketBaseUrl()

  const socket = base
    ? io(base + OSINT_NAMESPACE, {
        path: SOCKET_PATH,
        transports: ['polling', 'websocket'],
        withCredentials: false, // ✅ ключова зміна: прибираємо cookie-mode
        timeout: 8000,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 3000,
      })
    : io(OSINT_NAMESPACE, {
        path: SOCKET_PATH,
        transports: ['polling', 'websocket'],
        withCredentials: false, // ✅ ключова зміна
        timeout: 8000,
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 500,
        reconnectionDelayMax: 3000,
      })

  socket.on('connect', () => {
    console.log(
      '[OSINT] Connected to',
      (base ?? '') + OSINT_NAMESPACE,
      'id=',
      socket.id
    )
  })

  socket.on('connect_error', (err) => {
    console.error('[OSINT] Socket connect_error', err)
  })

  socket.on('disconnect', (reason) => {
    console.warn('[OSINT] Socket disconnected:', reason)
  })

  return socket
}


/**
 * Підписка на live-стрім OSINT-подій через WebSocket (Socket.IO).
 * Хук не керує локальним станом — лише викликає onItem при кожному новому повідомленні.
 */
export function useOsintStream({ onItem }: UseOsintStreamOptions) {
    const handlerRef = useRef(onItem)
    handlerRef.current = onItem

    useEffect(() => {
        // Створюємо (або переюзуємо) спільний сокет
        if (!sharedSocket) {
            sharedSocket = createSharedSocket()
        }
        subscribersCount += 1

        const localHandler = (payload: unknown) => {
            // Мінімальна рантайм-перевірка структури; у разі чого просто логнемо помилку
            try {
                const data = payload as OsintStreamItem
                if (!data || typeof data !== 'object' || typeof data.id !== 'string') {
                    // eslint-disable-next-line no-console
                    console.warn('[OSINT] Received malformed item payload', payload)
                    return
                }

                handlerRef.current(data)
            } catch (err) {
                // eslint-disable-next-line no-console
                console.error('[OSINT] Failed to handle osint:item payload', err)
            }
        }

        sharedSocket.on(OSINT_EVENT_NAME, localHandler)

        return () => {
            if (!sharedSocket) return

            sharedSocket.off(OSINT_EVENT_NAME, localHandler)
            subscribersCount -= 1

            // Якщо жоден компонент більше не використовує стрім — закриваємо сокет
            if (subscribersCount <= 0) {
                // eslint-disable-next-line no-console
                console.log('[OSINT] No subscribers left, closing socket')
                sharedSocket.close()
                sharedSocket = null
                subscribersCount = 0
            }
        }
    }, [])
}