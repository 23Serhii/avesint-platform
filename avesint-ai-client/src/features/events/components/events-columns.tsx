import type { ColumnDef } from '@tanstack/react-table'
import type { Event } from '../data/schema'
import { Badge } from '@/components/ui/badge'
import { formatDistanceToNow } from 'date-fns'
import { uk } from 'date-fns/locale'

export const eventsColumns: ColumnDef<Event>[] = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => (
      <div className='font-medium line-clamp-2'>{row.original.title}</div>
    ),
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => (
      <Badge variant='outline' className='capitalize'>
        {row.original.type.replace('_', ' ')}
      </Badge>
    ),
  },
  {
    accessorKey: 'severity',
    header: 'Severity',
    cell: ({ row }) => {
      const severity = row.original.severity
      const variant =
        severity === 'critical'
          ? 'destructive'
          : severity === 'high'
            ? 'default'
            : 'outline'

      return (
        <Badge variant={variant as any} className='capitalize'>
          {severity}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => (
      <Badge variant='secondary' className='capitalize'>
        {row.original.status.replace('_', ' ')}
      </Badge>
    ),
  },
  {
    accessorKey: 'occurredAt',
    header: 'Occurred',
    cell: ({ row }) => {
      const date = new Date(row.original.occurredAt)
      return (
        <span className='text-xs text-muted-foreground'>
          {formatDistanceToNow(date, { addSuffix: true, locale: uk })}
        </span>
      )
    },
  },
  {
    accessorKey: 'confidence',
    header: 'Conf.',
    cell: ({ row }) => {
      const c = row.original.confidence
      if (c == null) return <span className='text-muted-foreground'>–</span>
      return <span>{Math.round(c * 100)}%</span>
    },
  },
]
