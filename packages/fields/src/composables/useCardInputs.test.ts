/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import { useCardInputs } from './useCardInputs'

describe('useCardInputs', () => {
  it('starts empty', () => {
    const { number, expiry, cvc, isEmpty, isComplete, isValid, currentError } = useCardInputs()
    expect(number.value).toBe('')
    expect(expiry.value).toBe('')
    expect(cvc.value).toBe('')
    expect(isEmpty.value).toBe(true)
    expect(isComplete.value).toBe(false)
    expect(isValid.value).toBe(false)
    expect(currentError.value).toBeUndefined()
  })

  it('detects brand from number input', () => {
    const { number, brand } = useCardInputs()
    number.value = '4242'
    expect(brand.value).toBe('visa')
    number.value = '3782'
    expect(brand.value).toBe('amex')
    number.value = '5555'
    expect(brand.value).toBe('mastercard')
  })

  it('validates a complete valid card', () => {
    const { number, expiry, cvc, isComplete, isValid } = useCardInputs()
    number.value = '4242424242424242'
    const currentYear = new Date().getFullYear()
    const futureYY = String((currentYear + 2) % 100).padStart(2, '0')
    expiry.value = `12/${futureYY}`
    cvc.value = '123'
    expect(isComplete.value).toBe(true)
    expect(isValid.value).toBe(true)
  })

  it('reports incomplete for partial input', () => {
    const { number, expiry, isComplete } = useCardInputs()
    number.value = '4242'
    expect(isComplete.value).toBe(false)
    expiry.value = '12/'
    expect(isComplete.value).toBe(false)
  })

  it('reports error for invalid number', () => {
    const { number, currentError } = useCardInputs()
    number.value = '4242424242424241'
    expect(currentError.value).toBeTruthy()
    expect(currentError.value?.field).toBe('cardNumber')
  })

  it('reports error for past expiry', () => {
    const { number, expiry, currentError } = useCardInputs()
    number.value = '4242424242424242'
    expiry.value = '01/20'
    expect(currentError.value).toBeTruthy()
    expect(currentError.value?.field).toBe('cardExpiry')
    expect(currentError.value?.type).toBe('expired')
  })

  it('reports error for wrong cvc length', () => {
    const { number, expiry, cvc, currentError } = useCardInputs()
    number.value = '4242424242424242'
    const currentYear = new Date().getFullYear()
    const futureYY = String((currentYear + 2) % 100).padStart(2, '0')
    expiry.value = `12/${futureYY}`
    cvc.value = '1234'
    expect(currentError.value).toBeTruthy()
    expect(currentError.value?.field).toBe('cardCvc')
    expect(currentError.value?.type).toBe('length')
  })

  it('clear() resets all fields', () => {
    const { number, expiry, cvc, isEmpty, clear } = useCardInputs()
    number.value = '4242424242424242'
    expiry.value = '12/30'
    cvc.value = '123'
    clear()
    expect(number.value).toBe('')
    expect(expiry.value).toBe('')
    expect(cvc.value).toBe('')
    expect(isEmpty.value).toBe(true)
  })

  it('onNumberInput formats card number', () => {
    const { number, onNumberInput } = useCardInputs()
    const input = document.createElement('input')
    input.value = '4242424242424242'
    Object.defineProperty(input, 'selectionStart', { value: 16 })
    onNumberInput({ target: input } as unknown as Event)
    expect(number.value).toBe('4242 4242 4242 4242')
  })

  it('onExpiryInput formats expiry', () => {
    const { expiry, onExpiryInput } = useCardInputs()
    const input = document.createElement('input')
    input.value = '1230'
    onExpiryInput({ target: input } as unknown as Event)
    expect(expiry.value).toBe('12/30')
  })

  it('onCvcInput formats cvc', () => {
    const { cvc, onCvcInput } = useCardInputs()
    const input = document.createElement('input')
    input.value = '123'
    onCvcInput({ target: input } as unknown as Event)
    expect(cvc.value).toBe('123')
  })

  it('onPaste splits full card into number/expiry/cvc', () => {
    const { number, expiry, cvc, onPaste } = useCardInputs()
    const event = new Event('paste') as unknown as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: () => '42424242424242421230123' },
    })
    onPaste(event)
    expect(number.value).toBeTruthy()
    expect(expiry.value).toBeTruthy()
    expect(cvc.value).toBeTruthy()
  })

  it('onPaste with short data appends to focused field', () => {
    const { number, onPaste } = useCardInputs()
    const target = document.createElement('input')
    target.classList.add('nexus-number')
    const event = new Event('paste') as unknown as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: () => '4242' },
    })
    Object.defineProperty(event, 'target', { value: target, writable: false })
    onPaste(event)
    expect(number.value).toContain('4242')
  })

  it('onNumberKeydown ArrowRight at end triggers navigate next', () => {
    const { onNumberKeydown, setNavigationCallback } = useCardInputs()
    const navigated: string[] = []
    setNavigationCallback((dir) => navigated.push(dir))
    const input = document.createElement('input')
    input.value = '4242 4242 4242 4242'
    Object.defineProperty(input, 'selectionStart', { value: 19 })
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight' })
    Object.defineProperty(event, 'target', { value: input, writable: false })
    onNumberKeydown(event)
    expect(navigated).toContain('next')
  })

  it('onNumberKeydown ArrowRight mid-value does not navigate', () => {
    const { onNumberKeydown, setNavigationCallback } = useCardInputs()
    const navigated: string[] = []
    setNavigationCallback((dir) => navigated.push(dir))
    const input = document.createElement('input')
    input.value = '4242 4242 4242 4242'
    Object.defineProperty(input, 'selectionStart', { value: 5 })
    const event = new KeyboardEvent('keydown', { key: 'ArrowRight' })
    Object.defineProperty(event, 'target', { value: input, writable: false })
    onNumberKeydown(event)
    expect(navigated).toHaveLength(0)
  })

  it('onExpiryKeydown Backspace at start triggers navigate prev', () => {
    const { onExpiryKeydown, setNavigationCallback } = useCardInputs()
    const navigated: string[] = []
    setNavigationCallback((dir) => navigated.push(dir))
    const input = document.createElement('input')
    input.value = '12/30'
    Object.defineProperty(input, 'selectionStart', { value: 0 })
    Object.defineProperty(input, 'selectionEnd', { value: 0 })
    const event = new KeyboardEvent('keydown', { key: 'Backspace' })
    Object.defineProperty(event, 'target', { value: input, writable: false })
    onExpiryKeydown(event)
    expect(navigated).toContain('prev')
  })

  it('onExpiryKeydown ArrowLeft at start triggers navigate prev', () => {
    const { onExpiryKeydown, setNavigationCallback } = useCardInputs()
    const navigated: string[] = []
    setNavigationCallback((dir) => navigated.push(dir))
    const input = document.createElement('input')
    input.value = '12/30'
    Object.defineProperty(input, 'selectionStart', { value: 0 })
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' })
    Object.defineProperty(event, 'target', { value: input, writable: false })
    onExpiryKeydown(event)
    expect(navigated).toContain('prev')
  })

  it('onCvcKeydown Backspace at start triggers navigate prev', () => {
    const { onCvcKeydown, setNavigationCallback } = useCardInputs()
    const navigated: string[] = []
    setNavigationCallback((dir) => navigated.push(dir))
    const input = document.createElement('input')
    input.value = '123'
    Object.defineProperty(input, 'selectionStart', { value: 0 })
    Object.defineProperty(input, 'selectionEnd', { value: 0 })
    const event = new KeyboardEvent('keydown', { key: 'Backspace' })
    Object.defineProperty(event, 'target', { value: input, writable: false })
    onCvcKeydown(event)
    expect(navigated).toContain('prev')
  })

  it('onCvcKeydown ArrowLeft at start triggers navigate prev', () => {
    const { onCvcKeydown, setNavigationCallback } = useCardInputs()
    const navigated: string[] = []
    setNavigationCallback((dir) => navigated.push(dir))
    const input = document.createElement('input')
    input.value = '123'
    Object.defineProperty(input, 'selectionStart', { value: 0 })
    const event = new KeyboardEvent('keydown', { key: 'ArrowLeft' })
    Object.defineProperty(event, 'target', { value: input, writable: false })
    onCvcKeydown(event)
    expect(navigated).toContain('prev')
  })

  it('onPaste with Amex card splits at 15 digits', () => {
    const { number, expiry, cvc, onPaste } = useCardInputs()
    const event = new Event('paste') as unknown as ClipboardEvent
    Object.defineProperty(event, 'clipboardData', {
      value: { getData: () => '37828224631000512301234' },
    })
    onPaste(event)
    const digits = number.value.replace(/\D/g, '')
    expect(digits.length).toBe(15)
    expect(digits).toBe('378282246310005')
    expect(expiry.value).toBeTruthy()
    expect(cvc.value).toBeTruthy()
  })
})
