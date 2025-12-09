// src/features/dashboard/components/analytics.tsx
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { AnalyticsChart } from './analytics-chart'

export function Analytics() {
    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle>Оперативна активність</CardTitle>
                    <CardDescription>
                        Динаміка ворожих подій та активних задач штабу за останні дні.
                    </CardDescription>
                </CardHeader>
                <CardContent className="px-6">
                    <AnalyticsChart />
                </CardContent>
            </Card>

            {/* Ключові показники */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Події за період</CardTitle>
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
                            <path d="M3 3v18h18" />
                            <path d="M7 15l4-4 4 4 4-6" />
                        </svg>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">128</div>
                        <p className="text-xs text-muted-foreground">
                            +12% до попереднього періоду
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
                        <div className="text-2xl font-bold">47</div>
                        <p className="text-xs text-muted-foreground">
                            9 задач з високим пріоритетом
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
                        <div className="text-2xl font-bold">23</div>
                        <p className="text-xs text-muted-foreground">
                            6 з них з позначкою критичної важливості
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
                        <div className="text-2xl font-bold">14</div>
                        <p className="text-xs text-muted-foreground">
                            3 офіцери, 7 аналітиків, 4 оператори
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Джерела подій та доступ до системи */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-7">
                <Card className="col-span-1 lg:col-span-4">
                    <CardHeader>
                        <CardTitle>Джерела подій</CardTitle>
                        <CardDescription>
                            Топ‑джерела, з яких надходять OSINT‑події в систему.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <SimpleBarList
                            items={[
                                { name: 'Прямі SITREP / радіо', value: 52 },
                                { name: 'Телеграм‑канали', value: 34 },
                                { name: 'Супутникова / аеророзвідка', value: 21 },
                                { name: 'Інші OSINT‑ресурси', value: 15 },
                            ]}
                            barClass="bg-primary"
                            valueFormatter={(n) => `${n}`}
                        />
                    </CardContent>
                </Card>

                <Card className="col-span-1 lg:col-span-3">
                    <CardHeader>
                        <CardTitle>Доступ до системи</CardTitle>
                        <CardDescription>
                            З яких пристроїв особовий склад працює з системою.
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