import type { CapturedLink, DisplayMode, ExtensionState, RuntimeResponse } from '../types'
import './popup.css'

function getRequiredElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector)
  if (!element) {
    throw new Error(`Popup UI binding is missing for ${selector}.`)
  }
  return element
}

const startButton = getRequiredElement<HTMLButtonElement>('#startCapture')
const stopButton = getRequiredElement<HTMLButtonElement>('#stopCapture')
const modeSelect = getRequiredElement<HTMLSelectElement>('#modeSelect')
const statusText = getRequiredElement<HTMLParagraphElement>('#statusText')
const feedbackText = getRequiredElement<HTMLParagraphElement>('#feedbackText')
const linksContainer = getRequiredElement<HTMLDivElement>('#linksContainer')

let currentState: ExtensionState | null = null

function setFeedback(message: string, isError = false): void {
  feedbackText.textContent = message
  feedbackText.classList.toggle('error', isError)
}

function renderLinks(state: ExtensionState): void {
  linksContainer.innerHTML = ''

  const links = state.mode === 'latest' ? (state.latest ? [state.latest] : []) : state.history

  if (links.length === 0) {
    const empty = document.createElement('div')
    empty.className = 'empty'
    empty.textContent = 'No m3u8 link detected yet.'
    linksContainer.appendChild(empty)
    return
  }

  links.forEach((link) => {
    linksContainer.appendChild(createLinkCard(link))
  })
}

function makeDetailRow(label: string, value: string): HTMLParagraphElement {
  const row = document.createElement('p')
  row.className = 'detail-row'
  const labelEl = document.createElement('strong')
  labelEl.textContent = `${label}:`
  const valueEl = document.createElement('span')
  valueEl.textContent = ` ${value}`
  row.append(labelEl, valueEl)
  return row
}

function createLinkCard(link: CapturedLink): HTMLElement {
  const card = document.createElement('article')
  card.className = 'link-card'

  const url = document.createElement('p')
  url.textContent = link.url

  const meta = document.createElement('div')
  meta.className = 'meta'

  const summary = document.createElement('span')
  summary.className = 'summary'
  summary.textContent = `${link.pageTitle ?? 'Unknown page'} • ${link.captureCount}x`

  const time = document.createElement('span')
  time.textContent = new Date(link.detectedAt).toLocaleTimeString()

  const copyButton = document.createElement('button')
  copyButton.type = 'button'
  copyButton.textContent = 'Copy link'
  copyButton.addEventListener('click', () => {
    void copyLink(link.url)
  })

  meta.append(summary, time, copyButton)

  const details = document.createElement('details')
  details.className = 'details'
  details.id = `details-${encodeURIComponent(link.trackingKey)}`

  const detailsSummary = document.createElement('summary')
  detailsSummary.textContent = 'More info'
  details.appendChild(detailsSummary)

  // --- Static metadata rows ---
  const detailsBody = document.createElement('div')
  detailsBody.className = 'details-body'

  const detailRows: [string, string | null | undefined][] = [
    ['Page URL', link.tabUrl],
    ['First seen', new Date(link.firstSeenAt).toLocaleString()],
    ['Last seen', new Date(link.detectedAt).toLocaleString()],
    ['Source', link.source],
    ['Content type', link.contentType],
    ['Host', link.linkMetadata.host],
    ['Path', link.linkMetadata.path],
    ['Query keys', link.linkMetadata.queryKeys.length ? link.linkMetadata.queryKeys.join(', ') : null],
    ['Resolution', link.linkMetadata.resolution],
    ['Bandwidth (kbps)', link.linkMetadata.bandwidthKbps?.toString() ?? null],
    ['Codec', link.linkMetadata.codec],
    ['og:title', link.pageMetadata?.ogTitle ?? null],
    ['og:description', link.pageMetadata?.ogDescription ?? null],
    ['og:image', link.pageMetadata?.ogImage ?? null],
  ]

  detailRows.forEach(([label, value]) => {
    if (!value) return
    detailsBody.appendChild(makeDetailRow(label, value))
  })

  if (!detailsBody.childElementCount) {
    const empty = document.createElement('p')
    empty.className = 'detail-row'
    empty.textContent = 'No additional metadata available.'
    detailsBody.appendChild(empty)
  }

  details.appendChild(detailsBody)

  card.append(url, meta, details)

  return card
}

function renderState(state: ExtensionState): void {
  currentState = state
  modeSelect.value = state.mode
  statusText.textContent = state.isCapturing
    ? `Capturing active tab ${state.activeTabId ?? ''}`
    : 'Capture stopped'
  renderLinks(state)
}

async function sendMessage(request: { type: string; mode?: DisplayMode }): Promise<RuntimeResponse> {
  return chrome.runtime.sendMessage(request) as Promise<RuntimeResponse>
}

async function refreshState(): Promise<void> {
  const result = await sendMessage({ type: 'GET_STATE' })
  if (!result.ok || !result.state) {
    setFeedback(result.message ?? 'Unable to read state.', true)
    return
  }
  renderState(result.state)
}

async function setMode(mode: DisplayMode): Promise<void> {
  const result = await sendMessage({ type: 'SET_MODE', mode })
  if (!result.ok || !result.state) {
    setFeedback(result.message ?? 'Failed to update mode.', true)
    return
  }

  renderState(result.state)
  setFeedback(`Mode set to ${mode}.`)
}

async function toggleCapture(start: boolean): Promise<void> {
  const result = await sendMessage({ type: start ? 'START_CAPTURE' : 'STOP_CAPTURE' })
  if (!result.ok || !result.state) {
    setFeedback(result.message ?? 'Capture operation failed.', true)
    return
  }

  renderState(result.state)
  setFeedback(start ? 'Capture started.' : 'Capture stopped.')
}

async function copyLink(value: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
    setFeedback('Link copied to clipboard.')
  } catch {
    setFeedback('Unable to copy link.', true)
  }
}

chrome.runtime.onMessage.addListener((message: { type?: string; state?: ExtensionState }) => {
  if (message.type === 'STATE_UPDATED' && message.state) {
    renderState(message.state)
  }
})

startButton.addEventListener('click', () => {
  void toggleCapture(true)
})

stopButton.addEventListener('click', () => {
  void toggleCapture(false)
})

modeSelect.addEventListener('change', () => {
  void setMode(modeSelect.value as DisplayMode)
})

void refreshState()

// Preserve explicit reference for potential debugging hooks without altering behavior.
void currentState
