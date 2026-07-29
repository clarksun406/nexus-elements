<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { bridge } from '../bridge'
import { validateCardExpiry } from '../validation'
import { formatExpiry } from '../validation/format'
import { t, validationMessages } from '../i18n'
import { useElementStyle, type ElementStyle } from '../composables/useElementStyle'
import type { GroupedCardData } from '../bridge/types'

const options = ref<Record<string, unknown>>({})
const value = ref('')
const focused = ref(false)

const validation = computed(() => validateCardExpiry(value.value, validationMessages.value))
const elementStyle = computed(() => options.value.style as ElementStyle | undefined)

useElementStyle(elementStyle)

function parsedExpiry(): { exp_month?: number; exp_year?: number } {
  if (value.value.length < 5) return {}
  return {
    exp_month: parseInt(value.value.slice(0, 2), 10),
    exp_year: 2000 + parseInt(value.value.slice(3, 5), 10),
  }
}

watch(validation, () => {
  bridge.send('nexus:change', {
    complete: validation.value.isComplete,
    empty: !value.value,
    valid: validation.value.isValid,
    elementType: 'cardExpiry',
    error: validation.value.error,
  })
})

bridge.on('nexus:init', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = payload.options ?? {}
  bridge.send('nexus:ready', { elementType: 'cardExpiry' })
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = { ...options.value, ...payload.options }
  bridge.send('nexus:ready', { elementType: 'cardExpiry' })
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
  bridge.send('nexus:collect-result', parsedExpiry())
})

bridge.on('nexus:tokenize', async (message) => {
  const payload = message.payload as { clientSecret: string; billingDetails?: Record<string, unknown>; groupedCard?: GroupedCardData }

  if (!validation.value.isValid) {
    bridge.send('nexus:token-result', {
      error: { type: 'validation_error', message: validation.value.error?.message ?? 'Expiry is incomplete.' },
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
          number: payload.groupedCard?.number,
          ...parsedExpiry(),
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
      autocomplete="cc-exp"
      :aria-label="t('expiryLabel')"
      :aria-invalid="!!(validation.error && validation.isComplete)"
      :placeholder="(options.placeholder as string) ?? t('expiryPlaceholder')"
      :value="value"
      :disabled="disabled"
      @input="value = formatExpiry(($event.target as HTMLInputElement).value)"
      @focus="focused = true; bridge.send('nexus:focus-event', {})"
      @blur="focused = false; bridge.send('nexus:blur-event', {})"
      @keydown.esc="bridge.send('nexus:escape', {})"
    />
  </div>
</template>

<style scoped>
.nexus-field {
  display: flex;
  align-items: center;
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
  color: var(--nexus-color-text-placeholder, #8792a2);
}
</style>
