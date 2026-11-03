<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { bridge } from '../bridge'
import { validateCardCvc } from '../validation'
import { formatCvc } from '../validation/format'
import { t, validationMessages } from '../i18n'
import { useElementStyle, type ElementStyle } from '../composables/useElementStyle'
import type { CardBrand } from '../validation/brands'
import { publishTokenResult } from '../api/token'
import { collectCardParts, publishCardParts } from '../secure/group-channel'

const options = ref<Record<string, unknown>>({})
const value = ref('')
const focused = ref(false)
const brand = ref<CardBrand>('unknown')

const validation = computed(() => validateCardCvc(value.value, brand.value, validationMessages.value))
const elementStyle = computed(() => options.value.style as ElementStyle | undefined)

useElementStyle(elementStyle)

watch(value, () => {
  void publishCardParts('cardCvc', { cvc: value.value })
})

watch(validation, () => {
  bridge.send('nexus:change', {
    complete: validation.value.isComplete,
    empty: !value.value,
    valid: validation.value.isValid,
    elementType: 'cardCvc',
    error: validation.value.error,
  })
})

bridge.on('nexus:init', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = payload.options ?? {}
  bridge.send('nexus:ready', { elementType: 'cardCvc' })
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = { ...options.value, ...payload.options }
  if (payload.options?.brand) {
    brand.value = payload.options.brand as CardBrand
  }
  bridge.send('nexus:ready', { elementType: 'cardCvc' })
})

bridge.on('nexus:brand', (message) => {
  const payload = message.payload as { brand?: CardBrand }
  if (payload.brand) {
    brand.value = payload.brand
  }
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

bridge.on('nexus:tokenize', async (message) => {
  const payload = message.payload as { clientSecret: string; billingDetails?: Record<string, unknown> }

  if (!validation.value.isValid) {
    bridge.send('nexus:token-result', {
      error: { type: 'validation_error', message: validation.value.error?.message ?? 'CVC is incomplete.' },
    })
    return
  }

  const parts = await collectCardParts('cardCvc', { cvc: value.value })
  await publishTokenResult({
    client_secret: payload.clientSecret,
    card: {
      number: parts.number,
      exp_month: parts.exp_month,
      exp_year: parts.exp_year,
      cvc: parts.cvc,
    },
    billing_details: payload.billingDetails,
  })
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
      type="password"
      inputmode="numeric"
      autocomplete="cc-csc"
      :aria-label="t('cvcLabel')"
      :aria-invalid="!!(validation.error && validation.isComplete)"
      :placeholder="(options.placeholder as string) ?? t('cvcPlaceholder')"
      :value="value"
      :disabled="disabled"
      @input="value = formatCvc(($event.target as HTMLInputElement).value, brand)"
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
