import { waitForEvenAppBridge, type EvenAppBridge } from '@evenrealities/even_hub_sdk'

let current: EvenAppBridge | null = null
let ready: Promise<EvenAppBridge | null> | null = null

/**
 * O host do Even Hub injeta o bridge no WebView. No navegador comum (dev) ele
 * nunca aparece, então esperamos no máximo 2,5 s e seguimos em modo navegador.
 */
function hasNativeHost(): boolean {
  const scope = window as unknown as {
    flutter_inappwebview?: unknown
    flutterBridge?: unknown
    webkit?: { messageHandlers?: Record<string, unknown> }
  }
  return (
    typeof scope.flutter_inappwebview !== 'undefined' ||
    typeof scope.flutterBridge !== 'undefined' ||
    typeof scope.webkit?.messageHandlers?.evenApp !== 'undefined'
  )
}

export function getBridge(): Promise<EvenAppBridge | null> {
  if (!hasNativeHost()) {
    ready = Promise.resolve(null)
    return ready
  }
  if (!ready) {
    const native = waitForEvenAppBridge()
      .then((bridge) => {
        current = bridge ?? null
        return current
      })
      .catch(() => null)
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2500))
    ready = Promise.race([native, timeout])
  }
  return ready
}

export function bridgeNow(): EvenAppBridge | null {
  return current
}

export function hasBridge(): boolean {
  return current !== null
}
