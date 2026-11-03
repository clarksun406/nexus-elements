import { bridge } from '../bridge'
import { requestToken } from './client'

export async function publishTokenResult(body: Record<string, unknown>): Promise<void> {
  try {
    const { ok, data } = await requestToken(body)
    if (!ok) {
      const error = (data.error as { type?: string; code?: string; message?: string } | undefined) ?? {
        type: 'api_error',
        message: 'Tokenization failed.',
      }
      await bridge.send('nexus:token-result', { error })
      return
    }
    await bridge.send('nexus:token-result', {
      token: data.token,
      paymentMethodId: data.payment_method_id,
    })
  } catch {
    await bridge.send('nexus:token-result', { error: { type: 'network_error', message: 'A network error occurred.' } })
  }
}
