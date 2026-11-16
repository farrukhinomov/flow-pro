import { useI18n } from '@/i18n'

export function MaintenanceError() {
  const { t } = useI18n()
  return (
    <div className='h-svh'>
      <div className='m-auto flex h-full w-full flex-col items-center justify-center gap-2'>
        <h1 className='text-[7rem] leading-tight font-bold'>503</h1>
        <span className='font-medium'>{t('errorsUi.maintenanceTitle')}</span>
        <p className='text-center text-muted-foreground'>
          {t('errorsUi.maintenanceDescription')}
        </p>
      </div>
    </div>
  )
}
