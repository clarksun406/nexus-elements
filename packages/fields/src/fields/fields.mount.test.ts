/**
 * @vitest-environment jsdom
 */
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMessage } from '../../../core/src/iframe/channel'
import { bridge } from '../bridge'
import { configureApi } from '../api/client'
import CardField from './CardField.vue'
import CardNumberField from './CardNumberField.vue'
import CardExpiryField from './CardExpiryField.vue'
import CardCvcField from './CardCvcField.vue'
import PaymentField from './PaymentField.vue'
import ExpressCheckoutField from './ExpressCheckoutField.vue'
import AddressField from './AddressField.vue'
import IdealBankField from './IdealBankField.vue'
import IbanField from './IbanField.vue'
import AuBankAccountField from './AuBankAccountField.vue'
import FpxBankField from './FpxBankField.vue'
import EpsBankField from './EpsBankField.vue'
import P24BankField from './P24BankField.vue'
import LinkAuthenticationField from './LinkAuthenticationField.vue'
import CartField from './CartField.vue'
import OrderField from './OrderField.vue'
import AfterpayClearpayField from './AfterpayClearpayField.vue'
import PaymentMessagingField from './PaymentMessagingField.vue'
import WalletButtonField from './WalletButtonField.vue'

const SECRET = 'ef'.repeat(32)

async function boot(component: object, options: Record<string, unknown> = {}, type = 'card') {
  bridge.resetForTests()
  bridge.bootstrap({
    elementId: 'el_test',
    channelSecret: SECRET,
    parentOrigin: window.location.origin,
    groupId: 'grp_test',
    groupKey: 'ab'.repeat(32),
  })
  const wrapper = mount(component)
  const message = await createMessage('nexus:init', 'el_test', {
    publishableKey: 'pk_test_fields',
    elementType: type,
    options,
    appearance: { variables: { '--nexus-border-radius': '2px', '--nexus-color-background': '#ffffff' }, rules: { '.Input': { color: 'red' } } },
    locale: 'en',
    apiBase: '',
  }, SECRET)
  window.dispatchEvent(new MessageEvent('message', {
    data: message,
    origin: window.location.origin,
    source: window.parent,
  }))
  await flushPromises()
  return wrapper
}

