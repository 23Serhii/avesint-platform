import type { NewsItem } from '../data/news'
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
  items: NewsItem[]
}

export function NewsFeedTable({ items }: Props) {
  const severityVariant = (s: NewsItem['severity']) => {
    switch (s) {
      case 'high':
        return 'destructive'
      case 'medium':
        return 'default'
      case 'low':
      default:
        return 'outline'
    }
  }

  return (
    <div className="rounded-lg border">
      <div className="border-b px  -4 py-3">
        <h3 className="font-semibold">Стрічка новин</h3>
        <p className="text-xs text-muted-foreground">
          Останні повідомлення з підключених джерел перед обробкою аналітиком.
        </p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Заголовок</TableHead>
            <TableHead>Джерело</TableHead>
            <TableHead>Важливість</TableHead>
            <TableHead className="text-right">Час</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                {item.title}
              </TableCell>
              <TableCell>
                <span className="text-xs text-muted-foreground">
                  {item.sourceName}
                </span>
              </TableCell>
              <TableCell>
                <Badge variant={severityVariant(item.severity) as any}>
                  {item.severity === 'high'
                    ? 'Висока'
                    : item.severity === 'medium'
                      ? 'Середня'
                      : 'Низька'}
                </Badge>
              </TableCell>
              <TableCell className="text-right text-xs text-muted-foreground">
                {new Date(item.createdAt).toLocaleString('uk-UA')}
              </TableCell>
            </TableRow>
          ))}

          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm py-6">
                Новин немає.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
