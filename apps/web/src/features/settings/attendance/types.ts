import type { AttendanceStatusType } from '@/domain/attendance/types'

export type AttendanceTypeDraft = Omit<AttendanceStatusType, 'id' | 'updatedAt'>
