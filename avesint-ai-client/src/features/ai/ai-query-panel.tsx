// src/features/ai/ai-query-panel.tsx
'use client'

import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'
import { aiQuery, type AiQueryResponse } from '@/lib/api/ai-query'

function renderSimpleMarkdown(md: string): string {
  const lines = md.split(/\r?\n/)
  const htmlParts: string[] = []
  let currentList: string[] = []

  const flushList = () => {
    if (currentList.length === 0) return
    htmlParts.push('<ul class="list-disc pl-4 mb-1">')
    for (const item of currentList) {
      htmlParts.push(`<li>${item}</li>`)
    }
    htmlParts.push('</ul>')
    currentList = []
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      flushList()
      continue
    }

    if (line.startsWith('### ')) {
      flushList()
      const text = line.slice(4).trim()
      htmlParts.push(`<h3 class="font-semibold mb-1">${text}</h3>`)
      continue
    }

    if (line.startsWith('#### ')) {
      flushList()
      const text = line.slice(5).trim()
      htmlParts.push(`<h4 class="font-semibold mb-1">${text}</h4>`)
      continue
    }

    if (line.startsWith('- ') || line.startsWith('* ')) {
      const text = line.slice(2).trim()
      currentList.push(text)
      continue
    }

    flushList()
    htmlParts.push(`<p class="mb-1">${line}</p>`)
  }

  flushList()
  return htmlParts.join('\n')
}

export function AiQueryPanel() {
  const router = useRouter()

  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<AiQueryResponse | null>(null)

  const handleSubmit = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await aiQuery({
        query,
        mode: 'analysis',
        scope: { includeEvents: true },
        // ВАЖЛИВО: не передаємо time => бекенд застосує дефолт "останні 60 хв"
        language: 'uk',
        topKPerType: 20,
      })
      setResult(res)
    } catch (e: any) {
      setError(e?.message ?? 'Помилка запиту до AI')
    } finally {
      setLoading(false)
    }
  }

  const handleActionClick = (idx: number) => {
    if (!result) return
    const action = result.suggestedActions[idx]
    // eslint-disable-next-line no-console
    console.log('[AI] Suggested action clicked:', action)
  }

  const handleCitationClick = async (id: string) => {
    // переходимо на сторінку подій з eventId у query
    await router.navigate({
      to: '/events',
      search: (prev) => ({
        ...prev,
        eventId: id,
      }),
    })
  }

  return (
    <Card className="border bg-background/80">
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2 text-sm">
          <span>AI‑аналіз подій платформи</span>
          {result?.meta?.model && (
            <Badge variant="outline" className="text-[10px]">
              {result.meta.model}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Textarea
            rows={3}
            placeholder="Наприклад: Зроби підсумок по подіям за останню годину…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex items-center justify-between gap-2">
            <Button
              size="sm"
              disabled={loading || !query.trim()}
              onClick={handleSubmit}
            >
              {loading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Запит до AI
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-2 space-y-3">
            <div className="rounded-md border bg-muted/40 p-3">
              <div
                className={cn(
                  'prose prose-xs max-w-none dark:prose-invert',
                  'prose-p:my-1 prose-ul:my-1 prose-li:my-0.5',
                )}
                dangerouslySetInnerHTML={{
                  __html: renderSimpleMarkdown(result.answer),
                }}
              />
            </div>

            {result.citations.length > 0 && (
              <div className="space-y-1">
                <div className="text-[11px] font-medium text-muted-foreground">
                  Використані події:
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {result.citations.map((c) => (
                    <Badge
                      key={`${c.type}:${c.id}`}
                      variant="outline"
                      className="cursor-pointer text-[10px]"
                      onClick={() => handleCitationClick(c.id)}
                    >
                      #{c.id.slice(0, 8)} {c.title ?? ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {result.suggestedActions.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-medium text-muted-foreground">
                  Рекомендовані дії:
                </div>
                <div className="space-y-1.5">
                  {result.suggestedActions.map((a, idx) => (
                    <div
                      key={`${a.type}-${idx}`}
                      className="flex items-start justify-between gap-2 rounded-md border bg-background/60 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="text-[10px] uppercase"
                          >
                            {a.type === 'create_task'
                              ? 'Задача'
                              : a.type === 'create_target'
                                ? 'Ціль'
                                : 'Звіт'}
                          </Badge>
                          <span className="truncate text-xs font-medium">
                            {a.title}
                          </span>
                        </div>
                        {a.description && (
                          <p className="text-[11px] text-muted-foreground">
                            {a.description}
                          </p>
                        )}
                        {a.relatedItems && a.relatedItems.length > 0 && (
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            Повʼязані обʼєкти:{' '}
                            {a.relatedItems
                              .map((r) => `${r.type}#${r.id.slice(0, 8)}`)
                              .join(', ')}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        className="h-7 shrink-0 px-2 text-[10px]"
                        onClick={() => handleActionClick(idx)}
                      >
                        Виконати
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}