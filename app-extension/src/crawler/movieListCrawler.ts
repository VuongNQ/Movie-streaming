import type { MovieCrawlState } from '../types'

/**
 * Build the paginated URL for motphim.film search pages.
 *
 * Page 1: https://motphim.film/search?type=1&region=5&year=2018
 * Page N: https://motphim.film/search/N?type=1&region=5&year=2018
 */
export function buildPageUrl(searchUrl: string, page: number): string {
  const url = new URL(searchUrl)
  // Strip any existing numeric page segment (e.g. /search/3 → /search)
  const basePathMatch = url.pathname.match(/^(\/[^/]+)(\/\d+)?$/)
  const basePath = basePathMatch ? basePathMatch[1] : url.pathname

  if (page <= 1) {
    return `${url.origin}${basePath}?${url.searchParams.toString()}`
  }
  return `${url.origin}${basePath}/${page}?${url.searchParams.toString()}`
}

/**
 * Returns true when the URL looks like a motphim.film search listing page,
 * so the popup can warn the user if they paste a wrong URL.
 */
export function isMotphimSearchUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'motphim.film' && parsed.pathname.startsWith('/search')
  } catch {
    return false
  }
}

/** Initial / reset crawl state. */
export const defaultCrawlState: MovieCrawlState = {
  status: 'idle',
  searchUrl: null,
  currentPage: 0,
  totalFound: 0,
  error: null,
}

/**
 * DOM extraction function injected into a crawler tab via chrome.scripting.executeScript.
 * Collects all absolute movie page URLs that contain "/phim/" in their path.
 *
 * NOTE: This function is serialised and sent to the tab — it must be self-contained
 * (no closures over external variables).
 */
export function extractMovieLinksFromPage(): string[] {
  const seen = new Set<string>()
  const anchors = document.querySelectorAll<HTMLAnchorElement>('a[href*="/phim/"]')
  for (const anchor of anchors) {
    const href = anchor.href // already absolute via DOM
    if (href && href.startsWith('http')) {
      seen.add(href)
    }
  }
  return Array.from(seen)
}
