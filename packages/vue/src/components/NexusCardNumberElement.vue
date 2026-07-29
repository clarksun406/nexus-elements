<script setup lang="ts">
import { ref } from 'vue'
import NexusElement from './NexusElement.vue'
import type { CardNumberElementOptions } from '@nexus-elements/core'

defineProps<{
  options?: CardNumberElementOptions
}>()

const elementRef = ref<InstanceType<typeof NexusElement> | null>(null)

defineExpose({
  getElement: () => elementRef.value?.getElement(),
  focus: () => elementRef.value?.focus(),
  blur: () => elementRef.value?.blur(),
  clear: () => elementRef.value?.clear(),
})
</script>

<template>
  <NexusElement ref="elementRef" type="cardNumber" :options="options as Record<string, unknown>" v-bind="$attrs" />
</template>
