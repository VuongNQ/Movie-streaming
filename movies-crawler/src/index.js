import './env.js'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { basename, extname, join } from 'node:path'
import { chromium } from 'playwright'
import { buildServerName, discoverMovieLinks, resolveAdapter } from './adapters.js'
import { upsertMovieStream } from './firestore.js'

const CONCURRENCY_LIMIT = 3
const M3U8_TIMEOUT_MS = 15000
const HEADLESS = process.env.CRAWLER_HEADLESS !== 'false'
const DRAFT_OUTPUT_DIR = process.env.CRAWLER_DRAFT_DIR || './crawl-drafts'

function parseArgs(argv) {
  return argv.reduce((result, entry) => {
    if (!entry.startsWith('--')) {
      return result
    }

    const [key, value] = entry.slice(2).split('=')
    result[key] = value ?? 'true'
    return result
  }, {})
}

async function readJsonArray(filePath) {
  const raw = await readFile(filePath, 'utf8')
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error(`${filePath} must contain a JSON array.`)
  }

  return parsed.filter((value) => typeof value === 'string' && value.trim().length > 0).map((value) => value.trim())
}

async function isDirectory(pathValue) {
  try {
    const pathStats = await stat(pathValue)
    return pathStats.isDirectory()
  } catch (_error) {
    return false
  }
}

async function resolveInputJobs(inputPath, siteOverride) {
  const inputIsDirectory = await isDirectory(inputPath)
  if (!inputIsDirectory) {
    if (!siteOverride) {
      throw new Error('Missing required --site=<domain> argument when --input points to a file.')
    }

    return [{
      site: siteOverride,
      sourcePath: inputPath,
      inputValues: await readJsonArray(inputPath),
    }]
  }

  const entries = await readdir(inputPath, { withFileTypes: true })
  const jsonFiles = entries
    .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === '.json')
    .map((entry) => ({
      fileName: entry.name,
      filePath: join(inputPath, entry.name),
      domain: basename(entry.name, '.json'),
    }))

  if (jsonFiles.length === 0) {
    throw new Error(`No .json input files found in directory: ${inputPath}`)
  }

  const filteredFiles = siteOverride
    ? jsonFiles.filter((entry) => entry.domain === siteOverride)
    : jsonFiles

  if (filteredFiles.length === 0) {
    throw new Error(`No input file matching domain ${siteOverride} found in ${inputPath}`)
  }

  const jobs = []
  for (const fileEntry of filteredFiles) {
    resolveAdapter(fileEntry.domain)
    jobs.push({
      site: fileEntry.domain,
      sourcePath: fileEntry.filePath,
      inputValues: await readJsonArray(fileEntry.filePath),
    })
  }

  return jobs
}

function normalizeMetadata(scraped, fallbackTitle) {
  const titleRaw = typeof scraped.title_raw === 'string' && scraped.title_raw.trim().length > 0
    ? scraped.title_raw.trim()
    : fallbackTitle

  return {
    title_raw: titleRaw,
    title_vietnamese: typeof scraped.title_vietnamese === 'string' ? scraped.title_vietnamese.trim() : undefined,
    description: typeof scraped.description === 'string' ? scraped.description.trim() : '',
    thumbnail_link: typeof scraped.thumbnail_link === 'string' ? scraped.thumbnail_link.trim() : '',
    background_link: typeof scraped.background_link === 'string' ? scraped.background_link.trim() : '',
    type: scraped.type,
    year: Number.isInteger(scraped.year) ? scraped.year : undefined,
    episode_count: Number.isInteger(scraped.episode_count) ? scraped.episode_count : undefined,
    actors: Array.isArray(scraped.actors) ? scraped.actors : [],
    audio_types: Array.isArray(scraped.audio_types) ? scraped.audio_types : ['subtitle'],
    genres: Array.isArray(scraped.genres) ? scraped.genres : [],
    youtube_trailer_link: typeof scraped.youtube_trailer_link === 'string' ? scraped.youtube_trailer_link.trim() : undefined,
    franchise_movie_ids: Array.isArray(scraped.franchise_movie_ids) ? scraped.franchise_movie_ids : [],
  }
}

function sanitizeFileName(value) {
  return String(value || 'movie')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'movie'
}

