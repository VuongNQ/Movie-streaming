import { Link, useLocation, useParams } from 'react-router-dom'
import { useDevices } from '../lib/queries'

export function DevicesPage() {
  const { uid = '' } = useParams()
  const location = useLocation()
  const backLink = (location.state as { from?: string } | undefined)?.from ?? '/users'

  const { data, isLoading, error } = useDevices(uid)

  if (isLoading) {
    return <p>Loading devices...</p>
  }

  if (error) {
    return <p>Unable to load devices.</p>
  }

  return (
    <div className="sub-panel">
      <div className="sub-panel-header">
        <h3>Devices of {uid}</h3>
        <Link className="link" to={backLink}>
          Back to users
        </Link>
      </div>

      <ul className="stack">
        {(data ?? []).map((device) => (
          <li key={device.id} className="list-item">
            <span>{device.device_name}</span>
            <span className="muted">Playlist: {device.playlist.length}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
