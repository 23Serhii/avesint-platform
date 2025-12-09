// avesint-ai-client/src/features/targets/components/target-details.tsx
import type { TargetObject } from '@/features/targets/data/schema'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'

type Props = {
    target: TargetObject
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function TargetDetails({ target, open, onOpenChange }: Props) {
    const handleClose = () => onOpenChange(false)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{target.title}</DialogTitle>
                </DialogHeader>

                <div className="space-y-3 text-sm">
                    {target.notes && (
                        <p className="text-muted-foreground">{target.notes}</p>
                    )}

                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">Тип: {target.type}</Badge>
                        <Badge variant="outline">Статус: {target.status}</Badge>
                        <Badge variant="outline">Пріоритет: {target.priority}</Badge>
                    </div>

                    <div className="text-xs text-muted-foreground">
                        Вперше помічено:{' '}
                        {target.firstSeenAt.toLocaleString('uk-UA', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                        })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                        Остання активність:{' '}
                        {target.lastSeenAt.toLocaleString('uk-UA', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                        })}
                    </div>
                </div>

                <div className="mt-4 flex justify-end">
                    <Button size="sm" variant="outline" onClick={handleClose}>
                        Закрити
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}