<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { bridge } from '../bridge'
import { publishTokenResult } from '../api/token'
import { t } from '../i18n'
import { validateBsb } from '../validation'
import { formatBsb } from '../validation/format'

const options = ref<Record<string, unknown>>({})
const bsbRaw = ref('')
const accountNumber = ref('')
const accountName = ref('')
const email = ref('')
const touched = ref<Record<string, boolean>>({})

const bsbDigits = computed(() => bsbRaw.value.replace(/\D/g, ''))
const displayBsb = computed(() => formatBsb(bsbRaw.value))

const bsbResult = computed(() => validateBsb(bsbRaw.value))
const bsbError = computed(() => {
  if (!touched.value.bsb && !bsbDigits.value) return null
  return bsbResult.value.error ?? null
})

const accountError = computed(() => {
  if (!touched.value.account && !accountNumber.value) return null
  if (accountNumber.value && accountNumber.value.replace(/\D/g, '').length > 9) {
    return { field: 'account', type: 'length' as const, message: t('accountIncomplete') }
  }
  return null
})

const isEmpty = computed(() => !bsbDigits.value && !accountNumber.value.replace(/\D/g, ''))

const isComplete = computed(() => {
  if (!bsbResult.value.isValid) return false
  const acctDigits = accountNumber.value.replace(/\D/g, '')
  if (acctDigits.length === 0) return false
  return true
})

const isValid = computed(() => bsbResult.value.isValid && !accountError.value)

watch([isComplete, isEmpty, isValid, bsbError, accountError], () => {
  bridge.send('nexus:change', {
    complete: isComplete.value,
    empty: isEmpty.value,
    valid: isValid.value,
    elementType: 'auBankAccount',
    error: bsbError.value
      ? { type: 'validation_error', code: 'invalid_bsb', message: bsbError.value.message }
      : accountError.value
        ? { type: 'validation_error', code: 'incomplete_account', message: accountError.value.message }
        : undefined,
    value: {
      bsbLast3: bsbDigits.value.slice(-3),
      accountLast4: accountNumber.value.replace(/\D/g, '').slice(-4),
      account_holder_name: accountName.value.trim() || undefined,
      email: email.value.trim() || undefined,
    },
  })
})

bridge.on('nexus:init', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = payload.options ?? {}
  bridge.send('nexus:ready', { elementType: 'auBankAccount' })
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = { ...options.value, ...payload.options }
})

bridge.on('nexus:focus', () => {
  ;(document.querySelector('.nexus-au-bsb') as HTMLElement)?.focus()
})

bridge.on('nexus:blur', () => {
  ;(document.activeElement as HTMLElement)?.blur()
})

bridge.on('nexus:clear', () => {
  bsbRaw.value = ''
  accountNumber.value = ''
  accountName.value = ''
  email.value = ''
  touched.value = {}
})

bridge.on('nexus:tokenize', async () => {
  if (!isValid.value) {
    bridge.send('nexus:token-result', {
      error: bsbError.value
        ? { type: 'validation_error', code: 'invalid_bsb', message: bsbError.value.message }
        : { type: 'validation_error', code: 'incomplete', message: t('accountIncomplete') },
    })
    return
  }
  await publishTokenResult({
    payment_method_type: 'au_becs_debit',
    au_becs_debit: {
      bsb: bsbDigits.value,
      account_number: accountNumber.value.replace(/\D/g, ''),
      account_holder_name: accountName.value.trim() || undefined,
      email: email.value.trim() || undefined,
    },
  })
})

function onBsbInput(event: Event) {
  const input = event.target as HTMLInputElement
  bsbRaw.value = input.value.replace(/\D/g, '').slice(0, 6)
}

function onAccountInput(event: Event) {
  const input = event.target as HTMLInputElement
  accountNumber.value = input.value.replace(/\D/g, '').slice(0, 9)
}

function markTouched(field: string) {
  touched.value = { ...touched.value, [field]: true }
}

const disabled = computed(() => options.value.disabled === true)
</script>

<template>
  <div class="nexus-au-element" :class="{ 'nexus--disabled': disabled }" @keydown.esc="bridge.send('nexus:escape', {})">
    <div class="nexus-au-row">
      <label class="nexus-label">
        {{ t('bsbLabel') }}
        <input
          class="nexus-input nexus-au-bsb"
          :class="{ 'nexus-input--invalid': bsbError }"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          :aria-label="t('bsbLabel')"
          :aria-invalid="!!bsbError"
          placeholder="000-000"
          :disabled="disabled"
          :value="displayBsb"
          @input="onBsbInput"
          @blur="markTouched('bsb')"
        />
      </label>

      <label class="nexus-label">
        {{ t('accountNumberLabel') }}
        <input
          class="nexus-input nexus-au-account"
          :class="{ 'nexus-input--invalid': accountError }"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          :aria-label="t('accountNumberLabel')"
          :aria-invalid="!!accountError"
          placeholder="123456789"
          :disabled="disabled"
          :value="accountNumber"
          @input="onAccountInput"
          @blur="markTouched('account')"
        />
      </label>
    </div>

    <label class="nexus-label">
      {{ t('fullName') }} <span class="nexus-optional">({{ t('optionalSuffix') }})</span>
      <input
        class="nexus-input nexus-au-name"
        type="text"
        autocomplete="name"
        :aria-label="t('fullName')"
        :disabled="disabled"
        :value="accountName"
        @input="accountName = ($event.target as HTMLInputElement).value"
      />
    </label>

    <label class="nexus-label">
      {{ t('emailLabel') }} <span class="nexus-optional">({{ t('optionalSuffix') }})</span>
      <input
        class="nexus-input nexus-au-email"
        type="email"
        autocomplete="email"
        :aria-label="t('emailLabel')"
        :disabled="disabled"
        :value="email"
        @input="email = ($event.target as HTMLInputElement).value"
      />
    </label>

    <p v-if="bsbError" class="nexus-error" role="alert" aria-live="polite">{{ bsbError.message }}</p>
    <p v-if="accountError" class="nexus-error" role="alert" aria-live="polite">{{ accountError.message }}</p>
  </div>
</template>

<style scoped>
.nexus-au-element {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-family: var(--nexus-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: var(--nexus-font-size, 16px);
  color: var(--nexus-color-text, #30313d);
  padding: 2px;
}

.nexus-au-element.nexus--disabled { opacity: 0.6; }

.nexus-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  color: var(--nexus-color-text-secondary, #6d6e78);
  flex: 1;
  min-width: 0;
}

.nexus-au-row {
  display: flex;
  gap: 10px;
}

.nexus-optional {
  font-size: 12px;
  color: var(--nexus-color-text-secondary, #8792a2);
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

.nexus-input--invalid:focus {
  box-shadow: 0 0 0 1px var(--nexus-color-danger, #df1b41);
}

.nexus-input::placeholder { color: var(--nexus-color-text-placeholder, #8792a2); }

.nexus-error {
  margin: 0;
  font-size: 13px;
  color: var(--nexus-color-danger, #df1b41);
}
</style>
