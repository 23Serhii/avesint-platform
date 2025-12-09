import { useSearch, Link } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <AuthLayout>
      <Card className="gap-4">
        <CardHeader>
          <CardTitle className="text-lg tracking-tight">Увійти</CardTitle>
          <CardDescription>
            Введіть свій позивний та пароль, щоб <br />
            увійти в систему
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UserAuthForm redirectTo={redirect} />
        </CardContent>
        <CardFooter>
          <p className="text-muted-foreground px-8 text-center text-sm">
            Не маєте облікового запису?{' '}
            <Link
              to="/sign-up"
              className="hover:text-primary underline underline-offset-4"
            >
              Зареєструватися
            </Link>
          </p>
        </CardFooter>
      </Card>
    </AuthLayout>
  )
}