<script setup lang="ts">
import NexusElement from './NexusElement.vue'
import type { P24BankElementOptions } from '@nexus-elements/core'

defineProps<{
  options?: P24BankElementOptions
}>()
</script>

<template>
  <NexusElement type="p24Bank" :options="options as Record<string, unknown>" v-bind="$attrs" />
</template>
