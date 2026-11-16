import { useI18n } from '@/i18n'
import { ContentSection } from '../components/content-section'
import { ProfileForm } from './profile-form'

export function SettingsProfile() {
  const { t } = useI18n()
  return (
    <ContentSection
      title={t('settingsUi.profile')}
      desc={t('settingsUi.profileDescription')}
    >
      <ProfileForm />
    </ContentSection>
  )
}
