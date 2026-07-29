<script setup lang="ts">
import NexusElement from './NexusElement.vue'
import type { IdealBankElementOptions } from '@nexus-elements/core'

defineProps<{
  options?: IdealBankElementOptions
}>()
</script>

<template>
  <NexusElement type="idealBank" :options="options as Record<string, unknown>" v-bind="$attrs" />
</template>
