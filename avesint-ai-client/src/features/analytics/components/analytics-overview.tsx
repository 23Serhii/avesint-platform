// src/features/analytics/components/analytics-overview.tsx
import { useEffect, useMemo, useState } from 'react'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { AnalyticsChart } from './analytics-chart'
import type { Event } from '@/features/events/data/schema'
import type { TimeRange } from '@/features/dashboard/components/time-range'
import { listEvents } from '@/lib/api/events'
import { listTasks } from '@/lib/api/tasks'
import { listTargets } from '@/lib/api/targets'
import {listOsintSources, OsintSource} from "@/lib/api/osint-sources.ts";
import {listUsers} from "@/lib/api/users.ts";

type Period = '24h' | '7d' | '30d' | 'custom'

type Stats = {
    eventsTotal: number
    eventsInRange: number
    activeTasks: number
    activeTargets: number
    activeUsers: number
    sources: { name: string; value: number }[]
}

const ONE_DAY = 24 * 60 * 60 * 1000

function toTimeRange(period: Period): TimeRange {
    if (period === 'custom') return '30d'
    return period
}

function isWithinRange(dateIso: string | null | undefined, now: Date, range: TimeRange) {
    if (!dateIso) return false
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

type AnalyticsOverviewProps = {
    period: Period
}

export function AnalyticsOverview({ period }: AnalyticsOverviewProps) {
    const [events, setEvents] = useState<Event[]>([])
    const [tasks, setTasks] = useState<any[]>([])
    const [stats, setStats] = useState<Stats>({
        eventsTotal: 0,
        eventsInRange: 0,
        activeTasks: 0,
        activeTargets: 0,
        activeUsers: 0,
        sources: [],
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const range: TimeRange = toTimeRange(period)

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                setError(null)

                const [eventsRes, tasksRes, targetsRes, sourcesRes, usersRes] =
                    await Promise.all([
                        listEvents({ page: 1, pageSize: 500 }),
                        listTasks({ page: 1, pageSize: 500, archived: false }),
                        listTargets({ page: 1, pageSize: 1, archived: false }),
                        listOsintSources({ isActive: true }),
                        listUsers({ page: 1, pageSize: 1 }),
                    ])

                const evItems = eventsRes.items as Event[]
                const taskItems = tasksRes.items as any[]
                const osintSources = sourcesRes as OsintSource[]

                setEvents(evItems)
                setTasks(taskItems)

                const now = new Date()
                const eventsInRange = evItems.filter((e) =>
                    isWithinRange(e.occurredAt ?? e.createdAt, now, range),
                ).length

                const activeTasks = taskItems.filter(
                    (t) => t.status && t.status !== 'done',
                ).length

                const activeUsers = usersRes.total ?? 0

                // Джерела подій: топ за кількістю елементів
                const sourcesStats = osintSources
                    .map((s) => ({
                        name: s.handle || s.name || s.externalId,
                        value: s.totalItems ?? 0,
                    }))
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 4)

                setStats({
                    eventsTotal: eventsRes.total,
                    eventsInRange,
                    activeTasks,
                    activeTargets: targetsRes.total,
                    activeUsers,
                    sources: sourcesStats,
                })
            } catch {
                setError('Не вдалося завантажити дані для аналітики')
            } finally {
                setLoading(false)
            }
        }

        void load()
    }, [range])

    const titleSuffix = useMemo(() => {
        switch (range) {
            case '24h':
                return 'за 24 години'
            case '7d':
                return 'за 7 діб'
            case '30d':
                return 'за 30 діб'
        }
    }, [range])

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Оперативна активність</CardTitle>
                    <CardDescription>
                        Динаміка ворожих подій та активних задач штабу {titleSuffix}.
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-6">
                    {loading && events.length === 0 && (
                        <div className="flex h-[260px] items-center justify-center text-xs text-muted-foreground">
                            Завантаження даних…
                        </div>
                    )}
                    {error && !loading && (
                        <div className="flex h-[260px] items-center justify-center text-xs text-red-500">
                            {error}
                        </div>
                    )}
                    {!loading && !error && (
                        <AnalyticsChart range={range} events={events} tasks={tasks} />
                    )}
                </CardContent>
            </Card>

            {/* Ключові показники */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Події за період</CardTitle>  <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            className="h-4 w-4 text-muted-foreground"
                        >
                            <path d="M3 3v18h18" />
                            <path d="M7 15l4-4 4 4 4-6" />
                        </svg>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loading ? '…' : stats.eventsInRange}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Всього в базі: {stats.eventsTotal}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Активні задачі</CardTitle>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            className="h-4 w-4 text-muted-foreground"
                        >
                            <circle cx="12" cy="7" r="4" />
                            <path d="M6 21v-2a6 6 0 0 1 12 0v2" />
                        </svg>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loading ? '…' : stats.activeTasks}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Задачі зі статусом відмінним від &quot;done&quot;
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Цілі в роботі</CardTitle>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            className="h-4 w-4 text-muted-foreground"
                        >
                            <path d="M21 12a9 9 0 1 1-9-9" />
                            <path d="M22 2 12 12" />
                        </svg>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {loading ? '…' : stats.activeTargets}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Виявлені та неархівовані цілі
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Активні користувачі
                        </CardTitle>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            className="h-4 w-4 text-muted-foreground"
                        >
                            <circle cx="9" cy="7" r="4" />
                            <path d="M3 21v-2a6 6 0 0 1 6-6" />
                            <circle cx="19" cy="7" r="3" />
                            <path d="M19 14a4 4 0 0 1 4 4v2" />
                        </svg>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">—</div>
                        <p className="text-xs text-muted-foreground">
                            Можна підключити до реєстру користувачів окремо
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Нижній блок поки що лишаємо демонстраційним */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
                <Card className="col-span-1 lg:col-span-4">
                    <CardHeader>
                        <CardTitle>Джерела подій</CardTitle>
                        <CardDescription>
                            Топ‑джерела OSINT за кількістю інгестованих елементів.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading && stats.sources.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                Завантаження списку джерел…
                            </p>
                        ) : stats.sources.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                                Немає активних джерел OSINT.
                            </p>
                        ) : (
                            <SimpleBarList
                                items={stats.sources}
                                barClass="bg-primary"
                                valueFormatter={(n) => `${n}`}
                            />
                        )}
                    </CardContent>
                </Card>

                <Card className="col-span-1 lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Доступ до системи</CardTitle>
                        <CardDescription>
                            З яких пристроїв особовий склад працює з системою (поки
                            демонстраційні дані).
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SimpleBarList
                            items={[
                                { name: 'Робочі станції (ПК)', value: 76 },
                                { name: 'Ноутбуки', value: 18 },
                                { name: 'Планшети / мобільні', value: 6 },
                            ]}
                            barClass="bg-muted-foreground"
                            valueFormatter={(n) => `${n}%`}
                        />
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}


function SimpleBarList({
                           items,
                           valueFormatter,
                           barClass,
                       }: {
    items: { name: string; value: number }[]
    valueFormatter: (n: number) => string
    barClass: string
}) {
    const max = Math.max(...items.map((i) => i.value), 1)
    return (
        <ul className="space-y-3">
            {items.map((i) => {
                const width = `${Math.round((i.value / max) * 100)}%`
                return (
                    <li key={i.name} className="flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                            <div className="mb-1 truncate text-xs text-muted-foreground">
                                {i.name}
                            </div>
                            <div className="h-2.5 w-full rounded-full bg-muted">
                                <div
                                    className={`h-2.5 rounded-full ${barClass}`}
                                    style={{ width }}
                                />
                            </div>
                        </div>
                        <div className="ps-2 text-xs font-medium tabular-nums">
                            {valueFormatter(i.value)}
                        </div>
                    </li>
                )
            })}
        </ul>
    )
}