import { Link, useLocation, useParams } from 'react-router-dom'
import { useDevices } from '../lib/queries'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export function DevicesPage() {
  const { uid = '' } = useParams()
  const location = useLocation()
  const backLink = (location.state as { from?: string } | undefined)?.from ?? '/users'

  const { data, isLoading, error } = useDevices(uid)

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading devices...</p>
  }

  if (error) {
    return <p className="text-sm text-red-600">Unable to load devices.</p>
  }

  return (
    <section className="mt-6 border-t border-border pt-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold">Devices of {uid}</h3>
        <Link className="text-sm font-medium text-cyan-700 transition-colors hover:text-cyan-500" to={backLink}>
          Back to users
        </Link>
      </div>

      <div className="grid gap-3">
        {(data ?? []).map((device) => (
          <Card key={device.id} className="border-border/80 shadow-none">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{device.device_name}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 text-sm text-muted-foreground">
              Playlist: {device.playlist.length}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
