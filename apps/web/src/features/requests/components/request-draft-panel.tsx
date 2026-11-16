import { useMemo, useState } from 'react'
import type { AppViewer } from '@/domain/access/access-control'
import type { AttendanceStatusType } from '@/domain/attendance/types'
import { evaluateRequestDraftPolicy } from '@/domain/requests/policy'
import type {
  EmployeeRequest,
  RequestAttachment,
  RequestPartialDayMode,
  RequestSubmissionDraft,
} from '@/domain/requests/types'
import { useI18n } from '@/i18n'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  type RequestKind,
  buildRequestDraftPreview,
  calcBusinessDays,
  canSubmitRequestDraft,
  getAbsenceTypeOptions,
  getRequestDateLabel,
  getRequestLabel,
} from '../request-view-model'
import { AbsenceForm } from './request-draft-panel/absence-form'
import { BookingForm } from './request-draft-panel/booking-form'
import { OfficialAbsenceForm } from './request-draft-panel/official-absence-form'
import { requestKindOptions } from './request-draft-panel/request-kind-options'
import { RequestTypeCards } from './request-draft-panel/request-type-cards'
import {
  RequestAttachmentsField,
  RequestDraftSummary,
} from './request-draft-summary'

type SubmitDraft = Omit<RequestSubmissionDraft, 'employeeId' | 'employeeName'>

