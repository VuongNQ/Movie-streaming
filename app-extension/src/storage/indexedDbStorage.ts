import type { CrawledMovieEntry } from '../types'

/**
 * Storage key used in chrome.storage.local.
 * Value is a Record<url, CrawledMovieEntry> for O(1) upsert by URL.
 */
const STORAGE_KEY = 'crawled_movies_v1'

type CrawledMoviesMap = Record<string, CrawledMovieEntry>

async function readMap(): Promise<CrawledMoviesMap> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  return (result[STORAGE_KEY] as CrawledMoviesMap | undefined) ?? {}
}

async function writeMap(map: CrawledMoviesMap): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: map })
}

/** Upsert crawled movie entries into extension storage (keyed by `url`). */
export async function saveCrawledMovies(entries: CrawledMovieEntry[]): Promise<void> {
  if (entries.length === 0) return
  const map = await readMap()
  for (const entry of entries) {
    map[entry.url] = entry
  }
  await writeMap(map)
}

/** Read all crawled movies, optionally filtered by source search URL. */
export async function getCrawledMovies(sourceSearchUrl?: string): Promise<CrawledMovieEntry[]> {
  const map = await readMap()
  const all = Object.values(map)
  if (!sourceSearchUrl) return all
  return all.filter((e) => e.sourceSearchUrl === sourceSearchUrl)
}

/** Count crawled movies, optionally filtered by source search URL. */
export async function countCrawledMovies(sourceSearchUrl?: string): Promise<number> {
  const entries = await getCrawledMovies(sourceSearchUrl)
  return entries.length
}

/** Delete crawled movies, optionally scoped to a source search URL. */
export async function clearCrawledMovies(sourceSearchUrl?: string): Promise<void> {
  if (!sourceSearchUrl) {
    await chrome.storage.local.remove(STORAGE_KEY)
    return
  }
  const map = await readMap()
  for (const url of Object.keys(map)) {
    if (map[url].sourceSearchUrl === sourceSearchUrl) {
      delete map[url]
    }
  }
  await writeMap(map)
}
