<script setup lang="ts">
import NexusElement from './NexusElement.vue'
import type { ExpressCheckoutElementOptions } from '@nexus-elements/core'

defineProps<{
  options?: ExpressCheckoutElementOptions
}>()

</script>

<template>
  <NexusElement type="expressCheckout" :options="options as Record<string, unknown>" v-bind="$attrs" />
</template>
