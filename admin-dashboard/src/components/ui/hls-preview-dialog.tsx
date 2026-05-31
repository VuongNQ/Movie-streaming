import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { Badge } from './badge'
import { Button } from './button'

export interface HlsPreviewResult {
  status: 'live' | 'dead'
  metadata?: Record<string, unknown>
  errorMessage?: string
}

interface HlsPreviewDialogProps {
  open: boolean
  title: string
  streamUrl: string
  onClose: () => void
  onResolved?: (result: HlsPreviewResult) => void
}

type PreviewState = 'idle' | 'loading' | 'live' | 'dead'

interface CachedPreviewState {
  state: PreviewState
  errorMessage: string
  metadata: Record<string, unknown> | null
}

function toRoundedNumber(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return undefined
  }

  return Number(value.toFixed(2))
}

function normalizeHlsError(type: string, detail: string): string {
  const normalized = `${type}:${detail}`.toLowerCase()

  if (normalized.includes('cors')) {
    return 'CORS blocked the stream request from this browser context.'
  }

  if (normalized.includes('timeout')) {
    return 'The stream request timed out.'
  }

  if (normalized.includes('manifest')) {
    return 'Manifest could not be loaded or parsed.'
  }

  if (normalized.includes('network')) {
    return 'Network access to the stream failed.'
  }

  return `Stream preview failed (${type}: ${detail}).`
}

function isCodecUnsupportedError(mediaCode: number | undefined, mediaMessage: string, lastHlsErrorInfo: string): boolean {
  const normalizedMessage = mediaMessage.toLowerCase()
  const normalizedHls = lastHlsErrorInfo.toLowerCase()

  return (
    mediaCode === 4 &&
    (normalizedMessage.includes('unsupported') ||
      normalizedMessage.includes('decoder_error_not_supported') ||
      normalizedMessage.includes('unsupportedconfig') ||
      normalizedHls.includes('bufferseekoverhole'))
  )
}

