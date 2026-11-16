import { Outlet } from '@tanstack/react-router'
import { isSessionAuthEnabled } from '@/data/auth/auth-mode'
import { useI18n } from '@/i18n'
import {
  Bell,
  DatabaseZap,
  Gauge,
  KeyRound,
  Palette,
  ShieldCheck,
  Wrench,
  UserCog,
} from 'lucide-react'
import { Separator } from '@/components/ui/separator'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { ThemeSwitch } from '@/components/theme-switch'
import { SidebarNav } from './components/sidebar-nav'

export function Settings() {
  const { t } = useI18n()
  const sidebarNavItems = [
    {
      title: t('settingsUi.profile'),
      href: '/settings',
      icon: <UserCog size={18} />,
    },
    {
      title: t('settingsUi.account'),
      href: '/settings/account',
      icon: <Wrench size={18} />,
    },
    ...(isSessionAuthEnabled()
      ? [
          {
            title: t('settingsUi.security'),
            href: '/settings/security',
            icon: <KeyRound size={18} />,
          },
        ]
      : []),
    {
      title: t('settingsUi.appearance'),
      href: '/settings/appearance',
      icon: <Palette size={18} />,
    },
    {
      title: t('settingsUi.notifications'),
      href: '/settings/notifications',
      icon: <Bell size={18} />,
    },
    {
      title: t('settingsUi.attendance'),
      href: '/settings/attendance',
      icon: <ShieldCheck size={18} />,
    },
    {
      title: t('syncHealthUi.title'),
      href: '/settings/sync-health',
      icon: <DatabaseZap size={18} />,
    },
    {
      title: t('qualityHealthUi.title'),
      href: '/settings/quality-health',
      icon: <Gauge size={18} />,
    },
  ]
  return (
    <>
      {/* ===== Top Heading ===== */}
      <Header>
        <div className='ms-auto flex items-center space-x-4'>
          <ThemeSwitch />
          <ProfileDropdown />
        </div>
      </Header>

      {/*
        One column for the whole settings surface. The heading and the tab bar used to run
        the full width of the viewport while the forms stopped at their readable measure,
        which left a wide ragged gutter down the right on desktop.
      */}
      <Main className='flex w-full min-w-0 flex-1 flex-col overflow-hidden xl:max-w-5xl'>
        <div className='space-y-0.5'>
          <h1 className='text-2xl font-bold tracking-tight md:text-3xl'>
            {t('settingsUi.settings')}
          </h1>
          <p className='text-muted-foreground'>
            {t('settingsUi.settingsDescription')}
          </p>
        </div>
        <Separator className='my-4 lg:my-6' />
        <div className='flex min-h-0 flex-1 flex-col gap-4 overflow-hidden'>
          <SidebarNav items={sidebarNavItems} />
          <div className='flex min-h-0 w-full min-w-0 overflow-hidden p-1'>
            <Outlet />
          </div>
        </div>
      </Main>
    </>
  )
}
