import type {
  CapturedLink,
  CrawlRuntimeResponse,
  CrawledMovieEntry,
  DisplayMode,
  ExtensionState,
  MovieCrawlState,
  PageMetadata,
  RuntimeResponse,
} from "../types";
import {
  appendCapturedLink,
  getState,
  setCaptureSession,
  setMode,
} from "../storage/extensionStorage";
import {
  clearCrawledMovies,
  getCrawledMovies,
  saveCrawledMovies,
} from "../storage/indexedDbStorage";
import {
  buildPageUrl,
  defaultCrawlState,
  extractMovieLinksFromPage,
} from "../crawler/movieListCrawler";
import { buildTrackingKey } from "../utils/deduplicator";
import {
  buildLinkMetadata,
  detectM3u8,
  findPageParameterM3u8,
} from "../utils/urlFilter";

type CaptureRequest =
  | { type: "GET_STATE" }
  | { type: "START_CAPTURE" }
  | { type: "STOP_CAPTURE" }
  | { type: "SET_MODE"; mode: DisplayMode }
  | { type: "START_MOVIE_CRAWL"; searchUrl: string }
  | { type: "STOP_MOVIE_CRAWL" }
  | { type: "GET_CRAWL_STATE" }
  | { type: "GET_CRAWL_RESULTS"; searchUrl?: string }
  | { type: "CLEAR_CRAWL_RESULTS"; searchUrl?: string };

// --- Movie list crawler state ---
let crawlState: MovieCrawlState = { ...defaultCrawlState };
let crawlTabId: number | null = null;
let crawlShouldStop = false;

async function broadcastCrawlState(state: MovieCrawlState): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: "CRAWL_STATE_UPDATED", crawlState: state });
  } catch {
    // Popup may be closed; ignore delivery failures.
  }
}

function waitForTabLoad(tabId: number, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error(`Tab ${tabId} load timed out after ${timeoutMs}ms.`));
    }, timeoutMs);

    function listener(
      updatedTabId: number,
      changeInfo: { status?: string },
    ): void {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    }

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function runMovieCrawl(searchUrl: string): Promise<void> {
  crawlShouldStop = false;
  crawlState = {
    status: "running",
    searchUrl,
    currentPage: 1,
    totalFound: 0,
    error: null,
  };

  let page = 1;

  try {
    const tab = await chrome.tabs.create({ url: "about:blank", active: false });
    crawlTabId = tab.id ?? null;

    if (crawlTabId === null) {
      throw new Error("Failed to create crawler tab.");
    }

    while (!crawlShouldStop) {
      const pageUrl = buildPageUrl(searchUrl, page);

      // For pages beyond the first, do a lightweight HEAD check for 404.
      if (page > 1) {
        let is404 = false;
        try {
          const res = await fetch(pageUrl, { method: "HEAD" });
          if (res.status === 404) {
            is404 = true;
          }
        } catch {
          is404 = true; // network error → treat as end of pages
        }
        if (is404) break;
      }

      // Navigate crawler tab and wait for DOM-complete.
      await chrome.tabs.update(crawlTabId, { url: pageUrl });
      await waitForTabLoad(crawlTabId);

      if (crawlShouldStop) break;

      // Extract movie links via scripting injection.
      const results = await chrome.scripting.executeScript({
        target: { tabId: crawlTabId },
        func: extractMovieLinksFromPage,
      });

      const links: string[] = results[0]?.result ?? [];

      if (links.length === 0) break; // No items on page — end of results.

      const entries: CrawledMovieEntry[] = links.map((link) => ({
        url: link.startsWith("http") ? link : new URL(link, pageUrl).toString(),
        crawledAt: new Date().toISOString(),
        sourceSearchUrl: searchUrl,
        page,
      }));

      await saveCrawledMovies(entries);

      crawlState = {
        ...crawlState,
        currentPage: page,
        totalFound: crawlState.totalFound + links.length,
      };

      await broadcastCrawlState(crawlState);
      page++;
    }

    crawlState = {
      ...crawlState,
      status: crawlShouldStop ? "stopped" : "done",
    };
  } catch (error) {
    crawlState = {
      ...crawlState,
      status: "error",
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (crawlTabId !== null) {
      try {
        await chrome.tabs.remove(crawlTabId);
      } catch {
        // Tab may already be closed.
      }
      crawlTabId = null;
    }
  }

  await broadcastCrawlState(crawlState);
}

const DEBUGGER_VERSION = "1.3";
interface CaptureSession {
  tabId: number;
  windowId: number;
  iframeSessionIds: Set<string>;
}

let captureSession: CaptureSession | null = null;
let pendingCaptureTask = Promise.resolve();

function runCaptureTask<T>(task: () => Promise<T>): Promise<T> {
  const result = pendingCaptureTask.then(task);
  pendingCaptureTask = result.then(() => undefined, () => undefined);
  return result;
}

interface ResponsePayload {
  url?: string;
  mimeType?: string;
}

interface DebuggeeWithSession extends chrome.debugger.Debuggee {
  sessionId?: string;
}

interface TargetAttachedParams {
  sessionId?: string;
  targetInfo?: {
    type?: string;
  };
}

interface TargetDetachedParams {
  sessionId?: string;
}

async function readPageMetadata(tabId: number): Promise<PageMetadata | null> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const readMeta = (selector: string): string | null => {
          const element = document.querySelector(selector);
          if (!element) {
            return null;
          }
          const value = element.getAttribute("content");
          return value && value.trim() ? value.trim() : null;
        };

        return {
          ogTitle: readMeta('meta[property="og:title"]'),
          ogDescription: readMeta('meta[property="og:description"]'),
          ogImage: readMeta('meta[property="og:image"]'),
        };
      },
    });

    return result?.result as PageMetadata | null;
  } catch {
    return null;
  }
}

