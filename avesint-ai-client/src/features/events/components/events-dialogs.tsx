import { ConfirmDialog } from '@/components/confirm-dialog'
import { useEvents } from './events-provider'
import { EventsMutateDrawer } from './events-mutate-drawer'

export function EventsDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useEvents()

  const handleClose = () => {
    setOpen(null)
    setCurrentRow(null)
  }

  return (
    <>
      {/* Create */}
      <EventsMutateDrawer
        key='event-create'
        mode='create'
        open={open === 'create'}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            handleClose()
          } else {
            setOpen('create')
          }
        }}
      />

      {/* Update */}
      <EventsMutateDrawer
        key='event-update'
        mode='update'
        open={open === 'update'}
        currentRow={currentRow}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            handleClose()
          } else {
            setOpen('update')
          }
        }}
      />

      {/* Delete */}
      <ConfirmDialog
        key='event-delete'
        destructive
        title='Delete event'
        desc='Are you sure you want to delete this event? This action cannot be undone.'
        confirmText='Delete'
        open={open === 'delete'}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            handleClose()
          } else {
            setOpen('delete')
          }
        }}
        handleConfirm={async () => {
          if (!currentRow) return
          // TODO: тут викликаємо deleteEvent(currentRow.id)
          // await deleteEvent(currentRow.id)
          handleClose()
        }}
      />
    </>
  )
}
