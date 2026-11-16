import { Link } from '@tanstack/react-router'
import { getRoleLabel } from '@/domain/access/access-control'
import { useI18n } from '@/i18n'
import {
  BadgeCheck,
  Bell,
  ChevronsUpDown,
  CreditCard,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/stores/auth-store'
import useDialogState from '@/hooks/use-dialog-state'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { SignOutDialog } from '@/components/sign-out-dialog'
import { useCurrentViewer } from '@/features/access/use-current-viewer'
import { useNotificationSummary } from '@/features/notifications/use-notification-summary'
import { WorkspaceMenuGroup } from '@/features/workspaces/workspace-menu'

type NavUserProps = {
  user: {
    name: string
    email: string
    avatar: string
  }
}

export function NavUser({ user }: NavUserProps) {
  const { t } = useI18n()
  const { isMobile } = useSidebar()
  const [open, setOpen] = useDialogState()
  const viewer = useCurrentViewer()
  const { unreadCount } = useNotificationSummary()
  const authUser = useAuthStore((state) => state.auth.user)
  const notificationBadge = unreadCount > 99 ? '99+' : String(unreadCount)
  const displayUser = {
    avatar: user.avatar,
    email: authUser?.email ?? user.email,
    name: viewer.name,
  }
  const initials = displayUser.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size='lg'
                className='data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground'
              >
                <Avatar className='h-8 w-8 rounded-lg'>
                  <AvatarImage
                    src={displayUser.avatar}
                    alt={displayUser.name}
                  />
                  <AvatarFallback className='rounded-lg'>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className='grid flex-1 text-start text-sm leading-tight'>
                  <span className='truncate font-semibold'>
                    {displayUser.name}
                  </span>
                  <span className='truncate text-xs'>{displayUser.email}</span>
                </div>
                <ChevronsUpDown className='ms-auto size-4' />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className='w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg'
              side={isMobile ? 'bottom' : 'right'}
              align='end'
              sideOffset={4}
            >
              <DropdownMenuLabel className='p-0 font-normal'>
                <div className='flex items-center gap-2 px-1 py-1.5 text-start text-sm'>
                  <Avatar className='h-8 w-8 rounded-lg'>
                    <AvatarImage
                      src={displayUser.avatar}
                      alt={displayUser.name}
                    />
                    <AvatarFallback className='rounded-lg'>
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className='grid flex-1 text-start text-sm leading-tight'>
                    <span className='truncate font-semibold'>
                      {displayUser.name}
                    </span>
                    <span className='truncate text-xs'>
                      {displayUser.email}
                    </span>
                    {/* The access level decides what the whole navigation shows, so it stays
                        visible with the identity it belongs to. */}
                    <Badge variant='outline' className='mt-1 w-fit font-normal'>
                      {getRoleLabel(viewer.role)}
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link to='/settings/account'>
                    <BadgeCheck />
                    {t('settingsUi.account')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to='/settings/account'>
                    <CreditCard />
                    {t('settings.account.updateAccount')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to='/settings/notifications'>
                    <Bell />
                    <span className='flex flex-1 items-center justify-between gap-2'>
                      <span>{t('settingsUi.notifications')}</span>
                      {unreadCount > 0 ? (
                        <Badge
                          variant='secondary'
                          className='h-5 min-w-5 rounded-full px-1.5 text-[10px]'
                          aria-label={`${unreadCount} unread notifications`}
                        >
                          {notificationBadge}
                        </Badge>
                      ) : null}
                    </span>
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <WorkspaceMenuGroup />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant='destructive'
                onClick={() => setOpen(true)}
              >
                <LogOut />
                {t('profileUi.signOut')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>

      <SignOutDialog open={!!open} onOpenChange={setOpen} />
    </>
  )
}
