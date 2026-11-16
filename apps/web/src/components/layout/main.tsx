import { cn } from '@/lib/utils'

type MainProps = React.HTMLAttributes<HTMLElement> & {
  constrained?: boolean
  fixed?: boolean
  fluid?: boolean
  ref?: React.Ref<HTMLElement>
}

export function Main({
  constrained,
  fixed,
  className,
  fluid: _fluid,
  ...props
}: MainProps) {
  return (
    <main
      data-layout={fixed ? 'fixed' : 'auto'}
      className={cn(
        'w-full max-w-full min-w-0 px-4 py-4 sm:px-6 sm:py-6',

        // If layout is fixed, make the main container flex and grow
        fixed && 'flex min-h-0 grow flex-col overflow-hidden',

        // Optional legacy page constraint. FlowPro pages default to full width.
        constrained &&
          '@7xl/content:mx-auto @7xl/content:w-full @7xl/content:max-w-7xl',
        className
      )}
      {...props}
    />
  )
}
