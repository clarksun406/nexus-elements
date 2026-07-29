import type { IframeBridge } from './bridge'

export interface IframeConfig {
  elementId: string
  elementType: string
  fieldsUrl?: string
}

const DEFAULT_FIELDS_URL = '/__nexus-fields/index.html'

export function createElementIframe(
  config: IframeConfig,
  bridge: IframeBridge,
  options: Record<string, unknown>,
): HTMLIFrameElement {
  const iframe = document.createElement('iframe')

  iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-forms')
  iframe.setAttribute('allowtransparency', 'true')
  iframe.setAttribute('frameborder', '0')
  iframe.setAttribute('scrolling', 'no')
  iframe.setAttribute('title', `Nexus ${config.elementType} element`)
  iframe.setAttribute('aria-hidden', 'false')
  iframe.style.border = 'none'
  iframe.style.width = '100%'
  iframe.style.display = 'block'
  iframe.style.visibility = 'hidden'

  const src = config.fieldsUrl ?? DEFAULT_FIELDS_URL
  iframe.src = `${src}?elementType=${encodeURIComponent(config.elementType)}&elementId=${encodeURIComponent(config.elementId)}`

  iframe.addEventListener('load', () => {
    iframe.style.visibility = 'visible'
    void bridge.send('nexus:init', config.elementId, options)
  })

  return iframe
}

export function destroyIframe(iframe: HTMLIFrameElement | null): void {
  if (!iframe) return
  iframe.src = 'about:blank'
  iframe.remove()
}
