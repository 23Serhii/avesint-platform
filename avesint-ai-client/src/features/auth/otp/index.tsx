import { Link, useSearch } from '@tanstack/react-router'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { AuthLayout } from '../auth-layout';
import { OtpForm } from './components/otp-form';


export function Otp() {
  const { token, redirect } = useSearch({ from: '/(auth)/otp' })

  return (
    <AuthLayout>
      <Card className='gap-4'>
        <CardHeader />
        <CardContent>
          <OtpForm token={token} redirectTo={redirect || '/'} />
        </CardContent>
        <CardFooter>
          <p className='text-muted-foreground px-8 text-center text-sm'>
            Проблеми з кодом?{' '}
            <Link
              to='/sign-in'
              className='hover:text-primary underline underline-offset-4'
            >
              Повернутися до входу
            </Link>
            .
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}
