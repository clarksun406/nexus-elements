export type CardBrand =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'discover'
  | 'jcb'
  | 'unionpay'
  | 'diners'
  | 'elo'
  | 'hipercard'
  | 'mir'
  | 'unknown'

export type ElementType =
  | 'payment'
  | 'card'
  | 'cardNumber'
  | 'cardExpiry'
  | 'cardCvc'
  | 'expressCheckout'
  | 'address'
  | 'idealBank'
  | 'iban'
  | 'auBankAccount'
  | 'fpxBank'
  | 'epsBank'
  | 'p24Bank'
  | 'paymentMethodMessaging'
  | 'afterpayClearpay'
  | 'linkAuthentication'
  | 'cart'
  | 'order'
  | 'walletButton'

export type SupportedLocale =
  | 'en' | 'zh' | 'ja' | 'ko' | 'de' | 'fr' | 'es' | 'it'
  | 'pt' | 'nl' | 'pl' | 'da' | 'sv' | 'no' | 'fi' | 'ru'
  | 'ar' | 'hi' | 'th' | 'vi' | 'id' | 'ms' | 'tr'

export interface NexusOptions {
  nexusAccount?: string
  locale?: SupportedLocale
  apiBase?: string
  /** Absolute URL of the fields iframe host. Production should be a separate origin. */
  fieldsUrl?: string
  /** When set, loadNexus injects this script (defaults to the Nexus CDN if `cdn` is true). */
  scriptUrl?: string
  cdn?: boolean
  integrity?: string
}

export interface AppearanceVariables {
  colorPrimary?: string
  colorBackground?: string
  colorText?: string
  colorTextSecondary?: string
  colorDanger?: string
  colorSuccess?: string
  colorWarning?: string
  colorTextPlaceholder?: string
  colorIcon?: string
  colorIconCheckmark?: string
  colorBorder?: string
  colorBorderFocus?: string
  borderRadius?: string
  fontFamily?: string
  fontSizeBase?: string
  fontSizeSm?: string
  spacingUnit?: string
  spacingTab?: string
  spacingGridRow?: string
  spacingGridColumn?: string
  gridGutter?: string
  /** Focus outline. Applied as `--nexus-outline`. */
  outline?: string
  /** Stacking order for popovers inside the frame. Applied as `--nexus-z-index`. */
  zIndex?: string
}

export interface Appearance {
  theme?: 'stripe' | 'flat' | 'night' | 'none'
  variables?: AppearanceVariables
  rules?: Record<string, Record<string, string>>
}

export type CSSProperties = Record<string, string>

export interface ElementStyleOptions {
  base?: CSSProperties
  complete?: CSSProperties
  empty?: CSSProperties
  invalid?: CSSProperties
  focus?: CSSProperties
  disabled?: CSSProperties
}

export interface ElementsOptions {
  appearance?: Appearance
  locale?: SupportedLocale
  clientSecret?: string
  fonts?: Array<{ family: string; src: string; weight?: string; style?: string }>
}

export interface ElementStyleState {
  color?: string
  backgroundColor?: string
  fontFamily?: string
  fontSize?: string
  fontWeight?: string | number
  fontSmoothing?: string
  fontStyle?: string
  fontVariant?: string
  lineHeight?: string | number
  letterSpacing?: string
  textAlign?: string
  textDecoration?: string
  textShadow?: string
  textTransform?: string
  placeholderColor?: string
  iconColor?: string
  border?: string
  borderRadius?: string
  padding?: string
  margin?: string
  boxShadow?: string
  cursor?: string
  transition?: string
}

export interface ElementStyle {
  base?: ElementStyleState
  complete?: ElementStyleState
  empty?: ElementStyleState
  invalid?: ElementStyleState
  focus?: ElementStyleState
  disabled?: ElementStyleState
}

export type BillingDetailsFieldControl = 'auto' | 'never' | 'optional' | 'required'

export interface SavedPaymentMethod {
  id: string
  brand: string
  last4: string
  exp_month?: number
  exp_year?: number
}

export interface PaymentElementOptions {
  layout?: 'tabs' | 'accordion' | 'radio'
  defaultPaymentMethod?: string
  business?: {
    name: string
    amount: number
    currency: string
    country?: string
  }
  allowSavePaymentMethod?: boolean
  savedPaymentMethods?: SavedPaymentMethod[]
  wallets?: Array<'applePay' | 'googlePay' | 'paypal' | 'link'>
  fields?: {
    billingDetails?: {
      name?: BillingDetailsFieldControl
      email?: BillingDetailsFieldControl
      phone?: BillingDetailsFieldControl
      address?: BillingDetailsFieldControl
    }
  }
  defaultValues?: {
    billingDetails?: {
      name?: string
      email?: string
      phone?: string
      address?: {
        line1?: string
        line2?: string
        city?: string
        state?: string
        postal_code?: string
        country?: string
      }
    }
  }
}

