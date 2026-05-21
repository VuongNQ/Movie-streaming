import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAuthStore } from '../lib/store'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
})

type LoginInput = z.infer<typeof loginSchema>

export function LoginPage() {
  const login = useAuthStore((state) => state.login)
  const loading = useAuthStore((state) => state.loading)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>Sign in to manage movies, users, and devices.</CardDescription>
        </CardHeader>

        <CardContent>
          <form className="grid gap-4" onSubmit={handleSubmit((values) => login(values.email, values.password))}>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="admin@movie-streaming.com" {...register('email')} />
              {errors.email ? <small className="text-xs text-red-600">{errors.email.message}</small> : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" {...register('password')} />
              {errors.password ? <small className="text-xs text-red-600">{errors.password.message}</small> : null}
            </div>

            <Button type="submit" disabled={loading} className="mt-2 w-full">
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
