export type UserRole = 'guest' | 'user' | 'admin'

export type MovieType = 'single_movie' | 'tv_series' | 'franchise'

export type AudioType = 'dubbing' | 'subtitle'

export type StreamStatus = 'live' | 'dead'

export interface StreamConnection {
  server_name: string
  link: string
  type: AudioType
  status: StreamStatus
  metadata?: Record<string, unknown>
}

export interface Movie {
  id: string
  title: string
  description: string
  thumbnail_link: string
  background_link: string
  type: MovieType
  year: number
  episode_count: number
  actors: string[]
  audio_types: AudioType[]
  genres: string[]
  stream_connections: StreamConnection[]
  youtube_trailer_link?: string
}

export type MovieInput = Omit<Movie, 'id'>

export interface User {
  uid: string
  username: string
  role: UserRole
  created_at: string
}

export type UserInput = Omit<User, 'uid' | 'created_at'>

export interface DeviceTrackingHistory {
  movie_id: string
  last_watched_at: string
  current_position_seconds: number
}

export interface Device {
  id: string
  device_name: string
  playlist: string[]
  tracking_history: DeviceTrackingHistory[]
}

export type DeviceInput = Omit<Device, 'id'>
