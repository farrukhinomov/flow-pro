import { tStatic } from '@/i18n/static'

const DB_NAME = 'flowpro-client'
export const LOCAL_DB_SCHEMA_VERSION = 13
const MIGRATION_NOTES = [
  {
    version: 13,
    title: 'Quality bug register',
    description:
      'Confirmed quality bugs can now be tracked locally with severity, owner, product area, and SLA age.',
  },
  {
    version: 12,
    title: 'Planning and reports package cache',
    description:
      'Planning and reports workflow packages are now cached by period for faster local-first screens.',
  },
  {
    version: 11,
    title: 'Employment contract cache',
    description:
      'Employment contract projections are now cached for local-first planning, timesheet, and report reads.',
  },
  {
    version: 10,
    title: 'Workflow side-effect cache',
    description:
      'Approved absences, in-app notifications, and payroll export records are now cached from backend workflow sync events.',
  },
  {
    version: 9,
    title: 'Server-backed notification preferences',
    description:
      'Notification preferences are now stored in the local sync database and replicated through the FlowPro backend.',
  },
  {
    version: 8,
    title: tStatic('syncUi.migrationNotes.organizationCatalogs.title'),
    description: tStatic(
      'syncUi.migrationNotes.organizationCatalogs.description'
    ),
  },
  {
    version: 7,
    title: tStatic('syncUi.migrationNotes.managerDelegations.title'),
    description: tStatic(
      'syncUi.migrationNotes.managerDelegations.description'
    ),
  },
  {
    version: 6,
    title: tStatic('syncUi.migrationNotes.attendancePolicyConfig.title'),
    description: tStatic(
      'syncUi.migrationNotes.attendancePolicyConfig.description'
    ),
  },
]

const DB_VERSION = LOCAL_DB_SCHEMA_VERSION

const STORE_NAMES = [
  'absences',
  'attendancePolicyConfigs',
  'attendanceTypes',
  'clockEvents',
  'employeeUsers',
  'employmentContracts',
  'managerDelegations',
  'notifications',
  'organizationCatalogs',
  'notificationPreferences',
  'payrollExports',
  'planningPackages',
  'qualityBugs',
  'employeeRequests',
  'reportsPackages',
  'timeCorrections',
  'timesheetApprovals',
  'auditEvents',
  'outbox',
  'syncMeta',
] as const

export type StoreName = (typeof STORE_NAMES)[number]

type FlowProLocalDataExport = {
  exportedAt: string
  app: 'flowpro'
  schemaVersion: number
  stores: Partial<Record<StoreName, unknown[]>>
}

let dbPromise: Promise<IDBDatabase> | null = null
let lastUpgrade: { fromVersion: number; toVersion: number } | null = null

function requestToPromise<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onabort = () => reject(transaction.error)
    transaction.onerror = () => reject(transaction.error)
  })
}

