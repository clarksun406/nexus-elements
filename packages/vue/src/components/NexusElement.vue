<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, inject } from 'vue'
import type { NexusElement, ElementType, ElementEventType } from '@nexus-elements/core'
import { NexusKey } from '../context'

const props = defineProps<{
  type: ElementType
  options?: Record<string, unknown>
}>()

const emit = defineEmits<{
  ready: [event: unknown]
  change: [event: unknown]
  focus: [event: unknown]
  blur: [event: unknown]
  error: [event: unknown]
  escape: [event: unknown]
  click: [event: unknown]
  confirm: [event: unknown]
  cancel: [event: unknown]
  loaderror: [event: unknown]
}>()

const context = inject(NexusKey)
if (!context) {
  throw new Error('<NexusElement> must be used within a <NexusElements> provider component.')
}

const containerRef = ref<HTMLElement | null>(null)
let element: NexusElement | null = null

const EVENT_NAMES: ElementEventType[] = ['ready', 'change', 'focus', 'blur', 'error', 'escape', 'click', 'confirm', 'cancel', 'loaderror']

onMounted(() => {
  if (!containerRef.value) return

  element = context.elements.create(props.type, props.options ?? {})

  for (const eventName of EVENT_NAMES) {
    element.on(eventName, (event: unknown) => {
      emit(eventName as 'ready', event)
    })
  }

  element.mount(containerRef.value)
})

watch(
  () => props.options,
  (options) => {
    if (element && options) {
      element.update(options)
    }
  },
  { deep: true },
)

onBeforeUnmount(() => {
  element?.destroy()
  element = null
})

defineExpose({
  getElement: () => element,
  focus: () => element?.focus(),
  blur: () => element?.blur(),
  clear: () => element?.clear(),
  collapse: () => element?.collapse(),
  fetchUpdates: () => element?.fetchUpdates(),
})
</script>

<template>
  <div ref="containerRef" class="nexus-element-container" />
</template>