async function saveDraftCrawlData({ movieUrl, movie, streamConnection, error }) {
  await mkdir(DRAFT_OUTPUT_DIR, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const baseName = sanitizeFileName(movie.id || movie.title_raw || movieUrl)
  const draftPath = join(DRAFT_OUTPUT_DIR, `${baseName}-${timestamp}.json`)

  const payload = {
    source_url: movieUrl,
    movie,
    stream_connection: streamConnection,
    error: {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack ?? null : null,
    },
    saved_at: new Date().toISOString(),
  }

  await writeFile(draftPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  return draftPath
}

async function maybeFetchApiMetadata(page, adapter, movieUrl) {
  if (!adapter.detailApi || typeof adapter.mapApiMetadata !== 'function') {
    return {}
  }

  const apiUrl = typeof adapter.detailApi === 'function' ? adapter.detailApi(movieUrl) : adapter.detailApi
  const response = await page.request.get(apiUrl)
  if (!response.ok()) {
    return {}
  }

  return adapter.mapApiMetadata(await response.json(), movieUrl) ?? {}
}

async function waitForM3u8(page) {
  return new Promise((resolve) => {
    let settled = false
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true
        resolve(null)
      }
    }, M3U8_TIMEOUT_MS)

    const onResponse = (response) => {
      const responseUrl = response.url()
      if (settled || !responseUrl.toLowerCase().includes('.m3u8')) {
        return
      }

      settled = true
      clearTimeout(timer)
      page.off('response', onResponse)
      resolve(responseUrl)
    }

    page.on('response', onResponse)
  })
}

async function verifyCors(page, streamUrl) {
  if (!streamUrl) {
    return { accessible: false, blockedByCors: false, status: null, error: 'missing-stream' }
  }

  return page.evaluate(async (url) => {
    try {
      const response = await fetch(url, { method: 'HEAD', mode: 'cors' })
      return {
        accessible: true,
        blockedByCors: false,
        status: response.status,
        error: null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        accessible: false,
        blockedByCors: message.includes('Failed to fetch'),
        status: null,
        error: message,
      }
    }
  }, streamUrl)
}

async function findWatchRedirectUrl(page, adapter) {
  const selectors = Array.isArray(adapter.watchRedirectSelectors) ? adapter.watchRedirectSelectors : []
  const textHints = Array.isArray(adapter.watchRedirectTextHints) ? adapter.watchRedirectTextHints : []

  if (selectors.length === 0 && textHints.length === 0) {
    return null
  }

  return page.evaluate(({ redirectSelectors, redirectTextHints }) => {
    const toAbsoluteUrl = (href) => {
      try {
        return new URL(href, window.location.href).toString()
      } catch (_error) {
        return null
      }
    }

    const hints = redirectTextHints.map((value) => value.toLowerCase())
    const candidates = []
    const seen = new Set()

    for (const selector of redirectSelectors) {
      const nodes = document.querySelectorAll(selector)
      for (const node of nodes) {
        if (!(node instanceof HTMLAnchorElement)) {
          continue
        }

        if (seen.has(node)) {
          continue
        }

        seen.add(node)
        candidates.push(node)
      }
    }

    if (candidates.length === 0) {
      const allAnchors = document.querySelectorAll('a[href]')
      for (const anchor of allAnchors) {
        if (!(anchor instanceof HTMLAnchorElement)) {
          continue
        }

        if (!seen.has(anchor)) {
          seen.add(anchor)
          candidates.push(anchor)
        }
      }
    }

    for (const anchor of candidates) {
      const href = anchor.getAttribute('href')
      if (!href || href.trim().length === 0) {
        continue
      }

      const hrefLower = href.trim().toLowerCase()
      const text = typeof anchor.textContent === 'string' ? anchor.textContent.trim().toLowerCase() : ''
      const absoluteUrl = toAbsoluteUrl(href.trim())
      if (!absoluteUrl) {
        continue
      }

      if (
        hrefLower.includes('/tap-')
        || hrefLower.includes('/xem-phim')
        || hints.some((hint) => text.includes(hint))
      ) {
        return absoluteUrl
      }
    }

    return null
  }, {
    redirectSelectors: selectors,
    redirectTextHints: textHints,
  })
}

