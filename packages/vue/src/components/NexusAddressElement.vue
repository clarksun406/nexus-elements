<script setup lang="ts">
import NexusElement from './NexusElement.vue'
import type { AddressElementOptions } from '@nexus-elements/core'

defineProps<{
  options?: AddressElementOptions
}>()

</script>

<template>
  <NexusElement type="address" :options="options as unknown as Record<string, unknown>" v-bind="$attrs" />
</template>
