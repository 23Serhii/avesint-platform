// src/features/settings/ai/index.tsx
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
    listOsintSources,
    createOsintSource,
    updateOsintSource,
    deleteOsintSource,
    type OsintSource,
} from '@/lib/api/osint-sources'
import { toast } from 'sonner'

type AiSettings = {
    assistantEnabled: boolean
}

const LS_KEY = 'avesint.ai.settings'

function loadSettings(): AiSettings {
    try {
        const raw = localStorage.getItem(LS_KEY)
        if (raw) return JSON.parse(raw)
    } catch {}
    return {
        assistantEnabled:
            (import.meta.env.VITE_FEATURE_AI_ASSISTANT ?? 'false') === 'true',
    }
}

function saveSettings(s: AiSettings) {
    try {
        localStorage.setItem(LS_KEY, JSON.stringify(s))
    } catch {}
}

function isAiEnabledForEvents(src: OsintSource): boolean {
    // за замовчуванням true, якщо явно не вимкнули
    return src.meta?.aiEnabledForEvents !== false
}

export function SettingsAI() {
    const [settings, setSettings] = useState<AiSettings>(loadSettings())
    const [saved, setSaved] = useState(false)

    const [sources, setSources] = useState<OsintSource[]>([])
    const [sourcesLoading, setSourcesLoading] = useState(false)
    const [sourcesError, setSourcesError] = useState<string | null>(null)

    const [newUrl, setNewUrl] = useState('')
    const [newCategory, setNewCategory] = useState<string>('')
    const [creating, setCreating] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [togglingId, setTogglingId] = useState<string | null>(null)

    useEffect(() => {
        setSaved(false)
    }, [settings])

    const reloadSources = async () => {
        try {
            setSourcesLoading(true)
            setSourcesError(null)
            const srcs = await listOsintSources()
            // активні спочатку
            srcs.sort((a, b) => {
                if (a.isActive === b.isActive) {
                    return (a.name || '').localeCompare(b.name || '')
                }
                return a.isActive ? -1 : 1
            })
            setSources(srcs)
        } catch {
            setSourcesError('Не вдалося завантажити список джерел OSINT')
        } finally {
            setSourcesLoading(false)
        }
    }

    useEffect(() => {
        void reloadSources()
    }, [])

    const handleSave = () => {
        saveSettings(settings)
        setSaved(true)
    }

    const handleCreateSource = async () => {
        const url = newUrl.trim()
        if (!url) return

        try {
            setCreating(true)
            const created = await createOsintSource({
                url,
                category: newCategory.trim() || undefined,
                isActive: true,
            })
            toast.success(`Джерело ${created.handle || created.name} додано`)

            setNewUrl('')
            setNewCategory('')

            await reloadSources()
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e)
            toast.error('Не вдалося додати джерело. Перевірте посилання.')
        } finally {
            setCreating(false)
        }
    }

    const handleToggleAiForSource = async (src: OsintSource) => {
        const current = isAiEnabledForEvents(src)
        const next = !current
        try {
            setTogglingId(src.id)
            await updateOsintSource(src.id, {
                meta: {
                    ...(src.meta ?? {}),
                    aiEnabledForEvents: next,
                },
            })
            await reloadSources()
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error(e)
            toast.error('Не вдалося оновити AI‑налаштування джерела')
        } finally {
            setTogglingId(null)
        }
    }

    const handleToggleActive = async (src: OsintSource) => {
        const next = !src.isActive
        try {
            await updateOsintSource(src.id, { isActive: next })
            await reloadSources()
        } catch {
            toast.error('Не вдалося змінити активність джерела')
        }
    }

    const handleDeleteSource = async (src: OsintSource) => {
        if (!window.confirm(`Видалити джерело "${src.handle || src.name}"?`)) return
        try {
            setDeletingId(src.id)
            await deleteOsintSource(src.id)
            await reloadSources()
        } catch {
            toast.error('Не вдалося видалити джерело')
        } finally {
            setDeletingId(null)
        }
    }

    const handleEnableAiForAll = async () => {
        try {
            setTogglingId('__all__')
            await Promise.all(
                sources.map((s) =>
                    updateOsintSource(s.id, {
                        meta: {
                            ...(s.meta ?? {}),
                            aiEnabledForEvents: true,
                        },
                    }),
                ),
            )
            await reloadSources()
        } catch {
            toast.error('Не вдалося увімкнути AI для всіх джерел')
        } finally {
            setTogglingId(null)
        }
    }

    return (
        <div className="w-full">
            <div className="space-y-1">
                <h2 className="text-xl font-semibold">AI налаштування</h2>
                <p className="text-muted-foreground text-sm">
                    Керування AI‑асистентом та джерелами OSINT, які він використовує для
                    класифікації та аналітики.
                </p>
            </div>
            <Separator className="my-4" />

            <div className="grid gap-4 md:max-w-4xl">
                {/* AI‑асистент */}
                <Card className="space-y-3 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <Label className="text-sm">AI‑асистент</Label>
                            <p className="text-xs text-muted-foreground">
                                Вмикає панель AI на сторінках.
                            </p>
                        </div>
                        <Switch
                            checked={settings.assistantEnabled}
                            onCheckedChange={(v) =>
                                setSettings((s) => ({ ...s, assistantEnabled: Boolean(v) }))
                            }
                        />
                    </div>
                </Card>

                {/* Додавання нового ТГ‑каналу */}
                <Card className="space-y-3 p-4">
                    <div className="space-y-1">
                        <Label className="text-sm">Додати Telegram‑канал</Label>
                        <p className="text-xs text-muted-foreground">
                            Вставте посилання на канал або @handle. Після збереження воркер
                            почне слухати цей канал.
                        </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
                        <div>
                            <Label className="mb-1 block text-xs text-muted-foreground">
                                Посилання / @handle
                            </Label>
                            <Input
                                placeholder="https://t.me/some_channel або @some_channel"
                                value={newUrl}
                                onChange={(e) => setNewUrl(e.target.value)}
                            />
                        </div>

                        <div>
                            <Label className="mb-1 block text-xs text-muted-foreground">
                                Категорія (опційно)
                            </Label>
                            <Input
                                placeholder="enemy-prop / osint-team / official…"
                                value={newCategory}
                                onChange={(e) => setNewCategory(e.target.value)}
                            />
                        </div>

                        <div className="flex items-end">
                            <Button
                                type="button"
                                onClick={handleCreateSource}
                                disabled={creating || !newUrl.trim()}
                            >
                                {creating ? 'Додаємо…' : 'Додати'}
                            </Button>
                        </div>
                    </div>
                </Card>

                {/* Загальний список джерел */}
                <Card className="space-y-3 p-4">
                    <div className="flex items-center justify-between gap-2">
                        <div>
                            <Label className="text-sm">Джерела OSINT</Label>
                            <p className="text-xs text-muted-foreground">
                                Повний список джерел. Можна вмикати/вимикати участь у AI‑аналізі,
                                активність джерела, а також видаляти джерела.
                            </p>
                        </div>
                        {/* <Button
                            variant="outline"
                            size="sm"
                            onClick={handleEnableAiForAll}
                            disabled={sources.length === 0 || togglingId === '__all__'}
                        >
                            {togglingId === '__all__' ? 'Оновлення…' : 'AI для всіх'}
                        </Button> */}
                    </div>

                    {sourcesLoading && (
                        <p className="text-xs text-muted-foreground">
                            Завантаження списку джерел…
                        </p>
                    )}

                    {sourcesError && (
                        <p className="text-xs text-red-500">{sourcesError}</p>
                    )}

                    {!sourcesLoading && !sourcesError && (
                        <>
                            {sources.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                    Джерел поки немає.
                                </p>
                            ) : (
                                <div className="flex max-h-80 flex-col gap-2 overflow-auto rounded-md border bg-muted/40 p-2">
                                    {sources.map((s) => {
                                        const aiEnabled = isAiEnabledForEvents(s)
                                        return (
                                            <div
                                                key={s.id}
                                                className={cn(
                                                    'flex items-center justify-between gap-2 rounded-md border px-2 py-1 text-xs',
                                                    s.isActive
                                                        ? 'border-border bg-background'
                                                        : 'border-dashed border-border/60 bg-muted/40 opacity-75',
                                                )}
                                            >
                                                <div className="flex flex-col">
                                                    <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {s.handle || s.name}
                            </span>
                                                        {s.isActive ? (
                                                            <Badge variant="outline" className="text-[10px]">
                                                                активне
                                                            </Badge>
                                                        ) : (
                                                            <Badge
                                                                variant="outline"
                                                                className="text-[10px]"
                                                            >
                                                                неактивне
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                                                        <span>{s.type || 'джерело'}</span>
                                                        {s.category && (
                                                            <>
                                                                <span>•</span>
                                                                <span>{s.category}</span>
                                                            </>
                                                        )}
                                                        {s.url && (
                                                            <>
                                                                <span>•</span>
                                                                <a
                                                                    href={s.url}
                                                                    target="_blank"
                                                                    rel="noreferrer"
                                                                    className="max-w-[260px] truncate text-blue-600 hover:underline"
                                                                >
                                                                    {s.url}
                                                                </a>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="h-7 px-2 text-[10px]"
                                                        onClick={() => handleToggleActive(s)}
                                                    >
                                                        {s.isActive ? 'Деактивувати' : 'Активувати'}
                                                    </Button>
                                                    {/* <Button
                                                        variant={aiEnabled ? 'default' : 'outline'}
                                                        size="sm"
                                                        className="h-7 px-2 text-[10px]"
                                                        onClick={() => handleToggleAiForSource(s)}
                                                        disabled={togglingId === s.id}
                                                    >
                                                        {togglingId === s.id
                                                            ? 'Оновлення…'
                                                            : aiEnabled
                                                                ? 'AI: увімкнено'
                                                                : 'AI: вимкнено'}
                                                    </Button> */}
                                                    <Button
                                                        variant="destructive"
                                                        size="sm"
                                                        className="h-7 px-2 text-[10px]"
                                                        onClick={() => handleDeleteSource(s)}
                                                        disabled={deletingId === s.id}
                                                    >
                                                        {deletingId === s.id ? 'Видалення…' : 'Видалити'}
                                                    </Button>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </>
                    )}

                    <div className="mt-2 flex items-center gap-2">
                        <Button size="sm" onClick={handleSave}>
                            Зберегти
                        </Button>
                        {saved && (
                            <div className="text-xs text-emerald-600">Збережено</div>
                        )}
                    </div>
                </Card>
            </div>
        </div>
    )
}

export default SettingsAI