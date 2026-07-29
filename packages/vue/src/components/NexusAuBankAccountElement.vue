<script setup lang="ts">
import NexusElement from './NexusElement.vue'
import type { AuBankAccountElementOptions } from '@nexus-elements/core'

defineProps<{
  options?: AuBankAccountElementOptions
}>()
</script>

<template>
  <NexusElement type="auBankAccount" :options="options as Record<string, unknown>" v-bind="$attrs" />
</template>