function upgradeDatabase(db: IDBDatabase) {
  if (!db.objectStoreNames.contains('absences')) {
    const store = db.createObjectStore('absences', { keyPath: 'id' })
    store.createIndex('employeeId', 'employeeId')
    store.createIndex('fromDate', 'fromDate')
    store.createIndex('requestId', 'requestId')
  }

  if (!db.objectStoreNames.contains('attendancePolicyConfigs')) {
    db.createObjectStore('attendancePolicyConfigs', { keyPath: 'id' })
  }

  if (!db.objectStoreNames.contains('attendanceTypes')) {
    db.createObjectStore('attendanceTypes', { keyPath: 'id' })
  }

  if (!db.objectStoreNames.contains('clockEvents')) {
    const store = db.createObjectStore('clockEvents', { keyPath: 'id' })
    store.createIndex('employeeId', 'employeeId')
    store.createIndex('occurredAt', 'occurredAt')
  }

  if (!db.objectStoreNames.contains('employeeUsers')) {
    const store = db.createObjectStore('employeeUsers', { keyPath: 'id' })
    store.createIndex('status', 'status')
    store.createIndex('role', 'role')
    store.createIndex('team', 'team')
  }

  if (!db.objectStoreNames.contains('employmentContracts')) {
    const store = db.createObjectStore('employmentContracts', {
      keyPath: 'id',
    })
    store.createIndex('employeeId', 'employeeId')
    store.createIndex('effectiveFrom', 'effectiveFrom')
  }

  if (!db.objectStoreNames.contains('managerDelegations')) {
    const store = db.createObjectStore('managerDelegations', { keyPath: 'id' })
    store.createIndex('managerId', 'managerId')
    store.createIndex('team', 'team')
  }

  if (!db.objectStoreNames.contains('organizationCatalogs')) {
    const store = db.createObjectStore('organizationCatalogs', {
      keyPath: 'id',
    })
    store.createIndex('kind', 'kind')
    store.createIndex('status', 'status')
  }

  if (!db.objectStoreNames.contains('notificationPreferences')) {
    db.createObjectStore('notificationPreferences', { keyPath: 'id' })
  }

  if (!db.objectStoreNames.contains('notifications')) {
    const store = db.createObjectStore('notifications', { keyPath: 'id' })
    store.createIndex('recipientUserId', 'recipientUserId')
    store.createIndex('createdAt', 'createdAt')
  }

  if (!db.objectStoreNames.contains('payrollExports')) {
    const store = db.createObjectStore('payrollExports', { keyPath: 'id' })
    store.createIndex('period', 'period')
    store.createIndex('requestedByUserId', 'requestedByUserId')
  }

  if (!db.objectStoreNames.contains('planningPackages')) {
    const store = db.createObjectStore('planningPackages', { keyPath: 'id' })
    store.createIndex('periodMonth', 'periodMonth')
    store.createIndex('cachedAt', 'cachedAt')
  }

  if (!db.objectStoreNames.contains('qualityBugs')) {
    const store = db.createObjectStore('qualityBugs', { keyPath: 'id' })
    store.createIndex('severity', 'severity')
    store.createIndex('status', 'status')
    store.createIndex('productArea', 'productArea')
    store.createIndex('createdAt', 'createdAt')
  }

  if (!db.objectStoreNames.contains('employeeRequests')) {
    const store = db.createObjectStore('employeeRequests', { keyPath: 'id' })
    store.createIndex('employeeId', 'employeeId')
    store.createIndex('status', 'status')
    store.createIndex('fromDate', 'fromDate')
    store.createIndex('submittedAt', 'submittedAt')
  }

  if (!db.objectStoreNames.contains('reportsPackages')) {
    const store = db.createObjectStore('reportsPackages', { keyPath: 'id' })
    store.createIndex('periodMonth', 'periodMonth')
    store.createIndex('cachedAt', 'cachedAt')
  }

  if (!db.objectStoreNames.contains('timeCorrections')) {
    const store = db.createObjectStore('timeCorrections', { keyPath: 'id' })
    store.createIndex('employeeId', 'employeeId')
    store.createIndex('date', 'date')
    store.createIndex('requestId', 'requestId')
  }

  if (!db.objectStoreNames.contains('timesheetApprovals')) {
    const store = db.createObjectStore('timesheetApprovals', { keyPath: 'id' })
    store.createIndex('employeeId', 'employeeId')
    store.createIndex('periodMonth', 'periodMonth')
  }

  if (!db.objectStoreNames.contains('auditEvents')) {
    const store = db.createObjectStore('auditEvents', { keyPath: 'id' })
    store.createIndex('aggregateId', 'aggregateId')
    store.createIndex('createdAt', 'createdAt')
  }

  if (!db.objectStoreNames.contains('outbox')) {
    const store = db.createObjectStore('outbox', { keyPath: 'id' })
    store.createIndex('status', 'status')
    store.createIndex('clientCreatedAt', 'clientCreatedAt')
  }

  if (!db.objectStoreNames.contains('syncMeta')) {
    db.createObjectStore('syncMeta', { keyPath: 'key' })
  }
}

export function openFlowProDb() {
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error(tStatic('syncUi.indexedDbUnavailable')))
      return
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      lastUpgrade = {
        fromVersion: event.oldVersion,
        toVersion: DB_VERSION,
      }
      upgradeDatabase(request.result)
    }
    request.onsuccess = () => {
      const db = request.result

      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }

      resolve(db)
    }
    request.onerror = () => {
      dbPromise = null
      reject(request.error)
    }
    request.onblocked = () => {
      dbPromise = null
      reject(new Error(tStatic('syncUi.closeOtherTabsBeforeUpgrade')))
    }
  })

  return dbPromise
}

export async function getMigrationStatus() {
  const db = await openFlowProDb()

  return {
    currentVersion: db.version,
    expectedVersion: DB_VERSION,
    lastUpgrade,
    notes: MIGRATION_NOTES,
    needsReload: db.version !== DB_VERSION,
  }
}

