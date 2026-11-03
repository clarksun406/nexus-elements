<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { bridge } from '../bridge'
import { useCardInputs } from '../composables/useCardInputs'
import { useElementStyle, type ElementStyle } from '../composables/useElementStyle'
import { getBrandRule } from '../validation/brands'
import { t } from '../i18n'
import { getBrandIcon } from '../assets/brand-icons'
import { publishTokenResult } from '../api/token'
import { publishCardParts } from '../secure/group-channel'

const options = ref<Record<string, unknown>>({})
const focusedField = ref<'number' | 'expiry' | 'cvc' | 'postal' | null>(null)
const postalCode = ref('')

const {
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
} = useCardInputs()

const elementStyle = computed(() => options.value.style as ElementStyle | undefined)

useElementStyle(elementStyle)

const showPostalCode = computed(() => options.value.hidePostalCode !== true)

const cardComplete = computed(() => {
  if (!isComplete.value) return false
  if (showPostalCode.value && !postalCode.value.trim()) return false
  return true
})

const cardValid = computed(() => {
  if (!isValid.value) return false
  if (showPostalCode.value && !postalCode.value.trim()) return false
  return true
})

const cardEmpty = computed(() => {
  if (!isEmpty.value) return false
  if (showPostalCode.value && postalCode.value.trim()) return false
  return true
})

watch([number, expiry, cvc, postalCode], () => {
  const digits = number.value.replace(/\D/g, '')
  void publishCardParts('card', {
    number: digits,
    exp_month: expiry.value.length >= 5 ? parseInt(expiry.value.slice(0, 2), 10) : undefined,
    exp_year: expiry.value.length >= 5 ? 2000 + parseInt(expiry.value.slice(3, 5), 10) : undefined,
    cvc: cvc.value,
    postalCode: postalCode.value,
  })
})

watch([cardComplete, cardEmpty, cardValid, brand, postalCode], () => {
  bridge.send('nexus:change', {
    complete: cardComplete.value,
    empty: cardEmpty.value,
    valid: cardValid.value,
    elementType: 'card',
    brand: brand.value,
    error: currentError.value,
    value: {
      postalCode: postalCode.value,
    },
  })
})

const fieldOrder = ['number', 'expiry', 'cvc', 'postal'] as const

setNavigationCallback((direction) => {
  const current = focusedField.value
  if (!current) return
  const idx = fieldOrder.indexOf(current)
  const nextIdx = direction === 'next' ? idx + 1 : idx - 1
  if (nextIdx < 0 || nextIdx >= fieldOrder.length) return
  const selector = `.nexus-${fieldOrder[nextIdx]}`
  ;(document.querySelector(selector) as HTMLInputElement)?.focus()
})

watch(number, (val) => {
  const digits = val.replace(/\D/g, '')
  if (digits.length < 4) return
  const rule = getBrandRule(digits)
  const maxLen = Math.max(...rule.lengths)
  if (digits.length >= maxLen) {
    ;(document.querySelector('.nexus-expiry') as HTMLInputElement)?.focus()
  }
})

watch(expiry, (val) => {
  const digits = val.replace(/\D/g, '')
  if (digits.length >= 4) {
    ;(document.querySelector('.nexus-cvc') as HTMLInputElement)?.focus()
  }
})

function onPostalInput(e: Event) {
  postalCode.value = (e.target as HTMLInputElement).value
}

function onFocus(field: 'number' | 'expiry' | 'cvc' | 'postal') {
  focusedField.value = field
  bridge.send('nexus:focus-event', {})
}

function onBlur() {
  focusedField.value = null
  bridge.send('nexus:blur-event', {})
}

function onEscape() {
  bridge.send('nexus:escape', {})
}

bridge.on('nexus:init', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = payload.options ?? {}
  bridge.send('nexus:ready', { elementType: 'card' })
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = { ...options.value, ...payload.options }
  bridge.send('nexus:ready', { elementType: 'card' })
})

bridge.on('nexus:focus', () => {
  ;(document.querySelector('.nexus-number') as HTMLInputElement)?.focus()
})

bridge.on('nexus:blur', () => {
  ;(document.activeElement as HTMLInputElement)?.blur()
})

bridge.on('nexus:clear', () => {
  clear()
  postalCode.value = ''
})

bridge.on('nexus:tokenize', async (message) => {
  const payload = message.payload as { clientSecret: string; billingDetails?: Record<string, unknown> }

  if (!cardValid.value || !cardComplete.value) {
    bridge.send('nexus:token-result', {
      error: {
        type: 'validation_error',
        message: currentError.value?.message ?? 'Your card details are incomplete.',
      },
    })
    return
  }

  const billingDetails = payload.billingDetails ?? {}
  await publishTokenResult({
    client_secret: payload.clientSecret,
    card: {
      number: number.value.replace(/\D/g, ''),
      exp_month: parseInt(expiry.value.slice(0, 2), 10),
      exp_year: 2000 + parseInt(expiry.value.slice(3, 5), 10),
      cvc: cvc.value,
    },
    billing_details: {
      ...billingDetails,
      address: {
        ...(billingDetails.address as Record<string, unknown> | undefined),
        postal_code: postalCode.value || undefined,
      },
    },
  })
})

