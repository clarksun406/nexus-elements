<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import { t } from '../i18n'

const SANDBOX_CODE = '123456'
const DEMO_EMAIL = 'link.demo@nexus.test'

const props = defineProps<{
  disabled?: boolean
  defaultEmail?: string
}>()

const emit = defineEmits<{
  state: [payload: { complete: boolean; empty: boolean; verified: boolean; email?: string; error?: string }]
}>()

const step = ref<'email' | 'otp' | 'verified'>('email')
const email = ref(props.defaultEmail ?? '')
const otp = ref(['', '', '', '', '', ''])
const error = ref('')
const sending = ref(false)
const verifying = ref(false)
const countdown = ref(0)
let countdownTimer: ReturnType<typeof setInterval> | null = null

const emailInvalid = computed(
  () => email.value !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value),
)
const otpValue = computed(() => otp.value.join(''))
const isOtpComplete = computed(() => otpValue.value.length === 6)

const statePayload = computed(() => ({
  complete: step.value === 'verified',
  empty: step.value === 'email' && !email.value,
  verified: step.value === 'verified',
  email: step.value === 'verified' ? email.value : undefined,
  error: error.value || undefined,
}))

watch(statePayload, (payload) => emit('state', payload), { immediate: true, deep: true })

function startCountdown() {
  countdown.value = 30
  countdownTimer = setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0 && countdownTimer) {
      clearInterval(countdownTimer)
      countdownTimer = null
    }
  }, 1000)
}

function sendCode() {
  if (emailInvalid.value || !email.value.trim()) {
    error.value = t('emailInvalid')
    return
  }
  error.value = ''
  sending.value = true
  setTimeout(() => {
    sending.value = false
    step.value = 'otp'
    startCountdown()
    otp.value = ['', '', '', '', '', '']
    setTimeout(() => {
      const first = document.querySelector('.nexus-payment-link-otp') as HTMLInputElement
      first?.focus()
    }, 40)
  }, 500)
}

function onOtpInput(index: number, event: Event) {
  const input = event.target as HTMLInputElement
  const val = input.value.replace(/\D/g, '').slice(0, 1)
  otp.value[index] = val
  if (val && index < 5) {
    const next = document.querySelectorAll('.nexus-payment-link-otp')[index + 1] as HTMLInputElement
    next?.focus()
  }
}

function onOtpKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace' && !otp.value[index] && index > 0) {
    const prev = document.querySelectorAll('.nexus-payment-link-otp')[index - 1] as HTMLInputElement
    prev?.focus()
    otp.value[index - 1] = ''
  }
}

function verifyOtp() {
  if (!isOtpComplete.value) return
  error.value = ''
  verifying.value = true
  setTimeout(() => {
    verifying.value = false
    if (otpValue.value !== SANDBOX_CODE) {
      error.value = t('linkSandboxOtpInvalid')
      otp.value = ['', '', '', '', '', '']
      return
    }
    step.value = 'verified'
  }, 400)
}

function resetLink() {
  step.value = 'email'
  error.value = ''
  otp.value = ['', '', '', '', '', '']
}

onBeforeUnmount(() => {
  if (countdownTimer) clearInterval(countdownTimer)
})

defineExpose({ resetLink })
</script>

<template>
  <section class="nexus-link-embed" aria-labelledby="nexus-link-embed-title">
    <p id="nexus-link-embed-title" class="nexus-label">{{ t('linkTitle') }}</p>
    <p class="nexus-link-sandbox-badge" role="note">{{ t('linkSandboxBadge') }}</p>
    <p class="nexus-hint">{{ t('linkEmbeddedHint') }}</p>

    <template v-if="step === 'email'">
      <label class="nexus-sr-only" for="nexus-link-email">{{ t('linkEmailLabel') }}</label>
      <input
        id="nexus-link-email"
        class="nexus-input nexus-link-email"
        type="email"
        autocomplete="email"
        :disabled="disabled"
        :aria-invalid="emailInvalid"
        :placeholder="t('linkEmailPlaceholder')"
        :value="email"
        @input="email = ($event.target as HTMLInputElement).value"
      />
      <p v-if="emailInvalid" class="nexus-error" role="alert">{{ t('emailInvalid') }}</p>
      <p v-if="email === DEMO_EMAIL" class="nexus-hint">{{ t('linkSandboxDemoHint') }}</p>
      <button type="button" class="nexus-link-action" :disabled="disabled || sending || emailInvalid || !email" @click="sendCode">
        {{ sending ? t('linkSandboxSending') : t('linkSandboxSendCode') }}
      </button>
    </template>

    <template v-else-if="step === 'otp'">
      <p class="nexus-hint">{{ t('linkSandboxOtpSentPrefix') }} {{ email }}</p>
      <div class="nexus-link-otp-row" role="group" :aria-label="t('linkSandboxOtpLabel')">
        <input
          v-for="(_, index) in otp"
          :key="index"
          class="nexus-input nexus-link-otp nexus-payment-link-otp"
          type="text"
          inputmode="numeric"
          maxlength="1"
          :disabled="disabled"
          :aria-label="`${t('linkSandboxOtpDigit')} ${index + 1}`"
          :value="otp[index]"
          @input="onOtpInput(index, $event)"
          @keydown="onOtpKeydown(index, $event)"
        />
      </div>
      <button type="button" class="nexus-link-action" :disabled="disabled || verifying || !isOtpComplete" @click="verifyOtp">
        {{ verifying ? t('linkSandboxVerifying') : t('linkSandboxVerify') }}
      </button>
      <button type="button" class="nexus-link-secondary" :disabled="disabled || countdown > 0" @click="sendCode">
        {{ countdown > 0 ? `${t('linkSandboxResendWait')} (${countdown})` : t('linkSandboxResend') }}
      </button>
      <button type="button" class="nexus-link-secondary" @click="resetLink">{{ t('expressCancel') }}</button>
    </template>

    <template v-else>
      <p class="nexus-link-verified" role="status">{{ t('linkSandboxVerifiedPrefix') }} {{ email }}</p>
      <button type="button" class="nexus-link-secondary" @click="resetLink">{{ t('linkOrPayAnotherWay') }}</button>
    </template>

    <p v-if="error" class="nexus-error" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.nexus-link-sandbox-badge {
  display: inline-block;
  margin: 4px 0 8px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  background: #fef3c7;
  color: #92400e;
}

.nexus-link-otp-row {
  display: flex;
  gap: 6px;
  margin: 8px 0;
}

.nexus-payment-link-otp {
  width: 2.25rem;
  text-align: center;
}

.nexus-link-action,
.nexus-link-secondary {
  display: inline-block;
  margin: 6px 8px 0 0;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.nexus-link-action {
  background: #635bff;
  border-color: #635bff;
  color: #fff;
}

.nexus-link-verified {
  font-size: 13px;
  color: #059669;
}

.nexus-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}
</style>