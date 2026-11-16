import { useI18n } from '@/i18n'
import { ContentSection } from '../components/content-section'
import { AccountForm } from './account-form'

export function SettingsAccount() {
  const { t } = useI18n()
  return (
    <ContentSection
      title={t('settingsUi.account')}
      desc={t('settingsUi.accountDescription')}
    >
      <AccountForm />
    </ContentSection>
  )
}