describe('field components', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      const href = String(url)
      if (href.includes('/encryption_key')) {
        return { ok: true, json: async () => ({ algorithm: 'none', public_key_jwk: null }) }
      }
      if (href.includes('/v1/tokens')) {
        return { ok: true, json: async () => ({ token: 'tok_test_field', payment_method_id: 'pm_test_field' }) }
      }
      if (href.includes('/v1/orders/')) {
        return { ok: true, json: async () => ({ order: { id: 'ord_1', status: 'paid' } }) }
      }
      return { ok: false, status: 404, json: async () => ({}) }
    }))
  })

  it('mounts every field and reports ready', async () => {
    const cases: Array<[object, string, Record<string, unknown>]> = [
      [CardField, 'card', {}],
      [CardNumberField, 'cardNumber', { showIcon: true }],
      [CardExpiryField, 'cardExpiry', {}],
      [CardCvcField, 'cardCvc', {}],
      [PaymentField, 'payment', { layout: 'accordion', wallets: ['link'], allowSavePaymentMethod: true, business: { currency: 'eur', country: 'NL' } }],
      [ExpressCheckoutField, 'expressCheckout', { paymentMethods: { applePay: 'always', paypal: 'never' }, layout: { type: 'vertical' } }],
      [AddressField, 'address', { mode: 'billing', defaultValues: { address: { country: 'US', postal_code: '10001' } } }],
      [IdealBankField, 'idealBank', {}],
      [IbanField, 'iban', {}],
      [AuBankAccountField, 'auBankAccount', {}],
      [FpxBankField, 'fpxBank', {}],
      [EpsBankField, 'epsBank', {}],
      [P24BankField, 'p24Bank', {}],
      [LinkAuthenticationField, 'linkAuthentication', { mode: 'email', defaultValues: { email: 'a@b.c' } }],
      [CartField, 'cart', { items: [{ id: '1', name: 'Item', unit_amount: 100, currency: 'usd', quantity: 1 }] }],
      [OrderField, 'order', { orderId: 'ord_1', pollInterval: 0, defaultValues: { status: 'pending', items: [] } }],
      [AfterpayClearpayField, 'afterpayClearpay', { amount: 5000, currency: 'USD' }],
      [PaymentMessagingField, 'paymentMethodMessaging', { amount: 5000, currency: 'usd' }],
      [WalletButtonField, 'walletButton', { wallet: 'googlePay', buttonType: 'buy' }],
    ]
    for (const [component, type, options] of cases) {
      const wrapper = await boot(component, options, type)
      expect(wrapper.html().length).toBeGreaterThan(10)
      wrapper.unmount()
    }
  })

  it('tokenizes a combined card inside the frame', async () => {
    configureApi({ apiBase: '', publishableKey: 'pk_test_fields' })
    const posted: unknown[] = []
    const original = window.parent.postMessage.bind(window.parent)
    window.parent.postMessage = ((data: unknown) => {
      posted.push(data)
      original(data, window.location.origin)
    }) as typeof window.parent.postMessage
    const wrapper = await boot(CardField)
    await wrapper.find('input.nexus-number').setValue('4242424242424242')
    await wrapper.find('input.nexus-expiry').setValue('12/30')
    await wrapper.find('input.nexus-cvc').setValue('123')
    await wrapper.find('input.nexus-postal').setValue('10001')
    const message = await createMessage('nexus:tokenize', 'el_test', { clientSecret: 'cs_test' }, SECRET)
    window.dispatchEvent(new MessageEvent('message', { data: message, origin: window.location.origin, source: window.parent }))
    await flushPromises()
    await vi.waitFor(() => {
      const result = posted.find((entry) => (entry as { type?: string }).type === 'nexus:token-result') as { payload?: { token?: string; number?: string } } | undefined
      expect(result?.payload?.token).toBe('tok_test_field')
      expect(JSON.stringify(result)).not.toContain('4242424242424242')
    })
    wrapper.unmount()
  })

  it('drives field events that tokenize, update, and clear', async () => {
    const samples: Array<[object, string, Record<string, unknown>, string]> = [
      [CardNumberField, 'cardNumber', { showIcon: true }, '4242424242424242'],
      [CardExpiryField, 'cardExpiry', {}, '12/30'],
      [CardCvcField, 'cardCvc', {}, '123'],
      [IbanField, 'iban', {}, 'DE89370400440532013000'],
      [AuBankAccountField, 'auBankAccount', {}, '062000'],
      [IdealBankField, 'idealBank', {}, 'ing'],
      [FpxBankField, 'fpxBank', {}, 'maybank'],
      [EpsBankField, 'epsBank', {}, 'bank_austria'],
      [P24BankField, 'p24Bank', {}, 'ing'],
    ]
    for (const [component, type, options, sample] of samples) {
      const wrapper = await boot(component, options, type)
      const input = wrapper.find('input, select')
      if (input.exists()) {
        await input.trigger('focus')
        await input.setValue(sample)
        await input.trigger('blur')
      }
      for (const typeName of ['nexus:update', 'nexus:focus', 'nexus:blur', 'nexus:clear', 'nexus:tokenize'] as const) {
        const message = await createMessage(typeName, 'el_test', { options, clientSecret: 'cs_test' }, SECRET)
        window.dispatchEvent(new MessageEvent('message', { data: message, origin: window.location.origin, source: window.parent }))
      }
      await flushPromises()
      wrapper.unmount()
    }
  })

  it('exercises cart, link, and address interactions', async () => {
    const cart = await boot(CartField, {
      items: [{ id: '1', name: 'Nexus Pro', description: 'Plan', unit_amount: 1000, currency: 'usd', quantity: 1 }],
      shippingOptions: [{ id: 'std', displayName: 'Standard', amount: 500 }],
      allowPromoCodes: true,
    }, 'cart')
    await vi.waitFor(() => expect(cart.find('[aria-label="增加数量"]').exists()).toBe(true))
    await cart.get('[aria-label="增加数量"]').trigger('click')
    await cart.get('[aria-label="减少数量"]').trigger('click')
    await cart.get('.nexus-cart-shipping-option').trigger('click')
    await cart.get('.nexus-cart-promo-field').setValue('NOPE')
    await cart.get('.nexus-cart-promo-btn').trigger('click')
    await cart.get('[aria-label="删除商品"]').trigger('click')
    expect(cart.find('.nexus-cart-empty').exists()).toBe(true)
    cart.unmount()

    const link = await boot(LinkAuthenticationField, { mode: 'email' }, 'linkAuthentication')
    await vi.waitFor(() => expect(link.find('.nexus-link-email').exists()).toBe(true))
    await link.get('.nexus-link-email').setValue('person@example.com')
    await link.get('.nexus-link-send-btn').trigger('click')
    await vi.waitFor(() => expect(link.find('.nexus-otp-input').exists()).toBe(true), { timeout: 2000 })
    const digits = link.findAll('.nexus-otp-input')
    for (const [index, input] of digits.entries()) {
      await input.setValue(String(index + 1))
    }
    await link.get('.nexus-link-send-btn').trigger('click')
    link.unmount()

    const address = await boot(AddressField, { mode: 'shipping' }, 'address')
    const fields = address.findAll('input')
    for (const field of fields) await field.setValue('10001')
    address.unmount()
  })

  it('express checkout can cancel and payment field can collapse', async () => {
    const express = await boot(ExpressCheckoutField, { paymentMethods: { applePay: 'always' } }, 'expressCheckout')
    await express.find('[data-wallet="applePay"]').trigger('click')
    await express.find('.nexus-wallet-cancel').trigger('click')
    express.unmount()

    const payment = await boot(PaymentField, { layout: 'accordion', allowSavePaymentMethod: true }, 'payment')
    expect(payment.find('.nexus-checkbox-input').exists()).toBe(true)
    const collapse = await createMessage('nexus:collapse', 'el_test', {}, SECRET)
    window.dispatchEvent(new MessageEvent('message', { data: collapse, origin: window.location.origin, source: window.parent }))
    await vi.waitFor(() => {
      expect(payment.find('.nexus-payment-element--collapsed').exists()).toBe(true)
    })
    payment.unmount()
  })
})
