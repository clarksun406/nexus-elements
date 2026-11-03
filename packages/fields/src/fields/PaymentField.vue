<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { bridge } from '../bridge'
import { useCardInputs } from '../composables/useCardInputs'
import { getBrandRule } from '../validation/brands'
import { t } from '../i18n'
import { getBrandIcon } from '../assets/brand-icons'
import { publishTokenResult } from '../api/token'

type Layout = 'tabs' | 'accordion' | 'radio'

const METHOD_LABELS: Record<string, string> = {
  ideal: 'iDEAL',
  bancontact: 'Bancontact',
  giropay: 'giropay',
  sofort: 'Sofort',
}

const METHOD_RULES: Record<string, { currencies?: string[]; countries?: string[] }> = {
  ideal: { currencies: ['eur'], countries: ['NL'] },
  bancontact: { currencies: ['eur'], countries: ['BE'] },
  giropay: { currencies: ['eur'], countries: ['DE'] },
  sofort: { currencies: ['eur'], countries: ['DE', 'AT', 'BE', 'NL'] },
}

interface SavedMethod {
  id: string
  brand: string
  last4: string
  exp_month?: number
  exp_year?: number
}

type BillingControl = 'auto' | 'never' | 'optional' | 'required'

const IDEAL_BANKS = [
  { id: 'ing', name: 'ING' },
  { id: 'abn_amro', name: 'ABN AMRO' },
  { id: 'rabobank', name: 'Rabobank' },
  { id: 'asn', name: 'ASN Bank' },
  { id: 'bunq', name: 'bunq' },
  { id: 'sns', name: 'SNS' },
]

const options = ref<Record<string, unknown>>({})

const layout = computed<Layout>(() => {
  const value = options.value.layout
  return value === 'accordion' || value === 'radio' ? value : 'tabs'
})

const business = computed(() => {
  const value = options.value.business as { amount?: number; currency?: string; country?: string } | undefined
  return {
    currency: value?.currency?.toLowerCase(),
    country: value?.country?.toUpperCase(),
  }
})

const methods = computed<string[]>(() => {
  const configured = options.value.paymentMethods
  const base = Array.isArray(configured) && configured.length > 0 ? (configured as string[]) : ['card', 'ideal']
  const { currency, country } = business.value

  const filtered = base.filter((method) => {
    const rule = METHOD_RULES[method]
    if (!rule?.currencies || !currency) return true
    return rule.currencies.includes(currency)
  })

  const score = (method: string) => {
    if (method === 'card') return 0
    const rule = METHOD_RULES[method]
    return country && rule?.countries?.includes(country) ? 1 : 2
  }
  return filtered
    .map((method, index) => ({ method, index }))
    .sort((a, b) => score(a.method) - score(b.method) || a.index - b.index)
    .map((entry) => entry.method)
})

const savedMethods = computed<SavedMethod[]>(() => {
  const value = options.value.savedPaymentMethods
  return Array.isArray(value) ? (value as SavedMethod[]) : []
})

const selectedSaved = ref('')
const saveCard = ref(false)
const linkEmail = ref('')
const collapsed = ref(false)

const allowSave = computed(() => options.value.allowSavePaymentMethod !== false)
const showLink = computed(() => {
  const wallets = options.value.wallets
  return Array.isArray(wallets) && wallets.includes('link')
})

const billingControls = computed(() => {
  const fields = options.value.fields as { billingDetails?: Record<string, BillingControl> } | undefined
  return fields?.billingDetails ?? {}
})

const billingDefaults = computed(() => {
  const defaults = options.value.defaultValues as { billingDetails?: Record<string, unknown> } | undefined
  return (defaults?.billingDetails ?? {}) as { name?: string; email?: string; phone?: string }
})

const billingName = ref('')
const billingEmail = ref('')
const billingPhone = ref('')

function billingFieldState(field: 'name' | 'email' | 'phone') {
  const control = billingControls.value[field] ?? 'auto'
  const hasDefault = Boolean(billingDefaults.value[field])
  return {
    visible: (control === 'required' || control === 'optional') && !hasDefault,
    required: control === 'required' && !hasDefault,
  }
}