async function crawlMovie(browser, adapter, movieUrl) {
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto(movieUrl, { waitUntil: 'networkidle' })

    const apiMetadata = await maybeFetchApiMetadata(page, adapter, movieUrl)
    const domMetadata = await adapter.extractDetails(page)
    const titleFallback = new URL(movieUrl).pathname.split('/').filter(Boolean).pop()?.replace(/[-_]+/g, ' ') ?? 'Untitled movie'
    const movie = normalizeMetadata({
      ...domMetadata,
      ...apiMetadata,
    }, titleFallback)

    const waitForM3u8Promise = waitForM3u8(page)
    const watchRedirectUrl = await findWatchRedirectUrl(page, adapter)
    if (watchRedirectUrl) {
      await Promise.all([waitForM3u8Promise, page.goto(watchRedirectUrl, { waitUntil: 'networkidle' })])
      await page.waitForLoadState('networkidle').catch(() => undefined)
    } else {
      const watchButton = page.locator(adapter.watchButtonSelector).first()
      if ((await watchButton.count()) > 0) {
        await Promise.all([waitForM3u8Promise, watchButton.click()])
        await page.waitForLoadState('networkidle').catch(() => undefined)
      }
    }

    if (watchRedirectUrl) {
      await page.waitForTimeout(1000).catch(() => undefined)
    } else {
      const watchButton = page.locator(adapter.watchButtonSelector).first()
      if ((await watchButton.count()) > 0) {
        await page.waitForTimeout(1000).catch(() => undefined)
      }
    }

    const streamUrl = await waitForM3u8Promise
    if (!streamUrl) {
      if (watchRedirectUrl) {
        console.warn(`[crawler] No .m3u8 captured after redirect for ${movieUrl} -> ${watchRedirectUrl}`)
      } else {
        console.warn(`[crawler] No .m3u8 captured for ${movieUrl}`)
      }
    }

    const corsResult = await verifyCors(page, streamUrl)
    const serverName = buildServerName(adapter, movieUrl)
    const streamConnection = streamUrl
      ? {
          server_name: serverName,
          link: streamUrl,
          type: Array.isArray(movie.audio_types) && movie.audio_types.includes('dubbing') ? 'dubbing' : 'subtitle',
          status: corsResult.blockedByCors ? 'dead' : 'live',
          metadata: {
            source_page: movieUrl,
            watch_page: watchRedirectUrl || page.url(),
            cors_status: corsResult.status,
            cors_error: corsResult.error,
            cors_blocked: corsResult.blockedByCors,
          },
        }
      : {
          server_name: serverName,
          link: '',
          type: Array.isArray(movie.audio_types) && movie.audio_types.includes('dubbing') ? 'dubbing' : 'subtitle',
          status: 'dead',
          metadata: {
            source_page: movieUrl,
            watch_page: watchRedirectUrl || page.url(),
            cors_status: null,
            cors_error: 'm3u8-not-found',
            cors_blocked: false,
          },
        }

    let writeResult
    try {
      writeResult = await upsertMovieStream(movie, streamConnection)
    } catch (error) {
      const draftPath = await saveDraftCrawlData({ movieUrl, movie, streamConnection, error })
      console.warn(`[crawler] Firestore write failed for ${movieUrl}; draft saved to ${draftPath}`)
      return {
        movieUrl,
        writeResult: null,
        draftPath,
        streamUrl,
      }
    }

    return {
      movieUrl,
      writeResult,
      streamUrl,
    }
  } finally {
    await page.close().catch(() => undefined)
    await context.close().catch(() => undefined)
  }
}

async function runWithConcurrency(items, concurrencyLimit, worker) {
  const queue = [...items]
  const results = []

  const workers = Array.from({ length: Math.min(concurrencyLimit, queue.length) }, async () => {
    while (queue.length > 0) {
      const nextItem = queue.shift()
      if (!nextItem) {
        return
      }

      try {
        results.push(await worker(nextItem))
      } catch (error) {
        console.error(`[crawler] Failed to process ${nextItem}:`, error)
      }
    }
  })

  await Promise.all(workers)
  return results
}

async function resolveMovieUrls(browser, adapter, inputMode, inputValues) {
  if (inputMode === 'direct') {
    return inputValues
  }

  const page = await browser.newPage()
  try {
    const discoveredLists = await Promise.all(inputValues.map((sourceUrl) => discoverMovieLinks(page, adapter, sourceUrl)))
    return Array.from(new Set(discoveredLists.flat()))
  } finally {
    await page.close().catch(() => undefined)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const site = args.site
  const inputMode = args['input-mode'] ?? 'direct'
  const inputPath = args.input ?? (site ? (inputMode === 'direct' ? './movies.json' : './pages.json') : './domains')

  if (inputMode !== 'direct' && inputMode !== 'discovery') {
    throw new Error('input mode must be direct or discovery.')
  }

  const crawlJobs = await resolveInputJobs(inputPath, site)
  const browser = await chromium.launch({ headless: HEADLESS })

  try {
    let totalCompletedTasks = 0

    for (const job of crawlJobs) {
      try {
        const adapter = resolveAdapter(job.site)
        const movieUrls = await resolveMovieUrls(browser, adapter, inputMode, job.inputValues)
        console.log(`[crawler] Resolved ${movieUrls.length} movie URLs for ${job.site} (${job.sourcePath})`)

        const results = await runWithConcurrency(movieUrls, CONCURRENCY_LIMIT, (movieUrl) =>
          crawlMovie(browser, adapter, movieUrl),
        )

        totalCompletedTasks += results.length
        console.log(`[crawler] Completed ${results.length} crawl tasks for ${job.site}.`)
      } catch (error) {
        console.error(`[crawler] Domain job failed for ${job.site} (${job.sourcePath}):`, error)
      }
    }

    console.log(`[crawler] Finished ${crawlJobs.length} domain job(s) with ${totalCompletedTasks} completed crawl task(s).`)
  } finally {
    await browser.close().catch(() => undefined)
  }
}

main().catch((error) => {
  console.error('[crawler] Fatal error:', error)
  process.exitCode = 1
})
