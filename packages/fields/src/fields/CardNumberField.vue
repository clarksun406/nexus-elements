<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { bridge } from '../bridge'
import { validateCardNumber } from '../validation'
import { formatCardNumber, detectBrand } from '../validation/format'
import { t, validationMessages } from '../i18n'
import { useElementStyle, type ElementStyle } from '../composables/useElementStyle'
import type { CardBrand } from '../validation/brands'
import type { GroupedCardData } from '../bridge/types'

const options = ref<Record<string, unknown>>({})
const value = ref('')
const focused = ref(false)

const brand = computed<CardBrand>(() => detectBrand(value.value))
const validation = computed(() => validateCardNumber(value.value, validationMessages.value))
const elementStyle = computed(() => options.value.style as ElementStyle | undefined)

useElementStyle(elementStyle)

watch([validation, brand], () => {
  bridge.send('nexus:change', {
    complete: validation.value.isComplete,
    empty: !value.value,
    valid: validation.value.isValid,
    elementType: 'cardNumber',
    brand: brand.value,
    error: validation.value.error,
  })
})

function onInput(event: Event) {
  const target = event.target as HTMLInputElement
  const cursor = target.selectionStart ?? 0
  const prevLength = value.value.length
  value.value = formatCardNumber(target.value)
  const delta = value.value.length - prevLength
  requestAnimationFrame(() => {
    target.setSelectionRange(cursor + delta, cursor + delta)
  })
}

bridge.on('nexus:init', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = payload.options ?? {}
  bridge.send('nexus:ready', { elementType: 'cardNumber' })
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = { ...options.value, ...payload.options }
  bridge.send('nexus:ready', { elementType: 'cardNumber' })
})

bridge.on('nexus:focus', () => {
  ;(document.querySelector('.nexus-input') as HTMLInputElement)?.focus()
})

bridge.on('nexus:blur', () => {
  ;(document.activeElement as HTMLInputElement)?.blur()
})

bridge.on('nexus:clear', () => {
  value.value = ''
})

bridge.on('nexus:collect-data', () => {
  bridge.send('nexus:collect-result', { number: value.value.replace(/\D/g, '') })
})

bridge.on('nexus:tokenize', async (message) => {
  const payload = message.payload as { clientSecret: string; billingDetails?: Record<string, unknown>; groupedCard?: GroupedCardData }

  if (!validation.value.isValid) {
    bridge.send('nexus:token-result', {
      error: { type: 'validation_error', message: validation.value.error?.message ?? 'Card number is incomplete.' },
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
          number: value.value.replace(/\D/g, ''),
          exp_month: payload.groupedCard?.exp_month,
          exp_year: payload.groupedCard?.exp_year,
          cvc: payload.groupedCard?.cvc,
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

const showIcon = computed(() => options.value.showIcon === true)
const disabled = computed(() => options.value.disabled === true)
</script>

<template>
  <div
    class="nexus-field"
    :class="{ 'nexus--focused': focused, 'nexus--invalid': validation.error && validation.isComplete, 'nexus--disabled': disabled, 'nexus--empty': !value, 'nexus--complete': validation.isComplete }"
  >
    <input
      class="nexus-input"
      type="text"
      inputmode="numeric"
      autocomplete="cc-number"
      :aria-label="t('cardNumberLabel')"
      :aria-invalid="!!(validation.error && validation.isComplete)"
      :placeholder="(options.placeholder as string) ?? '1234 1234 1234 1234'"
      :value="value"
      :disabled="disabled"
      @input="onInput"
      @focus="focused = true; bridge.send('nexus:focus-event', {})"
      @blur="focused = false; bridge.send('nexus:blur-event', {})"
      @keydown.esc="bridge.send('nexus:escape', {})"
    />
    <span v-if="showIcon" class="nexus-brand-icon" :data-brand="brand">{{ brand === 'unknown' ? '💳' : brand }}</span>
  </div>
</template>

<style scoped>
.nexus-field {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--nexus-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: var(--nexus-font-size, 16px);
  color: var(--nexus-color-text, #30313d);
  background: var(--nexus-color-background, #fff);
  border: 1px solid var(--nexus-color-border, #e0e0e0);
  border-radius: var(--nexus-border-radius, 6px);
  padding: var(--nexus-spacing, 10px 12px);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.nexus-field.nexus--focused {
  border-color: var(--nexus-color-border-focus, #635bff);
  box-shadow: 0 0 0 1px var(--nexus-color-border-focus, #635bff);
}

.nexus-field.nexus--invalid {
  border-color: var(--nexus-color-danger, #df1b41);
}

.nexus-field.nexus--disabled {
  background: #f5f5f5;
  opacity: 0.6;
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
</style>
