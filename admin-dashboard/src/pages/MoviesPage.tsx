import { useMovies } from '../lib/queries'
import { Badge } from '../components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'

export function MoviesPage() {
  const { data, isLoading, error } = useMovies()

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading movies...</p>
  }

  if (error) {
    return <p className="text-sm text-red-600">Unable to load movies.</p>
  }

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl font-bold">Movies</h2>

      <div className="grid gap-3">
        {(data ?? []).map((movie) => (
          <Card key={movie.id} className="border-border/80 shadow-none">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-base">{movie.title}</CardTitle>
              <Badge variant="secondary">{movie.type}</Badge>
            </CardHeader>
            <CardContent className="flex items-center justify-between pt-0 text-sm text-muted-foreground">
              <span>{movie.description || 'No description'}</span>
              <span>{movie.year}</span>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
