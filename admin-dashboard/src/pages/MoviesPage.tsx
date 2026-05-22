import { useState } from 'react'
import { MovieDetailsForm } from '../components/forms/MovieDetailsForm'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { emptyMovieFormInput, movieToFormInput } from '../lib/movieForm'
import { useCreateMovie, useMovies, useUpdateMovie } from '../lib/queries'

export function MoviesPage() {
  const { data, isLoading, error } = useMovies()
  const createMovie = useCreateMovie()
  const updateMovie = useUpdateMovie()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingMovieId, setEditingMovieId] = useState<string | null>(null)

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
