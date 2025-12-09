import type { NewsSource } from '../data/news'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

type Props = {
  sources: NewsSource[]
}

export function NewsSourcesTable({ sources }: Props) {
  return (
    <div className="rounded-lg border">
      <div className="border-b px-4 py-3">
        <h3 className="font-semibold">Джерела</h3>
        <p className="text-xs text-muted-foreground">
          Telegram-канали, сайти, RSS та інші OSINT-джерела.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Назва</TableHead>
            <TableHead>Тип</TableHead>
            <TableHead>Надійність</TableHead>
            <TableHead>Статус</TableHead>
            <TableHead className="text-right">Остання активність</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((src) => (
            <TableRow key={src.id}>
              <TableCell className="font-medium">{src.name}</TableCell>
              <TableCell>
                <span className="text-xs uppercase text-muted-foreground">
                  {src.type}
                </span>
              </TableCell>
              <TableCell>{Math.round(src.reliability * 100)}%</TableCell>
              <TableCell>
                <Badge variant={src.isActive ? 'default' : 'outline'}>
                  {src.isActive ? 'Активне' : 'Вимкнене'}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {src.lastSeenAt
                  ? new Date(src.lastSeenAt).toLocaleString('uk-UA')
                  : '—'}
              </TableCell>
            </TableRow>
          ))}

          {sources.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-sm py-6">
                Джерела відсутні.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
