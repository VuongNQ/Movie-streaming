import { useState } from 'react'
import { MovieDetailsForm } from '../components/forms/MovieDetailsForm'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { firebaseRuntimeConfig } from '../lib/firebase'
import { emptyMovieFormInput, movieToFormInput } from '../lib/movieForm'
import { useAuthPreflight, useCreateMovie, useMovies, useUpdateMovie } from '../lib/queries'
import { useAuthStore } from '../lib/store'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Unknown error'
}

export function MoviesPage() {
  const { data, isLoading, error } = useMovies()
  const createMovie = useCreateMovie()
  const updateMovie = useUpdateMovie()
  const user = useAuthStore((state) => state.user)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null)
  const permissionError = [createMovie.error, updateMovie.error].find(
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
          <Card key={movie.id} className="border-border/80 shadow-none">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">{movie.title}</CardTitle>
              <Badge variant="secondary">{movie.type}</Badge>
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>{movie.description || 'No description'}</span>
                <span>{movie.year}</span>
              </div>

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
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingMovieId(movie.id)}>
                  Edit details
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
