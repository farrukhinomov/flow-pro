import { type JSX } from 'react'
import { useLocation, Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

type SidebarNavProps = React.HTMLAttributes<HTMLElement> & {
  items: {
    href: string
    title: string
    icon: JSX.Element
  }[]
}

export function SidebarNav({ className, items, ...props }: SidebarNavProps) {
  const { pathname } = useLocation()

  return (
    <div className='overflow-x-auto'>
      <nav
        className={cn(
          // sm:w-fit keeps the bar the width of its tabs; it used to stretch across the
          // viewport, which read as an unfinished band above the content.
          'flex min-w-full flex-wrap items-center justify-start gap-1 rounded-lg bg-muted p-1 text-muted-foreground sm:w-fit sm:min-w-0 sm:flex-nowrap sm:gap-0',
          className
        )}
        {...props}
      >
        {items.map((item) => {
          const active = pathname === item.href

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                'inline-flex h-9 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none',
                active
                  ? 'bg-background text-foreground shadow-sm'
                  : 'hover:bg-background/60 hover:text-foreground'
              )}
            >
              {item.icon}
              {item.title}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
