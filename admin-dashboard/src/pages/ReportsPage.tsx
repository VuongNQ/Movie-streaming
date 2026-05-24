import { useState } from 'react'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { useReports } from '../lib/queries'
import type { ReportStatus, ReportsQueryFilters } from '../types'

function formatDate(value: string): string {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return value
  }

  return parsed.toLocaleString()
}

function getStatusBadgeVariant(status: ReportStatus): 'default' | 'secondary' | 'outline' {
  if (status === 'resolved') {
    return 'default'
  }

  if (status === 'in_progress') {
    return 'secondary'
  }

  return 'outline'
}

const defaultFilters: ReportsQueryFilters = {}

export function ReportsPage() {
  const [filters, setFilters] = useState<ReportsQueryFilters>(defaultFilters)
  const [movieIdInput, setMovieIdInput] = useState('')
  const reportsQuery = useReports(filters)

  const sortedReports = (reportsQuery.data ?? []).slice().sort((left, right) => right.created_at.localeCompare(left.created_at))

  return (
    <section className="space-y-4">
      <h2 className="font-display text-2xl font-bold">Reports</h2>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 pt-0 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="report-filter-status">Status</Label>
            <select
              id="report-filter-status"
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={filters.status ?? ''}
              onChange={(event) => {
                const next = event.currentTarget.value
                setFilters((current) => ({
                  ...current,
                  status: next ? (next as ReportStatus) : undefined,
                }))
              }}
            >
              <option value="">All</option>
              <option value="open">open</option>
              <option value="in_progress">in_progress</option>
              <option value="resolved">resolved</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="report-filter-type">Type</Label>
            <select
              id="report-filter-type"
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={filters.report_type ?? ''}
              onChange={(event) => {
                const next = event.currentTarget.value
                setFilters((current) => ({
                  ...current,
                  report_type: next === 'broken_image' || next === 'broken_stream' ? next : undefined,
                }))
              }}
            >
              <option value="">All</option>
              <option value="broken_image">broken_image</option>
              <option value="broken_stream">broken_stream</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="report-filter-movie-id">Movie ID</Label>
            <div className="flex gap-2">
              <Input
                id="report-filter-movie-id"
                value={movieIdInput}
                placeholder="movie_id"
                onChange={(event) => setMovieIdInput(event.currentTarget.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFilters((current) => ({
                    ...current,
                    movie_id: movieIdInput.trim() || undefined,
                  }))
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {reportsQuery.isLoading ? <p className="text-sm text-muted-foreground">Loading reports...</p> : null}
      {reportsQuery.error ? <p className="text-sm text-red-600">Unable to load reports.</p> : null}

      <div className="grid gap-3">
        {sortedReports.map((report) => (
          <Card key={report.id} className="border-border/80 shadow-none">
            <CardHeader className="space-y-2 pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base">{report.movie_title_raw}</CardTitle>
                <Badge variant="outline">{report.report_type}</Badge>
                <Badge variant={getStatusBadgeVariant(report.status)}>{report.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Created: {formatDate(report.created_at)}</p>
            </CardHeader>
            <CardContent className="space-y-3 pt-0 text-sm">
              <p>
                Field: <strong>{report.issue_field}</strong>
              </p>
              <p className="break-all">
                Link: <a href={report.issue_link}>{report.issue_link}</a>
              </p>
              <p>
                Reported by: <strong>{report.reported_by_uid}</strong>
              </p>
              {report.note ? <p>Note: {report.note}</p> : null}
              {report.preview_error_message ? <p>Preview error: {report.preview_error_message}</p> : null}
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
