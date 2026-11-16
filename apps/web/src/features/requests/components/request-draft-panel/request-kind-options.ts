import type { ElementType } from 'react'
import { CalendarRange, Clock, ShieldCheck } from 'lucide-react'
import type { RequestKind } from '../../request-view-model'

export type RequestKindOption = {
  value: RequestKind
  titleKey: string
  descriptionKey: string
  icon: ElementType
}

export const requestKindOptions: RequestKindOption[] = [
  {
    value: 'absence',
    titleKey: 'requestsUi.planAbsence',
    descriptionKey: 'requestsUi.planAbsenceDescription',
    icon: CalendarRange,
  },
  {
    value: 'booking',
    titleKey: 'requestsUi.fixBooking',
    descriptionKey: 'requestsUi.fixBookingDescription',
    icon: Clock,
  },
  {
    value: 'official',
    titleKey: 'requestsUi.officialAbsence',
    descriptionKey: 'requestsUi.officialAbsenceDescription',
    icon: ShieldCheck,
  },
]
