<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { bridge } from '../bridge'
import { t } from '../i18n'
import { COUNTRIES, getCountryConfig } from '../address/countries'

interface AddressDefaults {
  name?: string
  phone?: string
  email?: string
  address?: {
    line1?: string
    line2?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  }
}

const options = ref<Record<string, unknown>>({})

const mode = computed(() => (options.value.mode === 'billing' ? 'billing' : 'shipping'))

const allowedCountries = computed(() => {
  const allowed = options.value.allowedCountries
  if (Array.isArray(allowed) && allowed.length > 0) {
    const set = new Set((allowed as string[]).map((code) => code.toUpperCase()))
    return COUNTRIES.filter((entry) => set.has(entry.code))
  }
  return COUNTRIES
})

const phoneMode = computed<'auto' | 'never' | 'optional' | 'required'>(() => {
  const fields = options.value.fields as { phone?: string } | undefined
  const value = fields?.phone
  return value === 'never' || value === 'optional' || value === 'required' ? value : 'auto'
})

const showPhone = computed(() => {
  if (phoneMode.value === 'never') return false
  if (phoneMode.value === 'auto') return mode.value === 'shipping'
  return true
})
const phoneRequired = computed(() => phoneMode.value === 'required')

const name = ref('')
const phone = ref('')
const country = ref('US')
const line1 = ref('')
const line2 = ref('')
const city = ref('')
const state = ref('')
const postalCode = ref('')
const focusedField = ref<string | null>(null)
const touched = ref(false)

const config = computed(() => getCountryConfig(country.value))

watch(country, () => {
  const cfg = config.value
  if (cfg.stateType === 'select' && state.value && !cfg.stateOptions?.some((option) => option.value === state.value)) {
    state.value = ''
  }
})

const postalError = computed(() => {
  if (!postalCode.value) return false
  const format = config.value.postalFormat
  return format ? !format.test(postalCode.value.trim()) : false
})

const isEmpty = computed(
  () => !name.value && !phone.value && !line1.value && !line2.value && !city.value && !state.value && !postalCode.value,
)

const isComplete = computed(() => {
  if (!country.value || !line1.value.trim() || !city.value.trim()) return false
  if (!name.value.trim()) return false
  if (phoneRequired.value && !phone.value.trim()) return false
  const cfg = config.value
  if (cfg.stateRequired && !state.value.trim()) return false
  if (cfg.postalRequired && !postalCode.value.trim()) return false
  if (postalError.value) return false
  return true
})

const isValid = computed(() => !postalError.value)

const value = computed<Record<string, string>>(() => ({
  name: name.value.trim(),
  phone: phone.value.trim(),
  line1: line1.value.trim(),
  line2: line2.value.trim(),
  city: city.value.trim(),
  state: state.value.trim(),
  postal_code: postalCode.value.trim(),
  country: country.value,
}))

watch([isComplete, isEmpty, isValid, value], () => {
  bridge.send('nexus:change', {
    complete: isComplete.value,
    empty: isEmpty.value,
    valid: isValid.value,
    elementType: 'address',
    error: postalError.value
      ? { type: 'validation_error', code: 'incomplete_postal_code', message: t('postalInvalid') }
      : undefined,
    value: value.value,
  })
})

function applyDefaults(defaults: AddressDefaults | undefined) {
  if (!defaults) return
  if (defaults.name) name.value = defaults.name
  if (defaults.phone) phone.value = defaults.phone
  const address = defaults.address
  if (!address) return
  if (address.country && COUNTRIES.some((entry) => entry.code === address.country)) country.value = address.country
  if (address.line1) line1.value = address.line1
  if (address.line2) line2.value = address.line2
  if (address.city) city.value = address.city
  if (address.state) state.value = address.state
  if (address.postal_code) postalCode.value = address.postal_code
}

bridge.on('nexus:init', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = payload.options ?? {}
  const first = allowedCountries.value[0]
  if (first && !allowedCountries.value.some((entry) => entry.code === country.value)) {
    country.value = first.code
  }
  applyDefaults(options.value.defaultValues as AddressDefaults | undefined)
  bridge.send('nexus:ready', { elementType: 'address' })
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = { ...options.value, ...payload.options }
  bridge.send('nexus:ready', { elementType: 'address' })
})

bridge.on('nexus:focus', () => {
  ;(document.querySelector('.nexus-address-name, .nexus-address-country') as HTMLElement)?.focus()
})

bridge.on('nexus:blur', () => {
  ;(document.activeElement as HTMLElement)?.blur()
})

bridge.on('nexus:clear', () => {
  name.value = ''
  phone.value = ''
  line1.value = ''
  line2.value = ''
  city.value = ''
  state.value = ''
  postalCode.value = ''
  touched.value = false
})

bridge.on('nexus:collect-data', () => {
  bridge.send('nexus:collect-result', { address: value.value })
})

function onFocus(field: string) {
  focusedField.value = field
  bridge.send('nexus:focus-event', {})
}

function onBlur() {
  focusedField.value = null
  touched.value = true
  bridge.send('nexus:blur-event', {})
}

const disabled = computed(() => options.value.disabled === true)
</script>