export interface CardElementOptions {
  style?: ElementStyle
  hidePostalCode?: boolean
  hideIcon?: boolean
  showIcon?: boolean
  disabled?: boolean
  placeholder?: string
}

export interface CardNumberElementOptions extends CardElementOptions {
  brandIcon?: string
}

export interface CardExpiryElementOptions {
  style?: ElementStyle
  disabled?: boolean
  placeholder?: string
}

export interface CardCvcElementOptions {
  style?: ElementStyle
  disabled?: boolean
  placeholder?: string
}

export interface AddressElementOptions {
  mode: 'shipping' | 'billing'
  allowedCountries?: string[]
  defaultValues?: {
    name?: string
    phone?: string
    email?: string
    address?: {
      line1?: string
      line2?: string
      city?: string
      state?: string
      postal_code?: string
      country?: string
    }
  }
  fields?: {
    phone?: 'auto' | 'never' | 'optional' | 'required'
  }
}

export interface IbanElementOptions {
  style?: ElementStyle
  supportedCountries?: string[]
  placeholderCountry?: string
  disabled?: boolean
}

export interface IdealBankElementOptions {
  style?: ElementStyle
  disabled?: boolean
  placeholder?: string
}

export interface FpxBankElementOptions {
  style?: ElementStyle
  disabled?: boolean
  placeholder?: string
}

export interface EpsBankElementOptions {
  style?: ElementStyle
  disabled?: boolean
  placeholder?: string
}

export interface P24BankElementOptions {
  style?: ElementStyle
  disabled?: boolean
  placeholder?: string
}

export interface AuBankAccountElementOptions {
  style?: ElementStyle
  disabled?: boolean
}

export interface PaymentMethodMessagingElementOptions {
  amount: number
  currency: string
  paymentMethodTypes?: Array<'afterpay_clearpay' | 'klarna' | 'affirm' | 'paypal'>
  style?: 'default' | 'compact'
  countryCode?: string
  locale?: string
  showLearnMore?: boolean
}

export interface LinkAuthenticationElementOptions {
  mode?: 'phone' | 'email'
  defaultValues?: { phone?: string; email?: string }
  business?: { name: string }
  fields?: { phone?: 'auto' | 'never' | 'optional' | 'required'; email?: 'auto' | 'never' | 'optional' | 'required' }
  style?: ElementStyle
  disabled?: boolean
}

export interface CartItem {
  id: string
  name: string
  description?: string
  image?: string
  unit_amount: number
  currency: string
  quantity: number
}

export interface CartElementOptions {
  mode?: 'payment' | 'setup'
  items?: CartItem[]
  shippingOptions?: Array<{ id: string; displayName: string; amount: number }>
  taxAmount?: number
  allowPromoCodes?: boolean
  defaultPromoCode?: string
  onApplyPromoCode?: (code: string) => { discount: number; message?: string } | Promise<{ discount: number; message?: string }>
  onShippingOptionChange?: (optionId: string) => void
  onInit?: (data: { items: CartItem[]; total: number }) => void
  onChange?: (data: { items: CartItem[]; total: number; promoCode?: string; discount?: number }) => void
}

export type OrderStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'cancelled' | 'refunded'

export interface OrderTimelineEvent {
  status: OrderStatus
  timestamp: string
  description?: string
}

export interface OrderElementOptions {
  orderId?: string
  clientSecret?: string
  defaultValues?: {
    status?: OrderStatus
    items?: CartItem[]
    shippingAddress?: {
      name?: string
      phone?: string
      address?: {
        line1?: string
        line2?: string
        city?: string
        state?: string
        postal_code?: string
        country?: string
      }
    }
    paymentMethod?: {
      type?: string
      card?: {
        brand?: string
        last4?: string
        exp_month?: number
        exp_year?: number
      }
    }
    timeline?: OrderTimelineEvent[]
  }
  onRefresh?: () => Promise<void>
}

export interface AfterpayClearpayElementOptions {
  amount: number
  currency: 'USD' | 'GBP' | 'CAD' | 'AUD' | 'NZD' | 'EUR'
  locale?: 'en-US' | 'en-GB' | 'en-AU' | 'en-NZ' | 'en-CA' | 'fr-FR' | 'es-ES' | 'it-IT' | 'de-DE'
  style?: 'default' | 'compact'
  showLearnMore?: boolean
}

