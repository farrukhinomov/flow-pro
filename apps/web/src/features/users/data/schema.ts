import { z } from 'zod'
import type { EmployeeUser } from '@/domain/users/types'

const userStatusSchema = z.union([
  z.literal('active'),
  z.literal('inactive'),
  z.literal('invited'),
  z.literal('suspended'),
])
export type UserStatus = z.infer<typeof userStatusSchema>

const userRoleSchema = z.union([
  z.literal('superadmin'),
  z.literal('admin'),
  z.literal('hr'),
  z.literal('manager'),
  z.literal('employee'),
])

export const userSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  username: z.string(),
  email: z.string(),
  phoneNumber: z.string(),
  status: userStatusSchema,
  role: userRoleSchema,
  roleProfileId: z.string().optional(),
  team: z.string(),
  manager: z.string(),
  workPattern: z.string(),
  visibilityScope: z.string(),
  lastSeenAt: z.coerce.date().optional(),
  nextReviewAt: z.coerce.date().optional(),
  deactivatedAt: z.coerce.date().optional(),
  deactivatedBy: z.string().optional(),
  deactivationReason: z.string().optional(),
  retentionUntil: z.coerce.date().optional(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type User = EmployeeUser
