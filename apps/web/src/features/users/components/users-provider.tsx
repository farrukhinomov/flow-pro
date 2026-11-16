import React, { useState } from 'react'
import type {
  RoleProfile,
  TeamCatalog,
  WorkPatternCatalog,
} from '@/domain/organization/types'
import type { EmployeeUser, UserRole } from '@/domain/users/types'
import useDialogState from '@/hooks/use-dialog-state'
import { type User } from '../data/schema'

type UsersDialogType = 'invite' | 'add' | 'add-manager' | 'edit' | 'deactivate'

type UsersContextType = {
  open: UsersDialogType | null
  setOpen: (str: UsersDialogType | null) => void
  currentRow: User | null
  setCurrentRow: React.Dispatch<React.SetStateAction<User | null>>
  users: User[]
  managers: EmployeeUser[]
  roleProfiles: RoleProfile[]
  teams: TeamCatalog[]
  workPatterns: WorkPatternCatalog[]
  deactivateUser: (
    user: User,
    reason?: string,
    actorId?: string
  ) => Promise<void>
  inviteUser: (draft: {
    email: string
    note?: string
    role: UserRole
  }) => Promise<void>
  reactivateUser: (user: User) => Promise<void>
  saveUser: (user: User) => Promise<void>
}

const UsersContext = React.createContext<UsersContextType | null>(null)

export function UsersProvider({
  children,
  deactivateUser = async () => undefined,
  inviteUser = async () => undefined,
  reactivateUser = async () => undefined,
  saveUser = async () => undefined,
  users = [],
  managers = [],
  roleProfiles = [],
  teams = [],
  workPatterns = [],
}: {
  children: React.ReactNode
  deactivateUser?: UsersContextType['deactivateUser']
  inviteUser?: UsersContextType['inviteUser']
  reactivateUser?: UsersContextType['reactivateUser']
  saveUser?: UsersContextType['saveUser']
  users?: User[]
  managers?: EmployeeUser[]
  roleProfiles?: RoleProfile[]
  teams?: TeamCatalog[]
  workPatterns?: WorkPatternCatalog[]
}) {
  const [open, setOpen] = useDialogState<UsersDialogType>(null)
  const [currentRow, setCurrentRow] = useState<User | null>(null)

  return (
    <UsersContext
      value={{
        currentRow,
        deactivateUser,
        inviteUser,
        open,
        reactivateUser,
        roleProfiles,
        saveUser,
        setCurrentRow,
        setOpen,
        teams,
        users,
        managers,
        workPatterns,
      }}
    >
      {children}
    </UsersContext>
  )
}

export const useUsers = () => {
  const usersContext = React.useContext(UsersContext)

  if (!usersContext) {
    throw new Error('useUsers has to be used within <UsersContext>')
  }

  return usersContext
}
