<script setup lang="ts">
import NexusElement from './NexusElement.vue'
import type { IbanElementOptions } from '@nexus-elements/core'

defineProps<{
  options?: IbanElementOptions
}>()

</script>

<template>
  <NexusElement type="iban" :options="options as Record<string, unknown>" v-bind="$attrs" />
</template>
