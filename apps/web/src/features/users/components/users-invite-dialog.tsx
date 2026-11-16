import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { UserRole } from '@/domain/users/types'
import { useI18n } from '@/i18n'
import { Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FlowProDrawer } from '@/components/flowpro/flowpro-drawer'
import { SelectDropdown } from '@/components/select-dropdown'
import { roles } from '../data/data'
import { useUsers } from './users-provider'

const createFormSchema = (t: (key: string) => string) =>
  z.object({
    email: z.email({
      error: (iss) =>
        iss.input === '' ? t('usersValidation.inviteEmailRequired') : undefined,
    }),
    role: z.string().min(1, t('usersValidation.roleRequired')),
    desc: z.string().optional(),
  })

type UserInviteForm = z.infer<ReturnType<typeof createFormSchema>>

type UserInviteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UsersInviteDialog({
  open,
  onOpenChange,
}: UserInviteDialogProps) {
  const { t } = useI18n()
  const formSchema = createFormSchema(t)
  const { inviteUser } = useUsers()
  const form = useForm<UserInviteForm>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', role: '', desc: '' },
  })

  const onSubmit = async (values: UserInviteForm) => {
    await inviteUser({
      email: values.email,
      note: values.desc,
      role: values.role as UserRole,
    })
    form.reset()
    onOpenChange(false)
  }

  const handleOpenChange = (state: boolean) => {
    if (!state) form.reset()
    onOpenChange(state)
  }

  return (
    <FlowProDrawer
      open={open}
      onOpenChange={handleOpenChange}
      title={t('usersUi.inviteEmployee')}
      description={t('usersUi.inviteEmployeeDescription')}
      status={t('usersUi.invitation')}
      meta={t('usersUi.inviteMeta')}
      footer={
        <>
          <Button variant='outline' onClick={() => handleOpenChange(false)}>
            {t('common.close')}
          </Button>
          <Button type='submit' form='user-invite-form'>
            {t('usersUi.invite')} <Send />
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id='user-invite-form'
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-4'
        >
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('auth.email')}</FormLabel>
                <FormControl>
                  <Input
                    type='email'
                    placeholder={t('usersUi.inviteEmailPlaceholder')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='role'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('settings.account.role')}</FormLabel>
                <SelectDropdown
                  defaultValue={field.value}
                  onValueChange={field.onChange}
                  placeholder={t('usersUi.selectRole')}
                  items={roles.map(({ label, value }) => ({
                    label,
                    value,
                  }))}
                />
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='desc'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('usersUi.descriptionOptional')}</FormLabel>
                <FormControl>
                  <Textarea
                    className='resize-none'
                    placeholder={t('usersUi.descriptionPlaceholder')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FlowProDrawer>
  )
}
