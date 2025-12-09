import axios from 'axios'
import { useAuthStore } from '@/stores/auth-store'
import { handleServerError } from '@/lib/handle-server-error'

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8080/api',
    withCredentials: true,
})

// Окремий клієнт для refresh без інтерсепторів, щоб уникнути рекурсії
const refreshClient = axios.create({
    baseURL: api.defaults.baseURL,
    withCredentials: true,
})

// Підкладаємо accessToken для всіх запитів
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().auth.accessToken
    if (token) {
        config.headers = config.headers ?? {}
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
    if (isRefreshing && refreshPromise) {
        return refreshPromise
    }

    const { auth } = useAuthStore.getState()
    const { refreshToken, user } = auth

    if (!refreshToken || !user) {
        return null
    }

    isRefreshing = true
    refreshPromise = (async () => {
        try {
            const res = await refreshClient.post<{
                accessToken: string
                refreshToken: string
            }>(
                '/auth/refresh',
                {},
                {
                    headers: {
                        Authorization: `Bearer ${refreshToken}`,
                    },
                },
            )

            const { accessToken, refreshToken: newRefresh } = res.data

            // оновлюємо сторадж, зберігаючи того ж користувача
            auth.setAuth({
                accessToken,
                refreshToken: newRefresh,
                user,
            })

            return accessToken
        } catch (e) {
            // refresh не вдався – сесія реально протухла
            auth.logout()
            return null
        } finally {
            isRefreshing = false
            refreshPromise = null
        }
    })()

    return refreshPromise
}

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error?.response?.status as number | undefined
        const originalRequest = error.config as any

        // Якщо не 401 – просто показуємо помилку
        if (status !== 401) {
            handleServerError(error)
            return Promise.reject(error)
        }

        // Якщо вже пробували рефрешнути для цього запиту – не зациклюємось
        if (originalRequest._retry) {
            const { auth } = useAuthStore.getState()
            auth.logout()
            handleServerError(error)
            return Promise.reject(error)
        }

        originalRequest._retry = true

        // Пробуємо отримати новий accessToken
        const newAccessToken = await refreshAccessToken()

        if (!newAccessToken) {
            // refresh не пройшов – повний логаут
            const { auth } = useAuthStore.getState()
            auth.logout()
            handleServerError(error)
            return Promise.reject(error)
        }

        // Підкладаємо новий токен у заголовок і повторюємо запит
        originalRequest.headers = originalRequest.headers ?? {}
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`

        try {
            return await api(originalRequest)
        } catch (e) {
            // якщо повторний запит теж впав – кидаємо далі
            handleServerError(e)
            return Promise.reject(e)
        }
    },
)