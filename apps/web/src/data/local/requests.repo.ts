import { createRequestOperation } from '@/domain/requests/commands'
import type {
  AuditEvent,
  EmployeeRequest,
  RequestCommandResult,
} from '@/domain/requests/types'
import { enqueueOutbox } from './attendance.repo'
import { appendAuditEvent } from './audit.repo'
import { getAllFromStore, getFromStore, putInStore } from './db'

export async function listEmployeeRequests() {
  const requests = await getAllFromStore<EmployeeRequest>('employeeRequests')

  return requests.sort(
    (a, b) =>
      new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  )
}

export async function getEmployeeRequest(id: string) {
  return getFromStore<EmployeeRequest>('employeeRequests', id)
}

export async function saveEmployeeRequestCommand({
  auditEvent,
  request,
}: RequestCommandResult) {
  await putInStore('employeeRequests', request)
  await appendAuditEvent(auditEvent)
  await enqueueOutbox(createRequestOperation(request))
}

export async function updateEmployeeRequest(request: EmployeeRequest) {
  await putInStore('employeeRequests', request)
}

export async function listAuditEventsForRequest(requestId: string) {
  const auditEvents = await getAllFromStore<AuditEvent>('auditEvents')

  return auditEvents
    .filter((event) => event.aggregateId === requestId)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
}
