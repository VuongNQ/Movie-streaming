const DEFAULT_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36',
}

function normalizeUrl(rawUrl, baseUrl) {
  try {
    return new URL(rawUrl, baseUrl).toString()
  } catch (_error) {
    return null
  }
}

function uniqueUrls(urls) {
  return Array.from(new Set(urls.filter((value) => typeof value === 'string' && value.length > 0)))
}

async function discoverViaDom(page, config, sourceUrl) {
  await page.goto(sourceUrl, { waitUntil: 'networkidle' })
  const links = await page.evaluate(
    function (selector, hrefAttribute) {
      const nodes = document.querySelectorAll(selector)
      const results = []

      for (const node of nodes) {
        if (!(node instanceof HTMLElement)) {
          continue
        }

        const rawHref = node.getAttribute(hrefAttribute) || node.getAttribute('href')
        if (rawHref && rawHref.trim().length > 0) {
          results.push(rawHref.trim())
        }
      }

      return results
    },
    config.listItemSelector,
    config.linkAttribute || 'href',
  )

  return uniqueUrls(links.map((rawUrl) => normalizeUrl(rawUrl, sourceUrl)))
}

async function discoverViaApi(page, config, sourceUrl) {
  const apiUrl = typeof config.listApi === 'function' ? config.listApi(sourceUrl) : config.listApi
  const response = await page.request.get(apiUrl, {
    headers: {
      ...DEFAULT_HEADERS,
      ...(config.apiHeaders ?? {}),
    },
  })

  if (!response.ok()) {
    throw new Error(`List API request failed for ${sourceUrl}: ${response.status()} ${response.statusText()}`)
  }

  const payload = await response.json()
  const links = config.mapListApiResponse(payload, sourceUrl)
  return uniqueUrls(links.map((rawUrl) => normalizeUrl(rawUrl, sourceUrl)))
}

function readMeta(content, selectors) {
  for (const selector of selectors) {
    const element = document.querySelector(selector)
    if (!(element instanceof HTMLElement)) {
      continue
    }

    const value = element.getAttribute('content') ?? element.textContent
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim()
    }
  }

  return content
}

function createDefaultDetailExtractor(config) {
  return async function extractDetails(page) {
    return page.evaluate((detailConfig) => {
      const text = (selectors) => {
        for (const selector of selectors) {
          const element = document.querySelector(selector)
          if (!(element instanceof HTMLElement)) {
            continue
          }

          const value = typeof element.textContent === 'string' ? element.textContent.trim() : ''
          if (value) {
            return value
          }
        }

        return ''
      }

      const attr = (selectors, attributeName) => {
        for (const selector of selectors) {
          const element = document.querySelector(selector)
          if (!(element instanceof HTMLElement)) {
            continue
          }

          const rawValue = element.getAttribute(attributeName)
          const value = typeof rawValue === 'string' ? rawValue.trim() : ''
          if (value) {
            return value
          }
        }

        return ''
      }

      const title = text(detailConfig.titleSelectors)
      const description = text(detailConfig.descriptionSelectors)
      const thumbnailLink = attr(detailConfig.thumbnailSelectors, 'src') || attr(detailConfig.thumbnailSelectors, 'content')
      const backgroundLink = attr(detailConfig.backgroundSelectors, 'src') || attr(detailConfig.backgroundSelectors, 'content')
      const yearText = text(detailConfig.yearSelectors)

      return {
        title_raw: title,
        description,
        thumbnail_link: thumbnailLink,
        background_link: backgroundLink,
        year: Number.parseInt(yearText, 10),
      }
    }, config)
  }
}

function defaultMapApiMetadata(payload) {
  const safePayload = payload && typeof payload === 'object' ? payload : {}
  const category = Array.isArray(safePayload.category) ? safePayload.category : []

  return {
    title_raw: safePayload.name || safePayload.title || '',
    title_vietnamese: safePayload.origin_name || safePayload.title_vietnamese || undefined,
    description: safePayload.content || safePayload.description || '',
    thumbnail_link: safePayload.thumb_url || safePayload.poster_url || '',
    background_link: safePayload.poster_url || safePayload.thumb_url || '',
    year: Number.parseInt(safePayload.year, 10),
    actors: Array.isArray(safePayload.actor) ? safePayload.actor : [],
    genres: category.map(function (entry) {
      return entry && typeof entry === 'object' ? entry.name : null
    }).filter(Boolean),
  }
}

export const siteAdapters = {
  'motphim.film': {
    key: 'motphim.film',
    serverName: 'motphim.film',
    listStrategy: 'api',
    listApi: (sourceUrl) => {
      const url = new URL(sourceUrl)
      const page = url.searchParams.get('page') || '1'
      return `https://motphim.film/api/films?page=${page}`
    },
    mapListApiResponse(payload) {
      const items = payload && Array.isArray(payload.items) ? payload.items : []
      return items.map(function (entry) {
        return entry && entry.slug ? `/phim/${entry.slug}` : null
      }).filter(Boolean)
    },
    watchButtonSelector: '.btn-watch,.watch-button,a[href*="xem-phim"]',
    linkAttribute: 'href',
    detailConfig: {
      titleSelectors: ['h1', '.movie-title', 'meta[property="og:title"]'],
      descriptionSelectors: ['.entry-content', '.description', 'meta[property="og:description"]'],
      thumbnailSelectors: ['.poster img', 'meta[property="og:image"]'],
      backgroundSelectors: ['.backdrop img', '.banner img', 'meta[property="og:image"]'],
      yearSelectors: ['.year', '.movie-year'],
    },
    extractDetails: null,
    detailApi: null,
    mapApiMetadata: defaultMapApiMetadata,
  },
  'tvhay.best': {
    key: 'tvhay.best',
    serverName: 'tvhay.best',
    listStrategy: 'dom',
    listItemSelector: 'a.poster, .movie-item a, .film-item a',
    linkAttribute: 'href',
    watchButtonSelector: '.btn-watch,.watch-button,a[href*="watch"],a[href*="xem"]',
    detailConfig: {
      titleSelectors: ['h1', '.entry-title', 'meta[property="og:title"]'],
      descriptionSelectors: ['.description', '.entry-content', 'meta[property="og:description"]'],
      thumbnailSelectors: ['.poster img', '.movie-thumb img', 'meta[property="og:image"]'],
      backgroundSelectors: ['.backdrop img', '.movie-banner img', 'meta[property="og:image"]'],
      yearSelectors: ['.year', '.info .year'],
    },
    extractDetails: null,
    detailApi: null,
    mapApiMetadata: defaultMapApiMetadata,
  },
}

for (const adapter of Object.values(siteAdapters)) {
  if (!adapter.extractDetails) {
    adapter.extractDetails = createDefaultDetailExtractor(adapter.detailConfig)
  }
}

export function resolveAdapter(siteKey) {
  const adapter = siteAdapters[siteKey]
  if (!adapter) {
    throw new Error(`Unsupported site adapter: ${siteKey}`)
  }

  return adapter
}

export async function discoverMovieLinks(page, adapter, sourceUrl) {
  if (adapter.listStrategy === 'api') {
    return discoverViaApi(page, adapter, sourceUrl)
  }

  return discoverViaDom(page, adapter, sourceUrl)
}

export function buildServerName(adapter, movieUrl) {
  try {
    const hostname = new URL(movieUrl).hostname.replace(/^www\./, '')
    return adapter.serverName || hostname
  } catch (_error) {
    return adapter.serverName || adapter.key
  }
}
