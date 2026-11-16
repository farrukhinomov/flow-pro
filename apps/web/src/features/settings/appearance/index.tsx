import { useI18n } from '@/i18n'
import { ContentSection } from '../components/content-section'
import { AppearanceForm } from './appearance-form'

export function SettingsAppearance() {
  const { t } = useI18n()
  return (
    <ContentSection
      title={t('settingsUi.appearance')}
      desc={t('settingsUi.appearanceDescription')}
    >
      <AppearanceForm />
    </ContentSection>
  )
}
