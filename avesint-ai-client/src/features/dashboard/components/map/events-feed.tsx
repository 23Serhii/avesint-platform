import type { AiMapEvent } from '@/lib/api/stream'
import { formatDistanceToNow } from 'date-fns'
import { uk } from 'date-fns/locale'

type Props = {
    events: AiMapEvent[]
}

export function EventsFeed({ events }: Props) {
    const latest = events
        .filter((e) => !!e.time)
        .slice()
        .sort((a, b) => {
            const ta = a.time ? +new Date(a.time) : 0
            const tb = b.time ? +new Date(b.time) : 0
            return tb - ta
        })
        .slice(0, 6)

    return (
        <div className="space-y-3 rounded-lg border p-4">
            <h3 className="text-lg font-semibold">Останні події (AI‑мапа)</h3>

            {latest.map((event) => (
                <div key={event.id} className="border-l-2 border-primary/60 pl-3">
                    <p className="font-medium">{event.title ?? 'Без назви'}</p>
                    <p className="text-sm text-muted-foreground">
                        {event.time
                            ? formatDistanceToNow(new Date(event.time), {
                                addSuffix: true,
                                locale: uk,
                            })
                            : '—'}
                    </p>
                </div>
            ))}

            {latest.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    Поки що немає подій з AI‑мапи. Після ревʼю та AI‑обробки нові точки
                    зʼявляться тут.
                </p>
            )}
        </div>
    )
}