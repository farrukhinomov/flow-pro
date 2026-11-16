import { useMemo, useState } from 'react'
import type { CompanyStepInput } from '@/application/onboarding-workflow'
import { useI18n } from '@/i18n'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  COUNTRY_OPTIONS,
  getBrowserTimeZone,
  getDefaultTimeZoneForCountry,
  getRegionOptions,
  MAX_WEEKLY_HOURS,
  MIN_WEEKLY_HOURS,
  validateWeeklyHours,
} from '../onboarding-view-model'

const NO_REGION = 'none'

export function CompanyStep({
  defaultCompanyName,
  isSaving,
  onSubmit,
}: {
  defaultCompanyName: string
  isSaving: boolean
  onSubmit: (input: CompanyStepInput) => void
}) {
  const { t } = useI18n()
  const [companyName, setCompanyName] = useState(defaultCompanyName)
  const [countryCode, setCountryCode] = useState('DE')
  const [regionCode, setRegionCode] = useState(NO_REGION)
  const [timeZoneId, setTimeZoneId] = useState(() => getBrowserTimeZone())
  const [weeklyHours, setWeeklyHours] = useState('40')
  const [errors, setErrors] = useState<{
    companyName?: string
    weeklyHours?: string
  }>({})

  const regionOptions = useMemo(
    () => getRegionOptions(countryCode),
    [countryCode]
  )
  const timeZoneOptions = useMemo(() => {
    const suggested = [
      getBrowserTimeZone(),
      ...COUNTRY_OPTIONS.map((country) => country.defaultTimeZoneId),
      'Europe/London',
      'UTC',
    ]

    return [...new Set(suggested)]
  }, [])

  function handleCountryChange(nextCountry: string) {
    setCountryCode(nextCountry)
    setRegionCode(NO_REGION)
    setTimeZoneId(getDefaultTimeZoneForCountry(nextCountry))
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault()

    const trimmedName = companyName.trim()
    const hours = validateWeeklyHours(weeklyHours)
    const nextErrors: typeof errors = {}

    if (trimmedName.length < 2) {
      nextErrors.companyName = t('onboardingUi.errors.companyNameRequired')
    }

    if (!hours.ok) {
      nextErrors.weeklyHours = t(hours.messageKey, {
        max: String(MAX_WEEKLY_HOURS),
        min: String(MIN_WEEKLY_HOURS),
      })
    }

    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0 || !hours.ok) return

    onSubmit({
      companyName: trimmedName,
      countryCode,
      regionCode: regionCode === NO_REGION ? undefined : regionCode,
      timeZoneId,
      weeklyHours: hours.value,
    })
  }

  return (
    <form className='space-y-5' noValidate onSubmit={handleSubmit}>
      <div className='grid gap-2'>
        <Label htmlFor='onboarding-company-name'>
          {t('onboardingUi.company.nameLabel')}
        </Label>
        <Input
          aria-describedby={
            errors.companyName ? 'onboarding-company-name-error' : undefined
          }
          aria-invalid={!!errors.companyName}
          id='onboarding-company-name'
          value={companyName}
          onChange={(event) => setCompanyName(event.target.value)}
        />
        {errors.companyName && (
          <p
            className='text-sm text-destructive'
            id='onboarding-company-name-error'
          >
            {errors.companyName}
          </p>
        )}
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='grid gap-2'>
          <Label htmlFor='onboarding-country'>
            {t('onboardingUi.company.countryLabel')}
          </Label>
          <Select value={countryCode} onValueChange={handleCountryChange}>
            <SelectTrigger id='onboarding-country'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRY_OPTIONS.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {t(country.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='grid gap-2'>
          <Label htmlFor='onboarding-region'>
            {t('onboardingUi.company.regionLabel')}
          </Label>
          <Select value={regionCode} onValueChange={setRegionCode}>
            <SelectTrigger id='onboarding-region'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_REGION}>
                {t('onboardingUi.company.regionNone')}
              </SelectItem>
              {regionOptions.map((region) => (
                <SelectItem key={region.code} value={region.code}>
                  {t(region.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className='text-xs text-muted-foreground'>
            {t('onboardingUi.company.regionHelp')}
          </p>
        </div>
      </div>

      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='grid gap-2'>
          <Label htmlFor='onboarding-timezone'>
            {t('onboardingUi.company.timeZoneLabel')}
          </Label>
          <Select value={timeZoneId} onValueChange={setTimeZoneId}>
            <SelectTrigger id='onboarding-timezone'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {timeZoneOptions.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className='grid gap-2'>
          <Label htmlFor='onboarding-weekly-hours'>
            {t('onboardingUi.company.weeklyHoursLabel')}
          </Label>
          <Input
            aria-describedby='onboarding-weekly-hours-help'
            aria-invalid={!!errors.weeklyHours}
            id='onboarding-weekly-hours'
            inputMode='decimal'
            value={weeklyHours}
            onChange={(event) => setWeeklyHours(event.target.value)}
          />
          <p
            className='text-xs text-muted-foreground'
            id='onboarding-weekly-hours-help'
          >
            {t('onboardingUi.company.weeklyHoursHelp')}
          </p>
          {errors.weeklyHours && (
            <p className='text-sm text-destructive'>{errors.weeklyHours}</p>
          )}
        </div>
      </div>

      <Button disabled={isSaving} type='submit'>
        {isSaving && <Loader2 className='h-4 w-4 animate-spin' />}
        {t('onboardingUi.saveAndContinue')}
      </Button>
    </form>
  )
}
