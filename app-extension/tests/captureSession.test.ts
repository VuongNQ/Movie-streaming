import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ExtensionState, RuntimeResponse } from '../src/types'
import { STORAGE_KEY } from '../src/storage/extensionStorage'

function browserEvent<Args extends unknown[]>() {
  let listener: ((...args: Args) => void) | undefined
  return {
    addListener(callback: (...args: Args) => void) {
      listener = callback
    },
    fire(...args: Args) {
      listener?.(...args)
    },
  }
}

async function loadWorker(storedState?: Partial<ExtensionState>) {
  vi.resetModules()
  const stored: Record<string, unknown> = storedState ? { [STORAGE_KEY]: storedState } : {}
  const tab = { id: 10, windowId: 1, active: true, url: 'https://example.com/player' }
  const messages = browserEvent<[{ type: string; mode?: string }, unknown, (response: RuntimeResponse) => void]>()
  const responses = browserEvent<[{ tabId: number }, string, unknown]>()
  const tabActivated = browserEvent<[{ tabId: number; windowId: number }]>()
  const debuggerApi = {
    attach: vi.fn(async () => undefined),
    detach: vi.fn(async () => undefined),
    sendCommand: vi.fn(async () => undefined),
    onEvent: responses,
    onDetach: browserEvent<[{ tabId: number }]>(),
  }
  vi.stubGlobal('chrome', {
    debugger: debuggerApi,
    runtime: { onMessage: messages },
    scripting: { executeScript: async () => [] },
    storage: {
      local: {
        get: async () => structuredClone(stored),
        set: async (update: Record<string, unknown>) => { Object.assign(stored, structuredClone(update)) },
      },
    },
    tabs: { query: async () => [tab], get: async () => tab, onActivated: tabActivated },
    windows: { onFocusChanged: browserEvent<[number]>(), WINDOW_ID_NONE: -1 },
  })
  await import('../src/background/service-worker')

  return {
    debuggerApi,
    send: (type: string, mode?: string) => new Promise<RuntimeResponse>((resolve) => {
      messages.fire({ type, mode }, undefined, resolve)
    }),
    respond: (url: string) => responses.fire({ tabId: tab.id }, 'Network.responseReceived', {
      response: { url, mimeType: 'application/vnd.apple.mpegurl' },
    }),
    activateOtherTab: () => {
      tab.active = false
      tabActivated.fire({ tabId: tab.id + 1, windowId: tab.windowId })
    },
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('capture session', () => {
  const first = 'https://cdn.example.com/one.m3u8'
  const second = 'https://cdn.example.com/two.m3u8'

  it('keeps concurrent responses and mode updates in order', async () => {
    const worker = await loadWorker()
    expect((await worker.send('START_CAPTURE')).ok).toBe(true)
    worker.respond(first)
    const changeMode = worker.send('SET_MODE', 'history')
    worker.respond(second)
    worker.respond(second)
    await changeMode

    const { state } = await worker.send('GET_STATE')
    expect(state?.mode).toBe('history')
    expect(state?.history.map(({ url, captureCount }) => [url, captureCount])).toEqual([
      [second, 2],
      [first, 1],
    ])
  })

  it('stops when a different tab is activated and keeps previously captured links', async () => {
    const worker = await loadWorker()
    await worker.send('START_CAPTURE')
    worker.respond(first)
    await worker.send('GET_STATE')

    worker.activateOtherTab()
    worker.respond(second)

    const { state } = await worker.send('GET_STATE')
    expect(state?.isCapturing).toBe(false)
    expect(state?.activeTabId).toBeNull()
    expect(state?.history.map(({ url }) => url)).toEqual([first])
    expect(worker.debuggerApi.detach).toHaveBeenCalledOnce()
  })

  it('detaches after a partial setup failure and permits a fresh start', async () => {
    const worker = await loadWorker()
    worker.debuggerApi.sendCommand.mockRejectedValueOnce(new Error('Setup failed'))

    expect(await worker.send('START_CAPTURE')).toEqual({ ok: false, message: 'Setup failed' })
    expect((await worker.send('GET_STATE')).state?.isCapturing).toBe(false)
    expect(worker.debuggerApi.detach).toHaveBeenCalledOnce()
    expect((await worker.send('START_CAPTURE')).state?.isCapturing).toBe(true)
    expect(worker.debuggerApi.attach).toHaveBeenCalledTimes(2)
  })

  it('clears a persisted active flag when a restarted worker has no debugger session', async () => {
    const worker = await loadWorker({ isCapturing: true, activeTabId: 10, mode: 'history' })
    const { state } = await worker.send('GET_STATE')
    expect(state).toMatchObject({ isCapturing: false, activeTabId: null, mode: 'history' })
  })
})
