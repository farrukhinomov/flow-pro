import { useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UserPreferences } from '@/domain/users/preferences'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useUserPreferences } from '../use-user-preferences'

const itemIds = [
  'density-compact',
  'show-sync',
  'show-policy-hints',
  'full-width-pages',
] as const

type DisplayItemId = (typeof itemIds)[number]

/**
 * The form models these as a checkbox list while the server stores one boolean
 * per setting, so the two shapes are mapped here rather than reshaping either
 * side to match the other.
 */
const ITEM_TO_PREFERENCE: Record<DisplayItemId, keyof UserPreferences> = {
  'density-compact': 'densityCompact',
  'full-width-pages': 'fullWidthPages',
  'show-policy-hints': 'showPolicyHints',
  'show-sync': 'showSyncStatus',
}

function toItems(preferences: UserPreferences): DisplayItemId[] {
  return itemIds.filter((id) => preferences[ITEM_TO_PREFERENCE[id]] === true)
}

function applyItems(
  preferences: UserPreferences,
  items: string[]
): UserPreferences {
  const selected = new Set(items)

  return itemIds.reduce<UserPreferences>(
    (next, id) => ({ ...next, [ITEM_TO_PREFERENCE[id]]: selected.has(id) }),
    preferences
  )
}

function createDisplayFormSchema() {
  return z.object({
    // Every option may legitimately be turned off, so an empty selection is
    // valid; the previous "pick at least one" rule blocked that.
    items: z.array(z.string()),
  })
}

type DisplayFormValues = {
  items: string[]
}

export function DisplayForm() {
  const { t } = useI18n()
  const { isSaving, preferences, save } = useUserPreferences()
  const items = itemIds.map((id) => ({
    id,
    label: t(`settingsUi.displayItems.${id}.label`),
    description: t(`settingsUi.displayItems.${id}.description`),
  }))
  const form = useForm<DisplayFormValues>({
    resolver: zodResolver(createDisplayFormSchema()),
    defaultValues: { items: toItems(preferences) },
  })

  const { reset } = form
  useEffect(() => {
    reset({ items: toItems(preferences) }, { keepDirtyValues: true })
  }, [preferences, reset])

  async function onSubmit(data: DisplayFormValues) {
    if (await save(applyItems(preferences, data.items))) {
      toast.success(t('settingsUi.displayUpdated'))
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <FormField
          control={form.control}
          name='items'
          render={() => (
            <FormItem>
              <div className='mb-4'>
                <FormLabel className='text-base'>
                  {t('settingsUi.workSurface')}
                </FormLabel>
                <FormDescription>
                  {t('settingsUi.workSurfaceDescription')}
                </FormDescription>
              </div>
              <div className='space-y-3'>
                {items.map((item) => (
                  <FormField
                    key={item.id}
                    control={form.control}
                    name='items'
                    render={({ field }) => (
                      <FormItem className='flex flex-row items-start gap-3 rounded-lg border p-4'>
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(item.id)}
                            onCheckedChange={(checked) =>
                              checked
                                ? field.onChange([...field.value, item.id])
                                : field.onChange(
                                    field.value?.filter(
                                      (value) => value !== item.id
                                    )
                                  )
                            }
                          />
                        </FormControl>
                        <div className='space-y-1 leading-none'>
                          <FormLabel className='font-medium'>
                            {item.label}
                          </FormLabel>
                          <FormDescription>{item.description}</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type='submit' disabled={isSaving}>
          {t('settingsUi.updateDisplay')}
        </Button>
      </form>
    </Form>
  )
}
