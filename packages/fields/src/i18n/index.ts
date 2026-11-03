import { computed, ref } from 'vue'
import type { ValidationMessages } from '../validation'
import { extraEn, type ExtraMessages } from './extra'

export type FieldsLocale = 'en' | 'zh' | 'ja' | 'ko' | 'de' | 'fr' | 'es' | 'it' | 'pt' | 'nl' | 'pl' | 'da' | 'sv' | 'no' | 'fi' | 'ru' | 'ar' | 'hi' | 'th' | 'vi' | 'id' | 'ms' | 'tr'

export interface Dictionary {
  cardInvalid: string
  cardIncomplete: string
  expiryInvalid: string
  expiryIncomplete: string
  expiryPast: string
  cvcInvalid: string
  cvcIncomplete: string
  ibanInvalid: string
  ibanIncomplete: string
  bsbInvalid: string
  bsbIncomplete: string
  accountIncomplete: string
  cardNumberLabel: string
  expiryLabel: string
  cvcLabel: string
  expiryPlaceholder: string
  cvcPlaceholder: string
  methodCard: string
  selectBankLabel: string
  selectBankPlaceholder: string
  ibanLabel: string
  bsbLabel: string
  accountNumberLabel: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  postalCode: string
  country: string
  fullName: string
  phone: string
  postalInvalid: string
  savedCards: string
  useNewMethod: string
  emailLabel: string
  emailInvalid: string
  billingIncomplete: string
  optionalSuffix: string
  cartEmpty: string
  cartEmptySub: string
  cartShipping: string
  cartPromoLabel: string
  cartPromoPlaceholder: string
  cartPromoApply: string
  cartPromoInvalid: string
  cartSubtotal: string
  cartShippingCost: string
  cartTax: string
  cartDiscount: string
  cartTotal: string
  cartFreeShipping: string
  orderNoInfo: string
  orderNoInfoSub: string
  orderLabel: string
  orderItems: string
  orderPayment: string
  orderAddress: string
  orderTimeline: string
  orderStatusPending: string
  orderStatusProcessing: string
  orderStatusPaid: string
  orderStatusFailed: string
  orderStatusCancelled: string
  orderStatusRefunded: string
  apcEmpty: string
  apcOverLimit: string
  apcMessage: string
  apcBrandAfterpay: string
  apcBrandClearpay: string
  apcLearnMore: string
  linkPhoneLabel: string
  linkEmailLabel: string
  linkSendCode: string
  linkResendCode: string
  linkVerify: string
  linkVerified: string
  linkCountdown: string
}

export type Messages = Dictionary & ExtraMessages

export const en: Dictionary = {
  cardInvalid: 'Your card number is invalid.',
  cardIncomplete: 'Your card number is incomplete.',
  expiryInvalid: "Your card's expiration date is invalid.",
  expiryIncomplete: "Your card's expiration date is incomplete.",
  expiryPast: "Your card's expiration date is in the past.",
  cvcInvalid: "Your card's security code is invalid.",
  cvcIncomplete: "Your card's security code is incomplete.",
  ibanInvalid: 'Invalid IBAN.',
  ibanIncomplete: 'IBAN is incomplete.',
  bsbInvalid: 'BSB number is invalid.',
  bsbIncomplete: 'BSB number is incomplete.',
  accountIncomplete: 'Account number is incomplete.',
  cardNumberLabel: 'Card number',
  expiryLabel: 'Expiration date',
  cvcLabel: 'Security code',
  expiryPlaceholder: 'MM / YY',
  cvcPlaceholder: 'CVC',
  methodCard: 'Card',
  selectBankLabel: 'Select your bank',
  selectBankPlaceholder: '— Select your bank —',
  ibanLabel: 'IBAN',
  bsbLabel: 'BSB',
  accountNumberLabel: 'Account number',
  addressLine1: 'Address line 1',
  addressLine2: 'Address line 2',
  city: 'City',
  state: 'State',
  postalCode: 'Postal code',
  country: 'Country',
  fullName: 'Full name',
  phone: 'Phone',
  postalInvalid: 'Your postal code is invalid.',
  savedCards: 'Saved payment methods',
  useNewMethod: 'Use a new payment method',
  emailLabel: 'Email',
  emailInvalid: 'Your email address is invalid.',
  billingIncomplete: 'Your billing details are incomplete.',
  optionalSuffix: 'optional',
  cartEmpty: 'Your cart is empty',
  cartEmptySub: 'Your cart is empty',
  cartShipping: 'Shipping',
  cartPromoLabel: 'Promo code',
  cartPromoPlaceholder: 'Enter promo code',
  cartPromoApply: 'Apply',
  cartPromoInvalid: 'Invalid promo code',
  cartSubtotal: 'Subtotal',
  cartShippingCost: 'Shipping',
  cartTax: 'Tax',
  cartDiscount: 'Discount',
  cartTotal: 'Total',
  cartFreeShipping: 'Free',
  orderNoInfo: 'No order information available',
  orderNoInfoSub: 'No order information available',
  orderLabel: 'Order',
  orderItems: 'Items',
  orderPayment: 'Payment method',
  orderAddress: 'Shipping address',
  orderTimeline: 'Timeline',
  orderStatusPending: 'Pending',
  orderStatusProcessing: 'Processing',
  orderStatusPaid: 'Paid',
  orderStatusFailed: 'Failed',
  orderStatusCancelled: 'Cancelled',
  orderStatusRefunded: 'Refunded',
  apcEmpty: 'Enter an amount to see installment info',
  apcOverLimit: 'This amount exceeds the {brand} limit (max {max}).',
  apcMessage: 'or 4 interest-free payments of {amount} with {brand}',
  apcBrandAfterpay: 'Afterpay',
  apcBrandClearpay: 'Clearpay',
  apcLearnMore: 'Learn more',
  linkPhoneLabel: 'Phone',
  linkEmailLabel: 'Email',
  linkSendCode: 'Send code',
  linkResendCode: 'Resend code',
  linkVerify: 'Verify',
  linkVerified: 'Verified',
  linkCountdown: 'Resend in {seconds}s',
}

