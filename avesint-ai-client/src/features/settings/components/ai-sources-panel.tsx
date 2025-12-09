// src/features/settings/components/ai-sources-panel.tsx
'use client'

import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { OsintSource } from '@/lib/api/osint-sources'

type AiSourcesPanelProps = {
  aiEnabled: boolean
  onAiEnabledChange: (value: boolean) => void
  availableSources: OsintSource[]
  selectedSourceIds: string[]
  onSelectedSourceIdsChange: (ids: string[]) => void
  sourcesLoading: boolean
  sourcesError: string | null
}

export function AiSourcesPanel({
                                 aiEnabled,
                                 onAiEnabledChange,
                                 availableSources,
                                 selectedSourceIds,
                                 onSelectedSourceIdsChange,
                                 sourcesLoading,
                                 sourcesError,
                               }: AiSourcesPanelProps) {
  const allSelected =
    availableSources.length > 0 &&
    selectedSourceIds.length === availableSources.length

  const toggleSource = (id: string) => {
    onSelectedSourceIdsChange(
      selectedSourceIds.includes(id)
        ? selectedSourceIds.filter((x) => x !== id)
        : [...selectedSourceIds, id],
    )
  }

  return (
    <Card className="p-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Ліва частина: загальний тумблер AI */}
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <Checkbox
              id="ai-enabled-events"
              checked={aiEnabled}
              onCheckedChange={(v) => onAiEnabledChange(Boolean(v))}
            />
            <label
              htmlFor="ai-enabled-events"
              className="cursor-pointer font-medium"
            >
              AI‑класифікація нових подій
            </label>
          </div>
          <p className="text-muted-foreground">
            Якщо увімкнено — нові OSINT‑події з вибраних джерел потрапляють у ревʼю
            та позначаються категоріями/пріоритетами.
          </p>
        </div>

        {/* Права частина: конкретні джерела */}
        <div className="flex flex-col gap-2 text-xs md:w-[360px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Джерела для AI:</span>
            <Select
              value={allSelected ? 'all' : 'selected'}
              onValueChange={(v) => {
                if (v === 'all') {
                  onSelectedSourceIdsChange(availableSources.map((s) => s.id))
                }
                // 'selected' — просто режим, сам список не чіпаємо
              }}
            >
              <SelectTrigger className="h-8 w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Усі активні</SelectItem>
                <SelectItem value="selected">Лише вибрані</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded border bg-muted/40 p-2">
            {sourcesLoading && (
              <p className="text-[11px] text-muted-foreground">
                Завантаження списку джерел…
              </p>
            )}
            {sourcesError && (
              <p className="text-[11px] text-red-500">{sourcesError}</p>
            )}
            {!sourcesLoading && !sourcesError && (
              <>
                <p className="mb-1 text-[11px] text-muted-foreground">
                  Активні джерела OSINT:
                </p>
                <div className="flex max-h-32 flex-wrap gap-1 overflow-auto">
                  {availableSources.map((s) => {
                    const checked = selectedSourceIds.includes(s.id)
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSource(s.id)}
                        className={cn(
                          'rounded-full border px-2 py-0.5 text-[11px]',
                          checked
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'bg-background text-muted-foreground',
                        )}
                      >
                        {s.handle || s.name}
                      </button>
                    )
                  })}
                  {availableSources.length === 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      Немає активних джерел.
                    </span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Card>
  )
}