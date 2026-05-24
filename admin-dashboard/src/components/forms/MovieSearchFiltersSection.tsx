import { Button } from '../ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Input } from '../ui/input'
import { movieGenreOptions } from '../../lib/movieForm'
import type { MovieSearchFilters } from '../../types'

interface MovieSearchFiltersSectionProps {
  filters: MovieSearchFilters
  titleInput: string
  isFetching: boolean
  hasActiveFilters: boolean
  onTitleInputChange: (value: string) => void
  onClearTitle: () => void
  onYearChange: (value: string) => void
  onToggleGenre: (genre: string) => void
  onResetFilters: () => void
}

export function MovieSearchFiltersSection({
  filters,
  titleInput,
  isFetching,
  hasActiveFilters,
  onTitleInputChange,
  onClearTitle,
  onYearChange,
  onToggleGenre,
  onResetFilters,
}: MovieSearchFiltersSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Search and filters</CardTitle>
            <p className="text-sm text-muted-foreground">
              Filter by title keywords, genre, and year. Active filters combine with AND.
              {isFetching ? ' Updating results...' : ''}
            </p>
          </div>
          <Button type="button" size="sm" variant="outline" onClick={onResetFilters} disabled={!hasActiveFilters}>
            Reset filters
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid gap-3 md:grid-cols-[minmax(0,2fr)_180px]">
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="movie-search-title">
              Title search
            </label>
            <div className="relative">
              <Input
                id="movie-search-title"
                value={titleInput}
                placeholder="Search title or Vietnamese title"
                className="pr-12"
                onChange={(event) => onTitleInputChange(event.currentTarget.value)}
              />
              {titleInput.trim().length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2"
                  onClick={onClearTitle}
                  aria-label="Clear title search"
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium" htmlFor="movie-search-year">
              Year
            </label>
            <Input
              id="movie-search-year"
              type="number"
              inputMode="numeric"
              value={filters.year ?? ''}
              placeholder="Any year"
              onChange={(event) => onYearChange(event.currentTarget.value)}
            />
          </div>
        </div>

        <div className="grid gap-2">
          <p className="text-sm font-medium">Genres</p>
          <div className="flex flex-wrap gap-2">
            {movieGenreOptions.map((genre) => {
              const isSelected = filters.genres.includes(genre)

              return (
                <Button
                  key={genre}
                  type="button"
                  size="sm"
                  variant={isSelected ? 'default' : 'outline'}
                  onClick={() => onToggleGenre(genre)}
                >
                  {genre}
                </Button>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Selecting multiple genres matches any selected genre, then combines with title and year.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}