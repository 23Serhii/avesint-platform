import { useMemo } from 'react'
import {
    Area,
    AreaChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts'

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import type { Event } from '@/features/events/data/schema'
import type { TimeRange } from './time-range'

type Props = {
    range: TimeRange
    events: Event[]
}

type Bucket = {
    label: string
    total: number
}

const ONE_HOUR = 1000 * 60 * 60
const ONE_DAY = ONE_HOUR * 24

function pickEventDate(ev: Event) {
    return ev.occurredAt ?? ev.createdAt
}

function isWithinRange(dateIso: string, now: Date, range: TimeRange) {
    const ts = new Date(dateIso).getTime()
    if (Number.isNaN(ts)) return false

    const diff = now.getTime() - ts
    if (diff < 0) return false

    switch (range) {
        case '24h':
            return diff <= ONE_DAY
        case '7d':
            return diff <= ONE_DAY * 7
        case '30d':
            return diff <= ONE_DAY * 30
    }
}

function buildBuckets(
    allEvents: Event[],
    range: TimeRange,
    now: Date,
): Bucket[] {
    const inRange = allEvents.filter((ev) =>
        isWithinRange(pickEventDate(ev), now, range),
    )

    const buckets: Bucket[] = []

    if (range === '24h') {
        for (let i = 23; i >= 0; i--) {
            const start = new Date(now.getTime() - i * ONE_HOUR)
            const end = new Date(start.getTime() + ONE_HOUR)

            const label = `${start.getHours().toString().padStart(2, '0')}:00`

            const bucketEvents = inRange.filter((ev) => {
                const ts = new Date(pickEventDate(ev)).getTime()
                return ts >= start.getTime() && ts < end.getTime()
            })

            buckets.push({
                label,
                total: bucketEvents.length,
            })
        }
    } else {
        const days = range === '7d' ? 7 : 30
        const startOfToday = new Date(now)
        startOfToday.setHours(0, 0, 0, 0)

        for (let i = days - 1; i >= 0; i--) {
            const start = new Date(startOfToday)
            start.setDate(start.getDate() - i)
            const end = new Date(start)
            end.setDate(end.getDate() + 1)

            const label = start.toLocaleDateString('uk-UA', {
                day: '2-digit',
                month: '2-digit',
            })

            const bucketEvents = inRange.filter((ev) => {
                const ts = new Date(pickEventDate(ev)).getTime()
                return ts >= start.getTime() && ts < end.getTime()
            })

            buckets.push({
                label,
                total: bucketEvents.length,
            })
        }
    }

    return buckets
}

export function DashboardEventsChart({ range, events }: Props) {
    const now = useMemo(() => new Date(), [])
    const data = useMemo(
        () => buildBuckets(events, range, now),
        [events, range, now],
    )

    if (data.length === 0) {
        return (
            <Card className="h-[280px]">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-sm font-medium">
                        <span>Динаміка подій</span>
                        <span className="text-[11px] text-muted-foreground">
              Немає подій у вибраному періоді
            </span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
                    Дані відсутні.
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="h-[280px]">
            <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                    <span>Динаміка подій</span>
                    <span className="text-[11px] text-muted-foreground">
            Кількість подій за обраний період
          </span>
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        margin={{ top: 10, left: -10, right: 0, bottom: 0 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-border/60"
                            vertical={false}
                        />
                        <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            className="text-[10px]"
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                            tickMargin={8}
                            className="text-[10px]"
                        />
                        <Tooltip
                            contentStyle={{
                                fontSize: 12,
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="total"
                            name="Всього подій"
                            stroke="currentColor"
                            className="text-primary"
                            fill="currentColor"
                            fillOpacity={0.18}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}