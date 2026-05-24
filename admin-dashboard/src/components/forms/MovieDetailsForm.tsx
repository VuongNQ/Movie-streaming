import { useEffect, useState } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { Button } from '../ui/button'
import { HlsPreviewDialog, type HlsPreviewResult } from '../ui/hls-preview-dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { movieFormSchema, movieGenreOptions, type MovieFormInput, type MovieFormValues } from '../../lib/movieForm'
import type { Movie } from '../../types'

interface MovieDetailsFormProps {
  idPrefix: string
  initialValues: MovieFormInput
  franchiseMovieOptions?: Movie[]
  currentMovieId?: string
  submitLabel: string
  isSubmitting: boolean
  onSubmit: (values: MovieFormValues) => Promise<void>
  onCancel?: () => void
  onDirtyStateChange?: (isDirty: boolean) => void
}

function parseCommaSeparatedValues(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function getMovieOptionLabel(movie: Pick<Movie, 'title_raw' | 'title_vietnamese' | 'id'>): string {
  return movie.title_vietnamese && movie.title_vietnamese.trim().length > 0
    ? `${movie.title_vietnamese} (${movie.title_raw})`
    : movie.title_raw || movie.id
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Unable to save movie details.'
}

function mergeMetadataJson(existingJson: string, detectedMetadata: Record<string, unknown>): Record<string, unknown> {
  const trimmed = existingJson.trim()

  if (trimmed.length === 0) {
    return detectedMetadata
  }

  try {
    const parsed: unknown = JSON.parse(trimmed)
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return {
        ...(parsed as Record<string, unknown>),
        ...detectedMetadata,
      }
    }
  } catch {
    // Keep probe metadata even when the existing value is malformed.
  }

  return detectedMetadata
}

