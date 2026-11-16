'use client'

import { useMemo } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { makeUserId } from '@/domain/users/commands'
import { upsertLocalUserCredential } from '@/domain/users/local-credentials'
import { useI18n } from '@/i18n'
import { formatLocaleDate } from '@/i18n/format'
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
import { FlowProDrawer } from '@/components/flowpro/flowpro-drawer'
import { SearchableSelect } from '@/components/flowpro/searchable-select'
import { PasswordInput } from '@/components/password-input'
import { SelectDropdown } from '@/components/select-dropdown'
import { type User } from '../data/schema'
import { useUsers } from './users-provider'

const createFormSchema = (t: (key: string) => string) =>
  z
    .object({
      firstName: z.string().min(1, t('usersValidation.firstNameRequired')),
      lastName: z.string().min(1, t('usersValidation.lastNameRequired')),
      username: z.string().min(1, t('usersValidation.usernameRequired')),
      phoneNumber: z.string().min(1, t('usersValidation.phoneRequired')),
      email: z.email({
        error: (iss) =>
          iss.input === '' ? t('usersValidation.emailRequired') : undefined,
      }),
      team: z.string().min(1, t('usersValidation.teamRequired')),
      manager: z.string().min(1, t('usersValidation.managerRequired')),
      workPattern: z.string().min(1, t('usersValidation.workPatternRequired')),
      visibilityScope: z
        .string()
        .min(1, t('usersValidation.visibilityRequired')),
      password: z.string().transform((pwd) => pwd.trim()),
      roleProfileId: z.string().min(1, t('usersValidation.roleRequired')),
      confirmPassword: z.string().transform((pwd) => pwd.trim()),
      isEdit: z.boolean(),
    })
    .refine(
      (data) => {
        if (data.isEdit && !data.password) return true
        return data.password.length > 0
      },
      {
        message: t('usersValidation.passwordRequired'),
        path: ['password'],
      }
    )
    .refine(
      ({ isEdit, password }) => {
        if (isEdit && !password) return true
        return password.length >= 8
      },
      {
        message: t('usersValidation.passwordLength'),
        path: ['password'],
      }
    )
    .refine(
      ({ isEdit, password }) => {
        if (isEdit && !password) return true
        return /[a-z]/.test(password)
      },
      {
        message: t('usersValidation.passwordLowercase'),
        path: ['password'],
      }
    )
    .refine(
      ({ isEdit, password }) => {
        if (isEdit && !password) return true
        return /\d/.test(password)
      },
      {
        message: t('usersValidation.passwordNumber'),
        path: ['password'],
      }
    )
    .refine(
      ({ isEdit, password, confirmPassword }) => {
        if (isEdit && !password) return true
        return password === confirmPassword
      },
      {
        message: t('usersValidation.passwordMatch'),
        path: ['confirmPassword'],
      }
    )
type UserForm = z.infer<ReturnType<typeof createFormSchema>>

