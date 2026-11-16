import { getVisibilityModel } from '@/domain/attendance/policies'
import {
  getPolicyVisibility,
  type PolicyRuleCheck,
  type VacationBalance,
} from '@/domain/attendance/policy-engine'
import type {
  AttendancePolicyConfig,
  AttendanceStatusType,
  PublicHoliday,
  WorkContract,
} from '@/domain/attendance/types'
import { useI18n } from '@/i18n'
import {
  BriefcaseBusiness,
  CalendarDays,
  Edit3,
  Eye,
  Plus,
  ShieldCheck,
  Trash2,
  Umbrella,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { TableBodySkeletonRows } from '@/components/flowpro/loading-skeletons'
import { PolicyMetric, VisibilityBadge } from './form-fields'

export function StatusTypesPanel({
  canManagePolicies,
  isLoading,
  onCreate,
  onDelete,
  onEdit,
  types,
}: {
  canManagePolicies: boolean
  isLoading: boolean
  onCreate: () => void
  onDelete: (id: string) => void
  onEdit: (type: AttendanceStatusType) => void
  types: AttendanceStatusType[]
}) {
  const { t } = useI18n()
  return (
    <Card className='min-h-0 min-w-0 overflow-hidden'>
      <CardHeader className='flex-none gap-3 pb-3 sm:flex-row sm:items-start sm:justify-between'>
        <div className='min-w-0 space-y-1'>
          <CardTitle className='text-base'>
            {t('attendanceUi.absenceStatusTypes')}
          </CardTitle>
          <CardDescription>
            {t('attendanceUi.absenceStatusTypesDescription')}
          </CardDescription>
        </div>

        <Button
          className='w-full gap-2 sm:w-fit'
          disabled={!canManagePolicies}
          onClick={onCreate}
        >
          <Plus className='h-4 w-4' />
          {t('attendanceUi.newStatus')}
        </Button>
      </CardHeader>

      <CardContent className='min-h-0 min-w-0 overflow-hidden p-0'>
        <div className='max-h-[60svh] min-h-0 w-full max-w-full overflow-auto overscroll-contain'>
          <Table className='min-w-[900px]'>
            <TableHeader className='sticky top-0 z-10 bg-background'>
              <TableRow>
                <TableHead className='w-24'>{t('attendanceUi.code')}</TableHead>
                <TableHead>{t('attendanceUi.name')}</TableHead>
                <TableHead>{t('attendanceUi.category')}</TableHead>
                <TableHead>{t('attendanceUi.teammate')}</TableHead>
                <TableHead>{t('settings.account.manager')}</TableHead>
                <TableHead>{t('attendanceUi.hrAdmin')}</TableHead>
                <TableHead className='w-32 text-right'>
                  {t('requestsUi.actions')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableBodySkeletonRows columns={7} rows={6} />
              ) : (
                types.map((type, index) => (
                  <TableRow
                    key={type.id}
                    className={cn(index % 2 === 1 && 'bg-muted/20')}
                  >
                    <TableCell>
                      <div className='flex items-center gap-2'>
                        <span
                          className='h-2.5 w-2.5 rounded-full'
                          style={{ backgroundColor: type.color }}
                        />
                        <span className='font-mono text-sm font-semibold'>
                          {type.code}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className='text-sm font-medium'>
                      {type.label}
                    </TableCell>
                    <TableCell>
                      <Badge variant='outline' className='capitalize'>
                        {type.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <VisibilityBadge value={type.teammateVisibility} />
                    </TableCell>
                    <TableCell>
                      <VisibilityBadge value={type.managerVisibility} />
                    </TableCell>
                    <TableCell>
                      <VisibilityBadge value={type.adminVisibility} />
                    </TableCell>
                    <TableCell>
                      <div className='flex justify-end gap-1'>
                        <Button
                          variant='ghost'
                          size='icon'
                          className='h-8 w-8'
                          aria-label={`Edit ${type.label}`}
                          disabled={!canManagePolicies}
                          onClick={() => onEdit(type)}
                        >
                          <Edit3 className='h-4 w-4' />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='h-8 w-8 text-muted-foreground hover:text-rose-500'
                              aria-label={`Delete ${type.label}`}
                              disabled={!canManagePolicies}
                            >
                              <Trash2 className='h-4 w-4' />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>
                                {t('attendanceUi.deleteStatusQuestion', {
                                  label: type.label,
                                })}
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                {t('attendanceUi.deleteStatusDescription')}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>
                                {t('attendanceUi.keepStatus')}
                              </AlertDialogCancel>
                              <AlertDialogAction
                                className='text-destructive-foreground bg-destructive hover:bg-destructive/90'
                                onClick={() => onDelete(type.id)}
                              >
                                {t('requestsUi.delete')}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

export function PolicyRulesPanel({
  canManagePolicies,
  holidayCalendar,
  onEditRules,
  policyChecks,
  policyConfig,
  previewWorkContract,
  sickType,
  vacationBalance,
}: {
  canManagePolicies: boolean
  holidayCalendar: PublicHoliday[]
  onEditRules: () => void
  policyChecks: PolicyRuleCheck[]
  policyConfig: AttendancePolicyConfig
  previewWorkContract: WorkContract
  sickType?: AttendanceStatusType
  vacationBalance: VacationBalance
}) {
  const { t } = useI18n()
  return (
    <div className='grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]'>
      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <ShieldCheck className='h-4 w-4 text-muted-foreground' />
            {t('attendanceUi.policyRulesEngine')}
          </CardTitle>
          <CardDescription>
            {t('attendanceUi.policyRulesEngineDescription')}
          </CardDescription>
        </CardHeader>
        <CardContent className='space-y-4'>
          <div className='grid gap-3 md:grid-cols-3'>
            <PolicyMetric
              title={t('attendanceUi.legalBreakRules')}
              value={`${policyConfig.legalBreaks.length}`}
              description={t('attendanceUi.rulesEvaluatedDescription')}
            />
            <PolicyMetric
              title={t('attendanceUi.holidayCalendar')}
              value={`${holidayCalendar.length}`}
              description={`${policyConfig.countryCode} + company days`}
            />
            <PolicyMetric
              title={t('attendanceUi.vacationEntitlement')}
              value={`${policyConfig.vacationAnnualDays} days`}
              description={t('attendanceUi.beforeCarryoverUsage')}
            />
          </div>

          <div className='rounded-md border'>
            <div className='grid gap-3 p-3 md:grid-cols-4'>
              <PolicyMetric
                title={t('attendanceUi.countryRegion')}
                value={`${policyConfig.countryCode}-${policyConfig.regionCode}`}
                description={t('attendanceUi.holidayLocalScope')}
              />
              <PolicyMetric
                title={t('attendanceUi.weeklyHours')}
                value={`${policyConfig.defaultWeeklyHours}h`}
                description={t('attendanceUi.defaultWorkingTimeContract')}
              />
              <PolicyMetric
                title={t('attendanceUi.carryover')}
                value={
                  policyConfig.vacationCarryover.enabled
                    ? t('attendanceUi.daysCount', {
                        count: policyConfig.vacationCarryover.maxDays,
                      })
                    : t('attendanceUi.off')
                }
                description={t('attendanceUi.expiresOn', {
                  date: `${String(policyConfig.vacationCarryover.expiresDay).padStart(2, '0')}.${String(policyConfig.vacationCarryover.expiresMonth).padStart(2, '0')}`,
                })}
              />
              <PolicyMetric
                title={t('attendanceUi.sicknessPrivacy')}
                value={policyConfig.sicknessPrivacyMode.split('-').join(' ')}
                description={t('attendanceUi.appliedBeforeVisibility')}
              />
            </div>
            <Separator />
            <div className='flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between'>
              <div className='space-y-2'>
                <p className='text-sm font-medium'>
                  {t('attendanceUi.breakRules')}
                </p>
                <div className='flex flex-wrap gap-2'>
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
              <Button
                className='w-full gap-2 sm:w-fit'
                disabled={!canManagePolicies}
                onClick={onEditRules}
              >
                <Edit3 className='h-4 w-4' />
                {t('attendanceUi.editRules')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className='space-y-6'>
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <CalendarDays className='h-4 w-4 text-muted-foreground' />
              {t('attendanceUi.holidayCalendar')}
            </CardTitle>
            <CardDescription>
              {t('attendanceUi.holidayCalendarDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            {holidayCalendar.slice(0, 6).map((holiday) => (
              <div
                key={holiday.id}
                className='flex items-center justify-between rounded-md border px-3 py-2 text-sm'
              >
                <span>{holiday.name}</span>
                <Badge variant='secondary'>{holiday.date}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <BriefcaseBusiness className='h-4 w-4 text-muted-foreground' />
              {t('attendanceUi.workingTimeModel')}
            </CardTitle>
            <CardDescription>
              {t('attendanceUi.workingTimeModelDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2 text-sm'>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>
                {t('attendanceUi.weeklyHours')}
              </span>
              <span className='font-medium'>
                {previewWorkContract.weeklyHours}
              </span>
            </div>
            <div className='flex justify-between'>
              <span className='text-muted-foreground'>
                {t('attendanceUi.workdays')}
              </span>
              <span className='font-medium'>
                {previewWorkContract.workdays.join(', ')}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='flex items-center gap-2 text-base'>
              <Umbrella className='h-4 w-4 text-muted-foreground' />
              {t('attendanceUi.rulePreview')}
            </CardTitle>
            <CardDescription>
              {t('attendanceUi.rulePreviewDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent className='space-y-2'>
            <div className='rounded-md border p-3 text-sm'>
              <p className='font-medium'>
                {t('attendanceUi.vacationDaysRemaining', {
                  count: String(vacationBalance.remainingDays),
                })}
              </p>
              <p className='text-xs text-muted-foreground'>
                {t('attendanceUi.carryoverSummary', {
                  available: String(vacationBalance.carryoverAvailableDays),
                  expired: String(vacationBalance.carryoverExpiredDays),
                })}
              </p>
            </div>
            {policyChecks.map((check) => (
              <Alert key={check.id}>
                <ShieldCheck className='h-4 w-4' />
                <AlertTitle>{check.title}</AlertTitle>
                <AlertDescription>{check.message}</AlertDescription>
              </Alert>
            ))}
            {sickType && (
              <div className='rounded-md border p-3 text-sm'>
                <p className='font-medium'>
                  {t('attendanceUi.sicknessVisibilityPreview')}
                </p>
                <p className='text-xs text-muted-foreground'>
                  {t('attendanceUi.teammate')}:{' '}
                  {getPolicyVisibility({
                    config: policyConfig,
                    statusType: sickType,
                    viewerRole: 'teammate',
                  })}
                  {' · '}
                  {t('settings.account.manager')}:{' '}
                  {getPolicyVisibility({
                    config: policyConfig,
                    statusType: sickType,
                    viewerRole: 'manager',
                  })}
                  {' · '}
                  {t('attendanceUi.hrAdmin')}:{' '}
                  {getPolicyVisibility({
                    config: policyConfig,
                    statusType: sickType,
                    viewerRole: 'admin',
                  })}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export function VisibilityPanel() {
  const { t } = useI18n()
  return (
    <Card>
      <CardHeader className='pb-3'>
        <CardTitle className='flex items-center gap-2 text-base'>
          <Eye className='h-4 w-4 text-muted-foreground' />
          {t('attendanceUi.visibilityModel')}
        </CardTitle>
        <CardDescription>
          {t('attendanceUi.visibilityModelDescription')}
        </CardDescription>
      </CardHeader>
      <CardContent className='p-0'>
        <Table containerClassName='max-h-[64svh] overflow-auto'>
          <TableHeader className='sticky top-0 z-10 bg-background'>
            <TableRow>
              <TableHead className='w-40'>{t('attendanceUi.viewer')}</TableHead>
              <TableHead>{t('attendanceUi.visibleInformation')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {getVisibilityModel().map((row, index) => (
              <TableRow
                key={row.viewer}
                className={cn(index % 2 === 1 && 'bg-muted/20')}
              >
                <TableCell className='font-medium'>{row.viewer}</TableCell>
                <TableCell className='whitespace-normal text-muted-foreground'>
                  {row.information}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
