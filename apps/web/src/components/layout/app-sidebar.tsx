import {
  canManageAttendancePolicies,
  canManageUsers,
  canViewFullAudit,
  canViewReports,
  canViewTeamPlanning,
} from '@/domain/access/access-control'
import { useI18n } from '@/i18n'
import { useLayout } from '@/context/layout-provider'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from '@/components/ui/sidebar'
import { useCurrentViewer } from '@/features/access/use-current-viewer'
import { AppTitle } from './app-title'
import { createSidebarData } from './data/sidebar-data'
import { NavGroup } from './nav-group'
import { NavUser } from './nav-user'

export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const viewer = useCurrentViewer()
  const { t } = useI18n()
  const sidebarData = createSidebarData(t)
  const navGroups = sidebarData.navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (item.url === '/users') return canManageUsers(viewer)
        if (item.url === '/audit') return canViewFullAudit(viewer)
        if (item.url === '/settings/attendance') {
          return canManageAttendancePolicies(viewer)
        }
        if (item.url === '/planning') return canViewTeamPlanning(viewer)
        if (item.url === '/team-availability')
          return canViewTeamPlanning(viewer)
        if (item.url === '/reports') return canViewReports(viewer)

        return true
      }),
    }))
    .filter((group) => group.items.length > 0)

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarHeader>
        {/*
          This used to be a dropdown showing the signed-in name and role. It looked like a
          switcher but its menu only repeated what the trigger already said, and the footer
          shows the same person a third time. The header now carries the product identity and
          links home; who you are, and the access level you hold, live once in the footer.
        */}
        <AppTitle />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((props) => (
          <NavGroup key={props.title} {...props} />
        ))}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={sidebarData.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
