import { z } from 'zod'
import type { Movie, MovieInput } from '../types'

const movieTypeSchema = z.enum(['single_movie', 'tv_series', 'franchise'])
const audioTypeSchema = z.enum(['dubbing', 'subtitle'])
const streamStatusSchema = z.enum(['live', 'dead'])

const streamConnectionSchema = z.object({
  server_name: z.string().trim().min(1, 'Stream server name is required.'),
  link: z.url('Stream link must be a valid URL.'),
  type: audioTypeSchema,
  status: streamStatusSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
})

const streamConnectionFormSchema = z.object({
  server_name: z.string().trim().min(1, 'Stream server name is required.'),
  link: z.url('Stream link must be a valid URL.'),
  type: audioTypeSchema,
  status: streamStatusSchema,
  metadata_json: z.string().default(''),
})

function parseCommaList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function parseJsonObject(value: string) {
  const normalized = value.trim()
  if (normalized.length === 0) {
    return { ok: true as const, data: undefined }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(normalized)
  } catch {
    return { ok: false as const, message: 'Metadata must be valid JSON.' }
  }

  const validation = z.record(z.string(), z.unknown()).safeParse(parsed)
  if (!validation.success) {
    return { ok: false as const, message: 'Metadata must be a JSON object.' }
  }

  return { ok: true as const, data: validation.data }
}

export const movieFormSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required.'),
    description: z.string().trim().min(1, 'Description is required.'),
    thumbnail_link: z.url('Thumbnail URL is invalid.'),
    background_link: z.url('Background URL is invalid.'),
    type: movieTypeSchema,
    year: z.coerce.number().int('Year must be an integer.').min(1888, 'Year is invalid.').max(3000, 'Year is invalid.'),
    episode_count: z.coerce.number().int('Episode count must be an integer.').min(1, 'Episode count must be at least 1.'),
    actors_csv: z.string().default(''),
    genres_csv: z.string().default(''),
    audio_types: z.array(audioTypeSchema).default([]),
    youtube_trailer_link: z.string().trim().default(''),
    stream_connections: z.array(streamConnectionFormSchema).default([]),
  })
  .superRefine((value, ctx) => {
    if (value.youtube_trailer_link.length > 0) {
      const trailerValidation = z.url().safeParse(value.youtube_trailer_link)
      if (!trailerValidation.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['youtube_trailer_link'],
          message: 'YouTube trailer URL is invalid.',
        })
      }
    }

    value.stream_connections.forEach((connection, index) => {
      const metadataValidation = parseJsonObject(connection.metadata_json)
      if (!metadataValidation.ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['stream_connections', index, 'metadata_json'],
          message: metadataValidation.message,
        })
      }
    })
  })
  .transform((value): MovieInput => {
    const streamConnections = value.stream_connections.map((connection) => {
      const metadata = parseJsonObject(connection.metadata_json)
      return metadata.ok && metadata.data
        ? {
            server_name: connection.server_name,
            link: connection.link,
            type: connection.type,
            status: connection.status,
            metadata: metadata.data,
          }
        : {
            server_name: connection.server_name,
            link: connection.link,
            type: connection.type,
            status: connection.status,
          }
    })
    const validStreamConnections = streamConnectionSchema.array().parse(streamConnections)

    const payload: MovieInput = {
      title: value.title,
      description: value.description,
      thumbnail_link: value.thumbnail_link,
      background_link: value.background_link,
      type: value.type,
      year: value.year,
      episode_count: value.episode_count,
      actors: parseCommaList(value.actors_csv),
      audio_types: value.audio_types,
      genres: parseCommaList(value.genres_csv),
      stream_connections: validStreamConnections,
    }

    if (value.youtube_trailer_link.length > 0) {
      payload.youtube_trailer_link = value.youtube_trailer_link
    }

    return payload
  })
export type MovieFormInput = z.input<typeof movieFormSchema>
export type MovieFormValues = z.output<typeof movieFormSchema>

export function movieToFormInput(movie: Movie): MovieFormInput {
  return {
    title: movie.title,
    description: movie.description,
    thumbnail_link: movie.thumbnail_link,
    background_link: movie.background_link,
    type: movie.type,
    year: movie.year,
    episode_count: movie.episode_count,
    actors_csv: movie.actors.join(', '),
    genres_csv: movie.genres.join(', '),
    audio_types: movie.audio_types,
    youtube_trailer_link: movie.youtube_trailer_link ?? '',
    stream_connections: movie.stream_connections.map((connection) => ({
      server_name: connection.server_name,
      link: connection.link,
      type: connection.type,
      status: connection.status,
      metadata_json: connection.metadata ? JSON.stringify(connection.metadata, null, 2) : '',
    })),
  }
}

export function emptyMovieFormInput(): MovieFormInput {
  return {
    title: '',
    description: '',
    thumbnail_link: '',
    background_link: '',
    type: 'single_movie',
    year: new Date().getFullYear(),
    episode_count: 1,
    actors_csv: '',
    genres_csv: '',
    audio_types: [],
    youtube_trailer_link: '',
    stream_connections: [],
  }
}
