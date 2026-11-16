import {
  CalendarDays,
  House,
  ListChecks,
  NotebookTabs,
  Settings,
  Sheet,
  ShieldCheck,
  Users,
} from 'lucide-react'
import { type SidebarData } from '../types'

export function createSidebarData(t: (key: string) => string): SidebarData {
  return {
    user: {
      name: 'Marta Lindgren',
      email: 'founder@flowpro.local',
      avatar: '/avatars/01.png',
    },
    navGroups: [
      {
        title: t('nav.workday'),
        items: [
          {
            title: t('nav.today'),
            url: '/',
            icon: House,
          },
          {
            title: t('nav.myTime'),
            url: '/timesheet',
            icon: Sheet,
          },
          {
            title: t('nav.planning'),
            url: '/planning',
            icon: CalendarDays,
          },
          {
            title: t('nav.requests'),
            url: '/requests',
            icon: ListChecks,
          },
          {
            title: t('nav.teamAvailability'),
            url: '/team-availability',
            icon: Users,
          },
          {
            title: t('nav.reports'),
            url: '/reports',
            icon: NotebookTabs,
          },
        ],
      },
      {
        title: t('nav.administration'),
        items: [
          {
            title: t('nav.users'),
            url: '/users',
            icon: Users,
          },
          {
            title: t('nav.privacyAudit'),
            url: '/audit',
            icon: ShieldCheck,
          },
          {
            title: t('nav.settings'),
            url: '/settings',
            icon: Settings,
          },
          {
            title: t('nav.attendancePolicies'),
            url: '/settings/attendance',
            icon: ShieldCheck,
          },
        ],
      },
    ],
  }
}
