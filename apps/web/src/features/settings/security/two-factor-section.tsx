import { useMemo, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQueryClient } from '@tanstack/react-query'
import {
  disableTwoFactor,
  enableTwoFactor,
  regenerateRecoveryCodes,
  startAuthenticatorSetup,
  type AuthenticatorSetup,
} from '@/data/api/account.api'
import { resolveApiErrorMessage } from '@/data/api/api-error'
import { useI18n } from '@/i18n'
import {
  CircleAlert,
  Copy,
  Download,
  KeyRound,
  Loader2,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react'
import { toast } from 'sonner'
import { encode } from 'uqr'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'

/** Below this many unused recovery codes, the page suggests creating new ones. */
const FEW_RECOVERY_CODES = 3

type Step =
  | { kind: 'idle' }
  | { kind: 'confirm-password'; action: 'setup' | 'regenerate' | 'disable' }
  | { kind: 'scan'; setup: AuthenticatorSetup }
  | { kind: 'show-codes'; codes: string[] }

export function TwoFactorSection({
  accountQueryKey,
  email,
  enabled,
  recoveryCodesLeft,
}: {
  accountQueryKey: readonly unknown[]
  email: string
  enabled: boolean
  recoveryCodesLeft: number
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const [step, setStep] = useState<Step>({ kind: 'idle' })
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: accountQueryKey })

  async function onPasswordConfirmed(
    action: 'setup' | 'regenerate' | 'disable',
    password: string
  ) {
    if (action === 'setup') {
      setStep({ kind: 'scan', setup: await startAuthenticatorSetup(password) })
      return
    }

    if (action === 'regenerate') {
      setStep({
        kind: 'show-codes',
        codes: await regenerateRecoveryCodes(password),
      })
      await refresh()
      return
    }

    await disableTwoFactor(password)
    toast.success(t('twoFactorUi.turnedOff'))
    setStep({ kind: 'idle' })
    await refresh()
  }

  return (
    <section className='grid gap-3'>
      <div>
        <div className='flex flex-wrap items-center gap-2'>
          <h4 className='font-medium'>{t('twoFactorUi.title')}</h4>
          <Badge variant={enabled ? 'secondary' : 'outline'}>
            {enabled ? t('twoFactorUi.on') : t('twoFactorUi.off')}
          </Badge>
        </div>
        <p className='text-sm text-muted-foreground'>
          {t('twoFactorUi.description')}
        </p>
      </div>

      {step.kind === 'confirm-password' ? (
        <PasswordConfirmForm
          email={email}
          onCancel={() => setStep({ kind: 'idle' })}
          onConfirm={(password) => onPasswordConfirmed(step.action, password)}
          submitLabel={
            step.action === 'setup'
              ? t('twoFactorUi.continue')
              : step.action === 'regenerate'
                ? t('twoFactorUi.newRecoveryCodes')
                : t('twoFactorUi.turnOff')
          }
        />
      ) : step.kind === 'scan' ? (
        <ScanAndConfirm
          onCancel={() => setStep({ kind: 'idle' })}
          onEnabled={async (codes, otherSessionsEnded) => {
            toast.success(
              t('twoFactorUi.turnedOn', { count: otherSessionsEnded })
            )
            setStep({ kind: 'show-codes', codes })
            await refresh()
          }}
          setup={step.setup}
        />
      ) : step.kind === 'show-codes' ? (
        <RecoveryCodesPanel
          codes={step.codes}
          onDone={() => setStep({ kind: 'idle' })}
        />
      ) : enabled ? (
        <div className='grid gap-3'>
          <p
            className={
              recoveryCodesLeft <= FEW_RECOVERY_CODES
                ? 'text-sm text-destructive'
                : 'text-sm text-muted-foreground'
            }
          >
            {t('twoFactorUi.recoveryCodesLeft', { count: recoveryCodesLeft })}
          </p>
          <div className='flex flex-wrap gap-2'>
            <Button
              onClick={() =>
                setStep({ kind: 'confirm-password', action: 'regenerate' })
              }
              size='sm'
              variant='outline'
            >
              <KeyRound />
              {t('twoFactorUi.newRecoveryCodes')}
            </Button>
            <Button
              onClick={() =>
                setStep({ kind: 'confirm-password', action: 'disable' })
              }
              size='sm'
              variant='ghost'
            >
              <ShieldOff />
              {t('twoFactorUi.turnOff')}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            onClick={() =>
              setStep({ kind: 'confirm-password', action: 'setup' })
            }
            size='sm'
            variant='outline'
          >
            <ShieldCheck />
            {t('twoFactorUi.setUp')}
          </Button>
        </div>
      )}
    </section>
  )
}

