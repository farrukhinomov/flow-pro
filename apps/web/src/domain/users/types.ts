export type UserStatus = 'active' | 'inactive' | 'invited' | 'suspended'

export type UserRole = 'superadmin' | 'admin' | 'hr' | 'manager' | 'employee'

export type EmployeeUser = {
  id: string
  firstName: string
  lastName: string
  username: string
  email: string
  phoneNumber: string
  status: UserStatus
  role: UserRole
  roleProfileId?: string
  team: string
  manager: string
  workPattern: string
  visibilityScope: string
  lastSeenAt?: Date
  nextReviewAt?: Date
  deactivatedAt?: Date
  deactivatedBy?: string
  deactivationReason?: string
  retentionUntil?: Date
  createdAt: Date
  updatedAt: Date
}