export function MovieDetailsForm({
  idPrefix,
  initialValues,
  franchiseMovieOptions = [],
  currentMovieId,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
  onDirtyStateChange,
}: MovieDetailsFormProps) {
  const [franchiseSearchInput, setFranchiseSearchInput] = useState('')
  const [previewTarget, setPreviewTarget] = useState<{
    index: number
    fieldId: string
    streamUrl: string
    serverName: string
  } | null>(null)
  const [previewMessages, setPreviewMessages] = useState<Record<string, { kind: 'success' | 'error'; message: string }>>({})

  const {
    control,
    register,
    handleSubmit,
    getValues,
    watch,
    setValue,
    setError,
    formState: { errors, isDirty },
  } = useForm<MovieFormInput, undefined, MovieFormValues>({
    resolver: zodResolver(movieFormSchema),
    defaultValues: initialValues,
    reValidateMode: 'onChange',
  })
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'stream_connections',
  })
  const selectedGenres = watch('genres') ?? []
  const selectedType = watch('type')
  const selectedFranchiseMovieIds = parseCommaSeparatedValues(watch('franchise_movie_ids_csv') ?? '')
  const franchiseOptions = franchiseMovieOptions.filter((movie) => movie.id !== currentMovieId)
  const visibleFranchiseOptions = franchiseOptions
    .filter((movie) => {
      if (franchiseSearchInput.trim().length === 0) {
        return true
      }

      const haystack = `${movie.id} ${movie.title_raw} ${movie.title_vietnamese ?? ''}`.toLowerCase()
      return haystack.includes(franchiseSearchInput.trim().toLowerCase())
    })
    .slice(0, 12)

  useEffect(() => {
    onDirtyStateChange?.(isDirty)
  }, [isDirty, onDirtyStateChange])

  useEffect(
    () => () => {
      onDirtyStateChange?.(false)
    },
    [onDirtyStateChange],
  )

  async function handleFormSubmit(values: MovieFormValues) {
    try {
      await onSubmit(values)
    } catch (error) {
      setError('root', { message: getErrorMessage(error) })
    }
  }

  function openStreamPreview(index: number, fieldId: string) {
    const streamUrl = (getValues(`stream_connections.${index}.link`) ?? '').trim()
    const serverName = (getValues(`stream_connections.${index}.server_name`) ?? '').trim() || `Connection ${index + 1}`

    if (!streamUrl) {
      setPreviewMessages((current) => ({
        ...current,
        [fieldId]: {
          kind: 'error',
          message: 'Enter a stream link before previewing this connection.',
        },
      }))
      return
    }

    setPreviewTarget({
      index,
      fieldId,
      streamUrl,
      serverName,
    })
  }

  function applyPreviewResult(result: HlsPreviewResult) {
    if (!previewTarget) {
      return
    }

    const streamConnections = getValues('stream_connections') ?? []
    if (previewTarget.index >= streamConnections.length) {
      setPreviewTarget(null)
      return
    }

    const statusPath = `stream_connections.${previewTarget.index}.status` as const
    const metadataPath = `stream_connections.${previewTarget.index}.metadata_json` as const
    setValue(statusPath, result.status, { shouldDirty: true, shouldValidate: true })

    if (result.status === 'live' && result.metadata) {
      const currentMetadata = getValues(metadataPath) ?? ''
      const mergedMetadata = mergeMetadataJson(currentMetadata, result.metadata)
      setValue(metadataPath, JSON.stringify(mergedMetadata, null, 2), {
        shouldDirty: true,
        shouldValidate: true,
      })
    }

    setPreviewMessages((current) => ({
      ...current,
      [previewTarget.fieldId]:
        result.status === 'live'
          ? {
              kind: 'success',
              message: 'Preview succeeded. Status is now live and metadata was updated.',
            }
          : {
              kind: 'error',
              message: result.errorMessage ?? 'Preview failed. Status is now dead.',
            },
    }))

  }

  function toggleGenre(genre: string) {
    const currentGenres = getValues('genres') ?? []
    const nextGenres = currentGenres.includes(genre)
      ? currentGenres.filter((item) => item !== genre)
      : [...currentGenres, genre]

    setValue('genres', nextGenres, { shouldDirty: true, shouldValidate: true })
  }

  function toggleFranchiseMovieId(movieId: string) {
    const currentIds = parseCommaSeparatedValues(getValues('franchise_movie_ids_csv') ?? '')
    const nextIds = currentIds.includes(movieId)
      ? currentIds.filter((id) => id !== movieId)
      : [...currentIds, movieId]

    setValue('franchise_movie_ids_csv', nextIds.join(', '), { shouldDirty: true, shouldValidate: true })
  }

  function removeFranchiseMovieId(movieId: string) {
    const currentIds = parseCommaSeparatedValues(getValues('franchise_movie_ids_csv') ?? '')
    const nextIds = currentIds.filter((id) => id !== movieId)

    setValue('franchise_movie_ids_csv', nextIds.join(', '), { shouldDirty: true, shouldValidate: true })
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(handleFormSubmit)}>
      {isDirty ? (
        <div className="sticky top-0 z-20 -mx-4 w-[calc(100%+2rem)] sm:-mx-6 sm:w-[calc(100%+3rem)] md:col-span-2">
          <div className="flex items-center justify-between gap-3 border-y border-amber-300 bg-amber-50 px-4 py-2 sm:px-6">
            <p className="text-sm font-medium text-amber-800">You have unsaved movie changes.</p>
            <div className="flex items-center gap-2">
              <Button type="submit" size="sm" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : submitLabel}
              </Button>
              {onCancel ? (
                <Button type="button" size="sm" variant="outline" onClick={onCancel}>
                  Discard
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-2 md:col-span-2">
        <Label htmlFor={`${idPrefix}-title_raw`}>Title (Raw)</Label>
        <Input id={`${idPrefix}-title_raw`} placeholder="Original movie title" {...register('title_raw')} />
        {errors.title_raw ? <small className="text-xs text-red-600">{errors.title_raw.message}</small> : null}
      </div>

      <div className="grid gap-2 md:col-span-2">
        <Label htmlFor={`${idPrefix}-title_vietnamese`}>Title (Vietnamese, optional)</Label>
        <Input id={`${idPrefix}-title_vietnamese`} placeholder="Vietnamese title" {...register('title_vietnamese')} />
        {errors.title_vietnamese ? <small className="text-xs text-red-600">{errors.title_vietnamese.message}</small> : null}
      </div>

      <div className="grid gap-2 md:col-span-2">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Input id={`${idPrefix}-description`} placeholder="Short description" {...register('description')} />
        {errors.description ? <small className="text-xs text-red-600">{errors.description.message}</small> : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-thumbnail_link`}>Thumbnail URL</Label>
        <Input id={`${idPrefix}-thumbnail_link`} placeholder="https://..." {...register('thumbnail_link')} />
        {errors.thumbnail_link ? <small className="text-xs text-red-600">{errors.thumbnail_link.message}</small> : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-background_link`}>Background URL</Label>
        <Input id={`${idPrefix}-background_link`} placeholder="https://..." {...register('background_link')} />
        {errors.background_link ? <small className="text-xs text-red-600">{errors.background_link.message}</small> : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-type`}>Type</Label>
        <select
          id={`${idPrefix}-type`}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register('type')}
        >
          <option value="single_movie">single_movie</option>
          <option value="tv_series">tv_series</option>
          <option value="franchise">franchise</option>
        </select>
        {errors.type ? <small className="text-xs text-red-600">{errors.type.message}</small> : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-year`}>Year</Label>
        <Input id={`${idPrefix}-year`} type="number" {...register('year')} />
        {errors.year ? <small className="text-xs text-red-600">{errors.year.message}</small> : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-episode_count`}>Episode count</Label>
        <Input id={`${idPrefix}-episode_count`} type="number" {...register('episode_count')} />
        {errors.episode_count ? <small className="text-xs text-red-600">{errors.episode_count.message}</small> : null}
      </div>

      {selectedType === 'franchise' ? (
        <div className="grid gap-3 md:col-span-2">
          <div className="grid gap-2">
            <Label htmlFor={`${idPrefix}-franchise-search`}>Pick franchise movie IDs</Label>
            <div className="relative">
              <Input
                id={`${idPrefix}-franchise-search`}
                value={franchiseSearchInput}
                placeholder="Search by movie title or document ID"
                className="pr-12"
                onChange={(event) => setFranchiseSearchInput(event.currentTarget.value)}
              />
              {franchiseSearchInput.trim().length > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-1 top-1/2 h-7 -translate-y-1/2 px-2"
                  onClick={() => setFranchiseSearchInput('')}
                >
                  Clear
                </Button>
              ) : null}
            </div>
            <input type="hidden" {...register('franchise_movie_ids_csv')} />
          </div>

          {selectedFranchiseMovieIds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedFranchiseMovieIds.map((movieId) => (
                <Button
                  key={`${idPrefix}-selected-franchise-${movieId}`}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="max-w-full"
                  onClick={() => removeFranchiseMovieId(movieId)}
                  title={movieId}
                >
                  <span className="truncate">{movieId} x</span>
                </Button>
              ))}
            </div>
          ) : (
            <small className="text-xs text-muted-foreground">No linked movies selected yet.</small>
          )}

          {franchiseOptions.length === 0 ? (
            <small className="text-xs text-muted-foreground">No other movies available to link in this franchise.</small>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {visibleFranchiseOptions.map((movie) => {
                const isSelected = selectedFranchiseMovieIds.includes(movie.id)
                const optionLabel = getMovieOptionLabel(movie)

                return (
                  <Button
                    key={`${idPrefix}-franchise-option-${movie.id}`}
                    type="button"
                    variant={isSelected ? 'default' : 'outline'}
                    className="min-w-0 justify-start overflow-hidden text-left"
                    onClick={() => toggleFranchiseMovieId(movie.id)}
                    title={optionLabel}
                  >
                    <span className="w-full truncate">{optionLabel}</span>
                  </Button>
                )
              })}
            </div>
          )}

          {errors.franchise_movie_ids_csv ? (
            <small className="text-xs text-red-600">{errors.franchise_movie_ids_csv.message}</small>
          ) : (
            <small className="text-xs text-muted-foreground">Select existing movie IDs that belong to this franchise. Click a selected tag to remove it.</small>
          )}
        </div>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-actors_csv`}>Actors (comma-separated)</Label>
        <Input id={`${idPrefix}-actors_csv`} placeholder="Actor A, Actor B" {...register('actors_csv')} />
        {errors.actors_csv ? <small className="text-xs text-red-600">{errors.actors_csv.message}</small> : null}
      </div>

      <div className="grid gap-3 md:col-span-2">
        <Label>Genres</Label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {movieGenreOptions.map((genre) => {
            const isChecked = selectedGenres.includes(genre)
            const genreId = `${idPrefix}-genre-${genre.toLowerCase().replace(/\s+/g, '-')}`

            return (
              <label
                key={genre}
                htmlFor={genreId}
                className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <input
                  id={genreId}
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => toggleGenre(genre)}
                  className="h-4 w-4 rounded border-border"
                />
                {genre}
              </label>
            )
          })}
        </div>
        {selectedGenres.length > 0 ? (
          <p className="text-xs text-muted-foreground">Selected: {selectedGenres.join(', ')}</p>
        ) : (
          <p className="text-xs text-muted-foreground">Select one or more genres.</p>
        )}
        {errors.genres ? <small className="text-xs text-red-600">{errors.genres.message}</small> : null}
      </div>

      <div className="grid gap-2 md:col-span-2">
        <Label htmlFor={`${idPrefix}-youtube_trailer_link`}>YouTube trailer URL (optional)</Label>
        <Input
          id={`${idPrefix}-youtube_trailer_link`}
          placeholder="https://www.youtube.com/watch?v=..."
          {...register('youtube_trailer_link')}
        />
        {errors.youtube_trailer_link ? <small className="text-xs text-red-600">{errors.youtube_trailer_link.message}</small> : null}
      </div>

      <div className="grid gap-2 md:col-span-2">
        <Label>Audio types</Label>
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" value="dubbing" {...register('audio_types')} />
            dubbing
          </label>
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" value="subtitle" {...register('audio_types')} />
            subtitle
          </label>
        </div>
        {errors.audio_types ? <small className="text-xs text-red-600">{errors.audio_types.message}</small> : null}
      </div>

      <div className="grid gap-3 md:col-span-2">
        <div className="flex items-center justify-between">
          <Label>Stream connections</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              append({
                server_name: '',
                link: '',
                type: 'subtitle',
                status: 'live',
                metadata_json: '',
              })
            }
          >
            Add connection
          </Button>
        </div>

        {fields.length === 0 ? <p className="text-sm text-muted-foreground">No stream connections.</p> : null}

        {fields.map((field, index) => (
          <div key={field.id} className="space-y-3 rounded-md border border-border p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Connection {index + 1}</p>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => move(index, index - 1)}>
                  Up
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={index === fields.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  Down
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => openStreamPreview(index, field.id)}>
                  Preview
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => remove(index)}>
                  Remove
                </Button>
              </div>
            </div>

            {previewMessages[field.id] ? (
              <p className={previewMessages[field.id].kind === 'success' ? 'text-xs text-emerald-700' : 'text-xs text-red-600'}>
                {previewMessages[field.id].message}
              </p>
            ) : null}

            <div className="grid gap-3 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-stream-${index}-server_name`}>Server name</Label>
                <Input
                  id={`${idPrefix}-stream-${index}-server_name`}
                  placeholder="Server A"
                  {...register(`stream_connections.${index}.server_name`)}
                />
                {errors.stream_connections?.[index]?.server_name ? (
                  <small className="text-xs text-red-600">{errors.stream_connections[index]?.server_name?.message}</small>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-stream-${index}-link`}>Link</Label>
                <Input
                  id={`${idPrefix}-stream-${index}-link`}
                  placeholder="https://..."
                  {...register(`stream_connections.${index}.link`)}
                />
                {errors.stream_connections?.[index]?.link ? (
                  <small className="text-xs text-red-600">{errors.stream_connections[index]?.link?.message}</small>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-stream-${index}-type`}>Type</Label>
                <select
                  id={`${idPrefix}-stream-${index}-type`}
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register(`stream_connections.${index}.type`)}
                >
                  <option value="dubbing">dubbing</option>
                  <option value="subtitle">subtitle</option>
                </select>
                {errors.stream_connections?.[index]?.type ? (
                  <small className="text-xs text-red-600">{errors.stream_connections[index]?.type?.message}</small>
                ) : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor={`${idPrefix}-stream-${index}-status`}>Status</Label>
                <select
                  id={`${idPrefix}-stream-${index}-status`}
                  className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  {...register(`stream_connections.${index}.status`)}
                >
                  <option value="live">live</option>
                  <option value="dead">dead</option>
                </select>
                {errors.stream_connections?.[index]?.status ? (
                  <small className="text-xs text-red-600">{errors.stream_connections[index]?.status?.message}</small>
                ) : null}
              </div>

              <div className="grid gap-2 md:col-span-2">
                <Label htmlFor={`${idPrefix}-stream-${index}-metadata_json`}>Metadata (JSON object, optional)</Label>
                <textarea
                  id={`${idPrefix}-stream-${index}-metadata_json`}
                  className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder='{"resolution":"1080p"}'
                  {...register(`stream_connections.${index}.metadata_json`)}
                />
                {errors.stream_connections?.[index]?.metadata_json ? (
                  <small className="text-xs text-red-600">{errors.stream_connections[index]?.metadata_json?.message}</small>
                ) : null}
              </div>
            </div>
          </div>
        ))}

        {errors.stream_connections?.message ? (
          <small className="text-xs text-red-600">{errors.stream_connections.message}</small>
        ) : null}
      </div>

      {errors.root ? <small className="text-xs text-red-600 md:col-span-2">{errors.root.message}</small> : null}

      <div className="flex items-center gap-2 md:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>

      <HlsPreviewDialog
        open={Boolean(previewTarget)}
        title={previewTarget ? `Preview stream: ${previewTarget.serverName}` : 'Preview stream'}
        streamUrl={previewTarget?.streamUrl ?? ''}
        onResolved={applyPreviewResult}
        onClose={() => setPreviewTarget(null)}
      />
    </form>
  )
}
