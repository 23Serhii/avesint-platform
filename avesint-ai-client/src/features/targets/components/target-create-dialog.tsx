// avesint-ai-client/src/features/targets/components/target-create-dialog.tsx
import { useState } from 'react'

import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
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

import type {
    TargetPriority,
    TargetStatus,
    TargetType,
} from '@/features/targets/data/schema'
import { createTarget } from '@/lib/api/targets'

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreate: (created: unknown) => void
}

export function TargetCreateDialog({ open, onOpenChange, onCreate }: Props) {
    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [type, setType] = useState<TargetType>('other')
    const [status, setStatus] = useState<TargetStatus>('candidate')
    const [priority, setPriority] = useState<TargetPriority>('medium')
    const [submitting, setSubmitting] = useState(false)

    const resetForm = () => {
        setTitle('')
        setDescription('')
        setType('other')
        setStatus('candidate')
        setPriority('medium')
    }

    const handleSubmit = async () => {
        const trimmedTitle = title.trim()
        if (!trimmedTitle) return

        try {
            setSubmitting(true)

            const created = await createTarget({
                title: trimmedTitle,
                description: description.trim() || undefined,
                type,
                status,
                priority,
            })

            onCreate(created)
            resetForm()
            onOpenChange(false)
        } catch (e) {
            // eslint-disable-next-line no-console
            console.error('Failed to create target', e)
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
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Нова ціль / обʼєкт</DialogTitle>
                </DialogHeader>

                <div className="space-y-3">
                    <Input
                        placeholder="Назва (напр. Скупчення техніки біля ТЕЦ)"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />

                    <Textarea
                        rows={3}
                        placeholder="Короткий опис, важливі деталі…"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Тип
              </span>
                            <Select value={type} onValueChange={(v: TargetType) => setType(v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Тип" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="infrastructure">Інфраструктура</SelectItem>
                                    <SelectItem value="vehicle">Техніка</SelectItem>
                                    <SelectItem value="personnel">Жива сила</SelectItem>
                                    <SelectItem value="position">Позиція</SelectItem>
                                    <SelectItem value="other">Інше</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Статус
              </span>
                            <Select
                                value={status}
                                onValueChange={(v: TargetStatus) => setStatus(v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Статус" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="candidate">Кандидат</SelectItem>
                                    <SelectItem value="observed">Спостерігається</SelectItem>
                                    <SelectItem value="confirmed">Підтверджена</SelectItem>
                                    <SelectItem value="tasked">В роботі</SelectItem>
                                    <SelectItem value="neutralized">Нейтралізована</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div>
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Пріоритет
              </span>
                            <Select
                                value={priority}
                                onValueChange={(v: TargetPriority) => setPriority(v)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Пріоритет" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="high">Високий</SelectItem>
                                    <SelectItem value="medium">Середній</SelectItem>
                                    <SelectItem value="low">Низький</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
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
                        disabled={submitting || !title.trim()}
                    >
                        {submitting ? 'Створення…' : 'Створити'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}