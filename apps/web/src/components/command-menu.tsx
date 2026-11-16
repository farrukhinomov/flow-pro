import React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useI18n } from '@/i18n'
import { formatDateRange } from '@/i18n/format'
import {
  ArrowRight,
  ChevronRight,
  FileClock,
  Laptop,
  Moon,
  Sun,
  User,
} from 'lucide-react'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useCurrentViewer } from '@/features/access/use-current-viewer'
import { useCommandSearchData } from './command-menu-data'
import { createSidebarData } from './layout/data/sidebar-data'
import { ScrollArea } from './ui/scroll-area'

export function CommandMenu() {
  const navigate = useNavigate()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const { locale, t } = useI18n()
  const viewer = useCurrentViewer()
  const sidebarData = createSidebarData(t)
  const { employees, requests } = useCommandSearchData(open, viewer)

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <CommandInput placeholder={t('commandUi.searchPlaceholder')} />
      <CommandList>
        <ScrollArea type='hover' className='h-72 pe-1'>
          <CommandEmpty>{t('commandUi.noMatchingAction')}</CommandEmpty>
          {sidebarData.navGroups.map((group) => (
            <CommandGroup key={group.title} heading={group.title}>
              {group.items.map((navItem, i) => {
                if (navItem.url)
                  return (
                    <CommandItem
                      key={`${navItem.url}-${i}`}
                      value={navItem.title}
                      onSelect={() => {
                        runCommand(() => navigate({ to: navItem.url }))
                      }}
                    >
                      <div className='flex size-4 items-center justify-center'>
                        <ArrowRight className='size-2 text-muted-foreground/80' />
                      </div>
                      {navItem.title}
                    </CommandItem>
                  )

                return navItem.items?.map((subItem, i) => (
                  <CommandItem
                    key={`${navItem.title}-${subItem.url}-${i}`}
                    value={`${navItem.title}-${subItem.url}`}
                    onSelect={() => {
                      runCommand(() => navigate({ to: subItem.url }))
                    }}
                  >
                    <div className='flex size-4 items-center justify-center'>
                      <ArrowRight className='size-2 text-muted-foreground/80' />
                    </div>
                    {navItem.title} <ChevronRight /> {subItem.title}
                  </CommandItem>
                ))
              })}
            </CommandGroup>
          ))}
          {employees.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={t('commandUi.people')}>
                {employees.map((employee) => (
                  <CommandItem
                    key={employee.id}
                    // cmdk matches on `value`, so team and email are included
                    // to make "support" or a partial address find the person.
                    value={`${employee.firstName} ${employee.lastName} ${employee.email} ${employee.team}`}
                    onSelect={() => {
                      runCommand(() =>
                        navigate({
                          search: { username: employee.username },
                          to: '/users',
                        })
                      )
                    }}
                  >
                    <User className='size-4 text-muted-foreground/80' />
                    <span className='truncate'>
                      {employee.firstName} {employee.lastName}
                    </span>
                    <span className='ms-auto truncate text-xs text-muted-foreground'>
                      {employee.team}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {requests.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading={t('commandUi.myRequests')}>
                {requests.map((request) => (
                  <CommandItem
                    key={request.id}
                    value={`${request.subtype} ${request.statusLabel ?? ''} ${request.fromDate} ${request.toDate}`}
                    onSelect={() => {
                      runCommand(() =>
                        navigate({
                          search: { kind: undefined },
                          to: '/requests',
                        })
                      )
                    }}
                  >
                    <FileClock className='size-4 text-muted-foreground/80' />
                    <span className='truncate'>
                      {request.statusLabel ?? request.subtype}
                    </span>
                    <span className='ms-auto truncate text-xs text-muted-foreground'>
                      {formatDateRange(
                        request.fromDate,
                        request.toDate,
                        locale
                      )}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          <CommandSeparator />
          <CommandGroup heading={t('settingsUi.theme')}>
            <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
              <Sun /> <span>{t('settingsUi.light')}</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
              <Moon className='scale-90' />
              <span>{t('settingsUi.dark')}</span>
            </CommandItem>
            <CommandItem onSelect={() => runCommand(() => setTheme('system'))}>
              <Laptop />
              <span>{t('commandUi.systemTheme')}</span>
            </CommandItem>
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </CommandDialog>
  )
}