function PasswordConfirmForm({
  email,
  onCancel,
  onConfirm,
  submitLabel,
}: {
  email: string
  onCancel: () => void
  onConfirm: (password: string) => Promise<void>
  submitLabel: string
}) {
  const { t } = useI18n()
  const formSchema = useMemo(
    () =>
      z.object({
        currentPassword: z.string().min(1, t('auth.errors.passwordRequired')),
      }),
    [t]
  )
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: '' },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await onConfirm(values.currentPassword)
    } catch (error) {
      form.setError('root', {
        message: resolveApiErrorMessage(error, t, 'auth.error'),
      })
    }
  }

  return (
    <Form {...form}>
      <form
        className='grid max-w-md gap-3'
        onSubmit={form.handleSubmit(onSubmit)}
      >
        {/* Lets password managers fill the password of the right account. */}
        <input
          autoComplete='username'
          hidden
          readOnly
          type='text'
          value={email}
        />
        <FormField
          control={form.control}
          name='currentPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('settingsUi.currentPassword')}</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete='current-password'
                  autoFocus
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <ErrorAlert message={form.formState.errors.root?.message} />
        <div className='flex flex-wrap gap-2'>
          <Button disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <Loader2 className='animate-spin' />
            ) : null}
            {submitLabel}
          </Button>
          <Button onClick={onCancel} type='button' variant='ghost'>
            {t('common.cancel')}
          </Button>
        </div>
      </form>
    </Form>
  )
}

function ScanAndConfirm({
  onCancel,
  onEnabled,
  setup,
}: {
  onCancel: () => void
  onEnabled: (codes: string[], otherSessionsEnded: number) => Promise<void>
  setup: AuthenticatorSetup
}) {
  const { t } = useI18n()
  const formSchema = useMemo(
    () =>
      z.object({
        code: z.string().trim().min(1, t('twoFactorUi.codeRequired')),
      }),
    [t]
  )
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { code: '' },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      const result = await enableTwoFactor(values.code)
      await onEnabled(result.recoveryCodes, result.otherSessionsEnded)
    } catch (error) {
      form.setError('code', {
        message: resolveApiErrorMessage(error, t, 'auth.error'),
      })
    }
  }

  return (
    <div className='grid max-w-md gap-4'>
      <p className='text-sm'>{t('twoFactorUi.scanInstructions')}</p>
      <QrCode label={t('twoFactorUi.qrLabel')} value={setup.authenticatorUri} />
      <div className='grid gap-1'>
        <span className='text-sm text-muted-foreground'>
          {t('twoFactorUi.manualKey')}
        </span>
        <code
          className='rounded-md bg-muted px-3 py-2 font-mono text-sm break-all'
          data-testid='authenticator-key'
        >
          {setup.sharedKey}
        </code>
      </div>
      <Form {...form}>
        <form className='grid gap-3' onSubmit={form.handleSubmit(onSubmit)}>
          <FormField
            control={form.control}
            name='code'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('twoFactorUi.code')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete='one-time-code'
                    inputMode='numeric'
                    maxLength={7}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className='flex flex-wrap gap-2'>
            <Button disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className='animate-spin' />
              ) : (
                <ShieldCheck />
              )}
              {t('twoFactorUi.turnOn')}
            </Button>
            <Button onClick={onCancel} type='button' variant='ghost'>
              {t('common.cancel')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

function RecoveryCodesPanel({
  codes,
  onDone,
}: {
  codes: string[]
  onDone: () => void
}) {
  const { t } = useI18n()
  const text = codes.join('\n')

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('twoFactorUi.codesCopied'))
    } catch {
      toast.error(t('twoFactorUi.copyFailed'))
    }
  }

  function download() {
    const url = URL.createObjectURL(
      new Blob([`${t('twoFactorUi.codesFileHeading')}\n\n${text}\n`], {
        type: 'text/plain',
      })
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'flowpro-recovery-codes.txt'
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className='grid max-w-md gap-3'>
      <Alert>
        <KeyRound className='h-4 w-4' />
        <AlertDescription>{t('twoFactorUi.saveCodes')}</AlertDescription>
      </Alert>
      <ul
        className='grid grid-cols-2 gap-x-6 gap-y-1 rounded-md bg-muted px-4 py-3 font-mono text-sm'
        data-testid='recovery-codes'
      >
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className='flex flex-wrap gap-2'>
        <Button onClick={() => void copy()} size='sm' variant='outline'>
          <Copy />
          {t('twoFactorUi.copyCodes')}
        </Button>
        <Button onClick={download} size='sm' variant='outline'>
          <Download />
          {t('twoFactorUi.downloadCodes')}
        </Button>
        <Button onClick={onDone} size='sm'>
          {t('twoFactorUi.savedCodes')}
        </Button>
      </div>
    </div>
  )
}

/**
 * Drawn as one SVG path, black on white whatever the theme, because scanners need the contrast.
 */
function QrCode({ label, value }: { label: string; value: string }) {
  const { path, size } = useMemo(() => {
    const qr = encode(value, { ecc: 'M', border: 2 })
    const commands: string[] = []

    qr.data.forEach((row, y) =>
      row.forEach((dark, x) => {
        if (dark) commands.push(`M${x} ${y}h1v1h-1z`)
      })
    )

    return { path: commands.join(''), size: qr.size }
  }, [value])

  return (
    <svg
      aria-label={label}
      className='h-48 w-48 rounded-md bg-white'
      role='img'
      shapeRendering='crispEdges'
      viewBox={`0 0 ${size} ${size}`}
    >
      <path d={path} fill='#000' />
    </svg>
  )
}

function ErrorAlert({ message }: { message: string | undefined }) {
  if (!message) return null

  return (
    <Alert variant='destructive'>
      <CircleAlert className='h-4 w-4' />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  )
}