type LocaleModule = { default: Dictionary }

const LOADERS: Record<Exclude<FieldsLocale, 'en'>, () => Promise<LocaleModule>> = {
  zh: () => import('./locales/zh'),
  ja: () => import('./locales/ja'),
  ko: () => import('./locales/ko'),
  de: () => import('./locales/de'),
  fr: () => import('./locales/fr'),
  es: () => import('./locales/es'),
  it: () => import('./locales/it'),
  pt: () => import('./locales/pt'),
  nl: () => import('./locales/nl'),
  pl: () => import('./locales/pl'),
  da: () => import('./locales/da'),
  sv: () => import('./locales/sv'),
  no: () => import('./locales/no'),
  fi: () => import('./locales/fi'),
  ru: () => import('./locales/ru'),
  ar: () => import('./locales/ar'),
  hi: () => import('./locales/hi'),
  th: () => import('./locales/th'),
  vi: () => import('./locales/vi'),
  id: () => import('./locales/id'),
  ms: () => import('./locales/ms'),
  tr: () => import('./locales/tr'),
}

const loaded = new Map<FieldsLocale, Dictionary>()
loaded.set('en', en)

export const localeRevision = ref(0)

export const locale = ref<FieldsLocale>('en')

const LOCALE_MAP: Record<string, FieldsLocale> = {
  zh: 'zh', ja: 'ja', ko: 'ko', de: 'de', fr: 'fr', es: 'es', it: 'it', pt: 'pt', nl: 'nl',
  pl: 'pl', da: 'da', sv: 'sv', no: 'no', fi: 'fi', ru: 'ru', ar: 'ar', hi: 'hi',
  th: 'th', vi: 'vi', id: 'id', ms: 'ms', tr: 'tr',
}

export function resolveLocale(value: string | undefined): FieldsLocale {
  if (!value) return 'en'
  const prefix = value.toLowerCase().split(/[-_]/)[0]
  if (!prefix) return 'en'
  return LOCALE_MAP[prefix] ?? 'en'
}

export function setLocale(value: string | undefined): void {
  locale.value = resolveLocale(value)
}

/** Load the active locale dictionary. English is synchronous; others are fetched once. */
export async function ensureLocale(value: string | undefined): Promise<void> {
  const next = resolveLocale(value)
  locale.value = next
  if (loaded.has(next)) return
  const mod = await LOADERS[next as Exclude<FieldsLocale, 'en'>]()
  loaded.set(next, mod.default)
  localeRevision.value++
}

export function messageKeyCount(): number {
  return Object.keys(en).length + Object.keys(extraEn).length
}

export function t<K extends keyof Messages>(key: K): string {
  localeRevision.value
  const dict = loaded.get(locale.value)
  const fromLocale = dict?.[key as keyof Dictionary]
  if (typeof fromLocale === 'string') return fromLocale
  const fromEn = en[key as keyof Dictionary]
  if (typeof fromEn === 'string') return fromEn
  return extraEn[key as keyof ExtraMessages]
}

export const validationMessages = computed<ValidationMessages>(() => {
  localeRevision.value
  const dict = loaded.get(locale.value) ?? en
  return {
    cardInvalid: dict.cardInvalid,
    cardIncomplete: dict.cardIncomplete,
    expiryInvalid: dict.expiryInvalid,
    expiryIncomplete: dict.expiryIncomplete,
    expiryPast: dict.expiryPast,
    cvcInvalid: dict.cvcInvalid,
    cvcIncomplete: dict.cvcIncomplete,
    ibanInvalid: dict.ibanInvalid,
    ibanIncomplete: dict.ibanIncomplete,
  }
})
