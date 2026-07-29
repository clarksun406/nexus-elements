<script setup lang="ts">
import NexusElement from './NexusElement.vue'
import type { CardExpiryElementOptions } from '@nexus-elements/core'

defineProps<{
  options?: CardExpiryElementOptions
}>()

</script>

<template>
  <NexusElement type="cardExpiry" :options="options as Record<string, unknown>" v-bind="$attrs" />
</template>
