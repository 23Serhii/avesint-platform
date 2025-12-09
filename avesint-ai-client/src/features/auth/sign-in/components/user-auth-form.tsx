// avesint-ai-client/src/features/auth/sign-in/components/user-auth-form.tsx
'use client'

import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useAuthStore } from '@/stores/auth-store'
import { login, verify2FA, mapRawUser } from '@/lib/api/auth'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function UserAuthForm() {
    const [callsign, setCallsign] = useState('')
    const [password, setPassword] = useState('')
    const [code, setCode] = useState('')
    const [loading, setLoading] = useState(false)
    const [requires2FA, setRequires2FA] = useState(false)

    const navigate = useNavigate()
    const { auth } = useAuthStore()

    const handleLogin = async () => {
        const trimmedCallsign = callsign.trim()
        const trimmedPassword = password.trim()
        if (!trimmedCallsign || !trimmedPassword) return

        try {
            setLoading(true)
            const res = await login(trimmedCallsign, trimmedPassword)

            if (res.requires2FA) {
                // Зберігаємо тимчасовий accessToken для /2fa/verify
                auth.setAuth({
                    accessToken: res.tempAccessToken,
                    refreshToken: undefined,
                    user: mapRawUser(res.user),
                })
                setRequires2FA(true)
                toast.message('Введіть код 2FA')
                return
            }

            // 2FA вимкнено — маємо повні токени
            auth.setAuth({
                accessToken: res.accessToken,
                refreshToken: res.refreshToken,
                user: mapRawUser(res.user),
            })

            toast.success('Вхід виконано')
            navigate({ to: '/' })
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('Login error', e)
            toast.error('Невірний позивний або пароль')
        } finally {
            setLoading(false)
        }
    }

    const handleVerify2FA = async () => {
        const trimmedCode = code.trim()
        if (!trimmedCode) return

        try {
            setLoading(true)
            const res = await verify2FA(trimmedCode)

            auth.setAuth({
                accessToken: res.accessToken,
                refreshToken: res.refreshToken,
                user: mapRawUser(res.user),
            })

            toast.success('2FA пройдено, вхід виконано')
            navigate({ to: '/' })
        } catch (e: any) {
            // eslint-disable-next-line no-console
            console.error('2FA error', e)
            toast.error('Невірний код 2FA')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-4">
            {!requires2FA ? (
                <>
                    <Input
                        placeholder="Позивний"
                        autoComplete="username"
                        value={callsign}
                        onChange={(e) => setCallsign(e.target.value)}
                    />
                    <Input
                        type="password"
                        placeholder="Пароль"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    <Button
                        type="button"
                        onClick={handleLogin}
                        disabled={loading}
                        className="w-full"
                    >
                        {loading ? 'Вхід…' : 'Увійти'}
                    </Button>
                </>
            ) : (
                <>
                    <p className="text-sm text-muted-foreground">
                        Введіть код 2FA з вашого додатку-аутентифікатора.
                    </p>
                    <Input
                        placeholder="Код 2FA"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                    />
                    <Button
                        type="button"
                        onClick={handleVerify2FA}
                        disabled={loading}
                        className="w-full"
                    >
                        {loading ? 'Перевірка…' : 'Підтвердити'}
                    </Button>
                </>
            )}
        </div>
    )
}