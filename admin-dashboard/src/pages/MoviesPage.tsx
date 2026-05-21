import { useMovies } from '../lib/queries'

export function MoviesPage() {
  const { data, isLoading, error } = useMovies()

  if (isLoading) {
    return <p>Loading movies...</p>
  }

  if (error) {
    return <p>Unable to load movies.</p>
  }

  return (
    <div>
      <h2>Movies</h2>
      <ul className="stack">
        {(data ?? []).map((movie) => (
          <li key={movie.id} className="list-item">
            <span>{movie.title}</span>
            <span className="muted">{movie.year}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
