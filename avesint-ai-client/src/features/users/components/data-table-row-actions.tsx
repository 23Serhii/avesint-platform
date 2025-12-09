import { DotsHorizontalIcon } from '@radix-ui/react-icons'
import { Shield, UserCheck, Users as UsersIcon, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import { api } from '@/lib/api/client'
import type { User, UserRole } from '../data/schema'
import { useUsers } from './users-provider'

type Props = {
  user: User
}


export function DataTableRowActions({ user }: Props) {
  const { setCurrentRow, setOpen, setItems } = useUsers()

  const updateLocalUser = (partial: Partial<User>) => {
    setItems((prev) =>
      prev.map((u) => (u.id === user.id ? { ...u, ...partial } : u)),
    )
  }

  const handleView = () => {
    setCurrentRow(user)
    setOpen('view')
  }

  const handleToggleBlock = async () => {
    try {
      const endpoint = user.isBlocked
        ? `/users/${user.id}/unblock`
        : `/users/${user.id}/block`

      await api.patch(endpoint)
      updateLocalUser({ isBlocked: !user.isBlocked })

      toast.success(user.isBlocked ? 'Користувача розблоковано' : 'Користувача заблоковано')
    } catch {
      toast.error('Не вдалося змінити статус користувача')
    }
  }

  const handleChangeRole = async (newRole: UserRole) => {
    if (newRole === user.role) return

    try {
      await api.patch(`/users/${user.id}/role`, { role: newRole })
      updateLocalUser({ role: newRole })
      toast.success('Роль оновлено')
    } catch {
      toast.error('Не вдалося оновити роль')
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant='ghost' size='icon' className='h-8 w-8'>
          <DotsHorizontalIcon className='h-4 w-4' />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align='end'>
        <DropdownMenuLabel>Дії</DropdownMenuLabel>
        <DropdownMenuItem onClick={handleView}>Переглянути</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Змінити роль</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => handleChangeRole('admin')}>
          <Shield size={14} className='me-2' /> Адміністратор
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleChangeRole('officer')}>
          <UserCheck size={14} className='me-2' /> Офіцер зміни
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleChangeRole('analyst')}>
          <UsersIcon size={14} className='me-2' /> Аналітик
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleChangeRole('user')}>
          <Eye size={14} className='me-2' /> Спостерігач
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleToggleBlock}>
          {user.isBlocked ? 'Розблокувати' : 'Заблокувати'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
