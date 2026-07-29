<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { bridge } from '../bridge'
import { t } from '../i18n'
import { IDEAL_BANKS, type BankEntry } from '../bank-data'

const options = ref<Record<string, unknown>>({})
const search = ref('')
const selectedBank = ref<string | null>(null)
const focused = ref(false)

const filteredBanks = computed<BankEntry[]>(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return IDEAL_BANKS
  return IDEAL_BANKS.filter((b) => b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q))
})

const isEmpty = computed(() => !selectedBank.value)
const isComplete = computed(() => !!selectedBank.value)

watch([isComplete, isEmpty, selectedBank], () => {
  bridge.send('nexus:change', {
    complete: isComplete.value,
    empty: isEmpty.value,
    valid: isComplete.value,
    elementType: 'idealBank',
    value: selectedBank.value ? { bank: selectedBank.value } : undefined,
  })
})

bridge.on('nexus:init', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = payload.options ?? {}
  bridge.send('nexus:ready', { elementType: 'idealBank' })
})

bridge.on('nexus:update', (message) => {
  const payload = message.payload as { options: Record<string, unknown> }
  options.value = { ...options.value, ...payload.options }
})

bridge.on('nexus:focus', () => {
  ;(document.querySelector('.nexus-bank-search') as HTMLElement)?.focus()
  focused.value = true
})

bridge.on('nexus:blur', () => {
  ;(document.activeElement as HTMLElement)?.blur()
  focused.value = false
})

bridge.on('nexus:clear', () => {
  selectedBank.value = null
  search.value = ''
})

bridge.on('nexus:tokenize', () => {
  if (!selectedBank.value) {
    bridge.send('nexus:token-result', {
      error: { type: 'validation_error', code: 'incomplete', message: t('selectBankPlaceholder') },
    })
    return
  }
  bridge.send('nexus:token-result', {
    token: `tok_test_ideal_${selectedBank.value}`,
    paymentMethodType: 'ideal',
    ideal: { bank: selectedBank.value },
  })
})

bridge.on('nexus:collect-data', () => {
  bridge.send('nexus:collect-result', { ideal: { bank: selectedBank.value } })
})

function selectBank(bankId: string) {
  selectedBank.value = bankId
  bridge.send('nexus:focus-event', {})
}

function onFocus() {
  focused.value = true
  bridge.send('nexus:focus-event', {})
}

function onBlur() {
  focused.value = false
  bridge.send('nexus:blur-event', {})
}

const disabled = computed(() => options.value.disabled === true)
</script>

<template>
  <div class="nexus-bank-element" :class="{ 'nexus--disabled': disabled }" @keydown.esc="bridge.send('nexus:escape', {})">
    <label class="nexus-label">
      {{ t('selectBankLabel') }}
      <input
        class="nexus-input nexus-bank-search"
        type="text"
        :aria-label="t('selectBankLabel')"
        :placeholder="t('selectBankPlaceholder')"
        :disabled="disabled"
        :value="search"
        @input="search = ($event.target as HTMLInputElement).value"
        @focus="onFocus"
        @blur="onBlur"
      />
    </label>

    <ul class="nexus-bank-list" role="listbox" :aria-label="t('selectBankLabel')">
      <li
        v-for="bank in filteredBanks"
        :key="bank.id"
        class="nexus-bank-item"
        :class="{ 'nexus-bank-item--selected': selectedBank === bank.id }"
        role="option"
        :aria-selected="selectedBank === bank.id"
        tabindex="0"
        @click="!disabled && selectBank(bank.id)"
        @keydown.enter="!disabled && selectBank(bank.id)"
        @keydown.space.prevent="!disabled && selectBank(bank.id)"
      >
        <span class="nexus-bank-icon">{{ bank.name.charAt(0) }}</span>
        <span class="nexus-bank-name">{{ bank.name }}</span>
        <span v-if="selectedBank === bank.id" class="nexus-bank-check">&#10003;</span>
      </li>
      <li v-if="filteredBanks.length === 0" class="nexus-bank-empty">No banks found</li>
    </ul>
  </div>
</template>

<style scoped>
.nexus-bank-element {
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-family: var(--nexus-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
  font-size: var(--nexus-font-size, 16px);
  color: var(--nexus-color-text, #30313d);
  padding: 2px;
}

.nexus-bank-element.nexus--disabled {
  opacity: 0.6;
}

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
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.nexus-input:focus {
  border-color: var(--nexus-color-border-focus, #635bff);
  box-shadow: 0 0 0 1px var(--nexus-color-border-focus, #635bff);
}

.nexus-input::placeholder {
  color: var(--nexus-color-text-placeholder, #8792a2);
}

.nexus-bank-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--nexus-color-border, #e0e0e0);
  border-radius: var(--nexus-border-radius, 6px);
}

.nexus-bank-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background-color 0.1s ease;
}

.nexus-bank-item:hover {
  background: var(--nexus-color-background-hover, #f6f9fc);
}

.nexus-bank-item--selected {
  background: var(--nexus-color-primary-light, #e8e5ff);
  color: var(--nexus-color-primary, #635bff);
}

.nexus-bank-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: var(--nexus-color-border, #e0e0e0);
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.nexus-bank-item--selected .nexus-bank-icon {
  background: var(--nexus-color-primary, #635bff);
  color: #fff;
}

.nexus-bank-name {
  flex: 1;
  font-size: 14px;
}

.nexus-bank-check {
  font-size: 14px;
  font-weight: 600;
}

.nexus-bank-empty {
  padding: 12px;
  text-align: center;
  color: var(--nexus-color-text-secondary, #8792a2);
  font-size: 13px;
}
</style>
