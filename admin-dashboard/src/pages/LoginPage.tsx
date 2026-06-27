import { useEffect, useState } from 'react'
import { FirebaseError } from 'firebase/app'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'

export function LoginPage() {
  const login = useAuthStore((state) => state.login)
  const loading = useAuthStore((state) => state.loading)
  const user = useAuthStore((state) => state.user)
  const initialized = useAuthStore((state) => state.initialized)
  const navigate = useNavigate()
  const [loginError, setLoginError] = useState<string | null>(null)

  useEffect(() => {
    if (initialized && user) {
      navigate('/', { replace: true })
    }
  }, [user, initialized, navigate])

  if (initialized && user) {
    return <Navigate to="/" replace />
  }

  async function onSignInWithGoogle() {
    setLoginError(null)

    try {
      await login()
    } catch (error) {
      if (error instanceof FirebaseError) {
        if (error.code === 'auth/popup-closed-by-user') {
          setLoginError('Google sign-in was canceled before completion.')
          return
        }

        if (error.code === 'auth/popup-blocked') {
          setLoginError('Popup was blocked by your browser. Please allow popups and try again.')
          return
        }

        if (error.code === 'auth/unauthorized-domain') {
          setLoginError('This domain is not authorized for Google sign-in in Firebase Auth.')
          return
        }
      }

      setLoginError('Google sign-in failed. Please try again.')
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>Sign in with Google to manage movies, users, and devices.</CardDescription>
        </CardHeader>

        <CardContent>
          <div className="grid gap-4">
            <Button type="button" disabled={loading} className="mt-2 w-full" onClick={onSignInWithGoogle}>
              {loading ? 'Signing in...' : 'Continue with Google'}
            </Button>

            {loginError ? <small className="text-xs text-red-600">{loginError}</small> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
