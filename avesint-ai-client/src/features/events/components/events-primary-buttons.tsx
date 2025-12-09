import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEvents } from './events-provider'

export function EventsPrimaryButtons() {
  const { setOpen, setCurrentRow } = useEvents()

  return (
    <div className='flex items-center gap-2'>
      <Button
        size='sm'
        onClick={() => {
          setCurrentRow(null)
          setOpen('create')
        }}
      >
        <Plus className='me-2 h-4 w-4' />
        New event
      </Button>
      {/* тут потім можна додати Import / Bulk actions під ТЗ */}
    </div>
  )
}
