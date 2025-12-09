import { createFileRoute } from '@tanstack/react-router'
import { TwoFactorSetup } from '@/features/auth/two-factor-setup'

export const Route = createFileRoute('/(auth)/two-factor-setup')({
  component: TwoFactorSetup,
})