export async function getAllFromStore<T>(storeName: StoreName) {
  const db = await openFlowProDb()
  const transaction = db.transaction(storeName, 'readonly')
  const store = transaction.objectStore(storeName)
  const result = await requestToPromise<T[]>(store.getAll())
  await transactionDone(transaction)

  return result
}

export async function getFromStore<T>(storeName: StoreName, key: IDBValidKey) {
  const db = await openFlowProDb()
  const transaction = db.transaction(storeName, 'readonly')
  const store = transaction.objectStore(storeName)
  const result = await requestToPromise<T | undefined>(store.get(key))
  await transactionDone(transaction)

  return result
}

export async function putInStore<T>(storeName: StoreName, value: T) {
  const db = await openFlowProDb()
  const transaction = db.transaction(storeName, 'readwrite')
  const store = transaction.objectStore(storeName)

  store.put(value)
  await transactionDone(transaction)
}

export async function putManyInStore<T>(storeName: StoreName, values: T[]) {
  const db = await openFlowProDb()
  const transaction = db.transaction(storeName, 'readwrite')
  const store = transaction.objectStore(storeName)

  values.forEach((value) => store.put(value))
  await transactionDone(transaction)
}

export async function replaceManyInStore<T>(
  storeName: StoreName,
  shouldReplace: (value: T) => boolean,
  values: T[]
) {
  const db = await openFlowProDb()
  const transaction = db.transaction(storeName, 'readwrite')
  const store = transaction.objectStore(storeName)
  const current = await requestToPromise<T[]>(store.getAll())

  current
    .filter(shouldReplace)
    .forEach((value) => store.delete((value as { id: IDBValidKey }).id))
  values.forEach((value) => store.put(value))
  await transactionDone(transaction)
}

export async function deleteFromStore(storeName: StoreName, key: IDBValidKey) {
  const db = await openFlowProDb()
  const transaction = db.transaction(storeName, 'readwrite')
  const store = transaction.objectStore(storeName)

  store.delete(key)
  await transactionDone(transaction)
}

export async function getStoreCounts() {
  const db = await openFlowProDb()
  const transaction = db.transaction(STORE_NAMES, 'readonly')
  const counts = await Promise.all(
    STORE_NAMES.map(async (storeName) => {
      const count = await requestToPromise<number>(
        transaction.objectStore(storeName).count()
      )

      return [storeName, count] as const
    })
  )
  await transactionDone(transaction)

  return Object.fromEntries(counts) as Record<StoreName, number>
}

export async function exportFlowProLocalData(): Promise<FlowProLocalDataExport> {
  const db = await openFlowProDb()
  const transaction = db.transaction(STORE_NAMES, 'readonly')
  const storeEntries = await Promise.all(
    STORE_NAMES.map(async (storeName) => {
      const records = await requestToPromise<unknown[]>(
        transaction.objectStore(storeName).getAll()
      )

      return [storeName, records] as const
    })
  )
  await transactionDone(transaction)

  return {
    app: 'flowpro',
    exportedAt: new Date().toISOString(),
    schemaVersion: DB_VERSION,
    stores: Object.fromEntries(storeEntries),
  }
}

export async function importFlowProLocalData(payload: FlowProLocalDataExport) {
  if (payload.app !== 'flowpro' || !payload.stores) {
    throw new Error(tStatic('syncUi.invalidLocalDataExport'))
  }

  const db = await openFlowProDb()
  const transaction = db.transaction(STORE_NAMES, 'readwrite')

  STORE_NAMES.forEach((storeName) => {
    const store = transaction.objectStore(storeName)
    const records = payload.stores[storeName] ?? []

    store.clear()
    records.forEach((record) => store.put(record))
  })

  await transactionDone(transaction)
}

export function resetFlowProLocalDatabase() {
  const currentDbPromise = dbPromise
  dbPromise = null

  return new Promise<void>((resolve, reject) => {
    const deleteDb = () => {
      const request = indexedDB.deleteDatabase(DB_NAME)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
      request.onblocked = () => {
        reject(new Error(tStatic('syncUi.closeOtherTabsBeforeReset')))
      }
    }

    if (currentDbPromise) {
      currentDbPromise
        .then((db) => {
          db.close()
          deleteDb()
        })
        .catch(() => deleteDb())
    } else {
      deleteDb()
    }
  })
}
