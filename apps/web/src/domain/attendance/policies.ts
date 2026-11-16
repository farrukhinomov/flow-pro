import { tStatic } from '@/i18n/static'
import type {
  AttendanceCategory,
  AttendancePolicyConfig,
  AttendanceStatusType,
  VisibilityLevel,
} from './types'

export type VisibilityOption = { value: VisibilityLevel; label: string }
export type CategoryOption = { value: AttendanceCategory; label: string }

export function getVisibilityOptions(): VisibilityOption[] {
  return [
    { value: 'hidden', label: tStatic('attendanceUi.visibilityHidden') },
    { value: 'state-only', label: tStatic('attendanceUi.visibilityStateOnly') },
    {
      value: 'operational',
      label: tStatic('attendanceUi.visibilityOperational'),
    },
    { value: 'full', label: tStatic('attendanceUi.visibilityFull') },
  ]
}

export function getCategoryOptions(): CategoryOption[] {
  return [
    { value: 'remote', label: tStatic('attendanceUi.categoryRemote') },
    { value: 'leave', label: tStatic('attendanceUi.categoryLeave') },
    {
      value: 'unavailable',
      label: tStatic('attendanceUi.categoryUnavailable'),
    },
    { value: 'sickness', label: tStatic('attendanceUi.categorySickness') },
    { value: 'custom', label: tStatic('attendanceUi.categoryCustom') },
  ]
}

export function getVisibilityModel() {
  return [
    {
      viewer: tStatic('attendanceUi.viewerEmployee'),
      information: tStatic('attendanceUi.visibilityModelEmployee'),
    },
    {
      viewer: tStatic('attendanceUi.viewerTeammate'),
      information: tStatic('attendanceUi.visibilityModelTeammate'),
    },
    {
      viewer: tStatic('attendanceUi.viewerManager'),
      information: tStatic('attendanceUi.visibilityModelManager'),
    },
    {
      viewer: tStatic('attendanceUi.viewerHrAdmin'),
      information: tStatic('attendanceUi.visibilityModelHrAdmin'),
    },
  ]
}

export function getDefaultAttendanceTypes(now = new Date().toISOString()) {
  return [
    {
      id: 'ho',
      code: 'HO',
      label: tStatic('attendanceUi.defaultTypeHomeOffice'),
      category: 'remote',
      color: '#d946ef',
      teammateVisibility: 'state-only',
      managerVisibility: 'operational',
      adminVisibility: 'full',
      requiresApproval: true,
      auditRequired: true,
      updatedAt: now,
    },
    {
      id: 'vac',
      code: 'VAC',
      label: tStatic('attendanceUi.defaultTypeVacation'),
      category: 'leave',
      color: '#10b981',
      teammateVisibility: 'state-only',
      managerVisibility: 'operational',
      adminVisibility: 'full',
      requiresApproval: true,
      auditRequired: true,
      updatedAt: now,
    },
    {
      id: 'off',
      code: 'OFF',
      label: tStatic('attendanceUi.defaultTypeUnavailable'),
      category: 'unavailable',
      color: '#64748b',
      teammateVisibility: 'state-only',
      managerVisibility: 'operational',
      adminVisibility: 'full',
      requiresApproval: false,
      auditRequired: true,
      updatedAt: now,
    },
    {
      id: 'sick',
      code: 'SICK',
      label: tStatic('attendanceUi.defaultTypeSickLeave'),
      category: 'sickness',
      color: '#f59e0b',
      teammateVisibility: 'hidden',
      managerVisibility: 'operational',
      adminVisibility: 'full',
      requiresApproval: false,
      auditRequired: true,
      updatedAt: now,
    },
  ] satisfies AttendanceStatusType[]
}

export const emptyAttendanceTypeDraft = {
  code: '',
  label: '',
  category: 'custom',
  color: '#2563eb',
  teammateVisibility: 'state-only',
  managerVisibility: 'operational',
  adminVisibility: 'full',
  requiresApproval: true,
  auditRequired: true,
} satisfies Omit<AttendanceStatusType, 'id' | 'updatedAt'>

export function getDefaultAttendancePolicyConfig(
  now = new Date().toISOString()
): AttendancePolicyConfig {
  return {
    id: 'default',
    countryCode: 'DE',
    regionCode: 'DE',
    companyHolidays: [
      {
        id: 'company-2026-12-24',
        date: '2026-12-24',
        name: tStatic('attendanceUi.companyClosingDay'),
        paid: true,
      },
      {
        id: 'company-2026-12-31',
        date: '2026-12-31',
        name: tStatic('attendanceUi.companyClosingDay'),
        paid: true,
      },
    ],
    defaultWeeklyHours: 40,
    defaultWorkdays: [1, 2, 3, 4, 5],
    vacationAnnualDays: 30,
    vacationCarryover: {
      enabled: true,
      maxDays: 10,
      expiresMonth: 3,
      expiresDay: 31,
    },
    sicknessPrivacyMode: 'medical-confidential',
    legalBreaks: [
      { afterHours: 6, minimumMinutes: 30 },
      { afterHours: 9, minimumMinutes: 45 },
    ],
    periodWindows: {
      timesheet: {
        monthsBack: 24,
        monthsForward: 0,
      },
      reports: {
        monthsBack: 24,
        monthsForward: 0,
      },
      planning: {
        monthsBack: 0,
        monthsForward: 11,
      },
    },
    approvalRules: {
      autoApproveBookingCorrections: false,
      autoApproveBookingCorrectionThresholdMinutes: 15,
      autoApproveNonRequiredAbsences: true,
    },
    updatedAt: now,
  }
}
