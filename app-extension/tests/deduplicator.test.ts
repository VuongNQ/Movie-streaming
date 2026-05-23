import { describe, expect, it } from 'vitest'
import { buildTrackingKey, upsertTrackedLink } from '../src/utils/deduplicator'
import type { CapturedLink } from '../src/types'

function makeLink(url: string, tabUrl: string, secondsOffset: number): CapturedLink {
  return {
    trackingKey: buildTrackingKey(url, tabUrl),
    url,
    tabUrl,
    pageTitle: 'Sample page',
    pageMetadata: null,
    firstSeenAt: new Date(2026, 0, 1, 10, 0, secondsOffset).toISOString(),
    detectedAt: new Date(2026, 0, 1, 10, 0, secondsOffset).toISOString(),
    captureCount: 1,
    tabId: 10,
    contentType: 'application/vnd.apple.mpegurl',
    source: 'url',
    linkMetadata: {
      host: 'a.com',
      path: '/master.m3u8',
      queryKeys: [],
      resolution: null,
      bandwidthKbps: null,
      codec: null,
    },
  }
}

describe('upsertTrackedLink', () => {
  it('adds new links to the front', () => {
    const history = [makeLink('https://a.com/1.m3u8', 'https://page-1.com', 1)]
    const next = upsertTrackedLink(history, makeLink('https://a.com/2.m3u8', 'https://page-1.com', 2), 5)

    expect(next.map((item) => item.url)).toEqual(['https://a.com/2.m3u8', 'https://a.com/1.m3u8'])
  })

  it('increments count for same page+url tracking key', () => {
    const history = [
      makeLink('https://a.com/1.m3u8', 'https://page-1.com', 1),
      makeLink('https://a.com/2.m3u8', 'https://page-1.com', 2),
    ]

    const next = upsertTrackedLink(history, makeLink('https://a.com/1.m3u8', 'https://page-1.com', 3), 5)
    expect(next.map((item) => item.url)).toEqual(['https://a.com/1.m3u8', 'https://a.com/2.m3u8'])
    expect(next[0]?.captureCount).toBe(2)
    expect(next[0]?.firstSeenAt).toBe(history[0]?.firstSeenAt)
  })

  it('treats same url on different pages as separate entries', () => {
    const history = [makeLink('https://a.com/shared.m3u8', 'https://page-1.com', 1)]
    const next = upsertTrackedLink(history, makeLink('https://a.com/shared.m3u8', 'https://page-2.com', 2), 5)
    expect(next).toHaveLength(2)
    expect(next[0]?.trackingKey).not.toEqual(next[1]?.trackingKey)
  })

  it('enforces max size', () => {
    const history = [
      makeLink('https://a.com/1.m3u8', 'https://page-1.com', 1),
      makeLink('https://a.com/2.m3u8', 'https://page-1.com', 2),
      makeLink('https://a.com/3.m3u8', 'https://page-1.com', 3),
    ]

    const next = upsertTrackedLink(history, makeLink('https://a.com/4.m3u8', 'https://page-1.com', 4), 3)
    expect(next.map((item) => item.url)).toEqual([
      'https://a.com/4.m3u8',
      'https://a.com/1.m3u8',
      'https://a.com/2.m3u8',
    ])
  })
})
