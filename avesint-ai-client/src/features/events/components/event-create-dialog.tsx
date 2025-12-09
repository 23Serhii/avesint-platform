// src/features/events/components/event-create-dialog.tsx
'use client'

import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { createEvent } from '@/lib/api/events'
import {
    eventTypes,
    eventSeverities,
    type EventSeverity,
} from '@/features/events/data/schema'

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreate: (created: unknown) => void
}

// бекенд очікує: 'pending' | 'confirmed' | 'disproved'
type BackendStatus = 'pending' | 'confirmed' | 'disproved'

export function EventCreateDialog({ open, onOpenChange, onCreate }: Props) {
    const [title, setTitle] = useState('')
    const [rawText, setRawText] = useState('')

    const [type, setType] = useState<string>('other_enemy_activity')
    const [severity, setSeverity] = useState<EventSeverity>('medium')

    const [status, setStatus] = useState<BackendStatus>('pending')
    const [confidence, setConfidence] = useState<number>(0.6)

    const [latitude, setLatitude] = useState<string>('')
    const [longitude, setLongitude] = useState<string>('')

    const [occurredAt, setOccurredAt] = useState<string>(() => {
        // datetime-local value (без секунд)
        return new Date().toISOString().slice(0, 16)
    })

    const [externalRef, setExternalRef] = useState('')
    const [imageUrl, setImageUrl] = useState('')

    const [submitting, setSubmitting] = useState(false)

    const resetForm = () => {
        setTitle('')
        setRawText('')
        setType('other_enemy_activity')
        setSeverity('medium')
        setStatus('pending')
        setConfidence(0.6)
        setLatitude('')
        setLongitude('')
        setOccurredAt(new Date().toISOString().slice(0, 16))
        setExternalRef('')
        setImageUrl('')
    }

    const handleSubmit = async () => {
        const trimmedTitle = title.trim()
        const trimmedText = rawText.trim()

        if (!trimmedTitle && !trimmedText) return

        // Перетворюємо datetime-local у ISO
        let occurredIso: string
        if (occurredAt) {
            const d = new Date(occurredAt)
            occurredIso = d.toISOString()
        } else {
            occurredIso = new Date().toISOString()
        }

        const lat = latitude.trim()
        const lng = longitude.trim()

        try {
            setSubmitting(true)

            const payload = {
                title: trimmedTitle || trimmedText.slice(0, 80),
                summary: trimmedText || undefined,
                description: undefined,
                type,                // string, відповідає eventTypes.value
                severity,            // 'critical' | 'high' | 'medium' | 'low'
                status,              // 'pending' | 'confirmed' | 'disproved'
                occurredAt: occurredIso,
                latitude: lat ? Number(lat) : undefined,
                longitude: lng ? Number(lng) : undefined,
                confidence,
                externalRef: externalRef.trim() || undefined,
                imageUrl: imageUrl.trim() || undefined,
            }

            const created = await createEvent(payload as any)
            onCreate(created)
            resetForm()
            onOpenChange(false)
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Failed to create event', e)
        } finally {
            setSubmitting(false)
        }
    }

    const handleClose = (nextOpen: boolean) => {
        if (!nextOpen) {
            resetForm()
        }
        onOpenChange(nextOpen)
    }

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Нова подія / повідомлення</DialogTitle>
                    <DialogDescription className="text-xs">
                        Заповніть дані події. Можна вказати тип, координати, час події,
                        рівень важливості, зовнішнє посилання та зображення.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Заголовок */}
                    <Input
                        placeholder="Короткий заголовок події"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />

                    {/* Сирий текст / summary */}
                    <Textarea
                        rows={5}
                        placeholder="Сирий текст (копія з чату/каналу, радіопереговорів, OSINT‑платформи)…"
                        value={rawText}
                        onChange={(e) => setRawText(e.target.value)}
                    />

                    {/* Тип / важливість / статус */}
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Тип події
              </span>
                            <Select value={type} onValueChange={(v) => setType(v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Тип" />
                                </SelectTrigger>
                                <SelectContent>
                                    {eventTypes.map((t) => (
                                        <SelectItem key={t.value} value={t.value}>
                                            {t.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Важливість
              </span>
                            <Select
                                value={severity}
                                onValueChange={(v: EventSeverity) => setSeverity(v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Важливість" />
                                </SelectTrigger>
                                <SelectContent>
                                    {eventSeverities.map((s) => (
                                        <SelectItem key={s.value} value={s.value}>
                                            {s.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Статус
              </span>
                            <Select
                                value={status}
                                onValueChange={(v: BackendStatus) => setStatus(v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Статус" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pending">Очікує верифікації</SelectItem>
                                    <SelectItem value="confirmed">Підтверджена</SelectItem>
                                    <SelectItem value="disproved">Спростована</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Довіра */}
                    <div>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Довіра до даних ({Math.round(confidence * 100)}%)
            </span>
                        <input
                            type="range"
                            min={0}
                            max={1}
                            step={0.05}
                            value={confidence}
                            onChange={(e) => setConfidence(parseFloat(e.target.value))}
                            className="w-full cursor-pointer"
                        />
                    </div>

                    {/* Координати + час */}
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Lat
              </span>
                            <Input
                                type="number"
                                step="0.000001"
                                placeholder="48.5123"
                                value={latitude}
                                onChange={(e) => setLatitude(e.target.value)}
                            />
                        </div>
                        <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Lng
              </span>
                            <Input
                                type="number"
                                step="0.000001"
                                placeholder="37.9987"
                                value={longitude}
                                onChange={(e) => setLongitude(e.target.value)}
                            />
                        </div>
                        <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Час події
              </span>
                            <Input
                                type="datetime-local"
                                value={occurredAt}
                                onChange={(e) => setOccurredAt(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Зовнішнє посилання */}
                    <div>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              Зовнішнє посилання / Ref (опційно)
            </span>
                        <Input
                            placeholder="Лінк на оригінал повідомлення, telegram:channel:msgId, ticket ID…"
                            value={externalRef}
                            onChange={(e) => setExternalRef(e.target.value)}
                        />
                    </div>

                    {/* Зображення */}
                    <div>
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              URL зображення (опційно)
            </span>
                        <Input
                            placeholder="https://…"
                            value={imageUrl}
                            onChange={(e) => setImageUrl(e.target.value)}
                        />
                    </div>
                </div>

                <DialogFooter className="mt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => handleClose(false)}
                    >
                        Скасувати
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={
                            submitting ||
                            (!title.trim() && !rawText.trim())
                        }
                    >
                        {submitting ? 'Створення…' : 'Створити'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}