import { zodResolver } from '@hookform/resolvers/zod'
import { useFieldArray, useForm } from 'react-hook-form'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { movieFormSchema, type MovieFormInput, type MovieFormValues } from '../../lib/movieForm'

interface MovieDetailsFormProps {
  idPrefix: string
  initialValues: MovieFormInput
  submitLabel: string
  isSubmitting: boolean
  onSubmit: (values: MovieFormValues) => Promise<void>
  onCancel?: () => void
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Unable to save movie details.'
}

export function MovieDetailsForm({
  idPrefix,
  initialValues,
  submitLabel,
  isSubmitting,
  onSubmit,
  onCancel,
}: MovieDetailsFormProps) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<MovieFormInput, undefined, MovieFormValues>({
    resolver: zodResolver(movieFormSchema),
    defaultValues: initialValues,
    reValidateMode: 'onChange',
  })
  const { fields, append, remove, move } = useFieldArray({
    control,
    name: 'stream_connections',
  })

  async function handleFormSubmit(values: MovieFormValues) {
    try {
      await onSubmit(values)
    } catch (error) {
      setError('root', { message: getErrorMessage(error) })
    }
  }

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(handleFormSubmit)}>
      <div className="grid gap-2 md:col-span-2">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input id={`${idPrefix}-title`} placeholder="Movie title" {...register('title')} />
        {errors.title ? <small className="text-xs text-red-600">{errors.title.message}</small> : null}
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

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-actors_csv`}>Actors (comma-separated)</Label>
        <Input id={`${idPrefix}-actors_csv`} placeholder="Actor A, Actor B" {...register('actors_csv')} />
        {errors.actors_csv ? <small className="text-xs text-red-600">{errors.actors_csv.message}</small> : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor={`${idPrefix}-genres_csv`}>Genres (comma-separated)</Label>
        <Input id={`${idPrefix}-genres_csv`} placeholder="Action, Drama" {...register('genres_csv')} />
        {errors.genres_csv ? <small className="text-xs text-red-600">{errors.genres_csv.message}</small> : null}
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
                <Button type="button" variant="outline" size="sm" onClick={() => remove(index)}>
                  Remove
                </Button>
              </div>
            </div>

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
    </form>
  )
}
