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

export interface BinRule {
  brand: CardBrand
  patterns: Array<[number, number]>
  lengths: number[]
  cvcLength: number
  luhn: boolean
  gaps: number[]
}

const BIN_RULES: BinRule[] = [
  { brand: 'amex', patterns: [[34, 34], [37, 37]], lengths: [15], cvcLength: 4, luhn: true, gaps: [4, 10] },
  { brand: 'visa', patterns: [[4, 4]], lengths: [13, 16, 19], cvcLength: 3, luhn: true, gaps: [4, 8, 12] },
  { brand: 'mastercard', patterns: [[51, 55], [2221, 2720]], lengths: [16], cvcLength: 3, luhn: true, gaps: [4, 8, 12] },
  { brand: 'discover', patterns: [[6011, 6011], [644, 649], [65, 65]], lengths: [16, 19], cvcLength: 3, luhn: true, gaps: [4, 8, 12] },
  { brand: 'jcb', patterns: [[3528, 3589]], lengths: [16, 17, 18, 19], cvcLength: 3, luhn: true, gaps: [4, 8, 12] },
  { brand: 'unionpay', patterns: [[62, 62], [81, 81]], lengths: [16, 17, 18, 19], cvcLength: 3, luhn: false, gaps: [4, 8, 12] },
  { brand: 'diners', patterns: [[300, 305], [36, 36], [38, 39]], lengths: [14, 16, 19], cvcLength: 3, luhn: true, gaps: [4, 8, 12] },
  { brand: 'elo', patterns: [[401178, 401178], [401179, 401179], [438935, 438935], [457631, 457632], [504175, 504175], [627780, 627780], [636297, 636297], [636368, 636369], [650031, 650033], [650035, 650051], [650405, 650439], [650485, 650538], [650541, 650598], [650700, 650718], [650720, 650727], [650901, 650978], [651652, 651679], [655000, 655019], [655021, 655058]], lengths: [16], cvcLength: 3, luhn: true, gaps: [4, 8, 12] },
  { brand: 'hipercard', patterns: [[606282, 606282]], lengths: [16], cvcLength: 3, luhn: true, gaps: [4, 8, 12] },
  { brand: 'mir', patterns: [[2200, 2204]], lengths: [16, 17, 18, 19], cvcLength: 3, luhn: true, gaps: [4, 8, 12] },
]

const DEFAULT_RULE: BinRule = {
  brand: 'unknown',
  patterns: [],
  lengths: [16, 17, 18, 19],
  cvcLength: 3,
  luhn: true,
  gaps: [4, 8, 12],
}

export function getBrandRule(digitsOrBrand: string): BinRule {
  if (!digitsOrBrand) return DEFAULT_RULE

  // Direct brand name lookup (for CVC length queries)
  const asBrand = BIN_RULES.find((r) => r.brand === digitsOrBrand)
  if (asBrand) return asBrand

  const digits = digitsOrBrand.replace(/\D/g, '')
  if (!digits) return DEFAULT_RULE

  for (const rule of BIN_RULES) {
    for (const [start, end] of rule.patterns) {
      const prefixLength = String(start).length
      if (digits.length >= prefixLength) {
        const prefix = parseInt(digits.slice(0, prefixLength), 10)
        if (prefix >= start && prefix <= end) {
          return rule
        }
      }
    }
  }

  return DEFAULT_RULE
}

export function detectBrandFromNumber(digits: string): CardBrand {
  return getBrandRule(digits).brand
}
