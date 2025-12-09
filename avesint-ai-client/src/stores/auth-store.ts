// src/stores/auth-store.ts
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface User {
    id: string
    name?: string
    role?: string
    callsign?: string
    displayName?: string
    roles?: string[] | string
    isTwoFactorEnabled?: boolean
}

export interface AuthSlice {
    accessToken: string | null
    refreshToken: string | null
    user: User | null
    isAuthenticated: boolean

    setAuth: (data: {
        accessToken: string
        refreshToken?: string
        user: User
    }) => void

    setAccessToken: (token: string | null) => void
    setUser: (user: User | null) => void

    logout: () => void
    reset: () => void
}

export interface AuthState {
    auth: AuthSlice
}

const initialAuthData: Pick<
    AuthSlice,
    'accessToken' | 'refreshToken' | 'user' | 'isAuthenticated'
> = {
    accessToken: null,
    refreshToken: null,
    user: null,
    isAuthenticated: false,
}

// Фабрика методів, щоб не дублювати код
function createAuthSliceMethods(set: (fn: (state: AuthState) => AuthState) => void) {
    return {
        setAuth: (data: { accessToken: string; refreshToken?: string; user: User }) =>
            set((state) => ({
                auth: {
                    ...state.auth,
                    accessToken: data.accessToken,
                    refreshToken: data.refreshToken ?? null,
                    user: data.user,
                    isAuthenticated: true,
                },
            })),

        setAccessToken: (token: string | null) =>
            set((state) => ({
                auth: {
                    ...state.auth,
                    accessToken: token,
                    isAuthenticated: !!token && !!state.auth.user,
                },
            })),

        setUser: (user: User | null) =>
            set((state) => ({
                auth: {
                    ...state.auth,
                    user,
                    isAuthenticated: !!user && !!state.auth.accessToken,
                },
            })),

        logout: () =>
            set((state) => ({
                auth: {
                    ...state.auth,
                    accessToken: null,
                    refreshToken: null,
                    user: null,
                    isAuthenticated: false,
                },
            })),

        reset: () =>
            set((state) => ({
                auth: {
                    ...state.auth,
                    accessToken: null,
                    refreshToken: null,
                    user: null,
                    isAuthenticated: false,
                },
            })),
    }
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            auth: {
                ...initialAuthData,
                ...createAuthSliceMethods(set),
            },
        }),
        {
            name: 'auth-storage',
            storage: createJSONStorage(() => localStorage),

            // У localStorage зберігаємо тільки дані, без методів
            partialize: (state) => ({
                auth: {
                    accessToken: state.auth.accessToken,
                    refreshToken: state.auth.refreshToken,
                    user: state.auth.user,
                    isAuthenticated: state.auth.isAuthenticated,
                },
            }),

            // При гідрації НЕ перетираємо методи, а накладаємо зверху дані
            merge: (persisted, current) => {
                if (!persisted) return current

                const persistedAuth = (persisted as AuthState).auth
                if (!persistedAuth) return current

                return {
                    ...current,
                    auth: {
                        ...current.auth, // тут методи з create(...)
                        ...persistedAuth, // тут – тільки data-поля
                    },
                }
            },
        },
    ),
)