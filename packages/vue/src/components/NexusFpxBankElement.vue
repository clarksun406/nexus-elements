<script setup lang="ts">
import NexusElement from './NexusElement.vue'
import type { FpxBankElementOptions } from '@nexus-elements/core'

defineProps<{
  options?: FpxBankElementOptions
}>()
</script>

<template>
  <NexusElement type="fpxBank" :options="options as Record<string, unknown>" v-bind="$attrs" />
</template>
