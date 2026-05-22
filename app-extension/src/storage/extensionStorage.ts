import type { CapturedLink, DisplayMode, ExtensionState } from '../types'
import { upsertTrackedLink } from '../utils/deduplicator'

const STORAGE_KEY = 'm3u8_state_v1'
const DEFAULT_HISTORY_SIZE = 5

const defaultState: ExtensionState = {
  mode: 'latest',
  latest: null,
  history: [],
  isCapturing: false,
  activeTabId: null,
}

async function readRawState(): Promise<ExtensionState> {
  const result = await chrome.storage.local.get(STORAGE_KEY)
  const stored = result[STORAGE_KEY] as ExtensionState | undefined
  return {
    ...defaultState,
    ...(stored ?? {}),
    history: stored?.history ?? [],
    latest: stored?.latest ?? null,
  }
}

async function writeRawState(state: ExtensionState): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: state })
}

export async function getState(): Promise<ExtensionState> {
  return readRawState()
}

export async function setMode(mode: DisplayMode): Promise<ExtensionState> {
  const state = await readRawState()
  const next = { ...state, mode }
  await writeRawState(next)
  return next
}

export async function setCaptureSession(isCapturing: boolean, activeTabId: number | null): Promise<ExtensionState> {
  const state = await readRawState()
  const next = {
    ...state,
    isCapturing,
    activeTabId,
  }
  await writeRawState(next)
  return next
}

export async function appendCapturedLink(link: CapturedLink, historySize = DEFAULT_HISTORY_SIZE): Promise<ExtensionState> {
  const state = await readRawState()
  const history = upsertTrackedLink(state.history, link, historySize)
  const next = {
    ...state,
    latest: history[0] ?? null,
    history,
  }
  await writeRawState(next)
  return next
}
