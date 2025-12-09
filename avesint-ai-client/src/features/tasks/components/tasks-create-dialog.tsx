// src/features/tasks/components/tasks-create-dialog.tsx
'use client'

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { TaskCreateForm, type TaskCreateFormValues } from './task-create-form'
import type { TaskDto } from '@/lib/api/tasks'

type TasksCreateDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    onTaskCreated: (values: TaskCreateFormValues) => void

    parentTask?: TaskDto | null
    currentUserCallsign?: string
    isAdminOrOfficer?: boolean

    linkedTargetId?: string
    linkedTargetTitle?: string
    linkedEventId?: string
    linkedEventTitle?: string

    initialTitle?: string
    initialDescription?: string
}

export function TasksCreateDialog({
                                      open,
                                      onOpenChange,
                                      onTaskCreated,
                                      parentTask,
                                      currentUserCallsign,
                                      isAdminOrOfficer,
                                      linkedTargetId,
                                      linkedTargetTitle,
                                      linkedEventId,
                                      linkedEventTitle,
                                      initialTitle,
                                      initialDescription,
                                  }: TasksCreateDialogProps) {
    const isSubtask = !!parentTask
    const isFromTarget = !!linkedTargetId
    const isFromEvent = !!linkedEventId

    const handleCreate = (values: TaskCreateFormValues) => {
        onTaskCreated({
            ...values,
            targetId: linkedTargetId ?? values.targetId,
            eventId: linkedEventId ?? values.eventId,
        })
        onOpenChange(false)
    }

    const title = isSubtask
        ? `Нова підзадача`
        : isFromTarget
            ? 'Нова задача по цілі'
            : isFromEvent
                ? 'Нова задача по події'
                : 'Нова задача штабу'

    // Формуємо текстовий референс, який підставимо в опис
    const referenceLines: string[] = []

    if (isFromTarget && linkedTargetId && linkedTargetTitle) {
        referenceLines.push(`Ціль: ${linkedTargetTitle} (ID: ${linkedTargetId})`)
    }

    if (isFromEvent && linkedEventId && linkedEventTitle) {
        referenceLines.push(`Подія: ${linkedEventTitle} (ID: ${linkedEventId})`)
    }

    if (isSubtask && parentTask) {
        referenceLines.push(`Батьківська задача: ${parentTask.title} (ID: ${parentTask.id})`)
    }

    const referenceBlock = referenceLines.length > 0 ? referenceLines.join(' | ') : ''
    const baseDescription = initialDescription ?? ''

    const enrichedInitialDescription =
        referenceBlock && baseDescription
            ? `${referenceBlock}\n\n${baseDescription}`
            : referenceBlock || baseDescription

    return (
        <Dialog
            open={open}
            onOpenChange={(state) => {
                onOpenChange(state)
            }}
        >
            <DialogContent className="sm:max-w-lg">
                <DialogHeader className="space-y-2">
                    <DialogTitle>{title}</DialogTitle>

                    {(isFromTarget || isFromEvent || isSubtask) && (
                        <DialogDescription className="space-y-1">
                            {isFromTarget && linkedTargetTitle && (
                                <div className="flex items-center gap-2 text-xs">
                                    <Badge variant="outline">Ціль</Badge>
                                    <span className="font-medium">{linkedTargetTitle}</span>
                                </div>
                            )}
                            {isFromEvent && linkedEventTitle && (
                                <div className="flex items-center gap-2 text-xs">
                                    <Badge variant="outline">Подія</Badge>
                                    <span className="font-medium">{linkedEventTitle}</span>
                                </div>
                            )}
                            {isSubtask && parentTask && (
                                <div className="flex items-center gap-2 text-xs">
                                    <Badge variant="outline">Батьківська задача</Badge>
                                    <span className="font-medium">{parentTask.title}</span>
                                </div>
                            )}
                        </DialogDescription>
                    )}
                </DialogHeader>

                <TaskCreateForm
                    onCreate={handleCreate}
                    parentTask={parentTask}
                    currentUserCallsign={currentUserCallsign}
                    isAdminOrOfficer={isAdminOrOfficer}
                    initialTitle={initialTitle}
                    initialDescription={enrichedInitialDescription}
                    // для задач по цілі:
                    // - показуємо поле позивного завжди
                    // - ставимо його першим і з фокусом
                    forceAssigneeInput={isFromTarget}
                    preferAssigneeFirst={isFromTarget}
                />
            </DialogContent>
        </Dialog>
    )
}