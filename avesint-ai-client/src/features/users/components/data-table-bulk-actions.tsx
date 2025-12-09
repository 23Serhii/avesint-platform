import { useState } from 'react'
import { type Table } from '@tanstack/react-table'
import { Trash2, UserX, UserCheck, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { sleep } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { type User } from '../data/schema'
import { UsersMultiDeleteDialog } from './users-multi-delete-dialog'

type DataTableBulkActionsProps<TData> = {
  table: Table<TData>
}

export function DataTableBulkActions<TData>({
                                              table,
                                            }: DataTableBulkActionsProps<TData>) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const selectedRows = table.getFilteredSelectedRowModel().rows

  const handleBulkStatusChange = (status: 'active' | 'inactive') => {
    const selectedUsers = selectedRows.map((row) => row.original as User)
    toast.promise(sleep(2000), {
      loading:
        status === 'active'
          ? 'Активуємо користувачів…'
          : 'Деактивуємо користувачів…',
      success: () => {
        table.resetRowSelection()
        return `${
          status === 'active' ? 'Активовано' : 'Деактивовано'
        } ${selectedUsers.length} користувач(ів)`
      },
      error:
        status === 'active'
          ? 'Помилка під час активації.'
          : 'Помилка під час деактивації.',
    })
    table.resetRowSelection()
  }

  const handleBulkInvite = () => {
    const selectedUsers = selectedRows.map((row) => row.original as User)
    toast.promise(sleep(2000), {
      loading: 'Надсилаємо запрошення…',
      success: () => {
        table.resetRowSelection()
        return `Запрошено ${selectedUsers.length} користувач(ів)`
      },
      error: 'Помилка під час надсилання запрошень.',
    })
    table.resetRowSelection()
  }

  return (
    <>
      <BulkActionsToolbar table={table} entityName="користувача">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={handleBulkInvite}
              className="size-8"
              aria-label="Запросити вибраних користувачів"
              title="Запросити вибраних користувачів"
            >
              <Mail />
              <span className="sr-only">Запросити вибраних користувачів</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Запросити вибраних користувачів</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleBulkStatusChange('active')}
              className="size-8"
              aria-label="Активувати вибраних користувачів"
              title="Активувати вибраних користувачів"
            >
              <UserCheck />
              <span className="sr-only">
                Активувати вибраних користувачів
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Активувати вибраних користувачів</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              onClick={() => handleBulkStatusChange('inactive')}
              className="size-8"
              aria-label="Деактивувати вибраних користувачів"
              title="Деактивувати вибраних користувачів"
            >
              <UserX />
              <span className="sr-only">
                Деактивувати вибраних користувачів
              </span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Деактивувати вибраних користувачів</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => setShowDeleteConfirm(true)}
              className="size-8"
              aria-label="Видалити вибраних користувачів"
              title="Видалити вибраних користувачів"
            >
              <Trash2 />
              <span className="sr-only">Видалити вибраних користувачів</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Видалити вибраних користувачів</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <UsersMultiDeleteDialog
        table={table}
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
      />
    </>
  )
}
