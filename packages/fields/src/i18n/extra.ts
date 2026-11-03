/** Additional UI strings. Locales fall back to English until translated. */
export interface ExtraMessages {
  ariaCardNumber: string
  ariaExpiry: string
  ariaCvc: string
  ariaPostal: string
  ariaBrandIcon: string
  ariaError: string
  ariaSecureFrame: string
  ariaLoading: string
  ariaRequired: string
  ariaOptional: string
  ariaSaveCard: string
  ariaCancelWallet: string
  ariaOrderStatus: string
  walletApplePay: string
  walletGooglePay: string
  walletPaypal: string
  walletLink: string
  walletPayWith: string
  walletBuyWith: string
  walletBookWith: string
  walletDonateWith: string
  walletCancel: string
  walletProcessing: string
  walletSuccess: string
  walletFailed: string
  walletUnavailable: string
  walletMockNotice: string
  actionPay: string
  actionSave: string
  actionClear: string
  actionCancel: string
  actionClose: string
  actionContinue: string
  actionBack: string
  actionConfirm: string
  actionRetry: string
  actionLoading: string
  actionProcessing: string
  networkError: string
  tokenFailed: string
  validationError: string
  incompleteCard: string
  expiredCard: string
  declinedCard: string
  authRequired: string
  sessionExpired: string
  unknownError: string
  tryAgain: string
  invalidPostal: string
  postalRequired: string
  bankRequired: string
  emailRequired: string
  phoneRequired: string
  nameRequired: string
  linkTitle: string
  linkSubtitle: string
  linkEmailPlaceholder: string
  linkUseLink: string
  linkOrPayAnotherWay: string
  linkEmbeddedHint: string
  expressTitle: string
  expressCancel: string
  expressHorizontal: string
  expressVertical: string
  orderRefresh: string
  orderPolling: string
  orderUpdated: string
  orderEmptyItems: string
  cartQuantity: string
  cartRemove: string
  cartEach: string
  cartEstimatedTax: string
  cartPromoApplied: string
  threeDsTitle: string
  threeDsHint: string
  threeDsRequired: string
  saveCard: string
  saveCardHint: string
  newCard: string
  savedMethod: string
  accordionExpand: string
  accordionCollapse: string
  tabListLabel: string
  billingName: string
  billingEmail: string
  billingPhone: string
  billingAddress: string
  checkoutTotal: string
  checkoutPay: string
  checkoutSuccess: string
  checkoutFailed: string
  fieldEmpty: string
  fieldComplete: string
  fieldInvalid: string
  securityNotice: string
  encryptedNotice: string
  testMode: string
  cardBrandVisa: string
  cardBrandMastercard: string
  cardBrandAmex: string
  cardBrandDiscover: string
  cardBrandJcb: string
  cardBrandUnionpay: string
  cardBrandDiners: string
  cardBrandUnknown: string
  declineGeneric: string
  declineInsufficient: string
  declineLost: string
  declineStolen: string
  declineCvc: string
  declineProcessing: string
  cvcHint: string
  cvcHintAmex: string
  expiryMonth: string
  expiryYear: string
  idealSearch: string
  bankSearchPlaceholder: string
  noBankResults: string
  ibanHint: string
  ibanCountry: string
  auBsbHint: string
  linkOtpLabel: string
  linkOtpIncomplete: string
  linkCodeSent: string
  linkInvalidCode: string
  loadErrorTitle: string
  loadErrorRetry: string
  frameTimeout: string
  collapseSummary: string
  expandSummary: string
  fetchUpdates: string
  updatesAvailable: string
  orderSyncing: string
  postalPlaceholder: string
  optionalField: string
  requiredField: string
  walletButtonPay: string
  walletButtonBuy: string
  walletButtonBook: string
  walletButtonDonate: string
  expressOverflow: string
  afterpayInstallment: string
  klarnaMessage: string
  affirmMessage: string
  shippingTo: string
  paymentOf: string
  timelineEmpty: string
  fpxLabel: string
  epsLabel: string
  p24Label: string
  poweredBy: string
  liveMode: string
  hidePostal: string
  showIcon: string
  disabledField: string
}

