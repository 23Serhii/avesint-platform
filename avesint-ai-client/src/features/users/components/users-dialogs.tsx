// src/features/users/components/users-dialogs.tsx
import { UsersActionDialog } from './users-action-dialog'
import { UsersDeleteDialog } from './users-delete-dialog'
import { UsersInviteDialog } from './users-invite-dialog'
import { UsersDetailsDialog } from './users-details-dialog'
import { useUsers } from './users-provider'

export function UsersDialogs() {
    const { open, setOpen, currentRow, setCurrentRow } = useUsers()

    const closeAll = () => {
        setOpen(null)
        setCurrentRow(null)
    }

    return (
        <>
            {/* Додавання нового користувача */}
            <UsersActionDialog
                key="user-add"
                open={open === 'add'}
                onOpenChange={(state) => {
                    if (!state) {
                        closeAll()
                    } else {
                        setOpen('add')
                        setCurrentRow(null)
                    }
                }}
            />

            {/* Інвайт по email */}
            <UsersInviteDialog
                key="user-invite"
                open={open === 'invite'}
                onOpenChange={(state) => {
                    if (!state) {
                        closeAll()
                    } else {
                        setOpen('invite')
                        setCurrentRow(null)
                    }
                }}
            />

            {currentRow && (
                <>
                    {/* Перегляд деталей користувача (клік "Переглянути") */}
                    <UsersDetailsDialog
                        key={`user-view-${currentRow.id}`}
                        open={open === 'view'}
                        onOpenChange={(state) => {
                            if (!state) {
                                // закриваємо тільки перегляд, але залишаємо currentRow,
                                // бо той самий користувач може потім йти в edit/delete
                                setOpen(null)
                            } else {
                                setOpen('view')
                            }
                        }}
                        currentRow={currentRow}
                    />

                    {/* Редагування користувача */}
                    <UsersActionDialog
                        key={`user-edit-${currentRow.id}`}
                        open={open === 'edit'}
                        onOpenChange={(state) => {
                            if (!state) {
                                setOpen(null)
                                // невелика затримка, щоб діалог встиг закритися перед очищенням
                                setTimeout(() => setCurrentRow(null), 200)
                            } else {
                                setOpen('edit')
                            }
                        }}
                        currentRow={currentRow}
                    />

                    {/* Видалення користувача */}
                    <UsersDeleteDialog
                        key={`user-delete-${currentRow.id}`}
                        open={open === 'delete'}
                        onOpenChange={(state) => {
                            if (!state) {
                                setOpen(null)
                                setTimeout(() => setCurrentRow(null), 200)
                            } else {
                                setOpen('delete')
                            }
                        }}
                        currentRow={currentRow}
                    />
                </>
            )}
        </>
    )
}