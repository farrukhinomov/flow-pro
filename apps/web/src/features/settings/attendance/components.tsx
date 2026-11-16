import { useRef, type Dispatch, type SetStateAction } from 'react'
import { getCategoryOptions } from '@/domain/attendance/policies'
import type {
  AttendanceCategory,
  AttendancePolicyConfig,
  PeriodWindowPolicy,
  SicknessPrivacyMode,
} from '@/domain/attendance/types'
import { useI18n } from '@/i18n'
import { Save } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { FlowProDrawer } from '@/components/flowpro/flowpro-drawer'
import { MultiSelectChips } from '@/components/flowpro/multi-select-chips'
import { weekdayValues } from './constants'
import { PeriodWindowFields, ToggleRow, VisibilitySelect } from './form-fields'
import type { AttendanceTypeDraft } from './types'

export function StatusTypeDrawer({
  canManagePolicies,
  draft,
  isEditing,
  onDraftChange,
  onOpenChange,
  onReset,
  onSave,
  open,
}: {
  canManagePolicies: boolean
  draft: AttendanceTypeDraft
  isEditing: boolean
  onDraftChange: Dispatch<SetStateAction<AttendanceTypeDraft>>
  onOpenChange: (open: boolean) => void
  onReset: () => void
  onSave: () => void
  open: boolean
}) {
  const { t } = useI18n()
  return (
    <FlowProDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={
        isEditing
          ? t('attendanceUi.updateAbsenceStatusType')
          : t('attendanceUi.createAbsenceStatusType')
      }
      description={t('attendanceUi.statusTypeDrawerDescription')}
      status={
        isEditing
          ? draft.code || t('requestsUi.editing')
          : t('attendanceUi.newStatus')
      }
      meta={t('attendanceUi.localFirstPolicyMeta')}
      footer={
        <>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
          <Button variant='outline' onClick={onReset}>
            {t('attendanceUi.reset')}
          </Button>
          <Button disabled={!canManagePolicies} onClick={onSave}>
            <Save className='h-4 w-4' />
            {isEditing
              ? t('usersUi.saveChanges')
              : t('attendanceUi.createStatus')}
          </Button>
        </>
      }
    >
      <div className='space-y-4'>
        <div className='grid gap-3 sm:grid-cols-[90px_1fr]'>
          <div className='space-y-2'>
            <Label htmlFor='status-code'>{t('attendanceUi.code')}</Label>
            <Input
              id='status-code'
              value={draft.code}
              maxLength={8}
              disabled={!canManagePolicies}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  code: event.target.value,
                }))
              }
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='status-label'>{t('attendanceUi.name')}</Label>
            <Input
              id='status-label'
              value={draft.label}
              disabled={!canManagePolicies}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  label: event.target.value,
                }))
              }
            />
          </div>
        </div>

        <div className='grid gap-3 sm:grid-cols-[1fr_90px]'>
          <div className='space-y-2'>
            <Label>{t('attendanceUi.category')}</Label>
            <Select
              value={draft.category}
              disabled={!canManagePolicies}
              onValueChange={(value) =>
                onDraftChange((current) => ({
                  ...current,
                  category: value as AttendanceCategory,
                }))
              }
            >
              <SelectTrigger aria-label={t('attendanceUi.category')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getCategoryOptions().map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='status-color'>{t('attendanceUi.color')}</Label>
            <Input
              id='status-color'
              type='color'
              value={draft.color}
              disabled={!canManagePolicies}
              onChange={(event) =>
                onDraftChange((current) => ({
                  ...current,
                  color: event.target.value,
                }))
              }
              className='px-1 py-1'
            />
          </div>
        </div>

        <Separator />

        <VisibilitySelect
          label={t('attendanceUi.teammatesSee')}
          value={draft.teammateVisibility}
          disabled={!canManagePolicies}
          onChange={(value) =>
            onDraftChange((current) => ({
              ...current,
              teammateVisibility: value,
            }))
          }
        />
        <VisibilitySelect
          label={t('attendanceUi.managersSee')}
          value={draft.managerVisibility}
          disabled={!canManagePolicies}
          onChange={(value) =>
            onDraftChange((current) => ({
              ...current,
              managerVisibility: value,
            }))
          }
        />
        <VisibilitySelect
          label={t('attendanceUi.hrAdminSee')}
          value={draft.adminVisibility}
          disabled={!canManagePolicies}
          onChange={(value) =>
            onDraftChange((current) => ({
              ...current,
              adminVisibility: value,
            }))
          }
        />

        <Separator />

        <div className='space-y-2'>
          <ToggleRow
            label={t('attendanceUi.requiresApproval')}
            active={draft.requiresApproval}
            disabled={!canManagePolicies}
            onToggle={() =>
              onDraftChange((current) => ({
                ...current,
                requiresApproval: !current.requiresApproval,
              }))
            }
          />
          <ToggleRow
            label={t('attendanceUi.auditRequired')}
            active={draft.auditRequired}
            disabled={!canManagePolicies}
            onToggle={() =>
              onDraftChange((current) => ({
                ...current,
                auditRequired: !current.auditRequired,
              }))
            }
          />
        </div>
      </div>
    </FlowProDrawer>
  )
}

