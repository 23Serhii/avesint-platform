// src/features/analytics/components/analytics-chart.tsx
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
import type { Event } from '@/features/events/data/schema'
import type { TimeRange } from '@/features/dashboard/components/time-range'

type TaskLike = {
    createdAt?: string | null
    occurredAt?: string | null
}

type Bucket = {
    label: string
    events: number
    tasks: number
}

type AnalyticsChartProps = {
    range: TimeRange
    events: Event[]
    tasks: TaskLike[]
}

const ONE_HOUR = 1000 * 60 * 60
const ONE_DAY = ONE_HOUR * 24

function pickDate(occurredAt?: string | null, createdAt?: string | null) {
    return occurredAt ?? createdAt ?? ''
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
    events: Event[],
    tasks: TaskLike[],
    range: TimeRange,
    now: Date,
): Bucket[] {
    const eventsInRange = events.filter((ev) =>
        isWithinRange(pickDate(ev.occurredAt, ev.createdAt), now, range),
    )
    const tasksInRange = tasks.filter((t) =>
        isWithinRange(pickDate(t.occurredAt, t.createdAt), now, range),
    )

    const buckets: Bucket[] = []

    if (range === '24h') {
        for (let i = 23; i >= 0; i--) {
            const start = new Date(now.getTime() - i * ONE_HOUR)
            const end = new Date(start.getTime() + ONE_HOUR)

            const label = `${start.getHours().toString().padStart(2, '0')}:00`

            const eventsBucket = eventsInRange.filter((ev) => {
                const ts = new Date(pickDate(ev.occurredAt, ev.createdAt)).getTime()
                return ts >= start.getTime() && ts < end.getTime()
            })

            const tasksBucket = tasksInRange.filter((t) => {
                const ts = new Date(pickDate(t.occurredAt, t.createdAt)).getTime()
                return ts >= start.getTime() && ts < end.getTime()
            })

            buckets.push({
                label,
                events: eventsBucket.length,
                tasks: tasksBucket.length,
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

            const eventsBucket = eventsInRange.filter((ev) => {
                const ts = new Date(pickDate(ev.occurredAt, ev.createdAt)).getTime()
                return ts >= start.getTime() && ts < end.getTime()
            })

            const tasksBucket = tasksInRange.filter((t) => {
                const ts = new Date(pickDate(t.occurredAt, t.createdAt)).getTime()
                return ts >= start.getTime() && ts < end.getTime()
            })

            buckets.push({
                label,
                events: eventsBucket.length,
                tasks: tasksBucket.length,
            })
        }
    }

    return buckets
}

export function AnalyticsChart({ range, events, tasks }: AnalyticsChartProps) {
    const now = useMemo(() => new Date(), [])
    const data = useMemo(
        () => buildBuckets(events, tasks, range, now),
        [events, tasks, range, now],
    )

    if (data.length === 0) {
        return (
            <div className="flex h-[260px] items-center justify-center text-xs text-muted-foreground">
                Дані відсутні для вибраного періоду
            </div>
        )
    }

    return (
        <ResponsiveContainer width="100%" height={300}>
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
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Area
                    type="monotone"
                    dataKey="events"
                    name="Події"
                    stroke="currentColor"
                    className="text-primary"
                    fill="currentColor"
                    fillOpacity={0.18}
                />
                <Area
                    type="monotone"
                    dataKey="tasks"
                    name="Задачі"
                    stroke="currentColor"
                    className="text-muted-foreground"
                    fill="currentColor"
                    fillOpacity={0.12}
                />
            </AreaChart>
        </ResponsiveContainer>
    )
}