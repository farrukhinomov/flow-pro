import { UsersActionDialog } from './users-action-dialog'
import { UsersDeactivateDialog } from './users-deactivate-dialog'
import { UsersInviteDialog } from './users-invite-dialog'
import { useUsers } from './users-provider'

export function UsersDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useUsers()
  return (
    <>
      <UsersActionDialog
        key='user-add'
        open={open === 'add' || open === 'add-manager'}
        mode={open === 'add-manager' ? 'manager' : 'default'}
        onOpenChange={(state) =>
          setOpen(
            state ? (open === 'add-manager' ? 'add-manager' : 'add') : null
          )
        }
      />

      <UsersInviteDialog
        key='user-invite'
        open={open === 'invite'}
        onOpenChange={(state) => setOpen(state ? 'invite' : null)}
      />

      {currentRow && (
        <>
          <UsersActionDialog
            key={`user-edit-${currentRow.id}`}
            open={open === 'edit'}
            onOpenChange={(state) => {
              setOpen(state ? 'edit' : null)
              if (!state) {
                setTimeout(() => {
                  setCurrentRow(null)
                }, 500)
              }
            }}
            currentRow={currentRow}
          />

          <UsersDeactivateDialog
            key={`user-deactivate-${currentRow.id}`}
            open={open === 'deactivate'}
            onOpenChange={(state) => {
              setOpen(state ? 'deactivate' : null)
              if (!state) {
                setTimeout(() => {
                  setCurrentRow(null)
                }, 500)
              }
            }}
            currentRow={currentRow}
          />
        </>
      )}
    </>
  )
}
