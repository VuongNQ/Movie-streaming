import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export function DashboardHome() {
  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl font-bold">Admin Dashboard</h2>
      <p className="text-sm text-muted-foreground">Manage movies, users, and devices from one place.</p>

      <div className="grid gap-3 md:grid-cols-3">
        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Movie Management</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">Create, update, and retire movie catalog entries.</CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">User Oversight</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">Review account roles and access boundaries.</CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Device Monitoring</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">Inspect device playlists and tracking history links.</CardContent>
        </Card>
      </div>
    </section>
  )
}
