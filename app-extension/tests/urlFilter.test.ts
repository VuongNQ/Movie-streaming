import { describe, expect, it } from 'vitest'
import { buildLinkMetadata, detectM3u8, findPageParameterM3u8, isHttpScheme } from '../src/utils/urlFilter'

describe('isHttpScheme', () => {
  it('accepts http and https', () => {
    expect(isHttpScheme('https://example.com/live/master.m3u8')).toBe(true)
    expect(isHttpScheme('http://example.com/stream')).toBe(true)
  })

  it('rejects non-http schemes', () => {
    expect(isHttpScheme('chrome-extension://abcd/popup.html')).toBe(false)
    expect(isHttpScheme('file:///tmp/master.m3u8')).toBe(false)
  })
})

describe('detectM3u8', () => {
  it('matches by path', () => {
    const result = detectM3u8('https://cdn.example.com/video/master.m3u8')
    expect(result).toEqual({ matched: true, source: 'url' })
  })

  it('matches by query string', () => {
    const result = detectM3u8('https://cdn.example.com/video?playlist=master.m3u8')
    expect(result).toEqual({ matched: true, source: 'url' })
  })

  it('matches by content type fallback', () => {
    const result = detectM3u8('https://cdn.example.com/video/stream', 'application/vnd.apple.mpegurl; charset=utf-8')
    expect(result).toEqual({ matched: true, source: 'content-type' })
  })

  it('does not match unrelated responses', () => {
    const result = detectM3u8('https://cdn.example.com/video/file.mp4', 'video/mp4')
    expect(result).toEqual({ matched: false, source: null })
  })
})

describe('buildLinkMetadata', () => {
  it('extracts host, path and query keys', () => {
    const metadata = buildLinkMetadata('https://cdn.example.com/live/master.m3u8?token=abc&bw=2500')
    expect(metadata.host).toBe('cdn.example.com')
    expect(metadata.path).toBe('/live/master.m3u8')
    expect(metadata.queryKeys).toEqual(['token', 'bw'])
  })

  it('extracts resolution and bandwidth from url patterns', () => {
    const metadata = buildLinkMetadata('https://cdn.example.com/live/1080p/master.m3u8?bandwidth=4500000')
    expect(metadata.resolution).toBe('1080p')
    expect(metadata.bandwidthKbps).toBe(4500)
  })

  it('extracts codec hints from content type', () => {
    const metadata = buildLinkMetadata('https://cdn.example.com/live/master.m3u8', 'application/vnd.apple.mpegurl; codecs=avc1.4d401f')
    expect(metadata.codec).toBe('avc1.4d401f')
  })
})

describe('findPageParameterM3u8', () => {
  const signedUrl = 'https://cdn.example.com/live/master.m3u8?token=a%2Fb%2Bc%3D&expires=1900000000'

  it.each([signedUrl, encodeURIComponent(signedUrl)])('preserves the signed stream URL when nested in a player URL', (value) => {
    const page = new URL('https://example.com/player')
    page.searchParams.set('src', value)
    expect(findPageParameterM3u8(page.href)).toBe(signedUrl)
  })

  it('skips non-HTTP URLs and malformed parameters', () => {
    const page = 'https://example.com/player?src=file%3A%2F%2F%2Fstream.m3u8&url=%25E0%25A4%25A'
    expect(findPageParameterM3u8(page)).toBeNull()
  })
})