<template>
  <div class="nexus-address-element" :class="{ 'nexus--disabled': disabled }" @keydown.esc="bridge.send('nexus:escape', {})">
    <label class="nexus-label">
      {{ t('fullName') }}
      <input
        class="nexus-input nexus-address-name"
        type="text"
        autocomplete="name"
        :aria-label="t('fullName')"
        :value="name"
        :disabled="disabled"
        @input="name = ($event.target as HTMLInputElement).value"
        @focus="onFocus('name')"
        @blur="onBlur"
      />
    </label>

    <label class="nexus-label">
      {{ t('country') }}
      <select
        class="nexus-input nexus-address-country"
        autocomplete="country"
        :aria-label="t('country')"
        :value="country"
        :disabled="disabled"
        @change="country = ($event.target as HTMLSelectElement).value"
        @focus="onFocus('country')"
        @blur="onBlur"
      >
        <option v-for="entry in allowedCountries" :key="entry.code" :value="entry.code">{{ entry.name }}</option>
      </select>
    </label>

    <label class="nexus-label">
      {{ t('addressLine1') }}
      <input
        class="nexus-input nexus-address-line1"
        type="text"
        autocomplete="address-line1"
        :aria-label="t('addressLine1')"
        :value="line1"
        :disabled="disabled"
        @input="line1 = ($event.target as HTMLInputElement).value"
        @focus="onFocus('line1')"
        @blur="onBlur"
      />
    </label>

    <label class="nexus-label">
      {{ t('addressLine2') }}
      <input
        class="nexus-input nexus-address-line2"
        type="text"
        autocomplete="address-line2"
        :aria-label="t('addressLine2')"
        :value="line2"
        :disabled="disabled"
        @input="line2 = ($event.target as HTMLInputElement).value"
        @focus="onFocus('line2')"
        @blur="onBlur"
      />
    </label>

    <div class="nexus-address-row">
      <label class="nexus-label">
        {{ config.cityLabel }}
        <input
          class="nexus-input nexus-address-city"
          type="text"
          autocomplete="address-level2"
          :aria-label="config.cityLabel"
          :value="city"
          :disabled="disabled"
          @input="city = ($event.target as HTMLInputElement).value"
          @focus="onFocus('city')"
          @blur="onBlur"
        />
      </label>

      <label class="nexus-label">
        {{ config.stateLabel }}
        <select
          v-if="config.stateType === 'select'"
          class="nexus-input nexus-address-state"
          autocomplete="address-level1"
          :aria-label="config.stateLabel"
          :value="state"
          :disabled="disabled"
          @change="state = ($event.target as HTMLSelectElement).value"
          @focus="onFocus('state')"
          @blur="onBlur"
        >
          <option value=""></option>
          <option v-for="option in config.stateOptions" :key="option.value" :value="option.value">{{ option.label }}</option>
        </select>
        <input
          v-else
          class="nexus-input nexus-address-state"
          type="text"
          autocomplete="address-level1"
          :aria-label="config.stateLabel"
          :value="state"
          :disabled="disabled"
          @input="state = ($event.target as HTMLInputElement).value"
          @focus="onFocus('state')"
          @blur="onBlur"
        />
      </label>

      <label class="nexus-label">
        {{ config.postalLabel }}
        <input
          class="nexus-input nexus-address-postal"
          :class="{ 'nexus-input--invalid': postalError && touched }"
          type="text"
          autocomplete="postal-code"
          :aria-label="config.postalLabel"
          :aria-invalid="postalError && touched"
          :placeholder="config.postalPlaceholder ?? ''"
          :value="postalCode"
          :disabled="disabled"
          @input="postalCode = ($event.target as HTMLInputElement).value"
          @focus="onFocus('postal')"
          @blur="onBlur"
        />
      </label>
    </div>

    <label v-if="showPhone" class="nexus-label">
      {{ t('phone') }}
      <input
        class="nexus-input nexus-address-phone"
        type="tel"
        autocomplete="tel"
        :aria-label="t('phone')"
        :value="phone"
        :disabled="disabled"
        @input="phone = ($event.target as HTMLInputElement).value"
        @focus="onFocus('phone')"
        @blur="onBlur"
      />
    </label>

    <p v-if="postalError && touched" class="nexus-error" role="alert">{{ t('postalInvalid') }}</p>
  </div>
</template>

<style scoped>
.nexus-address-element {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: var(--nexus-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: var(--nexus-font-size, 16px);
  color: var(--nexus-color-text, #30313d);
  padding: 2px;
}

.nexus-address-element.nexus--disabled {
  opacity: 0.6;
}

.nexus-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--nexus-color-text-secondary, #6d6e78);
  flex: 1;
  min-width: 0;
}

.nexus-address-row {
  display: flex;
  gap: 10px;
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
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.nexus-input:focus {
  border-color: var(--nexus-color-border-focus, #635bff);
  box-shadow: 0 0 0 1px var(--nexus-color-border-focus, #635bff);
}

.nexus-input--invalid {
  border-color: var(--nexus-color-danger, #df1b41);
}

.nexus-input::placeholder {
  color: var(--nexus-color-text-placeholder, #8792a2);
}

.nexus-error {
  margin: 0;
  font-size: 13px;
  color: var(--nexus-color-danger, #df1b41);
}
</style>
