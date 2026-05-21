import { Link, Outlet, useLocation } from 'react-router-dom'
import { useUsers } from '../lib/queries'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export function UsersPage() {
  const { data, isLoading, error } = useUsers()
  const location = useLocation()

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading users...</p>
  }

  if (error) {
    return <p className="text-sm text-red-600">Unable to load users.</p>
  }

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl font-bold">Users</h2>

      <div className="grid gap-3">
        {(data ?? []).map((user) => (
          <Card key={user.uid} className="border-border/80 shadow-none">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">{user.username}</CardTitle>
              <Badge variant="outline">{user.role}</Badge>
            </CardHeader>
            <CardContent className="pt-0">
              <Link
                className="text-sm font-medium text-cyan-700 transition-colors hover:text-cyan-500"
                to={`/users/${user.uid}/devices`}
                state={{ from: location.pathname }}
              >
                View devices
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>

      <Outlet />
    </section>
  )
}
