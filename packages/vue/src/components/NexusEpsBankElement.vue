<script setup lang="ts">
import NexusElement from './NexusElement.vue'
import type { EpsBankElementOptions } from '@nexus-elements/core'

defineProps<{
  options?: EpsBankElementOptions
}>()
</script>

<template>
  <NexusElement type="epsBank" :options="options as Record<string, unknown>" v-bind="$attrs" />
</template>
