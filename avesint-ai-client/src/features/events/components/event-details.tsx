// src/features/events/components/event-details.tsx
import type { Event } from '@/features/events/data/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'

type Props = {
  event: Event
  open: boolean
  onOpenChange: (open: boolean) => void
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

export function EventDetails({ event, open, onOpenChange }: Props) {
  const handleClose = () => onOpenChange(false)

  const handleAnalyzeAI = async () => {
    await new Promise((r) => setTimeout(r, 800))
    toast.info('AI-аналіз події (заглушка)')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Метадані */}
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Важливість: {event.severity}</Badge>
            <Badge variant="outline">Статус: {event.status}</Badge>
            <span>
              Час:{' '}
              {new Date(event.occurredAt).toLocaleString('uk-UA', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </span>
            {event.incidentId && (
              <Badge variant="outline">Інцидент: {event.incidentId}</Badge>
            )}
          </div>

          {/* Координати (один раз) */}
          {event.latitude != null && event.longitude != null && (
            <div className="font-mono text-xs text-muted-foreground">
              Координати: {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
            </div>
          )}

          {/* Коротке резюме */}
          {event.summary && (
            <div className="rounded-md bg-muted/60 p-2 text-xs">
              <div className="mb-1 text-[11px] font-semibold uppercase text-muted-foreground">
                Коротке резюме
              </div>
              <div>{event.summary}</div>
            </div>
          )}

          {/* Розширений опис */}
          {event.description && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                Розширений опис
              </div>
              <p className="whitespace-pre-wrap text-xs">
                {event.description}
              </p>
            </div>
          )}

          {/* Теги */}
          {event.tags && event.tags.length > 0 && (
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                Теги
              </div>
              <div className="flex flex-wrap gap-1">
                {event.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-[10px]">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Посилання на джерело */}
          {(() => {
            const url = buildExternalLink(event.externalRef ?? null)
            return (
              <div className="space-y-1">
                <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Посилання на джерело
                </div>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all text-[11px] text-blue-600 hover:underline"
                  >
                    {url}
                  </a>
                ) : event.externalRef ? (
                  <div className="break-all text-[11px]">
                    {event.externalRef}
                  </div>
                ) : (
                  <div className="text-[11px] text-muted-foreground">
                    Немає зовнішнього посилання
                  </div>
                )}
              </div>
            )
          })()}
        </div>

        <div className="mt-4 flex justify-between gap-2">
          <Button size="sm" variant="outline" onClick={handleClose}>
            Закрити
          </Button>

        </div>
      </DialogContent>
    </Dialog>
  )
}