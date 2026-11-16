import { useEffect } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { usersWorkflow } from '@/application/users-workflow'
import { resolveApiErrorMessage } from '@/data/api/api-error'
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
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { useCurrentEmployee } from '../use-current-employee'

function createProfileFormSchema(t: ReturnType<typeof useI18n>['t']) {
  return z.object({
    firstName: z.string().min(1, t('settingsUi.firstNameRequired')),
    lastName: z.string().min(1, t('settingsUi.lastNameRequired')),
    username: z
      .string()
      .min(2, t('settingsUi.usernameMinLength'))
      .max(40, t('settingsUi.usernameMaxLength')),
    email: z.email(),
    phoneNumber: z.string().min(1, t('settingsUi.phoneNumberRequired')),
  })
}

type ProfileFormValues = {
  email: string
  firstName: string
  lastName: string
  phoneNumber: string
  username: string
}

export function ProfileForm() {
  const { t } = useI18n()
  const authUser = useAuthStore((state) => state.auth.user)
  const setUser = useAuthStore((state) => state.auth.setUser)
  const { employee, isLoading } = useCurrentEmployee()
  const [firstName = '', ...lastNameParts] = authUser?.name.split(' ') ?? []
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(createProfileFormSchema(t)),
    defaultValues: {
      email: authUser?.email ?? '',
      firstName,
      lastName: lastNameParts.join(' '),
      phoneNumber: '',
      username: authUser?.email.split('@')[0] ?? '',
    },
    mode: 'onChange',
  })

  // The directory record arrives after first paint, so seed the form once it
  // does without clobbering edits the user has already started.
  const { reset } = form
  useEffect(() => {
    if (!employee) return

    reset(
      {
        email: authUser?.email ?? employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        phoneNumber: employee.phoneNumber,
        username: employee.username,
      },
      { keepDirtyValues: true }
    )
  }, [authUser?.email, employee, reset])

  const onSubmit = async (values: ProfileFormValues) => {
    if (!authUser || !employee) return

    try {
      await usersWorkflow.saveUser({
        ...employee,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phoneNumber: values.phoneNumber.trim(),
        updatedAt: new Date(),
        username: values.username.trim().toLowerCase(),
      })

      setUser({
        ...authUser,
        name: `${values.firstName.trim()} ${values.lastName.trim()}`,
      })
      toast.success(t('settingsUi.profileUpdated'))
    } catch (error) {
      // Previously the save was skipped when no record was found and success
      // was reported regardless, so a failed profile update looked like a
      // successful one.
      toast.error(
        resolveApiErrorMessage(error, t, 'settingsUi.profileUpdateFailed')
      )
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <FormField
            control={form.control}
            name='firstName'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('usersUi.firstName')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('usersUi.firstNamePlaceholder')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='lastName'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('usersUi.lastName')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('usersUi.lastNamePlaceholder')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name='username'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('usersUi.username')}</FormLabel>
              <FormControl>
                <Input
                  placeholder={t('usersUi.usernamePlaceholder')}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                {t('settingsUi.usernameDescription')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='email'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('settingsUi.signInEmail')}</FormLabel>
              <FormControl>
                <Input type='email' readOnly {...field} />
              </FormControl>
              <FormDescription>
                {t('settingsUi.signInEmailDescription')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='phoneNumber'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('usersUi.phoneNumber')}</FormLabel>
              <FormControl>
                <Input placeholder={t('usersUi.phonePlaceholder')} {...field} />
              </FormControl>
              <FormDescription>
                {t('settingsUi.phoneDescription')}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type='submit' disabled={isLoading || !employee}>
          {t('settingsUi.updateProfile')}
        </Button>
      </form>
    </Form>
  )
}
