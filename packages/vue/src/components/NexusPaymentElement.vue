<script setup lang="ts">
import NexusElement from './NexusElement.vue'
import type { PaymentElementOptions } from '@nexus-elements/core'

defineProps<{
  options?: PaymentElementOptions
}>()

</script>

<template>
  <NexusElement type="payment" :options="options as Record<string, unknown>" v-bind="$attrs" />
</template>
