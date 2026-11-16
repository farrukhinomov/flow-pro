import { useState } from 'react'
import type { OrganizationCatalogRecord } from '@/domain/organization/types'
import type { EmployeeUser, UserRole } from '@/domain/users/types'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { FlowProDrawer } from '@/components/flowpro/flowpro-drawer'
import { SearchableSelect } from '@/components/flowpro/searchable-select'
import {
  toCatalogSlug,
  type OrganizationDrawerState,
} from './organization-catalog-types'

/**
 * Create/edit drawer for every organization catalog.
 *
 * Split out of `organization-admin.tsx`, which was the largest file in the app
 * at 881 lines and held the five catalog tables, this drawer, and the manager
 * delegation panel in one component tree.
 */
export function CatalogDrawer({
  canManage,
  managers,
  onOpenChange,
  onSave,
  open,
  state,
}: {
  canManage: boolean
  managers: EmployeeUser[]
  onOpenChange: (open: boolean) => void
  onSave: (record: OrganizationCatalogRecord) => Promise<void>
  open: boolean
  state: OrganizationDrawerState
}) {
  const { t } = useI18n()
  const [label, setLabel] = useState(
    state?.kind === 'department' ||
      state?.kind === 'location' ||
      state?.kind === 'team'
      ? (state.record?.name ?? '')
      : (state?.record?.label ?? '')
  )
  const [code, setCode] = useState(
    state?.kind === 'department' || state?.kind === 'location'
      ? (state.record?.code ?? '')
      : ''
  )
  const [description, setDescription] = useState(
    state?.record?.description ?? ''
  )
  const [timeZoneId, setTimeZoneId] = useState(
    state?.kind === 'location'
      ? (state.record?.timeZoneId ?? 'Europe/Berlin')
      : 'Europe/Berlin'
  )
  const [baseRole, setBaseRole] = useState<UserRole>(
    state?.kind === 'role' ? (state.record?.baseRole ?? 'employee') : 'employee'
  )
  const [managerId, setManagerId] = useState(
    state?.kind === 'team' ? (state.record?.managerId ?? '') : ''
  )
  const [weeklyHours, setWeeklyHours] = useState(
    state?.kind === 'work-pattern'
      ? String(state.record?.weeklyHours ?? 40)
      : '40'
  )
  const [active, setActive] = useState(
    (state?.record?.status ?? 'active') === 'active'
  )

  const title = (() => {
    if (!state) return ''
    if (state.kind === 'department') {
      return state.record
        ? t('usersUi.editDepartment')
        : t('usersUi.newDepartment')
    }
    if (state.kind === 'location') {
      return state.record ? t('usersUi.editLocation') : t('usersUi.newLocation')
    }
    if (state.kind === 'role') {
      return state.record
        ? t('usersUi.editRoleProfile')
        : t('usersUi.newRoleProfile')
    }
    if (state.kind === 'team') {
      return state.record ? t('usersUi.editTeam') : t('usersUi.newTeam')
    }
    return state.record
      ? t('usersUi.editWorkPattern')
      : t('usersUi.newWorkPattern')
  })()

  const save = async () => {
    if (!state || !canManage || !label.trim()) return
    const now = new Date()

    if (state.kind === 'department') {
      const normalizedCode = code?.trim() || toCatalogSlug(label)
      await onSave({
        id: state.record?.id ?? `department-${normalizedCode.toLowerCase()}`,
        kind: 'department',
        code: normalizedCode,
        name: label.trim(),
        status: 'active',
        createdAt: state.record?.createdAt ?? now,
        updatedAt: now,
      })
    }

    if (state.kind === 'location') {
      const normalizedCode = code?.trim() || toCatalogSlug(label)
      await onSave({
        id: state.record?.id ?? `location-${normalizedCode.toLowerCase()}`,
        kind: 'location',
        code: normalizedCode,
        name: label.trim(),
        timeZoneId: timeZoneId.trim() || 'Europe/Berlin',
        status: 'active',
        createdAt: state.record?.createdAt ?? now,
        updatedAt: now,
      })
    }

    if (state.kind === 'role') {
      await onSave({
        id:
          state.record?.id ??
          `role-profile-${toCatalogSlug(label).toLowerCase()}`,
        kind: 'role-profile',
        label: label.trim(),
        baseRole,
        description: description.trim(),
        status: active ? 'active' : 'archived',
        createdAt: state.record?.createdAt ?? now,
        updatedAt: now,
      })
    }

    if (state.kind === 'team') {
      await onSave({
        id: state.record?.id ?? `team-${toCatalogSlug(label).toLowerCase()}`,
        kind: 'team',
        name: label.trim(),
        description: description.trim(),
        managerId: managerId || undefined,
        status: active ? 'active' : 'archived',
        createdAt: state.record?.createdAt ?? now,
        updatedAt: now,
      })
    }

    if (state.kind === 'work-pattern') {
      await onSave({
        id:
          state.record?.id ??
          `work-pattern-${toCatalogSlug(label).toLowerCase()}`,
        kind: 'work-pattern',
        label: label.trim(),
        description: description.trim(),
        weeklyHours: Number(weeklyHours) || 0,
        status: active ? 'active' : 'archived',
        createdAt: state.record?.createdAt ?? now,
        updatedAt: now,
      })
    }

    onOpenChange(false)
  }

  return (
    <FlowProDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={t('usersUi.organizationDrawerDescription')}
      footer={
        <>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
          <Button disabled={!canManage} onClick={() => void save()}>
            {t('usersUi.saveChanges')}
          </Button>
        </>
      }
    >
      {state ? (
        <div className='space-y-4'>
          {state.kind === 'department' || state.kind === 'location' ? (
            <div className='space-y-2'>
              <Label htmlFor='catalog-code'>{t('usersUi.code')}</Label>
              <Input
                id='catalog-code'
                value={code}
                onChange={(event) => setCode(event.target.value)}
              />
            </div>
          ) : null}
          <div className='space-y-2'>
            <Label htmlFor='catalog-label'>
              {state.kind === 'department' || state.kind === 'location'
                ? t('usersUi.name')
                : state.kind === 'team'
                  ? t('usersUi.team')
                  : t('usersUi.label')}
            </Label>
            <Input
              id='catalog-label'
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </div>
          {state.kind === 'role' ||
          state.kind === 'team' ||
          state.kind === 'work-pattern' ? (
            <div className='space-y-2'>
              <Label htmlFor='catalog-description'>
                {t('usersUi.description')}
              </Label>
              <Input
                id='catalog-description'
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
          ) : null}
          {state.kind === 'location' ? (
            <div className='space-y-2'>
              <Label htmlFor='catalog-time-zone'>{t('usersUi.timeZone')}</Label>
              <Input
                id='catalog-time-zone'
                value={timeZoneId}
                onChange={(event) => setTimeZoneId(event.target.value)}
              />
            </div>
          ) : null}
          {state.kind === 'role' ? (
            <div className='space-y-2'>
              <Label>{t('usersUi.baseRole')}</Label>
              <SearchableSelect
                value={baseRole}
                onValueChange={(value) => setBaseRole(value as UserRole)}
                options={[
                  { label: t('roles.superadmin'), value: 'superadmin' },
                  { label: t('roles.admin'), value: 'admin' },
                  { label: t('roles.hr'), value: 'hr' },
                  { label: t('roles.manager'), value: 'manager' },
                  { label: t('roles.employee'), value: 'employee' },
                ]}
              />
            </div>
          ) : null}
          {state.kind === 'team' ? (
            <div className='space-y-2'>
              <Label>{t('usersUi.manager')}</Label>
              <SearchableSelect
                value={managerId}
                onValueChange={setManagerId}
                placeholder={t('usersUi.selectManager')}
                searchPlaceholder={t('usersUi.searchManagers')}
                emptyLabel={t('usersUi.noManagersFound')}
                options={managers.map((manager) => ({
                  label: `${manager.firstName} ${manager.lastName}`,
                  value: manager.id,
                }))}
              />
            </div>
          ) : null}
          {state.kind === 'work-pattern' ? (
            <div className='space-y-2'>
              <Label>{t('usersUi.weeklyHours')}</Label>
              <Input
                type='number'
                min='0'
                step='0.5'
                value={weeklyHours}
                onChange={(event) => setWeeklyHours(event.target.value)}
              />
            </div>
          ) : null}
          {state.kind === 'role' ||
          state.kind === 'team' ||
          state.kind === 'work-pattern' ? (
            <div className='flex items-center justify-between rounded-lg border p-3'>
              <div>
                <div className='text-sm font-medium'>
                  {t('usersUi.activeCatalogEntry')}
                </div>
                <div className='text-xs text-muted-foreground'>
                  {t('usersUi.activeCatalogEntryDescription')}
                </div>
              </div>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
          ) : null}
        </div>
      ) : null}
    </FlowProDrawer>
  )
}
