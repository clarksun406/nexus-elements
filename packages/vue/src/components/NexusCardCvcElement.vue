<script setup lang="ts">
import NexusElement from './NexusElement.vue'
import type { CardCvcElementOptions } from '@nexus-elements/core'

defineProps<{
  options?: CardCvcElementOptions
}>()

</script>

<template>
  <NexusElement type="cardCvc" :options="options as Record<string, unknown>" v-bind="$attrs" />
</template>
