import { AxiosError } from 'axios'
import { tStatic } from '@/i18n/static'
import { toast } from 'sonner'
import { logger } from './logger'

export function handleServerError(error: unknown) {
  logger.error(error, 'Server error')

  let errMsg = tStatic('errorsUi.somethingWentWrong')

  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    Number(error.status) === 204
  ) {
    errMsg = tStatic('errorsUi.contentNotFound')
  }

  if (error instanceof AxiosError) {
    errMsg = error.response?.data.title
  }

  toast.error(errMsg)
}
