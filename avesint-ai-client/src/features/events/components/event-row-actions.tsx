// src/features/events/components/event-row-actions.tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { MoreHorizontal, Sparkles, CheckCircle2, XCircle } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import type { Event } from '@/features/events/data/schema'
import { updateEvent } from '@/lib/api/events'

type Props = {
    event: Event
    onOpen?: (event: Event) => void
    onCreateTask?: (event: Event) => void
}

export function EventRowActions({ event, onOpen, onCreateTask }: Props) {
    const [aiLoading, setAiLoading] = useState(false)

    const handleAnalyzeAI = async () => {
        try {
            setAiLoading(true)
            // тут потім підʼєднаємо реальний /ai/analyze-event
            await new Promise((resolve) => setTimeout(resolve, 800))
            toast.success('AI-попередній аналіз події виконано (заглушка)')
        } catch {
            toast.error('Не вдалося виконати AI-аналіз')
        } finally {
            setAiLoading(false)
        }
    }

    const handleVerify = async (result: 'confirmed' | 'disproved') => {
        try {
            await updateEvent(event.id, { status: result } as any)
            toast.success(
                result === 'confirmed'
                    ? 'Подію підтверджено'
                    : 'Подію спростовано',
            )
        } catch {
            toast.error('Не вдалося оновити статус події')
        }
    }

    const handleCreateTask = () => {
        onCreateTask?.(event)
    }

    return (
        <div className="flex items-center justify-end gap-1">
            <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => onOpen?.(event)}
                title="Відкрити деталі"
            >
                <span className="sr-only">Відкрити</span>
                <MoreHorizontal className="h-4 w-4 rotate-90" />
            </Button>

            <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                    <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                    >
                        <span className="sr-only">Дії</span>
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content
                    align="end"
                    className="z-20 min-w-[190px] rounded-md border bg-popover p-1 text-sm shadow"
                >
                    <DropdownMenu.Label className="px-2 py-1 text-[11px] text-muted-foreground">
                        Операції
                    </DropdownMenu.Label>
                    <DropdownMenu.Item
                        className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 outline-none hover:bg-muted"
                        onSelect={handleCreateTask}
                    >
                        <span>Створити задачу</span>
                    </DropdownMenu.Item>

                    <DropdownMenu.Item
                        className="mt-1 flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 outline-none hover:bg-muted"
                        onSelect={handleAnalyzeAI}
                    >
                        <span>Аналізувати AI</span>
                        <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
                    </DropdownMenu.Item>

                    <DropdownMenu.Separator className="my-1 h-px bg-border" />
                    <DropdownMenu.Label className="px-2 py-1 text-[11px] text-muted-foreground">
                        Верифікація
                    </DropdownMenu.Label>
                    <DropdownMenu.Item
                        className="flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 outline-none hover:bg-muted"
                        onSelect={() => handleVerify('confirmed')}
                    >
                        <span>Підтвердити</span>
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    </DropdownMenu.Item>
                    <DropdownMenu.Item
                        className="mt-1 flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 outline-none hover:bg-muted"
                        onSelect={() => handleVerify('disproved')}
                    >
                        <span>Спростувати</span>
                        <XCircle className="h-3.5 w-3.5 text-red-600" />
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Root>
        </div>
    )
}