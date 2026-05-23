import type { CapturedLink } from '../types'

export function buildTrackingKey(url: string, tabUrl: string | null): string {
  return `${tabUrl ?? 'unknown-page'}::${url}`
}

export function upsertTrackedLink(history: CapturedLink[], incoming: CapturedLink, maxSize: number): CapturedLink[] {
  const existingIndex = history.findIndex((item) => item.trackingKey === incoming.trackingKey)
  if (existingIndex === -1) {
    return [incoming, ...history].slice(0, maxSize)
  }

  const existing = history[existingIndex]
  if (!existing) {
    return [incoming, ...history].slice(0, maxSize)
  }

  const merged: CapturedLink = {
    ...existing,
    ...incoming,
    firstSeenAt: existing.firstSeenAt,
    captureCount: existing.captureCount + 1,
    pageMetadata: existing.pageMetadata ?? incoming.pageMetadata,
    pageTitle: existing.pageTitle ?? incoming.pageTitle,
  }

  const remaining = history.filter((_, index) => index !== existingIndex)
  return [merged, ...remaining].slice(0, maxSize)
}
