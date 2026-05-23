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
const STANDALONE_WINDOW_URL = chrome.runtime.getURL("popup.html");
let attachedTabId: number | null = null;

interface ResponsePayload {
  url?: string;
  mimeType?: string;
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

async function getCurrentActiveTabId(): Promise<number> {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabId = tabs[0]?.id;
  if (typeof tabId !== "number") {
    throw new Error("No active tab found.");
  }
  return tabId;
}

async function openStandaloneWindow(): Promise<void> {
  const windows = await chrome.windows.getAll({ populate: true });
  const existingWindow = windows.find((entry) =>
    entry.tabs?.some((tab) => tab.url === STANDALONE_WINDOW_URL),
  );

  if (typeof existingWindow?.id === "number") {
    await chrome.windows.update(existingWindow.id, { focused: true });
    return;
  }

  await chrome.windows.create({
    url: STANDALONE_WINDOW_URL,
    type: "popup",
    width: 460,
    height: 760,
    focused: true,
  });
}

async function attachToTab(tabId: number): Promise<void> {
  await chrome.debugger.attach(targetFor(tabId), DEBUGGER_VERSION);
  await chrome.debugger.sendCommand(targetFor(tabId), "Network.enable");
  attachedTabId = tabId;
}

async function detachFromTab(tabId: number): Promise<void> {
  try {
    await chrome.debugger.sendCommand(targetFor(tabId), "Network.disable");
  } catch {
    // Ignore detach preconditions from stale targets.
  }
  await chrome.debugger.detach(targetFor(tabId));
  if (attachedTabId === tabId) {
    attachedTabId = null;
  }
}

chrome.debugger.onEvent.addListener(async (source, method, params) => {
  if (method !== "Network.responseReceived") {
    return;
  }

  const tabId = source.tabId;
  if (typeof tabId !== "number" || tabId !== attachedTabId) {
    return;
  }

  // Add this debug:
  const p = params as {
    frameId?: string;
    response?: { url?: string; mimeType?: string };
  };
  console.log("[m3u8-debug]", {
    tabId,
    frameId: p.frameId, // iframe usually has non-main frameId
    url: p.response?.url,
    mimeType: p.response?.mimeType,
  });

  const state = await getState();
  if (!state.isCapturing || state.activeTabId !== tabId) {
    return;
  }

  const response = (params as { response?: ResponsePayload }).response;
  const responseUrl = response?.url;
  if (!responseUrl) {
    return;
  }

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

chrome.action.onClicked.addListener(() => {
  void openStandaloneWindow();
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
          sendResponse({ ok: true, state } satisfies RuntimeResponse);
          return;
        }

        if (request.type === "STOP_CAPTURE") {
          if (attachedTabId !== null) {
            await detachFromTab(attachedTabId);
          }

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
