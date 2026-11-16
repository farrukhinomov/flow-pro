import { useI18n } from '@/i18n'
import { ContentSection } from '../components/content-section'
import { NotificationInbox } from './notification-inbox'
import { NotificationsForm } from './notifications-form'

export function SettingsNotifications() {
  const { t } = useI18n()
  return (
    <ContentSection
      title={t('settingsUi.notifications')}
      desc={t('settingsUi.notificationsDescription')}
    >
      <div className='space-y-6'>
        <NotificationInbox />
        <NotificationsForm />
      </div>
    </ContentSection>
  )
}
