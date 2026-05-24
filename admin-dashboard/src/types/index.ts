export type UserRole = 'guest' | 'user' | 'admin'

export type MovieType = 'single_movie' | 'tv_series' | 'franchise'

export type AudioType = 'dubbing' | 'subtitle'

export type StreamStatus = 'live' | 'dead'

export type ReportType = 'broken_image' | 'broken_stream'

export type ReportIssueField = 'thumbnail_link' | 'background_link' | 'stream_link'

export type ReportStatus = 'open' | 'in_progress' | 'resolved'

export interface StreamConnection {
  server_name: string
  link: string
  type: AudioType
  status: StreamStatus
  metadata?: Record<string, unknown>
}

export interface Movie {
  id: string
  // Legacy mirror for old clients/documents. New writes should use title_raw.
  title?: string
  title_raw: string
  title_vietnamese?: string
  title_search_keywords?: string[]
  title_vietnamese_search_keywords?: string[]
  description: string
  thumbnail_link: string
  background_link: string
  type: MovieType
  year: number
  episode_count: number
  actors: string[]
  audio_types: AudioType[]
  genres: string[]
  franchise_movie_ids?: string[]
  stream_connections: StreamConnection[]
  created_at?: string
  last_updated?: string
  youtube_trailer_link?: string
}

export type MovieInput = Omit<Movie, 'id'>

export interface MovieSearchFilters {
  title: string
  genres: string[]
  year?: number
}

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

export interface Report {
  id: string
  movie_id: string
  movie_title_raw: string
  report_type: ReportType
  issue_field: ReportIssueField
  issue_link: string
  status: ReportStatus
  reported_by_uid: string
  note?: string
  admin_note?: string
  preview_status?: StreamStatus
  preview_error_message?: string
  preview_metadata?: Record<string, unknown>
  created_at: string
  updated_at: string
  resolved_at?: string
}

export type ReportCreateInput = Pick<
  Report,
  | 'movie_id'
  | 'movie_title_raw'
  | 'report_type'
  | 'issue_field'
  | 'issue_link'
  | 'note'
  | 'preview_status'
  | 'preview_error_message'
  | 'preview_metadata'
>

export interface ReportsQueryFilters {
  status?: ReportStatus
  report_type?: ReportType
  movie_id?: string
}

export interface ReportStatusUpdateInput {
  id: string
  status: ReportStatus
  admin_note?: string
}

export interface AuthPreflightDiagnostic {
  uid: string
  user_doc_exists: boolean
  role_in_user_doc: string | null
  is_admin_by_user_doc: boolean
}
