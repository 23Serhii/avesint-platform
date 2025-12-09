'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { showSubmittedData } from '@/lib/show-submitted-data'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type User } from '../data/schema'

type UserDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow: User
}

export function UsersDeleteDialog({
                                    open,
                                    onOpenChange,
                                    currentRow,
                                  }: UserDeleteDialogProps) {
  const [value, setValue] = useState('')

  const handleDelete = () => {
    if (value.trim() !== currentRow.username) return

    onOpenChange(false)
    showSubmittedData(currentRow, 'Користувача буде видалено:')
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={handleDelete}
      disabled={value.trim() !== currentRow.username}
      title={
        <span className="text-destructive">
          <AlertTriangle
            className="stroke-destructive me-1 inline-block"
            size={18}
          />{' '}
          Видалити користувача
        </span>
      }
      desc={
        <div className="space-y-4">
          <p className="mb-2">
            Ви впевнені, що хочете видалити{' '}
            <span className="font-bold">{currentRow.username}</span>? <br />
            Це назавжди прибере його роль{' '}
            <span className="font-bold">
              {currentRow.role.toUpperCase()}
            </span>{' '}
            з системи. Дію неможливо буде скасувати.
          </p>

          <Label className="my-2">
            Імʼя користувача:
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Введіть username для підтвердження."
            />
          </Label>

          <Alert variant="destructive">
            <AlertTitle>Увага!</AlertTitle>
            <AlertDescription>
              Будьте обережні, цю операцію не можна буде відкотити.
            </AlertDescription>
          </Alert>
        </div>
      }
      confirmText="Видалити"
      destructive
    />
  )
}
