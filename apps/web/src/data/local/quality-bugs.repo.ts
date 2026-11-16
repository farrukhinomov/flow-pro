import { getAllFromStore, putInStore } from './db'

export type QualityBugSeverity = 'high' | 'normal' | 'low'

export type QualityBugStatus = 'open' | 'mitigated' | 'closed'

export type QualityBugRecord = {
  createdAt: string
  id: string
  owner: string
  productArea: string
  severity: QualityBugSeverity
  status: QualityBugStatus
  summary: string
  updatedAt: string
}

export async function listOpenQualityBugs() {
  const bugs = await getAllFromStore<QualityBugRecord>('qualityBugs')

  return bugs
    .filter((bug) => bug.status !== 'closed')
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    )
}

export async function upsertQualityBug(bug: QualityBugRecord) {
  await putInStore('qualityBugs', bug)
  return bug
}
