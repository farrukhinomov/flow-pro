import { useNavigate, useRouter } from '@tanstack/react-router'
import { useI18n } from '@/i18n'
import { Button } from '@/components/ui/button'

export function ForbiddenError() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const { history } = useRouter()
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <h1 className='text-[7rem] leading-tight font-bold'>403</h1>
        <span className='font-medium'>{t('errorsUi.forbiddenTitle')}</span>
        <p className='text-center text-muted-foreground'>
          {t('errorsUi.forbiddenDescription')}
        </p>
        <div className='mt-6 flex gap-4'>
          <Button variant='outline' onClick={() => history.go(-1)}>
            {t('errorsUi.goBack')}
          </Button>
          <Button onClick={() => navigate({ to: '/' })}>
            {t('errorsUi.backToHome')}
          </Button>
        </div>
      </div>
    </div>
  )
}
