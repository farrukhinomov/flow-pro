import { useEffect, useMemo } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { getRoleLabel } from '@/domain/access/access-control'
import {
  WEEK_STARTS,
  WORK_LOCATION_PREFERENCES,
  type WeekStart,
  type WorkLocationPreference,
} from '@/domain/users/preferences'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { formatTimeZoneLabel, resolveBrowserTimeZone } from '@/lib/timezones'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCurrentEmployee } from '../use-current-employee'
import { useUserPreferences } from '../use-user-preferences'

const languages = [
  { label: 'English', value: 'en' },
  { label: 'Deutsch', value: 'de' },
] as const

type AccountFormValues = {
  defaultWorkLocation: WorkLocationPreference
  language: string
  weekStart: WeekStart
}

export function AccountForm() {
  const authUser = useAuthStore((state) => state.auth.user)
  const { setLocale, t } = useI18n()
  const { employee } = useCurrentEmployee()
  const { isSaving, preferences, save } = useUserPreferences()
  const accountFormSchema = useMemo(
    () =>
      z.object({
        defaultWorkLocation: z.enum(WORK_LOCATION_PREFERENCES),
        language: z.string().min(1, t('settings.account.selectLanguage')),
        weekStart: z.enum(WEEK_STARTS),
      }),
    [t]
  )
  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      defaultWorkLocation: preferences.defaultWorkLocation,
      language: preferences.locale,
      weekStart: preferences.weekStart,
    },
  })

  // Server preferences land after first paint, so refresh the form once they
  // do while keeping anything the user has already changed.
  const { reset } = form
  useEffect(() => {
    reset(
      {
        defaultWorkLocation: preferences.defaultWorkLocation,
        language: preferences.locale,
        weekStart: preferences.weekStart,
      },
      { keepDirtyValues: true }
    )
  }, [preferences, reset])

  async function onSubmit(data: AccountFormValues) {
    const saved = await save({
      ...preferences,
      defaultWorkLocation: data.defaultWorkLocation,
      locale: data.language,
      weekStart: data.weekStart,
    })

    if (!saved) return

    if (data.language === 'en' || data.language === 'de') {
      setLocale(data.language)
    }

    toast.success(t('settings.account.updated'))
  }

  return (
    <div className='space-y-6'>
      <div className='grid gap-3 sm:grid-cols-2'>
        <ReadonlyField
          label={t('settings.account.signedInAs')}
          value={authUser?.name ?? '-'}
        />
        <ReadonlyField label={t('auth.email')} value={authUser?.email ?? '-'} />
        <ReadonlyField
          label={t('settings.account.role')}
          value={authUser?.role[0] ? getRoleLabel(authUser.role[0]) : '-'}
        />
        <ReadonlyField
          label={t('settings.account.team')}
          value={employee?.team ?? '-'}
        />
        <ReadonlyField
          label={t('settings.account.manager')}
          value={employee?.manager ?? '-'}
        />
        <ReadonlyField
          label={t('settings.account.workPattern')}
          value={employee?.workPattern ?? '-'}
        />
        {/*
          Reported, not chosen. A per-user display time zone was offered here
          and honoured nowhere, and half-applying one to a working-time product
          is how bookings end up on the wrong day: which calendar day an instant
          belongs to has to be anchored once, for everyone reading the record,
          rather than varying per viewer. The workspace location time zone is
          the right anchor for that, and it is a larger change than a picker.
          Until then this states the truth: times render in this browser's zone.
        */}
        <ReadonlyField
          label={t('settings.account.timesShownIn')}
          value={formatTimeZoneLabel(resolveBrowserTimeZone())}
        />
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <FormField
            control={form.control}
            name='language'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('common.language')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue
                        placeholder={t('settings.account.selectLanguage')}
                      />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {languages.map((language) => (
                      <SelectItem key={language.value} value={language.value}>
                        {language.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  {t('settings.account.languageDescription')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField
              control={form.control}
              name='weekStart'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('settings.account.weekStartsOn')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='monday'>
                        {t('common.monday')}
                      </SelectItem>
                      <SelectItem value='sunday'>
                        {t('common.sunday')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name='defaultWorkLocation'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {t('settings.account.defaultWorkLocation')}
                  </FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value='office'>
                        {t('common.office')}
                      </SelectItem>
                      <SelectItem value='home-office'>
                        {t('common.homeOffice')}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Button type='submit' disabled={isSaving}>
            {t('settings.account.updateAccount')}
          </Button>
        </form>
      </Form>
    </div>
  )
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className='rounded-md border bg-muted/20 p-3'>
      <div className='text-xs text-muted-foreground'>{label}</div>
      <div className='mt-1 truncate text-sm font-medium'>{value}</div>
    </div>
  )
}