const billingFields = computed(() => ({
  name: billingFieldState('name'),
  email: billingFieldState('email'),
  phone: billingFieldState('phone'),
}))

const emailInvalid = computed(
  () => billingEmail.value !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail.value),
)

const billingComplete = computed(() => {
  const fields = billingFields.value
  if (fields.name.required && !billingName.value.trim()) return false
  if (fields.email.required && !billingEmail.value.trim()) return false
  if (fields.phone.required && !billingPhone.value.trim()) return false
  return !emailInvalid.value
})

function collectedBillingDetails(): Record<string, unknown> {
  return {
    name: billingName.value.trim() || billingDefaults.value.name || undefined,
    email: billingEmail.value.trim() || billingDefaults.value.email || undefined,
    phone: billingPhone.value.trim() || billingDefaults.value.phone || undefined,
  }
}

const activeMethod = ref('')
const expandedMethod = ref('')
const selectedBank = ref('')
const focusedField = ref<string | null>(null)

const {
  number,
  expiry,
  cvc,
  brand,
  numberValidation,
  expiryValidation,
  cvcValidation,
  isComplete: cardComplete,
  isValid: cardValid,
  isEmpty: cardEmpty,
  currentError: cardError,
  onNumberInput,
  onExpiryInput,
  onCvcInput,
  onNumberKeydown,
  onExpiryKeydown,
  onCvcKeydown,
  onPaste,
  setNavigationCallback,
  clear: clearCard,
} = useCardInputs()

const pfFieldOrder = ['number', 'expiry', 'cvc'] as const

