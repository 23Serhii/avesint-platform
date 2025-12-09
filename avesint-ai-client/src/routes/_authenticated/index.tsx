// src/routes/_authenticated/index.tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import { DashboardOverviewPage } from '@/features/dashboard'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/')({
    beforeLoad: () => {
        const { auth } = useAuthStore.getState()
        const user = auth.user

        if (!user) {
            throw redirect({ to: '/sign-in' })
        }

        // за бажанням можна додати перевірку пермішнів для доступу до дашборду
        return null
    },
    component: DashboardOverviewPage,
})