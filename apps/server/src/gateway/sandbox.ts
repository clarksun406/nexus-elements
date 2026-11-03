import type { AuthorizeRequest, AuthorizeResponse, PaymentChannel } from './types.js'

export class SandboxChannel implements PaymentChannel {
  readonly name = 'sandbox'

  authorize(input: AuthorizeRequest): Promise<AuthorizeResponse> {
    if (input.outcome.kind === 'decline') {
      return Promise.resolve({
        status: 'declined',
        decline: {
          code: input.outcome.code,
          decline_code: input.outcome.decline_code,
          message: input.outcome.message,
        },
      })
    }
    if (input.outcome.kind === 'requires_action') {
      const returnUrl = input.returnUrl ?? '/'
      return Promise.resolve({
        status: 'requires_action',
        redirectUrl: `/3ds-mock?intent=${encodeURIComponent(input.intentId)}&return_url=${encodeURIComponent(returnUrl)}`,
      })
    }
    return Promise.resolve({ status: 'succeeded' })
  }
}
