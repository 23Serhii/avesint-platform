import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { Search as GlobalSearch } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { ConfigDrawer } from '@/components/config-drawer'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
    listStream,
    reviewStreamItem,
    type IntelligenceItemDto,
    type IntelligenceItemType,
    type ReviewStreamPayload,
} from '@/lib/api/stream'
import { toast } from 'sonner'

// --- Типи та утиліти ---

// статуси ТАКІ САМІ, як на бекенді
type ReviewBaseStatus = 'pending' | 'confirmed' | 'disproved'
type ReviewStatusFilter = ReviewBaseStatus | 'all'
type ReviewPriorityFilter = 'critical' | 'high' | 'medium' | 'low' | 'all'

type AiClassification = NonNullable<IntelligenceItemDto['aiClassification']>

type ReviewItem = IntelligenceItemDto & {
    reviewComment?: string
}

type AnalystDecision = {
    status: ReviewBaseStatus
    priority: 'P0' | 'P1' | 'P2' | 'P3'
    tags: string[]
    comment: string
}

const STATUS_TEXT: Record<ReviewBaseStatus, string> = {
    pending: 'Очікує ревʼю',
    confirmed: 'Підтверджено',
    disproved: 'Спростовано',
}

const STATUS_VARIANT: Record<ReviewBaseStatus, 'default' | 'secondary' | 'outline'> = {
    pending: 'outline',
    confirmed: 'default',
    disproved: 'secondary',
}

const PRIORITY_TEXT: Record<ReviewPriorityFilter, string> = {
    critical: 'Критичний',
    high: 'Високий',
    medium: 'Середній',
    low: 'Низький',
    all: 'Усі',
}

const TYPE_TEXT: Record<IntelligenceItemType | 'all', string> = {
    event: 'Події',
    osint: 'OSINT',
    all: 'Усі типи',
}

// нормалізуємо будь-який status у події до очікуваних трьох
function normalizeStatus(status: IntelligenceItemDto['status']): ReviewBaseStatus {
    if (status === 'confirmed') return 'confirmed'
    if (status === 'disproved') return 'disproved'
    return 'pending'
}

function priorityFromConfidence(
    confidence: number | null | undefined,
): Exclude<ReviewPriorityFilter, 'all'> {
    const c = confidence ?? 0
    if (c >= 0.85) return 'critical'
    if (c >= 0.6) return 'high'
    if (c >= 0.3) return 'medium'
    return 'low'
}

