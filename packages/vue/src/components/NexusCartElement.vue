<script setup lang="ts">
import NexusElement from './NexusElement.vue'

defineProps<{
  options: Record<string, unknown>
}>()
</script>

<template>
  <NexusElement type="cart" :options="options" v-bind="$attrs" />
</template>
