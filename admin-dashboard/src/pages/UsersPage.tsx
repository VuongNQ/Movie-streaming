import { Link, Outlet, useLocation } from 'react-router-dom'
import { useUsers } from '../lib/queries'

export function UsersPage() {
  const { data, isLoading, error } = useUsers()
  const location = useLocation()

  if (isLoading) {
    return <p>Loading users...</p>
  }

  if (error) {
    return <p>Unable to load users.</p>
  }

  return (
    <div>
      <h2>Users</h2>
      <ul className="stack">
        {(data ?? []).map((user) => (
          <li key={user.uid} className="list-item">
            <span>{user.username}</span>
            <span className="muted">{user.role}</span>
            <Link
              className="link"
              to={`/users/${user.uid}/devices`}
              state={{ from: location.pathname }}
            >
              View devices
            </Link>
          </li>
        ))}
      </ul>
      <Outlet />
    </div>
  )
}