function buildExternalLink(ref: string | null | undefined): string | null {
    if (!ref) return null
    if (/^https?:\/\//i.test(ref)) return ref
    if (ref.startsWith('telegram:')) {
        const [, channel, msgId] = ref.split(':')
        if (channel && msgId) {
            return `https://t.me/${channel}/${msgId}`
        }
    }
    return null
}

// --- Компонент сторінки ревʼю ---

export function ReviewPage() {
    const queryClient = useQueryClient()

    // фільтри
    const [statusFilter, setStatusFilter] = useState<ReviewStatusFilter>('pending')
    const [priorityFilter, setPriorityFilter] = useState<ReviewPriorityFilter>('all')
    const [typeFilter, setTypeFilter] = useState<IntelligenceItemType | 'all'>('all')
    const [search, setSearch] = useState('')
    const [selectedId, setSelectedId] = useState<string | null>(null)

    const [categoryFilter, setCategoryFilter] = useState<AiClassification['mainCategory'] | 'all'>(
        'all',
    )
    const [threatFilter, setThreatFilter] = useState<AiClassification['threatLevel'] | 'all'>('all')
    const [eventKindFilter, setEventKindFilter] = useState<AiClassification['eventKind'] | 'all'>(
        'all',
    )

    // рішення аналітика
    const [decision, setDecision] = useState<AnalystDecision | null>(null)

    // --- Завантаження стріму з бекенда ---
    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ['review-stream', { statusFilter, typeFilter }],
        queryFn: async () => {
            const res = await listStream({
                page: 1,
                limit: 100,
                status: statusFilter === 'all' ? undefined : statusFilter, // ← бекенд бачить pending/confirmed/disproved
                type: typeFilter === 'all' ? undefined : typeFilter,
            })
            return res.items as ReviewItem[]
        },
    })

    const items = data ?? []

    const selected = useMemo(
        () => items.find((i) => i.id === selectedId) ?? items[0] ?? null,
        [items, selectedId],
    )

    // ініціалізуємо рішення аналітика при виборі айтема
    useEffect(() => {
        if (!selected) {
            setDecision(null)
            return
        }

        const ai = selected.aiClassification ?? null
        const baseStatus = normalizeStatus(selected.status)
        const aiPriorityBand = priorityFromConfidence(selected.confidence)

        const mappedPriority: AnalystDecision['priority'] =
            ai?.priority ??
            (aiPriorityBand === 'critical'
                ? 'P0'
                : aiPriorityBand === 'high'
                    ? 'P1'
                    : aiPriorityBand === 'medium'
                        ? 'P2'
                        : 'P3')

        setDecision({
            status: baseStatus,
            priority: mappedPriority,
            tags: ai?.tags ?? (Array.isArray(selected.tags) ? selected.tags : []),
            comment: '',
        })
    }, [selected])

    // --- Клієнтська фільтрація ---
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase()

        return items.filter((i) => {
            if (q) {
                const text = ((i.title ?? '') + ' ' + (i.summary ?? '') + ' ' + (i.source ?? '')).toLowerCase()
                if (!text.includes(q)) return false
            }

            if (priorityFilter !== 'all') {
                const band = priorityFromConfidence(i.confidence)
                if (band !== priorityFilter) return false
            }

            const cl = i.aiClassification

            if (categoryFilter !== 'all') {
                if (!cl || cl.mainCategory !== categoryFilter) return false
            }

            if (threatFilter !== 'all') {
                if (!cl || cl.threatLevel !== threatFilter) return false
            }

            if (eventKindFilter !== 'all') {
                if (!cl || cl.eventKind !== eventKindFilter) return false
            }

            return true
        })
    }, [items, search, priorityFilter, categoryFilter, threatFilter, eventKindFilter])

    const handleSelect = (id: string) => {
        setSelectedId(id)
    }

    // прийняти пропозицію AI → просто заповнити форму рішення
    const handleAcceptAi = () => {
        if (!selected) return
        const ai = selected.aiClassification
        if (!ai) {
            toast.info('Для цього елемента AI‑класифікація ще не доступна')
            return
        }

        setDecision((prev) => ({
            status: normalizeStatus(selected.status),
            priority: ai.priority,
            tags: ai.tags.slice(),
            comment: prev?.comment ?? '',
        }))
    }

    // --- Мутація для збереження рішення ---
    const reviewMutation = useMutation({
        mutationFn: async (payload: { id: string; body: ReviewStreamPayload }) =>
            reviewStreamItem(payload.id, payload.body),
        onSuccess: () => {
            toast.success('Рішення по події збережено')
            // перезавантажимо список; елементи з іншим статусом зникнуть з поточного фільтра
            void queryClient.invalidateQueries({ queryKey: ['review-stream'] })
        },
        onError: () => {
            toast.error('Не вдалося зберегти рішення по події')
        },
    })

    const handleSaveDecision = () => {
        if (!selected || !decision) return

        const payload: ReviewStreamPayload = {
            status: decision.status, // 'pending' | 'confirmed' | 'disproved' – прямо те, що очікує бек
            priority: decision.priority,
            tags: decision.tags,
            comment: decision.comment || undefined,
        }

        reviewMutation.mutate({ id: selected.id, body: payload })
    }

    // --- UI ---

    return (
        <>
            <Header fixed>
                <GlobalSearch />
                <div className="ms-auto flex items-center space-x-4">
                    <ThemeSwitch />
                    <ConfigDrawer />
                    <ProfileDropdown />
                </div>
            </Header>

            <Main className="flex flex-1 flex-col gap-4 lg:gap-6">
                {/* Заголовок */}
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">Ревʼю / верифікація розвідданих</h1>
                        <p className="max-w-2xl text-sm text-muted-foreground">
                            AI пропонує класифікацію та пріоритет, аналітик приймає рішення і фіксує його.
                        </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void refetch()}>
                        Оновити
                    </Button>
                </div>

                {/* Верхня панель фільтрів */}
                <Card className="px-3 py-2">
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Статус */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Статус:</span>
                            <Select
                                value={statusFilter}
                                onValueChange={(v: ReviewStatusFilter) => setStatusFilter(v)}
                            >
                                <SelectTrigger className="h-8 w-40 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Очікує ревʼю</SelectItem>
                                    <SelectItem value="confirmed">Підтверджено</SelectItem>
                                    <SelectItem value="disproved">Спростовано</SelectItem>
                                    <SelectItem value="all">Усі</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Тип */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Тип:</span>
                            <Select
                                value={typeFilter}
                                onValueChange={(v: IntelligenceItemType | 'all') => setTypeFilter(v)}
                            >
                                <SelectTrigger className="h-8 w-32 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{TYPE_TEXT.all}</SelectItem>
                                    <SelectItem value="event">{TYPE_TEXT.event}</SelectItem>
                                    <SelectItem value="osint">{TYPE_TEXT.osint}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Пріоритет (по довірі AI) */}
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Пріоритет (AI):</span>
                            <Select
                                value={priorityFilter}
                                onValueChange={(v: ReviewPriorityFilter) => setPriorityFilter(v)}
                            >
                                <SelectTrigger className="h-8 w-40 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">{PRIORITY_TEXT.all}</SelectItem>
                                    <SelectItem value="critical">{PRIORITY_TEXT.critical}</SelectItem>
                                    <SelectItem value="high">{PRIORITY_TEXT.high}</SelectItem>
                                    <SelectItem value="medium">{PRIORITY_TEXT.medium}</SelectItem>
                                    <SelectItem value="low">{PRIORITY_TEXT.low}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Пошук */}
                        <div className="ms-auto flex items-center gap-2">
                            <Input
                                placeholder="Пошук по заголовку, summary, джерелу…"
                                className="h-8 w-56 text-xs"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* AI-фільтри */}
                    <div className="mt-2 flex flex-wrap items-center gap-3 border-t pt-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Категорія AI:</span>
                            <Select
                                value={categoryFilter}
                                onValueChange={(v) =>
                                    setCategoryFilter(v as AiClassification['mainCategory'] | 'all')
                                }
                            >
                                <SelectTrigger className="h-8 w-44 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Усі</SelectItem>
                                    <SelectItem value="military_activity">Військова активність</SelectItem>
                                    <SelectItem value="strikes_threats">Удари / загрози</SelectItem>
                                    <SelectItem value="infrastructure">Інфраструктура / обʼєкти</SelectItem>
                                    <SelectItem value="territorial">Територіальні події</SelectItem>
                                    <SelectItem value="political_info">Політична / інф. активність</SelectItem>
                                    <SelectItem value="social">Соціальні / цивільні</SelectItem>
                                    <SelectItem value="technical_meta">Технічні / метадані</SelectItem>
                                    <SelectItem value="other">Інше</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Рівень загрози:</span>
                            <Select
                                value={threatFilter}
                                onValueChange={(v) =>
                                    setThreatFilter(v as AiClassification['threatLevel'] | 'all')
                                }
                            >
                                <SelectTrigger className="h-8 w-32 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Усі</SelectItem>
                                    <SelectItem value="low">Низький</SelectItem>
                                    <SelectItem value="medium">Середній</SelectItem>
                                    <SelectItem value="high">Високий</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">Тип події:</span>
                            <Select
                                value={eventKindFilter}
                                onValueChange={(v) =>
                                    setEventKindFilter(v as AiClassification['eventKind'] | 'all')
                                }
                            >
                                <SelectTrigger className="h-8 w-40 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Усі</SelectItem>
                                    <SelectItem value="fact">Факт</SelectItem>
                                    <SelectItem value="assessment">Оцінка</SelectItem>
                                    <SelectItem value="assumption">Припущення</SelectItem>
                                    <SelectItem value="forecast">Прогноз</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </Card>

                {/* Стан завантаження / помилок */}
                {isLoading && (
                    <div className="text-xs text-muted-foreground">Завантаження елементів ревʼю…</div>
                )}
                {isError && (
                    <div className="text-xs text-red-500">Не вдалося завантажити стрім для ревʼю.</div>
                )}

                {/* Основна сітка */}
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)] lg:gap-6">
                    {/* Ліва колонка: список */}
                    <Card className="max-h-[640px] overflow-hidden">
                        <div className="border-b px-3 py-2 text-xs text-muted-foreground">
                            {filtered.length} елементів на ревʼю
                        </div>
                        <div className="h-[600px] overflow-auto">
                            {filtered.map((item) => {
                                const normStatus = normalizeStatus(item.status)
                                return (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => handleSelect(item.id)}
                                        className={cn(
                                            'flex w-full flex-col gap-1 border-b px-3 py-2 text-left text-xs',
                                            (selected?.id ?? null) === item.id
                                                ? 'bg-muted/80'
                                                : 'hover:bg-muted/40',
                                        )}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                      <span className="line-clamp-2 text-sm font-medium">
                        {item.title ?? 'Без назви'}
                      </span>
                                            <Badge
                                                variant={STATUS_VARIANT[normStatus]}
                                                className="shrink-0 text-[10px]"
                                            >
                                                {STATUS_TEXT[normStatus]}
                                            </Badge>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                            {item.type && (
                                                <span className="rounded bg-muted px-1 py-0.5 text-[10px] uppercase">
                          {item.type}
                        </span>
                                            )}
                                            {typeof item.confidence === 'number' && (
                                                <span>conf: {Math.round(item.confidence * 100)}%</span>
                                            )}
                                            {item.source && (
                                                <span className="line-clamp-1">Джерело: {item.source}</span>
                                            )}
                                            {item.time && (
                                                <span className="ms-auto">
                          {new Date(item.time).toLocaleString('uk-UA', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                          })}
                        </span>
                                            )}
                                        </div>
                                        {Array.isArray(item.tags) && item.tags.length > 0 && (
                                            <div className="mt-1 flex flex-wrap gap-1">
                                                {item.tags.slice(0, 4).map((t) => (
                                                    <Badge
                                                        key={t}
                                                        variant="outline"
                                                        className="px-1.5 py-0 text-[10px]"
                                                    >
                                                        #{t}
                                                    </Badge>
                                                ))}
                                            </div>
                                        )}
                                    </button>
                                )
                            })}

                            {filtered.length === 0 && !isLoading && (
                                <div className="flex h-40 items-center justify-center text-xs text-muted-foreground">
                                    Немає елементів для поточних фільтрів.
                                </div>
                            )}
                        </div>
                    </Card>

                    {/* Права колонка: панель ревʼю */}
                    <Card className="flex min-h-[400px] flex-col gap-3 p-3 lg:p-4">
                        {!selected || !decision ? (
                            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                                Оберіть елемент зі списку ліворуч для верифікації.
                            </div>
                        ) : (
                            <>
                                {/* Заголовок + метадані */}
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div className="space-y-1">
                                        <h2 className="text-base font-semibold leading-snug">
                                            {selected.title ?? 'Без назви'}
                                        </h2>
                                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                            {selected.source && <span>{selected.source}</span>}
                                            {selected.type && (
                                                <>
                                                    <span>·</span>
                                                    <span className="rounded bg-muted px-1 py-0.5 text-[10px] uppercase">
                            {selected.type}
                          </span>
                                                </>
                                            )}
                                            {selected.time && (
                                                <>
                                                    <span>·</span>
                                                    <span>
                            Час:{' '}
                                                        {new Date(selected.time).toLocaleString('uk-UA', {
                                                            dateStyle: 'short',
                                                            timeStyle: 'short',
                                                        })}
                          </span>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex flex-col items-end gap-1">
                                        <Badge
                                            variant={STATUS_VARIANT[normalizeStatus(selected.status)]}
                                            className="text-[10px]"
                                        >
                                            {STATUS_TEXT[normalizeStatus(selected.status)]}
                                        </Badge>
                                        {typeof selected.confidence === 'number' && (
                                            <Badge variant="outline" className="text-[10px]">
                                                Довіра AI: {Math.round(selected.confidence * 100)}%
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {/* Категоризація AI */}
                                {selected.aiClassification && (
                                    <div className="rounded-md border bg-muted/40 p-2 text-xs">
                                        <div className="mb-1 flex items-center justify-between">
                                            <span className="font-medium">Категоризація AI</span>
                                        </div>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                            <div>
                        <span className="text-[11px] text-muted-foreground">
                          Категорія:
                        </span>{' '}
                                                <span className="font-medium">
                          {selected.aiClassification.mainCategory}
                        </span>
                                            </div>
                                            <div>
                        <span className="text-[11px] text-muted-foreground">
                          Рівень загрози:
                        </span>{' '}
                                                <span className="font-medium">
                          {selected.aiClassification.threatLevel}
                        </span>
                                            </div>
                                            <div>
                        <span className="text-[11px] text-muted-foreground">
                          Пріоритет:
                        </span>{' '}
                                                <span className="font-medium">
                          {selected.aiClassification.priority}
                        </span>
                                            </div>
                                            <div>
                        <span className="text-[11px] text-muted-foreground">
                          Тип події:
                        </span>{' '}
                                                <span className="font-medium">
                          {selected.aiClassification.eventKind}
                        </span>
                                            </div>
                                            {selected.aiClassification.subCategories?.length > 0 && (
                                                <div className="sm:col-span-2">
                          <span className="text-[11px] text-muted-foreground">
                            Підкатегорії:
                          </span>{' '}
                                                    {selected.aiClassification.subCategories.join(', ')}
                                                </div>
                                            )}
                                            {selected.aiClassification.tags?.length > 0 && (
                                                <div className="sm:col-span-2">
                          <span className="text-[11px] text-muted-foreground">
                            Теги AI:
                          </span>{' '}
                                                    {selected.aiClassification.tags.map((t) => (
                                                        <Badge
                                                            key={t}
                                                            variant="outline"
                                                            className="me-1 px-1.5 py-0 text-[10px]"
                                                        >
                                                            #{t}
                                                        </Badge>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Пропозиція AI + кнопка прийняття */}
                                <div className="rounded-md border bg-muted/40 p-2 text-xs">
                                    <div className="mb-1 flex items-center justify-between">
                                        <span className="font-medium">Пропозиція AI</span>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-6 px-2 text-[11px]"
                                            onClick={handleAcceptAi}
                                        >
                                            Прийняти пропозицію AI
                                        </Button>
                                    </div>
                                    <div className="grid gap-2 sm:grid-cols-2">
                                        <div>
                      <span className="text-[11px] text-muted-foreground">
                        Статус:
                      </span>{' '}
                                            <span className="font-medium">
                        {STATUS_TEXT[normalizeStatus(selected.status)]}
                      </span>
                                        </div>
                                        <div>
                      <span className="text-[11px] text-muted-foreground">
                        Пріоритет (з довіри):
                      </span>{' '}
                                            <span className="font-medium">
                        {
                            PRIORITY_TEXT[
                                priorityFromConfidence(selected.confidence)
                                ]
                        }
                      </span>
                                        </div>
                                        <div className="sm:col-span-2">
                      <span className="text-[11px] text-muted-foreground">
                        Теги (AI):
                      </span>{' '}
                                            {selected.aiClassification &&
                                            selected.aiClassification.tags.length > 0 ? (
                                                selected.aiClassification.tags.map((t) => (
                                                    <Badge
                                                        key={t}
                                                        variant="outline"
                                                        className="me-1 px-1.5 py-0 text-[10px]"
                                                    >
                                                        #{t}
                                                    </Badge>
                                                ))
                                            ) : (
                                                <span>—</span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Рішення аналітика */}
                                <div className="space-y-2 text-xs">
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        {/* статус рішення */}
                                        <div className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Статус рішення
                      </span>
                                            <Select
                                                value={decision.status}
                                                onValueChange={(v: ReviewBaseStatus) =>
                                                    setDecision((d) => (d ? { ...d, status: v } : d))
                                                }
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pending">Очікує ревʼю</SelectItem>
                                                    <SelectItem value="confirmed">Підтверджено</SelectItem>
                                                    <SelectItem value="disproved">Спростовано</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        {/* пріоритет рішення */}
                                        <div className="space-y-1">
                      <span className="text-[11px] font-medium text-muted-foreground">
                        Пріоритет (рішення)
                      </span>
                                            <Select
                                                value={decision.priority}
                                                onValueChange={(v: AnalystDecision['priority']) =>
                                                    setDecision((d) => (d ? { ...d, priority: v } : d))
                                                }
                                            >
                                                <SelectTrigger className="h-8 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="P0">P0 — негайна увага</SelectItem>
                                                    <SelectItem value="P1">P1 — важливо</SelectItem>
                                                    <SelectItem value="P2">P2 — середнє</SelectItem>
                                                    <SelectItem value="P3">P3 — низьке</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>

                                    {/* робочі теги аналітика */}
                                    <div className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Робочі теги (через кому)
                    </span>
                                        <Input
                                            className="h-8 text-xs"
                                            value={decision.tags.join(', ')}
                                            onChange={(e) =>
                                                setDecision((d) =>
                                                    d
                                                        ? {
                                                            ...d,
                                                            tags: e.target.value
                                                                .split(',')
                                                                .map((t) => t.trim())
                                                                .filter(Boolean),
                                                        }
                                                        : d,
                                                )
                                            }
                                        />
                                    </div>

                                    {/* коментар аналітика */}
                                    <div className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Коментар аналітика
                    </span>
                                        <Textarea
                                            rows={3}
                                            className="text-xs"
                                            value={decision.comment}
                                            onChange={(e) =>
                                                setDecision((d) => (d ? { ...d, comment: e.target.value } : d))
                                            }
                                            placeholder="Що підтверджено / спростовано, додаткові джерела тощо…"
                                        />
                                    </div>

                                    {/* посилання на оригінал */}
                                    <div className="space-y-1">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Посилання на оригінал
                    </span>
                                        {(() => {
                                            const url = buildExternalLink(selected.externalRef)
                                            if (url) {
                                                return (
                                                    <a
                                                        href={url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="break-all text-[11px] text-blue-600 hover:underline"
                                                    >
                                                        {url}
                                                    </a>
                                                )
                                            }

                                            if (selected.externalRef) {
                                                return (
                                                    <div className="break-all text-[11px]">
                                                        {selected.externalRef}
                                                    </div>
                                                )
                                            }

                                            return (
                                                <div className="text-[11px] text-muted-foreground">
                                                    Немає зовнішнього ID / URL
                                                </div>
                                            )
                                        })()}
                                    </div>
                                </div>

                                {/* Зміст */}
                                <div className="space-y-1 text-xs">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    Зміст / summary
                  </span>
                                    {selected.summary && (
                                        <p className="text-[11px] text-muted-foreground">{selected.summary}</p>
                                    )}
                                    <div className="max-h-48 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-[11px]">
                                        {selected.title ?? selected.summary ?? '—'}
                                    </div>
                                </div>

                                <div className="mt-2 flex justify-end gap-2">
                                    <Button variant="outline" size="sm" onClick={handleAcceptAi}>
                                        Прийняти AI‑пропозицію
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSaveDecision}
                                        disabled={reviewMutation.isPending}
                                    >
                                        {reviewMutation.isPending ? 'Збереження…' : 'Зберегти рішення'}
                                    </Button>
                                </div>
                            </>
                        )}
                    </Card>
                </div>
            </Main>
        </>
    )
}