import { useState } from 'react'
import { z } from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useNavigate } from '@tanstack/react-router'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
  InputOTPSeparator,
} from '@/components/ui/input-otp'
import { useAuthStore } from '@/stores/auth-store'

const otpSchema = z.object({
  otp: z
    .string()
    .min(6, 'Введіть 6-значний код.')
    .max(6, 'Введіть 6-значний код.'),
})

type OtpFormProps = React.HTMLAttributes<HTMLDivElement> & {
  token: string
  redirectTo?: string
}

export function OtpForm({ className, token, redirectTo = '/', ...props }: OtpFormProps) {
  const navigate = useNavigate()
  const [isLoading, setIsLoading] = useState(false)
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof otpSchema>>({
    resolver: zodResolver(otpSchema),
    defaultValues: { otp: '' },
  })

  const otp = form.watch('otp')

  async function onSubmit(data: z.infer<typeof otpSchema>) {
    setIsLoading(true)
    try {
      const res = await fetch('/api/2fa/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code: data.otp }),
      })

      if (!res.ok) {
        let message = 'Помилка підтвердження коду'
        try {
          const body = await res.json()
          if (body?.message) message = body.message
        } catch {
          // ignore
        }
        throw new Error(message)
      }

      const result = await res.json()

      // очікуємо { user, accessToken, refreshToken?, requires2FA: false }
      auth.setUser(result.user)
      auth.setAccessToken(result.accessToken)

      await navigate({ to: redirectTo, replace: true })
      toast.success('Вхід підтверджено')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Не вдалося підтвердити код'
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className={cn('grid gap-6', className)} {...props}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='grid gap-4'>
          <div>
            <h2 className='text-lg font-semibold'>Введіть одноразовий код</h2>
            <p className='text-sm text-muted-foreground'>
              Відкрийте додаток аутентифікації (Google Authenticator, Aegis тощо)
              та введіть 6-значний код для підтвердження входу.
            </p>
          </div>

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

          <div className='flex items-center gap-2'>
            <Button
              className='ml-auto'
              type='submit'
              disabled={otp.length < 6 || isLoading}
            >
              Підтвердити
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
