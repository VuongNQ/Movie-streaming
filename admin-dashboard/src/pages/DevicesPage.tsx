import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useCreateDevice, useDeleteDevice, useDevices, useMovies, useUpdateDevice } from '../lib/queries'
import type { MovieSearchFilters } from '../types'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Unknown error'
}

function formatWatchTime(totalSeconds: number): string {
  const seconds = Math.max(0, Math.trunc(totalSeconds))
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainderSeconds = seconds % 60

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${remainderSeconds.toString().padStart(2, '0')}`
}

function formatDateLabel(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString()
}

const defaultMovieFilters: MovieSearchFilters = {
  title: '',
  genres: [],
}

export function DevicesPage() {
  const { uid = '' } = useParams()
  const location = useLocation()
  const backLink = (location.state as { from?: string } | undefined)?.from ?? '/users'

  const createDevice = useCreateDevice(uid)
  const updateDevice = useUpdateDevice(uid)
  const deleteDevice = useDeleteDevice(uid)
  const { data, isLoading, error } = useDevices(uid)
  const { data: movies } = useMovies(defaultMovieFilters)
  const [newDeviceName, setNewDeviceName] = useState('')
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null)
  const [editingDeviceName, setEditingDeviceName] = useState('')

  const movieLookup = useMemo(() => {
    const map = new Map<string, { title: string; streamLink?: string }>()

    for (const movie of movies ?? []) {
      const liveStream = movie.stream_connections.find((stream) => stream.status === 'live')
      const fallbackStream = movie.stream_connections[0]
      map.set(movie.id, {
        title: movie.title_vietnamese && movie.title_vietnamese.trim().length > 0 ? movie.title_vietnamese : movie.title_raw,
        streamLink: liveStream?.link ?? fallbackStream?.link,
      })
    }

    return map
  }, [movies])

  async function handleCreateDevice(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    await createDevice.mutateAsync({
      device_name: newDeviceName.trim(),
      playlist: [],
      tracking_history: [],
    })

    setNewDeviceName('')
  }

  async function handleSaveDevice(deviceId: string): Promise<void> {
    await updateDevice.mutateAsync({
      deviceId,
      payload: {
        device_name: editingDeviceName.trim(),
      },
    })
    setEditingDeviceId(null)
    setEditingDeviceName('')
  }

  async function handleDeleteDevice(deviceId: string, deviceName: string): Promise<void> {
    const isConfirmed = window.confirm(`Delete device ${deviceName}?`)
    if (!isConfirmed) {
      return
    }

    await deleteDevice.mutateAsync(deviceId)

    if (editingDeviceId === deviceId) {
      setEditingDeviceId(null)
      setEditingDeviceName('')
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading devices...</p>
  }

  if (error) {
    return <p className="text-sm text-red-600">Unable to load devices.</p>
  }

  const mutationError = createDevice.error ?? updateDevice.error ?? deleteDevice.error

  return (
    <section className="mt-6 border-t border-border pt-5">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-xl font-semibold">Devices of {uid}</h3>
        <Link className="text-sm font-medium text-cyan-700 transition-colors hover:text-cyan-500" to={backLink}>
          Back to users
        </Link>
      </div>

      <Card className="mb-3 border-border/80 shadow-none">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add device</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <form className="flex flex-wrap items-end gap-3" onSubmit={handleCreateDevice}>
            <div className="min-w-[240px] space-y-2">
              <Label htmlFor="new-device-name">Device name</Label>
              <Input
                id="new-device-name"
                value={newDeviceName}
                onChange={(event) => setNewDeviceName(event.target.value)}
                placeholder="Living Room TV"
                required
              />
            </div>
            <Button type="submit" size="sm" disabled={createDevice.isPending}>
              {createDevice.isPending ? 'Adding...' : 'Add device'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {mutationError ? <p className="mb-3 text-sm text-red-600">{getErrorMessage(mutationError)}</p> : null}

      <div className="grid gap-3">
        {(data ?? []).map((device) => (
          <Card key={device.id} className="border-border/80 shadow-none">
            <CardHeader className="pb-2">
              {editingDeviceId === device.id ? (
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[220px] space-y-2">
                    <Label htmlFor={`device-name-${device.id}`}>Device name</Label>
                    <Input
                      id={`device-name-${device.id}`}
                      value={editingDeviceName}
                      onChange={(event) => setEditingDeviceName(event.target.value)}
                    />
                  </div>
                  <Button type="button" size="sm" onClick={() => handleSaveDevice(device.id)} disabled={updateDevice.isPending}>
                    {updateDevice.isPending ? 'Saving...' : 'Save'}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setEditingDeviceId(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <CardTitle className="text-base">{device.device_name}</CardTitle>
              )}
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-sm text-muted-foreground">
              <p>Playlist: {device.playlist.length}</p>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setEditingDeviceId(device.id)
                    setEditingDeviceName(device.device_name)
                  }}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDeleteDevice(device.id, device.device_name)}
                  disabled={deleteDevice.isPending}
                >
                  Delete
                </Button>
              </div>

              <div className="space-y-2 rounded-md border border-border/70 p-3">
                <p className="font-medium text-foreground">Tracking history</p>
                {device.tracking_history.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No tracking history yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {device.tracking_history
                      .slice()
                      .sort((left, right) => right.last_watched_at.localeCompare(left.last_watched_at))
                      .map((entry) => {
                        const movieInfo = movieLookup.get(entry.movie_id)

                        return (
                          <li key={`${device.id}-${entry.movie_id}-${entry.last_watched_at}`} className="rounded border border-border/60 p-2">
                            <p className="text-sm font-medium text-foreground">{movieInfo?.title ?? entry.movie_id}</p>
                            <p className="text-xs">Watched: {formatDateLabel(entry.last_watched_at)}</p>
                            <p className="text-xs">Time on movie: {formatWatchTime(entry.current_position_seconds)}</p>
                            <p className="text-xs break-all">Stream link: {movieInfo?.streamLink ?? 'No stream found on movie'}</p>
                          </li>
                        )
                      })}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
