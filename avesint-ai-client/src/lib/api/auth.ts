// avesint-ai-client/src/lib/api/auth.ts
import { api } from './client'
import type { User } from '@/stores/auth-store'

type RawUser = {
    id: string
    callsign: string
    displayName?: string
    role: string
    isTwoFactorEnabled: boolean
    // бекенд також повертає passwordHash, twoFactorSecret, але на фронті вони не потрібні
}

type LoginResponseWithout2FA = {
    user: RawUser
    requires2FA: false
    accessToken: string
    refreshToken: string
}

type LoginResponseWith2FA = {
    user: RawUser
    requires2FA: true
    tempAccessToken: string
}

export type LoginResponse = LoginResponseWithout2FA | LoginResponseWith2FA

export async function login(callsign: string, password: string): Promise<LoginResponse> {
    const res = await api.post<LoginResponse>('/auth/login', {
        callsign,
        password,
    })

    return res.data
}

type Verify2FAResponse = {
    user: RawUser
    requires2FA: false
    accessToken: string
    refreshToken: string
}

export async function verify2FA(code: string): Promise<Verify2FAResponse> {
    const res = await api.post<Verify2FAResponse>('/2fa/verify', {
        code,
    })

    return res.data
}

// Маппінг RawUser -> User з auth-store.ts
export function mapRawUser(raw: RawUser): User {
    return {
        id: raw.id,
        callsign: raw.callsign,
        displayName: raw.displayName,
        role: raw.role,
        isTwoFactorEnabled: raw.isTwoFactorEnabled,
    }
}