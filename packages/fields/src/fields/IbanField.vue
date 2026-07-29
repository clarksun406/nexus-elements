<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { bridge } from '../bridge'
import { t } from '../i18n'
import { validateIban } from '../validation'
import { formatIban } from '../validation/format'
import { useElementStyle, type ElementStyle } from '../composables/useElementStyle'
import { IBAN_COUNTRY_LENGTHS } from '../bank-data'

const options = ref<Record<string, unknown>>({})
const rawValue = ref('')
const touched = ref(false)

const supportedCountries = computed(() => {
  const list = options.value.supportedCountries
  if (Array.isArray(list) && list.length > 0) {
    const set = new Set((list as string[]).map((c) => c.toUpperCase()))
    const filtered: Record<string, number> = {}
    for (const [code, len] of Object.entries(IBAN_COUNTRY_LENGTHS)) {
      if (set.has(code)) filtered[code] = len
    }
    return filtered
  }
  return IBAN_COUNTRY_LENGTHS
})

const compact = computed(() => rawValue.value.replace(/\s/g, '').toUpperCase())

const detectedCountry = computed(() => compact.value.slice(0, 2))

const displayValue = computed(() => formatIban(rawValue.value))

const validationResult = computed(() => validateIban(rawValue.value, supportedCountries.value, {
  ibanInvalid: t('ibanInvalid'),
  ibanIncomplete: t('ibanIncomplete'),
}))

const ibanError = computed(() => {
  if (!touched.value && !compact.value) return null
  return validationResult.value.error ?? null
})

const isEmpty = computed(() => compact.value.length === 0)
const isComplete = computed(() => validationResult.value.isComplete)
const isValid = computed(() => validationResult.value.isValid)

const elementStyle = computed(() => options.value.style as ElementStyle | undefined)

useElementStyle(elementStyle)

watch([isComplete, isEmpty, isValid, ibanError, compact], () => {
  bridge.send('nexus:change', {
    complete: isComplete.value,
    empty: isEmpty.value,
    valid: isValid.value,
    elementType: 'iban',
    error: ibanError.value
      ? { type: 'validation_error', code: ibanError.value.type === 'mod97' ? 'invalid_iban' : 'incomplete_iban', message: ibanError.value.message }
      : undefined,
    value: compact.value ? { iban: compact.value, country: detectedCountry.value } : undefined,
  })
})

bridge.on('nexus:init', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = payload.options ?? {}
  bridge.send('nexus:ready', { elementType: 'iban' })
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = { ...options.value, ...payload.options }
})

bridge.on('nexus:focus', () => {
  ;(document.querySelector('.nexus-iban-input') as HTMLElement)?.focus()
})

bridge.on('nexus:blur', () => {
  ;(document.activeElement as HTMLElement)?.blur()
  touched.value = true
})

bridge.on('nexus:clear', () => {
  rawValue.value = ''
  touched.value = false
})

bridge.on('nexus:tokenize', () => {
  if (!isValid.value) {
    bridge.send('nexus:token-result', {
      error: ibanError.value
        ? { type: 'validation_error', code: ibanError.value.type === 'mod97' ? 'invalid_iban' : 'incomplete_iban', message: ibanError.value.message }
        : { type: 'validation_error', code: 'incomplete_iban', message: t('ibanIncomplete') },
    })
    return
  }
  bridge.send('nexus:token-result', {
    token: `tok_test_iban_${compact.value.slice(0, 8)}`,
    paymentMethodType: 'iban',
    iban: { iban: compact.value, country: detectedCountry.value },
  })
})

bridge.on('nexus:collect-data', () => {
  bridge.send('nexus:collect-result', { iban: { iban: compact.value, country: detectedCountry.value } })
})

function onInput(event: Event) {
  const input = event.target as HTMLInputElement
  const cursorPos = input.selectionStart ?? 0
  const oldFormatted = displayValue.value
  const raw = input.value.replace(/\s/g, '').toUpperCase()
  rawValue.value = raw

  requestAnimationFrame(() => {
    const newFormatted = formatIban(raw)
    const spacesBeforeCursor = (oldFormatted.slice(0, cursorPos).match(/\s/g) ?? []).length
    const newSpacesBeforeCursor = (newFormatted.slice(0, cursorPos).match(/\s/g) ?? []).length
    const newCursor = cursorPos + (newSpacesBeforeCursor - spacesBeforeCursor)
    input.setSelectionRange(newCursor, newCursor)
  })
}

const placeholderCountry = computed(() => {
  const pc = options.value.placeholderCountry as string | undefined
  return pc?.toUpperCase() ?? 'DE'
})

const placeholder = computed(() => {
  const len = IBAN_COUNTRY_LENGTHS[placeholderCountry.value] ?? 22
  const example = placeholderCountry.value + '89370400440532013000'
  return formatIban(example.slice(0, len))
})

const disabled = computed(() => options.value.disabled === true)
</script>

<template>
  <div class="nexus-iban-element" :class="{ 'nexus--disabled': disabled, 'nexus--empty': isEmpty, 'nexus--complete': isComplete, 'nexus--invalid': ibanError, 'nexus--focused': false }" @keydown.esc="bridge.send('nexus:escape', {})">
    <label class="nexus-label">
      {{ t('ibanLabel') }}
      <input
        class="nexus-input nexus-iban-input"
        :class="{ 'nexus-input--invalid': ibanError }"
        type="text"
        inputmode="text"
        autocomplete="off"
        :aria-label="t('ibanLabel')"
        :aria-invalid="!!ibanError"
        :placeholder="placeholder"
        :disabled="disabled"
        :value="displayValue"
        @input="onInput"
        @blur="touched = true"
      />
    </label>

    <p v-if="ibanError" class="nexus-error" role="alert">{{ ibanError.message }}</p>
  </div>
</template>

<style scoped>
.nexus-iban-element {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: var(--nexus-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: var(--nexus-font-size, 16px);
  color: var(--nexus-color-text, #30313d);
  padding: 2px;
}

.nexus-iban-element.nexus--disabled { opacity: 0.6; }

.nexus-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--nexus-color-text-secondary, #6d6e78);
}

.nexus-input {
  font: inherit;
  font-size: var(--nexus-font-size, 16px);
  color: var(--nexus-color-text, #30313d);
  background: var(--nexus-color-background, #fff);
  border: 1px solid var(--nexus-color-border, #e0e0e0);
  border-radius: var(--nexus-border-radius, 6px);
  padding: var(--nexus-spacing, 10px 12px);
  outline: none;
  width: 100%;
  letter-spacing: 0.05em;
  font-variant: tabular-nums;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.nexus-input:focus {
  border-color: var(--nexus-color-border-focus, #635bff);
  box-shadow: 0 0 0 1px var(--nexus-color-border-focus, #635bff);
}

.nexus-input--invalid {
  border-color: var(--nexus-color-danger, #df1b41);
}

.nexus-input--invalid:focus {
  box-shadow: 0 0 0 1px var(--nexus-color-danger, #df1b41);
}

.nexus-input::placeholder { color: var(--nexus-color-text-secondary, #8792a2); }

.nexus-error {
  margin: 0;
  font-size: 13px;
  color: var(--nexus-color-danger, #df1b41);
}
</style>
