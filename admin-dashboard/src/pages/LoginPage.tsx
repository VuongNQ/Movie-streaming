import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { useAuthStore } from '../lib/store'

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
    <div className="auth-shell">
      <form className="auth-card" onSubmit={handleSubmit((values) => login(values.email, values.password))}>
        <h1>Admin Login</h1>

        <label htmlFor="email">Email</label>
        <input id="email" type="email" {...register('email')} />
        {errors.email ? <small>{errors.email.message}</small> : null}

        <label htmlFor="password">Password</label>
        <input id="password" type="password" {...register('password')} />
        {errors.password ? <small>{errors.password.message}</small> : null}

        <button type="submit" disabled={loading}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
