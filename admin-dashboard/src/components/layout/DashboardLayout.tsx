import { NavLink, Outlet } from 'react-router-dom'
import { useAuthStore } from '../../lib/store'

const navItems = [
  { to: '/', label: 'Overview' },
  { to: '/movies', label: 'Movies' },
  { to: '/users', label: 'Users' },
]

export function DashboardLayout() {
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <h1 className="brand">Movie Admin</h1>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link-active' : ''}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="content">
        <header className="content-header">
          <div>
            <p className="label">Signed in as</p>
            <strong>{user?.email ?? 'Guest'}</strong>
          </div>
          <button type="button" className="button" onClick={() => void logout()}>
            Logout
          </button>
        </header>

        <section className="panel">
          <Outlet />
        </section>
      </main>
    </div>
  )
}
