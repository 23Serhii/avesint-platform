'use client'

import { useRouter } from '@tanstack/react-router'
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
    CardDescription,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

type OverviewNewsItem = {
    id: string
    source: string
    title: string
    createdAt: string
    tag?: string
}

type OverviewEventItem = {
    id: string
    title: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    status: string
    occurredAt: string
}

type OverviewTaskItem = {
    id: string
    title: string
    priority: 'low' | 'medium' | 'high'
    status: 'new' | 'in_progress' | 'done'
    dueAt?: string
}

// Тимчасові мок‑дані
const mockNews: OverviewNewsItem[] = [
    {
        id: 'n1',
        source: 'OSINT / Telegram',
        title: 'Фіксується накопичення ББМ на напрямку Бєлгород – Валуйки',
        createdAt: '15 хв тому',
        tag: 'рух техніки',
    },
    {
        id: 'n2',
        source: 'ЗМІ / Reuters',
        title: 'Повідомлення про можливу атаку БпЛА по енергообʼєктах',
        createdAt: '1 год тому',
        tag: 'загроза КІ',
    },
    {
        id: 'n3',
        source: 'OSINT / X (Twitter)',
        title: 'Супутникові знімки з новими воронками біля складу БК',
        createdAt: '3 год тому',
        tag: 'ураження цілі',
    },
]

const mockEvents: OverviewEventItem[] = [
    {
        id: 'EVT-1',
        title: 'Рух колони ББМ (Бєлгородська обл.)',
        severity: 'high',
        status: 'нова',
        occurredAt: '10 хв тому',
    },
    {
        id: 'EVT-2',
        title: 'Підготовка Ту-95 (Енгельс)',
        severity: 'critical',
        status: 'підтверджена',
        occurredAt: '2 год тому',
    },
    {
        id: 'EVT-3',
        title: 'Загроза обʼєкту КІ (підстанція 330 кВ)',
        severity: 'high',
        status: 'у роботі',
        occurredAt: '6 год тому',
    },
]

const mockTasks: OverviewTaskItem[] = [
    {
        id: 'T-101',
        title: 'Підготувати ситреп по загрозам КІ (північний схід)',
        priority: 'high',
        status: 'in_progress',
        dueAt: 'сьогодні, 18:00',
    },
    {
        id: 'T-102',
        title: 'Звірити координати складів БК з новими супутниковими знімками',
        priority: 'medium',
        status: 'new',
        dueAt: 'завтра',
    },
    {
        id: 'T-103',
        title: 'Оновити карту ризиків по стратегічній авіації',
        priority: 'low',
        status: 'new',
    },
]

// Бейджі
function severityBadge(severity: OverviewEventItem['severity']) {
    const map: Record<
        OverviewEventItem['severity'],
        { label: string; className: string }
    > = {
        low: { label: 'Низька', className: 'bg-muted text-foreground' },
        medium: {
            label: 'Середня',
            className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
        },
        high: {
            label: 'Висока',
            className:
                'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
        },
        critical: {
            label: 'Критична',
            className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
        },
    }

    const s = map[severity]
    return (
        <Badge
            variant="outline"
            className={cn('border-0 text-[10px] font-semibold', s.className)}
        >
            {s.label}
        </Badge>
    )
}

function priorityBadge(priority: OverviewTaskItem['priority']) {
    const map: Record<
        OverviewTaskItem['priority'],
        { label: string; className: string }
    > = {
        low: { label: 'Низький', className: 'bg-muted text-foreground' },
        medium: {
            label: 'Середній',
            className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
        },
        high: {
            label: 'Високий',
            className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100',
        },
    }

    const p = map[priority]
    return (
        <Badge
            variant="outline"
            className={cn('border-0 text-[10px] font-semibold', p.className)}
        >
            {p.label}
        </Badge>
    )
}

function taskStatusLabel(status: OverviewTaskItem['status']) {
    switch (status) {
        case 'new':
            return 'Нова'
        case 'in_progress':
            return 'У роботі'
        case 'done':
            return 'Виконана'
    }
}

