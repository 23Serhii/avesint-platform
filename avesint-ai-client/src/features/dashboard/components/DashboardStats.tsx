// avesint-ai-client/src/features/dashboard/components/DashboardStats.tsx
'use client'

import { useEffect, useState } from 'react'
import { Radar, MapPin, Target, Flag } from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx'
import { listEvents } from '@/lib/api/events'
import { listTargets } from '@/lib/api/targets'
import { listTasks } from '@/lib/api/tasks'

type Stats = {
    activeEvents: number
    detectedTargets: number
    updated24h: number
    tasksInProgress: number
}

export function DashboardStats() {
    const [stats, setStats] = useState<Stats>({
        activeEvents: 0,
        detectedTargets: 0,
        updated24h: 0,
        tasksInProgress: 0,
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                setError(null)

                const now = new Date()
                const from24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

                const [eventsAll, targetsAll, events24h, tasksInProgress] =
                    await Promise.all([
                        listEvents({ page: 1, pageSize: 1 }), // total подій
                        listTargets({ page: 1, pageSize: 1, archived: false }),
                        listEvents({ page: 1, pageSize: 1, from: from24h }),
                        listTasks({
                            page: 1,
                            pageSize: 1,
                            status: ['in_progress'],
                            archived: false,
                        }),
                    ])

                setStats({
                    activeEvents: eventsAll.total,
                    detectedTargets: targetsAll.total,
                    updated24h: events24h.total,
                    tasksInProgress: tasksInProgress.total,
                })
            } catch (e) {
                setError('Не вдалося завантажити статистику')
            } finally {
                setLoading(false)
            }
        }

        void load()
    }, [])

    const display = (value: number) => (loading ? '…' : value)

    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Radar size={16} /> Активні події
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                    {display(stats.activeEvents)}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Target size={16} /> Виявлені цілі
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                    {display(stats.detectedTargets)}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <MapPin size={16} /> Оновлено за 24 години
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                    {display(stats.updated24h)}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        <Flag size={16} /> Задачі в роботі
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-bold">
                    {display(stats.tasksInProgress)}
                </CardContent>
            </Card>

            {error && (
                <div className="col-span-full text-xs text-red-500">{error}</div>
            )}
        </div>
    )
}