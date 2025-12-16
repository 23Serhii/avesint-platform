import { memo, useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { listEventEvidence, type EventEvidenceItem } from '@/lib/api/events'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Event } from '@/features/events/data/schema'

type Props = {
  event: Event
  open: boolean
  onOpenChange: (open: boolean) => void
}

const EVIDENCE_MAX_RENDER = 50
const EVIDENCE_SCROLL_HEIGHT = 110

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

function buildExternalLink(ref: string | null | undefined): string | null {
  if (!ref) return null
  const s = String(ref).trim()
  if (!s) return null

  // already a valid URL
  if (/^https?:\/\//i.test(s)) return s

  // Telegram formats we might see in DB:
  // - telegram:<channel>:<msgId>
  // - telegram:handle:<channel>:msg:<msgId>
  // - telegram:chatid:<id>:msg:<msgId> (no public handle -> can't build t.me link reliably)
  if (s.toLowerCase().startsWith('telegram:')) {
    const parts = s.split(':').map((p) => p.trim()).filter(Boolean)

    // parts example: ["telegram", "<channel>", "<msgId>"]
    if (parts.length >= 3 && parts[0].toLowerCase() === 'telegram') {
      const channel = parts[1]
      const msgId = parts[2]
      if (channel && msgId && /^\d+$/.test(msgId) && channel.toLowerCase() !== 'chatid') {
        return `https://t.me/${channel}/${msgId}`
      }
    }

    // parts example: ["telegram","handle","mychannel","msg","123"]
    if (parts.length >= 5 && parts[0].toLowerCase() === 'telegram') {
      const hasHandle = parts[1].toLowerCase() === 'handle'
      const channel = hasHandle ? parts[2] : null

      const msgIdx = parts.findIndex((p) => p.toLowerCase() === 'msg')
      const msgId = msgIdx !== -1 ? parts[msgIdx + 1] : null

      if (channel && msgId && /^\d+$/.test(msgId)) {
        return `https://t.me/${channel}/${msgId}`
      }
    }

    return null
  }

  return null
}

function percentOrNull(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return `${Math.round(value * 100)}%`
}

type EvidenceRowProps = {
  ev: EventEvidenceItem
}

const EvidenceRow = memo(function EvidenceRow({ ev }: EvidenceRowProps) {
  const credibility = percentOrNull(ev.item.credibility)
  const url = ev.item.rawUrl || buildExternalLink(ev.item.externalId)
  const sourceLabel = ev.source.category
    ? `${ev.source.name} · ${ev.source.category}`
    : ev.source.name

  const previewText = ev.item.summary ?? ev.item.content

  return (
    <div className='flex flex-col gap-1 border-b pb-2 last:border-b-0 last:pb-0'>
      <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-[11px]'>
        <Badge variant='outline' className='text-[10px]'>
          {ev.relation}
        </Badge>

        {credibility && (
          <Badge variant='outline' className='text-[10px]'>
            cred: {credibility}
          </Badge>
        )}

        <Badge variant='outline' className='text-[10px]'>
          {sourceLabel}
        </Badge>
      </div>

      <div className='text-xs'>
        {ev.item.title ? (
          <div className='font-semibold'>{ev.item.title}</div>
        ) : null}
        <div className='text-muted-foreground line-clamp-2'>{previewText}</div>
      </div>

      <div className='text-muted-foreground flex flex-wrap items-center gap-2 text-[11px]'>
        <span>парсинг: {formatDate(ev.item.parseDate)}</span>
        {ev.item.eventDate ? (
          <span>подія: {formatDate(ev.item.eventDate)}</span>
        ) : null}
      </div>

      {url ? (
        <a
          href={url}
          target='_blank'
          rel='noreferrer'
          className='text-[11px] break-all text-blue-600 hover:underline'
        >
          {url}
        </a>
      ) : null}
    </div>
  )
})

export function EventDetails({ event, open, onOpenChange }: Props) {
  const [evidence, setEvidence] = useState<EventEvidenceItem[]>([])
  const [evidenceLoading, setEvidenceLoading] = useState(false)

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange])

  const loadEvidence = useCallback(async () => {
    setEvidenceLoading(true)
    try {
      const items = await listEventEvidence(event.id)
      setEvidence(items)
    } catch {
      setEvidence([])
      toast.error('Не вдалося завантажити пов’язані матеріали')
    } finally {
      setEvidenceLoading(false)
    }
  }, [event.id])

  useEffect(() => {
    if (!open) return
    void loadEvidence()
  }, [open, loadEvidence])

  const occurredAtLabel = useMemo(() => {
    try {
      return new Date(event.occurredAt).toLocaleString('uk-UA', {
        dateStyle: 'short',
        timeStyle: 'short',
      })
    } catch {
      return event.occurredAt
    }
  }, [event.occurredAt])

  const evidenceToRender = useMemo(
    () => evidence.slice(0, EVIDENCE_MAX_RENDER),
    [evidence]
  )

  const sourceUrl = useMemo(
    () => buildExternalLink(event.externalRef ?? null),
    [event.externalRef]
  )

  const hasCoords = event.latitude != null && event.longitude != null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{event.title}</DialogTitle>
        </DialogHeader>

        <div className='space-y-4 text-sm'>
          <div className='text-muted-foreground flex flex-wrap gap-2 text-xs'>
            <Badge variant='outline'>Важливість: {event.severity}</Badge>
            <Badge variant='outline'>Статус: {event.status}</Badge>
            <span>Час: {occurredAtLabel}</span>
            {event.incidentId ? (
              <Badge variant='outline'>Інцидент: {event.incidentId}</Badge>
            ) : null}
          </div>

          <div className='space-y-1'>
            <div className='flex items-center justify-between'>
              <div className='text-muted-foreground text-[11px] font-semibold uppercase'>
                Згадки з джерел (evidence)
              </div>

              {evidenceLoading ? (
                <span className='text-muted-foreground text-[11px]'>
                  завантаження…
                </span>
              ) : (
                <span className='text-muted-foreground text-[11px]'>
                  {evidence.length} шт.
                </span>
              )}
            </div>

            <div className='text-muted-foreground text-[11px]'>
              Це не “підтвердження правди”, а список згадок/матеріалів, які
              система об’єднала в одну подію.
            </div>

            {!evidenceLoading && evidence.length === 0 ? (
              <div className='text-muted-foreground text-[11px]'>
                Немає пов’язаних OSINT-айтемів.
              </div>
            ) : null}

            {evidence.length > 0 ? (
              <div className='bg-background/40 rounded-md border'>
                <ScrollArea style={{ height: EVIDENCE_SCROLL_HEIGHT }}>
                  <div className='space-y-2 p-2'>
                    {evidenceToRender.map((ev) => (
                      <EvidenceRow key={ev.osintItemId} ev={ev} />
                    ))}
                  </div>
                </ScrollArea>
              </div>
            ) : null}
          </div>

          {hasCoords ? (
            <div className='text-muted-foreground font-mono text-xs'>
              Координати: {event.latitude!.toFixed(4)},{' '}
              {event.longitude!.toFixed(4)}
            </div>
          ) : null}

          {event.summary ? (
            <div className='bg-muted/60 rounded-md p-2 text-xs'>
              <div className='text-muted-foreground mb-1 text-[11px] font-semibold uppercase'>
                Коротке резюме
              </div>
              <div>{event.summary}</div>
            </div>
          ) : null}

          {event.description ? (
            <div className='space-y-1'>
              <div className='text-muted-foreground text-[11px] font-semibold uppercase'>
                Розширений опис
              </div>
              <p className='text-xs whitespace-pre-wrap'>{event.description}</p>
            </div>
          ) : null}

          {event.tags && event.tags.length > 0 ? (
            <div className='space-y-1'>
              <div className='text-muted-foreground text-[11px] font-semibold uppercase'>
                Теги
              </div>
              <div className='flex flex-wrap gap-1'>
                {event.tags.map((tag) => (
                  <Badge key={tag} variant='outline' className='text-[10px]'>
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}

          <div className='space-y-1'>
            <div className='text-muted-foreground text-[11px] font-semibold uppercase'>
              Посилання на джерело
            </div>

            {sourceUrl ? (
              <a
                href={sourceUrl}
                target='_blank'
                rel='noreferrer'
                className='text-[11px] break-all text-blue-600 hover:underline'
              >
                {sourceUrl}
              </a>
            ) : event.externalRef ? (
              <div className='text-[11px] break-all'>{event.externalRef}</div>
            ) : (
              <div className='text-muted-foreground text-[11px]'>
                Немає зовнішнього посилання
              </div>
            )}
          </div>
        </div>

        <div className='mt-4 flex justify-between gap-2'>
          <Button size='sm' variant='outline' onClick={handleClose}>
            Закрити
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}