export type DisplayMode = 'latest' | 'history'

export interface PageMetadata {
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
}

export interface LinkMetadata {
  host: string
  path: string
  queryKeys: string[]
  resolution: string | null
  bandwidthKbps: number | null
  codec: string | null
}

export interface CapturedLink {
  trackingKey: string
  url: string
  tabUrl: string | null
  pageTitle: string | null
  pageMetadata: PageMetadata | null
  firstSeenAt: string
  detectedAt: string
  captureCount: number
  tabId: number
  contentType: string | null
  source: 'url' | 'content-type'
  linkMetadata: LinkMetadata
}

export interface ExtensionState {
  mode: DisplayMode
  latest: CapturedLink | null
  history: CapturedLink[]
  isCapturing: boolean
  activeTabId: number | null
}

export interface RuntimeResponse {
  ok: boolean
  state?: ExtensionState
  message?: string
}

// --- Movie list crawler types ---

export type CrawlStatus = 'idle' | 'running' | 'done' | 'stopped' | 'error'

export interface CrawledMovieEntry {
  /** Absolute movie page URL — used as IndexedDB primary key */
  url: string
  crawledAt: string
  sourceSearchUrl: string
  page: number
}

export interface MovieCrawlState {
  status: CrawlStatus
  searchUrl: string | null
  currentPage: number
  totalFound: number
  error: string | null
}

export interface CrawlRuntimeResponse {
  ok: boolean
  crawlState?: MovieCrawlState
  entries?: CrawledMovieEntry[]
  message?: string
}
