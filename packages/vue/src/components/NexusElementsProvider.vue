<script setup lang="ts">
import { provide, ref, onBeforeUnmount, watch } from 'vue'
import { createNexus } from '@nexus-elements/core'
import type { Nexus, NexusElements as NexusElementsInstance, ElementsOptions } from '@nexus-elements/core'
import { NexusKey } from '../context'

const props = defineProps<{
  publishableKey: string
  options?: ElementsOptions
  fieldsUrl?: string
}>()

const emit = defineEmits<{
  ready: [nexus: Nexus, elements: NexusElementsInstance]
}>()

const ready = ref(false)

let nexus: Nexus = createNexus(props.publishableKey)
if (props.fieldsUrl) {
  nexus.setFieldsUrl(props.fieldsUrl)
}
let elements: NexusElementsInstance = nexus.elements(props.options ?? {})

watch(
  () => props.publishableKey,
  (key) => {
    elements.destroyAll()
    nexus = createNexus(key)
    if (props.fieldsUrl) {
      nexus.setFieldsUrl(props.fieldsUrl)
    }
    elements = nexus.elements(props.options ?? {})
    ready.value = true
    emit('ready', nexus, elements)
  },
)

watch(
  () => props.options,
  (options) => {
    if (options) {
      elements.update(options)
    }
  },
  { deep: true },
)

provide(NexusKey, { nexus, elements, ready })

ready.value = true
emit('ready', nexus, elements)

onBeforeUnmount(() => {
  elements.destroyAll()
})
</script>

<template>
  <slot />
</template>
