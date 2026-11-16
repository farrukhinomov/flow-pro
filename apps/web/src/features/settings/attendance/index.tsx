import { useEffect, useMemo, useState } from 'react'
import {
  canManageAttendancePolicies,
  getPermissionMessage,
} from '@/domain/access/access-control'
import { normalizeAttendanceTypeDraft } from '@/domain/attendance/commands'
import {
  emptyAttendanceTypeDraft,
  getDefaultAttendancePolicyConfig,
} from '@/domain/attendance/policies'
import {
  buildDefaultWorkContract,
  buildHolidayCalendar,
  calculateVacationBalance,
  evaluatePolicyRules,
} from '@/domain/attendance/policy-engine'
import type {
  AttendancePolicyConfig,
  AttendanceStatusType,
} from '@/domain/attendance/types'
import { useI18n } from '@/i18n'
import { ShieldCheck } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useCurrentViewer } from '@/features/access/use-current-viewer'
import { PolicyRulesDrawer, StatusTypeDrawer } from './components'
import { PolicyRulesPanel, StatusTypesPanel, VisibilityPanel } from './panels'
import type { AttendanceTypeDraft } from './types'
import { useAttendancePolicies } from './use-attendance-policies'

export function SettingsAttendance() {
  const { t } = useI18n()
  const viewer = useCurrentViewer()
  const canManagePolicies = canManageAttendancePolicies(viewer)
  const {
    config,
    deleteType: deletePolicyType,
    isLoading,
    saveConfig,
    saveType: savePolicyType,
    syncMeta,
    types,
  } = useAttendancePolicies()
  const [draft, setDraft] = useState<AttendanceTypeDraft>(
    emptyAttendanceTypeDraft
  )
  const [policyDraft, setPolicyDraft] = useState<AttendancePolicyConfig>(
    getDefaultAttendancePolicyConfig()
  )
  const [editingId, setEditingId] = useState<string | null>(null)
  const [policyRulesDrawerOpen, setPolicyRulesDrawerOpen] = useState(false)
  const [statusTypeDrawerOpen, setStatusTypeDrawerOpen] = useState(false)

  const editingType = useMemo(
    () => types.find((type) => type.id === editingId),
    [editingId, types]
  )

  const isEditing = !!editingType
  const policyConfig = policyDraft
  const previewNow = useMemo(() => new Date(), [])
  const previewDate = formatIsoDate(previewNow)
  const previewYear = previewNow.getFullYear()
  const vacationType = types.find((type) => type.category === 'leave')
  const sickType = types.find((type) => type.category === 'sickness')
  const policyHolidayCalendar = buildHolidayCalendar({
    config: policyConfig,
    year: previewYear,
  })
  const previewWorkContract = buildDefaultWorkContract({
    config: policyConfig,
    employee: {
      id: viewer.employeeId,
      firstName: viewer.name.split(' ')[0] ?? viewer.name,
      lastName: viewer.name.split(' ').slice(1).join(' ') || t('nav.levelUser'),
      username: viewer.name.toLowerCase().replace(/\s+/g, '.'),
      email: `${viewer.employeeId}@flowpro.local`,
      phoneNumber: '',
      status: 'active',
      role: viewer.role,
      team: viewer.managedTeam ?? t('attendanceUi.currentTeam'),
      manager: t('attendanceUi.configuredManager'),
      workPattern: t('attendanceUi.fullTime40h'),
      visibilityScope: t('attendanceUi.currentSession'),
      createdAt: previewNow,
      updatedAt: previewNow,
    },
  })
  const vacationBalance = calculateVacationBalance({
    annualUsedDays: 12,
    asOfDate: previewDate,
    carryoverDays: 6,
    config: policyConfig,
  })
  const policyChecks =
    vacationType && sickType
      ? [
          ...evaluatePolicyRules({
            balance: vacationBalance,
            config: policyConfig,
            requestedDays: 5,
            statusType: vacationType,
          }),
          ...evaluatePolicyRules({
            config: policyConfig,
            requestedDays: 1,
            statusType: sickType,
          }),
        ]
      : []

  const startCreate = () => {
    setEditingId(null)
    setDraft(emptyAttendanceTypeDraft)
    setStatusTypeDrawerOpen(true)
  }

  const startEdit = (type: AttendanceStatusType) => {
    setEditingId(type.id)
    setDraft({
      code: type.code,
      label: type.label,
      category: type.category,
      color: type.color,
      teammateVisibility: type.teammateVisibility,
      managerVisibility: type.managerVisibility,
      adminVisibility: type.adminVisibility,
      requiresApproval: type.requiresApproval,
      auditRequired: type.auditRequired,
    })
    setStatusTypeDrawerOpen(true)
  }

  const resetTypeDraft = () => {
    setEditingId(null)
    setDraft(emptyAttendanceTypeDraft)
  }

  const closeTypeDrawer = () => {
    setStatusTypeDrawerOpen(false)
    resetTypeDraft()
  }

  const saveType = async () => {
    if (!canManagePolicies) return

    const normalized = normalizeAttendanceTypeDraft(draft, editingType)

    if (!normalized.code || !normalized.label) return

    await savePolicyType(normalized)
    setStatusTypeDrawerOpen(false)
    resetTypeDraft()
  }

  const deleteType = async (id: string) => {
    if (!canManagePolicies) return

    await deletePolicyType(id)
    if (editingId === id) closeTypeDrawer()
  }

  useEffect(() => {
    // Keep the edit draft aligned when IndexedDB loads or imports a newer policy.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (config) setPolicyDraft(config)
  }, [config])

  const updatePolicyConfig = (patch: Partial<AttendancePolicyConfig>) => {
    if (!canManagePolicies) return

    setPolicyDraft((current) => ({
      ...current,
      ...patch,
    }))
  }

  const savePolicyRules = async () => {
    if (!canManagePolicies) return

    await saveConfig(policyDraft)
    setPolicyRulesDrawerOpen(false)
  }

  return (
    <div className='flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden'>
      <div className='flex-none'>
        <div className='flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between'>
          <div>
            <h3 className='text-lg font-medium'>
              {t('attendanceUi.attendancePolicies')}
            </h3>
            <p className='text-sm text-muted-foreground'>
              {t('attendanceUi.attendancePoliciesDescription')}
            </p>
          </div>
          {!!syncMeta?.pendingCount && (
            <Badge variant='outline' className='w-fit'>
              {t('requestsPage.syncing', {
                count: String(syncMeta.pendingCount),
              })}
            </Badge>
          )}
        </div>
      </div>

      <Separator className='my-4 flex-none' />

      <div className='faded-bottom min-h-0 w-full min-w-0 flex-1 overflow-y-auto scroll-smooth pe-4 pb-12'>
        <div className='space-y-6'>
          <Alert>
            <ShieldCheck className='h-4 w-4' />
            <AlertTitle>{t('teamAvailabilityUi.privacyByDefault')}</AlertTitle>
            <AlertDescription>
              {t('attendanceUi.privacyDescription')}
            </AlertDescription>
          </Alert>

          {!canManagePolicies && (
            <Alert>
              <ShieldCheck className='h-4 w-4' />
              <AlertTitle>{t('attendanceUi.policyChangesLocked')}</AlertTitle>
              <AlertDescription>
                {getPermissionMessage('manage-policies')}
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue='statuses' className='space-y-4'>
            <div className='overflow-x-auto'>
              <TabsList className='w-max min-w-max'>
                <TabsTrigger value='statuses'>
                  {t('attendanceUi.statuses')}
                </TabsTrigger>
                <TabsTrigger value='rules'>
                  {t('attendanceUi.rulesEngine')}
                </TabsTrigger>
                <TabsTrigger value='visibility'>
                  {t('attendanceUi.visibility')}
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value='statuses'>
              <StatusTypesPanel
                canManagePolicies={canManagePolicies}
                isLoading={isLoading}
                onCreate={startCreate}
                onDelete={(id) => void deleteType(id)}
                onEdit={startEdit}
                types={types}
              />
            </TabsContent>

            <TabsContent value='rules'>
              <PolicyRulesPanel
                canManagePolicies={canManagePolicies}
                holidayCalendar={policyHolidayCalendar}
                onEditRules={() => setPolicyRulesDrawerOpen(true)}
                policyChecks={policyChecks}
                policyConfig={policyConfig}
                previewWorkContract={previewWorkContract}
                sickType={sickType}
                vacationBalance={vacationBalance}
              />
            </TabsContent>

            <TabsContent value='visibility'>
              <VisibilityPanel />
            </TabsContent>
          </Tabs>

          <StatusTypeDrawer
            canManagePolicies={canManagePolicies}
            draft={draft}
            isEditing={isEditing}
            onDraftChange={setDraft}
            onOpenChange={(open) => {
              if (open) setStatusTypeDrawerOpen(true)
              else closeTypeDrawer()
            }}
            onReset={resetTypeDraft}
            onSave={() => void saveType()}
            open={statusTypeDrawerOpen}
          />

          <PolicyRulesDrawer
            canManagePolicies={canManagePolicies}
            onOpenChange={setPolicyRulesDrawerOpen}
            onPolicyChange={updatePolicyConfig}
            onSave={() => void savePolicyRules()}
            open={policyRulesDrawerOpen}
            policyConfig={policyConfig}
          />
        </div>
      </div>
    </div>
  )
}

function formatIsoDate(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}
