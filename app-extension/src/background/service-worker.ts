import type {
  CapturedLink,
  DisplayMode,
  PageMetadata,
  RuntimeResponse,
} from "../types";
import {
  appendCapturedLink,
  getState,
  setCaptureSession,
  setMode,
} from "../storage/extensionStorage";
import { buildTrackingKey } from "../utils/deduplicator";
import { buildLinkMetadata, detectM3u8 } from "../utils/urlFilter";

type CaptureRequest =
  | { type: "GET_STATE" }
  | { type: "START_CAPTURE" }
  | { type: "STOP_CAPTURE" }
  | { type: "SET_MODE"; mode: DisplayMode };

const DEBUGGER_VERSION = "1.3";
let attachedTabId: number | null = null;
const iframeSessionIds = new Set<string>();
const processedPageParameterUrls = new Set<string>();

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

async function extractM3u8FromPageParams(
  tabId: number,
): Promise<string | null> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) return null;

    const pageUrl = new URL(tab.url);
    // Check common parameter names: url, link, stream, src, m3u8, playlist
    const paramNames = ["url", "link", "stream", "src", "m3u8", "playlist"];
    for (const paramName of paramNames) {
      const paramValue = pageUrl.searchParams.get(paramName);
      if (paramValue && paramValue.toLowerCase().includes(".m3u8")) {
        try {
          // Try to decode the URL in case it's encoded
          const decodedUrl = decodeURIComponent(paramValue);
          if (decodedUrl.startsWith("http")) {
            return decodedUrl;
          }
        } catch {
          // If decoding fails, try the original value
          if (paramValue.startsWith("http")) {
            return paramValue;
          }
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

async function broadcastState(state: unknown): Promise<void> {
  try {
    await chrome.runtime.sendMessage({ type: "STATE_UPDATED", state });
  } catch {
    // Popup may be closed; ignore delivery failures.
  }
}

function targetFor(tabId: number): chrome.debugger.Debuggee {
  return { tabId };
}

function targetForSession(
  tabId: number,
  sessionId: string,
): chrome.debugger.Debuggee {
  return { tabId, sessionId } as chrome.debugger.Debuggee;
}

function isKnownCaptureTarget(source: chrome.debugger.Debuggee): boolean {
  if (attachedTabId === null) {
    return false;
  }

  const debuggee = source as DebuggeeWithSession;
  if (debuggee.tabId === attachedTabId) {
    return true;
  }

  return (
    typeof debuggee.sessionId === "string" &&
    iframeSessionIds.has(debuggee.sessionId)
  );
}

async function getCurrentActiveTabId(): Promise<number> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  if (typeof tabId !== "number") {
    throw new Error("No active tab found.");
  }
  return tabId;
}

async function attachToTab(tabId: number): Promise<void> {
  attachedTabId = tabId;
  iframeSessionIds.clear();
  const rootTarget = targetFor(tabId);
  await chrome.debugger.attach(rootTarget, DEBUGGER_VERSION);
  await chrome.debugger.sendCommand(rootTarget, "Target.setAutoAttach", {
    autoAttach: true,
    waitForDebuggerOnStart: false,
    flatten: true,
  });
  await chrome.debugger.sendCommand(rootTarget, "Network.enable");
}

async function detachFromTab(tabId: number): Promise<void> {
  const rootTarget = targetFor(tabId);
  try {
    await chrome.debugger.sendCommand(rootTarget, "Target.setAutoAttach", {
      autoAttach: false,
      waitForDebuggerOnStart: false,
      flatten: true,
    });
  } catch {
    // Ignore detach preconditions from stale targets.
  }
  try {
    await chrome.debugger.sendCommand(rootTarget, "Network.disable");
  } catch {
    // Ignore detach preconditions from stale targets.
  }
  await chrome.debugger.detach(rootTarget);
  if (attachedTabId === tabId) {
    attachedTabId = null;
    iframeSessionIds.clear();
    processedPageParameterUrls.clear();
  }
}

chrome.debugger.onEvent.addListener(async (source, method, params) => {
  if (method === "Target.attachedToTarget" && source.tabId === attachedTabId) {
    const payload = params as TargetAttachedParams;
    const sessionId = payload.sessionId;
    if (
      payload.targetInfo?.type === "iframe" &&
      typeof sessionId === "string" &&
      attachedTabId !== null
    ) {
      iframeSessionIds.add(sessionId);
      await chrome.debugger.sendCommand(
        targetForSession(attachedTabId, sessionId),
        "Network.enable",
      );
    }
    return;
  }

  if (method === "Target.detachedFromTarget") {
    const payload = params as TargetDetachedParams;
    if (typeof payload.sessionId === "string") {
      iframeSessionIds.delete(payload.sessionId);
    }
    return;
  }

  if (method !== "Network.responseReceived") {
    return;
  }

  if (!isKnownCaptureTarget(source) || attachedTabId === null) {
    return;
  }

  const tabId = attachedTabId;

  const state = await getState();
  if (!state.isCapturing || state.activeTabId !== tabId) {
    return;
  }

  const response = (params as { response?: ResponsePayload }).response;
  const responseUrl = response?.url;
  if (!responseUrl) {
    return;
  }

  // Debug: log all network requests to browser console for troubleshooting
  console.log("[m3u8-capture-debug]", {
    url: responseUrl,
    mimeType: response?.mimeType ?? "unknown",
    isM3u8Candidate: responseUrl.toLowerCase().includes(".m3u8"),
  });

  const matched = detectM3u8(responseUrl, response?.mimeType);
  if (!matched.matched || !matched.source) {
    return;
  }

  const tab = await chrome.tabs.get(tabId);
  const tabUrl = tab.url ?? null;
  const trackingKey = buildTrackingKey(responseUrl, tabUrl);
  const existing = state.history.find(
    (item) => item.trackingKey === trackingKey,
  );
  const pageMetadata = existing ? null : await readPageMetadata(tabId);

  const now = new Date().toISOString();

  const link: CapturedLink = {
    trackingKey,
    url: responseUrl,
    tabUrl,
    pageTitle: tab.title ?? null,
    pageMetadata,
    firstSeenAt: now,
    detectedAt: now,
    captureCount: 1,
    tabId,
    contentType: response?.mimeType ?? null,
    source: matched.source,
    linkMetadata: buildLinkMetadata(responseUrl, response?.mimeType),
  };

  const nextState = await appendCapturedLink(link);
  await broadcastState(nextState);
});

chrome.debugger.onDetach.addListener(async (source) => {
  if (typeof source.tabId === "number" && source.tabId === attachedTabId) {
    attachedTabId = null;
    const nextState = await setCaptureSession(false, null);
    await broadcastState(nextState);
  }
});

chrome.runtime.onMessage.addListener(
  (request: CaptureRequest, _sender, sendResponse) => {
    void (async () => {
      try {
        if (request.type === "GET_STATE") {
          const state = await getState();
          sendResponse({ ok: true, state } satisfies RuntimeResponse);
          return;
        }

        if (request.type === "SET_MODE") {
          const state = await setMode(request.mode);
          sendResponse({ ok: true, state } satisfies RuntimeResponse);
          return;
        }

        if (request.type === "START_CAPTURE") {
          const tabId = await getCurrentActiveTabId();

          if (attachedTabId !== null && attachedTabId !== tabId) {
            await detachFromTab(attachedTabId);
          }

          if (attachedTabId === null) {
            await attachToTab(tabId);
          }

          const state = await setCaptureSession(true, tabId);

          // Check for m3u8 URL in page parameters (fallback for player pages)
          const paramM3u8 = await extractM3u8FromPageParams(tabId);
          if (
            paramM3u8 &&
            !processedPageParameterUrls.has(paramM3u8)
          ) {
            processedPageParameterUrls.add(paramM3u8);
            const tab = await chrome.tabs.get(tabId);
            const tabUrl = tab.url ?? null;
            const trackingKey = buildTrackingKey(paramM3u8, tabUrl);
            const existing = state.history.find(
              (item) => item.trackingKey === trackingKey,
            );

            if (!existing) {
              const now = new Date().toISOString();
              const link: CapturedLink = {
                trackingKey,
                url: paramM3u8,
                tabUrl,
                pageTitle: tab.title ?? null,
                pageMetadata: null,
                firstSeenAt: now,
                detectedAt: now,
                captureCount: 1,
                tabId,
                contentType: "application/vnd.apple.mpegurl",
                source: "url",
                linkMetadata: buildLinkMetadata(paramM3u8),
              };

              const nextState = await appendCapturedLink(link);
              await broadcastState(nextState);
            }
          }

          sendResponse({ ok: true, state } satisfies RuntimeResponse);
          return;
        }

        if (request.type === "STOP_CAPTURE") {
          if (attachedTabId !== null) {
            await detachFromTab(attachedTabId);
          }

          processedPageParameterUrls.clear();
          const state = await setCaptureSession(false, null);
          sendResponse({ ok: true, state } satisfies RuntimeResponse);
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