export const extraEn: ExtraMessages = {
  ariaCardNumber: 'Card number',
  ariaExpiry: 'Expiration date',
  ariaCvc: 'Security code',
  ariaPostal: 'Postal code',
  ariaBrandIcon: 'Card brand',
  ariaError: 'Error',
  ariaSecureFrame: 'Secure payment field',
  ariaLoading: 'Loading',
  ariaRequired: 'required',
  ariaOptional: 'optional',
  ariaSaveCard: 'Save card for future payments',
  ariaCancelWallet: 'Cancel wallet payment',
  ariaOrderStatus: 'Order status',
  walletApplePay: 'Apple Pay',
  walletGooglePay: 'Google Pay',
  walletPaypal: 'PayPal',
  walletLink: 'Link',
  walletPayWith: 'Pay with',
  walletBuyWith: 'Buy with',
  walletBookWith: 'Book with',
  walletDonateWith: 'Donate with',
  walletCancel: 'Cancel',
  walletProcessing: 'Processing',
  walletSuccess: 'Payment approved',
  walletFailed: 'Payment failed',
  walletUnavailable: 'Unavailable on this device',
  walletMockNotice: 'Wallet preview',
  actionPay: 'Pay',
  actionSave: 'Save',
  actionClear: 'Clear',
  actionCancel: 'Cancel',
  actionClose: 'Close',
  actionContinue: 'Continue',
  actionBack: 'Back',
  actionConfirm: 'Confirm',
  actionRetry: 'Retry',
  actionLoading: 'Loading',
  actionProcessing: 'Processing',
  networkError: 'A network error occurred.',
  tokenFailed: 'Tokenization failed.',
  validationError: 'Please check your details.',
  incompleteCard: 'Your card details are incomplete.',
  expiredCard: 'Your card has expired.',
  declinedCard: 'Your card was declined.',
  authRequired: 'Additional authentication is required.',
  sessionExpired: 'This session has expired.',
  unknownError: 'Something went wrong.',
  tryAgain: 'Please try again.',
  invalidPostal: 'Your postal code is invalid.',
  postalRequired: 'Postal code is required.',
  bankRequired: 'Please select your bank.',
  emailRequired: 'Email is required.',
  phoneRequired: 'Phone number is required.',
  nameRequired: 'Name is required.',
  linkTitle: 'Link',
  linkSubtitle: 'Check out faster next time',
  linkEmailPlaceholder: 'email@example.com',
  linkUseLink: 'Pay with Link',
  linkOrPayAnotherWay: 'Or pay another way',
  linkEmbeddedHint: 'We will look up your saved Link details.',
  expressTitle: 'Express checkout',
  expressCancel: 'Cancel',
  expressHorizontal: 'Horizontal',
  expressVertical: 'Vertical',
  orderRefresh: 'Refresh order',
  orderPolling: 'Checking for updates',
  orderUpdated: 'Order updated',
  orderEmptyItems: 'No items',
  cartQuantity: 'Quantity',
  cartRemove: 'Remove',
  cartEach: 'each',
  cartEstimatedTax: 'Estimated tax',
  cartPromoApplied: 'Promo applied',
  threeDsTitle: 'Authentication required',
  threeDsHint: 'Your bank needs to verify this payment.',
  threeDsRequired: '3D Secure',
  saveCard: 'Save this card',
  saveCardHint: 'Store this card for future payments',
  newCard: 'New card',
  savedMethod: 'Saved method',
  accordionExpand: 'Show',
  accordionCollapse: 'Hide',
  tabListLabel: 'Payment methods',
  billingName: 'Name',
  billingEmail: 'Email',
  billingPhone: 'Phone',
  billingAddress: 'Billing address',
  checkoutTotal: 'Total',
  checkoutPay: 'Pay',
  checkoutSuccess: 'Payment successful',
  checkoutFailed: 'Payment failed',
  fieldEmpty: 'Empty',
  fieldComplete: 'Complete',
  fieldInvalid: 'Invalid',
  securityNotice: 'Payments are encrypted and processed in a secure frame.',
  encryptedNotice: 'Card details are encrypted before they leave this frame.',
  testMode: 'Test mode',
  cardBrandVisa: 'Visa',
  cardBrandMastercard: 'Mastercard',
  cardBrandAmex: 'American Express',
  cardBrandDiscover: 'Discover',
  cardBrandJcb: 'JCB',
  cardBrandUnionpay: 'UnionPay',
  cardBrandDiners: 'Diners Club',
  cardBrandUnknown: 'Card',
  declineGeneric: 'The card was declined.',
  declineInsufficient: 'Insufficient funds.',
  declineLost: 'The card was reported lost.',
  declineStolen: 'The card was reported stolen.',
  declineCvc: 'The security code is incorrect.',
  declineProcessing: 'The issuer could not process this payment.',
  cvcHint: '3 digits on the back of the card',
  cvcHintAmex: '4 digits on the front of the card',
  expiryMonth: 'Month',
  expiryYear: 'Year',
  idealSearch: 'Search banks',
  bankSearchPlaceholder: 'Search',
  noBankResults: 'No banks match your search.',
  ibanHint: 'Enter the full IBAN',
  ibanCountry: 'Country',
  auBsbHint: '6-digit BSB',
  linkOtpLabel: 'Verification code',
  linkOtpIncomplete: 'Enter the 6-digit code.',
  linkCodeSent: 'Code sent',
  linkInvalidCode: 'That code is incorrect.',
  loadErrorTitle: 'This field could not be loaded.',
  loadErrorRetry: 'Retry',
  frameTimeout: 'The secure field took too long to load.',
  collapseSummary: 'Collapse',
  expandSummary: 'Expand',
  fetchUpdates: 'Refresh',
  updatesAvailable: 'Updates available',
  orderSyncing: 'Syncing order',
  postalPlaceholder: 'Postal code',
  optionalField: 'Optional',
  requiredField: 'Required',
  walletButtonPay: 'Pay',
  walletButtonBuy: 'Buy',
  walletButtonBook: 'Book',
  walletButtonDonate: 'Donate',
  expressOverflow: 'More wallets',
  afterpayInstallment: 'Pay in 4 interest-free installments',
  klarnaMessage: 'Pay later with Klarna',
  affirmMessage: 'Pay over time with Affirm',
  shippingTo: 'Shipping to',
  paymentOf: 'Payment of',
  timelineEmpty: 'No timeline events',
  fpxLabel: 'FPX',
  epsLabel: 'EPS',
  p24Label: 'Przelewy24',
  poweredBy: 'Powered by Nexus',
  liveMode: 'Live',
  hidePostal: 'Hide postal code',
  showIcon: 'Show brand icon',
  disabledField: 'This field is disabled',
}
