import { useI18n } from '@/i18n'
import { ContentSection } from '../components/content-section'
import { DisplayForm } from './display-form'

export function SettingsDisplay() {
  const { t } = useI18n()
  return (
    <ContentSection
      title={t('settingsUi.display')}
      desc={t('settingsUi.displayDescription')}
    >
      <DisplayForm />
    </ContentSection>
  )
}
