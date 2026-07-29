import { ref, computed } from 'vue'
import { validateCardNumber, validateCardExpiry, validateCardCvc } from '../validation'
import { formatCardNumber, formatExpiry, formatCvc, detectBrand } from '../validation/format'
import { getBrandRule } from '../validation/brands'
import { validationMessages } from '../i18n'
import type { CardBrand } from '../validation/brands'

export function useCardInputs() {
  const number = ref('')
  const expiry = ref('')
  const cvc = ref('')

  const brand = computed<CardBrand>(() => detectBrand(number.value))

  let navigateCb: ((direction: 'prev' | 'next') => void) | null = null
  function setNavigationCallback(cb: ((direction: 'prev' | 'next') => void) | null) {
    navigateCb = cb
  }
  function navigate(direction: 'prev' | 'next') {
    navigateCb?.(direction)
  }

  const numberValidation = computed(() => validateCardNumber(number.value, validationMessages.value))
  const expiryValidation = computed(() => validateCardExpiry(expiry.value, validationMessages.value))
  const cvcValidation = computed(() => validateCardCvc(cvc.value, brand.value, validationMessages.value))

  const isComplete = computed(() =>
    numberValidation.value.isComplete && expiryValidation.value.isComplete && cvcValidation.value.isComplete,
  )
  const isValid = computed(() =>
    numberValidation.value.isValid && expiryValidation.value.isValid && cvcValidation.value.isValid,
  )
  const isEmpty = computed(() => !number.value && !expiry.value && !cvc.value)

  const currentError = computed(() => {
    if (numberValidation.value.error && numberValidation.value.isComplete) return numberValidation.value.error
    if (expiryValidation.value.error && expiryValidation.value.isComplete) return expiryValidation.value.error
    if (cvcValidation.value.error && cvcValidation.value.isComplete) return cvcValidation.value.error
    return undefined
  })

  function onNumberInput(event: Event) {
    const target = event.target as HTMLInputElement
    const cursor = target.selectionStart ?? 0
    const prevLength = number.value.length
    number.value = formatCardNumber(target.value)
    const delta = number.value.length - prevLength
    requestAnimationFrame(() => {
      target.setSelectionRange(cursor + delta, cursor + delta)
    })
  }

  function onExpiryInput(event: Event) {
    const target = event.target as HTMLInputElement
    const cursor = target.selectionStart ?? 0
    const prevLength = expiry.value.length
    expiry.value = formatExpiry(target.value)
    const delta = expiry.value.length - prevLength
    requestAnimationFrame(() => {
      target.setSelectionRange(cursor + delta, cursor + delta)
    })
  }

  function onCvcInput(event: Event) {
    const target = event.target as HTMLInputElement
    cvc.value = formatCvc(target.value, brand.value)
  }

  function onPaste(event: ClipboardEvent) {
    event.preventDefault()
    const text = event.clipboardData?.getData('text') ?? ''
    const digits = text.replace(/\D/g, '')

    if (digits.length >= 13) {
      const detectedBrand = detectBrand(digits)
      const rule = getBrandRule(detectedBrand === 'unknown' ? '' : detectedBrand)
      const numberLen = detectedBrand === 'amex' ? 15 : Math.min(...rule.lengths)
      number.value = formatCardNumber(digits.slice(0, numberLen))
      const remaining = digits.slice(numberLen)
      if (remaining.length >= 4) {
        expiry.value = formatExpiry(remaining.slice(0, 4))
        cvc.value = formatCvc(remaining.slice(4), brand.value)
      }
    } else {
      const target = event.target as HTMLInputElement
      if (target.classList.contains('nexus-number')) {
        number.value = formatCardNumber(number.value.replace(/\D/g, '') + digits)
      } else if (target.classList.contains('nexus-expiry')) {
        expiry.value = formatExpiry(expiry.value.replace(/\D/g, '') + digits)
      } else {
        cvc.value = formatCvc(cvc.value.replace(/\D/g, '') + digits, brand.value)
      }
    }
  }

  function onNumberKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLInputElement
    if (event.key === 'ArrowRight' && target.selectionStart === target.value.length) {
      navigate('next')
    }
  }

  function onExpiryKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLInputElement
    if (event.key === 'Backspace' && target.selectionStart === 0 && target.selectionEnd === 0) {
      navigate('prev')
    } else if (event.key === 'ArrowLeft' && target.selectionStart === 0) {
      navigate('prev')
    } else if (event.key === 'ArrowRight' && target.selectionStart === target.value.length) {
      navigate('next')
    }
  }

  function onCvcKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLInputElement
    if (event.key === 'Backspace' && target.selectionStart === 0 && target.selectionEnd === 0) {
      navigate('prev')
    } else if (event.key === 'ArrowLeft' && target.selectionStart === 0) {
      navigate('prev')
    }
  }

  function clear() {
    number.value = ''
    expiry.value = ''
    cvc.value = ''
  }

  return {
    number,
    expiry,
    cvc,
    brand,
    numberValidation,
    expiryValidation,
    cvcValidation,
    isComplete,
    isValid,
    isEmpty,
    currentError,
    onNumberInput,
    onExpiryInput,
    onCvcInput,
    onNumberKeydown,
    onExpiryKeydown,
    onCvcKeydown,
    onPaste,
    setNavigationCallback,
    clear,
  }
}
