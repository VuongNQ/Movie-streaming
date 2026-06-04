import { useEffect, useState } from 'react'
import { MovieDetailsForm } from '../components/forms/MovieDetailsForm'
import { MovieSearchFiltersSection } from '../components/forms/MovieSearchFiltersSection'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { HlsPreviewDialog } from '../components/ui/hls-preview-dialog'
import { firebaseRuntimeConfig } from '../lib/firebase'
import { emptyMovieFormInput, movieToFormInput } from '../lib/movieForm'
import { useAuthPreflight, useCreateMovie, useDeleteMovie, useMovies, useUpdateMovie } from '../lib/queries'
import { useAuthStore } from '../lib/store'
import type { MovieSearchFilters } from '../types'

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

const defaultMovieFilters: MovieSearchFilters = {
  title: '',
  genres: [],
}

export function MoviesPage() {
  const [filters, setFilters] = useState<MovieSearchFilters>(defaultMovieFilters)
  const [titleInput, setTitleInput] = useState(defaultMovieFilters.title)
  const { data, isLoading, isFetching, error } = useMovies(filters)
  const { data: allMoviesData } = useMovies(defaultMovieFilters)
  const createMovie = useCreateMovie()
  const updateMovie = useUpdateMovie()
  const deleteMovie = useDeleteMovie()
  const user = useAuthStore((state) => state.user)
  const setHasUnsavedMovieChanges = useAuthStore((state) => state.setHasUnsavedMovieChanges)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null)
  const [isMovieFormDirty, setIsMovieFormDirty] = useState(false)
  const [expandedStreamMovieId, setExpandedStreamMovieId] = useState<string | null>(null)
  const [previewStreamTarget, setPreviewStreamTarget] = useState<{ title: string; serverName: string; link: string } | null>(null)
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

  useEffect(() => {
    setHasUnsavedMovieChanges(isMovieFormDirty)
  }, [isMovieFormDirty, setHasUnsavedMovieChanges])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setFilters((current) => {
        if (current.title === titleInput) {
          return current
        }

        return {
          ...current,
          title: titleInput,
        }
      })
    }, 300)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [titleInput])

  useEffect(
    () => () => {
      setHasUnsavedMovieChanges(false)
    },
    [setHasUnsavedMovieChanges],
  )

  function notifyUnsavedChangesBlocked(): void {
    window.alert('You have unsaved movie changes. Save or cancel them before opening another movie or changing section.')
  }

  function updateFilters(nextFilters: Partial<MovieSearchFilters>): void {
    setFilters((current) => ({
      ...current,
      ...nextFilters,
    }))
  }

  function toggleGenreFilter(genre: string): void {
    setFilters((current) => ({
      ...current,
      genres: current.genres.includes(genre)
        ? current.genres.filter((item) => item !== genre)
        : [...current.genres, genre],
    }))
  }

  function resetFilters(): void {
    setFilters(defaultMovieFilters)
    setTitleInput(defaultMovieFilters.title)
  }

  function clearTitleSearch(): void {
    setTitleInput('')
    setFilters((current) => ({
      ...current,
      title: '',
    }))
  }

  function toggleCreateForm(): void {
    if (isMovieFormDirty) {
      notifyUnsavedChangesBlocked()
      return
    }

    setShowCreateForm((current) => {
      const next = !current

      if (next) {
        setEditingMovieId(null)
      }

      return next
    })
  }

  function startEditingMovie(movieId: string): void {
    if (isMovieFormDirty && editingMovieId !== movieId) {
      notifyUnsavedChangesBlocked()
      return
    }

    setShowCreateForm(false)
    setEditingMovieId(movieId)
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

  const movies = data ?? []
  const allMovies = allMoviesData ?? []
  const shouldShowLoadingState = isLoading && movies.length === 0
  const isEmpty = movies.length === 0
  const hasActiveFilters = filters.title.trim().length > 0 || filters.genres.length > 0 || filters.year !== undefined

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-bold">Movies</h2>
        <Button type="button" size="sm" onClick={toggleCreateForm}>
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
              franchiseMovieOptions={allMovies}
              submitLabel="Add movie"
              isSubmitting={createMovie.isPending}
              onDirtyStateChange={setIsMovieFormDirty}
              onSubmit={async (values) => {
                await createMovie.mutateAsync(values)
                setIsMovieFormDirty(false)
                setShowCreateForm(false)
              }}
              onCancel={() => {
                setIsMovieFormDirty(false)
                setShowCreateForm(false)
              }}
            />
          </CardContent>
        </Card>
      ) : null}

      <MovieSearchFiltersSection
        filters={filters}
        titleInput={titleInput}
        isFetching={isFetching}
        hasActiveFilters={hasActiveFilters}
        onTitleInputChange={setTitleInput}
        onClearTitle={clearTitleSearch}
        onYearChange={(value) => {
          const nextValue = value.trim()
          updateFilters({ year: nextValue.length > 0 ? Number(nextValue) : undefined })
        }}
        onToggleGenre={toggleGenreFilter}
        onResetFilters={resetFilters}
      />

      {error ? (
        <Card className="border-red-300 bg-red-50/60">
          <CardContent className="pt-6 text-sm text-red-700">Unable to load movies.</CardContent>
        </Card>
      ) : null}

      {shouldShowLoadingState ? (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-sm text-muted-foreground">Loading movies...</CardContent>
        </Card>
      ) : null}

      {!shouldShowLoadingState && isEmpty ? (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{hasActiveFilters ? 'No matching movies' : 'No movies yet'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <p className="text-sm text-muted-foreground">
              {hasActiveFilters ? 'Adjust the search filters or reset them to see more movies.' : 'Start your catalog by adding the first movie.'}
            </p>
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
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        onClick={() =>
                          setExpandedStreamMovieId((current) => (current === movie.id ? null : movie.id))
                        }
                      >
                        Streams ({movie.stream_connections.length})
                      </Button>
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

              {expandedStreamMovieId === movie.id && movie.stream_connections.length > 0 ? (
                <div className="mt-3 space-y-1 border-t border-border/60 pt-3">
                  {movie.stream_connections.map((stream, streamIndex) => (
                    <div
                      key={`${movie.id}-stream-${streamIndex}`}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted/40"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{stream.server_name}</span>
                      <Badge variant="secondary" className="shrink-0 text-xs">
                        {stream.type}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-xs${stream.status === 'live' ? ' border-green-500 text-green-700' : ' border-red-400 text-red-600'}`}
                      >
                        {stream.status}
                      </Badge>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 shrink-0 px-2 text-xs"
                        onClick={() =>
                          setPreviewStreamTarget({
                            title: `${movieDisplayTitle} — ${stream.server_name}`,
                            serverName: stream.server_name,
                            link: stream.link,
                          })
                        }
                      >
                        Preview
                      </Button>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3 pt-0">
              {editingMovieId === movie.id ? (
                <>
                  <MovieDetailsForm
                    idPrefix={`movie-${movie.id}`}
                    initialValues={movieToFormInput(movie)}
                    franchiseMovieOptions={allMovies}
                    currentMovieId={movie.id}
                    submitLabel="Update movie"
                    isSubmitting={updateMovie.isPending}
                    onDirtyStateChange={setIsMovieFormDirty}
                    onSubmit={async (values) => {
                      await updateMovie.mutateAsync({ id: movie.id, payload: values })
                      setIsMovieFormDirty(false)
                      setEditingMovieId(null)
                    }}
                    onCancel={() => {
                      setIsMovieFormDirty(false)
                      setEditingMovieId(null)
                    }}
                  />

                  <div className="flex items-center justify-end gap-2 border-t border-border/70 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={deleteMovie.isPending}
                      onClick={() => {
                        void handleRemoveMovie(movie.id, movieDisplayTitle)
                      }}
                    >
                      {deleteMovie.isPending ? 'Removing...' : 'Delete movie'}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => startEditingMovie(movie.id)}>
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

      <HlsPreviewDialog
        open={previewStreamTarget !== null}
        title={previewStreamTarget?.title ?? ''}
        streamUrl={previewStreamTarget?.link ?? ''}
        onClose={() => setPreviewStreamTarget(null)}
      />
    </section>
  )
}
