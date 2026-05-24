import { useState } from 'react'
import { MovieDetailsForm } from '../components/forms/MovieDetailsForm'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { firebaseRuntimeConfig } from '../lib/firebase'
import { emptyMovieFormInput, movieToFormInput } from '../lib/movieForm'
import { useAuthPreflight, useCreateMovie, useDeleteMovie, useMovies, useUpdateMovie } from '../lib/queries'
import { useAuthStore } from '../lib/store'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Unknown error'
}

function formatDateLabel(value?: string): string | null {
  if (!value) {
    return null
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed.toLocaleString()
}

function getMovieDisplayTitle(rawTitle: string, vietnameseTitle?: string): string {
  return vietnameseTitle && vietnameseTitle.trim().length > 0 ? `${vietnameseTitle} (${rawTitle})` : rawTitle
}

export function MoviesPage() {
  const { data, isLoading, error } = useMovies()
  const createMovie = useCreateMovie()
  const updateMovie = useUpdateMovie()
  const deleteMovie = useDeleteMovie()
  const user = useAuthStore((state) => state.user)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null)
  const permissionError = [createMovie.error, updateMovie.error, deleteMovie.error].find(
    (candidate) =>
      candidate instanceof Error &&
      (candidate.message.includes('Missing or insufficient permissions') || candidate.message.includes('permission-denied')),
  )
  const authPreflight = useAuthPreflight(user?.uid ?? '', Boolean(user?.uid) && Boolean(permissionError))

  const preflightSummary = user?.uid
    ? authPreflight.isLoading
      ? 'checking users/{uid} document...'
      : authPreflight.isError
        ? 'failed to read users/{uid} document.'
        : authPreflight.data
          ? `user_doc_exists=${String(authPreflight.data.user_doc_exists)}, role_in_user_doc=${authPreflight.data.role_in_user_doc ?? 'null'}, is_admin_by_user_doc=${String(authPreflight.data.is_admin_by_user_doc)}`
          : 'not checked'
    : 'not signed in'

  const diagnosticsText = permissionError
    ? [
        'Movie save permission diagnostics',
        `error: ${getErrorMessage(permissionError)}`,
        `uid: ${user?.uid ?? 'not signed in'}`,
        `role: ${user?.role ?? 'unknown'}`,
        `auth preflight: ${preflightSummary}`,
        `firebase project: ${firebaseRuntimeConfig.projectId}`,
        `firestore database: ${firebaseRuntimeConfig.databaseId}`,
      ].join('\n')
    : ''

  async function copyDiagnostics(): Promise<void> {
    if (!diagnosticsText || !navigator.clipboard) {
      return
    }

    try {
      await navigator.clipboard.writeText(diagnosticsText)
    } catch {
      // Clipboard write can fail in restricted contexts; keep this non-blocking.
    }
  }

  async function handleRemoveMovie(id: string, title: string): Promise<void> {
    const isConfirmed = window.confirm(`Remove movie "${title}" from list?`)
    if (!isConfirmed) {
      return
    }

    await deleteMovie.mutateAsync(id)

    if (editingMovieId === id) {
      setEditingMovieId(null)
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading movies...</p>
  }

  if (error) {
    return <p className="text-sm text-red-600">Unable to load movies.</p>
  }

  const movies = data ?? []
  const isEmpty = movies.length === 0

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Movies</h2>
        <Button type="button" size="sm" onClick={() => setShowCreateForm((current) => !current)}>
          {showCreateForm ? 'Hide form' : 'Add movie'}
        </Button>
      </div>

      {permissionError ? (
        <Card className="border-red-300 bg-red-50/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-red-700">Permission diagnostics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0 text-sm text-red-700">
            <p>{getErrorMessage(permissionError)}</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>uid: {user?.uid ?? 'not signed in'}</li>
              <li>role: {user?.role ?? 'unknown'}</li>
              <li>auth preflight: {preflightSummary}</li>
              <li>firebase project: {firebaseRuntimeConfig.projectId}</li>
              <li>firestore database: {firebaseRuntimeConfig.databaseId}</li>
            </ul>
            <div>
              <Button type="button" size="sm" variant="outline" onClick={copyDiagnostics}>
                Copy diagnostics
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showCreateForm ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Add movie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <MovieDetailsForm
              idPrefix="create-movie"
              initialValues={emptyMovieFormInput()}
              submitLabel="Add movie"
              isSubmitting={createMovie.isPending}
              onSubmit={async (values) => {
                await createMovie.mutateAsync(values)
                setShowCreateForm(false)
              }}
              onCancel={() => setShowCreateForm(false)}
            />
          </CardContent>
        </Card>
      ) : null}

      {isEmpty ? (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">No movies yet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <p className="text-sm text-muted-foreground">Start your catalog by adding the first movie.</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3">
        {movies.map((movie) => (
          (() => {
            const movieDisplayTitle = getMovieDisplayTitle(movie.title_raw, movie.title_vietnamese)

            return (
          <Card key={movie.id} className="border-border/80 shadow-none">
            <CardHeader className="pb-3">
              <div className="flex items-start gap-4">
                <div className="h-auto max-h-48 w-32 shrink-0 overflow-hidden rounded-md border bg-muted">
                  <img
                    src={movie.thumbnail_link}
                    alt={`${movieDisplayTitle} thumbnail`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                    }}
                  />
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base">{movieDisplayTitle}</CardTitle>
                    <Badge variant="secondary">{movie.type}</Badge>
                  </div>

                  <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
                    <span className="min-w-0 flex-1 line-clamp-3">{movie.description || 'No description'}</span>
                    <span className="shrink-0">{movie.year}</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {movie.genres.length > 0
                      ? movie.genres.map((genre) => (
                          <Badge key={`${movie.id}-genre-${genre}`} variant="secondary">
                            {genre}
                          </Badge>
                        ))
                      : null}

                    {movie.stream_connections.length > 0 ? (
                      Array.from(new Set(movie.stream_connections.map((stream) => stream.server_name))).map((serverName) => (
                        <Badge key={`${movie.id}-${serverName}`} variant="outline">
                          {serverName}
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline">No streams</Badge>
                    )}
                  </div>

                  {formatDateLabel(movie.created_at) || formatDateLabel(movie.last_updated) ? (
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                      {formatDateLabel(movie.created_at) ? <span>Created: {formatDateLabel(movie.created_at)}</span> : null}
                      {formatDateLabel(movie.last_updated) ? <span>Last updated: {formatDateLabel(movie.last_updated)}</span> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {editingMovieId === movie.id ? (
                <MovieDetailsForm
                  idPrefix={`movie-${movie.id}`}
                  initialValues={movieToFormInput(movie)}
                  submitLabel="Update movie"
                  isSubmitting={updateMovie.isPending}
                  onSubmit={async (values) => {
                    await updateMovie.mutateAsync({ id: movie.id, payload: values })
                    setEditingMovieId(null)
                  }}
                  onCancel={() => setEditingMovieId(null)}
                />
              ) : (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setEditingMovieId(movie.id)}>
                    Edit details
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={deleteMovie.isPending}
                    onClick={() => {
                      void handleRemoveMovie(movie.id, movieDisplayTitle)
                    }}
                  >
                    {deleteMovie.isPending ? 'Removing...' : 'Remove'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
            )
          })()
        ))}
      </div>
    </section>
  )
}
