import { useMemo, useState } from 'react'
import type { Entity } from '../data/entities'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type Props = {
  items: Entity[]
}

type TypeFilter = 'all' | Entity['type']
type StatusFilter = 'all' | Entity['status']
type SortMode = 'priority_desc' | 'priority_asc' | 'last_activity'

export function EntitiesTable({ items }: Props) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('priority_desc')

  const typeLabel = (t: Entity['type']) => {
    switch (t) {
      case 'infrastructure':
        return 'Інфраструктура'
      case 'hq':
        return 'Штаб / КП'
      case 'logistics':
        return 'Логістика / склад'
      case 'airfield':
        return 'Аеродром / ЗПС'
      case 'other':
      default:
        return 'Інше'
    }
  }

  const statusVariant = (s: Entity['status']) => {
    switch (s) {
      case 'active':
        return 'default'
      case 'under_observation':
        return 'outline'
      case 'neutralized':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const statusLabel = (s: Entity['status']) => {
    switch (s) {
      case 'active':
        return 'Активний'
      case 'under_observation':
        return 'Під спостереженням'
      case 'neutralized':
        return 'Нейтралізований'
      default:
        return s
    }
  }

  const filteredItems = useMemo(() => {
    return items
      .filter((ent) => {
        const text = (ent.name + ' ' + ent.sector).toLowerCase()
        const q = search.toLowerCase().trim()

        if (q && !text.includes(q)) {
          return false
        }

        if (typeFilter !== 'all' && ent.type !== typeFilter) {
          return false
        }

        if (statusFilter !== 'all' && ent.status !== statusFilter) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        if (sortMode === 'last_activity') {
          const da = a.lastActivityAt
            ? new Date(a.lastActivityAt).getTime()
            : 0
          const db = b.lastActivityAt
            ? new Date(b.lastActivityAt).getTime()
            : 0
          return db - da
        }

        if (sortMode === 'priority_asc') {
          return a.priority - b.priority
        }

        // priority_desc (1 = найвищий)
        return b.priority - a.priority
      })
  }, [items, search, typeFilter, statusFilter, sortMode])

  return (
    <div className="rounded-lg border">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-semibold">Обʼєкти та цілі</h3>
          <p className="text-xs text-muted-foreground">
            Каталог ключових обʼєктів розвідінтересу, повʼязаних з подіями та аналітикою.
          </p>
        </div>

        <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
          <Input
            placeholder="Пошук за назвою або сектором…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />

          <Select
            value={typeFilter}
            onValueChange={(v: TypeFilter) => setTypeFilter(v)}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Тип обʼєкта" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Будь-який тип</SelectItem>
              <SelectItem value="infrastructure">Інфраструктура</SelectItem>
              <SelectItem value="logistics">Логістика / склад</SelectItem>
              <SelectItem value="hq">Штаб / КП</SelectItem>
              <SelectItem value="airfield">Аеродром / ЗПС</SelectItem>
              <SelectItem value="other">Інше</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={statusFilter}
            onValueChange={(v: StatusFilter) => setStatusFilter(v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Будь-який статус</SelectItem>
              <SelectItem value="active">Активний</SelectItem>
              <SelectItem value="under_observation">Під спостереженням</SelectItem>
              <SelectItem value="neutralized">Нейтралізований</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={sortMode}
            onValueChange={(v: SortMode) => setSortMode(v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Сортування" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="priority_desc">Пріоритет: високий → низький</SelectItem>
              <SelectItem value="priority_asc">Пріоритет: низький → високий</SelectItem>
              <SelectItem value="last_activity">За останньою активністю</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Назва</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Сектор</TableHead>
            <TableHead>Пріоритет</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="text-right">Остання активність</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredItems.map((ent) => (
            <TableRow key={ent.id}>
              <TableCell className="font-medium">{ent.name}</TableCell>
              <TableCell>{typeLabel(ent.type)}</TableCell>
              <TableCell>{ent.sector}</TableCell>
              <TableCell>
                <Badge variant="outline">P{ent.priority}</Badge>
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant(ent.status) as any}>
                  {statusLabel(ent.status)}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {ent.lastActivityAt
                  ? new Date(ent.lastActivityAt).toLocaleString('uk-UA')
                  : '—'}
              </TableCell>
            </TableRow>
          ))}

          {filteredItems.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="py-6 text-center text-sm">
                Обʼєкти не знайдені. Змініть фільтри або запит.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
