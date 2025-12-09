import { useMemo } from 'react'
import {
    Pie,
    PieChart,
    ResponsiveContainer,
    Cell,
    Tooltip,
    Legend,
} from 'recharts'

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import type { TimeRange } from './time-range'
import type { Event } from '@/features/events/data/schema'

type Props = {
    range: TimeRange
    events: Event[]
}

const COLORS: Record<string, string> = {
    critical: '#ef4444',
    high: '#f97316',
    medium: '#eab308',
    low: '#22c55e',
    other: '#6b7280',
}

export function DashboardEventsPie({ range, events }: Props) {
    const data = useMemo(() => {
        const now = Date.now()
        const dayMs = 24 * 60 * 60 * 1000

        const withinRange = (time: string) => {
            const t = new Date(time).getTime()
            if (Number.isNaN(t)) return false
            const diff = now - t

            switch (range) {
                case '24h':
                    return diff <= dayMs
                case '7d':
                    return diff <= 7 * dayMs
                case '30d':
                    return diff <= 30 * dayMs
                default:
                    return true
            }
        }

        const counters: Record<string, number> = {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
            other: 0,
        }

        events.forEach((e) => {
            const time = e.occurredAt ?? e.createdAt
            if (!withinRange(time)) return

            const sev = e.severity ?? 'other'
            if (sev in counters) counters[sev] += 1
            else counters.other += 1
        })

        return Object.entries(counters)
            .filter(([, value]) => value > 0)
            .map(([name, value]) => ({ name, value }))
    }, [events, range])

    if (data.length === 0) {
        return (
            <Card className="h-[280px]">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium">
                        Структура подій за важливістю
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex h-[220px] items-center justify-center text-xs text-muted-foreground">
                    Немає подій у вибраному періоді.
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="h-[280px]">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                    Структура подій за важливістю
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={40}
                            outerRadius={70}
                            paddingAngle={2}
                        >
                            {data.map((entry) => (
                                <Cell
                                    key={entry.name}
                                    fill={COLORS[entry.name] ?? COLORS.other}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            contentStyle={{ fontSize: 12 }}
                            formatter={(value: number, name: string) => [
                                value,
                                name === 'critical'
                                    ? 'Критичні'
                                    : name === 'high'
                                        ? 'Високі'
                                        : name === 'medium'
                                            ? 'Середні'
                                            : name === 'low'
                                                ? 'Низькі'
                                                : 'Інші',
                            ]}
                        />
                        <Legend
                            formatter={(name: string) =>
                                name === 'critical'
                                    ? 'Критичні'
                                    : name === 'high'
                                        ? 'Високі'
                                        : name === 'medium'
                                            ? 'Середні'
                                            : name === 'low'
                                                ? 'Низькі'
                                                : 'Інші'
                            }
                        />
                    </PieChart>
                </ResponsiveContainer>
            </CardContent>
        </Card>
    )
}