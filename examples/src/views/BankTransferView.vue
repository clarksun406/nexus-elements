<script setup lang="ts">
import { ref } from 'vue'
import { NexusElements, NexusIdealBankElement, NexusIbanElement, NexusAuBankAccountElement, NexusFpxBankElement, NexusEpsBankElement, NexusP24BankElement } from '@nexus-elements/vue'
import type { ChangeEvent } from '@nexus-elements/core'

const PUBLISHABLE_KEY = 'pk_test_nexus_example_key'

type BankTab = 'ideal' | 'iban' | 'auBecs' | 'fpx' | 'eps' | 'p24'
const activeTab = ref<BankTab>('ideal')
const lastChange = ref<ChangeEvent | null>(null)

const tabs: Array<{ id: BankTab; label: string; region: string }> = [
  { id: 'ideal', label: 'iDEAL', region: 'NL' },
  { id: 'iban', label: 'IBAN', region: 'EU' },
  { id: 'auBecs', label: 'BECS', region: 'AU' },
  { id: 'fpx', label: 'FPX', region: 'MY' },
  { id: 'eps', label: 'EPS', region: 'AT' },
  { id: 'p24', label: 'P24', region: 'PL' },
]

function onChange(event: unknown) {
  lastChange.value = event as ChangeEvent
}
</script>

<template>
  <NexusElements :publishable-key="PUBLISHABLE_KEY" fields-url="/fields/index.html">
    <div class="payment-card">
      <router-link to="/" class="breadcrumb">&larr; 返回示例列表</router-link>
      <h1>银行转账组件</h1>
      <p class="subtitle">Bank Transfer Elements — iDEAL / IBAN / BECS / FPX / EPS / P24</p>

      <div class="tab-bar">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === tab.id }"
          @click="activeTab = tab.id; lastChange = null"
        >
          {{ tab.label }}
          <span class="tab-region">{{ tab.region }}</span>
        </button>
      </div>

      <div class="field-group">
        <NexusIdealBankElement v-if="activeTab === 'ideal'" :options="{ placeholder: 'Search your bank...' }" @change="onChange" />
        <NexusIbanElement v-else-if="activeTab === 'iban'" :options="{ placeholderCountry: 'DE' }" @change="onChange" />
        <NexusAuBankAccountElement v-else-if="activeTab === 'auBecs'" @change="onChange" />
        <NexusFpxBankElement v-else-if="activeTab === 'fpx'" @change="onChange" />
        <NexusEpsBankElement v-else-if="activeTab === 'eps'" @change="onChange" />
        <NexusP24BankElement v-else-if="activeTab === 'p24'" @change="onChange" />
      </div>

      <div v-if="lastChange" class="result-box" :class="{ 'result-box--success': lastChange.complete }">
        <p>complete: {{ lastChange.complete }} · valid: {{ lastChange.valid }} · empty: {{ lastChange.empty }}</p>
        <pre class="value-dump">{{ JSON.stringify(lastChange.value, null, 2) }}</pre>
      </div>
    </div>
  </NexusElements>
</template>

<style scoped>
.tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 6px 14px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  color: #4b5563;
  transition: all 0.15s ease;
}

.tab-btn:hover {
  background: #f6f9fc;
}

.tab-btn--active {
  background: #635bff;
  color: #fff;
  border-color: #635bff;
}

.tab-region {
  font-size: 10px;
  opacity: 0.7;
  margin-left: 4px;
}

.value-dump {
  margin-top: 8px;
  font-size: 11px;
  background: #f9fafb;
  padding: 8px;
  border-radius: 6px;
  overflow-x: auto;
}
</style>
