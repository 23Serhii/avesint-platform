import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.tsx'
import { AuthLayout } from '../auth-layout.tsx'
import { TwoFactorSetupForm } from '@/features/auth/two-factor-setup/components/two-factor-setup-form.tsx'

export function TwoFactorSetup() {
  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Налаштування двофакторної аутентифікації
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TwoFactorSetupForm />
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
