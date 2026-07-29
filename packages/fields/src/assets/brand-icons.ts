const s = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 20"'

export const BRAND_ICONS: Record<string, string> = {
  visa: `<svg ${s} width="32" height="20"><rect width="32" height="20" rx="3" fill="#1A1F71"/><text x="16" y="13.5" text-anchor="middle" fill="#FFF" font-size="9" font-weight="700" font-family="sans-serif" letter-spacing="0.5">VISA</text></svg>`,

  mastercard: `<svg ${s} width="32" height="20"><rect width="32" height="20" rx="3" fill="#252525"/><circle cx="12" cy="10" r="6" fill="#EB001B"/><circle cx="20" cy="10" r="6" fill="#F79E1B"/><path d="M16 5.2a6 6 0 0 1 0 9.6 6 6 0 0 1 0-9.6z" fill="#FF5F00"/></svg>`,

  amex: `<svg ${s} width="32" height="20"><rect width="32" height="20" rx="3" fill="#2E77BC"/><text x="16" y="13" text-anchor="middle" fill="#FFF" font-size="7" font-weight="700" font-family="sans-serif">AMEX</text></svg>`,

  discover: `<svg ${s} width="32" height="20"><rect width="32" height="20" rx="3" fill="#FF6600"/><text x="16" y="12.5" text-anchor="middle" fill="#FFF" font-size="5.5" font-weight="700" font-family="sans-serif">DISCOVER</text></svg>`,

  jcb: `<svg ${s} width="32" height="20"><rect width="32" height="20" rx="3" fill="#0E4C96"/><rect x="4" y="4" width="8" height="12" rx="2" fill="#E03227"/><rect x="12" y="4" width="8" height="12" rx="2" fill="#0E4C96" stroke="#FFF" stroke-width="0.5"/><rect x="20" y="4" width="8" height="12" rx="2" fill="#F7A21A"/><text x="16" y="13" text-anchor="middle" fill="#FFF" font-size="6" font-weight="700" font-family="sans-serif">JCB</text></svg>`,

  unionpay: `<svg ${s} width="32" height="20"><rect width="32" height="20" rx="3" fill="#E21836"/><rect x="10" y="0" width="12" height="20" fill="#00447C"/><text x="16" y="12.5" text-anchor="middle" fill="#FFF" font-size="5" font-weight="700" font-family="sans-serif">UnionPay</text></svg>`,

  diners: `<svg ${s} width="32" height="20"><rect width="32" height="20" rx="3" fill="#004B87"/><text x="16" y="12.5" text-anchor="middle" fill="#FFF" font-size="5.5" font-weight="700" font-family="sans-serif">DINERS</text></svg>`,

  elo: `<svg ${s} width="32" height="20"><rect width="32" height="20" rx="3" fill="#000"/><text x="16" y="13.5" text-anchor="middle" fill="#FFF" font-size="9" font-weight="700" font-family="sans-serif">elo</text></svg>`,

  hipercard: `<svg ${s} width="32" height="20"><rect width="32" height="20" rx="3" fill="#C6171A"/><text x="16" y="12" text-anchor="middle" fill="#FFF" font-size="4.5" font-weight="700" font-family="sans-serif">HIPERCARD</text></svg>`,

  mir: `<svg ${s} width="32" height="20"><rect width="32" height="20" rx="3" fill="#0F7541"/><rect x="16" y="0" width="16" height="20" rx="0" fill="#059669"/><text x="16" y="13" text-anchor="middle" fill="#FFF" font-size="8" font-weight="700" font-family="sans-serif">мир</text></svg>`,
}

export function getBrandIcon(brand: string): string | null {
  return BRAND_ICONS[brand] ?? null
}
