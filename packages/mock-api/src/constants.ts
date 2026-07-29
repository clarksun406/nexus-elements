export const DECLINE_CARDS: Record<string, { code: string; decline_code: string; message: string }> = {
  '4000000000009995': { code: 'card_declined', decline_code: 'insufficient_funds', message: '您的卡余额不足，请更换支付方式。' },
  '4000000000000002': { code: 'card_declined', decline_code: 'generic_decline', message: '您的卡被拒绝，请联系发卡行。' },
  '4000000000000069': { code: 'expired_card', decline_code: 'expired_card', message: '您的卡已过期。' },
  '4000000000000127': { code: 'incorrect_cvc', decline_code: 'incorrect_cvc', message: '您的卡安全码错误。' },
}

export const THREE_DS_CARD = '4000000000003220'

export const SAVED_PAYMENT_METHODS = [
  { id: 'pm_saved_1', object: 'payment_method', type: 'card', card: { brand: 'visa', last4: '4242', exp_month: 12, exp_year: 2028 } },
  { id: 'pm_saved_2', object: 'payment_method', type: 'card', card: { brand: 'mastercard', last4: '4444', exp_month: 6, exp_year: 2027 } },
]
