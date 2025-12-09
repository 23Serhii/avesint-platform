import React, { useState } from 'react'
import useDialogState from '@/hooks/use-dialog-state'
import type { User } from '../data/schema'

type UsersDialogType = 'invite' | 'add' | 'edit' | 'delete' | 'view'

type UsersContextType = {
  open: UsersDialogType | null
  setOpen: (str: UsersDialogType | null) => void
  currentRow: User | null
  setCurrentRow: React.Dispatch<React.SetStateAction<User | null>>
  items: User[]
  setItems: React.Dispatch<React.SetStateAction<User[]>>
}

const UsersContext = React.createContext<UsersContextType | null>(null)

type UsersProviderProps = {
  children: React.ReactNode
  items: User[]
  setItems: React.Dispatch<React.SetStateAction<User[]>>
}

export function UsersProvider({ children, items, setItems }: UsersProviderProps) {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  const [open, setOpen] = useDialogState<UsersDialogType | null>(null)
  const [currentRow, setCurrentRow] = useState<User | null>(null)

  return (
    <UsersContext.Provider
      value={{ open, setOpen, currentRow, setCurrentRow, items, setItems }}
    >
      {children}
    </UsersContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useUsers = () => {
  const usersContext = React.useContext(UsersContext)

  if (!usersContext) {
    throw new Error('useUsers has to be used within <UsersProvider>')
  }

  return usersContext
}
