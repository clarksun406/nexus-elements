import { Nexus } from './nexus'
import type { NexusOptions } from './types'

export function createNexus(publishableKey: string, options?: NexusOptions): Nexus {
  return new Nexus(publishableKey, options)
}

export function loadNexus(publishableKey: string, options?: NexusOptions): Promise<Nexus> {
  return Promise.resolve(new Nexus(publishableKey, options))
}

const SDK_CDN_URL = 'https://js.nexuspay.com/v1/nexus.js'

interface LoaderOptions {
  url?: string
  integrity?: string
  retries?: number
}

export function loadScript(options: LoaderOptions = {}): Promise<void> {
  const { url = SDK_CDN_URL, integrity, retries = 3 } = options

  if ((window as unknown as Record<string, unknown>).Nexus) {
    return Promise.resolve()
  }

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${url}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('Nexus SDK script failed to load.')))
    })
  }

  let attempt = 0

  const tryLoad = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = url
      script.async = true
      if (integrity) {
        script.integrity = integrity
        script.crossOrigin = 'anonymous'
      }
      script.addEventListener('load', () => resolve())
      script.addEventListener('error', () => {
        script.remove()
        attempt++
        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 500
          setTimeout(() => tryLoad().then(resolve, reject), delay)
        } else {
          reject(new Error(`Failed to load Nexus SDK after ${retries} attempts.`))
        }
      })
      document.head.appendChild(script)
    })
  }

  return tryLoad()
}
