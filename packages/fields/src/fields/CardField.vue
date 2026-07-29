<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { bridge } from '../bridge'
import { useCardInputs } from '../composables/useCardInputs'
import { useElementStyle, type ElementStyle } from '../composables/useElementStyle'
import { getBrandRule } from '../validation/brands'
import { t } from '../i18n'

const options = ref<Record<string, unknown>>({})
const focusedField = ref<'number' | 'expiry' | 'cvc' | null>(null)

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

watch([isComplete, isEmpty, isValid, brand], () => {
  bridge.send('nexus:change', {
    complete: isComplete.value,
    empty: isEmpty.value,
    valid: isValid.value,
    elementType: 'card',
    brand: brand.value,
    error: currentError.value,
    value: {
      postalCode: '',
    },
  })
})

const fieldOrder = ['number', 'expiry', 'cvc'] as const

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

function onFocus(field: 'number' | 'expiry' | 'cvc') {
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
})

bridge.on('nexus:tokenize', async (message) => {
  const payload = message.payload as { clientSecret: string; billingDetails?: Record<string, unknown> }

  if (!isValid.value || !isComplete.value) {
    bridge.send('nexus:token-result', {
      error: {
        type: 'validation_error',
        message: currentError.value?.message ?? 'Your card details are incomplete.',
      },
    })
    return
  }

  try {
    const response = await fetch('/v1/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_secret: payload.clientSecret,
        card: {
          number: number.value.replace(/\D/g, ''),
          exp_month: parseInt(expiry.value.slice(0, 2), 10),
          exp_year: 2000 + parseInt(expiry.value.slice(3, 5), 10),
          cvc: cvc.value,
        },
        billing_details: payload.billingDetails,
      }),
    })
    const data = await response.json()
    if (!response.ok) {
      bridge.send('nexus:token-result', { error: data.error ?? { type: 'api_error', message: 'Tokenization failed.' } })
    } else {
      bridge.send('nexus:token-result', { token: data.token, paymentMethodId: data.payment_method_id })
    }
  } catch {
    bridge.send('nexus:token-result', { error: { type: 'network_error', message: 'A network error occurred.' } })
  }
})

const showIcon = computed(() => options.value.showIcon !== false && options.value.hideIcon !== true)
const disabled = computed(() => options.value.disabled === true)
</script>

<template>
  <div
    class="nexus-card-element"
    :class="{ 'nexus--focused': focusedField, 'nexus--invalid': currentError, 'nexus--disabled': disabled, 'nexus--empty': isEmpty, 'nexus--complete': isComplete }"
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
      <span v-if="showIcon" class="nexus-brand-icon" :data-brand="brand">{{ brand === 'unknown' ? '💳' : brand }}</span>
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
}

.nexus-card-row--split {
  margin-top: 8px;
}

.nexus-card-row--split .nexus-input {
  flex: 1;
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
  color: var(--nexus-color-text-secondary, #8792a2);
}

.nexus-brand-icon {
  font-size: 12px;
  color: var(--nexus-color-text-secondary, #8792a2);
  white-space: nowrap;
  text-transform: capitalize;
}

.nexus-error {
  margin-top: 6px;
  font-size: 13px;
  color: var(--nexus-color-danger, #df1b41);
}
</style>
