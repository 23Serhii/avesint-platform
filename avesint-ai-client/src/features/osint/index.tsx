'use client';

import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { useOsintStream, type OsintStreamItem } from '@/hooks/useOsintStream';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ConfigDrawer } from '@/components/config-drawer';
import { Header } from '@/components/layout/header';
import { Main } from '@/components/layout/main';
import { ProfileDropdown } from '@/components/profile-dropdown';
import { Search } from '@/components/search';
import { ThemeSwitch } from '@/components/theme-switch';


function formatDate(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('uk-UA', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function getDedupInfo(meta: unknown): {
  matchedEventId?: string
  qdrantScore?: number
  createdEventId?: string
} | null {
  if (!meta || typeof meta !== 'object') return null
  const m = meta as Record<string, unknown>
  const dedup = m.dedup
  if (!dedup || typeof dedup !== 'object') return null

  const d = dedup as Record<string, unknown>

  const matchedEventId =
    typeof d.matchedEventId === 'string' ? d.matchedEventId : undefined
  const createdEventId =
    typeof d.createdEventId === 'string' ? d.createdEventId : undefined

  const qdrantScore =
    typeof d.qdrantScore === 'number' ? d.qdrantScore : undefined

  return { matchedEventId, createdEventId, qdrantScore }
}


function priorityColor(p?: OsintStreamItem['item']['priority']) {
    switch (p) {
        case 'critical':
            return 'bg-red-500/10 text-red-500 border-red-500/30'
        case 'high':
            return 'bg-orange-500/10 text-orange-500 border-orange-500/30'
        case 'medium':
            return 'bg-yellow-500/10 text-yellow-700 border-yellow-500/40'
        case 'low':
        default:
            return 'bg-muted text-muted-foreground border-border/60'
    }
}

function sourceCategoryColor(cat?: string) {
    switch (cat) {
        case 'official':
            return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/40'
        case 'osint-team':
            return 'bg-sky-500/10 text-sky-500 border-sky-500/40'
        case 'enemy-prop':
            return 'bg-red-500/5 text-red-400 border-red-500/30'
        default:
            return 'bg-muted text-muted-foreground border-border/60'
    }
}

export function OsintPage() {
    const [items, setItems] = useState<OsintStreamItem[]>([])

    const handleNewItem = useCallback((item: OsintStreamItem) => {
        setItems((prev) => [item, ...prev].slice(0, 200))
    }, [])

    useOsintStream({ onItem: handleNewItem })

    return (
        <>
            <Header fixed>
                <Search />
                <div className="ms-auto flex items-center space-x-4">
                    <ThemeSwitch />
                    <ConfigDrawer />
                    {/* <ProfileDropdown /> */}
                </div>
            </Header>

            <Main className="flex flex-1 flex-col gap-4 lg:gap-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">OSINT стрічка</h1>
                        <p className="max-w-2xl text-sm text-muted-foreground">
                            Live-оновлення з Telegram/новин та інших OSINT-джерел. Кожен елемент
                            проходить через парсинг та AI-обробку.
                        </p>
                    </div>
                </div>

                <div className="flex-1 space-y-2 overflow-auto rounded-xl border bg-background/40 p-3">
                    {items.length === 0 && (
                        <div className="flex h-40 flex-col items-center justify-center text-sm text-muted-foreground">
                            <p>Очікуємо на нові OSINT-повідомлення…</p>
                            <p className="mt-1 text-xs">
                                Переконайтесь, що бекенд та osint-worker запущені.
                            </p>
                        </div>
                    )}

                  {items.map((entry) => {
                    const { source, item } = entry
                    const credibilityPercent =
                      typeof item.credibility === 'number'
                        ? Math.round(item.credibility * 100)
                        : null

                    const dedup = getDedupInfo(item.meta)

                    return (
                      <Card
                        key={entry.id + item.externalId}
                        className="border-border/60 bg-background/80 px-3 py-2"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex flex-1 flex-col gap-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  'border px-2 py-0.5 text-[11px] font-medium',
                                  sourceCategoryColor(source.category),
                                )}
                              >
                                {source.name}
                                {source.category && ` · ${source.category}`}
                              </Badge>

                              {item.priority && (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'border px-2 py-0.5 text-[11px] font-semibold uppercase',
                                    priorityColor(item.priority),
                                  )}
                                >
                                  {item.priority}
                                </Badge>
                              )}

                              {credibilityPercent !== null && (
                                <Badge
                                  variant="outline"
                                  className="border px-2 py-0.5 text-[11px] text-muted-foreground"
                                >
                                  cred: {credibilityPercent}%
                                </Badge>
                              )}

                              {dedup?.matchedEventId && (
                                <Badge
                                  variant="outline"
                                  className="border px-2 py-0.5 text-[11px] text-emerald-600"
                                >
                                  MERGED → event {dedup.matchedEventId.slice(0, 8)}
                                  {typeof dedup.qdrantScore === 'number' &&
                                    ` (score ${dedup.qdrantScore.toFixed(2)})`}
                                </Badge>
                              )}

                              {dedup?.createdEventId && (
                                <Badge
                                  variant="outline"
                                  className="border px-2 py-0.5 text-[11px] text-sky-600"
                                >
                                  NEW EVENT → {dedup.createdEventId.slice(0, 8)}
                                </Badge>
                              )}
                            </div>


                            {item.title && (
                                            <h2 className="text-sm font-semibold leading-snug">
                                                {item.title}
                                            </h2>
                                        )}

                                        <p className="line-clamp-3 text-xs text-muted-foreground">
                                            {item.summary || item.content}
                                        </p>

                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                            <span>Подія: {formatDate(item.eventDate)}</span>
                                            <span>Парсинг: {formatDate(item.parseDate)}</span>
                                            {item.type && (
                                                <span className="rounded bg-muted px-1 py-0.5 text-[10px] uppercase">
                          {item.type}
                        </span>
                                            )}
                                            {item.tags && item.tags.length > 0 && (
                                                <span className="flex flex-wrap gap-1">
                          {item.tags.slice(0, 4).map((t) => (
                              <span
                                  key={t}
                                  className="rounded bg-muted px-1 py-0.5 text-[10px]"
                              >
                              #{t}
                            </span>
                          ))}
                        </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-1 text-[11px] text-muted-foreground">
                                        {item.rawUrl && (
                                            <a
                                                href={item.rawUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="rounded border px-2 py-1 text-[11px] hover:bg-muted"
                                            >
                                                Відкрити джерело
                                            </a>
                                        )}
                                        {item.mediaUrl && item.mediaUrl !== item.rawUrl && (
                                            <a
                                                href={item.mediaUrl}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="rounded border px-2 py-1 text-[11px] hover:bg-muted"
                                            >
                                                Медіа
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        )
                    })}
                </div>
            </Main>
        </>
    )
}