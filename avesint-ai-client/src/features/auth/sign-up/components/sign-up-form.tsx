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
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/password-input'
import { useAuthStore } from '@/stores/auth-store'

const formSchema = z
  .object({
    callsign: z
      .string()
      .min(2, 'Позивний повинен містити щонайменше 2 символи'),
    displayName: z
      .string()
      .min(2, 'Імʼя / посада повинні містити щонайменше 2 символи'),
    password: z
      .string()
      .min(1, 'Введіть пароль')
      .min(6, 'Пароль повинен складатися щонайменше з 6 символів'),
    confirmPassword: z.string().min(1, 'Підтвердіть пароль'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Паролі не співпадають',
    path: ['confirmPassword'],
  })

export function SignUpForm({
                             className,
                             ...props
                           }: React.HTMLAttributes<HTMLFormElement>) {
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()
  const { auth } = useAuthStore()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      callsign: '',
      displayName: '',
      password: '',
      confirmPassword: '',
    },
  })

  async function onSubmit(data: z.infer<typeof formSchema>) {
    setIsLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          callsign: data.callsign,
          displayName: data.displayName,
          password: data.password,
        }),
      })

      if (!res.ok) {
        let message = 'Помилка реєстрації'
        try {
          const body = await res.json()
          if (body?.message) message = body.message
        } catch {
          // ignore
        }
        throw new Error(message)
      }

      const result = await res.json()
      // backend повертає { user, accessToken, refreshToken? }

      auth.setUser(result.user)
      auth.setAccessToken(result.accessToken)

      toast.success(
        `Акаунт створено. Зараз налаштуємо двофакторну аутентифікацію для ${
          result.user.displayName || result.user.callsign
        }.`,
      )

      // одразу йдемо на сторінку налаштування 2FA
      await navigate({
        to: '/two-factor-setup',
        replace: true,
      })
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Не вдалося створити акаунт'
      toast.error(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={cn('grid gap-3', className)}
        {...props}
      >
        <FormField
          control={form.control}
          name='callsign'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Позивний</FormLabel>
              <FormControl>
                <Input placeholder='Напр. VORON' autoComplete='username' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='displayName'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Імʼя / посада</FormLabel>
              <FormControl>
                <Input placeholder='Начальник зміни' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='password'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Пароль</FormLabel>
              <FormControl>
                <PasswordInput
                  placeholder='********'
                  autoComplete='new-password'
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='confirmPassword'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Підтвердити пароль</FormLabel>
              <FormControl>
                <PasswordInput placeholder='********' {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button className='mt-2' disabled={isLoading}>
          Створити акаунт
        </Button>
      </form>
    </Form>
  )
}
