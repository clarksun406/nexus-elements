const STORAGE_KEY = 'nexus:3ds-handoff:v1'
const DEFAULT_ABANDON_MS = 15 * 60 * 1000

export interface ThreeDsHandoff {
  intentId: string
  clientSecret: string
  startedAt: number
  returnUrl: string
}

export type ThreeDsReturnKind = 'none' | 'approved' | 'failed' | 'cancelled' | 'abandoned' | 'timeout'

export interface ThreeDsReturnResolution {
  kind: ThreeDsReturnKind
  intentId?: string
  userMessage?: string
}

function canUseSessionStorage(): boolean {
  try {
    return typeof sessionStorage !== 'undefined'
  } catch {
    return false
  }
}

export function storeThreeDsHandoff(handoff: ThreeDsHandoff): void {
  if (!canUseSessionStorage()) return
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(handoff))
}

export function readThreeDsHandoff(): ThreeDsHandoff | null {
  if (!canUseSessionStorage()) return null
  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as ThreeDsHandoff
  } catch {
    return null
  }
}

export function clearThreeDsHandoff(): void {
  if (!canUseSessionStorage()) return
  sessionStorage.removeItem(STORAGE_KEY)
}

export function consumeReturnParams(searchParams: URLSearchParams): { status: string | null; intentId: string | null } {
  const status = searchParams.get('status')
  const intentId = searchParams.get('intent')
  if (status || intentId) {
    searchParams.delete('status')
    searchParams.delete('intent')
    const next = searchParams.toString()
    const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`
    window.history.replaceState(null, '', nextUrl)
  }
  return { status, intentId }
}

async function postThreeDsComplete(
  apiBase: string,
  publishableKey: string,
  intentId: string,
  status: 'cancelled' | 'failed' | 'approved',
): Promise<void> {
  await fetch(`${apiBase}/v1/3ds/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Nexus-Key': publishableKey,
    },
    body: JSON.stringify({ intent: intentId, status }),
    keepalive: true,
  })
}

export async function resolveThreeDsReturn(options: {
  apiBase: string
  publishableKey: string
  searchParams?: URLSearchParams
  abandonAfterMs?: number
}): Promise<ThreeDsReturnResolution> {
  const params = options.searchParams ?? new URLSearchParams(window.location.search)
  const { status, intentId: urlIntentId } = consumeReturnParams(params)
  const handoff = readThreeDsHandoff()

  if (status === 'approved' && urlIntentId) {
    clearThreeDsHandoff()
    return {
      kind: 'approved',
      intentId: urlIntentId,
      userMessage: `支付成功！${urlIntentId} · 3DS 验证通过`,
    }
  }

  if (status === 'failed' && urlIntentId) {
    clearThreeDsHandoff()
    return {
      kind: 'failed',
      intentId: urlIntentId,
      userMessage: `3DS 验证失败（${urlIntentId}），请更换卡片后重试。`,
    }
  }

  if (status === 'cancelled' && urlIntentId) {
    clearThreeDsHandoff()
    return {
      kind: 'cancelled',
      intentId: urlIntentId,
      userMessage: `已取消 3DS 验证（${urlIntentId}）。您可以重新输入卡信息并再次支付。`,
    }
  }

  if (!handoff) {
    return { kind: 'none' }
  }

  const age = Date.now() - handoff.startedAt
  const abandonAfter = options.abandonAfterMs ?? DEFAULT_ABANDON_MS
  const timedOut = age > abandonAfter

  // Returning to the merchant URL without a challenge result means the shopper
  // left the flow (browser back, explicit cancel on the mock page, or timeout).
  // Closing the challenge in another frame/tab is not reliably detectable here.
  if (!status && (timedOut || !urlIntentId || urlIntentId === handoff.intentId)) {
    await postThreeDsComplete(options.apiBase, options.publishableKey, handoff.intentId, 'cancelled')
    clearThreeDsHandoff()
    return {
      kind: timedOut ? 'timeout' : 'abandoned',
      intentId: handoff.intentId,
      userMessage: timedOut
        ? `3DS 验证已超时（${handoff.intentId}）。挑战已结束，请重新支付。`
        : `3DS 验证未完成（${handoff.intentId}）。挑战已取消，请重新支付。`,
    }
  }

  return { kind: 'none' }
}