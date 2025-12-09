import type { User } from '../data/schema'
import { roleMeta } from '../data/data'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { DataTableRowActions } from './data-table-row-actions'

type UsersTableProps = {
  items: User[]
  isLoading?: boolean
}

export function UsersTable({ items, isLoading }: UsersTableProps) {
  return (
    <div className='rounded-lg border bg-card'>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Позивний</TableHead>
            <TableHead>Імʼя</TableHead>
            <TableHead>Роль</TableHead>
            <TableHead>2FA</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className='w-[80px]' />
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={6} className='py-6 text-center text-sm'>
                Завантаження користувачів...
              </TableCell>
            </TableRow>
          )}

          {!isLoading && items.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className='py-6 text-center text-sm'>
                Користувачів поки немає.
              </TableCell>
            </TableRow>
          )}

          {!isLoading &&
            items.map((user) => {
              const meta = roleMeta[user.role]

              return (
                <TableRow key={user.id}>
                  <TableCell className='font-mono font-medium'>
                    {user.callsign}
                  </TableCell>
                  <TableCell>{user.displayName || '—'}</TableCell>
                  <TableCell>
                    <div className='flex items-center gap-2'>
                      {meta?.icon && <meta.icon size={16} />}
                      <span>{meta?.label ?? user.role}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {user.isTwoFactorEnabled ? (
                      <Badge variant='outline' className='border-emerald-500 text-emerald-500'>
                        Увімкнено
                      </Badge>
                    ) : (
                      <Badge variant='outline' className='border-muted-foreground/40 text-muted-foreground'>
                        Вимкнено
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {user.isBlocked ? (
                      <Badge variant='destructive'>Заблоковано</Badge>
                    ) : (
                      <Badge variant='outline'>Активний</Badge>
                    )}
                  </TableCell>
                  <TableCell className='text-right'>
                    <DataTableRowActions user={user} />
                  </TableCell>
                </TableRow>
              )
            })}
        </TableBody>
      </Table>
    </div>
  )
}
