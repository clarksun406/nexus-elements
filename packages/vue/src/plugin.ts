import type { App } from 'vue'
import type { ElementsOptions } from '@nexus-elements/core'
import NexusElementsProvider from './components/NexusElementsProvider.vue'
import NexusElement from './components/NexusElement.vue'
import NexusCardElement from './components/NexusCardElement.vue'
import NexusCardNumberElement from './components/NexusCardNumberElement.vue'
import NexusCardExpiryElement from './components/NexusCardExpiryElement.vue'
import NexusCardCvcElement from './components/NexusCardCvcElement.vue'
import NexusPaymentElement from './components/NexusPaymentElement.vue'
import NexusIbanElement from './components/NexusIbanElement.vue'
import NexusAddressElement from './components/NexusAddressElement.vue'
import NexusExpressCheckoutElement from './components/NexusExpressCheckoutElement.vue'

export interface NexusVuePluginOptions {
  publishableKey: string
  elementsOptions?: ElementsOptions
  fieldsUrl?: string
}

export const NexusVuePlugin = {
  install(app: App, options?: NexusVuePluginOptions) {
    app.component('NexusElements', NexusElementsProvider)
    app.component('NexusElement', NexusElement)
    app.component('NexusCardElement', NexusCardElement)
    app.component('NexusCardNumberElement', NexusCardNumberElement)
    app.component('NexusCardExpiryElement', NexusCardExpiryElement)
    app.component('NexusCardCvcElement', NexusCardCvcElement)
    app.component('NexusPaymentElement', NexusPaymentElement)
    app.component('NexusIbanElement', NexusIbanElement)
    app.component('NexusAddressElement', NexusAddressElement)
    app.component('NexusExpressCheckoutElement', NexusExpressCheckoutElement)

    if (options) {
      app.provide('nexus-plugin-options', options)
    }
  },
}
