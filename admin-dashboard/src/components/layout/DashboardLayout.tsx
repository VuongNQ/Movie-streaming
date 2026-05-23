import { NavLink, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'
import { Button } from '../ui/button'
import { Card, CardContent } from '../ui/card'
import { cn } from '../../lib/utils'

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/movies', label: 'Movies' },
  { to: '/users', label: 'Users' },
]

export function DashboardLayout() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  return (
    <div className="grid min-h-screen lg:grid-cols-[260px_1fr]">
      <aside className="bg-grain-glow border-b border-border/40 p-6 text-slate-100 lg:border-b-0 lg:border-r">
        <div className="mb-8">
          <p className="font-display text-xs uppercase tracking-[0.22em] text-cyan-100/70">Control Center</p>
          <h1 className="font-display text-2xl font-bold tracking-tight">Movie Admin</h1>
        </div>

        <nav className="flex gap-2 lg:flex-col">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'inline-flex rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-cyan-200/20 text-white ring-1 ring-cyan-100/40'
                    : 'text-slate-200/80 hover:bg-white/10 hover:text-white',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="p-4 sm:p-6">
        <Card className="mb-4">
          <CardContent className="flex items-center justify-between p-4 sm:p-5">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Signed in as</p>
              <strong className="text-sm text-foreground sm:text-base">{user?.email ?? 'Guest'}</strong>
            </div>
            <Button type="button" variant="outline" onClick={() => void logout()}>
              Logout
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <Outlet />
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
