import { useRef, useState } from 'react'
import {
  deleteAttachmentFile,
  uploadAttachmentFile,
} from '@/data/api/module-aggregates.api'
import type { evaluateRequestDraftPolicy } from '@/domain/requests/policy'
import type {
  RequestAttachment,
  RequestPartialDay,
} from '@/domain/requests/types'
import { useI18n } from '@/i18n'
import {
  AlertTriangle,
  Loader2,
  Paperclip,
  Save,
  ShieldAlert,
  Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { formatRequestPolicyIssue } from '../policy-message-format'
import {
  formatFileSize,
  formatPartialDay,
  type RequestKind,
} from '../request-view-model'

export function RequestAttachmentsField({
  attachments,
  onAttachmentsChange,
}: {
  attachments: RequestAttachment[]
  onAttachmentsChange: (attachments: RequestAttachment[]) => void
}) {
  const { t } = useI18n()
  const [isUploading, setIsUploading] = useState(false)
  const [removingAttachmentId, setRemovingAttachmentId] = useState<
    string | null
  >(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFilesSelected(files: File[]) {
    if (files.length === 0) return

    setError(null)
    setIsUploading(true)

    try {
      const addedAt = new Date().toISOString()
      const uploaded = await Promise.all(
        files.map((file) =>
          uploadAttachmentFile({
            clientId: 'flowpro-web-request-draft',
            clientOperationId: `request-attachment-upload-${createClientId()}`,
            file,
          })
        )
      )

      onAttachmentsChange([
        ...attachments,
        ...uploaded.map((attachment) => ({
          addedAt,
          id: attachment.id,
          name: attachment.fileName,
          objectKey: attachment.objectKey,
          ownerUserId: attachment.ownerUserId,
          serverVersion: attachment.serverVersion,
          sha256: attachment.sha256,
          size: attachment.sizeBytes,
          storageProvider: 'backend',
          type: attachment.contentType,
          uploadedAt: attachment.uploadedAt,
        })),
      ])
    } catch (uploadError) {
      setError(
        uploadError instanceof Error
          ? uploadError.message
          : t('requestsUi.attachmentUploadFailed')
      )
    } finally {
      setIsUploading(false)
    }
  }

  async function handleRemoveAttachment(attachment: RequestAttachment) {
    setError(null)
    setRemovingAttachmentId(attachment.id)

    try {
      await deleteAttachmentFile({
        attachmentId: attachment.id,
        clientId: 'flowpro-web-request-draft',
        clientOperationId: `request-attachment-delete-${createClientId()}`,
      })
      onAttachmentsChange(
        attachments.filter((item) => item.id !== attachment.id)
      )
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : t('requestsUi.attachmentDeleteFailed')
      )
    } finally {
      setRemovingAttachmentId(null)
    }
  }

  return (
    <div className='space-y-3 rounded-md border bg-muted/20 p-4'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <Label htmlFor='request-attachments'>
            {t('requestsUi.attachments')}
          </Label>
          <p className='mt-1 text-xs text-muted-foreground'>
            {t('requestsUi.attachmentDescription')}
          </p>
        </div>
        <Paperclip className='h-4 w-4 text-muted-foreground' />
      </div>
      {/*
        The native file input renders browser chrome ("Choose Files / No file
        chosen") that cannot be restyled, so it stays hidden behind a regular
        button. Same approach as the local data import in the sync popover.
      */}
      <input
        ref={fileInputRef}
        id='request-attachments'
        type='file'
        multiple
        className='hidden'
        disabled={isUploading}
        onChange={(event) => {
          const files = Array.from(event.target.files ?? [])
          void handleFilesSelected(files)
          event.target.value = ''
        }}
      />
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={isUploading}
        onClick={() => fileInputRef.current?.click()}
      >
        <Paperclip className='h-4 w-4' />
        {t('requestsUi.attachmentAdd')}
      </Button>
      {isUploading && (
        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
          <Loader2 className='h-3.5 w-3.5 animate-spin' />
          {t('requestsUi.uploadingAttachments')}
        </div>
      )}
      {error && <p className='text-xs text-destructive'>{error}</p>}
      {attachments.length > 0 && (
        <div className='space-y-2'>
          {attachments.map((attachment) => (
            <div
              key={attachment.id}
              className='flex items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-sm'
            >
              <div className='min-w-0'>
                <div className='truncate font-medium'>{attachment.name}</div>
                <div className='text-xs text-muted-foreground'>
                  {formatFileSize(attachment.size)}
                </div>
              </div>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                disabled={removingAttachmentId === attachment.id}
                onClick={() => {
                  void handleRemoveAttachment(attachment)
                }}
              >
                {removingAttachmentId === attachment.id
                  ? t('requestsUi.deleting')
                  : t('requestsUi.delete')}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function createClientId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function RequestDraftSummary({
  attachmentCount,
  businessDays,
  canSubmit,
  clockIn,
  clockOut,
  isSubmitting = false,
  kind,
  onReset,
  onSubmit,
  partialDay,
  policyEvaluation,
  recurrenceFrequency,
  recurrenceOccurrences,
  requestDateLabel,
  requestTitle,
  selectedLabel,
}: {
  attachmentCount: number
  businessDays: number
  canSubmit: boolean
  clockIn: string
  clockOut: string
  isSubmitting?: boolean
  kind: RequestKind
  onReset: () => void
  onSubmit: () => void
  partialDay?: RequestPartialDay
  policyEvaluation: ReturnType<typeof evaluateRequestDraftPolicy>
  recurrenceFrequency: 'none' | 'weekly'
  recurrenceOccurrences: number
  requestDateLabel: string
  requestTitle: string
  selectedLabel?: string
}) {
  const { t } = useI18n()
  return (
    <Card className='h-fit xl:sticky xl:top-4'>
      <CardHeader className='pb-3'>
        <CardTitle className='text-sm font-medium'>
          {t('requestsUi.draftSummary')}
        </CardTitle>
      </CardHeader>
      <CardContent className='space-y-3 text-sm'>
        <SummaryLine label={t('requestsUi.request')} value={requestTitle} />
        <SummaryLine label={t('requestsUi.date')} value={requestDateLabel} />
        <SummaryLine
          label={t('requestsUi.type')}
          value={selectedLabel ?? '-'}
        />

        {kind === 'absence' && (
          <>
            <div className='flex justify-between gap-4'>
              <span className='text-muted-foreground'>
                {t('requestsUi.duration')}
              </span>
              <Badge variant='secondary'>
                {businessDays}{' '}
                {businessDays === 1
                  ? t('requestsUi.daySingular')
                  : t('requestsUi.dayPlural')}
              </Badge>
            </div>
            <SummaryLine
              label={t('requestsUi.dayLength')}
              value={formatPartialDay({ partialDay }, t)}
            />
            {recurrenceFrequency === 'weekly' && (
              <SummaryLine
                label={t('requestsUi.repeat')}
                value={t('requestsUi.weeklyOccurrences', {
                  count: recurrenceOccurrences,
                })}
              />
            )}
          </>
        )}

        {attachmentCount > 0 && (
          <SummaryLine
            label={t('requestsUi.attachments')}
            value={String(attachmentCount)}
          />
        )}

        {kind !== 'absence' && (
          <>
            <SummaryLine
              label={t('requestsUi.clockIn')}
              value={clockIn || '-'}
            />
            <SummaryLine
              label={t('requestsUi.clockOut')}
              value={clockOut || '-'}
            />
          </>
        )}

        <Separator />

        {(policyEvaluation.blocking.length > 0 ||
          policyEvaluation.warnings.length > 0) && (
          <div className='space-y-2'>
            {policyEvaluation.blocking.map((issue) => (
              <div
                key={issue.code}
                className='rounded-md border border-rose-200 bg-rose-500/10 p-3 text-xs leading-5 text-rose-700 dark:border-rose-900 dark:text-rose-300'
              >
                <div className='mb-1 flex items-center gap-2 font-medium'>
                  <ShieldAlert className='h-3.5 w-3.5' />
                  {t('requestsUi.policyBlockLabel')}
                </div>
                {formatRequestPolicyIssue(issue, t)}
              </div>
            ))}
            {policyEvaluation.warnings.map((issue) => (
              <div
                key={issue.code}
                className='rounded-md border border-amber-200 bg-amber-500/10 p-3 text-xs leading-5 text-amber-700 dark:border-amber-900 dark:text-amber-300'
              >
                <div className='mb-1 flex items-center gap-2 font-medium'>
                  <AlertTriangle className='h-3.5 w-3.5' />
                  {t('requestsUi.conflictWarning')}
                </div>
                {formatRequestPolicyIssue(issue, t)}
              </div>
            ))}
          </div>
        )}

        <div className='rounded-md border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground'>
          <div className='mb-1 flex items-center gap-2 font-medium text-foreground'>
            <Sparkles className='h-3.5 w-3.5' />
            {t('requestsUi.aiReadyWorkflow')}
          </div>
          {t('requestsUi.aiReadyWorkflowDescription')}
        </div>

        <div className='space-y-2 pt-1'>
          <Button
            className='w-full'
            disabled={!canSubmit || isSubmitting}
            onClick={onSubmit}
          >
            {isSubmitting ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : (
              <Save className='h-4 w-4' />
            )}
            {isSubmitting
              ? t('requestsUi.submittingRequest')
              : t('requestsUi.submitRequest')}
          </Button>
          <Button
            variant='ghost'
            className='w-full text-muted-foreground'
            disabled={isSubmitting}
            onClick={onReset}
          >
            {t('requestsUi.clearDraft')}
          </Button>
        </div>

        {!canSubmit && !isSubmitting && (
          <p className='text-center text-xs text-muted-foreground'>
            {t('requestsUi.completeRequiredFields')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className='flex justify-between gap-4'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='text-right font-medium'>{value}</span>
    </div>
  )
}
