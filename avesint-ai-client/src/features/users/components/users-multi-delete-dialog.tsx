'use client'

import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/confirm-dialog'

type UserMultiDeleteDialogProps<TData> = {
  open: boolean
  onOpenChange: (open: boolean) => void
  table: Table<TData>
}

const CONFIRM_WORD = 'DELETE' // можемо потім поміняти на "ВИДАЛИТИ"

export function UsersMultiDeleteDialog<TData>({
                                                open,
                                                onOpenChange,
                                                table,
                                              }: UserMultiDeleteDialogProps<TData>) {
  const [value, setValue] = useState('')

  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleDelete = () => {
    if (value.trim() !== CONFIRM_WORD) {
      toast.error(`Введіть "${CONFIRM_WORD}" для підтвердження.`)
      return
    }

    onOpenChange(false)

    toast.promise(sleep(2000), {
      loading: 'Видалення користувачів…',
      success: () => {
        table.resetRowSelection()
        return `Видалено ${selectedRows.length} ${
          selectedRows.length > 1 ? 'користувачів' : 'користувача'
        }`
      },
      error: 'Помилка під час видалення.',
    })
  }

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      handleConfirm={handleDelete}
      disabled={value.trim() !== CONFIRM_WORD}
      title={
        <span className="text-destructive">
          <AlertTriangle
            className="stroke-destructive me-1 inline-block"
            size={18}
          />{' '}
          Видалити {selectedRows.length}{' '}
          {selectedRows.length > 1 ? 'користувачів' : 'користувача'}
        </span>
      }
      desc={
        <div className="space-y-4">
          <p className="mb-2">
            Ви впевнені, що хочете видалити вибраних користувачів? <br />
            Цю дію не можна буде скасувати.
          </p>

          <Label className="my-4 flex flex-col items-start gap-1.5">
            <span>Підтвердіть, ввівши "{CONFIRM_WORD}":</span>
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={`Введіть "${CONFIRM_WORD}" для підтвердження.`}
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
