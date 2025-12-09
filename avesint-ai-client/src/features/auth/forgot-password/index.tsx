import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { ForgotPasswordForm } from './components/forgot-password-form'

export function ForgotPassword() {
  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader>
          <CardTitle className='text-lg tracking-tight'>
            Забули пароль
          </CardTitle>
          <CardDescription>
            Введіть свою зареєстровану електронну адресу та <br /> ми надішлемо вам посилання для
            перезавантаження пароля.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>

      </Card>
    </AuthLayout>
  )
}
