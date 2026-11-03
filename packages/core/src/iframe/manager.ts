import type { IframeBridge } from './bridge'

export interface IframeConfig {
  elementId: string
  elementType: string
  fieldsUrl?: string
}

/** Scripts + forms + same-origin (BroadcastChannel / fetch). No top-navigation, popups, or pointer lock. */
export const ELEMENT_SANDBOX = 'allow-scripts allow-same-origin allow-forms'

const DEFAULT_FIELDS_URL = '/__nexus-fields/index.html'

export interface FieldsLocation {
  src: string
  origin: string
}

export function resolveFieldsLocation(config: IframeConfig, bridge: Pick<IframeBridge, 'getBootstrap'> | { getBootstrap?: () => ReturnType<IframeBridge['getBootstrap']> }): FieldsLocation {
  const bootstrap = bridge.getBootstrap?.() ?? {
    secret: '00',
    groupId: 'grp_unconfigured',
    groupKey: '00',
  }
  const base = config.fieldsUrl ?? DEFAULT_FIELDS_URL
  const url = new URL(base, window.location.href)
  url.searchParams.set('elementType', config.elementType)
  url.searchParams.set('elementId', config.elementId)
  const token = encodeURIComponent(JSON.stringify({
    v: 1,
    k: bootstrap.secret,
    g: bootstrap.groupId,
    gk: bootstrap.groupKey,
    p: window.location.origin,
  }))
  url.hash = `nexus=${token}`
  return { src: url.toString(), origin: url.origin }
}

export function createElementIframe(
  config: IframeConfig,
  bridge: IframeBridge,
  options: Record<string, unknown>,
): HTMLIFrameElement {
  const iframe = document.createElement('iframe')
  const location = resolveFieldsLocation(config, bridge)

  iframe.setAttribute('sandbox', ELEMENT_SANDBOX)
  iframe.setAttribute('referrerpolicy', 'no-referrer')
  iframe.setAttribute('allowtransparency', 'true')
  iframe.setAttribute('frameborder', '0')
  iframe.setAttribute('scrolling', 'no')
  iframe.setAttribute('title', `Nexus ${config.elementType} element`)
  iframe.setAttribute('aria-hidden', 'false')
  iframe.style.border = 'none'
  iframe.style.width = '100%'
  iframe.style.display = 'block'
  iframe.style.visibility = 'hidden'
  iframe.src = location.src

  iframe.addEventListener('load', () => {
    iframe.style.visibility = 'visible'
    void bridge.send('nexus:init', config.elementId, options)
  })

  return iframe
}

export function fieldsOriginFor(config: IframeConfig): string {
  const base = config.fieldsUrl ?? DEFAULT_FIELDS_URL
  return new URL(base, window.location.href).origin
}

export function destroyIframe(iframe: HTMLIFrameElement | null): void {
  if (!iframe) return
  iframe.src = 'about:blank'
  iframe.remove()
}
