interface MatchResult {
  matched: boolean
  source: 'url' | 'content-type' | null
}

interface ParsedCodec {
  codec: string | null
}

export interface DerivedLinkMetadata {
  host: string
  path: string
  queryKeys: string[]
  resolution: string | null
  bandwidthKbps: number | null
  codec: string | null
}

const HLS_CONTENT_TYPES = new Set([
  'application/vnd.apple.mpegurl',
  'application/x-mpegurl',
])

export function isHttpScheme(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function detectM3u8(rawUrl: string, contentType?: string | null): MatchResult {
  if (!isHttpScheme(rawUrl)) {
    return { matched: false, source: null }
  }

  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { matched: false, source: null }
  }

  const lowerPath = parsed.pathname.toLowerCase()
  const lowerQuery = parsed.search.toLowerCase()
  if (lowerPath.includes('.m3u8') || lowerQuery.includes('.m3u8')) {
    return { matched: true, source: 'url' }
  }

  if (contentType) {
    const normalized = contentType.toLowerCase().split(';')[0].trim()
    if (HLS_CONTENT_TYPES.has(normalized)) {
      return { matched: true, source: 'content-type' }
    }
  }

  return { matched: false, source: null }
}

function extractResolution(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl)
    const query = parsed.search.toLowerCase()
    const queryResolution = query.match(/(?:res|resolution|quality)=([0-9]{3,4}p)/)
    if (queryResolution?.[1]) {
      return queryResolution[1]
    }

    const pathResolution = parsed.pathname.toLowerCase().match(/([0-9]{3,4})p/)
    if (pathResolution?.[1]) {
      return `${pathResolution[1]}p`
    }

    return null
  } catch {
    return null
  }
}

function extractBandwidthKbps(rawUrl: string): number | null {
  try {
    const parsed = new URL(rawUrl)
    const params = parsed.searchParams
    const raw = params.get('bandwidth') ?? params.get('bw') ?? params.get('br')
    if (!raw) {
      return null
    }

    const numeric = Number.parseInt(raw, 10)
    if (Number.isNaN(numeric) || numeric <= 0) {
      return null
    }

    return numeric >= 1000 ? Math.round(numeric / 1000) : numeric
  } catch {
    return null
  }
}

function extractCodec(contentType?: string | null): ParsedCodec {
  if (!contentType) {
    return { codec: null }
  }

  const codecMatch = contentType.match(/codecs?=([^;]+)/i)
  return {
    codec: codecMatch?.[1]?.trim() ?? null,
  }
}

export function buildLinkMetadata(rawUrl: string, contentType?: string | null): DerivedLinkMetadata {
  let host = 'unknown'
  let path = '/'
  let queryKeys: string[] = []

  try {
    const parsed = new URL(rawUrl)
    host = parsed.host
    path = parsed.pathname
    queryKeys = [...parsed.searchParams.keys()]
  } catch {
    // Keep fallback metadata when URL parsing fails.
  }

  return {
    host,
    path,
    queryKeys,
    resolution: extractResolution(rawUrl),
    bandwidthKbps: extractBandwidthKbps(rawUrl),
    codec: extractCodec(contentType).codec,
  }
}
