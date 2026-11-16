import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

/**
 * Headline figure with a label and a supporting line, used for the summary rows above
 * Reports and Privacy Audit.
 *
 * Reports and Audit each had their own copy of this, which drifted: the same kind of figure
 * ended up monospaced on one page and not the other. Keeping one component is what stops
 * that recurring.
 */
export function MetricCard({
  description,
  title,
  value,
  numeric = true,
}: {
  description: string
  title: string
  value: number | string
  /**
   * Figures are monospaced with tabular numerals so they stay aligned down a row of cards.
   * Set false for word values such as a status verdict, which read as a glitch in a
   * typewriter face.
   */
  numeric?: boolean
}) {
  return (
    <Card className='max-w-full min-w-0 overflow-hidden'>
      <CardHeader className='pb-2'>
        <CardDescription>{title}</CardDescription>
        <CardTitle
          className={cn(
            'text-2xl [overflow-wrap:anywhere] break-words',
            numeric && 'font-mono tabular-nums'
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <p className='text-xs [overflow-wrap:anywhere] break-words text-muted-foreground'>
          {description}
        </p>
      </CardContent>
    </Card>
  )
}
