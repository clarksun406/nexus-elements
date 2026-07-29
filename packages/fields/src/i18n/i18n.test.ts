import { describe, expect, it, beforeEach } from 'vitest'
import { t, setLocale, locale, validationMessages } from './index'

describe('i18n', () => {
  beforeEach(() => {
    setLocale('en')
  })

  describe('setLocale', () => {
    it('defaults to en for undefined', () => {
      setLocale(undefined)
      expect(locale.value).toBe('en')
    })

    it('sets zh for zh-CN', () => {
      setLocale('zh-CN')
      expect(locale.value).toBe('zh')
    })

    it('sets zh for zh', () => {
      setLocale('zh')
      expect(locale.value).toBe('zh')
    })

    it('falls back to en for unknown locale', () => {
      setLocale('xx')
      expect(locale.value).toBe('en')
    })

    it('is case-insensitive', () => {
      setLocale('ZH-TW')
      expect(locale.value).toBe('zh')
    })

    it.each([
      ['ja-JP', 'ja'],
      ['ko-KR', 'ko'],
      ['de-AT', 'de'],
      ['fr-CA', 'fr'],
      ['es-MX', 'es'],
      ['it-IT', 'it'],
      ['pt-BR', 'pt'],
      ['nl-BE', 'nl'],
    ])('resolves %s to %s', (input, expected) => {
      setLocale(input)
      expect(locale.value).toBe(expected)
    })
  })

  describe('t()', () => {
    it('returns English strings by default', () => {
      expect(t('cardInvalid')).toBe('Your card number is invalid.')
      expect(t('cvcLabel')).toBe('Security code')
    })

    it('returns Chinese strings after setLocale("zh")', () => {
      setLocale('zh')
      expect(t('cardInvalid')).toBeTruthy()
      expect(t('cardInvalid')).not.toBe('Your card number is invalid.')
    })

    it.each(['ja', 'ko', 'de', 'fr', 'es', 'it', 'pt', 'nl'])(
      'returns non-English strings for locale "%s"',
      (loc) => {
        setLocale(loc)
        expect(t('cardInvalid')).toBeTruthy()
        expect(t('cardInvalid')).not.toBe('Your card number is invalid.')
      },
    )

    it('returns a non-empty string for every key', () => {
      const keys: (keyof import('./index').Dictionary)[] = [
        'cardInvalid', 'cardIncomplete', 'expiryInvalid', 'expiryIncomplete',
        'expiryPast', 'cvcInvalid', 'cvcIncomplete', 'ibanInvalid', 'ibanIncomplete',
        'bsbInvalid', 'bsbIncomplete', 'accountIncomplete',
        'cardNumberLabel', 'expiryLabel', 'cvcLabel',
        'selectBankLabel', 'ibanLabel', 'bsbLabel', 'accountNumberLabel',
        'cartEmpty', 'cartTotal', 'orderLabel', 'orderItems',
        'apcMessage', 'linkPhoneLabel', 'linkEmailLabel',
      ]
      for (const key of keys) {
        expect(t(key)).toBeTruthy()
      }
    })
  })

  describe('validationMessages', () => {
    it('returns English messages by default', () => {
      expect(validationMessages.value.cardInvalid).toBe('Your card number is invalid.')
    })

    it('switches to Chinese messages', () => {
      setLocale('zh')
      expect(validationMessages.value.cardInvalid).not.toBe('Your card number is invalid.')
    })

    it('contains all 9 validation message keys', () => {
      const keys = Object.keys(validationMessages.value)
      expect(keys).toContain('cardInvalid')
      expect(keys).toContain('cardIncomplete')
      expect(keys).toContain('expiryInvalid')
      expect(keys).toContain('expiryIncomplete')
      expect(keys).toContain('expiryPast')
      expect(keys).toContain('cvcInvalid')
      expect(keys).toContain('cvcIncomplete')
      expect(keys).toContain('ibanInvalid')
      expect(keys).toContain('ibanIncomplete')
    })
  })
})