async function recordLink(
  state: ExtensionState,
  tab: chrome.tabs.Tab,
  url: string,
  source: CapturedLink["source"],
  contentType: string | null,
  fromPageParameter = false,
): Promise<ExtensionState> {
  const tabUrl = tab.url ?? null;
  const trackingKey = buildTrackingKey(url, tabUrl);
  const existing = state.history.find((item) => item.trackingKey === trackingKey);
  if (existing && fromPageParameter) return state;

  const now = new Date().toISOString();
  const tabId = tab.id;
  if (typeof tabId !== "number") return state;
  return appendCapturedLink({
    trackingKey,
    url,
    tabUrl,
    pageTitle: tab.title ?? null,
    pageMetadata: existing || fromPageParameter ? null : await readPageMetadata(tabId),
    firstSeenAt: now,
    detectedAt: now,
    captureCount: 1,
    tabId,
    contentType,
    source,
    linkMetadata: buildLinkMetadata(url, contentType),
  });
}

async function stopCapture(): Promise<ExtensionState> {
  const session = captureSession;
  captureSession = null;
  if (session) {
    // Chrome can detach first when a tab closes or DevTools opens.
    await chrome.debugger.detach({ tabId: session.tabId }).catch(() => undefined);
  }
  return setCaptureSession(false, null);
}

async function startCapture(): Promise<ExtensionState> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tab?.id;
  if (typeof tabId !== "number") throw new Error("No active tab found.");

  if (captureSession?.tabId !== tabId) {
    await stopCapture();
    const target = { tabId };
    try {
      await chrome.debugger.attach(target, DEBUGGER_VERSION);
      captureSession = { tabId, windowId: tab.windowId, iframeSessionIds: new Set() };
      await chrome.debugger.sendCommand(target, "Target.setAutoAttach", {
        autoAttach: true,
        waitForDebuggerOnStart: false,
        flatten: true,
      });
      await chrome.debugger.sendCommand(target, "Network.enable");
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id !== tabId) {
        throw new Error("The active tab changed. Start capture again on the current tab.");
      }
    } catch (error) {
      await stopCapture();
      throw error;
    }
  }

  const state = await setCaptureSession(true, tabId);
  const currentTab = await chrome.tabs.get(tabId);
  const paramM3u8 = currentTab.url ? findPageParameterM3u8(currentTab.url) : null;
  return paramM3u8 ? recordLink(state, currentTab, paramM3u8, "url", null, true) : state;
}

function stopSession(session: CaptureSession): void {
  void runCaptureTask(async () => {
    if (captureSession === session) await stopCapture();
  }).catch(() => undefined);
}

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  const session = captureSession;
  if (session && windowId === session.windowId && tabId !== session.tabId) {
    stopSession(session);
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  const session = captureSession;
  if (session && windowId !== chrome.windows.WINDOW_ID_NONE && windowId !== session.windowId) {
    stopSession(session);
  }
});

chrome.debugger.onDetach.addListener((source) => {
  const session = captureSession;
  if (session && source.tabId === session.tabId) stopSession(session);
});