setNavigationCallback((direction) => {
  const current = focusedField.value
  if (!current) return
  const idx = pfFieldOrder.indexOf(current as typeof pfFieldOrder[number])
  if (idx === -1) return
  const nextIdx = direction === 'next' ? idx + 1 : idx - 1
  if (nextIdx < 0 || nextIdx >= pfFieldOrder.length) return
  const selector = `.nexus-${pfFieldOrder[nextIdx]}`
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

const bankComplete = computed(() => selectedBank.value !== '')

const formComplete = computed(() => (activeMethod.value === 'card' ? cardComplete.value : bankComplete.value))

const isComplete = computed(() => {
  if (selectedSaved.value) return true
  return formComplete.value && billingComplete.value
})
const isValid = computed(() => {
  if (selectedSaved.value) return true
  return (activeMethod.value === 'card' ? cardValid.value : bankComplete.value) && !emailInvalid.value
})
const isEmpty = computed(() => {
  if (selectedSaved.value) return false
  return activeMethod.value === 'card' ? cardEmpty.value : !selectedBank.value
})

function methodLabel(method: string): string {
  if (method === 'card') return t('methodCard')
  return METHOD_LABELS[method] ?? method
}

function selectMethod(method: string) {
  activeMethod.value = method
  expandedMethod.value = method
}

watch([isComplete, isEmpty, isValid, activeMethod, cardError, selectedSaved], () => {
  bridge.send('nexus:change', {
    complete: isComplete.value,
    empty: isEmpty.value,
    valid: isValid.value,
    elementType: 'payment',
    paymentMethodType: selectedSaved.value ? 'card' : activeMethod.value,
    brand: !selectedSaved.value && activeMethod.value === 'card' ? brand.value : undefined,
    error: !selectedSaved.value && activeMethod.value === 'card' ? cardError.value : undefined,
    value: selectedSaved.value ? { savedPaymentMethodId: selectedSaved.value } : undefined,
  })
})

function onFocus(field: string) {
  focusedField.value = field
  bridge.send('nexus:focus-event', {})
}

function onBlur() {
  focusedField.value = null
  bridge.send('nexus:blur-event', {})
}

bridge.on('nexus:init', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = payload.options ?? {}
  const defaultMethod = (options.value.defaultPaymentMethod as string) ?? methods.value[0] ?? 'card'
  selectMethod(methods.value.includes(defaultMethod) ? defaultMethod : methods.value[0] ?? 'card')
  selectedSaved.value = savedMethods.value[0]?.id ?? ''
  bridge.send('nexus:ready', { elementType: 'payment' })
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = { ...options.value, ...payload.options }
  if (!methods.value.includes(activeMethod.value)) {
    selectMethod(methods.value[0] ?? 'card')
  }
  if (selectedSaved.value && !savedMethods.value.some((saved) => saved.id === selectedSaved.value)) {
    selectedSaved.value = ''
  }
  bridge.send('nexus:ready', { elementType: 'payment' })
})

bridge.on('nexus:focus', () => {
  if (activeMethod.value === 'card') {
    ;(document.querySelector('.nexus-number') as HTMLInputElement)?.focus()
  } else {
    ;(document.querySelector('.nexus-bank-select') as HTMLSelectElement)?.focus()
  }
})

bridge.on('nexus:blur', () => {
  ;(document.activeElement as HTMLElement)?.blur()
})

bridge.on('nexus:collapse', () => {
  collapsed.value = !collapsed.value
  expandedMethod.value = collapsed.value ? '' : activeMethod.value
})

bridge.on('nexus:clear', () => {
  clearCard()
  selectedBank.value = ''
  selectedSaved.value = ''
  billingName.value = ''
  billingEmail.value = ''
  billingPhone.value = ''
})

bridge.on('nexus:tokenize', async (message) => {
  const payload = message.payload as { clientSecret: string; billingDetails?: Record<string, unknown> }
  const billingDetails = { ...collectedBillingDetails(), ...(payload.billingDetails ?? {}) }

  if (selectedSaved.value) {
    bridge.send('nexus:token-result', { paymentMethodId: selectedSaved.value })
    return
  }

  if (!billingComplete.value) {
    bridge.send('nexus:token-result', {
      error: { type: 'validation_error', message: emailInvalid.value ? t('emailInvalid') : t('billingIncomplete') },
    })
    return
  }

  if (activeMethod.value === 'card') {
    if (!cardValid.value || !cardComplete.value) {
      bridge.send('nexus:token-result', {
        error: {
          type: 'validation_error',
          message: cardError.value?.message ?? 'Your card details are incomplete.',
        },
      })
      return
    }

    await publishTokenResult({
      client_secret: payload.clientSecret,
      card: {
        number: number.value.replace(/\D/g, ''),
        exp_month: parseInt(expiry.value.slice(0, 2), 10),
        exp_year: 2000 + parseInt(expiry.value.slice(3, 5), 10),
        cvc: cvc.value,
      },
      billing_details: billingDetails,
      setup_future_usage: saveCard.value ? 'off_session' : undefined,
    })
    return
  }

  if (!bankComplete.value) {
    bridge.send('nexus:token-result', {
      error: { type: 'validation_error', message: 'Please select your bank.' },
    })
    return
  }

  await publishTokenResult({
    client_secret: payload.clientSecret,
    payment_method_type: activeMethod.value,
    [activeMethod.value]: { bank: selectedBank.value },
    billing_details: billingDetails,
  })
})

const brandIconHtml = computed(() => getBrandIcon(brand.value) ?? '💳')
</script>

<template>
  <div class="nexus-payment-element" :class="{ 'nexus-payment-element--collapsed': collapsed }" :style="{ zIndex: 'var(--nexus-z-index, auto)' }">
    <div v-if="showLink" class="nexus-link-embed">
      <p class="nexus-label">{{ t('linkTitle') }}</p>
      <input
        class="nexus-input"
        type="email"
        autocomplete="email"
        :aria-label="t('linkEmailLabel')"
        :placeholder="t('linkEmailPlaceholder')"
        :value="linkEmail"
        @input="linkEmail = ($event.target as HTMLInputElement).value"
      />
      <p class="nexus-hint">{{ t('linkEmbeddedHint') }}</p>
    </div>
    <!-- saved payment methods -->
    <div v-if="savedMethods.length > 0" class="nexus-saved-list">
      <p class="nexus-label nexus-saved-title">{{ t('savedCards') }}</p>
      <label v-for="saved in savedMethods" :key="saved.id" class="nexus-radio-label nexus-saved-item">
        <input
          type="radio"
          class="nexus-radio"
          name="nexus-saved-method"
          :value="saved.id"
          :checked="selectedSaved === saved.id"
          @change="selectedSaved = saved.id"
        />
        <span class="nexus-saved-brand">{{ saved.brand }}</span>
        <span>•••• {{ saved.last4 }}</span>
        <span v-if="saved.exp_month && saved.exp_year" class="nexus-saved-exp">
          {{ String(saved.exp_month).padStart(2, '0') }}/{{ String(saved.exp_year).slice(-2) }}
        </span>
      </label>
      <label class="nexus-radio-label nexus-saved-item">
        <input
          type="radio"
          class="nexus-radio"
          name="nexus-saved-method"
          value=""
          :checked="selectedSaved === ''"
          @change="selectedSaved = ''"
        />
        {{ t('useNewMethod') }}
      </label>
    </div>

    <template v-if="!selectedSaved">
    <!-- tabs layout -->
    <template v-if="layout === 'tabs'">
      <div class="nexus-tab-list" role="tablist">
        <button
          v-for="method in methods"
          :key="method"
          type="button"
          role="tab"
          class="nexus-tab"
          :class="{ 'nexus-tab--selected': activeMethod === method }"
          :aria-selected="activeMethod === method"
          @click="selectMethod(method)"
        >
          {{ methodLabel(method) }}
        </button>
      </div>
      <div class="nexus-block">
        <template v-if="activeMethod === 'card'">
          <div class="nexus-field-row">
            <input
              class="nexus-input nexus-number"
              type="text"
              inputmode="numeric"
              autocomplete="cc-number"
              aria-label="Card number"
              :aria-invalid="numberValidation.error && numberValidation.isComplete"
              placeholder="1234 1234 1234 1234"
              :value="number"
              @input="onNumberInput"
              @keydown="onNumberKeydown"
              @focus="onFocus('number')"
              @blur="onBlur"
              @paste="onPaste"
            />
            <span class="nexus-brand-icon" :data-brand="brand" v-html="brandIconHtml"></span>
          </div>
          <div class="nexus-field-row nexus-field-row--split">
            <input
              class="nexus-input nexus-expiry"
              type="text"
              inputmode="numeric"
              autocomplete="cc-exp"
              aria-label="Expiration date"
              :aria-invalid="expiryValidation.error && expiryValidation.isComplete"
              placeholder="MM / YY"
              :value="expiry"
              @input="onExpiryInput"
              @keydown="onExpiryKeydown"
              @focus="onFocus('expiry')"
              @blur="onBlur"
              @paste="onPaste"
            />
            <input
              class="nexus-input nexus-cvc"
              type="password"
              inputmode="numeric"
              autocomplete="cc-csc"
              aria-label="Security code"
              :aria-invalid="cvcValidation.error && cvcValidation.isComplete"
              placeholder="CVC"
              :value="cvc"
              @input="onCvcInput"
              @keydown="onCvcKeydown"
              @focus="onFocus('cvc')"
              @blur="onBlur"
              @paste="onPaste"
            />
          </div>
          <p v-if="cardError" class="nexus-error" role="alert" aria-live="polite">{{ cardError.message }}</p>
        </template>
        <template v-else>
          <label class="nexus-label" for="nexus-bank">{{ t('selectBankLabel') }}</label>
          <select
            id="nexus-bank"
            class="nexus-input nexus-bank-select"
            :value="selectedBank"
            @change="selectedBank = ($event.target as HTMLSelectElement).value"
            @focus="onFocus('bank')"
            @blur="onBlur"
          >
            <option value="" disabled>{{ t('selectBankPlaceholder') }}</option>
            <option v-for="bank in IDEAL_BANKS" :key="bank.id" :value="bank.id">{{ bank.name }}</option>
          </select>
        </template>
      </div>
    </template>

    <!-- accordion layout -->
    <template v-else-if="layout === 'accordion'">
      <div v-for="method in methods" :key="method" class="nexus-accordion-item">
        <button
          type="button"
          class="nexus-tab nexus-accordion-header"
          :class="{ 'nexus-tab--selected': expandedMethod === method }"
          :aria-expanded="expandedMethod === method"
          @click="selectMethod(method)"
        >
          <span>{{ methodLabel(method) }}</span>
          <span class="nexus-accordion-caret">{{ expandedMethod === method ? '▾' : '▸' }}</span>
        </button>
        <div v-if="expandedMethod === method" class="nexus-block">
          <template v-if="method === 'card'">
            <div class="nexus-field-row">
              <input
                class="nexus-input nexus-number"
                type="text"
                inputmode="numeric"
                autocomplete="cc-number"
                aria-label="Card number"
                :aria-invalid="numberValidation.error && numberValidation.isComplete"
                placeholder="1234 1234 1234 1234"
                :value="number"
                @input="onNumberInput"
                @keydown="onNumberKeydown"
                @focus="onFocus('number')"
                @blur="onBlur"
                @paste="onPaste"
              />
              <span class="nexus-brand-icon" :data-brand="brand" v-html="brandIconHtml"></span>
            </div>
            <div class="nexus-field-row nexus-field-row--split">
              <input
                class="nexus-input nexus-expiry"
                type="text"
                inputmode="numeric"
                autocomplete="cc-exp"
                aria-label="Expiration date"
                :aria-invalid="expiryValidation.error && expiryValidation.isComplete"
                placeholder="MM / YY"
                :value="expiry"
                @input="onExpiryInput"
                @keydown="onExpiryKeydown"
                @focus="onFocus('expiry')"
                @blur="onBlur"
                @paste="onPaste"
              />
              <input
                class="nexus-input nexus-cvc"
                type="password"
                inputmode="numeric"
                autocomplete="cc-csc"
                aria-label="Security code"
                :aria-invalid="cvcValidation.error && cvcValidation.isComplete"
                placeholder="CVC"
                :value="cvc"
                @input="onCvcInput"
                @keydown="onCvcKeydown"
                @focus="onFocus('cvc')"
                @blur="onBlur"
                @paste="onPaste"
              />
            </div>
            <p v-if="cardError" class="nexus-error" role="alert" aria-live="polite">{{ cardError.message }}</p>
          </template>
          <template v-else>
            <label class="nexus-label" for="nexus-bank-accordion">{{ t('selectBankLabel') }}</label>
            <select
              id="nexus-bank-accordion"
              class="nexus-input nexus-bank-select"
              :value="selectedBank"
              @change="selectedBank = ($event.target as HTMLSelectElement).value"
              @focus="onFocus('bank')"
              @blur="onBlur"
            >
              <option value="" disabled>{{ t('selectBankPlaceholder') }}</option>
              <option v-for="bank in IDEAL_BANKS" :key="bank.id" :value="bank.id">{{ bank.name }}</option>
            </select>
          </template>
        </div>
      </div>
    </template>

    <!-- radio layout -->
    <template v-else>
      <div v-for="method in methods" :key="method" class="nexus-radio-item">
        <label class="nexus-radio-label">
          <input
            type="radio"
            class="nexus-radio"
            name="nexus-payment-method"
            :value="method"
            :checked="activeMethod === method"
            @change="selectMethod(method)"
          />
          {{ methodLabel(method) }}
        </label>
        <div v-if="activeMethod === method" class="nexus-block">
          <template v-if="method === 'card'">
            <div class="nexus-field-row">
              <input
                class="nexus-input nexus-number"
                type="text"
                inputmode="numeric"
                autocomplete="cc-number"
                aria-label="Card number"
                :aria-invalid="numberValidation.error && numberValidation.isComplete"
                placeholder="1234 1234 1234 1234"
                :value="number"
                @input="onNumberInput"
                @keydown="onNumberKeydown"
                @focus="onFocus('number')"
                @blur="onBlur"
                @paste="onPaste"
              />
              <span class="nexus-brand-icon" :data-brand="brand" v-html="brandIconHtml"></span>
            </div>
            <div class="nexus-field-row nexus-field-row--split">
              <input
                class="nexus-input nexus-expiry"
                type="text"
                inputmode="numeric"
                autocomplete="cc-exp"
                aria-label="Expiration date"
                :aria-invalid="expiryValidation.error && expiryValidation.isComplete"
                placeholder="MM / YY"
                :value="expiry"
                @input="onExpiryInput"
                @keydown="onExpiryKeydown"
                @focus="onFocus('expiry')"
                @blur="onBlur"
                @paste="onPaste"
              />
              <input
                class="nexus-input nexus-cvc"
                type="password"
                inputmode="numeric"
                autocomplete="cc-csc"
                aria-label="Security code"
                :aria-invalid="cvcValidation.error && cvcValidation.isComplete"
                placeholder="CVC"
                :value="cvc"
                @input="onCvcInput"
                @keydown="onCvcKeydown"
                @focus="onFocus('cvc')"
                @blur="onBlur"
                @paste="onPaste"
              />
            </div>
            <p v-if="cardError" class="nexus-error" role="alert" aria-live="polite">{{ cardError.message }}</p>
          </template>
          <template v-else>
            <label class="nexus-label" for="nexus-bank-radio">{{ t('selectBankLabel') }}</label>
            <select
              id="nexus-bank-radio"
              class="nexus-input nexus-bank-select"
              :value="selectedBank"
              @change="selectedBank = ($event.target as HTMLSelectElement).value"
              @focus="onFocus('bank')"
              @blur="onBlur"
            >
              <option value="" disabled>{{ t('selectBankPlaceholder') }}</option>
              <option v-for="bank in IDEAL_BANKS" :key="bank.id" :value="bank.id">{{ bank.name }}</option>
            </select>
          </template>
        </div>
      </div>
    </template>

    <label v-if="allowSave && activeMethod === 'card' && !selectedSaved" class="nexus-checkbox">
      <input
        type="checkbox"
        class="nexus-checkbox-input"
        :class="{ 'nexus-checkbox-input--checked': saveCard }"
        :checked="saveCard"
        :aria-label="t('ariaSaveCard')"
        @change="saveCard = ($event.target as HTMLInputElement).checked"
      />
      <span>{{ t('saveCard') }}</span>
    </label>

    <!-- billing details (PE-010 / PE-011) -->
    <div
      v-if="billingFields.name.visible || billingFields.email.visible || billingFields.phone.visible"
      class="nexus-block nexus-billing"
    >
      <input
        v-if="billingFields.name.visible"
        class="nexus-input nexus-billing-input nexus-billing-name"
        type="text"
        autocomplete="name"
        :aria-label="t('fullName')"
        :placeholder="t('fullName') + (billingFields.name.required ? '' : ` (${t('optionalSuffix')})`)"
        :value="billingName"
        @input="billingName = ($event.target as HTMLInputElement).value"
        @focus="onFocus('billingName')"
        @blur="onBlur"
      />
      <input
        v-if="billingFields.email.visible"
        class="nexus-input nexus-billing-input nexus-billing-email"
        type="email"
        autocomplete="email"
        :aria-label="t('emailLabel')"
        :aria-invalid="emailInvalid"
        :placeholder="t('emailLabel') + (billingFields.email.required ? '' : ` (${t('optionalSuffix')})`)"
        :value="billingEmail"
        @input="billingEmail = ($event.target as HTMLInputElement).value"
        @focus="onFocus('billingEmail')"
        @blur="onBlur"
      />
      <input
        v-if="billingFields.phone.visible"
        class="nexus-input nexus-billing-input nexus-billing-phone"
        type="tel"
        autocomplete="tel"
        :aria-label="t('phone')"
        :placeholder="t('phone') + (billingFields.phone.required ? '' : ` (${t('optionalSuffix')})`)"
        :value="billingPhone"
        @input="billingPhone = ($event.target as HTMLInputElement).value"
        @focus="onFocus('billingPhone')"
        @blur="onBlur"
      />
      <p v-if="emailInvalid" class="nexus-error" role="alert" aria-live="polite">{{ t('emailInvalid') }}</p>
    </div>
    </template>
  </div>
</template>

<style scoped>
.nexus-payment-element {
  font-family: var(--nexus-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: var(--nexus-font-size, 16px);
  color: var(--nexus-color-text, #30313d);
}

.nexus-tab-list {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}

.nexus-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid var(--nexus-color-border, #e0e0e0);
  border-radius: var(--nexus-border-radius, 6px);
  background: var(--nexus-color-background, #fff);
  color: var(--nexus-color-text, #30313d);
  font: inherit;
  font-size: 14px;
  cursor: pointer;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.nexus-tab:hover {
  border-color: var(--nexus-color-border-focus, #635bff);
}

.nexus-tab--selected {
  border-color: var(--nexus-color-border-focus, #635bff);
  box-shadow: 0 0 0 1px var(--nexus-color-border-focus, #635bff);
}

.nexus-accordion-item {
  margin-bottom: 6px;
}

.nexus-accordion-header {
  width: 100%;
}

.nexus-accordion-caret {
  font-size: 12px;
  color: var(--nexus-color-text-secondary, #8792a2);
}

.nexus-radio-item {
  margin-bottom: 6px;
}

.nexus-radio-label {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid var(--nexus-color-border, #e0e0e0);
  border-radius: var(--nexus-border-radius, 6px);
  background: var(--nexus-color-background, #fff);
  font-size: 14px;
  cursor: pointer;
}

.nexus-radio {
  accent-color: var(--nexus-color-primary, #635bff);
}

.nexus-block {
  border: 1px solid var(--nexus-color-border, #e0e0e0);
  border-radius: var(--nexus-border-radius, 6px);
  background: var(--nexus-color-background, #fff);
  padding: var(--nexus-spacing, 10px 12px);
  margin-top: 6px;
}

.nexus-field-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nexus-field-row--split {
  margin-top: 8px;
}

.nexus-field-row--split .nexus-input {
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

select.nexus-input {
  margin-top: 6px;
  padding: 6px 0;
  cursor: pointer;
}

.nexus-input::placeholder {
  color: var(--nexus-color-text-placeholder, #8792a2);
}

.nexus-label {
  font-size: 13px;
  color: var(--nexus-color-text-secondary, #8792a2);
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

.nexus-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 0;
  font-size: var(--nexus-font-size-sm, 13px);
  color: var(--nexus-color-text, #30313d);
}
.nexus-checkbox-input {
  width: 16px;
  height: 16px;
  accent-color: var(--nexus-color-primary, #635bff);
}
.nexus-checkbox-input--checked {
  outline: var(--nexus-outline, none);
}
.nexus-link-embed {
  margin-bottom: 10px;
}
.nexus-hint {
  margin-top: 4px;
  font-size: 12px;
  color: var(--nexus-color-text-secondary, #6b7280);
}
.nexus-payment-element--collapsed .nexus-block {
  display: none;
}
.nexus-error {
  margin-top: 6px;
  font-size: 13px;
  color: var(--nexus-color-danger, #df1b41);
}

.nexus-saved-list {
  margin-bottom: 8px;
}

.nexus-saved-title {
  margin-bottom: 6px;
}

.nexus-saved-item {
  margin-bottom: 6px;
}

.nexus-saved-brand {
  text-transform: capitalize;
  font-weight: 500;
}

.nexus-saved-exp {
  color: var(--nexus-color-text-secondary, #8792a2);
  font-size: 13px;
}

.nexus-billing {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nexus-billing-input {
  border: 1px solid var(--nexus-color-border, #e0e0e0);
  border-radius: var(--nexus-border-radius, 6px);
  padding: 8px 10px;
  font-size: 14px;
}

.nexus-billing-input:focus {
  border-color: var(--nexus-color-border-focus, #635bff);
}
</style>