type UserActionDialogProps = {
  currentRow?: User
  mode?: 'default' | 'manager'
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function UsersActionDialog({
  currentRow,
  mode = 'default',
  open,
  onOpenChange,
}: UserActionDialogProps) {
  const { locale, t } = useI18n()
  const formSchema = createFormSchema(t)
  const isEdit = !!currentRow
  const { managers, roleProfiles, saveUser, teams, workPatterns } = useUsers()
  const defaultRoleProfileIdForMode =
    mode === 'manager'
      ? (roleProfiles.find((profile) => profile.baseRole === 'manager')?.id ??
        '')
      : ''
  const getFallbackRoleProfileId = (role?: User['role']) =>
    roleProfiles.find((profile) => profile.baseRole === role)?.id ?? ''
  const form = useForm<UserForm>({
    resolver: zodResolver(formSchema),
    defaultValues: isEdit
      ? {
          ...currentRow,
          roleProfileId:
            currentRow.roleProfileId ??
            getFallbackRoleProfileId(currentRow.role),
          password: '',
          confirmPassword: '',
          isEdit,
        }
      : {
          firstName: '',
          lastName: '',
          username: '',
          email: '',
          roleProfileId: defaultRoleProfileIdForMode,
          phoneNumber: '',
          team: '',
          manager: '',
          workPattern: '',
          visibilityScope: '',
          password: '',
          confirmPassword: '',
          isEdit,
        },
  })

  const activeRoleProfiles = useMemo(
    () =>
      roleProfiles
        .filter((profile) => profile.status === 'active')
        .sort((left, right) => left.label.localeCompare(right.label, locale))
        .map((profile) => ({
          label: profile.label,
          value: profile.id,
        })),
    [locale, roleProfiles]
  )

  const teamOptions = useMemo(
    () =>
      teams
        .filter(
          (team) => team.status === 'active' || team.name === currentRow?.team
        )
        .sort((left, right) => left.name.localeCompare(right.name, locale))
        .map((team) => ({ label: team.name, value: team.name })),
    [currentRow, locale, teams]
  )

  const managerOptions = useMemo(
    () =>
      managers
        .sort((left, right) =>
          `${left.firstName} ${left.lastName}`.localeCompare(
            `${right.firstName} ${right.lastName}`,
            locale
          )
        )
        .map((manager) => ({
          label: `${manager.firstName} ${manager.lastName}`,
          value: `${manager.firstName} ${manager.lastName}`,
        })),
    [locale, managers]
  )

  const workPatternOptions = useMemo(
    () =>
      workPatterns
        .filter(
          (workPattern) =>
            workPattern.status === 'active' ||
            workPattern.label === currentRow?.workPattern
        )
        .sort((left, right) => left.label.localeCompare(right.label, locale))
        .map((workPattern) => ({
          label: workPattern.label,
          value: workPattern.label,
        })),
    [currentRow, locale, workPatterns]
  )

  const onSubmit = async (values: UserForm) => {
    const now = new Date()
    const selectedRoleProfile = roleProfiles.find(
      (profile) => profile.id === values.roleProfileId
    )
    const user: User = {
      id: currentRow?.id ?? makeUserId(values.username),
      firstName: values.firstName.trim(),
      lastName: values.lastName.trim(),
      username: values.username.trim().toLowerCase(),
      email: values.email.trim().toLowerCase(),
      phoneNumber: values.phoneNumber.trim(),
      status: currentRow?.status ?? 'active',
      role: selectedRoleProfile?.baseRole ?? 'employee',
      roleProfileId: values.roleProfileId,
      team: values.team.trim(),
      manager: values.manager.trim(),
      workPattern: values.workPattern.trim(),
      visibilityScope: values.visibilityScope.trim(),
      lastSeenAt: currentRow?.lastSeenAt,
      nextReviewAt: currentRow?.nextReviewAt,
      deactivatedAt: currentRow?.deactivatedAt,
      deactivatedBy: currentRow?.deactivatedBy,
      deactivationReason: currentRow?.deactivationReason,
      retentionUntil: currentRow?.retentionUntil,
      createdAt: currentRow?.createdAt ?? now,
      updatedAt: now,
    }

    await saveUser(user)
    upsertLocalUserCredential({
      email: user.email,
      password: values.password || undefined,
      userId: user.id,
    })
    form.reset()
    onOpenChange(false)
  }

  const isPasswordTouched = !!form.formState.dirtyFields.password

  return (
    <FlowProDrawer
      open={open}
      onOpenChange={(state) => {
        form.reset()
        onOpenChange(state)
      }}
      title={
        isEdit
          ? t('usersUi.editEmployeeAccess')
          : t('usersUi.createEmployeeProfile')
      }
      description={t('usersUi.employeeProfileDescription')}
      status={isEdit ? currentRow.status : t('usersUi.newEmployee')}
      meta={
        isEdit
          ? t('usersUi.lastUpdated', {
              date: formatLocaleDate(currentRow.updatedAt, locale, {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              }),
            })
          : t('usersUi.localFirstChange')
      }
      footer={
        <>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
          <Button type='submit' form='user-form'>
            {t('usersUi.saveChanges')}
          </Button>
        </>
      }
    >
      <Form {...form}>
        <form
          id='user-form'
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-4'
        >
          <FormField
            control={form.control}
            name='firstName'
            render={({ field }) => (
              <FormItem className='grid gap-2 space-y-0 sm:grid-cols-6 sm:items-center sm:gap-x-4 sm:gap-y-1'>
                <FormLabel className='col-span-2 text-end'>
                  {t('usersUi.firstName')}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('usersUi.firstNamePlaceholder')}
                    className='col-span-4'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='lastName'
            render={({ field }) => (
              <FormItem className='grid gap-2 space-y-0 sm:grid-cols-6 sm:items-center sm:gap-x-4 sm:gap-y-1'>
                <FormLabel className='col-span-2 text-end'>
                  {t('usersUi.lastName')}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('usersUi.lastNamePlaceholder')}
                    className='col-span-4'
                    autoComplete='off'
                    {...field}
                  />
                </FormControl>
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='username'
            render={({ field }) => (
              <FormItem className='grid gap-2 space-y-0 sm:grid-cols-6 sm:items-center sm:gap-x-4 sm:gap-y-1'>
                <FormLabel className='col-span-2 text-end'>
                  {t('usersUi.username')}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('usersUi.usernamePlaceholder')}
                    className='col-span-4'
                    {...field}
                  />
                </FormControl>
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='email'
            render={({ field }) => (
              <FormItem className='grid gap-2 space-y-0 sm:grid-cols-6 sm:items-center sm:gap-x-4 sm:gap-y-1'>
                <FormLabel className='col-span-2 text-end'>
                  {t('auth.email')}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('usersUi.emailPlaceholder')}
                    className='col-span-4'
                    {...field}
                  />
                </FormControl>
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='phoneNumber'
            render={({ field }) => (
              <FormItem className='grid gap-2 space-y-0 sm:grid-cols-6 sm:items-center sm:gap-x-4 sm:gap-y-1'>
                <FormLabel className='col-span-2 text-end'>
                  {t('usersUi.phoneNumber')}
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('usersUi.phonePlaceholder')}
                    className='col-span-4'
                    {...field}
                  />
                </FormControl>
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='roleProfileId'
            render={({ field }) => (
              <FormItem className='grid gap-2 space-y-0 sm:grid-cols-6 sm:items-center sm:gap-x-4 sm:gap-y-1'>
                <FormLabel className='col-span-2 text-end'>
                  {t('settings.account.role')}
                </FormLabel>
                <SearchableSelect
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={t('usersUi.selectRole')}
                  searchPlaceholder={t('usersUi.searchRoleProfiles')}
                  emptyLabel={t('usersUi.noRoleProfilesFound')}
                  className='col-span-4'
                  options={activeRoleProfiles}
                />
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='team'
            render={({ field }) => (
              <FormItem className='grid gap-2 space-y-0 sm:grid-cols-6 sm:items-center sm:gap-x-4 sm:gap-y-1'>
                <FormLabel className='col-span-2 text-end'>
                  {t('settings.account.team')}
                </FormLabel>
                <SearchableSelect
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={t('usersUi.teamPlaceholder')}
                  searchPlaceholder={t('usersUi.searchTeams')}
                  emptyLabel={t('usersUi.noTeamsFound')}
                  className='col-span-4'
                  options={teamOptions}
                />
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='manager'
            render={({ field }) => (
              <FormItem className='grid gap-2 space-y-0 sm:grid-cols-6 sm:items-center sm:gap-x-4 sm:gap-y-1'>
                <FormLabel className='col-span-2 text-end'>
                  {t('settings.account.manager')}
                </FormLabel>
                <SearchableSelect
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={t('usersUi.managerPlaceholder')}
                  searchPlaceholder={t('usersUi.searchManagers')}
                  emptyLabel={t('usersUi.noManagersFound')}
                  className='col-span-4'
                  options={managerOptions}
                />
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='workPattern'
            render={({ field }) => (
              <FormItem className='grid gap-2 space-y-0 sm:grid-cols-6 sm:items-center sm:gap-x-4 sm:gap-y-1'>
                <FormLabel className='col-span-2 text-end'>
                  {t('settings.account.workPattern')}
                </FormLabel>
                <SearchableSelect
                  value={field.value}
                  onValueChange={field.onChange}
                  placeholder={t('usersUi.workPatternPlaceholder')}
                  searchPlaceholder={t('usersUi.searchWorkPatterns')}
                  emptyLabel={t('usersUi.noWorkPatternsFound')}
                  className='col-span-4'
                  options={workPatternOptions}
                />
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='visibilityScope'
            render={({ field }) => (
              <FormItem className='grid gap-2 space-y-0 sm:grid-cols-6 sm:items-center sm:gap-x-4 sm:gap-y-1'>
                <FormLabel className='col-span-2 text-end'>
                  {t('usersUi.visibility')}
                </FormLabel>
                <SelectDropdown
                  defaultValue={field.value}
                  onValueChange={field.onChange}
                  placeholder={t('usersUi.selectVisibleData')}
                  className='col-span-4'
                  items={[
                    {
                      label: t('usersUi.availabilityOnly'),
                      value: 'Availability only',
                    },
                    {
                      label: t('usersUi.teamPlanningDetails'),
                      value: 'Team planning details',
                    },
                    {
                      label: t('usersUi.requestDetailsAuditTrail'),
                      value: 'Request details and audit trail',
                    },
                    {
                      label: t('usersUi.policyIntegrationAdministration'),
                      value: 'Policy and integration administration',
                    },
                    {
                      label: t('usersUi.fullPlatformAdministration'),
                      value: 'Full platform administration',
                    },
                  ]}
                />
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='password'
            render={({ field }) => (
              <FormItem className='grid gap-2 space-y-0 sm:grid-cols-6 sm:items-center sm:gap-x-4 sm:gap-y-1'>
                <FormLabel className='col-span-2 text-end'>
                  {t('auth.password')}
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder={t('usersUi.passwordPlaceholder')}
                    className='col-span-4'
                    {...field}
                  />
                </FormControl>
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name='confirmPassword'
            render={({ field }) => (
              <FormItem className='grid gap-2 space-y-0 sm:grid-cols-6 sm:items-center sm:gap-x-4 sm:gap-y-1'>
                <FormLabel className='col-span-2 text-end'>
                  {t('usersUi.confirmPassword')}
                </FormLabel>
                <FormControl>
                  <PasswordInput
                    disabled={!isPasswordTouched}
                    placeholder={t('usersUi.passwordPlaceholder')}
                    className='col-span-4'
                    {...field}
                  />
                </FormControl>
                <FormMessage className='col-span-4 col-start-3' />
              </FormItem>
            )}
          />
        </form>
      </Form>
    </FlowProDrawer>
  )
}