// Головний компонент “Огляду”
export function OverviewDashboard() {
    const router = useRouter()

    // ВАЖЛИВО: тільки дозволені роутером шляхи
    const goToNews = () => {
        void router.navigate({ to: '/news-parser' })
    }

    const goToEvents = () => {
        void router.navigate({ to: '/events' })
    }

    const goToTasks = () => {
        void router.navigate({ to: '/tasks' })
    }

    const openNewsItem = (news: OverviewNewsItem) => {
        goToNews()
    }

    const openEvent = (cdevent: OverviewEventItem) => {
        goToEvents()
    }

    const openTask = (task: OverviewTaskItem) => {
        goToTasks()
    }

    return (
        <div className="flex h-full flex-col gap-4 lg:gap-6">
            {/* Верхній блок: заголовок + summary */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                    <h1 className="text-2xl font-bold tracking-tight">
                        Огляд обстановки
                    </h1>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                        Консолідований вигляд по новинах, подіях та задачах штабу. Клік по
                        елементу переводить у відповідний розділ для детальної роботи.
                    </p>
                </div>

                <div className="grid grid-cols-3 gap-3 rounded-lg border bg-background/60 p-3 text-center text-xs sm:text-sm">
                    <div className="space-y-1">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Новини
                        </div>
                        <div className="text-lg font-semibold">{mockNews.length}</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Події
                        </div>
                        <div className="text-lg font-semibold">{mockEvents.length}</div>
                    </div>
                    <div className="space-y-1">
                        <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Задачі
                        </div>
                        <div className="text-lg font-semibold">{mockTasks.length}</div>
                    </div>
                </div>
            </div>

            {/* Основна сітка: новини / події / задачі */}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 lg:gap-6">
                {/* Новини */}
                <Card className="flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div>
                            <CardTitle className="text-sm">Оперативні новини</CardTitle>
                            <CardDescription className="text-xs">
                                Агреговані OSINT‑джерела, ЗМІ, офіційні канали.
                            </CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-3 text-[11px]"
                            onClick={goToNews}
                        >
                            Всі новини
                        </Button>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-1.5 pt-0">
                        {mockNews.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => openNewsItem(item)}
                                className={cn(
                                    'w-full rounded-md border border-transparent px-2 py-2 text-left text-xs',
                                    'hover:border-border hover:bg-muted/60 transition-colors',
                                    'flex flex-col gap-1',
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 font-medium text-[13px]">
                    {item.title}
                  </span>
                                    {item.tag && (
                                        <Badge
                                            variant="outline"
                                            className="shrink-0 border-0 bg-slate-900/5 text-[10px] dark:bg-slate-50/10"
                                        >
                                            {item.tag}
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span className="line-clamp-1">{item.source}</span>
                                    <span>{item.createdAt}</span>
                                </div>
                            </button>
                        ))}

                        {mockNews.length === 0 && (
                            <p className="py-6 text-center text-xs text-muted-foreground">
                                Наразі немає нових повідомлень.
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Події */}
                <Card className="flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div>
                            <CardTitle className="text-sm">Ключові події</CardTitle>
                            <CardDescription className="text-xs">
                                Найважливіші розвідподії останнього часу.
                            </CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-3 text-[11px]"
                            onClick={goToEvents}
                        >
                            Всі події
                        </Button>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-1.5 pt-0">
                        {mockEvents.map((ev) => (
                            <button
                                key={ev.id}
                                type="button"
                                onClick={() => openEvent(ev)}
                                className={cn(
                                    'w-full rounded-md border border-transparent px-2 py-2 text-left text-xs',
                                    'hover:border-border hover:bg-muted/60 transition-colors',
                                    'flex flex-col gap-1',
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 font-medium text-[13px]">
                    {ev.title}
                  </span>
                                    {severityBadge(ev.severity)}
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span className="line-clamp-1">Статус: {ev.status}</span>
                                    <span>{ev.occurredAt}</span>
                                </div>
                            </button>
                        ))}

                        {mockEvents.length === 0 && (
                            <p className="py-6 text-center text-xs text-muted-foreground">
                                Немає активних подій для відображення.
                            </p>
                        )}
                    </CardContent>
                </Card>

                {/* Задачі */}
                <Card className="flex flex-col">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div>
                            <CardTitle className="text-sm">Задачі штабу</CardTitle>
                            <CardDescription className="text-xs">
                                Критичні доручення по супроводу подій та цілей.
                            </CardDescription>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-3 text-[11px]"
                            onClick={goToTasks}
                        >
                            Всі задачі
                        </Button>
                    </CardHeader>
                    <CardContent className="flex-1 space-y-1.5 pt-0">
                        {mockTasks.map((task) => (
                            <button
                                key={task.id}
                                type="button"
                                onClick={() => openTask(task)}
                                className={cn(
                                    'w-full rounded-md border border-transparent px-2 py-2 text-left text-xs',
                                    'hover:border-border hover:bg-muted/60 transition-colors',
                                    'flex flex-col gap-1',
                                )}
                            >
                                <div className="flex items-start justify-between gap-2">
                  <span className="line-clamp-2 font-medium text-[13px]">
                    {task.title}
                  </span>
                                    <div className="flex flex-col items-end gap-1">
                                        {priorityBadge(task.priority)}
                                        <span className="text-[10px] text-muted-foreground">
                      {taskStatusLabel(task.status)}
                    </span>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                    <span>ID: {task.id}</span>
                                    {task.dueAt && <span>{task.dueAt}</span>}
                                </div>
                            </button>
                        ))}

                        {mockTasks.length === 0 && (
                            <p className="py-6 text-center text-xs text-muted-foreground">
                                Активні задачі відсутні.
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}