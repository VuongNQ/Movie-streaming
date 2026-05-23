import { useEffect } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { DashboardLayout } from './components/layout/DashboardLayout'
import { useAuthStore } from './lib/store'
import { DashboardHome } from './pages/DashboardHome'
import { DevicesPage } from './pages/DevicesPage'
import { LoginPage } from './pages/LoginPage'
import { MoviesPage } from './pages/MoviesPage'
import { UsersPage } from './pages/UsersPage'

function AdminOnlyRoute() {
  const initialized = useAuthStore((state) => state.initialized)
  const user = useAuthStore((state) => state.user)

  if (!initialized) {
    return <p className="grid min-h-screen place-items-center text-muted-foreground">Checking session...</p>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== 'admin') {
    return <p className="grid min-h-screen place-items-center text-red-600">Permission denied. Admin role is required.</p>
  }

  return <Outlet />
}

export default function App() {
  const initAuth = useAuthStore((state) => state.init)

  useEffect(() => {
    const unsubscribe = initAuth()
    return () => unsubscribe()
  }, [initAuth])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<AdminOnlyRoute />}>
        <Route element={<DashboardLayout />}>
          <Route path="/" element={<DashboardHome />} />
          <Route path="/movies" element={<MoviesPage />} />
          <Route path="/users" element={<UsersPage />}>
            <Route path=":uid/devices" element={<DevicesPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
