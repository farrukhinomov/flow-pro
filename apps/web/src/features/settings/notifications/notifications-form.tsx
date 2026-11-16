import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import { defaultNotificationPreferences } from '@/data/local/notifications.repo'
import {
  getNotificationPreferencesBackendFirst,
  saveNotificationPreferencesBackendFirst,
} from '@/data/notifications.gateway'
import type { NotificationPreferences } from '@/domain/notifications/types'
import { useI18n } from '@/i18n'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'

const notificationsFormSchema = z.object({
  approvalQueue: z.boolean(),
  requestDecisions: z.boolean(),
  securityEmails: z.boolean(),
  syncFailures: z.boolean(),
  timesheetExceptions: z.boolean(),
  weeklySummary: z.boolean(),
})

type NotificationsFormValues = z.infer<typeof notificationsFormSchema>

const defaultValues = toFormValues(defaultNotificationPreferences)

export function NotificationsForm() {
  const { t } = useI18n()
  const ownerUserId =
    useAuthStore((state) => state.auth.user?.accountNo) ?? 'anonymous'
  const [isLoading, setIsLoading] = useState(true)
  const form = useForm<NotificationsFormValues>({
    resolver: zodResolver(notificationsFormSchema),
    defaultValues,
  })

  useEffect(() => {
    let isMounted = true

    getNotificationPreferencesBackendFirst(ownerUserId)
      .then((preferences) => {
        if (!isMounted) return
        form.reset(toFormValues(preferences))
      })
      .catch((error) => {
        toast.error(
          resolveApiErrorMessage(
            error,
            t,
            'settingsUi.notificationsDescription'
          )
        )
      })
      .finally(() => {
        if (isMounted) setIsLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [form, ownerUserId, t])

  async function onSubmit(data: NotificationsFormValues) {
    await saveNotificationPreferencesBackendFirst(data, ownerUserId)
    toast.success(t('settingsUi.notificationsUpdated'))
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <NotificationSwitch
          control={form.control}
          name='requestDecisions'
          title={t('settingsUi.requestDecisions')}
          description={t('settingsUi.requestDecisionsDescription')}
        />
        <NotificationSwitch
          control={form.control}
          name='approvalQueue'
          title={t('settingsUi.approvalQueue')}
          description={t('settingsUi.approvalQueueDescription')}
        />
        <NotificationSwitch
          control={form.control}
          name='timesheetExceptions'
          title={t('settingsUi.timesheetExceptions')}
          description={t('settingsUi.timesheetExceptionsDescription')}
        />
        <NotificationSwitch
          control={form.control}
          name='syncFailures'
          title={t('settingsUi.offlineSyncFailures')}
          description={t('settingsUi.offlineSyncFailuresDescription')}
        />
        <NotificationSwitch
          control={form.control}
          name='weeklySummary'
          title={t('settingsUi.weeklyAttendanceSummary')}
          description={t('settingsUi.weeklyAttendanceSummaryDescription')}
        />
        <NotificationSwitch
          control={form.control}
          disabled
          name='securityEmails'
          title={t('settingsUi.securityEmails')}
          description={t('settingsUi.securityEmailsDescription')}
        />

        <Button
          disabled={isLoading || form.formState.isSubmitting}
          type='submit'
        >
          {t('settingsUi.updateNotifications')}
        </Button>
      </form>
    </Form>
  )
}

function toFormValues(
  preferences: NotificationPreferences
): NotificationsFormValues {
  return {
    approvalQueue: preferences.approvalQueue,
    requestDecisions: preferences.requestDecisions,
    securityEmails: preferences.securityEmails,
    syncFailures: preferences.syncFailures,
    timesheetExceptions: preferences.timesheetExceptions,
    weeklySummary: preferences.weeklySummary,
  }
}

function NotificationSwitch({
  control,
  description,
  disabled = false,
  name,
  title,
}: {
  control: ReturnType<typeof useForm<NotificationsFormValues>>['control']
  description: string
  disabled?: boolean
  name: keyof NotificationsFormValues
  title: string
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className='flex flex-row items-center justify-between gap-4 rounded-lg border p-4'>
          <div className='space-y-0.5'>
            <FormLabel className='text-base'>{title}</FormLabel>
            <FormDescription>{description}</FormDescription>
          </div>
          <FormControl>
            <Switch
              checked={field.value}
              disabled={disabled}
              onCheckedChange={field.onChange}
            />
          </FormControl>
        </FormItem>
      )}
    />
  )
}