export function RequestDraftPanel({
  attendanceTypes,
  initialKind,
  onSubmit,
  requests,
  today,
  viewer,
}: {
  attendanceTypes: AttendanceStatusType[]
  initialKind?: RequestKind
  onSubmit: (draft: SubmitDraft) => Promise<void>
  requests: EmployeeRequest[]
  today: string
  viewer: AppViewer
}) {
  const { locale, t } = useI18n()
  const resolvedInitialKind = initialKind ?? 'absence'
  const [kind, setKind] = useState<RequestKind>(resolvedInitialKind)
  const [fromDate, setFromDate] = useState(today)
  const [toDate, setToDate] = useState(today)
  const [singleDate, setSingleDate] = useState(today)
  const [absenceType, setAbsenceType] = useState('')
  const [bookingType, setBookingType] = useState('pair')
  const [officialType, setOfficialType] = useState('full-day')
  const [clockIn, setClockIn] = useState('')
  const [clockOut, setClockOut] = useState('')
  const [partialDayMode, setPartialDayMode] =
    useState<RequestPartialDayMode>('full-day')
  const [partialStartTime, setPartialStartTime] = useState('')
  const [partialEndTime, setPartialEndTime] = useState('')
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<
    'none' | 'weekly'
  >('none')
  const [recurrenceOccurrences, setRecurrenceOccurrences] = useState(1)
  const [attachments, setAttachments] = useState<RequestAttachment[]>([])
  const [remark, setRemark] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const absenceTypes = useMemo(
    () => getAbsenceTypeOptions(attendanceTypes),
    [attendanceTypes]
  )
  const businessDays = calcBusinessDays(fromDate, toDate)
  const selectedAbsenceType =
    absenceTypes.find((item) => item.value === absenceType) ?? absenceTypes[0]
  const selectedAbsenceTypeValue = selectedAbsenceType?.value ?? ''
  const selectedKind = requestKindOptions.find((item) => item.value === kind)!
  const SelectedKindIcon = selectedKind.icon
  const selectedLabel = useMemo(
    () =>
      getRequestLabel({
        absenceType: selectedAbsenceType,
        bookingType,
        kind,
        officialType,
        t,
      }),
    [bookingType, kind, officialType, selectedAbsenceType, t]
  )
  const requestDateLabel = getRequestDateLabel({
    fromDate,
    kind,
    locale,
    singleDate,
    toDate,
  })
  const draftPreview = useMemo(
    () =>
      buildRequestDraftPreview({
        attachments,
        bookingType,
        clockIn,
        clockOut,
        fromDate,
        kind,
        officialType,
        partialDayMode,
        partialEndTime,
        partialStartTime,
        recurrenceFrequency,
        recurrenceOccurrences,
        remark,
        selectedAbsenceType,
        singleDate,
        toDate,
        viewer,
      }),
    [
      attachments,
      bookingType,
      clockIn,
      clockOut,
      fromDate,
      kind,
      officialType,
      partialDayMode,
      partialEndTime,
      partialStartTime,
      recurrenceFrequency,
      recurrenceOccurrences,
      remark,
      selectedAbsenceType,
      singleDate,
      toDate,
      viewer,
    ]
  )
  const policyEvaluation = useMemo(
    () =>
      evaluateRequestDraftPolicy({
        draft: draftPreview,
        existingRequests: requests,
      }),
    [draftPreview, requests]
  )
  const hasBlockingPolicyIssue = policyEvaluation.blocking.length > 0
  const canSubmit = canSubmitRequestDraft({
    bookingType,
    clockIn,
    clockOut,
    fromDate,
    hasBlockingPolicyIssue,
    kind,
    officialType,
    selectedAbsenceType,
    singleDate,
    toDate,
  })

  const [appliedInitialKind, setAppliedInitialKind] =
    useState<RequestKind>(resolvedInitialKind)
  if (resolvedInitialKind !== appliedInitialKind) {
    setAppliedInitialKind(resolvedInitialKind)
    setKind(resolvedInitialKind)
  }

  const resetDraft = () => {
    setFromDate(today)
    setToDate(today)
    setSingleDate(today)
    setAbsenceType(absenceTypes[0]?.value ?? '')
    setBookingType('pair')
    setOfficialType('full-day')
    setClockIn('')
    setClockOut('')
    setPartialDayMode('full-day')
    setPartialStartTime('')
    setPartialEndTime('')
    setRecurrenceFrequency('none')
    setRecurrenceOccurrences(1)
    setAttachments([])
    setRemark('')
  }

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return

    setIsSubmitting(true)

    try {
      await onSubmit(draftPreview)
      resetDraft()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className='grid min-w-0 gap-6 xl:grid-cols-[220px_minmax(0,1fr)_320px]'>
      <RequestTypeCards kind={kind} onSelect={setKind} />

      <Card>
        <CardHeader className='pb-3'>
          <CardTitle className='flex items-center gap-2 text-base'>
            <SelectedKindIcon className='h-4 w-4 text-muted-foreground' />
            {t(selectedKind.titleKey)}
          </CardTitle>
          <CardDescription>{t('requestsUi.oneFocusedForm')}</CardDescription>
        </CardHeader>
        <CardContent className='space-y-5'>
          {initialKind && (
            <div className='rounded-md border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground'>
              {t('requestsUi.preselectedRequestKind', {
                type: t(selectedKind.titleKey),
              })}
            </div>
          )}

          {kind === 'absence' && (
            <AbsenceForm
              fromDate={fromDate}
              toDate={toDate}
              setFromDate={setFromDate}
              setToDate={setToDate}
              absenceType={selectedAbsenceTypeValue}
              setAbsenceType={setAbsenceType}
              absenceTypes={absenceTypes}
              partialDayMode={partialDayMode}
              setPartialDayMode={setPartialDayMode}
              recurrenceFrequency={recurrenceFrequency}
              setRecurrenceFrequency={setRecurrenceFrequency}
              recurrenceOccurrences={recurrenceOccurrences}
              setRecurrenceOccurrences={setRecurrenceOccurrences}
              partialStartTime={partialStartTime}
              setPartialStartTime={setPartialStartTime}
              partialEndTime={partialEndTime}
              setPartialEndTime={setPartialEndTime}
            />
          )}
          {kind === 'booking' && (
            <BookingForm
              singleDate={singleDate}
              setSingleDate={setSingleDate}
              today={today}
              bookingType={bookingType}
              setBookingType={setBookingType}
              clockIn={clockIn}
              setClockIn={setClockIn}
              clockOut={clockOut}
              setClockOut={setClockOut}
            />
          )}
          {kind === 'official' && (
            <OfficialAbsenceForm
              singleDate={singleDate}
              setSingleDate={setSingleDate}
              today={today}
              officialType={officialType}
              setOfficialType={setOfficialType}
              clockIn={clockIn}
              setClockIn={setClockIn}
              clockOut={clockOut}
              setClockOut={setClockOut}
            />
          )}

          <RequestAttachmentsField
            attachments={attachments}
            onAttachmentsChange={setAttachments}
          />

          <div className='space-y-2'>
            <Label htmlFor='request-remark'>{t('requestsUi.remark')}</Label>
            <Textarea
              id='request-remark'
              rows={4}
              maxLength={255}
              value={remark}
              onChange={(event) => setRemark(event.target.value)}
              placeholder={t('requestsUi.optionalNote')}
              className='resize-none'
            />
            <div className='text-right text-xs text-muted-foreground'>
              {remark.length} / 255
            </div>
          </div>
        </CardContent>
      </Card>

      <RequestDraftSummary
        attachmentCount={attachments.length}
        businessDays={businessDays}
        canSubmit={canSubmit}
        clockIn={clockIn}
        clockOut={clockOut}
        isSubmitting={isSubmitting}
        kind={kind}
        onReset={resetDraft}
        onSubmit={() => void handleSubmit()}
        partialDay={draftPreview.partialDay}
        policyEvaluation={policyEvaluation}
        recurrenceFrequency={recurrenceFrequency}
        recurrenceOccurrences={recurrenceOccurrences}
        requestDateLabel={requestDateLabel}
        requestTitle={t(selectedKind.titleKey)}
        selectedLabel={selectedLabel}
      />
    </div>
  )
}
