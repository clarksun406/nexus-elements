import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../views/HomeView.vue'),
    },
    {
      path: '/card-combined',
      name: 'card-combined',
      component: () => import('../views/CardCombinedView.vue'),
    },
    {
      path: '/card-split',
      name: 'card-split',
      component: () => import('../views/CardSplitView.vue'),
    },
    {
      path: '/payment-element',
      name: 'payment-element',
      component: () => import('../views/PaymentElementView.vue'),
    },
    {
      path: '/express-checkout',
      name: 'express-checkout',
      component: () => import('../views/ExpressCheckoutView.vue'),
    },
    {
      path: '/setup-intent',
      name: 'setup-intent',
      component: () => import('../views/SetupIntentView.vue'),
    },
    {
      path: '/address',
      name: 'address',
      component: () => import('../views/AddressView.vue'),
    },
    {
      path: '/embedded-checkout',
      name: 'embedded-checkout',
      component: () => import('../views/EmbeddedCheckoutView.vue'),
    },
    {
      path: '/redirect-checkout',
      name: 'redirect-checkout',
      component: () => import('../views/RedirectCheckoutView.vue'),
    },
    {
      path: '/redirect-success',
      name: 'redirect-success',
      component: () => import('../views/RedirectSuccessView.vue'),
    },
    {
      path: '/bank-transfer',
      name: 'bank-transfer',
      component: () => import('../views/BankTransferView.vue'),
    },
    {
      path: '/billing',
      name: 'billing',
      component: () => import('../views/BillingView.vue'),
    },
    {
      path: '/payment-messaging',
      name: 'payment-messaging',
      component: () => import('../views/PaymentMessagingView.vue'),
    },
    {
      path: '/link-authentication',
      name: 'link-authentication',
      component: () => import('../views/LinkAuthenticationView.vue'),
    },
    {
      path: '/cart',
      name: 'cart',
      component: () => import('../views/CartView.vue'),
    },
    {
      path: '/order',
      name: 'order',
      component: () => import('../views/OrderView.vue'),
    },
    {
      path: '/afterpay-clearpay',
      name: 'afterpay-clearpay',
      component: () => import('../views/AfterpayClearpayView.vue'),
    },
    {
      path: '/wallet-button',
      name: 'wallet-button',
      component: () => import('../views/WalletButtonView.vue'),
    },
  ],
})
