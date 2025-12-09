// avesint-ai-client/src/features/news-parser/index.tsx
import { useEffect, useMemo, useState } from 'react'

import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'

import { NewsFeedTable } from './components/news-feed-table'
import { NewsSourcesTable } from './components/news-sources-table'
import type { NewsItem, NewsSource } from './data/news'
import { listEvents } from '@/lib/api/events'

function mapEventSeverityToNewsSeverity(
    eventSeverity: string,
): NewsItem['severity'] {
    const sev = eventSeverity.toLowerCase()
    if (sev === 'high' || sev === 'critical') return 'high'
    if (sev === 'medium') return 'medium'
    return 'low'
}

export function NewsParser() {
    const [news, setNews] = useState<NewsItem[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const load = async () => {
            try {
                setLoading(true)
                setError(null)

                const res = await listEvents({
                    page: 1,
                    pageSize: 100,
                    // за бажанням можна додати фільтр type/status тут
                })

                const items: NewsItem[] = res.items.map((ev) => ({
                    id: ev.id,
                    title: ev.summary || ev.title,
                    sourceId: ev.externalRef ?? ev.type,
                    sourceName: ev.externalRef ?? ev.type,
                    severity: mapEventSeverityToNewsSeverity(ev.severity),
                    link: undefined,
                    createdAt: ev.occurredAt || ev.createdAt,
                }))

                setNews(items)
            } catch (e) {
                setError('Не вдалося завантажити новини з подій')
            } finally {
                setLoading(false)
            }
        }

        void load()
    }, [])

    const sources: NewsSource[] = useMemo(() => {
        const byId = new Map<string, NewsSource & { count: number }>()

        for (const item of news) {
            const id = item.sourceId || 'unknown'
            const existing = byId.get(id)
            if (existing) {
                existing.count += 1
                if (
                    !existing.lastSeenAt ||
                    new Date(item.createdAt) > new Date(existing.lastSeenAt)
                ) {
                    existing.lastSeenAt = item.createdAt
                }
            } else {
                byId.set(id, {
                    id,
                    name: item.sourceName || 'Невідоме джерело',
                    type: 'other',
                    reliability: 0.5, // тимчасово, поки нема окремої аналітики джерел
                    isActive: true,
                    lastSeenAt: item.createdAt,
                    count: 1,
                })
            }
        }

        return Array.from(byId.values()).map((s) => ({
            id: s.id,
            name: s.name,
            type: s.type,
            reliability: s.reliability,
            isActive: s.isActive,
            lastSeenAt: s.lastSeenAt,
        }))
    }, [news])

    return (
        <>
            <Header fixed>
                <Search />
                <div className="ms-auto flex items-center space-x-4">
                    <ThemeSwitch />
                    <ConfigDrawer />
                    <ProfileDropdown />
                </div>
            </Header>

            <Main className="flex flex-col gap-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Новини / парсер</h1>
                    <p className="text-muted-foreground">
                        Централізований збір OSINT-новин з Telegram, Twitter, сайтів та RSS
                        з подальшою верифікацією.
                    </p>
                </div>

                {loading && news.length === 0 && (
                    <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
                        Завантаження…
                    </div>
                )}

                {error && !loading && (
                    <div className="flex h-40 items-center justify-center text-sm text-red-500">
                        {error}
                    </div>
                )}

                {!loading && !error && (
                    <div className="grid gap-6 lg:grid-cols-3">
                        <div className="lg:col-span-2">
                            <NewsFeedTable items={news} />
                        </div>
                        <div className="lg:col-span-1">
                            <NewsSourcesTable sources={sources} />
                        </div>
                    </div>
                )}
            </Main>
        </>
    )
}