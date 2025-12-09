import { useQuery } from '@tanstack/react-query'
import { listAiMapEvents, type AiMapEvent } from '@/lib/api/stream'

type UseAiMapEventsOptions = {
    status?: string // 'confirmed' by default
    limit?: number
}

export function useAiMapEvents(options?: UseAiMapEventsOptions) {
    const status = options?.status ?? 'confirmed'
    const limit = options?.limit ?? 300

    const query = useQuery({
        queryKey: ['ai-map-events', { status, limit }],
        queryFn: () => listAiMapEvents({ status, limit }),
        refetchInterval: 30_000, // авто-оновлення кожні 30с; можна вимкнути
    })

    return query as {
        data: AiMapEvent[] | undefined
        isLoading: boolean
        isError: boolean
        refetch: () => Promise<unknown>
    }
}