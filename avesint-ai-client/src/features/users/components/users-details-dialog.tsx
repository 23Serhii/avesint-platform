// src/features/users/components/users-details-dialog.tsx
'use client'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import type { User } from '../data/schema'
import { roleMeta } from '../data/data'

type UsersDetailsDialogProps = {
    open: boolean
    onOpenChange: (open: boolean) => void
    currentRow: User
}

export function UsersDetailsDialog({
                                       open,
                                       onOpenChange,
                                       currentRow,
                                   }: UsersDetailsDialogProps) {
    const roleInfo = currentRow.role ? roleMeta[currentRow.role] : undefined

    const formatDate = (value?: string | Date | null) => {
        if (!value) return '—'
        const d = value instanceof Date ? value : new Date(value)
        if (Number.isNaN(d.getTime())) return '—'
        return d.toLocaleString('uk-UA', {
            dateStyle: 'short',
            timeStyle: 'short',
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader className="text-start">
                    <DialogTitle>
                        {currentRow.displayName || currentRow.callsign || 'Користувач'}
                    </DialogTitle>
                    <DialogDescription>
                        Детальна інформація про обліковий запис користувача та його роль у системі.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 text-sm">
                    {/* Основні дані */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <div className="text-xs font-medium text-muted-foreground">
                                Позивний
                            </div>
                            <p className="font-mono text-sm">
                                {currentRow.callsign || 'Не вказано'}
                            </p>
                        </div>
                        <div>
                            <div className="text-xs font-medium text-muted-foreground">
                                Відображуване імʼя
                            </div>
                            <p className="text-sm">
                                {currentRow.displayName || 'Не вказано'}
                            </p>
                        </div>
                    </div>

                    {/* Роль / доступи */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <div className="text-xs font-medium text-muted-foreground">
                                Роль / посада
                            </div>
                            <div className="mt-1 flex items-center gap-2">
                                {roleInfo?.icon && <roleInfo.icon size={16} />}
                                <span>{roleInfo?.label ?? currentRow.role ?? 'Не вказано'}</span>
                            </div>
                        </div>
                        <div>
                            <div className="text-xs font-medium text-muted-foreground">
                                Двофакторна автентифікація
                            </div>
                            <div className="mt-1">
                                {currentRow.isTwoFactorEnabled ? (
                                    <Badge
                                        variant="outline"
                                        className="border-emerald-500 text-emerald-500"
                                    >
                                        Увімкнено
                                    </Badge>
                                ) : (
                                    <Badge
                                        variant="outline"
                                        className="border-muted-foreground/40 text-muted-foreground"
                                    >
                                        Вимкнено
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Статус / блокування */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <div className="text-xs font-medium text-muted-foreground">
                                Статус облікового запису
                            </div>
                            <div className="mt-1">
                                {currentRow.isBlocked ? (
                                    <Badge variant="destructive">Заблоковано</Badge>
                                ) : (
                                    <Badge variant="outline">Активний</Badge>
                                )}
                            </div>
                        </div>
                        <div>
                            <div className="text-xs font-medium text-muted-foreground">
                                ID користувача
                            </div>
                            <p className="font-mono text-[11px] text-muted-foreground">
                                {currentRow.id}
                            </p>
                        </div>
                    </div>

                    {/* Час створення / оновлення, якщо є у схемі */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <div className="text-xs font-medium text-muted-foreground">
                                Створено
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {formatDate((currentRow as any).createdAt)}
                            </p>
                        </div>
                        <div>
                            <div className="text-xs font-medium text-muted-foreground">
                                Останнє оновлення
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {formatDate((currentRow as any).updatedAt)}
                            </p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}