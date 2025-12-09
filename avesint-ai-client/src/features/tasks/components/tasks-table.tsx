// src/features/tasks/components/tasks-table.tsx
import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type {
  TaskDto,
  TaskPriority,
  TaskRole,
  TaskStatus,
} from '@/lib/api/tasks'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal } from 'lucide-react'

type TasksTableProps = {
  items: TaskDto[]
  mode: 'all' | 'my'
  currentCallsign?: string
  currentRole?: string
  showRoleFilter?: boolean
  onCreateClick: () => void
  onOpenTask: (task: TaskDto) => void
  onDeleteTask: (task: TaskDto) => void
  onCreateSubtask: (task: TaskDto) => void
  canArchive?: boolean
}

type StatusFilter = 'all' | TaskStatus
type RoleFilter = 'all' | TaskRole | null
type PriorityFilter = 'all' | TaskPriority

const truncate = (text: string | null | undefined, max: number): string => {
  if (!text) return ''
  if (text.length <= max) return text
  return text.slice(0, max - 1).trimEnd() + '…'
}

export function TasksTable({
                             items,
                             mode,
                             currentCallsign,
                             currentRole,
                             showRoleFilter = true,
                             onCreateClick,
                             onOpenTask,
                             onDeleteTask,
                             onCreateSubtask,
                             canArchive = true,
                           }: TasksTableProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all')

  const statusLabel = (s: TaskStatus) => {
    switch (s) {
      case 'new':
        return 'Нова'
      case 'in_progress':
        return 'В роботі'
      case 'done':
        return 'Виконана'
      default:
        return s
    }
  }

  const roleLabel = (r: TaskRole | null) => {
    if (!r) return '—'
    switch (r) {
      case 'analyst':
        return 'Аналітик'
      case 'duty_officer':
        return 'Черговий офіцер'
      case 'section_lead':
        return 'Керівник напряму'
      case 'commander':
        return 'Командир'
      default:
        return r
    }
  }

  const priorityLabel = (p: TaskPriority) => {
    switch (p) {
      case 'high':
        return 'Високий'
      case 'medium':
        return 'Середній'
      case 'low':
        return 'Низький'
      default:
        return p
    }
  }

  const priorityVariant = (p: TaskPriority) => {
    switch (p) {
      case 'high':
        return 'destructive'
      case 'medium':
        return 'default'
      case 'low':
      default:
        return 'outline'
    }
  }

  const statusVariant = (s: TaskStatus) => {
    switch (s) {
      case 'new':
        return 'outline'
      case 'in_progress':
        return 'default'
      case 'done':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter((task) => {
      if (mode === 'my' && (currentCallsign || currentRole)) {
        const byCallsign =
          currentCallsign &&
          task.assigneeCallsign &&
          task.assigneeCallsign.toLowerCase() === currentCallsign.toLowerCase()

        const byRole = currentRole && task.role === currentRole

        if (!(byCallsign || byRole)) {
          return false
        }
      }

      const text = (
        task.title +
        ' ' +
        (task.description ?? '') +
        ' ' +
        (task.assigneeCallsign ?? '') +
        ' ' +
        (task.assigneeUnit ?? '') +
        ' ' +
        (task.assigneeRank ?? '')
      ).toLowerCase()
      const q = search.toLowerCase().trim()

      if (q && !text.includes(q)) return false

      if (statusFilter !== 'all' && task.status !== statusFilter) return false
      if (roleFilter !== 'all' && task.role !== roleFilter) return false
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false

      return true
    })
  }, [
    items,
    search,
    statusFilter,
    roleFilter,
    priorityFilter,
    mode,
    currentCallsign,
    currentRole,
  ])

  return (
    <div className="w-full rounded-lg border overflow-x-auto">
      {/* Верхня панель */}
      <div className="flex min-w-[1100px] flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-semibold">
            {mode === 'my' ? 'Мої задачі' : 'Задачі штабу'}
          </h3>
          <p className="text-xs text-muted-foreground">
            {mode === 'my'
              ? 'Задачі, де ви виконавець або відповідає ваша роль.'
              : 'Начальник нарізає задачі підлеглим за ролями (аналітики, чергові, керівники).'}
          </p>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
          <Input
            placeholder="Пошук за назвою, описом або позивним…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />

          <Select
            value={statusFilter}
            onValueChange={(v: string) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Будь-який статус</SelectItem>
              <SelectItem value="new">Нові</SelectItem>
              <SelectItem value="in_progress">В роботі</SelectItem>
              <SelectItem value="done">Виконані</SelectItem>
            </SelectContent>
          </Select>

          {showRoleFilter && (
            <Select
              value={roleFilter === 'all' ? 'all' : (roleFilter as TaskRole)}
              onValueChange={(value: string) =>
                setRoleFilter(
                  (value === 'all' ? 'all' : (value as TaskRole)) as RoleFilter,
                )
              }
            >
              <SelectTrigger className="w-[170px]">
                <SelectValue placeholder="Роль" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всі ролі</SelectItem>
                <SelectItem value="analyst">Аналітики</SelectItem>
                <SelectItem value="duty_officer">Чергові офіцери</SelectItem>
                <SelectItem value="section_lead">Керівники напрямків</SelectItem>
                <SelectItem value="commander">Командир</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Select
            value={priorityFilter}
            onValueChange={(v: string) =>
              setPriorityFilter(v as PriorityFilter)
            }
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Пріоритет" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Будь-який пріоритет</SelectItem>
              <SelectItem value="high">Високий</SelectItem>
              <SelectItem value="medium">Середній</SelectItem>
              <SelectItem value="low">Низький</SelectItem>
            </SelectContent>
          </Select>

          <Button size="sm" variant="outline" onClick={onCreateClick}>
            + Нова задача
          </Button>
        </div>
      </div>

      {/* Таблиця */}
      <Table className="min-w-[1100px]">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[42%]">Назва / коротко</TableHead>
            <TableHead className="w-[26%]">Роль / позивний</TableHead>
            <TableHead className="w-[10%]">Пріоритет</TableHead>
            <TableHead className="w-[10%]">Статус</TableHead>
            <TableHead className="w-[7%] text-right whitespace-nowrap">
              Дедлайн
            </TableHead>
            <TableHead className="w-[5%] text-right">Дії</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredItems.map((task) => (
            <TableRow key={task.id}>
              <TableCell
                className="max-w-[560px] cursor-pointer align-top"
                onClick={() => onOpenTask(task)}
              >
                <div className="font-medium">{task.title}</div>
                {task.description && (
                  <div className="text-xs text-muted-foreground">
                    {truncate(task.description, 90)}
                  </div>
                )}

                {task.parentTaskId && (
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Підзадача для{' '}
                    <a
                      href={`/_authenticated/tasks/${task.parentTaskId}`}
                      className="underline underline-offset-2 hover:text-primary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      задачі #{task.parentTaskId}
                    </a>
                  </div>
                )}
              </TableCell>

              <TableCell
                className="cursor-pointer align-top whitespace-nowrap"
                onClick={() => onOpenTask(task)}
              >
                <div className="text-sm">{roleLabel(task.role)}</div>
                <div className="text-xs text-muted-foreground">
                  {task.assigneeCallsign
                    ? `Позивний «${task.assigneeCallsign}»`
                    : 'Без виконавця'}
                </div>
                {(task.assigneeRank || task.assigneeUnit) && (
                  <div className="text-[11px] text-muted-foreground/80">
                    {[task.assigneeRank, task.assigneeUnit]
                      .filter(Boolean)
                      .join(', ')}
                  </div>
                )}
              </TableCell>

              <TableCell
                className="cursor-pointer align-top whitespace-nowrap"
                onClick={() => onOpenTask(task)}
              >
                <Badge variant={priorityVariant(task.priority) as never}>
                  {priorityLabel(task.priority)}
                </Badge>
              </TableCell>

              <TableCell
                className="cursor-pointer align-top whitespace-nowrap"
                onClick={() => onOpenTask(task)}
              >
                <Badge variant={statusVariant(task.status) as never}>
                  {statusLabel(task.status)}
                </Badge>
              </TableCell>

              <TableCell
                className="cursor-pointer align-top whitespace-nowrap text-right text-xs text-muted-foreground"
                onClick={() => onOpenTask(task)}
              >
                {task.dueAt
                  ? new Date(task.dueAt).toLocaleDateString('uk-UA', {
                    day: '2-digit',
                    month: '2-digit',
                    year: '2-digit',
                  })
                  : '—'}
              </TableCell>

              <TableCell className="whitespace-nowrap text-right align-top">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Дії із задачею"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <DropdownMenuItem onClick={() => onOpenTask(task)}>
                      Відкрити
                    </DropdownMenuItem>

                    <DropdownMenuItem
                      disabled={task.archived}
                      onClick={() => {
                        if (!task.archived) onCreateSubtask(task)
                      }}
                    >
                      Підзадача
                    </DropdownMenuItem>

                    {canArchive && !task.archived && (
                      <DropdownMenuItem onClick={() => onDeleteTask(task)}>
                        В архів
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}

          {filteredItems.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-6 text-center text-sm">
                Задач немає. Змініть фільтри або створіть нову задачу.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}