export interface WalletButtonElementOptions {
  wallet: 'applePay' | 'googlePay' | 'paypal' | 'link'
  buttonTheme?: 'black' | 'white' | 'white-outline'
  buttonType?: 'pay' | 'buy' | 'book' | 'donate' | 'plain'
  buttonHeight?: number
  disabled?: boolean
}

export interface ExpressCheckoutElementOptions {
  buttonTheme?: Record<string, 'black' | 'white' | 'white-outline'>
  buttonType?: Record<string, 'pay' | 'buy' | 'book' | 'donate' | 'plain'>
  buttonHeight?: number
  layout?: { maxColumns?: number; maxRows?: number; overflow?: 'auto' | 'never' }
  paymentMethods?: Record<string, 'auto' | 'always' | 'never'>
}

export type CreateElementOptions =
  | PaymentElementOptions
  | CardElementOptions
  | CardNumberElementOptions
  | CardExpiryElementOptions
  | CardCvcElementOptions
  | AddressElementOptions
  | IbanElementOptions
  | IdealBankElementOptions
  | FpxBankElementOptions
  | EpsBankElementOptions
  | P24BankElementOptions
  | AuBankAccountElementOptions
  | ExpressCheckoutElementOptions
  | PaymentMethodMessagingElementOptions
  | LinkAuthenticationElementOptions
  | CartElementOptions
  | OrderElementOptions
  | AfterpayClearpayElementOptions
  | WalletButtonElementOptions
  | Record<string, unknown>

export interface ElementError {
  type:
    | 'invalid_number'
    | 'invalid_expiry'
    | 'invalid_cvc'
    | 'incomplete_number'
    | 'incomplete_expiry'
    | 'incomplete_cvc'
    | 'invalid_iban'
    | 'incomplete_iban'
    | 'validation_error'
    | 'network_error'
  message: string
  code?: string
}

export interface ChangeEvent {
  complete: boolean
  empty: boolean
  valid: boolean
  elementType: ElementType
  brand?: CardBrand
  paymentMethodType?: string
  error?: ElementError
  value?: Record<string, string>
}

export interface ReadyEvent {
  elementType: ElementType
  availablePaymentMethods?: Record<string, boolean>
}

export interface ConfirmError {
  type: 'api_error' | 'card_error' | 'validation_error' | 'network_error'
  code?: string
  message: string
  decline_code?: string
  payment_intent?: PaymentIntent
}

export type PaymentIntentStatus =
  | 'requires_payment_method'
  | 'requires_confirmation'
  | 'requires_action'
  | 'processing'
  | 'succeeded'
  | 'canceled'

export interface PaymentIntent {
  id: string
  object: 'payment_intent'
  amount: number
  currency: string
  status: PaymentIntentStatus
  client_secret: string
  description?: string
  metadata?: Record<string, string>
}

export interface SetupIntent {
  id: string
  object: 'setup_intent'
  status: 'requires_payment_method' | 'processing' | 'succeeded' | 'canceled'
  client_secret: string
  usage?: 'off_session' | 'on_session'
}

export interface BillingDetails {
  name?: string
  email?: string
  phone?: string
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  }
}

export interface ConfirmCardPaymentParams {
  payment_method: {
    card: unknown
    billing_details?: BillingDetails
  }
  receipt_email?: string
  return_url?: string
}

export interface ConfirmPaymentParams {
  elements?: unknown
  paymentMethodId?: string
  clientSecret?: string
  confirmParams?: {
    return_url?: string
    receipt_email?: string
    payment_method_data?: {
      billing_details?: BillingDetails
    }
  }
  redirect?: 'always' | 'if_required'
}

export interface ConfirmSetupParams {
  elements: unknown
  clientSecret?: string
  confirmParams: {
    return_url: string
  }
  redirect?: 'always' | 'if_required'
}

export interface ConfirmResult<T> {
  error?: ConfirmError
  paymentIntent?: T extends 'setup' ? never : PaymentIntent
  setupIntent?: T extends 'setup' ? SetupIntent : never
}

export interface CheckoutSessionComplete {
  id: string
  status: string
  payment_intent?: string
}

export interface EmbeddedCheckoutOptions {
  clientSecret: string
  checkoutUrl?: string
  onComplete?: (session: CheckoutSessionComplete) => void
}

export interface EmbeddedCheckoutInstance {
  mount(target: string | HTMLElement): void
  unmount(): void
  destroy(): void
}

export interface CheckoutSession {
  id: string
  url: string
  success_url?: string
  cancel_url?: string
}

export type ElementEventType =
  | 'ready'
  | 'change'
  | 'focus'
  | 'blur'
  | 'input'
  | 'error'
  | 'escape'
  | 'click'
  | 'confirm'
  | 'cancel'
  | 'loaderror'
