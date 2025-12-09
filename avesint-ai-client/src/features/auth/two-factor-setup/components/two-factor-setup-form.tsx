import { useEffect, useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store.ts'
import { cn } from '@/lib/utils.ts'
import { Button } from '@/components/ui/button.tsx'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.tsx'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp.tsx'

const otpSchema = z.object({
  otp: z
    .string()
    .min(6, 'Введіть 6-значний код.')
    .max(6, 'Введіть 6-значний код.'),
})

type TwoFactorSetupFormProps = React.HTMLAttributes<HTMLDivElement>

type GenerateResponse = {
  secret: string
  otpauthUrl?: string
  qrCode?: string // data:image/png;base64,...
}

export function TwoFactorSetupForm({
                                     className,
                                     ...props
                                   }: TwoFactorSetupFormProps) {
  const navigate = useNavigate()
  const { auth } = useAuthStore()
  const accessToken = auth.accessToken
  const user = auth.user

  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [data, setData] = useState<GenerateResponse | null>(null)

  const form = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  })

  const otp = form.watch('otp')

  // Якщо немає токена – повертаємо на логін
  useEffect(() => {
    if (!accessToken) {
      navigate({ to: '/sign-in', replace: true }).catch(() => {})
    }
  }, [accessToken, navigate])

  // Отримуємо секрет і QR з бекенду
  useEffect(() => {
    if (!accessToken) return

    const fetchData = async () => {
      setIsLoading(true)
      try {
        const res = await fetch('/api/2fa/generate', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        })

        if (!res.ok) {
          let message = 'Не вдалося згенерувати секрет для 2FA'
          try {
            const body = await res.json()
            if (body?.message) message = body.message
          } catch {
            // ignore
          }
          throw new Error(message)
        }

        const result = (await res.json()) as GenerateResponse
        setData(result)
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Не вдалося підготувати налаштування 2FA'
        toast.error(msg)
      } finally {
        setIsLoading(false)
      }
    }

    void fetchData()
  }, [accessToken])

  async function onSubmit(values: z.infer<typeof otpSchema>) {
    if (!accessToken) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/2fa/turn-on', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ code: values.otp }),
      })

      if (!res.ok) {
        let message = 'Невірний код, спробуйте ще раз'
        try {
          const body = await res.json()
          if (body?.message) message = body.message
        } catch {
          // ignore
        }
        throw new Error(message)
      }

      // 2FA успішно увімкнено
      if (user) {
        auth.setUser({
          ...user,
          isTwoFactorEnabled: true,
        })
      }

      toast.success('Двофакторну аутентифікацію увімкнено')
      await navigate({ to: '/', replace: true })
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Не вдалося увімкнути 2FA'
      toast.error(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={cn('grid gap-6', className)} {...props}>
      <div className='space-y-2'>
        <h2 className='text-lg font-semibold'>Підключення Google Authenticator</h2>
        <p className='text-sm text-muted-foreground'>
          1. Відкрийте додаток аутентифікації (Google Authenticator, Aegis тощо).
          <br />
          2. Додайте новий акаунт, відсканувавши QR-код або ввівши секрет вручну.
          <br />
          3. Введіть 6-значний код нижче, щоб підтвердити.
        </p>
      </div>

      {isLoading && <p className='text-sm text-muted-foreground'>Завантаження...</p>}

      {data && (
        <div className='grid gap-3'>
          {data.qrCode ? (
            <div className='flex flex-col items-center gap-2'>
              {/* qrCode має бути data:image/png;base64,... з бекенду */}
              <img
                src={data.qrCode}
                alt='QR для 2FA'
                className='h-44 w-44 rounded border bg-white p-2'
              />
              <p className='text-xs text-muted-foreground'>
                Якщо не виходить відсканувати QR-код, використайте секрет:
              </p>
            </div>
          ) : null}

          <div className='rounded border bg-muted p-2 text-center text-sm font-mono'>
            {data.secret}
          </div>
        </div>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='grid gap-4'>
          <FormField
            control={form.control}
            name='otp'
            render={({ field }) => (
              <FormItem>
                <FormLabel className='sr-only'>Одноразовий код</FormLabel>
                <FormControl>
                  <InputOTP
                    maxLength={6}
                    {...field}
                    containerClassName='justify-between sm:[&>[data-slot="input-otp-group"]>div]:w-12'
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                    </InputOTPGroup>
                    <InputOTPSeparator />
                    <InputOTPGroup>
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='flex items-center justify-end'>
            <Button type='submit' disabled={otp.length < 6 || isSubmitting || isLoading}>
              Підтвердити та увімкнути 2FA
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