export function HlsPreviewDialog({ open, title, streamUrl, onClose, onResolved }: HlsPreviewDialogProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const onResolvedRef = useRef<((result: HlsPreviewResult) => void) | null | undefined>(onResolved)
  const previewCacheRef = useRef<Map<string, CachedPreviewState>>(new Map())
  const [previewState, setPreviewState] = useState<PreviewState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    onResolvedRef.current = onResolved ?? null
  }, [onResolved])

  useEffect(() => {
    if (!open) {
      return
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('keydown', handleEscape)
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) {
      return
    }

    let isDisposed = false
    const queueUiState = (nextState: PreviewState, nextErrorMessage: string, nextMetadata: Record<string, unknown> | null) => {
      queueMicrotask(() => {
        if (isDisposed) {
          return
        }

        setPreviewState(nextState)
        setErrorMessage(nextErrorMessage)
        setMetadata(nextMetadata)
      })
    }

    const url = streamUrl.trim()
    if (!url) {
      const message = 'Stream link is empty. Enter a valid HLS URL before previewing.'
      queueUiState('dead', message, null)
      onResolvedRef.current?.({ status: 'dead', errorMessage: message })
      return
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      const message = 'Stream link is invalid. Please provide a full URL.'
      queueUiState('dead', message, null)
      onResolvedRef.current?.({ status: 'dead', errorMessage: message })
      return
    }

    if (window.location.protocol === 'https:' && parsedUrl.protocol === 'http:') {
      const message = 'Mixed content blocked: HTTP streams cannot be previewed from an HTTPS admin page.'
      queueUiState('dead', message, null)
      onResolvedRef.current?.({ status: 'dead', errorMessage: message })
      return
    }

    const video = videoRef.current
    if (!video) {
      const message = 'Video element is unavailable. Close and reopen preview.'
      queueUiState('dead', message, null)
      onResolvedRef.current?.({ status: 'dead', errorMessage: message })
      return
    }

    const cachedState = previewCacheRef.current.get(url)
    queueUiState('loading', cachedState?.errorMessage ?? '', cachedState?.metadata ?? null)

    const probeStartAt = performance.now()
    let isSettled = false
    let manifestParsed = false
    const timeoutHandle: ReturnType<typeof setTimeout> = setTimeout(() => {
      finish({
        status: 'dead',
        errorMessage: manifestParsed
          ? 'Manifest loaded but no playable media arrived before timeout. The stream may require auth, have broken segments, or be geo/CORS restricted.'
          : 'Preview timed out before manifest could be loaded. The stream may be unreachable or blocked by CORS.',
      })
    }, 8000)
    let hlsInstance: Hls | null = null
    let pendingMetadata: Record<string, unknown> | null = null
    let lastHlsErrorInfo = ''

    const dispose = () => {
      clearTimeout(timeoutHandle)

      video.pause()
      video.removeAttribute('src')
      video.load()

      if (hlsInstance) {
        hlsInstance.detachMedia()
        hlsInstance.destroy()
        hlsInstance = null
      }
    }

    const finish = (result: HlsPreviewResult) => {
      if (isSettled || isDisposed) {
        return
      }

      isSettled = true
      const probeDurationMs = Math.round(performance.now() - probeStartAt)
      const mergedMetadata = result.metadata
        ? {
            ...result.metadata,
            probe_duration_ms: probeDurationMs,
          }
        : undefined

      setPreviewState(result.status)
      setErrorMessage(result.errorMessage ?? '')
      setMetadata(mergedMetadata ?? null)
      previewCacheRef.current.set(url, {
        state: result.status,
        errorMessage: result.errorMessage ?? '',
        metadata: mergedMetadata ?? null,
      })
      onResolvedRef.current?.({
        ...result,
        metadata: mergedMetadata,
      })
    }

    const playPromise = () => {
      void video.play().catch(() => {
        // Autoplay can be blocked in some browsers. Controls are still available.
      })
    }

    const canUseNativeHls = video.canPlayType('application/vnd.apple.mpegurl') !== ''

    if (Hls.isSupported()) {
      let networkRecoveryAttempted = false
      let mediaRecoveryAttempted = false

      hlsInstance = new Hls({ enableWorker: true, lowLatencyMode: false })
      hlsInstance.loadSource(url)

      // Match basic demo behavior: once media is attached, try playback.
      hlsInstance.on(Hls.Events.MEDIA_ATTACHED, () => {
        playPromise()
      })

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        manifestParsed = true
        const levels = data.levels ?? []
        const renditionHeights = levels.map((level) => level.height).filter((height): height is number => typeof height === 'number')
        const renditionWidths = levels.map((level) => level.width).filter((width): width is number => typeof width === 'number')
        const renditionBitrates = levels.map((level) => level.bitrate).filter((bitrate): bitrate is number => typeof bitrate === 'number')
        const codecs = levels.map((level) => level.codecSet).filter((codec): codec is string => typeof codec === 'string' && codec.length > 0)

        pendingMetadata = {
          detected_by: 'hls.js',
          tested_at: new Date().toISOString(),
          manifest_url: url,
          rendition_count: levels.length,
          max_height: renditionHeights.length > 0 ? Math.max(...renditionHeights) : undefined,
          max_width: renditionWidths.length > 0 ? Math.max(...renditionWidths) : undefined,
          max_bitrate_kbps: renditionBitrates.length > 0 ? Math.round(Math.max(...renditionBitrates) / 1000) : undefined,
          codecs,
        }

        playPromise()
      })

      hlsInstance.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        pendingMetadata = {
          ...(pendingMetadata ?? {}),
          bandwidth_estimate: toRoundedNumber(hlsInstance?.bandwidthEstimate),
          level_bitrate: data.details?.totalduration ? toRoundedNumber(hlsInstance?.levels?.[hlsInstance.currentLevel]?.bitrate) : undefined,
          is_live: data.details?.live ?? undefined,
          target_duration: toRoundedNumber(data.details?.targetduration),
        }
      })

      const onPlayable = () => {
        finish({
          status: 'live',
          metadata: {
            ...(pendingMetadata ?? {}),
            video_width: video.videoWidth || undefined,
            video_height: video.videoHeight || undefined,
            current_time_seconds: toRoundedNumber(video.currentTime),
            ready_state: video.readyState,
          },
        })
        playPromise()
      }

      const onVideoError = () => {
        const mediaError = video.error
        const mediaCode = mediaError?.code
        const mediaMessageText = mediaError?.message ?? ''
        const mediaMessage = mediaMessageText ? ` MediaError: ${mediaMessageText}` : ''
        const hlsContext = lastHlsErrorInfo ? ` Last HLS error: ${lastHlsErrorInfo}.` : ''

        if (manifestParsed && isCodecUnsupportedError(mediaCode, mediaMessageText, lastHlsErrorInfo)) {
          finish({
            status: 'live',
            metadata: {
              ...(pendingMetadata ?? {}),
              video_width: video.videoWidth || undefined,
              video_height: video.videoHeight || undefined,
              ready_state: video.readyState,
              preview_warning:
                'Browser decoder does not support this stream audio/video config. Stream appears reachable but cannot be rendered in this preview environment.',
              preview_warning_code: 'codec_not_supported',
              media_error_code: mediaCode,
              media_error_message: mediaMessageText || undefined,
              last_hls_error: lastHlsErrorInfo || undefined,
            },
          })
          return
        }

        finish({
          status: 'dead',
          errorMessage: `Video element failed to decode or render this stream${typeof mediaCode === 'number' ? ` (code ${mediaCode})` : ''}.${mediaMessage}${hlsContext}`,
          metadata: pendingMetadata ?? undefined,
        })
      }

      video.addEventListener('loadeddata', onPlayable)
      video.addEventListener('canplay', onPlayable)
      video.addEventListener('error', onVideoError)

      hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
        const detail = typeof data.details === 'string' ? data.details : 'unknown'
        const type = typeof data.type === 'string' ? data.type : 'unknown'
        lastHlsErrorInfo = `${type}:${detail}${data.fatal ? ':fatal' : ':non-fatal'}`

        if (!data.fatal) {
          return
        }

        if (type === Hls.ErrorTypes.NETWORK_ERROR && !networkRecoveryAttempted) {
          networkRecoveryAttempted = true
          hlsInstance?.startLoad()
          return
        }

        if (type === Hls.ErrorTypes.MEDIA_ERROR && !mediaRecoveryAttempted) {
          mediaRecoveryAttempted = true
          hlsInstance?.recoverMediaError()
          return
        }

        finish({
          status: 'dead',
          errorMessage: `${normalizeHlsError(type, detail)} Check link validity, auth/referrer requirements, network reachability, or CORS policy.`,
          metadata: {
            ...(pendingMetadata ?? {}),
            error_type: type,
            error_details: detail,
          },
        })
      })

      hlsInstance.attachMedia(video)

      return () => {
        isDisposed = true
        video.removeEventListener('loadeddata', onPlayable)
        video.removeEventListener('canplay', onPlayable)
        video.removeEventListener('error', onVideoError)
        dispose()
      }
    }

    if (canUseNativeHls) {
      const onCanPlay = () => {
        const nativeMetadata: Record<string, unknown> = {
          detected_by: 'native_hls',
          tested_at: new Date().toISOString(),
          manifest_url: url,
          duration_seconds: toRoundedNumber(video.duration),
          video_width: video.videoWidth || undefined,
          video_height: video.videoHeight || undefined,
          ready_state: video.readyState,
        }

        finish({ status: 'live', metadata: nativeMetadata })
        playPromise()
      }

      const onError = () => {
        finish({
          status: 'dead',
          errorMessage: 'Unable to load this stream. It may be invalid, unavailable, or blocked by CORS.',
        })
      }

      video.addEventListener('canplay', onCanPlay)
      video.addEventListener('error', onError)
      video.src = url
      video.load()

      return () => {
        isDisposed = true
        video.removeEventListener('canplay', onCanPlay)
        video.removeEventListener('error', onError)
        dispose()
      }
    }

    finish({
      status: 'dead',
      errorMessage: 'This browser does not support HLS playback for preview.',
    })

    return () => {
      isDisposed = true
      dispose()
    }
  }, [open, streamUrl])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-3xl rounded-lg border border-border bg-background p-4 shadow-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">{title}</h3>
            <p className="text-xs text-muted-foreground break-all">{streamUrl}</p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <div className="mb-3 flex items-center gap-2">
          <Badge variant="outline">{previewState}</Badge>
          {previewState === 'loading' ? <span className="text-xs text-muted-foreground">Probing stream...</span> : null}
        </div>

        <video ref={videoRef} controls muted playsInline className="mb-3 h-64 w-full rounded-md border border-border bg-black md:h-80" />

        {errorMessage ? <p className="mb-3 rounded-md border border-red-300 bg-red-50 p-2 text-sm text-red-700">{errorMessage}</p> : null}

        {metadata ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Detected metadata</p>
            <pre className="max-h-56 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          </div>
        ) : null}
      </div>
    </div>
  )
}