export function PolicyRulesDrawer({
  canManagePolicies,
  onOpenChange,
  onPolicyChange,
  onSave,
  open,
  policyConfig,
}: {
  canManagePolicies: boolean
  onOpenChange: (open: boolean) => void
  onPolicyChange: (patch: Partial<AttendancePolicyConfig>) => void
  onSave: () => void
  open: boolean
  policyConfig: AttendancePolicyConfig
}) {
  const { t } = useI18n()
  const weekdayLabelByValue: Record<number, string> = {
    0: t('attendanceUi.sunday'),
    1: t('attendanceUi.monday'),
    2: t('attendanceUi.tuesday'),
    3: t('attendanceUi.wednesday'),
    4: t('attendanceUi.thursday'),
    5: t('attendanceUi.friday'),
    6: t('attendanceUi.saturday'),
  }
  const weekdayLabelToValue = Object.fromEntries(
    weekdayValues.map((value) => [weekdayLabelByValue[value], value])
  ) as Record<string, number>
  const carryoverExpiry = `${String(policyConfig.vacationCarryover.expiresDay).padStart(2, '0')}.${String(policyConfig.vacationCarryover.expiresMonth).padStart(2, '0')}`
  const carryoverExpiryInputRef = useRef<HTMLInputElement>(null)

  const updateCarryover = (
    patch: Partial<AttendancePolicyConfig['vacationCarryover']>
  ) => {
    onPolicyChange({
      vacationCarryover: {
        ...policyConfig.vacationCarryover,
        ...patch,
      },
    })
  }

  const updatePeriodWindow = (
    key: keyof AttendancePolicyConfig['periodWindows'],
    patch: Partial<PeriodWindowPolicy>
  ) => {
    onPolicyChange({
      periodWindows: {
        ...policyConfig.periodWindows,
        [key]: {
          ...policyConfig.periodWindows[key],
          ...patch,
        },
      },
    })
  }

  const commitCarryoverExpiry = (value: string) => {
    const [day, month] = value.split('.').map((part) => Number(part))
    if (!day || !month) return
    if (day < 1 || day > 31 || month < 1 || month > 12) return

    updateCarryover({
      expiresDay: day,
      expiresMonth: month,
    })
  }

  const saveRules = () => {
    commitCarryoverExpiry(
      carryoverExpiryInputRef.current?.value ?? carryoverExpiry
    )
    onSave()
  }

  return (
    <FlowProDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={t('attendanceUi.updateAttendanceRules')}
      description={t('attendanceUi.updateAttendanceRulesDescription')}
      status={`${policyConfig.countryCode}-${policyConfig.regionCode}`}
      meta={t('attendanceUi.savedRulesMeta')}
      footer={
        <>
          <Button variant='outline' onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
          <Button disabled={!canManagePolicies} onClick={saveRules}>
            <Save className='h-4 w-4' />
            {t('attendanceUi.saveRules')}
          </Button>
        </>
      }
    >
      <div className='space-y-5'>
        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='policy-country'>{t('attendanceUi.country')}</Label>
            <Input
              id='policy-country'
              value={policyConfig.countryCode}
              disabled={!canManagePolicies}
              onChange={(event) =>
                onPolicyChange({
                  countryCode: event.target.value.toUpperCase(),
                })
              }
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='policy-region'>{t('attendanceUi.region')}</Label>
            <Input
              id='policy-region'
              value={policyConfig.regionCode}
              disabled={!canManagePolicies}
              onChange={(event) =>
                onPolicyChange({
                  regionCode: event.target.value.toUpperCase(),
                })
              }
            />
          </div>
        </div>

        <div className='grid gap-3 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='policy-weekly-hours'>
              {t('attendanceUi.defaultWeeklyHours')}
            </Label>
            <Input
              id='policy-weekly-hours'
              type='number'
              min={1}
              value={policyConfig.defaultWeeklyHours}
              disabled={!canManagePolicies}
              onChange={(event) =>
                onPolicyChange({
                  defaultWeeklyHours: Number(event.target.value),
                })
              }
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='policy-vacation-days'>
              {t('attendanceUi.vacationEntitlement')}
            </Label>
            <Input
              id='policy-vacation-days'
              type='number'
              min={0}
              value={policyConfig.vacationAnnualDays}
              disabled={!canManagePolicies}
              onChange={(event) =>
                onPolicyChange({
                  vacationAnnualDays: Number(event.target.value),
                })
              }
            />
          </div>
        </div>

        <div className='space-y-2'>
          <Label>{t('attendanceUi.defaultWorkdays')}</Label>
          <MultiSelectChips
            values={policyConfig.defaultWorkdays
              .map((value) => weekdayLabelByValue[value])
              .filter((item): item is string => !!item)}
            options={weekdayValues.map((value) => weekdayLabelByValue[value])}
            placeholder={t('attendanceUi.addWorkday')}
            emptyLabel={t('attendanceUi.noDefaultWorkdays')}
            clearLabel={t('attendanceUi.clearWorkdays')}
            disabled={!canManagePolicies}
            onChange={(nextLabels) => {
              const nextValues = nextLabels
                .map((label) => weekdayLabelToValue[label])
                .filter((value): value is number => value !== undefined)
                .sort((a, b) => a - b)

              onPolicyChange({ defaultWorkdays: nextValues })
            }}
          />
        </div>

        <Separator />

        <div className='space-y-3'>
          <ToggleRow
            label={t('attendanceUi.allowVacationCarryover')}
            active={policyConfig.vacationCarryover.enabled}
            disabled={!canManagePolicies}
            onToggle={() =>
              updateCarryover({
                enabled: !policyConfig.vacationCarryover.enabled,
              })
            }
          />
          <div className='grid gap-3 sm:grid-cols-2'>
            <div className='space-y-2'>
              <Label htmlFor='policy-carryover-days'>
                {t('attendanceUi.maxCarryoverDays')}
              </Label>
              <Input
                id='policy-carryover-days'
                type='number'
                min={0}
                value={policyConfig.vacationCarryover.maxDays}
                disabled={!canManagePolicies}
                onChange={(event) =>
                  updateCarryover({
                    maxDays: Number(event.target.value),
                  })
                }
              />
            </div>
            <div className='space-y-2'>
              <Label htmlFor='policy-carryover-expiry'>
                {t('attendanceUi.carryoverExpiry')}
              </Label>
              <Input
                id='policy-carryover-expiry'
                key={carryoverExpiry}
                ref={carryoverExpiryInputRef}
                defaultValue={carryoverExpiry}
                placeholder={t('attendanceUi.carryoverExpiryPlaceholder')}
                disabled={!canManagePolicies}
                onBlur={(event) => commitCarryoverExpiry(event.target.value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        <div className='space-y-3'>
          <div>
            <p className='text-sm font-medium'>
              {t('attendanceUi.periodGovernance')}
            </p>
            <p className='mt-1 text-xs text-muted-foreground'>
              {t('attendanceUi.periodGovernanceDescription')}
            </p>
          </div>
          <div className='grid gap-3'>
            <PeriodWindowFields
              title={t('timesheetPage.title')}
              description={t('timesheetUi.periodFilterDescription')}
              policy={policyConfig.periodWindows.timesheet}
              disabled={!canManagePolicies}
              monthsBackLabel={t('attendanceUi.monthsBack')}
              monthsForwardLabel={t('attendanceUi.monthsForward')}
              onChange={(patch) => updatePeriodWindow('timesheet', patch)}
            />
            <PeriodWindowFields
              title={t('reportsUi.reportsPayroll')}
              description={t('reportsUi.reportsPayrollDescription')}
              policy={policyConfig.periodWindows.reports}
              disabled={!canManagePolicies}
              monthsBackLabel={t('attendanceUi.monthsBack')}
              monthsForwardLabel={t('attendanceUi.monthsForward')}
              onChange={(patch) => updatePeriodWindow('reports', patch)}
            />
            <PeriodWindowFields
              title={t('nav.planning')}
              description={t('planningUi.subtitle')}
              policy={policyConfig.periodWindows.planning}
              disabled={!canManagePolicies}
              monthsBackLabel={t('attendanceUi.monthsBack')}
              monthsForwardLabel={t('attendanceUi.monthsForward')}
              onChange={(patch) => updatePeriodWindow('planning', patch)}
            />
          </div>
        </div>

        <Separator />

        <div className='space-y-3'>
          <div>
            <p className='text-sm font-medium'>
              {t('attendanceUi.approvalAutomation')}
            </p>
            <p className='mt-1 text-xs text-muted-foreground'>
              {t('attendanceUi.approvalAutomationDescription')}
            </p>
          </div>
          <ToggleRow
            label={t('attendanceUi.autoApproveBookingCorrections')}
            active={policyConfig.approvalRules.autoApproveBookingCorrections}
            disabled={!canManagePolicies}
            onToggle={() =>
              onPolicyChange({
                approvalRules: {
                  ...policyConfig.approvalRules,
                  autoApproveBookingCorrections:
                    !policyConfig.approvalRules.autoApproveBookingCorrections,
                },
              })
            }
          />
          <div className='grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_160px] sm:items-center'>
            <div>
              <Label htmlFor='auto-approve-correction-threshold'>
                {t('attendanceUi.autoApproveCorrectionThreshold')}
              </Label>
              <p className='mt-1 text-xs text-muted-foreground'>
                {t('attendanceUi.autoApproveCorrectionThresholdDescription')}
              </p>
            </div>
            <Input
              id='auto-approve-correction-threshold'
              type='number'
              min={0}
              max={240}
              value={
                policyConfig.approvalRules
                  .autoApproveBookingCorrectionThresholdMinutes
              }
              disabled={!canManagePolicies}
              onChange={(event) =>
                onPolicyChange({
                  approvalRules: {
                    ...policyConfig.approvalRules,
                    autoApproveBookingCorrectionThresholdMinutes:
                      Number(event.target.value) || 0,
                  },
                })
              }
            />
          </div>
          <ToggleRow
            label={t('attendanceUi.autoApproveNonRequiredAbsences')}
            active={policyConfig.approvalRules.autoApproveNonRequiredAbsences}
            disabled={!canManagePolicies}
            onToggle={() =>
              onPolicyChange({
                approvalRules: {
                  ...policyConfig.approvalRules,
                  autoApproveNonRequiredAbsences:
                    !policyConfig.approvalRules.autoApproveNonRequiredAbsences,
                },
              })
            }
          />
        </div>

        <Separator />

        <div className='space-y-2'>
          <Label>{t('attendanceUi.sicknessPrivacyMode')}</Label>
          <Select
            value={policyConfig.sicknessPrivacyMode}
            disabled={!canManagePolicies}
            onValueChange={(value) =>
              onPolicyChange({
                sicknessPrivacyMode: value as SicknessPrivacyMode,
              })
            }
          >
            <SelectTrigger aria-label={t('attendanceUi.sicknessPrivacyMode')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value='medical-confidential'>
                {t('attendanceUi.medicalConfidential')}
              </SelectItem>
              <SelectItem value='manager-operational'>
                {t('attendanceUi.managerOperational')}
              </SelectItem>
              <SelectItem value='standard-visibility'>
                {t('attendanceUi.standardVisibility')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className='rounded-md border p-3'>
          <p className='text-sm font-medium'>
            {t('attendanceUi.legalBreakRules')}
          </p>
          <p className='mt-1 text-xs text-muted-foreground'>
            {t('attendanceUi.legalBreakRulesDescription')}
          </p>
          <div className='mt-3 flex flex-wrap gap-2'>
            {policyConfig.legalBreaks.map((rule) => (
              <Badge key={rule.afterHours} variant='outline'>
                {t('attendanceUi.afterHoursRule', {
                  hours: String(rule.afterHours),
                  minutes: String(rule.minimumMinutes),
                })}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </FlowProDrawer>
  )
}