const showIcon = computed(() => options.value.showIcon !== false && options.value.hideIcon !== true)
const disabled = computed(() => options.value.disabled === true)
const brandIconHtml = computed(() => getBrandIcon(brand.value) ?? '💳')
</script>

<template>
  <div
    class="nexus-card-element"
    :class="{ 'nexus--focused': focusedField, 'nexus--invalid': currentError, 'nexus--disabled': disabled, 'nexus--empty': cardEmpty, 'nexus--complete': cardComplete }"
  >
    <div class="nexus-card-row">
      <input
        class="nexus-input nexus-number"
        type="text"
        inputmode="numeric"
        autocomplete="cc-number"
        :aria-label="t('cardNumberLabel')"
        :aria-invalid="numberValidation.error && numberValidation.isComplete"
        :placeholder="(options.placeholder as string) ?? '1234 1234 1234 1234'"
        :value="number"
        :disabled="disabled"
        @input="onNumberInput"
        @keydown="onNumberKeydown"
        @focus="onFocus('number')"
        @blur="onBlur"
        @keydown.esc="onEscape"
        @paste="onPaste"
      />
      <span v-if="showIcon" class="nexus-brand-icon" :data-brand="brand" v-html="brandIconHtml"></span>
    </div>
    <div class="nexus-card-row nexus-card-row--split">
      <input
        class="nexus-input nexus-expiry"
        type="text"
        inputmode="numeric"
        autocomplete="cc-exp"
        :aria-label="t('expiryLabel')"
        :aria-invalid="expiryValidation.error && expiryValidation.isComplete"
        :placeholder="t('expiryPlaceholder')"
        :value="expiry"
        :disabled="disabled"
        @input="onExpiryInput"
        @keydown="onExpiryKeydown"
        @focus="onFocus('expiry')"
        @blur="onBlur"
        @keydown.esc="onEscape"
        @paste="onPaste"
      />
      <input
        class="nexus-input nexus-cvc"
        type="password"
        inputmode="numeric"
        autocomplete="cc-csc"
        :aria-label="t('cvcLabel')"
        :aria-invalid="cvcValidation.error && cvcValidation.isComplete"
        :placeholder="t('cvcPlaceholder')"
        :value="cvc"
        :disabled="disabled"
        @input="onCvcInput"
        @keydown="onCvcKeydown"
        @focus="onFocus('cvc')"
        @blur="onBlur"
        @keydown.esc="onEscape"
        @paste="onPaste"
      />
    </div>
    <div v-if="showPostalCode" class="nexus-card-row nexus-card-row--postal">
      <input
        class="nexus-input nexus-postal"
        type="text"
        autocomplete="postal-code"
        :aria-label="t('postalCode')"
        :placeholder="t('postalCode')"
        :value="postalCode"
        :disabled="disabled"
        @input="onPostalInput"
        @focus="onFocus('postal')"
        @blur="onBlur"
        @keydown.esc="onEscape"
      />
    </div>
    <p v-if="currentError" class="nexus-error" role="alert" aria-live="polite">
      {{ currentError.message }}
    </p>
  </div>
</template>

<style scoped>
.nexus-card-element {
  font-family: var(--nexus-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: var(--nexus-font-size, 16px);
  color: var(--nexus-color-text, #30313d);
  background: var(--nexus-color-background, #fff);
  border: 1px solid var(--nexus-color-border, #e0e0e0);
  border-radius: var(--nexus-border-radius, 6px);
  padding: var(--nexus-spacing, 10px 12px);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.nexus-card-element.nexus--focused {
  border-color: var(--nexus-color-border-focus, #635bff);
  box-shadow: 0 0 0 1px var(--nexus-color-border-focus, #635bff), 0 1px 1px rgba(0, 0, 0, 0.03);
}

.nexus-card-element.nexus--invalid {
  border-color: var(--nexus-color-danger, #df1b41);
}

.nexus-card-element.nexus--disabled {
  background: #f5f5f5;
  opacity: 0.6;
}

.nexus-card-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.nexus-card-row--split {
  margin-top: 0;
  border-top: 1px solid var(--nexus-color-border, #e0e0e0);
}

.nexus-card-row--postal {
  margin-top: 0;
  border-top: 1px solid var(--nexus-color-border, #e0e0e0);
}

.nexus-card-row--split .nexus-input {
  flex: 1;
}

.nexus-card-row--split .nexus-expiry {
  padding-right: 8px;
  border-right: 1px solid var(--nexus-color-border, #e0e0e0);
}

.nexus-card-row--split .nexus-cvc {
  padding-left: 8px;
}

.nexus-input {
  border: none;
  outline: none;
  background: transparent;
  font: inherit;
  color: inherit;
  width: 100%;
  padding: 0;
}

.nexus-input::placeholder {
  color: var(--nexus-color-text-placeholder, #8792a2);
}

.nexus-brand-icon {
  display: flex;
  align-items: center;
  font-size: 12px;
  color: var(--nexus-color-icon, #8792a2);
  white-space: nowrap;
}
.nexus-brand-icon svg {
  width: 32px;
  height: 20px;
  flex-shrink: 0;
}

.nexus-error {
  margin-top: 6px;
  font-size: 13px;
  color: var(--nexus-color-danger, #df1b41);
}
</style>