chrome.debugger.onEvent.addListener((source, method, params) => {
  const session = captureSession;
  const debuggee = source as DebuggeeWithSession;
  if (!session || debuggee.tabId !== session.tabId) return;
  if (debuggee.sessionId && !session.iframeSessionIds.has(debuggee.sessionId)) return;

  if (method === "Target.attachedToTarget") {
    const { sessionId, targetInfo } = params as TargetAttachedParams;
    if (targetInfo?.type === "iframe" && typeof sessionId === "string") {
      session.iframeSessionIds.add(sessionId);
      const target = { tabId: session.tabId, sessionId } as DebuggeeWithSession;
      void chrome.debugger.sendCommand(target, "Network.enable").catch(() => {
        session.iframeSessionIds.delete(sessionId);
      });
    }
    return;
  }

  if (method === "Target.detachedFromTarget") {
    const { sessionId } = params as TargetDetachedParams;
    if (typeof sessionId === "string") session.iframeSessionIds.delete(sessionId);
    return;
  }

  if (method !== "Network.responseReceived") return;
  const response = (params as { response?: ResponsePayload }).response;
  const url = response?.url;
  if (!url) return;
  const contentType = response?.mimeType ?? null;
  const { source: matchSource } = detectM3u8(url, contentType);
  if (!matchSource) return;

  void runCaptureTask(async () => {
    if (captureSession !== session) return;
    const tab = await chrome.tabs.get(session.tabId);
    if (!tab.active) {
      await stopCapture();
      return;
    }
    await recordLink(await getState(), tab, url, matchSource, contentType);
  }).catch(() => {
    // The target can disappear while a response is being processed.
  });
});

chrome.runtime.onMessage.addListener(
  (request: CaptureRequest, _sender, sendResponse) => {
    void (async () => {
      try {
        if (request.type === "GET_STATE") {
          const state = await runCaptureTask(async () => {
            const stored = await getState();
            return stored.isCapturing && !captureSession ? stopCapture() : stored;
          });
          sendResponse({ ok: true, state } satisfies RuntimeResponse);
          return;
        }

        if (request.type === "SET_MODE") {
          const state = await runCaptureTask(() => setMode(request.mode));
          sendResponse({ ok: true, state } satisfies RuntimeResponse);
          return;
        }

        if (request.type === "START_CAPTURE" || request.type === "STOP_CAPTURE") {
          const state = await runCaptureTask(request.type === "START_CAPTURE" ? startCapture : stopCapture);
          sendResponse({ ok: true, state } satisfies RuntimeResponse);
          return;
        }

        // --- Movie list crawler messages ---

        if (request.type === "START_MOVIE_CRAWL") {
          if (crawlState.status === "running") {
            sendResponse({
              ok: false,
              message: "Crawl already running.",
            } satisfies CrawlRuntimeResponse);
            return;
          }
          const searchUrl = (request as { type: string; searchUrl: string }).searchUrl;
          if (!searchUrl) {
            sendResponse({
              ok: false,
              message: "searchUrl is required.",
            } satisfies CrawlRuntimeResponse);
            return;
          }
          void runMovieCrawl(searchUrl);
          sendResponse({ ok: true, crawlState } satisfies CrawlRuntimeResponse);
          return;
        }

        if (request.type === "STOP_MOVIE_CRAWL") {
          crawlShouldStop = true;
          sendResponse({ ok: true, crawlState } satisfies CrawlRuntimeResponse);
          return;
        }

        if (request.type === "GET_CRAWL_STATE") {
          sendResponse({ ok: true, crawlState } satisfies CrawlRuntimeResponse);
          return;
        }

        if (request.type === "GET_CRAWL_RESULTS") {
          const searchUrl = (request as { type: string; searchUrl?: string }).searchUrl;
          const entries = await getCrawledMovies(searchUrl);
          sendResponse({ ok: true, entries } satisfies CrawlRuntimeResponse);
          return;
        }

        if (request.type === "CLEAR_CRAWL_RESULTS") {
          const searchUrl = (request as { type: string; searchUrl?: string }).searchUrl;
          await clearCrawledMovies(searchUrl);
          sendResponse({ ok: true } satisfies CrawlRuntimeResponse);
          return;
        }

        sendResponse({
          ok: false,
          message: "Unsupported message type.",
        } satisfies RuntimeResponse);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unexpected error.";
        sendResponse({ ok: false, message } satisfies RuntimeResponse);
      }
    })();

    return true;
  },
);
